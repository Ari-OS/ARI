/**
 * Performance Review Tests
 *
 * Tests the PerformanceReviewer class:
 * - Decision stats calculation
 * - Expected value accuracy (calibration)
 * - Bias pattern analysis
 * - Emotional risk metrics
 * - Framework usage statistics
 * - Grade calculation
 * - Insight and recommendation generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { PerformanceReviewer } from '../../../../src/cognition/learning/performance-review.js';
import type { JournalEntry } from '../../../../src/cognition/learning/decision-journal.js';

// =============================================================================
// Helper Functions
// =============================================================================

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    decision: 'Test decision',
    frameworks_used: ['Bayesian Reasoning'],
    pillar: 'LOGOS',
    confidence: 0.8,
    outcome: 'pending',
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('PerformanceReviewer', () => {
  let reviewer: PerformanceReviewer;

  beforeEach(() => {
    reviewer = new PerformanceReviewer();
  });

  // ───────────────────────────────────────────────────────────────────────
  // Basic Functionality
  // ───────────────────────────────────────────────────────────────────────

  describe('generateReview', () => {
    it('should generate review from mixed entries', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'success', confidence: 0.9 }),
        makeEntry({ outcome: 'failure', confidence: 0.5 }),
        makeEntry({ outcome: 'partial', confidence: 0.7 }),
        makeEntry({ outcome: 'success', confidence: 0.8 }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.decisions.total).toBe(4);
      expect(review.decisions.successful).toBe(2);
      expect(review.decisions.failed).toBe(1);
      expect(review.decisions.partial).toBe(1);
      expect(review.decisions.successRate).toBe(0.5);
      expect(review.period.durationHours).toBe(24);
      expect(review.timestamp).toBeInstanceOf(Date);
    });

    it('should handle empty entries', () => {
      const review = reviewer.generateReview([], { hours: 24 });

      expect(review.decisions.total).toBe(0);
      expect(review.decisions.successRate).toBe(0);
      expect(review.expectedValueAccuracy.meanError).toBe(0);
      expect(review.biasesDetected.total).toBe(0);
      expect(review.overallGrade).toBe('F');
    });

    it('should set period correctly', () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const entries: JournalEntry[] = [
        makeEntry({ timestamp: hourAgo }),
        makeEntry({ timestamp: now }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.period.start).toEqual(hourAgo);
      expect(review.period.end).toEqual(now);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Decision Stats
  // ───────────────────────────────────────────────────────────────────────

  describe('decision stats', () => {
    it('should count outcomes correctly', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'success' }),
        makeEntry({ outcome: 'success' }),
        makeEntry({ outcome: 'failure' }),
        makeEntry({ outcome: 'partial' }),
        makeEntry({ outcome: 'pending' }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.decisions.total).toBe(5);
      expect(review.decisions.successful).toBe(2);
      expect(review.decisions.failed).toBe(1);
      expect(review.decisions.partial).toBe(1);
      expect(review.decisions.successRate).toBeCloseTo(0.4);
    });

    it('should calculate 100% success rate', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'success' }),
        makeEntry({ outcome: 'success' }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.decisions.successRate).toBe(1.0);
    });

    it('should calculate 0% success rate', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'failure' }),
        makeEntry({ outcome: 'partial' }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.decisions.successRate).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Expected Value Accuracy (Calibration)
  // ───────────────────────────────────────────────────────────────────────

  describe('expected value accuracy', () => {
    it('should detect overconfidence', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'failure', confidence: 0.9 }), // Overconfident
        makeEntry({ outcome: 'failure', confidence: 0.8 }), // Overconfident
        makeEntry({ outcome: 'success', confidence: 0.9 }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.expectedValueAccuracy.overconfidenceRate).toBeCloseTo(0.667, 2);
    });

    it('should detect underconfidence', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'success', confidence: 0.3 }), // Underconfident
        makeEntry({ outcome: 'success', confidence: 0.4 }), // Underconfident
        makeEntry({ outcome: 'failure', confidence: 0.3 }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.expectedValueAccuracy.underconfidenceRate).toBeCloseTo(0.667, 2);
    });

    it('should calculate calibration score', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'success', confidence: 0.8 }),
        makeEntry({ outcome: 'success', confidence: 0.8 }),
        makeEntry({ outcome: 'failure', confidence: 0.2 }),
        makeEntry({ outcome: 'failure', confidence: 0.2 }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      // Avg confidence: 0.5, success rate: 0.5 → perfect calibration
      expect(review.expectedValueAccuracy.calibration).toBeCloseTo(1.0, 1);
    });

    it('should calculate mean error', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'success', confidence: 0.9 }), // Error: 0.1
        makeEntry({ outcome: 'failure', confidence: 0.2 }), // Error: 0.2
        makeEntry({ outcome: 'success', confidence: 0.7 }), // Error: 0.3
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.expectedValueAccuracy.meanError).toBeCloseTo(0.2, 1);
    });

    it('should calculate RMSE', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'success', confidence: 0.9 }), // Error²: 0.01
        makeEntry({ outcome: 'failure', confidence: 0.2 }), // Error²: 0.04
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      // RMSE = sqrt((0.01 + 0.04) / 2) = sqrt(0.025) ≈ 0.158
      expect(review.expectedValueAccuracy.rmse).toBeCloseTo(0.158, 2);
    });

    it('should ignore pending outcomes', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'pending', confidence: 0.9 }),
        makeEntry({ outcome: 'pending', confidence: 0.1 }),
        makeEntry({ outcome: 'success', confidence: 0.8 }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      // Only the completed entry should affect metrics
      expect(review.expectedValueAccuracy.meanError).toBeCloseTo(0.2, 1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Bias Detection Patterns
  // ───────────────────────────────────────────────────────────────────────

  describe('bias detection patterns', () => {
    it('should count biases by type', () => {
      const entries: JournalEntry[] = [
        makeEntry({ biases_detected: ['CONFIRMATION_BIAS', 'OVERCONFIDENCE'] }),
        makeEntry({ biases_detected: ['CONFIRMATION_BIAS'] }),
        makeEntry({ biases_detected: ['RECENCY_BIAS', 'OVERCONFIDENCE'] }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.biasesDetected.total).toBe(5);
      expect(review.biasesDetected.byType['CONFIRMATION_BIAS']).toBe(2);
      expect(review.biasesDetected.byType['OVERCONFIDENCE']).toBe(2);
      expect(review.biasesDetected.byType['RECENCY_BIAS']).toBe(1);
    });

    it('should find most common bias', () => {
      const entries: JournalEntry[] = [
        makeEntry({ biases_detected: ['CONFIRMATION_BIAS'] }),
        makeEntry({ biases_detected: ['CONFIRMATION_BIAS'] }),
        makeEntry({ biases_detected: ['CONFIRMATION_BIAS'] }),
        makeEntry({ biases_detected: ['OVERCONFIDENCE'] }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.biasesDetected.mostCommon).toBe('CONFIRMATION_BIAS');
    });

    it('should handle entries with no biases', () => {
      const entries: JournalEntry[] = [
        makeEntry({}),
        makeEntry({ biases_detected: [] }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.biasesDetected.total).toBe(0);
      expect(review.biasesDetected.mostCommon).toBeUndefined();
    });

    it('should set trend as stable for single period', () => {
      const entries: JournalEntry[] = [
        makeEntry({ biases_detected: ['OVERCONFIDENCE'] }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.biasesDetected.trend).toBe('stable');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Emotional Risk Metrics
  // ───────────────────────────────────────────────────────────────────────

  describe('emotional risk metrics', () => {
    it('should calculate risk from negative valence and high arousal', () => {
      const entries: JournalEntry[] = [
        makeEntry({
          emotional_context: { valence: -0.8, arousal: 0.9, dominance: 0.5 },
        }), // Risk ≈ 0.81
        makeEntry({
          emotional_context: { valence: 0.5, arousal: 0.2, dominance: 0.7 },
        }), // Risk ≈ 0.05
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.emotionalRisk.avgRisk).toBeGreaterThan(0.3);
      expect(review.emotionalRisk.highRiskDecisions).toBe(1);
      expect(review.emotionalRisk.highRiskRate).toBe(0.5);
    });

    it('should identify high-risk decisions (risk > 0.6)', () => {
      const entries: JournalEntry[] = [
        makeEntry({
          emotional_context: { valence: -1.0, arousal: 1.0, dominance: 0.5 },
        }), // Risk = 1.0
        makeEntry({
          emotional_context: { valence: -0.5, arousal: 0.9, dominance: 0.5 },
        }), // Risk ≈ 0.675
        makeEntry({
          emotional_context: { valence: 0.8, arousal: 0.5, dominance: 0.8 },
        }), // Risk ≈ 0.05
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.emotionalRisk.highRiskDecisions).toBe(2);
      expect(review.emotionalRisk.highRiskRate).toBeCloseTo(0.667, 2);
    });

    it('should handle entries with no emotional context', () => {
      const entries: JournalEntry[] = [
        makeEntry({}),
        makeEntry({}),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.emotionalRisk.avgRisk).toBe(0);
      expect(review.emotionalRisk.highRiskDecisions).toBe(0);
      expect(review.emotionalRisk.highRiskRate).toBe(0);
    });

    it('should calculate avgRisk correctly', () => {
      const entries: JournalEntry[] = [
        makeEntry({
          emotional_context: { valence: 0, arousal: 0.6, dominance: 0.5 },
        }), // Risk = 0.3
        makeEntry({
          emotional_context: { valence: -1, arousal: 0.6, dominance: 0.5 },
        }), // Risk = 0.6
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.emotionalRisk.avgRisk).toBeCloseTo(0.45, 2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Framework Usage Statistics
  // ───────────────────────────────────────────────────────────────────────

  describe('framework usage statistics', () => {
    it('should count framework usage', () => {
      const entries: JournalEntry[] = [
        makeEntry({ frameworks_used: ['Bayesian Reasoning'], outcome: 'success' }),
        makeEntry({ frameworks_used: ['Bayesian Reasoning'], outcome: 'failure' }),
        makeEntry({ frameworks_used: ['Kelly Criterion'], outcome: 'success' }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      const bayesian = review.frameworkUsage.find((f) => f.framework === 'Bayesian Reasoning');
      expect(bayesian?.usageCount).toBe(2);
      expect(bayesian?.successRate).toBe(0.5);

      const kelly = review.frameworkUsage.find((f) => f.framework === 'Kelly Criterion');
      expect(kelly?.usageCount).toBe(1);
      expect(kelly?.successRate).toBe(1.0);
    });

    it('should handle multiple frameworks per entry', () => {
      const entries: JournalEntry[] = [
        makeEntry({
          frameworks_used: ['Bayesian Reasoning', 'Expected Value Theory'],
          outcome: 'success',
        }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.frameworkUsage).toHaveLength(2);
      expect(review.frameworkUsage.every((f) => f.successRate === 1.0)).toBe(true);
    });

    it('should calculate success rate per framework', () => {
      const entries: JournalEntry[] = [
        makeEntry({ frameworks_used: ['Framework A'], outcome: 'success' }),
        makeEntry({ frameworks_used: ['Framework A'], outcome: 'success' }),
        makeEntry({ frameworks_used: ['Framework A'], outcome: 'success' }),
        makeEntry({ frameworks_used: ['Framework A'], outcome: 'failure' }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      const frameworkA = review.frameworkUsage.find((f) => f.framework === 'Framework A');
      expect(frameworkA?.successRate).toBe(0.75);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Pattern Generation
  // ───────────────────────────────────────────────────────────────────────

  describe('pattern generation', () => {
    it('should generate pillar distribution patterns', () => {
      const entries: JournalEntry[] = [
        makeEntry({ pillar: 'LOGOS' }),
        makeEntry({ pillar: 'LOGOS' }),
        makeEntry({ pillar: 'ETHOS' }),
        makeEntry({ pillar: 'PATHOS' }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.patterns).toContain('50% of decisions used LOGOS frameworks');
      expect(review.patterns).toContain('25% of decisions used ETHOS frameworks');
      expect(review.patterns).toContain('25% of decisions used PATHOS frameworks');
    });

    it('should identify most active framework', () => {
      const entries: JournalEntry[] = [
        makeEntry({ frameworks_used: ['Bayesian Reasoning'] }),
        makeEntry({ frameworks_used: ['Bayesian Reasoning'] }),
        makeEntry({ frameworks_used: ['Bayesian Reasoning'] }),
        makeEntry({ frameworks_used: ['Kelly Criterion'] }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.patterns.some((p) => p.includes('Most active framework: Bayesian Reasoning (3 uses)'))).toBe(true);
    });

    it('should detect high emotional risk pattern', () => {
      const entries: JournalEntry[] = [
        makeEntry({
          emotional_context: { valence: -1, arousal: 1, dominance: 0.5 },
        }), // High risk
        makeEntry({
          emotional_context: { valence: -0.8, arousal: 0.9, dominance: 0.5 },
        }), // High risk
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.patterns.some((p) => p.includes('High emotional risk detected in 2 decisions'))).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Grade Calculation
  // ───────────────────────────────────────────────────────────────────────

  describe('grade calculation', () => {
    it('should award grade A for excellent performance', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'success', biases_detected: [], emotional_context: { valence: 0.8, arousal: 0.2, dominance: 0.8 } }),
        makeEntry({ outcome: 'success', biases_detected: [], emotional_context: { valence: 0.8, arousal: 0.2, dominance: 0.8 } }),
        makeEntry({ outcome: 'success', biases_detected: [], emotional_context: { valence: 0.8, arousal: 0.2, dominance: 0.8 } }),
        makeEntry({ outcome: 'success', biases_detected: ['OVERCONFIDENCE'], emotional_context: { valence: 0.8, arousal: 0.2, dominance: 0.8 } }),
        makeEntry({ outcome: 'success', biases_detected: [], emotional_context: { valence: 0.8, arousal: 0.2, dominance: 0.8 } }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.overallGrade).toBe('A');
    });

    it('should award grade B for good performance', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'success', biases_detected: ['CONFIRMATION_BIAS'] }),
        makeEntry({ outcome: 'success', biases_detected: ['OVERCONFIDENCE'] }),
        makeEntry({ outcome: 'failure', biases_detected: [] }),
        makeEntry({ outcome: 'success', biases_detected: ['RECENCY_BIAS'] }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.overallGrade).toBe('B');
    });

    it('should award grade C for acceptable performance', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'success' }),
        makeEntry({ outcome: 'success' }),
        makeEntry({ outcome: 'failure' }),
        makeEntry({ outcome: 'partial' }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.overallGrade).toBe('C');
    });

    it('should award grade D for below-acceptable performance', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'success' }),
        makeEntry({ outcome: 'failure' }),
        makeEntry({ outcome: 'failure' }),
        makeEntry({ outcome: 'failure' }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.overallGrade).toBe('D');
    });

    it('should award grade F for poor or no performance', () => {
      const entries: JournalEntry[] = [];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.overallGrade).toBe('F');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Insight Generation
  // ───────────────────────────────────────────────────────────────────────

  describe('insight generation', () => {
    it('should generate overconfidence insight', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'failure', confidence: 0.9 }),
        makeEntry({ outcome: 'failure', confidence: 0.9 }),
        makeEntry({ outcome: 'failure', confidence: 0.9 }),
        makeEntry({ outcome: 'success', confidence: 0.9 }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      const overconfidenceInsight = review.insights.find((i) => i.type === 'ANTIPATTERN');
      expect(overconfidenceInsight).toBeDefined();
      expect(overconfidenceInsight?.description).toContain('overconfidence');
    });

    it('should generate high bias warning', () => {
      const entries: JournalEntry[] = [
        makeEntry({ biases_detected: ['CONFIRMATION_BIAS', 'OVERCONFIDENCE'] }),
        makeEntry({ biases_detected: ['RECENCY_BIAS'] }),
        makeEntry({ biases_detected: ['LOSS_AVERSION'] }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      const biasInsight = review.insights.find((i) => i.type === 'WARNING');
      expect(biasInsight).toBeDefined();
      expect(biasInsight?.description).toContain('bias');
    });

    it('should include valid insight fields', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'failure', confidence: 0.9 }),
        makeEntry({ outcome: 'failure', confidence: 0.9 }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      if (review.insights.length > 0) {
        const insight = review.insights[0];
        expect(insight.id).toBeDefined();
        expect(insight.type).toBeDefined();
        expect(insight.description).toBeDefined();
        expect(insight.evidence).toBeInstanceOf(Array);
        expect(insight.actionable).toBeDefined();
        expect(insight.confidence).toBeGreaterThanOrEqual(0);
        expect(insight.confidence).toBeLessThanOrEqual(1);
        expect(insight.priority).toBeDefined();
        expect(insight.framework).toBeDefined();
        expect(insight.timestamp).toBeInstanceOf(Date);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Recommendation Generation
  // ───────────────────────────────────────────────────────────────────────

  describe('recommendation generation', () => {
    it('should recommend review for low success rate', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'failure' }),
        makeEntry({ outcome: 'failure' }),
        makeEntry({ outcome: 'failure' }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.recommendations.some((r) => r.includes('below baseline'))).toBe(true);
    });

    it('should celebrate high success rate', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'success' }),
        makeEntry({ outcome: 'success' }),
        makeEntry({ outcome: 'success' }),
        makeEntry({ outcome: 'success' }),
        makeEntry({ outcome: 'success' }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.recommendations.some((r) => r.includes('Excellent decision quality'))).toBe(true);
    });

    it('should recommend bias detection for overconfidence', () => {
      const entries: JournalEntry[] = [
        makeEntry({ outcome: 'failure', confidence: 0.9 }),
        makeEntry({ outcome: 'failure', confidence: 0.9 }),
        makeEntry({ outcome: 'failure', confidence: 0.9 }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.recommendations.some((r) => r.includes('Bias Detection'))).toBe(true);
    });

    it('should recommend cooling-off for high emotional risk', () => {
      const entries: JournalEntry[] = [
        makeEntry({
          emotional_context: { valence: -1, arousal: 1, dominance: 0.5 },
        }),
        makeEntry({
          emotional_context: { valence: -0.8, arousal: 0.9, dominance: 0.5 },
        }),
      ];

      const review = reviewer.generateReview(entries, { hours: 24 });

      expect(review.recommendations.some((r) => r.includes('cooling-off'))).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Factory Functions
  // ───────────────────────────────────────────────────────────────────────

  describe('factory functions', () => {
    it('should create reviewer instance', () => {
      const reviewer1 = new PerformanceReviewer();
      const reviewer2 = new PerformanceReviewer();

      expect(reviewer1).toBeInstanceOf(PerformanceReviewer);
      expect(reviewer2).toBeInstanceOf(PerformanceReviewer);
      expect(reviewer1).not.toBe(reviewer2);
    });
  });
});
