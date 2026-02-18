import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KnowledgeBase, KnowledgeSource, SourceType } from '../../../src/system/knowledge-base.js';
import type { EventBus } from '../../../src/kernel/event-bus.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock logger
vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Helper to create a mock EventBus
function createMockEventBus(): EventBus {
  return {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
    once: vi.fn(() => () => {}),
    clear: vi.fn(),
    listenerCount: vi.fn(() => 0),
    getHandlerErrorCount: vi.fn(() => 0),
    setHandlerTimeout: vi.fn(),
  } as unknown as EventBus;
}

describe('KnowledgeBase', () => {
  let kb: KnowledgeBase;
  let eventBus: EventBus;
  let tmpDir: string;

  beforeEach(() => {
    eventBus = createMockEventBus();
    tmpDir = path.join(os.tmpdir(), `ari-kb-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    kb = new KnowledgeBase({ storagePath: tmpDir, eventBus });
  });

  afterEach(() => {
    // Clean up temp dir
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('ingest', () => {
    it('should create an entry from a knowledge source', async () => {
      const source: KnowledgeSource = {
        type: 'url',
        url: 'https://example.com/article',
        content: 'TypeScript is a typed superset of JavaScript.',
        title: 'TypeScript Overview',
        author: 'Test Author',
        tags: ['typescript', 'programming'],
      };

      const entry = await kb.ingest(source);

      expect(entry.id).toBeDefined();
      expect(entry.sourceType).toBe('url');
      expect(entry.title).toBe('TypeScript Overview');
      expect(entry.content).toBe('TypeScript is a typed superset of JavaScript.');
      expect(entry.author).toBe('Test Author');
      expect(entry.tags).toEqual(['typescript', 'programming']);
      expect(entry.url).toBe('https://example.com/article');
      expect(entry.accessCount).toBe(0);
      expect(entry.ingestedAt).toBeDefined();
    });

    it('should emit knowledge:kb_ingested event', async () => {
      const source: KnowledgeSource = {
        type: 'manual',
        content: 'Some knowledge',
        title: 'Manual Entry',
      };

      const entry = await kb.ingest(source);

      expect(eventBus.emit).toHaveBeenCalledWith('knowledge:kb_ingested', {
        id: entry.id,
        sourceType: 'manual',
        title: 'Manual Entry',
        tags: [],
        timestamp: entry.ingestedAt,
      });
    });

    it('should auto-generate title from content when not provided', async () => {
      const source: KnowledgeSource = {
        type: 'rss',
        content: 'First line of content\nSecond line',
      };

      const entry = await kb.ingest(source);

      expect(entry.title).toBe('First line of content');
    });

    it('should persist entry to JSONL file', async () => {
      const source: KnowledgeSource = {
        type: 'pdf',
        content: 'PDF content here',
        title: 'Test PDF',
      };

      await kb.ingest(source);

      const entriesPath = path.join(tmpDir, 'entries.jsonl');
      expect(fs.existsSync(entriesPath)).toBe(true);

      const data = fs.readFileSync(entriesPath, 'utf-8');
      const parsed = JSON.parse(data.trim());
      expect(parsed.title).toBe('Test PDF');
    });

    it('should truncate content to max length', async () => {
      const longContent = 'x'.repeat(200_000);
      const source: KnowledgeSource = {
        type: 'manual',
        content: longContent,
        title: 'Long Entry',
      };

      const entry = await kb.ingest(source);

      expect(entry.content.length).toBeLessThanOrEqual(100_000);
    });
  });

  describe('search', () => {
    it('should find entries by keyword in title', async () => {
      await kb.ingest({ type: 'manual', content: 'Some content', title: 'TypeScript Guide' });
      await kb.ingest({ type: 'manual', content: 'Other stuff', title: 'Python Basics' });

      const results = kb.search('TypeScript');

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('TypeScript Guide');
    });

    it('should find entries by keyword in content', async () => {
      await kb.ingest({ type: 'manual', content: 'Learn about machine learning algorithms', title: 'ML Article' });
      await kb.ingest({ type: 'manual', content: 'Cooking recipes', title: 'Recipes' });

      const results = kb.search('algorithms');

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('ML Article');
    });

    it('should find entries by tag', async () => {
      await kb.ingest({ type: 'manual', content: 'Content', title: 'Tagged Entry', tags: ['ai', 'ml'] });

      const results = kb.search('ai');

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Tagged Entry');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await kb.ingest({ type: 'manual', content: `Content about topic ${i}`, title: `Topic ${i}` });
      }

      const results = kb.search('topic', 2);

      expect(results.length).toBe(2);
    });

    it('should emit knowledge:kb_searched event', async () => {
      kb.search('test query');

      expect(eventBus.emit).toHaveBeenCalledWith('knowledge:kb_searched', expect.objectContaining({
        query: 'test query',
        resultCount: 0,
      }));
    });

    it('should rank title matches higher than content matches', async () => {
      await kb.ingest({ type: 'manual', content: 'NodeJS is great for servers', title: 'Node Article' });
      await kb.ingest({ type: 'manual', content: 'Some unrelated content', title: 'NodeJS Deep Dive' });

      const results = kb.search('nodejs');

      expect(results.length).toBe(2);
      // Title match should rank higher
      expect(results[0].title).toBe('NodeJS Deep Dive');
    });
  });

  describe('getBySource', () => {
    it('should filter entries by source type', async () => {
      await kb.ingest({ type: 'url', content: 'URL content', title: 'URL Entry' });
      await kb.ingest({ type: 'pdf', content: 'PDF content', title: 'PDF Entry' });
      await kb.ingest({ type: 'url', content: 'Another URL', title: 'URL Entry 2' });

      const urlEntries = kb.getBySource('url');

      expect(urlEntries.length).toBe(2);
      expect(urlEntries.every(e => e.sourceType === 'url')).toBe(true);
    });

    it('should return empty array for source type with no entries', () => {
      const results = kb.getBySource('youtube');

      expect(results).toEqual([]);
    });
  });

  describe('get', () => {
    it('should return entry by ID', async () => {
      const entry = await kb.ingest({ type: 'manual', content: 'Test', title: 'Test Entry' });

      const retrieved = kb.get(entry.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe('Test Entry');
    });

    it('should increment accessCount on get', async () => {
      const entry = await kb.ingest({ type: 'manual', content: 'Test', title: 'Test Entry' });

      kb.get(entry.id);
      kb.get(entry.id);
      const retrieved = kb.get(entry.id);

      expect(retrieved!.accessCount).toBe(3);
    });

    it('should set lastAccessed on get', async () => {
      const entry = await kb.ingest({ type: 'manual', content: 'Test', title: 'Test Entry' });

      const retrieved = kb.get(entry.id);

      expect(retrieved!.lastAccessed).toBeDefined();
    });

    it('should emit knowledge:kb_accessed event', async () => {
      const entry = await kb.ingest({ type: 'manual', content: 'Test', title: 'Test Entry' });
      vi.mocked(eventBus.emit).mockClear();

      kb.get(entry.id);

      expect(eventBus.emit).toHaveBeenCalledWith('knowledge:kb_accessed', expect.objectContaining({
        id: entry.id,
        accessCount: 1,
      }));
    });

    it('should return null for non-existent ID', () => {
      const result = kb.get('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should remove entry by ID', async () => {
      const entry = await kb.ingest({ type: 'manual', content: 'Test', title: 'Test Entry' });

      const deleted = kb.delete(entry.id);

      expect(deleted).toBe(true);
      expect(kb.get(entry.id)).toBeNull();
    });

    it('should return false for non-existent ID', () => {
      const deleted = kb.delete('non-existent-id');

      expect(deleted).toBe(false);
    });

    it('should rewrite JSONL file after delete', async () => {
      const entry1 = await kb.ingest({ type: 'manual', content: 'Test 1', title: 'Entry 1' });
      await kb.ingest({ type: 'manual', content: 'Test 2', title: 'Entry 2' });

      kb.delete(entry1.id);

      const entriesPath = path.join(tmpDir, 'entries.jsonl');
      const data = fs.readFileSync(entriesPath, 'utf-8');
      const lines = data.trim().split('\n');
      expect(lines.length).toBe(1);
      expect(JSON.parse(lines[0]).title).toBe('Entry 2');
    });
  });

  describe('getStats', () => {
    it('should return correct total count', async () => {
      await kb.ingest({ type: 'manual', content: 'Test 1', title: 'Entry 1' });
      await kb.ingest({ type: 'url', content: 'Test 2', title: 'Entry 2' });

      const stats = kb.getStats();

      expect(stats.totalEntries).toBe(2);
    });

    it('should return correct bySource counts', async () => {
      await kb.ingest({ type: 'url', content: 'Test 1', title: 'URL 1' });
      await kb.ingest({ type: 'url', content: 'Test 2', title: 'URL 2' });
      await kb.ingest({ type: 'pdf', content: 'Test 3', title: 'PDF 1' });

      const stats = kb.getStats();

      expect(stats.bySource.url).toBe(2);
      expect(stats.bySource.pdf).toBe(1);
      expect(stats.bySource.youtube).toBe(0);
    });

    it('should return top tags', async () => {
      await kb.ingest({ type: 'manual', content: 'Test', title: 'E1', tags: ['ai', 'ml'] });
      await kb.ingest({ type: 'manual', content: 'Test', title: 'E2', tags: ['ai', 'web'] });
      await kb.ingest({ type: 'manual', content: 'Test', title: 'E3', tags: ['ai'] });

      const stats = kb.getStats();

      expect(stats.topTags[0].tag).toBe('ai');
      expect(stats.topTags[0].count).toBe(3);
      expect(stats.totalTags).toBe(3); // ai, ml, web
    });

    it('should return most accessed entries', async () => {
      const entry = await kb.ingest({ type: 'manual', content: 'Test', title: 'Popular' });
      await kb.ingest({ type: 'manual', content: 'Test', title: 'Unpopular' });

      kb.get(entry.id);
      kb.get(entry.id);

      const stats = kb.getStats();

      expect(stats.mostAccessed.length).toBe(1);
      expect(stats.mostAccessed[0].title).toBe('Popular');
    });

    it('should count recently added entries', async () => {
      await kb.ingest({ type: 'manual', content: 'Test', title: 'Recent' });

      const stats = kb.getStats();

      expect(stats.recentlyAdded).toBe(1);
    });
  });

  describe('persistence', () => {
    it('should load entries from existing JSONL file', async () => {
      // Ingest an entry to create the file
      const entry = await kb.ingest({ type: 'manual', content: 'Persisted content', title: 'Persisted' });

      // Create a new KnowledgeBase pointing to the same dir
      const kb2 = new KnowledgeBase({ storagePath: tmpDir, eventBus });

      const retrieved = kb2.get(entry.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe('Persisted');
    });
  });
});
