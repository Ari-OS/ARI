/**
 * Apple Reminders Integration
 *
 * Queries Reminders.app via osascript (AppleScript) to retrieve and manage reminders.
 * macOS-first approach (ADR-008) — no external dependencies.
 *
 * Usage:
 *   const reminders = new AppleReminders();
 *   const incomplete = await reminders.getIncomplete();
 *   await reminders.markComplete('reminder-id');
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLogger } from '../../kernel/logger.js';

const execFileAsync = promisify(execFile);
const log = createLogger('apple-reminders');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AppleReminder {
  id: string;
  name: string;
  body?: string;
  dueDate?: Date;
  completed: boolean;
  completionDate?: Date;
  priority: number; // 0=none, 1=high, 5=medium, 9=low
  list: string;
  creationDate: Date;
}

export interface RemindersConfig {
  /** Reminder lists to include (empty = all) */
  includedLists: string[];
  /** Reminder lists to exclude */
  excludedLists: string[];
  /** Max reminders to return per query */
  maxResults: number;
}

const DEFAULT_CONFIG: RemindersConfig = {
  includedLists: [],
  excludedLists: [],
  maxResults: 50,
};

// ─── AppleScript Templates ──────────────────────────────────────────────────

const GET_INCOMPLETE_SCRIPT = `
  set output to ""
  tell application "Reminders"
    repeat with reminderList in lists
      set listName to name of reminderList
      set incompleteReminders to (every reminder of reminderList whose completed is false)
      repeat with r in incompleteReminders
        set rId to id of r
        set rName to name of r
        set rBody to ""
        try
          set rBody to body of r
        end try
        set rDue to ""
        try
          set rDue to (due date of r) as string
        end try
        set rPriority to priority of r
        set rCreated to (creation date of r) as string
        set output to output & rId & "|" & rName & "|" & rBody & "|" & rDue & "|" & rPriority & "|" & listName & "|" & rCreated & linefeed
      end repeat
    end repeat
  end tell
  return output
`;

function buildMarkCompleteScript(reminderId: string): string {
  // Escape the ID for AppleScript
  const escapedId = reminderId.replace(/"/g, '\\"');
  return `
    tell application "Reminders"
      repeat with reminderList in lists
        repeat with r in (every reminder of reminderList whose id is "${escapedId}")
          set completed of r to true
          return "OK"
        end repeat
      end repeat
    end tell
    return "NOT_FOUND"
  `;
}

function buildGetListsScript(): string {
  return `
    set output to ""
    tell application "Reminders"
      repeat with reminderList in lists
        set listName to name of reminderList
        set listCount to count of (every reminder of reminderList whose completed is false)
        set output to output & listName & "|" & listCount & linefeed
      end repeat
    end tell
    return output
  `;
}

// ─── Parser ─────────────────────────────────────────────────────────────────

function parseReminderLine(line: string): AppleReminder | null {
  const parts = line.split('|');
  if (parts.length < 7) return null;

  const [id, name, body, dueStr, priorityStr, list, createdStr] = parts;

  const creationDate = new Date(createdStr);
  if (isNaN(creationDate.getTime())) return null;

  const dueDate = dueStr?.trim() ? new Date(dueStr) : undefined;

  return {
    id: id.trim(),
    name: name.trim(),
    body: body?.trim() || undefined,
    dueDate: dueDate && !isNaN(dueDate.getTime()) ? dueDate : undefined,
    completed: false,
    priority: parseInt(priorityStr, 10) || 0,
    list: list.trim(),
    creationDate,
  };
}

// ─── Apple Reminders Client ─────────────────────────────────────────────────

export class AppleReminders {
  private config: RemindersConfig;

  constructor(config: Partial<RemindersConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get all incomplete reminders across all lists
   */
  async getIncomplete(): Promise<AppleReminder[]> {
    try {
      const { stdout } = await execFileAsync('osascript', ['-e', GET_INCOMPLETE_SCRIPT], {
        timeout: 15_000,
      });

      const lines = stdout.trim().split('\n').filter(Boolean);
      const reminders: AppleReminder[] = [];

      for (const line of lines) {
        const reminder = parseReminderLine(line);
        if (reminder) {
          reminders.push(reminder);
        }
      }

      const filtered = this.filterByList(reminders);
      log.info(`Fetched ${filtered.length} incomplete reminders`);
      return filtered.slice(0, this.config.maxResults);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`Failed to fetch reminders: ${message}`);
      return [];
    }
  }

  /**
   * Get reminders due today or overdue
   */
  async getDueToday(): Promise<AppleReminder[]> {
    const all = await this.getIncomplete();
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    return all.filter(r => r.dueDate && r.dueDate <= endOfDay);
  }

  /**
   * Get overdue reminders
   */
  async getOverdue(): Promise<AppleReminder[]> {
    const all = await this.getIncomplete();
    const now = new Date();
    return all.filter(r => r.dueDate && r.dueDate < now);
  }

  /**
   * Mark a reminder as complete
   */
  async markComplete(reminderId: string): Promise<boolean> {
    try {
      const script = buildMarkCompleteScript(reminderId);
      const { stdout } = await execFileAsync('osascript', ['-e', script], {
        timeout: 5_000,
      });
      const success = stdout.trim() === 'OK';
      if (success) {
        log.info(`Marked reminder ${reminderId} as complete`);
      } else {
        log.warn(`Reminder ${reminderId} not found`);
      }
      return success;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`Failed to mark reminder complete: ${message}`);
      return false;
    }
  }

  /**
   * Get all reminder lists with their incomplete counts
   */
  async getLists(): Promise<Array<{ name: string; incompleteCount: number }>> {
    try {
      const { stdout } = await execFileAsync('osascript', ['-e', buildGetListsScript()], {
        timeout: 10_000,
      });

      return stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const [name, countStr] = line.split('|');
          return {
            name: name.trim(),
            incompleteCount: parseInt(countStr, 10) || 0,
          };
        });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`Failed to fetch reminder lists: ${message}`);
      return [];
    }
  }

  /**
   * Format reminders for briefing display
   */
  formatForBriefing(reminders: AppleReminder[]): string {
    if (reminders.length === 0) return 'No pending reminders';

    const lines: string[] = [];
    const sorted = [...reminders].sort((a, b) => {
      // Overdue first, then by priority (lower number = higher priority)
      if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.priority - b.priority;
    });

    for (const r of sorted.slice(0, 5)) {
      const priority = r.priority === 1 ? '!' : r.priority === 5 ? '-' : ' ';
      const due = r.dueDate
        ? ` (due ${r.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
        : '';
      lines.push(`  [${priority}] ${r.name}${due}`);
    }

    if (reminders.length > 5) {
      lines.push(`  ... and ${reminders.length - 5} more`);
    }

    return lines.join('\n');
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private filterByList(reminders: AppleReminder[]): AppleReminder[] {
    let filtered = reminders;

    if (this.config.includedLists.length > 0) {
      filtered = filtered.filter(r =>
        this.config.includedLists.includes(r.list)
      );
    }

    if (this.config.excludedLists.length > 0) {
      filtered = filtered.filter(r =>
        !this.config.excludedLists.includes(r.list)
      );
    }

    return filtered;
  }
}
