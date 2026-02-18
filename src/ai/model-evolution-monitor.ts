/**
 * Model Evolution Monitor — Track new Anthropic model releases
 *
 * Monitors for new Anthropic model releases and notifies when better
 * models are available. Intended to run weekly (Monday 10 AM) via
 * the autonomous scheduler.
 *
 * Uses an in-memory list of known models — no external API calls.
 * When new models are detected (i.e., detectedAt is newer than the
 * last-checked timestamp), emits an audit event and flags for upgrade.
 *
 * Layer: AI (L2 System)
 */

import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('model-evolution-monitor');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ModelRelease {
  modelId: string;
  modelFamily: string;
  releaseDate: string;
  contextWindow: number;
  capabilities: string[];
  performanceTier: 'sota' | 'balanced' | 'fast';
  detectedAt: string;
}

export interface EvolutionReport {
  checkedAt: string;
  newModelsFound: ModelRelease[];
  currentBestModel: string;
  upgradeRecommended: boolean;
  upgradeReason?: string;
}

// ─── Known Models ────────────────────────────────────────────────────────────

/**
 * Canonical list of known Anthropic models, updated manually when new
 * releases are published. No external API needed — this file is the
 * source of truth for the evolution monitor.
 */
const KNOWN_MODELS: ModelRelease[] = [
  {
    modelId: 'claude-opus-4-6',
    modelFamily: 'claude-4',
    releaseDate: '2025-07',
    contextWindow: 200_000,
    capabilities: ['reasoning', 'coding', 'analysis'],
    performanceTier: 'sota',
    detectedAt: '2025-07-01T00:00:00.000Z',
  },
  {
    modelId: 'claude-sonnet-4-6',
    modelFamily: 'claude-4',
    releaseDate: '2025-07',
    contextWindow: 1_000_000,
    capabilities: ['reasoning', 'coding', 'long-context'],
    performanceTier: 'balanced',
    detectedAt: '2025-07-01T00:00:00.000Z',
  },
  {
    modelId: 'claude-haiku-4-5',
    modelFamily: 'claude-4',
    releaseDate: '2025-10',
    contextWindow: 200_000,
    capabilities: ['fast', 'efficient'],
    performanceTier: 'fast',
    detectedAt: '2025-10-01T00:00:00.000Z',
  },
];

/** The current best model by performance tier (sota preferred). */
const CURRENT_BEST_MODEL = 'claude-opus-4-6';

// ─── Monitor ─────────────────────────────────────────────────────────────────

export class ModelEvolutionMonitor {
  private readonly eventBus: EventBus;
  private lastChecked: string | null = null;

  constructor(params: { eventBus: EventBus }) {
    this.eventBus = params.eventBus;
    log.info('ModelEvolutionMonitor initialized');
  }

  /**
   * Run a model evolution check.
   *
   * Compares KNOWN_MODELS against the last-checked timestamp. Any model
   * whose  is newer than  is treated as newly
   * discovered, triggering an upgrade recommendation.
   */
  check(): EvolutionReport {
    const checkedAt = new Date().toISOString();
    const cutoff = this.lastChecked ? new Date(this.lastChecked) : null;

    const newModelsFound = KNOWN_MODELS.filter((m) => {
      if (cutoff === null) return false; // First run — nothing is new yet
      return new Date(m.detectedAt) > cutoff;
    });

    const upgradeRecommended = newModelsFound.length > 0;
    const upgradeReason = upgradeRecommended
      ? `${newModelsFound.length} new model(s) detected since last check: ${newModelsFound.map((m) => m.modelId).join(', ')}`
      : undefined;

    const report: EvolutionReport = {
      checkedAt,
      newModelsFound,
      currentBestModel: CURRENT_BEST_MODEL,
      upgradeRecommended,
      upgradeReason,
    };

    this.eventBus.emit('audit:log', {
      action: 'model_evolution:check_complete',
      agent: 'model-evolution-monitor',
      trustLevel: 'system',
      details: {
        checkedAt,
        newModelsFound: newModelsFound.length,
        upgradeRecommended,
        upgradeReason: upgradeReason ?? null,
      },
    });

    log.info(
      { newModelsFound: newModelsFound.length, upgradeRecommended },
      'Model evolution check complete',
    );

    return report;
  }

  /** Returns the full list of known Anthropic models. */
  getKnownModels(): ModelRelease[] {
    return [...KNOWN_MODELS];
  }

  /** Records the current timestamp as last-checked. */
  markChecked(): void {
    this.lastChecked = new Date().toISOString();
    log.debug({ lastChecked: this.lastChecked }, 'Marked as checked');
  }
}
