import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateKellyFraction,
  assessRiskOfRuin,
} from '../../../../src/cognition/logos/index.js';

describe('Kelly Criterion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateKellyFraction', () => {
    it('should calculate correct Kelly fraction for positive edge', async () => {
      // Classic example: 60% win prob, 1:1 odds
      const result = await calculateKellyFraction({
        winProbability: 0.6,
        winAmount: 100,
        lossAmount: 100,
      });

      // Kelly = (0.6 * 1 - 0.4) / 1 = 0.2 = 20%
      expect(result.fullKelly).toBeCloseTo(0.2, 2);
      expect(result.halfKelly).toBeCloseTo(0.1, 2);
      expect(result.quarterKelly).toBeCloseTo(0.05, 2);
      expect(result.edge).toBeCloseTo(0.2, 2);
      expect(result.provenance.framework).toBe('Kelly Criterion (Kelly, 1956)');
    });

    it('should return zero fraction for negative edge', async () => {
      // 40% win prob, 1:1 odds = negative edge
      const result = await calculateKellyFraction({
        winProbability: 0.4,
        winAmount: 100,
        lossAmount: 100,
      });

      expect(result.fullKelly).toBe(0);
      expect(result.recommendedFraction).toBe(0);
      expect(result.recommendedStrategy).toBe('avoid');
      expect(result.edge).toBeLessThan(0);
      expect(result.warnings).toContain('CRITICAL: Negative or zero edge - do not bet');
    });

    it('should calculate Kelly for favorable odds', async () => {
      // 55% win prob, 2:1 payout ratio
      const result = await calculateKellyFraction({
        winProbability: 0.55,
        winAmount: 200,
        lossAmount: 100,
      });

      // b = 200/100 = 2
      // Kelly = (0.55 * 2 - 0.45) / 2 = (1.1 - 0.45) / 2 = 0.325
      expect(result.fullKelly).toBeCloseTo(0.325, 2);
      expect(result.odds).toBe(2);
      expect(result.edge).toBeGreaterThan(0);
    });

    it('should recommend half-Kelly for moderate fractions', async () => {
      // Set up a scenario with fullKelly between 0.15 and 0.30
      const result = await calculateKellyFraction({
        winProbability: 0.55,
        winAmount: 150,
        lossAmount: 100,
      });

      expect(result.recommendedStrategy).toBe('half');
      expect(result.recommendedFraction).toBe(result.halfKelly);
    });

    it('should recommend quarter-Kelly for high fractions', async () => {
      // High win prob leads to high Kelly
      const result = await calculateKellyFraction({
        winProbability: 0.7,
        winAmount: 200,
        lossAmount: 100,
      });

      // fullKelly should be > 0.3
      expect(result.fullKelly).toBeGreaterThan(0.3);
      expect(result.recommendedStrategy).toBe('quarter');
      expect(result.recommendedFraction).toBe(result.quarterKelly);
    });

    it('should recommend full Kelly for small fractions', async () => {
      // Small edge = small Kelly
      const result = await calculateKellyFraction({
        winProbability: 0.52,
        winAmount: 100,
        lossAmount: 100,
      });

      // Kelly = (0.52 * 1 - 0.48) / 1 = 0.04
      expect(result.fullKelly).toBeCloseTo(0.04, 2);
      expect(result.recommendedStrategy).toBe('full');
      expect(result.recommendedFraction).toBe(result.fullKelly);
    });

    it('should calculate dollar amount when capital provided', async () => {
      const result = await calculateKellyFraction({
        winProbability: 0.6,
        winAmount: 100,
        lossAmount: 100,
        currentCapital: 10000,
      });

      // The dollarAmount uses recommendedFraction, not fullKelly
      // Since fullKelly ~0.2 (>0.15), half-Kelly is recommended, so ~0.1 * 10000 = 1000
      expect(result.dollarAmount).toBeDefined();
      expect(result.dollarAmount).toBe(result.recommendedFraction * 10000);
    });

    it('should not include dollar amount when capital not provided', async () => {
      const result = await calculateKellyFraction({
        winProbability: 0.6,
        winAmount: 100,
        lossAmount: 100,
      });

      expect(result.dollarAmount).toBeUndefined();
    });

    it('should warn about high win probability (overconfidence)', async () => {
      const result = await calculateKellyFraction({
        winProbability: 0.85,
        winAmount: 100,
        lossAmount: 100,
      });

      expect(result.warnings).toContain('NOTE: High win probability may indicate overconfidence');
    });

    it('should warn about extremely aggressive full Kelly', async () => {
      const result = await calculateKellyFraction({
        winProbability: 0.75,
        winAmount: 300,
        lossAmount: 100,
      });

      expect(result.fullKelly).toBeGreaterThan(0.5);
      expect(result.warnings.some(w => w.includes('extremely aggressive'))).toBe(true);
    });

    it('should throw on invalid win probability (0)', async () => {
      await expect(
        calculateKellyFraction({
          winProbability: 0,
          winAmount: 100,
          lossAmount: 100,
        })
      ).rejects.toThrow('between 0 and 1');
    });

    it('should throw on invalid win probability (1)', async () => {
      await expect(
        calculateKellyFraction({
          winProbability: 1,
          winAmount: 100,
          lossAmount: 100,
        })
      ).rejects.toThrow('between 0 and 1');
    });

    it('should throw on invalid win probability (> 1)', async () => {
      await expect(
        calculateKellyFraction({
          winProbability: 1.5,
          winAmount: 100,
          lossAmount: 100,
        })
      ).rejects.toThrow('between 0 and 1');
    });

    it('should throw on negative win amount', async () => {
      await expect(
        calculateKellyFraction({
          winProbability: 0.6,
          winAmount: -100,
          lossAmount: 100,
        })
      ).rejects.toThrow('positive');
    });

    it('should throw on zero loss amount', async () => {
      await expect(
        calculateKellyFraction({
          winProbability: 0.6,
          winAmount: 100,
          lossAmount: 0,
        })
      ).rejects.toThrow('positive');
    });

    it('should calculate expected growth rate', async () => {
      const result = await calculateKellyFraction({
        winProbability: 0.6,
        winAmount: 100,
        lossAmount: 100,
      });

      // expectedGrowthRate should be positive for positive edge
      expect(result.expectedGrowthRate).toBeGreaterThan(0);
    });

    it('should have zero growth rate for negative edge', async () => {
      const result = await calculateKellyFraction({
        winProbability: 0.4,
        winAmount: 100,
        lossAmount: 100,
      });

      expect(result.expectedGrowthRate).toBe(0);
    });
  });

  describe('assessRiskOfRuin', () => {
    it('should return low risk of ruin for conservative Kelly', async () => {
      const result = await assessRiskOfRuin({
        kellyFraction: 0.05,
        winProbability: 0.55,
        winAmount: 100,
        lossAmount: 100,
      }, 1000); // Fewer iterations for speed

      expect(result.riskOfRuin).toBeLessThan(0.1);
      expect(result.medianEndingCapital).toBeGreaterThan(0);
    });

    it('should return higher risk for aggressive Kelly', async () => {
      const result = await assessRiskOfRuin({
        kellyFraction: 0.4,
        winProbability: 0.55,
        winAmount: 100,
        lossAmount: 100,
      }, 1000);

      // Aggressive Kelly has higher risk
      expect(result.riskOfRuin).toBeGreaterThan(0);
    });

    it('should have very high risk for overbetting', async () => {
      const result = await assessRiskOfRuin({
        kellyFraction: 0.8, // Way over Kelly
        winProbability: 0.55,
        winAmount: 100,
        lossAmount: 100,
      }, 500);

      expect(result.riskOfRuin).toBeGreaterThan(0.5);
    });

    it('should report percentile values', async () => {
      const result = await assessRiskOfRuin({
        kellyFraction: 0.1,
        winProbability: 0.55,
        winAmount: 100,
        lossAmount: 100,
      }, 1000);

      expect(result.percentile5).toBeDefined();
      expect(result.percentile95).toBeDefined();
      expect(result.percentile95).toBeGreaterThan(result.percentile5);
    });

    it('should report max drawdown', async () => {
      const result = await assessRiskOfRuin({
        kellyFraction: 0.2,
        winProbability: 0.55,
        winAmount: 100,
        lossAmount: 100,
      }, 1000);

      expect(result.maxDrawdown).toBeGreaterThan(0);
      expect(result.maxDrawdown).toBeLessThanOrEqual(1);
    });
  });

  describe('Kelly edge cases', () => {
    it('should handle break-even edge (zero)', async () => {
      const result = await calculateKellyFraction({
        winProbability: 0.5,
        winAmount: 100,
        lossAmount: 100,
      });

      expect(result.edge).toBe(0);
      expect(result.fullKelly).toBe(0);
      expect(result.recommendedStrategy).toBe('avoid');
    });

    it('should handle asymmetric odds correctly', async () => {
      // 40% win prob but 3:1 payout
      const result = await calculateKellyFraction({
        winProbability: 0.4,
        winAmount: 300,
        lossAmount: 100,
      });

      // b = 3, Kelly = (0.4 * 3 - 0.6) / 3 = 0.6/3 = 0.2
      expect(result.fullKelly).toBeCloseTo(0.2, 2);
      expect(result.edge).toBeGreaterThan(0);
    });

    it('should clamp Kelly to maximum of 1', async () => {
      // Edge case that might produce Kelly > 1
      const result = await calculateKellyFraction({
        winProbability: 0.95,
        winAmount: 1000,
        lossAmount: 100,
      });

      expect(result.fullKelly).toBeLessThanOrEqual(1);
    });
  });
});
