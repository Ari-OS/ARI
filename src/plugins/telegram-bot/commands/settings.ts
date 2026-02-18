import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Context } from 'grammy';
import type { EventBus } from '../../../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /settings — View and manage notification preferences (persisted to disk)
// ═══════════════════════════════════════════════════════════════════════════════

const SETTINGS_DIR = join(homedir(), '.ari', 'settings');
const SETTINGS_FILE = join(SETTINGS_DIR, 'telegram.json');

interface TelegramSettings {
  quiet: boolean;
  verbose: boolean;
}

const DEFAULT_SETTINGS: TelegramSettings = {
  quiet: false,
  verbose: true,
};

async function loadSettings(): Promise<TelegramSettings> {
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    // Merge with defaults to handle partial/legacy files
    return { ...DEFAULT_SETTINGS, ...(parsed as Partial<TelegramSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings(settings: TelegramSettings): Promise<void> {
  await mkdir(SETTINGS_DIR, { recursive: true });
  await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

export async function handleSettings(
  ctx: Context,
  eventBus: EventBus,
): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.replace(/^\/settings\s*/i, '').trim().toLowerCase();

  const current = await loadSettings();

  if (!args) {
    // Show current settings
    await ctx.reply(
      '<b>Notification Settings</b>\n\n' +
      'Current preferences:\n' +
      `• Quiet hours: ${current.quiet ? 'On' : 'Off'}\n` +
      `• Verbose mode: ${current.verbose ? 'On' : 'Off'}\n\n` +
      'Commands:\n' +
      '<code>/settings quiet on|off</code>\n' +
      '<code>/settings verbose on|off</code>',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const parts = args.split(/\s+/);
  const setting = parts[0];
  const value = parts[1];

  if (setting === 'quiet') {
    if (value === 'on' || value === 'off') {
      const updated: TelegramSettings = { ...current, quiet: value === 'on' };
      await saveSettings(updated);

      await ctx.reply(
        `<b>Settings Updated</b>\n\nQuiet hours: ${value.toUpperCase()}`,
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
      const updated: TelegramSettings = { ...current, verbose: value === 'on' };
      await saveSettings(updated);

      await ctx.reply(
        `<b>Settings Updated</b>\n\nVerbose mode: ${value.toUpperCase()}`,
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
