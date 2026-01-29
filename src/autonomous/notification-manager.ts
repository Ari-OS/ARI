/**
 * ARI Notification Manager
 *
 * Intelligent notification system that decides WHEN and HOW to notify Pryce.
 * Uses context, time, importance, and history to avoid noise while ensuring
 * critical information gets through.
 *
 * Philosophy: Notify only when it adds value to Pryce's life.
 */

import { PushoverClient } from './pushover-client.js';
import { dailyAudit } from './daily-audit.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low' | 'silent';

export type NotificationCategory =
  | 'error'           // System errors, failures
  | 'security'        // Security alerts
  | 'opportunity'     // Time-sensitive opportunities
  | 'milestone'       // Significant achievements
  | 'insight'         // Valuable learnings
  | 'question'        // ARI needs input
  | 'reminder'        // Scheduled reminders
  | 'finance'         // Money-related
  | 'task'            // Task completions
  | 'system'          // System status
  | 'daily';          // Daily summaries

export interface NotificationRequest {
  category: NotificationCategory;
  title: string;
  body: string;
  priority?: NotificationPriority;
  data?: Record<string, unknown>;
  actionUrl?: string;
  expiresAt?: Date;
}

export interface NotificationResult {
  sent: boolean;
  reason: string;
  notificationId?: string;
  queuedForBatch?: boolean;
}

interface NotificationHistory {
  category: NotificationCategory;
  title: string;
  sentAt: number;
  priority: NotificationPriority;
}

interface NotificationConfig {
  quietHours: { start: number; end: number };
  maxPerHour: number;
  maxPerDay: number;
  batchTime: number; // Hour to send batched notifications
  cooldowns: Record<NotificationCategory, number>; // Minutes between same category
}

// ─── Default Configuration ───────────────────────────────────────────────────

const DEFAULT_CONFIG: NotificationConfig = {
  quietHours: { start: 22, end: 7 }, // 10pm - 7am
  maxPerHour: 5,
  maxPerDay: 20,
  batchTime: 8, // 8am
  cooldowns: {
    error: 5,
    security: 0, // Always send security
    opportunity: 0,
    milestone: 30,
    insight: 60,
    question: 0,
    reminder: 0,
    finance: 30,
    task: 15,
    system: 60,
    daily: 1440, // Once per day
  },
};

// ─── Priority Rules ──────────────────────────────────────────────────────────

const CATEGORY_PRIORITIES: Record<NotificationCategory, NotificationPriority> = {
  error: 'high',
  security: 'critical',
  opportunity: 'high',
  milestone: 'normal',
  insight: 'low',
  question: 'high',
  reminder: 'normal',
  finance: 'normal',
  task: 'low',
  system: 'low',
  daily: 'normal',
};

// ─── Notification Manager ────────────────────────────────────────────────────

export class NotificationManager {
  private pushover: PushoverClient | null = null;
  private config: NotificationConfig;
  private history: NotificationHistory[] = [];
  private batchQueue: NotificationRequest[] = [];
  private initialized = false;

  constructor(config: Partial<NotificationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize with Pushover client
   */
  init(pushover: PushoverClient): void {
    this.pushover = pushover;
    this.initialized = true;
  }

  /**
   * Main entry point - intelligently handles notification
   */
  async notify(request: NotificationRequest): Promise<NotificationResult> {
    if (!this.initialized || !this.pushover) {
      return { sent: false, reason: 'Not initialized' };
    }

    const priority = request.priority ?? CATEGORY_PRIORITIES[request.category];

    // Critical always goes through
    if (priority === 'critical') {
      return this.sendNow(request, priority);
    }

    // Silent just logs
    if (priority === 'silent') {
      await this.logOnly(request);
      return { sent: false, reason: 'Silent notification logged' };
    }

    // Check if expired
    if (request.expiresAt && new Date() > request.expiresAt) {
      return { sent: false, reason: 'Notification expired' };
    }

    // Check quiet hours (high priority can break through)
    if (this.isQuietHours() && priority !== 'high') {
      this.batchQueue.push(request);
      await this.logOnly(request, 'batched_quiet_hours');
      return { sent: false, reason: 'Queued for morning (quiet hours)', queuedForBatch: true };
    }

    // Check rate limits
    if (this.isRateLimited()) {
      if (priority === 'high') {
        return this.sendNow(request, priority);
      }
      this.batchQueue.push(request);
      await this.logOnly(request, 'batched_rate_limit');
      return { sent: false, reason: 'Queued (rate limited)', queuedForBatch: true };
    }

    // Check cooldown for this category
    if (this.isOnCooldown(request.category)) {
      if (priority === 'high') {
        return this.sendNow(request, priority);
      }
      this.batchQueue.push(request);
      await this.logOnly(request, 'batched_cooldown');
      return { sent: false, reason: `Queued (${request.category} cooldown)`, queuedForBatch: true };
    }

    // Low priority gets batched
    if (priority === 'low') {
      this.batchQueue.push(request);
      await this.logOnly(request, 'batched_low_priority');
      return { sent: false, reason: 'Queued for batch (low priority)', queuedForBatch: true };
    }

    // Send it
    return this.sendNow(request, priority);
  }

  /**
   * Send notification immediately
   */
  private async sendNow(
    request: NotificationRequest,
    priority: NotificationPriority
  ): Promise<NotificationResult> {
    if (!this.pushover) {
      return { sent: false, reason: 'Pushover not configured' };
    }

    const message = this.formatMessage(request);
    const pushoverPriority = this.toPushoverPriority(priority);

    const success = await this.pushover.send(message.body, {
      title: message.title,
      priority: pushoverPriority,
      sound: this.getSound(request.category, priority),
      url: request.actionUrl,
    });

    if (success) {
      this.recordHistory(request, priority);
      await dailyAudit.logActivity(
        'notification_sent',
        request.title,
        request.body,
        {
          details: { category: request.category, priority },
          outcome: 'success',
        }
      );
    }

    return {
      sent: success,
      reason: success ? 'Sent' : 'Failed to send',
      notificationId: success ? crypto.randomUUID() : undefined,
    };
  }

  /**
   * Log notification without sending
   */
  private async logOnly(request: NotificationRequest, reason?: string): Promise<void> {
    await dailyAudit.logActivity(
      'notification_batched',
      request.title,
      request.body,
      {
        details: {
          category: request.category,
          priority: request.priority ?? CATEGORY_PRIORITIES[request.category],
          reason,
        },
      }
    );
  }

  /**
   * Format the notification message
   */
  private formatMessage(request: NotificationRequest): { title: string; body: string } {
    const icon = this.getCategoryIcon(request.category);
    return {
      title: `${icon} ${request.title}`,
      body: request.body,
    };
  }

  /**
   * Get icon for category
   */
  private getCategoryIcon(category: NotificationCategory): string {
    const icons: Record<NotificationCategory, string> = {
      error: '✗',
      security: '◆',
      opportunity: '◇',
      milestone: '★',
      insight: '◈',
      question: '?',
      reminder: '○',
      finance: '$',
      task: '✓',
      system: '▪',
      daily: '▫',
    };
    return icons[category];
  }

  /**
   * Get appropriate sound
   */
  private getSound(category: NotificationCategory, priority: NotificationPriority): string {
    if (priority === 'critical') return 'siren';
    if (priority === 'high') return 'cosmic';

    const sounds: Record<NotificationCategory, string> = {
      error: 'falling',
      security: 'siren',
      opportunity: 'magic',
      milestone: 'magic',
      insight: 'cosmic',
      question: 'pushover',
      reminder: 'pushover',
      finance: 'cashregister',
      task: 'none',
      system: 'none',
      daily: 'cosmic',
    };
    return sounds[category];
  }

  /**
   * Convert to Pushover priority
   */
  private toPushoverPriority(priority: NotificationPriority): -2 | -1 | 0 | 1 {
    switch (priority) {
      case 'critical': return 1;
      case 'high': return 0;
      case 'normal': return 0;
      case 'low': return -1;
      case 'silent': return -2;
    }
  }

  /**
   * Check if in quiet hours
   */
  private isQuietHours(): boolean {
    const hour = new Date().getHours();
    const { start, end } = this.config.quietHours;

    if (start > end) {
      return hour >= start || hour < end;
    }
    return hour >= start && hour < end;
  }

  /**
   * Check rate limits
   */
  private isRateLimited(): boolean {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Clean old history
    this.history = this.history.filter(h => h.sentAt > oneDayAgo);

    const hourlyCount = this.history.filter(h => h.sentAt > oneHourAgo).length;
    const dailyCount = this.history.length;

    return hourlyCount >= this.config.maxPerHour || dailyCount >= this.config.maxPerDay;
  }

  /**
   * Check if category is on cooldown
   */
  private isOnCooldown(category: NotificationCategory): boolean {
    const cooldownMinutes = this.config.cooldowns[category];
    if (cooldownMinutes === 0) return false;

    const cooldownMs = cooldownMinutes * 60 * 1000;
    const lastSent = this.history
      .filter(h => h.category === category)
      .sort((a, b) => b.sentAt - a.sentAt)[0];

    if (!lastSent) return false;

    return Date.now() - lastSent.sentAt < cooldownMs;
  }

  /**
   * Record sent notification in history
   */
  private recordHistory(request: NotificationRequest, priority: NotificationPriority): void {
    this.history.push({
      category: request.category,
      title: request.title,
      sentAt: Date.now(),
      priority,
    });
  }

  /**
   * Send batched notifications as a summary
   */
  async sendBatchSummary(): Promise<void> {
    if (this.batchQueue.length === 0 || !this.pushover) return;

    const summary = this.formatBatchSummary();

    await this.pushover.send(summary.body, {
      title: summary.title,
      priority: 0,
      sound: 'cosmic',
    });

    await dailyAudit.logActivity(
      'notification_sent',
      'Batch Summary',
      `${this.batchQueue.length} notifications batched`,
      { outcome: 'success' }
    );

    this.batchQueue = [];
  }

  /**
   * Format batch summary
   */
  private formatBatchSummary(): { title: string; body: string } {
    const byCategory = new Map<NotificationCategory, NotificationRequest[]>();

    for (const req of this.batchQueue) {
      const existing = byCategory.get(req.category) || [];
      existing.push(req);
      byCategory.set(req.category, existing);
    }

    const lines: string[] = [];
    lines.push(`${this.batchQueue.length} updates while away:`);
    lines.push('');

    byCategory.forEach((items, category) => {
      const icon = this.getCategoryIcon(category);
      lines.push(`${icon} ${category} (${items.length})`);
      items.slice(0, 2).forEach(item => {
        lines.push(`  · ${item.title}`);
      });
      if (items.length > 2) {
        lines.push(`  + ${items.length - 2} more`);
      }
    });

    return {
      title: '▫ Summary',
      body: lines.join('\n'),
    };
  }

  /**
   * Get batch queue count
   */
  getBatchCount(): number {
    return this.batchQueue.length;
  }

  // ─── Convenience Methods ─────────────────────────────────────────────────────

  /**
   * Notify about an error
   */
  async error(title: string, details: string): Promise<NotificationResult> {
    return this.notify({
      category: 'error',
      title,
      body: details,
      priority: 'high',
    });
  }

  /**
   * Notify about a security event
   */
  async security(title: string, details: string): Promise<NotificationResult> {
    return this.notify({
      category: 'security',
      title,
      body: details,
      priority: 'critical',
    });
  }

  /**
   * Notify about an opportunity
   */
  async opportunity(
    title: string,
    details: string,
    urgency: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<NotificationResult> {
    const indicator = urgency === 'high' ? '▲▲▲' : urgency === 'medium' ? '▲▲' : '▲';
    return this.notify({
      category: 'opportunity',
      title: `${title} ${indicator}`,
      body: details,
      priority: urgency === 'high' ? 'high' : 'normal',
    });
  }

  /**
   * Notify about a milestone
   */
  async milestone(title: string, details: string): Promise<NotificationResult> {
    return this.notify({
      category: 'milestone',
      title,
      body: details,
      priority: 'normal',
    });
  }

  /**
   * Share an insight
   */
  async insight(domain: string, insight: string): Promise<NotificationResult> {
    return this.notify({
      category: 'insight',
      title: `${domain} Insight`,
      body: insight,
      priority: 'low',
    });
  }

  /**
   * Ask a question
   */
  async question(question: string, options?: string[]): Promise<NotificationResult> {
    let body = question;
    if (options && options.length > 0) {
      body += '\n\nOptions:';
      options.forEach((opt, i) => {
        body += `\n${i + 1}. ${opt}`;
      });
    }

    return this.notify({
      category: 'question',
      title: 'Input Needed',
      body,
      priority: 'high',
    });
  }

  /**
   * Finance notification
   */
  async finance(title: string, details: string, urgent = false): Promise<NotificationResult> {
    return this.notify({
      category: 'finance',
      title,
      body: details,
      priority: urgent ? 'high' : 'normal',
    });
  }

  /**
   * Task completion notification
   */
  async taskComplete(
    taskName: string,
    success: boolean,
    summary: string
  ): Promise<NotificationResult> {
    const icon = success ? '✓' : '✗';
    const word = success ? 'Done' : 'Failed';

    return this.notify({
      category: 'task',
      title: `${icon} ${word}: ${taskName}`,
      body: summary,
      priority: success ? 'low' : 'high',
    });
  }

  /**
   * Send daily summary
   */
  async dailySummary(audit: {
    tasksCompleted: number;
    tasksFailed: number;
    estimatedCost: number;
    highlights: string[];
    issues: string[];
    efficiency: { tasksPerApiDollar: number; trend: string };
  }): Promise<NotificationResult> {
    const lines: string[] = [];

    // Stats bar
    const successRate = audit.tasksCompleted + audit.tasksFailed > 0
      ? Math.round((audit.tasksCompleted / (audit.tasksCompleted + audit.tasksFailed)) * 100)
      : 100;
    lines.push(`✓ ${audit.tasksCompleted}  ✗ ${audit.tasksFailed}  ◈ $${audit.estimatedCost.toFixed(2)}  ${successRate}%`);

    // Trend indicator
    const trend = audit.efficiency.trend === 'improving' ? '↑' :
                  audit.efficiency.trend === 'declining' ? '↓' : '→';
    lines.push(`Efficiency ${trend} ${audit.efficiency.tasksPerApiDollar.toFixed(1)} tasks/$`);

    // Highlights
    if (audit.highlights.length > 0) {
      lines.push('');
      audit.highlights.slice(0, 3).forEach(h => {
        lines.push(`▸ ${h}`);
      });
    }

    // Issues
    if (audit.issues.length > 0) {
      lines.push('');
      audit.issues.slice(0, 2).forEach(i => {
        lines.push(`⚠ ${i}`);
      });
    }

    return this.notify({
      category: 'daily',
      title: 'Daily Report',
      body: lines.join('\n'),
      priority: audit.issues.length > 0 ? 'normal' : 'low',
    });
  }

  /**
   * Cost alert
   */
  async costAlert(spent: number, limit: number, daysRemaining: number): Promise<NotificationResult> {
    const percent = Math.round((spent / limit) * 100);
    const filled = Math.round(percent / 10);
    const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled);

    return this.notify({
      category: 'finance',
      title: 'Budget Update',
      body: `${bar} ${percent}%\n\n$${spent.toFixed(2)} / $${limit.toFixed(2)}\n${daysRemaining} days left`,
      priority: percent >= 90 ? 'high' : percent >= 75 ? 'normal' : 'low',
    });
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const notificationManager = new NotificationManager();
