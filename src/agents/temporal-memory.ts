import { randomUUID } from 'crypto';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import type { EventBus } from '../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Entry types for daily notes
 */
export type DailyNoteEntryType =
  | 'conversation'
  | 'task'
  | 'observation'
  | 'error'
  | 'decision'
  | 'learning'
  | 'correction';

/**
 * A single entry in a daily note
 */
export interface DailyNoteEntry {
  timestamp: string;
  type: DailyNoteEntryType;
  content: string;
  source: string;
}

/**
 * Daily note - captures learnings throughout the day
 */
export interface DailyNote {
  date: string;
  entries: DailyNoteEntry[];
  charCount: number;
  synthesized: boolean;
}

/**
 * Weekly synthesis - consolidates patterns from daily notes
 */
export interface WeeklyMemorySynthesis {
  weekId: string;  // YYYY-WNN format
  patterns: string[];
  preferences: string[];
  stableKnowledge: string[];
  discarded: string[];
}

/**
 * Category for long-term memory entries
 */
export type LongTermCategory =
  | 'preference'
  | 'behavior'
  | 'knowledge'
  | 'correction'
  | 'relationship';

/**
 * Long-term memory entry - high-confidence, stable knowledge
 */
export interface LongTermMemoryEntry {
  id: string;
  content: string;
  category: LongTermCategory;
  confidence: number;
  firstObserved: string;
  lastConfirmed: string;
  confirmationCount: number;
  contradictionCount: number;
}

/**
 * Options for TemporalMemory constructor
 */
export interface TemporalMemoryOptions {
  storagePath?: string;
}

/**
 * Statistics about temporal memory state
 */
export interface TemporalMemoryStats {
  dailyNotes: number;
  weeklyReports: number;
  longTermEntries: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DAILY_CHAR_CAP = 65_000;
const CONFIDENCE_THRESHOLD_FOR_PROMOTION = 0.8;
const MIN_CONFIRMATIONS_FOR_PROMOTION = 3;
const CONTRADICTION_PENALTY = 0.15;
const CONFIRMATION_BOOST = 0.05;
const MAX_CONFIDENCE = 1.0;
const MIN_CONFIDENCE = 0.0;

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the current date in YYYY-MM-DD format
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get the week ID in YYYY-WNN format
 */
function getWeekId(date: Date = new Date()): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  );
  const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Check if a date is a Sunday
 */
function isSunday(date: Date = new Date()): boolean {
  return date.getDay() === 0;
}

/**
 * Get all dates in a week given the week ID
 */
function getDatesInWeek(weekId: string): string[] {
  const [yearStr, weekPart] = weekId.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekPart, 10);

  // Get January 1st of the year
  const jan1 = new Date(year, 0, 1);
  // Get the first Monday of the year
  const firstMonday = new Date(jan1);
  const dayOffset = (jan1.getDay() + 6) % 7; // Days until Monday
  firstMonday.setDate(jan1.getDate() - dayOffset + (week - 1) * 7);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(firstMonday);
    date.setDate(firstMonday.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}

/**
 * Simple text similarity for pattern matching
 */
function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let matches = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) matches++;
  }

  return matches / Math.max(wordsA.size, wordsB.size);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPORAL MEMORY CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * TemporalMemory - Evolving memory system with time-based consolidation
 *
 * Implements a three-tier memory architecture:
 * 1. Daily Notes - Capture all learnings throughout the day (65K char cap)
 * 2. Weekly Synthesis - Consolidate patterns every Sunday
 * 3. Long-term Memory - High-confidence patterns promoted for permanent storage
 *
 * This is an L3 (agents) layer component.
 */
export class TemporalMemory {
  private readonly eventBus: EventBus;
  private readonly storagePath: string;

  // In-memory caches
  private dailyNotes = new Map<string, DailyNote>();
  private weeklyReports = new Map<string, WeeklyMemorySynthesis>();
  private longTermMemory = new Map<string, LongTermMemoryEntry>();

  // Persistence state
  private dirty = false;
  private persistTimer: NodeJS.Timeout | null = null;
  private readonly PERSIST_DEBOUNCE_MS = 5000;

  constructor(eventBus: EventBus, options?: TemporalMemoryOptions) {
    this.eventBus = eventBus;
    this.storagePath = options?.storagePath ?? path.join(homedir(), '.ari', 'temporal-memory');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Initialize the temporal memory system
   * Loads existing data from disk and starts persistence timer
   */
  async init(): Promise<void> {
    // Create storage directory
    mkdirSync(this.storagePath, { recursive: true });
    mkdirSync(path.join(this.storagePath, 'daily'), { recursive: true });
    mkdirSync(path.join(this.storagePath, 'weekly'), { recursive: true });

    // Load existing data
    await this.loadFromDisk();

    // Start persistence timer
    this.persistTimer = setInterval(() => {
      if (this.dirty) {
        this.persistToDisk().catch(err => {
          this.eventBus.emit('audit:log', {
            action: 'temporal_memory:persist_failed',
            agent: 'memory_keeper',
            trustLevel: 'system',
            details: { error: err instanceof Error ? err.message : String(err) },
          });
        });
      }
    }, this.PERSIST_DEBOUNCE_MS);

    this.eventBus.emit('audit:log', {
      action: 'temporal_memory:initialized',
      agent: 'memory_keeper',
      trustLevel: 'system',
      details: {
        dailyNotes: this.dailyNotes.size,
        weeklyReports: this.weeklyReports.size,
        longTermEntries: this.longTermMemory.size,
      },
    });
  }

  /**
   * Graceful shutdown - persist pending changes
   */
  async shutdown(): Promise<void> {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }

    if (this.dirty) {
      await this.persistToDisk();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DAILY NOTES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Capture a new entry in today's daily note
   * Enforces the 65K character cap
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async captureEntry(entry: Omit<DailyNoteEntry, 'timestamp'>): Promise<void> {
    const date = getCurrentDate();
    const timestamp = new Date().toISOString();

    // Get or create daily note
    let dailyNote = this.dailyNotes.get(date);
    if (!dailyNote) {
      dailyNote = {
        date,
        entries: [],
        charCount: 0,
        synthesized: false,
      };
      this.dailyNotes.set(date, dailyNote);
    }

    // Check character cap
    const entryLength = entry.content.length + entry.source.length + entry.type.length;
    if (dailyNote.charCount + entryLength > DAILY_CHAR_CAP) {
      // Emit warning but don't add entry
      this.eventBus.emit('audit:log', {
        action: 'temporal_memory:daily_cap_reached',
        agent: 'memory_keeper',
        trustLevel: 'system',
        details: { date, charCount: dailyNote.charCount, attemptedAdd: entryLength },
      });
      return;
    }

    // Add entry
    const fullEntry: DailyNoteEntry = {
      timestamp,
      type: entry.type,
      content: entry.content,
      source: entry.source,
    };

    dailyNote.entries.push(fullEntry);
    dailyNote.charCount += entryLength;
    this.dirty = true;

    // Emit event
    this.eventBus.emit('memory:daily_captured', {
      date,
      entryCount: dailyNote.entries.length,
    });
  }

  /**
   * Get a daily note by date
   * @param date Optional date in YYYY-MM-DD format, defaults to today
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getDailyNote(date?: string): Promise<DailyNote | null> {
    const targetDate = date ?? getCurrentDate();
    return this.dailyNotes.get(targetDate) ?? null;
  }

  /**
   * Get all daily notes in a date range
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getDailyNotesInRange(startDate: string, endDate: string): Promise<DailyNote[]> {
    const notes: DailyNote[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (const [dateKey, note] of this.dailyNotes) {
      const noteDate = new Date(dateKey);
      if (noteDate >= start && noteDate <= end) {
        notes.push(note);
      }
    }

    return notes.sort((a, b) => a.date.localeCompare(b.date));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WEEKLY SYNTHESIS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Synthesize a week's daily notes into patterns
   * Should be called on Sunday or manually for a specific week
   * @param weekId Optional week ID in YYYY-WNN format, defaults to current week
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async synthesizeWeek(weekId?: string): Promise<WeeklyMemorySynthesis> {
    const targetWeekId = weekId ?? getWeekId();

    // Check if already synthesized
    const existing = this.weeklyReports.get(targetWeekId);
    if (existing) {
      return existing;
    }

    // Get all daily notes for the week
    const datesInWeek = getDatesInWeek(targetWeekId);
    const weekNotes: DailyNote[] = [];

    for (const date of datesInWeek) {
      const note = this.dailyNotes.get(date);
      if (note) {
        weekNotes.push(note);
      }
    }

    // Extract patterns from entries
    const allEntries = weekNotes.flatMap(n => n.entries);
    const patterns = this.extractPatterns(allEntries);
    const preferences = this.extractPreferences(allEntries);
    const stableKnowledge = this.extractStableKnowledge(allEntries);
    const discarded = this.extractDiscardedPatterns(allEntries);

    // Create synthesis
    const synthesis: WeeklyMemorySynthesis = {
      weekId: targetWeekId,
      patterns,
      preferences,
      stableKnowledge,
      discarded,
    };

    // Mark daily notes as synthesized
    for (const note of weekNotes) {
      note.synthesized = true;
    }

    // Store synthesis
    this.weeklyReports.set(targetWeekId, synthesis);
    this.dirty = true;

    // Emit event
    this.eventBus.emit('memory:weekly_synthesized', {
      weekId: targetWeekId,
      patternCount: patterns.length,
    });

    return synthesis;
  }

  /**
   * Get a weekly synthesis by week ID
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getWeeklySynthesis(weekId: string): Promise<WeeklyMemorySynthesis | null> {
    return this.weeklyReports.get(weekId) ?? null;
  }

  /**
   * Extract repeating patterns from entries
   */
  private extractPatterns(entries: DailyNoteEntry[]): string[] {
    const patterns: string[] = [];
    const contentGroups = new Map<string, number>();

    // Group similar content
    for (const entry of entries) {
      if (entry.type === 'learning' || entry.type === 'observation') {
        // Find similar existing pattern
        let found = false;
        for (const [pattern, count] of contentGroups) {
          if (textSimilarity(entry.content, pattern) > 0.5) {
            contentGroups.set(pattern, count + 1);
            found = true;
            break;
          }
        }
        if (!found) {
          contentGroups.set(entry.content, 1);
        }
      }
    }

    // Patterns are those that appear multiple times
    for (const [content, count] of contentGroups) {
      if (count >= 2) {
        patterns.push(content);
      }
    }

    return patterns;
  }

  /**
   * Extract preference-related entries
   */
  private extractPreferences(entries: DailyNoteEntry[]): string[] {
    return entries
      .filter(e => e.type === 'decision' || e.type === 'learning')
      .filter(e => e.content.toLowerCase().includes('prefer') ||
                   e.content.toLowerCase().includes('like') ||
                   e.content.toLowerCase().includes('want'))
      .map(e => e.content);
  }

  /**
   * Extract stable knowledge (high-frequency, consistent patterns)
   */
  private extractStableKnowledge(entries: DailyNoteEntry[]): string[] {
    const knowledgeCount = new Map<string, number>();

    for (const entry of entries) {
      if (entry.type === 'learning' || entry.type === 'observation') {
        // Normalize content for grouping
        const normalized = entry.content.toLowerCase().trim();
        knowledgeCount.set(normalized, (knowledgeCount.get(normalized) ?? 0) + 1);
      }
    }

    // Stable knowledge appears 3+ times
    const stable: string[] = [];
    for (const [content, count] of knowledgeCount) {
      if (count >= 3) {
        stable.push(content);
      }
    }

    return stable;
  }

  /**
   * Extract discarded patterns (errors, corrections that indicate wrong assumptions)
   */
  private extractDiscardedPatterns(entries: DailyNoteEntry[]): string[] {
    return entries
      .filter(e => e.type === 'error' || e.type === 'correction')
      .map(e => e.content);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LONG-TERM MEMORY
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Promote entries to long-term memory
   * @param entries Array of content strings to promote
   * @returns Number of entries actually promoted
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async promoteToLongTerm(entries: string[]): Promise<number> {
    let promoted = 0;

    for (const content of entries) {
      // Check if similar entry already exists
      let existingEntry: LongTermMemoryEntry | null = null;
      for (const entry of this.longTermMemory.values()) {
        if (textSimilarity(entry.content, content) > 0.7) {
          existingEntry = entry;
          break;
        }
      }

      if (existingEntry) {
        // Update existing entry
        existingEntry.confirmationCount++;
        existingEntry.lastConfirmed = new Date().toISOString();
        existingEntry.confidence = Math.min(
          MAX_CONFIDENCE,
          existingEntry.confidence + CONFIRMATION_BOOST
        );
      } else {
        // Create new entry
        const category = this.categorizeContent(content);
        const newEntry: LongTermMemoryEntry = {
          id: randomUUID(),
          content,
          category,
          confidence: CONFIDENCE_THRESHOLD_FOR_PROMOTION,
          firstObserved: new Date().toISOString(),
          lastConfirmed: new Date().toISOString(),
          confirmationCount: 1,
          contradictionCount: 0,
        };

        this.longTermMemory.set(newEntry.id, newEntry);
        promoted++;

        // Emit event
        this.eventBus.emit('memory:promoted_long_term', {
          entryId: newEntry.id,
          confidence: newEntry.confidence,
        });
      }
    }

    this.dirty = true;
    return promoted;
  }

  /**
   * Categorize content for long-term memory
   */
  private categorizeContent(content: string): LongTermCategory {
    const lower = content.toLowerCase();

    if (lower.includes('prefer') || lower.includes('like') || lower.includes('want')) {
      return 'preference';
    }
    if (lower.includes('always') || lower.includes('never') || lower.includes('should')) {
      return 'behavior';
    }
    if (lower.includes('fixed') || lower.includes('corrected') || lower.includes('wrong')) {
      return 'correction';
    }
    if (lower.includes('user') || lower.includes('person') || lower.includes('team')) {
      return 'relationship';
    }
    return 'knowledge';
  }

  /**
   * Search long-term memory
   * @param query Search query string
   * @returns Matching entries sorted by relevance
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async searchLongTerm(query: string): Promise<LongTermMemoryEntry[]> {
    const results: Array<{ entry: LongTermMemoryEntry; score: number }> = [];

    for (const entry of this.longTermMemory.values()) {
      const similarity = textSimilarity(query, entry.content);
      if (similarity > 0.1) {
        // Factor in confidence and confirmation count
        const score = similarity * entry.confidence *
          Math.log2(entry.confirmationCount + 1);
        results.push({ entry, score });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.map(r => r.entry);
  }

  /**
   * Get a long-term memory entry by ID
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getLongTermEntry(id: string): Promise<LongTermMemoryEntry | null> {
    return this.longTermMemory.get(id) ?? null;
  }

  /**
   * Record a contradiction to a long-term memory entry
   * Decreases confidence
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async recordContradiction(id: string): Promise<void> {
    const entry = this.longTermMemory.get(id);
    if (!entry) return;

    entry.contradictionCount++;
    entry.confidence = Math.max(MIN_CONFIDENCE, entry.confidence - CONTRADICTION_PENALTY);
    this.dirty = true;

    // If confidence drops too low, consider removing
    if (entry.confidence < 0.2 && entry.contradictionCount > entry.confirmationCount) {
      this.longTermMemory.delete(id);
      this.eventBus.emit('audit:log', {
        action: 'temporal_memory:entry_removed',
        agent: 'memory_keeper',
        trustLevel: 'system',
        details: { id, reason: 'low_confidence_high_contradiction' },
      });
    }
  }

  /**
   * Record a confirmation of a long-term memory entry
   * Increases confidence
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async recordConfirmation(id: string): Promise<void> {
    const entry = this.longTermMemory.get(id);
    if (!entry) return;

    entry.confirmationCount++;
    entry.lastConfirmed = new Date().toISOString();
    entry.confidence = Math.min(MAX_CONFIDENCE, entry.confidence + CONFIRMATION_BOOST);
    this.dirty = true;
  }

  /**
   * Get all long-term memory entries in a category
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getLongTermByCategory(category: LongTermCategory): Promise<LongTermMemoryEntry[]> {
    const results: LongTermMemoryEntry[] = [];
    for (const entry of this.longTermMemory.values()) {
      if (entry.category === category) {
        results.push(entry);
      }
    }
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AUTOMATIC PROMOTION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Check weekly synthesis for entries ready to promote to long-term
   * Called automatically after weekly synthesis
   */
  async checkForPromotion(weekId: string): Promise<number> {
    const synthesis = this.weeklyReports.get(weekId);
    if (!synthesis) return 0;

    // Combine stable knowledge with patterns that meet threshold
    const candidates = [...synthesis.stableKnowledge, ...synthesis.patterns];

    // Filter candidates that meet promotion criteria
    const readyForPromotion = candidates.filter(content => {
      // Check if this content appears across multiple weeks
      let weekCount = 0;
      for (const report of this.weeklyReports.values()) {
        if (report.patterns.includes(content) || report.stableKnowledge.includes(content)) {
          weekCount++;
        }
      }
      return weekCount >= MIN_CONFIRMATIONS_FOR_PROMOTION;
    });

    return this.promoteToLongTerm(readyForPromotion);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get statistics about the temporal memory system
   */
  getStats(): TemporalMemoryStats {
    return {
      dailyNotes: this.dailyNotes.size,
      weeklyReports: this.weeklyReports.size,
      longTermEntries: this.longTermMemory.size,
    };
  }

  /**
   * Get detailed statistics
   */
  getDetailedStats(): {
    dailyNotes: number;
    weeklyReports: number;
    longTermEntries: number;
    totalDailyEntries: number;
    totalCharacters: number;
    entriesByType: Record<DailyNoteEntryType, number>;
    entriesByCategory: Record<LongTermCategory, number>;
    averageLongTermConfidence: number;
  } {
    let totalEntries = 0;
    let totalChars = 0;
    const entriesByType: Record<DailyNoteEntryType, number> = {
      conversation: 0,
      task: 0,
      observation: 0,
      error: 0,
      decision: 0,
      learning: 0,
      correction: 0,
    };

    for (const note of this.dailyNotes.values()) {
      totalEntries += note.entries.length;
      totalChars += note.charCount;
      for (const entry of note.entries) {
        entriesByType[entry.type]++;
      }
    }

    const entriesByCategory: Record<LongTermCategory, number> = {
      preference: 0,
      behavior: 0,
      knowledge: 0,
      correction: 0,
      relationship: 0,
    };

    let totalConfidence = 0;
    for (const entry of this.longTermMemory.values()) {
      entriesByCategory[entry.category]++;
      totalConfidence += entry.confidence;
    }

    return {
      dailyNotes: this.dailyNotes.size,
      weeklyReports: this.weeklyReports.size,
      longTermEntries: this.longTermMemory.size,
      totalDailyEntries: totalEntries,
      totalCharacters: totalChars,
      entriesByType,
      entriesByCategory,
      averageLongTermConfidence: this.longTermMemory.size > 0
        ? totalConfidence / this.longTermMemory.size
        : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Load all data from disk
   */
  private async loadFromDisk(): Promise<void> {
    // Load daily notes
    const dailyDir = path.join(this.storagePath, 'daily');
    try {
      if (existsSync(dailyDir)) {
        const files = await fs.readdir(dailyDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const content = readFileSync(path.join(dailyDir, file), 'utf-8');
              const note = JSON.parse(content) as DailyNote;
              if (note.date && Array.isArray(note.entries)) {
                this.dailyNotes.set(note.date, note);
              }
            } catch {
              // Skip invalid files
            }
          }
        }
      }
    } catch {
      // Directory may not exist yet
    }

    // Load weekly reports
    const weeklyDir = path.join(this.storagePath, 'weekly');
    try {
      if (existsSync(weeklyDir)) {
        const files = await fs.readdir(weeklyDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const content = readFileSync(path.join(weeklyDir, file), 'utf-8');
              const report = JSON.parse(content) as WeeklyMemorySynthesis;
              if (report.weekId) {
                this.weeklyReports.set(report.weekId, report);
              }
            } catch {
              // Skip invalid files
            }
          }
        }
      }
    } catch {
      // Directory may not exist yet
    }

    // Load long-term memory
    const longTermPath = path.join(this.storagePath, 'long-term.json');
    try {
      if (existsSync(longTermPath)) {
        const content = readFileSync(longTermPath, 'utf-8');
        const entries = JSON.parse(content) as LongTermMemoryEntry[];
        for (const entry of entries) {
          if (entry.id && entry.content) {
            this.longTermMemory.set(entry.id, entry);
          }
        }
      }
    } catch {
      // File may not exist yet
    }
  }

  /**
   * Persist all data to disk
   */
  private async persistToDisk(): Promise<void> {
    // Persist daily notes (one file per day)
    const dailyDir = path.join(this.storagePath, 'daily');
    for (const [date, note] of this.dailyNotes) {
      const filePath = path.join(dailyDir, `${date}.json`);
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(note, null, 2));
      await fs.rename(tempPath, filePath);
    }

    // Persist weekly reports (one file per week)
    const weeklyDir = path.join(this.storagePath, 'weekly');
    for (const [weekId, report] of this.weeklyReports) {
      const filePath = path.join(weeklyDir, `${weekId}.json`);
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(report, null, 2));
      await fs.rename(tempPath, filePath);
    }

    // Persist long-term memory (single file)
    const longTermPath = path.join(this.storagePath, 'long-term.json');
    const tempPath = `${longTermPath}.tmp`;
    const entries = Array.from(this.longTermMemory.values());
    await fs.writeFile(tempPath, JSON.stringify(entries, null, 2));
    await fs.rename(tempPath, longTermPath);

    this.dirty = false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.dailyNotes.clear();
    this.weeklyReports.clear();
    this.longTermMemory.clear();
    this.dirty = false;
  }

  /**
   * Check if today is Sunday (useful for automatic weekly synthesis)
   */
  isSynthesisDay(): boolean {
    return isSunday();
  }

  /**
   * Get the current week ID
   */
  getCurrentWeekId(): string {
    return getWeekId();
  }
}
