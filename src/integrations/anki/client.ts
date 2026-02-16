/**
 * Anki Connect Integration
 *
 * Provides spaced repetition flashcard management via Anki Connect API
 * Requires Anki Connect plugin: https://ankiweb.net/shared/info/2055492159
 *
 * Usage:
 *   const anki = new AnkiClient();
 *   const cardId = await anki.createCard('What is ARI?', 'Artificial Reasoning Intelligence', 'ARI');
 *   const stats = await anki.getStats();
 */

import { createLogger } from '../../kernel/logger.js';

const log = createLogger('anki-client');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AnkiCard {
  noteId: number;
  front: string;
  back: string;
  deck: string;
  tags: string[];
  interval: number;
  due: number;
}

export interface AnkiDeck {
  name: string;
  cardCount: number;
  newCount: number;
  reviewCount: number;
  learningCount: number;
}

export interface AnkiStats {
  totalCards: number;
  totalDecks: number;
  cardsStudiedToday: number;
  timeStudiedToday: number; // seconds
  reviewsToday: number;
  averageInterval: number; // days
  matureCards: number;
}

interface AnkiRequest {
  action: string;
  version: number;
  params?: Record<string, unknown>;
}

interface AnkiResponse<T> {
  result: T | null;
  error: string | null;
}

interface CardInfo {
  noteId: number;
  fields: {
    Front: { value: string };
    Back: { value: string };
  };
  tags: string[];
  deckName: string;
  interval: number;
  due: number;
}

interface DeckStats {
  deck_id: number;
  name: string;
  new_count: number;
  learn_count: number;
  review_count: number;
  total_in_deck: number;
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

// ─── Anki Client ────────────────────────────────────────────────────────────

export class AnkiClient {
  private baseUrl: string;
  private cacheTtlMs = 5 * 60 * 1000; // 5 minutes
  private statsCache: CacheEntry<AnkiStats> | null = null;
  private decksCache: CacheEntry<AnkiDeck[]> | null = null;

  constructor(baseUrl: string = 'http://127.0.0.1:8765') {
    // SECURITY: Enforce loopback-only connection
    if (!baseUrl.startsWith('http://127.0.0.1') && !baseUrl.startsWith('http://localhost')) {
      throw new Error('Anki Connect must use loopback address (127.0.0.1 or localhost)');
    }
    this.baseUrl = baseUrl;
  }

  /**
   * Check if Anki Connect is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.invoke<number>('version', {});
      return response !== null && response >= 6;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.debug(`Anki Connect not available: ${message}`);
      return false;
    }
  }

  /**
   * Create a single flashcard
   */
  async createCard(
    front: string,
    back: string,
    deck: string,
    tags: string[] = []
  ): Promise<number> {
    try {
      const noteId = await this.invoke<number>('addNote', {
        note: {
          deckName: deck,
          modelName: 'Basic',
          fields: {
            Front: front,
            Back: back,
          },
          tags,
          options: {
            allowDuplicate: false,
          },
        },
      });

      if (noteId === null) {
        throw new Error('Failed to create card (duplicate or invalid deck)');
      }

      log.info(`Created card in deck "${deck}": "${front.substring(0, 50)}..."`);
      return noteId;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to create card: ${message}`);
      throw new Error(`Failed to create card: ${message}`);
    }
  }

  /**
   * Create multiple flashcards in batch
   */
  async createCards(
    cards: Array<{ front: string; back: string; deck: string; tags?: string[] }>
  ): Promise<number[]> {
    try {
      const notes = cards.map(card => ({
        deckName: card.deck,
        modelName: 'Basic',
        fields: {
          Front: card.front,
          Back: card.back,
        },
        tags: card.tags ?? [],
        options: {
          allowDuplicate: false,
        },
      }));

      const noteIds = await this.invoke<number[]>('addNotes', { notes });

      if (noteIds === null) {
        throw new Error('Failed to create cards (batch operation failed)');
      }

      const successCount = noteIds.filter(id => id !== null).length;
      log.info(`Created ${successCount}/${cards.length} cards`);
      return noteIds.filter((id): id is number => id !== null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to create cards: ${message}`);
      throw new Error(`Failed to create cards: ${message}`);
    }
  }

  /**
   * Get cards that are due for review
   */
  async getDueCards(deck?: string): Promise<AnkiCard[]> {
    try {
      const query = deck ? `deck:"${deck}" is:due` : 'is:due';
      const cardIds = await this.invoke<number[]>('findCards', { query });

      if (cardIds === null || cardIds.length === 0) {
        log.debug('No due cards found');
        return [];
      }

      const cardsInfo = await this.invoke<CardInfo[]>('cardsInfo', {
        cards: cardIds.slice(0, 100), // Limit to 100 for performance
      });

      if (cardsInfo === null) {
        throw new Error('Failed to get card information');
      }

      const cards: AnkiCard[] = cardsInfo.map(info => ({
        noteId: info.noteId,
        front: info.fields.Front.value,
        back: info.fields.Back.value,
        deck: info.deckName,
        tags: info.tags,
        interval: info.interval,
        due: info.due,
      }));

      log.info(`Found ${cards.length} due cards${deck ? ` in deck "${deck}"` : ''}`);
      return cards;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to get due cards: ${message}`);
      throw new Error(`Failed to get due cards: ${message}`);
    }
  }

  /**
   * Get all decks with statistics
   */
  async getDecks(): Promise<AnkiDeck[]> {
    const cached = this.decksCache;

    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      log.debug('Using cached decks');
      return cached.data;
    }

    try {
      const deckStats = await this.invoke<DeckStats[]>('getDeckStats', {
        decks: await this.invoke<string[]>('deckNames', {}),
      });

      if (deckStats === null) {
        throw new Error('Failed to get deck statistics');
      }

      const decks: AnkiDeck[] = deckStats.map(stats => ({
        name: stats.name,
        cardCount: stats.total_in_deck,
        newCount: stats.new_count,
        reviewCount: stats.review_count,
        learningCount: stats.learn_count,
      }));

      this.decksCache = { data: decks, fetchedAt: Date.now() };
      log.info(`Fetched ${decks.length} decks`);
      return decks;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to get decks: ${message}`);
      throw new Error(`Failed to get decks: ${message}`);
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<AnkiStats> {
    const cached = this.statsCache;

    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      log.debug('Using cached stats');
      return cached.data;
    }

    try {
      // Get deck count
      const deckNames = await this.invoke<string[]>('deckNames', {});
      const totalDecks = deckNames?.length ?? 0;

      // Get total cards
      const allCardIds = await this.invoke<number[]>('findCards', { query: '' });
      const totalCards = allCardIds?.length ?? 0;

      // Get cards studied today
      const todayCardIds = await this.invoke<number[]>('findCards', {
        query: 'rated:1',
      });
      const cardsStudiedToday = todayCardIds?.length ?? 0;

      // Get mature cards (interval >= 21 days)
      const matureCardIds = await this.invoke<number[]>('findCards', {
        query: 'prop:ivl>=21',
      });
      const matureCards = matureCardIds?.length ?? 0;

      // Get reviews today count
      const reviewsToday = await this.invoke<number>('getNumCardsReviewedToday', {});

      // Calculate average interval from sample
      let averageInterval = 0;
      if (allCardIds && allCardIds.length > 0) {
        const sampleSize = Math.min(100, allCardIds.length);
        const sampleIds = allCardIds.slice(0, sampleSize);
        const cardsInfo = await this.invoke<CardInfo[]>('cardsInfo', {
          cards: sampleIds,
        });

        if (cardsInfo && cardsInfo.length > 0) {
          const totalInterval = cardsInfo.reduce((sum, card) => sum + card.interval, 0);
          averageInterval = Math.round(totalInterval / cardsInfo.length);
        }
      }

      const stats: AnkiStats = {
        totalCards,
        totalDecks,
        cardsStudiedToday,
        timeStudiedToday: 0, // Anki Connect doesn't expose this easily
        reviewsToday: reviewsToday ?? 0,
        averageInterval,
        matureCards,
      };

      this.statsCache = { data: stats, fetchedAt: Date.now() };
      log.info(`Fetched collection stats: ${totalCards} cards, ${totalDecks} decks`);
      return stats;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to get stats: ${message}`);
      throw new Error(`Failed to get stats: ${message}`);
    }
  }

  /**
   * Create a new deck
   */
  async createDeck(name: string): Promise<number> {
    try {
      const deckId = await this.invoke<number>('createDeck', { deck: name });

      if (deckId === null) {
        throw new Error(`Failed to create deck "${name}"`);
      }

      log.info(`Created deck "${name}"`);
      return deckId;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to create deck: ${message}`);
      throw new Error(`Failed to create deck: ${message}`);
    }
  }

  /**
   * Format statistics and due cards for briefing display
   */
  formatForBriefing(stats: AnkiStats, dueCards: AnkiCard[]): string {
    const lines: string[] = [];

    // Collection statistics
    lines.push('📚 Anki Statistics:');
    lines.push(`  📊 ${stats.totalCards} total cards across ${stats.totalDecks} decks`);
    lines.push(`  ✅ ${stats.cardsStudiedToday} cards studied today (${stats.reviewsToday} reviews)`);
    lines.push(`  🎯 ${stats.matureCards} mature cards (avg interval: ${stats.averageInterval} days)`);

    if (dueCards.length > 0) {
      lines.push('');
      lines.push(`📅 ${dueCards.length} cards due for review:`);

      // Group by deck
      const byDeck = new Map<string, AnkiCard[]>();
      for (const card of dueCards) {
        const cards = byDeck.get(card.deck) ?? [];
        cards.push(card);
        byDeck.set(card.deck, cards);
      }

      for (const [deck, cards] of byDeck) {
        lines.push(`  📖 ${deck}: ${cards.length} cards`);
        // Show first 2 cards from each deck
        for (const card of cards.slice(0, 2)) {
          const front = card.front.substring(0, 40);
          const truncated = card.front.length > 40 ? '...' : '';
          lines.push(`     • ${front}${truncated}`);
        }
        if (cards.length > 2) {
          lines.push(`     ... and ${cards.length - 2} more`);
        }
      }
    } else {
      lines.push('');
      lines.push('🎉 No cards due for review!');
    }

    return lines.join('\n');
  }

  /**
   * Internal method to invoke Anki Connect API
   */
  private async invoke<T>(action: string, params: Record<string, unknown>): Promise<T | null> {
    const request: AnkiRequest = {
      action,
      version: 6,
      params,
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as AnkiResponse<T>;

      if (data.error !== null) {
        throw new Error(`Anki Connect error: ${data.error}`);
      }

      return data.result;
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new Error('Anki Connect not running (is Anki open with AnkiConnect installed?)');
      }
      throw error;
    }
  }
}
