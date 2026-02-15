import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MarketMonitor } from '../../../src/autonomous/market-monitor.js';
import type { EventBus } from '../../../src/kernel/event-bus.js';
import type { PriceSnapshot } from '../../../src/autonomous/market-monitor.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('MarketMonitor', () => {
  let monitor: MarketMonitor;
  let mockEventBus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock EventBus
    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      clear: vi.fn(),
      listenerCount: vi.fn(),
      getHandlerErrorCount: vi.fn(),
      setHandlerTimeout: vi.fn(),
    } as unknown as EventBus;

    monitor = new MarketMonitor(mockEventBus);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('constructor', () => {
    it('should create with default thresholds', () => {
      const mon = new MarketMonitor(mockEventBus);
      expect(mon).toBeDefined();
    });

    it('should accept custom thresholds', () => {
      const mon = new MarketMonitor(mockEventBus, {
        thresholds: {
          crypto: { daily: 5, weekly: 15 },
        },
      });
      expect(mon).toBeDefined();
    });

    it('should accept custom cooldown time', () => {
      const mon = new MarketMonitor(mockEventBus, {
        alertCooldownMs: 1000,
      });
      expect(mon).toBeDefined();
    });

    it('should accept API key via options', () => {
      const mon = new MarketMonitor(mockEventBus, {
        alphaVantageApiKey: 'test-key',
      });
      expect(mon).toBeDefined();
    });
  });

  describe('getWatchedAssets()', () => {
    it('should return default watched assets', () => {
      const assets = monitor.getWatchedAssets();
      expect(assets).toHaveLength(7); // BTC, ETH, SOL, SPY, QQQ, NVDA, AAPL
      expect(assets).toContainEqual({ asset: 'bitcoin', assetClass: 'crypto' });
      expect(assets).toContainEqual({ asset: 'SPY', assetClass: 'etf' });
    });

    it('should not mutate internal array', () => {
      const assets1 = monitor.getWatchedAssets();
      assets1.push({ asset: 'test', assetClass: 'crypto' });

      const assets2 = monitor.getWatchedAssets();
      expect(assets2).toHaveLength(7);
    });
  });

  describe('addWatchedAsset()', () => {
    it('should add new asset to watch list', () => {
      monitor.addWatchedAsset('cardano', 'crypto');
      const assets = monitor.getWatchedAssets();
      expect(assets).toContainEqual({ asset: 'cardano', assetClass: 'crypto' });
    });

    it('should not add duplicate asset', () => {
      monitor.addWatchedAsset('bitcoin', 'crypto');
      const assets = monitor.getWatchedAssets();
      const bitcoinCount = assets.filter(a => a.asset === 'bitcoin').length;
      expect(bitcoinCount).toBe(1);
    });

    it('should add multiple different assets', () => {
      monitor.addWatchedAsset('cardano', 'crypto');
      monitor.addWatchedAsset('TSLA', 'stock');
      const assets = monitor.getWatchedAssets();
      expect(assets).toContainEqual({ asset: 'cardano', assetClass: 'crypto' });
      expect(assets).toContainEqual({ asset: 'TSLA', assetClass: 'stock' });
    });
  });

  describe('checkPrices()', () => {
    it('should fetch crypto prices from CoinGecko', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bitcoin: { usd: 45000, usd_24h_change: 2.5, usd_market_cap: 900000000000, usd_24h_vol: 30000000000 },
          ethereum: { usd: 2500, usd_24h_change: -1.2, usd_market_cap: 300000000000, usd_24h_vol: 15000000000 },
          solana: { usd: 100, usd_24h_change: 5.0, usd_market_cap: 40000000000, usd_24h_vol: 2000000000 },
        }),
      });

      const snapshots = await monitor.checkPrices();

      expect(snapshots.length).toBeGreaterThan(0);
      const btcSnapshot = snapshots.find(s => s.asset === 'bitcoin');
      expect(btcSnapshot).toBeDefined();
      expect(btcSnapshot?.price).toBe(45000);
      expect(btcSnapshot?.change24h).toBe(2.5);
      expect(btcSnapshot?.source).toBe('coingecko');
    });

    it('should emit snapshot_complete event', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bitcoin: { usd: 45000, usd_24h_change: 2.5 },
        }),
      });

      await monitor.checkPrices();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'market:snapshot_complete',
        expect.objectContaining({
          snapshots: expect.any(Number),
          timestamp: expect.any(String),
        })
      );
    });

    it('should handle CoinGecko API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      const snapshots = await monitor.checkPrices();

      expect(snapshots).toEqual([]);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'system:error',
        expect.objectContaining({
          error: expect.any(Error),
          context: 'market-monitor:fetchCryptoPrices',
        })
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const snapshots = await monitor.checkPrices();

      expect(snapshots).toEqual([]);
      expect(mockEventBus.emit).toHaveBeenCalledWith('system:error', expect.any(Object));
    });

    it('should skip stocks when no API key', async () => {
      // Only crypto in this test (default)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bitcoin: { usd: 45000 },
          ethereum: { usd: 2500 },
          solana: { usd: 100 },
        }),
      });

      const snapshots = await monitor.checkPrices();

      // Should only have crypto snapshots (no stocks/ETFs without API key)
      const stockSnapshots = snapshots.filter(s => s.assetClass === 'stock' || s.assetClass === 'etf');
      expect(stockSnapshots).toEqual([]);
    });
  });

  describe('getPriceHistory()', () => {
    it('should return empty array for unknown asset', () => {
      const history = monitor.getPriceHistory('unknown');
      expect(history).toEqual([]);
    });

    it('should return price history after fetching', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bitcoin: { usd: 45000, usd_24h_change: 2.5 },
        }),
      });

      await monitor.checkPrices();
      const history = monitor.getPriceHistory('bitcoin');

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].asset).toBe('bitcoin');
      expect(history[0].price).toBe(45000);
    });

    it('should accumulate history across multiple fetches', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 45000 } }),
      });
      await monitor.checkPrices();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 46000 } }),
      });
      await monitor.checkPrices();

      const history = monitor.getPriceHistory('bitcoin');
      expect(history).toHaveLength(2);
      expect(history[0].price).toBe(45000);
      expect(history[1].price).toBe(46000);
    });

    it('should limit history to 100 snapshots', async () => {
      // Add 105 snapshots
      for (let i = 0; i < 105; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ bitcoin: { usd: 45000 + i } }),
        });
        await monitor.checkPrices();
      }

      const history = monitor.getPriceHistory('bitcoin');
      expect(history).toHaveLength(100);
      expect(history[0].price).toBe(45005); // First 5 dropped
    });
  });

  describe('detectAlerts()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should detect price spike above threshold', () => {
      const current: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 46500,
        change24h: 3.5,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      const previous: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 45000,
        change24h: 0,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      const alerts = monitor.detectAlerts(current, previous);

      expect(alerts.length).toBeGreaterThan(0);
      const spikeAlert = alerts.find(a => a.alertType === 'price_spike');
      expect(spikeAlert).toBeDefined();
      expect(spikeAlert?.asset).toBe('bitcoin');
    });

    it('should detect price drop below threshold', () => {
      const current: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 43500,
        change24h: -3.5,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      const previous: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 45000,
        change24h: 0,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      const alerts = monitor.detectAlerts(current, previous);

      const dropAlert = alerts.find(a => a.alertType === 'price_drop');
      expect(dropAlert).toBeDefined();
    });

    it('should not alert when change is below threshold', () => {
      const current: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 45500,
        change24h: 1.1,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      const previous: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 45000,
        change24h: 0,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      const alerts = monitor.detectAlerts(current, previous);

      expect(alerts).toEqual([]);
    });

    it('should respect alert cooldown', () => {
      const current: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 46500,
        change24h: 3.5,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      const previous: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 45000,
        change24h: 0,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      // First alert should fire
      const alerts1 = monitor.detectAlerts(current, previous);
      expect(alerts1.length).toBeGreaterThan(0);

      // Second alert within cooldown should not fire
      const alerts2 = monitor.detectAlerts(current, previous);
      expect(alerts2).toEqual([]);

      // After cooldown expires, should fire again
      vi.advanceTimersByTime(4 * 60 * 60 * 1000 + 1000); // 4 hours + 1 second
      const alerts3 = monitor.detectAlerts(current, previous);
      expect(alerts3.length).toBeGreaterThan(0);
    });

    it('should emit market:price_alert events', () => {
      const current: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 46500,
        change24h: 3.5,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      const previous: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 45000,
        change24h: 0,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      monitor.detectAlerts(current, previous);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'market:price_alert',
        expect.objectContaining({
          asset: 'bitcoin',
          alertType: expect.any(String),
        })
      );
    });

    it('should calculate correct severity levels', () => {
      const mon = new MarketMonitor(mockEventBus, {
        thresholds: { crypto: { daily: 2, weekly: 10 } },
      });

      // 6% change (3x threshold) = critical
      const critical: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 47700,
        change24h: 6,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      const base: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 45000,
        change24h: 0,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      const alerts = mon.detectAlerts(critical, base);
      const criticalAlert = alerts.find(a => a.severity === 'critical');
      expect(criticalAlert).toBeDefined();
    });

    it('should handle missing previous snapshot gracefully', () => {
      const current: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 46500,
        change24h: 3.5,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      const alerts = monitor.detectAlerts(current, []);
      expect(alerts).toEqual([]);
    });
  });

  describe('getMarketOverview()', () => {
    it('should return full market overview', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bitcoin: { usd: 45000, usd_24h_change: 2.5 },
        }),
      });

      const overview = await monitor.getMarketOverview();

      expect(overview).toHaveProperty('snapshots');
      expect(overview).toHaveProperty('alerts');
      expect(overview).toHaveProperty('timestamp');
      expect(overview.snapshots.length).toBeGreaterThan(0);
    });

    it('should include alerts in overview', async () => {
      // First fetch to establish baseline
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 45000 } }),
      });
      await monitor.checkPrices();

      // Second fetch with spike
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 46500 } }),
      });

      const overview = await monitor.getMarketOverview();

      expect(overview.alerts.length).toBeGreaterThan(0);
    });
  });

  describe('alert severity calculation', () => {
    it('should assign info severity for 1-1.5x threshold', () => {
      const mon = new MarketMonitor(mockEventBus, {
        thresholds: { crypto: { daily: 3, weekly: 10 } },
      });

      const current: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 46350, // 3% change
        change24h: 3,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      const previous: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 45000,
        change24h: 0,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      }];

      const alerts = mon.detectAlerts(current, previous);
      expect(alerts[0]?.severity).toBe('info');
    });
  });
});
