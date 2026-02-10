import type { PokemonCard, PokemonTcgApiResponse } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// POKEMON TCG API CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_URL = 'https://api.pokemontcg.io/v2';
const CARD_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes for card data
const PRICE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for price data
const MAX_TOKENS = 25;
const REFILL_INTERVAL_MS = 60_000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Pokemon TCG REST API client with token-bucket rate limiting and tiered caching.
 *
 * - Rate limit: 25 req/min
 * - Card data cache: 10 minutes
 * - Price data cache: 1 hour
 */
export class PokemonTcgClient {
  private readonly apiKey: string | undefined;
  private tokens: number = MAX_TOKENS;
  private lastRefill: number = Date.now();
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  // ── Public API ─────────────────────────────────────────────────────

  async searchCards(query: string, limit: number = 10): Promise<PokemonCard[]> {
    const key = `search:${query}:${limit}`;
    const response = await this.cachedFetch<PokemonTcgApiResponse>(
      key,
      `/cards?q=${encodeURIComponent(query)}&pageSize=${limit}`,
      CARD_CACHE_TTL_MS,
    );
    return response.data;
  }

  async getCard(id: string): Promise<PokemonCard> {
    const key = `card:${id}`;
    const response = await this.cachedFetch<{ data: PokemonCard }>(
      key,
      `/cards/${id}`,
      CARD_CACHE_TTL_MS,
    );
    return response.data;
  }

  async getCardPrices(id: string): Promise<PokemonCard> {
    const key = `prices:${id}`;
    return this.cachedFetch<PokemonCard>(
      key,
      `/cards/${id}`,
      PRICE_CACHE_TTL_MS,
    ).then(response => {
      // When fetched via card endpoint, data is nested
      return (response as unknown as { data: PokemonCard }).data ?? response;
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  // ── Rate Limiting ──────────────────────────────────────────────────

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed / REFILL_INTERVAL_MS) * MAX_TOKENS;

    if (tokensToAdd > 0) {
      this.tokens = Math.min(MAX_TOKENS, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  private async waitForToken(): Promise<void> {
    this.refillTokens();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    const waitMs = REFILL_INTERVAL_MS - (Date.now() - this.lastRefill);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    this.refillTokens();
    this.tokens--;
  }

  // ── Caching + Fetch ────────────────────────────────────────────────

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() < entry.expiresAt) return entry.data;
    return null;
  }

  private getStaleCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    return entry?.data ?? null;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttl });
  }

  private async cachedFetch<T>(key: string, endpoint: string, ttl: number): Promise<T> {
    const cached = this.getCached<T>(key);
    if (cached !== null) return cached;

    try {
      await this.waitForToken();

      const headers: Record<string, string> = {
        Accept: 'application/json',
      };

      if (this.apiKey) {
        headers['X-Api-Key'] = this.apiKey;
      }

      const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`Pokemon TCG API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as T;
      this.setCache(key, data, ttl);
      return data;
    } catch (error) {
      const stale = this.getStaleCached<T>(key);
      if (stale !== null) return stale;
      throw error;
    }
  }
}
