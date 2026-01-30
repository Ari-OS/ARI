import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import type { ChannelConfig, OutboundMessage } from '../../../../src/channels/types.js';
import { WebhookChannel, createWebhookChannel, type WebhookConfig } from '../../../../src/channels/adapters/webhook.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WebhookChannel', () => {
  let channel: WebhookChannel;
  const defaultChannelConfig: ChannelConfig = {
    id: 'webhook-test',
    name: 'Webhook Test',
    type: 'push',
    enabled: true,
    defaultTrustLevel: 'standard',
    settings: {},
  };

  const defaultWebhookConfig: WebhookConfig = {
    outboundUrl: 'https://example.com/webhook',
    method: 'POST',
    timeout: 5000,
    retry: {
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 1000,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    channel = new WebhookChannel(defaultChannelConfig, defaultWebhookConfig);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await channel.disconnect();
  });

  describe('Constructor', () => {
    it('should set channel type to push', () => {
      expect(channel.type).toBe('push');
    });

    it('should set default capabilities', () => {
      const caps = channel.getCapabilities();
      expect(caps.typingIndicator).toBe(false);
      expect(caps.reactions).toBe(false);
      expect(caps.attachments).toBe(true);
      expect(caps.replies).toBe(false);
      expect(caps.editing).toBe(false);
      expect(caps.deletion).toBe(false);
      expect(caps.readReceipts).toBe(false);
      expect(caps.maxMessageLength).toBeUndefined();
      expect(caps.supportedAttachments).toEqual(['image', 'file']);
    });
  });

  describe('Connect', () => {
    it('should throw error if outbound URL is missing', async () => {
      const badConfig: WebhookConfig = {
        outboundUrl: '',
      };
      const badChannel = new WebhookChannel(defaultChannelConfig, badConfig);

      await expect(badChannel.connect()).rejects.toThrow('Webhook outbound URL is required');
    });

    it('should throw error if URL is invalid', async () => {
      const badConfig: WebhookConfig = {
        outboundUrl: 'not-a-valid-url',
      };
      const badChannel = new WebhookChannel(defaultChannelConfig, badConfig);

      await expect(badChannel.connect()).rejects.toThrow('Invalid webhook URL');
    });

    it('should connect successfully with valid URL', async () => {
      await channel.connect();

      expect(channel.isConnected()).toBe(true);
      expect(channel.getStatus()).toBe('connected');
    });
  });

  describe('Disconnect', () => {
    it('should disconnect and set status', async () => {
      await channel.connect();
      expect(channel.isConnected()).toBe(true);

      await channel.disconnect();
      expect(channel.isConnected()).toBe(false);
      expect(channel.getStatus()).toBe('disconnected');
    });
  });

  describe('Send Message', () => {
    beforeEach(async () => {
      await channel.connect();
    });

    it('should send basic message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test message',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const sendPromise = channel.send(message);
      vi.runAllTimers();
      const result = await sendPromise;

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      );
    });

    it('should include correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test message',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const sendPromise = channel.send(message);
      vi.runAllTimers();
      await sendPromise;

      const lastCall = mockFetch.mock.calls[0];
      expect(lastCall[1].headers).toEqual(expect.objectContaining({
        'Content-Type': 'application/json',
        'User-Agent': 'ARI/2.0',
      }));
    });

    it('should build correct request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test message',
        priority: 'high',
        attachments: [
          {
            id: 'att-1',
            type: 'image',
            url: 'https://example.com/image.png',
            filename: 'image.png',
            mimeType: 'image/png',
            size: 1024,
          },
        ],
        sessionId: randomUUID(),
        replyTo: 'msg-456',
        options: { customField: 'value' },
      };

      const sendPromise = channel.send(message);
      vi.runAllTimers();
      await sendPromise;

      const lastCall = mockFetch.mock.calls[0];
      const body = JSON.parse(lastCall[1].body);

      expect(body.id).toBe(message.id);
      expect(body.recipient).toBe('recipient-123');
      expect(body.content).toBe('Test message');
      expect(body.priority).toBe('high');
      expect(body.sessionId).toBe(message.sessionId);
      expect(body.replyTo).toBe('msg-456');
      expect(body.customField).toBe('value');
      expect(body.attachments).toHaveLength(1);
      expect(body.attachments[0].type).toBe('image');
    });

    it('should extract message ID from response', async () => {
      const webhookWithResponseId: WebhookConfig = {
        ...defaultWebhookConfig,
        responseIdField: 'messageId',
      };
      const channelWithResponse = new WebhookChannel(defaultChannelConfig, webhookWithResponseId);
      await channelWithResponse.connect();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: 'response-msg-123' }),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test message',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const sendPromise = channelWithResponse.send(message);
      vi.runAllTimers();
      const result = await sendPromise;

      expect(result.success).toBe(true);
      expect(result.channelMessageId).toBe('response-msg-123');

      await channelWithResponse.disconnect();
    });

    it('should handle JSON parse error in response gracefully', async () => {
      const webhookWithResponseId: WebhookConfig = {
        ...defaultWebhookConfig,
        responseIdField: 'messageId',
      };
      const channelWithResponse = new WebhookChannel(defaultChannelConfig, webhookWithResponseId);
      await channelWithResponse.connect();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); },
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test message',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const sendPromise = channelWithResponse.send(message);
      vi.runAllTimers();
      const result = await sendPromise;

      // Should still succeed, just without messageId
      expect(result.success).toBe(true);
      expect(result.channelMessageId).toBeUndefined();

      await channelWithResponse.disconnect();
    });

    it('should not send when not connected', async () => {
      await channel.disconnect();

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test message',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await channel.send(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel not connected');
    });
  });

  describe('Authentication', () => {
    it('should add Bearer token when authType is bearer', async () => {
      const bearerConfig: WebhookConfig = {
        ...defaultWebhookConfig,
        authType: 'bearer',
        authToken: 'my-bearer-token',
      };
      const bearerChannel = new WebhookChannel(defaultChannelConfig, bearerConfig);
      await bearerChannel.connect();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const sendPromise = bearerChannel.send(message);
      vi.runAllTimers();
      await sendPromise;

      const lastCall = mockFetch.mock.calls[0];
      expect(lastCall[1].headers['Authorization']).toBe('Bearer my-bearer-token');

      await bearerChannel.disconnect();
    });

    it('should add Basic auth when authType is basic', async () => {
      const basicConfig: WebhookConfig = {
        ...defaultWebhookConfig,
        authType: 'basic',
        basicUsername: 'user',
        basicPassword: 'pass',
      };
      const basicChannel = new WebhookChannel(defaultChannelConfig, basicConfig);
      await basicChannel.connect();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const sendPromise = basicChannel.send(message);
      vi.runAllTimers();
      await sendPromise;

      const lastCall = mockFetch.mock.calls[0];
      const expectedAuth = 'Basic ' + Buffer.from('user:pass').toString('base64');
      expect(lastCall[1].headers['Authorization']).toBe(expectedAuth);

      await basicChannel.disconnect();
    });

    it('should add API key header when authType is apikey', async () => {
      const apikeyConfig: WebhookConfig = {
        ...defaultWebhookConfig,
        authType: 'apikey',
        authToken: 'my-api-key',
        authHeader: 'X-Custom-API-Key',
      };
      const apikeyChannel = new WebhookChannel(defaultChannelConfig, apikeyConfig);
      await apikeyChannel.connect();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const sendPromise = apikeyChannel.send(message);
      vi.runAllTimers();
      await sendPromise;

      const lastCall = mockFetch.mock.calls[0];
      expect(lastCall[1].headers['X-Custom-API-Key']).toBe('my-api-key');

      await apikeyChannel.disconnect();
    });

    it('should use default X-API-Key header when authHeader not specified', async () => {
      const apikeyConfig: WebhookConfig = {
        ...defaultWebhookConfig,
        authType: 'apikey',
        authToken: 'my-api-key',
      };
      const apikeyChannel = new WebhookChannel(defaultChannelConfig, apikeyConfig);
      await apikeyChannel.connect();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const sendPromise = apikeyChannel.send(message);
      vi.runAllTimers();
      await sendPromise;

      const lastCall = mockFetch.mock.calls[0];
      expect(lastCall[1].headers['X-API-Key']).toBe('my-api-key');

      await apikeyChannel.disconnect();
    });

    it('should include custom headers', async () => {
      const customHeadersConfig: WebhookConfig = {
        ...defaultWebhookConfig,
        headers: {
          'X-Custom-Header': 'custom-value',
          'X-Another-Header': 'another-value',
        },
      };
      const customChannel = new WebhookChannel(defaultChannelConfig, customHeadersConfig);
      await customChannel.connect();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const sendPromise = customChannel.send(message);
      vi.runAllTimers();
      await sendPromise;

      const lastCall = mockFetch.mock.calls[0];
      expect(lastCall[1].headers['X-Custom-Header']).toBe('custom-value');
      expect(lastCall[1].headers['X-Another-Header']).toBe('another-value');

      await customChannel.disconnect();
    });
  });

  describe('HTTP Method', () => {
    it('should use POST by default', async () => {
      await channel.connect();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const sendPromise = channel.send(message);
      vi.runAllTimers();
      await sendPromise;

      const lastCall = mockFetch.mock.calls[0];
      expect(lastCall[1].method).toBe('POST');
    });

    it('should use PUT when configured', async () => {
      const putConfig: WebhookConfig = {
        ...defaultWebhookConfig,
        method: 'PUT',
      };
      const putChannel = new WebhookChannel(defaultChannelConfig, putConfig);
      await putChannel.connect();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const sendPromise = putChannel.send(message);
      vi.runAllTimers();
      await sendPromise;

      const lastCall = mockFetch.mock.calls[0];
      expect(lastCall[1].method).toBe('PUT');

      await putChannel.disconnect();
    });
  });

  describe('Retry Logic', () => {
    // Note: Retry tests need real timers since they use actual delays
    // Each test creates its own channel to avoid state issues

    it('should retry on 5xx errors', async () => {
      // Use real timers for retry logic
      vi.useRealTimers();
      vi.clearAllMocks();

      const retryConfig: WebhookConfig = {
        outboundUrl: 'https://example.com/webhook',
        retry: {
          maxAttempts: 3,
          initialDelay: 10,
          maxDelay: 50,
        },
      };
      const retryChannel = new WebhookChannel(defaultChannelConfig, retryConfig);
      await retryChannel.connect();

      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' })
        .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await retryChannel.send(message);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      await retryChannel.disconnect();

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });

    it('should not retry on 4xx errors', async () => {
      // Use real timers for retry logic
      vi.useRealTimers();
      vi.clearAllMocks();

      const noRetryChannel = new WebhookChannel(defaultChannelConfig, {
        outboundUrl: 'https://example.com/webhook',
        retry: { maxAttempts: 3, initialDelay: 10, maxDelay: 50 },
      });
      await noRetryChannel.connect();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await noRetryChannel.send(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 400: Bad Request');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await noRetryChannel.disconnect();

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });

    it('should retry on network errors', async () => {
      // Use real timers for retry logic
      vi.useRealTimers();
      vi.clearAllMocks();

      const retryConfig: WebhookConfig = {
        outboundUrl: 'https://example.com/webhook',
        retry: {
          maxAttempts: 2,
          initialDelay: 10,
          maxDelay: 50,
        },
      };
      const retryChannel = new WebhookChannel(defaultChannelConfig, retryConfig);
      await retryChannel.connect();

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await retryChannel.send(message);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      await retryChannel.disconnect();

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });

    it('should fail after max retries', async () => {
      // Use real timers for retry logic
      vi.useRealTimers();
      vi.clearAllMocks();

      const retryConfig: WebhookConfig = {
        outboundUrl: 'https://example.com/webhook',
        retry: {
          maxAttempts: 2,
          initialDelay: 10,
          maxDelay: 50,
        },
      };
      const retryChannel = new WebhookChannel(defaultChannelConfig, retryConfig);
      await retryChannel.connect();

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Still failing'));

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await retryChannel.send(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Still failing');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      await retryChannel.disconnect();

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });

    it('should use default retry config when not specified', async () => {
      // Use real timers for retry logic
      vi.useRealTimers();
      vi.clearAllMocks();

      const noRetryConfig: WebhookConfig = {
        outboundUrl: 'https://example.com/webhook',
      };
      const noRetryChannel = new WebhookChannel(defaultChannelConfig, noRetryConfig);
      await noRetryChannel.connect();

      mockFetch
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'));

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await noRetryChannel.send(message);

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3); // default is 3 attempts

      await noRetryChannel.disconnect();

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });
  });

  describe('Timeout', () => {
    it('should abort request on timeout', async () => {
      vi.useRealTimers();

      const shortTimeoutConfig: WebhookConfig = {
        ...defaultWebhookConfig,
        timeout: 50,
        retry: { maxAttempts: 1, initialDelay: 10, maxDelay: 50 },
      };
      const timeoutChannel = new WebhookChannel(defaultChannelConfig, shortTimeoutConfig);
      await timeoutChannel.connect();

      mockFetch.mockImplementation(() =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Aborted')), 100);
        })
      );

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'webhook-test',
        recipientId: 'recipient-123',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await timeoutChannel.send(message);

      expect(result.success).toBe(false);

      await timeoutChannel.disconnect();
    });
  });

  describe('Inbound Webhook', () => {
    it('should handle valid inbound webhook with content field', () => {
      const body = {
        content: 'Incoming message',
        senderId: 'external-user-123',
        id: 'msg-123',
        senderName: 'External User',
        groupId: 'group-456',
        replyTo: 'msg-100',
      };

      const result = channel.handleInboundWebhook(body);

      expect(result).not.toBeNull();
      expect(result?.content).toBe('Incoming message');
      expect(result?.senderId).toBe('external-user-123');
      expect(result?.id).toBe('msg-123');
      expect(result?.senderName).toBe('External User');
      expect(result?.groupId).toBe('group-456');
      expect(result?.replyTo).toBe('msg-100');
    });

    it('should handle inbound webhook with message field', () => {
      const body = {
        message: 'Incoming message',
        sender: 'external-user-123',
      };

      const result = channel.handleInboundWebhook(body);

      expect(result).not.toBeNull();
      expect(result?.content).toBe('Incoming message');
      expect(result?.senderId).toBe('external-user-123');
    });

    it('should handle inbound webhook with text field', () => {
      const body = {
        text: 'Incoming message',
        from: 'external-user-123',
      };

      const result = channel.handleInboundWebhook(body);

      expect(result).not.toBeNull();
      expect(result?.content).toBe('Incoming message');
      expect(result?.senderId).toBe('external-user-123');
    });

    it('should handle inbound webhook with user field for sender', () => {
      const body = {
        content: 'Incoming message',
        user: 'external-user-123',
      };

      const result = channel.handleInboundWebhook(body);

      expect(result).not.toBeNull();
      expect(result?.senderId).toBe('external-user-123');
    });

    it('should return null for invalid inbound webhook (missing content)', () => {
      const body = {
        senderId: 'external-user-123',
      };

      const result = channel.handleInboundWebhook(body);

      expect(result).toBeNull();
    });

    it('should return null for invalid inbound webhook (missing sender)', () => {
      const body = {
        content: 'Incoming message',
      };

      const result = channel.handleInboundWebhook(body);

      expect(result).toBeNull();
    });

    it('should return null for non-string content', () => {
      const body = {
        content: { nested: 'object' },
        senderId: 'user-123',
      };

      const result = channel.handleInboundWebhook(body);

      expect(result).toBeNull();
    });

    it('should return null for non-string senderId', () => {
      const body = {
        content: 'Message',
        senderId: 12345,
      };

      const result = channel.handleInboundWebhook(body);

      expect(result).toBeNull();
    });

    it('should include raw body and headers in metadata', () => {
      const body = {
        content: 'Incoming message',
        senderId: 'external-user-123',
        extraField: 'extra value',
      };
      const headers = {
        'X-Request-ID': 'req-123',
        'Content-Type': 'application/json',
      };

      const result = channel.handleInboundWebhook(body, headers);

      expect(result).not.toBeNull();
      expect(result?.metadata?.raw).toEqual(body);
      expect(result?.metadata?.headers).toEqual(headers);
    });

    it('should handle optional fields being wrong types gracefully', () => {
      const body = {
        content: 'Message',
        senderId: 'user-123',
        id: 12345, // Should be string
        senderName: true, // Should be string
        groupId: { nested: 'object' }, // Should be string
        replyTo: ['array'], // Should be string
      };

      const result = channel.handleInboundWebhook(body);

      expect(result).not.toBeNull();
      expect(result?.id).not.toBe(12345); // Should be generated UUID
      expect(result?.senderName).toBeUndefined();
      expect(result?.groupId).toBeUndefined();
      expect(result?.replyTo).toBeUndefined();
    });
  });

  describe('createWebhookChannel', () => {
    it('should create a WebhookChannel instance', () => {
      const created = createWebhookChannel(defaultChannelConfig, defaultWebhookConfig);

      expect(created).toBeInstanceOf(WebhookChannel);
      expect(created.id).toBe('webhook-test');
      expect(created.name).toBe('Webhook Test');
    });
  });
});
