import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentOptimizer } from '../../../../src/plugins/seo-engine/content-optimizer.js';
import type { SEOScore } from '../../../../src/plugins/seo-engine/types.js';

const mockOrchestrator = {
  chat: vi.fn(),
};

const sampleContent = `## Best Freelance Developer Tools for 2026

Finding the right freelance developer tools can transform your productivity.
As a freelance developer, you need tools that save time and impress clients.

### Why Freelance Developers Need the Right Stack

- Project management tools keep you organized
- Time trackers help you bill accurately
- Communication tools keep clients happy

The best freelance developer tools cover billing, time tracking, and client communication.

## FAQ: Freelance Developer Tools

**What tools do freelance developers use?**
Most freelance developers use a combination of project management, time tracking, and invoicing tools.

**How do I choose freelance developer tools?**
Consider your workflow and client communication needs.

Here is a [useful guide](https://example.com) and an [internal resource](/tools).
`;

describe('ContentOptimizer', () => {
  describe('with AI orchestrator', () => {
    let optimizer: ContentOptimizer;

    beforeEach(() => {
      vi.resetAllMocks();
      optimizer = new ContentOptimizer(mockOrchestrator);
    });

    it('should score content with AI when orchestrator is available', async () => {
      const aiBreakdown: SEOScore['breakdown'] = {
        searchIntent: 12,
        keywordPlacement: 13,
        readability: 8,
        structure: 9,
        eatSignals: 7,
        mediaRichness: 5,
        internalLinks: 8,
        externalLinks: 4,
        faqSection: 5,
        metaOptimization: 4,
        aiDetection: 5,
      };
      mockOrchestrator.chat.mockResolvedValue(
        JSON.stringify({ breakdown: aiBreakdown, suggestions: ['Add more internal links'] }),
      );

      const result = await optimizer.optimize(sampleContent, 'freelance developer tools');

      expect(result.total).toBe(Object.values(aiBreakdown).reduce((s, v) => s + v, 0));
      expect(result.suggestions).toContain('Add more internal links');
      expect(mockOrchestrator.chat).toHaveBeenCalledTimes(1);
    });

    it('should fall back to heuristic scoring when AI fails', async () => {
      mockOrchestrator.chat.mockRejectedValue(new Error('AI timeout'));

      const result = await optimizer.optimize(sampleContent, 'freelance developer tools');

      expect(result.total).toBeGreaterThan(0);
      expect(result.total).toBeLessThanOrEqual(100);
      expect(result.breakdown).toBeDefined();
    });
  });

  describe('heuristicScore (no orchestrator)', () => {
    let optimizer: ContentOptimizer;

    beforeEach(() => {
      vi.resetAllMocks();
      optimizer = new ContentOptimizer(null);
    });

    it('should detect keyword in first paragraph and award points', () => {
      const contentWithKwEarly = 'freelance developer tools are essential for productivity. Use them daily.';
      const result = optimizer.heuristicScore(contentWithKwEarly, 'freelance developer tools');

      expect(result.breakdown.keywordPlacement).toBeGreaterThan(0);
    });

    it('should award zero keyword placement points when keyword is absent', () => {
      const contentNoKw = 'This article talks about random topics with no relevant terms.';
      const result = optimizer.heuristicScore(contentNoKw, 'freelance developer tools');

      expect(result.breakdown.keywordPlacement).toBe(0);
    });

    it('should detect H2/H3 headings and award structure points', () => {
      const result = optimizer.heuristicScore(sampleContent, 'freelance developer tools');

      // sampleContent has ## and ### headings
      expect(result.breakdown.structure).toBeGreaterThanOrEqual(5);
    });

    it('should detect bullet points and award structure points', () => {
      const result = optimizer.heuristicScore(sampleContent, 'freelance developer tools');

      // sampleContent has bullet points
      expect(result.breakdown.structure).toBe(10);
    });

    it('should detect FAQ section and award full faqSection points', () => {
      const result = optimizer.heuristicScore(sampleContent, 'freelance developer tools');

      expect(result.breakdown.faqSection).toBe(5);
    });

    it('should award faqSection points based on question count when no FAQ header', () => {
      const contentWithQuestions = 'What is SEO? How does it work? Why does it matter? Content here.';
      const result = optimizer.heuristicScore(contentWithQuestions, 'SEO');

      expect(result.breakdown.faqSection).toBeGreaterThanOrEqual(3);
    });

    it('should score links in internalLinks and externalLinks', () => {
      const result = optimizer.heuristicScore(sampleContent, 'freelance developer tools');

      // sampleContent has 2 markdown links
      expect(result.breakdown.internalLinks).toBeGreaterThan(0);
    });

    it('should handle empty content without throwing', () => {
      const result = optimizer.heuristicScore('', 'keyword');

      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('should produce all score dimensions within valid ranges', () => {
      const result = optimizer.heuristicScore(sampleContent, 'freelance developer tools');

      expect(result.breakdown.searchIntent).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.searchIntent).toBeLessThanOrEqual(15);
      expect(result.breakdown.keywordPlacement).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.keywordPlacement).toBeLessThanOrEqual(15);
      expect(result.breakdown.readability).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.readability).toBeLessThanOrEqual(10);
      expect(result.breakdown.structure).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.structure).toBeLessThanOrEqual(10);
      expect(result.breakdown.eatSignals).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.eatSignals).toBeLessThanOrEqual(10);
      expect(result.breakdown.mediaRichness).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.mediaRichness).toBeLessThanOrEqual(10);
      expect(result.breakdown.internalLinks).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.internalLinks).toBeLessThanOrEqual(10);
      expect(result.breakdown.externalLinks).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.externalLinks).toBeLessThanOrEqual(5);
      expect(result.breakdown.faqSection).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.faqSection).toBeLessThanOrEqual(5);
      expect(result.breakdown.metaOptimization).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.metaOptimization).toBeLessThanOrEqual(5);
      expect(result.breakdown.aiDetection).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.aiDetection).toBeLessThanOrEqual(5);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('should provide actionable suggestions for missing SEO elements', () => {
      const bareContent = 'This is a very short article with no structure or links.';
      const result = optimizer.heuristicScore(bareContent, 'missing keyword');

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some((s) => s.includes('FAQ'))).toBe(true);
    });
  });
});
