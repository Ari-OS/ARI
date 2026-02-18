import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalysisAgent } from '../../../src/agents/analysis-agent.js';
import type { AnalysisResult } from '../../../src/agents/analysis-agent.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockExecute = vi.fn();
const mockEmit = vi.fn();

const mockOrchestrator = { execute: mockExecute } as unknown as ConstructorParameters<typeof AnalysisAgent>[0]['orchestrator'];
const mockEventBus = { emit: mockEmit } as unknown as ConstructorParameters<typeof AnalysisAgent>[0]['eventBus'];

vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AnalysisAgent', () => {
  let agent: AnalysisAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new AnalysisAgent({
      orchestrator: mockOrchestrator,
      eventBus: mockEventBus,
    });
  });

  describe('analyze() — happy path', () => {
    it('should return structured analysis from valid JSON response', async () => {
      mockExecute.mockResolvedValueOnce({
        content: JSON.stringify({
          answer: 'Revenue grew 15%',
          insights: ['Seasonal trend', 'New product line'],
          confidence: 0.85,
          dataPoints: 42,
        }),
      });

      const result = await agent.analyze('revenue data...', 'What is the trend?');

      expect(result.answer).toBe('Revenue grew 15%');
      expect(result.insights).toEqual(['Seasonal trend', 'New product line']);
      expect(result.confidence).toBe(0.85);
      expect(result.dataPoints).toBe(42);
    });

    it('should pass question and data to orchestrator with correct params', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"answer":"a","insights":[],"confidence":0.5,"dataPoints":1}' });

      await agent.analyze('some data', 'What happened?');

      expect(mockExecute).toHaveBeenCalledOnce();
      const callArg = mockExecute.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.content).toContain('What happened?');
      expect(callArg.content).toContain('some data');
      expect(callArg.category).toBe('analysis');
      expect(callArg.agent).toBe('analysis_agent');
      expect(callArg.maxTokens).toBe(2048);
    });

    it('should emit analysis_started and analysis_completed events', async () => {
      mockExecute.mockResolvedValueOnce({
        content: '{"answer":"a","insights":["i"],"confidence":0.9,"dataPoints":5}',
      });

      await agent.analyze('data', 'question');

      expect(mockEmit).toHaveBeenCalledWith('agent:analysis_started', expect.objectContaining({
        question: 'question',
      }));
      expect(mockEmit).toHaveBeenCalledWith('agent:analysis_completed', expect.objectContaining({
        question: 'question',
        dataPoints: 5,
        confidence: 0.9,
      }));
    });
  });

  describe('analyze() — data point estimation', () => {
    it('should estimate data points from newlines when LLM does not provide a number', async () => {
      const data = 'line1\nline2\nline3\nline4';
      mockExecute.mockResolvedValueOnce({
        content: '{"answer":"a","insights":[],"confidence":0.5}',
      });

      const result = await agent.analyze(data, 'question');

      expect(result.dataPoints).toBe(4);
    });

    it('should use LLM-provided dataPoints when available', async () => {
      mockExecute.mockResolvedValueOnce({
        content: '{"answer":"a","insights":[],"confidence":0.5,"dataPoints":100}',
      });

      const result = await agent.analyze('one line', 'question');

      expect(result.dataPoints).toBe(100);
    });

    it('should skip empty lines when estimating data points', async () => {
      const data = 'line1\n\n\nline2\n';
      mockExecute.mockResolvedValueOnce({ content: 'plain text' });

      const result = await agent.analyze(data, 'question');

      expect(result.dataPoints).toBe(2);
    });
  });

  describe('analyze() — JSON parsing', () => {
    it('should extract JSON from surrounding text', async () => {
      mockExecute.mockResolvedValueOnce({
        content: 'Here is my analysis: {"answer":"yes","insights":["x"],"confidence":0.7,"dataPoints":3} Done.',
      });

      const result = await agent.analyze('data', 'q');

      expect(result.answer).toBe('yes');
      expect(result.insights).toEqual(['x']);
    });

    it('should fallback to raw content as answer when no JSON found', async () => {
      mockExecute.mockResolvedValueOnce({ content: 'No JSON here, just analysis.' });

      const result = await agent.analyze('data', 'q');

      expect(result.answer).toBe('No JSON here, just analysis.');
      expect(result.insights).toEqual([]);
      expect(result.confidence).toBe(0.5);
    });

    it('should handle invalid JSON gracefully', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{broken json' });

      const result = await agent.analyze('data', 'q');

      expect(result.answer).toBeDefined();
      expect(result.confidence).toBe(0.5);
    });

    it('should default confidence to 0.5 when not a number', async () => {
      mockExecute.mockResolvedValueOnce({
        content: '{"answer":"a","insights":[],"confidence":"very high","dataPoints":1}',
      });

      const result = await agent.analyze('data', 'q');

      expect(result.confidence).toBe(0.5);
    });

    it('should default answer to raw content when not a string', async () => {
      mockExecute.mockResolvedValueOnce({
        content: '{"answer":42,"insights":[],"confidence":0.5,"dataPoints":1}',
      });

      const result = await agent.analyze('data', 'q');

      expect(typeof result.answer).toBe('string');
    });

    it('should coerce non-array insights to empty array', async () => {
      mockExecute.mockResolvedValueOnce({
        content: '{"answer":"a","insights":"not array","confidence":0.5,"dataPoints":1}',
      });

      const result = await agent.analyze('data', 'q');

      expect(result.insights).toEqual([]);
    });

    it('should convert non-string insight items to strings', async () => {
      mockExecute.mockResolvedValueOnce({
        content: '{"answer":"a","insights":[1,true,null],"confidence":0.5,"dataPoints":1}',
      });

      const result = await agent.analyze('data', 'q');

      expect(result.insights).toEqual(['1', 'true', 'null']);
    });
  });

  describe('analyze() — error handling', () => {
    it('should return error result on orchestrator failure', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Model overloaded'));

      const result = await agent.analyze('data', 'q');

      expect(result.answer).toContain('Analysis failed');
      expect(result.answer).toContain('Model overloaded');
      expect(result.insights).toEqual([]);
      expect(result.confidence).toBe(0);
      expect(result.dataPoints).toBe(0);
    });

    it('should handle non-Error throws', async () => {
      mockExecute.mockRejectedValueOnce('raw string error');

      const result = await agent.analyze('data', 'q');

      expect(result.answer).toContain('Analysis failed');
      expect(result.answer).toContain('raw string error');
    });

    it('should not emit analysis_completed on failure', async () => {
      mockExecute.mockRejectedValueOnce(new Error('fail'));

      await agent.analyze('data', 'q');

      expect(mockEmit).not.toHaveBeenCalledWith('agent:analysis_completed', expect.anything());
    });

    it('should still emit analysis_started before failure', async () => {
      mockExecute.mockRejectedValueOnce(new Error('fail'));

      await agent.analyze('data', 'q');

      expect(mockEmit).toHaveBeenCalledWith('agent:analysis_started', expect.anything());
    });
  });

  describe('analyze() — edge cases', () => {
    it('should handle empty data string', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"answer":"no data","insights":[],"confidence":0.1,"dataPoints":0}' });

      const result = await agent.analyze('', 'q');

      expect(result).toBeDefined();
    });

    it('should handle empty question string', async () => {
      mockExecute.mockResolvedValueOnce({ content: '{"answer":"a","insights":[],"confidence":0.5,"dataPoints":1}' });

      const result = await agent.analyze('data', '');

      expect(result).toBeDefined();
    });
  });
});
