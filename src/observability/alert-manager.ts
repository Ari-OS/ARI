import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { EventBus } from '../kernel/event-bus.js';
import {
  AlertsFileSchema,
  AlertSchema,
  type Alert,
  type AlertSeverity,
  type AlertStatus,
  type AlertSummary,
  type AlertRule,
} from './types.js';

const ARI_DIR = path.join(os.homedir(), '.ari');
const ALERTS_FILE = path.join(ARI_DIR, 'alerts.json');

// Default alert rules mapping EventBus events to alerts
const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    eventType: 'security:detected',
    severity: 'critical',
    titleTemplate: 'Security Threat Detected',
    messageTemplate: 'Injection pattern detected: {pattern}. Risk score: {riskScore}',
    dedupKey: 'pattern',
  },
  {
    eventType: 'system:error',
    severity: 'critical',
    titleTemplate: 'System Error',
    messageTemplate: 'System error in {component}: {message}',
    dedupKey: 'component',
  },
  {
    eventType: 'system:halted',
    severity: 'critical',
    titleTemplate: 'System Halted',
    messageTemplate: 'System halted: {reason}',
  },
  {
    eventType: 'permission:denied',
    severity: 'warning',
    titleTemplate: 'Permission Denied',
    messageTemplate: 'Permission denied for {agent} on {tool}: {reason}',
    dedupKey: 'tool',
  },
  {
    eventType: 'memory:quarantined',
    severity: 'warning',
    titleTemplate: 'Memory Quarantined',
    messageTemplate: 'Memory entry quarantined: {reason}',
  },
  {
    eventType: 'scheduler:task_complete',
    severity: 'warning',
    titleTemplate: 'Scheduled Task Failed',
    messageTemplate: 'Task {taskName} failed: {error}',
    dedupKey: 'taskId',
  },
  {
    eventType: 'vote:vetoed',
    severity: 'info',
    titleTemplate: 'Council Vote Vetoed',
    messageTemplate: 'Vote {voteId} was vetoed: {reason}',
  },
];

const MAX_ALERTS = 1000;
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private eventBus: EventBus;
  private rules: AlertRule[] = [...DEFAULT_ALERT_RULES];
  private initialized = false;
  private unsubscribers: Array<() => void> = [];

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    await this.ensureDirectory();
    await this.load();
    this.setupEventSubscriptions();
    this.initialized = true;

    this.eventBus.emit('audit:log', {
      action: 'alert_manager:started',
      agent: 'core',
      trustLevel: 'system' as const,
      details: { ruleCount: this.rules.length },
    });
  }

  private async ensureDirectory(): Promise<void> {
    await fs.mkdir(ARI_DIR, { recursive: true });
  }

  private async load(): Promise<void> {
    try {
      const content = await fs.readFile(ALERTS_FILE, 'utf-8');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(content);
      const validated = AlertsFileSchema.parse(parsed);

      for (const alert of validated.alerts) {
        this.alerts.set(alert.id, alert);
      }
    } catch {
      // File doesn't exist or is invalid, start fresh
      this.alerts = new Map();
    }
  }

  private async save(): Promise<void> {
    const data = {
      version: 1 as const,
      alerts: Array.from(this.alerts.values()),
    };
    await fs.writeFile(ALERTS_FILE, JSON.stringify(data, null, 2));
  }

  private setupEventSubscriptions(): void {
    for (const rule of this.rules) {
      const unsubscribe = this.eventBus.on(
        rule.eventType as keyof import('../kernel/event-bus.js').EventMap,
        (payload) => {
          this.handleEvent(rule, payload as Record<string, unknown>);
        }
      );
      this.unsubscribers.push(unsubscribe);
    }
  }

  private handleEvent(rule: AlertRule, payload: Record<string, unknown>): void {
    // For scheduler:task_complete, only alert on failures
    if (rule.eventType === 'scheduler:task_complete') {
      if ((payload as { success?: boolean }).success !== false) {
        return;
      }
    }

    // Generate dedup key
    const dedupValue = rule.dedupKey ? payload[rule.dedupKey] : undefined;
    const dedupValueStr = typeof dedupValue === 'string' || typeof dedupValue === 'number' ? String(dedupValue) : '';
    const dedupKey = rule.dedupKey
      ? `${rule.eventType}:${dedupValueStr}`
      : rule.eventType;

    // Check for existing alert within dedup window
    const existingAlert = Array.from(this.alerts.values()).find(
      (a) =>
        a.source === rule.eventType &&
        a.status === 'active' &&
        new Date(a.lastSeenAt).getTime() > Date.now() - DEDUP_WINDOW_MS &&
        this.getDedupKey(a, rule) === dedupKey
    );

    if (existingAlert) {
      // Update existing alert
      existingAlert.count++;
      existingAlert.lastSeenAt = new Date().toISOString();
      this.save().catch((error) => {
        this.eventBus.emit('audit:log', {
          action: 'alert_save_failed',
          agent: 'alert_manager',
          trustLevel: 'system' as const,
          details: { error: error instanceof Error ? error.message : String(error) },
        });
      });
      return;
    }

    // Create new alert
    const alert = this.createAlert(rule, payload);
    this.alerts.set(alert.id, alert);

    // Enforce max alerts
    if (this.alerts.size > MAX_ALERTS) {
      const oldestResolved = Array.from(this.alerts.values())
        .filter((a) => a.status === 'resolved')
        .sort((a, b) => new Date(a.firstSeenAt).getTime() - new Date(b.firstSeenAt).getTime())[0];

      if (oldestResolved) {
        this.alerts.delete(oldestResolved.id);
      }
    }

    // Emit alert:created event for WebSocket broadcast
    this.eventBus.emit('alert:created' as keyof import('../kernel/event-bus.js').EventMap, alert as never);

    this.save().catch((error) => {
      this.eventBus.emit('audit:log', {
        action: 'alert_save_failed',
        agent: 'alert_manager',
        trustLevel: 'system' as const,
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    });
  }

  private getDedupKey(alert: Alert, rule: AlertRule): string {
    if (!rule.dedupKey) return rule.eventType;
    const value = alert.details?.[rule.dedupKey];
    const stringValue = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    return `${rule.eventType}:${stringValue}`;
  }

  private createAlert(rule: AlertRule, payload: Record<string, unknown>): Alert {
    const now = new Date().toISOString();

    const alert: Alert = {
      id: randomUUID(),
      severity: rule.severity,
      status: 'active',
      title: this.interpolateTemplate(rule.titleTemplate, payload),
      message: this.interpolateTemplate(rule.messageTemplate, payload),
      source: rule.eventType,
      details: payload,
      count: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    };

    const parsed = AlertSchema.safeParse(alert);
    if (!parsed.success) {
      this.eventBus.emit('audit:log', {
        action: 'alert_validation_failed',
        agent: 'alert_manager',
        trustLevel: 'system' as const,
        details: { error: parsed.error.message },
      });
      return alert;
    }

    return parsed.data;
  }

  private interpolateTemplate(template: string, payload: Record<string, unknown>): string {
    return template.replace(/{(\w+)}/g, (_, key: string) => {
      const value = payload[key];
      if (value === undefined || value === null) return `{${key}}`;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      return `{${key}}`;
    });
  }

  /**
   * Get all alerts, optionally filtered
   */
  getAlerts(filters?: {
    status?: AlertStatus;
    severity?: AlertSeverity;
    limit?: number;
    offset?: number;
  }): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (filters?.status) {
      alerts = alerts.filter((a) => a.status === filters.status);
    }
    if (filters?.severity) {
      alerts = alerts.filter((a) => a.severity === filters.severity);
    }

    // Sort by lastSeenAt descending
    alerts.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

    if (filters?.offset) {
      alerts = alerts.slice(filters.offset);
    }
    if (filters?.limit) {
      alerts = alerts.slice(0, filters.limit);
    }

    return alerts;
  }

  /**
   * Get alert summary
   */
  getSummary(): AlertSummary {
    const alerts = Array.from(this.alerts.values());

    return {
      total: alerts.length,
      active: alerts.filter((a) => a.status === 'active').length,
      acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
      resolved: alerts.filter((a) => a.status === 'resolved').length,
      bySeverity: {
        info: alerts.filter((a) => a.severity === 'info' && a.status !== 'resolved').length,
        warning: alerts.filter((a) => a.severity === 'warning' && a.status !== 'resolved').length,
        critical: alerts.filter((a) => a.severity === 'critical' && a.status !== 'resolved').length,
      },
    };
  }

  /**
   * Get a single alert by ID
   */
  getAlert(id: string): Alert | undefined {
    return this.alerts.get(id);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledge(id: string, acknowledgedBy = 'operator'): Promise<Alert | null> {
    const alert = this.alerts.get(id);
    if (!alert) return null;

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = acknowledgedBy;

    await this.save();

    this.eventBus.emit('alert:acknowledged' as keyof import('../kernel/event-bus.js').EventMap, alert as never);

    return alert;
  }

  /**
   * Resolve an alert
   */
  async resolve(id: string, resolvedBy = 'operator'): Promise<Alert | null> {
    const alert = this.alerts.get(id);
    if (!alert) return null;

    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedBy = resolvedBy;

    await this.save();

    this.eventBus.emit('alert:resolved' as keyof import('../kernel/event-bus.js').EventMap, alert as never);

    return alert;
  }

  /**
   * Delete an alert
   */
  async delete(id: string): Promise<boolean> {
    const deleted = this.alerts.delete(id);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }

  /**
   * Add a custom alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.push(rule);
    const unsubscribe = this.eventBus.on(
      rule.eventType as keyof import('../kernel/event-bus.js').EventMap,
      (payload) => {
        this.handleEvent(rule, payload as Record<string, unknown>);
      }
    );
    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Create a manual alert
   */
  async createManualAlert(
    severity: AlertSeverity,
    title: string,
    message: string,
    source = 'manual'
  ): Promise<Alert> {
    const now = new Date().toISOString();
    const alert: Alert = {
      id: randomUUID(),
      severity,
      status: 'active',
      title,
      message,
      source,
      count: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    };

    this.alerts.set(alert.id, alert);
    await this.save();

    this.eventBus.emit('alert:created' as keyof import('../kernel/event-bus.js').EventMap, alert as never);

    return alert;
  }

  /**
   * Stop the alert manager
   */
  stop(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
  }
}
