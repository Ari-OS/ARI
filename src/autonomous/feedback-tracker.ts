/**
 * FeedbackTracker — Tracks real feedback from Telegram thumbs-up/thumbs-down
 * buttons and implicit signals (viewed, ignored, dismissed).
 *
 * Storage: JSONL files at ~/.ari/feedback/ for simplicity.
 * Events: feedback:recorded, feedback:analysis_generated
 *
 * @module autonomous/feedback-tracker
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('feedback-tracker');

// =============================================================================
// TYPES
// =============================================================================

export interface ExplicitFeedback {
  messageId: string;
  userId: string;
  positive: boolean;
  context: string;
  category: string;
  createdAt: string;
}

export interface ImplicitSignal {
  feature: string;
  signal: 'viewed' | 'ignored' | 'dismissed';
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CategoryScore {
  positive: number;
  negative: number;
  score: number;
}

export interface FeedbackAnalysis {
  period: { start: string; end: string };
  totalFeedback: number;
  positiveRate: number;
  topPerformers: Array<{ category: string; score: number }>;
  underperformers: Array<{ category: string; score: number }>;
  suggestions: string[];
  implicitSignals: {
    mostEngaged: string[];
    leastEngaged: string[];
  };
}

// =============================================================================
// FEEDBACK TRACKER
// =============================================================================

export class FeedbackTracker {
  private eventBus: EventBus;
  private storagePath: string;
  private explicitPath: string;
  private implicitPath: string;

  constructor(params: {
    eventBus: EventBus;
    storagePath?: string;
  }) {
    this.eventBus = params.eventBus;
    this.storagePath = params.storagePath ?? path.join(homedir(), '.ari', 'feedback');
    this.explicitPath = path.join(this.storagePath, 'explicit.jsonl');
    this.implicitPath = path.join(this.storagePath, 'implicit.jsonl');
  }

  /**
   * Ensure the storage directory exists.
   */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.storagePath, { recursive: true });
  }

  /**
   * Record explicit feedback from Telegram buttons.
   */
  async recordFeedback(params: {
    messageId: string;
    userId: string;
    positive: boolean;
    context: string;
    category: string;
  }): Promise<void> {
    await this.ensureDir();

    const entry: ExplicitFeedback = {
      messageId: params.messageId,
      userId: params.userId,
      positive: params.positive,
      context: params.context,
      category: params.category,
      createdAt: new Date().toISOString(),
    };

    await fs.appendFile(this.explicitPath, JSON.stringify(entry) + '\n', 'utf-8');

    this.eventBus.emit('feedback:recorded', {
      messageId: params.messageId,
      userId: params.userId,
      positive: params.positive,
      category: params.category,
      timestamp: entry.createdAt,
    });

    log.info({ category: params.category, positive: params.positive }, 'Feedback recorded');
  }

  /**
   * Record an implicit signal (e.g., no engagement with a briefing section).
   */
  async recordImplicitSignal(params: {
    feature: string;
    signal: 'viewed' | 'ignored' | 'dismissed';
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.ensureDir();

    const entry: ImplicitSignal = {
      feature: params.feature,
      signal: params.signal,
      metadata: params.metadata,
      createdAt: new Date().toISOString(),
    };

    await fs.appendFile(this.implicitPath, JSON.stringify(entry) + '\n', 'utf-8');

    log.debug({ feature: params.feature, signal: params.signal }, 'Implicit signal recorded');
  }

  /**
   * Get feedback score for a specific category.
   */
  async getCategoryScore(category: string): Promise<CategoryScore> {
    const feedbacks = await this.loadExplicitFeedback();
    const categoryFeedbacks = feedbacks.filter(f => f.category === category);

    const positive = categoryFeedbacks.filter(f => f.positive).length;
    const negative = categoryFeedbacks.filter(f => !f.positive).length;
    const total = positive + negative;

    return {
      positive,
      negative,
      score: total > 0 ? positive / total : 0,
    };
  }

  /**
   * Get weekly analysis: which features are loved, which are ignored.
   */
  async getWeeklyAnalysis(): Promise<FeedbackAnalysis> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const allFeedback = await this.loadExplicitFeedback();
    const allSignals = await this.loadImplicitSignals();

    // Filter to last 7 days
    const weekFeedback = allFeedback.filter(
      f => new Date(f.createdAt) >= weekAgo
    );
    const weekSignals = allSignals.filter(
      s => new Date(s.createdAt) >= weekAgo
    );

    const totalFeedback = weekFeedback.length;
    const positiveCount = weekFeedback.filter(f => f.positive).length;
    const positiveRate = totalFeedback > 0 ? positiveCount / totalFeedback : 0;

    // Category scores
    const categoryMap = new Map<string, { positive: number; negative: number }>();
    for (const f of weekFeedback) {
      const entry = categoryMap.get(f.category) ?? { positive: 0, negative: 0 };
      if (f.positive) {
        entry.positive++;
      } else {
        entry.negative++;
      }
      categoryMap.set(f.category, entry);
    }

    const categoryScores: Array<{ category: string; score: number }> = [];
    for (const [category, counts] of categoryMap) {
      const total = counts.positive + counts.negative;
      categoryScores.push({
        category,
        score: total > 0 ? counts.positive / total : 0,
      });
    }

    categoryScores.sort((a, b) => b.score - a.score);

    const topPerformers = categoryScores.filter(c => c.score >= 0.6);
    const underperformers = categoryScores.filter(c => c.score < 0.4);

    // Implicit signal analysis
    const featureEngagement = new Map<string, { viewed: number; ignored: number; dismissed: number }>();
    for (const s of weekSignals) {
      const entry = featureEngagement.get(s.feature) ?? { viewed: 0, ignored: 0, dismissed: 0 };
      entry[s.signal]++;
      featureEngagement.set(s.feature, entry);
    }

    const engagementScores: Array<{ feature: string; score: number }> = [];
    for (const [feature, counts] of featureEngagement) {
      const total = counts.viewed + counts.ignored + counts.dismissed;
      const engageScore = total > 0 ? counts.viewed / total : 0;
      engagementScores.push({ feature, score: engageScore });
    }
    engagementScores.sort((a, b) => b.score - a.score);

    const mostEngaged = engagementScores
      .filter(e => e.score >= 0.5)
      .map(e => e.feature);
    const leastEngaged = engagementScores
      .filter(e => e.score < 0.3)
      .map(e => e.feature);

    // Generate suggestions
    const suggestions = this.generateSuggestions(underperformers, leastEngaged);

    const analysis: FeedbackAnalysis = {
      period: {
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      },
      totalFeedback,
      positiveRate,
      topPerformers,
      underperformers,
      suggestions,
      implicitSignals: {
        mostEngaged,
        leastEngaged,
      },
    };

    this.eventBus.emit('feedback:analysis_generated', {
      period: analysis.period,
      totalFeedback,
      positiveRate,
      timestamp: now.toISOString(),
    });

    return analysis;
  }

  // ─── Private Methods ──────────────────────────────────────────────────

  private generateSuggestions(
    underperformers: Array<{ category: string; score: number }>,
    leastEngaged: string[],
  ): string[] {
    const suggestions: string[] = [];

    for (const u of underperformers) {
      suggestions.push(
        `Category "${u.category}" has low satisfaction (${(u.score * 100).toFixed(0)}%). Consider revising format or content.`
      );
    }

    for (const feature of leastEngaged) {
      suggestions.push(
        `Feature "${feature}" is rarely engaged with. Consider removing or redesigning it.`
      );
    }

    if (suggestions.length === 0) {
      suggestions.push('All categories performing well. Continue current approach.');
    }

    return suggestions;
  }

  private async loadExplicitFeedback(): Promise<ExplicitFeedback[]> {
    try {
      const content = await fs.readFile(this.explicitPath, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line) as ExplicitFeedback);
    } catch {
      return [];
    }
  }

  private async loadImplicitSignals(): Promise<ImplicitSignal[]> {
    try {
      const content = await fs.readFile(this.implicitPath, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line) as ImplicitSignal);
    } catch {
      return [];
    }
  }
}
