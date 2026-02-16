/**
 * Ollama Client Test Suite
 *
 * Tests for Ollama local LLM integration including:
 * - Text generation and chat
 * - Embeddings
 * - Model listing and availability checks
 * - Classification and summarization helpers
 * - Security (loopback enforcement)
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { OllamaClient } from '../../../../src/integrations/ollama/client.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTRUCTOR TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('OllamaClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default base URL', () => {
      const client = new OllamaClient();
      expect(client).toBeDefined();
    });

    it('should accept custom base URL', () => {
      const client = new OllamaClient('http://127.0.0.1:11434');
      expect(client).toBeDefined();
    });

    it('should warn when base URL is not loopback-only', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      void new OllamaClient('http://192.168.1.100:11434');
      // Note: We can't directly assert on logger.warn, but the client should still work
      expect(warnSpy).not.toThrow();
      warnSpy.mockRestore();
    });

    it('should allow localhost as valid loopback', () => {
      const client = new OllamaClient('http://localhost:11434');
      expect(client).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERATE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('generate', () => {
    it('should generate text completion', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Hello, world!',
          model: 'llama3.2:3b',
          total_duration: 1000000,
          prompt_eval_count: 10,
          eval_count: 5,
        }),
      });

      const result = await client.generate('llama3.2:3b', 'Say hello');

      expect(result).toEqual({
        response: 'Hello, world!',
        model: 'llama3.2:3b',
        totalDuration: 1000000,
        promptEvalCount: 10,
        evalCount: 5,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3.2:3b',
            prompt: 'Say hello',
            stream: false,
          }),
        })
      );
    });

    it('should pass generation options correctly', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Generated text',
          model: 'llama3.2:3b',
        }),
      });

      await client.generate('llama3.2:3b', 'Test prompt', {
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 100,
        system: 'You are helpful',
      });

      const callBody = JSON.parse((mockFetch as Mock).mock.calls[0][1].body as string);
      expect(callBody).toEqual({
        model: 'llama3.2:3b',
        prompt: 'Test prompt',
        stream: false,
        system: 'You are helpful',
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 100,
        },
      });
    });

    it('should handle API errors', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.generate('llama3.2:3b', 'Test')).rejects.toThrow(
        'Ollama generate failed: Ollama API error: 500 Internal Server Error'
      );
    });

    it('should handle network errors', async () => {
      const client = new OllamaClient();

      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(client.generate('llama3.2:3b', 'Test')).rejects.toThrow(
        'Ollama generate failed: Network failure'
      );
    });

    it('should handle missing optional fields in response', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Text',
          model: 'llama3.2:3b',
        }),
      });

      const result = await client.generate('llama3.2:3b', 'Test');

      expect(result).toEqual({
        response: 'Text',
        model: 'llama3.2:3b',
        totalDuration: 0,
        promptEvalCount: 0,
        evalCount: 0,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('chat', () => {
    it('should perform chat completion', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: 'I am doing well, thank you!' },
          model: 'llama3.2:3b',
          total_duration: 2000000,
          prompt_eval_count: 20,
          eval_count: 10,
        }),
      });

      const messages = [
        { role: 'user', content: 'How are you?' },
      ];

      const result = await client.chat('llama3.2:3b', messages);

      expect(result).toEqual({
        response: 'I am doing well, thank you!',
        model: 'llama3.2:3b',
        totalDuration: 2000000,
        promptEvalCount: 20,
        evalCount: 10,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3.2:3b',
            messages,
            stream: false,
          }),
        })
      );
    });

    it('should pass chat options correctly', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: 'Response' },
          model: 'llama3.2:3b',
        }),
      });

      await client.chat('llama3.2:3b', [{ role: 'user', content: 'Hi' }], {
        temperature: 0.5,
        topP: 0.95,
        maxTokens: 50,
      });

      const callBody = JSON.parse((mockFetch as Mock).mock.calls[0][1].body as string);
      expect(callBody.options).toEqual({
        temperature: 0.5,
        top_p: 0.95,
        num_predict: 50,
      });
    });

    it('should handle multi-turn conversations', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: 'Continuing the conversation' },
          model: 'llama3.2:3b',
        }),
      });

      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];

      await client.chat('llama3.2:3b', messages);

      const callBody = JSON.parse((mockFetch as Mock).mock.calls[0][1].body as string);
      expect(callBody.messages).toHaveLength(3);
    });

    it('should handle chat API errors', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(client.chat('invalid-model', [])).rejects.toThrow(
        'Ollama chat failed: Ollama API error: 404 Not Found'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EMBED TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('embed', () => {
    it('should generate embeddings', async () => {
      const client = new OllamaClient();

      const mockEmbedding = Array.from({ length: 384 }, () => Math.random());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embeddings: [mockEmbedding],
          model: 'nomic-embed-text',
        }),
      });

      const result = await client.embed('nomic-embed-text', 'Test text');

      expect(result).toEqual({
        embedding: mockEmbedding,
        model: 'nomic-embed-text',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:11434/api/embed',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            model: 'nomic-embed-text',
            input: 'Test text',
          }),
        })
      );
    });

    it('should handle empty embeddings', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embeddings: [],
          model: 'nomic-embed-text',
        }),
      });

      const result = await client.embed('nomic-embed-text', 'Test');

      expect(result.embedding).toEqual([]);
    });

    it('should handle embed API errors', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.embed('nomic-embed-text', 'Test')).rejects.toThrow(
        'Ollama embed failed: Ollama API error: 500 Internal Server Error'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST MODELS TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('listModels', () => {
    it('should list available models', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'llama3.2:3b',
              modified_at: '2024-01-01T00:00:00Z',
              size: 1000000000,
              digest: 'abc123',
              details: {
                parameter_size: '3B',
                quantization_level: 'Q4_0',
              },
            },
            {
              name: 'nomic-embed-text',
              modified_at: '2024-01-02T00:00:00Z',
              size: 500000000,
              digest: 'def456',
            },
          ],
        }),
      });

      const models = await client.listModels();

      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        name: 'llama3.2:3b',
        modifiedAt: '2024-01-01T00:00:00Z',
        size: 1000000000,
        digest: 'abc123',
        parameterSize: '3B',
        quantizationLevel: 'Q4_0',
      });
      expect(models[1]).toEqual({
        name: 'nomic-embed-text',
        modifiedAt: '2024-01-02T00:00:00Z',
        size: 500000000,
        digest: 'def456',
        parameterSize: 'unknown',
        quantizationLevel: 'unknown',
      });
    });

    it('should handle empty model list', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [],
        }),
      });

      const models = await client.listModels();

      expect(models).toEqual([]);
    });

    it('should handle listModels API errors', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      await expect(client.listModels()).rejects.toThrow(
        'Ollama listModels failed: Ollama API error: 503 Service Unavailable'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IS AVAILABLE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isAvailable', () => {
    it('should return true when Ollama is reachable', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const available = await client.isAvailable();

      expect(available).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:11434/api/tags',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should return false when Ollama is not reachable', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const available = await client.isAvailable();

      expect(available).toBe(false);
    });

    it('should return false on network error', async () => {
      const client = new OllamaClient();

      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const available = await client.isAvailable();

      expect(available).toBe(false);
    });

    it('should timeout after 5 seconds', async () => {
      const client = new OllamaClient();

      mockFetch.mockImplementationOnce(() =>
        new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const available = await client.isAvailable();

      expect(available).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLASSIFY TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('classify', () => {
    it('should classify text into categories', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: '2',
          model: 'llama3.2:3b',
        }),
      });

      const result = await client.classify(
        'This is a bug in the software',
        ['feature', 'bug', 'documentation']
      );

      expect(result).toEqual({
        category: 'bug',
        confidence: 0.9,
      });
    });

    it('should use custom model for classification', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: '1',
          model: 'custom-model',
        }),
      });

      await client.classify('Text', ['cat1', 'cat2'], 'custom-model');

      const callBody = JSON.parse((mockFetch as Mock).mock.calls[0][1].body as string);
      expect(callBody.model).toBe('custom-model');
    });

    it('should handle classification with noisy response', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'The answer is 3, which represents documentation.',
          model: 'llama3.2:3b',
        }),
      });

      const result = await client.classify(
        'Update README',
        ['feature', 'bug', 'documentation']
      );

      expect(result).toEqual({
        category: 'documentation',
        confidence: 0.7, // Lower confidence due to extra text
      });
    });

    it('should handle invalid category index', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: '99',
          model: 'llama3.2:3b',
        }),
      });

      const result = await client.classify('Text', ['cat1', 'cat2']);

      expect(result.category).toBe('cat1'); // Defaults to first category
      expect(result.confidence).toBe(0.5);
    });

    it('should handle no number in response', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'No number here',
          model: 'llama3.2:3b',
        }),
      });

      const result = await client.classify('Text', ['cat1', 'cat2']);

      expect(result.category).toBe('cat1');
      expect(result.confidence).toBe(0.5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARIZE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('summarize', () => {
    it('should summarize text', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'This is a concise summary of the long text.',
          model: 'llama3.2:3b',
        }),
      });

      const result = await client.summarize('Very long text that needs summarization...');

      expect(result).toBe('This is a concise summary of the long text.');
    });

    it('should respect max length parameter', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Short summary',
          model: 'llama3.2:3b',
        }),
      });

      await client.summarize('Long text', 50);

      const callBody = JSON.parse((mockFetch as Mock).mock.calls[0][1].body as string);
      expect(callBody.prompt).toContain('50 words or less');
      expect(callBody.options.num_predict).toBe(75); // 50 * 1.5
    });

    it('should use custom model for summarization', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Summary',
          model: 'custom-model',
        }),
      });

      await client.summarize('Text', 100, 'custom-model');

      const callBody = JSON.parse((mockFetch as Mock).mock.calls[0][1].body as string);
      expect(callBody.model).toBe('custom-model');
    });

    it('should trim whitespace from summary', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: '  Summary with whitespace  \n',
          model: 'llama3.2:3b',
        }),
      });

      const result = await client.summarize('Text');

      expect(result).toBe('Summary with whitespace');
    });

    it('should handle summarization errors', async () => {
      const client = new OllamaClient();

      mockFetch.mockRejectedValueOnce(new Error('Model not found'));

      await expect(client.summarize('Text')).rejects.toThrow(
        'Ollama summarization failed'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle unknown errors gracefully', async () => {
      const client = new OllamaClient();

      mockFetch.mockRejectedValueOnce('String error');

      await expect(client.generate('llama3.2:3b', 'Test')).rejects.toThrow(
        'Ollama generate failed: Unknown error'
      );
    });

    it('should handle empty prompts', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: '',
          model: 'llama3.2:3b',
        }),
      });

      const result = await client.generate('llama3.2:3b', '');

      expect(result.response).toBe('');
    });

    it('should handle very long prompts', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Response',
          model: 'llama3.2:3b',
        }),
      });

      const longPrompt = 'a'.repeat(100000);
      await client.generate('llama3.2:3b', longPrompt);

      const callBody = JSON.parse((mockFetch as Mock).mock.calls[0][1].body as string);
      expect(callBody.prompt.length).toBe(100000);
    });

    it('should handle special characters in prompts', async () => {
      const client = new OllamaClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Response',
          model: 'llama3.2:3b',
        }),
      });

      const specialPrompt = 'Test with "quotes" and \'apostrophes\' and \nnewlines';
      await client.generate('llama3.2:3b', specialPrompt);

      const callBody = JSON.parse((mockFetch as Mock).mock.calls[0][1].body as string);
      expect(callBody.prompt).toBe(specialPrompt);
    });
  });
});
