import { z } from 'zod';
import { TrustLevelSchema } from '../kernel/types.js';

/**
 * Channel Types
 *
 * Unified channel abstraction for ARI communications.
 * All channels implement the same interface for consistent handling.
 */

// ── Channel Type ────────────────────────────────────────────────────────────

export const ChannelTypeSchema = z.enum(['push', 'poll', 'websocket', 'bidirectional']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

// ── Channel Status ──────────────────────────────────────────────────────────

export const ChannelStatusSchema = z.enum(['connected', 'disconnected', 'connecting', 'error', 'rate_limited']);
export type ChannelStatus = z.infer<typeof ChannelStatusSchema>;

// ── Message Direction ───────────────────────────────────────────────────────

export const MessageDirectionSchema = z.enum(['inbound', 'outbound']);
export type MessageDirection = z.infer<typeof MessageDirectionSchema>;

// ── Message Priority ────────────────────────────────────────────────────────

export const MessagePrioritySchema = z.enum(['lowest', 'low', 'normal', 'high', 'emergency']);
export type MessagePriority = z.infer<typeof MessagePrioritySchema>;

// ── Attachment Schema ───────────────────────────────────────────────────────

export const AttachmentSchema = z.object({
  id: z.string(),
  type: z.enum(['image', 'audio', 'video', 'file', 'location']),
  url: z.string().url().optional(),
  data: z.string().optional(), // Base64 encoded
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  size: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

// ── Inbound Message ─────────────────────────────────────────────────────────

export const InboundMessageSchema = z.object({
  /** Unique message ID from the channel */
  id: z.string(),
  /** Channel identifier */
  channelId: z.string(),
  /** Sender identifier within the channel */
  senderId: z.string(),
  /** Sender display name (optional) */
  senderName: z.string().optional(),
  /** Group/chat identifier (optional) */
  groupId: z.string().optional(),
  /** Message content */
  content: z.string(),
  /** Message timestamp */
  timestamp: z.date(),
  /** Trust level (assigned by channel or default) */
  trustLevel: TrustLevelSchema.default('standard'),
  /** Attachments */
  attachments: z.array(AttachmentSchema).default([]),
  /** Whether this is a reply to another message */
  replyTo: z.string().optional(),
  /** Channel-specific metadata */
  metadata: z.record(z.unknown()).default({}),
});
export type InboundMessage = z.infer<typeof InboundMessageSchema>;

// ── Outbound Message ────────────────────────────────────────────────────────

export const OutboundMessageSchema = z.object({
  /** Unique message ID (generated) */
  id: z.string().uuid(),
  /** Target channel identifier */
  channelId: z.string(),
  /** Recipient identifier */
  recipientId: z.string(),
  /** Group/chat identifier (optional) */
  groupId: z.string().optional(),
  /** Message content */
  content: z.string(),
  /** Message priority */
  priority: MessagePrioritySchema.default('normal'),
  /** Attachments */
  attachments: z.array(AttachmentSchema).default([]),
  /** Session ID for context */
  sessionId: z.string().uuid().optional(),
  /** Reply to message ID */
  replyTo: z.string().optional(),
  /** Channel-specific options */
  options: z.record(z.unknown()).default({}),
});
export type OutboundMessage = z.infer<typeof OutboundMessageSchema>;

// ── Send Result ─────────────────────────────────────────────────────────────

export const SendResultSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  channelMessageId: z.string().optional(),
  timestamp: z.date(),
  error: z.string().optional(),
  retryAfter: z.number().optional(), // Milliseconds until retry allowed
});
export type SendResult = z.infer<typeof SendResultSchema>;

// ── Rate Limit ──────────────────────────────────────────────────────────────

export const RateLimitSchema = z.object({
  /** Maximum messages per window */
  maxMessages: z.number(),
  /** Window size in milliseconds */
  windowMs: z.number(),
  /** Current message count in window */
  currentCount: z.number().default(0),
  /** Window start timestamp */
  windowStart: z.date().optional(),
  /** Whether currently rate limited */
  limited: z.boolean().default(false),
  /** Reset time if limited */
  resetAt: z.date().optional(),
});
export type RateLimit = z.infer<typeof RateLimitSchema>;

// ── Channel Capabilities ────────────────────────────────────────────────────

export const ChannelCapabilitiesSchema = z.object({
  /** Supports typing indicators */
  typingIndicator: z.boolean().default(false),
  /** Supports reactions */
  reactions: z.boolean().default(false),
  /** Supports attachments */
  attachments: z.boolean().default(false),
  /** Supports reply threading */
  replies: z.boolean().default(false),
  /** Supports message editing */
  editing: z.boolean().default(false),
  /** Supports message deletion */
  deletion: z.boolean().default(false),
  /** Supports read receipts */
  readReceipts: z.boolean().default(false),
  /** Maximum message length */
  maxMessageLength: z.number().optional(),
  /** Supported attachment types */
  supportedAttachments: z.array(z.string()).default([]),
});
export type ChannelCapabilities = z.infer<typeof ChannelCapabilitiesSchema>;

// ── Channel Configuration ───────────────────────────────────────────────────

export const ChannelConfigSchema = z.object({
  /** Channel identifier */
  id: z.string(),
  /** Channel display name */
  name: z.string(),
  /** Channel type */
  type: ChannelTypeSchema,
  /** Whether channel is enabled */
  enabled: z.boolean().default(true),
  /** Default trust level for messages from this channel */
  defaultTrustLevel: TrustLevelSchema.default('standard'),
  /** Rate limit configuration */
  rateLimit: RateLimitSchema.partial().optional(),
  /** Channel capabilities */
  capabilities: ChannelCapabilitiesSchema.partial().optional(),
  /** Channel-specific settings */
  settings: z.record(z.unknown()).default({}),
});
export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;

// ── Channel Interface ───────────────────────────────────────────────────────

/**
 * Channel interface that all channel adapters must implement
 */
export interface Channel {
  /** Unique channel identifier */
  readonly id: string;

  /** Channel display name */
  readonly name: string;

  /** Channel type (push, poll, websocket, bidirectional) */
  readonly type: ChannelType;

  /** Connect to the channel */
  connect(): Promise<void>;

  /** Disconnect from the channel */
  disconnect(): Promise<void>;

  /** Check if channel is connected */
  isConnected(): boolean;

  /** Get current channel status */
  getStatus(): ChannelStatus;

  /** Send a message through the channel */
  send(message: OutboundMessage): Promise<SendResult>;

  /** Receive messages (async iterable for polling/websocket channels) */
  receive(): AsyncIterable<InboundMessage>;

  /** Check if channel supports a specific capability */
  supportsCapability(capability: keyof ChannelCapabilities): boolean;

  /** Get channel capabilities */
  getCapabilities(): ChannelCapabilities;

  /** Get current rate limit state */
  getRateLimit(): RateLimit;

  /** Set rate limit configuration */
  setRateLimit(config: Partial<RateLimit>): void;

  /** Get channel configuration */
  getConfig(): ChannelConfig;

  /** Update channel configuration */
  updateConfig(config: Partial<ChannelConfig>): void;

  /** Send typing indicator (if supported) */
  sendTypingIndicator?(recipientId: string): Promise<void>;

  /** React to a message (if supported) */
  react?(messageId: string, reaction: string): Promise<boolean>;

  /** Edit a message (if supported) */
  edit?(messageId: string, newContent: string): Promise<boolean>;

  /** Delete a message (if supported) */
  delete?(messageId: string): Promise<boolean>;
}

// ── Channel Events ──────────────────────────────────────────────────────────

export interface ChannelEvent {
  channelId: string;
  timestamp: Date;
  type: 'connected' | 'disconnected' | 'message_received' | 'message_sent' | 'error' | 'rate_limited';
  details?: Record<string, unknown>;
}

// ── Channel Factory ─────────────────────────────────────────────────────────

export type ChannelFactory = (config: ChannelConfig) => Channel;

// ── Normalized Message ──────────────────────────────────────────────────────

/**
 * Normalized message format for internal processing
 */
export const NormalizedMessageSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  channelName: z.string(),
  direction: MessageDirectionSchema,
  senderId: z.string(),
  senderName: z.string().optional(),
  recipientId: z.string().optional(),
  groupId: z.string().optional(),
  sessionId: z.string().uuid().optional(),
  content: z.string(),
  timestamp: z.date(),
  trustLevel: TrustLevelSchema,
  priority: MessagePrioritySchema.optional(),
  attachments: z.array(AttachmentSchema).default([]),
  replyTo: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type NormalizedMessage = z.infer<typeof NormalizedMessageSchema>;

/**
 * Normalize an inbound message
 */
export function normalizeInbound(
  message: InboundMessage,
  channelName: string,
  sessionId?: string
): NormalizedMessage {
  return {
    id: message.id,
    channelId: message.channelId,
    channelName,
    direction: 'inbound',
    senderId: message.senderId,
    senderName: message.senderName,
    groupId: message.groupId,
    sessionId,
    content: message.content,
    timestamp: message.timestamp,
    trustLevel: message.trustLevel,
    attachments: message.attachments,
    replyTo: message.replyTo,
    metadata: message.metadata,
  };
}

/**
 * Normalize an outbound message
 */
export function normalizeOutbound(
  message: OutboundMessage,
  channelName: string
): NormalizedMessage {
  return {
    id: message.id,
    channelId: message.channelId,
    channelName,
    direction: 'outbound',
    senderId: 'ari',
    recipientId: message.recipientId,
    groupId: message.groupId,
    sessionId: message.sessionId,
    content: message.content,
    timestamp: new Date(),
    trustLevel: 'system',
    priority: message.priority,
    attachments: message.attachments,
    replyTo: message.replyTo,
    metadata: message.options,
  };
}
