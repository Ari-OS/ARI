import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailTriage } from '../../../../src/integrations/gmail/triage.js';
import type { EmailMessage, EmailClassification } from '../../../../src/integrations/gmail/triage.js';
import type { EventBus } from '../../../../src/kernel/event-bus.js';

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockEventBus(): EventBus {
  return {
    emit: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
  } as unknown as EventBus;
}

function createMockOrchestrator(response?: string) {
  return {
    query: vi.fn().mockResolvedValue(response ?? JSON.stringify({
      category: 'client_inquiry',
      confidence: 0.92,
      suggestedAction: 'Reply within 24 hours',
      priority: 'high',
      summary: 'Client asking about project timeline',
    })),
  };
}

function createTestEmail(overrides?: Partial<EmailMessage>): EmailMessage {
  return {
    id: 'email-001',
    from: 'client@example.com',
    subject: 'Project Timeline Question',
    body: 'Hi, I wanted to check on the status of our project. When can we expect the next milestone?',
    receivedAt: new Date().toISOString(),
    hasAttachments: false,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('EmailTriage', () => {
  let triage: EmailTriage;
  let eventBus: EventBus;
  let orchestrator: ReturnType<typeof createMockOrchestrator>;

  beforeEach(() => {
    eventBus = createMockEventBus();
    orchestrator = createMockOrchestrator();
    triage = new EmailTriage({ orchestrator, eventBus });
  });

  describe('classify', () => {
    it('should classify a client inquiry email', async () => {
      const email = createTestEmail();
      const result = await triage.classify(email);

      expect(result.emailId).toBe('email-001');
      expect(result.category).toBe('client_inquiry');
      expect(result.confidence).toBe(0.92);
      expect(result.priority).toBe('high');
      expect(result.suggestedAction).toBe('Reply within 24 hours');
    });

    it('should emit email:triaged event on classification', async () => {
      const email = createTestEmail();
      await triage.classify(email);

      expect(eventBus.emit).toHaveBeenCalledWith('email:triaged', expect.objectContaining({
        emailId: 'email-001',
        category: 'client_inquiry',
        priority: 'high',
      }));
    });

    it('should emit email:action_required for high priority emails', async () => {
      const email = createTestEmail();
      await triage.classify(email);

      expect(eventBus.emit).toHaveBeenCalledWith('email:action_required', expect.objectContaining({
        emailId: 'email-001',
        subject: 'Project Timeline Question',
        suggestedAction: 'Reply within 24 hours',
      }));
    });

    it('should not emit email:action_required for low priority FYI emails', async () => {
      orchestrator.query.mockResolvedValue(JSON.stringify({
        category: 'fyi',
        confidence: 0.88,
        suggestedAction: 'No action needed',
        priority: 'low',
        summary: 'FYI notification',
      }));

      const email = createTestEmail({ subject: 'FYI: Meeting notes' });
      await triage.classify(email);

      const actionRequiredCalls = (eventBus.emit as ReturnType<typeof vi.fn>).mock.calls
        .filter(([event]: [string]) => event === 'email:action_required');
      expect(actionRequiredCalls).toHaveLength(0);
    });

    it('should classify spam correctly', async () => {
      orchestrator.query.mockResolvedValue(JSON.stringify({
        category: 'spam',
        confidence: 0.95,
        suggestedAction: 'Delete',
        priority: 'low',
        summary: 'Unsolicited marketing',
      }));

      const email = createTestEmail({
        id: 'spam-001',
        from: 'noreply@scammer.com',
        subject: 'You won $1,000,000!',
        body: 'Click here to claim your prize',
      });

      const result = await triage.classify(email);
      expect(result.category).toBe('spam');
      expect(result.priority).toBe('low');
    });

    it('should classify newsletters', async () => {
      orchestrator.query.mockResolvedValue(JSON.stringify({
        category: 'newsletter',
        confidence: 0.91,
        suggestedAction: 'Read when available',
        priority: 'low',
        summary: 'Weekly tech newsletter',
      }));

      const email = createTestEmail({
        id: 'news-001',
        from: 'digest@techcrunch.com',
        subject: 'TechCrunch Daily Digest',
      });

      const result = await triage.classify(email);
      expect(result.category).toBe('newsletter');
    });

    it('should return default classification when LLM fails', async () => {
      orchestrator.query.mockRejectedValue(new Error('LLM unavailable'));

      const email = createTestEmail({ id: 'fail-001' });
      const result = await triage.classify(email);

      expect(result.emailId).toBe('fail-001');
      expect(result.category).toBe('fyi');
      expect(result.priority).toBe('low');
      expect(result.suggestedAction).toBe('Review manually');
    });

    it('should handle malformed LLM JSON response', async () => {
      orchestrator.query.mockResolvedValue('This is not valid JSON at all');

      const email = createTestEmail({ id: 'malformed-001' });
      const result = await triage.classify(email);

      expect(result.emailId).toBe('malformed-001');
      expect(result.category).toBe('fyi');
      expect(result.confidence).toBe(0.5);
    });

    it('should clamp confidence to 0-1 range', async () => {
      orchestrator.query.mockResolvedValue(JSON.stringify({
        category: 'opportunity',
        confidence: 1.5,
        suggestedAction: 'Follow up',
        priority: 'medium',
        summary: 'Possible lead',
      }));

      const email = createTestEmail();
      const result = await triage.classify(email);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle JSON embedded in markdown code blocks', async () => {
      orchestrator.query.mockResolvedValue('```json\n' + JSON.stringify({
        category: 'opportunity',
        confidence: 0.85,
        suggestedAction: 'Schedule call',
        priority: 'medium',
        summary: 'Potential partnership',
      }) + '\n```');

      const email = createTestEmail();
      const result = await triage.classify(email);
      expect(result.category).toBe('opportunity');
      expect(result.confidence).toBe(0.85);
    });

    it('should pass email content to orchestrator query', async () => {
      const email = createTestEmail({
        from: 'vip@company.com',
        subject: 'Urgent: Contract Review',
      });

      await triage.classify(email);

      expect(orchestrator.query).toHaveBeenCalledTimes(1);
      const prompt = orchestrator.query.mock.calls[0][0] as string;
      expect(prompt).toContain('vip@company.com');
      expect(prompt).toContain('Urgent: Contract Review');
    });
  });

  describe('triageBatch', () => {
    it('should process multiple emails', async () => {
      const emails = [
        createTestEmail({ id: 'batch-1' }),
        createTestEmail({ id: 'batch-2', subject: 'Newsletter' }),
        createTestEmail({ id: 'batch-3', subject: 'Invoice Due' }),
      ];

      const results = await triage.triageBatch(emails);
      expect(results).toHaveLength(3);
      expect(results[0].emailId).toBe('batch-1');
      expect(results[1].emailId).toBe('batch-2');
      expect(results[2].emailId).toBe('batch-3');
    });

    it('should handle empty batch', async () => {
      const results = await triage.triageBatch([]);
      expect(results).toHaveLength(0);
    });

    it('should classify each email individually', async () => {
      const emails = [
        createTestEmail({ id: 'ind-1' }),
        createTestEmail({ id: 'ind-2' }),
      ];

      await triage.triageBatch(emails);
      expect(orchestrator.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSummary', () => {
    it('should count categories correctly', () => {
      const classifications: EmailClassification[] = [
        { emailId: '1', category: 'client_inquiry', confidence: 0.9, suggestedAction: 'Reply', priority: 'high', summary: 'Client question' },
        { emailId: '2', category: 'client_inquiry', confidence: 0.85, suggestedAction: 'Reply', priority: 'high', summary: 'Another client' },
        { emailId: '3', category: 'spam', confidence: 0.95, suggestedAction: 'Delete', priority: 'low', summary: 'Spam' },
        { emailId: '4', category: 'fyi', confidence: 0.8, suggestedAction: 'None', priority: 'low', summary: 'Info' },
        { emailId: '5', category: 'opportunity', confidence: 0.7, suggestedAction: 'Follow up', priority: 'medium', summary: 'Lead' },
      ];

      const summary = triage.getSummary(classifications);

      expect(summary.total).toBe(5);
      expect(summary.byCategory.client_inquiry).toBe(2);
      expect(summary.byCategory.spam).toBe(1);
      expect(summary.byCategory.fyi).toBe(1);
      expect(summary.byCategory.opportunity).toBe(1);
      expect(summary.byCategory.action_required).toBe(0);
      expect(summary.byCategory.newsletter).toBe(0);
    });

    it('should collect action required items', () => {
      const classifications: EmailClassification[] = [
        { emailId: '1', category: 'action_required', confidence: 0.9, suggestedAction: 'Do it', priority: 'high', summary: 'Needs action' },
        { emailId: '2', category: 'fyi', confidence: 0.8, suggestedAction: 'None', priority: 'high', summary: 'Important FYI' },
        { emailId: '3', category: 'spam', confidence: 0.95, suggestedAction: 'Delete', priority: 'low', summary: 'Spam' },
      ];

      const summary = triage.getSummary(classifications);

      // action_required category + high priority items
      expect(summary.actionRequired).toHaveLength(2);
      expect(summary.actionRequired.map(a => a.emailId)).toContain('1');
      expect(summary.actionRequired.map(a => a.emailId)).toContain('2');
    });

    it('should generate highlights', () => {
      const classifications: EmailClassification[] = [
        { emailId: '1', category: 'client_inquiry', confidence: 0.9, suggestedAction: 'Reply', priority: 'high', summary: 'Client' },
        { emailId: '2', category: 'opportunity', confidence: 0.8, suggestedAction: 'Follow up', priority: 'medium', summary: 'Lead' },
        { emailId: '3', category: 'spam', confidence: 0.95, suggestedAction: 'Delete', priority: 'low', summary: 'Spam' },
      ];

      const summary = triage.getSummary(classifications);

      expect(summary.highlights.length).toBeGreaterThan(0);
      expect(summary.highlights.some(h => h.includes('client inquiry'))).toBe(true);
      expect(summary.highlights.some(h => h.includes('opportunity'))).toBe(true);
      expect(summary.highlights.some(h => h.includes('spam'))).toBe(true);
    });

    it('should handle empty classifications', () => {
      const summary = triage.getSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.actionRequired).toHaveLength(0);
      expect(summary.highlights).toHaveLength(0);
    });
  });
});
