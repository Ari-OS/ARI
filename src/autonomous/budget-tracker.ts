import fs from 'node:fs/promises';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import type { EventBus } from '../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════
// FILE PATHS FOR PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

const ARI_DIR = path.join(homedir(), '.ari');
const BUDGET_DIR = path.join(ARI_DIR, 'budget');
const BUDGET_STATE_PATH = path.join(BUDGET_DIR, 'state.json');

// ═══════════════════════════════════════════════════════════════════════════
// MODEL PRICING (February 2026)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Claude model pricing in dollars per million tokens.
 * Intelligence score: 0.0-1.0, higher = more capable
 */
export const MODEL_PRICING = {
  'claude-3-haiku': {
    input: 0.25,
    output: 1.25,
    intelligence: 0.3,
  },
  'claude-3.5-haiku': {
    input: 0.80,
    output: 4.00,
    intelligence: 0.5,
  },
  'claude-haiku-4.5': {
    input: 1.00,
    output: 5.00,
    intelligence: 0.55,
  },
  'claude-3.5-sonnet': {
    input: 6.00,
    output: 30.00,
    intelligence: 0.75,
  },
  'claude-sonnet-4': {
    input: 3.00,
    output: 15.00,
    intelligence: 0.8,
  },
  'claude-sonnet-4.5': {
    input: 3.00,
    output: 15.00,
    intelligence: 0.85,
  },
  'claude-opus-4': {
    input: 15.00,
    output: 75.00,
    intelligence: 0.95,
  },
  'claude-opus-4.5': {
    input: 5.00,
    output: 25.00,
    intelligence: 1.0,
  },
} as const;

export type ClaudeModel = keyof typeof MODEL_PRICING;

// ═══════════════════════════════════════════════════════════════════════════
// ZOD SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Budget mode determines spending behavior.
 */
export const BudgetModeSchema = z.enum([
  'conservative',  // Low spend, basic models
  'balanced',      // Normal spend, adaptive models
  'aggressive',    // High spend, best models
  'paused',        // No spend, emergency only
]);
export type BudgetMode = z.infer<typeof BudgetModeSchema>;

/**
 * Task types for model selection.
 */
export const TaskTypeSchema = z.enum([
  'simple',        // Basic queries, formatting
  'standard',      // Normal code work, analysis
  'complex',       // Architecture, planning
  'critical',      // Security, high-stakes decisions
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

/**
 * Configuration for budget tracker.
 */
export const BudgetConfigSchema = z.object({
  monthlyBudget: z.number().min(0).default(75),
  cycleStartDay: z.number().min(1).max(31).default(1),
  warningThreshold: z.number().min(0).max(1).default(0.70),
  criticalThreshold: z.number().min(0).max(1).default(0.90),
  pauseThreshold: z.number().min(0).max(1).default(0.95),
  reservePercent: z.number().min(0).max(1).default(0.10),
  adaptiveMode: z.boolean().default(true),
});
export type BudgetConfig = z.infer<typeof BudgetConfigSchema>;

/**
 * Single LLM usage record.
 */
export const UsageRecordSchema = z.object({
  timestamp: z.string(),
  model: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cost: z.number(),
  taskType: TaskTypeSchema,
  taskCategory: z.string().optional(),
  success: z.boolean(),
});
export type UsageRecord = z.infer<typeof UsageRecordSchema>;

/**
 * Daily usage breakdown.
 */
export const DailyUsageSchema = z.object({
  date: z.string(),
  totalCost: z.number(),
  totalTokens: z.number(),
  requestCount: z.number(),
  modelBreakdown: z.record(z.object({
    cost: z.number(),
    tokens: z.number(),
    requests: z.number(),
  })),
  taskBreakdown: z.record(z.object({
    cost: z.number(),
    requests: z.number(),
  })),
});
export type DailyUsage = z.infer<typeof DailyUsageSchema>;

/**
 * Complete budget state.
 */
export const BudgetStateSchema = z.object({
  version: z.string().default('1.0.0'),
  config: BudgetConfigSchema,
  currentCycleStart: z.string(),
  currentCycleEnd: z.string(),
  totalSpent: z.number().default(0),
  mode: BudgetModeSchema.default('balanced'),
  dailyUsage: z.array(DailyUsageSchema).default([]),
  usageHistory: z.array(UsageRecordSchema).default([]),

  // Adaptive learning
  taskTypePerformance: z.record(z.object({
    successRate: z.number(),
    avgCost: z.number(),
    preferredModel: z.string().optional(),
  })).default({}),

  // Last updated timestamp
  lastUpdated: z.string(),
});
export type BudgetState = z.infer<typeof BudgetStateSchema>;

/**
 * Budget status returned by getStatus().
 */
export const BudgetStatusSchema = z.object({
  mode: BudgetModeSchema,
  spent: z.number(),
  remaining: z.number(),
  budget: z.number(),
  percentUsed: z.number(),
  daysInCycle: z.number(),
  daysRemaining: z.number(),
  projectedSpend: z.number(),
  avgDailySpend: z.number(),
  recommendedDailySpend: z.number(),
  status: z.enum(['ok', 'warning', 'critical', 'paused']),
});
export type BudgetStatus = z.infer<typeof BudgetStatusSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// BUDGET TRACKER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Intelligent budget tracker for LLM usage.
 *
 * Features:
 * - Model-aware cost tracking (8 Claude models)
 * - Automatic threshold warnings (70%, 90%, 95%)
 * - Adaptive mode selection based on budget state
 * - 10% reserve for critical operations
 * - Monthly billing cycle management
 * - Task type performance learning
 * - Atomic state persistence
 *
 * Default: $75/month starting on day 1 of each month
 */
export class BudgetTracker {
  private eventBus: EventBus | null;
  private state: BudgetState;

  // Processing queue to prevent race conditions
  private processingQueue: Promise<void> = Promise.resolve();
  private isProcessing: boolean = false;

  constructor(eventBus?: EventBus, config?: Partial<BudgetConfig>) {
    this.eventBus = eventBus ?? null;

    // Initialize state (synchronously load if exists)
    this.state = this.loadStateSync();

    // Apply config overrides if provided
    if (config) {
      this.state.config = { ...this.state.config, ...config };
    }

    // Listen for LLM request completion events
    if (this.eventBus) {
      this.eventBus.on('llm:request_complete', (event) => {
        this.queueOperation(() => this.recordUsage({
          timestamp: event.timestamp,
          model: event.model,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          cost: event.cost,
          taskType: event.taskType as TaskType,
          taskCategory: event.taskCategory,
          success: event.success,
        }));
      });

      // Check for cycle reset daily
      this.eventBus.on('scheduler:daily_reset', () => {
        this.queueOperation(() => this.checkCycleReset());
      });
    }
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
        console.error('[BudgetTracker] Operation failed:', error);
      });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Initialize budget tracker (async version for explicit initialization).
   */
  async initialize(): Promise<void> {
    // Check if we need to start a new cycle
    await this.checkCycleReset();
    await this.persist();
  }

  /**
   * Load state from disk (synchronous for constructor).
   */
  private loadStateSync(): BudgetState {
    try {
      if (existsSync(BUDGET_STATE_PATH)) {
        const data = readFileSync(BUDGET_STATE_PATH, 'utf-8');
        const parsed: unknown = JSON.parse(data);

        // Validate with Zod schema
        const validated = BudgetStateSchema.parse(parsed);

        // Check if cycle has ended
        const today = new Date().toISOString().split('T')[0];
        if (today > validated.currentCycleEnd) {
          // Cycle ended, start new one
          return this.initializeNewCycle(validated.config);
        }

        return validated;
      }
    } catch (error) {
      console.error('[BudgetTracker] Failed to load state:', error);
    }

    // Initialize new state
    return this.initializeNewCycle();
  }

  /**
   * Initialize a new billing cycle.
   */
  private initializeNewCycle(config?: BudgetConfig): BudgetState {
    const cfg = config ?? BudgetConfigSchema.parse({});

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Calculate cycle start/end based on cycleStartDay
    const cycleStart = new Date(year, month, cfg.cycleStartDay);

    // If we're past the start day this month, start from this month
    // Otherwise, use last month
    if (now.getDate() < cfg.cycleStartDay) {
      cycleStart.setMonth(cycleStart.getMonth() - 1);
    }

    const cycleEnd = new Date(cycleStart);
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);
    cycleEnd.setDate(cycleEnd.getDate() - 1); // Last day of cycle

    return {
      version: '1.0.0',
      config: cfg,
      currentCycleStart: cycleStart.toISOString().split('T')[0],
      currentCycleEnd: cycleEnd.toISOString().split('T')[0],
      totalSpent: 0,
      mode: 'balanced',
      dailyUsage: [],
      usageHistory: [],
      taskTypePerformance: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // USAGE TRACKING
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Record LLM usage and update budget state.
   */
  async recordUsage(record: UsageRecord): Promise<void> {
    // Add to history
    this.state.usageHistory.push(record);

    // Update total spent
    this.state.totalSpent += record.cost;

    // Update daily breakdown
    const today = new Date().toISOString().split('T')[0];
    let dailyRecord = this.state.dailyUsage.find(d => d.date === today);

    if (!dailyRecord) {
      dailyRecord = {
        date: today,
        totalCost: 0,
        totalTokens: 0,
        requestCount: 0,
        modelBreakdown: {},
        taskBreakdown: {},
      };
      this.state.dailyUsage.push(dailyRecord);
    }

    dailyRecord.totalCost += record.cost;
    dailyRecord.totalTokens += record.inputTokens + record.outputTokens;
    dailyRecord.requestCount += 1;

    // Update model breakdown
    if (!dailyRecord.modelBreakdown[record.model]) {
      dailyRecord.modelBreakdown[record.model] = {
        cost: 0,
        tokens: 0,
        requests: 0,
      };
    }
    dailyRecord.modelBreakdown[record.model].cost += record.cost;
    dailyRecord.modelBreakdown[record.model].tokens += record.inputTokens + record.outputTokens;
    dailyRecord.modelBreakdown[record.model].requests += 1;

    // Update task breakdown
    if (!dailyRecord.taskBreakdown[record.taskType]) {
      dailyRecord.taskBreakdown[record.taskType] = {
        cost: 0,
        requests: 0,
      };
    }
    dailyRecord.taskBreakdown[record.taskType].cost += record.cost;
    dailyRecord.taskBreakdown[record.taskType].requests += 1;

    // Update task type performance (adaptive learning)
    if (this.state.config.adaptiveMode) {
      this.updateTaskTypePerformance(record);
    }

    // Check thresholds
    this.checkThresholds();

    // Update timestamp
    this.state.lastUpdated = new Date().toISOString();

    // Persist state
    await this.persist();

    // Emit update event
    if (this.eventBus) {
      const status = this.getStatus();
      this.eventBus.emit('budget:update', {
        status: status.status,
        spent: status.spent,
        remaining: status.remaining,
        percentUsed: status.percentUsed,
        mode: status.mode,
      });
    }
  }

  /**
   * Update task type performance metrics (adaptive learning).
   */
  private updateTaskTypePerformance(record: UsageRecord): void {
    const taskType = record.taskType;

    if (!this.state.taskTypePerformance[taskType]) {
      this.state.taskTypePerformance[taskType] = {
        successRate: 0,
        avgCost: 0,
        preferredModel: undefined,
      };
    }

    const perf = this.state.taskTypePerformance[taskType];
    const historicalCount = this.state.usageHistory
      .filter(r => r.taskType === taskType).length;

    // Update success rate (exponential moving average)
    const alpha = 0.1; // Learning rate
    perf.successRate = (perf.successRate * (1 - alpha)) + (record.success ? alpha : 0);

    // Update average cost
    perf.avgCost = ((perf.avgCost * (historicalCount - 1)) + record.cost) / historicalCount;

    // Update preferred model (most successful recent model)
    const recentSuccesses = this.state.usageHistory
      .filter(r => r.taskType === taskType && r.success)
      .slice(-10); // Last 10 successful requests

    if (recentSuccesses.length > 0) {
      const modelCounts = recentSuccesses.reduce((acc, r) => {
        acc[r.model] = (acc[r.model] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const [mostUsedModel] = Object.entries(modelCounts)
        .sort((a, b) => b[1] - a[1])[0];

      perf.preferredModel = mostUsedModel;
    }
  }

  /**
   * Check budget thresholds and emit events.
   */
  private checkThresholds(): void {
    if (!this.eventBus) return;

    const percentUsed = this.state.totalSpent / this.state.config.monthlyBudget;
    const remaining = this.state.config.monthlyBudget - this.state.totalSpent;

    // Check pause threshold (95%)
    if (percentUsed >= this.state.config.pauseThreshold && this.state.mode !== 'paused') {
      this.state.mode = 'paused';
      this.eventBus.emit('budget:pause', {
        spent: this.state.totalSpent,
        budget: this.state.config.monthlyBudget,
        percentUsed,
      });
    }
    // Check critical threshold (90%)
    else if (percentUsed >= this.state.config.criticalThreshold && this.state.mode !== 'conservative') {
      this.state.mode = 'conservative';
      this.eventBus.emit('budget:critical', {
        spent: this.state.totalSpent,
        remaining,
      });
    }
    // Check warning threshold (70%)
    else if (percentUsed >= this.state.config.warningThreshold && this.state.mode === 'balanced') {
      this.eventBus.emit('budget:warning', {
        spent: this.state.totalSpent,
        remaining,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATUS AND RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get current budget status.
   */
  getStatus(): BudgetStatus {
    const budget = this.state.config.monthlyBudget;
    const spent = this.state.totalSpent;
    const remaining = Math.max(0, budget - spent);
    const percentUsed = spent / budget;

    // Calculate days in cycle
    const cycleStart = new Date(this.state.currentCycleStart);
    const cycleEnd = new Date(this.state.currentCycleEnd);
    const today = new Date();

    const totalDays = Math.ceil((cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((today.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);

    // Calculate spending metrics
    const avgDailySpend = daysElapsed > 0 ? spent / daysElapsed : 0;
    const projectedSpend = spent + (avgDailySpend * daysRemaining);
    const recommendedDailySpend = daysRemaining > 0 ? remaining / daysRemaining : 0;

    // Determine status
    let status: 'ok' | 'warning' | 'critical' | 'paused';
    if (this.state.mode === 'paused') {
      status = 'paused';
    } else if (percentUsed >= this.state.config.criticalThreshold) {
      status = 'critical';
    } else if (percentUsed >= this.state.config.warningThreshold) {
      status = 'warning';
    } else {
      status = 'ok';
    }

    return {
      mode: this.state.mode,
      spent,
      remaining,
      budget,
      percentUsed,
      daysInCycle: totalDays,
      daysRemaining,
      projectedSpend,
      avgDailySpend,
      recommendedDailySpend,
      status,
    };
  }

  /**
   * Get recommended model for a task type based on budget state.
   */
  getRecommendedModel(taskType: TaskType): ClaudeModel {
    // If paused, only allow emergency model
    if (this.state.mode === 'paused') {
      return 'claude-3-haiku';
    }

    // Check adaptive learning for preferred model
    if (this.state.config.adaptiveMode) {
      const perf = this.state.taskTypePerformance[taskType];
      if (perf?.preferredModel && perf.preferredModel in MODEL_PRICING) {
        // Verify preferred model fits current budget mode
        const model = perf.preferredModel as ClaudeModel;
        if (this.modelFitsBudgetMode(model)) {
          return model;
        }
      }
    }

    // Fall back to budget mode defaults
    return this.getDefaultModelForMode(taskType);
  }

  /**
   * Check if a model fits the current budget mode.
   */
  private modelFitsBudgetMode(model: ClaudeModel): boolean {
    const intelligence = MODEL_PRICING[model].intelligence;

    switch (this.state.mode) {
      case 'conservative':
        return intelligence <= 0.55; // Haiku models only
      case 'balanced':
        return intelligence <= 0.85; // Up to Sonnet 4.5
      case 'aggressive':
        return true; // Any model
      case 'paused':
        return model === 'claude-3-haiku'; // Emergency only
    }
  }

  /**
   * Get default model for budget mode and task type.
   */
  private getDefaultModelForMode(taskType: TaskType): ClaudeModel {
    switch (this.state.mode) {
      case 'conservative':
        // Use cheapest models
        switch (taskType) {
          case 'simple':
            return 'claude-3-haiku';
          case 'standard':
            return 'claude-3.5-haiku';
          case 'complex':
            return 'claude-haiku-4.5';
          case 'critical':
            return 'claude-haiku-4.5';
        }
        break;

      case 'balanced':
        // Balance cost and capability
        switch (taskType) {
          case 'simple':
            return 'claude-3.5-haiku';
          case 'standard':
            return 'claude-sonnet-4';
          case 'complex':
            return 'claude-sonnet-4.5';
          case 'critical':
            return 'claude-sonnet-4.5';
        }
        break;

      case 'aggressive':
        // Use best models
        switch (taskType) {
          case 'simple':
            return 'claude-haiku-4.5';
          case 'standard':
            return 'claude-sonnet-4.5';
          case 'complex':
            return 'claude-opus-4.5';
          case 'critical':
            return 'claude-opus-4.5';
        }
        break;

      case 'paused':
        // Emergency only
        return 'claude-3-haiku';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Update budget configuration.
   */
  async updateConfig(updates: Partial<BudgetConfig>): Promise<void> {
    this.state.config = { ...this.state.config, ...updates };
    this.state.lastUpdated = new Date().toISOString();
    await this.persist();
  }

  /**
   * Get current configuration.
   */
  getConfig(): BudgetConfig {
    return { ...this.state.config };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CYCLE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Check if billing cycle has ended and reset if needed.
   */
  private async checkCycleReset(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    if (today > this.state.currentCycleEnd) {
      await this.resetCycle();
    }
  }

  /**
   * Reset to new billing cycle.
   */
  async resetCycle(): Promise<void> {
    const previousSpent = this.state.totalSpent;

    // Initialize new cycle
    this.state = this.initializeNewCycle(this.state.config);

    await this.persist();

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit('budget:cycle_reset', {
        previousSpent,
        newBudget: this.state.config.monthlyBudget,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Persist state to disk with atomic write.
   */
  private async persist(): Promise<void> {
    try {
      // Ensure directory exists
      if (!existsSync(BUDGET_DIR)) {
        mkdirSync(BUDGET_DIR, { recursive: true });
      }

      // Atomic write: write to temp file, then rename
      const tempPath = `${BUDGET_STATE_PATH}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.state, null, 2));
      await fs.rename(tempPath, BUDGET_STATE_PATH);
    } catch (error) {
      console.error('[BudgetTracker] Failed to persist state:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get raw state for debugging/API.
   */
  getState(): BudgetState {
    return { ...this.state };
  }

  /**
   * Calculate cost for a given model and token count.
   */
  static calculateCost(model: ClaudeModel, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Get all available models sorted by intelligence.
   */
  static getModelsByIntelligence(): Array<{ model: ClaudeModel; intelligence: number }> {
    return Object.entries(MODEL_PRICING)
      .map(([model, pricing]) => ({
        model: model as ClaudeModel,
        intelligence: pricing.intelligence,
      }))
      .sort((a, b) => b.intelligence - a.intelligence);
  }
}
