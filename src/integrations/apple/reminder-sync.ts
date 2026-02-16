/**
 * Apple Reminders → Notion Sync Bridge
 *
 * Polls Apple Reminders for new incomplete items, creates corresponding
 * tasks in Notion, and marks the Apple Reminder as done once synced.
 *
 * Deduplication: By name + date combo to prevent duplicate Notion tasks.
 * Direction: One-way (Apple → Notion). Siri quick-capture → Notion task.
 *
 * Usage:
 *   const sync = new ReminderSync(notionInbox, appleReminders, eventBus);
 *   const result = await sync.syncOnce();
 */

import { createLogger } from '../../kernel/logger.js';
import { EventBus } from '../../kernel/event-bus.js';
import type { AppleReminder } from './reminders.js';
import { AppleReminders } from './reminders.js';
import { NotionInbox } from '../notion/inbox.js';

const log = createLogger('reminder-sync');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
  details: Array<{
    reminderName: string;
    action: 'synced' | 'skipped' | 'error';
    notionPageId?: string;
    reason?: string;
  }>;
}

export interface ReminderSyncConfig {
  /** Auto-mark Apple Reminder as complete after syncing to Notion */
  markCompleteAfterSync: boolean;
  /** Only sync reminders from these lists (empty = all) */
  syncLists: string[];
  /** Ignore reminders older than this many days */
  maxAgeDays: number;
  /** Tag to add to synced Notion tasks */
  notionTag: string;
}

const DEFAULT_CONFIG: ReminderSyncConfig = {
  markCompleteAfterSync: true,
  syncLists: [],
  maxAgeDays: 30,
  notionTag: 'apple-reminder',
};

// ─── Sync Bridge ────────────────────────────────────────────────────────────

export class ReminderSync {
  private notion: NotionInbox;
  private reminders: AppleReminders;
  private eventBus: EventBus | null;
  private config: ReminderSyncConfig;
  private syncedIds: Set<string> = new Set();

  constructor(
    notion: NotionInbox,
    reminders: AppleReminders,
    eventBus?: EventBus,
    config: Partial<ReminderSyncConfig> = {},
  ) {
    this.notion = notion;
    this.reminders = reminders;
    this.eventBus = eventBus ?? null;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run one sync cycle: fetch Apple Reminders → create Notion tasks → mark done
   */
  async syncOnce(): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    // Fetch incomplete Apple Reminders
    const incomplete = await this.reminders.getIncomplete();
    if (incomplete.length === 0) {
      log.info('No incomplete reminders to sync');
      return result;
    }

    // Filter by configured lists
    const toSync = this.filterReminders(incomplete);
    log.info(`Processing ${toSync.length} reminders for sync`);

    for (const reminder of toSync) {
      try {
        // Check if already synced (by tracking IDs in memory)
        if (this.syncedIds.has(reminder.id)) {
          result.skipped++;
          result.details.push({
            reminderName: reminder.name,
            action: 'skipped',
            reason: 'Already synced (in-memory dedup)',
          });
          continue;
        }

        // Check dedup by name similarity in recent Notion entries
        const isDuplicate = await this.checkNotionDuplicate(reminder);
        if (isDuplicate) {
          this.syncedIds.add(reminder.id);
          result.skipped++;
          result.details.push({
            reminderName: reminder.name,
            action: 'skipped',
            reason: 'Duplicate found in Notion',
          });
          continue;
        }

        // Create Notion task
        const notionPageId = await this.createNotionTask(reminder);
        if (!notionPageId) {
          result.errors++;
          result.details.push({
            reminderName: reminder.name,
            action: 'error',
            reason: 'Failed to create Notion task',
          });
          continue;
        }

        // Mark Apple Reminder as complete
        if (this.config.markCompleteAfterSync) {
          await this.reminders.markComplete(reminder.id);
        }

        // Track as synced
        this.syncedIds.add(reminder.id);
        result.synced++;
        result.details.push({
          reminderName: reminder.name,
          action: 'synced',
          notionPageId,
        });

        // Emit sync event
        this.eventBus?.emit('memory:stored', {
          memoryId: notionPageId,
          type: 'reminder-sync',
          partition: 'tasks',
          agent: 'autonomous',
        });

        log.info(`Synced reminder "${reminder.name}" → Notion ${notionPageId}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors++;
        result.details.push({
          reminderName: reminder.name,
          action: 'error',
          reason: message,
        });
        log.warn(`Failed to sync reminder "${reminder.name}": ${message}`);
      }
    }

    log.info(`Sync complete: ${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors`);
    return result;
  }

  /**
   * Get count of items waiting to sync
   */
  async getPendingCount(): Promise<number> {
    const incomplete = await this.reminders.getIncomplete();
    return this.filterReminders(incomplete).filter(r => !this.syncedIds.has(r.id)).length;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private filterReminders(reminders: AppleReminder[]): AppleReminder[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.maxAgeDays);

    let filtered = reminders.filter(r => r.creationDate >= cutoff);

    if (this.config.syncLists.length > 0) {
      filtered = filtered.filter(r =>
        this.config.syncLists.includes(r.list)
      );
    }

    return filtered;
  }

  private async checkNotionDuplicate(reminder: AppleReminder): Promise<boolean> {
    if (!this.notion.isReady()) return false;

    try {
      const entries = await this.notion.getTodayEntries();
      // Simple name-based dedup: check if any recent entry title contains the reminder name
      return entries.some(entry =>
        entry.title?.toLowerCase().includes(reminder.name.toLowerCase())
      );
    } catch {
      // If we can't check, assume not duplicate (will create)
      return false;
    }
  }

  private async createNotionTask(reminder: AppleReminder): Promise<string | null> {
    if (!this.notion.isReady()) {
      log.warn('Notion not ready — cannot create task');
      return null;
    }

    const priority = reminder.priority === 1 ? 'High'
      : reminder.priority === 5 ? 'Medium'
      : 'Low';

    const dueStr = reminder.dueDate
      ? reminder.dueDate.toISOString().split('T')[0]
      : '';

    const body = [
      `**Source:** Apple Reminders (${reminder.list})`,
      reminder.body ? `**Notes:** ${reminder.body}` : '',
      dueStr ? `**Due:** ${dueStr}` : '',
      `**Priority:** ${priority}`,
      `**Tag:** ${this.config.notionTag}`,
    ].filter(Boolean).join('\n');

    const pageId = await this.notion.createDailyLog({
      summary: `Task: ${reminder.name}`,
      highlights: [body],
      issues: [],
    });

    return pageId;
  }
}
