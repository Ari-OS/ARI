import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RSSAggregator, type FeedItem, type FeedConfig } from '../../../../src/integrations/rss/aggregator.js';

// Mock rss-parser
vi.mock('rss-parser', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      parseURL: vi.fn(),
    })),
  };
});

// Mock logger
vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import Parser from 'rss-parser';

// ─── Test Data ──────────────────────────────────────────────────────────────

const SAMPLE_FEED_CONFIG: FeedConfig = {
  url: 'https://example.com/feed',
  category: 'tech',
  name: 'Example Tech',
};

const SAMPLE_PARSED_FEED = {
  items: [
    {
      title: 'Breaking: New AI Model Released',
      link: 'https://example.com/ai-model',
      pubDate: new Date('2024-01-15T10:00:00Z').toString(),
      content: 'Full article content here',
    },
    {
      title: 'TypeScript Tips and Tricks',
      link: 'https://example.com/typescript',
      pubDate: new Date('2024-01-14T15:30:00Z').toString(),
      contentSnippet: 'Article snippet here',
    },
  ],
};

const SAMPLE_FEED_2 = {
  items: [
    {
      title: 'Startup Raises $10M',
      link: 'https://business.com/funding',
      pubDate: new Date('2024-01-16T08:00:00Z').toString(),
      content: 'Funding news',
    },
  ],
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('RSSAggregator', () => {
  let aggregator: RSSAggregator;
  let mockParser: { parseURL: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    // Get the mocked parser instance
    const ParserConstructor = vi.mocked(Parser);
    mockParser = {
      parseURL: vi.fn(),
    };
    ParserConstructor.mockImplementation(() => mockParser as unknown as Parser);

    // Create aggregator without defaults for clean testing
    aggregator = new RSSAggregator(false);
  });

  describe('constructor', () => {
    it('should initialize with default feeds', () => {
      const agg = new RSSAggregator(true);
      const feeds = agg.getFeeds();

      expect(feeds.length).toBeGreaterThan(0);
      expect(feeds.some(f => f.name === 'TechCrunch')).toBe(true);
      expect(feeds.some(f => f.name === 'Ars Technica')).toBe(true);
      expect(feeds.some(f => f.name === 'Hacker News')).toBe(true);
    });

    it('should initialize without default feeds', () => {
      const feeds = aggregator.getFeeds();

      expect(feeds).toHaveLength(0);
    });
  });

  describe('addFeed', () => {
    it('should add a new feed', () => {
      aggregator.addFeed(SAMPLE_FEED_CONFIG);

      const feeds = aggregator.getFeeds();
      expect(feeds).toHaveLength(1);
      expect(feeds[0]).toEqual(SAMPLE_FEED_CONFIG);
    });

    it('should allow multiple feeds', () => {
      aggregator.addFeed(SAMPLE_FEED_CONFIG);
      aggregator.addFeed({
        url: 'https://another.com/feed',
        category: 'news',
        name: 'Another Feed',
      });

      const feeds = aggregator.getFeeds();
      expect(feeds).toHaveLength(2);
    });
  });

  describe('removeFeed', () => {
    it('should remove a feed by URL', () => {
      aggregator.addFeed(SAMPLE_FEED_CONFIG);
      aggregator.removeFeed(SAMPLE_FEED_CONFIG.url);

      const feeds = aggregator.getFeeds();
      expect(feeds).toHaveLength(0);
    });

    it('should do nothing if feed does not exist', () => {
      aggregator.addFeed(SAMPLE_FEED_CONFIG);
      aggregator.removeFeed('https://nonexistent.com/feed');

      const feeds = aggregator.getFeeds();
      expect(feeds).toHaveLength(1);
    });
  });

  describe('fetchFeed', () => {
    beforeEach(() => {
      aggregator.addFeed(SAMPLE_FEED_CONFIG);
    });

    it('should fetch and parse feed items', async () => {
      mockParser.parseURL.mockResolvedValueOnce(SAMPLE_PARSED_FEED);

      const items = await aggregator.fetchFeed(SAMPLE_FEED_CONFIG.url);

      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('Breaking: New AI Model Released');
      expect(items[0].source).toBe('Example Tech');
      expect(items[0].category).toBe('tech');
      expect(items[0].link).toBe('https://example.com/ai-model');
      expect(items[0].pubDate).toBeInstanceOf(Date);
    });

    it('should handle content vs contentSnippet', async () => {
      mockParser.parseURL.mockResolvedValueOnce(SAMPLE_PARSED_FEED);

      const items = await aggregator.fetchFeed(SAMPLE_FEED_CONFIG.url);

      expect(items[0].content).toBe('Full article content here');
      expect(items[1].content).toBe('Article snippet here');
    });

    it('should skip items without title or link', async () => {
      const feedWithBadItems = {
        items: [
          { title: 'Valid Item', link: 'https://example.com/valid' },
          { title: 'No Link' }, // Missing link
          { link: 'https://example.com/no-title' }, // Missing title
          { title: 'Another Valid', link: 'https://example.com/valid2' },
        ],
      };
      mockParser.parseURL.mockResolvedValueOnce(feedWithBadItems);

      const items = await aggregator.fetchFeed(SAMPLE_FEED_CONFIG.url);

      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('Valid Item');
      expect(items[1].title).toBe('Another Valid');
    });

    it('should return empty array for unregistered feed', async () => {
      const items = await aggregator.fetchFeed('https://unregistered.com/feed');

      expect(items).toEqual([]);
      expect(mockParser.parseURL).not.toHaveBeenCalled();
    });

    it('should return empty array on parse error', async () => {
      mockParser.parseURL.mockRejectedValueOnce(new Error('Parse error'));

      const items = await aggregator.fetchFeed(SAMPLE_FEED_CONFIG.url);

      expect(items).toEqual([]);
    });

    it('should cache feed results within TTL', async () => {
      mockParser.parseURL.mockResolvedValueOnce(SAMPLE_PARSED_FEED);

      await aggregator.fetchFeed(SAMPLE_FEED_CONFIG.url);
      await aggregator.fetchFeed(SAMPLE_FEED_CONFIG.url);

      expect(mockParser.parseURL).toHaveBeenCalledTimes(1); // Cached
    });
  });

  describe('fetchAll', () => {
    it('should fetch from all registered feeds', async () => {
      const feed1: FeedConfig = {
        url: 'https://feed1.com/rss',
        category: 'tech',
        name: 'Feed 1',
      };
      const feed2: FeedConfig = {
        url: 'https://feed2.com/rss',
        category: 'business',
        name: 'Feed 2',
      };

      aggregator.addFeed(feed1);
      aggregator.addFeed(feed2);

      mockParser.parseURL.mockResolvedValueOnce(SAMPLE_PARSED_FEED);
      mockParser.parseURL.mockResolvedValueOnce(SAMPLE_FEED_2);

      const items = await aggregator.fetchAll();

      expect(items).toHaveLength(3); // 2 from feed1 + 1 from feed2
      expect(mockParser.parseURL).toHaveBeenCalledTimes(2);
    });

    it('should sort items by date descending', async () => {
      const feed1: FeedConfig = {
        url: 'https://feed1.com/rss',
        category: 'tech',
        name: 'Feed 1',
      };

      aggregator.addFeed(feed1);
      mockParser.parseURL.mockResolvedValueOnce(SAMPLE_PARSED_FEED);

      const items = await aggregator.fetchAll();

      // Should be sorted newest first
      expect(items[0].title).toBe('Breaking: New AI Model Released'); // Jan 15
      expect(items[1].title).toBe('TypeScript Tips and Tricks'); // Jan 14
    });

    it('should handle empty feed list', async () => {
      const items = await aggregator.fetchAll();

      expect(items).toEqual([]);
    });

    it('should continue fetching even if one feed fails', async () => {
      const feed1: FeedConfig = {
        url: 'https://feed1.com/rss',
        category: 'tech',
        name: 'Feed 1',
      };
      const feed2: FeedConfig = {
        url: 'https://feed2.com/rss',
        category: 'business',
        name: 'Feed 2',
      };

      aggregator.addFeed(feed1);
      aggregator.addFeed(feed2);

      mockParser.parseURL.mockRejectedValueOnce(new Error('Feed 1 error'));
      mockParser.parseURL.mockResolvedValueOnce(SAMPLE_FEED_2);

      const items = await aggregator.fetchAll();

      expect(items).toHaveLength(1); // Only from feed2
      expect(items[0].title).toBe('Startup Raises $10M');
    });
  });

  describe('fetchCategory', () => {
    it('should fetch only feeds from specified category', async () => {
      const techFeed: FeedConfig = {
        url: 'https://tech.com/rss',
        category: 'tech',
        name: 'Tech Feed',
      };
      const businessFeed: FeedConfig = {
        url: 'https://business.com/rss',
        category: 'business',
        name: 'Business Feed',
      };

      aggregator.addFeed(techFeed);
      aggregator.addFeed(businessFeed);

      mockParser.parseURL.mockResolvedValueOnce(SAMPLE_PARSED_FEED);

      const items = await aggregator.fetchCategory('tech');

      expect(items).toHaveLength(2);
      expect(items.every(item => item.category === 'tech')).toBe(true);
      expect(mockParser.parseURL).toHaveBeenCalledTimes(1); // Only tech feed
    });

    it('should return empty array for non-existent category', async () => {
      aggregator.addFeed(SAMPLE_FEED_CONFIG);

      const items = await aggregator.fetchCategory('sports');

      expect(items).toEqual([]);
    });
  });

  describe('formatForBriefing', () => {
    it('should format items for briefing display', () => {
      const items: FeedItem[] = [
        {
          title: 'Latest Tech News',
          link: 'https://example.com/news',
          pubDate: new Date('2024-01-15T14:30:00Z'),
          source: 'TechCrunch',
          category: 'tech',
        },
        {
          title: 'Business Update',
          link: 'https://example.com/business',
          pubDate: new Date('2024-01-14T09:00:00Z'),
          source: 'Forbes',
          category: 'business',
        },
      ];

      const formatted = aggregator.formatForBriefing(items, 10);

      expect(formatted).toContain('Latest Tech News');
      expect(formatted).toContain('TechCrunch');
      expect(formatted).toContain('https://example.com/news');
      expect(formatted).toContain('Business Update');
      expect(formatted).toContain('Forbes');
    });

    it('should respect limit parameter', () => {
      const items: FeedItem[] = Array.from({ length: 15 }, (_, i) => ({
        title: `Item ${i}`,
        link: `https://example.com/${i}`,
        pubDate: new Date(),
        source: 'Test Feed',
        category: 'test',
      }));

      const formatted = aggregator.formatForBriefing(items, 5);

      expect(formatted).toContain('... and 10 more');
      const itemLines = formatted.split('\n').filter(l => l.includes('Item'));
      expect(itemLines.length).toBeLessThanOrEqual(5);
    });

    it('should handle items without pubDate', () => {
      const items: FeedItem[] = [
        {
          title: 'No Date Item',
          link: 'https://example.com/no-date',
          source: 'Test',
          category: 'test',
        },
      ];

      const formatted = aggregator.formatForBriefing(items, 10);

      expect(formatted).toContain('No Date Item');
      expect(formatted).toContain('[Test]');
    });

    it('should return "No feed items found" for empty array', () => {
      const formatted = aggregator.formatForBriefing([], 10);

      expect(formatted).toBe('No feed items found');
    });
  });

  describe('getFeeds', () => {
    it('should return list of registered feeds', () => {
      aggregator.addFeed(SAMPLE_FEED_CONFIG);
      aggregator.addFeed({
        url: 'https://another.com/feed',
        category: 'news',
        name: 'Another',
      });

      const feeds = aggregator.getFeeds();

      expect(feeds).toHaveLength(2);
      expect(feeds[0].name).toBe('Example Tech');
      expect(feeds[1].name).toBe('Another');
    });
  });

  describe('getCategories', () => {
    it('should return sorted list of unique categories', () => {
      aggregator.addFeed({ url: 'https://a.com', category: 'tech', name: 'A' });
      aggregator.addFeed({ url: 'https://b.com', category: 'business', name: 'B' });
      aggregator.addFeed({ url: 'https://c.com', category: 'tech', name: 'C' });
      aggregator.addFeed({ url: 'https://d.com', category: 'sports', name: 'D' });

      const categories = aggregator.getCategories();

      expect(categories).toEqual(['business', 'sports', 'tech']);
    });

    it('should return empty array when no feeds', () => {
      const categories = aggregator.getCategories();

      expect(categories).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached feed data', async () => {
      aggregator.addFeed(SAMPLE_FEED_CONFIG);
      mockParser.parseURL.mockResolvedValue(SAMPLE_PARSED_FEED);

      await aggregator.fetchFeed(SAMPLE_FEED_CONFIG.url);
      aggregator.clearCache();
      await aggregator.fetchFeed(SAMPLE_FEED_CONFIG.url);

      expect(mockParser.parseURL).toHaveBeenCalledTimes(2); // Not cached after clear
    });
  });
});
