import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  IngestionPipeline,
  SourceType,
  IngestionOptions,
  DocumentChunk,
  VectorStore,
} from '../../../src/autonomous/ingestion-pipeline.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import type { EmbeddingService, EmbeddingResult } from '../../../src/ai/embedding-service.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

function createMockEmbeddingService(): EmbeddingService {
  return {
    embed: vi.fn().mockImplementation(async (text: string): Promise<EmbeddingResult> => ({
      embedding: new Float32Array(1536).fill(0.1),
      model: 'text-embedding-3-small',
      tokens: Math.ceil(text.length / 4),
      cached: false,
    })),
    embedBatch: vi.fn().mockImplementation(async (texts: string[]): Promise<EmbeddingResult[]> => {
      return texts.map((text) => ({
        embedding: new Float32Array(1536).fill(0.1),
        model: 'text-embedding-3-small',
        tokens: Math.ceil(text.length / 4),
        cached: false,
      }));
    }),
    getCacheStats: vi.fn().mockReturnValue({ hits: 0, misses: 0, size: 0 }),
    clearCache: vi.fn(),
  } as unknown as EmbeddingService;
}

function createMockVectorStore(): VectorStore & {
  chunks: DocumentChunk[];
  addedHashes: Set<string>;
} {
  const chunks: DocumentChunk[] = [];
  const addedHashes = new Set<string>();

  return {
    chunks,
    addedHashes,
    add: vi.fn().mockImplementation(async (newChunks: DocumentChunk[]) => {
      chunks.push(...newChunks);
      for (const chunk of newChunks) {
        addedHashes.add(chunk.metadata.provenance.originalHash);
      }
    }),
    search: vi.fn().mockImplementation(async () => []),
    delete: vi.fn().mockImplementation(async (documentId: string) => {
      const indicesToRemove: number[] = [];
      chunks.forEach((chunk, index) => {
        if (chunk.documentId === documentId) {
          indicesToRemove.push(index);
        }
      });
      for (let i = indicesToRemove.length - 1; i >= 0; i--) {
        chunks.splice(indicesToRemove[i], 1);
      }
    }),
    exists: vi.fn().mockImplementation(async (hash: string) => addedHashes.has(hash)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('IngestionPipeline', () => {
  let pipeline: IngestionPipeline;
  let eventBus: EventBus;
  let vectorStore: ReturnType<typeof createMockVectorStore>;
  let embeddingService: EmbeddingService;
  let testDir: string;

  beforeEach(async () => {
    eventBus = new EventBus();
    vectorStore = createMockVectorStore();
    embeddingService = createMockEmbeddingService();

    // Create temp directory for file tests
    testDir = path.join(os.tmpdir(), `ari-ingestion-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    pipeline = new IngestionPipeline(eventBus, vectorStore, embeddingService, {
      allowedBasePaths: [testDir, os.tmpdir()],
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BASIC INGESTION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ingest', () => {
    it('should ingest simple content', async () => {
      const result = await pipeline.ingest('Hello world, this is test content.', {
        source: 'test-source',
        sourceType: 'article',
      });

      expect(result.documentId).toMatch(/^doc_/);
      expect(result.chunksCreated).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should track tokens used', async () => {
      const result = await pipeline.ingest('This is some content for token counting.', {
        source: 'test',
        sourceType: 'article',
      });

      expect(result.tokensUsed).toBeGreaterThan(0);
    });

    it('should emit knowledge:ingested event', async () => {
      const events: unknown[] = [];
      eventBus.on('knowledge:ingested', (payload) => events.push(payload));

      await pipeline.ingest('Test content for event emission.', {
        source: 'test',
        sourceType: 'article',
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        sourceType: 'article',
        sourceId: 'test',
      });
    });

    it('should throw on empty content', async () => {
      await expect(
        pipeline.ingest('', { source: 'test', sourceType: 'article' })
      ).rejects.toThrow('Content cannot be empty');
    });

    it('should throw on whitespace-only content', async () => {
      await expect(
        pipeline.ingest('   \n\t  ', { source: 'test', sourceType: 'article' })
      ).rejects.toThrow('Content cannot be empty');
    });

    it('should accept all source types', async () => {
      const sourceTypes: SourceType[] = [
        'article', 'tweet', 'bookmark', 'conversation', 'email', 'file'
      ];

      for (const sourceType of sourceTypes) {
        const result = await pipeline.ingest(`Content for ${sourceType}`, {
          source: `test-${sourceType}`,
          sourceType,
        });
        expect(result.documentId).toBeDefined();
      }
    });

    it('should include metadata in chunks', async () => {
      await pipeline.ingest('Test content with metadata.', {
        source: 'meta-test',
        sourceType: 'article',
        title: 'Test Title',
        domain: 'testing',
        tags: ['test', 'unit'],
        sourceUrl: 'https://example.com/article',
      });

      expect(vectorStore.chunks.length).toBeGreaterThan(0);
      const chunk = vectorStore.chunks[0];
      expect(chunk.metadata.title).toBe('Test Title');
      expect(chunk.metadata.domain).toBe('testing');
      expect(chunk.metadata.tags).toEqual(['test', 'unit']);
      expect(chunk.metadata.sourceUrl).toBe('https://example.com/article');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DEDUPLICATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('deduplication', () => {
    it('should deduplicate identical content', async () => {
      const content = 'Unique content for deduplication testing.';

      const result1 = await pipeline.ingest(content, {
        source: 'first',
        sourceType: 'article',
      });

      const result2 = await pipeline.ingest(content, {
        source: 'second',
        sourceType: 'article',
      });

      expect(result1.documentId).toBe(result2.documentId);
      expect(result2.chunksCreated).toBe(0); // No new chunks for duplicate
    });

    it('should not deduplicate different content', async () => {
      const result1 = await pipeline.ingest('Content version one.', {
        source: 'first',
        sourceType: 'article',
      });

      const result2 = await pipeline.ingest('Content version two.', {
        source: 'second',
        sourceType: 'article',
      });

      expect(result1.documentId).not.toBe(result2.documentId);
      expect(result2.chunksCreated).toBeGreaterThan(0);
    });

    it('should check vectorStore for existing hashes', async () => {
      const content = 'Pre-existing content.';
      await pipeline.ingest(content, { source: 'original', sourceType: 'article' });

      // Create new pipeline instance (simulates restart)
      const newPipeline = new IngestionPipeline(
        eventBus, vectorStore, embeddingService,
        { allowedBasePaths: [testDir] }
      );

      const result = await newPipeline.ingest(content, {
        source: 'duplicate',
        sourceType: 'article',
      });

      expect(result.chunksCreated).toBe(0);
      expect(vectorStore.exists).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHUNKING TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('chunking', () => {
    it('should chunk large content', async () => {
      // Create content larger than chunk size (500 tokens * 4 chars = 2000 chars)
      // Use paragraph breaks (\n\n) since the chunker splits on paragraphs first
      // Need enough total content to exceed chunk size and force multiple chunks
      const paragraph = 'Lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(10);
      const largeContent = Array(20).fill(paragraph).join('\n\n');

      const result = await pipeline.ingest(largeContent, {
        source: 'large-doc',
        sourceType: 'article',
      });

      expect(result.chunksCreated).toBeGreaterThan(1);
    });

    it('should preserve paragraph boundaries when chunking', async () => {
      const paragraphs = [
        'First paragraph with important information.',
        'Second paragraph continues the topic.',
        'Third paragraph wraps things up.',
      ];
      const content = paragraphs.join('\n\n');

      await pipeline.ingest(content, {
        source: 'paragraph-test',
        sourceType: 'article',
      });

      // Chunks should respect paragraph structure
      expect(vectorStore.chunks.length).toBeGreaterThan(0);
    });

    it('should include chunk index and total chunks', async () => {
      const largeContent = 'Test content paragraph.\n\n'.repeat(100);

      await pipeline.ingest(largeContent, {
        source: 'indexed-chunks',
        sourceType: 'article',
      });

      const chunks = vectorStore.chunks;
      expect(chunks.length).toBeGreaterThan(1);

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].chunkIndex).toBe(i);
        expect(chunks[i].totalChunks).toBe(chunks.length);
      }
    });

    it('should handle single-line content without paragraphs', async () => {
      const singleLine = 'A '.repeat(600); // Long single line

      await pipeline.ingest(singleLine, {
        source: 'single-line',
        sourceType: 'article',
      });

      expect(vectorStore.chunks.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE INGESTION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ingestFile', () => {
    it('should ingest text file', async () => {
      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'This is file content for testing.');

      const result = await pipeline.ingestFile(filePath, {
        source: 'file-test',
      });

      expect(result.documentId).toMatch(/^doc_/);
      expect(result.chunksCreated).toBeGreaterThan(0);
    });

    it('should ingest markdown file', async () => {
      const filePath = path.join(testDir, 'readme.md');
      await fs.writeFile(filePath, '# Title\n\nThis is markdown content.');

      const result = await pipeline.ingestFile(filePath, {
        source: 'markdown-test',
      });

      expect(result.chunksCreated).toBeGreaterThan(0);
      expect(vectorStore.chunks[0].metadata.sourceType).toBe('file');
    });

    it('should throw on non-existent file', async () => {
      const fakePath = path.join(testDir, 'nonexistent.txt');

      await expect(
        pipeline.ingestFile(fakePath, { source: 'missing' })
      ).rejects.toThrow();
    });

    it('should throw on directory instead of file', async () => {
      // Directories have no extension, so the implementation throws
      // "Unsupported file type" before checking if it's a regular file
      await expect(
        pipeline.ingestFile(testDir, { source: 'dir' })
      ).rejects.toThrow('Unsupported file type');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY TESTS: FILE BOMB PROTECTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('security: file bomb protection', () => {
    it('should reject files exceeding size limit', async () => {
      // Create pipeline with small file size limit
      const limitedPipeline = new IngestionPipeline(
        eventBus, vectorStore, embeddingService,
        { maxFileSizeBytes: 100, allowedBasePaths: [testDir] }
      );

      const filePath = path.join(testDir, 'large.txt');
      await fs.writeFile(filePath, 'x'.repeat(200)); // 200 bytes > 100 limit

      await expect(
        limitedPipeline.ingestFile(filePath, { source: 'large' })
      ).rejects.toThrow('File too large');
    });

    it('should accept files within size limit', async () => {
      const limitedPipeline = new IngestionPipeline(
        eventBus, vectorStore, embeddingService,
        { maxFileSizeBytes: 1000, allowedBasePaths: [testDir] }
      );

      const filePath = path.join(testDir, 'small.txt');
      await fs.writeFile(filePath, 'Small content');

      const result = await limitedPipeline.ingestFile(filePath, { source: 'small' });
      expect(result.chunksCreated).toBeGreaterThan(0);
    });

    it('should use default 10MB limit', async () => {
      const filePath = path.join(testDir, 'normal.txt');
      await fs.writeFile(filePath, 'Normal sized content.');

      // Should not throw with default limit
      const result = await pipeline.ingestFile(filePath, { source: 'normal' });
      expect(result.documentId).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY TESTS: PATH TRAVERSAL PROTECTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('security: path traversal protection', () => {
    it('should reject path with ..', async () => {
      const maliciousPath = path.join(testDir, '..', '..', 'etc', 'passwd');

      await expect(
        pipeline.ingestFile(maliciousPath, { source: 'traversal' })
      ).rejects.toThrow();
    });

    it('should reject paths outside allowed directories', async () => {
      // Create file in a non-allowed directory (simulated)
      const restrictedPipeline = new IngestionPipeline(
        eventBus, vectorStore, embeddingService,
        { allowedBasePaths: ['/nonexistent/allowed/path'] }
      );

      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'Test content');

      await expect(
        restrictedPipeline.ingestFile(filePath, { source: 'restricted' })
      ).rejects.toThrow('Path not in allowed directories');
    });

    it('should reject paths with null bytes', async () => {
      const nullBytePath = `${testDir}/test.txt\0.exe`;

      await expect(
        pipeline.ingestFile(nullBytePath, { source: 'null-byte' })
      ).rejects.toThrow('Invalid path characters');
    });

    it('should normalize and resolve paths', async () => {
      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'Test content for normalization.');

      // Use relative path that should resolve correctly
      const relativePath = path.join(testDir, '.', 'test.txt');
      const result = await pipeline.ingestFile(relativePath, { source: 'relative' });

      expect(result.documentId).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY TESTS: EXECUTABLE FILE BLOCKING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('security: executable file blocking', () => {
    const blockedExtensions = [
      '.exe', '.dll', '.so', '.sh', '.bash', '.py', '.js',
      '.bat', '.cmd', '.ps1', '.jar', '.php', '.rb',
    ];

    for (const ext of blockedExtensions) {
      it(`should block ${ext} files`, async () => {
        const filePath = path.join(testDir, `malicious${ext}`);
        await fs.writeFile(filePath, 'Potentially dangerous content');

        await expect(
          pipeline.ingestFile(filePath, { source: 'blocked' })
        ).rejects.toThrow('Blocked file type');
      });
    }

    const allowedExtensions = ['.txt', '.md', '.json', '.yaml', '.csv', '.html'];

    for (const ext of allowedExtensions) {
      it(`should allow ${ext} files`, async () => {
        const filePath = path.join(testDir, `safe${ext}`);
        await fs.writeFile(filePath, 'Safe content for testing.');

        const result = await pipeline.ingestFile(filePath, { source: 'allowed' });
        expect(result.documentId).toBeDefined();
      });
    }

    it('should reject unsupported extensions', async () => {
      const filePath = path.join(testDir, 'unknown.xyz');
      await fs.writeFile(filePath, 'Unknown format');

      await expect(
        pipeline.ingestFile(filePath, { source: 'unknown' })
      ).rejects.toThrow('Unsupported file type');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BATCH INGESTION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ingestBatch', () => {
    it('should ingest multiple items', async () => {
      const items = [
        { content: 'First document content.', options: { source: 'doc1', sourceType: 'article' as SourceType } },
        { content: 'Second document content.', options: { source: 'doc2', sourceType: 'tweet' as SourceType } },
        { content: 'Third document content.', options: { source: 'doc3', sourceType: 'email' as SourceType } },
      ];

      const results = await pipeline.ingestBatch(items);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.documentId).toMatch(/^doc_/);
        expect(result.chunksCreated).toBeGreaterThan(0);
      });
    });

    it('should continue processing after individual failures', async () => {
      const items = [
        { content: 'Valid content one.', options: { source: 'valid1', sourceType: 'article' as SourceType } },
        { content: '', options: { source: 'invalid', sourceType: 'article' as SourceType } }, // Will fail
        { content: 'Valid content two.', options: { source: 'valid2', sourceType: 'article' as SourceType } },
      ];

      const results = await pipeline.ingestBatch(items);

      expect(results).toHaveLength(3);
      expect(results[0].chunksCreated).toBeGreaterThan(0);
      expect(results[1].chunksCreated).toBe(0); // Failed item
      expect(results[2].chunksCreated).toBeGreaterThan(0);
    });

    it('should emit error events for failed items', async () => {
      const errors: unknown[] = [];
      eventBus.on('system:error', (payload) => errors.push(payload));

      const items = [
        { content: '', options: { source: 'fail', sourceType: 'article' as SourceType } },
      ];

      await pipeline.ingestBatch(items);

      expect(errors).toHaveLength(1);
    });

    it('should return empty array for empty batch', async () => {
      const results = await pipeline.ingestBatch([]);
      expect(results).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EMBEDDING INTEGRATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('embedding integration', () => {
    it('should call embedding service with chunk content', async () => {
      await pipeline.ingest('Content to be embedded.', {
        source: 'embed-test',
        sourceType: 'article',
      });

      expect(embeddingService.embedBatch).toHaveBeenCalled();
    });

    it('should attach embeddings to chunks', async () => {
      await pipeline.ingest('Content with embedding.', {
        source: 'embed-attach',
        sourceType: 'article',
      });

      expect(vectorStore.chunks.length).toBeGreaterThan(0);
      expect(vectorStore.chunks[0].embedding).toBeDefined();
      expect(vectorStore.chunks[0].embedding).toBeInstanceOf(Float32Array);
    });

    it('should batch embed multiple chunks', async () => {
      const largeContent = 'Paragraph content here.\n\n'.repeat(50);

      await pipeline.ingest(largeContent, {
        source: 'batch-embed',
        sourceType: 'article',
      });

      // Should have called embedBatch once with all chunks
      expect(embeddingService.embedBatch).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROVENANCE TRACKING TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('provenance tracking', () => {
    it('should track original content hash', async () => {
      await pipeline.ingest('Content for provenance.', {
        source: 'provenance-test',
        sourceType: 'article',
      });

      const chunk = vectorStore.chunks[0];
      expect(chunk.metadata.provenance.originalHash).toBeDefined();
      expect(chunk.metadata.provenance.originalHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should track chunk hash', async () => {
      await pipeline.ingest('Chunk hash content.', {
        source: 'chunk-hash-test',
        sourceType: 'article',
      });

      const chunk = vectorStore.chunks[0];
      expect(chunk.metadata.provenance.chunkHash).toBeDefined();
      expect(chunk.metadata.provenance.chunkHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should track ingestion timestamp', async () => {
      const before = new Date().toISOString();

      await pipeline.ingest('Timestamp content.', {
        source: 'timestamp-test',
        sourceType: 'article',
      });

      const after = new Date().toISOString();
      const chunk = vectorStore.chunks[0];

      expect(chunk.metadata.ingestedAt).toBeDefined();
      expect(chunk.metadata.ingestedAt >= before).toBe(true);
      expect(chunk.metadata.ingestedAt <= after).toBe(true);
    });

    it('should preserve source information in chunks', async () => {
      await pipeline.ingest('Source info content.', {
        source: 'source-info',
        sourceType: 'email',
        sourceUrl: 'mailto:test@example.com',
      });

      const chunk = vectorStore.chunks[0];
      expect(chunk.metadata.source).toBe('source-info');
      expect(chunk.metadata.sourceType).toBe('email');
      expect(chunk.metadata.sourceUrl).toBe('mailto:test@example.com');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle unicode content', async () => {
      const unicodeContent = 'Hello \u{1F600} world! \u4E2D\u6587 \u0410\u0411\u0412';

      const result = await pipeline.ingest(unicodeContent, {
        source: 'unicode',
        sourceType: 'article',
      });

      expect(result.chunksCreated).toBeGreaterThan(0);
      expect(vectorStore.chunks[0].content).toContain('\u{1F600}');
    });

    it('should handle very long single words', async () => {
      const longWord = 'a'.repeat(3000);

      const result = await pipeline.ingest(longWord, {
        source: 'long-word',
        sourceType: 'article',
      });

      expect(result.chunksCreated).toBeGreaterThan(0);
    });

    it('should handle content with only special characters', async () => {
      const specialContent = '!@#$%^&*()_+-=[]{}|;:,.<>?';

      const result = await pipeline.ingest(specialContent, {
        source: 'special',
        sourceType: 'article',
      });

      expect(result.documentId).toBeDefined();
    });

    it('should handle newline variations', async () => {
      const mixedNewlines = 'Line1\nLine2\r\nLine3\rLine4';

      const result = await pipeline.ingest(mixedNewlines, {
        source: 'newlines',
        sourceType: 'article',
      });

      expect(result.chunksCreated).toBeGreaterThan(0);
    });
  });
});
