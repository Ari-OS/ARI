import { z } from 'zod';
import { TrustLevelSchema, AgentIdSchema } from '../types.js';

/**
 * Control Plane Protocol Definitions
 *
 * This module defines the typed message protocol for WebSocket communication.
 * All messages are validated with Zod schemas at runtime.
 */

// ── Message Payloads ────────────────────────────────────────────────────────

export const SessionStartPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  channel: z.string(),
  senderId: z.string(),
  groupId: z.string().optional(),
  trustLevel: TrustLevelSchema,
  metadata: z.record(z.unknown()).optional(),
});
export type SessionStartPayload = z.infer<typeof SessionStartPayloadSchema>;

export const SessionEndPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  reason: z.enum(['user_disconnect', 'timeout', 'error', 'channel_close']),
  metadata: z.record(z.unknown()).optional(),
});
export type SessionEndPayload = z.infer<typeof SessionEndPayloadSchema>;

export const MessagePayloadSchema = z.object({
  messageId: z.string().uuid(),
  sessionId: z.string().uuid(),
  content: z.string(),
  direction: z.enum(['inbound', 'outbound']),
  channel: z.string(),
  senderId: z.string(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});
export type MessagePayload = z.infer<typeof MessagePayloadSchema>;

export const ToolStartPayloadSchema = z.object({
  callId: z.string().uuid(),
  toolId: z.string(),
  toolName: z.string(),
  agent: AgentIdSchema,
  sessionId: z.string().uuid().optional(),
  parameters: z.record(z.unknown()),
  timestamp: z.string().datetime(),
});
export type ToolStartPayload = z.infer<typeof ToolStartPayloadSchema>;

export const ToolUpdatePayloadSchema = z.object({
  callId: z.string().uuid(),
  toolId: z.string(),
  progress: z.number().min(0).max(100).optional(),
  status: z.enum(['running', 'waiting_approval', 'processing']),
  message: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type ToolUpdatePayload = z.infer<typeof ToolUpdatePayloadSchema>;

export const ToolEndPayloadSchema = z.object({
  callId: z.string().uuid(),
  toolId: z.string(),
  success: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  duration: z.number(), // milliseconds
  timestamp: z.string().datetime(),
});
export type ToolEndPayload = z.infer<typeof ToolEndPayloadSchema>;

export const ChannelStatusPayloadSchema = z.object({
  channelId: z.string(),
  channelName: z.string(),
  status: z.enum(['connected', 'disconnected', 'connecting', 'error']),
  activeSessions: z.number(),
  lastActivity: z.string().datetime().optional(),
  error: z.string().optional(),
});
export type ChannelStatusPayload = z.infer<typeof ChannelStatusPayloadSchema>;

export const HealthPayloadSchema = z.object({
  uptime: z.number(),
  memoryUsage: z.number(),
  activeClients: z.number(),
  activeSessions: z.number(),
  timestamp: z.string().datetime(),
});
export type HealthPayload = z.infer<typeof HealthPayloadSchema>;

export const ErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
});
export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;

export const AuthPayloadSchema = z.object({
  clientId: z.string(),
  token: z.string().optional(),
  clientType: z.enum(['dashboard', 'channel', 'monitor', 'admin']),
  capabilities: z.array(z.string()).optional(),
});
export type AuthPayload = z.infer<typeof AuthPayloadSchema>;

export const AuthResponsePayloadSchema = z.object({
  success: z.boolean(),
  clientId: z.string(),
  assignedCapabilities: z.array(z.string()),
  error: z.string().optional(),
});
export type AuthResponsePayload = z.infer<typeof AuthResponsePayloadSchema>;

// ── Control Plane Message Types ─────────────────────────────────────────────

export const ControlPlaneMessageSchema = z.discriminatedUnion('type', [
  // Session lifecycle
  z.object({ type: z.literal('session:start'), payload: SessionStartPayloadSchema }),
  z.object({ type: z.literal('session:end'), payload: SessionEndPayloadSchema }),

  // Message flow
  z.object({ type: z.literal('message:send'), payload: MessagePayloadSchema }),
  z.object({ type: z.literal('message:received'), payload: MessagePayloadSchema }),
  z.object({ type: z.literal('message:processed'), payload: MessagePayloadSchema }),

  // Tool streaming
  z.object({ type: z.literal('tool:start'), payload: ToolStartPayloadSchema }),
  z.object({ type: z.literal('tool:update'), payload: ToolUpdatePayloadSchema }),
  z.object({ type: z.literal('tool:end'), payload: ToolEndPayloadSchema }),

  // Channel status
  z.object({ type: z.literal('channel:status'), payload: ChannelStatusPayloadSchema }),
  z.object({ type: z.literal('channel:list'), payload: z.object({}) }),
  z.object({ type: z.literal('channel:list:response'), payload: z.array(ChannelStatusPayloadSchema) }),

  // Health/heartbeat
  z.object({ type: z.literal('health:ping'), payload: z.null() }),
  z.object({ type: z.literal('health:pong'), payload: HealthPayloadSchema }),

  // Authentication
  z.object({ type: z.literal('auth:request'), payload: AuthPayloadSchema }),
  z.object({ type: z.literal('auth:response'), payload: AuthResponsePayloadSchema }),

  // Errors
  z.object({ type: z.literal('error'), payload: ErrorPayloadSchema }),

  // Subscription management
  z.object({
    type: z.literal('subscribe'),
    payload: z.object({
      events: z.array(z.string()),
      sessionId: z.string().uuid().optional(),
    })
  }),
  z.object({
    type: z.literal('unsubscribe'),
    payload: z.object({
      events: z.array(z.string()),
    })
  }),
]);

export type ControlPlaneMessage = z.infer<typeof ControlPlaneMessageSchema>;

// ── Message Type Helpers ────────────────────────────────────────────────────

export type MessageType = ControlPlaneMessage['type'];

export const MESSAGE_TYPES = [
  'session:start',
  'session:end',
  'message:send',
  'message:received',
  'message:processed',
  'tool:start',
  'tool:update',
  'tool:end',
  'channel:status',
  'channel:list',
  'channel:list:response',
  'health:ping',
  'health:pong',
  'auth:request',
  'auth:response',
  'error',
  'subscribe',
  'unsubscribe',
] as const;

/**
 * Validates and parses a control plane message
 */
export function parseMessage(data: unknown): ControlPlaneMessage {
  return ControlPlaneMessageSchema.parse(data);
}

/**
 * Safely parses a message, returning null on failure
 */
export function safeParseMessage(data: unknown): ControlPlaneMessage | null {
  const result = ControlPlaneMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Creates a typed message with proper structure
 */
export function createMessage<T extends MessageType>(
  type: T,
  payload: Extract<ControlPlaneMessage, { type: T }>['payload']
): ControlPlaneMessage {
  return { type, payload } as ControlPlaneMessage;
}

/**
 * Creates an error message
 */
export function createErrorMessage(code: string, message: string, details?: Record<string, unknown>): ControlPlaneMessage {
  return {
    type: 'error',
    payload: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
  };
}
