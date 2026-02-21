import type { Context } from 'grammy';
import type { PluginRegistry } from '../../../plugins/registry.js';
import type { CryptoPlugin } from '../../crypto/index.js';
import { formatPriceHtml, formatPortfolioHtml } from '../../crypto/formatters.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /crypto — Delegates to CryptoPlugin via registry
// ═══════════════════════════════════════════════════════════════════════════════

// CoinGecko IDs are lowercase. Map common symbols/names to their IDs.
const COIN_ALIASES: Record<string, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  sol: 'solana',
  bnb: 'binancecoin',
  doge: 'dogecoin',
  xrp: 'ripple',
  ada: 'cardano',
  avax: 'avalanche-2',
  link: 'chainlink',
  matic: 'matic-network',
  dot: 'polkadot',
  usdt: 'tether',
  usdc: 'usd-coin',
  shib: 'shiba-inu',
  ltc: 'litecoin',
  atom: 'cosmos',
  near: 'near',
  algo: 'algorand',
  uni: 'uniswap',
  aave: 'aave',
};

// Display ticker symbols for known CoinGecko IDs
const COIN_SYMBOLS: Record<string, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
  binancecoin: 'BNB',
  dogecoin: 'DOGE',
  ripple: 'XRP',
  cardano: 'ADA',
  'avalanche-2': 'AVAX',
  chainlink: 'LINK',
  'matic-network': 'MATIC',
  polkadot: 'DOT',
  tether: 'USDT',
  'usd-coin': 'USDC',
  'shiba-inu': 'SHIB',
  litecoin: 'LTC',
  cosmos: 'ATOM',
  near: 'NEAR',
  algorand: 'ALGO',
  uniswap: 'UNI',
  aave: 'AAVE',
};

// Regex to extract coin names/symbols from natural language
const COIN_NL_PATTERN = /\b(bitcoin|btc|ethereum|eth|solana|sol|bnb|dogecoin|doge|xrp|ripple|cardano|ada|avalanche|avax|chainlink|link|matic|polygon|polkadot|dot|usdt|usdc|shib|shiba|litecoin|ltc|cosmos|atom|near|algorand|algo|uniswap|uni|aave)\b/gi;

/** Normalize a coin name/symbol to its CoinGecko ID */
function normalizeCoinId(id: string): string {
  const lower = id.toLowerCase();
  return COIN_ALIASES[lower] ?? lower;
}

/** Get the display ticker for a CoinGecko ID */
function getDisplaySymbol(coinId: string): string {
  return COIN_SYMBOLS[coinId] ?? coinId.toUpperCase();
}

/** Extract CoinGecko IDs from a natural language string */
function extractCoinsFromText(text: string): string[] {
  const matches = text.match(COIN_NL_PATTERN) ?? [];
  const coinIds = [...new Set(matches.map(m => normalizeCoinId(m.toLowerCase())))];
  return coinIds;
}

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

  // Natural language path: called from intent router with non-command text
  if (!text.startsWith('/crypto')) {
    const coins = extractCoinsFromText(text);
    if (coins.length === 0) {
      await ctx.reply(
        '💹 Which crypto? Try:\n"What\'s BTC at?" or /crypto price bitcoin',
      );
      return;
    }
    try {
      const prices = await plugin.getClient().getPrice(coins);
      const data = coins.map(id => ({
        coinId: id,
        symbol: getDisplaySymbol(id),
        price: prices[id]?.usd ?? 0,
        change24h: prices[id]?.usd_24h_change ?? 0,
      }));
      await ctx.reply(formatPriceHtml(data), { parse_mode: 'HTML' });
    } catch (error) {
      await ctx.reply(`Error fetching prices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return;
  }

  const args = text.replace(/^\/crypto\s*/i, '').trim().split(/\s+/);
  const subcommand = args[0]?.toLowerCase() ?? 'price';

  try {
    switch (subcommand) {
      case 'price': {
        const rawCoins = args.slice(1);
        const rawIds = rawCoins.length > 0 ? rawCoins : plugin.getConfig().defaultCoins;
        // Normalize: lowercase + resolve symbols to CoinGecko IDs
        const coinIds = rawIds.map(normalizeCoinId);
        const prices = await plugin.getClient().getPrice(coinIds);

        const data = coinIds.map(id => ({
          coinId: id,
          symbol: getDisplaySymbol(id),
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
