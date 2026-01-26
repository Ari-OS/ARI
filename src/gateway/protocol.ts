/**
 * ARI vNext — Gateway Protocol
 *
 * Handles message parsing, validation, and response construction
 * for the WebSocket protocol.
 *
 * @module gateway/protocol
 * @version 1.0.0
 */

import * as crypto from 'node:crypto';
import {
  type ClientMessage,
  type ServerMessage,
  type InboundMessage,
  ClientMessageSchema,
  InboundMessageSchema,
  type Result,
  ok,
  err,
} from '../types/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE PARSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse and validate a raw WebSocket message
 */
export function parseClientMessage(raw: string): Result<ClientMessage, Error> {
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = ClientMessageSchema.safeParse(parsed);

    if (!result.success) {
      return err(new Error(`Invalid message format: ${result.error.message}`));
    }

    return ok(result.data);
  } catch (error) {
    return err(error instanceof Error ? error : new Error('Failed to parse message'));
  }
}

/**
 * Parse and validate an inbound message payload
 */
export function parseInboundMessage(payload: unknown): Result<InboundMessage, Error> {
  const result = InboundMessageSchema.safeParse(payload);

  if (!result.success) {
    return err(new Error(`Invalid inbound message: ${result.error.message}`));
  }

  return ok(result.data);
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE CONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════

export function createPong(requestId?: string): ServerMessage {
  return {
    type: 'pong',
    id: crypto.randomUUID(),
    request_id: requestId,
  };
}

export function createAck(requestId?: string, payload?: unknown): ServerMessage {
  return {
    type: 'ack',
    id: crypto.randomUUID(),
    request_id: requestId,
    payload,
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  requestId?: string,
  details?: unknown,
): ServerMessage {
  return {
    type: 'error',
    id: crypto.randomUUID(),
    request_id: requestId,
    error: { code, message, details },
  };
}

export function createSessionsResponse(
  sessions: unknown[],
  requestId?: string,
): ServerMessage {
  return {
    type: 'sessions',
    id: crypto.randomUUID(),
    request_id: requestId,
    payload: sessions,
  };
}

export function createHealthResponse(health: unknown, requestId?: string): ServerMessage {
  return {
    type: 'health_status',
    id: crypto.randomUUID(),
    request_id: requestId,
    payload: health,
  };
}

export function createEventMessage(eventType: string, data: unknown): ServerMessage {
  return {
    type: 'event',
    id: crypto.randomUUID(),
    payload: { event_type: eventType, data },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

export function serializeMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}
