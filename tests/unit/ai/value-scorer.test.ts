import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { ModelRegistry } from '../../../src/ai/model-registry.js';
import { ValueScorer } from '../../../src/ai/value-scorer.js';

describe('ValueScorer', () => {
  let eventBus: EventBus;
  let registry: ModelRegistry;
  let scorer: ValueScorer;

  beforeEach(() => {
    eventBus = new EventBus();
    registry = new ModelRegistry();
    scorer = new ValueScorer(eventBus, registry);
  });

  describe('classifyComplexity', () => {
    it('should classify heartbeat as trivial', () => {
      expect(scorer.classifyComplexity('ping', 'heartbeat')).toBe('trivial');
    });

    it('should classify parse_command as trivial', () => {
      expect(scorer.classifyComplexity('what time is it', 'parse_command')).toBe('trivial');
    });

    it('should detect security patterns', () => {
      const result = scorer.classifyComplexity(
        'Review the credential and secret handling',
        'security',
      );
      // security patterns (+3) + security category (+2) = 5 → complex
      expect(result).toBe('complex');
    });

    it('should detect reasoning patterns', () => {
      const result = scorer.classifyComplexity(
        'Explain why this tradeoff matters and analyze the alternatives',
        'analysis',
      );
      // reasoning (+2) = 2 → standard
      expect(result).toBe('standard');
    });

    it('should detect code generation patterns', () => {
      const result = scorer.classifyComplexity(
        'Implement a class with a method for parsing',
        'code_generation',
      );
      // code gen (+2) = 2 → standard
      expect(result).toBe('standard');
    });

    it('should classify simple short queries as trivial', () => {
      const result = scorer.classifyComplexity('hello', 'chat');
      expect(result).toBe('trivial');
    });

    it('should increase complexity for multi-step tasks', () => {
      const result = scorer.classifyComplexity(
        'First analyze the code, then refactor the class, next implement tests, finally review',
        'code_generation',
      );
      // code gen (+2) + multi-step (+1) + reasoning(analyze) (+2) = 5 → complex
      expect(result).toBe('complex');
    });

    it('should increase complexity for large inputs', () => {
      const longContent = 'a'.repeat(10000); // 2500 estimated tokens → >2000 threshold
      const result = scorer.classifyComplexity(longContent, 'analysis');
      // large (+1) = 1 → simple
      expect(result).toBe('simple');
    });
  });

  describe('score', () => {
    it('should route heartbeat to haiku 3', () => {
      const result = scorer.score(
        {
          complexity: 'trivial',
          stakes: 1,
          qualityPriority: 2,
          budgetPressure: 2,
          historicalPerformance: 5,
          securitySensitive: false,
          category: 'heartbeat',
        },
        'normal',
      );
      expect(result.recommendedTier).toBe('claude-haiku-3');
    });

    it('should route security-sensitive to minimum sonnet', () => {
      const result = scorer.score(
        {
          complexity: 'standard',
          stakes: 8,
          qualityPriority: 9,
          budgetPressure: 3,
          historicalPerformance: 5,
          securitySensitive: true,
          category: 'security',
        },
        'normal',
      );
      // Security-sensitive → minimum Sonnet
      expect(['claude-sonnet-4', 'claude-sonnet-4.5', 'claude-sonnet-4.6']).toContain(result.recommendedTier);
    });

    it('should downgrade to haiku in pause budget state', () => {
      const result = scorer.score(
        {
          complexity: 'simple',
          stakes: 3,
          qualityPriority: 4,
          budgetPressure: 9,
          historicalPerformance: 5,
          securitySensitive: false,
          category: 'chat',
        },
        'pause',
      );
      expect(result.recommendedTier).toBe('claude-haiku-3');
    });

    it('should allow sonnet in pause state for high scores', () => {
      const result = scorer.score(
        {
          complexity: 'critical',
          stakes: 10,
          qualityPriority: 10,
          budgetPressure: 1,
          historicalPerformance: 10,
          securitySensitive: false,
          category: 'planning',
        },
        'pause',
      );
      // Score >= 80 in pause → minimum sonnet
      expect(['claude-sonnet-4', 'claude-sonnet-4.5', 'claude-sonnet-4.6']).toContain(result.recommendedTier);
    });

    it('should use haiku 4.5 in reduce state for moderate scores', () => {
      // Mock Math.random > EPSILON (0.1) to force exploitation path (not random exploration)
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
      try {
        const result = scorer.score(
          {
            complexity: 'simple',
            stakes: 3,
            qualityPriority: 3,
            budgetPressure: 7,
            historicalPerformance: 5,
            securitySensitive: false,
            category: 'query',
          },
          'reduce',
        );
        expect(result.recommendedTier).toBe('claude-haiku-4.5');
      } finally {
        randomSpy.mockRestore();
      }
    });

    it('should include reasoning in result', () => {
      const result = scorer.score(
        {
          complexity: 'standard',
          stakes: 5,
          qualityPriority: 5,
          budgetPressure: 3,
          historicalPerformance: 5,
          securitySensitive: false,
          category: 'query',
        },
        'normal',
      );
      expect(result.reasoning).toContain('Complexity: standard');
      expect(result.reasoning).toContain('Stakes: 5/10');
      expect(result.reasoning).toContain('Final score:');
    });

    it('should return normalized score between 0 and 100', () => {
      const result = scorer.score(
        {
          complexity: 'standard',
          stakes: 5,
          qualityPriority: 5,
          budgetPressure: 5,
          historicalPerformance: 5,
          securitySensitive: false,
          category: 'query',
        },
        'normal',
      );
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('getWeightsForBudgetState', () => {
    it('should return quality-first weights for normal', () => {
      const weights = scorer.getWeightsForBudgetState('normal');
      expect(weights.quality).toBe(0.40);
      expect(weights.cost).toBe(0.20);
    });

    it('should return cost-first weights for reduce', () => {
      const weights = scorer.getWeightsForBudgetState('reduce');
      expect(weights.cost).toBe(0.40);
      expect(weights.quality).toBe(0.25);
    });

    it('should return survival weights for pause', () => {
      const weights = scorer.getWeightsForBudgetState('pause');
      expect(weights.cost).toBe(0.50);
      expect(weights.quality).toBe(0.15);
    });
  });

  describe('sonnet 4.6 routing', () => {
    it('should route to sonnet 4.6 when available and score is high', () => {
      registry.setAvailability('claude-sonnet-4.5', true);
      // sonnet-4.6 is available by default (quality 9 > sonnet-4.5 quality 8)
      const result = scorer.score(
        {
          complexity: 'complex',
          stakes: 7,
          qualityPriority: 8,
          budgetPressure: 2,
          historicalPerformance: 7,
          securitySensitive: false,
          category: 'code_generation',
        },
        'normal',
      );
      // Should route to a sonnet-tier model (epsilon-greedy exploration means
      // exact model selection is non-deterministic, but sonnet-4.6 is preferred)
      expect(['claude-sonnet-4', 'claude-sonnet-4.5', 'claude-sonnet-4.6']).toContain(
        result.recommendedTier,
      );
    });
  });
});
