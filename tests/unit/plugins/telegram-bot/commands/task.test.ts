/**
 * Tests for /task Telegram command — quick Notion task capture
 */

import { describe, it, expect, vi } from 'vitest';
import { parseTaskArgs, handleTask } from '../../../../../src/plugins/telegram-bot/commands/task.js';

describe('/task command', () => {
  // ── Argument Parsing ─────────────────────────────────────────────

  describe('parseTaskArgs', () => {
    it('should parse simple task name', () => {
      const result = parseTaskArgs('/task Buy groceries');
      expect(result.name).toBe('Buy groceries');
      expect(result.priority).toBeUndefined();
      expect(result.dueDate).toBeUndefined();
    });

    it('should parse task with !high priority', () => {
      const result = parseTaskArgs('/task Fix login bug !high');
      expect(result.name).toBe('Fix login bug');
      expect(result.priority).toBe('High');
    });

    it('should parse task with !h shorthand priority', () => {
      const result = parseTaskArgs('/task Urgent thing !h');
      expect(result.name).toBe('Urgent thing');
      expect(result.priority).toBe('High');
    });

    it('should parse task with !medium priority', () => {
      const result = parseTaskArgs('/task Review code !medium');
      expect(result.name).toBe('Review code');
      expect(result.priority).toBe('Medium');
    });

    it('should parse task with !low priority', () => {
      const result = parseTaskArgs('/task Nice to have !low');
      expect(result.name).toBe('Nice to have');
      expect(result.priority).toBe('Low');
    });

    it('should parse task with @today due date', () => {
      const result = parseTaskArgs('/task Finish report @today');
      expect(result.name).toBe('Finish report');
      expect(result.dueDate).toBeInstanceOf(Date);
      const today = new Date();
      expect(result.dueDate!.toDateString()).toBe(today.toDateString());
    });

    it('should parse task with @tomorrow due date', () => {
      const result = parseTaskArgs('/task Call dentist @tomorrow');
      expect(result.name).toBe('Call dentist');
      expect(result.dueDate).toBeInstanceOf(Date);
      const tomorrow = new Date(Date.now() + 86_400_000);
      expect(result.dueDate!.toDateString()).toBe(tomorrow.toDateString());
    });

    it('should parse task with day-of-week due date', () => {
      const result = parseTaskArgs('/task Weekly review @mon');
      expect(result.name).toBe('Weekly review');
      expect(result.dueDate).toBeInstanceOf(Date);
      // Should be next Monday
      expect(result.dueDate!.getDay()).toBe(1); // Monday
    });

    it('should parse task with both priority and due date', () => {
      const result = parseTaskArgs('/task Review PR !medium @fri');
      expect(result.name).toBe('Review PR');
      expect(result.priority).toBe('Medium');
      expect(result.dueDate).toBeInstanceOf(Date);
      expect(result.dueDate!.getDay()).toBe(5); // Friday
    });

    it('should return empty name for empty input', () => {
      const result = parseTaskArgs('/task');
      expect(result.name).toBe('');
    });

    it('should handle task with no prefix', () => {
      const result = parseTaskArgs('/task   ');
      expect(result.name).toBe('');
    });
  });

  // ── Command Handler ──────────────────────────────────────────────

  describe('handleTask', () => {
    function createMockCtx(text: string) {
      return {
        message: { text },
        reply: vi.fn(),
      } as unknown as Parameters<typeof handleTask>[0];
    }

    it('should show help when no arguments', async () => {
      const ctx = createMockCtx('/task');
      await handleTask(ctx, null);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(reply).toContain('Quick Task Capture');
      expect(reply).toContain('Usage');
    });

    it('should show config message when inbox not available', async () => {
      const ctx = createMockCtx('/task Buy groceries');
      await handleTask(ctx, null);

      const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(reply).toContain('not configured');
      expect(reply).toContain('NOTION_TASKS_DATABASE_ID');
    });

    it('should create task when inbox is available', async () => {
      const mockInbox = {
        hasTasksDb: () => true,
        quickTask: vi.fn().mockResolvedValue({ id: 'task-1', url: 'https://notion.so/task-1' }),
      };

      const ctx = createMockCtx('/task Buy groceries');
      await handleTask(
        ctx,
        mockInbox as unknown as Parameters<typeof handleTask>[1],
      );

      expect(mockInbox.quickTask).toHaveBeenCalledWith('Buy groceries', {
        priority: undefined,
        dueDate: undefined,
      });

      const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(reply).toContain('Task captured');
      expect(reply).toContain('Buy groceries');
    });

    it('should create task with priority flag', async () => {
      const mockInbox = {
        hasTasksDb: () => true,
        quickTask: vi.fn().mockResolvedValue({ id: 'task-2', url: 'https://notion.so/task-2' }),
      };

      const ctx = createMockCtx('/task Fix bug !high');
      await handleTask(
        ctx,
        mockInbox as unknown as Parameters<typeof handleTask>[1],
      );

      expect(mockInbox.quickTask).toHaveBeenCalledWith('Fix bug', {
        priority: 'High',
        dueDate: undefined,
      });

      const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(reply).toContain('High');
    });

    it('should list pending tasks', async () => {
      const mockInbox = {
        hasTasksDb: () => true,
        getTasks: vi.fn().mockResolvedValue([
          { id: 'task-1', title: 'Buy groceries', priority: 'High' },
          { id: 'task-2', title: 'Fix bug', priority: undefined },
        ]),
      };

      const ctx = createMockCtx('/task list');
      await handleTask(
        ctx,
        mockInbox as unknown as Parameters<typeof handleTask>[1],
      );

      expect(mockInbox.getTasks).toHaveBeenCalledWith({ status: 'Not started' });

      const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(reply).toContain('Pending Tasks (2)');
      expect(reply).toContain('Buy groceries');
      expect(reply).toContain('[High]');
      expect(reply).toContain('Fix bug');
    });

    it('should show empty message when no tasks', async () => {
      const mockInbox = {
        hasTasksDb: () => true,
        getTasks: vi.fn().mockResolvedValue([]),
      };

      const ctx = createMockCtx('/task list');
      await handleTask(
        ctx,
        mockInbox as unknown as Parameters<typeof handleTask>[1],
      );

      const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(reply).toContain('Clean slate');
    });

    it('should complete a task with partial ID', async () => {
      const mockInbox = {
        hasTasksDb: () => true,
        getTasks: vi.fn().mockResolvedValue([
          { id: 'abc-123-def', title: 'Buy groceries' },
          { id: 'xyz-456-ghi', title: 'Fix bug' },
        ]),
        completeTask: vi.fn().mockResolvedValue(true),
      };

      const ctx = createMockCtx('/task done abc-123');
      await handleTask(
        ctx,
        mockInbox as unknown as Parameters<typeof handleTask>[1],
      );

      expect(mockInbox.completeTask).toHaveBeenCalledWith('abc-123-def');

      const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(reply).toContain('Done');
      expect(reply).toContain('Buy groceries');
    });

    it('should handle task not found for done command', async () => {
      const mockInbox = {
        hasTasksDb: () => true,
        getTasks: vi.fn().mockResolvedValue([]),
      };

      const ctx = createMockCtx('/task done nonexistent');
      await handleTask(
        ctx,
        mockInbox as unknown as Parameters<typeof handleTask>[1],
      );

      const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(reply).toContain('No pending task found');
    });

    it('should handle failed task creation', async () => {
      const mockInbox = {
        hasTasksDb: () => true,
        quickTask: vi.fn().mockResolvedValue(null),
      };

      const ctx = createMockCtx('/task Something');
      await handleTask(
        ctx,
        mockInbox as unknown as Parameters<typeof handleTask>[1],
      );

      const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(reply).toContain('Failed to create task');
    });
  });
});
