/**
 * Behavioral Anomaly Detector for ARI.
 *
 * Uses a sliding window with 3-sigma detection to identify anomalous
 * metric values. Records baselines per metric and emits security events
 * when anomalies are detected.
 *
 * @module kernel/anomaly-detector
 */

import type { EventBus } from './event-bus.js';
import { createLogger } from './logger.js';

const log = createLogger('anomaly-detector');

const DEFAULT_WINDOW_SIZE = 1000;
const DEFAULT_THRESHOLD = 3.0;
const CRITICAL_THRESHOLD = 5.0;

export interface AnomalyResult {
  anomalous: boolean;
  zscore: number;
  mean: number;
  stddev: number;
  threshold: number;
}

export interface AnomalyEvent {
  metric: string;
  value: number;
  zscore: number;
  detectedAt: string;
  severity: 'warning' | 'critical';
}

export interface BaselineStats {
  mean: number;
  stddev: number;
  count: number;
  min: number;
  max: number;
}

interface MetricWindow {
  values: number[];
  sum: number;
  sumSquares: number;
}

export class AnomalyDetector {
  private readonly eventBus: EventBus;
  private readonly windowSize: number;
  private readonly threshold: number;
  private readonly metrics: Map<string, MetricWindow> = new Map();
  private readonly recentAnomalies: AnomalyEvent[] = [];

  constructor(eventBus: EventBus, windowSize?: number) {
    this.eventBus = eventBus;
    this.windowSize = windowSize ?? DEFAULT_WINDOW_SIZE;
    this.threshold = DEFAULT_THRESHOLD;
  }

  /**
   * Record a metric value into the sliding window.
   */
  record(metric: string, value: number): void {
    let window = this.metrics.get(metric);

    if (!window) {
      window = { values: [], sum: 0, sumSquares: 0 };
      this.metrics.set(metric, window);
    }

    // Add value
    window.values.push(value);
    window.sum += value;
    window.sumSquares += value * value;

    // Evict oldest if window is full
    if (window.values.length > this.windowSize) {
      const evicted = window.values.shift()!;
      window.sum -= evicted;
      window.sumSquares -= evicted * evicted;
    }

    // Check for anomaly after we have enough data (minimum 10 samples)
    if (window.values.length >= 10) {
      const result = this.isAnomalous(metric, value);
      if (result.anomalous) {
        const severity: 'warning' | 'critical' =
          Math.abs(result.zscore) >= CRITICAL_THRESHOLD ? 'critical' : 'warning';

        const event: AnomalyEvent = {
          metric,
          value,
          zscore: result.zscore,
          detectedAt: new Date().toISOString(),
          severity,
        };

        this.recentAnomalies.push(event);
        this.pruneOldAnomalies();

        log.warn(
          `Anomaly detected: ${metric} = ${value} (z-score: ${result.zscore.toFixed(2)}, severity: ${severity})`
        );

        if (severity === 'critical') {
          this.eventBus.emit('security:alert', {
            type: 'anomaly_critical',
            source: 'anomaly-detector',
            data: {
              metric,
              value,
              zscore: result.zscore,
              mean: result.mean,
              stddev: result.stddev,
            },
          });
        } else {
          this.eventBus.emit('security:alert', {
            type: 'anomaly_detected',
            source: 'anomaly-detector',
            data: {
              metric,
              value,
              zscore: result.zscore,
              mean: result.mean,
              stddev: result.stddev,
            },
          });
        }
      }
    }
  }

  /**
   * Check if a value is anomalous for a given metric (> threshold sigma from mean).
   *
   * Returns anomalous=false if insufficient data (< 2 samples).
   */
  isAnomalous(metric: string, value: number): AnomalyResult {
    const baseline = this.getBaseline(metric);

    if (!baseline || baseline.count < 2) {
      return {
        anomalous: false,
        zscore: 0,
        mean: baseline?.mean ?? 0,
        stddev: 0,
        threshold: this.threshold,
      };
    }

    // Avoid division by zero — if stddev is 0, any deviation is anomalous
    if (baseline.stddev === 0) {
      const isExact = value === baseline.mean;
      return {
        anomalous: !isExact,
        zscore: isExact ? 0 : Infinity,
        mean: baseline.mean,
        stddev: 0,
        threshold: this.threshold,
      };
    }

    const zscore = (value - baseline.mean) / baseline.stddev;
    const anomalous = Math.abs(zscore) > this.threshold;

    return {
      anomalous,
      zscore,
      mean: baseline.mean,
      stddev: baseline.stddev,
      threshold: this.threshold,
    };
  }

  /**
   * Get baseline statistics for a metric.
   * Returns null if no data has been recorded for the metric.
   */
  getBaseline(metric: string): BaselineStats | null {
    const window = this.metrics.get(metric);

    if (!window || window.values.length === 0) {
      return null;
    }

    const count = window.values.length;
    const mean = window.sum / count;

    // Population standard deviation
    const variance = (window.sumSquares / count) - (mean * mean);
    // Guard against floating-point negative variance
    const stddev = Math.sqrt(Math.max(0, variance));

    let min = Infinity;
    let max = -Infinity;
    for (const v of window.values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }

    return { mean, stddev, count, min, max };
  }

  /**
   * Get all detected anomalies in the last N hours.
   * Defaults to 24 hours.
   */
  getRecentAnomalies(hours?: number): AnomalyEvent[] {
    const cutoffMs = (hours ?? 24) * 60 * 60 * 1000;
    const cutoffTime = Date.now() - cutoffMs;

    return this.recentAnomalies.filter(
      a => new Date(a.detectedAt).getTime() >= cutoffTime
    );
  }

  /**
   * Get the current window size setting.
   */
  getWindowSize(): number {
    return this.windowSize;
  }

  /**
   * Remove anomalies older than 48 hours to bound memory.
   */
  private pruneOldAnomalies(): void {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const firstValid = this.recentAnomalies.findIndex(a => a.detectedAt >= cutoff);

    if (firstValid > 0) {
      this.recentAnomalies.splice(0, firstValid);
    }
  }
}
