/**
 * Prompt Registry — Versioned prompts with A/B testing
 *
 * Manages prompt versions and A/B test variants for ARI's LLM calls.
 * Integrates with Langfuse for tracking variant performance.
 * Feedback from 👍/👎 buttons flows back to improve prompt selection.
 *
 * Layer: L2 System (observability)
 */

import { randomUUID } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('prompt-registry');

const REGISTRY_DIR = join(homedir(), '.ari', 'prompts');
const STATS_PATH = join(REGISTRY_DIR, 'stats.json');

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PromptVariant {
  name: string;
  content: string;
  weight: number;  // 0-1, normalized during selection
  version: number;
}

export interface PromptDefinition {
  id: string;
  description: string;
  variants: PromptVariant[];
  activeVariant?: string;  // Force a specific variant (overrides A/B)
  createdAt: string;
  updatedAt: string;
}

export interface VariantStats {
  positive: number;
  negative: number;
  impressions: number;
}

export interface PromptStats {
  promptId: string;
  variants: Record<string, VariantStats>;
}

export interface SelectedPrompt {
  content: string;
  variantName: string;
  version: number;
  selectionId: string;  // For feedback attribution
}

// ─── Stats persistence ─────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!existsSync(REGISTRY_DIR)) {
    mkdirSync(REGISTRY_DIR, { recursive: true });
  }
}

function loadStats(): Record<string, PromptStats> {
  ensureDir();
  if (!existsSync(STATS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATS_PATH, 'utf-8')) as Record<string, PromptStats>;
  } catch {
    return {};
  }
}

function saveStats(stats: Record<string, PromptStats>): void {
  ensureDir();
  writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2), 'utf-8');
}

// ─── Weighted random selection ─────────────────────────────────────────────────

function selectWeighted(variants: PromptVariant[], userId?: string): PromptVariant {
  // Deterministic for the same userId (consistent experience per user)
  if (userId) {
    const hash = userId.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0);
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    let target = (Math.abs(hash) % 1000) / 1000 * totalWeight;
    for (const variant of variants) {
      target -= variant.weight;
      if (target <= 0) return variant;
    }
    return variants[variants.length - 1];
  }

  // Random selection weighted by variant weights
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const variant of variants) {
    roll -= variant.weight;
    if (roll <= 0) return variant;
  }
  return variants[variants.length - 1];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

export class PromptRegistry {
  private readonly prompts = new Map<string, PromptDefinition>();
  private stats: Record<string, PromptStats>;

  // Track active selections for feedback attribution: selectionId → { promptId, variantName }
  private readonly activeSelections = new Map<string, { promptId: string; variantName: string }>();

  constructor() {
    this.stats = loadStats();
    this.registerBuiltins();
  }

  // ── Register prompts ───────────────────────────────────────────────────────

  register(definition: Omit<PromptDefinition, 'createdAt' | 'updatedAt'>): void {
    const now = new Date().toISOString();
    this.prompts.set(definition.id, {
      ...definition,
      createdAt: now,
      updatedAt: now,
    });
    log.info({ promptId: definition.id, variants: definition.variants.length }, 'Prompt registered');
  }

  // ── Get a prompt (A/B test aware) ─────────────────────────────────────────

  get(promptId: string, userId?: string): SelectedPrompt | null {
    const definition = this.prompts.get(promptId);
    if (!definition) {
      log.warn({ promptId }, 'Prompt not found in registry');
      return null;
    }

    const variants = definition.variants;
    if (variants.length === 0) return null;

    // Force a specific variant if activeVariant is set
    const forced = definition.activeVariant
      ? variants.find((v) => v.name === definition.activeVariant)
      : null;

    const selected = forced ?? selectWeighted(variants, userId);
    const selectionId = randomUUID();

    // Track for feedback attribution
    this.activeSelections.set(selectionId, { promptId, variantName: selected.name });

    // Record impression
    this.recordImpression(promptId, selected.name);

    return {
      content: selected.content,
      variantName: selected.name,
      version: selected.version,
      selectionId,
    };
  }

  // ── Record feedback ────────────────────────────────────────────────────────

  recordFeedback(selectionId: string, positive: boolean): boolean {
    const selection = this.activeSelections.get(selectionId);
    if (!selection) return false;

    const { promptId, variantName } = selection;

    if (!this.stats[promptId]) {
      this.stats[promptId] = { promptId, variants: {} };
    }

    const promptStats = this.stats[promptId];
    if (!promptStats) return false; // narrowing guard (stats[promptId] was just set above)
    if (!promptStats.variants[variantName]) {
      promptStats.variants[variantName] = { positive: 0, negative: 0, impressions: 0 };
    }

    const variantStats = promptStats.variants[variantName];
    if (!variantStats) return false;
    if (positive) {
      variantStats.positive++;
    } else {
      variantStats.negative++;
    }

    saveStats(this.stats);
    log.info({ promptId, variantName, positive }, 'Prompt feedback recorded');
    return true;
  }

  // ── Get stats ──────────────────────────────────────────────────────────────

  getStats(promptId: string): PromptStats | null {
    return this.stats[promptId] ?? null;
  }

  getAllStats(): Record<string, PromptStats> {
    return { ...this.stats };
  }

  // ── Get win rate (positive / (positive + negative)) ───────────────────────

  getWinRate(promptId: string, variantName: string): number {
    const promptStats = this.stats[promptId];
    if (!promptStats) return 0;

    const vs = promptStats.variants[variantName];
    if (!vs) return 0;

    const total = vs.positive + vs.negative;
    if (total === 0) return 0;

    return vs.positive / total;
  }

  // ── List all prompts ───────────────────────────────────────────────────────

  list(): PromptDefinition[] {
    return Array.from(this.prompts.values());
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private recordImpression(promptId: string, variantName: string): void {
    if (!this.stats[promptId]) {
      this.stats[promptId] = { promptId, variants: {} };
    }
    const ps = this.stats[promptId];
    if (!ps) return;
    if (!ps.variants[variantName]) {
      ps.variants[variantName] = { positive: 0, negative: 0, impressions: 0 };
    }
    const pv = ps.variants[variantName];
    if (pv) pv.impressions++;

    // Save periodically (every 10 impressions to reduce I/O)
    const total = Object.values(ps.variants).reduce((s, v) => s + v.impressions, 0);
    if (total % 10 === 0) {
      saveStats(this.stats);
    }
  }

  // ─── Built-in prompts ─────────────────────────────────────────────────────

  private registerBuiltins(): void {
    // ARI conversational system prompt (A/B testing directness vs warmth)
    this.register({
      id: 'ari:conversational',
      description: 'ARI conversational AI system prompt',
      variants: [
        {
          name: 'direct',
          content: [
            'You are ARI — Pryce Hedrick\'s personal AI operating system.',
            'You are direct, precise, and action-oriented.',
            'Never say "certainly", "absolutely", "I\'d be happy to", or any AI filler.',
            'No corporate jargon. No hedging.',
            'Give the answer first. Explain only if needed.',
            'Sound like Pryce\'s smartest friend — not a customer service bot.',
          ].join('\n'),
          weight: 0.6,
          version: 1,
        },
        {
          name: 'warm_direct',
          content: [
            'You are ARI — Pryce Hedrick\'s personal AI operating system.',
            'You are warm but direct. Human. Real.',
            'Skip the filler: no "certainly", "absolutely", "great question".',
            'Give the answer first, concisely. Add context only when it matters.',
            'Sound like a brilliant friend who also actually cares.',
            'Contractions are fine. Short sentences are good. Be real.',
          ].join('\n'),
          weight: 0.4,
          version: 1,
        },
      ],
    });

    // Market intelligence analysis prompt
    this.register({
      id: 'market:analysis',
      description: 'Market intelligence analysis system prompt',
      variants: [
        {
          name: 'concise',
          content: 'Analyze market data concisely. Lead with the signal. No filler. Numbers > words.',
          weight: 1.0,
          version: 1,
        },
      ],
    });

    // Content generation system prompt
    this.register({
      id: 'content:generation',
      description: 'Content generation for PayThePryce brand',
      variants: [
        {
          name: 'hormozi_v1',
          content: [
            'Brand: PayThePryce — personal finance and entrepreneurship.',
            'Voice: Alex Hormozi-inspired. 1st grade language. No fluff. Value-first.',
            'Every sentence earns its place. Hook in the first 5 seconds.',
            'Direct, confident, actionable. CTAs only at the end.',
          ].join('\n'),
          weight: 1.0,
          version: 1,
        },
      ],
    });
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _registry: PromptRegistry | null = null;

export function getPromptRegistry(): PromptRegistry {
  if (!_registry) {
    _registry = new PromptRegistry();
  }
  return _registry;
}
