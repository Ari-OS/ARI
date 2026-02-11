/**
 * Channels Module
 *
 * Unified channel abstraction layer for ARI communications.
 * Provides adapters for various messaging platforms with consistent interfaces.
 */

// Core types
export {
  // Types
  type Channel,
  type ChannelType,
  type ChannelStatus,
  type ChannelConfig,
  type ChannelCapabilities,
  type ChannelEvent,
  type ChannelFactory,
  type InboundMessage,
  type OutboundMessage,
  type SendResult,
  type RateLimit,
  type Attachment,
  type MessageDirection,
  type MessagePriority,
  type NormalizedMessage,

  // Schemas
  ChannelTypeSchema,
  ChannelStatusSchema,
  ChannelConfigSchema,
  ChannelCapabilitiesSchema,
  InboundMessageSchema,
  OutboundMessageSchema,
  SendResultSchema,
  RateLimitSchema,
  AttachmentSchema,
  MessageDirectionSchema,
  MessagePrioritySchema,
  NormalizedMessageSchema,

  // Utilities
  normalizeInbound,
  normalizeOutbound,
} from './types.js';

// Registry
export { ChannelRegistry } from './registry.js';

// Router
export { ChannelRouter, type MessageHandler } from './router.js';

// Bridge (connects channels → AI → reply)
export { MessageBridge } from './message-bridge.js';

// Middleware
export {
  RateLimiter,
  type RateLimiterConfig,
  createChannelRateLimiter,
  CHANNEL_RATE_LIMITS,
} from './middleware/rate-limiter.js';
export {
  MessageValidator,
  type ValidationResult,
  createChannelValidator,
} from './middleware/validator.js';

// Adapters
export { BaseChannel } from './adapters/base.js';
export { TelegramChannel, createTelegramChannel, type TelegramConfig } from './adapters/telegram.js';
export { SlackChannel, createSlackChannel, type SlackConfig } from './adapters/slack.js';
export { WebhookChannel, createWebhookChannel, type WebhookConfig } from './adapters/webhook.js';
