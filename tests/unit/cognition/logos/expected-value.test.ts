import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateExpectedValue,
  rankDecisions,
} from '../../../../src/cognition/logos/index.js';

describe('Expected Value Theory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateExpectedValue', () => {
    it('should calculate correct EV for simple two-outcome decision', async () => {
      // 50% chance of winning $100, 50% chance of losing $50
      const result = await calculateExpectedValue({
        description: 'Simple bet',
        outcomes: [
          { description: 'Win', probability: 0.5, value: 100 },
          { description: 'Lose', probability: 0.5, value: -50 },
        ],
      });

      // EV = 0.5 * 100 + 0.5 * (-50) = 50 - 25 = 25
      expect(result.expectedValue).toBe(25);
      // Recommendation depends on CV - may be CAUTION if high volatility
      expect(['PROCEED', 'CAUTION']).toContain(result.recommendation);
      expect(result.provenance.framework).toBe('Expected Value Theory');
    });

    it('should calculate negative EV correctly', async () => {
      // 30% chance of winning $50, 70% chance of losing $30
      const result = await calculateExpectedValue({
        description: 'Bad bet',
        outcomes: [
          { description: 'Win', probability: 0.3, value: 50 },
          { description: 'Lose', probability: 0.7, value: -30 },
        ],
      });

      // EV = 0.3 * 50 + 0.7 * (-30) = 15 - 21 = -6
      expect(result.expectedValue).toBe(-6);
      expect(result.recommendation).toBe('AVOID');
    });

    it('should calculate variance and standard deviation', async () => {
      const result = await calculateExpectedValue({
        description: 'High variance decision',
        outcomes: [
          { description: 'Big win', probability: 0.2, value: 1000 },
          { description: 'Small win', probability: 0.3, value: 100 },
          { description: 'Break even', probability: 0.3, value: 0 },
          { description: 'Lose', probability: 0.2, value: -500 },
        ],
      });

      // EV = 0.2*1000 + 0.3*100 + 0.3*0 + 0.2*(-500) = 200 + 30 + 0 - 100 = 130
      expect(result.expectedValue).toBe(130);
      expect(result.variance).toBeGreaterThan(0);
      expect(result.standardDeviation).toBeGreaterThan(0);
      expect(result.standardDeviation).toBe(Math.sqrt(result.variance));
    });

    it('should identify best and worst cases', async () => {
      const result = await calculateExpectedValue({
        description: 'Multiple outcomes',
        outcomes: [
          { description: 'Great', probability: 0.1, value: 1000 },
          { description: 'Good', probability: 0.4, value: 200 },
          { description: 'Okay', probability: 0.3, value: 50 },
          { description: 'Bad', probability: 0.2, value: -100 },
        ],
      });

      expect(result.bestCase.value).toBe(1000);
      expect(result.bestCase.description).toBe('Great');
      expect(result.worstCase.value).toBe(-100);
      expect(result.worstCase.description).toBe('Bad');
    });

    it('should identify most likely case', async () => {
      const result = await calculateExpectedValue({
        description: 'Clear most likely',
        outcomes: [
          { description: 'Unlikely', probability: 0.1, value: 1000 },
          { description: 'Most likely', probability: 0.7, value: 50 },
          { description: 'Less likely', probability: 0.2, value: -20 },
        ],
      });

      expect(result.mostLikelyCase.description).toBe('Most likely');
      expect(result.mostLikelyCase.probability).toBe(0.7);
    });

    it('should throw if outcomes array is empty', async () => {
      await expect(
        calculateExpectedValue({
          description: 'No outcomes',
          outcomes: [],
        })
      ).rejects.toThrow('at least one outcome');
    });

    it('should throw if probabilities do not sum to 1', async () => {
      await expect(
        calculateExpectedValue({
          description: 'Bad probabilities',
          outcomes: [
            { description: 'A', probability: 0.3, value: 100 },
            { description: 'B', probability: 0.3, value: 50 },
            // Sum = 0.6, not 1.0
          ],
        })
      ).rejects.toThrow('sum to 1.0');
    });

    it('should allow small rounding errors in probability sum', async () => {
      // Sum = 1.0 within tolerance
      const result = await calculateExpectedValue({
        description: 'Slight rounding',
        outcomes: [
          { description: 'A', probability: 0.333, value: 100 },
          { description: 'B', probability: 0.333, value: 50 },
          { description: 'C', probability: 0.334, value: -25 },
        ],
      });

      // EV = 0.333*100 + 0.333*50 + 0.334*(-25) = 33.3 + 16.65 - 8.35 = 41.6
      expect(result.expectedValue).toBeCloseTo(41.6, 1);
    });

    it('should recommend CAUTION for positive EV with high volatility', async () => {
      const result = await calculateExpectedValue({
        description: 'High variance positive',
        outcomes: [
          { description: 'Jackpot', probability: 0.01, value: 10000 },
          { description: 'Lose', probability: 0.99, value: -50 },
        ],
      });

      // EV = 0.01*10000 + 0.99*(-50) = 100 - 49.5 = 50.5 (positive)
      // But very high CV due to huge variance
      expect(result.expectedValue).toBeCloseTo(50.5, 1);
      expect(result.recommendation).toBe('CAUTION');
    });

    it('should include reasoning explanations', async () => {
      const result = await calculateExpectedValue({
        description: 'Good opportunity',
        outcomes: [
          { description: 'Success', probability: 0.6, value: 200 },
          { description: 'Failure', probability: 0.4, value: -50 },
        ],
      });

      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning.some(r => r.toLowerCase().includes('expected value'))).toBe(true);
    });

    it('should calculate coefficient of variation', async () => {
      const result = await calculateExpectedValue({
        description: 'CV test',
        outcomes: [
          { description: 'Win', probability: 0.5, value: 100 },
          { description: 'Lose', probability: 0.5, value: 0 },
        ],
      });

      // EV = 50, need to verify CV is calculated
      expect(result.coefficientOfVariation).toBeDefined();
      expect(typeof result.coefficientOfVariation).toBe('number');
    });
  });

  describe('rankDecisions', () => {
    it('should rank multiple decisions by EV', async () => {
      const decisions = [
        {
          description: 'Medium bet',
          outcomes: [
            { description: 'Win', probability: 0.5, value: 100 },
            { description: 'Lose', probability: 0.5, value: -50 },
          ],
        },
        {
          description: 'Best bet',
          outcomes: [
            { description: 'Win', probability: 0.8, value: 100 },
            { description: 'Lose', probability: 0.2, value: -20 },
          ],
        },
        {
          description: 'Worst bet',
          outcomes: [
            { description: 'Win', probability: 0.2, value: 50 },
            { description: 'Lose', probability: 0.8, value: -40 },
          ],
        },
      ];

      const ranked = await rankDecisions(decisions);

      expect(ranked).toHaveLength(3);
      expect(ranked[0].rank).toBe(1);
      expect(ranked[0].decision).toBe('Best bet');
      expect(ranked[1].rank).toBe(2);
      expect(ranked[1].decision).toBe('Medium bet');
      expect(ranked[2].rank).toBe(3);
      expect(ranked[2].decision).toBe('Worst bet');
    });

    it('should handle single decision', async () => {
      const ranked = await rankDecisions([
        {
          description: 'Only option',
          outcomes: [
            { description: 'Win', probability: 0.5, value: 100 },
            { description: 'Lose', probability: 0.5, value: -50 },
          ],
        },
      ]);

      expect(ranked).toHaveLength(1);
      expect(ranked[0].rank).toBe(1);
    });

    it('should handle empty decisions array', async () => {
      const ranked = await rankDecisions([]);
      expect(ranked).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero EV decision', async () => {
      const result = await calculateExpectedValue({
        description: 'Break even',
        outcomes: [
          { description: 'Win', probability: 0.5, value: 100 },
          { description: 'Lose', probability: 0.5, value: -100 },
        ],
      });

      expect(result.expectedValue).toBe(0);
      expect(result.recommendation).toBe('AVOID');
    });

    it('should handle all-positive outcomes', async () => {
      const result = await calculateExpectedValue({
        description: 'Sure win',
        outcomes: [
          { description: 'Big win', probability: 0.3, value: 100 },
          { description: 'Small win', probability: 0.7, value: 20 },
        ],
      });

      expect(result.expectedValue).toBeGreaterThan(0);
      expect(result.worstCase.value).toBe(20);
    });

    it('should handle single outcome (certainty)', async () => {
      const result = await calculateExpectedValue({
        description: 'Certain outcome',
        outcomes: [
          { description: 'Result', probability: 1.0, value: 42 },
        ],
      });

      expect(result.expectedValue).toBe(42);
      expect(result.variance).toBe(0);
      expect(result.standardDeviation).toBe(0);
    });
  });
});
