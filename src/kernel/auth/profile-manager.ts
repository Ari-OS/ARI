import { randomUUID } from 'crypto';
import type { EventBus } from '../event-bus.js';
import type { AuditLogger } from '../audit.js';
import {
  type AuthProfile,
  type Credential,
  type CredentialData,
  type CredentialEvent,
  type CreateProfileInput,
  type CreateCredentialInput,
  type ProviderType,
} from './types.js';
import { CredentialStore } from './credential-store.js';

/**
 * AuthProfileManager
 *
 * Manages authentication profiles with multiple credentials per provider.
 * Supports automatic failover when credentials fail.
 */
export class AuthProfileManager {
  private profiles: Map<string, AuthProfile> = new Map();
  private credentialStore: CredentialStore;
  private eventBus: EventBus;
  private audit: AuditLogger;
  private initialized: boolean = false;
  private eventCallbacks: Array<(event: CredentialEvent) => void> = [];

  constructor(
    credentialStore: CredentialStore,
    eventBus: EventBus,
    audit: AuditLogger
  ) {
    this.credentialStore = credentialStore;
    this.eventBus = eventBus;
    this.audit = audit;
  }

  /**
   * Initialize the manager with master password
   */
  async initialize(masterPassword: string): Promise<void> {
    if (this.initialized) return;

    await this.credentialStore.initialize(masterPassword);
    this.initialized = true;

    await this.audit.log('auth_profile_manager_initialized', 'system', 'system', {
      credentialCount: this.credentialStore.size,
    });
  }

  /**
   * Create a new auth profile
   */
  async createProfile(input: CreateProfileInput): Promise<AuthProfile> {
    const now = new Date().toISOString();

    const profile: AuthProfile = {
      id: randomUUID(),
      name: input.name,
      provider: input.provider,
      credentials: [],
      autoFailover: input.autoFailover ?? true,
      failoverCooldown: input.failoverCooldown ?? 60000,
      createdAt: now,
      updatedAt: now,
      enabled: true,
    };

    this.profiles.set(profile.id, profile);

    await this.audit.log('auth_profile_created', 'system', 'system', {
      profileId: profile.id,
      provider: profile.provider,
    });

    return profile;
  }

  /**
   * Get a profile by ID
   */
  getProfile(id: string): AuthProfile | null {
    return this.profiles.get(id) || null;
  }

  /**
   * Get profiles by provider
   */
  getProfilesByProvider(provider: ProviderType): AuthProfile[] {
    return Array.from(this.profiles.values())
      .filter(p => p.provider === provider);
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): AuthProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Add a credential to a profile
   */
  async addCredential(
    profileId: string,
    input: CreateCredentialInput
  ): Promise<Credential> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    // Ensure credential provider matches profile
    if (input.provider !== profile.provider) {
      throw new Error(`Credential provider ${input.provider} doesn't match profile provider ${profile.provider}`);
    }

    const credential = await this.credentialStore.create(input);

    // Add to profile
    profile.credentials.push(credential.id);

    // Set as active if first credential
    if (profile.credentials.length === 1) {
      profile.activeCredentialId = credential.id;
    }

    // Sort by priority
    this.sortProfileCredentials(profile);

    profile.updatedAt = new Date().toISOString();

    this.emitEvent({
      type: 'created',
      credentialId: credential.id,
      profileId,
      timestamp: new Date(),
    });

    await this.audit.log('auth_credential_added', 'system', 'system', {
      profileId,
      credentialId: credential.id,
      provider: credential.provider,
    });

    return credential;
  }

  /**
   * Remove a credential from a profile
   */
  async removeCredential(profileId: string, credentialId: string): Promise<boolean> {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    const index = profile.credentials.indexOf(credentialId);
    if (index === -1) return false;

    profile.credentials.splice(index, 1);

    // If active credential was removed, switch to next available
    if (profile.activeCredentialId === credentialId) {
      profile.activeCredentialId = profile.credentials[0];
    }

    profile.updatedAt = new Date().toISOString();

    // Delete from store
    await this.credentialStore.delete(credentialId);

    await this.audit.log('auth_credential_removed', 'system', 'system', {
      profileId,
      credentialId,
    });

    return true;
  }

  /**
   * Get the active credential data for a profile
   */
  async getActiveCredentialData(profileId: string): Promise<CredentialData | null> {
    const profile = this.profiles.get(profileId);
    if (!profile || !profile.activeCredentialId) return null;

    const credential = this.credentialStore.get(profile.activeCredentialId);
    if (!credential) return null;

    try {
      const data = this.credentialStore.decryptCredentialData(
        credential.encryptedData,
        credential.iv
      );

      // Mark as used
      await this.credentialStore.markUsed(credential.id);

      this.emitEvent({
        type: 'used',
        credentialId: credential.id,
        profileId,
        timestamp: new Date(),
      });

      return data;
    } catch (error) {
      await this.credentialStore.setStatus(
        credential.id,
        'error',
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  /**
   * Report a credential failure and potentially failover
   */
  async reportFailure(profileId: string, error: string): Promise<Credential | null> {
    const profile = this.profiles.get(profileId);
    if (!profile || !profile.activeCredentialId) return null;

    // Mark current credential as error
    await this.credentialStore.setStatus(profile.activeCredentialId, 'error', error);

    this.emitEvent({
      type: 'error',
      credentialId: profile.activeCredentialId,
      profileId,
      timestamp: new Date(),
      details: { error },
    });

    // Check if we can failover
    if (!profile.autoFailover) {
      await this.audit.log('auth_credential_failed', 'system', 'system', {
        profileId,
        credentialId: profile.activeCredentialId,
        error,
        autoFailover: false,
      });
      return null;
    }

    // Check failover cooldown
    if (profile.lastFailoverAt) {
      const cooldownEnd = new Date(profile.lastFailoverAt).getTime() + profile.failoverCooldown;
      if (Date.now() < cooldownEnd) {
        await this.audit.log('auth_failover_cooldown', 'system', 'system', {
          profileId,
          remainingCooldown: cooldownEnd - Date.now(),
        });
        return null;
      }
    }

    // Find next available credential
    const nextCredential = await this.findNextAvailableCredential(profile);
    if (!nextCredential) {
      await this.audit.log('auth_no_failover_available', 'system', 'system', {
        profileId,
        error,
      });
      return null;
    }

    // Perform failover
    profile.activeCredentialId = nextCredential.id;
    profile.lastFailoverAt = new Date().toISOString();
    profile.updatedAt = profile.lastFailoverAt;

    this.emitEvent({
      type: 'failover',
      credentialId: nextCredential.id,
      profileId,
      timestamp: new Date(),
      details: { previousError: error },
    });

    await this.audit.log('auth_failover', 'system', 'system', {
      profileId,
      fromCredentialId: profile.activeCredentialId,
      toCredentialId: nextCredential.id,
    });

    return nextCredential;
  }

  /**
   * Find next available credential for failover
   */
  private async findNextAvailableCredential(profile: AuthProfile): Promise<Credential | null> {
    for (const credId of profile.credentials) {
      if (credId === profile.activeCredentialId) continue;

      const cred = this.credentialStore.get(credId);
      if (cred && cred.status === 'active') {
        // Check if not expired
        if (cred.expiresAt && new Date(cred.expiresAt) < new Date()) {
          await this.credentialStore.setStatus(credId, 'expired');
          continue;
        }
        return cred;
      }
    }
    return null;
  }

  /**
   * Sort profile credentials by priority
   */
  private sortProfileCredentials(profile: AuthProfile): void {
    profile.credentials.sort((a, b) => {
      const credA = this.credentialStore.get(a);
      const credB = this.credentialStore.get(b);
      if (!credA || !credB) return 0;
      return credA.priority - credB.priority;
    });
  }

  /**
   * Register event callback
   */
  onEvent(callback: (event: CredentialEvent) => void): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index !== -1) this.eventCallbacks.splice(index, 1);
    };
  }

  /**
   * Emit a credential event
   */
  private emitEvent(event: CredentialEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Enable a profile
   */
  enableProfile(profileId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    profile.enabled = true;
    profile.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Disable a profile
   */
  disableProfile(profileId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    profile.enabled = false;
    profile.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Delete a profile and its credentials
   */
  async deleteProfile(profileId: string): Promise<boolean> {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    // Delete all credentials
    for (const credId of profile.credentials) {
      await this.credentialStore.delete(credId);
    }

    this.profiles.delete(profileId);

    await this.audit.log('auth_profile_deleted', 'system', 'system', {
      profileId,
    });

    return true;
  }

  /**
   * Get credential store
   */
  getCredentialStore(): CredentialStore {
    return this.credentialStore;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
