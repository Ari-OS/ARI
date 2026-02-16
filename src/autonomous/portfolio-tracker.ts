/**
 * ARI Portfolio Tracker
 *
 * Multi-asset class portfolio tracking system with market integration.
 * Tracks holdings across crypto, stocks, Pokemon cards, and ETFs.
 *
 * Features:
 * - Multi-asset class support (crypto, stock, pokemon, etf)
 * - Cost basis and unrealized P&L tracking
 * - Daily/weekly/monthly change calculation
 * - Persistent storage with atomic writes
 * - EventBus integration for portfolio updates
 * - MarketMonitor integration for live prices
 *
 * Architecture:
 * - L5 (autonomous) layer component
 * - Uses EventBus for cross-layer communication
 * - Persists to ~/.ari/portfolio/
 */

import { z } from 'zod';
import fs from 'node:fs/promises';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { createLogger } from '../kernel/logger.js';
import type { EventBus } from '../kernel/event-bus.js';

const log = createLogger('portfolio-tracker');

// ═══════════════════════════════════════════════════════════════════════════
// FILE PATHS FOR PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

const ARI_DIR = path.join(homedir(), '.ari');
const PORTFOLIO_DIR = path.join(ARI_DIR, 'portfolio');
const HOLDINGS_PATH = path.join(PORTFOLIO_DIR, 'holdings.json');
const SNAPSHOTS_PATH = path.join(PORTFOLIO_DIR, 'snapshots.json');

// ═══════════════════════════════════════════════════════════════════════════
// ZOD SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Asset class enumeration.
 */
export const AssetClassSchema = z.enum(['crypto', 'stock', 'pokemon', 'etf']);
export type AssetClass = z.infer<typeof AssetClassSchema>;

/**
 * Single holding in the portfolio.
 */
export const HoldingSchema = z.object({
  asset: z.string().min(1),
  assetClass: AssetClassSchema,
  quantity: z.number().positive(),
  costBasis: z.number().min(0),
  acquiredAt: z.string().datetime(),
});
export type Holding = z.infer<typeof HoldingSchema>;

/**
 * Extended holding with current market data.
 */
export const HoldingWithPriceSchema = HoldingSchema.extend({
  currentPrice: z.number().min(0),
  currentValue: z.number().min(0),
  pnl: z.number(),
  pnlPercent: z.number(),
});
export type HoldingWithPrice = z.infer<typeof HoldingWithPriceSchema>;

/**
 * Portfolio summary with aggregated metrics.
 */
export const PortfolioSummarySchema = z.object({
  totalValue: z.number().min(0),
  totalCostBasis: z.number().min(0),
  unrealizedPnL: z.number(),
  unrealizedPnLPercent: z.number(),
  dailyChange: z.number(),
  dailyChangePercent: z.number(),
  holdings: z.array(HoldingWithPriceSchema),
  lastUpdated: z.string().datetime(),
});
export type PortfolioSummary = z.infer<typeof PortfolioSummarySchema>;

/**
 * Historical snapshot for change tracking.
 */
export const SnapshotSchema = z.object({
  timestamp: z.string().datetime(),
  totalValue: z.number().min(0),
  holdings: z.array(z.object({
    asset: z.string(),
    value: z.number(),
  })),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

/**
 * Persisted portfolio state.
 */
export const PortfolioStateSchema = z.object({
  version: z.string(),
  holdings: z.array(HoldingSchema),
  lastUpdated: z.string().datetime(),
});
export type PortfolioState = z.infer<typeof PortfolioStateSchema>;

/**
 * Snapshots state for historical tracking.
 */
export const SnapshotsStateSchema = z.object({
  version: z.string(),
  snapshots: z.array(SnapshotSchema),
  lastUpdated: z.string().datetime(),
});
export type SnapshotsState = z.infer<typeof SnapshotsStateSchema>;

/**
 * Portfolio tracker configuration options.
 */
export interface PortfolioTrackerOptions {
  storagePath?: string;
  maxSnapshots?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKET MONITOR INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Interface for market data provider.
 * MarketMonitor implementations must satisfy this contract.
 */
export interface MarketMonitor {
  /**
   * Get current price for an asset.
   * @param asset Asset identifier (symbol, ID, etc.)
   * @param assetClass The asset class to determine price source
   * @returns Current price in USD, or null if unavailable
   */
  getPrice(asset: string, assetClass: AssetClass): Promise<number | null>;

  /**
   * Get prices for multiple assets at once.
   * @param assets Array of asset identifiers with their classes
   * @returns Map of asset to price (null for unavailable)
   */
  getPrices(assets: Array<{ asset: string; assetClass: AssetClass }>): Promise<Map<string, number | null>>;

  /**
   * Get 24h price change for an asset.
   * @param asset Asset identifier
   * @param assetClass The asset class
   * @returns 24h change as decimal (e.g., 0.05 = 5%), or null if unavailable
   */
  get24hChange(asset: string, assetClass: AssetClass): Promise<number | null>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PORTFOLIO TRACKER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Multi-asset class portfolio tracker with market integration.
 *
 * Tracks holdings across:
 * - Crypto (Bitcoin, Ethereum, etc.)
 * - Stocks (AAPL, TSLA, etc.)
 * - Pokemon cards (collectibles)
 * - ETFs (VTI, QQQ, etc.)
 *
 * Example usage:
 * ```typescript
 * const tracker = new PortfolioTracker(eventBus);
 * await tracker.init();
 *
 * tracker.addHolding({
 *   asset: 'BTC',
 *   assetClass: 'crypto',
 *   quantity: 0.5,
 *   costBasis: 25000,
 *   acquiredAt: new Date().toISOString(),
 * });
 *
 * const summary = await tracker.getPortfolioSummary(marketMonitor);
 * console.log(`Total value: $${summary.totalValue}`);
 * ```
 */
export class PortfolioTracker {
  private eventBus: EventBus | null;
  private state: PortfolioState;
  private snapshots: SnapshotsState;
  private holdingsPath: string;
  private snapshotsPath: string;
  private maxSnapshots: number;
  private initialized: boolean = false;

  constructor(eventBus?: EventBus, options?: PortfolioTrackerOptions) {
    this.eventBus = eventBus ?? null;
    this.holdingsPath = options?.storagePath
      ? path.join(options.storagePath, 'holdings.json')
      : HOLDINGS_PATH;
    this.snapshotsPath = options?.storagePath
      ? path.join(options.storagePath, 'snapshots.json')
      : SNAPSHOTS_PATH;
    this.maxSnapshots = options?.maxSnapshots ?? 365; // 1 year of daily snapshots

    // Initialize empty state (will be loaded in init())
    this.state = {
      version: '1.0.0',
      holdings: [],
      lastUpdated: new Date().toISOString(),
    };
    this.snapshots = {
      version: '1.0.0',
      snapshots: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Initialize the portfolio tracker.
   * Loads existing state from disk or creates new state.
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Ensure directory exists
    const dir = path.dirname(this.holdingsPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Load holdings
    this.state = await this.loadState(this.holdingsPath, PortfolioStateSchema, {
      version: '1.0.0',
      holdings: [],
      lastUpdated: new Date().toISOString(),
    });

    // Load snapshots
    this.snapshots = await this.loadState(this.snapshotsPath, SnapshotsStateSchema, {
      version: '1.0.0',
      snapshots: [],
      lastUpdated: new Date().toISOString(),
    });

    this.initialized = true;
    log.info({ holdingsCount: this.state.holdings.length }, 'Portfolio tracker initialized');
  }

  /**
   * Load state from disk with validation.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async loadState<T>(
    filePath: string,
    schema: z.ZodSchema<T>,
    defaultState: T
  ): Promise<T> {
    try {
      if (existsSync(filePath)) {
        const data = readFileSync(filePath, 'utf-8');
        const parsed: unknown = JSON.parse(data);
        return schema.parse(parsed);
      }
    } catch (error) {
      log.error({ error, filePath }, 'Failed to load state, using default');
    }
    return defaultState;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HOLDING MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Add a new holding to the portfolio.
   * If a holding for the same asset already exists, it will be replaced.
   *
   * @param holding The holding to add
   * @throws Error if holding validation fails
   */
  addHolding(holding: Holding): void {
    // Validate holding
    const validated = HoldingSchema.parse(holding);

    // Remove existing holding with same asset (if any)
    this.state.holdings = this.state.holdings.filter(h => h.asset !== validated.asset);

    // Add new holding
    this.state.holdings.push(validated);
    this.state.lastUpdated = new Date().toISOString();

    log.info({ asset: validated.asset, assetClass: validated.assetClass }, 'Holding added');
  }

  /**
   * Remove a holding from the portfolio.
   *
   * @param asset The asset identifier to remove
   * @returns true if holding was removed, false if not found
   */
  removeHolding(asset: string): boolean {
    const initialLength = this.state.holdings.length;
    this.state.holdings = this.state.holdings.filter(h => h.asset !== asset);

    if (this.state.holdings.length < initialLength) {
      this.state.lastUpdated = new Date().toISOString();
      log.info({ asset }, 'Holding removed');
      return true;
    }

    return false;
  }

  /**
   * Update an existing holding.
   *
   * @param asset The asset identifier to update
   * @param updates Partial updates to apply
   * @returns true if holding was updated, false if not found
   */
  updateHolding(asset: string, updates: Partial<Omit<Holding, 'asset'>>): boolean {
    const index = this.state.holdings.findIndex(h => h.asset === asset);
    if (index === -1) {
      return false;
    }

    const existing = this.state.holdings[index];
    const updated = {
      ...existing,
      ...updates,
    };

    // Validate updated holding
    const validated = HoldingSchema.parse(updated);
    this.state.holdings[index] = validated;
    this.state.lastUpdated = new Date().toISOString();

    log.info({ asset, updates: Object.keys(updates) }, 'Holding updated');
    return true;
  }

  /**
   * Get all holdings.
   *
   * @returns Array of all holdings (defensive copy)
   */
  getHoldings(): Holding[] {
    return [...this.state.holdings];
  }

  /**
   * Get a specific holding by asset.
   *
   * @param asset The asset identifier
   * @returns The holding or undefined if not found
   */
  getHolding(asset: string): Holding | undefined {
    return this.state.holdings.find(h => h.asset === asset);
  }

  /**
   * Get holdings filtered by asset class.
   *
   * @param assetClass The asset class to filter by
   * @returns Array of holdings in that asset class
   */
  getHoldingsByClass(assetClass: AssetClass): Holding[] {
    return this.state.holdings.filter(h => h.assetClass === assetClass);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PORTFOLIO SUMMARY
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get complete portfolio summary with current market data.
   *
   * @param marketMonitor Market data provider for live prices
   * @returns Portfolio summary with all holdings and metrics
   */
  async getPortfolioSummary(marketMonitor: MarketMonitor): Promise<PortfolioSummary> {
    if (this.state.holdings.length === 0) {
      return {
        totalValue: 0,
        totalCostBasis: 0,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        dailyChange: 0,
        dailyChangePercent: 0,
        holdings: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    // Fetch all prices in batch
    const priceRequests = this.state.holdings.map(h => ({
      asset: h.asset,
      assetClass: h.assetClass,
    }));
    const prices = await marketMonitor.getPrices(priceRequests);

    // Calculate holdings with prices
    const holdingsWithPrices: HoldingWithPrice[] = [];
    let totalValue = 0;
    let totalCostBasis = 0;

    for (const holding of this.state.holdings) {
      const price = prices.get(holding.asset) ?? 0;
      const currentValue = holding.quantity * price;
      const pnl = currentValue - holding.costBasis;
      const pnlPercent = holding.costBasis > 0 ? (pnl / holding.costBasis) * 100 : 0;

      holdingsWithPrices.push({
        ...holding,
        currentPrice: price,
        currentValue,
        pnl,
        pnlPercent,
      });

      totalValue += currentValue;
      totalCostBasis += holding.costBasis;
    }

    // Calculate unrealized P&L
    const unrealizedPnL = totalValue - totalCostBasis;
    const unrealizedPnLPercent = totalCostBasis > 0
      ? (unrealizedPnL / totalCostBasis) * 100
      : 0;

    // Calculate daily change from snapshots
    const { dailyChange, dailyChangePercent } = this.calculateDailyChange(totalValue);

    // Sort holdings by value (descending)
    holdingsWithPrices.sort((a, b) => b.currentValue - a.currentValue);

    const summary: PortfolioSummary = {
      totalValue,
      totalCostBasis,
      unrealizedPnL,
      unrealizedPnLPercent,
      dailyChange,
      dailyChangePercent,
      holdings: holdingsWithPrices,
      lastUpdated: new Date().toISOString(),
    };

    // Emit portfolio update event
    if (this.eventBus) {
      this.eventBus.emit('investment:portfolio_update', {
        totalValue,
        dailyChange,
      });
    }

    return summary;
  }

  /**
   * Calculate daily change from most recent snapshot.
   */
  private calculateDailyChange(currentValue: number): { dailyChange: number; dailyChangePercent: number } {
    if (this.snapshots.snapshots.length === 0) {
      return { dailyChange: 0, dailyChangePercent: 0 };
    }

    // Get yesterday's snapshot
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const yesterdaySnapshot = this.snapshots.snapshots.find(
      s => s.timestamp.startsWith(yesterdayStr)
    );

    if (!yesterdaySnapshot) {
      // Fall back to most recent snapshot
      const sorted = [...this.snapshots.snapshots].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      const mostRecent = sorted[0];
      if (mostRecent) {
        const change = currentValue - mostRecent.totalValue;
        const percent = mostRecent.totalValue > 0
          ? (change / mostRecent.totalValue) * 100
          : 0;
        return { dailyChange: change, dailyChangePercent: percent };
      }
      return { dailyChange: 0, dailyChangePercent: 0 };
    }

    const change = currentValue - yesterdaySnapshot.totalValue;
    const percent = yesterdaySnapshot.totalValue > 0
      ? (change / yesterdaySnapshot.totalValue) * 100
      : 0;

    return { dailyChange: change, dailyChangePercent: percent };
  }

  /**
   * Get change over a specific period.
   *
   * @param days Number of days to look back
   * @param currentValue Current portfolio value
   * @returns Change amount and percentage
   */
  getChangeOverPeriod(days: number, currentValue: number): { change: number; changePercent: number } {
    if (this.snapshots.snapshots.length === 0) {
      return { change: 0, changePercent: 0 };
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);
    const targetTime = targetDate.getTime();

    // Find closest snapshot to target date
    const sorted = [...this.snapshots.snapshots].sort(
      (a, b) => Math.abs(new Date(a.timestamp).getTime() - targetTime) -
                Math.abs(new Date(b.timestamp).getTime() - targetTime)
    );

    const closest = sorted[0];
    if (!closest) {
      return { change: 0, changePercent: 0 };
    }

    const change = currentValue - closest.totalValue;
    const changePercent = closest.totalValue > 0
      ? (change / closest.totalValue) * 100
      : 0;

    return { change, changePercent };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SNAPSHOTS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Save a snapshot of current portfolio value.
   * Called periodically (e.g., daily) to track historical performance.
   */
  async saveSnapshot(): Promise<void> {
    // Get current values (requires prices, so we'll just save what we have)
    const snapshot: Snapshot = {
      timestamp: new Date().toISOString(),
      totalValue: 0, // Will be updated when summary is calculated
      holdings: this.state.holdings.map(h => ({
        asset: h.asset,
        value: h.costBasis, // Use cost basis as placeholder
      })),
    };

    // Add snapshot
    this.snapshots.snapshots.push(snapshot);

    // Prune old snapshots
    if (this.snapshots.snapshots.length > this.maxSnapshots) {
      this.snapshots.snapshots = this.snapshots.snapshots.slice(-this.maxSnapshots);
    }

    this.snapshots.lastUpdated = new Date().toISOString();
    await this.persistSnapshots();

    log.info({ snapshotCount: this.snapshots.snapshots.length }, 'Snapshot saved');
  }

  /**
   * Save a snapshot with actual market values.
   * Call this after getting portfolio summary with real prices.
   */
  async saveSnapshotWithValues(summary: PortfolioSummary): Promise<void> {
    const snapshot: Snapshot = {
      timestamp: new Date().toISOString(),
      totalValue: summary.totalValue,
      holdings: summary.holdings.map(h => ({
        asset: h.asset,
        value: h.currentValue,
      })),
    };

    // Check if we already have a snapshot for today
    const today = new Date().toISOString().split('T')[0];
    const todayIndex = this.snapshots.snapshots.findIndex(
      s => s.timestamp.startsWith(today)
    );

    if (todayIndex >= 0) {
      // Update existing snapshot
      this.snapshots.snapshots[todayIndex] = snapshot;
    } else {
      // Add new snapshot
      this.snapshots.snapshots.push(snapshot);
    }

    // Prune old snapshots
    if (this.snapshots.snapshots.length > this.maxSnapshots) {
      this.snapshots.snapshots = this.snapshots.snapshots.slice(-this.maxSnapshots);
    }

    this.snapshots.lastUpdated = new Date().toISOString();
    await this.persistSnapshots();

    log.info({
      totalValue: summary.totalValue,
      snapshotCount: this.snapshots.snapshots.length,
    }, 'Snapshot saved with market values');
  }

  /**
   * Get all snapshots.
   *
   * @returns Array of all snapshots (defensive copy)
   */
  getSnapshots(): Snapshot[] {
    return [...this.snapshots.snapshots];
  }

  /**
   * Get snapshots for a specific period.
   *
   * @param days Number of days to look back
   * @returns Snapshots within the period
   */
  getSnapshotsForPeriod(days: number): Snapshot[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.snapshots.snapshots.filter(
      s => new Date(s.timestamp) >= cutoff
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Persist holdings to disk.
   */
  async persist(): Promise<void> {
    await this.persistState(this.holdingsPath, this.state);
  }

  /**
   * Persist snapshots to disk.
   */
  private async persistSnapshots(): Promise<void> {
    await this.persistState(this.snapshotsPath, this.snapshots);
  }

  /**
   * Persist state to disk with atomic write.
   */
  private async persistState(filePath: string, state: unknown): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Atomic write: write to temp file, then rename
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(state, null, 2));
      await fs.rename(tempPath, filePath);

      log.debug({ filePath }, 'State persisted');
    } catch (error) {
      log.error({ error, filePath }, 'Failed to persist state');
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get portfolio allocation by asset class.
   *
   * @param summary Portfolio summary with current values
   * @returns Map of asset class to allocation percentage
   */
  getAssetAllocation(summary: PortfolioSummary): Map<AssetClass, number> {
    const allocation = new Map<AssetClass, number>();

    if (summary.totalValue === 0) {
      return allocation;
    }

    for (const holding of summary.holdings) {
      const current = allocation.get(holding.assetClass) ?? 0;
      allocation.set(
        holding.assetClass,
        current + (holding.currentValue / summary.totalValue) * 100
      );
    }

    return allocation;
  }

  /**
   * Get top performers in the portfolio.
   *
   * @param summary Portfolio summary with current values
   * @param limit Maximum number to return
   * @returns Top holdings by P&L percentage
   */
  getTopPerformers(summary: PortfolioSummary, limit: number = 5): HoldingWithPrice[] {
    return [...summary.holdings]
      .sort((a, b) => b.pnlPercent - a.pnlPercent)
      .slice(0, limit);
  }

  /**
   * Get worst performers in the portfolio.
   *
   * @param summary Portfolio summary with current values
   * @param limit Maximum number to return
   * @returns Bottom holdings by P&L percentage
   */
  getWorstPerformers(summary: PortfolioSummary, limit: number = 5): HoldingWithPrice[] {
    return [...summary.holdings]
      .sort((a, b) => a.pnlPercent - b.pnlPercent)
      .slice(0, limit);
  }

  /**
   * Get portfolio statistics.
   *
   * @param summary Portfolio summary
   * @returns Various portfolio statistics
   */
  getStatistics(summary: PortfolioSummary): {
    holdingsCount: number;
    profitableCount: number;
    losingCount: number;
    averagePnLPercent: number;
    largestPosition: HoldingWithPrice | null;
    smallestPosition: HoldingWithPrice | null;
  } {
    const profitableCount = summary.holdings.filter(h => h.pnl > 0).length;
    const losingCount = summary.holdings.filter(h => h.pnl < 0).length;

    const totalPnLPercent = summary.holdings.reduce((sum, h) => sum + h.pnlPercent, 0);
    const averagePnLPercent = summary.holdings.length > 0
      ? totalPnLPercent / summary.holdings.length
      : 0;

    const sorted = [...summary.holdings].sort((a, b) => b.currentValue - a.currentValue);

    return {
      holdingsCount: summary.holdings.length,
      profitableCount,
      losingCount,
      averagePnLPercent,
      largestPosition: sorted[0] ?? null,
      smallestPosition: sorted[sorted.length - 1] ?? null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get raw state for debugging/API.
   */
  getState(): PortfolioState {
    return { ...this.state };
  }

  /**
   * Get raw snapshots state.
   */
  getSnapshotsState(): SnapshotsState {
    return { ...this.snapshots };
  }

  /**
   * Clear all holdings (use with caution).
   */
  async clearHoldings(): Promise<void> {
    this.state.holdings = [];
    this.state.lastUpdated = new Date().toISOString();
    await this.persist();
    log.warn('All holdings cleared');
  }

  /**
   * Clear all snapshots (use with caution).
   */
  async clearSnapshots(): Promise<void> {
    this.snapshots.snapshots = [];
    this.snapshots.lastUpdated = new Date().toISOString();
    await this.persistSnapshots();
    log.warn('All snapshots cleared');
  }

  /**
   * Check if tracker is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
