// src/plugins/content-engine/analytics.ts
import fs from 'node:fs/promises';
import { join } from 'node:path';
import type { XClient } from '../../integrations/twitter/client.js';
import { ContentMetricSchema, type ContentMetric } from './types.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('content-analytics');

/**
 * ContentAnalytics — Track published content performance
 *
 * Pipeline:
 * 1. Fetch tweet metrics (impressions, likes, retweets, replies) via XClient
 * 2. Calculate engagement rate per post
 * 3. Identify top performers
 * 4. Store metrics at ~/.ari/data/analytics/content-metrics.json
 */
export class ContentAnalytics {
  private metrics: Map<string, ContentMetric> = new Map();
  private dataFile: string;

  constructor(private readonly xClient: XClient | null) {
    const ariDataDir = process.env.HOME ? join(process.env.HOME, '.ari', 'data', 'analytics') : join('.', 'data', 'analytics');
    this.dataFile = join(ariDataDir, 'content-metrics.json');
  }

  /**
   * Collect metrics for published content
   * Note: X API v2 Free tier doesn't provide tweet metrics access.
   * This is a placeholder for future premium tier integration.
   * For now, we store empty metrics and will populate via manual reporting.
   */
  async collectMetrics(publishedIds: string[]): Promise<ContentMetric[]> {
    if (!this.xClient) {
      log.warn('XClient not available, skipping metrics collection');
      return [];
    }

    const collected: ContentMetric[] = [];

    for (const tweetId of publishedIds) {
      try {
        // X API v2 Free tier doesn't provide metrics access
        // This is a placeholder structure for when premium tier is enabled
        const metric = ContentMetricSchema.parse({
          id: `metric-${tweetId}`,
          draftId: tweetId,
          platform: 'x_single',
          publishedIds: [tweetId],
          publishedAt: new Date().toISOString(),
          collectedAt: new Date().toISOString(),
          metrics: {
            impressions: 0,
            likes: 0,
            retweets: 0,
            replies: 0,
            engagementRate: 0,
          },
          performanceScore: 0,
        });

        this.metrics.set(metric.id, metric);
        collected.push(metric);

        log.info({ tweetId }, 'Metrics stub created (awaiting X API premium tier)');
      } catch (error) {
        log.error({ tweetId, error }, 'Failed to create metrics stub');
      }
    }

    if (collected.length > 0) {
      await this.saveMetrics();
    }

    return collected;
  }

  /**
   * Get top performing content by engagement rate
   */
  async getTopPerformers(count: number): Promise<ContentMetric[]> {
    const allMetrics = [...this.metrics.values()];
    return Promise.resolve(
      allMetrics
        .sort((a, b) => b.performanceScore - a.performanceScore)
        .slice(0, count)
    );
  }

  /**
   * Load metrics from disk
   */
  async loadMetrics(): Promise<void> {
    try {
      const data = await fs.readFile(this.dataFile, 'utf-8');
      const parsed = JSON.parse(data) as unknown;

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const metric = ContentMetricSchema.parse(item);
          this.metrics.set(metric.id, metric);
        }
        log.info({ count: this.metrics.size }, 'Metrics loaded from disk');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.info('No existing metrics file, starting fresh');
      } else {
        log.error({ error }, 'Failed to load metrics');
      }
    }
  }

  /**
   * Save metrics to disk
   */
  async saveMetrics(): Promise<void> {
    try {
      const dir = join(this.dataFile, '..');
      await fs.mkdir(dir, { recursive: true });

      const data = [...this.metrics.values()];
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));

      log.info({ count: data.length }, 'Metrics saved to disk');
    } catch (error) {
      log.error({ error }, 'Failed to save metrics');
    }
  }

  /**
   * Calculate engagement rate: (likes + retweets + replies) / impressions
   */
  private calculateEngagementRate(metrics: { impressions: number; likes: number; retweets: number; replies: number }): number {
    if (metrics.impressions === 0) return 0;

    const totalEngagements = metrics.likes + metrics.retweets + metrics.replies;
    return totalEngagements / metrics.impressions;
  }

  /**
   * Get average performance score across all metrics
   */
  getAveragePerformance(): number {
    if (this.metrics.size === 0) return 0;

    const sum = [...this.metrics.values()].reduce((acc, m) => acc + m.performanceScore, 0);
    return sum / this.metrics.size;
  }
}
