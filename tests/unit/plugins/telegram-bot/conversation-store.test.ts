import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConversationStore } from '../../../../src/plugins/telegram-bot/conversation-store.js';

// Mock fs/promises and os
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn().mockReturnValue('/mock/home'),
}));

vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return {
    ...actual,
    join: (...args: string[]) => args.join('/'),
  };
});

describe('ConversationStore', () => {
  let store: ConversationStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { readFile, writeFile, mkdir } = await import('node:fs/promises');
    vi.mocked(readFile).mockRejectedValue(new Error('Not found'));
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    store = new ConversationStore();
  });

  afterEach(async () => {
    await store.shutdown();
    vi.restoreAllMocks();
  });

  describe('addUserMessage', () => {
    it('should create a session and return messages array', async () => {
      const messages = await store.addUserMessage(123, 'Hello ARI');
      expect(messages).toHaveLength(1);
      expect(messages[0]?.role).toBe('user');
      expect(messages[0]?.content).toBe('Hello ARI');
      expect(messages[0]?.timestamp).toBeTypeOf('number');
    });

    it('should accumulate messages across calls', async () => {
      await store.addUserMessage(123, 'First');
      const messages = await store.addUserMessage(123, 'Second');
      expect(messages).toHaveLength(2);
      expect(messages[0]?.content).toBe('First');
      expect(messages[1]?.content).toBe('Second');
    });

    it('should keep separate sessions per chat', async () => {
      await store.addUserMessage(100, 'Chat A');
      await store.addUserMessage(200, 'Chat B');
      const messagesA = await store.addUserMessage(100, 'Chat A again');
      const messagesB = await store.addUserMessage(200, 'Chat B again');

      expect(messagesA).toHaveLength(2);
      expect(messagesA[0]?.content).toBe('Chat A');
      expect(messagesB).toHaveLength(2);
      expect(messagesB[0]?.content).toBe('Chat B');
    });

    it('should store intent when provided', async () => {
      const messages = await store.addUserMessage(123, 'Check Bitcoin price', 'crypto');
      expect(messages[0]?.intent).toBe('crypto');
    });
  });

  describe('addAssistantMessage', () => {
    it('should record assistant messages in the session', async () => {
      await store.addUserMessage(123, 'Hello');
      await store.addAssistantMessage(123, 'Hi there!');
      const messages = await store.getHistory(123);

      expect(messages).toHaveLength(2);
      expect(messages[0]?.role).toBe('user');
      expect(messages[1]?.role).toBe('assistant');
      expect(messages[1]?.content).toBe('Hi there!');
    });
  });

  describe('getHistory', () => {
    it('should return conversation history', async () => {
      await store.addUserMessage(123, 'First');
      await store.addAssistantMessage(123, 'Response');
      await store.addUserMessage(123, 'Second');

      const history = await store.getHistory(123);
      expect(history).toHaveLength(3);
      expect(history[0]?.role).toBe('user');
      expect(history[1]?.role).toBe('assistant');
      expect(history[2]?.role).toBe('user');
    });

    it('should return empty array for new session', async () => {
      const history = await store.getHistory(999);
      expect(history).toHaveLength(0);
    });
  });

  describe('message window trimming', () => {
    it('should trim messages beyond max window size', async () => {
      // Add 55 messages (above the 50-message limit)
      for (let i = 0; i < 55; i++) {
        await store.addUserMessage(123, `Message ${i}`);
      }

      const messages = await store.getHistory(123);
      // Should be trimmed to 50
      expect(messages).toHaveLength(50);
      // First message should NOT be 'Message 0' (it was trimmed)
      expect(messages[0]?.content).not.toBe('Message 0');
      // Should start with 'Message 5' (0-4 trimmed)
      expect(messages[0]?.content).toBe('Message 5');
      // Last should be 'Message 54'
      expect(messages[49]?.content).toBe('Message 54');
    });
  });

  describe('session expiry', () => {
    it('should expire sessions after 24 hours', async () => {
      await store.addUserMessage(123, 'Hello');
      await store.addAssistantMessage(123, 'Hi');

      // Simulate time passing (25 hours)
      vi.useFakeTimers();
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const messages = await store.addUserMessage(123, 'Back again');
      // Should be a fresh session — only the new message
      expect(messages).toHaveLength(1);
      expect(messages[0]?.content).toBe('Back again');

      vi.useRealTimers();
    });

    it('should not expire sessions within 24 hours', async () => {
      await store.addUserMessage(123, 'Hello');

      // Simulate time passing (23 hours)
      vi.useFakeTimers();
      vi.advanceTimersByTime(23 * 60 * 60 * 1000);

      const messages = await store.addUserMessage(123, 'Still here');
      // Should have both messages
      expect(messages).toHaveLength(2);
      expect(messages[0]?.content).toBe('Hello');
      expect(messages[1]?.content).toBe('Still here');

      vi.useRealTimers();
    });
  });

  describe('clearSession', () => {
    it('should clear a specific session', async () => {
      await store.addUserMessage(123, 'Hello');
      await store.clearSession(123);

      const messages = await store.addUserMessage(123, 'New start');
      expect(messages).toHaveLength(1);
      expect(messages[0]?.content).toBe('New start');
    });

    it('should not affect other sessions', async () => {
      await store.addUserMessage(100, 'Chat A');
      await store.addUserMessage(200, 'Chat B');
      await store.clearSession(100);

      const messagesB = await store.getHistory(200);
      expect(messagesB).toHaveLength(1);
      expect(messagesB[0]?.content).toBe('Chat B');
    });
  });

  describe('getSessionCount', () => {
    it('should return the number of active sessions', async () => {
      expect(store.getSessionCount()).toBe(0);
      await store.addUserMessage(100, 'A');
      await store.addUserMessage(200, 'B');
      expect(store.getSessionCount()).toBe(2);
    });
  });

  describe('file persistence', () => {
    it('should mark session as dirty when messages added', async () => {
      const { mkdir, writeFile } = await import('node:fs/promises');

      await store.addUserMessage(123, 'Test message');

      // Flush should attempt to persist
      await store.shutdown();

      expect(vi.mocked(mkdir)).toHaveBeenCalledWith('/mock/home/.ari/conversations', { recursive: true });
      expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
        '/mock/home/.ari/conversations/123.json',
        expect.any(String),
        'utf-8',
      );
    });

    it('should load session from disk if cache miss', async () => {
      const { readFile } = await import('node:fs/promises');

      const mockState = {
        messages: [
          { role: 'user', content: 'Restored message', timestamp: Date.now() },
        ],
        lastActivity: Date.now(),
      };

      vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(mockState));

      const history = await store.getHistory(123);

      expect(vi.mocked(readFile)).toHaveBeenCalledWith(
        '/mock/home/.ari/conversations/123.json',
        'utf-8',
      );
      expect(history).toHaveLength(1);
      expect(history[0]?.content).toBe('Restored message');
    });

    it('should handle read errors gracefully', async () => {
      const { readFile } = await import('node:fs/promises');

      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      const history = await store.getHistory(123);

      // Should create new session on error
      expect(history).toHaveLength(0);
    });

    it('should handle write errors gracefully', async () => {
      const { writeFile } = await import('node:fs/promises');

      vi.mocked(writeFile).mockRejectedValue(new Error('Disk full'));

      // Should not throw
      await expect(store.addUserMessage(123, 'Test')).resolves.toBeDefined();
      await expect(store.shutdown()).resolves.toBeUndefined();
    });

    it('should not load expired sessions from disk', async () => {
      const { readFile } = await import('node:fs/promises');

      const expiredState = {
        messages: [
          { role: 'user', content: 'Old message', timestamp: Date.now() - (25 * 60 * 60 * 1000) },
        ],
        lastActivity: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      };

      vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(expiredState));

      const history = await store.getHistory(123);

      // Should create fresh session, not load expired one
      expect(history).toHaveLength(0);
    });
  });

  describe('shutdown', () => {
    it('should flush all dirty sessions on shutdown', async () => {
      const { writeFile } = await import('node:fs/promises');

      await store.addUserMessage(100, 'Message A');
      await store.addUserMessage(200, 'Message B');

      vi.mocked(writeFile).mockClear();

      await store.shutdown();

      // Should persist both sessions
      expect(vi.mocked(writeFile)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
        '/mock/home/.ari/conversations/100.json',
        expect.any(String),
        'utf-8',
      );
      expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
        '/mock/home/.ari/conversations/200.json',
        expect.any(String),
        'utf-8',
      );
    });

    it('should stop periodic persist timer', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      await store.shutdown();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should not flush if no dirty sessions', async () => {
      const { writeFile } = await import('node:fs/promises');

      vi.mocked(writeFile).mockClear();

      await store.shutdown();

      expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
    });
  });

  describe('periodic persistence', () => {
    it('should persist dirty sessions every 30 seconds', async () => {
      const { writeFile } = await import('node:fs/promises');

      // Create store with fake timers active
      vi.useFakeTimers();
      const timedStore = new ConversationStore();

      await timedStore.addUserMessage(123, 'Test message');

      vi.mocked(writeFile).mockClear();

      // Advance time by 30 seconds
      await vi.advanceTimersByTimeAsync(30_000);

      expect(vi.mocked(writeFile)).toHaveBeenCalled();

      await timedStore.shutdown();
      vi.useRealTimers();
    });
  });
});
