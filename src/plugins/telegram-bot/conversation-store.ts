import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PERSIST_DIR = join(homedir(), '.ari', 'conversations');
const MAX_MESSAGES = 50;
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  intent?: string;
}

interface ConversationState {
  messages: ConversationEntry[];
  lastActivity: number;
  topicSummary?: string;
}

export class ConversationStore {
  private cache: Map<number, ConversationState> = new Map();
  private dirty: Set<number> = new Set();
  private persistTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start periodic persist (every 30 seconds)
    this.persistTimer = setInterval(() => {
      void this.flushDirty();
    }, 30_000);
  }

  async addMessage(chatId: number, entry: ConversationEntry): Promise<void> {
    const state = await this.getState(chatId);
    state.messages.push(entry);
    state.lastActivity = Date.now();

    // Trim to max
    if (state.messages.length > MAX_MESSAGES) {
      state.messages = state.messages.slice(-MAX_MESSAGES);
    }

    this.cache.set(chatId, state);
    this.dirty.add(chatId);
  }

  async addUserMessage(chatId: number, content: string, intent?: string): Promise<ConversationEntry[]> {
    const entry: ConversationEntry = {
      role: 'user',
      content,
      timestamp: Date.now(),
      intent,
    };
    await this.addMessage(chatId, entry);
    const state = await this.getState(chatId);
    return [...state.messages];
  }

  async addAssistantMessage(chatId: number, content: string): Promise<void> {
    const entry: ConversationEntry = {
      role: 'assistant',
      content,
      timestamp: Date.now(),
    };
    await this.addMessage(chatId, entry);
  }

  async getHistory(chatId: number): Promise<ConversationEntry[]> {
    const state = await this.getState(chatId);
    return [...state.messages];
  }

  clearSession(chatId: number): void {
    this.cache.delete(chatId);
    this.dirty.delete(chatId);
    // Don't delete file — just let it expire
  }

  async shutdown(): Promise<void> {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
    await this.flushDirty();
  }

  getSessionCount(): number {
    return this.cache.size;
  }

  private async getState(chatId: number): Promise<ConversationState> {
    // Check cache first
    const cached = this.cache.get(chatId);
    if (cached) {
      if (Date.now() - cached.lastActivity < SESSION_TTL) {
        return cached;
      }
      // Expired
      this.cache.delete(chatId);
    }

    // Try loading from disk
    const loaded = await this.loadFromDisk(chatId);
    if (loaded && Date.now() - loaded.lastActivity < SESSION_TTL) {
      this.cache.set(chatId, loaded);
      return loaded;
    }

    // New session
    const fresh: ConversationState = {
      messages: [],
      lastActivity: Date.now(),
    };
    this.cache.set(chatId, fresh);
    return fresh;
  }

  private async loadFromDisk(chatId: number): Promise<ConversationState | null> {
    try {
      const filepath = join(PERSIST_DIR, `${chatId}.json`);
      const raw = await readFile(filepath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      // Type assertion after JSON parse
      return parsed as ConversationState;
    } catch {
      return null;
    }
  }

  private async persistToDisk(chatId: number, state: ConversationState): Promise<void> {
    try {
      await mkdir(PERSIST_DIR, { recursive: true });
      const filepath = join(PERSIST_DIR, `${chatId}.json`);
      await writeFile(filepath, JSON.stringify(state, null, 2), 'utf-8');
    } catch {
      // Best-effort persistence
    }
  }

  private async flushDirty(): Promise<void> {
    const dirtyIds = Array.from(this.dirty);
    this.dirty.clear();
    await Promise.all(
      dirtyIds.map(chatId => {
        const state = this.cache.get(chatId);
        if (state) {
          return this.persistToDisk(chatId, state);
        }
        return Promise.resolve();
      }),
    );
  }
}
