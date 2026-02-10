import { Command } from 'commander';
import { EventBus } from '../../kernel/event-bus.js';
import { PluginRegistry } from '../../plugins/registry.js';
import { CryptoPlugin } from '../../plugins/crypto/index.js';
import {
  formatPriceTable,
  formatPortfolioTable,
  formatMarketData,
} from '../../plugins/crypto/formatters.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CRYPTO CLI COMMAND
// ═══════════════════════════════════════════════════════════════════════════════

async function getPlugin(): Promise<CryptoPlugin> {
  const eventBus = new EventBus();
  const registry = new PluginRegistry(eventBus);
  const plugin = new CryptoPlugin();
  await registry.register(plugin);

  const config: Record<string, unknown> = {};
  if (process.env.COINGECKO_API_KEY) {
    config.apiKey = process.env.COINGECKO_API_KEY;
  }

  await plugin.initialize({
    eventBus,
    orchestrator: null as never,
    config,
    dataDir: `${process.env.HOME}/.ari/plugins/crypto/data`,
    costTracker: null,
    registry,
  });

  return plugin;
}

export function registerCryptoCommand(program: Command): void {
  const crypto = program
    .command('crypto')
    .description('Cryptocurrency prices and portfolio management');

  // ── price ──────────────────────────────────────────────────────────

  crypto
    .command('price [coins...]')
    .description('Get current prices for coins (default: btc, eth, sol)')
    .option('--json', 'Output as JSON')
    .action(async (coins: string[], options: { json?: boolean }) => {
      try {
        const plugin = await getPlugin();
        const coinIds = coins.length > 0 ? coins : plugin.getConfig().defaultCoins;
        const prices = await plugin.getClient().getPrice(coinIds);

        if (options.json) {
          console.log(JSON.stringify(prices, null, 2));
          return;
        }

        const data = coinIds.map(id => ({
          coinId: id,
          symbol: id,
          price: prices[id]?.usd ?? 0,
          change24h: prices[id]?.usd_24h_change ?? 0,
        }));

        console.log(formatPriceTable(data));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // ── market ─────────────────────────────────────────────────────────

  crypto
    .command('market [coins...]')
    .description('Get detailed market data')
    .action(async (coins: string[]) => {
      try {
        const plugin = await getPlugin();
        const coinIds = coins.length > 0 ? coins : plugin.getConfig().defaultCoins;
        const data = await plugin.getClient().getMarketData(coinIds);
        console.log(formatMarketData(data));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // ── portfolio ──────────────────────────────────────────────────────

  crypto
    .command('portfolio')
    .description('Show portfolio with current values')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      try {
        const plugin = await getPlugin();
        const holdings = plugin.getPortfolio().getHoldings();

        if (holdings.length === 0) {
          console.log('\nNo holdings tracked. Add with: npx ari crypto add <coinId> <amount>\n');
          return;
        }

        const coinIds = holdings.map(h => h.coinId);
        const prices = await plugin.getClient().getPrice(coinIds);
        const pv = plugin.getPortfolio().calculatePortfolioValue(prices);

        if (options.json) {
          console.log(JSON.stringify(pv, null, 2));
          return;
        }

        console.log(formatPortfolioTable(pv));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // ── add ────────────────────────────────────────────────────────────

  crypto
    .command('add <coinId> <amount>')
    .description('Add a holding to your portfolio')
    .option('-c, --cost <cost>', 'Cost basis in USD', '0')
    .action(async (coinId: string, amount: string, options: { cost: string }) => {
      try {
        const plugin = await getPlugin();
        const holding = plugin.getPortfolio().addHolding(
          coinId,
          coinId,
          parseFloat(amount),
          parseFloat(options.cost),
        );
        console.log(`\n  Added ${holding.amount} ${holding.symbol} to portfolio\n`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // ── remove ─────────────────────────────────────────────────────────

  crypto
    .command('remove <coinId>')
    .description('Remove a holding from your portfolio')
    .action(async (coinId: string) => {
      try {
        const plugin = await getPlugin();
        const removed = plugin.getPortfolio().removeHolding(coinId);
        if (removed) {
          console.log(`\n  Removed ${coinId} from portfolio\n`);
        } else {
          console.log(`\n  ${coinId} not found in portfolio\n`);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // ── alert ──────────────────────────────────────────────────────────

  crypto
    .command('alert <coinId> <type> <threshold>')
    .description('Set a price alert (type: above or below)')
    .action(async (coinId: string, type: string, threshold: string) => {
      try {
        if (type !== 'above' && type !== 'below') {
          console.error('Type must be "above" or "below"');
          process.exit(1);
        }

        const plugin = await getPlugin();
        const alert = plugin.getPortfolio().addAlert(coinId, type, parseFloat(threshold));
        console.log(`\n  Alert set: ${coinId} ${type} $${alert.threshold} (id: ${alert.id})\n`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // ── alerts ─────────────────────────────────────────────────────────

  crypto
    .command('alerts')
    .description('List all price alerts')
    .action(async () => {
      try {
        const plugin = await getPlugin();
        const alerts = plugin.getPortfolio().getAllAlerts();

        if (alerts.length === 0) {
          console.log('\nNo alerts set. Add with: npx ari crypto alert <coinId> <above|below> <price>\n');
          return;
        }

        console.log('\n  Price Alerts:');
        console.log(`  ${'─'.repeat(50)}`);
        for (const alert of alerts) {
          const status = alert.triggered ? '✓ triggered' : 'active';
          console.log(`  [${alert.id}] ${alert.coinId} ${alert.type} $${alert.threshold} (${status})`);
        }
        console.log('');
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
