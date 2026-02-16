/**
 * ARI Market Monitor
 *
 * Multi-asset market monitoring system for crypto, stocks, Pokemon cards, and ETFs.
 * Provides smart threshold-based alerts per asset class with configurable watchlists.
 *
 * Architecture: L5 Autonomous layer
 * Integrations:
 *   - CoinGecko (crypto) via CryptoPlugin
 *   - Alpha Vantage (stocks/ETFs)
 *   - TCGPlayer (Pokemon cards) via Pokemon TCG Plugin
 *
 * Events emitted:
 *   - market:snapshot_complete
 *   - market:price_alert
 */

import { z } from 'zod';
import type { EventBus } from '../kernel/event-bus.js';
import { CoinGeckoClient } from '../plugins/crypto/api-client.js';
import { PokemonTcgClient } from '../plugins/pokemon-tcg/api-client.js';
import type { CoinGeckoPrice } from '../plugins/crypto/types.js';
import type { PokemonCard } from '../plugins/pokemon-tcg/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES AND SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const AssetClassSchema = z.enum(['crypto', 'stock', 'pokemon', 'etf', 'commodity']);
export type AssetClass = z.infer<typeof AssetClassSchema>;

export const AlertTypeSchema = z.enum([
  'price_spike',
  'price_drop',
  'volume_anomaly',
  'trend_reversal',
  'new_high',
  'new_low',
]);
export type AlertType = z.infer<typeof AlertTypeSchema>;

export const AlertSeveritySchema = z.enum(['info', 'notable', 'significant', 'critical']);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

export interface PriceSnapshot {
  asset: string;
  assetClass: AssetClass;
  price: number;
  change24h: number;
  change7d: number;
  change30d: number;
  volume24h?: number;
  marketCap?: number;
  timestamp: string;
  source: string;
}

export interface MarketAlert {
  asset: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  data: {
    currentPrice: number;
    previousPrice: number;
    changePercent: number;
    threshold: number;
  };
}

export interface WatchlistEntry {
  asset: string;
  assetClass: AssetClass;
  addedAt: string;
  lastPrice?: number;
  lastChecked?: string;
}

export interface AssetThresholds {
  daily: number;   // Percentage threshold for 24h change
  weekly: number;  // Percentage threshold for 7d change
  monthly?: number; // Percentage threshold for 30d change (optional)
}

export interface MarketMonitorConfig {
  cryptoApiKey?: string;
  pokemonApiKey?: string;
  alphaVantageApiKey?: string;
  thresholds: Record<AssetClass, AssetThresholds>;
  cacheEnabled: boolean;
  cacheTtlMs: number;
}

// ── Default Thresholds ────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS: Record<AssetClass, AssetThresholds> = {
  crypto: { daily: 3, weekly: 10 },
  stock: { daily: 2, weekly: 5 },
  pokemon: { daily: 0, weekly: 10, monthly: 20 }, // Pokemon has no daily, uses weekly/monthly
  etf: { daily: 1.5, weekly: 3 },
  commodity: { daily: 2, weekly: 5 },
};

// ── Alpha Vantage Types ───────────────────────────────────────────────────────

interface AlphaVantageQuote {
  'Global Quote': {
    '01. symbol': string;
    '02. open': string;
    '03. high': string;
    '04. low': string;
    '05. price': string;
    '06. volume': string;
    '07. latest trading day': string;
    '08. previous close': string;
    '09. change': string;
    '10. change percent': string;
  };
}

interface AlphaVantageTimeSeriesDaily {
  'Meta Data': {
    '1. Information': string;
    '2. Symbol': string;
    '3. Last Refreshed': string;
  };
  'Time Series (Daily)': Record<string, {
    '1. open': string;
    '2. high': string;
    '3. low': string;
    '4. close': string;
    '5. volume': string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALPHA VANTAGE CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';
const ALPHA_VANTAGE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Alpha Vantage API client for stocks and ETFs.
 * Free tier: 25 requests/day, so aggressive caching is essential.
 */
class AlphaVantageClient {
  private readonly apiKey: string | undefined;
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async getQuote(symbol: string): Promise<AlphaVantageQuote | null> {
    if (!this.apiKey) return null;

    const key = `quote:${symbol}`;
    const cached = this.getCached<AlphaVantageQuote>(key);
    if (cached) return cached;

    try {
      const url = `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data = await response.json() as AlphaVantageQuote;

      // Check for API limit or invalid response
      if (!data['Global Quote'] || Object.keys(data['Global Quote']).length === 0) {
        return null;
      }

      this.setCache(key, data);
      return data;
    } catch {
      return this.getStaleCached<AlphaVantageQuote>(key);
    }
  }

  async getTimeSeries(symbol: string): Promise<AlphaVantageTimeSeriesDaily | null> {
    if (!this.apiKey) return null;

    const key = `timeseries:${symbol}`;
    const cached = this.getCached<AlphaVantageTimeSeriesDaily>(key);
    if (cached) return cached;

    try {
      const url = `${ALPHA_VANTAGE_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${this.apiKey}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data = await response.json() as AlphaVantageTimeSeriesDaily;

      if (!data['Time Series (Daily)']) {
        return null;
      }

      this.setCache(key, data);
      return data;
    } catch {
      return this.getStaleCached<AlphaVantageTimeSeriesDaily>(key);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

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
      expiresAt: Date.now() + ALPHA_VANTAGE_CACHE_TTL_MS,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET MONITOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * MarketMonitor - Multi-asset price monitoring with smart thresholds.
 *
 * Features:
 * - Per-asset-class thresholds (crypto more volatile than stocks)
 * - Watchlist management with persistent tracking
 * - Alert generation on threshold breach
 * - Historical snapshot storage for trend analysis
 */
export class MarketMonitor {
  private readonly eventBus: EventBus;
  private readonly cryptoClient: CoinGeckoClient;
  private readonly pokemonClient: PokemonTcgClient;
  private readonly stockClient: AlphaVantageClient;
  private readonly config: MarketMonitorConfig;
  private readonly watchlist: Map<string, WatchlistEntry> = new Map();
  private readonly snapshots: Map<string, PriceSnapshot[]> = new Map();
  private readonly allTimeHighs: Map<string, number> = new Map();
  private readonly allTimeLows: Map<string, number> = new Map();

  constructor(eventBus: EventBus, config?: Partial<MarketMonitorConfig>) {
    this.eventBus = eventBus;

    this.config = {
      cryptoApiKey: config?.cryptoApiKey,
      pokemonApiKey: config?.pokemonApiKey,
      alphaVantageApiKey: config?.alphaVantageApiKey,
      thresholds: config?.thresholds ?? DEFAULT_THRESHOLDS,
      cacheEnabled: config?.cacheEnabled ?? true,
      cacheTtlMs: config?.cacheTtlMs ?? 5 * 60 * 1000,
    };

    this.cryptoClient = new CoinGeckoClient(this.config.cryptoApiKey);
    this.pokemonClient = new PokemonTcgClient(this.config.pokemonApiKey);
    this.stockClient = new AlphaVantageClient(this.config.alphaVantageApiKey);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Check prices for all assets in the watchlist.
   * Returns snapshots for each asset with price data.
   */
  async checkPrices(): Promise<PriceSnapshot[]> {
    const snapshots: PriceSnapshot[] = [];
    const watchlistEntries = Array.from(this.watchlist.values());

    // Group assets by class for efficient API calls
    const assetsByClass = this.groupAssetsByClass(watchlistEntries);

    // Fetch crypto prices (batch)
    const cryptoAssets = assetsByClass.get('crypto') ?? [];
    if (cryptoAssets.length > 0) {
      const cryptoSnapshots = await this.fetchCryptoPrices(cryptoAssets);
      snapshots.push(...cryptoSnapshots);
    }

    // Fetch stock prices (individual due to API limits)
    const stockAssets = assetsByClass.get('stock') ?? [];
    for (const entry of stockAssets) {
      const snapshot = await this.fetchStockPrice(entry);
      if (snapshot) snapshots.push(snapshot);
    }

    // Fetch ETF prices (same as stocks)
    const etfAssets = assetsByClass.get('etf') ?? [];
    for (const entry of etfAssets) {
      const snapshot = await this.fetchStockPrice(entry);
      if (snapshot) snapshots.push(snapshot);
    }

    // Fetch Pokemon card prices
    const pokemonAssets = assetsByClass.get('pokemon') ?? [];
    for (const entry of pokemonAssets) {
      const snapshot = await this.fetchPokemonPrice(entry);
      if (snapshot) snapshots.push(snapshot);
    }

    // Store snapshots and update watchlist
    for (const snapshot of snapshots) {
      this.storeSnapshot(snapshot);
      this.updateWatchlistEntry(snapshot);
      this.updateAllTimeExtremes(snapshot);
    }

    // Emit completion event
    this.eventBus.emit('market:snapshot_complete', {
      timestamp: new Date().toISOString(),
      pricesChecked: snapshots.length,
      alertsGenerated: 0, // Will be set by checkAlerts
    });

    return snapshots;
  }

  /**
   * Check for threshold breaches and generate alerts.
   */
  async checkAlerts(): Promise<MarketAlert[]> {
    const alerts: MarketAlert[] = [];
    const snapshots = await this.checkPrices();

    for (const snapshot of snapshots) {
      const assetAlerts = this.evaluateThresholds(snapshot);
      alerts.push(...assetAlerts);
    }

    // Emit alerts
    for (const alert of alerts) {
      this.eventBus.emit('market:price_alert', {
        symbol: alert.asset,
        price: alert.data.currentPrice,
        change: alert.data.changePercent,
        threshold: alert.data.threshold,
      });
    }

    return alerts;
  }

  /**
   * Add an asset to the watchlist.
   */
  addToWatchlist(asset: string, assetClass: string): void {
    const normalizedAsset = asset.toLowerCase();
    const validatedClass = AssetClassSchema.parse(assetClass);

    if (this.watchlist.has(normalizedAsset)) {
      return; // Already in watchlist
    }

    this.watchlist.set(normalizedAsset, {
      asset: normalizedAsset,
      assetClass: validatedClass,
      addedAt: new Date().toISOString(),
    });
  }

  /**
   * Remove an asset from the watchlist.
   */
  removeFromWatchlist(asset: string): void {
    const normalizedAsset = asset.toLowerCase();
    this.watchlist.delete(normalizedAsset);
    this.snapshots.delete(normalizedAsset);
    this.allTimeHighs.delete(normalizedAsset);
    this.allTimeLows.delete(normalizedAsset);
  }

  /**
   * Get the current watchlist.
   */
  getWatchlist(): string[] {
    return Array.from(this.watchlist.keys());
  }

  /**
   * Get the last snapshot for an asset.
   */
  getLastSnapshot(asset: string): PriceSnapshot | undefined {
    const normalizedAsset = asset.toLowerCase();
    const assetSnapshots = this.snapshots.get(normalizedAsset);
    if (!assetSnapshots || assetSnapshots.length === 0) return undefined;
    return assetSnapshots[assetSnapshots.length - 1];
  }

  /**
   * Get all snapshots for an asset.
   */
  getSnapshots(asset: string): PriceSnapshot[] {
    const normalizedAsset = asset.toLowerCase();
    return this.snapshots.get(normalizedAsset) ?? [];
  }

  /**
   * Get the thresholds for an asset class.
   */
  getThresholds(assetClass: AssetClass): AssetThresholds {
    return this.config.thresholds[assetClass];
  }

  /**
   * Update thresholds for an asset class.
   */
  setThresholds(assetClass: AssetClass, thresholds: AssetThresholds): void {
    this.config.thresholds[assetClass] = thresholds;
  }

  /**
   * Get watchlist entry details.
   */
  getWatchlistEntry(asset: string): WatchlistEntry | undefined {
    return this.watchlist.get(asset.toLowerCase());
  }

  /**
   * Get current price for a single asset.
   * Satisfies PortfolioTracker's MarketMonitor interface.
   */
  async getPrice(asset: string, assetClass: AssetClass): Promise<number | null> {
    const normalized = asset.toLowerCase();

    // Check cached snapshot first
    const lastSnap = this.getLastSnapshot(normalized);
    if (lastSnap && (Date.now() - new Date(lastSnap.timestamp).getTime()) < this.config.cacheTtlMs) {
      return lastSnap.price;
    }

    // Fetch fresh price
    const entry: WatchlistEntry = {
      asset: normalized,
      assetClass,
      addedAt: new Date().toISOString(),
    };

    let snapshot: PriceSnapshot | null = null;
    switch (assetClass) {
      case 'crypto':
        snapshot = (await this.fetchCryptoPrices([entry]))[0] ?? null;
        break;
      case 'stock':
      case 'etf':
        snapshot = await this.fetchStockPrice(entry);
        break;
      case 'pokemon':
        snapshot = await this.fetchPokemonPrice(entry);
        break;
      default:
        return null;
    }

    if (snapshot) {
      this.storeSnapshot(snapshot);
      return snapshot.price;
    }
    return null;
  }

  /**
   * Get prices for multiple assets.
   * Satisfies PortfolioTracker's MarketMonitor interface.
   */
  async getPrices(assets: Array<{ asset: string; assetClass: AssetClass }>): Promise<Map<string, number | null>> {
    const results = new Map<string, number | null>();
    for (const { asset, assetClass } of assets) {
      const price = await this.getPrice(asset, assetClass);
      results.set(asset, price);
    }
    return results;
  }

  /**
   * Get 24h price change for an asset as decimal (e.g., 0.05 = 5%).
   * Satisfies PortfolioTracker's MarketMonitor interface.
   */
  async get24hChange(asset: string, assetClass: AssetClass): Promise<number | null> {
    const normalized = asset.toLowerCase();
    const lastSnap = this.getLastSnapshot(normalized);
    if (lastSnap) {
      return lastSnap.change24h / 100; // Convert percentage to decimal
    }

    // Fetch fresh data to get change
    const price = await this.getPrice(asset, assetClass);
    if (price !== null) {
      const snap = this.getLastSnapshot(normalized);
      if (snap) return snap.change24h / 100;
    }
    return null;
  }

  /**
   * Clear all caches.
   */
  clearCaches(): void {
    this.cryptoClient.clearCache();
    this.pokemonClient.clearCache();
    this.stockClient.clearCache();
  }

  // ── Private Methods ──────────────────────────────────────────────────────────

  private groupAssetsByClass(entries: WatchlistEntry[]): Map<AssetClass, WatchlistEntry[]> {
    const grouped = new Map<AssetClass, WatchlistEntry[]>();

    for (const entry of entries) {
      const existing = grouped.get(entry.assetClass) ?? [];
      existing.push(entry);
      grouped.set(entry.assetClass, existing);
    }

    return grouped;
  }

  private async fetchCryptoPrices(entries: WatchlistEntry[]): Promise<PriceSnapshot[]> {
    const snapshots: PriceSnapshot[] = [];
    const coinIds = entries.map(e => e.asset);

    try {
      const prices = await this.cryptoClient.getPrice(coinIds);
      const marketData = await this.cryptoClient.getMarketData(coinIds);

      for (const entry of entries) {
        const priceData = prices[entry.asset] as CoinGeckoPrice[string] | undefined;
        const market = marketData.find(m => m.id === entry.asset);

        if (!priceData) continue;

        // Calculate 7d and 30d change from historical snapshots
        const historicalSnapshots = this.snapshots.get(entry.asset) ?? [];
        const change7d = this.calculateHistoricalChange(historicalSnapshots, 7, priceData.usd);
        const change30d = this.calculateHistoricalChange(historicalSnapshots, 30, priceData.usd);

        snapshots.push({
          asset: entry.asset,
          assetClass: 'crypto',
          price: priceData.usd,
          change24h: priceData.usd_24h_change ?? 0,
          change7d,
          change30d,
          volume24h: priceData.usd_24h_vol,
          marketCap: market?.market_cap,
          timestamp: new Date().toISOString(),
          source: 'coingecko',
        });
      }
    } catch {
      // Return empty array on API failure
    }

    return snapshots;
  }

  private async fetchStockPrice(entry: WatchlistEntry): Promise<PriceSnapshot | null> {
    const quote = await this.stockClient.getQuote(entry.asset.toUpperCase());
    if (!quote) return null;

    const globalQuote = quote['Global Quote'];
    const currentPrice = parseFloat(globalQuote['05. price']);
    const previousClose = parseFloat(globalQuote['08. previous close']);
    const change24h = previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0;

    // Get historical data for weekly/monthly changes
    const timeSeries = await this.stockClient.getTimeSeries(entry.asset.toUpperCase());
    const { change7d, change30d } = this.calculateStockHistoricalChanges(timeSeries, currentPrice);

    return {
      asset: entry.asset,
      assetClass: entry.assetClass,
      price: currentPrice,
      change24h,
      change7d,
      change30d,
      volume24h: parseFloat(globalQuote['06. volume']),
      timestamp: new Date().toISOString(),
      source: 'alphavantage',
    };
  }

  private calculateStockHistoricalChanges(
    timeSeries: AlphaVantageTimeSeriesDaily | null,
    currentPrice: number,
  ): { change7d: number; change30d: number } {
    if (!timeSeries) return { change7d: 0, change30d: 0 };

    const dates = Object.keys(timeSeries['Time Series (Daily)']).sort().reverse();
    let change7d = 0;
    let change30d = 0;

    // Find price from ~7 days ago
    if (dates.length >= 5) {
      const price7d = parseFloat(timeSeries['Time Series (Daily)'][dates[4]]['4. close']);
      change7d = price7d > 0 ? ((currentPrice - price7d) / price7d) * 100 : 0;
    }

    // Find price from ~30 days ago
    if (dates.length >= 22) {
      const price30d = parseFloat(timeSeries['Time Series (Daily)'][dates[21]]['4. close']);
      change30d = price30d > 0 ? ((currentPrice - price30d) / price30d) * 100 : 0;
    }

    return { change7d, change30d };
  }

  private async fetchPokemonPrice(entry: WatchlistEntry): Promise<PriceSnapshot | null> {
    try {
      const card = await this.pokemonClient.getCardPrices(entry.asset);
      if (!card?.tcgplayer?.prices) return null;

      // Get the best available price (prefer market, then mid, then low)
      const price = this.extractPokemonPrice(card);
      if (price === 0) return null;

      // Calculate changes from historical snapshots
      const historicalSnapshots = this.snapshots.get(entry.asset) ?? [];
      const change7d = this.calculateHistoricalChange(historicalSnapshots, 7, price);
      const change30d = this.calculateHistoricalChange(historicalSnapshots, 30, price);

      return {
        asset: entry.asset,
        assetClass: 'pokemon',
        price,
        change24h: 0, // Pokemon prices don't change daily
        change7d,
        change30d,
        timestamp: new Date().toISOString(),
        source: 'tcgplayer',
      };
    } catch {
      return null;
    }
  }

  private extractPokemonPrice(card: PokemonCard): number {
    const tcgPrices = card.tcgplayer?.prices;
    if (!tcgPrices) return 0;

    // Try different price tiers in order of preference
    const priceTypes = ['holofoil', 'reverseHolofoil', 'normal', 'unlimited', '1stEdition'];

    for (const type of priceTypes) {
      const prices = tcgPrices[type];
      if (prices) {
        const price = prices.market ?? prices.mid ?? prices.low;
        if (price !== null && price !== undefined && price > 0) {
          return price;
        }
      }
    }

    return 0;
  }

  private calculateHistoricalChange(
    snapshots: PriceSnapshot[],
    daysAgo: number,
    currentPrice: number,
  ): number {
    if (snapshots.length === 0) return 0;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysAgo);

    // Find closest snapshot to target date
    let closestSnapshot: PriceSnapshot | null = null;
    let closestDiff = Infinity;

    for (const snapshot of snapshots) {
      const snapshotDate = new Date(snapshot.timestamp);
      const diff = Math.abs(snapshotDate.getTime() - targetDate.getTime());
      if (diff < closestDiff) {
        closestDiff = diff;
        closestSnapshot = snapshot;
      }
    }

    if (!closestSnapshot || closestSnapshot.price === 0) return 0;

    // Only use snapshot if it's within 2 days of target
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    if (closestDiff > twoDaysMs) return 0;

    return ((currentPrice - closestSnapshot.price) / closestSnapshot.price) * 100;
  }

  private storeSnapshot(snapshot: PriceSnapshot): void {
    const existing = this.snapshots.get(snapshot.asset) ?? [];
    existing.push(snapshot);

    // Keep only last 90 days of snapshots (assuming daily checks)
    const maxSnapshots = 90;
    if (existing.length > maxSnapshots) {
      existing.splice(0, existing.length - maxSnapshots);
    }

    this.snapshots.set(snapshot.asset, existing);
  }

  private updateWatchlistEntry(snapshot: PriceSnapshot): void {
    const entry = this.watchlist.get(snapshot.asset);
    if (entry) {
      entry.lastPrice = snapshot.price;
      entry.lastChecked = snapshot.timestamp;
    }
  }

  private updateAllTimeExtremes(snapshot: PriceSnapshot): void {
    const currentHigh = this.allTimeHighs.get(snapshot.asset);
    const currentLow = this.allTimeLows.get(snapshot.asset);

    if (!currentHigh || snapshot.price > currentHigh) {
      this.allTimeHighs.set(snapshot.asset, snapshot.price);
    }

    if (!currentLow || snapshot.price < currentLow) {
      this.allTimeLows.set(snapshot.asset, snapshot.price);
    }
  }

  private evaluateThresholds(snapshot: PriceSnapshot): MarketAlert[] {
    const alerts: MarketAlert[] = [];
    const thresholds = this.config.thresholds[snapshot.assetClass];
    const previousSnapshot = this.getPreviousSnapshot(snapshot.asset);

    // Check daily threshold
    if (thresholds.daily > 0 && Math.abs(snapshot.change24h) >= thresholds.daily) {
      const alertType: AlertType = snapshot.change24h > 0 ? 'price_spike' : 'price_drop';
      const severity = this.calculateSeverity(Math.abs(snapshot.change24h), thresholds.daily);

      alerts.push({
        asset: snapshot.asset,
        alertType,
        severity,
        message: `${snapshot.asset.toUpperCase()} ${alertType === 'price_spike' ? 'up' : 'down'} ${Math.abs(snapshot.change24h).toFixed(2)}% in 24h`,
        data: {
          currentPrice: snapshot.price,
          previousPrice: previousSnapshot?.price ?? snapshot.price,
          changePercent: snapshot.change24h,
          threshold: thresholds.daily,
        },
      });
    }

    // Check weekly threshold
    if (thresholds.weekly > 0 && Math.abs(snapshot.change7d) >= thresholds.weekly) {
      const alertType: AlertType = snapshot.change7d > 0 ? 'price_spike' : 'price_drop';
      const severity = this.calculateSeverity(Math.abs(snapshot.change7d), thresholds.weekly);

      alerts.push({
        asset: snapshot.asset,
        alertType,
        severity,
        message: `${snapshot.asset.toUpperCase()} ${alertType === 'price_spike' ? 'up' : 'down'} ${Math.abs(snapshot.change7d).toFixed(2)}% in 7d`,
        data: {
          currentPrice: snapshot.price,
          previousPrice: previousSnapshot?.price ?? snapshot.price,
          changePercent: snapshot.change7d,
          threshold: thresholds.weekly,
        },
      });
    }

    // Check monthly threshold (if defined)
    if (thresholds.monthly && thresholds.monthly > 0 && Math.abs(snapshot.change30d) >= thresholds.monthly) {
      const alertType: AlertType = snapshot.change30d > 0 ? 'price_spike' : 'price_drop';
      const severity = this.calculateSeverity(Math.abs(snapshot.change30d), thresholds.monthly);

      alerts.push({
        asset: snapshot.asset,
        alertType,
        severity,
        message: `${snapshot.asset.toUpperCase()} ${alertType === 'price_spike' ? 'up' : 'down'} ${Math.abs(snapshot.change30d).toFixed(2)}% in 30d`,
        data: {
          currentPrice: snapshot.price,
          previousPrice: previousSnapshot?.price ?? snapshot.price,
          changePercent: snapshot.change30d,
          threshold: thresholds.monthly,
        },
      });
    }

    // Check for new all-time high
    const previousHigh = this.allTimeHighs.get(snapshot.asset);
    if (previousHigh && snapshot.price > previousHigh) {
      alerts.push({
        asset: snapshot.asset,
        alertType: 'new_high',
        severity: 'notable',
        message: `${snapshot.asset.toUpperCase()} reached new all-time high: $${snapshot.price.toFixed(2)}`,
        data: {
          currentPrice: snapshot.price,
          previousPrice: previousHigh,
          changePercent: ((snapshot.price - previousHigh) / previousHigh) * 100,
          threshold: 0,
        },
      });
    }

    // Check for new all-time low
    const previousLow = this.allTimeLows.get(snapshot.asset);
    if (previousLow && snapshot.price < previousLow) {
      alerts.push({
        asset: snapshot.asset,
        alertType: 'new_low',
        severity: 'significant',
        message: `${snapshot.asset.toUpperCase()} reached new all-time low: $${snapshot.price.toFixed(2)}`,
        data: {
          currentPrice: snapshot.price,
          previousPrice: previousLow,
          changePercent: ((snapshot.price - previousLow) / previousLow) * 100,
          threshold: 0,
        },
      });
    }

    // Check for volume anomaly (crypto only, 3x average volume)
    if (snapshot.assetClass === 'crypto' && snapshot.volume24h) {
      const avgVolume = this.calculateAverageVolume(snapshot.asset);
      if (avgVolume > 0 && snapshot.volume24h > avgVolume * 3) {
        alerts.push({
          asset: snapshot.asset,
          alertType: 'volume_anomaly',
          severity: 'notable',
          message: `${snapshot.asset.toUpperCase()} volume ${(snapshot.volume24h / avgVolume).toFixed(1)}x above average`,
          data: {
            currentPrice: snapshot.price,
            previousPrice: previousSnapshot?.price ?? snapshot.price,
            changePercent: ((snapshot.volume24h - avgVolume) / avgVolume) * 100,
            threshold: 300, // 3x = 300%
          },
        });
      }
    }

    return alerts;
  }

  private calculateSeverity(change: number, threshold: number): AlertSeverity {
    const ratio = change / threshold;

    if (ratio >= 3) return 'critical';
    if (ratio >= 2) return 'significant';
    if (ratio >= 1.5) return 'notable';
    return 'info';
  }

  private getPreviousSnapshot(asset: string): PriceSnapshot | undefined {
    const assetSnapshots = this.snapshots.get(asset);
    if (!assetSnapshots || assetSnapshots.length < 2) return undefined;
    return assetSnapshots[assetSnapshots.length - 2];
  }

  private calculateAverageVolume(asset: string): number {
    const assetSnapshots = this.snapshots.get(asset);
    if (!assetSnapshots || assetSnapshots.length === 0) return 0;

    const volumes = assetSnapshots
      .filter(s => s.volume24h !== undefined)
      .map(s => s.volume24h!);

    if (volumes.length === 0) return 0;

    return volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
  }
}
