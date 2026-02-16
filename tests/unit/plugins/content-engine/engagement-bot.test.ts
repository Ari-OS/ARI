// tests/unit/plugins/content-engine/engagement-bot.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EngagementBot } from '../../../../src/plugins/content-engine/engagement-bot.js';
import type { XClient } from '../../../../src/integrations/twitter/client.js';
import type { AIOrchestrator } from '../../../../src/ai/orchestrator.js';

describe('EngagementBot', () => {
  let mockXClient: XClient;
  let mockOrchestrator: AIOrchestrator;
  let bot: EngagementBot;

  beforeEach(() => {
    mockXClient = {
      searchRecent: vi.fn().mockResolvedValue({
        tweets: [],
        fetchedAt: '2026-02-16T10:00:00Z',
        source: 'search',
      }),
    } as unknown as XClient;

    mockOrchestrator = {
      execute: vi.fn().mockResolvedValue({
        content: 'Great insight! This aligns with how we approach AI automation at ARI.',
        model: 'claude-sonnet-4.5',
        cost: 0.001,
      }),
    } as unknown as AIOrchestrator;

    bot = new EngagementBot(mockXClient, mockOrchestrator);
  });

  it('should return empty array when XClient is null', async () => {
    const botNoClient = new EngagementBot(null, mockOrchestrator);
    const result = await botNoClient.findEngagementOpportunities();

    expect(result).toEqual([]);
  });

  it('should find engagement opportunities', async () => {
    mockXClient.searchRecent = vi.fn().mockResolvedValue({
      tweets: [
        {
          id: 'tweet-123',
          text: 'Just built an amazing AI automation tool for indie hackers! Check it out: https://example.com',
          authorId: 'user-1',
          authorUsername: 'builder_joe',
          createdAt: new Date().toISOString(),
          metrics: { likes: 50, retweets: 20, replies: 10, impressions: 1000 },
          urls: ['https://example.com'],
          hashtags: ['AI', 'automation'],
        },
      ],
      fetchedAt: '2026-02-16T10:00:00Z',
      source: 'search',
    });

    const opportunities = await bot.findEngagementOpportunities();

    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities[0].tweetId).toBe('tweet-123');
    expect(opportunities[0].authorUsername).toBe('builder_joe');
    expect(opportunities[0].status).toBe('pending');
    expect(opportunities[0].relevanceScore).toBeGreaterThanOrEqual(50);
  });

  it('should skip opportunities with low relevance scores', async () => {
    mockXClient.searchRecent = vi.fn().mockResolvedValue({
      tweets: [
        {
          id: 'tweet-456',
          text: 'Random tweet with no relevance',
          authorId: 'user-2',
          authorUsername: 'random_user',
          createdAt: new Date().toISOString(),
          metrics: { likes: 0, retweets: 0, replies: 0, impressions: 10 },
          urls: [],
          hashtags: [],
        },
      ],
      fetchedAt: '2026-02-16T10:00:00Z',
      source: 'search',
    });

    const opportunities = await bot.findEngagementOpportunities();

    expect(opportunities.length).toBe(0);
  });

  it('should determine engagement type based on content and score', async () => {
    mockXClient.searchRecent = vi.fn().mockResolvedValue({
      tweets: [
        {
          id: 'tweet-789',
          text: 'Building an AI agent system for solopreneurs. Here\'s my detailed approach and architecture... https://blog.example.com with lots of substantive content and details.',
          authorId: 'user-3',
          authorUsername: 'ai_expert',
          createdAt: new Date().toISOString(),
          metrics: { likes: 100, retweets: 50, replies: 25, impressions: 5000 },
          urls: ['https://blog.example.com'],
          hashtags: ['AI', 'automation'],
        },
      ],
      fetchedAt: '2026-02-16T10:00:00Z',
      source: 'search',
    });

    const opportunities = await bot.findEngagementOpportunities();

    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities[0].type).toBe('quote_tweet'); // High score + long content
  });

  it('should use reply for questions', async () => {
    mockXClient.searchRecent = vi.fn().mockResolvedValue({
      tweets: [
        {
          id: 'tweet-question',
          text: 'What do you think about using AI automation for small businesses? Looking for insights.',
          authorId: 'user-4',
          authorUsername: 'curious_founder',
          createdAt: new Date().toISOString(),
          metrics: { likes: 15, retweets: 5, replies: 8, impressions: 200 },
          urls: [],
          hashtags: [],
        },
      ],
      fetchedAt: '2026-02-16T10:00:00Z',
      source: 'search',
    });

    const opportunities = await bot.findEngagementOpportunities();

    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities[0].type).toBe('reply'); // Contains question
  });

  it('should get pending opportunities', async () => {
    mockXClient.searchRecent = vi.fn().mockResolvedValue({
      tweets: [
        {
          id: 'tweet-101',
          text: 'Excited about the future of AI automation for indie hackers!',
          authorId: 'user-5',
          authorUsername: 'indie_dev',
          createdAt: new Date().toISOString(),
          metrics: { likes: 30, retweets: 10, replies: 5, impressions: 500 },
          urls: [],
          hashtags: ['AI'],
        },
      ],
      fetchedAt: '2026-02-16T10:00:00Z',
      source: 'search',
    });

    await bot.findEngagementOpportunities();
    const pending = bot.getPendingOpportunities();

    expect(pending.length).toBeGreaterThan(0);
    expect(pending[0].status).toBe('pending');
  });

  it('should update opportunity status', async () => {
    mockXClient.searchRecent = vi.fn().mockResolvedValue({
      tweets: [
        {
          id: 'tweet-202',
          text: 'Building in public: my AI automation journey for solopreneurs',
          authorId: 'user-6',
          authorUsername: 'public_builder',
          createdAt: new Date().toISOString(),
          metrics: { likes: 40, retweets: 15, replies: 8, impressions: 800 },
          urls: [],
          hashtags: [],
        },
      ],
      fetchedAt: '2026-02-16T10:00:00Z',
      source: 'search',
    });

    const opportunities = await bot.findEngagementOpportunities();
    const oppId = opportunities[0].id;

    bot.updateOpportunityStatus(oppId, 'approved');

    const pending = bot.getPendingOpportunities();
    expect(pending.length).toBe(0);
  });

  it('should draft quote-tweet comment using AI', async () => {
    const comment = await bot.draftQuoteTweetComment({
      text: 'Just shipped a new AI automation feature for small businesses!',
      authorUsername: 'feature_shipper',
    });

    expect(comment).toBeTruthy();
    expect(comment.length).toBeLessThanOrEqual(200);
    expect(mockOrchestrator.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'chat',
        agent: 'autonomous',
      })
    );
  });

  it('should skip already processed opportunities', async () => {
    mockXClient.searchRecent = vi.fn().mockResolvedValue({
      tweets: [
        {
          id: 'tweet-303',
          text: 'TypeScript tips for AI automation developers',
          authorId: 'user-7',
          authorUsername: 'ts_expert',
          createdAt: new Date().toISOString(),
          metrics: { likes: 25, retweets: 8, replies: 4, impressions: 400 },
          urls: [],
          hashtags: ['TypeScript'],
        },
      ],
      fetchedAt: '2026-02-16T10:00:00Z',
      source: 'search',
    });

    const firstScan = await bot.findEngagementOpportunities();
    expect(firstScan.length).toBeGreaterThan(0);

    const secondScan = await bot.findEngagementOpportunities();
    expect(secondScan.length).toBe(0); // Already processed
  });
});
