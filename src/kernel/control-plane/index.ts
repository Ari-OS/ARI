/**
 * Control Plane Module
 *
 * Real-time WebSocket communication layer for ARI.
 * Provides bidirectional messaging between ARI's internal event system
 * and external clients (dashboards, channels, monitors).
 *
 * SECURITY: All connections bound to 127.0.0.1 only.
 */

export { WebSocketControlPlane, type ControlPlaneConfig } from './websocket-server.js';
export { ClientManager, type ConnectedClient, type ClientCapability, type ClientStats, CLIENT_TYPE_CAPABILITIES } from './client-manager.js';
export { MessageRouter } from './message-router.js';
export {
  // Protocol types
  type ControlPlaneMessage,
  type MessageType,
  type SessionStartPayload,
  type SessionEndPayload,
  type MessagePayload,
  type ToolStartPayload,
  type ToolUpdatePayload,
  type ToolEndPayload,
  type ChannelStatusPayload,
  type HealthPayload,
  type ErrorPayload,
  type AuthPayload,
  type AuthResponsePayload,

  // Schemas for validation
  ControlPlaneMessageSchema,
  SessionStartPayloadSchema,
  SessionEndPayloadSchema,
  MessagePayloadSchema,
  ToolStartPayloadSchema,
  ToolUpdatePayloadSchema,
  ToolEndPayloadSchema,
  ChannelStatusPayloadSchema,
  HealthPayloadSchema,
  ErrorPayloadSchema,
  AuthPayloadSchema,
  AuthResponsePayloadSchema,

  // Utility functions
  parseMessage,
  safeParseMessage,
  createMessage,
  createErrorMessage,
  MESSAGE_TYPES,
} from './protocol.js';
export {
  type ControlPlaneEventMap,
  type ExtendedEventMap,
  type SubscribableEvent,
  SUBSCRIBABLE_EVENTS,
  PROTECTED_EVENTS,
  ADMIN_ONLY_EVENTS,
  eventMatches,
  EVENT_TO_MESSAGE_TYPE,
} from './events.js';
