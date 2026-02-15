import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import type { EventBus } from '../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type EntryType =
  | 'conversation'
  | 'task'
  | 'observation'
  | 'error'
  | 'decision'
  | 'learning'
  | 'correction';

export interface DailyNoteEntry {
  id: string;
  timestamp: string;
  type: EntryType;
  content: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface DailyNote {
  date: string;
  entries: DailyNoteEntry[];
  charCount: number;
  synthesized: boolean;
}

export interface WeeklyMemorySynthesis {
  weekId: string;
  dateRange: { start: string; end: string };
  patterns: string[];
  preferences: string[];
  stableKnowledge: string[];
  discarded: string[];
  entryCount: number;
  synthesizedAt: string;
}

export interface LongTermMemoryEntry {
  id: string;
  content: string;
  category: 'preference' | 'behavior' | 'knowledge' | 'correction' | 'relationship';
  confidence: number;
  firstObserved: string;
  lastConfirmed: string;
  confirmationCount: number;
  contradictionCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPORAL MEMORY
// ═══════════════════════════════════════════════════════════════════════════

const MAX_DAILY_CHARS = 65_000;
const MAX_WEEKLY_CHARS = 32_000;

/**
 * Temporal Memory — time-based memory synthesis.
 *
 * Daily captures → weekly synthesis → long-term stable knowledge.
 * Persists to ~/.ari/memories/{daily,weekly,long-term}/
 *
 * Layer 3 (Agents) — imports from Kernel only.
 */
export class TemporalMemory {
  private readonly eventBus: EventBus;
  private readonly baseDir: string;
  private readonly dailyDir: string;
  private readonly weeklyDir: string;
  private readonly longTermDir: string;

  private currentDaily: DailyNote | null = null;
  private longTermEntries: LongTermMemoryEntry[] = [];

  constructor(eventBus: EventBus, baseDir?: string) {
    this.eventBus = eventBus;
    this.baseDir = baseDir ?? path.join(homedir(), '.ari', 'memories');
    this.dailyDir = path.join(this.baseDir, 'daily');
    this.weeklyDir = path.join(this.baseDir, 'weekly');
    this.longTermDir = path.join(this.baseDir, 'long-term');
  }

  /**
   * Initialize directory structure and load today's notes.
   */
  async init(): Promise<void> {
    for (const dir of [this.dailyDir, this.weeklyDir, this.longTermDir]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // Load today's daily note
    const today = this.getDateString();
    this.currentDaily = await this.loadDailyNote(today);

    // Load long-term entries
    this.longTermEntries = await this.loadLongTermEntries();

    this.eventBus.emit('audit:log', {
      action: 'temporal_memory_init',
      agent: 'memory_keeper',
      trustLevel: 'system',
      details: {
        dailyEntries: this.currentDaily.entries.length,
        longTermEntries: this.longTermEntries.length,
      },
    });
  }

  /**
   * Capture a new entry in today's daily notes.
   */
  async capture(
    type: EntryType,
    content: string,
    source: string,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    const today = this.getDateString();

    // Ensure current daily is for today
    if (!this.currentDaily || this.currentDaily.date !== today) {
      this.currentDaily = await this.loadDailyNote(today);
    }

    // Check capacity
    if (this.currentDaily.charCount + content.length > MAX_DAILY_CHARS) {
      // Trim older entries to make room
      while (
        this.currentDaily.entries.length > 0 &&
        this.currentDaily.charCount + content.length > MAX_DAILY_CHARS
      ) {
        const removed = this.currentDaily.entries.shift();
        if (removed) {
          this.currentDaily.charCount -= removed.content.length;
        }
      }
    }

    const entry: DailyNoteEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      content,
      source,
      metadata,
    };

    this.currentDaily.entries.push(entry);
    this.currentDaily.charCount += content.length;

    await this.saveDailyNote(this.currentDaily);

    this.eventBus.emit('audit:log', {
      action: 'memory_captured',
      agent: 'memory_keeper',
      trustLevel: 'system',
      details: { type, source, charCount: content.length },
    });

    return entry.id;
  }

  /**
   * Get today's daily note entries.
   */
  getTodayEntries(): DailyNoteEntry[] {
    return this.currentDaily?.entries ?? [];
  }

  /**
   * Get daily note for a specific date.
   */
  async getDailyNote(date: string): Promise<DailyNote | null> {
    const filePath = path.join(this.dailyDir, `${date}.json`);
    if (!existsSync(filePath)) return null;
    return this.loadDailyNote(date);
  }

  /**
   * Synthesize a week's daily notes into a weekly summary.
   * Called on Sundays at 5 PM by the scheduler.
   */
  async synthesizeWeek(weekId?: string): Promise<WeeklyMemorySynthesis> {
    const now = new Date();
    const wId = weekId ?? this.getWeekId(now);

    // Get the last 7 days of daily notes
    const dailyNotes: DailyNote[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = this.getDateString(date);
      const note = await this.loadDailyNote(dateStr);
      if (note.entries.length > 0) {
        dailyNotes.push(note);
      }
    }

    // Extract patterns from all entries
    const allEntries = dailyNotes.flatMap(n => n.entries);
    const patterns = this.extractPatterns(allEntries);
    const preferences = this.extractPreferences(allEntries);
    const corrections = allEntries
      .filter(e => e.type === 'correction')
      .map(e => e.content);

    // Promote stable knowledge (observed 3+ times this week)
    const stableKnowledge: string[] = [];
    const discarded: string[] = [];

    for (const pattern of patterns) {
      const count = allEntries.filter(e =>
        e.content.toLowerCase().includes(pattern.toLowerCase()),
      ).length;
      if (count >= 3) {
        stableKnowledge.push(pattern);
      } else if (count === 1) {
        discarded.push(pattern);
      }
    }

    // Promote corrections to long-term
    for (const correction of corrections) {
      await this.promotToLongTerm(correction, 'correction');
    }

    // Promote stable preferences to long-term
    for (const pref of preferences) {
      await this.promotToLongTerm(pref, 'preference');
    }

    const synthesis: WeeklyMemorySynthesis = {
      weekId: wId,
      dateRange: {
        start: this.getDateString(new Date(now.getTime() - 6 * 86400000)),
        end: this.getDateString(now),
      },
      patterns,
      preferences,
      stableKnowledge,
      discarded,
      entryCount: allEntries.length,
      synthesizedAt: now.toISOString(),
    };

    // Save weekly synthesis
    await this.saveWeeklySynthesis(synthesis);

    // Mark daily notes as synthesized
    for (const note of dailyNotes) {
      note.synthesized = true;
      await this.saveDailyNote(note);
    }

    this.eventBus.emit('audit:log', {
      action: 'weekly_synthesis_complete',
      agent: 'memory_keeper',
      trustLevel: 'system',
      details: {
        weekId: wId,
        entryCount: allEntries.length,
        patternsFound: patterns.length,
        stableKnowledge: stableKnowledge.length,
      },
    });

    return synthesis;
  }

  /**
   * Promote a piece of knowledge to long-term memory.
   */
  async promotToLongTerm(
    content: string,
    category: LongTermMemoryEntry['category'],
  ): Promise<string> {
    // Check if similar entry already exists
    const existing = this.longTermEntries.find(e =>
      e.content.toLowerCase() === content.toLowerCase() ||
      this.similarity(e.content, content) > 0.8,
    );

    if (existing) {
      existing.lastConfirmed = new Date().toISOString();
      existing.confirmationCount++;
      await this.saveLongTermEntries();
      return existing.id;
    }

    const entry: LongTermMemoryEntry = {
      id: randomUUID(),
      content,
      category,
      confidence: 0.6,
      firstObserved: new Date().toISOString(),
      lastConfirmed: new Date().toISOString(),
      confirmationCount: 1,
      contradictionCount: 0,
    };

    this.longTermEntries.push(entry);
    await this.saveLongTermEntries();

    this.eventBus.emit('audit:log', {
      action: 'long_term_memory_promoted',
      agent: 'memory_keeper',
      trustLevel: 'system',
      details: { category, contentLength: content.length },
    });

    return entry.id;
  }

  /**
   * Get long-term entries by category.
   */
  getLongTermEntries(category?: LongTermMemoryEntry['category']): LongTermMemoryEntry[] {
    if (!category) return [...this.longTermEntries];
    return this.longTermEntries.filter(e => e.category === category);
  }

  /**
   * Record a contradiction (something was wrong).
   */
  async recordContradiction(entryId: string): Promise<void> {
    const entry = this.longTermEntries.find(e => e.id === entryId);
    if (entry) {
      entry.contradictionCount++;
      entry.confidence = Math.max(
        0,
        entry.confidence - 0.1 * (entry.contradictionCount / entry.confirmationCount),
      );
      await this.saveLongTermEntries();
    }
  }

  /**
   * Get memory statistics.
   */
  getStats(): {
    dailyEntriestoday: number;
    longTermEntries: number;
    byCategory: Record<string, number>;
  } {
    const byCategory: Record<string, number> = {};
    for (const entry of this.longTermEntries) {
      byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    }

    return {
      dailyEntriestoday: this.currentDaily?.entries.length ?? 0,
      longTermEntries: this.longTermEntries.length,
      byCategory,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private getDateString(date?: Date): string {
    const d = date ?? new Date();
    return d.toISOString().split('T')[0];
  }

  private getWeekId(date: Date): string {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor(
      (date.getTime() - startOfYear.getTime()) / 86400000,
    );
    const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  private loadDailyNote(date: string): Promise<DailyNote> {
    const filePath = path.join(this.dailyDir, `${date}.json`);
    if (existsSync(filePath)) {
      try {
        const raw = readFileSync(filePath, 'utf-8');
        return Promise.resolve(JSON.parse(raw) as DailyNote);
      } catch {
        // Corrupted file — start fresh
      }
    }
    return Promise.resolve({ date, entries: [], charCount: 0, synthesized: false });
  }

  private async saveDailyNote(note: DailyNote): Promise<void> {
    const filePath = path.join(this.dailyDir, `${note.date}.json`);
    await fs.writeFile(filePath, JSON.stringify(note, null, 2), 'utf-8');
  }

  private async saveWeeklySynthesis(synthesis: WeeklyMemorySynthesis): Promise<void> {
    const filePath = path.join(this.weeklyDir, `${synthesis.weekId}.json`);
    const data = JSON.stringify(synthesis, null, 2);
    if (data.length > MAX_WEEKLY_CHARS) {
      // Truncate patterns/discarded to fit
      synthesis.discarded = synthesis.discarded.slice(0, 5);
      synthesis.patterns = synthesis.patterns.slice(0, 20);
    }
    await fs.writeFile(filePath, JSON.stringify(synthesis, null, 2), 'utf-8');
  }

  private loadLongTermEntries(): Promise<LongTermMemoryEntry[]> {
    const filePath = path.join(this.longTermDir, 'entries.json');
    if (existsSync(filePath)) {
      try {
        const raw = readFileSync(filePath, 'utf-8');
        return Promise.resolve(JSON.parse(raw) as LongTermMemoryEntry[]);
      } catch {
        return Promise.resolve([]);
      }
    }
    return Promise.resolve([]);
  }

  private async saveLongTermEntries(): Promise<void> {
    const filePath = path.join(this.longTermDir, 'entries.json');
    await fs.writeFile(
      filePath,
      JSON.stringify(this.longTermEntries, null, 2),
      'utf-8',
    );
  }

  /**
   * Extract patterns from entries (simple keyword frequency analysis).
   */
  private extractPatterns(entries: DailyNoteEntry[]): string[] {
    const wordFreq = new Map<string, number>();
    const patterns: string[] = [];

    for (const entry of entries) {
      const words = entry.content.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 4) {
          wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
        }
      }
    }

    // Find recurring themes (words appearing 3+ times)
    const sorted = [...wordFreq.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    for (const [word] of sorted) {
      patterns.push(word);
    }

    return patterns;
  }

  /**
   * Extract preference-like entries.
   */
  private extractPreferences(entries: DailyNoteEntry[]): string[] {
    return entries
      .filter(
        e =>
          e.type === 'learning' ||
          e.type === 'correction' ||
          e.type === 'decision',
      )
      .map(e => e.content)
      .slice(0, 10);
  }

  /**
   * Simple string similarity (Jaccard index on words).
   */
  private similarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }
}
