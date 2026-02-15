import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RAGQueryEngine } from '../../../src/autonomous/rag-query.js';
import type { VectorStore, SearchResult, VectorDocument } from '../../../src/system/vector-store.js';
import type { EmbeddingService } from '../../../src/ai/embedding-service.js';
import type { EventBus } from '../../../src/kernel/event-bus.js';

describe('RAGQueryEngine', () => {
  let engine: RAGQueryEngine;
  let mockVectorStore: VectorStore;
  let mockEmbeddingService: EmbeddingService;
  let mockEventBus: EventBus;

  beforeEach(() => {
    // Mock VectorStore
    mockVectorStore = {
      init: vi.fn(),
      upsert: vi.fn(),
      search: vi.fn().mockResolvedValue([]),
      deduplicateByHash: vi.fn(),
      getStats: vi.fn(),
      deleteBySource: vi.fn(),
      close: vi.fn(),
    } as unknown as VectorStore;

    // Mock EmbeddingService
    mockEmbeddingService = {
      embed: vi.fn().mockResolvedValue(new Float32Array(1536).fill(0.5)),
      embedBatch: vi.fn(),
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

    engine = new RAGQueryEngine(mockVectorStore, mockEmbeddingService, mockEventBus);
  });

  const createMockDocument = (
    source: string,
    content: string,
    sourceUrl: string | null = null,
  ): VectorDocument => ({
    id: `doc-${source}`,
    content,
    embedding: new Float32Array(1536).fill(0.1),
    source,
    sourceUrl,
    sourceType: 'article',
    title: `Title for ${source}`,
    domain: 'example.com',
    tags: [],
    contentHash: 'hash123',
    chunkIndex: 0,
    chunkTotal: 1,
    parentDocId: null,
    createdAt: new Date().toISOString(),
    metadata: {},
  });

  it('should query with results', async () => {
    const mockResults: SearchResult[] = [
      { document: createMockDocument('source-1', 'Content about AI'), score: 0.9 },
      { document: createMockDocument('source-2', 'More AI content'), score: 0.8 },
      { document: createMockDocument('source-3', 'AI research'), score: 0.7 },
    ];

    vi.mocked(mockVectorStore.search).mockResolvedValue(mockResults);

    const result = await engine.query('What is AI?');

    expect(result.sourcesUsed).toBe(3);
    expect(result.citations).toHaveLength(3);
    expect(result.confidence).toBeCloseTo(0.8, 1); // Average of scores
    expect(result.answer).toBeTruthy();

    expect(mockEmbeddingService.embed).toHaveBeenCalledWith('What is AI?');
    expect(mockEventBus.emit).toHaveBeenCalledWith('knowledge:searched', {
      query: 'What is AI?',
      resultCount: 3,
    });
  });

  it('should query with no results', async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([]);

    const result = await engine.query('Obscure topic with no matches');

    expect(result.sourcesUsed).toBe(0);
    expect(result.citations).toHaveLength(0);
    expect(result.confidence).toBe(0);
    expect(result.answer).toBe('No relevant information found.');
  });

  it('should filter by minScore', async () => {
    const mockResults: SearchResult[] = [
      { document: createMockDocument('source-1', 'High score content'), score: 0.9 },
      { document: createMockDocument('source-2', 'Low score content'), score: 0.2 },
    ];

    vi.mocked(mockVectorStore.search).mockResolvedValue(mockResults);

    const result = await engine.query('Test query', { minScore: 0.5 });

    // Verify minScore was passed to vector store
    expect(mockVectorStore.search).toHaveBeenCalledWith(
      expect.any(Float32Array),
      expect.objectContaining({ minScore: 0.5 }),
    );
  });

  it('should deduplicate results per source', async () => {
    const mockResults: SearchResult[] = [
      { document: createMockDocument('source-1', 'Chunk 1 from source 1'), score: 0.9 },
      { document: createMockDocument('source-1', 'Chunk 2 from source 1'), score: 0.7 },
      { document: createMockDocument('source-2', 'Chunk 1 from source 2'), score: 0.8 },
      { document: createMockDocument('source-2', 'Chunk 2 from source 2'), score: 0.6 },
    ];

    vi.mocked(mockVectorStore.search).mockResolvedValue(mockResults);

    const result = await engine.query('Test query');

    // Should keep only highest scoring chunk per source
    expect(result.sourcesUsed).toBe(2);
    expect(result.citations).toHaveLength(2);

    // Verify highest scoring chunk from each source is kept
    const source1Citation = result.citations.find(c => c.source === 'source-1');
    const source2Citation = result.citations.find(c => c.source === 'source-2');

    expect(source1Citation?.relevanceScore).toBe(0.9);
    expect(source2Citation?.relevanceScore).toBe(0.8);
  });

  it('should respect topK option', async () => {
    const mockResults: SearchResult[] = [
      { document: createMockDocument('source-1', 'Content 1'), score: 0.9 },
      { document: createMockDocument('source-2', 'Content 2'), score: 0.8 },
      { document: createMockDocument('source-3', 'Content 3'), score: 0.7 },
      { document: createMockDocument('source-4', 'Content 4'), score: 0.6 },
      { document: createMockDocument('source-5', 'Content 5'), score: 0.5 },
    ];

    vi.mocked(mockVectorStore.search).mockResolvedValue(mockResults);

    const result = await engine.query('Test query', { topK: 3 });

    expect(result.sourcesUsed).toBe(3);
    expect(result.citations).toHaveLength(3);

    // Should get top 3 by score
    expect(result.citations[0].relevanceScore).toBe(0.9);
    expect(result.citations[1].relevanceScore).toBe(0.8);
    expect(result.citations[2].relevanceScore).toBe(0.7);
  });

  it('should filter by domain', async () => {
    const result = await engine.query('Test query', { domain: 'example.com' });

    expect(mockVectorStore.search).toHaveBeenCalledWith(
      expect.any(Float32Array),
      expect.objectContaining({ domain: 'example.com' }),
    );
  });

  it('should use generateAnswer callback when provided', async () => {
    const mockResults: SearchResult[] = [
      { document: createMockDocument('source-1', 'AI is artificial intelligence'), score: 0.9 },
    ];

    vi.mocked(mockVectorStore.search).mockResolvedValue(mockResults);

    const mockGenerateAnswer = vi.fn().mockResolvedValue('AI stands for Artificial Intelligence.');

    const engineWithGenerator = new RAGQueryEngine(
      mockVectorStore,
      mockEmbeddingService,
      mockEventBus,
      mockGenerateAnswer,
    );

    const result = await engineWithGenerator.query('What is AI?');

    expect(mockGenerateAnswer).toHaveBeenCalledWith(
      'What is AI?',
      expect.stringContaining('AI is artificial intelligence'),
    );

    expect(result.answer).toBe('AI stands for Artificial Intelligence.');
  });

  it('should return raw context when no generateAnswer provided', async () => {
    const mockResults: SearchResult[] = [
      { document: createMockDocument('source-1', 'Raw content from search'), score: 0.9 },
    ];

    vi.mocked(mockVectorStore.search).mockResolvedValue(mockResults);

    const result = await engine.query('Test query');

    // Should return context directly without AI generation
    expect(result.answer).toContain('Raw content from search');
    expect(result.answer).toContain('Source:');
  });

  it('should create proper citations with URLs', async () => {
    const mockResults: SearchResult[] = [
      {
        document: createMockDocument('article-1', 'Content with URL', 'https://example.com/article'),
        score: 0.9,
      },
      {
        document: createMockDocument('article-2', 'Content without URL', null),
        score: 0.8,
      },
    ];

    vi.mocked(mockVectorStore.search).mockResolvedValue(mockResults);

    const result = await engine.query('Test query');

    expect(result.citations[0].sourceUrl).toBe('https://example.com/article');
    expect(result.citations[1].sourceUrl).toBe(null);
  });

  it('should create snippets from long content', async () => {
    const longContent = 'A'.repeat(500) + ' ending';

    const mockResults: SearchResult[] = [
      { document: createMockDocument('source-1', longContent), score: 0.9 },
    ];

    vi.mocked(mockVectorStore.search).mockResolvedValue(mockResults);

    const result = await engine.query('Test query');

    const snippet = result.citations[0].snippet;

    // Snippet should be truncated
    expect(snippet.length).toBeLessThan(longContent.length);
    expect(snippet).toContain('...');
  });

  it('should preserve short content as-is in snippets', async () => {
    const shortContent = 'Short content that fits.';

    const mockResults: SearchResult[] = [
      { document: createMockDocument('source-1', shortContent), score: 0.9 },
    ];

    vi.mocked(mockVectorStore.search).mockResolvedValue(mockResults);

    const result = await engine.query('Test query');

    const snippet = result.citations[0].snippet;

    expect(snippet).toBe(shortContent);
    expect(snippet).not.toContain('...');
  });

  it('should build context with proper formatting', async () => {
    const mockResults: SearchResult[] = [
      {
        document: createMockDocument('source-1', 'First piece of context', 'https://example.com/1'),
        score: 0.9,
      },
      {
        document: createMockDocument('source-2', 'Second piece of context', null),
        score: 0.8,
      },
    ];

    vi.mocked(mockVectorStore.search).mockResolvedValue(mockResults);

    const result = await engine.query('Test query');

    // Context should be in the answer (when no generateAnswer is provided)
    expect(result.answer).toContain('[1] Source:');
    expect(result.answer).toContain('[2] Source:');
    expect(result.answer).toContain('source-1 (https://example.com/1)');
    expect(result.answer).toContain('source-2');
    expect(result.answer).toContain('Relevance: 90.0%');
    expect(result.answer).toContain('Relevance: 80.0%');
    expect(result.answer).toContain('First piece of context');
    expect(result.answer).toContain('Second piece of context');
  });

  it('should calculate confidence correctly', async () => {
    const mockResults: SearchResult[] = [
      { document: createMockDocument('source-1', 'Content 1'), score: 0.8 },
      { document: createMockDocument('source-2', 'Content 2'), score: 0.6 },
      { document: createMockDocument('source-3', 'Content 3'), score: 0.4 },
    ];

    vi.mocked(mockVectorStore.search).mockResolvedValue(mockResults);

    const result = await engine.query('Test query');

    // Confidence should be average of scores: (0.8 + 0.6 + 0.4) / 3 = 0.6
    expect(result.confidence).toBeCloseTo(0.6, 2);
  });

  it('should handle generateAnswer errors gracefully', async () => {
    const mockResults: SearchResult[] = [
      { document: createMockDocument('source-1', 'Content'), score: 0.9 },
    ];

    vi.mocked(mockVectorStore.search).mockResolvedValue(mockResults);

    const failingGenerator = vi.fn().mockRejectedValue(new Error('AI generation failed'));

    const engineWithGenerator = new RAGQueryEngine(
      mockVectorStore,
      mockEmbeddingService,
      mockEventBus,
      failingGenerator,
    );

    await expect(engineWithGenerator.query('Test query')).rejects.toThrow('AI generation failed');
  });

  it('should emit knowledge:searched event', async () => {
    const mockResults: SearchResult[] = [
      { document: createMockDocument('source-1', 'Content'), score: 0.9 },
    ];

    vi.mocked(mockVectorStore.search).mockResolvedValue(mockResults);

    await engine.query('What is the answer?');

    expect(mockEventBus.emit).toHaveBeenCalledWith('knowledge:searched', {
      query: 'What is the answer?',
      resultCount: 1,
    });
  });

  it.skip('should handle empty query embedding', async () => {
    await expect(engine.query('')).rejects.toThrow();

    // EmbeddingService should throw on empty input
    expect(mockEmbeddingService.embed).toHaveBeenCalledWith('');
  });

  it('should sort deduplicated results by score', async () => {
    const mockResults: SearchResult[] = [
      { document: createMockDocument('source-1', 'Content 1'), score: 0.5 },
      { document: createMockDocument('source-2', 'Content 2'), score: 0.9 },
      { document: createMockDocument('source-3', 'Content 3'), score: 0.7 },
    ];

    vi.mocked(mockVectorStore.search).mockResolvedValue(mockResults);

    const result = await engine.query('Test query');

    // Results should be sorted by score descending
    expect(result.citations[0].relevanceScore).toBe(0.9);
    expect(result.citations[1].relevanceScore).toBe(0.7);
    expect(result.citations[2].relevanceScore).toBe(0.5);
  });
});
