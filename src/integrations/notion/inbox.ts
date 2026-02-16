/**
 * ARI Notion Inbox Integration
 *
 * Manages the "ARI Inbox" database in Notion for notifications,
 * updates, and status tracking. Provides high-level operations
 * for the notification system.
 */

import { NotionClient, type NotionPageContent, type NotionDatabaseEntry } from './client.js';
import type { NotificationEntry, NotionConfig } from '../../autonomous/types.js';

export interface InboxStats {
  total: number;
  unread: number;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  todayCount: number;
}

export class NotionInbox {
  private client: NotionClient;
  private databaseId: string | undefined;
  private dailyLogParentId: string | undefined;
  private tasksDbId: string | undefined;

  constructor(config: NotionConfig) {
    this.client = new NotionClient(config);
    this.databaseId = config.inboxDatabaseId;
    this.dailyLogParentId = config.dailyLogParentId;
    this.tasksDbId = config.tasksDbId;
  }

  /**
   * Initialize the inbox
   */
  async init(): Promise<boolean> {
    const success = this.client.init();
    if (!success) {
      return false;
    }

    // Test connection
    return await this.client.testConnection();
  }

  /**
   * Check if inbox is ready
   */
  isReady(): boolean {
    return this.client.isReady() && !!this.databaseId;
  }

  /**
   * Create an inbox entry from a notification
   */
  async createEntry(notification: NotificationEntry): Promise<string | null> {
    if (!this.isReady() || !this.databaseId) {
      return null;
    }

    const content: NotionPageContent = {
      title: `${this.getPriorityEmoji(notification.priority)} ${notification.title}`,
      body: notification.body,
      priority: notification.priority,
      category: notification.category,
      status: 'unread',
    };

    const result = await this.client.createDatabaseEntry(this.databaseId, content);
    return result?.id ?? null;
  }

  /**
   * Mark an entry as read
   */
  async markAsRead(pageId: string): Promise<boolean> {
    return await this.client.updatePage(pageId, { status: 'read' });
  }

  /**
   * Archive an entry
   */
  async archive(pageId: string): Promise<boolean> {
    return await this.client.updatePage(pageId, { status: 'archived' });
  }

  /**
   * Add a follow-up note to an entry
   */
  async addNote(pageId: string, note: string): Promise<boolean> {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Indiana/Indianapolis',
    });
    return await this.client.appendToPage(pageId, `[${timestamp}] ${note}`);
  }

  /**
   * Get unread entries
   */
  async getUnread(): Promise<NotionDatabaseEntry[]> {
    if (!this.isReady() || !this.databaseId) {
      return [];
    }

    return await this.client.queryDatabase(this.databaseId, { status: 'unread' });
  }

  /**
   * Get entries by priority
   */
  async getByPriority(priority: string): Promise<NotionDatabaseEntry[]> {
    if (!this.isReady() || !this.databaseId) {
      return [];
    }

    return await this.client.queryDatabase(this.databaseId, { priority });
  }

  /**
   * Get today's entries
   */
  async getTodayEntries(): Promise<NotionDatabaseEntry[]> {
    if (!this.isReady() || !this.databaseId) {
      return [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await this.client.queryDatabase(this.databaseId, { createdAfter: today });
  }

  /**
   * Get inbox statistics
   */
  async getStats(): Promise<InboxStats | null> {
    if (!this.isReady() || !this.databaseId) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all entries (recent)
    const allEntries = await this.client.queryDatabase(this.databaseId);
    const todayEntries = await this.client.queryDatabase(this.databaseId, { createdAfter: today });
    const unreadEntries = await this.client.queryDatabase(this.databaseId, { status: 'unread' });

    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const entry of allEntries) {
      if (entry.priority) {
        byPriority[entry.priority] = (byPriority[entry.priority] ?? 0) + 1;
      }
      if (entry.category) {
        byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
      }
    }

    return {
      total: allEntries.length,
      unread: unreadEntries.length,
      byPriority,
      byCategory,
      todayCount: todayEntries.length,
    };
  }

  /**
   * Create a daily log page
   */
  async createDailyLog(content: {
    summary: string;
    highlights: string[];
    issues: string[];
    metrics?: Record<string, string | number>;
  }): Promise<string | null> {
    if (!this.client.isReady() || !this.dailyLogParentId) {
      return null;
    }

    const result = await this.client.createDailyLogPage(
      this.dailyLogParentId,
      new Date(),
      content
    );

    return result?.id ?? null;
  }

  /**
   * Create a batch summary entry
   */
  async createBatchSummary(entries: NotificationEntry[]): Promise<string | null> {
    if (!this.isReady() || !this.databaseId || entries.length === 0) {
      return null;
    }

    // Group by category
    const byCategory = new Map<string, NotificationEntry[]>();
    for (const entry of entries) {
      const existing = byCategory.get(entry.category) ?? [];
      existing.push(entry);
      byCategory.set(entry.category, existing);
    }

    // Build summary body
    const lines: string[] = [
      `${entries.length} notifications batched:`,
      '',
    ];

    byCategory.forEach((items, category) => {
      lines.push(`## ${category} (${items.length})`);
      for (const item of items.slice(0, 5)) {
        lines.push(`- ${item.title}`);
      }
      if (items.length > 5) {
        lines.push(`... and ${items.length - 5} more`);
      }
      lines.push('');
    });

    const content: NotionPageContent = {
      title: `Batch Summary - ${entries.length} items`,
      body: lines.join('\n'),
      priority: 'P3',
      category: 'batch',
      status: 'unread',
    };

    const result = await this.client.createDatabaseEntry(this.databaseId, content);
    return result?.id ?? null;
  }

  // ── Task Management ────────────────────────────────────────────────────

  /**
   * Check if tasks database is configured
   */
  hasTasksDb(): boolean {
    return this.client.isReady() && !!this.tasksDbId;
  }

  /**
   * Quick-capture a task from Telegram
   */
  async quickTask(
    name: string,
    options?: { priority?: 'High' | 'Medium' | 'Low'; dueDate?: Date; description?: string }
  ): Promise<{ id: string; url: string } | null> {
    if (!this.hasTasksDb() || !this.tasksDbId) {
      return null;
    }

    return await this.client.createTask(this.tasksDbId, {
      name,
      priority: options?.priority,
      dueDate: options?.dueDate,
      description: options?.description,
    });
  }

  /**
   * Get tasks with optional filter
   */
  async getTasks(filter?: { status?: string; priority?: string }): Promise<NotionDatabaseEntry[]> {
    if (!this.hasTasksDb() || !this.tasksDbId) {
      return [];
    }

    return await this.client.queryDatabase(this.tasksDbId, filter);
  }

  /**
   * Mark a task as done
   */
  async completeTask(pageId: string): Promise<boolean> {
    return await this.client.updateTaskStatus(pageId, 'Done');
  }

  /**
   * Clear cached query results
   */
  clearCache(): void {
    this.client.clearCache();
  }

  /**
   * Get priority emoji for visual hierarchy
   */
  private getPriorityEmoji(priority: string): string {
    const emojis: Record<string, string> = {
      P0: '🔴',
      P1: '🟠',
      P2: '🟡',
      P3: '🔵',
      P4: '⚪',
    };
    return emojis[priority] ?? '⚪';
  }
}
