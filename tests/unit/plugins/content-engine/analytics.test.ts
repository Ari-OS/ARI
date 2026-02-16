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

  it('should load and save metrics', async () => {
    // This test just verifies that loadMetrics doesn't crash
    // In a real test environment we'd need temp files
    await expect(analytics.loadMetrics()).resolves.not.toThrow();
  });

  it('should save collected metrics', async () => {
    await analytics.collectMetrics(['tweet-789']);
    // Just verify it doesn't crash
    await expect(analytics.saveMetrics()).resolves.not.toThrow();
  });

  it('should get top performers when empty', async () => {
    const topPerformers = await analytics.getTopPerformers(2);
    expect(topPerformers.length).toBe(0);
  });

  it('should calculate average performance when empty', () => {
    const avg = analytics.getAveragePerformance();
    expect(avg).toBe(0);
  });
});
