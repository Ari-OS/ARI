import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  updateBelief,
  updateBeliefSequential,
  calculatePosterior,
} from '../../../../src/cognition/logos/index.js';

describe('Bayesian Reasoning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculatePosterior', () => {
    it('should calculate correct posterior with positive evidence', async () => {
      // Prior: 50% belief in hypothesis
      // Evidence strongly supports hypothesis (likelihood ratio 4)
      const result = await updateBelief(
        { hypothesis: 'Market will rise', priorProbability: 0.5 },
        { description: 'Strong earnings report', likelihoodRatio: 4, strength: 'strong' }
      );

      // With LR=4 and prior=0.5, posterior should be ~0.8
      expect(result.posteriorProbability).toBeGreaterThan(0.7);
      expect(result.shift).toBeGreaterThan(0);
      expect(result.provenance.framework).toBe('Bayesian Reasoning (Bayes, 1763)');
    });

    it('should decrease probability with contradicting evidence', async () => {
      const result = await updateBelief(
        { hypothesis: 'Project will succeed', priorProbability: 0.7 },
        { description: 'Key team member left', likelihoodRatio: 0.3, strength: 'moderate' }
      );

      expect(result.posteriorProbability).toBeLessThan(0.7);
      expect(result.shift).toBeLessThan(0);
    });

    it('should handle weak evidence with minimal shift', async () => {
      const result = await updateBelief(
        { hypothesis: 'Hypothesis X', priorProbability: 0.5 },
        { description: 'Minor observation', likelihoodRatio: 1.1, strength: 'weak' }
      );

      expect(Math.abs(result.shift)).toBeLessThan(0.1);
    });

    it('should throw on invalid prior probability', async () => {
      await expect(
        updateBelief(
          { hypothesis: 'Test', priorProbability: 1.5 }, // Invalid: > 1
          { description: 'Evidence', likelihoodRatio: 2, strength: 'moderate' }
        )
      ).rejects.toThrow();
    });

    it('should throw on negative prior probability', async () => {
      await expect(
        updateBelief(
          { hypothesis: 'Test', priorProbability: -0.1 }, // Invalid: < 0
          { description: 'Evidence', likelihoodRatio: 2, strength: 'moderate' }
        )
      ).rejects.toThrow();
    });

    it('should clamp posterior to valid range', async () => {
      // Very strong evidence should not push posterior above 0.999
      const result = await updateBelief(
        { hypothesis: 'Near certainty', priorProbability: 0.95 },
        { description: 'Extremely strong evidence', likelihoodRatio: 100, strength: 'strong' }
      );

      expect(result.posteriorProbability).toBeLessThanOrEqual(0.999);
    });
  });

  describe('updateBeliefSequential', () => {
    it('should correctly update with multiple pieces of evidence', async () => {
      const result = await updateBeliefSequential(
        { hypothesis: 'Investment opportunity', priorProbability: 0.3 },
        [
          { description: 'Positive market research', likelihoodRatio: 2, strength: 'moderate' },
          { description: 'Competitor analysis favorable', likelihoodRatio: 1.5, strength: 'moderate' },
          { description: 'Team evaluation strong', likelihoodRatio: 1.8, strength: 'strong' },
        ]
      );

      // Multiple positive evidence should significantly increase posterior
      expect(result.posteriorProbability).toBeGreaterThan(0.5);
      expect(result.evidenceUsed).toHaveLength(3);
      expect(result.shift).toBeGreaterThan(0.2);
    });

    it('should handle empty evidence array', async () => {
      const result = await updateBeliefSequential(
        { hypothesis: 'No evidence case', priorProbability: 0.5 },
        []
      );

      expect(result.posteriorProbability).toBe(0.5);
      expect(result.shift).toBe(0);
      expect(result.interpretation).toContain('No evidence');
    });

    it('should track cumulative shift correctly', async () => {
      const result = await updateBeliefSequential(
        { hypothesis: 'Cumulative test', priorProbability: 0.5 },
        [
          { description: 'Evidence 1', likelihoodRatio: 2, strength: 'moderate' },
          { description: 'Evidence 2', likelihoodRatio: 0.5, strength: 'moderate' }, // Counteracting
        ]
      );

      // Counteracting evidence should result in smaller net shift
      expect(Math.abs(result.shift)).toBeLessThan(0.3);
    });

    it('should maintain confidence bounds', async () => {
      const result = await updateBeliefSequential(
        { hypothesis: 'Confidence test', priorProbability: 0.5 },
        [
          { description: 'Strong evidence', likelihoodRatio: 5, strength: 'strong' },
          { description: 'More strong evidence', likelihoodRatio: 5, strength: 'strong' },
        ]
      );

      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('interpretation generation', () => {
    it('should generate appropriate interpretation for strong supporting evidence', async () => {
      const result = await updateBelief(
        { hypothesis: 'Strong support test', priorProbability: 0.3 },
        { description: 'Major positive indicator', likelihoodRatio: 10, strength: 'strong' }
      );

      expect(result.interpretation.toLowerCase()).toMatch(/strong|significant|supporting/);
    });

    it('should generate appropriate interpretation for contradicting evidence', async () => {
      const result = await updateBelief(
        { hypothesis: 'Contradiction test', priorProbability: 0.7 },
        { description: 'Major negative indicator', likelihoodRatio: 0.1, strength: 'strong' }
      );

      expect(result.interpretation.toLowerCase()).toMatch(/contra|decreas|negative/);
    });

    it('should generate appropriate interpretation for minimal impact', async () => {
      const result = await updateBelief(
        { hypothesis: 'Minimal impact test', priorProbability: 0.5 },
        { description: 'Neutral evidence', likelihoodRatio: 1.02, strength: 'weak' }
      );

      expect(result.interpretation.toLowerCase()).toMatch(/minimal|minor|little/);
    });
  });
});
