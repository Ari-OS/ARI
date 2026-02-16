import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnkiClient } from '../../../../src/integrations/anki/client.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AnkiClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should use default loopback URL', () => {
      const client = new AnkiClient();
      expect(client).toBeDefined();
    });

    it('should accept custom loopback URL', () => {
      const client = new AnkiClient('http://127.0.0.1:9999');
      expect(client).toBeDefined();
    });

    it('should reject non-loopback URLs for security', () => {
      expect(() => new AnkiClient('http://0.0.0.0:8765')).toThrow('loopback');
      expect(() => new AnkiClient('http://192.168.1.1:8765')).toThrow('loopback');
      expect(() => new AnkiClient('https://example.com:8765')).toThrow('loopback');
    });
  });

  describe('isAvailable', () => {
    it('should return true when Anki Connect is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 6, error: null }),
      });

      const client = new AnkiClient();
      const available = await client.isAvailable();

      expect(available).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8765',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"version"'),
        })
      );
    });

    it('should return false when Anki Connect is not available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const client = new AnkiClient();
      const available = await client.isAvailable();

      expect(available).toBe(false);
    });

    it('should return false when version is too old', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 5, error: null }),
      });

      const client = new AnkiClient();
      const available = await client.isAvailable();

      expect(available).toBe(false);
    });
  });

  describe('createCard', () => {
    it('should create a card successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 12345, error: null }),
      });

      const client = new AnkiClient();
      const noteId = await client.createCard('Front', 'Back', 'TestDeck', ['tag1']);

      expect(noteId).toBe(12345);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8765',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"addNote"'),
        })
      );
    });

    it('should throw when card creation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: null, error: null }),
      });

      const client = new AnkiClient();
      await expect(client.createCard('Front', 'Back', 'TestDeck')).rejects.toThrow('duplicate');
    });

    it('should throw when Anki Connect returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: null, error: 'deck not found' }),
      });

      const client = new AnkiClient();
      await expect(client.createCard('Front', 'Back', 'NonexistentDeck')).rejects.toThrow('deck not found');
    });
  });

  describe('createCards', () => {
    it('should create multiple cards successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [123, 456, 789], error: null }),
      });

      const client = new AnkiClient();
      const noteIds = await client.createCards([
        { front: 'Q1', back: 'A1', deck: 'Deck1' },
        { front: 'Q2', back: 'A2', deck: 'Deck2', tags: ['test'] },
        { front: 'Q3', back: 'A3', deck: 'Deck3' },
      ]);

      expect(noteIds).toEqual([123, 456, 789]);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8765',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"addNotes"'),
        })
      );
    });

    it('should filter out failed cards', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [123, null, 789], error: null }),
      });

      const client = new AnkiClient();
      const noteIds = await client.createCards([
        { front: 'Q1', back: 'A1', deck: 'Deck1' },
        { front: 'Q2', back: 'A2', deck: 'Deck2' },
        { front: 'Q3', back: 'A3', deck: 'Deck3' },
      ]);

      expect(noteIds).toEqual([123, 789]);
    });

    it('should throw when batch operation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: null, error: null }),
      });

      const client = new AnkiClient();
      await expect(client.createCards([
        { front: 'Q1', back: 'A1', deck: 'Deck1' },
      ])).rejects.toThrow('batch operation failed');
    });
  });

  describe('getDueCards', () => {
    it('should get due cards successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: [1, 2, 3], error: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: [
              {
                noteId: 1,
                fields: { Front: { value: 'Q1' }, Back: { value: 'A1' } },
                tags: ['tag1'],
                deckName: 'Deck1',
                interval: 7,
                due: 12345,
              },
              {
                noteId: 2,
                fields: { Front: { value: 'Q2' }, Back: { value: 'A2' } },
                tags: [],
                deckName: 'Deck2',
                interval: 14,
                due: 12346,
              },
            ],
            error: null,
          }),
        });

      const client = new AnkiClient();
      const cards = await client.getDueCards();

      expect(cards).toHaveLength(2);
      expect(cards[0]).toEqual({
        noteId: 1,
        front: 'Q1',
        back: 'A1',
        deck: 'Deck1',
        tags: ['tag1'],
        interval: 7,
        due: 12345,
      });
    });

    it('should filter by deck when specified', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: [1], error: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: [
              {
                noteId: 1,
                fields: { Front: { value: 'Q1' }, Back: { value: 'A1' } },
                tags: [],
                deckName: 'SpecificDeck',
                interval: 7,
                due: 12345,
              },
            ],
            error: null,
          }),
        });

      const client = new AnkiClient();
      const cards = await client.getDueCards('SpecificDeck');

      expect(cards).toHaveLength(1);
      expect(cards[0].deck).toBe('SpecificDeck');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8765',
        expect.objectContaining({
          body: expect.stringContaining('deck:\\"SpecificDeck\\" is:due'),
        })
      );
    });

    it('should return empty array when no cards are due', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [], error: null }),
      });

      const client = new AnkiClient();
      const cards = await client.getDueCards();

      expect(cards).toEqual([]);
    });
  });

  describe('getDecks', () => {
    it('should get decks with statistics', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: ['Deck1', 'Deck2'], error: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: [
              {
                deck_id: 1,
                name: 'Deck1',
                new_count: 10,
                learn_count: 5,
                review_count: 20,
                total_in_deck: 100,
              },
              {
                deck_id: 2,
                name: 'Deck2',
                new_count: 5,
                learn_count: 2,
                review_count: 10,
                total_in_deck: 50,
              },
            ],
            error: null,
          }),
        });

      const client = new AnkiClient();
      const decks = await client.getDecks();

      expect(decks).toHaveLength(2);
      expect(decks[0]).toEqual({
        name: 'Deck1',
        cardCount: 100,
        newCount: 10,
        reviewCount: 20,
        learningCount: 5,
      });
    });

    it('should cache decks for 5 minutes', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: ['Deck1'], error: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: [
              {
                deck_id: 1,
                name: 'Deck1',
                new_count: 10,
                learn_count: 5,
                review_count: 20,
                total_in_deck: 100,
              },
            ],
            error: null,
          }),
        });

      const client = new AnkiClient();
      const decks1 = await client.getDecks();
      const decks2 = await client.getDecks();

      expect(decks1).toEqual(decks2);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Only first call fetches
    });
  });

  describe('getStats', () => {
    it('should calculate collection statistics', async () => {
      // Mock sequence: deckNames, findCards (all), findCards (today), findCards (mature), getNumCardsReviewedToday, cardsInfo
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: ['Deck1', 'Deck2'], error: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: [1, 2, 3, 4, 5], error: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: [1, 2], error: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: [3, 4], error: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: 15, error: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: [
              {
                noteId: 1,
                fields: { Front: { value: 'Q1' }, Back: { value: 'A1' } },
                tags: [],
                deckName: 'Deck1',
                interval: 10,
                due: 12345,
              },
              {
                noteId: 2,
                fields: { Front: { value: 'Q2' }, Back: { value: 'A2' } },
                tags: [],
                deckName: 'Deck1',
                interval: 20,
                due: 12346,
              },
            ],
            error: null,
          }),
        });

      const client = new AnkiClient();
      const stats = await client.getStats();

      expect(stats).toEqual({
        totalCards: 5,
        totalDecks: 2,
        cardsStudiedToday: 2,
        timeStudiedToday: 0,
        reviewsToday: 15,
        averageInterval: 15,
        matureCards: 2,
      });
    });

    it('should cache stats for 5 minutes', async () => {
      mockFetch
        .mockResolvedValue({
          ok: true,
          json: async () => ({ result: [], error: null }),
        });

      const client = new AnkiClient();
      const stats1 = await client.getStats();
      const stats2 = await client.getStats();

      expect(stats1).toEqual(stats2);
      // Should only fetch once due to caching
      expect(mockFetch.mock.calls.length).toBeLessThan(12); // Would be 6 calls x 2 without cache
    });
  });

  describe('createDeck', () => {
    it('should create a deck successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 98765, error: null }),
      });

      const client = new AnkiClient();
      const deckId = await client.createDeck('NewDeck');

      expect(deckId).toBe(98765);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8765',
        expect.objectContaining({
          body: expect.stringContaining('"action":"createDeck"'),
        })
      );
    });

    it('should throw when deck creation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: null, error: null }),
      });

      const client = new AnkiClient();
      await expect(client.createDeck('NewDeck')).rejects.toThrow('Failed to create deck');
    });
  });

  describe('formatForBriefing', () => {
    it('should format stats and due cards for display', () => {
      const stats = {
        totalCards: 500,
        totalDecks: 5,
        cardsStudiedToday: 25,
        timeStudiedToday: 1200,
        reviewsToday: 30,
        averageInterval: 14,
        matureCards: 250,
      };

      const dueCards = [
        {
          noteId: 1,
          front: 'Question 1',
          back: 'Answer 1',
          deck: 'Deck A',
          tags: [],
          interval: 7,
          due: 12345,
        },
        {
          noteId: 2,
          front: 'Question 2',
          back: 'Answer 2',
          deck: 'Deck A',
          tags: [],
          interval: 14,
          due: 12346,
        },
        {
          noteId: 3,
          front: 'This is a very long question that should be truncated for display',
          back: 'Answer 3',
          deck: 'Deck B',
          tags: [],
          interval: 21,
          due: 12347,
        },
      ];

      const client = new AnkiClient();
      const briefing = client.formatForBriefing(stats, dueCards);

      expect(briefing).toContain('500 total cards');
      expect(briefing).toContain('5 decks');
      expect(briefing).toContain('25 cards studied today');
      expect(briefing).toContain('30 reviews');
      expect(briefing).toContain('250 mature cards');
      expect(briefing).toContain('14 days');
      expect(briefing).toContain('3 cards due');
      expect(briefing).toContain('Deck A: 2 cards');
      expect(briefing).toContain('Deck B: 1 cards');
      expect(briefing).toContain('Question 1');
      expect(briefing).toContain('This is a very long question that should...');
    });

    it('should show celebration when no cards are due', () => {
      const stats = {
        totalCards: 100,
        totalDecks: 2,
        cardsStudiedToday: 10,
        timeStudiedToday: 600,
        reviewsToday: 12,
        averageInterval: 10,
        matureCards: 50,
      };

      const client = new AnkiClient();
      const briefing = client.formatForBriefing(stats, []);

      expect(briefing).toContain('No cards due for review!');
    });
  });

  describe('error handling', () => {
    it('should throw meaningful error when Anki is not running', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed: ECONNREFUSED'));

      const client = new AnkiClient();
      await expect(client.isAvailable()).resolves.toBe(false);
    });

    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const client = new AnkiClient();
      await expect(client.createCard('Q', 'A', 'Deck')).rejects.toThrow('HTTP 500');
    });

    it('should handle Anki Connect errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: null, error: 'Invalid deck name' }),
      });

      const client = new AnkiClient();
      await expect(client.createCard('Q', 'A', 'Bad::Deck')).rejects.toThrow('Invalid deck name');
    });
  });
});
