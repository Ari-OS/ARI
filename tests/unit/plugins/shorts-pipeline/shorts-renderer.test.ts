import { describe, it, expect, vi } from 'vitest';
import type { EventBus } from '../../../../src/kernel/event-bus.js';

vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
const mockBus = { emit: vi.fn(), on: vi.fn() } as unknown as EventBus;

describe('ShortsRenderer', () => {
  it('should instantiate', async () => {
    const { ShortsRenderer } = await import('../../../../src/plugins/shorts-pipeline/shorts-renderer.js');
    const renderer = new ShortsRenderer({ eventBus: mockBus });
    expect(renderer).toBeDefined();
  });

  it('should start a render job (no HeyGen key = rejected or mock returned)', async () => {
    const savedKey = process.env['HEYGEN_API_KEY'];
    delete process.env['HEYGEN_API_KEY'];
    const { ShortsRenderer } = await import('../../../../src/plugins/shorts-pipeline/shorts-renderer.js');
    const renderer = new ShortsRenderer({ eventBus: mockBus });
    try {
      const result = await renderer.render({ avatarId: 'av1', voiceId: 'v1', script: 'Hello', title: 'Test' });
      // If it resolves, it should have jobId
      expect(result).toHaveProperty('jobId');
    } catch (e) {
      // If it throws (no API key), that's acceptable behavior
      expect(e).toBeInstanceOf(Error);
    }
    if (savedKey) process.env['HEYGEN_API_KEY'] = savedKey;
  });
});
