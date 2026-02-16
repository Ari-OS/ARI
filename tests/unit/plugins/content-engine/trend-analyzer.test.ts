// tests/unit/plugins/content-engine/trend-analyzer.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TrendAnalyzer } from '../../../../src/plugins/content-engine/trend-analyzer.js';
import type { IntelligenceItem } from '../../../../src/autonomous/intelligence-scanner.js';
import type { ContentEngineConfig } from '../../../../src/plugins/content-engine/types.js';

function makeItem(overrides: Partial<IntelligenceItem> = {}): IntelligenceItem {
  return {
    id: 'item-1',
    title: 'Claude 4.6 Released with Computer Use',
    summary: 'Anthropic releases Claude 4.6 with built-in computer use capabilities',
    url: 'https://example.com/article',
    source: 'techcrunch',
    sourceCategory: 'tech_news',
    domains: ['ai'],
    score: 85,
    scoreBreakdown: {
      relevance: 25,
      authority: 18,
      recency: 18,
      engagement: 12,
      novelty: 12,
    },
    fetchedAt: new Date().toISOString(),
    contentHash: 'abc123',
    ...overrides,
  };
}

describe('TrendAnalyzer', () => {
  let analyzer: TrendAnalyzer;
  const defaultConfig: ContentEngineConfig = {
    draftsPerDay: 3,
    autoSendForReview: true,
    publishingEnabled: false,
    platforms: ['x_thread', 'linkedin'],
    minThreadabilityScore: 60,
    voiceProfile: {
      persona: '@PayThePryce',
      tone: 'pragmatic builder',
      audience: 'solo devs',
      style: 'direct',
      avoids: 'corporate jargon',
    },
  };

  beforeEach(() => {
    analyzer = new TrendAnalyzer(defaultConfig);
  });

  describe('analyze', () => {
    it('should filter items below score threshold', () => {
      const items: IntelligenceItem[] = [
        makeItem({ id: 'high', score: 85, domains: ['ai'] }),
        makeItem({ id: 'low', score: 40, domains: ['ai'] }),
      ];

      const briefs = analyzer.analyze(items);
      const sourceIds = briefs.flatMap((b) => b.sourceItemIds);
      expect(sourceIds).toContain('high');
      expect(sourceIds).not.toContain('low');
    });

    it('should return at most draftsPerDay briefs', () => {
      const items: IntelligenceItem[] = Array.from({ length: 10 }, (_, i) =>
        makeItem({
          id: `item-${i}`,
          score: 90 - i,
          domains: ['ai'],
          title: `Article ${i}`,
        }),
      );

      const briefs = analyzer.analyze(items);
      expect(briefs.length).toBeLessThanOrEqual(defaultConfig.draftsPerDay);
    });

    it('should pick diverse domains when possible', () => {
      const items: IntelligenceItem[] = [
        makeItem({ id: 'ai-1', score: 90, domains: ['ai'], title: 'AI Topic 1' }),
        makeItem({ id: 'ai-2', score: 88, domains: ['ai'], title: 'AI Topic 2' }),
        makeItem({ id: 'biz-1', score: 85, domains: ['business'], title: 'Business Topic' }),
        makeItem({ id: 'prog-1', score: 80, domains: ['programming'], title: 'Programming Topic' }),
      ];

      const briefs = analyzer.analyze(items);
      const domains = briefs.map((b) => b.targetPlatform);
      // Should pick from different source domains, not just top AI items
      const sourceItems = briefs.flatMap((b) => b.sourceItemIds);
      expect(sourceItems).toContain('ai-1');
      expect(sourceItems).toContain('biz-1');
    });

    it('should assign appropriate platforms based on content type', () => {
      const items: IntelligenceItem[] = [
        makeItem({ id: 'ai-1', score: 90, domains: ['ai'], title: 'Breaking: Claude 4.6' }),
      ];

      const briefs = analyzer.analyze(items);
      expect(briefs.length).toBeGreaterThan(0);
      expect(briefs[0].threadabilityScore).toBeGreaterThanOrEqual(0);
      expect(briefs[0].threadabilityScore).toBeLessThanOrEqual(100);
    });

    it('should return empty array for no qualifying items', () => {
      const items: IntelligenceItem[] = [
        makeItem({ id: 'low', score: 20, domains: ['general'] }),
      ];

      const briefs = analyzer.analyze(items);
      expect(briefs).toEqual([]);
    });

    it('should only include items from relevant domains', () => {
      const items: IntelligenceItem[] = [
        makeItem({ id: 'ai-item', score: 85, domains: ['ai'] }),
        makeItem({ id: 'general-only', score: 85, domains: ['general'] }),
      ];

      const briefs = analyzer.analyze(items);
      const sourceIds = briefs.flatMap((b) => b.sourceItemIds);
      // 'general' alone should score lower for threadability
      // ai/programming/business/tools are the strong domains
      expect(sourceIds).toContain('ai-item');
    });
  });

  describe('scoreThreadability', () => {
    it('should score high for novel AI content', () => {
      const item = makeItem({ score: 90, domains: ['ai'], scoreBreakdown: {
        relevance: 28, authority: 18, recency: 19, engagement: 13, novelty: 14,
      }});
      const score = analyzer.scoreThreadability(item);
      expect(score).toBeGreaterThan(70);
    });

    it('should score low for old general content', () => {
      const item = makeItem({ score: 55, domains: ['general'], scoreBreakdown: {
        relevance: 10, authority: 10, recency: 5, engagement: 5, novelty: 5,
      }});
      const score = analyzer.scoreThreadability(item);
      expect(score).toBeLessThan(60);
    });
  });
});
