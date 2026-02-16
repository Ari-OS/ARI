import { CryptoPlugin } from './crypto/index.js';
import { PokemonTcgPlugin } from './pokemon-tcg/index.js';
import { TtsPlugin } from './tts/index.js';
import { TelegramBotPlugin } from './telegram-bot/index.js';
import { ContentEnginePlugin } from './content-engine/index.js';
import type { PluginRegistry } from './registry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTER ALL PLUGINS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Registers all domain plugins with the registry.
 * Call this at application startup before `registry.initializeAll()`.
 */
export async function registerAllPlugins(registry: PluginRegistry): Promise<void> {
  // Core domain plugins (independent, no inter-plugin deps)
  await registry.register(new CryptoPlugin());
  await registry.register(new PokemonTcgPlugin());
  await registry.register(new TtsPlugin());
  await registry.register(new ContentEnginePlugin());

  // Interface plugin (depends on others via registry, but graceful degradation)
  await registry.register(new TelegramBotPlugin());
}
