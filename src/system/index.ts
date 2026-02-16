export { ContextTypeSchema, ContextSchema, RouteResultSchema, ActiveContextSchema } from './types.js';
export type { ContextType, Context, RouteResult, ActiveContext } from './types.js';
export { listContexts, getContext, saveContext, getActiveContext, setActiveContext, matchContext, ensureContextsDir, getContextsDir } from './storage.js';
export { SystemRouter } from './router.js';
export { ContextLayerManager } from './context-layers.js';
export type { ContextLayer, LayeredContext, Session as ContextSession } from './context-layers.js';

// VectorStore exports
export {
  VectorStore,
  createVectorStore,
  computeContentHash,
  cosineSimilarity,
  VectorStoreError,
  DuplicateContentError,
  InvalidEmbeddingError,
  DocumentNotFoundError,
  VectorDocumentSchema,
  SearchOptionsSchema,
  SearchResultSchema,
  StoreStatsSchema,
  UpsertDocumentInputSchema,
  SourceTypeSchema as VectorSourceTypeSchema,
} from './vector-store.js';
export type {
  VectorDocument,
  SearchOptions,
  SearchResult,
  StoreStats,
  UpsertDocumentInput,
  SourceType as VectorSourceType,
} from './vector-store.js';

// Sessions exports
export {
  SessionManager,
  SessionStore,
  SessionContextManager,
  SessionLifecycleManager,
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
  SessionSchema,
  SessionStatusSchema,
  DEFAULT_SESSION_LIFECYCLE_CONFIG,
  createSessionKey,
  parseSessionKey,
} from './sessions/index.js';
