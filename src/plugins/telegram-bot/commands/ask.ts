import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { AIOrchestrator } from '../../../ai/orchestrator.js';
import type { ChatSessionManager } from '../chat-session.js';
import { formatForTelegram, splitTelegramMessage } from '../format.js';
import { humanizeQuick } from '../../content-engine/humanizer.js';

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
    await ctx.replyWithChatAction('typing');

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

    // Humanize: strip AI-speak before formatting
    const humanized = humanizeQuick(response || 'No response generated.');
    // Convert markdown → Telegram HTML and split at 4096-char limit
    const formatted = formatForTelegram(humanized);
    const chunks = splitTelegramMessage(formatted);

    // Send all chunks; attach 👍/👎 feedback buttons to the last one
    const messageId = ctx.message?.message_id.toString() ?? Date.now().toString();
    const feedbackKb = new InlineKeyboard()
      .text('👍', `fb:positive:${messageId}`)
      .text('👎', `fb:negative:${messageId}`);

    for (let i = 0; i < chunks.length; i++) {
      if (i < chunks.length - 1) {
        await ctx.reply(chunks[i], { parse_mode: 'HTML' });
      } else {
        await ctx.reply(chunks[i], { parse_mode: 'HTML', reply_markup: feedbackKb });
      }
    }
  } catch (error) {
    await ctx.reply(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
