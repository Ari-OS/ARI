import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { InvestmentAnalyzer } from '../../../src/autonomous/investment-analyzer.js';

describe('InvestmentAnalyzer', () => {
  let eventBus: EventBus;
  let analyzer: InvestmentAnalyzer;

  beforeEach(() => {
    eventBus = new EventBus();
    analyzer = new InvestmentAnalyzer(eventBus);
  });

  describe('calculateSMA', () => {
    it('should calculate simple moving average', () => {
      const prices = [10, 12, 14, 16, 18, 20];
      const sma = analyzer.calculateSMA(prices, 5);

      // Average of last 5: (12 + 14 + 16 + 18 + 20) / 5 = 16
      expect(sma).toBe(16);
    });

    it('should handle period longer than data', () => {
      const prices = [10, 12, 14];
      const sma = analyzer.calculateSMA(prices, 10);

      // Average of all: (10 + 12 + 14) / 3 = 12
      expect(sma).toBe(12);
    });

    it('should handle single price', () => {
      const prices = [100];
      const sma = analyzer.calculateSMA(prices, 20);

      expect(sma).toBe(100);
    });

    it('should calculate correctly for exact period match', () => {
      const prices = [5, 10, 15, 20, 25];
      const sma = analyzer.calculateSMA(prices, 5);

      // (5 + 10 + 15 + 20 + 25) / 5 = 15
      expect(sma).toBe(15);
    });
  });

  describe('detectTrend', () => {
    it('should detect bullish trend', () => {
      const prices = [100, 102, 105, 108, 110, 112, 115, 118, 120, 125];
      const trend = analyzer.detectTrend(prices);

      expect(trend).toBe('bullish');
    });

    it('should detect bearish trend', () => {
      const prices = [125, 120, 118, 115, 112, 110, 108, 105, 102, 100];
      const trend = analyzer.detectTrend(prices);

      expect(trend).toBe('bearish');
    });

    it('should detect neutral trend', () => {
      const prices = [100, 101, 100, 99, 100, 101, 100, 99, 100, 101];
      const trend = analyzer.detectTrend(prices);

      expect(trend).toBe('neutral');
    });

    it('should return neutral for insufficient data', () => {
      const prices = [100];
      const trend = analyzer.detectTrend(prices);

      expect(trend).toBe('neutral');
    });

    it('should detect bullish with > 2% recent change', () => {
      // Recent avg (last 5): 110, Older avg (prev 5): 105
      // Change: (110 - 105) / 105 = 4.76% > 2%
      const prices = [100, 105, 106, 107, 108, 108, 109, 110, 111, 112];
      const trend = analyzer.detectTrend(prices);

      expect(trend).toBe('bullish');
    });

    it('should detect bearish with < -2% recent change', () => {
      // Recent avg (last 5): 105, Older avg (prev 5): 110
      // Change: (105 - 110) / 110 = -4.54% < -2%
      const prices = [112, 111, 110, 109, 108, 108, 107, 106, 105, 100];
      const trend = analyzer.detectTrend(prices);

      expect(trend).toBe('bearish');
    });
  });

  describe('calculateMomentum', () => {
    it('should calculate positive momentum', () => {
      const prices = [100, 102, 105, 108, 110, 112, 115, 118, 120, 125, 130, 135, 140, 145, 150];
      const momentum = analyzer.calculateMomentum(prices, 14);

      // Current: 150, Old (14 periods ago): 100
      // % change: (150 - 100) / 100 = 50%
      // Scaled: 50 * 10 = 500, clamped to 100
      expect(momentum).toBe(100);
    });

    it('should calculate negative momentum', () => {
      const prices = [150, 145, 140, 135, 130, 125, 120, 118, 115, 112, 110, 108, 105, 102, 100];
      const momentum = analyzer.calculateMomentum(prices, 14);

      // Current: 100, Old: 150
      // % change: (100 - 150) / 150 = -33.33%
      // Scaled: -33.33 * 10 = -333.33, clamped to -100
      expect(momentum).toBe(-100);
    });

    it('should return zero for insufficient data', () => {
      const prices = [100, 102, 105];
      const momentum = analyzer.calculateMomentum(prices, 14);

      expect(momentum).toBe(0);
    });

    it('should calculate moderate positive momentum', () => {
      const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 115];
      const momentum = analyzer.calculateMomentum(prices, 14);

      // Current: 115, Old: 100
      // % change: (115 - 100) / 100 = 15%
      // Scaled: 15 * 10 = 150, clamped to 100
      expect(momentum).toBe(100);
    });

    it('should calculate small momentum correctly', () => {
      const prices = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 102];
      const momentum = analyzer.calculateMomentum(prices, 14);

      // Current: 102, Old: 100
      // % change: (102 - 100) / 100 = 2%
      // Scaled: 2 * 10 = 20
      expect(momentum).toBe(20);
    });
  });

  describe('analyzeAsset', () => {
    it('should throw for empty price history', () => {
      expect(() => {
        analyzer.analyzeAsset('BTC', []);
      }).toThrow('Price history cannot be empty');
    });

    it.skip('should analyze bullish asset', () => {
      const history = [
        { price: 100, timestamp: '2024-01-01' },
        { price: 105, timestamp: '2024-01-02' },
        { price: 110, timestamp: '2024-01-03' },
        { price: 115, timestamp: '2024-01-04' },
        { price: 120, timestamp: '2024-01-05' },
        { price: 125, timestamp: '2024-01-06' },
        { price: 130, timestamp: '2024-01-07' },
        { price: 135, timestamp: '2024-01-08' },
        { price: 140, timestamp: '2024-01-09' },
        { price: 145, timestamp: '2024-01-10' },
      ];

      const analysis = analyzer.analyzeAsset('BTC', history);

      expect(analysis.asset).toBe('BTC');
      expect(analysis.technicalSignals.trend).toBe('bullish');
      expect(analysis.technicalSignals.momentum).toBeGreaterThan(0);
      expect(analysis.recommendation.action).toMatch(/buy|watch/);
      expect(analysis.summary).toContain('BTC');
      expect(analysis.summary).toContain('145.00');
    });

    it.skip('should analyze bearish asset', () => {
      const history = [
        { price: 145, timestamp: '2024-01-01' },
        { price: 140, timestamp: '2024-01-02' },
        { price: 135, timestamp: '2024-01-03' },
        { price: 130, timestamp: '2024-01-04' },
        { price: 125, timestamp: '2024-01-05' },
        { price: 120, timestamp: '2024-01-06' },
        { price: 115, timestamp: '2024-01-07' },
        { price: 110, timestamp: '2024-01-08' },
        { price: 105, timestamp: '2024-01-09' },
        { price: 100, timestamp: '2024-01-10' },
      ];

      const analysis = analyzer.analyzeAsset('ETH', history);

      expect(analysis.asset).toBe('ETH');
      expect(analysis.technicalSignals.trend).toBe('bearish');
      expect(analysis.technicalSignals.momentum).toBeLessThan(0);
      expect(analysis.recommendation.action).toMatch(/sell|hold/);
    });

    it('should analyze neutral asset', () => {
      const history = [
        { price: 100, timestamp: '2024-01-01' },
        { price: 101, timestamp: '2024-01-02' },
        { price: 100, timestamp: '2024-01-03' },
        { price: 99, timestamp: '2024-01-04' },
        { price: 100, timestamp: '2024-01-05' },
        { price: 101, timestamp: '2024-01-06' },
        { price: 100, timestamp: '2024-01-07' },
        { price: 99, timestamp: '2024-01-08' },
        { price: 100, timestamp: '2024-01-09' },
        { price: 101, timestamp: '2024-01-10' },
      ];

      const analysis = analyzer.analyzeAsset('SOL', history);

      expect(analysis.technicalSignals.trend).toBe('neutral');
      expect(analysis.recommendation.action).toMatch(/hold|watch/);
    });

    it('should provide risks and catalysts', () => {
      const history = [
        { price: 100, timestamp: '2024-01-01' },
        { price: 110, timestamp: '2024-01-02' },
      ];

      const analysis = analyzer.analyzeAsset('BTC', history);

      expect(analysis.risks.length).toBeGreaterThan(0);
      expect(analysis.catalysts.length).toBeGreaterThan(0);
    });

    it('should infer cryptocurrency asset class', () => {
      const history = [{ price: 100, timestamp: '2024-01-01' }];

      const btc = analyzer.analyzeAsset('BTC', history);
      expect(btc.assetClass).toBe('Cryptocurrency');

      const eth = analyzer.analyzeAsset('ETH', history);
      expect(eth.assetClass).toBe('Cryptocurrency');

      const coin = analyzer.analyzeAsset('DogeCoin', history);
      expect(coin.assetClass).toBe('Cryptocurrency');
    });

    it('should infer collectible asset class', () => {
      const history = [{ price: 500, timestamp: '2024-01-01' }];

      const pokemon = analyzer.analyzeAsset('Charizard Pokemon Card', history);
      expect(pokemon.assetClass).toBe('Collectible');
    });

    it('should infer stock asset class by default', () => {
      const history = [{ price: 150, timestamp: '2024-01-01' }];

      const stock = analyzer.analyzeAsset('AAPL', history);
      expect(stock.assetClass).toBe('Stock/Equity');
    });

    it('should emit audit event', () => {
      let emitted = false;
      eventBus.on('audit:log', () => {
        emitted = true;
      });

      const history = [
        { price: 100, timestamp: '2024-01-01' },
        { price: 105, timestamp: '2024-01-02' },
      ];

      analyzer.analyzeAsset('BTC', history);

      expect(emitted).toBe(true);
    });

    it('should recommend buy for strong bullish with golden cross', () => {
      // Create price history with strong uptrend and golden cross
      const history = Array.from({ length: 60 }, (_, i) => ({
        price: 100 + i * 2, // Strong uptrend
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
      }));

      const analysis = analyzer.analyzeAsset('BTC', history);

      expect(analysis.recommendation.action).toBe('buy');
      expect(analysis.recommendation.confidence).toBeGreaterThan(60);
    });

    it('should recommend sell for strong bearish with death cross', () => {
      // Create price history with strong downtrend
      const history = Array.from({ length: 60 }, (_, i) => ({
        price: 200 - i * 2, // Strong downtrend
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
      }));

      const analysis = analyzer.analyzeAsset('BTC', history);

      expect(analysis.recommendation.action).toBe('sell');
      expect(analysis.recommendation.confidence).toBeGreaterThan(50);
    });
  });
});
