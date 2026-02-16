/**
 * TopicManager Test Suite
 *
 * Tests for Telegram forum topic management including:
 * - Topic creation and caching
 * - Message routing to topics
 * - API error handling
 * - Security (token exposure prevention)
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { TopicManager, type TopicName, type TopicManagerOptions } from '../../../../src/integrations/telegram/topic-manager.js';
import type { EventBus } from '../../../../src/kernel/event-bus.js';
import { GrammyError, HttpError } from 'grammy';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

// Mock grammY
vi.mock('grammy', async () => {
  const actual = await vi.importActual<typeof import('grammy')>('grammy');
  return {
    ...actual,
    Bot: vi.fn().mockImplementation(() => ({
      api: {
        getChat: vi.fn(),
        createForumTopic: vi.fn(),
        sendMessage: vi.fn(),
      },
    })),
  };
});

// Create mock EventBus
function createMockEventBus(): EventBus {
  return {
    emit: vi.fn(),
    on: vi.fn().mockReturnValue(() => {}),
    off: vi.fn(),
    once: vi.fn().mockReturnValue(() => {}),
    clear: vi.fn(),
    listenerCount: vi.fn().mockReturnValue(0),
    getHandlerErrorCount: vi.fn().mockReturnValue(0),
    setHandlerTimeout: vi.fn(),
  } as unknown as EventBus;
}

// Default test options
const defaultOptions: TopicManagerOptions = {
  botToken: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789',
  groupChatId: '-1001234567890',
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTRUCTOR TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('TopicManager', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = createMockEventBus();
  });

  describe('constructor', () => {
    it('should create instance with valid options', () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      expect(manager).toBeDefined();
      expect(manager.isInitialized()).toBe(false);
    });

    it('should throw error when bot token is missing', () => {
      expect(() => new TopicManager(eventBus, {
        botToken: '',
        groupChatId: '-1001234567890',
      })).toThrow('Bot token is required');
    });

    it('should throw error when group chat ID is missing', () => {
      expect(() => new TopicManager(eventBus, {
        botToken: '123:abc',
        groupChatId: '',
      })).toThrow('Group chat ID is required');
    });

    it('should throw error when group chat ID is invalid', () => {
      expect(() => new TopicManager(eventBus, {
        botToken: '123:abc',
        groupChatId: 'not-a-number',
      })).toThrow('Invalid group chat ID: must be a number');
    });

    it('should accept positive and negative chat IDs', () => {
      // Positive (rare but valid)
      const manager1 = new TopicManager(eventBus, {
        botToken: '123:abc',
        groupChatId: '1234567890',
      });
      expect(manager1).toBeDefined();

      // Negative (normal for supergroups)
      const manager2 = new TopicManager(eventBus, {
        botToken: '123:abc',
        groupChatId: '-1001234567890',
      });
      expect(manager2).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('init', () => {
    it('should initialize successfully with forum-enabled supergroup', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.getChat.mockResolvedValue({
        type: 'supergroup',
        is_forum: true,
        id: -1001234567890,
        title: 'Test Forum',
      });

      await manager.init();
      expect(manager.isInitialized()).toBe(true);
    });

    it('should throw error if chat is not a supergroup', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.getChat.mockResolvedValue({
        type: 'group',
        id: -1234567890,
        title: 'Regular Group',
      });

      await expect(manager.init()).rejects.toThrow('Chat must be a supergroup');
    });

    it('should throw error if forum topics are not enabled', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.getChat.mockResolvedValue({
        type: 'supergroup',
        is_forum: false,
        id: -1001234567890,
        title: 'Supergroup without Forum',
      });

      await expect(manager.init()).rejects.toThrow('Chat must be a forum');
    });

    it('should not reinitialize if already initialized', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.getChat.mockResolvedValue({
        type: 'supergroup',
        is_forum: true,
        id: -1001234567890,
        title: 'Test Forum',
      });

      await manager.init();
      await manager.init(); // Second call

      expect(bot.api.getChat).toHaveBeenCalledTimes(1);
    });

    it('should emit system:error on API failure', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.getChat.mockRejectedValue(new Error('Network error'));

      await expect(manager.init()).rejects.toThrow();
      expect(eventBus.emit).toHaveBeenCalledWith(
        'system:error',
        expect.objectContaining({
          context: 'telegram:topic_manager:init',
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TOPIC CREATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ensureTopic', () => {
    it('should create topic when not cached', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.createForumTopic.mockResolvedValue({
        message_thread_id: 42,
        name: 'ARI Updates',
        icon_color: 0x6FB9F0,
      });

      const topicId = await manager.ensureTopic('updates');

      expect(topicId).toBe(42);
      expect(bot.api.createForumTopic).toHaveBeenCalledWith(
        -1001234567890,
        'ARI Updates',
        { icon_color: 0x6FB9F0 }
      );
    });

    it('should return cached topic ID on subsequent calls', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.createForumTopic.mockResolvedValue({
        message_thread_id: 42,
        name: 'ARI Updates',
        icon_color: 0x6FB9F0,
      });

      await manager.ensureTopic('updates');
      const secondCall = await manager.ensureTopic('updates');

      expect(secondCall).toBe(42);
      expect(bot.api.createForumTopic).toHaveBeenCalledTimes(1);
    });

    it('should create different topics for different names', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      let callCount = 0;
      bot.api.createForumTopic.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          message_thread_id: callCount * 10,
          name: `Topic ${callCount}`,
          icon_color: 0x6FB9F0,
        });
      });

      const updatesId = await manager.ensureTopic('updates');
      const marketId = await manager.ensureTopic('market');
      const systemId = await manager.ensureTopic('system');

      expect(updatesId).toBe(10);
      expect(marketId).toBe(20);
      expect(systemId).toBe(30);
      expect(bot.api.createForumTopic).toHaveBeenCalledTimes(3);
    });

    it('should throw error for unknown topic name', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);

      await expect(manager.ensureTopic('invalid' as TopicName))
        .rejects.toThrow('Unknown topic name: invalid');
    });

    it('should use correct display names for all topics', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.createForumTopic.mockResolvedValue({
        message_thread_id: 1,
        name: 'Test',
        icon_color: 0x6FB9F0,
      });

      const topicNames: TopicName[] = ['updates', 'market', 'briefings', 'opportunities', 'system'];
      const expectedDisplayNames = [
        'ARI Updates',
        'Market Alerts',
        'Daily Briefings',
        'Opportunities',
        'System',
      ];

      for (let i = 0; i < topicNames.length; i++) {
        manager.clearCache();
        await manager.ensureTopic(topicNames[i]);
        expect(bot.api.createForumTopic).toHaveBeenLastCalledWith(
          -1001234567890,
          expectedDisplayNames[i],
          expect.any(Object)
        );
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGE ROUTING TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('sendToTopic', () => {
    it('should send message to the correct topic', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.createForumTopic.mockResolvedValue({
        message_thread_id: 42,
        name: 'ARI Updates',
        icon_color: 0x6FB9F0,
      });

      bot.api.sendMessage.mockResolvedValue({
        message_id: 123,
        date: Math.floor(Date.now() / 1000),
      });

      const result = await manager.sendToTopic('updates', 'Hello, world!');

      expect(result).toBe(true);
      expect(bot.api.sendMessage).toHaveBeenCalledWith(
        -1001234567890,
        'Hello, world!',
        {
          message_thread_id: 42,
          parse_mode: 'HTML',
        }
      );
    });

    it('should return false for empty messages', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);

      expect(await manager.sendToTopic('updates', '')).toBe(false);
      expect(await manager.sendToTopic('updates', '   ')).toBe(false);
    });

    it('should truncate messages exceeding 4096 characters', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.createForumTopic.mockResolvedValue({
        message_thread_id: 42,
        name: 'ARI Updates',
        icon_color: 0x6FB9F0,
      });

      bot.api.sendMessage.mockResolvedValue({
        message_id: 123,
        date: Math.floor(Date.now() / 1000),
      });

      const longMessage = 'x'.repeat(5000);
      await manager.sendToTopic('updates', longMessage);

      const sentMessage = bot.api.sendMessage.mock.calls[0][1] as string;
      expect(sentMessage.length).toBe(4096);
      expect(sentMessage.endsWith('...')).toBe(true);
    });

    it('should emit events on successful send', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.createForumTopic.mockResolvedValue({
        message_thread_id: 42,
        name: 'ARI Updates',
        icon_color: 0x6FB9F0,
      });

      bot.api.sendMessage.mockResolvedValue({
        message_id: 123,
        date: Math.floor(Date.now() / 1000),
      });

      await manager.sendToTopic('updates', 'Test message');

      expect(eventBus.emit).toHaveBeenCalledWith('telegram:message_sent', expect.objectContaining({
        chatId: -1001234567890,
        type: 'text',
      }));

      expect(eventBus.emit).toHaveBeenCalledWith('audit:log', expect.objectContaining({
        action: 'telegram:topic_message_sent',
        agent: 'topic-manager',
        trustLevel: 'system',
        details: expect.objectContaining({
          topicName: 'updates',
          topicId: 42,
          messageId: 123,
        }),
      }));
    });

    it('should return false on API error', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.createForumTopic.mockResolvedValue({
        message_thread_id: 42,
        name: 'ARI Updates',
        icon_color: 0x6FB9F0,
      });

      bot.api.sendMessage.mockRejectedValue(new Error('Rate limited'));

      const result = await manager.sendToTopic('updates', 'Test message');

      expect(result).toBe(false);
      expect(eventBus.emit).toHaveBeenCalledWith(
        'system:error',
        expect.objectContaining({
          context: 'telegram:topic_manager:sendToTopic',
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHING TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('caching', () => {
    it('should return undefined for uncached topics via getTopicId', () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      expect(manager.getTopicId('updates')).toBeUndefined();
    });

    it('should return cached topic ID after creation', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.createForumTopic.mockResolvedValue({
        message_thread_id: 42,
        name: 'ARI Updates',
        icon_color: 0x6FB9F0,
      });

      await manager.ensureTopic('updates');
      expect(manager.getTopicId('updates')).toBe(42);
    });

    it('should clear cache correctly', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.createForumTopic.mockResolvedValue({
        message_thread_id: 42,
        name: 'ARI Updates',
        icon_color: 0x6FB9F0,
      });

      await manager.ensureTopic('updates');
      expect(manager.getTopicId('updates')).toBe(42);

      manager.clearCache();
      expect(manager.getTopicId('updates')).toBeUndefined();
    });

    it('should list all cached topics', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      let counter = 0;
      bot.api.createForumTopic.mockImplementation(() => {
        counter++;
        return Promise.resolve({
          message_thread_id: counter,
          name: `Topic ${counter}`,
          icon_color: 0x6FB9F0,
        });
      });

      await manager.ensureTopic('updates');
      await manager.ensureTopic('market');

      const topics = await manager.listTopics();
      expect(topics.length).toBe(2);
      expect(topics.map(t => t.id)).toContain(1);
      expect(topics.map(t => t.id)).toContain(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('error handling', () => {
    it('should handle GrammyError correctly', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      const grammyError = new GrammyError(
        'Bad Request: message thread not found',
        { ok: false, error_code: 400, description: 'Bad Request: message thread not found' },
        'sendMessage',
        {}
      );

      bot.api.createForumTopic.mockResolvedValue({
        message_thread_id: 42,
        name: 'Test',
        icon_color: 0x6FB9F0,
      });

      bot.api.sendMessage.mockRejectedValue(grammyError);

      const result = await manager.sendToTopic('updates', 'Test');

      expect(result).toBe(false);
      expect(eventBus.emit).toHaveBeenCalledWith(
        'system:error',
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('sendToTopic'),
          }),
        })
      );
    });

    it('should handle HttpError correctly', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      const httpError = new HttpError(
        'https://api.telegram.org/bot123:abc/sendMessage',
        { status: 503, statusText: 'Service Unavailable' } as Response,
        new Error('Network error')
      );

      bot.api.createForumTopic.mockRejectedValue(httpError);

      await expect(manager.ensureTopic('updates')).rejects.toThrow();
      expect(eventBus.emit).toHaveBeenCalledWith(
        'system:error',
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Network error'),
          }),
        })
      );
    });

    it('should handle unknown errors gracefully', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.createForumTopic.mockRejectedValue('String error');

      await expect(manager.ensureTopic('updates')).rejects.toBeDefined();
      expect(eventBus.emit).toHaveBeenCalledWith(
        'system:error',
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Unknown error'),
          }),
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('security - token exposure prevention', () => {
    it('should sanitize bot token from error messages', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      const tokenInError = new Error(
        'Error at https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789/sendMessage'
      );

      bot.api.createForumTopic.mockRejectedValue(tokenInError);

      await expect(manager.ensureTopic('updates')).rejects.toThrow();

      // Check that emit was called with sanitized error
      const errorCall = (eventBus.emit as Mock).mock.calls.find(
        call => call[0] === 'system:error'
      );

      expect(errorCall).toBeDefined();
      const errorMessage = errorCall![1].error.message;
      expect(errorMessage).not.toContain('123456789:ABC');
      expect(errorMessage).toContain('[REDACTED_TOKEN]');
    });

    it('should sanitize token patterns from GrammyError descriptions', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      // Simulate an error that might leak token
      const grammyError = new GrammyError(
        'Error with token 9876543210:XYZabc123def456ghi789jkl012mno345pqr in request',
        { ok: false, error_code: 401, description: 'Token leaked: 9876543210:XYZabc123def456ghi789jkl012mno345pqr' },
        'getChat',
        {}
      );

      bot.api.getChat.mockRejectedValue(grammyError);

      await expect(manager.init()).rejects.toThrow();

      const errorCall = (eventBus.emit as Mock).mock.calls.find(
        call => call[0] === 'system:error'
      );

      expect(errorCall).toBeDefined();
      const errorMessage = errorCall![1].error.message;
      expect(errorMessage).not.toContain('9876543210:XYZ');
    });

    it('should not expose bot token in constructor error', () => {
      // Token is not exposed in constructor errors because we throw
      // generic errors without the token value
      expect(() => new TopicManager(eventBus, {
        botToken: '',
        groupChatId: '-123',
      })).toThrow('Bot token is required');
    });

    it('should not expose chat ID in a way that could be exploited', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.createForumTopic.mockResolvedValue({
        message_thread_id: 42,
        name: 'Test',
        icon_color: 0x6FB9F0,
      });

      bot.api.sendMessage.mockResolvedValue({
        message_id: 123,
        date: Math.floor(Date.now() / 1000),
      });

      await manager.sendToTopic('updates', 'Test');

      // Chat ID in audit log is fine (internal logging)
      const auditCall = (eventBus.emit as Mock).mock.calls.find(
        call => call[0] === 'audit:log'
      );

      expect(auditCall).toBeDefined();
      expect(auditCall![1].details.groupChatId).toBe(-1001234567890);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle HTML special characters in messages', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.createForumTopic.mockResolvedValue({
        message_thread_id: 42,
        name: 'Test',
        icon_color: 0x6FB9F0,
      });

      bot.api.sendMessage.mockResolvedValue({
        message_id: 123,
        date: Math.floor(Date.now() / 1000),
      });

      // HTML content should be passed through (parse_mode: 'HTML')
      const htmlMessage = '<b>Bold</b> & <i>italic</i>';
      await manager.sendToTopic('updates', htmlMessage);

      expect(bot.api.sendMessage).toHaveBeenCalledWith(
        expect.any(Number),
        htmlMessage,
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });

    it('should handle exactly 4096 character messages without truncation', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      bot.api.createForumTopic.mockResolvedValue({
        message_thread_id: 42,
        name: 'Test',
        icon_color: 0x6FB9F0,
      });

      bot.api.sendMessage.mockResolvedValue({
        message_id: 123,
        date: Math.floor(Date.now() / 1000),
      });

      const exactMessage = 'x'.repeat(4096);
      await manager.sendToTopic('updates', exactMessage);

      const sentMessage = bot.api.sendMessage.mock.calls[0][1] as string;
      expect(sentMessage.length).toBe(4096);
      expect(sentMessage).not.toContain('...');
    });

    it('should handle concurrent topic creation requests', async () => {
      const manager = new TopicManager(eventBus, defaultOptions);
      const bot = (manager as unknown as { bot: { api: Record<string, Mock> } }).bot;

      let callCount = 0;
      bot.api.createForumTopic.mockImplementation(async () => {
        callCount++;
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          message_thread_id: 42,
          name: 'ARI Updates',
          icon_color: 0x6FB9F0,
        };
      });

      // Fire multiple requests concurrently
      const promises = [
        manager.ensureTopic('updates'),
        manager.ensureTopic('updates'),
        manager.ensureTopic('updates'),
      ];

      const results = await Promise.all(promises);

      // All should return the same topic ID
      expect(results).toEqual([42, 42, 42]);

      // Due to caching, later calls might not create new topics
      // But the first one definitely should
      expect(callCount).toBeGreaterThanOrEqual(1);
    });
  });
});
