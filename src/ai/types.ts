import { z } from 'zod';
import type { AgentId, VoteOption, VoteThreshold, VetoDomain } from '../kernel/types.js';
import { AgentIdSchema, TrustLevelSchema } from '../kernel/types.js';
import { LLMProviderIdSchema } from './providers/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Model identifier — open string for multi-provider support.
 *
 * Previously z.enum([...claude models...]) — changed to open string
 * so any provider's models can be registered dynamically.
 */
export const ModelTierSchema = z.string().min(1);
export type ModelTier = string;

/**
 * Model capability categories.
 */
export const ModelCapabilitySchema = z.enum([
  'text', 'code', 'reasoning', 'vision', 'tools',
]);
export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;

/**
 * Complete model definition with capabilities and pricing.
 */
export const ModelDefinitionSchema = z.object({
  id: z.string().min(1),
  provider: LLMProviderIdSchema.default('anthropic'),
  apiModelId: z.string().min(1).optional(),
  quality: z.number().min(0).max(10),
  speed: z.number().min(0).max(10),
  costPer1MInput: z.number().min(0),
  costPer1MOutput: z.number().min(0),
  costPer1MCacheRead: z.number().min(0),
  costPer1MCacheWrite: z.number().min(0).default(0),
  maxContextTokens: z.number().positive(),
  maxOutputTokens: z.number().positive().optional(),
  supportsCaching: z.boolean(),
  isAvailable: z.boolean(),
  capabilities: z.array(ModelCapabilitySchema).default(['text']),
});
export type ModelDefinition = z.infer<typeof ModelDefinitionSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// TASK CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Task complexity levels for model selection.
 */
export const TaskComplexitySchema = z.enum([
  'trivial',
  'simple',
  'standard',
  'complex',
  'critical',
]);
export type TaskComplexity = z.infer<typeof TaskComplexitySchema>;

/**
 * Task categories for routing and token limit decisions.
 */
export const TaskCategorySchema = z.enum([
  'query',
  'summarize',
  'chat',
  'code_generation',
  'code_review',
  'analysis',
  'planning',
  'security',
  'heartbeat',
  'parse_command',
]);
export type TaskCategory = z.infer<typeof TaskCategorySchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// AI REQUEST / RESPONSE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Priority levels for AI requests.
 */
export const AIPrioritySchema = z.enum([
  'BACKGROUND',
  'STANDARD',
  'URGENT',
]);
export type AIPriority = z.infer<typeof AIPrioritySchema>;

/**
 * Full AI request with all routing metadata.
 */
export const AIRequestSchema = z.object({
  requestId: z.string().uuid().optional(),
  content: z.string().min(1),
  category: TaskCategorySchema,
  agent: AgentIdSchema.default('core'),
  trustLevel: TrustLevelSchema.default('system'),
  priority: AIPrioritySchema.default('STANDARD'),
  systemPrompt: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  enableCaching: z.boolean().default(true),
  maxTokens: z.number().positive().optional(),
  securitySensitive: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});
export type AIRequest = z.infer<typeof AIRequestSchema>;

/**
 * AI response with full execution metadata.
 */
export const AIResponseSchema = z.object({
  requestId: z.string().uuid(),
  content: z.string(),
  model: ModelTierSchema,
  inputTokens: z.number().nonnegative(),
  outputTokens: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  duration: z.number().nonnegative(),
  cached: z.boolean(),
  qualityScore: z.number().min(0).max(1),
  escalated: z.boolean(),
  escalationReason: z.string().optional(),
  governanceApproved: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type AIResponse = z.infer<typeof AIResponseSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// VALUE SCORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Input for ValueScore calculation.
 */
export const ValueScoreInputSchema = z.object({
  complexity: TaskComplexitySchema,
  stakes: z.number().min(0).max(10),
  qualityPriority: z.number().min(0).max(10),
  budgetPressure: z.number().min(0).max(10),
  historicalPerformance: z.number().min(0).max(10).default(5),
  securitySensitive: z.boolean().default(false),
  category: TaskCategorySchema,
});
export type ValueScoreInput = z.infer<typeof ValueScoreInputSchema>;

/**
 * Result of ValueScore calculation.
 */
export const ValueScoreResultSchema = z.object({
  score: z.number().min(0).max(100),
  recommendedTier: ModelTierSchema,
  weights: z.object({
    quality: z.number(),
    cost: z.number(),
    speed: z.number(),
  }),
  reasoning: z.string(),
});
export type ValueScoreResult = z.infer<typeof ValueScoreResultSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Circuit breaker states.
 */
export const CircuitStateSchema = z.enum(['CLOSED', 'OPEN', 'HALF_OPEN']);
export type CircuitState = z.infer<typeof CircuitStateSchema>;

/**
 * Circuit breaker configuration.
 */
export const CircuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().positive().default(5),
  failureWindowMs: z.number().positive().default(120_000),
  recoveryTimeoutMs: z.number().positive().default(60_000),
  halfOpenSuccessThreshold: z.number().positive().default(2),
});
export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// GOVERNANCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Voting mechanism used for governance decisions.
 */
export const VotingMechanismSchema = z.enum([
  'auto_approved',
  'simple_majority',
  'weighted_majority',
  'supermajority',
  'super_supermajority',
  'emergency',
]);
export type VotingMechanism = z.infer<typeof VotingMechanismSchema>;

/**
 * Result of a governance decision.
 */
export const GovernanceDecisionSchema = z.object({
  approved: z.boolean(),
  reason: z.string(),
  votingMechanism: VotingMechanismSchema,
  councilVoteId: z.string().optional(),
  vetoExercised: z.boolean().default(false),
  vetoAgent: AgentIdSchema.optional(),
  vetoDomain: z.string().optional(),
});
export type GovernanceDecision = z.infer<typeof GovernanceDecisionSchema>;

/**
 * Council interface for dependency injection.
 * Avoids direct import from governance layer (Layer 4).
 * The concrete Council is injected by the caller at Layer 5+.
 */
export interface CouncilInterface {
  createVote(request: {
    topic: string;
    description: string;
    threshold: VoteThreshold;
    deadline_minutes?: number;
    initiated_by: AgentId;
    domains?: VetoDomain[];
  }): { vote_id: string; status: string };

  castVote(
    voteId: string,
    agent: AgentId,
    option: VoteOption,
    reasoning: string,
  ): boolean;

  castVeto(
    voteId: string,
    agent: AgentId,
    domain: VetoDomain,
    reason: string,
    constitutionalRef?: string,
  ): boolean;

  closeVote(
    voteId: string,
    status: 'PASSED' | 'FAILED' | 'EXPIRED',
  ): void;
}

/**
 * Voting style for SOUL-influenced prediction.
 */
export const VotingStyleSchema = z.enum(['cautious', 'balanced', 'progressive']);
export type VotingStyle = z.infer<typeof VotingStyleSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE FLAGS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Feature flags for gradual rollout.
 */
export const AIFeatureFlagsSchema = z.object({
  AI_ORCHESTRATOR_ENABLED: z.boolean().default(false),
  AI_ORCHESTRATOR_ROLLOUT_PERCENT: z.number().min(0).max(100).default(0),
  AI_GOVERNANCE_ENABLED: z.boolean().default(false),
  AI_QUALITY_ESCALATION_ENABLED: z.boolean().default(false),
  AI_PROMPT_CACHING_ENABLED: z.boolean().default(true),
});
export type AIFeatureFlags = z.infer<typeof AIFeatureFlagsSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR STATUS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Orchestrator runtime status for monitoring.
 */
export const OrchestratorStatusSchema = z.object({
  enabled: z.boolean(),
  featureFlags: AIFeatureFlagsSchema,
  circuitBreakerState: CircuitStateSchema,
  totalRequests: z.number().nonnegative(),
  totalErrors: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
  averageLatencyMs: z.number().nonnegative(),
  modelUsage: z.record(z.number()),
  uptime: z.number().nonnegative(),
});
export type OrchestratorStatus = z.infer<typeof OrchestratorStatusSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// ROLLBACK METRICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sliding window metrics for automated rollback triggers.
 */
export const RollbackMetricsSchema = z.object({
  windowSize: z.number().positive().default(50),
  errorRate: z.number().min(0).max(1),
  p95LatencyMs: z.number().nonnegative(),
  avgCostPerRequest: z.number().nonnegative(),
  qualityFailureRate: z.number().min(0).max(1),
});
export type RollbackMetrics = z.infer<typeof RollbackMetricsSchema>;

/**
 * Thresholds that trigger automated rollback.
 */
export const RollbackThresholdsSchema = z.object({
  maxErrorRate: z.number().default(0.05),
  maxLatencyMultiplier: z.number().default(2.0),
  maxCostMultiplier: z.number().default(1.5),
  maxQualityFailureRate: z.number().default(0.10),
});
export type RollbackThresholds = z.infer<typeof RollbackThresholdsSchema>;
