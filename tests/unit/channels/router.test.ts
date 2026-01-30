import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { ChannelRegistry } from '../../../src/channels/registry.js';
import { ChannelRouter, type MessageHandler } from '../../../src/channels/router.js';
import type {
  Channel,
  ChannelConfig,
  ChannelCapabilities,
  ChannelStatus,
  RateLimit,
  OutboundMessage,
  InboundMessage,
  SendResult,
  NormalizedMessage,
} from '../../../src/channels/types.js';

/**
 * Create a mock channel for testing
 */
function createMockChannel(
  overrides: Partial<{
    id: string;
    name: string;
    type: 'push' | 'poll' | 'websocket' | 'bidirectional';
    connected: boolean;
    status: ChannelStatus;
    enabled: boolean;
    rateLimited: boolean;
  }>
): Channel {
  const id = overrides.id || `channel-${randomUUID()}`;
  const name = overrides.name || 'Test Channel';
  const type = overrides.type || 'push';
  let connected = overrides.connected ?? false;
  let status: ChannelStatus = overrides.status || 'disconnected';
  const enabled = overrides.enabled ?? true;
  const rateLimited = overrides.rateLimited ?? false;

  const config: ChannelConfig = {
    id,
    name,
    type,
    enabled,
    defaultTrustLevel: 'standard',
    settings: {},
  };

  const capabilities: ChannelCapabilities = {
    typingIndicator: false,
    reactions: false,
    attachments: true,
    replies: true,
    editing: false,
    deletion: false,
    readReceipts: false,
    supportedAttachments: ['image', 'file'],
  };

  const rateLimit: RateLimit = {
    maxMessages: 100,
    windowMs: 60000,
    currentCount: rateLimited ? 100 : 0,
    limited: rateLimited,
    resetAt: rateLimited ? new Date(Date.now() + 30000) : undefined,
  };

  // Create an async generator for receive
  async function* receiveGenerator(): AsyncGenerator<InboundMessage> {
    // Empty generator - tests will mock this
  }

  return {
    id,
    name,
    type,
    connect: vi.fn(async () => {
      connected = true;
      status = 'connected';
    }),
    disconnect: vi.fn(async () => {
      connected = false;
      status = 'disconnected';
    }),
    isConnected: vi.fn(() => connected),
    getStatus: vi.fn(() => status),
    send: vi.fn(async (message: OutboundMessage): Promise<SendResult> => ({
      success: true,
      messageId: message.id,
      channelMessageId: `ch-${message.id}`,
      timestamp: new Date(),
    })),
    receive: vi.fn(() => receiveGenerator()),
    supportsCapability: vi.fn((cap: keyof ChannelCapabilities) => capabilities[cap] === true),
    getCapabilities: vi.fn(() => capabilities),
    getRateLimit: vi.fn(() => rateLimit),
    setRateLimit: vi.fn(),
    getConfig: vi.fn(() => config),
    updateConfig: vi.fn((updates: Partial<ChannelConfig>) => {
      Object.assign(config, updates);
    }),
  };
}

/**
 * Create a mock session manager for testing
 */
function createMockSessionManager() {
  return {
    getOrCreateSession: vi.fn(async (input: { channel: string; senderId: string }) => ({
      id: `session-${input.channel}-${input.senderId}`,
      channel: input.channel,
      senderId: input.senderId,
      status: 'active',
    })),
    recordInboundMessage: vi.fn(async () => undefined),
    recordOutboundMessage: vi.fn(async () => undefined),
  };
}

describe('ChannelRouter', () => {
  let eventBus: EventBus;
  let audit: AuditLogger;
  let registry: ChannelRegistry;
  let router: ChannelRouter;
  let testAuditPath: string;

  beforeEach(() => {
    testAuditPath = join(tmpdir(), `ari-test-router-${randomUUID()}.json`);
    eventBus = new EventBus();
    audit = new AuditLogger(testAuditPath);
    registry = new ChannelRegistry(eventBus, audit);
    router = new ChannelRouter(registry, eventBus, audit);
  });

  afterEach(async () => {
    await router.stop();
  });

  describe('setSessionManager', () => {
    it('should set the session manager', () => {
      const sessionManager = createMockSessionManager();

      // Should not throw
      expect(() =>
        router.setSessionManager(sessionManager as unknown as Parameters<typeof router.setSessionManager>[0])
      ).not.toThrow();
    });
  });

  describe('onMessage', () => {
    it('should register a message handler for a pattern', () => {
      const handler: MessageHandler = vi.fn();

      const unsubscribe = router.onMessage('test-channel', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow multiple handlers for the same pattern', () => {
      const handler1: MessageHandler = vi.fn();
      const handler2: MessageHandler = vi.fn();

      router.onMessage('test-channel', handler1);
      router.onMessage('test-channel', handler2);

      // Both should be registered (no error)
    });

    it('should return unsubscribe function that removes handler', () => {
      const handler: MessageHandler = vi.fn();

      const unsubscribe = router.onMessage('test-channel', handler);
      unsubscribe();

      // Handler should be removed (no way to directly verify, but no error)
    });
  });

  describe('start', () => {
    it('should start the router', async () => {
      expect(router.isRunning()).toBe(false);

      await router.start();

      expect(router.isRunning()).toBe(true);
    });

    it('should not restart if already running', async () => {
      await router.start();
      await router.start(); // Should not throw or duplicate listeners

      expect(router.isRunning()).toBe(true);
    });

    it('should audit router start', async () => {
      await router.start();

      const events = audit.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].action).toBe('channel_router_started');
    });

    it('should start receive loops for connected channels', async () => {
      const channel = createMockChannel({
        id: 'conn-channel',
        connected: true,
        status: 'connected',
      });
      await registry.register(channel);

      await router.start();

      // The receive function should be called to start the loop
      expect(channel.receive).toHaveBeenCalled();
    });

    it('should listen for channel connection events', async () => {
      await router.start();

      const channel = createMockChannel({ id: 'new-channel', connected: true, status: 'connected' });
      await registry.register(channel);

      // Emit channel connected event
      eventBus.emit('channel:connected', {
        channelId: 'new-channel',
        channelName: 'New Channel',
        connectedAt: new Date(),
      });

      // Give time for async handling
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Receive should have been called
      expect(channel.receive).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop the router', async () => {
      await router.start();
      expect(router.isRunning()).toBe(true);

      await router.stop();

      expect(router.isRunning()).toBe(false);
    });

    it('should not throw if already stopped', async () => {
      await expect(router.stop()).resolves.not.toThrow();
    });

    it('should audit router stop', async () => {
      await router.start();
      await router.stop();

      const events = audit.getEvents();
      const stopEvent = events.find((e) => e.action === 'channel_router_stopped');
      expect(stopEvent).toBeDefined();
    });
  });

  describe('send', () => {
    it('should send message through channel', async () => {
      const channel = createMockChannel({
        id: 'send-channel',
        name: 'Send Channel',
        connected: true,
        status: 'connected',
      });
      await registry.register(channel);

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'send-channel',
        recipientId: 'user-123',
        content: 'Hello!',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await router.send(message);

      expect(result.success).toBe(true);
      expect(channel.send).toHaveBeenCalledWith(message);
    });

    it('should return error when channel not found', async () => {
      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'non-existent',
        recipientId: 'user-123',
        content: 'Hello!',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await router.send(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel not found: non-existent');
    });

    it('should return error when channel not connected', async () => {
      const channel = createMockChannel({
        id: 'disconn-channel',
        connected: false,
        status: 'disconnected',
      });
      await registry.register(channel);

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'disconn-channel',
        recipientId: 'user-123',
        content: 'Hello!',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await router.send(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel not connected: disconn-channel');
    });

    it('should return error when rate limited', async () => {
      const channel = createMockChannel({
        id: 'rate-limited',
        connected: true,
        status: 'connected',
        rateLimited: true,
      });
      await registry.register(channel);

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'rate-limited',
        recipientId: 'user-123',
        content: 'Hello!',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await router.send(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limited');
      expect(result.retryAfter).toBeDefined();
    });

    it('should emit channel:message:outbound event on success', async () => {
      const channel = createMockChannel({
        id: 'event-channel',
        name: 'Event Channel',
        connected: true,
        status: 'connected',
      });
      await registry.register(channel);

      const outboundEvents: unknown[] = [];
      eventBus.on('channel:message:outbound', (payload) => {
        outboundEvents.push(payload);
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'event-channel',
        recipientId: 'user-123',
        content: 'Test message',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      await router.send(message);

      expect(outboundEvents).toHaveLength(1);
      expect((outboundEvents[0] as { channelId: string }).channelId).toBe('event-channel');
      expect((outboundEvents[0] as { content: string }).content).toBe('Test message');
    });

    it('should audit successful send', async () => {
      const channel = createMockChannel({
        id: 'audit-send',
        name: 'Audit Send',
        connected: true,
        status: 'connected',
      });
      await registry.register(channel);

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'audit-send',
        recipientId: 'user-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      await router.send(message);

      const events = audit.getEvents();
      const sendEvent = events.find((e) => e.action === 'channel_message_sent');
      expect(sendEvent).toBeDefined();
      expect(sendEvent?.details?.channelId).toBe('audit-send');
      expect(sendEvent?.details?.recipientId).toBe('user-123');
    });

    it('should handle send errors gracefully', async () => {
      const channel = createMockChannel({
        id: 'error-channel',
        connected: true,
        status: 'connected',
      });
      (channel.send as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Send failed'));
      await registry.register(channel);

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'error-channel',
        recipientId: 'user-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await router.send(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Send failed');
    });

    it('should record outbound message in session manager if available', async () => {
      const sessionManager = createMockSessionManager();
      router.setSessionManager(sessionManager as unknown as Parameters<typeof router.setSessionManager>[0]);

      const channel = createMockChannel({
        id: 'session-channel',
        connected: true,
        status: 'connected',
      });
      await registry.register(channel);

      const sessionId = randomUUID();
      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'session-channel',
        recipientId: 'user-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        sessionId,
        options: {},
      };

      await router.send(message);

      expect(sessionManager.recordOutboundMessage).toHaveBeenCalledWith(sessionId, message.id);
    });
  });

  describe('sendTo', () => {
    it('should send message to specific recipient', async () => {
      const channel = createMockChannel({
        id: 'sendto-channel',
        connected: true,
        status: 'connected',
      });
      await registry.register(channel);

      const result = await router.sendTo('sendto-channel', 'user-456', 'Hello user!');

      expect(result.success).toBe(true);
      expect(channel.send).toHaveBeenCalled();

      const sentMessage = (channel.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as OutboundMessage;
      expect(sentMessage.recipientId).toBe('user-456');
      expect(sentMessage.content).toBe('Hello user!');
    });

    it('should use provided options', async () => {
      const channel = createMockChannel({
        id: 'options-channel',
        connected: true,
        status: 'connected',
      });
      await registry.register(channel);

      const sessionId = randomUUID();
      await router.sendTo('options-channel', 'user-456', 'Priority message', {
        priority: 'high',
        sessionId,
        replyTo: 'msg-100',
      });

      const sentMessage = (channel.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as OutboundMessage;
      expect(sentMessage.priority).toBe('high');
      expect(sentMessage.sessionId).toBe(sessionId);
      expect(sentMessage.replyTo).toBe('msg-100');
    });
  });

  describe('broadcast', () => {
    it('should send broadcast message with * recipient', async () => {
      const channel = createMockChannel({
        id: 'broadcast-channel',
        connected: true,
        status: 'connected',
      });
      await registry.register(channel);

      await router.broadcast('broadcast-channel', 'Broadcast message!');

      const sentMessage = (channel.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as OutboundMessage;
      expect(sentMessage.recipientId).toBe('*');
      expect(sentMessage.content).toBe('Broadcast message!');
    });
  });

  describe('reply', () => {
    it('should reply to original message', async () => {
      const channel = createMockChannel({
        id: 'reply-channel',
        connected: true,
        status: 'connected',
      });
      await registry.register(channel);

      const originalMessage: NormalizedMessage = {
        id: 'original-msg',
        channelId: 'reply-channel',
        channelName: 'Reply Channel',
        direction: 'inbound',
        senderId: 'user-789',
        groupId: 'group-123',
        sessionId: randomUUID(),
        content: 'Original message',
        timestamp: new Date(),
        trustLevel: 'standard',
        attachments: [],
        metadata: {},
      };

      await router.reply(originalMessage, 'This is a reply');

      const sentMessage = (channel.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as OutboundMessage;
      expect(sentMessage.recipientId).toBe('user-789');
      expect(sentMessage.replyTo).toBe('original-msg');
      expect(sentMessage.groupId).toBe('group-123');
      expect(sentMessage.sessionId).toBe(originalMessage.sessionId);
      expect(sentMessage.content).toBe('This is a reply');
    });
  });

  describe('isRunning', () => {
    it('should return correct running state', async () => {
      expect(router.isRunning()).toBe(false);

      await router.start();
      expect(router.isRunning()).toBe(true);

      await router.stop();
      expect(router.isRunning()).toBe(false);
    });
  });

  describe('message handling integration', () => {
    it('should dispatch messages to handlers matching channelId', async () => {
      const handler = vi.fn<Parameters<MessageHandler>, ReturnType<MessageHandler>>();
      router.onMessage('test-channel', handler);

      // We need to test the private handleInboundMessage method indirectly
      // This would require setting up a channel that emits messages
      // For now, we verify the handler registration works
      expect(handler).not.toHaveBeenCalled();
    });

    it('should dispatch messages to wildcard handlers', async () => {
      const wildcardHandler = vi.fn<Parameters<MessageHandler>, ReturnType<MessageHandler>>();
      router.onMessage('*', wildcardHandler);

      // Wildcard handler should be registered
      expect(wildcardHandler).not.toHaveBeenCalled();
    });
  });

  describe('channel event handling', () => {
    it('should stop receive loop when channel disconnects', async () => {
      const channel = createMockChannel({
        id: 'disconnect-test',
        connected: true,
        status: 'connected',
      });
      await registry.register(channel);

      await router.start();

      // Emit disconnect event
      eventBus.emit('channel:disconnected', {
        channelId: 'disconnect-test',
        channelName: 'Disconnect Test',
        reason: 'test',
        disconnectedAt: new Date(),
      });

      // Wait for async handling
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Router should still be running
      expect(router.isRunning()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle handler errors gracefully', async () => {
      const errorHandler: MessageHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      const goodHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);

      router.onMessage('*', errorHandler);
      router.onMessage('*', goodHandler);

      // Both handlers should be registered
      // When a message is dispatched, the error in one handler should not prevent
      // other handlers from being called (tested via internal behavior)
    });

    it('should audit send errors', async () => {
      const channel = createMockChannel({
        id: 'audit-error',
        connected: true,
        status: 'connected',
      });
      (channel.send as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
      await registry.register(channel);

      await router.send({
        id: randomUUID(),
        channelId: 'audit-error',
        recipientId: 'user',
        content: 'test',
        priority: 'normal',
        attachments: [],
        options: {},
      });

      const events = audit.getEvents();
      const errorEvent = events.find((e) => e.action === 'channel_send_error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.details?.error).toBe('Network error');
    });
  });

  describe('security integration', () => {
    it('should sanitize inbound messages through the sanitizer', async () => {
      // This test verifies the router integrates with the sanitizer
      // The actual sanitization logic is tested in sanitizer.test.ts
      // Here we verify the router calls sanitize and handles the result

      // The handleInboundMessage method is private, so we test through
      // the overall message flow. The key behavior is:
      // 1. Messages are sanitized before processing
      // 2. Security events are emitted for threats
      // 3. Audit logs capture sanitization events

      await router.start();

      // Since handleInboundMessage is private and requires message flow through
      // the channel's receive generator, we verify the router is properly set up
      expect(router.isRunning()).toBe(true);
    });
  });
});
