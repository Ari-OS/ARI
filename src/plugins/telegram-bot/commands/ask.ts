import type { Context } from 'grammy';
import type { AIOrchestrator } from '../../../ai/orchestrator.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /ask — Natural language query → orchestrator
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleAsk(
  ctx: Context,
  orchestrator: AIOrchestrator | null,
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

  try {
    await ctx.reply('Thinking...');
    const response = await orchestrator.query(query, 'core');
    await ctx.reply(response || 'No response generated.', { parse_mode: 'HTML' });
  } catch (error) {
    await ctx.reply(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
