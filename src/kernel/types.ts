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
  'arbiter', 'overseer',
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
  eventType: z.enum(['injection_detected', 'trust_violation', 'unauthorized_access', 'chain_tamper']),
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
