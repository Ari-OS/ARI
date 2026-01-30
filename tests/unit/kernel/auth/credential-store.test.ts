import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { CredentialStore } from '../../../../src/kernel/auth/credential-store.js';
import type { CreateCredentialInput, CredentialData } from '../../../../src/kernel/auth/types.js';

describe('CredentialStore', () => {
  let store: CredentialStore;
  let testDir: string;
  let testPath: string;
  const masterPassword = 'test-master-password-12345';

  beforeEach(async () => {
    // Use unique temp directory for each test
    testDir = join(tmpdir(), `ari-cred-test-${randomUUID()}`);
    testPath = join(testDir, 'credentials.enc');
    store = new CredentialStore(testPath);
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should initialize with master password', async () => {
      await store.initialize(masterPassword);
      expect(store.isInitialized()).toBe(true);
    });

    it('should create salt file on first initialization', async () => {
      await store.initialize(masterPassword);

      const saltPath = testPath + '.salt';
      const saltExists = await fs.stat(saltPath).then(() => true).catch(() => false);
      expect(saltExists).toBe(true);
    });

    it('should reuse existing salt on subsequent initializations', async () => {
      // First init creates salt
      await store.initialize(masterPassword);
      const saltPath = testPath + '.salt';
      const originalSalt = await fs.readFile(saltPath);

      // Create new store instance with same path
      const store2 = new CredentialStore(testPath);
      await store2.initialize(masterPassword);

      const reusedSalt = await fs.readFile(saltPath);
      expect(reusedSalt.equals(originalSalt)).toBe(true);
    });

    it('should not allow operations before initialization', async () => {
      const uninitializedStore = new CredentialStore(testPath);
      await expect(uninitializedStore.load()).rejects.toThrow('Store not initialized');
      await expect(uninitializedStore.save()).rejects.toThrow('Store not initialized');
    });

    it('should use default path when none provided', () => {
      const defaultStore = new CredentialStore();
      expect(defaultStore.isInitialized()).toBe(false);
    });

    it('should accept custom encryption config', async () => {
      const customStore = new CredentialStore(testPath, {
        keyLength: 32,
        saltLength: 16,
      });
      await customStore.initialize(masterPassword);
      expect(customStore.isInitialized()).toBe(true);
    });
  });

  describe('encryption and decryption', () => {
    beforeEach(async () => {
      await store.initialize(masterPassword);
    });

    it('should encrypt credential data', () => {
      const data: CredentialData = {
        key: 'sk-test-api-key-12345',
        secret: 'secret-value',
      };

      const { encryptedData, iv } = store.encryptCredentialData(data);

      expect(encryptedData).toBeDefined();
      expect(encryptedData).not.toContain('sk-test-api-key');
      expect(iv).toBeDefined();
      expect(iv.length).toBeGreaterThan(0);
    });

    it('should decrypt credential data correctly', () => {
      const originalData: CredentialData = {
        key: 'sk-test-api-key-12345',
        secret: 'my-secret',
        custom: { region: 'us-east-1' },
      };

      const { encryptedData, iv } = store.encryptCredentialData(originalData);
      const decrypted = store.decryptCredentialData(encryptedData, iv);

      expect(decrypted.key).toBe(originalData.key);
      expect(decrypted.secret).toBe(originalData.secret);
      expect(decrypted.custom).toEqual(originalData.custom);
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const data: CredentialData = { key: 'same-key' };

      const result1 = store.encryptCredentialData(data);
      const result2 = store.encryptCredentialData(data);

      expect(result1.encryptedData).not.toBe(result2.encryptedData);
      expect(result1.iv).not.toBe(result2.iv);
    });

    it('should throw on decryption with wrong key', async () => {
      const data: CredentialData = { key: 'test-key' };
      const { encryptedData, iv } = store.encryptCredentialData(data);

      // Create new store with different password
      const wrongPasswordStore = new CredentialStore(
        join(testDir, 'other.enc')
      );
      await wrongPasswordStore.initialize('wrong-password');

      expect(() => {
        wrongPasswordStore.decryptCredentialData(encryptedData, iv);
      }).toThrow();
    });
  });

  describe('CRUD operations', () => {
    beforeEach(async () => {
      await store.initialize(masterPassword);
    });

    describe('create', () => {
      it('should create a new credential', async () => {
        const input: CreateCredentialInput = {
          name: 'Test API Key',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'sk-test-12345' },
        };

        const credential = await store.create(input);

        expect(credential.id).toBeDefined();
        expect(credential.name).toBe(input.name);
        expect(credential.provider).toBe(input.provider);
        expect(credential.type).toBe(input.type);
        expect(credential.status).toBe('active');
        expect(credential.usageCount).toBe(0);
        expect(credential.encryptedData).toBeDefined();
        expect(credential.iv).toBeDefined();
      });

      it('should create credential with priority', async () => {
        const input: CreateCredentialInput = {
          name: 'High Priority Key',
          provider: 'openai',
          type: 'api_key',
          data: { key: 'sk-openai-key' },
          priority: 10,
        };

        const credential = await store.create(input);
        expect(credential.priority).toBe(10);
      });

      it('should create credential with expiry date', async () => {
        const expiryDate = '2024-12-31T23:59:59.000Z';
        const input: CreateCredentialInput = {
          name: 'Expiring Key',
          provider: 'github',
          type: 'bearer',
          data: { accessToken: 'ghp_token' },
          expiresAt: expiryDate,
        };

        const credential = await store.create(input);
        expect(credential.expiresAt).toBe(expiryDate);
      });

      it('should create credential with metadata', async () => {
        const input: CreateCredentialInput = {
          name: 'Key with Metadata',
          provider: 'custom',
          type: 'custom',
          data: { key: 'custom-key' },
          metadata: { environment: 'staging', team: 'platform' },
        };

        const credential = await store.create(input);
        expect(credential.metadata).toEqual(input.metadata);
      });

      it('should persist credential after creation', async () => {
        const input: CreateCredentialInput = {
          name: 'Persisted Key',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'sk-persist' },
        };

        await store.create(input);

        // Create new store and verify persistence
        const store2 = new CredentialStore(testPath);
        await store2.initialize(masterPassword);

        expect(store2.size).toBe(1);
        const all = store2.getAll();
        expect(all[0].name).toBe('Persisted Key');
      });
    });

    describe('get', () => {
      it('should retrieve credential by ID', async () => {
        const input: CreateCredentialInput = {
          name: 'Retrievable Key',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'sk-retrieve' },
        };

        const created = await store.create(input);
        const retrieved = store.get(created.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.name).toBe(created.name);
      });

      it('should return null for non-existent credential', () => {
        const retrieved = store.get('non-existent-id');
        expect(retrieved).toBeNull();
      });

      it('should return null for empty string ID', () => {
        const retrieved = store.get('');
        expect(retrieved).toBeNull();
      });
    });

    describe('getAll', () => {
      it('should return empty array when no credentials', () => {
        const all = store.getAll();
        expect(all).toEqual([]);
      });

      it('should return all credentials', async () => {
        await store.create({
          name: 'Key 1',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key1' },
        });

        await store.create({
          name: 'Key 2',
          provider: 'openai',
          type: 'api_key',
          data: { key: 'key2' },
        });

        await store.create({
          name: 'Key 3',
          provider: 'github',
          type: 'bearer',
          data: { accessToken: 'token' },
        });

        const all = store.getAll();
        expect(all).toHaveLength(3);
      });
    });

    describe('getByProvider', () => {
      beforeEach(async () => {
        await store.create({
          name: 'Anthropic Key 1',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key1' },
        });

        await store.create({
          name: 'Anthropic Key 2',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key2' },
        });

        await store.create({
          name: 'OpenAI Key',
          provider: 'openai',
          type: 'api_key',
          data: { key: 'key3' },
        });
      });

      it('should return credentials for specific provider', () => {
        const anthropicCreds = store.getByProvider('anthropic');
        expect(anthropicCreds).toHaveLength(2);
        expect(anthropicCreds.every(c => c.provider === 'anthropic')).toBe(true);
      });

      it('should return empty array for provider with no credentials', () => {
        const slackCreds = store.getByProvider('slack');
        expect(slackCreds).toEqual([]);
      });
    });

    describe('update', () => {
      it('should update credential fields', async () => {
        const credential = await store.create({
          name: 'Original Name',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key' },
        });

        const updated = await store.update(credential.id, {
          name: 'Updated Name',
          priority: 5,
        });

        expect(updated).not.toBeNull();
        expect(updated?.name).toBe('Updated Name');
        expect(updated?.priority).toBe(5);
      });

      it('should return null for non-existent credential', async () => {
        const result = await store.update('non-existent', { name: 'New Name' });
        expect(result).toBeNull();
      });

      it('should persist updates', async () => {
        const credential = await store.create({
          name: 'To Update',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key' },
        });

        await store.update(credential.id, { name: 'Updated' });

        // Reload store
        const store2 = new CredentialStore(testPath);
        await store2.initialize(masterPassword);

        const reloaded = store2.get(credential.id);
        expect(reloaded?.name).toBe('Updated');
      });
    });

    describe('updateData', () => {
      it('should update encrypted credential data', async () => {
        const credential = await store.create({
          name: 'Key to Update',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'original-key' },
        });

        const newData: CredentialData = { key: 'new-key-12345' };
        const updated = await store.updateData(credential.id, newData);

        expect(updated).not.toBeNull();
        expect(updated?.encryptedData).not.toBe(credential.encryptedData);

        // Verify decryption of new data
        const decrypted = store.decryptCredentialData(
          updated!.encryptedData,
          updated!.iv
        );
        expect(decrypted.key).toBe('new-key-12345');
      });

      it('should return null for non-existent credential', async () => {
        const result = await store.updateData('non-existent', { key: 'key' });
        expect(result).toBeNull();
      });
    });

    describe('delete', () => {
      it('should delete credential', async () => {
        const credential = await store.create({
          name: 'To Delete',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key' },
        });

        const deleted = await store.delete(credential.id);
        expect(deleted).toBe(true);
        expect(store.get(credential.id)).toBeNull();
        expect(store.size).toBe(0);
      });

      it('should return false for non-existent credential', async () => {
        const deleted = await store.delete('non-existent');
        expect(deleted).toBe(false);
      });

      it('should persist deletion', async () => {
        const credential = await store.create({
          name: 'To Delete',
          provider: 'anthropic',
          type: 'api_key',
          data: { key: 'key' },
        });

        await store.delete(credential.id);

        const store2 = new CredentialStore(testPath);
        await store2.initialize(masterPassword);
        expect(store2.size).toBe(0);
      });
    });
  });

  describe('usage tracking', () => {
    beforeEach(async () => {
      await store.initialize(masterPassword);
    });

    it('should mark credential as used', async () => {
      const credential = await store.create({
        name: 'Usage Test',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key' },
      });

      expect(credential.usageCount).toBe(0);
      expect(credential.lastUsedAt).toBeUndefined();

      await store.markUsed(credential.id);

      const updated = store.get(credential.id);
      expect(updated?.usageCount).toBe(1);
      expect(updated?.lastUsedAt).toBeDefined();
    });

    it('should increment usage count on multiple uses', async () => {
      const credential = await store.create({
        name: 'Multi Use',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key' },
      });

      await store.markUsed(credential.id);
      await store.markUsed(credential.id);
      await store.markUsed(credential.id);

      const updated = store.get(credential.id);
      expect(updated?.usageCount).toBe(3);
    });

    it('should not throw for non-existent credential', async () => {
      await expect(store.markUsed('non-existent')).resolves.not.toThrow();
    });
  });

  describe('status management', () => {
    beforeEach(async () => {
      await store.initialize(masterPassword);
    });

    it('should set credential status', async () => {
      const credential = await store.create({
        name: 'Status Test',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key' },
      });

      await store.setStatus(credential.id, 'expired');

      const updated = store.get(credential.id);
      expect(updated?.status).toBe('expired');
    });

    it('should set status with error message', async () => {
      const credential = await store.create({
        name: 'Error Test',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key' },
      });

      await store.setStatus(credential.id, 'error', 'Rate limit exceeded');

      const updated = store.get(credential.id);
      expect(updated?.status).toBe('error');
      expect(updated?.lastError).toBe('Rate limit exceeded');
    });

    it('should not throw for non-existent credential', async () => {
      await expect(store.setStatus('non-existent', 'active')).resolves.not.toThrow();
    });
  });

  describe('size property', () => {
    beforeEach(async () => {
      await store.initialize(masterPassword);
    });

    it('should return 0 for empty store', () => {
      expect(store.size).toBe(0);
    });

    it('should return correct count after additions', async () => {
      await store.create({
        name: 'Key 1',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key1' },
      });
      expect(store.size).toBe(1);

      await store.create({
        name: 'Key 2',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key2' },
      });
      expect(store.size).toBe(2);
    });

    it('should return correct count after deletion', async () => {
      const cred1 = await store.create({
        name: 'Key 1',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key1' },
      });

      await store.create({
        name: 'Key 2',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key2' },
      });

      await store.delete(cred1.id);
      expect(store.size).toBe(1);
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      await store.initialize(masterPassword);
    });

    it('should clear all credentials', async () => {
      await store.create({
        name: 'Key 1',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key1' },
      });

      await store.create({
        name: 'Key 2',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key2' },
      });

      expect(store.size).toBe(2);

      await store.clear();

      expect(store.size).toBe(0);
      expect(store.getAll()).toEqual([]);
    });

    it('should persist clear operation', async () => {
      await store.create({
        name: 'Key',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'key' },
      });

      await store.clear();

      const store2 = new CredentialStore(testPath);
      await store2.initialize(masterPassword);
      expect(store2.size).toBe(0);
    });
  });

  describe('changeMasterPassword', () => {
    beforeEach(async () => {
      await store.initialize(masterPassword);
    });

    it('should change master password', async () => {
      await store.create({
        name: 'Test Key',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'sk-test' },
      });

      const newPassword = 'new-master-password-54321';
      await store.changeMasterPassword(newPassword);

      // Verify old password no longer works
      const oldPasswordStore = new CredentialStore(testPath);
      await expect(async () => {
        await oldPasswordStore.initialize(masterPassword);
        // The load will succeed but decryption should fail
        const cred = oldPasswordStore.getAll()[0];
        oldPasswordStore.decryptCredentialData(cred.encryptedData, cred.iv);
      }).rejects.toThrow();

      // Verify new password works
      const newPasswordStore = new CredentialStore(testPath);
      await newPasswordStore.initialize(newPassword);
      expect(newPasswordStore.size).toBe(1);
    });

    it('should generate new salt on password change', async () => {
      const saltPath = testPath + '.salt';
      const originalSalt = await fs.readFile(saltPath);

      await store.changeMasterPassword('new-password');

      const newSalt = await fs.readFile(saltPath);
      expect(newSalt.equals(originalSalt)).toBe(false);
    });
  });

  describe('persistence and loading', () => {
    it('should load existing credentials from disk', async () => {
      await store.initialize(masterPassword);

      await store.create({
        name: 'Persistent Key',
        provider: 'anthropic',
        type: 'api_key',
        data: { key: 'sk-persistent' },
        priority: 5,
        metadata: { env: 'prod' },
      });

      // Create new store instance
      const store2 = new CredentialStore(testPath);
      await store2.initialize(masterPassword);

      const credentials = store2.getAll();
      expect(credentials).toHaveLength(1);
      expect(credentials[0].name).toBe('Persistent Key');
      expect(credentials[0].priority).toBe(5);
      expect(credentials[0].metadata).toEqual({ env: 'prod' });
    });

    it('should handle empty credentials file gracefully', async () => {
      await store.initialize(masterPassword);
      expect(store.size).toBe(0);
    });

    it('should handle corrupted file', async () => {
      // Write corrupted data
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(testPath, 'corrupted-data');

      // Initialize should fail
      await expect(store.initialize(masterPassword)).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      await store.initialize(masterPassword);
    });

    it('should handle special characters in credential data', async () => {
      const specialData: CredentialData = {
        key: 'sk-test-key-with-special-chars-!@#$%^&*()',
        custom: {
          field: "value with 'quotes' and \"double quotes\"",
          unicode: '\u{1F600}\u{1F601}',
        },
      };

      const cred = await store.create({
        name: 'Special Chars Key',
        provider: 'custom',
        type: 'custom',
        data: specialData,
      });

      const decrypted = store.decryptCredentialData(cred.encryptedData, cred.iv);
      expect(decrypted.key).toBe(specialData.key);
      expect(decrypted.custom).toEqual(specialData.custom);
    });

    it('should handle very long credential data', async () => {
      const longKey = 'x'.repeat(10000);
      const cred = await store.create({
        name: 'Long Key',
        provider: 'custom',
        type: 'custom',
        data: { key: longKey },
      });

      const decrypted = store.decryptCredentialData(cred.encryptedData, cred.iv);
      expect(decrypted.key).toBe(longKey);
    });

    it('should handle empty credential data', async () => {
      const cred = await store.create({
        name: 'Empty Data Key',
        provider: 'custom',
        type: 'custom',
        data: {},
      });

      const decrypted = store.decryptCredentialData(cred.encryptedData, cred.iv);
      expect(decrypted).toEqual({});
    });

    it('should handle concurrent operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        store.create({
          name: `Concurrent Key ${i}`,
          provider: 'anthropic',
          type: 'api_key',
          data: { key: `key-${i}` },
        })
      );

      await Promise.all(promises);
      expect(store.size).toBe(10);
    });
  });
});
