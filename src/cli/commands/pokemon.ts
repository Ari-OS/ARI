import { Command } from 'commander';
import { EventBus } from '../../kernel/event-bus.js';
import { PluginRegistry } from '../../plugins/registry.js';
import { PokemonTcgPlugin } from '../../plugins/pokemon-tcg/index.js';
import { CollectionManager } from '../../plugins/pokemon-tcg/collection.js';
import {
  formatCardList,
  formatCardDetail,
  formatCollectionTable,
} from '../../plugins/pokemon-tcg/formatters.js';

// ═══════════════════════════════════════════════════════════════════════════════
// POKEMON TCG CLI COMMAND
// ═══════════════════════════════════════════════════════════════════════════════

async function getPlugin(): Promise<PokemonTcgPlugin> {
  const eventBus = new EventBus();
  const registry = new PluginRegistry(eventBus);
  const plugin = new PokemonTcgPlugin();
  await registry.register(plugin);

  const config: Record<string, unknown> = {};
  if (process.env.POKEMONTCG_API_KEY) {
    config.apiKey = process.env.POKEMONTCG_API_KEY;
  }

  await plugin.initialize({
    eventBus,
    orchestrator: null as never,
    config,
    dataDir: `${process.env.HOME}/.ari/plugins/pokemon-tcg/data`,
    costTracker: null,
    registry,
  });

  return plugin;
}

export function registerPokemonCommand(program: Command): void {
  const pokemon = program
    .command('pokemon')
    .description('Pokemon TCG card tracking and collection management');

  // ── search ─────────────────────────────────────────────────────────

  pokemon
    .command('search <query...>')
    .description('Search for cards (supports Lucene syntax: name:charizard)')
    .option('-l, --limit <n>', 'Max results', '10')
    .option('--json', 'Output as JSON')
    .action(async (query: string[], options: { limit: string; json?: boolean }) => {
      try {
        const plugin = await getPlugin();
        const searchQuery = query.join(' ');
        const cards = await plugin.getClient().searchCards(searchQuery, parseInt(options.limit, 10));

        if (options.json) {
          console.log(JSON.stringify(cards, null, 2));
          return;
        }

        if (cards.length === 0) {
          console.log(`\nNo cards found for: ${searchQuery}\n`);
          return;
        }

        console.log(formatCardList(cards));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // ── collection ─────────────────────────────────────────────────────

  pokemon
    .command('collection')
    .description('Show your card collection with values')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      try {
        const plugin = await getPlugin();
        const entries = plugin.getCollection().getEntries();

        if (entries.length === 0) {
          console.log('\nNo cards tracked. Add with: npx ari pokemon track <cardId>\n');
          return;
        }

        // Fetch prices
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

        if (options.json) {
          console.log(JSON.stringify(value, null, 2));
          return;
        }

        console.log(formatCollectionTable(value));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // ── track ──────────────────────────────────────────────────────────

  pokemon
    .command('track <cardId>')
    .description('Add a card to your collection')
    .option('-q, --quantity <n>', 'Quantity', '1')
    .option('-c, --cost <cost>', 'Cost basis in USD', '0')
    .action(async (cardId: string, options: { quantity: string; cost: string }) => {
      try {
        const plugin = await getPlugin();
        const card = await plugin.getClient().getCard(cardId);
        const entry = plugin.getCollection().addEntry(
          card,
          parseInt(options.quantity, 10),
          parseFloat(options.cost),
        );

        console.log(`\n  Added ${entry.quantity}x ${entry.name} [${entry.setName}] to collection\n`);
        console.log(formatCardDetail(card));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // ── portfolio ──────────────────────────────────────────────────────

  pokemon
    .command('portfolio')
    .description('Show collection value over time')
    .action(async () => {
      try {
        const plugin = await getPlugin();
        const snapshots = plugin.getCollection().getSnapshots();

        if (snapshots.length === 0) {
          console.log('\nNo snapshots yet. Snapshots are taken weekly on Sunday.\n');
          return;
        }

        console.log('\n  Collection Value History:');
        console.log(`  ${'─'.repeat(40)}`);
        for (const snap of snapshots.slice(-10)) {
          const date = new Date(snap.timestamp).toLocaleDateString();
          console.log(`  ${date}: $${snap.totalValue.toFixed(2)} (${snap.totalCards} cards)`);
        }
        console.log('');
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // ── opportunities ──────────────────────────────────────────────────

  pokemon
    .command('opportunities')
    .description('Show buying opportunities based on price dips')
    .action(async () => {
      try {
        const plugin = await getPlugin();
        const initiatives = await plugin.discoverInitiatives();

        if (!initiatives || initiatives.length === 0) {
          console.log('\nNo buying opportunities detected. Need at least 2 weekly snapshots.\n');
          return;
        }

        console.log('\n  Buying Opportunities:');
        console.log(`  ${'─'.repeat(50)}`);
        for (const init of initiatives) {
          console.log(`  • ${init.title}`);
          console.log(`    ${init.description}`);
        }
        console.log('');
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
