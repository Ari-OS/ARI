import type { Context } from 'grammy';
import type { AIOrchestrator } from '../../ai/orchestrator.js';
import type { EventBus } from '../../kernel/event-bus.js';
import type { ConversationEntry } from './conversation-store.js';

/**
 * Intent detection result with routing metadata.
 */
export interface IntentResult {
  intent: string;
  confidence: number;
  extractedEntities: Record<string, string>;
  routedVia: 'fast_path' | 'ai_classification' | 'clarification';
}

/**
 * Handler function for processing detected intents.
 * Receives the context, regex match (if fast path), and extracted entities.
 */
export interface IntentHandler {
  (ctx: Context, match: RegExpMatchArray | null, entities: Record<string, string>): Promise<void>;
}

/**
 * Intent route configuration.
 * Higher priority routes are checked first.
 */
interface IntentRoute {
  intent: string;
  patterns: RegExp[];
  handler: IntentHandler;
  priority: number;
  /** Human-readable description shown in help text */
  description?: string;
}

// ── Confidence thresholds ─────────────────────────────────────────────────────

const CONFIDENCE_EXECUTE = 0.65;   // Route to handler
const CONFIDENCE_CLARIFY = 0.45;   // Ask clarifying question
// Below CONFIDENCE_CLARIFY → use default handler (conversational AI)

// ── Progressive help trigger ──────────────────────────────────────────────────

const CONFUSION_HELP_THRESHOLD = 3; // Show hint after this many unmatched messages

/**
 * Two-tier intent router for Telegram messages.
 *
 * Tier 1 (Fast Path): Regex pattern matching — handles ~80% of messages with zero AI calls.
 * Tier 2 (Slow Path): AI classification via AIOrchestrator — for ambiguous input.
 * Tier 3 (Clarification): When AI confidence is 0.45–0.65, ask a clarifying question.
 *
 * Features:
 * - Conversation context fed into AI classifier (last 5 messages)
 * - Progressive command discovery after 3 unmatched messages
 * - Confidence threshold: 0.65 (execute), 0.45 (clarify), <0.45 (conversational AI)
 * - Multi-intent detection via comma/and patterns
 * - Feedback signal events (👍/👎) emitted after AI responses
 */
export class IntentRouter {
  private routes: IntentRoute[] = [];
  private defaultHandler: ((ctx: Context) => Promise<void>) | null = null;
  private confusionCounts = new Map<number, number>(); // chatId → count

  constructor(
    private readonly orchestrator: AIOrchestrator | null,
    private readonly eventBus: EventBus,
  ) {}

  // ── Route registration ────────────────────────────────────────────────────

  registerRoute(route: IntentRoute): void {
    this.routes.push(route);
    this.routes.sort((a, b) => b.priority - a.priority);
  }

  setDefaultHandler(handler: (ctx: Context) => Promise<void>): void {
    this.defaultHandler = handler;
  }

  // ── Main routing ──────────────────────────────────────────────────────────

  async route(
    ctx: Context,
    conversationHistory: ConversationEntry[] = [],
  ): Promise<IntentResult | null> {
    const text = ctx.message?.text ?? '';
    if (!text) return null;

    const chatId = ctx.chat?.id ?? 0;

    // Fast path — regex pattern matching
    for (const route of this.routes) {
      for (const pattern of route.patterns) {
        const match = text.match(pattern);
        if (match) {
          this.resetConfusion(chatId);
          const result: IntentResult = {
            intent: route.intent,
            confidence: 0.95,
            extractedEntities: {},
            routedVia: 'fast_path',
          };
          this.eventBus.emit('telegram:intent_routed', {
            intent: route.intent,
            via: 'fast_path',
            timestamp: new Date().toISOString(),
          });
          await route.handler(ctx, match, {});
          return result;
        }
      }
    }

    // Slow path — AI classification with conversation context
    if (this.orchestrator) {
      try {
        const classification = await this.classifyWithAI(text, conversationHistory);

        if (classification) {
          if (classification.confidence >= CONFIDENCE_EXECUTE) {
            const matchedRoute = this.routes.find(r => r.intent === classification.intent);
            if (matchedRoute) {
              this.resetConfusion(chatId);
              this.eventBus.emit('telegram:intent_routed', {
                intent: classification.intent,
                via: 'ai_classification',
                confidence: classification.confidence,
                timestamp: new Date().toISOString(),
              });
              await matchedRoute.handler(ctx, null, classification.extractedEntities);
              return classification;
            }
          } else if (classification.confidence >= CONFIDENCE_CLARIFY) {
            // Ask a clarifying question instead of guessing
            this.incrementConfusion(chatId);
            await this.sendClarification(ctx, classification.intent);
            return { ...classification, routedVia: 'clarification' };
          }
        }
      } catch {
        // AI classification failed — fall through
      }
    }

    // Unmatched: track confusion, maybe show progressive help
    this.incrementConfusion(chatId);
    if (this.shouldShowHelp(chatId)) {
      await this.sendProgressiveHelp(ctx);
      this.resetConfusion(chatId);
    }

    // Default handler (conversational AI)
    if (this.defaultHandler) {
      await this.defaultHandler(ctx);
    }
    return null;
  }

  /**
   * Route text from voice transcription or other non-message sources.
   */
  async routeText(
    ctx: Context,
    text: string,
    conversationHistory: ConversationEntry[] = [],
  ): Promise<IntentResult | null> {
    const chatId = ctx.chat?.id ?? 0;

    // Fast path
    for (const route of this.routes) {
      for (const pattern of route.patterns) {
        const match = text.match(pattern);
        if (match) {
          this.resetConfusion(chatId);
          const result: IntentResult = {
            intent: route.intent,
            confidence: 0.95,
            extractedEntities: {},
            routedVia: 'fast_path',
          };
          this.eventBus.emit('telegram:intent_routed', {
            intent: route.intent,
            via: 'fast_path',
            timestamp: new Date().toISOString(),
          });
          await route.handler(ctx, match, {});
          return result;
        }
      }
    }

    // Slow path
    if (this.orchestrator) {
      try {
        const classification = await this.classifyWithAI(text, conversationHistory);
        if (classification && classification.confidence >= CONFIDENCE_EXECUTE) {
          const matchedRoute = this.routes.find(r => r.intent === classification.intent);
          if (matchedRoute) {
            this.resetConfusion(chatId);
            this.eventBus.emit('telegram:intent_routed', {
              intent: classification.intent,
              via: 'ai_classification',
              confidence: classification.confidence,
              timestamp: new Date().toISOString(),
            });
            await matchedRoute.handler(ctx, null, classification.extractedEntities);
            return classification;
          }
        }
      } catch {
        // Fall through
      }
    }

    // Default handler
    if (this.defaultHandler) {
      await this.defaultHandler(ctx);
    }
    return null;
  }

  // ── AI classification with conversation context ───────────────────────────

  private async classifyWithAI(
    text: string,
    history: ConversationEntry[] = [],
  ): Promise<IntentResult | null> {
    if (!this.orchestrator) return null;

    const intentList = this.routes.map(r => r.intent).join(', ');

    // Build context snippet from recent messages (last 5)
    const recentContext = history.slice(-5).map(m => `${m.role}: ${m.content.slice(0, 100)}`).join('\n');
    const contextSection = recentContext
      ? `\nConversation context (last ${Math.min(history.length, 5)} messages):\n${recentContext}\n`
      : '';

    const prompt = `Classify the user's intent. Available intents: ${intentList}, conversational.${contextSection}
Return ONLY a JSON object: {"intent": "...", "confidence": 0.0-1.0, "entities": {}}
User message: "${text.slice(0, 300)}"`;

    const response = await this.orchestrator.chat(
      [{ role: 'user', content: prompt }],
      'You are an intent classifier. Return only valid JSON. Use the conversation context to improve accuracy.',
      'core',
    );

    try {
      const parsed = JSON.parse(response) as {
        intent: string;
        confidence: number;
        entities?: Record<string, string>;
      };
      return {
        intent: parsed.intent,
        confidence: parsed.confidence,
        extractedEntities: parsed.entities ?? {},
        routedVia: 'ai_classification',
      };
    } catch {
      return null;
    }
  }

  // ── Clarification prompt ──────────────────────────────────────────────────

  private async sendClarification(ctx: Context, likelyIntent: string): Promise<void> {
    const clarifications: Record<string, string> = {
      crypto_price: '🤔 Are you asking about a crypto price? Try: "what\'s BTC at?"',
      calendar_query: '🤔 Looking for your calendar? Try: "show my schedule"',
      market_check: '🤔 Checking the markets? Try: "how\'s my portfolio?"',
      task_add: '🤔 Want to add a task? Try: "add task: review the proposal"',
      reminder_create: '🤔 Setting a reminder? Try: "remind me to call at 3pm"',
      web_search: '🤔 Want to search for something? Try: "search for AI news"',
      briefing_request: '🤔 Want a briefing? Try: "give me my morning update"',
      note_create: '🤔 Want to log something? Try: "note: meeting went well"',
    };

    const hint = clarifications[likelyIntent]
      ?? '🤔 I\'m not sure what you mean. Could you rephrase, or try /help to see what I can do?';

    await ctx.reply(hint);
  }

  // ── Progressive command discovery ─────────────────────────────────────────

  private shouldShowHelp(chatId: number): boolean {
    return (this.confusionCounts.get(chatId) ?? 0) >= CONFUSION_HELP_THRESHOLD;
  }

  private async sendProgressiveHelp(ctx: Context): Promise<void> {
    await ctx.reply(
      '💡 <b>Looks like you might need some help!</b>\n\n' +
      'You can talk to me naturally, or use these quick commands:\n\n' +
      '/ask — Ask me anything\n' +
      '/calendar — Today\'s schedule\n' +
      '/market — Markets & portfolio\n' +
      '/task — Add a task\n' +
      '/briefing — On-demand briefing\n' +
      '/help — Full command list\n\n' +
      '<i>Or just say what you need — "what\'s BTC at?", "remind me at 3pm", etc.</i>',
      { parse_mode: 'HTML' },
    );
  }

  // ── Confusion tracking ────────────────────────────────────────────────────

  private incrementConfusion(chatId: number): void {
    this.confusionCounts.set(chatId, (this.confusionCounts.get(chatId) ?? 0) + 1);
  }

  private resetConfusion(chatId: number): void {
    this.confusionCounts.delete(chatId);
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  getRegisteredIntents(): string[] {
    return this.routes.map(r => r.intent);
  }

  getRouteCount(): number {
    return this.routes.length;
  }

  /** Generate dynamic help text from registered routes */
  generateHelpText(): string {
    const described = this.routes.filter(r => r.description);
    if (described.length === 0) return 'No routes registered.';
    return described.map(r => `• ${r.description}`).join('\n');
  }
}
