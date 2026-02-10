import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import {
  PortfolioHoldingSchema,
  PriceAlertSchema,
  PortfolioSnapshotSchema,
} from './types.js';
import type {
  PortfolioHolding,
  PriceAlert,
  PortfolioSnapshot,
  CoinGeckoPrice,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// PORTFOLIO MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

interface PortfolioData {
  holdings: PortfolioHolding[];
  alerts: PriceAlert[];
  snapshots: PortfolioSnapshot[];
}

/**
 * Manages crypto portfolio holdings, price alerts, and snapshots.
 * Persists data to `dataDir/portfolio.json`.
 */
export class PortfolioManager {
  private data: PortfolioData = { holdings: [], alerts: [], snapshots: [] };
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'portfolio.json');
    this.load();
  }

  // ── Holdings ───────────────────────────────────────────────────────

  getHoldings(): PortfolioHolding[] {
    return [...this.data.holdings];
  }

  addHolding(coinId: string, symbol: string, amount: number, costBasis: number = 0): PortfolioHolding {
    const existing = this.data.holdings.find(h => h.coinId === coinId);
    if (existing) {
      existing.amount += amount;
      existing.costBasis += costBasis;
      this.save();
      return existing;
    }

    const holding = PortfolioHoldingSchema.parse({
      coinId,
      symbol: symbol.toUpperCase(),
      amount,
      costBasis,
      addedAt: new Date().toISOString(),
    });

    this.data.holdings.push(holding);
    this.save();
    return holding;
  }

  removeHolding(coinId: string): boolean {
    const idx = this.data.holdings.findIndex(h => h.coinId === coinId);
    if (idx === -1) return false;
    this.data.holdings.splice(idx, 1);
    this.save();
    return true;
  }

  // ── Portfolio Value ────────────────────────────────────────────────

  calculatePortfolioValue(prices: CoinGeckoPrice): {
    totalValue: number;
    totalCost: number;
    pnl: number;
    pnlPercent: number;
    holdings: Array<{
      coinId: string;
      symbol: string;
      amount: number;
      price: number;
      value: number;
      change24h: number;
    }>;
  } {
    let totalValue = 0;
    let totalCost = 0;
    const holdings = this.data.holdings.map(h => {
      const priceData = prices[h.coinId];
      const price = priceData?.usd ?? 0;
      const value = h.amount * price;
      const change24h = priceData?.usd_24h_change ?? 0;
      totalValue += value;
      totalCost += h.costBasis;

      return {
        coinId: h.coinId,
        symbol: h.symbol,
        amount: h.amount,
        price,
        value,
        change24h,
      };
    });

    const pnl = totalValue - totalCost;
    const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

    return { totalValue, totalCost, pnl, pnlPercent, holdings };
  }

  // ── Alerts ─────────────────────────────────────────────────────────

  getAlerts(): PriceAlert[] {
    return this.data.alerts.filter(a => !a.triggered);
  }

  getAllAlerts(): PriceAlert[] {
    return [...this.data.alerts];
  }

  addAlert(coinId: string, type: 'above' | 'below', threshold: number): PriceAlert {
    const alert = PriceAlertSchema.parse({
      id: uuidv4().slice(0, 8),
      coinId,
      type,
      threshold,
      createdAt: new Date().toISOString(),
      triggered: false,
    });

    this.data.alerts.push(alert);
    this.save();
    return alert;
  }

  removeAlert(id: string): boolean {
    const idx = this.data.alerts.findIndex(a => a.id === id);
    if (idx === -1) return false;
    this.data.alerts.splice(idx, 1);
    this.save();
    return true;
  }

  checkAlerts(prices: CoinGeckoPrice): PriceAlert[] {
    const triggered: PriceAlert[] = [];

    for (const alert of this.data.alerts) {
      if (alert.triggered) continue;

      const priceData = prices[alert.coinId];
      if (!priceData) continue;

      const currentPrice = priceData.usd;
      const shouldTrigger =
        (alert.type === 'above' && currentPrice >= alert.threshold) ||
        (alert.type === 'below' && currentPrice <= alert.threshold);

      if (shouldTrigger) {
        alert.triggered = true;
        triggered.push(alert);
      }
    }

    if (triggered.length > 0) this.save();
    return triggered;
  }

  // ── Snapshots ──────────────────────────────────────────────────────

  saveSnapshot(prices: CoinGeckoPrice): PortfolioSnapshot {
    const holdingsData = this.data.holdings.map(h => {
      const price = prices[h.coinId]?.usd ?? 0;
      return {
        coinId: h.coinId,
        amount: h.amount,
        price,
        value: h.amount * price,
      };
    });

    const snapshot = PortfolioSnapshotSchema.parse({
      timestamp: new Date().toISOString(),
      totalValue: holdingsData.reduce((sum, h) => sum + h.value, 0),
      holdings: holdingsData,
    });

    this.data.snapshots.push(snapshot);

    // Keep last 90 snapshots
    if (this.data.snapshots.length > 90) {
      this.data.snapshots = this.data.snapshots.slice(-90);
    }

    this.save();
    return snapshot;
  }

  getSnapshots(): PortfolioSnapshot[] {
    return [...this.data.snapshots];
  }

  // ── Persistence ────────────────────────────────────────────────────

  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw) as PortfolioData;
        this.data = {
          holdings: (parsed.holdings ?? []).map(h => PortfolioHoldingSchema.parse(h)),
          alerts: (parsed.alerts ?? []).map(a => PriceAlertSchema.parse(a)),
          snapshots: (parsed.snapshots ?? []).map(s => PortfolioSnapshotSchema.parse(s)),
        };
      }
    } catch {
      this.data = { holdings: [], alerts: [], snapshots: [] };
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }
}
