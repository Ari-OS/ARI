import type { Context } from 'grammy';
import type { EventBus } from '../../../kernel/event-bus.js';
import type { PluginRegistry } from '../../../plugins/registry.js';
import type { CryptoPlugin } from '../../crypto/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /market — Market overview, crypto, stocks, alerts
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleMarket(
  ctx: Context,
  eventBus: EventBus,
  registry: PluginRegistry | null,
): Promise<void> {
  const text = ctx.message?.text ?? '';
  const subcommand = text.replace(/^\/market\s*/i, '').trim().toLowerCase();

  try {
    if (subcommand === 'crypto') {
      await handleCryptoPrices(ctx, registry);
    } else if (subcommand === 'stocks') {
      await ctx.reply('Stock prices coming soon. Use <code>/market crypto</code> for now.', {
        parse_mode: 'HTML',
      });
    } else if (subcommand === 'alerts') {
      await handleMarketAlerts(ctx, registry);
    } else {
      await handlePortfolioOverview(ctx, eventBus);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await ctx.reply(`Error: ${message}`);
  }
}

async function handleCryptoPrices(
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

  const coinIds = plugin.getConfig().defaultCoins || ['bitcoin', 'ethereum', 'solana'];
  const prices = await plugin.getClient().getPrice(coinIds);

  const lines: string[] = ['<b>📈 Market Overview</b>', '<blockquote>'];

  for (const id of coinIds) {
    const data = prices[id];
    if (data) {
      const price = data.usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      const change = data.usd_24h_change ?? 0;
      const trend = change > 0 ? '🟢' : change < 0 ? '🔴' : '⚪';
      const changeStr = change > 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
      lines.push(`${trend} <b>${id.toUpperCase()}</b>: ${price} <i>(${changeStr})</i>`);
    }
  }
  lines.push('</blockquote>');

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}

async function handleMarketAlerts(
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

  const alerts = plugin.getPortfolio().getAllAlerts();

  if (alerts.length === 0) {
    await ctx.reply('<b>Market Alerts</b>\n\nNo alerts set.', { parse_mode: 'HTML' });
    return;
  }

  const lines: string[] = ['<b>Market Alerts</b>', ''];
  for (const a of alerts.slice(0, 10)) {
    const status = a.triggered ? '✅' : '⏳';
    const threshold = `$${a.threshold.toLocaleString('en-US')}`;
    lines.push(`${status} ${a.coinId} ${a.type} ${threshold}`);
  }

  if (alerts.length > 10) {
    lines.push('', `... and ${alerts.length - 10} more`);
  }

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}

async function handlePortfolioOverview(
  ctx: Context,
  eventBus: EventBus,
): Promise<void> {
  // Emit event to request portfolio data from market monitor
  // This is a placeholder for future implementation
  await ctx.reply(
    '<b>Market Overview</b>\n\n' +
    'Use:\n' +
    '<code>/market crypto</code> — Crypto prices\n' +
    '<code>/market stocks</code> — Stock prices (coming soon)\n' +
    '<code>/market alerts</code> — View alerts',
    { parse_mode: 'HTML' },
  );

  eventBus.emit('telegram:market_viewed', {
    userId: ctx.from?.id,
  });
}
