import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import {
  CollectionEntrySchema,
  PriceAlertSchema,
  CollectionSnapshotSchema,
} from './types.js';
import type {
  CollectionEntry,
  PriceAlert,
  CollectionSnapshot,
  PokemonCard,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTION MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

interface CollectionData {
  entries: CollectionEntry[];
  alerts: PriceAlert[];
  snapshots: CollectionSnapshot[];
}

/**
 * Manages Pokemon TCG collection tracking, price alerts, and snapshots.
 */
export class CollectionManager {
  private data: CollectionData = { entries: [], alerts: [], snapshots: [] };
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'collection.json');
    this.load();
  }

  // ── Collection Entries ─────────────────────────────────────────────

  getEntries(): CollectionEntry[] {
    return [...this.data.entries];
  }

  addEntry(card: PokemonCard, quantity: number = 1, costBasis: number = 0): CollectionEntry {
    const existing = this.data.entries.find(e => e.cardId === card.id);
    if (existing) {
      existing.quantity += quantity;
      existing.costBasis += costBasis;
      this.save();
      return existing;
    }

    const entry = CollectionEntrySchema.parse({
      cardId: card.id,
      name: card.name,
      setName: card.set.name,
      rarity: card.rarity,
      quantity,
      costBasis,
      addedAt: new Date().toISOString(),
    });

    this.data.entries.push(entry);
    this.save();
    return entry;
  }

  removeEntry(cardId: string): boolean {
    const idx = this.data.entries.findIndex(e => e.cardId === cardId);
    if (idx === -1) return false;
    this.data.entries.splice(idx, 1);
    this.save();
    return true;
  }

  // ── Market Value ───────────────────────────────────────────────────

  static getCardMarketPrice(card: PokemonCard): number {
    // Try TCGPlayer market price first
    if (card.tcgplayer?.prices) {
      for (const variant of Object.values(card.tcgplayer.prices)) {
        if (variant.market && variant.market > 0) return variant.market;
        if (variant.mid && variant.mid > 0) return variant.mid;
      }
    }

    // Fallback to Cardmarket
    if (card.cardmarket?.prices) {
      if (card.cardmarket.prices.averageSellPrice && card.cardmarket.prices.averageSellPrice > 0) {
        return card.cardmarket.prices.averageSellPrice;
      }
      if (card.cardmarket.prices.trendPrice && card.cardmarket.prices.trendPrice > 0) {
        return card.cardmarket.prices.trendPrice;
      }
    }

    return 0;
  }

  calculateCollectionValue(
    cardPrices: Map<string, number>,
  ): {
    totalValue: number;
    totalCost: number;
    entries: Array<{
      cardId: string;
      name: string;
      quantity: number;
      marketPrice: number;
      value: number;
    }>;
  } {
    let totalValue = 0;
    let totalCost = 0;

    const entries = this.data.entries.map(e => {
      const marketPrice = cardPrices.get(e.cardId) ?? 0;
      const value = e.quantity * marketPrice;
      totalValue += value;
      totalCost += e.costBasis;

      return {
        cardId: e.cardId,
        name: e.name,
        quantity: e.quantity,
        marketPrice,
        value,
      };
    });

    return { totalValue, totalCost, entries };
  }

  // ── Alerts ─────────────────────────────────────────────────────────

  getAlerts(): PriceAlert[] {
    return this.data.alerts.filter(a => !a.triggered);
  }

  getAllAlerts(): PriceAlert[] {
    return [...this.data.alerts];
  }

  addAlert(cardId: string, cardName: string, type: 'above' | 'below', threshold: number): PriceAlert {
    const alert = PriceAlertSchema.parse({
      id: uuidv4().slice(0, 8),
      cardId,
      cardName,
      type,
      threshold,
      createdAt: new Date().toISOString(),
      triggered: false,
    });

    this.data.alerts.push(alert);
    this.save();
    return alert;
  }

  checkAlerts(cardPrices: Map<string, number>): PriceAlert[] {
    const triggered: PriceAlert[] = [];

    for (const alert of this.data.alerts) {
      if (alert.triggered) continue;

      const price = cardPrices.get(alert.cardId);
      if (price === undefined) continue;

      const shouldTrigger =
        (alert.type === 'above' && price >= alert.threshold) ||
        (alert.type === 'below' && price <= alert.threshold);

      if (shouldTrigger) {
        alert.triggered = true;
        triggered.push(alert);
      }
    }

    if (triggered.length > 0) this.save();
    return triggered;
  }

  // ── Snapshots ──────────────────────────────────────────────────────

  saveSnapshot(cardPrices: Map<string, number>): CollectionSnapshot {
    const snapshotEntries = this.data.entries.map(e => {
      const marketPrice = cardPrices.get(e.cardId) ?? 0;
      return {
        cardId: e.cardId,
        name: e.name,
        quantity: e.quantity,
        marketPrice,
        value: e.quantity * marketPrice,
      };
    });

    const snapshot = CollectionSnapshotSchema.parse({
      timestamp: new Date().toISOString(),
      totalValue: snapshotEntries.reduce((sum, e) => sum + e.value, 0),
      totalCards: snapshotEntries.reduce((sum, e) => sum + e.quantity, 0),
      entries: snapshotEntries,
    });

    this.data.snapshots.push(snapshot);
    if (this.data.snapshots.length > 52) {
      this.data.snapshots = this.data.snapshots.slice(-52);
    }

    this.save();
    return snapshot;
  }

  getSnapshots(): CollectionSnapshot[] {
    return [...this.data.snapshots];
  }

  // ── Persistence ────────────────────────────────────────────────────

  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw) as CollectionData;
        this.data = {
          entries: (parsed.entries ?? []).map(e => CollectionEntrySchema.parse(e)),
          alerts: (parsed.alerts ?? []).map(a => PriceAlertSchema.parse(a)),
          snapshots: (parsed.snapshots ?? []).map(s => CollectionSnapshotSchema.parse(s)),
        };
      }
    } catch {
      this.data = { entries: [], alerts: [], snapshots: [] };
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }
}
