import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { EventBus } from '../kernel/event-bus.js';

/**
 * Source type for indexed documents.
 */
export type SourceType =
  | 'article'
  | 'tweet'
  | 'bookmark'
  | 'conversation'
  | 'email'
  | 'file';

/**
 * Document with embedding for vector storage.
 */
export interface VectorDocument {
  id: string;
  content: string;
  embedding: Float32Array;
  source: string;
  sourceUrl: string | null;
  sourceType: SourceType;
  title: string | null;
  domain: string | null;
  tags: string[];
  contentHash: string;
  chunkIndex: number;
  chunkTotal: number;
  parentDocId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

/**
 * Search options for vector similarity.
 */
export interface SearchOptions {
  limit?: number;
  minScore?: number;
  sourceType?: SourceType;
  domain?: string;
  tags?: string[];
}

/**
 * Search result with similarity score.
 */
export interface SearchResult {
  document: VectorDocument;
  score: number;
}

/**
 * Vector store statistics.
 */
export interface VectorStoreStats {
  totalDocuments: number;
  bySourceType: Record<SourceType, number>;
  byDomain: Record<string, number>;
  totalSize: number;
}

/**
 * SQLite-based vector storage with cosine similarity search.
 * Uses better-sqlite3 for performance.
 *
 * Layer 2 (System) — imports only from Kernel.
 */
export class VectorStore {
  private db: null | {
    pragma(sql: string): void;
    prepare(sql: string): {
      run(...params: unknown[]): { changes: number };
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
    };
    close(): void;
  } = null;
  private dbPath: string;
  private eventBus: EventBus;

  constructor(eventBus: EventBus, dbPath?: string) {
    this.eventBus = eventBus;
    this.dbPath = dbPath ?? join(homedir(), '.ari', 'data', 'knowledge.db');
  }

  /**
   * Initialize database with schema.
   * Uses WAL mode for concurrent reads, NORMAL synchronous for performance.
   */
  async init(): Promise<void> {
    // Dynamic import to avoid hard dependency
    let Database;
    try {
      const module = await import('better-sqlite3');
      Database = module.default;
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      throw new Error(`better-sqlite3 not installed: ${err}`);
    }

    // Ensure parent directory exists
    const { mkdir } = await import('node:fs/promises');
    const path = await import('node:path');
    await mkdir(path.dirname(this.dbPath), { recursive: true });

    // Initialize database
    this.db = new (Database as new (path: string) => {
      pragma(sql: string): void;
      prepare(sql: string): {
        run(...params: unknown[]): { changes: number };
        get(...params: unknown[]): unknown;
        all(...params: unknown[]): unknown[];
      };
      close(): void;
    })(this.dbPath);

    // Configure SQLite for performance
    const db = this.db as {
      pragma(sql: string): void;
      prepare(sql: string): {
        run(...params: unknown[]): { changes: number };
        get(...params: unknown[]): unknown;
        all(...params: unknown[]): unknown[];
      };
    };

    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');

    // Create schema
    db.prepare(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        source TEXT NOT NULL,
        source_url TEXT,
        source_type TEXT NOT NULL,
        title TEXT,
        domain TEXT,
        tags TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        chunk_index INTEGER NOT NULL DEFAULT 0,
        chunk_total INTEGER NOT NULL DEFAULT 1,
        parent_doc_id TEXT,
        created_at TEXT NOT NULL,
        metadata TEXT NOT NULL,
        UNIQUE(content_hash)
      )
    `).run();

    // Create indexes
    db.prepare('CREATE INDEX IF NOT EXISTS idx_source ON documents(source)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_domain ON documents(domain)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_source_type ON documents(source_type)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_content_hash ON documents(content_hash)').run();

    this.eventBus.emit('audit:log', {
      action: 'vector_store_init',
      agent: 'system',
      trustLevel: 'system',
      details: { dbPath: this.dbPath },
    });
  }

  /**
   * Upsert a document (insert or update by content hash).
   */
  upsert(doc: VectorDocument): Promise<void> {
    if (!this.db) throw new Error('VectorStore not initialized');

    const db = this.db as {
      prepare(sql: string): {
        run(...params: unknown[]): { changes: number };
      };
    };

    // Convert embedding to Buffer
    const embeddingBuffer = Buffer.from(doc.embedding.buffer);

    const stmt = db.prepare(`
      INSERT INTO documents (
        id, content, embedding, source, source_url, source_type,
        title, domain, tags, content_hash, chunk_index, chunk_total,
        parent_doc_id, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(content_hash) DO UPDATE SET
        content = excluded.content,
        embedding = excluded.embedding,
        source = excluded.source,
        source_url = excluded.source_url,
        title = excluded.title,
        domain = excluded.domain,
        tags = excluded.tags,
        chunk_index = excluded.chunk_index,
        chunk_total = excluded.chunk_total,
        parent_doc_id = excluded.parent_doc_id,
        metadata = excluded.metadata
    `);

    stmt.run(
      doc.id,
      doc.content,
      embeddingBuffer,
      doc.source,
      doc.sourceUrl,
      doc.sourceType,
      doc.title,
      doc.domain,
      JSON.stringify(doc.tags),
      doc.contentHash,
      doc.chunkIndex,
      doc.chunkTotal,
      doc.parentDocId,
      doc.createdAt,
      JSON.stringify(doc.metadata),
    );

    this.eventBus.emit('audit:log', {
      action: 'document_upserted',
      agent: 'system',
      trustLevel: 'system',
      details: {
        docId: doc.id,
        sourceType: doc.sourceType,
        contentHash: doc.contentHash,
      },
    });

    return Promise.resolve();
  }

  /**
   * Search for similar documents using cosine similarity.
   * In-memory computation (fine for <100K docs).
   */
  search(
    queryEmbedding: Float32Array,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    if (!this.db) throw new Error('VectorStore not initialized');

    const {
      limit = 10,
      minScore = 0.0,
      sourceType,
      domain,
      tags = [],
    } = options;

    const db = this.db as {
      prepare(sql: string): {
        all(...params: unknown[]): unknown[];
      };
    };

    // Build query with filters
    let sql = 'SELECT * FROM documents WHERE 1=1';
    const params: unknown[] = [];

    if (sourceType) {
      sql += ' AND source_type = ?';
      params.push(sourceType);
    }

    if (domain) {
      sql += ' AND domain = ?';
      params.push(domain);
    }

    if (tags.length > 0) {
      // Simple tag filter: check if any tag matches
      sql += ' AND (' + tags.map(() => 'tags LIKE ?').join(' OR ') + ')';
      params.push(...tags.map(tag => `%"${tag}"%`));
    }

    const rows = db.prepare(sql).all(...params) as Array<{
      id: string;
      content: string;
      embedding: Buffer;
      source: string;
      source_url: string | null;
      source_type: string;
      title: string | null;
      domain: string | null;
      tags: string;
      content_hash: string;
      chunk_index: number;
      chunk_total: number;
      parent_doc_id: string | null;
      created_at: string;
      metadata: string;
    }>;

    // Compute cosine similarity for each document
    const results: SearchResult[] = [];

    for (const row of rows) {
      const docEmbedding = new Float32Array(row.embedding.buffer);
      const score = this.cosineSimilarity(queryEmbedding, docEmbedding);

      if (score >= minScore) {
        results.push({
          document: {
            id: row.id,
            content: row.content,
            embedding: docEmbedding,
            source: row.source,
            sourceUrl: row.source_url,
            sourceType: row.source_type as SourceType,
            title: row.title,
            domain: row.domain,
            tags: JSON.parse(row.tags) as string[],
            contentHash: row.content_hash,
            chunkIndex: row.chunk_index,
            chunkTotal: row.chunk_total,
            parentDocId: row.parent_doc_id,
            createdAt: row.created_at,
            metadata: JSON.parse(row.metadata) as Record<string, unknown>,
          },
          score,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    const limited = results.slice(0, limit);

    this.eventBus.emit('audit:log', {
      action: 'vector_search',
      agent: 'system',
      trustLevel: 'system',
      details: {
        resultCount: limited.length,
        filters: { sourceType, domain, tags },
      },
    });

    return Promise.resolve(limited);
  }

  /**
   * Compute cosine similarity between two vectors.
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
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
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Check if a document with this content hash already exists.
   */
  deduplicateByHash(hash: string): Promise<boolean> {
    if (!this.db) throw new Error('VectorStore not initialized');

    const db = this.db as {
      prepare(sql: string): {
        get(...params: unknown[]): unknown;
      };
    };

    const row = db.prepare('SELECT id FROM documents WHERE content_hash = ?').get(hash);
    return Promise.resolve(row !== undefined);
  }

  /**
   * Get vector store statistics.
   */
  async getStats(): Promise<VectorStoreStats> {
    if (!this.db) throw new Error('VectorStore not initialized');

    const db = this.db as {
      prepare(sql: string): {
        get(...params: unknown[]): unknown;
        all(...params: unknown[]): unknown[];
      };
    };

    const totalRow = db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
    const total = totalRow.count;

    const bySourceTypeRows = db.prepare(`
      SELECT source_type, COUNT(*) as count
      FROM documents
      GROUP BY source_type
    `).all() as Array<{ source_type: SourceType; count: number }>;

    const bySourceType: Record<SourceType, number> = {
      article: 0,
      tweet: 0,
      bookmark: 0,
      conversation: 0,
      email: 0,
      file: 0,
    };

    for (const row of bySourceTypeRows) {
      bySourceType[row.source_type] = row.count;
    }

    const byDomainRows = db.prepare(`
      SELECT domain, COUNT(*) as count
      FROM documents
      WHERE domain IS NOT NULL
      GROUP BY domain
      ORDER BY count DESC
      LIMIT 20
    `).all() as Array<{ domain: string; count: number }>;

    const byDomain: Record<string, number> = {};
    for (const row of byDomainRows) {
      byDomain[row.domain] = row.count;
    }

    // Get total database size
    const { stat } = await import('node:fs/promises');
    let totalSize = 0;
    try {
      const stats = await stat(this.dbPath);
      totalSize = stats.size;
    } catch {
      // File may not exist yet
    }

    return {
      totalDocuments: total,
      bySourceType,
      byDomain,
      totalSize,
    };
  }

  /**
   * Delete all documents from a source.
   */
  deleteBySource(source: string): Promise<number> {
    if (!this.db) throw new Error('VectorStore not initialized');

    const db = this.db as {
      prepare(sql: string): {
        run(...params: unknown[]): { changes: number };
      };
    };

    const result = db.prepare('DELETE FROM documents WHERE source = ?').run(source);

    this.eventBus.emit('audit:log', {
      action: 'documents_deleted',
      agent: 'system',
      trustLevel: 'system',
      details: { source, count: result.changes },
    });

    return Promise.resolve(result.changes);
  }

  /**
   * Compute SHA-256 hash of content for deduplication.
   */
  static hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Close database connection.
   */
  close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    return Promise.resolve();
  }
}
