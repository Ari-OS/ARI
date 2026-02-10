import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// POKEMON TCG PLUGIN TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const PokemonTcgConfigSchema = z.object({
  apiKey: z.string().optional(),
  defaultSearchLimit: z.number().default(10),
  morningScanHour: z.number().min(0).max(23).default(8),
  eveningScanHour: z.number().min(0).max(23).default(18),
});
export type PokemonTcgConfig = z.infer<typeof PokemonTcgConfigSchema>;

export const CardPricesSchema = z.object({
  tcgplayer: z.object({
    url: z.string().optional(),
    updatedAt: z.string().optional(),
    prices: z.record(z.object({
      low: z.number().nullable().optional(),
      mid: z.number().nullable().optional(),
      high: z.number().nullable().optional(),
      market: z.number().nullable().optional(),
    })).optional(),
  }).optional(),
  cardmarket: z.object({
    url: z.string().optional(),
    updatedAt: z.string().optional(),
    prices: z.object({
      averageSellPrice: z.number().nullable().optional(),
      trendPrice: z.number().nullable().optional(),
    }).optional(),
  }).optional(),
});
export type CardPrices = z.infer<typeof CardPricesSchema>;

export const CollectionEntrySchema = z.object({
  cardId: z.string(),
  name: z.string(),
  setName: z.string(),
  rarity: z.string().optional(),
  quantity: z.number().positive().default(1),
  costBasis: z.number().nonnegative().default(0),
  addedAt: z.string(),
});
export type CollectionEntry = z.infer<typeof CollectionEntrySchema>;

export const PriceAlertSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  cardName: z.string(),
  type: z.enum(['above', 'below']),
  threshold: z.number().positive(),
  createdAt: z.string(),
  triggered: z.boolean().default(false),
});
export type PriceAlert = z.infer<typeof PriceAlertSchema>;

export const CollectionSnapshotSchema = z.object({
  timestamp: z.string(),
  totalValue: z.number(),
  totalCards: z.number(),
  entries: z.array(z.object({
    cardId: z.string(),
    name: z.string(),
    quantity: z.number(),
    marketPrice: z.number(),
    value: z.number(),
  })),
});
export type CollectionSnapshot = z.infer<typeof CollectionSnapshotSchema>;

// ── Pokemon TCG API Response Types ───────────────────────────────────

export interface PokemonCard {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  set: {
    id: string;
    name: string;
    series: string;
    releaseDate: string;
  };
  number: string;
  rarity?: string;
  images: {
    small: string;
    large: string;
  };
  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices?: Record<string, {
      low?: number | null;
      mid?: number | null;
      high?: number | null;
      market?: number | null;
    }>;
  };
  cardmarket?: {
    url: string;
    updatedAt: string;
    prices?: {
      averageSellPrice?: number | null;
      trendPrice?: number | null;
    };
  };
}

export interface PokemonTcgApiResponse {
  data: PokemonCard[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}
