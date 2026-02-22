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

    let responseContent: string;
    let reasoningBlock = '';

    if (sessionManager && chatId) {
      // Conversational mode — pass full session history
      const messages = sessionManager.addUserMessage(chatId, query);
      const systemPrompt = await sessionManager.getSystemPrompt();

      const lastMessage = messages[messages.length - 1];
      const aiResponse = await orchestrator.execute({
        content: lastMessage?.content ?? '',
        category: 'chat',
        agent: 'core',
        trustLevel: 'system',
        priority: 'STANDARD',
        enableCaching: true,
        securitySensitive: false,
        systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      responseContent = aiResponse.content;
      const reasoning1 = (aiResponse as Record<string, unknown>).reasoning as string | undefined;
      reasoningBlock = reasoning1 ? `\n\n[Thought Process: ${reasoning1}]` : '';

      // Record ARI's response in session
      sessionManager.addAssistantMessage(chatId, responseContent);
    } else {
      // Fallback — stateless query
      const aiResponse = await orchestrator.execute({
        content: query,
        category: 'query',
        agent: 'core',
        trustLevel: 'system',
        priority: 'STANDARD',
        enableCaching: true,
        securitySensitive: false,
      });
      responseContent = aiResponse.content;
      const reasoning1 = (aiResponse as Record<string, unknown>).reasoning as string | undefined;
      reasoningBlock = reasoning1 ? `\n\n[Thought Process: ${reasoning1}]` : '';
    }

    // Humanize: strip AI-speak before formatting
    const humanized = humanizeQuick(responseContent || 'No response generated.');
    // Convert markdown → Telegram HTML and split at 4096-char limit
    const formatted = formatForTelegram(humanized + reasoningBlock);
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
