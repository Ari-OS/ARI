/**
 * ARI vNext — Event Bus
 *
 * Type-safe publish/subscribe system for internal events.
 * All events flow through this bus for decoupled communication.
 *
 * @module gateway/event-bus
 * @version 1.0.0
 */

import * as crypto from 'node:crypto';
import { type EventType, type EventPayload } from '../types/index.js';
import { logger } from '../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type EventHandler = (event: EventPayload) => void | Promise<void>;

interface Subscription {
  id: string;
  eventType: EventType;
  handler: EventHandler;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT BUS CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class EventBus {
  private subscriptions: Map<EventType, Subscription[]> = new Map();
  private wildcardSubscriptions: Subscription[] = [];

  /**
   * Subscribe to a specific event type
   * Returns a subscription ID for unsubscribing
   */
  subscribe(eventType: EventType, handler: EventHandler): string {
    const id = crypto.randomUUID();
    const subscription: Subscription = { id, eventType, handler };

    const existing = this.subscriptions.get(eventType);
    if (existing) {
      existing.push(subscription);
    } else {
      this.subscriptions.set(eventType, [subscription]);
    }

    logger.debug({ eventType, subscriptionId: id }, 'Event subscription added');
    return id;
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(handler: EventHandler): string {
    const id = crypto.randomUUID();
    // We use a pseudo event type for wildcard subscriptions
    const subscription: Subscription = {
      id,
      eventType: '*' as EventType,
      handler,
    };
    this.wildcardSubscriptions.push(subscription);

    logger.debug({ subscriptionId: id }, 'Wildcard event subscription added');
    return id;
  }

  /**
   * Unsubscribe by subscription ID
   */
  unsubscribe(subscriptionId: string): boolean {
    // Check typed subscriptions
    for (const [eventType, subs] of this.subscriptions) {
      const idx = subs.findIndex((s) => s.id === subscriptionId);
      if (idx !== -1) {
        subs.splice(idx, 1);
        if (subs.length === 0) {
          this.subscriptions.delete(eventType);
        }
        logger.debug({ subscriptionId }, 'Event subscription removed');
        return true;
      }
    }

    // Check wildcard subscriptions
    const wcIdx = this.wildcardSubscriptions.findIndex((s) => s.id === subscriptionId);
    if (wcIdx !== -1) {
      this.wildcardSubscriptions.splice(wcIdx, 1);
      logger.debug({ subscriptionId }, 'Wildcard subscription removed');
      return true;
    }

    return false;
  }

  /**
   * Publish an event to all subscribers
   */
  async publish(
    eventType: EventType,
    data: unknown,
    source: string,
    correlationId?: string,
  ): Promise<void> {
    const event: EventPayload = {
      type: eventType,
      timestamp: new Date().toISOString(),
      data,
      source,
      correlation_id: correlationId,
    };

    const handlers: EventHandler[] = [];

    // Typed subscribers
    const typedSubs = this.subscriptions.get(eventType);
    if (typedSubs) {
      for (const sub of typedSubs) {
        handlers.push(sub.handler);
      }
    }

    // Wildcard subscribers
    for (const sub of this.wildcardSubscriptions) {
      handlers.push(sub.handler);
    }

    // Execute handlers (errors don't propagate between handlers)
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        logger.error(
          { eventType, error: error instanceof Error ? error.message : String(error) },
          'Event handler error',
        );
      }
    }
  }

  /**
   * Get the count of subscriptions for an event type
   */
  getSubscriptionCount(eventType?: EventType): number {
    if (eventType) {
      return (this.subscriptions.get(eventType)?.length ?? 0) + this.wildcardSubscriptions.length;
    }

    let total = this.wildcardSubscriptions.length;
    for (const subs of this.subscriptions.values()) {
      total += subs.length;
    }
    return total;
  }

  /**
   * Remove all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
    this.wildcardSubscriptions = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let eventBusInstance: EventBus | null = null;

export function getEventBus(): EventBus {
  if (eventBusInstance === null) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}

export function createEventBus(): EventBus {
  return new EventBus();
}

export function resetEventBus(): void {
  if (eventBusInstance) {
    eventBusInstance.clear();
  }
  eventBusInstance = null;
}
