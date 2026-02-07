import fs from 'node:fs/promises';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('approval-queue');

// ═══════════════════════════════════════════════════════════════════════════════
// FILE PATHS
// ═══════════════════════════════════════════════════════════════════════════════

const ARI_DIR = path.join(homedir(), '.ari');
const QUEUE_PATH = path.join(ARI_DIR, 'approval-queue.json');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type of item requiring approval.
 */
export type ApprovalItemType =
  | 'INITIATIVE'        // Autonomous initiative execution
  | 'CONFIG_CHANGE'     // Configuration modification
  | 'DESTRUCTIVE_OP'    // Destructive operation (delete, etc.)
  | 'HIGH_COST'         // Operation exceeding cost threshold
  | 'SECURITY_SENSITIVE'; // Touches security-related code

/**
 * Risk level for approval items.
 */
export type ApprovalRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * An item in the approval queue awaiting user decision.
 */
export interface ApprovalItem {
  id: string;
  type: ApprovalItemType;
  title: string;
  description: string;
  risk: ApprovalRisk;
  estimatedCost: number;
  estimatedTokens: number;
  createdAt: string;
  expiresAt: string;
  metadata?: Record<string, unknown>;

  // Context for decision
  affectedFiles?: string[];
  toolsRequired?: string[];
  reversible: boolean;
}

/**
 * Decision on an approval item.
 */
export interface ApprovalDecision {
  itemId: string;
  decision: 'APPROVED' | 'REJECTED' | 'EXPIRED';
  decidedAt: string;
  decidedBy?: string;
  note?: string;
  reason?: string;
}

/**
 * Internal queue data structure.
 */
interface QueueData {
  version: string;
  pending: ApprovalItem[];
  history: ApprovalDecision[];
  stats: {
    totalApproved: number;
    totalRejected: number;
    totalExpired: number;
    averageDecisionTimeMs: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVAL QUEUE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ApprovalQueue - Safety gate for high-risk autonomous operations.
 *
 * Features:
 * - Queue items for user approval before execution
 * - Automatic expiration of old items (24h default)
 * - History tracking for analytics
 * - Integration with notification system
 *
 * Usage:
 * 1. Initiative engine checks if operation requires approval
 * 2. If yes, adds to queue via add()
 * 3. User reviews via dashboard or CLI
 * 4. On approval, initiative executes
 * 5. On rejection, item is archived with reason
 */
export class ApprovalQueue {
  private eventBus: EventBus;
  private data: QueueData;
  private dirty: boolean = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly defaultExpirationMs: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.data = this.loadSync();
    this.startPeriodicPersist();
    this.cleanupExpired();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSISTENCE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Load queue data from disk synchronously.
   */
  private loadSync(): QueueData {
    // Ensure directory exists
    if (!existsSync(ARI_DIR)) {
      try {
        mkdirSync(ARI_DIR, { recursive: true });
      } catch {
        // Directory might be created by another process
      }
    }

    try {
      if (existsSync(QUEUE_PATH)) {
        const content = readFileSync(QUEUE_PATH, 'utf-8');
        return JSON.parse(content) as QueueData;
      }
    } catch (error) {
      log.warn({ err: error }, 'Failed to load queue');
    }

    // Return default empty queue
    return {
      version: '1.0.0',
      pending: [],
      history: [],
      stats: {
        totalApproved: 0,
        totalRejected: 0,
        totalExpired: 0,
        averageDecisionTimeMs: 0,
      },
    };
  }

  /**
   * Persist queue data to disk asynchronously.
   */
  private async persist(): Promise<void> {
    if (!this.dirty) return;

    try {
      await fs.mkdir(ARI_DIR, { recursive: true });

      // Atomic write
      const tempPath = `${QUEUE_PATH}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.data, null, 2));
      await fs.rename(tempPath, QUEUE_PATH);

      this.dirty = false;
    } catch (error) {
      log.error({ err: error }, 'Failed to persist queue');
    }
  }

  /**
   * Start periodic persistence timer.
   */
  private startPeriodicPersist(): void {
    this.persistTimer = setInterval(() => {
      void this.persist();
    }, 30000);

    if (this.persistTimer.unref) {
      this.persistTimer.unref();
    }
  }

  /**
   * Stop timer and flush pending changes.
   */
  async shutdown(): Promise<void> {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
    await this.persist();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUEUE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Add an item to the approval queue.
   *
   * @param item - Item to add (without createdAt/expiresAt)
   * @returns The full item with generated fields
   */
  async add(item: Omit<ApprovalItem, 'createdAt' | 'expiresAt'>): Promise<ApprovalItem> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.defaultExpirationMs);

    const fullItem: ApprovalItem = {
      ...item,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Check for duplicates
    const existing = this.data.pending.find(
      p => p.type === item.type &&
           p.title === item.title &&
           p.metadata?.initiativeId === item.metadata?.initiativeId
    );

    if (existing) {
      log.info({ title: item.title }, 'Duplicate item skipped');
      return existing;
    }

    this.data.pending.push(fullItem);
    this.dirty = true;

    // Emit event for notification system
    this.eventBus.emit('approval:item_added', {
      itemId: item.id,
      type: item.type,
      risk: item.risk,
      estimatedCost: item.estimatedCost,
    });

    // Log to audit
    this.eventBus.emit('audit:log', {
      action: 'approval_item_added',
      agent: 'autonomous',
      trustLevel: 'system',
      details: {
        itemId: item.id,
        type: item.type,
        title: item.title,
        risk: item.risk,
        estimatedCost: item.estimatedCost,
      },
    });

    // Immediate persist for critical items
    if (item.risk === 'CRITICAL' || item.risk === 'HIGH') {
      await this.persist();
    }

    return fullItem;
  }

  /**
   * Approve an item in the queue.
   *
   * @param itemId - ID of the item to approve
   * @param options - Optional note and approver
   */
  async approve(
    itemId: string,
    options: { note?: string; approvedBy?: string } = {}
  ): Promise<void> {
    const index = this.data.pending.findIndex(i => i.id === itemId);
    if (index === -1) {
      throw new Error(`Approval item not found: ${itemId}`);
    }

    const item = this.data.pending[index];
    this.data.pending.splice(index, 1);

    // Calculate decision time
    const createdAt = new Date(item.createdAt);
    const decisionTime = Date.now() - createdAt.getTime();

    // Add to history
    const decision: ApprovalDecision = {
      itemId,
      decision: 'APPROVED',
      decidedAt: new Date().toISOString(),
      decidedBy: options.approvedBy,
      note: options.note,
    };
    this.data.history.push(decision);

    // Update stats
    this.data.stats.totalApproved++;
    this.updateAverageDecisionTime(decisionTime);

    // Keep history bounded
    this.trimHistory();

    this.dirty = true;

    // Emit events
    this.eventBus.emit('approval:approved', {
      itemId,
      type: item.type,
      approvedBy: options.approvedBy,
    });

    this.eventBus.emit('audit:log', {
      action: 'approval_item_approved',
      agent: 'core',
      trustLevel: 'operator',
      details: {
        itemId,
        type: item.type,
        title: item.title,
        note: options.note,
        approvedBy: options.approvedBy,
        decisionTimeMs: decisionTime,
      },
    });

    await this.persist();
  }

  /**
   * Reject an item in the queue.
   *
   * @param itemId - ID of the item to reject
   * @param options - Reason (required) and rejector
   */
  async reject(
    itemId: string,
    options: { reason: string; rejectedBy?: string }
  ): Promise<void> {
    const index = this.data.pending.findIndex(i => i.id === itemId);
    if (index === -1) {
      throw new Error(`Approval item not found: ${itemId}`);
    }

    const item = this.data.pending[index];
    this.data.pending.splice(index, 1);

    // Calculate decision time
    const createdAt = new Date(item.createdAt);
    const decisionTime = Date.now() - createdAt.getTime();

    // Add to history
    const decision: ApprovalDecision = {
      itemId,
      decision: 'REJECTED',
      decidedAt: new Date().toISOString(),
      decidedBy: options.rejectedBy,
      reason: options.reason,
    };
    this.data.history.push(decision);

    // Update stats
    this.data.stats.totalRejected++;
    this.updateAverageDecisionTime(decisionTime);

    this.trimHistory();
    this.dirty = true;

    // Emit events
    this.eventBus.emit('approval:rejected', {
      itemId,
      type: item.type,
      reason: options.reason,
      rejectedBy: options.rejectedBy,
    });

    this.eventBus.emit('audit:log', {
      action: 'approval_item_rejected',
      agent: 'core',
      trustLevel: 'operator',
      details: {
        itemId,
        type: item.type,
        title: item.title,
        reason: options.reason,
        rejectedBy: options.rejectedBy,
        decisionTimeMs: decisionTime,
      },
    });

    await this.persist();
  }

  /**
   * Get a specific pending item by ID.
   */
  getItem(itemId: string): ApprovalItem | undefined {
    return this.data.pending.find(i => i.id === itemId);
  }

  /**
   * Get all pending items.
   */
  getPending(): ApprovalItem[] {
    // Clean up expired before returning
    this.cleanupExpired();
    return [...this.data.pending];
  }

  /**
   * Get all pending items of a specific type.
   */
  getPendingByType(type: ApprovalItemType): ApprovalItem[] {
    this.cleanupExpired();
    return this.data.pending.filter(i => i.type === type);
  }

  /**
   * Get recent history.
   *
   * @param limit - Maximum items to return
   */
  getHistory(limit: number = 50): ApprovalDecision[] {
    return this.data.history.slice(-limit).reverse();
  }

  /**
   * Get queue statistics.
   */
  getStats(): {
    pendingCount: number;
    pendingByRisk: Record<ApprovalRisk, number>;
    pendingByType: Record<string, number>;
    totalApproved: number;
    totalRejected: number;
    totalExpired: number;
    averageDecisionTimeMs: number;
    approvalRate: number;
  } {
    const pendingByRisk: Record<ApprovalRisk, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    const pendingByType: Record<string, number> = {};

    for (const item of this.data.pending) {
      pendingByRisk[item.risk]++;
      pendingByType[item.type] = (pendingByType[item.type] || 0) + 1;
    }

    const total = this.data.stats.totalApproved + this.data.stats.totalRejected;
    const approvalRate = total > 0
      ? this.data.stats.totalApproved / total
      : 0;

    return {
      pendingCount: this.data.pending.length,
      pendingByRisk,
      pendingByType,
      totalApproved: this.data.stats.totalApproved,
      totalRejected: this.data.stats.totalRejected,
      totalExpired: this.data.stats.totalExpired,
      averageDecisionTimeMs: this.data.stats.averageDecisionTimeMs,
      approvalRate,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if an operation requires approval based on profile thresholds.
   */
  requiresApproval(
    cost: number,
    risk: number,
    filesAffected: number,
    touchesSecurity: boolean,
    thresholds: {
      minCost: number;
      minRisk: number;
      minFilesAffected: number;
      touchesSecurity: boolean;
    }
  ): { required: boolean; reason?: string } {
    if (touchesSecurity && thresholds.touchesSecurity) {
      return { required: true, reason: 'Touches security-sensitive code' };
    }

    if (cost >= thresholds.minCost) {
      return { required: true, reason: `Cost ($${cost.toFixed(2)}) exceeds threshold ($${thresholds.minCost})` };
    }

    if (risk >= thresholds.minRisk) {
      return { required: true, reason: `Risk score (${risk}) exceeds threshold (${thresholds.minRisk})` };
    }

    if (filesAffected >= thresholds.minFilesAffected) {
      return { required: true, reason: `Files affected (${filesAffected}) exceeds threshold (${thresholds.minFilesAffected})` };
    }

    return { required: false };
  }

  /**
   * Clean up expired items.
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredItems: ApprovalItem[] = [];

    this.data.pending = this.data.pending.filter(item => {
      const expiresAt = new Date(item.expiresAt).getTime();
      if (now > expiresAt) {
        expiredItems.push(item);
        return false;
      }
      return true;
    });

    // Record expired items
    for (const item of expiredItems) {
      const decision: ApprovalDecision = {
        itemId: item.id,
        decision: 'EXPIRED',
        decidedAt: new Date().toISOString(),
      };
      this.data.history.push(decision);
      this.data.stats.totalExpired++;

      this.eventBus.emit('approval:expired', {
        itemId: item.id,
        type: item.type,
      });

      this.eventBus.emit('audit:log', {
        action: 'approval_item_expired',
        agent: 'autonomous',
        trustLevel: 'system',
        details: {
          itemId: item.id,
          type: item.type,
          title: item.title,
        },
      });
    }

    if (expiredItems.length > 0) {
      this.dirty = true;
      this.trimHistory();
    }
  }

  /**
   * Update rolling average decision time.
   */
  private updateAverageDecisionTime(newTime: number): void {
    const totalDecisions = this.data.stats.totalApproved + this.data.stats.totalRejected;
    const currentAvg = this.data.stats.averageDecisionTimeMs;

    // Weighted average
    this.data.stats.averageDecisionTimeMs = totalDecisions > 1
      ? (currentAvg * (totalDecisions - 1) + newTime) / totalDecisions
      : newTime;
  }

  /**
   * Trim history to prevent unbounded growth.
   */
  private trimHistory(): void {
    const maxHistory = 500;
    if (this.data.history.length > maxHistory) {
      this.data.history = this.data.history.slice(-maxHistory);
    }
  }
}
