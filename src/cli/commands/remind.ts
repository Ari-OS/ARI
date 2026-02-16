import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { CONFIG_DIR } from '../../kernel/config.js';

interface Reminder {
  id: number;
  text: string;
  scheduledAt: string;
  recurring: boolean;
  recurrence?: 'daily' | 'weekly' | 'monthly';
  active: boolean;
  createdAt: string;
  lastTriggered?: string;
}

const REMINDERS_PATH = path.join(CONFIG_DIR, 'reminders.json');

/**
 * Ensures the reminders file exists and returns the current reminders.
 */
async function loadReminders(): Promise<Reminder[]> {
  try {
    // Ensure config directory exists
    await fs.mkdir(CONFIG_DIR, { recursive: true });

    const content = await fs.readFile(REMINDERS_PATH, 'utf-8');
    return JSON.parse(content) as Reminder[];
  } catch {
    // Return empty array if file doesn't exist
    return [];
  }
}

/**
 * Saves reminders to disk.
 */
async function saveReminders(reminders: Reminder[]): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(REMINDERS_PATH, JSON.stringify(reminders, null, 2), 'utf-8');
}

/**
 * Parses a time string into an ISO timestamp.
 * Supported formats:
 * - "9:00 AM" / "9:00 PM" — today at that time (or tomorrow if past)
 * - "tomorrow 2pm" — tomorrow at that time
 * - "YYYY-MM-DD HH:MM" — explicit datetime
 */
function parseTimeString(timeStr: string): string {
  const now = new Date();

  // Handle "tomorrow X" format
  if (timeStr.toLowerCase().includes('tomorrow')) {
    const timePart = timeStr.toLowerCase().replace('tomorrow', '').trim();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const parsedTime = parseSimpleTime(timePart);
    if (parsedTime) {
      tomorrow.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
      return tomorrow.toISOString();
    }
  }

  // Handle explicit datetime "YYYY-MM-DD HH:MM"
  if (timeStr.match(/^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}$/)) {
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // Handle simple time like "9:00 AM" or "9:00 PM"
  const parsedTime = parseSimpleTime(timeStr);
  if (parsedTime) {
    const target = new Date(now);
    target.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);

    // If time is in the past today, schedule for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    return target.toISOString();
  }

  throw new Error(`Unable to parse time: ${timeStr}`);
}

/**
 * Parses simple time formats like "9:00 AM", "2pm", "14:30"
 */
function parseSimpleTime(timeStr: string): { hours: number; minutes: number } | null {
  // Remove extra whitespace
  const cleaned = timeStr.trim().toLowerCase();

  // Match formats like "9:00 AM", "2:30 PM", "14:30"
  const match = cleaned.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridian = match[3];

  if (meridian === 'pm' && hours < 12) {
    hours += 12;
  } else if (meridian === 'am' && hours === 12) {
    hours = 0;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

/**
 * Formats a reminder for display.
 */
function formatReminder(reminder: Reminder, asJson: boolean): string {
  if (asJson) {
    return JSON.stringify(reminder, null, 2);
  }

  const scheduledDate = new Date(reminder.scheduledAt);
  const now = new Date();
  const isPastDue = scheduledDate < now && reminder.active;

  let color = chalk.gray;
  if (!reminder.active) {
    color = chalk.gray.strikethrough;
  } else if (isPastDue) {
    color = chalk.red;
  } else {
    color = chalk.green;
  }

  const recurrenceText = reminder.recurring ? ` [${reminder.recurrence}]` : '';
  const statusText = !reminder.active ? ' [CANCELED]' : isPastDue ? ' [PAST DUE]' : '';

  return color(
    `#${reminder.id}: "${reminder.text}" @ ${scheduledDate.toLocaleString()}${recurrenceText}${statusText}`
  );
}

/**
 * Registers the remind command with Commander.
 */
export function registerRemindCommand(program: Command): void {
  const remind = program
    .command('remind')
    .description('Manage reminders')
    .option('--json', 'Output in JSON format');

  // Create reminder
  remind
    .argument('[text]', 'Reminder text')
    .option('--at <time>', 'When to trigger the reminder')
    .option('--daily', 'Make this a daily recurring reminder')
    .option('--weekly', 'Make this a weekly recurring reminder')
    .option('--monthly', 'Make this a monthly recurring reminder')
    .action(async (text: string | undefined, options: { at?: string; daily?: boolean; weekly?: boolean; monthly?: boolean; json?: boolean }) => {
      try {
        // Handle subcommands
        if (text === 'list') {
          await listReminders(options.json ?? false);
          return;
        }

        if (text === 'cancel' && options.at) {
          const id = parseInt(options.at, 10);
          if (isNaN(id)) {
            console.error(chalk.red('Error: Invalid reminder ID'));
            process.exit(1);
          }
          await cancelReminder(id, options.json ?? false);
          return;
        }

        // Create reminder
        if (!text) {
          console.error(chalk.red('Error: Reminder text is required'));
          console.error(chalk.yellow('Usage: ari remind "Your reminder text" --at "9:00 AM"'));
          process.exit(1);
        }

        if (!options.at) {
          console.error(chalk.red('Error: --at flag is required'));
          console.error(chalk.yellow('Example: ari remind "Take medication" --at "9:00 AM"'));
          process.exit(1);
        }

        await createReminder(text, {
          at: options.at,
          daily: options.daily,
          weekly: options.weekly,
          monthly: options.monthly,
          json: options.json,
        });
      } catch (error) {
        console.error(chalk.red('Error: ') + (error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}

/**
 * Creates a new reminder.
 */
async function createReminder(
  text: string,
  options: { at: string; daily?: boolean; weekly?: boolean; monthly?: boolean; json?: boolean }
): Promise<void> {
  const reminders = await loadReminders();

  // Determine recurrence
  let recurring = false;
  let recurrence: 'daily' | 'weekly' | 'monthly' | undefined;

  if (options.daily) {
    recurring = true;
    recurrence = 'daily';
  } else if (options.weekly) {
    recurring = true;
    recurrence = 'weekly';
  } else if (options.monthly) {
    recurring = true;
    recurrence = 'monthly';
  }

  // Parse time
  const scheduledAt = parseTimeString(options.at);

  // Generate ID
  const maxId = reminders.length > 0 ? Math.max(...reminders.map((r) => r.id)) : 0;
  const newId = maxId + 1;

  // Create reminder
  const newReminder: Reminder = {
    id: newId,
    text,
    scheduledAt,
    recurring,
    recurrence,
    active: true,
    createdAt: new Date().toISOString(),
  };

  // Save
  reminders.push(newReminder);
  await saveReminders(reminders);

  // Output
  if (options.json) {
    console.log(JSON.stringify(newReminder, null, 2));
  } else {
    console.log(chalk.green('✓ Reminder created:'));
    console.log('  ' + formatReminder(newReminder, false));
  }
}

/**
 * Lists active reminders.
 */
async function listReminders(asJson: boolean): Promise<void> {
  const reminders = await loadReminders();
  const activeReminders = reminders.filter((r) => r.active);

  if (activeReminders.length === 0) {
    if (asJson) {
      console.log(JSON.stringify([], null, 2));
    } else {
      console.log(chalk.yellow('No active reminders'));
    }
    return;
  }

  if (asJson) {
    console.log(JSON.stringify(activeReminders, null, 2));
  } else {
    console.log(chalk.bold.blue('\nActive Reminders:\n'));
    activeReminders.forEach((reminder) => {
      console.log('  ' + formatReminder(reminder, false));
    });
    console.log();
  }
}

/**
 * Cancels a reminder by ID.
 */
async function cancelReminder(id: number, asJson: boolean): Promise<void> {
  const reminders = await loadReminders();
  const reminder = reminders.find((r) => r.id === id);

  if (!reminder) {
    console.error(chalk.red(`Error: Reminder #${id} not found`));
    process.exit(1);
  }

  if (!reminder.active) {
    console.error(chalk.yellow(`Warning: Reminder #${id} is already canceled`));
    process.exit(0);
  }

  // Mark as inactive
  reminder.active = false;
  await saveReminders(reminders);

  if (asJson) {
    console.log(JSON.stringify({ success: true, id }, null, 2));
  } else {
    console.log(chalk.green(`✓ Reminder #${id} canceled`));
  }
}
