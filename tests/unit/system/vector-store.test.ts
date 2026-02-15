import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { VectorStore } from '../../../src/system/vector-store.js';
import type { VectorDocument, SearchOptions } from '../../../src/system/vector-store.js';

describe('VectorStore', () => {
  let eventBus: EventBus;
  let vectorStore: VectorStore;
  let testDbPath: string;

  beforeEach(async () => {
    eventBus = new EventBus();
    testDbPath = join(tmpdir(), `ari-test-vector-${randomUUID()}.db`);
    vectorStore = new VectorStore(eventBus, testDbPath);
  });

  describe('init', () => {
    it('should initialize database with schema', async () => {
      await vectorStore.init();

      // Verify audit event was emitted
      let auditEmitted = false;
      eventBus.on('audit:log', (payload) => {
        if (payload.action === 'vector_store_init') {
          auditEmitted = true;
        }
      });

      await vectorStore.init(); // Call again to verify audit
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(auditEmitted).toBe(true);
    });

  });

  describe('upsert', () => {
    beforeEach(async () => {
      await vectorStore.init();
    });

    it('should insert a new document', async () => {
      const doc: VectorDocument = {
        id: randomUUID(),
        content: 'Test content',
        embedding: new Float32Array([0.1, 0.2, 0.3]),
        source: 'test',
        sourceUrl: 'https://example.com',
        sourceType: 'article',
        title: 'Test Article',
        domain: 'example.com',
        tags: ['test', 'demo'],
        contentHash: VectorStore.hashContent('Test content'),
        chunkIndex: 0,
        chunkTotal: 1,
        parentDocId: null,
        createdAt: new Date().toISOString(),
        metadata: { key: 'value' },
      };

      await vectorStore.upsert(doc);

      // Verify by searching
      const results = await vectorStore.search(doc.embedding, { limit: 1 });
      expect(results.length).toBe(1);
      expect(results[0].document.id).toBe(doc.id);
      expect(results[0].document.content).toBe(doc.content);
    });

    it('should update existing document by content hash', async () => {
      const contentHash = VectorStore.hashContent('Same content');
      const doc1: VectorDocument = {
        id: randomUUID(),
        content: 'Same content',
        embedding: new Float32Array([0.1, 0.2, 0.3]),
        source: 'test',
        sourceUrl: 'https://example.com',
        sourceType: 'article',
        title: 'First Title',
        domain: 'example.com',
        tags: ['first'],
        contentHash,
        chunkIndex: 0,
        chunkTotal: 1,
        parentDocId: null,
        createdAt: new Date().toISOString(),
        metadata: {},
      };

      await vectorStore.upsert(doc1);

      // Upsert with same content hash but different title
      const doc2: VectorDocument = {
        ...doc1,
        title: 'Updated Title',
        tags: ['updated'],
      };

      await vectorStore.upsert(doc2);

      // Should have only one document
      const results = await vectorStore.search(doc1.embedding, { limit: 10 });
      expect(results.length).toBe(1);
      expect(results[0].document.title).toBe('Updated Title');
      expect(results[0].document.tags).toEqual(['updated']);
    });

    it('should throw if not initialized', () => {
      const uninitializedStore = new VectorStore(eventBus, testDbPath);
      const doc: VectorDocument = {
        id: randomUUID(),
        content: 'Test',
        embedding: new Float32Array([0.1]),
        source: 'test',
        sourceUrl: null,
        sourceType: 'file',
        title: null,
        domain: null,
        tags: [],
        contentHash: VectorStore.hashContent('Test'),
        chunkIndex: 0,
        chunkTotal: 1,
        parentDocId: null,
        createdAt: new Date().toISOString(),
        metadata: {},
      };

      expect(() => uninitializedStore.upsert(doc)).toThrow('VectorStore not initialized');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await vectorStore.init();

      // Insert test documents
      const docs: VectorDocument[] = [
        {
          id: '1',
          content: 'AI and machine learning',
          embedding: new Float32Array([1.0, 0.0, 0.0]),
          source: 'arxiv',
          sourceUrl: 'https://arxiv.org/1',
          sourceType: 'article',
          title: 'ML Paper',
          domain: 'arxiv.org',
          tags: ['ml', 'ai'],
          contentHash: VectorStore.hashContent('AI and machine learning'),
          chunkIndex: 0,
          chunkTotal: 1,
          parentDocId: null,
          createdAt: new Date().toISOString(),
          metadata: {},
        },
        {
          id: '2',
          content: 'TypeScript best practices',
          embedding: new Float32Array([0.0, 1.0, 0.0]),
          source: 'dev.to',
          sourceUrl: 'https://dev.to/2',
          sourceType: 'article',
          title: 'TS Guide',
          domain: 'dev.to',
          tags: ['typescript', 'coding'],
          contentHash: VectorStore.hashContent('TypeScript best practices'),
          chunkIndex: 0,
          chunkTotal: 1,
          parentDocId: null,
          createdAt: new Date().toISOString(),
          metadata: {},
        },
        {
          id: '3',
          content: 'Quick tweet about AI',
          embedding: new Float32Array([0.9, 0.1, 0.0]),
          source: 'twitter',
          sourceUrl: 'https://twitter.com/3',
          sourceType: 'tweet',
          title: null,
          domain: 'twitter.com',
          tags: ['ai'],
          contentHash: VectorStore.hashContent('Quick tweet about AI'),
          chunkIndex: 0,
          chunkTotal: 1,
          parentDocId: null,
          createdAt: new Date().toISOString(),
          metadata: {},
        },
      ];

      for (const doc of docs) {
        await vectorStore.upsert(doc);
      }
    });

    it('should find similar documents by cosine similarity', async () => {
      const queryEmbedding = new Float32Array([1.0, 0.0, 0.0]); // Similar to doc 1
      const results = await vectorStore.search(queryEmbedding, { limit: 2 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document.id).toBe('1'); // Most similar
      expect(results[0].score).toBeCloseTo(1.0, 1);
    });

    it('should filter by source type', async () => {
      const queryEmbedding = new Float32Array([1.0, 0.0, 0.0]);
      const options: SearchOptions = { sourceType: 'tweet' };
      const results = await vectorStore.search(queryEmbedding, options);

      expect(results.length).toBe(1);
      expect(results[0].document.sourceType).toBe('tweet');
    });

    it('should filter by domain', async () => {
      const queryEmbedding = new Float32Array([1.0, 0.0, 0.0]);
      const options: SearchOptions = { domain: 'arxiv.org' };
      const results = await vectorStore.search(queryEmbedding, options);

      expect(results.length).toBe(1);
      expect(results[0].document.domain).toBe('arxiv.org');
    });

    it('should filter by tags', async () => {
      const queryEmbedding = new Float32Array([1.0, 0.0, 0.0]);
      const options: SearchOptions = { tags: ['typescript'] };
      const results = await vectorStore.search(queryEmbedding, options);

      expect(results.length).toBe(1);
      expect(results[0].document.tags).toContain('typescript');
    });

    it('should apply minimum score threshold', async () => {
      const queryEmbedding = new Float32Array([1.0, 0.0, 0.0]);
      const options: SearchOptions = { minScore: 0.95 };
      const results = await vectorStore.search(queryEmbedding, options);

      // Only very similar documents should match
      expect(results.every(r => r.score >= 0.95)).toBe(true);
    });

    it('should limit results', async () => {
      const queryEmbedding = new Float32Array([1.0, 0.0, 0.0]);
      const options: SearchOptions = { limit: 1 };
      const results = await vectorStore.search(queryEmbedding, options);

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should emit audit event on search', async () => {
      let auditEmitted = false;
      eventBus.on('audit:log', (payload) => {
        if (payload.action === 'vector_search') {
          auditEmitted = true;
        }
      });

      const queryEmbedding = new Float32Array([1.0, 0.0, 0.0]);
      await vectorStore.search(queryEmbedding);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(auditEmitted).toBe(true);
    });
  });

  describe('deduplicateByHash', () => {
    beforeEach(async () => {
      await vectorStore.init();
    });

    it('should return false for non-existent hash', async () => {
      const hash = VectorStore.hashContent('Non-existent content');
      const exists = await vectorStore.deduplicateByHash(hash);
      expect(exists).toBe(false);
    });

    it('should return true for existing hash', async () => {
      const content = 'Unique content';
      const hash = VectorStore.hashContent(content);
      const doc: VectorDocument = {
        id: randomUUID(),
        content,
        embedding: new Float32Array([0.1, 0.2]),
        source: 'test',
        sourceUrl: null,
        sourceType: 'file',
        title: null,
        domain: null,
        tags: [],
        contentHash: hash,
        chunkIndex: 0,
        chunkTotal: 1,
        parentDocId: null,
        createdAt: new Date().toISOString(),
        metadata: {},
      };

      await vectorStore.upsert(doc);

      const exists = await vectorStore.deduplicateByHash(hash);
      expect(exists).toBe(true);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await vectorStore.init();
    });

    it('should return statistics', async () => {
      const stats = await vectorStore.getStats();

      expect(stats.totalDocuments).toBe(0);
      expect(stats.bySourceType).toHaveProperty('article');
      expect(stats.bySourceType).toHaveProperty('tweet');
      expect(stats.byDomain).toEqual({});
      expect(stats.totalSize).toBeGreaterThanOrEqual(0);
    });

    it('should count documents by source type', async () => {
      const doc1: VectorDocument = {
        id: '1',
        content: 'Article 1',
        embedding: new Float32Array([0.1]),
        source: 'test',
        sourceUrl: null,
        sourceType: 'article',
        title: null,
        domain: 'example.com',
        tags: [],
        contentHash: VectorStore.hashContent('Article 1'),
        chunkIndex: 0,
        chunkTotal: 1,
        parentDocId: null,
        createdAt: new Date().toISOString(),
        metadata: {},
      };

      const doc2: VectorDocument = {
        ...doc1,
        id: '2',
        content: 'Article 2',
        contentHash: VectorStore.hashContent('Article 2'),
      };

      await vectorStore.upsert(doc1);
      await vectorStore.upsert(doc2);

      const stats = await vectorStore.getStats();
      expect(stats.totalDocuments).toBe(2);
      expect(stats.bySourceType.article).toBe(2);
      expect(stats.byDomain['example.com']).toBe(2);
    });
  });

  describe('deleteBySource', () => {
    beforeEach(async () => {
      await vectorStore.init();
    });

    it('should delete documents by source', async () => {
      const doc1: VectorDocument = {
        id: '1',
        content: 'From source A',
        embedding: new Float32Array([0.1]),
        source: 'source-a',
        sourceUrl: null,
        sourceType: 'file',
        title: null,
        domain: null,
        tags: [],
        contentHash: VectorStore.hashContent('From source A'),
        chunkIndex: 0,
        chunkTotal: 1,
        parentDocId: null,
        createdAt: new Date().toISOString(),
        metadata: {},
      };

      const doc2: VectorDocument = {
        ...doc1,
        id: '2',
        content: 'From source B',
        source: 'source-b',
        contentHash: VectorStore.hashContent('From source B'),
      };

      await vectorStore.upsert(doc1);
      await vectorStore.upsert(doc2);

      const deleted = await vectorStore.deleteBySource('source-a');
      expect(deleted).toBe(1);

      const stats = await vectorStore.getStats();
      expect(stats.totalDocuments).toBe(1);
    });
  });

  describe('hashContent', () => {
    it('should generate consistent SHA-256 hash', () => {
      const content = 'Test content for hashing';
      const hash1 = VectorStore.hashContent(content);
      const hash2 = VectorStore.hashContent(content);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate different hashes for different content', () => {
      const hash1 = VectorStore.hashContent('Content A');
      const hash2 = VectorStore.hashContent('Content B');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      await vectorStore.init();
      await vectorStore.close();

      // Should be able to reinitialize
      await vectorStore.init();
      await vectorStore.close();
    });
  });
});
