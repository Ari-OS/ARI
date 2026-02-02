import { describe, it, expect } from 'vitest';
import { runDisciplineCheck } from '../../../../src/cognition/ethos/index.js';

describe('Pre-Decision Discipline Check', () => {
  describe('runDisciplineCheck', () => {
    it('should run a full discipline check', async () => {
      const result = await runDisciplineCheck(
        'Major investment decision',
        'test-agent',
        {
          sleep: { hours: 8, quality: 'good' },
          lastMeal: new Date(Date.now() - 2 * 60 * 60 * 1000),
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
          researchDocuments: ['Analysis 1', 'Analysis 2'],
          alternativesConsidered: ['Option A', 'Option B', 'Option C'],
          consultedParties: ['Advisor'],
        }
      );

      expect(result).toBeDefined();
      expect(result.overallScore).toBeDefined();
      expect(result.passed).toBeDefined();
    });

    it('should return pass/fail status', async () => {
      const result = await runDisciplineCheck(
        'Routine task',
        'test-agent',
        {
          sleep: { hours: 8, quality: 'excellent' },
          researchDocuments: ['Doc 1'],
          alternativesConsidered: ['Alt 1', 'Alt 2'],
        }
      );

      expect(typeof result.passed).toBe('boolean');
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });

    it('should calculate physical score', async () => {
      const result = await runDisciplineCheck(
        'Physical check',
        'test-agent',
        {
          sleep: { hours: 4, quality: 'poor' },
        }
      );

      expect(result.physical).toBeDefined();
      expect(result.physical.score).toBeDefined();
      expect(typeof result.physical.score).toBe('number');
    });

    it('should calculate emotional score', async () => {
      const result = await runDisciplineCheck(
        'Emotional check',
        'test-agent',
        {}
      );

      expect(result.emotional).toBeDefined();
      expect(result.emotional.score).toBeDefined();
    });

    it('should calculate timing score', async () => {
      const result = await runDisciplineCheck(
        'Timing check',
        'test-agent',
        {
          deadline: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        }
      );

      expect(result.timing).toBeDefined();
      expect(result.timing.score).toBeDefined();
    });

    it('should calculate preparation score', async () => {
      const result = await runDisciplineCheck(
        'Preparation check',
        'test-agent',
        {
          researchDocuments: [],
          alternativesConsidered: [],
        }
      );

      expect(result.preparation).toBeDefined();
      expect(result.preparation.score).toBeDefined();
    });

    it('should calculate meta score', async () => {
      const result = await runDisciplineCheck(
        'Meta check',
        'test-agent',
        {}
      );

      expect(result.meta).toBeDefined();
      expect(result.meta.score).toBeDefined();
    });

    it('should provide violations list', async () => {
      const result = await runDisciplineCheck(
        'Multiple issues',
        'test-agent',
        {
          sleep: { hours: 3, quality: 'poor' },
        }
      );

      expect(result.violations).toBeDefined();
      expect(Array.isArray(result.violations)).toBe(true);
    });

    it('should provide recommendations', async () => {
      const result = await runDisciplineCheck(
        'Needs improvement',
        'test-agent',
        {}
      );

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should calculate overall score', async () => {
      const result = await runDisciplineCheck(
        'Score test',
        'test-agent',
        {
          sleep: { hours: 7, quality: 'good' },
          researchDocuments: ['Doc'],
          alternativesConsidered: ['Alt 1', 'Alt 2'],
        }
      );

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });

    it('should include provenance information', async () => {
      const result = await runDisciplineCheck(
        'Provenance test',
        'test-agent',
        {}
      );

      expect(result.provenance).toBeDefined();
      expect(result.provenance.framework).toContain('Discipline');
      expect(result.provenance.computedAt).toBeDefined();
    });

    it('should handle minimal input', async () => {
      const result = await runDisciplineCheck(
        'Minimal',
        'test-agent'
      );

      expect(result).toBeDefined();
      expect(result.overallScore).toBeDefined();
    });

    it('should include decision and agent in result', async () => {
      const result = await runDisciplineCheck(
        'Test decision',
        'agent-123',
        {}
      );

      expect(result.decision).toBe('Test decision');
      expect(result.agent).toBe('agent-123');
    });

    it('should determine if should proceed', async () => {
      const result = await runDisciplineCheck(
        'Proceed check',
        'test-agent',
        {
          sleep: { hours: 8, quality: 'excellent' },
          researchDocuments: ['Research 1', 'Research 2'],
          alternativesConsidered: ['Option 1', 'Option 2'],
          consultedParties: ['Expert 1'],
        }
      );

      expect(result.shouldProceed).toBeDefined();
      expect(typeof result.shouldProceed).toBe('boolean');
    });

    it('should provide blockers when applicable', async () => {
      const result = await runDisciplineCheck(
        'Blocker check',
        'test-agent',
        {}
      );

      expect(result.blockers).toBeDefined();
      expect(Array.isArray(result.blockers)).toBe(true);
    });
  });
});
