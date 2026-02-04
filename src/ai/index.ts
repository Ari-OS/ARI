/**
 * AI Orchestration Layer — Public API
 *
 * Layer 2 (System): Imports from Kernel (Layer 1) + Observability (Layer 2).
 * Consumed by Autonomous (Layer 5) + Integrations.
 *
 * Single entry point: AIOrchestrator.execute(request)
 */

// Types (re-export everything)
export type {
  ModelTier,
  ModelDefinition,
  TaskComplexity,
  TaskCategory,
  AIPriority,
  AIRequest,
  AIResponse,
  ValueScoreInput,
  ValueScoreResult,
  CircuitState,
  CircuitBreakerConfig,
  VotingMechanism,
  GovernanceDecision,
  CouncilInterface,
  VotingStyle,
  AIFeatureFlags,
  OrchestratorStatus,
  RollbackMetrics,
  RollbackThresholds,
} from './types.js';

export {
  ModelTierSchema,
  ModelDefinitionSchema,
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
  VotingStyleSchema,
  AIFeatureFlagsSchema,
  OrchestratorStatusSchema,
  RollbackMetricsSchema,
  RollbackThresholdsSchema,
} from './types.js';

// Components
export { ModelRegistry } from './model-registry.js';
export { ValueScorer } from './value-scorer.js';
export { CircuitBreaker } from './circuit-breaker.js';
export { ResponseEvaluator } from './response-evaluator.js';
export { PromptAssembler } from './prompt-assembler.js';
export { AIPolicyGovernor } from './ai-policy-governor.js';
export { AIOrchestrator } from './orchestrator.js';
export type { AIPolicyGovernorLike } from './orchestrator.js';
