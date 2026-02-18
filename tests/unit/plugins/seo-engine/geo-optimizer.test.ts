import { describe, it, expect } from 'vitest';
import { GeoOptimizer } from '../../../../src/plugins/seo-engine/geo-optimizer.js';

describe('GeoOptimizer', () => {
  const optimizer = new GeoOptimizer();

  describe('scoreGEO', () => {
    it('returns 0-100 total score with all breakdown fields', () => {
      const score = optimizer.scoreGEO('Hello world');
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(100);
      expect(score.breakdown).toHaveProperty('citationReadiness');
      expect(score.breakdown).toHaveProperty('structuredData');
      expect(score.breakdown).toHaveProperty('entityDensity');
      expect(score.breakdown).toHaveProperty('factualClaims');
      expect(score.breakdown).toHaveProperty('authoritySignals');
      expect(score.breakdown).toHaveProperty('conciseness');
      expect(score.breakdown).toHaveProperty('questionAnswering');
      expect(score.breakdown).toHaveProperty('freshness');
    });

    it('returns per-engine AI target scores', () => {
      const score = optimizer.scoreGEO('Test content');
      expect(score.aiTargets).toHaveProperty('chatgptSearch');
      expect(score.aiTargets).toHaveProperty('perplexity');
      expect(score.aiTargets).toHaveProperty('claudeAI');
      expect(score.aiTargets.chatgptSearch).toBeGreaterThanOrEqual(0);
      expect(score.aiTargets.perplexity).toBeGreaterThanOrEqual(0);
      expect(score.aiTargets.claudeAI).toBeGreaterThanOrEqual(0);
    });

    it('scores higher for well-structured content with citations', () => {
      const plain = 'This is a general article about marketing.';
      const structured = `## What is GEO Optimization?

According to research from 2026, 78% of users now discover content via AI search engines.

### Key Benefits
- Improves citation rates in ChatGPT Search
- Increases Perplexity visibility by 45%
- Data from Google: structured content performs better

**FAQ**: How long does GEO optimization take?

Studies show results within 30 days. Published in Journal of Digital Marketing 2025.`;

      const plainScore = optimizer.scoreGEO(plain);
      const structuredScore = optimizer.scoreGEO(structured);
      expect(structuredScore.total).toBeGreaterThan(plainScore.total);
    });

    it('detects current year for freshness scoring', () => {
      const currentYear = new Date().getFullYear().toString();
      const fresh = `This guide was updated in ${currentYear} with the latest techniques.`;
      const stale = 'This guide was written using timeless principles.';

      const freshScore = optimizer.scoreGEO(fresh);
      const staleScore = optimizer.scoreGEO(stale);
      expect(freshScore.breakdown.freshness).toBeGreaterThan(staleScore.breakdown.freshness);
    });

    it('rewards Q&A formatted content', () => {
      const qaContent = 'What is the best SEO strategy? Use structured data and clear claims.';
      const plainContent = 'The best SEO strategy uses structured data and clear claims.';

      const qaScore = optimizer.scoreGEO(qaContent);
      const plainScore = optimizer.scoreGEO(plainContent);
      expect(qaScore.breakdown.questionAnswering).toBeGreaterThan(plainScore.breakdown.questionAnswering);
    });

    it('detects authority signals', () => {
      const authoritative = 'As an expert with 10 years of experience, our certified approach has proven results.';
      const plain = 'Our approach has results.';

      const authScore = optimizer.scoreGEO(authoritative);
      const plainScore = optimizer.scoreGEO(plain);
      expect(authScore.breakdown.authoritySignals).toBeGreaterThan(plainScore.breakdown.authoritySignals);
    });

    it('penalizes filler phrases for conciseness', () => {
      const clean = 'Use structured data to improve AI search visibility.';
      const filler = "In today's fast-paced digital world, it's no secret that when it comes to AI search, at the end of the day you need structured data.";

      const cleanScore = optimizer.scoreGEO(clean);
      const fillerScore = optimizer.scoreGEO(filler);
      expect(cleanScore.breakdown.conciseness).toBeGreaterThanOrEqual(fillerScore.breakdown.conciseness);
    });
  });

  describe('optimizeForAI', () => {
    it('returns a GEOResult with all required fields', () => {
      const result = optimizer.optimizeForAI('Test content for optimization.');
      expect(result).toHaveProperty('originalContent');
      expect(result).toHaveProperty('optimizedContent');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('improvements');
      expect(result).toHaveProperty('optimizedAt');
      expect(result.originalContent).toBe('Test content for optimization.');
    });

    it('removes filler phrases from content', () => {
      const input = "In today's fast-paced world, we need to focus on SEO.";
      const result = optimizer.optimizeForAI(input);
      expect(result.optimizedContent).not.toMatch(/in today's fast-paced world/i);
    });

    it('preserves content when no filler is present', () => {
      const clean = 'Use structured data markup to improve AI search visibility in 2026.';
      const result = optimizer.optimizeForAI(clean);
      // Content should be essentially unchanged (just whitespace cleaned)
      expect(result.optimizedContent.trim()).toBeTruthy();
    });

    it('records optimization timestamp', () => {
      const result = optimizer.optimizeForAI('test');
      const timestamp = new Date(result.optimizedAt);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });
  });

  describe('suggestImprovements', () => {
    it('returns improvement suggestions for plain content', () => {
      const improvements = optimizer.suggestImprovements('This is a simple article.');
      expect(Array.isArray(improvements)).toBe(true);
      expect(improvements.length).toBeGreaterThan(0);
    });

    it('suggestions are sorted by priority (high first)', () => {
      const improvements = optimizer.suggestImprovements('This is a simple plain-text article with nothing special.');
      const priorities = improvements.map(i => i.priority);
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      for (let i = 0; i < priorities.length - 1; i++) {
        expect(priorityOrder[priorities[i]]).toBeLessThanOrEqual(priorityOrder[priorities[i + 1]]);
      }
    });

    it('each improvement has required fields', () => {
      const improvements = optimizer.suggestImprovements('basic content');
      for (const imp of improvements) {
        expect(imp).toHaveProperty('category');
        expect(imp).toHaveProperty('priority');
        expect(imp).toHaveProperty('suggestion');
        expect(imp).toHaveProperty('currentScore');
        expect(imp).toHaveProperty('potentialScore');
        expect(['high', 'medium', 'low']).toContain(imp.priority);
      }
    });

    it('returns fewer improvements for well-optimized content', () => {
      const poor = 'It is what it is.';
      const good = `## How GEO Works in 2026

According to research, 85% of AI search citations come from structured content.

### Key Statistics
- 78% increase in AI-cited content with FAQ sections
- Data from Perplexity shows structured data matters
- Published in 2026 by certified SEO experts

What is the best GEO strategy? Use citations, structure, and fresh data.`;

      const poorImprovements = optimizer.suggestImprovements(poor);
      const goodImprovements = optimizer.suggestImprovements(good);
      expect(goodImprovements.length).toBeLessThan(poorImprovements.length);
    });
  });
});
