import { describe, it, expect } from 'vitest';
import {
  CredentialTypeSchema,
  CredentialStatusSchema,
  ProviderTypeSchema,
  CredentialSchema,
  CredentialDataSchema,
  AuthProfileSchema,
  CreateCredentialInputSchema,
  CreateProfileInputSchema,
  PROVIDER_CONFIGS,
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
} from '../../../../src/kernel/auth/types.js';

describe('Auth Types Zod Schemas', () => {
  describe('CredentialTypeSchema', () => {
    it('should accept valid credential types', () => {
      const validTypes: CredentialType[] = ['api_key', 'oauth2', 'basic', 'bearer', 'custom'];

      for (const type of validTypes) {
        expect(CredentialTypeSchema.parse(type)).toBe(type);
      }
    });

    it('should reject invalid credential types', () => {
      expect(() => CredentialTypeSchema.parse('invalid')).toThrow();
      expect(() => CredentialTypeSchema.parse('')).toThrow();
      expect(() => CredentialTypeSchema.parse(123)).toThrow();
      expect(() => CredentialTypeSchema.parse(null)).toThrow();
    });
  });

  describe('CredentialStatusSchema', () => {
    it('should accept valid credential statuses', () => {
      const validStatuses: CredentialStatus[] = ['active', 'expired', 'revoked', 'pending', 'error'];

      for (const status of validStatuses) {
        expect(CredentialStatusSchema.parse(status)).toBe(status);
      }
    });

    it('should reject invalid credential statuses', () => {
      expect(() => CredentialStatusSchema.parse('invalid')).toThrow();
      expect(() => CredentialStatusSchema.parse('ACTIVE')).toThrow();
      expect(() => CredentialStatusSchema.parse(null)).toThrow();
    });
  });

  describe('ProviderTypeSchema', () => {
    it('should accept valid provider types', () => {
      const validProviders: ProviderType[] = [
        'anthropic', 'openai', 'pushover', 'telegram',
        'slack', 'notion', 'github', 'custom'
      ];

      for (const provider of validProviders) {
        expect(ProviderTypeSchema.parse(provider)).toBe(provider);
      }
    });

    it('should reject invalid provider types', () => {
      expect(() => ProviderTypeSchema.parse('aws')).toThrow();
      expect(() => ProviderTypeSchema.parse('')).toThrow();
      expect(() => ProviderTypeSchema.parse(undefined)).toThrow();
    });
  });

  describe('CredentialSchema', () => {
    const validCredential: Credential = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test API Key',
      provider: 'anthropic',
      type: 'api_key',
      status: 'active',
      priority: 0,
      encryptedData: 'encrypted-data-here',
      iv: 'iv-here',
      createdAt: '2024-01-15T10:30:00.000Z',
      usageCount: 5,
      metadata: { team: 'engineering' },
    };

    it('should accept valid credential', () => {
      const result = CredentialSchema.parse(validCredential);
      expect(result.id).toBe(validCredential.id);
      expect(result.name).toBe(validCredential.name);
      expect(result.provider).toBe(validCredential.provider);
      expect(result.status).toBe(validCredential.status);
    });

    it('should accept credential with optional fields', () => {
      const credWithOptional: Credential = {
        ...validCredential,
        lastUsedAt: '2024-01-16T08:00:00.000Z',
        expiresAt: '2024-12-31T23:59:59.000Z',
        lastError: 'Rate limit exceeded',
      };

      const result = CredentialSchema.parse(credWithOptional);
      expect(result.lastUsedAt).toBe(credWithOptional.lastUsedAt);
      expect(result.expiresAt).toBe(credWithOptional.expiresAt);
      expect(result.lastError).toBe(credWithOptional.lastError);
    });

    it('should apply default values', () => {
      const minimalCredential = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Minimal Key',
        provider: 'anthropic',
        type: 'api_key',
        status: 'active',
        encryptedData: 'data',
        iv: 'iv',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      const result = CredentialSchema.parse(minimalCredential);
      expect(result.priority).toBe(0);
      expect(result.usageCount).toBe(0);
      expect(result.metadata).toEqual({});
    });

    it('should reject invalid UUID', () => {
      const invalid = { ...validCredential, id: 'not-a-uuid' };
      expect(() => CredentialSchema.parse(invalid)).toThrow();
    });

    it('should reject invalid datetime format', () => {
      const invalid = { ...validCredential, createdAt: 'not-a-date' };
      expect(() => CredentialSchema.parse(invalid)).toThrow();
    });

    it('should reject negative priority', () => {
      const invalid = { ...validCredential, priority: -1 };
      expect(() => CredentialSchema.parse(invalid)).toThrow();
    });

    it('should reject missing required fields', () => {
      const { name, ...missingName } = validCredential;
      expect(() => CredentialSchema.parse(missingName)).toThrow();

      const { encryptedData, ...missingData } = validCredential;
      expect(() => CredentialSchema.parse(missingData)).toThrow();
    });
  });

  describe('CredentialDataSchema', () => {
    it('should accept valid credential data with key', () => {
      const data: CredentialData = {
        key: 'sk-test-api-key-12345',
      };
      const result = CredentialDataSchema.parse(data);
      expect(result.key).toBe(data.key);
    });

    it('should accept OAuth2 credential data', () => {
      const data: CredentialData = {
        accessToken: 'access-token-here',
        refreshToken: 'refresh-token-here',
        tokenExpiresAt: '2024-12-31T23:59:59.000Z',
      };
      const result = CredentialDataSchema.parse(data);
      expect(result.accessToken).toBe(data.accessToken);
      expect(result.refreshToken).toBe(data.refreshToken);
    });

    it('should accept basic auth credential data', () => {
      const data: CredentialData = {
        username: 'admin',
        password: 'secretpassword',
      };
      const result = CredentialDataSchema.parse(data);
      expect(result.username).toBe(data.username);
      expect(result.password).toBe(data.password);
    });

    it('should accept custom fields', () => {
      const data: CredentialData = {
        key: 'api-key',
        custom: {
          region: 'us-east-1',
          endpoint: 'https://api.example.com',
        },
      };
      const result = CredentialDataSchema.parse(data);
      expect(result.custom).toEqual(data.custom);
    });

    it('should accept empty credential data', () => {
      const result = CredentialDataSchema.parse({});
      expect(result).toEqual({});
    });

    it('should reject invalid tokenExpiresAt format', () => {
      const invalid = { tokenExpiresAt: 'invalid-date' };
      expect(() => CredentialDataSchema.parse(invalid)).toThrow();
    });
  });

  describe('AuthProfileSchema', () => {
    const validProfile: AuthProfile = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Production Anthropic',
      provider: 'anthropic',
      credentials: ['550e8400-e29b-41d4-a716-446655440000'],
      autoFailover: true,
      failoverCooldown: 60000,
      createdAt: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-15T10:30:00.000Z',
      enabled: true,
    };

    it('should accept valid auth profile', () => {
      const result = AuthProfileSchema.parse(validProfile);
      expect(result.id).toBe(validProfile.id);
      expect(result.name).toBe(validProfile.name);
      expect(result.provider).toBe(validProfile.provider);
    });

    it('should accept profile with active credential', () => {
      const profileWithActive = {
        ...validProfile,
        activeCredentialId: '550e8400-e29b-41d4-a716-446655440000',
      };
      const result = AuthProfileSchema.parse(profileWithActive);
      expect(result.activeCredentialId).toBe(profileWithActive.activeCredentialId);
    });

    it('should accept profile with last failover timestamp', () => {
      const profileWithFailover = {
        ...validProfile,
        lastFailoverAt: '2024-01-16T08:00:00.000Z',
      };
      const result = AuthProfileSchema.parse(profileWithFailover);
      expect(result.lastFailoverAt).toBe(profileWithFailover.lastFailoverAt);
    });

    it('should apply default values', () => {
      const minimalProfile = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Minimal Profile',
        provider: 'anthropic',
        credentials: [],
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      };

      const result = AuthProfileSchema.parse(minimalProfile);
      expect(result.autoFailover).toBe(true);
      expect(result.failoverCooldown).toBe(60000);
      expect(result.enabled).toBe(true);
    });

    it('should reject invalid credential UUID in array', () => {
      const invalid = {
        ...validProfile,
        credentials: ['not-a-uuid'],
      };
      expect(() => AuthProfileSchema.parse(invalid)).toThrow();
    });
  });

  describe('CreateCredentialInputSchema', () => {
    const validInput: CreateCredentialInput = {
      name: 'New API Key',
      provider: 'anthropic',
      type: 'api_key',
      data: { key: 'sk-test-key' },
    };

    it('should accept valid create credential input', () => {
      const result = CreateCredentialInputSchema.parse(validInput);
      expect(result.name).toBe(validInput.name);
      expect(result.provider).toBe(validInput.provider);
      expect(result.type).toBe(validInput.type);
    });

    it('should accept input with optional fields', () => {
      const inputWithOptional = {
        ...validInput,
        priority: 5,
        expiresAt: '2024-12-31T23:59:59.000Z',
        metadata: { environment: 'production' },
      };
      const result = CreateCredentialInputSchema.parse(inputWithOptional);
      expect(result.priority).toBe(5);
      expect(result.expiresAt).toBe(inputWithOptional.expiresAt);
      expect(result.metadata).toEqual(inputWithOptional.metadata);
    });

    it('should reject missing required fields', () => {
      const { name, ...missingName } = validInput;
      expect(() => CreateCredentialInputSchema.parse(missingName)).toThrow();

      const { data, ...missingData } = validInput;
      expect(() => CreateCredentialInputSchema.parse(missingData)).toThrow();
    });

    it('should reject invalid priority', () => {
      const invalid = { ...validInput, priority: -1 };
      expect(() => CreateCredentialInputSchema.parse(invalid)).toThrow();
    });
  });

  describe('CreateProfileInputSchema', () => {
    const validInput: CreateProfileInput = {
      name: 'New Profile',
      provider: 'anthropic',
    };

    it('should accept valid create profile input', () => {
      const result = CreateProfileInputSchema.parse(validInput);
      expect(result.name).toBe(validInput.name);
      expect(result.provider).toBe(validInput.provider);
    });

    it('should accept input with optional fields', () => {
      const inputWithOptional = {
        ...validInput,
        autoFailover: false,
        failoverCooldown: 30000,
      };
      const result = CreateProfileInputSchema.parse(inputWithOptional);
      expect(result.autoFailover).toBe(false);
      expect(result.failoverCooldown).toBe(30000);
    });

    it('should reject invalid provider', () => {
      const invalid = { ...validInput, provider: 'invalid-provider' };
      expect(() => CreateProfileInputSchema.parse(invalid)).toThrow();
    });
  });

  describe('PROVIDER_CONFIGS', () => {
    it('should have configuration for all provider types', () => {
      const providerTypes: ProviderType[] = [
        'anthropic', 'openai', 'pushover', 'telegram',
        'slack', 'notion', 'github', 'custom'
      ];

      for (const provider of providerTypes) {
        expect(PROVIDER_CONFIGS[provider]).toBeDefined();
        expect(PROVIDER_CONFIGS[provider].provider).toBe(provider);
      }
    });

    it('should have correct anthropic config', () => {
      const config = PROVIDER_CONFIGS.anthropic;
      expect(config.requiredFields).toContain('key');
      expect(config.supportsRefresh).toBe(false);
      expect(config.typicalExpiryDays).toBe(0);
    });

    it('should have correct openai config', () => {
      const config = PROVIDER_CONFIGS.openai;
      expect(config.requiredFields).toContain('key');
      expect(config.supportsRefresh).toBe(false);
    });

    it('should have correct pushover config', () => {
      const config = PROVIDER_CONFIGS.pushover;
      expect(config.requiredFields).toContain('key');
      expect(config.requiredFields).toContain('secret');
    });

    it('should have correct slack config with refresh support', () => {
      const config = PROVIDER_CONFIGS.slack;
      expect(config.requiredFields).toContain('accessToken');
      expect(config.optionalFields).toContain('refreshToken');
      expect(config.supportsRefresh).toBe(true);
      expect(config.typicalExpiryDays).toBe(90);
    });

    it('should have correct github config with refresh support', () => {
      const config = PROVIDER_CONFIGS.github;
      expect(config.requiredFields).toContain('accessToken');
      expect(config.supportsRefresh).toBe(true);
      expect(config.typicalExpiryDays).toBe(365);
    });

    it('should have custom config with all optional fields', () => {
      const config = PROVIDER_CONFIGS.custom;
      expect(config.requiredFields).toHaveLength(0);
      expect(config.optionalFields).toContain('key');
      expect(config.optionalFields).toContain('secret');
      expect(config.optionalFields).toContain('username');
      expect(config.optionalFields).toContain('password');
      expect(config.optionalFields).toContain('accessToken');
      expect(config.optionalFields).toContain('refreshToken');
      expect(config.optionalFields).toContain('custom');
    });
  });

  describe('Interface Types', () => {
    it('should define CredentialEvent correctly', () => {
      const event: CredentialEvent = {
        type: 'created',
        credentialId: '550e8400-e29b-41d4-a716-446655440000',
        profileId: '550e8400-e29b-41d4-a716-446655440001',
        timestamp: new Date(),
        details: { reason: 'test' },
      };

      expect(event.type).toBe('created');
      expect(event.credentialId).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should allow all CredentialEvent types', () => {
      const eventTypes: CredentialEvent['type'][] = [
        'created', 'updated', 'used', 'expired', 'revoked', 'error', 'failover'
      ];

      for (const type of eventTypes) {
        const event: CredentialEvent = {
          type,
          credentialId: 'test-id',
          timestamp: new Date(),
        };
        expect(event.type).toBe(type);
      }
    });

    it('should define ExpiryAlert correctly', () => {
      const alert: ExpiryAlert = {
        credentialId: '550e8400-e29b-41d4-a716-446655440000',
        credentialName: 'Test Key',
        provider: 'anthropic',
        expiresAt: new Date('2024-12-31'),
        daysUntilExpiry: 30,
        severity: 'warning',
      };

      expect(alert.credentialId).toBeDefined();
      expect(alert.credentialName).toBe('Test Key');
      expect(alert.severity).toBe('warning');
    });

    it('should allow all ExpiryAlert severities', () => {
      const severities: ExpiryAlert['severity'][] = ['info', 'warning', 'critical'];

      for (const severity of severities) {
        const alert: ExpiryAlert = {
          credentialId: 'test',
          credentialName: 'Test',
          provider: 'anthropic',
          expiresAt: new Date(),
          daysUntilExpiry: 10,
          severity,
        };
        expect(alert.severity).toBe(severity);
      }
    });

    it('should define ProviderConfig correctly', () => {
      const config: ProviderConfig = {
        provider: 'anthropic',
        requiredFields: ['key'],
        optionalFields: [],
        supportsRefresh: false,
        typicalExpiryDays: 0,
      };

      expect(config.provider).toBe('anthropic');
      expect(config.requiredFields).toContain('key');
    });
  });
});
