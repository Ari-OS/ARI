import fs from 'node:fs/promises';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('billing-cycle');

// ═══════════════════════════════════════════════════════════════════════════
// FILE PATHS FOR PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

const ARI_DIR = path.join(homedir(), '.ari');
const BILLING_CYCLE_PATH = path.join(ARI_DIR, 'billing-cycle.json');

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Billing cycle status.
 */
export type BillingStatus = 'under_budget' | 'on_track' | 'at_risk' | 'over_budget';

/**
 * Daily spending record within a billing cycle.
 */
export interface DailySpending {
  date: string;
  tokens: number;
  cost: number;
  tasks: number;
  initiatives: number;
  valueScore: number;
}

/**
 * Historical billing cycle summary.
 */
export interface PreviousCycle {
  startDate: string;
  endDate: string;
  totalBudget: number;
  actualSpent: number;
  averageValueScore: number;
  peakDays: string[];
  wastedDays: string[];
}

/**
 * Complete billing cycle data structure.
 */
export interface BillingCycleData {
  version: string;
  cycleStartDate: string;
  cycleEndDate: string;
  totalBudget: number;
  daysInCycle: number;
  totalSpent: number;
  daysElapsed: number;
  dailySpending: DailySpending[];
  recommendedDailyBudget: number;
  spendingVelocity: number;
  projectedCycleEnd: number;
  onTrack: boolean;
  previousCycles: PreviousCycle[];
}

/**
 * Budget recommendation with reasoning.
 */
export interface BudgetRecommendation {
  recommended: number;
  reason: string;
  confidence: number;
  adjustments: string[];
}

/**
 * Cycle status summary.
 */
export interface CycleStatus {
  daysElapsed: number;
  daysRemaining: number;
  percentComplete: number;
  totalSpent: number;
  remaining: number;
  dailyAverage: number;
  projectedTotal: number;
  onTrack: boolean;
  status: BillingStatus;
  recommendation: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// BILLING CYCLE MANAGER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Manages bi-weekly billing cycles with intelligent pacing.
 *
 * Default cycle: $75 over 14 days = ~$5.36/day average
 *
 * Features:
 * - Adaptive daily budget recommendations
 * - Historical learning from previous cycles
 * - Day-of-week pattern recognition
 * - Velocity-based projections
 * - Value score optimization
 */
export class BillingCycleManager {
  private eventBus: EventBus;
  private cycle: BillingCycleData;

  // Processing queue to prevent race conditions
  private processingQueue: Promise<void> = Promise.resolve();
  private isProcessing: boolean = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.cycle = this.loadSync();

    // Listen for cost events (queued to prevent race conditions)
    this.eventBus.on('cost:tracked', (event) => {
      this.queueOperation(() => this.recordSpending(event));
    });

    // Check for cycle end daily
    this.eventBus.on('scheduler:daily_reset', () => {
      this.queueOperation(() => this.checkCycleEnd());
    });
  }

  /**
   * Queue an operation to prevent race conditions.
   * Operations are processed sequentially.
   */
  private queueOperation(operation: () => Promise<void>): void {
    this.processingQueue = this.processingQueue
      .then(async () => {
        this.isProcessing = true;
        try {
          await operation();
        } finally {
          this.isProcessing = false;
        }
      })
      .catch((error) => {
        log.error({ err: error }, 'Operation failed');
      });
  }

  /**
   * Load billing cycle data from disk.
   */
  private loadSync(): BillingCycleData {
    try {
      if (existsSync(BILLING_CYCLE_PATH)) {
        const data = readFileSync(BILLING_CYCLE_PATH, 'utf-8');
        const stored = JSON.parse(data) as BillingCycleData;

        // Check if cycle has ended
        const today = new Date().toISOString().split('T')[0];
        if (today > stored.cycleEndDate) {
          // Cycle ended, start new one
          return this.initializeNewCycle(stored.previousCycles);
        }

        return stored;
      }
    } catch {
      // Error loading - initialize new cycle
    }

    return this.initializeNewCycle([]);
  }

  /**
   * Initialize a new billing cycle.
   */
  private initializeNewCycle(previousCycles: PreviousCycle[]): BillingCycleData {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 14);

    return {
      version: '1.0.0',
      cycleStartDate: now.toISOString().split('T')[0],
      cycleEndDate: endDate.toISOString().split('T')[0],
      totalBudget: 75.00,
      daysInCycle: 14,
      totalSpent: 0,
      daysElapsed: 0,
      dailySpending: [],
      recommendedDailyBudget: 75 / 14, // $5.36
      spendingVelocity: 0,
      projectedCycleEnd: 0,
      onTrack: true,
      previousCycles,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ADAPTIVE BUDGET RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get recommended daily budget based on intelligent analysis.
   */
  getRecommendedDailyBudget(): BudgetRecommendation {
    const remaining = this.cycle.totalBudget - this.cycle.totalSpent;
    const daysRemaining = this.cycle.daysInCycle - this.cycle.daysElapsed;

    if (daysRemaining <= 0) {
      return {
        recommended: 0,
        reason: 'Billing cycle complete - starting new cycle',
        confidence: 1.0,
        adjustments: ['Start new billing cycle'],
      };
    }

    const baseBudget = remaining / daysRemaining;
    const adjustments: string[] = [];
    let recommended = baseBudget;
    let confidence = 0.8;

    // Adjustment 1: Historical learning from previous cycles
    if (this.cycle.previousCycles.length > 0) {
      const avgPrevSpend = this.cycle.previousCycles.reduce(
        (sum, c) => sum + c.actualSpent / 14, 0
      ) / this.cycle.previousCycles.length;

      if (avgPrevSpend < baseBudget * 0.8) {
        // User historically spends less - recommend lower
        recommended = Math.min(recommended, avgPrevSpend * 1.1);
        adjustments.push(`Historical avg spend: $${avgPrevSpend.toFixed(2)}/day`);
        confidence += 0.1;
      }
    }

    // Adjustment 2: Day-of-week patterns
    const dayOfWeek = new Date().getDay();
    const weekendDays = this.cycle.dailySpending.filter(d => {
      const date = new Date(d.date);
      return date.getDay() === 0 || date.getDay() === 6;
    });

    if (weekendDays.length > 0) {
      const avgWeekendSpend = weekendDays.reduce((s, d) => s + d.cost, 0) / weekendDays.length;
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        if (avgWeekendSpend < baseBudget * 0.5) {
          // Weekends typically have lower activity
          recommended = Math.min(recommended, avgWeekendSpend * 1.2);
          adjustments.push('Weekend: typically lower activity');
        }
      }
    }

    // Adjustment 3: Velocity-based projection
    if (this.cycle.spendingVelocity > 0) {
      const projectedEnd = this.cycle.totalSpent + (this.cycle.spendingVelocity * daysRemaining);

      if (projectedEnd > this.cycle.totalBudget * 1.1) {
        // On track to overspend
        const reduceBy = (projectedEnd - this.cycle.totalBudget) / daysRemaining;
        recommended = Math.max(recommended - reduceBy, 1.0); // Min $1/day
        adjustments.push(`Reducing to stay under $${this.cycle.totalBudget} budget`);
      } else if (projectedEnd < this.cycle.totalBudget * 0.7) {
        // Under-utilizing budget
        const increaseBy = (this.cycle.totalBudget * 0.9 - projectedEnd) / daysRemaining;
        recommended = recommended + (increaseBy * 0.5); // Conservative increase
        adjustments.push('Budget available for more autonomous work');
      }
    }

    // Adjustment 4: Value score optimization
    const recentHighValue = this.cycle.dailySpending
      .slice(-7)
      .filter(d => d.valueScore >= 70);

    if (recentHighValue.length >= 5) {
      // Recent days have been high-value - allow slight increase
      recommended *= 1.05;
      adjustments.push('Recent days showing high value - slight increase');
      confidence += 0.05;
    }

    return {
      recommended: Math.max(1.0, Math.min(recommended, remaining)),
      reason: adjustments.length > 0
        ? adjustments.join('; ')
        : 'Standard daily allocation',
      confidence: Math.min(1.0, confidence),
      adjustments,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CYCLE STATUS AND PROJECTIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get comprehensive cycle status.
   */
  getCycleStatus(): CycleStatus {
    const daysRemaining = Math.max(0, this.cycle.daysInCycle - this.cycle.daysElapsed);
    const percentComplete = (this.cycle.daysElapsed / this.cycle.daysInCycle) * 100;
    const remaining = this.cycle.totalBudget - this.cycle.totalSpent;
    const dailyAverage = this.cycle.daysElapsed > 0
      ? this.cycle.totalSpent / this.cycle.daysElapsed
      : 0;
    const projectedTotal = this.cycle.totalSpent + (dailyAverage * daysRemaining);

    let status: BillingStatus;
    let recommendation: string;

    const ratio = projectedTotal / this.cycle.totalBudget;

    if (this.cycle.totalSpent > this.cycle.totalBudget) {
      status = 'over_budget';
      recommendation = `Over budget by $${(this.cycle.totalSpent - this.cycle.totalBudget).toFixed(2)}. Switch to conservative profile immediately.`;
    } else if (ratio > 1.1) {
      status = 'at_risk';
      recommendation = `Projected to exceed by $${(projectedTotal - this.cycle.totalBudget).toFixed(2)}. Reduce daily spending to $${(remaining / daysRemaining).toFixed(2)}.`;
    } else if (ratio < 0.8) {
      status = 'under_budget';
      recommendation = `Under-utilizing budget. Consider switching to balanced profile or increasing autonomous work.`;
    } else {
      status = 'on_track';
      recommendation = `On track. Maintain current spending velocity.`;
    }

    return {
      daysElapsed: this.cycle.daysElapsed,
      daysRemaining,
      percentComplete,
      totalSpent: this.cycle.totalSpent,
      remaining,
      dailyAverage,
      projectedTotal,
      onTrack: status === 'on_track' || status === 'under_budget',
      status,
      recommendation,
    };
  }

  /**
   * Get raw cycle data for persistence/API.
   */
  getCycleData(): BillingCycleData {
    return { ...this.cycle };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SPENDING TRACKING
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Record spending from a cost event.
   */
  async recordSpending(event: { cost: number; tokens?: number }): Promise<void> {
    const tokens = event.tokens ?? 0;
    this.cycle.totalSpent += event.cost;

    // Update today's record
    const today = new Date().toISOString().split('T')[0];
    let todayRecord = this.cycle.dailySpending.find(d => d.date === today);

    if (!todayRecord) {
      todayRecord = {
        date: today,
        tokens: 0,
        cost: 0,
        tasks: 0,
        initiatives: 0,
        valueScore: 50, // Default neutral
      };
      this.cycle.dailySpending.push(todayRecord);
      this.cycle.daysElapsed = this.cycle.dailySpending.length;
    }

    todayRecord.tokens += tokens;
    todayRecord.cost += event.cost;

    // Recalculate velocity (7-day rolling average)
    const recent = this.cycle.dailySpending.slice(-7);
    this.cycle.spendingVelocity = recent.reduce((s, d) => s + d.cost, 0) / recent.length;

    // Update projections
    const daysRemaining = this.cycle.daysInCycle - this.cycle.daysElapsed;
    this.cycle.projectedCycleEnd = this.cycle.totalSpent +
      (this.cycle.spendingVelocity * daysRemaining);
    this.cycle.onTrack = this.cycle.projectedCycleEnd <= this.cycle.totalBudget * 1.05;

    // Update recommended daily budget
    if (daysRemaining > 0) {
      this.cycle.recommendedDailyBudget =
        (this.cycle.totalBudget - this.cycle.totalSpent) / daysRemaining;
    }

    await this.persist();
  }

  /**
   * Update today's value score.
   */
  async updateValueScore(score: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const todayRecord = this.cycle.dailySpending.find(d => d.date === today);

    if (todayRecord) {
      todayRecord.valueScore = score;
      await this.persist();
    }
  }

  /**
   * Increment task count for today.
   */
  async recordTask(isInitiative: boolean = false): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const todayRecord = this.cycle.dailySpending.find(d => d.date === today);

    if (todayRecord) {
      todayRecord.tasks++;
      if (isInitiative) {
        todayRecord.initiatives++;
      }
      await this.persist();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CYCLE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Check if cycle has ended and start new one if needed.
   */
  private async checkCycleEnd(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    if (today > this.cycle.cycleEndDate) {
      await this.startNewCycle();
    }
  }

  /**
   * Start a new billing cycle.
   */
  async startNewCycle(): Promise<void> {
    // Archive current cycle
    if (this.cycle.dailySpending.length > 0) {
      const avgValue = this.cycle.dailySpending.reduce((s, d) => s + d.valueScore, 0)
        / this.cycle.dailySpending.length;

      const peakDays = this.cycle.dailySpending
        .filter(d => d.valueScore >= 80)
        .map(d => d.date);

      const wastedDays = this.cycle.dailySpending
        .filter(d => d.valueScore < 30)
        .map(d => d.date);

      this.cycle.previousCycles.push({
        startDate: this.cycle.cycleStartDate,
        endDate: this.cycle.cycleEndDate,
        totalBudget: this.cycle.totalBudget,
        actualSpent: this.cycle.totalSpent,
        averageValueScore: avgValue,
        peakDays,
        wastedDays,
      });

      // Keep only last 6 cycles (3 months of history)
      if (this.cycle.previousCycles.length > 6) {
        this.cycle.previousCycles = this.cycle.previousCycles.slice(-6);
      }
    }

    // Initialize new cycle
    const previousCycles = this.cycle.previousCycles;
    this.cycle = this.initializeNewCycle(previousCycles);

    await this.persist();

    this.eventBus.emit('billing:cycle_started', {
      cycleStart: this.cycle.cycleStartDate,
      cycleEnd: this.cycle.cycleEndDate,
      budget: this.cycle.totalBudget,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Persist billing cycle data to disk.
   */
  private async persist(): Promise<void> {
    try {
      // Ensure directory exists
      if (!existsSync(ARI_DIR)) {
        mkdirSync(ARI_DIR, { recursive: true });
      }

      // Atomic write: write to temp file, then rename
      const tempPath = `${BILLING_CYCLE_PATH}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.cycle, null, 2));
      await fs.rename(tempPath, BILLING_CYCLE_PATH);
    } catch (error) {
      log.error({ err: error }, 'Failed to persist');
    }
  }
}
