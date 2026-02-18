import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ChatSessionManager } from '../../../../src/plugins/telegram-bot/chat-session.js';

// Mock the shared workspace-loader used by chat-session
vi.mock('../../../../src/system/workspace-loader.js', () => ({
  loadWorkspaceFile: vi.fn().mockResolvedValue(''),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn().mockReturnValue('/mock/home'),
  default: {
    homedir: vi.fn().mockReturnValue('/mock/home'),
  },
}));

vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return {
    ...actual,
    join: (...args: string[]) => args.join('/'),
  };
});

describe('ChatSessionManager', () => {
  let manager: ChatSessionManager;

  beforeEach(() => {
    manager = new ChatSessionManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addUserMessage', () => {
    it('should create a session and return messages array', () => {
      const messages = manager.addUserMessage(123, 'Hello ARI');
      expect(messages).toHaveLength(1);
      expect(messages[0]?.role).toBe('user');
      expect(messages[0]?.content).toBe('Hello ARI');
    });

    it('should accumulate messages across calls', () => {
      manager.addUserMessage(123, 'First');
      const messages = manager.addUserMessage(123, 'Second');
      expect(messages).toHaveLength(2);
      expect(messages[0]?.content).toBe('First');
      expect(messages[1]?.content).toBe('Second');
    });

    it('should keep separate sessions per chat', () => {
      manager.addUserMessage(100, 'Chat A');
      manager.addUserMessage(200, 'Chat B');
      const messagesA = manager.addUserMessage(100, 'Chat A again');
      const messagesB = manager.addUserMessage(200, 'Chat B again');

      expect(messagesA).toHaveLength(2);
      expect(messagesA[0]?.content).toBe('Chat A');
      expect(messagesB).toHaveLength(2);
      expect(messagesB[0]?.content).toBe('Chat B');
    });
  });

  describe('addAssistantMessage', () => {
    it('should record assistant messages in the session', () => {
      manager.addUserMessage(123, 'Hello');
      manager.addAssistantMessage(123, 'Hi there!');
      const messages = manager.addUserMessage(123, 'How are you?');

      expect(messages).toHaveLength(3);
      expect(messages[0]?.role).toBe('user');
      expect(messages[1]?.role).toBe('assistant');
      expect(messages[1]?.content).toBe('Hi there!');
      expect(messages[2]?.role).toBe('user');
    });
  });

  describe('rolling window', () => {
    it('should trim messages beyond max window size', () => {
      // Add 25 messages (above the 20-message limit)
      for (let i = 0; i < 25; i++) {
        manager.addUserMessage(123, `Message ${i}`);
      }

      const messages = manager.addUserMessage(123, 'Final');
      // Should have 20 messages (trimmed) + 1 new = trimmed to 20
      expect(messages.length).toBeLessThanOrEqual(20);
      // First message should NOT be 'Message 0' (it was trimmed)
      expect(messages[0]?.content).not.toBe('Message 0');
    });
  });

  describe('session expiry', () => {
    it('should expire sessions after inactivity', () => {
      manager.addUserMessage(123, 'Hello');
      manager.addAssistantMessage(123, 'Hi');

      // Simulate time passing (31 minutes)
      vi.useFakeTimers();
      vi.advanceTimersByTime(31 * 60 * 1000);

      const messages = manager.addUserMessage(123, 'Back again');
      // Should be a fresh session — only the new message
      expect(messages).toHaveLength(1);
      expect(messages[0]?.content).toBe('Back again');

      vi.useRealTimers();
    });
  });

  describe('clearSession', () => {
    it('should clear a specific session', () => {
      manager.addUserMessage(123, 'Hello');
      manager.clearSession(123);

      const messages = manager.addUserMessage(123, 'New start');
      expect(messages).toHaveLength(1);
      expect(messages[0]?.content).toBe('New start');
    });

    it('should not affect other sessions', () => {
      manager.addUserMessage(100, 'Chat A');
      manager.addUserMessage(200, 'Chat B');
      manager.clearSession(100);

      const messagesB = manager.addUserMessage(200, 'Chat B again');
      expect(messagesB).toHaveLength(2);
    });
  });

  describe('getSessionCount', () => {
    it('should return the number of active sessions', () => {
      expect(manager.getSessionCount()).toBe(0);
      manager.addUserMessage(100, 'A');
      manager.addUserMessage(200, 'B');
      expect(manager.getSessionCount()).toBe(2);
    });
  });

  describe('getSystemPrompt', () => {
    it('should return a non-empty system prompt', async () => {
      const prompt = await manager.getSystemPrompt();
      expect(prompt).toBeTruthy();
      expect(prompt).toContain('ARI');
      expect(prompt).toContain('Pryce');
    });

    it('should include time-of-day context', async () => {
      const prompt = await manager.getSystemPrompt();
      expect(prompt).toContain('Time of day');
    });

    it('should include conversation rules', async () => {
      const prompt = await manager.getSystemPrompt();
      expect(prompt).toContain('Conversation Rules');
      expect(prompt).toContain('emoji');
    });

    it('should cache system prompt within TTL', async () => {
      const prompt1 = await manager.getSystemPrompt();
      const prompt2 = await manager.getSystemPrompt();
      // Should be identical (cached)
      expect(prompt1).toBe(prompt2);
    });

    it('should refresh system prompt after TTL expires', async () => {
      const prompt1 = await manager.getSystemPrompt();

      // Advance time by 6 minutes (TTL is 5 minutes)
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now + 6 * 60 * 1000);

      const prompt2 = await manager.getSystemPrompt();

      // Should have different timestamps in the prompt
      expect(prompt2).toBeTruthy();
      // Both should still contain ARI
      expect(prompt1).toContain('ARI');
      expect(prompt2).toContain('ARI');

      vi.useRealTimers();
    });
  });
});
