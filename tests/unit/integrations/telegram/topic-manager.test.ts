/**
 * Tests for TelegramTopicManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TelegramTopicManager } from '../../../../src/integrations/telegram/topic-manager.js';
import type { TopicKey } from '../../../../src/integrations/telegram/topic-manager.js';
import { existsSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PERSISTENCE_PATH = join(homedir(), '.ari', 'telegram-topics.json');

// Mock fetch globally
global.fetch = vi.fn();

describe('TelegramTopicManager', () => {
  let manager: TelegramTopicManager;
  const mockBotToken = 'test-bot-token';
  const mockGroupChatId = '-1001234567890';

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new TelegramTopicManager({
      botToken: mockBotToken,
      groupChatId: mockGroupChatId,
    });

    // Clean up persistence file
    if (existsSync(PERSISTENCE_PATH)) {
      void unlink(PERSISTENCE_PATH);
    }
  });

  describe('isConfigured', () => {
    it('should return true when properly configured', () => {
      expect(manager.isConfigured()).toBe(true);
    });

    it('should return false when missing botToken', () => {
      const unconfigured = new TelegramTopicManager({
        botToken: '',
        groupChatId: mockGroupChatId,
      });
      expect(unconfigured.isConfigured()).toBe(false);
    });

    it('should return false when missing groupChatId', () => {
      const unconfigured = new TelegramTopicManager({
        botToken: mockBotToken,
        groupChatId: '',
      });
      expect(unconfigured.isConfigured()).toBe(false);
    });
  });

  describe('ensureTopics', () => {
    it('should create all topics via API', async () => {
      // Mock successful topic creation
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_thread_id: 123 },
        }),
      });

      await manager.ensureTopics();

      // Should have called createForumTopic for each topic
      expect(global.fetch).toHaveBeenCalledTimes(7); // 7 topics total

      // Verify API calls
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0]).toContain('/createForumTopic');
      expect(calls[0][1].method).toBe('POST');

      // Verify all topics have thread IDs
      expect(manager.getTopicThreadId('morning_briefing')).toBe(123);
      expect(manager.getTopicThreadId('market_intel')).toBe(123);
    });

    it('should throw when not configured', async () => {
      const unconfigured = new TelegramTopicManager({
        botToken: '',
        groupChatId: '',
      });

      await expect(unconfigured.ensureTopics()).rejects.toThrow(
        'TopicManager not configured'
      );
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: false,
          description: 'Group is not a forum',
        }),
      });

      await expect(manager.ensureTopics()).rejects.toThrow(
        'Group does not have forum topics enabled'
      );
    });

    it('should skip topics that are already loaded', async () => {
      // Mock first creation
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_thread_id: 456 },
        }),
      });

      await manager.ensureTopics();

      const firstCallCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

      // Call again
      await manager.ensureTopics();

      // Should not create topics again (only persistence write)
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('sendToTopic', () => {
    beforeEach(async () => {
      // Setup topics first
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_thread_id: 789 },
        }),
      });

      await manager.ensureTopics();
      vi.clearAllMocks();
    });

    it.skip('should send message with correct thread ID', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_id: 999 },
        }),
      });

      const result = await manager.sendToTopic('morning_briefing', 'Test message');

      expect(result.sent).toBe(true);
      expect(result.messageId).toBe(999);

      // Verify API call
      const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain('/sendMessage');

      const body = JSON.parse(call[1].body as string);
      expect(body.chat_id).toBe(mockGroupChatId);
      expect(body.text).toBe('Test message');
      expect(body.message_thread_id).toBe(789);
    });

    it('should use provided options', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 1000 } }),
      });

      await manager.sendToTopic('market_intel', 'Test', {
        parseMode: 'Markdown',
        silent: true,
      });

      const body = JSON.parse(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string
      );
      expect(body.parse_mode).toBe('Markdown');
      expect(body.disable_notification).toBe(true);
    });

    it('should truncate long messages', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 1001 } }),
      });

      const longMessage = 'x'.repeat(5000);
      await manager.sendToTopic('general', longMessage);

      const body = JSON.parse(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string
      );
      expect(body.text.length).toBe(4096);
      expect(body.text).toContain('...');
    });

    it('should return error when topic not found', async () => {
      const result = await manager.sendToTopic('invalid_topic' as TopicKey, 'Test');

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should return error when not configured', async () => {
      const unconfigured = new TelegramTopicManager({
        botToken: '',
        groupChatId: '',
      });

      const result = await unconfigured.sendToTopic('general', 'Test');

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('not configured');
    });

    it('should handle API errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: false,
          description: 'Chat not found',
        }),
      });

      const result = await manager.sendToTopic('general', 'Test');

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('Chat not found');
    });

    it('should handle network errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      const result = await manager.sendToTopic('general', 'Test');

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('Network error');
    });

    it('should enforce rate limiting', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 1002 } }),
      });

      // Send 30 messages (rate limit)
      for (let i = 0; i < 30; i++) {
        await manager.sendToTopic('general', `Message ${i}`);
      }

      // 31st should be rate limited
      const result = await manager.sendToTopic('general', 'Should fail');

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('Rate limit exceeded');
    });
  });

  describe('getTopicThreadId', () => {
    it('should return undefined for unknown topic', () => {
      expect(manager.getTopicThreadId('morning_briefing')).toBeUndefined();
    });

    it('should return thread ID after topics are created', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_thread_id: 555 },
        }),
      });

      await manager.ensureTopics();

      expect(manager.getTopicThreadId('morning_briefing')).toBe(555);
    });
  });

  describe('persistence', () => {
    it.skip('should persist topic IDs to disk', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_thread_id: 888 },
        }),
      });

      await manager.ensureTopics();

      // Persistence file should exist
      expect(existsSync(PERSISTENCE_PATH)).toBe(true);

      // Verify content
      const content = await readFile(PERSISTENCE_PATH, 'utf-8');
      const data = JSON.parse(content);

      expect(data.version).toBe(1);
      expect(data.groupChatId).toBe(mockGroupChatId);
      expect(data.topics.morning_briefing.threadId).toBe(888);
    });

    it.skip('should load persisted topic IDs on init', async () => {
      // Create manager and persist topics
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_thread_id: 777 },
        }),
      });

      await manager.ensureTopics();

      // Create new manager instance
      const newManager = new TelegramTopicManager({
        botToken: mockBotToken,
        groupChatId: mockGroupChatId,
      });

      vi.clearAllMocks();

      await newManager.ensureTopics();

      // Should not create topics (loaded from disk)
      expect(global.fetch).not.toHaveBeenCalled();
      expect(newManager.getTopicThreadId('morning_briefing')).toBe(777);
    });

    it('should not load topics for different group', async () => {
      // Create topics for first group
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_thread_id: 666 },
        }),
      });

      await manager.ensureTopics();

      // Create manager for different group
      const otherManager = new TelegramTopicManager({
        botToken: mockBotToken,
        groupChatId: '-1009876543210',
      });

      vi.clearAllMocks();

      await otherManager.ensureTopics();

      // Should create new topics (different group)
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle corrupted persistence file gracefully', async () => {
      // Write invalid JSON
      const dir = join(homedir(), '.ari');
      const { writeFile: fsWriteFile } = await import('node:fs/promises');
      const { existsSync: fsExistsSync } = await import('node:fs');
      const { mkdir: fsMkdir } = await import('node:fs/promises');

      if (!fsExistsSync(dir)) {
        await fsMkdir(dir, { recursive: true });
      }
      await fsWriteFile(PERSISTENCE_PATH, 'invalid json', 'utf-8');

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_thread_id: 999 },
        }),
      });

      // Should not throw, just create topics fresh
      await expect(manager.ensureTopics()).resolves.not.toThrow();
    });
  });
});
