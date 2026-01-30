export {
  TrustLevelSchema, MessageSchema, AuditEventSchema, SecurityEventSchema,
  ConfigSchema, SanitizeResultSchema,
  AgentIdSchema, SourceTypeSchema, PermissionTierSchema,
  MemoryTypeSchema, MemoryPartitionSchema, MemoryEntrySchema,
  VoteOptionSchema, VoteThresholdSchema, VoteSchema, ToolDefinitionSchema,
  TRUST_SCORES, PERMISSION_LEVELS, VOTING_AGENTS,
} from './types.js';
export type {
  TrustLevel, Message, AuditEvent, SecurityEvent, Config, SanitizeResult,
  AgentId, SourceType, PermissionTier,
  MemoryType, MemoryPartition, MemoryEntry,
  VoteOption, VoteThreshold, Vote, ToolDefinition,
} from './types.js';
export { sanitize, isSafe, INJECTION_PATTERNS } from './sanitizer.js';
export { AuditLogger } from './audit.js';
export { EventBus } from './event-bus.js';
export type { EventMap } from './event-bus.js';
export { Gateway } from './gateway.js';
export { loadConfig, saveConfig, ensureConfigDir, getConfigDir, getConfigPath, DEFAULT_CONFIG, CONFIG_DIR, CONFIG_PATH } from './config.js';

// Control Plane exports
export {
  WebSocketControlPlane,
  ClientManager,
  MessageRouter,
  type ControlPlaneConfig,
  type ConnectedClient,
  type ClientCapability,
  type ClientStats,
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
  ControlPlaneMessageSchema,
  parseMessage,
  safeParseMessage,
  createMessage,
  createErrorMessage,
  MESSAGE_TYPES,
  SUBSCRIBABLE_EVENTS,
  eventMatches,
} from './control-plane/index.js';

// Auth exports
export {
  CredentialStore,
  AuthProfileManager,
  ExpiryMonitor,
  type CredentialType,
  type CredentialStatus,
  type ProviderType,
  type Credential,
  type CredentialData,
  type AuthProfile,
  type CreateCredentialInput,
  type CreateProfileInput,
  type CredentialEvent,
  type ExpiryAlert,
  type ExpiryMonitorConfig,
  CredentialSchema,
  AuthProfileSchema,
  PROVIDER_CONFIGS,
} from './auth/index.js';
