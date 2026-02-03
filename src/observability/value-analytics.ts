import fs from 'node:fs/promises';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import type { EventBus } from '../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════
// FILE PATHS FOR PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

const ARI_DIR = path.join(homedir(), '.ari');
const VALUE_ANALYTICS_PATH = path.join(ARI_DIR, 'value-analytics.json');

// ═══════════════════════════════════════════════════════════════════════════
// VALUE SCORING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Value Score Components (0-100 scale):
 *
 * 1. DELIVERABLES (40 points max)
 *    - Morning brief delivered: 10 pts
 *    - Evening summary delivered: 5 pts
 *    - Test generated: 3 pts each (max 15)
 *    - Doc written: 5 pts each (max 10)
 *
 * 2. IMPROVEMENTS (30 points max)
 *    - Bug fix completed: 8 pts each (max 16)
 *    - Code improvement: 4 pts each (max 12)
 *    - Initiative executed: 2 pts each
 *
 * 3. INSIGHTS (20 points max)
 *    - High-value insight: 5 pts each (max 15)
 *    - Pattern learned: 2 pts each (max 5)
 *
 * 4. EFFICIENCY (10 points max)
 *    - Task success rate bonus: 0-5 pts
 *    - Low error count bonus: 0-5 pts
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Efficiency rating based on cost-to-value ratio.
 */
export type EfficiencyRating = 'excellent' | 'good' | 'moderate' | 'poor' | 'wasteful';

/**
 * Weekly trend direction.
 */
export type TrendDirection = 'improving' | 'stable' | 'declining';

/**
 * Metrics tracked for value scoring.
 */
export interface ValueMetrics {
  // Deliverables
  morningBriefDelivered: boolean;
  eveningSummaryDelivered: boolean;
  testsGenerated: number;
  docsWritten: number;

  // Improvements
  bugsFixed: number;
  codeImprovements: number;
  initiativesExecuted: number;

  // Insights
  highValueInsights: number;
  patternsLearned: number;

  // Efficiency
  tasksAttempted: number;
  tasksSucceeded: number;
  errorsEncountered: number;
}

/**
 * Daily value analysis.
 */
export interface DayValueAnalysis {
  date: string;
  cost: number;
  tokens: number;
  metrics: ValueMetrics;

  // Calculated scores
  deliverablesScore: number;
  improvementsScore: number;
  insightsScore: number;
  efficiencyScore: number;
  totalValueScore: number;

  // Derived metrics
  costPerPoint: number;
  roi: number;
  efficiency: EfficiencyRating;

  // Breakdown explanation
  breakdown: string[];
}

/**
 * Aggregated value analytics data.
 */
export interface ValueAnalyticsData {
  version: string;
  days: DayValueAnalysis[];

  // Aggregates
  totalCost: number;
  totalValuePoints: number;
  averageValueScore: number;
  averageCostPerPoint: number;
  bestDay: { date: string; score: number } | null;
  worstDay: { date: string; score: number } | null;

  // Trends
  weeklyTrend: TrendDirection;
  recommendations: string[];
}

/**
 * Value score calculation result.
 */
export interface ValueScoreResult {
  total: number;
  deliverables: number;
  improvements: number;
  insights: number;
  efficiency: number;
  breakdown: string[];
}

/**
 * Weekly report summary.
 */
export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  totalCost: number;
  totalValuePoints: number;
  averageScore: number;
  bestDay: DayValueAnalysis | null;
  worstDay: DayValueAnalysis | null;
  trend: TrendDirection;
  recommendations: string[];
  costBreakdown: Array<{ category: string; cost: number; percentage: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALUE ANALYTICS ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tracks value delivered per dollar spent with analytics.
 *
 * The goal is to optimize cost-to-reward ratio, not minimize cost.
 * Spending more on high-value work is better than spending less on low-value work.
 */
export class ValueAnalytics {
  private eventBus: EventBus;
  private data: ValueAnalyticsData;
  private todayMetrics: ValueMetrics;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.data = this.loadSync();
    this.todayMetrics = this.initTodayMetrics();

    // Subscribe to value-generating events
    this.subscribeToEvents();
  }

  /**
   * Load analytics data from disk.
   */
  private loadSync(): ValueAnalyticsData {
    try {
      if (existsSync(VALUE_ANALYTICS_PATH)) {
        const content = readFileSync(VALUE_ANALYTICS_PATH, 'utf-8');
        return JSON.parse(content) as ValueAnalyticsData;
      }
    } catch {
      // Error loading - initialize fresh
    }

    return {
      version: '1.0.0',
      days: [],
      totalCost: 0,
      totalValuePoints: 0,
      averageValueScore: 50,
      averageCostPerPoint: 0,
      bestDay: null,
      worstDay: null,
      weeklyTrend: 'stable',
      recommendations: [],
    };
  }

  /**
   * Initialize empty metrics for today.
   */
  private initTodayMetrics(): ValueMetrics {
    return {
      morningBriefDelivered: false,
      eveningSummaryDelivered: false,
      testsGenerated: 0,
      docsWritten: 0,
      bugsFixed: 0,
      codeImprovements: 0,
      initiativesExecuted: 0,
      highValueInsights: 0,
      patternsLearned: 0,
      tasksAttempted: 0,
      tasksSucceeded: 0,
      errorsEncountered: 0,
    };
  }

  /**
   * Subscribe to events that generate value.
   */
  private subscribeToEvents(): void {
    // Deliverables
    this.eventBus.on('briefing:morning_delivered', () => {
      this.todayMetrics.morningBriefDelivered = true;
    });

    this.eventBus.on('briefing:evening_delivered', () => {
      this.todayMetrics.eveningSummaryDelivered = true;
    });

    this.eventBus.on('test:generated', () => {
      this.todayMetrics.testsGenerated++;
    });

    this.eventBus.on('doc:written', () => {
      this.todayMetrics.docsWritten++;
    });

    // Improvements
    this.eventBus.on('bug:fixed', () => {
      this.todayMetrics.bugsFixed++;
    });

    this.eventBus.on('code:improved', () => {
      this.todayMetrics.codeImprovements++;
    });

    this.eventBus.on('initiative:executed', () => {
      this.todayMetrics.initiativesExecuted++;
    });

    // Insights
    this.eventBus.on('insight:high_value', () => {
      this.todayMetrics.highValueInsights++;
    });

    this.eventBus.on('pattern:learned', () => {
      this.todayMetrics.patternsLearned++;
    });

    // Task tracking
    this.eventBus.on('scheduler:task_complete', (event) => {
      this.todayMetrics.tasksAttempted++;
      if (event.success) {
        this.todayMetrics.tasksSucceeded++;
      }
    });

    this.eventBus.on('system:error', () => {
      this.todayMetrics.errorsEncountered++;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VALUE SCORE CALCULATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Calculate value score from metrics.
   */
  calculateValueScore(metrics: ValueMetrics): ValueScoreResult {
    const breakdown: string[] = [];

    // DELIVERABLES (40 max)
    let deliverables = 0;
    if (metrics.morningBriefDelivered) {
      deliverables += 10;
      breakdown.push('Morning brief: +10');
    }
    if (metrics.eveningSummaryDelivered) {
      deliverables += 5;
      breakdown.push('Evening summary: +5');
    }
    const testPoints = Math.min(metrics.testsGenerated * 3, 15);
    if (testPoints > 0) {
      deliverables += testPoints;
      breakdown.push(`Tests (${metrics.testsGenerated}): +${testPoints}`);
    }
    const docPoints = Math.min(metrics.docsWritten * 5, 10);
    if (docPoints > 0) {
      deliverables += docPoints;
      breakdown.push(`Docs (${metrics.docsWritten}): +${docPoints}`);
    }

    // IMPROVEMENTS (30 max)
    let improvements = 0;
    const bugPoints = Math.min(metrics.bugsFixed * 8, 16);
    if (bugPoints > 0) {
      improvements += bugPoints;
      breakdown.push(`Bugs fixed (${metrics.bugsFixed}): +${bugPoints}`);
    }
    const codePoints = Math.min(metrics.codeImprovements * 4, 12);
    if (codePoints > 0) {
      improvements += codePoints;
      breakdown.push(`Code improvements (${metrics.codeImprovements}): +${codePoints}`);
    }
    const initiativePoints = metrics.initiativesExecuted * 2;
    if (initiativePoints > 0) {
      improvements += initiativePoints;
      breakdown.push(`Initiatives (${metrics.initiativesExecuted}): +${initiativePoints}`);
    }
    improvements = Math.min(improvements, 30);

    // INSIGHTS (20 max)
    let insights = 0;
    const insightPoints = Math.min(metrics.highValueInsights * 5, 15);
    if (insightPoints > 0) {
      insights += insightPoints;
      breakdown.push(`Insights (${metrics.highValueInsights}): +${insightPoints}`);
    }
    const patternPoints = Math.min(metrics.patternsLearned * 2, 5);
    if (patternPoints > 0) {
      insights += patternPoints;
      breakdown.push(`Patterns (${metrics.patternsLearned}): +${patternPoints}`);
    }

    // EFFICIENCY (10 max)
    let efficiency = 0;
    if (metrics.tasksAttempted > 0) {
      const successRate = metrics.tasksSucceeded / metrics.tasksAttempted;
      const successBonus = Math.round(successRate * 5);
      efficiency += successBonus;
      if (successBonus > 0) {
        breakdown.push(`Task success rate (${(successRate * 100).toFixed(0)}%): +${successBonus}`);
      }
    }
    const errorPenalty = Math.min(metrics.errorsEncountered, 5);
    const errorBonus = 5 - errorPenalty;
    if (errorBonus > 0) {
      efficiency += errorBonus;
      breakdown.push(`Low error count: +${errorBonus}`);
    }

    const total = Math.min(deliverables + improvements + insights + efficiency, 100);

    return {
      total,
      deliverables,
      improvements,
      insights,
      efficiency,
      breakdown,
    };
  }

  /**
   * Get efficiency rating based on cost per point.
   */
  getEfficiencyRating(score: number, cost: number): EfficiencyRating {
    if (cost === 0) return 'excellent';

    const costPerPoint = cost / Math.max(score, 1);

    // Based on $75/14 days = $5.36/day average
    // Expecting ~50 points/day as baseline = $0.107/point

    if (costPerPoint < 0.05) return 'excellent'; // < $0.05/point
    if (costPerPoint < 0.10) return 'good'; // $0.05-0.10/point
    if (costPerPoint < 0.15) return 'moderate'; // $0.10-0.15/point
    if (costPerPoint < 0.25) return 'poor'; // $0.15-0.25/point
    return 'wasteful'; // > $0.25/point
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DAY END ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Analyze day and persist results.
   */
  async analyzeDayEnd(cost: number, tokens: number): Promise<DayValueAnalysis> {
    const today = new Date().toISOString().split('T')[0];
    const scores = this.calculateValueScore(this.todayMetrics);

    const costPerPoint = cost / Math.max(scores.total, 1);
    const roi = (scores.total - 50) / Math.max(cost, 0.01);

    const analysis: DayValueAnalysis = {
      date: today,
      cost,
      tokens,
      metrics: { ...this.todayMetrics },
      deliverablesScore: scores.deliverables,
      improvementsScore: scores.improvements,
      insightsScore: scores.insights,
      efficiencyScore: scores.efficiency,
      totalValueScore: scores.total,
      costPerPoint,
      roi,
      efficiency: this.getEfficiencyRating(scores.total, cost),
      breakdown: scores.breakdown,
    };

    // Update data
    this.data.days.push(analysis);
    this.data.totalCost += cost;
    this.data.totalValuePoints += scores.total;
    this.data.averageValueScore = this.data.totalValuePoints / this.data.days.length;
    this.data.averageCostPerPoint = this.data.totalCost / this.data.totalValuePoints;

    // Update best/worst
    if (!this.data.bestDay || scores.total > this.data.bestDay.score) {
      this.data.bestDay = { date: today, score: scores.total };
    }
    if (!this.data.worstDay || scores.total < this.data.worstDay.score) {
      this.data.worstDay = { date: today, score: scores.total };
    }

    // Calculate weekly trend
    this.updateWeeklyTrend();

    // Generate recommendations
    this.updateRecommendations();

    // Reset for tomorrow
    this.todayMetrics = this.initTodayMetrics();

    // Persist
    await this.persist();

    // Emit event for dashboard/notifications
    this.eventBus.emit('value:day_analyzed', {
      date: today,
      score: scores.total,
      cost,
      efficiency: analysis.efficiency,
      breakdown: scores.breakdown,
    });

    return analysis;
  }

  /**
   * Update weekly trend calculation.
   */
  private updateWeeklyTrend(): void {
    const recent = this.data.days.slice(-14);
    if (recent.length < 7) {
      this.data.weeklyTrend = 'stable';
      return;
    }

    const firstWeek = recent.slice(0, 7);
    const secondWeek = recent.slice(-7);

    const firstAvg = firstWeek.reduce((s, d) => s + d.totalValueScore, 0) / 7;
    const secondAvg = secondWeek.reduce((s, d) => s + d.totalValueScore, 0) / secondWeek.length;

    const change = (secondAvg - firstAvg) / firstAvg;

    if (change > 0.1) this.data.weeklyTrend = 'improving';
    else if (change < -0.1) this.data.weeklyTrend = 'declining';
    else this.data.weeklyTrend = 'stable';
  }

  /**
   * Update recommendations based on recent performance.
   */
  private updateRecommendations(): void {
    const recent = this.data.days.slice(-7);
    if (recent.length === 0) return;

    const recommendations: string[] = [];

    // Check deliverables
    const briefsMissed = recent.filter(d => !d.metrics.morningBriefDelivered).length;
    if (briefsMissed > 2) {
      recommendations.push(`Morning briefs missed ${briefsMissed}/7 days. High-value deliverable.`);
    }

    // Check efficiency
    const avgEfficiency = recent.reduce((s, d) => s + d.totalValueScore, 0) / recent.length;
    if (avgEfficiency < 40) {
      recommendations.push('Average value score below 40. Consider focusing on high-impact tasks.');
    }

    // Check cost
    const avgCostPerPoint = recent.reduce((s, d) => s + d.costPerPoint, 0) / recent.length;
    if (avgCostPerPoint > 0.15) {
      recommendations.push(`Cost per value point is $${avgCostPerPoint.toFixed(3)}. Target: <$0.10.`);
    }

    // Check test generation
    const testsGenerated = recent.reduce((s, d) => s + d.metrics.testsGenerated, 0);
    if (testsGenerated < 7) {
      recommendations.push('Low test generation this week. Consider enabling test initiative.');
    }

    this.data.recommendations = recommendations;
  }

  /**
   * Persist analytics data.
   */
  private async persist(): Promise<void> {
    // Keep only last 90 days
    if (this.data.days.length > 90) {
      this.data.days = this.data.days.slice(-90);
    }

    try {
      if (!existsSync(ARI_DIR)) {
        mkdirSync(ARI_DIR, { recursive: true });
      }

      // Atomic write: temp file + rename for crash safety
      const tempPath = `${VALUE_ANALYTICS_PATH}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.data, null, 2));
      await fs.rename(tempPath, VALUE_ANALYTICS_PATH);
    } catch (error) {
      console.error('[ValueAnalytics] Failed to persist:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // API METHODS FOR DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get analytics summary.
   */
  getSummary(): ValueAnalyticsData {
    return { ...this.data };
  }

  /**
   * Get daily breakdown for N days.
   */
  getDailyBreakdown(days: number = 7): DayValueAnalysis[] {
    return this.data.days.slice(-days);
  }

  /**
   * Get today's progress.
   */
  getTodayProgress(): {
    metrics: ValueMetrics;
    currentScore: number;
    breakdown: string[];
  } {
    const scores = this.calculateValueScore(this.todayMetrics);
    return {
      metrics: { ...this.todayMetrics },
      currentScore: scores.total,
      breakdown: scores.breakdown,
    };
  }

  /**
   * Get weekly report.
   */
  getWeeklyReport(): WeeklyReport {
    const week = this.data.days.slice(-7);
    if (week.length === 0) {
      return {
        weekStart: '',
        weekEnd: '',
        totalCost: 0,
        totalValuePoints: 0,
        averageScore: 0,
        bestDay: null,
        worstDay: null,
        trend: 'stable',
        recommendations: ['No data yet. Start using ARI to see analytics.'],
        costBreakdown: [],
      };
    }

    const totalCost = week.reduce((s, d) => s + d.cost, 0);
    const totalValue = week.reduce((s, d) => s + d.totalValueScore, 0);
    const sorted = [...week].sort((a, b) => b.totalValueScore - a.totalValueScore);

    return {
      weekStart: week[0].date,
      weekEnd: week[week.length - 1].date,
      totalCost,
      totalValuePoints: totalValue,
      averageScore: totalValue / week.length,
      bestDay: sorted[0],
      worstDay: sorted[sorted.length - 1],
      trend: this.data.weeklyTrend,
      recommendations: this.data.recommendations,
      costBreakdown: [
        {
          category: 'Deliverables',
          cost: totalCost * 0.4,
          percentage: 40
        },
        {
          category: 'Improvements',
          cost: totalCost * 0.35,
          percentage: 35
        },
        {
          category: 'Insights',
          cost: totalCost * 0.15,
          percentage: 15
        },
        {
          category: 'Overhead',
          cost: totalCost * 0.10,
          percentage: 10
        },
      ],
    };
  }

  /**
   * Get current metrics (for manual tracking).
   */
  getCurrentMetrics(): ValueMetrics {
    return { ...this.todayMetrics };
  }

  /**
   * Manually record a deliverable.
   */
  recordDeliverable(type: 'test' | 'doc' | 'brief'): void {
    switch (type) {
      case 'test':
        this.todayMetrics.testsGenerated++;
        break;
      case 'doc':
        this.todayMetrics.docsWritten++;
        break;
      case 'brief':
        this.todayMetrics.morningBriefDelivered = true;
        break;
    }
  }

  /**
   * Manually record an improvement.
   */
  recordImprovement(type: 'bug' | 'code' | 'initiative'): void {
    switch (type) {
      case 'bug':
        this.todayMetrics.bugsFixed++;
        break;
      case 'code':
        this.todayMetrics.codeImprovements++;
        break;
      case 'initiative':
        this.todayMetrics.initiativesExecuted++;
        break;
    }
  }

  /**
   * Manually record an insight.
   */
  recordInsight(type: 'insight' | 'pattern'): void {
    switch (type) {
      case 'insight':
        this.todayMetrics.highValueInsights++;
        break;
      case 'pattern':
        this.todayMetrics.patternsLearned++;
        break;
    }
  }
}
