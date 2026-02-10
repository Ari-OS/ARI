/**
 * Gap Analysis Engine
 *
 * Analyzes performance reviews to identify knowledge gaps and areas for improvement.
 * Part of ARI's weekly self-improvement loop.
 *
 * @module cognition/learning/gap-analysis
 */

import { randomUUID } from 'node:crypto';
import type {
  GapAnalysisResult,
  KnowledgeGap,
  PerformanceReview,
} from '../types.js';

/**
 * Known frameworks in ARI's cognitive toolkit
 */
const KNOWN_FRAMEWORKS = [
  'Bayesian Reasoning',
  'Expected Value',
  'Kelly Criterion',
  'Decision Trees',
  'Systems Thinking',
  'Antifragility',
  'Bias Detection',
  'Emotional State',
  'Fear/Greed Detection',
  'Discipline',
  'CBT Reframing',
  'Dichotomy of Control',
  'Virtue Ethics',
  'Reflection',
  'Wisdom',
  'Deliberate Practice',
];

/**
 * Analyzes performance reviews to identify knowledge gaps
 */
export class GapAnalyzer {
  /**
   * Analyze performance reviews and identify knowledge gaps
   *
   * @param reviews - Array of performance reviews (typically daily reviews over a week)
   * @returns Gap analysis with identified gaps, recommendations, and priorities
   */
  analyzeGaps(reviews: PerformanceReview[]): GapAnalysisResult {
    // Handle empty input
    if (reviews.length === 0) {
      const now = new Date();
      return {
        period: { start: now, end: now },
        gaps: [],
        topGaps: [],
        gapsResolved: [],
        recommendations: ['Insufficient data for gap analysis'],
        newSourceSuggestions: [],
        timestamp: now,
      };
    }

    // Sort reviews by timestamp to get period
    const sorted = [...reviews].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    const period = {
      start: sorted[0].timestamp,
      end: sorted[sorted.length - 1].timestamp,
    };

    const gaps: KnowledgeGap[] = [];

    // 1. Detect recurring biases
    const biasCounts: Record<string, number> = {};
    for (const review of reviews) {
      for (const [biasType, count] of Object.entries(review.biasesDetected.byType)) {
        biasCounts[biasType] = (biasCounts[biasType] || 0) + count;
      }
    }

    for (const [biasType, count] of Object.entries(biasCounts)) {
      if (count > 3) {
        const severity = count > 5 ? 'HIGH' : 'MEDIUM';
        const priority = (severity === 'HIGH' ? 7 : 5) * count;

        gaps.push({
          id: randomUUID(),
          description: `Recurring cognitive bias: ${biasType}`,
          context: `Bias '${biasType}' detected ${count} times across ${reviews.length} review periods`,
          frequency: count,
          severity,
          suggestedFrameworks: ['Cognitive Bias Detection', 'CBT Reframing'],
          suggestedSources: [],
          affectedMembers: [],
          priority,
          status: 'NEW',
          createdAt: new Date(),
        });
      }
    }

    // 2. Detect low-success frameworks
    const frameworkStats = new Map<
      string,
      { totalCount: number; totalSuccesses: number }
    >();

    for (const review of reviews) {
      for (const fw of review.frameworkUsage) {
        const existing = frameworkStats.get(fw.framework) || {
          totalCount: 0,
          totalSuccesses: 0,
        };
        frameworkStats.set(fw.framework, {
          totalCount: existing.totalCount + fw.usageCount,
          totalSuccesses:
            existing.totalSuccesses + fw.usageCount * fw.successRate,
        });
      }
    }

    for (const [framework, stats] of frameworkStats.entries()) {
      if (stats.totalCount > 2) {
        const avgSuccessRate = stats.totalSuccesses / stats.totalCount;
        if (avgSuccessRate < 0.5) {
          gaps.push({
            id: randomUUID(),
            description: `Low success rate with framework: ${framework}`,
            context: `Framework '${framework}' has ${Math.round(avgSuccessRate * 100)}% success rate across ${stats.totalCount} uses`,
            frequency: stats.totalCount,
            severity: 'MEDIUM',
            suggestedFrameworks: [framework, 'Deliberate Practice'],
            suggestedSources: [],
            affectedMembers: [],
            priority: 5 * stats.totalCount,
            status: 'NEW',
            createdAt: new Date(),
          });
        }
      }
    }

    // 3. Detect underused frameworks
    const usedFrameworks = new Set<string>();
    for (const review of reviews) {
      for (const fw of review.frameworkUsage) {
        usedFrameworks.add(fw.framework);
      }
    }

    for (const framework of KNOWN_FRAMEWORKS) {
      if (!usedFrameworks.has(framework)) {
        gaps.push({
          id: randomUUID(),
          description: `Underused framework: ${framework}`,
          context: `Framework '${framework}' has not been used in the review period`,
          frequency: 0,
          severity: 'LOW',
          suggestedFrameworks: [framework],
          suggestedSources: [],
          affectedMembers: [],
          priority: 2,
          status: 'NEW',
          createdAt: new Date(),
        });
      }
    }

    // 4. Detect high emotional risk
    let totalRisk = 0;
    let highRiskCount = 0;

    for (const review of reviews) {
      totalRisk += review.emotionalRisk.avgRisk;
      highRiskCount += review.emotionalRisk.highRiskDecisions;
    }

    const avgRisk = totalRisk / reviews.length;
    if (avgRisk > 0.5) {
      gaps.push({
        id: randomUUID(),
        description: 'High emotional risk in decisions',
        context: `Average emotional risk is ${avgRisk.toFixed(2)}, with ${highRiskCount} high-risk decisions`,
        frequency: highRiskCount,
        severity: 'HIGH',
        suggestedFrameworks: ['Emotional State', 'CBT Reframing', 'Discipline'],
        suggestedSources: [],
        affectedMembers: [],
        priority: 7 * highRiskCount,
        status: 'NEW',
        createdAt: new Date(),
      });
    }

    // 5. Detect declining performance
    if (sorted.length >= 2) {
      const firstSuccessRate = sorted[0].decisions.successRate;
      const lastSuccessRate = sorted[sorted.length - 1].decisions.successRate;

      if (lastSuccessRate < firstSuccessRate && lastSuccessRate < 0.7) {
        gaps.push({
          id: randomUUID(),
          description: 'Declining decision quality',
          context: `Decision success rate declining from ${Math.round(firstSuccessRate * 100)}% to ${Math.round(lastSuccessRate * 100)}%`,
          frequency: sorted.length,
          severity: 'CRITICAL',
          suggestedFrameworks: [
            'Reflection',
            'Deliberate Practice',
            'Discipline',
          ],
          suggestedSources: [],
          affectedMembers: [],
          priority: 10 * sorted.length,
          status: 'NEW',
          createdAt: new Date(),
        });
      }
    }

    // Sort gaps by priority descending
    gaps.sort((a, b) => b.priority - a.priority);

    // Top 5 gaps
    const topGaps = gaps.slice(0, 5);

    // Generate recommendations based on top gaps
    const recommendations: string[] = [];

    // Check for critical declining performance
    const decliningGap = topGaps.find((g) => g.severity === 'CRITICAL');
    if (decliningGap) {
      recommendations.push(
        'Urgent: Review and improve decision-making process'
      );
    }

    // Check for high emotional risk
    const emotionalGap = topGaps.find((g) =>
      g.description.includes('emotional risk')
    );
    if (emotionalGap) {
      recommendations.push(
        'Practice emotional regulation before major decisions'
      );
    }

    // Check for recurring biases
    const biasGap = topGaps.find((g) => g.description.includes('bias'));
    if (biasGap) {
      recommendations.push(
        'Run bias detection proactively on all significant decisions'
      );
    }

    // Check for underused frameworks
    const underusedGap = gaps.find((g) => g.description.includes('Underused'));
    if (underusedGap && recommendations.length < 3) {
      const framework = underusedGap.suggestedFrameworks[0];
      recommendations.push(
        `Diversify cognitive toolkit — try ${framework}`
      );
    }

    // Ensure at least one recommendation
    if (recommendations.length === 0) {
      recommendations.push('Continue current practices — performance is stable');
    }

    return {
      period,
      gaps,
      topGaps,
      gapsResolved: [], // Future feature: requires comparison with previous analysis
      recommendations,
      newSourceSuggestions: [], // Future feature: requires source discovery engine
      timestamp: new Date(),
    };
  }
}
