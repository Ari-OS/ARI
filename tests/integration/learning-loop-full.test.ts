import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../src/kernel/event-bus.js';

describe('Learning Loop Full Cycle', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('EventBus Event Flow', () => {
    it('should propagate learning events to subscribers', () => {
      const spy = vi.fn();
      eventBus.on('learning:insight_generated', spy);

      eventBus.emit('learning:insight_generated', {
        insightId: 'ins_1',
        type: 'pattern',
        description: 'Retry logic improves reliability',
        confidence: 0.85,
        source: 'decision_journal',
        generalizes: true,
        timestamp: new Date().toISOString(),
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          insightId: 'ins_1',
          confidence: 0.85,
        }),
      );
    });

    it('should propagate performance review events', () => {
      const spy = vi.fn();
      eventBus.on('learning:performance_review', spy);

      eventBus.emit('learning:performance_review', {
        period: 'daily',
        successRate: 0.8,
        biasCount: 1,
        insightCount: 3,
        recommendations: ['error handling'],
        timestamp: new Date().toISOString(),
      });

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should propagate gap analysis events', () => {
      const spy = vi.fn();
      eventBus.on('learning:gap_analysis', spy);

      eventBus.emit('learning:gap_analysis', {
        period: 'weekly',
        gapsFound: 3,
        topGaps: [
          { domain: 'security', severity: 'high' },
          { domain: 'testing', severity: 'medium' },
        ],
        sourceSuggestions: 2,
        timestamp: new Date().toISOString(),
      });

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should propagate self-assessment events', () => {
      const spy = vi.fn();
      eventBus.on('learning:self_assessment', spy);

      eventBus.emit('learning:self_assessment', {
        period: 'monthly',
        grade: 'B',
        improvement: 0.15,
        trend: 'IMPROVING',
        recommendations: ['Focus on error handling', 'Expand security testing'],
        timestamp: new Date().toISOString(),
      });

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should support multiple subscribers on same event', () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();

      eventBus.on('learning:insight_generated', spy1);
      eventBus.on('learning:insight_generated', spy2);

      eventBus.emit('learning:insight_generated', {
        insightId: 'ins_2',
        type: 'correlation',
        description: 'Test coverage correlates with bug reduction',
        confidence: 0.92,
        source: 'performance_tracker',
        generalizes: true,
        timestamp: new Date().toISOString(),
      });

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Learning Event Chain', () => {
    it('should support full event chain: insight → review → assessment', () => {
      const events: string[] = [];

      eventBus.on('learning:insight_generated', () => events.push('insight'));
      eventBus.on('learning:performance_review', () => events.push('review'));
      eventBus.on('learning:self_assessment', () => events.push('assessment'));

      // Simulate the full learning cycle
      eventBus.emit('learning:insight_generated', {
        insightId: 'ins_chain',
        type: 'pattern',
        description: 'Chain test',
        confidence: 0.8,
        source: 'test',
        generalizes: false,
        timestamp: new Date().toISOString(),
      });

      eventBus.emit('learning:performance_review', {
        period: 'daily',
        successRate: 0.67,
        biasCount: 0,
        insightCount: 1,
        recommendations: [],
        timestamp: new Date().toISOString(),
      });

      eventBus.emit('learning:self_assessment', {
        period: 'monthly',
        grade: 'C',
        improvement: -0.05,
        trend: 'DECLINING',
        recommendations: ['Review approach'],
        timestamp: new Date().toISOString(),
      });

      expect(events).toEqual(['insight', 'review', 'assessment']);
    });

    it('should unsubscribe correctly', () => {
      const spy = vi.fn();
      const unsub = eventBus.on('learning:insight_generated', spy);

      eventBus.emit('learning:insight_generated', {
        insightId: 'ins_unsub',
        type: 'test',
        description: 'Before unsub',
        confidence: 0.5,
        source: 'test',
        generalizes: false,
        timestamp: new Date().toISOString(),
      });

      expect(spy).toHaveBeenCalledTimes(1);

      unsub();

      eventBus.emit('learning:insight_generated', {
        insightId: 'ins_after',
        type: 'test',
        description: 'After unsub',
        confidence: 0.5,
        source: 'test',
        generalizes: false,
        timestamp: new Date().toISOString(),
      });

      expect(spy).toHaveBeenCalledTimes(1); // Should not increase
    });
  });
});
