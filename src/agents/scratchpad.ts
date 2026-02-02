import type { EventBus } from '../kernel/event-bus.js';
import type { AgentId } from '../kernel/types.js';

/**
 * A scratchpad entry for temporary reasoning storage
 */
export interface ScratchpadEntry {
  id: string;
  key: string;
  content: string;
  agent: AgentId;
  timestamp: Date;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Scratchpad context for an agent
 */
export interface ScratchpadContext {
  agent: AgentId;
  taskId?: string;
  sessionId?: string;
  entries: Map<string, ScratchpadEntry>;
  createdAt: Date;
  lastAccessed: Date;
}

/**
 * Scratchpad - Temporary reasoning space for agents
 * 
 * Based on Dexter's "Scratchpad" pattern:
 * - Ephemeral storage for multi-step reasoning
 * - Context preservation across tool calls
 * - Automatic cleanup after task completion
 * - Isolated per-agent scratchpads
 */
export class Scratchpad {
  private contexts = new Map<AgentId, ScratchpadContext>();
  private globalEntries = new Map<string, ScratchpadEntry>();
  private readonly eventBus: EventBus;
  private readonly defaultTTL: number; // milliseconds
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(eventBus: EventBus, defaultTTLMinutes: number = 30) {
    this.eventBus = eventBus;
    this.defaultTTL = defaultTTLMinutes * 60 * 1000;
  }

  /**
   * Start automatic cleanup of expired entries
   */
  startCleanup(intervalMs: number = 60000): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get or create context for an agent
   */
  private getOrCreateContext(agent: AgentId): ScratchpadContext {
    let context = this.contexts.get(agent);
    if (!context) {
      context = {
        agent,
        entries: new Map(),
        createdAt: new Date(),
        lastAccessed: new Date(),
      };
      this.contexts.set(agent, context);
    }
    context.lastAccessed = new Date();
    return context;
  }

  /**
   * Write a value to the scratchpad
   */
  write(
    agent: AgentId,
    key: string,
    content: string,
    options: {
      ttlMinutes?: number;
      taskId?: string;
      sessionId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): ScratchpadEntry {
    const context = this.getOrCreateContext(agent);

    // Update task/session context if provided
    if (options.taskId) context.taskId = options.taskId;
    if (options.sessionId) context.sessionId = options.sessionId;

    const ttl = options.ttlMinutes ? options.ttlMinutes * 60 * 1000 : this.defaultTTL;
    const now = new Date();

    const entry: ScratchpadEntry = {
      id: `sp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      key,
      content,
      agent,
      timestamp: now,
      expiresAt: new Date(now.getTime() + ttl),
      metadata: options.metadata,
    };

    context.entries.set(key, entry);
    this.globalEntries.set(`${agent}:${key}`, entry);

    this.eventBus.emit('scratchpad:written', {
      agent,
      key,
      size: content.length,
    });

    return entry;
  }

  /**
   * Append to an existing entry or create new
   */
  append(
    agent: AgentId,
    key: string,
    content: string,
    separator: string = '\n'
  ): ScratchpadEntry {
    const existing = this.read(agent, key);
    const newContent = existing ? `${existing.content}${separator}${content}` : content;
    return this.write(agent, key, newContent);
  }

  /**
   * Read a value from the scratchpad
   */
  read(agent: AgentId, key: string): ScratchpadEntry | null {
    const context = this.contexts.get(agent);
    if (!context) return null;

    const entry = context.entries.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.expiresAt < new Date()) {
      this.delete(agent, key);
      return null;
    }

    context.lastAccessed = new Date();
    return entry;
  }

  /**
   * Read all entries for an agent
   */
  readAll(agent: AgentId): ScratchpadEntry[] {
    const context = this.contexts.get(agent);
    if (!context) return [];

    const now = new Date();
    const entries: ScratchpadEntry[] = [];

    for (const [key, entry] of context.entries) {
      if (entry.expiresAt < now) {
        context.entries.delete(key);
        this.globalEntries.delete(`${agent}:${key}`);
      } else {
        entries.push(entry);
      }
    }

    context.lastAccessed = new Date();
    return entries;
  }

  /**
   * Delete a specific entry
   */
  delete(agent: AgentId, key: string): boolean {
    const context = this.contexts.get(agent);
    if (!context) return false;

    const deleted = context.entries.delete(key);
    this.globalEntries.delete(`${agent}:${key}`);

    if (deleted) {
      this.eventBus.emit('scratchpad:deleted', {
        agent,
        key,
      });
    }

    return deleted;
  }

  /**
   * Clear all entries for an agent
   */
  clear(agent: AgentId): number {
    const context = this.contexts.get(agent);
    if (!context) return 0;

    const count = context.entries.size;

    for (const key of context.entries.keys()) {
      this.globalEntries.delete(`${agent}:${key}`);
    }

    context.entries.clear();

    this.eventBus.emit('scratchpad:cleared', {
      agent,
      count,
    });

    return count;
  }

  /**
   * Clear scratchpad for a specific task
   */
  clearTask(taskId: string): number {
    let count = 0;

    for (const context of this.contexts.values()) {
      if (context.taskId === taskId) {
        count += this.clear(context.agent);
      }
    }

    return count;
  }

  /**
   * Check if a key exists
   */
  has(agent: AgentId, key: string): boolean {
    return this.read(agent, key) !== null;
  }

  /**
   * Get all keys for an agent
   */
  keys(agent: AgentId): string[] {
    const context = this.contexts.get(agent);
    if (!context) return [];
    return Array.from(context.entries.keys());
  }

  /**
   * Get context info for an agent
   */
  getContext(agent: AgentId): ScratchpadContext | null {
    return this.contexts.get(agent) || null;
  }

  /**
   * Set the task ID for an agent's context
   */
  setTaskId(agent: AgentId, taskId: string): void {
    const context = this.getOrCreateContext(agent);
    context.taskId = taskId;
  }

  /**
   * Set the session ID for an agent's context
   */
  setSessionId(agent: AgentId, sessionId: string): void {
    const context = this.getOrCreateContext(agent);
    context.sessionId = sessionId;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [globalKey, entry] of this.globalEntries) {
      if (entry.expiresAt < now) {
        this.globalEntries.delete(globalKey);
        const context = this.contexts.get(entry.agent);
        if (context) {
          context.entries.delete(entry.key);
        }
        cleaned++;
      }
    }

    // Remove empty contexts
    for (const [agent, context] of this.contexts) {
      if (context.entries.size === 0) {
        this.contexts.delete(agent);
      }
    }

    if (cleaned > 0) {
      this.eventBus.emit('scratchpad:cleanup', {
        cleaned,
        remaining: this.globalEntries.size,
      });
    }

    return cleaned;
  }

  /**
   * Search entries by content or metadata
   */
  search(query: string, agent?: AgentId): ScratchpadEntry[] {
    const results: ScratchpadEntry[] = [];
    const queryLower = query.toLowerCase();
    const now = new Date();

    for (const entry of this.globalEntries.values()) {
      // Skip expired
      if (entry.expiresAt < now) continue;

      // Filter by agent if specified
      if (agent && entry.agent !== agent) continue;

      // Check content
      if (entry.content.toLowerCase().includes(queryLower)) {
        results.push(entry);
        continue;
      }

      // Check key
      if (entry.key.toLowerCase().includes(queryLower)) {
        results.push(entry);
        continue;
      }

      // Check metadata
      if (entry.metadata) {
        const metaStr = JSON.stringify(entry.metadata).toLowerCase();
        if (metaStr.includes(queryLower)) {
          results.push(entry);
        }
      }
    }

    return results;
  }

  /**
   * Export scratchpad state for debugging
   */
  export(): Record<string, {
    agent: AgentId;
    taskId?: string;
    sessionId?: string;
    entryCount: number;
    totalSize: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  }> {
    const result: Record<string, {
      agent: AgentId;
      taskId?: string;
      sessionId?: string;
      entryCount: number;
      totalSize: number;
      oldestEntry: Date | null;
      newestEntry: Date | null;
    }> = {};

    for (const [agent, context] of this.contexts) {
      const entries = this.readAll(agent);
      let totalSize = 0;
      let oldest: Date | null = null;
      let newest: Date | null = null;

      for (const entry of entries) {
        totalSize += entry.content.length;
        if (!oldest || entry.timestamp < oldest) oldest = entry.timestamp;
        if (!newest || entry.timestamp > newest) newest = entry.timestamp;
      }

      result[agent] = {
        agent,
        taskId: context.taskId,
        sessionId: context.sessionId,
        entryCount: entries.length,
        totalSize,
        oldestEntry: oldest,
        newestEntry: newest,
      };
    }

    return result;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalContexts: number;
    totalEntries: number;
    totalSize: number;
    byAgent: Partial<Record<AgentId, { entries: number; size: number }>>;
  } {
    const byAgent: Partial<Record<AgentId, { entries: number; size: number }>> = {};
    let totalEntries = 0;
    let totalSize = 0;

    for (const agent of this.contexts.keys()) {
      const entries = this.readAll(agent);
      let agentSize = 0;

      for (const entry of entries) {
        agentSize += entry.content.length;
      }

      byAgent[agent] = { entries: entries.length, size: agentSize };
      totalEntries += entries.length;
      totalSize += agentSize;
    }

    return {
      totalContexts: this.contexts.size,
      totalEntries,
      totalSize,
      byAgent,
    };
  }
}
