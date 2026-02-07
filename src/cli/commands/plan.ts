import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { CONFIG_DIR } from '../../kernel/config.js';
import { AIOrchestrator } from '../../ai/orchestrator.js';
import { EventBus } from '../../kernel/event-bus.js';

// ── Types (matching task.ts and note.ts storage formats) ─────────────────────

interface Task {
  id: number;
  text: string;
  priority: 'low' | 'normal' | 'high';
  status: 'open' | 'done';
  createdAt: string;
  completedAt?: string;
}

interface Note {
  id: number;
  text: string;
  tags: string[];
  createdAt: string;
}

interface Reminder {
  id: number;
  text: string;
  scheduledAt: string;
  recurring: boolean;
  recurrence?: 'daily' | 'weekly' | 'monthly';
  active: boolean;
  createdAt: string;
}

// ── Data Loading ─────────────────────────────────────────────────────────────

async function loadJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(path.join(CONFIG_DIR, filename), 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function loadOpenTasks(): Promise<Task[]> {
  const data = await loadJson<{ tasks: Task[] } | Task[]>('tasks.json', { tasks: [] });
  const tasks = Array.isArray(data) ? data : data.tasks;
  return tasks.filter((t) => t.status === 'open');
}

async function loadRecentNotes(limit: number = 10): Promise<Note[]> {
  const notes = await loadJson<Note[]>('notes.json', []);
  return notes
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

async function loadActiveReminders(): Promise<Reminder[]> {
  const data = await loadJson<{ reminders: Reminder[] } | Reminder[]>('reminders.json', { reminders: [] });
  const reminders = Array.isArray(data) ? data : data.reminders;
  return reminders.filter((r) => r.active);
}

async function loadRecentlyCompleted(days: number = 7): Promise<Task[]> {
  const data = await loadJson<{ tasks: Task[] } | Task[]>('tasks.json', { tasks: [] });
  const tasks = Array.isArray(data) ? data : data.tasks;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return tasks.filter(
    (t) => t.status === 'done' && t.completedAt && new Date(t.completedAt) >= cutoff,
  );
}

// ── Context Assembly ─────────────────────────────────────────────────────────

function buildPlanContext(
  tasks: Task[],
  notes: Note[],
  reminders: Reminder[],
  recentlyCompleted: Task[],
): string {
  const sections: string[] = [];

  if (tasks.length > 0) {
    const highPriority = tasks.filter((t) => t.priority === 'high');
    const normalPriority = tasks.filter((t) => t.priority === 'normal');
    const lowPriority = tasks.filter((t) => t.priority === 'low');

    let taskSection = '## Open Tasks\n';
    if (highPriority.length > 0) {
      taskSection += '\n**High Priority:**\n';
      highPriority.forEach((t) => { taskSection += `- ${t.text}\n`; });
    }
    if (normalPriority.length > 0) {
      taskSection += '\n**Normal Priority:**\n';
      normalPriority.forEach((t) => { taskSection += `- ${t.text}\n`; });
    }
    if (lowPriority.length > 0) {
      taskSection += '\n**Low Priority:**\n';
      lowPriority.forEach((t) => { taskSection += `- ${t.text}\n`; });
    }
    sections.push(taskSection);
  }

  if (reminders.length > 0) {
    let reminderSection = '## Active Reminders\n';
    reminders.forEach((r) => {
      const time = new Date(r.scheduledAt).toLocaleString();
      const recur = r.recurring ? ` (${r.recurrence})` : '';
      reminderSection += `- ${r.text} — ${time}${recur}\n`;
    });
    sections.push(reminderSection);
  }

  if (notes.length > 0) {
    let noteSection = '## Recent Notes\n';
    notes.forEach((n) => {
      const tags = n.tags.length > 0 ? ` [${n.tags.join(', ')}]` : '';
      noteSection += `- ${n.text}${tags}\n`;
    });
    sections.push(noteSection);
  }

  if (recentlyCompleted.length > 0) {
    let completedSection = '## Recently Completed (last 7 days)\n';
    recentlyCompleted.forEach((t) => {
      completedSection += `- ✓ ${t.text}\n`;
    });
    sections.push(completedSection);
  }

  if (sections.length === 0) {
    return 'No tasks, notes, or reminders found. The user is starting fresh.';
  }

  return sections.join('\n');
}

// ── System Prompts ───────────────────────────────────────────────────────────

const PLAN_TODAY_PROMPT = `You are ARI, a personal Life Operating System. Generate a focused daily plan.

Given the user's open tasks, recent notes, active reminders, and recently completed work, create a practical plan for today.

Guidelines:
- Be concise and actionable — no fluff
- Prioritize high-priority tasks first
- Suggest a reasonable order for the day
- Note any reminders that are relevant today
- If there are recently completed tasks, acknowledge progress briefly
- Keep it under 300 words
- Use bullet points and clear structure
- If there's nothing to do, suggest productive defaults

Format your response as a clean daily plan with time blocks if appropriate.`;

const PLAN_WEEK_PROMPT = `You are ARI, a personal Life Operating System. Generate a weekly overview.

Given the user's open tasks, recent notes, active reminders, and recently completed work, create a practical weekly plan.

Guidelines:
- Group tasks by theme or project if possible
- Distribute high-priority tasks across the week
- Note recurring reminders
- Suggest milestones or checkpoints
- Acknowledge completed work as momentum
- Keep it under 500 words
- Be practical, not aspirational`;

const PLAN_REVIEW_PROMPT = `You are ARI, a personal Life Operating System. Conduct a brief daily review.

Given the user's tasks (completed and remaining), notes, and reminders, provide a short end-of-day review.

Guidelines:
- Summarize what was accomplished today
- Note what's still open and whether it should carry over
- Highlight any patterns (overcommitting, procrastinating on specific types of tasks)
- Offer one suggestion for tomorrow
- Keep it under 200 words
- Be honest but encouraging`;

// ── Command Registration ────────────────────────────────────────────────────

export function registerPlanCommand(program: Command): void {
  const plan = program
    .command('plan')
    .description('AI-powered planning and review');

  plan
    .command('today')
    .description('Generate a plan for today')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      await generatePlan('today', PLAN_TODAY_PROMPT, options.json);
    });

  plan
    .command('week')
    .description('Generate a weekly overview')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      await generatePlan('week', PLAN_WEEK_PROMPT, options.json);
    });

  plan
    .command('review')
    .description('End-of-day review')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      await generatePlan('review', PLAN_REVIEW_PROMPT, options.json);
    });
}

async function generatePlan(
  mode: 'today' | 'week' | 'review',
  systemPrompt: string,
  json?: boolean,
): Promise<void> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error(chalk.red('Error: ANTHROPIC_API_KEY environment variable not set'));
      console.error('');
      console.error('Set it with:');
      console.error(chalk.dim('  export ANTHROPIC_API_KEY=your_key_here'));
      process.exit(1);
    }

    if (!json) {
      console.log('');
      console.log(chalk.dim('Gathering context...'));
    }

    // Load all user context in parallel
    const [tasks, notes, reminders, recentlyCompleted] = await Promise.all([
      loadOpenTasks(),
      loadRecentNotes(),
      loadActiveReminders(),
      loadRecentlyCompleted(),
    ]);

    const context = buildPlanContext(tasks, notes, reminders, recentlyCompleted);
    const now = new Date();
    const dateHeader = `Current date/time: ${now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

    const userMessage = `${dateHeader}\n\n${context}`;

    if (!json) {
      console.log(chalk.dim(`Found ${tasks.length} tasks, ${notes.length} notes, ${reminders.length} reminders`));
      console.log(chalk.dim('Thinking...'));
      console.log('');
    }

    // Create orchestrator and generate plan
    const eventBus = new EventBus();
    const orchestrator = new AIOrchestrator(eventBus, { apiKey });

    const response = await orchestrator.chat(
      [{ role: 'user', content: userMessage }],
      systemPrompt,
      'core',
    );

    if (json) {
      console.log(JSON.stringify({
        mode,
        plan: response,
        context: {
          openTasks: tasks.length,
          recentNotes: notes.length,
          activeReminders: reminders.length,
          recentlyCompleted: recentlyCompleted.length,
        },
        generatedAt: now.toISOString(),
      }, null, 2));
    } else {
      const header = mode === 'today' ? 'Daily Plan'
        : mode === 'week' ? 'Weekly Overview'
        : 'Daily Review';

      console.log(chalk.bold.cyan(`═══ ${header} ═══`));
      console.log('');
      console.log(response);
      console.log('');
      console.log(chalk.dim('─'.repeat(50)));
      console.log(chalk.dim(`Generated by ARI • ${now.toLocaleTimeString()}`));
      console.log('');
    }

    await orchestrator.shutdown();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!json) {
      console.error('');
      console.error(chalk.red('Error generating plan:'), message);
      console.error('');
    } else {
      console.error(JSON.stringify({ error: message }, null, 2));
    }
    process.exit(1);
  }
}
