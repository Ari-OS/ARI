/**
 * InvestmentAnalyzer — Deep analysis engine for investment decisions
 *
 * Uses basic technical indicators (SMA, momentum, trend detection) to analyze
 * assets and generate investment recommendations.
 */

import type { EventBus } from '../kernel/event-bus.js';

export interface InvestmentAnalysis {
  asset: string;
  assetClass: string;
  summary: string;
  technicalSignals: {
    trend: 'bullish' | 'neutral' | 'bearish';
    momentum: number;      // -100 to 100
    volumeTrend: 'increasing' | 'stable' | 'decreasing';
  };
  recommendation: {
    action: 'buy' | 'hold' | 'sell' | 'watch';
    confidence: number;
    reasoning: string;
    timeframe: string;
  };
  risks: string[];
  catalysts: string[];
}

export class InvestmentAnalyzer {
  constructor(private eventBus: EventBus) {}

  /**
   * Analyze price history for an asset
   */
  analyzeAsset(
    asset: string,
    priceHistory: Array<{ price: number; timestamp: string }>
  ): InvestmentAnalysis {
    if (priceHistory.length === 0) {
      throw new Error('Price history cannot be empty');
    }

    const prices = priceHistory.map((p) => p.price);

    // Calculate technical indicators
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, 50);
    const trend = this.detectTrend(prices);
    const momentum = this.calculateMomentum(prices, 14);

    // Determine asset class (simplified)
    const assetClass = this.inferAssetClass(asset);

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      prices,
      sma20,
      sma50,
      trend,
      momentum
    );

    // Generate summary
    const currentPrice = prices[prices.length - 1];
    const summary = `${asset} at $${currentPrice.toFixed(2)}, ${trend} trend with ${momentum > 0 ? 'positive' : 'negative'} momentum (${momentum.toFixed(1)})`;

    // Identify risks and catalysts
    const risks = this.identifyRisks(trend, momentum, prices);
    const catalysts = this.identifyCatalysts(trend, momentum, sma20, currentPrice);

    this.eventBus.emit('audit:log', {
      action: 'investment_analyzed',
      agent: 'investment-analyzer',
      trustLevel: 'system',
      details: { asset, recommendation: recommendation.action, trend, momentum },
    });

    return {
      asset,
      assetClass,
      summary,
      technicalSignals: {
        trend,
        momentum,
        volumeTrend: 'stable', // Placeholder (would need volume data)
      },
      recommendation,
      risks,
      catalysts,
    };
  }

  /**
   * Calculate Simple Moving Average
   */
  calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) {
      // Not enough data, return average of all prices
      return prices.reduce((sum, p) => sum + p, 0) / prices.length;
    }

    const recentPrices = prices.slice(-period);
    return recentPrices.reduce((sum, p) => sum + p, 0) / period;
  }

  /**
   * Detect trend from price series
   */
  detectTrend(prices: number[]): 'bullish' | 'neutral' | 'bearish' {
    if (prices.length < 2) {
      return 'neutral';
    }

    // Compare recent prices to older prices
    const recentAvg = this.calculateSMA(prices.slice(-5), 5);
    const olderAvg = this.calculateSMA(prices.slice(-10, -5), 5);

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (change > 2) {
      return 'bullish';
    } else if (change < -2) {
      return 'bearish';
    } else {
      return 'neutral';
    }
  }

  /**
   * Calculate momentum (rate of change)
   */
  calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period + 1) {
      return 0;
    }

    const currentPrice = prices[prices.length - 1];
    const oldPrice = prices[prices.length - period - 1];

    // Return percentage change scaled to -100 to 100
    const percentChange = ((currentPrice - oldPrice) / oldPrice) * 100;

    // Clamp to -100 to 100
    return Math.max(-100, Math.min(100, percentChange * 10));
  }

  /**
   * Generate investment recommendation
   */
  private generateRecommendation(
    prices: number[],
    sma20: number,
    sma50: number,
    trend: 'bullish' | 'neutral' | 'bearish',
    momentum: number
  ): InvestmentAnalysis['recommendation'] {
    const currentPrice = prices[prices.length - 1];
    let action: 'buy' | 'hold' | 'sell' | 'watch';
    let confidence: number;
    let reasoning: string;
    let timeframe: string;

    // Golden cross / death cross detection
    const goldenCross = sma20 > sma50 && currentPrice > sma20;
    const deathCross = sma20 < sma50 && currentPrice < sma20;

    // Strong bullish signals
    if (trend === 'bullish' && momentum > 30 && goldenCross) {
      action = 'buy';
      confidence = 85;
      reasoning = 'Strong uptrend with golden cross signal';
      timeframe = 'short-term (1-4 weeks)';
    }
    // Moderate bullish signals
    else if (trend === 'bullish' && momentum > 15) {
      action = 'buy';
      confidence = 65;
      reasoning = 'Positive trend and momentum';
      timeframe = 'medium-term (1-3 months)';
    }
    // Strong bearish signals
    else if (trend === 'bearish' && momentum < -30 && deathCross) {
      action = 'sell';
      confidence = 80;
      reasoning = 'Strong downtrend with death cross signal';
      timeframe = 'immediate';
    }
    // Moderate bearish signals
    else if (trend === 'bearish' && momentum < -15) {
      action = 'sell';
      confidence = 60;
      reasoning = 'Negative trend and momentum';
      timeframe = 'short-term (1-2 weeks)';
    }
    // Neutral with positive momentum
    else if (trend === 'neutral' && momentum > 10) {
      action = 'watch';
      confidence = 50;
      reasoning = 'Consolidating with slight positive momentum';
      timeframe = 'watch for breakout';
    }
    // Neutral with negative momentum
    else if (trend === 'neutral' && momentum < -10) {
      action = 'hold';
      confidence = 45;
      reasoning = 'Consolidating with slight negative momentum';
      timeframe = 'wait for trend confirmation';
    }
    // Default neutral
    else {
      action = 'hold';
      confidence = 40;
      reasoning = 'No clear trend, waiting for signal';
      timeframe = 'monitor closely';
    }

    return { action, confidence, reasoning, timeframe };
  }

  /**
   * Identify investment risks
   */
  private identifyRisks(
    trend: 'bullish' | 'neutral' | 'bearish',
    momentum: number,
    prices: number[]
  ): string[] {
    const risks: string[] = [];

    if (trend === 'bearish') {
      risks.push('Downtrend may continue');
    }

    if (Math.abs(momentum) > 50) {
      risks.push('High volatility, potential for sharp reversal');
    }

    // Check for recent sharp moves
    const recentChange = prices.length >= 2
      ? ((prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2]) * 100
      : 0;

    if (Math.abs(recentChange) > 10) {
      risks.push('Recent sharp price movement may indicate instability');
    }

    if (risks.length === 0) {
      risks.push('Standard market risk');
    }

    return risks;
  }

  /**
   * Identify potential catalysts
   */
  private identifyCatalysts(
    trend: 'bullish' | 'neutral' | 'bearish',
    momentum: number,
    sma20: number,
    currentPrice: number
  ): string[] {
    const catalysts: string[] = [];

    if (trend === 'bullish' && momentum > 20) {
      catalysts.push('Strong upward momentum continuing');
    }

    if (currentPrice > sma20) {
      catalysts.push('Price above 20-day moving average');
    }

    if (trend === 'neutral') {
      catalysts.push('Potential breakout opportunity if trend develops');
    }

    if (catalysts.length === 0) {
      catalysts.push('Monitor for trend confirmation');
    }

    return catalysts;
  }

  /**
   * Infer asset class from asset name
   */
  private inferAssetClass(asset: string): string {
    const assetLower = asset.toLowerCase();

    if (assetLower.includes('btc') || assetLower.includes('eth') || assetLower.includes('coin')) {
      return 'Cryptocurrency';
    }

    if (assetLower.includes('pokemon') || assetLower.includes('tcg') || assetLower.includes('card')) {
      return 'Collectible';
    }

    return 'Stock/Equity';
  }
}
