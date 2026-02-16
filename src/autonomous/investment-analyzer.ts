/**
 * ARI Investment Analyzer
 *
 * Analyzes investment opportunities using the LOGOS cognitive framework.
 * Provides risk-adjusted returns, Kelly criterion position sizing,
 * and buy/sell/hold recommendations.
 *
 * @module autonomous/investment-analyzer
 * @layer L5 (Autonomous)
 */

import { z } from 'zod';
import type { EventBus } from '../kernel/event-bus.js';
import {
  calculateKellyFraction,
  type KellyInput,
} from '../cognition/logos/index.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('investment-analyzer');

// ═══════════════════════════════════════════════════════════════════════════
// ZOD SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Recommendation type for investment analysis
 */
export const RecommendationSchema = z.enum([
  'strong_buy',
  'buy',
  'hold',
  'sell',
  'strong_sell',
]);
export type Recommendation = z.infer<typeof RecommendationSchema>;

/**
 * Price history data point
 */
export const PricePointSchema = z.object({
  price: z.number().positive(),
  timestamp: z.string(),
});
export type PricePoint = z.infer<typeof PricePointSchema>;

/**
 * Investment metrics
 */
export const InvestmentMetricsSchema = z.object({
  expectedReturn: z.number(),
  riskScore: z.number().min(0).max(1),
  kellyFraction: z.number().min(0).max(1),
  sharpeRatio: z.number().optional(),
  volatility: z.number().optional(),
  maxDrawdown: z.number().optional(),
  winRate: z.number().min(0).max(1).optional(),
});
export type InvestmentMetrics = z.infer<typeof InvestmentMetricsSchema>;

/**
 * Complete investment analysis result
 */
export const InvestmentAnalysisSchema = z.object({
  asset: z.string(),
  assetClass: z.string(),
  recommendation: RecommendationSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.array(z.string()),
  metrics: InvestmentMetricsSchema,
  actionItems: z.array(z.string()),
  provenance: z.object({
    framework: z.string(),
    computedAt: z.date(),
  }).optional(),
});
export type InvestmentAnalysis = z.infer<typeof InvestmentAnalysisSchema>;

/**
 * Analysis context
 */
export const AnalysisContextSchema = z.object({
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  timeHorizon: z.enum(['short', 'medium', 'long']).optional(),
  currentPosition: z.number().optional(),
  portfolioValue: z.number().positive().optional(),
  marketCondition: z.enum(['bull', 'bear', 'neutral']).optional(),
});
export type AnalysisContext = z.infer<typeof AnalysisContextSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Risk-free rate for Sharpe ratio calculation (annual)
 */
const RISK_FREE_RATE = 0.05;

/**
 * Minimum data points required for analysis
 */
const MIN_DATA_POINTS = 5;

/**
 * Risk tolerance multipliers for Kelly fraction
 */
const RISK_MULTIPLIERS: Record<string, number> = {
  conservative: 0.25,
  moderate: 0.5,
  aggressive: 1.0,
};

// ═══════════════════════════════════════════════════════════════════════════
// INVESTMENT ANALYZER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyzes investment opportunities using LOGOS cognitive framework.
 *
 * Features:
 * - Calculates expected returns from price history
 * - Applies Kelly criterion for position sizing
 * - Computes Sharpe ratio and risk metrics
 * - Generates actionable recommendations
 * - Emits events for opportunity detection
 */
export class InvestmentAnalyzer {
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Analyze an investment opportunity
   *
   * @param asset - Asset identifier (e.g., 'AAPL', 'BTC')
   * @param assetClass - Asset class (e.g., 'equity', 'crypto', 'bond')
   * @param priceHistory - Historical price data
   * @param context - Optional analysis context
   * @returns Complete investment analysis
   */
  async analyze(
    asset: string,
    assetClass: string,
    priceHistory: PricePoint[],
    context?: Record<string, unknown>
  ): Promise<InvestmentAnalysis> {
    // Validate inputs
    if (!asset || asset.trim().length === 0) {
      throw new Error('Asset identifier is required');
    }

    if (!assetClass || assetClass.trim().length === 0) {
      throw new Error('Asset class is required');
    }

    if (!priceHistory || priceHistory.length < MIN_DATA_POINTS) {
      throw new Error(`Minimum ${MIN_DATA_POINTS} data points required for analysis`);
    }

    // Parse context
    const parsedContext = context ? AnalysisContextSchema.partial().safeParse(context) : null;
    const analysisContext: Partial<AnalysisContext> = parsedContext?.success
      ? parsedContext.data
      : {};

    // Calculate returns
    const returns = this.calculateReturns(priceHistory);
    const statistics = this.calculateStatistics(returns);

    // Calculate metrics
    const metrics = await this.calculateMetrics(
      returns,
      statistics,
      analysisContext
    );

    // Generate recommendation
    const { recommendation, confidence, reasoning } = this.generateRecommendation(
      metrics,
      statistics,
      analysisContext
    );

    // Generate action items
    const actionItems = this.generateActionItems(
      recommendation,
      metrics,
      asset,
      analysisContext
    );

    // Build analysis result
    const analysis: InvestmentAnalysis = {
      asset,
      assetClass,
      recommendation,
      confidence,
      reasoning,
      metrics,
      actionItems,
      provenance: {
        framework: 'LOGOS Investment Analysis',
        computedAt: new Date(),
      },
    };

    // Emit opportunity event if strong buy/sell
    if (recommendation === 'strong_buy' || recommendation === 'strong_sell') {
      this.eventBus.emit('investment:opportunity_detected', {
        category: assetClass,
        title: `${recommendation === 'strong_buy' ? 'Buy' : 'Sell'} opportunity: ${asset}`,
        score: confidence,
      });

      log.info({
        asset,
        recommendation,
        confidence,
        expectedReturn: metrics.expectedReturn,
      }, 'Investment opportunity detected');
    }

    return analysis;
  }

  /**
   * Compare multiple investment opportunities and rank them
   *
   * @param analyses - Array of investment analyses to compare
   * @returns Sorted array with best opportunities first
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async compareOpportunities(
    analyses: InvestmentAnalysis[]
  ): Promise<InvestmentAnalysis[]> {
    if (!analyses || analyses.length === 0) {
      return [];
    }

    // Score each analysis
    const scored = analyses.map(analysis => ({
      analysis,
      score: this.calculateOpportunityScore(analysis),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.map(s => s.analysis);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRICE ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Calculate returns from price history
   */
  private calculateReturns(priceHistory: PricePoint[]): number[] {
    const returns: number[] = [];

    // Sort by timestamp
    const sorted = [...priceHistory].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (let i = 1; i < sorted.length; i++) {
      const previousPrice = sorted[i - 1].price;
      const currentPrice = sorted[i].price;

      if (previousPrice > 0) {
        const returnValue = (currentPrice - previousPrice) / previousPrice;
        returns.push(returnValue);
      }
    }

    return returns;
  }

  /**
   * Calculate statistical measures from returns
   */
  private calculateStatistics(returns: number[]): {
    mean: number;
    stdDev: number;
    variance: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    maxDrawdown: number;
  } {
    if (returns.length === 0) {
      return {
        mean: 0,
        stdDev: 0,
        variance: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        maxDrawdown: 0,
      };
    }

    // Mean return
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Variance and standard deviation
    const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Win rate
    const wins = returns.filter(r => r > 0);
    const losses = returns.filter(r => r < 0);
    const winRate = returns.length > 0 ? wins.length / returns.length : 0;

    // Average win/loss
    const avgWin = wins.length > 0
      ? wins.reduce((sum, w) => sum + w, 0) / wins.length
      : 0;
    const avgLoss = losses.length > 0
      ? Math.abs(losses.reduce((sum, l) => sum + l, 0) / losses.length)
      : 0;

    // Max drawdown (simplified)
    let peak = 1;
    let maxDrawdown = 0;
    let cumulative = 1;

    for (const r of returns) {
      cumulative *= (1 + r);
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = (peak - cumulative) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return { mean, stdDev, variance, winRate, avgWin, avgLoss, maxDrawdown };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // METRICS CALCULATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Calculate investment metrics using LOGOS framework
   */
  private async calculateMetrics(
    returns: number[],
    statistics: ReturnType<typeof this.calculateStatistics>,
    context: Partial<AnalysisContext>
  ): Promise<InvestmentMetrics> {
    const { mean, stdDev, winRate, avgWin, avgLoss, maxDrawdown } = statistics;

    // Expected return (annualized assuming daily returns)
    const expectedReturn = mean * 252; // Trading days per year

    // Risk score (0-1, based on volatility and drawdown)
    const volatilityRisk = Math.min(1, stdDev * 10); // Scale to 0-1
    const drawdownRisk = maxDrawdown;
    const riskScore = (volatilityRisk * 0.6 + drawdownRisk * 0.4);

    // Sharpe ratio (annualized)
    const annualizedStdDev = stdDev * Math.sqrt(252);
    const sharpeRatio = annualizedStdDev > 0
      ? (expectedReturn - RISK_FREE_RATE) / annualizedStdDev
      : 0;

    // Kelly criterion
    let kellyFraction = 0;
    if (winRate > 0 && avgWin > 0 && avgLoss > 0) {
      try {
        const kellyInput: KellyInput = {
          winProbability: winRate,
          winAmount: avgWin,
          lossAmount: avgLoss,
        };

        const kellyResult = await calculateKellyFraction(kellyInput);
        kellyFraction = kellyResult.recommendedFraction;

        // Apply risk tolerance adjustment
        const riskMultiplier = RISK_MULTIPLIERS[context.riskTolerance || 'moderate'];
        kellyFraction = Math.min(1, kellyFraction * riskMultiplier);
      } catch (error) {
        log.warn({ error }, 'Kelly calculation failed, using conservative estimate');
        kellyFraction = 0.1;
      }
    }

    return {
      expectedReturn,
      riskScore,
      kellyFraction,
      sharpeRatio,
      volatility: annualizedStdDev,
      maxDrawdown,
      winRate,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RECOMMENDATION GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Generate recommendation based on metrics
   */
  private generateRecommendation(
    metrics: InvestmentMetrics,
    statistics: ReturnType<typeof this.calculateStatistics>,
    context: Partial<AnalysisContext>
  ): {
    recommendation: Recommendation;
    confidence: number;
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    let score = 0;

    // Expected return scoring
    if (metrics.expectedReturn > 0.2) {
      score += 2;
      reasoning.push(`Strong expected annual return of ${(metrics.expectedReturn * 100).toFixed(1)}%`);
    } else if (metrics.expectedReturn > 0.1) {
      score += 1;
      reasoning.push(`Positive expected annual return of ${(metrics.expectedReturn * 100).toFixed(1)}%`);
    } else if (metrics.expectedReturn > 0) {
      reasoning.push(`Modest expected annual return of ${(metrics.expectedReturn * 100).toFixed(1)}%`);
    } else {
      score -= 2;
      reasoning.push(`Negative expected annual return of ${(metrics.expectedReturn * 100).toFixed(1)}%`);
    }

    // Sharpe ratio scoring
    const sharpe = metrics.sharpeRatio ?? 0;
    if (sharpe > 1.5) {
      score += 2;
      reasoning.push(`Excellent risk-adjusted returns (Sharpe: ${sharpe.toFixed(2)})`);
    } else if (sharpe > 1.0) {
      score += 1;
      reasoning.push(`Good risk-adjusted returns (Sharpe: ${sharpe.toFixed(2)})`);
    } else if (sharpe > 0.5) {
      reasoning.push(`Acceptable risk-adjusted returns (Sharpe: ${sharpe.toFixed(2)})`);
    } else {
      score -= 1;
      reasoning.push(`Poor risk-adjusted returns (Sharpe: ${sharpe.toFixed(2)})`);
    }

    // Risk scoring
    if (metrics.riskScore > 0.7) {
      score -= 2;
      reasoning.push('High risk profile - significant volatility or drawdown');
    } else if (metrics.riskScore > 0.5) {
      score -= 1;
      reasoning.push('Elevated risk profile');
    } else if (metrics.riskScore < 0.3) {
      score += 1;
      reasoning.push('Low risk profile');
    }

    // Kelly fraction scoring
    if (metrics.kellyFraction > 0.2) {
      score += 1;
      reasoning.push(`Kelly suggests meaningful position (${(metrics.kellyFraction * 100).toFixed(1)}% of capital)`);
    } else if (metrics.kellyFraction < 0.05) {
      score -= 1;
      reasoning.push('Kelly suggests minimal or no position');
    }

    // Win rate consideration
    const winRate = statistics.winRate;
    if (winRate > 0.6) {
      score += 1;
      reasoning.push(`High win rate: ${(winRate * 100).toFixed(0)}%`);
    } else if (winRate < 0.4) {
      score -= 1;
      reasoning.push(`Low win rate: ${(winRate * 100).toFixed(0)}%`);
    }

    // Market condition adjustment
    if (context.marketCondition === 'bear') {
      score -= 1;
      reasoning.push('Bear market conditions increase caution');
    } else if (context.marketCondition === 'bull') {
      score += 0.5;
      reasoning.push('Bull market conditions favorable');
    }

    // Time horizon adjustment
    if (context.timeHorizon === 'short' && metrics.volatility && metrics.volatility > 0.3) {
      score -= 1;
      reasoning.push('High volatility unfavorable for short-term horizon');
    }

    // Determine recommendation
    let recommendation: Recommendation;
    if (score >= 4) {
      recommendation = 'strong_buy';
    } else if (score >= 2) {
      recommendation = 'buy';
    } else if (score >= -1) {
      recommendation = 'hold';
    } else if (score >= -3) {
      recommendation = 'sell';
    } else {
      recommendation = 'strong_sell';
    }

    // Calculate confidence based on data quality and signal strength
    const signalStrength = Math.abs(score) / 6; // Normalize to 0-1
    const dataQuality = Math.min(1, (metrics.winRate ?? 0.5) + 0.3); // Base quality + win rate
    const confidence = Math.min(0.95, (signalStrength * 0.6 + dataQuality * 0.4));

    return { recommendation, confidence, reasoning };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ACTION ITEMS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Generate actionable items based on recommendation
   */
  private generateActionItems(
    recommendation: Recommendation,
    metrics: InvestmentMetrics,
    asset: string,
    context: Partial<AnalysisContext>
  ): string[] {
    const actionItems: string[] = [];

    switch (recommendation) {
      case 'strong_buy':
        actionItems.push(`Consider allocating up to ${(metrics.kellyFraction * 100).toFixed(0)}% of capital to ${asset}`);
        actionItems.push('Set limit orders at current price or slight pullback');
        actionItems.push('Define stop-loss at max acceptable drawdown level');
        break;

      case 'buy':
        actionItems.push(`Consider partial position in ${asset} (${((metrics.kellyFraction * 0.5) * 100).toFixed(0)}% of recommended)`);
        actionItems.push('Monitor for better entry points');
        actionItems.push('Set alerts for significant price movements');
        break;

      case 'hold':
        actionItems.push(`Maintain current position in ${asset} if any`);
        actionItems.push('Review analysis weekly for condition changes');
        actionItems.push('Do not add to position at current levels');
        break;

      case 'sell':
        actionItems.push(`Consider reducing position in ${asset}`);
        actionItems.push('Set trailing stop to protect remaining gains');
        actionItems.push('Identify reentry criteria');
        break;

      case 'strong_sell':
        actionItems.push(`Exit position in ${asset} as soon as practical`);
        actionItems.push('Do not average down');
        actionItems.push('Review what signals were missed');
        break;
    }

    // Add risk management items
    if (metrics.riskScore > 0.5) {
      actionItems.push('Consider position sizing due to elevated risk');
    }

    // Portfolio context items
    if (context.portfolioValue && metrics.kellyFraction > 0) {
      const suggestedAllocation = context.portfolioValue * metrics.kellyFraction;
      actionItems.push(`Suggested allocation: $${suggestedAllocation.toFixed(2)} based on Kelly criterion`);
    }

    return actionItems;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COMPARISON UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Calculate opportunity score for ranking
   */
  private calculateOpportunityScore(analysis: InvestmentAnalysis): number {
    const { metrics, recommendation, confidence } = analysis;

    // Base score from recommendation
    const recommendationScores: Record<Recommendation, number> = {
      strong_buy: 5,
      buy: 4,
      hold: 3,
      sell: 2,
      strong_sell: 1,
    };
    const baseScore = recommendationScores[recommendation];

    // Sharpe ratio contribution (normalized)
    const sharpeContribution = Math.min(2, Math.max(-1, (metrics.sharpeRatio ?? 0) / 1.5));

    // Expected return contribution (normalized)
    const returnContribution = Math.min(2, Math.max(-1, metrics.expectedReturn * 5));

    // Risk penalty
    const riskPenalty = metrics.riskScore * 1.5;

    // Confidence multiplier
    const confidenceMultiplier = 0.5 + confidence;

    // Combined score
    return (baseScore + sharpeContribution + returnContribution - riskPenalty) * confidenceMultiplier;
  }
}

