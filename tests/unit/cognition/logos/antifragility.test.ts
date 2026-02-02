import { describe, it, expect } from 'vitest';
import { assessAntifragility } from '../../../../src/cognition/logos/index.js';

describe('Antifragility Assessment', () => {
  describe('assessAntifragility', () => {
    it('should assess antifragility of an item', async () => {
      const result = await assessAntifragility(
        'Investment Portfolio',
        [
          { stressor: 'Market volatility', effect: 'neutral', magnitude: 0.5 },
          { stressor: 'Interest rate changes', effect: 'harms', magnitude: 0.3 },
          { stressor: 'Economic recession', effect: 'harms', magnitude: 0.7 },
        ]
      );

      expect(result).toBeDefined();
      expect(result.item).toBe('Investment Portfolio');
      expect(result.category).toBeDefined();
      expect(['fragile', 'robust', 'antifragile']).toContain(result.category);
    });

    it('should identify fragile items', async () => {
      const result = await assessAntifragility(
        'Single Stock Position',
        [
          { stressor: 'Company bankruptcy', effect: 'harms', magnitude: 0.9 },
          { stressor: 'Sector collapse', effect: 'harms', magnitude: 0.8 },
        ]
      );

      expect(result.category).toBe('fragile');
      expect(result.score).toBeLessThan(0);
    });

    it('should identify robust items', async () => {
      const result = await assessAntifragility(
        'Diversified Index Fund',
        [
          { stressor: 'Market volatility', effect: 'neutral', magnitude: 0.5 },
          { stressor: 'Single stock failure', effect: 'neutral', magnitude: 0.2 },
        ]
      );

      expect(result.category).toBe('robust');
      expect(result.score).toBeCloseTo(0, 1);
    });

    it('should identify antifragile items', async () => {
      const result = await assessAntifragility(
        'Barbell Strategy',
        [
          { stressor: 'Black swan event', effect: 'benefits', magnitude: 0.9 },
          { stressor: 'Market volatility', effect: 'benefits', magnitude: 0.7 },
        ]
      );

      expect(result.category).toBe('antifragile');
      expect(result.score).toBeGreaterThan(0.3);
    });

    it('should calculate optionality', async () => {
      const result = await assessAntifragility(
        'Options Strategy',
        [
          { stressor: 'Price movement', effect: 'benefits', magnitude: 0.6 },
        ]
      );

      expect(result.optionality).toBeDefined();
      expect(typeof result.optionality).toBe('object');
      expect(result.optionality.score).toBeDefined();
      expect(typeof result.optionality.score).toBe('number');
    });

    it('should calculate convexity', async () => {
      const result = await assessAntifragility(
        'Leveraged Position',
        [
          { stressor: 'Price increase', effect: 'benefits', magnitude: 0.8 },
          { stressor: 'Price decrease', effect: 'harms', magnitude: 0.8 },
        ]
      );

      expect(result.convexity).toBeDefined();
      expect(typeof result.convexity).toBe('object');
      expect(result.convexity.score).toBeDefined();
      expect(typeof result.convexity.score).toBe('number');
    });

    it('should analyze individual stressors', async () => {
      const result = await assessAntifragility(
        'Business Model',
        [
          { stressor: 'Competition', effect: 'harms', magnitude: 0.5 },
          { stressor: 'Market growth', effect: 'benefits', magnitude: 0.8 },
          { stressor: 'Regulation', effect: 'harms', magnitude: 0.4 },
        ]
      );

      expect(result.stressors).toBeDefined();
      expect(result.stressors.length).toBe(3);
      for (const stressor of result.stressors) {
        expect(stressor.stressor).toBeDefined();
        expect(['harms', 'neutral', 'benefits']).toContain(stressor.effect);
        expect(stressor.magnitude).toBeDefined();
      }
    });

    it('should provide recommendations', async () => {
      const result = await assessAntifragility(
        'Portfolio',
        [
          { stressor: 'Volatility', effect: 'harms', magnitude: 0.5 },
        ]
      );

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should include provenance information', async () => {
      const result = await assessAntifragility(
        'Test',
        [{ stressor: 'Test', effect: 'neutral', magnitude: 0.5 }]
      );

      expect(result.provenance).toBeDefined();
      expect(result.provenance.framework).toContain('Antifragility');
      expect(result.provenance.framework).toContain('Taleb');
      expect(result.provenance.computedAt).toBeDefined();
    });

    it('should handle benefits stressors', async () => {
      const result = await assessAntifragility(
        'High Upside Investment',
        [
          { stressor: 'Market crash', effect: 'benefits', magnitude: 0.9 },
          { stressor: 'Volatility spike', effect: 'benefits', magnitude: 0.8 },
        ]
      );

      expect(result.category).toBe('antifragile');
      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should handle harms stressors', async () => {
      const result = await assessAntifragility(
        'High Risk Investment',
        [
          { stressor: 'Market crash', effect: 'harms', magnitude: 0.9 },
          { stressor: 'Liquidity crisis', effect: 'harms', magnitude: 0.8 },
        ]
      );

      expect(result.category).toBe('fragile');
      expect(result.score).toBeLessThan(-0.3);
    });

    it('should calculate score between -1 and 1', async () => {
      const extremePositive = await assessAntifragility(
        'Maximum Antifragile',
        [
          { stressor: 'Any stress', effect: 'benefits', magnitude: 1.0 },
        ]
      );

      const extremeNegative = await assessAntifragility(
        'Maximum Fragile',
        [
          { stressor: 'Any stress', effect: 'harms', magnitude: 1.0 },
        ]
      );

      expect(extremePositive.score).toBeLessThanOrEqual(1);
      expect(extremeNegative.score).toBeGreaterThanOrEqual(-1);
    });

    it('should handle mixed stressors', async () => {
      const result = await assessAntifragility(
        'Mixed Exposure',
        [
          { stressor: 'Good stress', effect: 'benefits', magnitude: 0.5 },
          { stressor: 'Bad stress', effect: 'harms', magnitude: 0.5 },
        ]
      );

      // Should balance out to robust
      expect(result.category).toBe('robust');
      expect(Math.abs(result.score)).toBeLessThan(0.3);
    });
  });
});
