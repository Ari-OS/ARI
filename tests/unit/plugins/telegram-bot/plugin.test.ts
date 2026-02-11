import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TelegramBotPlugin } from '../../../../src/plugins/telegram-bot/index.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import type { PluginDependencies } from '../../../../src/plugins/types.js';

describe('TelegramBotPlugin', () => {
  let plugin: TelegramBotPlugin;
  let eventBus: EventBus;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ari-telegram-plugin-'));
    eventBus = new EventBus();
    plugin = new TelegramBotPlugin();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('manifest', () => {
    it('should have correct id and capabilities', () => {
      expect(plugin.manifest.id).toBe('telegram-bot');
      expect(plugin.manifest.capabilities).toContain('cli');
      expect(plugin.manifest.capabilities).toContain('api');
      expect(plugin.manifest.dependencies).toHaveLength(0);
    });
  });

  describe('lifecycle', () => {
    it('should start as registered', () => {
      expect(plugin.getStatus()).toBe('registered');
    });

    it('should set error status when no token', async () => {
      const originalToken = process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;

      try {
        const deps: PluginDependencies = {
          eventBus,
          orchestrator: null as never,
          config: { botToken: undefined },
          dataDir: tempDir,
          costTracker: null,
        };

        await plugin.initialize(deps);
        expect(plugin.getStatus()).toBe('error');
      } finally {
        if (originalToken) process.env.TELEGRAM_BOT_TOKEN = originalToken;
      }
    });

    it('should shutdown cleanly without init', async () => {
      await plugin.shutdown();
      expect(plugin.getStatus()).toBe('shutdown');
    });
  });

  describe('healthCheck', () => {
    it('should report unhealthy when bot not initialized', async () => {
      const result = await plugin.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.details).toContain('not initialized');
    });
  });
});
