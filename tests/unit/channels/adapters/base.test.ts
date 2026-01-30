import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import type {
  ChannelConfig,
  OutboundMessage,
  SendResult,
  ChannelCapabilities,
} from '../../../../src/channels/types.js';
import { BaseChannel } from '../../../../src/channels/adapters/base.js';

/**
 * Concrete implementation of BaseChannel for testing
 */
class TestChannel extends BaseChannel {
  public connectCalled = false;
  public disconnectCalled = false;
  public doSendResult: SendResult = {
    success: true,
    messageId: 'test-msg-id',
    channelMessageId: 'channel-msg-id',
    timestamp: new Date(),
  };
  public doSendError: Error | null = null;

  async connect(): Promise<void> {
    this.connectCalled = true;
    this.setStatus('connected');
  }

  async disconnect(): Promise<void> {
    this.disconnectCalled = true;
    this.setStatus('disconnected');
  }

  protected async doSend(_message: OutboundMessage): Promise<SendResult> {
    if (this.doSendError) {
      throw this.doSendError;
    }
    return this.doSendResult;
  }

  // Expose protected methods for testing
  public testSetStatus(status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'rate_limited') {
    this.setStatus(status);
  }

  public testQueueMessage(message: Parameters<BaseChannel['createInboundMessage']>[0], senderId: string) {
    const inbound = this.createInboundMessage(message, senderId);
    this.queueMessage(inbound);
    return inbound;
  }

  public testCreateInboundMessage(
    content: string,
    senderId: string,
    options?: Parameters<BaseChannel['createInboundMessage']>[2]
  ) {
    return this.createInboundMessage(content, senderId, options);
  }

  public testCreateSendResult(
    success: boolean,
    channelMessageId?: string,
    error?: string
  ) {
    return this.createSendResult(success, channelMessageId, error);
  }

  public testWaitForMessage() {
    return this.waitForMessage();
  }

  public getMessageQueueLength() {
    return this.messageQueue.length;
  }

  public getListenersCount() {
    return this.listeners.size;
  }
}

describe('BaseChannel', () => {
  let channel: TestChannel;
  const defaultConfig: ChannelConfig = {
    id: 'test-channel',
    name: 'Test Channel',
    type: 'bidirectional',
    enabled: true,
    defaultTrustLevel: 'standard',
    settings: {},
  };

  beforeEach(() => {
    channel = new TestChannel(defaultConfig);
  });

  describe('Constructor', () => {
    it('should initialize with correct id, name, and type', () => {
      expect(channel.id).toBe('test-channel');
      expect(channel.name).toBe('Test Channel');
      expect(channel.type).toBe('bidirectional');
    });

    it('should initialize with disconnected status', () => {
      expect(channel.getStatus()).toBe('disconnected');
      expect(channel.isConnected()).toBe(false);
    });

    it('should set default capabilities', () => {
      const caps = channel.getCapabilities();
      expect(caps.typingIndicator).toBe(false);
      expect(caps.reactions).toBe(false);
      expect(caps.attachments).toBe(false);
      expect(caps.replies).toBe(false);
      expect(caps.editing).toBe(false);
      expect(caps.deletion).toBe(false);
      expect(caps.readReceipts).toBe(false);
      expect(caps.maxMessageLength).toBeUndefined();
      expect(caps.supportedAttachments).toEqual([]);
    });

    it('should merge custom capabilities with defaults', () => {
      const customConfig: ChannelConfig = {
        ...defaultConfig,
        capabilities: {
          typingIndicator: true,
          attachments: true,
          maxMessageLength: 1000,
        },
      };
      const customChannel = new TestChannel(customConfig);
      const caps = customChannel.getCapabilities();

      expect(caps.typingIndicator).toBe(true);
      expect(caps.attachments).toBe(true);
      expect(caps.maxMessageLength).toBe(1000);
      expect(caps.reactions).toBe(false); // default preserved
    });

    it('should initialize rate limiter with default config', () => {
      const rateLimit = channel.getRateLimit();
      expect(rateLimit.maxMessages).toBe(60);
      expect(rateLimit.windowMs).toBe(60000);
      expect(rateLimit.limited).toBe(false);
    });

    it('should initialize rate limiter with custom config', () => {
      const customConfig: ChannelConfig = {
        ...defaultConfig,
        rateLimit: {
          maxMessages: 100,
          windowMs: 30000,
        },
      };
      const customChannel = new TestChannel(customConfig);
      const rateLimit = customChannel.getRateLimit();

      expect(rateLimit.maxMessages).toBe(100);
      expect(rateLimit.windowMs).toBe(30000);
    });
  });

  describe('Status Management', () => {
    it('should report isConnected correctly based on status', () => {
      expect(channel.isConnected()).toBe(false);

      channel.testSetStatus('connecting');
      expect(channel.isConnected()).toBe(false);

      channel.testSetStatus('connected');
      expect(channel.isConnected()).toBe(true);

      channel.testSetStatus('error');
      expect(channel.isConnected()).toBe(false);

      channel.testSetStatus('disconnected');
      expect(channel.isConnected()).toBe(false);
    });

    it('should return correct status via getStatus', () => {
      expect(channel.getStatus()).toBe('disconnected');

      channel.testSetStatus('connecting');
      expect(channel.getStatus()).toBe('connecting');

      channel.testSetStatus('connected');
      expect(channel.getStatus()).toBe('connected');

      channel.testSetStatus('error');
      expect(channel.getStatus()).toBe('error');

      channel.testSetStatus('rate_limited');
      expect(channel.getStatus()).toBe('rate_limited');
    });
  });

  describe('Send Message', () => {
    it('should fail when not connected', async () => {
      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'test-channel',
        recipientId: 'user-123',
        content: 'Hello',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await channel.send(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel not connected');
    });

    it('should succeed when connected', async () => {
      await channel.connect();

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'test-channel',
        recipientId: 'user-123',
        content: 'Hello',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await channel.send(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-msg-id');
      expect(result.channelMessageId).toBe('channel-msg-id');
    });

    it('should fail when rate limited', async () => {
      // Create channel with very low rate limit
      const limitedConfig: ChannelConfig = {
        ...defaultConfig,
        rateLimit: {
          maxMessages: 1,
          windowMs: 60000,
        },
      };
      const limitedChannel = new TestChannel(limitedConfig);
      await limitedChannel.connect();

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'test-channel',
        recipientId: 'user-123',
        content: 'Hello',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      // First message should succeed
      const result1 = await limitedChannel.send(message);
      expect(result1.success).toBe(true);

      // Second message should be rate limited
      const result2 = await limitedChannel.send(message);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Rate limited');
      expect(result2.retryAfter).toBeDefined();
    });

    it('should handle doSend errors', async () => {
      await channel.connect();
      channel.doSendError = new Error('API Error');

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'test-channel',
        recipientId: 'user-123',
        content: 'Hello',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await channel.send(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });

    it('should handle non-Error throws in doSend', async () => {
      await channel.connect();
      channel.doSendError = 'String error' as unknown as Error;

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'test-channel',
        recipientId: 'user-123',
        content: 'Hello',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await channel.send(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });

  describe('Message Queueing', () => {
    it('should queue inbound messages', () => {
      channel.testQueueMessage('Test message', 'sender-123');

      expect(channel.getMessageQueueLength()).toBe(1);
    });

    it('should notify listeners instead of queueing when listeners exist', async () => {
      await channel.connect();

      // Start waiting for message before queueing
      const messagePromise = channel.testWaitForMessage();

      // Queue a message
      channel.testQueueMessage('Test message', 'sender-123');

      // Should receive the message via listener
      const received = await messagePromise;

      expect(received).not.toBeNull();
      expect(received?.content).toBe('Test message');
      expect(received?.senderId).toBe('sender-123');
      expect(channel.getMessageQueueLength()).toBe(0);
    });

    it('should yield queued messages via receive iterator', async () => {
      await channel.connect();

      // Queue some messages first
      channel.testQueueMessage('Message 1', 'sender-1');
      channel.testQueueMessage('Message 2', 'sender-2');

      const messages: string[] = [];
      const iterator = channel.receive()[Symbol.asyncIterator]();

      // Get first two messages (queued)
      const msg1 = await iterator.next();
      const msg2 = await iterator.next();

      if (!msg1.done) messages.push(msg1.value.content);
      if (!msg2.done) messages.push(msg2.value.content);

      expect(messages).toEqual(['Message 1', 'Message 2']);
    });
  });

  describe('waitForMessage', () => {
    it('should return null when not connected', async () => {
      const result = await channel.testWaitForMessage();
      expect(result).toBeNull();
    });

    it('should return queued message immediately', async () => {
      await channel.connect();
      channel.testQueueMessage('Queued message', 'sender-1');

      const result = await channel.testWaitForMessage();

      expect(result).not.toBeNull();
      expect(result?.content).toBe('Queued message');
    });

    it('should timeout after 30 seconds', async () => {
      vi.useFakeTimers();
      await channel.connect();

      const waitPromise = channel.testWaitForMessage();

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);

      const result = await waitPromise;
      expect(result).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('Capabilities', () => {
    it('should correctly report boolean capabilities', () => {
      const customConfig: ChannelConfig = {
        ...defaultConfig,
        capabilities: {
          typingIndicator: true,
          reactions: false,
          attachments: true,
        },
      };
      const customChannel = new TestChannel(customConfig);

      expect(customChannel.supportsCapability('typingIndicator')).toBe(true);
      expect(customChannel.supportsCapability('reactions')).toBe(false);
      expect(customChannel.supportsCapability('attachments')).toBe(true);
    });

    it('should correctly report array capabilities', () => {
      const customConfig: ChannelConfig = {
        ...defaultConfig,
        capabilities: {
          supportedAttachments: ['image', 'file'],
        },
      };
      const customChannel = new TestChannel(customConfig);

      expect(customChannel.supportsCapability('supportedAttachments')).toBe(true);
    });

    it('should correctly report number capabilities', () => {
      const customConfig: ChannelConfig = {
        ...defaultConfig,
        capabilities: {
          maxMessageLength: 1000,
        },
      };
      const customChannel = new TestChannel(customConfig);

      expect(customChannel.supportsCapability('maxMessageLength')).toBe(true);
    });

    it('should return copy of capabilities', () => {
      const caps1 = channel.getCapabilities();
      const caps2 = channel.getCapabilities();

      expect(caps1).toEqual(caps2);
      expect(caps1).not.toBe(caps2); // Different objects
    });
  });

  describe('Rate Limit Management', () => {
    it('should get rate limit state', () => {
      const state = channel.getRateLimit();

      expect(state.maxMessages).toBe(60);
      expect(state.windowMs).toBe(60000);
      expect(state.currentCount).toBeDefined();
      expect(state.limited).toBe(false);
    });

    it('should update rate limit configuration', () => {
      channel.setRateLimit({
        maxMessages: 100,
        windowMs: 30000,
      });

      const state = channel.getRateLimit();
      expect(state.maxMessages).toBe(100);
      expect(state.windowMs).toBe(30000);
    });
  });

  describe('Configuration Management', () => {
    it('should return copy of config', () => {
      const config1 = channel.getConfig();
      const config2 = channel.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });

    it('should update config', () => {
      channel.updateConfig({
        name: 'Updated Name',
      });

      const config = channel.getConfig();
      expect(config.name).toBe('Updated Name');
      expect(config.id).toBe('test-channel'); // preserved
    });

    it('should update capabilities when config updated', () => {
      channel.updateConfig({
        capabilities: {
          typingIndicator: true,
        },
      });

      const caps = channel.getCapabilities();
      expect(caps.typingIndicator).toBe(true);
    });

    it('should update rate limit when config updated', () => {
      channel.updateConfig({
        rateLimit: {
          maxMessages: 200,
        },
      });

      const state = channel.getRateLimit();
      expect(state.maxMessages).toBe(200);
    });
  });

  describe('createInboundMessage', () => {
    it('should create message with required fields', () => {
      const msg = channel.testCreateInboundMessage('Hello', 'sender-1');

      expect(msg.content).toBe('Hello');
      expect(msg.senderId).toBe('sender-1');
      expect(msg.channelId).toBe('test-channel');
      expect(msg.timestamp).toBeInstanceOf(Date);
      expect(msg.trustLevel).toBe('standard');
      expect(msg.attachments).toEqual([]);
      expect(msg.metadata).toEqual({});
    });

    it('should create message with optional fields', () => {
      const msg = channel.testCreateInboundMessage('Hello', 'sender-1', {
        id: 'custom-id',
        senderName: 'John Doe',
        groupId: 'group-123',
        replyTo: 'msg-456',
        metadata: { foo: 'bar' },
      });

      expect(msg.id).toBe('custom-id');
      expect(msg.senderName).toBe('John Doe');
      expect(msg.groupId).toBe('group-123');
      expect(msg.replyTo).toBe('msg-456');
      expect(msg.metadata).toEqual({ foo: 'bar' });
    });

    it('should generate UUID if id not provided', () => {
      const msg = channel.testCreateInboundMessage('Hello', 'sender-1');

      // UUID format check
      expect(msg.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should use channel default trust level', () => {
      const trustedConfig: ChannelConfig = {
        ...defaultConfig,
        defaultTrustLevel: 'verified',
      };
      const trustedChannel = new TestChannel(trustedConfig);

      const msg = trustedChannel.testCreateInboundMessage('Hello', 'sender-1');
      expect(msg.trustLevel).toBe('verified');
    });
  });

  describe('createSendResult', () => {
    it('should create success result', () => {
      const result = channel.testCreateSendResult(true, 'channel-msg-123');

      expect(result.success).toBe(true);
      expect(result.channelMessageId).toBe('channel-msg-123');
      expect(result.messageId).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.error).toBeUndefined();
    });

    it('should create failure result', () => {
      const result = channel.testCreateSendResult(false, undefined, 'API Error');

      expect(result.success).toBe(false);
      expect(result.channelMessageId).toBeUndefined();
      expect(result.error).toBe('API Error');
    });

    it('should generate unique message IDs', () => {
      const result1 = channel.testCreateSendResult(true);
      const result2 = channel.testCreateSendResult(true);

      expect(result1.messageId).not.toBe(result2.messageId);
    });
  });

  describe('Connect and Disconnect', () => {
    it('should call connect implementation', async () => {
      await channel.connect();

      expect(channel.connectCalled).toBe(true);
      expect(channel.isConnected()).toBe(true);
    });

    it('should call disconnect implementation', async () => {
      await channel.connect();
      await channel.disconnect();

      expect(channel.disconnectCalled).toBe(true);
      expect(channel.isConnected()).toBe(false);
    });
  });
});
