import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { StripeWebhookMonitor } from '../../../../src/integrations/stripe/webhook-monitor.js';
import type { StripeEventResult, MRRSnapshot, MilestoneAlert } from '../../../../src/integrations/stripe/webhook-monitor.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEmit = vi.fn();
const mockEventBus = { emit: mockEmit } as unknown as ConstructorParameters<typeof StripeWebhookMonitor>[0]['eventBus'];

vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${timestamp}.${payload}`;
  const sig = createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

function makeSubscriptionEvent(type: string, sub: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type,
    data: {
      object: {
        id: 'sub_123',
        customer: 'cus_456',
        status: 'active',
        currency: 'usd',
        items: { data: [{ plan: { amount: 2999 } }] },
        ...sub,
      },
    },
  });
}

function makePaymentEvent(type: string, obj: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type,
    data: {
      object: {
        amount_paid: 2999,
        currency: 'usd',
        customer: 'cus_456',
        ...obj,
      },
    },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StripeWebhookMonitor', () => {
  let monitor: StripeWebhookMonitor;
  const secret = 'whsec_test_secret';

  beforeEach(() => {
    vi.clearAllMocks();
    monitor = new StripeWebhookMonitor({
      eventBus: mockEventBus,
      webhookSecret: secret,
    });
  });

  describe('processWebhook() — signature verification', () => {
    it('should reject invalid signatures', () => {
      const payload = makeSubscriptionEvent('customer.subscription.created');

      const result = monitor.processWebhook(payload, 't=123,v1=invalid');

      expect(result.processed).toBe(false);
      expect(result.details).toHaveProperty('error', 'Invalid signature');
    });

    it('should accept valid signatures', () => {
      const payload = makeSubscriptionEvent('customer.subscription.created');
      const sig = makeSignature(payload, secret);

      const result = monitor.processWebhook(payload, sig);

      expect(result.processed).toBe(true);
    });

    it('should reject signature missing timestamp part', () => {
      const result = monitor.processWebhook('{}', 'v1=abc');

      expect(result.processed).toBe(false);
    });

    it('should reject signature missing v1 part', () => {
      const result = monitor.processWebhook('{}', 't=123');

      expect(result.processed).toBe(false);
    });
  });

  describe('processWebhook() — no secret configured', () => {
    it('should skip signature verification when no secret', () => {
      const noSecretMonitor = new StripeWebhookMonitor({
        eventBus: mockEventBus,
        webhookSecret: '',
      });

      const payload = makeSubscriptionEvent('customer.subscription.created');
      const result = noSecretMonitor.processWebhook(payload, 'any-sig');

      expect(result.processed).toBe(true);
    });
  });

  describe('processWebhook() — subscription events', () => {
    it('should process customer.subscription.created', () => {
      const payload = makeSubscriptionEvent('customer.subscription.created');
      const sig = makeSignature(payload, secret);

      const result = monitor.processWebhook(payload, sig);

      expect(result.eventType).toBe('customer.subscription.created');
      expect(result.processed).toBe(true);
    });

    it('should process customer.subscription.updated', () => {
      const payload = makeSubscriptionEvent('customer.subscription.updated');
      const sig = makeSignature(payload, secret);

      const result = monitor.processWebhook(payload, sig);

      expect(result.eventType).toBe('customer.subscription.updated');
      expect(result.processed).toBe(true);
    });

    it('should track subscription and update MRR', () => {
      const payload = makeSubscriptionEvent('customer.subscription.created');
      const sig = makeSignature(payload, secret);
      monitor.processWebhook(payload, sig);

      const mrr = monitor.getMRR();

      expect(mrr.activeSubscriptions).toBe(1);
      expect(mrr.currentMRR).toBe(2999);
    });

    it('should handle subscription deletion and track churn', () => {
      // Create subscription first
      const createPayload = makeSubscriptionEvent('customer.subscription.created');
      monitor.processWebhook(createPayload, makeSignature(createPayload, secret));

      // Delete it
      const deletePayload = makeSubscriptionEvent('customer.subscription.deleted');
      const deleteSig = makeSignature(deletePayload, secret);
      monitor.processWebhook(deletePayload, deleteSig);

      expect(mockEmit).toHaveBeenCalledWith('stripe:churn_detected', expect.objectContaining({
        customerId: 'cus_456',
      }));
    });
  });

  describe('processWebhook() — payment events', () => {
    it('should process invoice.payment_succeeded', () => {
      const payload = makePaymentEvent('invoice.payment_succeeded');
      const sig = makeSignature(payload, secret);

      const result = monitor.processWebhook(payload, sig);

      expect(result.processed).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith('stripe:payment_received', expect.objectContaining({
        amount: 2999,
        currency: 'usd',
      }));
    });

    it('should process charge.succeeded', () => {
      const payload = makePaymentEvent('charge.succeeded', { amount: 5000 });
      const sig = makeSignature(payload, secret);

      const result = monitor.processWebhook(payload, sig);

      expect(result.processed).toBe(true);
    });

    it('should process invoice.payment_failed', () => {
      const payload = JSON.stringify({
        type: 'invoice.payment_failed',
        data: { object: { failure_message: 'Card declined' } },
      });
      const sig = makeSignature(payload, secret);

      const result = monitor.processWebhook(payload, sig);

      expect(result.processed).toBe(true);
      expect(result.details).toHaveProperty('failureMessage', 'Card declined');
    });
  });

  describe('processWebhook() — unhandled events', () => {
    it('should return processed=false for unhandled event types', () => {
      const payload = JSON.stringify({ type: 'customer.created', data: { object: {} } });
      const sig = makeSignature(payload, secret);

      const result = monitor.processWebhook(payload, sig);

      expect(result.processed).toBe(false);
      expect(result.eventType).toBe('customer.created');
    });
  });

  describe('processWebhook() — invalid payload', () => {
    it('should handle invalid JSON payload', () => {
      const noSecretMonitor = new StripeWebhookMonitor({
        eventBus: mockEventBus,
        webhookSecret: '',
      });

      const result = noSecretMonitor.processWebhook('not json', '');

      expect(result.processed).toBe(false);
      expect(result.details).toHaveProperty('error', 'Invalid JSON');
    });
  });

  describe('getMRR()', () => {
    it('should return zero MRR with no subscriptions', () => {
      const mrr = monitor.getMRR();

      expect(mrr.currentMRR).toBe(0);
      expect(mrr.activeSubscriptions).toBe(0);
      expect(mrr.churnedThisMonth).toBe(0);
    });

    it('should calculate MRR from multiple active subscriptions', () => {
      const sub1 = makeSubscriptionEvent('customer.subscription.created', { id: 'sub_1', items: { data: [{ plan: { amount: 1000 } }] } });
      const sub2 = makeSubscriptionEvent('customer.subscription.created', { id: 'sub_2', items: { data: [{ plan: { amount: 2000 } }] } });

      monitor.processWebhook(sub1, makeSignature(sub1, secret));
      monitor.processWebhook(sub2, makeSignature(sub2, secret));

      const mrr = monitor.getMRR();

      expect(mrr.currentMRR).toBe(3000);
      expect(mrr.activeSubscriptions).toBe(2);
    });

    it('should not count canceled subscriptions in MRR', () => {
      const create = makeSubscriptionEvent('customer.subscription.created');
      monitor.processWebhook(create, makeSignature(create, secret));

      const del = makeSubscriptionEvent('customer.subscription.deleted');
      monitor.processWebhook(del, makeSignature(del, secret));

      const mrr = monitor.getMRR();
      // After cancellation, subscription status is 'canceled'
      expect(mrr.activeSubscriptions).toBe(0);
    });
  });

  describe('checkMilestones()', () => {
    it('should return all milestones as not achieved with no subscriptions', () => {
      const milestones = monitor.checkMilestones();

      expect(milestones.length).toBeGreaterThanOrEqual(8);
      expect(milestones.every(m => !m.achieved)).toBe(true);
    });

    it('should mark $500 milestone as achieved when MRR exceeds 50000 cents', () => {
      // Add subscription worth $500+/month = 50000 cents
      const payload = makeSubscriptionEvent('customer.subscription.created', {
        id: 'sub_big',
        items: { data: [{ plan: { amount: 55000 } }] },
      });
      monitor.processWebhook(payload, makeSignature(payload, secret));

      const milestones = monitor.checkMilestones();
      const m500 = milestones.find(m => m.milestone === '$500 MRR');

      expect(m500).toBeDefined();
      expect(m500!.achieved).toBe(true);
    });

    it('should emit milestone_reached event for achieved milestones', () => {
      const payload = makeSubscriptionEvent('customer.subscription.created', {
        id: 'sub_big',
        items: { data: [{ plan: { amount: 55000 } }] },
      });

      monitor.processWebhook(payload, makeSignature(payload, secret));

      expect(mockEmit).toHaveBeenCalledWith('stripe:milestone_reached', expect.objectContaining({
        milestone: '$500 MRR',
      }));
    });
  });
});
