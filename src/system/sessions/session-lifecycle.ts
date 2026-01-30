import type { Session, SessionLifecycleConfig, SessionEvent } from './types.js';
import { DEFAULT_SESSION_LIFECYCLE_CONFIG } from './types.js';

/**
 * SessionLifecycleManager
 *
 * Manages session state transitions, timeouts, and cleanup.
 */
export class SessionLifecycleManager {
  private config: SessionLifecycleConfig;
  private eventCallbacks: Array<(event: SessionEvent) => void> = [];

  constructor(config?: Partial<SessionLifecycleConfig>) {
    this.config = { ...DEFAULT_SESSION_LIFECYCLE_CONFIG, ...config };
  }

  /**
   * Register a callback for lifecycle events
   */
  onEvent(callback: (event: SessionEvent) => void): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index !== -1) {
        this.eventCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Emit a lifecycle event
   */
  private emitEvent(event: SessionEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Check if a session should transition to idle
   */
  shouldBecomeIdle(session: Session): boolean {
    if (session.status !== 'active') return false;

    const lastActivity = new Date(session.lastActivity).getTime();
    const now = Date.now();

    return now - lastActivity > this.config.idleTimeout;
  }

  /**
   * Check if a session should be suspended
   */
  shouldSuspend(session: Session): boolean {
    if (session.status !== 'idle') return false;

    const lastActivity = new Date(session.lastActivity).getTime();
    const now = Date.now();

    return now - lastActivity > this.config.suspendTimeout;
  }

  /**
   * Check if a session should be closed
   */
  shouldClose(session: Session): boolean {
    if (session.status !== 'suspended') return false;

    const lastActivity = new Date(session.lastActivity).getTime();
    const now = Date.now();

    return now - lastActivity > this.config.closeTimeout;
  }

  /**
   * Check if a session has expired
   */
  isExpired(session: Session): boolean {
    if (!session.expiresAt) return false;

    const expiresAt = new Date(session.expiresAt).getTime();
    return Date.now() > expiresAt;
  }

  /**
   * Transition session to idle
   */
  transitionToIdle(session: Session): Session {
    if (session.status !== 'active') return session;

    const updated: Session = {
      ...session,
      status: 'idle',
    };

    this.emitEvent({
      sessionId: session.id,
      timestamp: new Date(),
      type: 'updated',
      details: { previousStatus: 'active', newStatus: 'idle' },
    });

    return updated;
  }

  /**
   * Transition session to suspended
   */
  transitionToSuspended(session: Session): Session {
    if (session.status !== 'idle') return session;

    const updated: Session = {
      ...session,
      status: 'suspended',
    };

    this.emitEvent({
      sessionId: session.id,
      timestamp: new Date(),
      type: 'suspended',
      details: { previousStatus: 'idle' },
    });

    return updated;
  }

  /**
   * Transition session to closed
   */
  transitionToClosed(session: Session, reason: string = 'timeout'): Session {
    const previousStatus = session.status;

    const updated: Session = {
      ...session,
      status: 'closed',
    };

    this.emitEvent({
      sessionId: session.id,
      timestamp: new Date(),
      type: 'closed',
      details: { previousStatus, reason },
    });

    return updated;
  }

  /**
   * Resume a session to active state
   */
  resume(session: Session): Session {
    if (session.status === 'active' || session.status === 'closed') return session;

    const previousStatus = session.status;
    const now = new Date().toISOString();

    const updated: Session = {
      ...session,
      status: 'active',
      lastActivity: now,
    };

    this.emitEvent({
      sessionId: session.id,
      timestamp: new Date(),
      type: 'resumed',
      details: { previousStatus },
    });

    return updated;
  }

  /**
   * Touch a session (update last activity)
   */
  touch(session: Session): Session {
    const now = new Date().toISOString();
    let status = session.status;

    // Auto-resume if idle or suspended
    if (status === 'idle' || status === 'suspended') {
      status = 'active';

      this.emitEvent({
        sessionId: session.id,
        timestamp: new Date(),
        type: 'activity',
        details: { previousStatus: session.status, autoResumed: true },
      });
    } else {
      this.emitEvent({
        sessionId: session.id,
        timestamp: new Date(),
        type: 'activity',
      });
    }

    return {
      ...session,
      status,
      lastActivity: now,
    };
  }

  /**
   * Process session lifecycle transitions
   * Returns updated session or null if session should be deleted
   */
  processLifecycle(session: Session): Session | null {
    // Check expiry first
    if (this.isExpired(session)) {
      this.emitEvent({
        sessionId: session.id,
        timestamp: new Date(),
        type: 'expired',
      });
      return this.transitionToClosed(session, 'expired');
    }

    // Process state transitions
    if (this.shouldClose(session)) {
      return this.transitionToClosed(session, 'timeout');
    }

    if (this.shouldSuspend(session)) {
      return this.transitionToSuspended(session);
    }

    if (this.shouldBecomeIdle(session)) {
      return this.transitionToIdle(session);
    }

    return session;
  }

  /**
   * Process multiple sessions and return updates
   */
  processBatch(sessions: Session[]): {
    updated: Session[];
    toDelete: string[];
  } {
    const updated: Session[] = [];
    const toDelete: string[] = [];

    for (const session of sessions) {
      const processed = this.processLifecycle(session);

      if (processed === null || processed.status === 'closed') {
        // Mark closed sessions for cleanup after retention period
        if (processed) {
          updated.push(processed);
        } else {
          toDelete.push(session.id);
        }
      } else if (processed.status !== session.status) {
        updated.push(processed);
      }
    }

    return { updated, toDelete };
  }

  /**
   * Get time until next state transition
   */
  getTimeUntilTransition(session: Session): number | null {
    const lastActivity = new Date(session.lastActivity).getTime();
    const now = Date.now();
    const elapsed = now - lastActivity;

    switch (session.status) {
      case 'active':
        return Math.max(0, this.config.idleTimeout - elapsed);
      case 'idle':
        return Math.max(0, this.config.suspendTimeout - elapsed);
      case 'suspended':
        return Math.max(0, this.config.closeTimeout - elapsed);
      default:
        return null;
    }
  }

  /**
   * Get cleanup interval
   */
  getCleanupInterval(): number {
    return this.config.cleanupInterval;
  }

  /**
   * Get max sessions per sender
   */
  getMaxSessionsPerSender(): number {
    return this.config.maxSessionsPerSender;
  }

  /**
   * Get max total sessions
   */
  getMaxTotalSessions(): number {
    return this.config.maxTotalSessions;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SessionLifecycleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SessionLifecycleConfig {
    return { ...this.config };
  }
}
