import type { EventMap } from '../event-bus.js';
import type {
  SessionStartPayload,
  SessionEndPayload,
  MessagePayload,
  ToolStartPayload,
  ToolUpdatePayload,
  ToolEndPayload,
  ChannelStatusPayload,
} from './protocol.js';

/**
 * Control Plane Event Types
 *
 * Extends the main EventMap with control plane specific events.
 * These events bridge WebSocket clients to the internal event system.
 */

export interface ControlPlaneEventMap {
  // ── Client lifecycle ──────────────────────────────────────────────────────
  'controlplane:client:connected': {
    clientId: string;
    clientType: string;
    connectedAt: Date;
  };
  'controlplane:client:disconnected': {
    clientId: string;
    reason: string;
    disconnectedAt: Date;
  };
  'controlplane:client:authenticated': {
    clientId: string;
    capabilities: string[];
    authenticatedAt: Date;
  };

  // ── Session events (bridged from channels) ────────────────────────────────
  'controlplane:session:started': SessionStartPayload & { startedAt: Date };
  'controlplane:session:ended': SessionEndPayload & { endedAt: Date };

  // ── Message events (bridged from channels) ────────────────────────────────
  'controlplane:message:inbound': MessagePayload;
  'controlplane:message:outbound': MessagePayload;

  // ── Tool streaming events ─────────────────────────────────────────────────
  'controlplane:tool:start': ToolStartPayload;
  'controlplane:tool:update': ToolUpdatePayload;
  'controlplane:tool:end': ToolEndPayload;

  // ── Channel status events ─────────────────────────────────────────────────
  'controlplane:channel:status': ChannelStatusPayload;
  'controlplane:channel:connected': {
    channelId: string;
    channelName: string;
    connectedAt: Date;
  };
  'controlplane:channel:disconnected': {
    channelId: string;
    channelName: string;
    reason: string;
    disconnectedAt: Date;
  };

  // ── Server events ─────────────────────────────────────────────────────────
  'controlplane:server:started': {
    host: string;
    port: number;
    startedAt: Date;
  };
  'controlplane:server:stopped': {
    reason: string;
    stoppedAt: Date;
  };
  'controlplane:server:error': {
    error: Error;
    context: string;
  };
}

/**
 * Extended EventMap including control plane events
 */
export type ExtendedEventMap = EventMap & ControlPlaneEventMap;

/**
 * List of subscribable event patterns for clients
 */
export const SUBSCRIBABLE_EVENTS = [
  // Wildcard subscriptions
  'session:*',
  'message:*',
  'tool:*',
  'channel:*',

  // Specific session events
  'session:start',
  'session:end',

  // Specific message events
  'message:inbound',
  'message:outbound',
  'message:processed',

  // Specific tool events
  'tool:start',
  'tool:update',
  'tool:end',

  // Channel events
  'channel:status',

  // System events
  'system:ready',
  'system:error',
] as const;

export type SubscribableEvent = typeof SUBSCRIBABLE_EVENTS[number];

/**
 * Checks if an event pattern matches a specific event
 */
export function eventMatches(pattern: string, event: string): boolean {
  if (pattern === event) return true;
  if (pattern.endsWith(':*')) {
    const prefix = pattern.slice(0, -2);
    return event.startsWith(prefix + ':');
  }
  return false;
}

/**
 * Maps internal EventBus events to control plane message types
 */
export const EVENT_TO_MESSAGE_TYPE: Record<string, string> = {
  'message:received': 'message:received',
  'message:processed': 'message:processed',
  'tool:executed': 'tool:end',
  'security:detected': 'error',
  'system:ready': 'health:pong',
  'system:error': 'error',
};

/**
 * Events that require authentication to receive
 */
export const PROTECTED_EVENTS = new Set([
  'tool:*',
  'tool:start',
  'tool:update',
  'tool:end',
  'system:*',
  'security:*',
]);

/**
 * Events that require admin capability to receive
 */
export const ADMIN_ONLY_EVENTS = new Set([
  'security:*',
  'audit:*',
]);
