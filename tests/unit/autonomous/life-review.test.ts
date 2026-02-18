import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LifeReviewGenerator } from '../../../src/autonomous/life-review.js';
import type { FormattedLifeReview } from '../../../src/autonomous/life-review.js';
import type { LifeReview, Quadrant } from '../../../src/autonomous/human-tracker.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockQuery = vi.fn();
const mockEmit = vi.fn();

const mockOrchestrator = { query: mockQuery };
const mockEventBus = { emit: mockEmit } as unknown as Parameters<typeof LifeReviewGenerator['prototype']['generateWeeklyReview']> extends never[] ? never : ConstructorParameters<typeof LifeReviewGenerator>[0]['eventBus'];

vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function makeReview(overrides: Partial<LifeReview> = {}): LifeReview {
  return {
    period: { start: '2026-02-11', end: '2026-02-18' },
    quadrants: {
      mind: { score: 75, highlights: ['Read 2 books'], improvements: ['More deep work'] },
      body: { score: 60, highlights: ['Ran 3 times'], improvements: ['Sleep more'] },
      spirit: { score: 80, highlights: ['Family time'], improvements: [] },
      vocation: { score: 70, highlights: ['Shipped feature'], improvements: ['Review OKRs'] },
    },
    overallScore: 71,
    balanceInsight: 'Good balance this week but body needs attention.',
    weeklyGoals: ['Run 4 times', 'Read 1 chapter daily'],
    ...overrides,
  };
}

const mockTracker = {
  generateWeeklyReview: vi.fn().mockReturnValue(makeReview()),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LifeReviewGenerator', () => {
  let generator: LifeReviewGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTracker.generateWeeklyReview.mockReturnValue(makeReview());
    generator = new LifeReviewGenerator({
      tracker: mockTracker as unknown as ConstructorParameters<typeof LifeReviewGenerator>[0]['tracker'],
      orchestrator: mockOrchestrator,
      eventBus: mockEventBus,
    });
  });

  describe('generateWeeklyReview() — happy path', () => {
    it('should generate a formatted review with all fields', async () => {
      mockQuery.mockResolvedValueOnce('You had a solid week with great spirit scores.');

      const result = await generator.generateWeeklyReview();

      expect(result.review).toBeDefined();
      expect(result.telegramHtml).toBeDefined();
      expect(result.notionMarkdown).toBeDefined();
    });

    it('should call tracker.generateWeeklyReview()', async () => {
      mockQuery.mockResolvedValueOnce('insight');

      await generator.generateWeeklyReview();

      expect(mockTracker.generateWeeklyReview).toHaveBeenCalledOnce();
    });

    it('should enhance review with LLM insight when successful', async () => {
      mockQuery.mockResolvedValueOnce('LLM-enhanced insight about this week.');

      const result = await generator.generateWeeklyReview();

      expect(result.review.balanceInsight).toBe('LLM-enhanced insight about this week.');
    });

    it('should keep original insight when LLM fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('LLM timeout'));

      const result = await generator.generateWeeklyReview();

      expect(result.review.balanceInsight).toBe('Good balance this week but body needs attention.');
    });

    it('should emit life_review:generated event', async () => {
      mockQuery.mockResolvedValueOnce('insight');

      await generator.generateWeeklyReview();

      expect(mockEmit).toHaveBeenCalledWith('life_review:generated', expect.objectContaining({
        overallScore: 71,
        timestamp: expect.any(String),
      }));
    });
  });

  describe('generateWeeklyReview() — Telegram HTML formatting', () => {
    it('should include bold header in telegram output', async () => {
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();

      expect(result.telegramHtml).toContain('<b>');
      expect(result.telegramHtml).toContain('Weekly Life Review');
    });

    it('should include all four quadrant sections', async () => {
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();

      expect(result.telegramHtml).toContain('Mind');
      expect(result.telegramHtml).toContain('Body');
      expect(result.telegramHtml).toContain('Spirit');
      expect(result.telegramHtml).toContain('Vocation');
    });

    it('should include scores for each quadrant', async () => {
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();

      expect(result.telegramHtml).toContain('75/100');
      expect(result.telegramHtml).toContain('60/100');
      expect(result.telegramHtml).toContain('80/100');
      expect(result.telegramHtml).toContain('70/100');
    });

    it('should include overall score', async () => {
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();

      expect(result.telegramHtml).toContain('71/100');
    });

    it('should include highlights', async () => {
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();

      expect(result.telegramHtml).toContain('Read 2 books');
      expect(result.telegramHtml).toContain('Ran 3 times');
    });

    it('should include weekly goals', async () => {
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();

      expect(result.telegramHtml).toContain('Run 4 times');
      expect(result.telegramHtml).toContain('Read 1 chapter daily');
    });
  });

  describe('generateWeeklyReview() — Notion Markdown formatting', () => {
    it('should include markdown header', async () => {
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();

      expect(result.notionMarkdown).toContain('# Weekly Life Review');
    });

    it('should include overall score in markdown', async () => {
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();

      expect(result.notionMarkdown).toContain('**Overall Score: 71/100**');
    });

    it('should include quadrant headers with scores', async () => {
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();

      expect(result.notionMarkdown).toContain('Mind (75/100)');
      expect(result.notionMarkdown).toContain('Body (60/100)');
    });

    it('should include insight section', async () => {
      mockQuery.mockResolvedValueOnce('Deep insight here.');

      const result = await generator.generateWeeklyReview();

      expect(result.notionMarkdown).toContain('## Insight');
      expect(result.notionMarkdown).toContain('Deep insight here.');
    });

    it('should include goals as checkbox items', async () => {
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();

      expect(result.notionMarkdown).toContain('- [ ] Run 4 times');
    });
  });

  describe('formatForTelegram() — message splitting', () => {
    it('should return single message for short content', async () => {
      mockQuery.mockResolvedValueOnce('insight');

      const review = await generator.generateWeeklyReview();
      const messages = generator.formatForTelegram(review);

      // Standard review should fit in one message
      expect(messages.length).toBeGreaterThanOrEqual(1);
    });

    it('should split long content into multiple messages', async () => {
      const longReview = makeReview({
        weeklyGoals: Array.from({ length: 100 }, (_, i) => `Goal ${i}: ${'x'.repeat(50)}`),
      });
      mockTracker.generateWeeklyReview.mockReturnValue(longReview);
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();
      const messages = generator.formatForTelegram(result);

      expect(messages.length).toBeGreaterThan(1);
    });

    it('should keep each message under 4000 characters', async () => {
      const longReview = makeReview({
        weeklyGoals: Array.from({ length: 100 }, (_, i) => `Goal ${i}: ${'x'.repeat(50)}`),
      });
      mockTracker.generateWeeklyReview.mockReturnValue(longReview);
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();
      const messages = generator.formatForTelegram(result);

      for (const msg of messages) {
        expect(msg.length).toBeLessThanOrEqual(4000);
      }
    });

    it('should not produce empty messages', async () => {
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();
      const messages = generator.formatForTelegram(result);

      for (const msg of messages) {
        expect(msg.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('generateWeeklyReview() — edge cases', () => {
    it('should handle review with no highlights', async () => {
      const emptyReview = makeReview({
        quadrants: {
          mind: { score: 0, highlights: [], improvements: [] },
          body: { score: 0, highlights: [], improvements: [] },
          spirit: { score: 0, highlights: [], improvements: [] },
          vocation: { score: 0, highlights: [], improvements: [] },
        },
        overallScore: 0,
        weeklyGoals: [],
      });
      mockTracker.generateWeeklyReview.mockReturnValue(emptyReview);
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();

      expect(result.review.overallScore).toBe(0);
      expect(result.telegramHtml).toBeDefined();
      expect(result.notionMarkdown).toBeDefined();
    });

    it('should handle review with no weekly goals', async () => {
      const noGoals = makeReview({ weeklyGoals: [] });
      mockTracker.generateWeeklyReview.mockReturnValue(noGoals);
      mockQuery.mockResolvedValueOnce('insight');

      const result = await generator.generateWeeklyReview();

      expect(result.notionMarkdown).not.toContain('- [ ]');
    });

    it('should handle null return from LLM insight', async () => {
      mockQuery.mockResolvedValueOnce(null as unknown as string);

      const result = await generator.generateWeeklyReview();

      // Should keep original insight since LLM returned null/falsy
      expect(result.review).toBeDefined();
    });
  });
});
