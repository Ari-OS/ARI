import { randomUUID, createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import {
  type Credential,
  type CredentialData,
  type CreateCredentialInput,
  CredentialSchema,
  CredentialDataSchema,
} from './types.js';

const scryptAsync = promisify(scrypt);

/**
 * Encryption Configuration
 */
interface EncryptionConfig {
  /** Key derivation iterations */
  iterations: number;
  /** Key length in bytes */
  keyLength: number;
  /** Salt length in bytes */
  saltLength: number;
  /** IV length in bytes */
  ivLength: number;
  /** Cipher algorithm */
  algorithm: string;
}

const DEFAULT_ENCRYPTION_CONFIG: EncryptionConfig = {
  iterations: 100000,
  keyLength: 32,
  saltLength: 16,
  ivLength: 16,
  algorithm: 'aes-256-gcm',
};

/**
 * CredentialStore
 *
 * Secure storage for credentials with encryption at rest.
 */
export class CredentialStore {
  private credentials: Map<string, Credential> = new Map();
  private storagePath: string;
  private encryptionKey: Buffer | null = null;
  private salt: Buffer | null = null;
  private config: EncryptionConfig;
  private loaded: boolean = false;

  constructor(storagePath?: string, config?: Partial<EncryptionConfig>) {
    this.storagePath = storagePath || join(homedir(), '.ari', 'credentials.enc');
    this.config = { ...DEFAULT_ENCRYPTION_CONFIG, ...config };
  }

  /**
   * Initialize the store with a master password
   */
  async initialize(masterPassword: string): Promise<void> {
    // Try to load existing salt, or generate new one
    await this.loadOrCreateSalt();

    // Derive encryption key from password
    this.encryptionKey = await scryptAsync(
      masterPassword,
      this.salt!,
      this.config.keyLength
    ) as Buffer;

    // Load existing credentials
    await this.load();
  }

  /**
   * Load or create salt for key derivation
   */
  private async loadOrCreateSalt(): Promise<void> {
    const saltPath = this.storagePath + '.salt';

    try {
      const saltData = await fs.readFile(saltPath);
      this.salt = saltData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Create new salt
        this.salt = randomBytes(this.config.saltLength);
        await fs.mkdir(dirname(saltPath), { recursive: true });
        await fs.writeFile(saltPath, this.salt);
      } else {
        throw error;
      }
    }
  }

  /**
   * Load credentials from disk
   */
  async load(): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Store not initialized. Call initialize() first.');
    }

    try {
      const encryptedData = await fs.readFile(this.storagePath, 'utf-8');
      const parsed = JSON.parse(encryptedData) as { data: string; iv: string };

      const decrypted = this.decrypt(parsed.data, parsed.iv);
      const credentials = JSON.parse(decrypted) as Credential[];

      for (const cred of credentials) {
        const parsed = CredentialSchema.parse(cred);
        this.credentials.set(parsed.id, parsed);
      }

      this.loaded = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // No existing credentials
        this.loaded = true;
        return;
      }
      throw error;
    }
  }

  /**
   * Save credentials to disk
   */
  async save(): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Store not initialized. Call initialize() first.');
    }

    const credentials = Array.from(this.credentials.values());
    const plaintext = JSON.stringify(credentials);
    const { encrypted, iv } = this.encrypt(plaintext);

    await fs.mkdir(dirname(this.storagePath), { recursive: true });
    await fs.writeFile(
      this.storagePath,
      JSON.stringify({ data: encrypted, iv }),
      'utf-8'
    );
  }

  /**
   * Encrypt data
   */
  private encrypt(plaintext: string): { encrypted: string; iv: string } {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set');
    }

    const iv = randomBytes(this.config.ivLength);
    const cipher = createCipheriv(this.config.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // For GCM, append auth tag
    const authTag = (cipher as ReturnType<typeof createCipheriv> & { getAuthTag?: () => Buffer }).getAuthTag?.();
    if (authTag) {
      encrypted += authTag.toString('hex');
    }

    return {
      encrypted,
      iv: iv.toString('hex'),
    };
  }

  /**
   * Decrypt data
   */
  private decrypt(encrypted: string, iv: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set');
    }

    const ivBuffer = Buffer.from(iv, 'hex');

    // For GCM, extract auth tag from end
    let ciphertext = encrypted;
    let authTag: Buffer | undefined;

    if (this.config.algorithm.includes('gcm')) {
      const authTagLength = 32; // 16 bytes as hex
      authTag = Buffer.from(encrypted.slice(-authTagLength), 'hex');
      ciphertext = encrypted.slice(0, -authTagLength);
    }

    const decipher = createDecipheriv(this.config.algorithm, this.encryptionKey, ivBuffer);

    if (authTag) {
      (decipher as ReturnType<typeof createDecipheriv> & { setAuthTag: (tag: Buffer) => void }).setAuthTag(authTag);
    }

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Encrypt credential data
   */
  encryptCredentialData(data: CredentialData): { encryptedData: string; iv: string } {
    const plaintext = JSON.stringify(data);
    const { encrypted, iv } = this.encrypt(plaintext);
    return { encryptedData: encrypted, iv };
  }

  /**
   * Decrypt credential data
   */
  decryptCredentialData(encryptedData: string, iv: string): CredentialData {
    const decrypted = this.decrypt(encryptedData, iv);
    return CredentialDataSchema.parse(JSON.parse(decrypted));
  }

  /**
   * Create a new credential
   */
  async create(input: CreateCredentialInput): Promise<Credential> {
    const { encryptedData, iv } = this.encryptCredentialData(input.data);
    const now = new Date().toISOString();

    const credential: Credential = {
      id: randomUUID(),
      name: input.name,
      provider: input.provider,
      type: input.type,
      status: 'active',
      priority: input.priority ?? 0,
      encryptedData,
      iv,
      createdAt: now,
      expiresAt: input.expiresAt,
      usageCount: 0,
      metadata: input.metadata || {},
    };

    this.credentials.set(credential.id, credential);
    await this.save();

    return credential;
  }

  /**
   * Get a credential by ID
   */
  get(id: string): Credential | null {
    return this.credentials.get(id) || null;
  }

  /**
   * Get all credentials
   */
  getAll(): Credential[] {
    return Array.from(this.credentials.values());
  }

  /**
   * Get credentials by provider
   */
  getByProvider(provider: string): Credential[] {
    return this.getAll().filter(c => c.provider === provider);
  }

  /**
   * Update a credential
   */
  async update(id: string, updates: Partial<Omit<Credential, 'id' | 'createdAt'>>): Promise<Credential | null> {
    const credential = this.credentials.get(id);
    if (!credential) return null;

    const updated: Credential = {
      ...credential,
      ...updates,
    };

    this.credentials.set(id, updated);
    await this.save();

    return updated;
  }

  /**
   * Update credential data
   */
  async updateData(id: string, data: CredentialData): Promise<Credential | null> {
    const credential = this.credentials.get(id);
    if (!credential) return null;

    const { encryptedData, iv } = this.encryptCredentialData(data);

    return this.update(id, { encryptedData, iv });
  }

  /**
   * Delete a credential
   */
  async delete(id: string): Promise<boolean> {
    const deleted = this.credentials.delete(id);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }

  /**
   * Mark credential as used
   */
  async markUsed(id: string): Promise<void> {
    const credential = this.credentials.get(id);
    if (credential) {
      credential.lastUsedAt = new Date().toISOString();
      credential.usageCount++;
      await this.save();
    }
  }

  /**
   * Mark credential status
   */
  async setStatus(id: string, status: Credential['status'], error?: string): Promise<void> {
    const credential = this.credentials.get(id);
    if (credential) {
      credential.status = status;
      if (error) {
        credential.lastError = error;
      }
      await this.save();
    }
  }

  /**
   * Get credential count
   */
  get size(): number {
    return this.credentials.size;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.loaded && this.encryptionKey !== null;
  }

  /**
   * Clear all credentials (for testing)
   */
  async clear(): Promise<void> {
    this.credentials.clear();
    await this.save();
  }

  /**
   * Change master password
   */
  async changeMasterPassword(newPassword: string): Promise<void> {
    // Generate new salt
    this.salt = randomBytes(this.config.saltLength);

    // Derive new encryption key
    this.encryptionKey = await scryptAsync(
      newPassword,
      this.salt,
      this.config.keyLength
    ) as Buffer;

    // Re-encrypt and save
    await fs.writeFile(this.storagePath + '.salt', this.salt);
    await this.save();
  }
}
