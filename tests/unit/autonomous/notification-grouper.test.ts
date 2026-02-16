import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  NotificationGrouper,
  notificationGrouper,
} from '../../../src/autonomous/notification-grouper.js';
import type { NotificationRecord } from '../../../src/autonomous/notification-lifecycle.js';
import type { NotificationCategory } from '../../../src/autonomous/notification-manager.js';
import type { NotificationPriority } from '../../../src/autonomous/types.js';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<NotificationRecord> & {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
}): NotificationRecord {
  return {
    title: `Test notification ${overrides.id}`,
    body: `Body for ${overrides.id}`,
    state: 'CREATED',
    createdAt: Date.now(),
    deliveryAttempts: 0,
    maxRetries: 3,
    originalScore: 0.5,
    currentScore: 0.5,
    escalationLevel: 0,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('NotificationGrouper', () => {
  let grouper: NotificationGrouper;

  beforeEach(() => {
    grouper = new NotificationGrouper();
  });

  // ── Adding to groups ─────────────────────────────────────────────────────

  describe('add', () => {
    it('should create a new group for first record with groupKey', () => {
      const record = makeRecord({
        id: 'n1',
        category: 'budget',
        priority: 'P2',
        groupKey: 'budget:daily',
      });

      const group = grouper.add(record);
      expect(group.groupKey).toBe('budget:daily');
      expect(group.records).toHaveLength(1);
      expect(group.category).toBe('budget');
      expect(group.priority).toBe('P2');
    });

    it('should add to existing group when groupKey matches', () => {
      const r1 = makeRecord({
        id: 'n1',
        category: 'budget',
        priority: 'P2',
        groupKey: 'budget:daily',
      });
      const r2 = makeRecord({
        id: 'n2',
        category: 'budget',
        priority: 'P2',
        groupKey: 'budget:daily',
      });

      grouper.add(r1);
      const group = grouper.add(r2);
      expect(group.records).toHaveLength(2);
    });

    it('should promote group priority to highest member', () => {
      const r1 = makeRecord({
        id: 'n1',
        category: 'error',
        priority: 'P2',
        groupKey: 'errors:api',
      });
      const r2 = makeRecord({
        id: 'n2',
        category: 'error',
        priority: 'P1',
        groupKey: 'errors:api',
      });

      grouper.add(r1);
      const group = grouper.add(r2);
      expect(group.priority).toBe('P1');
    });

    it('should use record ID as key when no groupKey', () => {
      const record = makeRecord({
        id: 'solo-1',
        category: 'milestone',
        priority: 'P3',
      });

      const group = grouper.add(record);
      expect(group.groupKey).toBe('solo-1');
      expect(group.records).toHaveLength(1);
    });

    it('should track group size', () => {
      grouper.add(makeRecord({ id: 'n1', category: 'task', priority: 'P3', groupKey: 'g1' }));
      grouper.add(makeRecord({ id: 'n2', category: 'task', priority: 'P3', groupKey: 'g2' }));
      expect(grouper.size).toBe(2);
    });
  });

  // ── Deferral decision ────────────────────────────────────────────────────

  describe('shouldDefer', () => {
    it('should never defer P0 notifications', () => {
      const record = makeRecord({
        id: 'p0-1',
        category: 'security',
        priority: 'P0',
        groupKey: 'security:breach',
      });
      // Add an existing group first
      grouper.add(makeRecord({
        id: 'p0-0',
        category: 'security',
        priority: 'P0',
        groupKey: 'security:breach',
      }));

      expect(grouper.shouldDefer(record)).toBe(false);
    });

    it('should never defer P1 notifications', () => {
      const record = makeRecord({
        id: 'p1-1',
        category: 'error',
        priority: 'P1',
        groupKey: 'errors:api',
      });
      grouper.add(makeRecord({
        id: 'p1-0',
        category: 'error',
        priority: 'P1',
        groupKey: 'errors:api',
      }));

      expect(grouper.shouldDefer(record)).toBe(false);
    });

    it('should defer P2+ with existing group', () => {
      grouper.add(makeRecord({
        id: 'b1',
        category: 'budget',
        priority: 'P2',
        groupKey: 'budget:alerts',
      }));

      const record = makeRecord({
        id: 'b2',
        category: 'budget',
        priority: 'P2',
        groupKey: 'budget:alerts',
      });

      expect(grouper.shouldDefer(record)).toBe(true);
    });

    it('should not defer when no groupKey', () => {
      const record = makeRecord({
        id: 'solo',
        category: 'milestone',
        priority: 'P3',
      });

      expect(grouper.shouldDefer(record)).toBe(false);
    });

    it('should not defer when no existing group', () => {
      const record = makeRecord({
        id: 'first',
        category: 'task',
        priority: 'P3',
        groupKey: 'tasks:new',
      });

      expect(grouper.shouldDefer(record)).toBe(false);
    });

    it('should not defer when group is already flushed', () => {
      grouper.add(makeRecord({
        id: 'f1',
        category: 'task',
        priority: 'P3',
        groupKey: 'tasks:done',
      }));
      grouper.flush('tasks:done');

      const record = makeRecord({
        id: 'f2',
        category: 'task',
        priority: 'P3',
        groupKey: 'tasks:done',
      });

      expect(grouper.shouldDefer(record)).toBe(false);
    });
  });

  // ── Pending groups ───────────────────────────────────────────────────────

  describe('getPendingGroups', () => {
    it('should return only unflushed groups', () => {
      grouper.add(makeRecord({ id: 'a1', category: 'task', priority: 'P3', groupKey: 'g1' }));
      grouper.add(makeRecord({ id: 'a2', category: 'task', priority: 'P3', groupKey: 'g2' }));
      grouper.flush('g1');

      const pending = grouper.getPendingGroups();
      expect(pending).toHaveLength(1);
      expect(pending[0].groupKey).toBe('g2');
    });
  });

  describe('getReadyGroups', () => {
    it('should return groups with 2+ items by default', () => {
      grouper.add(makeRecord({ id: 'r1', category: 'budget', priority: 'P2', groupKey: 'ready' }));
      grouper.add(makeRecord({ id: 'r2', category: 'budget', priority: 'P2', groupKey: 'ready' }));
      grouper.add(makeRecord({ id: 's1', category: 'task', priority: 'P3', groupKey: 'single' }));

      const ready = grouper.getReadyGroups();
      expect(ready).toHaveLength(1);
      expect(ready[0].groupKey).toBe('ready');
    });

    it('should respect custom minItems threshold', () => {
      grouper.add(makeRecord({ id: 'r1', category: 'budget', priority: 'P2', groupKey: 'three' }));
      grouper.add(makeRecord({ id: 'r2', category: 'budget', priority: 'P2', groupKey: 'three' }));
      grouper.add(makeRecord({ id: 'r3', category: 'budget', priority: 'P2', groupKey: 'three' }));

      expect(grouper.getReadyGroups(3)).toHaveLength(1);
      expect(grouper.getReadyGroups(4)).toHaveLength(0);
    });
  });

  // ── Summary generation ───────────────────────────────────────────────────

  describe('generateSummary', () => {
    it('should generate a summary for a group', () => {
      grouper.add(makeRecord({ id: 'b1', category: 'budget', priority: 'P2', groupKey: 'budget:alerts', title: 'Daily API spend: $2.50' }));
      grouper.add(makeRecord({ id: 'b2', category: 'budget', priority: 'P2', groupKey: 'budget:alerts', title: 'Model cost spike detected' }));
      grouper.add(makeRecord({ id: 'b3', category: 'budget', priority: 'P2', groupKey: 'budget:alerts', title: 'Budget 80% consumed' }));

      const group = grouper.getGroup('budget:alerts')!;
      const summary = grouper.generateSummary(group);

      expect(summary.count).toBe(3);
      expect(summary.title).toBe('3 Budget Notifications');
      expect(summary.body).toContain('Daily API spend');
      expect(summary.body).toContain('Model cost spike');
      expect(summary.body).toContain('Budget 80%');
      expect(summary.category).toBe('budget');
    });

    it('should truncate long titles in summary body', () => {
      const longTitle = 'A'.repeat(80);
      grouper.add(makeRecord({ id: 'l1', category: 'error', priority: 'P2', groupKey: 'errs', title: longTitle }));
      grouper.add(makeRecord({ id: 'l2', category: 'error', priority: 'P2', groupKey: 'errs', title: 'Short title' }));

      const group = grouper.getGroup('errs')!;
      const summary = grouper.generateSummary(group);

      expect(summary.body).toContain('...');
    });

    it('should show "and N more" for large groups', () => {
      for (let i = 0; i < 8; i++) {
        grouper.add(makeRecord({
          id: `m${i}`,
          category: 'task',
          priority: 'P3',
          groupKey: 'big',
          title: `Task ${i}`,
        }));
      }

      const group = grouper.getGroup('big')!;
      const summary = grouper.generateSummary(group);

      expect(summary.count).toBe(8);
      expect(summary.body).toContain('and 3 more');
    });

    it('should return single record body for group of 1', () => {
      const record = makeRecord({
        id: 's1',
        category: 'milestone',
        priority: 'P3',
        groupKey: 'solo',
        body: 'Milestone achieved!',
      });
      grouper.add(record);

      const group = grouper.getGroup('solo')!;
      const summary = grouper.generateSummary(group);

      expect(summary.count).toBe(1);
      expect(summary.body).toBe('Milestone achieved!');
      expect(summary.title).toBe('Milestone');
    });
  });

  // ── Auto-resolve ─────────────────────────────────────────────────────────

  describe('getAutoResolveCandidates', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should not auto-resolve P0 notifications', () => {
      vi.setSystemTime(new Date('2026-02-16T00:00:00Z'));
      const records = [
        makeRecord({ id: 'p0', category: 'security', priority: 'P0', createdAt: Date.now() - 24 * 60 * 60 * 1000 }),
      ];

      const result = grouper.getAutoResolveCandidates(records);
      expect(result.resolved).toHaveLength(0);
    });

    it('should not auto-resolve P1 notifications', () => {
      vi.setSystemTime(new Date('2026-02-16T00:00:00Z'));
      const records = [
        makeRecord({ id: 'p1', category: 'error', priority: 'P1', createdAt: Date.now() - 24 * 60 * 60 * 1000 }),
      ];

      const result = grouper.getAutoResolveCandidates(records);
      expect(result.resolved).toHaveLength(0);
    });

    it('should auto-resolve P2 after 4 hours', () => {
      vi.setSystemTime(new Date('2026-02-16T00:00:00Z'));
      const fiveHoursAgo = Date.now() - 5 * 60 * 60 * 1000;
      const records = [
        makeRecord({ id: 'old-p2', category: 'budget', priority: 'P2', createdAt: fiveHoursAgo }),
      ];

      const result = grouper.getAutoResolveCandidates(records);
      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].id).toBe('old-p2');
    });

    it('should not auto-resolve P2 before 4 hours', () => {
      vi.setSystemTime(new Date('2026-02-16T00:00:00Z'));
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const records = [
        makeRecord({ id: 'new-p2', category: 'budget', priority: 'P2', createdAt: twoHoursAgo }),
      ];

      const result = grouper.getAutoResolveCandidates(records);
      expect(result.resolved).toHaveLength(0);
    });

    it('should auto-resolve P4 after 2 hours', () => {
      vi.setSystemTime(new Date('2026-02-16T00:00:00Z'));
      const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
      const records = [
        makeRecord({ id: 'old-p4', category: 'value', priority: 'P4', createdAt: threeHoursAgo }),
      ];

      const result = grouper.getAutoResolveCandidates(records);
      expect(result.resolved).toHaveLength(1);
    });

    it('should auto-resolve P3 after 12 hours', () => {
      vi.setSystemTime(new Date('2026-02-16T00:00:00Z'));
      const thirteenHoursAgo = Date.now() - 13 * 60 * 60 * 1000;
      const records = [
        makeRecord({ id: 'old-p3', category: 'insight', priority: 'P3', createdAt: thirteenHoursAgo }),
      ];

      const result = grouper.getAutoResolveCandidates(records);
      expect(result.resolved).toHaveLength(1);
    });
  });

  // ── Batch digest ─────────────────────────────────────────────────────────

  describe('generateBatchDigest', () => {
    it('should group records by category', () => {
      const records = [
        makeRecord({ id: 'b1', category: 'budget', priority: 'P3', title: 'Budget alert 1' }),
        makeRecord({ id: 'b2', category: 'budget', priority: 'P3', title: 'Budget alert 2' }),
        makeRecord({ id: 't1', category: 'task', priority: 'P3', title: 'Task update' }),
      ];

      const digests = grouper.generateBatchDigest(records);
      expect(digests).toHaveLength(2);
    });

    it('should sort by priority then count', () => {
      const records = [
        makeRecord({ id: 'l1', category: 'insight', priority: 'P3', title: 'Low 1' }),
        makeRecord({ id: 'h1', category: 'budget', priority: 'P2', title: 'High 1' }),
        makeRecord({ id: 'h2', category: 'budget', priority: 'P2', title: 'High 2' }),
      ];

      const digests = grouper.generateBatchDigest(records);
      expect(digests[0].category).toBe('budget');
      expect(digests[0].priority).toBe('P2');
    });

    it('should include priority labels in digest body', () => {
      const records = [
        makeRecord({ id: 'b1', category: 'budget', priority: 'P2', title: 'Budget high' }),
        makeRecord({ id: 'b2', category: 'budget', priority: 'P3', title: 'Budget low' }),
      ];

      const digests = grouper.generateBatchDigest(records);
      expect(digests[0].body).toContain('[P2]');
      expect(digests[0].body).toContain('[P3]');
    });

    it('should use highest priority among category items', () => {
      const records = [
        makeRecord({ id: 'e1', category: 'error', priority: 'P2', title: 'Error 1' }),
        makeRecord({ id: 'e2', category: 'error', priority: 'P1', title: 'Error 2' }),
      ];

      const digests = grouper.generateBatchDigest(records);
      expect(digests[0].priority).toBe('P1');
    });
  });

  // ── Flush and cleanup ────────────────────────────────────────────────────

  describe('flush', () => {
    it('should mark group as flushed', () => {
      grouper.add(makeRecord({ id: 'f1', category: 'task', priority: 'P3', groupKey: 'flush-me' }));
      grouper.flush('flush-me');

      expect(grouper.getPendingGroups()).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should clean up old flushed groups', () => {
      vi.setSystemTime(new Date('2026-02-16T00:00:00Z'));
      grouper.add(makeRecord({ id: 'old1', category: 'task', priority: 'P3', groupKey: 'old-group' }));
      grouper.flush('old-group');

      // Advance 25 hours
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const cleaned = grouper.cleanup();
      expect(cleaned).toBe(1);
      expect(grouper.size).toBe(0);
    });

    it('should not clean up unflushed groups', () => {
      vi.setSystemTime(new Date('2026-02-16T00:00:00Z'));
      grouper.add(makeRecord({ id: 'active', category: 'task', priority: 'P3', groupKey: 'active-group' }));

      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const cleaned = grouper.cleanup();
      expect(cleaned).toBe(0);
      expect(grouper.size).toBe(1);
    });
  });

  // ── Singleton ────────────────────────────────────────────────────────────

  describe('singleton', () => {
    it('should export a singleton instance', () => {
      expect(notificationGrouper).toBeInstanceOf(NotificationGrouper);
    });
  });
});
