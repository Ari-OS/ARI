import type { EventBus } from '../kernel/event-bus.js';
import type { PluginRegistry } from './registry.js';
import type { AlertContribution } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT BRIDGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AlertBridge — Routes plugin alerts to the notification system.
 *
 * Connects to: autonomous/notification-manager.ts
 * Each plugin with 'alerting' capability can generate alerts.
 */
export class AlertBridge {
  private readonly pluginRegistry: PluginRegistry;
  private readonly eventBus: EventBus;

  constructor(pluginRegistry: PluginRegistry, eventBus: EventBus) {
    this.pluginRegistry = pluginRegistry;
    this.eventBus = eventBus;
  }

  /**
   * Check all plugins for alerts and emit them to the notification system.
   */
  async checkAndRoute(): Promise<AlertContribution[]> {
    const alerts = await this.pluginRegistry.collectAlerts();

    for (const alert of alerts) {
      this.eventBus.emit('alert:created', {
        id: `plugin:${alert.pluginId}:${Date.now()}`,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        source: `plugin:${alert.pluginId}`,
      });
    }

    return alerts;
  }
}
