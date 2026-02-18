import type { Context } from 'grammy';
import type { PluginRegistry } from '../../../plugins/registry.js';
import { formatForTelegram, splitTelegramMessage } from '../format.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /briefing — On-demand briefing from all plugins
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleBriefing(
  ctx: Context,
  registry: PluginRegistry | null,
): Promise<void> {
  if (!registry) {
    await ctx.reply('Plugin registry not available.');
    return;
  }

  try {
    const contributions = await registry.collectBriefings('evening');

    if (contributions.length === 0) {
      await ctx.reply('No briefing data available from plugins.');
      return;
    }

    const lines = ['<b>ARI Briefing</b>', ''];
    for (const c of contributions) {
      lines.push(`<b>${c.section}</b>`);
      lines.push(formatForTelegram(c.content));
      lines.push('');
    }

    const response = lines.join('\n');
    const chunks = splitTelegramMessage(response);
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: 'HTML' });
    }
  } catch (error) {
    await ctx.reply(`Error generating briefing: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
