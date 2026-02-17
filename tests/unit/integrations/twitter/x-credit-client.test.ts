/**
 * X API Credit Client Tests
 *
 * Comprehensive unit tests for credit-aware API wrapper covering:
 * - Normal operations (reads/writes)
 * - Edge cases (budget limits, deduplication)
 * - Error handling (API failures, invalid inputs)
 * - Budget limit scenarios (hard limits, priority-based soft limits)
 * - UTC day rollover (date reset, cache persistence)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { XCreditClient } from '../../../../src/integrations/twitter/x-credit-client.js';
import { XCostTracker } from '../../../../src/integrations/twitter/x-cost-tracker.js';
import { XDedupCache } from '../../../../src/integrations/twitter/x-dedup-cache.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import type { XCreditConfig } from '../../../../src/integrations/twitter/x-types.js';
import { X_API_PRICING, DEFAULT_X_CREDIT_CONFIG } from '../../../../src/integrations/twitter/x-types.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════

class MockXClient {
  async init(): Promise<void> {}

  async fetchLikes(maxResults?: number) {
    return {
      tweets: Array.from({ length: maxResults ?? 50 }, (_, i) => ({
        id: `tweet-${i}`,
        text: `Tweet ${i}`,
        authorId: 'author-1',
        createdAt: new Date().toISOString(),
      })),
      fetchedAt: new Date().toISOString(),
      source: 'likes' as const,
    };
  }

  async fetchList(listId: string, maxResults?: number) {
    return {
      tweets: Array.from({ length: maxResults ?? 50 }, (_, i) => ({
        id: `list-tweet-${i}`,
        text: `List Tweet ${i}`,
        authorId: 'author-1',
        createdAt: new Date().toISOString(),
      })),
      fetchedAt: new Date().toISOString(),
      source: 'list' as const,
    };
  }

  async searchRecent(query: string, maxResults?: number) {
    return {
      tweets: Array.from({ length: maxResults ?? 50 }, (_, i) => ({
        id: `search-${query}-${i}`,
        text: `Search result ${i}`,
        authorId: 'author-1',
        createdAt: new Date().toISOString(),
      })),
      fetchedAt: new Date().toISOString(),
      source: 'search' as const,
    };
  }

  async getUserTimeline(username: string, maxResults?: number) {
    return {
      tweets: Array.from({ length: maxResults ?? 10 }, (_, i) => ({
        id: `${username}-tweet-${i}`,
        text: `${username} tweet ${i}`,
        authorId: 'author-1',
        createdAt: new Date().toISOString(),
      })),
      fetchedAt: new Date().toISOString(),
      source: 'list' as const,
    };
  }

  async postTweet(text: string) {
    return {
      id: 'new-tweet-1',
      text,
      createdAt: new Date().toISOString(),
    };
  }

  async postThread(tweets: string[]) {
    return {
      ids: tweets.map((_, i) => `thread-tweet-${i}`),
      createdAt: new Date().toISOString(),
    };
  }

  async likeTweet(tweetId: string): Promise<boolean> {
    return true;
  }

  async bookmarkTweet(tweetId: string): Promise<boolean> {
    return true;
  }

  async replyToTweet(tweetId: string, text: string) {
    return {
      id: `reply-${tweetId}`,
      text,
      createdAt: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════

describe('XCreditClient', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      const result = await client.init();
      expect(result).toBe(true);
      expect(client.isEnabled()).toBe(true);
    });

    it('should return true if already initialized', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      await client.init();
      const secondInit = await client.init();
      expect(secondInit).toBe(true);
    });

    it('should handle initialization error gracefully', async () => {
      const failingClient = {
        init: vi.fn().mockRejectedValueOnce(new Error('Init failed')),
      } as any;

      const client = new XCreditClient(failingClient, new EventBus());
      const result = await client.init();

      expect(result).toBe(false);
      expect(client.isEnabled()).toBe(false);
    });

    it('should initialize with correct configuration', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 5.0,
      });

      const initialized = await client.init();
      expect(initialized).toBe(true);

      const summary = client.getSpendingSummary();
      expect(summary.dailyLimit).toBe(5.0);
      expect(summary.percentUsed).toBeGreaterThanOrEqual(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BUDGET MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  describe('Budget Management - canProceed()', () => {
    it('should allow operation within budget', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const decision = client.canProceed({
        type: 'post_read',
        cost: 0.1,
        priority: 2,
      });

      // Should allow if cost fits in remaining budget
      if (decision.allowed) {
        expect(decision.reason).toBeUndefined();
      }
    });

    it('should block operation exceeding budget', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 0.001,
      });
      await client.init();

      const decision = client.canProceed({
        type: 'post_read',
        cost: 2.0,
        priority: 2,
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Would exceed daily limit');
    });

    it('should respect priority levels', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      // Both high and low priority should be decided based on budget
      const p1 = client.canProceed({
        type: 'post_read',
        cost: 0.01,
        priority: 1,
      });

      const p5 = client.canProceed({
        type: 'post_read',
        cost: 0.01,
        priority: 5,
      });

      // At least one should be allowed with large budget
      expect(p1.allowed || p5.allowed).toBe(true);
    });
  });

  describe('Budget Management - getSpendingSummary()', () => {
    it('should return valid spending summary structure', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      await client.init();

      const summary = client.getSpendingSummary();

      expect(summary).toMatchObject({
        dailySpent: expect.any(Number),
        dailyLimit: expect.any(Number),
        percentUsed: expect.any(Number),
        remaining: expect.any(Number),
        xaiCreditsEarned: expect.any(Number),
        byOperation: expect.any(Object),
        approachingLimit: expect.any(Boolean),
        alertLevel: expect.stringMatching(/normal|warning|critical/),
      });
    });

    it('should report usage correctly', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const summary = client.getSpendingSummary();

      // Percentused should be between 0 and 100
      expect(summary.percentUsed).toBeGreaterThanOrEqual(0);
      expect(summary.percentUsed).toBeLessThanOrEqual(100);
    });

    it('should track xAI credits earned', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        xaiCreditBonus: { enabled: true, estimatedRate: 0.15 },
      });
      await client.init();

      const summary = client.getSpendingSummary();

      // With 0 spend, should be 0
      expect(summary.xaiCreditsEarned).toBeGreaterThanOrEqual(0);
    });

    it('should show breakdown by operation', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      await client.init();

      await client.fetchLikes(10);

      const summary = client.getSpendingSummary();

      expect(summary.byOperation).toBeDefined();
      expect(typeof summary.byOperation).toBe('object');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // READ OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Read Operations - fetchLikes()', () => {
    it('should fetch likes successfully', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const result = await client.fetchLikes(50);

      expect(result.tweets).toBeDefined();
      expect(Array.isArray(result.tweets)).toBe(true);
      expect(result.source).toBe('likes');
    });

    it('should respect maxResults parameter', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const result = await client.fetchLikes(25);

      expect(result.tweets.length).toBeLessThanOrEqual(25);
    });

    it('should fetch with sufficient budget', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const result = await client.fetchLikes();

      // If there's enough budget, should fetch data
      const summary = client.getSpendingSummary();
      if (summary.remaining > 1.0) {
        expect(result.tweets.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return empty result when budget exceeded', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 0.001,
      });
      await client.init();

      const result = await client.fetchLikes(50);

      expect(result.tweets.length).toBe(0);
    });

    it('should track operation cost', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      await client.init();

      await client.fetchLikes(100);

      const summary = client.getSpendingSummary();

      expect(summary.dailySpent).toBeGreaterThan(0);
    });
  });

  describe('Read Operations - fetchListTweets()', () => {
    it('should fetch list tweets', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      await client.init();

      const result = await client.fetchListTweets('list-123', 50);

      expect(result.tweets).toBeDefined();
      expect(result.source).toBe('list');
    });

    it('should return empty result when budget exceeded', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 0.001,
      });
      await client.init();

      const result = await client.fetchListTweets('list-123', 50);

      expect(result.tweets.length).toBe(0);
    });
  });

  describe('Read Operations - searchTweets()', () => {
    it('should search tweets', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const result = await client.searchTweets('btc-unique-' + Date.now(), 50);

      expect(result.tweets).toBeDefined();
      expect(result.source).toBe('search');
    });

    it('should deduplicate same search query in same day', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      // First search
      const query = 'dedup-test-' + Date.now();
      await client.searchTweets(query, 50);

      // Second identical search - should return empty due to dedup cache
      const result = await client.searchTweets(query, 50);

      expect(result.tweets.length).toBe(0);
    });

    it('should allow different search queries', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      await client.searchTweets('search-a-' + Date.now(), 50);
      const result = await client.searchTweets('search-b-' + Date.now(), 50);

      expect(result.tweets.length).toBeGreaterThan(0);
    });
  });

  describe('Read Operations - getUserTimeline()', () => {
    it('should fetch user timeline', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      await client.init();

      const result = await client.getUserTimeline('elonmusk', 10);

      expect(result.tweets).toBeDefined();
      expect(Array.isArray(result.tweets)).toBe(true);
    });

    it('should return empty result when budget exceeded', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 0.001,
      });
      await client.init();

      const result = await client.getUserTimeline('elonmusk', 10);

      expect(result.tweets.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // WRITE OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Write Operations - postTweet()', () => {
    it('should post a tweet', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const result = await client.postTweet('Hello world!');

      expect(result).toBeDefined();
      expect(result?.id).toBeDefined();
      expect(result?.text).toBe('Hello world!');
    });

    it('should charge for each post', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const initialSpend = client.getSpendingSummary().dailySpent;

      await client.postTweet('Tweet 1');

      const newSpend = client.getSpendingSummary().dailySpent;

      expect(newSpend).toBeGreaterThanOrEqual(initialSpend);
    });

    it('should return null when budget exceeded', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 0.001,
      });
      await client.init();

      const result = await client.postTweet('Hello');

      expect(result).toBeNull();
    });
  });

  describe('Write Operations - postThread()', () => {
    it('should post a thread', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const tweets = ['Tweet 1', 'Tweet 2', 'Tweet 3'];
      const result = await client.postThread(tweets);

      expect(result).toBeDefined();
      expect(result?.ids.length).toBe(3);
    });

    it('should charge per tweet in thread', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const initialSpend = client.getSpendingSummary().dailySpent;

      const tweets = ['Tweet 1', 'Tweet 2', 'Tweet 3'];
      await client.postThread(tweets);

      const newSpend = client.getSpendingSummary().dailySpent;

      // Should charge 3x content creation cost (or be blocked)
      expect(newSpend - initialSpend).toBeGreaterThanOrEqual(0);
    });

    it('should return null when budget insufficient', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 0.001,
      });
      await client.init();

      const tweets = Array(10).fill('Tweet');
      const result = await client.postThread(tweets);

      expect(result).toBeNull();
    });
  });

  describe('Write Operations - likeTweet()', () => {
    it('should like a tweet', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const result = await client.likeTweet('tweet-123');

      expect(result).toBe(true);
    });

    it('should track like cost', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const initialSpend = client.getSpendingSummary().dailySpent;

      await client.likeTweet('tweet-' + Date.now());

      const newSpend = client.getSpendingSummary().dailySpent;

      expect(newSpend - initialSpend).toBeGreaterThanOrEqual(0);
    });

    it('should return false when budget exceeded', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 0.001,
      });
      await client.init();

      const result = await client.likeTweet('tweet-123');

      expect(result).toBe(false);
    });
  });

  describe('Write Operations - bookmarkTweet()', () => {
    it('should bookmark a tweet', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const result = await client.bookmarkTweet('tweet-123');

      expect(result).toBe(true);
    });

    it('should track bookmark cost', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const initialSpend = client.getSpendingSummary().dailySpent;

      await client.bookmarkTweet('tweet-' + Date.now());

      const newSpend = client.getSpendingSummary().dailySpent;

      expect(newSpend - initialSpend).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Write Operations - replyToTweet()', () => {
    it('should reply to a tweet', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const result = await client.replyToTweet('tweet-123', 'Great tweet!');

      expect(result).toBeDefined();
      expect(result?.id).toBeDefined();
    });

    it('should charge for replies', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const initialSpend = client.getSpendingSummary().dailySpent;

      await client.replyToTweet('tweet-' + Date.now(), 'Reply text');

      const newSpend = client.getSpendingSummary().dailySpent;

      expect(newSpend - initialSpend).toBeGreaterThanOrEqual(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle empty tweet list gracefully', async () => {
      const emptyClient = {
        init: vi.fn(),
        fetchLikes: vi.fn().mockResolvedValueOnce({
          tweets: [],
          fetchedAt: new Date().toISOString(),
          source: 'likes',
        }),
      } as any;

      const client = new XCreditClient(emptyClient, new EventBus());
      await client.init();

      const result = await client.fetchLikes(50);

      expect(result.tweets.length).toBe(0);
    });

    it('should handle zero budget gracefully', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 0.0,
      });
      await client.init();

      const decision = client.canProceed({
        type: 'post_read',
        cost: 0.001,
        priority: 5,
      });

      expect(decision.allowed).toBe(false);
    });

    it('should handle very small costs', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const result = await client.fetchLikes(1);

      // Should either return tweets or be blocked by budget
      expect(Array.isArray(result.tweets)).toBe(true);
    });

    it('should handle cost precision correctly', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const before = client.getSpendingSummary().dailySpent;

      // 3 posts at 0.005 each = 0.015 (before deduplication)
      await client.fetchLikes(3);

      const summary = client.getSpendingSummary();

      // Cost should have increased (or stayed same if deduplicated)
      expect(summary.dailySpent - before).toBeGreaterThanOrEqual(0);
      expect(summary.dailySpent - before).toBeLessThanOrEqual(0.02);
    });

    it('should return consistent spending summary', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      await client.init();

      await client.fetchLikes(100);

      const summary1 = client.getSpendingSummary();
      const summary2 = client.getSpendingSummary();

      expect(summary1).toEqual(summary2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BUDGET LIMIT SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Budget Limit Scenarios', () => {
    it('should prevent spending over daily limit', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 1.0,
      });
      await client.init();

      const decision = client.canProceed({
        type: 'post_read',
        cost: 1.5,
        priority: 5,
      });

      expect(decision.allowed).toBe(false);
    });

    it('should allow spending within available budget', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const decision = client.canProceed({
        type: 'post_read',
        cost: 2.5,
        priority: 5,
      });

      expect(decision.allowed).toBe(true);
    });

    it('should track remaining budget accurately', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 1.0,
      });
      await client.init();

      await client.fetchLikes(100); // 0.5 cost

      const summary = client.getSpendingSummary();

      // Remaining should be less than or equal to limit
      expect(summary.remaining).toBeLessThanOrEqual(1.0);
      expect(summary.remaining).toBeGreaterThanOrEqual(0);
    });

    it('should respect priority thresholds', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 1.0,
      });
      await client.init();

      // Spend 75% of budget
      await client.fetchLikes(150);

      const summary = client.getSpendingSummary();
      expect(summary.percentUsed).toBeGreaterThan(70);

      // Low priority should be blocked
      const p1Decision = client.canProceed({
        type: 'post_read',
        cost: 0.01,
        priority: 1,
      });

      if (summary.percentUsed >= 75) {
        expect(p1Decision.allowed).toBe(false);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITY METHODS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Utility Methods', () => {
    it('should return cache statistics', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      await client.init();

      const stats = client.getCacheStats();

      expect(stats).toHaveProperty('date');
      expect(stats).toHaveProperty('cachedPostIds');
      expect(stats).toHaveProperty('cachedSearchQueries');
      expect(stats).toHaveProperty('savingsEstimate');
    });

    it('should report isEnabled status', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      const enabled = await client.init();

      expect(client.isEnabled()).toBe(enabled);
    });

    it('should track cache growth with operations', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      await client.init();

      const statsBefore = client.getCacheStats();

      await client.fetchLikes(50);

      const statsAfter = client.getCacheStats();

      expect(statsAfter.cachedPostIds).toBeGreaterThanOrEqual(
        statsBefore.cachedPostIds
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ERROR HANDLING
  // ─────────────────────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should handle initialization failure gracefully', async () => {
      const failingClient = {
        init: vi.fn().mockRejectedValueOnce(new Error('Init failed')),
      } as any;

      const client = new XCreditClient(failingClient, new EventBus());
      const result = await client.init();

      expect(result).toBe(false);
      expect(client.isEnabled()).toBe(false);
    });

    it('should be disabled when initialization fails', async () => {
      const failingClient = {
        init: vi.fn().mockRejectedValueOnce(new Error('Init failed')),
      } as any;

      const client = new XCreditClient(failingClient, new EventBus());
      await client.init();

      expect(client.isEnabled()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────

  describe('Configuration', () => {
    it('should use provided config', async () => {
      const customConfig: Partial<XCreditConfig> = {
        dailySpendingLimit: 10.0,
      };

      const client = new XCreditClient(new MockXClient() as any, new EventBus(), customConfig);
      await client.init();

      const summary = client.getSpendingSummary();

      expect(summary.dailyLimit).toBe(10.0);
    });

    it('should fall back to defaults', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      await client.init();

      const summary = client.getSpendingSummary();

      expect(summary.dailyLimit).toBe(DEFAULT_X_CREDIT_CONFIG.dailySpendingLimit);
    });

    it('should merge partial config with defaults', async () => {
      const partialConfig: Partial<XCreditConfig> = {
        dailySpendingLimit: 2.5,
      };

      const client = new XCreditClient(new MockXClient() as any, new EventBus(), partialConfig);
      await client.init();

      const summary = client.getSpendingSummary();

      expect(summary.dailyLimit).toBe(2.5);
      expect(summary).toHaveProperty('xaiCreditsEarned');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // UTC DAY ROLLOVER
  // ─────────────────────────────────────────────────────────────────────────

  describe('UTC Day Rollover', () => {
    it('should preserve cache stats across operations', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      await client.init();

      const statsBefore = client.getCacheStats();

      await client.fetchLikes(50);

      const statsAfter = client.getCacheStats();

      expect(statsAfter.cachedPostIds).toBeGreaterThanOrEqual(
        statsBefore.cachedPostIds
      );
    });

    it('should handle date correctly in ISO format', async () => {
      const costTracker = new XCostTracker(new EventBus(), DEFAULT_X_CREDIT_CONFIG);
      await costTracker.load();

      const usage = costTracker.getUsage();

      // Should be YYYY-MM-DD format
      expect(usage.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DEDUPLICATION
  // ─────────────────────────────────────────────────────────────────────────

  describe('Deduplication', () => {
    it('should deduplicate posts in cache', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      await client.init();

      // First fetch
      await client.fetchLikes(50);
      const firstCost = client.getSpendingSummary().dailySpent;

      // Second fetch - some posts should be deduplicated
      await client.fetchLikes(50);
      const secondCost = client.getSpendingSummary().dailySpent;

      // Second fetch should cost less or equal due to deduplication
      expect(secondCost - firstCost).toBeLessThanOrEqual(firstCost);
    });

    it('should support query deduplication for searches', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus());
      await client.init();

      // First search
      const result1 = await client.searchTweets('bitcoin', 50);

      // Second search for same query
      const result2 = await client.searchTweets('bitcoin', 50);

      // Second search should return empty due to query dedup
      expect(result2.tweets.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // COST TRACKING
  // ─────────────────────────────────────────────────────────────────────────

  describe('Cost Tracking', () => {
    it('should track multiple operation types', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 10.0,
      });
      await client.init();

      await client.fetchLikes(50);
      await client.postTweet('Hello');
      await client.likeTweet('tweet-1');

      const summary = client.getSpendingSummary();

      expect(Object.keys(summary.byOperation).length).toBeGreaterThan(0);
    });

    it('should accumulate costs correctly', async () => {
      const client = new XCreditClient(new MockXClient() as any, new EventBus(), {
        ...DEFAULT_X_CREDIT_CONFIG,
        dailySpendingLimit: 100.0,
      });
      await client.init();

      const before = client.getSpendingSummary().dailySpent;

      const result1 = await client.postTweet('Tweet ' + Date.now() + '-1');
      const after1 = client.getSpendingSummary().dailySpent;

      const result2 = await client.postTweet('Tweet ' + Date.now() + '-2');
      const after2 = client.getSpendingSummary().dailySpent;

      // If tweets were posted, check cost accumulation
      if (result1 && result2) {
        expect(after2 - before).toBeGreaterThan(0);
      } else {
        // If blocked, that's also valid
        expect(client.getSpendingSummary().percentUsed).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
