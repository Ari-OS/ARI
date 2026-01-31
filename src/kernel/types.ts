import { z } from 'zod';
import { randomUUID } from 'crypto';

// ── Trust ────────────────────────────────────────────────────────────────────

export const TrustLevelSchema = z.enum(['system', 'operator', 'verified', 'standard', 'untrusted', 'hostile']);
export type TrustLevel = z.infer<typeof TrustLevelSchema>;

/** Numeric trust scores for risk calculations */
export const TRUST_SCORES: Record<TrustLevel, number> = {
  system: 1.0,
  operator: 0.9,
  verified: 0.7,
  standard: 0.5,
  untrusted: 0.2,
  hostile: 0.0,
};

// ── Source ────────────────────────────────────────────────────────────────────

export const SourceTypeSchema = z.enum(['operator', 'agent', 'external', 'system']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

// ── Agent Identity ───────────────────────────────────────────────────────────

export const AgentIdSchema = z.enum([
  'core', 'router', 'planner', 'executor', 'memory_manager', 'guardian',
  'arbiter', 'overseer', 'autonomous',
  'research', 'marketing', 'sales', 'content', 'seo',
  'build', 'development', 'client_comms',
]);
export type AgentId = z.infer<typeof AgentIdSchema>;

/** Agents eligible to vote in council decisions */
export const VOTING_AGENTS: readonly AgentId[] = [
  'router', 'planner', 'executor', 'memory_manager', 'guardian',
  'research', 'marketing', 'sales', 'content', 'seo',
  'build', 'development', 'client_comms',
] as const;

// ── Permissions ──────────────────────────────────────────────────────────────

export const PermissionTierSchema = z.enum(['READ_ONLY', 'WRITE_SAFE', 'WRITE_DESTRUCTIVE', 'ADMIN']);
export type PermissionTier = z.infer<typeof PermissionTierSchema>;

/** Numeric permission levels for comparison */
export const PERMISSION_LEVELS: Record<PermissionTier, number> = {
  READ_ONLY: 0,
  WRITE_SAFE: 1,
  WRITE_DESTRUCTIVE: 2,
  ADMIN: 3,
};

// Message schema
export const MessageSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  content: z.string(),
  source: TrustLevelSchema,
  timestamp: z.date().default(() => new Date()),
  metadata: z.record(z.unknown()).optional(),
});
export type Message = z.infer<typeof MessageSchema>;

// AuditEvent schema
export const AuditEventSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  timestamp: z.date().default(() => new Date()),
  action: z.string(),
  actor: z.string(),
  trustLevel: TrustLevelSchema,
  details: z.record(z.unknown()).optional(),
  hash: z.string(),
  previousHash: z.string(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// SecurityEvent schema
export const SecurityEventSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  timestamp: z.date().default(() => new Date()),
  eventType: z.enum(['injection_detected', 'trust_violation', 'unauthorized_access', 'chain_tamper', 'constitutional_violation']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  source: z.string(),
  details: z.record(z.unknown()),
  mitigated: z.boolean(),
});
export type SecurityEvent = z.infer<typeof SecurityEventSchema>;

// Config schema
export const ConfigSchema = z.object({
  version: z.string(),
  auditPath: z.string().default('~/.ari/audit.json'),
  gatewayPort: z.number().default(3141),
  trustDefaults: z.object({
    defaultLevel: TrustLevelSchema.default('untrusted'),
    allowEscalation: z.boolean().default(false),
  }),
});
export type Config = z.infer<typeof ConfigSchema>;

// SanitizeResult schema
export const SanitizeResultSchema = z.object({
  safe: z.boolean(),
  threats: z.array(z.object({
    pattern: z.string(),
    category: z.string(),
    severity: z.string(),
  })),
  sanitizedContent: z.string(),
  riskScore: z.number(),
});
export type SanitizeResult = z.infer<typeof SanitizeResultSchema>;

// ── Memory ───────────────────────────────────────────────────────────────────

export const MemoryTypeSchema = z.enum(['FACT', 'PREFERENCE', 'PATTERN', 'CONTEXT', 'DECISION', 'QUARANTINE']);
export type MemoryType = z.infer<typeof MemoryTypeSchema>;

export const MemoryPartitionSchema = z.enum(['PUBLIC', 'INTERNAL', 'SENSITIVE']);
export type MemoryPartition = z.infer<typeof MemoryPartitionSchema>;

export const MemoryEntrySchema = z.object({
  id: z.string().uuid(),
  type: MemoryTypeSchema,
  content: z.string(),
  provenance: z.object({
    source: z.string(),
    trust_level: TrustLevelSchema,
    agent: AgentIdSchema,
    chain: z.array(z.string()),
    request_id: z.string().optional(),
  }),
  confidence: z.number().min(0).max(1),
  partition: MemoryPartitionSchema,
  allowed_agents: z.array(AgentIdSchema),
  created_at: z.string(),
  expires_at: z.string().nullable(),
  verified_at: z.string().nullable(),
  verified_by: AgentIdSchema.nullable(),
  hash: z.string(),
  supersedes: z.string().nullable(),
});
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

// ── Governance / Voting ──────────────────────────────────────────────────────

export const VoteOptionSchema = z.enum(['APPROVE', 'REJECT', 'ABSTAIN']);
export type VoteOption = z.infer<typeof VoteOptionSchema>;

export const VoteThresholdSchema = z.enum(['MAJORITY', 'SUPERMAJORITY', 'UNANIMOUS']);
export type VoteThreshold = z.infer<typeof VoteThresholdSchema>;

export const VoteSchema = z.object({
  vote_id: z.string().uuid(),
  topic: z.string(),
  description: z.string(),
  threshold: VoteThresholdSchema,
  deadline: z.string(),
  votes: z.record(z.object({
    agent: AgentIdSchema,
    vote: VoteOptionSchema,
    reasoning: z.string(),
    timestamp: z.string(),
  })),
  status: z.enum(['OPEN', 'PASSED', 'FAILED', 'EXPIRED']),
  result: z.object({
    approve: z.number(),
    reject: z.number(),
    abstain: z.number(),
    threshold_met: z.boolean(),
  }).optional(),
});
export type Vote = z.infer<typeof VoteSchema>;

// ── Proposals ────────────────────────────────────────────────────────────

export const ProposalStatusSchema = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'VOTING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'EXECUTED',
  'REVERTED',
]);
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;

export const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

/** Map risk levels to required vote thresholds */
export const RISK_THRESHOLD_MAP: Record<RiskLevel, VoteThreshold> = {
  LOW: 'MAJORITY',
  MEDIUM: 'MAJORITY',
  HIGH: 'SUPERMAJORITY',
  CRITICAL: 'UNANIMOUS',
};

export const ProposalSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  status: ProposalStatusSchema,
  risk_level: RiskLevelSchema,
  proposed_by: AgentIdSchema,
  created_at: z.string(),
  expires_at: z.string(),
  vote_id: z.string().uuid().nullable(),
  execution_result: z.record(z.unknown()).nullable(),
  revert_reason: z.string().nullable(),
});
export type Proposal = z.infer<typeof ProposalSchema>;

// ── Tool Definition ──────────────────────────────────────────────────────────

export const ToolDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  permission_tier: PermissionTierSchema,
  required_trust_level: TrustLevelSchema,
  allowed_agents: z.array(AgentIdSchema),
  timeout_ms: z.number(),
  sandboxed: z.boolean(),
  parameters: z.record(z.object({
    type: z.string(),
    required: z.boolean(),
    description: z.string(),
  })),
});
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// ── Execution Layer Types ────────────────────────────────────────────────────

/**
 * Cryptographically signed authorization token for tool execution.
 * Issued by PolicyEngine, verified by ToolExecutor.
 * Single-use, time-bound, parameter-bound.
 */
export const ToolCallTokenSchema = z.object({
  token_id: z.string().uuid(),
  tool_id: z.string(),
  agent_id: AgentIdSchema,
  parameters: z.record(z.unknown()),
  parameters_hash: z.string(), // SHA-256 of parameters
  permission_tier: PermissionTierSchema,
  trust_level: TrustLevelSchema,
  approved_by: AgentIdSchema.nullable(), // null for auto-approved
  approval_reasoning: z.string().nullable(),
  issued_at: z.string(), // ISO timestamp
  expires_at: z.string(), // ISO timestamp (5 min TTL default)
  signature: z.string(), // HMAC-SHA256 signature
  used: z.boolean().default(false),
});
export type ToolCallToken = z.infer<typeof ToolCallTokenSchema>;

/**
 * Status of a permission request in the approval workflow.
 */
export const ApprovalStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'AUTO_APPROVED',
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

/**
 * Request for tool execution permission.
 */
export const PermissionRequestSchema = z.object({
  request_id: z.string().uuid(),
  tool_id: z.string(),
  agent_id: AgentIdSchema,
  parameters: z.record(z.unknown()),
  trust_level: TrustLevelSchema,
  requested_at: z.string(),
  status: ApprovalStatusSchema,
  resolved_at: z.string().nullable(),
  resolved_by: AgentIdSchema.nullable(),
  rejection_reason: z.string().nullable(),
});
export type PermissionRequest = z.infer<typeof PermissionRequestSchema>;

/**
 * Result of a PolicyEngine permission check.
 */
export const PermissionCheckResultSchema = z.object({
  allowed: z.boolean(),
  requires_approval: z.boolean(),
  reason: z.string(),
  risk_score: z.number().min(0).max(1),
  violations: z.array(z.string()),
});
export type PermissionCheckResult = z.infer<typeof PermissionCheckResultSchema>;

/**
 * Result of tool execution by ToolExecutor.
 */
export const ExecutionResultSchema = z.object({
  success: z.boolean(),
  tool_call_id: z.string(),
  token_id: z.string().nullable(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  duration_ms: z.number(),
  executed_at: z.string(),
});
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;

/**
 * Tool capability definition for ToolRegistry (stripped of policy).
 * Contains only technical details, no permission logic.
 */
export const ToolCapabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  timeout_ms: z.number(),
  sandboxed: z.boolean(),
  parameters: z.record(z.object({
    type: z.string(),
    required: z.boolean(),
    description: z.string(),
  })),
  handler: z.string().optional(), // Reference to handler function
});
export type ToolCapability = z.infer<typeof ToolCapabilitySchema>;

/**
 * Tool policy definition for PolicyEngine.
 * Contains only permission requirements.
 */
export const ToolPolicySchema = z.object({
  tool_id: z.string(),
  permission_tier: PermissionTierSchema,
  required_trust_level: TrustLevelSchema,
  allowed_agents: z.array(AgentIdSchema),
  rate_limit: z.number().optional(), // Max calls per hour
});
export type ToolPolicy = z.infer<typeof ToolPolicySchema>;
