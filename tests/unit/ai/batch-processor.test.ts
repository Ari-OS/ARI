import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BatchProcessor } from '../../../src/ai/batch-processor.js';
import type { BatchRequest, BatchResult, BatchStatus } from '../../../src/ai/batch-processor.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('BatchProcessor', () => {
  let processor: BatchProcessor;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    processor = new BatchProcessor(mockApiKey, { maxQueueSize: 3, autoFlush: false });
    vi.mocked(fetch).mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const p = new BatchProcessor(mockApiKey);
      expect(p.getQueueSize()).toBe(0);
    });

    it('should initialize with custom options', () => {
      const p = new BatchProcessor(mockApiKey, {
        maxQueueSize: 5,
        flushIntervalMs: 30000,
        autoFlush: true,
      });
      expect(p.getQueueSize()).toBe(0);
    });
  });

  describe('queue', () => {
    it('should queue a request and return request ID', () => {
      const requestId = processor.queue({
        model: 'claude-sonnet-4.5',
        userMessage: 'Test message',
        priority: 'normal',
      });

      expect(requestId).toMatch(/^req_\d+_/);
      expect(processor.getQueueSize()).toBe(1);
    });

    it('should queue multiple requests', () => {
      processor.queue({
        model: 'claude-sonnet-4.5',
        userMessage: 'Message 1',
        priority: 'normal',
      });

      processor.queue({
        model: 'claude-opus-4.6',
        userMessage: 'Message 2',
        systemPrompt: 'System prompt',
        priority: 'low',
      });

      expect(processor.getQueueSize()).toBe(2);
    });

    it('should auto-flush when max queue size reached', async () => {
      const mockBatchResponse = {
        id: 'batch_123',
        type: 'message_batch',
        processing_status: 'pending',
        request_counts: {
          processing: 3,
          succeeded: 0,
          errored: 0,
          canceled: 0,
          expired: 0,
        },
        created_at: '2026-02-16T10:00:00Z',
        expires_at: '2026-02-17T10:00:00Z',
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockBatchResponse,
      } as Response);

      processor.queue({ model: 'claude-sonnet-4.5', userMessage: 'Message 1', priority: 'normal' });
      processor.queue({ model: 'claude-sonnet-4.5', userMessage: 'Message 2', priority: 'normal' });
      processor.queue({ model: 'claude-sonnet-4.5', userMessage: 'Message 3', priority: 'normal' });

      // Wait a bit for async flush
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages/batches',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should include all request fields in queue', () => {
      const requestId = processor.queue({
        model: 'claude-opus-4.6',
        userMessage: 'Test',
        systemPrompt: 'You are helpful',
        maxTokens: 2048,
        priority: 'low',
        metadata: { userId: '123' },
      });

      expect(requestId).toBeTruthy();
      expect(processor.getQueueSize()).toBe(1);
    });
  });

  describe('flush', () => {
    it('should flush queued requests and return batch status', async () => {
      const mockResponse = {
        id: 'batch_abc123',
        type: 'message_batch',
        processing_status: 'pending',
        request_counts: {
          processing: 2,
          succeeded: 0,
          errored: 0,
          canceled: 0,
          expired: 0,
        },
        created_at: '2026-02-16T10:00:00Z',
        expires_at: '2026-02-17T10:00:00Z',
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      processor.queue({ model: 'claude-sonnet-4.5', userMessage: 'Message 1', priority: 'normal' });
      processor.queue({ model: 'claude-opus-4.6', userMessage: 'Message 2', priority: 'low' });

      const status = await processor.flush();

      expect(status.batchId).toBe('batch_abc123');
      expect(status.status).toBe('pending');
      expect(status.totalRequests).toBe(2);
      expect(processor.getQueueSize()).toBe(0);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages/batches',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': mockApiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          }),
        }),
      );
    });

    it('should throw error when queue is empty', async () => {
      await expect(processor.flush()).rejects.toThrow('Queue is empty');
    });

    it('should re-queue requests on failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      processor.queue({ model: 'claude-sonnet-4.5', userMessage: 'Message 1', priority: 'normal' });

      await expect(processor.flush()).rejects.toThrow('Failed to submit batch');
      expect(processor.getQueueSize()).toBe(1); // Request re-queued
    });

    it('should include system prompt in batch request', async () => {
      const mockResponse = {
        id: 'batch_123',
        type: 'message_batch',
        processing_status: 'pending',
        request_counts: {
          processing: 1,
          succeeded: 0,
          errored: 0,
          canceled: 0,
          expired: 0,
        },
        created_at: '2026-02-16T10:00:00Z',
        expires_at: '2026-02-17T10:00:00Z',
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      processor.queue({
        model: 'claude-sonnet-4.5',
        userMessage: 'Test',
        systemPrompt: 'Be helpful',
        priority: 'normal',
      });

      await processor.flush();

      const callArg = vi.mocked(fetch).mock.calls[0]?.[1];
      const body = JSON.parse(callArg?.body as string) as {
        requests: Array<{ params: { system?: string } }>;
      };
      expect(body.requests[0]?.params.system).toBe('Be helpful');
    });
  });

  describe('getStatus', () => {
    it('should fetch batch status from API', async () => {
      const mockResponse = {
        id: 'batch_123',
        type: 'message_batch',
        processing_status: 'in_progress',
        request_counts: {
          processing: 5,
          succeeded: 3,
          errored: 1,
          canceled: 0,
          expired: 0,
        },
        created_at: '2026-02-16T10:00:00Z',
        expires_at: '2026-02-17T10:00:00Z',
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const status = await processor.getStatus('batch_123');

      expect(status.batchId).toBe('batch_123');
      expect(status.status).toBe('in_progress');
      expect(status.completedRequests).toBe(3);
      expect(status.failedRequests).toBe(1);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages/batches/batch_123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'x-api-key': mockApiKey,
            'anthropic-version': '2023-06-01',
          }),
        }),
      );
    });

    it('should throw error on API failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(processor.getStatus('batch_invalid')).rejects.toThrow('Failed to get batch status');
    });

    it('should map completed status correctly', async () => {
      const mockResponse = {
        id: 'batch_123',
        type: 'message_batch',
        processing_status: 'ended',
        request_counts: {
          processing: 0,
          succeeded: 10,
          errored: 0,
          canceled: 0,
          expired: 0,
        },
        created_at: '2026-02-16T10:00:00Z',
        expires_at: '2026-02-17T10:00:00Z',
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const status = await processor.getStatus('batch_123');
      expect(status.status).toBe('completed');
    });
  });

  describe('getResults', () => {
    it('should poll and retrieve batch results', async () => {
      const mockBatchResponse = {
        id: 'batch_xyz',
        type: 'message_batch',
        processing_status: 'pending',
        request_counts: {
          processing: 1,
          succeeded: 0,
          errored: 0,
          canceled: 0,
          expired: 0,
        },
        created_at: '2026-02-16T10:00:00Z',
        expires_at: '2026-02-17T10:00:00Z',
      };

      const mockStatusResponse = {
        id: 'batch_xyz',
        type: 'message_batch',
        processing_status: 'ended',
        request_counts: {
          processing: 0,
          succeeded: 1,
          errored: 0,
          canceled: 0,
          expired: 0,
        },
        created_at: '2026-02-16T10:00:00Z',
        expires_at: '2026-02-17T10:00:00Z',
      };

      const requestId = processor.queue({ model: 'claude-sonnet-4.5', userMessage: 'Test', priority: 'normal' });

      const mockResults = `{"custom_id":"${requestId}","result":{"type":"succeeded","content":[{"type":"text","text":"Response text"}],"usage":{"input_tokens":10,"output_tokens":20}}}`;

      // Mock based on URL
      vi.mocked(fetch).mockImplementation(async (url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('/batches') && !urlStr.includes('/batch_')) {
          // POST /v1/messages/batches (submit)
          return {
            ok: true,
            json: async () => mockBatchResponse,
          } as Response;
        } else if (urlStr.includes('/results')) {
          // GET /v1/messages/batches/${id}/results
          return {
            ok: true,
            text: async () => mockResults,
          } as Response;
        } else {
          // GET /v1/messages/batches/${id} (status)
          return {
            ok: true,
            json: async () => mockStatusResponse,
          } as Response;
        }
      });

      await processor.flush();

      const results = await processor.getResults('batch_xyz');

      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(true);
      expect(results[0]?.content).toBe('Response text');
      expect(results[0]?.usage).toEqual({
        inputTokens: 10,
        outputTokens: 20,
      });
    });

    it('should handle failed results', async () => {
      const mockBatchResponse = {
        id: 'batch_fail',
        type: 'message_batch',
        processing_status: 'pending',
        request_counts: {
          processing: 1,
          succeeded: 0,
          errored: 0,
          canceled: 0,
          expired: 0,
        },
        created_at: '2026-02-16T10:00:00Z',
        expires_at: '2026-02-17T10:00:00Z',
      };

      const mockStatusResponse = {
        id: 'batch_fail',
        type: 'message_batch',
        processing_status: 'ended',
        request_counts: {
          processing: 0,
          succeeded: 0,
          errored: 1,
          canceled: 0,
          expired: 0,
        },
        created_at: '2026-02-16T10:00:00Z',
        expires_at: '2026-02-17T10:00:00Z',
      };

      const requestId = processor.queue({ model: 'invalid-model', userMessage: 'Test', priority: 'normal' });

      const mockResults = `{"custom_id":"${requestId}","result":{"type":"error","error":{"type":"invalid_request","message":"Invalid model"}}}`;

      vi.mocked(fetch).mockImplementation(async (url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('/batches') && !urlStr.includes('/batch_')) {
          return {
            ok: true,
            json: async () => mockBatchResponse,
          } as Response;
        } else if (urlStr.includes('/results')) {
          return {
            ok: true,
            text: async () => mockResults,
          } as Response;
        } else {
          return {
            ok: true,
            json: async () => mockStatusResponse,
          } as Response;
        }
      });

      await processor.flush();

      const results = await processor.getResults('batch_fail');

      expect(results[0]?.success).toBe(false);
      expect(results[0]?.error).toBe('Invalid model');
    });

    it('should invoke callback when provided', async () => {
      const mockBatchResponse = {
        id: 'batch_cb',
        type: 'message_batch',
        processing_status: 'pending',
        request_counts: {
          processing: 1,
          succeeded: 0,
          errored: 0,
          canceled: 0,
          expired: 0,
        },
        created_at: '2026-02-16T10:00:00Z',
        expires_at: '2026-02-17T10:00:00Z',
      };

      const mockStatusResponse = {
        id: 'batch_cb',
        type: 'message_batch',
        processing_status: 'ended',
        request_counts: {
          processing: 0,
          succeeded: 1,
          errored: 0,
          canceled: 0,
          expired: 0,
        },
        created_at: '2026-02-16T10:00:00Z',
        expires_at: '2026-02-17T10:00:00Z',
      };

      const callback = vi.fn();
      const requestId = processor.queue({
        model: 'claude-sonnet-4.5',
        userMessage: 'Test',
        priority: 'normal',
        callback,
      });

      const mockResults = `{"custom_id":"${requestId}","result":{"type":"succeeded","content":[{"type":"text","text":"Callback test"}]}}`;

      vi.mocked(fetch).mockImplementation(async (url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('/batches') && !urlStr.includes('/batch_')) {
          return {
            ok: true,
            json: async () => mockBatchResponse,
          } as Response;
        } else if (urlStr.includes('/results')) {
          return {
            ok: true,
            text: async () => mockResults,
          } as Response;
        } else {
          return {
            ok: true,
            json: async () => mockStatusResponse,
          } as Response;
        }
      });

      await processor.flush();

      await processor.getResults('batch_cb');

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          content: 'Callback test',
        }),
      );
    });

    it('should throw if batch not found', async () => {
      await expect(processor.getResults('batch_nonexistent')).rejects.toThrow(
        'Batch batch_nonexistent not found in active batches',
      );
    });

    it('should throw if batch status is failed', async () => {
      const mockBatchResponse = {
        id: 'batch_failed',
        type: 'message_batch',
        processing_status: 'pending',
        request_counts: {
          processing: 1,
          succeeded: 0,
          errored: 0,
          canceled: 0,
          expired: 0,
        },
        created_at: '2026-02-16T10:00:00Z',
        expires_at: '2026-02-17T10:00:00Z',
      };

      const mockStatusResponse = {
        id: 'batch_failed',
        type: 'message_batch',
        processing_status: 'failed',
        request_counts: {
          processing: 0,
          succeeded: 0,
          errored: 1,
          canceled: 0,
          expired: 0,
        },
        created_at: '2026-02-16T10:00:00Z',
        expires_at: '2026-02-17T10:00:00Z',
      };

      processor.queue({ model: 'claude-sonnet-4.5', userMessage: 'Test', priority: 'normal' });

      vi.mocked(fetch).mockImplementation(async (url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('/batches') && !urlStr.includes('/batch_')) {
          return {
            ok: true,
            json: async () => mockBatchResponse,
          } as Response;
        } else {
          return {
            ok: true,
            json: async () => mockStatusResponse,
          } as Response;
        }
      });

      const status = await processor.flush();

      await expect(processor.getResults(status.batchId)).rejects.toThrow('Batch processing failed');
    });
  });

  describe('cancelBatch', () => {
    it('should cancel a batch', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await processor.cancelBatch('batch_123');

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages/batches/batch_123/cancel',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': mockApiKey,
            'anthropic-version': '2023-06-01',
          }),
        }),
      );
    });

    it('should return false on API failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await processor.cancelBatch('batch_invalid');
      expect(result).toBe(false);
    });
  });

  describe('getQueueSize', () => {
    it('should return current queue size', () => {
      expect(processor.getQueueSize()).toBe(0);

      processor.queue({ model: 'claude-sonnet-4.5', userMessage: 'Message 1', priority: 'normal' });
      expect(processor.getQueueSize()).toBe(1);

      processor.queue({ model: 'claude-opus-4.6', userMessage: 'Message 2', priority: 'low' });
      expect(processor.getQueueSize()).toBe(2);
    });
  });
});
