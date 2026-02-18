import type { Context } from 'grammy';
import type { AIOrchestrator } from '../../../ai/orchestrator.js';
import type { ChatSessionManager } from '../chat-session.js';
import { formatForTelegram, splitTelegramMessage } from '../format.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /ask — Natural language query → orchestrator (with conversation memory)
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleAsk(
  ctx: Context,
  orchestrator: AIOrchestrator | null,
  sessionManager?: ChatSessionManager,
): Promise<void> {
  const text = ctx.message?.text ?? '';
  const query = text.replace(/^\/ask\s*/i, '').trim();

  if (!query) {
    await ctx.reply('Usage: /ask <your question>');
    return;
  }

  if (!orchestrator) {
    await ctx.reply('AI orchestrator not available.');
    return;
  }

  const chatId = ctx.chat?.id;

  try {
    await ctx.reply('Thinking...');

    let response: string;

    if (sessionManager && chatId) {
      // Conversational mode — pass full session history
      const messages = sessionManager.addUserMessage(chatId, query);
      const systemPrompt = await sessionManager.getSystemPrompt();

      response = await orchestrator.chat(
        messages.map((m) => ({ role: m.role, content: m.content })),
        systemPrompt,
        'core',
      );

      // Record ARI's response in session
      sessionManager.addAssistantMessage(chatId, response);
    } else {
      // Fallback — stateless query
      response = await orchestrator.query(query, 'core');
    }

    // Convert markdown → Telegram HTML and split if needed
    const formatted = formatForTelegram(response || 'No response generated.');
    const chunks = splitTelegramMessage(formatted);
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: 'HTML' });
    }
  } catch (error) {
    await ctx.reply(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
