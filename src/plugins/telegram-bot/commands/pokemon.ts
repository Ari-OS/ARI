import type { Context } from 'grammy';
import type { PluginRegistry } from '../../../plugins/registry.js';
import type { PokemonTcgPlugin } from '../../pokemon-tcg/index.js';
import { CollectionManager } from '../../pokemon-tcg/collection.js';
import { formatCardListHtml, formatCollectionHtml } from '../../pokemon-tcg/formatters.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /pokemon — Delegates to PokemonTcgPlugin via registry
// ═══════════════════════════════════════════════════════════════════════════════

export async function handlePokemon(
  ctx: Context,
  registry: PluginRegistry | null,
): Promise<void> {
  if (!registry) {
    await ctx.reply('Plugin registry not available.');
    return;
  }

  const plugin = registry.getPlugin<PokemonTcgPlugin>('pokemon-tcg');
  if (!plugin || plugin.getStatus() !== 'active') {
    await ctx.reply('Pokemon TCG plugin not available.');
    return;
  }

  const text = ctx.message?.text ?? '';
  const args = text.replace(/^\/pokemon\s*/i, '').trim();
  const parts = args.split(/\s+/);
  const subcommand = parts[0]?.toLowerCase() ?? 'help';

  try {
    switch (subcommand) {
      case 'search': {
        const query = parts.slice(1).join(' ');
        if (!query) {
          await ctx.reply('Usage: /pokemon search <query>\nExample: /pokemon search name:charizard');
          return;
        }

        const cards = await plugin.getClient().searchCards(query, 5);
        if (cards.length === 0) {
          await ctx.reply(`No cards found for: ${query}`);
          return;
        }

        await ctx.reply(formatCardListHtml(cards), { parse_mode: 'HTML' });
        break;
      }

      case 'collection': {
        const entries = plugin.getCollection().getEntries();
        if (entries.length === 0) {
          await ctx.reply('No cards in collection. Use CLI: <code>npx ari pokemon track &lt;cardId&gt;</code>', { parse_mode: 'HTML' });
          return;
        }

        const cardPrices = new Map<string, number>();
        for (const entry of entries) {
          try {
            const card = await plugin.getClient().getCard(entry.cardId);
            cardPrices.set(entry.cardId, CollectionManager.getCardMarketPrice(card));
          } catch {
            cardPrices.set(entry.cardId, 0);
          }
        }

        const value = plugin.getCollection().calculateCollectionValue(cardPrices);
        await ctx.reply(formatCollectionHtml(value), { parse_mode: 'HTML' });
        break;
      }

      default:
        await ctx.reply(
          '<b>Pokemon TCG Commands</b>\n\n' +
          '/pokemon search &lt;query&gt;\n' +
          '/pokemon collection',
          { parse_mode: 'HTML' },
        );
    }
  } catch (error) {
    await ctx.reply(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
