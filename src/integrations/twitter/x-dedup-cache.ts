/**
 * X API Deduplication Cache
 *
 * Leverages X API's UTC-day deduplication window:
 * "If you request and are charged for a resource (such as a Post),
 * requesting the same resource again within that window will not
 * incur an additional charge."
 *
 * This cache tracks:
 * - Post IDs seen today (avoid re-fetching same posts)
 * - Search queries executed today (same query = no charge)
 * - User IDs looked up today
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createLogger } from '../../kernel/logger.js';
import type { XFetchResult, XTweet } from './client.js';
import type { DedupCacheStats } from './x-types.js';
import { X_API_PRICING } from './x-types.js';

const log = createLogger('x-dedup-cache');

export class XDedupCache {
  private seenPostIds: Set<string> = new Set();
  private seenSearchQueries: Set<string> = new Set();
  private seenUserIds: Set<string> = new Set();
  private cacheDate: string;
  private cachePath: string;
  private savingsAccumulated = 0;

  constructor() {
    this.cacheDate = this.getUTCDate();
    this.cachePath = this.getCachePath(this.cacheDate);
  }

  private getCachePath(date: string): string {
    return join(homedir(), '.ari', 'data', 'x-api', `dedup-cache-${date}.json`);
  }

  private getUTCDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Load cache from disk
   */
  async load(): Promise<void> {
    this.checkDateRollover();

    try {
      const data = await readFile(this.cachePath, 'utf-8');
      const cached = JSON.parse(data) as {
        date: string;
        postIds: string[];
        searchQueries: string[];
        userIds: string[];
        savings: number;
      };

      if (cached.date === this.cacheDate) {
        this.seenPostIds = new Set(cached.postIds);
        this.seenSearchQueries = new Set(cached.searchQueries);
        this.seenUserIds = new Set(cached.userIds);
        this.savingsAccumulated = cached.savings ?? 0;
        log.debug({
          posts: this.seenPostIds.size,
          queries: this.seenSearchQueries.size,
          users: this.seenUserIds.size,
        }, 'Loaded dedup cache');
      }
    } catch {
      // No cache or parse error - start fresh
      log.debug('Starting fresh dedup cache');
    }
  }

  /**
   * Save cache to disk
   */
  async save(): Promise<void> {
    try {
      await mkdir(join(homedir(), '.ari', 'data', 'x-api'), { recursive: true });
      await writeFile(
        this.cachePath,
        JSON.stringify({
          date: this.cacheDate,
          postIds: Array.from(this.seenPostIds),
          searchQueries: Array.from(this.seenSearchQueries),
          userIds: Array.from(this.seenUserIds),
          savings: this.savingsAccumulated,
        }, null, 2)
      );
    } catch (error) {
      log.error({ error }, 'Failed to save dedup cache');
    }
  }

  /**
   * Filter out posts we've already seen today
   * Returns only NEW posts (these cost money)
   */
  async filterSeenPosts(result: XFetchResult): Promise<{
    result: XFetchResult;
    deduplicated: number;
    savedCost: number;
  }> {
    this.checkDateRollover();

    const unseenTweets: XTweet[] = [];
    let deduplicatedCount = 0;

    for (const tweet of result.tweets) {
      if (!this.seenPostIds.has(tweet.id)) {
        unseenTweets.push(tweet);
        this.seenPostIds.add(tweet.id);
      } else {
        deduplicatedCount++;
      }
    }

    const savedCost = deduplicatedCount * X_API_PRICING.POST_READ;
    this.savingsAccumulated += savedCost;

    await this.save();

    return {
      result: {
        ...result,
        tweets: unseenTweets,
      },
      deduplicated: deduplicatedCount,
      savedCost,
    };
  }

  /**
   * Check if a search query was already executed today
   */
  hasSearchQuery(query: string): boolean {
    this.checkDateRollover();
    const normalizedQuery = query.toLowerCase().trim();
    return this.seenSearchQueries.has(normalizedQuery);
  }

  /**
   * Mark a search query as executed
   */
  markSearchQuery(query: string): void {
    this.checkDateRollover();
    const normalizedQuery = query.toLowerCase().trim();
    this.seenSearchQueries.add(normalizedQuery);
    // Don't await - fire and forget
    this.save().catch(() => {});
  }

  /**
   * Check if a user was already looked up today
   */
  hasUser(userId: string): boolean {
    this.checkDateRollover();
    return this.seenUserIds.has(userId);
  }

  /**
   * Mark a user as looked up
   */
  markUser(userId: string): void {
    this.checkDateRollover();
    this.seenUserIds.add(userId);
    this.save().catch(() => {});
  }

  /**
   * Check if we need to reset for a new UTC day
   */
  private checkDateRollover(): void {
    const currentDate = this.getUTCDate();
    if (currentDate !== this.cacheDate) {
      log.info({
        previousDate: this.cacheDate,
        newDate: currentDate,
        previousSavings: this.savingsAccumulated,
      }, 'UTC day rollover - resetting dedup cache');

      // Reset for new day
      this.seenPostIds.clear();
      this.seenSearchQueries.clear();
      this.seenUserIds.clear();
      this.savingsAccumulated = 0;
      this.cacheDate = currentDate;
      this.cachePath = this.getCachePath(currentDate);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): DedupCacheStats {
    return {
      date: this.cacheDate,
      cachedPostIds: this.seenPostIds.size,
      cachedSearchQueries: this.seenSearchQueries.size,
      savingsEstimate: this.savingsAccumulated,
    };
  }

  /**
   * Estimate cost savings from using cache
   */
  estimateSavings(): { posts: number; searches: number; total: number } {
    // Each cached post saves $0.005 on re-request
    // Each cached search saves the entire search cost
    const postSavings = this.seenPostIds.size * X_API_PRICING.POST_READ;
    const searchSavings = this.seenSearchQueries.size * 0.05; // Estimated per-search cost

    return {
      posts: postSavings,
      searches: searchSavings,
      total: this.savingsAccumulated,
    };
  }
}
