/**
 * RSS Feed Aggregator
 *
 * Fetches and aggregates multiple RSS feeds with category organization.
 * Uses rss-parser for feed parsing, includes per-feed caching.
 *
 * Usage:
 *   const rss = new RSSAggregator();
 *   rss.addFeed({ url: 'https://example.com/feed', category: 'tech', name: 'Example' });
 *   const items = await rss.fetchAll();
 *   const formatted = rss.formatForBriefing(items, 10);
 */

import Parser from 'rss-parser';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('rss-aggregator');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FeedConfig {
  url: string;
  category: string;
  name: string;
}

export interface FeedItem {
  title: string;
  link: string;
  pubDate?: Date;
  content?: string;
  source: string;
  category: string;
}

interface CacheEntry {
  items: FeedItem[];
  fetchedAt: number;
}

interface ParsedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
}

// ─── Default Feeds ──────────────────────────────────────────────────────────

const DEFAULT_FEEDS: FeedConfig[] = [
  {
    url: 'https://feeds.feedburner.com/TechCrunch/',
    category: 'tech',
    name: 'TechCrunch',
  },
  {
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    category: 'tech',
    name: 'Ars Technica',
  },
  {
    url: 'https://hnrss.org/frontpage',
    category: 'tech',
    name: 'Hacker News',
  },
];

// ─── RSS Aggregator ─────────────────────────────────────────────────────────

export class RSSAggregator {
  private feeds: Map<string, FeedConfig> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTtlMs = 15 * 60 * 1000; // 15 min cache
  private parser: Parser;

  constructor(includeDefaults = true) {
    this.parser = new Parser({
      timeout: 10_000,
      headers: {
        'User-Agent': 'ARI/2.0 (RSS Aggregator)',
      },
    });

    if (includeDefaults) {
      for (const feed of DEFAULT_FEEDS) {
        this.addFeed(feed);
      }
    }
  }

  /**
   * Add a new feed to the aggregator
   */
  addFeed(config: FeedConfig): void {
    this.feeds.set(config.url, config);
    log.info(`Added feed: ${config.name} (${config.category})`);
  }

  /**
   * Remove a feed from the aggregator
   */
  removeFeed(url: string): void {
    const feed = this.feeds.get(url);
    if (feed) {
      this.feeds.delete(url);
      this.cache.delete(url);
      log.info(`Removed feed: ${feed.name}`);
    }
  }

  /**
   * Fetch items from a specific feed
   */
  async fetchFeed(url: string): Promise<FeedItem[]> {
    const config = this.feeds.get(url);
    if (!config) {
      log.warn(`Feed not registered: ${url}`);
      return [];
    }

    // Check cache
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      log.debug(`Using cached results for ${config.name}`);
      return cached.items;
    }

    try {
      const feed = await this.parser.parseURL(url);
      const items: FeedItem[] = [];

      for (const entry of feed.items) {
        const parsedEntry = entry as ParsedItem;
        if (!parsedEntry.title || !parsedEntry.link) continue;

        items.push({
          title: parsedEntry.title,
          link: parsedEntry.link,
          pubDate: parsedEntry.pubDate ? new Date(parsedEntry.pubDate) : undefined,
          content: parsedEntry.content || parsedEntry.contentSnippet,
          source: config.name,
          category: config.category,
        });
      }

      this.cache.set(url, { items, fetchedAt: Date.now() });
      log.info(`Fetched ${items.length} items from ${config.name}`);
      return items;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`Failed to fetch feed ${config.name}: ${message}`);
      return [];
    }
  }

  /**
   * Fetch items from all registered feeds
   */
  async fetchAll(): Promise<FeedItem[]> {
    const allItems: FeedItem[] = [];

    for (const [url] of this.feeds) {
      const items = await this.fetchFeed(url);
      allItems.push(...items);
    }

    // Sort by date, newest first
    allItems.sort((a, b) => {
      if (!a.pubDate) return 1;
      if (!b.pubDate) return -1;
      return b.pubDate.getTime() - a.pubDate.getTime();
    });

    log.info(`Fetched total of ${allItems.length} items from ${this.feeds.size} feeds`);
    return allItems;
  }

  /**
   * Fetch items from a specific category
   */
  async fetchCategory(category: string): Promise<FeedItem[]> {
    const allItems: FeedItem[] = [];

    for (const [url, config] of this.feeds) {
      if (config.category === category) {
        const items = await this.fetchFeed(url);
        allItems.push(...items);
      }
    }

    // Sort by date, newest first
    allItems.sort((a, b) => {
      if (!a.pubDate) return 1;
      if (!b.pubDate) return -1;
      return b.pubDate.getTime() - a.pubDate.getTime();
    });

    log.info(`Fetched ${allItems.length} items from category: ${category}`);
    return allItems;
  }

  /**
   * Format items for briefing display
   */
  formatForBriefing(items: FeedItem[], limit = 10): string {
    if (items.length === 0) return 'No feed items found';

    const lines: string[] = [];
    const sorted = items.slice(0, limit);

    for (const item of sorted) {
      const timeStr = item.pubDate
        ? item.pubDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : '';

      const source = item.source;
      const meta = timeStr ? `[${source} • ${timeStr}]` : `[${source}]`;

      lines.push(`  ${meta} ${item.title}`);
      lines.push(`    ${item.link}`);
    }

    if (items.length > limit) {
      lines.push(`  ... and ${items.length - limit} more`);
    }

    return lines.join('\n');
  }

  /**
   * Get list of registered feeds
   */
  getFeeds(): FeedConfig[] {
    return Array.from(this.feeds.values());
  }

  /**
   * Get list of categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    for (const feed of this.feeds.values()) {
      categories.add(feed.category);
    }
    return Array.from(categories).sort();
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    log.debug('Cache cleared');
  }
}
