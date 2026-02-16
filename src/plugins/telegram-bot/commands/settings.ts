import type { Context } from 'grammy';
import type { EventBus } from '../../../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /settings — View and manage notification preferences
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleSettings(
  ctx: Context,
  eventBus: EventBus,
): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.replace(/^\/settings\s*/i, '').trim().toLowerCase();

  if (!args) {
    // Show current settings
    await ctx.reply(
      '<b>Notification Settings</b>\n\n' +
      'Current preferences:\n' +
      '• Quiet hours: Off\n' +
      '• Verbose mode: On\n\n' +
      'Commands:\n' +
      '<code>/settings quiet on|off</code>\n' +
      '<code>/settings verbose on|off</code>\n\n' +
      '<i>Persistent settings coming in Phase B</i>',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const parts = args.split(/\s+/);
  const setting = parts[0];
  const value = parts[1];

  if (setting === 'quiet') {
    if (value === 'on' || value === 'off') {
      await ctx.reply(
        `<b>Settings Updated</b>\n\nQuiet hours: ${value.toUpperCase()}\n\n` +
        '<i>Note: Setting not persisted yet. Will reset on restart.</i>',
        { parse_mode: 'HTML' },
      );

      eventBus.emit('telegram:settings_changed', {
        userId: ctx.from?.id,
        setting: 'quiet',
        value,
      });
    } else {
      await ctx.reply('Usage: <code>/settings quiet on|off</code>', { parse_mode: 'HTML' });
    }
    return;
  }

  if (setting === 'verbose') {
    if (value === 'on' || value === 'off') {
      await ctx.reply(
        `<b>Settings Updated</b>\n\nVerbose mode: ${value.toUpperCase()}\n\n` +
        '<i>Note: Setting not persisted yet. Will reset on restart.</i>',
        { parse_mode: 'HTML' },
      );

      eventBus.emit('telegram:settings_changed', {
        userId: ctx.from?.id,
        setting: 'verbose',
        value,
      });
    } else {
      await ctx.reply('Usage: <code>/settings verbose on|off</code>', { parse_mode: 'HTML' });
    }
    return;
  }

  await ctx.reply('Unknown setting. Use <code>/settings</code> for help.', {
    parse_mode: 'HTML',
  });
}
