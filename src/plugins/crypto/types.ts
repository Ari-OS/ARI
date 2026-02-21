import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// CRYPTO PLUGIN TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const CryptoConfigSchema = z.object({
  apiKey: z.string().optional(),
  defaultCoins: z.array(z.string()).default(['bitcoin', 'ethereum', 'solana']),
  currency: z.string().default('usd'),
  priceCheckIntervalMinutes: z.number().default(240),
  snapshotHour: z.number().min(0).max(23).default(0),
});
export type CryptoConfig = z.infer<typeof CryptoConfigSchema>;

export const PortfolioHoldingSchema = z.object({
  coinId: z.string(),
  symbol: z.string(),
  amount: z.number().positive(),
  costBasis: z.number().nonnegative().default(0),
  addedAt: z.string(),
});
export type PortfolioHolding = z.infer<typeof PortfolioHoldingSchema>;

export const PriceAlertSchema = z.object({
  id: z.string(),
  coinId: z.string(),
  type: z.enum(['above', 'below']),
  threshold: z.number().positive(),
  createdAt: z.string(),
  triggered: z.boolean().default(false),
});
export type PriceAlert = z.infer<typeof PriceAlertSchema>;

export const PortfolioSnapshotSchema = z.object({
  timestamp: z.string(),
  totalValue: z.number(),
  holdings: z.array(z.object({
    coinId: z.string(),
    amount: z.number(),
    price: z.number(),
    value: z.number(),
  })),
});
export type PortfolioSnapshot = z.infer<typeof PortfolioSnapshotSchema>;

// ── CoinGecko API Response Types ─────────────────────────────────────

export interface CoinGeckoPrice {
  [coinId: string]: {
    usd: number;
    usd_24h_change?: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
  };
}

export interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_percentage_24h: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  image: string;
}

export interface CoinGeckoSearchResult {
  coins: Array<{
    id: string;
    name: string;
    symbol: string;
    market_cap_rank: number | null;
  }>;
}

export interface CoinGeckoGlobalData {
  btcDominance: number;
  ethDominance: number;
  totalMarketCapChangePercent: number;
  activeCurrencies: number;
}
