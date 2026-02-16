import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OpportunityScanner,
  createOpportunityScanner,
  calculateCompositeScore,
  determineRecommendation,
  validateWeights,
  validateScores,
  registerCategoryScanner,
  unregisterCategoryScanner,
  getCategoryScanner,
  listRegisteredScanners,
  DEFAULT_WEIGHTS,
  DEFAULT_CONFIG,
  ALL_CATEGORIES,
  type OpportunityCategory,
  type ScoredOpportunity,
  type RawOpportunity,
  type ScoringWeights,
  type OpportunityScores,
} from '../../../src/autonomous/opportunity-scanner.js';
import { EventBus } from '../../../src/kernel/event-bus.js';

describe('OpportunityScanner', () => {
  let scanner: OpportunityScanner;
  let eventBus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new EventBus();
    scanner = new OpportunityScanner(eventBus);

    // Clear any registered scanners from previous tests
    for (const category of listRegisteredScanners()) {
      unregisterCategoryScanner(category);
    }
  });

  afterEach(() => {
    // Clean up registered scanners
    for (const category of listRegisteredScanners()) {
      unregisterCategoryScanner(category);
    }
  });

  // =========================================================================
  // CONSTRUCTOR TESTS
  // =========================================================================

  describe('constructor', () => {
    it('should create with default config', () => {
      const s = new OpportunityScanner(eventBus);
      expect(s).toBeDefined();
      const config = s.getConfig();
      expect(config.categories).toEqual(ALL_CATEGORIES);
      expect(config.minScoreThreshold).toBe(30);
      expect(config.maxCachedOpportunities).toBe(100);
    });

    it('should create with custom config', () => {
      const s = new OpportunityScanner(eventBus, {
        categories: ['crypto_investment', 'stock_investment'],
        minScoreThreshold: 50,
        maxCachedOpportunities: 50,
      });

      const config = s.getConfig();
      expect(config.categories).toEqual(['crypto_investment', 'stock_investment']);
      expect(config.minScoreThreshold).toBe(50);
      expect(config.maxCachedOpportunities).toBe(50);
    });

    it('should throw on invalid weights', () => {
      expect(() => new OpportunityScanner(eventBus, {
        weights: {
          roiPotential: 0.5,
          effortRequired: 0.5,
          skillAlignment: 0.5,
          timeToRevenue: 0.5,
          riskLevel: 0.5,
          confidenceLevel: 0.5,
        },
      })).toThrow('Invalid weights: must sum to 1.0');
    });

    it('should accept valid custom weights', () => {
      const customWeights: ScoringWeights = {
        roiPotential: 0.30,
        effortRequired: 0.25,
        skillAlignment: 0.10,
        timeToRevenue: 0.20,
        riskLevel: 0.10,
        confidenceLevel: 0.05,
      };

      const s = new OpportunityScanner(eventBus, { weights: customWeights });
      const config = s.getConfig();
      expect(config.weights.roiPotential).toBe(0.30);
    });
  });

  // =========================================================================
  // WEIGHT VALIDATION TESTS
  // =========================================================================

  describe('validateWeights', () => {
    it('should return true for valid weights summing to 1.0', () => {
      expect(validateWeights(DEFAULT_WEIGHTS)).toBe(true);
    });

    it('should return true for weights within tolerance', () => {
      const weights: ScoringWeights = {
        roiPotential: 0.25,
        effortRequired: 0.2,
        skillAlignment: 0.15,
        timeToRevenue: 0.2,
        riskLevel: 0.1,
        confidenceLevel: 0.1,
      };
      expect(validateWeights(weights)).toBe(true);
    });

    it('should return false for weights not summing to 1.0', () => {
      const weights: ScoringWeights = {
        roiPotential: 0.5,
        effortRequired: 0.5,
        skillAlignment: 0.5,
        timeToRevenue: 0.5,
        riskLevel: 0.5,
        confidenceLevel: 0.5,
      };
      expect(validateWeights(weights)).toBe(false);
    });
  });

  // =========================================================================
  // SCORE VALIDATION TESTS
  // =========================================================================

  describe('validateScores', () => {
    it('should return true for valid scores in 0-100 range', () => {
      const scores: OpportunityScores = {
        roiPotential: 80,
        effortRequired: 30,
        skillAlignment: 90,
        timeToRevenue: 70,
        riskLevel: 20,
        confidenceLevel: 85,
      };
      expect(validateScores(scores)).toBe(true);
    });

    it('should return true for boundary values', () => {
      const scores: OpportunityScores = {
        roiPotential: 0,
        effortRequired: 100,
        skillAlignment: 50,
        timeToRevenue: 0,
        riskLevel: 100,
        confidenceLevel: 0,
      };
      expect(validateScores(scores)).toBe(true);
    });

    it('should return false for scores below 0', () => {
      const scores: OpportunityScores = {
        roiPotential: -10,
        effortRequired: 30,
        skillAlignment: 90,
        timeToRevenue: 70,
        riskLevel: 20,
        confidenceLevel: 85,
      };
      expect(validateScores(scores)).toBe(false);
    });

    it('should return false for scores above 100', () => {
      const scores: OpportunityScores = {
        roiPotential: 150,
        effortRequired: 30,
        skillAlignment: 90,
        timeToRevenue: 70,
        riskLevel: 20,
        confidenceLevel: 85,
      };
      expect(validateScores(scores)).toBe(false);
    });
  });

  // =========================================================================
  // COMPOSITE SCORE CALCULATION TESTS
  // =========================================================================

  describe('calculateCompositeScore', () => {
    it('should calculate composite score with default weights', () => {
      const scores: OpportunityScores = {
        roiPotential: 80,
        effortRequired: 20, // Low effort = good
        skillAlignment: 90,
        timeToRevenue: 80,
        riskLevel: 10, // Low risk = good
        confidenceLevel: 85,
      };

      const composite = calculateCompositeScore(scores);
      expect(composite).toBeGreaterThan(80);
      expect(composite).toBeLessThanOrEqual(100);
    });

    it('should invert effort and risk scores', () => {
      // High effort, high risk should result in lower score
      const badScores: OpportunityScores = {
        roiPotential: 80,
        effortRequired: 90, // High effort = bad
        skillAlignment: 80,
        timeToRevenue: 80,
        riskLevel: 90, // High risk = bad
        confidenceLevel: 80,
      };

      const goodScores: OpportunityScores = {
        roiPotential: 80,
        effortRequired: 10, // Low effort = good
        skillAlignment: 80,
        timeToRevenue: 80,
        riskLevel: 10, // Low risk = good
        confidenceLevel: 80,
      };

      const badComposite = calculateCompositeScore(badScores);
      const goodComposite = calculateCompositeScore(goodScores);

      expect(goodComposite).toBeGreaterThan(badComposite);
    });

    it('should throw for invalid scores', () => {
      const scores: OpportunityScores = {
        roiPotential: 150, // Invalid
        effortRequired: 30,
        skillAlignment: 90,
        timeToRevenue: 70,
        riskLevel: 20,
        confidenceLevel: 85,
      };

      expect(() => calculateCompositeScore(scores)).toThrow('Scores must be in 0-100 range');
    });

    it('should throw for invalid weights', () => {
      const scores: OpportunityScores = {
        roiPotential: 80,
        effortRequired: 30,
        skillAlignment: 90,
        timeToRevenue: 70,
        riskLevel: 20,
        confidenceLevel: 85,
      };

      const badWeights: ScoringWeights = {
        roiPotential: 0.5,
        effortRequired: 0.5,
        skillAlignment: 0.5,
        timeToRevenue: 0.5,
        riskLevel: 0.5,
        confidenceLevel: 0.5,
      };

      expect(() => calculateCompositeScore(scores, badWeights)).toThrow('Weights must sum to 1.0');
    });

    it('should calculate perfect score as 100', () => {
      const perfectScores: OpportunityScores = {
        roiPotential: 100,
        effortRequired: 0, // No effort
        skillAlignment: 100,
        timeToRevenue: 100,
        riskLevel: 0, // No risk
        confidenceLevel: 100,
      };

      const composite = calculateCompositeScore(perfectScores);
      expect(composite).toBe(100);
    });

    it('should calculate worst score as 0', () => {
      const worstScores: OpportunityScores = {
        roiPotential: 0,
        effortRequired: 100, // Max effort
        skillAlignment: 0,
        timeToRevenue: 0,
        riskLevel: 100, // Max risk
        confidenceLevel: 0,
      };

      const composite = calculateCompositeScore(worstScores);
      expect(composite).toBe(0);
    });
  });

  // =========================================================================
  // RECOMMENDATION DETERMINATION TESTS
  // =========================================================================

  describe('determineRecommendation', () => {
    it('should return strong_buy for scores >= 80', () => {
      expect(determineRecommendation(80)).toBe('strong_buy');
      expect(determineRecommendation(90)).toBe('strong_buy');
      expect(determineRecommendation(100)).toBe('strong_buy');
    });

    it('should return buy for scores >= 60 and < 80', () => {
      expect(determineRecommendation(60)).toBe('buy');
      expect(determineRecommendation(70)).toBe('buy');
      expect(determineRecommendation(79.99)).toBe('buy');
    });

    it('should return watch for scores >= 40 and < 60', () => {
      expect(determineRecommendation(40)).toBe('watch');
      expect(determineRecommendation(50)).toBe('watch');
      expect(determineRecommendation(59.99)).toBe('watch');
    });

    it('should return pass for scores < 40', () => {
      expect(determineRecommendation(0)).toBe('pass');
      expect(determineRecommendation(20)).toBe('pass');
      expect(determineRecommendation(39.99)).toBe('pass');
    });
  });

  // =========================================================================
  // CATEGORY SCANNER REGISTRY TESTS
  // =========================================================================

  describe('categoryScannersRegistry', () => {
    it('should register a scanner', () => {
      const mockScanner = vi.fn().mockResolvedValue([]);
      registerCategoryScanner('crypto_investment', mockScanner);

      expect(getCategoryScanner('crypto_investment')).toBe(mockScanner);
    });

    it('should list registered scanners', () => {
      registerCategoryScanner('crypto_investment', vi.fn());
      registerCategoryScanner('stock_investment', vi.fn());

      const registered = listRegisteredScanners();
      expect(registered).toContain('crypto_investment');
      expect(registered).toContain('stock_investment');
    });

    it('should unregister a scanner', () => {
      registerCategoryScanner('crypto_investment', vi.fn());
      expect(getCategoryScanner('crypto_investment')).toBeDefined();

      const removed = unregisterCategoryScanner('crypto_investment');
      expect(removed).toBe(true);
      expect(getCategoryScanner('crypto_investment')).toBeUndefined();
    });

    it('should return false when unregistering non-existent scanner', () => {
      const removed = unregisterCategoryScanner('freelance_gig');
      expect(removed).toBe(false);
    });
  });

  // =========================================================================
  // SCORE OPPORTUNITY TESTS
  // =========================================================================

  describe('scoreOpportunity', () => {
    it('should score a raw opportunity', () => {
      const raw = {
        category: 'crypto_investment' as OpportunityCategory,
        title: 'Bitcoin Dip',
        description: 'BTC dropped 10%',
        source: 'CoinGecko',
        sourceUrl: 'https://coingecko.com',
        scores: {
          roiPotential: 85,
          effortRequired: 20,
          skillAlignment: 75,
          timeToRevenue: 60,
          riskLevel: 40,
          confidenceLevel: 70,
        },
        actionItems: ['Buy BTC', 'Set stop-loss'],
        timeframe: 'this_week' as const,
      };

      const scored = scanner.scoreOpportunity(raw);

      expect(scored.id).toBeDefined();
      expect(scored.compositeScore).toBeGreaterThan(0);
      expect(scored.recommendation).toBeDefined();
      expect(scored.discoveredAt).toBeInstanceOf(Date);
      expect(scored.title).toBe('Bitcoin Dip');
    });

    it('should assign correct recommendation based on score', () => {
      const highScoreRaw = {
        category: 'freelance_gig' as OpportunityCategory,
        title: 'High Score Opportunity',
        description: 'Great opportunity',
        source: 'Test',
        scores: {
          roiPotential: 95,
          effortRequired: 10,
          skillAlignment: 95,
          timeToRevenue: 90,
          riskLevel: 5,
          confidenceLevel: 95,
        },
        actionItems: [],
        timeframe: 'immediate' as const,
      };

      const scored = scanner.scoreOpportunity(highScoreRaw);
      expect(scored.recommendation).toBe('strong_buy');
    });
  });

  // =========================================================================
  // SCAN CATEGORY TESTS
  // =========================================================================

  describe('scanCategory', () => {
    it('should return empty array if no scanner registered', async () => {
      const results = await scanner.scanCategory('crypto_investment');
      expect(results).toEqual([]);
    });

    it('should scan using registered scanner', async () => {
      const mockOpportunities: RawOpportunity[] = [
        {
          category: 'crypto_investment',
          title: 'ETH Opportunity',
          description: 'Ethereum undervalued',
          source: 'Analysis',
          scores: {
            roiPotential: 70,
            effortRequired: 30,
            skillAlignment: 80,
            timeToRevenue: 60,
            riskLevel: 40,
            confidenceLevel: 75,
          },
          actionItems: ['Research', 'Buy'],
          timeframe: 'this_week',
        },
      ];

      registerCategoryScanner('crypto_investment', vi.fn().mockResolvedValue(mockOpportunities));

      const results = await scanner.scanCategory('crypto_investment');

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('ETH Opportunity');
      expect(results[0].compositeScore).toBeGreaterThan(0);
    });

    it('should filter out opportunities below threshold', async () => {
      const mockOpportunities: RawOpportunity[] = [
        {
          category: 'crypto_investment',
          title: 'Low Score Opportunity',
          description: 'Not great',
          source: 'Test',
          scores: {
            roiPotential: 10,
            effortRequired: 90,
            skillAlignment: 10,
            timeToRevenue: 10,
            riskLevel: 90,
            confidenceLevel: 10,
          },
          actionItems: [],
          timeframe: 'long_term',
        },
      ];

      registerCategoryScanner('crypto_investment', vi.fn().mockResolvedValue(mockOpportunities));

      const results = await scanner.scanCategory('crypto_investment');
      expect(results.length).toBe(0);
    });

    it('should emit investment:opportunity_detected event', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      const mockOpportunities: RawOpportunity[] = [
        {
          category: 'freelance_gig',
          title: 'Web Dev Gig',
          description: 'Build a website',
          source: 'Upwork',
          scores: {
            roiPotential: 80,
            effortRequired: 30,
            skillAlignment: 90,
            timeToRevenue: 85,
            riskLevel: 20,
            confidenceLevel: 80,
          },
          actionItems: ['Apply'],
          timeframe: 'immediate',
        },
      ];

      registerCategoryScanner('freelance_gig', vi.fn().mockResolvedValue(mockOpportunities));

      await scanner.scanCategory('freelance_gig');

      expect(emitSpy).toHaveBeenCalledWith(
        'investment:opportunity_detected',
        expect.objectContaining({
          category: 'freelance_gig',
          title: 'Web Dev Gig',
        })
      );
    });

    it('should handle scanner errors gracefully', async () => {
      registerCategoryScanner('crypto_investment', vi.fn().mockRejectedValue(new Error('API Error')));

      const results = await scanner.scanCategory('crypto_investment');
      expect(results).toEqual([]);
    });
  });

  // =========================================================================
  // SCAN ALL TESTS
  // =========================================================================

  describe('scanAll', () => {
    it('should scan all configured categories', async () => {
      const cryptoOpps: RawOpportunity[] = [
        {
          category: 'crypto_investment',
          title: 'Crypto Opp',
          description: 'Desc',
          source: 'Src',
          scores: {
            roiPotential: 70,
            effortRequired: 30,
            skillAlignment: 80,
            timeToRevenue: 60,
            riskLevel: 30,
            confidenceLevel: 75,
          },
          actionItems: [],
          timeframe: 'this_week',
        },
      ];

      const stockOpps: RawOpportunity[] = [
        {
          category: 'stock_investment',
          title: 'Stock Opp',
          description: 'Desc',
          source: 'Src',
          scores: {
            roiPotential: 65,
            effortRequired: 40,
            skillAlignment: 70,
            timeToRevenue: 50,
            riskLevel: 35,
            confidenceLevel: 70,
          },
          actionItems: [],
          timeframe: 'this_month',
        },
      ];

      registerCategoryScanner('crypto_investment', vi.fn().mockResolvedValue(cryptoOpps));
      registerCategoryScanner('stock_investment', vi.fn().mockResolvedValue(stockOpps));

      const results = await scanner.scanAll();

      expect(results.length).toBe(2);
      // Should be sorted by composite score
      expect(results[0].compositeScore).toBeGreaterThanOrEqual(results[1].compositeScore);
    });

    it('should skip if scan already in progress', async () => {
      registerCategoryScanner('crypto_investment', vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return [];
      }));

      // Start first scan
      const scan1 = scanner.scanAll();

      // Try to start second scan immediately
      const scan2 = scanner.scanAll();

      const [results1, results2] = await Promise.all([scan1, scan2]);

      // First scan runs, second returns empty
      expect(results2).toEqual([]);
    });

    it('should emit audit:log event after scan', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await scanner.scanAll();

      expect(emitSpy).toHaveBeenCalledWith(
        'audit:log',
        expect.objectContaining({
          action: 'opportunity:scan_complete',
          agent: 'SCANNER',
        })
      );
    });
  });

  // =========================================================================
  // OPPORTUNITY RETRIEVAL TESTS
  // =========================================================================

  describe('opportunity retrieval', () => {
    beforeEach(async () => {
      const mockOpportunities: RawOpportunity[] = [
        {
          category: 'crypto_investment',
          title: 'High Score',
          description: 'Desc',
          source: 'Src',
          scores: {
            roiPotential: 90,
            effortRequired: 10,
            skillAlignment: 90,
            timeToRevenue: 90,
            riskLevel: 10,
            confidenceLevel: 90,
          },
          actionItems: [],
          timeframe: 'immediate',
        },
        {
          category: 'freelance_gig',
          title: 'Medium Score',
          description: 'Desc',
          source: 'Src',
          scores: {
            roiPotential: 60,
            effortRequired: 40,
            skillAlignment: 60,
            timeToRevenue: 60,
            riskLevel: 40,
            confidenceLevel: 60,
          },
          actionItems: [],
          timeframe: 'this_week',
        },
        {
          category: 'crypto_investment',
          title: 'Low Score',
          description: 'Desc',
          source: 'Src',
          scores: {
            roiPotential: 40,
            effortRequired: 60,
            skillAlignment: 40,
            timeToRevenue: 40,
            riskLevel: 60,
            confidenceLevel: 40,
          },
          actionItems: [],
          timeframe: 'long_term',
        },
      ];

      registerCategoryScanner('crypto_investment', vi.fn().mockResolvedValue(
        mockOpportunities.filter(o => o.category === 'crypto_investment')
      ));
      registerCategoryScanner('freelance_gig', vi.fn().mockResolvedValue(
        mockOpportunities.filter(o => o.category === 'freelance_gig')
      ));

      await scanner.scanAll();
    });

    it('should get top opportunities sorted by score', () => {
      const top = scanner.getTopOpportunities(2);

      expect(top.length).toBe(2);
      expect(top[0].title).toBe('High Score');
      expect(top[0].compositeScore).toBeGreaterThan(top[1].compositeScore);
    });

    it('should get opportunities by category', () => {
      const crypto = scanner.getOpportunitiesByCategory('crypto_investment');

      expect(crypto.length).toBe(2);
      expect(crypto.every(o => o.category === 'crypto_investment')).toBe(true);
    });

    it('should get opportunities by recommendation', () => {
      const strongBuys = scanner.getOpportunitiesByRecommendation('strong_buy');
      const watches = scanner.getOpportunitiesByRecommendation('watch');

      expect(strongBuys.every(o => o.recommendation === 'strong_buy')).toBe(true);
      expect(watches.every(o => o.recommendation === 'watch')).toBe(true);
    });

    it('should get all opportunities', () => {
      const all = scanner.getAllOpportunities();
      expect(all.length).toBe(3);
    });

    it('should get opportunity by ID', () => {
      const all = scanner.getAllOpportunities();
      const first = all[0];

      const retrieved = scanner.getOpportunity(first.id);
      expect(retrieved).toEqual(first);
    });

    it('should return undefined for non-existent ID', () => {
      const retrieved = scanner.getOpportunity('non-existent-id');
      expect(retrieved).toBeUndefined();
    });
  });

  // =========================================================================
  // CACHE MANAGEMENT TESTS
  // =========================================================================

  describe('cache management', () => {
    it('should enforce max cache size', async () => {
      const s = new OpportunityScanner(eventBus, { maxCachedOpportunities: 2 });

      const mockOpportunities: RawOpportunity[] = [
        {
          category: 'crypto_investment',
          title: 'Opp 1',
          description: 'Desc',
          source: 'Src',
          scores: { roiPotential: 90, effortRequired: 10, skillAlignment: 90, timeToRevenue: 90, riskLevel: 10, confidenceLevel: 90 },
          actionItems: [],
          timeframe: 'immediate',
        },
        {
          category: 'crypto_investment',
          title: 'Opp 2',
          description: 'Desc',
          source: 'Src',
          scores: { roiPotential: 80, effortRequired: 20, skillAlignment: 80, timeToRevenue: 80, riskLevel: 20, confidenceLevel: 80 },
          actionItems: [],
          timeframe: 'this_week',
        },
        {
          category: 'crypto_investment',
          title: 'Opp 3',
          description: 'Desc',
          source: 'Src',
          scores: { roiPotential: 70, effortRequired: 30, skillAlignment: 70, timeToRevenue: 70, riskLevel: 30, confidenceLevel: 70 },
          actionItems: [],
          timeframe: 'this_month',
        },
      ];

      registerCategoryScanner('crypto_investment', vi.fn().mockResolvedValue(mockOpportunities));

      await s.scanAll();

      const all = s.getAllOpportunities();
      expect(all.length).toBe(2);
      // When at capacity, the CURRENT lowest is evicted when adding a new one.
      // Order: Add Opp1 (90), Add Opp2 (80), Add Opp3 (70) triggers eviction.
      // At eviction: cache has [Opp1:90, Opp2:80], we evict Opp2 (lowest), add Opp3.
      // Result: [Opp1:90, Opp3:70] - Opp2 was evicted.
      expect(all.find(o => o.title === 'Opp 2')).toBeUndefined();
    });

    it('should clear cache', async () => {
      const mockOpportunities: RawOpportunity[] = [
        {
          category: 'crypto_investment',
          title: 'Opp',
          description: 'Desc',
          source: 'Src',
          scores: { roiPotential: 70, effortRequired: 30, skillAlignment: 70, timeToRevenue: 70, riskLevel: 30, confidenceLevel: 70 },
          actionItems: [],
          timeframe: 'immediate',
        },
      ];

      registerCategoryScanner('crypto_investment', vi.fn().mockResolvedValue(mockOpportunities));
      await scanner.scanAll();

      expect(scanner.getAllOpportunities().length).toBe(1);

      scanner.clearCache();

      expect(scanner.getAllOpportunities().length).toBe(0);
    });

    it('should prune expired opportunities', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-16T12:00:00Z'));

      const mockOpportunities: RawOpportunity[] = [
        {
          category: 'crypto_investment',
          title: 'Expired',
          description: 'Desc',
          source: 'Src',
          scores: { roiPotential: 70, effortRequired: 30, skillAlignment: 70, timeToRevenue: 70, riskLevel: 30, confidenceLevel: 70 },
          actionItems: [],
          timeframe: 'immediate',
          expiresAt: new Date('2026-02-15T12:00:00Z'), // Yesterday
        },
        {
          category: 'crypto_investment',
          title: 'Valid',
          description: 'Desc',
          source: 'Src',
          scores: { roiPotential: 70, effortRequired: 30, skillAlignment: 70, timeToRevenue: 70, riskLevel: 30, confidenceLevel: 70 },
          actionItems: [],
          timeframe: 'this_week',
          expiresAt: new Date('2026-02-20T12:00:00Z'), // Future
        },
      ];

      registerCategoryScanner('crypto_investment', vi.fn().mockResolvedValue(mockOpportunities));
      await scanner.scanAll();

      const pruned = scanner.pruneExpired();
      expect(pruned).toBe(1);

      const remaining = scanner.getAllOpportunities();
      expect(remaining.length).toBe(1);
      expect(remaining[0].title).toBe('Valid');

      vi.useRealTimers();
    });

    it('should filter expired from getTopOpportunities', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-16T12:00:00Z'));

      const mockOpportunities: RawOpportunity[] = [
        {
          category: 'crypto_investment',
          title: 'Expired High',
          description: 'Desc',
          source: 'Src',
          scores: { roiPotential: 95, effortRequired: 5, skillAlignment: 95, timeToRevenue: 95, riskLevel: 5, confidenceLevel: 95 },
          actionItems: [],
          timeframe: 'immediate',
          expiresAt: new Date('2026-02-15T12:00:00Z'), // Expired
        },
        {
          category: 'crypto_investment',
          title: 'Valid Low',
          description: 'Desc',
          source: 'Src',
          scores: { roiPotential: 60, effortRequired: 40, skillAlignment: 60, timeToRevenue: 60, riskLevel: 40, confidenceLevel: 60 },
          actionItems: [],
          timeframe: 'this_week',
        },
      ];

      registerCategoryScanner('crypto_investment', vi.fn().mockResolvedValue(mockOpportunities));
      await scanner.scanAll();

      const top = scanner.getTopOpportunities();
      expect(top.length).toBe(1);
      expect(top[0].title).toBe('Valid Low');

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // STATISTICS TESTS
  // =========================================================================

  describe('getStats', () => {
    it('should return accurate statistics', async () => {
      const mockOpportunities: RawOpportunity[] = [
        {
          category: 'crypto_investment',
          title: 'Crypto 1',
          description: 'Desc',
          source: 'Src',
          scores: { roiPotential: 90, effortRequired: 10, skillAlignment: 90, timeToRevenue: 90, riskLevel: 10, confidenceLevel: 90 },
          actionItems: [],
          timeframe: 'immediate',
        },
        {
          category: 'crypto_investment',
          title: 'Crypto 2',
          description: 'Desc',
          source: 'Src',
          scores: { roiPotential: 70, effortRequired: 30, skillAlignment: 70, timeToRevenue: 70, riskLevel: 30, confidenceLevel: 70 },
          actionItems: [],
          timeframe: 'this_week',
        },
        {
          category: 'freelance_gig',
          title: 'Gig 1',
          description: 'Desc',
          source: 'Src',
          scores: { roiPotential: 50, effortRequired: 50, skillAlignment: 50, timeToRevenue: 50, riskLevel: 50, confidenceLevel: 50 },
          actionItems: [],
          timeframe: 'this_month',
        },
      ];

      registerCategoryScanner('crypto_investment', vi.fn().mockResolvedValue(
        mockOpportunities.filter(o => o.category === 'crypto_investment')
      ));
      registerCategoryScanner('freelance_gig', vi.fn().mockResolvedValue(
        mockOpportunities.filter(o => o.category === 'freelance_gig')
      ));

      await scanner.scanAll();

      const stats = scanner.getStats();

      expect(stats.cachedCount).toBe(3);
      expect(stats.lastScanAt).toBeInstanceOf(Date);
      expect(stats.byCategory.crypto_investment).toBe(2);
      expect(stats.byCategory.freelance_gig).toBe(1);
      expect(stats.avgScore).toBeGreaterThan(0);
    });

    it('should return zero average for empty cache', () => {
      const stats = scanner.getStats();

      expect(stats.cachedCount).toBe(0);
      expect(stats.avgScore).toBe(0);
      expect(stats.lastScanAt).toBeNull();
    });
  });

  // =========================================================================
  // CONFIG UPDATE TESTS
  // =========================================================================

  describe('updateConfig', () => {
    it('should update configuration', () => {
      scanner.updateConfig({ minScoreThreshold: 50 });

      const config = scanner.getConfig();
      expect(config.minScoreThreshold).toBe(50);
    });

    it('should throw on invalid weight update', () => {
      expect(() => scanner.updateConfig({
        weights: {
          roiPotential: 0.9,
          effortRequired: 0.9,
          skillAlignment: 0.1,
          timeToRevenue: 0.1,
          riskLevel: 0.1,
          confidenceLevel: 0.1,
        },
      })).toThrow('Invalid weights: must sum to 1.0');
    });
  });

  // =========================================================================
  // FACTORY FUNCTION TESTS
  // =========================================================================

  describe('createOpportunityScanner', () => {
    it('should create scanner instance', () => {
      const s = createOpportunityScanner(eventBus);
      expect(s).toBeInstanceOf(OpportunityScanner);
    });

    it('should create scanner with custom config', () => {
      const s = createOpportunityScanner(eventBus, {
        minScoreThreshold: 60,
      });

      expect(s.getConfig().minScoreThreshold).toBe(60);
    });
  });

  // =========================================================================
  // CONSTANTS TESTS
  // =========================================================================

  describe('constants', () => {
    it('should have valid DEFAULT_WEIGHTS', () => {
      expect(validateWeights(DEFAULT_WEIGHTS)).toBe(true);
    });

    it('should have all 12 categories in ALL_CATEGORIES', () => {
      expect(ALL_CATEGORIES.length).toBe(12);
      expect(ALL_CATEGORIES).toContain('crypto_investment');
      expect(ALL_CATEGORIES).toContain('pokemon_investment');
      expect(ALL_CATEGORIES).toContain('stock_investment');
      expect(ALL_CATEGORIES).toContain('etf_investment');
      expect(ALL_CATEGORIES).toContain('real_estate_trend');
      expect(ALL_CATEGORIES).toContain('saas_idea');
      expect(ALL_CATEGORIES).toContain('freelance_gig');
      expect(ALL_CATEGORIES).toContain('consulting_lead');
      expect(ALL_CATEGORIES).toContain('content_opportunity');
      expect(ALL_CATEGORIES).toContain('career_opportunity');
      expect(ALL_CATEGORIES).toContain('side_project');
      expect(ALL_CATEGORIES).toContain('arbitrage');
    });

    it('should have valid DEFAULT_CONFIG', () => {
      expect(DEFAULT_CONFIG.categories).toEqual(ALL_CATEGORIES);
      expect(DEFAULT_CONFIG.minScoreThreshold).toBe(30);
      expect(DEFAULT_CONFIG.maxCachedOpportunities).toBe(100);
      expect(validateWeights(DEFAULT_CONFIG.weights)).toBe(true);
    });
  });
});
