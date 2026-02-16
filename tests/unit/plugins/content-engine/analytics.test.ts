// tests/unit/plugins/content-engine/analytics.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentAnalytics } from '../../../../src/plugins/content-engine/analytics.js';
import type { XClient } from '../../../../src/integrations/twitter/client.js';

describe('ContentAnalytics', () => {
  let mockXClient: XClient;
  let analytics: ContentAnalytics;

  beforeEach(() => {
    mockXClient = {} as XClient;
    analytics = new ContentAnalytics(mockXClient);
  });

  it('should return empty array when XClient is null', async () => {
    const analyticsNoClient = new ContentAnalytics(null);
    const result = await analyticsNoClient.collectMetrics(['tweet-123']);

    expect(result).toEqual([]);
  });

  it('should create metric stubs for published tweets', async () => {
    const result = await analytics.collectMetrics(['tweet-123', 'tweet-456']);

    expect(result.length).toBe(2);
    expect(result[0].id).toBe('metric-tweet-123');
    expect(result[1].id).toBe('metric-tweet-456');
    expect(result[0].metrics.impressions).toBe(0);
    expect(result[0].metrics.engagementRate).toBe(0);
  });

  it('should load metrics from disk', async () => {
    const mockFs = await import('node:fs/promises');
    vi.spyOn(mockFs, 'readFile').mockResolvedValue(JSON.stringify([
      {
        id: 'metric-tweet-001',
        draftId: 'draft-001',
        platform: 'x_single',
        publishedIds: ['tweet-001'],
        publishedAt: '2026-02-16T10:00:00Z',
        collectedAt: '2026-02-17T10:00:00Z',
        metrics: {
          impressions: 1000,
          likes: 50,
          retweets: 10,
          replies: 5,
          engagementRate: 0.065,
        },
        performanceScore: 6.5,
      },
    ]));

    await analytics.loadMetrics();
    const topPerformers = await analytics.getTopPerformers(5);

    expect(topPerformers.length).toBeGreaterThan(0);
    expect(topPerformers[0].id).toBe('metric-tweet-001');
  });

  it('should save metrics to disk', async () => {
    const mockFs = await import('node:fs/promises');
    const mkdirSpy = vi.spyOn(mockFs, 'mkdir').mockResolvedValue(undefined);
    const writeFileSpy = vi.spyOn(mockFs, 'writeFile').mockResolvedValue(undefined);

    await analytics.collectMetrics(['tweet-789']);
    await analytics.saveMetrics();

    expect(mkdirSpy).toHaveBeenCalled();
    expect(writeFileSpy).toHaveBeenCalled();
  });

  it('should get top performers sorted by score', async () => {
    const mockFs = await import('node:fs/promises');
    vi.spyOn(mockFs, 'readFile').mockResolvedValue(JSON.stringify([
      { id: 'metric-1', performanceScore: 80, draftId: 'd1', platform: 'x_single', publishedIds: ['t1'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { id: 'metric-2', performanceScore: 95, draftId: 'd2', platform: 'x_single', publishedIds: ['t2'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { id: 'metric-3', performanceScore: 60, draftId: 'd3', platform: 'x_single', publishedIds: ['t3'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
    ]));

    await analytics.loadMetrics();
    const topPerformers = await analytics.getTopPerformers(2);

    expect(topPerformers.length).toBe(2);
    expect(topPerformers[0].id).toBe('metric-2');
    expect(topPerformers[1].id).toBe('metric-1');
  });

  it('should calculate average performance', async () => {
    const mockFs = await import('node:fs/promises');
    vi.spyOn(mockFs, 'readFile').mockResolvedValue(JSON.stringify([
      { id: 'metric-1', performanceScore: 80, draftId: 'd1', platform: 'x_single', publishedIds: ['t1'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { id: 'metric-2', performanceScore: 60, draftId: 'd2', platform: 'x_single', publishedIds: ['t2'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
    ]));

    await analytics.loadMetrics();
    const avg = analytics.getAveragePerformance();

    expect(avg).toBe(70); // (80 + 60) / 2
  });

  it('should handle missing file gracefully', async () => {
    const mockFs = await import('node:fs/promises');
    const error = new Error('File not found') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.spyOn(mockFs, 'readFile').mockRejectedValue(error);

    await expect(analytics.loadMetrics()).resolves.not.toThrow();
  });
});
