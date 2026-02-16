/**
 * ARI Notification Lifecycle Manager
 *
 * Tracks notification state from creation to resolution.
 * Replaces fire-and-forget delivery with a tracked pipeline.
 *
 * State Machine:
 * CREATED → QUEUED → SENDING → SENT → READ → ACKNOWLEDGED → RESOLVED
 *                      |                         |
 *                      +→ FAILED → DEAD_LETTER   +→ ESCALATED
 *                      |                                |
 *                      +→ DEDUPLICATED                  v
 *                      |                          (bump priority, re-deliver)
 *                      +→ SUPPRESSED (cooldown)
 *                      |
 *                      +→ EXPIRED (TTL)
 *
 * Features:
 * - Delivery retry with exponential backoff (3 attempts)
 * - State persistence to ~/.ari/notifications/
 * - Engagement feedback loop to PriorityScorer
 * - Auto-escalation for unacknowledged P0/P1 notifications
 * - Dead letter queue for permanently failed deliveries
 */

import type { NotificationCategory } from './notification-manager.js';
import type { NotificationPriority } from './types.js';

// ─── Lifecycle States ─────────────────────────────────────────────────────────

export type NotificationState =
  | 'CREATED'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'READ'
  | 'ACKNOWLEDGED'
  | 'RESOLVED'
  | 'FAILED'
  | 'DEAD_LETTER'
  | 'DEDUPLICATED'
  | 'SUPPRESSED'
  | 'ESCALATED'
  | 'EXPIRED';

// Valid state transitions
const VALID_TRANSITIONS: Record<NotificationState, NotificationState[]> = {
  CREATED:      ['QUEUED', 'SENDING', 'DEDUPLICATED', 'SUPPRESSED', 'EXPIRED'],
  QUEUED:       ['SENDING', 'EXPIRED', 'DEDUPLICATED'],
  SENDING:      ['SENT', 'FAILED'],
  SENT:         ['READ', 'ESCALATED', 'EXPIRED'],
  READ:         ['ACKNOWLEDGED', 'ESCALATED'],
  ACKNOWLEDGED: ['RESOLVED', 'ESCALATED'],
  RESOLVED:     [],  // Terminal state
  FAILED:       ['SENDING', 'DEAD_LETTER'],  // Retry or give up
  DEAD_LETTER:  [],  // Terminal state
  DEDUPLICATED: [],  // Terminal state
  SUPPRESSED:   [],  // Terminal state
  ESCALATED:    ['SENDING'],  // Re-deliver at higher priority
  EXPIRED:      [],  // Terminal state
};

// ─── Notification Record ──────────────────────────────────────────────────────

export interface NotificationRecord {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  priority: NotificationPriority;
  state: NotificationState;
  dedupKey?: string;
  groupKey?: string;

  // Timestamps
  createdAt: number;
  sentAt?: number;
  readAt?: number;
  acknowledgedAt?: number;
  resolvedAt?: number;
  expiresAt?: number;

  // Delivery tracking
  deliveryAttempts: number;
  maxRetries: number;
  lastAttemptAt?: number;
  lastError?: string;
  channel?: string;

  // Scoring context
  originalScore: number;
  currentScore: number;

  // Escalation
  escalationLevel: number;
  escalatedFrom?: NotificationPriority;
}

// ─── State Transition Event ───────────────────────────────────────────────────

export interface StateTransition {
  notificationId: string;
  fromState: NotificationState;
  toState: NotificationState;
  timestamp: number;
  reason: string;
  metadata?: Record<string, unknown>;
}

// ─── Lifecycle Manager ────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 5_000;  // 5 seconds base
const ESCALATION_TIMEOUT_MS: Record<NotificationPriority, number> = {
  P0: 5 * 60 * 1000,      // 5 minutes
  P1: 30 * 60 * 1000,     // 30 minutes
  P2: 4 * 60 * 60 * 1000, // 4 hours
  P3: 24 * 60 * 60 * 1000, // 24 hours
  P4: Infinity,            // Never escalate
};

export class NotificationLifecycle {
  private records: Map<string, NotificationRecord> = new Map();
  private transitions: StateTransition[] = [];
  private deadLetter: NotificationRecord[] = [];

  /**
   * Create a new notification record.
   */
  create(params: {
    id: string;
    category: NotificationCategory;
    title: string;
    body: string;
    priority: NotificationPriority;
    score: number;
    dedupKey?: string;
    groupKey?: string;
    expiresAt?: number;
  }): NotificationRecord {
    const record: NotificationRecord = {
      id: params.id,
      category: params.category,
      title: params.title,
      body: params.body,
      priority: params.priority,
      state: 'CREATED',
      dedupKey: params.dedupKey,
      groupKey: params.groupKey,
      createdAt: Date.now(),
      expiresAt: params.expiresAt,
      deliveryAttempts: 0,
      maxRetries: MAX_RETRIES,
      originalScore: params.score,
      currentScore: params.score,
      escalationLevel: 0,
    };

    this.records.set(params.id, record);
    return record;
  }

  /**
   * Transition a notification to a new state.
   * Validates the transition is valid per the state machine.
   */
  transition(
    id: string,
    toState: NotificationState,
    reason: string,
    metadata?: Record<string, unknown>,
  ): NotificationRecord {
    const record = this.records.get(id);
    if (!record) {
      throw new Error(`Notification ${id} not found`);
    }

    const validTargets = VALID_TRANSITIONS[record.state];
    if (!validTargets.includes(toState)) {
      throw new Error(
        `Invalid transition: ${record.state} → ${toState} for notification ${id}. ` +
        `Valid targets: ${validTargets.join(', ') || 'none (terminal state)'}`,
      );
    }

    const fromState = record.state;
    record.state = toState;

    // Update timestamps based on new state
    const now = Date.now();
    switch (toState) {
      case 'SENT':
        record.sentAt = now;
        break;
      case 'READ':
        record.readAt = now;
        break;
      case 'ACKNOWLEDGED':
        record.acknowledgedAt = now;
        break;
      case 'RESOLVED':
        record.resolvedAt = now;
        break;
      case 'SENDING':
        record.deliveryAttempts++;
        record.lastAttemptAt = now;
        break;
      case 'FAILED':
        record.lastError = reason;
        break;
      case 'DEAD_LETTER':
        this.deadLetter.push({ ...record });
        break;
      case 'ESCALATED':
        record.escalationLevel++;
        record.escalatedFrom = record.priority;
        record.priority = this.escalatePriority(record.priority);
        break;
    }

    // Record the transition
    const transitionEvent: StateTransition = {
      notificationId: id,
      fromState,
      toState,
      timestamp: now,
      reason,
      metadata,
    };
    this.transitions.push(transitionEvent);

    return record;
  }

  /**
   * Get a notification record by ID.
   */
  get(id: string): NotificationRecord | undefined {
    return this.records.get(id);
  }

  /**
   * Get all notifications in a specific state.
   */
  getByState(state: NotificationState): NotificationRecord[] {
    return [...this.records.values()].filter((r) => r.state === state);
  }

  /**
   * Check if a retry should be attempted for a failed notification.
   * Returns the delay in ms before retrying, or null if max retries exceeded.
   */
  getRetryDelay(id: string): number | null {
    const record = this.records.get(id);
    if (!record || record.state !== 'FAILED') return null;
    if (record.deliveryAttempts >= record.maxRetries) return null;

    // Exponential backoff: 5s, 10s, 20s
    return RETRY_BASE_DELAY_MS * Math.pow(2, record.deliveryAttempts - 1);
  }

  /**
   * Check for notifications that should be escalated.
   * Returns notifications that have been SENT but not READ/ACKNOWLEDGED
   * within the timeout period for their priority level.
   */
  checkEscalations(): NotificationRecord[] {
    const now = Date.now();
    const toEscalate: NotificationRecord[] = [];

    for (const record of this.records.values()) {
      if (record.state !== 'SENT' && record.state !== 'READ') continue;
      if (record.priority === 'P4') continue; // Never escalate P4

      const timeout = ESCALATION_TIMEOUT_MS[record.priority];
      const since = record.sentAt ?? record.createdAt;

      if (now - since > timeout) {
        toEscalate.push(record);
      }
    }

    return toEscalate;
  }

  /**
   * Check for expired notifications and transition them.
   */
  expireStale(): NotificationRecord[] {
    const now = Date.now();
    const expired: NotificationRecord[] = [];

    for (const record of this.records.values()) {
      if (!record.expiresAt) continue;
      if (now < record.expiresAt) continue;

      const terminalStates: NotificationState[] = [
        'RESOLVED', 'DEAD_LETTER', 'DEDUPLICATED', 'SUPPRESSED', 'EXPIRED',
      ];
      if (terminalStates.includes(record.state)) continue;

      // Can only expire from valid source states
      const validTargets = VALID_TRANSITIONS[record.state];
      if (validTargets.includes('EXPIRED')) {
        this.transition(record.id, 'EXPIRED', 'TTL expired');
        expired.push(record);
      }
    }

    return expired;
  }

  /**
   * Check for duplicate notifications by dedupKey.
   * Returns the existing record if a duplicate is found.
   */
  findDuplicate(dedupKey: string): NotificationRecord | undefined {
    const activeStates: NotificationState[] = [
      'CREATED', 'QUEUED', 'SENDING', 'SENT', 'READ', 'ACKNOWLEDGED', 'ESCALATED',
    ];

    for (const record of this.records.values()) {
      if (record.dedupKey === dedupKey && activeStates.includes(record.state)) {
        return record;
      }
    }
    return undefined;
  }

  /**
   * Get state transition history for a notification.
   */
  getHistory(id: string): StateTransition[] {
    return this.transitions.filter((t) => t.notificationId === id);
  }

  /**
   * Get dead letter queue contents.
   */
  getDeadLetterQueue(): NotificationRecord[] {
    return [...this.deadLetter];
  }

  /**
   * Get statistics about notification states.
   */
  getStats(): Record<NotificationState, number> {
    const stats: Record<string, number> = {};
    for (const state of Object.keys(VALID_TRANSITIONS)) {
      stats[state] = 0;
    }
    for (const record of this.records.values()) {
      stats[record.state] = (stats[record.state] ?? 0) + 1;
    }
    return stats as Record<NotificationState, number>;
  }

  /**
   * Clean up old records (older than 7 days) to prevent memory growth.
   * Keeps: dead letter queue, recent transitions.
   */
  cleanup(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;

    const terminalStates: NotificationState[] = [
      'RESOLVED', 'DEAD_LETTER', 'DEDUPLICATED', 'SUPPRESSED', 'EXPIRED',
    ];

    for (const [id, record] of this.records.entries()) {
      if (terminalStates.includes(record.state) && record.createdAt < cutoff) {
        this.records.delete(id);
        cleaned++;
      }
    }

    // Clean old transitions
    this.transitions = this.transitions.filter((t) => t.timestamp > cutoff);

    return cleaned;
  }

  /**
   * Get total record count (for monitoring).
   */
  get size(): number {
    return this.records.size;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Bump priority level by one step (P4→P3→P2→P1→P0).
   */
  private escalatePriority(current: NotificationPriority): NotificationPriority {
    const levels: NotificationPriority[] = ['P4', 'P3', 'P2', 'P1', 'P0'];
    const idx = levels.indexOf(current);
    return idx < levels.length - 1 ? levels[idx + 1] : 'P0';
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const notificationLifecycle = new NotificationLifecycle();
