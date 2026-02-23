/**
 * CronStateEnvelope — Cross-Cron State Persistence
 *
 * Solves "cron amnesia": when the intelligence-scan (06:00) computes
 * a digest and the process restarts before morning-briefing (07:00),
 * all in-memory state is lost. This module persists the scan payload
 * to SQLite WAL so the briefing can recover it even after restart.
 *
 * Schema: one row per logical cron window (e.g. "morning-briefing-2026-02-23").
 * Rows expire after 4 hours; a daily cleanup task removes stale entries.
 *
 * Layer: L5 (Autonomous Operations)
 */

import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { createLogger } from '../kernel/logger.js';

const log = createLogger('cron-state-envelope');

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_DB_PATH = path.join(
  process.env.HOME ?? '~',
  '.ari',
  'databases',
  'cron-state.db',
);

/** Envelopes expire after 4 hours (producer → consumer window). */
const ENVELOPE_TTL_MS = 4 * 60 * 60 * 1000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CronEnvelopeRecord {
  windowKey: string;
  producerTaskId: string;
  schemaVersion: number;
  payloadJson: string;
  payloadSha256: string;
  createdAt: number;
  expiresAt: number;
  consumedAt: number | null;
  consumedBy: string | null;
}

// ─── CronStateEnvelope ───────────────────────────────────────────────────────

export class CronStateEnvelope {
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? DEFAULT_DB_PATH;
  }

  /**
   * Initialize (idempotent). Creates the database and tables if needed.
   */
  init(): void {
    if (this.db) return;

    const dir = path.dirname(this.dbPath);
    mkdirSync(dir, { recursive: true });

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');

    // Create table
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS cron_state_envelopes (
        window_key        TEXT NOT NULL UNIQUE,
        producer_task_id  TEXT NOT NULL,
        schema_version    INTEGER NOT NULL DEFAULT 1,
        payload_json      TEXT NOT NULL,
        payload_sha256    TEXT NOT NULL,
        created_at        INTEGER NOT NULL,
        expires_at        INTEGER NOT NULL,
        consumed_at       INTEGER,
        consumed_by       TEXT
      )
    `).run();

    // Create indexes
    this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_envelope_window_key
        ON cron_state_envelopes(window_key)
    `).run();
    this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_envelope_expires_at
        ON cron_state_envelopes(expires_at)
    `).run();

    log.info({ dbPath: this.dbPath }, 'CronStateEnvelope initialized');
  }

  /**
   * Write (or overwrite) an envelope for the given window key.
   * The payload is any JSON-serializable value; a SHA-256 hash is
   * computed for integrity verification on read.
   */
  write(
    windowKey: string,
    producerTaskId: string,
    payload: unknown,
    options?: { schemaVersion?: number },
  ): void {
    this.ensureInit();

    const payloadJson = JSON.stringify(payload);
    const payloadSha256 = createHash('sha256').update(payloadJson).digest('hex');
    const now = Date.now();

    this.db!.prepare(`
      INSERT OR REPLACE INTO cron_state_envelopes
        (window_key, producer_task_id, schema_version, payload_json, payload_sha256,
         created_at, expires_at, consumed_at, consumed_by)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
    `).run(
      windowKey,
      producerTaskId,
      options?.schemaVersion ?? 1,
      payloadJson,
      payloadSha256,
      now,
      now + ENVELOPE_TTL_MS,
    );

    log.info({ windowKey, producerTaskId, payloadBytes: payloadJson.length }, 'Envelope written');
  }

  /**
   * Read an envelope by window key.
   *
   * Returns null when:
   * - No row found for the key
   * - Row has expired (expiresAt < now)
   * - SHA-256 integrity check fails
   *
   * Marks the envelope as consumed on successful read.
   */
  read<T = unknown>(windowKey: string, consumedBy: string): T | null {
    this.ensureInit();

    const row = this.db!.prepare(`
      SELECT * FROM cron_state_envelopes
      WHERE window_key = ?
    `).get(windowKey) as {
      window_key: string;
      producer_task_id: string;
      schema_version: number;
      payload_json: string;
      payload_sha256: string;
      created_at: number;
      expires_at: number;
      consumed_at: number | null;
      consumed_by: string | null;
    } | undefined;

    if (!row) {
      log.warn({ windowKey }, 'Envelope not found — degraded state');
      return null;
    }

    const now = Date.now();
    if (row.expires_at < now) {
      log.warn({ windowKey, expiredMs: now - row.expires_at }, 'Envelope expired — degraded state');
      return null;
    }

    // Integrity check
    const computed = createHash('sha256').update(row.payload_json).digest('hex');
    if (computed !== row.payload_sha256) {
      log.error({ windowKey }, 'Envelope SHA-256 mismatch — payload corrupted, rejecting');
      return null;
    }

    // Mark consumed
    this.db!.prepare(`
      UPDATE cron_state_envelopes
      SET consumed_at = ?, consumed_by = ?
      WHERE window_key = ?
    `).run(now, consumedBy, windowKey);

    log.info({ windowKey, consumedBy }, 'Envelope consumed');
    return JSON.parse(row.payload_json) as T;
  }

  /**
   * Delete all expired envelopes. Run daily at 03:30 ET.
   * Returns the count of deleted rows.
   */
  cleanup(): number {
    this.ensureInit();

    const result = this.db!.prepare(`
      DELETE FROM cron_state_envelopes WHERE expires_at < ?
    `).run(Date.now());

    const deleted = Number(result.changes);
    if (deleted > 0) {
      log.info({ deleted }, 'Expired envelopes cleaned up');
    }
    return deleted;
  }

  /**
   * Close the database connection.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private ensureInit(): void {
    if (!this.db) this.init();
  }
}
