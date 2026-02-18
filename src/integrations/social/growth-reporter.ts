/**
 * GROWTH REPORTER — Unified cross-platform growth reporting
 *
 * Aggregates metrics from X (Twitter), YouTube, and other platforms
 * into a single weekly growth report with recommendations.
 *
 * Phase 23: Social Media Intelligence
 */

import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';
import type { EngagementTrend } from './x-tracker.js';

const log = createLogger('growth-reporter');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface YouTubeMetrics {
  subscribers: number;
  views: number;
  watchTimeHours: number;
}

export interface GrowthReport {
  period: { start: string; end: string };
  platforms: Array<{
    name: string;
    followers: number;
    engagement: number;
    topContent: string;
    growth: number;
  }>;
  overallGrowth: number;
  recommendations: string[];
  summary: string;
}

// ─── Reporter ───────────────────────────────────────────────────────────────

export class GrowthReporter {
  private readonly eventBus: EventBus;

  constructor(params: { eventBus: EventBus }) {
    this.eventBus = params.eventBus;
  }

  /**
   * Generate a unified weekly growth report from all available platform metrics.
   */
  generateReport(params: {
    xMetrics?: EngagementTrend;
    youtubeMetrics?: YouTubeMetrics;
  }): GrowthReport {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const period = {
      start: weekAgo.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };

    const platforms: GrowthReport['platforms'] = [];

    // X platform
    if (params.xMetrics) {
      platforms.push({
        name: 'X (Twitter)',
        followers: 0, // follower count not tracked in EngagementTrend
        engagement: params.xMetrics.avgEngagementRate,
        topContent: params.xMetrics.bestPerformingType,
        growth: params.xMetrics.growthRate,
      });
    }

    // YouTube platform
    if (params.youtubeMetrics) {
      const yt = params.youtubeMetrics;
      const engagement = yt.subscribers > 0
        ? (yt.views / yt.subscribers)
        : 0;

      platforms.push({
        name: 'YouTube',
        followers: yt.subscribers,
        engagement: Math.round(engagement * 100) / 100,
        topContent: `${yt.watchTimeHours.toFixed(1)}h watch time`,
        growth: 0, // would need historical data to compute
      });
    }

    const overallGrowth = this.calculateOverallGrowth(platforms);
    const recommendations = this.generateRecommendations(params);
    const summary = this.buildSummary(platforms, overallGrowth);

    const report: GrowthReport = {
      period,
      platforms,
      overallGrowth,
      recommendations,
      summary,
    };

    this.eventBus.emit('audit:log', {
      action: 'social:report_generated',
      agent: 'system',
      trustLevel: 'operator',
      details: {
        platformCount: platforms.length,
        overallGrowth,
        period,
      },
    });

    log.info({ platformCount: platforms.length, overallGrowth }, 'Growth report generated');

    return report;
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private calculateOverallGrowth(
    platforms: GrowthReport['platforms'],
  ): number {
    if (platforms.length === 0) return 0;

    const totalGrowth = platforms.reduce((sum, p) => sum + p.growth, 0);
    return Math.round((totalGrowth / platforms.length) * 100) / 100;
  }

  private generateRecommendations(params: {
    xMetrics?: EngagementTrend;
    youtubeMetrics?: YouTubeMetrics;
  }): string[] {
    const recs: string[] = [];

    if (params.xMetrics) {
      const x = params.xMetrics;

      if (x.avgEngagementRate < 0.02) {
        recs.push('X engagement rate is below 2%. Try more conversational tweets and direct CTAs.');
      }

      if (x.bestPerformingType === 'conversation-starter') {
        recs.push('Reply-heavy posts perform best. Double down on asking questions and sharing opinions.');
      } else if (x.bestPerformingType === 'reference-content') {
        recs.push('Bookmarked content performs well. Create more save-worthy threads and resources.');
      }

      if (x.growthRate < 0) {
        recs.push('Engagement is declining. Review posting frequency and content mix.');
      }
    }

    if (params.youtubeMetrics) {
      const yt = params.youtubeMetrics;

      if (yt.watchTimeHours < 10) {
        recs.push('YouTube watch time is low. Focus on retention — hook viewers in the first 30 seconds.');
      }

      if (yt.subscribers > 0 && yt.views / yt.subscribers < 0.5) {
        recs.push('View-to-subscriber ratio is low. Optimize thumbnails and titles for click-through.');
      }
    }

    if (!params.xMetrics && !params.youtubeMetrics) {
      recs.push('No platform data available. Connect at least one platform to track growth.');
    }

    if (recs.length === 0) {
      recs.push('Solid week across platforms. Maintain consistency and experiment with one new content format.');
    }

    return recs;
  }

  private buildSummary(
    platforms: GrowthReport['platforms'],
    overallGrowth: number,
  ): string {
    if (platforms.length === 0) {
      return 'No platform data available for this period.';
    }

    const platformNames = platforms.map(p => p.name).join(', ');
    const direction = overallGrowth > 0 ? 'up' : overallGrowth < 0 ? 'down' : 'flat';

    return `Weekly growth across ${platformNames}: ${direction} ${Math.abs(overallGrowth).toFixed(1)}%. ` +
      `${platforms.length} platform(s) tracked.`;
  }
}
