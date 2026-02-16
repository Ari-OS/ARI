/**
 * Readwise Integration
 *
 * Syncs reading highlights from Kindle, articles, PDFs, and more via Readwise API
 * Cost: $8/month
 *
 * Usage:
 *   const readwise = new ReadwiseClient(process.env.READWISE_API_KEY);
 *   const highlights = await readwise.getHighlights();
 *   const daily = await readwise.getDailyReview();
 */

import { createLogger } from '../../kernel/logger.js';

const log = createLogger('readwise-client');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Highlight {
  id: number;
  text: string;
  note?: string;
  location?: number;
  bookTitle: string;
  bookAuthor: string;
  highlightedAt: string;
  url?: string;
  tags: string[];
}

export interface Book {
  id: number;
  title: string;
  author: string;
  category: string;
  numHighlights: number;
  lastHighlightAt: string;
  coverUrl?: string;
}

interface ApiHighlightResponse {
  results: Array<{
    id: number;
    text: string;
    note: string | null;
    location: number | null;
    location_type: string;
    highlighted_at: string;
    url: string | null;
    color: string;
    updated: string;
    book_id: number;
    tags: Array<{
      name: string;
    }>;
  }>;
  next: string | null;
  count: number;
}

interface ApiBookResponse {
  results: Array<{
    id: number;
    title: string;
    author: string;
    category: string;
    num_highlights: number;
    last_highlight_at: string;
    updated: string;
    cover_image_url: string | null;
    highlights_url: string;
    source_url: string | null;
    asin: string | null;
  }>;
  next: string | null;
  count: number;
}

interface ApiDailyReviewResponse {
  highlights: Array<{
    id: number;
    text: string;
    title: string;
    author: string;
    url: string | null;
    note: string | null;
    location: number | null;
    location_type: string;
    highlighted_at: string;
    tags: Array<{
      name: string;
    }>;
  }>;
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

// ─── Readwise Client ────────────────────────────────────────────────────────

export class ReadwiseClient {
  private apiKey: string;
  private baseUrl = 'https://readwise.io/api/v2';
  private cacheTtlMs = 30 * 60 * 1000; // 30 minutes
  private highlightsCache: Map<string, CacheEntry<Highlight[]>> = new Map();
  private booksCache: Map<string, CacheEntry<Book[]>> = new Map();
  private dailyReviewCache: CacheEntry<Highlight[]> | null = null;
  private maxPageSize = 1000;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Readwise API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Get highlights, optionally filtered by date
   */
  async getHighlights(since?: Date, pageSize: number = 100): Promise<Highlight[]> {
    const cacheKey = `highlights-${since?.toISOString() ?? 'all'}-${pageSize}`;
    const cached = this.highlightsCache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      log.debug('Using cached highlights');
      return cached.data;
    }

    try {
      const allHighlights: Highlight[] = [];
      let nextUrl: string | null = this.buildHighlightsUrl(since, pageSize);

      while (nextUrl) {
        const response = await fetch(nextUrl, {
          headers: {
            'Authorization': `Token ${this.apiKey}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Readwise API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as ApiHighlightResponse;

        // Fetch book details for each highlight
        const bookDetailsMap = await this.fetchBookDetailsForHighlights(data.results);

        const highlights = data.results.map(h => {
          const bookInfo = bookDetailsMap.get(h.book_id);
          return {
            id: h.id,
            text: h.text,
            note: h.note ?? undefined,
            location: h.location ?? undefined,
            bookTitle: bookInfo?.title ?? 'Unknown',
            bookAuthor: bookInfo?.author ?? 'Unknown',
            highlightedAt: h.highlighted_at,
            url: h.url ?? undefined,
            tags: h.tags.map(t => t.name),
          };
        });

        allHighlights.push(...highlights);
        nextUrl = data.next;

        log.debug(`Fetched ${highlights.length} highlights (total: ${allHighlights.length})`);
      }

      this.highlightsCache.set(cacheKey, { data: allHighlights, fetchedAt: Date.now() });
      log.info(`Fetched ${allHighlights.length} total highlights`);
      return allHighlights;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to fetch highlights: ${message}`);
      throw new Error(`Failed to fetch highlights: ${message}`);
    }
  }

  /**
   * Get books, optionally filtered by category
   */
  async getBooks(category?: string): Promise<Book[]> {
    const cacheKey = `books-${category ?? 'all'}`;
    const cached = this.booksCache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      log.debug('Using cached books');
      return cached.data;
    }

    try {
      const allBooks: Book[] = [];
      let nextUrl: string | null = this.buildBooksUrl(category);

      while (nextUrl) {
        const response = await fetch(nextUrl, {
          headers: {
            'Authorization': `Token ${this.apiKey}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Readwise API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as ApiBookResponse;

        const books = data.results.map(b => ({
          id: b.id,
          title: b.title,
          author: b.author,
          category: b.category,
          numHighlights: b.num_highlights,
          lastHighlightAt: b.last_highlight_at,
          coverUrl: b.cover_image_url ?? undefined,
        }));

        allBooks.push(...books);
        nextUrl = data.next;

        log.debug(`Fetched ${books.length} books (total: ${allBooks.length})`);
      }

      this.booksCache.set(cacheKey, { data: allBooks, fetchedAt: Date.now() });
      log.info(`Fetched ${allBooks.length} total books`);
      return allBooks;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to fetch books: ${message}`);
      throw new Error(`Failed to fetch books: ${message}`);
    }
  }

  /**
   * Get daily review highlights
   */
  async getDailyReview(): Promise<Highlight[]> {
    if (this.dailyReviewCache && Date.now() - this.dailyReviewCache.fetchedAt < this.cacheTtlMs) {
      log.debug('Using cached daily review');
      return this.dailyReviewCache.data;
    }

    try {
      const url = `${this.baseUrl}/review/`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Readwise API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as ApiDailyReviewResponse;

      const highlights = data.highlights.map(h => ({
        id: h.id,
        text: h.text,
        note: h.note ?? undefined,
        location: h.location ?? undefined,
        bookTitle: h.title,
        bookAuthor: h.author,
        highlightedAt: h.highlighted_at,
        url: h.url ?? undefined,
        tags: h.tags.map(t => t.name),
      }));

      this.dailyReviewCache = { data: highlights, fetchedAt: Date.now() };
      log.info(`Fetched ${highlights.length} daily review highlights`);
      return highlights;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to fetch daily review: ${message}`);
      throw new Error(`Failed to fetch daily review: ${message}`);
    }
  }

  /**
   * Create a new highlight
   */
  async createHighlight(text: string, title: string, author?: string): Promise<Highlight> {
    try {
      const url = `${this.baseUrl}/highlights/`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          highlights: [
            {
              text,
              title,
              author: author ?? 'Unknown',
              source_type: 'manual',
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Readwise API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as Array<{ id: number; text: string; title: string; author: string }>;
      const created = data[0];

      const highlight: Highlight = {
        id: created.id,
        text: created.text,
        bookTitle: created.title,
        bookAuthor: created.author,
        highlightedAt: new Date().toISOString(),
        tags: [],
      };

      log.info(`Created highlight: "${text.slice(0, 50)}..." in "${title}"`);
      return highlight;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to create highlight: ${message}`);
      throw new Error(`Failed to create highlight: ${message}`);
    }
  }

  /**
   * Format highlights for briefing display
   */
  formatForBriefing(highlights: Highlight[], limit: number = 5): string {
    const lines: string[] = [];

    const displayHighlights = highlights.slice(0, limit);

    for (const highlight of displayHighlights) {
      lines.push(`"${highlight.text}"`);
      lines.push(`  — ${highlight.bookTitle} by ${highlight.bookAuthor}`);

      if (highlight.note) {
        lines.push(`  Note: ${highlight.note}`);
      }

      if (highlight.tags.length > 0) {
        lines.push(`  Tags: ${highlight.tags.join(', ')}`);
      }

      lines.push('');
    }

    if (highlights.length > limit) {
      lines.push(`... and ${highlights.length - limit} more highlights`);
    }

    return lines.join('\n');
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private buildHighlightsUrl(since?: Date, pageSize: number = 100): string {
    const params = new URLSearchParams({
      page_size: Math.min(pageSize, this.maxPageSize).toString(),
    });

    if (since) {
      params.append('updated__gt', since.toISOString());
    }

    return `${this.baseUrl}/highlights/?${params.toString()}`;
  }

  private buildBooksUrl(category?: string): string {
    const params = new URLSearchParams({
      page_size: this.maxPageSize.toString(),
    });

    if (category) {
      params.append('category', category);
    }

    return `${this.baseUrl}/books/?${params.toString()}`;
  }

  private async fetchBookDetailsForHighlights(
    highlights: ApiHighlightResponse['results']
  ): Promise<Map<number, { title: string; author: string }>> {
    const bookIds = new Set(highlights.map(h => h.book_id));
    const bookDetailsMap = new Map<number, { title: string; author: string }>();

    try {
      const bookIdArray = Array.from(bookIds);
      for (const bookId of bookIdArray) {
        const response = await fetch(`${this.baseUrl}/books/${bookId}/`, {
          headers: {
            'Authorization': `Token ${this.apiKey}`,
          },
        });

        if (response.ok) {
          const book = await response.json() as { id: number; title: string; author: string };
          bookDetailsMap.set(book.id, { title: book.title, author: book.author });
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`Failed to fetch some book details: ${message}`);
    }

    return bookDetailsMap;
  }
}
