import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// NOTE: Pushover is PERMANENTLY DISABLED in the codebase.
// The kill switch in pushover-client.ts always returns true (disabled).
// All send operations return false, all fetch operations return empty/null.
// These tests verify the disabled behavior works correctly.

import { PushoverClient } from '../../../src/autonomous/pushover-client.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('PushoverClient (Permanently Disabled)', () => {
  let client: PushoverClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    client = new PushoverClient({
      userKey: 'test-user-key',
      apiToken: 'test-api-token',
      deviceId: 'test-device',
      secret: 'test-secret',
    });

    // Default successful response (won't be called since Pushover is disabled)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 1 }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create client with config', () => {
      expect(client).toBeDefined();
    });

    it('should work without optional config', () => {
      const minimalClient = new PushoverClient({
        userKey: 'user',
        apiToken: 'token',
      });
      expect(minimalClient).toBeDefined();
    });
  });

  describe('send() - disabled', () => {
    it('should return false when Pushover is disabled', async () => {
      const result = await client.send('Test message');

      expect(result).toBe(false);
      // Should NOT call fetch when disabled
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return false with title option', async () => {
      const result = await client.send('Message', { title: 'Test Title' });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return false with priority option', async () => {
      const result = await client.send('Urgent!', { priority: 1 });

      expect(result).toBe(false);
    });

    it('should return false with sound option', async () => {
      const result = await client.send('Ding!', { sound: 'cosmic' });

      expect(result).toBe(false);
    });

    it('should return false with URL options', async () => {
      const result = await client.send('Check this out', {
        url: 'https://example.com',
        urlTitle: 'Example',
      });

      expect(result).toBe(false);
    });

    it('should log disabled message to console', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await client.send('Test', { title: 'Title' });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[PUSHOVER DISABLED] Would have sent:',
        'Title'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('registerDevice() - disabled', () => {
    it('should return null when Pushover is disabled', async () => {
      const secret = await client.registerDevice('ari-device');

      expect(secret).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('fetchMessages() - disabled', () => {
    it('should return empty array when Pushover is disabled', async () => {
      const messages = await client.fetchMessages();

      expect(messages).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return empty array if no secret or deviceId', async () => {
      const clientNoSecret = new PushoverClient({
        userKey: 'test-user-key',
        apiToken: 'test-api-token',
      });

      const messages = await clientNoSecret.fetchMessages();

      expect(messages).toEqual([]);
    });
  });

  describe('deleteMessages() - disabled', () => {
    it('should return false when Pushover is disabled', async () => {
      const result = await client.deleteMessages(12345);

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('sendStatus() - disabled', () => {
    it('should return false for online status', async () => {
      const result = await client.sendStatus('online');

      expect(result).toBe(false);
    });

    it('should return false for offline status', async () => {
      const result = await client.sendStatus('offline');

      expect(result).toBe(false);
    });

    it('should return false for error status', async () => {
      const result = await client.sendStatus('error', 'Database connection failed');

      expect(result).toBe(false);
    });
  });

  describe('sendTaskComplete() - disabled', () => {
    it('should return false for success notification', async () => {
      const result = await client.sendTaskComplete('task-123', true, 'Task completed successfully');

      expect(result).toBe(false);
    });

    it('should return false for failure notification', async () => {
      const result = await client.sendTaskComplete('task-456', false, 'Task failed due to timeout');

      expect(result).toBe(false);
    });
  });

  describe('sendDailyAudit() - disabled', () => {
    it('should return false for daily audit summary', async () => {
      const result = await client.sendDailyAudit({
        tasksCompleted: 15,
        tasksFailed: 2,
        estimatedCost: 1.50,
        highlights: ['Shipped new feature', 'Fixed critical bug'],
        issues: ['API rate limit hit'],
      });

      expect(result).toBe(false);
    });

    it('should return false with empty highlights and issues', async () => {
      const result = await client.sendDailyAudit({
        tasksCompleted: 5,
        tasksFailed: 0,
        estimatedCost: 0.25,
        highlights: [],
        issues: [],
      });

      expect(result).toBe(false);
    });
  });

  describe('sendBatchedSummary() - disabled', () => {
    it('should return false for batched summary', async () => {
      const result = await client.sendBatchedSummary([
        { type: 'task', title: 'Task 1 completed' },
        { type: 'task', title: 'Task 2 completed' },
      ]);

      expect(result).toBe(false);
    });

    it('should return true for empty items (special case)', async () => {
      // Empty items returns early with true before the disabled check
      const result = await client.sendBatchedSummary([]);

      expect(result).toBe(true);
    });
  });

  describe('sendCostAlert() - disabled', () => {
    it('should return false for cost alert', async () => {
      const result = await client.sendCostAlert(50, 100, 15);

      expect(result).toBe(false);
    });

    it('should return false at 90%+', async () => {
      const result = await client.sendCostAlert(95, 100, 5);

      expect(result).toBe(false);
    });
  });

  describe('sendOpportunity() - disabled', () => {
    it('should return false for high urgency opportunity', async () => {
      const result = await client.sendOpportunity('Stock Alert', 'AAPL dropped 5%', 'high');

      expect(result).toBe(false);
    });

    it('should return false for low urgency opportunity', async () => {
      const result = await client.sendOpportunity('FYI', 'New feature available', 'low');

      expect(result).toBe(false);
    });
  });

  describe('sendInsight() - disabled', () => {
    it('should return false for insight notification', async () => {
      const result = await client.sendInsight('finance', 'You spent 20% more this week');

      expect(result).toBe(false);
    });
  });

  describe('login() - disabled', () => {
    it('should return null when Pushover is disabled', async () => {
      const result = await client.login('test@example.com', 'password123');

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return null with 2FA when disabled', async () => {
      const result = await client.login('test@example.com', 'password123', '123456');

      expect(result).toBeNull();
    });
  });
});
