import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import fs from 'node:fs/promises';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { PerformanceTracker } from '../../../src/ai/performance-tracker.js';

describe('PerformanceTracker', () => {
  let tracker: PerformanceTracker;
  let eventBus: EventBus;
  let tmpPath: string;

  beforeEach(() => {
    tmpPath = join(tmpdir(), `ari-perf-${randomUUID()}.json`);
    eventBus = new EventBus();
    tracker = new PerformanceTracker(eventBus, { persistPath: tmpPath });
  });

  afterEach(async () => {
    try { await fs.unlink(tmpPath); } catch { /* noop */ }
    try { await fs.unlink(`${tmpPath}.tmp`); } catch { /* noop */ }
  });

  describe('Event Handling', () => {
    it('should track metrics from llm:request_complete events', () => {
      eventBus.emit('llm:request_complete', {
        timestamp: new Date().toISOString(),
        model: 'claude-sonnet-4',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.008,
        taskType: 'chat',
        taskCategory: 'general',
        duration: 2500,
        success: true,
      });

      const stats = tracker.getPerformanceStats('claude-sonnet-4');
      expect(stats.totalCalls).toBe(1);
      expect(stats.totalCost).toBeCloseTo(0.008);
    });

    it('should track errors correctly', () => {
      eventBus.emit('llm:request_complete', {
        timestamp: new Date().toISOString(),
        model: 'claude-sonnet-4',
        inputTokens: 1000,
        outputTokens: 0,
        cost: 0,
        taskType: 'chat',
        duration: 5000,
        success: false,
      });

      const stats = tracker.getPerformanceStats('claude-sonnet-4');
      expect(stats.totalCalls).toBe(1);
      expect(stats.overallErrorRate).toBe(1);
    });

    it('should ignore unknown model IDs', () => {
      eventBus.emit('llm:request_complete', {
        timestamp: new Date().toISOString(),
        model: 'unknown-model-xyz',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.001,
        taskType: 'chat',
        duration: 1000,
        success: true,
      });

      const stats = tracker.getPerformanceStats();
      expect(stats.totalCalls).toBe(0);
    });
  });

  describe('Recommendations', () => {
    it('should default to claude-sonnet-4 with no data', () => {
      const rec = tracker.getRecommendation('general');
      expect(rec).toBe('claude-sonnet-4');
    });

    it('should recommend best-performing model with sufficient data', () => {
      // Emit 10 successful calls for opus with high quality
      for (let i = 0; i < 10; i++) {
        eventBus.emit('llm:request_complete', {
          timestamp: new Date().toISOString(),
          model: 'claude-opus-4.5',
          inputTokens: 2000,
          outputTokens: 1000,
          cost: 0.02,
          taskType: 'analysis',
          taskCategory: 'analysis',
          duration: 3000,
          success: true,
        });
      }

      // Emit 10 calls for sonnet with lower quality
      for (let i = 0; i < 10; i++) {
        eventBus.emit('llm:request_complete', {
          timestamp: new Date().toISOString(),
          model: 'claude-sonnet-4',
          inputTokens: 2000,
          outputTokens: 1000,
          cost: 0.01,
          taskType: 'analysis',
          taskCategory: 'analysis',
          duration: 2000,
          success: i < 7, // 30% error rate
        });
      }

      const rec = tracker.getRecommendation('analysis');
      // Opus should win: 100% reliability + quality vs sonnet's 70% reliability
      expect(rec).toBe('claude-opus-4.5');
    });

    it('should return most-used model with insufficient data', () => {
      // Only 3 calls (below threshold of 5)
      for (let i = 0; i < 3; i++) {
        eventBus.emit('llm:request_complete', {
          timestamp: new Date().toISOString(),
          model: 'claude-haiku-4.5',
          inputTokens: 500,
          outputTokens: 200,
          cost: 0.001,
          taskType: 'chat',
          taskCategory: 'quick_answer',
          duration: 500,
          success: true,
        });
      }

      const rec = tracker.getRecommendation('quick_answer');
      expect(rec).toBe('claude-haiku-4.5');
    });
  });

  describe('Performance Stats', () => {
    it('should return empty stats for unknown model', () => {
      const stats = tracker.getPerformanceStats('claude-opus-4.5');
      expect(stats.totalCalls).toBe(0);
      expect(stats.categories).toHaveLength(0);
    });

    it('should aggregate across categories for a model', () => {
      const categories = ['chat', 'analysis', 'code'];
      for (const cat of categories) {
        eventBus.emit('llm:request_complete', {
          timestamp: new Date().toISOString(),
          model: 'claude-sonnet-4',
          inputTokens: 1000,
          outputTokens: 500,
          cost: 0.01,
          taskType: cat,
          taskCategory: cat,
          duration: 2000,
          success: true,
        });
      }

      const stats = tracker.getPerformanceStats('claude-sonnet-4');
      expect(stats.totalCalls).toBe(3);
      expect(stats.categories).toHaveLength(3);
      expect(stats.overallAvgQuality).toBeCloseTo(0.8);
    });
  });

  describe('Top Performers', () => {
    it('should rank models by weighted score', () => {
      // Fast, cheap, reliable haiku
      for (let i = 0; i < 6; i++) {
        eventBus.emit('llm:request_complete', {
          timestamp: new Date().toISOString(),
          model: 'claude-haiku-4.5',
          inputTokens: 500,
          outputTokens: 200,
          cost: 0.001,
          taskType: 'chat',
          duration: 300,
          success: true,
        });
      }

      // Slower but higher quality opus
      for (let i = 0; i < 6; i++) {
        eventBus.emit('llm:request_complete', {
          timestamp: new Date().toISOString(),
          model: 'claude-opus-4.5',
          inputTokens: 2000,
          outputTokens: 1000,
          cost: 0.05,
          taskType: 'chat',
          duration: 5000,
          success: true,
        });
      }

      const top = tracker.getTopPerformers(3);
      expect(top).toHaveLength(2);
      // Both should have scores > 0
      expect(top[0].score).toBeGreaterThan(0);
      expect(top[1].score).toBeGreaterThan(0);
    });
  });

  describe('Persistence', () => {
    it('should persist data to disk', async () => {
      eventBus.emit('llm:request_complete', {
        timestamp: new Date().toISOString(),
        model: 'claude-sonnet-4',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.01,
        taskType: 'chat',
        duration: 2000,
        success: true,
      });

      // Wait for async persist
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create new tracker from same path
      const tracker2 = new PerformanceTracker(new EventBus(), { persistPath: tmpPath });
      const stats = tracker2.getPerformanceStats('claude-sonnet-4');
      expect(stats.totalCalls).toBe(1);
    });

    it('should handle missing data file gracefully', () => {
      const missingPath = join(tmpdir(), `nonexistent-${randomUUID()}.json`);
      const tracker2 = new PerformanceTracker(new EventBus(), { persistPath: missingPath });
      const stats = tracker2.getPerformanceStats();
      expect(stats.totalCalls).toBe(0);
    });
  });

  describe('Clear', () => {
    it('should clear all data', async () => {
      eventBus.emit('llm:request_complete', {
        timestamp: new Date().toISOString(),
        model: 'claude-sonnet-4',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.01,
        taskType: 'chat',
        duration: 2000,
        success: true,
      });

      await tracker.clear();

      const stats = tracker.getPerformanceStats();
      expect(stats.totalCalls).toBe(0);
    });
  });
});
