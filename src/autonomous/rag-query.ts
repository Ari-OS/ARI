import type { EventBus } from '../kernel/event-bus.js';
import type { VectorStore, SearchResult } from '../system/vector-store.js';
import type { EmbeddingService } from '../ai/embedding-service.js';

/**
 * Citation in RAG result.
 */
export interface Citation {
  source: string;
  sourceUrl: string | null;
  snippet: string;
  relevanceScore: number;
}

/**
 * Result from RAG query.
 */
export interface RAGResult {
  answer: string;
  citations: Citation[];
  confidence: number;
  sourcesUsed: number;
}

/**
 * Options for RAG query.
 */
export interface RAGQueryOptions {
  topK?: number;
  domain?: string;
  minScore?: number;
}

/**
 * Answer generation function (dependency injection).
 * Takes question and context, returns AI-generated answer.
 */
export type AnswerGenerator = (question: string, context: string) => Promise<string>;

/**
 * RAG (Retrieval-Augmented Generation) query engine.
 *
 * Pipeline steps:
 * 1. Embed the question
 * 2. Search vector store for similar content
 * 3. Deduplicate results per source (keep best match only)
 * 4. Build context from relevant chunks
 * 5. Generate answer (if generateAnswer callback provided)
 *
 * Layer 5 (Execution/Autonomous) — imports from L0-L4 + system/ + ai/
 */
export class RAGQueryEngine {
  private vectorStore: VectorStore;
  private embeddingService: EmbeddingService;
  private eventBus: EventBus;
  private generateAnswer?: AnswerGenerator;

  constructor(
    vectorStore: VectorStore,
    embeddingService: EmbeddingService,
    eventBus: EventBus,
    generateAnswer?: AnswerGenerator,
  ) {
    this.vectorStore = vectorStore;
    this.embeddingService = embeddingService;
    this.eventBus = eventBus;
    this.generateAnswer = generateAnswer;
  }

  /**
   * Query the knowledge base with a question.
   */
  async query(question: string, options: RAGQueryOptions = {}): Promise<RAGResult> {
    const {
      topK = 5,
      domain,
      minScore = 0.3,
    } = options;

    // 1. Embed the question
    const questionEmbedding = await this.embeddingService.embed(question);

    // 2. Search for similar content
    const searchResults = await this.vectorStore.search(questionEmbedding, {
      limit: topK * 2, // Get more results for deduplication
      minScore,
      domain,
    });

    // 3. Deduplicate per source (keep only best match per source)
    const deduplicated = this.deduplicateBySource(searchResults);

    // 4. Take top-K after deduplication
    const topResults = deduplicated.slice(0, topK);

    // 5. Build citations
    const citations: Citation[] = topResults.map(result => ({
      source: result.document.source,
      sourceUrl: result.document.sourceUrl,
      snippet: this.extractSnippet(result.document.content),
      relevanceScore: result.score,
    }));

    // 6. Build context for answer generation
    const context = this.buildContext(topResults);

    // 7. Generate answer (if callback provided)
    let answer: string;
    if (this.generateAnswer) {
      answer = await this.generateAnswer(question, context);
    } else {
      // No answer generator provided — return raw context
      answer = context || 'No relevant information found.';
    }

    // 8. Calculate confidence (average of top scores)
    const confidence = topResults.length > 0
      ? topResults.reduce((sum, r) => sum + r.score, 0) / topResults.length
      : 0;

    // Emit event
    this.eventBus.emit('knowledge:searched', {
      query: question,
      resultCount: topResults.length,
    });

    return {
      answer,
      citations,
      confidence,
      sourcesUsed: topResults.length,
    };
  }

  /**
   * Deduplicate search results by source.
   * For each unique source, keep only the result with the highest score.
   */
  private deduplicateBySource(results: SearchResult[]): SearchResult[] {
    const sourceMap = new Map<string, SearchResult>();

    for (const result of results) {
      const source = result.document.source;
      const existing = sourceMap.get(source);

      // Keep this result if:
      // - No result exists for this source yet
      // - This result has a higher score than the existing one
      if (!existing || result.score > existing.score) {
        sourceMap.set(source, result);
      }
    }

    // Convert back to array and sort by score (descending)
    const deduplicated = Array.from(sourceMap.values());
    deduplicated.sort((a, b) => b.score - a.score);

    return deduplicated;
  }

  /**
   * Build context string from search results.
   * Each result is formatted as:
   * Source: [source] (relevance: [score])
   * [content]
   */
  private buildContext(results: SearchResult[]): string {
    if (results.length === 0) {
      return '';
    }

    const contextParts = results.map((result, index) => {
      const { document, score } = result;
      const sourceInfo = document.sourceUrl
        ? `${document.source} (${document.sourceUrl})`
        : document.source;

      return [
        `[${index + 1}] Source: ${sourceInfo}`,
        `    Relevance: ${(score * 100).toFixed(1)}%`,
        `    ${document.content}`,
      ].join('\n');
    });

    return contextParts.join('\n\n');
  }

  /**
   * Extract a snippet from content for citation.
   * Takes first ~200 characters, breaking at word boundary.
   */
  private extractSnippet(content: string, maxLength: number = 200): string {
    if (content.length <= maxLength) {
      return content;
    }

    // Find last space before maxLength
    const truncated = content.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
      // Use last space if it's reasonably close to the end
      return truncated.slice(0, lastSpace) + '...';
    } else {
      // Otherwise just truncate at maxLength
      return truncated + '...';
    }
  }
}
