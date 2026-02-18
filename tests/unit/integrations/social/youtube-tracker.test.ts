import { describe, it, expect, vi } from 'vitest';
import type { EventBus } from '../../../../src/kernel/event-bus.js';

vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('better-sqlite3', () => ({
  default: vi.fn().mockImplementation(() => ({
    pragma: vi.fn(),
    prepare: vi.fn().mockReturnValue({
      run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
      get: vi.fn().mockReturnValue(null),
      all: vi.fn().mockReturnValue([]),
    }),
    exec: vi.fn(),
    close: vi.fn(),
  })),
}));

const mockBus = { emit: vi.fn(), on: vi.fn() } as unknown as EventBus;

describe('YouTubeTracker', () => {
  it('should instantiate with object params', async () => {
    const { YouTubeTracker } = await import('../../../../src/integrations/social/youtube-tracker.js');
    const tracker = new YouTubeTracker({ eventBus: mockBus });
    expect(tracker).toBeDefined();
  });

  it('should return an AnalyticsTrend object (not array)', async () => {
    const { YouTubeTracker } = await import('../../../../src/integrations/social/youtube-tracker.js');
    const tracker = new YouTubeTracker({ eventBus: mockBus });
    const trend = tracker.getAnalyticsTrend(7);
    expect(trend).toHaveProperty('period');
    expect(trend).toHaveProperty('totalViews');
    expect(trend).toHaveProperty('subscriberGrowth');
  });

  it('should return top videos array', async () => {
    const { YouTubeTracker } = await import('../../../../src/integrations/social/youtube-tracker.js');
    const tracker = new YouTubeTracker({ eventBus: mockBus });
    const top = tracker.getTopVideos(5);
    expect(Array.isArray(top)).toBe(true);
  });
});
