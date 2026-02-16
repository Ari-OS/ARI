import type { Context } from 'grammy';
import type { PluginRegistry } from '../../../plugins/registry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /growth — Content pipeline status and idea generation
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleGrowth(
  ctx: Context,
  registry: PluginRegistry | null,
): Promise<void> {
  const text = ctx.message?.text ?? '';
  const subcommand = text.replace(/^\/growth\s*/i, '').trim().toLowerCase();

  if (!registry) {
    await ctx.reply('Plugin registry not available.');
    return;
  }

  try {
    if (subcommand === 'ideas') {
      await ctx.reply(
        '<b>Content Ideas</b>\n\n' +
        'Topic generation via autonomous agent coming soon.\n\n' +
        'For now, try:\n' +
        '- <code>/search [topic] trends 2026</code>\n' +
        '- <code>/knowledge search [topic]</code>',
        { parse_mode: 'HTML' },
      );
      return;
    }

    // Default: show content pipeline status
    await ctx.reply(
      '<b>Growth Pipeline</b>\n\n' +
      'Content engine integration coming soon.\n\n' +
      'Planned features:\n' +
      '• Draft generation status\n' +
      '• Published content count\n' +
      '• Engagement metrics\n' +
      '• Topic recommendations',
      { parse_mode: 'HTML' },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await ctx.reply(`Error: ${message}`);
  }
}
