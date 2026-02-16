/**
 * EmbeddingService — Vector Embedding Generation
 *
 * Layer 2 (System): Imports from Kernel (Layer 1) only.
 *
 * Features:
 * - OpenAI text-embedding-3-small (1536 dimensions, $0.02/1M tokens)
 * - Batch embedding for efficiency
 * - In-memory caching with SHA-256 content hashing
 * - EventBus integration for cost tracking
 */

import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import type { EventBus } from '../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmbeddingResult {
  embedding: Float32Array;
  model: string;
  tokens: number;
  cached: boolean;
}

export interface EmbeddingServiceOptions {
  apiKey?: string;
  maxBatchSize?: number;
  cacheMaxSize?: number;
}

interface CacheEntry {
  embedding: Float32Array;
  model: string;
  tokens: number;
  createdAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_MODEL = 'text-embedding-3-small';
const COST_PER_1M_TOKENS = 0.02;
const DEFAULT_MAX_BATCH_SIZE = 2048;
const DEFAULT_CACHE_MAX_SIZE = 10_000;

// ═══════════════════════════════════════════════════════════════════════════════
// EMBEDDING SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class EmbeddingService {
  private readonly eventBus: EventBus;
  private readonly client: OpenAI;
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly maxBatchSize: number;
  private readonly cacheMaxSize: number;

  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(eventBus: EventBus, options?: EmbeddingServiceOptions) {
    this.eventBus = eventBus;
    this.maxBatchSize = options?.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this.cacheMaxSize = options?.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;

    const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key required: provide via options.apiKey or OPENAI_API_KEY env var');
    }

    this.client = new OpenAI({ apiKey });
  }

  /**
   * Generate embedding for a single text.
   */
  async embed(text: string): Promise<EmbeddingResult> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const cacheKey = this.computeCacheKey(text);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      this.cacheHits++;
      return {
        embedding: cached.embedding,
        model: cached.model,
        tokens: cached.tokens,
        cached: true,
      };
    }

    this.cacheMisses++;
    const results = await this.fetchEmbeddings([text]);
    const result = results[0];

    this.cacheResult(cacheKey, result);

    return {
      embedding: result.embedding,
      model: result.model,
      tokens: result.tokens,
      cached: false,
    };
  }

  /**
   * Generate embeddings for multiple texts in batches.
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    // Validate all texts
    for (let i = 0; i < texts.length; i++) {
      if (!texts[i] || texts[i].trim().length === 0) {
        throw new Error(`Text at index ${i} cannot be empty`);
      }
    }

    const results: EmbeddingResult[] = new Array<EmbeddingResult>(texts.length);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
      const cacheKey = this.computeCacheKey(texts[i]);
      const cached = this.cache.get(cacheKey);

      if (cached) {
        this.cacheHits++;
        results[i] = {
          embedding: cached.embedding,
          model: cached.model,
          tokens: cached.tokens,
          cached: true,
        };
      } else {
        this.cacheMisses++;
        uncachedIndices.push(i);
        uncachedTexts.push(texts[i]);
      }
    }

    // Fetch uncached embeddings in batches
    if (uncachedTexts.length > 0) {
      const fetchedResults = await this.fetchEmbeddingsInBatches(uncachedTexts);

      for (let i = 0; i < uncachedIndices.length; i++) {
        const originalIndex = uncachedIndices[i];
        const result = fetchedResults[i];
        const cacheKey = this.computeCacheKey(texts[originalIndex]);

        this.cacheResult(cacheKey, result);

        results[originalIndex] = {
          embedding: result.embedding,
          model: result.model,
          tokens: result.tokens,
          cached: false,
        };
      }
    }

    return results;
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { hits: number; misses: number; size: number } {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      size: this.cache.size,
    };
  }

  /**
   * Clear the embedding cache.
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════════

  private computeCacheKey(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  private async fetchEmbeddings(texts: string[]): Promise<Array<{ embedding: Float32Array; model: string; tokens: number }>> {
    const startTime = Date.now();

    const response = await this.client.embeddings.create({
      model: DEFAULT_MODEL,
      input: texts,
    });

    const duration = Date.now() - startTime;
    const totalTokens = response.usage?.total_tokens ?? 0;
    const cost = (totalTokens / 1_000_000) * COST_PER_1M_TOKENS;

    // Emit cost tracking event
    this.eventBus.emit('llm:request_complete', {
      timestamp: new Date().toISOString(),
      model: DEFAULT_MODEL,
      inputTokens: totalTokens,
      outputTokens: 0,
      cost,
      taskType: 'embedding',
      taskCategory: 'analysis',
      duration,
      success: true,
    });

    // Calculate tokens per text (approximate distribution)
    const tokensPerText = Math.ceil(totalTokens / texts.length);

    return response.data.map((item) => ({
      embedding: new Float32Array(item.embedding),
      model: response.model,
      tokens: tokensPerText,
    }));
  }

  private async fetchEmbeddingsInBatches(texts: string[]): Promise<Array<{ embedding: Float32Array; model: string; tokens: number }>> {
    const results: Array<{ embedding: Float32Array; model: string; tokens: number }> = [];

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      const batchResults = await this.fetchEmbeddings(batch);
      results.push(...batchResults);
    }

    return results;
  }

  private cacheResult(key: string, result: { embedding: Float32Array; model: string; tokens: number }): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      embedding: result.embedding,
      model: result.model,
      tokens: result.tokens,
      createdAt: Date.now(),
    });
  }
}
