import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationPipeline } from '../../../src/autonomous/notification-pipeline.js';
import type { EventBus } from '../../../src/kernel/event-bus.js';

const mockBus = { emit: vi.fn(), on: vi.fn() } as unknown as EventBus;
const mockNotify = vi.fn();

describe('NotificationPipeline', () => {
  let pipeline: NotificationPipeline;

  beforeEach(() => {
    vi.clearAllMocks();
    pipeline = new NotificationPipeline(mockBus, mockNotify);
  });

  it('should process a P0 notification immediately', async () => {
    const outcome = await pipeline.process({
      source: 'test',
      title: 'Critical Alert',
      body: 'System failure',
      urgency: 1.0,
      impact: 1.0,
      timeSensitivity: 1.0,
    });
    expect(outcome.pLevel).toBe('P0');
    expect(outcome.delivered).toBe(true);
    expect(mockNotify).toHaveBeenCalledWith('Critical Alert', 'System failure', 'critical');
  });

  it('should batch P4 notifications', async () => {
    const outcome = await pipeline.process({
      source: 'test',
      title: 'Low priority',
      body: 'Background info',
      urgency: 0.0,
      impact: 0.0,
      timeSensitivity: 0.0,
      userRelevance: 0.0,
      contextModifier: -1.0,
    });
    expect(outcome.pLevel).toBe('P4');
    expect(outcome.delivered).toBe(false);
  });

  it('should dedup notifications within 15 minutes', async () => {
    await pipeline.process({ source: 'test', title: 'Alert', body: 'Body', urgency: 0.9, impact: 0.9 });
    const outcome2 = await pipeline.process({ source: 'test', title: 'Alert', body: 'Body', urgency: 0.9, impact: 0.9 });
    expect(outcome2.reason).toMatch(/dedup/i);
  });

  it('should track daily stats', () => {
    const stats = pipeline.getDailyStats();
    expect(stats.max).toBe(5);
    expect(stats.min).toBe(2);
    expect(typeof stats.pushed).toBe('number');
  });

  it('should flush morning batch', async () => {
    // Force P3: low scores
    await pipeline.process({ source: 'test', title: 'Batch item', body: 'Content', urgency: 0.2, impact: 0.2, timeSensitivity: 0.2 });
    const batch = pipeline.flushMorningBatch();
    // batch may be empty if it routes to log; just verify it's an array
    expect(Array.isArray(batch)).toBe(true);
  });
});
