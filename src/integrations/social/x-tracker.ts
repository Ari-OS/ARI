/**
 * X TRACKER — Social media engagement tracking for X (formerly Twitter)
 *
 * Tracks post metrics over time, calculates engagement rates,
 * and identifies top-performing content patterns.
 *
 * Phase 23: Social Media Intelligence
 */

import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('x-tracker');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PostMetrics {
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  bookmarks: number;
}

export interface TrackedPost {
  postId: string;
  content?: string;
  metrics: PostMetrics;
  engagementRate: number;
  trackedAt: string;
}

export interface EngagementTrend {
  period: string;
  avgEngagementRate: number;
  totalImpressions: number;
  bestPerformingType: string;
  growthRate: number;
}

// ─── Tracker ────────────────────────────────────────────────────────────────

export class XTracker {
  private readonly eventBus: EventBus;
  private readonly posts: Map<string, TrackedPost> = new Map();
  private readonly history: TrackedPost[] = [];

  constructor(params: { eventBus: EventBus }) {
    this.eventBus = params.eventBus;
  }

  /**
   * Track metrics for a post. Updates existing entry or creates new.
   */
  trackPost(postId: string, metrics: PostMetrics): void {
    const engagementRate = this.calculateEngagementRate(metrics);

    const tracked: TrackedPost = {
      postId,
      content: this.posts.get(postId)?.content,
      metrics,
      engagementRate,
      trackedAt: new Date().toISOString(),
    };

    this.posts.set(postId, tracked);
    this.history.push(tracked);

    log.info({ postId, engagementRate: engagementRate.toFixed(4) }, 'Post metrics tracked');
  }

  /**
   * Track a post with its content for later analysis.
   */
  trackPostWithContent(postId: string, content: string, metrics: PostMetrics): void {
    const engagementRate = this.calculateEngagementRate(metrics);

    const tracked: TrackedPost = {
      postId,
      content,
      metrics,
      engagementRate,
      trackedAt: new Date().toISOString(),
    };

    this.posts.set(postId, tracked);
    this.history.push(tracked);

    log.info({ postId, engagementRate: engagementRate.toFixed(4), contentLen: content.length }, 'Post tracked with content');
  }

  /**
   * Get engagement trends for the specified number of days.
   */
  getEngagementTrend(days: number = 7): EngagementTrend {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    const recentPosts = this.history.filter(p => p.trackedAt >= cutoffStr);

    if (recentPosts.length === 0) {
      return {
        period: `${days}d`,
        avgEngagementRate: 0,
        totalImpressions: 0,
        bestPerformingType: 'unknown',
        growthRate: 0,
      };
    }

    const totalEngagement = recentPosts.reduce((sum, p) => sum + p.engagementRate, 0);
    const avgEngagementRate = totalEngagement / recentPosts.length;
    const totalImpressions = recentPosts.reduce((sum, p) => sum + p.metrics.impressions, 0);

    // Determine best performing type by engagement driver
    const bestPerformingType = this.identifyBestType(recentPosts);

    // Growth rate: compare first half vs second half
    const growthRate = this.calculateGrowthRate(recentPosts);

    return {
      period: `${days}d`,
      avgEngagementRate: Math.round(avgEngagementRate * 10000) / 10000,
      totalImpressions,
      bestPerformingType,
      growthRate: Math.round(growthRate * 100) / 100,
    };
  }

  /**
   * Get top performing posts by engagement rate.
   */
  getTopPosts(limit: number = 10): TrackedPost[] {
    return [...this.posts.values()]
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, limit);
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private calculateEngagementRate(metrics: PostMetrics): number {
    if (metrics.impressions === 0) return 0;

    const totalEngagement = metrics.likes + metrics.retweets + metrics.replies + metrics.bookmarks;
    return totalEngagement / metrics.impressions;
  }

  private identifyBestType(posts: TrackedPost[]): string {
    // Analyze which engagement metric drives the most for top posts
    const topPosts = posts
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, Math.max(1, Math.floor(posts.length * 0.3)));

    const avgMetrics = {
      likes: 0,
      retweets: 0,
      replies: 0,
      bookmarks: 0,
    };

    for (const post of topPosts) {
      const total = post.metrics.likes + post.metrics.retweets + post.metrics.replies + post.metrics.bookmarks || 1;
      avgMetrics.likes += post.metrics.likes / total;
      avgMetrics.retweets += post.metrics.retweets / total;
      avgMetrics.replies += post.metrics.replies / total;
      avgMetrics.bookmarks += post.metrics.bookmarks / total;
    }

    const entries = Object.entries(avgMetrics);
    const best = entries.reduce((a, b) => b[1] > a[1] ? b : a);

    const typeMap: Record<string, string> = {
      likes: 'engagement-driven',
      retweets: 'share-worthy',
      replies: 'conversation-starter',
      bookmarks: 'reference-content',
    };

    return typeMap[best[0]] ?? 'mixed';
  }

  private calculateGrowthRate(posts: TrackedPost[]): number {
    if (posts.length < 2) return 0;

    const sorted = [...posts].sort((a, b) => a.trackedAt.localeCompare(b.trackedAt));
    const midpoint = Math.floor(sorted.length / 2);

    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    const avgFirst = firstHalf.reduce((s, p) => s + p.engagementRate, 0) / (firstHalf.length || 1);
    const avgSecond = secondHalf.reduce((s, p) => s + p.engagementRate, 0) / (secondHalf.length || 1);

    if (avgFirst === 0) return 0;
    return ((avgSecond - avgFirst) / avgFirst) * 100;
  }
}
