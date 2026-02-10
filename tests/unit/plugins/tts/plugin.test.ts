import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TtsPlugin } from '../../../../src/plugins/tts/index.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import type { PluginDependencies } from '../../../../src/plugins/types.js';

describe('TtsPlugin', () => {
  let plugin: TtsPlugin;
  let eventBus: EventBus;
  let tempDir: string;
  let deps: PluginDependencies;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ari-tts-plugin-'));
    eventBus = new EventBus();
    plugin = new TtsPlugin();
    deps = {
      eventBus,
      orchestrator: null as never,
      config: { apiKey: 'test-key' },
      dataDir: tempDir,
      costTracker: null,
    };
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('manifest', () => {
    it('should have correct id and capabilities', () => {
      expect(plugin.manifest.id).toBe('tts');
      expect(plugin.manifest.capabilities).toEqual(['data']);
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
    it('should report unhealthy without API key', async () => {
      const originalKey = process.env.ELEVENLABS_API_KEY;
      delete process.env.ELEVENLABS_API_KEY;

      await plugin.initialize(deps);
      const result = await plugin.healthCheck();
      expect(result.healthy).toBe(false);

      if (originalKey) process.env.ELEVENLABS_API_KEY = originalKey;
    });

    it('should report healthy with API key', async () => {
      process.env.ELEVENLABS_API_KEY = 'test-key';
      await plugin.initialize(deps);
      const result = await plugin.healthCheck();
      expect(result.healthy).toBe(true);
      delete process.env.ELEVENLABS_API_KEY;
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost', async () => {
      await plugin.initialize(deps);
      const cost = plugin.estimateCost('Hello world');
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(0.01);
    });
  });

  describe('daily budget tracking', () => {
    it('should track daily spend', async () => {
      await plugin.initialize(deps);
      expect(plugin.getDailySpend()).toBe(0);
      expect(plugin.getDailyCap()).toBe(2.00);
    });
  });
});
