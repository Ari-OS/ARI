import { describe, it, expect, beforeEach } from 'vitest';
import { GovernanceReporter } from '../../../src/autonomous/governance-reporter.js';

describe('GovernanceReporter', () => {
  let reporter: GovernanceReporter;

  beforeEach(() => {
    reporter = new GovernanceReporter();
  });

  it('should record events', () => {
    reporter.recordEvent('vote:started', { voteId: 'v1', topic: 'Test', threshold: 'MAJORITY', deadline: new Date().toISOString() });
    expect(reporter.getEventCount()).toBe(1);
  });

  it('should generate empty snapshot when no events', () => {
    const snapshot = reporter.generateSnapshot();

    expect(snapshot.council.votesCreated).toBe(0);
    expect(snapshot.council.votesCompleted).toBe(0);
    expect(snapshot.arbiter.evaluations).toBe(0);
    expect(snapshot.overseer.gatesChecked).toBe(0);
    expect(snapshot.pipeline.totalEvents).toBe(0);
  });

  it('should generate snapshot with vote events', () => {
    const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    reporter.recordEvent('vote:started', {
      voteId: 'v1',
      topic: 'Security change',
      threshold: 'MAJORITY',
      deadline,
    });

    reporter.recordEvent('vote:started', {
      voteId: 'v2',
      topic: 'Resource allocation',
      threshold: 'SUPERMAJORITY',
      deadline,
    });

    reporter.recordEvent('vote:completed', {
      voteId: 'v1',
      status: 'PASSED',
      result: { approve: 10, reject: 2, abstain: 3, threshold_met: true },
    });

    const snapshot = reporter.generateSnapshot();

    expect(snapshot.council.votesCreated).toBe(2);
    expect(snapshot.council.votesCompleted).toBe(1);
    expect(snapshot.council.outcomes.passed).toBe(1);
    expect(snapshot.council.outcomes.failed).toBe(0);
    expect(snapshot.council.openVotes).toHaveLength(1);
    expect(snapshot.council.openVotes[0].voteId).toBe('v2');
    expect(snapshot.council.topicsSummary).toEqual(['Security change', 'Resource allocation']);
  });

  it('should generate snapshot with veto events', () => {
    const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    reporter.recordEvent('vote:started', {
      voteId: 'v1',
      topic: 'Security change',
      threshold: 'MAJORITY',
      deadline,
    });

    reporter.recordEvent('vote:vetoed', {
      voteId: 'v1',
      vetoer: 'guardian',
      domain: 'security',
      reason: 'Violates security policy',
    });

    reporter.recordEvent('vote:completed', {
      voteId: 'v1',
      status: 'VETOED',
      result: { approve: 5, reject: 0, abstain: 0, threshold_met: false, vetoed_by: 'guardian', veto_domain: 'security' },
    });

    const snapshot = reporter.generateSnapshot();

    expect(snapshot.council.votesCreated).toBe(1);
    expect(snapshot.council.votesCompleted).toBe(1);
    expect(snapshot.council.outcomes.vetoed).toBe(1);
    expect(snapshot.council.vetoes).toHaveLength(1);
    expect(snapshot.council.vetoes[0]).toEqual({
      vetoer: 'guardian',
      domain: 'security',
      reason: 'Violates security policy',
    });
  });

  it('should generate snapshot with arbiter violations', () => {
    reporter.recordEvent('arbiter:ruling', {
      ruleId: 'r1',
      type: 'evaluation',
      decision: 'ALLOWED',
    });

    reporter.recordEvent('arbiter:ruling', {
      ruleId: 'r2',
      type: 'evaluation',
      decision: 'DENIED',
    });

    reporter.recordEvent('arbiter:ruling', {
      ruleId: 'r3',
      type: 'dispute',
      decision: 'DENIED',
    });

    const snapshot = reporter.generateSnapshot();

    expect(snapshot.arbiter.evaluations).toBe(3);
    expect(snapshot.arbiter.violations).toBe(2);
    expect(snapshot.arbiter.complianceRate).toBeCloseTo(33.33, 1);
    expect(snapshot.arbiter.violationsByRule).toEqual({
      evaluation: 1,
      dispute: 1,
    });
  });

  it('should generate snapshot with overseer gate failures', () => {
    reporter.recordEvent('overseer:gate', {
      gateId: 'test_coverage',
      passed: true,
      reason: 'All tests passed',
    });

    reporter.recordEvent('overseer:gate', {
      gateId: 'audit_integrity',
      passed: true,
      reason: 'Audit chain valid',
    });

    reporter.recordEvent('overseer:gate', {
      gateId: 'security_scan',
      passed: false,
      reason: '2 critical security events in last 24 hours',
    });

    reporter.recordEvent('overseer:gate', {
      gateId: 'build_clean',
      passed: false,
      reason: 'Build failed with 5 errors',
    });

    const snapshot = reporter.generateSnapshot();

    expect(snapshot.overseer.gatesChecked).toBe(4);
    expect(snapshot.overseer.gatesPassed).toBe(2);
    expect(snapshot.overseer.gatesFailed).toBe(2);
    expect(snapshot.overseer.failedGates).toHaveLength(2);
    expect(snapshot.overseer.failedGates[0]).toEqual({
      gateId: 'security_scan',
      reason: '2 critical security events in last 24 hours',
    });
    expect(snapshot.overseer.failedGates[1]).toEqual({
      gateId: 'build_clean',
      reason: 'Build failed with 5 errors',
    });
  });

  it('should format briefing with activity', () => {
    const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    reporter.recordEvent('vote:started', {
      voteId: 'v1',
      topic: 'Security change',
      threshold: 'MAJORITY',
      deadline,
    });

    reporter.recordEvent('vote:completed', {
      voteId: 'v1',
      status: 'PASSED',
      result: { approve: 10, reject: 2, abstain: 3, threshold_met: true },
    });

    reporter.recordEvent('vote:started', {
      voteId: 'v2',
      topic: 'Resource change',
      threshold: 'MAJORITY',
      deadline,
    });

    reporter.recordEvent('vote:vetoed', {
      voteId: 'v2',
      vetoer: 'guardian',
      domain: 'security',
      reason: 'Violates policy',
    });

    reporter.recordEvent('vote:completed', {
      voteId: 'v2',
      status: 'VETOED',
      result: { approve: 5, reject: 0, abstain: 0, threshold_met: false },
    });

    reporter.recordEvent('arbiter:ruling', {
      ruleId: 'r1',
      type: 'evaluation',
      decision: 'ALLOWED',
    });

    reporter.recordEvent('arbiter:ruling', {
      ruleId: 'r2',
      type: 'evaluation',
      decision: 'ALLOWED',
    });

    reporter.recordEvent('overseer:gate', {
      gateId: 'test_coverage',
      passed: true,
      reason: 'All tests passed',
    });

    const formatted = reporter.formatForBriefing(reporter.generateSnapshot());

    expect(formatted).toContain('<b>⚖️ Governance</b>');
    expect(formatted).toContain('Council: 2 votes (1 passed, 1 vetoed)');
    expect(formatted).toContain('Veto: guardian blocked security');
    expect(formatted).toContain('Arbiter: 2 evaluations, 100% compliant');
    expect(formatted).toContain('Gates: 1/1 passing');
    expect(formatted).toContain('Pipeline: 8 governance events processed');
  });

  it('should format briefing without activity', () => {
    const formatted = reporter.formatForBriefing(reporter.generateSnapshot());

    expect(formatted).toBe('<b>⚖️ Governance</b>\n▸ No governance activity in the last 24 hours');
  });

  it('should prune old events', () => {
    // Create reporter with 100ms retention
    const shortRetention = new GovernanceReporter(100);

    shortRetention.recordEvent('vote:started', {
      voteId: 'v1',
      topic: 'Test',
      threshold: 'MAJORITY',
      deadline: new Date().toISOString(),
    });

    expect(shortRetention.getEventCount()).toBe(1);

    // Wait for retention to expire
    return new Promise<void>(resolve => {
      setTimeout(() => {
        // Add new event to trigger pruning
        shortRetention.recordEvent('vote:started', {
          voteId: 'v2',
          topic: 'Test2',
          threshold: 'MAJORITY',
          deadline: new Date().toISOString(),
        });

        // Old event should be pruned
        expect(shortRetention.getEventCount()).toBe(1);
        resolve();
      }, 150);
    });
  });

  it('should count pipeline events by type', () => {
    reporter.recordEvent('vote:started', { voteId: 'v1', topic: 'Test', threshold: 'MAJORITY', deadline: new Date().toISOString() });
    reporter.recordEvent('vote:started', { voteId: 'v2', topic: 'Test2', threshold: 'MAJORITY', deadline: new Date().toISOString() });
    reporter.recordEvent('vote:completed', { voteId: 'v1', status: 'PASSED', result: {} });
    reporter.recordEvent('arbiter:ruling', { ruleId: 'r1', type: 'evaluation', decision: 'ALLOWED' });
    reporter.recordEvent('overseer:gate', { gateId: 'test', passed: true, reason: 'OK' });

    const snapshot = reporter.generateSnapshot();

    expect(snapshot.pipeline.totalEvents).toBe(5);
    expect(snapshot.pipeline.eventsByType['vote:started']).toBe(2);
    expect(snapshot.pipeline.eventsByType['vote:completed']).toBe(1);
    expect(snapshot.pipeline.eventsByType['arbiter:ruling']).toBe(1);
    expect(snapshot.pipeline.eventsByType['overseer:gate']).toBe(1);
  });

  it('should clear all events', () => {
    reporter.recordEvent('vote:started', { voteId: 'v1', topic: 'Test', threshold: 'MAJORITY', deadline: new Date().toISOString() });
    reporter.recordEvent('arbiter:ruling', { ruleId: 'r1', type: 'evaluation', decision: 'ALLOWED' });

    expect(reporter.getEventCount()).toBe(2);

    reporter.clear();

    expect(reporter.getEventCount()).toBe(0);
  });

  it('should handle 100% compliance rate with no violations', () => {
    reporter.recordEvent('arbiter:ruling', { ruleId: 'r1', type: 'evaluation', decision: 'ALLOWED' });
    reporter.recordEvent('arbiter:ruling', { ruleId: 'r2', type: 'evaluation', decision: 'ALLOWED' });

    const snapshot = reporter.generateSnapshot();

    expect(snapshot.arbiter.evaluations).toBe(2);
    expect(snapshot.arbiter.violations).toBe(0);
    expect(snapshot.arbiter.complianceRate).toBe(100);
  });

  it('should handle multiple vote outcomes', () => {
    const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    reporter.recordEvent('vote:started', { voteId: 'v1', topic: 'Test1', threshold: 'MAJORITY', deadline });
    reporter.recordEvent('vote:completed', { voteId: 'v1', status: 'PASSED', result: {} });

    reporter.recordEvent('vote:started', { voteId: 'v2', topic: 'Test2', threshold: 'MAJORITY', deadline });
    reporter.recordEvent('vote:completed', { voteId: 'v2', status: 'FAILED', result: {} });

    reporter.recordEvent('vote:started', { voteId: 'v3', topic: 'Test3', threshold: 'MAJORITY', deadline });
    reporter.recordEvent('vote:completed', { voteId: 'v3', status: 'EXPIRED', result: {} });

    reporter.recordEvent('vote:started', { voteId: 'v4', topic: 'Test4', threshold: 'MAJORITY', deadline });
    reporter.recordEvent('vote:completed', { voteId: 'v4', status: 'VETOED', result: {} });

    const snapshot = reporter.generateSnapshot();

    expect(snapshot.council.outcomes.passed).toBe(1);
    expect(snapshot.council.outcomes.failed).toBe(1);
    expect(snapshot.council.outcomes.expired).toBe(1);
    expect(snapshot.council.outcomes.vetoed).toBe(1);
  });

  it('should handle custom time windows', () => {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    // Create reporter with 24-hour retention
    const customReporter = new GovernanceReporter(24 * 60 * 60 * 1000);

    // Manually add event with old timestamp
    customReporter['events'].push({
      type: 'vote:started',
      payload: { voteId: 'v1', topic: 'Old vote', threshold: 'MAJORITY', deadline: new Date().toISOString() },
      timestamp: oneHourAgo,
    });

    customReporter.recordEvent('vote:started', {
      voteId: 'v2',
      topic: 'Recent vote',
      threshold: 'MAJORITY',
      deadline: new Date().toISOString(),
    });

    // Full window: both events
    expect(customReporter.getEventCount()).toBe(2);

    // 30-minute window: only recent event
    expect(customReporter.getEventCount(30 * 60 * 1000)).toBe(1);
  });
});
