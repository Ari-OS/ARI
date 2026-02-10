/**
 * Self-Assessment Tests
 *
 * Tests the monthly self-assessment engine that compares current vs previous period performance.
 *
 * @module tests/unit/cognition/learning/self-assessment
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SelfAssessor } from '../../../../src/cognition/learning/self-assessment.js';
import type {
  PerformanceReview,
  GapAnalysisResult,
  CognitiveBias,
} from '../../../../src/cognition/types.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create mock performance reviews with specified success rate.
 */
function createMockReviews(
  count: number,
  successRate: number,
  startDate?: Date
): PerformanceReview[] {
  const baseDate = startDate ?? new Date();
  return Array.from({ length: count }, (_, i) => {
    const timestamp = new Date(baseDate.getTime() + i * 86400000); // 1 day intervals
    return {
      period: {
        start: timestamp,
        end: new Date(timestamp.getTime() + 86400000),
        durationHours: 24,
      },
      decisions: {
        total: 10,
        successful: Math.round(10 * successRate),
        failed: Math.round(10 * (1 - successRate)),
        partial: 0,
        successRate,
      },
      expectedValueAccuracy: {
        meanError: 0.2,
        rmse: 0.25,
        calibration: 0.8,
        overconfidenceRate: 0.1,
        underconfidenceRate: 0.05,
      },
      biasesDetected: {
        total: Math.round(3 * (1 - successRate)), // More biases when success is lower
        byType: {
          CONFIRMATION_BIAS: Math.round(1 * (1 - successRate)),
          RECENCY_BIAS: Math.round(1 * (1 - successRate)),
        } as Record<CognitiveBias, number>,
        trend: 'stable' as const,
        mostCommon: 'CONFIRMATION_BIAS' as const,
      },
      emotionalRisk: {
        avgRisk: 0.3,
        highRiskDecisions: 1,
        highRiskRate: 0.1,
      },
      frameworkUsage: [
        {
          framework: 'Bayesian Reasoning',
          usageCount: 5,
          successRate,
        },
        {
          framework: 'Expected Value Theory',
          usageCount: 3,
          successRate: successRate * 0.9,
        },
      ],
      patterns: ['Decision pattern 1', 'Decision pattern 2'],
      insights: [
        {
          id: `insight-${i}`,
          type: 'SUCCESS' as const,
          description: 'Test insight',
          evidence: ['Test evidence'],
          actionable: 'Test action',
          confidence: 0.8,
          generalizes: true,
          priority: 'MEDIUM' as const,
          framework: 'Bayesian Reasoning',
          timestamp,
        },
      ],
      recommendations: ['Recommendation 1'],
      overallGrade: (successRate > 0.7 ? 'A' : successRate > 0.6 ? 'B' : 'C') as
        | 'A'
        | 'B'
        | 'C'
        | 'D'
        | 'F',
      timestamp,
    };
  }) as PerformanceReview[];
}

/**
 * Create mock gap analysis result with specified gap count.
 */
function createMockGapAnalysis(gapCount: number, resolvedCount: number): GapAnalysisResult {
  const now = new Date();
  return {
    period: {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: now,
    },
    gaps: Array.from({ length: gapCount }, (_, i) => ({
      id: `gap-${i}`,
      description: `Knowledge gap ${i}`,
      context: 'Test context',
      frequency: 2,
      severity: 'MEDIUM' as const,
      suggestedFrameworks: ['Bayesian Reasoning'],
      suggestedSources: [],
      affectedMembers: [],
      priority: 5 - i,
      status: 'NEW' as const,
      createdAt: now,
    })),
    topGaps: [],
    gapsResolved: Array.from({ length: resolvedCount }, (_, i) => `resolved-gap-${i}`),
    recommendations: ['Improve bias awareness', 'Expand framework usage'],
    newSourceSuggestions: [],
    timestamp: now,
  } as GapAnalysisResult;
}

// =============================================================================
// Tests
// =============================================================================

describe('SelfAssessor', () => {
  let assessor: SelfAssessor;

  beforeEach(() => {
    assessor = new SelfAssessor();
  });

  describe('assess', () => {
    it('should generate valid SelfAssessment from current and previous reviews', () => {
      const currentReviews = createMockReviews(7, 0.7); // 1 week, 70% success
      const previousReviews = createMockReviews(7, 0.6); // 1 week, 60% success
      const currentGaps = createMockGapAnalysis(5, 2);
      const previousGaps = createMockGapAnalysis(7, 1);

      const result = assessor.assess({
        currentReviews,
        previousReviews,
        currentGaps,
        previousGaps,
      });

      // Basic structure validation
      expect(result).toBeDefined();
      expect(result.period).toBeDefined();
      expect(result.period.start).toBeInstanceOf(Date);
      expect(result.period.end).toBeInstanceOf(Date);
      expect(result.period.previousStart).toBeInstanceOf(Date);
      expect(result.period.previousEnd).toBeInstanceOf(Date);

      // Decision quality
      expect(result.decisionQuality.thisPeriod).toBeCloseTo(0.7, 5);
      expect(result.decisionQuality.lastPeriod).toBeCloseTo(0.6, 5);
      expect(result.decisionQuality.change).toBeCloseTo(0.1, 5);
      expect(result.decisionQuality.trend).toBe('IMPROVING');

      // Bias reduction (70% success = fewer biases than 60% success)
      expect(result.biasReduction.biasesThisPeriod).toBeLessThanOrEqual(
        result.biasReduction.biasesLastPeriod
      );
      expect(result.biasReduction.reduction).toBeGreaterThanOrEqual(0);
      expect(result.biasReduction.reductionPercentage).toBeGreaterThanOrEqual(0);

      // Knowledge growth
      expect(result.knowledgeGrowth.gapsResolved).toBe(2);

      // Framework effectiveness
      expect(result.frameworkEffectiveness).toBeInstanceOf(Array);
      expect(result.frameworkEffectiveness.length).toBeGreaterThan(0);
      expect(result.frameworkEffectiveness[0].framework).toBeDefined();
      expect(result.frameworkEffectiveness[0].pillar).toMatch(/LOGOS|ETHOS|PATHOS/);

      // Overall metrics
      expect(result.overallImprovement).toBeGreaterThan(0);
      expect(result.grade).toMatch(/A|B|C|D|F/);
      expect(result.gradeExplanation).toBeDefined();
      expect(result.strengths).toBeInstanceOf(Array);
      expect(result.weaknesses).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.nextMonthFocus).toBeInstanceOf(Array);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should detect improving performance', () => {
      const currentReviews = createMockReviews(7, 0.8); // 80% success
      const previousReviews = createMockReviews(7, 0.6); // 60% success

      const result = assessor.assess({
        currentReviews,
        previousReviews,
        currentGaps: null,
        previousGaps: null,
      });

      expect(result.decisionQuality.trend).toBe('IMPROVING');
      expect(result.decisionQuality.change).toBeCloseTo(0.2, 5);
      expect(result.overallImprovement).toBeGreaterThanOrEqual(0.09); // Allow for floating-point precision
      expect(['A', 'B']).toContain(result.grade);
      expect(result.strengths.length).toBeGreaterThan(0);
    });

    it('should detect declining performance', () => {
      const currentReviews = createMockReviews(7, 0.4); // 40% success
      const previousReviews = createMockReviews(7, 0.7); // 70% success

      const result = assessor.assess({
        currentReviews,
        previousReviews,
        currentGaps: null,
        previousGaps: null,
      });

      expect(result.decisionQuality.trend).toBe('DECLINING');
      expect(result.decisionQuality.change).toBeCloseTo(-0.3, 5);
      expect(result.overallImprovement).toBeLessThan(0);
      expect(['D', 'F']).toContain(result.grade);
      expect(result.weaknesses.length).toBeGreaterThan(0);
    });

    it('should detect stable performance', () => {
      const currentReviews = createMockReviews(7, 0.65); // 65% success
      const previousReviews = createMockReviews(7, 0.63); // 63% success

      const result = assessor.assess({
        currentReviews,
        previousReviews,
        currentGaps: null,
        previousGaps: null,
      });

      expect(result.decisionQuality.trend).toBe('STABLE');
      expect(Math.abs(result.decisionQuality.change)).toBeLessThan(0.05);
      expect(result.grade).toBe('C');
    });

    it('should handle first assessment with no previous data', () => {
      const currentReviews = createMockReviews(7, 0.7);

      const result = assessor.assess({
        currentReviews,
        previousReviews: [], // No previous data
        currentGaps: null,
        previousGaps: null,
      });

      expect(result.decisionQuality.thisPeriod).toBeCloseTo(0.7, 5);
      expect(result.decisionQuality.lastPeriod).toBe(0);
      expect(result.decisionQuality.change).toBeCloseTo(0.7, 5);
      expect(result.decisionQuality.trend).toBe('IMPROVING');
      expect(result.biasReduction.biasesLastPeriod).toBe(0);
      expect(result.biasReduction.reductionPercentage).toBe(0);
    });

    it('should calculate grade A for excellent improvement', () => {
      const currentReviews = createMockReviews(7, 0.9); // 90% success
      const previousReviews = createMockReviews(7, 0.6); // 60% success
      const currentGaps = createMockGapAnalysis(3, 5); // Resolved 5 gaps

      const result = assessor.assess({
        currentReviews,
        previousReviews,
        currentGaps,
        previousGaps: null,
      });

      expect(result.overallImprovement).toBeGreaterThan(0.15);
      expect(result.grade).toBe('A');
      expect(result.gradeExplanation).toContain('Outstanding');
    });

    it('should calculate grade B for good improvement', () => {
      const currentReviews = createMockReviews(7, 0.7); // 70% success
      const previousReviews = createMockReviews(7, 0.6); // 60% success

      const result = assessor.assess({
        currentReviews,
        previousReviews,
        currentGaps: null,
        previousGaps: null,
      });

      expect(result.overallImprovement).toBeGreaterThan(0.05);
      expect(result.overallImprovement).toBeLessThanOrEqual(0.15);
      expect(result.grade).toBe('B');
      expect(result.gradeExplanation).toContain('Good');
    });

    it('should calculate grade C for stable performance', () => {
      const currentReviews = createMockReviews(7, 0.65);
      const previousReviews = createMockReviews(7, 0.64);

      const result = assessor.assess({
        currentReviews,
        previousReviews,
        currentGaps: null,
        previousGaps: null,
      });

      expect(Math.abs(result.overallImprovement)).toBeLessThanOrEqual(0.05);
      expect(result.grade).toBe('C');
      expect(result.gradeExplanation).toContain('Stable');
    });

    it('should calculate grade D for minor decline', () => {
      const currentReviews = createMockReviews(7, 0.55);
      const previousReviews = createMockReviews(7, 0.65);

      const result = assessor.assess({
        currentReviews,
        previousReviews,
        currentGaps: null,
        previousGaps: null,
      });

      expect(result.overallImprovement).toBeGreaterThan(-0.15);
      expect(result.overallImprovement).toBeLessThanOrEqual(-0.05);
      expect(result.grade).toBe('D');
      expect(result.gradeExplanation).toContain('Declining');
    });

    it('should calculate grade F for critical decline', () => {
      const currentReviews = createMockReviews(7, 0.3);
      const previousReviews = createMockReviews(7, 0.7);

      const result = assessor.assess({
        currentReviews,
        previousReviews,
        currentGaps: null,
        previousGaps: null,
      });

      expect(result.overallImprovement).toBeLessThanOrEqual(-0.15);
      expect(result.grade).toBe('F');
      expect(result.gradeExplanation).toContain('Critical');
    });

    it('should identify most common bias', () => {
      const currentReviews = createMockReviews(7, 0.6);
      // Override bias data to test bias identification
      currentReviews.forEach((review) => {
        review.biasesDetected.byType = {
          CONFIRMATION_BIAS: 5,
          RECENCY_BIAS: 2,
          OVERCONFIDENCE: 1,
        } as Record<CognitiveBias, number>;
      });

      const result = assessor.assess({
        currentReviews,
        previousReviews: createMockReviews(7, 0.6),
        currentGaps: null,
        previousGaps: null,
      });

      expect(result.biasReduction.mostCommonBias).toBe('CONFIRMATION_BIAS');
    });

    it('should track framework effectiveness trends', () => {
      const currentReviews = createMockReviews(7, 0.75);
      const previousReviews = createMockReviews(7, 0.6);
      // Override framework data to test trend detection
      currentReviews.forEach((review) => {
        review.frameworkUsage = [
          { framework: 'Bayesian Reasoning', usageCount: 5, successRate: 0.8 },
          { framework: 'Expected Value Theory', usageCount: 3, successRate: 0.5 },
        ];
      });
      previousReviews.forEach((review) => {
        review.frameworkUsage = [
          { framework: 'Bayesian Reasoning', usageCount: 4, successRate: 0.6 },
          { framework: 'Expected Value Theory', usageCount: 3, successRate: 0.7 },
        ];
      });

      const result = assessor.assess({
        currentReviews,
        previousReviews,
        currentGaps: null,
        previousGaps: null,
      });

      const bayesian = result.frameworkEffectiveness.find(
        (fw) => fw.framework === 'Bayesian Reasoning'
      );
      const ev = result.frameworkEffectiveness.find(
        (fw) => fw.framework === 'Expected Value Theory'
      );

      expect(bayesian?.trend).toBe('IMPROVING'); // 0.6 → 0.8
      expect(ev?.trend).toBe('DECLINING'); // 0.7 → 0.5
    });

    it('should map frameworks to correct pillars', () => {
      const currentReviews = createMockReviews(7, 0.7);
      currentReviews.forEach((review) => {
        review.frameworkUsage = [
          { framework: 'Bayesian Reasoning', usageCount: 5, successRate: 0.8 },
          { framework: 'Bias Detection', usageCount: 3, successRate: 0.7 },
          { framework: 'CBT Reframing', usageCount: 2, successRate: 0.6 },
        ];
      });

      const result = assessor.assess({
        currentReviews,
        previousReviews: [],
        currentGaps: null,
        previousGaps: null,
      });

      const bayesian = result.frameworkEffectiveness.find(
        (fw) => fw.framework === 'Bayesian Reasoning'
      );
      const bias = result.frameworkEffectiveness.find(
        (fw) => fw.framework === 'Bias Detection'
      );
      const cbt = result.frameworkEffectiveness.find((fw) => fw.framework === 'CBT Reframing');

      expect(bayesian?.pillar).toBe('LOGOS');
      expect(bias?.pillar).toBe('ETHOS');
      expect(cbt?.pillar).toBe('PATHOS');
    });

    it('should provide actionable recommendations based on weaknesses', () => {
      const currentReviews = createMockReviews(7, 0.4); // Low success rate
      const previousReviews = createMockReviews(7, 0.7);

      const result = assessor.assess({
        currentReviews,
        previousReviews,
        currentGaps: null,
        previousGaps: null,
      });

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some((r) => r.includes('preparation'))).toBe(true);
      expect(result.nextMonthFocus.length).toBeGreaterThan(0);
    });

    it('should calculate learning velocity metrics', () => {
      const currentReviews = createMockReviews(14, 0.7); // 2 weeks

      const result = assessor.assess({
        currentReviews,
        previousReviews: [],
        currentGaps: null,
        previousGaps: null,
      });

      expect(result.learningVelocity.insightsPerWeek).toBeGreaterThan(0);
      expect(result.learningVelocity.retentionRate).toBe(0.7); // Same as success rate
    });

    it('should handle empty review lists gracefully', () => {
      const result = assessor.assess({
        currentReviews: [],
        previousReviews: [],
        currentGaps: null,
        previousGaps: null,
      });

      expect(result.decisionQuality.thisPeriod).toBe(0);
      expect(result.decisionQuality.lastPeriod).toBe(0);
      expect(result.decisionQuality.change).toBe(0);
      expect(result.decisionQuality.trend).toBe('STABLE');
      expect(result.biasReduction.biasesThisPeriod).toBe(0);
      expect(result.biasReduction.biasesLastPeriod).toBe(0);
      expect(result.grade).toBe('C'); // Stable, no change
    });
  });
});
