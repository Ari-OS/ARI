/**
 * IngestionPipeline — Document Ingestion for Knowledge System
 *
 * Layer 5 (Autonomous): Imports from L0-L4.
 *
 * Features:
 * - Multi-source document ingestion (files, emails, conversations, web)
 * - Intelligent chunking (500 tokens with 50 token overlap)
 * - Vector embedding generation via EmbeddingService
 * - Content hash deduplication
 * - Provenance tracking for all ingested content
 * - File bomb protection (10MB limit)
 * - Path traversal protection
 * - Executable file type blocking
 */

import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { EventBus } from '../kernel/event-bus.js';
import type { EmbeddingService } from '../ai/embedding-service.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type SourceType = 'article' | 'tweet' | 'bookmark' | 'conversation' | 'email' | 'file';

export interface IngestionOptions {
  source: string;
  sourceType: SourceType;
  sourceUrl?: string;
  title?: string;
  domain?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface IngestionResult {
  documentId: string;
  chunksCreated: number;
  tokensUsed: number;
  duration: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  embedding?: Float32Array;
  hash: string;
  metadata: {
    source: string;
    sourceType: SourceType;
    sourceUrl?: string;
    title?: string;
    domain?: string;
    tags?: string[];
    ingestedAt: string;
    provenance: {
      originalHash: string;
      chunkHash: string;
    };
  };
}

export interface VectorStore {
  add(chunks: DocumentChunk[]): Promise<void>;
  search(embedding: Float32Array, limit?: number): Promise<DocumentChunk[]>;
  delete(documentId: string): Promise<void>;
  exists(hash: string): Promise<boolean>;
}

export interface IngestionPipelineOptions {
  maxFileSizeBytes?: number;
  chunkSizeTokens?: number;
  chunkOverlapTokens?: number;
  allowedBasePaths?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_CHUNK_SIZE_TOKENS = 500;
const DEFAULT_CHUNK_OVERLAP_TOKENS = 50;
const CHARS_PER_TOKEN_ESTIMATE = 4; // Rough approximation

/**
 * Blocked executable file extensions (security)
 */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib',     // Binaries
  '.sh', '.bash', '.zsh', '.fish',     // Shell scripts
  '.bat', '.cmd', '.ps1', '.psm1',     // Windows scripts
  '.py', '.pyc', '.pyo',               // Python (when raw execution)
  '.js', '.mjs', '.cjs',               // JavaScript
  '.jar', '.class',                    // Java
  '.rb', '.pl', '.php',                // Other scripting
  '.app', '.dmg', '.pkg', '.msi',      // Installers
  '.com', '.scr', '.pif', '.vbs',      // Legacy Windows
  '.ws', '.wsf', '.wsc', '.wsh',       // Windows Script Host
]);

/**
 * Allowed text-based extensions for file ingestion
 */
const ALLOWED_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown',          // Plain text
  '.json', '.yaml', '.yml', '.toml',   // Config formats
  '.csv', '.tsv',                      // Data formats
  '.html', '.htm', '.xml',             // Markup
  '.rst', '.adoc', '.org',             // Documentation
  '.log', '.cfg', '.conf', '.ini',     // Config/logs
  '.tex', '.bib',                      // LaTeX
]);

// ═══════════════════════════════════════════════════════════════════════════════
// INGESTION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

export class IngestionPipeline {
  private readonly eventBus: EventBus;
  private readonly vectorStore: VectorStore;
  private readonly embeddingService: EmbeddingService;
  private readonly maxFileSizeBytes: number;
  private readonly chunkSizeTokens: number;
  private readonly chunkOverlapTokens: number;
  private readonly allowedBasePaths: string[];
  private readonly ingestedHashes: Set<string> = new Set();

  constructor(
    eventBus: EventBus,
    vectorStore: VectorStore,
    embeddingService: EmbeddingService,
    options?: IngestionPipelineOptions
  ) {
    this.eventBus = eventBus;
    this.vectorStore = vectorStore;
    this.embeddingService = embeddingService;
    this.maxFileSizeBytes = options?.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
    this.chunkSizeTokens = options?.chunkSizeTokens ?? DEFAULT_CHUNK_SIZE_TOKENS;
    this.chunkOverlapTokens = options?.chunkOverlapTokens ?? DEFAULT_CHUNK_OVERLAP_TOKENS;
    this.allowedBasePaths = options?.allowedBasePaths ?? [
      process.env.HOME || '/home',
      '/tmp',
    ];
  }

  /**
   * Ingest content from a string source.
   */
  async ingest(content: string, options: IngestionOptions): Promise<IngestionResult> {
    const startTime = Date.now();

    // Validate content
    if (!content || content.trim().length === 0) {
      throw new Error('Content cannot be empty');
    }

    // Generate document ID and content hash
    const contentHash = this.computeHash(content);
    const documentId = `doc_${contentHash.slice(0, 16)}`;

    // Check for duplicate content
    if (this.ingestedHashes.has(contentHash) || await this.vectorStore.exists(contentHash)) {
      return {
        documentId,
        chunksCreated: 0,
        tokensUsed: 0,
        duration: Date.now() - startTime,
      };
    }

    // Chunk the content
    const chunks = this.chunkContent(content, documentId, contentHash, options);

    if (chunks.length === 0) {
      return {
        documentId,
        chunksCreated: 0,
        tokensUsed: 0,
        duration: Date.now() - startTime,
      };
    }

    // Generate embeddings for all chunks
    const chunkTexts = chunks.map(c => c.content);
    const embeddings = await this.embeddingService.embedBatch(chunkTexts);

    // Attach embeddings to chunks
    let totalTokens = 0;
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i].embedding;
      totalTokens += embeddings[i].tokens;
    }

    // Store in vector store
    await this.vectorStore.add(chunks);

    // Track hash for deduplication
    this.ingestedHashes.add(contentHash);

    const duration = Date.now() - startTime;

    // Emit ingestion event
    this.eventBus.emit('knowledge:ingested', {
      sourceType: options.sourceType,
      sourceId: options.source,
      chunksCreated: chunks.length,
    });

    return {
      documentId,
      chunksCreated: chunks.length,
      tokensUsed: totalTokens,
      duration,
    };
  }

  /**
   * Ingest content from a file.
   */
  async ingestFile(
    filePath: string,
    options: Omit<IngestionOptions, 'sourceType'>
  ): Promise<IngestionResult> {
    const startTime = Date.now();

    // Security: Validate and normalize path
    const normalizedPath = this.validateFilePath(filePath);

    // Security: Check file extension
    const ext = path.extname(normalizedPath).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw new Error(`Blocked file type: ${ext} (executable files not allowed)`);
    }

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    // Check file exists and get stats
    const stats = await fs.stat(normalizedPath);

    // Security: File bomb protection
    if (stats.size > this.maxFileSizeBytes) {
      throw new Error(
        `File too large: ${stats.size} bytes (max: ${this.maxFileSizeBytes} bytes)`
      );
    }

    if (!stats.isFile()) {
      throw new Error('Path is not a regular file');
    }

    // Read file content
    const content = await fs.readFile(normalizedPath, 'utf-8');

    // Ingest with file source type
    const result = await this.ingest(content, {
      ...options,
      sourceType: 'file',
      source: options.source || normalizedPath,
    });

    return {
      ...result,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Ingest multiple items in batch.
   */
  async ingestBatch(
    items: Array<{ content: string; options: IngestionOptions }>
  ): Promise<IngestionResult[]> {
    const results: IngestionResult[] = [];

    for (const item of items) {
      try {
        const result = await this.ingest(item.content, item.options);
        results.push(result);
      } catch (error) {
        // Log error but continue with batch
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({
          documentId: `error_${randomUUID().slice(0, 8)}`,
          chunksCreated: 0,
          tokensUsed: 0,
          duration: 0,
        });
        this.eventBus.emit('system:error', {
          error: error instanceof Error ? error : new Error(errorMsg),
          context: `ingestion-batch-item:${item.options.source}`,
        });
      }
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compute SHA-256 hash of content.
   */
  private computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Validate file path for security (path traversal protection).
   */
  private validateFilePath(filePath: string): string {
    // Resolve to absolute path
    const absolutePath = path.resolve(filePath);

    // Normalize to remove .. and . components
    const normalizedPath = path.normalize(absolutePath);

    // Check for path traversal attempts
    if (normalizedPath !== absolutePath) {
      throw new Error('Path traversal detected');
    }

    // Ensure path is within allowed base paths
    const isAllowed = this.allowedBasePaths.some(basePath => {
      const normalizedBase = path.normalize(path.resolve(basePath));
      return normalizedPath.startsWith(normalizedBase);
    });

    if (!isAllowed) {
      throw new Error(`Path not in allowed directories: ${normalizedPath}`);
    }

    // Additional check for suspicious patterns
    if (filePath.includes('..') || filePath.includes('\0')) {
      throw new Error('Invalid path characters detected');
    }

    return normalizedPath;
  }

  /**
   * Chunk content into overlapping segments.
   */
  private chunkContent(
    content: string,
    documentId: string,
    contentHash: string,
    options: IngestionOptions
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    // Split into paragraphs first
    const paragraphs = this.splitIntoParagraphs(content);

    // Estimate chunk size in characters
    const chunkSizeChars = this.chunkSizeTokens * CHARS_PER_TOKEN_ESTIMATE;
    const overlapChars = this.chunkOverlapTokens * CHARS_PER_TOKEN_ESTIMATE;

    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      // If adding this paragraph exceeds chunk size, finalize current chunk
      if (currentChunk.length + paragraph.length > chunkSizeChars && currentChunk.length > 0) {
        const chunk = this.createChunk(
          currentChunk.trim(),
          documentId,
          contentHash,
          chunkIndex,
          options
        );
        chunks.push(chunk);
        chunkIndex++;

        // Start new chunk with overlap from previous
        const overlapStart = Math.max(0, currentChunk.length - overlapChars);
        currentChunk = currentChunk.slice(overlapStart) + '\n\n' + paragraph;
      } else {
        // Add paragraph to current chunk
        currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
      }
    }

    // Add final chunk if not empty
    if (currentChunk.trim().length > 0) {
      const chunk = this.createChunk(
        currentChunk.trim(),
        documentId,
        contentHash,
        chunkIndex,
        options
      );
      chunks.push(chunk);
    }

    // Update totalChunks in all chunks
    for (const chunk of chunks) {
      chunk.totalChunks = chunks.length;
    }

    return chunks;
  }

  /**
   * Split content into paragraphs intelligently.
   */
  private splitIntoParagraphs(content: string): string[] {
    // Split on double newlines (paragraph breaks)
    const paragraphs = content
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // If no paragraph breaks, split on single newlines
    if (paragraphs.length === 1 && paragraphs[0].length > this.chunkSizeTokens * CHARS_PER_TOKEN_ESTIMATE) {
      return content
        .split(/\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
    }

    return paragraphs;
  }

  /**
   * Create a document chunk with metadata.
   */
  private createChunk(
    content: string,
    documentId: string,
    contentHash: string,
    chunkIndex: number,
    options: IngestionOptions
  ): DocumentChunk {
    const chunkHash = this.computeHash(content);

    return {
      id: `${documentId}_chunk_${chunkIndex}`,
      documentId,
      content,
      chunkIndex,
      totalChunks: 0, // Will be updated after all chunks created
      hash: chunkHash,
      metadata: {
        source: options.source,
        sourceType: options.sourceType,
        sourceUrl: options.sourceUrl,
        title: options.title,
        domain: options.domain,
        tags: options.tags,
        ingestedAt: new Date().toISOString(),
        provenance: {
          originalHash: contentHash,
          chunkHash,
        },
      },
    };
  }
}
