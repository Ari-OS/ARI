import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntelligenceScanner } from '../../../src/autonomous/intelligence-scanner.js';
import { EventBus } from '../../../src/kernel/event-bus.js';

// Mock fs
vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('not found')),
    readdir: vi.fn().mockResolvedValue([]),
    chmod: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the KnowledgeFetcher to avoid rate limiting in tests
vi.mock('../../../src/autonomous/knowledge-fetcher.js', () => ({
  KnowledgeFetcher: class MockKnowledgeFetcher {
    init() { return Promise.resolve(); }
    fetchSource() { return Promise.resolve(null); }
    fetchAll() { return Promise.resolve({ lastRun: '', fetched: [], errors: [] }); }
  },
  knowledgeFetcher: {
    init: vi.fn().mockResolvedValue(undefined),
    fetchSource: vi.fn().mockResolvedValue(null),
  },
}));

// Mock fetch for HN API
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('IntelligenceScanner', () => {
  let scanner: IntelligenceScanner;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    scanner = new IntelligenceScanner(eventBus);
    mockFetch.mockReset();

    // Default: all fetches fail (prevents HN from hanging)
    mockFetch.mockRejectedValue(new Error('network error'));
  });

  describe('init', () => {
    it('should initialize without errors', async () => {
      await expect(scanner.init()).resolves.not.toThrow();
    });
  });

  describe('scan', () => {
    it('should return scan results even when all sources fail', async () => {
      await scanner.init();
      const result = await scanner.scan();

      expect(result).toBeDefined();
      expect(result.scanId).toBeDefined();
      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
      expect(result.sourcesScanned).toBeGreaterThan(0);
      expect(Array.isArray(result.topItems)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    }, 15000);

    it('should emit scan events', async () => {
      const startedSpy = vi.fn();
      const completeSpy = vi.fn();
      eventBus.on('intelligence:scan_started', startedSpy);
      eventBus.on('intelligence:scan_complete', completeSpy);

      await scanner.init();
      await scanner.scan();

      expect(startedSpy).toHaveBeenCalledTimes(1);
      expect(completeSpy).toHaveBeenCalledTimes(1);
    }, 15000);

    it('should process Hacker News items when API responds', async () => {
      mockFetch.mockImplementation((url: string | URL) => {
        const urlStr = String(url);

        if (urlStr.includes('topstories.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([1, 2, 3]),
            text: () => Promise.resolve('[]'),
          });
        }

        if (urlStr.includes('/v0/item/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 1,
              title: 'Claude 4 released with new agent capabilities',
              url: 'https://anthropic.com/news/claude-4',
              score: 500,
              by: 'test',
              time: Math.floor(Date.now() / 1000) - 3600,
              descendants: 200,
            }),
            text: () => Promise.resolve(''),
          });
        }

        return Promise.reject(new Error('not found'));
      });

      await scanner.init();
      const result = await scanner.scan();

      const hnItems = result.topItems.filter((i) => i.source === 'Hacker News');
      expect(hnItems.length).toBeGreaterThan(0);

      // The Claude/Anthropic HN item should score on AI domain
      const claudeItem = hnItems.find((i) => i.title.includes('Claude'));
      if (claudeItem) {
        expect(claudeItem.domains).toContain('ai');
        expect(claudeItem.score).toBeGreaterThan(30);
      }
    }, 15000);

    it('should deduplicate items with same content hash', async () => {
      mockFetch.mockImplementation((url: string | URL) => {
        const urlStr = String(url);

        if (urlStr.includes('topstories.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([1, 2]),
            text: () => Promise.resolve('[]'),
          });
        }

        if (urlStr.includes('/v0/item/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 1,
              title: 'Same Title Duplicated',
              score: 100,
              by: 'test',
              time: Math.floor(Date.now() / 1000),
            }),
            text: () => Promise.resolve(''),
          });
        }

        return Promise.reject(new Error('not found'));
      });

      await scanner.init();
      const result = await scanner.scan();

      // Should be deduped to 1
      const hnItems = result.topItems.filter((i) => i.source === 'Hacker News');
      expect(hnItems.length).toBeLessThanOrEqual(1);
    }, 15000);
  });

  describe('getLatestResults', () => {
    it('should return null when no previous scan exists', async () => {
      const result = await scanner.getLatestResults();
      expect(result).toBeNull();
    });
  });
});
