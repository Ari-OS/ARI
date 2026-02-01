import type { Message, AuditEvent, SecurityEvent, AgentId, TrustLevel } from './types.js';

/**
 * EventMap interface defining event name to payload mappings.
 * The EventBus is the ONLY coupling between kernel and system/agent layers.
 */
export interface EventMap {
  // ── Kernel events ──────────────────────────────────────────────────────
  'message:received': Message;
  'message:accepted': Message;
  'message:processed': Message;
  'message:rejected': { messageId: string; reason: string; riskScore: number };
  'audit:logged': AuditEvent;
  'security:detected': SecurityEvent;
  'gateway:started': { port: number; host: string };
  'gateway:stopped': { reason: string };
  'system:ready': { version: string };
  'system:error': { error: Error; context: string };
  'system:halted': { authority: string; reason: string; timestamp: Date };
  'system:resumed': { authority: string; timestamp: Date };

  // ── System events ──────────────────────────────────────────────────────
  'system:routed': { messageId: string; contextId?: string; route: string; timestamp: Date };

  // ── Agent events ───────────────────────────────────────────────────────
  'security:alert': { type: string; source: string; data: Record<string, unknown> };
  'agent:started': { agent: AgentId; timestamp: Date };
  'agent:stopped': { agent: AgentId; reason: string };
  'tool:executed': { toolId: string; callId: string; success: boolean; agent: AgentId };
  'tool:approval_required': { toolId: string; callId: string; agent: AgentId; parameters: Record<string, unknown> };
  'memory:stored': { memoryId: string; type: string; partition: string; agent: AgentId };
  'memory:quarantined': { memoryId: string; reason: string; agent: AgentId };

  // ── Governance events ──────────────────────────────────────────────────
  'vote:started': { voteId: string; topic: string; threshold: string; deadline: string };
  'vote:cast': { voteId: string; agent: AgentId; option: string };
  'vote:completed': { voteId: string; status: string; result: Record<string, unknown> };
  'vote:vetoed': { voteId: string; vetoer: AgentId; domain: string; reason: string };
  'vote:matrix_update': { voteId: string; matrix: Record<string, unknown> };
  'arbiter:ruling': { ruleId: string; type: string; decision: string };
  'overseer:gate': { gateId: string; passed: boolean; reason: string };

  // ── Council Amendment events ────────────────────────────────────────────
  'amendment:proposed': { amendmentId: string; type: string; proposedBy: string };
  'amendment:voted': { amendmentId: string; status: string };
  'amendment:ratified': { amendmentId: string; result: string };

  // ── PolicyEngine events (Separation of Powers) ───────────────────────────
  'permission:granted': { requestId: string; toolId: string; agentId: AgentId; tokenId: string; autoApproved: boolean };
  'permission:denied': { requestId: string; toolId: string; agentId: AgentId; reason: string; violations: string[] };
  'permission:approval_required': { requestId: string; toolId: string; agentId: AgentId; parameters: Record<string, unknown>; permissionTier: string };
  'permission:approved': { requestId: string; toolId: string; agentId: AgentId; tokenId: string; approver: AgentId };
  'permission:rejected': { requestId: string; toolId: string; agentId: AgentId; rejector: AgentId; reason: string };
  'permission:expired': { requestId: string; toolId: string; agentId: AgentId };

  // ── ToolRegistry events ──────────────────────────────────────────────────
  'tool:registered': { toolId: string; toolName: string };
  'tool:unregistered': { toolId: string };

  // ── Control Plane events ───────────────────────────────────────────────
  'controlplane:client:connected': { clientId: string; clientType: string; connectedAt: Date };
  'controlplane:client:disconnected': { clientId: string; reason: string; disconnectedAt: Date };
  'controlplane:client:authenticated': { clientId: string; capabilities: string[]; authenticatedAt: Date };

  // ── Session events ─────────────────────────────────────────────────────
  'session:started': { sessionId: string; channel: string; senderId: string; groupId?: string; trustLevel: TrustLevel; startedAt: Date };
  'session:ended': { sessionId: string; reason: string; endedAt: Date };
  'session:activity': { sessionId: string; timestamp: Date };

  // ── Tool streaming events ──────────────────────────────────────────────
  'tool:start': { callId: string; toolId: string; toolName: string; agent: AgentId; sessionId?: string; parameters: Record<string, unknown>; timestamp: Date };
  'tool:update': { callId: string; toolId: string; progress?: number; status: string; message?: string; timestamp: Date };
  'tool:end': { callId: string; toolId: string; success: boolean; result?: unknown; error?: string; duration: number; timestamp: Date };

  // ── Channel events ─────────────────────────────────────────────────────
  'channel:connected': { channelId: string; channelName: string; connectedAt: Date };
  'channel:disconnected': { channelId: string; channelName: string; reason: string; disconnectedAt: Date };
  'channel:status': { channelId: string; channelName: string; status: string; activeSessions: number; lastActivity?: Date };
  'channel:message:inbound': { channelId: string; messageId: string; senderId: string; content: string; timestamp: Date };
  'channel:message:outbound': { channelId: string; messageId: string; recipientId: string; content: string; timestamp: Date };

  // ── Scheduler events ─────────────────────────────────────────────────────
  'scheduler:task_run': { taskId: string; taskName: string; startedAt: Date; runId?: string };
  'scheduler:task_complete': { taskId: string; taskName: string; duration: number; success: boolean; error?: string; runId?: string; triggeredBy?: 'scheduler' | 'manual' | 'api' | 'subagent' };

  // ── Knowledge events ─────────────────────────────────────────────────────
  'knowledge:indexed': { documentCount: number; duration: number };
  'knowledge:searched': { query: string; resultCount: number };

  // ── Subagent events ──────────────────────────────────────────────────────
  'subagent:spawned': { taskId: string; agentId: AgentId; worktree: string };
  'subagent:progress': { taskId: string; progress: number; message: string };
  'subagent:completed': { taskId: string; success: boolean; result?: unknown };

  // ── Context events ───────────────────────────────────────────────────────
  'context:loaded': { path: string; depth: number; skills: string[] };

  // ── Alert events (Observability) ────────────────────────────────────────
  'alert:created': { id: string; severity: string; title: string; message: string; source: string };
  'alert:acknowledged': { id: string; acknowledgedBy: string; acknowledgedAt: string };
  'alert:resolved': { id: string; resolvedBy: string; resolvedAt: string };

  // ── Audit log event (for logging) ───────────────────────────────────────
  'audit:log': { action: string; agent: string; trustLevel: TrustLevel; details: Record<string, unknown> };
}

/**
 * Typed pub/sub event system for ARI
 */
export class EventBus {
  private listeners: Map<string, Set<(payload: unknown) => void>> = new Map();

  /**
   * Subscribe to an event
   * @param event Event name
   * @param handler Event handler
   * @returns Unsubscribe function
   */
  on<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(handler as (payload: unknown) => void);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from an event
   * @param event Event name
   * @param handler Event handler to remove
   */
  off<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler as (payload: unknown) => void);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   * @param event Event name
   * @param payload Event payload
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    // Call each handler, wrapping in try/catch to prevent one handler from breaking others
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (error) {
        // Log error but continue processing other handlers
        console.error(`Error in event handler for '${String(event)}':`, error);
      }
    }
  }

  /**
   * Subscribe to an event for a single occurrence
   * @param event Event name
   * @param handler Event handler
   * @returns Unsubscribe function
   */
  once<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void
  ): () => void {
    const wrappedHandler = (payload: EventMap[K]) => {
      handler(payload);
      this.off(event, wrappedHandler);
    };

    return this.on(event, wrappedHandler);
  }

  /**
   * Remove all event listeners
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of listeners for an event
   * @param event Event name
   * @returns Number of listeners
   */
  listenerCount(event: keyof EventMap): number {
    const handlers = this.listeners.get(event);
    return handlers ? handlers.size : 0;
  }
}
