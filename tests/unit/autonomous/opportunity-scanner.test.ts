import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { OpportunityScanner } from '../../../src/autonomous/opportunity-scanner.js';
import type { RawOpportunity, ScoredOpportunity } from '../../../src/autonomous/opportunity-scanner.js';

describe('OpportunityScanner', () => {
  let eventBus: EventBus;
  let scanner: OpportunityScanner;

  beforeEach(() => {
    eventBus = new EventBus();
    scanner = new OpportunityScanner(eventBus);
  });

  describe('scoreOpportunity', () => {
    it('should calculate composite score using weighted formula', () => {
      const raw: RawOpportunity = {
        id: '1',
        category: 'crypto_investment',
        title: 'Bitcoin buy opportunity',
        description: 'BTC at support level',
        source: 'analysis',
        detectedAt: new Date().toISOString(),
        rawData: {},
      };

      const scores = {
        roiPotential: 80,
        effortRequired: 20,  // Low effort (inverted)
        skillAlignment: 70,
        timeToRevenue: 90,
        riskLevel: 30,       // Low risk (inverted)
        confidenceLevel: 75,
      };

      const scored = scanner.scoreOpportunity(raw, scores);

      // Expected: 80*0.25 + (100-20)*0.20 + 70*0.15 + 90*0.20 + (100-30)*0.10 + 75*0.10
      // = 20 + 16 + 10.5 + 18 + 7 + 7.5 = 79
      expect(scored.compositeScore).toBeCloseTo(79, 1);
      expect(scored.recommendation).toBe('strong_buy');
    });

    it('should assign strong_buy for score > 75', () => {
      const raw: RawOpportunity = {
        id: '2',
        category: 'saas_idea',
        title: 'High potential SaaS',
        description: 'Low competition niche',
        source: 'research',
        detectedAt: new Date().toISOString(),
        rawData: {},
      };

      const scores = {
        roiPotential: 90,
        effortRequired: 10,
        skillAlignment: 90,
        timeToRevenue: 80,
        riskLevel: 20,
        confidenceLevel: 80,
      };

      const scored = scanner.scoreOpportunity(raw, scores);
      expect(scored.compositeScore).toBeGreaterThan(75);
      expect(scored.recommendation).toBe('strong_buy');
    });

    it('should assign buy for score 55-75', () => {
      const raw: RawOpportunity = {
        id: '3',
        category: 'freelance_gig',
        title: 'Freelance project',
        description: 'Medium complexity',
        source: 'upwork',
        detectedAt: new Date().toISOString(),
        rawData: {},
      };

      const scores = {
        roiPotential: 60,
        effortRequired: 50,
        skillAlignment: 60,
        timeToRevenue: 70,
        riskLevel: 40,
        confidenceLevel: 60,
      };

      const scored = scanner.scoreOpportunity(raw, scores);
      expect(scored.compositeScore).toBeGreaterThanOrEqual(55);
      expect(scored.compositeScore).toBeLessThanOrEqual(75);
      expect(scored.recommendation).toBe('buy');
    });

    it('should assign watch for score 35-55', () => {
      const raw: RawOpportunity = {
        id: '4',
        category: 'stock_investment',
        title: 'Speculative stock',
        description: 'High risk play',
        source: 'scanner',
        detectedAt: new Date().toISOString(),
        rawData: {},
      };

      const scores = {
        roiPotential: 50,
        effortRequired: 60,
        skillAlignment: 40,
        timeToRevenue: 50,
        riskLevel: 60,
        confidenceLevel: 40,
      };

      const scored = scanner.scoreOpportunity(raw, scores);
      expect(scored.compositeScore).toBeGreaterThanOrEqual(35);
      expect(scored.compositeScore).toBeLessThanOrEqual(55);
      expect(scored.recommendation).toBe('watch');
    });

    it('should assign pass for score <= 35', () => {
      const raw: RawOpportunity = {
        id: '5',
        category: 'side_project',
        title: 'Low ROI project',
        description: 'High effort, low return',
        source: 'idea',
        detectedAt: new Date().toISOString(),
        rawData: {},
      };

      const scores = {
        roiPotential: 20,
        effortRequired: 80,
        skillAlignment: 30,
        timeToRevenue: 20,
        riskLevel: 70,
        confidenceLevel: 30,
      };

      const scored = scanner.scoreOpportunity(raw, scores);
      expect(scored.compositeScore).toBeLessThanOrEqual(35);
      expect(scored.recommendation).toBe('pass');
    });

    it('should assign timeframe based on timeToRevenue', () => {
      const raw: RawOpportunity = {
        id: '6',
        category: 'arbitrage',
        title: 'Quick arbitrage',
        description: 'Price differential',
        source: 'monitor',
        detectedAt: new Date().toISOString(),
        rawData: {},
      };

      // Immediate: timeToRevenue > 75
      const immediate = scanner.scoreOpportunity(raw, {
        roiPotential: 80, effortRequired: 20, skillAlignment: 70,
        timeToRevenue: 90, riskLevel: 30, confidenceLevel: 75,
      });
      expect(immediate.timeframe).toBe('immediate');

      // This week: timeToRevenue 50-75
      const thisWeek = scanner.scoreOpportunity(raw, {
        roiPotential: 70, effortRequired: 30, skillAlignment: 60,
        timeToRevenue: 60, riskLevel: 40, confidenceLevel: 65,
      });
      expect(thisWeek.timeframe).toBe('this_week');

      // This month: timeToRevenue 25-50
      const thisMonth = scanner.scoreOpportunity(raw, {
        roiPotential: 60, effortRequired: 40, skillAlignment: 50,
        timeToRevenue: 40, riskLevel: 50, confidenceLevel: 55,
      });
      expect(thisMonth.timeframe).toBe('this_month');

      // Long term: timeToRevenue < 25
      const longTerm = scanner.scoreOpportunity(raw, {
        roiPotential: 50, effortRequired: 50, skillAlignment: 40,
        timeToRevenue: 20, riskLevel: 60, confidenceLevel: 45,
      });
      expect(longTerm.timeframe).toBe('long_term');
    });

    it('should generate action items based on category', () => {
      const crypto: RawOpportunity = {
        id: '7',
        category: 'crypto_investment',
        title: 'ETH opportunity',
        description: 'Strong support',
        source: 'analysis',
        detectedAt: new Date().toISOString(),
        rawData: {},
      };

      const scored = scanner.scoreOpportunity(crypto, {
        roiPotential: 80, effortRequired: 20, skillAlignment: 70,
        timeToRevenue: 80, riskLevel: 30, confidenceLevel: 75,
      });

      expect(scored.actionItems).toContain('Research price history and volume');
      expect(scored.actionItems).toContain('Set price alert and entry point');
    });
  });

  describe('addOpportunity and getOpportunities', () => {
    it('should add opportunities and retrieve them', () => {
      const raw: RawOpportunity = {
        id: '1',
        category: 'crypto_investment',
        title: 'BTC opportunity',
        description: 'Buy signal',
        source: 'scanner',
        detectedAt: new Date().toISOString(),
        rawData: {},
      };

      scanner.addOpportunity(raw);
      const opportunities = scanner.getOpportunities();

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].id).toBe('1');
    });

    it('should not add duplicate opportunities', () => {
      const raw: RawOpportunity = {
        id: '1',
        category: 'crypto_investment',
        title: 'BTC opportunity',
        description: 'Buy signal',
        source: 'scanner',
        detectedAt: new Date().toISOString(),
        rawData: {},
      };

      scanner.addOpportunity(raw);
      scanner.addOpportunity(raw);

      const opportunities = scanner.getOpportunities();
      expect(opportunities).toHaveLength(1);
    });

    it('should filter by category', () => {
      scanner.addOpportunity({
        id: '1', category: 'crypto_investment', title: 'BTC', description: '',
        source: 'scanner', detectedAt: new Date().toISOString(), rawData: {},
      });
      scanner.addOpportunity({
        id: '2', category: 'saas_idea', title: 'SaaS', description: '',
        source: 'ideas', detectedAt: new Date().toISOString(), rawData: {},
      });

      const crypto = scanner.getOpportunities({ category: 'crypto_investment' });
      expect(crypto).toHaveLength(1);
      expect(crypto[0].category).toBe('crypto_investment');
    });

    it('should filter by minimum score', () => {
      scanner.addOpportunity({
        id: '1', category: 'crypto_investment', title: 'High score', description: '',
        source: 'scanner', detectedAt: new Date().toISOString(), rawData: {},
      });
      scanner.addOpportunity({
        id: '2', category: 'saas_idea', title: 'Low score', description: '',
        source: 'ideas', detectedAt: new Date().toISOString(), rawData: {},
      });

      const filtered = scanner.getOpportunities({ minScore: 50 });
      // Note: since we don't score in addOpportunity, all scores are 0
      // In real usage, scoreOpportunity would be called separately
      expect(filtered).toHaveLength(0);
    });

    it('should sort by composite score descending', () => {
      const opp1: RawOpportunity = {
        id: '1', category: 'crypto_investment', title: 'Low', description: '',
        source: 'scanner', detectedAt: new Date().toISOString(), rawData: {},
      };
      const opp2: RawOpportunity = {
        id: '2', category: 'saas_idea', title: 'High', description: '',
        source: 'ideas', detectedAt: new Date().toISOString(), rawData: {},
      };

      // Manually score and add
      const scored1 = scanner.scoreOpportunity(opp1, {
        roiPotential: 40, effortRequired: 60, skillAlignment: 40,
        timeToRevenue: 40, riskLevel: 60, confidenceLevel: 40,
      });
      const scored2 = scanner.scoreOpportunity(opp2, {
        roiPotential: 80, effortRequired: 20, skillAlignment: 80,
        timeToRevenue: 80, riskLevel: 20, confidenceLevel: 80,
      });

      // Simulate adding scored opportunities
      scanner['opportunities'].push(scored1, scored2);

      const sorted = scanner.getOpportunities();
      expect(sorted[0].id).toBe('2'); // Higher score first
      expect(sorted[1].id).toBe('1');
    });
  });

  describe('generateReport', () => {
    it('should generate daily report', () => {
      const opp: RawOpportunity = {
        id: '1', category: 'crypto_investment', title: 'BTC', description: 'Strong buy',
        source: 'scanner', detectedAt: new Date().toISOString(), rawData: {},
      };

      const scored = scanner.scoreOpportunity(opp, {
        roiPotential: 80, effortRequired: 20, skillAlignment: 70,
        timeToRevenue: 80, riskLevel: 30, confidenceLevel: 75,
      });

      scanner['opportunities'].push(scored);

      const report = scanner.generateReport('daily');

      expect(report.period).toBe('daily');
      expect(report.topOpportunities).toHaveLength(1);
      expect(report.byCategory.crypto_investment).toHaveLength(1);
      expect(report.marketSummary).toContain('1 opportunities');
      expect(report.actionPlan.length).toBeGreaterThan(0);
    });

    it('should limit top opportunities to 10', () => {
      // Add 15 opportunities
      for (let i = 0; i < 15; i++) {
        const opp: RawOpportunity = {
          id: String(i), category: 'crypto_investment', title: `Opp ${i}`, description: '',
          source: 'scanner', detectedAt: new Date().toISOString(), rawData: {},
        };
        const scored = scanner.scoreOpportunity(opp, {
          roiPotential: 60, effortRequired: 40, skillAlignment: 50,
          timeToRevenue: 60, riskLevel: 40, confidenceLevel: 60,
        });
        scanner['opportunities'].push(scored);
      }

      const report = scanner.generateReport('weekly');
      expect(report.topOpportunities).toHaveLength(10);
    });

    it('should group by category', () => {
      const crypto: RawOpportunity = {
        id: '1', category: 'crypto_investment', title: 'BTC', description: '',
        source: 'scanner', detectedAt: new Date().toISOString(), rawData: {},
      };
      const saas: RawOpportunity = {
        id: '2', category: 'saas_idea', title: 'SaaS', description: '',
        source: 'ideas', detectedAt: new Date().toISOString(), rawData: {},
      };

      const scored1 = scanner.scoreOpportunity(crypto, {
        roiPotential: 70, effortRequired: 30, skillAlignment: 60,
        timeToRevenue: 70, riskLevel: 30, confidenceLevel: 70,
      });
      const scored2 = scanner.scoreOpportunity(saas, {
        roiPotential: 80, effortRequired: 20, skillAlignment: 80,
        timeToRevenue: 60, riskLevel: 20, confidenceLevel: 80,
      });

      scanner['opportunities'].push(scored1, scored2);

      const report = scanner.generateReport('weekly');
      expect(report.byCategory.crypto_investment).toHaveLength(1);
      expect(report.byCategory.saas_idea).toHaveLength(1);
    });

    it('should generate market summary', () => {
      const opp1 = scanner.scoreOpportunity({
        id: '1', category: 'crypto_investment', title: 'BTC', description: '',
        source: 'scanner', detectedAt: new Date().toISOString(), rawData: {},
      }, {
        roiPotential: 80, effortRequired: 20, skillAlignment: 70,
        timeToRevenue: 80, riskLevel: 30, confidenceLevel: 75,
      });

      scanner['opportunities'].push(opp1);

      const report = scanner.generateReport('daily');
      expect(report.marketSummary).toContain('1 strong buy');
      expect(report.marketSummary).toContain('crypto_investment');
    });

    it('should generate action plan', () => {
      const immediate = scanner.scoreOpportunity({
        id: '1', category: 'arbitrage', title: 'Quick arb', description: '',
        source: 'monitor', detectedAt: new Date().toISOString(), rawData: {},
      }, {
        roiPotential: 90, effortRequired: 10, skillAlignment: 80,
        timeToRevenue: 95, riskLevel: 20, confidenceLevel: 85,
      });

      scanner['opportunities'].push(immediate);

      const report = scanner.generateReport('daily');
      expect(report.actionPlan.some((a) => a.includes('Immediate action'))).toBe(true);
    });
  });

  describe('pruneOld', () => {
    it('should remove opportunities older than maxAgeDays', () => {
      const old = new Date();
      old.setDate(old.getDate() - 10);

      const oldOpp: ScoredOpportunity = {
        id: '1', category: 'crypto_investment', title: 'Old', description: '',
        source: 'scanner', detectedAt: old.toISOString(), rawData: {},
        scores: { roiPotential: 50, effortRequired: 50, skillAlignment: 50, timeToRevenue: 50, riskLevel: 50, confidenceLevel: 50 },
        compositeScore: 50, recommendation: 'watch', actionItems: [], timeframe: 'this_month',
      };

      const recent: ScoredOpportunity = {
        id: '2', category: 'saas_idea', title: 'Recent', description: '',
        source: 'ideas', detectedAt: new Date().toISOString(), rawData: {},
        scores: { roiPotential: 60, effortRequired: 40, skillAlignment: 60, timeToRevenue: 60, riskLevel: 40, confidenceLevel: 60 },
        compositeScore: 60, recommendation: 'buy', actionItems: [], timeframe: 'this_week',
      };

      scanner['opportunities'].push(oldOpp, recent);

      const removed = scanner.pruneOld(7);

      expect(removed).toBe(1);
      expect(scanner.getOpportunities()).toHaveLength(1);
      expect(scanner.getOpportunities()[0].id).toBe('2');
    });

    it('should emit audit event when pruning', () => {
      let emitted = false;
      eventBus.on('audit:log', () => {
        emitted = true;
      });

      const old = new Date();
      old.setDate(old.getDate() - 10);

      const oldOpp: ScoredOpportunity = {
        id: '1', category: 'crypto_investment', title: 'Old', description: '',
        source: 'scanner', detectedAt: old.toISOString(), rawData: {},
        scores: { roiPotential: 50, effortRequired: 50, skillAlignment: 50, timeToRevenue: 50, riskLevel: 50, confidenceLevel: 50 },
        compositeScore: 50, recommendation: 'watch', actionItems: [], timeframe: 'this_month',
      };

      scanner['opportunities'].push(oldOpp);
      scanner.pruneOld(5);

      expect(emitted).toBe(true);
    });

    it('should not emit audit event if nothing pruned', () => {
      let emitted = false;
      eventBus.on('audit:log', () => {
        emitted = true;
      });

      scanner.pruneOld(7);

      expect(emitted).toBe(false);
    });
  });
});
