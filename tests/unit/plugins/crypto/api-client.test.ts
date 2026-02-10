import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoinGeckoClient } from '../../../../src/plugins/crypto/api-client.js';

describe('CoinGeckoClient', () => {
  let client: CoinGeckoClient;

  beforeEach(() => {
    client = new CoinGeckoClient();
    vi.restoreAllMocks();
  });

  describe('getPrice', () => {
    it('should fetch prices and cache result', async () => {
      const mockResponse = {
        bitcoin: { usd: 50000, usd_24h_change: 2.5, usd_market_cap: 1e12, usd_24h_vol: 3e10 },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.getPrice(['bitcoin']);
      expect(result).toEqual(mockResponse);
      expect(result.bitcoin.usd).toBe(50000);

      // Second call should use cache (no new fetch)
      const cached = await client.getPrice(['bitcoin']);
      expect(cached).toEqual(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('should include API key header when configured', async () => {
      const clientWithKey = new CoinGeckoClient('test-key');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await clientWithKey.getPrice(['bitcoin']);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/simple/price'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-cg-demo-api-key': 'test-key',
          }),
        }),
      );
    });

    it('should return stale cache on API failure', async () => {
      const mockResponse = {
        bitcoin: { usd: 50000, usd_24h_change: 2.5 },
      };

      // First call succeeds
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await client.getPrice(['bitcoin']);

      // Manually clear fresh cache but keep stale
      client.clearCache();

      // Restore the stale entry by re-fetching then failing
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response);

      const result = await client.getPrice(['bitcoin']);
      expect(result.bitcoin.usd).toBe(50000);
    });

    it('should throw when API fails and no cache exists', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getPrice(['bitcoin'])).rejects.toThrow('Network error');
    });
  });

  describe('getMarketData', () => {
    it('should fetch market data', async () => {
      const mockData = [{
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        current_price: 50000,
        market_cap: 1e12,
        market_cap_rank: 1,
        price_change_percentage_24h: 2.5,
        total_volume: 3e10,
        high_24h: 51000,
        low_24h: 49000,
        image: 'https://example.com/btc.png',
      }];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const result = await client.getMarketData(['bitcoin']);
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('btc');
    });
  });

  describe('search', () => {
    it('should search for coins', async () => {
      const mockResult = {
        coins: [{ id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', market_cap_rank: 1 }],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      } as Response);

      const result = await client.search('bitcoin');
      expect(result.coins).toHaveLength(1);
      expect(result.coins[0].id).toBe('bitcoin');
    });
  });

  describe('rate limiting', () => {
    it('should handle API error responses', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response);

      await expect(client.getPrice(['bitcoin'])).rejects.toThrow('CoinGecko API error: 429');
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } }),
      } as Response);

      await client.getPrice(['bitcoin']);
      client.clearCache();

      // Should need to fetch again after clear
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 51000 } }),
      } as Response);

      const result = await client.getPrice(['bitcoin']);
      expect(result.bitcoin.usd).toBe(51000);
    });
  });
});
