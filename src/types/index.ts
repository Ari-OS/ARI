/**
 * ARI vNext — Core Type Definitions
 *
 * All types, schemas, and validation for the system.
 * Uses Zod for runtime validation with TypeScript inference.
 *
 * @module types
 * @version 1.0.0
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const ChannelSchema = z.enum([
  'cli',
  'sms',
  'whatsapp',
  'telegram',
  'email',
  'web',
  'api',
  'internal',
]);
export type Channel = z.infer<typeof ChannelSchema>;

export const TrustLevelSchema = z.enum(['self', 'allowlisted', 'untrusted']);
export type TrustLevel = z.infer<typeof TrustLevelSchema>;

export const AuditActionSchema = z.enum([
  'gateway_start',
  'gateway_stop',
  'session_connect',
  'session_disconnect',
  'message_received',
  'message_sanitized',
  'message_rate_limited',
  'suspicious_pattern_detected',
  'config_loaded',
  'config_changed',
  'health_check',
  'audit_verified',
  'audit_verification_failed',
  'system_error',
  'daemon_installed',
  'daemon_uninstalled',
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const EventTypeSchema = z.enum([
  'message.received',
  'message.sanitized',
  'message.processed',
  'session.connected',
  'session.disconnected',
  'health.check',
  'audit.entry',
  'system.error',
  'system.shutdown',
]);
export type EventType = z.infer<typeof EventTypeSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const AttachmentSchema = z.object({
  type: z.string().max(256),
  url: z.string().url().optional(),
  name: z.string().max(512).optional(),
  size_bytes: z.number().int().nonnegative().optional(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const InboundMessageSchema = z.object({
  channel: ChannelSchema,
  sender: z.string().min(1).max(512),
  timestamp: z.string().datetime(),
  content: z.string(),
  attachments: z.array(AttachmentSchema).optional(),
  source_trust_level: TrustLevelSchema,
  correlation_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type InboundMessage = z.infer<typeof InboundMessageSchema>;

export const SanitizationFlagsSchema = z.object({
  size_truncated: z.boolean(),
  rate_limited: z.boolean(),
  encoding_fixed: z.boolean(),
  control_chars_stripped: z.boolean(),
  suspicious_patterns: z.array(z.string()),
  original_size_bytes: z.number().int().nonnegative(),
  final_size_bytes: z.number().int().nonnegative(),
  processing_time_ms: z.number().nonnegative(),
});
export type SanitizationFlags = z.infer<typeof SanitizationFlagsSchema>;

export const SanitizedMessageSchema = z.object({
  message_id: z.string().uuid(),
  original: InboundMessageSchema,
  sanitized_content: z.string(),
  flags: SanitizationFlagsSchema,
  sanitized_at: z.string().datetime(),
});
export type SanitizedMessage = z.infer<typeof SanitizedMessageSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const AuditActorSchema = z.object({
  type: z.enum(['system', 'operator', 'sender', 'service']),
  id: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
});
export type AuditActor = z.infer<typeof AuditActorSchema>;

export const AuditEntrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  action: AuditActionSchema,
  actor: AuditActorSchema,
  details: z.record(z.string(), z.unknown()),
  prev_hash: z.string(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

// ═══════════════════════════════════════════════════════════════════════════
// GATEWAY PROTOCOL SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const ClientMessageTypeSchema = z.enum([
  'ping',
  'inbound_message',
  'sessions_list',
  'health',
  'subscribe',
  'unsubscribe',
]);
export type ClientMessageType = z.infer<typeof ClientMessageTypeSchema>;

export const ServerMessageTypeSchema = z.enum([
  'pong',
  'ack',
  'sessions',
  'health_status',
  'error',
  'event',
]);
export type ServerMessageType = z.infer<typeof ServerMessageTypeSchema>;

export const ClientMessageSchema = z.object({
  type: ClientMessageTypeSchema,
  id: z.string().optional(),
  payload: z.unknown().optional(),
});
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const ServerMessageSchema = z.object({
  type: ServerMessageTypeSchema,
  id: z.string().optional(),
  request_id: z.string().optional(),
  payload: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
});
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export const HealthStatusSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string(),
  uptime_seconds: z.number().nonnegative(),
  connections: z.number().int().nonnegative(),
  audit_sequence: z.number().int(),
  last_message_at: z.string().datetime().nullable(),
  checks: z.record(
    z.string(),
    z.object({
      status: z.enum(['pass', 'fail', 'warn']),
      message: z.string().optional(),
    }),
  ),
});
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const SessionInfoSchema = z.object({
  id: z.string().uuid(),
  connected_at: z.string().datetime(),
  last_activity: z.string().datetime(),
  messages_received: z.number().int().nonnegative(),
  subscriptions: z.array(z.string()),
});
export type SessionInfo = z.infer<typeof SessionInfoSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT REFINER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const RefinedPromptSchema = z.object({
  refined_text: z.string(),
  intent_guess: z.string(),
  constraints_guess: z.array(z.string()),
  questions_if_needed: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  metadata: z.object({
    original_length: z.number().int().nonnegative(),
    refined_length: z.number().int().nonnegative(),
    processing_time_ms: z.number().nonnegative(),
    patterns_detected: z.array(z.string()),
  }),
});
export type RefinedPrompt = z.infer<typeof RefinedPromptSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const ConfigSchema = z.object({
  gateway: z.object({
    host: z.string().default('127.0.0.1'),
    port: z.number().int().min(1024).max(65535).default(18789),
    max_connections: z.number().int().positive().default(100),
    heartbeat_interval_ms: z.number().int().positive().default(30000),
  }),
  limits: z.object({
    max_message_bytes: z.number().int().positive().default(65536),
    per_sender_per_minute: z.number().int().positive().default(10),
    max_attachments: z.number().int().nonnegative().default(10),
    max_attachment_size_bytes: z.number().int().positive().default(10485760),
  }),
  paths: z.object({
    base_dir: z.string().default('~/.ari'),
    audit_file: z.string().default('audit.jsonl'),
    pid_file: z.string().default('ari.pid'),
    log_dir: z.string().default('logs'),
    config_file: z.string().default('config.json'),
  }),
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    pretty: z.boolean().default(false),
  }),
  security: z.object({
    bind_loopback_only: z.literal(true).default(true),
    require_auth: z.boolean().default(false),
  }),
});
export type Config = z.infer<typeof ConfigSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// EVENT BUS TYPES
// ═══════════════════════════════════════════════════════════════════════════

export const EventPayloadSchema = z.object({
  type: EventTypeSchema,
  timestamp: z.string().datetime(),
  data: z.unknown(),
  source: z.string(),
  correlation_id: z.string().uuid().optional(),
});
export type EventPayload = z.infer<typeof EventPayloadSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// RESULT TYPE (Functional Error Handling)
// ═══════════════════════════════════════════════════════════════════════════

export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}

export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}
