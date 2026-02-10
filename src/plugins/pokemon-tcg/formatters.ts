import type { PokemonCard } from './types.js';
import { CollectionManager } from './collection.js';

// ═══════════════════════════════════════════════════════════════════════════════
// POKEMON TCG FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function color(text: string, c: keyof typeof COLORS): string {
  return `${COLORS[c]}${text}${COLORS.reset}`;
}

function formatUsd(value: number): string {
  if (value === 0) return 'N/A';
  return `$${value.toFixed(2)}`;
}

// ── CLI Formatters ───────────────────────────────────────────────────

export function formatCardList(cards: PokemonCard[]): string {
  const lines: string[] = [''];
  lines.push(`  ${color('Name', 'bold').padEnd(34)} ${color('Set', 'bold').padEnd(24)} ${color('Rarity', 'bold').padEnd(18)} ${color('Market', 'bold')}`);
  lines.push(`  ${'─'.repeat(70)}`);

  for (const card of cards) {
    const price = CollectionManager.getCardMarketPrice(card);
    const name = color(card.name, 'cyan');
    const set = card.set.name.slice(0, 20);
    const rarity = card.rarity ?? 'Unknown';
    lines.push(`  ${name.padEnd(34)} ${set.padEnd(24)} ${rarity.padEnd(18)} ${formatUsd(price)}`);
  }

  lines.push('');
  return lines.join('\n');
}

export function formatCardDetail(card: PokemonCard): string {
  const price = CollectionManager.getCardMarketPrice(card);
  const lines: string[] = [''];
  lines.push(color(`  ${card.name}`, 'bold'));
  lines.push(`  ${'─'.repeat(40)}`);
  lines.push(`  ID:       ${card.id}`);
  lines.push(`  Set:      ${card.set.name} (${card.set.series})`);
  lines.push(`  Number:   ${card.number}`);
  lines.push(`  Type:     ${card.supertype}${card.subtypes ? ` — ${card.subtypes.join(', ')}` : ''}`);
  if (card.types) lines.push(`  Types:    ${card.types.join(', ')}`);
  if (card.hp) lines.push(`  HP:       ${card.hp}`);
  if (card.rarity) lines.push(`  Rarity:   ${color(card.rarity, 'magenta')}`);
  lines.push(`  Market:   ${color(formatUsd(price), price > 0 ? 'green' : 'dim')}`);

  if (card.tcgplayer?.prices) {
    lines.push('');
    lines.push(color('  TCGPlayer Prices:', 'dim'));
    for (const [variant, prices] of Object.entries(card.tcgplayer.prices)) {
      const parts: string[] = [];
      if (prices.low !== null && prices.low !== undefined) parts.push(`Low: $${prices.low.toFixed(2)}`);
      if (prices.mid !== null && prices.mid !== undefined) parts.push(`Mid: $${prices.mid.toFixed(2)}`);
      if (prices.high !== null && prices.high !== undefined) parts.push(`High: $${prices.high.toFixed(2)}`);
      if (prices.market !== null && prices.market !== undefined) parts.push(`Market: $${prices.market.toFixed(2)}`);
      lines.push(`    ${variant}: ${parts.join(' | ')}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function formatCollectionTable(
  collection: {
    totalValue: number;
    totalCost: number;
    entries: Array<{
      name: string;
      quantity: number;
      marketPrice: number;
      value: number;
    }>;
  },
): string {
  const lines: string[] = [''];
  lines.push(color('  Collection Summary', 'bold'));
  lines.push(`  ${'─'.repeat(55)}`);
  lines.push(`  Total Value: ${color(formatUsd(collection.totalValue), 'bold')}`);
  lines.push(`  Cost Basis:  ${formatUsd(collection.totalCost)}`);

  const pnl = collection.totalValue - collection.totalCost;
  if (collection.totalCost > 0) {
    const pnlStr = pnl >= 0
      ? color(`+${formatUsd(pnl)}`, 'green')
      : color(formatUsd(pnl), 'red');
    lines.push(`  P&L:         ${pnlStr}`);
  }

  lines.push('');
  lines.push(`  ${color('Card', 'bold').padEnd(28)} ${color('Qty', 'bold').padEnd(8)} ${color('Price', 'bold').padEnd(12)} ${color('Value', 'bold')}`);
  lines.push(`  ${'─'.repeat(55)}`);

  for (const e of collection.entries) {
    lines.push(
      `  ${color(e.name.slice(0, 24), 'cyan').padEnd(28)} ${String(e.quantity).padEnd(8)} ${formatUsd(e.marketPrice).padEnd(12)} ${formatUsd(e.value)}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

// ── Telegram HTML Formatters ─────────────────────────────────────────

export function formatCardListHtml(cards: PokemonCard[]): string {
  const lines = ['<b>Pokemon TCG Search Results</b>', ''];
  for (const card of cards) {
    const price = CollectionManager.getCardMarketPrice(card);
    const priceStr = price > 0 ? `$${price.toFixed(2)}` : 'N/A';
    lines.push(`• <b>${card.name}</b> [${card.set.name}] — ${priceStr}`);
  }
  return lines.join('\n');
}

export function formatCollectionHtml(
  collection: {
    totalValue: number;
    entries: Array<{ name: string; quantity: number; value: number }>;
  },
): string {
  const lines = [
    '<b>Pokemon TCG Collection</b>',
    '',
    `💰 Total Value: <b>$${collection.totalValue.toFixed(2)}</b>`,
    '',
  ];

  for (const e of collection.entries.slice(0, 10)) {
    lines.push(`• ${e.name} x${e.quantity}: $${e.value.toFixed(2)}`);
  }

  if (collection.entries.length > 10) {
    lines.push(`<i>... and ${collection.entries.length - 10} more</i>`);
  }

  return lines.join('\n');
}
