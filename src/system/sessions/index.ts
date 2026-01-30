/**
 * Sessions Module
 *
 * Multi-session architecture for ARI.
 * Provides isolated conversation contexts per channel/sender/group.
 */

export { SessionManager } from './session-manager.js';
export { SessionStore } from './session-store.js';
export { SessionContextManager } from './session-context.js';
export { SessionLifecycleManager } from './session-lifecycle.js';
export {
  // Types
  type Session,
  type SessionStatus,
  type SessionContext,
  type SessionStats,
  type SessionMetadata,
  type CreateSessionInput,
  type UpdateSessionInput,
  type SessionQuery,
  type SessionEvent,
  type SessionLifecycleConfig,

  // Schemas
  SessionSchema,
  SessionStatusSchema,
  SessionContextSchema,
  SessionStatsSchema,
  SessionMetadataSchema,
  CreateSessionInputSchema,
  UpdateSessionInputSchema,
  SessionQuerySchema,

  // Constants
  DEFAULT_SESSION_LIFECYCLE_CONFIG,

  // Utilities
  createSessionKey,
  parseSessionKey,
} from './types.js';
