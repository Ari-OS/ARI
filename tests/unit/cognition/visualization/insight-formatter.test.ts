import { describe, it, expect } from 'vitest';
import {
  formatInsightBlock,
  formatExpectedValueInsight,
  formatBiasInsight,
  formatKellyInsight,
  formatEmotionalInsight,
  formatCBTInsight,
  formatDichotomyInsight,
  formatComprehensiveAnalysis,
  formatLearningProgress,
  formatCognitiveHealth,
} from '../../../../src/cognition/visualization/index.js';

describe('Visualization - Insight Formatter', () => {
  describe('formatInsightBlock', () => {
    it('should format a generic insight block', () => {
      const block = {
        pillar: 'LOGOS' as const,
        framework: 'Test Framework',
        title: 'Test Insight',
        sections: [
          {
            heading: 'Section 1',
            content: 'Content for section 1',
            highlight: 'neutral' as const,
          },
        ],
        recommendation: 'Test recommendation',
        confidence: 0.8,
      };

      const output = formatInsightBlock(block);

      expect(output).toContain('LOGOS');
      expect(output).toContain('Test Framework');
      expect(output).toContain('Test Insight');
      expect(output).toContain('Section 1');
      expect(output).toContain('Content for section 1');
      expect(output).toContain('Test recommendation');
      expect(output).toContain('80%');
    });

    it('should include pillar icons', () => {
      const logosBlock = {
        pillar: 'LOGOS' as const,
        framework: 'Test',
        title: 'Test',
        sections: [],
        recommendation: 'Test',
        confidence: 0.5,
      };

      const output = formatInsightBlock(logosBlock);
      expect(output).toContain('🧠');
    });

    it('should include educational note when provided', () => {
      const block = {
        pillar: 'ETHOS' as const,
        framework: 'Test',
        title: 'Test',
        sections: [],
        recommendation: 'Test',
        confidence: 0.5,
        educationalNote: 'This is an educational note about the framework.',
      };

      const output = formatInsightBlock(block);
      expect(output).toContain('educational note');
    });

    it('should format array content in sections', () => {
      const block = {
        pillar: 'PATHOS' as const,
        framework: 'Test',
        title: 'Test',
        sections: [
          {
            heading: 'List Section',
            content: ['Item 1', 'Item 2', 'Item 3'],
            highlight: 'positive' as const,
          },
        ],
        recommendation: 'Test',
        confidence: 0.7,
      };

      const output = formatInsightBlock(block);
      expect(output).toContain('Item 1');
      expect(output).toContain('Item 2');
      expect(output).toContain('Item 3');
    });
  });

  describe('formatExpectedValueInsight', () => {
    it('should format expected value result', () => {
      const result = {
        decision: 'Test Decision',
        expectedValue: 150,
        variance: 2500,
        standardDeviation: 50,
        coefficientOfVariation: 0.33,
        outcomes: [
          { description: 'Win', probability: 0.6, value: 300 },
          { description: 'Lose', probability: 0.4, value: -75 },
        ],
        bestCase: { description: 'Win', probability: 0.6, value: 300 },
        worstCase: { description: 'Lose', probability: 0.4, value: -75 },
        mostLikelyCase: { description: 'Win', probability: 0.6, value: 300 },
        recommendation: 'PROCEED' as const,
        reasoning: ['Positive EV'],
        confidence: 0.85,
        provenance: {
          framework: 'Expected Value Theory' as const,
          computedAt: new Date(),
        },
      };

      const output = formatExpectedValueInsight(result);

      expect(output).toContain('Expected Value');
      expect(output).toContain('Test Decision');
      expect(output).toContain('LOGOS');
      expect(output).toContain('150');
    });
  });

  describe('formatBiasInsight', () => {
    it('should format bias analysis with no biases', () => {
      const result = {
        reasoning: 'Clean reasoning text',
        biasesDetected: [],
        biasesChecked: ['CONFIRMATION_BIAS', 'SUNK_COST_FALLACY'] as any[],
        overallRisk: 0,
        riskLevel: 'LOW' as const,
        recommendations: ['No biases detected'],
        provenance: {
          framework: 'Cognitive Bias Detection (Kahneman & Tversky)' as const,
          computedAt: new Date(),
        },
      };

      const output = formatBiasInsight(result);

      expect(output).toContain('0 bias');
      expect(output).toContain('ETHOS');
    });

    it('should format bias analysis with detected biases', () => {
      const result = {
        reasoning: 'I definitely knew this would work',
        biasesDetected: [
          {
            type: 'OVERCONFIDENCE' as const,
            detected: true,
            severity: 0.7,
            evidence: ['Found: "definitely"'],
            patterns: [],
            mitigation: 'Assign probabilities',
            source: 'Kahneman',
          },
        ],
        biasesChecked: ['OVERCONFIDENCE'] as any[],
        overallRisk: 0.7,
        riskLevel: 'HIGH' as const,
        recommendations: ['Apply mitigations'],
        provenance: {
          framework: 'Cognitive Bias Detection (Kahneman & Tversky)' as const,
          computedAt: new Date(),
        },
      };

      const output = formatBiasInsight(result);

      expect(output).toContain('1 bias');
      expect(output).toContain('OVERCONFIDENCE');
    });
  });

  describe('formatKellyInsight', () => {
    it('should format Kelly criterion result', () => {
      const result = {
        fullKelly: 0.2,
        halfKelly: 0.1,
        quarterKelly: 0.05,
        recommendedFraction: 0.1,
        recommendedStrategy: 'half' as const,
        edge: 0.2,
        odds: 1,
        expectedGrowthRate: 0.01,
        warnings: ['Using half-Kelly for conservative sizing'],
        dollarAmount: 1000,
        provenance: {
          framework: 'Kelly Criterion (Kelly, 1956)' as const,
          computedAt: new Date(),
        },
      };

      const output = formatKellyInsight(result);

      expect(output).toContain('Kelly');
      expect(output).toContain('LOGOS');
      expect(output).toContain('20');
      expect(output).toContain('half');
    });
  });

  describe('formatEmotionalInsight', () => {
    it('should format emotional state result', () => {
      const result = {
        valence: 0.5,
        arousal: 0.3,
        dominance: 0.7,
        emotions: ['Contentment'],
        primaryEmotion: 'Contentment',
        intensity: 0.3,
        stability: 'stable' as const,
        riskToDecisionQuality: 0.2,
        riskLevel: 'LOW' as const,
        recommendations: [],
        provenance: {
          framework: "Russell's Circumplex Model (VAD)" as const,
          computedAt: new Date(),
        },
      };

      const output = formatEmotionalInsight(result);

      expect(output).toContain('Emotional');
      expect(output).toContain('ETHOS');
      expect(output).toContain('Valence');
    });
  });

  describe('formatCBTInsight', () => {
    it('should format CBT reframe result', () => {
      const result = {
        originalThought: 'I always fail',
        distortionsDetected: [
          {
            type: 'OVERGENERALIZATION' as const,
            severity: 0.6,
            evidence: ['Found: "always"'],
            triggerPhrases: ['always'],
          },
        ],
        primaryDistortion: 'OVERGENERALIZATION' as const,
        reframedThought: 'I sometimes have setbacks',
        balancedPerspective: 'Look at the actual data',
        evidenceFor: [],
        evidenceAgainst: [],
        actionable: 'Count actual instances',
        provenance: {
          framework: 'Cognitive Behavioral Therapy (Beck, 1960s)' as const,
          computedAt: new Date(),
        },
      };

      const output = formatCBTInsight(result);

      expect(output).toContain('Cognitive Behavioral Therapy');
      expect(output).toContain('PATHOS');
      expect(output).toContain('OVERGENERALIZATION');
    });
  });

  describe('formatDichotomyInsight', () => {
    it('should format dichotomy analysis result', () => {
      const result = {
        situation: 'Job interview',
        controllable: [
          {
            item: 'My preparation',
            actionable: 'Study more',
            effort: 0.5,
            impact: 0.8,
            priority: 1,
          },
        ],
        uncontrollable: [
          {
            item: 'Interviewer mood',
            acceptance: 'Accept this is outside control',
            wastedEnergy: 0.7,
          },
        ],
        totalWastedEnergy: 0.7,
        recommendation: 'Focus on preparation',
        focusArea: 'My preparation',
        releaseArea: 'Interviewer mood',
        actionPlan: ['Study'],
        stoicQuote: {
          text: 'Test quote',
          source: 'Epictetus',
          relevance: 'Relevant',
        },
        provenance: {
          framework: 'Dichotomy of Control (Epictetus, ~125 AD)' as const,
          computedAt: new Date(),
        },
      };

      const output = formatDichotomyInsight(result);

      expect(output).toContain('Dichotomy');
      expect(output).toContain('PATHOS');
      expect(output).toContain('preparation');
    });
  });

  describe('formatComprehensiveAnalysis', () => {
    it('should combine multiple pillar results', () => {
      const results = {
        ev: {
          decision: 'Test',
          expectedValue: 100,
          variance: 400,
          standardDeviation: 20,
          coefficientOfVariation: 0.2,
          outcomes: [],
          bestCase: { description: 'Best', probability: 0.5, value: 200 },
          worstCase: { description: 'Worst', probability: 0.5, value: 0 },
          mostLikelyCase: { description: 'Most', probability: 0.5, value: 100 },
          recommendation: 'PROCEED' as const,
          reasoning: [],
          confidence: 0.8,
          provenance: {
            framework: 'Expected Value Theory' as const,
            computedAt: new Date(),
          },
        },
      };

      const output = formatComprehensiveAnalysis(results);

      expect(output).toContain('COMPREHENSIVE');
      expect(output).toContain('SUMMARY');
    });
  });

  describe('formatLearningProgress', () => {
    it('should format learning progress status', () => {
      const status = {
        currentStage: 'PERFORMANCE_REVIEW' as const,
        stageProgress: 0.5,
        lastReview: new Date(),
        lastGapAnalysis: new Date(),
        lastAssessment: new Date(),
        nextReview: new Date(),
        nextGapAnalysis: new Date(),
        nextAssessment: new Date(),
        recentInsights: [],
        recentInsightsCount: 0,
        improvementTrend: 'IMPROVING' as const,
        currentGrade: 'B' as const,
        streakDays: 5,
      };

      const output = formatLearningProgress(status);

      expect(output).toBeDefined();
      expect(typeof output).toBe('string');
    });
  });

  describe('formatCognitiveHealth', () => {
    it('should format cognitive health overview', () => {
      const health = {
        overall: 0.85,
        overallLevel: 'GOOD' as const,
        pillars: [
          {
            pillar: 'LOGOS' as const,
            health: 0.9,
            healthLevel: 'EXCELLENT' as const,
            apisActive: 6,
            apisTotal: 6,
            lastActivity: new Date(),
            topFramework: 'Bayesian',
            frameworkUsage: [
              { framework: 'Bayesian', usageCount: 10, successRate: 0.9 },
            ],
            recentErrors: 0,
          },
        ],
        learningLoopActive: true,
        learningLoopStage: 'PERFORMANCE_REVIEW' as const,
        knowledgeSources: 87,
        knowledgeSourcesActive: 85,
        councilProfilesLoaded: 15,
        lastUpdated: new Date(),
      };

      const output = formatCognitiveHealth(health);

      expect(output).toBeDefined();
      expect(typeof output).toBe('string');
      expect(output).toContain('COGNITIVE LAYER HEALTH');
    });
  });
});
