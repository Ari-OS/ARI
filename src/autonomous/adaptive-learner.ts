import fs from 'node:fs/promises';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('adaptive-learner');

// ═══════════════════════════════════════════════════════════════════════════
// FILE PATHS FOR PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

const ARI_DIR = path.join(homedir(), '.ari');
const ADAPTIVE_LEARNING_PATH = path.join(ARI_DIR, 'adaptive-learning.json');

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Types of usage patterns we can learn.
 */
export type PatternType =
  | 'peak_activity_hours'
  | 'preferred_model'
  | 'initiative_preference'
  | 'notification_response'
  | 'budget_behavior'
  | 'task_preference'
  | 'day_of_week';

/**
 * A learned usage pattern.
 */
export interface UsagePattern {
  id: string;
  patternType: PatternType;
  observations: number;
  confidence: number; // 0-1
  lastObserved: string;
  data: Record<string, unknown>;
  appliedCount: number;
  successCount: number;
  failureCount: number;
}

/**
 * Weekly summary for learning.
 */
export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  peakHours: number[];
  avgDailySpend: number;
  avgDailyValue: number;
  preferredModels: Record<string, string>;
  approvedInitiativeTypes: string[];
  rejectedInitiativeTypes: string[];
  adjustmentsMade: string[];
}

/**
 * Active recommendation from adaptive learning.
 */
export interface AdaptiveRecommendation {
  id: string;
  type: string;
  recommendation: string;
  confidence: number;
  appliedAt?: string;
  result?: 'success' | 'failure' | 'pending';
}

/**
 * Full adaptive learning data structure.
 */
export interface AdaptiveLearningData {
  version: string;
  patterns: UsagePattern[];
  weeklySummaries: WeeklySummary[];
  activeRecommendations: AdaptiveRecommendation[];
}

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTIVE LEARNER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Learns from week-to-week usage patterns and automatically adjusts behavior.
 *
 * Features:
 * - Peak activity hour detection
 * - Model preference learning
 * - Initiative approval pattern recognition
 * - Notification response tracking
 * - Budget behavior patterns
 */
export class AdaptiveLearner {
  private eventBus: EventBus;
  private data: AdaptiveLearningData;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.data = this.loadSync();
    this.subscribeToEvents();
  }

  /**
   * Load learning data from disk.
   */
  private loadSync(): AdaptiveLearningData {
    try {
      if (existsSync(ADAPTIVE_LEARNING_PATH)) {
        const content = readFileSync(ADAPTIVE_LEARNING_PATH, 'utf-8');
        return JSON.parse(content) as AdaptiveLearningData;
      }
    } catch {
      // Error loading - initialize fresh
    }

    return {
      version: '1.0.0',
      patterns: [],
      weeklySummaries: [],
      activeRecommendations: [],
    };
  }

  /**
   * Subscribe to events for learning.
   */
  private subscribeToEvents(): void {
    // Learn from user interactions
    this.eventBus.on('user:active', (event) => {
      this.learnActivityPattern(event.hour);
    });

    // Learn from model selection outcomes
    this.eventBus.on('model:selected', (event) => {
      this.learnModelPreference(event.taskType, event.model, event.success);
    });

    // Learn from initiative approvals/rejections
    this.eventBus.on('approval:approved', (event) => {
      this.learnInitiativePreference(event.type, true);
    });

    this.eventBus.on('approval:rejected', (event) => {
      this.learnInitiativePreference(event.type, false);
    });

    // Learn from notification responses
    this.eventBus.on('notification:response', (event) => {
      this.learnNotificationPreference(event.category, event.priority, event.response);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PATTERN LEARNING
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get or create a pattern by type and ID.
   */
  private getOrCreatePattern(type: PatternType, id: string): UsagePattern {
    let pattern = this.data.patterns.find(p => p.id === id && p.patternType === type);

    if (!pattern) {
      pattern = {
        id,
        patternType: type,
        observations: 0,
        confidence: 0.5,
        lastObserved: new Date().toISOString(),
        data: {},
        appliedCount: 0,
        successCount: 0,
        failureCount: 0,
      };
      this.data.patterns.push(pattern);
    }

    return pattern;
  }

  /**
   * Learn when user is most active.
   */
  private learnActivityPattern(hour: number): void {
    const pattern = this.getOrCreatePattern('peak_activity_hours', 'hourly_activity');

    // Initialize hourly counts
    if (!pattern.data.hours) {
      pattern.data.hours = new Array(24).fill(0);
    }

    (pattern.data.hours as number[])[hour]++;
    pattern.observations++;
    pattern.lastObserved = new Date().toISOString();

    // Recalculate confidence based on data consistency
    const hours = pattern.data.hours as number[];
    const max = Math.max(...hours);
    const total = hours.reduce((a, b) => a + b, 0);
    pattern.confidence = total > 0 ? max / total : 0;

    void this.persist();
  }

  /**
   * Learn which models work best for which task types.
   */
  private learnModelPreference(taskType: string, model: string, success: boolean): void {
    const pattern = this.getOrCreatePattern('preferred_model', `model_${taskType}`);

    if (!pattern.data.models) {
      pattern.data.models = {};
    }

    const models = pattern.data.models as Record<string, { success: number; failure: number }>;
    if (!models[model]) {
      models[model] = { success: 0, failure: 0 };
    }

    if (success) {
      models[model].success++;
    } else {
      models[model].failure++;
    }

    pattern.observations++;
    pattern.lastObserved = new Date().toISOString();

    // Calculate confidence based on best model's success rate
    let bestModel = '';
    let bestRate = 0;
    for (const [m, stats] of Object.entries(models)) {
      const rate = stats.success / (stats.success + stats.failure + 1);
      if (rate > bestRate) {
        bestRate = rate;
        bestModel = m;
      }
    }

    pattern.data.bestModel = bestModel;
    pattern.confidence = bestRate;

    void this.persist();
  }

  /**
   * Learn which initiative types user approves/rejects.
   */
  private learnInitiativePreference(initiativeType: string, approved: boolean): void {
    const pattern = this.getOrCreatePattern('initiative_preference', `init_${initiativeType}`);

    if (!pattern.data.approved) pattern.data.approved = 0;
    if (!pattern.data.rejected) pattern.data.rejected = 0;

    if (approved) {
      (pattern.data.approved as number)++;
    } else {
      (pattern.data.rejected as number)++;
    }

    pattern.observations++;
    pattern.lastObserved = new Date().toISOString();

    const approved_n = pattern.data.approved as number;
    const rejected_n = pattern.data.rejected as number;
    pattern.confidence = (approved_n + rejected_n) > 0
      ? approved_n / (approved_n + rejected_n)
      : 0.5;

    void this.persist();
  }

  /**
   * Learn notification preferences based on responses.
   */
  private learnNotificationPreference(
    category: string,
    priority: string,
    response: 'opened' | 'dismissed' | 'ignored'
  ): void {
    const pattern = this.getOrCreatePattern(
      'notification_response',
      `notif_${category}_${priority}`
    );

    if (!pattern.data.responses) {
      pattern.data.responses = { opened: 0, dismissed: 0, ignored: 0 };
    }

    const responses = pattern.data.responses as Record<string, number>;
    responses[response]++;

    pattern.observations++;
    pattern.lastObserved = new Date().toISOString();

    // Higher confidence if user consistently engages
    const total = responses.opened + responses.dismissed + responses.ignored;
    pattern.confidence = total > 0 ? responses.opened / total : 0.5;

    void this.persist();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PATTERN APPLICATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get optimal model for a task type based on learned patterns.
   */
  getOptimalModelForTask(taskType: string): { model: string; confidence: number } | null {
    const pattern = this.data.patterns.find(
      p => p.id === `model_${taskType}` && p.patternType === 'preferred_model'
    );

    if (!pattern || pattern.observations < 5) return null;
    if (pattern.confidence < 0.6) return null;

    return {
      model: pattern.data.bestModel as string,
      confidence: pattern.confidence,
    };
  }

  /**
   * Determine if an initiative type should be auto-approved.
   */
  shouldAutoApproveInitiative(type: string): { autoApprove: boolean; confidence: number } {
    const pattern = this.data.patterns.find(
      p => p.id === `init_${type}` && p.patternType === 'initiative_preference'
    );

    if (!pattern || pattern.observations < 10) {
      return { autoApprove: false, confidence: 0 };
    }

    // Auto-approve if >80% historically approved with high confidence
    const autoApprove = pattern.confidence > 0.80;

    return { autoApprove, confidence: pattern.confidence };
  }

  /**
   * Get peak activity hours based on learned patterns.
   */
  getPeakActivityHours(): number[] {
    const pattern = this.data.patterns.find(
      p => p.id === 'hourly_activity' && p.patternType === 'peak_activity_hours'
    );

    if (!pattern || pattern.observations < 50) {
      // Default business hours
      return [9, 10, 11, 14, 15, 16];
    }

    const hours = pattern.data.hours as number[];
    const avg = hours.reduce((a, b) => a + b, 0) / 24;

    // Return hours with above-average activity
    return hours
      .map((count, hour) => ({ hour, count }))
      .filter(h => h.count > avg * 1.2)
      .map(h => h.hour);
  }

  /**
   * Get notification priority adjustment based on learned preferences.
   */
  getNotificationPriorityAdjustment(
    category: string,
    currentPriority: string
  ): { adjustedPriority: string; reason: string } {
    const pattern = this.data.patterns.find(
      p => p.id === `notif_${category}_${currentPriority}` &&
           p.patternType === 'notification_response'
    );

    if (!pattern || pattern.observations < 10) {
      return { adjustedPriority: currentPriority, reason: 'Insufficient data' };
    }

    const responses = pattern.data.responses as Record<string, number>;
    const engagementRate = responses.opened / pattern.observations;

    // If user ignores this category/priority combo, reduce priority
    if (engagementRate < 0.2) {
      const lowerPriority = this.lowerPriority(currentPriority);
      return {
        adjustedPriority: lowerPriority,
        reason: `Low engagement (${(engagementRate * 100).toFixed(0)}%) - reducing priority`,
      };
    }

    // If user highly engages, consider raising priority
    if (engagementRate > 0.8) {
      const higherPriority = this.raisePriority(currentPriority);
      return {
        adjustedPriority: higherPriority,
        reason: `High engagement (${(engagementRate * 100).toFixed(0)}%) - raising priority`,
      };
    }

    return { adjustedPriority: currentPriority, reason: 'Engagement rate normal' };
  }

  private lowerPriority(p: string): string {
    const order = ['P0', 'P1', 'P2', 'P3', 'P4'];
    const idx = order.indexOf(p);
    return idx >= 0 ? order[Math.min(idx + 1, 4)] : p;
  }

  private raisePriority(p: string): string {
    const order = ['P0', 'P1', 'P2', 'P3', 'P4'];
    const idx = order.indexOf(p);
    return idx >= 0 ? order[Math.max(idx - 1, 0)] : p;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WEEKLY SUMMARY AND RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Generate weekly summary and recommendations.
   */
  async generateWeeklySummary(weekData: {
    avgDailySpend: number;
    avgDailyValue: number;
    approvedInitiatives: string[];
    rejectedInitiatives: string[];
  }): Promise<void> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const summary: WeeklySummary = {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: now.toISOString().split('T')[0],
      peakHours: this.getPeakActivityHours(),
      avgDailySpend: weekData.avgDailySpend,
      avgDailyValue: weekData.avgDailyValue,
      preferredModels: this.getPreferredModels(),
      approvedInitiativeTypes: weekData.approvedInitiatives,
      rejectedInitiativeTypes: weekData.rejectedInitiatives,
      adjustmentsMade: [],
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(weekData);
    this.data.activeRecommendations = recommendations;

    // Track high-confidence auto-applied recommendations
    for (const rec of recommendations.filter(r => r.confidence > 0.85)) {
      summary.adjustmentsMade.push(rec.recommendation);
    }

    this.data.weeklySummaries.push(summary);

    // Keep only last 12 weeks
    if (this.data.weeklySummaries.length > 12) {
      this.data.weeklySummaries = this.data.weeklySummaries.slice(-12);
    }

    await this.persist();

    this.eventBus.emit('adaptive:weekly_summary', {
      summary: summary as unknown as Record<string, unknown>,
      recommendations,
    });
  }

  /**
   * Get preferred models by task type.
   */
  private getPreferredModels(): Record<string, string> {
    const result: Record<string, string> = {};

    for (const pattern of this.data.patterns.filter(p => p.patternType === 'preferred_model')) {
      if (pattern.confidence > 0.6 && pattern.data.bestModel) {
        const taskType = pattern.id.replace('model_', '');
        result[taskType] = pattern.data.bestModel as string;
      }
    }

    return result;
  }

  /**
   * Generate recommendations based on learned patterns.
   */
  private generateRecommendations(weekData: {
    avgDailySpend: number;
    avgDailyValue: number;
  }): AdaptiveRecommendation[] {
    const recommendations: AdaptiveRecommendation[] = [];

    // Budget recommendation
    // $75/14 days = $5.36/day target
    const dailyTarget = 5.36;
    if (weekData.avgDailySpend > dailyTarget * 1.2) {
      recommendations.push({
        id: 'budget_reduce',
        type: 'budget',
        recommendation: 'Spending 20%+ above daily target. Consider switching to conservative profile.',
        confidence: 0.9,
      });
    } else if (weekData.avgDailySpend < dailyTarget * 0.6) {
      recommendations.push({
        id: 'budget_increase',
        type: 'budget',
        recommendation: 'Under-utilizing budget. Consider enabling more autonomous initiatives.',
        confidence: 0.7,
      });
    }

    // Value recommendation
    if (weekData.avgDailyValue < 40) {
      recommendations.push({
        id: 'value_low',
        type: 'value',
        recommendation: 'Average daily value score below 40. Focus on high-impact deliverables.',
        confidence: 0.85,
      });
    }

    // Model recommendations based on learned patterns
    const modelPatterns = this.data.patterns.filter(
      p => p.patternType === 'preferred_model' && p.confidence > 0.7
    );

    for (const pattern of modelPatterns) {
      const bestModel = String(pattern.data.bestModel);
      recommendations.push({
        id: `model_${pattern.id}`,
        type: 'model',
        recommendation: `Use ${bestModel} for ${pattern.id.replace('model_', '')} tasks (${(pattern.confidence * 100).toFixed(0)}% success rate)`,
        confidence: pattern.confidence,
      });
    }

    return recommendations;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Persist learning data to disk.
   */
  private async persist(): Promise<void> {
    try {
      if (!existsSync(ARI_DIR)) {
        mkdirSync(ARI_DIR, { recursive: true });
      }

      const tempPath = `${ADAPTIVE_LEARNING_PATH}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.data, null, 2));
      await fs.rename(tempPath, ADAPTIVE_LEARNING_PATH);
    } catch (error) {
      log.error({ err: error }, 'Failed to persist');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // API METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get all learned patterns.
   */
  getPatterns(): UsagePattern[] {
    return [...this.data.patterns];
  }

  /**
   * Get active recommendations.
   */
  getRecommendations(): AdaptiveRecommendation[] {
    return [...this.data.activeRecommendations];
  }

  /**
   * Get weekly summaries.
   */
  getWeeklySummaries(): WeeklySummary[] {
    return [...this.data.weeklySummaries];
  }

  /**
   * Get learning data summary for API.
   */
  getSummary(): {
    patternCount: number;
    weeklyCount: number;
    recommendationCount: number;
    topPatterns: Array<{ id: string; type: PatternType; confidence: number }>;
  } {
    const topPatterns = [...this.data.patterns]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .map(p => ({ id: p.id, type: p.patternType, confidence: p.confidence }));

    return {
      patternCount: this.data.patterns.length,
      weeklyCount: this.data.weeklySummaries.length,
      recommendationCount: this.data.activeRecommendations.length,
      topPatterns,
    };
  }

  /**
   * Record pattern application result.
   */
  recordPatternApplication(patternId: string, success: boolean): void {
    const pattern = this.data.patterns.find(p => p.id === patternId);
    if (!pattern) return;

    pattern.appliedCount++;
    if (success) {
      pattern.successCount++;
    } else {
      pattern.failureCount++;
    }

    // Adjust confidence based on application success
    if (pattern.appliedCount > 5) {
      const successRate = pattern.successCount / pattern.appliedCount;
      pattern.confidence = (pattern.confidence + successRate) / 2;
    }

    this.eventBus.emit('adaptive:pattern_applied', {
      patternId,
      result: success ? 'success' : 'failure',
    });

    void this.persist();
  }
}
