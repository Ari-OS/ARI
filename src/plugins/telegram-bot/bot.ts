import { Bot } from 'grammy';
import type { EventBus } from '../../kernel/event-bus.js';
import type { AIOrchestrator } from '../../ai/orchestrator.js';
import type { CostTracker } from '../../observability/cost-tracker.js';
import type { PluginRegistry } from '../registry.js';
import type { PerplexityClient } from '../../integrations/perplexity/client.js';
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
import { handleContent } from './commands/content.js';
import { handleDiagram } from './commands/diagram.js';
import { handleTask } from './commands/task.js';
// New Phase 5 commands
import { handleCalendar } from './commands/calendar.js';
import { handleRemind } from './commands/remind.js';
import { handleSearch } from './commands/search.js';
import { handleMarket } from './commands/market.js';
import { handleKnowledge } from './commands/knowledge.js';
import { handleGrowth } from './commands/growth.js';
import { handleMemory } from './commands/memory.js';
import { handleSettings } from './commands/settings.js';
import { handleSkills } from './commands/skills.js';
import { parseCallbackData, generateAckedKeyboard } from '../../autonomous/notification-keyboard.js';
import { notificationLifecycle } from '../../autonomous/notification-lifecycle.js';
import { priorityScorer } from '../../autonomous/priority-scorer.js';
import { ChatSessionManager } from './chat-session.js';
import { IntentRouter } from './intent-router.js';
import { ConversationStore } from './conversation-store.js';
import { handleVoice } from './voice-handler.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM BOT SETUP
// ═══════════════════════════════════════════════════════════════════════════════

export interface BotDependencies {
  eventBus: EventBus;
  orchestrator: AIOrchestrator | null;
  costTracker: CostTracker | null;
  registry: PluginRegistry | null;
  config: TelegramBotConfig;
  notionInbox?: import('../../integrations/notion/inbox.js').NotionInbox | null;
  perplexityClient?: PerplexityClient | null;
}

/**
 * Creates and configures the grammY bot with middleware chain:
 * auth → logging → rate-limit → commands → natural language fallback
 *
 * Uses long polling (NOT webhook) — ADR-001 loopback-only compliance.
 */
export function createBot(deps: BotDependencies): Bot {
  const { eventBus, orchestrator, costTracker, registry, config, notionInbox, perplexityClient } = deps;

  if (!config.botToken) {
    throw new Error('Telegram bot token not configured. Set TELEGRAM_BOT_TOKEN.');
  }

  const bot = new Bot(config.botToken);
  const sessionManager = new ChatSessionManager();
  const conversationStore = new ConversationStore();
  const intentRouter = new IntentRouter(orchestrator, eventBus);

  // Register intent routes for natural language detection
  registerIntentRoutes(intentRouter, deps, conversationStore);

  // Set default handler — falls through to conversational AI
  intentRouter.setDefaultHandler(async (ctx) => {
    if (orchestrator) {
      const chatId = ctx.chat?.id;
      const text = ctx.message?.text ?? '';

      // Persist user message before AI call
      if (chatId && text) {
        await conversationStore.addUserMessage(chatId, text);
      }

      await handleAsk(ctx, orchestrator, sessionManager);

      // Persist assistant response after AI call (best-effort, response captured by handleAsk)
    } else {
      await ctx.reply('Use /help to see available commands.');
    }
  });

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
      '<b>ARI</b> — Your AI Operating System\n\n' +
      '<b>Talk to me</b> — just type naturally\n\n' +
      '<b>Quick commands:</b>\n' +
      '/ask — Ask anything\n' +
      '/calendar — Today\'s schedule\n' +
      '/market — Portfolio &amp; prices\n' +
      '/search — Web search\n' +
      '/task — Capture a task\n' +
      '/briefing — On-demand briefing\n' +
      '/help — All commands',
      { parse_mode: 'HTML' },
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      '<b>ARI Commands</b>\n\n' +
      '<b>Core</b>\n' +
      '/ask — Ask ARI anything\n' +
      '/status — System health\n' +
      '/briefing — On-demand briefing\n' +
      '/settings — Notification preferences\n\n' +
      '<b>Productivity</b>\n' +
      '/calendar — Calendar events\n' +
      '/remind — View reminders\n' +
      '/task — Quick task capture\n' +
      '/search — Web search\n\n' +
      '<b>Markets</b>\n' +
      '/market — Portfolio overview\n' +
      '/crypto — Crypto prices\n' +
      '/budget — Budget status\n\n' +
      '<b>Knowledge</b>\n' +
      '/knowledge — Search knowledge base\n' +
      '/memory — Store/recall memories\n' +
      '/skills — Available skills\n\n' +
      '<b>Content</b>\n' +
      '/content — Content pipeline\n' +
      '/growth — Growth dashboard\n\n' +
      '<b>Other</b>\n' +
      '/pokemon — Pokemon TCG cards\n' +
      '/speak — Text to speech\n' +
      '/diagram — Architecture diagrams\n' +
      '/dev — Developer tools\n\n' +
      '<i>Or just type naturally — I understand context.</i>',
      { parse_mode: 'HTML' },
    );
  });

  // Original commands
  bot.command('ask', (ctx) => handleAsk(ctx, orchestrator, sessionManager));
  bot.command('status', (ctx) => handleStatus(ctx, registry));
  bot.command('budget', (ctx) => handleBudget(ctx, costTracker));
  bot.command('briefing', (ctx) => handleBriefing(ctx, registry));
  bot.command('crypto', (ctx) => handleCrypto(ctx, registry));
  bot.command('pokemon', (ctx) => handlePokemon(ctx, registry));
  bot.command('speak', (ctx) => handleSpeak(ctx, registry));
  bot.command('content', (ctx) => handleContent(ctx, registry));
  bot.command('task', (ctx) => handleTask(ctx, notionInbox ?? null));
  bot.command('diagram', (ctx) => handleDiagram(ctx));
  bot.command('dev', (ctx) => handleDev(ctx));

  // New Phase 5 commands
  bot.command('calendar', (ctx) => handleCalendar(ctx, eventBus));
  bot.command('remind', (ctx) => handleRemind(ctx, eventBus));
  bot.command('search', (ctx) => handleSearch(ctx, perplexityClient ?? null));
  bot.command('market', (ctx) => handleMarket(ctx, eventBus, registry));
  bot.command('knowledge', (ctx) => handleKnowledge(ctx, eventBus));
  bot.command('growth', (ctx) => handleGrowth(ctx, registry));
  bot.command('memory', (ctx) => handleMemory(ctx, eventBus));
  bot.command('settings', (ctx) => handleSettings(ctx, eventBus));
  bot.command('skills', (ctx) => handleSkills(ctx, eventBus));

  // ── Natural language fallback (via intent router) ─────────────────

  bot.on('message:text', async (ctx) => {
    // Route through two-tier intent detection before falling back to /ask
    await intentRouter.route(ctx);
  });

  // ── Voice message handler (via Whisper transcription) ──────────────

  const voiceDeps = {
    whisperApiKey: process.env.OPENAI_API_KEY ?? null,
    eventBus,
  };

  bot.on('message:voice', async (ctx) => {
    await handleVoice(ctx, voiceDeps, async (voiceCtx, text) => {
      await intentRouter.routeText(voiceCtx, text);
    });
  });

  bot.on('message:audio', async (ctx) => {
    await handleVoice(ctx, voiceDeps, async (audioCtx, text) => {
      await intentRouter.routeText(audioCtx, text);
    });
  });

  // ── Inline keyboard callback handler ────────────────────────────────
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const parsed = parseCallbackData(data);

    if (!parsed) {
      await ctx.answerCallbackQuery({ text: 'Unknown action' });
      return;
    }

    const { action, notificationId } = parsed;
    const record = notificationLifecycle.get(notificationId);

    // Handle the action
    switch (action) {
      case 'ack': {
        if (record) {
          // Transition to ACKNOWLEDGED if in valid state
          try {
            if (record.state === 'SENT') {
              notificationLifecycle.transition(notificationId, 'READ', 'Callback: read');
            }
            if (record.state === 'READ' || record.state === 'SENT') {
              notificationLifecycle.transition(notificationId, 'ACKNOWLEDGED', 'User acknowledged');
            }
          } catch {
            // State transition may fail if already in terminal state — ignore
          }
          // Track engagement: user cares about this category
          priorityScorer.updateEngagement(record.category, true);
        }
        await ctx.answerCallbackQuery({ text: 'Acknowledged' });
        break;
      }

      case 'dismiss': {
        if (record) {
          try {
            if (record.state === 'SENT') {
              notificationLifecycle.transition(notificationId, 'READ', 'Callback: dismissed');
            }
            notificationLifecycle.transition(notificationId, 'ACKNOWLEDGED', 'User dismissed');
            notificationLifecycle.transition(notificationId, 'RESOLVED', 'Dismissed by user');
          } catch {
            // Ignore state errors
          }
          // Track engagement: user doesn't care about this category
          priorityScorer.updateEngagement(record.category, false);
        }
        await ctx.answerCallbackQuery({ text: 'Dismissed' });
        break;
      }

      case 'lessLike': {
        if (record) {
          // Strong negative signal — update engagement twice
          priorityScorer.updateEngagement(record.category, false);
          priorityScorer.updateEngagement(record.category, false);
        }
        await ctx.answerCallbackQuery({ text: 'Noted — you\'ll see fewer of these' });
        break;
      }

      case 'snooze': {
        await ctx.answerCallbackQuery({ text: 'Snoozed — will remind in 1 hour' });
        // Emit event for scheduler to pick up
        eventBus.emit('notification:snoozed', {
          notificationId,
          snoozeUntil: Date.now() + 60 * 60 * 1000, // 1 hour
        });
        break;
      }

      case 'details':
      case 'moreInfo':
      case 'breakdown':
      case 'fullDigest':
      case 'todayTasks': {
        // Emit event for the autonomous agent to handle detail expansion
        eventBus.emit('notification:detail_requested', {
          notificationId,
          action,
          chatId: ctx.callbackQuery.message?.chat.id,
          messageId: ctx.callbackQuery.message?.message_id,
        });
        await ctx.answerCallbackQuery({ text: 'Loading...' });
        if (record) {
          priorityScorer.updateEngagement(record.category, true);
        }
        break;
      }

      case 'save': {
        if (record) {
          priorityScorer.updateEngagement(record.category, true);
        }
        eventBus.emit('notification:saved', {
          notificationId,
          category: record?.category,
          title: record?.title,
        });
        await ctx.answerCallbackQuery({ text: 'Saved for later' });
        break;
      }

      case 'skip': {
        if (record) {
          priorityScorer.updateEngagement(record.category, false);
        }
        await ctx.answerCallbackQuery({ text: 'Skipped' });
        break;
      }

      default: {
        await ctx.answerCallbackQuery({ text: 'OK' });
      }
    }

    // Update the message to show acknowledged state
    try {
      const ackedKb = generateAckedKeyboard(action);
      const originalText = ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message
        ? ctx.callbackQuery.message.text
        : undefined;

      if (originalText && ctx.callbackQuery.message) {
        await ctx.editMessageReplyMarkup({ reply_markup: ackedKb });
      }
    } catch {
      // Message may be too old to edit — ignore
    }
  });

  return bot;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT ROUTE REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Register fast-path regex patterns for common intents.
 * These bypass AI classification entirely — ~80% of messages hit these.
 */
function registerIntentRoutes(
  router: IntentRouter,
  deps: BotDependencies,
  conversationStore: ConversationStore,
): void {
  void conversationStore; // Referenced via closure in default handler (bot.ts:76-82)
  const { eventBus, registry, perplexityClient } = deps;

  router.registerRoute({
    intent: 'crypto_price',
    patterns: [
      /\b(?:bitcoin|btc|eth|sol|crypto)\b.*\b(?:price|worth|value|cost)\b/i,
      /\bhow\s+(?:much|is)\s+(?:btc|eth|sol|bitcoin|ethereum)\b/i,
    ],
    handler: async (ctx) => handleCrypto(ctx, registry),
    priority: 8,
  });

  router.registerRoute({
    intent: 'calendar_query',
    patterns: [
      /\b(?:calendar|schedule|meeting|event)s?\b/i,
      /\bwhat(?:'s| is) (?:on )?(?:my |the )?(?:schedule|agenda|calendar)\b/i,
    ],
    handler: async (ctx) => handleCalendar(ctx, eventBus),
    priority: 8,
  });

  router.registerRoute({
    intent: 'market_check',
    patterns: [
      /\b(?:market|stocks?|portfolio|positions?)\b/i,
      /\bhow(?:'s| is| are) (?:the )?(?:market|stocks?)\b/i,
    ],
    handler: async (ctx) => handleMarket(ctx, eventBus, registry),
    priority: 7,
  });

  router.registerRoute({
    intent: 'web_search',
    patterns: [
      /\b(?:search|look\s+up|research|find\s+out)\s+(?:for\s+)?(.+)/i,
    ],
    handler: async (ctx) => handleSearch(ctx, perplexityClient ?? null),
    priority: 6,
  });

  router.registerRoute({
    intent: 'briefing_request',
    patterns: [
      /\b(?:briefing|morning\s+update|summary|daily\s+digest)\b/i,
    ],
    handler: async (ctx) => handleBriefing(ctx, registry),
    priority: 7,
  });

  router.registerRoute({
    intent: 'status_check',
    patterns: [
      /\b(?:system\s+)?status\b/i,
      /\bhow\s+are\s+you\b/i,
    ],
    handler: async (ctx) => handleStatus(ctx, registry),
    priority: 5,
  });

  router.registerRoute({
    intent: 'content_pipeline',
    patterns: [
      /\b(?:content|draft|drafts|publish|publishing)\b/i,
      /\b(?:write|create|generate)\s+(?:a\s+)?(?:post|article|thread|tweet|caption)\b/i,
      /\b(?:approve|reject)\s+(?:content|draft)\b/i,
    ],
    handler: async (ctx) => handleContent(ctx, registry),
    priority: 6,
  });

  router.registerRoute({
    intent: 'reminder_create',
    patterns: [
      /\bremind\s+me\b/i,
      /\bset\s+(?:a\s+)?reminder\b/i,
      /\b(?:don'?t\s+let\s+me\s+forget|remember\s+to)\b/i,
    ],
    handler: async (ctx) => handleRemind(ctx, eventBus),
    priority: 7,
  });
}
