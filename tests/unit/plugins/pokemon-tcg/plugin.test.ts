import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PokemonTcgPlugin } from '../../../../src/plugins/pokemon-tcg/index.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import type { PluginDependencies } from '../../../../src/plugins/types.js';

describe('PokemonTcgPlugin', () => {
  let plugin: PokemonTcgPlugin;
  let eventBus: EventBus;
  let tempDir: string;
  let deps: PluginDependencies;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ari-pokemon-plugin-'));
    eventBus = new EventBus();
    plugin = new PokemonTcgPlugin();
    deps = {
      eventBus,
      orchestrator: null as never,
      config: {},
      dataDir: tempDir,
      costTracker: null,
    };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('manifest', () => {
    it('should have correct id and capabilities', () => {
      expect(plugin.manifest.id).toBe('pokemon-tcg');
      expect(plugin.manifest.capabilities).toContain('briefing');
      expect(plugin.manifest.capabilities).toContain('scheduling');
      expect(plugin.manifest.capabilities).toContain('alerting');
      expect(plugin.manifest.capabilities).toContain('cli');
      expect(plugin.manifest.capabilities).toContain('data');
    });
  });

  describe('lifecycle', () => {
    it('should initialize and become active', async () => {
      expect(plugin.getStatus()).toBe('registered');
      await plugin.initialize(deps);
      expect(plugin.getStatus()).toBe('active');
    });

    it('should shutdown cleanly', async () => {
      await plugin.initialize(deps);
      await plugin.shutdown();
      expect(plugin.getStatus()).toBe('shutdown');
    });
  });

  describe('contributeToBriefing', () => {
    it('should return null when no collection entries', async () => {
      await plugin.initialize(deps);
      const result = await plugin.contributeToBriefing('morning');
      expect(result).toBeNull();
    });

    it('should return null for weekly briefings', async () => {
      await plugin.initialize(deps);
      const result = await plugin.contributeToBriefing('weekly');
      expect(result).toBeNull();
    });
  });

  describe('getScheduledTasks', () => {
    it('should return 3 scheduled tasks', async () => {
      await plugin.initialize(deps);
      const tasks = plugin.getScheduledTasks();
      expect(tasks).toHaveLength(3);
      expect(tasks.map(t => t.id)).toContain('pokemon:market-scan-morning');
      expect(tasks.map(t => t.id)).toContain('pokemon:market-scan-evening');
      expect(tasks.map(t => t.id)).toContain('pokemon:weekly-snapshot');
    });
  });

  describe('checkAlerts', () => {
    it('should return empty when no alerts', async () => {
      await plugin.initialize(deps);
      const alerts = await plugin.checkAlerts();
      expect(alerts).toHaveLength(0);
    });
  });

  describe('discoverInitiatives', () => {
    it('should return empty when no entries', async () => {
      await plugin.initialize(deps);
      const initiatives = await plugin.discoverInitiatives();
      expect(initiatives).toHaveLength(0);
    });
  });

  describe('public API', () => {
    it('should expose client and collection after init', async () => {
      await plugin.initialize(deps);
      expect(plugin.getClient()).toBeDefined();
      expect(plugin.getCollection()).toBeDefined();
      expect(plugin.getConfig()).toBeDefined();
    });
  });
});
