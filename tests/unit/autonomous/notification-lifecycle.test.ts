import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationLifecycle, type NotificationRecord } from '../../../src/autonomous/notification-lifecycle.js';

describe('NotificationLifecycle', () => {
  let lifecycle: NotificationLifecycle;

  beforeEach(() => {
    lifecycle = new NotificationLifecycle();
  });

  // ─── Creation ─────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a notification record in CREATED state', () => {
      const record = lifecycle.create({
        id: 'test-1',
        category: 'error',
        title: 'Test Error',
        body: 'Something broke',
        priority: 'P1',
        score: 0.65,
      });

      expect(record.state).toBe('CREATED');
      expect(record.id).toBe('test-1');
      expect(record.category).toBe('error');
      expect(record.priority).toBe('P1');
      expect(record.originalScore).toBe(0.65);
      expect(record.currentScore).toBe(0.65);
      expect(record.deliveryAttempts).toBe(0);
      expect(record.escalationLevel).toBe(0);
      expect(record.createdAt).toBeGreaterThan(0);
    });

    it('should store optional fields', () => {
      const record = lifecycle.create({
        id: 'test-2',
        category: 'finance',
        title: 'Budget',
        body: 'Budget alert',
        priority: 'P2',
        score: 0.5,
        dedupKey: 'budget_50',
        groupKey: 'budget_alerts',
        expiresAt: Date.now() + 60000,
      });

      expect(record.dedupKey).toBe('budget_50');
      expect(record.groupKey).toBe('budget_alerts');
      expect(record.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  // ─── State Transitions ────────────────────────────────────────────────────

  describe('state transitions', () => {
    let record: NotificationRecord;

    beforeEach(() => {
      record = lifecycle.create({
        id: 'test-trans',
        category: 'error',
        title: 'Test',
        body: 'Body',
        priority: 'P1',
        score: 0.7,
      });
    });

    it('should allow valid transition CREATED → QUEUED', () => {
      const updated = lifecycle.transition('test-trans', 'QUEUED', 'Quiet hours');
      expect(updated.state).toBe('QUEUED');
    });

    it('should allow valid transition CREATED → SENDING', () => {
      const updated = lifecycle.transition('test-trans', 'SENDING', 'Immediate delivery');
      expect(updated.state).toBe('SENDING');
      expect(updated.deliveryAttempts).toBe(1);
    });

    it('should allow full happy path: CREATED → SENDING → SENT → READ → ACKNOWLEDGED → RESOLVED', () => {
      lifecycle.transition('test-trans', 'SENDING', 'Delivering');
      lifecycle.transition('test-trans', 'SENT', 'Telegram delivered');
      lifecycle.transition('test-trans', 'READ', 'User opened');
      lifecycle.transition('test-trans', 'ACKNOWLEDGED', 'User tapped OK');
      const final = lifecycle.transition('test-trans', 'RESOLVED', 'Complete');

      expect(final.state).toBe('RESOLVED');
      expect(final.sentAt).toBeGreaterThan(0);
      expect(final.readAt).toBeGreaterThan(0);
      expect(final.acknowledgedAt).toBeGreaterThan(0);
      expect(final.resolvedAt).toBeGreaterThan(0);
    });

    it('should reject invalid transitions', () => {
      expect(() => lifecycle.transition('test-trans', 'RESOLVED', 'Skip ahead'))
        .toThrow('Invalid transition: CREATED → RESOLVED');
    });

    it('should reject transitions from terminal states', () => {
      lifecycle.transition('test-trans', 'DEDUPLICATED', 'Duplicate found');
      expect(() => lifecycle.transition('test-trans', 'SENDING', 'Try again'))
        .toThrow('Invalid transition: DEDUPLICATED → SENDING');
    });

    it('should throw for unknown notification ID', () => {
      expect(() => lifecycle.transition('nonexistent', 'SENT', 'Nope'))
        .toThrow('Notification nonexistent not found');
    });

    it('should track delivery attempts on SENDING', () => {
      lifecycle.transition('test-trans', 'SENDING', 'Attempt 1');
      expect(lifecycle.get('test-trans')?.deliveryAttempts).toBe(1);

      lifecycle.transition('test-trans', 'FAILED', 'Timeout');
      lifecycle.transition('test-trans', 'SENDING', 'Retry 1');
      expect(lifecycle.get('test-trans')?.deliveryAttempts).toBe(2);
    });

    it('should record last error on FAILED', () => {
      lifecycle.transition('test-trans', 'SENDING', 'Delivering');
      lifecycle.transition('test-trans', 'FAILED', 'Telegram API timeout');

      expect(lifecycle.get('test-trans')?.lastError).toBe('Telegram API timeout');
    });

    it('should add to dead letter queue on DEAD_LETTER', () => {
      lifecycle.transition('test-trans', 'SENDING', 'Delivering');
      lifecycle.transition('test-trans', 'FAILED', 'Network error');
      lifecycle.transition('test-trans', 'DEAD_LETTER', 'Max retries exceeded');

      const dlq = lifecycle.getDeadLetterQueue();
      expect(dlq).toHaveLength(1);
      expect(dlq[0].id).toBe('test-trans');
    });
  });

  // ─── Escalation ─────────────────────────────────────────────────────────

  describe('escalation', () => {
    it('should bump priority on ESCALATED transition', () => {
      lifecycle.create({
        id: 'esc-1',
        category: 'error',
        title: 'Unacked Error',
        body: 'Error body',
        priority: 'P2',
        score: 0.5,
      });

      lifecycle.transition('esc-1', 'SENDING', 'Delivering');
      lifecycle.transition('esc-1', 'SENT', 'Delivered');
      lifecycle.transition('esc-1', 'ESCALATED', 'No response in 4 hours');

      const record = lifecycle.get('esc-1');
      expect(record?.priority).toBe('P1'); // P2 → P1
      expect(record?.escalationLevel).toBe(1);
      expect(record?.escalatedFrom).toBe('P2');
    });

    it('should cap escalation at P0', () => {
      lifecycle.create({
        id: 'esc-2',
        category: 'security',
        title: 'Alert',
        body: 'Body',
        priority: 'P0',
        score: 0.9,
      });

      lifecycle.transition('esc-2', 'SENDING', 'Delivering');
      lifecycle.transition('esc-2', 'SENT', 'Delivered');
      lifecycle.transition('esc-2', 'ESCALATED', 'No response');

      expect(lifecycle.get('esc-2')?.priority).toBe('P0'); // Already P0, stays P0
    });

    it('should allow re-delivery after escalation', () => {
      lifecycle.create({
        id: 'esc-3',
        category: 'error',
        title: 'Error',
        body: 'Body',
        priority: 'P2',
        score: 0.5,
      });

      lifecycle.transition('esc-3', 'SENDING', 'Attempt 1');
      lifecycle.transition('esc-3', 'SENT', 'Delivered');
      lifecycle.transition('esc-3', 'ESCALATED', 'Timeout');
      lifecycle.transition('esc-3', 'SENDING', 'Re-delivery at P1');

      const record = lifecycle.get('esc-3');
      expect(record?.priority).toBe('P1');
      expect(record?.deliveryAttempts).toBe(2);
    });

    it('should detect notifications needing escalation', () => {
      lifecycle.create({
        id: 'check-1',
        category: 'error',
        title: 'Old Error',
        body: 'Body',
        priority: 'P1',
        score: 0.7,
      });

      // Simulate sending 31 minutes ago (P1 timeout is 30 min)
      lifecycle.transition('check-1', 'SENDING', 'Delivering');
      const record = lifecycle.get('check-1')!;
      record.sentAt = Date.now() - 31 * 60 * 1000;
      lifecycle.transition('check-1', 'SENT', 'Delivered');
      record.sentAt = Date.now() - 31 * 60 * 1000; // Override timestamp

      const toEscalate = lifecycle.checkEscalations();
      expect(toEscalate).toHaveLength(1);
      expect(toEscalate[0].id).toBe('check-1');
    });

    it('should not escalate P4 notifications', () => {
      lifecycle.create({
        id: 'p4-1',
        category: 'value',
        title: 'Low Priority',
        body: 'Body',
        priority: 'P4',
        score: 0.1,
      });

      lifecycle.transition('p4-1', 'SENDING', 'Delivering');
      const record = lifecycle.get('p4-1')!;
      lifecycle.transition('p4-1', 'SENT', 'Delivered');
      record.sentAt = Date.now() - 48 * 60 * 60 * 1000; // 2 days ago

      expect(lifecycle.checkEscalations()).toHaveLength(0);
    });
  });

  // ─── Retry Logic ────────────────────────────────────────────────────────

  describe('retry logic', () => {
    it('should return exponential backoff delay for failed notifications', () => {
      lifecycle.create({
        id: 'retry-1',
        category: 'error',
        title: 'Error',
        body: 'Body',
        priority: 'P1',
        score: 0.7,
      });

      lifecycle.transition('retry-1', 'SENDING', 'Attempt 1');
      lifecycle.transition('retry-1', 'FAILED', 'Timeout');

      const delay1 = lifecycle.getRetryDelay('retry-1');
      expect(delay1).toBe(5000); // 5s * 2^0

      lifecycle.transition('retry-1', 'SENDING', 'Attempt 2');
      lifecycle.transition('retry-1', 'FAILED', 'Timeout');

      const delay2 = lifecycle.getRetryDelay('retry-1');
      expect(delay2).toBe(10000); // 5s * 2^1
    });

    it('should return null when max retries exceeded', () => {
      lifecycle.create({
        id: 'retry-max',
        category: 'error',
        title: 'Error',
        body: 'Body',
        priority: 'P1',
        score: 0.7,
      });

      // Exhaust all 3 retries
      for (let i = 0; i < 3; i++) {
        lifecycle.transition('retry-max', 'SENDING', `Attempt ${i + 1}`);
        lifecycle.transition('retry-max', 'FAILED', 'Timeout');
      }

      expect(lifecycle.getRetryDelay('retry-max')).toBeNull();
    });

    it('should return null for non-failed notifications', () => {
      lifecycle.create({
        id: 'not-failed',
        category: 'task',
        title: 'Task',
        body: 'Body',
        priority: 'P3',
        score: 0.3,
      });

      expect(lifecycle.getRetryDelay('not-failed')).toBeNull();
    });
  });

  // ─── Deduplication ──────────────────────────────────────────────────────

  describe('deduplication', () => {
    it('should find duplicate by dedupKey', () => {
      lifecycle.create({
        id: 'orig',
        category: 'budget',
        title: 'Budget 50%',
        body: 'Body',
        priority: 'P2',
        score: 0.5,
        dedupKey: 'budget_50',
      });
      lifecycle.transition('orig', 'SENDING', 'Delivering');
      lifecycle.transition('orig', 'SENT', 'Delivered');

      const dupe = lifecycle.findDuplicate('budget_50');
      expect(dupe).toBeDefined();
      expect(dupe?.id).toBe('orig');
    });

    it('should not find duplicate for resolved notifications', () => {
      lifecycle.create({
        id: 'resolved-dupe',
        category: 'budget',
        title: 'Budget 50%',
        body: 'Body',
        priority: 'P2',
        score: 0.5,
        dedupKey: 'budget_50',
      });
      lifecycle.transition('resolved-dupe', 'SENDING', 'Delivering');
      lifecycle.transition('resolved-dupe', 'SENT', 'Delivered');
      lifecycle.transition('resolved-dupe', 'READ', 'Read');
      lifecycle.transition('resolved-dupe', 'ACKNOWLEDGED', 'Acked');
      lifecycle.transition('resolved-dupe', 'RESOLVED', 'Done');

      expect(lifecycle.findDuplicate('budget_50')).toBeUndefined();
    });

    it('should allow DEDUPLICATED transition from CREATED', () => {
      lifecycle.create({
        id: 'new-dupe',
        category: 'budget',
        title: 'Budget 50%',
        body: 'Body',
        priority: 'P2',
        score: 0.5,
      });

      const record = lifecycle.transition('new-dupe', 'DEDUPLICATED', 'Matches existing');
      expect(record.state).toBe('DEDUPLICATED');
    });
  });

  // ─── Expiration ─────────────────────────────────────────────────────────

  describe('expiration', () => {
    it('should expire notifications past their TTL', () => {
      lifecycle.create({
        id: 'exp-1',
        category: 'opportunity',
        title: 'Flash Sale',
        body: 'Body',
        priority: 'P1',
        score: 0.7,
        expiresAt: Date.now() - 1000, // Already expired
      });

      const expired = lifecycle.expireStale();
      expect(expired).toHaveLength(1);
      expect(expired[0].state).toBe('EXPIRED');
    });

    it('should not expire notifications without TTL', () => {
      lifecycle.create({
        id: 'no-ttl',
        category: 'task',
        title: 'Task',
        body: 'Body',
        priority: 'P3',
        score: 0.3,
      });

      expect(lifecycle.expireStale()).toHaveLength(0);
    });

    it('should not expire already-terminal notifications', () => {
      lifecycle.create({
        id: 'already-done',
        category: 'task',
        title: 'Task',
        body: 'Body',
        priority: 'P3',
        score: 0.3,
        expiresAt: Date.now() - 1000,
      });
      lifecycle.transition('already-done', 'SUPPRESSED', 'Cooldown');

      expect(lifecycle.expireStale()).toHaveLength(0);
    });
  });

  // ─── History & Stats ────────────────────────────────────────────────────

  describe('history and stats', () => {
    it('should record transition history', () => {
      lifecycle.create({
        id: 'hist-1',
        category: 'error',
        title: 'Error',
        body: 'Body',
        priority: 'P1',
        score: 0.7,
      });

      lifecycle.transition('hist-1', 'SENDING', 'Delivering');
      lifecycle.transition('hist-1', 'SENT', 'Success');
      lifecycle.transition('hist-1', 'READ', 'User read');

      const history = lifecycle.getHistory('hist-1');
      expect(history).toHaveLength(3);
      expect(history[0].fromState).toBe('CREATED');
      expect(history[0].toState).toBe('SENDING');
      expect(history[2].toState).toBe('READ');
    });

    it('should report accurate stats', () => {
      lifecycle.create({ id: 's1', category: 'error', title: 'E1', body: 'B', priority: 'P1', score: 0.7 });
      lifecycle.create({ id: 's2', category: 'error', title: 'E2', body: 'B', priority: 'P1', score: 0.7 });
      lifecycle.create({ id: 's3', category: 'task', title: 'T1', body: 'B', priority: 'P3', score: 0.3 });

      lifecycle.transition('s1', 'SENDING', 'Go');
      lifecycle.transition('s1', 'SENT', 'Done');
      lifecycle.transition('s2', 'SUPPRESSED', 'Cooldown');

      const stats = lifecycle.getStats();
      expect(stats.CREATED).toBe(1); // s3
      expect(stats.SENT).toBe(1);    // s1
      expect(stats.SUPPRESSED).toBe(1); // s2
    });

    it('should get notifications by state', () => {
      lifecycle.create({ id: 'by1', category: 'error', title: 'E1', body: 'B', priority: 'P1', score: 0.7 });
      lifecycle.create({ id: 'by2', category: 'error', title: 'E2', body: 'B', priority: 'P1', score: 0.7 });
      lifecycle.create({ id: 'by3', category: 'task', title: 'T1', body: 'B', priority: 'P3', score: 0.3 });

      lifecycle.transition('by1', 'SENDING', 'Go');
      lifecycle.transition('by1', 'SENT', 'Done');

      const sentItems = lifecycle.getByState('SENT');
      expect(sentItems).toHaveLength(1);
      expect(sentItems[0].id).toBe('by1');

      const createdItems = lifecycle.getByState('CREATED');
      expect(createdItems).toHaveLength(2);
    });
  });

  // ─── Cleanup ────────────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('should remove old terminal records', () => {
      lifecycle.create({
        id: 'old-1',
        category: 'task',
        title: 'Old Task',
        body: 'Body',
        priority: 'P3',
        score: 0.3,
      });

      // Manually set old creation time
      const record = lifecycle.get('old-1')!;
      record.createdAt = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
      lifecycle.transition('old-1', 'SUPPRESSED', 'Cooldown');

      const cleaned = lifecycle.cleanup();
      expect(cleaned).toBe(1);
      expect(lifecycle.size).toBe(0);
    });

    it('should not remove active records', () => {
      lifecycle.create({
        id: 'active-1',
        category: 'error',
        title: 'Active Error',
        body: 'Body',
        priority: 'P1',
        score: 0.7,
      });

      const record = lifecycle.get('active-1')!;
      record.createdAt = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
      lifecycle.transition('active-1', 'SENDING', 'Delivering');
      lifecycle.transition('active-1', 'SENT', 'Delivered');

      const cleaned = lifecycle.cleanup();
      expect(cleaned).toBe(0);
      expect(lifecycle.size).toBe(1);
    });

    it('should track total size', () => {
      expect(lifecycle.size).toBe(0);

      lifecycle.create({ id: 'sz1', category: 'task', title: 'T', body: 'B', priority: 'P3', score: 0.3 });
      lifecycle.create({ id: 'sz2', category: 'task', title: 'T', body: 'B', priority: 'P3', score: 0.3 });

      expect(lifecycle.size).toBe(2);
    });
  });
});
