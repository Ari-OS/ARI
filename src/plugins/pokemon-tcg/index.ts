import type { EventBus } from '../../kernel/event-bus.js';
import type {
  DomainPlugin,
  PluginManifest,
  PluginStatus,
  PluginDependencies,
  BriefingContribution,
  ScheduledTaskDefinition,
  AlertContribution,
  PluginInitiative,
} from '../types.js';
import { PokemonTcgClient } from './api-client.js';
import { CollectionManager } from './collection.js';
import { PokemonTcgConfigSchema } from './types.js';
import type { PokemonTcgConfig } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// POKEMON TCG PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════

export class PokemonTcgPlugin implements DomainPlugin {
  readonly manifest: PluginManifest = {
    id: 'pokemon-tcg',
    name: 'Pokemon TCG',
    version: '1.0.0',
    description: 'Pokemon TCG card tracking, collection management, and price alerts',
    author: 'ARI',
    capabilities: ['briefing', 'scheduling', 'alerting', 'cli', 'data'],
    dependencies: [],
  };

  private status: PluginStatus = 'registered';
  private eventBus!: EventBus;
  private client!: PokemonTcgClient;
  private collection!: CollectionManager;
  private config!: PokemonTcgConfig;

  // ── Lifecycle ──────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize(deps: PluginDependencies): Promise<void> {
    this.eventBus = deps.eventBus;
    this.config = PokemonTcgConfigSchema.parse(deps.config);
    this.client = new PokemonTcgClient(this.config.apiKey);
    this.collection = new CollectionManager(deps.dataDir);
    this.status = 'active';
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async shutdown(): Promise<void> {
    this.client?.clearCache();
    this.status = 'shutdown';
  }

  getStatus(): PluginStatus {
    return this.status;
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
    try {
      await this.client.searchCards('name:pikachu', 1);
      return { healthy: true, details: 'Pokemon TCG API reachable' };
    } catch (error) {
      return {
        healthy: false,
        details: `Pokemon TCG API error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ── Integration Hooks ──────────────────────────────────────────────

  async contributeToBriefing(type: 'morning' | 'evening' | 'weekly'): Promise<BriefingContribution | null> {
    if (type !== 'morning' && type !== 'evening') return null;

    const entries = this.collection.getEntries();
    if (entries.length === 0) return null;

    try {
      const cardPrices = await this.fetchCollectionPrices();
      const value = this.collection.calculateCollectionValue(cardPrices);

      const topMovers = value.entries
        .filter(e => e.marketPrice > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

      const content = [
        `Collection: ${value.entries.length} cards, $${value.totalValue.toFixed(2)} total`,
        ...topMovers.map(e => `  ${e.name}: $${e.marketPrice.toFixed(2)} x${e.quantity}`),
      ].join('\n');

      return {
        pluginId: this.manifest.id,
        section: 'Pokemon TCG Collection',
        content,
        priority: 40,
        category: 'info',
      };
    } catch {
      return null;
    }
  }

  getScheduledTasks(): ScheduledTaskDefinition[] {
    return [
      {
        id: 'pokemon:market-scan-morning',
        name: 'Pokemon TCG Morning Market Scan',
        cron: `0 ${this.config.morningScanHour} * * *`,
        essential: false,
        handler: async () => {
          await this.runMarketScan();
        },
      },
      {
        id: 'pokemon:market-scan-evening',
        name: 'Pokemon TCG Evening Market Scan',
        cron: `0 ${this.config.eveningScanHour} * * *`,
        essential: false,
        handler: async () => {
          await this.runMarketScan();
        },
      },
      {
        id: 'pokemon:weekly-snapshot',
        name: 'Pokemon TCG Weekly Collection Snapshot',
        cron: '0 0 * * 0', // Sunday midnight
        essential: false,
        handler: async () => {
          const cardPrices = await this.fetchCollectionPrices();
          const snapshot = this.collection.saveSnapshot(cardPrices);
          this.eventBus.emit('pokemon:snapshot_saved', {
            totalValue: snapshot.totalValue,
            totalCards: snapshot.totalCards,
            timestamp: new Date().toISOString(),
          });
        },
      },
    ];
  }

  async checkAlerts(): Promise<AlertContribution[]> {
    const activeAlerts = this.collection.getAlerts();
    if (activeAlerts.length === 0) return [];

    const cardPrices = await this.fetchCollectionPrices();
    const triggered = this.collection.checkAlerts(cardPrices);

    return triggered.map(alert => {
      const price = cardPrices.get(alert.cardId) ?? 0;

      this.eventBus.emit('pokemon:alert_triggered', {
        cardId: alert.cardId,
        cardName: alert.cardName,
        type: alert.type,
        price,
        threshold: alert.threshold,
        timestamp: new Date().toISOString(),
      });

      return {
        pluginId: this.manifest.id,
        severity: 'info' as const,
        title: `${alert.cardName} ${alert.type} $${alert.threshold}`,
        message: `${alert.cardName} is now $${price.toFixed(2)} (threshold: $${alert.threshold})`,
        actionable: true,
        action: 'Check collection',
      };
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async discoverInitiatives(): Promise<PluginInitiative[]> {
    // Find tracked cards that have dipped in price (buying opportunity)
    const entries = this.collection.getEntries();
    if (entries.length === 0) return [];

    try {
      const snapshots = this.collection.getSnapshots();
      if (snapshots.length < 2) return [];

      const latest = snapshots[snapshots.length - 1];
      const previous = snapshots[snapshots.length - 2];

      const dips = latest.entries.filter(entry => {
        const prevEntry = previous.entries.find(p => p.cardId === entry.cardId);
        if (!prevEntry) return false;
        return entry.marketPrice < prevEntry.marketPrice * 0.9; // 10%+ dip
      });

      return dips.map(entry => ({
        pluginId: this.manifest.id,
        title: `Buying opportunity: ${entry.name}`,
        description: `${entry.name} has dipped to $${entry.marketPrice.toFixed(2)}`,
        priority: 30,
        estimatedCost: 0,
        category: 'investment',
      }));
    } catch {
      return [];
    }
  }

  // ── Public API ─────────────────────────────────────────────────────

  getClient(): PokemonTcgClient {
    return this.client;
  }

  getCollection(): CollectionManager {
    return this.collection;
  }

  getConfig(): PokemonTcgConfig {
    return this.config;
  }

  // ── Private ────────────────────────────────────────────────────────

  private async fetchCollectionPrices(): Promise<Map<string, number>> {
    const entries = this.collection.getEntries();
    const prices = new Map<string, number>();

    for (const entry of entries) {
      try {
        const card = await this.client.getCard(entry.cardId);
        prices.set(entry.cardId, CollectionManager.getCardMarketPrice(card));
      } catch {
        prices.set(entry.cardId, 0);
      }
    }

    return prices;
  }

  private async runMarketScan(): Promise<void> {
    const entries = this.collection.getEntries();
    if (entries.length === 0) return;

    const cardPrices = await this.fetchCollectionPrices();

    this.eventBus.emit('pokemon:collection_updated', {
      totalCards: entries.reduce((sum, e) => sum + e.quantity, 0),
      totalValue: Array.from(cardPrices.values()).reduce((sum, p) => sum + p, 0),
      timestamp: new Date().toISOString(),
    });

    // Check alerts
    const triggered = this.collection.checkAlerts(cardPrices);
    for (const alert of triggered) {
      this.eventBus.emit('pokemon:alert_triggered', {
        cardId: alert.cardId,
        cardName: alert.cardName,
        type: alert.type,
        price: cardPrices.get(alert.cardId) ?? 0,
        threshold: alert.threshold,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
