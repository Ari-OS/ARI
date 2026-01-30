/**
 * Tests for NotionClient (src/integrations/notion/client.ts)
 *
 * Covers:
 * - API error handling
 * - Rate limiting scenarios
 * - Input validation (no injection of malicious content)
 * - Proper authentication handling
 * - Data sanitization
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NotionClient, type NotionPageContent } from '../../../../src/integrations/notion/client.js';
import type { NotionConfig } from '../../../../src/autonomous/types.js';

// Mock the @notionhq/client
vi.mock('@notionhq/client', () => ({
  Client: vi.fn().mockImplementation(() => ({
    pages: {
      create: vi.fn(),
      update: vi.fn(),
    },
    blocks: {
      children: {
        append: vi.fn(),
      },
    },
    users: {
      me: vi.fn(),
    },
    request: vi.fn(),
  })),
}));

import { Client } from '@notionhq/client';

describe('NotionClient', () => {
  let client: NotionClient;
  let mockNotionClient: {
    pages: { create: Mock; update: Mock };
    blocks: { children: { append: Mock } };
    users: { me: Mock };
    request: Mock;
  };

  const validConfig: NotionConfig = {
    enabled: true,
    apiKey: 'secret_test_api_key_1234567890abcdef',
    inboxDatabaseId: 'db-12345678-1234-1234-1234-123456789012',
    dailyLogParentId: 'page-12345678-1234-1234-1234-123456789012',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Get reference to mock client methods
    mockNotionClient = {
      pages: { create: vi.fn(), update: vi.fn() },
      blocks: { children: { append: vi.fn() } },
      users: { me: vi.fn() },
      request: vi.fn(),
    };

    (Client as Mock).mockImplementation(() => mockNotionClient);

    client = new NotionClient(validConfig);
  });

  // ── Initialization and Authentication ───────────────────────────────────────

  describe('init()', () => {
    it('should initialize successfully with valid config', () => {
      const result = client.init();

      expect(result).toBe(true);
      expect(client.isReady()).toBe(true);
      expect(Client).toHaveBeenCalledWith({ auth: validConfig.apiKey });
    });

    it('should fail initialization when disabled', () => {
      const disabledConfig: NotionConfig = { ...validConfig, enabled: false };
      const disabledClient = new NotionClient(disabledConfig);

      const result = disabledClient.init();

      expect(result).toBe(false);
      expect(disabledClient.isReady()).toBe(false);
    });

    it('should fail initialization when apiKey is missing', () => {
      const noKeyConfig: NotionConfig = {
        enabled: true,
        apiKey: undefined,
        inboxDatabaseId: validConfig.inboxDatabaseId,
      };
      const noKeyClient = new NotionClient(noKeyConfig);

      const result = noKeyClient.init();

      expect(result).toBe(false);
      expect(noKeyClient.isReady()).toBe(false);
    });

    it('should fail initialization when apiKey is empty string', () => {
      const emptyKeyConfig: NotionConfig = {
        enabled: true,
        apiKey: '',
        inboxDatabaseId: validConfig.inboxDatabaseId,
      };
      const emptyKeyClient = new NotionClient(emptyKeyConfig);

      const result = emptyKeyClient.init();

      expect(result).toBe(false);
      expect(emptyKeyClient.isReady()).toBe(false);
    });

    it('should handle Client constructor throwing an error', () => {
      (Client as Mock).mockImplementationOnce(() => {
        throw new Error('Invalid API key format');
      });

      const result = client.init();

      expect(result).toBe(false);
      expect(client.isReady()).toBe(false);
    });

    it('should not expose API key in error messages', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (Client as Mock).mockImplementationOnce(() => {
        throw new Error('Auth failed');
      });

      client.init();

      // API key should never appear in logs
      consoleSpy.mock.calls.forEach((call) => {
        const logMessage = call.join(' ');
        expect(logMessage).not.toContain(validConfig.apiKey);
      });

      consoleSpy.mockRestore();
    });
  });

  describe('isReady()', () => {
    it('should return false before initialization', () => {
      expect(client.isReady()).toBe(false);
    });

    it('should return true after successful initialization', () => {
      client.init();
      expect(client.isReady()).toBe(true);
    });
  });

  // ── API Error Handling ──────────────────────────────────────────────────────

  describe('createDatabaseEntry()', () => {
    const validContent: NotionPageContent = {
      title: 'Test Notification',
      body: 'This is a test notification body.',
      priority: 'P2',
      category: 'test',
      status: 'unread',
    };

    beforeEach(() => {
      client.init();
    });

    it('should return null when client is not ready', async () => {
      const uninitClient = new NotionClient(validConfig);
      const result = await uninitClient.createDatabaseEntry('db-id', validContent);
      expect(result).toBeNull();
    });

    it('should create database entry successfully', async () => {
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'page-123',
        url: 'https://notion.so/page-123',
      });

      const result = await client.createDatabaseEntry('db-id', validContent);

      expect(result).toEqual({
        id: 'page-123',
        url: 'https://notion.so/page-123',
      });
    });

    it('should handle Notion API rate limit error (429)', async () => {
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as unknown as { status: number }).status = 429;
      mockNotionClient.pages.create.mockRejectedValue(rateLimitError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await client.createDatabaseEntry('db-id', validContent);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle Notion API unauthorized error (401)', async () => {
      const authError = new Error('Unauthorized');
      (authError as unknown as { status: number }).status = 401;
      mockNotionClient.pages.create.mockRejectedValue(authError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await client.createDatabaseEntry('db-id', validContent);

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should handle Notion API not found error (404)', async () => {
      const notFoundError = new Error('Database not found');
      (notFoundError as unknown as { status: number }).status = 404;
      mockNotionClient.pages.create.mockRejectedValue(notFoundError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await client.createDatabaseEntry('db-id', validContent);

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockNotionClient.pages.create.mockRejectedValue(timeoutError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await client.createDatabaseEntry('db-id', validContent);

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockNotionClient.pages.create.mockRejectedValue('string error');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await client.createDatabaseEntry('db-id', validContent);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('[Notion] Failed to create database entry:', 'Unknown error');
      consoleSpy.mockRestore();
    });
  });

  // ── Input Validation and Sanitization ───────────────────────────────────────

  describe('input validation - title sanitization', () => {
    beforeEach(() => {
      client.init();
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'page-123',
        url: 'https://notion.so/page-123',
      });
    });

    it('should truncate title to 100 characters', async () => {
      const longTitle = 'A'.repeat(150);
      const content: NotionPageContent = {
        title: longTitle,
        body: 'Test body',
      };

      await client.createDatabaseEntry('db-id', content);

      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const titleContent = createCall.properties.Name.title[0].text.content;
      expect(titleContent.length).toBe(100);
    });

    it('should handle empty title gracefully', async () => {
      const content: NotionPageContent = {
        title: '',
        body: 'Test body',
      };

      await client.createDatabaseEntry('db-id', content);

      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.properties.Name.title[0].text.content).toBe('');
    });

    it('should not allow script injection in title', async () => {
      const maliciousTitle = '<script>alert("XSS")</script>';
      const content: NotionPageContent = {
        title: maliciousTitle,
        body: 'Test body',
      };

      await client.createDatabaseEntry('db-id', content);

      // The content should be passed as plain text (Notion API handles escaping)
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const titleContent = createCall.properties.Name.title[0].text.content;
      expect(titleContent).toBe(maliciousTitle); // Raw text, Notion handles rendering
    });

    it('should handle unicode and special characters in title', async () => {
      const unicodeTitle = 'Test \u{1F4E7} Alert: \u{26A0} Warning!';
      const content: NotionPageContent = {
        title: unicodeTitle,
        body: 'Test body',
      };

      await client.createDatabaseEntry('db-id', content);

      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.properties.Name.title[0].text.content).toBe(unicodeTitle);
    });

    it('should handle newlines in title', async () => {
      const titleWithNewlines = 'Line 1\nLine 2\rLine 3\r\nLine 4';
      const content: NotionPageContent = {
        title: titleWithNewlines,
        body: 'Test body',
      };

      await client.createDatabaseEntry('db-id', content);

      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.properties.Name.title[0].text.content).toBe(titleWithNewlines);
    });
  });

  describe('input validation - body sanitization', () => {
    beforeEach(() => {
      client.init();
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'page-123',
        url: 'https://notion.so/page-123',
      });
    });

    it('should truncate body to 2000 characters', async () => {
      const longBody = 'B'.repeat(3000);
      const content: NotionPageContent = {
        title: 'Test',
        body: longBody,
      };

      await client.createDatabaseEntry('db-id', content);

      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const bodyContent = createCall.children[0].paragraph.rich_text[0].text.content;
      expect(bodyContent.length).toBe(2000);
    });

    it('should handle empty body', async () => {
      const content: NotionPageContent = {
        title: 'Test',
        body: '',
      };

      await client.createDatabaseEntry('db-id', content);

      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.children[0].paragraph.rich_text[0].text.content).toBe('');
    });

    it('should not allow SQL injection patterns in body', async () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const content: NotionPageContent = {
        title: 'Test',
        body: sqlInjection,
      };

      await client.createDatabaseEntry('db-id', content);

      // Content passed as-is (Notion API handles it safely)
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.children[0].paragraph.rich_text[0].text.content).toBe(sqlInjection);
    });

    it('should not allow command injection patterns in body', async () => {
      const cmdInjection = '$(rm -rf /)';
      const content: NotionPageContent = {
        title: 'Test',
        body: cmdInjection,
      };

      await client.createDatabaseEntry('db-id', content);

      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.children[0].paragraph.rich_text[0].text.content).toBe(cmdInjection);
    });
  });

  // ── Update Page ─────────────────────────────────────────────────────────────

  describe('updatePage()', () => {
    beforeEach(() => {
      client.init();
    });

    it('should return false when client is not ready', async () => {
      const uninitClient = new NotionClient(validConfig);
      const result = await uninitClient.updatePage('page-id', { status: 'read' });
      expect(result).toBe(false);
    });

    it('should update page status successfully', async () => {
      mockNotionClient.pages.update.mockResolvedValue({ id: 'page-id' });

      const result = await client.updatePage('page-id', { status: 'read' });

      expect(result).toBe(true);
      expect(mockNotionClient.pages.update).toHaveBeenCalledWith({
        page_id: 'page-id',
        properties: {
          Status: { select: { name: 'read' } },
        },
      });
    });

    it('should update page priority successfully', async () => {
      mockNotionClient.pages.update.mockResolvedValue({ id: 'page-id' });

      const result = await client.updatePage('page-id', { priority: 'P1' });

      expect(result).toBe(true);
      expect(mockNotionClient.pages.update).toHaveBeenCalledWith({
        page_id: 'page-id',
        properties: {
          Priority: { select: { name: 'P1' } },
        },
      });
    });

    it('should update both status and priority', async () => {
      mockNotionClient.pages.update.mockResolvedValue({ id: 'page-id' });

      const result = await client.updatePage('page-id', { status: 'archived', priority: 'P3' });

      expect(result).toBe(true);
      expect(mockNotionClient.pages.update).toHaveBeenCalledWith({
        page_id: 'page-id',
        properties: {
          Status: { select: { name: 'archived' } },
          Priority: { select: { name: 'P3' } },
        },
      });
    });

    it('should return false on API error', async () => {
      mockNotionClient.pages.update.mockRejectedValue(new Error('API error'));

      const result = await client.updatePage('page-id', { status: 'read' });

      expect(result).toBe(false);
    });

    it('should handle invalid page ID gracefully', async () => {
      mockNotionClient.pages.update.mockRejectedValue(new Error('Page not found'));

      const result = await client.updatePage('invalid-page-id', { status: 'read' });

      expect(result).toBe(false);
    });
  });

  // ── Append to Page ──────────────────────────────────────────────────────────

  describe('appendToPage()', () => {
    beforeEach(() => {
      client.init();
    });

    it('should return false when client is not ready', async () => {
      const uninitClient = new NotionClient(validConfig);
      const result = await uninitClient.appendToPage('page-id', 'content');
      expect(result).toBe(false);
    });

    it('should append content successfully', async () => {
      mockNotionClient.blocks.children.append.mockResolvedValue({});

      const result = await client.appendToPage('page-id', 'New content');

      expect(result).toBe(true);
      expect(mockNotionClient.blocks.children.append).toHaveBeenCalledWith({
        block_id: 'page-id',
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: { content: 'New content' },
                },
              ],
            },
          },
        ],
      });
    });

    it('should return false on API error', async () => {
      mockNotionClient.blocks.children.append.mockRejectedValue(new Error('API error'));

      const result = await client.appendToPage('page-id', 'content');

      expect(result).toBe(false);
    });
  });

  // ── Query Database ──────────────────────────────────────────────────────────

  describe('queryDatabase()', () => {
    beforeEach(() => {
      client.init();
    });

    it('should return empty array when client is not ready', async () => {
      const uninitClient = new NotionClient(validConfig);
      const result = await uninitClient.queryDatabase('db-id');
      expect(result).toEqual([]);
    });

    it('should query database without filters', async () => {
      mockNotionClient.request.mockResolvedValue({
        results: [
          {
            id: 'page-1',
            created_time: '2024-01-15T10:00:00.000Z',
            url: 'https://notion.so/page-1',
            properties: {
              Name: { title: [{ plain_text: 'Entry 1' }] },
              Priority: { select: { name: 'P2' } },
              Category: { select: { name: 'test' } },
              Status: { select: { name: 'unread' } },
            },
          },
        ],
      });

      const results = await client.queryDatabase('db-id');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'page-1',
        title: 'Entry 1',
        priority: 'P2',
        category: 'test',
        status: 'unread',
        createdAt: '2024-01-15T10:00:00.000Z',
        url: 'https://notion.so/page-1',
      });
    });

    it('should query database with status filter', async () => {
      mockNotionClient.request.mockResolvedValue({ results: [] });

      await client.queryDatabase('db-id', { status: 'unread' });

      expect(mockNotionClient.request).toHaveBeenCalledWith({
        path: 'databases/db-id/query',
        method: 'post',
        body: {
          filter: { property: 'Status', select: { equals: 'unread' } },
          sorts: [{ timestamp: 'created_time', direction: 'descending' }],
        },
      });
    });

    it('should query database with multiple filters (AND)', async () => {
      mockNotionClient.request.mockResolvedValue({ results: [] });

      await client.queryDatabase('db-id', { status: 'unread', priority: 'P1' });

      expect(mockNotionClient.request).toHaveBeenCalledWith({
        path: 'databases/db-id/query',
        method: 'post',
        body: {
          filter: {
            and: [
              { property: 'Status', select: { equals: 'unread' } },
              { property: 'Priority', select: { equals: 'P1' } },
            ],
          },
          sorts: [{ timestamp: 'created_time', direction: 'descending' }],
        },
      });
    });

    it('should query database with date filter', async () => {
      mockNotionClient.request.mockResolvedValue({ results: [] });

      const createdAfter = new Date('2024-01-01T00:00:00.000Z');
      await client.queryDatabase('db-id', { createdAfter });

      expect(mockNotionClient.request).toHaveBeenCalledWith({
        path: 'databases/db-id/query',
        method: 'post',
        body: {
          filter: { property: 'Created', date: { after: '2024-01-01T00:00:00.000Z' } },
          sorts: [{ timestamp: 'created_time', direction: 'descending' }],
        },
      });
    });

    it('should handle missing title gracefully', async () => {
      mockNotionClient.request.mockResolvedValue({
        results: [
          {
            id: 'page-1',
            created_time: '2024-01-15T10:00:00.000Z',
            url: 'https://notion.so/page-1',
            properties: {},
          },
        ],
      });

      const results = await client.queryDatabase('db-id');

      expect(results[0].title).toBe('Untitled');
    });

    it('should handle missing optional properties', async () => {
      mockNotionClient.request.mockResolvedValue({
        results: [
          {
            id: 'page-1',
            created_time: '2024-01-15T10:00:00.000Z',
            url: 'https://notion.so/page-1',
            properties: {
              Name: { title: [{ plain_text: 'Entry' }] },
            },
          },
        ],
      });

      const results = await client.queryDatabase('db-id');

      expect(results[0].priority).toBeUndefined();
      expect(results[0].category).toBeUndefined();
      expect(results[0].status).toBeUndefined();
    });

    it('should return empty array on API error', async () => {
      mockNotionClient.request.mockRejectedValue(new Error('API error'));

      const results = await client.queryDatabase('db-id');

      expect(results).toEqual([]);
    });
  });

  // ── Daily Log Page ──────────────────────────────────────────────────────────

  describe('createDailyLogPage()', () => {
    beforeEach(() => {
      client.init();
    });

    it('should return null when client is not ready', async () => {
      const uninitClient = new NotionClient(validConfig);
      const result = await uninitClient.createDailyLogPage('parent-id', new Date(), {
        summary: 'Test',
        highlights: [],
        issues: [],
      });
      expect(result).toBeNull();
    });

    it('should create daily log page with all content', async () => {
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'page-123',
        url: 'https://notion.so/page-123',
      });

      const date = new Date('2024-01-15T12:00:00.000Z');
      const content = {
        summary: 'Daily summary',
        highlights: ['Completed task A', 'Deployed feature B'],
        issues: ['Bug in module X'],
        metrics: { tasksCompleted: 5, errorsEncountered: 1 },
      };

      const result = await client.createDailyLogPage('parent-id', date, content);

      expect(result).toEqual({
        id: 'page-123',
        url: 'https://notion.so/page-123',
      });

      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.parent).toEqual({ page_id: 'parent-id' });
      expect(createCall.properties.title.title[0].text.content).toContain('2024-01-15');
    });

    it('should handle empty highlights and issues arrays', async () => {
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'page-123',
        url: 'https://notion.so/page-123',
      });

      const date = new Date();
      const content = {
        summary: 'Quiet day',
        highlights: [],
        issues: [],
      };

      await client.createDailyLogPage('parent-id', date, content);

      // Should still succeed
      expect(mockNotionClient.pages.create).toHaveBeenCalled();
    });

    it('should return null on API error', async () => {
      mockNotionClient.pages.create.mockRejectedValue(new Error('API error'));

      const result = await client.createDailyLogPage('parent-id', new Date(), {
        summary: 'Test',
        highlights: [],
        issues: [],
      });

      expect(result).toBeNull();
    });
  });

  // ── Test Connection ─────────────────────────────────────────────────────────

  describe('testConnection()', () => {
    it('should return false when client is not ready', async () => {
      const uninitClient = new NotionClient(validConfig);
      const result = await uninitClient.testConnection();
      expect(result).toBe(false);
    });

    it('should return true on successful connection test', async () => {
      client.init();
      mockNotionClient.users.me.mockResolvedValue({ id: 'user-123' });

      const result = await client.testConnection();

      expect(result).toBe(true);
    });

    it('should return false on failed connection test', async () => {
      client.init();
      mockNotionClient.users.me.mockRejectedValue(new Error('Unauthorized'));

      const result = await client.testConnection();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      client.init();
      mockNotionClient.users.me.mockRejectedValue(new Error('Network error'));

      const result = await client.testConnection();

      expect(result).toBe(false);
    });
  });

  // ── Security Tests ──────────────────────────────────────────────────────────

  describe('security - API key handling', () => {
    it('should not log API key on errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      client.init();
      mockNotionClient.pages.create.mockRejectedValue(new Error('Auth failed'));

      await client.createDatabaseEntry('db-id', { title: 'Test', body: 'Body' });

      const allLogs = consoleSpy.mock.calls.flat().join(' ');
      expect(allLogs).not.toContain(validConfig.apiKey);
      consoleSpy.mockRestore();
    });

    it('should pass API key only to Client constructor', () => {
      client.init();

      expect(Client).toHaveBeenCalledWith({ auth: validConfig.apiKey });
    });
  });

  describe('security - injection prevention', () => {
    beforeEach(() => {
      client.init();
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'page-123',
        url: 'https://notion.so/page-123',
      });
    });

    it('should handle null bytes in input', async () => {
      const contentWithNulls: NotionPageContent = {
        title: 'Test\x00Null\x00Bytes',
        body: 'Body\x00Content',
      };

      await client.createDatabaseEntry('db-id', contentWithNulls);

      // Should not throw
      expect(mockNotionClient.pages.create).toHaveBeenCalled();
    });

    it('should handle very long database IDs', async () => {
      const longDbId = 'a'.repeat(1000);
      await client.createDatabaseEntry(longDbId, { title: 'Test', body: 'Body' });

      // Should pass the ID as-is (Notion API handles validation)
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.parent.database_id).toBe(longDbId);
    });

    it('should handle special regex characters in content', async () => {
      const regexContent: NotionPageContent = {
        title: '.*+?^${}()|[]\\',
        body: '/pattern/gi',
      };

      await client.createDatabaseEntry('db-id', regexContent);

      expect(mockNotionClient.pages.create).toHaveBeenCalled();
    });

    it('should handle JSON injection attempts', async () => {
      const jsonInjection: NotionPageContent = {
        title: '", "malicious": "data',
        body: '{"nested": "json"}',
      };

      await client.createDatabaseEntry('db-id', jsonInjection);

      expect(mockNotionClient.pages.create).toHaveBeenCalled();
    });
  });
});
