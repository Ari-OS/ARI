/**
 * OpportunityScanner — Investment & Opportunity Detection Engine
 *
 * Scans across multiple investment categories, scores opportunities using
 * weighted factors, and generates ranked recommendations.
 *
 * Categories:
 * - crypto_investment    - Cryptocurrency market opportunities
 * - pokemon_investment   - Pokemon TCG market opportunities
 * - stock_investment     - Stock market opportunities
 * - etf_investment       - ETF investment opportunities
 * - real_estate_trend    - Real estate market trends
 * - saas_idea            - SaaS business opportunities
 * - freelance_gig        - Freelance work opportunities
 * - consulting_lead      - Consulting engagement leads
 * - content_opportunity  - Content creation opportunities
 * - career_opportunity   - Career advancement opportunities
 * - side_project         - Side project ideas
 * - arbitrage            - Arbitrage opportunities
 *
 * @module autonomous/opportunity-scanner
 * @version 1.0.0
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from '../kernel/logger.js';
import type { EventBus } from '../kernel/event-bus.js';

const log = createLogger('opportunity-scanner');

// =============================================================================
// TYPES
// =============================================================================

export type OpportunityCategory =
  | 'crypto_investment'
  | 'pokemon_investment'
  | 'stock_investment'
  | 'etf_investment'
  | 'real_estate_trend'
  | 'saas_idea'
  | 'freelance_gig'
  | 'consulting_lead'
  | 'content_opportunity'
  | 'career_opportunity'
  | 'side_project'
  | 'arbitrage';

export interface OpportunityScores {
  /** ROI potential (0-100, higher = better return potential) */
  roiPotential: number;
  /** Effort required (0-100, lower = easier) */
  effortRequired: number;
  /** Skill alignment (0-100, higher = better match) */
  skillAlignment: number;
  /** Time to revenue (0-100, higher = faster) */
  timeToRevenue: number;
  /** Risk level (0-100, lower = safer) */
  riskLevel: number;
  /** Confidence in the analysis (0-100) */
  confidenceLevel: number;
}

export type RecommendationType = 'strong_buy' | 'buy' | 'watch' | 'pass';
export type TimeframeType = 'immediate' | 'this_week' | 'this_month' | 'long_term';

export interface ScoredOpportunity {
  id: string;
  category: OpportunityCategory;
  title: string;
  description: string;
  source: string;
  sourceUrl?: string;
  scores: OpportunityScores;
  compositeScore: number;
  recommendation: RecommendationType;
  actionItems: string[];
  timeframe: TimeframeType;
  discoveredAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface OpportunityScannerConfig {
  /** Categories to scan */
  categories: OpportunityCategory[];
  /** Minimum composite score to track (0-100) */
  minScoreThreshold: number;
  /** Maximum opportunities to cache */
  maxCachedOpportunities: number;
  /** Score weights (must sum to 1.0) */
  weights: ScoringWeights;
}

export interface ScoringWeights {
  roiPotential: number;
  effortRequired: number;
  skillAlignment: number;
  timeToRevenue: number;
  riskLevel: number;
  confidenceLevel: number;
}

export interface RawOpportunity {
  category: OpportunityCategory;
  title: string;
  description: string;
  source: string;
  sourceUrl?: string;
  scores: OpportunityScores;
  actionItems: string[];
  timeframe: TimeframeType;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default scoring weights optimized for quick-revenue + low-risk profile */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  roiPotential: 0.25,
  effortRequired: 0.20,
  skillAlignment: 0.15,
  timeToRevenue: 0.20,
  riskLevel: 0.10,
  confidenceLevel: 0.10,
};

/** All opportunity categories */
export const ALL_CATEGORIES: OpportunityCategory[] = [
  'crypto_investment',
  'pokemon_investment',
  'stock_investment',
  'etf_investment',
  'real_estate_trend',
  'saas_idea',
  'freelance_gig',
  'consulting_lead',
  'content_opportunity',
  'career_opportunity',
  'side_project',
  'arbitrage',
];

/** Default configuration */
export const DEFAULT_CONFIG: OpportunityScannerConfig = {
  categories: ALL_CATEGORIES,
  minScoreThreshold: 30,
  maxCachedOpportunities: 100,
  weights: DEFAULT_WEIGHTS,
};

/** Score thresholds for recommendations */
const RECOMMENDATION_THRESHOLDS = {
  strong_buy: 80,
  buy: 60,
  watch: 40,
  pass: 0,
};

// =============================================================================
// SCANNER REGISTRY
// =============================================================================

export type CategoryScanner = (category: OpportunityCategory) => Promise<RawOpportunity[]>;

/**
 * Registry for category-specific scanners.
 * External code can register scanners for each category.
 */
const categoryScannersRegistry: Map<OpportunityCategory, CategoryScanner> = new Map();

/**
 * Register a scanner for a specific category.
 * Scanners are responsible for fetching raw opportunity data from external sources.
 */
export function registerCategoryScanner(
  category: OpportunityCategory,
  scanner: CategoryScanner
): void {
  categoryScannersRegistry.set(category, scanner);
  log.info({ category }, 'Registered category scanner');
}

/**
 * Unregister a scanner for a category.
 */
export function unregisterCategoryScanner(category: OpportunityCategory): boolean {
  const removed = categoryScannersRegistry.delete(category);
  if (removed) {
    log.info({ category }, 'Unregistered category scanner');
  }
  return removed;
}

/**
 * Get registered scanner for a category.
 */
export function getCategoryScanner(category: OpportunityCategory): CategoryScanner | undefined {
  return categoryScannersRegistry.get(category);
}

/**
 * List all registered category scanners.
 */
export function listRegisteredScanners(): OpportunityCategory[] {
  return Array.from(categoryScannersRegistry.keys());
}

// =============================================================================
// SCORING ENGINE
// =============================================================================

/**
 * Validate that weights sum to 1.0 (within tolerance).
 */
export function validateWeights(weights: ScoringWeights): boolean {
  const values = Object.values(weights) as number[];
  const sum = values.reduce((acc, w) => acc + w, 0);
  return Math.abs(sum - 1.0) < 0.001;
}

/**
 * Validate that all scores are in 0-100 range.
 */
export function validateScores(scores: OpportunityScores): boolean {
  return Object.values(scores).every(s => s >= 0 && s <= 100);
}

/**
 * Calculate composite score from individual scores using weights.
 *
 * Scoring formula:
 * - roiPotential: Higher is better (use as-is)
 * - effortRequired: Lower is better (invert: 100 - value)
 * - skillAlignment: Higher is better (use as-is)
 * - timeToRevenue: Higher is better (use as-is)
 * - riskLevel: Lower is better (invert: 100 - value)
 * - confidenceLevel: Higher is better (use as-is)
 */
export function calculateCompositeScore(
  scores: OpportunityScores,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  if (!validateScores(scores)) {
    throw new Error('Scores must be in 0-100 range');
  }

  if (!validateWeights(weights)) {
    throw new Error('Weights must sum to 1.0');
  }

  // Invert effort and risk so higher = better
  const normalizedScores = {
    roiPotential: scores.roiPotential,
    effortRequired: 100 - scores.effortRequired,
    skillAlignment: scores.skillAlignment,
    timeToRevenue: scores.timeToRevenue,
    riskLevel: 100 - scores.riskLevel,
    confidenceLevel: scores.confidenceLevel,
  };

  const composite =
    normalizedScores.roiPotential * weights.roiPotential +
    normalizedScores.effortRequired * weights.effortRequired +
    normalizedScores.skillAlignment * weights.skillAlignment +
    normalizedScores.timeToRevenue * weights.timeToRevenue +
    normalizedScores.riskLevel * weights.riskLevel +
    normalizedScores.confidenceLevel * weights.confidenceLevel;

  return Math.round(composite * 100) / 100;
}

/**
 * Determine recommendation based on composite score.
 */
export function determineRecommendation(compositeScore: number): RecommendationType {
  if (compositeScore >= RECOMMENDATION_THRESHOLDS.strong_buy) {
    return 'strong_buy';
  } else if (compositeScore >= RECOMMENDATION_THRESHOLDS.buy) {
    return 'buy';
  } else if (compositeScore >= RECOMMENDATION_THRESHOLDS.watch) {
    return 'watch';
  } else {
    return 'pass';
  }
}

// =============================================================================
// OPPORTUNITY SCANNER
// =============================================================================

/**
 * OpportunityScanner — Main opportunity detection engine.
 *
 * Responsibilities:
 * - Scan registered category scanners for raw opportunities
 * - Score opportunities using weighted scoring algorithm
 * - Cache and rank opportunities
 * - Emit events for detected opportunities
 */
export class OpportunityScanner {
  private config: OpportunityScannerConfig;
  private eventBus: EventBus;
  private opportunities: Map<string, ScoredOpportunity> = new Map();
  private lastScanAt: Date | null = null;
  private scanInProgress = false;

  constructor(eventBus: EventBus, config: Partial<OpportunityScannerConfig> = {}) {
    this.eventBus = eventBus;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      weights: { ...DEFAULT_WEIGHTS, ...config.weights },
    };

    if (!validateWeights(this.config.weights)) {
      throw new Error('Invalid weights: must sum to 1.0');
    }

    log.info({ categories: this.config.categories.length }, 'OpportunityScanner initialized');
  }

  /**
   * Score a raw opportunity and produce a fully scored opportunity.
   */
  scoreOpportunity(
    raw: Omit<ScoredOpportunity, 'id' | 'compositeScore' | 'recommendation' | 'discoveredAt'>
  ): ScoredOpportunity {
    const compositeScore = calculateCompositeScore(raw.scores, this.config.weights);
    const recommendation = determineRecommendation(compositeScore);

    return {
      ...raw,
      id: randomUUID(),
      compositeScore,
      recommendation,
      discoveredAt: new Date(),
    };
  }

  /**
   * Scan a single category for opportunities.
   */
  async scanCategory(category: OpportunityCategory): Promise<ScoredOpportunity[]> {
    const scanner = categoryScannersRegistry.get(category);
    if (!scanner) {
      log.debug({ category }, 'No scanner registered for category');
      return [];
    }

    try {
      const rawOpportunities = await scanner(category);
      const scored: ScoredOpportunity[] = [];

      for (const raw of rawOpportunities) {
        try {
          const opportunity = this.scoreOpportunity({
            category: raw.category,
            title: raw.title,
            description: raw.description,
            source: raw.source,
            sourceUrl: raw.sourceUrl,
            scores: raw.scores,
            actionItems: raw.actionItems,
            timeframe: raw.timeframe,
            expiresAt: raw.expiresAt,
            metadata: raw.metadata,
          });

          // Filter by minimum score threshold
          if (opportunity.compositeScore >= this.config.minScoreThreshold) {
            scored.push(opportunity);
            this.cacheOpportunity(opportunity);

            // Emit event for each detected opportunity
            this.eventBus.emit('investment:opportunity_detected', {
              category: opportunity.category,
              title: opportunity.title,
              score: opportunity.compositeScore,
            });
          }
        } catch (err) {
          log.warn({ category, title: raw.title, error: err }, 'Failed to score opportunity');
        }
      }

      log.info({ category, found: scored.length }, 'Category scan complete');
      return scored;
    } catch (err) {
      log.error({ category, error: err }, 'Category scan failed');
      return [];
    }
  }

  /**
   * Scan all configured categories for opportunities.
   */
  async scanAll(): Promise<ScoredOpportunity[]> {
    if (this.scanInProgress) {
      log.warn('Scan already in progress, skipping');
      return [];
    }

    this.scanInProgress = true;
    const allOpportunities: ScoredOpportunity[] = [];

    try {
      log.info({ categories: this.config.categories.length }, 'Starting full scan');

      for (const category of this.config.categories) {
        const opportunities = await this.scanCategory(category);
        allOpportunities.push(...opportunities);
      }

      this.lastScanAt = new Date();

      // Sort by composite score descending
      allOpportunities.sort((a, b) => b.compositeScore - a.compositeScore);

      log.info({ total: allOpportunities.length }, 'Full scan complete');

      // Emit audit event
      this.eventBus.emit('audit:log', {
        action: 'opportunity:scan_complete',
        agent: 'SCANNER',
        trustLevel: 'system',
        details: {
          categoriesScanned: this.config.categories.length,
          opportunitiesFound: allOpportunities.length,
          topScore: allOpportunities[0]?.compositeScore ?? 0,
        },
      });

      return allOpportunities;
    } finally {
      this.scanInProgress = false;
    }
  }

  /**
   * Get top opportunities from cache, sorted by score.
   */
  getTopOpportunities(limit: number = 10): ScoredOpportunity[] {
    const all = Array.from(this.opportunities.values());

    // Filter out expired opportunities
    const now = new Date();
    const valid = all.filter(o => !o.expiresAt || o.expiresAt > now);

    // Sort by composite score descending
    valid.sort((a, b) => b.compositeScore - a.compositeScore);

    return valid.slice(0, limit);
  }

  /**
   * Get opportunities by category.
   */
  getOpportunitiesByCategory(category: OpportunityCategory): ScoredOpportunity[] {
    return Array.from(this.opportunities.values())
      .filter(o => o.category === category)
      .sort((a, b) => b.compositeScore - a.compositeScore);
  }

  /**
   * Get opportunities by recommendation type.
   */
  getOpportunitiesByRecommendation(recommendation: RecommendationType): ScoredOpportunity[] {
    return Array.from(this.opportunities.values())
      .filter(o => o.recommendation === recommendation)
      .sort((a, b) => b.compositeScore - a.compositeScore);
  }

  /**
   * Get a specific opportunity by ID.
   */
  getOpportunity(id: string): ScoredOpportunity | undefined {
    return this.opportunities.get(id);
  }

  /**
   * Get all cached opportunities.
   */
  getAllOpportunities(): ScoredOpportunity[] {
    return Array.from(this.opportunities.values());
  }

  /**
   * Clear all cached opportunities.
   */
  clearCache(): void {
    const count = this.opportunities.size;
    this.opportunities.clear();
    log.info({ cleared: count }, 'Opportunity cache cleared');
  }

  /**
   * Remove expired opportunities from cache.
   */
  pruneExpired(): number {
    const now = new Date();
    let removed = 0;

    for (const [id, opportunity] of this.opportunities) {
      if (opportunity.expiresAt && opportunity.expiresAt <= now) {
        this.opportunities.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      log.info({ removed }, 'Pruned expired opportunities');
    }

    return removed;
  }

  /**
   * Get scanner statistics.
   */
  getStats(): {
    cachedCount: number;
    lastScanAt: Date | null;
    byCategory: Record<OpportunityCategory, number>;
    byRecommendation: Record<RecommendationType, number>;
    avgScore: number;
  } {
    const opportunities = Array.from(this.opportunities.values());

    const byCategory = {} as Record<OpportunityCategory, number>;
    const byRecommendation = {} as Record<RecommendationType, number>;

    for (const opp of opportunities) {
      byCategory[opp.category] = (byCategory[opp.category] || 0) + 1;
      byRecommendation[opp.recommendation] = (byRecommendation[opp.recommendation] || 0) + 1;
    }

    const avgScore = opportunities.length > 0
      ? opportunities.reduce((sum, o) => sum + o.compositeScore, 0) / opportunities.length
      : 0;

    return {
      cachedCount: opportunities.length,
      lastScanAt: this.lastScanAt,
      byCategory,
      byRecommendation,
      avgScore: Math.round(avgScore * 100) / 100,
    };
  }

  /**
   * Get current configuration.
   */
  getConfig(): OpportunityScannerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<OpportunityScannerConfig>): void {
    if (config.weights && !validateWeights({ ...this.config.weights, ...config.weights })) {
      throw new Error('Invalid weights: must sum to 1.0');
    }

    this.config = {
      ...this.config,
      ...config,
      weights: config.weights ? { ...this.config.weights, ...config.weights } : this.config.weights,
    };

    log.info({ config: this.config }, 'Configuration updated');
  }

  /**
   * Cache an opportunity, enforcing max cache size.
   */
  private cacheOpportunity(opportunity: ScoredOpportunity): void {
    // If at capacity, remove lowest-scoring opportunity
    if (this.opportunities.size >= this.config.maxCachedOpportunities) {
      const sorted = Array.from(this.opportunities.entries())
        .sort(([, a], [, b]) => a.compositeScore - b.compositeScore);

      if (sorted.length > 0) {
        const [lowestId] = sorted[0];
        this.opportunities.delete(lowestId);
      }
    }

    this.opportunities.set(opportunity.id, opportunity);
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create an OpportunityScanner instance.
 */
export function createOpportunityScanner(
  eventBus: EventBus,
  config?: Partial<OpportunityScannerConfig>
): OpportunityScanner {
  return new OpportunityScanner(eventBus, config);
}

export default OpportunityScanner;
