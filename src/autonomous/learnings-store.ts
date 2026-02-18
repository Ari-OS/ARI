/**
 * ARI Learnings Store — Cross-Session Learning Persistence
 *
 * Persists insights and learnings across sessions so ARI builds
 * cumulative intelligence over time. Supports domain-specific
 * storage, confidence scoring, and full-text search.
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

const log = createLogger('learnings-store');

// ─── Types ──────────────────────────────────────────────────────────────────

export type LearningDomain =
  | 'technical'
  | 'personal'
  | 'market'
  | 'social'
  | 'creative';

export interface Learning {
  id: string;
  domain: LearningDomain;
  insight: string;
  confidence: number; // 0.0 to 1.0
  source: string;
  tags: string[];
  appliedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LearningSummary {
  totalLearnings: number;
  byDomain: Record<LearningDomain, number>;
  avgConfidence: number;
  recentCount: number; // last 7 days
  topInsights: Array<{ domain: LearningDomain; insight: string; confidence: number }>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_DB_PATH = path.join(
  process.env.HOME ?? '~',
  '.ari',
  'learnings.db',
);

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS learnings (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    insight TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.5,
    source TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    applied_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_learnings_domain ON learnings(domain);
  CREATE INDEX IF NOT EXISTS idx_learnings_confidence ON learnings(confidence);
  CREATE INDEX IF NOT EXISTS idx_learnings_created ON learnings(created_at);
`;


// ─── LearningsStore ─────────────────────────────────────────────────────────

export class LearningsStore {
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

    log.info({ dbPath: this.dbPath }, 'Learnings store initialized');
  }

  /**
   * Store a new learning or update an existing one with the same insight
   */
  storeLearning(
    domain: LearningDomain,
    insight: string,
    confidence: number = 0.5,
    options?: { source?: string; tags?: string[] },
  ): Learning {
    this.ensureInit();

    const now = new Date().toISOString();
    const source = options?.source ?? '';
    const tags = options?.tags ?? [];

    // Check for duplicate insight in the same domain
    const existing = this.findSimilarLearning(domain, insight);
    if (existing) {
      // Reinforce existing learning
      const newConfidence = Math.min(1.0, Math.max(existing.confidence, confidence) + 0.05);
      const mergedTags = [...new Set([...existing.tags, ...tags])];

      this.db!.prepare(`
        UPDATE learnings
        SET confidence = ?, tags = ?, updated_at = ?, applied_count = applied_count + 1
        WHERE id = ?
      `).run(newConfidence, JSON.stringify(mergedTags), now, existing.id);

      log.debug({ id: existing.id, domain, confidence: newConfidence }, 'Learning reinforced');

      return {
        ...existing,
        confidence: newConfidence,
        tags: mergedTags,
        appliedCount: existing.appliedCount + 1,
        updatedAt: now,
      };
    }

    // Create new learning
    const id = randomUUID();
    const clampedConfidence = Math.max(0, Math.min(1, confidence));

    this.db!.prepare(`
      INSERT INTO learnings (id, domain, insight, confidence, source, tags, applied_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, domain, insight, clampedConfidence, source, JSON.stringify(tags), 0, now, now);

    log.info({ id, domain, confidence: clampedConfidence }, 'Learning stored');

    return {
      id,
      domain,
      insight,
      confidence: clampedConfidence,
      source,
      tags,
      appliedCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get all learnings for a domain, ordered by confidence
   */
  getLearnings(domain: LearningDomain, limit: number = 50): Learning[] {
    this.ensureInit();

    const rows = this.db!.prepare(`
      SELECT * FROM learnings
      WHERE domain = ?
      ORDER BY confidence DESC, applied_count DESC
      LIMIT ?
    `).all(domain, limit) as Array<Record<string, unknown>>;

    return rows.map(row => this.rowToLearning(row));
  }

  /**
   * Search learnings across all domains using text matching
   */
  searchLearnings(query: string, limit: number = 20): Learning[] {
    this.ensureInit();

    const pattern = `%${query}%`;

    const rows = this.db!.prepare(`
      SELECT * FROM learnings
      WHERE insight LIKE ? OR tags LIKE ? OR source LIKE ?
      ORDER BY confidence DESC
      LIMIT ?
    `).all(pattern, pattern, pattern, limit) as Array<Record<string, unknown>>;

    return rows.map(row => this.rowToLearning(row));
  }

  /**
   * Get learnings created or updated in the last N hours
   */
  getRecentLearnings(hours: number = 24): Learning[] {
    this.ensureInit();

    const cutoff = new Date();
    cutoff.setTime(cutoff.getTime() - hours * 60 * 60 * 1000);
    const cutoffStr = cutoff.toISOString();

    const rows = this.db!.prepare(`
      SELECT * FROM learnings
      WHERE updated_at > ?
      ORDER BY updated_at DESC
    `).all(cutoffStr) as Array<Record<string, unknown>>;

    return rows.map(row => this.rowToLearning(row));
  }

  /**
   * Mark a learning as applied (increment counter, boost confidence)
   */
  markApplied(learningId: string): boolean {
    this.ensureInit();

    const result = this.db!.prepare(`
      UPDATE learnings
      SET applied_count = applied_count + 1,
          confidence = MIN(1.0, confidence + 0.02),
          updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), learningId);

    return result.changes > 0;
  }

  /**
   * Get a summary of all learnings
   */
  getSummary(): LearningSummary {
    this.ensureInit();

    const totalRow = this.db!.prepare(
      'SELECT COUNT(*) as count FROM learnings',
    ).get() as { count: number };

    const domainRows = this.db!.prepare(
      'SELECT domain, COUNT(*) as count FROM learnings GROUP BY domain',
    ).all() as Array<{ domain: string; count: number }>;

    const avgRow = this.db!.prepare(
      'SELECT AVG(confidence) as avg FROM learnings',
    ).get() as { avg: number | null };

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentRow = this.db!.prepare(
      'SELECT COUNT(*) as count FROM learnings WHERE created_at > ?',
    ).get(weekAgo.toISOString()) as { count: number };

    const topRows = this.db!.prepare(`
      SELECT domain, insight, confidence FROM learnings
      ORDER BY confidence DESC, applied_count DESC
      LIMIT 5
    `).all() as Array<{ domain: string; insight: string; confidence: number }>;

    const byDomain: Record<LearningDomain, number> = {
      technical: 0,
      personal: 0,
      market: 0,
      social: 0,
      creative: 0,
    };

    for (const row of domainRows) {
      byDomain[row.domain as LearningDomain] = row.count;
    }

    return {
      totalLearnings: totalRow.count,
      byDomain,
      avgConfidence: Math.round((avgRow.avg ?? 0) * 100) / 100,
      recentCount: recentRow.count,
      topInsights: topRows.map(r => ({
        domain: r.domain as LearningDomain,
        insight: r.insight,
        confidence: r.confidence,
      })),
    };
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
      throw new Error('LearningsStore not initialized. Call init() first.');
    }
  }

  private findSimilarLearning(
    domain: LearningDomain,
    insight: string,
  ): Learning | null {
    // Exact match on domain + insight
    const row = this.db!.prepare(
      'SELECT * FROM learnings WHERE domain = ? AND insight = ?',
    ).get(domain, insight) as Record<string, unknown> | undefined;

    return row ? this.rowToLearning(row) : null;
  }

  private rowToLearning(row: Record<string, unknown>): Learning {
    return {
      id: String(row.id),
      domain: String(row.domain) as LearningDomain,
      insight: String(row.insight),
      confidence: Number(row.confidence ?? 0.5),
      source: typeof row.source === 'string' ? row.source : '',
      tags: JSON.parse(typeof row.tags === 'string' ? row.tags : '[]') as string[],
      appliedCount: Number(row.applied_count ?? 0),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }
}
