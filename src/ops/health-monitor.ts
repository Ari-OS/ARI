/**
 * HEALTH MONITOR - System Health Check Module
 *
 * P1 module for comprehensive system health monitoring.
 * Runs periodic checks on disk, memory, API connectivity,
 * daemon status, and audit chain integrity.
 *
 * L5 Layer (Ops) - can import from L0-L4
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { freemem, totalmem, homedir } from 'os';
import { join } from 'path';

import { EventBus } from '../kernel/event-bus.js';
import { AuditLogger } from '../kernel/audit.js';
import { getDaemonStatus, type DaemonStatus } from './daemon.js';

const execFileAsync = promisify(execFile);

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** Health status for HealthMonitor checks */
export type MonitorHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheck {
  component: string;
  status: MonitorHealthStatus;
  message: string;
  metrics?: Record<string, number>;
  lastChecked: Date;
}

export interface HealthReport {
  overall: MonitorHealthStatus;
  checks: HealthCheck[];
  failures: string[];
  timestamp: Date;
}

export interface HealthMonitorOptions {
  /** Check interval in milliseconds (default: 15 minutes) */
  intervalMs?: number;
  /** Disk space warning threshold percentage (default: 80) */
  diskWarningThreshold?: number;
  /** Disk space critical threshold percentage (default: 95) */
  diskCriticalThreshold?: number;
  /** Memory warning threshold percentage (default: 80) */
  memoryWarningThreshold?: number;
  /** Memory critical threshold percentage (default: 95) */
  memoryCriticalThreshold?: number;
  /** Gateway port to check (default: 3141) */
  gatewayPort?: number;
  /** Custom audit logger instance */
  auditLogger?: AuditLogger;
}

// ═══════════════════════════════════════════════════════════════════════════
// Health Monitor Implementation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * System health monitoring service.
 * Performs periodic checks and emits health events via EventBus.
 */
export class HealthMonitor {
  private eventBus: EventBus;
  private auditLogger: AuditLogger;
  private lastReport: HealthReport | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Configuration
  private readonly intervalMs: number;
  private readonly diskWarningThreshold: number;
  private readonly diskCriticalThreshold: number;
  private readonly memoryWarningThreshold: number;
  private readonly memoryCriticalThreshold: number;
  private readonly gatewayPort: number;
  private readonly ariDataPath: string;

  constructor(eventBus: EventBus, options?: HealthMonitorOptions) {
    this.eventBus = eventBus;
    this.auditLogger = options?.auditLogger ?? new AuditLogger();

    // Configuration with defaults
    this.intervalMs = options?.intervalMs ?? 15 * 60 * 1000; // 15 minutes
    this.diskWarningThreshold = options?.diskWarningThreshold ?? 80;
    this.diskCriticalThreshold = options?.diskCriticalThreshold ?? 95;
    this.memoryWarningThreshold = options?.memoryWarningThreshold ?? 80;
    this.memoryCriticalThreshold = options?.memoryCriticalThreshold ?? 95;
    this.gatewayPort = options?.gatewayPort ?? 3141;
    this.ariDataPath = join(homedir(), '.ari');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Starts the periodic health check interval.
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Run initial check
    void this.runAllChecks();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      void this.runAllChecks();
    }, this.intervalMs);

    this.eventBus.emit('system:heartbeat_started', {
      timestamp: new Date(),
      componentCount: 5, // disk, memory, api, daemon, audit
    });
  }

  /**
   * Stops the periodic health check interval.
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isRunning = false;

    this.eventBus.emit('system:heartbeat_stopped', {
      timestamp: new Date(),
    });
  }

  /**
   * Returns whether the monitor is currently running.
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Runs all health checks and generates a comprehensive report.
   */
  async runAllChecks(): Promise<HealthReport> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];
    const failures: string[] = [];

    // Run all checks in parallel for efficiency
    const [diskCheck, memoryCheck, apiCheck, daemonCheck, auditCheck] =
      await Promise.all([
        this.checkDisk(),
        this.checkMemory(),
        this.checkApiConnectivity(),
        this.checkDaemonStatus(),
        this.checkAuditIntegrity(),
      ]);

    checks.push(diskCheck, memoryCheck, apiCheck, daemonCheck, auditCheck);

    // Collect failures
    for (const check of checks) {
      if (check.status === 'unhealthy') {
        failures.push(`${check.component}: ${check.message}`);
      }
    }

    // Determine overall status
    const overall = this.calculateOverallStatus(checks);

    const report: HealthReport = {
      overall,
      checks,
      failures,
      timestamp: new Date(),
    };

    this.lastReport = report;

    // Emit health events
    const latencyMs = Date.now() - startTime;
    this.eventBus.emit('system:heartbeat', {
      componentId: 'health-monitor',
      status: overall,
      timestamp: new Date(),
      metrics: { checkCount: checks.length, failureCount: failures.length },
      latencyMs,
    });

    // Emit alerts for degraded/unhealthy status
    if (overall !== 'healthy') {
      this.emitHealthAlert(report);
    }

    return report;
  }

  /**
   * Returns the last generated health report.
   */
  getLastReport(): HealthReport | null {
    return this.lastReport;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Individual Health Checks
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Checks disk space availability.
   * Uses df command to get filesystem usage.
   */
  async checkDisk(): Promise<HealthCheck> {
    const component = 'disk';
    const lastChecked = new Date();

    try {
      // Use df to check disk usage for the home directory
      const { stdout } = await execFileAsync('df', ['-P', homedir()]);
      const lines = stdout.trim().split('\n');

      if (lines.length < 2) {
        return {
          component,
          status: 'unhealthy',
          message: 'Unable to parse disk usage output',
          lastChecked,
        };
      }

      // Parse df output: Filesystem 512-blocks Used Available Capacity Mounted
      const fields = lines[1].split(/\s+/);
      const capacityStr = fields[4]; // e.g., "45%"
      const usedPercent = parseInt(capacityStr.replace('%', ''), 10);
      const availableKB = parseInt(fields[3], 10) * 512 / 1024; // Convert 512-blocks to KB
      const availableGB = Math.round(availableKB / 1024 / 1024 * 100) / 100;

      let status: MonitorHealthStatus = 'healthy';
      let message = `Disk usage: ${usedPercent}% (${availableGB}GB available)`;

      if (usedPercent >= this.diskCriticalThreshold) {
        status = 'unhealthy';
        message = `Critical disk usage: ${usedPercent}% (only ${availableGB}GB available)`;
      } else if (usedPercent >= this.diskWarningThreshold) {
        status = 'degraded';
        message = `High disk usage: ${usedPercent}% (${availableGB}GB available)`;
      }

      return {
        component,
        status,
        message,
        metrics: {
          usedPercent,
          availableGB,
        },
        lastChecked,
      };
    } catch (error) {
      return {
        component,
        status: 'unhealthy',
        message: `Failed to check disk: ${error instanceof Error ? error.message : String(error)}`,
        lastChecked,
      };
    }
  }

  /**
   * Checks system memory availability.
   * Uses Node.js os module for memory stats.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async checkMemory(): Promise<HealthCheck> {
    const component = 'memory';
    const lastChecked = new Date();

    try {
      const totalBytes = totalmem();
      const freeBytes = freemem();
      const usedBytes = totalBytes - freeBytes;
      const usedPercent = Math.round((usedBytes / totalBytes) * 100);
      const freeGB = Math.round((freeBytes / 1024 / 1024 / 1024) * 100) / 100;
      const totalGB = Math.round((totalBytes / 1024 / 1024 / 1024) * 100) / 100;

      let status: MonitorHealthStatus = 'healthy';
      let message = `Memory usage: ${usedPercent}% (${freeGB}GB free of ${totalGB}GB)`;

      if (usedPercent >= this.memoryCriticalThreshold) {
        status = 'unhealthy';
        message = `Critical memory usage: ${usedPercent}% (only ${freeGB}GB free)`;
      } else if (usedPercent >= this.memoryWarningThreshold) {
        status = 'degraded';
        message = `High memory usage: ${usedPercent}% (${freeGB}GB free)`;
      }

      return {
        component,
        status,
        message,
        metrics: {
          usedPercent,
          freeGB,
          totalGB,
        },
        lastChecked,
      };
    } catch (error) {
      return {
        component,
        status: 'unhealthy',
        message: `Failed to check memory: ${error instanceof Error ? error.message : String(error)}`,
        lastChecked,
      };
    }
  }

  /**
   * Checks API/Gateway connectivity.
   * Attempts to reach the local gateway health endpoint.
   */
  async checkApiConnectivity(): Promise<HealthCheck> {
    const component = 'api';
    const lastChecked = new Date();

    try {
      const startTime = Date.now();
      const url = `http://127.0.0.1:${this.gatewayPort}/health`;

      // Use native fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return {
          component,
          status: 'healthy',
          message: `Gateway responding (${latencyMs}ms)`,
          metrics: { latencyMs, statusCode: response.status },
          lastChecked,
        };
      }

      return {
        component,
        status: 'degraded',
        message: `Gateway returned status ${response.status}`,
        metrics: { latencyMs, statusCode: response.status },
        lastChecked,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check if it's a connection refused (gateway not running)
      if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed')) {
        return {
          component,
          status: 'unhealthy',
          message: `Gateway not responding on port ${this.gatewayPort}`,
          lastChecked,
        };
      }

      // Timeout or abort
      if (errorMsg.includes('aborted') || errorMsg.includes('timeout')) {
        return {
          component,
          status: 'degraded',
          message: 'Gateway response timeout (>5s)',
          lastChecked,
        };
      }

      return {
        component,
        status: 'unhealthy',
        message: `API check failed: ${errorMsg}`,
        lastChecked,
      };
    }
  }

  /**
   * Checks daemon/launchd service status.
   * Verifies the ARI daemon is installed and running.
   */
  async checkDaemonStatus(): Promise<HealthCheck> {
    const component = 'daemon';
    const lastChecked = new Date();

    try {
      const status: DaemonStatus = await getDaemonStatus();

      if (status.running) {
        return {
          component,
          status: 'healthy',
          message: 'Daemon running',
          metrics: { installed: 1, running: 1 },
          lastChecked,
        };
      }

      if (status.installed) {
        return {
          component,
          status: 'degraded',
          message: 'Daemon installed but not running',
          metrics: { installed: 1, running: 0 },
          lastChecked,
        };
      }

      return {
        component,
        status: 'degraded',
        message: 'Daemon not installed',
        metrics: { installed: 0, running: 0 },
        lastChecked,
      };
    } catch (error) {
      return {
        component,
        status: 'unhealthy',
        message: `Daemon check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastChecked,
      };
    }
  }

  /**
   * Checks audit chain integrity.
   * Verifies hash chain and checkpoint signatures.
   */
  async checkAuditIntegrity(): Promise<HealthCheck> {
    const component = 'audit';
    const lastChecked = new Date();

    try {
      // Load audit log
      await this.auditLogger.load();

      // Verify chain integrity
      const chainResult = this.auditLogger.verify();
      if (!chainResult.valid) {
        return {
          component,
          status: 'unhealthy',
          message: `Audit chain broken: ${chainResult.details}`,
          metrics: { brokenAt: chainResult.brokenAt ?? -1 },
          lastChecked,
        };
      }

      // Verify checkpoints
      const checkpointResult = this.auditLogger.verifyCheckpoints();
      if (!checkpointResult.valid) {
        const mismatch = checkpointResult.mismatches[0];
        return {
          component,
          status: 'unhealthy',
          message: `Checkpoint verification failed: ${mismatch.field} mismatch`,
          metrics: {
            checkpointsChecked: checkpointResult.checked,
            mismatches: checkpointResult.mismatches.length,
          },
          lastChecked,
        };
      }

      const events = this.auditLogger.getEvents();
      const checkpoints = this.auditLogger.getCheckpoints();

      return {
        component,
        status: 'healthy',
        message: `Audit integrity verified (${events.length} events, ${checkpoints.length} checkpoints)`,
        metrics: {
          eventCount: events.length,
          checkpointCount: checkpoints.length,
        },
        lastChecked,
      };
    } catch (error) {
      // File not existing is OK for a fresh install
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('ENOENT')) {
        return {
          component,
          status: 'healthy',
          message: 'Audit log not yet created (fresh install)',
          metrics: { eventCount: 0, checkpointCount: 0 },
          lastChecked,
        };
      }

      return {
        component,
        status: 'unhealthy',
        message: `Audit check failed: ${errorMsg}`,
        lastChecked,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calculates overall status from individual checks.
   * Rules: any unhealthy = unhealthy, any degraded = degraded, else healthy.
   */
  private calculateOverallStatus(checks: HealthCheck[]): MonitorHealthStatus {
    const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
    if (hasUnhealthy) {
      return 'unhealthy';
    }

    const hasDegraded = checks.some(c => c.status === 'degraded');
    if (hasDegraded) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Emits an alert event for degraded/unhealthy status.
   */
  private emitHealthAlert(report: HealthReport): void {
    const severity = report.overall === 'unhealthy' ? 'critical' : 'warning';
    const failureCount = report.failures.length;

    this.eventBus.emit('alert:created', {
      id: `health-${Date.now()}`,
      severity,
      title: `System Health ${report.overall.charAt(0).toUpperCase() + report.overall.slice(1)}`,
      message: failureCount > 0
        ? `${failureCount} component(s) failing: ${report.failures.join('; ')}`
        : `System in ${report.overall} state`,
      source: 'health-monitor',
    });
  }
}
