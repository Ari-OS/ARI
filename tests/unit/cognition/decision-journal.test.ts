import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import fs from 'node:fs/promises';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { DecisionJournal } from '../../../src/cognition/learning/decision-journal.js';

describe('DecisionJournal', () => {
  let journal: DecisionJournal;
  let eventBus: EventBus;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `ari-journal-test-${randomUUID()}`);
    eventBus = new EventBus();
    journal = new DecisionJournal(tmpDir);
    await journal.initialize(eventBus);
  });

  afterEach(async () => {
    await journal.shutdown();
    try { await fs.rm(tmpDir, { recursive: true }); } catch { /* noop */ }
  });

  describe('Event Capture', () => {
    it('should capture cognition:belief_updated events', () => {
      eventBus.emit('cognition:belief_updated', {
        hypothesis: 'Test hypothesis',
        priorProbability: 0.3,
        posteriorProbability: 0.7,
        shift: 0.4,
        agent: 'logos',
        timestamp: new Date().toISOString(),
      });

      const entries = journal.getRecentDecisions(1);
      expect(entries).toHaveLength(1);
      expect(entries[0].pillar).toBe('LOGOS');
      expect(entries[0].frameworks_used).toContain('Bayesian Reasoning');
      expect(entries[0].confidence).toBe(0.8); // shift > 0.2
    });

    it('should capture cognition:expected_value_calculated events', () => {
      eventBus.emit('cognition:expected_value_calculated', {
        decision: 'Buy or sell',
        expectedValue: 25.5,
        recommendation: 'PROCEED',
        agent: 'logos',
        timestamp: new Date().toISOString(),
      });

      const entries = journal.getRecentDecisions(1);
      expect(entries).toHaveLength(1);
      expect(entries[0].frameworks_used).toContain('Expected Value Theory');
    });

    it('should capture cognition:bias_detected events with bias list', () => {
      eventBus.emit('cognition:bias_detected', {
        agent: 'ethos',
        biases: [
          { type: 'CONFIRMATION_BIAS', severity: 0.8 },
          { type: 'ANCHORING_BIAS', severity: 0.5 },
        ],
        reasoning: 'Strong anchoring detected',
        timestamp: new Date().toISOString(),
      });

      const entries = journal.getRecentDecisions(1);
      expect(entries).toHaveLength(1);
      expect(entries[0].biases_detected).toEqual(['CONFIRMATION_BIAS', 'ANCHORING_BIAS']);
      expect(entries[0].pillar).toBe('ETHOS');
    });

    it('should capture cognition:emotional_risk with emotional context', () => {
      eventBus.emit('cognition:emotional_risk', {
        agent: 'ethos',
        state: { valence: -0.6, arousal: 0.9, dominance: 0.2 },
        riskScore: 0.85,
        emotions: ['panic', 'fear'],
        timestamp: new Date().toISOString(),
      });

      const entries = journal.getRecentDecisions(1);
      expect(entries).toHaveLength(1);
      expect(entries[0].emotional_context).toEqual({
        valence: -0.6,
        arousal: 0.9,
        dominance: 0.2,
      });
    });

    it('should capture cognition:thought_reframed events', () => {
      eventBus.emit('cognition:thought_reframed', {
        original: 'Everything is ruined',
        distortions: ['CATASTROPHIZING'],
        reframed: 'This is a setback',
        agent: 'pathos',
        timestamp: new Date().toISOString(),
      });

      const entries = journal.getRecentDecisions(1);
      expect(entries).toHaveLength(1);
      expect(entries[0].pillar).toBe('PATHOS');
      expect(entries[0].frameworks_used).toContain('Cognitive Behavioral Therapy (Beck)');
    });

    it('should capture cognition:wisdom_consulted events', () => {
      eventBus.emit('cognition:wisdom_consulted', {
        query: 'How to handle loss?',
        tradition: 'Stoicism',
        principle: 'Amor fati',
        agent: 'pathos',
        timestamp: new Date().toISOString(),
      });

      const entries = journal.getRecentDecisions(1);
      expect(entries).toHaveLength(1);
      expect(entries[0].frameworks_used).toContain('Wisdom Traditions (Stoicism)');
    });
  });

  describe('Query API', () => {
    beforeEach(() => {
      // Add some test entries
      journal.recordDecision({
        decision: 'LOGOS decision 1',
        frameworks_used: ['Bayesian Reasoning'],
        pillar: 'LOGOS',
        confidence: 0.8,
      });
      journal.recordDecision({
        decision: 'ETHOS decision 1',
        frameworks_used: ['Cognitive Bias Detection'],
        pillar: 'ETHOS',
        confidence: 0.7,
        biases_detected: ['ANCHORING_BIAS'],
      });
      journal.recordDecision({
        decision: 'PATHOS decision 1',
        frameworks_used: ['Reflection Engine (Kolb)'],
        pillar: 'PATHOS',
        confidence: 0.75,
      });
    });

    it('should filter by pillar', () => {
      const logos = journal.getDecisionsByPillar('LOGOS');
      expect(logos).toHaveLength(1);
      expect(logos[0].decision).toBe('LOGOS decision 1');
    });

    it('should filter by framework', () => {
      const bayesian = journal.getDecisionsByFramework('Bayesian Reasoning');
      expect(bayesian).toHaveLength(1);
    });

    it('should return all recent decisions', () => {
      const recent = journal.getRecentDecisions(1);
      expect(recent).toHaveLength(3);
      // All three pillars represented
      const pillars = recent.map((e) => e.pillar);
      expect(pillars).toContain('LOGOS');
      expect(pillars).toContain('ETHOS');
      expect(pillars).toContain('PATHOS');
    });

    it('should compute stats correctly', () => {
      const stats = journal.getDecisionStats();
      expect(stats.total).toBe(3);
      expect(stats.by_pillar['LOGOS']).toBe(1);
      expect(stats.by_pillar['ETHOS']).toBe(1);
      expect(stats.by_pillar['PATHOS']).toBe(1);
      expect(stats.average_confidence).toBeCloseTo(0.75, 1);
    });
  });

  describe('Outcome Tracking', () => {
    it('should default outcome to pending', () => {
      journal.recordDecision({
        decision: 'Test decision',
        frameworks_used: ['Kelly Criterion'],
        pillar: 'LOGOS',
        confidence: 0.9,
      });

      const entries = journal.getRecentDecisions(1);
      expect(entries[0].outcome).toBe('pending');
    });

    it('should update outcome', () => {
      const entry = journal.recordDecision({
        decision: 'Decision to track',
        frameworks_used: ['Expected Value Theory'],
        pillar: 'LOGOS',
        confidence: 0.85,
      });

      const updated = journal.updateOutcome(entry.id, 'success');
      expect(updated).toBe(true);

      const entries = journal.getRecentDecisions(1);
      expect(entries[0].outcome).toBe('success');
    });

    it('should return false for non-existent entry', () => {
      const result = journal.updateOutcome('nonexistent-id', 'failure');
      expect(result).toBe(false);
    });
  });

  describe('Persistence', () => {
    it('should persist and reload entries across instances', async () => {
      journal.recordDecision({
        decision: 'Persistent decision',
        frameworks_used: ['Systems Thinking (Meadows)'],
        pillar: 'LOGOS',
        confidence: 0.9,
      });

      // Shutdown triggers final persist
      await journal.shutdown();

      // Create new instance pointing to same directory
      const journal2 = new DecisionJournal(tmpDir);
      await journal2.initialize(eventBus);

      const entries = journal2.getRecentDecisions(1);
      expect(entries).toHaveLength(1);
      expect(entries[0].decision).toBe('Persistent decision');

      await journal2.shutdown();
    });

    it('should handle corrupted files gracefully', async () => {
      await journal.shutdown();

      // Write corrupted data
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const filePath = join(tmpDir, `${monthKey}.json`);
      await fs.writeFile(filePath, 'not valid json{{{');

      // Should load without crashing
      const journal2 = new DecisionJournal(tmpDir);
      await journal2.initialize(eventBus);

      expect(journal2.size).toBe(0);

      await journal2.shutdown();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe from events on shutdown', async () => {
      await journal.shutdown();

      // Emit events — should not add entries
      eventBus.emit('cognition:belief_updated', {
        hypothesis: 'After shutdown',
        priorProbability: 0.5,
        posteriorProbability: 0.9,
        shift: 0.4,
        agent: 'logos',
        timestamp: new Date().toISOString(),
      });

      // Re-init to check size
      const journal2 = new DecisionJournal(tmpDir);
      await journal2.initialize(eventBus);
      // Only events after re-init should be captured
      expect(journal2.size).toBe(0);
      await journal2.shutdown();
    });
  });
});
