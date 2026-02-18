/**
 * ARI Time Audit — Daily Time Block Tracking for Human 3.0
 *
 * Tracks how time is spent across key categories to optimize
 * productivity and maintain life balance. Supports daily/weekly
 * summaries and productivity scoring.
 *
 * Categories follow the Human 3.0 framework: deep work, meetings,
 * admin, learning, health, social, rest.
 *
 * Uses SQLite for persistence with WAL mode.
 *
 * Layer: L5 (Autonomous Operations)
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('time-audit');

// ─── Types ──────────────────────────────────────────────────────────────────

export type TimeCategory =
  | 'deep_work'
  | 'meetings'
  | 'admin'
  | 'learning'
  | 'health'
  | 'social'
  | 'rest';

export interface TimeBlock {
  id: string;
  category: TimeCategory;
  duration: number;   // minutes
  description: string;
  date: string;       // YYYY-MM-DD
  createdAt: string;
}

export interface DailySummary {
  date: string;
  totalMinutes: number;
  byCategory: Record<TimeCategory, number>;
  topCategory: TimeCategory;
  productivityScore: number; // 0-100
  blockCount: number;
}

export interface WeeklySummary {
  startDate: string;
  endDate: string;
  totalMinutes: number;
  dailyAverage: number;
  byCategory: Record<TimeCategory, number>;
  categoryPercentages: Record<TimeCategory, number>;
  productivityScore: number;
  trend: 'improving' | 'stable' | 'declining';
  insights: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_DB_PATH = path.join(
  process.env.HOME ?? '~',
  '.ari',
  'time-audit.db',
);

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS time_blocks (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    duration INTEGER NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_time_blocks_date ON time_blocks(date);
  CREATE INDEX IF NOT EXISTS idx_time_blocks_category ON time_blocks(category);
`;

const ALL_CATEGORIES: TimeCategory[] = [
  'deep_work',
  'meetings',
  'admin',
  'learning',
  'health',
  'social',
  'rest',
];

/** Productivity weights per category (higher = more productive) */
const PRODUCTIVITY_WEIGHTS: Record<TimeCategory, number> = {
  deep_work: 1.0,
  learning: 0.8,
  meetings: 0.5,
  admin: 0.3,
  health: 0.7,
  social: 0.4,
  rest: 0.2,
};


// ─── TimeAudit ──────────────────────────────────────────────────────────────

export class TimeAudit {
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

    log.info({ dbPath: this.dbPath }, 'Time audit initialized');
  }

  /**
   * Log a time block
   */
  logBlock(
    category: TimeCategory,
    duration: number,
    description: string = '',
    date?: string,
  ): TimeBlock {
    this.ensureInit();

    const id = randomUUID();
    const blockDate = date ?? new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    this.db!.prepare(`
      INSERT INTO time_blocks (id, category, duration, description, date, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, category, Math.max(0, Math.round(duration)), description, blockDate, now);

    log.debug({ category, duration, date: blockDate }, 'Time block logged');

    return {
      id,
      category,
      duration: Math.max(0, Math.round(duration)),
      description,
      date: blockDate,
      createdAt: now,
    };
  }

  /**
   * Get a daily summary for a specific date
   */
  getDailySummary(date?: string): DailySummary {
    this.ensureInit();

    const targetDate = date ?? new Date().toISOString().split('T')[0];

    const rows = this.db!.prepare(`
      SELECT category, SUM(duration) as total
      FROM time_blocks
      WHERE date = ?
      GROUP BY category
    `).all(targetDate) as Array<{ category: string; total: number }>;

    const byCategory = this.buildCategoryMap();
    let totalMinutes = 0;
    let topCategory: TimeCategory = 'rest';
    let topMinutes = 0;

    for (const row of rows) {
      const cat = row.category as TimeCategory;
      byCategory[cat] = row.total;
      totalMinutes += row.total;
      if (row.total > topMinutes) {
        topMinutes = row.total;
        topCategory = cat;
      }
    }

    const blockCountRow = this.db!.prepare(
      'SELECT COUNT(*) as count FROM time_blocks WHERE date = ?',
    ).get(targetDate) as { count: number };

    const productivityScore = this.calculateProductivityScore(byCategory, totalMinutes);

    return {
      date: targetDate,
      totalMinutes,
      byCategory,
      topCategory,
      productivityScore,
      blockCount: blockCountRow.count,
    };
  }

  /**
   * Get a weekly summary (last 7 days from the given date)
   */
  getWeeklySummary(endDate?: string): WeeklySummary {
    this.ensureInit();

    const end = endDate ?? new Date().toISOString().split('T')[0];
    const startDateObj = new Date(end);
    startDateObj.setDate(startDateObj.getDate() - 6);
    const start = startDateObj.toISOString().split('T')[0];

    const rows = this.db!.prepare(`
      SELECT category, SUM(duration) as total
      FROM time_blocks
      WHERE date >= ? AND date <= ?
      GROUP BY category
    `).all(start, end) as Array<{ category: string; total: number }>;

    const byCategory = this.buildCategoryMap();
    let totalMinutes = 0;

    for (const row of rows) {
      byCategory[row.category as TimeCategory] = row.total;
      totalMinutes += row.total;
    }

    // Calculate percentages
    const categoryPercentages = this.buildCategoryMap();
    if (totalMinutes > 0) {
      for (const cat of ALL_CATEGORIES) {
        categoryPercentages[cat] = Math.round((byCategory[cat] / totalMinutes) * 100);
      }
    }

    // Get daily scores for trend analysis
    const dailyScores: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const summary = this.getDailySummary(ds);
      if (summary.totalMinutes > 0) {
        dailyScores.push(summary.productivityScore);
      }
    }

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (dailyScores.length >= 3) {
      const firstHalf = dailyScores.slice(Math.floor(dailyScores.length / 2));
      const secondHalf = dailyScores.slice(0, Math.floor(dailyScores.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.length > 0
        ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
        : firstAvg;

      if (secondAvg > firstAvg + 5) trend = 'improving';
      else if (secondAvg < firstAvg - 5) trend = 'declining';
    }

    // Generate insights
    const insights = this.generateInsights(byCategory, totalMinutes);

    const productivityScore = this.calculateProductivityScore(
      byCategory,
      totalMinutes / 7,
    );

    return {
      startDate: start,
      endDate: end,
      totalMinutes,
      dailyAverage: Math.round(totalMinutes / 7),
      byCategory,
      categoryPercentages,
      productivityScore,
      trend,
      insights,
    };
  }

  /**
   * Get a productivity score for today
   */
  getProductivityScore(date?: string): number {
    const summary = this.getDailySummary(date);
    return summary.productivityScore;
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
      throw new Error('TimeAudit not initialized. Call init() first.');
    }
  }

  private buildCategoryMap(): Record<TimeCategory, number> {
    const map: Record<TimeCategory, number> = {
      deep_work: 0,
      meetings: 0,
      admin: 0,
      learning: 0,
      health: 0,
      social: 0,
      rest: 0,
    };
    return map;
  }

  private calculateProductivityScore(
    byCategory: Record<TimeCategory, number>,
    totalMinutes: number,
  ): number {
    if (totalMinutes === 0) return 0;

    // Weighted score based on category productivity weights
    let weightedSum = 0;
    for (const cat of ALL_CATEGORIES) {
      weightedSum += byCategory[cat] * PRODUCTIVITY_WEIGHTS[cat];
    }
    const weightedScore = (weightedSum / totalMinutes) * 60; // normalize to 0-60

    // Balance bonus: reward having at least 3 active categories
    const activeCategories = ALL_CATEGORIES.filter(c => byCategory[c] > 0).length;
    const balanceBonus = Math.min(20, activeCategories * (20 / 5));

    // Deep work bonus: reward sustained deep work
    const deepWorkHours = byCategory.deep_work / 60;
    const deepWorkBonus = Math.min(20, deepWorkHours * 5);

    const score = Math.min(100, Math.round(weightedScore + balanceBonus + deepWorkBonus));
    return score;
  }

  private generateInsights(
    byCategory: Record<TimeCategory, number>,
    totalMinutes: number,
  ): string[] {
    const insights: string[] = [];

    if (totalMinutes === 0) {
      insights.push('No time blocks logged this week.');
      return insights;
    }

    // Check deep work ratio
    const deepWorkPct = (byCategory.deep_work / totalMinutes) * 100;
    if (deepWorkPct < 20) {
      insights.push('Deep work is below 20% of tracked time. Consider blocking focused work sessions.');
    } else if (deepWorkPct > 40) {
      insights.push('Strong deep work focus this week.');
    }

    // Check health
    const healthPct = (byCategory.health / totalMinutes) * 100;
    if (healthPct < 5) {
      insights.push('Health activities are minimal. Prioritize exercise and movement.');
    }

    // Check for meeting overload
    const meetingPct = (byCategory.meetings / totalMinutes) * 100;
    if (meetingPct > 30) {
      insights.push('Meetings are consuming over 30% of your time. Consider declining or shortening non-essential meetings.');
    }

    // Check balance
    const zeroCats = ALL_CATEGORIES.filter(c => byCategory[c] === 0);
    if (zeroCats.length >= 3) {
      insights.push(`Missing activity in ${zeroCats.length} categories: ${zeroCats.join(', ')}.`);
    }

    // Check admin overhead
    if (byCategory.admin > byCategory.deep_work && byCategory.deep_work > 0) {
      insights.push('Admin time exceeds deep work. Consider automating or delegating admin tasks.');
    }

    return insights;
  }
}
