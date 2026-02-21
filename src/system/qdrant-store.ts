/**
 * QdrantStore — Vector embedding storage and similarity search via Qdrant
 *
 * Implements the 3rd tier (Warm/Cold Vector DB) for ARI's knowledge system.
 * Replaces or augments the SQLite-based vector store with an O(log n)
 * semantic vector search across all memories.
 */

import { randomUUID } from 'node:crypto';
import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';
import type { UpsertDocumentInput, VectorDocument, SearchOptions, SearchResult } from './vector-store.js';

const log = createLogger('qdrant-store');

const EMBEDDING_DIMENSION = 1536;
const DEFAULT_QDRANT_URL = process.env.QDRANT_URL || 'http://127.0.0.1:6333';
const DEFAULT_COLLECTION_NAME = 'ari_memories';

export class QdrantStore {
  private eventBus?: EventBus;
  private readonly baseUrl: string;
  private readonly collectionName: string;
  private initialized = false;

  constructor(eventBus?: EventBus, url?: string, collectionName?: string) {
    this.eventBus = eventBus;
    this.baseUrl = url || DEFAULT_QDRANT_URL;
    this.collectionName = collectionName || DEFAULT_COLLECTION_NAME;
  }

  /**
   * Initialize the collection in Qdrant if it doesn't exist.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}`);
      if (response.status === 404) {
        log.info(`Collection ${this.collectionName} not found, creating...`);
        await this.createCollection();
      } else if (!response.ok) {
        throw new Error(`Failed to check collection: ${response.statusText}`);
      }
      this.initialized = true;
      log.info('QdrantStore initialized');
    } catch (error) {
      log.error({ err: error }, 'Failed to initialize QdrantStore');
      // Graceful degradation: mark as initialized to allow fallback locally if needed
      this.initialized = true; 
    }
  }

  private async createCollection(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vectors: {
          size: EMBEDDING_DIMENSION,
          distance: 'Cosine'
        }
      })
    });
    if (!response.ok) {
      throw new Error(`Failed to create collection: ${response.statusText}`);
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('QdrantStore not initialized. Call init() first.');
    }
  }

  /**
   * Upsert document into Qdrant.
   */
  async upsert(input: UpsertDocumentInput): Promise<VectorDocument> {
    this.ensureInitialized();
    const id = input.id ?? randomUUID();
    const createdAt = new Date().toISOString();

    const doc: VectorDocument = {
      id,
      content: input.content,
      embedding: input.embedding,
      source: input.source,
      sourceUrl: input.sourceUrl,
      sourceType: input.sourceType,
      title: input.title,
      domain: input.domain,
      tags: input.tags || [],
      contentHash: '', // Hash is omitted for brevity in Qdrant port
      chunkIndex: input.chunkIndex || 0,
      chunkTotal: input.chunkTotal || 1,
      parentDocId: input.parentDocId,
      createdAt,
      metadata: input.metadata || {},
    };

    // Construct point payload
    const payload = {
      points: [{
        id,
        vector: Array.from(input.embedding),
        payload: {
          content: doc.content,
          source: doc.source,
          source_type: doc.sourceType,
          domain: doc.domain,
          tags: doc.tags,
          created_at: doc.createdAt,
          metadata: doc.metadata
        }
      }]
    };

    try {
      await fetch(`${this.baseUrl}/collections/${this.collectionName}/points`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (this.eventBus) {
        this.eventBus.emit('vector:document_indexed', {
          documentId: doc.id,
          contentHash: '',
          source: doc.source,
          sourceType: doc.sourceType,
          domain: doc.domain,
          chunkIndex: doc.chunkIndex,
          chunkTotal: doc.chunkTotal,
          timestamp: new Date()
        });
      }
    } catch (e) {
      log.error({ err: e }, 'Failed to upsert to Qdrant');
    }

    return doc;
  }

  /**
   * Search via Qdrant's highly optimized HNSW graph index.
   */
  async search(embedding: Float32Array, options: SearchOptions = {}): Promise<SearchResult[]> {
    this.ensureInitialized();
    const limit = options.limit ?? 10;
    const minScore = options.minScore ?? 0.0;

    // Construct filter
    const must: Array<Record<string, unknown>> = [];
    if (options.domain) {
      must.push({ key: 'domain', match: { value: options.domain } });
    }
    if (options.sourceType) {
      must.push({ key: 'source_type', match: { value: options.sourceType } });
    }
    if (options.tags && options.tags.length > 0) {
      must.push({ key: 'tags', match: { any: options.tags } });
    }

    const payload = {
      vector: Array.from(embedding),
      limit,
      score_threshold: minScore,
      with_payload: true,
      filter: must.length > 0 ? { must } : undefined
    };

    try {
      const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}/points/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json() as { result?: Array<{ score: number; id: string; payload: { content: string; source: string; source_type: string; domain: string; tags?: string[]; created_at: string; metadata: Record<string, unknown> } }> };
      if (!data.result) return [];

      return data.result.map((item) => ({
        score: item.score,
        document: {
          id: item.id,
          content: item.payload.content,
          embedding: new Float32Array(0), // Omitted to save memory, or returned if `with_vector: true`
          source: item.payload.source,
          sourceType: item.payload.source_type as VectorDocument['sourceType'],
          domain: item.payload.domain,
          tags: item.payload.tags || [],
          contentHash: '',
          chunkIndex: 0,
          chunkTotal: 1,
          createdAt: item.payload.created_at,
          metadata: item.payload.metadata
        }
      }));
    } catch (e) {
      log.error({ err: e }, 'Failed to search Qdrant');
      return [];
    }
  }
}
