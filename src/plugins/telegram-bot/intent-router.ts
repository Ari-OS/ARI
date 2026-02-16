import type { Context } from 'grammy';
import type { AIOrchestrator } from '../../ai/orchestrator.js';
import type { EventBus } from '../../kernel/event-bus.js';

/**
 * Intent detection result with routing metadata.
 */
export interface IntentResult {
  intent: string;
  confidence: number;
  extractedEntities: Record<string, string>;
  routedVia: 'fast_path' | 'ai_classification';
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
}

/**
 * Two-tier intent router for Telegram messages.
 *
 * Tier 1 (Fast Path): Regex pattern matching — handles ~80% of messages with zero AI calls.
 * Tier 2 (Slow Path): AI classification via AIOrchestrator — for ambiguous input.
 *
 * Example usage:
 * ```typescript
 * const router = new IntentRouter(orchestrator, eventBus);
 *
 * router.registerRoute({
 *   intent: 'crypto_price',
 *   patterns: [
 *     /(?:price|cost|value) (?:of |for )?(\w+)/i,
 *     /what'?s (\w+) trading at/i,
 *   ],
 *   handler: async (ctx, match, entities) => {
 *     const coin = match?.[1] ?? entities.coin;
 *     await ctx.reply(`Fetching price for ${coin}...`);
 *   },
 *   priority: 100,
 * });
 *
 * router.setDefaultHandler(async (ctx) => {
 *   await ctx.reply('I didn\'t understand that.');
 * });
 *
 * await router.route(ctx);
 * ```
 */
export class IntentRouter {
  private routes: IntentRoute[] = [];
  private defaultHandler: ((ctx: Context) => Promise<void>) | null = null;

  constructor(
    private readonly orchestrator: AIOrchestrator | null,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Register an intent route with patterns and handler.
   * Routes are kept sorted by priority (descending).
   */
  registerRoute(route: IntentRoute): void {
    this.routes.push(route);
    // Keep sorted by priority descending
    this.routes.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Set the default handler for messages that don't match any intent.
   * Typically, this would be a conversational AI handler.
   */
  setDefaultHandler(handler: (ctx: Context) => Promise<void>): void {
    this.defaultHandler = handler;
  }

  /**
   * Route a message to the appropriate handler.
   *
   * Returns IntentResult if an intent was detected, null if the default handler was used.
   *
   * Routing algorithm:
   * 1. Try fast path (regex) for all registered routes (by priority)
   * 2. If no match, try AI classification (if orchestrator available)
   * 3. If still no match, fall back to default handler
   */
  async route(ctx: Context): Promise<IntentResult | null> {
    const text = ctx.message?.text ?? '';
    if (!text) return null;

    // 1. Fast path — regex pattern matching
    for (const route of this.routes) {
      for (const pattern of route.patterns) {
        const match = text.match(pattern);
        if (match) {
          const result: IntentResult = {
            intent: route.intent,
            confidence: 0.9,
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

    // 2. Slow path — AI classification (if orchestrator available)
    if (this.orchestrator) {
      try {
        const classification = await this.classifyWithAI(text);
        if (classification && classification.confidence > 0.7) {
          const matchedRoute = this.routes.find(r => r.intent === classification.intent);
          if (matchedRoute) {
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
        // AI classification failed — fall through to default
      }
    }

    // 3. Default handler (conversational AI)
    if (this.defaultHandler) {
      await this.defaultHandler(ctx);
    }
    return null;
  }

  /**
   * Route text that came from voice transcription or other non-message sources.
   * Uses the same routing logic but doesn't require ctx.message.text.
   */
  async routeText(ctx: Context, text: string): Promise<IntentResult | null> {
    // Fast path
    for (const route of this.routes) {
      for (const pattern of route.patterns) {
        const match = text.match(pattern);
        if (match) {
          const result: IntentResult = {
            intent: route.intent,
            confidence: 0.9,
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
        const classification = await this.classifyWithAI(text);
        if (classification && classification.confidence > 0.7) {
          const matchedRoute = this.routes.find(r => r.intent === classification.intent);
          if (matchedRoute) {
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
        // AI classification failed — fall through to default
      }
    }

    // Default handler
    if (this.defaultHandler) {
      await this.defaultHandler(ctx);
    }
    return null;
  }

  /**
   * Classify user intent using AI.
   * Returns null if classification fails or confidence is too low.
   */
  private async classifyWithAI(text: string): Promise<IntentResult | null> {
    if (!this.orchestrator) return null;

    const intentList = this.routes.map(r => r.intent).join(', ');
    const prompt = `Classify the user's intent. Available intents: ${intentList}, conversational.
Return ONLY a JSON object: {"intent": "...", "confidence": 0.0-1.0, "entities": {}}
User message: "${text.slice(0, 200)}"`;

    const response = await this.orchestrator.chat(
      [{ role: 'user', content: prompt }],
      'You are an intent classifier. Return only valid JSON.',
      'telegram',
    );

    try {
      const parsed = JSON.parse(response) as { intent: string; confidence: number; entities?: Record<string, string> };
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

  /**
   * Get all registered intent names.
   */
  getRegisteredIntents(): string[] {
    return this.routes.map(r => r.intent);
  }

  /**
   * Get the number of registered routes.
   */
  getRouteCount(): number {
    return this.routes.length;
  }
}
