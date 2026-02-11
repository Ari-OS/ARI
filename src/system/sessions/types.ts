import { z } from 'zod';
import { TrustLevelSchema } from '../../kernel/types.js';

/**
 * Session Types
 *
 * Sessions represent isolated conversation contexts within ARI.
 * Each session has its own memory partition, context, and state.
 */

// ── Session Status ──────────────────────────────────────────────────────────

export const SessionStatusSchema = z.enum(['active', 'idle', 'suspended', 'closed']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

// ── Session Metadata ────────────────────────────────────────────────────────

export const SessionMetadataSchema = z.object({
  /** User-provided name or title */
  name: z.string().optional(),
  /** Tags for categorization */
  tags: z.array(z.string()).default([]),
  /** Custom key-value pairs */
  custom: z.record(z.unknown()).default({}),
});
export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

// ── Session Context ─────────────────────────────────────────────────────────

export const SessionContextSchema = z.object({
  /** Active ARI context ID (venture/life) */
  contextId: z.string().optional(),
  /** Conversation history summary */
  summary: z.string().optional(),
  /** Current task or topic */
  currentTask: z.string().optional(),
  /** Active tool executions */
  activeTools: z.array(z.string()).default([]),
  /** Pending responses */
  pendingResponses: z.array(z.string()).default([]),
  /** Last processed message ID */
  lastMessageId: z.string().optional(),
});
export type SessionContext = z.infer<typeof SessionContextSchema>;

// ── Session Statistics ──────────────────────────────────────────────────────

export const SessionStatsSchema = z.object({
  /** Total messages in session */
  messageCount: z.number().default(0),
  /** Inbound message count */
  inboundCount: z.number().default(0),
  /** Outbound message count */
  outboundCount: z.number().default(0),
  /** Total tool executions */
  toolExecutions: z.number().default(0),
  /** Session duration in milliseconds */
  duration: z.number().default(0),
});
export type SessionStats = z.infer<typeof SessionStatsSchema>;

// ── Core Session Schema ─────────────────────────────────────────────────────

export const SessionSchema = z.object({
  /** Unique session identifier (UUID) */
  id: z.string().uuid(),

  /** Channel identifier (telegram, slack, etc.) */
  channel: z.string(),

  /** User identifier within the channel */
  senderId: z.string(),

  /** Group identifier for group chats (optional) */
  groupId: z.string().optional(),

  /** Session creation timestamp (ISO 8601) */
  createdAt: z.string().datetime(),

  /** Last activity timestamp (ISO 8601) */
  lastActivity: z.string().datetime(),

  /** Session context (isolated per session) */
  context: SessionContextSchema,

  /** Memory partition namespace for this session */
  memoryPartition: z.string(),

  /** Trust level for this session */
  trustLevel: TrustLevelSchema,

  /** Current session status */
  status: SessionStatusSchema,

  /** Session metadata */
  metadata: SessionMetadataSchema,

  /** Session statistics */
  stats: SessionStatsSchema,

  /** Session expiry timestamp (ISO 8601, optional) */
  expiresAt: z.string().datetime().optional(),

  /** Parent session ID (for forked sessions) */
  parentSessionId: z.string().uuid().optional(),
});

export type Session = z.infer<typeof SessionSchema>;

// ── Session Creation Input ──────────────────────────────────────────────────

export const CreateSessionInputSchema = z.object({
  channel: z.string(),
  senderId: z.string(),
  groupId: z.string().optional(),
  trustLevel: TrustLevelSchema.optional(),
  contextId: z.string().optional(),
  metadata: SessionMetadataSchema.partial().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;

// ── Session Update Input ────────────────────────────────────────────────────

export const UpdateSessionInputSchema = z.object({
  status: SessionStatusSchema.optional(),
  trustLevel: TrustLevelSchema.optional(),
  context: SessionContextSchema.partial().optional(),
  metadata: SessionMetadataSchema.partial().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type UpdateSessionInput = z.infer<typeof UpdateSessionInputSchema>;

// ── Session Query ───────────────────────────────────────────────────────────

export const SessionQuerySchema = z.object({
  channel: z.string().optional(),
  senderId: z.string().optional(),
  groupId: z.string().optional(),
  status: SessionStatusSchema.optional(),
  trustLevel: TrustLevelSchema.optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  activeAfter: z.string().datetime().optional(),
  limit: z.number().positive().optional(),
  offset: z.number().nonnegative().optional(),
});

export type SessionQuery = z.infer<typeof SessionQuerySchema>;

// ── Session Events ──────────────────────────────────────────────────────────

export interface SessionEvent {
  sessionId: string;
  timestamp: Date;
  type: 'created' | 'updated' | 'activity' | 'suspended' | 'resumed' | 'closed' | 'expired';
  details?: Record<string, unknown>;
}

// ── Session Lifecycle Config ────────────────────────────────────────────────

export interface SessionLifecycleConfig {
  /** Idle timeout before session becomes idle (ms, default: 5 minutes) */
  idleTimeout: number;
  /** Suspend timeout for idle sessions (ms, default: 30 minutes) */
  suspendTimeout: number;
  /** Close timeout for suspended sessions (ms, default: 24 hours) */
  closeTimeout: number;
  /** Maximum sessions per sender (default: 10) */
  maxSessionsPerSender: number;
  /** Maximum total sessions (default: 1000) */
  maxTotalSessions: number;
  /** Cleanup interval (ms, default: 1 minute) */
  cleanupInterval: number;
}

export const DEFAULT_SESSION_LIFECYCLE_CONFIG: SessionLifecycleConfig = {
  idleTimeout: 5 * 60 * 1000,         // 5 minutes
  suspendTimeout: 30 * 60 * 1000,     // 30 minutes
  closeTimeout: 24 * 60 * 60 * 1000,  // 24 hours
  maxSessionsPerSender: 10,
  maxTotalSessions: 1000,
  cleanupInterval: 60 * 1000,          // 1 minute
};

// ── Composite Session Key ───────────────────────────────────────────────────

/**
 * Creates a composite key for session lookup
 * Format: channel:senderId[:groupId]
 */
export function createSessionKey(channel: string, senderId: string, groupId?: string): string {
  return groupId ? `${channel}:${senderId}:${groupId}` : `${channel}:${senderId}`;
}

/**
 * Parses a composite session key
 */
export function parseSessionKey(key: string): { channel: string; senderId: string; groupId?: string } {
  const parts = key.split(':');
  return {
    channel: parts[0],
    senderId: parts[1],
    groupId: parts[2],
  };
}
