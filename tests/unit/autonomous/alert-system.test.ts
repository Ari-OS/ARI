import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AlertSystem,
  AlertRequest,
  AlertConfig,
  AlertSeverity,
  AlertCategory,
} from '../../../src/autonomous/alert-system.js';

// Mock NotificationManager
const { mockNotify } = vi.hoisted(() => ({
  mockNotify: vi.fn().mockResolvedValue({ sent: true }),
}));

vi.mock('../../../src/autonomous/notification-manager.js', () => ({
  notificationManager: {
    notify: mockNotify,
  },
}));

// Mock dailyAudit
vi.mock('../../../src/autonomous/daily-audit.js', () => ({
  dailyAudit: {
    logActivity: vi.fn().mockResolvedValue(undefined),
  },
  ThresholdConfig: {},
}));

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid-1234',
});

describe('AlertSystem', () => {
  let alertSystem: AlertSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Set to a normal hour (14:00 / 2 PM)
    vi.setSystemTime(new Date('2026-01-31T14:00:00Z'));
    alertSystem = new AlertSystem();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const system = new AlertSystem();
      expect(system).toBeDefined();
    });

    it('should merge custom config with defaults', () => {
      const system = new AlertSystem({ maxAlertsPerHour: 10 });
      expect(system).toBeDefined();
    });
  });

  describe('processAlert()', () => {
    it('should send critical alerts immediately (bypass council)', async () => {
      const request: AlertRequest = {
        category: 'error',
        severity: 'critical',
        title: 'Critical Error',
        message: 'System is down!',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await alertSystem.processAlert(request);

      expect(decision.finalDecision).toBe('send');
      expect(decision.reasoning).toBe('Critical alert - bypassed council');
      expect(decision.totalScore).toBe(1.0);
      expect(mockNotify).toHaveBeenCalled();
    });

    it('should batch alerts during quiet hours', async () => {
      // Set to 23:00 (11 PM) local time - quiet hours
      // Note: Using local time format (no Z suffix) so getHours() works correctly
      vi.setSystemTime(new Date(2026, 0, 31, 23, 0, 0));

      const request: AlertRequest = {
        category: 'info',
        severity: 'info',
        title: 'Info Alert',
        message: 'FYI',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await alertSystem.processAlert(request);

      expect(decision.finalDecision).toBe('batch');
      expect(decision.reasoning).toBe('Quiet hours - batched for morning');
    });

    it('should send critical alerts even during quiet hours', async () => {
      // Set to 23:00 (11 PM) local time - quiet hours
      vi.setSystemTime(new Date(2026, 0, 31, 23, 0, 0));

      const request: AlertRequest = {
        category: 'security',
        severity: 'critical',
        title: 'Security Breach',
        message: 'Intrusion detected',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await alertSystem.processAlert(request);

      expect(decision.finalDecision).toBe('send');
      expect(mockNotify).toHaveBeenCalled();
    });

    it('should process council voting for non-critical alerts', async () => {
      const request: AlertRequest = {
        category: 'opportunity',
        severity: 'warning',
        title: 'Opportunity',
        message: 'Time-sensitive deal',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await alertSystem.processAlert(request);

      expect(decision.votes.length).toBe(4);
      expect(decision.alertId).toBe('test-uuid-1234');
      expect(decision.decidedAt).toBeDefined();
    });

    it('should batch alerts when council score is low', async () => {
      // Create system with high threshold to force batching
      const strictSystem = new AlertSystem({ councilThreshold: 0.99 });

      const request: AlertRequest = {
        category: 'completion',
        severity: 'info',
        title: 'Task Done',
        message: 'Something finished',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await strictSystem.processAlert(request);

      expect(['batch', 'suppress']).toContain(decision.finalDecision);
    });

    it('should rate limit when max alerts per hour reached', async () => {
      // Send max alerts per hour (default 5)
      for (let i = 0; i < 5; i++) {
        mockNotify.mockResolvedValueOnce({ sent: true });
        await alertSystem.processAlert({
          category: 'opportunity',
          severity: 'warning',
          title: `Alert ${i}`,
          message: 'Test',
          source: 'test',
          timestamp: new Date().toISOString(),
        });
      }

      // Next alert should be rate limited
      const decision = await alertSystem.processAlert({
        category: 'opportunity',
        severity: 'warning',
        title: 'Rate Limited Alert',
        message: 'Should be batched',
        source: 'test',
        timestamp: new Date().toISOString(),
      });

      expect(decision.finalDecision).toBe('batch');
      expect(decision.reasoning).toBe('Rate limited - batched for later');
    });
  });

  describe('council voting', () => {
    it('should evaluate security alerts with high urgency', async () => {
      const request: AlertRequest = {
        category: 'security',
        severity: 'warning',
        title: 'Security Alert',
        message: 'Suspicious activity',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await alertSystem.processAlert(request);
      const urgencyVote = decision.votes.find(v => v.voterId === 'urgency');

      expect(urgencyVote?.decision.vote).toBe('send');
      expect(urgencyVote?.decision.confidence).toBe(0.9);
    });

    it('should evaluate opportunity alerts positively', async () => {
      const request: AlertRequest = {
        category: 'opportunity',
        severity: 'info',
        title: 'Opportunity',
        message: 'Check this out',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await alertSystem.processAlert(request);
      const valueVote = decision.votes.find(v => v.voterId === 'value');

      expect(valueVote?.decision.vote).toBe('send');
      expect(valueVote?.decision.confidence).toBe(0.9);
    });

    it('should batch non-critical errors for wellbeing', async () => {
      const request: AlertRequest = {
        category: 'error',
        severity: 'warning',
        title: 'Non-critical Error',
        message: 'Minor issue',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await alertSystem.processAlert(request);
      const wellbeingVote = decision.votes.find(v => v.voterId === 'wellbeing');

      expect(wellbeingVote?.decision.vote).toBe('batch');
    });

    it('should send question alerts (needs input)', async () => {
      const request: AlertRequest = {
        category: 'question',
        severity: 'info',
        title: 'Need Input',
        message: 'ARI needs your decision',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await alertSystem.processAlert(request);
      const valueVote = decision.votes.find(v => v.voterId === 'value');

      expect(valueVote?.decision.vote).toBe('send');
      expect(valueVote?.decision.confidence).toBe(0.8);
    });

    it('should handle insight alerts', async () => {
      const request: AlertRequest = {
        category: 'insight',
        severity: 'info',
        title: 'New Insight',
        message: 'Discovered pattern',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await alertSystem.processAlert(request);
      const valueVote = decision.votes.find(v => v.voterId === 'value');

      expect(valueVote?.decision.vote).toBe('send');
      expect(valueVote?.decision.confidence).toBe(0.7);
    });

    it('should handle threshold alerts', async () => {
      const request: AlertRequest = {
        category: 'threshold',
        severity: 'warning',
        title: 'Threshold Crossed',
        message: 'Budget exceeded',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await alertSystem.processAlert(request);
      const contextVote = decision.votes.find(v => v.voterId === 'context');

      expect(contextVote?.decision.vote).toBe('send');
    });

    it('should handle reminder alerts', async () => {
      const request: AlertRequest = {
        category: 'reminder',
        severity: 'info',
        title: 'Reminder',
        message: 'Remember to check X',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await alertSystem.processAlert(request);
      expect(decision.votes.length).toBe(4);
    });

    it('should protect sleep during late night (wellbeing)', async () => {
      // Set to 2 AM
      vi.setSystemTime(new Date('2026-01-31T02:00:00Z'));
      const system = new AlertSystem();
      

      const request: AlertRequest = {
        category: 'info',
        severity: 'info',
        title: 'FYI',
        message: 'Something happened',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      // This will be batched due to quiet hours first
      const decision = await system.processAlert(request);
      expect(decision.finalDecision).toBe('batch');
    });
  });

  describe('sendAlert()', () => {
    it('should send alerts via NotificationManager', async () => {
      const system = new AlertSystem();

      const request: AlertRequest = {
        category: 'error',
        severity: 'critical',
        title: 'Test',
        message: 'Test',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await system.processAlert(request);

      expect(decision).toBeDefined();
      expect(mockNotify).toHaveBeenCalled();
    });

    it('should track recent alerts after sending', async () => {
      const request: AlertRequest = {
        category: 'opportunity',
        severity: 'warning',
        title: 'Test',
        message: 'Test',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      await alertSystem.processAlert(request);

      expect(mockNotify).toHaveBeenCalled();
    });

    it('should map severity to correct notification priority', async () => {
      const criticalRequest: AlertRequest = {
        category: 'error',
        severity: 'critical',
        title: 'Critical',
        message: 'Test',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      await alertSystem.processAlert(criticalRequest);

      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Critical',
          priority: 'critical',
        })
      );
    });

    it('should map category to notification category', async () => {
      const request: AlertRequest = {
        category: 'opportunity',
        severity: 'warning',
        title: 'Warning',
        message: 'Test',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      await alertSystem.processAlert(request);

      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'opportunity',
          priority: 'high',
        })
      );
    });
  });

  describe('sendBatchedAlerts()', () => {
    it('should do nothing when no batched alerts', async () => {
      await alertSystem.sendBatchedAlerts();
      // No calls because nothing batched
      expect(mockNotify).not.toHaveBeenCalled();
    });

    it('should send summary of batched alerts', async () => {
      // Set to quiet hours to force batching
      vi.setSystemTime(new Date('2026-01-31T23:00:00Z'));
      const system = new AlertSystem();
      

      // Batch some alerts
      await system.processAlert({
        category: 'info',
        severity: 'info',
        title: 'Alert 1',
        message: 'Message 1',
        source: 'test',
        timestamp: new Date().toISOString(),
      });

      await system.processAlert({
        category: 'completion',
        severity: 'info',
        title: 'Alert 2',
        message: 'Message 2',
        source: 'test',
        timestamp: new Date().toISOString(),
      });

      // Clear send calls from batching
      mockNotify.mockClear();

      // Send batched
      await system.sendBatchedAlerts();

      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'daily',
          title: 'Batched Alerts Summary',
        })
      );
    });

    it('should clear batched alerts after sending', async () => {
      vi.setSystemTime(new Date('2026-01-31T23:00:00Z'));
      const system = new AlertSystem();
      

      await system.processAlert({
        category: 'info',
        severity: 'info',
        title: 'Alert 1',
        message: 'Message 1',
        source: 'test',
        timestamp: new Date().toISOString(),
      });

      expect(system.getBatchedCount()).toBe(1);

      await system.sendBatchedAlerts();

      expect(system.getBatchedCount()).toBe(0);
    });

    it('should send batched alerts via NotificationManager', async () => {
      const system = new AlertSystem();
      vi.setSystemTime(new Date('2026-01-31T23:00:00Z'));

      // Force batch an alert by accessing internal state
      (system as any).batchedAlerts = [{ title: 'Test', message: 'Body' }];

      await system.sendBatchedAlerts();
      expect(mockNotify).toHaveBeenCalled();
    });
  });

  describe('isQuietHours()', () => {
    it('should detect quiet hours (late night)', async () => {
      vi.setSystemTime(new Date('2026-01-31T23:30:00Z'));
      const system = new AlertSystem();
      

      const request: AlertRequest = {
        category: 'info',
        severity: 'info',
        title: 'Test',
        message: 'Test',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await system.processAlert(request);
      expect(decision.finalDecision).toBe('batch');
    });

    it('should detect quiet hours (early morning)', async () => {
      vi.setSystemTime(new Date('2026-01-31T05:00:00Z'));
      const system = new AlertSystem();
      

      const request: AlertRequest = {
        category: 'info',
        severity: 'info',
        title: 'Test',
        message: 'Test',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await system.processAlert(request);
      expect(decision.finalDecision).toBe('batch');
    });

    it('should not be quiet hours during day', async () => {
      vi.setSystemTime(new Date('2026-01-31T14:00:00Z'));
      const system = new AlertSystem();
      

      const request: AlertRequest = {
        category: 'opportunity',
        severity: 'warning',
        title: 'Test',
        message: 'Test',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await system.processAlert(request);
      // Should go through council, not auto-batch
      expect(decision.votes.length).toBe(4);
    });

    it('should handle custom quiet hours (same day range)', async () => {
      const system = new AlertSystem({
        quietHoursStart: 13,
        quietHoursEnd: 15,
      });
      

      vi.setSystemTime(new Date('2026-01-31T14:00:00Z'));

      const request: AlertRequest = {
        category: 'info',
        severity: 'info',
        title: 'Test',
        message: 'Test',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await system.processAlert(request);
      expect(decision.finalDecision).toBe('batch');
    });
  });

  describe('isRateLimited()', () => {
    it('should rate limit after max hourly alerts', async () => {
      const system = new AlertSystem({ maxAlertsPerHour: 2, maxAlertsPerDay: 10 });
      

      // Send 2 alerts
      for (let i = 0; i < 2; i++) {
        await system.processAlert({
          category: 'security',
          severity: 'critical', // Critical bypasses council
          title: `Alert ${i}`,
          message: 'Test',
          source: 'test',
          timestamp: new Date().toISOString(),
        });
      }

      // Third should be rate limited
      const decision = await system.processAlert({
        category: 'opportunity',
        severity: 'warning',
        title: 'Rate Limited',
        message: 'Test',
        source: 'test',
        timestamp: new Date().toISOString(),
      });

      expect(decision.finalDecision).toBe('batch');
      expect(decision.reasoning).toBe('Rate limited - batched for later');
    });

    it('should clear old alerts from rate limit tracking', async () => {
      const system = new AlertSystem({ maxAlertsPerHour: 2, maxAlertsPerDay: 10 });
      

      // Send 2 alerts
      for (let i = 0; i < 2; i++) {
        await system.processAlert({
          category: 'security',
          severity: 'critical',
          title: `Alert ${i}`,
          message: 'Test',
          source: 'test',
          timestamp: new Date().toISOString(),
        });
      }

      // Advance time past 1 hour
      vi.advanceTimersByTime(61 * 60 * 1000);

      // Should not be rate limited anymore
      const decision = await system.processAlert({
        category: 'security',
        severity: 'critical',
        title: 'Not Rate Limited',
        message: 'Test',
        source: 'test',
        timestamp: new Date().toISOString(),
      });

      expect(decision.finalDecision).toBe('send');
    });
  });

  describe('triggerThresholdAlert()', () => {
    it('should create and process threshold alert', async () => {
      const threshold = {
        id: 'cost',
        name: 'Daily Cost',
        description: 'Daily spending limit',
        severity: 'critical' as AlertSeverity, // Critical bypasses council
        value: 100,
        operator: '>' as const,
        enabled: true,
      };

      await alertSystem.triggerThresholdAlert(threshold, 150);

      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Daily spending limit'),
        })
      );
    });

    it('should include current value in message', async () => {
      const threshold = {
        id: 'tasks',
        name: 'Task Failures',
        description: 'Too many failed tasks',
        severity: 'critical' as AlertSeverity,
        value: 5,
        operator: '>=' as const,
        enabled: true,
      };

      await alertSystem.triggerThresholdAlert(threshold, 10);

      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Current: 10'),
        })
      );
    });
  });

  describe('getBatchedCount()', () => {
    it('should return 0 initially', () => {
      expect(alertSystem.getBatchedCount()).toBe(0);
    });

    it('should return count of batched alerts', async () => {
      vi.setSystemTime(new Date('2026-01-31T23:00:00Z'));
      const system = new AlertSystem();
      

      await system.processAlert({
        category: 'info',
        severity: 'info',
        title: 'Alert 1',
        message: 'Test',
        source: 'test',
        timestamp: new Date().toISOString(),
      });

      await system.processAlert({
        category: 'info',
        severity: 'info',
        title: 'Alert 2',
        message: 'Test',
        source: 'test',
        timestamp: new Date().toISOString(),
      });

      expect(system.getBatchedCount()).toBe(2);
    });
  });

  describe('council decision thresholds', () => {
    it('should suppress alerts with very low scores', async () => {
      // Create system with normal threshold but send low-value alert
      const system = new AlertSystem({ councilThreshold: 0.8 });
      

      const request: AlertRequest = {
        category: 'completion',
        severity: 'info',
        title: 'Low Priority',
        message: 'Something minor completed',
        source: 'test',
        timestamp: new Date().toISOString(),
      };

      const decision = await system.processAlert(request);

      // With high threshold, low-value alerts should be batched or suppressed
      expect(['batch', 'suppress']).toContain(decision.finalDecision);
    });
  });

  describe('alert with data', () => {
    it('should process alerts with additional data', async () => {
      const request: AlertRequest = {
        category: 'opportunity',
        severity: 'warning',
        title: 'Stock Alert',
        message: 'AAPL dropped 5%',
        data: { symbol: 'AAPL', change: -5, previousClose: 150 },
        source: 'market_monitor',
        timestamp: new Date().toISOString(),
      };

      const decision = await alertSystem.processAlert(request);

      expect(decision).toBeDefined();
      expect(decision.alertId).toBe('test-uuid-1234');
    });
  });
});
