/**
 * HEALTH MONITOR - System Health Monitoring
 *
 * Tracks health of ARI's critical components:
 * - Gateway connectivity (HTTP GET to 127.0.0.1:3141/health)
 * - Memory usage (process.memoryUsage() vs 512MB threshold)
 * - Disk space (check ~/.ari/ directory size)
 *
 * Layer: L5 Execution (can import L0-L4)
 */

import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';

const log = createLogger('health-monitor');
const execFileAsync = promisify(execFile);

const DEFAULT_PORT = 3141;
const MEMORY_THRESHOLD_MB = 512;
const DISK_THRESHOLD_MB = 1024; // 1GB warning

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  duration: number; // ms
  timestamp: string;
}

export interface HealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  timestamp: string;
}

type HealthCheckFunction = () => Promise<HealthCheckResult>;

export class HealthMonitor {
  private eventBus: EventBus;
  private checks: Map<string, HealthCheckFunction> = new Map();
  private lastReport: HealthReport | null = null;
  private port: number;

  constructor(eventBus: EventBus, options?: { port?: number }) {
    this.eventBus = eventBus;
    this.port = options?.port || DEFAULT_PORT;

    // Register built-in checks
    this.registerBuiltInChecks();
  }

  /**
   * Register built-in health checks
   */
  private registerBuiltInChecks(): void {
    this.registerCheck('gateway', async () => this.checkGateway());
    this.registerCheck('memory', async () => this.checkMemory());
    this.registerCheck('disk', async () => this.checkDisk());
  }

  /**
   * Register a custom health check
   */
  registerCheck(name: string, check: HealthCheckFunction): void {
    this.checks.set(name, check);
    log.info({ name }, 'Registered health check');
  }

  /**
   * Run all health checks
   */
  async runAll(): Promise<HealthReport> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];

    // Run all checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(
      async ([name, check]) => {
        const checkStart = Date.now();
        try {
          const result = await check();
          return result;
        } catch (error) {
          const duration = Date.now() - checkStart;
          return {
            name,
            status: 'unhealthy' as const,
            message: `Check failed: ${error instanceof Error ? error.message : String(error)}`,
            duration,
            timestamp: new Date().toISOString(),
          };
        }
      }
    );

    checks.push(...(await Promise.all(checkPromises)));

    // Determine overall status (worst individual status)
    const statusPriority = { healthy: 0, degraded: 1, unhealthy: 2 };
    type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
    const worstStatus: HealthStatus = checks.reduce<HealthStatus>((worst, check) => {
      return statusPriority[check.status] > statusPriority[worst]
        ? check.status
        : worst;
    }, 'healthy');

    const report: HealthReport = {
      overall: worstStatus,
      checks,
      timestamp: new Date().toISOString(),
    };

    this.lastReport = report;

    // Emit audit event
    this.eventBus.emit('audit:log', {
      action: 'health_check_completed',
      agent: 'health-monitor',
      trustLevel: 'system',
      details: {
        overall: report.overall,
        checkCount: checks.length,
        duration: Date.now() - startTime,
      },
    });

    log.info(
      { overall: report.overall, checkCount: checks.length },
      'Health check completed'
    );

    return report;
  }

  /**
   * Get last health report
   */
  getLastReport(): HealthReport | null {
    return this.lastReport;
  }

  /**
   * Check gateway health via HTTP GET
   */
  private async checkGateway(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const name = 'gateway';

    try {
      const response = await fetch(`http://127.0.0.1:${this.port}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        return {
          name,
          status: 'unhealthy',
          message: `Gateway returned ${response.status}`,
          duration,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        name,
        status: 'healthy',
        message: 'Gateway responding',
        duration,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        name,
        status: 'unhealthy',
        message: `Gateway unreachable: ${error instanceof Error ? error.message : String(error)}`,
        duration,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check memory usage
   */
  private checkMemory(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const name = 'memory';

    try {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const duration = Date.now() - startTime;

      if (heapUsedMB > MEMORY_THRESHOLD_MB) {
        return Promise.resolve({
          name,
          status: 'degraded',
          message: `High memory usage: ${heapUsedMB}MB / ${MEMORY_THRESHOLD_MB}MB`,
          duration,
          timestamp: new Date().toISOString(),
        });
      }

      if (heapUsedMB > MEMORY_THRESHOLD_MB * 0.8) {
        return Promise.resolve({
          name,
          status: 'degraded',
          message: `Memory usage: ${heapUsedMB}MB / ${MEMORY_THRESHOLD_MB}MB`,
          duration,
          timestamp: new Date().toISOString(),
        });
      }

      return Promise.resolve({
        name,
        status: 'healthy',
        message: `Memory usage: ${heapUsedMB}MB / ${MEMORY_THRESHOLD_MB}MB`,
        duration,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      return Promise.resolve({
        name,
        status: 'unhealthy',
        message: `Memory check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Check disk space for ~/.ari/ directory
   */
  private async checkDisk(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const name = 'disk';
    const ariDir = join(homedir(), '.ari');

    try {
      // Use 'du -sm' to get directory size in MB
      const { stdout } = await execFileAsync('du', ['-sm', ariDir]);
      const sizeMB = parseInt(stdout.split('\t')[0], 10);
      const duration = Date.now() - startTime;

      if (sizeMB > DISK_THRESHOLD_MB) {
        return {
          name,
          status: 'degraded',
          message: `High disk usage: ${sizeMB}MB in ~/.ari/`,
          duration,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        name,
        status: 'healthy',
        message: `Disk usage: ${sizeMB}MB in ~/.ari/`,
        duration,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        name,
        status: 'unhealthy',
        message: `Disk check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
