// Base client
export { XClient } from './client.js';
export type { XClientConfig, XTweet, XFetchResult, XPostResult, XThreadResult } from './client.js';

// Credit system (pay-per-use)
export { XCreditClient, createXCreditClient } from './x-credit-client.js';
export { XDedupCache } from './x-dedup-cache.js';
export { XCostTracker } from './x-cost-tracker.js';
export {
  X_API_PRICING,
  DEFAULT_X_CREDIT_CONFIG,
  type XCreditConfig,
  type XOperation,
  type XOperationType,
  type XSpendingSummary,
  type XDailyUsage,
  type XCostEntry,
  type ProceedDecision,
  type DedupCacheStats,
} from './x-types.js';
