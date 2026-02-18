/**
 * CRM Store — SQLite-backed Contact Database
 *
 * Persistent contact storage with relationship scoring for Pryceless Solutions.
 * Uses better-sqlite3 with WAL mode for concurrent read performance.
 *
 * Features:
 *   - CRUD operations for contacts
 *   - Full-text search across name, email, company, notes
 *   - Relationship scoring (0-100) with decay over time
 *   - Stale contact detection for follow-up recommendations
 *
 * Usage:
 *   const store = new CRMStore();
 *   store.init();
 *   const contact = store.createContact({ name: 'Jane', category: 'client', ... });
 *   const results = store.searchContacts('Jane');
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('crm-store');

// ─── Types ──────────────────────────────────────────────────────────────────

export type ContactCategory = 'client' | 'prospect' | 'partner' | 'personal' | 'other';

export interface Contact {
  id: string;
  name: string;
  email?: string;
  company?: string;
  phone?: string;
  category: ContactCategory;
  tags: string[];
  notes: string;
  relationshipScore: number;
  lastContactDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CRMStats {
  totalContacts: number;
  byCategory: Record<string, number>;
  staleContacts: number;
  avgRelationshipScore: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_DB_PATH = path.join(
  process.env.HOME ?? '~',
  '.ari',
  'crm',
  'contacts.db',
);

const STALE_THRESHOLD_DAYS = 30;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    company TEXT,
    phone TEXT,
    category TEXT NOT NULL DEFAULT 'other',
    tags TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    relationship_score REAL NOT NULL DEFAULT 50,
    last_contact_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts(category);
  CREATE INDEX IF NOT EXISTS idx_contacts_last_contact ON contacts(last_contact_date);
  CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
`;

// ─── CRMStore ───────────────────────────────────────────────────────────────

export class CRMStore {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? DEFAULT_DB_PATH;
  }

  /**
   * Initialize SQLite database with WAL mode
   */
  init(): void {
    if (this.db) return;

    // Ensure directory exists (skip for in-memory)
    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(CREATE_TABLE_SQL);
    this.db.exec(CREATE_INDEX_SQL);

    log.info({ dbPath: this.dbPath }, 'CRM store initialized');
  }

  /**
   * Create a new contact
   */
  createContact(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Contact {
    this.ensureInit();

    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db!.prepare(`
      INSERT INTO contacts (id, name, email, company, phone, category, tags, notes, relationship_score, last_contact_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      contact.name,
      contact.email ?? null,
      contact.company ?? null,
      contact.phone ?? null,
      contact.category,
      JSON.stringify(contact.tags),
      contact.notes,
      contact.relationshipScore,
      contact.lastContactDate,
      now,
      now,
    );

    log.info({ contactId: id, name: contact.name }, 'Contact created');

    return {
      ...contact,
      id,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get a contact by ID
   */
  getContact(id: string): Contact | null {
    this.ensureInit();

    const row = this.db!.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return this.rowToContact(row);
  }

  /**
   * Search contacts by name, email, company, or notes
   */
  searchContacts(query: string): Contact[] {
    this.ensureInit();

    const pattern = `%${query}%`;
    const rows = this.db!.prepare(`
      SELECT * FROM contacts
      WHERE name LIKE ? OR email LIKE ? OR company LIKE ? OR notes LIKE ?
      ORDER BY relationship_score DESC, last_contact_date DESC
    `).all(pattern, pattern, pattern, pattern) as Array<Record<string, unknown>>;

    return rows.map(row => this.rowToContact(row));
  }

  /**
   * Update a contact
   */
  updateContact(id: string, updates: Partial<Contact>): Contact | null {
    this.ensureInit();

    const existing = this.getContact(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const merged = { ...existing, ...updates, id, updatedAt: now };

    const stmt = this.db!.prepare(`
      UPDATE contacts SET
        name = ?, email = ?, company = ?, phone = ?,
        category = ?, tags = ?, notes = ?,
        relationship_score = ?, last_contact_date = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      merged.name,
      merged.email ?? null,
      merged.company ?? null,
      merged.phone ?? null,
      merged.category,
      JSON.stringify(merged.tags),
      merged.notes,
      merged.relationshipScore,
      merged.lastContactDate,
      now,
      id,
    );

    log.info({ contactId: id }, 'Contact updated');
    return merged;
  }

  /**
   * Delete a contact
   */
  deleteContact(id: string): boolean {
    this.ensureInit();

    const result = this.db!.prepare('DELETE FROM contacts WHERE id = ?').run(id);
    const deleted = result.changes > 0;

    if (deleted) {
      log.info({ contactId: id }, 'Contact deleted');
    }

    return deleted;
  }

  /**
   * Update relationship score based on interaction recency and frequency
   * Score decays by 1 point per day without contact, boosted by interactions
   */
  updateRelationshipScore(contactId: string): number {
    this.ensureInit();

    const contact = this.getContact(contactId);
    if (!contact) return 0;

    const daysSince = this.daysSinceContact(contact.lastContactDate);
    const decay = Math.min(daysSince, 50); // Max 50-point decay
    const newScore = Math.max(0, Math.min(100, contact.relationshipScore - decay));

    this.db!.prepare(
      'UPDATE contacts SET relationship_score = ?, updated_at = ? WHERE id = ?'
    ).run(newScore, new Date().toISOString(), contactId);

    return newScore;
  }

  /**
   * Get contacts that haven't been contacted in N days
   */
  getStaleContacts(daysSinceContact: number = STALE_THRESHOLD_DAYS): Contact[] {
    this.ensureInit();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysSinceContact);
    const cutoffStr = cutoff.toISOString();

    const rows = this.db!.prepare(`
      SELECT * FROM contacts
      WHERE last_contact_date < ?
      ORDER BY relationship_score DESC
    `).all(cutoffStr) as Array<Record<string, unknown>>;

    return rows.map(row => this.rowToContact(row));
  }

  /**
   * Get CRM statistics
   */
  getStats(): CRMStats {
    this.ensureInit();

    const totalRow = this.db!.prepare('SELECT COUNT(*) as count FROM contacts').get() as { count: number };
    const totalContacts = totalRow.count;

    const categoryRows = this.db!.prepare(
      'SELECT category, COUNT(*) as count FROM contacts GROUP BY category'
    ).all() as Array<{ category: string; count: number }>;

    const byCategory: Record<string, number> = {};
    for (const row of categoryRows) {
      byCategory[row.category] = row.count;
    }

    const staleContacts = this.getStaleContacts().length;

    const avgRow = this.db!.prepare(
      'SELECT AVG(relationship_score) as avg FROM contacts'
    ).get() as { avg: number | null };

    const avgRelationshipScore = Math.round((avgRow.avg ?? 0) * 100) / 100;

    return {
      totalContacts,
      byCategory,
      staleContacts,
      avgRelationshipScore,
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
      throw new Error('CRMStore not initialized. Call init() first.');
    }
  }

  private rowToContact(row: Record<string, unknown>): Contact {
    return {
      id: String(row.id),
      name: String(row.name),
      email: typeof row.email === 'string' ? row.email : undefined,
      company: typeof row.company === 'string' ? row.company : undefined,
      phone: typeof row.phone === 'string' ? row.phone : undefined,
      category: String(row.category) as ContactCategory,
      tags: JSON.parse(typeof row.tags === 'string' ? row.tags : '[]') as string[],
      notes: typeof row.notes === 'string' ? row.notes : '',
      relationshipScore: Number(row.relationship_score ?? 50),
      lastContactDate: String(row.last_contact_date),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private daysSinceContact(lastContactDate: string): number {
    const last = new Date(lastContactDate);
    const now = new Date();
    const diffMs = now.getTime() - last.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
}
