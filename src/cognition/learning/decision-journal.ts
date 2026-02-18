/**
 * Decision Journal — Real-time Decision Recording & Framework Attribution
 *
 * Subscribes to cognitive EventBus events and records decisions
 * with full framework attribution (LOGOS/ETHOS/PATHOS).
 *
 * Features:
 * - Real-time capture of cognitive events
 * - Framework attribution (which cognitive pillars/frameworks were used)
 * - Persistent storage at ~/.ari/decisions/ with atomic writes
 * - Query API for analysis and learning
 *
 * @module cognition/learning/decision-journal
 */

import fs from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
// L0 Cognitive layer — no kernel imports allowed (ADR-004).
// Define minimal local interfaces to avoid layer violations.
interface EventEmitterLike {
  emit(event: string, payload: unknown): void;
  on(event: string, handler: (payload: unknown) => void): () => void;
}
// ─── Cognition Event Payload Types (L0-local definitions) ───────────────────
interface BeliefUpdatedPayload { hypothesis: string; priorProbability: number; posteriorProbability: number; shift: number; }
interface ExpectedValuePayload { decision: string; expectedValue: number; recommendation: string; }
interface KellyPayload { recommendedFraction: number; strategy: string; edge: number; }
interface LeveragePointPayload { system: string; level: number; effectiveness: string; }
interface AntifragilityPayload { item: string; category: string; score: number; }
interface DecisionTreePayload { rootId: string; expectedValue: number; optimalPath: string[]; }
interface BiasDetectedPayload { biases: Array<{ type: string }>; reasoning: string; }
interface EmotionalRiskPayload { riskScore: number; state: { valence: number; arousal: number; dominance: number }; emotions: string[]; }
interface DisciplineCheckPayload { decision: string; passed: boolean; overallScore: number; violations: string[]; }
interface FearGreedPayload { pattern: string; phase: string; severity: number; recommendation: string; }
interface ThoughtReframedPayload { distortions: string[]; }
interface ReflectionPayload { outcomeId: string; insights: unknown[]; principles: unknown[]; }
interface WisdomPayload { query: string; tradition: string; principle: string; }
interface PracticePlanPayload { skill: string; currentLevel: number; targetLevel: number; estimatedHours: number; }
interface DichotomyPayload { situation: string; controllableCount: number; uncontrollableCount: number; focusArea: string; }
interface VirtueCheckPayload { decision: string; overallAlignment: number; conflicts: string[]; }



// Minimal structured logger for L0 (no pino dependency)
const logger = {
  info: (data: unknown, msg?: string): void => {
    if (process.env['NODE_ENV'] !== 'test') {
      const base = typeof data === 'object' && data !== null ? data : { data };
      console.log(JSON.stringify({ level: 'INFO', component: 'decision-journal', ...base, msg }));
    }
  },
  warn: (data: unknown, msg?: string): void => {
    if (process.env['NODE_ENV'] !== 'test') {
      const base = typeof data === 'object' && data !== null ? data : { data };
      console.warn(JSON.stringify({ level: 'WARN', component: 'decision-journal', ...base, msg }));
    }
  },
  error: (data: unknown, msg?: string): void => {
    const base = typeof data === 'object' && data !== null ? data : { data };
    console.error(JSON.stringify({ level: 'ERROR', component: 'decision-journal', ...base, msg }));
  },
  debug: (_data: unknown, _msg?: string): void => {},
};

// =============================================================================
// Types
// =============================================================================

export interface JournalEntry {
  id: string;
  timestamp: Date;
  decision: string;
  frameworks_used: string[];
  pillar: 'LOGOS' | 'ETHOS' | 'PATHOS' | 'CROSS';
  confidence: number;
  biases_detected?: string[];
  emotional_context?: {
    valence: number;
    arousal: number;
    dominance: number;
  };
  outcome?: 'pending' | 'success' | 'failure' | 'partial';
  reasoning?: string;
}

export interface DecisionStats {
  total: number;
  by_pillar: Record<string, number>;
  by_framework: Record<string, number>;
  average_confidence: number;
  outcomes: {
    pending: number;
    success: number;
    failure: number;
    partial: number;
  };
}

// =============================================================================
// Decision Journal Class
// =============================================================================

export class DecisionJournal {
  private readonly DECISIONS_DIR: string;
  private entries = new Map<string, JournalEntry>();
  private dirty = false;
  private persistTimer: NodeJS.Timeout | null = null;
  private readonly PERSIST_DEBOUNCE_MS = 5000;
  private eventBus: EventEmitterLike | null = null;
  private unsubscribers: Array<() => void> = [];

  constructor(decisionsDir?: string) {
    this.DECISIONS_DIR = decisionsDir ?? path.join(homedir(), '.ari', 'decisions');
  }

  /**
   * Initialize — create directory, load from disk, subscribe to events.
   */
  async initialize(eventBus: EventEmitterLike): Promise<void> {
    this.eventBus = eventBus;

    mkdirSync(this.DECISIONS_DIR, { recursive: true });

    await this.loadFromDisk();

    this.persistTimer = setInterval(() => {
      if (this.dirty) {
        this.persistToDisk().catch((err: unknown) => {
          logger.error({ err }, 'Decision journal persist failed');
        });
      }
    }, this.PERSIST_DEBOUNCE_MS);

    this.subscribeToEvents();
  }

  /**
   * Shutdown — flush pending writes and stop timer.
   */
  async shutdown(): Promise<void> {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }

    if (this.dirty) {
      await this.persistToDisk();
    }
  }

  /**
   * Subscribe to all cognitive events across LOGOS/ETHOS/PATHOS.
   */
  private subscribeToEvents(): void {
    if (!this.eventBus) return;

    // ── LOGOS events ──────────────────────────────────────────────────
    this.unsubscribers.push(
      this.eventBus.on('cognition:belief_updated', (raw) => {
        const payload = raw as BeliefUpdatedPayload;
        this.recordDecision({
          decision: `Bayesian update: "${payload.hypothesis}" `
            + `(${(payload.priorProbability * 100).toFixed(1)}% → `
            + `${(payload.posteriorProbability * 100).toFixed(1)}%)`,
          frameworks_used: ['Bayesian Reasoning'],
          pillar: 'LOGOS',
          confidence: Math.abs(payload.shift) > 0.2 ? 0.8 : 0.6,
          reasoning: `Shift: ${payload.shift > 0 ? '+' : ''}${(payload.shift * 100).toFixed(1)}%`,
        });
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('cognition:expected_value_calculated', (raw) => {
        const payload = raw as ExpectedValuePayload;
        this.recordDecision({
          decision: `EV calculated: "${payload.decision}" (EV: ${payload.expectedValue.toFixed(2)})`,
          frameworks_used: ['Expected Value Theory'],
          pillar: 'LOGOS',
          confidence: 0.8,
          reasoning: `Recommendation: ${payload.recommendation}`,
        });
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('cognition:kelly_calculated', (raw) => {
        const payload = raw as KellyPayload;
        this.recordDecision({
          decision: `Kelly sizing: ${(payload.recommendedFraction * 100).toFixed(1)}% (${payload.strategy})`,
          frameworks_used: ['Kelly Criterion'],
          pillar: 'LOGOS',
          confidence: payload.edge > 0 ? 0.85 : 0.6,
          reasoning: `Edge: ${(payload.edge * 100).toFixed(1)}%`,
        });
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('cognition:leverage_point_identified', (raw) => {
        const payload = raw as LeveragePointPayload;
        this.recordDecision({
          decision: `Leverage point: "${payload.system}" Level ${payload.level} (${payload.effectiveness})`,
          frameworks_used: ['Systems Thinking (Meadows)'],
          pillar: 'LOGOS',
          confidence: payload.effectiveness === 'transformative' ? 0.9 : 0.7,
        });
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('cognition:antifragility_assessed', (raw) => {
        const payload = raw as AntifragilityPayload;
        this.recordDecision({
          decision: `Antifragility: "${payload.item}" → ${payload.category} (${payload.score.toFixed(2)})`,
          frameworks_used: ['Antifragility (Taleb)'],
          pillar: 'LOGOS',
          confidence: 0.75,
        });
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('cognition:decision_tree_evaluated', (raw) => {
        const payload = raw as DecisionTreePayload;
        this.recordDecision({
          decision: `Decision tree: root=${payload.rootId}, EV=${payload.expectedValue.toFixed(2)}`,
          frameworks_used: ['Decision Trees'],
          pillar: 'LOGOS',
          confidence: 0.8,
          reasoning: `Optimal path: ${payload.optimalPath.join(' → ')}`,
        });
      }),
    );

    // ── ETHOS events ──────────────────────────────────────────────────
    this.unsubscribers.push(
      this.eventBus.on('cognition:bias_detected', (raw) => {
        const payload = raw as BiasDetectedPayload;
        this.recordDecision({
          decision: 'Bias detection scan completed',
          frameworks_used: ['Cognitive Bias Detection'],
          pillar: 'ETHOS',
          confidence: 0.7,
          biases_detected: payload.biases.map((b) => b.type),
          reasoning: payload.reasoning,
        });
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('cognition:emotional_risk', (raw) => {
        const payload = raw as EmotionalRiskPayload;
        this.recordDecision({
          decision: `Emotional risk: ${(payload.riskScore * 100).toFixed(1)}%`,
          frameworks_used: ['Emotional State Assessment (VAD)'],
          pillar: 'ETHOS',
          confidence: 0.75,
          emotional_context: payload.state,
          reasoning: `Emotions: ${payload.emotions.join(', ')}`,
        });
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('cognition:discipline_check', (raw) => {
        const payload = raw as DisciplineCheckPayload;
        this.recordDecision({
          decision: `Discipline check: "${payload.decision}" (${payload.passed ? 'PASSED' : 'FAILED'})`,
          frameworks_used: ['Discipline Framework'],
          pillar: 'ETHOS',
          confidence: payload.overallScore,
          reasoning: payload.violations.length > 0
            ? `Violations: ${payload.violations.join(', ')}`
            : 'All checks passed',
        });
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('cognition:fear_greed_detected', (raw) => {
        const payload = raw as FearGreedPayload;
        this.recordDecision({
          decision: `Fear/Greed cycle: ${payload.pattern} (${payload.phase} phase)`,
          frameworks_used: ['Fear/Greed Cycle Analysis'],
          pillar: 'ETHOS',
          confidence: payload.severity,
          reasoning: payload.recommendation,
        });
      }),
    );

    // ── PATHOS events ──────────────────────────────────────────────────
    this.unsubscribers.push(
      this.eventBus.on('cognition:thought_reframed', (raw) => {
        const payload = raw as ThoughtReframedPayload;
        this.recordDecision({
          decision: 'CBT reframe applied',
          frameworks_used: ['Cognitive Behavioral Therapy (Beck)'],
          pillar: 'PATHOS',
          confidence: 0.8,
          reasoning: `Distortions: ${payload.distortions.join(', ')}`,
        });
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('cognition:reflection_complete', (raw) => {
        const payload = raw as ReflectionPayload;
        this.recordDecision({
          decision: `Reflection on outcome: ${payload.outcomeId}`,
          frameworks_used: ['Reflection Engine (Kolb)'],
          pillar: 'PATHOS',
          confidence: 0.75,
          reasoning: `Insights: ${payload.insights.length}, Principles: ${payload.principles.length}`,
        });
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('cognition:wisdom_consulted', (raw) => {
        const payload = raw as WisdomPayload;
        this.recordDecision({
          decision: `Wisdom: "${payload.query}"`,
          frameworks_used: [`Wisdom Traditions (${payload.tradition})`],
          pillar: 'PATHOS',
          confidence: 0.7,
          reasoning: `Principle: ${payload.principle}`,
        });
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('cognition:practice_plan_created', (raw) => {
        const payload = raw as PracticePlanPayload;
        this.recordDecision({
          decision: `Practice plan: "${payload.skill}" (Level ${payload.currentLevel} → ${payload.targetLevel})`,
          frameworks_used: ['Deliberate Practice (Ericsson)'],
          pillar: 'PATHOS',
          confidence: 0.8,
          reasoning: `Estimated hours: ${payload.estimatedHours}`,
        });
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('cognition:dichotomy_analyzed', (raw) => {
        const payload = raw as DichotomyPayload;
        this.recordDecision({
          decision: `Dichotomy of control: "${payload.situation}"`,
          frameworks_used: ['Dichotomy of Control (Stoicism)'],
          pillar: 'PATHOS',
          confidence: 0.75,
          reasoning: `Controllable: ${payload.controllableCount}, `
            + `Uncontrollable: ${payload.uncontrollableCount}. `
            + `Focus: ${payload.focusArea}`,
        });
      }),
    );

    this.unsubscribers.push(
      this.eventBus.on('cognition:virtue_check', (raw) => {
        const payload = raw as VirtueCheckPayload;
        this.recordDecision({
          decision: `Virtue alignment: "${payload.decision}" (${(payload.overallAlignment * 100).toFixed(1)}%)`,
          frameworks_used: ['Virtue Ethics (Aristotle)'],
          pillar: 'PATHOS',
          confidence: payload.overallAlignment,
          reasoning: payload.conflicts.length > 0
            ? `Conflicts: ${payload.conflicts.join(', ')}`
            : 'All virtues aligned',
        });
      }),
    );
  }

  /**
   * Record a decision entry.
   */
  recordDecision(params: {
    decision: string;
    frameworks_used: string[];
    pillar: 'LOGOS' | 'ETHOS' | 'PATHOS' | 'CROSS';
    confidence: number;
    biases_detected?: string[];
    emotional_context?: { valence: number; arousal: number; dominance: number };
    outcome?: 'pending' | 'success' | 'failure' | 'partial';
    reasoning?: string;
  }): JournalEntry {
    const entry: JournalEntry = {
      id: randomUUID(),
      timestamp: new Date(),
      decision: params.decision,
      frameworks_used: params.frameworks_used,
      pillar: params.pillar,
      confidence: params.confidence,
      biases_detected: params.biases_detected,
      emotional_context: params.emotional_context,
      outcome: params.outcome ?? 'pending',
      reasoning: params.reasoning,
    };

    this.entries.set(entry.id, entry);
    this.dirty = true;
    return entry;
  }

  /**
   * Get recent decisions (last N hours).
   */
  getRecentDecisions(hours: number = 24): JournalEntry[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Array.from(this.entries.values())
      .filter((entry) => entry.timestamp >= cutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get decisions filtered by framework.
   */
  getDecisionsByFramework(framework: string): JournalEntry[] {
    return Array.from(this.entries.values())
      .filter((entry) => entry.frameworks_used.includes(framework))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get decisions filtered by pillar.
   */
  getDecisionsByPillar(pillar: 'LOGOS' | 'ETHOS' | 'PATHOS' | 'CROSS'): JournalEntry[] {
    return Array.from(this.entries.values())
      .filter((entry) => entry.pillar === pillar)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get decisions in a time range.
   */
  getDecisionsInRange(start: Date, end: Date): JournalEntry[] {
    return Array.from(this.entries.values())
      .filter((entry) => entry.timestamp >= start && entry.timestamp <= end)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get aggregate statistics.
   */
  getDecisionStats(): DecisionStats {
    const entries = Array.from(this.entries.values());
    const by_pillar: Record<string, number> = { LOGOS: 0, ETHOS: 0, PATHOS: 0, CROSS: 0 };
    const by_framework: Record<string, number> = {};
    const outcomes = { pending: 0, success: 0, failure: 0, partial: 0 };
    let total_confidence = 0;

    for (const entry of entries) {
      by_pillar[entry.pillar] = (by_pillar[entry.pillar] ?? 0) + 1;
      for (const framework of entry.frameworks_used) {
        by_framework[framework] = (by_framework[framework] ?? 0) + 1;
      }
      if (entry.outcome) outcomes[entry.outcome]++;
      total_confidence += entry.confidence;
    }

    return {
      total: entries.length,
      by_pillar,
      by_framework,
      average_confidence: entries.length > 0 ? total_confidence / entries.length : 0,
      outcomes,
    };
  }

  /**
   * Update the outcome of a decision.
   */
  updateOutcome(id: string, outcome: 'success' | 'failure' | 'partial'): boolean {
    const entry = this.entries.get(id);
    if (entry) {
      entry.outcome = outcome;
      this.dirty = true;
      return true;
    }
    return false;
  }

  /**
   * Get all entries count.
   */
  get size(): number {
    return this.entries.size;
  }

  // ─── Persistence ─────────────────────────────────────────────────────

  /**
   * Load entries from disk (current + previous month for overlap).
   */
  private async loadFromDisk(): Promise<void> {
    try {
      const now = new Date();
      const monthKey = this.getMonthKey(now);
      const filePath = path.join(this.DECISIONS_DIR, `${monthKey}.json`);

      if (existsSync(filePath)) {
        const data = await fs.readFile(filePath, 'utf-8');
        const entries: JournalEntry[] = JSON.parse(data, (_key: string, value: unknown) => this.dateReviver(_key, value)) as JournalEntry[];
        for (const entry of entries) {
          if (entry.id && entry.decision) {
            this.entries.set(entry.id, entry);
          }
        }
      }

      // Also load previous month for overlap (last 7 days)
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthKey = this.getMonthKey(lastMonth);
      const lastMonthPath = path.join(this.DECISIONS_DIR, `${lastMonthKey}.json`);

      if (existsSync(lastMonthPath)) {
        const data = await fs.readFile(lastMonthPath, 'utf-8');
        const entries: JournalEntry[] = JSON.parse(data, (_key: string, value: unknown) => this.dateReviver(_key, value)) as JournalEntry[];
        for (const entry of entries) {
          const age = (now.getTime() - new Date(entry.timestamp).getTime()) / (1000 * 60 * 60 * 24);
          if (age <= 7 && entry.id && entry.decision) {
            this.entries.set(entry.id, entry);
          }
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to load decision journal');
    }
  }

  /**
   * Persist entries to disk with atomic writes (tmp + rename).
   * Groups by month for organized storage.
   */
  private async persistToDisk(): Promise<void> {
    try {
      const entriesByMonth = new Map<string, JournalEntry[]>();

      for (const entry of this.entries.values()) {
        const key = this.getMonthKey(entry.timestamp);
        const existing = entriesByMonth.get(key) ?? [];
        existing.push(entry);
        entriesByMonth.set(key, existing);
      }

      for (const [monthKey, entries] of entriesByMonth) {
        const filePath = path.join(this.DECISIONS_DIR, `${monthKey}.json`);
        const tempPath = `${filePath}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(entries, null, 2), 'utf-8');
        await fs.rename(tempPath, filePath);
      }

      this.dirty = false;
    } catch (error) {
      logger.error({ err: error }, 'Failed to persist decision journal');
      throw error;
    }
  }

  private getMonthKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private dateReviver(_key: string, value: unknown): unknown {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return new Date(value);
    }
    return value;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let defaultJournal: DecisionJournal | null = null;

export function getDecisionJournal(): DecisionJournal {
  if (!defaultJournal) {
    defaultJournal = new DecisionJournal();
  }
  return defaultJournal;
}

export function createDecisionJournal(decisionsDir?: string): DecisionJournal {
  return new DecisionJournal(decisionsDir);
}
