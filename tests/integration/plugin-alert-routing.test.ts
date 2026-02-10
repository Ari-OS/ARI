import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EventBus } from '../../src/kernel/event-bus.js';
import { PluginRegistry } from '../../src/plugins/registry.js';
import { CryptoPlugin } from '../../src/plugins/crypto/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION: Plugin Alert Routing
// ═══════════════════════════════════════════════════════════════════════════════

describe('Plugin Alert Routing (Integration)', () => {
  let eventBus: EventBus;
  let registry: PluginRegistry;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ari-alerts-'));
    eventBus = new EventBus();
    registry = new PluginRegistry(eventBus);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should collect alerts from plugins with alerting capability', async () => {
    const crypto = new CryptoPlugin();
    await registry.register(crypto);

    await registry.initializeAll({
      eventBus,
      orchestrator: null as never,
      costTracker: null,
    });

    // No alerts set = empty
    const alerts = await registry.collectAlerts();
    expect(alerts).toHaveLength(0);
  });

  it('should trigger crypto alert when price crosses threshold', async () => {
    const crypto = new CryptoPlugin();
    await registry.register(crypto);

    await registry.initializeAll({
      eventBus,
      orchestrator: null as never,
      costTracker: null,
    });

    // Set up a price alert
    crypto.getPortfolio().addAlert('bitcoin', 'above', 55000);

    // Mock price that crosses threshold
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        bitcoin: { usd: 56000, usd_24h_change: 5 },
      }),
    } as Response);

    const alerts = await registry.collectAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toContain('bitcoin');
    expect(alerts[0].title).toContain('above');
    expect(alerts[0].severity).toBe('warning');
  });

  it('should emit plugin:alert_generated events', async () => {
    const alertEvents: unknown[] = [];
    eventBus.on('plugin:alert_generated', (e) => alertEvents.push(e));

    const crypto = new CryptoPlugin();
    await registry.register(crypto);

    await registry.initializeAll({
      eventBus,
      orchestrator: null as never,
      costTracker: null,
    });

    crypto.getPortfolio().addAlert('bitcoin', 'below', 45000);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        bitcoin: { usd: 44000, usd_24h_change: -3 },
      }),
    } as Response);

    await registry.collectAlerts();
    expect(alertEvents).toHaveLength(1);
  });

  it('should emit crypto:alert_triggered events', async () => {
    const cryptoAlertEvents: unknown[] = [];
    eventBus.on('crypto:alert_triggered', (e) => cryptoAlertEvents.push(e));

    const crypto = new CryptoPlugin();
    await registry.register(crypto);

    await registry.initializeAll({
      eventBus,
      orchestrator: null as never,
      costTracker: null,
    });

    crypto.getPortfolio().addAlert('ethereum', 'above', 3500);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ethereum: { usd: 4000, usd_24h_change: 10 },
      }),
    } as Response);

    await registry.collectAlerts();
    expect(cryptoAlertEvents).toHaveLength(1);
    expect((cryptoAlertEvents[0] as Record<string, unknown>).coinId).toBe('ethereum');
  });

  it('should not trigger already-triggered alerts', async () => {
    const crypto = new CryptoPlugin();
    await registry.register(crypto);

    await registry.initializeAll({
      eventBus,
      orchestrator: null as never,
      costTracker: null,
    });

    crypto.getPortfolio().addAlert('bitcoin', 'above', 50000);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        bitcoin: { usd: 51000 },
      }),
    } as Response);

    // First check triggers
    const firstAlerts = await registry.collectAlerts();
    expect(firstAlerts).toHaveLength(1);

    // Second check — already triggered
    const secondAlerts = await registry.collectAlerts();
    expect(secondAlerts).toHaveLength(0);
  });

  it('should handle health checks across plugins', async () => {
    const crypto = new CryptoPlugin();
    await registry.register(crypto);

    await registry.initializeAll({
      eventBus,
      orchestrator: null as never,
      costTracker: null,
    });

    // Mock healthy API
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ bitcoin: { usd: 50000 } }),
    } as Response);

    const health = await registry.healthCheckAll();
    expect(health.get('crypto')?.healthy).toBe(true);
  });
});
