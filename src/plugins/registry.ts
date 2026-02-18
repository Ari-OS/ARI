import path from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import type { EventBus } from '../kernel/event-bus.js';
import type { AIOrchestrator } from '../ai/orchestrator.js';
import type { CostTracker } from '../observability/cost-tracker.js';
import type {
  DomainPlugin,
  PluginStatus,
  PluginCapability,
  PluginDependencies,
  BriefingContribution,
  AlertContribution,
  ScheduledTaskDefinition,
  PluginInitiative,
} from './types.js';
import { PluginManifestSchema } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// PLUGIN REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

const PLUGINS_DATA_DIR = path.join(homedir(), '.ari', 'plugins');

/**
 * PluginRegistry — Central hub for domain plugin lifecycle management.
 *
 * Responsibilities:
 * - Plugin registration with manifest validation
 * - Dependency-ordered initialization
 * - Capability-based plugin queries
 * - Aggregation of briefings, alerts, tasks, and initiatives
 * - Health monitoring
 */
export class PluginRegistry {
  private readonly plugins: Map<string, DomainPlugin> = new Map();
  private readonly status: Map<string, PluginStatus> = new Map();
  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════

  // eslint-disable-next-line @typescript-eslint/require-await
  async register(plugin: DomainPlugin): Promise<void> {
    // Validate manifest
    PluginManifestSchema.parse(plugin.manifest);

    if (this.plugins.has(plugin.manifest.id)) {
      throw new Error(`Plugin already registered: ${plugin.manifest.id}`);
    }

    this.plugins.set(plugin.manifest.id, plugin);
    this.status.set(plugin.manifest.id, 'registered');

    this.eventBus.emit('plugin:registered', {
      pluginId: plugin.manifest.id,
      name: plugin.manifest.name,
      capabilities: plugin.manifest.capabilities,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize all registered plugins in dependency order.
   */
  async initializeAll(deps: {
    eventBus: EventBus;
    orchestrator: AIOrchestrator;
    costTracker: CostTracker | null;
    notionInbox?: unknown;
    ragQuery?: (question: string) => Promise<{ answer: string; sources: Array<{ title?: string; snippet: string; score: number }> } | null>;
  }): Promise<void> {
    const initOrder = this.resolveDependencyOrder();

    for (const pluginId of initOrder) {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) continue;

      const pluginStatus = this.status.get(pluginId);
      if (pluginStatus !== 'registered' && pluginStatus !== 'error') continue;

      this.status.set(pluginId, 'initializing');
      const startTime = Date.now();

      try {
        const dataDir = path.join(PLUGINS_DATA_DIR, pluginId, 'data');
        if (!existsSync(dataDir)) {
          mkdirSync(dataDir, { recursive: true });
        }

        const pluginDeps: PluginDependencies = {
          eventBus: deps.eventBus,
          orchestrator: deps.orchestrator,
          config: this.loadPluginConfig(pluginId),
          dataDir,
          costTracker: deps.costTracker,
          registry: this,
          notionInbox: deps.notionInbox,
          ragQuery: deps.ragQuery,
        };

        await plugin.initialize(pluginDeps);
        this.status.set(pluginId, 'active');

        const durationMs = Date.now() - startTime;
        this.eventBus.emit('plugin:initialized', {
          pluginId,
          durationMs,
        });
      } catch (error) {
        this.status.set(pluginId, 'error');
        this.eventBus.emit('plugin:error', {
          pluginId,
          error: error instanceof Error ? error.message : String(error),
          fatal: false,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHUTDOWN
  // ═══════════════════════════════════════════════════════════════════════════

  async shutdownAll(): Promise<void> {
    for (const [id, plugin] of this.plugins) {
      try {
        await plugin.shutdown();
        this.status.set(id, 'shutdown');
        this.eventBus.emit('plugin:shutdown', { pluginId: id });
      } catch {
        // Best-effort shutdown
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  getPlugin<T extends DomainPlugin>(id: string): T | undefined {
    return this.plugins.get(id) as T | undefined;
  }

  getActivePlugins(): DomainPlugin[] {
    return Array.from(this.plugins.entries())
      .filter(([id]) => this.status.get(id) === 'active')
      .map(([, plugin]) => plugin);
  }

  getPluginsByCapability(capability: PluginCapability): DomainPlugin[] {
    return this.getActivePlugins()
      .filter(p => p.manifest.capabilities.includes(capability));
  }

  getPluginStatus(id: string): PluginStatus | undefined {
    return this.status.get(id);
  }

  listPlugins(): Array<{ id: string; name: string; status: PluginStatus; capabilities: string[] }> {
    return Array.from(this.plugins.entries()).map(([id, plugin]) => ({
      id,
      name: plugin.manifest.name,
      status: this.status.get(id) ?? 'registered',
      capabilities: plugin.manifest.capabilities,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AGGREGATION (called by bridge files)
  // ═══════════════════════════════════════════════════════════════════════════

  async collectBriefings(type: 'morning' | 'evening' | 'weekly'): Promise<BriefingContribution[]> {
    const contributions: BriefingContribution[] = [];
    const briefingPlugins = this.getPluginsByCapability('briefing');

    for (const plugin of briefingPlugins) {
      if (!plugin.contributeToBriefing) continue;

      try {
        const contribution = await plugin.contributeToBriefing(type);
        if (contribution) {
          contributions.push(contribution);
          this.eventBus.emit('plugin:briefing_contributed', {
            pluginId: plugin.manifest.id,
            section: contribution.section,
            type,
          });
        }
      } catch {
        // Skip failed contributions
      }
    }

    return contributions.sort((a, b) => b.priority - a.priority);
  }

  async collectAlerts(): Promise<AlertContribution[]> {
    const alerts: AlertContribution[] = [];
    const alertingPlugins = this.getPluginsByCapability('alerting');

    for (const plugin of alertingPlugins) {
      if (!plugin.checkAlerts) continue;

      try {
        const pluginAlerts = await plugin.checkAlerts();
        for (const alert of pluginAlerts) {
          alerts.push(alert);
          this.eventBus.emit('plugin:alert_generated', {
            pluginId: plugin.manifest.id,
            severity: alert.severity,
            title: alert.title,
          });
        }
      } catch {
        // Skip failed alert checks
      }
    }

    return alerts;
  }

  async collectInitiatives(): Promise<PluginInitiative[]> {
    const initiatives: PluginInitiative[] = [];
    const initiativePlugins = this.getPluginsByCapability('initiative');

    for (const plugin of initiativePlugins) {
      if (!plugin.discoverInitiatives) continue;

      try {
        const pluginInitiatives = await plugin.discoverInitiatives();
        initiatives.push(...pluginInitiatives);
      } catch {
        // Skip failed initiative discovery
      }
    }

    return initiatives.sort((a, b) => b.priority - a.priority);
  }

  collectScheduledTasks(): ScheduledTaskDefinition[] {
    const tasks: ScheduledTaskDefinition[] = [];
    const schedulingPlugins = this.getPluginsByCapability('scheduling');

    for (const plugin of schedulingPlugins) {
      if (!plugin.getScheduledTasks) continue;

      try {
        tasks.push(...plugin.getScheduledTasks());
      } catch {
        // Skip failed task collection
      }
    }

    return tasks;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH
  // ═══════════════════════════════════════════════════════════════════════════

  async healthCheckAll(): Promise<Map<string, { healthy: boolean; details?: string }>> {
    const results = new Map<string, { healthy: boolean; details?: string }>();

    for (const [id, plugin] of this.plugins) {
      if (this.status.get(id) !== 'active') {
        results.set(id, { healthy: false, details: `Status: ${this.status.get(id)}` });
        continue;
      }

      try {
        const result = await plugin.healthCheck();
        results.set(id, result);

        this.eventBus.emit('plugin:health_changed', {
          pluginId: id,
          healthy: result.healthy,
          details: result.details,
        });
      } catch (error) {
        results.set(id, {
          healthy: false,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENABLE / DISABLE
  // ═══════════════════════════════════════════════════════════════════════════

  async disablePlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Plugin not found: ${id}`);

    if (this.status.get(id) === 'active') {
      await plugin.shutdown();
    }
    this.status.set(id, 'disabled');
  }

  async enablePlugin(
    id: string,
    deps: {
      eventBus: EventBus;
      orchestrator: AIOrchestrator;
      costTracker: CostTracker | null;
      notionInbox?: unknown;
    },
  ): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Plugin not found: ${id}`);

    const dataDir = path.join(PLUGINS_DATA_DIR, id, 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.status.set(id, 'initializing');
    try {
      await plugin.initialize({
        eventBus: deps.eventBus,
        orchestrator: deps.orchestrator,
        config: this.loadPluginConfig(id),
        dataDir,
        costTracker: deps.costTracker,
        registry: this,
        notionInbox: deps.notionInbox,
      });
      this.status.set(id, 'active');
    } catch (error) {
      this.status.set(id, 'error');
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve initialization order based on dependencies.
   * Topological sort — dependencies initialize before dependents.
   */
  private resolveDependencyOrder(): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Circular plugin dependency detected involving: ${id}`);
      }

      visiting.add(id);

      const plugin = this.plugins.get(id);
      if (plugin) {
        for (const dep of plugin.manifest.dependencies ?? []) {
          if (this.plugins.has(dep)) {
            visit(dep);
          }
        }
      }

      visiting.delete(id);
      visited.add(id);
      order.push(id);
    };

    for (const id of this.plugins.keys()) {
      visit(id);
    }

    return order;
  }

  private loadPluginConfig(pluginId: string): Record<string, unknown> {
    try {
      const configPath = path.join(PLUGINS_DATA_DIR, pluginId, 'config.json');
      if (existsSync(configPath)) {
        const raw = readFileSync(configPath, 'utf8');
        return JSON.parse(raw) as Record<string, unknown>;
      }
    } catch {
      // No config file — return empty
    }
    return {};
  }
}
