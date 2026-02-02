import { describe, it, expect } from 'vitest';
import { generatePracticePlan } from '../../../../src/cognition/pathos/index.js';

describe('Meta-Learning - Deliberate Practice', () => {
  describe('generatePracticePlan', () => {
    // Note: Skill levels are 0-1, not 1-10
    it('should generate a practice plan for a skill', async () => {
      const result = await generatePracticePlan(
        'Technical Analysis',
        0.3,
        0.7,
        { weeks: 24 }
      );

      expect(result).toBeDefined();
      expect(result.skill).toBe('Technical Analysis');
      expect(result.currentLevel).toBe(0.3);
      expect(result.targetLevel).toBe(0.7);
    });

    it('should calculate skill gap', async () => {
      const result = await generatePracticePlan(
        'Options Trading',
        0.2,
        0.8,
        { weeks: 52 }
      );

      expect(result.gap).toBeCloseTo(0.6, 1);
    });

    it('should estimate practice hours', async () => {
      const result = await generatePracticePlan(
        'Risk Management',
        0.1,
        0.5,
        { weeks: 12 }
      );

      expect(result.estimatedHours).toBeDefined();
      expect(result.estimatedHours).toBeGreaterThan(0);
    });

    it('should include specific goals', async () => {
      const result = await generatePracticePlan(
        'Portfolio Management',
        0.4,
        0.8,
        { weeks: 24, hoursPerWeek: 10 }
      );

      expect(result.specificGoals).toBeDefined();
      expect(Array.isArray(result.specificGoals)).toBe(true);
      expect(result.specificGoals.length).toBeGreaterThan(0);

      for (const goal of result.specificGoals) {
        expect(goal.goal).toBeDefined();
        expect(goal.metric).toBeDefined();
      }
    });

    it('should identify weaknesses to address', async () => {
      const result = await generatePracticePlan(
        'Trading Psychology',
        0.2,
        0.6,
        { weeks: 16 }
      );

      expect(result.weaknessesToAddress).toBeDefined();
      expect(result.weaknessesToAddress.length).toBeGreaterThan(0);
    });

    it('should create practice schedule', async () => {
      const result = await generatePracticePlan(
        'Market Analysis',
        0.3,
        0.7,
        { weeks: 24, hoursPerWeek: 5 }
      );

      expect(result.practiceSchedule).toBeDefined();
      expect(result.practiceSchedule.frequency).toBeDefined();
      expect(result.practiceSchedule.duration).toBeDefined();
    });

    it('should include feedback mechanisms', async () => {
      const result = await generatePracticePlan(
        'Decision Making',
        0.5,
        0.9,
        { weeks: 52 }
      );

      expect(result.feedbackMechanism).toBeDefined();
      expect(Array.isArray(result.feedbackMechanism)).toBe(true);
    });

    it('should design difficulty progression', async () => {
      const result = await generatePracticePlan(
        'Quantitative Analysis',
        0.2,
        0.7,
        { weeks: 32 }
      );

      expect(result.difficultyProgression).toBeDefined();
      expect(Array.isArray(result.difficultyProgression)).toBe(true);

      // Should progress from easier to harder
      if (result.difficultyProgression.length > 1) {
        for (let i = 0; i < result.difficultyProgression.length - 1; i++) {
          const current = result.difficultyProgression[i];
          const next = result.difficultyProgression[i + 1];
          expect(current.week).toBeLessThan(next.week);
        }
      }
    });

    it('should set milestones', async () => {
      const result = await generatePracticePlan(
        'Algorithmic Trading',
        0.1,
        0.6,
        { weeks: 24 }
      );

      expect(result.milestones).toBeDefined();
      expect(Array.isArray(result.milestones)).toBe(true);

      for (const milestone of result.milestones) {
        expect(milestone.level).toBeDefined();
        expect(milestone.description).toBeDefined();
      }
    });

    it('should suggest resources', async () => {
      const result = await generatePracticePlan(
        'Fundamental Analysis',
        0.3,
        0.8,
        { weeks: 52, resources: ['Books', 'Courses'] }
      );

      expect(result.resources).toBeDefined();
      expect(Array.isArray(result.resources)).toBe(true);
      expect(result.resources.length).toBeGreaterThan(0);
    });

    it('should include provenance information', async () => {
      const result = await generatePracticePlan(
        'Test Skill',
        0.1,
        0.5,
        { weeks: 12 }
      );

      expect(result.provenance).toBeDefined();
      expect(result.provenance.framework).toContain('Deliberate Practice');
      expect(result.provenance.framework).toContain('Ericsson');
      expect(result.provenance.computedAt).toBeDefined();
    });

    it('should include practice principles', async () => {
      const result = await generatePracticePlan(
        'Trading',
        0.2,
        0.6,
        { weeks: 24 }
      );

      expect(result.provenance.principles).toBeDefined();
      expect(Array.isArray(result.provenance.principles)).toBe(true);
    });

    it('should throw on invalid level range', async () => {
      await expect(
        generatePracticePlan('Invalid Skill', -0.1, 0.5)
      ).rejects.toThrow();

      await expect(
        generatePracticePlan('Invalid Skill', 0.5, 1.5)
      ).rejects.toThrow();
    });

    it('should throw when target is not higher than current', async () => {
      await expect(
        generatePracticePlan('Existing Skill', 0.5, 0.5)
      ).rejects.toThrow();

      await expect(
        generatePracticePlan('Regressing Skill', 0.7, 0.3)
      ).rejects.toThrow();
    });

    it('should scale hours with gap size', async () => {
      const smallGap = await generatePracticePlan(
        'Skill A',
        0.4,
        0.5,
        { weeks: 8 }
      );

      const largeGap = await generatePracticePlan(
        'Skill B',
        0.1,
        0.9,
        { weeks: 104 }
      );

      expect(largeGap.estimatedHours).toBeGreaterThan(smallGap.estimatedHours);
    });

    it('should use default hours per week if not specified', async () => {
      const result = await generatePracticePlan(
        'Default Hours Skill',
        0.2,
        0.6
      );

      expect(result.practiceSchedule.duration).toBeGreaterThan(0);
    });

    it('should include target and baseline in goals', async () => {
      const result = await generatePracticePlan(
        'Performance Skill',
        0.3,
        0.7,
        { weeks: 24 }
      );

      for (const goal of result.specificGoals) {
        if (goal.baseline !== undefined) {
          expect(goal.target).toBeDefined();
          expect(goal.target).toBeGreaterThan(goal.baseline);
        }
      }
    });
  });
});
