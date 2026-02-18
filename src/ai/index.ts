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
  ModelCapability,
  TaskComplexity,
  TaskCategory,
  AIPriority,
  AIRequest,
  AIRequestInput,
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
  ModelCapabilitySchema,
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

// Provider types
export type {
  LLMProviderId,
  LLMProviderConfig,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMProvider,
  ProviderHealthStatus,
  ConnectionTestResult,
} from './providers/types.js';

export {
  LLMProviderIdSchema,
  LLMProviderConfigSchema,
  LLMCompletionRequestSchema,
} from './providers/types.js';

// Components
export { ModelRegistry } from './model-registry.js';
export { ProviderRegistry } from './provider-registry.js';
export { CascadeRouter } from './cascade-router.js';
export type { CascadeChain, CascadeStep } from './cascade-router.js';
export { ValueScorer } from './value-scorer.js';
export { CircuitBreaker } from './circuit-breaker.js';
export { ResponseEvaluator } from './response-evaluator.js';
export { PromptAssembler } from './prompt-assembler.js';
export { AIPolicyGovernor } from './ai-policy-governor.js';
export { AIOrchestrator } from './orchestrator.js';
export type { AIPolicyGovernorLike, OrchestratorConfig } from './orchestrator.js';

// Provider implementations
export { AnthropicProvider } from './providers/anthropic-provider.js';
export { OpenAIProvider } from './providers/openai-provider.js';
export { GoogleProvider } from './providers/google-provider.js';
export { XAIProvider } from './providers/xai-provider.js';

// Embedding service
export { EmbeddingService } from './embedding-service.js';
export type { EmbeddingResult, EmbeddingServiceOptions } from './embedding-service.js';
