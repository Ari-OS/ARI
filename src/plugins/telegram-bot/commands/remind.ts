import type { Context } from 'grammy';
import type { EventBus } from '../../../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /remind — View and create Apple Reminders
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleRemind(
  ctx: Context,
  eventBus: EventBus,
): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.replace(/^\/remind\s*/i, '').trim();

  try {
    const { AppleReminders } = await import('../../../integrations/apple/reminders.js');
    const reminders = new AppleReminders();

    // No args or "list" — show pending reminders
    if (!args || args.toLowerCase() === 'list') {
      const pending = await reminders.getIncomplete();

      if (pending.length === 0) {
        await ctx.reply('<b>Reminders</b>\n\nNo pending reminders. Clean slate!', {
          parse_mode: 'HTML',
        });
        return;
      }

      const sorted = [...pending].sort((a, b) => {
        // Overdue first, then by due date, then by priority
        if (a.dueDate && b.dueDate) {
          return a.dueDate.getTime() - b.dueDate.getTime();
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.priority - b.priority;
      });

      const lines: string[] = ['<b>Reminders</b>', ''];

      for (const r of sorted.slice(0, 20)) {
        const priority = r.priority === 1 ? '!' : r.priority === 5 ? '-' : ' ';
        const due = r.dueDate
          ? ` <i>(${r.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</i>`
          : '';
        lines.push(`[${priority}] ${r.name}${due}`);
      }

      if (pending.length > 20) {
        lines.push('', `... and ${pending.length - 20} more`);
      }

      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });

      eventBus.emit('telegram:reminders_viewed', {
        userId: ctx.from?.id,
        reminderCount: pending.length,
      });

      return;
    }

    // Otherwise, create a new reminder
    // Note: AppleReminders doesn't have a create method in the current API
    // It only supports reading and completing. For now, we'll show a message.
    await ctx.reply(
      'Creating reminders via Telegram is not yet supported.\n\n' +
      'Use the Reminders app on macOS or iOS, or try <code>/task</code> for Notion tasks.',
      { parse_mode: 'HTML' },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('osascript')) {
      await ctx.reply('Reminders not available (requires macOS with Reminders app).');
    } else {
      await ctx.reply(`Error: ${message}`);
    }
  }
}
