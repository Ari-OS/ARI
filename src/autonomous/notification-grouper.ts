/**
 * ARI Notification Grouper
 *
 * Batches and groups related notifications to reduce noise.
 * Key features:
 * - Groups notifications sharing the same groupKey into summaries
 * - Auto-resolves non-critical notifications after a timeout
 * - Provides batch digest generation for P3/P4 queued items
 *
 * Design principles:
 * - P0/P1: Never batched, always immediate
 * - P2: May be grouped but delivered individually
 * - P3: Batched into next digest
 * - P4: Batched into weekly digest or silent
 */

import type { NotificationCategory } from './notification-manager.js';
import type { NotificationPriority } from './types.js';
import type { NotificationRecord } from './notification-lifecycle.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GroupedNotification {
  /** The shared groupKey for this group */
  groupKey: string;
  /** Category of the grouped notifications */
  category: NotificationCategory;
  /** Highest priority among grouped items */
  priority: NotificationPriority;
  /** Individual records in this group */
  records: NotificationRecord[];
  /** When the group was first created */
  createdAt: number;
  /** When the group was last updated */
  updatedAt: number;
  /** Whether this group has been flushed (sent as summary) */
  flushed: boolean;
}

export interface GroupSummary {
  groupKey: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  count: number;
  oldestAt: number;
  newestAt: number;
}

export interface AutoResolveResult {
  resolved: NotificationRecord[];
  reason: string;
}

// ─── Auto-Resolve Timeouts ───────────────────────────────────────────────────

/**
 * After this many ms, non-critical notifications are auto-resolved.
 * P0/P1: Never auto-resolved (require explicit acknowledgment).
 */
const AUTO_RESOLVE_TIMEOUT_MS: Record<NotificationPriority, number> = {
  P0: Infinity,              // Never auto-resolve
  P1: Infinity,              // Never auto-resolve
  P2: 4 * 60 * 60 * 1000,   // 4 hours
  P3: 12 * 60 * 60 * 1000,  // 12 hours
  P4: 2 * 60 * 60 * 1000,   // 2 hours (noise — resolve fast)
};

// ─── Notification Grouper ────────────────────────────────────────────────────

export class NotificationGrouper {
  private groups: Map<string, GroupedNotification> = new Map();

  /**
   * Add a notification to a group. If no group exists for the groupKey,
   * creates one. Returns the group.
   */
  add(record: NotificationRecord): GroupedNotification {
    const key = record.groupKey ?? record.id; // Ungrouped items get their own key

    const existing = this.groups.get(key);
    if (existing) {
      existing.records.push(record);
      existing.updatedAt = Date.now();
      // Promote priority to highest in group
      existing.priority = this.higherPriority(existing.priority, record.priority);
      return existing;
    }

    const group: GroupedNotification = {
      groupKey: key,
      category: record.category,
      priority: record.priority,
      records: [record],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      flushed: false,
    };
    this.groups.set(key, group);
    return group;
  }

  /**
   * Check if a notification should be grouped (deferred) or sent immediately.
   * P0/P1: Always immediate.
   * P2+: Group if there are already pending items with the same groupKey.
   */
  shouldDefer(record: NotificationRecord): boolean {
    // Critical notifications are never deferred
    if (record.priority === 'P0' || record.priority === 'P1') return false;

    // No groupKey means no grouping
    if (!record.groupKey) return false;

    // If there's already a pending group, defer
    const existing = this.groups.get(record.groupKey);
    return !!existing && !existing.flushed;
  }

  /**
   * Get all pending groups that haven't been flushed yet.
   */
  getPendingGroups(): GroupedNotification[] {
    return [...this.groups.values()].filter((g) => !g.flushed && g.records.length > 0);
  }

  /**
   * Get groups that have accumulated enough items to warrant a summary.
   * Threshold: 2+ items in the group.
   */
  getReadyGroups(minItems: number = 2): GroupedNotification[] {
    return this.getPendingGroups().filter((g) => g.records.length >= minItems);
  }

  /**
   * Generate a summary message for a group.
   * Collapses N notifications into one digestible message.
   */
  generateSummary(group: GroupedNotification): GroupSummary {
    const count = group.records.length;
    const oldest = Math.min(...group.records.map((r) => r.createdAt));
    const newest = Math.max(...group.records.map((r) => r.createdAt));

    // Build summary title
    const title = this.buildGroupTitle(group.category, count);

    // Build summary body from individual records
    const body = this.buildGroupBody(group);

    return {
      groupKey: group.groupKey,
      category: group.category,
      priority: group.priority,
      title,
      body,
      count,
      oldestAt: oldest,
      newestAt: newest,
    };
  }

  /**
   * Mark a group as flushed (sent as summary).
   */
  flush(groupKey: string): void {
    const group = this.groups.get(groupKey);
    if (group) {
      group.flushed = true;
    }
  }

  /**
   * Auto-resolve notifications that have exceeded their timeout.
   * Returns list of records that were auto-resolved.
   */
  getAutoResolveCandidates(records: NotificationRecord[]): AutoResolveResult {
    const now = Date.now();
    const resolved: NotificationRecord[] = [];

    for (const record of records) {
      const timeout = AUTO_RESOLVE_TIMEOUT_MS[record.priority];
      if (timeout === Infinity) continue;

      const age = now - record.createdAt;
      if (age > timeout) {
        resolved.push(record);
      }
    }

    return {
      resolved,
      reason: 'Auto-resolved: exceeded timeout without acknowledgment',
    };
  }

  /**
   * Generate a batch digest from all pending P3/P4 notifications.
   * Used for morning/evening digest inclusion.
   */
  generateBatchDigest(records: NotificationRecord[]): GroupSummary[] {
    // Group by category
    const byCategory = new Map<NotificationCategory, NotificationRecord[]>();
    for (const record of records) {
      const existing = byCategory.get(record.category) ?? [];
      existing.push(record);
      byCategory.set(record.category, existing);
    }

    const digests: GroupSummary[] = [];
    for (const [category, catRecords] of byCategory.entries()) {
      if (catRecords.length === 0) continue;

      const oldest = Math.min(...catRecords.map((r) => r.createdAt));
      const newest = Math.max(...catRecords.map((r) => r.createdAt));
      const highestPriority = catRecords.reduce(
        (best, r) => this.higherPriority(best, r.priority),
        'P4' as NotificationPriority,
      );

      digests.push({
        groupKey: `digest:${category}`,
        category,
        priority: highestPriority,
        title: this.buildGroupTitle(category, catRecords.length),
        body: this.buildDigestBody(catRecords),
        count: catRecords.length,
        oldestAt: oldest,
        newestAt: newest,
      });
    }

    // Sort by priority (P0 first), then by count
    return digests.sort((a, b) => {
      const pOrd = this.priorityOrdinal(a.priority) - this.priorityOrdinal(b.priority);
      if (pOrd !== 0) return pOrd;
      return b.count - a.count;
    });
  }

  /**
   * Get a specific group by key.
   */
  getGroup(groupKey: string): GroupedNotification | undefined {
    return this.groups.get(groupKey);
  }

  /**
   * Get total number of tracked groups.
   */
  get size(): number {
    return this.groups.size;
  }

  /**
   * Clean up flushed groups older than the given age.
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;

    for (const [key, group] of this.groups.entries()) {
      if (group.flushed && group.updatedAt < cutoff) {
        this.groups.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Build a human-readable group title.
   */
  private buildGroupTitle(category: NotificationCategory, count: number): string {
    const categoryLabels: Record<NotificationCategory, string> = {
      error: 'Error',
      security: 'Security',
      opportunity: 'Opportunity',
      milestone: 'Milestone',
      insight: 'Insight',
      question: 'Question',
      reminder: 'Reminder',
      finance: 'Finance',
      task: 'Task',
      system: 'System',
      daily: 'Daily',
      budget: 'Budget',
      billing: 'Billing',
      value: 'Value',
      adaptive: 'Adaptive',
      governance: 'Governance',
    };

    const label = categoryLabels[category] ?? category;
    if (count === 1) return label;
    return `${count} ${label} Notifications`;
  }

  /**
   * Build grouped notification body.
   */
  private buildGroupBody(group: GroupedNotification): string {
    if (group.records.length === 1) {
      return group.records[0].body;
    }

    const lines: string[] = [];
    const maxShown = 5;
    const shown = group.records.slice(0, maxShown);

    for (const record of shown) {
      // Truncate individual items for the summary
      const snippet = record.title.length > 60
        ? record.title.slice(0, 57) + '...'
        : record.title;
      lines.push(`  - ${snippet}`);
    }

    if (group.records.length > maxShown) {
      lines.push(`  ... and ${group.records.length - maxShown} more`);
    }

    return lines.join('\n');
  }

  /**
   * Build digest body from a list of records.
   */
  private buildDigestBody(records: NotificationRecord[]): string {
    const lines: string[] = [];
    const maxShown = 5;
    const shown = records.slice(0, maxShown);

    for (const record of shown) {
      const snippet = record.title.length > 60
        ? record.title.slice(0, 57) + '...'
        : record.title;
      lines.push(`  - [${record.priority}] ${snippet}`);
    }

    if (records.length > maxShown) {
      lines.push(`  ... and ${records.length - maxShown} more`);
    }

    return lines.join('\n');
  }

  /**
   * Return the higher of two priority levels.
   */
  private higherPriority(a: NotificationPriority, b: NotificationPriority): NotificationPriority {
    return this.priorityOrdinal(a) <= this.priorityOrdinal(b) ? a : b;
  }

  /**
   * Convert priority to ordinal (lower = higher priority).
   */
  private priorityOrdinal(p: NotificationPriority): number {
    const map: Record<NotificationPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
    return map[p];
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const notificationGrouper = new NotificationGrouper();
