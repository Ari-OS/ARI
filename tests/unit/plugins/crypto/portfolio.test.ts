import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PortfolioManager } from '../../../../src/plugins/crypto/portfolio.js';
import type { CoinGeckoPrice } from '../../../../src/plugins/crypto/types.js';

describe('PortfolioManager', () => {
  let tempDir: string;
  let portfolio: PortfolioManager;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ari-crypto-test-'));
    portfolio = new PortfolioManager(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('holdings', () => {
    it('should add a new holding', () => {
      const holding = portfolio.addHolding('bitcoin', 'BTC', 0.5, 25000);
      expect(holding.coinId).toBe('bitcoin');
      expect(holding.symbol).toBe('BTC');
      expect(holding.amount).toBe(0.5);
      expect(holding.costBasis).toBe(25000);
    });

    it('should accumulate when adding to existing holding', () => {
      portfolio.addHolding('bitcoin', 'BTC', 0.5, 25000);
      const holding = portfolio.addHolding('bitcoin', 'BTC', 0.3, 15000);
      expect(holding.amount).toBe(0.8);
      expect(holding.costBasis).toBe(40000);
    });

    it('should list all holdings', () => {
      portfolio.addHolding('bitcoin', 'BTC', 1, 50000);
      portfolio.addHolding('ethereum', 'ETH', 10, 30000);
      expect(portfolio.getHoldings()).toHaveLength(2);
    });

    it('should remove a holding', () => {
      portfolio.addHolding('bitcoin', 'BTC', 1, 50000);
      expect(portfolio.removeHolding('bitcoin')).toBe(true);
      expect(portfolio.getHoldings()).toHaveLength(0);
    });

    it('should return false when removing non-existent holding', () => {
      expect(portfolio.removeHolding('dogecoin')).toBe(false);
    });

    it('should persist holdings across instances', () => {
      portfolio.addHolding('bitcoin', 'BTC', 1, 50000);
      const reloaded = new PortfolioManager(tempDir);
      expect(reloaded.getHoldings()).toHaveLength(1);
      expect(reloaded.getHoldings()[0].coinId).toBe('bitcoin');
    });
  });

  describe('calculatePortfolioValue', () => {
    it('should calculate total portfolio value', () => {
      portfolio.addHolding('bitcoin', 'BTC', 1, 40000);
      portfolio.addHolding('ethereum', 'ETH', 10, 20000);

      const prices: CoinGeckoPrice = {
        bitcoin: { usd: 50000, usd_24h_change: 5 },
        ethereum: { usd: 3000, usd_24h_change: -2 },
      };

      const result = portfolio.calculatePortfolioValue(prices);
      expect(result.totalValue).toBe(80000); // 50000 + 30000
      expect(result.totalCost).toBe(60000); // 40000 + 20000
      expect(result.pnl).toBe(20000);
      expect(result.pnlPercent).toBeCloseTo(33.33, 1);
      expect(result.holdings).toHaveLength(2);
    });

    it('should handle missing price data gracefully', () => {
      portfolio.addHolding('bitcoin', 'BTC', 1, 50000);
      const result = portfolio.calculatePortfolioValue({});
      expect(result.totalValue).toBe(0);
    });
  });

  describe('alerts', () => {
    it('should add and retrieve alerts', () => {
      const alert = portfolio.addAlert('bitcoin', 'above', 60000);
      expect(alert.coinId).toBe('bitcoin');
      expect(alert.type).toBe('above');
      expect(alert.threshold).toBe(60000);
      expect(alert.triggered).toBe(false);
    });

    it('should trigger above alerts', () => {
      portfolio.addAlert('bitcoin', 'above', 55000);

      const prices: CoinGeckoPrice = {
        bitcoin: { usd: 56000 },
      };

      const triggered = portfolio.checkAlerts(prices);
      expect(triggered).toHaveLength(1);
      expect(triggered[0].type).toBe('above');
    });

    it('should trigger below alerts', () => {
      portfolio.addAlert('bitcoin', 'below', 45000);

      const prices: CoinGeckoPrice = {
        bitcoin: { usd: 44000 },
      };

      const triggered = portfolio.checkAlerts(prices);
      expect(triggered).toHaveLength(1);
    });

    it('should not trigger already-triggered alerts', () => {
      portfolio.addAlert('bitcoin', 'above', 55000);

      const prices: CoinGeckoPrice = { bitcoin: { usd: 56000 } };

      portfolio.checkAlerts(prices);
      const secondCheck = portfolio.checkAlerts(prices);
      expect(secondCheck).toHaveLength(0);
    });

    it('should not trigger when price does not cross threshold', () => {
      portfolio.addAlert('bitcoin', 'above', 60000);

      const prices: CoinGeckoPrice = { bitcoin: { usd: 55000 } };
      const triggered = portfolio.checkAlerts(prices);
      expect(triggered).toHaveLength(0);
    });

    it('should filter out triggered alerts from active list', () => {
      portfolio.addAlert('bitcoin', 'above', 55000);
      portfolio.addAlert('ethereum', 'below', 2000);

      const prices: CoinGeckoPrice = { bitcoin: { usd: 56000 } };
      portfolio.checkAlerts(prices);

      expect(portfolio.getAlerts()).toHaveLength(1);
      expect(portfolio.getAllAlerts()).toHaveLength(2);
    });

    it('should remove an alert by id', () => {
      const alert = portfolio.addAlert('bitcoin', 'above', 60000);
      expect(portfolio.removeAlert(alert.id)).toBe(true);
      expect(portfolio.getAlerts()).toHaveLength(0);
    });
  });

  describe('snapshots', () => {
    it('should save and retrieve snapshots', () => {
      portfolio.addHolding('bitcoin', 'BTC', 1, 50000);

      const prices: CoinGeckoPrice = {
        bitcoin: { usd: 55000 },
      };

      const snapshot = portfolio.saveSnapshot(prices);
      expect(snapshot.totalValue).toBe(55000);
      expect(snapshot.holdings).toHaveLength(1);

      const snapshots = portfolio.getSnapshots();
      expect(snapshots).toHaveLength(1);
    });

    it('should limit snapshots to 90', () => {
      portfolio.addHolding('bitcoin', 'BTC', 1, 50000);
      const prices: CoinGeckoPrice = { bitcoin: { usd: 50000 } };

      for (let i = 0; i < 95; i++) {
        portfolio.saveSnapshot(prices);
      }

      expect(portfolio.getSnapshots()).toHaveLength(90);
    });
  });
});
