import { randomUUID } from 'crypto';
import {
  Session,
  SessionContext,
  SessionStats,
  SessionMetadata,
} from './types.js';

/**
 * SessionContextManager
 *
 * Manages per-session context, including conversation state,
 * active tools, and message tracking.
 */
export class SessionContextManager {
  /**
   * Create initial context for a new session
   */
  static createInitialContext(contextId?: string): SessionContext {
    return {
      contextId,
      summary: undefined,
      currentTask: undefined,
      activeTools: [],
      pendingResponses: [],
      lastMessageId: undefined,
    };
  }

  /**
   * Create initial stats for a new session
   */
  static createInitialStats(): SessionStats {
    return {
      messageCount: 0,
      inboundCount: 0,
      outboundCount: 0,
      toolExecutions: 0,
      duration: 0,
    };
  }

  /**
   * Create initial metadata for a new session
   */
  static createInitialMetadata(input?: Partial<SessionMetadata>): SessionMetadata {
    return {
      name: input?.name,
      tags: input?.tags || [],
      custom: input?.custom || {},
    };
  }

  /**
   * Record an inbound message
   */
  static recordInboundMessage(session: Session, messageId: string): Session {
    return {
      ...session,
      lastActivity: new Date().toISOString(),
      context: {
        ...session.context,
        lastMessageId: messageId,
      },
      stats: {
        ...session.stats,
        messageCount: session.stats.messageCount + 1,
        inboundCount: session.stats.inboundCount + 1,
      },
    };
  }

  /**
   * Record an outbound message
   */
  static recordOutboundMessage(session: Session, messageId: string): Session {
    return {
      ...session,
      lastActivity: new Date().toISOString(),
      context: {
        ...session.context,
        lastMessageId: messageId,
      },
      stats: {
        ...session.stats,
        messageCount: session.stats.messageCount + 1,
        outboundCount: session.stats.outboundCount + 1,
      },
    };
  }

  /**
   * Record a tool execution start
   */
  static recordToolStart(session: Session, callId: string): Session {
    return {
      ...session,
      lastActivity: new Date().toISOString(),
      context: {
        ...session.context,
        activeTools: [...session.context.activeTools, callId],
      },
    };
  }

  /**
   * Record a tool execution end
   */
  static recordToolEnd(session: Session, callId: string): Session {
    return {
      ...session,
      lastActivity: new Date().toISOString(),
      context: {
        ...session.context,
        activeTools: session.context.activeTools.filter(id => id !== callId),
      },
      stats: {
        ...session.stats,
        toolExecutions: session.stats.toolExecutions + 1,
      },
    };
  }

  /**
   * Add a pending response
   */
  static addPendingResponse(session: Session, responseId: string): Session {
    return {
      ...session,
      context: {
        ...session.context,
        pendingResponses: [...session.context.pendingResponses, responseId],
      },
    };
  }

  /**
   * Remove a pending response
   */
  static removePendingResponse(session: Session, responseId: string): Session {
    return {
      ...session,
      context: {
        ...session.context,
        pendingResponses: session.context.pendingResponses.filter(id => id !== responseId),
      },
    };
  }

  /**
   * Update conversation summary
   */
  static updateSummary(session: Session, summary: string): Session {
    return {
      ...session,
      context: {
        ...session.context,
        summary,
      },
    };
  }

  /**
   * Set current task
   */
  static setCurrentTask(session: Session, task: string | undefined): Session {
    return {
      ...session,
      context: {
        ...session.context,
        currentTask: task,
      },
    };
  }

  /**
   * Update ARI context (venture/life)
   */
  static setContextId(session: Session, contextId: string | undefined): Session {
    return {
      ...session,
      context: {
        ...session.context,
        contextId,
      },
    };
  }

  /**
   * Add metadata tag
   */
  static addTag(session: Session, tag: string): Session {
    if (session.metadata.tags.includes(tag)) return session;

    return {
      ...session,
      metadata: {
        ...session.metadata,
        tags: [...session.metadata.tags, tag],
      },
    };
  }

  /**
   * Remove metadata tag
   */
  static removeTag(session: Session, tag: string): Session {
    return {
      ...session,
      metadata: {
        ...session.metadata,
        tags: session.metadata.tags.filter(t => t !== tag),
      },
    };
  }

  /**
   * Set custom metadata value
   */
  static setCustom(session: Session, key: string, value: unknown): Session {
    return {
      ...session,
      metadata: {
        ...session.metadata,
        custom: {
          ...session.metadata.custom,
          [key]: value,
        },
      },
    };
  }

  /**
   * Get custom metadata value
   */
  static getCustom(session: Session, key: string): unknown {
    return session.metadata.custom[key];
  }

  /**
   * Update session duration
   */
  static updateDuration(session: Session): Session {
    const createdAt = new Date(session.createdAt).getTime();
    const now = Date.now();
    const duration = now - createdAt;

    return {
      ...session,
      stats: {
        ...session.stats,
        duration,
      },
    };
  }

  /**
   * Get memory partition name for a session
   */
  static getMemoryPartition(sessionId: string): string {
    return `session:${sessionId}`;
  }

  /**
   * Generate a unique memory partition for a new session
   */
  static generateMemoryPartition(channel: string, senderId: string): string {
    return `session:${channel}:${senderId}:${randomUUID().substring(0, 8)}`;
  }

  /**
   * Check if session has active tools
   */
  static hasActiveTools(session: Session): boolean {
    return session.context.activeTools.length > 0;
  }

  /**
   * Check if session has pending responses
   */
  static hasPendingResponses(session: Session): boolean {
    return session.context.pendingResponses.length > 0;
  }

  /**
   * Check if session is busy (has active tools or pending responses)
   */
  static isBusy(session: Session): boolean {
    return this.hasActiveTools(session) || this.hasPendingResponses(session);
  }

  /**
   * Clear all active context (tools, pending responses)
   */
  static clearActiveContext(session: Session): Session {
    return {
      ...session,
      context: {
        ...session.context,
        activeTools: [],
        pendingResponses: [],
        currentTask: undefined,
      },
    };
  }
}
