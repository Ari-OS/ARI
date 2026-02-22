import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TavilyClient, type TavilyResult } from '../../../../src/integrations/tavily/client.js';

vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Test Data ───────────────────────────────────────────────────────────────

const MOCK_API_RESPONSE = {
  answer: 'Bitcoin surged 8% today driven by ETF inflows.',
  results: [
    {
      title: 'Bitcoin ETF Record Inflows',
      url: 'https://coindesk.com/btc-etf-inflows',
      content: 'BlackRock IBIT saw record $500M inflows today.',
      score: 0.95,
      published_date: '2026-02-21T10:00:00Z',
    },
    {
      title: 'Crypto Market Update',
      url: 'https://cointelegraph.com/market',
      content: 'Total market cap rose 5% amid BTC rally.',
      score: 0.82,
    },
  ],
  query: 'Why is Bitcoin up today?',
  response_time: 1.23,
};

describe('TavilyClient', () => {
  let client: TavilyClient;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new TavilyClient('test-tavily-api-key');
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(MOCK_API_RESPONSE),
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('should throw when no API key provided', () => {
      expect(() => new TavilyClient('')).toThrow('Tavily API key is required');
    });

    it('should create client with valid API key', () => {
      expect(client).toBeDefined();
    });
  });

  describe('search()', () => {
    it('should return a TavilyResult with answer and results', async () => {
      const result = await client.search('Why is Bitcoin up today?');

      expect(result.answer).toBe('Bitcoin surged 8% today driven by ETF inflows.');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].title).toBe('Bitcoin ETF Record Inflows');
      expect(result.results[0].publishedDate).toBe('2026-02-21T10:00:00Z');
      expect(result.responseTime).toBe(1.23);
    });

    it('should send correct request body to Tavily API', async () => {
      await client.search('AI news today', { searchDepth: 'advanced', maxResults: 10 });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.tavily.com/search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      );

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string) as Record<string, unknown>;
      expect(body.query).toBe('AI news today');
      expect(body.search_depth).toBe('advanced');
      expect(body.max_results).toBe(10);
      expect(body.include_answer).toBe(true);
      expect(body.api_key).toBe('test-tavily-api-key');
    });

    it('should use cache on repeated identical queries', async () => {
      await client.search('cached query');
      await client.search('cached query');

      expect(fetchSpy).toHaveBeenCalledTimes(1); // Second call served from cache
    });

    it('should throw on API error response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized'),
      });

      await expect(client.search('test')).rejects.toThrow('Tavily API error: 401');
    });
  });

  describe('searchNews()', () => {
    it('should call search with news topic and advanced depth', async () => {
      const searchSpy = vi.spyOn(client, 'search').mockResolvedValue({
        answer: 'Today in tech...',
        results: [],
        query: 'tech news',
        responseTime: 0.5,
      });

      await client.searchNews('tech news today');

      expect(searchSpy).toHaveBeenCalledWith(
        'tech news today',
        expect.objectContaining({ topic: 'news', searchDepth: 'advanced', days: 3 }),
      );
    });
  });

  describe('deepResearch()', () => {
    it('should call search with advanced depth and raw content', async () => {
      const searchSpy = vi.spyOn(client, 'search').mockResolvedValue({
        answer: 'Deep analysis...',
        results: [],
        query: 'AI landscape',
        responseTime: 2.1,
      });

      await client.deepResearch('AI landscape 2026');

      expect(searchSpy).toHaveBeenCalledWith(
        'AI landscape 2026',
        expect.objectContaining({
          searchDepth: 'advanced',
          includeRawContent: true,
          maxResults: 15,
        }),
      );
    });
  });

  describe('formatForBriefing()', () => {
    it('should format result with answer and top citations', () => {
      const result: TavilyResult = {
        answer: 'BTC is up due to ETF inflows.',
        results: [
          { title: 'Source A', url: 'https://a.com', content: '...', score: 0.9 },
          { title: 'Source B', url: 'https://b.com', content: '...', score: 0.7 },
          { title: 'Source C', url: 'https://c.com', content: '...', score: 0.5 },
          { title: 'Source D', url: 'https://d.com', content: '...', score: 0.3 },
        ],
        query: 'BTC movement',
        responseTime: 1.0,
      };

      const formatted = client.formatForBriefing(result, 2);

      expect(formatted).toContain('BTC is up due to ETF inflows.');
      expect(formatted).toContain('Sources:');
      expect(formatted).toContain('<a href="https://a.com">Source A</a>');
      expect(formatted).toContain('<a href="https://b.com">Source B</a>');
      expect(formatted).not.toContain('Source C'); // maxCitations = 2
    });

    it('should handle result with no answer', () => {
      const result: TavilyResult = {
        answer: '',
        results: [{ title: 'Only Source', url: 'https://only.com', content: '...', score: 1.0 }],
        query: 'test',
        responseTime: 0.5,
      };

      const formatted = client.formatForBriefing(result);

      expect(formatted).toContain('Sources:');
      expect(formatted).not.toContain('\n\n'); // No double-blank from missing answer
    });
  });
});
