import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KnowledgeIndex } from '../../../src/autonomous/knowledge-index.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('KnowledgeIndex', () => {
  let index: KnowledgeIndex;
  let eventBus: EventBus;
  let testDir: string;

  beforeEach(async () => {
    eventBus = new EventBus();
    index = new KnowledgeIndex(eventBus);

    // Create a temp directory for tests
    testDir = path.join(os.tmpdir(), `ari-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    await index.init();
  });

  afterEach(async () => {
    // Cleanup temp directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('indexing', () => {
    it('should index a document', async () => {
      const docId = await index.index({
        content: 'This is a test document about TypeScript patterns',
        source: 'session',
        domain: 'patterns',
        provenance: {
          createdBy: 'test',
          createdAt: new Date(),
        },
      });

      expect(docId).toBeDefined();
      expect(docId).toMatch(/^doc_/);
    });

    it('should deduplicate identical content', async () => {
      const content = 'Unique test content for deduplication';

      const id1 = await index.index({
        content,
        source: 'session',
        provenance: { createdBy: 'test', createdAt: new Date() },
      });

      const id2 = await index.index({
        content,
        source: 'session',
        provenance: { createdBy: 'test', createdAt: new Date() },
      });

      expect(id1).toBe(id2);
    });

    it('should index batch of documents', async () => {
      const docs = [
        {
          content: 'Document one about JavaScript',
          source: 'file' as const,
          provenance: { createdBy: 'test', createdAt: new Date() },
        },
        {
          content: 'Document two about Python',
          source: 'file' as const,
          provenance: { createdBy: 'test', createdAt: new Date() },
        },
      ];

      const ids = await index.indexBatch(docs);
      expect(ids).toHaveLength(2);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      // Index some test documents
      await index.index({
        content: 'TypeScript is great for building robust applications',
        source: 'session',
        domain: 'patterns',
        provenance: { createdBy: 'test', createdAt: new Date() },
      });

      await index.index({
        content: 'Python is excellent for data science and machine learning',
        source: 'session',
        domain: 'docs',
        provenance: { createdBy: 'test', createdAt: new Date() },
      });

      await index.index({
        content: 'JavaScript frameworks like React are popular',
        source: 'session',
        domain: 'patterns',
        provenance: { createdBy: 'test', createdAt: new Date() },
      });
    });

    it('should find relevant documents', async () => {
      const results = await index.search('TypeScript applications');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document.content).toContain('TypeScript');
    });

    it('should filter by domain', async () => {
      const results = await index.search('programming', { domain: 'patterns' });
      for (const result of results) {
        expect(result.document.domain).toBe('patterns');
      }
    });

    it('should respect limit', async () => {
      const results = await index.search('programming', { limit: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should return empty for no matches', async () => {
      const results = await index.search('xyzzy nonexistent query', { minScore: 0.5 });
      expect(results).toHaveLength(0);
    });

    it('should include matched terms', async () => {
      const results = await index.search('TypeScript robust');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchedTerms.length).toBeGreaterThan(0);
    });

    it('should include snippets', async () => {
      const results = await index.search('TypeScript');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet).toBeDefined();
    });
  });

  describe('document management', () => {
    it('should retrieve document by ID', async () => {
      const docId = await index.index({
        content: 'Test content for retrieval',
        source: 'session',
        provenance: { createdBy: 'test', createdAt: new Date() },
      });

      const doc = index.getDocument(docId);
      expect(doc).toBeDefined();
      expect(doc?.content).toBe('Test content for retrieval');
    });

    it('should get documents by domain', async () => {
      await index.index({
        content: 'First domain doc',
        source: 'session',
        domain: 'test-domain',
        provenance: { createdBy: 'test', createdAt: new Date() },
      });

      await index.index({
        content: 'Second domain doc',
        source: 'session',
        domain: 'test-domain',
        provenance: { createdBy: 'test', createdAt: new Date() },
      });

      const docs = index.getByDomain('test-domain');
      expect(docs.length).toBe(2);
    });

    it('should remove documents', async () => {
      const docId = await index.index({
        content: 'To be removed',
        source: 'session',
        provenance: { createdBy: 'test', createdAt: new Date() },
      });

      const removed = await index.remove(docId);
      expect(removed).toBe(true);
      expect(index.getDocument(docId)).toBeUndefined();
    });
  });

  describe('stats', () => {
    it('should return index statistics', async () => {
      await index.index({
        content: 'Test document',
        source: 'session',
        domain: 'test',
        provenance: { createdBy: 'test', createdAt: new Date() },
      });

      const stats = index.getStats();
      expect(stats.documentCount).toBeGreaterThan(0);
      expect(stats.termCount).toBeGreaterThan(0);
      expect(stats.domains).toBeDefined();
    });
  });
});
