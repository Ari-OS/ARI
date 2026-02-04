import { describe, it, expect } from 'vitest';
import {
  ModelTierSchema,
  TaskComplexitySchema,
  TaskCategorySchema,
  AIPrioritySchema,
  AIRequestSchema,
  AIResponseSchema,
  ValueScoreInputSchema,
  ValueScoreResultSchema,
  CircuitStateSchema,
  CircuitBreakerConfigSchema,
  VotingMechanismSchema,
  GovernanceDecisionSchema,
  AIFeatureFlagsSchema,
  OrchestratorStatusSchema,
  RollbackMetricsSchema,
  RollbackThresholdsSchema,
} from '../../../src/ai/types.js';

describe('AI Types — Zod Schemas', () => {
  describe('ModelTierSchema', () => {
    it('should accept valid model tiers', () => {
      expect(ModelTierSchema.parse('claude-opus-4.5')).toBe('claude-opus-4.5');
      expect(ModelTierSchema.parse('claude-sonnet-5')).toBe('claude-sonnet-5');
      expect(ModelTierSchema.parse('claude-sonnet-4')).toBe('claude-sonnet-4');
      expect(ModelTierSchema.parse('claude-haiku-4.5')).toBe('claude-haiku-4.5');
      expect(ModelTierSchema.parse('claude-haiku-3')).toBe('claude-haiku-3');
    });

    it('should reject invalid model tiers', () => {
      expect(() => ModelTierSchema.parse('gpt-4')).toThrow();
      expect(() => ModelTierSchema.parse('')).toThrow();
    });
  });

  describe('TaskComplexitySchema', () => {
    it('should accept valid complexities', () => {
      const values = ['trivial', 'simple', 'standard', 'complex', 'critical'];
      for (const v of values) {
        expect(TaskComplexitySchema.parse(v)).toBe(v);
      }
    });
  });

  describe('TaskCategorySchema', () => {
    it('should accept all 10 categories', () => {
      const categories = [
        'query', 'summarize', 'chat', 'code_generation', 'code_review',
        'analysis', 'planning', 'security', 'heartbeat', 'parse_command',
      ];
      for (const c of categories) {
        expect(TaskCategorySchema.parse(c)).toBe(c);
      }
    });
  });

  describe('AIPrioritySchema', () => {
    it('should accept valid priorities', () => {
      expect(AIPrioritySchema.parse('BACKGROUND')).toBe('BACKGROUND');
      expect(AIPrioritySchema.parse('STANDARD')).toBe('STANDARD');
      expect(AIPrioritySchema.parse('URGENT')).toBe('URGENT');
    });
  });

  describe('AIRequestSchema', () => {
    it('should parse minimal request with defaults', () => {
      const result = AIRequestSchema.parse({
        content: 'Hello',
        category: 'query',
      });
      expect(result.content).toBe('Hello');
      expect(result.category).toBe('query');
      expect(result.agent).toBe('core');
      expect(result.trustLevel).toBe('system');
      expect(result.priority).toBe('STANDARD');
      expect(result.enableCaching).toBe(true);
      expect(result.securitySensitive).toBe(false);
    });

    it('should parse full request', () => {
      const result = AIRequestSchema.parse({
        content: 'Review this code',
        category: 'code_review',
        agent: 'guardian',
        trustLevel: 'operator',
        priority: 'URGENT',
        enableCaching: false,
        securitySensitive: true,
        maxTokens: 2048,
        systemPrompt: 'You are a security expert',
      });
      expect(result.agent).toBe('guardian');
      expect(result.trustLevel).toBe('operator');
      expect(result.securitySensitive).toBe(true);
    });

    it('should reject empty content', () => {
      expect(() => AIRequestSchema.parse({
        content: '',
        category: 'query',
      })).toThrow();
    });
  });

  describe('AIResponseSchema', () => {
    it('should parse valid response', () => {
      const result = AIResponseSchema.parse({
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        content: 'Hello world',
        model: 'claude-sonnet-4',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.001,
        duration: 500,
        cached: false,
        qualityScore: 0.9,
        escalated: false,
      });
      expect(result.model).toBe('claude-sonnet-4');
      expect(result.qualityScore).toBe(0.9);
    });
  });

  describe('ValueScoreInputSchema', () => {
    it('should parse with defaults', () => {
      const result = ValueScoreInputSchema.parse({
        complexity: 'standard',
        stakes: 5,
        qualityPriority: 6,
        budgetPressure: 3,
        category: 'analysis',
      });
      expect(result.historicalPerformance).toBe(5);
      expect(result.securitySensitive).toBe(false);
    });
  });

  describe('CircuitBreakerConfigSchema', () => {
    it('should use defaults', () => {
      const result = CircuitBreakerConfigSchema.parse({});
      expect(result.failureThreshold).toBe(5);
      expect(result.failureWindowMs).toBe(120_000);
      expect(result.recoveryTimeoutMs).toBe(60_000);
      expect(result.halfOpenSuccessThreshold).toBe(2);
    });
  });

  describe('GovernanceDecisionSchema', () => {
    it('should parse approved decision', () => {
      const result = GovernanceDecisionSchema.parse({
        approved: true,
        reason: 'Auto-approved',
        votingMechanism: 'auto_approved',
        vetoExercised: false,
      });
      expect(result.approved).toBe(true);
      expect(result.vetoExercised).toBe(false);
    });

    it('should parse vetoed decision', () => {
      const result = GovernanceDecisionSchema.parse({
        approved: false,
        reason: 'MINT veto',
        votingMechanism: 'supermajority',
        vetoExercised: true,
        vetoAgent: 'wealth',
        vetoDomain: 'major_financial',
      });
      expect(result.vetoExercised).toBe(true);
      expect(result.vetoAgent).toBe('wealth');
    });
  });

  describe('AIFeatureFlagsSchema', () => {
    it('should use defaults', () => {
      const result = AIFeatureFlagsSchema.parse({});
      expect(result.AI_ORCHESTRATOR_ENABLED).toBe(false);
      expect(result.AI_ORCHESTRATOR_ROLLOUT_PERCENT).toBe(0);
      expect(result.AI_GOVERNANCE_ENABLED).toBe(false);
      expect(result.AI_QUALITY_ESCALATION_ENABLED).toBe(false);
      expect(result.AI_PROMPT_CACHING_ENABLED).toBe(true);
    });
  });

  describe('VotingMechanismSchema', () => {
    it('should accept all mechanisms', () => {
      const mechanisms = [
        'auto_approved', 'simple_majority', 'weighted_majority',
        'supermajority', 'super_supermajority', 'emergency',
      ];
      for (const m of mechanisms) {
        expect(VotingMechanismSchema.parse(m)).toBe(m);
      }
    });
  });

  describe('OrchestratorStatusSchema', () => {
    it('should parse valid status', () => {
      const result = OrchestratorStatusSchema.parse({
        enabled: true,
        featureFlags: {},
        circuitBreakerState: 'CLOSED',
        totalRequests: 100,
        totalErrors: 2,
        totalCost: 1.50,
        averageLatencyMs: 350,
        modelUsage: { 'claude-sonnet-4': 80, 'claude-haiku-4.5': 20 },
        uptime: 3600000,
      });
      expect(result.enabled).toBe(true);
      expect(result.circuitBreakerState).toBe('CLOSED');
    });
  });

  describe('CircuitStateSchema', () => {
    it('should accept valid states', () => {
      expect(CircuitStateSchema.parse('CLOSED')).toBe('CLOSED');
      expect(CircuitStateSchema.parse('OPEN')).toBe('OPEN');
      expect(CircuitStateSchema.parse('HALF_OPEN')).toBe('HALF_OPEN');
    });
  });

  describe('ValueScoreResultSchema', () => {
    it('should parse valid result', () => {
      const result = ValueScoreResultSchema.parse({
        score: 75,
        recommendedTier: 'claude-sonnet-4',
        weights: { quality: 0.4, cost: 0.2, speed: 0.15 },
        reasoning: 'Standard complexity task',
      });
      expect(result.score).toBe(75);
    });
  });

  describe('RollbackMetricsSchema', () => {
    it('should parse with defaults', () => {
      const result = RollbackMetricsSchema.parse({
        errorRate: 0.02,
        p95LatencyMs: 500,
        avgCostPerRequest: 0.005,
        qualityFailureRate: 0.05,
      });
      expect(result.windowSize).toBe(50);
    });
  });

  describe('RollbackThresholdsSchema', () => {
    it('should use defaults', () => {
      const result = RollbackThresholdsSchema.parse({});
      expect(result.maxErrorRate).toBe(0.05);
      expect(result.maxLatencyMultiplier).toBe(2.0);
      expect(result.maxCostMultiplier).toBe(1.5);
      expect(result.maxQualityFailureRate).toBe(0.10);
    });
  });
});
