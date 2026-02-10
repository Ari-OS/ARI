import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { PluginRegistry } from '../../../src/plugins/registry.js';
import type {
  DomainPlugin,
  PluginManifest,
  PluginDependencies,
  PluginStatus,
  BriefingContribution,
  AlertContribution,
  ScheduledTaskDefinition,
  PluginInitiative,
} from '../../../src/plugins/types.js';

function createMockPlugin(overrides: Partial<{
  id: string;
  name: string;
  capabilities: string[];
  dependencies: string[];
  initError: boolean;
  briefing: BriefingContribution | null;
  alerts: AlertContribution[];
  tasks: ScheduledTaskDefinition[];
  initiatives: PluginInitiative[];
}> = {}): DomainPlugin {
  const id = overrides.id ?? 'test-plugin';
  let status: PluginStatus = 'registered';

  return {
    manifest: {
      id,
      name: overrides.name ?? 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'Test',
      capabilities: (overrides.capabilities ?? ['briefing']) as PluginManifest['capabilities'],
      dependencies: overrides.dependencies ?? [],
    },
    initialize: vi.fn().mockImplementation(async () => {
      if (overrides.initError) throw new Error('Init failed');
      status = 'active';
    }),
    shutdown: vi.fn().mockImplementation(async () => {
      status = 'shutdown';
    }),
    getStatus: vi.fn().mockImplementation(() => status),
    healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
    contributeToBriefing: overrides.briefing !== undefined
      ? vi.fn().mockResolvedValue(overrides.briefing)
      : undefined,
    checkAlerts: overrides.alerts
      ? vi.fn().mockResolvedValue(overrides.alerts)
      : undefined,
    getScheduledTasks: overrides.tasks
      ? vi.fn().mockReturnValue(overrides.tasks)
      : undefined,
    discoverInitiatives: overrides.initiatives
      ? vi.fn().mockResolvedValue(overrides.initiatives)
      : undefined,
  };
}

describe('PluginRegistry', () => {
  let eventBus: EventBus;
  let registry: PluginRegistry;

  beforeEach(() => {
    eventBus = new EventBus();
    registry = new PluginRegistry(eventBus);
  });

  describe('register', () => {
    it('should register a plugin and emit event', async () => {
      const spy = vi.fn();
      eventBus.on('plugin:registered', spy);

      const plugin = createMockPlugin();
      await registry.register(plugin);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'test-plugin',
          name: 'Test Plugin',
        }),
      );
    });

    it('should reject duplicate plugin IDs', async () => {
      const plugin = createMockPlugin();
      await registry.register(plugin);

      await expect(registry.register(plugin)).rejects.toThrow('already registered');
    });

    it('should validate manifest', async () => {
      const plugin = createMockPlugin({ id: 'INVALID ID' });
      await expect(registry.register(plugin)).rejects.toThrow();
    });
  });

  describe('listPlugins', () => {
    it('should list all registered plugins', async () => {
      await registry.register(createMockPlugin({ id: 'plugin-a', name: 'Plugin A' }));
      await registry.register(createMockPlugin({ id: 'plugin-b', name: 'Plugin B' }));

      const list = registry.listPlugins();
      expect(list).toHaveLength(2);
      expect(list.map(p => p.id)).toContain('plugin-a');
      expect(list.map(p => p.id)).toContain('plugin-b');
    });

    it('should show registered status before initialization', async () => {
      await registry.register(createMockPlugin());

      const list = registry.listPlugins();
      expect(list[0].status).toBe('registered');
    });
  });

  describe('getPluginsByCapability', () => {
    it('should filter by capability', async () => {
      await registry.register(createMockPlugin({
        id: 'briefing-plugin',
        capabilities: ['briefing'],
      }));
      await registry.register(createMockPlugin({
        id: 'alert-plugin',
        capabilities: ['alerting'],
      }));

      // Need to initialize to make them active
      const mockOrchestrator = {} as never;
      await registry.initializeAll({
        eventBus,
        orchestrator: mockOrchestrator,
        costTracker: null,
      });

      const briefingPlugins = registry.getPluginsByCapability('briefing');
      expect(briefingPlugins).toHaveLength(1);
      expect(briefingPlugins[0].manifest.id).toBe('briefing-plugin');
    });
  });

  describe('collectBriefings', () => {
    it('should collect contributions from briefing plugins', async () => {
      const contribution: BriefingContribution = {
        pluginId: 'crypto',
        section: 'Crypto Portfolio',
        content: 'BTC: $50,000',
        priority: 80,
        category: 'info',
      };

      await registry.register(createMockPlugin({
        id: 'crypto',
        capabilities: ['briefing'],
        briefing: contribution,
      }));

      const mockOrchestrator = {} as never;
      await registry.initializeAll({
        eventBus,
        orchestrator: mockOrchestrator,
        costTracker: null,
      });

      const briefings = await registry.collectBriefings('morning');
      expect(briefings).toHaveLength(1);
      expect(briefings[0].section).toBe('Crypto Portfolio');
    });

    it('should sort by priority', async () => {
      await registry.register(createMockPlugin({
        id: 'low-priority',
        capabilities: ['briefing'],
        briefing: {
          pluginId: 'low-priority',
          section: 'Low',
          content: 'low priority',
          priority: 10,
          category: 'info',
        },
      }));
      await registry.register(createMockPlugin({
        id: 'high-priority',
        capabilities: ['briefing'],
        briefing: {
          pluginId: 'high-priority',
          section: 'High',
          content: 'high priority',
          priority: 90,
          category: 'alert',
        },
      }));

      const mockOrchestrator = {} as never;
      await registry.initializeAll({
        eventBus,
        orchestrator: mockOrchestrator,
        costTracker: null,
      });

      const briefings = await registry.collectBriefings('morning');
      expect(briefings[0].pluginId).toBe('high-priority');
    });
  });

  describe('shutdown', () => {
    it('should shutdown all plugins', async () => {
      const plugin = createMockPlugin();
      await registry.register(plugin);

      const mockOrchestrator = {} as never;
      await registry.initializeAll({
        eventBus,
        orchestrator: mockOrchestrator,
        costTracker: null,
      });

      const shutdownSpy = vi.fn();
      eventBus.on('plugin:shutdown', shutdownSpy);

      await registry.shutdownAll();

      expect(plugin.shutdown).toHaveBeenCalled();
      expect(shutdownSpy).toHaveBeenCalledWith(
        expect.objectContaining({ pluginId: 'test-plugin' }),
      );
    });
  });

  describe('healthCheckAll', () => {
    it('should check health of active plugins', async () => {
      await registry.register(createMockPlugin());

      const mockOrchestrator = {} as never;
      await registry.initializeAll({
        eventBus,
        orchestrator: mockOrchestrator,
        costTracker: null,
      });

      const results = await registry.healthCheckAll();
      expect(results.get('test-plugin')?.healthy).toBe(true);
    });
  });

  describe('dependency resolution', () => {
    it('should initialize dependencies before dependents', async () => {
      const initOrder: string[] = [];

      const depPlugin = createMockPlugin({ id: 'dep-plugin' });
      (depPlugin.initialize as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        initOrder.push('dep-plugin');
      });

      const mainPlugin = createMockPlugin({
        id: 'main-plugin',
        dependencies: ['dep-plugin'],
      });
      (mainPlugin.initialize as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        initOrder.push('main-plugin');
      });

      // Register in reverse order to test sorting
      await registry.register(mainPlugin);
      await registry.register(depPlugin);

      const mockOrchestrator = {} as never;
      await registry.initializeAll({
        eventBus,
        orchestrator: mockOrchestrator,
        costTracker: null,
      });

      expect(initOrder).toEqual(['dep-plugin', 'main-plugin']);
    });
  });
});
