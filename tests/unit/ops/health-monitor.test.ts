import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { HealthMonitor } from '../../../src/ops/health-monitor.js';

describe('HealthMonitor', () => {
  let eventBus: EventBus;
  let monitor: HealthMonitor;

  beforeEach(() => {
    eventBus = new EventBus();
    monitor = new HealthMonitor(eventBus, { port: 3141 });
    vi.clearAllMocks();
  });

  describe('registerCheck', () => {
    it('should register a custom health check', async () => {
      const customCheck = vi.fn(async () => ({
        name: 'custom',
        status: 'healthy' as const,
        message: 'All good',
        duration: 10,
        timestamp: new Date().toISOString(),
      }));

      monitor.registerCheck('custom', customCheck);

      const report = await monitor.runAll();

      expect(customCheck).toHaveBeenCalled();
      expect(report.checks.some((c) => c.name === 'custom')).toBe(true);
    });
  });

  describe('runAll', () => {
    it('should run all registered checks', async () => {
      const report = await monitor.runAll();

      // Built-in checks: gateway, memory, disk
      expect(report.checks.length).toBeGreaterThanOrEqual(3);
      expect(report.checks.map((c) => c.name)).toContain('gateway');
      expect(report.checks.map((c) => c.name)).toContain('memory');
      expect(report.checks.map((c) => c.name)).toContain('disk');
    });

    it('should set overall status to worst individual status', async () => {
      // Register a check that returns unhealthy
      monitor.registerCheck('failing', async () => ({
        name: 'failing',
        status: 'unhealthy' as const,
        message: 'Failed',
        duration: 5,
        timestamp: new Date().toISOString(),
      }));

      const report = await monitor.runAll();

      expect(report.overall).toBe('unhealthy');
    });

    it('should emit audit event on completion', async () => {
      const auditListener = vi.fn();
      eventBus.on('audit:log', auditListener);

      await monitor.runAll();

      expect(auditListener).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'health_check_completed',
          agent: 'health-monitor',
          trustLevel: 'system',
        })
      );
    });

    it('should handle check errors gracefully', async () => {
      monitor.registerCheck('error', async () => {
        throw new Error('Check failed');
      });

      const report = await monitor.runAll();

      const errorCheck = report.checks.find((c) => c.name === 'error');
      expect(errorCheck).toBeDefined();
      expect(errorCheck?.status).toBe('unhealthy');
      expect(errorCheck?.message).toContain('Check failed');
    });
  });

  describe('getLastReport', () => {
    it('should return null before first run', () => {
      const report = monitor.getLastReport();
      expect(report).toBeNull();
    });

    it('should return last report after run', async () => {
      await monitor.runAll();

      const report = monitor.getLastReport();
      expect(report).not.toBeNull();
      expect(report?.checks.length).toBeGreaterThan(0);
    });
  });

  describe('memory check', () => {
    it('should report memory usage', async () => {
      const report = await monitor.runAll();

      const memoryCheck = report.checks.find((c) => c.name === 'memory');
      expect(memoryCheck).toBeDefined();
      expect(memoryCheck?.message).toContain('MB');
    });

    it('should mark as degraded when memory is high', async () => {
      // Mock process.memoryUsage to return high memory
      const originalMemoryUsage = process.memoryUsage;
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 600 * 1024 * 1024, // 600MB (above 512MB threshold)
        heapTotal: 0,
        external: 0,
        rss: 0,
        arrayBuffers: 0,
      });

      const report = await monitor.runAll();

      const memoryCheck = report.checks.find((c) => c.name === 'memory');
      expect(memoryCheck?.status).toBe('degraded');

      // Restore original
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('gateway check', () => {
    it('should report unhealthy when gateway is unreachable', async () => {
      // Mock fetch to fail
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const report = await monitor.runAll();

      const gatewayCheck = report.checks.find((c) => c.name === 'gateway');
      expect(gatewayCheck).toBeDefined();
      expect(gatewayCheck?.status).toBe('unhealthy');
      expect(gatewayCheck?.message).toContain('unreachable');
    });

    it('should report unhealthy when gateway returns error status', async () => {
      // Mock fetch to return 500
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const report = await monitor.runAll();

      const gatewayCheck = report.checks.find((c) => c.name === 'gateway');
      expect(gatewayCheck?.status).toBe('unhealthy');
      expect(gatewayCheck?.message).toContain('500');
    });
  });

  describe('status priority', () => {
    it('should prioritize unhealthy over degraded', async () => {
      monitor.registerCheck('degraded', async () => ({
        name: 'degraded',
        status: 'degraded' as const,
        message: 'Degraded',
        duration: 5,
        timestamp: new Date().toISOString(),
      }));

      monitor.registerCheck('unhealthy', async () => ({
        name: 'unhealthy',
        status: 'unhealthy' as const,
        message: 'Unhealthy',
        duration: 5,
        timestamp: new Date().toISOString(),
      }));

      const report = await monitor.runAll();

      expect(report.overall).toBe('unhealthy');
    });

    it('should prioritize degraded over healthy', async () => {
      // Mock fetch to make gateway check healthy
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      monitor.registerCheck('healthy', async () => ({
        name: 'healthy',
        status: 'healthy' as const,
        message: 'Healthy',
        duration: 5,
        timestamp: new Date().toISOString(),
      }));

      monitor.registerCheck('degraded', async () => ({
        name: 'degraded',
        status: 'degraded' as const,
        message: 'Degraded',
        duration: 5,
        timestamp: new Date().toISOString(),
      }));

      const report = await monitor.runAll();

      expect(report.overall).toBe('degraded');
    });
  });
});
