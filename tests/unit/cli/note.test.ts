import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerNoteCommand } from '../../../src/cli/commands/note.js';
import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

const NOTES_PATH = path.join(homedir(), '.ari', 'notes.json');

describe('Note CLI', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let originalNotes: string | null = null;

  beforeEach(async () => {
    program = new Command();
    program.exitOverride();
    registerNoteCommand(program);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      originalNotes = await fs.readFile(NOTES_PATH, 'utf-8');
    } catch {
      originalNotes = null;
    }
    await fs.mkdir(path.dirname(NOTES_PATH), { recursive: true });
    await fs.writeFile(NOTES_PATH, JSON.stringify([], null, 2));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (originalNotes !== null) {
      await fs.writeFile(NOTES_PATH, originalNotes);
    } else {
      try { await fs.unlink(NOTES_PATH); } catch { /* ignore */ }
    }
  });

  it('should save a note', async () => {
    await program.parseAsync(['node', 'test', 'note', 'Meeting moved to 3pm']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Note saved');
    expect(output).toContain('Meeting moved to 3pm');
  });

  it('should save a note with a tag', async () => {
    await program.parseAsync(['node', 'test', 'note', 'New idea', '-t', 'ideas']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Note saved');
  });

  it('should list notes', async () => {
    await program.parseAsync(['node', 'test', 'note', 'First note']);
    consoleSpy.mockClear();
    await program.parseAsync(['node', 'test', 'notes']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('First note');
  });

  it('should show empty message when no notes', async () => {
    await program.parseAsync(['node', 'test', 'notes']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No notes');
  });

  it('should search notes by text', async () => {
    await program.parseAsync(['node', 'test', 'note', 'Meeting with team']);
    await program.parseAsync(['node', 'test', 'note', 'Buy groceries']);
    consoleSpy.mockClear();
    await program.parseAsync(['node', 'test', 'notes', 'search', 'meeting']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Meeting with team');
    expect(output).not.toContain('Buy groceries');
  });

  it('should search notes by tag', async () => {
    await program.parseAsync(['node', 'test', 'note', 'Tagged note', '-t', 'work']);
    await program.parseAsync(['node', 'test', 'note', 'Untagged note']);
    consoleSpy.mockClear();
    await program.parseAsync(['node', 'test', 'notes', 'search', 'work']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Tagged note');
  });

  it('should output JSON with --json flag', async () => {
    await program.parseAsync(['node', 'test', 'note', 'JSON test', '--json']);
    const jsonCall = consoleSpy.mock.calls.find(c => {
      try {
        const parsed = JSON.parse(c[0]);
        return parsed.id !== undefined;
      } catch { return false; }
    });
    expect(jsonCall).toBeDefined();
  });

  it('should limit display to 10 recent notes by default', async () => {
    // Add 12 notes
    for (let i = 1; i <= 12; i++) {
      await program.parseAsync(['node', 'test', 'note', `Note ${i}`]);
    }
    consoleSpy.mockClear();
    await program.parseAsync(['node', 'test', 'notes']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Showing 10 of 12');
  });

  it('should show all notes with --all flag', async () => {
    for (let i = 1; i <= 12; i++) {
      await program.parseAsync(['node', 'test', 'note', `Note ${i}`]);
    }
    consoleSpy.mockClear();
    await program.parseAsync(['node', 'test', 'notes', '--all']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('All Notes');
  });
});
