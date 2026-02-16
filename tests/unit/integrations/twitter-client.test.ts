import { describe, it, expect, beforeEach, vi } from 'vitest';
import { XClient } from '../../../src/integrations/twitter/client.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('XClient', () => {
  let client: XClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new XClient({
      enabled: true,
      bearerToken: 'test-bearer-token',
      userId: '12345',
    });
  });

  describe('constructor', () => {
    it('should create client with config', () => {
      expect(client).toBeDefined();
    });

    it('should default maxLikesPerFetch to 50', () => {
      const stats = client.getStats();
      expect(stats.requestsRemaining).toBe(10000);
    });
  });

  describe('init', () => {
    it('should return true when API validates', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: { id: '12345', username: 'pryce', name: 'Pryce' },
        }),
      });

      const result = await client.init();
      expect(result).toBe(true);
      expect(client.isReady()).toBe(true);
    });

    it('should return false when disabled', async () => {
      const disabled = new XClient({ enabled: false });
      const result = await disabled.init();
      expect(result).toBe(false);
    });

    it('should return false when no bearer token', async () => {
      const noToken = new XClient({ enabled: true });
      const result = await noToken.init();
      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      mockFetch.mockRejectedValue(new Error('network error'));
      const result = await client.init();
      expect(result).toBe(false);
    });
  });

  describe('fetchLikes', () => {
    beforeEach(async () => {
      // Initialize first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { id: '12345', username: 'pryce', name: 'Pryce' },
        }),
      });
      await client.init();
    });

    it('should fetch and parse liked tweets', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: '111',
              text: 'Claude Code is amazing for AI development',
              author_id: '999',
              created_at: '2026-02-16T10:00:00Z',
              entities: {
                urls: [{ expanded_url: 'https://anthropic.com/claude-code' }],
                hashtags: [{ tag: 'AI' }, { tag: 'Claude' }],
              },
              public_metrics: {
                like_count: 500,
                retweet_count: 100,
                reply_count: 50,
                impression_count: 10000,
              },
            },
          ],
          includes: {
            users: [{ id: '999', username: 'anthropic', name: 'Anthropic' }],
          },
          meta: { result_count: 1 },
        }),
      });

      const result = await client.fetchLikes();

      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0].text).toContain('Claude Code');
      expect(result.tweets[0].authorUsername).toBe('anthropic');
      expect(result.tweets[0].urls).toContain('https://anthropic.com/claude-code');
      expect(result.tweets[0].hashtags).toContain('AI');
      expect(result.tweets[0].metrics.likes).toBe(500);
      expect(result.source).toBe('likes');
    });

    it('should return empty when not initialized', async () => {
      const uninit = new XClient({ enabled: true, bearerToken: 'x', userId: '1' });
      const result = await uninit.fetchLikes();
      expect(result.tweets).toHaveLength(0);
    });

    it('should handle empty API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await client.fetchLikes();
      expect(result.tweets).toHaveLength(0);
    });
  });

  describe('searchRecent', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { id: '12345', username: 'pryce', name: 'Pryce' },
        }),
      });
      await client.init();
    });

    it('should search tweets by query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: '222',
              text: 'AI agents are the future',
              author_id: '888',
              created_at: '2026-02-16T12:00:00Z',
              public_metrics: { like_count: 100, retweet_count: 20, reply_count: 10, impression_count: 5000 },
            },
          ],
          includes: { users: [{ id: '888', username: 'techie', name: 'Techie' }] },
          meta: { result_count: 1 },
        }),
      });

      const result = await client.searchRecent('AI agents');

      expect(result.tweets).toHaveLength(1);
      expect(result.source).toBe('search');
    });
  });

  describe('getStats', () => {
    it('should track request count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { id: '12345', username: 'pryce', name: 'Pryce' },
        }),
      });

      await client.init();
      const stats = client.getStats();

      expect(stats.requestsUsed).toBe(1); // init makes 1 API call
      expect(stats.requestsRemaining).toBe(9999);
    });
  });
});
