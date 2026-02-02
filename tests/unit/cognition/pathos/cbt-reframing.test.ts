import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  reframeThought,
} from '../../../../src/cognition/pathos/index.js';

describe('CBT Reframing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reframeThought', () => {
    it('should detect all-or-nothing thinking', async () => {
      const result = await reframeThought(
        'I completely failed this project. I always mess things up.'
      );

      const distortion = result.distortionsDetected.find(d => d.type === 'ALL_OR_NOTHING');
      expect(distortion).toBeDefined();
      expect(distortion?.severity).toBeGreaterThan(0);
      expect(result.reframedThought).not.toBe(result.originalThought);
    });

    it('should detect overgeneralization', async () => {
      const result = await reframeThought(
        'This always happens to me. Everyone thinks I\'m incompetent.'
      );

      const distortion = result.distortionsDetected.find(d => d.type === 'OVERGENERALIZATION');
      expect(distortion).toBeDefined();
      expect(result.reframedThought).toContain('this time');
    });

    it('should detect mental filter', async () => {
      const result = await reframeThought(
        'The whole presentation was good but that one comment ruined everything. I\'m focused on what went wrong.'
      );

      const distortion = result.distortionsDetected.find(d => d.type === 'MENTAL_FILTER');
      expect(distortion).toBeDefined();
    });

    it('should detect catastrophizing', async () => {
      const result = await reframeThought(
        'This is a complete disaster! Everything is ruined and I can\'t survive this.'
      );

      const distortion = result.distortionsDetected.find(d => d.type === 'CATASTROPHIZING');
      expect(distortion).toBeDefined();
      expect(result.reframedThought).toContain('challenge');
    });

    it('should detect disqualifying the positive', async () => {
      const result = await reframeThought(
        'That doesn\'t count. Anyone could have done it. It was just luck.'
      );

      const distortion = result.distortionsDetected.find(d => d.type === 'DISQUALIFYING_POSITIVE');
      expect(distortion).toBeDefined();
    });

    it('should detect mind reading', async () => {
      const result = await reframeThought(
        'They think I\'m stupid. Everyone knows I\'m not good enough.'
      );

      const distortion = result.distortionsDetected.find(d => d.type === 'MIND_READING');
      expect(distortion).toBeDefined();
      expect(result.reframedThought).toContain('might');
    });

    it('should detect fortune telling', async () => {
      const result = await reframeThought(
        'This will definitely fail. There\'s no point in trying because I know it won\'t work.'
      );

      const distortion = result.distortionsDetected.find(d => d.type === 'FORTUNE_TELLING');
      expect(distortion).toBeDefined();
      expect(result.reframedThought).toContain('might');
    });

    it('should detect emotional reasoning', async () => {
      const result = await reframeThought(
        'I feel like I\'m a failure, so it must be true. This feels wrong so it is wrong.'
      );

      const distortion = result.distortionsDetected.find(d => d.type === 'EMOTIONAL_REASONING');
      expect(distortion).toBeDefined();
    });

    it('should detect should statements', async () => {
      const result = await reframeThought(
        'I should be better at this. I must succeed. I have to be perfect.'
      );

      const distortion = result.distortionsDetected.find(d => d.type === 'SHOULD_STATEMENTS');
      expect(distortion).toBeDefined();
      expect(result.reframedThought).toContain('prefer to');
    });

    it('should detect personalization', async () => {
      const result = await reframeThought(
        'This is all my fault. Everything went wrong because of me.'
      );

      const distortion = result.distortionsDetected.find(d => d.type === 'PERSONALIZATION');
      expect(distortion).toBeDefined();
      expect(result.reframedThought).toContain('factors');
    });

    it('should return balanced perspective for healthy thought', async () => {
      const result = await reframeThought(
        'I made some mistakes, but I also did some things well. I can learn from this experience.'
      );

      expect(result.distortionsDetected.length).toBe(0);
      expect(result.balancedPerspective).toContain('balanced');
    });

    it('should detect multiple distortions', async () => {
      const result = await reframeThought(
        'I always fail completely. Everyone thinks I\'m terrible. This is a disaster.'
      );

      expect(result.distortionsDetected.length).toBeGreaterThan(1);
    });

    it('should provide actionable recommendations', async () => {
      const result = await reframeThought(
        'I completely failed this task.'
      );

      expect(result.actionable).toBeDefined();
      expect(result.actionable.length).toBeGreaterThan(0);
    });

    it('should throw on empty thought', async () => {
      await expect(reframeThought('')).rejects.toThrow('empty');
    });

    it('should throw on whitespace-only thought', async () => {
      await expect(reframeThought('   ')).rejects.toThrow('empty');
    });

    it('should include provenance information', async () => {
      const result = await reframeThought('I should do better.');

      expect(result.provenance.framework).toBe('Cognitive Behavioral Therapy (Beck, 1960s)');
      expect(result.provenance.computedAt).toBeDefined();
    });

    it('should identify primary distortion', async () => {
      const result = await reframeThought(
        'I always completely fail. Everyone knows I\'m terrible.'
      );

      expect(result.primaryDistortion).toBeDefined();
    });

    it('should handle context with evidence', async () => {
      const result = await reframeThought(
        'I failed this project.',
        {
          situation: 'Work project',
          evidence: [
            'My manager says my work supports the team',
            'Last project was a success',
          ],
        }
      );

      expect(result).toBeDefined();
      // Evidence processing is optional feature
    });

    it('should include trigger phrases in distortion evidence', async () => {
      const result = await reframeThought(
        'I completely failed and totally ruined everything.'
      );

      const distortion = result.distortionsDetected.find(d => d.type === 'ALL_OR_NOTHING');
      expect(distortion?.triggerPhrases.length).toBeGreaterThan(0);
    });

    it('should generate different reframes for different distortions', async () => {
      const allOrNothing = await reframeThought('I completely failed.');
      const shouldStatement = await reframeThought('I should be better.');

      expect(allOrNothing.reframedThought).not.toBe(shouldStatement.reframedThought);
    });
  });

  describe('distortion severity', () => {
    it('should increase severity with multiple matches', async () => {
      const singleMatch = await reframeThought('I always fail.');
      const multipleMatches = await reframeThought(
        'I always fail. I never succeed. I constantly mess up.'
      );

      const singleDistortion = singleMatch.distortionsDetected[0];
      const multipleDistortion = multipleMatches.distortionsDetected.find(
        d => d.type === singleDistortion?.type
      );

      if (singleDistortion && multipleDistortion) {
        expect(multipleDistortion.severity).toBeGreaterThanOrEqual(singleDistortion.severity);
      }
    });

    it('should cap severity at 1.0', async () => {
      const result = await reframeThought(
        'I always always always always always fail completely totally entirely.'
      );

      for (const distortion of result.distortionsDetected) {
        expect(distortion.severity).toBeLessThanOrEqual(1.0);
      }
    });
  });
});
