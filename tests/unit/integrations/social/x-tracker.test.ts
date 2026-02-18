import { describe, it, expect, beforeEach, vi } from 'vitest';
import { XTracker } from '../../../../src/integrations/social/x-tracker.js';
import type { PostMetrics, TrackedPost, EngagementTrend } from '../../../../src/integrations/social/x-tracker.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEmit = vi.fn();
const mockEventBus = { emit: mockEmit } as unknown as ConstructorParameters<typeof XTracker>[0]['eventBus'];

vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<PostMetrics> = {}): PostMetrics {
  return {
    likes: 50,
    retweets: 10,
    replies: 5,
    impressions: 1000,
    bookmarks: 3,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('XTracker', () => {
  let tracker: XTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new XTracker({ eventBus: mockEventBus });
  });

  describe('trackPost()', () => {
    it('should store a tracked post', () => {
      tracker.trackPost('post_1', makeMetrics());

      const top = tracker.getTopPosts(1);
      expect(top).toHaveLength(1);
      expect(top[0].postId).toBe('post_1');
    });

    it('should calculate engagement rate correctly', () => {
      // (50 + 10 + 5 + 3) / 1000 = 0.068
      tracker.trackPost('post_1', makeMetrics());

      const top = tracker.getTopPosts(1);
      expect(top[0].engagementRate).toBeCloseTo(0.068, 3);
    });

    it('should handle zero impressions with zero engagement rate', () => {
      tracker.trackPost('post_1', makeMetrics({ impressions: 0 }));

      const top = tracker.getTopPosts(1);
      expect(top[0].engagementRate).toBe(0);
    });

    it('should update existing post metrics', () => {
      tracker.trackPost('post_1', makeMetrics({ likes: 10 }));
      tracker.trackPost('post_1', makeMetrics({ likes: 100 }));

      const top = tracker.getTopPosts(10);
      // The Map stores the latest, so we should have the updated one
      const post = top.find(p => p.postId === 'post_1');
      expect(post).toBeDefined();
      expect(post!.metrics.likes).toBe(100);
    });

    it('should add to history on each track call', () => {
      tracker.trackPost('post_1', makeMetrics());
      tracker.trackPost('post_1', makeMetrics());
      tracker.trackPost('post_2', makeMetrics());

      // 3 entries in history even though only 2 unique posts
      const trend = tracker.getEngagementTrend(365);
      expect(trend.totalImpressions).toBe(3000); // 3 x 1000
    });

    it('should record trackedAt timestamp', () => {
      tracker.trackPost('post_1', makeMetrics());

      const top = tracker.getTopPosts(1);
      expect(top[0].trackedAt).toBeDefined();
      expect(new Date(top[0].trackedAt).getTime()).not.toBeNaN();
    });
  });

  describe('trackPostWithContent()', () => {
    it('should store content along with metrics', () => {
      tracker.trackPostWithContent('post_1', 'Hello world!', makeMetrics());

      const top = tracker.getTopPosts(1);
      expect(top[0].content).toBe('Hello world!');
    });

    it('should calculate engagement rate same as trackPost', () => {
      tracker.trackPostWithContent('post_1', 'text', makeMetrics());

      const top = tracker.getTopPosts(1);
      expect(top[0].engagementRate).toBeCloseTo(0.068, 3);
    });
  });

  describe('getTopPosts()', () => {
    it('should return posts sorted by engagement rate descending', () => {
      tracker.trackPost('low', makeMetrics({ likes: 1, retweets: 0, replies: 0, bookmarks: 0, impressions: 1000 }));
      tracker.trackPost('high', makeMetrics({ likes: 200, retweets: 50, replies: 30, bookmarks: 20, impressions: 1000 }));
      tracker.trackPost('mid', makeMetrics({ likes: 50, retweets: 10, replies: 5, bookmarks: 5, impressions: 1000 }));

      const top = tracker.getTopPosts(10);

      expect(top[0].postId).toBe('high');
      expect(top[1].postId).toBe('mid');
      expect(top[2].postId).toBe('low');
    });

    it('should limit results to specified count', () => {
      tracker.trackPost('a', makeMetrics());
      tracker.trackPost('b', makeMetrics());
      tracker.trackPost('c', makeMetrics());

      const top = tracker.getTopPosts(2);

      expect(top).toHaveLength(2);
    });

    it('should return empty array when no posts tracked', () => {
      const top = tracker.getTopPosts(10);

      expect(top).toEqual([]);
    });

    it('should default to 10 when no limit specified', () => {
      for (let i = 0; i < 15; i++) {
        tracker.trackPost(`post_${i}`, makeMetrics());
      }

      const top = tracker.getTopPosts();

      expect(top).toHaveLength(10);
    });
  });

  describe('getEngagementTrend()', () => {
    it('should return zero trend when no posts exist', () => {
      const trend = tracker.getEngagementTrend();

      expect(trend.avgEngagementRate).toBe(0);
      expect(trend.totalImpressions).toBe(0);
      expect(trend.bestPerformingType).toBe('unknown');
      expect(trend.growthRate).toBe(0);
    });

    it('should calculate average engagement rate', () => {
      // Post 1: (50+10+5+3)/1000 = 0.068
      tracker.trackPost('p1', makeMetrics());
      // Post 2: (100+20+10+6)/2000 = 0.068
      tracker.trackPost('p2', makeMetrics({ likes: 100, retweets: 20, replies: 10, bookmarks: 6, impressions: 2000 }));

      const trend = tracker.getEngagementTrend(7);

      expect(trend.avgEngagementRate).toBeCloseTo(0.068, 3);
    });

    it('should sum total impressions', () => {
      tracker.trackPost('p1', makeMetrics({ impressions: 1000 }));
      tracker.trackPost('p2', makeMetrics({ impressions: 2000 }));

      const trend = tracker.getEngagementTrend(7);

      expect(trend.totalImpressions).toBe(3000);
    });

    it('should include period string', () => {
      const trend = tracker.getEngagementTrend(30);

      expect(trend.period).toBe('30d');
    });

    it('should identify engagement-driven as best type when likes dominate', () => {
      tracker.trackPost('p1', makeMetrics({ likes: 200, retweets: 1, replies: 1, bookmarks: 1, impressions: 1000 }));

      const trend = tracker.getEngagementTrend(7);

      expect(trend.bestPerformingType).toBe('engagement-driven');
    });

    it('should identify conversation-starter when replies dominate', () => {
      tracker.trackPost('p1', makeMetrics({ likes: 1, retweets: 1, replies: 200, bookmarks: 1, impressions: 1000 }));

      const trend = tracker.getEngagementTrend(7);

      expect(trend.bestPerformingType).toBe('conversation-starter');
    });

    it('should identify share-worthy when retweets dominate', () => {
      tracker.trackPost('p1', makeMetrics({ likes: 1, retweets: 200, replies: 1, bookmarks: 1, impressions: 1000 }));

      const trend = tracker.getEngagementTrend(7);

      expect(trend.bestPerformingType).toBe('share-worthy');
    });

    it('should identify reference-content when bookmarks dominate', () => {
      tracker.trackPost('p1', makeMetrics({ likes: 1, retweets: 1, replies: 1, bookmarks: 200, impressions: 1000 }));

      const trend = tracker.getEngagementTrend(7);

      expect(trend.bestPerformingType).toBe('reference-content');
    });

    it('should calculate growth rate by comparing first and second half', () => {
      // Add posts with increasing engagement — the growth rate calculation
      // compares first half vs second half sorted by trackedAt.
      // Since all posts are tracked at nearly the same time, the sort
      // preserves insertion order.
      for (let i = 0; i < 10; i++) {
        tracker.trackPost(`p${i}`, makeMetrics({
          likes: 10 + i * 10,
          impressions: 1000,
        }));
      }

      const trend = tracker.getEngagementTrend(365);

      // Growth rate should be non-zero since engagement changes across halves
      expect(trend.growthRate).not.toBe(0);
    });

    it('should return 0 growth rate with only 1 post', () => {
      tracker.trackPost('p1', makeMetrics());

      const trend = tracker.getEngagementTrend(7);

      expect(trend.growthRate).toBe(0);
    });

    it('should default to 7 days when no period specified', () => {
      const trend = tracker.getEngagementTrend();

      expect(trend.period).toBe('7d');
    });
  });

  describe('edge cases', () => {
    it('should handle posts with all zero metrics', () => {
      tracker.trackPost('p1', makeMetrics({
        likes: 0, retweets: 0, replies: 0, bookmarks: 0, impressions: 0,
      }));

      const top = tracker.getTopPosts(1);
      expect(top[0].engagementRate).toBe(0);
    });

    it('should handle very high engagement rates', () => {
      tracker.trackPost('viral', makeMetrics({
        likes: 10000, retweets: 5000, replies: 3000, bookmarks: 2000, impressions: 100,
      }));

      const top = tracker.getTopPosts(1);
      expect(top[0].engagementRate).toBe(200); // 20000 / 100
    });

    it('should handle many tracked posts without error', () => {
      for (let i = 0; i < 1000; i++) {
        tracker.trackPost(`p${i}`, makeMetrics());
      }

      const top = tracker.getTopPosts(5);
      expect(top).toHaveLength(5);

      const trend = tracker.getEngagementTrend(365);
      expect(trend.totalImpressions).toBe(1000000);
    });
  });
});
