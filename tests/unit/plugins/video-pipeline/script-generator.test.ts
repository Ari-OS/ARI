import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScriptGenerator } from '../../../../src/plugins/video-pipeline/script-generator.js';
import type { VideoScript } from '../../../../src/plugins/video-pipeline/types.js';

// ── Mock Orchestrator ────────────────────────────────────────────────────────

const mockOrchestrator = {
  chat: vi.fn<Parameters<typeof mockFn>, ReturnType<typeof mockFn>>(),
};

// Workaround for vi.fn() typing in this context
function mockFn(_messages: Array<{ role: string; content: string }>, _systemPrompt?: string): Promise<string> {
  return Promise.resolve('');
}

// ── Sample Data ──────────────────────────────────────────────────────────────

const sampleOutline: VideoScript['outline'] = {
  hook: 'Most people waste 80% of their time doing work that pays nothing.',
  sections: [
    {
      heading: 'The Time Audit',
      keyPoints: ['Track every hour for 7 days', 'Find the 20% that drives 80% of revenue', 'Cut the rest'],
    },
    {
      heading: 'The High-Value Work Filter',
      keyPoints: ['What pays over $100/hour?', 'What could you delegate today?', 'What is only you can do?'],
    },
  ],
  cta: 'Comment "AUDIT" and I will send you the free time audit template.',
};

const sampleScript: VideoScript = {
  id: 'test-id-123',
  topic: 'How to reclaim 20 hours a week',
  outline: sampleOutline,
  fullScript: 'Most people waste 80% of their time. '.repeat(60), // ~390 words
  estimatedDuration: 2.6,
  status: 'draft',
  version: 1,
  createdAt: new Date().toISOString(),
};

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('ScriptGenerator', () => {
  let generator: ScriptGenerator;

  beforeEach(() => {
    vi.resetAllMocks();
    generator = new ScriptGenerator(mockOrchestrator);
  });

  // ── Test 1: Research ──────────────────────────────────────────────────────

  it('should generate research context', async () => {
    mockOrchestrator.chat.mockResolvedValue(
      '1. 80% of workers spend time on low-value tasks\n2. Average knowledge worker wastes 4.1 hours daily\n3. Time blocking improves output by 40%',
    );

    const result = await generator.research('time management for entrepreneurs');

    expect(result).toContain('80%');
    expect(mockOrchestrator.chat).toHaveBeenCalledTimes(1);
    const [messages] = mockOrchestrator.chat.mock.calls[0] as [Array<{ role: string; content: string }>];
    expect(messages[0]?.content).toContain('time management for entrepreneurs');
  });

  // ── Test 2: Generate Outline ──────────────────────────────────────────────

  it('should create outline with hook, sections, and CTA', async () => {
    mockOrchestrator.chat.mockResolvedValue(JSON.stringify(sampleOutline));

    const result = await generator.generateOutline(
      'How to reclaim 20 hours a week',
      'research context here',
    );

    expect(result.hook).toBeTruthy();
    expect(result.sections.length).toBeGreaterThanOrEqual(1);
    expect(result.sections[0]).toHaveProperty('heading');
    expect(result.sections[0]).toHaveProperty('keyPoints');
    expect(Array.isArray(result.sections[0]?.keyPoints)).toBe(true);
    expect(result.cta).toBeTruthy();
  });

  // ── Test 3: Write Full Script ─────────────────────────────────────────────

  it('should write full script from outline', async () => {
    const fullText = 'Most people waste 80% of their time doing work that pays nothing. '.repeat(35);
    mockOrchestrator.chat.mockResolvedValue(fullText);

    const result = await generator.writeScript(sampleOutline);

    expect(result.length).toBeGreaterThan(100);
    expect(mockOrchestrator.chat).toHaveBeenCalledTimes(1);
    const [messages, systemPrompt] = mockOrchestrator.chat.mock.calls[0] as [
      Array<{ role: string; content: string }>,
      string | undefined,
    ];
    expect(messages[0]?.content).toContain('1800-2200 words');
    expect(systemPrompt).toBeDefined();
  });

  // ── Test 4: Revise Script with Feedback ───────────────────────────────────

  it('should revise script with feedback and increment version', async () => {
    const revisedText = 'Revised: ' + 'Every second counts. '.repeat(80);
    mockOrchestrator.chat.mockResolvedValue(revisedText);

    const result = await generator.revise(sampleScript, 'Make the hook stronger and shorter.');

    expect(result.version).toBe(sampleScript.version + 1);
    expect(result.fullScript).toBe(revisedText);
    expect(result.id).toBe(sampleScript.id);
    expect(result.topic).toBe(sampleScript.topic);
  });

  // ── Test 5: Handle AI Failure Gracefully ──────────────────────────────────

  it('should handle AI failure gracefully', async () => {
    mockOrchestrator.chat.mockRejectedValue(new Error('AI service unavailable'));

    await expect(generator.research('some topic')).rejects.toThrow('AI service unavailable');
  });

  // ── Test 6: Brand Voice in System Prompt ─────────────────────────────────

  it('should enforce PayThePryce brand voice in system prompt', async () => {
    mockOrchestrator.chat.mockResolvedValue('research results');

    await generator.research('pricing strategy');

    const [, systemPrompt] = mockOrchestrator.chat.mock.calls[0] as [
      Array<{ role: string; content: string }>,
      string | undefined,
    ];
    expect(systemPrompt).toBeDefined();
    expect(systemPrompt).toContain('PayThePryce');
    expect(systemPrompt).toContain('CTAs only at the end');
    expect(systemPrompt).toContain('value-first');
  });

  // ── Test 7: Estimate Duration from Word Count ─────────────────────────────

  it('should estimate duration from word count', async () => {
    // 150 words per minute — 1500 words = ~10 minutes
    const wordCount = 1500;
    const longScript = 'word '.repeat(wordCount).trim();

    // generate() calls: research → generateOutline → writeScript → writeShortsScript (4 AI calls)
    mockOrchestrator.chat
      .mockResolvedValueOnce('research results')                 // research
      .mockResolvedValueOnce(JSON.stringify(sampleOutline))      // generateOutline
      .mockResolvedValueOnce(longScript)                         // writeScript
      .mockResolvedValueOnce('Short hook. Three punchy points. Subscribe!'); // writeShortsScript

    const script = await generator.generate('topic for duration test');

    // 1500 words / 150 wpm = 10.0 minutes
    expect(script.estimatedDuration).toBeCloseTo(10.0, 1);
  });

  // ── Test 8: Increment Version on Revision ────────────────────────────────

  it('should increment version on each revision', async () => {
    mockOrchestrator.chat.mockResolvedValue('First revision text. '.repeat(50));

    const firstRevision = await generator.revise(sampleScript, 'feedback 1');
    expect(firstRevision.version).toBe(2);

    mockOrchestrator.chat.mockResolvedValue('Second revision text. '.repeat(50));

    const secondRevision = await generator.revise(firstRevision, 'feedback 2');
    expect(secondRevision.version).toBe(3);
  });
});
