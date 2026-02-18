import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';

// Mock node:fs/promises before importing the module under test
vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

import { DocumentIngestor } from '../../../src/system/document-ingestor.js';
import fs from 'node:fs/promises';

const mockFs = fs as unknown as {
  mkdir: Mock;
  readFile: Mock;
  writeFile: Mock;
};

describe('DocumentIngestor', () => {
  let ingestor: DocumentIngestor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    ingestor = new DocumentIngestor('/test/data-dir');
  });

  describe('init', () => {
    it('should initialize with empty documents when no persist file exists', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await ingestor.init();

      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/data-dir', { recursive: true });
      expect(ingestor.getDocumentCount()).toBe(0);
    });
  });

  describe('ingestText', () => {
    it('should ingest text and persist to disk', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
      await ingestor.init();

      const doc = await ingestor.ingestText('Hello world content', 'test-source', 'notes');

      expect(doc.id).toMatch(/^notes-/);
      expect(doc.source).toBe('test-source');
      expect(doc.category).toBe('notes');
      expect(doc.content).toBe('Hello world content');
      expect(doc.wordCount).toBe(3);
      expect(doc.ingestedAt).toBeDefined();

      expect(ingestor.getDocumentCount()).toBe(1);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('ingestBriefing', () => {
    it('should strip HTML tags when ingesting a briefing', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
      await ingestor.init();

      const html = '<b>Morning Briefing</b><p>Good morning! Today is <i>sunny</i>.</p>';
      const doc = await ingestor.ingestBriefing(html, '2026-02-17');

      expect(doc.category).toBe('briefing');
      expect(doc.source).toBe('briefing-2026-02-17');
      expect(doc.content).not.toContain('<b>');
      expect(doc.content).not.toContain('<p>');
      expect(doc.content).not.toContain('<i>');
      expect(doc.content).toContain('Morning Briefing');
      expect(doc.content).toContain('Good morning');
    });
  });

  describe('search', () => {
    it('should return matching documents ranked by relevance', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
      await ingestor.init();

      await ingestor.ingestText('TypeScript is a strongly typed language', 'src-1', 'tech');
      await ingestor.ingestText('Python is used for data science', 'src-2', 'tech');
      await ingestor.ingestText('TypeScript and Python are both popular', 'src-3', 'tech');

      const results = ingestor.search('TypeScript');

      expect(results.length).toBeGreaterThan(0);
      // Documents containing TypeScript should come first
      const firstContent = results[0].content.toLowerCase();
      expect(firstContent).toContain('typescript');
    });
  });

  describe('getDocumentsByCategory', () => {
    it('should return documents filtered by category', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
      await ingestor.init();

      await ingestor.ingestText('A briefing document', 'src-1', 'briefing');
      await ingestor.ingestText('Another briefing', 'src-2', 'briefing');
      await ingestor.ingestText('A conversation log', 'src-3', 'conversation');

      const briefings = ingestor.getDocumentsByCategory('briefing');
      const conversations = ingestor.getDocumentsByCategory('conversation');

      expect(briefings).toHaveLength(2);
      expect(conversations).toHaveLength(1);
      expect(briefings.every(d => d.category === 'briefing')).toBe(true);
    });
  });
});
