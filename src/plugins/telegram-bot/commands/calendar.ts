import type { Context } from 'grammy';
import type { EventBus } from '../../../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /calendar — View calendar events (today/tomorrow/week)
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleCalendar(
  ctx: Context,
  eventBus: EventBus,
): Promise<void> {
  const text = ctx.message?.text ?? '';
  const subcommand = text.replace(/^\/calendar\s*/i, '').trim().toLowerCase();

  try {
    const { AppleCalendar } = await import('../../../integrations/apple/calendar.js');
    const calendar = new AppleCalendar();

    let events;
    let title = '<b>Today\'s Calendar</b>';

    if (subcommand === 'week') {
      events = await calendar.getWeekEvents();
      title = '<b>This Week\'s Calendar</b>';
    } else if (subcommand === 'tomorrow') {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 86_400_000);
      tomorrow.setHours(0, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(23, 59, 59, 999);
      events = await calendar.getEventsInRange(tomorrow, tomorrowEnd);
      title = '<b>Tomorrow\'s Calendar</b>';
    } else {
      events = await calendar.getTodayEvents();
    }

    if (events.length === 0) {
      await ctx.reply(`${title}\n\nNo events scheduled.`, { parse_mode: 'HTML' });
      return;
    }

    const sorted = [...events].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    const lines: string[] = [title, ''];

    for (const event of sorted.slice(0, 15)) {
      if (event.isAllDay) {
        lines.push(`<b>All day:</b> ${event.title}`);
      } else {
        const time = event.startDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/Indiana/Indianapolis',
        });
        const loc = event.location ? ` @ ${event.location}` : '';
        lines.push(`<b>${time}</b> — ${event.title}${loc}`);
      }
    }

    if (events.length > 15) {
      lines.push('', `... and ${events.length - 15} more`);
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });

    eventBus.emit('telegram:calendar_viewed', {
      userId: ctx.from?.id,
      subcommand,
      eventCount: events.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('osascript')) {
      await ctx.reply('Calendar not available (requires macOS with Calendar app).');
    } else {
      await ctx.reply(`Error: ${message}`);
    }
  }
}
