import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PortfolioTracker, Holding, MarketMonitor, AssetClass } from '../../../src/autonomous/portfolio-tracker.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import fs from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('PortfolioTracker', () => {
  let tracker: PortfolioTracker;
  let eventBus: EventBus;
  let testStoragePath: string;
  let mockMarketMonitor: MarketMonitor;

  beforeEach(async () => {
    // Create unique temp directory for each test
    testStoragePath = path.join(os.tmpdir(), `ari-portfolio-test-${Date.now()}`);

    eventBus = new EventBus();
    tracker = new PortfolioTracker(eventBus, { storagePath: testStoragePath });
    await tracker.init();

    // Create mock market monitor
    mockMarketMonitor = {
      getPrice: vi.fn().mockImplementation(async (asset: string) => {
        const prices: Record<string, number> = {
          'BTC': 50000,
          'ETH': 3000,
          'AAPL': 180,
          'CHARIZARD-BASE-4': 500,
          'VTI': 250,
        };
        return prices[asset] ?? null;
      }),
      getPrices: vi.fn().mockImplementation(async (assets: Array<{ asset: string; assetClass: AssetClass }>) => {
        const prices: Record<string, number> = {
          'BTC': 50000,
          'ETH': 3000,
          'AAPL': 180,
          'CHARIZARD-BASE-4': 500,
          'VTI': 250,
        };
        const result = new Map<string, number | null>();
        for (const { asset } of assets) {
          result.set(asset, prices[asset] ?? null);
        }
        return result;
      }),
      get24hChange: vi.fn().mockResolvedValue(0.05),
    };
  });

  afterEach(async () => {
    // Clean up temp directory
    if (existsSync(testStoragePath)) {
      rmSync(testStoragePath, { recursive: true, force: true });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // INITIALIZATION TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('initialization', () => {
    it('should initialize with empty holdings', async () => {
      const holdings = tracker.getHoldings();
      expect(holdings).toEqual([]);
      expect(tracker.isInitialized()).toBe(true);
    });

    it('should create storage directory if it does not exist', async () => {
      expect(existsSync(testStoragePath)).toBe(true);
    });

    it('should be idempotent on multiple init calls', async () => {
      await tracker.init();
      await tracker.init();
      expect(tracker.isInitialized()).toBe(true);
    });

    it('should load existing holdings on init', async () => {
      // Add a holding and persist
      tracker.addHolding({
        asset: 'BTC',
        assetClass: 'crypto',
        quantity: 1,
        costBasis: 40000,
        acquiredAt: new Date().toISOString(),
      });
      await tracker.persist();

      // Create new tracker pointing to same storage
      const tracker2 = new PortfolioTracker(eventBus, { storagePath: testStoragePath });
      await tracker2.init();

      const holdings = tracker2.getHoldings();
      expect(holdings).toHaveLength(1);
      expect(holdings[0].asset).toBe('BTC');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // HOLDING MANAGEMENT TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('addHolding', () => {
    it('should add a crypto holding', () => {
      const holding: Holding = {
        asset: 'BTC',
        assetClass: 'crypto',
        quantity: 0.5,
        costBasis: 25000,
        acquiredAt: new Date().toISOString(),
      };

      tracker.addHolding(holding);

      const holdings = tracker.getHoldings();
      expect(holdings).toHaveLength(1);
      expect(holdings[0]).toMatchObject({
        asset: 'BTC',
        assetClass: 'crypto',
        quantity: 0.5,
        costBasis: 25000,
      });
    });

    it('should add a stock holding', () => {
      tracker.addHolding({
        asset: 'AAPL',
        assetClass: 'stock',
        quantity: 100,
        costBasis: 15000,
        acquiredAt: new Date().toISOString(),
      });

      const holding = tracker.getHolding('AAPL');
      expect(holding).toBeDefined();
      expect(holding?.assetClass).toBe('stock');
    });

    it('should add a Pokemon card holding', () => {
      tracker.addHolding({
        asset: 'CHARIZARD-BASE-4',
        assetClass: 'pokemon',
        quantity: 1,
        costBasis: 300,
        acquiredAt: new Date().toISOString(),
      });

      const holdings = tracker.getHoldingsByClass('pokemon');
      expect(holdings).toHaveLength(1);
      expect(holdings[0].asset).toBe('CHARIZARD-BASE-4');
    });

    it('should add an ETF holding', () => {
      tracker.addHolding({
        asset: 'VTI',
        assetClass: 'etf',
        quantity: 50,
        costBasis: 12000,
        acquiredAt: new Date().toISOString(),
      });

      const holdings = tracker.getHoldingsByClass('etf');
      expect(holdings).toHaveLength(1);
    });

    it('should replace existing holding for same asset', () => {
      tracker.addHolding({
        asset: 'BTC',
        assetClass: 'crypto',
        quantity: 1,
        costBasis: 40000,
        acquiredAt: new Date().toISOString(),
      });

      tracker.addHolding({
        asset: 'BTC',
        assetClass: 'crypto',
        quantity: 2,
        costBasis: 80000,
        acquiredAt: new Date().toISOString(),
      });

      const holdings = tracker.getHoldings();
      expect(holdings).toHaveLength(1);
      expect(holdings[0].quantity).toBe(2);
    });

    it('should throw on invalid holding', () => {
      expect(() => tracker.addHolding({
        asset: '',
        assetClass: 'crypto',
        quantity: 1,
        costBasis: 100,
        acquiredAt: new Date().toISOString(),
      })).toThrow();
    });

    it('should throw on negative quantity', () => {
      expect(() => tracker.addHolding({
        asset: 'BTC',
        assetClass: 'crypto',
        quantity: -1,
        costBasis: 100,
        acquiredAt: new Date().toISOString(),
      })).toThrow();
    });
  });

  describe('removeHolding', () => {
    it('should remove existing holding', () => {
      tracker.addHolding({
        asset: 'BTC',
        assetClass: 'crypto',
        quantity: 1,
        costBasis: 40000,
        acquiredAt: new Date().toISOString(),
      });

      const result = tracker.removeHolding('BTC');

      expect(result).toBe(true);
      expect(tracker.getHoldings()).toHaveLength(0);
    });

    it('should return false for non-existent holding', () => {
      const result = tracker.removeHolding('NONEXISTENT');
      expect(result).toBe(false);
    });
  });

  describe('updateHolding', () => {
    it('should update existing holding quantity', () => {
      tracker.addHolding({
        asset: 'BTC',
        assetClass: 'crypto',
        quantity: 1,
        costBasis: 40000,
        acquiredAt: new Date().toISOString(),
      });

      const result = tracker.updateHolding('BTC', { quantity: 2 });

      expect(result).toBe(true);
      expect(tracker.getHolding('BTC')?.quantity).toBe(2);
    });

    it('should update existing holding cost basis', () => {
      tracker.addHolding({
        asset: 'BTC',
        assetClass: 'crypto',
        quantity: 1,
        costBasis: 40000,
        acquiredAt: new Date().toISOString(),
      });

      tracker.updateHolding('BTC', { costBasis: 45000 });

      expect(tracker.getHolding('BTC')?.costBasis).toBe(45000);
    });

    it('should return false for non-existent holding', () => {
      const result = tracker.updateHolding('NONEXISTENT', { quantity: 1 });
      expect(result).toBe(false);
    });

    it('should validate updates', () => {
      tracker.addHolding({
        asset: 'BTC',
        assetClass: 'crypto',
        quantity: 1,
        costBasis: 40000,
        acquiredAt: new Date().toISOString(),
      });

      expect(() => tracker.updateHolding('BTC', { quantity: -1 })).toThrow();
    });
  });

  describe('getHoldings', () => {
    it('should return defensive copy', () => {
      tracker.addHolding({
        asset: 'BTC',
        assetClass: 'crypto',
        quantity: 1,
        costBasis: 40000,
        acquiredAt: new Date().toISOString(),
      });

      const holdings = tracker.getHoldings();
      holdings.push({
        asset: 'ETH',
        assetClass: 'crypto',
        quantity: 10,
        costBasis: 30000,
        acquiredAt: new Date().toISOString(),
      });

      expect(tracker.getHoldings()).toHaveLength(1);
    });
  });

  describe('getHoldingsByClass', () => {
    it('should filter by asset class', () => {
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 40000, acquiredAt: new Date().toISOString() });
      tracker.addHolding({ asset: 'ETH', assetClass: 'crypto', quantity: 10, costBasis: 30000, acquiredAt: new Date().toISOString() });
      tracker.addHolding({ asset: 'AAPL', assetClass: 'stock', quantity: 100, costBasis: 15000, acquiredAt: new Date().toISOString() });

      const cryptos = tracker.getHoldingsByClass('crypto');
      const stocks = tracker.getHoldingsByClass('stock');

      expect(cryptos).toHaveLength(2);
      expect(stocks).toHaveLength(1);
    });

    it('should return empty array for no matches', () => {
      const pokemon = tracker.getHoldingsByClass('pokemon');
      expect(pokemon).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PORTFOLIO SUMMARY TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('getPortfolioSummary', () => {
    it('should return empty summary for no holdings', async () => {
      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);

      expect(summary.totalValue).toBe(0);
      expect(summary.totalCostBasis).toBe(0);
      expect(summary.holdings).toHaveLength(0);
    });

    it('should calculate total value correctly', async () => {
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 40000, acquiredAt: new Date().toISOString() });
      tracker.addHolding({ asset: 'ETH', assetClass: 'crypto', quantity: 10, costBasis: 25000, acquiredAt: new Date().toISOString() });

      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);

      // BTC: 1 * 50000 = 50000
      // ETH: 10 * 3000 = 30000
      // Total: 80000
      expect(summary.totalValue).toBe(80000);
    });

    it('should calculate unrealized P&L correctly', async () => {
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 40000, acquiredAt: new Date().toISOString() });

      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);

      // Current: 50000, Cost: 40000, P&L: 10000
      expect(summary.unrealizedPnL).toBe(10000);
      expect(summary.unrealizedPnLPercent).toBe(25); // 10000/40000 * 100
    });

    it('should calculate individual holding P&L', async () => {
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 60000, acquiredAt: new Date().toISOString() });

      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);
      const btcHolding = summary.holdings.find(h => h.asset === 'BTC');

      expect(btcHolding?.pnl).toBe(-10000); // 50000 - 60000
      expect(btcHolding?.pnlPercent).toBeCloseTo(-16.67, 1); // -10000/60000 * 100
    });

    it('should sort holdings by value descending', async () => {
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 40000, acquiredAt: new Date().toISOString() });
      tracker.addHolding({ asset: 'ETH', assetClass: 'crypto', quantity: 10, costBasis: 25000, acquiredAt: new Date().toISOString() });
      tracker.addHolding({ asset: 'AAPL', assetClass: 'stock', quantity: 100, costBasis: 15000, acquiredAt: new Date().toISOString() });

      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);

      // BTC: 50000, ETH: 30000, AAPL: 18000
      expect(summary.holdings[0].asset).toBe('BTC');
      expect(summary.holdings[1].asset).toBe('ETH');
      expect(summary.holdings[2].asset).toBe('AAPL');
    });

    it('should emit portfolio update event', async () => {
      const handler = vi.fn();
      eventBus.on('investment:portfolio_update', handler);

      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 40000, acquiredAt: new Date().toISOString() });
      await tracker.getPortfolioSummary(mockMarketMonitor);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          totalValue: 50000,
          dailyChange: expect.any(Number),
        })
      );
    });

    it('should handle missing prices gracefully', async () => {
      tracker.addHolding({ asset: 'UNKNOWN', assetClass: 'crypto', quantity: 1, costBasis: 100, acquiredAt: new Date().toISOString() });

      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);

      expect(summary.holdings[0].currentPrice).toBe(0);
      expect(summary.holdings[0].currentValue).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SNAPSHOT TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('saveSnapshot', () => {
    it('should save a snapshot', async () => {
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 40000, acquiredAt: new Date().toISOString() });
      await tracker.saveSnapshot();

      const snapshots = tracker.getSnapshots();
      expect(snapshots).toHaveLength(1);
    });

    it('should limit snapshots to maxSnapshots', async () => {
      const tracker2 = new PortfolioTracker(eventBus, { storagePath: testStoragePath, maxSnapshots: 3 });
      await tracker2.init();

      for (let i = 0; i < 5; i++) {
        await tracker2.saveSnapshot();
      }

      const snapshots = tracker2.getSnapshots();
      expect(snapshots).toHaveLength(3);
    });
  });

  describe('saveSnapshotWithValues', () => {
    it('should save snapshot with actual values', async () => {
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 40000, acquiredAt: new Date().toISOString() });
      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);
      await tracker.saveSnapshotWithValues(summary);

      const snapshots = tracker.getSnapshots();
      expect(snapshots[0].totalValue).toBe(50000);
    });

    it('should update existing snapshot for same day', async () => {
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 40000, acquiredAt: new Date().toISOString() });

      const summary1 = await tracker.getPortfolioSummary(mockMarketMonitor);
      await tracker.saveSnapshotWithValues(summary1);

      tracker.updateHolding('BTC', { quantity: 2 });
      const summary2 = await tracker.getPortfolioSummary(mockMarketMonitor);
      await tracker.saveSnapshotWithValues(summary2);

      const snapshots = tracker.getSnapshots();
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].totalValue).toBe(100000); // 2 BTC * 50000
    });
  });

  describe('getChangeOverPeriod', () => {
    it('should return zero change with no snapshots', () => {
      const { change, changePercent } = tracker.getChangeOverPeriod(7, 10000);
      expect(change).toBe(0);
      expect(changePercent).toBe(0);
    });

    it('should calculate change over period', async () => {
      // Add a snapshot from a week ago (manually)
      const state = tracker.getSnapshotsState();
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      state.snapshots.push({
        timestamp: weekAgo.toISOString(),
        totalValue: 40000,
        holdings: [],
      });

      const { change, changePercent } = tracker.getChangeOverPeriod(7, 50000);
      expect(change).toBe(10000);
      expect(changePercent).toBe(25);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ANALYTICS TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('getAssetAllocation', () => {
    it('should calculate allocation percentages', async () => {
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 40000, acquiredAt: new Date().toISOString() });
      tracker.addHolding({ asset: 'VTI', assetClass: 'etf', quantity: 200, costBasis: 40000, acquiredAt: new Date().toISOString() });

      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);
      const allocation = tracker.getAssetAllocation(summary);

      // BTC: 50000, VTI: 50000, Total: 100000
      expect(allocation.get('crypto')).toBe(50);
      expect(allocation.get('etf')).toBe(50);
    });

    it('should return empty map for zero value portfolio', async () => {
      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);
      const allocation = tracker.getAssetAllocation(summary);
      expect(allocation.size).toBe(0);
    });
  });

  describe('getTopPerformers', () => {
    it('should return top performers by P&L percent', async () => {
      // BTC: 50000/40000 = 25% gain
      // ETH: 30000/25000 = 20% gain
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 40000, acquiredAt: new Date().toISOString() });
      tracker.addHolding({ asset: 'ETH', assetClass: 'crypto', quantity: 10, costBasis: 25000, acquiredAt: new Date().toISOString() });

      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);
      const top = tracker.getTopPerformers(summary, 2);

      expect(top[0].asset).toBe('BTC');
      expect(top[1].asset).toBe('ETH');
    });
  });

  describe('getWorstPerformers', () => {
    it('should return worst performers by P&L percent', async () => {
      // BTC: 50000/60000 = -16.67% loss
      // ETH: 30000/25000 = 20% gain
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 60000, acquiredAt: new Date().toISOString() });
      tracker.addHolding({ asset: 'ETH', assetClass: 'crypto', quantity: 10, costBasis: 25000, acquiredAt: new Date().toISOString() });

      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);
      const worst = tracker.getWorstPerformers(summary, 2);

      expect(worst[0].asset).toBe('BTC');
    });
  });

  describe('getStatistics', () => {
    it('should calculate portfolio statistics', async () => {
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 40000, acquiredAt: new Date().toISOString() });
      tracker.addHolding({ asset: 'ETH', assetClass: 'crypto', quantity: 10, costBasis: 35000, acquiredAt: new Date().toISOString() });

      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);
      const stats = tracker.getStatistics(summary);

      expect(stats.holdingsCount).toBe(2);
      expect(stats.profitableCount).toBe(1); // BTC is profitable
      expect(stats.losingCount).toBe(1); // ETH is losing
      expect(stats.largestPosition?.asset).toBe('BTC');
    });

    it('should handle empty portfolio', async () => {
      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);
      const stats = tracker.getStatistics(summary);

      expect(stats.holdingsCount).toBe(0);
      expect(stats.largestPosition).toBeNull();
      expect(stats.smallestPosition).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PERSISTENCE TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('persist', () => {
    it('should persist holdings to disk', async () => {
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 40000, acquiredAt: new Date().toISOString() });
      await tracker.persist();

      const holdingsPath = path.join(testStoragePath, 'holdings.json');
      expect(existsSync(holdingsPath)).toBe(true);

      const data = await fs.readFile(holdingsPath, 'utf-8');
      const parsed = JSON.parse(data);
      expect(parsed.holdings).toHaveLength(1);
    });
  });

  describe('clearHoldings', () => {
    it('should clear all holdings', async () => {
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 40000, acquiredAt: new Date().toISOString() });
      await tracker.clearHoldings();

      expect(tracker.getHoldings()).toHaveLength(0);
    });
  });

  describe('clearSnapshots', () => {
    it('should clear all snapshots', async () => {
      await tracker.saveSnapshot();
      await tracker.clearSnapshots();

      expect(tracker.getSnapshots()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle zero cost basis', async () => {
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 0, acquiredAt: new Date().toISOString() });

      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);

      expect(summary.holdings[0].pnlPercent).toBe(0); // Avoid division by zero
    });

    it('should handle fractional quantities', async () => {
      tracker.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 0.00001, costBasis: 0.5, acquiredAt: new Date().toISOString() });

      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);

      expect(summary.holdings[0].currentValue).toBeCloseTo(0.5, 2); // 0.00001 * 50000
    });

    it('should handle very large quantities', async () => {
      tracker.addHolding({ asset: 'ETH', assetClass: 'crypto', quantity: 1000000, costBasis: 2500000000, acquiredAt: new Date().toISOString() });

      const summary = await tracker.getPortfolioSummary(mockMarketMonitor);

      expect(summary.holdings[0].currentValue).toBe(3000000000); // 1M * 3000
    });

    it('should work without EventBus', async () => {
      const trackerNoEvents = new PortfolioTracker(undefined, { storagePath: testStoragePath });
      await trackerNoEvents.init();

      trackerNoEvents.addHolding({ asset: 'BTC', assetClass: 'crypto', quantity: 1, costBasis: 40000, acquiredAt: new Date().toISOString() });

      const summary = await trackerNoEvents.getPortfolioSummary(mockMarketMonitor);
      expect(summary.totalValue).toBe(50000);
    });
  });
});
