import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import type { ChannelConfig, OutboundMessage } from '../../../../src/channels/types.js';
import { TelegramChannel, createTelegramChannel, type TelegramConfig } from '../../../../src/channels/adapters/telegram.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('TelegramChannel', () => {
  let channel: TelegramChannel;
  const defaultChannelConfig: ChannelConfig = {
    id: 'telegram-test',
    name: 'Telegram Test',
    type: 'bidirectional',
    enabled: true,
    defaultTrustLevel: 'standard',
    settings: {},
  };

  const defaultTelegramConfig: TelegramConfig = {
    botToken: 'test-bot-token',
    parseMode: 'HTML',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    channel = new TelegramChannel(defaultChannelConfig, defaultTelegramConfig);
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
      expect(caps.typingIndicator).toBe(true);
      expect(caps.reactions).toBe(false);
      expect(caps.attachments).toBe(true);
      expect(caps.replies).toBe(true);
      expect(caps.editing).toBe(true);
      expect(caps.deletion).toBe(true);
      expect(caps.readReceipts).toBe(false);
      expect(caps.maxMessageLength).toBe(4096);
      expect(caps.supportedAttachments).toEqual(['image', 'audio', 'video', 'file']);
    });

    it('should set correct API base URL', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });

      await channel.connect();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/getMe',
        expect.any(Object)
      );
    });
  });

  describe('Connect', () => {
    it('should throw error if bot token is missing', async () => {
      const badConfig: TelegramConfig = {
        botToken: '',
      };
      const badChannel = new TelegramChannel(defaultChannelConfig, badConfig);

      await expect(badChannel.connect()).rejects.toThrow('Telegram bot token is required');
    });

    it('should verify bot token and connect successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });

      await channel.connect();

      expect(channel.isConnected()).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/getMe'),
        expect.any(Object)
      );
    });

    it('should throw error if bot verification fails', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: false, error_code: 401, description: 'Unauthorized' }),
      });

      await expect(channel.connect()).rejects.toThrow('Failed to verify Telegram bot token');
    });

    it('should start polling when no webhook URL is configured', async () => {
      vi.useFakeTimers();

      mockFetch.mockResolvedValue({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });

      await channel.connect();

      // Should have called getMe and then started polling
      vi.advanceTimersByTime(1100);

      // getMe + at least one getUpdates
      expect(mockFetch.mock.calls.length).toBeGreaterThan(1);

      vi.useRealTimers();
    });

    it('should not start polling when webhook URL is configured', async () => {
      // Clear any previous mock state
      vi.clearAllMocks();

      const webhookConfig: TelegramConfig = {
        ...defaultTelegramConfig,
        webhookUrl: 'https://example.com/webhook',
      };
      const webhookChannel = new TelegramChannel(defaultChannelConfig, webhookConfig);

      // Mock getMe (only call that should be made)
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });

      await webhookChannel.connect();

      // Get initial call count (should be 1 for getMe)
      const initialCalls = mockFetch.mock.calls.length;
      expect(initialCalls).toBe(1);

      // Wait briefly to check no polling occurs
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should still be only 1 call (getMe, no getUpdates polling)
      expect(mockFetch.mock.calls.length).toBe(1);

      await webhookChannel.disconnect();
    });
  });

  describe('Disconnect', () => {
    it('should disconnect and set status', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });

      await channel.connect();
      expect(channel.isConnected()).toBe(true);

      await channel.disconnect();
      expect(channel.isConnected()).toBe(false);
      expect(channel.getStatus()).toBe('disconnected');
    });

    it('should stop polling on disconnect', async () => {
      vi.useFakeTimers();

      mockFetch.mockResolvedValue({
        json: async () => ({ ok: true, result: [] }),
      });

      await channel.connect();
      await channel.disconnect();

      const callCount = mockFetch.mock.calls.length;
      vi.advanceTimersByTime(5000);

      // No more calls after disconnect
      expect(mockFetch.mock.calls.length).toBe(callCount);

      vi.useRealTimers();
    });
  });

  describe('Send Message', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });
      await channel.connect();
    });

    it('should send basic message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { message_id: 456 } }),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'telegram-test',
        recipientId: '123456789',
        content: 'Test message',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      const result = await channel.send(message);

      expect(result.success).toBe(true);
      expect(result.channelMessageId).toBe('456');
    });

    it('should include parse_mode in request', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { message_id: 456 } }),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'telegram-test',
        recipientId: '123456789',
        content: '<b>Bold</b> text',
        priority: 'normal',
        attachments: [],
        options: {},
      };

      await channel.send(message);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.parse_mode).toBe('HTML');
    });

    it('should include reply_to_message_id when replyTo is set', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { message_id: 456 } }),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'telegram-test',
        recipientId: '123456789',
        content: 'Reply to message',
        priority: 'normal',
        attachments: [],
        options: {},
        replyTo: '123',
      };

      await channel.send(message);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.reply_to_message_id).toBe(123);
    });

    it('should disable notification for low priority', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { message_id: 456 } }),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'telegram-test',
        recipientId: '123456789',
        content: 'Quiet message',
        priority: 'low',
        attachments: [],
        options: {},
      };

      await channel.send(message);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.disable_notification).toBe(true);
    });

    it('should disable notification for lowest priority', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { message_id: 456 } }),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'telegram-test',
        recipientId: '123456789',
        content: 'Very quiet message',
        priority: 'lowest',
        attachments: [],
        options: {},
      };

      await channel.send(message);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.disable_notification).toBe(true);
    });

    it('should handle send failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: false, error_code: 400, description: 'Bad Request' }),
      });

      const message: OutboundMessage = {
        id: randomUUID(),
        channelId: 'telegram-test',
        recipientId: '123456789',
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
        channelId: 'telegram-test',
        recipientId: '123456789',
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

  describe('Typing Indicator', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });
      await channel.connect();
    });

    it('should send typing indicator', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: true }),
      });

      await channel.sendTypingIndicator('123456789');

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(lastCall[0]).toContain('/sendChatAction');
      const body = JSON.parse(lastCall[1].body);
      expect(body.chat_id).toBe('123456789');
      expect(body.action).toBe('typing');
    });
  });

  describe('Edit and Delete', () => {
    it('should return false for edit (not fully implemented)', () => {
      expect(channel.edit('123', 'new content')).toBe(false);
    });

    it('should return false for delete (not fully implemented)', () => {
      expect(channel.delete('123')).toBe(false);
    });
  });

  describe('Polling', () => {
    let pollingChannel: TelegramChannel;
    const pollingConfig: TelegramConfig = {
      ...defaultTelegramConfig,
      pollInterval: 100,
    };

    beforeEach(() => {
      pollingChannel = new TelegramChannel(defaultChannelConfig, pollingConfig);
    });

    afterEach(async () => {
      await pollingChannel.disconnect();
    });

    it('should poll for updates at configured interval', async () => {
      vi.useFakeTimers();

      mockFetch.mockResolvedValue({
        json: async () => ({ ok: true, result: [] }),
      });

      await pollingChannel.connect();

      vi.advanceTimersByTime(350);

      // getMe + multiple getUpdates
      expect(mockFetch.mock.calls.length).toBeGreaterThan(3);

      vi.useRealTimers();
    });

    it('should queue received messages', async () => {
      // Clear any previous mock state
      vi.clearAllMocks();

      const updates = [
        {
          update_id: 1,
          message: {
            message_id: 100,
            from: { id: 123, first_name: 'John', last_name: 'Doe', username: 'johndoe' },
            chat: { id: 123, type: 'private' },
            date: Math.floor(Date.now() / 1000),
            text: 'Hello bot!',
          },
        },
      ];

      // First call: getMe
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });
      // Second call: getUpdates returns our updates (first poll)
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: updates }),
      });
      // Third call and beyond: empty updates array (subsequent polls)
      mockFetch.mockResolvedValue({
        json: async () => ({ ok: true, result: [] }),
      });

      await pollingChannel.connect();

      // Wait for polling to process the updates
      await new Promise(resolve => setTimeout(resolve, 150));

      // Get the message from the queue
      const iterator = pollingChannel.receive()[Symbol.asyncIterator]();
      const msg = await iterator.next();

      expect(msg.done).toBe(false);
      expect(msg.value?.content).toBe('Hello bot!');
      expect(msg.value?.senderId).toBe('123');
      expect(msg.value?.senderName).toBe('John Doe');
    });

    it('should filter messages by allowed users', async () => {
      const restrictedConfig: TelegramConfig = {
        ...pollingConfig,
        allowedUsers: ['456'],
      };
      const restrictedChannel = new TelegramChannel(defaultChannelConfig, restrictedConfig);

      const updates = [
        {
          update_id: 1,
          message: {
            message_id: 100,
            from: { id: 123, first_name: 'Blocked' },
            chat: { id: 123, type: 'private' },
            date: Math.floor(Date.now() / 1000),
            text: 'Should be blocked',
          },
        },
        {
          update_id: 2,
          message: {
            message_id: 101,
            from: { id: 456, first_name: 'Allowed' },
            chat: { id: 456, type: 'private' },
            date: Math.floor(Date.now() / 1000),
            text: 'Should be allowed',
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: updates }),
      });
      mockFetch.mockResolvedValue({
        json: async () => ({ ok: true, result: [] }),
      });

      await restrictedChannel.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      const iterator = restrictedChannel.receive()[Symbol.asyncIterator]();
      const msg = await iterator.next();

      expect(msg.value?.content).toBe('Should be allowed');

      await restrictedChannel.disconnect();
    });

    it('should handle group messages with groupId', async () => {
      const updates = [
        {
          update_id: 1,
          message: {
            message_id: 100,
            from: { id: 123, first_name: 'John' },
            chat: { id: -987654321, type: 'group', title: 'Test Group' },
            date: Math.floor(Date.now() / 1000),
            text: 'Group message',
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: updates }),
      });
      mockFetch.mockResolvedValue({
        json: async () => ({ ok: true, result: [] }),
      });

      await pollingChannel.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      const iterator = pollingChannel.receive()[Symbol.asyncIterator]();
      const msg = await iterator.next();

      expect(msg.value?.groupId).toBe('-987654321');
      expect(msg.value?.metadata?.chatType).toBe('group');
      expect(msg.value?.metadata?.chatTitle).toBe('Test Group');
    });

    it('should handle reply messages', async () => {
      const updates = [
        {
          update_id: 1,
          message: {
            message_id: 100,
            from: { id: 123, first_name: 'John' },
            chat: { id: 123, type: 'private' },
            date: Math.floor(Date.now() / 1000),
            text: 'This is a reply',
            reply_to_message: { message_id: 50 },
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: updates }),
      });
      mockFetch.mockResolvedValue({
        json: async () => ({ ok: true, result: [] }),
      });

      await pollingChannel.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      const iterator = pollingChannel.receive()[Symbol.asyncIterator]();
      const msg = await iterator.next();

      expect(msg.value?.replyTo).toBe('50');
    });

    it('should skip updates without text', async () => {
      const updates = [
        {
          update_id: 1,
          message: {
            message_id: 100,
            from: { id: 123, first_name: 'John' },
            chat: { id: 123, type: 'private' },
            date: Math.floor(Date.now() / 1000),
            // No text - photo/sticker/etc
          },
        },
        {
          update_id: 2,
          message: {
            message_id: 101,
            from: { id: 123, first_name: 'John' },
            chat: { id: 123, type: 'private' },
            date: Math.floor(Date.now() / 1000),
            text: 'Text message',
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: updates }),
      });
      mockFetch.mockResolvedValue({
        json: async () => ({ ok: true, result: [] }),
      });

      await pollingChannel.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      const iterator = pollingChannel.receive()[Symbol.asyncIterator]();
      const msg = await iterator.next();

      expect(msg.value?.content).toBe('Text message');
    });

    it('should handle sender without from field', async () => {
      const updates = [
        {
          update_id: 1,
          message: {
            message_id: 100,
            chat: { id: 123, type: 'private' },
            date: Math.floor(Date.now() / 1000),
            text: 'Anonymous message',
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: updates }),
      });
      mockFetch.mockResolvedValue({
        json: async () => ({ ok: true, result: [] }),
      });

      await pollingChannel.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      const iterator = pollingChannel.receive()[Symbol.asyncIterator]();
      const msg = await iterator.next();

      expect(msg.value?.senderId).toBe('unknown');
    });

    it('should handle poll errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockResolvedValue({
        json: async () => ({ ok: true, result: [] }),
      });

      await pollingChannel.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(consoleSpy).toHaveBeenCalled();
      expect(pollingChannel.isConnected()).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Webhook Handler', () => {
    it('should process valid webhook update', async () => {
      const update = {
        update_id: 1,
        message: {
          message_id: 100,
          from: { id: 123, first_name: 'John', username: 'johndoe' },
          chat: { id: 123, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: 'Webhook message',
        },
      };

      channel.handleWebhookUpdate(update);

      // Message should be queued
      const iterator = channel.receive()[Symbol.asyncIterator]();

      // Need to connect first to actually receive
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { id: 123, first_name: 'Bot', username: 'testbot' } }),
      });
      await channel.connect();

      // The queued message should still be there
      channel.handleWebhookUpdate(update);

      const msg = await iterator.next();
      expect(msg.value?.content).toBe('Webhook message');
    });

    it('should filter by allowed users in webhook', () => {
      const restrictedConfig: TelegramConfig = {
        ...defaultTelegramConfig,
        allowedUsers: ['456'],
      };
      const restrictedChannel = new TelegramChannel(defaultChannelConfig, restrictedConfig);

      const update = {
        update_id: 1,
        message: {
          message_id: 100,
          from: { id: 123, first_name: 'Blocked' },
          chat: { id: 123, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: 'Should be blocked',
        },
      };

      // This should not throw and should silently drop the message
      restrictedChannel.handleWebhookUpdate(update);
    });

    it('should ignore updates without message', () => {
      const update = {
        update_id: 1,
        // No message field
      };

      // Should not throw
      channel.handleWebhookUpdate(update);
    });

    it('should ignore updates without text', () => {
      const update = {
        update_id: 1,
        message: {
          message_id: 100,
          from: { id: 123, first_name: 'John' },
          chat: { id: 123, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          // No text
        },
      };

      // Should not throw
      channel.handleWebhookUpdate(update);
    });
  });

  describe('createTelegramChannel', () => {
    it('should create a TelegramChannel instance', () => {
      const created = createTelegramChannel(defaultChannelConfig, defaultTelegramConfig);

      expect(created).toBeInstanceOf(TelegramChannel);
      expect(created.id).toBe('telegram-test');
      expect(created.name).toBe('Telegram Test');
    });
  });
});
