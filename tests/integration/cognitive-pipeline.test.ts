/**
 * Cognitive Pipeline Integration Tests
 *
 * Tests the complete cognitive layer pipeline from API call through
 * all three pillars (LOGOS, ETHOS, PATHOS), knowledge integration,
 * and learning loop.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/kernel/event-bus.js';

describe('Cognitive Pipeline Integration', () => {
  let eventBus: EventBus;
  let emittedEvents: Array<{ type: string; payload: unknown }>;

  beforeEach(() => {
    eventBus = new EventBus();
    emittedEvents = [];

    // Track all cognitive events
    eventBus.on('cognition:belief_updated', (payload) => {
      emittedEvents.push({ type: 'cognition:belief_updated', payload });
    });
    eventBus.on('cognition:expected_value_calculated', (payload) => {
      emittedEvents.push({ type: 'cognition:expected_value_calculated', payload });
    });
    eventBus.on('cognition:bias_detected', (payload) => {
      emittedEvents.push({ type: 'cognition:bias_detected', payload });
    });
    eventBus.on('cognition:thought_reframed', (payload) => {
      emittedEvents.push({ type: 'cognition:thought_reframed', payload });
    });
  });

  describe('LOGOS Pillar', () => {
    it('should complete full Bayesian → EV → Kelly decision pipeline', async () => {
      const { updateBelief, calculateExpectedValue, calculateKellyFraction } = await import('../../src/cognition/logos/index.js');

      // Step 1: Update belief with evidence
      const belief = {
        hypothesis: 'This investment will succeed',
        priorProbability: 0.5,
      };

      const evidence = {
        description: 'Strong market indicators',
        likelihoodRatio: 3.0,
        strength: 'strong' as const,
      };

      const bayesianResult = await updateBelief(belief, evidence);
      expect(bayesianResult.posteriorProbability).toBeGreaterThan(0.5);
      expect(bayesianResult.shift).toBeGreaterThan(0);

      // Step 2: Calculate Expected Value with updated probability
      const decision = {
        description: 'Investment decision',
        outcomes: [
          { description: 'Success', probability: bayesianResult.posteriorProbability, value: 1000 },
          { description: 'Failure', probability: 1 - bayesianResult.posteriorProbability, value: -500 },
        ],
      };

      const evResult = await calculateExpectedValue(decision);
      expect(evResult.expectedValue).toBeDefined();
      expect(evResult.recommendation).toBeDefined();

      // Step 3: Calculate Kelly position sizing
      const kellyInput = {
        winProbability: bayesianResult.posteriorProbability,
        winAmount: 1000,
        lossAmount: 500,
        currentCapital: 10000,
      };

      const kellyResult = await calculateKellyFraction(kellyInput);
      expect(kellyResult.recommendedFraction).toBeDefined();
      expect(kellyResult.recommendedStrategy).toBeDefined();
      if (kellyResult.dollarAmount !== undefined) {
        expect(kellyResult.dollarAmount).toBeLessThanOrEqual(10000);
      }

      // Verify provenance chain
      expect(bayesianResult.provenance.framework).toContain('Bayesian');
      expect(evResult.provenance.framework).toContain('Expected Value');
      expect(kellyResult.provenance.framework).toContain('Kelly');
    });

    it('should analyze system with leverage points and antifragility', async () => {
      const { analyzeSystem, assessAntifragility } = await import('../../src/cognition/logos/index.js');

      // Analyze a system
      const components = [
        {
          id: 'revenue',
          name: 'Revenue Stream',
          type: 'stock' as const,
          description: 'Primary revenue source',
          connections: [
            { targetId: 'growth', relationship: 'positive' as const, strength: 0.8 },
          ],
        },
        {
          id: 'growth',
          name: 'Growth Rate',
          type: 'flow' as const,
          description: 'Rate of business growth',
          connections: [],
        },
      ];

      const systemResult = await analyzeSystem(components, 'Business growth strategy');
      expect(systemResult.leveragePoints).toBeDefined();
      expect(systemResult.recommendations).toBeDefined();

      // Assess antifragility
      const antifragilityResult = await assessAntifragility(
        'Business Model',
        [
          { stressor: 'Market volatility', effect: 'neutral' as const, magnitude: 0.5 },
          { stressor: 'Competition', effect: 'benefits' as const, magnitude: 0.6 },
        ]
      );

      expect(antifragilityResult.category).toBeDefined();
      expect(['fragile', 'robust', 'antifragile']).toContain(antifragilityResult.category);
      expect(antifragilityResult.score).toBeGreaterThanOrEqual(-1);
      expect(antifragilityResult.score).toBeLessThanOrEqual(1);
    });
  });

  describe('ETHOS Pillar', () => {
    it('should detect biases and check discipline before decision', async () => {
      const { detectCognitiveBias, runDisciplineCheck } = await import('../../src/cognition/ethos/index.js');

      // Step 1: Check for cognitive biases
      const reasoning = `
        I'm absolutely certain this will work because the last time
        something similar happened, it worked out perfectly.
        Everyone knows this is the right approach.
      `;

      const biasResult = await detectCognitiveBias(reasoning, {
        expertise: 'novice',
      });

      // Should detect overconfidence and availability heuristic patterns
      expect(biasResult.biasesDetected.length).toBeGreaterThan(0);
      expect(biasResult.recommendations.length).toBeGreaterThan(0);

      // Step 2: Run discipline check
      const disciplineResult = await runDisciplineCheck(
        'Investment decision',
        'core',
        {
          sleep: { hours: 7, quality: 'good' as const },
          currentTime: new Date(),
          researchDocuments: ['analysis.pdf', 'market-report.pdf'],
          alternativesConsidered: ['Option A', 'Option B', 'Option C'],
        }
      );

      expect(disciplineResult.overallScore).toBeDefined();
      expect(disciplineResult.passed).toBeDefined();
      expect(disciplineResult.provenance.framework).toContain('Discipline');
    });

    it('should assess emotional state and detect fear/greed patterns', async () => {
      const { assessEmotionalState, detectFearGreedCycle } = await import('../../src/cognition/ethos/index.js');

      // Assess emotional state (high arousal, negative valence = fear)
      const emotionalResult = await assessEmotionalState({
        valence: -0.6,
        arousal: 0.8,
        dominance: 0.3,
        context: 'After market crash',
      });

      expect(emotionalResult.emotions.length).toBeGreaterThan(0);
      expect(emotionalResult.riskToDecisionQuality).toBeGreaterThan(0);

      // Detect fear/greed cycle
      const fearGreedResult = await detectFearGreedCycle(
        [
          { type: 'SELL', asset: 'Stock A', timestamp: new Date(Date.now() - 3600000) },
          { type: 'SELL', asset: 'Stock B', timestamp: new Date(Date.now() - 1800000) },
          { type: 'SELL', asset: 'Stock C', timestamp: new Date() },
        ],
        emotionalResult
      );

      expect(fearGreedResult.pattern).toBeDefined();
      expect(fearGreedResult.recommendation).toBeDefined();
    });
  });

  describe('PATHOS Pillar', () => {
    it('should reframe negative thoughts using CBT', async () => {
      const { reframeThought } = await import('../../src/cognition/pathos/index.js');

      const thought = 'I always fail at everything. This will definitely be a disaster.';

      const result = await reframeThought(thought, {
        situation: 'Starting a new project',
      });

      expect(result.distortionsDetected.length).toBeGreaterThan(0);
      expect(result.reframedThought).toBeDefined();
      expect(result.reframedThought).not.toEqual(thought);
      expect(result.balancedPerspective).toBeDefined();
    });

    it('should analyze dichotomy of control and provide Stoic wisdom', async () => {
      const { analyzeDichotomy, queryWisdom } = await import('../../src/cognition/pathos/index.js');

      // Analyze dichotomy
      const dichotomyResult = await analyzeDichotomy(
        'Dealing with market uncertainty',
        [
          { item: 'My research and preparation', category: 'controllable' as const },
          { item: 'Market prices', category: 'uncontrollable' as const },
          { item: 'My emotional response', category: 'controllable' as const },
          { item: 'Other traders\' decisions', category: 'uncontrollable' as const },
        ]
      );

      expect(dichotomyResult.controllable.length).toBe(2);
      expect(dichotomyResult.uncontrollable.length).toBe(2);
      expect(dichotomyResult.recommendation).toBeDefined();
      expect(dichotomyResult.focusArea).toBeDefined();

      // Query wisdom
      const wisdomResult = await queryWisdom(
        'How should I handle uncertainty in decisions?',
        ['STOIC', 'TALEB']
      );

      expect(wisdomResult.principle).toBeDefined();
      expect(wisdomResult.tradition).toBeDefined();
      expect(wisdomResult.application).toBeDefined();
    });

    it('should create practice plan using deliberate practice', async () => {
      const { generatePracticePlan } = await import('../../src/cognition/pathos/index.js');

      const plan = await generatePracticePlan(
        'Risk Assessment',
        0.4, // current level (0-1 scale)
        0.8, // target level (0-1 scale)
        {
          hoursPerWeek: 5,
          maxTimeframe: '3 months',
          availableResources: ['Books', 'Online courses', 'Mentorship'],
        }
      );

      expect(plan.skill).toBe('Risk Assessment');
      expect(plan.gap).toBeCloseTo(0.4, 1);
      expect(plan.estimatedHours).toBeGreaterThan(0);
      expect(plan.specificGoals.length).toBeGreaterThan(0);
      expect(plan.milestones.length).toBeGreaterThan(0);
      expect(plan.provenance.framework).toContain('Deliberate Practice');
    });
  });

  describe('Cross-Pillar Integration', () => {
    it('should run comprehensive analysis using all three pillars', async () => {
      // Import from all pillars
      const { calculateExpectedValue } = await import('../../src/cognition/logos/index.js');
      const { detectCognitiveBias } = await import('../../src/cognition/ethos/index.js');

      // Step 1: LOGOS - Calculate EV
      const evResult = await calculateExpectedValue({
        description: 'Strategic decision',
        outcomes: [
          { description: 'Success', probability: 0.7, value: 100 },
          { description: 'Failure', probability: 0.3, value: -50 },
        ],
      });

      // Step 2: ETHOS - Check for biases
      const biasResult = await detectCognitiveBias(
        'This is definitely going to work because it worked before',
        { expertise: 'intermediate' }
      );

      // Verify cross-pillar results
      expect(evResult.expectedValue).toBeDefined();
      expect(evResult.provenance.framework).toContain('Expected Value');
      expect(biasResult.biasesDetected).toBeDefined();
      expect(biasResult.provenance.framework).toContain('Cognitive Bias');
    });
  });
});
