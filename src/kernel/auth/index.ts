/**
 * Auth Module
 *
 * Credential management with failover, expiry monitoring, and encryption.
 */

// Types
export {
  // Types
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
  type ProviderConfig,

  // Schemas
  CredentialTypeSchema,
  CredentialStatusSchema,
  ProviderTypeSchema,
  CredentialSchema,
  CredentialDataSchema,
  AuthProfileSchema,
  CreateCredentialInputSchema,
  CreateProfileInputSchema,

  // Constants
  PROVIDER_CONFIGS,
} from './types.js';

// Credential Store
export { CredentialStore } from './credential-store.js';

// Profile Manager
export { AuthProfileManager } from './profile-manager.js';

// Expiry Monitor
export {
  ExpiryMonitor,
  type ExpiryMonitorConfig,
} from './expiry-monitor.js';
