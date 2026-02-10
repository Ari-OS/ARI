import type { Context } from 'grammy';
import type { PluginRegistry } from '../../../plugins/registry.js';
import type { CryptoPlugin } from '../../crypto/index.js';
import { formatPriceHtml, formatPortfolioHtml } from '../../crypto/formatters.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /crypto — Delegates to CryptoPlugin via registry
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleCrypto(
  ctx: Context,
  registry: PluginRegistry | null,
): Promise<void> {
  if (!registry) {
    await ctx.reply('Plugin registry not available.');
    return;
  }

  const plugin = registry.getPlugin<CryptoPlugin>('crypto');
  if (!plugin || plugin.getStatus() !== 'active') {
    await ctx.reply('Crypto plugin not available.');
    return;
  }

  const text = ctx.message?.text ?? '';
  const args = text.replace(/^\/crypto\s*/i, '').trim().split(/\s+/);
  const subcommand = args[0]?.toLowerCase() ?? 'price';

  try {
    switch (subcommand) {
      case 'price': {
        const coins = args.slice(1);
        const coinIds = coins.length > 0 ? coins : plugin.getConfig().defaultCoins;
        const prices = await plugin.getClient().getPrice(coinIds);

        const data = coinIds.map(id => ({
          coinId: id,
          symbol: id,
          price: prices[id]?.usd ?? 0,
          change24h: prices[id]?.usd_24h_change ?? 0,
        }));

        await ctx.reply(formatPriceHtml(data), { parse_mode: 'HTML' });
        break;
      }

      case 'portfolio': {
        const holdings = plugin.getPortfolio().getHoldings();
        if (holdings.length === 0) {
          await ctx.reply('No holdings tracked. Use CLI: <code>npx ari crypto add &lt;coin&gt; &lt;amount&gt;</code>', { parse_mode: 'HTML' });
          return;
        }

        const coinIds = holdings.map(h => h.coinId);
        const prices = await plugin.getClient().getPrice(coinIds);
        const pv = plugin.getPortfolio().calculatePortfolioValue(prices);

        await ctx.reply(formatPortfolioHtml(pv), { parse_mode: 'HTML' });
        break;
      }

      case 'alerts': {
        const alerts = plugin.getPortfolio().getAllAlerts();
        if (alerts.length === 0) {
          await ctx.reply('No price alerts set.');
          return;
        }

        const lines = ['<b>Price Alerts</b>', ''];
        for (const a of alerts) {
          const status = a.triggered ? '✅' : '⏳';
          lines.push(`${status} ${a.coinId} ${a.type} $${a.threshold}`);
        }
        await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
        break;
      }

      default:
        await ctx.reply(
          '<b>Crypto Commands</b>\n\n' +
          '/crypto price [coins...]\n' +
          '/crypto portfolio\n' +
          '/crypto alerts',
          { parse_mode: 'HTML' },
        );
    }
  } catch (error) {
    await ctx.reply(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
