/**
 * API Key Health Monitor for ARI.
 *
 * Monitors registered API keys for expiration, missing values,
 * and rotation schedules. Emits security events when keys are
 * missing or approaching expiration.
 *
 * @module kernel/api-key-monitor
 */

import type { EventBus } from './event-bus.js';
import { createLogger } from './logger.js';

const log = createLogger('api-key-monitor');

export interface KeyRegistration {
  name: string;
  envVar: string;
  expiresAt?: Date;
  rotationDays: number;
}

export interface KeyHealthReport {
  name: string;
  status: 'healthy' | 'expiring_soon' | 'expired' | 'missing';
  isSet: boolean;
  daysUntilExpiry?: number;
  lastChecked: string;
  recommendation: string;
}

const DEFAULT_ROTATION_DAYS = 90;
const EXPIRY_WARNING_DAYS = 14;

export class ApiKeyMonitor {
  private readonly keys: Map<string, KeyRegistration> = new Map();
  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Register an API key to monitor.
   */
  registerKey(params: {
    name: string;
    envVar: string;
    expiresAt?: Date;
    rotationDays?: number;
  }): void {
    const registration: KeyRegistration = {
      name: params.name,
      envVar: params.envVar,
      expiresAt: params.expiresAt,
      rotationDays: params.rotationDays ?? DEFAULT_ROTATION_DAYS,
    };

    this.keys.set(params.name, registration);
    log.info(`Registered key monitor: ${params.name} (env: ${params.envVar})`);
  }

  /**
   * Check all registered keys and return health reports.
   */
  checkKeys(): KeyHealthReport[] {
    const reports: KeyHealthReport[] = [];

    for (const [, registration] of this.keys) {
      const report = this.checkSingleKey(registration);
      reports.push(report);

      if (report.status === 'missing') {
        this.eventBus.emit('security:alert', {
          type: 'key_missing',
          source: 'api-key-monitor',
          data: {
            keyName: registration.name,
            envVar: registration.envVar,
            recommendation: report.recommendation,
          },
        });
      } else if (report.status === 'expiring_soon' || report.status === 'expired') {
        this.eventBus.emit('security:alert', {
          type: 'key_expiring',
          source: 'api-key-monitor',
          data: {
            keyName: registration.name,
            status: report.status,
            daysUntilExpiry: report.daysUntilExpiry,
            recommendation: report.recommendation,
          },
        });
      }
    }

    return reports;
  }

  /**
   * Get keys expiring within N days.
   */
  getExpiringKeys(withinDays: number): KeyHealthReport[] {
    const allReports = this.checkKeys();
    return allReports.filter(report => {
      if (report.status === 'expired') return true;
      if (report.status === 'expiring_soon' && report.daysUntilExpiry !== undefined) {
        return report.daysUntilExpiry <= withinDays;
      }
      return false;
    });
  }

  /**
   * Get the number of registered keys.
   */
  get registeredCount(): number {
    return this.keys.size;
  }

  /**
   * Check a single key's health.
   */
  private checkSingleKey(registration: KeyRegistration): KeyHealthReport {
    const now = new Date();
    const lastChecked = now.toISOString();
    const envValue = process.env[registration.envVar];

    // Key not set in environment
    if (!envValue || envValue.trim() === '') {
      return {
        name: registration.name,
        status: 'missing',
        isSet: false,
        lastChecked,
        recommendation: `Set ${registration.envVar} environment variable`,
      };
    }

    // No expiration date known — assume healthy
    if (!registration.expiresAt) {
      return {
        name: registration.name,
        status: 'healthy',
        isSet: true,
        lastChecked,
        recommendation: `Consider setting expiration date for rotation tracking (${registration.rotationDays}-day cycle)`,
      };
    }

    // Calculate days until expiry
    const msUntilExpiry = registration.expiresAt.getTime() - now.getTime();
    const daysUntilExpiry = Math.floor(msUntilExpiry / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      return {
        name: registration.name,
        status: 'expired',
        isSet: true,
        daysUntilExpiry,
        lastChecked,
        recommendation: `Key expired ${Math.abs(daysUntilExpiry)} days ago — rotate immediately`,
      };
    }

    if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
      return {
        name: registration.name,
        status: 'expiring_soon',
        isSet: true,
        daysUntilExpiry,
        lastChecked,
        recommendation: `Key expires in ${daysUntilExpiry} days — schedule rotation`,
      };
    }

    return {
      name: registration.name,
      status: 'healthy',
      isSet: true,
      daysUntilExpiry,
      lastChecked,
      recommendation: `Next rotation due in ${daysUntilExpiry} days`,
    };
  }
}
