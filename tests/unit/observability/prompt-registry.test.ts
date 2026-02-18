/**
 * Unit tests for PromptRegistry
 *
 * Mocks all node:fs operations so no real files are read or written.
 * Tests A/B selection, feedback attribution, win-rate calculation,
 * custom registration, and forced-variant behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock node:fs before importing source ──────────────────────────────────────

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
}));

// ── Mock pino logger to suppress output ──────────────────────────────────────

vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Import under test (after mocks are registered) ───────────────────────────

import { PromptRegistry } from '../../../src/observability/prompt-registry.js';
import type { PromptStats } from '../../../src/observability/prompt-registry.js';

// ── Pull in the mocked fs module for assertion ────────────────────────────────

import * as fs from 'node:fs';

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function makeRegistry(): PromptRegistry {
  return new PromptRegistry();
}

/** UUID v4 regex */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('PromptRegistry — builtin prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  // ── 1. Built-in prompts registered ───────────────────────────────────────

  it('constructor registers builtin prompts', () => {
    const registry = makeRegistry();
    const ids = registry.list().map((p) => p.id);

    expect(ids).toContain('ari:conversational');
    expect(ids).toContain('market:analysis');
    expect(ids).toContain('content:generation');
  });

  // ── 2. Unknown prompt returns null ────────────────────────────────────────

  it('get() returns null for unknown promptId', () => {
    const registry = makeRegistry();
    const result = registry.get('nonexistent:prompt');
    expect(result).toBeNull();
  });

  // ── 3. Known prompt returns SelectedPrompt ────────────────────────────────

  it('get() returns a SelectedPrompt for known promptId', () => {
    const registry = makeRegistry();
    const result = registry.get('ari:conversational');
    expect(result).not.toBeNull();
  });

  // ── 4. SelectedPrompt shape ───────────────────────────────────────────────

  it('SelectedPrompt has content, variantName, version, selectionId', () => {
    const registry = makeRegistry();
    const result = registry.get('ari:conversational');

    expect(result).not.toBeNull();
    expect(typeof result!.content).toBe('string');
    expect(result!.content.length).toBeGreaterThan(0);
    expect(typeof result!.variantName).toBe('string');
    expect(typeof result!.version).toBe('number');
    expect(typeof result!.selectionId).toBe('string');
  });

  // ── 5. selectionId is a UUID ──────────────────────────────────────────────

  it('selectionId is a UUID string', () => {
    const registry = makeRegistry();
    const result = registry.get('ari:conversational');

    expect(result).not.toBeNull();
    expect(result!.selectionId).toMatch(UUID_RE);
  });

  // ── 6. Same userId always returns same variant (deterministic) ────────────

  it('get() with same userId always returns same variant (deterministic)', () => {
    const registry = makeRegistry();
    const userId = 'pryce';

    const first = registry.get('ari:conversational', userId);
    const second = registry.get('ari:conversational', userId);
    const third = registry.get('ari:conversational', userId);

    expect(first).not.toBeNull();
    expect(first!.variantName).toBe(second!.variantName);
    expect(first!.variantName).toBe(third!.variantName);
  });

  // ── 7. get() without userId returns a variant ─────────────────────────────

  it('get() without userId returns a variant', () => {
    const registry = makeRegistry();
    const result = registry.get('ari:conversational');

    expect(result).not.toBeNull();
    expect(['direct', 'warm_direct']).toContain(result!.variantName);
  });
});

// ─── Feedback and win rate ─────────────────────────────────────────────────────

describe('PromptRegistry — feedback and win rate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  // ── 8. recordFeedback() returns false for unknown selectionId ─────────────

  it('recordFeedback() returns false for unknown selectionId', () => {
    const registry = makeRegistry();
    const result = registry.recordFeedback('00000000-0000-4000-8000-000000000000', true);
    expect(result).toBe(false);
  });

  // ── 9. recordFeedback() returns true for known selectionId ────────────────

  it('recordFeedback() returns true for known selectionId after get()', () => {
    const registry = makeRegistry();
    const selected = registry.get('ari:conversational');

    expect(selected).not.toBeNull();

    const recorded = registry.recordFeedback(selected!.selectionId, true);
    expect(recorded).toBe(true);
  });

  // ── 10. getWinRate() returns 0 for unknown prompt ─────────────────────────

  it('getWinRate() returns 0 for unknown prompt', () => {
    const registry = makeRegistry();
    const rate = registry.getWinRate('nonexistent:prompt', 'direct');
    expect(rate).toBe(0);
  });

  // ── 11. getWinRate() returns correct rate after positive feedback ──────────

  it('getWinRate() returns correct rate after positive feedback', () => {
    const registry = makeRegistry();

    // market:analysis has only one variant 'concise' so all users get the same one
    let variantName = '';
    for (let i = 0; i < 4; i++) {
      const selected = registry.get('market:analysis', `user-${i}`);
      expect(selected).not.toBeNull();
      variantName = selected!.variantName;
      const isPositive = i < 3; // first 3 positive, last 1 negative
      registry.recordFeedback(selected!.selectionId, isPositive);
    }

    const rate = registry.getWinRate('market:analysis', variantName);
    // 3 positive / (3 positive + 1 negative) = 0.75
    expect(rate).toBeCloseTo(0.75, 5);
  });
});

// ─── Registration ─────────────────────────────────────────────────────────────

describe('PromptRegistry — registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  // ── 12. register() adds a custom prompt ──────────────────────────────────

  it('register() adds a custom prompt', () => {
    const registry = makeRegistry();

    registry.register({
      id: 'custom:test',
      description: 'A custom test prompt',
      variants: [
        { name: 'v1', content: 'You are a test assistant.', weight: 1.0, version: 1 },
      ],
    });

    const ids = registry.list().map((p) => p.id);
    expect(ids).toContain('custom:test');

    const selected = registry.get('custom:test');
    expect(selected).not.toBeNull();
    expect(selected!.content).toBe('You are a test assistant.');
    expect(selected!.variantName).toBe('v1');
  });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

describe('PromptRegistry — stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  // ── 13. getStats() returns null for prompt with no feedback ───────────────

  it('getStats() returns null for prompt with no feedback', () => {
    const registry = makeRegistry();
    // A totally unknown prompt has no stats entry
    const stats = registry.getStats('nonexistent:prompt');
    expect(stats).toBeNull();
  });

  it('getStats() returns null before any get() call on a known prompt', () => {
    // Fresh registry, no get() calls, no stats populated yet
    const registry = makeRegistry();
    const stats = registry.getStats('ari:conversational');
    expect(stats).toBeNull();
  });

  it('getStats() returns a PromptStats object after feedback', () => {
    const registry = makeRegistry();
    const selected = registry.get('content:generation');
    expect(selected).not.toBeNull();

    registry.recordFeedback(selected!.selectionId, true);

    const stats: PromptStats | null = registry.getStats('content:generation');
    expect(stats).not.toBeNull();
    expect(stats!.promptId).toBe('content:generation');
    expect(stats!.variants).toBeDefined();
  });

  // ── 14. Forced variant via activeVariant always returns forced variant ────

  it('forced variant via activeVariant always returns forced variant', () => {
    const registry = makeRegistry();

    registry.register({
      id: 'ab:test',
      description: 'A/B test with forced variant',
      activeVariant: 'control',
      variants: [
        { name: 'control', content: 'Control prompt.', weight: 0.5, version: 1 },
        { name: 'treatment', content: 'Treatment prompt.', weight: 0.5, version: 1 },
      ],
    });

    for (let i = 0; i < 20; i++) {
      const result = registry.get('ab:test', `user-${i}`);
      expect(result).not.toBeNull();
      expect(result!.variantName).toBe('control');
      expect(result!.content).toBe('Control prompt.');
    }
  });

  // ── 15. getAllStats() returns empty object initially ───────────────────────

  it('getAllStats() returns empty object initially (before any get/feedback calls)', () => {
    const registry = makeRegistry();
    const allStats = registry.getAllStats();

    expect(allStats).toEqual({});
  });

  it('getAllStats() contains entries after get() calls', () => {
    const registry = makeRegistry();
    // Trigger impression recording (impressions go into this.stats immediately)
    registry.get('market:analysis');
    registry.get('content:generation');

    const allStats = registry.getAllStats();

    expect(Object.keys(allStats)).toContain('market:analysis');
    expect(Object.keys(allStats)).toContain('content:generation');
  });
});

// ─── fs mocking verification ──────────────────────────────────────────────────

describe('PromptRegistry — fs isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  it('does not write to disk on construction', () => {
    makeRegistry();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('calls writeFileSync after recording feedback (stats persistence)', () => {
    const registry = makeRegistry();
    const selected = registry.get('ari:conversational');
    expect(selected).not.toBeNull();

    registry.recordFeedback(selected!.selectionId, true);

    // recordFeedback always calls saveStats → writeFileSync
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});
