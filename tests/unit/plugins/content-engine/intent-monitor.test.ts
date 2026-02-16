// tests/unit/plugins/content-engine/intent-monitor.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntentMonitor } from '../../../../src/plugins/content-engine/intent-monitor.js';
import type { XClient } from '../../../../src/integrations/twitter/client.js';
import type { AIOrchestrator } from '../../../../src/ai/orchestrator.js';

describe('IntentMonitor', () => {
  let mockXClient: XClient;
  let mockOrchestrator: AIOrchestrator;
  let monitor: IntentMonitor;

  beforeEach(() => {
    mockXClient = {
      searchRecent: vi.fn().mockResolvedValue({
        tweets: [],
        fetchedAt: '2026-02-16T10:00:00Z',
        source: 'search',
      }),
    } as unknown as XClient;

    mockOrchestrator = {} as AIOrchestrator;

    monitor = new IntentMonitor(mockXClient, mockOrchestrator);
  });

  it('should return empty array when XClient is null', async () => {
    const monitorNoClient = new IntentMonitor(null, mockOrchestrator);
    const result = await monitorNoClient.scan();

    expect(result).toEqual([]);
  });

  it('should scan and find buying intent matches', async () => {
    mockXClient.searchRecent = vi.fn().mockResolvedValue({
      tweets: [
        {
          id: 'tweet-123',
          text: 'Looking for IT help with my small business website',
          authorId: 'user-1',
          authorUsername: 'john_doe',
          createdAt: new Date().toISOString(),
          metrics: { likes: 5, retweets: 2, replies: 1, impressions: 100 },
          urls: [],
          hashtags: [],
        },
      ],
      fetchedAt: '2026-02-16T10:00:00Z',
      source: 'search',
    });

    const matches = await monitor.scan();

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].tweetId).toBe('tweet-123');
    expect(matches[0].authorUsername).toBe('john_doe');
    expect(matches[0].matchedKeywords).toContain('looking for IT help');
    expect(matches[0].status).toBe('pending');
  });

  it('should skip matches with score below threshold', async () => {
    mockXClient.searchRecent = vi.fn().mockResolvedValue({
      tweets: [
        {
          id: 'tweet-456',
          text: 'Just a random tweet',
          authorId: 'user-2',
          authorUsername: 'jane_smith',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days old
          metrics: { likes: 0, retweets: 0, replies: 0, impressions: 10 },
          urls: [],
          hashtags: [],
        },
      ],
      fetchedAt: '2026-02-16T10:00:00Z',
      source: 'search',
    });

    const matches = await monitor.scan();

    expect(matches.length).toBe(0);
  });

  it('should skip already processed matches', async () => {
    mockXClient.searchRecent = vi.fn().mockResolvedValue({
      tweets: [
        {
          id: 'tweet-789',
          text: 'Need developer for my project',
          authorId: 'user-3',
          authorUsername: 'alice_jones',
          createdAt: new Date().toISOString(),
          metrics: { likes: 10, retweets: 5, replies: 2, impressions: 200 },
          urls: [],
          hashtags: [],
        },
      ],
      fetchedAt: '2026-02-16T10:00:00Z',
      source: 'search',
    });

    const firstScan = await monitor.scan();
    expect(firstScan.length).toBeGreaterThan(0);

    const secondScan = await monitor.scan();
    expect(secondScan.length).toBe(0); // Already processed
  });

  it('should get pending matches', async () => {
    mockXClient.searchRecent = vi.fn().mockResolvedValue({
      tweets: [
        {
          id: 'tweet-101',
          text: 'Looking for freelancer to help with AI automation',
          authorId: 'user-4',
          authorUsername: 'bob_builder',
          createdAt: new Date().toISOString(),
          metrics: { likes: 8, retweets: 3, replies: 1, impressions: 150 },
          urls: [],
          hashtags: [],
        },
      ],
      fetchedAt: '2026-02-16T10:00:00Z',
      source: 'search',
    });

    await monitor.scan();
    const pending = monitor.getPendingMatches();

    expect(pending.length).toBeGreaterThan(0);
    expect(pending[0].status).toBe('pending');
  });

  it('should update match status', async () => {
    mockXClient.searchRecent = vi.fn().mockResolvedValue({
      tweets: [
        {
          id: 'tweet-202',
          text: 'Need a website for my startup',
          authorId: 'user-5',
          authorUsername: 'carol_founder',
          createdAt: new Date().toISOString(),
          metrics: { likes: 12, retweets: 4, replies: 2, impressions: 250 },
          urls: [],
          hashtags: [],
        },
      ],
      fetchedAt: '2026-02-16T10:00:00Z',
      source: 'search',
    });

    const matches = await monitor.scan();
    const matchId = matches[0].id;

    monitor.updateMatchStatus(matchId, 'approved');

    const pending = monitor.getPendingMatches();
    expect(pending.length).toBe(0);
  });

  it('should score matches based on engagement and recency', async () => {
    const recentTweet = {
      id: 'tweet-recent',
      text: 'Looking for IT help need developer',
      authorId: 'user-6',
      authorUsername: 'recent_user',
      createdAt: new Date().toISOString(), // Very recent
      metrics: { likes: 20, retweets: 10, replies: 5, impressions: 500 },
      urls: [],
      hashtags: [],
    };

    const oldTweet = {
      id: 'tweet-old',
      text: 'Looking for IT help need developer',
      authorId: 'user-7',
      authorUsername: 'old_user',
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days old
      metrics: { likes: 1, retweets: 0, replies: 0, impressions: 20 },
      urls: [],
      hashtags: [],
    };

    mockXClient.searchRecent = vi.fn()
      .mockResolvedValueOnce({
        tweets: [recentTweet],
        fetchedAt: '2026-02-16T10:00:00Z',
        source: 'search',
      })
      .mockResolvedValueOnce({
        tweets: [oldTweet],
        fetchedAt: '2026-02-16T10:01:00Z',
        source: 'search',
      });

    const recentMatches = await monitor.scan();
    const recentScore = recentMatches.find((m) => m.tweetId === 'tweet-recent')?.score ?? 0;

    const oldMatches = await monitor.scan();
    const oldScore = oldMatches.find((m) => m.tweetId === 'tweet-old')?.score ?? 0;

    expect(recentScore).toBeGreaterThan(oldScore);
  });
});
