import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerRemindCommand } from '../../../src/cli/commands/remind.js';
import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

const REMINDERS_PATH = path.join(homedir(), '.ari', 'reminders.json');

describe('Remind CLI', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let originalReminders: string | null = null;

  beforeEach(async () => {
    program = new Command();
    program.exitOverride();
    registerRemindCommand(program);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);

    try {
      originalReminders = await fs.readFile(REMINDERS_PATH, 'utf-8');
    } catch {
      originalReminders = null;
    }
    await fs.mkdir(path.dirname(REMINDERS_PATH), { recursive: true });
    // remind.ts uses plain array storage, not wrapped object
    await fs.writeFile(REMINDERS_PATH, JSON.stringify([], null, 2));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (originalReminders !== null) {
      await fs.writeFile(REMINDERS_PATH, originalReminders);
    } else {
      try { await fs.unlink(REMINDERS_PATH); } catch { /* ignore */ }
    }
  });

  it('should create a reminder with --at flag', async () => {
    await program.parseAsync(['node', 'test', 'remind', 'Take medication', '--at', '9:00 AM']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Reminder created');
  });

  it('should create a daily recurring reminder', async () => {
    await program.parseAsync(['node', 'test', 'remind', 'Standup', '--at', '9:00 AM', '--daily']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Reminder created');

    // Verify it's stored as recurring
    const data = JSON.parse(await fs.readFile(REMINDERS_PATH, 'utf-8'));
    const reminders = Array.isArray(data) ? data : data.reminders;
    expect(reminders[0].recurring).toBe(true);
    expect(reminders[0].recurrence).toBe('daily');
  });

  it('should list reminders', async () => {
    await program.parseAsync(['node', 'test', 'remind', 'Test reminder', '--at', '10:00 AM']);
    consoleSpy.mockClear();
    await program.parseAsync(['node', 'test', 'remind', 'list']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Test reminder');
  });

  it('should show empty message when no reminders', async () => {
    await program.parseAsync(['node', 'test', 'remind', 'list']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toMatch(/no.*reminder/i);
  });

  it('should cancel a reminder', async () => {
    await program.parseAsync(['node', 'test', 'remind', 'Cancel me', '--at', '10:00 AM']);
    consoleSpy.mockClear();
    // cancel uses: remind cancel --at <id>
    await program.parseAsync(['node', 'test', 'remind', 'cancel', '--at', '1']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toMatch(/cancel/i);
  });

  it('should require --at flag for new reminders', async () => {
    await expect(
      program.parseAsync(['node', 'test', 'remind', 'No time set'])
    ).rejects.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    const errorOutput = errorSpy.mock.calls.map(c => c[0]).join('\n');
    expect(errorOutput).toContain('--at');
  });

  it('should output JSON with --json flag', async () => {
    await program.parseAsync(['node', 'test', 'remind', 'JSON test', '--at', '10:00 AM', '--json']);
    const jsonCall = consoleSpy.mock.calls.find(c => {
      try {
        const parsed = JSON.parse(c[0]);
        return parsed.id !== undefined;
      } catch { return false; }
    });
    expect(jsonCall).toBeDefined();
  });
});
