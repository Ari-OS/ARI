import type { EventBus } from '../event-bus.js';
import type { AuditLogger } from '../audit.js';
import {
  type ExpiryAlert,
  type Credential,
} from './types.js';
import type { CredentialStore } from './credential-store.js';

/**
 * Expiry Monitor Configuration
 */
export interface ExpiryMonitorConfig {
  /** Check interval in ms (default: 1 hour) */
  checkInterval: number;
  /** Warning threshold in days (default: 14) */
  warningDays: number;
  /** Critical threshold in days (default: 3) */
  criticalDays: number;
}

const DEFAULT_CONFIG: ExpiryMonitorConfig = {
  checkInterval: 60 * 60 * 1000, // 1 hour
  warningDays: 14,
  criticalDays: 3,
};

/**
 * ExpiryMonitor
 *
 * Monitors credential expiry and emits alerts.
 */
export class ExpiryMonitor {
  private credentialStore: CredentialStore;
  private eventBus: EventBus;
  private audit: AuditLogger;
  private config: ExpiryMonitorConfig;
  private checkTimer: NodeJS.Timeout | null = null;
  private alertCallbacks: Array<(alert: ExpiryAlert) => void> = [];
  private running: boolean = false;

  constructor(
    credentialStore: CredentialStore,
    eventBus: EventBus,
    audit: AuditLogger,
    config?: Partial<ExpiryMonitorConfig>
  ) {
    this.credentialStore = credentialStore;
    this.eventBus = eventBus;
    this.audit = audit;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Run initial check
    void this.checkExpiry();

    // Schedule periodic checks
    this.checkTimer = setInterval(() => {
      void this.checkExpiry();
    }, this.config.checkInterval);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Check all credentials for expiry
   */
  async checkExpiry(): Promise<ExpiryAlert[]> {
    const alerts: ExpiryAlert[] = [];
    const now = new Date();

    for (const credential of this.credentialStore.getAll()) {
      // Skip if no expiry date
      if (!credential.expiresAt) continue;

      const expiresAt = new Date(credential.expiresAt);
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Check if expired
      if (daysUntilExpiry <= 0) {
        // Mark as expired
        await this.credentialStore.setStatus(credential.id, 'expired');

        alerts.push({
          credentialId: credential.id,
          credentialName: credential.name,
          provider: credential.provider,
          expiresAt,
          daysUntilExpiry,
          severity: 'critical',
        });

        continue;
      }

      // Check if within warning thresholds
      let severity: ExpiryAlert['severity'] | null = null;

      if (daysUntilExpiry <= this.config.criticalDays) {
        severity = 'critical';
      } else if (daysUntilExpiry <= this.config.warningDays) {
        severity = 'warning';
      }

      if (severity) {
        alerts.push({
          credentialId: credential.id,
          credentialName: credential.name,
          provider: credential.provider,
          expiresAt,
          daysUntilExpiry,
          severity,
        });
      }
    }

    // Emit alerts
    for (const alert of alerts) {
      this.emitAlert(alert);
    }

    // Log if any alerts
    if (alerts.length > 0) {
      await this.audit.log('auth_expiry_check', 'system', 'system', {
        totalAlerts: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        info: alerts.filter(a => a.severity === 'info').length,
      });
    }

    return alerts;
  }

  /**
   * Get credentials expiring within a number of days
   */
  getExpiringWithin(days: number): Credential[] {
    const now = new Date();
    const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return this.credentialStore.getAll().filter(credential => {
      if (!credential.expiresAt) return false;
      const expiresAt = new Date(credential.expiresAt);
      return expiresAt <= threshold && expiresAt > now;
    });
  }

  /**
   * Get expired credentials
   */
  getExpired(): Credential[] {
    const now = new Date();

    return this.credentialStore.getAll().filter(credential => {
      if (!credential.expiresAt) return false;
      return new Date(credential.expiresAt) <= now;
    });
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (alert: ExpiryAlert) => void): () => void {
    this.alertCallbacks.push(callback);
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index !== -1) this.alertCallbacks.splice(index, 1);
    };
  }

  /**
   * Emit an expiry alert
   */
  private emitAlert(alert: ExpiryAlert): void {
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ExpiryMonitorConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart with new interval if running
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ExpiryMonitorConfig {
    return { ...this.config };
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Force an immediate check
   */
  async forceCheck(): Promise<ExpiryAlert[]> {
    return this.checkExpiry();
  }
}
