/**
 * OpportunityScanner — Full-spectrum opportunity detection and scoring
 *
 * Analyzes investment, income, and career opportunities across all asset classes.
 * Scores using weighted formula optimized for Pryce's time constraints (3hrs/night).
 */

import type { EventBus } from '../kernel/event-bus.js';

export type OpportunityCategory =
  | 'crypto_investment'
  | 'pokemon_investment'
  | 'stock_investment'
  | 'saas_idea'
  | 'freelance_gig'
  | 'consulting_lead'
  | 'content_opportunity'
  | 'career_opportunity'
  | 'side_project'
  | 'arbitrage';

export interface RawOpportunity {
  id: string;
  category: OpportunityCategory;
  title: string;
  description: string;
  source: string;
  sourceUrl?: string;
  detectedAt: string;
  rawData: Record<string, unknown>;
}

export interface ScoredOpportunity extends RawOpportunity {
  scores: {
    roiPotential: number;       // 0-100
    effortRequired: number;     // 0-100 (lower = better)
    skillAlignment: number;     // 0-100
    timeToRevenue: number;      // 0-100 (higher = faster)
    riskLevel: number;          // 0-100 (lower = safer)
    confidenceLevel: number;    // 0-100
  };
  compositeScore: number;
  recommendation: 'strong_buy' | 'buy' | 'watch' | 'pass';
  actionItems: string[];
  timeframe: 'immediate' | 'this_week' | 'this_month' | 'long_term';
}

export interface OpportunityReport {
  generatedAt: string;
  period: 'daily' | 'weekly';
  topOpportunities: ScoredOpportunity[];
  byCategory: Partial<Record<OpportunityCategory, ScoredOpportunity[]>>;
  marketSummary: string;
  actionPlan: string[];
}

// Scoring weights (optimized for limited time — 3hrs/night)
const WEIGHTS = {
  roiPotential: 0.25,
  effortRequired: 0.20,
  skillAlignment: 0.15,
  timeToRevenue: 0.20,
  riskLevel: 0.10,
  confidenceLevel: 0.10,
};

export class OpportunityScanner {
  private opportunities: ScoredOpportunity[] = [];

  constructor(private eventBus: EventBus) {}

  /**
   * Add a raw opportunity for scoring
   */
  addOpportunity(opp: RawOpportunity): void {
    // Check for duplicates
    const exists = this.opportunities.find((o) => o.id === opp.id);
    if (exists) {
      return;
    }

    // Default scores (must be provided separately via scoreOpportunity)
    const scores = {
      roiPotential: 0,
      effortRequired: 0,
      skillAlignment: 0,
      timeToRevenue: 0,
      riskLevel: 0,
      confidenceLevel: 0,
    };

    const scored = this.scoreOpportunity(opp, scores);
    this.opportunities.push(scored);
  }

  /**
   * Score an opportunity using weighted formula
   */
  scoreOpportunity(
    opp: RawOpportunity,
    scores: ScoredOpportunity['scores']
  ): ScoredOpportunity {
    // Calculate composite score
    // NOTE: effortRequired and riskLevel are inverted (lower is better)
    const compositeScore =
      scores.roiPotential * WEIGHTS.roiPotential +
      (100 - scores.effortRequired) * WEIGHTS.effortRequired +
      scores.skillAlignment * WEIGHTS.skillAlignment +
      scores.timeToRevenue * WEIGHTS.timeToRevenue +
      (100 - scores.riskLevel) * WEIGHTS.riskLevel +
      scores.confidenceLevel * WEIGHTS.confidenceLevel;

    // Determine recommendation
    let recommendation: ScoredOpportunity['recommendation'];
    if (compositeScore > 75) {
      recommendation = 'strong_buy';
    } else if (compositeScore > 55) {
      recommendation = 'buy';
    } else if (compositeScore > 35) {
      recommendation = 'watch';
    } else {
      recommendation = 'pass';
    }

    // Determine timeframe based on timeToRevenue
    let timeframe: ScoredOpportunity['timeframe'];
    if (scores.timeToRevenue > 75) {
      timeframe = 'immediate';
    } else if (scores.timeToRevenue > 50) {
      timeframe = 'this_week';
    } else if (scores.timeToRevenue > 25) {
      timeframe = 'this_month';
    } else {
      timeframe = 'long_term';
    }

    // Generate action items based on category
    const actionItems = this.generateActionItems(opp.category, recommendation);

    return {
      ...opp,
      scores,
      compositeScore,
      recommendation,
      actionItems,
      timeframe,
    };
  }

  /**
   * Get all scored opportunities with optional filters
   */
  getOpportunities(options?: {
    category?: OpportunityCategory;
    minScore?: number;
  }): ScoredOpportunity[] {
    let filtered = this.opportunities;

    if (options?.category) {
      filtered = filtered.filter((o) => o.category === options.category);
    }

    const minScore = options?.minScore;
    if (minScore !== undefined) {
      filtered = filtered.filter((o) => o.compositeScore >= minScore);
    }

    // Sort by composite score descending
    return filtered.sort((a, b) => b.compositeScore - a.compositeScore);
  }

  /**
   * Generate weekly report
   */
  generateReport(period: 'daily' | 'weekly'): OpportunityReport {
    const topOpportunities = this.getOpportunities({ minScore: 35 });

    // Group by category
    const byCategory: Partial<Record<OpportunityCategory, ScoredOpportunity[]>> = {};
    for (const opp of topOpportunities) {
      if (!byCategory[opp.category]) {
        byCategory[opp.category] = [];
      }
      byCategory[opp.category]!.push(opp);
    }

    // Generate market summary
    const marketSummary = this.generateMarketSummary(topOpportunities);

    // Generate action plan
    const actionPlan = this.generateActionPlan(topOpportunities);

    return {
      generatedAt: new Date().toISOString(),
      period,
      topOpportunities: topOpportunities.slice(0, 10), // Top 10
      byCategory,
      marketSummary,
      actionPlan,
    };
  }

  /**
   * Clear old opportunities
   */
  pruneOld(maxAgeDays: number = 7): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);

    const before = this.opportunities.length;
    this.opportunities = this.opportunities.filter((o) => {
      const detected = new Date(o.detectedAt);
      return detected >= cutoff;
    });

    const removed = before - this.opportunities.length;

    if (removed > 0) {
      this.eventBus.emit('audit:log', {
        action: 'opportunity_pruned',
        agent: 'opportunity-scanner',
        trustLevel: 'system',
        details: { removed, maxAgeDays },
      });
    }

    return removed;
  }

  /**
   * Generate action items based on category and recommendation
   */
  private generateActionItems(
    category: OpportunityCategory,
    recommendation: ScoredOpportunity['recommendation']
  ): string[] {
    const items: string[] = [];

    if (recommendation === 'pass') {
      items.push('Archive for future reference');
      return items;
    }

    switch (category) {
      case 'crypto_investment':
      case 'stock_investment':
        items.push('Research price history and volume');
        items.push('Check technical indicators');
        if (recommendation === 'strong_buy') {
          items.push('Set price alert and entry point');
        }
        break;

      case 'pokemon_investment':
        items.push('Check market prices and sales history');
        items.push('Verify card condition and authenticity');
        if (recommendation === 'strong_buy') {
          items.push('Identify best marketplace for purchase');
        }
        break;

      case 'saas_idea':
      case 'side_project':
        items.push('Validate market demand');
        items.push('Sketch MVP requirements');
        if (recommendation === 'strong_buy') {
          items.push('Create 1-week prototype timeline');
        }
        break;

      case 'freelance_gig':
      case 'consulting_lead':
        items.push('Review requirements and timeline');
        items.push('Calculate hourly rate vs time commitment');
        if (recommendation === 'strong_buy') {
          items.push('Draft proposal with timeline');
        }
        break;

      case 'career_opportunity':
        items.push('Review job description and requirements');
        items.push('Identify skill gaps');
        if (recommendation === 'strong_buy') {
          items.push('Tailor resume highlighting ARI project');
          items.push('Prepare application materials');
        }
        break;

      case 'content_opportunity':
        items.push('Research audience and platform');
        items.push('Outline content structure');
        if (recommendation === 'strong_buy') {
          items.push('Schedule creation time');
        }
        break;

      case 'arbitrage':
        items.push('Verify price differential');
        items.push('Calculate transaction costs');
        if (recommendation === 'strong_buy') {
          items.push('Execute immediately before window closes');
        }
        break;

      default:
        items.push('Research further');
    }

    return items;
  }

  /**
   * Generate market summary from opportunities
   */
  private generateMarketSummary(opportunities: ScoredOpportunity[]): string {
    const strongBuy = opportunities.filter((o) => o.recommendation === 'strong_buy').length;
    const buy = opportunities.filter((o) => o.recommendation === 'buy').length;
    const watch = opportunities.filter((o) => o.recommendation === 'watch').length;

    const categories = new Set(opportunities.map((o) => o.category));
    const topCategory = this.getMostFrequentCategory(opportunities);

    return `Found ${opportunities.length} opportunities: ${strongBuy} strong buy, ${buy} buy, ${watch} watch. Active in ${categories.size} categories, strongest in ${topCategory}.`;
  }

  /**
   * Generate actionable plan from top opportunities
   */
  private generateActionPlan(opportunities: ScoredOpportunity[]): string[] {
    const plan: string[] = [];

    const immediate = opportunities.filter((o) => o.timeframe === 'immediate');
    const thisWeek = opportunities.filter((o) => o.timeframe === 'this_week');

    if (immediate.length > 0) {
      plan.push(`Immediate action: Focus on ${immediate[0].title} (score: ${immediate[0].compositeScore.toFixed(1)})`);
    }

    if (thisWeek.length > 0) {
      plan.push(`This week: Schedule time for ${thisWeek.slice(0, 2).map((o) => o.title).join(', ')}`);
    }

    const strongBuys = opportunities.filter((o) => o.recommendation === 'strong_buy');
    if (strongBuys.length > 3) {
      plan.push(`High opportunity week: ${strongBuys.length} strong buy signals detected`);
    }

    return plan;
  }

  /**
   * Get most frequent category
   */
  private getMostFrequentCategory(opportunities: ScoredOpportunity[]): OpportunityCategory {
    const counts = new Map<OpportunityCategory, number>();

    for (const opp of opportunities) {
      counts.set(opp.category, (counts.get(opp.category) || 0) + 1);
    }

    let maxCategory: OpportunityCategory = 'crypto_investment';
    let maxCount = 0;

    for (const [category, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        maxCategory = category;
      }
    }

    return maxCategory;
  }
}
