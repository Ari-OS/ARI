import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { EventBus } from '../kernel/event-bus.js';
import type { AssetClass, PriceSnapshot } from './market-monitor.js';

// ═══════════════════════════════════════════════════════════════════════════════
// PORTFOLIO TRACKER
// Cross-asset portfolio aggregation and performance tracking
// ═══════════════════════════════════════════════════════════════════════════════

export interface Position {
  asset: string;
  assetClass: AssetClass;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  weight: number;
  lastUpdated: string;
}

export interface Portfolio {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  lastUpdated: string;
  positions: Position[];
  allocation: Record<AssetClass, { value: number; percent: number }>;
}

export interface PortfolioWeeklySummary {
  weekOf: string;
  totalValue: number;
  weeklyChange: number;
  weeklyChangePercent: number;
  topPerformer: { asset: string; change: number } | null;
  worstPerformer: { asset: string; change: number } | null;
  recommendation: string;
}

interface StoredPosition {
  asset: string;
  assetClass: AssetClass;
  quantity: number;
  averageCost: number;
}

interface PortfolioData {
  positions: StoredPosition[];
  version: string;
}

interface HistoricalSnapshot {
  timestamp: string;
  totalValue: number;
  positions: Array<{
    asset: string;
    value: number;
    price: number;
  }>;
}

export class PortfolioTracker {
  private readonly eventBus: EventBus;
  private readonly dataDir: string;
  private readonly portfolioFilePath: string;
  private positions: Map<string, StoredPosition> = new Map();
  private currentPrices: Map<string, number> = new Map();
  private historicalSnapshots: HistoricalSnapshot[] = [];

  constructor(
    eventBus: EventBus,
    options?: { dataDir?: string }
  ) {
    this.eventBus = eventBus;
    this.dataDir = options?.dataDir ?? join(homedir(), '.ari', 'data');
    this.portfolioFilePath = join(this.dataDir, 'portfolio.json');
  }

  /**
   * Load portfolio from persisted file
   */
  async init(): Promise<void> {
    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataDir, { recursive: true });

      // Load portfolio data
      const data = await fs.readFile(this.portfolioFilePath, 'utf-8');
      const parsed = JSON.parse(data) as PortfolioData;

      // Validate and load positions
      for (const position of parsed.positions) {
        this.positions.set(position.asset, position);
      }

      // Load historical snapshots if they exist
      const snapshotsPath = join(this.dataDir, 'portfolio-snapshots.json');
      try {
        const snapshotsData = await fs.readFile(snapshotsPath, 'utf-8');
        this.historicalSnapshots = JSON.parse(snapshotsData) as HistoricalSnapshot[];
      } catch {
        // Snapshots file doesn't exist yet, that's ok
        this.historicalSnapshots = [];
      }
    } catch (error) {
      // File doesn't exist yet, start with empty portfolio
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.eventBus.emit('system:error', {
          error: new Error(`Failed to load portfolio: ${errMsg}`),
          context: 'portfolio-tracker:init',
        });
      }
    }
  }

  /**
   * Add or update a position
   */
  async addPosition(
    asset: string,
    assetClass: AssetClass,
    quantity: number,
    averageCost: number
  ): Promise<void> {
    this.positions.set(asset, {
      asset,
      assetClass,
      quantity,
      averageCost,
    });

    await this.save();

    this.eventBus.emit('investment:portfolio_update', {
      action: 'add_position',
      asset,
      quantity,
      averageCost,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Remove a position
   */
  async removePosition(asset: string): Promise<void> {
    this.positions.delete(asset);
    await this.save();

    this.eventBus.emit('investment:portfolio_update', {
      action: 'remove_position',
      asset,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Update prices from MarketMonitor snapshots
   */
  async updatePrices(snapshots: PriceSnapshot[]): Promise<void> {
    for (const snapshot of snapshots) {
      this.currentPrices.set(snapshot.asset, snapshot.price);
    }

    // Save a historical snapshot
    const portfolio = this.getPortfolio();
    this.historicalSnapshots.push({
      timestamp: new Date().toISOString(),
      totalValue: portfolio.totalValue,
      positions: portfolio.positions.map(p => ({
        asset: p.asset,
        value: p.currentValue,
        price: p.currentPrice,
      })),
    });

    // Keep last 365 snapshots (~1 year of history)
    if (this.historicalSnapshots.length > 365) {
      this.historicalSnapshots = this.historicalSnapshots.slice(-365);
    }

    await this.saveSnapshots();

    this.eventBus.emit('investment:portfolio_update', {
      action: 'update_prices',
      snapshotCount: snapshots.length,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get full portfolio
   */
  getPortfolio(): Portfolio {
    const positions: Position[] = [];
    let totalValue = 0;
    let totalCost = 0;

    // Calculate positions
    for (const [asset, stored] of this.positions.entries()) {
      const currentPrice = this.currentPrices.get(asset) ?? 0;
      const currentValue = stored.quantity * currentPrice;
      const costBasis = stored.quantity * stored.averageCost;
      const pnl = currentValue - costBasis;
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

      positions.push({
        asset: stored.asset,
        assetClass: stored.assetClass,
        quantity: stored.quantity,
        averageCost: stored.averageCost,
        currentPrice,
        currentValue,
        pnl,
        pnlPercent,
        weight: 0, // Will calculate after totals
        lastUpdated: new Date().toISOString(),
      });

      totalValue += currentValue;
      totalCost += costBasis;
    }

    // Calculate weights
    for (const position of positions) {
      position.weight = totalValue > 0 ? (position.currentValue / totalValue) * 100 : 0;
    }

    // Calculate allocation by asset class
    const allocation: Record<AssetClass, { value: number; percent: number }> = {
      crypto: { value: 0, percent: 0 },
      stock: { value: 0, percent: 0 },
      pokemon: { value: 0, percent: 0 },
      etf: { value: 0, percent: 0 },
    };

    for (const position of positions) {
      allocation[position.assetClass].value += position.currentValue;
    }

    for (const assetClass in allocation) {
      const alloc = allocation[assetClass as AssetClass];
      alloc.percent = totalValue > 0 ? (alloc.value / totalValue) * 100 : 0;
    }

    const totalPnL = totalValue - totalCost;
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalPnL,
      totalPnLPercent,
      lastUpdated: new Date().toISOString(),
      positions: positions.sort((a, b) => b.currentValue - a.currentValue),
      allocation,
    };
  }

  /**
   * Get weekly summary
   */
  getWeeklySummary(): PortfolioWeeklySummary {
    const portfolio = this.getPortfolio();

    // Find snapshot from 7 days ago
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    let weeklySnapshot: HistoricalSnapshot | null = null;
    let minDiff = Infinity;

    for (const snapshot of this.historicalSnapshots) {
      const snapshotTime = new Date(snapshot.timestamp).getTime();
      const diff = Math.abs(snapshotTime - weekAgo);
      if (diff < minDiff) {
        minDiff = diff;
        weeklySnapshot = snapshot;
      }
    }

    const weeklyChange = weeklySnapshot
      ? portfolio.totalValue - weeklySnapshot.totalValue
      : 0;

    const weeklyChangePercent = weeklySnapshot && weeklySnapshot.totalValue > 0
      ? (weeklyChange / weeklySnapshot.totalValue) * 100
      : 0;

    // Find top and worst performers
    let topPerformer: { asset: string; change: number } | null = null;
    let worstPerformer: { asset: string; change: number } | null = null;

    if (weeklySnapshot) {
      for (const position of portfolio.positions) {
        const prevPosition = weeklySnapshot.positions.find(p => p.asset === position.asset);
        if (!prevPosition) continue;

        const change = ((position.currentValue - prevPosition.value) / prevPosition.value) * 100;

        if (!topPerformer || change > topPerformer.change) {
          topPerformer = { asset: position.asset, change };
        }

        if (!worstPerformer || change < worstPerformer.change) {
          worstPerformer = { asset: position.asset, change };
        }
      }
    }

    // Generate recommendation
    const recommendation = this.generateRecommendation(portfolio, weeklyChangePercent);

    const weekOf = new Date().toISOString().split('T')[0];

    return {
      weekOf,
      totalValue: portfolio.totalValue,
      weeklyChange,
      weeklyChangePercent,
      topPerformer,
      worstPerformer,
      recommendation,
    };
  }

  /**
   * Persist to disk
   */
  async save(): Promise<void> {
    const data: PortfolioData = {
      positions: Array.from(this.positions.values()),
      version: '1.0.0',
    };

    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.writeFile(this.portfolioFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.eventBus.emit('system:error', {
        error: new Error(`Failed to save portfolio: ${errMsg}`),
        context: 'portfolio-tracker:save',
      });
    }
  }

  // ── Private Methods ────────────────────────────────────────────────

  private async saveSnapshots(): Promise<void> {
    const snapshotsPath = join(this.dataDir, 'portfolio-snapshots.json');

    try {
      await fs.writeFile(
        snapshotsPath,
        JSON.stringify(this.historicalSnapshots, null, 2),
        'utf-8'
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.eventBus.emit('system:error', {
        error: new Error(`Failed to save portfolio snapshots: ${errMsg}`),
        context: 'portfolio-tracker:saveSnapshots',
      });
    }
  }

  private generateRecommendation(
    portfolio: Portfolio,
    weeklyChangePercent: number
  ): string {
    if (portfolio.positions.length === 0) {
      return 'Portfolio is empty. Consider adding positions to start tracking.';
    }

    if (weeklyChangePercent > 10) {
      return 'Strong weekly performance. Consider taking some profits or rebalancing.';
    }

    if (weeklyChangePercent < -10) {
      return 'Significant weekly decline. Review positions and consider buying opportunities.';
    }

    if (portfolio.totalPnLPercent > 20) {
      return 'Portfolio up significantly. Consider taking profits or setting stop losses.';
    }

    if (portfolio.totalPnLPercent < -15) {
      return 'Portfolio down significantly. Review thesis and consider adjustments.';
    }

    // Check for concentration risk
    const topPosition = portfolio.positions[0];
    if (topPosition && topPosition.weight > 40) {
      return `High concentration in ${topPosition.asset} (${topPosition.weight.toFixed(1)}%). Consider diversifying.`;
    }

    return 'Portfolio performing within normal range. Continue monitoring.';
  }
}
