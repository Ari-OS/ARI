import { describe, it, expect } from 'vitest';
import { evaluateDecisionTree } from '../../../../src/cognition/logos/index.js';

describe('Decision Trees', () => {
  describe('evaluateDecisionTree', () => {
    it('should evaluate a simple decision tree', async () => {
      const tree = {
        id: 'root',
        type: 'decision' as const,
        description: 'Investment decision',
        children: [
          {
            id: 'invest',
            type: 'chance' as const,
            description: 'Invest',
            children: [
              {
                id: 'win',
                type: 'terminal' as const,
                description: 'Win',
                probability: 0.6,
                value: 1000,
              },
              {
                id: 'lose',
                type: 'terminal' as const,
                description: 'Lose',
                probability: 0.4,
                value: -500,
              },
            ],
          },
          {
            id: 'dont_invest',
            type: 'terminal' as const,
            description: 'Do not invest',
            probability: 1,
            value: 0,
          },
        ],
      };

      const result = await evaluateDecisionTree(tree);

      expect(result).toBeDefined();
      expect(result.optimalPath).toBeDefined();
      expect(result.optimalValue).toBeDefined();
    });

    it('should identify optimal path through tree', async () => {
      const tree = {
        id: 'root',
        type: 'decision' as const,
        description: 'Choice',
        children: [
          {
            id: 'high_risk',
            type: 'terminal' as const,
            description: 'High risk option',
            probability: 1,
            value: 100,
          },
          {
            id: 'low_risk',
            type: 'terminal' as const,
            description: 'Low risk option',
            probability: 1,
            value: 50,
          },
        ],
      };

      const result = await evaluateDecisionTree(tree);

      expect(result.optimalPath).toBeDefined();
      expect(result.optimalPath.length).toBeGreaterThan(0);
    });

    it('should handle nested decision nodes', async () => {
      const tree = {
        id: 'root',
        type: 'decision' as const,
        description: 'Strategy decision',
        children: [
          {
            id: 'aggressive',
            type: 'decision' as const,
            description: 'Aggressive strategy',
            children: [
              {
                id: 'all_in',
                type: 'terminal' as const,
                description: 'All in',
                probability: 1,
                value: 200,
              },
              {
                id: 'partial',
                type: 'terminal' as const,
                description: 'Partial investment',
                probability: 1,
                value: 100,
              },
            ],
          },
          {
            id: 'conservative',
            type: 'terminal' as const,
            description: 'Conservative',
            probability: 1,
            value: 30,
          },
        ],
      };

      const result = await evaluateDecisionTree(tree);

      expect(result).toBeDefined();
      expect(result.optimalPath).toBeDefined();
      expect(result.optimalValue).toBeDefined();
    });

    it('should calculate optimal value for chance nodes', async () => {
      const tree = {
        id: 'root',
        type: 'chance' as const,
        description: 'Market outcome',
        children: [
          {
            id: 'bull',
            type: 'terminal' as const,
            description: 'Bull market',
            probability: 0.7,
            value: 500,
          },
          {
            id: 'bear',
            type: 'terminal' as const,
            description: 'Bear market',
            probability: 0.3,
            value: -200,
          },
        ],
      };

      const result = await evaluateDecisionTree(tree);

      // EV = 0.7 * 500 + 0.3 * (-200) = 350 - 60 = 290
      expect(result.optimalValue).toBeCloseTo(290, 0);
    });

    it('should handle single terminal node', async () => {
      const tree = {
        id: 'root',
        type: 'terminal' as const,
        description: 'Simple outcome',
        probability: 1,
        value: 100,
      };

      const result = await evaluateDecisionTree(tree);

      expect(result.optimalValue).toBe(100);
    });

    it('should include provenance information', async () => {
      const tree = {
        id: 'root',
        type: 'terminal' as const,
        description: 'Test',
        probability: 1,
        value: 50,
      };

      const result = await evaluateDecisionTree(tree);

      expect(result.provenance).toBeDefined();
      expect(result.provenance.framework).toContain('Decision Tree');
      expect(result.provenance.computedAt).toBeDefined();
    });

    it('should include all paths in result', async () => {
      const tree = {
        id: 'root',
        type: 'chance' as const,
        description: 'Risk analysis',
        children: [
          {
            id: 'success',
            type: 'terminal' as const,
            description: 'Success',
            probability: 0.5,
            value: 1000,
          },
          {
            id: 'failure',
            type: 'terminal' as const,
            description: 'Failure',
            probability: 0.5,
            value: -800,
          },
        ],
      };

      const result = await evaluateDecisionTree(tree);

      expect(result.allPaths).toBeDefined();
      expect(Array.isArray(result.allPaths)).toBe(true);
    });

    it('should handle zero probability nodes', async () => {
      const tree = {
        id: 'root',
        type: 'chance' as const,
        description: 'Impossible path',
        children: [
          {
            id: 'possible',
            type: 'terminal' as const,
            description: 'Possible',
            probability: 1,
            value: 100,
          },
          {
            id: 'impossible',
            type: 'terminal' as const,
            description: 'Impossible',
            probability: 0,
            value: 1000000,
          },
        ],
      };

      const result = await evaluateDecisionTree(tree);

      // Only the possible outcome counts
      expect(result.optimalValue).toBe(100);
    });

    it('should return root node in result', async () => {
      const tree = {
        id: 'root',
        type: 'terminal' as const,
        description: 'Simple',
        probability: 1,
        value: 50,
      };

      const result = await evaluateDecisionTree(tree);

      expect(result.rootNode).toBeDefined();
      expect(result.rootNode.id).toBe('root');
    });
  });
});
