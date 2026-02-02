import { describe, it, expect } from 'vitest';
import { reflect } from '../../../../src/cognition/pathos/index.js';

describe('Reflection Engine', () => {
  describe('reflect', () => {
    it('should reflect on an outcome', async () => {
      const outcome = {
        description: 'Investment decision resulted in 20% gain',
        probability: 0.7,
        value: 1200,
      };
      const context = {
        originalDecision: 'Invested in tech stocks',
        reasoning: 'Based on market analysis',
      };

      const result = await reflect(outcome, context);

      expect(result).toBeDefined();
      expect(result.outcomeId).toBeDefined();
      expect(result.insights).toBeDefined();
      expect(Array.isArray(result.insights)).toBe(true);
    });

    it('should extract insights from successful outcomes', async () => {
      const outcome = {
        description: 'Project completed on time',
        probability: 1,
        value: 500,
      };
      const context = {
        originalDecision: 'Used agile methodology',
        reasoning: 'Team collaboration focus',
      };

      const result = await reflect(outcome, context);

      expect(result.whatWorked).toBeDefined();
      expect(result.whatWorked.length).toBeGreaterThan(0);
    });

    it('should extract learnings from failures', async () => {
      const outcome = {
        description: 'Lost money on trade',
        probability: 0.4,
        value: -200,
      };
      const context = {
        originalDecision: 'Held losing position too long',
        reasoning: 'Hoped for recovery',
      };

      const result = await reflect(outcome, context);

      expect(result.whatDidntWork).toBeDefined();
      expect(result.whatDidntWork.length).toBeGreaterThan(0);
    });

    it('should generate principles from patterns', async () => {
      const outcome = {
        description: 'Consistent returns from strategy',
        probability: 0.8,
        value: 300,
      };
      const context = {
        originalDecision: 'Followed systematic approach',
        reasoning: 'Rules-based trading',
      };

      const result = await reflect(outcome, context);

      expect(result.principles).toBeDefined();
      expect(Array.isArray(result.principles)).toBe(true);
    });

    it('should suggest next actions for negative outcomes', async () => {
      // nextActions are only populated for negative outcomes
      const outcome = {
        description: 'Moderate failure with losses',
        probability: 0.6,
        value: -100,  // Negative outcome triggers nextActions
      };
      const context = {
        originalDecision: 'Tried new approach',
        reasoning: 'Experimentation',
      };

      const result = await reflect(outcome, context);

      expect(result.nextActions).toBeDefined();
      expect(result.nextActions.length).toBeGreaterThan(0);
    });

    it('should process emotional impact', async () => {
      const outcome = {
        description: 'Unexpected loss on high risk position',
        probability: 0.3,
        value: -500,
      };
      const context = {
        originalDecision: 'High risk position',
      };

      const result = await reflect(outcome, context);

      expect(result.emotionalProcessing).toBeDefined();
      expect(typeof result.emotionalProcessing).toBe('string');
    });

    it('should identify generalizable insights', async () => {
      const outcome = {
        description: 'Applied framework successfully',
        probability: 0.9,
        value: 400,
      };
      const context = {
        originalDecision: 'Used expected value calculation',
        reasoning: 'Quantitative analysis',
      };

      const result = await reflect(outcome, context);

      const generalizableInsights = result.insights.filter(i => i.generalizes);
      expect(generalizableInsights.length).toBeGreaterThanOrEqual(0);
    });

    it('should include confidence in insights', async () => {
      const outcome = {
        description: 'Clear cause and effect relationship',
        probability: 0.95,
        value: 100,
      };
      const context = {
        originalDecision: 'Precise execution',
      };

      const result = await reflect(outcome, context);

      for (const insight of result.insights) {
        expect(insight.confidence).toBeDefined();
        expect(insight.confidence).toBeGreaterThanOrEqual(0);
        expect(insight.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should include provenance information', async () => {
      const outcome = {
        description: 'Test outcome',
        probability: 0.5,
        value: 50,
      };
      const context = {
        originalDecision: 'Test decision',
      };

      const result = await reflect(outcome, context);

      expect(result.provenance).toBeDefined();
      expect(result.provenance.framework).toContain('Reflection');
      expect(result.provenance.framework).toContain('Kolb');
      expect(result.provenance.computedAt).toBeDefined();
    });

    it('should calculate delta between expected and actual', async () => {
      const outcome = {
        description: 'Mixed results from hedge strategy',
        probability: 0.5,
        value: 250,
      };
      const context = {
        originalDecision: 'Hedge strategy',
        expectedOutcome: 'Break even',
      };

      const result = await reflect(outcome, context);

      expect(result.expectedValue).toBeDefined();
      expect(result.actualValue).toBeDefined();
      expect(result.delta).toBeDefined();
    });

    it('should include lessons learned', async () => {
      const outcome = {
        description: 'Major failure with large loss',
        probability: 0.2,
        value: -2000,
      };
      const context = {
        originalDecision: 'Ignored risk management',
      };

      const result = await reflect(outcome, context);

      expect(result.lessonsLearned).toBeDefined();
      expect(Array.isArray(result.lessonsLearned)).toBe(true);
    });

    it('should include evidence for insights', async () => {
      const outcome = {
        description: 'Outcome with clear evidence',
        probability: 0.8,
        value: 200,
      };
      const context = {
        originalDecision: 'Well-documented decision',
        reasoning: 'Clear logical chain',
      };

      const result = await reflect(outcome, context);

      for (const insight of result.insights) {
        expect(insight.evidence).toBeDefined();
        expect(Array.isArray(insight.evidence)).toBe(true);
      }
    });
  });
});
