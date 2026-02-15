import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EmbeddingService } from '../../../src/ai/embedding-service.js';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    // Save original API key
    originalApiKey = process.env.OPENAI_API_KEY;

    // Set test API key
    process.env.OPENAI_API_KEY = 'test-api-key';

    service = new EmbeddingService('openai');
  });

  afterEach(() => {
    // Restore original API key
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }

    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with openai provider', () => {
      const svc = new EmbeddingService('openai');
      expect(svc.getDimension()).toBe(1536);
    });

    it('should initialize with gemini provider', () => {
      const svc = new EmbeddingService('gemini');
      expect(svc.getDimension()).toBe(1536);
    });

    it('should default to openai provider', () => {
      const svc = new EmbeddingService();
      expect(svc.getDimension()).toBe(1536);
    });
  });

  describe('embed', () => {
    it('should throw if OPENAI_API_KEY not set', async () => {
      delete process.env.OPENAI_API_KEY;
      const svc = new EmbeddingService('openai');

      await expect(svc.embed('test')).rejects.toThrow('OPENAI_API_KEY environment variable not set');
    });

    it('should throw on empty text', async () => {
      await expect(service.embed('')).rejects.toThrow('Cannot embed empty text');
      await expect(service.embed('   ')).rejects.toThrow('Cannot embed empty text');
    });

    it('should call OpenAI API with correct parameters', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        data: [
          {
            embedding: new Array(1536).fill(0).map((_, i) => i / 1536),
          },
        ],
      });

      // Mock the OpenAI import
      vi.doMock('openai', () => ({
        OpenAI: class {
          embeddings = {
            create: mockCreate,
          };
        },
      }));

      const result = await service.embed('Test text');

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(1536);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'Test text',
        encoding_format: 'float',
      });
    });

    it('should return Float32Array', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        data: [
          {
            embedding: [0.1, 0.2, 0.3],
          },
        ],
      });

      vi.doMock('openai', () => ({
        OpenAI: class {
          embeddings = {
            create: mockCreate,
          };
        },
      }));

      const result = await service.embed('Test');

      expect(result).toBeInstanceOf(Float32Array);
      expect(result[0]).toBeCloseTo(0.1, 2);
      expect(result[1]).toBeCloseTo(0.2, 2);
      expect(result[2]).toBeCloseTo(0.3, 2);
    });

    it('should throw on OpenAI API error', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('API error'));

      vi.doMock('openai', () => ({
        OpenAI: class {
          embeddings = {
            create: mockCreate,
          };
        },
      }));

      await expect(service.embed('Test')).rejects.toThrow('OpenAI embedding failed');
    });

    it('should throw if OpenAI returns no data', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ data: [] });

      vi.doMock('openai', () => ({
        OpenAI: class {
          embeddings = {
            create: mockCreate,
          };
        },
      }));

      await expect(service.embed('Test')).rejects.toThrow('OpenAI returned no embeddings');
    });

    it('should throw for unsupported provider', async () => {
      const svc = new EmbeddingService('gemini');
      await expect(svc.embed('Test')).rejects.toThrow('Gemini embedding not yet implemented');
    });
  });

  describe('embedBatch', () => {
    it('should throw if OPENAI_API_KEY not set', async () => {
      delete process.env.OPENAI_API_KEY;
      const svc = new EmbeddingService('openai');

      await expect(svc.embedBatch(['test'])).rejects.toThrow('OPENAI_API_KEY environment variable not set');
    });

    it('should return empty array for empty input', async () => {
      const result = await service.embedBatch([]);
      expect(result).toEqual([]);
    });

    it('should throw on all empty texts', async () => {
      await expect(service.embedBatch(['', '   '])).rejects.toThrow('Cannot embed empty texts');
    });

    it('should filter out empty texts', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        data: [
          { embedding: [0.1, 0.2] },
          { embedding: [0.3, 0.4] },
        ],
      });

      vi.doMock('openai', () => ({
        OpenAI: class {
          embeddings = {
            create: mockCreate,
          };
        },
      }));

      const result = await service.embedBatch(['Text 1', '', 'Text 2', '   ']);

      expect(result.length).toBe(2);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['Text 1', 'Text 2'],
        encoding_format: 'float',
      });
    });

    it('should call OpenAI API with batch of texts', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        data: [
          { embedding: new Array(1536).fill(0.1) },
          { embedding: new Array(1536).fill(0.2) },
          { embedding: new Array(1536).fill(0.3) },
        ],
      });

      vi.doMock('openai', () => ({
        OpenAI: class {
          embeddings = {
            create: mockCreate,
          };
        },
      }));

      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const result = await service.embedBatch(texts);

      expect(result.length).toBe(3);
      expect(result[0]).toBeInstanceOf(Float32Array);
      expect(result[0].length).toBe(1536);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: texts,
        encoding_format: 'float',
      });
    });

    it('should return array of Float32Arrays', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        data: [
          { embedding: [0.1, 0.2] },
          { embedding: [0.3, 0.4] },
        ],
      });

      vi.doMock('openai', () => ({
        OpenAI: class {
          embeddings = {
            create: mockCreate,
          };
        },
      }));

      const result = await service.embedBatch(['Text 1', 'Text 2']);

      expect(result.length).toBe(2);
      expect(result[0]).toBeInstanceOf(Float32Array);
      expect(result[1]).toBeInstanceOf(Float32Array);
      expect(result[0][0]).toBeCloseTo(0.1, 2);
      expect(result[0][1]).toBeCloseTo(0.2, 2);
      expect(result[1][0]).toBeCloseTo(0.3, 2);
      expect(result[1][1]).toBeCloseTo(0.4, 2);
    });

    it('should throw on OpenAI API error', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Batch API error'));

      vi.doMock('openai', () => ({
        OpenAI: class {
          embeddings = {
            create: mockCreate,
          };
        },
      }));

      await expect(service.embedBatch(['Test'])).rejects.toThrow('OpenAI batch embedding failed');
    });

    it('should throw for unsupported provider', async () => {
      const svc = new EmbeddingService('gemini');
      await expect(svc.embedBatch(['Test'])).rejects.toThrow('Gemini batch embedding not yet implemented');
    });
  });

  describe('getDimension', () => {
    it('should return 1536 for OpenAI text-embedding-3-small', () => {
      const svc = new EmbeddingService('openai');
      expect(svc.getDimension()).toBe(1536);
    });

    it('should return 1536 for Gemini (placeholder)', () => {
      const svc = new EmbeddingService('gemini');
      expect(svc.getDimension()).toBe(1536);
    });
  });
});
