import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runPerformanceReview,
  runGapAnalysis,
  runSelfAssessment,
  addInsight,
  getRecentInsights,
  getInsightsByType,
  getLearningStatus,
} from '../../../../src/cognition/learning/index.js';

describe('Learning Loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLearningStatus', () => {
    it('should return current learning status', () => {
      const status = getLearningStatus();

      expect(status).toBeDefined();
      expect(status.currentStage).toBeDefined();
      expect(status.lastReview).toBeDefined();
      expect(status.nextReview).toBeDefined();
    });

    it('should include improvement trend', () => {
      const status = getLearningStatus();

      expect(status.improvementTrend).toBeDefined();
      expect(['IMPROVING', 'STABLE', 'DECLINING']).toContain(status.improvementTrend);
    });

    it('should include recent insights', () => {
      const status = getLearningStatus();

      expect(status.recentInsights).toBeDefined();
      expect(Array.isArray(status.recentInsights)).toBe(true);
    });

    it('should include scheduled times', () => {
      const status = getLearningStatus();

      expect(status.nextReview).toBeDefined();
      expect(status.nextGapAnalysis).toBeDefined();
      expect(status.nextAssessment).toBeDefined();
    });
  });

  describe('runPerformanceReview', () => {
    const mockDecisions = [
      {
        id: 'decision-1',
        description: 'Invested in tech stocks',
        outcome: 'success' as const,
        expectedValue: 100,
        actualValue: 120,
        biasesDetected: [],
        emotionalRisk: 0.2,
      },
      {
        id: 'decision-2',
        description: 'Sold bonds early',
        outcome: 'failure' as const,
        expectedValue: 50,
        actualValue: -20,
        biasesDetected: ['OVERCONFIDENCE' as const],
        emotionalRisk: 0.6,
      },
      {
        id: 'decision-3',
        description: 'Held position',
        outcome: 'partial' as const,
        expectedValue: 30,
        actualValue: 25,
        emotionalRisk: 0.3,
      },
    ];

    it('should run a performance review', async () => {
      const result = await runPerformanceReview(mockDecisions);

      expect(result).toBeDefined();
      expect(result.period).toBeDefined();
      expect(result.period.start).toBeDefined();
      expect(result.period.end).toBeDefined();
      expect(result.decisions).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should include decision statistics', async () => {
      const result = await runPerformanceReview(mockDecisions);

      expect(result.decisions).toHaveProperty('total');
      expect(result.decisions).toHaveProperty('successful');
      expect(result.decisions).toHaveProperty('failed');
      expect(typeof result.decisions.total).toBe('number');
    });

    it('should include bias analysis', async () => {
      const result = await runPerformanceReview(mockDecisions);

      expect(result.biasesDetected).toBeDefined();
      expect(result.biasesDetected).toHaveProperty('total');
    });

    it('should generate patterns and insights', async () => {
      const result = await runPerformanceReview(mockDecisions);

      expect(result.patterns).toBeDefined();
      expect(Array.isArray(result.patterns)).toBe(true);
      expect(result.insights).toBeDefined();
      expect(Array.isArray(result.insights)).toBe(true);
    });

    it('should generate recommendations', async () => {
      const result = await runPerformanceReview(mockDecisions);

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('runGapAnalysis', () => {
    const mockQueries = [
      { query: 'What is Bayesian reasoning?', domain: 'LOGOS', answered: true, confidence: 0.9 },
      { query: 'How to detect confirmation bias?', domain: 'ETHOS', answered: true, confidence: 0.8 },
      { query: 'What is antifragility?', domain: 'LOGOS', answered: false },
    ];

    const mockFailures = [
      { description: 'Failed to assess risk properly', domain: 'LOGOS', reason: 'Missing data' },
    ];

    it('should run a gap analysis', async () => {
      const result = await runGapAnalysis(mockQueries, mockFailures);

      expect(result).toBeDefined();
      expect(result.period).toBeDefined();
      expect(result.gaps).toBeDefined();
      expect(Array.isArray(result.gaps)).toBe(true);
      expect(result.timestamp).toBeDefined();
    });

    it('should identify top gaps', async () => {
      const result = await runGapAnalysis(mockQueries, mockFailures);

      expect(result.topGaps).toBeDefined();
      expect(Array.isArray(result.topGaps)).toBe(true);
    });

    it('should generate recommendations', async () => {
      const result = await runGapAnalysis(mockQueries, mockFailures);

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should suggest new sources', async () => {
      const result = await runGapAnalysis(mockQueries, mockFailures);

      expect(result.newSourceSuggestions).toBeDefined();
      expect(Array.isArray(result.newSourceSuggestions)).toBe(true);
    });
  });

  describe('runSelfAssessment', () => {
    const mockCurrentPeriodData = {
      reviews: [],
      gapAnalyses: [],
      decisionsCount: 50,
      successRate: 0.75,
      biasCount: 5,
      insightsGenerated: 10,
    };

    const mockPreviousPeriodData = {
      decisionsCount: 40,
      successRate: 0.70,
      biasCount: 8,
      insightsGenerated: 7,
    };

    it('should run a self-assessment', async () => {
      const result = await runSelfAssessment(mockCurrentPeriodData, mockPreviousPeriodData);

      expect(result).toBeDefined();
      expect(result.period).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should calculate decision quality metrics', async () => {
      const result = await runSelfAssessment(mockCurrentPeriodData, mockPreviousPeriodData);

      expect(result.decisionQuality).toBeDefined();
      expect(result.decisionQuality).toHaveProperty('thisPeriod');
      expect(result.decisionQuality).toHaveProperty('trend');
    });

    it('should track bias reduction', async () => {
      const result = await runSelfAssessment(mockCurrentPeriodData, mockPreviousPeriodData);

      expect(result.biasReduction).toBeDefined();
    });

    it('should measure knowledge growth', async () => {
      const result = await runSelfAssessment(mockCurrentPeriodData, mockPreviousPeriodData);

      expect(result.knowledgeGrowth).toBeDefined();
    });

    it('should calculate learning velocity', async () => {
      const result = await runSelfAssessment(mockCurrentPeriodData, mockPreviousPeriodData);

      expect(result.learningVelocity).toBeDefined();
    });

    it('should evaluate framework effectiveness', async () => {
      const result = await runSelfAssessment(mockCurrentPeriodData, mockPreviousPeriodData);

      expect(result.frameworkEffectiveness).toBeDefined();
      expect(Array.isArray(result.frameworkEffectiveness)).toBe(true);
    });

    it('should provide overall improvement score and grade', async () => {
      const result = await runSelfAssessment(mockCurrentPeriodData, mockPreviousPeriodData);

      expect(result.overallImprovement).toBeDefined();
      expect(typeof result.overallImprovement).toBe('number');
      expect(result.grade).toBeDefined();
      expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade);
    });
  });

  describe('addInsight', () => {
    it('should add a new insight', () => {
      const insight = {
        id: 'test-insight-1',
        type: 'pattern' as const,
        description: 'Test pattern insight',
        evidence: ['Test evidence'],
        confidence: 0.8,
        framework: 'Bayesian',
        priority: 'medium' as const,
        generalizes: false,
        actionable: 'Apply this pattern',
        timestamp: new Date(),
      };

      addInsight(insight);

      const insights = getRecentInsights(10);
      expect(insights.some(i => i.id === 'test-insight-1')).toBe(true);
    });
  });

  describe('getRecentInsights', () => {
    it('should return recent insights', () => {
      const insights = getRecentInsights(10);

      expect(insights).toBeDefined();
      expect(Array.isArray(insights)).toBe(true);
    });

    it('should limit to specified count', () => {
      const insights = getRecentInsights(5);

      expect(insights.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getInsightsByType', () => {
    it('should filter insights by type', () => {
      // First add an insight of known type
      addInsight({
        id: 'test-mistake-1',
        type: 'mistake',
        description: 'Test mistake',
        evidence: [],
        confidence: 0.6,
        framework: 'CBT',
        priority: 'low',
        generalizes: false,
        actionable: 'Avoid this mistake',
        timestamp: new Date(),
      });

      const mistakes = getInsightsByType('mistake');

      expect(Array.isArray(mistakes)).toBe(true);
      // All returned should be of correct type
      for (const insight of mistakes) {
        expect(insight.type).toBe('mistake');
      }
    });
  });
});
