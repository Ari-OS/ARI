import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  Session,
  SessionSchema,
  SessionQuery,
  createSessionKey,
} from './types.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('session-store');

/**
 * SessionStore
 *
 * Persistent storage layer for sessions.
 * Stores sessions in JSON files under ~/.ari/sessions/
 */
export class SessionStore {
  private sessions: Map<string, Session> = new Map();
  private keyToId: Map<string, string> = new Map();
  private storagePath: string;
  private loaded: boolean = false;

  constructor(storagePath?: string) {
    this.storagePath = storagePath || join(homedir(), '.ari', 'sessions');
  }

  /**
   * Load sessions from disk
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      await fs.mkdir(this.storagePath, { recursive: true });

      const files = await fs.readdir(this.storagePath);
      const sessionFiles = files.filter(f => f.endsWith('.json'));

      for (const file of sessionFiles) {
        try {
          const content = await fs.readFile(join(this.storagePath, file), 'utf-8');
          const data: unknown = JSON.parse(content);
          const session = SessionSchema.parse(data);

          this.sessions.set(session.id, session);
          const key = createSessionKey(session.channel, session.senderId, session.groupId);
          this.keyToId.set(key, session.id);
        } catch {
          // Skip invalid session files
          log.warn({ file }, 'Invalid session file, skipping');
        }
      }

      this.loaded = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      this.loaded = true;
    }
  }

  /**
   * Save a session to disk
   */
  async save(session: Session): Promise<void> {
    await fs.mkdir(this.storagePath, { recursive: true });

    const filePath = join(this.storagePath, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');

    // Update in-memory maps
    this.sessions.set(session.id, session);
    const key = createSessionKey(session.channel, session.senderId, session.groupId);
    this.keyToId.set(key, session.id);
  }

  /**
   * Delete a session from disk
   */
  async delete(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const filePath = join(this.storagePath, `${sessionId}.json`);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    // Update in-memory maps
    this.sessions.delete(sessionId);
    const key = createSessionKey(session.channel, session.senderId, session.groupId);
    this.keyToId.delete(key);

    return true;
  }

  /**
   * Get a session by ID
   */
  get(sessionId: string): Session | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get a session by composite key
   */
  getByKey(channel: string, senderId: string, groupId?: string): Session | null {
    const key = createSessionKey(channel, senderId, groupId);
    const sessionId = this.keyToId.get(key);
    return sessionId ? this.sessions.get(sessionId) || null : null;
  }

  /**
   * Check if a session exists
   */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Check if a session exists by composite key
   */
  hasByKey(channel: string, senderId: string, groupId?: string): boolean {
    const key = createSessionKey(channel, senderId, groupId);
    return this.keyToId.has(key);
  }

  /**
   * Query sessions with filters
   */
  query(query: SessionQuery): Session[] {
    let results = Array.from(this.sessions.values());

    // Apply filters
    if (query.channel) {
      results = results.filter(s => s.channel === query.channel);
    }
    if (query.senderId) {
      results = results.filter(s => s.senderId === query.senderId);
    }
    if (query.groupId) {
      results = results.filter(s => s.groupId === query.groupId);
    }
    if (query.status) {
      results = results.filter(s => s.status === query.status);
    }
    if (query.trustLevel) {
      results = results.filter(s => s.trustLevel === query.trustLevel);
    }
    if (query.createdAfter) {
      const after = new Date(query.createdAfter);
      results = results.filter(s => new Date(s.createdAt) >= after);
    }
    if (query.createdBefore) {
      const before = new Date(query.createdBefore);
      results = results.filter(s => new Date(s.createdAt) <= before);
    }
    if (query.activeAfter) {
      const after = new Date(query.activeAfter);
      results = results.filter(s => new Date(s.lastActivity) >= after);
    }

    // Sort by last activity (most recent first)
    results.sort((a, b) =>
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );

    // Apply pagination
    if (query.offset) {
      results = results.slice(query.offset);
    }
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get all sessions
   */
  getAll(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get sessions by channel
   */
  getByChannel(channel: string): Session[] {
    return Array.from(this.sessions.values())
      .filter(s => s.channel === channel);
  }

  /**
   * Get sessions by sender
   */
  getBySender(senderId: string): Session[] {
    return Array.from(this.sessions.values())
      .filter(s => s.senderId === senderId);
  }

  /**
   * Get active sessions
   */
  getActive(): Session[] {
    return Array.from(this.sessions.values())
      .filter(s => s.status === 'active');
  }

  /**
   * Get session count
   */
  get size(): number {
    return this.sessions.size;
  }

  /**
   * Get session count by status
   */
  countByStatus(): Record<string, number> {
    const counts: Record<string, number> = {
      active: 0,
      idle: 0,
      suspended: 0,
      closed: 0,
    };

    for (const session of this.sessions.values()) {
      counts[session.status]++;
    }

    return counts;
  }

  /**
   * Get session count by channel
   */
  countByChannel(): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const session of this.sessions.values()) {
      counts[session.channel] = (counts[session.channel] || 0) + 1;
    }

    return counts;
  }

  /**
   * Clear all sessions (for testing)
   */
  async clear(): Promise<void> {
    for (const sessionId of this.sessions.keys()) {
      await this.delete(sessionId);
    }
  }
}
