import { describe, it, expect } from 'vitest';
import {
  ChannelTypeSchema,
  ChannelStatusSchema,
  MessageDirectionSchema,
  MessagePrioritySchema,
  AttachmentSchema,
  InboundMessageSchema,
  OutboundMessageSchema,
  SendResultSchema,
  RateLimitSchema,
  ChannelCapabilitiesSchema,
  ChannelConfigSchema,
  NormalizedMessageSchema,
  normalizeInbound,
  normalizeOutbound,
  type InboundMessage,
  type OutboundMessage,
} from '../../../src/channels/types.js';

describe('Channel Types - Zod Schemas', () => {
  describe('ChannelTypeSchema', () => {
    it('should accept valid channel types', () => {
      expect(ChannelTypeSchema.parse('push')).toBe('push');
      expect(ChannelTypeSchema.parse('poll')).toBe('poll');
      expect(ChannelTypeSchema.parse('websocket')).toBe('websocket');
      expect(ChannelTypeSchema.parse('bidirectional')).toBe('bidirectional');
    });

    it('should reject invalid channel types', () => {
      expect(() => ChannelTypeSchema.parse('invalid')).toThrow();
      expect(() => ChannelTypeSchema.parse('')).toThrow();
      expect(() => ChannelTypeSchema.parse(123)).toThrow();
    });
  });

  describe('ChannelStatusSchema', () => {
    it('should accept valid channel statuses', () => {
      expect(ChannelStatusSchema.parse('connected')).toBe('connected');
      expect(ChannelStatusSchema.parse('disconnected')).toBe('disconnected');
      expect(ChannelStatusSchema.parse('connecting')).toBe('connecting');
      expect(ChannelStatusSchema.parse('error')).toBe('error');
      expect(ChannelStatusSchema.parse('rate_limited')).toBe('rate_limited');
    });

    it('should reject invalid channel statuses', () => {
      expect(() => ChannelStatusSchema.parse('unknown')).toThrow();
      expect(() => ChannelStatusSchema.parse(null)).toThrow();
    });
  });

  describe('MessageDirectionSchema', () => {
    it('should accept valid message directions', () => {
      expect(MessageDirectionSchema.parse('inbound')).toBe('inbound');
      expect(MessageDirectionSchema.parse('outbound')).toBe('outbound');
    });

    it('should reject invalid message directions', () => {
      expect(() => MessageDirectionSchema.parse('both')).toThrow();
    });
  });

  describe('MessagePrioritySchema', () => {
    it('should accept valid message priorities', () => {
      expect(MessagePrioritySchema.parse('lowest')).toBe('lowest');
      expect(MessagePrioritySchema.parse('low')).toBe('low');
      expect(MessagePrioritySchema.parse('normal')).toBe('normal');
      expect(MessagePrioritySchema.parse('high')).toBe('high');
      expect(MessagePrioritySchema.parse('emergency')).toBe('emergency');
    });

    it('should reject invalid message priorities', () => {
      expect(() => MessagePrioritySchema.parse('critical')).toThrow();
      expect(() => MessagePrioritySchema.parse('urgent')).toThrow();
    });
  });

  describe('AttachmentSchema', () => {
    it('should accept valid attachment with minimal fields', () => {
      const attachment = {
        id: 'att-123',
        type: 'image',
      };
      const result = AttachmentSchema.parse(attachment);
      expect(result.id).toBe('att-123');
      expect(result.type).toBe('image');
    });

    it('should accept valid attachment with all fields', () => {
      const attachment = {
        id: 'att-123',
        type: 'file',
        url: 'https://example.com/file.pdf',
        data: 'base64encodeddata',
        mimeType: 'application/pdf',
        filename: 'document.pdf',
        size: 1024,
        metadata: { custom: 'value' },
      };
      const result = AttachmentSchema.parse(attachment);
      expect(result.filename).toBe('document.pdf');
      expect(result.size).toBe(1024);
    });

    it('should accept all valid attachment types', () => {
      const types = ['image', 'audio', 'video', 'file', 'location'];
      for (const type of types) {
        const result = AttachmentSchema.parse({ id: '1', type });
        expect(result.type).toBe(type);
      }
    });

    it('should reject invalid attachment type', () => {
      expect(() => AttachmentSchema.parse({ id: '1', type: 'document' })).toThrow();
    });

    it('should reject invalid URL format', () => {
      expect(() =>
        AttachmentSchema.parse({
          id: '1',
          type: 'image',
          url: 'not-a-valid-url',
        })
      ).toThrow();
    });
  });

  describe('InboundMessageSchema', () => {
    it('should accept valid inbound message with required fields', () => {
      const message = {
        id: 'msg-123',
        channelId: 'sms',
        senderId: 'user-456',
        content: 'Hello world',
        timestamp: new Date(),
      };
      const result = InboundMessageSchema.parse(message);
      expect(result.id).toBe('msg-123');
      expect(result.channelId).toBe('sms');
      expect(result.senderId).toBe('user-456');
      expect(result.content).toBe('Hello world');
      expect(result.trustLevel).toBe('standard'); // default
      expect(result.attachments).toEqual([]); // default
      expect(result.metadata).toEqual({}); // default
    });

    it('should accept valid inbound message with all fields', () => {
      const message = {
        id: 'msg-123',
        channelId: 'slack',
        senderId: 'user-456',
        senderName: 'John Doe',
        groupId: 'channel-789',
        content: 'Hello team',
        timestamp: new Date(),
        trustLevel: 'verified',
        attachments: [{ id: 'att-1', type: 'image' as const }],
        replyTo: 'msg-100',
        metadata: { thread: 'abc123' },
      };
      const result = InboundMessageSchema.parse(message);
      expect(result.senderName).toBe('John Doe');
      expect(result.groupId).toBe('channel-789');
      expect(result.trustLevel).toBe('verified');
      expect(result.attachments).toHaveLength(1);
      expect(result.replyTo).toBe('msg-100');
    });

    it('should reject inbound message missing required fields', () => {
      expect(() => InboundMessageSchema.parse({ id: 'msg-123' })).toThrow();
      expect(() =>
        InboundMessageSchema.parse({
          id: 'msg-123',
          channelId: 'sms',
        })
      ).toThrow();
    });

    it('should reject invalid trust level', () => {
      expect(() =>
        InboundMessageSchema.parse({
          id: 'msg-123',
          channelId: 'sms',
          senderId: 'user',
          content: 'test',
          timestamp: new Date(),
          trustLevel: 'admin',
        })
      ).toThrow();
    });
  });

  describe('OutboundMessageSchema', () => {
    it('should accept valid outbound message with required fields', () => {
      const message = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        channelId: 'sms',
        recipientId: 'user-456',
        content: 'Hello!',
      };
      const result = OutboundMessageSchema.parse(message);
      expect(result.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(result.priority).toBe('normal'); // default
      expect(result.attachments).toEqual([]); // default
      expect(result.options).toEqual({}); // default
    });

    it('should accept valid outbound message with all fields', () => {
      const message = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        channelId: 'slack',
        recipientId: 'user-456',
        groupId: 'channel-789',
        content: 'Important update',
        priority: 'high',
        attachments: [{ id: 'att-1', type: 'file' as const }],
        sessionId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        replyTo: 'msg-100',
        options: { format: 'markdown' },
      };
      const result = OutboundMessageSchema.parse(message);
      expect(result.priority).toBe('high');
      expect(result.sessionId).toBe('b2c3d4e5-f6a7-8901-bcde-f12345678901');
    });

    it('should reject outbound message with invalid UUID', () => {
      expect(() =>
        OutboundMessageSchema.parse({
          id: 'not-a-uuid',
          channelId: 'sms',
          recipientId: 'user',
          content: 'test',
        })
      ).toThrow();
    });

    it('should reject invalid priority', () => {
      expect(() =>
        OutboundMessageSchema.parse({
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          channelId: 'sms',
          recipientId: 'user',
          content: 'test',
          priority: 'urgent',
        })
      ).toThrow();
    });
  });

  describe('SendResultSchema', () => {
    it('should accept successful send result', () => {
      const result = {
        success: true,
        messageId: 'msg-123',
        channelMessageId: 'ch-msg-456',
        timestamp: new Date(),
      };
      const parsed = SendResultSchema.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.messageId).toBe('msg-123');
    });

    it('should accept failed send result with error', () => {
      const result = {
        success: false,
        timestamp: new Date(),
        error: 'Channel not connected',
        retryAfter: 5000,
      };
      const parsed = SendResultSchema.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Channel not connected');
      expect(parsed.retryAfter).toBe(5000);
    });

    it('should require success and timestamp fields', () => {
      expect(() => SendResultSchema.parse({ success: true })).toThrow();
      expect(() => SendResultSchema.parse({ timestamp: new Date() })).toThrow();
    });
  });

  describe('RateLimitSchema', () => {
    it('should accept valid rate limit config', () => {
      const rateLimit = {
        maxMessages: 100,
        windowMs: 60000,
      };
      const result = RateLimitSchema.parse(rateLimit);
      expect(result.maxMessages).toBe(100);
      expect(result.windowMs).toBe(60000);
      expect(result.currentCount).toBe(0); // default
      expect(result.limited).toBe(false); // default
    });

    it('should accept rate limit with all fields', () => {
      const now = new Date();
      const rateLimit = {
        maxMessages: 100,
        windowMs: 60000,
        currentCount: 50,
        windowStart: now,
        limited: false,
        resetAt: new Date(now.getTime() + 30000),
      };
      const result = RateLimitSchema.parse(rateLimit);
      expect(result.currentCount).toBe(50);
      expect(result.windowStart).toEqual(now);
    });
  });

  describe('ChannelCapabilitiesSchema', () => {
    it('should accept empty capabilities with defaults', () => {
      const result = ChannelCapabilitiesSchema.parse({});
      expect(result.typingIndicator).toBe(false);
      expect(result.reactions).toBe(false);
      expect(result.attachments).toBe(false);
      expect(result.replies).toBe(false);
      expect(result.editing).toBe(false);
      expect(result.deletion).toBe(false);
      expect(result.readReceipts).toBe(false);
      expect(result.supportedAttachments).toEqual([]);
    });

    it('should accept full capabilities', () => {
      const capabilities = {
        typingIndicator: true,
        reactions: true,
        attachments: true,
        replies: true,
        editing: true,
        deletion: true,
        readReceipts: true,
        maxMessageLength: 4000,
        supportedAttachments: ['image', 'file', 'video'],
      };
      const result = ChannelCapabilitiesSchema.parse(capabilities);
      expect(result.typingIndicator).toBe(true);
      expect(result.maxMessageLength).toBe(4000);
      expect(result.supportedAttachments).toEqual(['image', 'file', 'video']);
    });
  });

  describe('ChannelConfigSchema', () => {
    it('should accept valid channel config with required fields', () => {
      const config = {
        id: 'sms-channel',
        name: 'SMS Channel',
        type: 'push',
      };
      const result = ChannelConfigSchema.parse(config);
      expect(result.id).toBe('sms-channel');
      expect(result.name).toBe('SMS Channel');
      expect(result.type).toBe('push');
      expect(result.enabled).toBe(true); // default
      expect(result.defaultTrustLevel).toBe('standard'); // default
      expect(result.settings).toEqual({}); // default
    });

    it('should accept full channel config', () => {
      const config = {
        id: 'slack-channel',
        name: 'Slack Channel',
        type: 'websocket',
        enabled: false,
        defaultTrustLevel: 'verified',
        rateLimit: { maxMessages: 100, windowMs: 60000 },
        capabilities: { reactions: true, replies: true },
        settings: { workspace: 'my-workspace' },
      };
      const result = ChannelConfigSchema.parse(config);
      expect(result.enabled).toBe(false);
      expect(result.defaultTrustLevel).toBe('verified');
      expect(result.rateLimit?.maxMessages).toBe(100);
      expect(result.capabilities?.reactions).toBe(true);
      expect(result.settings.workspace).toBe('my-workspace');
    });

    it('should reject invalid channel type in config', () => {
      expect(() =>
        ChannelConfigSchema.parse({
          id: 'test',
          name: 'Test',
          type: 'invalid',
        })
      ).toThrow();
    });
  });

  describe('NormalizedMessageSchema', () => {
    it('should accept valid normalized message', () => {
      const message = {
        id: 'msg-123',
        channelId: 'sms',
        channelName: 'SMS Channel',
        direction: 'inbound',
        senderId: 'user-456',
        content: 'Hello',
        timestamp: new Date(),
        trustLevel: 'standard',
      };
      const result = NormalizedMessageSchema.parse(message);
      expect(result.id).toBe('msg-123');
      expect(result.direction).toBe('inbound');
      expect(result.attachments).toEqual([]); // default
      expect(result.metadata).toEqual({}); // default
    });

    it('should accept normalized message with all optional fields', () => {
      const message = {
        id: 'msg-123',
        channelId: 'slack',
        channelName: 'Slack',
        direction: 'outbound',
        senderId: 'ari',
        senderName: 'ARI',
        recipientId: 'user-456',
        groupId: 'channel-789',
        sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        content: 'Response',
        timestamp: new Date(),
        trustLevel: 'system',
        priority: 'high',
        attachments: [{ id: 'att-1', type: 'file' as const }],
        replyTo: 'msg-100',
        metadata: { custom: 'data' },
      };
      const result = NormalizedMessageSchema.parse(message);
      expect(result.senderName).toBe('ARI');
      expect(result.recipientId).toBe('user-456');
      expect(result.priority).toBe('high');
    });
  });
});

describe('Channel Types - Normalization Functions', () => {
  describe('normalizeInbound', () => {
    it('should normalize inbound message correctly', () => {
      const inbound: InboundMessage = {
        id: 'msg-123',
        channelId: 'sms',
        senderId: 'user-456',
        senderName: 'John Doe',
        groupId: 'group-789',
        content: 'Hello world',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        trustLevel: 'verified',
        attachments: [{ id: 'att-1', type: 'image' }],
        replyTo: 'msg-100',
        metadata: { source: 'api' },
      };

      const result = normalizeInbound(inbound, 'SMS Channel', 'session-123');

      expect(result.id).toBe('msg-123');
      expect(result.channelId).toBe('sms');
      expect(result.channelName).toBe('SMS Channel');
      expect(result.direction).toBe('inbound');
      expect(result.senderId).toBe('user-456');
      expect(result.senderName).toBe('John Doe');
      expect(result.groupId).toBe('group-789');
      expect(result.sessionId).toBe('session-123');
      expect(result.content).toBe('Hello world');
      expect(result.timestamp).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(result.trustLevel).toBe('verified');
      expect(result.attachments).toHaveLength(1);
      expect(result.replyTo).toBe('msg-100');
      expect(result.metadata).toEqual({ source: 'api' });
    });

    it('should normalize inbound message without optional fields', () => {
      const inbound: InboundMessage = {
        id: 'msg-123',
        channelId: 'sms',
        senderId: 'user-456',
        content: 'Hello',
        timestamp: new Date(),
        trustLevel: 'standard',
        attachments: [],
        metadata: {},
      };

      const result = normalizeInbound(inbound, 'SMS Channel');

      expect(result.senderName).toBeUndefined();
      expect(result.groupId).toBeUndefined();
      expect(result.sessionId).toBeUndefined();
      expect(result.replyTo).toBeUndefined();
    });
  });

  describe('normalizeOutbound', () => {
    it('should normalize outbound message correctly', () => {
      const outbound: OutboundMessage = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        channelId: 'sms',
        recipientId: 'user-456',
        groupId: 'group-789',
        content: 'Hello from ARI',
        priority: 'high',
        attachments: [{ id: 'att-1', type: 'file' }],
        sessionId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        replyTo: 'msg-100',
        options: { format: 'plain' },
      };

      const result = normalizeOutbound(outbound, 'SMS Channel');

      expect(result.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(result.channelId).toBe('sms');
      expect(result.channelName).toBe('SMS Channel');
      expect(result.direction).toBe('outbound');
      expect(result.senderId).toBe('ari');
      expect(result.recipientId).toBe('user-456');
      expect(result.groupId).toBe('group-789');
      expect(result.sessionId).toBe('b2c3d4e5-f6a7-8901-bcde-f12345678901');
      expect(result.content).toBe('Hello from ARI');
      expect(result.trustLevel).toBe('system');
      expect(result.priority).toBe('high');
      expect(result.attachments).toHaveLength(1);
      expect(result.replyTo).toBe('msg-100');
      expect(result.metadata).toEqual({ format: 'plain' });
    });

    it('should generate timestamp for outbound message', () => {
      const before = new Date();
      const outbound: OutboundMessage = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        channelId: 'sms',
        recipientId: 'user-456',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = normalizeOutbound(outbound, 'SMS');
      const after = new Date();

      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should set sender to ari for outbound messages', () => {
      const outbound: OutboundMessage = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        channelId: 'sms',
        recipientId: 'user-456',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = normalizeOutbound(outbound, 'SMS');

      expect(result.senderId).toBe('ari');
      expect(result.trustLevel).toBe('system');
    });
  });
});
