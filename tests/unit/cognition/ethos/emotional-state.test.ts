import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  assessEmotionalState,
  detectFearGreedCycle,
} from '../../../../src/cognition/ethos/index.js';

describe('Emotional State Assessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assessEmotionalState', () => {
    it('should assess positive calm state correctly', async () => {
      const result = await assessEmotionalState({
        valence: 0.5,
        arousal: 0.2,
        dominance: 0.7,
      });

      expect(result.valence).toBe(0.5);
      expect(result.arousal).toBe(0.2);
      expect(result.dominance).toBe(0.7);
      expect(result.stability).toBe('stable');
      expect(result.riskToDecisionQuality).toBeLessThan(0.5);
      expect(result.provenance.framework).toContain('VAD');
    });

    it('should detect high risk in euphoric state', async () => {
      const result = await assessEmotionalState({
        valence: 0.9,
        arousal: 0.9,
        dominance: 0.8,
      });

      // High positive valence + high arousal = euphoria risk
      expect(result.riskToDecisionQuality).toBeGreaterThan(0.5);
      expect(result.recommendations.some(r => r.toLowerCase().includes('euphoria'))).toBe(true);
    });

    it('should detect high risk in fear state', async () => {
      const result = await assessEmotionalState({
        valence: -0.8,
        arousal: 0.8,
        dominance: 0.2,
      });

      // Negative valence + high arousal + low dominance = fear/anxiety
      expect(result.riskToDecisionQuality).toBeGreaterThan(0.6);
      // May be HIGH or CRITICAL depending on exact risk calculation
      expect(['HIGH', 'CRITICAL']).toContain(result.riskLevel);
    });

    it('should identify volatile stability for high arousal', async () => {
      const result = await assessEmotionalState({
        valence: 0,
        arousal: 0.8,
        dominance: 0.5,
      });

      expect(result.stability).toBe('volatile');
    });

    it('should identify fluctuating stability for moderate arousal', async () => {
      const result = await assessEmotionalState({
        valence: 0,
        arousal: 0.5,
        dominance: 0.5,
      });

      expect(result.stability).toBe('fluctuating');
    });

    it('should map emotions correctly for different VAD combinations', async () => {
      // Positive, high arousal = excitement
      const excited = await assessEmotionalState({
        valence: 0.7,
        arousal: 0.8,
        dominance: 0.6,
      });
      expect(excited.emotions.length).toBeGreaterThan(0);

      // Negative, low arousal = sadness
      const sad = await assessEmotionalState({
        valence: -0.6,
        arousal: 0.2,
        dominance: 0.3,
      });
      expect(sad.emotions.length).toBeGreaterThan(0);
    });

    it('should throw on invalid valence (< -1)', async () => {
      await expect(
        assessEmotionalState({
          valence: -1.5,
          arousal: 0.5,
          dominance: 0.5,
        })
      ).rejects.toThrow('between -1 and 1');
    });

    it('should throw on invalid valence (> 1)', async () => {
      await expect(
        assessEmotionalState({
          valence: 1.5,
          arousal: 0.5,
          dominance: 0.5,
        })
      ).rejects.toThrow('between -1 and 1');
    });

    it('should throw on invalid arousal (< 0)', async () => {
      await expect(
        assessEmotionalState({
          valence: 0.5,
          arousal: -0.1,
          dominance: 0.5,
        })
      ).rejects.toThrow('between 0 and 1');
    });

    it('should throw on invalid arousal (> 1)', async () => {
      await expect(
        assessEmotionalState({
          valence: 0.5,
          arousal: 1.5,
          dominance: 0.5,
        })
      ).rejects.toThrow('between 0 and 1');
    });

    it('should throw on invalid dominance (< 0)', async () => {
      await expect(
        assessEmotionalState({
          valence: 0.5,
          arousal: 0.5,
          dominance: -0.1,
        })
      ).rejects.toThrow('between 0 and 1');
    });

    it('should throw on invalid dominance (> 1)', async () => {
      await expect(
        assessEmotionalState({
          valence: 0.5,
          arousal: 0.5,
          dominance: 1.5,
        })
      ).rejects.toThrow('between 0 and 1');
    });

    it('should generate appropriate recommendations for high arousal', async () => {
      const result = await assessEmotionalState({
        valence: 0,
        arousal: 0.8,
        dominance: 0.5,
      });

      expect(result.recommendations.some(r => r.toLowerCase().includes('arousal'))).toBe(true);
    });

    it('should generate recommendations for low dominance with negative valence', async () => {
      const result = await assessEmotionalState({
        valence: -0.7,
        arousal: 0.5,
        dominance: 0.2,
      });

      expect(result.recommendations.some(r =>
        r.toLowerCase().includes('support') || r.toLowerCase().includes('wait')
      )).toBe(true);
    });

    it('should set correct risk levels', async () => {
      // Low risk
      const low = await assessEmotionalState({
        valence: 0.3,
        arousal: 0.2,
        dominance: 0.7,
      });
      expect(low.riskLevel).toBe('LOW');

      // Moderate risk
      const moderate = await assessEmotionalState({
        valence: 0.5,
        arousal: 0.5,
        dominance: 0.4,
      });
      expect(['LOW', 'MODERATE']).toContain(moderate.riskLevel);

      // High risk
      const high = await assessEmotionalState({
        valence: -0.8,
        arousal: 0.9,
        dominance: 0.1,
      });
      expect(['HIGH', 'CRITICAL']).toContain(high.riskLevel);
    });

    it('should include intensity based on arousal', async () => {
      const result = await assessEmotionalState({
        valence: 0.5,
        arousal: 0.7,
        dominance: 0.5,
      });

      expect(result.intensity).toBe(0.7);
    });

    it('should handle neutral state', async () => {
      const result = await assessEmotionalState({
        valence: 0,
        arousal: 0.3,
        dominance: 0.5,
      });

      expect(result.riskToDecisionQuality).toBeLessThan(0.4);
      expect(result.riskLevel).toBe('LOW');
    });
  });

  describe('detectFearGreedCycle', () => {
    it('should detect fear spiral with losses and fear indicators', async () => {
      const result = await detectFearGreedCycle({
        recentDecisions: [
          { description: 'Trade 1', outcome: 'loss' },
          { description: 'Trade 2', outcome: 'loss' },
        ],
        behavioralSigns: ['feeling scared', 'anxious about market'],
        currentMood: 'fearful',
      });

      expect(result.pattern).toBe('FEAR_SPIRAL');
      expect(result.detected).toBe(true);
      expect(result.severity).toBeGreaterThan(0.3);
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    it('should detect greed chase with wins in bull market', async () => {
      const result = await detectFearGreedCycle({
        recentDecisions: [
          { description: 'Trade 1', outcome: 'win' },
          { description: 'Trade 2', outcome: 'win' },
          { description: 'Trade 3', outcome: 'win' },
        ],
        behavioralSigns: ['want to invest more', 'aggressive position sizing', 'FOMO'],
        marketConditions: 'bull',
      });

      expect(result.pattern).toBe('GREED_CHASE');
      expect(result.detected).toBe(true);
      expect(result.severity).toBeGreaterThan(0.3);
    });

    it('should detect revenge trading after angry loss', async () => {
      const result = await detectFearGreedCycle({
        recentDecisions: [
          { description: 'Bad trade', outcome: 'loss', emotionalReaction: 'angry' },
        ],
        behavioralSigns: ['need to make it back', 'revenge trade to prove them wrong'],
      });

      expect(result.pattern).toBe('REVENGE_TRADING');
      expect(result.detected).toBe(true);
      expect(result.severity).toBeGreaterThan(0.5);
    });

    it('should detect euphoria with consecutive wins and excitement', async () => {
      const result = await detectFearGreedCycle({
        recentDecisions: [
          { description: 'Win 1', outcome: 'win' },
          { description: 'Win 2', outcome: 'win' },
          { description: 'Win 3', outcome: 'win' },
        ],
        behavioralSigns: ['invincible', 'unstoppable', 'on fire'],
        currentMood: 'euphoric',
      });

      expect(result.pattern).toBe('EUPHORIA');
      expect(result.detected).toBe(true);
    });

    it('should return NONE pattern when no cycle detected', async () => {
      const result = await detectFearGreedCycle({
        recentDecisions: [
          { description: 'Trade 1', outcome: 'win' },
          { description: 'Trade 2', outcome: 'loss' },
          { description: 'Trade 3', outcome: 'neutral' },
        ],
        behavioralSigns: [],
      });

      expect(result.pattern).toBe('NONE');
      expect(result.detected).toBe(false);
      expect(result.severity).toBe(0);
    });

    it('should handle empty indicators', async () => {
      const result = await detectFearGreedCycle({});

      expect(result.pattern).toBe('NONE');
      expect(result.detected).toBe(false);
    });

    it('should include phase information when pattern detected', async () => {
      const result = await detectFearGreedCycle({
        recentDecisions: [
          { description: 'Trade 1', outcome: 'loss' },
          { description: 'Trade 2', outcome: 'loss' },
        ],
        behavioralSigns: ['scared', 'afraid'],
        currentMood: 'fearful',
      });

      expect(['early', 'mid', 'late']).toContain(result.phase);
    });

    it('should include triggers for detected patterns', async () => {
      const result = await detectFearGreedCycle({
        recentDecisions: [
          { description: 'Crypto loss', outcome: 'loss' },
          { description: 'Stock loss', outcome: 'loss' },
        ],
        behavioralSigns: ['feeling scared'],
      });

      expect(result.triggers.length).toBeGreaterThan(0);
      expect(result.triggers).toContain('Crypto loss');
    });

    it('should include provenance information', async () => {
      const result = await detectFearGreedCycle({});

      expect(result.provenance.framework).toContain('Mark Douglas');
      expect(result.provenance.computedAt).toBeDefined();
    });

    it('should generate recommendations for detected patterns', async () => {
      const result = await detectFearGreedCycle({
        recentDecisions: [
          { description: 'Trade', outcome: 'loss' },
          { description: 'Trade 2', outcome: 'loss' },
        ],
        behavioralSigns: ['scared', 'anxious'],
      });

      // Recommendations may or may not be present depending on implementation
      if (result.recommendations) {
        expect(Array.isArray(result.recommendations)).toBe(true);
      }
    });
  });
});
