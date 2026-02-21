import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerplexityClient, type PerplexityResult, type ResearchReport } from '../../../../src/integrations/perplexity/client.js';

// Mock logger
vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Test Data ──────────────────────────────────────────────────────────────

const MOCK_API_RESPONSE = {
  id: 'test-id-123',
  model: 'llama-3.1-sonar-small-128k-online',
  choices: [
    {
      message: {
        role: 'assistant',
        content: 'TypeScript is a strongly typed programming language that builds on JavaScript.',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 50,
    completion_tokens: 100,
    total_tokens: 150,
  },
  citations: [
    'https://www.typescriptlang.org',
    'https://github.com/microsoft/TypeScript',
  ],
};

const MOCK_RESEARCH_RESPONSE = {
  id: 'research-id-456',
  model: 'llama-3.1-sonar-small-128k-online',
  choices: [
    {
      message: {
        role: 'assistant',
        content: `SUMMARY:
Market trends in 2026 show continued growth in AI and automation sectors.
The technology sector is experiencing rapid transformation.

KEY FINDINGS:
- AI adoption increased by 40% across enterprises
- Remote work technologies remain critical infrastructure
- Sustainability is becoming a key market driver`,
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 75,
    completion_tokens: 200,
    total_tokens: 275,
  },
  citations: [
    'https://example.com/market-report-2026',
    'https://example.com/ai-trends',
  ],
};

const MOCK_MARKET_RESPONSE = {
  id: 'market-id-789',
  model: 'llama-3.1-sonar-small-128k-online',
  choices: [
    {
      message: {
        role: 'assistant',
        content: 'The Federal Reserve announced a rate cut due to economic slowdown concerns.',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 60,
    completion_tokens: 80,
    total_tokens: 140,
  },
  citations: [
    'https://example.com/fed-announcement',
  ],
};

// ─── Mock Fetch ─────────────────────────────────────────────────────────────

function mockFetch(response: unknown, status: number = 200): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 429 ? 'Too Many Requests' : 'Error',
    json: async () => response,
  });
}

function mockFetchError(message: string): void {
  global.fetch = vi.fn().mockRejectedValue(new Error(message));
}

function mockFetchSequence(responses: Array<{ response: unknown; status: number }>): void {
  const calls = responses.map(({ response, status }) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 429 ? 'Too Many Requests' : 'Error',
    json: async () => response,
  }));

  global.fetch = vi.fn()
    .mockResolvedValueOnce(calls[0])
    .mockResolvedValueOnce(calls[1])
    .mockResolvedValueOnce(calls[2]);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PerplexityClient', () => {
  let client: PerplexityClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new PerplexityClient('test-api-key');
  });

  describe('constructor', () => {
    it('should throw if API key is missing', () => {
      expect(() => new PerplexityClient('')).toThrow('Perplexity API key is required');
    });

    it('should create client with valid API key', () => {
      expect(client).toBeInstanceOf(PerplexityClient);
    });
  });

  describe('search', () => {
    it('should fetch and parse search results', async () => {
      mockFetch(MOCK_API_RESPONSE);

      const result = await client.search('What is TypeScript?');

      expect(result.answer).toBe('TypeScript is a strongly typed programming language that builds on JavaScript.');
      expect(result.citations).toEqual([
        'https://www.typescriptlang.org',
        'https://github.com/microsoft/TypeScript',
      ]);
      expect(result.model).toBe('llama-3.1-sonar-small-128k-online');
      expect(result.usage.promptTokens).toBe(50);
      expect(result.usage.completionTokens).toBe(100);
    });

    it('should use different system prompts based on focus', async () => {
      mockFetch(MOCK_API_RESPONSE);

      await client.search('AI research', 'academic');

      const fetchMock = vi.mocked(global.fetch);
      expect(fetchMock).toHaveBeenCalled();
      const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(requestBody.messages[0].content).toContain('academic');
    });

    it('should use cached results within TTL', async () => {
      mockFetch(MOCK_API_RESPONSE);

      await client.search('TypeScript');
      await client.search('TypeScript');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors', async () => {
      mockFetch({}, 401);

      await expect(client.search('test')).rejects.toThrow('Perplexity API error: 401');
    });

    it('should handle network errors', async () => {
      mockFetchError('Network failure');

      await expect(client.search('test')).rejects.toThrow('Failed to fetch from Perplexity after 3 attempts');
    });

    it('should retry on 429 rate limit', async () => {
      mockFetchSequence([
        { response: {}, status: 429 },
        { response: {}, status: 429 },
        { response: MOCK_API_RESPONSE, status: 200 },
      ]);

      const result = await client.search('test');

      expect(result.answer).toBe('TypeScript is a strongly typed programming language that builds on JavaScript.');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      mockFetch({}, 429);

      await expect(client.search('test')).rejects.toThrow('Failed to fetch from Perplexity after 3 attempts');
    });

    it('should handle missing citations gracefully', async () => {
      const responseWithoutCitations = {
        ...MOCK_API_RESPONSE,
        citations: undefined,
      };
      mockFetch(responseWithoutCitations);

      const result = await client.search('test');

      expect(result.citations).toEqual([]);
    });

    it('should include authorization header', async () => {
      mockFetch(MOCK_API_RESPONSE);

      await client.search('test');

      const fetchMock = vi.mocked(global.fetch);
      const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer test-api-key');
    });

    it('should send correct model parameter', async () => {
      mockFetch(MOCK_API_RESPONSE);

      await client.search('test');

      const fetchMock = vi.mocked(global.fetch);
      const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(requestBody.model).toBe('sonar');
    });
  });

  describe('deepResearch', () => {
    it('should conduct research with structured output', async () => {
      mockFetch(MOCK_RESEARCH_RESPONSE);

      const report = await client.deepResearch('Market trends 2026');

      expect(report.topic).toBe('Market trends 2026');
      expect(report.summary).toContain('Market trends in 2026');
      expect(report.keyFindings).toHaveLength(3);
      expect(report.keyFindings[0]).toContain('AI adoption');
      expect(report.citations).toEqual([
        'https://example.com/market-report-2026',
        'https://example.com/ai-trends',
      ]);
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('should include context when provided', async () => {
      mockFetch(MOCK_RESEARCH_RESPONSE);

      await client.deepResearch('AI trends', 'Focus on enterprise adoption');

      const fetchMock = vi.mocked(global.fetch);
      const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(requestBody.messages[1].content).toContain('Additional context: Focus on enterprise adoption');
    });

    it('should handle response without structured format', async () => {
      const unstructuredResponse = {
        ...MOCK_API_RESPONSE,
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'This is a simple unstructured response without sections.',
            },
            finish_reason: 'stop',
          },
        ],
      };
      mockFetch(unstructuredResponse);

      const report = await client.deepResearch('test topic');

      expect(report.topic).toBe('test topic');
      expect(report.summary).toBeTruthy();
      expect(report.keyFindings).toHaveLength(1);
    });

    it('should throw on API error', async () => {
      mockFetch({}, 500);

      await expect(client.deepResearch('test')).rejects.toThrow('Perplexity API error: 500');
    });
  });

  describe('explainMarketEvent', () => {
    it('should explain market events with context', async () => {
      mockFetch(MOCK_MARKET_RESPONSE);

      const result = await client.explainMarketEvent('Fed rate cut');

      expect(result.answer).toContain('Federal Reserve');
      expect(result.citations).toHaveLength(1);
    });

    it('should use financial analyst prompt', async () => {
      mockFetch(MOCK_MARKET_RESPONSE);

      await client.explainMarketEvent('Market crash');

      const fetchMock = vi.mocked(global.fetch);
      const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(requestBody.messages[0].content).toContain('financial analyst');
    });
  });

  describe('formatForBriefing', () => {
    it('should format result with citations', () => {
      const result: PerplexityResult = {
        answer: 'TypeScript is a typed superset of JavaScript.',
        citations: [
          'https://www.typescriptlang.org',
          'https://github.com/microsoft/TypeScript',
          'https://example.com/docs',
        ],
        model: 'test-model',
        usage: { promptTokens: 10, completionTokens: 20 },
      };

      const formatted = client.formatForBriefing(result);

      expect(formatted).toContain('TypeScript is a typed superset of JavaScript.');
      expect(formatted).toContain('Sources:');
      expect(formatted).toContain('https://www.typescriptlang.org');
      expect(formatted).toContain('https://github.com/microsoft/TypeScript');
    });

    it('should limit citations to 5', () => {
      const result: PerplexityResult = {
        answer: 'Test answer',
        citations: Array.from({ length: 10 }, (_, i) => `https://example.com/${i}`),
        model: 'test-model',
        usage: { promptTokens: 10, completionTokens: 20 },
      };

      const formatted = client.formatForBriefing(result);

      const citationLines = formatted.split('\n').filter(line => line.includes('example.com'));
      expect(citationLines.length).toBeLessThanOrEqual(5);
    });

    it('should handle empty citations', () => {
      const result: PerplexityResult = {
        answer: 'Test answer without citations',
        citations: [],
        model: 'test-model',
        usage: { promptTokens: 10, completionTokens: 20 },
      };

      const formatted = client.formatForBriefing(result);

      expect(formatted).toBe('Test answer without citations');
      expect(formatted).not.toContain('Sources:');
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limit between requests', async () => {
      mockFetch(MOCK_API_RESPONSE);

      const start = Date.now();
      await client.search('query1', 'web');
      await client.search('query2', 'news'); // Different cache key
      const elapsed = Date.now() - start;

      // Should wait at least 1200ms between requests (50 req/min)
      expect(elapsed).toBeGreaterThanOrEqual(1200);
    });
  });
});
