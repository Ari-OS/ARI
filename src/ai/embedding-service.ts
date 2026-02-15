/**
 * Embedding generation service using OpenAI's text-embedding-3-small.
 *
 * AI Layer — imports only from Kernel.
 */

export type EmbeddingProvider = 'openai' | 'gemini';

/**
 * Embedding service for generating vector embeddings from text.
 */
export class EmbeddingService {
  private provider: EmbeddingProvider;
  private apiKey: string | null;
  private dimension: number;

  constructor(provider: EmbeddingProvider = 'openai') {
    this.provider = provider;
    this.apiKey = process.env.OPENAI_API_KEY ?? null;
    this.dimension = 1536; // text-embedding-3-small dimension
  }

  /**
   * Embed a single text string.
   * Returns Float32Array for efficient storage and computation.
   */
  async embed(text: string): Promise<Float32Array> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }

    if (!text.trim()) {
      throw new Error('Cannot embed empty text');
    }

    if (this.provider === 'openai') {
      return this.embedOpenAI(text);
    } else if (this.provider === 'gemini') {
      return this.embedGemini(text);
    }

    throw new Error(`Unsupported provider: ${String(this.provider)}`);
  }

  /**
   * Embed multiple texts in a single batch request.
   * More efficient than calling embed() multiple times.
   */
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }

    if (texts.length === 0) {
      return [];
    }

    // Filter out empty texts
    const validTexts = texts.filter(t => t.trim().length > 0);
    if (validTexts.length === 0) {
      throw new Error('Cannot embed empty texts');
    }

    if (this.provider === 'openai') {
      return this.embedBatchOpenAI(validTexts);
    } else if (this.provider === 'gemini') {
      return this.embedBatchGemini(validTexts);
    }

    throw new Error(`Unsupported provider: ${String(this.provider)}`);
  }

  /**
   * Get the dimension of embeddings produced by this service.
   */
  getDimension(): number {
    return this.dimension;
  }

  /**
   * Embed using OpenAI's text-embedding-3-small.
   * Cost: $0.02/1M tokens (extremely cost-efficient).
   */
  private async embedOpenAI(text: string): Promise<Float32Array> {
    const { OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: this.apiKey ?? undefined });

    try {
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('OpenAI returned no embeddings');
      }

      const embedding = response.data[0].embedding;
      return new Float32Array(embedding);
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenAI embedding failed: ${err}`);
    }
  }

  /**
   * Batch embed using OpenAI.
   */
  private async embedBatchOpenAI(texts: string[]): Promise<Float32Array[]> {
    const { OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: this.apiKey ?? undefined });

    try {
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
        encoding_format: 'float',
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('OpenAI returned no embeddings');
      }

      return response.data.map(item => new Float32Array(item.embedding));
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenAI batch embedding failed: ${err}`);
    }
  }

  /**
   * Embed using Google Gemini (placeholder for future implementation).
   */
  private embedGemini(_text: string): Promise<Float32Array> {
    return Promise.reject(new Error('Gemini embedding not yet implemented'));
  }

  /**
   * Batch embed using Gemini (placeholder for future implementation).
   */
  private embedBatchGemini(_texts: string[]): Promise<Float32Array[]> {
    return Promise.reject(new Error('Gemini batch embedding not yet implemented'));
  }
}
