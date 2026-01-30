import { z } from 'zod';

/**
 * Auth Profile Types
 *
 * Credential management with failover, expiry monitoring, and encryption.
 */

// ── Credential Type ─────────────────────────────────────────────────────────

export const CredentialTypeSchema = z.enum([
  'api_key',
  'oauth2',
  'basic',
  'bearer',
  'custom',
]);
export type CredentialType = z.infer<typeof CredentialTypeSchema>;

// ── Credential Status ───────────────────────────────────────────────────────

export const CredentialStatusSchema = z.enum([
  'active',
  'expired',
  'revoked',
  'pending',
  'error',
]);
export type CredentialStatus = z.infer<typeof CredentialStatusSchema>;

// ── Provider Type ───────────────────────────────────────────────────────────

export const ProviderTypeSchema = z.enum([
  'anthropic',
  'openai',
  'pushover',
  'telegram',
  'slack',
  'notion',
  'github',
  'custom',
]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

// ── Credential Schema ───────────────────────────────────────────────────────

export const CredentialSchema = z.object({
  /** Unique credential identifier */
  id: z.string().uuid(),
  /** Human-readable name */
  name: z.string(),
  /** Provider this credential is for */
  provider: ProviderTypeSchema,
  /** Credential type */
  type: CredentialTypeSchema,
  /** Current status */
  status: CredentialStatusSchema,
  /** Priority for failover (lower = higher priority) */
  priority: z.number().int().min(0).default(0),
  /** Encrypted credential data */
  encryptedData: z.string(),
  /** Encryption IV */
  iv: z.string(),
  /** Creation timestamp */
  createdAt: z.string().datetime(),
  /** Last used timestamp */
  lastUsedAt: z.string().datetime().optional(),
  /** Expiry timestamp */
  expiresAt: z.string().datetime().optional(),
  /** Last error message */
  lastError: z.string().optional(),
  /** Usage count */
  usageCount: z.number().int().default(0),
  /** Metadata */
  metadata: z.record(z.unknown()).default({}),
});
export type Credential = z.infer<typeof CredentialSchema>;

// ── Decrypted Credential Data ───────────────────────────────────────────────

export const CredentialDataSchema = z.object({
  /** API key or token */
  key: z.string().optional(),
  /** Secret (for OAuth, etc.) */
  secret: z.string().optional(),
  /** Username (for basic auth) */
  username: z.string().optional(),
  /** Password (for basic auth) */
  password: z.string().optional(),
  /** Refresh token (for OAuth) */
  refreshToken: z.string().optional(),
  /** Access token (for OAuth) */
  accessToken: z.string().optional(),
  /** Token expiry */
  tokenExpiresAt: z.string().datetime().optional(),
  /** Custom fields */
  custom: z.record(z.string()).optional(),
});
export type CredentialData = z.infer<typeof CredentialDataSchema>;

// ── Auth Profile Schema ─────────────────────────────────────────────────────

export const AuthProfileSchema = z.object({
  /** Unique profile identifier */
  id: z.string().uuid(),
  /** Profile name */
  name: z.string(),
  /** Provider */
  provider: ProviderTypeSchema,
  /** Associated credentials (ordered by priority) */
  credentials: z.array(z.string().uuid()),
  /** Active credential ID */
  activeCredentialId: z.string().uuid().optional(),
  /** Whether automatic failover is enabled */
  autoFailover: z.boolean().default(true),
  /** Failover cooldown in ms */
  failoverCooldown: z.number().default(60000),
  /** Last failover timestamp */
  lastFailoverAt: z.string().datetime().optional(),
  /** Creation timestamp */
  createdAt: z.string().datetime(),
  /** Last updated timestamp */
  updatedAt: z.string().datetime(),
  /** Enabled */
  enabled: z.boolean().default(true),
});
export type AuthProfile = z.infer<typeof AuthProfileSchema>;

// ── Create Credential Input ─────────────────────────────────────────────────

export const CreateCredentialInputSchema = z.object({
  name: z.string(),
  provider: ProviderTypeSchema,
  type: CredentialTypeSchema,
  data: CredentialDataSchema,
  priority: z.number().int().min(0).optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateCredentialInput = z.infer<typeof CreateCredentialInputSchema>;

// ── Create Profile Input ────────────────────────────────────────────────────

export const CreateProfileInputSchema = z.object({
  name: z.string(),
  provider: ProviderTypeSchema,
  autoFailover: z.boolean().optional(),
  failoverCooldown: z.number().optional(),
});
export type CreateProfileInput = z.infer<typeof CreateProfileInputSchema>;

// ── Credential Events ───────────────────────────────────────────────────────

export interface CredentialEvent {
  type: 'created' | 'updated' | 'used' | 'expired' | 'revoked' | 'error' | 'failover';
  credentialId: string;
  profileId?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

// ── Expiry Alert ────────────────────────────────────────────────────────────

export interface ExpiryAlert {
  credentialId: string;
  credentialName: string;
  provider: ProviderType;
  expiresAt: Date;
  daysUntilExpiry: number;
  severity: 'info' | 'warning' | 'critical';
}

// ── Provider Configuration ──────────────────────────────────────────────────

export interface ProviderConfig {
  /** Provider type */
  provider: ProviderType;
  /** Required credential fields */
  requiredFields: Array<keyof CredentialData>;
  /** Optional credential fields */
  optionalFields: Array<keyof CredentialData>;
  /** Whether provider supports refresh tokens */
  supportsRefresh: boolean;
  /** Typical expiry period in days (0 = never) */
  typicalExpiryDays: number;
}

export const PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
  anthropic: {
    provider: 'anthropic',
    requiredFields: ['key'],
    optionalFields: [],
    supportsRefresh: false,
    typicalExpiryDays: 0,
  },
  openai: {
    provider: 'openai',
    requiredFields: ['key'],
    optionalFields: [],
    supportsRefresh: false,
    typicalExpiryDays: 0,
  },
  pushover: {
    provider: 'pushover',
    requiredFields: ['key', 'secret'],
    optionalFields: ['custom'],
    supportsRefresh: false,
    typicalExpiryDays: 0,
  },
  telegram: {
    provider: 'telegram',
    requiredFields: ['key'],
    optionalFields: [],
    supportsRefresh: false,
    typicalExpiryDays: 0,
  },
  slack: {
    provider: 'slack',
    requiredFields: ['accessToken'],
    optionalFields: ['refreshToken'],
    supportsRefresh: true,
    typicalExpiryDays: 90,
  },
  notion: {
    provider: 'notion',
    requiredFields: ['key'],
    optionalFields: [],
    supportsRefresh: false,
    typicalExpiryDays: 0,
  },
  github: {
    provider: 'github',
    requiredFields: ['accessToken'],
    optionalFields: ['refreshToken'],
    supportsRefresh: true,
    typicalExpiryDays: 365,
  },
  custom: {
    provider: 'custom',
    requiredFields: [],
    optionalFields: ['key', 'secret', 'username', 'password', 'accessToken', 'refreshToken', 'custom'],
    supportsRefresh: false,
    typicalExpiryDays: 0,
  },
};
