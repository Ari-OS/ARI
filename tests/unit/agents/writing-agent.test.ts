import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WritingAgent } from '../../../src/agents/writing-agent.js';
import type { WritingFormat, WritingResult } from '../../../src/agents/writing-agent.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockExecute = vi.fn();
const mockEmit = vi.fn();

const mockOrchestrator = { execute: mockExecute } as unknown as ConstructorParameters<typeof WritingAgent>[0]['orchestrator'];
const mockEventBus = { emit: mockEmit } as unknown as ConstructorParameters<typeof WritingAgent>[0]['eventBus'];

vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../../src/plugins/content-engine/humanizer.js', () => ({
  humanizeQuick: (s: string) => s.replace(/^Certainly[!,.]?\s*/im, ''),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WritingAgent', () => {
  let agent: WritingAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new WritingAgent({
      orchestrator: mockOrchestrator,
      eventBus: mockEventBus,
    });
  });

  describe('draft() — happy path', () => {
    it('should return structured writing result from valid JSON response', async () => {
      mockExecute.mockResolvedValueOnce({
        content: JSON.stringify({
          content: 'Great blog post about AI.',
          suggestions: ['Add more examples', 'Shorten intro'],
        }),
      });

      const result = await agent.draft('AI advances', 'blog');

      expect(result.content).toBeDefined();
      expect(result.format).toBe('blog');
      expect(result.suggestions).toHaveLength(2);
      expect(result.wordCount).toBeGreaterThan(0);
    });

    it('should pass topic with correct category to orchestrator', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"content":"output","suggestions":[]}' });

      await agent.draft('test topic', 'tweet');

      const callArg = mockExecute.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.content).toContain('test topic');
      expect(callArg.category).toBe('creative');
      expect(callArg.agent).toBe('writing_agent');
    });

    it('should emit writing_started and writing_completed events', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"content":"hello world","suggestions":[]}' });

      await agent.draft('topic', 'email');

      expect(mockEmit).toHaveBeenCalledWith('agent:writing_started', expect.objectContaining({
        topic: 'topic',
        format: 'email',
      }));
      expect(mockEmit).toHaveBeenCalledWith('agent:writing_completed', expect.objectContaining({
        topic: 'topic',
        format: 'email',
      }));
    });

    it('should include context in system prompt when provided', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"content":"output","suggestions":[]}' });

      await agent.draft('topic', 'blog', 'for a tech audience');

      const callArg = mockExecute.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.systemPrompt).toContain('for a tech audience');
    });

    it('should not include context in prompt when not provided', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"content":"output","suggestions":[]}' });

      await agent.draft('topic', 'blog');

      const callArg = mockExecute.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.systemPrompt).not.toContain('Additional context');
    });

    it('should apply humanizeQuick to the output content', async () => {
      mockExecute.mockResolvedValueOnce({
        content: '{"content":"Certainly! Here is the content.","suggestions":[]}',
      });

      const result = await agent.draft('topic', 'blog');

      expect(result.content).not.toContain('Certainly');
    });

    it('should compute word count after humanization', async () => {
      mockExecute.mockResolvedValueOnce({
        content: '{"content":"one two three four five","suggestions":[]}',
      });

      const result = await agent.draft('topic', 'blog');

      expect(result.wordCount).toBe(5);
    });
  });

  describe('draft() — format prompts', () => {
    const formats: WritingFormat[] = ['blog', 'tweet', 'script', 'email'];

    for (const format of formats) {
      it(`should include ${format}-specific instructions in prompt`, async () => {
        mockExecute.mockResolvedValueOnce({ content: '{"content":"text","suggestions":[]}' });

        await agent.draft('topic', format);

        const callArg = mockExecute.mock.calls[0][0] as Record<string, unknown>;
        expect(typeof callArg.systemPrompt).toBe('string');
        // Each format should have unique instructions
        expect((callArg.systemPrompt as string).length).toBeGreaterThan(50);
      });
    }
  });

  describe('draft() — JSON parsing fallback', () => {
    it('should use raw content when no JSON found', async () => {
      mockExecute.mockResolvedValueOnce({ content: 'Plain text response without JSON.' });

      const result = await agent.draft('topic', 'tweet');

      expect(result.content).toBe('Plain text response without JSON.');
      expect(result.suggestions).toEqual([]);
    });

    it('should handle malformed JSON gracefully', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{broken json here' });

      const result = await agent.draft('topic', 'blog');

      expect(result.content).toBeDefined();
      expect(result.suggestions).toEqual([]);
    });

    it('should convert non-string suggestions to strings', async () => {
      mockExecute.mockResolvedValueOnce({
        content: '{"content":"text","suggestions":[1,true,"real"]}',
      });

      const result = await agent.draft('topic', 'blog');

      expect(result.suggestions).toEqual(['1', 'true', 'real']);
    });

    it('should default suggestions to empty array when not an array', async () => {
      mockExecute.mockResolvedValueOnce({
        content: '{"content":"text","suggestions":"not an array"}',
      });

      const result = await agent.draft('topic', 'blog');

      expect(result.suggestions).toEqual([]);
    });
  });

  describe('draft() — error handling', () => {
    it('should return error result on orchestrator failure', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Rate limited'));

      const result = await agent.draft('topic', 'blog');

      expect(result.content).toContain('Writing failed');
      expect(result.content).toContain('Rate limited');
      expect(result.wordCount).toBe(0);
      expect(result.format).toBe('blog');
      expect(result.suggestions).toEqual([]);
    });

    it('should handle non-Error throws', async () => {
      mockExecute.mockRejectedValueOnce('unexpected failure');

      const result = await agent.draft('topic', 'tweet');

      expect(result.content).toContain('Writing failed');
      expect(result.content).toContain('unexpected failure');
    });

    it('should not emit writing_completed on failure', async () => {
      mockExecute.mockRejectedValueOnce(new Error('fail'));

      await agent.draft('topic', 'blog');

      expect(mockEmit).not.toHaveBeenCalledWith('agent:writing_completed', expect.anything());
    });

    it('should still emit writing_started before failure', async () => {
      mockExecute.mockRejectedValueOnce(new Error('fail'));

      await agent.draft('topic', 'blog');

      expect(mockEmit).toHaveBeenCalledWith('agent:writing_started', expect.anything());
    });
  });

  describe('draft() — edge cases', () => {
    it('should handle empty topic', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"content":"output","suggestions":[]}' });

      const result = await agent.draft('', 'blog');

      expect(result).toBeDefined();
    });

    it('should handle content that becomes empty after humanization', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"content":"Certainly!","suggestions":[]}' });

      const result = await agent.draft('topic', 'blog');

      expect(typeof result.wordCount).toBe('number');
    });
  });
});
