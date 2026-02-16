import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HackerNewsClient, type HNStory } from '../../../../src/integrations/hackernews/client.js';

// Mock logger
vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── Test Data ──────────────────────────────────────────────────────────────

const SAMPLE_STORY: HNStory = {
  id: 123456,
  title: 'Show HN: My New AI Project',
  url: 'https://example.com/project',
  score: 250,
  by: 'testuser',
  time: 1700000000,
  descendants: 42,
  type: 'story',
};

const SAMPLE_STORY_2: HNStory = {
  id: 789012,
  title: 'TypeScript 6.0 Released',
  url: 'https://typescript.org/6.0',
  score: 500,
  by: 'typescript',
  time: 1700010000,
  descendants: 120,
  type: 'story',
};

const SAMPLE_STORY_3: HNStory = {
  id: 345678,
  title: 'Ask HN: Best practices for Node.js',
  score: 75,
  by: 'developer',
  time: 1700005000,
  descendants: 30,
  type: 'story',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockTopStoriesResponse(ids: number[]): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ids,
  });
}

function mockStoryResponse(story: HNStory | null): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => story,
  });
}

function mockFetchError(status = 500): void {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
  });
}

function mockFetchThrow(error: Error): void {
  mockFetch.mockRejectedValueOnce(error);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('HackerNewsClient', () => {
  let client: HackerNewsClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new HackerNewsClient();
  });

  describe('getTopStoryIds', () => {
    it('should fetch top story IDs from HN API', async () => {
      mockTopStoriesResponse([123, 456, 789]);

      const ids = await client.getTopStoryIds();

      expect(ids).toEqual([123, 456, 789]);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hacker-news.firebaseio.com/v0/topstories.json',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should limit number of IDs returned', async () => {
      mockTopStoriesResponse([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      const ids = await client.getTopStoryIds(3);

      expect(ids).toEqual([1, 2, 3]);
    });

    it('should return empty array on API error', async () => {
      mockFetchError(500);

      const ids = await client.getTopStoryIds();

      expect(ids).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      mockFetchThrow(new Error('Network error'));

      const ids = await client.getTopStoryIds();

      expect(ids).toEqual([]);
    });

    it('should use cached results within TTL', async () => {
      mockTopStoriesResponse([123, 456]);

      await client.getTopStoryIds();
      const ids = await client.getTopStoryIds();

      expect(ids).toEqual([123, 456]);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only once due to cache
    });
  });

  describe('getStoryDetails', () => {
    it('should fetch story details by ID', async () => {
      mockStoryResponse(SAMPLE_STORY);

      const story = await client.getStoryDetails(123456);

      expect(story).toEqual(SAMPLE_STORY);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hacker-news.firebaseio.com/v0/item/123456.json',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should handle null story response', async () => {
      mockStoryResponse(null);

      const story = await client.getStoryDetails(999999);

      expect(story).toBeNull();
    });

    it('should return null on API error', async () => {
      mockFetchError(404);

      const story = await client.getStoryDetails(123456);

      expect(story).toBeNull();
    });

    it('should cache story details', async () => {
      mockStoryResponse(SAMPLE_STORY);

      await client.getStoryDetails(123456);
      const story = await client.getStoryDetails(123456);

      expect(story).toEqual(SAMPLE_STORY);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Cached
    });
  });

  describe('getTopStories', () => {
    it('should fetch full details for top stories', async () => {
      mockTopStoriesResponse([123456, 789012]);
      mockStoryResponse(SAMPLE_STORY);
      mockStoryResponse(SAMPLE_STORY_2);

      const stories = await client.getTopStories(2);

      expect(stories).toHaveLength(2);
      expect(stories[0].title).toBe('Show HN: My New AI Project');
      expect(stories[1].title).toBe('TypeScript 6.0 Released');
    });

    it('should skip null stories', async () => {
      mockTopStoriesResponse([123456, 999999, 789012]);
      mockStoryResponse(SAMPLE_STORY);
      mockStoryResponse(null); // Missing story
      mockStoryResponse(SAMPLE_STORY_2);

      const stories = await client.getTopStories(3);

      expect(stories).toHaveLength(2); // Only 2 valid stories
    });

    it('should handle empty top stories list', async () => {
      mockTopStoriesResponse([]);

      const stories = await client.getTopStories(10);

      expect(stories).toEqual([]);
    });
  });

  describe('getRelevantStories', () => {
    it('should filter stories by keywords in title', async () => {
      mockTopStoriesResponse([123456, 789012, 345678]);
      mockStoryResponse(SAMPLE_STORY); // "AI" in title
      mockStoryResponse(SAMPLE_STORY_2); // "TypeScript" in title
      mockStoryResponse(SAMPLE_STORY_3); // "Node.js" in title

      const stories = await client.getRelevantStories(['typescript', 'node'], 10);

      expect(stories).toHaveLength(2);
      expect(stories.some(s => s.title.includes('TypeScript'))).toBe(true);
      expect(stories.some(s => s.title.includes('Node.js'))).toBe(true);
    });

    it('should filter stories by keywords in URL', async () => {
      mockTopStoriesResponse([789012]);
      mockStoryResponse(SAMPLE_STORY_2); // "typescript.org" in URL

      const stories = await client.getRelevantStories(['typescript'], 10);

      expect(stories).toHaveLength(1);
      expect(stories[0].url).toContain('typescript');
    });

    it('should be case-insensitive', async () => {
      mockTopStoriesResponse([123456]);
      mockStoryResponse(SAMPLE_STORY);

      const stories = await client.getRelevantStories(['AI', 'aI', 'ai'], 10);

      expect(stories).toHaveLength(1);
    });

    it('should respect limit parameter', async () => {
      mockTopStoriesResponse([123456, 789012, 345678]);
      mockStoryResponse(SAMPLE_STORY);
      mockStoryResponse(SAMPLE_STORY_2);
      // Should stop before fetching third story due to limit

      const stories = await client.getRelevantStories(['ai', 'typescript', 'node'], 2);

      expect(stories.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array when no keywords match', async () => {
      mockTopStoriesResponse([123456]);
      mockStoryResponse(SAMPLE_STORY);

      const stories = await client.getRelevantStories(['rust', 'golang'], 10);

      expect(stories).toEqual([]);
    });
  });

  describe('formatForBriefing', () => {
    it('should format stories for briefing display', () => {
      const stories = [SAMPLE_STORY, SAMPLE_STORY_2, SAMPLE_STORY_3];

      const formatted = client.formatForBriefing(stories);

      expect(formatted).toContain('TypeScript 6.0 Released'); // Highest score
      expect(formatted).toContain('500 pts');
      expect(formatted).toContain('120 comments');
      expect(formatted).toContain('https://typescript.org/6.0');
    });

    it('should sort stories by score descending', () => {
      const stories = [SAMPLE_STORY_3, SAMPLE_STORY, SAMPLE_STORY_2];

      const formatted = client.formatForBriefing(stories);

      const lines = formatted.split('\n');
      const firstStoryIndex = lines.findIndex(l => l.includes('TypeScript'));
      const secondStoryIndex = lines.findIndex(l => l.includes('Show HN'));
      const thirdStoryIndex = lines.findIndex(l => l.includes('Ask HN'));

      expect(firstStoryIndex).toBeLessThan(secondStoryIndex);
      expect(secondStoryIndex).toBeLessThan(thirdStoryIndex);
    });

    it('should handle stories without URL', () => {
      const storyNoUrl: HNStory = {
        ...SAMPLE_STORY,
        url: undefined,
      };

      const formatted = client.formatForBriefing([storyNoUrl]);

      expect(formatted).toContain('news.ycombinator.com/item?id=123456');
    });

    it('should return "No stories found" for empty array', () => {
      const formatted = client.formatForBriefing([]);

      expect(formatted).toBe('No stories found');
    });

    it('should truncate to 8 stories with overflow message', () => {
      const manyStories: HNStory[] = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        title: `Story ${i}`,
        url: `https://example.com/${i}`,
        score: 100 - i,
        by: 'user',
        time: 1700000000,
        type: 'story' as const,
      }));

      const formatted = client.formatForBriefing(manyStories);

      expect(formatted).toContain('... and 4 more');
      const storyLines = formatted.split('\n').filter(l => l.includes('Story'));
      expect(storyLines.length).toBeLessThanOrEqual(8);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      mockTopStoriesResponse([123]);
      mockStoryResponse(SAMPLE_STORY);

      await client.getTopStoryIds();
      await client.getStoryDetails(123);

      client.clearCache();

      // Next call should fetch again
      mockTopStoriesResponse([456]);
      await client.getTopStoryIds();

      expect(mockFetch).toHaveBeenCalledTimes(3); // 2 initial + 1 after clear
    });
  });
});
