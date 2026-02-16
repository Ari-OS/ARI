/**
 * VectorStore — Vector embedding storage and similarity search
 *
 * L2 System Layer module for ARI's knowledge system.
 * Uses better-sqlite3 for persistent storage with brute-force cosine similarity.
 *
 * Features:
 * - 1536-dimensional OpenAI embeddings
 * - SHA-256 content deduplication
 * - Domain filtering and tagging
 * - Chunked document support
 *
 * Events emitted:
 * - vector:document_indexed — Document successfully stored
 * - vector:search_complete — Search operation completed
 */

import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { statSync } from 'node:fs';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { EventBus } from '../kernel/event-bus.js';
import { CONFIG_DIR } from '../kernel/config.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('vector-store');

// ── Constants ────────────────────────────────────────────────────────────────

const EMBEDDING_DIMENSION = 1536;
const DEFAULT_DB_PATH = path.join(CONFIG_DIR, 'vectors.db');
const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_MIN_SCORE = 0.0;

// ── Schemas ──────────────────────────────────────────────────────────────────

export const SourceTypeSchema = z.enum([
  'article',
  'tweet',
  'bookmark',
  'conversation',
  'email',
  'file',
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const VectorDocumentSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  embedding: z.custom<Float32Array>(
    (val) => val instanceof Float32Array && val.length === EMBEDDING_DIMENSION,
    { message: `Embedding must be a Float32Array with ${EMBEDDING_DIMENSION} dimensions` }
  ),
  source: z.string(),
  sourceUrl: z.string().optional(),
  sourceType: SourceTypeSchema,
  title: z.string().optional(),
  domain: z.string().optional(),
  tags: z.array(z.string()),
  contentHash: z.string().length(64), // SHA-256 hex
  chunkIndex: z.number().int().min(0),
  chunkTotal: z.number().int().min(1),
  parentDocId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  metadata: z.record(z.unknown()),
});
export type VectorDocument = z.infer<typeof VectorDocumentSchema>;

export const SearchOptionsSchema = z.object({
  limit: z.number().int().min(1).max(1000).optional(),
  domain: z.string().optional(),
  minScore: z.number().min(-1).max(1).optional(), // -1 to 1 for cosine similarity range
  tags: z.array(z.string()).optional(),
  sourceType: SourceTypeSchema.optional(),
});
export type SearchOptions = z.infer<typeof SearchOptionsSchema>;

export const SearchResultSchema = z.object({
  document: VectorDocumentSchema,
  score: z.number(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const StoreStatsSchema = z.object({
  totalDocuments: z.number(),
  totalChunks: z.number(),
  domains: z.array(z.string()),
  sourceTypeCounts: z.record(z.number()),
  dbSizeBytes: z.number(),
  averageChunksPerDocument: z.number(),
});
export type StoreStats = z.infer<typeof StoreStatsSchema>;

// ── Input Schemas (for upsert validation) ────────────────────────────────────

export const UpsertDocumentInputSchema = z.object({
  id: z.string().uuid().optional(),
  content: z.string().min(1),
  embedding: z.custom<Float32Array>(
    (val) => val instanceof Float32Array && val.length === EMBEDDING_DIMENSION,
    { message: `Embedding must be a Float32Array with ${EMBEDDING_DIMENSION} dimensions` }
  ),
  source: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  sourceType: SourceTypeSchema,
  title: z.string().optional(),
  domain: z.string().optional(),
  tags: z.array(z.string()).default([]),
  chunkIndex: z.number().int().min(0).default(0),
  chunkTotal: z.number().int().min(1).default(1),
  parentDocId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type UpsertDocumentInput = z.infer<typeof UpsertDocumentInputSchema>;

// ── Error Classes ────────────────────────────────────────────────────────────

export class VectorStoreError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'VectorStoreError';
  }
}

export class DuplicateContentError extends VectorStoreError {
  constructor(
    public readonly contentHash: string,
    public readonly existingId: string
  ) {
    super(
      `Duplicate content detected with hash ${contentHash}`,
      'DUPLICATE_CONTENT'
    );
  }
}

export class InvalidEmbeddingError extends VectorStoreError {
  constructor(dimension: number) {
    super(
      `Invalid embedding dimension: expected ${EMBEDDING_DIMENSION}, got ${dimension}`,
      'INVALID_EMBEDDING'
    );
  }
}

export class DocumentNotFoundError extends VectorStoreError {
  constructor(id: string) {
    super(`Document not found: ${id}`, 'NOT_FOUND');
  }
}

// ── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Compute SHA-256 hash of content for deduplication.
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Compute cosine similarity between two embeddings.
 * Returns value between -1 and 1, where 1 means identical.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new InvalidEmbeddingError(b.length);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Serialize Float32Array to Buffer for SQLite storage.
 */
function serializeEmbedding(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer);
}

/**
 * Deserialize Buffer back to Float32Array.
 */
function deserializeEmbedding(buffer: Buffer): Float32Array<ArrayBuffer> {
  // Copy to a new ArrayBuffer to avoid SharedArrayBuffer type issues
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  const view = new Uint8Array(arrayBuffer);
  view.set(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
  return new Float32Array(arrayBuffer);
}

// ── VectorStore Class ────────────────────────────────────────────────────────

export class VectorStore {
  private db: Database.Database | null = null;
  private readonly dbPath: string;
  private eventBus?: EventBus;
  private initialized = false;

  constructor(dbPath?: string, eventBus?: EventBus) {
    this.dbPath = dbPath ?? DEFAULT_DB_PATH;
    this.eventBus = eventBus;
  }

  /**
   * Initialize the database and create tables.
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      await fs.mkdir(dir, { recursive: true });

      // Open database
      this.db = new Database(this.dbPath);

      // Enable WAL mode for better concurrent performance
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');

      // Create tables
      this.createTables();

      this.initialized = true;
      log.info({ dbPath: this.dbPath }, 'VectorStore initialized');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ err: error }, 'Failed to initialize VectorStore');
      throw new VectorStoreError(
        `Failed to initialize database: ${message}`,
        'INIT_FAILED',
        error
      );
    }
  }

  /**
   * Create database tables if they don't exist.
   */
  private createTables(): void {
    if (!this.db) throw new VectorStoreError('Database not open', 'NOT_OPEN');

    // Main documents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        source TEXT NOT NULL,
        source_url TEXT,
        source_type TEXT NOT NULL,
        title TEXT,
        domain TEXT,
        content_hash TEXT NOT NULL UNIQUE,
        chunk_index INTEGER NOT NULL DEFAULT 0,
        chunk_total INTEGER NOT NULL DEFAULT 1,
        parent_doc_id TEXT,
        created_at TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}'
      )
    `);

    // Tags table (many-to-many)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS document_tags (
        document_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (document_id, tag),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `);

    // Indexes for common queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_documents_domain ON documents(domain);
      CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);
      CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);
      CREATE INDEX IF NOT EXISTS idx_documents_parent_doc_id ON documents(parent_doc_id);
      CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag);
    `);
  }

  /**
   * Ensure database is initialized before operations.
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new VectorStoreError(
        'VectorStore not initialized. Call init() first.',
        'NOT_INITIALIZED'
      );
    }
  }

  /**
   * Insert or update a document.
   * Uses content hash for deduplication.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async upsert(input: UpsertDocumentInput): Promise<VectorDocument> {
    this.ensureInitialized();

    // Validate input
    const validated = UpsertDocumentInputSchema.parse(input);

    // Compute content hash
    const contentHash = computeContentHash(validated.content);

    // Check for duplicate
    const existing = this.db!.prepare(
      'SELECT id FROM documents WHERE content_hash = ?'
    ).get(contentHash) as { id: string } | undefined;

    const id = validated.id ?? existing?.id ?? randomUUID();
    const createdAt = new Date().toISOString();

    const doc: VectorDocument = {
      id,
      content: validated.content,
      embedding: validated.embedding,
      source: validated.source,
      sourceUrl: validated.sourceUrl,
      sourceType: validated.sourceType,
      title: validated.title,
      domain: validated.domain,
      tags: validated.tags,
      contentHash,
      chunkIndex: validated.chunkIndex,
      chunkTotal: validated.chunkTotal,
      parentDocId: validated.parentDocId,
      createdAt: existing ? this.getDocumentCreatedAt(id) ?? createdAt : createdAt,
      metadata: validated.metadata,
    };

    // Use transaction for atomicity
    const transaction = this.db!.transaction(() => {
      // Upsert document
      this.db!.prepare(`
        INSERT INTO documents (
          id, content, embedding, source, source_url, source_type,
          title, domain, content_hash, chunk_index, chunk_total,
          parent_doc_id, created_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(content_hash) DO UPDATE SET
          content = excluded.content,
          embedding = excluded.embedding,
          source = excluded.source,
          source_url = excluded.source_url,
          title = excluded.title,
          domain = excluded.domain,
          chunk_index = excluded.chunk_index,
          chunk_total = excluded.chunk_total,
          parent_doc_id = excluded.parent_doc_id,
          metadata = excluded.metadata
      `).run(
        doc.id,
        doc.content,
        serializeEmbedding(doc.embedding),
        doc.source,
        doc.sourceUrl ?? null,
        doc.sourceType,
        doc.title ?? null,
        doc.domain ?? null,
        doc.contentHash,
        doc.chunkIndex,
        doc.chunkTotal,
        doc.parentDocId ?? null,
        doc.createdAt,
        JSON.stringify(doc.metadata)
      );

      // Clear existing tags
      this.db!.prepare(
        'DELETE FROM document_tags WHERE document_id = ?'
      ).run(doc.id);

      // Insert new tags
      const insertTag = this.db!.prepare(
        'INSERT INTO document_tags (document_id, tag) VALUES (?, ?)'
      );
      for (const tag of doc.tags) {
        insertTag.run(doc.id, tag);
      }
    });

    transaction();

    log.debug({ id: doc.id, contentHash, tags: doc.tags }, 'Document indexed');

    // Emit event
    this.emitDocumentIndexed({
      documentId: doc.id,
      contentHash: doc.contentHash,
      source: doc.source,
      sourceType: doc.sourceType,
      domain: doc.domain,
      chunkIndex: doc.chunkIndex,
      chunkTotal: doc.chunkTotal,
      timestamp: new Date(),
    });

    return doc;
  }

  /**
   * Get document creation timestamp by ID.
   */
  private getDocumentCreatedAt(id: string): string | undefined {
    const row = this.db!.prepare(
      'SELECT created_at FROM documents WHERE id = ?'
    ).get(id) as { created_at: string } | undefined;
    return row?.created_at;
  }

  /**
   * Perform similarity search using brute-force cosine similarity.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async search(
    embedding: Float32Array,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    this.ensureInitialized();

    const startTime = Date.now();

    // Validate embedding dimension
    if (embedding.length !== EMBEDDING_DIMENSION) {
      throw new InvalidEmbeddingError(embedding.length);
    }

    const validatedOptions = SearchOptionsSchema.parse(options);
    const limit = validatedOptions.limit ?? DEFAULT_SEARCH_LIMIT;
    const minScore = validatedOptions.minScore ?? DEFAULT_MIN_SCORE;

    // Build query with filters
    let query = 'SELECT * FROM documents WHERE 1=1';
    const params: unknown[] = [];

    if (validatedOptions.domain) {
      query += ' AND domain = ?';
      params.push(validatedOptions.domain);
    }

    if (validatedOptions.sourceType) {
      query += ' AND source_type = ?';
      params.push(validatedOptions.sourceType);
    }

    if (validatedOptions.tags && validatedOptions.tags.length > 0) {
      const placeholders = validatedOptions.tags.map(() => '?').join(',');
      query += ` AND id IN (
        SELECT document_id FROM document_tags
        WHERE tag IN (${placeholders})
        GROUP BY document_id
        HAVING COUNT(DISTINCT tag) = ?
      )`;
      params.push(...validatedOptions.tags, validatedOptions.tags.length);
    }

    // Fetch all matching documents
    const rows = this.db!.prepare(query).all(...params) as Array<{
      id: string;
      content: string;
      embedding: Buffer;
      source: string;
      source_url: string | null;
      source_type: string;
      title: string | null;
      domain: string | null;
      content_hash: string;
      chunk_index: number;
      chunk_total: number;
      parent_doc_id: string | null;
      created_at: string;
      metadata: string;
    }>;

    // Compute similarity scores
    const results: SearchResult[] = [];

    for (const row of rows) {
      const docEmbedding = deserializeEmbedding(row.embedding);
      const score = cosineSimilarity(embedding, docEmbedding);

      if (score >= minScore) {
        // Get tags for document
        const tagRows = this.db!.prepare(
          'SELECT tag FROM document_tags WHERE document_id = ?'
        ).all(row.id) as Array<{ tag: string }>;

        const document: VectorDocument = {
          id: row.id,
          content: row.content,
          embedding: docEmbedding,
          source: row.source,
          sourceUrl: row.source_url ?? undefined,
          sourceType: row.source_type as SourceType,
          title: row.title ?? undefined,
          domain: row.domain ?? undefined,
          tags: tagRows.map((t) => t.tag),
          contentHash: row.content_hash,
          chunkIndex: row.chunk_index,
          chunkTotal: row.chunk_total,
          parentDocId: row.parent_doc_id ?? undefined,
          createdAt: row.created_at,
          metadata: JSON.parse(row.metadata) as Record<string, unknown>,
        };

        results.push({ document, score });
      }
    }

    // Sort by score descending and limit
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, limit);

    const duration = Date.now() - startTime;
    log.debug(
      {
        totalDocs: rows.length,
        matchingResults: limitedResults.length,
        duration,
        options: validatedOptions,
      },
      'Search complete'
    );

    // Emit event
    this.emitSearchComplete({
      resultCount: limitedResults.length,
      totalSearched: rows.length,
      topScore: limitedResults[0]?.score ?? 0,
      duration,
      filters: {
        domain: validatedOptions.domain,
        sourceType: validatedOptions.sourceType,
        tags: validatedOptions.tags,
      },
      timestamp: new Date(),
    });

    return limitedResults;
  }

  /**
   * Check if content hash already exists.
   * Returns true if duplicate was found (and can be skipped).
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async deduplicateByHash(hash: string): Promise<boolean> {
    this.ensureInitialized();

    const row = this.db!.prepare(
      'SELECT id FROM documents WHERE content_hash = ?'
    ).get(hash) as { id: string } | undefined;

    return row !== undefined;
  }

  /**
   * Get document by ID.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getById(id: string): Promise<VectorDocument | null> {
    this.ensureInitialized();

    const row = this.db!.prepare(
      'SELECT * FROM documents WHERE id = ?'
    ).get(id) as {
      id: string;
      content: string;
      embedding: Buffer;
      source: string;
      source_url: string | null;
      source_type: string;
      title: string | null;
      domain: string | null;
      content_hash: string;
      chunk_index: number;
      chunk_total: number;
      parent_doc_id: string | null;
      created_at: string;
      metadata: string;
    } | undefined;

    if (!row) return null;

    const tagRows = this.db!.prepare(
      'SELECT tag FROM document_tags WHERE document_id = ?'
    ).all(id) as Array<{ tag: string }>;

    return {
      id: row.id,
      content: row.content,
      embedding: deserializeEmbedding(row.embedding),
      source: row.source,
      sourceUrl: row.source_url ?? undefined,
      sourceType: row.source_type as SourceType,
      title: row.title ?? undefined,
      domain: row.domain ?? undefined,
      tags: tagRows.map((t) => t.tag),
      contentHash: row.content_hash,
      chunkIndex: row.chunk_index,
      chunkTotal: row.chunk_total,
      parentDocId: row.parent_doc_id ?? undefined,
      createdAt: row.created_at,
      metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    };
  }

  /**
   * Get document by content hash.
   */
  async getByHash(contentHash: string): Promise<VectorDocument | null> {
    this.ensureInitialized();

    const row = this.db!.prepare(
      'SELECT id FROM documents WHERE content_hash = ?'
    ).get(contentHash) as { id: string } | undefined;

    if (!row) return null;
    return this.getById(row.id);
  }

  /**
   * Delete document by ID.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(id: string): Promise<boolean> {
    this.ensureInitialized();

    const result = this.db!.prepare(
      'DELETE FROM documents WHERE id = ?'
    ).run(id);

    return result.changes > 0;
  }

  /**
   * Delete all chunks of a parent document.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async deleteByParentId(parentDocId: string): Promise<number> {
    this.ensureInitialized();

    const result = this.db!.prepare(
      'DELETE FROM documents WHERE parent_doc_id = ?'
    ).run(parentDocId);

    return result.changes;
  }

  /**
   * Get all documents for a domain.
   */
  async getByDomain(domain: string): Promise<VectorDocument[]> {
    this.ensureInitialized();

    const rows = this.db!.prepare(
      'SELECT id FROM documents WHERE domain = ? ORDER BY created_at DESC'
    ).all(domain) as Array<{ id: string }>;

    const documents: VectorDocument[] = [];
    for (const row of rows) {
      const doc = await this.getById(row.id);
      if (doc) documents.push(doc);
    }

    return documents;
  }

  /**
   * Get all documents with a specific tag.
   */
  async getByTag(tag: string): Promise<VectorDocument[]> {
    this.ensureInitialized();

    const rows = this.db!.prepare(`
      SELECT DISTINCT d.id FROM documents d
      JOIN document_tags dt ON d.id = dt.document_id
      WHERE dt.tag = ?
      ORDER BY d.created_at DESC
    `).all(tag) as Array<{ id: string }>;

    const documents: VectorDocument[] = [];
    for (const row of rows) {
      const doc = await this.getById(row.id);
      if (doc) documents.push(doc);
    }

    return documents;
  }

  /**
   * Get store statistics.
   */
  getStats(): StoreStats {
    this.ensureInitialized();

    // Total documents
    const totalRow = this.db!.prepare(
      'SELECT COUNT(*) as count FROM documents'
    ).get() as { count: number };

    // Total chunks (documents with chunk_total > 1 or chunk_index > 0)
    const chunksRow = this.db!.prepare(
      'SELECT COUNT(*) as count FROM documents WHERE chunk_total > 1'
    ).get() as { count: number };

    // Unique parent documents
    const parentRow = this.db!.prepare(`
      SELECT COUNT(DISTINCT COALESCE(parent_doc_id, id)) as count FROM documents
    `).get() as { count: number };

    // Domains
    const domainRows = this.db!.prepare(
      'SELECT DISTINCT domain FROM documents WHERE domain IS NOT NULL'
    ).all() as Array<{ domain: string }>;

    // Source type counts
    const sourceTypeRows = this.db!.prepare(`
      SELECT source_type, COUNT(*) as count
      FROM documents
      GROUP BY source_type
    `).all() as Array<{ source_type: string; count: number }>;

    const sourceTypeCounts: Record<string, number> = {};
    for (const row of sourceTypeRows) {
      sourceTypeCounts[row.source_type] = row.count;
    }

    // Database size
    let dbSizeBytes = 0;
    try {
      const stat = this.db!.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get() as { size: number } | undefined;
      dbSizeBytes = stat?.size ?? 0;
    } catch {
      // Fallback: use file size
      try {
        const stats = statSync(this.dbPath);
        dbSizeBytes = stats.size;
      } catch {
        dbSizeBytes = 0;
      }
    }

    const totalDocuments = totalRow.count;
    const uniqueParents = parentRow.count;
    const averageChunksPerDocument = uniqueParents > 0
      ? totalDocuments / uniqueParents
      : 0;

    return {
      totalDocuments,
      totalChunks: chunksRow.count,
      domains: domainRows.map((r) => r.domain),
      sourceTypeCounts,
      dbSizeBytes,
      averageChunksPerDocument,
    };
  }

  /**
   * List all unique tags in the store.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async listTags(): Promise<string[]> {
    this.ensureInitialized();

    const rows = this.db!.prepare(
      'SELECT DISTINCT tag FROM document_tags ORDER BY tag'
    ).all() as Array<{ tag: string }>;

    return rows.map((r) => r.tag);
  }

  /**
   * List all unique domains in the store.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async listDomains(): Promise<string[]> {
    this.ensureInitialized();

    const rows = this.db!.prepare(
      'SELECT DISTINCT domain FROM documents WHERE domain IS NOT NULL ORDER BY domain'
    ).all() as Array<{ domain: string }>;

    return rows.map((r) => r.domain);
  }

  /**
   * Clear all documents from the store.
   * Use with caution - this is irreversible.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async clear(): Promise<void> {
    this.ensureInitialized();

    this.db!.exec('DELETE FROM document_tags');
    this.db!.exec('DELETE FROM documents');
    this.db!.exec('VACUUM');

    log.warn('VectorStore cleared');
  }

  /**
   * Close the database connection.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
      log.info('VectorStore closed');
    }
  }

  /**
   * Check if store is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the database path.
   */
  getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Emit vector:document_indexed event.
   */
  private emitDocumentIndexed(payload: {
    documentId: string;
    contentHash: string;
    source: string;
    sourceType: string;
    domain?: string;
    chunkIndex: number;
    chunkTotal: number;
    timestamp: Date;
  }): void {
    if (this.eventBus) {
      this.eventBus.emit('vector:document_indexed', payload);
    }
  }

  /**
   * Emit vector:search_complete event.
   */
  private emitSearchComplete(payload: {
    resultCount: number;
    totalSearched: number;
    topScore: number;
    duration: number;
    filters: {
      domain?: string;
      sourceType?: string;
      tags?: string[];
    };
    timestamp: Date;
  }): void {
    if (this.eventBus) {
      this.eventBus.emit('vector:search_complete', payload);
    }
  }

  /**
   * Batch upsert multiple documents.
   * More efficient than individual upserts.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async upsertBatch(inputs: UpsertDocumentInput[]): Promise<VectorDocument[]> {
    this.ensureInitialized();

    const documents: VectorDocument[] = [];

    const transaction = this.db!.transaction(() => {
      for (const input of inputs) {
        // We call upsert logic inline to stay in transaction
        const validated = UpsertDocumentInputSchema.parse(input);
        const contentHash = computeContentHash(validated.content);

        const existing = this.db!.prepare(
          'SELECT id, created_at FROM documents WHERE content_hash = ?'
        ).get(contentHash) as { id: string; created_at: string } | undefined;

        const id = validated.id ?? existing?.id ?? randomUUID();
        const createdAt = existing?.created_at ?? new Date().toISOString();

        const doc: VectorDocument = {
          id,
          content: validated.content,
          embedding: validated.embedding,
          source: validated.source,
          sourceUrl: validated.sourceUrl,
          sourceType: validated.sourceType,
          title: validated.title,
          domain: validated.domain,
          tags: validated.tags,
          contentHash,
          chunkIndex: validated.chunkIndex,
          chunkTotal: validated.chunkTotal,
          parentDocId: validated.parentDocId,
          createdAt,
          metadata: validated.metadata,
        };

        this.db!.prepare(`
          INSERT INTO documents (
            id, content, embedding, source, source_url, source_type,
            title, domain, content_hash, chunk_index, chunk_total,
            parent_doc_id, created_at, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(content_hash) DO UPDATE SET
            content = excluded.content,
            embedding = excluded.embedding,
            source = excluded.source,
            source_url = excluded.source_url,
            title = excluded.title,
            domain = excluded.domain,
            chunk_index = excluded.chunk_index,
            chunk_total = excluded.chunk_total,
            parent_doc_id = excluded.parent_doc_id,
            metadata = excluded.metadata
        `).run(
          doc.id,
          doc.content,
          serializeEmbedding(doc.embedding),
          doc.source,
          doc.sourceUrl ?? null,
          doc.sourceType,
          doc.title ?? null,
          doc.domain ?? null,
          doc.contentHash,
          doc.chunkIndex,
          doc.chunkTotal,
          doc.parentDocId ?? null,
          doc.createdAt,
          JSON.stringify(doc.metadata)
        );

        // Clear and insert tags
        this.db!.prepare(
          'DELETE FROM document_tags WHERE document_id = ?'
        ).run(doc.id);

        const insertTag = this.db!.prepare(
          'INSERT INTO document_tags (document_id, tag) VALUES (?, ?)'
        );
        for (const tag of doc.tags) {
          insertTag.run(doc.id, tag);
        }

        documents.push(doc);
      }
    });

    transaction();

    log.debug({ count: documents.length }, 'Batch upsert complete');

    return documents;
  }

  /**
   * Count documents matching filters.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async count(options: Partial<SearchOptions> = {}): Promise<number> {
    this.ensureInitialized();

    let query = 'SELECT COUNT(*) as count FROM documents WHERE 1=1';
    const params: unknown[] = [];

    if (options.domain) {
      query += ' AND domain = ?';
      params.push(options.domain);
    }

    if (options.sourceType) {
      query += ' AND source_type = ?';
      params.push(options.sourceType);
    }

    if (options.tags && options.tags.length > 0) {
      const placeholders = options.tags.map(() => '?').join(',');
      query += ` AND id IN (
        SELECT document_id FROM document_tags
        WHERE tag IN (${placeholders})
        GROUP BY document_id
        HAVING COUNT(DISTINCT tag) = ?
      )`;
      params.push(...options.tags, options.tags.length);
    }

    const row = this.db!.prepare(query).get(...params) as { count: number };
    return row.count;
  }
}

// ── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create a VectorStore instance with EventBus integration.
 */
export function createVectorStore(
  eventBus?: EventBus,
  dbPath?: string
): VectorStore {
  return new VectorStore(dbPath, eventBus);
}

// ── Default Export ───────────────────────────────────────────────────────────

export default VectorStore;
