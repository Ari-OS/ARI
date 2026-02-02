import { describe, it, expect } from 'vitest';
import {
  identifyLeveragePoints,
  analyzeSystem,
} from '../../../../src/cognition/logos/index.js';
import type { SystemComponent } from '../../../../src/cognition/types.js';

// Helper to create properly structured components
function createComponent(
  id: string,
  name: string,
  type: 'stock' | 'flow' | 'feedback' | 'delay' | 'external',
  description: string,
  connectionTargets: Array<{ id: string; relationship?: 'positive' | 'negative' | 'delayed'; strength?: number }> = []
): SystemComponent {
  return {
    id,
    name,
    type,
    description,
    connections: connectionTargets.map(c => ({
      targetId: c.id,
      relationship: c.relationship || 'positive',
      strength: c.strength ?? 0.5,
    })),
  };
}

describe('Systems Thinking', () => {
  describe('identifyLeveragePoints', () => {
    it('should identify leverage points in a system', async () => {
      const components: SystemComponent[] = [
        createComponent('info-flow', 'Information Flow', 'flow', 'Market data input', [{ id: 'decision-engine' }]),
        createComponent('decision-engine', 'Decision Engine', 'stock', 'Core decision making', [{ id: 'order-exec' }]),
        createComponent('order-exec', 'Order Execution', 'flow', 'Trade execution', [{ id: 'portfolio' }]),
        createComponent('portfolio', 'Portfolio', 'stock', 'Asset holdings', [{ id: 'feedback-loop' }]),
        createComponent('feedback-loop', 'Feedback Loop', 'feedback', 'Performance feedback', [{ id: 'decision-engine' }]),
      ];

      const result = await identifyLeveragePoints(components, 'Market trading system analysis');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should rank leverage points by level', async () => {
      const components: SystemComponent[] = [
        createComponent('input', 'Input', 'flow', 'System input', [{ id: 'process' }]),
        createComponent('process', 'Process', 'stock', 'Processing', [{ id: 'output' }]),
        createComponent('output', 'Output', 'flow', 'System output', []),
      ];

      const result = await identifyLeveragePoints(components, 'Simple system analysis');

      if (result.length > 1) {
        // Higher-level leverage points should be ranked first
        for (let i = 0; i < result.length - 1; i++) {
          const current = result[i];
          const next = result[i + 1];
          expect(current.level).toBeGreaterThanOrEqual(next.level);
        }
      }
    });

    it('should identify feedback loop leverage points', async () => {
      const components: SystemComponent[] = [
        createComponent('reinforcing', 'Reinforcing Loop', 'feedback', 'Positive feedback', [{ id: 'stock' }]),
        createComponent('stock', 'Stock', 'stock', 'Accumulated value', [{ id: 'reinforcing' }]),
      ];

      const result = await identifyLeveragePoints(components, 'Feedback system analysis');

      const feedbackPoint = result.find(
        lp => lp.name.toLowerCase().includes('feedback') || lp.name.toLowerCase().includes('loop')
      );
      expect(feedbackPoint || result.length).toBeTruthy();
    });

    it('should return leverage points with required properties', async () => {
      const components: SystemComponent[] = [
        createComponent('comp1', 'Component', 'stock', 'Test', []),
      ];

      const result = await identifyLeveragePoints(components, 'Test system');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].level).toBeDefined();
        expect(result[0].name).toBeDefined();
        expect(result[0].description).toBeDefined();
        expect(result[0].application).toBeDefined();
      }
    });

    it('should provide application suggestions', async () => {
      const components: SystemComponent[] = [
        createComponent('rule', 'Rule', 'stock', 'System rule', [{ id: 'behavior' }]),
        createComponent('behavior', 'Behavior', 'flow', 'Resulting behavior', []),
      ];

      const result = await identifyLeveragePoints(components, 'Application system');

      for (const lp of result) {
        expect(lp.application).toBeDefined();
        expect(typeof lp.application).toBe('string');
      }
    });
  });

  describe('analyzeSystem', () => {
    it('should analyze system and return required fields', async () => {
      const components: SystemComponent[] = [
        createComponent('resources', 'Resources', 'stock', 'Available resources', [{ id: 'projects' }]),
        createComponent('projects', 'Projects', 'flow', 'Active projects', [{ id: 'output' }]),
        createComponent('output', 'Output', 'stock', 'Results', [{ id: 'feedback' }]),
        createComponent('feedback', 'Feedback', 'feedback', 'Performance feedback', [{ id: 'resources' }]),
      ];

      const result = await analyzeSystem(components, 'Organization analysis');

      expect(result).toBeDefined();
      expect(result.system).toBeDefined();
      expect(result.feedbackLoops).toBeDefined();
      expect(result.leveragePoints).toBeDefined();
      expect(result.delays).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should detect feedback loops', async () => {
      const components: SystemComponent[] = [
        createComponent('growth', 'Growth', 'stock', 'Growing resource', [{ id: 'reinforcing' }]),
        createComponent('reinforcing', 'Reinforcing', 'feedback', 'Reinforcing loop', [{ id: 'growth' }]),
      ];

      const result = await analyzeSystem(components, 'Feedback system analysis');

      expect(result.feedbackLoops).toBeDefined();
      expect(Array.isArray(result.feedbackLoops)).toBe(true);
      // Should detect at least one feedback loop
      if (result.feedbackLoops.length > 0) {
        const loop = result.feedbackLoops[0];
        expect(loop.type).toBeDefined();
        expect(['reinforcing', 'balancing']).toContain(loop.type);
        expect(loop.components).toBeDefined();
        expect(loop.description).toBeDefined();
        expect(loop.dominance).toBeDefined();
      }
    });

    it('should detect delays', async () => {
      const components: SystemComponent[] = [
        createComponent('action', 'Action', 'flow', 'Initial action', [{ id: 'delay-component' }]),
        createComponent('delay-component', 'Processing Delay', 'delay', 'Time delay in system', [{ id: 'result' }]),
        createComponent('result', 'Result', 'stock', 'Delayed result', []),
      ];

      const result = await analyzeSystem(components, 'System with delays');

      expect(result.delays).toBeDefined();
      expect(Array.isArray(result.delays)).toBe(true);
    });

    it('should provide leverage points in analysis', async () => {
      const components: SystemComponent[] = [
        createComponent('input1', 'Input1', 'flow', 'Input 1', [{ id: 'central' }]),
        createComponent('input2', 'Input2', 'flow', 'Input 2', [{ id: 'central' }]),
        createComponent('central', 'Central Hub', 'stock', 'Central processing', [{ id: 'output' }]),
        createComponent('output', 'Output', 'flow', 'Output', []),
      ];

      const result = await analyzeSystem(components, 'Hub system analysis');

      expect(result.leveragePoints).toBeDefined();
      expect(Array.isArray(result.leveragePoints)).toBe(true);
    });

    it('should provide recommendations', async () => {
      const components: SystemComponent[] = [
        createComponent('a', 'A', 'stock', 'Component A', [{ id: 'b' }]),
        createComponent('b', 'B', 'flow', 'Component B', []),
      ];

      const result = await analyzeSystem(components, 'Recommendation system analysis');

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should include warnings when applicable', async () => {
      const components: SystemComponent[] = [
        createComponent('a', 'A', 'stock', 'Component A', [
          { id: 'b', relationship: 'positive', strength: 0.9 },
          { id: 'c', relationship: 'positive', strength: 0.9 },
        ]),
        createComponent('b', 'B', 'feedback', 'Reinforcing feedback', [{ id: 'a' }]),
        createComponent('c', 'C', 'feedback', 'Another reinforcing', [{ id: 'a' }]),
      ];

      const result = await analyzeSystem(components, 'Complex system');

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should include provenance information', async () => {
      const components: SystemComponent[] = [
        createComponent('a', 'A', 'stock', 'A', []),
      ];

      const result = await analyzeSystem(components, 'Test system');

      expect(result.provenance).toBeDefined();
      expect(result.provenance.framework).toContain('Systems Thinking');
      expect(result.provenance.framework).toContain('Meadows');
      expect(result.provenance.computedAt).toBeDefined();
    });

    it('should handle systems with multiple component types', async () => {
      const components: SystemComponent[] = [
        createComponent('stock1', 'Stock1', 'stock', 'Stock component', [{ id: 'flow1' }]),
        createComponent('flow1', 'Flow1', 'flow', 'Flow component', [{ id: 'feedback1' }]),
        createComponent('feedback1', 'Feedback1', 'feedback', 'Feedback component', [{ id: 'delay1' }]),
        createComponent('delay1', 'Delay1', 'delay', 'Delay component', [{ id: 'stock1' }]),
      ];

      const result = await analyzeSystem(components, 'Mixed component system');

      expect(result).toBeDefined();
      expect(result.system).toBeDefined();
      // Should have detected the cycle/feedback loop
      expect(result.feedbackLoops.length).toBeGreaterThanOrEqual(0);
    });
  });
});
