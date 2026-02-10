import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PokemonTcgClient } from '../../../../src/plugins/pokemon-tcg/api-client.js';

describe('PokemonTcgClient', () => {
  let client: PokemonTcgClient;

  beforeEach(() => {
    client = new PokemonTcgClient();
    vi.restoreAllMocks();
  });

  describe('searchCards', () => {
    it('should search cards and cache results', async () => {
      const mockResponse = {
        data: [{
          id: 'base1-4',
          name: 'Charizard',
          supertype: 'Pokémon',
          set: { id: 'base1', name: 'Base', series: 'Base', releaseDate: '1999/01/09' },
          number: '4',
          rarity: 'Rare Holo',
          images: { small: 'https://example.com/small.png', large: 'https://example.com/large.png' },
        }],
        page: 1,
        pageSize: 10,
        count: 1,
        totalCount: 1,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.searchCards('name:charizard');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Charizard');

      // Second call should use cache
      const cached = await client.searchCards('name:charizard');
      expect(cached).toHaveLength(1);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('should include API key when configured', async () => {
      const clientWithKey = new PokemonTcgClient('test-key');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], page: 1, pageSize: 10, count: 0, totalCount: 0 }),
      } as Response);

      await clientWithKey.searchCards('name:pikachu');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/cards?q='),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Api-Key': 'test-key',
          }),
        }),
      );
    });
  });

  describe('getCard', () => {
    it('should fetch a single card', async () => {
      const mockCard = {
        data: {
          id: 'base1-4',
          name: 'Charizard',
          supertype: 'Pokémon',
          set: { id: 'base1', name: 'Base', series: 'Base', releaseDate: '1999/01/09' },
          number: '4',
          images: { small: 'https://example.com/small.png', large: 'https://example.com/large.png' },
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockCard,
      } as Response);

      const result = await client.getCard('base1-4');
      expect(result.id).toBe('base1-4');
      expect(result.name).toBe('Charizard');
    });
  });

  describe('error handling', () => {
    it('should throw on API error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response);

      await expect(client.searchCards('name:test')).rejects.toThrow('Pokemon TCG API error: 429');
    });

    it('should return stale cache on failure', async () => {
      const mockResponse = {
        data: [{ id: 'test-1', name: 'Test Card' }],
        page: 1, pageSize: 10, count: 1, totalCount: 1,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await client.searchCards('name:test');
      client.clearCache();

      // Re-fetch to populate stale cache
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.searchCards('name:test');
      expect(result).toHaveLength(1);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], page: 1, pageSize: 10, count: 0, totalCount: 0 }),
      } as Response);

      await client.searchCards('name:test');
      client.clearCache();

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'new' }], page: 1, pageSize: 10, count: 1, totalCount: 1 }),
      } as Response);

      const result = await client.searchCards('name:test');
      expect(result).toHaveLength(1);
    });
  });
});
