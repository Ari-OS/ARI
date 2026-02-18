import { Bot, InlineKeyboard } from 'grammy';
import type { Context } from 'grammy';
import type { EventBus } from '../../kernel/event-bus.js';
import type { AIOrchestrator } from '../../ai/orchestrator.js';
import type { CostTracker } from '../../observability/cost-tracker.js';
import type { PluginRegistry } from '../registry.js';
import { splitTelegramMessage } from '../../utils/format.js';
import type { IntentHandler } from './intent-router.js';
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

      // Typing indicator before slow AI call
      await ctx.replyWithChatAction('typing');

      // Persist user message to ConversationStore
      if (chatId && text) {
        await conversationStore.addUserMessage(chatId, text, 'conversational');
      }

      // Get AI response via handleAsk
      await handleAsk(ctx, orchestrator, sessionManager);

      // Persist assistant response (best-effort)
      // We don't have direct access to the response text here — handled by handleAsk
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
    const chatId = ctx.chat?.id;
    const text = ctx.message?.text ?? '';

    // Skip slash commands — they're handled above
    if (text.startsWith('/')) return;

    // Persist user message to ConversationStore for context
    if (chatId && text) {
      await conversationStore.addUserMessage(chatId, text);
    }

    // Load conversation history for AI classification context
    const history = chatId ? await conversationStore.getHistory(chatId) : [];

    // Route through two-tier intent detection before falling back to /ask
    await intentRouter.route(ctx, history);
  });

  // ── Voice message handler (via Whisper transcription) ──────────────

  const voiceDeps = {
    whisperApiKey: process.env.OPENAI_API_KEY ?? null,
    eventBus,
  };

  bot.on('message:voice', async (ctx) => {
    await handleVoice(ctx, voiceDeps, async (voiceCtx, text) => {
      const chatId = voiceCtx.chat?.id;
      const history = chatId ? await conversationStore.getHistory(chatId) : [];
      if (chatId && text) {
        await conversationStore.addUserMessage(chatId, text, 'voice');
      }
      await intentRouter.routeText(voiceCtx, text, history);
    });
  });

  bot.on('message:audio', async (ctx) => {
    await handleVoice(ctx, voiceDeps, async (audioCtx, text) => {
      const chatId = audioCtx.chat?.id;
      const history = chatId ? await conversationStore.getHistory(chatId) : [];
      if (chatId && text) {
        await conversationStore.addUserMessage(chatId, text, 'voice');
      }
      await intentRouter.routeText(audioCtx, text, history);
    });
  });

  // ── Inline keyboard callback handler ────────────────────────────────
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    // ── Feedback buttons (👍/👎) — handle before parseCallbackData ──────
    if (data.startsWith('fb:')) {
      const parts = data.split(':');
      const signal = parts[1] as 'positive' | 'negative';
      const msgId = parts[2] ?? data;
      const chatId = ctx.callbackQuery.message?.chat.id ?? 0;

      eventBus.emit('feedback:signal', {
        messageId: msgId,
        chatId,
        signal,
        timestamp: new Date().toISOString(),
      });

      await ctx.answerCallbackQuery({
        text: signal === 'positive' ? '👍 Thanks!' : '👎 Got it — I\'ll improve',
      });

      // Remove feedback buttons after tapping
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
      } catch {
        // Message too old — ignore
      }
      return;
    }

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
 * Wrap a handler to add typing indicator + send large messages in chunks.
 * All Phase 3 intent handlers use this for consistent UX.
 */
function withTyping(handler: IntentHandler): IntentHandler {
  return async (ctx, match, entities) => {
    await ctx.replyWithChatAction('typing');
    return handler(ctx, match, entities);
  };
}

/**
 * Send a response with 👍/👎 feedback buttons.
 * Emits feedback:signal to EventBus when Pryce taps.
 */
async function replyWithFeedback(ctx: Context, text: string, eventBus: EventBus): Promise<void> {
  const chunks = splitTelegramMessage(text);
  const messageId = ctx.message?.message_id.toString() ?? Date.now().toString();
  const chatId = ctx.chat?.id ?? 0;

  // Send all chunks; add buttons only to the last one
  for (let i = 0; i < chunks.length; i++) {
    if (i < chunks.length - 1) {
      await ctx.reply(chunks[i]);
    } else {
      const feedbackKb = new InlineKeyboard()
        .text('👍', `fb:positive:${messageId}`)
        .text('👎', `fb:negative:${messageId}`);

      await ctx.reply(chunks[i], { reply_markup: feedbackKb });
    }
  }

  // Wire callback data for feedback buttons (handled in bot.on('callback_query:data'))
  void eventBus; // Used in the callback handler registered separately
  void chatId;
}
void replyWithFeedback; // used in registerIntentRoutes below

/**
 * Register fast-path regex patterns for all 25 intents.
 * ~80% of messages match these — zero AI calls needed.
 * Handlers wrapped with withTyping() for consistent UX.
 */
function registerIntentRoutes(
  router: IntentRouter,
  deps: BotDependencies,
  conversationStore: ConversationStore,
): void {
  void conversationStore;
  const { eventBus, registry, perplexityClient, notionInbox, costTracker } = deps;

  // ── Tier 1: High-frequency, high-priority ────────────────────────────────

  router.registerRoute({
    intent: 'crypto_price',
    patterns: [
      /\b(?:bitcoin|btc|eth|sol|bnb|doge|xrp|ada|avax|link|matic|dot)\b.*\b(?:price|worth|value|cost|at)\b/i,
      /\bhow\s+(?:much|is)\s+(?:btc|eth|sol|bitcoin|ethereum)\b/i,
      /\b(?:crypto|coin)\s+prices?\b/i,
    ],
    handler: withTyping(async (ctx) => handleCrypto(ctx, registry)),
    priority: 10,
    description: '"BTC price" or "how much is ETH" — crypto prices',
  });

  router.registerRoute({
    intent: 'calendar_query',
    patterns: [
      /\b(?:calendar|schedule|meeting|event)s?\b/i,
      /\bwhat(?:'s| is) (?:on )?(?:my |the )?(?:schedule|agenda|calendar|today)\b/i,
      /\bwhat(?:'s| do) i have (?:today|this week|tomorrow)\b/i,
      /\b(?:today'?s?|tomorrow'?s?) (?:schedule|agenda|meetings?|events?)\b/i,
    ],
    handler: withTyping(async (ctx) => handleCalendar(ctx, eventBus)),
    priority: 10,
    description: '"What\'s on my calendar?" — schedule & events',
  });

  router.registerRoute({
    intent: 'reminder_create',
    patterns: [
      /\bremind\s+me\b/i,
      /\bset\s+(?:a\s+)?reminder\b/i,
      /\b(?:don'?t\s+let\s+me\s+forget|remember\s+to)\b/i,
      /\breminders?\b/i,
    ],
    handler: withTyping(async (ctx) => handleRemind(ctx, eventBus)),
    priority: 9,
    description: '"Remind me at 3pm" — set & view reminders',
  });

  router.registerRoute({
    intent: 'task_add',
    patterns: [
      /\b(?:add|create|capture|new)\s+(?:a\s+)?task\b/i,
      /\btask(?:\s*:\s*|\s+to\s+)(.+)/i,
      /\btodo(?:\s*:\s*|\s+)(.+)/i,
      /\b(?:i\s+need\s+to|gotta|have\s+to)\s+(.+)/i,
    ],
    handler: withTyping(async (ctx) => handleTask(ctx, notionInbox ?? null)),
    priority: 9,
    description: '"Add task: review report" — capture tasks',
  });

  router.registerRoute({
    intent: 'briefing_request',
    patterns: [
      /\b(?:briefing|morning\s+update|evening\s+summary|daily\s+digest)\b/i,
      /\bgive\s+me\s+(?:a\s+)?(?:brief|summary|update|overview)\b/i,
      /\bwhat(?:'s| did i| happened)\s+(?:today|overnight|this\s+morning)\b/i,
    ],
    handler: withTyping(async (ctx) => handleBriefing(ctx, registry)),
    priority: 9,
    description: '"Give me a briefing" — on-demand morning/evening brief',
  });

  // ── Tier 2: Frequent commands ─────────────────────────────────────────────

  router.registerRoute({
    intent: 'market_check',
    patterns: [
      /\b(?:stocks?|portfolio|holdings?|positions?|equities)\b/i,
      /\bhow(?:'s| is| are) (?:the )?(?:market|stocks?|my\s+portfolio)\b/i,
      /\b(?:aapl|tsla|nvda|spy|qqq|msft|amzn|googl)\b.*\b(?:price|at|up|down)\b/i,
      /\b(?:pnl|profit|loss|gains?)\b/i,
    ],
    handler: withTyping(async (ctx) => handleMarket(ctx, eventBus, registry)),
    priority: 8,
    description: '"How\'s my portfolio?" — stocks & market data',
  });

  router.registerRoute({
    intent: 'web_search',
    patterns: [
      /\b(?:search|look\s+up|google|research|find\s+out|look\s+into)\s+(?:for\s+)?(.+)/i,
      /\bwhat\s+is\s+(?:the\s+)?(?:latest|current|recent)\s+(.+)/i,
      /\btell\s+me\s+about\s+(.+)/i,
    ],
    handler: withTyping(async (ctx) => handleSearch(ctx, perplexityClient ?? null)),
    priority: 7,
    description: '"Search for X" or "look up Y" — web search',
  });

  router.registerRoute({
    intent: 'knowledge_query',
    patterns: [
      /\b(?:knowledge|what\s+do\s+i\s+know\s+about|search\s+my\s+notes?)\b/i,
      /\bdo\s+i\s+have\s+(?:any\s+)?(?:notes?|info|information)\s+(?:on|about)\s+(.+)/i,
    ],
    handler: withTyping(async (ctx) => handleKnowledge(ctx, eventBus)),
    priority: 7,
    description: '"What do I know about X?" — knowledge base search',
  });

  router.registerRoute({
    intent: 'memory_store',
    patterns: [
      /\b(?:remember|note|log|record|save)\s+(?:this|that)?\s*:\s*(.+)/i,
      /\b(?:store|save)\s+(?:this|that)\b/i,
      /^note(?:\s*:)?\s+(.+)/i,
    ],
    handler: withTyping(async (ctx) => handleMemory(ctx, eventBus)),
    priority: 8,
    description: '"Remember this: ..." — store to long-term memory',
  });

  router.registerRoute({
    intent: 'memory_recall',
    patterns: [
      /\bwhat\s+(?:did\s+i|do\s+i)\s+(?:say|know|remember|note(?:d)?)\s+about\s+(.+)/i,
      /\brecall\s+(.+)/i,
      /\bmy\s+(?:notes?|memories?)\s+(?:on|about)\s+(.+)/i,
    ],
    handler: withTyping(async (ctx) => handleMemory(ctx, eventBus)),
    priority: 7,
    description: '"What did I say about X?" — recall from memory',
  });

  router.registerRoute({
    intent: 'content_pipeline',
    patterns: [
      /\b(?:content|drafts?|publish|publishing|post)\b.*\b(?:pipeline|status|queue)\b/i,
      /\b(?:write|create|generate)\s+(?:a\s+)?(?:post|article|thread|x post|linkedin|caption)\b/i,
      /\b(?:approve|reject)\s+(?:content|draft)\b/i,
    ],
    handler: withTyping(async (ctx) => handleContent(ctx, registry)),
    priority: 7,
    description: '"Create a post about X" — content pipeline',
  });

  // ── Tier 3: Regular commands ──────────────────────────────────────────────

  router.registerRoute({
    intent: 'budget_check',
    patterns: [
      /\b(?:budget|spending|spend|api\s+cost|how\s+much\s+(?:have\s+i|did\s+i)\s+spent?)\b/i,
      /\b(?:daily|monthly|weekly)\s+(?:budget|cost|spend)\b/i,
    ],
    handler: withTyping(async (ctx) => handleBudget(ctx, costTracker)),
    priority: 6,
    description: '"Budget status" — API cost & budget',
  });

  router.registerRoute({
    intent: 'weather_query',
    patterns: [
      /\b(?:weather|forecast|temperature|rain|sunny|cloudy|humidity)\b/i,
      /\bwhat(?:'s| is) (?:the )?weather\b/i,
      /\b(?:should\s+i\s+bring\s+an?\s+umbrella|is\s+it\s+going\s+to\s+rain)\b/i,
    ],
    handler: withTyping(async (ctx) => handleSearch(ctx, perplexityClient ?? null)),
    priority: 6,
    description: '"What\'s the weather?" — weather forecast',
  });

  router.registerRoute({
    intent: 'task_list',
    patterns: [
      /\b(?:my\s+)?tasks?\s+(?:list|queue|today|this\s+week)\b/i,
      /\bwhat(?:'s| are) (?:my\s+)?(?:tasks?|todos?|to-?do)\b/i,
      /\bshow\s+(?:me\s+)?(?:my\s+)?tasks?\b/i,
    ],
    handler: withTyping(async (ctx) => handleTask(ctx, notionInbox ?? null)),
    priority: 6,
    description: '"My tasks today" — view task list',
  });

  router.registerRoute({
    intent: 'status_check',
    patterns: [
      /\b(?:system\s+)?status\b/i,
      /\bhow\s+are\s+you\b/i,
      /\b(?:ari\s+)?health(?:\s+check)?\b/i,
      /\bare\s+you\s+(?:running|working|ok|alive)\b/i,
    ],
    handler: withTyping(async (ctx) => handleStatus(ctx, registry)),
    priority: 5,
    description: '"System status" — ARI health check',
  });

  router.registerRoute({
    intent: 'growth_report',
    patterns: [
      /\b(?:growth|analytics|metrics|followers?|subscribers?|audience)\b/i,
      /\b(?:youtube|x\.com|instagram|linkedin)\s+(?:stats?|metrics?|growth)\b/i,
      /\bhow\s+(?:is|are)\s+(?:my\s+)?(?:channel|account|content)\s+(?:doing|performing)\b/i,
    ],
    handler: withTyping(async (ctx) => handleGrowth(ctx, registry)),
    priority: 6,
    description: '"Growth report" — social & content analytics',
  });

  router.registerRoute({
    intent: 'pokemon_check',
    patterns: [
      /\b(?:pokemon|pokémon|tcg|card\s+price|psa|graded\s+card)\b/i,
      /\bhow\s+much\s+is\s+(.+)\s+(?:pokemon|card)\b/i,
    ],
    handler: withTyping(async (ctx) => handlePokemon(ctx, registry)),
    priority: 5,
    description: '"Pokemon card prices" — TCG market data',
  });

  router.registerRoute({
    intent: 'speak_request',
    patterns: [
      /\b(?:say|speak|read\s+(?:this|that)\s+(?:aloud|out\s+loud)|voice)\s*[:]\s*(.+)/i,
      /\bconvert\s+(?:this\s+)?(?:to\s+)?(?:audio|speech|voice)\b/i,
    ],
    handler: withTyping(async (ctx) => handleSpeak(ctx, registry)),
    priority: 5,
    description: '"Say: your text here" — text to speech',
  });

  router.registerRoute({
    intent: 'skills_query',
    patterns: [
      /\b(?:skills?|capabilities|what\s+can\s+you\s+do|your\s+abilities)\b/i,
      /\bshow\s+(?:me\s+)?(?:your\s+)?skills?\b/i,
    ],
    handler: withTyping(async (ctx) => handleSkills(ctx, eventBus)),
    priority: 5,
    description: '"Show skills" — list ARI capabilities',
  });

  // ── Tier 4: Specific / Developer ──────────────────────────────────────────

  router.registerRoute({
    intent: 'portfolio_investment',
    patterns: [
      /\b(?:investment|invest|portfolio\s+update|allocation|rebalance)\b/i,
      /\b(?:should\s+i\s+buy|should\s+i\s+sell|investment\s+advice)\b/i,
    ],
    handler: withTyping(async (ctx) => handleMarket(ctx, eventBus, registry)),
    priority: 7,
    description: '"Investment analysis" — portfolio & investment intel',
  });

  router.registerRoute({
    intent: 'settings_update',
    patterns: [
      /\b(?:settings?|preferences?|notification\s+settings?|turn\s+(?:on|off))\b/i,
      /\b(?:configure|setup|set\s+up)\s+(.+)\b/i,
    ],
    handler: withTyping(async (ctx) => handleSettings(ctx, eventBus)),
    priority: 4,
    description: '"Notification settings" — configure ARI',
  });

  router.registerRoute({
    intent: 'dev_tools',
    patterns: [
      /\b(?:deploy|build|git|code|pr|pull\s+request|commit|branch)\b/i,
      /\brun\s+(?:tests?|the\s+build|linting?)\b/i,
      /\b(?:developer|debug|logs?)\b/i,
    ],
    handler: withTyping(async (ctx) => handleDev(ctx)),
    priority: 4,
    description: '"Git status" or "run tests" — developer tools',
  });

  router.registerRoute({
    intent: 'diagram_request',
    patterns: [
      /\b(?:diagram|flowchart|architecture|draw|visualize)\b/i,
      /\bshow\s+(?:me\s+)?(?:a\s+)?(?:diagram|architecture|flowchart)\b/i,
    ],
    handler: withTyping(async (ctx) => handleDiagram(ctx)),
    priority: 4,
    description: '"Architecture diagram" — generate diagrams',
  });

  router.registerRoute({
    intent: 'note_create',
    patterns: [
      /\b(?:quick\s+)?note\s*[:]\s*(.+)/i,
      /\b(?:jot\s+(?:this\s+)?down|write\s+this\s+down)\s*[:]\s*(.+)/i,
      /\b(?:log\s+this)\b/i,
    ],
    handler: withTyping(async (ctx) => handleTask(ctx, notionInbox ?? null)),
    priority: 6,
    description: '"Note: quick thought" — capture a note',
  });

  router.registerRoute({
    intent: 'help_request',
    patterns: [
      /\b(?:what\s+can\s+you\s+do|how\s+do\s+i|help\s+me\s+with|i\s+don'?t\s+know\s+how\s+to)\b/i,
      /\b(?:explain|how\s+does|what\s+is)\s+ari\b/i,
    ],
    handler: async (ctx) => {
      await ctx.reply(
        '<b>ARI — Your AI Operating System</b>\n\n' +
        'Just talk naturally — I understand context. Or use commands:\n\n' +
        '<b>📅 Time & Productivity</b>\n' +
        '/calendar, /remind, /task\n\n' +
        '<b>📈 Markets & Finance</b>\n' +
        '/market, /crypto, /budget\n\n' +
        '<b>🧠 Intelligence</b>\n' +
        '/briefing, /search, /knowledge\n\n' +
        '<b>📣 Content</b>\n' +
        '/content, /growth\n\n' +
        '<b>🔧 System</b>\n' +
        '/status, /settings, /skills\n\n' +
        '<i>Examples: "What\'s BTC at?" • "What\'s on my calendar?" • "Search for AI news"</i>',
        { parse_mode: 'HTML' },
      );
    },
    priority: 3,
    description: '"Help" or "what can you do?" — command guide',
  });
}
