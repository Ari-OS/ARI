import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import {
  TemporalMemory,
  type DailyNote,
  type DailyNoteEntry,
  type WeeklyMemorySynthesis,
  type LongTermMemoryEntry,
} from '../../../src/agents/temporal-memory.js';
import { EventBus } from '../../../src/kernel/event-bus.js';

describe('TemporalMemory', () => {
  let temporalMemory: TemporalMemory;
  let eventBus: EventBus;
  let testStoragePath: string;

  beforeEach(async () => {
    testStoragePath = join(tmpdir(), `temporal-memory-${randomUUID()}`);
    eventBus = new EventBus();
    temporalMemory = new TemporalMemory(eventBus, { storagePath: testStoragePath });
    await temporalMemory.init();
  });

  afterEach(async () => {
    await temporalMemory.shutdown();
    // Cleanup test directory
    try {
      await fs.rm(testStoragePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════

  describe('init', () => {
    it('should create storage directories on init', async () => {
      expect(existsSync(testStoragePath)).toBe(true);
      expect(existsSync(join(testStoragePath, 'daily'))).toBe(true);
      expect(existsSync(join(testStoragePath, 'weekly'))).toBe(true);
    });

    it('should emit audit:log event on initialization', async () => {
      const handler = vi.fn();
      eventBus.on('audit:log', handler);

      const newMemory = new TemporalMemory(eventBus, {
        storagePath: join(tmpdir(), `temporal-memory-${randomUUID()}`),
      });
      await newMemory.init();
      await newMemory.shutdown();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'temporal_memory:initialized',
        })
      );
    });

    it('should load existing data from disk on init', async () => {
      // Create some test data
      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'Test learning',
        source: 'test',
      });
      await temporalMemory.shutdown();

      // Create new instance and verify data is loaded
      const newMemory = new TemporalMemory(eventBus, { storagePath: testStoragePath });
      await newMemory.init();

      const stats = newMemory.getStats();
      expect(stats.dailyNotes).toBe(1);

      await newMemory.shutdown();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // DAILY NOTES
  // ═══════════════════════════════════════════════════════════════════════

  describe('captureEntry', () => {
    it('should capture a daily note entry', async () => {
      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'TypeScript strict mode is important',
        source: 'code_review',
      });

      const note = await temporalMemory.getDailyNote();
      expect(note).not.toBeNull();
      expect(note!.entries.length).toBe(1);
      expect(note!.entries[0].content).toBe('TypeScript strict mode is important');
      expect(note!.entries[0].type).toBe('learning');
      expect(note!.entries[0].source).toBe('code_review');
    });

    it('should add timestamp to entries', async () => {
      const before = new Date().toISOString();

      await temporalMemory.captureEntry({
        type: 'observation',
        content: 'Test observation',
        source: 'test',
      });

      const after = new Date().toISOString();
      const note = await temporalMemory.getDailyNote();

      expect(note!.entries[0].timestamp).toBeDefined();
      expect(note!.entries[0].timestamp >= before).toBe(true);
      expect(note!.entries[0].timestamp <= after).toBe(true);
    });

    it('should track character count', async () => {
      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'Short content',
        source: 'test',
      });

      const note = await temporalMemory.getDailyNote();
      expect(note!.charCount).toBeGreaterThan(0);
    });

    it('should enforce 65K character cap', async () => {
      // Create a large entry that exceeds the cap
      const largeContent = 'x'.repeat(60000);
      await temporalMemory.captureEntry({
        type: 'learning',
        content: largeContent,
        source: 'test',
      });

      // Try to add another large entry
      await temporalMemory.captureEntry({
        type: 'observation',
        content: largeContent,
        source: 'test',
      });

      const note = await temporalMemory.getDailyNote();
      expect(note!.entries.length).toBe(1); // Second entry should not be added
    });

    it('should emit memory:daily_captured event', async () => {
      const handler = vi.fn();
      eventBus.on('memory:daily_captured', handler);

      await temporalMemory.captureEntry({
        type: 'task',
        content: 'Completed task',
        source: 'scheduler',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          entryCount: 1,
        })
      );
    });

    it('should support all entry types', async () => {
      const types: Array<DailyNoteEntry['type']> = [
        'conversation',
        'task',
        'observation',
        'error',
        'decision',
        'learning',
      ];

      for (const type of types) {
        await temporalMemory.captureEntry({
          type,
          content: `Test ${type}`,
          source: 'test',
        });
      }

      const note = await temporalMemory.getDailyNote();
      expect(note!.entries.length).toBe(6);
    });
  });

  describe('getDailyNote', () => {
    it('should return null for non-existent date', async () => {
      const note = await temporalMemory.getDailyNote('2000-01-01');
      expect(note).toBeNull();
    });

    it('should return note for specific date', async () => {
      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'Test',
        source: 'test',
      });

      const today = new Date().toISOString().split('T')[0];
      const note = await temporalMemory.getDailyNote(today);
      expect(note).not.toBeNull();
      expect(note!.date).toBe(today);
    });
  });

  describe('getDailyNotesInRange', () => {
    it('should return notes within date range', async () => {
      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'Test',
        source: 'test',
      });

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const notes = await temporalMemory.getDailyNotesInRange(
        yesterday.toISOString().split('T')[0],
        tomorrow.toISOString().split('T')[0]
      );

      expect(notes.length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // WEEKLY SYNTHESIS
  // ═══════════════════════════════════════════════════════════════════════

  describe('synthesizeWeek', () => {
    it('should create weekly synthesis from daily notes', async () => {
      // Add multiple entries to create patterns
      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'TypeScript is great',
        source: 'code',
      });
      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'TypeScript is great for large projects',
        source: 'code',
      });

      const weekId = temporalMemory.getCurrentWeekId();
      const synthesis = await temporalMemory.synthesizeWeek(weekId);

      expect(synthesis).toBeDefined();
      expect(synthesis.weekId).toBe(weekId);
      expect(Array.isArray(synthesis.patterns)).toBe(true);
      expect(Array.isArray(synthesis.preferences)).toBe(true);
      expect(Array.isArray(synthesis.stableKnowledge)).toBe(true);
      expect(Array.isArray(synthesis.discarded)).toBe(true);
    });

    it('should extract patterns from repeated content', async () => {
      // Add same learning multiple times
      for (let i = 0; i < 3; i++) {
        await temporalMemory.captureEntry({
          type: 'learning',
          content: 'Always use strict mode in TypeScript',
          source: 'code',
        });
      }

      const weekId = temporalMemory.getCurrentWeekId();
      const synthesis = await temporalMemory.synthesizeWeek(weekId);

      expect(synthesis.patterns.length).toBeGreaterThan(0);
    });

    it('should extract preferences from decision entries', async () => {
      await temporalMemory.captureEntry({
        type: 'decision',
        content: 'I prefer functional programming style',
        source: 'code',
      });

      const weekId = temporalMemory.getCurrentWeekId();
      const synthesis = await temporalMemory.synthesizeWeek(weekId);

      expect(synthesis.preferences.length).toBeGreaterThan(0);
    });

    it('should extract discarded patterns from errors', async () => {
      await temporalMemory.captureEntry({
        type: 'error',
        content: 'Do not use any type in TypeScript',
        source: 'code_review',
      });

      const weekId = temporalMemory.getCurrentWeekId();
      const synthesis = await temporalMemory.synthesizeWeek(weekId);

      expect(synthesis.discarded.length).toBe(1);
    });

    it('should mark daily notes as synthesized', async () => {
      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'Test',
        source: 'test',
      });

      const weekId = temporalMemory.getCurrentWeekId();
      await temporalMemory.synthesizeWeek(weekId);

      const note = await temporalMemory.getDailyNote();
      expect(note!.synthesized).toBe(true);
    });

    it('should emit memory:weekly_synthesized event', async () => {
      const handler = vi.fn();
      eventBus.on('memory:weekly_synthesized', handler);

      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'Test',
        source: 'test',
      });

      const weekId = temporalMemory.getCurrentWeekId();
      await temporalMemory.synthesizeWeek(weekId);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          weekId,
        })
      );
    });

    it('should return existing synthesis if already created', async () => {
      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'Test',
        source: 'test',
      });

      const weekId = temporalMemory.getCurrentWeekId();
      const first = await temporalMemory.synthesizeWeek(weekId);
      const second = await temporalMemory.synthesizeWeek(weekId);

      expect(first).toEqual(second);
    });
  });

  describe('getWeeklySynthesis', () => {
    it('should return null for non-existent week', async () => {
      const synthesis = await temporalMemory.getWeeklySynthesis('2000-W01');
      expect(synthesis).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // LONG-TERM MEMORY
  // ═══════════════════════════════════════════════════════════════════════

  describe('promoteToLongTerm', () => {
    it('should promote entries to long-term memory', async () => {
      const promoted = await temporalMemory.promoteToLongTerm([
        'Always validate user input',
        'Use TypeScript strict mode',
      ]);

      expect(promoted).toBe(2);
      expect(temporalMemory.getStats().longTermEntries).toBe(2);
    });

    it('should emit memory:promoted_long_term event', async () => {
      const handler = vi.fn();
      eventBus.on('memory:promoted_long_term', handler);

      await temporalMemory.promoteToLongTerm(['Test entry']);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          entryId: expect.any(String),
          confidence: expect.any(Number),
        })
      );
    });

    it('should update existing entry if similar content found', async () => {
      await temporalMemory.promoteToLongTerm(['Always validate user input']);
      await temporalMemory.promoteToLongTerm(['Always validate user input carefully']);

      // Should not create duplicate
      expect(temporalMemory.getStats().longTermEntries).toBe(1);
    });

    it('should categorize entries correctly', async () => {
      await temporalMemory.promoteToLongTerm([
        'I prefer functional style',  // preference (contains 'prefer')
        'Always check null values',    // behavior (contains 'always')
        'User likes dark mode',        // preference (contains 'like')
        'Fixed the bug by adding check', // correction (contains 'fixed')
        'TypeScript compiles to JS',   // knowledge (default)
      ]);

      const prefs = await temporalMemory.getLongTermByCategory('preference');
      const behaviors = await temporalMemory.getLongTermByCategory('behavior');
      const corrections = await temporalMemory.getLongTermByCategory('correction');
      const knowledge = await temporalMemory.getLongTermByCategory('knowledge');

      // 'prefer' and 'like' both trigger preference category
      expect(prefs.length).toBe(2);
      expect(behaviors.length).toBe(1);
      expect(corrections.length).toBe(1);
      expect(knowledge.length).toBe(1);
    });
  });

  describe('searchLongTerm', () => {
    beforeEach(async () => {
      await temporalMemory.promoteToLongTerm([
        'TypeScript strict mode is important',
        'Always validate user input',
        'Use ESLint for code quality',
      ]);
    });

    it('should find relevant entries', async () => {
      const results = await temporalMemory.searchLongTerm('TypeScript');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('TypeScript');
    });

    it('should return empty array for no matches', async () => {
      const results = await temporalMemory.searchLongTerm('xyz123nonexistent');
      expect(results.length).toBe(0);
    });

    it('should sort by relevance score', async () => {
      const results = await temporalMemory.searchLongTerm('validate input');
      if (results.length > 1) {
        // First result should be most relevant
        expect(results[0].content.toLowerCase()).toContain('validate');
      }
    });
  });

  describe('getLongTermEntry', () => {
    it('should return entry by ID', async () => {
      await temporalMemory.promoteToLongTerm(['Test entry']);
      const results = await temporalMemory.searchLongTerm('Test');
      const entry = await temporalMemory.getLongTermEntry(results[0].id);

      expect(entry).not.toBeNull();
      expect(entry!.content).toBe('Test entry');
    });

    it('should return null for non-existent ID', async () => {
      const entry = await temporalMemory.getLongTermEntry('non-existent-id');
      expect(entry).toBeNull();
    });
  });

  describe('recordContradiction', () => {
    it('should decrease confidence on contradiction', async () => {
      await temporalMemory.promoteToLongTerm(['Test entry']);
      const results = await temporalMemory.searchLongTerm('Test');
      const originalConfidence = results[0].confidence;

      await temporalMemory.recordContradiction(results[0].id);

      const updated = await temporalMemory.getLongTermEntry(results[0].id);
      expect(updated!.confidence).toBeLessThan(originalConfidence);
      expect(updated!.contradictionCount).toBe(1);
    });

    it('should remove entry if confidence too low with high contradictions', async () => {
      await temporalMemory.promoteToLongTerm(['Test entry']);
      const results = await temporalMemory.searchLongTerm('Test');
      const id = results[0].id;

      // Record many contradictions to drop confidence
      for (let i = 0; i < 10; i++) {
        await temporalMemory.recordContradiction(id);
      }

      const entry = await temporalMemory.getLongTermEntry(id);
      expect(entry).toBeNull();
    });
  });

  describe('recordConfirmation', () => {
    it('should increase confidence on confirmation', async () => {
      await temporalMemory.promoteToLongTerm(['Test entry']);
      const results = await temporalMemory.searchLongTerm('Test');
      const originalConfidence = results[0].confidence;

      await temporalMemory.recordConfirmation(results[0].id);

      const updated = await temporalMemory.getLongTermEntry(results[0].id);
      expect(updated!.confidence).toBeGreaterThan(originalConfidence);
      expect(updated!.confirmationCount).toBe(2); // 1 from promotion + 1 from confirmation
    });

    it('should update lastConfirmed timestamp', async () => {
      await temporalMemory.promoteToLongTerm(['Test entry']);
      const results = await temporalMemory.searchLongTerm('Test');
      const originalLastConfirmed = results[0].lastConfirmed;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await temporalMemory.recordConfirmation(results[0].id);

      const updated = await temporalMemory.getLongTermEntry(results[0].id);
      expect(updated!.lastConfirmed >= originalLastConfirmed).toBe(true);
    });
  });

  describe('getLongTermByCategory', () => {
    it('should return entries filtered by category', async () => {
      await temporalMemory.promoteToLongTerm([
        'I prefer dark mode',
        'Always validate input',
      ]);

      const prefs = await temporalMemory.getLongTermByCategory('preference');
      const behaviors = await temporalMemory.getLongTermByCategory('behavior');

      expect(prefs.every(e => e.category === 'preference')).toBe(true);
      expect(behaviors.every(e => e.category === 'behavior')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'Test',
        source: 'test',
      });
      await temporalMemory.promoteToLongTerm(['Long term entry']);

      const stats = temporalMemory.getStats();

      expect(stats.dailyNotes).toBe(1);
      expect(stats.longTermEntries).toBe(1);
    });
  });

  describe('getDetailedStats', () => {
    it('should return detailed statistics', async () => {
      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'Learning entry',
        source: 'test',
      });
      await temporalMemory.captureEntry({
        type: 'error',
        content: 'Error entry',
        source: 'test',
      });
      await temporalMemory.promoteToLongTerm(['I prefer TypeScript']);

      const stats = temporalMemory.getDetailedStats();

      expect(stats.totalDailyEntries).toBe(2);
      expect(stats.totalCharacters).toBeGreaterThan(0);
      expect(stats.entriesByType.learning).toBe(1);
      expect(stats.entriesByType.error).toBe(1);
      expect(stats.entriesByCategory.preference).toBe(1);
      expect(stats.averageLongTermConfidence).toBeGreaterThan(0);
    });

    it('should return zero values for empty memory', () => {
      temporalMemory.clear();
      const stats = temporalMemory.getDetailedStats();

      expect(stats.totalDailyEntries).toBe(0);
      expect(stats.totalCharacters).toBe(0);
      expect(stats.averageLongTermConfidence).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  describe('clear', () => {
    it('should remove all data', async () => {
      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'Test',
        source: 'test',
      });
      await temporalMemory.promoteToLongTerm(['Long term']);

      temporalMemory.clear();

      const stats = temporalMemory.getStats();
      expect(stats.dailyNotes).toBe(0);
      expect(stats.weeklyReports).toBe(0);
      expect(stats.longTermEntries).toBe(0);
    });
  });

  describe('isSynthesisDay', () => {
    it('should return boolean', () => {
      const result = temporalMemory.isSynthesisDay();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getCurrentWeekId', () => {
    it('should return week ID in correct format', () => {
      const weekId = temporalMemory.getCurrentWeekId();
      expect(weekId).toMatch(/^\d{4}-W\d{2}$/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════

  describe('persistence', () => {
    it('should persist daily notes to disk', async () => {
      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'Persisted learning',
        source: 'test',
      });

      // Force shutdown to persist
      await temporalMemory.shutdown();

      // Verify file exists
      const today = new Date().toISOString().split('T')[0];
      const filePath = join(testStoragePath, 'daily', `${today}.json`);
      expect(existsSync(filePath)).toBe(true);
    });

    it('should persist long-term memory to disk', async () => {
      await temporalMemory.promoteToLongTerm(['Persisted entry']);

      // Force shutdown to persist
      await temporalMemory.shutdown();

      // Verify file exists
      const filePath = join(testStoragePath, 'long-term.json');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should load persisted data on restart', async () => {
      await temporalMemory.captureEntry({
        type: 'learning',
        content: 'Will survive restart',
        source: 'test',
      });
      await temporalMemory.promoteToLongTerm(['Long term survivor']);
      await temporalMemory.shutdown();

      // Create new instance
      const newMemory = new TemporalMemory(eventBus, { storagePath: testStoragePath });
      await newMemory.init();

      const note = await newMemory.getDailyNote();
      expect(note!.entries[0].content).toBe('Will survive restart');

      const longTerm = await newMemory.searchLongTerm('survivor');
      expect(longTerm.length).toBe(1);

      await newMemory.shutdown();
    });
  });
});
