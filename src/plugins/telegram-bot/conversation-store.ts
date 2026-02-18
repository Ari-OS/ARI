import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import Database from 'better-sqlite3';

const DB_DIR = join(homedir(), '.ari', 'data');
const DB_PATH = join(DB_DIR, 'conversations.db');

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const MAX_MESSAGES = 50;

export interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  intent?: string;
  emotion?: string;
}

// ─── SQLite row shapes ────────────────────────────────────────────────────────

interface SessionRow {
  chat_id: number;
  messages_json: string;
  last_activity: number;
  topic_summary: string | null;
}

interface ConversationState {
  messages: ConversationEntry[];
  lastActivity: number;
  topicSummary?: string;
}

// ─── Database singleton ───────────────────────────────────────────────────────

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);

  // WAL mode: required for concurrent reads during daemon operation
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      chat_id      INTEGER PRIMARY KEY,
      messages_json TEXT    NOT NULL DEFAULT '[]',
      last_activity INTEGER NOT NULL DEFAULT 0,
      topic_summary TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_last_activity
      ON conversations(last_activity);
  `);

  _db = db;
  return db;
}

// ─── ConversationStore ────────────────────────────────────────────────────────

export class ConversationStore {
  private cache: Map<number, ConversationState> = new Map();

  constructor() {
    // Eagerly initialise DB on construction
    getDb();
  }

  addUserMessage(chatId: number, content: string, intent?: string): Promise<ConversationEntry[]> {
    const entry: ConversationEntry = {
      role: 'user',
      content,
      timestamp: Date.now(),
      intent,
    };
    this.addMessage(chatId, entry);
    const state = this.getState(chatId);
    return Promise.resolve([...state.messages]);
  }

  addAssistantMessage(chatId: number, content: string, emotion?: string): Promise<void> {
    const entry: ConversationEntry = {
      role: 'assistant',
      content,
      timestamp: Date.now(),
      emotion,
    };
    this.addMessage(chatId, entry);
    return Promise.resolve();
  }

  getHistory(chatId: number): Promise<ConversationEntry[]> {
    const state = this.getState(chatId);
    return Promise.resolve([...state.messages]);
  }

  clearSession(chatId: number): void {
    this.cache.delete(chatId);
    const db = getDb();
    db.prepare('DELETE FROM conversations WHERE chat_id = ?').run(chatId);
  }

  shutdown(): Promise<void> {
    this.flushAll();
    if (_db) {
      _db.close();
      _db = null;
    }
    return Promise.resolve();
  }

  getSessionCount(): number {
    const db = getDb();
    const row = db.prepare<[number], { count: number }>(
      'SELECT COUNT(*) as count FROM conversations WHERE last_activity > ?'
    ).get(Date.now() - SESSION_TTL);
    return row?.count ?? 0;
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private addMessage(chatId: number, entry: ConversationEntry): void {
    const state = this.getState(chatId);

    state.messages.push(entry);
    state.lastActivity = Date.now();

    if (state.messages.length > MAX_MESSAGES) {
      state.messages = state.messages.slice(-MAX_MESSAGES);
    }

    this.cache.set(chatId, state);
    this.persist(chatId, state);
  }

  private getState(chatId: number): ConversationState {
    // Check in-memory cache first
    const cached = this.cache.get(chatId);
    if (cached && Date.now() - cached.lastActivity < SESSION_TTL) {
      return cached;
    }

    // Load from DB
    const db = getDb();
    const row = db.prepare<[number, number], SessionRow>(
      'SELECT * FROM conversations WHERE chat_id = ? AND last_activity > ?'
    ).get(chatId, Date.now() - SESSION_TTL);

    if (row) {
      const state: ConversationState = {
        messages: JSON.parse(row.messages_json) as ConversationEntry[],
        lastActivity: row.last_activity,
        topicSummary: row.topic_summary ?? undefined,
      };
      this.cache.set(chatId, state);
      return state;
    }

    // Fresh session
    const fresh: ConversationState = { messages: [], lastActivity: Date.now() };
    this.cache.set(chatId, fresh);
    return fresh;
  }

  private persist(chatId: number, state: ConversationState): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO conversations (chat_id, messages_json, last_activity, topic_summary)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET
        messages_json  = excluded.messages_json,
        last_activity  = excluded.last_activity,
        topic_summary  = excluded.topic_summary
    `).run(
      chatId,
      JSON.stringify(state.messages),
      state.lastActivity,
      state.topicSummary ?? null,
    );
  }

  private flushAll(): void {
    for (const [chatId, state] of this.cache) {
      this.persist(chatId, state);
    }
  }
}
