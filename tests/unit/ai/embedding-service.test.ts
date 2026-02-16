import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { EmbeddingService } from '../../../src/ai/embedding-service.js';
import type { EventBus } from '../../../src/kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      embeddings: {
        create: vi.fn(),
      },
    })),
  };
});

function createMockEventBus(): EventBus {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    clear: vi.fn(),
    listenerCount: vi.fn(),
    getHandlerErrorCount: vi.fn(),
    setHandlerTimeout: vi.fn(),
  } as unknown as EventBus;
}

function createMockEmbeddingResponse(texts: string[], model = 'text-embedding-3-small') {
  return {
    data: texts.map((_, index) => ({
      embedding: Array(1536).fill(0).map(() => Math.random()),
      index,
      object: 'embedding',
    })),
    model,
    usage: {
      prompt_tokens: texts.length * 10,
      total_tokens: texts.length * 10,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockEventBus: EventBus;
  let mockCreate: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';

    mockEventBus = createMockEventBus();

    // Get the mocked OpenAI constructor
    const OpenAIMock = (await import('openai')).default as unknown as Mock;
    const mockInstance = {
      embeddings: {
        create: vi.fn(),
      },
    };
    OpenAIMock.mockImplementation(() => mockInstance);
    mockCreate = mockInstance.embeddings.create;

    service = new EmbeddingService(mockEventBus);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONSTRUCTION
  // ─────────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create service with API key from options', async () => {
      delete process.env.OPENAI_API_KEY;
      const newService = new EmbeddingService(mockEventBus, { apiKey: 'custom-key' });
      expect(newService).toBeInstanceOf(EmbeddingService);
    });

    it('should create service with API key from environment', () => {
      process.env.OPENAI_API_KEY = 'env-api-key';
      const newService = new EmbeddingService(mockEventBus);
      expect(newService).toBeInstanceOf(EmbeddingService);
    });

    it('should throw error when no API key is provided', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => new EmbeddingService(mockEventBus)).toThrow('OpenAI API key required');
    });

    it('should accept custom maxBatchSize option', () => {
      const newService = new EmbeddingService(mockEventBus, { maxBatchSize: 100 });
      expect(newService).toBeInstanceOf(EmbeddingService);
    });

    it('should accept custom cacheMaxSize option', () => {
      const newService = new EmbeddingService(mockEventBus, { cacheMaxSize: 5000 });
      expect(newService).toBeInstanceOf(EmbeddingService);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SINGLE EMBEDDING
  // ─────────────────────────────────────────────────────────────────────────────

  describe('embed', () => {
    it('should generate embedding for valid text', async () => {
      mockCreate.mockResolvedValueOnce(createMockEmbeddingResponse(['Hello world']));

      const result = await service.embed('Hello world');

      expect(result.embedding).toBeInstanceOf(Float32Array);
      expect(result.embedding.length).toBe(1536);
      expect(result.model).toBe('text-embedding-3-small');
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.cached).toBe(false);
    });

    it('should throw error for empty text', async () => {
      await expect(service.embed('')).rejects.toThrow('Text cannot be empty');
    });

    it('should throw error for whitespace-only text', async () => {
      await expect(service.embed('   ')).rejects.toThrow('Text cannot be empty');
    });

    it('should return cached result on second call with same text', async () => {
      mockCreate.mockResolvedValueOnce(createMockEmbeddingResponse(['Same text']));

      const result1 = await service.embed('Same text');
      const result2 = await service.embed('Same text');

      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(true);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should call API for different texts', async () => {
      mockCreate
        .mockResolvedValueOnce(createMockEmbeddingResponse(['Text A']))
        .mockResolvedValueOnce(createMockEmbeddingResponse(['Text B']));

      await service.embed('Text A');
      await service.embed('Text B');

      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // BATCH EMBEDDING
  // ─────────────────────────────────────────────────────────────────────────────

  describe('embedBatch', () => {
    it('should return empty array for empty input', async () => {
      const results = await service.embedBatch([]);
      expect(results).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should generate embeddings for multiple texts', async () => {
      const texts = ['Text one', 'Text two', 'Text three'];
      mockCreate.mockResolvedValueOnce(createMockEmbeddingResponse(texts));

      const results = await service.embedBatch(texts);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.embedding).toBeInstanceOf(Float32Array);
        expect(result.embedding.length).toBe(1536);
        expect(result.cached).toBe(false);
      });
    });

    it('should throw error if any text is empty', async () => {
      await expect(service.embedBatch(['Valid', '', 'Also valid'])).rejects.toThrow(
        'Text at index 1 cannot be empty'
      );
    });

    it('should use cache for previously embedded texts', async () => {
      mockCreate
        .mockResolvedValueOnce(createMockEmbeddingResponse(['Cached text']))
        .mockResolvedValueOnce(createMockEmbeddingResponse(['New text']));

      // First embed single text
      await service.embed('Cached text');

      // Then batch with mix of cached and new
      const results = await service.embedBatch(['Cached text', 'New text']);

      expect(results[0].cached).toBe(true);
      expect(results[1].cached).toBe(false);
      expect(mockCreate).toHaveBeenCalledTimes(2); // First call + batch call for uncached
    });

    it('should maintain correct order in results', async () => {
      mockCreate.mockResolvedValueOnce({
        data: [
          { embedding: Array(1536).fill(0.1), index: 0, object: 'embedding' },
          { embedding: Array(1536).fill(0.2), index: 1, object: 'embedding' },
          { embedding: Array(1536).fill(0.3), index: 2, object: 'embedding' },
        ],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 30, total_tokens: 30 },
      });

      const results = await service.embedBatch(['First', 'Second', 'Third']);

      expect(results[0].embedding[0]).toBeCloseTo(0.1);
      expect(results[1].embedding[0]).toBeCloseTo(0.2);
      expect(results[2].embedding[0]).toBeCloseTo(0.3);
    });

    it('should batch requests when exceeding maxBatchSize', async () => {
      const smallBatchService = new EmbeddingService(mockEventBus, { maxBatchSize: 2 });

      mockCreate
        .mockResolvedValueOnce(createMockEmbeddingResponse(['A', 'B']))
        .mockResolvedValueOnce(createMockEmbeddingResponse(['C']));

      await smallBatchService.embedBatch(['A', 'B', 'C']);

      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CACHE STATISTICS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getCacheStats', () => {
    it('should return initial stats of zero', () => {
      const stats = service.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });

    it('should track cache misses', async () => {
      mockCreate.mockResolvedValue(createMockEmbeddingResponse(['Text']));

      await service.embed('Text 1');
      await service.embed('Text 2');

      const stats = service.getCacheStats();
      expect(stats.misses).toBe(2);
      expect(stats.size).toBe(2);
    });

    it('should track cache hits', async () => {
      mockCreate.mockResolvedValueOnce(createMockEmbeddingResponse(['Text']));

      await service.embed('Same text');
      await service.embed('Same text');
      await service.embed('Same text');

      const stats = service.getCacheStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should track hits and misses in batch operations', async () => {
      mockCreate
        .mockResolvedValueOnce(createMockEmbeddingResponse(['A']))
        .mockResolvedValueOnce(createMockEmbeddingResponse(['B', 'C']));

      await service.embed('A');
      await service.embedBatch(['A', 'B', 'C']);

      const stats = service.getCacheStats();
      expect(stats.hits).toBe(1); // 'A' was cached
      expect(stats.misses).toBe(3); // 'A' miss, 'B' miss, 'C' miss
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CACHE CLEARING
  // ─────────────────────────────────────────────────────────────────────────────

  describe('clearCache', () => {
    it('should clear all cached entries', async () => {
      mockCreate.mockResolvedValue(createMockEmbeddingResponse(['Text']));

      await service.embed('Text 1');
      await service.embed('Text 2');

      expect(service.getCacheStats().size).toBe(2);

      service.clearCache();

      expect(service.getCacheStats().size).toBe(0);
    });

    it('should reset hit and miss counters', async () => {
      mockCreate.mockResolvedValue(createMockEmbeddingResponse(['Text']));

      await service.embed('Text');
      await service.embed('Text');

      service.clearCache();

      const stats = service.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should require fresh API calls after clearing', async () => {
      mockCreate.mockResolvedValue(createMockEmbeddingResponse(['Text']));

      await service.embed('Same text');
      service.clearCache();
      await service.embed('Same text');

      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CACHE EVICTION
  // ─────────────────────────────────────────────────────────────────────────────

  describe('cache eviction', () => {
    it('should evict oldest entry when cache is full', async () => {
      const tinyService = new EmbeddingService(mockEventBus, { cacheMaxSize: 2 });
      mockCreate.mockResolvedValue(createMockEmbeddingResponse(['Text']));

      await tinyService.embed('First');
      await tinyService.embed('Second');
      await tinyService.embed('Third');

      const stats = tinyService.getCacheStats();
      expect(stats.size).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // COST TRACKING EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('cost tracking events', () => {
    it('should emit llm:request_complete event on successful embedding', async () => {
      mockCreate.mockResolvedValueOnce(createMockEmbeddingResponse(['Text']));

      await service.embed('Text');

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'llm:request_complete',
        expect.objectContaining({
          model: 'text-embedding-3-small',
          inputTokens: expect.any(Number),
          outputTokens: 0,
          cost: expect.any(Number),
          taskType: 'embedding',
          taskCategory: 'analysis',
          duration: expect.any(Number),
          success: true,
        })
      );
    });

    it('should calculate cost based on token usage', async () => {
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: Array(1536).fill(0), index: 0, object: 'embedding' }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 1000000, total_tokens: 1000000 },
      });

      await service.embed('Text');

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'llm:request_complete',
        expect.objectContaining({
          cost: 0.02, // $0.02 per 1M tokens
        })
      );
    });

    it('should not emit event for cached results', async () => {
      mockCreate.mockResolvedValueOnce(createMockEmbeddingResponse(['Text']));

      await service.embed('Same text');
      vi.mocked(mockEventBus.emit).mockClear();

      await service.embed('Same text');

      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('should emit event for each batch API call', async () => {
      const smallBatchService = new EmbeddingService(mockEventBus, { maxBatchSize: 2 });
      mockCreate
        .mockResolvedValueOnce(createMockEmbeddingResponse(['A', 'B']))
        .mockResolvedValueOnce(createMockEmbeddingResponse(['C']));

      await smallBatchService.embedBatch(['A', 'B', 'C']);

      expect(mockEventBus.emit).toHaveBeenCalledTimes(2);
    });

    it('should include timestamp in event payload', async () => {
      mockCreate.mockResolvedValueOnce(createMockEmbeddingResponse(['Text']));

      await service.embed('Text');

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'llm:request_complete',
        expect.objectContaining({
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        })
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ERROR HANDLING
  // ─────────────────────────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should propagate API errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API rate limited'));

      await expect(service.embed('Text')).rejects.toThrow('API rate limited');
    });

    it('should not cache failed requests', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(createMockEmbeddingResponse(['Text']));

      await expect(service.embed('Text')).rejects.toThrow('First attempt failed');

      // Retry should work
      const result = await service.embed('Text');
      expect(result.cached).toBe(false);
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockCreate.mockRejectedValueOnce(timeoutError);

      await expect(service.embed('Text')).rejects.toThrow('Request timeout');
    });

    it('should handle malformed API responses gracefully', async () => {
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: [], index: 0 }],
        model: 'text-embedding-3-small',
        usage: { total_tokens: 10 },
      });

      const result = await service.embed('Text');
      expect(result.embedding.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EMBEDDING QUALITY
  // ─────────────────────────────────────────────────────────────────────────────

  describe('embedding quality', () => {
    it('should return Float32Array with correct dimensions', async () => {
      mockCreate.mockResolvedValueOnce(createMockEmbeddingResponse(['Text']));

      const result = await service.embed('Text');

      expect(result.embedding).toBeInstanceOf(Float32Array);
      expect(result.embedding.length).toBe(1536);
    });

    it('should return consistent embeddings for same text from cache', async () => {
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: Array(1536).fill(0.5), index: 0, object: 'embedding' }],
        model: 'text-embedding-3-small',
        usage: { total_tokens: 10 },
      });

      const result1 = await service.embed('Consistent text');
      const result2 = await service.embed('Consistent text');

      expect(result1.embedding[0]).toBe(result2.embedding[0]);
      expect(result1.embedding[100]).toBe(result2.embedding[100]);
    });
  });
});
