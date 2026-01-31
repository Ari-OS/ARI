/**
 * ARI Knowledge Index
 *
 * TF-IDF based semantic search over ARI's knowledge base.
 * Indexes documents, memories, and learned patterns for fast retrieval.
 *
 * Features:
 * - No external dependencies (pure TypeScript TF-IDF)
 * - Provenance tracking for all indexed content
 * - Persistent index at ~/.ari/knowledge/index/
 * - Incremental updates (add without full reindex)
 *
 * The index enables ARI to quickly find relevant knowledge
 * when processing tasks or generating briefings.
 */

import { EventBus } from '../kernel/event-bus.js';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const KNOWLEDGE_INDEX_PATH = path.join(
  process.env.HOME || '~',
  '.ari',
  'knowledge',
  'index'
);

export interface IndexedDocument {
  id: string;
  content: string;
  title?: string;
  source: string; // 'memory', 'file', 'session', 'web'
  sourcePath?: string;
  domain?: string; // 'patterns', 'decisions', 'fixes', 'docs'
  tags?: string[];
  indexedAt: Date;
  hash: string; // SHA-256 of content
  provenance: {
    createdBy: string;
    createdAt: Date;
    modifiedAt?: Date;
  };
}

// Term frequency interface for future use
// interface TermFrequency {
//   term: string;
//   frequency: number;
//   positions: number[];
// }

interface DocumentVector {
  docId: string;
  terms: Map<string, number>; // term -> TF-IDF score
  magnitude: number;
}

interface SearchResult {
  document: IndexedDocument;
  score: number;
  matchedTerms: string[];
  snippet?: string;
}

interface IndexState {
  documentCount: number;
  termCount: number;
  lastIndexed: string;
  domains: Record<string, number>;
}

/**
 * Tokenize text into normalized terms
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 2)
    .filter((term) => !STOP_WORDS.has(term));
}

/**
 * Common English stop words to exclude
 */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
  'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has',
  'have', 'been', 'were', 'being', 'they', 'this', 'that',
  'with', 'will', 'would', 'there', 'their', 'what', 'from',
  'when', 'which', 'into', 'some', 'than', 'then', 'these',
  'those', 'only', 'also', 'just', 'more', 'such', 'very',
]);

export class KnowledgeIndex {
  private eventBus: EventBus;
  private documents: Map<string, IndexedDocument> = new Map();
  private termDocumentFrequency: Map<string, Set<string>> = new Map();
  private documentVectors: Map<string, DocumentVector> = new Map();
  private initialized = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Initialize the index from disk
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await fs.mkdir(KNOWLEDGE_INDEX_PATH, { recursive: true });

    // Load existing index
    await this.loadIndex();

    this.initialized = true;
  }

  /**
   * Index a single document
   */
  async index(doc: Omit<IndexedDocument, 'id' | 'indexedAt' | 'hash'>): Promise<string> {
    await this.ensureInitialized();

    const hash = createHash('sha256').update(doc.content).digest('hex');
    const id = `doc_${hash.slice(0, 16)}`;

    // Check if already indexed (dedup by content hash)
    for (const existing of this.documents.values()) {
      if (existing.hash === hash) {
        return existing.id;
      }
    }

    const indexedDoc: IndexedDocument = {
      ...doc,
      id,
      indexedAt: new Date(),
      hash,
    };

    // Store document
    this.documents.set(id, indexedDoc);

    // Index terms
    this.indexDocumentTerms(indexedDoc);

    // Save to disk
    await this.saveDocument(indexedDoc);

    return id;
  }

  /**
   * Index multiple documents
   */
  async indexBatch(
    docs: Omit<IndexedDocument, 'id' | 'indexedAt' | 'hash'>[]
  ): Promise<string[]> {
    const startTime = Date.now();
    const ids: string[] = [];

    for (const doc of docs) {
      const id = await this.index(doc);
      ids.push(id);
    }

    // Recalculate all document vectors after batch
    this.recalculateVectors();
    await this.saveIndex();

    const duration = Date.now() - startTime;
    this.eventBus.emit('knowledge:indexed', {
      documentCount: docs.length,
      duration,
    });

    return ids;
  }

  /**
   * Search the index using TF-IDF scoring
   */
  async search(
    query: string,
    options: {
      limit?: number;
      domain?: string;
      source?: string;
      minScore?: number;
    } = {}
  ): Promise<SearchResult[]> {
    await this.ensureInitialized();

    const { limit = 10, domain, source, minScore = 0.01 } = options;
    const queryTerms = tokenize(query);

    if (queryTerms.length === 0) {
      return [];
    }

    // Calculate query vector
    const queryVector = this.calculateQueryVector(queryTerms);
    const results: SearchResult[] = [];

    // Score each document
    for (const [docId, docVector] of this.documentVectors.entries()) {
      const doc = this.documents.get(docId);
      if (!doc) continue;

      // Apply filters
      if (domain && doc.domain !== domain) continue;
      if (source && doc.source !== source) continue;

      // Calculate cosine similarity
      const score = this.cosineSimilarity(queryVector, docVector);
      if (score < minScore) continue;

      // Find matched terms
      const matchedTerms = queryTerms.filter((t) => docVector.terms.has(t));

      // Generate snippet
      const snippet = this.generateSnippet(doc.content, matchedTerms);

      results.push({
        document: doc,
        score,
        matchedTerms,
        snippet,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    const topResults = results.slice(0, limit);

    this.eventBus.emit('knowledge:searched', {
      query,
      resultCount: topResults.length,
    });

    return topResults;
  }

  /**
   * Reindex all documents
   */
  async reindexAll(): Promise<void> {
    const startTime = Date.now();

    // Clear vectors
    this.termDocumentFrequency.clear();
    this.documentVectors.clear();

    // Reindex all documents
    for (const doc of this.documents.values()) {
      this.indexDocumentTerms(doc);
    }

    // Recalculate all vectors
    this.recalculateVectors();
    await this.saveIndex();

    const duration = Date.now() - startTime;
    this.eventBus.emit('knowledge:indexed', {
      documentCount: this.documents.size,
      duration,
    });
  }

  /**
   * Remove a document from the index
   */
  async remove(docId: string): Promise<boolean> {
    const doc = this.documents.get(docId);
    if (!doc) return false;

    // Remove from documents
    this.documents.delete(docId);

    // Remove from term frequency
    const terms = tokenize(doc.content);
    for (const term of terms) {
      const docs = this.termDocumentFrequency.get(term);
      if (docs) {
        docs.delete(docId);
        if (docs.size === 0) {
          this.termDocumentFrequency.delete(term);
        }
      }
    }

    // Remove vector
    this.documentVectors.delete(docId);

    // Delete file
    try {
      await fs.unlink(path.join(KNOWLEDGE_INDEX_PATH, 'docs', `${docId}.json`));
    } catch {
      // File may not exist
    }

    return true;
  }

  /**
   * Get index statistics
   */
  getStats(): IndexState {
    const domains: Record<string, number> = {};
    for (const doc of this.documents.values()) {
      const domain = doc.domain || 'unknown';
      domains[domain] = (domains[domain] || 0) + 1;
    }

    return {
      documentCount: this.documents.size,
      termCount: this.termDocumentFrequency.size,
      lastIndexed: new Date().toISOString(),
      domains,
    };
  }

  /**
   * Get a document by ID
   */
  getDocument(docId: string): IndexedDocument | undefined {
    return this.documents.get(docId);
  }

  /**
   * Get documents by domain
   */
  getByDomain(domain: string): IndexedDocument[] {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.domain === domain
    );
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  private indexDocumentTerms(doc: IndexedDocument): void {
    const terms = tokenize(doc.content);

    for (const term of new Set(terms)) {
      if (!this.termDocumentFrequency.has(term)) {
        this.termDocumentFrequency.set(term, new Set());
      }
      this.termDocumentFrequency.get(term)!.add(doc.id);
    }
  }

  private recalculateVectors(): void {
    const totalDocs = this.documents.size;
    if (totalDocs === 0) return;

    for (const doc of this.documents.values()) {
      const terms = tokenize(doc.content);
      const termCounts = new Map<string, number>();

      // Calculate term frequencies
      for (const term of terms) {
        termCounts.set(term, (termCounts.get(term) || 0) + 1);
      }

      // Calculate TF-IDF for each term
      const tfidfScores = new Map<string, number>();
      let magnitudeSquared = 0;

      for (const [term, count] of termCounts.entries()) {
        // TF: term frequency (normalized)
        const tf = count / terms.length;

        // IDF: inverse document frequency
        const docFreq = this.termDocumentFrequency.get(term)?.size || 1;
        const idf = Math.log(totalDocs / docFreq);

        const tfidf = tf * idf;
        tfidfScores.set(term, tfidf);
        magnitudeSquared += tfidf * tfidf;
      }

      const magnitude = Math.sqrt(magnitudeSquared);

      this.documentVectors.set(doc.id, {
        docId: doc.id,
        terms: tfidfScores,
        magnitude,
      });
    }
  }

  private calculateQueryVector(queryTerms: string[]): DocumentVector {
    const termCounts = new Map<string, number>();
    const totalDocs = this.documents.size || 1;

    for (const term of queryTerms) {
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    }

    const tfidfScores = new Map<string, number>();
    let magnitudeSquared = 0;

    for (const [term, count] of termCounts.entries()) {
      const tf = count / queryTerms.length;
      const docFreq = this.termDocumentFrequency.get(term)?.size || 1;
      const idf = Math.log(totalDocs / docFreq);

      const tfidf = tf * idf;
      tfidfScores.set(term, tfidf);
      magnitudeSquared += tfidf * tfidf;
    }

    return {
      docId: 'query',
      terms: tfidfScores,
      magnitude: Math.sqrt(magnitudeSquared),
    };
  }

  private cosineSimilarity(
    queryVector: DocumentVector,
    docVector: DocumentVector
  ): number {
    if (queryVector.magnitude === 0 || docVector.magnitude === 0) {
      return 0;
    }

    let dotProduct = 0;
    for (const [term, queryScore] of queryVector.terms.entries()) {
      const docScore = docVector.terms.get(term);
      if (docScore) {
        dotProduct += queryScore * docScore;
      }
    }

    return dotProduct / (queryVector.magnitude * docVector.magnitude);
  }

  private generateSnippet(content: string, matchedTerms: string[]): string {
    const words = content.split(/\s+/);
    const lowerContent = content.toLowerCase();

    // Find first occurrence of any matched term
    let bestIndex = 0;
    for (const term of matchedTerms) {
      const idx = lowerContent.indexOf(term.toLowerCase());
      if (idx !== -1) {
        bestIndex = Math.floor(idx / 10); // Rough word position
        break;
      }
    }

    // Extract snippet around that position
    const start = Math.max(0, bestIndex - 5);
    const end = Math.min(words.length, bestIndex + 20);
    let snippet = words.slice(start, end).join(' ');

    if (start > 0) snippet = '...' + snippet;
    if (end < words.length) snippet = snippet + '...';

    return snippet.slice(0, 200);
  }

  private async loadIndex(): Promise<void> {
    const docsPath = path.join(KNOWLEDGE_INDEX_PATH, 'docs');

    try {
      await fs.mkdir(docsPath, { recursive: true });
      const files = await fs.readdir(docsPath);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const content = await fs.readFile(path.join(docsPath, file), 'utf-8');
          const doc = JSON.parse(content) as IndexedDocument;
          doc.indexedAt = new Date(doc.indexedAt);
          doc.provenance.createdAt = new Date(doc.provenance.createdAt);
          if (doc.provenance.modifiedAt) {
            doc.provenance.modifiedAt = new Date(doc.provenance.modifiedAt);
          }

          this.documents.set(doc.id, doc);
          this.indexDocumentTerms(doc);
        } catch {
          // Skip corrupted files
        }
      }

      // Recalculate vectors
      this.recalculateVectors();
    } catch {
      // No existing index
    }
  }

  private async saveDocument(doc: IndexedDocument): Promise<void> {
    const docsPath = path.join(KNOWLEDGE_INDEX_PATH, 'docs');
    await fs.mkdir(docsPath, { recursive: true });

    await fs.writeFile(
      path.join(docsPath, `${doc.id}.json`),
      JSON.stringify(doc, null, 2)
    );
  }

  private async saveIndex(): Promise<void> {
    const indexMetaPath = path.join(KNOWLEDGE_INDEX_PATH, 'index-meta.json');

    const meta = {
      documentCount: this.documents.size,
      termCount: this.termDocumentFrequency.size,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(indexMetaPath, JSON.stringify(meta, null, 2));
  }
}
