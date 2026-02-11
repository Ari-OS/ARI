import { Bot } from 'grammy';
import type { EventBus } from '../../kernel/event-bus.js';
import type { AIOrchestrator } from '../../ai/orchestrator.js';
import type { CostTracker } from '../../observability/cost-tracker.js';
import type { PluginRegistry } from '../registry.js';
import type { TelegramBotConfig } from './types.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createLoggingMiddleware } from './middleware/logging.js';
import { createRateLimitMiddleware } from './middleware/rate-limit.js';
import { handleAsk } from './commands/ask.js';
import { handleStatus } from './commands/status.js';
import { handleBudget } from './commands/budget.js';
import { handleBriefing } from './commands/briefing.js';
import { handleCrypto } from './commands/crypto.js';
import { handlePokemon } from './commands/pokemon.js';
import { handleSpeak } from './commands/speak.js';
import { handleDev } from './commands/dev.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM BOT SETUP
// ═══════════════════════════════════════════════════════════════════════════════

export interface BotDependencies {
  eventBus: EventBus;
  orchestrator: AIOrchestrator | null;
  costTracker: CostTracker | null;
  registry: PluginRegistry | null;
  config: TelegramBotConfig;
}

/**
 * Creates and configures the grammY bot with middleware chain:
 * auth → logging → rate-limit → commands → natural language fallback
 *
 * Uses long polling (NOT webhook) — ADR-001 loopback-only compliance.
 */
export function createBot(deps: BotDependencies): Bot {
  const { eventBus, orchestrator, costTracker, registry, config } = deps;

  if (!config.botToken) {
    throw new Error('Telegram bot token not configured. Set TELEGRAM_BOT_TOKEN.');
  }

  const bot = new Bot(config.botToken);

  // ── Middleware chain ──────────────────────────────────────────────

  // 1. Auth — whitelist check
  bot.use(createAuthMiddleware(config.allowedUserIds, eventBus));

  // 2. Logging — emit events
  bot.use(createLoggingMiddleware(eventBus));

  // 3. Rate limiting
  bot.use(createRateLimitMiddleware(config.rateLimit, eventBus));

  // ── Command handlers ──────────────────────────────────────────────

  bot.command('start', async (ctx) => {
    await ctx.reply(
      '<b>Welcome to ARI</b> — Your AI Operating System\n\n' +
      'Commands:\n' +
      '/ask — Ask ARI anything\n' +
      '/status — System status\n' +
      '/budget — Budget overview\n' +
      '/briefing — On-demand briefing\n' +
      '/crypto — Crypto prices &amp; portfolio\n' +
      '/pokemon — Pokemon TCG cards\n' +
      '/speak — Text to speech\n' +
      '/dev — Developer tools',
      { parse_mode: 'HTML' },
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      '<b>ARI Commands</b>\n\n' +
      '<b>General</b>\n' +
      '/ask &lt;question&gt; — Ask ARI\n' +
      '/status — System health\n' +
      '/budget — Budget status\n' +
      '/briefing — Get briefing\n\n' +
      '<b>Crypto</b>\n' +
      '/crypto price [coins...]\n' +
      '/crypto portfolio\n' +
      '/crypto alerts\n\n' +
      '<b>Pokemon TCG</b>\n' +
      '/pokemon search &lt;query&gt;\n' +
      '/pokemon collection\n\n' +
      '<b>Other</b>\n' +
      '/speak &lt;text&gt; — Text to speech\n' +
      '/dev — Developer tools',
      { parse_mode: 'HTML' },
    );
  });

  bot.command('ask', (ctx) => handleAsk(ctx, orchestrator));
  bot.command('status', (ctx) => handleStatus(ctx, registry));
  bot.command('budget', (ctx) => handleBudget(ctx, costTracker));
  bot.command('briefing', (ctx) => handleBriefing(ctx, registry));
  bot.command('crypto', (ctx) => handleCrypto(ctx, registry));
  bot.command('pokemon', (ctx) => handlePokemon(ctx, registry));
  bot.command('speak', (ctx) => handleSpeak(ctx, registry));
  bot.command('dev', (ctx) => handleDev(ctx));

  // ── Natural language fallback ──────────────────────────────────────

  bot.on('message:text', async (ctx) => {
    // Treat unrecognized messages as /ask queries
    if (orchestrator) {
      await handleAsk(ctx, orchestrator);
    } else {
      await ctx.reply('Use /help to see available commands.');
    }
  });

  // ── Voice message handler ──────────────────────────────────────────
  bot.on('message:voice', async (ctx) => {
    await ctx.reply(
      'Voice messages aren\'t supported yet — text me instead and I\'ll handle it.',
    );
  });

  bot.on('message:audio', async (ctx) => {
    await ctx.reply(
      'Audio files aren\'t supported yet — text me instead and I\'ll handle it.',
    );
  });

  return bot;
}
