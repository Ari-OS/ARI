import type { Context } from 'grammy';
import type { EventBus } from '../../../kernel/event-bus.js';
import { InlineKeyboard } from 'grammy';
import type { CryptoPlugin } from '../../crypto/index.js';
import type { PluginRegistry } from '../../../plugins/registry.js';

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

  const lines: string[] = ['<b>Crypto Prices</b>', ''];
  lines.push('<pre>Asset | Price       | 24h% ');
  lines.push('------|-------------|------');

  for (const id of coinIds) {
    const data = prices[id];
    if (data) {
      const price = data.usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      const change = data.usd_24h_change ?? 0;
      const trend = change > 0 ? '+' : '';
      const assetStr = id.toUpperCase().padEnd(5).substring(0, 5);
      const priceStr = price.padEnd(11).substring(0, 11);
      const changeStr = `${trend}${change.toFixed(1)}%`.padEnd(5).substring(0, 5);
      
      lines.push(`${assetStr} | ${priceStr} | ${changeStr}`);
    }
  }
  lines.push('</pre>');

  const keyboard = new InlineKeyboard()
    .text('📊 View Detailed Chart', 'action_view_chart')
    .text('✅ Approve Arbitrage', 'action_approve_arbitrage');

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: keyboard });
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
  const keyboard = new InlineKeyboard()
    .text('📈 Crypto', 'cmd_market_crypto')
    .text('📉 Stocks', 'cmd_market_stocks')
    .row()
    .text('⚠️ View Alerts', 'cmd_market_alerts');

  await ctx.reply(
    '<b>Market Overview</b>\n\n' +
    'Select a market sector below to view metrics and ascii-table charts.',
    { parse_mode: 'HTML', reply_markup: keyboard },
  );

  eventBus.emit('telegram:market_viewed', {
    userId: ctx.from?.id,
  });
}
