/**
 * X API Credit Client
 *
 * Credit-aware wrapper around XClient that implements:
 * - Pay-per-use cost tracking (per-endpoint pricing)
 * - UTC-day deduplication (leverage X API's native dedup)
 * - Spending limits with priority-based throttling
 * - xAI credit bonus tracking
 * - Real-time budget alerts via EventBus
 *
 * PRICING MODEL (Feb 2026):
 * - Posts: Read $0.005/resource
 * - User: Read $0.010/resource
 * - Content: Create $0.010/request
 * - User Interaction: $0.015/request
 * - Deduplication: Same resource within UTC day = 1 charge
 */

import { createLogger } from '../../kernel/logger.js';
import type { EventBus } from '../../kernel/event-bus.js';
import { XClient, type XFetchResult, type XPostResult, type XThreadResult } from './client.js';
import { XDedupCache } from './x-dedup-cache.js';
import { XCostTracker } from './x-cost-tracker.js';
import {
  type XCreditConfig,
  type XOperation,
  type XSpendingSummary,
  type ProceedDecision,
  X_API_PRICING,
  DEFAULT_X_CREDIT_CONFIG,
} from './x-types.js';

const log = createLogger('x-credit-client');

export class XCreditClient {
  private client: XClient;
  private dedupCache: XDedupCache;
  private costTracker: XCostTracker;
  private eventBus: EventBus;
  private config: XCreditConfig;
  private initialized = false;

  constructor(
    client: XClient,
    eventBus: EventBus,
    config: Partial<XCreditConfig> = {}
  ) {
    this.client = client;
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_X_CREDIT_CONFIG, ...config };
    this.dedupCache = new XDedupCache();
    this.costTracker = new XCostTracker(eventBus, this.config);
  }

  /**
   * Initialize all components
   */
  async init(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      await this.client.init();
      await this.dedupCache.load();
      await this.costTracker.load();

      this.initialized = true;
      log.info({
        dailyLimit: this.config.dailySpendingLimit,
        remaining: this.costTracker.getRemainingBudget(),
      }, 'XCreditClient initialized');

      return true;
    } catch (error) {
      log.error({ error }, 'Failed to initialize XCreditClient');
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUDGET MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if an operation can proceed given budget constraints
   */
  canProceed(operation: XOperation): ProceedDecision {
    const remaining = this.costTracker.getRemainingBudget();
    const percentUsed = this.costTracker.getPercentUsed();

    // Hard limit: would exceed budget
    if (operation.cost > remaining) {
      return {
        allowed: false,
        reason: `Would exceed daily limit ($${operation.cost.toFixed(3)} > $${remaining.toFixed(3)} remaining)`,
      };
    }

    // Priority-based soft limits
    if (percentUsed >= 95) {
      // Critical: only priority 5 (must-execute) operations
      if (operation.priority < 5) {
        return {
          allowed: false,
          reason: `Budget 95%+ used, only critical operations allowed (priority 5)`,
        };
      }
    } else if (percentUsed >= 85) {
      // High: skip priority 1-2
      if (operation.priority <= 2) {
        return {
          allowed: false,
          reason: `Budget 85%+ used, skipping low-priority operations`,
        };
      }
    } else if (percentUsed >= 75) {
      // Warning: skip priority 1
      if (operation.priority === 1) {
        return {
          allowed: false,
          reason: `Budget 75%+ used, skipping lowest priority operations`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Get spending summary
   */
  getSpendingSummary(): XSpendingSummary {
    const usage = this.costTracker.getUsage();
    const percentUsed = this.costTracker.getPercentUsed();

    let alertLevel: 'normal' | 'warning' | 'critical' = 'normal';
    if (percentUsed >= this.config.alerts.critical * 100) {
      alertLevel = 'critical';
    } else if (percentUsed >= this.config.alerts.warning * 100) {
      alertLevel = 'warning';
    }

    return {
      dailySpent: usage.totalCost,
      dailyLimit: this.config.dailySpendingLimit,
      percentUsed,
      remaining: this.costTracker.getRemainingBudget(),
      xaiCreditsEarned: this.costTracker.getXaiCreditsEarned(),
      byOperation: usage.byOperation,
      approachingLimit: percentUsed >= 75,
      alertLevel,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ OPERATIONS (with deduplication)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch user's liked tweets (with deduplication)
   */
  async fetchLikes(maxResults?: number): Promise<XFetchResult> {
    const operation: XOperation = {
      type: 'post_read',
      cost: (maxResults ?? 50) * X_API_PRICING.POST_READ,
      priority: this.config.operationPriorities.post_read,
    };

    const decision = this.canProceed(operation);
    if (!decision.allowed) {
      this.emitSkipped('fetch_likes', decision.reason!, operation.priority);
      return this.emptyResult('likes');
    }

    // Fetch from X API
    const result = await this.client.fetchLikes(maxResults);

    // Apply deduplication - only pay for NEW posts
    const { result: dedupedResult, deduplicated, savedCost } =
      await this.dedupCache.filterSeenPosts(result);

    // Track actual cost (only for non-duplicated posts)
    const actualCost = dedupedResult.tweets.length * X_API_PRICING.POST_READ;

    await this.costTracker.track({
      operation: 'post_read',
      endpoint: '/users/{id}/liked_tweets',
      requestCount: 1,
      itemsRead: dedupedResult.tweets.length,
      itemsWritten: 0,
      cost: actualCost,
      deduplicated,
      timestamp: new Date(),
    });

    if (deduplicated > 0) {
      this.eventBus.emit('x:request_deduplicated', {
        operation: 'fetch_likes',
        originalCount: result.tweets.length,
        deduplicatedCount: deduplicated,
        savedCost,
        timestamp: new Date().toISOString(),
      });
    }

    log.debug({
      fetched: result.tweets.length,
      new: dedupedResult.tweets.length,
      deduplicated,
      cost: actualCost,
    }, 'Fetched likes with deduplication');

    return dedupedResult;
  }

  /**
   * Fetch tweets from a curated list
   */
  async fetchListTweets(listId: string, maxResults?: number): Promise<XFetchResult> {
    const operation: XOperation = {
      type: 'post_read',
      cost: (maxResults ?? 50) * X_API_PRICING.LIST_READ,
      priority: this.config.operationPriorities.post_read,
    };

    const decision = this.canProceed(operation);
    if (!decision.allowed) {
      this.emitSkipped('fetch_list_tweets', decision.reason!, operation.priority);
      return this.emptyResult('list');
    }

    const result = await this.client.fetchList(listId, maxResults);
    const { result: dedupedResult, deduplicated, savedCost } =
      await this.dedupCache.filterSeenPosts(result);

    const actualCost = dedupedResult.tweets.length * X_API_PRICING.LIST_READ;

    await this.costTracker.track({
      operation: 'post_read',
      endpoint: '/lists/{id}/tweets',
      requestCount: 1,
      itemsRead: dedupedResult.tweets.length,
      itemsWritten: 0,
      cost: actualCost,
      deduplicated,
      timestamp: new Date(),
    });

    if (deduplicated > 0) {
      this.eventBus.emit('x:request_deduplicated', {
        operation: 'fetch_list_tweets',
        originalCount: result.tweets.length,
        deduplicatedCount: deduplicated,
        savedCost,
        timestamp: new Date().toISOString(),
      });
    }

    return dedupedResult;
  }

  /**
   * Search tweets (with query deduplication)
   */
  async searchTweets(query: string, maxResults?: number): Promise<XFetchResult> {
    // Check if we already searched this query today
    if (this.dedupCache.hasSearchQuery(query)) {
      log.debug({ query }, 'Search query already executed today - skipping');
      this.eventBus.emit('x:request_deduplicated', {
        operation: 'search_tweets',
        originalCount: 1,
        deduplicatedCount: 1,
        savedCost: 0.05, // Estimated search cost
        timestamp: new Date().toISOString(),
      });
      return this.emptyResult('search');
    }

    const operation: XOperation = {
      type: 'search',
      cost: (maxResults ?? 50) * X_API_PRICING.POST_READ,
      priority: this.config.operationPriorities.search,
    };

    const decision = this.canProceed(operation);
    if (!decision.allowed) {
      this.emitSkipped('search_tweets', decision.reason!, operation.priority);
      return this.emptyResult('search');
    }

    const result = await this.client.searchRecent(query, maxResults);

    // Mark query as executed
    this.dedupCache.markSearchQuery(query);

    // Apply post deduplication
    const { result: dedupedResult, deduplicated } =
      await this.dedupCache.filterSeenPosts(result);

    const actualCost = dedupedResult.tweets.length * X_API_PRICING.POST_READ;

    await this.costTracker.track({
      operation: 'search',
      endpoint: '/tweets/search/recent',
      requestCount: 1,
      itemsRead: dedupedResult.tweets.length,
      itemsWritten: 0,
      cost: actualCost,
      deduplicated,
      timestamp: new Date(),
    });

    return dedupedResult;
  }

  /**
   * Get user timeline
   */
  async getUserTimeline(username: string, maxResults?: number): Promise<XFetchResult> {
    const operation: XOperation = {
      type: 'user_read',
      cost: X_API_PRICING.USER_READ + (maxResults ?? 10) * X_API_PRICING.POST_READ,
      priority: this.config.operationPriorities.user_read,
    };

    const decision = this.canProceed(operation);
    if (!decision.allowed) {
      this.emitSkipped('get_user_timeline', decision.reason!, operation.priority);
      return this.emptyResult('list');
    }

    const result = await this.client.getUserTimeline(username, maxResults);
    const { result: dedupedResult, deduplicated } =
      await this.dedupCache.filterSeenPosts(result);

    // User lookup + posts read
    const actualCost = X_API_PRICING.USER_READ +
      dedupedResult.tweets.length * X_API_PRICING.POST_READ;

    await this.costTracker.track({
      operation: 'user_read',
      endpoint: '/users/by/username/{username}',
      requestCount: 1,
      itemsRead: dedupedResult.tweets.length + 1, // +1 for user
      itemsWritten: 0,
      cost: actualCost,
      deduplicated,
      timestamp: new Date(),
    });

    // Mark user as seen
    if (result.tweets[0]?.authorId) {
      this.dedupCache.markUser(result.tweets[0].authorId);
    }

    return dedupedResult;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS (no deduplication - always cost money)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Post a single tweet
   */
  async postTweet(text: string): Promise<XPostResult | null> {
    const operation: XOperation = {
      type: 'create_post',
      cost: X_API_PRICING.CONTENT_CREATE,
      priority: this.config.operationPriorities.create_post,
    };

    const decision = this.canProceed(operation);
    if (!decision.allowed) {
      this.emitSkipped('post_tweet', decision.reason!, operation.priority);
      return null;
    }

    const result = await this.client.postTweet(text);

    await this.costTracker.track({
      operation: 'create_post',
      endpoint: '/tweets',
      requestCount: 1,
      itemsRead: 0,
      itemsWritten: 1,
      cost: X_API_PRICING.CONTENT_CREATE,
      deduplicated: 0,
      timestamp: new Date(),
    });

    log.info({ tweetId: result.id, cost: X_API_PRICING.CONTENT_CREATE }, 'Posted tweet');

    return result;
  }

  /**
   * Post a thread (multiple tweets)
   */
  async postThread(tweets: string[]): Promise<XThreadResult | null> {
    const operation: XOperation = {
      type: 'create_thread',
      cost: tweets.length * X_API_PRICING.CONTENT_CREATE,
      priority: this.config.operationPriorities.create_thread,
    };

    const decision = this.canProceed(operation);
    if (!decision.allowed) {
      this.emitSkipped('post_thread', decision.reason!, operation.priority);
      return null;
    }

    const result = await this.client.postThread(tweets);

    await this.costTracker.track({
      operation: 'create_thread',
      endpoint: '/tweets',
      requestCount: tweets.length,
      itemsRead: 0,
      itemsWritten: tweets.length,
      cost: tweets.length * X_API_PRICING.CONTENT_CREATE,
      deduplicated: 0,
      timestamp: new Date(),
    });

    log.info({
      threadLength: tweets.length,
      cost: tweets.length * X_API_PRICING.CONTENT_CREATE,
    }, 'Posted thread');

    return result;
  }

  /**
   * Like a tweet
   */
  async likeTweet(tweetId: string): Promise<boolean> {
    const operation: XOperation = {
      type: 'like',
      cost: X_API_PRICING.USER_INTERACTION,
      priority: this.config.operationPriorities.like,
    };

    const decision = this.canProceed(operation);
    if (!decision.allowed) {
      this.emitSkipped('like_tweet', decision.reason!, operation.priority);
      return false;
    }

    const success = await this.client.likeTweet(tweetId);

    if (success) {
      await this.costTracker.track({
        operation: 'like',
        endpoint: '/users/{id}/likes',
        requestCount: 1,
        itemsRead: 0,
        itemsWritten: 1,
        cost: X_API_PRICING.USER_INTERACTION,
        deduplicated: 0,
        timestamp: new Date(),
      });
    }

    return success;
  }

  /**
   * Bookmark a tweet
   */
  async bookmarkTweet(tweetId: string): Promise<boolean> {
    const operation: XOperation = {
      type: 'bookmark',
      cost: X_API_PRICING.BOOKMARK,
      priority: this.config.operationPriorities.bookmark,
    };

    const decision = this.canProceed(operation);
    if (!decision.allowed) {
      this.emitSkipped('bookmark_tweet', decision.reason!, operation.priority);
      return false;
    }

    const success = await this.client.bookmarkTweet(tweetId);

    if (success) {
      await this.costTracker.track({
        operation: 'bookmark',
        endpoint: '/users/{id}/bookmarks',
        requestCount: 1,
        itemsRead: 0,
        itemsWritten: 1,
        cost: X_API_PRICING.BOOKMARK,
        deduplicated: 0,
        timestamp: new Date(),
      });
    }

    return success;
  }

  /**
   * Reply to a tweet
   */
  async replyToTweet(tweetId: string, text: string): Promise<XPostResult | null> {
    const operation: XOperation = {
      type: 'create_post',
      cost: X_API_PRICING.CONTENT_CREATE,
      priority: this.config.operationPriorities.create_post,
    };

    const decision = this.canProceed(operation);
    if (!decision.allowed) {
      this.emitSkipped('reply_to_tweet', decision.reason!, operation.priority);
      return null;
    }

    const result = await this.client.replyToTweet(tweetId, text);

    await this.costTracker.track({
      operation: 'create_post',
      endpoint: '/tweets',
      requestCount: 1,
      itemsRead: 0,
      itemsWritten: 1,
      cost: X_API_PRICING.CONTENT_CREATE,
      deduplicated: 0,
      timestamp: new Date(),
    });

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.dedupCache.getStats();
  }

  /**
   * Get historical usage
   */
  async getHistoricalUsage(days: number) {
    return this.costTracker.getHistoricalUsage(days);
  }

  /**
   * Check if client is initialized and enabled
   */
  isEnabled(): boolean {
    return this.initialized;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private emptyResult(source: 'likes' | 'list' | 'search'): XFetchResult {
    return {
      tweets: [],
      fetchedAt: new Date().toISOString(),
      source,
    };
  }

  private emitSkipped(operation: string, reason: string, priority: number): void {
    this.eventBus.emit('x:operation_skipped', {
      operation,
      reason,
      priority,
      timestamp: new Date().toISOString(),
    });
    log.debug({ operation, reason, priority }, 'Operation skipped due to budget');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a configured XCreditClient instance
 */
export function createXCreditClient(
  eventBus: EventBus,
  config?: Partial<XCreditConfig>
): XCreditClient {
  const bearerToken = process.env.X_BEARER_TOKEN;
  const userId = process.env.X_USER_ID;

  const baseClient = new XClient({
    enabled: !!(bearerToken && userId),
    bearerToken,
    userId,
  });

  return new XCreditClient(baseClient, eventBus, config);
}
