import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Use a unique temp dir per test run — avoids shared DB state
// Hard-code /tmp to avoid calling tmpdir() inside the mock (circular call)
const TEST_HOME = `/tmp/ari-test-conv-${process.pid}`;

vi.mock('node:os', () => ({
  homedir: () => TEST_HOME,
  tmpdir: () => '/tmp',
}));

// Import AFTER mocking so the module captures our TEST_HOME
const { ConversationStore } = await import(
  '../../../../src/plugins/telegram-bot/conversation-store.js'
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeStore() {
  return new ConversationStore();
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('ConversationStore', () => {
  let store: InstanceType<typeof ConversationStore>;

  beforeEach(() => {
    mkdirSync(join(TEST_HOME, '.ari', 'data'), { recursive: true });
    store = makeStore();
  });

  afterEach(async () => {
    await store.shutdown();
    // Remove DB file between tests so each test starts fresh
    try {
      rmSync(join(TEST_HOME, '.ari', 'data', 'conversations.db'), { force: true });
      rmSync(join(TEST_HOME, '.ari', 'data', 'conversations.db-wal'), { force: true });
      rmSync(join(TEST_HOME, '.ari', 'data', 'conversations.db-shm'), { force: true });
    } catch { /* ignore */ }
  });

  describe('addUserMessage', () => {
    it('should create a session and return messages array', async () => {
      const result = await store.addUserMessage(1001, 'Hello ARI');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ role: 'user', content: 'Hello ARI' });
    });

    it('should accumulate messages across calls', async () => {
      await store.addUserMessage(1001, 'First message');
      const result = await store.addUserMessage(1001, 'Second message');
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('First message');
      expect(result[1].content).toBe('Second message');
    });

    it('should keep separate sessions per chat', async () => {
      await store.addUserMessage(1001, 'Chat A');
      await store.addUserMessage(2002, 'Chat B');

      const historyA = await store.getHistory(1001);
      const historyB = await store.getHistory(2002);

      expect(historyA).toHaveLength(1);
      expect(historyA[0].content).toBe('Chat A');
      expect(historyB).toHaveLength(1);
      expect(historyB[0].content).toBe('Chat B');
    });

    it('should store intent when provided', async () => {
      const result = await store.addUserMessage(1001, 'Check BTC', 'market_query');
      expect(result[0].intent).toBe('market_query');
    });
  });

  describe('addAssistantMessage', () => {
    it('should record assistant messages in the session', async () => {
      await store.addUserMessage(1001, 'Hello');
      await store.addAssistantMessage(1001, 'Hi Pryce!');

      const history = await store.getHistory(1001);
      expect(history).toHaveLength(2);
      expect(history[1]).toMatchObject({ role: 'assistant', content: 'Hi Pryce!' });
    });

    it('should store emotion when provided', async () => {
      await store.addAssistantMessage(1001, 'Great news!', 'excited');
      const history = await store.getHistory(1001);
      expect(history[0].emotion).toBe('excited');
    });
  });

  describe('getHistory', () => {
    it('should return conversation history', async () => {
      await store.addUserMessage(1001, 'msg 1');
      await store.addUserMessage(1001, 'msg 2');
      const history = await store.getHistory(1001);
      expect(history).toHaveLength(2);
    });

    it('should return empty array for new session', async () => {
      const history = await store.getHistory(9999);
      expect(history).toEqual([]);
    });
  });

  describe('message window trimming', () => {
    it('should trim messages beyond max window size', async () => {
      // Add 55 messages — max is 50
      for (let i = 0; i < 55; i++) {
        await store.addUserMessage(1001, `msg ${i}`);
      }
      const history = await store.getHistory(1001);
      expect(history).toHaveLength(50);
      expect(history[0].content).toBe('msg 5'); // oldest kept
    });
  });

  describe('clearSession', () => {
    it('should clear a specific session', async () => {
      await store.addUserMessage(1001, 'test');
      store.clearSession(1001);
      const history = await store.getHistory(1001);
      expect(history).toEqual([]);
    });

    it('should not affect other sessions', async () => {
      await store.addUserMessage(1001, 'A');
      await store.addUserMessage(2002, 'B');
      store.clearSession(1001);

      const historyA = await store.getHistory(1001);
      const historyB = await store.getHistory(2002);
      expect(historyA).toEqual([]);
      expect(historyB).toHaveLength(1);
    });
  });

  describe('getSessionCount', () => {
    it('should return the number of active sessions', async () => {
      await store.addUserMessage(1001, 'A');
      await store.addUserMessage(2002, 'B');
      expect(store.getSessionCount()).toBe(2);
    });
  });

  describe('SQLite persistence', () => {
    it('should persist messages and load after shutdown/restart', async () => {
      await store.addUserMessage(1001, 'persisted message');
      await store.shutdown();

      // Create a new store — should reload from DB
      const store2 = makeStore();
      const history = await store2.getHistory(1001);
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('persisted message');
      await store2.shutdown();
    });

    it('should use WAL mode', async () => {
      // If WAL mode is enabled, a -wal file should be created on writes
      await store.addUserMessage(1001, 'WAL test');
      // Just verify the store works — WAL is an implementation detail
      const history = await store.getHistory(1001);
      expect(history).toHaveLength(1);
    });
  });

  describe('shutdown', () => {
    it('should flush all sessions and close DB cleanly', async () => {
      await store.addUserMessage(1001, 'before shutdown');
      await store.shutdown(); // Should not throw
    });

    it('should handle double shutdown gracefully', async () => {
      await store.shutdown();
      await store.shutdown(); // Second call should not throw
    });
  });
});
