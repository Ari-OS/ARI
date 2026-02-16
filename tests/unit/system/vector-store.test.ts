import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import {
  VectorStore,
  VectorDocument,
  UpsertDocumentInput,
  SearchOptions,
  computeContentHash,
  cosineSimilarity,
  createVectorStore,
  VectorStoreError,
  InvalidEmbeddingError,
  SourceType,
} from '../../../src/system/vector-store.js';
import { EventBus } from '../../../src/kernel/event-bus.js';

// ── Test Helpers ─────────────────────────────────────────────────────────────

const EMBEDDING_DIM = 1536;

function createRandomEmbedding(): Float32Array {
  const embedding = new Float32Array(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    embedding[i] = Math.random() * 2 - 1; // Random values between -1 and 1
  }
  return embedding;
}

function createNormalizedEmbedding(seed: number): Float32Array {
  const embedding = new Float32Array(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    embedding[i] = Math.sin(seed + i * 0.01);
  }
  // Normalize to unit vector
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    norm += embedding[i] * embedding[i];
  }
  norm = Math.sqrt(norm);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    embedding[i] /= norm;
  }
  return embedding;
}

function createTestDocument(overrides: Partial<UpsertDocumentInput> = {}): UpsertDocumentInput {
  return {
    content: `Test content ${randomUUID()}`,
    embedding: createRandomEmbedding(),
    source: 'test-source',
    sourceType: 'article',
    tags: ['test'],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('VectorStore', () => {
  let store: VectorStore;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = join(tmpdir(), `ari-vector-test-${randomUUID()}.db`);
    store = new VectorStore(testDbPath);
    await store.init();
  });

  afterEach(async () => {
    await store.close();
    try {
      await fs.unlink(testDbPath);
      await fs.unlink(`${testDbPath}-wal`).catch(() => {});
      await fs.unlink(`${testDbPath}-shm`).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(store.isInitialized()).toBe(true);
    });

    it('should create database file', async () => {
      const stat = await fs.stat(testDbPath);
      expect(stat.isFile()).toBe(true);
    });

    it('should be idempotent on multiple init calls', async () => {
      await store.init();
      await store.init();
      expect(store.isInitialized()).toBe(true);
    });

    it('should return correct db path', () => {
      expect(store.getDbPath()).toBe(testDbPath);
    });

    it('should throw error when operating on uninitialized store', async () => {
      const uninitStore = new VectorStore(join(tmpdir(), `uninit-${randomUUID()}.db`));
      await expect(uninitStore.search(createRandomEmbedding())).rejects.toThrow(VectorStoreError);
    });
  });

  describe('upsert', () => {
    it('should insert a new document', async () => {
      const input = createTestDocument();
      const doc = await store.upsert(input);

      expect(doc.id).toBeDefined();
      expect(doc.content).toBe(input.content);
      expect(doc.source).toBe(input.source);
      expect(doc.sourceType).toBe(input.sourceType);
      expect(doc.contentHash).toHaveLength(64);
      expect(doc.createdAt).toBeDefined();
    });

    it('should update existing document with same content hash', async () => {
      const content = 'Duplicate content test';
      const input1 = createTestDocument({ content, title: 'First' });
      const input2 = createTestDocument({ content, title: 'Second' });

      const doc1 = await store.upsert(input1);
      const doc2 = await store.upsert(input2);

      expect(doc1.id).toBe(doc2.id);
      expect(doc2.title).toBe('Second');
    });

    it('should preserve createdAt on update', async () => {
      const content = 'Preserve timestamp test';
      const input1 = createTestDocument({ content });
      const doc1 = await store.upsert(input1);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const input2 = createTestDocument({ content, title: 'Updated' });
      const doc2 = await store.upsert(input2);

      expect(doc2.createdAt).toBe(doc1.createdAt);
    });

    it('should store and retrieve tags correctly', async () => {
      const tags = ['tag1', 'tag2', 'tag3'];
      const input = createTestDocument({ tags });
      const doc = await store.upsert(input);

      expect(doc.tags).toEqual(tags);

      const retrieved = await store.getById(doc.id);
      expect(retrieved?.tags).toEqual(tags);
    });

    it('should handle optional fields', async () => {
      const input: UpsertDocumentInput = {
        content: 'Minimal document',
        embedding: createRandomEmbedding(),
        source: 'minimal-source',
        sourceType: 'file',
        tags: [],
      };

      const doc = await store.upsert(input);

      expect(doc.title).toBeUndefined();
      expect(doc.domain).toBeUndefined();
      expect(doc.sourceUrl).toBeUndefined();
      expect(doc.parentDocId).toBeUndefined();
    });

    it('should store metadata as JSON', async () => {
      const metadata = { key1: 'value1', nested: { key2: 42 } };
      const input = createTestDocument({ metadata });
      const doc = await store.upsert(input);

      const retrieved = await store.getById(doc.id);
      expect(retrieved?.metadata).toEqual(metadata);
    });

    it('should reject invalid embedding dimension', async () => {
      const input = createTestDocument();
      input.embedding = new Float32Array(100); // Wrong dimension

      await expect(store.upsert(input)).rejects.toThrow();
    });

    it('should handle chunked documents', async () => {
      const parentId = randomUUID();
      const chunks = [
        createTestDocument({ parentDocId: parentId, chunkIndex: 0, chunkTotal: 3 }),
        createTestDocument({ parentDocId: parentId, chunkIndex: 1, chunkTotal: 3 }),
        createTestDocument({ parentDocId: parentId, chunkIndex: 2, chunkTotal: 3 }),
      ];

      const docs = await Promise.all(chunks.map((c) => store.upsert(c)));

      expect(docs[0].chunkIndex).toBe(0);
      expect(docs[1].chunkIndex).toBe(1);
      expect(docs[2].chunkIndex).toBe(2);
      expect(docs.every((d) => d.parentDocId === parentId)).toBe(true);
    });
  });

  describe('search', () => {
    it('should find similar documents', async () => {
      // Create documents with known embeddings
      const baseEmbedding = createNormalizedEmbedding(42);
      const similarEmbedding = createNormalizedEmbedding(42.001); // Very close
      const differentEmbedding = createNormalizedEmbedding(142); // More different

      await store.upsert(createTestDocument({
        content: 'Similar document',
        embedding: similarEmbedding,
      }));

      await store.upsert(createTestDocument({
        content: 'Different document',
        embedding: differentEmbedding,
      }));

      // Use minScore=-1 to include all results including negative similarity
      const results = await store.search(baseEmbedding, { minScore: -1 });

      expect(results.length).toBe(2);
      expect(results[0].document.content).toBe('Similar document');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should respect limit option', async () => {
      // Insert 10 documents with same embedding for consistent results
      const sharedEmbedding = createRandomEmbedding();
      for (let i = 0; i < 10; i++) {
        await store.upsert({ ...createTestDocument({ content: `Doc ${i}` }), embedding: sharedEmbedding });
      }

      const results = await store.search(sharedEmbedding, { limit: 3 });
      expect(results.length).toBe(3);
    });

    it('should filter by domain', async () => {
      const sharedEmbedding = createRandomEmbedding();
      await store.upsert({ ...createTestDocument({ domain: 'finance', content: 'Finance doc 1' }), embedding: sharedEmbedding });
      await store.upsert({ ...createTestDocument({ domain: 'health', content: 'Health doc 1' }), embedding: sharedEmbedding });
      await store.upsert({ ...createTestDocument({ domain: 'finance', content: 'Finance doc 2' }), embedding: sharedEmbedding });

      const results = await store.search(sharedEmbedding, {
        domain: 'finance',
        limit: 100,
      });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.document.domain === 'finance')).toBe(true);
    });

    it('should filter by sourceType', async () => {
      const sharedEmbedding = createRandomEmbedding();
      await store.upsert({ ...createTestDocument({ sourceType: 'article', content: 'Article 1' }), embedding: sharedEmbedding });
      await store.upsert({ ...createTestDocument({ sourceType: 'tweet', content: 'Tweet 1' }), embedding: sharedEmbedding });
      await store.upsert({ ...createTestDocument({ sourceType: 'article', content: 'Article 2' }), embedding: sharedEmbedding });

      const results = await store.search(sharedEmbedding, {
        sourceType: 'article',
        limit: 100,
      });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.document.sourceType === 'article')).toBe(true);
    });

    it('should filter by tags', async () => {
      const sharedEmbedding = createRandomEmbedding();
      await store.upsert({ ...createTestDocument({ tags: ['ai', 'ml'], content: 'AI ML doc' }), embedding: sharedEmbedding });
      await store.upsert({ ...createTestDocument({ tags: ['ai', 'robotics'], content: 'AI Robotics doc' }), embedding: sharedEmbedding });
      await store.upsert({ ...createTestDocument({ tags: ['web', 'frontend'], content: 'Web doc' }), embedding: sharedEmbedding });

      const results = await store.search(sharedEmbedding, {
        tags: ['ai'],
        limit: 100,
      });

      expect(results.length).toBe(2);
    });

    it('should filter by multiple tags (AND)', async () => {
      // Use same embedding for all to ensure consistent search results
      const sharedEmbedding = createRandomEmbedding();

      const doc1 = await store.upsert({
        ...createTestDocument({ tags: ['ai', 'ml', 'python'], content: 'Doc with AI ML Python unique1' }),
        embedding: sharedEmbedding,
      });
      const doc2 = await store.upsert({
        ...createTestDocument({ tags: ['ai', 'robotics'], content: 'Doc with AI Robotics unique2' }),
        embedding: sharedEmbedding,
      });
      const doc3 = await store.upsert({
        ...createTestDocument({ tags: ['ml', 'python'], content: 'Doc with ML Python unique3' }),
        embedding: sharedEmbedding,
      });

      // Verify all documents exist
      const count = await store.count();
      expect(count).toBe(3);

      // Search without any tag filter - should return all 3
      const allResults = await store.search(sharedEmbedding, { limit: 100 });
      expect(allResults.length).toBe(3);

      // Search with single tag - should return 2
      const aiResults = await store.search(sharedEmbedding, {
        tags: ['ai'],
        limit: 100,
      });
      expect(aiResults.length).toBe(2);

      // Search with multiple tags - should match only doc1 which has both 'ai' AND 'ml'
      const results = await store.search(sharedEmbedding, {
        tags: ['ai', 'ml'],
        limit: 100,
      });

      expect(results.length).toBe(1);
      expect(results[0].document.id).toBe(doc1.id);
    });

    it('should respect minScore option', async () => {
      // Use same embedding for high similarity (score = 1.0)
      const queryEmbedding = createNormalizedEmbedding(100);
      const identicalEmbedding = createNormalizedEmbedding(100); // Same seed = identical
      const differentEmbedding = createNormalizedEmbedding(500);

      await store.upsert(createTestDocument({
        embedding: identicalEmbedding,
        content: 'Identical content',
      }));
      await store.upsert(createTestDocument({
        embedding: differentEmbedding,
        content: 'Different content',
      }));

      // With high threshold, only identical embedding should match
      const resultsHighThreshold = await store.search(queryEmbedding, {
        minScore: 0.99,
      });

      expect(resultsHighThreshold.length).toBe(1);
      expect(resultsHighThreshold[0].score).toBeGreaterThanOrEqual(0.99);
    });

    it('should return empty array for no matches', async () => {
      const results = await store.search(createRandomEmbedding(), {
        domain: 'nonexistent',
      });

      expect(results).toEqual([]);
    });

    it('should throw for invalid embedding dimension', async () => {
      const invalidEmbedding = new Float32Array(100);
      await expect(store.search(invalidEmbedding)).rejects.toThrow(InvalidEmbeddingError);
    });
  });

  describe('deduplicateByHash', () => {
    it('should return true for existing hash', async () => {
      const content = 'Unique content for dedup test';
      await store.upsert(createTestDocument({ content }));

      const hash = computeContentHash(content);
      const isDuplicate = await store.deduplicateByHash(hash);

      expect(isDuplicate).toBe(true);
    });

    it('should return false for non-existing hash', async () => {
      const hash = computeContentHash('Nonexistent content');
      const isDuplicate = await store.deduplicateByHash(hash);

      expect(isDuplicate).toBe(false);
    });
  });

  describe('getById', () => {
    it('should retrieve document by id', async () => {
      const input = createTestDocument();
      const inserted = await store.upsert(input);

      const retrieved = await store.getById(inserted.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(inserted.id);
      expect(retrieved?.content).toBe(input.content);
    });

    it('should return null for non-existing id', async () => {
      const result = await store.getById(randomUUID());
      expect(result).toBeNull();
    });
  });

  describe('getByHash', () => {
    it('should retrieve document by content hash', async () => {
      const content = 'Content for hash lookup';
      await store.upsert(createTestDocument({ content }));

      const hash = computeContentHash(content);
      const retrieved = await store.getByHash(hash);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.content).toBe(content);
    });

    it('should return null for non-existing hash', async () => {
      const hash = computeContentHash('Nonexistent');
      const result = await store.getByHash(hash);
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete document by id', async () => {
      const doc = await store.upsert(createTestDocument());
      const deleted = await store.delete(doc.id);

      expect(deleted).toBe(true);

      const retrieved = await store.getById(doc.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existing id', async () => {
      const deleted = await store.delete(randomUUID());
      expect(deleted).toBe(false);
    });
  });

  describe('deleteByParentId', () => {
    it('should delete all chunks of parent document', async () => {
      const parentId = randomUUID();

      for (let i = 0; i < 3; i++) {
        await store.upsert(createTestDocument({
          parentDocId: parentId,
          chunkIndex: i,
          chunkTotal: 3,
        }));
      }

      const deletedCount = await store.deleteByParentId(parentId);
      expect(deletedCount).toBe(3);

      const stats = store.getStats();
      expect(stats.totalDocuments).toBe(0);
    });
  });

  describe('getByDomain', () => {
    it('should retrieve all documents in domain', async () => {
      await store.upsert(createTestDocument({ domain: 'tech' }));
      await store.upsert(createTestDocument({ domain: 'tech' }));
      await store.upsert(createTestDocument({ domain: 'health' }));

      const techDocs = await store.getByDomain('tech');

      expect(techDocs.length).toBe(2);
      expect(techDocs.every((d) => d.domain === 'tech')).toBe(true);
    });
  });

  describe('getByTag', () => {
    it('should retrieve all documents with tag', async () => {
      await store.upsert(createTestDocument({ tags: ['important', 'ml'] }));
      await store.upsert(createTestDocument({ tags: ['important'] }));
      await store.upsert(createTestDocument({ tags: ['other'] }));

      const important = await store.getByTag('important');

      expect(important.length).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await store.upsert(createTestDocument({ domain: 'finance', sourceType: 'article' }));
      await store.upsert(createTestDocument({ domain: 'finance', sourceType: 'tweet' }));
      await store.upsert(createTestDocument({ domain: 'health', sourceType: 'article' }));

      const stats = store.getStats();

      expect(stats.totalDocuments).toBe(3);
      expect(stats.domains).toContain('finance');
      expect(stats.domains).toContain('health');
      expect(stats.sourceTypeCounts.article).toBe(2);
      expect(stats.sourceTypeCounts.tweet).toBe(1);
      expect(stats.dbSizeBytes).toBeGreaterThan(0);
    });

    it('should handle empty store', () => {
      const stats = store.getStats();

      expect(stats.totalDocuments).toBe(0);
      expect(stats.domains).toEqual([]);
      expect(stats.sourceTypeCounts).toEqual({});
    });
  });

  describe('listTags', () => {
    it('should return all unique tags', async () => {
      await store.upsert(createTestDocument({ tags: ['ai', 'ml'] }));
      await store.upsert(createTestDocument({ tags: ['ml', 'python'] }));
      await store.upsert(createTestDocument({ tags: ['web'] }));

      const tags = await store.listTags();

      expect(tags).toContain('ai');
      expect(tags).toContain('ml');
      expect(tags).toContain('python');
      expect(tags).toContain('web');
      expect(tags.length).toBe(4);
    });
  });

  describe('listDomains', () => {
    it('should return all unique domains', async () => {
      await store.upsert(createTestDocument({ domain: 'finance' }));
      await store.upsert(createTestDocument({ domain: 'health' }));
      await store.upsert(createTestDocument({ domain: 'finance' }));

      const domains = await store.listDomains();

      expect(domains).toContain('finance');
      expect(domains).toContain('health');
      expect(domains.length).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all documents', async () => {
      await store.upsert(createTestDocument());
      await store.upsert(createTestDocument());
      await store.upsert(createTestDocument());

      await store.clear();

      const stats = store.getStats();
      expect(stats.totalDocuments).toBe(0);
    });
  });

  describe('upsertBatch', () => {
    it('should insert multiple documents efficiently', async () => {
      const inputs = Array.from({ length: 10 }, () => createTestDocument());

      const docs = await store.upsertBatch(inputs);

      expect(docs.length).toBe(10);
      expect(store.getStats().totalDocuments).toBe(10);
    });

    it('should handle deduplication in batch', async () => {
      const sharedContent = 'Shared content in batch';
      const inputs = [
        createTestDocument({ content: sharedContent }),
        createTestDocument({ content: sharedContent }),
        createTestDocument(),
      ];

      const docs = await store.upsertBatch(inputs);

      // Should have 2 unique documents (1 deduplicated)
      expect(store.getStats().totalDocuments).toBe(2);
    });
  });

  describe('count', () => {
    it('should count all documents', async () => {
      await store.upsert(createTestDocument());
      await store.upsert(createTestDocument());
      await store.upsert(createTestDocument());

      const count = await store.count();
      expect(count).toBe(3);
    });

    it('should count with filters', async () => {
      await store.upsert(createTestDocument({ domain: 'tech' }));
      await store.upsert(createTestDocument({ domain: 'tech' }));
      await store.upsert(createTestDocument({ domain: 'health' }));

      const techCount = await store.count({ domain: 'tech' });
      expect(techCount).toBe(2);
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      await store.close();
      expect(store.isInitialized()).toBe(false);
    });

    it('should be safe to call multiple times', async () => {
      await store.close();
      await store.close();
      expect(store.isInitialized()).toBe(false);
    });
  });
});

describe('computeContentHash', () => {
  it('should compute consistent SHA-256 hash', () => {
    const content = 'Test content';
    const hash1 = computeContentHash(content);
    const hash2 = computeContentHash(content);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('should produce different hashes for different content', () => {
    const hash1 = computeContentHash('Content A');
    const hash2 = computeContentHash('Content B');

    expect(hash1).not.toBe(hash2);
  });
});

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const embedding = createNormalizedEmbedding(42);
    const similarity = cosineSimilarity(embedding, embedding);

    expect(similarity).toBeCloseTo(1, 5);
  });

  it('should return high value for similar vectors', () => {
    const a = createNormalizedEmbedding(42);
    const b = createNormalizedEmbedding(42.01); // Very small phase difference
    const similarity = cosineSimilarity(a, b);

    // Adjacent seeds should be similar (but not identical)
    expect(similarity).toBeGreaterThan(0.5);
    expect(similarity).toBeLessThan(1);
  });

  it('should return lower value for different vectors', () => {
    const a = createNormalizedEmbedding(0);
    const b = createNormalizedEmbedding(500);
    const similarity = cosineSimilarity(a, b);

    expect(similarity).toBeLessThan(0.5);
  });

  it('should throw for mismatched dimensions', () => {
    const a = new Float32Array(1536);
    const b = new Float32Array(100);

    expect(() => cosineSimilarity(a, b)).toThrow(InvalidEmbeddingError);
  });

  it('should return 0 for zero vectors', () => {
    const a = new Float32Array(1536);
    const b = new Float32Array(1536);
    const similarity = cosineSimilarity(a, b);

    expect(similarity).toBe(0);
  });
});

describe('createVectorStore factory', () => {
  it('should create VectorStore with EventBus', async () => {
    const eventBus = new EventBus();
    const dbPath = join(tmpdir(), `factory-test-${randomUUID()}.db`);
    const store = createVectorStore(eventBus, dbPath);

    await store.init();
    expect(store.isInitialized()).toBe(true);

    await store.close();
    await fs.unlink(dbPath).catch(() => {});
  });

  it('should create VectorStore without EventBus', async () => {
    const dbPath = join(tmpdir(), `factory-test-${randomUUID()}.db`);
    const store = createVectorStore(undefined, dbPath);

    await store.init();
    expect(store.isInitialized()).toBe(true);

    await store.close();
    await fs.unlink(dbPath).catch(() => {});
  });
});

describe('EventBus integration', () => {
  let store: VectorStore;
  let eventBus: EventBus;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = join(tmpdir(), `ari-event-test-${randomUUID()}.db`);
    eventBus = new EventBus();
    store = new VectorStore(testDbPath, eventBus);
    await store.init();
  });

  afterEach(async () => {
    await store.close();
    await fs.unlink(testDbPath).catch(() => {});
  });

  it('should emit vector:document_indexed on upsert', async () => {
    let emittedEvent: unknown = null;

    // Listen for the event (using type assertion since it's a custom event)
    (eventBus as unknown as { on: (event: string, handler: (payload: unknown) => void) => void })
      .on('vector:document_indexed', (payload) => {
        emittedEvent = payload;
      });

    await store.upsert(createTestDocument());

    expect(emittedEvent).not.toBeNull();
    expect((emittedEvent as Record<string, unknown>).documentId).toBeDefined();
    expect((emittedEvent as Record<string, unknown>).contentHash).toBeDefined();
  });

  it('should emit vector:search_complete on search', async () => {
    let emittedEvent: unknown = null;

    await store.upsert(createTestDocument());

    (eventBus as unknown as { on: (event: string, handler: (payload: unknown) => void) => void })
      .on('vector:search_complete', (payload) => {
        emittedEvent = payload;
      });

    await store.search(createRandomEmbedding());

    expect(emittedEvent).not.toBeNull();
    expect((emittedEvent as Record<string, unknown>).resultCount).toBeDefined();
    expect((emittedEvent as Record<string, unknown>).duration).toBeDefined();
  });
});

describe('Edge cases', () => {
  let store: VectorStore;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = join(tmpdir(), `ari-edge-test-${randomUUID()}.db`);
    store = new VectorStore(testDbPath);
    await store.init();
  });

  afterEach(async () => {
    await store.close();
    await fs.unlink(testDbPath).catch(() => {});
  });

  it('should handle empty content', async () => {
    await expect(store.upsert({
      content: '',
      embedding: createRandomEmbedding(),
      source: 'test',
      sourceType: 'article',
      tags: [],
    })).rejects.toThrow();
  });

  it('should handle very long content', async () => {
    const longContent = 'x'.repeat(100000);
    const doc = await store.upsert(createTestDocument({ content: longContent }));

    const retrieved = await store.getById(doc.id);
    expect(retrieved?.content).toBe(longContent);
  });

  it('should handle special characters in content', async () => {
    const specialContent = 'Test with "quotes", \'apostrophes\', and emoji: test';
    const doc = await store.upsert(createTestDocument({ content: specialContent }));

    const retrieved = await store.getById(doc.id);
    expect(retrieved?.content).toBe(specialContent);
  });

  it('should handle Unicode content', async () => {
    const unicodeContent = 'Japanese: test Chinese: test Korean: test Arabic: test';
    const doc = await store.upsert(createTestDocument({ content: unicodeContent }));

    const retrieved = await store.getById(doc.id);
    expect(retrieved?.content).toBe(unicodeContent);
  });

  it('should handle all source types', async () => {
    const sourceTypes: SourceType[] = ['article', 'tweet', 'bookmark', 'conversation', 'email', 'file'];

    for (const sourceType of sourceTypes) {
      const doc = await store.upsert(createTestDocument({ sourceType }));
      expect(doc.sourceType).toBe(sourceType);
    }

    const stats = store.getStats();
    expect(Object.keys(stats.sourceTypeCounts).length).toBe(6);
  });

  it('should handle empty tags array', async () => {
    const doc = await store.upsert(createTestDocument({ tags: [] }));
    expect(doc.tags).toEqual([]);

    const retrieved = await store.getById(doc.id);
    expect(retrieved?.tags).toEqual([]);
  });

  it('should handle search with no documents', async () => {
    const results = await store.search(createRandomEmbedding());
    expect(results).toEqual([]);
  });

  it('should handle custom ID', async () => {
    const customId = randomUUID();
    const doc = await store.upsert(createTestDocument({ id: customId }));

    expect(doc.id).toBe(customId);
  });
});
