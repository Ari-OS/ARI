import { randomUUID } from 'crypto';
import type { EventBus } from '../kernel/event-bus.js';
import type { AuditLogger } from '../kernel/audit.js';
import { sanitize } from '../kernel/sanitizer.js';
import type { SessionManager } from '../system/sessions/session-manager.js';
import type { ChannelRegistry } from './registry.js';
import type {
  InboundMessage,
  OutboundMessage,
  NormalizedMessage,
  SendResult,
} from './types.js';
import { normalizeInbound, normalizeOutbound } from './types.js';

/**
 * Channel Message Handler
 */
export type MessageHandler = (message: NormalizedMessage) => Promise<void>;

/**
 * ChannelRouter
 *
 * Routes messages between channels and ARI's internal systems.
 * Handles message normalization, sanitization, and session management.
 */
export class ChannelRouter {
  private registry: ChannelRegistry;
  private sessionManager: SessionManager | null = null;
  private eventBus: EventBus;
  private audit: AuditLogger;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private running: boolean = false;
  private receiveLoops: Map<string, AbortController> = new Map();

  constructor(
    registry: ChannelRegistry,
    eventBus: EventBus,
    audit: AuditLogger
  ) {
    this.registry = registry;
    this.eventBus = eventBus;
    this.audit = audit;
  }

  /**
   * Set the session manager for session-aware routing
   */
  setSessionManager(sessionManager: SessionManager): void {
    this.sessionManager = sessionManager;
  }

  /**
   * Register a message handler
   */
  onMessage(pattern: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(pattern)) {
      this.handlers.set(pattern, []);
    }
    this.handlers.get(pattern)!.push(handler);

    return () => {
      const handlers = this.handlers.get(pattern);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Start receiving messages from all channels
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Start receive loops for all connected channels
    for (const channel of this.registry.getConnected()) {
      this.startReceiveLoop(channel.id);
    }

    // Listen for channel connection events to start new receive loops
    this.eventBus.on('channel:connected', ({ channelId }) => {
      if (this.running) {
        this.startReceiveLoop(channelId);
      }
    });

    this.eventBus.on('channel:disconnected', ({ channelId }) => {
      this.stopReceiveLoop(channelId);
    });

    await this.audit.log('channel_router_started', 'system', 'system', {
      activeChannels: this.registry.getConnected().length,
    });
  }

  /**
   * Stop receiving messages
   */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    // Stop all receive loops
    for (const [, controller] of this.receiveLoops) {
      controller.abort();
    }
    this.receiveLoops.clear();

    await this.audit.log('channel_router_stopped', 'system', 'system', {});
  }

  /**
   * Start a receive loop for a channel
   */
  private startReceiveLoop(channelId: string): void {
    const channel = this.registry.get(channelId);
    if (!channel) return;

    const controller = new AbortController();
    this.receiveLoops.set(channelId, controller);

    // Start async receive loop
    void (async () => {
      try {
        for await (const message of channel.receive()) {
          if (controller.signal.aborted) break;
          await this.handleInboundMessage(message, channel.name);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          await this.audit.log('channel_receive_error', 'system', 'system', {
            channelId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();
  }

  /**
   * Stop a receive loop for a channel
   */
  private stopReceiveLoop(_channelId: string): void {
    const controller = this.receiveLoops.get(_channelId);
    if (controller) {
      controller.abort();
      this.receiveLoops.delete(_channelId);
    }
  }

  /**
   * Handle an inbound message from a channel
   */
  private async handleInboundMessage(message: InboundMessage, channelName: string): Promise<void> {
    // Sanitize the message content (Content ≠ Command principle)
    const sanitizeResult = sanitize(message.content, message.trustLevel);

    if (!sanitizeResult.safe || sanitizeResult.riskScore >= 0.8) {
      // Log security event and strictly drop the message
      await this.audit.log('channel_message_blocked', 'system', message.trustLevel, {
        channelId: message.channelId,
        senderId: message.senderId,
        threats: sanitizeResult.threats,
        riskScore: sanitizeResult.riskScore,
        action: 'dropped'
      });

      this.eventBus.emit('security:detected', {
        id: randomUUID(),
        timestamp: new Date(),
        eventType: 'injection_detected',
        severity: sanitizeResult.riskScore >= 10 ? 'critical' : sanitizeResult.riskScore >= 5 ? 'high' : 'medium',
        source: `channel:${message.channelId}`,
        details: {
          senderId: message.senderId,
          threats: sanitizeResult.threats,
          riskScore: sanitizeResult.riskScore,
          action: 'dropped'
        },
        mitigated: true,
      });

      // Strict enforcement: Drop the message, do not proceed
      return;
    }

    // Get or create session
    let sessionId: string | undefined;
    if (this.sessionManager) {
      const session = await this.sessionManager.getOrCreateSession({
        channel: message.channelId,
        senderId: message.senderId,
        groupId: message.groupId,
        trustLevel: message.trustLevel,
      });
      sessionId = session.id;

      // Record the message in the session
      await this.sessionManager.recordInboundMessage(session.id, message.id);
    }

    // Normalize the message
    const normalized = normalizeInbound(message, channelName, sessionId);

    // Emit channel event
    this.eventBus.emit('channel:message:inbound', {
      channelId: message.channelId,
      messageId: message.id,
      senderId: message.senderId,
      content: message.content,
      timestamp: message.timestamp,
    });

    // Emit to internal message system
    this.eventBus.emit('message:received', {
      id: message.id,
      content: message.content,
      source: message.trustLevel,
      timestamp: message.timestamp,
      metadata: {
        channelId: message.channelId,
        channelName,
        senderId: message.senderId,
        groupId: message.groupId,
        sessionId,
        fromChannel: true,
      },
    });

    // Call registered handlers
    await this.dispatchToHandlers(normalized);

    await this.audit.log('channel_message_received', 'system', message.trustLevel, {
      channelId: message.channelId,
      messageId: message.id,
      senderId: message.senderId,
      sessionId,
      contentLength: message.content.length,
    });
  }

  /**
   * Dispatch a message to registered handlers
   */
  private async dispatchToHandlers(message: NormalizedMessage): Promise<void> {
    // Try exact match first
    const exactHandlers = this.handlers.get(message.channelId) || [];
    for (const handler of exactHandlers) {
      try {
        await handler(message);
      } catch (error) {
        await this.audit.log('channel_handler_error', 'system', 'system', {
          channelId: message.channelId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Try wildcard handler
    const wildcardHandlers = this.handlers.get('*') || [];
    for (const handler of wildcardHandlers) {
      try {
        await handler(message);
      } catch (error) {
        await this.audit.log('channel_handler_error', 'system', 'system', {
          channelId: message.channelId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Send a message through a channel
   */
  async send(message: OutboundMessage): Promise<SendResult> {
    const channel = this.registry.get(message.channelId);
    if (!channel) {
      return {
        success: false,
        timestamp: new Date(),
        error: `Channel not found: ${message.channelId}`,
      };
    }

    if (!channel.isConnected()) {
      return {
        success: false,
        timestamp: new Date(),
        error: `Channel not connected: ${message.channelId}`,
      };
    }

    // Check rate limit
    const rateLimit = channel.getRateLimit();
    if (rateLimit.limited) {
      return {
        success: false,
        timestamp: new Date(),
        error: 'Rate limited',
        retryAfter: rateLimit.resetAt ? rateLimit.resetAt.getTime() - Date.now() : undefined,
      };
    }

    try {
      const result = await channel.send(message);

      if (result.success) {
        // Normalize for logging
        normalizeOutbound(message, channel.name);

        // Update session if available
        if (this.sessionManager && message.sessionId) {
          await this.sessionManager.recordOutboundMessage(message.sessionId, message.id);
        }

        // Emit channel event
        this.eventBus.emit('channel:message:outbound', {
          channelId: message.channelId,
          messageId: message.id,
          recipientId: message.recipientId,
          content: message.content,
          timestamp: result.timestamp,
        });

        await this.audit.log('channel_message_sent', 'system', 'system', {
          channelId: message.channelId,
          messageId: message.id,
          recipientId: message.recipientId,
          sessionId: message.sessionId,
          contentLength: message.content.length,
        });
      }

      return result;
    } catch (error) {
      await this.audit.log('channel_send_error', 'system', 'system', {
        channelId: message.channelId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send a message to a specific recipient on a channel
   */
  async sendTo(
    channelId: string,
    recipientId: string,
    content: string,
    options?: Partial<Omit<OutboundMessage, 'id' | 'channelId' | 'recipientId' | 'content'>>
  ): Promise<SendResult> {
    return this.send({
      id: randomUUID(),
      channelId,
      recipientId,
      content,
      priority: options?.priority || 'normal',
      attachments: options?.attachments || [],
      sessionId: options?.sessionId,
      replyTo: options?.replyTo,
      options: options?.options || {},
    });
  }

  /**
   * Broadcast a message to all recipients on a channel
   * (Channel must support this capability)
   */
  async broadcast(
    channelId: string,
    content: string,
    options?: Partial<Omit<OutboundMessage, 'id' | 'channelId' | 'recipientId' | 'content'>>
  ): Promise<SendResult> {
    return this.sendTo(channelId, '*', content, options);
  }

  /**
   * Reply to a message
   */
  async reply(
    originalMessage: NormalizedMessage,
    content: string,
    options?: Partial<Omit<OutboundMessage, 'id' | 'channelId' | 'recipientId' | 'content' | 'replyTo'>>
  ): Promise<SendResult> {
    return this.send({
      id: randomUUID(),
      channelId: originalMessage.channelId,
      recipientId: originalMessage.senderId,
      groupId: originalMessage.groupId,
      content,
      priority: options?.priority || 'normal',
      attachments: options?.attachments || [],
      sessionId: originalMessage.sessionId,
      replyTo: originalMessage.id,
      options: options?.options || {},
    });
  }

  /**
   * Check if router is running
   */
  isRunning(): boolean {
    return this.running;
  }
}
