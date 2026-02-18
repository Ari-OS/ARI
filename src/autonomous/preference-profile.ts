/**
 * ARI Preference Profile — User Pattern & Preference Tracking
 *
 * Tracks and persists user preferences across interactions.
 * Learns communication patterns, scheduling preferences, content
 * interests, market focus areas, and social behaviors.
 *
 * Uses SQLite for persistence with WAL mode for concurrent reads.
 *
 * Layer: L5 (Autonomous Operations)
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('preference-profile');

// ─── Types ──────────────────────────────────────────────────────────────────

export type PreferenceCategory =
  | 'communication'
  | 'schedule'
  | 'content'
  | 'market'
  | 'social';

export interface Preference {
  id: string;
  category: PreferenceCategory;
  key: string;
  value: string;
  confidence: number; // 0.0 to 1.0
  frequency: number;  // how many times this preference has been observed
  lastObserved: string;
  createdAt: string;
}

export interface PreferenceProfile {
  categories: Record<PreferenceCategory, Array<{ key: string; value: string; confidence: number }>>;
  totalPreferences: number;
  lastUpdated: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_DB_PATH = path.join(
  process.env.HOME ?? '~',
  '.ari',
  'preferences.db',
);

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS preferences (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.5,
    frequency INTEGER NOT NULL DEFAULT 1,
    last_observed TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(category, key)
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_preferences_category ON preferences(category);
  CREATE INDEX IF NOT EXISTS idx_preferences_confidence ON preferences(confidence);
  CREATE INDEX IF NOT EXISTS idx_preferences_last_observed ON preferences(last_observed);
`;

const ALL_CATEGORIES: PreferenceCategory[] = [
  'communication',
  'schedule',
  'content',
  'market',
  'social',
];

// ─── PreferenceProfile ──────────────────────────────────────────────────────

export class PreferenceProfileStore {
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

    log.info({ dbPath: this.dbPath }, 'Preference profile initialized');
  }

  /**
   * Record or update a preference.
   * If the category+key combination exists, updates value, boosts confidence and frequency.
   */
  recordPreference(
    category: PreferenceCategory,
    key: string,
    value: string,
  ): Preference {
    this.ensureInit();

    const now = new Date().toISOString();
    const existing = this.findPreference(category, key);

    if (existing) {
      // Update existing preference: boost confidence, increment frequency
      const newFrequency = existing.frequency + 1;
      const newConfidence = Math.min(1.0, existing.confidence + 0.05);

      this.db!.prepare(`
        UPDATE preferences
        SET value = ?, confidence = ?, frequency = ?, last_observed = ?
        WHERE category = ? AND key = ?
      `).run(value, newConfidence, newFrequency, now, category, key);

      log.debug({ category, key, confidence: newConfidence }, 'Preference updated');

      return {
        ...existing,
        value,
        confidence: newConfidence,
        frequency: newFrequency,
        lastObserved: now,
      };
    }

    // Create new preference
    const id = randomUUID();
    const confidence = 0.5;

    this.db!.prepare(`
      INSERT INTO preferences (id, category, key, value, confidence, frequency, last_observed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, category, key, value, confidence, 1, now, now);

    log.info({ category, key }, 'New preference recorded');

    return {
      id,
      category,
      key,
      value,
      confidence,
      frequency: 1,
      lastObserved: now,
      createdAt: now,
    };
  }

  /**
   * Get a specific preference value
   */
  getPreference(category: PreferenceCategory, key: string): Preference | null {
    this.ensureInit();
    return this.findPreference(category, key);
  }

  /**
   * Get the full user profile across all categories
   */
  getProfile(): PreferenceProfile {
    this.ensureInit();

    const categories: PreferenceProfile['categories'] = {
      communication: [],
      schedule: [],
      content: [],
      market: [],
      social: [],
    };

    let totalPreferences = 0;
    let lastUpdated = '';

    for (const category of ALL_CATEGORIES) {
      const rows = this.db!.prepare(`
        SELECT key, value, confidence, last_observed FROM preferences
        WHERE category = ?
        ORDER BY confidence DESC
      `).all(category) as Array<{
        key: string;
        value: string;
        confidence: number;
        last_observed: string;
      }>;

      categories[category] = rows.map(r => ({
        key: r.key,
        value: r.value,
        confidence: r.confidence,
      }));

      totalPreferences += rows.length;

      for (const row of rows) {
        if (row.last_observed > lastUpdated) {
          lastUpdated = row.last_observed;
        }
      }
    }

    return {
      categories,
      totalPreferences,
      lastUpdated: lastUpdated || new Date().toISOString(),
    };
  }

  /**
   * Get the top N preferences for a category, ordered by confidence
   */
  topPreferences(
    category: PreferenceCategory,
    limit: number = 10,
  ): Preference[] {
    this.ensureInit();

    const rows = this.db!.prepare(`
      SELECT * FROM preferences
      WHERE category = ?
      ORDER BY confidence DESC, frequency DESC
      LIMIT ?
    `).all(category, limit) as Array<Record<string, unknown>>;

    return rows.map(row => this.rowToPreference(row));
  }

  /**
   * Get all preferences for a category
   */
  getCategoryPreferences(category: PreferenceCategory): Preference[] {
    this.ensureInit();

    const rows = this.db!.prepare(`
      SELECT * FROM preferences
      WHERE category = ?
      ORDER BY confidence DESC
    `).all(category) as Array<Record<string, unknown>>;

    return rows.map(row => this.rowToPreference(row));
  }

  /**
   * Decay confidence for stale preferences (not observed in N days)
   */
  decayStalePreferences(staleDays: number = 30, decayRate: number = 0.05): number {
    this.ensureInit();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - staleDays);
    const cutoffStr = cutoff.toISOString();

    const result = this.db!.prepare(`
      UPDATE preferences
      SET confidence = MAX(0.1, confidence - ?)
      WHERE last_observed < ? AND confidence > 0.1
    `).run(decayRate, cutoffStr);

    const affected = result.changes;
    if (affected > 0) {
      log.info({ affected, staleDays, decayRate }, 'Decayed stale preferences');
    }

    return affected;
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
      throw new Error('PreferenceProfileStore not initialized. Call init() first.');
    }
  }

  private findPreference(
    category: PreferenceCategory,
    key: string,
  ): Preference | null {
    const row = this.db!.prepare(
      'SELECT * FROM preferences WHERE category = ? AND key = ?',
    ).get(category, key) as Record<string, unknown> | undefined;

    return row ? this.rowToPreference(row) : null;
  }

  private rowToPreference(row: Record<string, unknown>): Preference {
    return {
      id: String(row.id),
      category: String(row.category) as PreferenceCategory,
      key: String(row.key),
      value: String(row.value),
      confidence: Number(row.confidence ?? 0.5),
      frequency: Number(row.frequency ?? 1),
      lastObserved: String(row.last_observed),
      createdAt: String(row.created_at),
    };
  }
}
