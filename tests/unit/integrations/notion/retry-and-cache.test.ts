/**
 * Tests for NotionClient retry logic and query caching
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NotionClient } from '../../../../src/integrations/notion/client.js';
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

describe('NotionClient — Retry & Cache', () => {
  let client: NotionClient;
  let mockNotionClient: {
    pages: { create: Mock; update: Mock };
    blocks: { children: { append: Mock } };
    users: { me: Mock };
    request: Mock;
  };

  const config: NotionConfig = {
    enabled: true,
    apiKey: 'secret_test_key',
    inboxDatabaseId: 'db-inbox-123',
    dailyLogParentId: 'page-log-123',
    tasksDbId: 'db-tasks-456',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockNotionClient = {
      pages: { create: vi.fn(), update: vi.fn() },
      blocks: { children: { append: vi.fn() } },
      users: { me: vi.fn() },
      request: vi.fn(),
    };

    (Client as Mock).mockImplementation(() => mockNotionClient);

    client = new NotionClient(config);
    client.init();
  });

  // ── Retry Logic ────────────────────────────────────────────────────

  describe('retry on transient errors', () => {
    it('should retry on 429 rate limit and succeed', async () => {
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as unknown as { status: number }).status = 429;

      mockNotionClient.pages.create
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ id: 'page-ok', url: 'https://notion.so/ok' });

      const result = await client.createDatabaseEntry('db-inbox-123', {
        title: 'Test',
        body: 'Body',
      });

      expect(result).toEqual({ id: 'page-ok', url: 'https://notion.so/ok' });
      expect(mockNotionClient.pages.create).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 server error and succeed', async () => {
      const serverError = new Error('Internal error');
      (serverError as unknown as { status: number }).status = 500;

      mockNotionClient.users.me
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({ id: 'user-123' });

      const result = await client.testConnection();

      expect(result).toBe(true);
      expect(mockNotionClient.users.me).toHaveBeenCalledTimes(2);
    });

    it('should retry on 502 bad gateway', async () => {
      const gatewayError = new Error('Bad Gateway');
      (gatewayError as unknown as { status: number }).status = 502;

      mockNotionClient.blocks.children.append
        .mockRejectedValueOnce(gatewayError)
        .mockResolvedValueOnce({});

      const result = await client.appendToPage('page-id', 'content');

      expect(result).toBe(true);
      expect(mockNotionClient.blocks.children.append).toHaveBeenCalledTimes(2);
    });

    it('should retry on timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';

      mockNotionClient.pages.update
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({ id: 'page-id' });

      const result = await client.updatePage('page-id', { status: 'read' });

      expect(result).toBe(true);
      expect(mockNotionClient.pages.update).toHaveBeenCalledTimes(2);
    });

    it('should retry on ECONNRESET', async () => {
      const connError = new Error('ECONNRESET');

      mockNotionClient.request
        .mockRejectedValueOnce(connError)
        .mockResolvedValueOnce({ results: [] });

      const results = await client.queryDatabase('db-inbox-123');

      expect(results).toEqual([]);
      expect(mockNotionClient.request).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 401 unauthorized', async () => {
      const authError = new Error('Unauthorized');
      (authError as unknown as { status: number }).status = 401;

      mockNotionClient.pages.create.mockRejectedValue(authError);

      const result = await client.createDatabaseEntry('db-inbox-123', {
        title: 'Test',
        body: 'Body',
      });

      expect(result).toBeNull();
      expect(mockNotionClient.pages.create).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 404 not found', async () => {
      const notFoundError = new Error('Not found');
      (notFoundError as unknown as { status: number }).status = 404;

      mockNotionClient.pages.update.mockRejectedValue(notFoundError);

      const result = await client.updatePage('bad-page', { status: 'read' });

      expect(result).toBe(false);
      expect(mockNotionClient.pages.update).toHaveBeenCalledTimes(1);
    });

    it('should give up after max retries', async () => {
      const serverError = new Error('Internal error');
      (serverError as unknown as { status: number }).status = 500;

      mockNotionClient.pages.create.mockRejectedValue(serverError);

      const result = await client.createDatabaseEntry('db-inbox-123', {
        title: 'Test',
        body: 'Body',
      });

      expect(result).toBeNull();
      // 3 attempts = max retries
      expect(mockNotionClient.pages.create).toHaveBeenCalledTimes(3);
    });
  });

  // ── Query Cache ────────────────────────────────────────────────────

  describe('query caching', () => {
    it('should cache query results', async () => {
      mockNotionClient.request.mockResolvedValue({
        results: [
          {
            id: 'page-1',
            created_time: '2024-01-15T10:00:00.000Z',
            url: 'https://notion.so/page-1',
            properties: {
              Name: { title: [{ plain_text: 'Entry 1' }] },
            },
          },
        ],
      });

      // First call hits API
      const first = await client.queryDatabase('db-inbox-123');
      expect(first).toHaveLength(1);
      expect(mockNotionClient.request).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const second = await client.queryDatabase('db-inbox-123');
      expect(second).toHaveLength(1);
      expect(mockNotionClient.request).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should not cache different filters', async () => {
      mockNotionClient.request.mockResolvedValue({ results: [] });

      await client.queryDatabase('db-inbox-123');
      await client.queryDatabase('db-inbox-123', { status: 'unread' });

      expect(mockNotionClient.request).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache on write', async () => {
      mockNotionClient.request.mockResolvedValue({ results: [] });
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'page-new',
        url: 'https://notion.so/page-new',
      });

      // Prime cache
      await client.queryDatabase('db-inbox-123');
      expect(mockNotionClient.request).toHaveBeenCalledTimes(1);

      // Write to same database
      await client.createDatabaseEntry('db-inbox-123', { title: 'New', body: 'Entry' });

      // Next query should hit API again
      await client.queryDatabase('db-inbox-123');
      expect(mockNotionClient.request).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache with clearCache()', async () => {
      mockNotionClient.request.mockResolvedValue({ results: [] });

      await client.queryDatabase('db-inbox-123');
      expect(mockNotionClient.request).toHaveBeenCalledTimes(1);

      client.clearCache();

      await client.queryDatabase('db-inbox-123');
      expect(mockNotionClient.request).toHaveBeenCalledTimes(2);
    });

    it('should expire cache entries after TTL', async () => {
      vi.useFakeTimers();

      mockNotionClient.request.mockResolvedValue({ results: [] });

      await client.queryDatabase('db-inbox-123');
      expect(mockNotionClient.request).toHaveBeenCalledTimes(1);

      // Advance past TTL (60s)
      vi.advanceTimersByTime(61_000);

      await client.queryDatabase('db-inbox-123');
      expect(mockNotionClient.request).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  // ── Task Management ────────────────────────────────────────────────

  describe('createTask()', () => {
    it('should create a task with name only', async () => {
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'task-1',
        url: 'https://notion.so/task-1',
      });

      const result = await client.createTask('db-tasks-456', { name: 'Buy groceries' });

      expect(result).toEqual({ id: 'task-1', url: 'https://notion.so/task-1' });

      const call = mockNotionClient.pages.create.mock.calls[0][0];
      expect(call.parent.database_id).toBe('db-tasks-456');
      expect(call.properties['Task name'].title[0].text.content).toBe('Buy groceries');
      expect(call.properties.Status.status.name).toBe('Not started');
    });

    it('should create a task with priority and due date', async () => {
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'task-2',
        url: 'https://notion.so/task-2',
      });

      const dueDate = new Date('2026-02-20');
      const result = await client.createTask('db-tasks-456', {
        name: 'Review PR',
        priority: 'High',
        dueDate,
      });

      expect(result).not.toBeNull();

      const call = mockNotionClient.pages.create.mock.calls[0][0];
      expect(call.properties.Priority.select.name).toBe('High');
      expect(call.properties['Due date'].date.start).toBe('2026-02-20');
    });

    it('should create a task with description', async () => {
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'task-3',
        url: 'https://notion.so/task-3',
      });

      await client.createTask('db-tasks-456', {
        name: 'Fix bug',
        description: 'Login flow is broken on mobile',
      });

      const call = mockNotionClient.pages.create.mock.calls[0][0];
      expect(call.children[0].paragraph.rich_text[0].text.content).toBe(
        'Login flow is broken on mobile',
      );
    });

    it('should truncate long task names', async () => {
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'task-4',
        url: 'https://notion.so/task-4',
      });

      await client.createTask('db-tasks-456', { name: 'A'.repeat(150) });

      const call = mockNotionClient.pages.create.mock.calls[0][0];
      expect(call.properties['Task name'].title[0].text.content.length).toBe(100);
    });

    it('should return null when client is not ready', async () => {
      const uninitClient = new NotionClient(config);
      const result = await uninitClient.createTask('db-tasks-456', { name: 'Test' });
      expect(result).toBeNull();
    });

    it('should invalidate cache for the tasks database after create', async () => {
      mockNotionClient.request.mockResolvedValue({ results: [] });
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'task-5',
        url: 'https://notion.so/task-5',
      });

      // Prime cache
      await client.queryDatabase('db-tasks-456');
      expect(mockNotionClient.request).toHaveBeenCalledTimes(1);

      // Create task
      await client.createTask('db-tasks-456', { name: 'New task' });

      // Cache should be invalidated
      await client.queryDatabase('db-tasks-456');
      expect(mockNotionClient.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateTaskStatus()', () => {
    it('should update task status to Done', async () => {
      mockNotionClient.pages.update.mockResolvedValue({ id: 'task-1' });

      const result = await client.updateTaskStatus('task-1', 'Done');

      expect(result).toBe(true);
      expect(mockNotionClient.pages.update).toHaveBeenCalledWith({
        page_id: 'task-1',
        properties: {
          Status: { status: { name: 'Done' } },
        },
      });
    });

    it('should return false when not ready', async () => {
      const uninitClient = new NotionClient(config);
      const result = await uninitClient.updateTaskStatus('task-1', 'Done');
      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      mockNotionClient.pages.update.mockRejectedValue(new Error('Not found'));

      const result = await client.updateTaskStatus('bad-task', 'Done');

      expect(result).toBe(false);
    });
  });

  // ── Status parsing for task databases ────────────────────────────

  describe('queryDatabase with task status format', () => {
    it('should parse status from select property', async () => {
      mockNotionClient.request.mockResolvedValue({
        results: [
          {
            id: 'page-1',
            created_time: '2024-01-15T10:00:00.000Z',
            url: 'https://notion.so/page-1',
            properties: {
              Name: { title: [{ plain_text: 'Inbox Entry' }] },
              Status: { select: { name: 'unread' } },
            },
          },
        ],
      });

      const results = await client.queryDatabase('db-inbox-123');
      expect(results[0].status).toBe('unread');
    });

    it('should parse status from status property type', async () => {
      mockNotionClient.request.mockResolvedValue({
        results: [
          {
            id: 'task-1',
            created_time: '2024-01-15T10:00:00.000Z',
            url: 'https://notion.so/task-1',
            properties: {
              'Task name': { title: [{ plain_text: 'My Task' }] },
              Status: { status: { name: 'In progress' } },
            },
          },
        ],
      });

      const results = await client.queryDatabase('db-tasks-456');
      expect(results[0].title).toBe('My Task');
      expect(results[0].status).toBe('In progress');
    });
  });
});
