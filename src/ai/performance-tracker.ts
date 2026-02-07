/**
 * Performance Tracker — Adaptive Model Intelligence
 *
 * Tracks per-model, per-category performance metrics and provides
 * data-driven recommendations for model selection.
 *
 * Features:
 * - Subscribes to llm:request_complete EventBus events
 * - Per-model, per-category quality/speed/reliability/cost tracking
 * - Weighted scoring for model recommendations
 * - Persistent storage at ~/.ari/model-performance.json with atomic writes
 *
 * @module ai/performance-tracker
 */

import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import type { EventBus } from '../kernel/event-bus.js';
import type { ModelTier } from './types.js';
import { ModelTierSchema } from './types.js';
import { createLogger } from '../kernel/logger.js';

const logger = createLogger('performance-tracker');

// =============================================================================
// Constants
// =============================================================================

const ARI_DIR = path.join(homedir(), '.ari');
const PERFORMANCE_PATH = path.join(ARI_DIR, 'model-performance.json');

// =============================================================================
// Types
// =============================================================================

export interface CategoryPerformance {
  model: ModelTier;
  category: string;
  avgQuality: number;
  avgLatencyMs: number;
  errorRate: number;
  totalCalls: number;
  totalCost: number;
  lastUsed: Date;
}

export interface PerformanceStats {
  model?: string;
  categories: CategoryPerformance[];
  overallAvgQuality: number;
  overallAvgLatency: number;
  overallErrorRate: number;
  totalCalls: number;
  totalCost: number;
}

interface MetricEntry {
  model: ModelTier;
  category: string;
  qualitySum: number;
  latencySum: number;
  errorCount: number;
  successCount: number;
  totalCalls: number;
  totalCost: number;
  lastUsed: string;
}

interface PerformanceData {
  version: string;
  lastUpdated: string;
  metrics: MetricEntry[];
}

// =============================================================================
// Performance Tracker
// =============================================================================

export class PerformanceTracker {
  private eventBus: EventBus;
  private data: PerformanceData;
  private readonly persistPath: string;

  constructor(eventBus: EventBus, options?: { persistPath?: string }) {
    this.eventBus = eventBus;
    this.persistPath = options?.persistPath ?? PERFORMANCE_PATH;
    this.data = this.loadData();

    this.eventBus.on('llm:request_complete', this.handleLLMRequestComplete.bind(this));
  }

  /**
   * Load performance data from disk (sync for constructor).
   */
  private loadData(): PerformanceData {
    if (!existsSync(this.persistPath)) {
      return { version: '1.0.0', lastUpdated: new Date().toISOString(), metrics: [] };
    }

    try {
      const raw = readFileSync(this.persistPath, 'utf-8');
      const parsed = JSON.parse(raw) as PerformanceData;

      if (parsed.version !== '1.0.0') {
        return { version: '1.0.0', lastUpdated: new Date().toISOString(), metrics: [] };
      }

      return parsed;
    } catch {
      return { version: '1.0.0', lastUpdated: new Date().toISOString(), metrics: [] };
    }
  }

  /**
   * Persist data with atomic write (tmp + rename).
   */
  private async persist(): Promise<void> {
    try {
      const dir = path.dirname(this.persistPath);
      await fs.mkdir(dir, { recursive: true });

      this.data.lastUpdated = new Date().toISOString();
      const json = JSON.stringify(this.data, null, 2);

      // Atomic write: temp file → rename
      const tmpPath = `${this.persistPath}.tmp`;
      await fs.writeFile(tmpPath, json, 'utf-8');
      try {
        await fs.rename(tmpPath, this.persistPath);
      } catch {
        // Rename can fail if path was deleted between write and rename (tests).
        // Fall back to direct write.
        await fs.writeFile(this.persistPath, json, 'utf-8');
      }
    } catch {
      // Persist is best-effort — system continues without it
    }
  }

  /**
   * Handle llm:request_complete — primary metric update point.
   */
  private handleLLMRequestComplete(payload: {
    timestamp: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    taskType: string;
    taskCategory?: string;
    duration: number;
    success: boolean;
  }): void {
    const modelResult = ModelTierSchema.safeParse(payload.model);
    if (!modelResult.success) return;

    const model = modelResult.data;
    const category = payload.taskCategory ?? payload.taskType ?? 'unknown';

    let metric = this.data.metrics.find(
      (m) => m.model === model && m.category === category,
    );

    if (!metric) {
      metric = {
        model,
        category,
        qualitySum: 0,
        latencySum: 0,
        errorCount: 0,
        successCount: 0,
        totalCalls: 0,
        totalCost: 0,
        lastUsed: payload.timestamp,
      };
      this.data.metrics.push(metric);
    }

    metric.totalCalls += 1;
    metric.latencySum += payload.duration;
    metric.totalCost += payload.cost;
    metric.lastUsed = payload.timestamp;

    if (payload.success) {
      metric.successCount += 1;
      metric.qualitySum += 0.8; // Default quality; updateQualityScore refines this
    } else {
      metric.errorCount += 1;
    }

    this.persist().catch((err) => {
      logger.error({ err }, 'Persist failed');
    });
  }

  /**
   * Update quality score for a specific model/category.
   */
  updateQualityScore(model: ModelTier, category: string, qualityScore: number): void {
    const metric = this.data.metrics.find(
      (m) => m.model === model && m.category === category,
    );

    if (metric && metric.successCount > 0) {
      // Replace last default 0.8 with actual quality
      metric.qualitySum = metric.qualitySum - 0.8 + qualityScore;
    }

    this.persist().catch((err) => {
      logger.error({ err }, 'Persist failed');
    });
  }

  /**
   * Get recommendation for best model for a given task category.
   *
   * Weighted scoring:
   * - Quality: 40%
   * - Speed: 30%
   * - Reliability: 20%
   * - Cost efficiency: 10%
   *
   * Falls back to 'claude-sonnet-4' if no data.
   */
  getRecommendation(category: string): ModelTier {
    const categoryMetrics = this.data.metrics.filter((m) => m.category === category);

    if (categoryMetrics.length === 0) return 'claude-sonnet-4';

    // Need at least 5 calls for a meaningful recommendation
    const viable = categoryMetrics.filter((m) => m.totalCalls >= 5);

    if (viable.length === 0) {
      const mostUsed = categoryMetrics.sort((a, b) => b.totalCalls - a.totalCalls)[0];
      return mostUsed.model;
    }

    const scored = viable.map((m) => {
      const avgQuality = m.successCount > 0 ? m.qualitySum / m.successCount : 0;
      const avgLatency = m.latencySum / m.totalCalls;
      const errorRate = m.errorCount / m.totalCalls;
      const avgCost = m.totalCost / m.totalCalls;

      const qualityNorm = avgQuality;
      const speedNorm = Math.max(0, 1 - avgLatency / 10000);
      const reliabilityNorm = 1 - errorRate;
      const costNorm = Math.max(0, 1 - avgCost / 0.1);

      const score =
        qualityNorm * 0.4 +
        speedNorm * 0.3 +
        reliabilityNorm * 0.2 +
        costNorm * 0.1;

      return { model: m.model, score };
    });

    const best = scored.sort((a, b) => b.score - a.score)[0];
    return best.model;
  }

  /**
   * Get performance stats for a specific model or all models.
   */
  getPerformanceStats(model?: string): PerformanceStats {
    let metrics = this.data.metrics;
    if (model) metrics = metrics.filter((m) => m.model === model);

    if (metrics.length === 0) {
      return {
        model,
        categories: [],
        overallAvgQuality: 0,
        overallAvgLatency: 0,
        overallErrorRate: 0,
        totalCalls: 0,
        totalCost: 0,
      };
    }

    let totalQualitySum = 0;
    let totalLatencySum = 0;
    let totalErrorCount = 0;
    let totalSuccessCount = 0;
    let totalCalls = 0;
    let totalCost = 0;

    const categories: CategoryPerformance[] = metrics.map((m) => {
      const avgQuality = m.successCount > 0 ? m.qualitySum / m.successCount : 0;
      const avgLatencyMs = m.latencySum / m.totalCalls;
      const errorRate = m.errorCount / m.totalCalls;

      totalQualitySum += m.qualitySum;
      totalLatencySum += m.latencySum;
      totalErrorCount += m.errorCount;
      totalSuccessCount += m.successCount;
      totalCalls += m.totalCalls;
      totalCost += m.totalCost;

      return {
        model: m.model,
        category: m.category,
        avgQuality,
        avgLatencyMs,
        errorRate,
        totalCalls: m.totalCalls,
        totalCost: m.totalCost,
        lastUsed: new Date(m.lastUsed),
      };
    });

    return {
      model,
      categories,
      overallAvgQuality: totalSuccessCount > 0 ? totalQualitySum / totalSuccessCount : 0,
      overallAvgLatency: totalCalls > 0 ? totalLatencySum / totalCalls : 0,
      overallErrorRate: totalCalls > 0 ? totalErrorCount / totalCalls : 0,
      totalCalls,
      totalCost,
    };
  }

  /**
   * Get top performing models sorted by weighted score.
   */
  getTopPerformers(limit: number = 5): Array<{
    model: ModelTier;
    score: number;
    avgQuality: number;
    avgLatency: number;
    errorRate: number;
    totalCalls: number;
  }> {
    const byModel = new Map<ModelTier, MetricEntry[]>();

    for (const metric of this.data.metrics) {
      if (!byModel.has(metric.model)) byModel.set(metric.model, []);
      byModel.get(metric.model)!.push(metric);
    }

    const scored = Array.from(byModel.entries()).map(([model, metrics]) => {
      let tQuality = 0, tLatency = 0, tError = 0, tSuccess = 0, tCalls = 0;
      for (const m of metrics) {
        tQuality += m.qualitySum;
        tLatency += m.latencySum;
        tError += m.errorCount;
        tSuccess += m.successCount;
        tCalls += m.totalCalls;
      }

      const avgQuality = tSuccess > 0 ? tQuality / tSuccess : 0;
      const avgLatency = tCalls > 0 ? tLatency / tCalls : 0;
      const errorRate = tCalls > 0 ? tError / tCalls : 0;

      const score =
        avgQuality * 0.5 +
        Math.max(0, 1 - avgLatency / 10000) * 0.3 +
        (1 - errorRate) * 0.2;

      return { model, score, avgQuality, avgLatency, errorRate, totalCalls: tCalls };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Clear all performance data.
   */
  async clear(): Promise<void> {
    this.data = { version: '1.0.0', lastUpdated: new Date().toISOString(), metrics: [] };
    await this.persist();
  }
}
