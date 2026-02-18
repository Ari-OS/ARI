import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoldiLocksGate } from '../../../../src/plugins/content-engine/goldie-locks-gate.js';
import type { ContentScore, GateDecision, ContentFormat } from '../../../../src/plugins/content-engine/goldie-locks-gate.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockQuery = vi.fn();
const mockEmit = vi.fn();

const mockOrchestrator = { query: mockQuery };
const mockEventBus = { emit: mockEmit } as unknown as ConstructorParameters<typeof GoldiLocksGate>[0]['eventBus'];

vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../../../src/plugins/content-engine/humanizer.js', () => ({
  humanizeQuick: (s: string) => s,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GoldiLocksGate', () => {
  let gate: GoldiLocksGate;

  beforeEach(() => {
    vi.clearAllMocks();
    gate = new GoldiLocksGate({
      orchestrator: mockOrchestrator,
      eventBus: mockEventBus,
    });
  });

  describe('score() — LLM scoring', () => {
    it('should return parsed scores from valid LLM response', async () => {
      mockQuery.mockResolvedValueOnce(JSON.stringify({
        readability: 8,
        originalInsight: 7,
        personalStory: 9,
        directness: 8,
        actionOriented: 6,
        feedback: ['Great opening', 'Add more data'],
      }));

      const score = await gate.score('Great content here', 'blog');

      expect(score.readability).toBe(8);
      expect(score.originalInsight).toBe(7);
      expect(score.personalStory).toBe(9);
      expect(score.directness).toBe(8);
      expect(score.actionOriented).toBe(6);
      expect(score.total).toBe(38);
      expect(score.feedback).toEqual(['Great opening', 'Add more data']);
    });

    it('should clamp scores to 0-10 range', async () => {
      mockQuery.mockResolvedValueOnce(JSON.stringify({
        readability: 15,
        originalInsight: -3,
        personalStory: 7,
        directness: 7,
        actionOriented: 7,
        feedback: [],
      }));

      const score = await gate.score('content', 'blog');

      expect(score.readability).toBe(10);
      expect(score.originalInsight).toBe(0);
    });

    it('should default NaN scores to 0', async () => {
      mockQuery.mockResolvedValueOnce(JSON.stringify({
        readability: 'high',
        originalInsight: null,
        personalStory: undefined,
        directness: 7,
        actionOriented: 7,
        feedback: [],
      }));

      const score = await gate.score('content', 'blog');

      expect(score.readability).toBe(0);
      expect(score.originalInsight).toBe(0);
      expect(score.personalStory).toBe(0);
    });

    it('should emit content:scored audit event', async () => {
      mockQuery.mockResolvedValueOnce(JSON.stringify({
        readability: 7, originalInsight: 7, personalStory: 7,
        directness: 7, actionOriented: 7, feedback: [],
      }));

      await gate.score('content', 'blog');

      expect(mockEmit).toHaveBeenCalledWith('audit:log', expect.objectContaining({
        action: 'content:scored',
        details: expect.objectContaining({ format: 'blog' }),
      }));
    });

    it('should limit feedback to 5 items', async () => {
      mockQuery.mockResolvedValueOnce(JSON.stringify({
        readability: 7, originalInsight: 7, personalStory: 7,
        directness: 7, actionOriented: 7,
        feedback: ['1', '2', '3', '4', '5', '6', '7'],
      }));

      const score = await gate.score('content', 'blog');

      expect(score.feedback).toHaveLength(5);
    });

    it('should filter non-string feedback items', async () => {
      mockQuery.mockResolvedValueOnce(JSON.stringify({
        readability: 7, originalInsight: 7, personalStory: 7,
        directness: 7, actionOriented: 7,
        feedback: ['good', 42, null, 'improve'],
      }));

      const score = await gate.score('content', 'blog');

      expect(score.feedback).toEqual(['good', 'improve']);
    });
  });

  describe('score() — empty content', () => {
    it('should return zero score for empty string', async () => {
      const score = await gate.score('', 'blog');

      expect(score.total).toBe(0);
      expect(score.readability).toBe(0);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should return zero score for whitespace-only string', async () => {
      const score = await gate.score('   \n\t  ', 'blog');

      expect(score.total).toBe(0);
    });
  });

  describe('score() — heuristic fallback', () => {
    it('should use heuristic scoring when LLM fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('LLM timeout'));

      const score = await gate.score('I tried building a startup. It was hard but rewarding. Try it.', 'blog');

      expect(score.total).toBeGreaterThan(0);
      expect(score.feedback).toContain('Scored via heuristic fallback \u2014 LLM unavailable.');
    });

    it('should penalize filler words in heuristic directness score', async () => {
      mockQuery.mockRejectedValueOnce(new Error('fail'));

      const score = await gate.score(
        'I just really basically actually literally wanted to say very good things.',
        'blog',
      );

      expect(score.directness).toBeLessThan(8);
    });

    it('should detect personal story markers', async () => {
      mockQuery.mockRejectedValueOnce(new Error('fail'));

      const scoreWithI = await gate.score('I built this from scratch. It was my best work.', 'blog');

      mockQuery.mockRejectedValueOnce(new Error('fail'));
      const scoreWithout = await gate.score('The system was built from scratch.', 'blog');

      expect(scoreWithI.personalStory).toBeGreaterThanOrEqual(scoreWithout.personalStory);
    });

    it('should detect action-oriented content', async () => {
      mockQuery.mockRejectedValueOnce(new Error('fail'));

      const score = await gate.score('Try building your own. Start with a simple project. Create something new.', 'blog');

      expect(score.actionOriented).toBeGreaterThanOrEqual(6);
    });
  });

  describe('score() — no JSON in response', () => {
    it('should return empty score when response has no JSON', async () => {
      mockQuery.mockResolvedValueOnce('No JSON here at all');

      const score = await gate.score('content', 'blog');

      expect(score.total).toBe(0);
    });
  });

  describe('score() — content formats', () => {
    const formats: ContentFormat[] = ['blog', 'tweet', 'script', 'email', 'newsletter'];

    for (const format of formats) {
      it(`should accept "${format}" format`, async () => {
        mockQuery.mockResolvedValueOnce('{"readability":5,"originalInsight":5,"personalStory":5,"directness":5,"actionOriented":5,"feedback":[]}');

        const score = await gate.score('content', format);

        expect(score.total).toBe(25);
      });
    }
  });

  describe('decide() — gate decisions', () => {
    it('should reject content with score below 35', () => {
      const score: ContentScore = {
        total: 20, readability: 4, originalInsight: 4, personalStory: 4,
        directness: 4, actionOriented: 4, feedback: [],
      };

      const decision = gate.decide(score);

      expect(decision.action).toBe('reject');
      expect(decision.score).toBe(20);
    });

    it('should approve with edits for score between 35-45', () => {
      const score: ContentScore = {
        total: 40, readability: 8, originalInsight: 8, personalStory: 8,
        directness: 8, actionOriented: 8, feedback: [],
      };

      const decision = gate.decide(score);

      expect(decision.action).toBe('approve_with_edits');
      expect(decision.requiredEdits).toBeDefined();
    });

    it('should publish for score above 45', () => {
      const score: ContentScore = {
        total: 48, readability: 10, originalInsight: 10, personalStory: 10,
        directness: 9, actionOriented: 9, feedback: [],
      };

      const decision = gate.decide(score);

      expect(decision.action).toBe('publish');
      expect(decision.reason).toBe('Ready to go');
    });

    it('should treat score of exactly 35 as approve_with_edits', () => {
      const score: ContentScore = {
        total: 35, readability: 7, originalInsight: 7, personalStory: 7,
        directness: 7, actionOriented: 7, feedback: [],
      };

      const decision = gate.decide(score);

      expect(decision.action).toBe('approve_with_edits');
    });

    it('should treat score of exactly 45 as approve_with_edits', () => {
      const score: ContentScore = {
        total: 45, readability: 9, originalInsight: 9, personalStory: 9,
        directness: 9, actionOriented: 9, feedback: [],
      };

      const decision = gate.decide(score);

      expect(decision.action).toBe('approve_with_edits');
    });

    it('should identify key issues in rejection reason', () => {
      const score: ContentScore = {
        total: 15, readability: 3, originalInsight: 3, personalStory: 3,
        directness: 3, actionOriented: 3, feedback: [],
      };

      const decision = gate.decide(score);

      expect(decision.reason).toContain('poor readability');
    });

    it('should identify required edits for approve_with_edits', () => {
      const score: ContentScore = {
        total: 38, readability: 5, originalInsight: 9, personalStory: 8,
        directness: 8, actionOriented: 8, feedback: [],
      };

      const decision = gate.decide(score);

      expect(decision.requiredEdits).toBeDefined();
      expect(decision.requiredEdits!.some(e => e.includes('clarity'))).toBe(true);
    });

    it('should emit audit event for gate decision', () => {
      const score: ContentScore = {
        total: 48, readability: 10, originalInsight: 10, personalStory: 10,
        directness: 9, actionOriented: 9, feedback: [],
      };

      gate.decide(score);

      expect(mockEmit).toHaveBeenCalledWith('audit:log', expect.objectContaining({
        action: 'content:gate_decision',
        details: expect.objectContaining({ action: 'publish' }),
      }));
    });
  });
});
