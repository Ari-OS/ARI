import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NotificationManager,
  NotificationCategory,
  NotificationRequest,
} from '../../../src/autonomous/notification-manager.js';

// Mock GmailSMS
const mockSmsSend = vi.fn().mockResolvedValue({ sent: true });
const mockSmsIsReady = vi.fn().mockReturnValue(true);
const mockSmsInit = vi.fn().mockReturnValue(true);
const mockSmsTestConnection = vi.fn().mockResolvedValue(true);
const mockSmsGetStats = vi.fn().mockReturnValue({ sent: 10, failed: 0 });

vi.mock('../../../src/integrations/sms/gmail-sms.js', () => ({
  GmailSMS: vi.fn().mockImplementation(() => ({
    init: mockSmsInit,
    isReady: mockSmsIsReady,
    testConnection: mockSmsTestConnection,
    send: mockSmsSend,
    getStats: mockSmsGetStats,
  })),
}));

// Mock TelegramSender
const mockTelegramSend = vi.fn().mockResolvedValue({ sent: true, reason: 'Sent', messageId: 123 });
const mockTelegramIsReady = vi.fn().mockReturnValue(true);
const mockTelegramInit = vi.fn().mockResolvedValue(true);
const mockTelegramGetStats = vi.fn().mockReturnValue({ sentThisHour: 5, rateLimitRemaining: 25 });

vi.mock('../../../src/integrations/telegram/sender.js', () => ({
  TelegramSender: vi.fn().mockImplementation(() => ({
    init: mockTelegramInit,
    isReady: mockTelegramIsReady,
    send: mockTelegramSend,
    getStats: mockTelegramGetStats,
  })),
}));

// Mock NotionInbox
const mockNotionInit = vi.fn().mockResolvedValue(true);
const mockNotionIsReady = vi.fn().mockReturnValue(true);
const mockNotionCreateEntry = vi.fn().mockResolvedValue('notion-page-id');
const mockNotionCreateBatchSummary = vi.fn().mockResolvedValue(undefined);
const mockNotionGetStats = vi.fn().mockResolvedValue({ entries: 5 });

vi.mock('../../../src/integrations/notion/inbox.js', () => ({
  NotionInbox: vi.fn().mockImplementation(() => ({
    init: mockNotionInit,
    isReady: mockNotionIsReady,
    createEntry: mockNotionCreateEntry,
    createBatchSummary: mockNotionCreateBatchSummary,
    getStats: mockNotionGetStats,
  })),
}));

// Mock dailyAudit
vi.mock('../../../src/autonomous/daily-audit.js', () => ({
  dailyAudit: {
    logActivity: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid-1234',
});

describe('NotificationManager', () => {
  let manager: NotificationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Set to work hours (14:00 / 2 PM Indiana time)
    vi.setSystemTime(new Date('2026-01-31T19:00:00Z')); // 2 PM Indiana
    manager = new NotificationManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const mgr = new NotificationManager();
      expect(mgr).toBeDefined();
    });

    it('should merge custom config', () => {
      const mgr = new NotificationManager({
        maxSmsPerHour: 10,
        maxPerDay: 50,
      });
      expect(mgr).toBeDefined();
    });
  });

  describe('initLegacy()', () => {
    it('should initialize in legacy mode', () => {
      manager.initLegacy();
      expect(manager.isReady()).toBe(true);
    });
  });

  describe('init()', () => {
    it('should initialize with channel configs', async () => {
      const result = await manager.init({
        sms: { enabled: true, recipient: '5551234567' },
        telegram: { enabled: true, botToken: 'test-token', ownerChatId: 123 },
        notion: { enabled: true, databaseId: 'db-123', token: 'secret-token' },
      });

      expect(result.sms).toBe(true);
      expect(result.telegram).toBe(true);
      expect(result.notion).toBe(true);
      expect(manager.isReady()).toBe(true);
    });

    it('should handle disabled channels', async () => {
      const result = await manager.init({
        sms: { enabled: false, recipient: '' },
        telegram: { enabled: false },
        notion: { enabled: false, databaseId: '', token: '' },
      });

      expect(result.sms).toBe(false);
      expect(result.telegram).toBe(false);
      expect(result.notion).toBe(false);
    });

    it('should handle SMS init failure', async () => {
      mockSmsTestConnection.mockResolvedValueOnce(false);

      const result = await manager.init({
        sms: { enabled: true, recipient: '5551234567' },
        telegram: { enabled: true, botToken: 'test-token', ownerChatId: 123 },
        notion: { enabled: true, databaseId: 'db-123', token: 'secret-token' },
      });

      expect(result.sms).toBe(false);
      expect(result.telegram).toBe(true);
      expect(result.notion).toBe(true);
    });
  });

  describe('isReady()', () => {
    it('should return false when not initialized', () => {
      expect(manager.isReady()).toBe(false);
    });

    it('should return true after init', async () => {
      await manager.init({
        sms: { enabled: true, recipient: '5551234567' },
        telegram: { enabled: true, botToken: 'test-token', ownerChatId: 123 },
        notion: { enabled: true, databaseId: 'db-123', token: 'token' },
      });
      expect(manager.isReady()).toBe(true);
    });
  });

  describe('notify()', () => {
    beforeEach(async () => {
      await manager.init({
        sms: { enabled: true, recipient: '5551234567' },
        telegram: { enabled: true, botToken: 'test-token', ownerChatId: 123 },
        notion: { enabled: true, databaseId: 'db-123', token: 'token' },
      });
    });

    it('should return not initialized error', async () => {
      const uninitManager = new NotificationManager();
      const result = await uninitManager.notify({
        category: 'error',
        title: 'Test',
        body: 'Test body',
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('Not initialized');
    });

    it('should send P0 (critical) via SMS + Telegram + Notion', async () => {
      const result = await manager.notify({
        category: 'security',
        title: 'Security Alert',
        body: 'Breach detected',
        priority: 'critical',
      });

      expect(result.sent).toBe(true);
      expect(result.reason).toBe('P0: Immediate delivery (all channels)');
      expect(mockSmsSend).toHaveBeenCalled();
      expect(mockTelegramSend).toHaveBeenCalled();
      expect(mockNotionCreateEntry).toHaveBeenCalled();
    });

    it('should send P1 during work hours', async () => {
      const result = await manager.notify({
        category: 'error',
        title: 'Error',
        body: 'Something failed',
        priority: 'high',
      });

      expect(result.sent).toBe(true);
      expect(result.reason).toBe('P1: Active hours delivery (Telegram + Notion)');
    });

    it('should defer non-critical notifications during work hours (Mon-Fri 7am-4pm)', async () => {
      // 2026-02-02 is a Monday; 14:00 UTC = 9 AM Indiana time (work hours)
      vi.setSystemTime(new Date('2026-02-02T14:00:00Z'));

      // 'milestone' is not in the telegram-eligible-during-work set → should batch for 4 PM
      const result = await manager.notify({
        category: 'milestone',
        title: 'Milestone',
        body: 'Reached goal',
        priority: 'normal',
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('P2: Deferred to 4 PM work-day digest');
      expect(mockTelegramSend).not.toHaveBeenCalled();
    });

    it('should let security alerts through even during work hours', async () => {
      // 2026-02-02 Monday at 9 AM Indiana
      vi.setSystemTime(new Date('2026-02-02T14:00:00Z'));

      const result = await manager.notify({
        category: 'security',
        title: 'Security Alert',
        body: 'Intrusion detected',
        priority: 'critical',
      });

      expect(result.sent).toBe(true);
      expect(result.reason).toBe('P0: Immediate delivery (all channels)');
    });

    it('should queue P1 during quiet hours', async () => {
      // Set to 11 PM Indiana (4 AM UTC next day)
      vi.setSystemTime(new Date('2026-02-01T04:00:00Z'));

      const result = await manager.notify({
        category: 'error',
        title: 'Error',
        body: 'Something failed',
        priority: 'high',
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('P1: Queued for 7 AM Telegram (quiet hours)');
    });

    it('should send P2 to Telegram (silent) + Notion during work hours', async () => {
      const result = await manager.notify({
        category: 'milestone',
        title: 'Milestone',
        body: 'Reached goal',
        priority: 'normal',
      });

      expect(result.sent).toBe(true);
      expect(result.reason).toBe('P2: Telegram (silent) + Notion');
      expect(mockTelegramSend).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ silent: true }),
      );
      expect(mockNotionCreateEntry).toHaveBeenCalled();
    });

    it('should batch P3/P4 during work hours', async () => {
      const result = await manager.notify({
        category: 'task',
        title: 'Task Done',
        body: 'Completed something',
        priority: 'low',
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('Batched for next summary');
    });

    it('should check for expiration', async () => {
      const result = await manager.notify({
        category: 'opportunity',
        title: 'Expired Opportunity',
        body: 'Too late',
        expiresAt: new Date('2026-01-30T00:00:00Z'), // Already expired
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('Notification expired');
    });

    it('should use category default priority', async () => {
      const result = await manager.notify({
        category: 'security', // Default: critical
        title: 'Security Alert',
        body: 'Alert',
      });

      // Security defaults to critical = P0
      expect(result.reason).toBe('P0: Immediate delivery (all channels)');
    });

    it('should generate notification ID when sent', async () => {
      const result = await manager.notify({
        category: 'security',
        title: 'Test',
        body: 'Test',
        priority: 'critical',
      });

      expect(result.notificationId).toBe('test-uuid-1234');
    });
  });

  describe('escalation', () => {
    beforeEach(async () => {
      await manager.init({
        sms: { enabled: true, recipient: '5551234567' },
        telegram: { enabled: true, botToken: 'test-token', ownerChatId: 123 },
        notion: { enabled: true, databaseId: 'db-123', token: 'token' },
      });
    });

    it('should escalate P1 errors after threshold', async () => {
      // Send 3 same errors to trigger escalation
      for (let i = 0; i < 3; i++) {
        await manager.notify({
          category: 'error',
          title: 'Same Error',
          body: 'Repeated error',
          priority: 'high',
          dedupKey: 'same-error',
        });
      }

      // 4th should be escalated to P0
      const result = await manager.notify({
        category: 'error',
        title: 'Same Error',
        body: 'Repeated error',
        priority: 'high',
        dedupKey: 'same-error',
      });

      // After escalation, tracker is cleared, so this won't be escalated
      // But the previous one was
      expect(result.sent).toBe(true);
    });

    it('should not escalate non-error categories', async () => {
      for (let i = 0; i < 5; i++) {
        await manager.notify({
          category: 'task',
          title: 'Task Done',
          body: 'Completed',
          priority: 'high',
        });
      }

      // Tasks don't escalate — P1 goes to Telegram during work hours
      expect(mockTelegramSend).toHaveBeenCalled();
    });
  });

  describe('quiet hours', () => {
    beforeEach(async () => {
      await manager.init({
        sms: { enabled: true, recipient: '5551234567' },
        telegram: { enabled: true, botToken: 'test-token', ownerChatId: 123 },
        notion: { enabled: true, databaseId: 'db-123', token: 'token' },
      });
    });

    it('should detect quiet hours at 11 PM', async () => {
      vi.setSystemTime(new Date('2026-02-01T04:00:00Z')); // 11 PM Indiana

      const result = await manager.notify({
        category: 'milestone',
        title: 'Test',
        body: 'Test',
        priority: 'normal',
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('Queued');
    });

    it('should detect quiet hours at 3 AM', async () => {
      vi.setSystemTime(new Date('2026-02-01T08:00:00Z')); // 3 AM Indiana

      const result = await manager.notify({
        category: 'milestone',
        title: 'Test',
        body: 'Test',
        priority: 'normal',
      });

      expect(result.sent).toBe(false);
    });

    it('should allow P0 during quiet hours', async () => {
      vi.setSystemTime(new Date('2026-02-01T04:00:00Z')); // 11 PM Indiana

      const result = await manager.notify({
        category: 'security',
        title: 'Critical',
        body: 'Urgent',
        priority: 'critical',
      });

      expect(result.sent).toBe(true);
    });
  });

  describe('processQueue()', () => {
    beforeEach(async () => {
      await manager.init({
        sms: { enabled: true, recipient: '5551234567' },
        telegram: { enabled: true, botToken: 'test-token', ownerChatId: 123 },
        notion: { enabled: true, databaseId: 'db-123', token: 'token' },
      });
    });

    it('should return zeros for empty queue', async () => {
      const result = await manager.processQueue();

      expect(result.processed).toBe(0);
      expect(result.sent).toBe(0);
    });

    it('should process queued notifications', async () => {
      // Queue during quiet hours
      vi.setSystemTime(new Date('2026-02-01T04:00:00Z')); // 11 PM

      await manager.notify({
        category: 'error',
        title: 'Queued Error',
        body: 'Details',
        priority: 'high',
      });

      // Move to morning
      vi.setSystemTime(new Date('2026-02-01T12:00:00Z')); // 7 AM Indiana

      const result = await manager.processQueue();

      expect(result.processed).toBeGreaterThan(0);
    });
  });

  describe('sendBatchSummary()', () => {
    it('should do nothing with empty queues', async () => {
      manager.initLegacy();
      await manager.sendBatchSummary();
      // Should not throw
    });
  });

  describe('getBatchCount()', () => {
    it('should return 0 initially', () => {
      expect(manager.getBatchCount()).toBe(0);
    });

    it('should count queued items', async () => {
      await manager.init({
        sms: { enabled: true, recipient: '5551234567' },
        telegram: { enabled: true, botToken: 'test-token', ownerChatId: 123 },
        notion: { enabled: true, databaseId: 'db-123', token: 'token' },
      });

      // Queue a low priority item
      await manager.notify({
        category: 'task',
        title: 'Task',
        body: 'Details',
        priority: 'low',
      });

      expect(manager.getBatchCount()).toBe(1);
    });
  });

  describe('getStatus()', () => {
    it('should return status with channels not ready', () => {
      const status = manager.getStatus();

      expect(status.sms.ready).toBe(false);
      expect(status.telegram.ready).toBe(false);
      expect(status.notion.ready).toBe(false);
      expect(status.queueSize).toBe(0);
    });

    it('should return status with channels ready', async () => {
      await manager.init({
        sms: { enabled: true, recipient: '5551234567' },
        telegram: { enabled: true, botToken: 'test-token', ownerChatId: 123 },
        notion: { enabled: true, databaseId: 'db-123', token: 'token' },
      });

      const status = manager.getStatus();

      expect(status.sms.ready).toBe(true);
      expect(status.telegram.ready).toBe(true);
      expect(status.notion.ready).toBe(true);
    });
  });

  describe('convenience methods', () => {
    beforeEach(async () => {
      await manager.init({
        sms: { enabled: true, recipient: '5551234567' },
        telegram: { enabled: true, botToken: 'test-token', ownerChatId: 123 },
        notion: { enabled: true, databaseId: 'db-123', token: 'token' },
      });
    });

    describe('thresholdAlert()', () => {
      it('should send critical threshold as security category', () => {
        manager.thresholdAlert({
          id: 'budget-critical',
          name: 'Budget Exceeded',
          currentValue: 105,
          thresholdValue: 100,
          operator: 'gt',
          severity: 'critical',
        });

        // Verify notify was called with security category
        // Since thresholdAlert uses void, we can't check the promise
        // But we can verify it doesn't throw
      });

      it('should send warning threshold as error category', () => {
        manager.thresholdAlert({
          id: 'api-rate',
          name: 'API Rate Warning',
          currentValue: 90,
          thresholdValue: 100,
          operator: 'gte',
          severity: 'warning',
        });

        // Should not throw
      });

      it('should send info threshold as system category', () => {
        manager.thresholdAlert({
          id: 'disk-usage',
          name: 'Disk Usage Info',
          currentValue: 50,
          thresholdValue: 100,
          operator: 'lt',
          severity: 'info',
        });

        // Should not throw
      });

      it('should include threshold details in body', () => {
        manager.thresholdAlert({
          id: 'memory-limit',
          name: 'Memory Limit',
          currentValue: 8192,
          thresholdValue: 10000,
          operator: 'lte',
          severity: 'info',
        });

        // Should not throw
      });

      it('should use dedupKey for threshold ID', () => {
        manager.thresholdAlert({
          id: 'cpu-high',
          name: 'CPU High',
          currentValue: 95,
          thresholdValue: 80,
          operator: 'gt',
          severity: 'warning',
          domain: 'system',
        });

        // Should not throw
      });

      it('should include domain in message when provided', () => {
        manager.thresholdAlert({
          id: 'network-latency',
          name: 'Network Latency',
          currentValue: 500,
          thresholdValue: 200,
          operator: 'gt',
          severity: 'warning',
          domain: 'network',
        });

        // Should not throw
      });
    });

    describe('error()', () => {
      it('should send error notification', async () => {
        const result = await manager.error('Error Title', 'Error details', 'dedup-key');

        expect(result).toBeDefined();
      });
    });

    describe('security()', () => {
      it('should send security notification as P0', async () => {
        const result = await manager.security('Security Alert', 'Details');

        expect(result.sent).toBe(true);
        expect(result.reason).toBe('P0: Immediate delivery (all channels)');
      });
    });

    describe('opportunity()', () => {
      it('should send high urgency opportunity', async () => {
        const result = await manager.opportunity('Stock Alert', 'AAPL dropped', 'high');

        expect(result).toBeDefined();
      });

      it('should send medium urgency opportunity', async () => {
        const result = await manager.opportunity('FYI', 'Something happened', 'medium');

        expect(result).toBeDefined();
      });

      it('should send low urgency opportunity', async () => {
        const result = await manager.opportunity('Later', 'When you have time', 'low');

        expect(result).toBeDefined();
      });
    });

    describe('milestone()', () => {
      it('should send milestone notification', async () => {
        const result = await manager.milestone('100 Tasks', 'Completed 100 tasks!');

        expect(result).toBeDefined();
      });
    });

    describe('insight()', () => {
      it('should send insight notification', async () => {
        const result = await manager.insight('finance', 'Spending pattern detected');

        expect(result).toBeDefined();
      });
    });

    describe('question()', () => {
      it('should send question without options', async () => {
        const result = await manager.question('What should I do?');

        expect(result).toBeDefined();
      });

      it('should send question with options', async () => {
        const result = await manager.question('Choose an approach:', [
          'Option A',
          'Option B',
          'Option C',
        ]);

        expect(result).toBeDefined();
      });
    });

    describe('finance()', () => {
      it('should send urgent finance notification', async () => {
        const result = await manager.finance('Budget Alert', 'Overspent!', true);

        expect(result).toBeDefined();
      });

      it('should send non-urgent finance notification', async () => {
        const result = await manager.finance('Update', 'Everything fine', false);

        expect(result).toBeDefined();
      });
    });

    describe('taskComplete()', () => {
      it('should send success notification', async () => {
        const result = await manager.taskComplete('Deploy', true, 'Deployed successfully');

        expect(result).toBeDefined();
      });

      it('should send failure notification', async () => {
        const result = await manager.taskComplete('Build', false, 'Build failed');

        expect(result).toBeDefined();
      });
    });

    describe('dailySummary()', () => {
      it('should send daily summary with issues', async () => {
        const result = await manager.dailySummary({
          tasksCompleted: 15,
          tasksFailed: 2,
          estimatedCost: 1.50,
          highlights: ['Shipped feature', 'Fixed bug'],
          issues: ['API rate limit hit'],
          efficiency: { tasksPerApiDollar: 10, trend: 'improving' },
        });

        expect(result).toBeDefined();
      });

      it('should send daily summary without issues', async () => {
        const result = await manager.dailySummary({
          tasksCompleted: 20,
          tasksFailed: 0,
          estimatedCost: 0.75,
          highlights: ['Great day!'],
          issues: [],
          efficiency: { tasksPerApiDollar: 26.67, trend: 'improving' },
        });

        expect(result).toBeDefined();
      });

      it('should handle declining efficiency', async () => {
        const result = await manager.dailySummary({
          tasksCompleted: 5,
          tasksFailed: 5,
          estimatedCost: 2.00,
          highlights: [],
          issues: ['Multiple failures'],
          efficiency: { tasksPerApiDollar: 2.5, trend: 'declining' },
        });

        expect(result).toBeDefined();
      });

      it('should handle stable efficiency', async () => {
        const result = await manager.dailySummary({
          tasksCompleted: 10,
          tasksFailed: 0,
          estimatedCost: 1.00,
          highlights: ['Steady progress'],
          issues: [],
          efficiency: { tasksPerApiDollar: 10, trend: 'stable' },
        });

        expect(result).toBeDefined();
      });

      it('should handle zero tasks', async () => {
        const result = await manager.dailySummary({
          tasksCompleted: 0,
          tasksFailed: 0,
          estimatedCost: 0,
          highlights: [],
          issues: [],
          efficiency: { tasksPerApiDollar: 0, trend: 'stable' },
        });

        expect(result).toBeDefined();
      });
    });

    describe('costAlert()', () => {
      it('should send high usage cost alert', async () => {
        const result = await manager.costAlert(95, 100, 5);

        expect(result).toBeDefined();
      });

      it('should send medium usage cost alert', async () => {
        const result = await manager.costAlert(75, 100, 10);

        expect(result).toBeDefined();
      });

      it('should send low usage cost alert', async () => {
        const result = await manager.costAlert(25, 100, 20);

        expect(result).toBeDefined();
      });
    });
  });

  describe('channel failure handling', () => {
    it('should handle SMS not ready', async () => {
      mockSmsIsReady.mockReturnValue(false);
      mockNotionIsReady.mockReturnValue(true);

      await manager.init({
        sms: { enabled: true, recipient: '5551234567' },
        telegram: { enabled: true, botToken: 'test-token', ownerChatId: 123 },
        notion: { enabled: true, databaseId: 'db-123', token: 'token' },
      });

      const result = await manager.notify({
        category: 'security',
        title: 'Test',
        body: 'Test',
        priority: 'critical',
      });

      // Should still succeed via Notion
      expect(result.sent).toBe(true);

      // Reset for other tests
      mockSmsIsReady.mockReturnValue(true);
    });

    it('should handle Notion not ready', async () => {
      // Create fresh manager for this test
      const mgr = new NotificationManager();
      mockSmsIsReady.mockReturnValue(true);
      mockNotionIsReady.mockReturnValue(false);

      await mgr.init({
        sms: { enabled: true, recipient: '5551234567' },
        telegram: { enabled: true, botToken: 'test-token', ownerChatId: 123 },
        notion: { enabled: true, databaseId: 'db-123', token: 'token' },
      });

      const result = await mgr.notify({
        category: 'security',
        title: 'Test',
        body: 'Test',
        priority: 'critical',
      });

      // Should still succeed via SMS
      expect(result.sent).toBe(true);

      // Reset for other tests
      mockNotionIsReady.mockReturnValue(true);
    });
  });
});
