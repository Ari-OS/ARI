// tests/unit/plugins/content-engine/feedback-loop.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeedbackLoop } from '../../../../src/plugins/content-engine/feedback-loop.js';
import type { ContentAnalytics } from '../../../../src/plugins/content-engine/analytics.js';

describe('FeedbackLoop', () => {
  let mockAnalytics: ContentAnalytics;
  let feedbackLoop: FeedbackLoop;

  beforeEach(() => {
    mockAnalytics = {
      getTopPerformers: vi.fn().mockResolvedValue([]),
      getAveragePerformance: vi.fn().mockReturnValue(50),
    } as unknown as ContentAnalytics;

    feedbackLoop = new FeedbackLoop(mockAnalytics);
  });

  it('should return empty array when no metrics available', async () => {
    const insights = await feedbackLoop.analyze();

    expect(insights).toEqual([]);
  });

  it('should generate topic insights for high performers', async () => {
    mockAnalytics.getTopPerformers = vi.fn().mockResolvedValue([
      { performanceScore: 80, platform: 'x_thread', draftId: 'd1', id: 'm1', publishedIds: ['t1'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 75, platform: 'x_single', draftId: 'd2', id: 'm2', publishedIds: ['t2'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 70, platform: 'linkedin', draftId: 'd3', id: 'm3', publishedIds: ['t3'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
    ]);
    mockAnalytics.getAveragePerformance = vi.fn().mockReturnValue(50);

    const insights = await feedbackLoop.analyze();

    const topicInsight = insights.find((i) => i.category === 'topic');
    expect(topicInsight).toBeDefined();
    expect(topicInsight?.insight).toContain('60%'); // (80 - 50) / 50 * 100 = 60%
    expect(topicInsight?.confidence).toBeGreaterThan(0);
  });

  it('should generate hook insights', async () => {
    mockAnalytics.getTopPerformers = vi.fn().mockResolvedValue([
      { performanceScore: 90, platform: 'x_thread', draftId: 'd1', id: 'm1', publishedIds: ['t1'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 85, platform: 'x_single', draftId: 'd2', id: 'm2', publishedIds: ['t2'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 80, platform: 'linkedin', draftId: 'd3', id: 'm3', publishedIds: ['t3'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 70, platform: 'x_thread', draftId: 'd4', id: 'm4', publishedIds: ['t4'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 65, platform: 'x_single', draftId: 'd5', id: 'm5', publishedIds: ['t5'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
    ]);
    mockAnalytics.getAveragePerformance = vi.fn().mockReturnValue(50);

    const insights = await feedbackLoop.analyze();

    const hookInsight = insights.find((i) => i.category === 'hook');
    expect(hookInsight).toBeDefined();
    expect(hookInsight?.recommendation).toContain('hook');
  });

  it('should generate format insights', async () => {
    mockAnalytics.getTopPerformers = vi.fn().mockResolvedValue([
      { performanceScore: 90, platform: 'x_thread', draftId: 'd1', id: 'm1', publishedIds: ['t1'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 85, platform: 'x_thread', draftId: 'd2', id: 'm2', publishedIds: ['t2'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 80, platform: 'x_thread', draftId: 'd3', id: 'm3', publishedIds: ['t3'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 70, platform: 'linkedin', draftId: 'd4', id: 'm4', publishedIds: ['t4'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 65, platform: 'x_single', draftId: 'd5', id: 'm5', publishedIds: ['t5'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
    ]);
    mockAnalytics.getAveragePerformance = vi.fn().mockReturnValue(50);

    const insights = await feedbackLoop.analyze();

    const formatInsight = insights.find((i) => i.category === 'format');
    expect(formatInsight).toBeDefined();
    expect(formatInsight?.insight).toContain('x_thread');
  });

  it('should get insights by category', async () => {
    mockAnalytics.getTopPerformers = vi.fn().mockResolvedValue([
      { performanceScore: 90, platform: 'x_thread', draftId: 'd1', id: 'm1', publishedIds: ['t1'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 85, platform: 'x_thread', draftId: 'd2', id: 'm2', publishedIds: ['t2'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 80, platform: 'x_thread', draftId: 'd3', id: 'm3', publishedIds: ['t3'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 70, platform: 'linkedin', draftId: 'd4', id: 'm4', publishedIds: ['t4'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 65, platform: 'x_single', draftId: 'd5', id: 'm5', publishedIds: ['t5'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
    ]);
    mockAnalytics.getAveragePerformance = vi.fn().mockReturnValue(50);

    await feedbackLoop.analyze();
    const formatInsights = feedbackLoop.getInsightsByCategory('format');

    expect(formatInsights.length).toBeGreaterThan(0);
    expect(formatInsights[0].category).toBe('format');
  });

  it('should get all insights', async () => {
    mockAnalytics.getTopPerformers = vi.fn().mockResolvedValue([
      { performanceScore: 90, platform: 'x_thread', draftId: 'd1', id: 'm1', publishedIds: ['t1'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 85, platform: 'x_thread', draftId: 'd2', id: 'm2', publishedIds: ['t2'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 80, platform: 'x_thread', draftId: 'd3', id: 'm3', publishedIds: ['t3'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 70, platform: 'linkedin', draftId: 'd4', id: 'm4', publishedIds: ['t4'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 65, platform: 'x_single', draftId: 'd5', id: 'm5', publishedIds: ['t5'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
    ]);
    mockAnalytics.getAveragePerformance = vi.fn().mockReturnValue(50);

    await feedbackLoop.analyze();
    const allInsights = feedbackLoop.getAllInsights();

    expect(allInsights.length).toBeGreaterThan(0);
  });

  it('should not generate insights for low improvement', async () => {
    mockAnalytics.getTopPerformers = vi.fn().mockResolvedValue([
      { performanceScore: 52, platform: 'x_thread', draftId: 'd1', id: 'm1', publishedIds: ['t1'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 51, platform: 'x_single', draftId: 'd2', id: 'm2', publishedIds: ['t2'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
      { performanceScore: 50, platform: 'linkedin', draftId: 'd3', id: 'm3', publishedIds: ['t3'], publishedAt: '2026-01-01', collectedAt: '2026-01-02', metrics: { impressions: 0, likes: 0, retweets: 0, replies: 0, engagementRate: 0 } },
    ]);
    mockAnalytics.getAveragePerformance = vi.fn().mockReturnValue(50);

    const insights = await feedbackLoop.analyze();

    // Should not generate significant insights for <20% improvement
    expect(insights.length).toBe(0);
  });
});
