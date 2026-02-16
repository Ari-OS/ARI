import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleTrendsClient } from '../../../../src/integrations/trends/client.js';
import type { TrendingTopic, TrendData } from '../../../../src/integrations/trends/client.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('GoogleTrendsClient', () => {
  let client: GoogleTrendsClient;

  beforeEach(() => {
    client = new GoogleTrendsClient();
    vi.clearAllMocks();
  });

  describe('getDailyTrending', () => {
    it('should fetch daily trending topics', async () => {
      const mockResponse = {
        default: {
          trendingSearchesDays: [
            {
              trendingSearches: [
                {
                  title: { query: 'Test Topic 1' },
                  formattedTraffic: '500K+',
                  relatedQueries: [{ query: 'related 1' }, { query: 'related 2' }],
                  articles: [
                    {
                      title: 'Test Article',
                      url: 'https://example.com/article',
                      source: { title: 'Example News' },
                    },
                  ],
                  pubDate: '2026-02-16',
                },
                {
                  title: { query: 'Test Topic 2' },
                  formattedTraffic: '200K+',
                  relatedQueries: [],
                  articles: [],
                  pubDate: '2026-02-16',
                },
              ],
            },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => `)]}',$\n${JSON.stringify(mockResponse)}`,
      } as Response);

      const result = await client.getDailyTrending('US');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        title: 'Test Topic 1',
        searchVolume: '500K+',
        relatedQueries: ['related 1', 'related 2'],
        articles: [
          {
            title: 'Test Article',
            url: 'https://example.com/article',
            source: 'Example News',
          },
        ],
        startedTrending: '2026-02-16',
        category: 'general',
      });
      expect(result[1]).toEqual({
        title: 'Test Topic 2',
        searchVolume: '200K+',
        relatedQueries: [],
        articles: [],
        startedTrending: '2026-02-16',
        category: 'general',
      });
    });

    it('should return cached results on second call', async () => {
      const mockResponse = {
        default: {
          trendingSearchesDays: [
            {
              trendingSearches: [
                {
                  title: { query: 'Test Topic' },
                  formattedTraffic: '100K+',
                  relatedQueries: [],
                  articles: [],
                  pubDate: '2026-02-16',
                },
              ],
            },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => `)]}',$\n${JSON.stringify(mockResponse)}`,
      } as Response);

      await client.getDailyTrending('US');
      const result2 = await client.getDailyTrending('US');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result2).toHaveLength(1);
    });

    it('should throw on HTTP error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response);

      await expect(client.getDailyTrending('US')).rejects.toThrow('HTTP 429');
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        default: {
          trendingSearchesDays: [],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => `)]}',$\n${JSON.stringify(mockResponse)}`,
      } as Response);

      const result = await client.getDailyTrending('US');
      expect(result).toEqual([]);
    });

    it('should work with different geo codes', async () => {
      const mockResponse = {
        default: {
          trendingSearchesDays: [
            {
              trendingSearches: [
                {
                  title: { query: 'UK Topic' },
                  formattedTraffic: '100K+',
                  relatedQueries: [],
                  articles: [],
                  pubDate: '2026-02-16',
                },
              ],
            },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => `)]}',$\n${JSON.stringify(mockResponse)}`,
      } as Response);

      const result = await client.getDailyTrending('GB');

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('geo=GB'));
      expect(result[0]?.title).toBe('UK Topic');
    });
  });

  describe('getRealtimeTrending', () => {
    it('should fetch realtime trending topics', async () => {
      const mockResponse = {
        storySummaries: {
          trendingStories: [
            {
              title: 'Breaking News',
              entityNames: ['Entity 1', 'Entity 2'],
              articles: [
                {
                  articleTitle: 'Article Title',
                  url: 'https://example.com',
                  source: 'News Source',
                },
              ],
            },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => `)]}',$\n${JSON.stringify(mockResponse)}`,
      } as Response);

      const result = await client.getRealtimeTrending('all', 'US');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: 'Breaking News',
        searchVolume: 'N/A',
        relatedQueries: ['Entity 1', 'Entity 2'],
        category: 'general',
      });
      expect(result[0]?.articles[0]).toEqual({
        title: 'Article Title',
        url: 'https://example.com',
        source: 'News Source',
      });
    });

    it('should handle category parameter', async () => {
      const mockResponse = {
        storySummaries: {
          trendingStories: [
            {
              title: 'Tech News',
              entityNames: [],
              articles: [],
            },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => `)]}',$\n${JSON.stringify(mockResponse)}`,
      } as Response);

      const result = await client.getRealtimeTrending('tech', 'US');

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('category=tech'));
      expect(result[0]?.category).toBe('tech');
    });

    it('should cache realtime trends', async () => {
      const mockResponse = {
        storySummaries: {
          trendingStories: [
            {
              title: 'News',
              entityNames: [],
              articles: [],
            },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => `)]}',$\n${JSON.stringify(mockResponse)}`,
      } as Response);

      await client.getRealtimeTrending('all', 'US');
      await client.getRealtimeTrending('all', 'US');

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle missing storySummaries', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => `)]}',$\n{}`,
      } as Response);

      const result = await client.getRealtimeTrending();
      expect(result).toEqual([]);
    });
  });

  describe('getInterestOverTime', () => {
    it('should fetch interest over time data', async () => {
      const mockTokenResponse = {
        widgets: [
          {
            id: 'TIMESERIES',
            token: 'test-token-123',
          },
        ],
      };

      const mockDataResponse = {
        default: {
          timelineData: [
            { time: '1708041600', value: [50] },
            { time: '1708128000', value: [75] },
            { time: '1708214400', value: [100] },
          ],
        },
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `)]}',$\n${JSON.stringify(mockTokenResponse)}`,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `)]}',$\n${JSON.stringify(mockDataResponse)}`,
        } as Response);

      const result = await client.getInterestOverTime('test keyword', 7);

      expect(result.keyword).toBe('test keyword');
      expect(result.timelineData).toHaveLength(3);
      expect(result.timelineData[0]?.value).toBe(50);
      expect(result.timelineData[1]?.value).toBe(75);
      expect(result.timelineData[2]?.value).toBe(100);
    });

    it('should throw if no timeline widget found', async () => {
      const mockResponse = {
        widgets: [{ id: 'OTHER_WIDGET', token: 'token' }],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => `)]}',$\n${JSON.stringify(mockResponse)}`,
      } as Response);

      await expect(client.getInterestOverTime('keyword')).rejects.toThrow('No timeline widget token found');
    });

    it('should cache interest data', async () => {
      const mockTokenResponse = {
        widgets: [{ id: 'TIMESERIES', token: 'token' }],
      };

      const mockDataResponse = {
        default: {
          timelineData: [{ time: '1708041600', value: [50] }],
        },
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `)]}',$\n${JSON.stringify(mockTokenResponse)}`,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `)]}',$\n${JSON.stringify(mockDataResponse)}`,
        } as Response);

      await client.getInterestOverTime('keyword');
      await client.getInterestOverTime('keyword');

      expect(fetch).toHaveBeenCalledTimes(2); // Only first call
    });

    it('should handle missing timeline data', async () => {
      const mockTokenResponse = {
        widgets: [{ id: 'TIMESERIES', token: 'token' }],
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `)]}',$\n${JSON.stringify(mockTokenResponse)}`,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `)]}',$\n{}`,
        } as Response);

      const result = await client.getInterestOverTime('keyword');
      expect(result.timelineData).toEqual([]);
    });
  });

  describe('getRelatedTopics', () => {
    it('should fetch related topics', async () => {
      const mockExploreResponse = {
        widgets: [{ id: 'RELATED_TOPICS', token: 'topics-token' }],
      };

      const mockTopicsResponse = {
        default: {
          rankedList: [
            {
              rankedKeyword: [
                { topic: { title: 'Related Topic 1' } },
                { topic: { title: 'Related Topic 2' } },
                { topic: { title: 'Related Topic 3' } },
              ],
            },
          ],
        },
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `)]}',$\n${JSON.stringify(mockExploreResponse)}`,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `)]}',$\n${JSON.stringify(mockTopicsResponse)}`,
        } as Response);

      const result = await client.getRelatedTopics('test keyword');

      expect(result).toEqual(['Related Topic 1', 'Related Topic 2', 'Related Topic 3']);
    });

    it('should return empty array if no related topics widget found', async () => {
      const mockResponse = {
        widgets: [{ id: 'OTHER_WIDGET', token: 'token' }],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => `)]}',$\n${JSON.stringify(mockResponse)}`,
      } as Response);

      const result = await client.getRelatedTopics('keyword');
      expect(result).toEqual([]);
    });

    it('should cache related topics', async () => {
      const mockExploreResponse = {
        widgets: [{ id: 'RELATED_TOPICS', token: 'token' }],
      };

      const mockTopicsResponse = {
        default: {
          rankedList: [
            {
              rankedKeyword: [{ topic: { title: 'Topic' } }],
            },
          ],
        },
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `)]}',$\n${JSON.stringify(mockExploreResponse)}`,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `)]}',$\n${JSON.stringify(mockTopicsResponse)}`,
        } as Response);

      await client.getRelatedTopics('keyword');
      await client.getRelatedTopics('keyword');

      expect(fetch).toHaveBeenCalledTimes(2); // Only first call pair
    });

    it('should handle fetch errors gracefully', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const result = await client.getRelatedTopics('keyword');
      expect(result).toEqual([]);
    });

    it('should handle missing rankedList', async () => {
      const mockExploreResponse = {
        widgets: [{ id: 'RELATED_TOPICS', token: 'token' }],
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `)]}',$\n${JSON.stringify(mockExploreResponse)}`,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `)]}',$\n{}`,
        } as Response);

      const result = await client.getRelatedTopics('keyword');
      expect(result).toEqual([]);
    });
  });

  describe('formatForBriefing', () => {
    it('should format trending topics for briefing', () => {
      const topics: TrendingTopic[] = [
        {
          title: 'Topic 1',
          searchVolume: '500K+',
          relatedQueries: ['query1', 'query2', 'query3'],
          articles: [
            {
              title: 'Article 1',
              url: 'https://example.com/1',
              source: 'Source 1',
            },
          ],
          startedTrending: '2026-02-16',
          category: 'general',
        },
        {
          title: 'Topic 2',
          searchVolume: '200K+',
          relatedQueries: [],
          articles: [],
          startedTrending: '2026-02-16',
          category: 'tech',
        },
      ];

      const result = client.formatForBriefing(topics, 5);

      expect(result).toContain('Google Trends:');
      expect(result).toContain('1. Topic 1 (500K+)');
      expect(result).toContain('Related: query1, query2, query3');
      expect(result).toContain('Source 1: Article 1');
      expect(result).toContain('2. Topic 2 (200K+)');
    });

    it('should limit to specified number of topics', () => {
      const topics: TrendingTopic[] = Array.from({ length: 10 }, (_, i) => ({
        title: `Topic ${i + 1}`,
        searchVolume: '100K+',
        relatedQueries: [],
        articles: [],
        startedTrending: '2026-02-16',
        category: 'general',
      }));

      const result = client.formatForBriefing(topics, 3);

      expect(result).toContain('1. Topic 1');
      expect(result).toContain('2. Topic 2');
      expect(result).toContain('3. Topic 3');
      expect(result).not.toContain('4. Topic 4');
    });

    it('should handle empty topics array', () => {
      const result = client.formatForBriefing([]);
      expect(result).toContain('Google Trends:');
    });

    it('should handle topics without articles or related queries', () => {
      const topics: TrendingTopic[] = [
        {
          title: 'Simple Topic',
          searchVolume: '50K+',
          relatedQueries: [],
          articles: [],
          startedTrending: '2026-02-16',
          category: 'general',
        },
      ];

      const result = client.formatForBriefing(topics);

      expect(result).toContain('1. Simple Topic (50K+)');
      expect(result).not.toContain('Related:');
      expect(result).not.toContain('Source');
    });
  });
});
