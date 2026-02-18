/**
 * Stripe Webhook Monitor
 *
 * Processes Stripe webhook events, tracks MRR, and monitors revenue milestones
 * for Pryceless Solutions. Uses HMAC-SHA256 for webhook signature verification.
 *
 * Milestones: $500, $1K, $2.5K, $5K, $10K, $25K, $50K, $100K MRR
 *
 * Usage:
 *   const monitor = new StripeWebhookMonitor({ eventBus, webhookSecret });
 *   const result = monitor.processWebhook(payload, signature);
 *   const mrr = monitor.getMRR();
 *   const milestones = monitor.checkMilestones();
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createLogger } from '../../kernel/logger.js';
import type { EventBus } from '../../kernel/event-bus.js';

const log = createLogger('stripe-webhook-monitor');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StripeEventResult {
  eventType: string;
  processed: boolean;
  details: Record<string, unknown>;
}

export interface MRRSnapshot {
  currentMRR: number;
  previousMRR: number;
  changePercent: number;
  activeSubscriptions: number;
  churnedThisMonth: number;
}

export interface MilestoneAlert {
  milestone: string;
  achieved: boolean;
  currentValue: number;
  targetValue: number;
}

interface SubscriptionRecord {
  id: string;
  customerId: string;
  amount: number;       // Monthly amount in cents
  currency: string;
  status: 'active' | 'canceled' | 'past_due';
  startedAt: string;
  canceledAt?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MILESTONES = [
  { label: '$500 MRR', value: 500_00 },
  { label: '$1K MRR', value: 1_000_00 },
  { label: '$2.5K MRR', value: 2_500_00 },
  { label: '$5K MRR', value: 5_000_00 },
  { label: '$10K MRR', value: 10_000_00 },
  { label: '$25K MRR', value: 25_000_00 },
  { label: '$50K MRR', value: 50_000_00 },
  { label: '$100K MRR', value: 100_000_00 },
];

const HANDLED_EVENTS = new Set([
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'charge.succeeded',
  'charge.failed',
]);

// ─── StripeWebhookMonitor ───────────────────────────────────────────────────

export class StripeWebhookMonitor {
  private eventBus: EventBus;
  private webhookSecret: string;
  private subscriptions: Map<string, SubscriptionRecord> = new Map();
  private previousMRR: number = 0;
  private churnedThisMonth: number = 0;
  private lastMonthReset: string = '';

  constructor(params: {
    eventBus: EventBus;
    webhookSecret?: string;
  }) {
    this.eventBus = params.eventBus;
    this.webhookSecret = params.webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET ?? '';
  }

  /**
   * Process a Stripe webhook event
   */
  processWebhook(payload: string, signature: string): StripeEventResult {
    // Verify signature
    if (this.webhookSecret && !this.verifySignature(payload, signature)) {
      log.warn('Invalid webhook signature');
      return { eventType: 'unknown', processed: false, details: { error: 'Invalid signature' } };
    }

    let event: { type: string; data: { object: Record<string, unknown> } };
    try {
      event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
    } catch {
      log.error('Failed to parse webhook payload');
      return { eventType: 'unknown', processed: false, details: { error: 'Invalid JSON' } };
    }

    if (!HANDLED_EVENTS.has(event.type)) {
      log.debug({ eventType: event.type }, 'Unhandled event type');
      return { eventType: event.type, processed: false, details: { reason: 'Unhandled event type' } };
    }

    this.resetMonthlyCounters();

    const obj = event.data.object;
    const details: Record<string, unknown> = { eventType: event.type };

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = this.upsertSubscription(obj);
        details.subscriptionId = sub.id;
        details.amount = sub.amount;
        details.status = sub.status;
        break;
      }

      case 'customer.subscription.deleted': {
        const subId = typeof obj.id === 'string' ? obj.id : '';
        const existing = this.subscriptions.get(subId);
        if (existing) {
          existing.status = 'canceled';
          existing.canceledAt = new Date().toISOString();
          this.churnedThisMonth++;
          details.subscriptionId = subId;
          details.churnedAmount = existing.amount;

          this.eventBus.emit('stripe:churn_detected', {
            customerId: existing.customerId,
            mrr: existing.amount,
            timestamp: new Date().toISOString(),
          });
        }
        break;
      }

      case 'invoice.payment_succeeded':
      case 'charge.succeeded': {
        const amount = Number(obj.amount_paid ?? obj.amount ?? 0);
        const currency = typeof obj.currency === 'string' ? obj.currency : 'usd';
        const customer = typeof obj.customer === 'string' ? obj.customer : '';
        details.amount = amount;
        details.currency = currency;

        this.eventBus.emit('stripe:payment_received', {
          amount,
          currency,
          customer,
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'invoice.payment_failed':
      case 'charge.failed': {
        details.failureMessage = obj.failure_message ?? 'Unknown failure';
        break;
      }
    }

    // Check milestones after processing
    const newMilestones = this.checkMilestones().filter(m => m.achieved);
    for (const milestone of newMilestones) {
      this.eventBus.emit('stripe:milestone_reached', {
        milestone: milestone.milestone,
        currentValue: milestone.currentValue,
        timestamp: new Date().toISOString(),
      });
    }

    log.info({ eventType: event.type, details }, 'Webhook processed');
    return { eventType: event.type, processed: true, details };
  }

  /**
   * Get current MRR snapshot
   */
  getMRR(): MRRSnapshot {
    let currentMRR = 0;
    let activeSubscriptions = 0;

    for (const sub of this.subscriptions.values()) {
      if (sub.status === 'active') {
        currentMRR += sub.amount;
        activeSubscriptions++;
      }
    }

    const changePercent = this.previousMRR > 0
      ? ((currentMRR - this.previousMRR) / this.previousMRR) * 100
      : 0;

    return {
      currentMRR,
      previousMRR: this.previousMRR,
      changePercent: Math.round(changePercent * 100) / 100,
      activeSubscriptions,
      churnedThisMonth: this.churnedThisMonth,
    };
  }

  /**
   * Check milestone achievements
   */
  checkMilestones(): MilestoneAlert[] {
    const { currentMRR } = this.getMRR();

    return MILESTONES.map(m => ({
      milestone: m.label,
      achieved: currentMRR >= m.value,
      currentValue: currentMRR,
      targetValue: m.value,
    }));
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Verify Stripe webhook signature using HMAC-SHA256
   */
  private verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) return true;

    try {
      // Stripe signature format: t=timestamp,v1=signature
      const parts = signature.split(',');
      const timestampPart = parts.find(p => p.startsWith('t='));
      const sigPart = parts.find(p => p.startsWith('v1='));

      if (!timestampPart || !sigPart) return false;

      const timestamp = timestampPart.slice(2);
      const expectedSig = sigPart.slice(3);

      const signedPayload = `${timestamp}.${payload}`;
      const computedSig = createHmac('sha256', this.webhookSecret)
        .update(signedPayload)
        .digest('hex');

      return timingSafeEqual(
        Buffer.from(computedSig, 'hex'),
        Buffer.from(expectedSig, 'hex'),
      );
    } catch {
      log.warn('Signature verification error');
      return false;
    }
  }

  /**
   * Upsert a subscription record from webhook data
   */
  private upsertSubscription(obj: Record<string, unknown>): SubscriptionRecord {
    const id = typeof obj.id === 'string' ? obj.id : '';
    const items = obj.items as { data?: Array<{ plan?: { amount?: number } }> } | undefined;
    const amount = items?.data?.[0]?.plan?.amount ?? Number(obj.plan?.valueOf() ?? 0);

    const record: SubscriptionRecord = {
      id,
      customerId: typeof obj.customer === 'string' ? obj.customer : '',
      amount: typeof amount === 'number' ? amount : 0,
      currency: typeof obj.currency === 'string' ? obj.currency : 'usd',
      status: obj.status === 'active' ? 'active'
        : obj.status === 'past_due' ? 'past_due'
        : 'canceled',
      startedAt: obj.start_date
        ? new Date(Number(obj.start_date) * 1000).toISOString()
        : new Date().toISOString(),
    };

    this.subscriptions.set(id, record);
    return record;
  }

  /**
   * Reset monthly counters on month boundary
   */
  private resetMonthlyCounters(): void {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    if (this.lastMonthReset !== currentMonth) {
      this.previousMRR = this.getMRR().currentMRR;
      this.churnedThisMonth = 0;
      this.lastMonthReset = currentMonth;
    }
  }
}
