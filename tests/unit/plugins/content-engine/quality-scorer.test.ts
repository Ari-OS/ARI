import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentQualityScorer } from '../../../../src/plugins/content-engine/quality-scorer.js';
import type { ScoredDraft } from '../../../../src/plugins/content-engine/quality-scorer.js';

// ─────────────────────────────────────────────────────────────────────────────
// MOCK
// ─────────────────────────────────────────────────────────────────────────────

const mockOrchestrator = {
  chat: vi.fn(),
  execute: vi.fn(),
  query: vi.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function makeAiResponse(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    searchIntent: 13,
    keywordOptimization: 12,
    readability: 13,
    structure: 12,
    engagement: 8,
    originality: 8,
    platformFit: 9,
    voiceMatch: 9,
    suggestions: ['Great content overall.'],
    ...overrides,
  });
}

const wellWrittenDraft: ScoredDraft = {
  content: [
    '# How Solo Devs Can Use Claude 4.6 Today',
    '',
    'Anthropic just released Claude 4.6 and it changes everything for AI builders.',
    '',
    '## What\'s new',
    '- Computer use built-in',
    '- Faster inference than 4.5',
    '- New agentic capabilities',
    '',
    '## Why it matters',
    'You can now delegate entire workflows — not just prompts — to Claude.',
    '',
    'Ready to try it? Follow @PayThePryce for the build breakdown.',
  ].join('\n'),
  platform: 'blog_outline',
  topicBrief: {
    headline: 'Claude 4.6 Released',
    keywords: ['Claude 4.6', 'AI agents', 'solo devs'],
  },
};

const poorDraft: ScoredDraft = {
  content: 'AI is a leveraging paradigm that will synergize holistic robust value for all stakeholders.',
  platform: 'linkedin',
  topicBrief: {
    headline: 'Claude 4.6 Released',
    keywords: ['Claude 4.6', 'AI agents', 'solo devs'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('ContentQualityScorer', () => {
  let scorer: ContentQualityScorer;

  beforeEach(() => {
    vi.resetAllMocks();
    scorer = new ContentQualityScorer(mockOrchestrator as never);
  });

  // ── Test 1: Well-written draft passes threshold ──────────────────────────

  it('should score a well-written draft above threshold', async () => {
    mockOrchestrator.chat.mockResolvedValue(makeAiResponse());

    const result = await scorer.score(wellWrittenDraft);

    expect(result.total).toBeGreaterThanOrEqual(70);
    expect(result.passed).toBe(true);
  });

  // ── Test 2: Poor draft fails threshold ───────────────────────────────────

  it('should score a poor draft below threshold when AI returns low scores', async () => {
    mockOrchestrator.chat.mockResolvedValue(
      makeAiResponse({
        searchIntent: 2,
        keywordOptimization: 1,
        readability: 3,
        structure: 2,
        engagement: 1,
        originality: 2,
        platformFit: 3,
        voiceMatch: 2,
        suggestions: [
          'Add keywords.',
          'Improve structure.',
          'Remove corporate jargon.',
        ],
      }),
    );

    const result = await scorer.score(poorDraft);

    expect(result.total).toBeLessThan(70);
    expect(result.passed).toBe(false);
  });

  // ── Test 3: AI failure falls back to heuristic ───────────────────────────

  it('should handle AI scoring failure gracefully and fall back to heuristic', async () => {
    mockOrchestrator.chat.mockRejectedValue(new Error('Network timeout'));

    const result = await scorer.score(wellWrittenDraft);

    // Must still return a valid QualityScore
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('breakdown');
    expect(result).toHaveProperty('suggestions');
    expect(typeof result.total).toBe('number');
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  // ── Test 4a: X platform — content over 280 chars scores low platformFit ──

  it('should give low platformFit when x_single content exceeds 280 chars', async () => {
    const oversizedXDraft: ScoredDraft = {
      content: 'A'.repeat(300),
      platform: 'x_single',
      topicBrief: { headline: 'Something', keywords: [] },
    };

    // Force AI to fail so heuristic runs
    mockOrchestrator.chat.mockRejectedValue(new Error('fail'));

    const result = await scorer.score(oversizedXDraft);

    expect(result.breakdown.platformFit).toBe(0);
    expect(result.suggestions.some(s => s.includes('280'))).toBe(true);
  });

  // ── Test 4b: LinkedIn content within 1300 chars scores better platformFit
  //             than content that blows the limit ──────────────────────────

  it('should score platformFit higher for linkedin content within the 1300-char limit than over it', async () => {
    // Content well within 1300 chars (and above the 10% floor = 130 chars)
    const withinLimitDraft: ScoredDraft = {
      content: 'A'.repeat(500),
      platform: 'linkedin',
      topicBrief: { headline: 'LinkedIn Tips', keywords: [] },
    };

    const overLimitDraft: ScoredDraft = {
      content: 'A'.repeat(1400),
      platform: 'linkedin',
      topicBrief: { headline: 'LinkedIn Tips', keywords: [] },
    };

    mockOrchestrator.chat.mockRejectedValue(new Error('fail'));

    const withinResult = await scorer.score(withinLimitDraft);
    const overResult = await scorer.score(overLimitDraft);

    expect(withinResult.breakdown.platformFit).toBeGreaterThan(overResult.breakdown.platformFit);
    expect(overResult.breakdown.platformFit).toBe(0);
    expect(overResult.suggestions.some(s => s.includes('1300'))).toBe(true);
  });

  // ── Test 5: No structure gets low structure score ────────────────────────

  it('should give low structure score when content has no headings or bullets', async () => {
    const unstructuredDraft: ScoredDraft = {
      content: 'Just one paragraph with no formatting at all and it goes on and on without any clear sections.',
      platform: 'blog_outline',
      topicBrief: { headline: 'Blog Post', keywords: [] },
    };

    mockOrchestrator.chat.mockRejectedValue(new Error('fail'));

    const result = await scorer.score(unstructuredDraft);

    expect(result.breakdown.structure).toBeLessThan(8);
    expect(result.suggestions.some(s => /heading|bullet/i.test(s))).toBe(true);
  });

  // ── Test 6: Keyword presence raises keywordOptimization ──────────────────

  it('should give higher keywordOptimization to content that includes target keywords', async () => {
    mockOrchestrator.chat.mockRejectedValue(new Error('fail'));

    const withKeywords: ScoredDraft = {
      content: 'Claude 4.6 is the best AI agent model. Solo devs love using AI agents to automate tasks.',
      platform: 'linkedin',
      topicBrief: {
        headline: 'Claude 4.6 for Solo Devs',
        keywords: ['Claude 4.6', 'AI agents', 'solo devs'],
      },
    };

    const withoutKeywords: ScoredDraft = {
      content: 'This new release is great. Many developers enjoy using it.',
      platform: 'linkedin',
      topicBrief: {
        headline: 'Claude 4.6 for Solo Devs',
        keywords: ['Claude 4.6', 'AI agents', 'solo devs'],
      },
    };

    const withResult = await scorer.score(withKeywords);
    const withoutResult = await scorer.score(withoutKeywords);

    expect(withResult.breakdown.keywordOptimization).toBeGreaterThan(
      withoutResult.breakdown.keywordOptimization,
    );
  });

  // ── Test 7: Suggestions are actionable strings ────────────────────────────

  it('should return actionable suggestions as non-empty strings', async () => {
    mockOrchestrator.chat.mockResolvedValue(
      makeAiResponse({
        suggestions: [
          'Add a call-to-action at the end.',
          'Include more target keywords in the opening paragraph.',
        ],
      }),
    );

    const result = await scorer.score(wellWrittenDraft);

    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
    result.suggestions.forEach(s => {
      expect(typeof s).toBe('string');
      expect(s.trim().length).toBeGreaterThan(0);
    });
  });

  // ── Test 8: Total equals sum of breakdown ────────────────────────────────

  it('should calculate total as the exact sum of all breakdown dimensions', async () => {
    mockOrchestrator.chat.mockResolvedValue(
      makeAiResponse({
        searchIntent: 10,
        keywordOptimization: 11,
        readability: 12,
        structure: 9,
        engagement: 7,
        originality: 6,
        platformFit: 8,
        voiceMatch: 7,
        suggestions: [],
      }),
    );

    const result = await scorer.score(wellWrittenDraft);
    const { breakdown } = result;

    const expectedTotal =
      breakdown.searchIntent +
      breakdown.keywordOptimization +
      breakdown.readability +
      breakdown.structure +
      breakdown.engagement +
      breakdown.originality +
      breakdown.platformFit +
      breakdown.voiceMatch;

    expect(result.total).toBe(expectedTotal);
  });

  // ── Test 9: Unparseable AI response falls back to heuristic ──────────────

  it('should fall back to heuristic when AI returns invalid JSON', async () => {
    mockOrchestrator.chat.mockResolvedValue('Sorry, I cannot score that content.');

    const result = await scorer.score(wellWrittenDraft);

    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('breakdown');
    expect(typeof result.total).toBe('number');
  });

  // ── Test 10: Breakdown values stay within declared ranges ─────────────────

  it('should clamp all breakdown values within their declared ranges', async () => {
    mockOrchestrator.chat.mockResolvedValue(
      makeAiResponse({
        searchIntent: 999,    // beyond max 15
        engagement: -5,       // below min 0
        platformFit: 100,     // beyond max 10
      }),
    );

    const result = await scorer.score(wellWrittenDraft);
    const b = result.breakdown;

    expect(b.searchIntent).toBeLessThanOrEqual(15);
    expect(b.searchIntent).toBeGreaterThanOrEqual(0);
    expect(b.keywordOptimization).toBeLessThanOrEqual(15);
    expect(b.readability).toBeLessThanOrEqual(15);
    expect(b.structure).toBeLessThanOrEqual(15);
    expect(b.engagement).toBeLessThanOrEqual(10);
    expect(b.engagement).toBeGreaterThanOrEqual(0);
    expect(b.originality).toBeLessThanOrEqual(10);
    expect(b.platformFit).toBeLessThanOrEqual(10);
    expect(b.platformFit).toBeGreaterThanOrEqual(0);
    expect(b.voiceMatch).toBeLessThanOrEqual(10);
  });

  // ── Test 11: Corporate jargon lowers voiceMatch in heuristic ─────────────

  it('should lower voiceMatch score in heuristic when content has corporate jargon', async () => {
    mockOrchestrator.chat.mockRejectedValue(new Error('fail'));

    const jargonDraft: ScoredDraft = {
      content: 'We must leverage synergy to facilitate a holistic paradigm shift.',
      platform: 'linkedin',
      topicBrief: { headline: 'Business Growth', keywords: [] },
    };

    const result = await scorer.score(jargonDraft);

    expect(result.breakdown.voiceMatch).toBeLessThan(8);
    expect(result.suggestions.some(s => /jargon/i.test(s))).toBe(true);
  });
});
