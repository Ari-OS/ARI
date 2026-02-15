import type { EventBus } from '../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET MONITOR
// Multi-asset price tracking with smart alerting
// ═══════════════════════════════════════════════════════════════════════════════

export type AssetClass = 'crypto' | 'stock' | 'pokemon' | 'etf';
export type Timeframe = '1d' | '7d' | '30d' | '90d';

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
  alertType: 'price_spike' | 'price_drop' | 'volume_anomaly' | 'trend_reversal' | 'new_high' | 'new_low';
  severity: 'info' | 'notable' | 'significant' | 'critical';
  message: string;
  data: {
    currentPrice: number;
    previousPrice: number;
    changePercent: number;
    threshold: number;
  };
}

export interface AlertThresholds {
  crypto: { daily: number; weekly: number };
  stocks: { daily: number; weekly: number };
  pokemon: { weekly: number; monthly: number };
  etfs: { daily: number; weekly: number };
}

export interface MarketOverview {
  snapshots: PriceSnapshot[];
  alerts: MarketAlert[];
  timestamp: string;
}

interface WatchedAsset {
  asset: string;
  assetClass: AssetClass;
}

interface AlertCooldown {
  asset: string;
  lastAlertAt: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  crypto: { daily: 3, weekly: 10 },
  stocks: { daily: 2, weekly: 5 },
  pokemon: { weekly: 10, monthly: 20 },
  etfs: { daily: 1.5, weekly: 3 },
};

const DEFAULT_WATCHED_ASSETS: WatchedAsset[] = [
  { asset: 'bitcoin', assetClass: 'crypto' },
  { asset: 'ethereum', assetClass: 'crypto' },
  { asset: 'solana', assetClass: 'crypto' },
  { asset: 'SPY', assetClass: 'etf' },
  { asset: 'QQQ', assetClass: 'etf' },
  { asset: 'NVDA', assetClass: 'stock' },
  { asset: 'AAPL', assetClass: 'stock' },
];

export class MarketMonitor {
  private watchedAssets: WatchedAsset[] = [];
  private priceHistory: Map<string, PriceSnapshot[]> = new Map();
  private alertCooldowns: Map<string, AlertCooldown> = new Map();
  private readonly thresholds: AlertThresholds;
  private readonly alertCooldownMs: number;
  private readonly eventBus: EventBus;
  private readonly alphaVantageApiKey?: string;

  constructor(
    eventBus: EventBus,
    options?: {
      thresholds?: Partial<AlertThresholds>;
      alertCooldownMs?: number;
      alphaVantageApiKey?: string;
    }
  ) {
    this.eventBus = eventBus;
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...options?.thresholds,
    };
    this.alertCooldownMs = options?.alertCooldownMs ?? 4 * 60 * 60 * 1000; // 4 hours
    this.alphaVantageApiKey = options?.alphaVantageApiKey ?? process.env.ALPHA_VANTAGE_API_KEY;

    // Initialize with default watched assets
    this.watchedAssets = [...DEFAULT_WATCHED_ASSETS];
  }

  /**
   * Check prices for all configured assets
   */
  async checkPrices(): Promise<PriceSnapshot[]> {
    const snapshots: PriceSnapshot[] = [];

    // Group assets by class for batch fetching
    const cryptoAssets = this.watchedAssets.filter(a => a.assetClass === 'crypto');
    const stockAssets = this.watchedAssets.filter(a => a.assetClass === 'stock');
    const etfAssets = this.watchedAssets.filter(a => a.assetClass === 'etf');
    const pokemonAssets = this.watchedAssets.filter(a => a.assetClass === 'pokemon');

    // Fetch crypto prices
    if (cryptoAssets.length > 0) {
      const cryptoSnapshots = await this.fetchCryptoPrices(cryptoAssets);
      snapshots.push(...cryptoSnapshots);
    }

    // Fetch stock prices
    if (stockAssets.length > 0) {
      const stockSnapshots = await this.fetchStockPrices(stockAssets);
      snapshots.push(...stockSnapshots);
    }

    // Fetch ETF prices
    if (etfAssets.length > 0) {
      const etfSnapshots = await this.fetchStockPrices(etfAssets);
      snapshots.push(...etfSnapshots);
    }

    // Pokemon prices are manual entries only
    for (const asset of pokemonAssets) {
      const history = this.priceHistory.get(asset.asset);
      if (history && history.length > 0) {
        snapshots.push(history[history.length - 1]);
      }
    }

    // Store in history
    for (const snapshot of snapshots) {
      this.addToHistory(snapshot);
    }

    // Emit snapshot event
    this.eventBus.emit('market:snapshot_complete', {
      snapshots: snapshots.length,
      timestamp: new Date().toISOString(),
    });

    return snapshots;
  }

  /**
   * Get full market overview with alerts
   */
  async getMarketOverview(): Promise<MarketOverview> {
    const snapshots = await this.checkPrices();
    const previousSnapshots = this.getPreviousSnapshots();
    const alerts = this.detectAlerts(snapshots, previousSnapshots);

    return {
      snapshots,
      alerts,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detect alerts based on thresholds
   */
  detectAlerts(current: PriceSnapshot[], previous: PriceSnapshot[]): MarketAlert[] {
    const alerts: MarketAlert[] = [];

    for (const snapshot of current) {
      const prevSnapshot = previous.find(p => p.asset === snapshot.asset);
      if (!prevSnapshot) continue;

      // Check cooldown
      if (this.isOnCooldown(snapshot.asset)) continue;

      const changePercent = ((snapshot.price - prevSnapshot.price) / prevSnapshot.price) * 100;
      const thresholds = this.getThresholdsForAsset(snapshot.assetClass);

      // Daily threshold check
      if (Math.abs(changePercent) >= thresholds.daily) {
        const alert = this.createAlert(snapshot, prevSnapshot, changePercent, thresholds.daily);
        if (alert) {
          alerts.push(alert);
          this.setCooldown(snapshot.asset);
        }
      }

      // Weekly threshold check (using 7d change)
      if (Math.abs(snapshot.change7d) >= thresholds.weekly) {
        const weeklyAlert = this.createWeeklyAlert(snapshot, thresholds.weekly);
        if (weeklyAlert) {
          alerts.push(weeklyAlert);
        }
      }

      // Detect new highs/lows
      const highLowAlert = this.detectHighLow(snapshot);
      if (highLowAlert) {
        alerts.push(highLowAlert);
      }
    }

    // Emit alert events
    for (const alert of alerts) {
      this.eventBus.emit('market:price_alert', alert);
    }

    return alerts;
  }

  /**
   * Get price history for an asset
   */
  getPriceHistory(asset: string): PriceSnapshot[] {
    return this.priceHistory.get(asset) ?? [];
  }

  /**
   * Add a new asset to watch
   */
  addWatchedAsset(asset: string, assetClass: AssetClass): void {
    if (!this.watchedAssets.find(a => a.asset === asset)) {
      this.watchedAssets.push({ asset, assetClass });
    }
  }

  /**
   * Get configured assets
   */
  getWatchedAssets(): Array<{ asset: string; assetClass: AssetClass }> {
    return [...this.watchedAssets];
  }

  // ── Private Methods ────────────────────────────────────────────────

  private async fetchCryptoPrices(assets: WatchedAsset[]): Promise<PriceSnapshot[]> {
    const coinIds = assets.map(a => a.asset).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);

      const data = (await response.json()) as Record<string, {
        usd: number;
        usd_24h_change?: number;
        usd_market_cap?: number;
        usd_24h_vol?: number;
      }>;

      const snapshots: PriceSnapshot[] = [];
      const timestamp = new Date().toISOString();

      for (const asset of assets) {
        const priceData = data[asset.asset];
        if (!priceData) continue;

        const change7d = this.calculateChange(asset.asset, 7);
        const change30d = this.calculateChange(asset.asset, 30);

        snapshots.push({
          asset: asset.asset,
          assetClass: asset.assetClass,
          price: priceData.usd,
          change24h: priceData.usd_24h_change ?? 0,
          change7d,
          change30d,
          volume24h: priceData.usd_24h_vol,
          marketCap: priceData.usd_market_cap,
          timestamp,
          source: 'coingecko',
        });
      }

      return snapshots;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.eventBus.emit('system:error', {
        error: new Error(`Failed to fetch crypto prices: ${errMsg}`),
        context: 'market-monitor:fetchCryptoPrices',
      });
      return [];
    }
  }

  private async fetchStockPrices(assets: WatchedAsset[]): Promise<PriceSnapshot[]> {
    if (!this.alphaVantageApiKey) {
      return [];
    }

    const snapshots: PriceSnapshot[] = [];
    const timestamp = new Date().toISOString();

    // Alpha Vantage free tier: 5 calls/min, so fetch sequentially with delay
    for (const asset of assets) {
      try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${asset.asset}&apikey=${this.alphaVantageApiKey}`;
        const response = await fetch(url);
        if (!response.ok) continue;

        const data = (await response.json()) as {
          'Global Quote': {
            '05. price': string;
            '09. change': string;
            '10. change percent': string;
            '06. volume': string;
          };
        };

        const quote = data['Global Quote'];
        if (!quote) continue;

        const price = parseFloat(quote['05. price']);
        const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
        const volume = parseFloat(quote['06. volume']);

        const change7d = this.calculateChange(asset.asset, 7);
        const change30d = this.calculateChange(asset.asset, 30);

        snapshots.push({
          asset: asset.asset,
          assetClass: asset.assetClass,
          price,
          change24h: changePercent,
          change7d,
          change30d,
          volume24h: volume,
          timestamp,
          source: 'alphavantage',
        });

        // Rate limit: 5 calls/min = 1 call every 12 seconds
        if (assets.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 13000));
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.eventBus.emit('system:error', {
          error: new Error(`Failed to fetch stock price for ${asset.asset}: ${errMsg}`),
          context: 'market-monitor:fetchStockPrices',
        });
      }
    }

    return snapshots;
  }

  private addToHistory(snapshot: PriceSnapshot): void {
    const history = this.priceHistory.get(snapshot.asset) ?? [];
    history.push(snapshot);

    // Keep last 100 snapshots
    if (history.length > 100) {
      history.shift();
    }

    this.priceHistory.set(snapshot.asset, history);
  }

  private getPreviousSnapshots(): PriceSnapshot[] {
    const snapshots: PriceSnapshot[] = [];

    for (const history of this.priceHistory.values()) {
      if (history.length >= 2) {
        // Get second-to-last snapshot
        snapshots.push(history[history.length - 2]);
      }
    }

    return snapshots;
  }

  private calculateChange(asset: string, daysAgo: number): number {
    const history = this.priceHistory.get(asset);
    if (!history || history.length < 2) return 0;

    const current = history[history.length - 1];
    const targetIndex = Math.max(0, history.length - daysAgo - 1);
    const previous = history[targetIndex];

    if (!previous) return 0;

    return ((current.price - previous.price) / previous.price) * 100;
  }

  private getThresholdsForAsset(assetClass: AssetClass): { daily: number; weekly: number } {
    switch (assetClass) {
      case 'crypto':
        return this.thresholds.crypto;
      case 'stock':
        return this.thresholds.stocks;
      case 'pokemon':
        return { daily: this.thresholds.pokemon.weekly, weekly: this.thresholds.pokemon.monthly };
      case 'etf':
        return this.thresholds.etfs;
    }
  }

  private createAlert(
    current: PriceSnapshot,
    previous: PriceSnapshot,
    changePercent: number,
    threshold: number
  ): MarketAlert | null {
    const isSpike = changePercent > 0;
    const severity = this.calculateSeverity(Math.abs(changePercent), threshold);

    return {
      asset: current.asset,
      alertType: isSpike ? 'price_spike' : 'price_drop',
      severity,
      message: `${current.asset} ${isSpike ? 'up' : 'down'} ${Math.abs(changePercent).toFixed(1)}% to $${current.price.toLocaleString()}`,
      data: {
        currentPrice: current.price,
        previousPrice: previous.price,
        changePercent,
        threshold,
      },
    };
  }

  private createWeeklyAlert(snapshot: PriceSnapshot, threshold: number): MarketAlert | null {
    if (Math.abs(snapshot.change7d) < threshold) return null;

    const severity = this.calculateSeverity(Math.abs(snapshot.change7d), threshold);
    const isUp = snapshot.change7d > 0;

    return {
      asset: snapshot.asset,
      alertType: 'trend_reversal',
      severity,
      message: `${snapshot.asset} ${isUp ? 'up' : 'down'} ${Math.abs(snapshot.change7d).toFixed(1)}% over 7 days`,
      data: {
        currentPrice: snapshot.price,
        previousPrice: snapshot.price / (1 + snapshot.change7d / 100),
        changePercent: snapshot.change7d,
        threshold,
      },
    };
  }

  private detectHighLow(snapshot: PriceSnapshot): MarketAlert | null {
    const history = this.priceHistory.get(snapshot.asset);
    if (!history || history.length < 30) return null;

    const prices = history.map(s => s.price);
    const max = Math.max(...prices);
    const min = Math.min(...prices);

    if (snapshot.price === max && snapshot.price > history[history.length - 2].price) {
      return {
        asset: snapshot.asset,
        alertType: 'new_high',
        severity: 'notable',
        message: `${snapshot.asset} hit new high: $${snapshot.price.toLocaleString()}`,
        data: {
          currentPrice: snapshot.price,
          previousPrice: history[history.length - 2].price,
          changePercent: ((snapshot.price - history[history.length - 2].price) / history[history.length - 2].price) * 100,
          threshold: 0,
        },
      };
    }

    if (snapshot.price === min && snapshot.price < history[history.length - 2].price) {
      return {
        asset: snapshot.asset,
        alertType: 'new_low',
        severity: 'significant',
        message: `${snapshot.asset} hit new low: $${snapshot.price.toLocaleString()}`,
        data: {
          currentPrice: snapshot.price,
          previousPrice: history[history.length - 2].price,
          changePercent: ((snapshot.price - history[history.length - 2].price) / history[history.length - 2].price) * 100,
          threshold: 0,
        },
      };
    }

    return null;
  }

  private calculateSeverity(changePercent: number, threshold: number): 'info' | 'notable' | 'significant' | 'critical' {
    const ratio = changePercent / threshold;

    if (ratio >= 3) return 'critical';
    if (ratio >= 2) return 'significant';
    if (ratio >= 1.5) return 'notable';
    return 'info';
  }

  private isOnCooldown(asset: string): boolean {
    const cooldown = this.alertCooldowns.get(asset);
    if (!cooldown) return false;

    const now = Date.now();
    return now - cooldown.lastAlertAt < this.alertCooldownMs;
  }

  private setCooldown(asset: string): void {
    this.alertCooldowns.set(asset, {
      asset,
      lastAlertAt: Date.now(),
    });
  }
}
