/**
 * CRM Interaction Log — SQLite-backed Contact Interaction Tracking
 *
 * Logs all interactions with contacts, including sentiment analysis.
 * Provides history queries, recency lookups, and aggregated statistics.
 *
 * Features:
 *   - Log typed interactions with sentiment scoring
 *   - Query interaction history per contact
 *   - Recent interaction feed across all contacts
 *   - Sentiment distribution analysis
 *
 * Layer: Integrations (CRM)
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('interaction-log');

// ─── Types ──────────────────────────────────────────────────────────────────

export type InteractionType = 'email' | 'call' | 'meeting' | 'telegram' | 'in_person';
export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface Interaction {
  id: string;
  contactId: string;
  type: InteractionType;
  notes: string;
  sentiment: Sentiment;
  sentimentScore: number; // -1.0 to 1.0
  createdAt: string;
}

export interface InteractionStats {
  total: number;
  byType: Record<InteractionType, number>;
  bySentiment: Record<Sentiment, number>;
  avgSentimentScore: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_DB_PATH = path.join(
  process.env.HOME ?? '~',
  '.ari',
  'crm',
  'interactions.db',
);

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS interactions (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL,
    type TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    sentiment TEXT NOT NULL DEFAULT 'neutral',
    sentiment_score REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id);
  CREATE INDEX IF NOT EXISTS idx_interactions_created ON interactions(created_at);
  CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(type);
`;

const SENTIMENT_SCORE_MAP: Record<Sentiment, number> = {
  positive: 0.8,
  neutral: 0.0,
  negative: -0.8,
};

// ─── InteractionLog ─────────────────────────────────────────────────────────

export class InteractionLog {
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? DEFAULT_DB_PATH;
  }

  /**
   * Initialize SQLite database with WAL mode
   */
  init(): void {
    if (this.db) return;

    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(CREATE_TABLE_SQL);
    this.db.exec(CREATE_INDEX_SQL);

    log.info({ dbPath: this.dbPath }, 'Interaction log initialized');
  }

  /**
   * Log a new interaction with a contact
   */
  logInteraction(
    contactId: string,
    type: InteractionType,
    notes: string,
    sentiment: Sentiment = 'neutral',
  ): Interaction {
    this.ensureInit();

    const id = randomUUID();
    const now = new Date().toISOString();
    const sentimentScore = SENTIMENT_SCORE_MAP[sentiment];

    this.db!.prepare(`
      INSERT INTO interactions (id, contact_id, type, notes, sentiment, sentiment_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, contactId, type, notes, sentiment, sentimentScore, now);

    log.info({ interactionId: id, contactId, type, sentiment }, 'Interaction logged');

    return {
      id,
      contactId,
      type,
      notes,
      sentiment,
      sentimentScore,
      createdAt: now,
    };
  }

  /**
   * Get interactions for a specific contact
   */
  getInteractions(contactId: string, limit: number = 50): Interaction[] {
    this.ensureInit();

    const rows = this.db!.prepare(`
      SELECT * FROM interactions
      WHERE contact_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(contactId, limit) as Array<Record<string, unknown>>;

    return rows.map(row => this.rowToInteraction(row));
  }

  /**
   * Get recent interactions across all contacts
   */
  getRecentInteractions(hours: number = 24): Interaction[] {
    this.ensureInit();

    const cutoff = new Date();
    cutoff.setTime(cutoff.getTime() - hours * 60 * 60 * 1000);
    const cutoffStr = cutoff.toISOString();

    const rows = this.db!.prepare(`
      SELECT * FROM interactions
      WHERE created_at > ?
      ORDER BY created_at DESC
    `).all(cutoffStr) as Array<Record<string, unknown>>;

    return rows.map(row => this.rowToInteraction(row));
  }

  /**
   * Get the most recent interaction for a contact
   */
  getLastInteraction(contactId: string): Interaction | null {
    this.ensureInit();

    const row = this.db!.prepare(`
      SELECT * FROM interactions
      WHERE contact_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(contactId) as Record<string, unknown> | undefined;

    return row ? this.rowToInteraction(row) : null;
  }

  /**
   * Get interaction statistics for a contact
   */
  getStats(contactId?: string): InteractionStats {
    this.ensureInit();

    const whereClause = contactId ? 'WHERE contact_id = ?' : '';
    const params = contactId ? [contactId] : [];

    const totalRow = this.db!.prepare(
      `SELECT COUNT(*) as count FROM interactions ${whereClause}`,
    ).get(...params) as { count: number };

    const typeRows = this.db!.prepare(
      `SELECT type, COUNT(*) as count FROM interactions ${whereClause} GROUP BY type`,
    ).all(...params) as Array<{ type: string; count: number }>;

    const sentimentRows = this.db!.prepare(
      `SELECT sentiment, COUNT(*) as count FROM interactions ${whereClause} GROUP BY sentiment`,
    ).all(...params) as Array<{ sentiment: string; count: number }>;

    const avgRow = this.db!.prepare(
      `SELECT AVG(sentiment_score) as avg FROM interactions ${whereClause}`,
    ).get(...params) as { avg: number | null };

    const byType: Record<InteractionType, number> = {
      email: 0,
      call: 0,
      meeting: 0,
      telegram: 0,
      in_person: 0,
    };
    for (const row of typeRows) {
      byType[row.type as InteractionType] = row.count;
    }

    const bySentiment: Record<Sentiment, number> = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };
    for (const row of sentimentRows) {
      bySentiment[row.sentiment as Sentiment] = row.count;
    }

    return {
      total: totalRow.count,
      byType,
      bySentiment,
      avgSentimentScore: Math.round((avgRow.avg ?? 0) * 100) / 100,
    };
  }

  /**
   * Count interactions for a contact within a time range
   */
  countInteractions(contactId: string, sinceDays: number): number {
    this.ensureInit();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - sinceDays);
    const cutoffStr = cutoff.toISOString();

    const row = this.db!.prepare(`
      SELECT COUNT(*) as count FROM interactions
      WHERE contact_id = ? AND created_at > ?
    `).get(contactId, cutoffStr) as { count: number };

    return row.count;
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
      throw new Error('InteractionLog not initialized. Call init() first.');
    }
  }

  private rowToInteraction(row: Record<string, unknown>): Interaction {
    return {
      id: String(row.id),
      contactId: String(row.contact_id),
      type: String(row.type) as InteractionType,
      notes: typeof row.notes === 'string' ? row.notes : '',
      sentiment: String(row.sentiment) as Sentiment,
      sentimentScore: Number(row.sentiment_score ?? 0),
      createdAt: String(row.created_at),
    };
  }
}
