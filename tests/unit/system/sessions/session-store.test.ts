import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { SessionStore } from '../../../../src/system/sessions/session-store.js';
import type { Session } from '../../../../src/system/sessions/types.js';

describe('SessionStore', () => {
  let store: SessionStore;
  let testStoragePath: string;

  // Helper to create a test session
  const createTestSession = (overrides?: Partial<Session>): Session => ({
    id: randomUUID(),
    channel: 'telegram',
    senderId: 'user123',
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    context: {
      contextId: undefined,
      summary: undefined,
      currentTask: undefined,
      activeTools: [],
      pendingResponses: [],
      lastMessageId: undefined,
    },
    memoryPartition: `session:telegram:user123:${randomUUID().substring(0, 8)}`,
    trustLevel: 'standard',
    status: 'active',
    metadata: {
      name: undefined,
      tags: [],
      custom: {},
    },
    stats: {
      messageCount: 0,
      inboundCount: 0,
      outboundCount: 0,
      toolExecutions: 0,
      duration: 0,
    },
    ...overrides,
  });

  beforeEach(async () => {
    testStoragePath = join(tmpdir(), `ari-test-sessions-${randomUUID()}`);
    store = new SessionStore(testStoragePath);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testStoragePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should use provided storage path', () => {
      const customPath = '/custom/path/sessions';
      const customStore = new SessionStore(customPath);
      // The path is private, but we can verify behavior through load/save
      expect(customStore).toBeDefined();
    });

    it('should use default path if not provided', () => {
      const defaultStore = new SessionStore();
      expect(defaultStore).toBeDefined();
    });
  });

  describe('load', () => {
    it('should load sessions from disk', async () => {
      // Create a session file manually
      await fs.mkdir(testStoragePath, { recursive: true });
      const session = createTestSession();
      await fs.writeFile(
        join(testStoragePath, `${session.id}.json`),
        JSON.stringify(session),
        'utf-8'
      );

      await store.load();

      const loaded = store.get(session.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.channel).toBe(session.channel);
    });

    it('should skip invalid session files', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await fs.mkdir(testStoragePath, { recursive: true });
      await fs.writeFile(
        join(testStoragePath, 'invalid.json'),
        'not valid json',
        'utf-8'
      );

      await store.load();

      expect(store.size).toBe(0);
      consoleSpy.mockRestore();
    });

    it('should not reload if already loaded', async () => {
      await store.load();
      const session = createTestSession();
      await store.save(session);

      // Manually add a file after load
      const anotherSession = createTestSession();
      await fs.writeFile(
        join(testStoragePath, `${anotherSession.id}.json`),
        JSON.stringify(anotherSession),
        'utf-8'
      );

      // Load again - should be no-op
      await store.load();

      // Should only have the first session
      expect(store.size).toBe(1);
    });

    it('should handle non-existent directory', async () => {
      const nonExistentStore = new SessionStore(join(tmpdir(), `nonexistent-${randomUUID()}`));
      await nonExistentStore.load();

      expect(nonExistentStore.size).toBe(0);
    });

    it('should populate keyToId map', async () => {
      await fs.mkdir(testStoragePath, { recursive: true });
      const session = createTestSession({
        channel: 'slack',
        senderId: 'user456',
        groupId: 'group789',
      });
      await fs.writeFile(
        join(testStoragePath, `${session.id}.json`),
        JSON.stringify(session),
        'utf-8'
      );

      await store.load();

      const found = store.getByKey('slack', 'user456', 'group789');
      expect(found).not.toBeNull();
      expect(found?.id).toBe(session.id);
    });
  });

  describe('save', () => {
    it('should save session to disk', async () => {
      const session = createTestSession();
      await store.save(session);

      // Verify file exists
      const filePath = join(testStoragePath, `${session.id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.id).toBe(session.id);
      expect(parsed.channel).toBe(session.channel);
    });

    it('should create directory if not exists', async () => {
      const session = createTestSession();
      await store.save(session);

      const stats = await fs.stat(testStoragePath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should update in-memory maps', async () => {
      const session = createTestSession();
      await store.save(session);

      expect(store.get(session.id)).not.toBeNull();
      expect(store.getByKey(session.channel, session.senderId)).not.toBeNull();
    });

    it('should update existing session', async () => {
      const session = createTestSession();
      await store.save(session);

      const updated = { ...session, status: 'idle' as const };
      await store.save(updated);

      const loaded = store.get(session.id);
      expect(loaded?.status).toBe('idle');
    });
  });

  describe('delete', () => {
    it('should delete session from disk', async () => {
      const session = createTestSession();
      await store.save(session);

      const deleted = await store.delete(session.id);
      expect(deleted).toBe(true);

      // Verify file is gone
      const filePath = join(testStoragePath, `${session.id}.json`);
      await expect(fs.stat(filePath)).rejects.toThrow();
    });

    it('should remove from in-memory maps', async () => {
      const session = createTestSession();
      await store.save(session);
      await store.delete(session.id);

      expect(store.get(session.id)).toBeNull();
      expect(store.getByKey(session.channel, session.senderId)).toBeNull();
    });

    it('should return false for non-existent session', async () => {
      const deleted = await store.delete('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should handle already deleted file gracefully', async () => {
      const session = createTestSession();
      await store.save(session);

      // Delete file manually
      await fs.unlink(join(testStoragePath, `${session.id}.json`));

      // Should not throw
      const deleted = await store.delete(session.id);
      expect(deleted).toBe(true);
    });
  });

  describe('get', () => {
    it('should return session by ID', async () => {
      const session = createTestSession();
      await store.save(session);

      const found = store.get(session.id);
      expect(found?.id).toBe(session.id);
    });

    it('should return null for non-existent ID', () => {
      expect(store.get('non-existent')).toBeNull();
    });
  });

  describe('getByKey', () => {
    it('should return session by channel and senderId', async () => {
      const session = createTestSession({
        channel: 'telegram',
        senderId: 'user999',
      });
      await store.save(session);

      const found = store.getByKey('telegram', 'user999');
      expect(found?.id).toBe(session.id);
    });

    it('should return session by channel, senderId, and groupId', async () => {
      const session = createTestSession({
        channel: 'slack',
        senderId: 'user888',
        groupId: 'group111',
      });
      await store.save(session);

      const found = store.getByKey('slack', 'user888', 'group111');
      expect(found?.id).toBe(session.id);
    });

    it('should return null for non-existent key', () => {
      expect(store.getByKey('nonexistent', 'nonexistent')).toBeNull();
    });

    it('should distinguish between sessions with and without groupId', async () => {
      const sessionWithGroup = createTestSession({
        channel: 'slack',
        senderId: 'user',
        groupId: 'group',
      });
      const sessionWithoutGroup = createTestSession({
        channel: 'slack',
        senderId: 'user',
      });

      await store.save(sessionWithGroup);
      await store.save(sessionWithoutGroup);

      const foundWithGroup = store.getByKey('slack', 'user', 'group');
      const foundWithoutGroup = store.getByKey('slack', 'user');

      expect(foundWithGroup?.id).toBe(sessionWithGroup.id);
      expect(foundWithoutGroup?.id).toBe(sessionWithoutGroup.id);
    });
  });

  describe('has', () => {
    it('should return true for existing session', async () => {
      const session = createTestSession();
      await store.save(session);

      expect(store.has(session.id)).toBe(true);
    });

    it('should return false for non-existent session', () => {
      expect(store.has('non-existent')).toBe(false);
    });
  });

  describe('hasByKey', () => {
    it('should return true for existing key', async () => {
      const session = createTestSession({
        channel: 'test',
        senderId: 'user',
      });
      await store.save(session);

      expect(store.hasByKey('test', 'user')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(store.hasByKey('nonexistent', 'nonexistent')).toBe(false);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Create test sessions
      const sessions = [
        createTestSession({
          channel: 'telegram',
          senderId: 'user1',
          status: 'active',
          trustLevel: 'standard',
          createdAt: '2024-01-01T00:00:00.000Z',
          lastActivity: '2024-01-01T12:00:00.000Z',
        }),
        createTestSession({
          channel: 'slack',
          senderId: 'user2',
          groupId: 'group1',
          status: 'idle',
          trustLevel: 'verified',
          createdAt: '2024-01-02T00:00:00.000Z',
          lastActivity: '2024-01-02T12:00:00.000Z',
        }),
        createTestSession({
          channel: 'telegram',
          senderId: 'user3',
          status: 'suspended',
          trustLevel: 'operator',
          createdAt: '2024-01-03T00:00:00.000Z',
          lastActivity: '2024-01-03T12:00:00.000Z',
        }),
      ];

      for (const session of sessions) {
        await store.save(session);
      }
    });

    it('should return all sessions for empty query', () => {
      const results = store.query({});
      expect(results).toHaveLength(3);
    });

    it('should filter by channel', () => {
      const results = store.query({ channel: 'telegram' });
      expect(results).toHaveLength(2);
      expect(results.every(s => s.channel === 'telegram')).toBe(true);
    });

    it('should filter by senderId', () => {
      const results = store.query({ senderId: 'user1' });
      expect(results).toHaveLength(1);
      expect(results[0].senderId).toBe('user1');
    });

    it('should filter by groupId', () => {
      const results = store.query({ groupId: 'group1' });
      expect(results).toHaveLength(1);
      expect(results[0].groupId).toBe('group1');
    });

    it('should filter by status', () => {
      const results = store.query({ status: 'active' });
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('active');
    });

    it('should filter by trustLevel', () => {
      const results = store.query({ trustLevel: 'verified' });
      expect(results).toHaveLength(1);
      expect(results[0].trustLevel).toBe('verified');
    });

    it('should filter by createdAfter', () => {
      const results = store.query({ createdAfter: '2024-01-02T00:00:00.000Z' });
      expect(results).toHaveLength(2);
    });

    it('should filter by createdBefore', () => {
      const results = store.query({ createdBefore: '2024-01-02T00:00:00.000Z' });
      expect(results).toHaveLength(2);
    });

    it('should filter by activeAfter', () => {
      const results = store.query({ activeAfter: '2024-01-02T00:00:00.000Z' });
      expect(results).toHaveLength(2);
    });

    it('should sort by lastActivity descending', () => {
      const results = store.query({});

      for (let i = 0; i < results.length - 1; i++) {
        expect(new Date(results[i].lastActivity).getTime())
          .toBeGreaterThanOrEqual(new Date(results[i + 1].lastActivity).getTime());
      }
    });

    it('should apply limit', () => {
      const results = store.query({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should apply offset', () => {
      const allResults = store.query({});
      const offsetResults = store.query({ offset: 1 });

      expect(offsetResults).toHaveLength(2);
      expect(offsetResults[0].id).toBe(allResults[1].id);
    });

    it('should apply multiple filters', () => {
      const results = store.query({
        channel: 'telegram',
        status: 'active',
      });

      expect(results).toHaveLength(1);
      expect(results[0].channel).toBe('telegram');
      expect(results[0].status).toBe('active');
    });
  });

  describe('getAll', () => {
    it('should return all sessions', async () => {
      const session1 = createTestSession();
      const session2 = createTestSession();
      await store.save(session1);
      await store.save(session2);

      const all = store.getAll();
      expect(all).toHaveLength(2);
    });

    it('should return empty array when no sessions', () => {
      expect(store.getAll()).toEqual([]);
    });
  });

  describe('getByChannel', () => {
    it('should return sessions for channel', async () => {
      await store.save(createTestSession({ channel: 'telegram' }));
      await store.save(createTestSession({ channel: 'telegram' }));
      await store.save(createTestSession({ channel: 'slack' }));

      const telegramSessions = store.getByChannel('telegram');
      expect(telegramSessions).toHaveLength(2);
      expect(telegramSessions.every(s => s.channel === 'telegram')).toBe(true);
    });

    it('should return empty array for unknown channel', () => {
      expect(store.getByChannel('unknown')).toEqual([]);
    });
  });

  describe('getBySender', () => {
    it('should return sessions for sender', async () => {
      await store.save(createTestSession({ senderId: 'user1' }));
      await store.save(createTestSession({ senderId: 'user1' }));
      await store.save(createTestSession({ senderId: 'user2' }));

      const user1Sessions = store.getBySender('user1');
      expect(user1Sessions).toHaveLength(2);
      expect(user1Sessions.every(s => s.senderId === 'user1')).toBe(true);
    });

    it('should return empty array for unknown sender', () => {
      expect(store.getBySender('unknown')).toEqual([]);
    });
  });

  describe('getActive', () => {
    it('should return only active sessions', async () => {
      await store.save(createTestSession({ status: 'active' }));
      await store.save(createTestSession({ status: 'idle' }));
      await store.save(createTestSession({ status: 'active' }));
      await store.save(createTestSession({ status: 'suspended' }));

      const active = store.getActive();
      expect(active).toHaveLength(2);
      expect(active.every(s => s.status === 'active')).toBe(true);
    });

    it('should return empty array when no active sessions', async () => {
      await store.save(createTestSession({ status: 'idle' }));
      expect(store.getActive()).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return correct count', async () => {
      expect(store.size).toBe(0);

      await store.save(createTestSession());
      expect(store.size).toBe(1);

      await store.save(createTestSession());
      expect(store.size).toBe(2);
    });
  });

  describe('countByStatus', () => {
    it('should return counts by status', async () => {
      await store.save(createTestSession({ status: 'active' }));
      await store.save(createTestSession({ status: 'active' }));
      await store.save(createTestSession({ status: 'idle' }));
      await store.save(createTestSession({ status: 'suspended' }));
      await store.save(createTestSession({ status: 'closed' }));

      const counts = store.countByStatus();

      expect(counts.active).toBe(2);
      expect(counts.idle).toBe(1);
      expect(counts.suspended).toBe(1);
      expect(counts.closed).toBe(1);
    });

    it('should return zeros when no sessions', () => {
      const counts = store.countByStatus();

      expect(counts.active).toBe(0);
      expect(counts.idle).toBe(0);
      expect(counts.suspended).toBe(0);
      expect(counts.closed).toBe(0);
    });
  });

  describe('countByChannel', () => {
    it('should return counts by channel', async () => {
      await store.save(createTestSession({ channel: 'sms' }));
      await store.save(createTestSession({ channel: 'sms' }));
      await store.save(createTestSession({ channel: 'slack' }));
      await store.save(createTestSession({ channel: 'telegram' }));

      const counts = store.countByChannel();

      expect(counts.sms).toBe(2);
      expect(counts.slack).toBe(1);
      expect(counts.telegram).toBe(1);
    });

    it('should return empty object when no sessions', () => {
      const counts = store.countByChannel();
      expect(counts).toEqual({});
    });
  });

  describe('clear', () => {
    it('should delete all sessions', async () => {
      await store.save(createTestSession());
      await store.save(createTestSession());
      await store.save(createTestSession());

      expect(store.size).toBe(3);

      await store.clear();

      expect(store.size).toBe(0);
    });

    it('should remove files from disk', async () => {
      const session = createTestSession();
      await store.save(session);
      await store.clear();

      const filePath = join(testStoragePath, `${session.id}.json`);
      await expect(fs.stat(filePath)).rejects.toThrow();
    });
  });
});
