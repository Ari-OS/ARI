import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResearchAgent } from '../../../src/agents/research-agent.js';
import type { ResearchResult } from '../../../src/agents/research-agent.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockExecute = vi.fn();
const mockEmit = vi.fn();

const mockOrchestrator = { execute: mockExecute } as unknown as Parameters<typeof ResearchAgent['prototype']['research']> extends never[] ? never : ConstructorParameters<typeof ResearchAgent>[0]['orchestrator'];
const mockEventBus = { emit: mockEmit } as unknown as ConstructorParameters<typeof ResearchAgent>[0]['eventBus'];

vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ResearchAgent', () => {
  let agent: ResearchAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ResearchAgent({
      orchestrator: mockOrchestrator,
      eventBus: mockEventBus,
    });
  });

  describe('research() — happy path', () => {
    it('should return structured findings from valid JSON response', async () => {
      mockExecute.mockResolvedValueOnce({
        content: JSON.stringify({
          findings: ['finding 1', 'finding 2'],
          sources: ['source A'],
          confidence: 0.9,
          summary: 'A concise summary.',
        }),
      });

      const result = await agent.research('test query');

      expect(result.findings).toEqual(['finding 1', 'finding 2']);
      expect(result.sources).toEqual(['source A']);
      expect(result.confidence).toBe(0.9);
      expect(result.summary).toBe('A concise summary.');
    });

    it('should pass the query and category to the orchestrator', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"findings":[],"sources":[],"confidence":0.5,"summary":"ok"}' });

      await agent.research('quantum computing');

      expect(mockExecute).toHaveBeenCalledOnce();
      const callArg = mockExecute.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.content).toBe('quantum computing');
      expect(callArg.category).toBe('research');
      expect(callArg.agent).toBe('research_agent');
      expect(callArg.maxTokens).toBe(2048);
    });

    it('should emit research_started and research_completed events', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"findings":["f"],"sources":[],"confidence":0.7,"summary":"s"}' });

      await agent.research('topic', ['src1']);

      expect(mockEmit).toHaveBeenCalledWith('agent:research_started', expect.objectContaining({
        query: 'topic',
        sources: ['src1'],
      }));
      expect(mockEmit).toHaveBeenCalledWith('agent:research_completed', expect.objectContaining({
        query: 'topic',
        findingsCount: 1,
        confidence: 0.7,
      }));
    });

    it('should include source constraints in system prompt when sources provided', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"findings":[],"sources":[],"confidence":0.5,"summary":"ok"}' });

      await agent.research('query', ['Wikipedia', 'ArXiv']);

      const callArg = mockExecute.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.systemPrompt).toContain('Wikipedia');
      expect(callArg.systemPrompt).toContain('ArXiv');
    });

    it('should not mention sources in prompt when none provided', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"findings":[],"sources":[],"confidence":0.5,"summary":"ok"}' });

      await agent.research('query');

      const callArg = mockExecute.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.systemPrompt).not.toContain('Focus on these sources');
    });
  });

  describe('research() — JSON parsing', () => {
    it('should extract JSON from a response with surrounding text', async () => {
      mockExecute.mockResolvedValueOnce({
        content: 'Here is the result: {"findings":["a"],"sources":["b"],"confidence":0.8,"summary":"done"} end.',
      });

      const result = await agent.research('test');

      expect(result.findings).toEqual(['a']);
      expect(result.sources).toEqual(['b']);
      expect(result.confidence).toBe(0.8);
    });

    it('should use content as single finding when no JSON found', async () => {
      mockExecute.mockResolvedValueOnce({ content: 'Just a plain text response.' });

      const result = await agent.research('test');

      expect(result.findings).toEqual(['Just a plain text response.']);
      expect(result.sources).toEqual([]);
      expect(result.confidence).toBe(0.5);
    });

    it('should handle invalid JSON gracefully with fallback', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{not valid json at all' });

      const result = await agent.research('test');

      expect(result.findings).toHaveLength(1);
      expect(result.confidence).toBe(0.5);
    });

    it('should coerce non-array findings to single content finding', async () => {
      mockExecute.mockResolvedValueOnce({
        content: '{"findings":"not an array","sources":[],"confidence":0.5,"summary":"s"}',
      });

      const result = await agent.research('test');

      expect(result.findings).toHaveLength(1);
    });

    it('should default confidence to 0.5 when not a number', async () => {
      mockExecute.mockResolvedValueOnce({
        content: '{"findings":[],"sources":[],"confidence":"high","summary":"s"}',
      });

      const result = await agent.research('test');

      expect(result.confidence).toBe(0.5);
    });

    it('should use first 200 chars of content as summary when not a string', async () => {
      mockExecute.mockResolvedValueOnce({
        content: '{"findings":[],"sources":[],"confidence":0.5,"summary":42}',
      });

      const result = await agent.research('test');

      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeLessThanOrEqual(200);
    });

    it('should convert non-string sources to strings', async () => {
      mockExecute.mockResolvedValueOnce({
        content: '{"findings":["f"],"sources":[1,2,3],"confidence":0.5,"summary":"s"}',
      });

      const result = await agent.research('test');

      expect(result.sources).toEqual(['1', '2', '3']);
    });
  });

  describe('research() — error handling', () => {
    it('should return empty result with error message on orchestrator failure', async () => {
      mockExecute.mockRejectedValueOnce(new Error('API timeout'));

      const result = await agent.research('test');

      expect(result.findings).toEqual([]);
      expect(result.confidence).toBe(0);
      expect(result.summary).toContain('Research failed');
      expect(result.summary).toContain('API timeout');
    });

    it('should preserve sources in error result', async () => {
      mockExecute.mockRejectedValueOnce(new Error('fail'));

      const result = await agent.research('test', ['source1', 'source2']);

      expect(result.sources).toEqual(['source1', 'source2']);
    });

    it('should handle non-Error throws gracefully', async () => {
      mockExecute.mockRejectedValueOnce('string error');

      const result = await agent.research('test');

      expect(result.summary).toContain('Research failed');
      expect(result.summary).toContain('string error');
    });

    it('should not emit research_completed on failure', async () => {
      mockExecute.mockRejectedValueOnce(new Error('fail'));

      await agent.research('test');

      expect(mockEmit).not.toHaveBeenCalledWith('agent:research_completed', expect.anything());
    });

    it('should still emit research_started before failure', async () => {
      mockExecute.mockRejectedValueOnce(new Error('fail'));

      await agent.research('test');

      expect(mockEmit).toHaveBeenCalledWith('agent:research_started', expect.anything());
    });
  });

  describe('research() — edge cases', () => {
    it('should handle empty query string', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"findings":[],"sources":[],"confidence":0.5,"summary":"s"}' });

      const result = await agent.research('');

      expect(result).toBeDefined();
      expect(mockExecute).toHaveBeenCalledOnce();
    });

    it('should handle empty sources array', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"findings":["f"],"sources":[],"confidence":0.5,"summary":"s"}' });

      const result = await agent.research('q', []);

      expect(result.sources).toEqual([]);
    });

    it('should handle very long query strings', async () => {
      const longQuery = 'a'.repeat(10000);
      mockExecute.mockResolvedValueOnce({ content: '{"findings":[],"sources":[],"confidence":0.5,"summary":"s"}' });

      const result = await agent.research(longQuery);

      expect(result).toBeDefined();
      const callArg = mockExecute.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.content).toBe(longQuery);
    });
  });
});
