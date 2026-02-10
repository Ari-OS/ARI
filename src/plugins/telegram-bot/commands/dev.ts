import type { Context } from 'grammy';

// ═══════════════════════════════════════════════════════════════════════════════
// /dev — Developer commands placeholder (Phase 8)
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleDev(ctx: Context): Promise<void> {
  await ctx.reply(
    '<b>Developer Commands</b>\n\n' +
    'Coming in Phase 8:\n' +
    '• /dev pr — Check GitHub PRs\n' +
    '• /dev deploy — Trigger deployment\n' +
    '• /dev logs — View recent logs\n' +
    '• /dev test — Run test suite',
    { parse_mode: 'HTML' },
  );
}
