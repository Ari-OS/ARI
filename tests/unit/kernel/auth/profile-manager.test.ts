import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthProfileManager } from '../../../../src/kernel/auth/profile-manager.js';
import type { CredentialStore } from '../../../../src/kernel/auth/credential-store.js';
import type { EventBus } from '../../../../src/kernel/event-bus.js';
import type { AuditLogger } from '../../../../src/kernel/audit.js';
import type {
  Credential,
  CredentialData,
  CreateCredentialInput,
  CreateProfileInput,
  CredentialEvent,
} from '../../../../src/kernel/auth/types.js';

describe('AuthProfileManager', () => {
  let manager: AuthProfileManager;
  let mockCredentialStore: CredentialStore;
  let mockEventBus: EventBus;
  let mockAudit: AuditLogger;

  // Counter for generating unique IDs
  let idCounter = 0;

  // Helper to create mock credentials
  function createMockCredential(
    overrides: Partial<Credential> = {}
  ): Credential {
    idCounter++;
    return {
      id: overrides.id || `cred-${idCounter}`,
      name: 'Test Credential',
      provider: 'anthropic',
      type: 'api_key',
      status: 'active',
      priority: 0,
      encryptedData: 'encrypted',
      iv: 'iv',
      createdAt: new Date().toISOString(),
      usageCount: 0,
      metadata: {},
      ...overrides,
    };
  }

  beforeEach(() => {
    idCounter = 0;
    vi.useFakeTimers();

    // Store for credentials
    const credentialsMap = new Map<string, Credential>();

    // Create mock credential store
    mockCredentialStore = {
      initialize: vi.fn().mockResolvedValue(undefined),
      isInitialized: vi.fn().mockReturnValue(true),
      size: 0,
      create: vi.fn().mockImplementation(async (input: CreateCredentialInput) => {
        const cred = createMockCredential({
          name: input.name,
          provider: input.provider,
          type: input.type,
          priority: input.priority ?? 0,
          expiresAt: input.expiresAt,
          metadata: input.metadata || {},
        });
        credentialsMap.set(cred.id, cred);
        mockCredentialStore.size = credentialsMap.size;
        return cred;
      }),
      get: vi.fn().mockImplementation((id: string) => credentialsMap.get(id) || null),
      getAll: vi.fn().mockImplementation(() => Array.from(credentialsMap.values())),
      delete: vi.fn().mockImplementation(async (id: string) => {
        const deleted = credentialsMap.delete(id);
        mockCredentialStore.size = credentialsMap.size;
        return deleted;
      }),
      markUsed: vi.fn().mockResolvedValue(undefined),
      setStatus: vi.fn().mockImplementation(async (id: string, status: string, error?: string) => {
        const cred = credentialsMap.get(id);
        if (cred) {
          cred.status = status as Credential['status'];
          if (error) cred.lastError = error;
        }
      }),
      encryptCredentialData: vi.fn().mockReturnValue({
        encryptedData: 'encrypted',
        iv: 'iv',
      }),
      decryptCredentialData: vi.fn().mockReturnValue({
        key: 'decrypted-key',
      }),
    } as unknown as CredentialStore;

    // Create mock event bus
    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn().mockReturnValue(() => {}),
    } as unknown as EventBus;

    // Create mock audit logger
    mockAudit = {
      log: vi.fn().mockResolvedValue({}),
    } as unknown as AuditLogger;

    manager = new AuthProfileManager(mockCredentialStore, mockEventBus, mockAudit);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with master password', async () => {
      expect(manager.isInitialized()).toBe(false);

      await manager.initialize('master-password');

      expect(manager.isInitialized()).toBe(true);
      expect(mockCredentialStore.initialize).toHaveBeenCalledWith('master-password');
    });

    it('should audit initialization', async () => {
      await manager.initialize('master-password');

      expect(mockAudit.log).toHaveBeenCalledWith(
        'auth_profile_manager_initialized',
        'system',
        'system',
        expect.objectContaining({
          credentialCount: expect.any(Number),
        })
      );
    });

    it('should not reinitialize if already initialized', async () => {
      await manager.initialize('password');
      await manager.initialize('different-password');

      expect(mockCredentialStore.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('profile management', () => {
    beforeEach(async () => {
      await manager.initialize('password');
    });

    describe('createProfile', () => {
      it('should create a new profile', async () => {
        const input: CreateProfileInput = {
          name: 'Production Anthropic',
          provider: 'anthropic',
        };

        const profile = await manager.createProfile(input);

        expect(profile.id).toBeDefined();
        expect(profile.name).toBe(input.name);
        expect(profile.provider).toBe(input.provider);
        expect(profile.credentials).toEqual([]);
        expect(profile.enabled).toBe(true);
        expect(profile.autoFailover).toBe(true);
        expect(profile.failoverCooldown).toBe(60000);
      });

      it('should create profile with custom failover settings', async () => {
        const profile = await manager.createProfile({
          name: 'No Failover Profile',
          provider: 'openai',
          autoFailover: false,
          failoverCooldown: 30000,
        });

        expect(profile.autoFailover).toBe(false);
        expect(profile.failoverCooldown).toBe(30000);
      });

      it('should audit profile creation', async () => {
        const profile = await manager.createProfile({
          name: 'Test Profile',
          provider: 'anthropic',
        });

        expect(mockAudit.log).toHaveBeenCalledWith(
          'auth_profile_created',
          'system',
          'system',
          expect.objectContaining({
            profileId: profile.id,
            provider: 'anthropic',
          })
        );
      });
    });

    describe('getProfile', () => {
      it('should retrieve profile by ID', async () => {
        const created = await manager.createProfile({
          name: 'Test Profile',
          provider: 'anthropic',
        });

        const retrieved = manager.getProfile(created.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.name).toBe(created.name);
      });

      it('should return null for non-existent profile', () => {
        const retrieved = manager.getProfile('non-existent');
        expect(retrieved).toBeNull();
      });
    });

    describe('getProfilesByProvider', () => {
      it('should return profiles for specific provider', async () => {
        await manager.createProfile({ name: 'Anthropic 1', provider: 'anthropic' });
        await manager.createProfile({ name: 'Anthropic 2', provider: 'anthropic' });
        await manager.createProfile({ name: 'OpenAI', provider: 'openai' });

        const anthropicProfiles = manager.getProfilesByProvider('anthropic');

        expect(anthropicProfiles).toHaveLength(2);
        expect(anthropicProfiles.every(p => p.provider === 'anthropic')).toBe(true);
      });

      it('should return empty array for provider with no profiles', () => {
        const profiles = manager.getProfilesByProvider('slack');
        expect(profiles).toEqual([]);
      });
    });

    describe('getAllProfiles', () => {
      it('should return all profiles', async () => {
        await manager.createProfile({ name: 'Profile 1', provider: 'anthropic' });
        await manager.createProfile({ name: 'Profile 2', provider: 'openai' });
        await manager.createProfile({ name: 'Profile 3', provider: 'github' });

        const all = manager.getAllProfiles();

        expect(all).toHaveLength(3);
      });

      it('should return empty array when no profiles', () => {
        const all = manager.getAllProfiles();
        expect(all).toEqual([]);
      });
    });

    describe('enableProfile / disableProfile', () => {
      it('should enable a profile', async () => {
        const profile = await manager.createProfile({
          name: 'Test',
          provider: 'anthropic',
        });

        // First disable it
        manager.disableProfile(profile.id);
        expect(manager.getProfile(profile.id)?.enabled).toBe(false);

        // Then enable it
        const result = manager.enableProfile(profile.id);

        expect(result).toBe(true);
        expect(manager.getProfile(profile.id)?.enabled).toBe(true);
      });

      it('should disable a profile', async () => {
        const profile = await manager.createProfile({
          name: 'Test',
          provider: 'anthropic',
        });

        const result = manager.disableProfile(profile.id);

        expect(result).toBe(true);
        expect(manager.getProfile(profile.id)?.enabled).toBe(false);
      });

      it('should return false for non-existent profile', () => {
        expect(manager.enableProfile('non-existent')).toBe(false);
        expect(manager.disableProfile('non-existent')).toBe(false);
      });

      it('should update updatedAt timestamp', async () => {
        const profile = await manager.createProfile({
          name: 'Test',
          provider: 'anthropic',
        });
        const originalUpdatedAt = profile.updatedAt;

        // Advance time
        vi.advanceTimersByTime(1000);

        manager.disableProfile(profile.id);

        const updated = manager.getProfile(profile.id);
        expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
      });
    });

    describe('deleteProfile', () => {
      it('should delete profile and its credentials', async () => {
        const profile = await manager.createProfile({
          name: 'To Delete',
          provider: 'anthropic',
        });

        // Add a credential
        await manager.addCredential(profile.id, {
          name: 'Cred 1',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key' },
        });

        const result = await manager.deleteProfile(profile.id);

        expect(result).toBe(true);
        expect(manager.getProfile(profile.id)).toBeNull();
        expect(mockCredentialStore.delete).toHaveBeenCalled();
      });

      it('should return false for non-existent profile', async () => {
        const result = await manager.deleteProfile('non-existent');
        expect(result).toBe(false);
      });

      it('should audit profile deletion', async () => {
        const profile = await manager.createProfile({
          name: 'To Delete',
          provider: 'anthropic',
        });

        await manager.deleteProfile(profile.id);

        expect(mockAudit.log).toHaveBeenCalledWith(
          'auth_profile_deleted',
          'system',
          'system',
          expect.objectContaining({
            profileId: profile.id,
          })
        );
      });
    });
  });

  describe('credential management', () => {
    let profile: Awaited<ReturnType<typeof manager.createProfile>>;

    beforeEach(async () => {
      await manager.initialize('password');
      profile = await manager.createProfile({
        name: 'Test Profile',
        provider: 'anthropic',
      });
    });

    describe('addCredential', () => {
      it('should add credential to profile', async () => {
        const credential = await manager.addCredential(profile.id, {
          name: 'API Key',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'sk-test' },
        });

        expect(credential.id).toBeDefined();
        expect(credential.name).toBe('API Key');

        const updatedProfile = manager.getProfile(profile.id);
        expect(updatedProfile?.credentials).toContain(credential.id);
      });

      it('should set first credential as active', async () => {
        const credential = await manager.addCredential(profile.id, {
          name: 'First Key',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key1' },
        });

        const updatedProfile = manager.getProfile(profile.id);
        expect(updatedProfile?.activeCredentialId).toBe(credential.id);
      });

      it('should not override active credential for subsequent additions', async () => {
        const first = await manager.addCredential(profile.id, {
          name: 'First Key',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key1' },
        });

        await manager.addCredential(profile.id, {
          name: 'Second Key',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key2' },
        });

        const updatedProfile = manager.getProfile(profile.id);
        expect(updatedProfile?.activeCredentialId).toBe(first.id);
      });

      it('should throw for non-existent profile', async () => {
        await expect(
          manager.addCredential('non-existent', {
            name: 'Key',
            provider: 'anthropic',
            type: 'api_key',
            data: { key: 'key' },
          })
        ).rejects.toThrow('Profile not found');
      });

      it('should throw for mismatched provider', async () => {
        await expect(
          manager.addCredential(profile.id, {
            name: 'Key',
            provider: 'openai', // Different from profile
            type: 'api_key',
            data: { key: 'key' },
          })
        ).rejects.toThrow("doesn't match profile provider");
      });

      it('should emit credential created event', async () => {
        const events: CredentialEvent[] = [];
        manager.onEvent(event => events.push(event));

        await manager.addCredential(profile.id, {
          name: 'Key',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key' },
        });

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('created');
        expect(events[0].profileId).toBe(profile.id);
      });

      it('should audit credential addition', async () => {
        const credential = await manager.addCredential(profile.id, {
          name: 'Key',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key' },
        });

        expect(mockAudit.log).toHaveBeenCalledWith(
          'auth_credential_added',
          'system',
          'system',
          expect.objectContaining({
            profileId: profile.id,
            credentialId: credential.id,
            provider: 'anthropic',
          })
        );
      });
    });

    describe('removeCredential', () => {
      it('should remove credential from profile', async () => {
        const credential = await manager.addCredential(profile.id, {
          name: 'Key',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key' },
        });

        const result = await manager.removeCredential(profile.id, credential.id);

        expect(result).toBe(true);
        expect(manager.getProfile(profile.id)?.credentials).not.toContain(credential.id);
        expect(mockCredentialStore.delete).toHaveBeenCalledWith(credential.id);
      });

      it('should switch active credential when removed', async () => {
        const cred1 = await manager.addCredential(profile.id, {
          name: 'Key 1',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key1' },
        });

        const cred2 = await manager.addCredential(profile.id, {
          name: 'Key 2',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key2' },
        });

        expect(manager.getProfile(profile.id)?.activeCredentialId).toBe(cred1.id);

        await manager.removeCredential(profile.id, cred1.id);

        expect(manager.getProfile(profile.id)?.activeCredentialId).toBe(cred2.id);
      });

      it('should return false for non-existent profile', async () => {
        const result = await manager.removeCredential('non-existent', 'cred-id');
        expect(result).toBe(false);
      });

      it('should return false for non-existent credential', async () => {
        const result = await manager.removeCredential(profile.id, 'non-existent');
        expect(result).toBe(false);
      });

      it('should audit credential removal', async () => {
        const credential = await manager.addCredential(profile.id, {
          name: 'Key',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key' },
        });

        await manager.removeCredential(profile.id, credential.id);

        expect(mockAudit.log).toHaveBeenCalledWith(
          'auth_credential_removed',
          'system',
          'system',
          expect.objectContaining({
            profileId: profile.id,
            credentialId: credential.id,
          })
        );
      });
    });
  });

  describe('credential data access', () => {
    let profile: Awaited<ReturnType<typeof manager.createProfile>>;
    let credential: Credential;

    beforeEach(async () => {
      await manager.initialize('password');
      profile = await manager.createProfile({
        name: 'Test Profile',
        provider: 'anthropic',
      });
      credential = await manager.addCredential(profile.id, {
        name: 'Key',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'sk-test' },
      });
    });

    describe('getActiveCredentialData', () => {
      it('should return decrypted credential data', async () => {
        const data = await manager.getActiveCredentialData(profile.id);

        expect(data).not.toBeNull();
        expect(mockCredentialStore.decryptCredentialData).toHaveBeenCalled();
        expect(mockCredentialStore.markUsed).toHaveBeenCalledWith(credential.id);
      });

      it('should emit used event', async () => {
        const events: CredentialEvent[] = [];
        manager.onEvent(event => events.push(event));

        await manager.getActiveCredentialData(profile.id);

        const usedEvent = events.find(e => e.type === 'used');
        expect(usedEvent).toBeDefined();
        expect(usedEvent?.credentialId).toBe(credential.id);
      });

      it('should return null for non-existent profile', async () => {
        const data = await manager.getActiveCredentialData('non-existent');
        expect(data).toBeNull();
      });

      it('should return null for profile without active credential', async () => {
        const emptyProfile = await manager.createProfile({
          name: 'Empty',
          provider: 'openai',
        });

        const data = await manager.getActiveCredentialData(emptyProfile.id);
        expect(data).toBeNull();
      });

      it('should handle decryption errors', async () => {
        vi.mocked(mockCredentialStore.decryptCredentialData).mockImplementation(() => {
          throw new Error('Decryption failed');
        });

        const data = await manager.getActiveCredentialData(profile.id);

        expect(data).toBeNull();
        expect(mockCredentialStore.setStatus).toHaveBeenCalledWith(
          credential.id,
          'error',
          'Decryption failed'
        );
      });
    });
  });

  describe('failover', () => {
    let profile: Awaited<ReturnType<typeof manager.createProfile>>;
    let cred1: Credential;
    let cred2: Credential;

    beforeEach(async () => {
      await manager.initialize('password');
      profile = await manager.createProfile({
        name: 'Failover Profile',
        provider: 'anthropic',
        autoFailover: true,
        failoverCooldown: 60000,
      });

      cred1 = await manager.addCredential(profile.id, {
        name: 'Primary Key',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key1' },
        priority: 0,
      });

      cred2 = await manager.addCredential(profile.id, {
        name: 'Backup Key',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key2' },
        priority: 1,
      });
    });

    describe('reportFailure', () => {
      it('should failover to next available credential', async () => {
        expect(manager.getProfile(profile.id)?.activeCredentialId).toBe(cred1.id);

        const nextCred = await manager.reportFailure(profile.id, 'Rate limit exceeded');

        expect(nextCred).not.toBeNull();
        expect(nextCred?.id).toBe(cred2.id);
        expect(manager.getProfile(profile.id)?.activeCredentialId).toBe(cred2.id);
      });

      it('should mark failed credential with error status', async () => {
        await manager.reportFailure(profile.id, 'Authentication failed');

        expect(mockCredentialStore.setStatus).toHaveBeenCalledWith(
          cred1.id,
          'error',
          'Authentication failed'
        );
      });

      it('should emit error and failover events', async () => {
        const events: CredentialEvent[] = [];
        manager.onEvent(event => events.push(event));

        await manager.reportFailure(profile.id, 'Error');

        const errorEvent = events.find(e => e.type === 'error');
        const failoverEvent = events.find(e => e.type === 'failover');

        expect(errorEvent).toBeDefined();
        expect(errorEvent?.credentialId).toBe(cred1.id);
        expect(failoverEvent).toBeDefined();
        expect(failoverEvent?.credentialId).toBe(cred2.id);
      });

      it('should audit failover', async () => {
        await manager.reportFailure(profile.id, 'Error');

        expect(mockAudit.log).toHaveBeenCalledWith(
          'auth_failover',
          'system',
          'system',
          expect.any(Object)
        );
      });

      it('should return null when no failover available', async () => {
        // Remove backup credential
        await manager.removeCredential(profile.id, cred2.id);

        const nextCred = await manager.reportFailure(profile.id, 'Error');

        expect(nextCred).toBeNull();
      });

      it('should respect failover cooldown', async () => {
        // First failover
        await manager.reportFailure(profile.id, 'Error 1');
        expect(manager.getProfile(profile.id)?.activeCredentialId).toBe(cred2.id);

        // Add another credential
        const cred3 = await manager.addCredential(profile.id, {
          name: 'Third Key',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key3' },
          priority: 2,
        });

        // Try failover again immediately (within cooldown)
        const result = await manager.reportFailure(profile.id, 'Error 2');

        expect(result).toBeNull();
        expect(mockAudit.log).toHaveBeenCalledWith(
          'auth_failover_cooldown',
          'system',
          'system',
          expect.any(Object)
        );
      });

      it('should allow failover after cooldown expires', async () => {
        // First failover
        await manager.reportFailure(profile.id, 'Error 1');

        // Add another credential
        const cred3 = await manager.addCredential(profile.id, {
          name: 'Third Key',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key3' },
          priority: 2,
        });

        // Advance past cooldown
        vi.advanceTimersByTime(61000);

        // Try failover again
        const result = await manager.reportFailure(profile.id, 'Error 2');

        expect(result).not.toBeNull();
        expect(result?.id).toBe(cred3.id);
      });

      it('should not failover when autoFailover is disabled', async () => {
        const noFailoverProfile = await manager.createProfile({
          name: 'No Failover',
          provider: 'openai',
          autoFailover: false,
        });

        const cred = await manager.addCredential(noFailoverProfile.id, {
          name: 'Key',
          provider: 'openai',
          type: 'api_key',
          data: { key: 'key' },
        });

        await manager.addCredential(noFailoverProfile.id, {
          name: 'Backup',
          provider: 'openai',
          type: 'api_key',
          data: { key: 'backup' },
        });

        const result = await manager.reportFailure(noFailoverProfile.id, 'Error');

        expect(result).toBeNull();
        expect(manager.getProfile(noFailoverProfile.id)?.activeCredentialId).toBe(cred.id);
      });

      it('should skip expired credentials during failover', async () => {
        // Mark cred2 as expired
        vi.mocked(mockCredentialStore.get).mockImplementation((id: string) => {
          if (id === cred1.id) {
            return { ...cred1, status: 'error' };
          }
          if (id === cred2.id) {
            return {
              ...cred2,
              status: 'active',
              expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            };
          }
          return null;
        });

        const result = await manager.reportFailure(profile.id, 'Error');

        expect(result).toBeNull();
        expect(mockCredentialStore.setStatus).toHaveBeenCalledWith(cred2.id, 'expired');
      });

      it('should return null for non-existent profile', async () => {
        const result = await manager.reportFailure('non-existent', 'Error');
        expect(result).toBeNull();
      });

      it('should return null for profile without active credential', async () => {
        const emptyProfile = await manager.createProfile({
          name: 'Empty',
          provider: 'slack',
        });

        const result = await manager.reportFailure(emptyProfile.id, 'Error');
        expect(result).toBeNull();
      });
    });
  });

  describe('event callbacks', () => {
    beforeEach(async () => {
      await manager.initialize('password');
    });

    it('should register and call event callbacks', async () => {
      const callback = vi.fn();
      manager.onEvent(callback);

      const profile = await manager.createProfile({
        name: 'Test',
        provider: 'anthropic',
      });

      await manager.addCredential(profile.id, {
        name: 'Key',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key' },
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should allow unsubscribing from events', async () => {
      const callback = vi.fn();
      const unsubscribe = manager.onEvent(callback);

      const profile = await manager.createProfile({
        name: 'Test',
        provider: 'anthropic',
      });

      await manager.addCredential(profile.id, {
        name: 'Key 1',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key1' },
      });

      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      await manager.addCredential(profile.id, {
        name: 'Key 2',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key2' },
      });

      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should continue processing after callback error', async () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const successCallback = vi.fn();

      manager.onEvent(errorCallback);
      manager.onEvent(successCallback);

      const profile = await manager.createProfile({
        name: 'Test',
        provider: 'anthropic',
      });

      // Should not throw
      await expect(
        manager.addCredential(profile.id, {
          name: 'Key',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key' },
        })
      ).resolves.not.toThrow();

      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
    });
  });

  describe('getCredentialStore', () => {
    it('should return the credential store', async () => {
      await manager.initialize('password');

      const store = manager.getCredentialStore();

      expect(store).toBe(mockCredentialStore);
    });
  });

  describe('credential sorting', () => {
    beforeEach(async () => {
      await manager.initialize('password');
    });

    it('should sort credentials by priority', async () => {
      const profile = await manager.createProfile({
        name: 'Test',
        provider: 'anthropic',
      });

      // Add credentials out of order
      await manager.addCredential(profile.id, {
        name: 'Priority 2',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key2' },
        priority: 2,
      });

      await manager.addCredential(profile.id, {
        name: 'Priority 0',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key0' },
        priority: 0,
      });

      await manager.addCredential(profile.id, {
        name: 'Priority 1',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key1' },
        priority: 1,
      });

      const updatedProfile = manager.getProfile(profile.id);
      const credentials = updatedProfile?.credentials.map(id => mockCredentialStore.get(id));

      // Should be sorted by priority (ascending)
      expect(credentials?.[0]?.name).toBe('Priority 0');
      expect(credentials?.[1]?.name).toBe('Priority 1');
      expect(credentials?.[2]?.name).toBe('Priority 2');
    });
  });
});
