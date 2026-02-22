import type { CoinGeckoMarketData } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CRYPTO FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function color(text: string, c: keyof typeof COLORS): string {
  return `${COLORS[c]}${text}${COLORS.reset}`;
}

function changeColor(change: number): string {
  if (change > 0) return color(`+${change.toFixed(2)}%`, 'green');
  if (change < 0) return color(`${change.toFixed(2)}%`, 'red');
  return color('0.00%', 'dim');
}

function formatUsd(value: number): string {
  if (value >= 1) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${value.toPrecision(4)}`;
}

// ── CLI Formatters ───────────────────────────────────────────────────

export function formatPriceTable(
  data: Array<{ coinId: string; symbol: string; price: number; change24h: number }>,
): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(`  ${color('Coin', 'bold').padEnd(24)} ${color('Price', 'bold').padEnd(20)} ${color('24h Change', 'bold')}`);
  lines.push(`  ${'─'.repeat(50)}`);

  for (const coin of data) {
    const sym = color(coin.symbol.toUpperCase(), 'cyan');
    const price = formatUsd(coin.price);
    const change = changeColor(coin.change24h);
    lines.push(`  ${sym.padEnd(24)} ${price.padEnd(20)} ${change}`);
  }

  lines.push('');
  return lines.join('\n');
}

export function formatPortfolioTable(
  portfolio: {
    totalValue: number;
    totalCost: number;
    pnl: number;
    pnlPercent: number;
    holdings: Array<{
      symbol: string;
      amount: number;
      price: number;
      value: number;
      change24h: number;
    }>;
  },
): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(color('  Portfolio Summary', 'bold'));
  lines.push(`  ${'─'.repeat(55)}`);
  lines.push(`  Total Value: ${color(formatUsd(portfolio.totalValue), 'bold')}`);
  lines.push(`  Cost Basis:  ${formatUsd(portfolio.totalCost)}`);

  const pnlStr = portfolio.pnl >= 0
    ? color(`+${formatUsd(portfolio.pnl)} (${portfolio.pnlPercent.toFixed(1)}%)`, 'green')
    : color(`${formatUsd(portfolio.pnl)} (${portfolio.pnlPercent.toFixed(1)}%)`, 'red');
  lines.push(`  P&L:         ${pnlStr}`);
  lines.push('');

  lines.push(`  ${color('Coin', 'bold').padEnd(14)} ${color('Amount', 'bold').padEnd(14)} ${color('Price', 'bold').padEnd(14)} ${color('Value', 'bold').padEnd(14)} ${color('24h', 'bold')}`);
  lines.push(`  ${'─'.repeat(66)}`);

  for (const h of portfolio.holdings) {
    lines.push(
      `  ${color(h.symbol, 'cyan').padEnd(14)} ${String(h.amount).padEnd(14)} ${formatUsd(h.price).padEnd(14)} ${formatUsd(h.value).padEnd(14)} ${changeColor(h.change24h)}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

export function formatMarketData(data: CoinGeckoMarketData[]): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(`  ${color('Coin', 'bold').padEnd(24)} ${color('Price', 'bold').padEnd(16)} ${color('Mkt Cap', 'bold').padEnd(16)} ${color('24h', 'bold')}`);
  lines.push(`  ${'─'.repeat(64)}`);

  for (const coin of data) {
    const sym = color(coin.symbol.toUpperCase(), 'cyan');
    const price = formatUsd(coin.current_price);
    const mcap = `$${(coin.market_cap / 1e9).toFixed(1)}B`;
    const change = changeColor(coin.price_change_percentage_24h);
    lines.push(`  ${sym.padEnd(24)} ${price.padEnd(16)} ${mcap.padEnd(16)} ${change}`);
  }

  lines.push('');
  return lines.join('\n');
}

// ── Telegram HTML Formatters ─────────────────────────────────────────

export function formatPriceHtml(
  data: Array<{ coinId: string; symbol: string; price: number; change24h: number }>,
): string {
  const lines = ['<b>Crypto Prices</b>', ''];
  for (const coin of data) {
    const arrow = coin.change24h >= 0 ? '📈' : '📉';
    const change = coin.change24h >= 0 ? `+${coin.change24h.toFixed(2)}%` : `${coin.change24h.toFixed(2)}%`;
    lines.push(`${arrow} <b>${coin.symbol.toUpperCase()}</b>: ${formatUsd(coin.price)} (${change})`);
  }
  return lines.join('\n');
}

export function formatPortfolioHtml(
  portfolio: {
    totalValue: number;
    pnl: number;
    pnlPercent: number;
    holdings: Array<{ symbol: string; value: number; change24h: number }>;
  },
): string {
  const arrow = portfolio.pnl >= 0 ? '📈' : '📉';
  const pnlStr = portfolio.pnl >= 0
    ? `+${formatUsd(portfolio.pnl)} (+${portfolio.pnlPercent.toFixed(1)}%)`
    : `${formatUsd(portfolio.pnl)} (${portfolio.pnlPercent.toFixed(1)}%)`;

  const lines = [
    '<b>Portfolio</b>',
    '',
    `💰 Total: <b>${formatUsd(portfolio.totalValue)}</b>`,
    `${arrow} P&amp;L: ${pnlStr}`,
    '',
  ];

  for (const h of portfolio.holdings) {
    const hArrow = h.change24h >= 0 ? '🟢' : '🔴';
    lines.push(`${hArrow} ${h.symbol}: ${formatUsd(h.value)}`);
  }

  return lines.join('\n');
}
