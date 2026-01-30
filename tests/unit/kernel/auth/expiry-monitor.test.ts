import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExpiryMonitor, type ExpiryMonitorConfig } from '../../../../src/kernel/auth/expiry-monitor.js';
import type { CredentialStore } from '../../../../src/kernel/auth/credential-store.js';
import type { EventBus } from '../../../../src/kernel/event-bus.js';
import type { AuditLogger } from '../../../../src/kernel/audit.js';
import type { Credential, ExpiryAlert } from '../../../../src/kernel/auth/types.js';

describe('ExpiryMonitor', () => {
  let monitor: ExpiryMonitor;
  let mockCredentialStore: CredentialStore;
  let mockEventBus: EventBus;
  let mockAudit: AuditLogger;

  // Helper to create mock credentials
  function createMockCredential(
    overrides: Partial<Credential> = {}
  ): Credential {
    return {
      id: 'cred-' + Math.random().toString(36).substring(7),
      name: 'Test Credential',
      provider: 'anthropic',
      type: 'api_key',
      status: 'active',
      priority: 0,
      encryptedData: 'encrypted',
      iv: 'iv',
      createdAt: new Date().toISOString(),
      usageCount: 0,
      metadata: {},
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();

    // Create mock credential store
    mockCredentialStore = {
      getAll: vi.fn().mockReturnValue([]),
      setStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as CredentialStore;

    // Create mock event bus
    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn().mockReturnValue(() => {}),
    } as unknown as EventBus;

    // Create mock audit logger
    mockAudit = {
      log: vi.fn().mockResolvedValue({}),
    } as unknown as AuditLogger;

    monitor = new ExpiryMonitor(mockCredentialStore, mockEventBus, mockAudit);
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
  });

  describe('start and stop', () => {
    it('should start monitoring', () => {
      expect(monitor.isRunning()).toBe(false);

      monitor.start();

      expect(monitor.isRunning()).toBe(true);
    });

    it('should not start if already running', () => {
      monitor.start();
      const firstCheck = vi.mocked(mockCredentialStore.getAll).mock.calls.length;

      monitor.start(); // Should be no-op

      // Should not trigger another immediate check
      expect(vi.mocked(mockCredentialStore.getAll).mock.calls.length).toBe(firstCheck);
    });

    it('should stop monitoring', () => {
      monitor.start();
      expect(monitor.isRunning()).toBe(true);

      monitor.stop();

      expect(monitor.isRunning()).toBe(false);
    });

    it('should not throw when stopping while not running', () => {
      expect(() => monitor.stop()).not.toThrow();
    });

    it('should run initial check on start', () => {
      monitor.start();

      expect(mockCredentialStore.getAll).toHaveBeenCalled();
    });

    it('should run periodic checks', async () => {
      monitor.start();

      // Initial check
      expect(mockCredentialStore.getAll).toHaveBeenCalledTimes(1);

      // Advance by check interval (1 hour by default)
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(mockCredentialStore.getAll).toHaveBeenCalledTimes(2);

      // Advance another interval
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(mockCredentialStore.getAll).toHaveBeenCalledTimes(3);
    });

    it('should stop periodic checks after stop', async () => {
      monitor.start();
      expect(mockCredentialStore.getAll).toHaveBeenCalledTimes(1);

      monitor.stop();

      // Advance time - no more checks should happen
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000 * 3);

      expect(mockCredentialStore.getAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkExpiry', () => {
    it('should return empty array when no credentials', async () => {
      const alerts = await monitor.checkExpiry();

      expect(alerts).toEqual([]);
    });

    it('should skip credentials without expiry date', async () => {
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({ expiresAt: undefined }),
        createMockCredential({ expiresAt: undefined }),
      ]);

      const alerts = await monitor.checkExpiry();

      expect(alerts).toEqual([]);
    });

    it('should detect expired credentials', async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          id: 'expired-cred',
          name: 'Expired Key',
          expiresAt: expiredDate.toISOString(),
        }),
      ]);

      const alerts = await monitor.checkExpiry();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].credentialId).toBe('expired-cred');
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].daysUntilExpiry).toBeLessThanOrEqual(0);
    });

    it('should mark expired credentials with expired status', async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          id: 'expired-cred',
          expiresAt: expiredDate.toISOString(),
        }),
      ]);

      await monitor.checkExpiry();

      expect(mockCredentialStore.setStatus).toHaveBeenCalledWith('expired-cred', 'expired');
    });

    it('should detect credentials within critical threshold', async () => {
      const criticalDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          id: 'critical-cred',
          name: 'Critical Key',
          expiresAt: criticalDate.toISOString(),
        }),
      ]);

      const alerts = await monitor.checkExpiry();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].credentialId).toBe('critical-cred');
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].daysUntilExpiry).toBeLessThanOrEqual(3);
    });

    it('should detect credentials within warning threshold', async () => {
      const warningDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          id: 'warning-cred',
          name: 'Warning Key',
          expiresAt: warningDate.toISOString(),
        }),
      ]);

      const alerts = await monitor.checkExpiry();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].credentialId).toBe('warning-cred');
      expect(alerts[0].severity).toBe('warning');
    });

    it('should not alert for credentials outside warning threshold', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          id: 'future-cred',
          expiresAt: futureDate.toISOString(),
        }),
      ]);

      const alerts = await monitor.checkExpiry();

      expect(alerts).toEqual([]);
    });

    it('should handle multiple credentials with different severities', async () => {
      const now = Date.now();
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          id: 'expired',
          name: 'Expired',
          expiresAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        }),
        createMockCredential({
          id: 'critical',
          name: 'Critical',
          expiresAt: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        createMockCredential({
          id: 'warning',
          name: 'Warning',
          expiresAt: new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        createMockCredential({
          id: 'safe',
          name: 'Safe',
          expiresAt: new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ]);

      const alerts = await monitor.checkExpiry();

      expect(alerts).toHaveLength(3);
      expect(alerts.find(a => a.credentialId === 'expired')?.severity).toBe('critical');
      expect(alerts.find(a => a.credentialId === 'critical')?.severity).toBe('critical');
      expect(alerts.find(a => a.credentialId === 'warning')?.severity).toBe('warning');
      expect(alerts.find(a => a.credentialId === 'safe')).toBeUndefined();
    });

    it('should audit when alerts are generated', async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          expiresAt: expiredDate.toISOString(),
        }),
      ]);

      await monitor.checkExpiry();

      expect(mockAudit.log).toHaveBeenCalledWith(
        'auth_expiry_check',
        'system',
        'system',
        expect.objectContaining({
          totalAlerts: 1,
          critical: 1,
          warning: 0,
          info: 0,
        })
      );
    });

    it('should not audit when no alerts', async () => {
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([]);

      await monitor.checkExpiry();

      expect(mockAudit.log).not.toHaveBeenCalled();
    });
  });

  describe('getExpiringWithin', () => {
    it('should return credentials expiring within specified days', () => {
      const now = Date.now();
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          id: 'expiring-soon',
          expiresAt: new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        createMockCredential({
          id: 'expiring-later',
          expiresAt: new Date(now + 15 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        createMockCredential({
          id: 'no-expiry',
          expiresAt: undefined,
        }),
      ]);

      const expiring = monitor.getExpiringWithin(10);

      expect(expiring).toHaveLength(1);
      expect(expiring[0].id).toBe('expiring-soon');
    });

    it('should not include already expired credentials', () => {
      const now = Date.now();
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          id: 'already-expired',
          expiresAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        }),
        createMockCredential({
          id: 'expiring-soon',
          expiresAt: new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ]);

      const expiring = monitor.getExpiringWithin(10);

      expect(expiring).toHaveLength(1);
      expect(expiring[0].id).toBe('expiring-soon');
    });

    it('should return empty array when no credentials expire within threshold', () => {
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          expiresAt: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ]);

      const expiring = monitor.getExpiringWithin(30);

      expect(expiring).toEqual([]);
    });
  });

  describe('getExpired', () => {
    it('should return expired credentials', () => {
      const now = Date.now();
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          id: 'expired-1',
          expiresAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        }),
        createMockCredential({
          id: 'expired-2',
          expiresAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        createMockCredential({
          id: 'not-expired',
          expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        }),
        createMockCredential({
          id: 'no-expiry',
          expiresAt: undefined,
        }),
      ]);

      const expired = monitor.getExpired();

      expect(expired).toHaveLength(2);
      expect(expired.map(c => c.id)).toContain('expired-1');
      expect(expired.map(c => c.id)).toContain('expired-2');
    });

    it('should return empty array when no expired credentials', () => {
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      ]);

      const expired = monitor.getExpired();

      expect(expired).toEqual([]);
    });
  });

  describe('alert callbacks', () => {
    it('should register and call alert callbacks', async () => {
      const callback = vi.fn();
      monitor.onAlert(callback);

      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          id: 'expired-cred',
          name: 'Expired Key',
          provider: 'anthropic',
          expiresAt: expiredDate.toISOString(),
        }),
      ]);

      await monitor.checkExpiry();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          credentialId: 'expired-cred',
          credentialName: 'Expired Key',
          provider: 'anthropic',
          severity: 'critical',
        })
      );
    });

    it('should call multiple callbacks', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      monitor.onAlert(callback1);
      monitor.onAlert(callback2);
      monitor.onAlert(callback3);

      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        }),
      ]);

      await monitor.checkExpiry();

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should allow unsubscribing from alerts', async () => {
      const callback = vi.fn();
      const unsubscribe = monitor.onAlert(callback);

      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        }),
      ]);

      await monitor.checkExpiry();
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      await monitor.checkExpiry();
      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should continue processing after callback error', async () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const successCallback = vi.fn();

      monitor.onAlert(errorCallback);
      monitor.onAlert(successCallback);

      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        }),
      ]);

      // Should not throw
      await expect(monitor.checkExpiry()).resolves.not.toThrow();

      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = monitor.getConfig();

      expect(config.checkInterval).toBe(60 * 60 * 1000); // 1 hour
      expect(config.warningDays).toBe(14);
      expect(config.criticalDays).toBe(3);
    });

    it('should accept custom configuration', () => {
      const customMonitor = new ExpiryMonitor(
        mockCredentialStore,
        mockEventBus,
        mockAudit,
        {
          checkInterval: 30 * 60 * 1000, // 30 minutes
          warningDays: 7,
          criticalDays: 1,
        }
      );

      const config = customMonitor.getConfig();

      expect(config.checkInterval).toBe(30 * 60 * 1000);
      expect(config.warningDays).toBe(7);
      expect(config.criticalDays).toBe(1);
    });

    it('should update configuration', () => {
      monitor.updateConfig({
        warningDays: 21,
        criticalDays: 5,
      });

      const config = monitor.getConfig();

      expect(config.warningDays).toBe(21);
      expect(config.criticalDays).toBe(5);
      expect(config.checkInterval).toBe(60 * 60 * 1000); // Unchanged
    });

    it('should restart with new interval when config updated while running', async () => {
      monitor.start();
      expect(monitor.isRunning()).toBe(true);

      // Reset mock to track new calls
      vi.mocked(mockCredentialStore.getAll).mockClear();

      // Update with new check interval
      monitor.updateConfig({ checkInterval: 10 * 60 * 1000 }); // 10 minutes

      // Should still be running
      expect(monitor.isRunning()).toBe(true);

      // Advance by new interval
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

      // Should have run a check with new interval
      expect(mockCredentialStore.getAll).toHaveBeenCalled();
    });

    it('should return a copy of config', () => {
      const config1 = monitor.getConfig();
      const config2 = monitor.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('forceCheck', () => {
    it('should force an immediate expiry check', async () => {
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        }),
      ]);

      const alerts = await monitor.forceCheck();

      expect(alerts).toHaveLength(1);
      expect(mockCredentialStore.getAll).toHaveBeenCalled();
    });

    it('should work even when monitor is not running', async () => {
      expect(monitor.isRunning()).toBe(false);

      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ]);

      const alerts = await monitor.forceCheck();

      expect(alerts).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle credential expiring exactly at threshold boundary', async () => {
      const now = Date.now();
      // Exactly 3 days (critical threshold)
      const exactlyThreeDays = new Date(now + 3 * 24 * 60 * 60 * 1000);

      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          id: 'boundary-cred',
          expiresAt: exactlyThreeDays.toISOString(),
        }),
      ]);

      const alerts = await monitor.checkExpiry();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
    });

    it('should handle credential expiring today (0 days)', async () => {
      // Expires in 12 hours (same day but not yet expired)
      const laterToday = new Date(Date.now() + 12 * 60 * 60 * 1000);

      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          id: 'today-cred',
          expiresAt: laterToday.toISOString(),
        }),
      ]);

      const alerts = await monitor.checkExpiry();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].daysUntilExpiry).toBe(1); // Ceil of less than a day
    });

    it('should handle mixed credentials with and without expiry', async () => {
      const now = Date.now();
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          id: 'with-expiry',
          expiresAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        }),
        createMockCredential({
          id: 'without-expiry-1',
          expiresAt: undefined,
        }),
        createMockCredential({
          id: 'without-expiry-2',
          expiresAt: undefined,
        }),
      ]);

      const alerts = await monitor.checkExpiry();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].credentialId).toBe('with-expiry');
    });

    it('should correctly populate alert fields', async () => {
      const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      vi.mocked(mockCredentialStore.getAll).mockReturnValue([
        createMockCredential({
          id: 'test-id',
          name: 'Test Name',
          provider: 'github',
          expiresAt: expiresAt.toISOString(),
        }),
      ]);

      const alerts = await monitor.checkExpiry();

      expect(alerts).toHaveLength(1);
      const alert = alerts[0];
      expect(alert.credentialId).toBe('test-id');
      expect(alert.credentialName).toBe('Test Name');
      expect(alert.provider).toBe('github');
      expect(alert.expiresAt).toEqual(expiresAt);
      expect(alert.daysUntilExpiry).toBe(5);
      expect(alert.severity).toBe('warning');
    });
  });
});
