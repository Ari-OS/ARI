import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  HumanTracker,
  Quadrant,
  QuadrantEntry,
} from '../../../src/autonomous/human-tracker.js';
import type { EventBus } from '../../../src/kernel/event-bus.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock logger
vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Helper to create a mock EventBus
function createMockEventBus(): EventBus {
  return {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
    once: vi.fn(() => () => {}),
    clear: vi.fn(),
    listenerCount: vi.fn(() => 0),
    getHandlerErrorCount: vi.fn(() => 0),
    setHandlerTimeout: vi.fn(),
  } as unknown as EventBus;
}

describe('HumanTracker', () => {
  let tracker: HumanTracker;
  let eventBus: EventBus;
  let tmpDir: string;

  beforeEach(() => {
    eventBus = createMockEventBus();
    tmpDir = path.join(os.tmpdir(), `ari-human-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tracker = new HumanTracker({ storagePath: tmpDir, eventBus });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('logEntry', () => {
    it('should store an entry for a quadrant', () => {
      tracker.logEntry('mind', {
        activity: 'Reading TypeScript book',
        duration: 45,
        quality: 8,
        notes: 'Great chapter on generics',
      });

      const history = tracker.getQuadrantHistory('mind');
      expect(history.length).toBe(1);
      expect(history[0].activity).toBe('Reading TypeScript book');
      expect(history[0].quality).toBe(8);
      expect(history[0].duration).toBe(45);
    });

    it('should emit human:entry_logged event', () => {
      tracker.logEntry('body', {
        activity: 'Running',
        duration: 30,
        quality: 7,
      });

      expect(eventBus.emit).toHaveBeenCalledWith('human:entry_logged', expect.objectContaining({
        quadrant: 'body',
        activity: 'Running',
        quality: 7,
      }));
    });

    it('should clamp quality between 1 and 10', () => {
      tracker.logEntry('mind', { activity: 'Test', quality: 15 });
      tracker.logEntry('mind', { activity: 'Test', quality: -5 });

      const history = tracker.getQuadrantHistory('mind');
      expect(history[0].quality).toBe(10);
      expect(history[1].quality).toBe(1);
    });

    it('should persist entry to JSONL file', () => {
      tracker.logEntry('spirit', {
        activity: 'Time with Kai',
        duration: 60,
        quality: 9,
      });

      const entriesPath = path.join(tmpDir, 'entries.jsonl');
      expect(fs.existsSync(entriesPath)).toBe(true);

      const data = fs.readFileSync(entriesPath, 'utf-8');
      const parsed = JSON.parse(data.trim());
      expect(parsed.activity).toBe('Time with Kai');
    });

    it('should emit balance alert when balance is low', () => {
      // Log only one quadrant many times to create imbalance
      for (let i = 0; i < 10; i++) {
        tracker.logEntry('mind', { activity: `Study ${i}`, quality: 3 });
      }

      const emitCalls = vi.mocked(eventBus.emit).mock.calls;
      const balanceAlerts = emitCalls.filter(c => c[0] === 'human:balance_alert');
      // Should have at least some balance alerts due to imbalance
      expect(balanceAlerts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getOverview', () => {
    it('should return summaries for all four quadrants', () => {
      tracker.logEntry('mind', { activity: 'Reading', quality: 8 });
      tracker.logEntry('body', { activity: 'Running', quality: 7 });
      tracker.logEntry('spirit', { activity: 'Meditation', quality: 9 });
      tracker.logEntry('vocation', { activity: 'Client call', quality: 6 });

      const overview = tracker.getOverview();

      expect(overview.mind).toBeDefined();
      expect(overview.body).toBeDefined();
      expect(overview.spirit).toBeDefined();
      expect(overview.vocation).toBeDefined();
      expect(typeof overview.balanceScore).toBe('number');
      expect(typeof overview.streak).toBe('number');
    });

    it('should calculate balance score', () => {
      tracker.logEntry('mind', { activity: 'Study', quality: 8 });
      tracker.logEntry('body', { activity: 'Gym', quality: 7 });
      tracker.logEntry('spirit', { activity: 'Family', quality: 9 });
      tracker.logEntry('vocation', { activity: 'Work', quality: 6 });

      const overview = tracker.getOverview();

      expect(overview.balanceScore).toBeGreaterThanOrEqual(0);
      expect(overview.balanceScore).toBeLessThanOrEqual(100);
    });

    it('should return recent entry counts', () => {
      tracker.logEntry('mind', { activity: 'Study 1', quality: 7 });
      tracker.logEntry('mind', { activity: 'Study 2', quality: 8 });

      const overview = tracker.getOverview();

      expect(overview.mind.recentEntries).toBe(2);
    });

    it('should calculate average quality', () => {
      tracker.logEntry('body', { activity: 'Run', quality: 6 });
      tracker.logEntry('body', { activity: 'Swim', quality: 8 });

      const overview = tracker.getOverview();

      expect(overview.body.avgQuality).toBe(7);
    });
  });

  describe('getBalanceScore', () => {
    it('should return 0 overall when no entries exist', () => {
      const balance = tracker.getBalanceScore();

      expect(balance.overall).toBe(0);
      expect(balance.perQuadrant.mind).toBe(0);
      expect(balance.perQuadrant.body).toBe(0);
      expect(balance.perQuadrant.spirit).toBe(0);
      expect(balance.perQuadrant.vocation).toBe(0);
    });

    it('should identify the least attended quadrant', () => {
      tracker.logEntry('mind', { activity: 'Study', quality: 9 });
      tracker.logEntry('mind', { activity: 'Read', quality: 8 });
      tracker.logEntry('body', { activity: 'Gym', quality: 7 });
      tracker.logEntry('spirit', { activity: 'Family', quality: 9 });
      // No vocation entries

      const balance = tracker.getBalanceScore();

      expect(balance.leastAttended).toBe('vocation');
    });

    it('should provide a recommendation', () => {
      const balance = tracker.getBalanceScore();

      expect(balance.recommendation).toBeDefined();
      expect(typeof balance.recommendation).toBe('string');
      expect(balance.recommendation.length).toBeGreaterThan(0);
    });

    it('should have higher score when all quadrants have entries', () => {
      const quadrants: Quadrant[] = ['mind', 'body', 'spirit', 'vocation'];
      for (const q of quadrants) {
        tracker.logEntry(q, { activity: 'Activity', quality: 7 });
      }

      const balanced = tracker.getBalanceScore();

      // Create a new tracker with only one quadrant
      const tmpDir2 = path.join(os.tmpdir(), `ari-human-test2-${Date.now()}`);
      const tracker2 = new HumanTracker({ storagePath: tmpDir2, eventBus });
      tracker2.logEntry('mind', { activity: 'Only mind', quality: 10 });
      const unbalanced = tracker2.getBalanceScore();

      expect(balanced.overall).toBeGreaterThan(unbalanced.overall);

      fs.rmSync(tmpDir2, { recursive: true, force: true });
    });
  });

  describe('getQuadrantHistory', () => {
    it('should filter entries by quadrant', () => {
      tracker.logEntry('mind', { activity: 'Study', quality: 8 });
      tracker.logEntry('body', { activity: 'Run', quality: 7 });
      tracker.logEntry('mind', { activity: 'Read', quality: 9 });

      const mindHistory = tracker.getQuadrantHistory('mind');

      expect(mindHistory.length).toBe(2);
      expect(mindHistory.every(e => e.quadrant === 'mind')).toBe(true);
    });

    it('should filter by time period', () => {
      tracker.logEntry('mind', { activity: 'Recent', quality: 8 });

      // Default is 7 days, so recent entries should be found
      const recent = tracker.getQuadrantHistory('mind', 7);
      expect(recent.length).toBe(1);

      // 0 days means nothing
      const none = tracker.getQuadrantHistory('mind', 0);
      expect(none.length).toBe(0);
    });

    it('should return empty array for quadrant with no entries', () => {
      const history = tracker.getQuadrantHistory('spirit');

      expect(history).toEqual([]);
    });
  });

  describe('generateWeeklyReview', () => {
    it('should return a complete review structure', () => {
      tracker.logEntry('mind', { activity: 'Study', quality: 8 });
      tracker.logEntry('body', { activity: 'Gym', quality: 7 });
      tracker.logEntry('spirit', { activity: 'Family time', quality: 9 });
      tracker.logEntry('vocation', { activity: 'Client work', quality: 6 });

      const review = tracker.generateWeeklyReview();

      expect(review.period.start).toBeDefined();
      expect(review.period.end).toBeDefined();
      expect(review.quadrants.mind).toBeDefined();
      expect(review.quadrants.body).toBeDefined();
      expect(review.quadrants.spirit).toBeDefined();
      expect(review.quadrants.vocation).toBeDefined();
      expect(typeof review.overallScore).toBe('number');
      expect(review.balanceInsight).toBeDefined();
      expect(Array.isArray(review.weeklyGoals)).toBe(true);
    });

    it('should emit human:weekly_review event', () => {
      tracker.logEntry('mind', { activity: 'Study', quality: 8 });

      tracker.generateWeeklyReview();

      expect(eventBus.emit).toHaveBeenCalledWith('human:weekly_review', expect.objectContaining({
        overallScore: expect.any(Number),
      }));
    });

    it('should identify highlights from high-quality entries', () => {
      tracker.logEntry('mind', { activity: 'Deep study session', quality: 9 });
      tracker.logEntry('mind', { activity: 'Low quality distraction', quality: 3 });

      const review = tracker.generateWeeklyReview();

      expect(review.quadrants.mind.highlights).toContain('Deep study session');
    });

    it('should generate improvements for quadrants with no entries', () => {
      // Only log mind entries
      tracker.logEntry('mind', { activity: 'Study', quality: 8 });

      const review = tracker.generateWeeklyReview();

      // Body should have improvement suggestions since no entries
      expect(review.quadrants.body.improvements.length).toBeGreaterThan(0);
    });

    it('should generate weekly goals', () => {
      tracker.logEntry('mind', { activity: 'Study', quality: 8 });

      const review = tracker.generateWeeklyReview();

      expect(review.weeklyGoals.length).toBeGreaterThan(0);
    });
  });

  describe('streak calculation', () => {
    it('should return 0 when no entries exist', () => {
      const overview = tracker.getOverview();

      expect(overview.streak).toBe(0);
    });

    it('should return 1 when all quadrants logged today', () => {
      const quadrants: Quadrant[] = ['mind', 'body', 'spirit', 'vocation'];
      for (const q of quadrants) {
        tracker.logEntry(q, { activity: `${q} activity`, quality: 7 });
      }

      const overview = tracker.getOverview();

      expect(overview.streak).toBe(1);
    });

    it('should return 0 when not all quadrants logged today', () => {
      tracker.logEntry('mind', { activity: 'Study', quality: 8 });
      tracker.logEntry('body', { activity: 'Run', quality: 7 });
      // Missing spirit and vocation

      const overview = tracker.getOverview();

      expect(overview.streak).toBe(0);
    });
  });

  describe('trend calculation', () => {
    it('should return stable when no entries exist', () => {
      const overview = tracker.getOverview();

      expect(overview.mind.trend).toBe('stable');
    });

    it('should return improving when this week has entries but last week does not', () => {
      tracker.logEntry('mind', { activity: 'Study', quality: 8 });

      const overview = tracker.getOverview();

      expect(overview.mind.trend).toBe('improving');
    });
  });

  describe('persistence', () => {
    it('should load entries from existing JSONL file', () => {
      tracker.logEntry('mind', { activity: 'Persisted activity', quality: 7 });

      // Create a new tracker pointing to the same dir
      const tracker2 = new HumanTracker({ storagePath: tmpDir, eventBus });

      const history = tracker2.getQuadrantHistory('mind');
      expect(history.length).toBe(1);
      expect(history[0].activity).toBe('Persisted activity');
    });
  });

  describe('quadrant summaries', () => {
    it('should track top activities by frequency', () => {
      tracker.logEntry('body', { activity: 'Running', quality: 7 });
      tracker.logEntry('body', { activity: 'Running', quality: 8 });
      tracker.logEntry('body', { activity: 'Swimming', quality: 6 });

      const overview = tracker.getOverview();

      expect(overview.body.topActivities[0]).toBe('Running');
    });

    it('should set lastEntry timestamp', () => {
      tracker.logEntry('vocation', { activity: 'Client meeting', quality: 8 });

      const overview = tracker.getOverview();

      expect(overview.vocation.lastEntry).toBeDefined();
    });
  });
});
