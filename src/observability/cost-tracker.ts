import fs from 'node:fs/promises';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import type { EventBus } from '../kernel/event-bus.js';
import type { AuditLogger } from '../kernel/audit.js';
import type { AgentId } from '../kernel/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// FILE PATHS FOR PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

const ARI_DIR = path.join(homedir(), '.ari');
const TOKEN_USAGE_PATH = path.join(ARI_DIR, 'token-usage.json');
const BUDGET_CONFIG_PATH = path.join(ARI_DIR, 'budget-config.json');

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL PRICING (per 1M tokens)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Model pricing in dollars per 1 million tokens.
 * Updated to match current Anthropic pricing (2026).
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic models
  'claude-opus-4': { input: 15, output: 75 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-haiku': { input: 0.25, output: 1.25 },
  // Legacy model IDs (for compatibility)
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-opus-4-20250514': { input: 15, output: 75 },
  // OpenAI models
  'gpt-4o': { input: 5, output: 15 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  // Other providers
  'glm-4.7': { input: 2, output: 2 },
  // Fallback for unknown models
  'default': { input: 3, output: 15 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Throttle levels for budget management.
 * - normal: Full operation, no restrictions
 * - warning: Alert user, continue operation (75-85%)
 * - reduce: Skip non-essential tasks (85-95%)
 * - pause: User-only mode, block autonomous work (95%+)
 */
export type ThrottleLevel = 'normal' | 'warning' | 'reduce' | 'pause';

/**
 * Task priority for budget gating decisions.
 * - BACKGROUND: Autonomous work (initiatives, cleanup)
 * - STANDARD: Normal operations (scheduled tasks)
 * - URGENT: User interactions (always allowed)
 */
export type TaskPriority = 'BACKGROUND' | 'STANDARD' | 'URGENT';

/**
 * A single cost entry representing one API call.
 */
export interface CostEntry {
  id: string;
  timestamp: Date;
  operation: string;
  agent: AgentId;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

/**
 * Input for tracking a cost entry (without computed fields).
 */
export interface CostEntryInput {
  timestamp?: Date;
  operation: string;
  agent: AgentId;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Budget configuration.
 */
export interface Budget {
  daily: number;
  weekly: number;
  monthly: number;
}

/**
 * Token usage record persisted to disk.
 * Tracks daily usage with breakdown by model and task type.
 */
export interface TokenUsageRecord {
  date: string;
  totalTokens: number;
  totalCost: number;
  byModel: Record<string, { tokens: number; cost: number }>;
  byTaskType: Record<string, { tokens: number; cost: number; count: number }>;
  resetAt: string;
}

/**
 * Model configuration within a budget profile.
 */
export interface ModelConfig {
  id: string;
  inputCost: number;
  outputCost: number;
  disabled?: boolean;
  enabled?: boolean;
  maxPerDay?: number;
  preferForQuality?: boolean;
}

/**
 * Budget profile configuration (loaded from config files).
 */
export interface BudgetProfile {
  version: string;
  profile: 'conservative' | 'balanced' | 'aggressive';
  budget: {
    daily: {
      maxTokens: number;
      maxCost: number;
      reserved?: {
        user: number;
        autonomous: number;
      };
    };
    throttling: {
      warning: number;
      reduce: number;
      pause: number;
    };
    resetTime?: string;
    timezone?: string;
  };
  models: Record<string, ModelConfig>;
  routing: {
    defaultModel: string;
    preferCheaper?: boolean;
    preferQuality?: boolean;
    rules: Record<string, string>;
    overrides?: Record<string, string>;
  };
  initiatives: {
    autoExecute: boolean;
    maxPerDay: number;
    scanFrequency?: string;
    autoExecuteThreshold: {
      maxCostPerTask: number;
      maxRisk: number;
      maxFilesAffected: number;
      minPriority: number;
    };
    approvalRequired?: {
      minCost: number;
      minRisk: number;
      minFilesAffected: number;
      touchesSecurity: boolean;
    };
  };
  scheduling: {
    essentialOnly: boolean;
    highFrequency?: boolean;
    tasks: Record<string, { enabled: boolean; model?: string; frequency?: string }>;
  };
  billing?: {
    cycleLength: number;
    totalBudget: number;
    warningThreshold: number;
    criticalThreshold: number;
    autoAdjustDaily: boolean;
    learningEnabled: boolean;
  };
  monitoring?: {
    alerts: Record<string, { enabled: boolean; channels: string[] }>;
    verboseLogging: boolean;
  };
  description?: string;
}

/**
 * Cost summary with aggregates and trend.
 */
export interface CostSummary {
  daily: number;
  weekly: number;
  monthly: number;
  byAgent: Record<string, number>;
  byOperation: Record<string, number>;
  byModel: Record<string, number>;
  trend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Result of canProceed() check.
 */
export interface ProceedCheckResult {
  allowed: boolean;
  throttled: boolean;
  reason?: string;
  throttleLevel: ThrottleLevel;
}

/**
 * Throttle status for API and dashboard.
 */
export interface ThrottleStatus {
  level: ThrottleLevel;
  usagePercent: number;
  tokensUsed: number;
  tokensRemaining: number;
  costUsed: number;
  costRemaining: number;
  projectedEOD: number;
  projectedCostEOD: number;
  recommendation: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COST TRACKER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CostTracker - Comprehensive API cost tracking with token-level persistence.
 *
 * Features:
 * - Token-level tracking (not just cost)
 * - File persistence to ~/.ari/token-usage.json
 * - Budget profile integration
 * - Throttle level calculation (normal/warning/reduce/pause)
 * - canProceed() method for gating autonomous operations
 * - Daily reset at configured time with timezone support
 *
 * Based on MAHORAGA (Trading Agent) patterns:
 * - Track costs by agent, operation, and model
 * - Budget alerts at configurable thresholds
 * - Trend analysis for cost optimization
 */
export class CostTracker {
  private entries: CostEntry[] = [];
  private budget: Budget;
  private readonly eventBus: EventBus;
  private readonly auditLogger: AuditLogger;

  // Token persistence
  private tokenUsage: TokenUsageRecord;
  private profile: BudgetProfile | null = null;
  private lastThrottleLevel: ThrottleLevel = 'normal';
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty: boolean = false;

  constructor(
    eventBus: EventBus,
    auditLogger: AuditLogger,
    budget: Budget = { daily: 10, weekly: 50, monthly: 200 }
  ) {
    this.eventBus = eventBus;
    this.auditLogger = auditLogger;
    this.budget = budget;

    // Initialize token usage for today
    const today = new Date().toISOString().split('T')[0];
    this.tokenUsage = {
      date: today,
      totalTokens: 0,
      totalCost: 0,
      byModel: {},
      byTaskType: {},
      resetAt: new Date().toISOString(),
    };

    // Load from disk synchronously in constructor
    this.loadFromDiskSync();

    // Start periodic persistence (every 30 seconds if dirty)
    this.startPeriodicPersist();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSISTENCE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Load token usage and profile from disk synchronously.
   * Called during construction to ensure data is available immediately.
   */
  private loadFromDiskSync(): void {
    // Ensure directory exists
    if (!existsSync(ARI_DIR)) {
      try {
        mkdirSync(ARI_DIR, { recursive: true });
      } catch {
        // Directory might be created by another process
      }
    }

    // Load token usage
    try {
      if (existsSync(TOKEN_USAGE_PATH)) {
        const data = readFileSync(TOKEN_USAGE_PATH, 'utf-8');
        const stored = JSON.parse(data) as TokenUsageRecord;
        const today = new Date().toISOString().split('T')[0];

        if (stored.date === today) {
          // Same day - load existing data
          this.tokenUsage = stored;
        } else {
          // New day - emit reset event and start fresh
          this.eventBus.emit('audit:log', {
            action: 'budget_daily_reset',
            agent: 'core',
            trustLevel: 'system',
            details: {
              previousDate: stored.date,
              previousTokens: stored.totalTokens,
              previousCost: stored.totalCost,
            },
          });
        }
      }
    } catch (error) {
      // No existing data or parse error - start fresh
      console.warn('[CostTracker] Failed to load token usage:', error);
    }

    // Load profile if exists
    try {
      if (existsSync(BUDGET_CONFIG_PATH)) {
        const profileData = readFileSync(BUDGET_CONFIG_PATH, 'utf-8');
        this.profile = JSON.parse(profileData) as BudgetProfile;

        // Apply profile budget to internal budget
        if (this.profile?.budget?.daily) {
          this.budget.daily = this.profile.budget.daily.maxCost;
        }
      }
    } catch (error) {
      // No profile - use defaults
      console.warn('[CostTracker] Failed to load budget profile:', error);
    }
  }

  /**
   * Persist token usage to disk asynchronously.
   * Uses atomic write (temp file + rename) for safety.
   */
  private async persist(): Promise<void> {
    if (!this.dirty) return;

    try {
      await fs.mkdir(ARI_DIR, { recursive: true });

      // Atomic write: write to temp file, then rename
      const tempPath = `${TOKEN_USAGE_PATH}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.tokenUsage, null, 2));
      await fs.rename(tempPath, TOKEN_USAGE_PATH);

      this.dirty = false;
    } catch (error) {
      console.error('[CostTracker] Failed to persist token usage:', error);
    }
  }

  /**
   * Start periodic persistence timer.
   * Persists every 30 seconds if there are unsaved changes.
   */
  private startPeriodicPersist(): void {
    this.persistTimer = setInterval(() => {
      void this.persist();
    }, 30000);

    // Ensure timer doesn't keep process alive
    if (this.persistTimer.unref) {
      this.persistTimer.unref();
    }
  }

  /**
   * Stop periodic persistence and flush pending changes.
   */
  async shutdown(): Promise<void> {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
    await this.persist();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACKING METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Track a cost entry.
   * Records the entry, updates token usage, persists, and checks budgets.
   */
  track(entry: CostEntryInput): CostEntry {
    // Check for daily reset
    this.checkDailyReset();

    const cost = this.calculateCost(entry.model, entry.inputTokens, entry.outputTokens);
    const totalTokens = entry.inputTokens + entry.outputTokens;

    const fullEntry: CostEntry = {
      id: `cost_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: entry.timestamp || new Date(),
      operation: entry.operation,
      agent: entry.agent,
      provider: entry.provider,
      model: entry.model,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      cost,
    };

    // Add to in-memory entries
    this.entries.push(fullEntry);

    // Update token usage tracking
    this.tokenUsage.totalTokens += totalTokens;
    this.tokenUsage.totalCost += cost;

    // By model
    const modelKey = entry.model;
    if (!this.tokenUsage.byModel[modelKey]) {
      this.tokenUsage.byModel[modelKey] = { tokens: 0, cost: 0 };
    }
    this.tokenUsage.byModel[modelKey].tokens += totalTokens;
    this.tokenUsage.byModel[modelKey].cost += cost;

    // By task type (using operation)
    const taskType = entry.operation || 'unknown';
    if (!this.tokenUsage.byTaskType[taskType]) {
      this.tokenUsage.byTaskType[taskType] = { tokens: 0, cost: 0, count: 0 };
    }
    this.tokenUsage.byTaskType[taskType].tokens += totalTokens;
    this.tokenUsage.byTaskType[taskType].cost += cost;
    this.tokenUsage.byTaskType[taskType].count += 1;

    // Mark dirty for persistence
    this.dirty = true;

    // Emit tracking event
    this.eventBus.emit('cost:tracked', {
      operation: entry.operation,
      cost,
      model: entry.model,
    });

    // Check budget alerts
    this.checkBudgetAlerts();

    // Update and emit throttle status if changed
    this.updateThrottleStatus();

    return fullEntry;
  }

  /**
   * Calculate cost for a model usage.
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Try to get pricing from profile first
    if (this.profile?.models) {
      for (const [, config] of Object.entries(this.profile.models)) {
        if (config.id === model) {
          // Profile pricing is in dollars per million tokens
          return (inputTokens * config.inputCost + outputTokens * config.outputCost) / 1_000_000;
        }
      }
    }

    // Fall back to static pricing
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  }

  /**
   * Check if daily reset is needed (midnight in configured timezone).
   */
  private checkDailyReset(): void {
    const today = new Date().toISOString().split('T')[0];

    if (this.tokenUsage.date !== today) {
      // Archive previous day's data (could emit event for analytics)
      const previousUsage = { ...this.tokenUsage };

      // Reset for new day
      this.tokenUsage = {
        date: today,
        totalTokens: 0,
        totalCost: 0,
        byModel: {},
        byTaskType: {},
        resetAt: new Date().toISOString(),
      };

      this.dirty = true;
      this.lastThrottleLevel = 'normal';

      // Emit daily reset event
      this.eventBus.emit('audit:log', {
        action: 'budget_daily_reset',
        agent: 'core',
        trustLevel: 'system',
        details: {
          previousDate: previousUsage.date,
          previousTokens: previousUsage.totalTokens,
          previousCost: previousUsage.totalCost,
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THROTTLE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if operation can proceed given budget constraints.
   *
   * @param estimatedTokens - Expected token usage for the operation
   * @param priority - Task priority level
   * @returns ProceedCheckResult with allowed/throttled status and reason
   */
  canProceed(
    estimatedTokens: number,
    priority: TaskPriority = 'STANDARD'
  ): ProceedCheckResult {
    const maxTokens = this.profile?.budget?.daily?.maxTokens ?? 800000;
    const projectedTotal = this.tokenUsage.totalTokens + estimatedTokens;
    const throttleLevel = this.getThrottleLevel();

    // URGENT (user interactions) always allowed
    if (priority === 'URGENT') {
      return {
        allowed: true,
        throttled: throttleLevel !== 'normal',
        throttleLevel,
        reason: throttleLevel !== 'normal'
          ? `Budget ${this.getUsagePercent().toFixed(0)}% used, but URGENT priority allowed`
          : undefined,
      };
    }

    // Would exceed budget?
    if (projectedTotal > maxTokens) {
      return {
        allowed: false,
        throttled: false,
        throttleLevel,
        reason: `Would exceed daily budget (${projectedTotal.toLocaleString()}/${maxTokens.toLocaleString()} tokens)`,
      };
    }

    // At pause level, block non-urgent tasks
    if (throttleLevel === 'pause') {
      if (priority === 'BACKGROUND') {
        return {
          allowed: false,
          throttled: true,
          throttleLevel,
          reason: 'Budget 95%+ consumed, background tasks paused until midnight reset',
        };
      }
      // STANDARD tasks also blocked at pause level
      return {
        allowed: false,
        throttled: true,
        throttleLevel,
        reason: 'Budget 95%+ consumed, autonomous work paused until midnight reset',
      };
    }

    // At reduce level, block background tasks
    if (throttleLevel === 'reduce' && priority === 'BACKGROUND') {
      return {
        allowed: false,
        throttled: true,
        throttleLevel,
        reason: 'Budget 85%+ consumed, background tasks skipped (essential tasks only)',
      };
    }

    // Warning or normal - allow with throttle indicator
    return {
      allowed: true,
      throttled: throttleLevel !== 'normal',
      throttleLevel,
      reason: throttleLevel === 'warning'
        ? `Budget ${this.getUsagePercent().toFixed(0)}% used, consider reducing autonomous work`
        : undefined,
    };
  }

  /**
   * Get current throttle level based on usage percentage.
   */
  getThrottleLevel(): ThrottleLevel {
    const usagePercent = this.getUsagePercent() / 100;

    const thresholds = this.profile?.budget?.throttling ?? {
      warning: 0.80,
      reduce: 0.90,
      pause: 0.95,
    };

    if (usagePercent >= thresholds.pause) return 'pause';
    if (usagePercent >= thresholds.reduce) return 'reduce';
    if (usagePercent >= thresholds.warning) return 'warning';
    return 'normal';
  }

  /**
   * Get usage percentage (0-100).
   */
  private getUsagePercent(): number {
    const maxTokens = this.profile?.budget?.daily?.maxTokens ?? 800000;
    return (this.tokenUsage.totalTokens / maxTokens) * 100;
  }

  /**
   * Get comprehensive throttle status for API/dashboard.
   */
  getThrottleStatus(): ThrottleStatus {
    const maxTokens = this.profile?.budget?.daily?.maxTokens ?? 800000;
    const maxCost = this.profile?.budget?.daily?.maxCost ?? 2.50;
    const usagePercent = this.getUsagePercent();

    // Calculate projection based on time elapsed today
    const resetTime = new Date(this.tokenUsage.resetAt);
    const now = new Date();
    const hoursElapsed = Math.max(0.1, (now.getTime() - resetTime.getTime()) / (1000 * 60 * 60));
    const tokensPerHour = this.tokenUsage.totalTokens / hoursElapsed;
    const hoursRemaining = Math.max(0, 24 - hoursElapsed);
    const projectedEOD = this.tokenUsage.totalTokens + (tokensPerHour * hoursRemaining);

    const costPerHour = this.tokenUsage.totalCost / hoursElapsed;
    const projectedCostEOD = this.tokenUsage.totalCost + (costPerHour * hoursRemaining);

    // Generate recommendation
    let recommendation: string;
    const level = this.getThrottleLevel();
    if (level === 'pause') {
      recommendation = 'Budget critical - only user interactions allowed until midnight reset';
    } else if (level === 'reduce') {
      recommendation = 'Reduce autonomous work - running essential tasks only';
    } else if (level === 'warning') {
      recommendation = 'Monitor usage - consider reducing non-essential tasks';
    } else if (projectedEOD > maxTokens) {
      recommendation = `Projected to exceed budget by ${((projectedEOD / maxTokens - 1) * 100).toFixed(0)}% at current rate`;
    } else {
      recommendation = 'Operating normally';
    }

    return {
      level,
      usagePercent,
      tokensUsed: this.tokenUsage.totalTokens,
      tokensRemaining: Math.max(0, maxTokens - this.tokenUsage.totalTokens),
      costUsed: this.tokenUsage.totalCost,
      costRemaining: Math.max(0, maxCost - this.tokenUsage.totalCost),
      projectedEOD,
      projectedCostEOD,
      recommendation,
    };
  }

  /**
   * Update throttle status and emit events if changed.
   */
  private updateThrottleStatus(): void {
    const level = this.getThrottleLevel();

    if (level !== this.lastThrottleLevel) {
      const usagePercent = this.getUsagePercent();
      const maxTokens = this.profile?.budget?.daily?.maxTokens ?? 800000;

      this.eventBus.emit('audit:log', {
        action: 'budget_throttle_changed',
        agent: 'core',
        trustLevel: 'system',
        details: {
          previousLevel: this.lastThrottleLevel,
          newLevel: level,
          usagePercent: usagePercent.toFixed(1),
          tokensUsed: this.tokenUsage.totalTokens,
          maxTokens,
        },
      });

      // Emit budget-specific events for notification system
      if (level === 'warning' || level === 'reduce' || level === 'pause') {
        this.eventBus.emit('cost:budget_warning', {
          type: 'daily',
          current: this.tokenUsage.totalCost,
          budget: this.budget.daily,
          percentage: usagePercent,
        });
      }

      this.lastThrottleLevel = level;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get current token usage record.
   */
  getTokenUsage(): TokenUsageRecord {
    return { ...this.tokenUsage };
  }

  /**
   * Get current profile.
   */
  getProfile(): BudgetProfile | null {
    return this.profile;
  }

  /**
   * Set and persist a new profile.
   */
  async setProfile(profile: BudgetProfile): Promise<void> {
    this.profile = profile;
    this.budget.daily = profile.budget.daily.maxCost;

    // Persist profile
    await fs.mkdir(ARI_DIR, { recursive: true });
    const tempPath = `${BUDGET_CONFIG_PATH}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(profile, null, 2));
    await fs.rename(tempPath, BUDGET_CONFIG_PATH);

    // Emit profile changed event
    this.eventBus.emit('audit:log', {
      action: 'budget_profile_changed',
      agent: 'core',
      trustLevel: 'system',
      details: {
        profile: profile.profile,
        maxTokens: profile.budget.daily.maxTokens,
        maxCost: profile.budget.daily.maxCost,
      },
    });

    // Force throttle status update
    this.lastThrottleLevel = 'normal'; // Reset to trigger update
    this.updateThrottleStatus();
  }

  /**
   * Load profile from a file path.
   */
  async loadProfileFromFile(filePath: string): Promise<void> {
    const data = await fs.readFile(filePath, 'utf-8');
    const profile = JSON.parse(data) as BudgetProfile;
    await this.setProfile(profile);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY METHODS (for backwards compatibility)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get cost summary.
   */
  getSummary(): CostSummary {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;
    const month = 30 * day;

    const dailyEntries = this.entries.filter(e => now - e.timestamp.getTime() < day);
    const weeklyEntries = this.entries.filter(e => now - e.timestamp.getTime() < week);
    const monthlyEntries = this.entries.filter(e => now - e.timestamp.getTime() < month);

    const daily = dailyEntries.reduce((sum, e) => sum + e.cost, 0);
    const weekly = weeklyEntries.reduce((sum, e) => sum + e.cost, 0);
    const monthly = monthlyEntries.reduce((sum, e) => sum + e.cost, 0);

    // Group by agent
    const byAgent: Record<string, number> = {};
    for (const entry of monthlyEntries) {
      byAgent[entry.agent] = (byAgent[entry.agent] || 0) + entry.cost;
    }

    // Group by operation
    const byOperation: Record<string, number> = {};
    for (const entry of monthlyEntries) {
      byOperation[entry.operation] = (byOperation[entry.operation] || 0) + entry.cost;
    }

    // Group by model
    const byModel: Record<string, number> = {};
    for (const entry of monthlyEntries) {
      byModel[entry.model] = (byModel[entry.model] || 0) + entry.cost;
    }

    // Calculate trend
    const yesterdayEntries = this.entries.filter(e => {
      const age = now - e.timestamp.getTime();
      return age >= day && age < 2 * day;
    });
    const yesterdayCost = yesterdayEntries.reduce((sum, e) => sum + e.cost, 0);

    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (yesterdayCost > 0) {
      if (daily > yesterdayCost * 1.2) trend = 'increasing';
      else if (daily < yesterdayCost * 0.8) trend = 'decreasing';
    }

    return { daily, weekly, monthly, byAgent, byOperation, byModel, trend };
  }

  /**
   * Check budget alerts (internal method).
   */
  private checkBudgetAlerts(): void {
    const summary = this.getSummary();

    // Daily warning at 80%
    if (summary.daily > this.budget.daily * 0.8 && summary.daily <= this.budget.daily) {
      this.eventBus.emit('cost:budget_warning', {
        type: 'daily',
        current: summary.daily,
        budget: this.budget.daily,
        percentage: (summary.daily / this.budget.daily) * 100,
      });
    }

    // Daily exceeded
    if (summary.daily > this.budget.daily) {
      this.eventBus.emit('cost:budget_exceeded', {
        type: 'daily',
        current: summary.daily,
        budget: this.budget.daily,
      });

      void this.auditLogger.log('cost:budget_exceeded', 'core', 'system', {
        type: 'daily',
        current: summary.daily,
        budget: this.budget.daily,
      });
    }

    // Weekly checks
    if (summary.weekly > this.budget.weekly * 0.8 && summary.weekly <= this.budget.weekly) {
      this.eventBus.emit('cost:budget_warning', {
        type: 'weekly',
        current: summary.weekly,
        budget: this.budget.weekly,
        percentage: (summary.weekly / this.budget.weekly) * 100,
      });
    }

    if (summary.weekly > this.budget.weekly) {
      this.eventBus.emit('cost:budget_exceeded', {
        type: 'weekly',
        current: summary.weekly,
        budget: this.budget.weekly,
      });
    }

    // Monthly checks
    if (summary.monthly > this.budget.monthly * 0.8 && summary.monthly <= this.budget.monthly) {
      this.eventBus.emit('cost:budget_warning', {
        type: 'monthly',
        current: summary.monthly,
        budget: this.budget.monthly,
        percentage: (summary.monthly / this.budget.monthly) * 100,
      });
    }

    if (summary.monthly > this.budget.monthly) {
      this.eventBus.emit('cost:budget_exceeded', {
        type: 'monthly',
        current: summary.monthly,
        budget: this.budget.monthly,
      });
    }
  }

  /**
   * Set budget.
   */
  setBudget(budget: Partial<Budget>): void {
    this.budget = { ...this.budget, ...budget };
  }

  /**
   * Get current budget.
   */
  getBudget(): Budget {
    return { ...this.budget };
  }

  /**
   * Get entries with optional filter.
   */
  getEntries(filter?: {
    agent?: AgentId;
    operation?: string;
    model?: string;
    since?: Date;
    until?: Date;
  }): CostEntry[] {
    let results = [...this.entries];

    if (filter?.agent) {
      results = results.filter(e => e.agent === filter.agent);
    }
    if (filter?.operation) {
      results = results.filter(e => e.operation === filter.operation);
    }
    if (filter?.model) {
      results = results.filter(e => e.model === filter.model);
    }
    if (filter?.since) {
      results = results.filter(e => e.timestamp >= filter.since!);
    }
    if (filter?.until) {
      results = results.filter(e => e.timestamp <= filter.until!);
    }

    return results;
  }

  /**
   * Get total cost for a time period.
   */
  getTotalCost(since?: Date, until?: Date): number {
    return this.getEntries({ since, until }).reduce((sum, e) => sum + e.cost, 0);
  }

  /**
   * Get cost by model for analysis.
   */
  getCostByModel(): Record<string, { cost: number; tokens: number; calls: number }> {
    const result: Record<string, { cost: number; tokens: number; calls: number }> = {};

    for (const entry of this.entries) {
      if (!result[entry.model]) {
        result[entry.model] = { cost: 0, tokens: 0, calls: 0 };
      }
      result[entry.model].cost += entry.cost;
      result[entry.model].tokens += entry.inputTokens + entry.outputTokens;
      result[entry.model].calls++;
    }

    return result;
  }

  /**
   * Get cost by agent for analysis.
   */
  getCostByAgent(): Record<string, { cost: number; calls: number; avgCostPerCall: number }> {
    const result: Record<string, { cost: number; calls: number; avgCostPerCall: number }> = {};

    for (const entry of this.entries) {
      if (!result[entry.agent]) {
        result[entry.agent] = { cost: 0, calls: 0, avgCostPerCall: 0 };
      }
      result[entry.agent].cost += entry.cost;
      result[entry.agent].calls++;
    }

    // Calculate averages
    for (const agent in result) {
      result[agent].avgCostPerCall = result[agent].cost / result[agent].calls;
    }

    return result;
  }

  /**
   * Estimate cost for planned operations.
   */
  estimateCost(model: string, estimatedInputTokens: number, estimatedOutputTokens: number): number {
    return this.calculateCost(model, estimatedInputTokens, estimatedOutputTokens);
  }

  /**
   * Get budget utilization percentages.
   */
  getBudgetUtilization(): {
    daily: number;
    weekly: number;
    monthly: number;
  } {
    const summary = this.getSummary();
    return {
      daily: (summary.daily / this.budget.daily) * 100,
      weekly: (summary.weekly / this.budget.weekly) * 100,
      monthly: (summary.monthly / this.budget.monthly) * 100,
    };
  }

  /**
   * Clear old entries to manage memory.
   */
  clearOldEntries(maxAgeMs: number = 90 * 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    const originalLength = this.entries.length;
    this.entries = this.entries.filter(e => now - e.timestamp.getTime() < maxAgeMs);
    return originalLength - this.entries.length;
  }

  /**
   * Get statistics.
   */
  getStats(): {
    totalEntries: number;
    totalCost: number;
    avgCostPerEntry: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const totalCost = this.entries.reduce((sum, e) => sum + e.cost, 0);
    const sortedByTime = [...this.entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      totalEntries: this.entries.length,
      totalCost,
      avgCostPerEntry: this.entries.length > 0 ? totalCost / this.entries.length : 0,
      oldestEntry: sortedByTime.length > 0 ? sortedByTime[0].timestamp : null,
      newestEntry: sortedByTime.length > 0 ? sortedByTime[sortedByTime.length - 1].timestamp : null,
    };
  }
}
