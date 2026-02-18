/**
 * LaneQueue — Durable workflow queue with 4 priority lanes.
 *
 * Each lane has an independent concurrency limit:
 *   - user (1)       — user-initiated tasks, highest priority
 *   - scheduled (1)  — cron/scheduler tasks
 *   - initiative (2) — proactive agent work
 *   - background (3) — background processing
 *
 * Persists pending items to ~/.ari/queue/pending.jsonl (JSONL format).
 * Survives restarts via rehydrate().
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('lane-queue');

// ── Types ────────────────────────────────────────────────────────────────────

export type Lane = 'user' | 'scheduled' | 'initiative' | 'background';
export type QueueItemStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface QueueItem {
  id: string;
  lane: Lane;
  priority: number;
  payload: unknown;
  createdAt: string;
  status: QueueItemStatus;
  retries: number;
  maxRetries: number;
  error?: string;
}

export interface LaneStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export type QueueStats = Record<Lane, LaneStats>;

// ── Constants ────────────────────────────────────────────────────────────────

const QUEUE_DIR = path.join(process.env.HOME || '~', '.ari', 'queue');
const PENDING_FILE = path.join(QUEUE_DIR, 'pending.jsonl');

const LANE_CONCURRENCY: Record<Lane, number> = {
  user: 1,
  scheduled: 1,
  initiative: 2,
  background: 3,
};

const ALL_LANES: Lane[] = ['user', 'scheduled', 'initiative', 'background'];

// ── LaneQueue ────────────────────────────────────────────────────────────────

export class LaneQueue {
  private items: Map<string, QueueItem> = new Map();
  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Enqueue a new item into a specific lane.
   * Higher priority number = higher priority.
   */
  enqueue(lane: Lane, payload: unknown, priority: number = 0): QueueItem {
    const item: QueueItem = {
      id: randomUUID(),
      lane,
      priority,
      payload,
      createdAt: new Date().toISOString(),
      status: 'pending',
      retries: 0,
      maxRetries: 3,
    };

    this.items.set(item.id, item);
    this.persist(item);

    log.info({ id: item.id, lane, priority }, 'item enqueued');
    this.eventBus.emit('queue:enqueued', {
      id: item.id,
      lane,
      priority,
      timestamp: item.createdAt,
    });

    return item;
  }

  /**
   * Dequeue the next pending item from a lane.
   * Returns null if no pending items or concurrency limit reached.
   */
  dequeue(lane: Lane): QueueItem | null {
    const running = this.countByLaneAndStatus(lane, 'running');
    const limit = LANE_CONCURRENCY[lane];

    if (running >= limit) {
      return null;
    }

    const pending = Array.from(this.items.values())
      .filter((item) => item.lane === lane && item.status === 'pending')
      .sort((a, b) => {
        // Higher priority first
        if (b.priority !== a.priority) return b.priority - a.priority;
        // Then oldest first (FIFO within same priority)
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    const next = pending[0];
    if (!next) return null;

    next.status = 'running';
    this.items.set(next.id, next);
    return next;
  }

  /**
   * Mark an item as completed.
   */
  markComplete(id: string): void {
    const item = this.items.get(id);
    if (!item) {
      log.warn({ id }, 'markComplete called on unknown item');
      return;
    }

    const startedAt = new Date(item.createdAt).getTime();
    const durationMs = Date.now() - startedAt;

    item.status = 'completed';
    this.items.set(id, item);

    log.info({ id, lane: item.lane, durationMs }, 'item completed');
    this.eventBus.emit('queue:completed', {
      id,
      lane: item.lane,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Mark an item as failed.
   */
  markFailed(id: string, error: string): void {
    const item = this.items.get(id);
    if (!item) {
      log.warn({ id }, 'markFailed called on unknown item');
      return;
    }

    item.retries += 1;
    item.error = error;

    if (item.retries < item.maxRetries) {
      // Re-queue for retry
      item.status = 'pending';
      log.info({ id, retries: item.retries, maxRetries: item.maxRetries }, 'item re-queued for retry');
    } else {
      item.status = 'failed';
      log.warn({ id, error, retries: item.retries }, 'item failed permanently');
    }

    this.items.set(id, item);
    this.eventBus.emit('queue:failed', {
      id,
      lane: item.lane,
      error,
      retries: item.retries,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get statistics for all lanes.
   */
  getStats(): QueueStats {
    const stats: QueueStats = {} as QueueStats;

    for (const lane of ALL_LANES) {
      stats[lane] = {
        pending: this.countByLaneAndStatus(lane, 'pending'),
        running: this.countByLaneAndStatus(lane, 'running'),
        completed: this.countByLaneAndStatus(lane, 'completed'),
        failed: this.countByLaneAndStatus(lane, 'failed'),
      };
    }

    return stats;
  }

  /**
   * Rehydrate queue from disk on startup.
   * Running items are reset to pending (they crashed mid-execution).
   */
  rehydrate(): void {
    try {
      if (!fs.existsSync(PENDING_FILE)) {
        log.info('no pending.jsonl found, starting fresh');
        return;
      }

      const content = fs.readFileSync(PENDING_FILE, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim().length > 0);

      let loaded = 0;
      for (const line of lines) {
        try {
          const item = JSON.parse(line) as QueueItem;
          // Reset running items to pending (crashed mid-execution)
          if (item.status === 'running') {
            item.status = 'pending';
          }
          // Only load actionable items
          if (item.status === 'pending') {
            this.items.set(item.id, item);
            loaded++;
          }
        } catch {
          log.warn('skipping malformed JSONL line');
        }
      }

      log.info({ loaded }, 'rehydrated queue from disk');
    } catch (err) {
      log.error({ err }, 'failed to rehydrate queue');
    }
  }

  /**
   * Get an item by ID.
   */
  get(id: string): QueueItem | undefined {
    return this.items.get(id);
  }

  /**
   * Get the concurrency limit for a lane.
   */
  getConcurrencyLimit(lane: Lane): number {
    return LANE_CONCURRENCY[lane];
  }

  /**
   * Get the count of items in a specific lane and status.
   */
  private countByLaneAndStatus(lane: Lane, status: QueueItemStatus): number {
    let count = 0;
    for (const item of this.items.values()) {
      if (item.lane === lane && item.status === status) {
        count++;
      }
    }
    return count;
  }

  /**
   * Persist a queue item to the JSONL file.
   */
  private persist(item: QueueItem): void {
    try {
      fs.mkdirSync(QUEUE_DIR, { recursive: true });
      fs.appendFileSync(PENDING_FILE, JSON.stringify(item) + '\n', 'utf-8');
    } catch (err) {
      log.error({ err, id: item.id }, 'failed to persist queue item');
    }
  }
}
