/**
 * Model Usage Dashboard — Cost Breakdown by Model & Task Category
 *
 * Tracks AI model usage across task categories for cost optimization.
 * Provides daily reports, model breakdowns, and category analysis
 * to identify top cost drivers and optimization opportunities.
 *
 * Uses SQLite for persistence with WAL mode.
 *
 * Layer: Observability
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('model-usage-dashboard');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UsageRecord {
  id: string;
  model: string;
  category: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: string;
}

export interface DailyReport {
  date: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgCostPerRequest: number;
  modelBreakdown: Array<{
    model: string;
    requests: number;
    tokens: number;
    cost: number;
    percentage: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    requests: number;
    tokens: number;
    cost: number;
    percentage: number;
  }>;
}

export interface ModelBreakdown {
  model: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgTokensPerRequest: number;
  avgCostPerRequest: number;
  topCategories: Array<{ category: string; cost: number; requests: number }>;
}

export interface CategoryBreakdown {
  category: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgCostPerRequest: number;
  topModels: Array<{ model: string; cost: number; requests: number }>;
}

export interface CostDriver {
  model: string;
  category: string;
  totalCost: number;
  requests: number;
  avgCostPerRequest: number;
  percentOfTotal: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_DB_PATH = path.join(
  process.env.HOME ?? '~',
  '.ari',
  'model-usage.db',
);

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS usage_records (
    id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    category TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0.0,
    timestamp TEXT NOT NULL,
    date TEXT NOT NULL
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_records(date);
  CREATE INDEX IF NOT EXISTS idx_usage_model ON usage_records(model);
  CREATE INDEX IF NOT EXISTS idx_usage_category ON usage_records(category);
  CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_records(timestamp);
`;

// ─── ModelUsageDashboard ────────────────────────────────────────────────────

export class ModelUsageDashboard {
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? DEFAULT_DB_PATH;
  }

  /**
   * Initialize SQLite database
   */
  init(): void {
    if (this.db) return;

    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(CREATE_TABLE_SQL);
    this.db.exec(CREATE_INDEX_SQL);

    log.info({ dbPath: this.dbPath }, 'Model usage dashboard initialized');
  }

  /**
   * Record a model usage entry
   */
  recordUsage(
    model: string,
    category: string,
    tokens: { input: number; output: number },
    cost: number,
  ): UsageRecord {
    this.ensureInit();

    const id = randomUUID();
    const now = new Date().toISOString();
    const date = now.split('T')[0];
    const totalTokens = tokens.input + tokens.output;

    this.db!.prepare(`
      INSERT INTO usage_records (id, model, category, input_tokens, output_tokens, total_tokens, cost, timestamp, date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, model, category, tokens.input, tokens.output, totalTokens, cost, now, date);

    log.debug({ model, category, totalTokens, cost }, 'Usage recorded');

    return {
      id,
      model,
      category,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      totalTokens,
      cost,
      timestamp: now,
    };
  }

  /**
   * Get a daily report for a specific date
   */
  getDailyReport(date?: string): DailyReport {
    this.ensureInit();

    const targetDate = date ?? new Date().toISOString().split('T')[0];

    // Total stats
    const totals = this.db!.prepare(`
      SELECT COUNT(*) as requests, COALESCE(SUM(total_tokens), 0) as tokens, COALESCE(SUM(cost), 0) as cost
      FROM usage_records WHERE date = ?
    `).get(targetDate) as { requests: number; tokens: number; cost: number };

    // Model breakdown
    const modelRows = this.db!.prepare(`
      SELECT model, COUNT(*) as requests, SUM(total_tokens) as tokens, SUM(cost) as cost
      FROM usage_records WHERE date = ?
      GROUP BY model ORDER BY cost DESC
    `).all(targetDate) as Array<{ model: string; requests: number; tokens: number; cost: number }>;

    const modelBreakdown = modelRows.map(r => ({
      model: r.model,
      requests: r.requests,
      tokens: r.tokens,
      cost: Math.round(r.cost * 10000) / 10000,
      percentage: totals.cost > 0 ? Math.round((r.cost / totals.cost) * 100) : 0,
    }));

    // Category breakdown
    const categoryRows = this.db!.prepare(`
      SELECT category, COUNT(*) as requests, SUM(total_tokens) as tokens, SUM(cost) as cost
      FROM usage_records WHERE date = ?
      GROUP BY category ORDER BY cost DESC
    `).all(targetDate) as Array<{ category: string; requests: number; tokens: number; cost: number }>;

    const categoryBreakdown = categoryRows.map(r => ({
      category: r.category,
      requests: r.requests,
      tokens: r.tokens,
      cost: Math.round(r.cost * 10000) / 10000,
      percentage: totals.cost > 0 ? Math.round((r.cost / totals.cost) * 100) : 0,
    }));

    return {
      date: targetDate,
      totalRequests: totals.requests,
      totalTokens: totals.tokens,
      totalCost: Math.round(totals.cost * 10000) / 10000,
      avgCostPerRequest: totals.requests > 0
        ? Math.round((totals.cost / totals.requests) * 10000) / 10000
        : 0,
      modelBreakdown,
      categoryBreakdown,
    };
  }

  /**
   * Get detailed breakdown for a specific model
   */
  getModelBreakdown(model?: string): ModelBreakdown[] {
    this.ensureInit();

    const whereClause = model ? 'WHERE model = ?' : '';
    const params = model ? [model] : [];

    const rows = this.db!.prepare(`
      SELECT model,
        COUNT(*) as requests,
        SUM(total_tokens) as tokens,
        SUM(cost) as cost
      FROM usage_records ${whereClause}
      GROUP BY model
      ORDER BY cost DESC
    `).all(...params) as Array<{ model: string; requests: number; tokens: number; cost: number }>;

    return rows.map(r => {
      // Get top categories for this model
      const catRows = this.db!.prepare(`
        SELECT category, SUM(cost) as cost, COUNT(*) as requests
        FROM usage_records WHERE model = ?
        GROUP BY category ORDER BY cost DESC LIMIT 5
      `).all(r.model) as Array<{ category: string; cost: number; requests: number }>;

      return {
        model: r.model,
        totalRequests: r.requests,
        totalTokens: r.tokens,
        totalCost: Math.round(r.cost * 10000) / 10000,
        avgTokensPerRequest: r.requests > 0 ? Math.round(r.tokens / r.requests) : 0,
        avgCostPerRequest: r.requests > 0
          ? Math.round((r.cost / r.requests) * 10000) / 10000
          : 0,
        topCategories: catRows.map(c => ({
          category: c.category,
          cost: Math.round(c.cost * 10000) / 10000,
          requests: c.requests,
        })),
      };
    });
  }

  /**
   * Get detailed breakdown by task category
   */
  getCategoryBreakdown(category?: string): CategoryBreakdown[] {
    this.ensureInit();

    const whereClause = category ? 'WHERE category = ?' : '';
    const params = category ? [category] : [];

    const rows = this.db!.prepare(`
      SELECT category,
        COUNT(*) as requests,
        SUM(total_tokens) as tokens,
        SUM(cost) as cost
      FROM usage_records ${whereClause}
      GROUP BY category
      ORDER BY cost DESC
    `).all(...params) as Array<{ category: string; requests: number; tokens: number; cost: number }>;

    return rows.map(r => {
      const modelRows = this.db!.prepare(`
        SELECT model, SUM(cost) as cost, COUNT(*) as requests
        FROM usage_records WHERE category = ?
        GROUP BY model ORDER BY cost DESC LIMIT 5
      `).all(r.category) as Array<{ model: string; cost: number; requests: number }>;

      return {
        category: r.category,
        totalRequests: r.requests,
        totalTokens: r.tokens,
        totalCost: Math.round(r.cost * 10000) / 10000,
        avgCostPerRequest: r.requests > 0
          ? Math.round((r.cost / r.requests) * 10000) / 10000
          : 0,
        topModels: modelRows.map(m => ({
          model: m.model,
          cost: Math.round(m.cost * 10000) / 10000,
          requests: m.requests,
        })),
      };
    });
  }

  /**
   * Get the top cost drivers (model+category combinations)
   */
  getTopCostDrivers(limit: number = 10): CostDriver[] {
    this.ensureInit();

    const totalCostRow = this.db!.prepare(
      'SELECT COALESCE(SUM(cost), 0) as total FROM usage_records',
    ).get() as { total: number };

    const rows = this.db!.prepare(`
      SELECT model, category,
        SUM(cost) as total_cost,
        COUNT(*) as requests,
        AVG(cost) as avg_cost
      FROM usage_records
      GROUP BY model, category
      ORDER BY total_cost DESC
      LIMIT ?
    `).all(limit) as Array<{
      model: string;
      category: string;
      total_cost: number;
      requests: number;
      avg_cost: number;
    }>;

    return rows.map(r => ({
      model: r.model,
      category: r.category,
      totalCost: Math.round(r.total_cost * 10000) / 10000,
      requests: r.requests,
      avgCostPerRequest: Math.round(r.avg_cost * 10000) / 10000,
      percentOfTotal: totalCostRow.total > 0
        ? Math.round((r.total_cost / totalCostRow.total) * 100)
        : 0,
    }));
  }

  /**
   * Get total cost for a date range
   */
  getTotalCost(startDate: string, endDate: string): number {
    this.ensureInit();

    const row = this.db!.prepare(`
      SELECT COALESCE(SUM(cost), 0) as total
      FROM usage_records
      WHERE date >= ? AND date <= ?
    `).get(startDate, endDate) as { total: number };

    return Math.round(row.total * 10000) / 10000;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private ensureInit(): void {
    if (!this.db) {
      throw new Error('ModelUsageDashboard not initialized. Call init() first.');
    }
  }
}
