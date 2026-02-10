/**
 * Tests for Gap Analysis Engine
 */

import { describe, it, expect } from 'vitest';
import { GapAnalyzer } from '../../../../src/cognition/learning/gap-analysis.js';
import type {
  PerformanceReview,
  CognitiveBias,
} from '../../../../src/cognition/types.js';

/**
 * Helper to create a partial PerformanceReview for testing
 */
function makeReview(overrides: Record<string, unknown> = {}): PerformanceReview {
  return {
    period: {
      start: new Date('2026-02-01'),
      end: new Date('2026-02-02'),
      durationHours: 24,
    },
    decisions: {
      total: 10,
      successful: 7,
      failed: 2,
      partial: 1,
      successRate: 0.7,
    },
    biasesDetected: {
      total: 1,
      byType: {},
      trend: 'stable' as const,
    },
    frameworkUsage: [
      { framework: 'Bayesian Reasoning', usageCount: 5, successRate: 0.8 },
    ],
    emotionalRisk: {
      avgRisk: 0.3,
      highRiskDecisions: 1,
      highRiskRate: 0.1,
    },
    expectedValueAccuracy: {
      meanError: 0.2,
      rmse: 0.25,
      calibration: 0.8,
      overconfidenceRate: 0.1,
      underconfidenceRate: 0.05,
    },
    patterns: [],
    insights: [],
    recommendations: [],
    overallGrade: 'B' as const,
    timestamp: new Date('2026-02-02'),
    ...overrides,
  } as PerformanceReview;
}

describe('GapAnalyzer', () => {
  let analyzer: GapAnalyzer;

  beforeEach(() => {
    analyzer = new GapAnalyzer();
  });

  describe('analyzeGaps', () => {
    it('should handle empty reviews gracefully', () => {
      const result = analyzer.analyzeGaps([]);

      expect(result.gaps).toEqual([]);
      expect(result.topGaps).toEqual([]);
      expect(result.recommendations).toEqual([
        'Insufficient data for gap analysis',
      ]);
      expect(result.gapsResolved).toEqual([]);
      expect(result.newSourceSuggestions).toEqual([]);
    });

    it('should detect recurring biases', () => {
      const reviews = [
        makeReview({
          biasesDetected: {
            total: 3,
            byType: { CONFIRMATION_BIAS: 2, RECENCY_BIAS: 1 },
            trend: 'increasing' as const,
          },
          timestamp: new Date('2026-02-01'),
        }),
        makeReview({
          biasesDetected: {
            total: 2,
            byType: { CONFIRMATION_BIAS: 2 },
            trend: 'stable' as const,
          },
          timestamp: new Date('2026-02-02'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      const biasGap = result.gaps.find((g) =>
        g.description.includes('CONFIRMATION_BIAS')
      );

      expect(biasGap).toBeDefined();
      expect(biasGap?.frequency).toBe(4);
      expect(biasGap?.severity).toBe('MEDIUM');
      expect(biasGap?.suggestedFrameworks).toContain('Cognitive Bias Detection');
      expect(biasGap?.suggestedFrameworks).toContain('CBT Reframing');
    });

    it('should detect high-severity recurring biases', () => {
      const reviews = [
        makeReview({
          biasesDetected: {
            total: 6,
            byType: { OVERCONFIDENCE: 6 },
            trend: 'increasing' as const,
          },
          timestamp: new Date('2026-02-01'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      const biasGap = result.gaps.find((g) =>
        g.description.includes('OVERCONFIDENCE')
      );

      expect(biasGap).toBeDefined();
      expect(biasGap?.severity).toBe('HIGH');
      expect(biasGap?.priority).toBeGreaterThan(30); // HIGH (7) * 6
    });

    it('should detect low-success frameworks', () => {
      const reviews = [
        makeReview({
          frameworkUsage: [
            { framework: 'Kelly Criterion', usageCount: 3, successRate: 0.3 },
          ],
          timestamp: new Date('2026-02-01'),
        }),
        makeReview({
          frameworkUsage: [
            { framework: 'Kelly Criterion', usageCount: 2, successRate: 0.4 },
          ],
          timestamp: new Date('2026-02-02'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      const frameworkGap = result.gaps.find((g) =>
        g.description.includes('Kelly Criterion')
      );

      expect(frameworkGap).toBeDefined();
      expect(frameworkGap?.severity).toBe('MEDIUM');
      expect(frameworkGap?.context).toContain('success rate');
      expect(frameworkGap?.suggestedFrameworks).toContain('Kelly Criterion');
      expect(frameworkGap?.suggestedFrameworks).toContain('Deliberate Practice');
    });

    it('should not flag frameworks with insufficient usage', () => {
      const reviews = [
        makeReview({
          frameworkUsage: [
            { framework: 'Expected Value', usageCount: 1, successRate: 0.0 },
          ],
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      const frameworkGap = result.gaps.find((g) =>
        g.description.includes('Low success rate with framework: Expected Value')
      );

      expect(frameworkGap).toBeUndefined(); // < 3 uses, should not create gap
    });

    it('should detect underused frameworks', () => {
      const reviews = [
        makeReview({
          frameworkUsage: [
            { framework: 'Bayesian Reasoning', usageCount: 5, successRate: 0.8 },
          ],
          timestamp: new Date('2026-02-01'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      // Should detect multiple underused frameworks
      const underusedGaps = result.gaps.filter((g) =>
        g.description.includes('Underused framework')
      );

      expect(underusedGaps.length).toBeGreaterThan(0);

      // Check for specific frameworks
      const kellyGap = underusedGaps.find((g) =>
        g.description.includes('Kelly Criterion')
      );
      expect(kellyGap).toBeDefined();
      expect(kellyGap?.severity).toBe('LOW');
      expect(kellyGap?.priority).toBe(2);
    });

    it('should detect high emotional risk', () => {
      const reviews = [
        makeReview({
          emotionalRisk: {
            avgRisk: 0.6,
            highRiskDecisions: 5,
            highRiskRate: 0.5,
          },
          timestamp: new Date('2026-02-01'),
        }),
        makeReview({
          emotionalRisk: {
            avgRisk: 0.7,
            highRiskDecisions: 6,
            highRiskRate: 0.6,
          },
          timestamp: new Date('2026-02-02'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      const emotionalGap = result.gaps.find((g) =>
        g.description.includes('emotional risk')
      );

      expect(emotionalGap).toBeDefined();
      expect(emotionalGap?.severity).toBe('HIGH');
      expect(emotionalGap?.suggestedFrameworks).toContain('Emotional State');
      expect(emotionalGap?.suggestedFrameworks).toContain('CBT Reframing');
      expect(emotionalGap?.suggestedFrameworks).toContain('Discipline');
      expect(emotionalGap?.frequency).toBe(11); // 5 + 6
    });

    it('should detect declining performance', () => {
      const reviews = [
        makeReview({
          decisions: {
            total: 10,
            successful: 8,
            failed: 2,
            partial: 0,
            successRate: 0.8,
          },
          timestamp: new Date('2026-02-01'),
        }),
        makeReview({
          decisions: {
            total: 10,
            successful: 5,
            failed: 5,
            partial: 0,
            successRate: 0.5,
          },
          timestamp: new Date('2026-02-02'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      const decliningGap = result.gaps.find((g) =>
        g.description.includes('Declining decision quality')
      );

      expect(decliningGap).toBeDefined();
      expect(decliningGap?.severity).toBe('CRITICAL');
      expect(decliningGap?.priority).toBe(20); // CRITICAL (10) * 2 reviews
      expect(decliningGap?.context).toContain('80%');
      expect(decliningGap?.context).toContain('50%');
    });

    it('should not flag declining performance if still high', () => {
      const reviews = [
        makeReview({
          decisions: { total: 10, successful: 9, failed: 1, partial: 0, successRate: 0.9 },
          timestamp: new Date('2026-02-01'),
        }),
        makeReview({
          decisions: { total: 10, successful: 8, failed: 2, partial: 0, successRate: 0.8 },
          timestamp: new Date('2026-02-02'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      const decliningGap = result.gaps.find((g) =>
        g.description.includes('Declining decision quality')
      );

      expect(decliningGap).toBeUndefined(); // Still above 0.7 threshold
    });

    it('should sort gaps by priority descending', () => {
      const reviews = [
        makeReview({
          biasesDetected: {
            total: 7,
            byType: { OVERCONFIDENCE: 7 },
            trend: 'increasing' as const,
          },
          emotionalRisk: {
            avgRisk: 0.6,
            highRiskDecisions: 10,
            highRiskRate: 0.5,
          },
          frameworkUsage: [
            { framework: 'Kelly Criterion', usageCount: 3, successRate: 0.2 },
          ],
          timestamp: new Date('2026-02-01'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      // Should be sorted by priority
      for (let i = 1; i < result.gaps.length; i++) {
        expect(result.gaps[i - 1].priority).toBeGreaterThanOrEqual(
          result.gaps[i].priority
        );
      }
    });

    it('should limit topGaps to 5', () => {
      const reviews = [
        makeReview({
          biasesDetected: {
            total: 10,
            byType: {
              CONFIRMATION_BIAS: 2,
              RECENCY_BIAS: 2,
              OVERCONFIDENCE: 2,
              ANCHORING: 2,
              LOSS_AVERSION: 2,
            },
            trend: 'increasing' as const,
          },
          frameworkUsage: [
            { framework: 'Bayesian Reasoning', usageCount: 1, successRate: 0.5 },
          ],
          timestamp: new Date('2026-02-01'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      expect(result.topGaps.length).toBeLessThanOrEqual(5);
      expect(result.topGaps.length).toBeGreaterThan(0);
    });

    it('should generate recommendations for declining performance', () => {
      const reviews = [
        makeReview({
          decisions: {
            total: 10,
            successful: 8,
            failed: 2,
            partial: 0,
            successRate: 0.8,
          },
          timestamp: new Date('2026-02-01'),
        }),
        makeReview({
          decisions: {
            total: 10,
            successful: 5,
            failed: 5,
            partial: 0,
            successRate: 0.5,
          },
          timestamp: new Date('2026-02-02'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      expect(result.recommendations).toContain(
        'Urgent: Review and improve decision-making process'
      );
    });

    it('should generate recommendations for emotional risk', () => {
      const reviews = [
        makeReview({
          emotionalRisk: {
            avgRisk: 0.7,
            highRiskDecisions: 8,
            highRiskRate: 0.6,
          },
          timestamp: new Date('2026-02-01'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      expect(result.recommendations).toContain(
        'Practice emotional regulation before major decisions'
      );
    });

    it('should generate recommendations for recurring biases', () => {
      const reviews = [
        makeReview({
          biasesDetected: {
            total: 5,
            byType: { CONFIRMATION_BIAS: 5 },
            trend: 'increasing' as const,
          },
          timestamp: new Date('2026-02-01'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      expect(result.recommendations).toContain(
        'Run bias detection proactively on all significant decisions'
      );
    });

    it('should generate recommendations for underused frameworks', () => {
      const reviews = [
        makeReview({
          frameworkUsage: [
            { framework: 'Bayesian Reasoning', usageCount: 1, successRate: 0.8 },
          ],
          timestamp: new Date('2026-02-01'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      const diversifyRec = result.recommendations.find((r) =>
        r.includes('Diversify cognitive toolkit')
      );

      expect(diversifyRec).toBeDefined();
    });

    it('should set correct period from review timestamps', () => {
      const reviews = [
        makeReview({ timestamp: new Date('2026-02-01T10:00:00Z') }),
        makeReview({ timestamp: new Date('2026-02-03T15:00:00Z') }),
        makeReview({ timestamp: new Date('2026-02-02T12:00:00Z') }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      expect(result.period.start).toEqual(new Date('2026-02-01T10:00:00Z'));
      expect(result.period.end).toEqual(new Date('2026-02-03T15:00:00Z'));
    });

    it('should assign NEW status to all gaps', () => {
      const reviews = [
        makeReview({
          biasesDetected: {
            total: 5,
            byType: { CONFIRMATION_BIAS: 5 },
            trend: 'increasing' as const,
          },
          timestamp: new Date('2026-02-01'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      for (const gap of result.gaps) {
        expect(gap.status).toBe('NEW');
        expect(gap.createdAt).toBeInstanceOf(Date);
        expect(gap.resolvedAt).toBeUndefined();
      }
    });

    it('should assign unique IDs to all gaps', () => {
      const reviews = [
        makeReview({
          biasesDetected: {
            total: 10,
            byType: {
              CONFIRMATION_BIAS: 5,
              OVERCONFIDENCE: 5,
            },
            trend: 'increasing' as const,
          },
          timestamp: new Date('2026-02-01'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      const ids = result.gaps.map((g) => g.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should provide stable recommendations for good performance', () => {
      const reviews = [
        makeReview({
          decisions: {
            total: 10,
            successful: 9,
            failed: 1,
            partial: 0,
            successRate: 0.9,
          },
          biasesDetected: {
            total: 1,
            byType: { RECENCY_BIAS: 1 },
            trend: 'stable' as const,
          },
          emotionalRisk: {
            avgRisk: 0.2,
            highRiskDecisions: 0,
            highRiskRate: 0.0,
          },
          frameworkUsage: [
            { framework: 'Bayesian Reasoning', usageCount: 5, successRate: 0.9 },
            { framework: 'Expected Value', usageCount: 3, successRate: 0.85 },
          ],
          timestamp: new Date('2026-02-01'),
        }),
      ];

      const result = analyzer.analyzeGaps(reviews);

      // Should still have underused framework gaps (LOW severity)
      expect(result.gaps.length).toBeGreaterThan(0);

      // But recommendations should be positive or suggest diversification
      const hasPositiveRec = result.recommendations.some(
        (r) => r.includes('Continue') || r.includes('Diversify')
      );
      expect(hasPositiveRec).toBe(true);
    });
  });
});
