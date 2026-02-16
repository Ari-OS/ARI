// src/plugins/content-engine/feedback-loop.ts
import type { ContentAnalytics } from './analytics.js';
import { FeedbackInsightSchema, type FeedbackInsight } from './types.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('feedback-loop');

/**
 * FeedbackLoop — Self-improving content strategy
 *
 * Pipeline:
 * 1. After content published, collect metrics 24h later
 * 2. Score performance against category average
 * 3. Identify patterns: what hooks work, what topics perform
 * 4. Return strategy adjustments
 */
export class FeedbackLoop {
  private insights: Map<string, FeedbackInsight> = new Map();

  constructor(private readonly analytics: ContentAnalytics) {}

  /**
   * Analyze content performance and generate insights
   */
  analyze(): FeedbackInsight[] {
    const topPerformers = this.analytics.getTopPerformers(10);
    const avgPerformance = this.analytics.getAveragePerformance();

    if (topPerformers.length === 0) {
      log.info('No content metrics available for analysis');
      return [];
    }

    const newInsights: FeedbackInsight[] = [];

    // Analyze topic patterns
    const topicInsight = this.analyzeTopics(topPerformers, avgPerformance);
    if (topicInsight) {
      this.insights.set(topicInsight.id, topicInsight);
      newInsights.push(topicInsight);
    }

    // Analyze hook patterns
    const hookInsight = this.analyzeHooks(topPerformers, avgPerformance);
    if (hookInsight) {
      this.insights.set(hookInsight.id, hookInsight);
      newInsights.push(hookInsight);
    }

    // Analyze format patterns
    const formatInsight = this.analyzeFormats(topPerformers, avgPerformance);
    if (formatInsight) {
      this.insights.set(formatInsight.id, formatInsight);
      newInsights.push(formatInsight);
    }

    log.info({ insightCount: newInsights.length }, 'Feedback analysis complete');

    return newInsights;
  }

  /**
   * Analyze which topics perform best
   */
  private analyzeTopics(topPerformers: Array<{ performanceScore: number; platform: string }>, avgPerformance: number): FeedbackInsight | null {
    if (topPerformers.length < 3) return null;

    const topScore = topPerformers[0]?.performanceScore ?? 0;
    if (topScore === 0) return null;

    const improvement = ((topScore - avgPerformance) / avgPerformance) * 100;

    if (improvement < 20) return null; // Not significant enough

    return FeedbackInsightSchema.parse({
      id: `insight-topic-${Date.now()}`,
      category: 'topic',
      insight: `Top-performing topics outperform average by ${improvement.toFixed(0)}%`,
      evidence: topPerformers.slice(0, 3).map((p) => `${p.platform}: ${p.performanceScore.toFixed(1)} score`),
      recommendation: 'Focus on topics with proven engagement patterns. Analyze top performers for common themes.',
      confidence: Math.min(improvement, 100),
      generatedAt: new Date().toISOString(),
    });
  }

  /**
   * Analyze which hooks/openings work best
   */
  private analyzeHooks(topPerformers: Array<{ performanceScore: number }>, avgPerformance: number): FeedbackInsight | null {
    if (topPerformers.length < 5) return null;

    const topAvg = topPerformers.slice(0, 3).reduce((sum, p) => sum + p.performanceScore, 0) / 3;
    const improvement = ((topAvg - avgPerformance) / avgPerformance) * 100;

    if (improvement < 15) return null;

    return FeedbackInsightSchema.parse({
      id: `insight-hook-${Date.now()}`,
      category: 'hook',
      insight: 'Top-performing content shows strong opening hooks',
      evidence: [`Average top 3 score: ${topAvg.toFixed(1)}`, `Average overall: ${avgPerformance.toFixed(1)}`],
      recommendation: 'Lead with questions, bold claims, or pattern interrupts. Avoid generic openings.',
      confidence: Math.min(improvement * 2, 100),
      generatedAt: new Date().toISOString(),
    });
  }

  /**
   * Analyze which formats work best (thread vs single, etc.)
   */
  private analyzeFormats(topPerformers: Array<{ platform: string; performanceScore: number }>, _avgPerformance: number): FeedbackInsight | null {
    if (topPerformers.length < 5) return null;

    const platformCounts = new Map<string, number>();
    for (const p of topPerformers) {
      platformCounts.set(p.platform, (platformCounts.get(p.platform) ?? 0) + 1);
    }

    const topPlatform = [...platformCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!topPlatform || topPlatform[1] < 3) return null;

    return FeedbackInsightSchema.parse({
      id: `insight-format-${Date.now()}`,
      category: 'format',
      insight: `${topPlatform[0]} format appears in ${topPlatform[1]} of top 10 posts`,
      evidence: [`Top platform: ${topPlatform[0]}`, `Occurrences: ${topPlatform[1]}`],
      recommendation: `Consider prioritizing ${topPlatform[0]} format for high-impact content.`,
      confidence: (topPlatform[1] / topPerformers.length) * 100,
      generatedAt: new Date().toISOString(),
    });
  }

  /**
   * Get all insights
   */
  getAllInsights(): FeedbackInsight[] {
    return [...this.insights.values()];
  }

  /**
   * Get insights by category
   */
  getInsightsByCategory(category: FeedbackInsight['category']): FeedbackInsight[] {
    return [...this.insights.values()].filter((i) => i.category === category);
  }
}
