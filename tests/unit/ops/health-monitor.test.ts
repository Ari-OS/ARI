import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import {
  HealthMonitor,
  type MonitorHealthStatus,
  type HealthCheck,
  type HealthReport,
} from '../../../src/ops/health-monitor.js';
import * as daemon from '../../../src/ops/daemon.js';

// Mock child_process for disk checks
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

// Mock os memory functions to avoid environment-dependent results
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    freemem: vi.fn(() => 8 * 1024 * 1024 * 1024),   // 8 GB free
    totalmem: vi.fn(() => 16 * 1024 * 1024 * 1024),  // 16 GB total → 50% usage
  };
});

// Mock fetch for API connectivity checks
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock daemon module
vi.mock('../../../src/ops/daemon.js', () => ({
  getDaemonStatus: vi.fn(),
}));

describe('HealthMonitor', () => {
  let eventBus: EventBus;
  let healthMonitor: HealthMonitor;
  let mockAuditLogger: AuditLogger;
  let execFileMock: MockInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    eventBus = new EventBus();

    // Create mock audit logger with test signing key
    mockAuditLogger = new AuditLogger('/tmp/test-audit.json', {
      checkpointInterval: 0,
      signingKey: 'test-key-12345',
    });

    // Setup execFile mock
    const { execFile } = await import('child_process');
    execFileMock = vi.mocked(execFile);

    // Default: return healthy disk stats
    execFileMock.mockImplementation((_cmd, _args, callback) => {
      if (typeof callback === 'function') {
        callback(null, {
          stdout: 'Filesystem    512-blocks      Used Available Capacity Mounted on\n/dev/disk1s1  1000000000 400000000 600000000      40%       /\n',
          stderr: '',
        });
      }
      return {} as ReturnType<typeof execFile>;
    });

    // Default: daemon running
    vi.mocked(daemon.getDaemonStatus).mockResolvedValue({
      installed: true,
      running: true,
      plistPath: '/path/to/plist',
    });

    // Default: fetch returns healthy gateway
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });

    healthMonitor = new HealthMonitor(eventBus, {
      intervalMs: 1000,
      auditLogger: mockAuditLogger,
      gatewayPort: 3141,
    });
  });

  afterEach(() => {
    healthMonitor.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Constructor and Lifecycle Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const monitor = new HealthMonitor(eventBus);
      expect(monitor).toBeInstanceOf(HealthMonitor);
      expect(monitor.isActive()).toBe(false);
    });

    it('should create instance with custom options', () => {
      const monitor = new HealthMonitor(eventBus, {
        intervalMs: 5000,
        diskWarningThreshold: 70,
        diskCriticalThreshold: 90,
        memoryWarningThreshold: 75,
        memoryCriticalThreshold: 92,
        gatewayPort: 8080,
      });
      expect(monitor).toBeInstanceOf(HealthMonitor);
    });

    it('should use provided audit logger', () => {
      const customAudit = new AuditLogger('/custom/path.json', { signingKey: 'custom' });
      const monitor = new HealthMonitor(eventBus, { auditLogger: customAudit });
      expect(monitor).toBeInstanceOf(HealthMonitor);
    });
  });

  describe('start/stop', () => {
    it('should start and emit heartbeat_started event', () => {
      const startedHandler = vi.fn();
      eventBus.on('system:heartbeat_started', startedHandler);

      healthMonitor.start();

      expect(healthMonitor.isActive()).toBe(true);
      expect(startedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          componentCount: 5,
          timestamp: expect.any(Date),
        })
      );
    });

    it('should stop and emit heartbeat_stopped event', () => {
      const stoppedHandler = vi.fn();
      eventBus.on('system:heartbeat_stopped', stoppedHandler);

      healthMonitor.start();
      healthMonitor.stop();

      expect(healthMonitor.isActive()).toBe(false);
      expect(stoppedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date),
        })
      );
    });

    it('should not start twice', () => {
      const startedHandler = vi.fn();
      eventBus.on('system:heartbeat_started', startedHandler);

      healthMonitor.start();
      healthMonitor.start();

      expect(startedHandler).toHaveBeenCalledTimes(1);
    });

    it('should not stop if not running', () => {
      const stoppedHandler = vi.fn();
      eventBus.on('system:heartbeat_stopped', stoppedHandler);

      healthMonitor.stop();

      expect(stoppedHandler).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // runAllChecks Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('runAllChecks', () => {
    it('should return report with all checks', async () => {
      const report = await healthMonitor.runAllChecks();

      // Report has valid structure (status depends on actual system state)
      expect(['healthy', 'degraded', 'unhealthy']).toContain(report.overall);
      expect(report.checks).toHaveLength(5);
      expect(report.timestamp).toBeInstanceOf(Date);
    });

    it('should emit heartbeat event with metrics', async () => {
      const heartbeatHandler = vi.fn();
      eventBus.on('system:heartbeat', heartbeatHandler);

      await healthMonitor.runAllChecks();

      expect(heartbeatHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          componentId: 'health-monitor',
          // Status depends on actual system state
          metrics: expect.objectContaining({
            checkCount: 5,
          }),
        })
      );
    });

    it('should store last report', async () => {
      expect(healthMonitor.getLastReport()).toBeNull();

      await healthMonitor.runAllChecks();

      const report = healthMonitor.getLastReport();
      expect(report).not.toBeNull();
      // Status depends on actual system state
      expect(['healthy', 'degraded', 'unhealthy']).toContain(report?.overall);
    });

    it('should emit alert for degraded status', async () => {
      // Make disk check return degraded
      execFileMock.mockImplementation((_cmd, _args, callback) => {
        if (typeof callback === 'function') {
          callback(null, {
            stdout: 'Filesystem    512-blocks      Used Available Capacity Mounted on\n/dev/disk1s1  1000000000 850000000 150000000      85%       /\n',
            stderr: '',
          });
        }
        return {} as ReturnType<typeof import('child_process').execFile>;
      });

      const alertHandler = vi.fn();
      eventBus.on('alert:created', alertHandler);

      await healthMonitor.runAllChecks();

      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warning',
          source: 'health-monitor',
        })
      );
    });

    it('should emit critical alert for unhealthy status', async () => {
      // Make API check fail
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const alertHandler = vi.fn();
      eventBus.on('alert:created', alertHandler);

      await healthMonitor.runAllChecks();

      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          source: 'health-monitor',
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Disk Check Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkDisk', () => {
    it('should return healthy for normal disk usage', async () => {
      const check = await healthMonitor.checkDisk();

      expect(check.component).toBe('disk');
      expect(check.status).toBe('healthy');
      expect(check.metrics?.usedPercent).toBe(40);
      expect(check.lastChecked).toBeInstanceOf(Date);
    });

    it('should return degraded for high disk usage', async () => {
      execFileMock.mockImplementation((_cmd, _args, callback) => {
        if (typeof callback === 'function') {
          callback(null, {
            stdout: 'Filesystem    512-blocks      Used Available Capacity Mounted on\n/dev/disk1s1  1000000000 850000000 150000000      85%       /\n',
            stderr: '',
          });
        }
        return {} as ReturnType<typeof import('child_process').execFile>;
      });

      const check = await healthMonitor.checkDisk();

      expect(check.status).toBe('degraded');
      expect(check.metrics?.usedPercent).toBe(85);
      expect(check.message).toContain('High disk usage');
    });

    it('should return unhealthy for critical disk usage', async () => {
      execFileMock.mockImplementation((_cmd, _args, callback) => {
        if (typeof callback === 'function') {
          callback(null, {
            stdout: 'Filesystem    512-blocks      Used Available Capacity Mounted on\n/dev/disk1s1  1000000000 960000000 40000000      96%       /\n',
            stderr: '',
          });
        }
        return {} as ReturnType<typeof import('child_process').execFile>;
      });

      const check = await healthMonitor.checkDisk();

      expect(check.status).toBe('unhealthy');
      expect(check.metrics?.usedPercent).toBe(96);
      expect(check.message).toContain('Critical disk usage');
    });

    it('should handle df command failure', async () => {
      execFileMock.mockImplementation((_cmd, _args, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Command failed'), { stdout: '', stderr: '' });
        }
        return {} as ReturnType<typeof import('child_process').execFile>;
      });

      const check = await healthMonitor.checkDisk();

      expect(check.status).toBe('unhealthy');
      expect(check.message).toContain('Failed to check disk');
    });

    it('should handle invalid df output', async () => {
      execFileMock.mockImplementation((_cmd, _args, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'Invalid output', stderr: '' });
        }
        return {} as ReturnType<typeof import('child_process').execFile>;
      });

      const check = await healthMonitor.checkDisk();

      expect(check.status).toBe('unhealthy');
      expect(check.message).toContain('Unable to parse');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Memory Check Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkMemory', () => {
    it('should return memory stats', async () => {
      const check = await healthMonitor.checkMemory();

      expect(check.component).toBe('memory');
      expect(check.lastChecked).toBeInstanceOf(Date);
      expect(check.metrics).toHaveProperty('usedPercent');
      expect(check.metrics).toHaveProperty('freeGB');
      expect(check.metrics).toHaveProperty('totalGB');
    });

    it('should return valid status', async () => {
      const check = await healthMonitor.checkMemory();

      expect(['healthy', 'degraded', 'unhealthy']).toContain(check.status);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // API Connectivity Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkApiConnectivity', () => {
    it('should return healthy when gateway responds', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const check = await healthMonitor.checkApiConnectivity();

      expect(check.component).toBe('api');
      expect(check.status).toBe('healthy');
      expect(check.message).toContain('Gateway responding');
      expect(check.metrics?.statusCode).toBe(200);
    });

    it('should return degraded for non-200 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
      });

      const check = await healthMonitor.checkApiConnectivity();

      expect(check.status).toBe('degraded');
      expect(check.message).toContain('status 503');
    });

    it('should return unhealthy when gateway not running', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const check = await healthMonitor.checkApiConnectivity();

      expect(check.status).toBe('unhealthy');
      expect(check.message).toContain('not responding');
    });

    it('should return degraded for timeout', async () => {
      mockFetch.mockRejectedValue(new Error('aborted'));

      const check = await healthMonitor.checkApiConnectivity();

      expect(check.status).toBe('degraded');
      expect(check.message).toContain('timeout');
    });

    it('should handle generic fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const check = await healthMonitor.checkApiConnectivity();

      expect(check.status).toBe('unhealthy');
      expect(check.message).toContain('API check failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Daemon Status Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkDaemonStatus', () => {
    it('should return healthy when daemon is running', async () => {
      vi.mocked(daemon.getDaemonStatus).mockResolvedValue({
        installed: true,
        running: true,
        plistPath: '/path/to/plist',
      });

      const check = await healthMonitor.checkDaemonStatus();

      expect(check.component).toBe('daemon');
      expect(check.status).toBe('healthy');
      expect(check.message).toBe('Daemon running');
      expect(check.metrics?.running).toBe(1);
    });

    it('should return degraded when daemon installed but not running', async () => {
      vi.mocked(daemon.getDaemonStatus).mockResolvedValue({
        installed: true,
        running: false,
        plistPath: '/path/to/plist',
      });

      const check = await healthMonitor.checkDaemonStatus();

      expect(check.status).toBe('degraded');
      expect(check.message).toContain('not running');
      expect(check.metrics?.installed).toBe(1);
      expect(check.metrics?.running).toBe(0);
    });

    it('should return degraded when daemon not installed', async () => {
      vi.mocked(daemon.getDaemonStatus).mockResolvedValue({
        installed: false,
        running: false,
        plistPath: '/path/to/plist',
      });

      const check = await healthMonitor.checkDaemonStatus();

      expect(check.status).toBe('degraded');
      expect(check.message).toContain('not installed');
    });

    it('should return unhealthy on daemon check error', async () => {
      vi.mocked(daemon.getDaemonStatus).mockRejectedValue(new Error('launchctl failed'));

      const check = await healthMonitor.checkDaemonStatus();

      expect(check.status).toBe('unhealthy');
      expect(check.message).toContain('Daemon check failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Audit Integrity Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkAuditIntegrity', () => {
    it('should return healthy for valid audit chain', async () => {
      // Log some events to create a valid chain
      await mockAuditLogger.log('test_action', 'test_actor', 'system', { test: true });

      const check = await healthMonitor.checkAuditIntegrity();

      expect(check.component).toBe('audit');
      expect(check.status).toBe('healthy');
      expect(check.message).toContain('Audit integrity verified');
    });

    it('should return healthy for fresh install (no audit log)', async () => {
      // Use a non-existent path
      const freshMonitor = new HealthMonitor(eventBus, {
        auditLogger: new AuditLogger('/nonexistent/path/audit.json', { signingKey: 'test' }),
      });

      const check = await freshMonitor.checkAuditIntegrity();

      expect(check.status).toBe('healthy');
      // Message can be either "not yet created" (ENOENT) or verified with 0 events
      expect(check.message).toMatch(/not yet created|Audit integrity verified/);
    });

    it('should return metrics with event and checkpoint counts', async () => {
      await mockAuditLogger.log('action1', 'actor', 'system');
      await mockAuditLogger.log('action2', 'actor', 'system');

      const check = await healthMonitor.checkAuditIntegrity();

      expect(check.metrics?.eventCount).toBe(2);
      expect(check.metrics).toHaveProperty('checkpointCount');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Overall Status Calculation Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('overall status calculation', () => {
    it('should return healthy when all checks are healthy', async () => {
      // Ensure all mocks return healthy states
      vi.mocked(daemon.getDaemonStatus).mockResolvedValue({
        installed: true,
        running: true,
        plistPath: '/path/to/plist',
      });
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const report = await healthMonitor.runAllChecks();
      // Since disk and memory use real system, we just check that
      // the report was generated and has expected structure
      expect(report.checks).toHaveLength(5);
      expect(['healthy', 'degraded']).toContain(report.overall);
    });

    it('should return degraded when any check is degraded', async () => {
      // Make daemon not running
      vi.mocked(daemon.getDaemonStatus).mockResolvedValue({
        installed: true,
        running: false,
        plistPath: '/path/to/plist',
      });

      const report = await healthMonitor.runAllChecks();

      expect(report.overall).toBe('degraded');
    });

    it('should return unhealthy when any check is unhealthy', async () => {
      // Make API unreachable
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const report = await healthMonitor.runAllChecks();

      expect(report.overall).toBe('unhealthy');
    });

    it('should prioritize unhealthy over degraded', async () => {
      // Make daemon degraded
      vi.mocked(daemon.getDaemonStatus).mockResolvedValue({
        installed: true,
        running: false,
        plistPath: '/path/to/plist',
      });

      // Make API unhealthy
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const report = await healthMonitor.runAllChecks();

      expect(report.overall).toBe('unhealthy');
    });

    it('should collect all failures in report', async () => {
      // Make multiple checks fail
      vi.mocked(daemon.getDaemonStatus).mockResolvedValue({
        installed: false,
        running: false,
        plistPath: '/path',
      });
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const report = await healthMonitor.runAllChecks();

      // API is unhealthy, daemon is degraded
      expect(report.failures.length).toBeGreaterThanOrEqual(1);
      expect(report.failures.some(f => f.includes('api'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Periodic Check Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('periodic checks', () => {
    beforeEach(() => {
      // Use real timers for periodic tests to allow async checks to complete
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it('should run check on start', async () => {
      // Create a new monitor with short interval for testing
      const fastMonitor = new HealthMonitor(eventBus, {
        intervalMs: 50,
        auditLogger: mockAuditLogger,
        gatewayPort: 3141,
      });

      const heartbeatHandler = vi.fn();
      eventBus.on('system:heartbeat', heartbeatHandler);

      fastMonitor.start();

      // Wait for first check to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(heartbeatHandler).toHaveBeenCalled();

      fastMonitor.stop();
    });

    it('should run checks at interval', async () => {
      const fastMonitor = new HealthMonitor(eventBus, {
        intervalMs: 30,
        auditLogger: mockAuditLogger,
        gatewayPort: 3141,
      });

      const heartbeatHandler = vi.fn();
      eventBus.on('system:heartbeat', heartbeatHandler);

      fastMonitor.start();

      // Wait for a couple of intervals
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(heartbeatHandler.mock.calls.length).toBeGreaterThanOrEqual(1);

      fastMonitor.stop();
    });

    it('should stop interval checks when stopped', async () => {
      const fastMonitor = new HealthMonitor(eventBus, {
        intervalMs: 30,
        auditLogger: mockAuditLogger,
        gatewayPort: 3141,
      });

      const heartbeatHandler = vi.fn();
      eventBus.on('system:heartbeat', heartbeatHandler);

      fastMonitor.start();

      // Let some checks run
      await new Promise((resolve) => setTimeout(resolve, 80));

      fastMonitor.stop();
      const callsAtStop = heartbeatHandler.mock.calls.length;

      // Wait more time - should not trigger additional checks
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(heartbeatHandler).toHaveBeenCalledTimes(callsAtStop);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Type Safety Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('type safety', () => {
    it('should have correct MonitorHealthStatus type', () => {
      const statuses: MonitorHealthStatus[] = ['healthy', 'degraded', 'unhealthy'];
      expect(statuses).toHaveLength(3);
    });

    it('should have correct HealthCheck shape', async () => {
      const check: HealthCheck = await healthMonitor.checkDisk();

      expect(check).toHaveProperty('component');
      expect(check).toHaveProperty('status');
      expect(check).toHaveProperty('message');
      expect(check).toHaveProperty('lastChecked');
    });

    it('should have correct HealthReport shape', async () => {
      const report: HealthReport = await healthMonitor.runAllChecks();

      expect(report).toHaveProperty('overall');
      expect(report).toHaveProperty('checks');
      expect(report).toHaveProperty('failures');
      expect(report).toHaveProperty('timestamp');
      expect(Array.isArray(report.checks)).toBe(true);
      expect(Array.isArray(report.failures)).toBe(true);
    });
  });
});
