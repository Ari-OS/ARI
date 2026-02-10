import type { PluginRegistry } from './registry.js';
import type { ScheduledTaskDefinition } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER BRIDGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SchedulerBridge — Connects plugin scheduled tasks to the autonomous scheduler.
 *
 * Connects to: autonomous/scheduler.ts → addTask()
 * Each plugin with 'scheduling' capability registers cron tasks.
 */
export class SchedulerBridge {
  private readonly pluginRegistry: PluginRegistry;

  constructor(pluginRegistry: PluginRegistry) {
    this.pluginRegistry = pluginRegistry;
  }

  /**
   * Collect all scheduled tasks from active plugins.
   */
  collectTasks(): ScheduledTaskDefinition[] {
    return this.pluginRegistry.collectScheduledTasks();
  }

  /**
   * Get only essential tasks (run even in budget-reduce mode).
   */
  collectEssentialTasks(): ScheduledTaskDefinition[] {
    return this.collectTasks().filter(t => t.essential);
  }
}
