/**
 * X API Cost Tracker
 *
 * Tracks per-endpoint costs under the pay-per-use model:
 * - Real-time cost accumulation
 * - Daily usage persistence
 * - Budget alerts via EventBus
 * - Historical reporting
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createLogger } from '../../kernel/logger.js';
import type { EventBus } from '../../kernel/event-bus.js';
import type { XCostEntry, XDailyUsage, XCreditConfig } from './x-types.js';

const log = createLogger('x-cost-tracker');

export class XCostTracker {
  private usage: XDailyUsage;
  private config: XCreditConfig;
  private eventBus: EventBus;
  private usagePath: string;
  private alertedWarning = false;
  private alertedCritical = false;
  private readonly persistEnabled: boolean;

  constructor(eventBus: EventBus, config: XCreditConfig, storagePath?: string | null) {
    this.eventBus = eventBus;
    this.config = config;
    this.persistEnabled = storagePath !== null;

    const today = this.getUTCDate();
    this.usagePath = storagePath ?? this.getUsagePath(today);
    this.usage = this.createEmptyUsage(today);
  }

  private getUTCDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getUsagePath(date: string): string {
    return join(homedir(), '.ari', 'data', 'x-api', `usage-${date}.json`);
  }

  private createEmptyUsage(date: string): XDailyUsage {
    return {
      date,
      totalCost: 0,
      totalRequests: 0,
      totalItemsRead: 0,
      totalItemsWritten: 0,
      totalDeduplicated: 0,
      byOperation: {} as XDailyUsage['byOperation'],
      entries: [],
    };
  }

  /**
   * Load usage from disk
   */
  async load(): Promise<void> {
    if (!this.persistEnabled) return;

    this.checkDateRollover();

    try {
      const data = await readFile(this.usagePath, 'utf-8');
      const stored = JSON.parse(data) as XDailyUsage;

      if (stored.date === this.usage.date) {
        this.usage = stored;
        // Reconstruct Date objects
        this.usage.entries = stored.entries.map(e => ({
          ...e,
          timestamp: new Date(e.timestamp),
        }));
        log.debug({ totalCost: this.usage.totalCost }, 'Loaded X API usage');
      }
    } catch {
      // No stored usage - start fresh
    }
  }

  /**
   * Track an API operation
   */
  async track(entry: XCostEntry): Promise<void> {
    this.checkDateRollover();

    // Add to entries
    this.usage.entries.push(entry);

    // Update totals
    this.usage.totalCost += entry.cost;
    this.usage.totalRequests += entry.requestCount;
    this.usage.totalItemsRead += entry.itemsRead;
    this.usage.totalItemsWritten += entry.itemsWritten;
    this.usage.totalDeduplicated += entry.deduplicated;

    // Update by-operation breakdown
    if (!this.usage.byOperation[entry.operation]) {
      this.usage.byOperation[entry.operation] = {
        requests: 0,
        items: 0,
        cost: 0,
        deduplicated: 0,
      };
    }
    const opStats = this.usage.byOperation[entry.operation];
    opStats.requests += entry.requestCount;
    opStats.items += entry.itemsRead + entry.itemsWritten;
    opStats.cost += entry.cost;
    opStats.deduplicated += entry.deduplicated;

    await this.save();

    // Emit cost tracked event
    this.eventBus.emit('x:cost_tracked', {
      operation: entry.operation,
      endpoint: entry.endpoint,
      cost: entry.cost,
      itemCount: entry.itemsRead + entry.itemsWritten,
      deduplicated: entry.deduplicated,
      timestamp: new Date().toISOString(),
    });

    // Check for budget alerts
    this.checkAlerts();

    log.debug({
      operation: entry.operation,
      cost: entry.cost,
      totalToday: this.usage.totalCost,
    }, 'Tracked X API cost');
  }

  /**
   * Save usage to disk
   */
  async save(): Promise<void> {
    if (!this.persistEnabled) return;

    try {
      await mkdir(join(homedir(), '.ari', 'data', 'x-api'), { recursive: true });
      await writeFile(this.usagePath, JSON.stringify(this.usage, null, 2));
    } catch (error) {
      log.error({ error }, 'Failed to save X API usage');
    }
  }

  /**
   * Check and emit budget alerts
   */
  private checkAlerts(): void {
    const percentUsed = this.usage.totalCost / this.config.dailySpendingLimit;

    // Critical alert (90%+)
    if (percentUsed >= this.config.alerts.critical && !this.alertedCritical) {
      this.alertedCritical = true;
      this.eventBus.emit('x:limit_approaching', {
        percentUsed: percentUsed * 100,
        spent: this.usage.totalCost,
        limit: this.config.dailySpendingLimit,
        level: 'critical',
        timestamp: new Date().toISOString(),
      });
      log.warn({ percentUsed: percentUsed * 100 }, 'X API budget CRITICAL');
    }
    // Warning alert (75%+)
    else if (percentUsed >= this.config.alerts.warning && !this.alertedWarning) {
      this.alertedWarning = true;
      this.eventBus.emit('x:limit_approaching', {
        percentUsed: percentUsed * 100,
        spent: this.usage.totalCost,
        limit: this.config.dailySpendingLimit,
        level: 'warning',
        timestamp: new Date().toISOString(),
      });
      log.info({ percentUsed: percentUsed * 100 }, 'X API budget warning');
    }
  }

  /**
   * Check for UTC day rollover
   */
  private checkDateRollover(): void {
    const today = this.getUTCDate();
    if (today !== this.usage.date) {
      // Emit daily reset event
      this.eventBus.emit('x:daily_reset', {
        previousDate: this.usage.date,
        previousSpent: this.usage.totalCost,
        newDate: today,
        timestamp: new Date().toISOString(),
      });

      log.info({
        previousDate: this.usage.date,
        previousSpent: this.usage.totalCost,
      }, 'X API daily usage reset');

      // Reset for new day
      this.usage = this.createEmptyUsage(today);
      this.usagePath = this.getUsagePath(today);
      this.alertedWarning = false;
      this.alertedCritical = false;
    }
  }

  /**
   * Get current usage
   */
  getUsage(): XDailyUsage {
    this.checkDateRollover();
    return { ...this.usage };
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): number {
    this.checkDateRollover();
    return Math.max(0, this.config.dailySpendingLimit - this.usage.totalCost);
  }

  /**
   * Get percent of budget used
   */
  getPercentUsed(): number {
    this.checkDateRollover();
    return (this.usage.totalCost / this.config.dailySpendingLimit) * 100;
  }

  /**
   * Estimate xAI credits earned
   */
  getXaiCreditsEarned(): number {
    if (!this.config.xaiCreditBonus.enabled) return 0;
    return this.usage.totalCost * this.config.xaiCreditBonus.estimatedRate;
  }

  /**
   * Can we afford an operation?
   */
  canAfford(estimatedCost: number): boolean {
    return this.getRemainingBudget() >= estimatedCost;
  }

  /**
   * Get historical usage for date range
   */
  async getHistoricalUsage(days: number): Promise<XDailyUsage[]> {
    const results: XDailyUsage[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const path = this.getUsagePath(dateStr);

      try {
        const data = await readFile(path, 'utf-8');
        results.push(JSON.parse(data) as XDailyUsage);
      } catch {
        // No data for this day
      }
    }

    return results;
  }
}
