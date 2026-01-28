import type { Message, AuditEvent, SecurityEvent, AgentId, Vote } from './types.js';

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
  'arbiter:ruling': { ruleId: string; type: string; decision: string };
  'overseer:gate': { gateId: string; passed: boolean; reason: string };
}

/**
 * Typed pub/sub event system for ARI
 */
export class EventBus {
  private listeners: Map<string, Set<Function>> = new Map();

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

    this.listeners.get(event)!.add(handler);

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
      handlers.delete(handler);
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
