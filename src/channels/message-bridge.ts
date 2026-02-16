import type { EventBus } from '../kernel/event-bus.js';
import type { AuditLogger } from '../kernel/audit.js';
import type { AIOrchestrator } from '../ai/orchestrator.js';
import type { ChannelRouter } from './router.js';
import type { NormalizedMessage } from './types.js';

/**
 * ARI System Prompt — Static identity and behavioral contract.
 *
 * Design principles (from Anthropic's context engineering guide):
 * 1. System prompt = static identity ("employee handbook"). Never changes day-to-day.
 * 2. Dynamic context (today's tasks, current phase) is injected per-message.
 * 3. Structure beats length — organized sections, not long paragraphs.
 * 4. Every token here costs money on EVERY message. Be precise, not verbose.
 *
 * ~600 tokens. At 30 msgs/day: ~$0.01 on Haiku, ~$0.05 on Sonnet, ~$0.27 on Opus.
 *
 * NOTE: This is intentionally hardcoded for the personal deployment. The user context
 * could be loaded from config/env vars, but is kept inline for simplicity and to ensure
 * the system prompt is self-contained and immutable.
 */
const ARI_SYSTEM_PROMPT = `You are ARI (Artificial Reasoning Intelligence), your creator's Life Operating System.

<identity>
Personality: Direct, warm, proactive. Never sycophantic or verbose.
You maintain conversation context across messages.
</identity>

<user_context>
Schedule: Wake 6:30a, Work 7a-4p, Family 4-9p, Build 9p-midnight.
Interests: AI/ML, crypto (BTC), Pokemon TCG market, software architecture.
Learning style: Hands-on builder. Explain WHY, not just WHAT.
Budget: ~$100/mo AI tools. Every dollar must produce clear value.
</user_context>

<communication_rules>
- Lead with the answer. Elaborate only if asked.
- Match message length to question complexity.
- No filler phrases. No "Great question!" or "I'd be happy to help!"
- Lists for 3+ items. Recommend one option when presenting choices.
- Admit uncertainty clearly: "Not sure, but likely X because Y."
- Keep most messages under 500 characters.
- For prices: include % change. For tasks: include priority.
</communication_rules>

<capabilities>
Available now: conversation, analysis, recommendations, reasoning.
Coming soon: Notion tasks, Gmail, market monitoring, morning briefings.
If asked about unavailable features, be honest about what's planned vs what works today.
</capabilities>`;

/**
 * MessageBridge
 *
 * Connects channel inbound messages to AIOrchestrator and routes
 * responses back through the ChannelRouter. This is the glue between
 * the channel layer (Telegram, WebSocket, etc.) and ARI's AI pipeline.
 */
export class MessageBridge {
  private router: ChannelRouter;
  private orchestrator: AIOrchestrator;
  private eventBus: EventBus;
  private audit: AuditLogger;
  private conversations: Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>;

  constructor(
    router: ChannelRouter,
    orchestrator: AIOrchestrator,
    eventBus: EventBus,
    audit: AuditLogger,
  ) {
    this.router = router;
    this.orchestrator = orchestrator;
    this.eventBus = eventBus;
    this.audit = audit;
    this.conversations = new Map();
  }

  /**
   * Start listening for channel messages.
   * Subscribes to all channels via wildcard pattern.
   */
  start(): void {
    this.router.onMessage('*', async (message: NormalizedMessage) => {
      await this.handleMessage(message);
    });
  }

  /**
   * Handle an inbound message: send to AI, reply via channel.
   */
  private async handleMessage(message: NormalizedMessage): Promise<void> {
    const sessionKey = `${message.channelId}:${message.senderId}`;

    // Build conversation history
    if (!this.conversations.has(sessionKey)) {
      this.conversations.set(sessionKey, []);
    }
    const history = this.conversations.get(sessionKey)!;
    history.push({ role: 'user', content: message.content });

    // Keep last 20 messages for context window management
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    try {
      const startTime = Date.now();
      const response = await this.orchestrator.chat(
        history,
        ARI_SYSTEM_PROMPT,
      );
      const duration = Date.now() - startTime;

      // Add to conversation history
      history.push({ role: 'assistant', content: response });

      // Reply via channel router
      await this.router.reply(message, response);

      // Emit for monitoring
      this.eventBus.emit('message:response', {
        content: response,
        source: `channel:${message.channelId}`,
        timestamp: new Date(),
      });

      await this.audit.log('channel_ai_response', 'system', 'system', {
        channelId: message.channelId,
        senderId: message.senderId,
        responseLength: response.length,
        duration,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      await this.router.reply(message, `Sorry, I encountered an error: ${errorMsg}`);

      await this.audit.log('channel_ai_error', 'system', 'system', {
        channelId: message.channelId,
        senderId: message.senderId,
        error: errorMsg,
      });
    }
  }
}
