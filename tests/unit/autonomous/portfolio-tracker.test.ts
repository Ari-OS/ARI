import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { PortfolioTracker } from '../../../src/autonomous/portfolio-tracker.js';
import type { EventBus } from '../../../src/kernel/event-bus.js';
import type { PriceSnapshot } from '../../../src/autonomous/market-monitor.js';

// Mock fs
vi.mock('node:fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

describe('PortfolioTracker', () => {
  let tracker: PortfolioTracker;
  let mockEventBus: EventBus;
  const testDataDir = '/tmp/test-portfolio';

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

    tracker = new PortfolioTracker(mockEventBus, { dataDir: testDataDir });

    // Default mock implementations
    (fs.mkdir as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('should create with default data directory', () => {
      const t = new PortfolioTracker(mockEventBus);
      expect(t).toBeDefined();
    });

    it('should create with custom data directory', () => {
      const t = new PortfolioTracker(mockEventBus, { dataDir: '/custom/path' });
      expect(t).toBeDefined();
    });
  });

  describe('init()', () => {
    it('should load existing portfolio data', async () => {
      const portfolioData = {
        positions: [
          {
            asset: 'bitcoin',
            assetClass: 'crypto',
            quantity: 0.5,
            averageCost: 40000,
          },
        ],
        version: '1.0.0',
      };

      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify(portfolioData)
      );

      await tracker.init();

      const portfolio = tracker.getPortfolio();
      expect(portfolio.positions).toHaveLength(1);
      expect(portfolio.positions[0].asset).toBe('bitcoin');
    });

    it('should handle missing portfolio file', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      await tracker.init();

      const portfolio = tracker.getPortfolio();
      expect(portfolio.positions).toHaveLength(0);
    });

    it('should emit error for non-ENOENT errors', async () => {
      const error = new Error('Permission denied');
      (fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      await tracker.init();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'system:error',
        expect.objectContaining({
          error: expect.any(Error),
          context: 'portfolio-tracker:init',
        })
      );
    });

    it('should create data directory', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      await tracker.init();

      expect(fs.mkdir).toHaveBeenCalledWith(testDataDir, { recursive: true });
    });

    it('should load historical snapshots', async () => {
      (fs.readFile as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(JSON.stringify({ positions: [], version: '1.0.0' }))
        .mockResolvedValueOnce(JSON.stringify([
          {
            timestamp: '2026-01-01T00:00:00Z',
            totalValue: 10000,
            positions: [],
          },
        ]));

      await tracker.init();
      // Should not throw
      expect(tracker).toBeDefined();
    });
  });

  describe('addPosition()', () => {
    beforeEach(async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(error);
      await tracker.init();
    });

    it('should add new position', async () => {
      await tracker.addPosition('bitcoin', 'crypto', 0.5, 40000);

      const portfolio = tracker.getPortfolio();
      expect(portfolio.positions).toHaveLength(1);
      expect(portfolio.positions[0].asset).toBe('bitcoin');
      expect(portfolio.positions[0].quantity).toBe(0.5);
      expect(portfolio.positions[0].averageCost).toBe(40000);
    });

    it('should save after adding position', async () => {
      await tracker.addPosition('bitcoin', 'crypto', 0.5, 40000);

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should emit portfolio_update event', async () => {
      await tracker.addPosition('bitcoin', 'crypto', 0.5, 40000);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'investment:portfolio_update',
        expect.objectContaining({
          action: 'add_position',
          asset: 'bitcoin',
          quantity: 0.5,
          averageCost: 40000,
        })
      );
    });

    it('should update existing position', async () => {
      await tracker.addPosition('bitcoin', 'crypto', 0.5, 40000);
      await tracker.addPosition('bitcoin', 'crypto', 1.0, 45000);

      const portfolio = tracker.getPortfolio();
      expect(portfolio.positions).toHaveLength(1);
      expect(portfolio.positions[0].quantity).toBe(1.0);
      expect(portfolio.positions[0].averageCost).toBe(45000);
    });

    it('should handle multiple positions', async () => {
      await tracker.addPosition('bitcoin', 'crypto', 0.5, 40000);
      await tracker.addPosition('ethereum', 'crypto', 10, 2000);
      await tracker.addPosition('AAPL', 'stock', 100, 150);

      const portfolio = tracker.getPortfolio();
      expect(portfolio.positions).toHaveLength(3);
    });
  });

  describe('removePosition()', () => {
    beforeEach(async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(error);
      await tracker.init();
      await tracker.addPosition('bitcoin', 'crypto', 0.5, 40000);
    });

    it('should remove position', async () => {
      await tracker.removePosition('bitcoin');

      const portfolio = tracker.getPortfolio();
      expect(portfolio.positions).toHaveLength(0);
    });

    it('should save after removing position', async () => {
      vi.clearAllMocks();
      await tracker.removePosition('bitcoin');

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should emit portfolio_update event', async () => {
      await tracker.removePosition('bitcoin');

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'investment:portfolio_update',
        expect.objectContaining({
          action: 'remove_position',
          asset: 'bitcoin',
        })
      );
    });

    it('should handle removing non-existent position', async () => {
      await tracker.removePosition('unknown');

      const portfolio = tracker.getPortfolio();
      expect(portfolio.positions).toHaveLength(1);
    });
  });

  describe('updatePrices()', () => {
    beforeEach(async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(error);
      await tracker.init();
      await tracker.addPosition('bitcoin', 'crypto', 0.5, 40000);
      await tracker.addPosition('ethereum', 'crypto', 10, 2000);
    });

    it('should update prices from snapshots', async () => {
      const snapshots: PriceSnapshot[] = [
        {
          asset: 'bitcoin',
          assetClass: 'crypto',
          price: 50000,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          timestamp: new Date().toISOString(),
          source: 'test',
        },
        {
          asset: 'ethereum',
          assetClass: 'crypto',
          price: 3000,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          timestamp: new Date().toISOString(),
          source: 'test',
        },
      ];

      await tracker.updatePrices(snapshots);

      const portfolio = tracker.getPortfolio();
      const btc = portfolio.positions.find(p => p.asset === 'bitcoin');
      expect(btc?.currentPrice).toBe(50000);
      expect(btc?.currentValue).toBe(25000); // 0.5 * 50000
    });

    it('should emit portfolio_update event', async () => {
      const snapshots: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 50000,
        change24h: 0,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'test',
      }];

      await tracker.updatePrices(snapshots);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'investment:portfolio_update',
        expect.objectContaining({
          action: 'update_prices',
          snapshotCount: 1,
        })
      );
    });

    it('should save historical snapshot', async () => {
      const snapshots: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 50000,
        change24h: 0,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'test',
      }];

      await tracker.updatePrices(snapshots);

      // Should have called writeFile for snapshots
      const calls = (fs.writeFile as ReturnType<typeof vi.fn>).mock.calls;
      const snapshotCall = calls.find((call: unknown[]) =>
        (call[0] as string).includes('portfolio-snapshots.json')
      );
      expect(snapshotCall).toBeDefined();
    });
  });

  describe('getPortfolio()', () => {
    beforeEach(async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(error);
      await tracker.init();
    });

    it('should return empty portfolio initially', () => {
      const portfolio = tracker.getPortfolio();

      expect(portfolio.totalValue).toBe(0);
      expect(portfolio.totalCost).toBe(0);
      expect(portfolio.positions).toHaveLength(0);
    });

    it('should calculate P&L correctly', async () => {
      await tracker.addPosition('bitcoin', 'crypto', 1, 40000);

      const snapshots: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 50000,
        change24h: 0,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'test',
      }];

      await tracker.updatePrices(snapshots);

      const portfolio = tracker.getPortfolio();
      expect(portfolio.totalValue).toBe(50000);
      expect(portfolio.totalCost).toBe(40000);
      expect(portfolio.totalPnL).toBe(10000);
      expect(portfolio.totalPnLPercent).toBe(25);
    });

    it('should calculate weights correctly', async () => {
      await tracker.addPosition('bitcoin', 'crypto', 1, 40000);
      await tracker.addPosition('ethereum', 'crypto', 10, 2000);

      const snapshots: PriceSnapshot[] = [
        {
          asset: 'bitcoin',
          assetClass: 'crypto',
          price: 50000,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          timestamp: new Date().toISOString(),
          source: 'test',
        },
        {
          asset: 'ethereum',
          assetClass: 'crypto',
          price: 3000,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          timestamp: new Date().toISOString(),
          source: 'test',
        },
      ];

      await tracker.updatePrices(snapshots);

      const portfolio = tracker.getPortfolio();
      const btc = portfolio.positions.find(p => p.asset === 'bitcoin');
      const eth = portfolio.positions.find(p => p.asset === 'ethereum');

      // Total value = 50000 + 30000 = 80000
      // BTC weight = 50000 / 80000 = 62.5%
      // ETH weight = 30000 / 80000 = 37.5%
      expect(btc?.weight).toBeCloseTo(62.5, 1);
      expect(eth?.weight).toBeCloseTo(37.5, 1);
    });

    it('should calculate allocation by asset class', async () => {
      await tracker.addPosition('bitcoin', 'crypto', 1, 40000);
      await tracker.addPosition('AAPL', 'stock', 100, 150);

      const snapshots: PriceSnapshot[] = [
        {
          asset: 'bitcoin',
          assetClass: 'crypto',
          price: 50000,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          timestamp: new Date().toISOString(),
          source: 'test',
        },
        {
          asset: 'AAPL',
          assetClass: 'stock',
          price: 200,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          timestamp: new Date().toISOString(),
          source: 'test',
        },
      ];

      await tracker.updatePrices(snapshots);

      const portfolio = tracker.getPortfolio();

      // Crypto: 50000
      // Stock: 20000
      // Total: 70000
      expect(portfolio.allocation.crypto.value).toBe(50000);
      expect(portfolio.allocation.crypto.percent).toBeCloseTo(71.43, 1);
      expect(portfolio.allocation.stock.value).toBe(20000);
      expect(portfolio.allocation.stock.percent).toBeCloseTo(28.57, 1);
    });

    it('should sort positions by value descending', async () => {
      await tracker.addPosition('bitcoin', 'crypto', 1, 40000);
      await tracker.addPosition('ethereum', 'crypto', 10, 2000);
      await tracker.addPosition('AAPL', 'stock', 50, 150);

      const snapshots: PriceSnapshot[] = [
        {
          asset: 'bitcoin',
          assetClass: 'crypto',
          price: 50000,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          timestamp: new Date().toISOString(),
          source: 'test',
        },
        {
          asset: 'ethereum',
          assetClass: 'crypto',
          price: 3000,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          timestamp: new Date().toISOString(),
          source: 'test',
        },
        {
          asset: 'AAPL',
          assetClass: 'stock',
          price: 200,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          timestamp: new Date().toISOString(),
          source: 'test',
        },
      ];

      await tracker.updatePrices(snapshots);

      const portfolio = tracker.getPortfolio();
      expect(portfolio.positions[0].asset).toBe('bitcoin'); // 50000
      expect(portfolio.positions[1].asset).toBe('ethereum'); // 30000
      expect(portfolio.positions[2].asset).toBe('AAPL'); // 10000
    });
  });

  describe('getWeeklySummary()', () => {
    beforeEach(async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(error);
      await tracker.init();
    });

    it('should return summary with no history', () => {
      const summary = tracker.getWeeklySummary();

      expect(summary.totalValue).toBe(0);
      expect(summary.weeklyChange).toBe(0);
      expect(summary.weeklyChangePercent).toBe(0);
      expect(summary.topPerformer).toBeNull();
      expect(summary.worstPerformer).toBeNull();
    });

    it('should calculate weekly change', async () => {
      await tracker.addPosition('bitcoin', 'crypto', 1, 40000);

      // Initial snapshot (7 days ago)
      const snapshots1: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 40000,
        change24h: 0,
        change7d: 0,
        change30d: 0,
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'test',
      }];
      await tracker.updatePrices(snapshots1);

      // Current snapshot
      const snapshots2: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 50000,
        change24h: 0,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'test',
      }];
      await tracker.updatePrices(snapshots2);

      const summary = tracker.getWeeklySummary();

      expect(summary.weeklyChange).toBe(10000);
      expect(summary.weeklyChangePercent).toBe(25);
    });

    it('should identify top and worst performers', async () => {
      await tracker.addPosition('bitcoin', 'crypto', 1, 40000);
      await tracker.addPosition('ethereum', 'crypto', 10, 2000);

      // Initial snapshots
      const snapshots1: PriceSnapshot[] = [
        {
          asset: 'bitcoin',
          assetClass: 'crypto',
          price: 40000,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          source: 'test',
        },
        {
          asset: 'ethereum',
          assetClass: 'crypto',
          price: 2000,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          source: 'test',
        },
      ];
      await tracker.updatePrices(snapshots1);

      // Current snapshots (BTC up 25%, ETH down 10%)
      const snapshots2: PriceSnapshot[] = [
        {
          asset: 'bitcoin',
          assetClass: 'crypto',
          price: 50000,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          timestamp: new Date().toISOString(),
          source: 'test',
        },
        {
          asset: 'ethereum',
          assetClass: 'crypto',
          price: 1800,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          timestamp: new Date().toISOString(),
          source: 'test',
        },
      ];
      await tracker.updatePrices(snapshots2);

      const summary = tracker.getWeeklySummary();

      expect(summary.topPerformer?.asset).toBe('bitcoin');
      expect(summary.worstPerformer?.asset).toBe('ethereum');
    });

    it('should generate recommendations', async () => {
      await tracker.addPosition('bitcoin', 'crypto', 1, 40000);

      const snapshots: PriceSnapshot[] = [{
        asset: 'bitcoin',
        assetClass: 'crypto',
        price: 50000,
        change24h: 0,
        change7d: 0,
        change30d: 0,
        timestamp: new Date().toISOString(),
        source: 'test',
      }];
      await tracker.updatePrices(snapshots);

      const summary = tracker.getWeeklySummary();

      expect(summary.recommendation).toBeTruthy();
      expect(typeof summary.recommendation).toBe('string');
    });
  });

  describe('save()', () => {
    beforeEach(async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(error);
      await tracker.init();
    });

    it('should persist portfolio to file', async () => {
      await tracker.addPosition('bitcoin', 'crypto', 0.5, 40000);

      const calls = (fs.writeFile as ReturnType<typeof vi.fn>).mock.calls;
      const portfolioCall = calls.find((call: unknown[]) =>
        (call[0] as string).includes('portfolio.json') &&
        !(call[0] as string).includes('snapshots')
      );

      expect(portfolioCall).toBeDefined();
      const savedData = JSON.parse(portfolioCall?.[1] as string);
      expect(savedData.positions).toHaveLength(1);
      expect(savedData.positions[0].asset).toBe('bitcoin');
    });

    it('should handle save errors', async () => {
      (fs.writeFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Disk full')
      );

      await tracker.save();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'system:error',
        expect.objectContaining({
          error: expect.any(Error),
          context: 'portfolio-tracker:save',
        })
      );
    });
  });
});
