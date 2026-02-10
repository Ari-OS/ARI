import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CryptoPlugin } from '../../../../src/plugins/crypto/index.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import type { PluginDependencies } from '../../../../src/plugins/types.js';

describe('CryptoPlugin', () => {
  let plugin: CryptoPlugin;
  let eventBus: EventBus;
  let tempDir: string;
  let deps: PluginDependencies;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ari-crypto-plugin-'));
    eventBus = new EventBus();
    plugin = new CryptoPlugin();
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
      expect(plugin.manifest.id).toBe('crypto');
      expect(plugin.manifest.capabilities).toContain('briefing');
      expect(plugin.manifest.capabilities).toContain('scheduling');
      expect(plugin.manifest.capabilities).toContain('alerting');
      expect(plugin.manifest.capabilities).toContain('cli');
      expect(plugin.manifest.capabilities).toContain('data');
    });
  });

  describe('lifecycle', () => {
    it('should initialize successfully', async () => {
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

  describe('healthCheck', () => {
    it('should report healthy when API is reachable', async () => {
      await plugin.initialize(deps);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } }),
      } as Response);

      const result = await plugin.healthCheck();
      expect(result.healthy).toBe(true);
    });

    it('should report unhealthy when API fails', async () => {
      await plugin.initialize(deps);

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Timeout'));

      const result = await plugin.healthCheck();
      expect(result.healthy).toBe(false);
    });
  });

  describe('contributeToBriefing', () => {
    it('should return default coin prices when no holdings', async () => {
      await plugin.initialize(deps);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bitcoin: { usd: 50000, usd_24h_change: 2.5 },
          ethereum: { usd: 3000, usd_24h_change: -1.2 },
          solana: { usd: 100, usd_24h_change: 5 },
        }),
      } as Response);

      const contribution = await plugin.contributeToBriefing('morning');
      expect(contribution).not.toBeNull();
      expect(contribution!.section).toBe('Crypto Prices');
      expect(contribution!.content).toContain('bitcoin');
    });

    it('should return null for weekly briefings', async () => {
      await plugin.initialize(deps);
      const result = await plugin.contributeToBriefing('weekly');
      expect(result).toBeNull();
    });
  });

  describe('getScheduledTasks', () => {
    it('should return price check and snapshot tasks', async () => {
      await plugin.initialize(deps);
      const tasks = plugin.getScheduledTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('crypto:price-check');
      expect(tasks[1].id).toBe('crypto:daily-snapshot');
    });
  });

  describe('checkAlerts', () => {
    it('should return empty array when no alerts set', async () => {
      await plugin.initialize(deps);
      const alerts = await plugin.checkAlerts();
      expect(alerts).toHaveLength(0);
    });
  });

  describe('public API', () => {
    it('should expose client and portfolio after init', async () => {
      await plugin.initialize(deps);
      expect(plugin.getClient()).toBeDefined();
      expect(plugin.getPortfolio()).toBeDefined();
      expect(plugin.getConfig()).toBeDefined();
    });
  });
});
