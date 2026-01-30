import { randomUUID } from 'crypto';
import type {
  Channel,
  ChannelType,
  ChannelStatus,
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
  SendResult,
  RateLimit,
} from '../types.js';
import { RateLimiter } from '../middleware/rate-limiter.js';

/**
 * BaseChannel
 *
 * Abstract base class for channel adapters.
 * Provides common functionality for rate limiting, status tracking, and configuration.
 */
export abstract class BaseChannel implements Channel {
  readonly id: string;
  readonly name: string;
  readonly type: ChannelType;

  protected config: ChannelConfig;
  protected status: ChannelStatus = 'disconnected';
  protected capabilities: ChannelCapabilities;
  protected rateLimiter: RateLimiter;
  protected messageQueue: InboundMessage[] = [];
  protected listeners: Set<(message: InboundMessage) => void> = new Set();

  constructor(config: ChannelConfig) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.config = config;

    // Set default capabilities
    this.capabilities = {
      typingIndicator: false,
      reactions: false,
      attachments: false,
      replies: false,
      editing: false,
      deletion: false,
      readReceipts: false,
      maxMessageLength: undefined,
      supportedAttachments: [],
      ...config.capabilities,
    };

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter({
      maxMessages: config.rateLimit?.maxMessages || 60,
      windowMs: config.rateLimit?.windowMs || 60000,
      strategy: 'queue',
    });
  }

  /**
   * Connect to the channel (implement in subclass)
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the channel (implement in subclass)
   */
  abstract disconnect(): Promise<void>;

  /**
   * Send implementation (implement in subclass)
   */
  protected abstract doSend(message: OutboundMessage): Promise<SendResult>;

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.status === 'connected';
  }

  /**
   * Get current status
   */
  getStatus(): ChannelStatus {
    return this.status;
  }

  /**
   * Set status
   */
  protected setStatus(status: ChannelStatus): void {
    this.status = status;
  }

  /**
   * Send a message through the channel
   */
  async send(message: OutboundMessage): Promise<SendResult> {
    if (!this.isConnected()) {
      return {
        success: false,
        timestamp: new Date(),
        error: 'Channel not connected',
      };
    }

    // Check rate limit
    const rateLimit = this.getRateLimit();
    if (rateLimit.limited) {
      return {
        success: false,
        timestamp: new Date(),
        error: 'Rate limited',
        retryAfter: rateLimit.resetAt ? rateLimit.resetAt.getTime() - Date.now() : undefined,
      };
    }

    // Consume rate limit slot
    this.rateLimiter.tryConsume();

    try {
      return await this.doSend(message);
    } catch (error) {
      return {
        success: false,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Receive messages (async iterable)
   */
  async *receive(): AsyncIterable<InboundMessage> {
    // Yield any queued messages first
    while (this.messageQueue.length > 0) {
      yield this.messageQueue.shift()!;
    }

    // Then yield new messages as they arrive
    while (this.isConnected()) {
      const message = await this.waitForMessage();
      if (message) {
        yield message;
      }
    }
  }

  /**
   * Wait for the next message
   */
  protected waitForMessage(): Promise<InboundMessage | null> {
    return new Promise((resolve) => {
      if (!this.isConnected()) {
        resolve(null);
        return;
      }

      // Check queue first
      if (this.messageQueue.length > 0) {
        resolve(this.messageQueue.shift()!);
        return;
      }

      // Wait for new message
      const handler = (message: InboundMessage) => {
        this.listeners.delete(handler);
        resolve(message);
      };

      this.listeners.add(handler);

      // Timeout after 30 seconds
      setTimeout(() => {
        this.listeners.delete(handler);
        resolve(null);
      }, 30000);
    });
  }

  /**
   * Queue an inbound message
   */
  protected queueMessage(message: InboundMessage): void {
    // Notify listeners
    if (this.listeners.size > 0) {
      const listener = this.listeners.values().next().value;
      if (listener) {
        this.listeners.delete(listener);
        listener(message);
        return;
      }
    }

    // Otherwise queue
    this.messageQueue.push(message);
  }

  /**
   * Check if channel supports a capability
   */
  supportsCapability(capability: keyof ChannelCapabilities): boolean {
    const value = this.capabilities[capability];
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined;
  }

  /**
   * Get channel capabilities
   */
  getCapabilities(): ChannelCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Get current rate limit state
   */
  getRateLimit(): RateLimit {
    return this.rateLimiter.getState();
  }

  /**
   * Set rate limit configuration
   */
  setRateLimit(config: Partial<RateLimit>): void {
    this.rateLimiter.updateConfig({
      maxMessages: config.maxMessages,
      windowMs: config.windowMs,
    });
  }

  /**
   * Get channel configuration
   */
  getConfig(): ChannelConfig {
    return { ...this.config };
  }

  /**
   * Update channel configuration
   */
  updateConfig(config: Partial<ChannelConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.capabilities) {
      this.capabilities = { ...this.capabilities, ...config.capabilities };
    }

    if (config.rateLimit) {
      this.setRateLimit(config.rateLimit);
    }
  }

  /**
   * Create a standard inbound message
   */
  protected createInboundMessage(
    content: string,
    senderId: string,
    options?: {
      id?: string;
      senderName?: string;
      groupId?: string;
      replyTo?: string;
      metadata?: Record<string, unknown>;
    }
  ): InboundMessage {
    return {
      id: options?.id || randomUUID(),
      channelId: this.id,
      senderId,
      senderName: options?.senderName,
      groupId: options?.groupId,
      content,
      timestamp: new Date(),
      trustLevel: this.config.defaultTrustLevel || 'standard',
      attachments: [],
      replyTo: options?.replyTo,
      metadata: options?.metadata || {},
    };
  }

  /**
   * Create a standard send result
   */
  protected createSendResult(
    success: boolean,
    channelMessageId?: string,
    error?: string
  ): SendResult {
    return {
      success,
      messageId: randomUUID(),
      channelMessageId,
      timestamp: new Date(),
      error,
    };
  }
}
