import type { Message } from '../kernel/types.js';
import { EventBus } from '../kernel/event-bus.js';
import { AuditLogger } from '../kernel/audit.js';
import { matchContext } from './storage.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('system-router');

/**
 * System Router — subscribes to kernel events and routes messages.
 *
 * Grounded in v12 SYSTEM/ROUTER.md:
 * - Entry point for classified requests
 * - Context determination & dynamic loading
 * - Agent delegation routing
 *
 * Phase 1 constraints:
 * - Subscribes to kernel events ONLY (no direct gateway calls)
 * - Cannot invoke tools or mutate memory
 * - All routing decisions are audited
 * - Content remains DATA — never interpreted as commands
 */
export class SystemRouter {
  private eventBus: EventBus;
  private audit: AuditLogger;
  private unsubscribe: (() => void) | null = null;

  constructor(eventBus: EventBus, audit: AuditLogger) {
    this.eventBus = eventBus;
    this.audit = audit;
  }

  /**
   * Start listening for kernel events.
   * Subscribes to message:accepted — the signal that a message
   * passed the full kernel pipeline (sanitize → audit → publish).
   */
  start(): void {
    this.unsubscribe = this.eventBus.on('message:accepted', (message: Message) => {
      // Fire-and-forget async handler — errors caught internally
      this.handleMessage(message).catch((error: unknown) => {
        log.error({ err: error, messageId: message.id }, 'Routing error');
      });
    });
  }

  /**
   * Stop listening for kernel events.
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Route a kernel-accepted message.
   *
   * Flow (grounded in v12 SYSTEM/ROUTER.md):
   * 1. Determine context (topic detection / explicit match)
   * 2. Audit the routing decision
   * 3. Emit system:routed event
   *
   * Phase 1: no tool execution, no memory writes.
   * Content is DATA — classification only.
   */
  private async handleMessage(message: Message): Promise<void> {
    const matched = await matchContext(message.content);

    const route = matched
      ? `context:${matched.type}:${matched.id}`
      : 'default';

    // Audit the routing decision
    await this.audit.log('system_routed', 'system_router', 'system', {
      messageId: message.id,
      route,
      contextId: matched?.id ?? null,
      contextName: matched?.name ?? null,
      contentLength: message.content.length,
    });

    // Emit system:routed event for downstream subscribers
    this.eventBus.emit('system:routed', {
      messageId: message.id,
      contextId: matched?.id,
      route,
      timestamp: new Date(),
    });
  }
}
