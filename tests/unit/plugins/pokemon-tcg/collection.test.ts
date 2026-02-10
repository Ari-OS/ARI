import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CollectionManager } from '../../../../src/plugins/pokemon-tcg/collection.js';
import type { PokemonCard } from '../../../../src/plugins/pokemon-tcg/types.js';

const mockCard = (id: string, name: string): PokemonCard => ({
  id,
  name,
  supertype: 'Pokémon',
  set: { id: 'base1', name: 'Base', series: 'Base', releaseDate: '1999/01/09' },
  number: '4',
  images: { small: '', large: '' },
  tcgplayer: {
    url: '',
    updatedAt: '',
    prices: {
      holofoil: { low: 50, mid: 75, high: 100, market: 80 },
    },
  },
});

describe('CollectionManager', () => {
  let tempDir: string;
  let collection: CollectionManager;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ari-pokemon-test-'));
    collection = new CollectionManager(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('entries', () => {
    it('should add a card to collection', () => {
      const entry = collection.addEntry(mockCard('base1-4', 'Charizard'), 2, 100);
      expect(entry.cardId).toBe('base1-4');
      expect(entry.name).toBe('Charizard');
      expect(entry.quantity).toBe(2);
      expect(entry.costBasis).toBe(100);
    });

    it('should accumulate quantity for existing card', () => {
      collection.addEntry(mockCard('base1-4', 'Charizard'), 1, 50);
      const entry = collection.addEntry(mockCard('base1-4', 'Charizard'), 2, 100);
      expect(entry.quantity).toBe(3);
      expect(entry.costBasis).toBe(150);
    });

    it('should list all entries', () => {
      collection.addEntry(mockCard('base1-4', 'Charizard'));
      collection.addEntry(mockCard('base1-58', 'Pikachu'));
      expect(collection.getEntries()).toHaveLength(2);
    });

    it('should remove an entry', () => {
      collection.addEntry(mockCard('base1-4', 'Charizard'));
      expect(collection.removeEntry('base1-4')).toBe(true);
      expect(collection.getEntries()).toHaveLength(0);
    });

    it('should return false for non-existent removal', () => {
      expect(collection.removeEntry('nonexistent')).toBe(false);
    });

    it('should persist across instances', () => {
      collection.addEntry(mockCard('base1-4', 'Charizard'));
      const reloaded = new CollectionManager(tempDir);
      expect(reloaded.getEntries()).toHaveLength(1);
    });
  });

  describe('getCardMarketPrice', () => {
    it('should get TCGPlayer market price', () => {
      const card = mockCard('base1-4', 'Charizard');
      expect(CollectionManager.getCardMarketPrice(card)).toBe(80);
    });

    it('should fallback to mid price', () => {
      const card = mockCard('base1-4', 'Charizard');
      card.tcgplayer!.prices = { holofoil: { low: 50, mid: 75, high: 100 } };
      expect(CollectionManager.getCardMarketPrice(card)).toBe(75);
    });

    it('should fallback to cardmarket', () => {
      const card: PokemonCard = {
        ...mockCard('test', 'Test'),
        tcgplayer: undefined,
        cardmarket: { url: '', updatedAt: '', prices: { averageSellPrice: 60, trendPrice: 55 } },
      };
      expect(CollectionManager.getCardMarketPrice(card)).toBe(60);
    });

    it('should return 0 when no prices available', () => {
      const card: PokemonCard = {
        ...mockCard('test', 'Test'),
        tcgplayer: undefined,
        cardmarket: undefined,
      };
      expect(CollectionManager.getCardMarketPrice(card)).toBe(0);
    });
  });

  describe('calculateCollectionValue', () => {
    it('should calculate total value', () => {
      collection.addEntry(mockCard('base1-4', 'Charizard'), 2, 100);
      const prices = new Map([['base1-4', 80]]);
      const result = collection.calculateCollectionValue(prices);
      expect(result.totalValue).toBe(160);
      expect(result.totalCost).toBe(100);
    });
  });

  describe('alerts', () => {
    it('should add and check alerts', () => {
      const alert = collection.addAlert('base1-4', 'Charizard', 'above', 100);
      expect(alert.cardId).toBe('base1-4');

      const prices = new Map([['base1-4', 120]]);
      const triggered = collection.checkAlerts(prices);
      expect(triggered).toHaveLength(1);
    });

    it('should not re-trigger alerts', () => {
      collection.addAlert('base1-4', 'Charizard', 'above', 100);
      const prices = new Map([['base1-4', 120]]);
      collection.checkAlerts(prices);
      expect(collection.checkAlerts(prices)).toHaveLength(0);
    });

    it('should filter active alerts', () => {
      collection.addAlert('base1-4', 'Charizard', 'above', 100);
      collection.addAlert('base1-58', 'Pikachu', 'below', 5);
      const prices = new Map([['base1-4', 120]]);
      collection.checkAlerts(prices);
      expect(collection.getAlerts()).toHaveLength(1); // Pikachu still active
      expect(collection.getAllAlerts()).toHaveLength(2);
    });
  });

  describe('snapshots', () => {
    it('should save and retrieve snapshots', () => {
      collection.addEntry(mockCard('base1-4', 'Charizard'), 1, 50);
      const prices = new Map([['base1-4', 80]]);
      const snapshot = collection.saveSnapshot(prices);
      expect(snapshot.totalValue).toBe(80);
      expect(snapshot.totalCards).toBe(1);
      expect(collection.getSnapshots()).toHaveLength(1);
    });

    it('should limit to 52 snapshots', () => {
      collection.addEntry(mockCard('base1-4', 'Charizard'));
      const prices = new Map([['base1-4', 80]]);
      for (let i = 0; i < 55; i++) {
        collection.saveSnapshot(prices);
      }
      expect(collection.getSnapshots()).toHaveLength(52);
    });
  });
});
