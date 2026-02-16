import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppleReminders, type AppleReminder } from '../../../../src/integrations/apple/reminders.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

// Mock logger
vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { execFile } from 'node:child_process';

const execFileMock = vi.mocked(execFile);

// ─── Test Helpers ───────────────────────────────────────────────────────────

function mockOsascript(stdout: string): void {
  execFileMock.mockImplementation((...allArgs: unknown[]) => {
    const callback = [...allArgs].reverse().find((a) => typeof a === 'function') as
      | ((err: Error | null, result: { stdout: string; stderr: string }) => void)
      | undefined;
    if (typeof callback === 'function') {
      callback(null, { stdout, stderr: '' });
    }
    return {} as ReturnType<typeof execFile>;
  });
}

function mockOsascriptError(error: Error): void {
  execFileMock.mockImplementation((...allArgs: unknown[]) => {
    const callback = [...allArgs].reverse().find((a) => typeof a === 'function') as
      | ((err: Error | null, result: { stdout: string; stderr: string }) => void)
      | undefined;
    if (typeof callback === 'function') {
      callback(error, { stdout: '', stderr: error.message });
    }
    return {} as ReturnType<typeof execFile>;
  });
}

const now = new Date();
const tomorrow = new Date(now);
tomorrow.setDate(tomorrow.getDate() + 1);
const yesterday = new Date(now);
yesterday.setDate(yesterday.getDate() - 1);

const SAMPLE_REMINDER = `rem-001|Buy groceries||${tomorrow.toString()}|5|Groceries|${now.toString()}`;
const OVERDUE_REMINDER = `rem-002|Pay electric bill||${yesterday.toString()}|1|Bills|${now.toString()}`;
const NO_DUE_REMINDER = `rem-003|Read new book|||9|Personal|${now.toString()}`;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AppleReminders', () => {
  let reminders: AppleReminders;

  beforeEach(() => {
    vi.clearAllMocks();
    reminders = new AppleReminders();
  });

  describe('getIncomplete', () => {
    it('should parse incomplete reminders from osascript output', async () => {
      mockOsascript([SAMPLE_REMINDER, OVERDUE_REMINDER, NO_DUE_REMINDER].join('\n'));

      const result = await reminders.getIncomplete();

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Buy groceries');
      expect(result[0].priority).toBe(5);
      expect(result[0].list).toBe('Groceries');
      expect(result[0].completed).toBe(false);
    });

    it('should return empty array on failure', async () => {
      mockOsascriptError(new Error('Reminders access denied'));

      const result = await reminders.getIncomplete();

      expect(result).toEqual([]);
    });

    it('should filter by included lists', async () => {
      const filtered = new AppleReminders({ includedLists: ['Bills'] });
      mockOsascript([SAMPLE_REMINDER, OVERDUE_REMINDER, NO_DUE_REMINDER].join('\n'));

      const result = await filtered.getIncomplete();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Pay electric bill');
    });

    it('should exclude specified lists', async () => {
      const filtered = new AppleReminders({ excludedLists: ['Personal'] });
      mockOsascript([SAMPLE_REMINDER, OVERDUE_REMINDER, NO_DUE_REMINDER].join('\n'));

      const result = await filtered.getIncomplete();

      expect(result).toHaveLength(2);
      expect(result.every(r => r.list !== 'Personal')).toBe(true);
    });

    it('should respect maxResults', async () => {
      const filtered = new AppleReminders({ maxResults: 1 });
      mockOsascript([SAMPLE_REMINDER, OVERDUE_REMINDER].join('\n'));

      const result = await filtered.getIncomplete();

      expect(result).toHaveLength(1);
    });
  });

  describe('getDueToday', () => {
    it('should return reminders due today or overdue', async () => {
      mockOsascript([SAMPLE_REMINDER, OVERDUE_REMINDER, NO_DUE_REMINDER].join('\n'));

      const result = await reminders.getDueToday();

      // Overdue reminder should be included (due yesterday <= end of today)
      expect(result.some(r => r.name === 'Pay electric bill')).toBe(true);
    });
  });

  describe('getOverdue', () => {
    it('should return only overdue reminders', async () => {
      mockOsascript([SAMPLE_REMINDER, OVERDUE_REMINDER, NO_DUE_REMINDER].join('\n'));

      const result = await reminders.getOverdue();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Pay electric bill');
    });
  });

  describe('markComplete', () => {
    it('should return true when reminder is found', async () => {
      mockOsascript('OK');

      const result = await reminders.markComplete('rem-001');

      expect(result).toBe(true);
    });

    it('should return false when reminder is not found', async () => {
      mockOsascript('NOT_FOUND');

      const result = await reminders.markComplete('nonexistent');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockOsascriptError(new Error('Script failed'));

      const result = await reminders.markComplete('rem-001');

      expect(result).toBe(false);
    });
  });

  describe('getLists', () => {
    it('should return reminder lists with counts', async () => {
      mockOsascript('Groceries|3\nBills|1\nPersonal|5');

      const lists = await reminders.getLists();

      expect(lists).toHaveLength(3);
      expect(lists[0]).toEqual({ name: 'Groceries', incompleteCount: 3 });
      expect(lists[1]).toEqual({ name: 'Bills', incompleteCount: 1 });
    });

    it('should return empty array on error', async () => {
      mockOsascriptError(new Error('Failed'));

      const lists = await reminders.getLists();

      expect(lists).toEqual([]);
    });
  });

  describe('formatForBriefing', () => {
    it('should format reminders with due dates and priorities', () => {
      const items: AppleReminder[] = [
        {
          id: '1', name: 'High priority', body: undefined, dueDate: tomorrow,
          completed: false, priority: 1, list: 'Work', creationDate: now,
        },
        {
          id: '2', name: 'Medium priority', body: undefined, dueDate: undefined,
          completed: false, priority: 5, list: 'Personal', creationDate: now,
        },
      ];

      const formatted = reminders.formatForBriefing(items);

      expect(formatted).toContain('[!] High priority');
      expect(formatted).toContain('[-] Medium priority');
    });

    it('should return "No pending reminders" for empty array', () => {
      expect(reminders.formatForBriefing([])).toBe('No pending reminders');
    });

    it('should truncate to 5 items', () => {
      const many: AppleReminder[] = Array.from({ length: 8 }, (_, i) => ({
        id: String(i), name: `Reminder ${i}`, completed: false,
        priority: 9, list: 'Test', creationDate: now,
      }));

      const formatted = reminders.formatForBriefing(many);

      expect(formatted).toContain('... and 3 more');
    });
  });
});
