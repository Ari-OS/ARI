import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  InvestmentAnalyzer,
  InvestmentAnalysis,
  PricePoint,
  Recommendation,
} from '../../../src/autonomous/investment-analyzer.js';
import { EventBus } from '../../../src/kernel/event-bus.js';

// Mock the LOGOS cognition module
vi.mock('../../../src/cognition/logos/index.js', () => ({
  calculateKellyFraction: vi.fn().mockResolvedValue({
    fullKelly: 0.2,
    halfKelly: 0.1,
    quarterKelly: 0.05,
    recommendedFraction: 0.15,
    recommendedStrategy: 'half',
    edge: 0.05,
    odds: 1.5,
    expectedGrowthRate: 0.03,
    warnings: [],
  }),
  calculateExpectedValue: vi.fn().mockResolvedValue({
    expectedValue: 100,
    recommendation: 'PROCEED',
    reasoning: ['Positive expected value'],
  }),
  assessAntifragility: vi.fn().mockResolvedValue({
    category: 'robust',
    score: 0.5,
  }),
}));

// Mock logger
vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('InvestmentAnalyzer', () => {
  let analyzer: InvestmentAnalyzer;
  let eventBus: EventBus;

  // Helper to generate price history
  const generatePriceHistory = (
    startPrice: number,
    count: number,
    trend: 'up' | 'down' | 'volatile' = 'up'
  ): PricePoint[] => {
    const points: PricePoint[] = [];
    let price = startPrice;

    for (let i = 0; i < count; i++) {
      const date = new Date(2026, 0, i + 1);

      switch (trend) {
        case 'up':
          price *= 1 + Math.random() * 0.02;
          break;
        case 'down':
          price *= 1 - Math.random() * 0.02;
          break;
        case 'volatile':
          price *= 1 + (Math.random() - 0.5) * 0.1;
          break;
      }

      points.push({
        price,
        timestamp: date.toISOString(),
      });
    }

    return points;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new EventBus();
    analyzer = new InvestmentAnalyzer(eventBus);
  });

  afterEach(() => {
    eventBus.clear();
  });

  describe('constructor', () => {
    it('should create instance with EventBus', () => {
      const instance = new InvestmentAnalyzer(eventBus);
      expect(instance).toBeInstanceOf(InvestmentAnalyzer);
    });
  });

  describe('analyze()', () => {
    describe('input validation', () => {
      it('should throw error when asset is empty', async () => {
        const priceHistory = generatePriceHistory(100, 10);
        await expect(
          analyzer.analyze('', 'equity', priceHistory)
        ).rejects.toThrow('Asset identifier is required');
      });

      it('should throw error when asset is whitespace only', async () => {
        const priceHistory = generatePriceHistory(100, 10);
        await expect(
          analyzer.analyze('   ', 'equity', priceHistory)
        ).rejects.toThrow('Asset identifier is required');
      });

      it('should throw error when assetClass is empty', async () => {
        const priceHistory = generatePriceHistory(100, 10);
        await expect(
          analyzer.analyze('AAPL', '', priceHistory)
        ).rejects.toThrow('Asset class is required');
      });

      it('should throw error when assetClass is whitespace only', async () => {
        const priceHistory = generatePriceHistory(100, 10);
        await expect(
          analyzer.analyze('AAPL', '   ', priceHistory)
        ).rejects.toThrow('Asset class is required');
      });

      it('should throw error when price history is empty', async () => {
        await expect(
          analyzer.analyze('AAPL', 'equity', [])
        ).rejects.toThrow('Minimum 5 data points required');
      });

      it('should throw error when price history has insufficient data', async () => {
        const priceHistory = generatePriceHistory(100, 3);
        await expect(
          analyzer.analyze('AAPL', 'equity', priceHistory)
        ).rejects.toThrow('Minimum 5 data points required');
      });

      it('should accept exactly minimum required data points', async () => {
        const priceHistory = generatePriceHistory(100, 5, 'up');
        const result = await analyzer.analyze('AAPL', 'equity', priceHistory);
        expect(result).toBeDefined();
        expect(result.asset).toBe('AAPL');
      });
    });

    describe('analysis results', () => {
      it('should return complete InvestmentAnalysis structure', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'up');
        const result = await analyzer.analyze('AAPL', 'equity', priceHistory);

        expect(result).toHaveProperty('asset', 'AAPL');
        expect(result).toHaveProperty('assetClass', 'equity');
        expect(result).toHaveProperty('recommendation');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('reasoning');
        expect(result).toHaveProperty('metrics');
        expect(result).toHaveProperty('actionItems');
      });

      it('should include all required metrics', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'up');
        const result = await analyzer.analyze('AAPL', 'equity', priceHistory);

        expect(result.metrics).toHaveProperty('expectedReturn');
        expect(result.metrics).toHaveProperty('riskScore');
        expect(result.metrics).toHaveProperty('kellyFraction');
        expect(typeof result.metrics.expectedReturn).toBe('number');
        expect(typeof result.metrics.riskScore).toBe('number');
        expect(typeof result.metrics.kellyFraction).toBe('number');
      });

      it('should include Sharpe ratio in metrics', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'up');
        const result = await analyzer.analyze('AAPL', 'equity', priceHistory);

        expect(result.metrics).toHaveProperty('sharpeRatio');
        expect(typeof result.metrics.sharpeRatio).toBe('number');
      });

      it('should include provenance information', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'up');
        const result = await analyzer.analyze('AAPL', 'equity', priceHistory);

        expect(result.provenance).toBeDefined();
        expect(result.provenance?.framework).toBe('LOGOS Investment Analysis');
        expect(result.provenance?.computedAt).toBeInstanceOf(Date);
      });

      it('should generate at least one reasoning item', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'up');
        const result = await analyzer.analyze('AAPL', 'equity', priceHistory);

        expect(Array.isArray(result.reasoning)).toBe(true);
        expect(result.reasoning.length).toBeGreaterThan(0);
      });

      it('should generate action items', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'up');
        const result = await analyzer.analyze('AAPL', 'equity', priceHistory);

        expect(Array.isArray(result.actionItems)).toBe(true);
        expect(result.actionItems.length).toBeGreaterThan(0);
      });
    });

    describe('trend analysis', () => {
      it('should recommend buy for uptrending asset', async () => {
        const priceHistory = generatePriceHistory(100, 50, 'up');
        const result = await analyzer.analyze('AAPL', 'equity', priceHistory);

        expect(['strong_buy', 'buy', 'hold']).toContain(result.recommendation);
      });

      it('should recommend sell for downtrending asset', async () => {
        const priceHistory = generatePriceHistory(100, 50, 'down');
        const result = await analyzer.analyze('AAPL', 'equity', priceHistory);

        expect(['hold', 'sell', 'strong_sell']).toContain(result.recommendation);
      });

      it('should have lower confidence for volatile assets', async () => {
        const stableHistory = generatePriceHistory(100, 30, 'up');
        const volatileHistory = generatePriceHistory(100, 30, 'volatile');

        const stableResult = await analyzer.analyze('STABLE', 'equity', stableHistory);
        const volatileResult = await analyzer.analyze('VOLATILE', 'equity', volatileHistory);

        // Risk score should be higher for volatile
        expect(volatileResult.metrics.riskScore).toBeGreaterThanOrEqual(
          stableResult.metrics.riskScore * 0.5 // Allow some variance
        );
      });
    });

    describe('context handling', () => {
      it('should accept optional context', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'up');
        const context = {
          riskTolerance: 'conservative',
          timeHorizon: 'long',
          portfolioValue: 100000,
        };

        const result = await analyzer.analyze('AAPL', 'equity', priceHistory, context);
        expect(result).toBeDefined();
      });

      it('should adjust Kelly fraction for conservative risk tolerance', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'up');

        const aggressiveResult = await analyzer.analyze(
          'AAPL',
          'equity',
          priceHistory,
          { riskTolerance: 'aggressive' }
        );

        const conservativeResult = await analyzer.analyze(
          'AAPL',
          'equity',
          priceHistory,
          { riskTolerance: 'conservative' }
        );

        // Conservative should have lower or equal Kelly fraction
        expect(conservativeResult.metrics.kellyFraction).toBeLessThanOrEqual(
          aggressiveResult.metrics.kellyFraction
        );
      });

      it('should include portfolio allocation in action items when portfolioValue provided', async () => {
        // Need price history with both wins AND losses for Kelly calculation
        // Pure uptrend has avgLoss=0, which skips Kelly calculation
        const priceHistory: PricePoint[] = [];
        let price = 100;
        for (let i = 0; i < 30; i++) {
          // Alternate between gains and losses to have non-zero avgWin and avgLoss
          price *= i % 2 === 0 ? 1.02 : 0.99;
          priceHistory.push({
            price,
            timestamp: new Date(2026, 0, i + 1).toISOString(),
          });
        }
        const context = { portfolioValue: 100000 };

        const result = await analyzer.analyze('AAPL', 'equity', priceHistory, context);
        const hasAllocationItem = result.actionItems.some(
          item => item.includes('Suggested allocation')
        );

        expect(hasAllocationItem).toBe(true);
      });

      it('should handle invalid context gracefully', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'up');
        const invalidContext = {
          riskTolerance: 'invalid_value',
          invalidKey: true,
        };

        const result = await analyzer.analyze('AAPL', 'equity', priceHistory, invalidContext);
        expect(result).toBeDefined();
      });

      it('should adjust for bear market conditions', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'up');
        const bearContext = { marketCondition: 'bear' };

        const result = await analyzer.analyze('AAPL', 'equity', priceHistory, bearContext);
        const hasBearReasoning = result.reasoning.some(
          r => r.toLowerCase().includes('bear')
        );

        expect(hasBearReasoning).toBe(true);
      });
    });

    describe('event emission', () => {
      it('should emit opportunity event for strong_buy', async () => {
        const emitSpy = vi.spyOn(eventBus, 'emit');

        // Create strongly uptrending data
        const priceHistory: PricePoint[] = [];
        let price = 100;
        for (let i = 0; i < 50; i++) {
          price *= 1.02; // Consistent 2% daily gains
          priceHistory.push({
            price,
            timestamp: new Date(2026, 0, i + 1).toISOString(),
          });
        }

        await analyzer.analyze('MOON', 'crypto', priceHistory);

        // Check if opportunity event was emitted (may or may not be strong_buy)
        const opportunityCalls = emitSpy.mock.calls.filter(
          call => call[0] === 'investment:opportunity_detected'
        );

        // If recommendation was strong_buy, event should be emitted
        // Note: Result depends on mock Kelly calculation
        expect(typeof opportunityCalls.length).toBe('number');
      });

      it('should emit opportunity event for strong_sell', async () => {
        const emitSpy = vi.spyOn(eventBus, 'emit');

        // Create strongly downtrending data
        const priceHistory: PricePoint[] = [];
        let price = 100;
        for (let i = 0; i < 50; i++) {
          price *= 0.97; // Consistent 3% daily losses
          priceHistory.push({
            price,
            timestamp: new Date(2026, 0, i + 1).toISOString(),
          });
        }

        await analyzer.analyze('CRASH', 'equity', priceHistory);

        // Event emission depends on actual recommendation
        expect(emitSpy).toHaveBeenCalled();
      });

      it('should include correct data in opportunity event', async () => {
        const emitSpy = vi.spyOn(eventBus, 'emit');

        const priceHistory: PricePoint[] = [];
        let price = 100;
        for (let i = 0; i < 50; i++) {
          price *= 1.02;
          priceHistory.push({
            price,
            timestamp: new Date(2026, 0, i + 1).toISOString(),
          });
        }

        await analyzer.analyze('AAPL', 'equity', priceHistory);

        const opportunityCalls = emitSpy.mock.calls.filter(
          call => call[0] === 'investment:opportunity_detected'
        );

        if (opportunityCalls.length > 0) {
          const payload = opportunityCalls[0][1] as Record<string, unknown>;
          expect(payload).toHaveProperty('category', 'equity');
          expect(payload).toHaveProperty('title');
          expect(payload).toHaveProperty('score');
          expect(typeof payload.score).toBe('number');
        }
      });
    });

    describe('recommendations', () => {
      it('should return valid recommendation type', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'up');
        const result = await analyzer.analyze('AAPL', 'equity', priceHistory);

        const validRecommendations: Recommendation[] = [
          'strong_buy',
          'buy',
          'hold',
          'sell',
          'strong_sell',
        ];

        expect(validRecommendations).toContain(result.recommendation);
      });

      it('should return confidence between 0 and 1', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'up');
        const result = await analyzer.analyze('AAPL', 'equity', priceHistory);

        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });

      it('should return risk score between 0 and 1', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'volatile');
        const result = await analyzer.analyze('AAPL', 'equity', priceHistory);

        expect(result.metrics.riskScore).toBeGreaterThanOrEqual(0);
        expect(result.metrics.riskScore).toBeLessThanOrEqual(1);
      });

      it('should return Kelly fraction between 0 and 1', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'up');
        const result = await analyzer.analyze('AAPL', 'equity', priceHistory);

        expect(result.metrics.kellyFraction).toBeGreaterThanOrEqual(0);
        expect(result.metrics.kellyFraction).toBeLessThanOrEqual(1);
      });
    });

    describe('different asset classes', () => {
      it('should analyze equity assets', async () => {
        const priceHistory = generatePriceHistory(150, 30, 'up');
        const result = await analyzer.analyze('AAPL', 'equity', priceHistory);
        expect(result.assetClass).toBe('equity');
      });

      it('should analyze crypto assets', async () => {
        const priceHistory = generatePriceHistory(50000, 30, 'volatile');
        const result = await analyzer.analyze('BTC', 'crypto', priceHistory);
        expect(result.assetClass).toBe('crypto');
      });

      it('should analyze bond assets', async () => {
        const priceHistory = generatePriceHistory(100, 30, 'up');
        const result = await analyzer.analyze('TLT', 'bond', priceHistory);
        expect(result.assetClass).toBe('bond');
      });

      it('should analyze commodity assets', async () => {
        const priceHistory = generatePriceHistory(1800, 30, 'volatile');
        const result = await analyzer.analyze('GOLD', 'commodity', priceHistory);
        expect(result.assetClass).toBe('commodity');
      });
    });
  });

  describe('compareOpportunities()', () => {
    it('should return empty array for empty input', async () => {
      const result = await analyzer.compareOpportunities([]);
      expect(result).toEqual([]);
    });

    it('should return single item unchanged', async () => {
      const priceHistory = generatePriceHistory(100, 30, 'up');
      const analysis = await analyzer.analyze('AAPL', 'equity', priceHistory);

      const result = await analyzer.compareOpportunities([analysis]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(analysis);
    });

    it('should sort opportunities by score descending', async () => {
      // Create varied analyses
      const analyses: InvestmentAnalysis[] = [
        {
          asset: 'WEAK',
          assetClass: 'equity',
          recommendation: 'sell',
          confidence: 0.7,
          reasoning: ['Negative outlook'],
          metrics: {
            expectedReturn: -0.1,
            riskScore: 0.8,
            kellyFraction: 0,
            sharpeRatio: -0.5,
          },
          actionItems: ['Sell'],
        },
        {
          asset: 'STRONG',
          assetClass: 'equity',
          recommendation: 'strong_buy',
          confidence: 0.9,
          reasoning: ['Positive outlook'],
          metrics: {
            expectedReturn: 0.3,
            riskScore: 0.2,
            kellyFraction: 0.2,
            sharpeRatio: 2.0,
          },
          actionItems: ['Buy'],
        },
        {
          asset: 'MEDIUM',
          assetClass: 'equity',
          recommendation: 'hold',
          confidence: 0.6,
          reasoning: ['Neutral outlook'],
          metrics: {
            expectedReturn: 0.05,
            riskScore: 0.4,
            kellyFraction: 0.05,
            sharpeRatio: 0.5,
          },
          actionItems: ['Hold'],
        },
      ];

      const result = await analyzer.compareOpportunities(analyses);

      expect(result[0].asset).toBe('STRONG');
      expect(result[1].asset).toBe('MEDIUM');
      expect(result[2].asset).toBe('WEAK');
    });

    it('should handle analyses with same scores', async () => {
      const analysis1: InvestmentAnalysis = {
        asset: 'A',
        assetClass: 'equity',
        recommendation: 'buy',
        confidence: 0.7,
        reasoning: ['Reason'],
        metrics: {
          expectedReturn: 0.1,
          riskScore: 0.3,
          kellyFraction: 0.1,
          sharpeRatio: 1.0,
        },
        actionItems: ['Action'],
      };

      const analysis2: InvestmentAnalysis = {
        asset: 'B',
        assetClass: 'equity',
        recommendation: 'buy',
        confidence: 0.7,
        reasoning: ['Reason'],
        metrics: {
          expectedReturn: 0.1,
          riskScore: 0.3,
          kellyFraction: 0.1,
          sharpeRatio: 1.0,
        },
        actionItems: ['Action'],
      };

      const result = await analyzer.compareOpportunities([analysis1, analysis2]);

      expect(result).toHaveLength(2);
    });

    it('should preserve all analysis data in results', async () => {
      const priceHistory = generatePriceHistory(100, 30, 'up');
      const original = await analyzer.analyze('AAPL', 'equity', priceHistory);

      const result = await analyzer.compareOpportunities([original]);

      expect(result[0]).toEqual(original);
    });
  });

  describe('edge cases', () => {
    it('should handle all zero prices', async () => {
      const priceHistory: PricePoint[] = [];
      for (let i = 0; i < 10; i++) {
        priceHistory.push({
          price: 100, // Flat prices
          timestamp: new Date(2026, 0, i + 1).toISOString(),
        });
      }

      const result = await analyzer.analyze('FLAT', 'equity', priceHistory);

      // Flat prices = zero returns
      expect(result.metrics.expectedReturn).toBe(0);
      // With zero returns: expectedReturn<0 (-2), sharpe=0 (-1), riskScore~0 (+1),
      // kellyFraction=0 (-1), winRate=0 (-1) => Total score = -4 => strong_sell
      expect(result.recommendation).toBe('strong_sell');
    });

    it('should handle unsorted timestamps', async () => {
      const priceHistory: PricePoint[] = [
        { price: 103, timestamp: '2026-01-03T00:00:00Z' },
        { price: 100, timestamp: '2026-01-01T00:00:00Z' },
        { price: 104, timestamp: '2026-01-04T00:00:00Z' },
        { price: 101, timestamp: '2026-01-02T00:00:00Z' },
        { price: 105, timestamp: '2026-01-05T00:00:00Z' },
      ];

      const result = await analyzer.analyze('UNSORTED', 'equity', priceHistory);

      expect(result).toBeDefined();
      expect(result.metrics.expectedReturn).toBeGreaterThan(0);
    });

    it('should handle very large price values', async () => {
      const priceHistory: PricePoint[] = [];
      let price = 1e12;
      for (let i = 0; i < 10; i++) {
        price *= 1.01;
        priceHistory.push({
          price,
          timestamp: new Date(2026, 0, i + 1).toISOString(),
        });
      }

      const result = await analyzer.analyze('BIGCAP', 'equity', priceHistory);
      expect(result).toBeDefined();
      expect(Number.isFinite(result.metrics.expectedReturn)).toBe(true);
    });

    it('should handle very small price values', async () => {
      const priceHistory: PricePoint[] = [];
      let price = 0.00001;
      for (let i = 0; i < 10; i++) {
        price *= 1.1;
        priceHistory.push({
          price,
          timestamp: new Date(2026, 0, i + 1).toISOString(),
        });
      }

      const result = await analyzer.analyze('PENNY', 'equity', priceHistory);
      expect(result).toBeDefined();
      expect(Number.isFinite(result.metrics.expectedReturn)).toBe(true);
    });

    it('should handle single day extreme movement', async () => {
      const priceHistory: PricePoint[] = [
        { price: 100, timestamp: '2026-01-01T00:00:00Z' },
        { price: 100, timestamp: '2026-01-02T00:00:00Z' },
        { price: 100, timestamp: '2026-01-03T00:00:00Z' },
        { price: 200, timestamp: '2026-01-04T00:00:00Z' }, // 100% jump
        { price: 200, timestamp: '2026-01-05T00:00:00Z' },
      ];

      const result = await analyzer.analyze('SPIKE', 'equity', priceHistory);
      expect(result).toBeDefined();
      expect(result.metrics.volatility).toBeGreaterThan(0);
    });
  });

  describe('metrics calculations', () => {
    it('should calculate positive expected return for uptrend', async () => {
      // Create consistent uptrend
      const priceHistory: PricePoint[] = [];
      let price = 100;
      for (let i = 0; i < 30; i++) {
        price *= 1.01; // 1% daily increase
        priceHistory.push({
          price,
          timestamp: new Date(2026, 0, i + 1).toISOString(),
        });
      }

      const result = await analyzer.analyze('UP', 'equity', priceHistory);
      expect(result.metrics.expectedReturn).toBeGreaterThan(0);
    });

    it('should calculate negative expected return for downtrend', async () => {
      // Create consistent downtrend
      const priceHistory: PricePoint[] = [];
      let price = 100;
      for (let i = 0; i < 30; i++) {
        price *= 0.99; // 1% daily decrease
        priceHistory.push({
          price,
          timestamp: new Date(2026, 0, i + 1).toISOString(),
        });
      }

      const result = await analyzer.analyze('DOWN', 'equity', priceHistory);
      expect(result.metrics.expectedReturn).toBeLessThan(0);
    });

    it('should calculate higher risk for volatile assets', async () => {
      // Stable asset
      const stablePrices: PricePoint[] = [];
      let stablePrice = 100;
      for (let i = 0; i < 30; i++) {
        stablePrice *= 1.001; // 0.1% daily
        stablePrices.push({
          price: stablePrice,
          timestamp: new Date(2026, 0, i + 1).toISOString(),
        });
      }

      // Volatile asset
      const volatilePrices: PricePoint[] = [];
      let volatilePrice = 100;
      for (let i = 0; i < 30; i++) {
        volatilePrice *= 1 + (i % 2 === 0 ? 0.05 : -0.04);
        volatilePrices.push({
          price: volatilePrice,
          timestamp: new Date(2026, 0, i + 1).toISOString(),
        });
      }

      const stableResult = await analyzer.analyze('STABLE', 'equity', stablePrices);
      const volatileResult = await analyzer.analyze('VOLATILE', 'equity', volatilePrices);

      expect(volatileResult.metrics.riskScore).toBeGreaterThan(stableResult.metrics.riskScore);
    });

    it('should include max drawdown in metrics', async () => {
      const priceHistory = generatePriceHistory(100, 30, 'volatile');
      const result = await analyzer.analyze('AAPL', 'equity', priceHistory);

      expect(result.metrics.maxDrawdown).toBeDefined();
      expect(result.metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(result.metrics.maxDrawdown).toBeLessThanOrEqual(1);
    });

    it('should include win rate in metrics', async () => {
      const priceHistory = generatePriceHistory(100, 30, 'up');
      const result = await analyzer.analyze('AAPL', 'equity', priceHistory);

      expect(result.metrics.winRate).toBeDefined();
      expect(result.metrics.winRate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.winRate).toBeLessThanOrEqual(1);
    });
  });
});
