/**
 * ARI Multi-Channel Notification Manager
 *
 * Intelligent notification system that routes notifications through
 * Telegram (primary), SMS (emergency backup), and Notion (record-keeping)
 * based on priority, time of day, and rate limits.
 *
 * Channel Decision Matrix:
 * | Priority | Work Hours (7a-10p)    | Quiet Hours (10p-7a)     |
 * |----------|------------------------|--------------------------|
 * | P0       | SMS + Telegram + Notion| SMS + Telegram + Notion  |
 * | P1       | Telegram + Notion      | Queue for 7AM Telegram   |
 * | P2       | Telegram + Notion      | Queue                    |
 * | P3-P4    | Notion (batched)       | Queue                    |
 *
 * Philosophy: Notify only when it adds value to the operator's life.
 */

import { GmailSMS, type SMSResult } from '../integrations/sms/gmail-sms.js';
import { NotionInbox } from '../integrations/notion/inbox.js';
import { TelegramSender, type TelegramSendResult, type TelegramSenderConfig } from '../integrations/telegram/sender.js';
import { dailyAudit } from './daily-audit.js';
import { priorityScorer, legacyPriorityToOverrides, type ScoringResult } from './priority-scorer.js';
import type {
  SMSConfig,
  NotionConfig,
  NotificationEntry,
  NotificationPriority as TypedPriority,
  QueuedNotification,
} from './types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

// Internal priority type (distinct from types.ts NotificationPriority which is P0-P4)
type InternalPriority = 'critical' | 'high' | 'normal' | 'low' | 'silent';

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
  | 'daily'           // Daily summaries
  | 'budget'          // Budget thresholds and alerts
  | 'billing'         // Billing cycle events
  | 'value'           // Value analytics
  | 'adaptive';       // Adaptive learning recommendations

export interface NotificationRequest {
  category: NotificationCategory;
  title: string;
  body: string;
  priority?: InternalPriority;
  data?: Record<string, unknown>;
  actionUrl?: string;
  expiresAt?: Date;
  dedupKey?: string; // For deduplication
  telegramHtml?: string; // Pre-formatted HTML for Telegram (bypasses auto-formatting)
}

export interface NotificationResult {
  sent: boolean;
  reason: string;
  notificationId?: string;
  queuedForBatch?: boolean;
  channels?: {
    sms?: SMSResult;
    telegram?: TelegramSendResult;
    notion?: { pageId?: string };
  };
}

interface NotificationHistory {
  category: NotificationCategory;
  title: string;
  sentAt: number;
  priority: InternalPriority;
  dedupKey?: string;
}

interface NotificationConfig {
  quietHours: { start: number; end: number };
  maxSmsPerHour: number;
  maxPerDay: number;
  batchTime: number; // Hour to send batched notifications
  escalationThreshold: number; // Number of same errors before escalation
  cooldowns: Record<NotificationCategory, number>; // Minutes between same category
  timezone: string;
}

interface ChannelConfig {
  sms: SMSConfig;
  telegram?: TelegramSenderConfig;
  notion: NotionConfig;
}

// ─── Default Configuration ───────────────────────────────────────────────────

const DEFAULT_CONFIG: NotificationConfig = {
  quietHours: { start: 22, end: 7 }, // 10pm - 7am Indiana time
  maxSmsPerHour: 5,
  maxPerDay: 20,
  batchTime: 7, // 7am - send queued notifications
  escalationThreshold: 3, // 3 same P1 errors → escalate to P0
  timezone: 'America/Indiana/Indianapolis',
  cooldowns: {
    error: 5,
    security: 0,       // Always send security
    opportunity: 15,   // Reduced spam — was 0
    milestone: 120,    // Nice-to-know, not urgent — was 30
    insight: 360,      // Max 2-3/day — was 60
    question: 0,       // ARI needs input — keep at 0
    reminder: 0,
    finance: 60,       // Reduced noise — was 30
    task: 30,          // Batch more — was 15
    system: 120,       // Background info — was 60
    daily: 1440,       // Once per day
    budget: 120,       // Reduced fatigue — was 60
    billing: 1440,     // Once per day
    value: 720,        // Twice per day max
    adaptive: 1440,    // Once per day
  },
};

// ─── Priority Mapping ────────────────────────────────────────────────────────
// Static CATEGORY_PRIORITIES and PRIORITY_TO_P removed — replaced by PriorityScorer.
// See src/autonomous/priority-scorer.ts for multi-factor dynamic scoring.

// ─── Multi-Channel Notification Manager ──────────────────────────────────────

export class NotificationManager {
  private sms: GmailSMS | null = null;
  private telegram: TelegramSender | null = null;
  private notion: NotionInbox | null = null;
  private config: NotificationConfig;
  private history: NotificationHistory[] = [];
  private batchQueue: QueuedNotification[] = [];
  private legacyBatchQueue: NotificationRequest[] = []; // For backward compat
  private escalationTracker: Map<string, { count: number; firstSeen: number }> = new Map();
  private initialized = false;

  constructor(config: Partial<NotificationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Quick init for environments where channels are configured later
   * Marks as initialized so notify() works in degraded mode (log-only)
   */
  initLegacy(): void {
    this.initialized = true;
  }

  /**
   * Initialize with channel configurations
   */
  async init(channels: ChannelConfig): Promise<{ sms: boolean; telegram: boolean; notion: boolean }> {
    const results = { sms: false, telegram: false, notion: false };

    // Initialize SMS (emergency backup)
    if (channels.sms.enabled) {
      this.sms = new GmailSMS(channels.sms);
      results.sms = this.sms.init();
      if (results.sms) {
        results.sms = await this.sms.testConnection();
      }
    }

    // Initialize Telegram (primary channel)
    if (channels.telegram?.enabled) {
      this.telegram = new TelegramSender(channels.telegram);
      results.telegram = await this.telegram.init();
    }

    // Initialize Notion (record-keeping)
    if (channels.notion.enabled) {
      this.notion = new NotionInbox(channels.notion);
      results.notion = await this.notion.init();
    }

    this.initialized = results.telegram || results.sms || results.notion;
    return results;
  }

  /**
   * Check if at least one channel is ready
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Main entry point - intelligently routes notification
   *
   * Uses PriorityScorer for multi-factor dynamic scoring.
   * Legacy callers passing explicit priority strings are bridged via legacyPriorityToOverrides.
   */
  async notify(request: NotificationRequest): Promise<NotificationResult> {
    if (!this.initialized) {
      return { sent: false, reason: 'Not initialized' };
    }

    // Score using multi-factor priority system
    const scoringResult = this.scoreNotification(request);
    const priority = request.priority ?? this.pLevelToInternal(scoringResult.priority);
    const pLevel = scoringResult.priority;

    // Check for escalation (3 same P1 errors → P0)
    const escalatedPriority = this.checkEscalation(request, pLevel);
    const finalPLevel = escalatedPriority ?? pLevel;

    // Check if expired
    if (request.expiresAt && new Date() > request.expiresAt) {
      return { sent: false, reason: 'Notification expired' };
    }

    // Check cooldown (skip for critical, escalated P0, or active escalation tracking)
    const inEscalationSequence = this.isInEscalationSequence(request);
    if (priority !== 'critical' && finalPLevel !== 'P0' && !inEscalationSequence) {
      const cooldownResult = this.checkCooldown(request);
      if (cooldownResult) {
        return cooldownResult;
      }
    }

    // Route based on priority and time
    return this.routeNotification(request, priority, finalPLevel);
  }

  /**
   * Score a notification using the multi-factor priority system.
   * If caller provides an explicit legacy priority, bridge it to factor overrides.
   */
  private scoreNotification(request: NotificationRequest): ScoringResult {
    const overrides = request.priority
      ? legacyPriorityToOverrides(request.priority)
      : undefined;

    return priorityScorer.score({
      category: request.category,
      overrides,
    });
  }

  /**
   * Convert P-level back to internal priority string (for backward compatibility).
   */
  private pLevelToInternal(pLevel: TypedPriority): InternalPriority {
    const map: Record<TypedPriority, InternalPriority> = {
      P0: 'critical',
      P1: 'high',
      P2: 'normal',
      P3: 'low',
      P4: 'silent',
    };
    return map[pLevel];
  }

  /**
   * Route notification to appropriate channels
   *
   * Strategy: Telegram = primary, SMS = P0 emergency backup, Notion = record-keeping
   */
  private async routeNotification(
    request: NotificationRequest,
    priority: InternalPriority,
    pLevel: TypedPriority
  ): Promise<NotificationResult> {
    const isQuiet = this.isQuietHours();
    const channels: NotificationResult['channels'] = {};
    let sent = false;
    let reason = '';

    // P0 (critical): SMS + Telegram + Notion — bypasses quiet hours
    if (pLevel === 'P0') {
      channels.sms = await this.sendSMS(request, true);
      channels.telegram = await this.sendTelegram(request, true);
      channels.notion = await this.sendNotion(request, pLevel);
      sent = (channels.telegram?.sent ?? false) || (channels.sms?.sent ?? false) || !!channels.notion?.pageId;
      reason = 'P0: Immediate delivery (all channels)';
    }
    // P1 during work hours: Telegram + Notion
    else if (pLevel === 'P1' && !isQuiet) {
      channels.telegram = await this.sendTelegram(request, false);
      channels.notion = await this.sendNotion(request, pLevel);
      sent = (channels.telegram?.sent ?? false) || !!channels.notion?.pageId;
      reason = 'P1: Work hours delivery (Telegram + Notion)';
    }
    // P1 during quiet hours: Queue for morning Telegram
    else if (pLevel === 'P1' && isQuiet) {
      this.queueForMorning(request, pLevel, 'quiet_hours_p1');
      channels.notion = await this.sendNotion(request, pLevel); // Still log to Notion
      sent = false;
      reason = 'P1: Queued for 7 AM Telegram (quiet hours)';
    }
    // P2 during work hours: Telegram + Notion
    else if (pLevel === 'P2' && !isQuiet) {
      channels.telegram = await this.sendTelegram(request, false, true); // silent push
      channels.notion = await this.sendNotion(request, pLevel);
      sent = (channels.telegram?.sent ?? false) || !!channels.notion?.pageId;
      reason = 'P2: Telegram (silent) + Notion';
    }
    // P2+ during quiet hours: Queue
    else if (isQuiet) {
      this.queueForMorning(request, pLevel, 'quiet_hours');
      sent = false;
      reason = `${pLevel}: Queued for morning`;
    }
    // P3/P4 during work hours: Notion batched
    else {
      this.queueForBatch(request, pLevel);
      sent = false;
      reason = `${pLevel}: Batched for next summary`;
    }

    // Record in history
    if (sent) {
      this.recordHistory(request, priority);
    }

    // Log to audit
    await dailyAudit.logActivity(
      sent ? 'notification_sent' : 'notification_batched',
      request.title,
      request.body,
      {
        details: { category: request.category, priority, pLevel, channels },
        outcome: sent ? 'success' : 'pending',
      }
    );

    return {
      sent,
      reason,
      notificationId: sent ? crypto.randomUUID() : undefined,
      queuedForBatch: !sent,
      channels,
    };
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(
    request: NotificationRequest,
    force: boolean
  ): Promise<SMSResult | undefined> {
    if (!this.sms?.isReady()) {
      return undefined;
    }

    const icon = this.getCategoryIcon(request.category);
    const message = `${icon} ${request.title}\n${request.body.slice(0, 100)}`;

    return await this.sms.send(message, { forceDelivery: force });
  }

  /**
   * Send Telegram notification
   */
  private async sendTelegram(
    request: NotificationRequest,
    force: boolean,
    silent = false
  ): Promise<TelegramSendResult | undefined> {
    if (!this.telegram?.isReady()) {
      return undefined;
    }

    // Use pre-formatted HTML if provided, otherwise auto-format
    const message = request.telegramHtml
      ?? `${this.getCategoryIcon(request.category)} <b>${this.escapeHtml(request.title)}</b>\n${this.escapeHtml(request.body)}`;

    return await this.telegram.send(message, { forceDelivery: force, silent });
  }

  /**
   * Escape HTML special characters for Telegram parse_mode=HTML
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Send Notion notification
   */
  private async sendNotion(
    request: NotificationRequest,
    pLevel: TypedPriority
  ): Promise<{ pageId?: string }> {
    if (!this.notion?.isReady()) {
      return {};
    }

    const entry: NotificationEntry = {
      id: crypto.randomUUID(),
      priority: pLevel,
      title: request.title,
      body: request.body,
      category: request.category,
      channel: 'notion',
      sentAt: new Date().toISOString(),
      smsSent: false,
      notionSent: true,
      dedupKey: request.dedupKey,
      escalationCount: 0,
    };

    const pageId = await this.notion.createEntry(entry);
    return { pageId: pageId ?? undefined };
  }

  /**
   * Queue notification for morning delivery
   */
  private queueForMorning(
    request: NotificationRequest,
    pLevel: TypedPriority,
    reason: string
  ): void {
    // Calculate next 7 AM Indiana time
    const now = new Date();
    const indiana = new Date(
      now.toLocaleString('en-US', { timeZone: this.config.timezone })
    );

    const nextMorning = new Date(indiana);
    nextMorning.setHours(this.config.batchTime, 0, 0, 0);

    if (indiana.getHours() >= this.config.batchTime) {
      nextMorning.setDate(nextMorning.getDate() + 1);
    }

    const entry: NotificationEntry = {
      id: crypto.randomUUID(),
      priority: pLevel,
      title: request.title,
      body: request.body,
      category: request.category,
      channel: 'both',
      queuedAt: now.toISOString(),
      queuedFor: nextMorning.toISOString(),
      smsSent: false,
      notionSent: false,
      dedupKey: request.dedupKey,
      escalationCount: 0,
    };

    this.batchQueue.push({
      entry,
      scheduledFor: nextMorning.toISOString(),
      reason,
    });
  }

  /**
   * Queue notification for batched delivery
   */
  private queueForBatch(
    request: NotificationRequest,
    pLevel: TypedPriority
  ): void {
    const entry: NotificationEntry = {
      id: crypto.randomUUID(),
      priority: pLevel,
      title: request.title,
      body: request.body,
      category: request.category,
      channel: 'notion',
      queuedAt: new Date().toISOString(),
      smsSent: false,
      notionSent: false,
      dedupKey: request.dedupKey,
      escalationCount: 0,
    };

    this.batchQueue.push({
      entry,
      scheduledFor: new Date().toISOString(),
      reason: 'low_priority_batch',
    });
  }

  /**
   * Check if repeated errors should escalate to P0
   */
  private checkEscalation(
    request: NotificationRequest,
    currentP: TypedPriority
  ): TypedPriority | null {
    // Only escalate P1 errors
    if (currentP !== 'P1' || request.category !== 'error') {
      return null;
    }

    const key = request.dedupKey ?? `${request.category}:${request.title}`;
    const now = Date.now();
    const windowMs = 30 * 60 * 1000; // 30 minute window

    const existing = this.escalationTracker.get(key);

    if (existing && now - existing.firstSeen < windowMs) {
      existing.count++;
      if (existing.count >= this.config.escalationThreshold) {
        this.escalationTracker.delete(key);
        return 'P0'; // Escalate!
      }
    } else {
      this.escalationTracker.set(key, { count: 1, firstSeen: now });
    }

    // Clean old entries
    for (const [k, v] of this.escalationTracker.entries()) {
      if (now - v.firstSeen > windowMs) {
        this.escalationTracker.delete(k);
      }
    }

    return null;
  }

  /**
   * Check if this notification is part of an active escalation tracking sequence.
   * If so, cooldowns should not apply — we need escalation to work for repeated errors.
   */
  private isInEscalationSequence(request: NotificationRequest): boolean {
    if (request.category !== 'error') return false;
    const key = request.dedupKey ?? `${request.category}:${request.title}`;
    return this.escalationTracker.has(key);
  }

  /**
   * Check if notification is within cooldown period for its category.
   * Returns a result if cooled down (should skip), null if clear to send.
   */
  private checkCooldown(request: NotificationRequest): NotificationResult | null {
    const cooldownMinutes = this.config.cooldowns[request.category];
    if (cooldownMinutes === 0) return null; // No cooldown for this category

    const cooldownMs = cooldownMinutes * 60 * 1000;
    const now = Date.now();

    // Check dedup key first (more specific), then fall back to category match
    const recentMatch = this.history.find((h) => {
      if (now - h.sentAt > cooldownMs) return false;
      if (request.dedupKey && h.dedupKey) return h.dedupKey === request.dedupKey;
      return h.category === request.category;
    });

    if (recentMatch) {
      const minutesAgo = Math.round((now - recentMatch.sentAt) / 60_000);
      return {
        sent: false,
        reason: `Cooldown: ${request.category} sent ${minutesAgo}m ago (limit: ${cooldownMinutes}m)`,
        queuedForBatch: false,
      };
    }

    return null;
  }

  /**
   * Check if in quiet hours (Indiana time)
   */
  private isQuietHours(): boolean {
    const now = new Date();
    const indiana = new Date(
      now.toLocaleString('en-US', { timeZone: this.config.timezone })
    );
    const hour = indiana.getHours();

    const { start, end } = this.config.quietHours;

    // Handle wrap-around (22:00 - 07:00)
    if (start > end) {
      return hour >= start || hour < end;
    }
    return hour >= start && hour < end;
  }

  /**
   * Record sent notification in history
   */
  private recordHistory(request: NotificationRequest, priority: InternalPriority): void {
    this.history.push({
      category: request.category,
      title: request.title,
      sentAt: Date.now(),
      priority,
      dedupKey: request.dedupKey,
    });

    // Keep last 24 hours only
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.history = this.history.filter((h) => h.sentAt > oneDayAgo);
  }

  /**
   * Process and send queued notifications (called at batch time)
   */
  async processQueue(): Promise<{ processed: number; sent: number }> {
    const now = new Date();
    const toProcess = this.batchQueue.filter(
      (q) => new Date(q.scheduledFor) <= now
    );

    if (toProcess.length === 0) {
      return { processed: 0, sent: 0 };
    }

    let sent = 0;

    // Group by priority
    const p1Items = toProcess.filter((q) => q.entry.priority === 'P1');
    const otherItems = toProcess.filter((q) => q.entry.priority !== 'P1');

    // Send P1 items individually via Telegram
    for (const item of p1Items) {
      const icon = this.getCategoryIcon(item.entry.category as NotificationCategory);
      const telegramResult = await this.telegram?.send(
        `${icon} <b>${this.escapeHtml(item.entry.title)}</b>\n${this.escapeHtml(item.entry.body)}`,
        { forceDelivery: false }
      );
      if (telegramResult?.sent) sent++;
    }

    // Batch other items to Notion
    if (otherItems.length > 0 && this.notion?.isReady()) {
      const entries = otherItems.map((q) => q.entry);
      await this.notion.createBatchSummary(entries);
      sent += otherItems.length;
    }

    // Send morning summary via Telegram
    if (toProcess.length > 0 && this.telegram?.isReady()) {
      const summary = `▫ <b>Morning Summary</b>\n${toProcess.length} items (${p1Items.length} important). Check Notion for details.`;
      await this.telegram.send(summary, { forceDelivery: false });
    }

    // Remove processed items
    this.batchQueue = this.batchQueue.filter(
      (q) => new Date(q.scheduledFor) > now
    );

    return { processed: toProcess.length, sent };
  }

  /**
   * Get icon for category
   */
  private getCategoryIcon(category: NotificationCategory): string {
    // Strategic emoji as structural markers — research-backed for mobile scanning
    const icons: Record<NotificationCategory, string> = {
      error: '🔴',
      security: '🔒',
      opportunity: '💡',
      milestone: '🏆',
      insight: '💡',
      question: '❓',
      reminder: '⏰',
      finance: '💰',
      task: '✓',
      system: '⚙️',
      daily: '📋',
      budget: '💰',
      billing: '📊',
      value: '📈',
      adaptive: '🧠',
    };
    return icons[category];
  }

  /**
   * Get batch queue count
   */
  getBatchCount(): number {
    return this.batchQueue.length + this.legacyBatchQueue.length;
  }

  /**
   * Legacy: Send batched notifications as a summary
   * @deprecated Use processQueue() instead
   */
  async sendBatchSummary(): Promise<void> {
    // Process modern queue
    await this.processQueue();

    // Process legacy queue if any
    if (this.legacyBatchQueue.length === 0) return;

    const summary = this.formatLegacyBatchSummary();

    // Send via Telegram (primary) or SMS (fallback)
    if (this.telegram?.isReady()) {
      await this.telegram.send(
        `▫ <b>${this.escapeHtml(summary.title)}</b>\n${this.escapeHtml(summary.body)}`,
        { forceDelivery: false }
      );
    } else if (this.sms?.isReady()) {
      await this.sms.send(summary.body.slice(0, 160), { forceDelivery: false });
    }

    // Log to Notion if available
    if (this.notion?.isReady()) {
      await this.notion.createEntry({
        id: crypto.randomUUID(),
        priority: 'P3',
        title: summary.title,
        body: summary.body,
        category: 'batch',
        channel: 'notion',
        sentAt: new Date().toISOString(),
        smsSent: false,
        notionSent: true,
        escalationCount: 0,
      });
    }

    await dailyAudit.logActivity(
      'notification_sent',
      'Batch Summary',
      `${this.legacyBatchQueue.length} notifications batched`,
      { outcome: 'success' }
    );

    this.legacyBatchQueue = [];
  }

  /**
   * Format legacy batch summary
   */
  private formatLegacyBatchSummary(): { title: string; body: string } {
    const byCategory = new Map<NotificationCategory, NotificationRequest[]>();

    for (const req of this.legacyBatchQueue) {
      const existing = byCategory.get(req.category) || [];
      existing.push(req);
      byCategory.set(req.category, existing);
    }

    const lines: string[] = [];
    lines.push(`${this.legacyBatchQueue.length} updates while away:`);
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
   * Get the priority scorer instance for engagement tracking.
   */
  getScorer(): typeof priorityScorer {
    return priorityScorer;
  }

  /**
   * Get channel status
   */
  getStatus(): {
    sms: { ready: boolean; stats?: ReturnType<GmailSMS['getStats']> };
    telegram: { ready: boolean; stats?: ReturnType<TelegramSender['getStats']> };
    notion: { ready: boolean; stats?: Awaited<ReturnType<NotionInbox['getStats']>> };
    queueSize: number;
  } {
    return {
      sms: {
        ready: this.sms?.isReady() ?? false,
        stats: this.sms?.getStats(),
      },
      telegram: {
        ready: this.telegram?.isReady() ?? false,
        stats: this.telegram?.getStats(),
      },
      notion: {
        ready: this.notion?.isReady() ?? false,
      },
      queueSize: this.batchQueue.length,
    };
  }

  // ─── Convenience Methods ─────────────────────────────────────────────────────

  /**
   * Notify about an error
   */
  async error(title: string, details: string, dedupKey?: string): Promise<NotificationResult> {
    return this.notify({
      category: 'error',
      title,
      body: details,
      priority: 'high',
      dedupKey,
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

  // ─── Budget System Methods ────────────────────────────────────────────────────

  /**
   * Budget warning notification
   */
  async budgetWarning(
    percentUsed: number,
    remaining: number,
    recommendation: string
  ): Promise<NotificationResult> {
    const priority: InternalPriority = percentUsed >= 90 ? 'high' : 'normal';

    return this.notify({
      category: 'budget',
      title: `Budget ${percentUsed.toFixed(0)}% Used`,
      body: `$${remaining.toFixed(2)} remaining today. ${recommendation}`,
      priority,
      dedupKey: `budget_warning_${Math.floor(percentUsed / 5) * 5}`,
    });
  }

  /**
   * Budget critical notification (95%+ consumed)
   */
  async budgetCritical(percentUsed: number): Promise<NotificationResult> {
    return this.notify({
      category: 'budget',
      title: 'Budget Critical',
      body: `Budget ${percentUsed.toFixed(0)}% consumed. Autonomous work paused. User interactions only.`,
      priority: 'critical',
      dedupKey: 'budget_critical',
    });
  }

  /**
   * Billing cycle warning notification
   */
  async billingCycleWarning(daysRemaining: number, status: string): Promise<NotificationResult> {
    return this.notify({
      category: 'billing',
      title: `Billing Cycle: ${daysRemaining} Days Left`,
      body: `Status: ${status}. Review spending at your convenience.`,
      priority: 'normal',
      dedupKey: `billing_warning_${daysRemaining}`,
    });
  }

  /**
   * Billing cycle start notification
   */
  async billingCycleStart(budget: number): Promise<NotificationResult> {
    return this.notify({
      category: 'billing',
      title: 'New Billing Cycle Started',
      body: `Fresh $${budget.toFixed(2)} budget for the next 14 days. Daily target: $${(budget / 14).toFixed(2)}.`,
      priority: 'normal',
      dedupKey: 'billing_cycle_start',
    });
  }

  /**
   * Daily value report notification
   */
  async dailyValueReport(
    score: number,
    cost: number,
    efficiency: string
  ): Promise<NotificationResult> {
    const emoji = score >= 70 ? '★' : score >= 50 ? '✓' : score >= 30 ? '◈' : '✗';

    return this.notify({
      category: 'value',
      title: `${emoji} Daily Value: ${score}/100`,
      body: `Spent $${cost.toFixed(2)} | Efficiency: ${efficiency} | Cost/Point: $${(cost / Math.max(score, 1)).toFixed(3)}`,
      priority: score < 30 ? 'normal' : 'low',
      dedupKey: `value_daily_${new Date().toISOString().split('T')[0]}`,
    });
  }

  /**
   * Weekly value report notification
   */
  async weeklyValueReport(report: {
    averageScore: number;
    totalCost: number;
    trend: string;
    recommendations: string[];
  }): Promise<NotificationResult> {
    const trendEmoji = report.trend === 'improving' ? '↑' :
                       report.trend === 'declining' ? '↓' : '→';

    const lines: string[] = [
      `Avg Score: ${report.averageScore.toFixed(0)}/100 | Total: $${report.totalCost.toFixed(2)} | Trend: ${trendEmoji} ${report.trend}`,
    ];

    if (report.recommendations.length > 0) {
      lines.push('');
      lines.push('Recommendations:');
      report.recommendations.slice(0, 3).forEach(r => {
        lines.push(`• ${r}`);
      });
    }

    return this.notify({
      category: 'value',
      title: `${trendEmoji} Weekly Value Report`,
      body: lines.join('\n'),
      priority: 'normal',
      dedupKey: 'value_weekly',
    });
  }

  /**
   * Adaptive learning recommendation notification
   */
  async adaptiveRecommendation(rec: {
    type: string;
    recommendation: string;
    confidence: number;
  }): Promise<NotificationResult> {
    // Only notify for high-confidence recommendations
    if (rec.confidence < 0.75) {
      return { sent: false, reason: 'Confidence too low' };
    }

    return this.notify({
      category: 'adaptive',
      title: `Recommendation: ${rec.type}`,
      body: `${rec.recommendation} (${(rec.confidence * 100).toFixed(0)}% confidence)`,
      priority: 'low',
      dedupKey: `adaptive_${rec.type}`,
    });
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const notificationManager = new NotificationManager();
