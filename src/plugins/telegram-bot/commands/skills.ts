import type { Context } from 'grammy';
import type { EventBus } from '../../../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /skills — List and invoke available skills
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleSkills(
  ctx: Context,
  eventBus: EventBus,
): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.replace(/^\/skills\s*/i, '').trim();

  if (!args) {
    // List available skills
    await ctx.reply(
      '<b>Available Skills</b>\n\n' +
      '<code>diagram-generator</code> — Generate architecture diagrams\n' +
      '<code>crypto-tracker</code> — Track crypto prices and alerts\n' +
      '<code>task-manager</code> — Manage tasks and todos\n' +
      '<code>knowledge-indexer</code> — Index and search knowledge\n\n' +
      'Usage:\n' +
      '<code>/skills invoke [name]</code>\n\n' +
      '<i>Skill invocation via Telegram coming in Phase B</i>',
      { parse_mode: 'HTML' },
    );

    eventBus.emit('telegram:skills_listed', {
      userId: ctx.from?.id,
    });
    return;
  }

  const parts = args.split(/\s+/);
  const subcommand = parts[0].toLowerCase();
  const skillName = parts[1];

  if (subcommand === 'invoke') {
    if (!skillName) {
      await ctx.reply('Usage: <code>/skills invoke [name]</code>', { parse_mode: 'HTML' });
      return;
    }

    await ctx.reply(
      `<b>Skill Invocation</b>\n\n` +
      `Invoking skill: <code>${skillName}</code>\n\n` +
      '<i>Direct skill invocation coming in Phase B.\n' +
      'For now, use skill-specific commands:\n' +
      '• /crypto for crypto tracking\n' +
      '• /task for task management\n' +
      '• /knowledge for knowledge search</i>',
      { parse_mode: 'HTML' },
    );

    eventBus.emit('telegram:skill_invoked', {
      skill: skillName,
      confidence: 1.0,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  await ctx.reply('Unknown subcommand. Use <code>/skills</code> for help.', {
    parse_mode: 'HTML',
  });
}
