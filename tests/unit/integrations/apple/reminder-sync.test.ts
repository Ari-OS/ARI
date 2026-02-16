import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReminderSync } from '../../../../src/integrations/apple/reminder-sync.js';
import { AppleReminders, type AppleReminder } from '../../../../src/integrations/apple/reminders.js';
import { NotionInbox } from '../../../../src/integrations/notion/inbox.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';

// Mock logger
vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Test Helpers ───────────────────────────────────────────────────────────

function createMockNotion(): NotionInbox {
  return {
    isReady: vi.fn().mockReturnValue(true),
    createDailyLog: vi.fn().mockResolvedValue('notion-page-123'),
    getTodayEntries: vi.fn().mockResolvedValue([]),
    init: vi.fn().mockResolvedValue(true),
    addNote: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotionInbox;
}

function createMockReminders(items: AppleReminder[]): AppleReminders {
  return {
    getIncomplete: vi.fn().mockResolvedValue(items),
    markComplete: vi.fn().mockResolvedValue(true),
    getDueToday: vi.fn().mockResolvedValue([]),
    getOverdue: vi.fn().mockResolvedValue([]),
    getLists: vi.fn().mockResolvedValue([]),
    formatForBriefing: vi.fn().mockReturnValue(''),
  } as unknown as AppleReminders;
}

const now = new Date();

const SAMPLE_REMINDERS: AppleReminder[] = [
  {
    id: 'rem-001',
    name: 'Buy groceries',
    completed: false,
    priority: 5,
    list: 'Shopping',
    creationDate: now,
    dueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  },
  {
    id: 'rem-002',
    name: 'Call dentist',
    body: 'Schedule cleaning appointment',
    completed: false,
    priority: 1,
    list: 'Personal',
    creationDate: now,
  },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ReminderSync', () => {
  let notion: NotionInbox;
  let reminders: AppleReminders;
  let eventBus: EventBus;
  let sync: ReminderSync;

  beforeEach(() => {
    notion = createMockNotion();
    reminders = createMockReminders(SAMPLE_REMINDERS);
    eventBus = new EventBus();
    sync = new ReminderSync(notion, reminders, eventBus);
  });

  describe('syncOnce', () => {
    it('should sync new reminders to Notion', async () => {
      const result = await sync.syncOnce();

      expect(result.synced).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.details).toHaveLength(2);
      expect(result.details[0].action).toBe('synced');
      expect(result.details[0].notionPageId).toBe('notion-page-123');
    });

    it('should mark Apple Reminders as complete after sync', async () => {
      await sync.syncOnce();

      const markComplete = vi.mocked(reminders.markComplete);
      expect(markComplete).toHaveBeenCalledTimes(2);
      expect(markComplete).toHaveBeenCalledWith('rem-001');
      expect(markComplete).toHaveBeenCalledWith('rem-002');
    });

    it('should skip already-synced reminders on second run', async () => {
      await sync.syncOnce();
      const result = await sync.syncOnce();

      expect(result.synced).toBe(0);
      expect(result.skipped).toBe(2);
    });

    it('should skip duplicate reminders found in Notion', async () => {
      vi.mocked(notion.getTodayEntries).mockResolvedValue([
        { id: 'existing', title: 'Buy groceries' } as unknown as { id: string; title: string },
      ] as unknown as Awaited<ReturnType<NotionInbox['getTodayEntries']>>);

      const result = await sync.syncOnce();

      expect(result.details.find(d => d.reminderName === 'Buy groceries')?.action).toBe('skipped');
    });

    it('should handle Notion creation failure gracefully', async () => {
      vi.mocked(notion.createDailyLog).mockResolvedValue(null);

      const result = await sync.syncOnce();

      expect(result.errors).toBe(2);
      expect(result.synced).toBe(0);
    });

    it('should return empty result when no reminders', async () => {
      reminders = createMockReminders([]);
      sync = new ReminderSync(notion, reminders, eventBus);

      const result = await sync.syncOnce();

      expect(result.synced).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.details).toHaveLength(0);
    });

    it('should not mark complete when config says so', async () => {
      sync = new ReminderSync(notion, reminders, eventBus, {
        markCompleteAfterSync: false,
      });

      await sync.syncOnce();

      expect(vi.mocked(reminders.markComplete)).not.toHaveBeenCalled();
    });

    it('should filter by syncLists config', async () => {
      sync = new ReminderSync(notion, reminders, eventBus, {
        syncLists: ['Shopping'],
      });

      const result = await sync.syncOnce();

      expect(result.synced).toBe(1);
      expect(result.details[0].reminderName).toBe('Buy groceries');
    });

    it('should skip reminders older than maxAgeDays', async () => {
      const oldReminder: AppleReminder = {
        id: 'old',
        name: 'Ancient task',
        completed: false,
        priority: 9,
        list: 'Personal',
        creationDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      };
      reminders = createMockReminders([oldReminder]);
      sync = new ReminderSync(notion, reminders, eventBus, { maxAgeDays: 30 });

      const result = await sync.syncOnce();

      expect(result.synced).toBe(0);
    });

    it('should emit memory:stored event on successful sync', async () => {
      const handler = vi.fn();
      eventBus.on('memory:stored', handler);

      await sync.syncOnce();

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'reminder-sync',
        partition: 'tasks',
      }));
    });
  });

  describe('getPendingCount', () => {
    it('should return count of unsynced reminders', async () => {
      const count = await sync.getPendingCount();

      expect(count).toBe(2);
    });

    it('should return 0 after all are synced', async () => {
      await sync.syncOnce();
      const count = await sync.getPendingCount();

      expect(count).toBe(0);
    });
  });
});
