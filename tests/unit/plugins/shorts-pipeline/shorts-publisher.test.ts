import { describe, it, expect, vi } from 'vitest';
import type { EventBus } from '../../../../src/kernel/event-bus.js';

vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
const mockBus = { emit: vi.fn(), on: vi.fn() } as unknown as EventBus;

describe('ShortsPublisher', () => {
  it('should instantiate', async () => {
    const { ShortsPublisher } = await import('../../../../src/plugins/shorts-pipeline/shorts-publisher.js');
    const publisher = new ShortsPublisher({ eventBus: mockBus });
    expect(publisher).toBeDefined();
  });

  it('should return a publish job with results array', async () => {
    const { ShortsPublisher } = await import('../../../../src/plugins/shorts-pipeline/shorts-publisher.js');
    const publisher = new ShortsPublisher({ eventBus: mockBus });
    const job = await publisher.publish({
      renderUrl: 'https://example.com/video.mp4',
      title: 'Test Short',
      description: 'Test description',
      hashtags: ['#test'],
      platforms: ['youtube-shorts'],
    });
    expect(job).toHaveProperty('jobId');
    expect(job).toHaveProperty('results');
    expect(Array.isArray(job.results)).toBe(true);
    // Each result should have platform and success
    if (job.results.length > 0) {
      expect(job.results[0]).toHaveProperty('platform');
      expect(job.results[0]).toHaveProperty('success');
    }
  });
});
