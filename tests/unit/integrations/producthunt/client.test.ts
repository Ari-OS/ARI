import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProductHuntClient } from '../../../../src/integrations/producthunt/client.js';
import type { PHProduct } from '../../../../src/integrations/producthunt/client.js';

describe('ProductHuntClient', () => {
  let client: ProductHuntClient;
  const mockToken = 'test-token-abc';

  beforeEach(() => {
    client = new ProductHuntClient(mockToken);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockProduct = (id: string, name: string, votes: number): unknown => ({
    id,
    name,
    tagline: `${name} tagline`,
    description: `${name} description`,
    url: `https://producthunt.com/${id}`,
    votesCount: votes,
    commentsCount: 10,
    createdAt: '2026-02-16T10:00:00Z',
    thumbnail: { url: `https://ph-files.imgix.net/${id}.png` },
    topics: {
      edges: [
        { node: { name: 'Tech' } },
        { node: { name: 'AI' } },
      ],
    },
  });

  const createMockResponse = (products: unknown[]) => ({
    data: {
      posts: {
        edges: products.map((node) => ({ node })),
      },
    },
  });

  describe('getTodayProducts', () => {
    it('should return today\'s products', async () => {
      const mockProducts = [
        createMockProduct('prod-1', 'Product 1', 100),
        createMockProduct('prod-2', 'Product 2', 50),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockResponse(mockProducts)),
      });

      const result = await client.getTodayProducts(2);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'prod-1',
        name: 'Product 1',
        tagline: 'Product 1 tagline',
        description: 'Product 1 description',
        url: 'https://producthunt.com/prod-1',
        votesCount: 100,
        commentsCount: 10,
        topics: ['Tech', 'AI'],
        thumbnail: 'https://ph-files.imgix.net/prod-1.png',
        createdAt: '2026-02-16T10:00:00Z',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.producthunt.com/v2/api/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string) as { variables: { postedAfter: string } };
      expect(body.variables.postedAfter).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00Z$/);
    });

    it('should use default limit of 10', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockResponse([])),
      });

      await client.getTodayProducts();

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string) as { variables: { first: number } };
      expect(body.variables.first).toBe(10);
    });

    it('should use cache on subsequent calls', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockResponse([])),
      });

      await client.getTodayProducts(5);
      await client.getTodayProducts(5);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.getTodayProducts()).rejects.toThrow(
        'Product Hunt API error: 401 Unauthorized',
      );
    });

    it('should throw on GraphQL errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          errors: [
            { message: 'Invalid token' },
            { message: 'Rate limit exceeded' },
          ],
        }),
      });

      await expect(client.getTodayProducts()).rejects.toThrow(
        'GraphQL errors: Invalid token, Rate limit exceeded',
      );
    });

    it('should throw on invalid response structure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      });

      await expect(client.getTodayProducts()).rejects.toThrow(
        'Invalid GraphQL response: missing posts data',
      );
    });
  });

  describe('getTopProducts', () => {
    it('should return top daily products', async () => {
      const mockProducts = [
        createMockProduct('top-1', 'Top Product', 500),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockResponse(mockProducts)),
      });

      const result = await client.getTopProducts('daily', 1);

      expect(result).toHaveLength(1);
      expect(result[0].votesCount).toBe(500);
    });

    it('should return top weekly products', async () => {
      const mockProducts = [
        createMockProduct('weekly-1', 'Weekly Top', 1000),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockResponse(mockProducts)),
      });

      const result = await client.getTopProducts('weekly', 1);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Weekly Top');
    });

    it('should return top monthly products', async () => {
      const mockProducts = [
        createMockProduct('monthly-1', 'Monthly Top', 5000),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockResponse(mockProducts)),
      });

      const result = await client.getTopProducts('monthly', 1);

      expect(result).toHaveLength(1);
      expect(result[0].votesCount).toBe(5000);
    });

    it('should use daily as default period', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockResponse([])),
      });

      await client.getTopProducts();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should use cache on subsequent calls', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockResponse([])),
      });

      await client.getTopProducts('weekly', 5);
      await client.getTopProducts('weekly', 5);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.getTopProducts()).rejects.toThrow(
        'Product Hunt API error: 500 Internal Server Error',
      );
    });
  });

  describe('searchProducts', () => {
    it('should search products by query', async () => {
      const mockProducts = [
        createMockProduct('search-1', 'AI Tool', 200),
        createMockProduct('search-2', 'AI Assistant', 150),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockResponse(mockProducts)),
      });

      const result = await client.searchProducts('AI', 2);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('AI Tool');
      expect(result[1].name).toBe('AI Assistant');

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string) as { variables: { query: string } };
      expect(body.variables.query).toBe('AI');
    });

    it('should use cache on subsequent calls', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockResponse([])),
      });

      await client.searchProducts('test', 5);
      await client.searchProducts('test', 5);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(client.searchProducts('test')).rejects.toThrow(
        'Product Hunt API error: 403 Forbidden',
      );
    });
  });

  describe('getProductsByTopic', () => {
    it('should return products by topic', async () => {
      const mockProducts = [
        createMockProduct('topic-1', 'DevTool', 300),
        createMockProduct('topic-2', 'IDE', 250),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockResponse(mockProducts)),
      });

      const result = await client.getProductsByTopic('developer-tools', 2);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('DevTool');

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string) as { variables: { topic: string } };
      expect(body.variables.topic).toBe('developer-tools');
    });

    it('should use cache on subsequent calls', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockResponse([])),
      });

      await client.getProductsByTopic('tech', 5);
      await client.getProductsByTopic('tech', 5);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(client.getProductsByTopic('nonexistent')).rejects.toThrow(
        'Product Hunt API error: 404 Not Found',
      );
    });
  });

  describe('formatForBriefing', () => {
    it('should format products for briefing', () => {
      const products: PHProduct[] = [
        {
          id: 'prod-1',
          name: 'Product 1',
          tagline: 'Best product ever',
          url: 'https://producthunt.com/prod-1',
          votesCount: 500,
          commentsCount: 50,
          topics: ['Tech', 'AI', 'Productivity'],
          createdAt: '2026-02-16T10:00:00Z',
        },
        {
          id: 'prod-2',
          name: 'Product 2',
          tagline: 'Second best product',
          url: 'https://producthunt.com/prod-2',
          votesCount: 300,
          commentsCount: 30,
          topics: [],
          createdAt: '2026-02-16T09:00:00Z',
        },
      ];

      const result = client.formatForBriefing(products);

      expect(result).toContain('Top Products:');
      expect(result).toContain('1. Product 1 - Best product ever');
      expect(result).toContain('500 votes');
      expect(result).toContain('[Tech, AI, Productivity]');
      expect(result).toContain('2. Product 2 - Second best product');
      expect(result).toContain('300 votes');
    });

    it('should limit to top 5 products', () => {
      const products: PHProduct[] = Array.from({ length: 10 }, (_, i) => ({
        id: `prod-${i}`,
        name: `Product ${i}`,
        tagline: `Tagline ${i}`,
        url: `https://producthunt.com/prod-${i}`,
        votesCount: 100 - i,
        commentsCount: 10,
        topics: ['Tech'],
        createdAt: '2026-02-16T10:00:00Z',
      }));

      const result = client.formatForBriefing(products);
      const productLines = result.split('\n\n').slice(1);

      expect(productLines).toHaveLength(5);
    });

    it('should handle products without topics', () => {
      const products: PHProduct[] = [
        {
          id: 'prod-1',
          name: 'Product 1',
          tagline: 'No topics',
          url: 'https://producthunt.com/prod-1',
          votesCount: 100,
          commentsCount: 10,
          topics: [],
          createdAt: '2026-02-16T10:00:00Z',
        },
      ];

      const result = client.formatForBriefing(products);

      expect(result).toContain('1. Product 1 - No topics');
      expect(result).toContain('100 votes');
      expect(result).not.toContain('[');
    });

    it('should handle empty product list', () => {
      const result = client.formatForBriefing([]);

      expect(result).toBe('No products found.');
    });

    it('should limit topics to first 3', () => {
      const products: PHProduct[] = [
        {
          id: 'prod-1',
          name: 'Product 1',
          tagline: 'Many topics',
          url: 'https://producthunt.com/prod-1',
          votesCount: 100,
          commentsCount: 10,
          topics: ['Tech', 'AI', 'Productivity', 'Design', 'Marketing'],
          createdAt: '2026-02-16T10:00:00Z',
        },
      ];

      const result = client.formatForBriefing(products);

      expect(result).toContain('[Tech, AI, Productivity]');
      expect(result).not.toContain('Design');
      expect(result).not.toContain('Marketing');
    });
  });

  describe('edge cases', () => {
    it('should handle products with missing optional fields', async () => {
      const mockProduct = {
        id: 'minimal',
        name: 'Minimal Product',
        tagline: 'Basic',
        url: 'https://producthunt.com/minimal',
        votesCount: 10,
        commentsCount: 0,
        createdAt: '2026-02-16T10:00:00Z',
        topics: { edges: [] },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockResponse([mockProduct])),
      });

      const result = await client.getTodayProducts(1);

      expect(result).toHaveLength(1);
      expect(result[0].description).toBeUndefined();
      expect(result[0].thumbnail).toBeUndefined();
      expect(result[0].topics).toEqual([]);
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(client.getTodayProducts()).rejects.toThrow('Network error');
    });
  });
});
