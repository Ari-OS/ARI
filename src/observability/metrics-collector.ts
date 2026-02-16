import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { EventBus } from '../kernel/event-bus.js';
import {
  MetricsHistoryFileSchema,
  MetricsSnapshotSchema,
  type MetricsSnapshot,
  type MetricTimeSeries,
  type MetricDefinition,
} from './types.js';
import { createLogger } from '../kernel/logger.js';

const logger = createLogger('metrics-collector');

const ARI_DIR = path.join(os.homedir(), '.ari');
const METRICS_FILE = path.join(ARI_DIR, 'metrics-history.json');

// Metric definitions
const METRIC_DEFINITIONS: MetricDefinition[] = [
  { name: 'memory.heap_used_mb', description: 'Heap memory used', unit: 'bytes', type: 'gauge' },
  { name: 'memory.heap_total_mb', description: 'Total heap memory', unit: 'bytes', type: 'gauge' },
  { name: 'memory.rss_mb', description: 'Resident set size', unit: 'bytes', type: 'gauge' },
  { name: 'memory.external_mb', description: 'External memory', unit: 'bytes', type: 'gauge' },
  { name: 'process.uptime_seconds', description: 'Process uptime', unit: 'count', type: 'gauge' },
  { name: 'events.total_count', description: 'Total events processed', unit: 'count', type: 'counter' },
];

const SAMPLE_INTERVAL_MS = 30000; // 30 seconds
const RETENTION_HOURS = 24;
const MAX_SNAPSHOTS = (RETENTION_HOURS * 60 * 60 * 1000) / SAMPLE_INTERVAL_MS;

export class MetricsCollector {
  private snapshots: MetricsSnapshot[] = [];
  private eventBus: EventBus;
  private sampleInterval: ReturnType<typeof setInterval> | null = null;
  private eventCount = 0;
  private initialized = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventCounting();
  }

  private setupEventCounting(): void {
    // Count all events passing through the bus
    this.eventBus.on('audit:log', () => {
      this.eventCount++;
    });
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    await this.ensureDirectory();
    await this.load();
    this.startSampling();
    this.initialized = true;

    this.eventBus.emit('audit:log', {
      action: 'metrics_collector:started',
      agent: 'core',
      trustLevel: 'system' as const,
      details: { sampleIntervalMs: SAMPLE_INTERVAL_MS, retentionHours: RETENTION_HOURS },
    });
  }

  private async ensureDirectory(): Promise<void> {
    await fs.mkdir(ARI_DIR, { recursive: true });
  }

  private async load(): Promise<void> {
    try {
      const content = await fs.readFile(METRICS_FILE, 'utf-8');
      const parsed = JSON.parse(content) as unknown;
      const validated = MetricsHistoryFileSchema.parse(parsed);

      // Filter old snapshots
      const cutoff = Date.now() - RETENTION_HOURS * 60 * 60 * 1000;
      this.snapshots = validated.snapshots.filter(
        (s) => new Date(s.timestamp).getTime() > cutoff
      );
    } catch {
      // File doesn't exist or is invalid, start fresh
      this.snapshots = [];
    }
  }

  private async save(): Promise<void> {
    const data = {
      version: 1 as const,
      snapshots: this.snapshots,
    };
    await fs.writeFile(METRICS_FILE, JSON.stringify(data, null, 2));
  }

  private startSampling(): void {
    // Take initial sample
    this.takeSample();

    // Schedule periodic sampling
    this.sampleInterval = setInterval(() => {
      this.takeSample();
    }, SAMPLE_INTERVAL_MS);
  }

  private takeSample(): void {
    const memory = process.memoryUsage();
    const now = new Date().toISOString();

    const snapshot: MetricsSnapshot = {
      timestamp: now,
      metrics: {
        'memory.heap_used_mb': Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100,
        'memory.heap_total_mb': Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100,
        'memory.rss_mb': Math.round(memory.rss / 1024 / 1024 * 100) / 100,
        'memory.external_mb': Math.round(memory.external / 1024 / 1024 * 100) / 100,
        'process.uptime_seconds': Math.round(process.uptime()),
        'events.total_count': this.eventCount,
      },
    };

    const parsed = MetricsSnapshotSchema.safeParse(snapshot);
    if (!parsed.success) {
      logger.error({ error: parsed.error }, 'Invalid metrics snapshot');
      return;
    }

    this.snapshots.push(parsed.data);

    // Enforce retention limit
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots = this.snapshots.slice(-MAX_SNAPSHOTS);
    }

    // Save async (don't await)
    void this.save().catch((err: unknown) => logger.error({ err }, 'Failed to save metrics'));
  }

  /**
   * Get current metrics snapshot
   */
  getCurrent(): MetricsSnapshot {
    const memory = process.memoryUsage();
    return {
      timestamp: new Date().toISOString(),
      metrics: {
        'memory.heap_used_mb': Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100,
        'memory.heap_total_mb': Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100,
        'memory.rss_mb': Math.round(memory.rss / 1024 / 1024 * 100) / 100,
        'memory.external_mb': Math.round(memory.external / 1024 / 1024 * 100) / 100,
        'process.uptime_seconds': Math.round(process.uptime()),
        'events.total_count': this.eventCount,
      },
    };
  }

  /**
   * Get all metric definitions
   */
  getDefinitions(): MetricDefinition[] {
    return [...METRIC_DEFINITIONS];
  }

  /**
   * Get time series for a specific metric
   */
  getTimeSeries(metricName: string, timeRangeMinutes = 60): MetricTimeSeries | null {
    const cutoff = Date.now() - timeRangeMinutes * 60 * 1000;
    const relevantSnapshots = this.snapshots.filter(
      (s) => new Date(s.timestamp).getTime() > cutoff
    );

    if (relevantSnapshots.length === 0) {
      return null;
    }

    const values = relevantSnapshots
      .filter((s) => metricName in s.metrics)
      .map((s) => ({
        timestamp: s.timestamp,
        value: s.metrics[metricName],
      }));

    if (values.length === 0) {
      return null;
    }

    const numericValues = values.map((v) => v.value);

    return {
      name: metricName,
      values,
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
      avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
      latest: numericValues[numericValues.length - 1],
    };
  }

  /**
   * Get all metrics time series
   */
  getAllTimeSeries(timeRangeMinutes = 60): MetricTimeSeries[] {
    return METRIC_DEFINITIONS
      .map((def) => this.getTimeSeries(def.name, timeRangeMinutes))
      .filter((ts): ts is MetricTimeSeries => ts !== null);
  }

  /**
   * Get all snapshots within time range
   */
  getSnapshots(timeRangeMinutes = 60): MetricsSnapshot[] {
    const cutoff = Date.now() - timeRangeMinutes * 60 * 1000;
    return this.snapshots.filter(
      (s) => new Date(s.timestamp).getTime() > cutoff
    );
  }

  /**
   * Stop the collector
   */
  stop(): void {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }
  }
}
