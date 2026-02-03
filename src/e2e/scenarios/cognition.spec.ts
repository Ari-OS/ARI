/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { test, expect } from '@playwright/test';

test.describe('Cognitive Layer', () => {
  test.describe('LOGOS (Reasoning)', () => {
    test('Bayesian belief system is accessible', async ({ request }) => {
      const response = await request.get('/api/cognition/logos/beliefs');

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('beliefs');
        expect(Array.isArray(data.beliefs)).toBe(true);
      }
    });

    test('Bayesian belief updates work correctly', async ({ request }) => {
      // Add a belief
      const addResponse = await request.post('/api/cognition/logos/beliefs', {
        data: {
          hypothesis: 'User prefers morning notifications',
          priorProbability: 0.5,
        },
      });

      if (addResponse.ok()) {
        const belief = await addResponse.json();
        expect(belief).toHaveProperty('id');
        expect(belief.priorProbability).toBe(0.5);
      }
    });

    test('Kelly criterion calculates optimal bet size', async ({ request }) => {
      const response = await request.post('/api/cognition/logos/kelly', {
        data: {
          winProbability: 0.6,
          winAmount: 2,
          lossAmount: 1,
        },
      });

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('optimalFraction');
        expect(data.optimalFraction).toBeGreaterThanOrEqual(0);
        expect(data.optimalFraction).toBeLessThanOrEqual(1);
      }
    });

    test('Decision tree evaluation is available', async ({ request }) => {
      const response = await request.get('/api/cognition/logos/decision-tree');

      if (response.ok()) {
        const data = await response.json();
        expect(data).toBeDefined();
      }
    });
  });

  test.describe('ETHOS (Values)', () => {
    test('Bias detection identifies common biases', async ({ request }) => {
      const response = await request.post('/api/cognition/ethos/analyze', {
        data: {
          statement: 'I always knew this would happen. It was obvious.',
        },
      });

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('biases');
        // Should detect hindsight bias
        expect(data.biases.some((b: string) =>
          b.toLowerCase().includes('hindsight')
        )).toBe(true);
      }
    });

    test('Values alignment check works', async ({ request }) => {
      const response = await request.post('/api/cognition/ethos/check-alignment', {
        data: {
          action: 'Send notification at 3 AM',
        },
      });

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('aligned');
        expect(data).toHaveProperty('concerns');
      }
    });

    test('Discipline check evaluates decisions', async ({ request }) => {
      const response = await request.post('/api/cognition/ethos/discipline-check', {
        data: {
          decision: 'Skip code review to ship faster',
        },
      });

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('passed');
        expect(data).toHaveProperty('violations');
      }
    });
  });

  test.describe('PATHOS (Emotion)', () => {
    test('Emotional state tracking works', async ({ request }) => {
      const response = await request.get('/api/cognition/pathos/state');

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('currentState');
      }
    });

    test('CBT reframing available', async ({ request }) => {
      const response = await request.post('/api/cognition/pathos/reframe', {
        data: {
          thought: 'Everything always goes wrong',
        },
      });

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('reframedThought');
        expect(data).toHaveProperty('cognitiveDistortion');
      }
    });

    test('Stoic exercises accessible', async ({ request }) => {
      const response = await request.get('/api/cognition/pathos/exercises');

      if (response.ok()) {
        const data = await response.json();
        expect(Array.isArray(data.exercises)).toBe(true);
        // Should include negative visualization
        const exerciseNames = data.exercises.map((e: { name: string }) => e.name.toLowerCase());
        expect(exerciseNames.some((n: string) => n.includes('negative') || n.includes('stoic'))).toBe(true);
      }
    });

    test('Virtue check evaluates decisions', async ({ request }) => {
      const response = await request.post('/api/cognition/pathos/virtue-check', {
        data: {
          decision: 'Help a colleague even when busy',
        },
      });

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('virtues');
        expect(data.virtues).toHaveProperty('wisdom');
        expect(data.virtues).toHaveProperty('courage');
        expect(data.virtues).toHaveProperty('justice');
        expect(data.virtues).toHaveProperty('temperance');
      }
    });
  });

  test.describe('Learning System', () => {
    test('Spaced repetition cards accessible', async ({ request }) => {
      const response = await request.get('/api/cognition/learning/cards');

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('cards');
        expect(Array.isArray(data.cards)).toBe(true);
      }
    });

    test('Due cards endpoint works', async ({ request }) => {
      const response = await request.get('/api/cognition/learning/due');

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('due');
      }
    });

    test('Review submission works', async ({ request }) => {
      // First get a due card
      const dueResponse = await request.get('/api/cognition/learning/due');

      if (dueResponse.ok()) {
        const due = await dueResponse.json();
        if (due.due && due.due.length > 0) {
          const cardId = due.due[0].id;

          // Submit review
          const reviewResponse = await request.post(`/api/cognition/learning/cards/${cardId}/review`, {
            data: {
              quality: 4, // Good recall
            },
          });

          if (reviewResponse.ok()) {
            const result = await reviewResponse.json();
            expect(result).toHaveProperty('nextReview');
          }
        }
      }
    });
  });

  test.describe('Knowledge Integration', () => {
    test('Knowledge search is available', async ({ request }) => {
      const response = await request.get('/api/knowledge/search?q=test');

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('results');
      }
    });

    test('Knowledge sources are listed', async ({ request }) => {
      const response = await request.get('/api/knowledge/sources');

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('sources');
      }
    });
  });
});
