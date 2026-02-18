import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentCoordinator } from '../../../src/agents/coordinator.js';
import type { CoordinatorTask, CoordinatorResult } from '../../../src/agents/coordinator.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockResearch = vi.fn();
const mockDraft = vi.fn();
const mockAnalyze = vi.fn();
const mockEmit = vi.fn();

const mockResearchAgent = { research: mockResearch } as unknown as ConstructorParameters<typeof AgentCoordinator>[0]['researchAgent'];
const mockWritingAgent = { draft: mockDraft } as unknown as ConstructorParameters<typeof AgentCoordinator>[0]['writingAgent'];
const mockAnalysisAgent = { analyze: mockAnalyze } as unknown as ConstructorParameters<typeof AgentCoordinator>[0]['analysisAgent'];
const mockEventBus = { emit: mockEmit } as unknown as ConstructorParameters<typeof AgentCoordinator>[0]['eventBus'];
const mockOrchestrator = {} as unknown as ConstructorParameters<typeof AgentCoordinator>[0]['orchestrator'];

vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AgentCoordinator', () => {
  let coordinator: AgentCoordinator;

  beforeEach(() => {
    vi.clearAllMocks();
    coordinator = new AgentCoordinator({
      researchAgent: mockResearchAgent,
      writingAgent: mockWritingAgent,
      analysisAgent: mockAnalysisAgent,
      eventBus: mockEventBus,
      orchestrator: mockOrchestrator,
    });
  });

  describe('dispatch() — routing', () => {
    it('should route research tasks to the research agent', async () => {
      mockResearch.mockResolvedValueOnce({ findings: ['f'], confidence: 0.8 });

      const tasks: CoordinatorTask[] = [
        { type: 'research', payload: { query: 'test query', sources: ['s1'] } },
      ];

      const results = await coordinator.dispatch(tasks);

      expect(mockResearch).toHaveBeenCalledWith('test query', ['s1']);
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('research');
      expect(results[0].status).toBe('success');
    });

    it('should route write tasks to the writing agent', async () => {
      mockDraft.mockResolvedValueOnce({ content: 'blog post', wordCount: 10 });

      const tasks: CoordinatorTask[] = [
        { type: 'write', payload: { topic: 'AI', format: 'blog', context: 'tech' } },
      ];

      const results = await coordinator.dispatch(tasks);

      expect(mockDraft).toHaveBeenCalledWith('AI', 'blog', 'tech');
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('write');
      expect(results[0].status).toBe('success');
    });

    it('should route analyze tasks to the analysis agent', async () => {
      mockAnalyze.mockResolvedValueOnce({ answer: 'yes', confidence: 0.9 });

      const tasks: CoordinatorTask[] = [
        { type: 'analyze', payload: { data: 'raw data', question: 'what?' } },
      ];

      const results = await coordinator.dispatch(tasks);

      expect(mockAnalyze).toHaveBeenCalledWith('raw data', 'what?');
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('analyze');
      expect(results[0].status).toBe('success');
    });

    it('should handle unknown task types as failed', async () => {
      const tasks: CoordinatorTask[] = [
        { type: 'unknown_type' as CoordinatorTask['type'], payload: {} },
      ];

      const results = await coordinator.dispatch(tasks);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('failed');
      expect(results[0].error).toContain('unknown task type');
    });
  });

  describe('dispatch() — parallel execution', () => {
    it('should process multiple tasks in parallel', async () => {
      mockResearch.mockResolvedValueOnce({ findings: ['f'] });
      mockDraft.mockResolvedValueOnce({ content: 'text' });
      mockAnalyze.mockResolvedValueOnce({ answer: 'yes' });

      const tasks: CoordinatorTask[] = [
        { type: 'research', payload: { query: 'q1' } },
        { type: 'write', payload: { topic: 't1', format: 'blog' } },
        { type: 'analyze', payload: { data: 'd1', question: 'q1' } },
      ];

      const results = await coordinator.dispatch(tasks);

      expect(results).toHaveLength(3);
      expect(results.filter(r => r.status === 'success')).toHaveLength(3);
    });

    it('should handle batch processing for >5 concurrent tasks', async () => {
      // Create 7 tasks — should process in 2 batches (5 + 2)
      const tasks: CoordinatorTask[] = [];
      for (let i = 0; i < 7; i++) {
        mockResearch.mockResolvedValueOnce({ findings: [`f${i}`] });
        tasks.push({ type: 'research', payload: { query: `q${i}` } });
      }

      const results = await coordinator.dispatch(tasks);

      expect(results).toHaveLength(7);
      expect(mockResearch).toHaveBeenCalledTimes(7);
    });
  });

  describe('dispatch() — fault tolerance', () => {
    it('should continue processing when one task fails', async () => {
      mockResearch.mockRejectedValueOnce(new Error('research failed'));
      mockDraft.mockResolvedValueOnce({ content: 'text' });

      const tasks: CoordinatorTask[] = [
        { type: 'research', payload: { query: 'q1' } },
        { type: 'write', payload: { topic: 't1', format: 'blog' } },
      ];

      const results = await coordinator.dispatch(tasks);

      expect(results).toHaveLength(2);
      const failed = results.find(r => r.status === 'failed');
      const succeeded = results.find(r => r.status === 'success');
      expect(failed).toBeDefined();
      expect(succeeded).toBeDefined();
    });

    it('should capture error message from failed tasks', async () => {
      mockResearch.mockRejectedValueOnce(new Error('API timeout'));

      const tasks: CoordinatorTask[] = [
        { type: 'research', payload: { query: 'q' } },
      ];

      const results = await coordinator.dispatch(tasks);

      expect(results[0].error).toBe('API timeout');
    });

    it('should handle non-Error thrown values', async () => {
      mockResearch.mockRejectedValueOnce('string error');

      const tasks: CoordinatorTask[] = [
        { type: 'research', payload: { query: 'q' } },
      ];

      const results = await coordinator.dispatch(tasks);

      expect(results[0].status).toBe('failed');
      expect(results[0].error).toBe('string error');
    });

    it('should handle all tasks failing', async () => {
      mockResearch.mockRejectedValueOnce(new Error('fail1'));
      mockDraft.mockRejectedValueOnce(new Error('fail2'));

      const tasks: CoordinatorTask[] = [
        { type: 'research', payload: { query: 'q' } },
        { type: 'write', payload: { topic: 't', format: 'blog' } },
      ];

      const results = await coordinator.dispatch(tasks);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.status === 'failed')).toBe(true);
    });
  });

  describe('dispatch() — result structure', () => {
    it('should include taskId in each result', async () => {
      mockResearch.mockResolvedValueOnce({ findings: [] });

      const results = await coordinator.dispatch([
        { type: 'research', payload: { query: 'q' } },
      ]);

      expect(results[0].taskId).toBeDefined();
      expect(typeof results[0].taskId).toBe('string');
      expect(results[0].taskId.length).toBeGreaterThan(0);
    });

    it('should include durationMs in each result', async () => {
      mockResearch.mockResolvedValueOnce({ findings: [] });

      const results = await coordinator.dispatch([
        { type: 'research', payload: { query: 'q' } },
      ]);

      expect(typeof results[0].durationMs).toBe('number');
      expect(results[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include the result data for successful tasks', async () => {
      const mockResult = { findings: ['f1'], confidence: 0.9 };
      mockResearch.mockResolvedValueOnce(mockResult);

      const results = await coordinator.dispatch([
        { type: 'research', payload: { query: 'q' } },
      ]);

      expect(results[0].result).toEqual(mockResult);
    });
  });

  describe('dispatch() — events', () => {
    it('should emit dispatch_started event', async () => {
      const results = await coordinator.dispatch([]);

      expect(mockEmit).toHaveBeenCalledWith('coordinator:dispatch_started', expect.objectContaining({
        taskCount: 0,
      }));
    });

    it('should emit dispatch_completed event with success/failure counts', async () => {
      mockResearch.mockResolvedValueOnce({ findings: [] });
      mockDraft.mockRejectedValueOnce(new Error('fail'));

      await coordinator.dispatch([
        { type: 'research', payload: { query: 'q' } },
        { type: 'write', payload: { topic: 't', format: 'blog' } },
      ]);

      expect(mockEmit).toHaveBeenCalledWith('coordinator:dispatch_completed', expect.objectContaining({
        taskCount: 2,
        successCount: 1,
        failedCount: 1,
      }));
    });

    it('should include durationMs in completed event', async () => {
      await coordinator.dispatch([]);

      expect(mockEmit).toHaveBeenCalledWith('coordinator:dispatch_completed', expect.objectContaining({
        durationMs: expect.any(Number),
      }));
    });
  });

  describe('dispatch() — edge cases', () => {
    it('should handle empty task array', async () => {
      const results = await coordinator.dispatch([]);

      expect(results).toEqual([]);
    });

    it('should handle single task array', async () => {
      mockResearch.mockResolvedValueOnce({ findings: ['f'] });

      const results = await coordinator.dispatch([
        { type: 'research', payload: { query: 'q' } },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('success');
    });

    it('should handle exactly MAX_CONCURRENCY (5) tasks in one batch', async () => {
      for (let i = 0; i < 5; i++) {
        mockResearch.mockResolvedValueOnce({ findings: [`f${i}`] });
      }

      const tasks: CoordinatorTask[] = Array.from({ length: 5 }, (_, i) => ({
        type: 'research' as const,
        payload: { query: `q${i}` },
      }));

      const results = await coordinator.dispatch(tasks);

      expect(results).toHaveLength(5);
      expect(mockResearch).toHaveBeenCalledTimes(5);
    });
  });
});
