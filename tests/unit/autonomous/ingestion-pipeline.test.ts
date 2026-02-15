import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IngestionPipeline } from '../../../src/autonomous/ingestion-pipeline.js';
import type { VectorStore, VectorDocument } from '../../../src/system/vector-store.js';
import type { EmbeddingService } from '../../../src/ai/embedding-service.js';
import type { EventBus } from '../../../src/kernel/event-bus.js';

describe('IngestionPipeline', () => {
  let pipeline: IngestionPipeline;
  let mockVectorStore: VectorStore;
  let mockEmbeddingService: EmbeddingService;
  let mockEventBus: EventBus;

  beforeEach(() => {
    // Mock VectorStore
    mockVectorStore = {
      init: vi.fn(),
      upsert: vi.fn(),
      search: vi.fn(),
      deduplicateByHash: vi.fn().mockResolvedValue(false),
      getStats: vi.fn(),
      deleteBySource: vi.fn(),
      close: vi.fn(),
    } as unknown as VectorStore;

    // Mock EmbeddingService
    mockEmbeddingService = {
      embed: vi.fn(),
      embedBatch: vi.fn().mockImplementation(async (texts: string[]) => {
        return texts.map(() => new Float32Array(1536).fill(0.1));
      }),
      getDimension: vi.fn().mockReturnValue(1536),
    } as unknown as EmbeddingService;

    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      once: vi.fn(),
      clear: vi.fn(),
      listenerCount: vi.fn(),
      getHandlerErrorCount: vi.fn(),
      setHandlerTimeout: vi.fn(),
    } as unknown as EventBus;

    pipeline = new IngestionPipeline(mockVectorStore, mockEmbeddingService, mockEventBus);
  });

  it('should ingest direct content successfully', async () => {
    const result = await pipeline.ingest({
      content: 'This is test content.',
      source: 'test-source',
      sourceType: 'article',
      title: 'Test Article',
    });

    expect(result.success).toBe(true);
    expect(result.documentsStored).toBe(1);
    expect(result.chunksCreated).toBe(1);
    expect(result.duplicatesSkipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    expect(mockEmbeddingService.embedBatch).toHaveBeenCalledWith(['This is test content.']);
    expect(mockVectorStore.upsert).toHaveBeenCalledTimes(1);
    expect(mockEventBus.emit).toHaveBeenCalledWith('knowledge:ingested', expect.any(Object));
  });

  it('should skip duplicate content', async () => {
    // Mock deduplicateByHash to return true (duplicate found)
    vi.mocked(mockVectorStore.deduplicateByHash).mockResolvedValue(true);

    const result = await pipeline.ingest({
      content: 'Duplicate content',
      source: 'test-source',
      sourceType: 'article',
    });

    expect(result.success).toBe(true);
    expect(result.documentsStored).toBe(0);
    expect(result.duplicatesSkipped).toBe(1);
    expect(mockVectorStore.upsert).not.toHaveBeenCalled();
  });

  it('should handle empty content', async () => {
    const result = await pipeline.ingest({
      content: '   ',
      source: 'test-source',
      sourceType: 'article',
    });

    expect(result.success).toBe(true);
    expect(result.documentsStored).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Empty content');
  });

  it('should chunk long content with overlap', async () => {
    // Create content longer than 800 chars
    const longContent = 'A'.repeat(1000) + '\n\n' + 'B'.repeat(1000);

    const result = await pipeline.ingest({
      content: longContent,
      source: 'test-source',
      sourceType: 'article',
    });

    expect(result.success).toBe(true);
    expect(result.chunksCreated).toBeGreaterThan(1);

    // Verify embedBatch was called with multiple chunks
    const embedBatchCalls = vi.mocked(mockEmbeddingService.embedBatch).mock.calls;
    expect(embedBatchCalls[0][0].length).toBeGreaterThan(1);

    // Verify chunks have overlap by checking upsert calls
    const upsertCalls = vi.mocked(mockVectorStore.upsert).mock.calls;
    expect(upsertCalls.length).toBeGreaterThan(1);

    // Verify chunks have parentDocId set
    const firstChunk = upsertCalls[0][0] as VectorDocument;
    const secondChunk = upsertCalls[1][0] as VectorDocument;
    expect(firstChunk.parentDocId).toBe(secondChunk.parentDocId);
    expect(firstChunk.chunkIndex).toBe(0);
    expect(secondChunk.chunkIndex).toBe(1);
  });

  it('should respect paragraph boundaries when chunking', async () => {
    const content = 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.';

    const result = await pipeline.ingest({
      content,
      source: 'test-source',
      sourceType: 'article',
    });

    expect(result.success).toBe(true);
    expect(result.chunksCreated).toBe(1); // Small enough to fit in one chunk
  });

  it('should normalize content', async () => {
    const content = '  Multiple   spaces   and\n\n\n\nmultiple newlines  ';

    const result = await pipeline.ingest({
      content,
      source: 'test-source',
      sourceType: 'article',
    });

    expect(result.success).toBe(true);

    // Check that embedBatch received normalized content
    const embedBatchCalls = vi.mocked(mockEmbeddingService.embedBatch).mock.calls;
    const normalizedContent = embedBatchCalls[0][0][0];

    // Should have single spaces and max 2 newlines
    expect(normalizedContent).not.toContain('   ');
    expect(normalizedContent).not.toContain('\n\n\n');
  });

  it('should batch ingest multiple inputs', async () => {
    const inputs = [
      { content: 'Content 1', source: 'source-1', sourceType: 'article' as const },
      { content: 'Content 2', source: 'source-2', sourceType: 'tweet' as const },
      { content: 'Content 3', source: 'source-3', sourceType: 'bookmark' as const },
    ];

    const result = await pipeline.ingestBatch(inputs);

    expect(result.success).toBe(true);
    expect(result.documentsStored).toBe(3);
    expect(mockVectorStore.upsert).toHaveBeenCalledTimes(3);
  });

  it('should handle errors gracefully in batch', async () => {
    // Make embedBatch fail for the second item
    let callCount = 0;
    vi.mocked(mockEmbeddingService.embedBatch).mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Embedding failed');
      }
      return [new Float32Array(1536).fill(0.1)];
    });

    const inputs = [
      { content: 'Content 1', source: 'source-1', sourceType: 'article' as const },
      { content: 'Content 2', source: 'source-2', sourceType: 'tweet' as const },
      { content: 'Content 3', source: 'source-3', sourceType: 'bookmark' as const },
    ];

    const result = await pipeline.ingestBatch(inputs);

    expect(result.success).toBe(false);
    expect(result.documentsStored).toBe(2);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('Embedding failed');
  });

  it('should fetch and extract content from URL', async () => {
    // Mock fetch globally
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><body><p>Fetched content</p></body></html>',
      status: 200,
      statusText: 'OK',
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await pipeline.ingest({
      url: 'https://example.com/article',
      source: 'example-article',
      sourceType: 'article',
    });

    expect(result.success).toBe(true);
    expect(result.documentsStored).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/article',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'ARI-Bot/1.0',
        }),
      }),
    );

    // Verify HTML was stripped
    const embedBatchCalls = vi.mocked(mockEmbeddingService.embedBatch).mock.calls;
    const extractedContent = embedBatchCalls[0][0][0];
    expect(extractedContent).toContain('Fetched content');
    expect(extractedContent).not.toContain('<html>');
    expect(extractedContent).not.toContain('<p>');
  });

  it('should handle URL fetch errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await pipeline.ingest({
      url: 'https://example.com/missing',
      source: 'missing-article',
      sourceType: 'article',
    });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('404');
  });

  it('should extract text from HTML correctly', async () => {
    const html = `
      <html>
        <head>
          <style>body { color: red; }</style>
          <script>console.log('test');</script>
        </head>
        <body>
          <h1>Title</h1>
          <p>Paragraph 1 with &nbsp; non-breaking space.</p>
          <p>Paragraph 2 with &amp; ampersand.</p>
          <p>Paragraph 3 with &lt;tag&gt; entities.</p>
        </body>
      </html>
    `;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => html,
      status: 200,
      statusText: 'OK',
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await pipeline.ingest({
      url: 'https://example.com/article',
      source: 'test-article',
      sourceType: 'article',
    });

    expect(result.success).toBe(true);

    const embedBatchCalls = vi.mocked(mockEmbeddingService.embedBatch).mock.calls;
    const extractedContent = embedBatchCalls[0][0][0];

    // Should contain text without HTML tags
    expect(extractedContent).toContain('Title');
    expect(extractedContent).toContain('Paragraph 1');
    expect(extractedContent).toContain('Paragraph 2');
    expect(extractedContent).toContain('Paragraph 3');

    // Should not contain script or style content
    expect(extractedContent).not.toContain('color: red');
    expect(extractedContent).not.toContain('console.log');

    // Should decode HTML entities
    expect(extractedContent).toContain('non-breaking space');
    expect(extractedContent).toContain('&');
    expect(extractedContent).toContain('<tag>');

    // Should not contain HTML tags
    expect(extractedContent).not.toContain('<h1>');
    expect(extractedContent).not.toContain('<p>');
  });

  it('should store metadata correctly', async () => {
    const metadata = {
      author: 'Test Author',
      publishedDate: '2024-01-01',
      customField: 123,
    };

    const result = await pipeline.ingest({
      content: 'Test content',
      source: 'test-source',
      sourceType: 'article',
      title: 'Test Title',
      domain: 'example.com',
      tags: ['tag1', 'tag2'],
      metadata,
    });

    expect(result.success).toBe(true);

    const upsertCalls = vi.mocked(mockVectorStore.upsert).mock.calls;
    const doc = upsertCalls[0][0] as VectorDocument;

    expect(doc.title).toBe('Test Title');
    expect(doc.domain).toBe('example.com');
    expect(doc.tags).toEqual(['tag1', 'tag2']);
    expect(doc.metadata).toEqual(metadata);
  });

  it('should require either content or url', async () => {
    const result = await pipeline.ingest({
      source: 'test-source',
      sourceType: 'article',
      // No content or url provided
    });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('Must provide either content or url');
  });
});
