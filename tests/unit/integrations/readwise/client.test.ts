import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReadwiseClient, type Highlight, type Book } from '../../../../src/integrations/readwise/client.js';

// Mock logger
vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Test Data ──────────────────────────────────────────────────────────────

const MOCK_HIGHLIGHTS_RESPONSE = {
  results: [
    {
      id: 1,
      text: 'The best way to predict the future is to invent it.',
      note: 'Great insight on innovation',
      location: 42,
      location_type: 'page',
      highlighted_at: '2026-02-15T10:30:00Z',
      url: 'https://example.com/article',
      color: 'yellow',
      updated: '2026-02-15T10:30:00Z',
      book_id: 100,
      tags: [{ name: 'innovation' }, { name: 'future' }],
    },
    {
      id: 2,
      text: 'Simplicity is the ultimate sophistication.',
      note: null,
      location: null,
      location_type: 'order',
      highlighted_at: '2026-02-14T15:20:00Z',
      url: null,
      color: 'blue',
      updated: '2026-02-14T15:20:00Z',
      book_id: 101,
      tags: [{ name: 'design' }],
    },
  ],
  next: null,
  count: 2,
};

const MOCK_BOOKS_RESPONSE = {
  results: [
    {
      id: 100,
      title: 'The Innovators',
      author: 'Walter Isaacson',
      category: 'books',
      num_highlights: 15,
      last_highlight_at: '2026-02-15T10:30:00Z',
      updated: '2026-02-15T10:30:00Z',
      cover_image_url: 'https://example.com/cover1.jpg',
      highlights_url: 'https://readwise.io/books/100',
      source_url: 'https://amazon.com/book1',
      asin: 'B001ABC123',
    },
    {
      id: 101,
      title: 'Design Principles',
      author: 'Leonardo da Vinci',
      category: 'articles',
      num_highlights: 8,
      last_highlight_at: '2026-02-14T15:20:00Z',
      updated: '2026-02-14T15:20:00Z',
      cover_image_url: null,
      highlights_url: 'https://readwise.io/books/101',
      source_url: null,
      asin: null,
    },
  ],
  next: null,
  count: 2,
};

const MOCK_DAILY_REVIEW_RESPONSE = {
  highlights: [
    {
      id: 3,
      text: 'Code is read more often than it is written.',
      title: 'Clean Code',
      author: 'Robert Martin',
      url: 'https://example.com/cleancode',
      note: 'Important reminder',
      location: 10,
      location_type: 'page',
      highlighted_at: '2026-01-20T08:00:00Z',
      tags: [{ name: 'programming' }],
    },
  ],
};

const MOCK_BOOK_DETAIL_100 = {
  id: 100,
  title: 'The Innovators',
  author: 'Walter Isaacson',
};

const MOCK_BOOK_DETAIL_101 = {
  id: 101,
  title: 'Design Principles',
  author: 'Leonardo da Vinci',
};

const MOCK_CREATE_RESPONSE = [
  {
    id: 999,
    text: 'Test highlight text',
    title: 'Test Book',
    author: 'Test Author',
  },
];

// ─── Mock Fetch ─────────────────────────────────────────────────────────────

function mockFetch(response: unknown, status: number = 200): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => response,
  });
}

function mockFetchError(message: string): void {
  global.fetch = vi.fn().mockRejectedValue(new Error(message));
}

function mockFetchMultiple(responses: Array<{ url: string; response: unknown; status?: number }>): void {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    const match = responses.find(r => String(url).includes(r.url));
    if (!match) {
      return Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({}),
      });
    }
    return Promise.resolve({
      ok: (match.status ?? 200) >= 200 && (match.status ?? 200) < 300,
      status: match.status ?? 200,
      statusText: 'OK',
      json: async () => match.response,
    });
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ReadwiseClient', () => {
  let client: ReadwiseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ReadwiseClient('test-api-key');
  });

  describe('constructor', () => {
    it('should throw if API key is missing', () => {
      expect(() => new ReadwiseClient('')).toThrow('Readwise API key is required');
    });

    it('should create client with valid API key', () => {
      expect(client).toBeInstanceOf(ReadwiseClient);
    });
  });

  describe('getHighlights', () => {
    it('should fetch and parse highlights', async () => {
      mockFetchMultiple([
        { url: 'highlights', response: MOCK_HIGHLIGHTS_RESPONSE },
        { url: 'books/100', response: MOCK_BOOK_DETAIL_100 },
        { url: 'books/101', response: MOCK_BOOK_DETAIL_101 },
      ]);

      const highlights = await client.getHighlights();

      expect(highlights).toHaveLength(2);
      expect(highlights[0].id).toBe(1);
      expect(highlights[0].text).toBe('The best way to predict the future is to invent it.');
      expect(highlights[0].note).toBe('Great insight on innovation');
      expect(highlights[0].location).toBe(42);
      expect(highlights[0].bookTitle).toBe('The Innovators');
      expect(highlights[0].bookAuthor).toBe('Walter Isaacson');
      expect(highlights[0].highlightedAt).toBe('2026-02-15T10:30:00Z');
      expect(highlights[0].url).toBe('https://example.com/article');
      expect(highlights[0].tags).toEqual(['innovation', 'future']);

      expect(highlights[1].id).toBe(2);
      expect(highlights[1].note).toBeUndefined();
      expect(highlights[1].location).toBeUndefined();
      expect(highlights[1].url).toBeUndefined();
    });

    it('should filter by date when provided', async () => {
      mockFetchMultiple([
        { url: 'highlights', response: MOCK_HIGHLIGHTS_RESPONSE },
        { url: 'books/100', response: MOCK_BOOK_DETAIL_100 },
        { url: 'books/101', response: MOCK_BOOK_DETAIL_101 },
      ]);

      const since = new Date('2026-02-14T00:00:00Z');
      await client.getHighlights(since);

      const fetchMock = vi.mocked(global.fetch);
      const firstCall = fetchMock.mock.calls[0][0] as string;
      expect(firstCall).toContain('updated__gt=');
      expect(firstCall).toContain(encodeURIComponent(since.toISOString()));
    });

    it('should respect page size parameter', async () => {
      mockFetchMultiple([
        { url: 'highlights', response: MOCK_HIGHLIGHTS_RESPONSE },
        { url: 'books/100', response: MOCK_BOOK_DETAIL_100 },
        { url: 'books/101', response: MOCK_BOOK_DETAIL_101 },
      ]);

      await client.getHighlights(undefined, 50);

      const fetchMock = vi.mocked(global.fetch);
      const firstCall = fetchMock.mock.calls[0][0] as string;
      expect(firstCall).toContain('page_size=50');
    });

    it('should cap page size at 1000', async () => {
      mockFetchMultiple([
        { url: 'highlights', response: MOCK_HIGHLIGHTS_RESPONSE },
        { url: 'books/100', response: MOCK_BOOK_DETAIL_100 },
        { url: 'books/101', response: MOCK_BOOK_DETAIL_101 },
      ]);

      await client.getHighlights(undefined, 2000);

      const fetchMock = vi.mocked(global.fetch);
      const firstCall = fetchMock.mock.calls[0][0] as string;
      expect(firstCall).toContain('page_size=1000');
    });

    it('should paginate through multiple pages', async () => {
      const page1 = {
        results: [MOCK_HIGHLIGHTS_RESPONSE.results[0]],
        next: 'https://readwise.io/api/v2/highlights/?page=2',
        count: 2,
      };

      const page2 = {
        results: [MOCK_HIGHLIGHTS_RESPONSE.results[1]],
        next: null,
        count: 2,
      };

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (String(url).includes('page=2')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => page2,
          });
        } else if (String(url).includes('books/')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => MOCK_BOOK_DETAIL_100,
          });
        } else {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => page1,
          });
        }
      });

      const highlights = await client.getHighlights();

      expect(highlights).toHaveLength(2);
    });

    it('should use cached results within TTL', async () => {
      mockFetchMultiple([
        { url: 'highlights', response: MOCK_HIGHLIGHTS_RESPONSE },
        { url: 'books/100', response: MOCK_BOOK_DETAIL_100 },
        { url: 'books/101', response: MOCK_BOOK_DETAIL_101 },
      ]);

      await client.getHighlights();
      await client.getHighlights();

      const fetchMock = vi.mocked(global.fetch);
      const highlightsCalls = fetchMock.mock.calls.filter(call =>
        String(call[0]).includes('highlights')
      );
      expect(highlightsCalls).toHaveLength(1);
    });

    it('should include authorization header', async () => {
      mockFetchMultiple([
        { url: 'highlights', response: MOCK_HIGHLIGHTS_RESPONSE },
        { url: 'books/100', response: MOCK_BOOK_DETAIL_100 },
        { url: 'books/101', response: MOCK_BOOK_DETAIL_101 },
      ]);

      await client.getHighlights();

      const fetchMock = vi.mocked(global.fetch);
      const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Token test-api-key');
    });

    it('should handle API errors', async () => {
      mockFetch({}, 401);

      await expect(client.getHighlights()).rejects.toThrow('Failed to fetch highlights');
    });

    it('should handle network errors', async () => {
      mockFetchError('Network failure');

      await expect(client.getHighlights()).rejects.toThrow('Failed to fetch highlights');
    });

    it('should gracefully handle missing book details', async () => {
      mockFetchMultiple([
        { url: 'highlights', response: MOCK_HIGHLIGHTS_RESPONSE },
        { url: 'books/100', response: {}, status: 404 },
        { url: 'books/101', response: {}, status: 404 },
      ]);

      const highlights = await client.getHighlights();

      expect(highlights[0].bookTitle).toBe('Unknown');
      expect(highlights[0].bookAuthor).toBe('Unknown');
    });
  });

  describe('getBooks', () => {
    it('should fetch and parse books', async () => {
      mockFetch(MOCK_BOOKS_RESPONSE);

      const books = await client.getBooks();

      expect(books).toHaveLength(2);
      expect(books[0].id).toBe(100);
      expect(books[0].title).toBe('The Innovators');
      expect(books[0].author).toBe('Walter Isaacson');
      expect(books[0].category).toBe('books');
      expect(books[0].numHighlights).toBe(15);
      expect(books[0].lastHighlightAt).toBe('2026-02-15T10:30:00Z');
      expect(books[0].coverUrl).toBe('https://example.com/cover1.jpg');

      expect(books[1].coverUrl).toBeUndefined();
    });

    it('should filter by category when provided', async () => {
      mockFetch(MOCK_BOOKS_RESPONSE);

      await client.getBooks('articles');

      const fetchMock = vi.mocked(global.fetch);
      const callUrl = fetchMock.mock.calls[0][0] as string;
      expect(callUrl).toContain('category=articles');
    });

    it('should paginate through multiple pages', async () => {
      const page1 = {
        results: [MOCK_BOOKS_RESPONSE.results[0]],
        next: 'https://readwise.io/api/v2/books/?page=2',
        count: 2,
      };

      const page2 = {
        results: [MOCK_BOOKS_RESPONSE.results[1]],
        next: null,
        count: 2,
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => page1,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => page2,
        });

      const books = await client.getBooks();

      expect(books).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should use cached results within TTL', async () => {
      mockFetch(MOCK_BOOKS_RESPONSE);

      await client.getBooks();
      await client.getBooks();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors', async () => {
      mockFetch({}, 500);

      await expect(client.getBooks()).rejects.toThrow('Failed to fetch books');
    });
  });

  describe('getDailyReview', () => {
    it('should fetch and parse daily review highlights', async () => {
      mockFetch(MOCK_DAILY_REVIEW_RESPONSE);

      const highlights = await client.getDailyReview();

      expect(highlights).toHaveLength(1);
      expect(highlights[0].id).toBe(3);
      expect(highlights[0].text).toBe('Code is read more often than it is written.');
      expect(highlights[0].bookTitle).toBe('Clean Code');
      expect(highlights[0].bookAuthor).toBe('Robert Martin');
      expect(highlights[0].note).toBe('Important reminder');
      expect(highlights[0].location).toBe(10);
      expect(highlights[0].url).toBe('https://example.com/cleancode');
      expect(highlights[0].tags).toEqual(['programming']);
    });

    it('should use cached results within TTL', async () => {
      mockFetch(MOCK_DAILY_REVIEW_RESPONSE);

      await client.getDailyReview();
      await client.getDailyReview();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should hit correct endpoint', async () => {
      mockFetch(MOCK_DAILY_REVIEW_RESPONSE);

      await client.getDailyReview();

      const fetchMock = vi.mocked(global.fetch);
      const callUrl = fetchMock.mock.calls[0][0] as string;
      expect(callUrl).toContain('/review/');
    });

    it('should handle API errors', async () => {
      mockFetch({}, 403);

      await expect(client.getDailyReview()).rejects.toThrow('Failed to fetch daily review');
    });
  });

  describe('createHighlight', () => {
    it('should create a new highlight', async () => {
      mockFetch(MOCK_CREATE_RESPONSE);

      const highlight = await client.createHighlight(
        'Test highlight text',
        'Test Book',
        'Test Author'
      );

      expect(highlight.id).toBe(999);
      expect(highlight.text).toBe('Test highlight text');
      expect(highlight.bookTitle).toBe('Test Book');
      expect(highlight.bookAuthor).toBe('Test Author');
      expect(highlight.tags).toEqual([]);
    });

    it('should default author to Unknown if not provided', async () => {
      mockFetch([
        {
          id: 999,
          text: 'Test text',
          title: 'Test Book',
          author: 'Unknown',
        },
      ]);

      await client.createHighlight('Test text', 'Test Book');

      const fetchMock = vi.mocked(global.fetch);
      const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(requestBody.highlights[0].author).toBe('Unknown');
    });

    it('should use POST method', async () => {
      mockFetch(MOCK_CREATE_RESPONSE);

      await client.createHighlight('Text', 'Title');

      const fetchMock = vi.mocked(global.fetch);
      expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
    });

    it('should include proper headers', async () => {
      mockFetch(MOCK_CREATE_RESPONSE);

      await client.createHighlight('Text', 'Title');

      const fetchMock = vi.mocked(global.fetch);
      const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Token test-api-key');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should handle API errors', async () => {
      mockFetch({}, 422);

      await expect(client.createHighlight('Test', 'Title')).rejects.toThrow('Failed to create highlight');
    });
  });

  describe('formatForBriefing', () => {
    it('should format highlights with all details', () => {
      const highlights: Highlight[] = [
        {
          id: 1,
          text: 'First highlight',
          note: 'My note',
          location: 10,
          bookTitle: 'Book One',
          bookAuthor: 'Author One',
          highlightedAt: '2026-02-15T10:00:00Z',
          tags: ['tag1', 'tag2'],
        },
      ];

      const formatted = client.formatForBriefing(highlights);

      expect(formatted).toContain('"First highlight"');
      expect(formatted).toContain('Book One by Author One');
      expect(formatted).toContain('Note: My note');
      expect(formatted).toContain('Tags: tag1, tag2');
    });

    it('should limit to specified number of highlights', () => {
      const highlights: Highlight[] = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        text: `Highlight ${i}`,
        bookTitle: 'Book',
        bookAuthor: 'Author',
        highlightedAt: '2026-02-15T10:00:00Z',
        tags: [],
      }));

      const formatted = client.formatForBriefing(highlights, 3);

      const highlightCount = (formatted.match(/Highlight \d/g) ?? []).length;
      expect(highlightCount).toBe(3);
      expect(formatted).toContain('... and 7 more highlights');
    });

    it('should default to 5 highlights', () => {
      const highlights: Highlight[] = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        text: `Highlight ${i}`,
        bookTitle: 'Book',
        bookAuthor: 'Author',
        highlightedAt: '2026-02-15T10:00:00Z',
        tags: [],
      }));

      const formatted = client.formatForBriefing(highlights);

      const highlightCount = (formatted.match(/Highlight \d/g) ?? []).length;
      expect(highlightCount).toBe(5);
      expect(formatted).toContain('... and 5 more highlights');
    });

    it('should handle highlights without notes or tags', () => {
      const highlights: Highlight[] = [
        {
          id: 1,
          text: 'Simple highlight',
          bookTitle: 'Book',
          bookAuthor: 'Author',
          highlightedAt: '2026-02-15T10:00:00Z',
          tags: [],
        },
      ];

      const formatted = client.formatForBriefing(highlights);

      expect(formatted).toContain('"Simple highlight"');
      expect(formatted).toContain('Book by Author');
      expect(formatted).not.toContain('Note:');
      expect(formatted).not.toContain('Tags:');
    });

    it('should handle empty highlight list', () => {
      const formatted = client.formatForBriefing([]);

      expect(formatted).toBe('');
    });
  });
});
