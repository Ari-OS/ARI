import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DailyDigestGenerator } from '../../../src/autonomous/daily-digest.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import type { ScanResult, IntelligenceItem } from '../../../src/autonomous/intelligence-scanner.js';

// Mock fs
vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('not found')),
    readdir: vi.fn().mockResolvedValue([]),
  },
}));

function createMockItem(overrides: Partial<IntelligenceItem> = {}): IntelligenceItem {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Item',
    summary: 'This is a test summary for the item.',
    url: 'https://example.com/test',
    source: 'Test Source',
    sourceCategory: 'NEWS',
    domains: ['ai'],
    score: 50,
    scoreBreakdown: {
      relevance: 15,
      authority: 10,
      recency: 10,
      engagement: 5,
      novelty: 10,
    },
    fetchedAt: new Date().toISOString(),
    contentHash: Math.random().toString(36).slice(2, 18),
    ...overrides,
  };
}

function createMockScanResult(items: IntelligenceItem[]): ScanResult {
  return {
    scanId: 'test-scan-123',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    sourcesScanned: 15,
    itemsFound: items.length * 3,
    itemsAfterDedup: items.length,
    topItems: items,
    errors: [],
  };
}

describe('DailyDigestGenerator', () => {
  let generator: DailyDigestGenerator;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    generator = new DailyDigestGenerator(eventBus);
  });

  describe('generate', () => {
    it('should generate a digest from scan results', async () => {
      const items = [
        createMockItem({ title: 'Claude 4 Released', score: 90, domains: ['ai'], source: 'Anthropic News' }),
        createMockItem({ title: 'BTC hits 150K', score: 75, domains: ['investment'], source: 'Market Monitor' }),
        createMockItem({ title: 'New TypeScript 6.0', score: 70, domains: ['programming', 'tools'], source: 'GitHub Trending' }),
        createMockItem({ title: 'Remote AI jobs surge', score: 65, domains: ['career'], source: 'Hacker News' }),
        createMockItem({ title: 'Liked tweet about AI agents', score: 55, domains: ['ai'], sourceCategory: 'SOCIAL', source: 'X/@techguru' }),
      ];

      const result = createMockScanResult(items);
      const digest = await generator.generate(result);

      expect(digest).toBeDefined();
      expect(digest.date).toBeDefined();
      expect(digest.generatedAt).toBeDefined();
      expect(digest.topSignal).toBeDefined();
      expect(digest.topSignal?.headline).toBe('Claude 4 Released');
      expect(digest.sections.length).toBeGreaterThan(0);
      expect(digest.telegramHtml.length).toBeGreaterThan(0);
      expect(digest.plainText.length).toBeGreaterThan(0);
    });

    it('should categorize items into correct sections', async () => {
      const items = [
        createMockItem({ title: 'AI Item', score: 90, domains: ['ai'] }),
        createMockItem({ title: 'Market Item', score: 80, domains: ['investment'] }),
        createMockItem({ title: 'Career Item', score: 70, domains: ['career'] }),
        createMockItem({ title: 'Tool Item', score: 60, domains: ['tools'] }),
        createMockItem({
          title: 'Social Item',
          score: 50,
          domains: ['ai'],
          sourceCategory: 'SOCIAL',
        }),
      ];

      const result = createMockScanResult(items);
      const digest = await generator.generate(result);

      const sectionTitles = digest.sections.map((s) => s.title);
      expect(sectionTitles).toContain('AI & TECH');
    });

    it('should handle empty scan results gracefully', async () => {
      const result = createMockScanResult([]);
      const digest = await generator.generate(result);

      expect(digest).toBeDefined();
      expect(digest.topSignal).toBeNull();
      expect(digest.sections.length).toBe(0);
      expect(digest.stats.itemsIncluded).toBe(0);
    });

    it('should generate ARI take with Anthropic updates', async () => {
      const items = [
        createMockItem({
          title: 'Anthropic releases new MCP v3',
          score: 95,
          domains: ['ai'],
          source: 'Anthropic News',
        }),
      ];

      const result = createMockScanResult(items);
      const digest = await generator.generate(result);

      expect(digest.ariTake.length).toBeGreaterThan(0);
      const anthropicTake = digest.ariTake.find((t) => t.includes('Anthropic'));
      expect(anthropicTake).toBeDefined();
    });

    it('should emit digest_generated event', async () => {
      const spy = vi.fn();
      eventBus.on('intelligence:digest_generated', spy);

      const items = [createMockItem({ score: 80 })];
      const result = createMockScanResult(items);
      await generator.generate(result);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should format Telegram HTML correctly', async () => {
      const items = [
        createMockItem({
          title: 'Test <script> & HTML',
          score: 90,
          domains: ['ai'],
          url: 'https://example.com',
        }),
      ];

      const result = createMockScanResult(items);
      const digest = await generator.generate(result);

      // Should escape HTML entities
      expect(digest.telegramHtml).toContain('&lt;script&gt;');
      expect(digest.telegramHtml).toContain('&amp;');
      expect(digest.telegramHtml).not.toContain('<script>');
    });

    it('should include score bars in Telegram output', async () => {
      const items = [
        createMockItem({ score: 90 }), // Should show ▓▓▓
        createMockItem({ score: 50 }), // Should show ▓░░
      ];

      const result = createMockScanResult(items);
      const digest = await generator.generate(result);

      expect(digest.telegramHtml).toContain('▓');
    });
  });

  describe('getLatest', () => {
    it('should return null when no digest exists', async () => {
      const result = await generator.getLatest();
      expect(result).toBeNull();
    });
  });
});
