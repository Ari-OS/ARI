import type { Context } from 'grammy';
import type { NotionInbox } from '../../../integrations/notion/inbox.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /task — Quick-capture tasks to Notion from Telegram
// ═══════════════════════════════════════════════════════════════════════════════

export function parseTaskArgs(text: string): {
  name: string;
  priority?: 'High' | 'Medium' | 'Low';
  dueDate?: Date;
} {
  const args = text.replace(/^\/task\s*/i, '').trim();

  if (!args) {
    return { name: '' };
  }

  let name = args;
  let priority: 'High' | 'Medium' | 'Low' | undefined;
  let dueDate: Date | undefined;

  // Extract priority flags: !high !medium !low or !h !m !l
  const priorityMatch = name.match(/\s+!(high|medium|low|h|m|l)\b/i);
  if (priorityMatch) {
    const flag = priorityMatch[1].toLowerCase();
    priority = flag === 'h' || flag === 'high' ? 'High'
      : flag === 'm' || flag === 'medium' ? 'Medium'
      : 'Low';
    name = name.replace(priorityMatch[0], '').trim();
  }

  // Extract due date: @today @tomorrow @monday etc.
  const dateMatch = name.match(/\s+@(today|tomorrow|mon|tue|wed|thu|fri|sat|sun)\b/i);
  if (dateMatch) {
    const dateStr = dateMatch[1].toLowerCase();
    const now = new Date();
    if (dateStr === 'today') {
      dueDate = now;
    } else if (dateStr === 'tomorrow') {
      dueDate = new Date(now.getTime() + 86_400_000);
    } else {
      // Day of week
      const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const targetDay = days.indexOf(dateStr);
      if (targetDay >= 0) {
        const currentDay = now.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        dueDate = new Date(now.getTime() + daysUntil * 86_400_000);
      }
    }
    name = name.replace(dateMatch[0], '').trim();
  }

  return { name, priority, dueDate };
}

export async function handleTask(
  ctx: Context,
  notionInbox: NotionInbox | null,
): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.replace(/^\/task\s*/i, '').trim();

  // No arguments — show help
  if (!args) {
    await ctx.reply(
      '<b>Quick Task Capture</b>\n\n' +
      'Usage:\n' +
      '<code>/task Buy groceries</code>\n' +
      '<code>/task Fix login bug !high</code>\n' +
      '<code>/task Call dentist @tomorrow</code>\n' +
      '<code>/task Review PR !medium @fri</code>\n\n' +
      'Priority: <code>!high</code> <code>!medium</code> <code>!low</code>\n' +
      'Due: <code>@today</code> <code>@tomorrow</code> <code>@mon</code>..<code>@sun</code>\n\n' +
      'Subcommands:\n' +
      '<code>/task list</code> — Show pending tasks\n' +
      '<code>/task done &lt;id&gt;</code> — Complete a task',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const inbox = notionInbox;

  if (!inbox || !inbox.hasTasksDb()) {
    await ctx.reply(
      'Task capture not configured.\n\n' +
      'Set <code>NOTION_TASKS_DATABASE_ID</code> in your .env to enable.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  // /task list — show pending tasks
  if (args.toLowerCase() === 'list') {
    const tasks = await inbox.getTasks({ status: 'Not started' });
    if (tasks.length === 0) {
      await ctx.reply('No pending tasks. Clean slate!');
      return;
    }

    const lines = tasks.slice(0, 15).map((t, i) => {
      const priority = t.priority ? ` [${t.priority}]` : '';
      return `${i + 1}. ${t.title}${priority}`;
    });

    const more = tasks.length > 15 ? `\n\n... and ${tasks.length - 15} more` : '';
    await ctx.reply(
      `<b>Pending Tasks (${tasks.length})</b>\n\n${lines.join('\n')}${more}`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  // /task done <partial-id> — complete a task
  if (args.toLowerCase().startsWith('done ')) {
    const idFragment = args.slice(5).trim();
    if (!idFragment) {
      await ctx.reply('Usage: <code>/task done &lt;task-id&gt;</code>', { parse_mode: 'HTML' });
      return;
    }

    // Find matching task by partial ID
    const tasks = await inbox.getTasks({ status: 'Not started' });
    const match = tasks.find((t) => t.id.includes(idFragment));

    if (!match) {
      await ctx.reply(`No pending task found matching "${idFragment}".`);
      return;
    }

    const success = await inbox.completeTask(match.id);
    if (success) {
      await ctx.reply(`Done: <b>${match.title}</b>`, { parse_mode: 'HTML' });
    } else {
      await ctx.reply('Failed to update task. Try again.');
    }
    return;
  }

  // Default: quick-capture a new task
  const parsed = parseTaskArgs(text);

  if (!parsed.name) {
    await ctx.reply('Task name required. Usage: <code>/task Buy groceries</code>', { parse_mode: 'HTML' });
    return;
  }

  const result = await inbox.quickTask(parsed.name, {
    priority: parsed.priority,
    dueDate: parsed.dueDate,
  });

  if (result) {
    const parts = [`<b>Task captured:</b> ${parsed.name}`];
    if (parsed.priority) parts.push(`Priority: ${parsed.priority}`);
    if (parsed.dueDate) parts.push(`Due: ${parsed.dueDate.toISOString().split('T')[0]}`);
    await ctx.reply(parts.join('\n'), { parse_mode: 'HTML' });
  } else {
    await ctx.reply('Failed to create task. Check Notion connection.');
  }
}
