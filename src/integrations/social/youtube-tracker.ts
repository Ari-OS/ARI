/**
 * YOUTUBE TRACKER — Analytics tracking for YouTube channel and video performance
 *
 * Tracks video metrics over time, calculates engagement rates,
 * identifies top-performing content, and monitors channel growth.
 *
 * Phase 23: Social Media Intelligence
 */

import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('youtube-tracker');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface YouTubeVideoMetrics {
  videoId: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  watchTimeHours: number;
  avgViewDurationSec: number;
  clickThroughRate: number;
  impressions: number;
  trackedAt: string;
}

export interface ChannelMetrics {
  subscribers: number;
  totalViews: number;
  totalWatchTimeHours: number;
  avgViewDurationSec: number;
  updatedAt: string;
}

export interface YouTubeAnalyticsTrend {
  period: string;
  totalViews: number;
  totalWatchTimeHours: number;
  avgClickThroughRate: number;
  topVideoId: string | null;
  subscriberGrowth: number;
  engagementRate: number;
}

// ─── Tracker ────────────────────────────────────────────────────────────────

export class YouTubeTracker {
  private readonly eventBus: EventBus;
  private readonly videos: Map<string, YouTubeVideoMetrics> = new Map();
  private readonly history: YouTubeVideoMetrics[] = [];
  private channelMetrics: ChannelMetrics | null = null;
  private previousChannelMetrics: ChannelMetrics | null = null;

  constructor(params: { eventBus: EventBus }) {
    this.eventBus = params.eventBus;
  }

  /**
   * Track metrics for a video. Updates existing entry or creates new.
   */
  trackVideo(videoId: string, metrics: YouTubeVideoMetrics): void {
    const tracked: YouTubeVideoMetrics = {
      ...metrics,
      videoId,
      trackedAt: new Date().toISOString(),
    };

    this.videos.set(videoId, tracked);
    this.history.push(tracked);

    const engagementRate = this.calculateEngagementRate(metrics);

    log.info(
      { videoId, views: metrics.views, engagementRate: engagementRate.toFixed(4) },
      'Video metrics tracked',
    );

    this.eventBus.emit('audit:log', {
      action: 'youtube:video_tracked',
      agent: 'system',
      trustLevel: 'operator',
      details: { videoId, views: metrics.views, engagementRate },
    });
  }

  /**
   * Update channel-level metrics. Stores previous snapshot for growth calculation.
   */
  updateChannelMetrics(metrics: ChannelMetrics): void {
    this.previousChannelMetrics = this.channelMetrics;
    this.channelMetrics = {
      ...metrics,
      updatedAt: new Date().toISOString(),
    };

    log.info(
      { subscribers: metrics.subscribers, totalViews: metrics.totalViews },
      'Channel metrics updated',
    );

    this.eventBus.emit('audit:log', {
      action: 'youtube:channel_metrics_updated',
      agent: 'system',
      trustLevel: 'operator',
      details: { subscribers: metrics.subscribers, totalViews: metrics.totalViews },
    });
  }

  /**
   * Get analytics trends for the specified number of days.
   */
  getAnalyticsTrend(days: number = 7): YouTubeAnalyticsTrend {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    const recentVideos = this.history.filter(v => v.trackedAt >= cutoffStr);

    if (recentVideos.length === 0) {
      return {
        period: `${days}d`,
        totalViews: 0,
        totalWatchTimeHours: 0,
        avgClickThroughRate: 0,
        topVideoId: null,
        subscriberGrowth: 0,
        engagementRate: 0,
      };
    }

    const totalViews = recentVideos.reduce((sum, v) => sum + v.views, 0);
    const totalWatchTimeHours = recentVideos.reduce((sum, v) => sum + v.watchTimeHours, 0);
    const avgClickThroughRate =
      recentVideos.reduce((sum, v) => sum + v.clickThroughRate, 0) / recentVideos.length;

    const topVideo = recentVideos.reduce(
      (best, v) => (v.views > (best?.views ?? -1) ? v : best),
      recentVideos[0],
    );

    const avgEngagementRate =
      recentVideos.reduce((sum, v) => sum + this.calculateEngagementRate(v), 0) /
      recentVideos.length;

    const subscriberGrowth = this.calculateSubscriberGrowth();

    return {
      period: `${days}d`,
      totalViews,
      totalWatchTimeHours: Math.round(totalWatchTimeHours * 100) / 100,
      avgClickThroughRate: Math.round(avgClickThroughRate * 10000) / 10000,
      topVideoId: topVideo?.videoId ?? null,
      subscriberGrowth,
      engagementRate: Math.round(avgEngagementRate * 10000) / 10000,
    };
  }

  /**
   * Get top performing videos by view count.
   */
  getTopVideos(limit: number = 10): YouTubeVideoMetrics[] {
    return [...this.videos.values()]
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
  }

  /**
   * Get the most recently updated channel metrics, or null if not set.
   */
  getChannelMetrics(): ChannelMetrics | null {
    return this.channelMetrics;
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private calculateEngagementRate(metrics: YouTubeVideoMetrics): number {
    if (metrics.views === 0) return 0;
    return (metrics.likes + metrics.comments) / metrics.views;
  }

  private calculateSubscriberGrowth(): number {
    if (this.channelMetrics === null || this.previousChannelMetrics === null) return 0;
    const previous = this.previousChannelMetrics.subscribers;
    if (previous === 0) return 0;
    return ((this.channelMetrics.subscribers - previous) / previous) * 100;
  }
}
