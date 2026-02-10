import type { Context } from 'grammy';
import type { PluginRegistry } from '../../../plugins/registry.js';

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
      lines.push(c.content);
      lines.push('');
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  } catch (error) {
    await ctx.reply(`Error generating briefing: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
