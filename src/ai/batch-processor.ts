import { createLogger } from '../kernel/logger.js';
import type { Logger } from 'pino';

const logger = createLogger('batch-processor');

export interface BatchRequest {
  id: string;
  model: string;
  systemPrompt?: string;
  userMessage: string;
  maxTokens?: number;
  metadata?: Record<string, string>;
  priority: 'low' | 'normal';
  callback?: (result: BatchResult) => void;
}

export interface BatchResult {
  requestId: string;
  success: boolean;
  content?: string;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number };
  processingTime?: number;
}

export interface BatchStatus {
  batchId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  createdAt: Date;
}

interface AnthropicBatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    messages: Array<{ role: string; content: string }>;
    system?: string;
  };
}

interface AnthropicBatchResponse {
  id: string;
  type: string;
  processing_status: string;
  request_counts: {
    processing: number;
    succeeded: number;
    errored: number;
    canceled: number;
    expired: number;
  };
  created_at: string;
  expires_at: string;
  results_url?: string;
}

interface AnthropicBatchResult {
  custom_id: string;
  result: {
    type: string;
    content?: Array<{ type: string; text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
    error?: { type: string; message: string };
  };
}

interface BatchProcessorOptions {
  maxQueueSize?: number;
  flushIntervalMs?: number;
  autoFlush?: boolean;
}

export class BatchProcessor {
  private readonly apiKey: string;
  private readonly maxQueueSize: number;
  private readonly flushIntervalMs: number;
  private readonly autoFlush: boolean;
  private readonly requestQueue: Map<string, BatchRequest>;
  private flushTimer: NodeJS.Timeout | null;
  private activeBatches: Map<string, { requests: BatchRequest[]; status: BatchStatus }>;

  constructor(apiKey: string, options: BatchProcessorOptions = {}) {
    this.apiKey = apiKey;
    this.maxQueueSize = options.maxQueueSize ?? 10;
    this.flushIntervalMs = options.flushIntervalMs ?? 15 * 60 * 1000; // 15 minutes
    this.autoFlush = options.autoFlush ?? false;
    this.requestQueue = new Map();
    this.flushTimer = null;
    this.activeBatches = new Map();

    if (this.autoFlush) {
      this.startAutoFlush();
    }

    logger.info(
      {
        maxQueueSize: this.maxQueueSize,
        flushIntervalMs: this.flushIntervalMs,
        autoFlush: this.autoFlush,
      },
      'BatchProcessor initialized',
    );
  }

  queue(request: Omit<BatchRequest, 'id'>): string {
    const id = this.generateRequestId();
    const fullRequest: BatchRequest = { ...request, id };

    this.requestQueue.set(id, fullRequest);
    logger.debug({ requestId: id, queueSize: this.requestQueue.size }, 'Request queued');

    if (this.requestQueue.size >= this.maxQueueSize) {
      logger.info({ queueSize: this.requestQueue.size }, 'Queue size reached max, auto-flushing');
      void this.flush();
    }

    return id;
  }

  async flush(): Promise<BatchStatus> {
    if (this.requestQueue.size === 0) {
      throw new Error('Queue is empty, nothing to flush');
    }

    const requests = Array.from(this.requestQueue.values());
    this.requestQueue.clear();

    logger.info({ requestCount: requests.length }, 'Flushing batch');

    try {
      const batchId = await this.submitBatch(requests);
      const status: BatchStatus = {
        batchId,
        status: 'pending',
        totalRequests: requests.length,
        completedRequests: 0,
        failedRequests: 0,
        createdAt: new Date(),
      };

      this.activeBatches.set(batchId, { requests, status });
      logger.info({ batchId, requestCount: requests.length }, 'Batch submitted');

      return status;
    } catch (error: unknown) {
      // Re-queue the requests on failure
      for (const req of requests) {
        this.requestQueue.set(req.id, req);
      }

      logger.error({ error, requestCount: requests.length }, 'Failed to submit batch');
      throw new Error(`Failed to submit batch: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getStatus(batchId: string): Promise<BatchStatus> {
    const cached = this.activeBatches.get(batchId);
    // Only return cached status for terminal states; poll API for pending/in_progress
    if (cached && (cached.status.status === 'completed' || cached.status.status === 'failed')) {
      return cached.status;
    }

    try {
      const response = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as AnthropicBatchResponse;
      const status: BatchStatus = {
        batchId,
        status: this.mapStatus(data.processing_status),
        totalRequests: Object.values(data.request_counts).reduce((a, b) => a + b, 0),
        completedRequests: data.request_counts.succeeded,
        failedRequests: data.request_counts.errored + data.request_counts.canceled + data.request_counts.expired,
        createdAt: new Date(data.created_at),
      };

      // Update cache with fresh status
      if (cached) {
        cached.status = status;
      }

      logger.debug({ batchId, status: status.status }, 'Fetched batch status');
      return status;
    } catch (error: unknown) {
      // Fallback to cached status if available
      if (cached) {
        return cached.status;
      }
      logger.error({ error, batchId }, 'Failed to get batch status');
      throw new Error(`Failed to get batch status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getResults(batchId: string): Promise<BatchResult[]> {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found in active batches`);
    }

    try {
      // Poll until batch is completed
      let status = await this.getStatus(batchId);
      while (status.status === 'pending' || status.status === 'in_progress') {
        await this.sleep(5000); // Poll every 5 seconds
        status = await this.getStatus(batchId);
      }

      if (status.status === 'failed') {
        throw new Error('Batch processing failed');
      }

      // Fetch results
      const response = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}/results`, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      const lines = text.trim().split('\n');
      const results: BatchResult[] = [];

      for (const line of lines) {
        const item = JSON.parse(line) as AnthropicBatchResult;
        const request = batch.requests.find((r) => r.id === item.custom_id);

        const result: BatchResult = {
          requestId: item.custom_id,
          success: item.result.type === 'succeeded',
          content: item.result.content?.[0]?.text,
          error: item.result.error?.message,
          usage: item.result.usage
            ? {
                inputTokens: item.result.usage.input_tokens,
                outputTokens: item.result.usage.output_tokens,
              }
            : undefined,
        };

        results.push(result);

        // Invoke callback if provided
        if (request?.callback) {
          try {
            request.callback(result);
          } catch (error: unknown) {
            logger.error({ error, requestId: item.custom_id }, 'Error in callback');
          }
        }
      }

      this.activeBatches.delete(batchId);
      logger.info({ batchId, resultCount: results.length }, 'Batch results retrieved');
      return results;
    } catch (error: unknown) {
      logger.error({ error, batchId }, 'Failed to get batch results');
      throw new Error(`Failed to get batch results: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getQueueSize(): number {
    return this.requestQueue.size;
  }

  async cancelBatch(batchId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}/cancel`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.activeBatches.delete(batchId);
      logger.info({ batchId }, 'Batch cancelled');
      return true;
    } catch (error: unknown) {
      logger.error({ error, batchId }, 'Failed to cancel batch');
      return false;
    }
  }

  private async submitBatch(requests: BatchRequest[]): Promise<string> {
    const batchRequests: AnthropicBatchRequest[] = requests.map((req) => ({
      custom_id: req.id,
      params: {
        model: req.model,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          {
            role: 'user',
            content: req.userMessage,
          },
        ],
        ...(req.systemPrompt ? { system: req.systemPrompt } : {}),
      },
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages/batches', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ requests: batchRequests }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as AnthropicBatchResponse;
    return data.id;
  }

  private async pollBatchResults(batchId: string): Promise<void> {
    try {
      const results = await this.getResults(batchId);
      logger.info({ batchId, resultCount: results.length }, 'Batch polling completed');
    } catch (error: unknown) {
      logger.error({ error, batchId }, 'Error polling batch results');
    }
  }

  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.requestQueue.size > 0) {
        logger.info({ queueSize: this.requestQueue.size }, 'Auto-flush triggered');
        void this.flush();
      }
    }, this.flushIntervalMs);
  }

  private stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private mapStatus(status: string): BatchStatus['status'] {
    switch (status) {
      case 'in_progress':
        return 'in_progress';
      case 'ended':
        return 'completed';
      case 'failed':
      case 'canceling':
      case 'canceled':
        return 'failed';
      default:
        return 'pending';
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
