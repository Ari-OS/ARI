import { describe, it, expect, beforeEach } from 'vitest';
import {
  PriorityScorer,
  legacyPriorityToOverrides,
  type ScoringInput,
  type ScoringContext,
} from '../../../src/autonomous/priority-scorer.js';

// Deterministic active-hours context (noon on a weekday)
// Prevents test flakiness from quiet hours (10PM-7AM) or weekends
const ACTIVE_CONTEXT: Partial<ScoringContext> = { currentHour: 12, dayOfWeek: 1 };

describe('PriorityScorer', () => {
  let scorer: PriorityScorer;

  beforeEach(() => {
    scorer = new PriorityScorer();
  });

  // ─── Category Default Scoring ───────────────────────────────────────────────

  describe('category default scoring', () => {
    it('should score security as P0 (highest priority)', () => {
      const result = scorer.score({ category: 'security', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P0');
      expect(result.score).toBeGreaterThanOrEqual(0.8);
    });

    it('should score error as P1', () => {
      const result = scorer.score({ category: 'error', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P1');
    });

    it('should score opportunity as P1', () => {
      const result = scorer.score({ category: 'opportunity', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P1');
    });

    it('should score question as P1', () => {
      const result = scorer.score({ category: 'question', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P1');
    });

    it('should score budget as P1', () => {
      const result = scorer.score({ category: 'budget', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P1');
    });

    it('should score finance as P2', () => {
      const result = scorer.score({ category: 'finance', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P2');
    });

    it('should score reminder as P2', () => {
      const result = scorer.score({ category: 'reminder', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P2');
    });

    it('should score daily as P3', () => {
      const result = scorer.score({ category: 'daily', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P3');
    });

    it('should score task as P3', () => {
      const result = scorer.score({ category: 'task', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P3');
    });

    it('should score milestone as P3', () => {
      const result = scorer.score({ category: 'milestone', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P3');
    });

    it('should score insight as P3', () => {
      const result = scorer.score({ category: 'insight', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P3');
    });

    it('should score system as P3', () => {
      const result = scorer.score({ category: 'system', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P3');
    });

    it('should score value as P4', () => {
      const result = scorer.score({ category: 'value', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P4');
    });

    it('should score adaptive as P4', () => {
      const result = scorer.score({ category: 'adaptive', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P4');
    });

    it('should score billing as P2', () => {
      const result = scorer.score({ category: 'billing', context: ACTIVE_CONTEXT });
      expect(result.priority).toBe('P2');
    });
  });

  // ─── Score-to-Priority Mapping ──────────────────────────────────────────────

  describe('scoreToPriority', () => {
    it('should map >= 0.80 to P0', () => {
      expect(scorer.scoreToPriority(0.80)).toBe('P0');
      expect(scorer.scoreToPriority(0.95)).toBe('P0');
      expect(scorer.scoreToPriority(1.0)).toBe('P0');
    });

    it('should map >= 0.60 to P1', () => {
      expect(scorer.scoreToPriority(0.60)).toBe('P1');
      expect(scorer.scoreToPriority(0.79)).toBe('P1');
    });

    it('should map >= 0.40 to P2', () => {
      expect(scorer.scoreToPriority(0.40)).toBe('P2');
      expect(scorer.scoreToPriority(0.59)).toBe('P2');
    });

    it('should map >= 0.20 to P3', () => {
      expect(scorer.scoreToPriority(0.20)).toBe('P3');
      expect(scorer.scoreToPriority(0.39)).toBe('P3');
    });

    it('should map < 0.20 to P4', () => {
      expect(scorer.scoreToPriority(0.19)).toBe('P4');
      expect(scorer.scoreToPriority(0.0)).toBe('P4');
    });
  });

  // ─── Factor Weights ─────────────────────────────────────────────────────────

  describe('factor weights', () => {
    it('should weight urgency at 0.30', () => {
      // All factors at 1.0 except urgency
      const highUrgency = scorer.score({
        category: 'task', // low defaults
        overrides: { urgency: 1.0, impact: 0, timeSensitivity: 0, userRelevance: 0 },
        context: { categoryEngagement: 0.5, escalationLevel: 0, recentSimilar: false,
          currentHour: 12, dayOfWeek: 1, ageMs: 0 },
      });

      // urgency 1.0 * 0.30 = 0.30, plus small context modifier contribution
      expect(highUrgency.factors.urgency).toBe(1.0);
      expect(highUrgency.score).toBeCloseTo(0.30, 1);
    });

    it('should weight impact at 0.25', () => {
      const highImpact = scorer.score({
        category: 'task',
        overrides: { urgency: 0, impact: 1.0, timeSensitivity: 0, userRelevance: 0 },
        context: { categoryEngagement: 0.5, escalationLevel: 0, recentSimilar: false,
          currentHour: 12, dayOfWeek: 1, ageMs: 0 },
      });

      expect(highImpact.factors.impact).toBe(1.0);
      expect(highImpact.score).toBeCloseTo(0.25, 1);
    });

    it('should weight timeSensitivity at 0.20', () => {
      const highTS = scorer.score({
        category: 'task',
        overrides: { urgency: 0, impact: 0, timeSensitivity: 1.0, userRelevance: 0 },
        context: { categoryEngagement: 0.5, escalationLevel: 0, recentSimilar: false,
          currentHour: 12, dayOfWeek: 1, ageMs: 0 },
      });

      expect(highTS.factors.timeSensitivity).toBe(1.0);
      expect(highTS.score).toBeCloseTo(0.20, 1);
    });
  });

  // ─── Context Modifiers ──────────────────────────────────────────────────────

  describe('context modifiers', () => {
    const baseContext: ScoringContext = {
      currentHour: 12,
      dayOfWeek: 1, // Monday
      escalationLevel: 0,
      recentSimilar: false,
      categoryEngagement: 0.5,
      ageMs: 0,
    };

    it('should boost priority on escalation (+0.1 per level, max +0.3)', () => {
      const noEscalation = scorer.score({ category: 'task', context: { ...baseContext, escalationLevel: 0 } });
      const oneEscalation = scorer.score({ category: 'task', context: { ...baseContext, escalationLevel: 1 } });
      const threeEscalation = scorer.score({ category: 'task', context: { ...baseContext, escalationLevel: 3 } });
      const fiveEscalation = scorer.score({ category: 'task', context: { ...baseContext, escalationLevel: 5 } });

      expect(oneEscalation.score).toBeGreaterThan(noEscalation.score);
      expect(threeEscalation.score).toBeGreaterThan(oneEscalation.score);
      // Max cap at +0.3
      expect(threeEscalation.factors.contextModifier).toBe(fiveEscalation.factors.contextModifier);
    });

    it('should penalize recent similar notifications (-0.2)', () => {
      const fresh = scorer.score({ category: 'finance', context: { ...baseContext, recentSimilar: false } });
      const similar = scorer.score({ category: 'finance', context: { ...baseContext, recentSimilar: true } });

      expect(similar.score).toBeLessThan(fresh.score);
      const diff = fresh.factors.contextModifier - similar.factors.contextModifier;
      expect(diff).toBeCloseTo(0.2, 1);
    });

    it('should penalize non-urgent during deep work hours (9PM-midnight)', () => {
      const daytime = scorer.score({ category: 'finance', context: { ...baseContext, currentHour: 14 } });
      const deepWork = scorer.score({ category: 'finance', context: { ...baseContext, currentHour: 22 } });

      expect(deepWork.score).toBeLessThan(daytime.score);
    });

    it('should NOT penalize urgent categories during deep work hours', () => {
      const securityDay = scorer.score({ category: 'security', context: { ...baseContext, currentHour: 14 } });
      const securityNight = scorer.score({ category: 'security', context: { ...baseContext, currentHour: 22 } });

      // Security should not get deep work penalty — modifier should be same
      expect(securityNight.factors.contextModifier).toBe(securityDay.factors.contextModifier);
    });

    it('should penalize non-critical on weekends (-0.1)', () => {
      const weekday = scorer.score({ category: 'finance', context: { ...baseContext, dayOfWeek: 2 } }); // Tuesday
      const weekend = scorer.score({ category: 'finance', context: { ...baseContext, dayOfWeek: 6 } }); // Saturday

      expect(weekend.score).toBeLessThan(weekday.score);
    });

    it('should NOT penalize security on weekends', () => {
      const weekday = scorer.score({ category: 'security', context: { ...baseContext, dayOfWeek: 2 } });
      const weekend = scorer.score({ category: 'security', context: { ...baseContext, dayOfWeek: 6 } });

      expect(weekend.factors.contextModifier).toBe(weekday.factors.contextModifier);
    });

    it('should boost for high engagement (+0.1)', () => {
      // Need ~12 positive updates to push from 0.5 above 0.7
      for (let i = 0; i < 12; i++) {
        scorer.updateEngagement('finance', true);
      }

      const result = scorer.score({ category: 'finance', context: baseContext });
      expect(result.factors.contextModifier).toBeGreaterThan(0);
    });

    it('should penalize for low engagement (-0.1)', () => {
      // Need ~12 negative updates to push from 0.5 below 0.3
      for (let i = 0; i < 12; i++) {
        scorer.updateEngagement('finance', false);
      }

      const result = scorer.score({ category: 'finance', context: baseContext });
      expect(result.factors.contextModifier).toBeLessThan(0);
    });

    it('should clamp context modifier to [-0.5, 0.5]', () => {
      // Stack all negative modifiers: recent similar + deep work + weekend + low engagement
      scorer.updateEngagement('task', false);
      scorer.updateEngagement('task', false);
      scorer.updateEngagement('task', false);
      scorer.updateEngagement('task', false);

      const result = scorer.score({
        category: 'task',
        context: {
          ...baseContext,
          recentSimilar: true,
          currentHour: 23,
          dayOfWeek: 0, // Sunday
        },
      });

      expect(result.factors.contextModifier).toBeGreaterThanOrEqual(-0.5);
      expect(result.factors.contextModifier).toBeLessThanOrEqual(0.5);
    });
  });

  // ─── Priority Decay ─────────────────────────────────────────────────────────

  describe('priority decay', () => {
    it('should not decay fresh notifications (ageMs = 0)', () => {
      const result = scorer.score({ category: 'error', context: { ageMs: 0 } });
      expect(result.decayedScore).toBe(result.score);
    });

    it('should halve perishable score at 30 minutes', () => {
      const original = scorer.applyDecay(1.0, 'perishable', 30 * 60 * 1000);
      expect(original).toBeCloseTo(0.5, 1);
    });

    it('should halve short-lived score at 4 hours', () => {
      const original = scorer.applyDecay(1.0, 'short', 4 * 60 * 60 * 1000);
      expect(original).toBeCloseTo(0.5, 1);
    });

    it('should halve day score at 24 hours', () => {
      const original = scorer.applyDecay(1.0, 'day', 24 * 60 * 60 * 1000);
      expect(original).toBeCloseTo(0.5, 1);
    });

    it('should halve persistent score at 7 days', () => {
      const original = scorer.applyDecay(1.0, 'persistent', 7 * 24 * 60 * 60 * 1000);
      expect(original).toBeCloseTo(0.5, 1);
    });

    it('should decay a P1 error to lower priority over time', () => {
      const fresh = scorer.score({ category: 'error', context: { ageMs: 0 } });
      const aged = scorer.score({ category: 'error', context: { ageMs: 8 * 60 * 60 * 1000 } }); // 8 hours (2 half-lives for short)

      expect(fresh.priority).toBe('P1');
      expect(aged.decayedScore).toBeLessThan(fresh.decayedScore);
    });

    it('should not decay negative age', () => {
      const result = scorer.applyDecay(0.8, 'short', -1000);
      expect(result).toBe(0.8);
    });
  });

  // ─── Engagement Tracking ────────────────────────────────────────────────────

  describe('engagement tracking', () => {
    it('should start at 0.5 (neutral) for unknown categories', () => {
      expect(scorer.getEngagement('finance')).toBe(0.5);
    });

    it('should increase with positive engagement', () => {
      scorer.updateEngagement('finance', true);
      expect(scorer.getEngagement('finance')).toBeGreaterThan(0.5);
    });

    it('should decrease with negative engagement', () => {
      scorer.updateEngagement('finance', false);
      expect(scorer.getEngagement('finance')).toBeLessThan(0.5);
    });

    it('should use exponential moving average (0.9 old + 0.1 new)', () => {
      scorer.updateEngagement('finance', true);
      const afterOne = scorer.getEngagement('finance');
      // 0.5 * 0.9 + 1.0 * 0.1 = 0.45 + 0.10 = 0.55
      expect(afterOne).toBeCloseTo(0.55, 2);

      scorer.updateEngagement('finance', true);
      const afterTwo = scorer.getEngagement('finance');
      // 0.55 * 0.9 + 1.0 * 0.1 = 0.495 + 0.10 = 0.595
      expect(afterTwo).toBeCloseTo(0.595, 2);
    });

    it('should converge toward 0 with consistent negative engagement', () => {
      for (let i = 0; i < 20; i++) {
        scorer.updateEngagement('task', false);
      }
      expect(scorer.getEngagement('task')).toBeLessThan(0.15);
    });

    it('should converge toward 1 with consistent positive engagement', () => {
      for (let i = 0; i < 20; i++) {
        scorer.updateEngagement('task', true);
      }
      expect(scorer.getEngagement('task')).toBeGreaterThan(0.85);
    });
  });

  // ─── Engagement Stats & Persistence ────────────────────────────────────────

  describe('engagement stats', () => {
    it('should return empty stats initially', () => {
      const stats = scorer.getEngagementStats();
      expect(Object.keys(stats.scores)).toHaveLength(0);
      expect(Object.keys(stats.interactions)).toHaveLength(0);
    });

    it('should track interaction counts', () => {
      scorer.updateEngagement('budget', true);
      scorer.updateEngagement('budget', true);
      scorer.updateEngagement('budget', false);

      const stats = scorer.getEngagementStats();
      expect(stats.interactions['budget']).toEqual({ positive: 2, negative: 1 });
    });

    it('should export and import engagement data', () => {
      // Build up some engagement data
      scorer.updateEngagement('error', true);
      scorer.updateEngagement('error', true);
      scorer.updateEngagement('budget', false);
      scorer.updateEngagement('budget', false);

      const exported = scorer.exportEngagement();

      // Create new scorer, import data
      const scorer2 = new PriorityScorer();
      scorer2.importEngagement(exported);

      // Should have same engagement values
      expect(scorer2.getEngagement('error')).toBeCloseTo(scorer.getEngagement('error'), 4);
      expect(scorer2.getEngagement('budget')).toBeCloseTo(scorer.getEngagement('budget'), 4);

      // Should have same interaction counts
      const stats2 = scorer2.getEngagementStats();
      expect(stats2.interactions['error']).toEqual({ positive: 2, negative: 0 });
      expect(stats2.interactions['budget']).toEqual({ positive: 0, negative: 2 });
    });
  });

  // ─── Quiet Hours Protection (Wellbeing Guardian) ─────────────────────────

  describe('quiet hours protection', () => {
    it('should suppress non-urgent notifications at 11 PM', () => {
      const normal = scorer.score({
        category: 'milestone',
        context: { currentHour: 14, dayOfWeek: 1 },
      });
      const quiet = scorer.score({
        category: 'milestone',
        context: { currentHour: 23, dayOfWeek: 1 },
      });

      expect(quiet.factors.contextModifier).toBeLessThan(normal.factors.contextModifier);
    });

    it('should suppress non-urgent notifications at 3 AM', () => {
      const normal = scorer.score({
        category: 'budget',
        context: { currentHour: 14, dayOfWeek: 1 },
      });
      const quiet = scorer.score({
        category: 'budget',
        context: { currentHour: 3, dayOfWeek: 1 },
      });

      expect(quiet.score).toBeLessThan(normal.score);
    });

    it('should NOT suppress security during quiet hours', () => {
      const result = scorer.score({
        category: 'security',
        context: { currentHour: 3, dayOfWeek: 1 },
      });

      // Security should still be P0 even at 3 AM
      expect(result.priority).toBe('P0');
    });

    it('should NOT suppress errors during quiet hours', () => {
      const result = scorer.score({
        category: 'error',
        context: { currentHour: 2, dayOfWeek: 1 },
      });

      // Error should still be at least P1 at 2 AM
      expect(['P0', 'P1']).toContain(result.priority);
    });
  });

  // ─── Override Support ───────────────────────────────────────────────────────

  describe('factor overrides', () => {
    it('should allow overriding individual factors', () => {
      const result = scorer.score({
        category: 'task', // normally P3
        overrides: { urgency: 1.0, impact: 1.0, timeSensitivity: 1.0 },
        context: ACTIVE_CONTEXT,
      });

      // With all factors maxed, should be P0
      expect(result.priority).toBe('P0');
      expect(result.factors.urgency).toBe(1.0);
      expect(result.factors.impact).toBe(1.0);
      expect(result.factors.timeSensitivity).toBe(1.0);
    });

    it('should allow partial overrides', () => {
      const defaults = scorer.getCategoryDefaults('task');
      const result = scorer.score({
        category: 'task',
        overrides: { urgency: 0.9 },
        context: ACTIVE_CONTEXT,
      });

      expect(result.factors.urgency).toBe(0.9); // overridden
      expect(result.factors.impact).toBe(defaults.impact); // default
      expect(result.factors.timeSensitivity).toBe(defaults.timeSensitivity); // default
    });
  });

  // ─── Category Defaults ──────────────────────────────────────────────────────

  describe('getCategoryDefaults', () => {
    it('should return a copy of defaults (not mutable reference)', () => {
      const defaults1 = scorer.getCategoryDefaults('security');
      const defaults2 = scorer.getCategoryDefaults('security');

      defaults1.urgency = 0;
      expect(defaults2.urgency).toBe(1.0); // Should not be affected
    });

    it('should have correct decay profiles', () => {
      expect(scorer.getCategoryDefaults('security').decayProfile).toBe('perishable');
      expect(scorer.getCategoryDefaults('error').decayProfile).toBe('short');
      expect(scorer.getCategoryDefaults('budget').decayProfile).toBe('day');
      expect(scorer.getCategoryDefaults('insight').decayProfile).toBe('persistent');
    });
  });

  // ─── Score Clamping ─────────────────────────────────────────────────────────

  describe('score clamping', () => {
    it('should clamp scores to [0, 1]', () => {
      const result = scorer.score({
        category: 'security',
        overrides: { urgency: 1.0, impact: 1.0, timeSensitivity: 1.0, userRelevance: 1.0 },
        context: { escalationLevel: 5, categoryEngagement: 1.0, currentHour: 12, dayOfWeek: 1 },
      });

      expect(result.score).toBeLessThanOrEqual(1.0);
      expect(result.score).toBeGreaterThanOrEqual(0.0);
    });

    it('should handle all-zero factors gracefully', () => {
      const result = scorer.score({
        category: 'task',
        overrides: { urgency: 0, impact: 0, timeSensitivity: 0, userRelevance: 0 },
        context: {
          escalationLevel: 0,
          recentSimilar: true,
          currentHour: 23,
          dayOfWeek: 0,
          categoryEngagement: 0.2,
          ageMs: 0,
        },
      });

      expect(result.score).toBeGreaterThanOrEqual(0.0);
    });
  });

  // ─── ScoringResult Structure ────────────────────────────────────────────────

  describe('scoring result structure', () => {
    it('should return all expected fields', () => {
      const result = scorer.score({ category: 'error', context: ACTIVE_CONTEXT });

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('priority');
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('decayedScore');
      expect(result).toHaveProperty('decayProfile');

      expect(result.factors).toHaveProperty('urgency');
      expect(result.factors).toHaveProperty('impact');
      expect(result.factors).toHaveProperty('timeSensitivity');
      expect(result.factors).toHaveProperty('userRelevance');
      expect(result.factors).toHaveProperty('contextModifier');
    });

    it('should have consistent score and priority', () => {
      const result = scorer.score({ category: 'error', context: ACTIVE_CONTEXT });

      // Priority should match the decayed score
      const expectedPriority = scorer.scoreToPriority(result.decayedScore);
      expect(result.priority).toBe(expectedPriority);
    });
  });

  // ─── Legacy Bridge ──────────────────────────────────────────────────────────

  describe('legacyPriorityToOverrides', () => {
    it('should map critical to max values', () => {
      const overrides = legacyPriorityToOverrides('critical');
      expect(overrides.urgency).toBe(1.0);
      expect(overrides.impact).toBe(1.0);
      expect(overrides.timeSensitivity).toBe(1.0);
    });

    it('should map high to elevated values', () => {
      const overrides = legacyPriorityToOverrides('high');
      expect(overrides.urgency).toBe(0.8);
      expect(overrides.impact).toBe(0.7);
      expect(overrides.timeSensitivity).toBe(0.7);
    });

    it('should map normal to moderate values', () => {
      const overrides = legacyPriorityToOverrides('normal');
      expect(overrides.urgency).toBe(0.5);
      expect(overrides.impact).toBe(0.5);
      expect(overrides.timeSensitivity).toBe(0.5);
    });

    it('should map low to low values', () => {
      const overrides = legacyPriorityToOverrides('low');
      expect(overrides.urgency).toBe(0.2);
      expect(overrides.impact).toBe(0.3);
      expect(overrides.timeSensitivity).toBe(0.2);
    });

    it('should map silent to near-zero values', () => {
      const overrides = legacyPriorityToOverrides('silent');
      expect(overrides.urgency).toBe(0.0);
      expect(overrides.impact).toBe(0.1);
      expect(overrides.timeSensitivity).toBe(0.0);
    });

    it('should produce scores that map to expected priorities', () => {
      const critOverrides = legacyPriorityToOverrides('critical');
      const critResult = scorer.score({ category: 'task', overrides: critOverrides, context: ACTIVE_CONTEXT });
      expect(critResult.priority).toBe('P0');

      const highOverrides = legacyPriorityToOverrides('high');
      const highResult = scorer.score({ category: 'task', overrides: highOverrides, context: ACTIVE_CONTEXT });
      expect(highResult.priority).toBe('P1');

      const normalOverrides = legacyPriorityToOverrides('normal');
      const normalResult = scorer.score({ category: 'task', overrides: normalOverrides, context: ACTIVE_CONTEXT });
      expect(normalResult.priority).toBe('P2');

      const lowOverrides = legacyPriorityToOverrides('low');
      const lowResult = scorer.score({ category: 'task', overrides: lowOverrides, context: ACTIVE_CONTEXT });
      expect(lowResult.priority).toBe('P3');
    });
  });

  // ─── Integration: Multi-factor Interaction ──────────────────────────────────

  describe('multi-factor interactions', () => {
    it('should escalate a normally-P3 task to P1 with escalation and high overrides', () => {
      const result = scorer.score({
        category: 'task',
        overrides: { urgency: 0.9, impact: 0.8 },
        context: { escalationLevel: 3, categoryEngagement: 0.5, currentHour: 12, dayOfWeek: 1 },
      });

      // Task normally P3, but with urgency 0.9, impact 0.8, + escalation +0.3 should reach P1
      expect(result.priority).toBe('P1');
    });

    it('should de-prioritize a normally-P1 error during deep work with recent similar', () => {
      const result = scorer.score({
        category: 'error',
        context: {
          currentHour: 23,
          recentSimilar: true,
          escalationLevel: 0,
          dayOfWeek: 1,
          categoryEngagement: 0.5,
          ageMs: 0,
        },
      });

      // Error normally P1, but deep work (-0.15) + recent similar (-0.2) = -0.35 modifier
      // Should pull it down
      expect(result.score).toBeLessThan(0.7);
    });

    it('should handle the worst case: stale perishable notification', () => {
      // Security alert that's 2 hours old (4 half-lives for perishable = 30 min)
      const result = scorer.score({
        category: 'security',
        context: { ageMs: 2 * 60 * 60 * 1000 },
      });

      // After 4 half-lives, score should be ~1/16 of original
      expect(result.decayedScore).toBeLessThan(result.score * 0.1);
    });
  });
});
