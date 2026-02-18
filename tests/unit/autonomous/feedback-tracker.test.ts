import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import fs from 'node:fs/promises';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { FeedbackTracker } from '../../../src/autonomous/feedback-tracker.js';
import type { FeedbackAnalysis, ExplicitFeedback, ImplicitSignal } from '../../../src/autonomous/feedback-tracker.js';

describe('FeedbackTracker', () => {
  let tracker: FeedbackTracker;
  let eventBus: EventBus;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `ari-feedback-test-${randomUUID()}`);
    eventBus = new EventBus();
    tracker = new FeedbackTracker({
      eventBus,
      storagePath: tmpDir,
    });
  });

  afterEach(async () => {
    try { await fs.rm(tmpDir, { recursive: true }); } catch { /* noop */ }
  });

  // ─── recordFeedback ───────────────────────────────────────────────────

  describe('recordFeedback', () => {
    it('should append explicit feedback to JSONL file', async () => {
      await tracker.recordFeedback({
        messageId: 'msg-1',
        userId: 'user-1',
        positive: true,
        context: 'Morning briefing was helpful',
        category: 'briefing',
      });

      const content = await fs.readFile(join(tmpDir, 'explicit.jsonl'), 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(1);

      const entry = JSON.parse(lines[0]) as ExplicitFeedback;
      expect(entry.messageId).toBe('msg-1');
      expect(entry.userId).toBe('user-1');
      expect(entry.positive).toBe(true);
      expect(entry.context).toBe('Morning briefing was helpful');
      expect(entry.category).toBe('briefing');
      expect(entry.createdAt).toBeTruthy();
    });

    it('should append multiple feedback entries', async () => {
      await tracker.recordFeedback({
        messageId: 'msg-1',
        userId: 'user-1',
        positive: true,
        context: 'Good briefing',
        category: 'briefing',
      });

      await tracker.recordFeedback({
        messageId: 'msg-2',
        userId: 'user-1',
        positive: false,
        context: 'Bad market alert',
        category: 'market',
      });

      const content = await fs.readFile(join(tmpDir, 'explicit.jsonl'), 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(2);

      const first = JSON.parse(lines[0]) as ExplicitFeedback;
      const second = JSON.parse(lines[1]) as ExplicitFeedback;
      expect(first.positive).toBe(true);
      expect(second.positive).toBe(false);
    });

    it('should emit feedback:recorded event', async () => {
      const emitted: unknown[] = [];
      eventBus.on('feedback:recorded', (payload) => {
        emitted.push(payload);
      });

      await tracker.recordFeedback({
        messageId: 'msg-1',
        userId: 'user-1',
        positive: true,
        context: 'Nice',
        category: 'chat',
      });

      expect(emitted).toHaveLength(1);
      const payload = emitted[0] as Record<string, unknown>;
      expect(payload.messageId).toBe('msg-1');
      expect(payload.userId).toBe('user-1');
      expect(payload.positive).toBe(true);
      expect(payload.category).toBe('chat');
      expect(payload.timestamp).toBeTruthy();
    });

    it('should create storage directory if it does not exist', async () => {
      const nestedDir = join(tmpDir, 'nested', 'deep');
      const nestedTracker = new FeedbackTracker({
        eventBus,
        storagePath: nestedDir,
      });

      await nestedTracker.recordFeedback({
        messageId: 'msg-1',
        userId: 'user-1',
        positive: true,
        context: 'test',
        category: 'chat',
      });

      const stat = await fs.stat(nestedDir);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  // ─── recordImplicitSignal ─────────────────────────────────────────────

  describe('recordImplicitSignal', () => {
    it('should append implicit signal to JSONL file', async () => {
      await tracker.recordImplicitSignal({
        feature: 'morning_briefing',
        signal: 'viewed',
      });

      const content = await fs.readFile(join(tmpDir, 'implicit.jsonl'), 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(1);

      const entry = JSON.parse(lines[0]) as ImplicitSignal;
      expect(entry.feature).toBe('morning_briefing');
      expect(entry.signal).toBe('viewed');
      expect(entry.createdAt).toBeTruthy();
    });

    it('should store metadata when provided', async () => {
      await tracker.recordImplicitSignal({
        feature: 'market_alert',
        signal: 'dismissed',
        metadata: { ticker: 'BTC', section: 'crypto' },
      });

      const content = await fs.readFile(join(tmpDir, 'implicit.jsonl'), 'utf-8');
      const entry = JSON.parse(content.trim()) as ImplicitSignal;
      expect(entry.metadata).toEqual({ ticker: 'BTC', section: 'crypto' });
    });

    it('should append multiple implicit signals', async () => {
      await tracker.recordImplicitSignal({
        feature: 'morning_briefing',
        signal: 'viewed',
      });
      await tracker.recordImplicitSignal({
        feature: 'evening_summary',
        signal: 'ignored',
      });
      await tracker.recordImplicitSignal({
        feature: 'morning_briefing',
        signal: 'viewed',
      });

      const content = await fs.readFile(join(tmpDir, 'implicit.jsonl'), 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(3);
    });
  });

  // ─── getCategoryScore ─────────────────────────────────────────────────

  describe('getCategoryScore', () => {
    it('should return correct scores for a category', async () => {
      await tracker.recordFeedback({
        messageId: 'msg-1', userId: 'u1', positive: true, context: 'good', category: 'briefing',
      });
      await tracker.recordFeedback({
        messageId: 'msg-2', userId: 'u1', positive: true, context: 'great', category: 'briefing',
      });
      await tracker.recordFeedback({
        messageId: 'msg-3', userId: 'u1', positive: false, context: 'meh', category: 'briefing',
      });

      const score = await tracker.getCategoryScore('briefing');
      expect(score.positive).toBe(2);
      expect(score.negative).toBe(1);
      expect(score.score).toBeCloseTo(2 / 3);
    });

    it('should return zero scores for empty state', async () => {
      const score = await tracker.getCategoryScore('nonexistent');
      expect(score.positive).toBe(0);
      expect(score.negative).toBe(0);
      expect(score.score).toBe(0);
    });

    it('should only count feedback for the requested category', async () => {
      await tracker.recordFeedback({
        messageId: 'msg-1', userId: 'u1', positive: true, context: 'ok', category: 'briefing',
      });
      await tracker.recordFeedback({
        messageId: 'msg-2', userId: 'u1', positive: false, context: 'bad', category: 'market',
      });

      const briefingScore = await tracker.getCategoryScore('briefing');
      expect(briefingScore.positive).toBe(1);
      expect(briefingScore.negative).toBe(0);
      expect(briefingScore.score).toBe(1);

      const marketScore = await tracker.getCategoryScore('market');
      expect(marketScore.positive).toBe(0);
      expect(marketScore.negative).toBe(1);
      expect(marketScore.score).toBe(0);
    });
  });

  // ─── getWeeklyAnalysis ────────────────────────────────────────────────

  describe('getWeeklyAnalysis', () => {
    it('should compute correct positive rate', async () => {
      await tracker.recordFeedback({
        messageId: 'msg-1', userId: 'u1', positive: true, context: 'a', category: 'chat',
      });
      await tracker.recordFeedback({
        messageId: 'msg-2', userId: 'u1', positive: true, context: 'b', category: 'chat',
      });
      await tracker.recordFeedback({
        messageId: 'msg-3', userId: 'u1', positive: false, context: 'c', category: 'chat',
      });
      await tracker.recordFeedback({
        messageId: 'msg-4', userId: 'u1', positive: true, context: 'd', category: 'briefing',
      });

      const analysis = await tracker.getWeeklyAnalysis();
      expect(analysis.totalFeedback).toBe(4);
      expect(analysis.positiveRate).toBe(0.75);
    });

    it('should identify top performers and underperformers', async () => {
      // Briefing: 4 positive, 0 negative = 100% score
      for (let i = 0; i < 4; i++) {
        await tracker.recordFeedback({
          messageId: `msg-b-${i}`, userId: 'u1', positive: true, context: 'good', category: 'briefing',
        });
      }

      // Market: 1 positive, 4 negative = 20% score
      await tracker.recordFeedback({
        messageId: 'msg-m-0', userId: 'u1', positive: true, context: 'ok', category: 'market',
      });
      for (let i = 1; i < 5; i++) {
        await tracker.recordFeedback({
          messageId: `msg-m-${i}`, userId: 'u1', positive: false, context: 'bad', category: 'market',
        });
      }

      const analysis = await tracker.getWeeklyAnalysis();
      expect(analysis.topPerformers.length).toBeGreaterThanOrEqual(1);
      expect(analysis.topPerformers.some(p => p.category === 'briefing')).toBe(true);

      expect(analysis.underperformers.length).toBeGreaterThanOrEqual(1);
      expect(analysis.underperformers.some(p => p.category === 'market')).toBe(true);
    });

    it('should analyze implicit signals for engagement', async () => {
      // morning_briefing: mostly viewed (engaged)
      for (let i = 0; i < 5; i++) {
        await tracker.recordImplicitSignal({ feature: 'morning_briefing', signal: 'viewed' });
      }

      // evening_summary: mostly ignored (not engaged)
      for (let i = 0; i < 5; i++) {
        await tracker.recordImplicitSignal({ feature: 'evening_summary', signal: 'ignored' });
      }

      const analysis = await tracker.getWeeklyAnalysis();
      expect(analysis.implicitSignals.mostEngaged).toContain('morning_briefing');
      expect(analysis.implicitSignals.leastEngaged).toContain('evening_summary');
    });

    it('should generate suggestions for underperformers', async () => {
      // Create a low-scoring category
      await tracker.recordFeedback({
        messageId: 'msg-1', userId: 'u1', positive: false, context: 'bad', category: 'search',
      });
      await tracker.recordFeedback({
        messageId: 'msg-2', userId: 'u1', positive: false, context: 'worse', category: 'search',
      });

      const analysis = await tracker.getWeeklyAnalysis();
      expect(analysis.suggestions.length).toBeGreaterThanOrEqual(1);
      expect(analysis.suggestions.some(s => s.includes('search'))).toBe(true);
    });

    it('should emit feedback:analysis_generated event', async () => {
      const emitted: unknown[] = [];
      eventBus.on('feedback:analysis_generated', (payload) => {
        emitted.push(payload);
      });

      await tracker.recordFeedback({
        messageId: 'msg-1', userId: 'u1', positive: true, context: 'ok', category: 'chat',
      });

      await tracker.getWeeklyAnalysis();

      expect(emitted).toHaveLength(1);
      const payload = emitted[0] as Record<string, unknown>;
      expect(payload.totalFeedback).toBe(1);
      expect(payload.positiveRate).toBe(1);
      expect(payload.timestamp).toBeTruthy();
      expect(payload.period).toBeTruthy();
    });

    it('should return empty analysis when no data exists', async () => {
      const analysis = await tracker.getWeeklyAnalysis();
      expect(analysis.totalFeedback).toBe(0);
      expect(analysis.positiveRate).toBe(0);
      expect(analysis.topPerformers).toHaveLength(0);
      expect(analysis.underperformers).toHaveLength(0);
      expect(analysis.implicitSignals.mostEngaged).toHaveLength(0);
      expect(analysis.implicitSignals.leastEngaged).toHaveLength(0);
      expect(analysis.suggestions).toHaveLength(1); // default suggestion
      expect(analysis.suggestions[0]).toContain('performing well');
    });

    it('should only include feedback from the last 7 days', async () => {
      // Write a feedback entry with old timestamp directly
      const oldEntry: ExplicitFeedback = {
        messageId: 'old-1',
        userId: 'u1',
        positive: false,
        context: 'ancient feedback',
        category: 'chat',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      };
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.appendFile(join(tmpDir, 'explicit.jsonl'), JSON.stringify(oldEntry) + '\n', 'utf-8');

      // Record a recent positive feedback
      await tracker.recordFeedback({
        messageId: 'new-1', userId: 'u1', positive: true, context: 'recent', category: 'chat',
      });

      const analysis = await tracker.getWeeklyAnalysis();
      // Only the recent feedback should be counted
      expect(analysis.totalFeedback).toBe(1);
      expect(analysis.positiveRate).toBe(1);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle perfect score (all positive)', async () => {
      for (let i = 0; i < 5; i++) {
        await tracker.recordFeedback({
          messageId: `msg-${i}`, userId: 'u1', positive: true, context: 'great', category: 'chat',
        });
      }

      const score = await tracker.getCategoryScore('chat');
      expect(score.score).toBe(1);
      expect(score.positive).toBe(5);
      expect(score.negative).toBe(0);
    });

    it('should handle all negative feedback', async () => {
      for (let i = 0; i < 3; i++) {
        await tracker.recordFeedback({
          messageId: `msg-${i}`, userId: 'u1', positive: false, context: 'bad', category: 'search',
        });
      }

      const score = await tracker.getCategoryScore('search');
      expect(score.score).toBe(0);
      expect(score.positive).toBe(0);
      expect(score.negative).toBe(3);
    });
  });
});
