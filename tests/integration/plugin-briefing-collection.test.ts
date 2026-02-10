import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EventBus } from '../../src/kernel/event-bus.js';
import { PluginRegistry } from '../../src/plugins/registry.js';
import { CryptoPlugin } from '../../src/plugins/crypto/index.js';
import { PokemonTcgPlugin } from '../../src/plugins/pokemon-tcg/index.js';
import { TtsPlugin } from '../../src/plugins/tts/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION: Plugin Briefing & Collection
// ═══════════════════════════════════════════════════════════════════════════════

describe('Plugin Briefing Collection (Integration)', () => {
  let eventBus: EventBus;
  let registry: PluginRegistry;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ari-integration-'));
    eventBus = new EventBus();
    registry = new PluginRegistry(eventBus);

    vi.restoreAllMocks();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should register and initialize multiple plugins', async () => {
    const crypto = new CryptoPlugin();
    const pokemon = new PokemonTcgPlugin();
    const tts = new TtsPlugin();

    await registry.register(crypto);
    await registry.register(pokemon);
    await registry.register(tts);

    expect(registry.listPlugins()).toHaveLength(3);
    expect(registry.listPlugins().map(p => p.id)).toContain('crypto');
    expect(registry.listPlugins().map(p => p.id)).toContain('pokemon-tcg');
    expect(registry.listPlugins().map(p => p.id)).toContain('tts');
  });

  it('should initialize all plugins via initializeAll', async () => {
    const crypto = new CryptoPlugin();
    const pokemon = new PokemonTcgPlugin();
    const tts = new TtsPlugin();

    await registry.register(crypto);
    await registry.register(pokemon);
    await registry.register(tts);

    await registry.initializeAll({
      eventBus,
      orchestrator: null as never,
      costTracker: null,
    });

    expect(crypto.getStatus()).toBe('active');
    expect(pokemon.getStatus()).toBe('active');
    expect(tts.getStatus()).toBe('active');
  });

  it('should collect briefings from all briefing-capable plugins', async () => {
    const crypto = new CryptoPlugin();
    const pokemon = new PokemonTcgPlugin();

    await registry.register(crypto);
    await registry.register(pokemon);

    await registry.initializeAll({
      eventBus,
      orchestrator: null as never,
      costTracker: null,
    });

    // Mock CoinGecko API for crypto briefing
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        bitcoin: { usd: 50000, usd_24h_change: 2.5 },
        ethereum: { usd: 3000, usd_24h_change: -1.2 },
        solana: { usd: 100, usd_24h_change: 5 },
      }),
    } as Response);

    const briefings = await registry.collectBriefings('morning');

    // Should have at least crypto briefing (pokemon has no entries so returns null)
    expect(briefings.length).toBeGreaterThanOrEqual(1);
    const cryptoBriefing = briefings.find(b => b.pluginId === 'crypto');
    expect(cryptoBriefing).toBeDefined();
    expect(cryptoBriefing?.section).toBe('Crypto Prices');
  });

  it('should query plugins by capability', async () => {
    const crypto = new CryptoPlugin();
    const pokemon = new PokemonTcgPlugin();
    const tts = new TtsPlugin();

    await registry.register(crypto);
    await registry.register(pokemon);
    await registry.register(tts);

    await registry.initializeAll({
      eventBus,
      orchestrator: null as never,
      costTracker: null,
    });

    const briefingPlugins = registry.getPluginsByCapability('briefing');
    expect(briefingPlugins).toHaveLength(2); // crypto + pokemon

    const dataPlugins = registry.getPluginsByCapability('data');
    expect(dataPlugins).toHaveLength(3); // crypto + pokemon + tts

    const schedulingPlugins = registry.getPluginsByCapability('scheduling');
    expect(schedulingPlugins).toHaveLength(2); // crypto + pokemon
  });

  it('should collect scheduled tasks from all plugins', async () => {
    const crypto = new CryptoPlugin();
    const pokemon = new PokemonTcgPlugin();

    await registry.register(crypto);
    await registry.register(pokemon);

    await registry.initializeAll({
      eventBus,
      orchestrator: null as never,
      costTracker: null,
    });

    const tasks = registry.collectScheduledTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(5); // 2 crypto + 3 pokemon
    expect(tasks.some(t => t.id.startsWith('crypto:'))).toBe(true);
    expect(tasks.some(t => t.id.startsWith('pokemon:'))).toBe(true);
  });

  it('should pass registry to plugins for inter-plugin communication', async () => {
    const crypto = new CryptoPlugin();
    const tts = new TtsPlugin();

    await registry.register(crypto);
    await registry.register(tts);

    await registry.initializeAll({
      eventBus,
      orchestrator: null as never,
      costTracker: null,
    });

    // After initializeAll, plugins should be retrievable
    const retrievedCrypto = registry.getPlugin<CryptoPlugin>('crypto');
    expect(retrievedCrypto).toBeDefined();
    expect(retrievedCrypto?.getStatus()).toBe('active');
  });

  it('should handle plugin shutdown', async () => {
    const crypto = new CryptoPlugin();
    await registry.register(crypto);

    await registry.initializeAll({
      eventBus,
      orchestrator: null as never,
      costTracker: null,
    });

    expect(crypto.getStatus()).toBe('active');

    await registry.shutdownAll();
    expect(crypto.getStatus()).toBe('shutdown');
  });
});
