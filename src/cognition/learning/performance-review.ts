/**
 * Performance Review — Daily Performance Analysis Engine
 *
 * Analyzes decision journal entries to generate comprehensive performance reviews.
 * Tracks decision quality, bias patterns, emotional risk, and framework effectiveness.
 *
 * Features:
 * - Decision success rate tracking
 * - Expected value accuracy (calibration)
 * - Bias detection patterns
 * - Emotional risk metrics
 * - Framework usage statistics
 * - Automated grading (A-F scale)
 * - Actionable insights and recommendations
 *
 * @module cognition/learning/performance-review
 */

import { randomUUID } from 'node:crypto';
import type { PerformanceReview, CognitiveBias, Insight } from '../types.js';
import type { JournalEntry } from './decision-journal.js';

// =============================================================================
// Performance Reviewer Class
// =============================================================================

export class PerformanceReviewer {
  /**
   * Generate comprehensive performance review from journal entries.
   */
  generateReview(entries: JournalEntry[], options: { hours: number }): PerformanceReview {
    const now = new Date();
    const startTime = entries.length > 0
      ? entries.reduce((min, e) => e.timestamp < min ? e.timestamp : min, entries[0].timestamp)
      : new Date(now.getTime() - options.hours * 60 * 60 * 1000);
    const endTime = entries.length > 0
      ? entries.reduce((max, e) => e.timestamp > max ? e.timestamp : max, entries[0].timestamp)
      : now;

    // Calculate decision stats
    const decisions = this.calculateDecisionStats(entries);

    // Calculate expected value accuracy
    const expectedValueAccuracy = this.calculateEVAccuracy(entries);

    // Analyze bias patterns
    const biasesDetected = this.analyzeBiasPatterns(entries);

    // Calculate emotional risk
    const emotionalRisk = this.calculateEmotionalRisk(entries);

    // Analyze framework usage
    const frameworkUsage = this.analyzeFrameworkUsage(entries);

    // Generate patterns
    const patterns = this.generatePatterns(entries, frameworkUsage);

    // Generate insights
    const insights = this.generateInsights(
      decisions,
      expectedValueAccuracy,
      biasesDetected,
      emotionalRisk,
      frameworkUsage
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      decisions,
      expectedValueAccuracy,
      biasesDetected,
      emotionalRisk
    );

    // Calculate overall grade
    const overallGrade = this.calculateGrade(
      decisions.successRate,
      biasesDetected.total,
      emotionalRisk.avgRisk
    );

    return {
      period: {
        start: startTime,
        end: endTime,
        durationHours: options.hours,
      },
      decisions,
      expectedValueAccuracy,
      biasesDetected,
      emotionalRisk,
      frameworkUsage,
      patterns,
      insights,
      recommendations,
      overallGrade,
      timestamp: now,
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Decision Stats
  // ───────────────────────────────────────────────────────────────────────

  private calculateDecisionStats(entries: JournalEntry[]): PerformanceReview['decisions'] {
    const total = entries.length;
    const successful = entries.filter((e) => e.outcome === 'success').length;
    const failed = entries.filter((e) => e.outcome === 'failure').length;
    const partial = entries.filter((e) => e.outcome === 'partial').length;

    return {
      total,
      successful,
      failed,
      partial,
      successRate: total > 0 ? successful / total : 0,
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Expected Value Accuracy (Calibration)
  // ───────────────────────────────────────────────────────────────────────

  private calculateEVAccuracy(entries: JournalEntry[]): PerformanceReview['expectedValueAccuracy'] {
    const completedEntries = entries.filter((e) => e.outcome && e.outcome !== 'pending');

    if (completedEntries.length === 0) {
      return {
        meanError: 0,
        rmse: 0,
        calibration: 0,
        overconfidenceRate: 0,
        underconfidenceRate: 0,
      };
    }

    let totalError = 0;
    let sumSquaredErrors = 0;
    let overconfidentCount = 0;
    let underconfidentCount = 0;
    let totalConfidence = 0;

    for (const entry of completedEntries) {
      const actualValue = entry.outcome === 'success' ? 1 : 0;
      const error = Math.abs(entry.confidence - actualValue);
      totalError += error;
      sumSquaredErrors += error * error;
      totalConfidence += entry.confidence;

      // Overconfidence: high confidence but failed
      if (entry.confidence > 0.7 && entry.outcome === 'failure') {
        overconfidentCount++;
      }

      // Underconfidence: low confidence but succeeded
      if (entry.confidence < 0.5 && entry.outcome === 'success') {
        underconfidentCount++;
      }
    }

    const meanError = totalError / completedEntries.length;
    const rmse = Math.sqrt(sumSquaredErrors / completedEntries.length);
    const avgConfidence = totalConfidence / completedEntries.length;
    const successRate = completedEntries.filter((e) => e.outcome === 'success').length / completedEntries.length;
    const calibration = 1 - Math.abs(successRate - avgConfidence);

    return {
      meanError,
      rmse,
      calibration,
      overconfidenceRate: overconfidentCount / completedEntries.length,
      underconfidenceRate: underconfidentCount / completedEntries.length,
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Bias Pattern Analysis
  // ───────────────────────────────────────────────────────────────────────

  private analyzeBiasPatterns(entries: JournalEntry[]): PerformanceReview['biasesDetected'] {
    const byType: Record<string, number> = {};
    let total = 0;

    for (const entry of entries) {
      if (entry.biases_detected) {
        for (const bias of entry.biases_detected) {
          byType[bias] = (byType[bias] ?? 0) + 1;
          total++;
        }
      }
    }

    // Find most common bias
    let mostCommon: CognitiveBias | undefined;
    let maxCount = 0;
    for (const [bias, count] of Object.entries(byType)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = bias as CognitiveBias;
      }
    }

    return {
      total,
      byType,
      trend: 'stable', // Single review period has no trend
      mostCommon,
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Emotional Risk Metrics
  // ───────────────────────────────────────────────────────────────────────

  private calculateEmotionalRisk(entries: JournalEntry[]): PerformanceReview['emotionalRisk'] {
    const entriesWithEmotion = entries.filter((e) => e.emotional_context);

    if (entriesWithEmotion.length === 0) {
      return {
        avgRisk: 0,
        highRiskDecisions: 0,
        highRiskRate: 0,
      };
    }

    let totalRisk = 0;
    let highRiskCount = 0;

    for (const entry of entriesWithEmotion) {
      if (entry.emotional_context) {
        // Risk formula: negative valence + high arousal = high risk
        const valence = entry.emotional_context.valence;
        const arousal = entry.emotional_context.arousal;
        const risk = (1 - (valence + 1) / 2) * arousal;

        totalRisk += risk;
        if (risk > 0.6) {
          highRiskCount++;
        }
      }
    }

    return {
      avgRisk: totalRisk / entriesWithEmotion.length,
      highRiskDecisions: highRiskCount,
      highRiskRate: highRiskCount / entries.length,
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Framework Usage Statistics
  // ───────────────────────────────────────────────────────────────────────

  private analyzeFrameworkUsage(entries: JournalEntry[]): PerformanceReview['frameworkUsage'] {
    const frameworkStats = new Map<string, { uses: number; successes: number }>();

    for (const entry of entries) {
      for (const framework of entry.frameworks_used) {
        const stats = frameworkStats.get(framework) ?? { uses: 0, successes: 0 };
        stats.uses++;
        if (entry.outcome === 'success') {
          stats.successes++;
        }
        frameworkStats.set(framework, stats);
      }
    }

    return Array.from(frameworkStats.entries()).map(([framework, stats]) => ({
      framework,
      usageCount: stats.uses,
      successRate: stats.uses > 0 ? stats.successes / stats.uses : 0,
    }));
  }

  // ───────────────────────────────────────────────────────────────────────
  // Pattern Generation
  // ───────────────────────────────────────────────────────────────────────

  private generatePatterns(
    entries: JournalEntry[],
    frameworkUsage: PerformanceReview['frameworkUsage']
  ): string[] {
    const patterns: string[] = [];

    // Pillar distribution
    const pillarCounts: Record<string, number> = { LOGOS: 0, ETHOS: 0, PATHOS: 0, CROSS: 0 };
    for (const entry of entries) {
      pillarCounts[entry.pillar]++;
    }

    for (const [pillar, count] of Object.entries(pillarCounts)) {
      if (count > 0) {
        const percentage = ((count / entries.length) * 100).toFixed(0);
        patterns.push(`${percentage}% of decisions used ${pillar} frameworks`);
      }
    }

    // Most active framework
    if (frameworkUsage.length > 0) {
      const topFramework = frameworkUsage.reduce((max, fw) =>
        fw.usageCount > max.usageCount ? fw : max
      );
      patterns.push(`Most active framework: ${topFramework.framework} (${topFramework.usageCount} uses)`);
    }

    // High emotional risk pattern
    const emotionalEntries = entries.filter((e) => e.emotional_context);
    if (emotionalEntries.length > 0) {
      let highRiskCount = 0;
      for (const entry of emotionalEntries) {
        if (entry.emotional_context) {
          const risk = (1 - (entry.emotional_context.valence + 1) / 2) * entry.emotional_context.arousal;
          if (risk > 0.6) highRiskCount++;
        }
      }
      if (highRiskCount > 0) {
        patterns.push(`High emotional risk detected in ${highRiskCount} decisions`);
      }
    }

    return patterns;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Insight Generation
  // ───────────────────────────────────────────────────────────────────────

  private generateInsights(
    decisions: PerformanceReview['decisions'],
    evAccuracy: PerformanceReview['expectedValueAccuracy'],
    biases: PerformanceReview['biasesDetected'],
    emotionalRisk: PerformanceReview['emotionalRisk'],
    frameworks: PerformanceReview['frameworkUsage']
  ): Insight[] {
    const insights: Insight[] = [];
    const now = new Date();

    // Insight: Overconfidence pattern
    if (evAccuracy.overconfidenceRate > 0.3) {
      insights.push({
        id: randomUUID(),
        type: 'ANTIPATTERN',
        description: `High overconfidence detected: ${(evAccuracy.overconfidenceRate * 100).toFixed(0)}% of decisions had high confidence but failed`,
        evidence: [
          `Overconfidence rate: ${(evAccuracy.overconfidenceRate * 100).toFixed(1)}%`,
          `Calibration score: ${(evAccuracy.calibration * 100).toFixed(1)}%`,
        ],
        actionable: 'Consider using Bias Detection before high-confidence decisions',
        confidence: 0.85,
        generalizes: true,
        priority: 'HIGH',
        framework: 'Expected Value Calibration',
        timestamp: now,
      });
    }

    // Insight: High bias frequency
    if (biases.total > decisions.total * 0.5) {
      insights.push({
        id: randomUUID(),
        type: 'WARNING',
        description: `Elevated bias detection: ${biases.total} biases across ${decisions.total} decisions`,
        evidence: [
          `Most common: ${biases.mostCommon ?? 'N/A'}`,
          `Total biases: ${biases.total}`,
        ],
        actionable: 'Implement pre-decision bias checks for critical decisions',
        confidence: 0.8,
        generalizes: true,
        priority: 'MEDIUM',
        framework: 'Cognitive Bias Detection',
        timestamp: now,
      });
    }

    // Insight: Framework underutilization
    const pillarUsage: Record<string, number> = { LOGOS: 0, ETHOS: 0, PATHOS: 0 };
    for (const fw of frameworks) {
      if (fw.framework.includes('Bayesian') || fw.framework.includes('Expected Value') || fw.framework.includes('Kelly')) {
        pillarUsage.LOGOS += fw.usageCount;
      } else if (fw.framework.includes('Bias') || fw.framework.includes('Emotional') || fw.framework.includes('Discipline')) {
        pillarUsage.ETHOS += fw.usageCount;
      } else if (fw.framework.includes('CBT') || fw.framework.includes('Stoic') || fw.framework.includes('Wisdom')) {
        pillarUsage.PATHOS += fw.usageCount;
      }
    }

    const minUsage = Math.min(...Object.values(pillarUsage));
    const maxUsage = Math.max(...Object.values(pillarUsage));
    if (maxUsage > 0 && minUsage < maxUsage * 0.3) {
      const underusedPillar = Object.entries(pillarUsage).find(([_, count]) => count === minUsage)?.[0];
      if (underusedPillar) {
        insights.push({
          id: randomUUID(),
          type: 'OPPORTUNITY',
          description: `${underusedPillar} pillar underutilized compared to others`,
          evidence: [
            `${underusedPillar} usage: ${minUsage}`,
            `Peak usage: ${maxUsage}`,
          ],
          actionable: `Consider integrating ${underusedPillar} frameworks into decision process`,
          confidence: 0.7,
          generalizes: false,
          priority: 'LOW',
          framework: 'Framework Balance Analysis',
          timestamp: now,
        });
      }
    }

    return insights;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Recommendation Generation
  // ───────────────────────────────────────────────────────────────────────

  private generateRecommendations(
    decisions: PerformanceReview['decisions'],
    evAccuracy: PerformanceReview['expectedValueAccuracy'],
    biases: PerformanceReview['biasesDetected'],
    emotionalRisk: PerformanceReview['emotionalRisk']
  ): string[] {
    const recommendations: string[] = [];

    // Success rate recommendations
    if (decisions.successRate < 0.5) {
      recommendations.push('Decision quality below baseline. Review decision process and increase deliberation time.');
    } else if (decisions.successRate > 0.8) {
      recommendations.push('Excellent decision quality. Document successful patterns for future reference.');
    }

    // Calibration recommendations
    if (evAccuracy.overconfidenceRate > 0.3) {
      recommendations.push('Consider using Bias Detection before high-confidence decisions to reduce overconfidence.');
    }
    if (evAccuracy.underconfidenceRate > 0.3) {
      recommendations.push('Track evidence more systematically to increase confidence in good decisions.');
    }

    // Bias recommendations
    if (biases.total > decisions.total * 0.5) {
      recommendations.push(`Focus on mitigating ${biases.mostCommon ?? 'detected biases'} through structured frameworks.`);
    }

    // Emotional risk recommendations
    if (emotionalRisk.avgRisk > 0.5) {
      recommendations.push('High emotional risk detected. Implement cooling-off periods before critical decisions.');
    }

    return recommendations;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Grade Calculation
  // ───────────────────────────────────────────────────────────────────────

  private calculateGrade(
    successRate: number,
    biasCount: number,
    avgEmotionalRisk: number
  ): 'A' | 'B' | 'C' | 'D' | 'F' {
    // A: Excellent performance
    if (successRate > 0.8 && biasCount < 3 && avgEmotionalRisk < 0.4) {
      return 'A';
    }

    // B: Good performance
    if (successRate > 0.6 && biasCount < 5) {
      return 'B';
    }

    // C: Acceptable performance
    if (successRate > 0.4) {
      return 'C';
    }

    // D: Below acceptable
    if (successRate > 0.2) {
      return 'D';
    }

    // F: Poor performance or no data
    return 'F';
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let defaultReviewer: PerformanceReviewer | null = null;

export function getPerformanceReviewer(): PerformanceReviewer {
  if (!defaultReviewer) {
    defaultReviewer = new PerformanceReviewer();
  }
  return defaultReviewer;
}

export function createPerformanceReviewer(): PerformanceReviewer {
  return new PerformanceReviewer();
}
