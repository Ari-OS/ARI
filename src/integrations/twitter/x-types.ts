/**
 * X API Credit System Types
 *
 * Types for pay-per-use pricing model with:
 * - Per-endpoint cost tracking
 * - UTC-day deduplication
 * - Spending limits and priorities
 * - xAI credit bonus tracking
 */

// ─── Pricing Constants (as of Feb 2026) ───────────────────────────────────────

export const X_API_PRICING = {
  // Read operations
  POST_READ: 0.005,        // Per post fetched
  USER_READ: 0.010,        // Per user lookup
  DM_EVENT_READ: 0.010,    // Per DM event
  LIST_READ: 0.005,        // Per list resource
  TREND_READ: 0.010,       // Per trend fetched
  ANALYTICS_READ: 0.005,   // Per analytics resource

  // Write operations
  CONTENT_CREATE: 0.010,   // Per post/media created
  DM_CREATE: 0.015,        // Per DM sent
  USER_INTERACTION: 0.015, // Like, retweet, follow
  INTERACTION_DELETE: 0.010,
  CONTENT_MANAGE: 0.005,   // Delete/hide posts
  LIST_CREATE: 0.010,
  LIST_MANAGE: 0.005,
  BOOKMARK: 0.005,
} as const;

// ─── Configuration ────────────────────────────────────────────────────────────

export interface XCreditConfig {
  /** Daily spending limit in USD */
  dailySpendingLimit: number;

  /** Alert when credit balance falls below this (USD) */
  autoRechargeThreshold: number;

  /** Operation priorities (1=skip first when budget tight, 5=always execute) */
  operationPriorities: {
    post_read: number;
    user_read: number;
    search: number;
    create_post: number;
    create_thread: number;
    like: number;
    retweet: number;
    bookmark: number;
  };

  /** xAI credit bonus configuration */
  xaiCreditBonus: {
    enabled: boolean;
    /** Estimated rate based on spend tier (0.10-0.20) */
    estimatedRate: number;
  };

  /** Alert thresholds (percentage of daily limit) */
  alerts: {
    warning: number;  // e.g., 0.75
    critical: number; // e.g., 0.90
  };
}

export const DEFAULT_X_CREDIT_CONFIG: XCreditConfig = {
  dailySpendingLimit: 5.00,
  autoRechargeThreshold: 10.00,
  operationPriorities: {
    post_read: 2,
    user_read: 3,
    search: 3,
    create_post: 4,
    create_thread: 5,
    like: 2,
    retweet: 2,
    bookmark: 1,
  },
  xaiCreditBonus: {
    enabled: true,
    estimatedRate: 0.15, // 15% back at $200-500 tier
  },
  alerts: {
    warning: 0.75,
    critical: 0.90,
  },
};

// ─── Operation Types ──────────────────────────────────────────────────────────

export type XOperationType =
  | 'post_read'
  | 'user_read'
  | 'search'
  | 'create_post'
  | 'create_thread'
  | 'like'
  | 'retweet'
  | 'bookmark'
  | 'dm_read'
  | 'dm_send';

export interface XOperation {
  type: XOperationType;
  /** Estimated cost in USD */
  cost: number;
  /** Priority 1-5 (1=skip first, 5=always execute) */
  priority: number;
  /** Additional context */
  metadata?: Record<string, unknown>;
}

// ─── Cost Tracking ────────────────────────────────────────────────────────────

export interface XCostEntry {
  operation: XOperationType;
  endpoint: string;
  requestCount: number;
  itemsRead: number;
  itemsWritten: number;
  cost: number;
  deduplicated: number;
  timestamp: Date;
}

export interface XDailyUsage {
  date: string; // YYYY-MM-DD in UTC
  totalCost: number;
  totalRequests: number;
  totalItemsRead: number;
  totalItemsWritten: number;
  totalDeduplicated: number;
  byOperation: Record<XOperationType, {
    requests: number;
    items: number;
    cost: number;
    deduplicated: number;
  }>;
  entries: XCostEntry[];
}

// ─── Spending Summary ─────────────────────────────────────────────────────────

export interface XSpendingSummary {
  dailySpent: number;
  dailyLimit: number;
  percentUsed: number;
  remaining: number;
  xaiCreditsEarned: number;
  byOperation: Record<string, { requests: number; items: number; cost: number }>;
  approachingLimit: boolean;
  alertLevel: 'normal' | 'warning' | 'critical';
}

// ─── Proceed Decision ─────────────────────────────────────────────────────────

export interface ProceedDecision {
  allowed: boolean;
  reason?: string;
  suggestedDelay?: number; // ms to wait before retry
}

// ─── Dedup Cache Stats ────────────────────────────────────────────────────────

export interface DedupCacheStats {
  date: string;
  cachedPostIds: number;
  cachedSearchQueries: number;
  savingsEstimate: number; // USD saved by deduplication
}
