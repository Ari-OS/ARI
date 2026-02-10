import type { EventBus } from '../../kernel/event-bus.js';
import type {
  DomainPlugin,
  PluginManifest,
  PluginStatus,
  PluginDependencies,
  BriefingContribution,
  ScheduledTaskDefinition,
  AlertContribution,
} from '../types.js';
import { CoinGeckoClient } from './api-client.js';
import { PortfolioManager } from './portfolio.js';
import { CryptoConfigSchema } from './types.js';
import type { CryptoConfig } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CRYPTO PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════

export class CryptoPlugin implements DomainPlugin {
  readonly manifest: PluginManifest = {
    id: 'crypto',
    name: 'CoinGecko Crypto',
    version: '1.0.0',
    description: 'Cryptocurrency price tracking, portfolio management, and alerts via CoinGecko',
    author: 'ARI',
    capabilities: ['briefing', 'scheduling', 'alerting', 'cli', 'data'],
    dependencies: [],
  };

  private status: PluginStatus = 'registered';
  private eventBus!: EventBus;
  private client!: CoinGeckoClient;
  private portfolio!: PortfolioManager;
  private config!: CryptoConfig;

  // ── Lifecycle ──────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize(deps: PluginDependencies): Promise<void> {
    this.eventBus = deps.eventBus;
    this.config = CryptoConfigSchema.parse(deps.config);
    this.client = new CoinGeckoClient(this.config.apiKey);
    this.portfolio = new PortfolioManager(deps.dataDir);
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
      await this.client.getPrice(['bitcoin']);
      return { healthy: true, details: 'CoinGecko API reachable' };
    } catch (error) {
      return {
        healthy: false,
        details: `CoinGecko API error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ── Integration Hooks ──────────────────────────────────────────────

  async contributeToBriefing(type: 'morning' | 'evening' | 'weekly'): Promise<BriefingContribution | null> {
    if (type === 'weekly') return null;

    const holdings = this.portfolio.getHoldings();
    if (holdings.length === 0) {
      // Still show default coin prices
      try {
        const prices = await this.client.getPrice(this.config.defaultCoins);
        const lines = this.config.defaultCoins.map(coin => {
          const p = prices[coin];
          if (!p) return `${coin}: N/A`;
          const change = p.usd_24h_change ?? 0;
          const arrow = change >= 0 ? '↑' : '↓';
          return `${coin}: $${p.usd.toLocaleString()} ${arrow}${Math.abs(change).toFixed(1)}%`;
        });

        return {
          pluginId: this.manifest.id,
          section: 'Crypto Prices',
          content: lines.join('\n'),
          priority: 50,
          category: 'info',
        };
      } catch {
        return null;
      }
    }

    try {
      const coinIds = holdings.map(h => h.coinId);
      const prices = await this.client.getPrice(coinIds);
      const pv = this.portfolio.calculatePortfolioValue(prices);

      const arrow = pv.pnl >= 0 ? '↑' : '↓';
      const content = [
        `Portfolio: $${pv.totalValue.toFixed(2)} (${arrow}${Math.abs(pv.pnlPercent).toFixed(1)}%)`,
        ...pv.holdings.slice(0, 5).map(h => {
          const chg = h.change24h >= 0 ? `+${h.change24h.toFixed(1)}%` : `${h.change24h.toFixed(1)}%`;
          return `  ${h.symbol}: $${h.price.toLocaleString()} (${chg})`;
        }),
      ].join('\n');

      this.eventBus.emit('crypto:portfolio_updated', {
        totalValue: pv.totalValue,
        change24h: pv.pnlPercent,
        holdings: holdings.length,
        timestamp: new Date().toISOString(),
      });

      return {
        pluginId: this.manifest.id,
        section: 'Crypto Portfolio',
        content,
        priority: 60,
        category: pv.pnlPercent < -10 ? 'alert' : 'info',
      };
    } catch {
      return null;
    }
  }

  getScheduledTasks(): ScheduledTaskDefinition[] {
    return [
      {
        id: 'crypto:price-check',
        name: 'Crypto Price Check',
        cron: `*/${this.config.priceCheckIntervalMinutes} * * * *`,
        essential: false,
        handler: async () => {
          const holdings = this.portfolio.getHoldings();
          const coinIds = holdings.length > 0
            ? holdings.map(h => h.coinId)
            : this.config.defaultCoins;

          const prices = await this.client.getPrice(coinIds);

          this.eventBus.emit('crypto:price_fetched', {
            coins: coinIds,
            source: 'coingecko',
            cached: false,
            timestamp: new Date().toISOString(),
          });

          // Check alerts
          const triggered = this.portfolio.checkAlerts(prices);
          for (const alert of triggered) {
            const price = prices[alert.coinId]?.usd ?? 0;
            this.eventBus.emit('crypto:alert_triggered', {
              coinId: alert.coinId,
              type: alert.type,
              price,
              threshold: alert.threshold,
              timestamp: new Date().toISOString(),
            });
          }
        },
      },
      {
        id: 'crypto:daily-snapshot',
        name: 'Crypto Daily Snapshot',
        cron: `0 ${this.config.snapshotHour} * * *`,
        essential: false,
        handler: async () => {
          const holdings = this.portfolio.getHoldings();
          if (holdings.length === 0) return;

          const coinIds = holdings.map(h => h.coinId);
          const prices = await this.client.getPrice(coinIds);
          const snapshot = this.portfolio.saveSnapshot(prices);

          this.eventBus.emit('crypto:snapshot_saved', {
            totalValue: snapshot.totalValue,
            holdings: snapshot.holdings.length,
            timestamp: new Date().toISOString(),
          });
        },
      },
    ];
  }

  async checkAlerts(): Promise<AlertContribution[]> {
    const activeAlerts = this.portfolio.getAlerts();
    if (activeAlerts.length === 0) return [];

    const coinIds = [...new Set(activeAlerts.map(a => a.coinId))];
    const prices = await this.client.getPrice(coinIds);
    const triggered = this.portfolio.checkAlerts(prices);

    return triggered.map(alert => {
      const currentPrice = prices[alert.coinId]?.usd ?? 0;

      this.eventBus.emit('crypto:alert_triggered', {
        coinId: alert.coinId,
        type: alert.type,
        price: currentPrice,
        threshold: alert.threshold,
        timestamp: new Date().toISOString(),
      });

      return {
        pluginId: this.manifest.id,
        severity: 'warning' as const,
        title: `${alert.coinId} ${alert.type === 'above' ? 'above' : 'below'} $${alert.threshold}`,
        message: `${alert.coinId} is now $${currentPrice} (threshold: $${alert.threshold})`,
        actionable: true,
        action: 'Review portfolio',
      };
    });
  }

  // ── Public API (used by Telegram Bot + CLI) ────────────────────────

  getClient(): CoinGeckoClient {
    return this.client;
  }

  getPortfolio(): PortfolioManager {
    return this.portfolio;
  }

  getConfig(): CryptoConfig {
    return this.config;
  }
}
