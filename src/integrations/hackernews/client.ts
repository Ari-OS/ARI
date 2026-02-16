/**
 * Hacker News API Integration
 *
 * Fetches top stories and filters by keywords from the HN API.
 * No auth required, uses native fetch (Node.js 20+).
 *
 * API Docs: https://github.com/HackerNews/API
 *
 * Usage:
 *   const hn = new HackerNewsClient();
 *   const stories = await hn.getTopStories(10);
 *   const relevant = await hn.getRelevantStories(['ai', 'typescript'], 5);
 */

import { createLogger } from '../../kernel/logger.js';

const log = createLogger('hackernews-client');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HNStory {
  id: number;
  title: string;
  url?: string;
  score: number;
  by: string;
  time: number;
  descendants?: number;
  type: 'story' | 'job' | 'comment' | 'poll';
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

// ─── Hacker News Client ─────────────────────────────────────────────────────

export class HackerNewsClient {
  private baseUrl = 'https://hacker-news.firebaseio.com/v0';
  private cacheTtlMs = 5 * 60 * 1000; // 5 min cache
  private topStoriesCache: CacheEntry<number[]> | null = null;
  private storyCache = new Map<number, CacheEntry<HNStory>>();

  /**
   * Get the IDs of top stories from HN
   * @param limit Optional number of story IDs to return (default: 30)
   */
  async getTopStoryIds(limit?: number): Promise<number[]> {
    // Check cache
    if (this.topStoriesCache && Date.now() - this.topStoriesCache.fetchedAt < this.cacheTtlMs) {
      const ids = this.topStoriesCache.data;
      return limit ? ids.slice(0, limit) : ids;
    }

    try {
      const response = await fetch(`${this.baseUrl}/topstories.json`, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`HN API returned ${response.status}`);
      }

      const ids = (await response.json()) as number[];
      this.topStoriesCache = { data: ids, fetchedAt: Date.now() };

      log.info(`Fetched ${ids.length} top story IDs from HN`);
      return limit ? ids.slice(0, limit) : ids;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`Failed to fetch top story IDs: ${message}`);
      return [];
    }
  }

  /**
   * Get details for a specific story by ID
   * @param id The story ID
   */
  async getStoryDetails(id: number): Promise<HNStory | null> {
    // Check cache
    const cached = this.storyCache.get(id);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached.data;
    }

    try {
      const response = await fetch(`${this.baseUrl}/item/${id}.json`, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`HN API returned ${response.status}`);
      }

      const story = (await response.json()) as HNStory | null;

      if (story) {
        this.storyCache.set(id, { data: story, fetchedAt: Date.now() });
      }

      return story;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`Failed to fetch story ${id}: ${message}`);
      return null;
    }
  }

  /**
   * Get full details for top stories
   * @param limit Number of stories to fetch (default: 10)
   */
  async getTopStories(limit = 10): Promise<HNStory[]> {
    const ids = await this.getTopStoryIds(limit);
    const stories: HNStory[] = [];

    for (const id of ids) {
      const story = await this.getStoryDetails(id);
      if (story) {
        stories.push(story);
      }
    }

    log.info(`Fetched ${stories.length} top stories from HN`);
    return stories;
  }

  /**
   * Get top stories filtered by keywords in title or URL
   * @param keywords Array of keywords to match (case-insensitive)
   * @param limit Maximum number of matching stories to return
   */
  async getRelevantStories(keywords: string[], limit = 5): Promise<HNStory[]> {
    const topIds = await this.getTopStoryIds(100); // Search top 100
    const relevant: HNStory[] = [];
    const lowerKeywords = keywords.map(k => k.toLowerCase());

    for (const id of topIds) {
      if (relevant.length >= limit) break;

      const story = await this.getStoryDetails(id);
      if (!story) continue;

      const titleLower = story.title.toLowerCase();
      const urlLower = story.url?.toLowerCase() || '';

      const matches = lowerKeywords.some(keyword =>
        titleLower.includes(keyword) || urlLower.includes(keyword)
      );

      if (matches) {
        relevant.push(story);
      }
    }

    log.info(`Found ${relevant.length} relevant stories matching keywords: ${keywords.join(', ')}`);
    return relevant;
  }

  /**
   * Format stories for briefing display
   */
  formatForBriefing(stories: HNStory[]): string {
    if (stories.length === 0) return 'No stories found';

    const lines: string[] = [];
    const sorted = [...stories].sort((a, b) => b.score - a.score);

    for (const story of sorted.slice(0, 8)) {
      const url = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
      const points = story.score;
      const comments = story.descendants ?? 0;
      lines.push(`  [${points} pts, ${comments} comments] ${story.title}`);
      lines.push(`    ${url}`);
    }

    if (stories.length > 8) {
      lines.push(`  ... and ${stories.length - 8} more`);
    }

    return lines.join('\n');
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.topStoriesCache = null;
    this.storyCache.clear();
    log.debug('Cache cleared');
  }
}
