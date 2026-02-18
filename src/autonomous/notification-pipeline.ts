/**
 * Notification Lifecycle — 7-Stage Unified Pipeline
 *
 * Implements a priority-scored notification pipeline:
 *   INGEST → ENRICH → SCORE → DEDUP → ROUTE → DELIVER → TRACK
 *
 * Priority formula:
 *   Score = (Urgency×0.30) + (Impact×0.25) + (TimeSensitivity×0.20)
 *         + (UserRelevance×0.15) + (ContextModifier×0.10)
 *
 * P-levels:
 *   P0 (≥0.80): Immediate all channels, bypasses quiet hours
 *   P1 (≥0.60): Telegram now, log to Notion
 *   P2 (≥0.40): Telegram (quiet-hours aware)
 *   P3 (≥0.20): Batched in morning digest
 *   P4 (<0.20): Log only, never push
 *
 * Target: 2-5 proactive messages/day
 */

import { createLogger } from '../kernel/logger.js';
import type { EventBus } from '../kernel/event-bus.js';
import { createHash } from 'node:crypto';

const log = createLogger('notification-lifecycle');

// ── Types ─────────────────────────────────────────────────────────────────────

export type PLevel = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export interface NotificationInput {
  /** Source system emitting the notification */
  source: string;
  /** Short title for display */
  title: string;
  /** Full message body */
  body: string;
  /** Raw urgency signal 0-1 */
  urgency?: number;
  /** Raw impact signal 0-1 */
  impact?: number;
  /** Is this time-sensitive? 0-1 */
  timeSensitivity?: number;
  /** How relevant to Pryce's current context 0-1 */
  userRelevance?: number;
  /** Context modifier: positive for working hours, negative for family time */
  contextModifier?: number;
  /** Override category for routing */
  category?: string;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

export interface ScoredNotification extends NotificationInput {
  id: string;
  score: number;
  pLevel: PLevel;
  scoreBreakdown: {
    urgency: number;
    impact: number;
    timeSensitivity: number;
    userRelevance: number;
    contextModifier: number;
  };
  dedupKey: string;
  ingestedAt: string;
}

export interface NotificationOutcome {
  id: string;
  pLevel: PLevel;
  score: number;
  delivered: boolean;
  channel?: 'telegram' | 'sms' | 'notion' | 'log';
  reason: string;
  processedAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WEIGHTS = {
  urgency: 0.30,
  impact: 0.25,
  timeSensitivity: 0.20,
  userRelevance: 0.15,
  contextModifier: 0.10,
} as const;

const P_THRESHOLDS: Record<PLevel, number> = {
  P0: 0.80,
  P1: 0.60,
  P2: 0.40,
  P3: 0.20,
  P4: 0.00,
};

// Quiet hours: 9 PM – 6:30 AM Indiana time (UTC-5)
const QUIET_HOURS_START = 21; // 9 PM
const QUIET_HOURS_END = 6;    // 6 AM (inclusive)

// Daily push limit
const MAX_DAILY_PUSHES = 5;
const MIN_DAILY_PUSHES = 2;

// Dedup window: 15 minutes
const DEDUP_WINDOW_MS = 15 * 60 * 1000;

// ── Class ─────────────────────────────────────────────────────────────────────

export class NotificationPipeline {
  private readonly eventBus: EventBus;
  private readonly notifyFn: ((title: string, body: string, priority: string) => void) | null;

  /** Recent notifications for dedup (dedupKey → timestamp) */
  private readonly recentKeys: Map<string, number> = new Map();

  /** Track how many pushes have been sent today */
  private dailyPushCount = 0;
  private lastPushReset = new Date().toDateString();

  /** Batched P3/P4 for morning digest */
  private readonly morningBatch: ScoredNotification[] = [];

  constructor(eventBus: EventBus, notifyFn?: (title: string, body: string, priority: string) => void) {
    this.eventBus = eventBus;
    this.notifyFn = notifyFn ?? null;
    this.startCleanupTimer();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Process a notification through the full 7-stage pipeline.
   * Returns the outcome (delivered, deduped, batched, etc.)
   */
  process(input: NotificationInput): NotificationOutcome {
    // Stage 1: INGEST — assign ID and timestamp
    const id = createHash('sha256')
      .update(`${input.source}:${input.title}:${Date.now()}`)
      .digest('hex')
      .slice(0, 16);

    // Stage 2: ENRICH — apply defaults and context
    const enriched = this.enrich(input);

    // Stage 3: SCORE — compute priority
    const scored = this.score(id, enriched);

    // Stage 4: DEDUP — skip if seen recently
    if (this.isDuplicate(scored)) {
      log.debug({ id, dedupKey: scored.dedupKey }, 'Notification deduped');
      return {
        id,
        pLevel: scored.pLevel,
        score: scored.score,
        delivered: false,
        reason: 'deduped — same key within 15 min',
        processedAt: new Date().toISOString(),
      };
    }
    this.markSeen(scored);

    // Stage 5: ROUTE — determine channel based on P-level + quiet hours
    const channel = this.route(scored);

    // Stage 6: DELIVER — emit to appropriate channel
    const outcome = this.deliver(scored, channel);

    // Stage 7: TRACK — emit audit event
    this.track(scored, outcome);

    return outcome;
  }

  /**
   * Get all batched P3/P4 notifications for morning digest.
   * Clears the batch after returning.
   */
  flushMorningBatch(): ScoredNotification[] {
    const batch = [...this.morningBatch];
    this.morningBatch.length = 0;
    return batch;
  }

  getDailyStats(): { pushed: number; batched: number; max: number; min: number } {
    return {
      pushed: this.dailyPushCount,
      batched: this.morningBatch.length,
      max: MAX_DAILY_PUSHES,
      min: MIN_DAILY_PUSHES,
    };
  }

  // ── Stages ──────────────────────────────────────────────────────────────────

  /** Stage 2: Apply defaults and context signals */
  private enrich(input: NotificationInput): Required<NotificationInput> {
    const now = new Date();
    const hour = now.getHours();

    // During family time (4-9 PM), reduce context modifier significantly
    const isFamilyTime = hour >= 16 && hour < 21;
    // During work time (9 AM-4 PM), slightly boost
    const isWorkTime = hour >= 9 && hour < 16;

    const defaultContextModifier = isFamilyTime ? -0.3 : isWorkTime ? 0.1 : 0;

    return {
      source: input.source,
      title: input.title,
      body: input.body,
      urgency: input.urgency ?? 0.3,
      impact: input.impact ?? 0.3,
      timeSensitivity: input.timeSensitivity ?? 0.3,
      userRelevance: input.userRelevance ?? 0.5,
      contextModifier: input.contextModifier ?? defaultContextModifier,
      category: input.category ?? 'general',
      metadata: input.metadata ?? {},
    };
  }

  /** Stage 3: Compute weighted priority score and P-level */
  private score(id: string, input: Required<NotificationInput>): ScoredNotification {
    const u = Math.max(0, Math.min(1, input.urgency));
    const i = Math.max(0, Math.min(1, input.impact));
    const t = Math.max(0, Math.min(1, input.timeSensitivity));
    const r = Math.max(0, Math.min(1, input.userRelevance));
    const c = Math.max(-1, Math.min(1, input.contextModifier));

    // Context modifier is centered at 0, can be negative
    const cNormalized = (c + 1) / 2; // convert -1..1 to 0..1

    const score =
      u * WEIGHTS.urgency +
      i * WEIGHTS.impact +
      t * WEIGHTS.timeSensitivity +
      r * WEIGHTS.userRelevance +
      cNormalized * WEIGHTS.contextModifier;

    const pLevel = this.toPLevel(score);

    const dedupKey = createHash('md5')
      .update(`${input.source}:${input.title.slice(0, 50)}`)
      .digest('hex')
      .slice(0, 12);

    return {
      ...input,
      id,
      score,
      pLevel,
      scoreBreakdown: { urgency: u, impact: i, timeSensitivity: t, userRelevance: r, contextModifier: c },
      dedupKey,
      ingestedAt: new Date().toISOString(),
    };
  }

  /** Stage 4: Dedup check */
  private isDuplicate(notification: ScoredNotification): boolean {
    const last = this.recentKeys.get(notification.dedupKey);
    if (!last) return false;
    return Date.now() - last < DEDUP_WINDOW_MS;
  }

  private markSeen(notification: ScoredNotification): void {
    this.recentKeys.set(notification.dedupKey, Date.now());
  }

  /** Stage 5: Route — which channel based on P-level and context */
  private route(notification: ScoredNotification): 'telegram' | 'sms' | 'notion' | 'batch' | 'log' {
    this.resetDailyCountIfNeeded();

    const { pLevel } = notification;

    if (pLevel === 'P0') return 'sms'; // P0: SMS (critical, bypasses everything)
    if (pLevel === 'P4') return 'log'; // P4: log only

    if (this.isQuietHours()) {
      if (pLevel === 'P1') return 'batch'; // P1 quiet → batch for morning
      return 'log'; // P2/P3 quiet → log only
    }

    if (this.dailyPushCount >= MAX_DAILY_PUSHES) {
      return 'batch'; // Daily cap reached → batch
    }

    if (pLevel === 'P1' || pLevel === 'P2') return 'telegram';
    return 'batch'; // P3 → morning batch
  }

  /** Stage 6: Deliver — emit the notification */
  private deliver(
    notification: ScoredNotification,
    channel: 'telegram' | 'sms' | 'notion' | 'batch' | 'log',
  ): NotificationOutcome {
    const base = {
      id: notification.id,
      pLevel: notification.pLevel,
      score: notification.score,
      processedAt: new Date().toISOString(),
    };

    switch (channel) {
      case 'sms':
        if (this.notifyFn) {
          this.notifyFn(notification.title, notification.body, 'critical');
        } else {
          log.warn({ id: notification.id }, 'P0 notification — no notifyFn configured');
        }
        this.dailyPushCount++;
        return { ...base, delivered: true, channel: 'sms', reason: 'P0 critical — SMS + Telegram' };

      case 'telegram':
        if (this.notifyFn) {
          this.notifyFn(notification.title, notification.body, notification.pLevel === 'P1' ? 'high' : 'normal');
        } else {
          log.warn({ id: notification.id }, `${notification.pLevel} notification — no notifyFn configured`);
        }
        this.dailyPushCount++;
        return { ...base, delivered: true, channel: 'telegram', reason: `${notification.pLevel} — Telegram push (${this.dailyPushCount}/${MAX_DAILY_PUSHES})` };

      case 'batch':
        this.morningBatch.push(notification);
        log.debug({ id: notification.id, pLevel: notification.pLevel }, 'Notification batched for morning digest');
        return { ...base, delivered: false, reason: 'batched for morning digest' };

      case 'log':
      default:
        log.info({ id: notification.id, pLevel: notification.pLevel, title: notification.title, score: notification.score.toFixed(3) }, 'Notification logged (P4 or quiet hours)');
        return { ...base, delivered: false, reason: 'P4 log-only or quiet hours suppression' };
    }
  }

  /** Stage 7: Track — audit and metrics */
  private track(notification: ScoredNotification, outcome: NotificationOutcome): void {
    this.eventBus.emit('audit:log', {
      action: 'notification:processed',
      agent: 'NOTIFICATION_LIFECYCLE',
      trustLevel: 'system' as const,
      details: {
        id: notification.id,
        source: notification.source,
        pLevel: outcome.pLevel,
        score: notification.score,
        delivered: outcome.delivered,
        channel: outcome.channel,
        reason: outcome.reason,
      },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private toPLevel(score: number): PLevel {
    if (score >= P_THRESHOLDS.P0) return 'P0';
    if (score >= P_THRESHOLDS.P1) return 'P1';
    if (score >= P_THRESHOLDS.P2) return 'P2';
    if (score >= P_THRESHOLDS.P3) return 'P3';
    return 'P4';
  }

  private isQuietHours(): boolean {
    // Indiana time (UTC-5, no DST)
    const utcHour = new Date().getUTCHours();
    const indianaHour = (utcHour - 5 + 24) % 24;
    return indianaHour >= QUIET_HOURS_START || indianaHour < QUIET_HOURS_END;
  }

  private resetDailyCountIfNeeded(): void {
    const today = new Date().toDateString();
    if (today !== this.lastPushReset) {
      this.dailyPushCount = 0;
      this.lastPushReset = today;
    }
  }

  private startCleanupTimer(): void {
    // Clean dedup keys every 30 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamp] of this.recentKeys.entries()) {
        if (now - timestamp > DEDUP_WINDOW_MS * 2) {
          this.recentKeys.delete(key);
        }
      }
    }, 30 * 60 * 1000).unref();
  }
}
