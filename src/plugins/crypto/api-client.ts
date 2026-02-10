import type {
  CoinGeckoPrice,
  CoinGeckoMarketData,
  CoinGeckoSearchResult,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// COINGECKO API CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_URL = 'https://api.coingecko.com/api/v3';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_TOKENS = 25;
const REFILL_INTERVAL_MS = 60_000; // 1 minute

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * CoinGecko REST API client with token-bucket rate limiting and in-memory caching.
 *
 * - Rate limit: 25 req/min (conservative under 30/min free tier)
 * - Cache TTL: 5 minutes
 * - Graceful degradation: returns cached data on API failure
 */
export class CoinGeckoClient {
  private readonly apiKey: string | undefined;
  private tokens: number = MAX_TOKENS;
  private lastRefill: number = Date.now();
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  // ── Public API ─────────────────────────────────────────────────────

  async getPrice(
    coinIds: string[],
    currency: string = 'usd',
  ): Promise<CoinGeckoPrice> {
    const ids = coinIds.join(',');
    const key = `price:${ids}:${currency}`;

    return this.cachedFetch<CoinGeckoPrice>(
      key,
      `/simple/price?ids=${ids}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
    );
  }

  async getMarketData(
    coinIds: string[],
    currency: string = 'usd',
  ): Promise<CoinGeckoMarketData[]> {
    const ids = coinIds.join(',');
    const key = `market:${ids}:${currency}`;

    return this.cachedFetch<CoinGeckoMarketData[]>(
      key,
      `/coins/markets?vs_currency=${currency}&ids=${ids}&order=market_cap_desc&sparkline=false`,
    );
  }

  async search(query: string): Promise<CoinGeckoSearchResult> {
    const key = `search:${query}`;
    return this.cachedFetch<CoinGeckoSearchResult>(key, `/search?query=${encodeURIComponent(query)}`);
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

    // Wait until next refill
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

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  private async cachedFetch<T>(key: string, endpoint: string): Promise<T> {
    // Check fresh cache
    const cached = this.getCached<T>(key);
    if (cached !== null) return cached;

    try {
      await this.waitForToken();

      const headers: Record<string, string> = {
        Accept: 'application/json',
      };

      if (this.apiKey) {
        headers['x-cg-demo-api-key'] = this.apiKey;
      }

      const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as T;
      this.setCache(key, data);
      return data;
    } catch (error) {
      // Return stale cached data on failure
      const stale = this.getStaleCached<T>(key);
      if (stale !== null) return stale;
      throw error;
    }
  }
}
