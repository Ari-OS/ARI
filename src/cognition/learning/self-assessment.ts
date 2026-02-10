/**
 * Self-Assessment — Monthly Performance Comparison Engine
 *
 * Compares current period performance vs previous period to measure improvement.
 * Generates comprehensive self-assessment with grades, trends, and recommendations.
 *
 * Features:
 * - Period-over-period decision quality comparison
 * - Bias reduction tracking
 * - Knowledge growth metrics
 * - Learning velocity measurement
 * - Framework effectiveness analysis
 * - Automated grading (A-F scale)
 * - Strengths/weaknesses identification
 * - Next-month focus recommendations
 *
 * @module cognition/learning/self-assessment
 */

import type {
  SelfAssessment,
  PerformanceReview,
  GapAnalysisResult,
  CognitiveBias,
  Pillar,
} from '../types.js';

// =============================================================================
// Input Types
// =============================================================================

export interface AssessmentInput {
  currentReviews: PerformanceReview[];
  previousReviews: PerformanceReview[];
  currentGaps: GapAnalysisResult | null;
  previousGaps: GapAnalysisResult | null;
}

// =============================================================================
// Framework to Pillar Mapping
// =============================================================================

const FRAMEWORK_TO_PILLAR: Record<string, Pillar> = {
  // LOGOS
  'Bayesian Reasoning': 'LOGOS',
  'Bayesian Reasoning (Bayes, 1763)': 'LOGOS',
  'Expected Value Theory': 'LOGOS',
  'Kelly Criterion': 'LOGOS',
  'Kelly Criterion (Kelly, 1956)': 'LOGOS',
  'Decision Trees': 'LOGOS',
  'Decision Tree Analysis': 'LOGOS',
  'Decision Tree Analysis (Backward Induction)': 'LOGOS',
  'Systems Thinking': 'LOGOS',
  'Systems Thinking (Donella Meadows)': 'LOGOS',
  'Antifragility': 'LOGOS',
  'Antifragility (Taleb, 2012)': 'LOGOS',

  // ETHOS
  'Bias Detection': 'ETHOS',
  'Cognitive Bias Detection': 'ETHOS',
  'Cognitive Bias Detection (Kahneman & Tversky)': 'ETHOS',
  'Emotional State': 'ETHOS',
  "Russell's Circumplex Model (VAD)": 'ETHOS',
  'Fear-Greed Detection': 'ETHOS',
  'Fear/Greed Cycle': 'ETHOS',
  'Trading Psychology (Mark Douglas)': 'ETHOS',
  'Discipline System': 'ETHOS',
  'Pre-Decision Discipline System': 'ETHOS',

  // PATHOS
  'CBT': 'PATHOS',
  'CBT Reframing': 'PATHOS',
  'Cognitive Behavioral Therapy (Beck, 1960s)': 'PATHOS',
  'Dichotomy of Control': 'PATHOS',
  'Dichotomy of Control (Epictetus, ~125 AD)': 'PATHOS',
  'Virtue Ethics': 'PATHOS',
  'Stoic Virtue Ethics (Marcus Aurelius)': 'PATHOS',
  'Reflection': 'PATHOS',
  'Reflection Engine (Kolb Learning Cycle, 1984)': 'PATHOS',
  'Wisdom': 'PATHOS',
  'Wisdom Index': 'PATHOS',
  'Deliberate Practice': 'PATHOS',
  'Deliberate Practice (Ericsson, 2016)': 'PATHOS',
};

// =============================================================================
// Self-Assessor Class
// =============================================================================

export class SelfAssessor {
  /**
   * Generate comprehensive monthly self-assessment comparing current vs previous period.
   */
  assess(input: AssessmentInput): SelfAssessment {
    const now = new Date();

    // Calculate period boundaries
    const period = this.calculatePeriod(input);

    // Assess decision quality (current vs previous)
    const decisionQuality = this.assessDecisionQuality(
      input.currentReviews,
      input.previousReviews
    );

    // Analyze bias reduction
    const biasReduction = this.analyzeBiasReduction(
      input.currentReviews,
      input.previousReviews
    );

    // Measure knowledge growth
    const knowledgeGrowth = this.measureKnowledgeGrowth(input.currentGaps);

    // Calculate learning velocity
    const learningVelocity = this.calculateLearningVelocity(
      input.currentReviews,
      decisionQuality.thisPeriod
    );

    // Analyze framework effectiveness
    const frameworkEffectiveness = this.analyzeFrameworkEffectiveness(
      input.currentReviews,
      input.previousReviews
    );

    // Calculate overall improvement score
    const overallImprovement = this.calculateOverallImprovement(
      decisionQuality,
      biasReduction,
      knowledgeGrowth
    );

    // Assign grade
    const grade = this.assignGrade(overallImprovement);
    const gradeExplanation = this.explainGrade(
      grade,
      decisionQuality,
      biasReduction,
      knowledgeGrowth
    );

    // Identify strengths and weaknesses
    const strengths = this.identifyStrengths(
      decisionQuality,
      biasReduction,
      frameworkEffectiveness
    );
    const weaknesses = this.identifyWeaknesses(
      decisionQuality,
      biasReduction,
      frameworkEffectiveness
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      weaknesses,
      frameworkEffectiveness
    );

    // Identify next month focus areas
    const nextMonthFocus = this.identifyNextMonthFocus(
      weaknesses,
      frameworkEffectiveness
    );

    return {
      period,
      decisionQuality,
      biasReduction,
      knowledgeGrowth,
      learningVelocity,
      frameworkEffectiveness,
      overallImprovement,
      grade,
      gradeExplanation,
      strengths,
      weaknesses,
      recommendations,
      nextMonthFocus,
      timestamp: now,
    };
  }

  // ===========================================================================
  // Period Calculation
  // ===========================================================================

  private calculatePeriod(input: AssessmentInput): SelfAssessment['period'] {
    const now = new Date();

    // Current period
    let start: Date;
    let end: Date;
    if (input.currentReviews.length > 0) {
      const timestamps = input.currentReviews.map((r) => r.timestamp);
      start = new Date(Math.min(...timestamps.map((d) => d.getTime())));
      end = new Date(Math.max(...timestamps.map((d) => d.getTime())));
    } else {
      // Default to current month
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
    }

    // Previous period
    let previousStart: Date;
    let previousEnd: Date;
    if (input.previousReviews.length > 0) {
      const timestamps = input.previousReviews.map((r) => r.timestamp);
      previousStart = new Date(Math.min(...timestamps.map((d) => d.getTime())));
      previousEnd = new Date(Math.max(...timestamps.map((d) => d.getTime())));
    } else {
      // Default to previous month
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    return { start, end, previousStart, previousEnd };
  }

  // ===========================================================================
  // Decision Quality Assessment
  // ===========================================================================

  private assessDecisionQuality(
    currentReviews: PerformanceReview[],
    previousReviews: PerformanceReview[]
  ): SelfAssessment['decisionQuality'] {
    // Calculate average success rate for current period
    const thisPeriod =
      currentReviews.length > 0
        ? currentReviews.reduce((sum, r) => sum + r.decisions.successRate, 0) /
          currentReviews.length
        : 0;

    // Calculate average success rate for previous period
    const lastPeriod =
      previousReviews.length > 0
        ? previousReviews.reduce((sum, r) => sum + r.decisions.successRate, 0) /
          previousReviews.length
        : 0;

    // Calculate change
    const change = thisPeriod - lastPeriod;

    // Determine trend
    let trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    if (change > 0.05) {
      trend = 'IMPROVING';
    } else if (change < -0.05) {
      trend = 'DECLINING';
    } else {
      trend = 'STABLE';
    }

    return {
      thisPeriod,
      lastPeriod,
      change,
      trend,
    };
  }

  // ===========================================================================
  // Bias Reduction Analysis
  // ===========================================================================

  private analyzeBiasReduction(
    currentReviews: PerformanceReview[],
    previousReviews: PerformanceReview[]
  ): SelfAssessment['biasReduction'] {
    // Sum total biases for current period
    const biasesThisPeriod = currentReviews.reduce(
      (sum, r) => sum + r.biasesDetected.total,
      0
    );

    // Sum total biases for previous period
    const biasesLastPeriod = previousReviews.reduce(
      (sum, r) => sum + r.biasesDetected.total,
      0
    );

    // Calculate reduction (positive = improvement)
    const reduction = biasesLastPeriod - biasesThisPeriod;

    // Calculate reduction percentage
    const reductionPercentage =
      biasesLastPeriod > 0 ? (reduction / biasesLastPeriod) * 100 : 0;

    // Find most common bias in current period
    const mostCommonBias = this.findMostCommonBias(currentReviews);

    return {
      biasesThisPeriod,
      biasesLastPeriod,
      reduction,
      reductionPercentage,
      mostCommonBias,
    };
  }

  private findMostCommonBias(
    reviews: PerformanceReview[]
  ): CognitiveBias | undefined {
    const biasCount: Record<string, number> = {};

    // Aggregate bias counts across all reviews
    for (const review of reviews) {
      for (const [bias, count] of Object.entries(review.biasesDetected.byType)) {
        biasCount[bias] = (biasCount[bias] || 0) + count;
      }
    }

    // Find bias with highest count
    let maxCount = 0;
    let mostCommon: string | undefined;
    for (const [bias, count] of Object.entries(biasCount)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = bias;
      }
    }

    return mostCommon as CognitiveBias | undefined;
  }

  // ===========================================================================
  // Knowledge Growth Measurement
  // ===========================================================================

  private measureKnowledgeGrowth(
    currentGaps: GapAnalysisResult | null
  ): SelfAssessment['knowledgeGrowth'] {
    // Placeholder values (no document/source tracking yet)
    return {
      documentsAdded: 0,
      sourcesAdded: 0,
      queriesAnswered: 0,
      querySuccessRate: 0,
      gapsResolved: currentGaps?.gapsResolved.length ?? 0,
    };
  }

  // ===========================================================================
  // Learning Velocity Calculation
  // ===========================================================================

  private calculateLearningVelocity(
    currentReviews: PerformanceReview[],
    successRate: number
  ): SelfAssessment['learningVelocity'] {
    // Count total insights across all reviews
    const totalInsights = currentReviews.reduce(
      (sum, r) => sum + r.insights.length,
      0
    );

    // Calculate weeks in current period (approximate)
    const weeks = currentReviews.length > 0 ? Math.ceil(currentReviews.length / 7) : 1;
    const insightsPerWeek = totalInsights / weeks;

    // Use success rate as proxy for retention rate
    const retentionRate = successRate;

    return {
      insightsPerWeek,
      principlesExtracted: 0, // Placeholder
      transferLearnings: 0, // Placeholder
      retentionRate,
    };
  }

  // ===========================================================================
  // Framework Effectiveness Analysis
  // ===========================================================================

  private analyzeFrameworkEffectiveness(
    currentReviews: PerformanceReview[],
    previousReviews: PerformanceReview[]
  ): SelfAssessment['frameworkEffectiveness'] {
    // Aggregate framework usage across current reviews
    const currentFrameworks = this.aggregateFrameworkUsage(currentReviews);
    const previousFrameworks = this.aggregateFrameworkUsage(previousReviews);

    // Build effectiveness array
    const effectiveness: SelfAssessment['frameworkEffectiveness'] = [];

    for (const [framework, stats] of Object.entries(currentFrameworks)) {
      const pillar = this.mapFrameworkToPillar(framework);
      const previousStats = previousFrameworks[framework];

      // Calculate impact (simple measure: success rate * usage count)
      const impact = stats.successRate * stats.usageCount;

      // Determine trend by comparing success rates
      let trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
      if (previousStats) {
        const change = stats.successRate - previousStats.successRate;
        if (change > 0.05) {
          trend = 'IMPROVING';
        } else if (change < -0.05) {
          trend = 'DECLINING';
        } else {
          trend = 'STABLE';
        }
      } else {
        trend = 'STABLE'; // New framework, no comparison
      }

      effectiveness.push({
        framework,
        pillar,
        usageCount: stats.usageCount,
        successRate: stats.successRate,
        impact,
        trend,
      });
    }

    // Sort by impact (descending)
    effectiveness.sort((a, b) => b.impact - a.impact);

    return effectiveness;
  }

  private aggregateFrameworkUsage(
    reviews: PerformanceReview[]
  ): Record<string, { usageCount: number; successRate: number }> {
    const frameworks: Record<string, { totalCount: number; totalSuccess: number }> = {};

    for (const review of reviews) {
      for (const fw of review.frameworkUsage) {
        if (!frameworks[fw.framework]) {
          frameworks[fw.framework] = { totalCount: 0, totalSuccess: 0 };
        }
        frameworks[fw.framework].totalCount += fw.usageCount;
        frameworks[fw.framework].totalSuccess += fw.successRate * fw.usageCount;
      }
    }

    // Convert to average success rates
    const result: Record<string, { usageCount: number; successRate: number }> = {};
    for (const [framework, stats] of Object.entries(frameworks)) {
      result[framework] = {
        usageCount: stats.totalCount,
        successRate: stats.totalCount > 0 ? stats.totalSuccess / stats.totalCount : 0,
      };
    }

    return result;
  }

  private mapFrameworkToPillar(framework: string): Pillar {
    return FRAMEWORK_TO_PILLAR[framework] ?? 'LOGOS';
  }

  // ===========================================================================
  // Overall Improvement Calculation
  // ===========================================================================

  private calculateOverallImprovement(
    decisionQuality: SelfAssessment['decisionQuality'],
    biasReduction: SelfAssessment['biasReduction'],
    knowledgeGrowth: SelfAssessment['knowledgeGrowth']
  ): number {
    // Weighted combination:
    // - 50% decision quality change
    // - 30% bias reduction percentage
    // - 20% gaps resolved (normalized by total gaps)

    const decisionWeight = 0.5 * decisionQuality.change;
    const biasWeight = 0.3 * (biasReduction.reductionPercentage / 100);
    const gapWeight =
      0.2 *
      (knowledgeGrowth.gapsResolved /
        Math.max(knowledgeGrowth.gapsResolved + 1, 1)); // Normalize to 0-1

    return decisionWeight + biasWeight + gapWeight;
  }

  // ===========================================================================
  // Grading System
  // ===========================================================================

  private assignGrade(overallImprovement: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (overallImprovement > 0.15) return 'A';
    if (overallImprovement > 0.05) return 'B';
    if (overallImprovement > -0.05) return 'C';
    if (overallImprovement > -0.15) return 'D';
    return 'F';
  }

  private explainGrade(
    grade: 'A' | 'B' | 'C' | 'D' | 'F',
    decisionQuality: SelfAssessment['decisionQuality'],
    biasReduction: SelfAssessment['biasReduction'],
    knowledgeGrowth: SelfAssessment['knowledgeGrowth']
  ): string {
    const changePercent = Math.round(decisionQuality.change * 100);
    const biasPercent = Math.round(biasReduction.reductionPercentage);
    const gapsResolved = knowledgeGrowth.gapsResolved;

    if (grade === 'A') {
      return `Outstanding improvement: decision quality ${changePercent > 0 ? '+' : ''}${changePercent}%, bias reduction ${biasPercent}%, ${gapsResolved} gaps resolved`;
    } else if (grade === 'B') {
      return `Good progress: decision quality ${changePercent > 0 ? '+' : ''}${changePercent}%, bias reduction ${biasPercent}%`;
    } else if (grade === 'C') {
      return `Stable performance with minimal change: decision quality ${changePercent > 0 ? '+' : ''}${changePercent}%`;
    } else if (grade === 'D') {
      return `Declining performance: decision quality ${changePercent}%, needs improvement in bias awareness`;
    } else {
      return `Critical decline: decision quality ${changePercent}%, significant increase in biases detected`;
    }
  }

  // ===========================================================================
  // Strengths and Weaknesses Identification
  // ===========================================================================

  private identifyStrengths(
    decisionQuality: SelfAssessment['decisionQuality'],
    biasReduction: SelfAssessment['biasReduction'],
    frameworkEffectiveness: SelfAssessment['frameworkEffectiveness']
  ): string[] {
    const strengths: string[] = [];

    // Strong decision quality
    if (decisionQuality.thisPeriod >= 0.75) {
      strengths.push(
        `High decision success rate (${Math.round(decisionQuality.thisPeriod * 100)}%)`
      );
    }

    // Improving decision quality
    if (decisionQuality.trend === 'IMPROVING') {
      strengths.push(
        `Decision quality improving (+${Math.round(decisionQuality.change * 100)}%)`
      );
    }

    // Effective bias reduction
    if (biasReduction.reduction > 0 && biasReduction.reductionPercentage > 10) {
      strengths.push(
        `Strong bias reduction (-${Math.round(biasReduction.reductionPercentage)}%)`
      );
    }

    // Diverse framework usage
    if (frameworkEffectiveness.length >= 3) {
      strengths.push(`Diverse framework usage (${frameworkEffectiveness.length} active)`);
    }

    // High-impact frameworks
    const topFramework = frameworkEffectiveness[0];
    if (topFramework && topFramework.successRate >= 0.7) {
      strengths.push(
        `Strong proficiency in ${topFramework.framework} (${Math.round(topFramework.successRate * 100)}% success)`
      );
    }

    return strengths.length > 0 ? strengths.slice(0, 3) : ['Baseline established'];
  }

  private identifyWeaknesses(
    decisionQuality: SelfAssessment['decisionQuality'],
    biasReduction: SelfAssessment['biasReduction'],
    frameworkEffectiveness: SelfAssessment['frameworkEffectiveness']
  ): string[] {
    const weaknesses: string[] = [];

    // Low decision quality
    if (decisionQuality.thisPeriod < 0.5) {
      weaknesses.push(
        `Low decision success rate (${Math.round(decisionQuality.thisPeriod * 100)}%)`
      );
    }

    // Declining decision quality
    if (decisionQuality.trend === 'DECLINING') {
      weaknesses.push(
        `Declining decision quality (${Math.round(decisionQuality.change * 100)}%)`
      );
    }

    // Increasing biases
    if (biasReduction.reduction < 0) {
      weaknesses.push(
        `Bias detection increased (+${Math.round(Math.abs(biasReduction.reductionPercentage))}%)`
      );
    }

    // Common bias pattern
    if (biasReduction.mostCommonBias) {
      weaknesses.push(`Recurring ${biasReduction.mostCommonBias} pattern`);
    }

    // Limited framework usage
    if (frameworkEffectiveness.length < 2) {
      weaknesses.push('Limited framework diversity');
    }

    // Declining frameworks
    const decliningFrameworks = frameworkEffectiveness.filter(
      (fw) => fw.trend === 'DECLINING'
    );
    if (decliningFrameworks.length > 0) {
      weaknesses.push(
        `${decliningFrameworks.length} framework(s) showing declining effectiveness`
      );
    }

    return weaknesses.length > 0 ? weaknesses.slice(0, 3) : ['No critical weaknesses'];
  }

  // ===========================================================================
  // Recommendations and Next Month Focus
  // ===========================================================================

  private generateRecommendations(
    weaknesses: string[],
    frameworkEffectiveness: SelfAssessment['frameworkEffectiveness']
  ): string[] {
    const recommendations: string[] = [];

    // Address low success rate
    if (weaknesses.some((w) => w.includes('Low decision success'))) {
      recommendations.push(
        'Increase preparation time before decisions, use more structured frameworks'
      );
    }

    // Address declining performance
    if (weaknesses.some((w) => w.includes('Declining'))) {
      recommendations.push(
        'Review recent decisions for patterns, consider external stressors affecting performance'
      );
    }

    // Address bias issues
    if (weaknesses.some((w) => w.includes('Bias') || w.includes('bias'))) {
      recommendations.push(
        'Implement mandatory bias check before major decisions, increase cooling-off periods'
      );
    }

    // Address framework diversity
    if (weaknesses.some((w) => w.includes('Limited framework'))) {
      recommendations.push(
        'Experiment with underutilized frameworks, aim for at least 3 frameworks per week'
      );
    }

    // Leverage top frameworks
    const topFramework = frameworkEffectiveness[0];
    if (topFramework && topFramework.successRate >= 0.6) {
      recommendations.push(
        `Continue leveraging ${topFramework.framework} for critical decisions`
      );
    }

    return recommendations.length > 0
      ? recommendations.slice(0, 3)
      : ['Maintain current approach'];
  }

  private identifyNextMonthFocus(
    weaknesses: string[],
    frameworkEffectiveness: SelfAssessment['frameworkEffectiveness']
  ): string[] {
    const focus: string[] = [];

    // Focus on biggest weakness
    if (weaknesses[0] && weaknesses[0] !== 'No critical weaknesses') {
      focus.push(`Address: ${weaknesses[0]}`);
    }

    // Focus on declining frameworks
    const decliningFrameworks = frameworkEffectiveness.filter(
      (fw) => fw.trend === 'DECLINING' && fw.usageCount >= 3
    );
    if (decliningFrameworks.length > 0) {
      focus.push(`Revive effectiveness of ${decliningFrameworks[0].framework}`);
    }

    // Focus on pillar balance
    const pillarCounts: Record<Pillar, number> = { LOGOS: 0, ETHOS: 0, PATHOS: 0 };
    for (const fw of frameworkEffectiveness) {
      pillarCounts[fw.pillar] = (pillarCounts[fw.pillar] || 0) + 1;
    }
    const weakestPillar = (
      Object.entries(pillarCounts) as [Pillar, number][]
    ).sort((a, b) => a[1] - b[1])[0];
    if (weakestPillar) {
      focus.push(`Strengthen ${weakestPillar[0]} pillar (underutilized)`);
    }

    return focus.length > 0
      ? focus.slice(0, 3)
      : ['Maintain consistent performance review cadence'];
  }
}
