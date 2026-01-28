/**
 * ARI vNext — Main Exports
 *
 * Public API surface for the ARI library.
 *
 * @module ari-vnext
 * @version 1.0.0
 */

// Types
export {
  type Channel,
  type TrustLevel,
  type AuditAction,
  type EventType,
  type Attachment,
  type InboundMessage,
  type SanitizationFlags,
  type SanitizedMessage,
  type AuditActor,
  type AuditEntry,
  type ClientMessage,
  type ServerMessage,
  type HealthStatus,
  type SessionInfo,
  type RefinedPrompt,
  type Config,
  type EventPayload,
  type Result,
  ok,
  err,
  isOk,
  isErr,
} from './types/index.js';

// Config
export {
  getConfig,
  loadConfig,
  ensureConfig,
  ensureDirectories,
  DEFAULT_CONFIG,
  getBaseDir,
  getAuditPath,
  getLogsPath,
} from './config/config.js';

// Security
export { Sanitizer, getSanitizer, createSanitizer } from './security/sanitizer.js';

// Audit
export {
  AuditLog,
  getAuditLog,
  createAuditLog,
  audit,
  systemActor,
  operatorActor,
  senderActor,
  serviceActor,
} from './audit/audit-log.js';

// Gateway
export { Gateway, getGateway, createGateway } from './gateway/gateway.js';
export { EventBus, getEventBus, createEventBus } from './gateway/event-bus.js';

// Prompting
export { PromptRefiner, getPromptRefiner, createPromptRefiner } from './prompting/prompt-refiner.js';

// Logging
export { createLogger, logger } from './utils/logger.js';
