import { randomUUID } from 'crypto';
import type { EventBus } from '../../kernel/event-bus.js';
import type { AuditLogger } from '../../kernel/audit.js';
import {
  type Session,
  type CreateSessionInput,
  type UpdateSessionInput,
  type SessionQuery,
  type SessionLifecycleConfig,
} from './types.js';
import { SessionStore } from './session-store.js';
import { SessionContextManager } from './session-context.js';
import { SessionLifecycleManager } from './session-lifecycle.js';

/**
 * SessionManager
 *
 * Central manager for session lifecycle, providing:
 * - Session creation and lookup
 * - Session state management
 * - Session isolation
 * - Lifecycle management (idle, suspend, close)
 * - EventBus integration
 */
export class SessionManager {
  private store: SessionStore;
  private lifecycle: SessionLifecycleManager;
  private eventBus: EventBus;
  private audit: AuditLogger;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private running: boolean = false;

  constructor(
    eventBus: EventBus,
    audit: AuditLogger,
    lifecycleConfig?: Partial<SessionLifecycleConfig>,
    storagePath?: string
  ) {
    this.eventBus = eventBus;
    this.audit = audit;
    this.store = new SessionStore(storagePath);
    this.lifecycle = new SessionLifecycleManager(lifecycleConfig);

    // Wire lifecycle events to EventBus
    this.lifecycle.onEvent((event) => {
      switch (event.type) {
        case 'created':
          // Handled separately in createSession
          break;
        case 'closed':
          this.eventBus.emit('session:ended', {
            sessionId: event.sessionId,
            reason: (event.details?.reason as string) || 'closed',
            endedAt: event.timestamp,
          });
          break;
        case 'expired':
          this.eventBus.emit('session:ended', {
            sessionId: event.sessionId,
            reason: 'expired',
            endedAt: event.timestamp,
          });
          break;
        case 'activity':
          this.eventBus.emit('session:activity', {
            sessionId: event.sessionId,
            timestamp: event.timestamp,
          });
          break;
      }
    });
  }

  /**
   * Initialize the session manager
   */
  async start(): Promise<void> {
    if (this.running) return;

    await this.store.load();
    this.startCleanupTimer();
    this.running = true;

    await this.audit.log('session_manager_started', 'system', 'system', {
      sessionCount: this.store.size,
    });
  }

  /**
   * Stop the session manager
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.stopCleanupTimer();
    this.running = false;

    await this.audit.log('session_manager_stopped', 'system', 'system', {
      sessionCount: this.store.size,
    });
  }

  /**
   * Create a new session
   */
  async createSession(input: CreateSessionInput): Promise<Session> {
    // Check if session already exists for this channel/sender/group
    const existing = this.store.getByKey(input.channel, input.senderId, input.groupId);
    if (existing && existing.status !== 'closed') {
      // Resume existing session
      const resumed = this.lifecycle.resume(existing);
      await this.store.save(resumed);
      return resumed;
    }

    // Check max sessions limits
    const senderSessions = this.store.getBySender(input.senderId);
    const activeSenderSessions = senderSessions.filter(s => s.status !== 'closed');
    if (activeSenderSessions.length >= this.lifecycle.getMaxSessionsPerSender()) {
      // Close oldest session
      const oldest = activeSenderSessions.sort(
        (a, b) => new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime()
      )[0];
      if (oldest) {
        await this.closeSession(oldest.id, 'max_sessions_exceeded');
      }
    }

    if (this.store.size >= this.lifecycle.getMaxTotalSessions()) {
      // Close oldest session globally
      const oldest = this.store.query({ status: 'active', limit: 1 })[0] ||
                     this.store.query({ status: 'idle', limit: 1 })[0] ||
                     this.store.query({ status: 'suspended', limit: 1 })[0];
      if (oldest) {
        await this.closeSession(oldest.id, 'max_total_sessions_exceeded');
      }
    }

    const now = new Date().toISOString();
    const sessionId = randomUUID();

    const session: Session = {
      id: sessionId,
      channel: input.channel,
      senderId: input.senderId,
      groupId: input.groupId,
      createdAt: now,
      lastActivity: now,
      context: SessionContextManager.createInitialContext(input.contextId),
      memoryPartition: SessionContextManager.generateMemoryPartition(input.channel, input.senderId),
      trustLevel: input.trustLevel || 'standard',
      status: 'active',
      metadata: SessionContextManager.createInitialMetadata(input.metadata),
      stats: SessionContextManager.createInitialStats(),
      expiresAt: input.expiresAt,
    };

    await this.store.save(session);

    // Emit session started event
    this.eventBus.emit('session:started', {
      sessionId: session.id,
      channel: session.channel,
      senderId: session.senderId,
      groupId: session.groupId,
      trustLevel: session.trustLevel,
      startedAt: new Date(),
    });

    await this.audit.log('session_created', 'system', session.trustLevel, {
      sessionId: session.id,
      channel: session.channel,
      senderId: session.senderId,
      groupId: session.groupId,
    });

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Session | null {
    return this.store.get(sessionId);
  }

  /**
   * Get a session by channel/sender/group
   */
  getSessionByKey(channel: string, senderId: string, groupId?: string): Session | null {
    return this.store.getByKey(channel, senderId, groupId);
  }

  /**
   * Get or create a session
   */
  async getOrCreateSession(input: CreateSessionInput): Promise<Session> {
    const existing = this.store.getByKey(input.channel, input.senderId, input.groupId);
    if (existing && existing.status !== 'closed') {
      // Touch and possibly resume
      const updated = this.lifecycle.touch(existing);
      await this.store.save(updated);
      return updated;
    }

    return this.createSession(input);
  }

  /**
   * Update a session
   */
  async updateSession(sessionId: string, input: UpdateSessionInput): Promise<Session | null> {
    const session = this.store.get(sessionId);
    if (!session) return null;

    const updated: Session = {
      ...session,
      lastActivity: new Date().toISOString(),
    };

    if (input.status !== undefined) {
      updated.status = input.status;
    }
    if (input.trustLevel !== undefined) {
      updated.trustLevel = input.trustLevel;
    }
    if (input.context) {
      updated.context = { ...updated.context, ...input.context };
    }
    if (input.metadata) {
      updated.metadata = { ...updated.metadata, ...input.metadata };
    }
    if (input.expiresAt !== undefined) {
      updated.expiresAt = input.expiresAt;
    }

    await this.store.save(updated);

    await this.audit.log('session_updated', 'system', session.trustLevel, {
      sessionId,
      changes: Object.keys(input),
    });

    return updated;
  }

  /**
   * Touch a session (update activity)
   */
  async touchSession(sessionId: string): Promise<Session | null> {
    const session = this.store.get(sessionId);
    if (!session) return null;

    const updated = this.lifecycle.touch(session);
    await this.store.save(updated);

    return updated;
  }

  /**
   * Record an inbound message for a session
   */
  async recordInboundMessage(sessionId: string, messageId: string): Promise<Session | null> {
    const session = this.store.get(sessionId);
    if (!session) return null;

    let updated = SessionContextManager.recordInboundMessage(session, messageId);
    updated = this.lifecycle.touch(updated);

    await this.store.save(updated);
    return updated;
  }

  /**
   * Record an outbound message for a session
   */
  async recordOutboundMessage(sessionId: string, messageId: string): Promise<Session | null> {
    const session = this.store.get(sessionId);
    if (!session) return null;

    let updated = SessionContextManager.recordOutboundMessage(session, messageId);
    updated = this.lifecycle.touch(updated);

    await this.store.save(updated);
    return updated;
  }

  /**
   * Record tool execution start
   */
  async recordToolStart(sessionId: string, callId: string): Promise<Session | null> {
    const session = this.store.get(sessionId);
    if (!session) return null;

    const updated = SessionContextManager.recordToolStart(session, callId);
    await this.store.save(updated);
    return updated;
  }

  /**
   * Record tool execution end
   */
  async recordToolEnd(sessionId: string, callId: string): Promise<Session | null> {
    const session = this.store.get(sessionId);
    if (!session) return null;

    const updated = SessionContextManager.recordToolEnd(session, callId);
    await this.store.save(updated);
    return updated;
  }

  /**
   * Close a session
   */
  async closeSession(sessionId: string, reason: string = 'user_request'): Promise<boolean> {
    const session = this.store.get(sessionId);
    if (!session) return false;

    const updated = this.lifecycle.transitionToClosed(session, reason);
    await this.store.save(updated);

    this.eventBus.emit('session:ended', {
      sessionId,
      reason,
      endedAt: new Date(),
    });

    await this.audit.log('session_closed', 'system', session.trustLevel, {
      sessionId,
      reason,
      stats: session.stats,
    });

    return true;
  }

  /**
   * Query sessions
   */
  querySessions(query: SessionQuery): Session[] {
    return this.store.query(query);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Session[] {
    return this.store.getActive();
  }

  /**
   * Get sessions by channel
   */
  getSessionsByChannel(channel: string): Session[] {
    return this.store.getByChannel(channel);
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.store.size;
  }

  /**
   * Get session statistics
   */
  getStats(): {
    total: number;
    byStatus: Record<string, number>;
    byChannel: Record<string, number>;
  } {
    return {
      total: this.store.size,
      byStatus: this.store.countByStatus(),
      byChannel: this.store.countByChannel(),
    };
  }

  /**
   * Start the cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      void this.runCleanup();
    }, this.lifecycle.getCleanupInterval());
  }

  /**
   * Stop the cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Run cleanup cycle
   */
  private async runCleanup(): Promise<void> {
    const sessions = this.store.getAll();
    const { updated, toDelete } = this.lifecycle.processBatch(sessions);

    // Save updated sessions
    for (const session of updated) {
      await this.store.save(session);
    }

    // Delete sessions marked for removal
    for (const sessionId of toDelete) {
      await this.store.delete(sessionId);
    }

    if (updated.length > 0 || toDelete.length > 0) {
      await this.audit.log('session_cleanup', 'system', 'system', {
        updated: updated.length,
        deleted: toDelete.length,
        total: this.store.size,
      });
    }
  }

  /**
   * Check if manager is running
   */
  isRunning(): boolean {
    return this.running;
  }
}
