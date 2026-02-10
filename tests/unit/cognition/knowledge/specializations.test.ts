/**
 * Tests for Council Cognitive Profiles
 */

import { describe, it, expect } from 'vitest';
import {
  getProfile,
  getAllProfiles,
  getProfilesByPillar,
  COUNCIL_COGNITIVE_PROFILES,
} from '../../../../src/cognition/knowledge/specializations.js';

describe('Council Cognitive Specializations', () => {
  describe('COUNCIL_COGNITIVE_PROFILES', () => {
    it('should export exactly 15 profiles', () => {
      expect(COUNCIL_COGNITIVE_PROFILES).toBeDefined();
      expect(COUNCIL_COGNITIVE_PROFILES.length).toBe(15);
    });

    it('should have all expected council member IDs', () => {
      const expectedIds = [
        'router',
        'executor',
        'memory_keeper',
        'guardian',
        'risk_assessor',
        'planner',
        'scheduler',
        'resource_manager',
        'wellness',
        'relationships',
        'creative',
        'wealth',
        'growth',
        'ethics',
        'integrator',
      ];

      const actualIds = COUNCIL_COGNITIVE_PROFILES.map((p) => p.memberId);
      expect(actualIds.sort()).toEqual(expectedIds.sort());
    });

    it('should have unique member IDs', () => {
      const ids = COUNCIL_COGNITIVE_PROFILES.map((p) => p.memberId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(15);
    });

    it('should have unique member names', () => {
      const names = COUNCIL_COGNITIVE_PROFILES.map((p) => p.memberName);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(15);
    });
  });

  describe('Pillar Weights', () => {
    it('should have pillar weights that sum close to 1.0 for all profiles', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        const sum =
          profile.pillarWeights.logos +
          profile.pillarWeights.ethos +
          profile.pillarWeights.pathos;
        expect(sum).toBeCloseTo(1.0, 1);
      }
    });

    it('should have all pillar weights between 0 and 1', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        expect(profile.pillarWeights.logos).toBeGreaterThanOrEqual(0);
        expect(profile.pillarWeights.logos).toBeLessThanOrEqual(1);
        expect(profile.pillarWeights.ethos).toBeGreaterThanOrEqual(0);
        expect(profile.pillarWeights.ethos).toBeLessThanOrEqual(1);
        expect(profile.pillarWeights.pathos).toBeGreaterThanOrEqual(0);
        expect(profile.pillarWeights.pathos).toBeLessThanOrEqual(1);
      }
    });

    it('should have primary pillar weight highest in pillar weights', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        const primaryWeight = profile.pillarWeights[profile.primaryPillar.toLowerCase() as 'logos' | 'ethos' | 'pathos'];
        const otherWeights = Object.entries(profile.pillarWeights)
          .filter(([pillar]) => pillar !== profile.primaryPillar.toLowerCase())
          .map(([, weight]) => weight);

        for (const weight of otherWeights) {
          expect(primaryWeight).toBeGreaterThanOrEqual(weight);
        }
      }
    });
  });

  describe('Primary Frameworks', () => {
    it('should have at least one primary framework for each profile', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        expect(profile.primaryFrameworks.length).toBeGreaterThan(0);
      }
    });

    it('should have complete framework objects with all required fields', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        for (const framework of profile.primaryFrameworks) {
          expect(framework.name).toBeDefined();
          expect(framework.name).not.toBe('');
          expect(framework.domain).toBeDefined();
          expect(framework.domain).not.toBe('');
          expect(framework.application).toBeDefined();
          expect(framework.application).not.toBe('');
          expect(framework.why).toBeDefined();
          expect(framework.why).not.toBe('');
        }
      }
    });
  });

  describe('Knowledge Sources', () => {
    it('should have at least one knowledge source for each profile', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        expect(profile.knowledgeSources.length).toBeGreaterThan(0);
      }
    });

    it('should have valid knowledge source IDs (non-empty strings)', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        for (const sourceId of profile.knowledgeSources) {
          expect(sourceId).toBeDefined();
          expect(typeof sourceId).toBe('string');
          expect(sourceId.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Expertise Areas', () => {
    it('should have at least one expertise area for each profile', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        expect(profile.expertiseAreas.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Typical API Usage', () => {
    it('should have at least one typical API for each profile', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        expect(profile.typicalAPIUsage.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Learning Plan', () => {
    it('should have complete learning plan for each profile', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        expect(profile.learningPlan.current).toBeDefined();
        expect(profile.learningPlan.current).not.toBe('');
        expect(profile.learningPlan.next).toBeDefined();
        expect(profile.learningPlan.next).not.toBe('');
        expect(profile.learningPlan.cadence).toBeDefined();
        expect(profile.learningPlan.cadence).not.toBe('');
        expect(profile.learningPlan.quarterlyGoals).toBeDefined();
        expect(profile.learningPlan.quarterlyGoals.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Cognitive Bias Awareness', () => {
    it('should have complete bias awareness for each profile', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        expect(profile.cognitiveBiasAwareness.naturalTendency).toBeDefined();
        expect(profile.cognitiveBiasAwareness.naturalTendency).not.toBe('');
        expect(profile.cognitiveBiasAwareness.compensationStrategy).toBeDefined();
        expect(profile.cognitiveBiasAwareness.compensationStrategy).not.toBe('');
        expect(profile.cognitiveBiasAwareness.historicalPattern).toBeDefined();
        expect(profile.cognitiveBiasAwareness.historicalPattern).not.toBe('');
        expect(profile.cognitiveBiasAwareness.improvementGoal).toBeDefined();
        expect(profile.cognitiveBiasAwareness.improvementGoal).not.toBe('');
      }
    });
  });

  describe('Performance Metrics', () => {
    it('should have complete performance metrics for each profile', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        expect(profile.performanceMetrics.keyMetric).toBeDefined();
        expect(profile.performanceMetrics.keyMetric).not.toBe('');
        expect(profile.performanceMetrics.baseline).toBeDefined();
        expect(profile.performanceMetrics.baseline).toBeGreaterThan(0);
        expect(profile.performanceMetrics.target).toBeDefined();
        expect(profile.performanceMetrics.target).toBeGreaterThan(0);
        expect(profile.performanceMetrics.target).toBeGreaterThan(profile.performanceMetrics.baseline);
      }
    });

    it('should have current metrics between baseline and target (or close)', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        if (profile.performanceMetrics.current !== undefined) {
          expect(profile.performanceMetrics.current).toBeGreaterThanOrEqual(
            profile.performanceMetrics.baseline
          );
          expect(profile.performanceMetrics.current).toBeLessThanOrEqual(
            profile.performanceMetrics.target
          );
        }
      }
    });
  });

  describe('getAllProfiles', () => {
    it('should return 15 cognitive profiles', () => {
      const profiles = getAllProfiles();
      expect(profiles.length).toBe(15);
    });

    it('should return the same array as COUNCIL_COGNITIVE_PROFILES', () => {
      const profiles = getAllProfiles();
      expect(profiles).toEqual(COUNCIL_COGNITIVE_PROFILES);
    });
  });

  describe('getProfile', () => {
    it('should return AEGIS (guardian) profile', () => {
      const profile = getProfile('guardian');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('AEGIS');
      expect(profile!.memberAvatar).toBe('🛡️');
      expect(profile!.primaryPillar).toBe('ETHOS');
    });

    it('should return SCOUT (risk_assessor) profile', () => {
      const profile = getProfile('risk_assessor');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('SCOUT');
      expect(profile!.memberAvatar).toBe('📊');
      expect(profile!.primaryPillar).toBe('LOGOS');
    });

    it('should return ATLAS (router) profile', () => {
      const profile = getProfile('router');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('ATLAS');
      expect(profile!.memberAvatar).toBe('🧭');
      expect(profile!.primaryPillar).toBe('LOGOS');
    });

    it('should return BOLT (executor) profile', () => {
      const profile = getProfile('executor');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('BOLT');
      expect(profile!.memberAvatar).toBe('⚡');
      expect(profile!.primaryPillar).toBe('LOGOS');
    });

    it('should return ECHO (memory_keeper) profile', () => {
      const profile = getProfile('memory_keeper');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('ECHO');
      expect(profile!.memberAvatar).toBe('📚');
      expect(profile!.primaryPillar).toBe('PATHOS');
    });

    it('should return PULSE (wellness) profile', () => {
      const profile = getProfile('wellness');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('PULSE');
      expect(profile!.memberAvatar).toBe('💚');
      expect(profile!.primaryPillar).toBe('ETHOS');
    });

    it('should return EMBER (relationships) profile', () => {
      const profile = getProfile('relationships');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('EMBER');
      expect(profile!.memberAvatar).toBe('🤝');
      expect(profile!.primaryPillar).toBe('PATHOS');
    });

    it('should return PRISM (creative) profile', () => {
      const profile = getProfile('creative');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('PRISM');
      expect(profile!.memberAvatar).toBe('✨');
      expect(profile!.primaryPillar).toBe('PATHOS');
    });

    it('should return MINT (wealth) profile', () => {
      const profile = getProfile('wealth');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('MINT');
      expect(profile!.memberAvatar).toBe('💰');
      expect(profile!.primaryPillar).toBe('LOGOS');
    });

    it('should return BLOOM (growth) profile', () => {
      const profile = getProfile('growth');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('BLOOM');
      expect(profile!.memberAvatar).toBe('🌱');
      expect(profile!.primaryPillar).toBe('PATHOS');
    });

    it('should return VERA (ethics) profile', () => {
      const profile = getProfile('ethics');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('VERA');
      expect(profile!.memberAvatar).toBe('⚖️');
      expect(profile!.primaryPillar).toBe('ETHOS');
    });

    it('should return NEXUS (integrator) profile', () => {
      const profile = getProfile('integrator');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('NEXUS');
      expect(profile!.memberAvatar).toBe('🔗');
      expect(profile!.primaryPillar).toBe('PATHOS');
    });

    it('should return TRUE (planner) profile', () => {
      const profile = getProfile('planner');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('TRUE');
      expect(profile!.memberAvatar).toBe('🎯');
      expect(profile!.primaryPillar).toBe('LOGOS');
    });

    it('should return TEMPO (scheduler) profile', () => {
      const profile = getProfile('scheduler');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('TEMPO');
      expect(profile!.memberAvatar).toBe('⏰');
      expect(profile!.primaryPillar).toBe('LOGOS');
    });

    it('should return OPAL (resource_manager) profile', () => {
      const profile = getProfile('resource_manager');
      expect(profile).toBeDefined();
      expect(profile!.memberName).toBe('OPAL');
      expect(profile!.memberAvatar).toBe('💎');
      expect(profile!.primaryPillar).toBe('LOGOS');
    });

    it('should return undefined for unknown member', () => {
      const profile = getProfile('nonexistent');
      expect(profile).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const profile = getProfile('');
      expect(profile).toBeUndefined();
    });
  });

  describe('getProfilesByPillar', () => {
    it('should group profiles by primary pillar', () => {
      const byPillar = getProfilesByPillar();
      expect(byPillar.LOGOS).toBeDefined();
      expect(byPillar.ETHOS).toBeDefined();
      expect(byPillar.PATHOS).toBeDefined();
    });

    it('should have at least one profile in each pillar', () => {
      const byPillar = getProfilesByPillar();
      expect(byPillar.LOGOS.length).toBeGreaterThan(0);
      expect(byPillar.ETHOS.length).toBeGreaterThan(0);
      expect(byPillar.PATHOS.length).toBeGreaterThan(0);
    });

    it('should have all 15 profiles accounted for', () => {
      const byPillar = getProfilesByPillar();
      const total = byPillar.LOGOS.length + byPillar.ETHOS.length + byPillar.PATHOS.length;
      expect(total).toBe(15);
    });

    it('should have profiles correctly grouped by their primary pillar', () => {
      const byPillar = getProfilesByPillar();

      for (const profile of byPillar.LOGOS) {
        expect(profile.primaryPillar).toBe('LOGOS');
      }
      for (const profile of byPillar.ETHOS) {
        expect(profile.primaryPillar).toBe('ETHOS');
      }
      for (const profile of byPillar.PATHOS) {
        expect(profile.primaryPillar).toBe('PATHOS');
      }
    });

    it('should have expected distribution across pillars', () => {
      const byPillar = getProfilesByPillar();
      // Based on the profiles:
      // LOGOS: router, executor, risk_assessor, planner, scheduler, resource_manager, wealth (7)
      // ETHOS: guardian, wellness, ethics (3)
      // PATHOS: memory_keeper, relationships, creative, growth, integrator (5)
      expect(byPillar.LOGOS.length).toBe(7);
      expect(byPillar.ETHOS.length).toBe(3);
      expect(byPillar.PATHOS.length).toBe(5);
    });
  });

  describe('Profile Consistency', () => {
    it('should have consistent member IDs and names', () => {
      const expectedMapping: Record<string, string> = {
        router: 'ATLAS',
        executor: 'BOLT',
        memory_keeper: 'ECHO',
        guardian: 'AEGIS',
        risk_assessor: 'SCOUT',
        planner: 'TRUE',
        scheduler: 'TEMPO',
        resource_manager: 'OPAL',
        wellness: 'PULSE',
        relationships: 'EMBER',
        creative: 'PRISM',
        wealth: 'MINT',
        growth: 'BLOOM',
        ethics: 'VERA',
        integrator: 'NEXUS',
      };

      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        expect(profile.memberName).toBe(expectedMapping[profile.memberId]);
      }
    });

    it('should have valid avatars for all profiles', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        expect(profile.memberAvatar).toBeDefined();
        expect(profile.memberAvatar.length).toBeGreaterThan(0);
      }
    });

    it('should have consultedFor field for all profiles', () => {
      for (const profile of COUNCIL_COGNITIVE_PROFILES) {
        expect(profile.consultedFor).toBeDefined();
        expect(profile.consultedFor.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Specialized Profile Checks', () => {
    it('should have SCOUT (risk_assessor) with Bayesian framework', () => {
      const scout = getProfile('risk_assessor');
      expect(scout).toBeDefined();
      const hasBayesian = scout!.primaryFrameworks.some((f) =>
        f.name.toLowerCase().includes('bayesian')
      );
      expect(hasBayesian).toBe(true);
    });

    it('should have AEGIS (guardian) with Bias Detection framework', () => {
      const aegis = getProfile('guardian');
      expect(aegis).toBeDefined();
      const hasBiasDetection = aegis!.primaryFrameworks.some((f) =>
        f.name.toLowerCase().includes('bias')
      );
      expect(hasBiasDetection).toBe(true);
    });

    it('should have MINT (wealth) with Kelly Criterion framework', () => {
      const mint = getProfile('wealth');
      expect(mint).toBeDefined();
      const hasKelly = mint!.primaryFrameworks.some((f) =>
        f.name.toLowerCase().includes('kelly')
      );
      expect(hasKelly).toBe(true);
    });

    it('should have PULSE (wellness) with Emotional State framework', () => {
      const pulse = getProfile('wellness');
      expect(pulse).toBeDefined();
      const hasEmotionalState = pulse!.primaryFrameworks.some((f) =>
        f.name.toLowerCase().includes('emotional')
      );
      expect(hasEmotionalState).toBe(true);
    });

    it('should have PRISM (creative) with Deliberate Practice framework', () => {
      const prism = getProfile('creative');
      expect(prism).toBeDefined();
      const hasDeliberatePractice = prism!.primaryFrameworks.some((f) =>
        f.name.toLowerCase().includes('deliberate')
      );
      expect(hasDeliberatePractice).toBe(true);
    });
  });
});
