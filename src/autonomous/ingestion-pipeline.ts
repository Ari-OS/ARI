import { randomUUID } from 'node:crypto';
import type { EventBus } from '../kernel/event-bus.js';
import { VectorStore } from '../system/vector-store.js';
import type { VectorDocument, SourceType } from '../system/vector-store.js';
import type { EmbeddingService } from '../ai/embedding-service.js';

/**
 * Input for the ingestion pipeline.
 */
export interface IngestionInput {
  content?: string;
  url?: string;
  source: string;
  sourceType: SourceType;
  title?: string;
  domain?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Result of ingestion operation.
 */
export interface IngestionResult {
  success: boolean;
  documentsStored: number;
  chunksCreated: number;
  duplicatesSkipped: number;
  errors: string[];
}

/**
 * Ingestion pipeline for processing content into the knowledge base.
 *
 * Pipeline steps:
 * 1. Extract content (fetch URL or use provided content)
 * 2. Normalize content (trim, normalize unicode, collapse newlines)
 * 3. Check for duplicates (SHA-256 hash)
 * 4. Chunk content (~800 chars with ~200 overlap)
 * 5. Generate embeddings (batch)
 * 6. Store in vector database
 *
 * Layer 5 (Execution/Autonomous) — imports from L0-L4 + system/ + ai/
 */
export class IngestionPipeline {
  private vectorStore: VectorStore;
  private embeddingService: EmbeddingService;
  private eventBus: EventBus;

  constructor(
    vectorStore: VectorStore,
    embeddingService: EmbeddingService,
    eventBus: EventBus,
  ) {
    this.vectorStore = vectorStore;
    this.embeddingService = embeddingService;
    this.eventBus = eventBus;
  }

  /**
   * Ingest a single input.
   */
  async ingest(input: IngestionInput): Promise<IngestionResult> {
    const results = await this.ingestBatch([input]);
    return results;
  }

  /**
   * Ingest multiple inputs in a batch.
   * More efficient than calling ingest() multiple times.
   */
  async ingestBatch(inputs: IngestionInput[]): Promise<IngestionResult> {
    const result: IngestionResult = {
      success: true,
      documentsStored: 0,
      chunksCreated: 0,
      duplicatesSkipped: 0,
      errors: [],
    };

    for (const input of inputs) {
      try {
        // 1. Extract content
        const content = await this.extractContent(input);

        if (!content.trim()) {
          result.errors.push(`Empty content for source: ${input.source}`);
          continue;
        }

        // 2. Normalize
        const normalized = this.normalizeContent(content);

        // 3. Check for duplicates
        const contentHash = VectorStore.hashContent(normalized);
        const isDuplicate = await this.vectorStore.deduplicateByHash(contentHash);

        if (isDuplicate) {
          result.duplicatesSkipped++;
          continue;
        }

        // 4. Chunk content
        const chunks = this.chunkContent(normalized);
        result.chunksCreated += chunks.length;

        // 5. Generate embeddings (batch for efficiency)
        const embeddings = await this.embeddingService.embedBatch(chunks);

        // 6. Store chunks
        const parentDocId = randomUUID();
        const now = new Date().toISOString();

        for (let i = 0; i < chunks.length; i++) {
          const chunkHash = VectorStore.hashContent(chunks[i]);
          const doc: VectorDocument = {
            id: randomUUID(),
            content: chunks[i],
            embedding: embeddings[i],
            source: input.source,
            sourceUrl: input.url ?? null,
            sourceType: input.sourceType,
            title: input.title ?? null,
            domain: input.domain ?? null,
            tags: input.tags ?? [],
            contentHash: chunkHash,
            chunkIndex: i,
            chunkTotal: chunks.length,
            parentDocId,
            createdAt: now,
            metadata: input.metadata ?? {},
          };

          await this.vectorStore.upsert(doc);
        }

        result.documentsStored++;

        // Emit success event
        this.eventBus.emit('knowledge:ingested', {
          documentId: parentDocId,
          source: input.source,
          sourceType: input.sourceType,
          chunkCount: chunks.length,
          timestamp: now,
        });
      } catch (error) {
        result.success = false;
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to ingest ${input.source}: ${errorMsg}`);
      }
    }

    return result;
  }

  /**
   * Extract content from input (fetch URL or use provided content).
   */
  private async extractContent(input: IngestionInput): Promise<string> {
    if (input.content) {
      return input.content;
    }

    if (input.url) {
      return this.fetchAndExtract(input.url);
    }

    throw new Error('Must provide either content or url');
  }

  /**
   * Fetch URL content and extract text from HTML.
   * Uses simple regex-based extraction (no external dependencies).
   */
  private async fetchAndExtract(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ARI-Bot/1.0',
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return this.extractTextFromHTML(html);
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch ${url}: ${err}`);
    }
  }

  /**
   * Extract text from HTML using simple regex-based approach.
   * Removes script/style tags, then strips all HTML tags.
   */
  private extractTextFromHTML(html: string): string {
    // Remove script and style tags with their content
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');

    // Remove all other HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Normalize content:
   * - Trim whitespace
   * - Normalize unicode (NFC)
   * - Collapse multiple newlines to max 2
   * - Collapse multiple spaces to single space
   */
  private normalizeContent(content: string): string {
    let normalized = content.trim();

    // Normalize unicode to NFC (composed form)
    normalized = normalized.normalize('NFC');

    // Collapse multiple newlines (keep at most 2)
    normalized = normalized.replace(/\n{3,}/g, '\n\n');

    // Collapse multiple spaces to single space
    normalized = normalized.replace(/ {2,}/g, ' ');

    return normalized;
  }

  /**
   * Chunk content into ~800 character chunks with ~200 character overlap.
   * Splits on paragraph/sentence boundaries when possible.
   */
  private chunkContent(content: string): string[] {
    const TARGET_SIZE = 800;
    const OVERLAP_SIZE = 200;
    const chunks: string[] = [];

    // Split into paragraphs first
    const paragraphs = content.split(/\n\n+/);

    let currentChunk = '';

    for (const paragraph of paragraphs) {
      // If this paragraph alone exceeds target size, split it further
      if (paragraph.length > TARGET_SIZE) {
        // Flush current chunk first if it has content
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          // Keep overlap from end of current chunk
          const overlap = currentChunk.slice(-OVERLAP_SIZE);
          currentChunk = overlap;
        }

        // Split large paragraph on sentence boundaries
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > TARGET_SIZE && currentChunk.trim()) {
            chunks.push(currentChunk.trim());
            // Keep overlap
            const overlap = currentChunk.slice(-OVERLAP_SIZE);
            currentChunk = overlap + ' ' + sentence;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
        }
      } else {
        // Would adding this paragraph exceed target size?
        if (currentChunk.length + paragraph.length > TARGET_SIZE && currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          // Keep overlap from end of previous chunk
          const overlap = currentChunk.slice(-OVERLAP_SIZE);
          currentChunk = overlap + '\n\n' + paragraph;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
      }
    }

    // Add final chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // If no chunks were created (very short content), return as single chunk
    if (chunks.length === 0 && content.trim()) {
      chunks.push(content.trim());
    }

    return chunks;
  }
}
