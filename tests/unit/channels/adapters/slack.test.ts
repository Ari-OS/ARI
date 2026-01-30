import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';
import type { ChannelConfig, OutboundMessage } from '../../../../src/channels/types.js';
import { SlackChannel, createSlackChannel, type SlackConfig } from '../../../../src/channels/adapters/slack.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SlackChannel', () => {
  let channel: SlackChannel;
  const defaultChannelConfig: ChannelConfig = {
    id: 'slack-test',
    name: 'Slack Test',
    type: 'bidirectional',
    enabled: true,
    defaultTrustLevel: 'standard',
    settings: {},
  };

  const defaultSlackConfig: SlackConfig = {
    botToken: 'xoxb-test-token',
    signingSecret: 'test-signing-secret',
    defaultChannel: 'C12345678',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    channel = new SlackChannel(defaultChannelConfig, defaultSlackConfig);
  });

  afterEach(async () => {
    await channel.disconnect();
  });

  describe('Constructor', () => {
    it('should set channel type to bidirectional', () => {
      expect(channel.type).toBe('bidirectional');
    });

    it('should set default capabilities', () => {
      const caps = channel.getCapabilities();
      expect(caps.typingIndicator).toBe(false);
      expect(caps.reactions).toBe(true);
      expect(caps.attachments).toBe(true);
      expect(caps.replies).toBe(true);
      expect(caps.editing).toBe(true);
      expect(caps.deletion).toBe(true);
      expect(caps.readReceipts).toBe(false);
      expect(caps.maxMessageLength).toBe(40000);
      expect(caps.supportedAttachments).toEqual(['image', 'file']);
    });

    it('should use correct API base URL', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, user_id: 'U12345', team: 'TestTeam' }),
      });

      await channel.connect();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/auth.test',
        expect.any(Object)
      );
    });
  });

  describe('Connect', () => {
    it('should throw error if bot token is missing', async () => {
      const badConfig: SlackConfig = {
        botToken: '',
      };
      const badChannel = new SlackChannel(defaultChannelConfig, badConfig);

      await expect(badChannel.connect()).rejects.toThrow('Slack bot token is required');
    });

    it('should verify token and connect successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, user_id: 'U12345', team: 'TestTeam' }),
      });

      await channel.connect();

      expect(channel.isConnected()).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/auth.test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer xoxb-test-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should throw error if token verification fails', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: false, error: 'invalid_auth' }),
      });

      await expect(channel.connect()).rejects.toThrow('Failed to verify Slack bot token');
    });
  });

  describe('Disconnect', () => {
    it('should disconnect and set status', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, user_id: 'U12345', team: 'TestTeam' }),
      });

      await channel.connect();
      expect(channel.isConnected()).toBe(true);

      await channel.disconnect();
      expect(channel.isConnected()).toBe(false);
      expect(channel.getStatus()).toBe('disconnected');
    });
  });

  describe('Send Message', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, user_id: 'U12345', team: 'TestTeam' }),
      });
      await channel.connect();
    });

    it('should send basic message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, ts: '1234567890.123456', channel: 'C12345678' }),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'slack-test',
        recipientId: 'C12345678',
        content: 'Test message',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await channel.send(message);

      expect(result.success).toBe(true);
      expect(result.channelMessageId).toBe('1234567890.123456');
    });

    it('should use default channel when recipientId not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, ts: '1234567890.123456', channel: 'C12345678' }),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'slack-test',
        recipientId: '',
        content: 'Test message',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      await channel.send(message);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.channel).toBe('C12345678');
    });

    it('should include thread_ts for reply messages', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, ts: '1234567890.123456', channel: 'C12345678' }),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'slack-test',
        recipientId: 'C12345678',
        content: 'Reply message',
        priority: 'normal',
        attachments: [],
        options: {},
        replyTo: '1234567890.000000',
      };

      await channel.send(message);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.thread_ts).toBe('1234567890.000000');
    });

    it('should include blocks when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, ts: '1234567890.123456', channel: 'C12345678' }),
      });

      const blocks = [
        { type: 'section', text: { type: 'mrkdwn', text: '*Bold text*' } },
      ];

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'slack-test',
        recipientId: 'C12345678',
        content: 'Test message',
        priority: 'normal',
        attachments: [],
        options: { blocks },
      };

      await channel.send(message);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.blocks).toEqual(blocks);
    });

    it('should include unfurl options when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, ts: '1234567890.123456', channel: 'C12345678' }),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'slack-test',
        recipientId: 'C12345678',
        content: 'https://example.com',
        priority: 'normal',
        attachments: [],
        options: { unfurlLinks: false, unfurlMedia: true },
      };

      await channel.send(message);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.unfurl_links).toBe(false);
      expect(body.unfurl_media).toBe(true);
    });

    it('should handle send failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: false, error: 'channel_not_found' }),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'slack-test',
        recipientId: 'C99999999',
        content: 'Test message',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await channel.send(message);

      expect(result.success).toBe(false);
      // callApi returns null when ok: false, so doSend uses default error message
      expect(result.error).toBe('Failed to send message');
    });

    it('should handle send failure with default error', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: false }),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'slack-test',
        recipientId: 'C12345678',
        content: 'Test message',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await channel.send(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to send message');
    });

    it('should not send when not connected', async () => {
      await channel.disconnect();

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'slack-test',
        recipientId: 'C12345678',
        content: 'Test message',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await channel.send(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel not connected');
    });

    it('should handle API call errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'slack-test',
        recipientId: 'C12345678',
        content: 'Test message',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await channel.send(message);

      expect(result.success).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('React, Edit, and Delete', () => {
    it('should return false for react (not fully implemented)', () => {
      expect(channel.react('123', 'thumbsup')).toBe(false);
    });

    it('should return false for edit (not fully implemented)', () => {
      expect(channel.edit('123', 'new content')).toBe(false);
    });

    it('should return false for delete (not fully implemented)', () => {
      expect(channel.delete('123')).toBe(false);
    });
  });

  describe('Handle Event', () => {
    it('should process valid message event', () => {
      const event = {
        type: 'message',
        user: 'U12345678',
        channel: 'C12345678',
        text: 'Hello from Slack!',
        ts: '1234567890.123456',
      };

      channel.handleEvent(event);

      // Message should be queued - we need to verify via receive
    });

    it('should ignore non-message events', () => {
      const event = {
        type: 'reaction_added',
        user: 'U12345678',
        reaction: 'thumbsup',
      };

      // Should not throw
      channel.handleEvent(event);
    });

    it('should ignore events without text', () => {
      const event = {
        type: 'message',
        user: 'U12345678',
        channel: 'C12345678',
        // No text
      };

      // Should not throw
      channel.handleEvent(event);
    });

    it('should ignore events without user', () => {
      const event = {
        type: 'message',
        text: 'Bot message',
        channel: 'C12345678',
      };

      // Should not throw
      channel.handleEvent(event);
    });

    it('should filter events by allowed channels', () => {
      const restrictedConfig: SlackConfig = {
        ...defaultSlackConfig,
        allowedChannels: ['C11111111'],
      };
      const restrictedChannel = new SlackChannel(defaultChannelConfig, restrictedConfig);

      const event = {
        type: 'message',
        user: 'U12345678',
        channel: 'C99999999',
        text: 'Should be blocked',
        ts: '1234567890.123456',
      };

      // Should silently drop
      restrictedChannel.handleEvent(event);
    });

    it('should filter events by allowed users', () => {
      const restrictedConfig: SlackConfig = {
        ...defaultSlackConfig,
        allowedUsers: ['U11111111'],
      };
      const restrictedChannel = new SlackChannel(defaultChannelConfig, restrictedConfig);

      const event = {
        type: 'message',
        user: 'U99999999',
        channel: 'C12345678',
        text: 'Should be blocked',
        ts: '1234567890.123456',
      };

      // Should silently drop
      restrictedChannel.handleEvent(event);
    });

    it('should include thread info in metadata', () => {
      const event = {
        type: 'message',
        user: 'U12345678',
        channel: 'C12345678',
        text: 'Thread reply',
        ts: '1234567890.123456',
        thread_ts: '1234567890.000000',
      };

      channel.handleEvent(event);

      // Message with thread info should be queued
    });
  });

  describe('Signature Verification', () => {
    it('should verify valid signature', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = 'test body content';
      const sigBasestring = `v0:${timestamp}:${body}`;
      const expectedSignature = 'v0=' + createHmac('sha256', 'test-signing-secret')
        .update(sigBasestring)
        .digest('hex');

      const result = channel.verifySignature(expectedSignature, timestamp, body);

      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = 'test body content';
      // Create an invalid signature with same length as real one (v0= + 64 hex chars = 67 chars total)
      // timingSafeEqual requires same buffer lengths, so we need a 64-char hex string after v0=
      const invalidSignature = 'v0=0000000000000000000000000000000000000000000000000000000000000000';

      const result = channel.verifySignature(invalidSignature, timestamp, body);

      expect(result).toBe(false);
    });

    it('should return false when signing secret is not configured', () => {
      const noSecretConfig: SlackConfig = {
        botToken: 'xoxb-test-token',
        // No signing secret
      };
      const noSecretChannel = new SlackChannel(defaultChannelConfig, noSecretConfig);

      const result = noSecretChannel.verifySignature('any', 'any', 'any');

      expect(result).toBe(false);
    });

    it('should handle signature verification with different body content', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body1 = '{"event": "message"}';
      const body2 = '{"event": "different"}';

      const sigBasestring1 = `v0:${timestamp}:${body1}`;
      const signature1 = 'v0=' + createHmac('sha256', 'test-signing-secret')
        .update(sigBasestring1)
        .digest('hex');

      // Signature created for body1 should not work for body2
      const result = channel.verifySignature(signature1, timestamp, body2);
      expect(result).toBe(false);

      // Signature created for body1 should work for body1
      const result2 = channel.verifySignature(signature1, timestamp, body1);
      expect(result2).toBe(true);
    });
  });

  describe('createSlackChannel', () => {
    it('should create a SlackChannel instance', () => {
      const created = createSlackChannel(defaultChannelConfig, defaultSlackConfig);

      expect(created).toBeInstanceOf(SlackChannel);
      expect(created.id).toBe('slack-test');
      expect(created.name).toBe('Slack Test');
    });
  });

  describe('API Error Handling', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, user_id: 'U12345', team: 'TestTeam' }),
      });
      await channel.connect();
    });

    it('should log API errors to console', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: false, error: 'ratelimited' }),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'slack-test',
        recipientId: 'C12345678',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      await channel.send(message);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Slack API error'));

      consoleSpy.mockRestore();
    });

    it('should handle network errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockRejectedValueOnce(new Error('Connection timeout'));

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'slack-test',
        recipientId: 'C12345678',
        content: 'Test',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await channel.send(message);

      expect(result.success).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slack API call failed'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
