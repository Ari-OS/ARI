import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { Council } from '../../../src/governance/council.js';
import { FeedbackManager } from '../../../src/governance/council-feedback.js';
import { OutcomeTracker } from '../../../src/governance/council-deliberation.js';
import { COUNCIL_MEMBERS } from '../../../src/governance/council-members.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import type { AgentId, VoteOption } from '../../../src/kernel/types.js';
import { VOTING_AGENTS } from '../../../src/kernel/types.js';

// ── Test Utilities ───────────────────────────────────────────────────────────

/**
 * Helper to create a council with all agents voting from specific pillars.
 */
function castVotesFromPillars(
  council: Council,
  voteId: string,
  pillarVotes: Record<string, { agents: AgentId[]; option: 'APPROVE' | 'REJECT' | 'ABSTAIN' }>,
) {
  for (const { agents, option } of Object.values(pillarVotes)) {
    for (const agent of agents) {
      council.castVote(voteId, agent, option, `${option} reasoning`);
    }
  }
}

/**
 * Helper to get voting agents by pillar.
 */
function getAgentsByPillar(pillar: string): AgentId[] {
  return VOTING_AGENTS.filter(agentId => {
    const member = COUNCIL_MEMBERS[agentId];
    return member?.pillar === pillar;
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: COUNCIL IMPROVEMENTS
// ══════════════════════════════════════════════════════════════════════════════

describe('Council Improvements', () => {
  let council: Council;
  let auditLogger: AuditLogger;
  let eventBus: EventBus;
  let feedbackManager: FeedbackManager;
  let outcomeTracker: OutcomeTracker;

  beforeEach(() => {
    const logPath = join(tmpdir(), `audit-${randomUUID()}.jsonl`);
    auditLogger = new AuditLogger(logPath);
    eventBus = new EventBus();
    council = new Council(auditLogger, eventBus);

    // Get the outcomeTracker from the council
    outcomeTracker = council.getOutcomeTracker();
    feedbackManager = new FeedbackManager(eventBus, auditLogger, outcomeTracker);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. PILLAR QUORUM
  // ════════════════════════════════════════════════════════════════════════════

  describe('Pillar Quorum', () => {
    it('should have met=true when 3+ pillars are represented', () => {
      const vote = council.createVote({
        topic: 'Test with 3 pillars',
        description: 'Testing pillar quorum',
        threshold: 'MAJORITY',
        initiated_by: 'router',
      });

      // Vote from Infrastructure, Protection, and Strategy (3 pillars)
      castVotesFromPillars(council, vote.vote_id, {
        infrastructure: { agents: ['router', 'executor'], option: 'APPROVE' },
        protection: { agents: ['guardian'], option: 'APPROVE' },
        strategy: { agents: ['planner'], option: 'APPROVE' },
      });

      const retrievedVote = council.getVote(vote.vote_id);
      const pillarQuorum = council.checkPillarQuorum(retrievedVote!);

      expect(pillarQuorum.met).toBe(true);
      expect(pillarQuorum.pillarsRepresented).toHaveLength(3);
      expect(pillarQuorum.countQuorumMet).toBe(false); // Only 4 votes, need 8
      expect(pillarQuorum.totalVoted).toBe(4);
    });

    it('should have met=false when only 2 pillars are represented', () => {
      const vote = council.createVote({
        topic: 'Test with 2 pillars',
        description: 'Testing pillar quorum failure',
        threshold: 'MAJORITY',
        initiated_by: 'router',
      });

      // Vote from only Infrastructure and Protection (2 pillars)
      castVotesFromPillars(council, vote.vote_id, {
        infrastructure: { agents: ['router', 'executor', 'memory_keeper'], option: 'APPROVE' },
        protection: { agents: ['guardian', 'risk_assessor'], option: 'APPROVE' },
      });

      const retrievedVote = council.getVote(vote.vote_id);
      const pillarQuorum = council.checkPillarQuorum(retrievedVote!);

      expect(pillarQuorum.met).toBe(false);
      expect(pillarQuorum.pillarsRepresented).toHaveLength(2);
      expect(pillarQuorum.missingPillars).toHaveLength(3);
    });

    it('should have met=true and missingPillars=[] when all 5 pillars vote', () => {
      const vote = council.createVote({
        topic: 'Test with all pillars',
        description: 'Full pillar representation',
        threshold: 'MAJORITY',
        initiated_by: 'router',
      });

      // Vote from all 5 pillars
      castVotesFromPillars(council, vote.vote_id, {
        infrastructure: { agents: ['router'], option: 'APPROVE' },
        protection: { agents: ['guardian'], option: 'APPROVE' },
        strategy: { agents: ['planner'], option: 'APPROVE' },
        domains: { agents: ['wellness'], option: 'APPROVE' },
        meta: { agents: ['ethics'], option: 'APPROVE' },
      });

      const retrievedVote = council.getVote(vote.vote_id);
      const pillarQuorum = council.checkPillarQuorum(retrievedVote!);

      expect(pillarQuorum.met).toBe(true);
      expect(pillarQuorum.pillarsRepresented).toHaveLength(5);
      expect(pillarQuorum.missingPillars).toEqual([]);
    });

    it('should downgrade PASSED to FAILED when pillar quorum fails but count quorum passes', () => {
      const vote = council.createVote({
        topic: 'Test pillar quorum enforcement',
        description: 'Testing pillar quorum downgrade',
        threshold: 'MAJORITY',
        initiated_by: 'router',
      });

      // Get 8+ votes (count quorum) from only 2 pillars
      const infraAgents = getAgentsByPillar('infrastructure');
      const domainAgents = getAgentsByPillar('domains');

      castVotesFromPillars(council, vote.vote_id, {
        infrastructure: { agents: infraAgents, option: 'APPROVE' },
        domains: { agents: domainAgents, option: 'APPROVE' },
      });

      // Manually close as PASSED to test downgrade
      council.closeVote(vote.vote_id, 'PASSED');

      const finalVote = council.getVote(vote.vote_id);
      expect(finalVote?.status).toBe('FAILED'); // Downgraded from PASSED
      expect(finalVote?.result?.threshold_met).toBe(false);
    });

    it('should emit council:pillar_quorum_failed event when pillar quorum fails', () => {
      const emittedEvents: any[] = [];

      eventBus.on('council:pillar_quorum_failed', (payload: any) => {
        emittedEvents.push(payload);
      });

      const vote = council.createVote({
        topic: 'Test pillar quorum event',
        description: 'Testing event emission',
        threshold: 'MAJORITY',
        initiated_by: 'router',
      });

      // Get 8+ votes from only 2 pillars
      const infraAgents = getAgentsByPillar('infrastructure');
      const domainAgents = getAgentsByPillar('domains');

      castVotesFromPillars(council, vote.vote_id, {
        infrastructure: { agents: infraAgents, option: 'APPROVE' },
        domains: { agents: domainAgents, option: 'APPROVE' },
      });

      council.closeVote(vote.vote_id, 'PASSED');

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].voteId).toBe(vote.vote_id);
      expect(emittedEvents[0].pillarsRepresented).toHaveLength(2);
      expect(emittedEvents[0].missingPillars).toHaveLength(3);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. DISSENT REPORTS
  // ════════════════════════════════════════════════════════════════════════════

  describe('Dissent Reports', () => {
    it('should generate dissent report when consensus < 80% (60% consensus)', () => {
      const vote = council.createVote({
        topic: 'Controversial proposal',
        description: 'This will create dissent',
        threshold: 'MAJORITY',
        initiated_by: 'router',
      });

      // Create a 9-6 vote (60% consensus) — rejections first to avoid auto-close
      const approvingAgents = VOTING_AGENTS.slice(0, 9);
      const rejectingAgents = VOTING_AGENTS.slice(9, 15);

      castVotesFromPillars(council, vote.vote_id, {
        rejectors: { agents: rejectingAgents, option: 'REJECT' },
        approvers: { agents: approvingAgents, option: 'APPROVE' },
      });

      const dissentReport = council.getDissentReport(vote.vote_id);

      expect(dissentReport).toBeDefined();
      expect(dissentReport?.voteId).toBe(vote.vote_id);
      expect(dissentReport?.decision).toBe('PASSED');
      expect(dissentReport?.dissenters).toHaveLength(6);
      // 6 rejects + 8 approvals (auto-close at majority) = 8/14 ≈ 0.571
      expect(dissentReport?.consensusStrength).toBeCloseTo(8 / 14, 2);
    });

    it('should NOT generate dissent report when consensus >= 80% (93% consensus)', () => {
      const vote = council.createVote({
        topic: 'Clear consensus proposal',
        description: 'This will not create dissent',
        threshold: 'MAJORITY',
        initiated_by: 'router',
      });

      // Create a 14-1 vote (93% consensus)
      const approvingAgents = VOTING_AGENTS.slice(0, 14);
      const rejectingAgents = VOTING_AGENTS.slice(14, 15);

      castVotesFromPillars(council, vote.vote_id, {
        approvers: { agents: approvingAgents, option: 'APPROVE' },
        rejectors: { agents: rejectingAgents, option: 'REJECT' },
      });

      council.closeVote(vote.vote_id, 'PASSED');

      const dissentReport = council.getDissentReport(vote.vote_id);

      expect(dissentReport).toBeUndefined();
    });

    it('should capture dissenter names, pillars, and reasoning in report', () => {
      const vote = council.createVote({
        topic: 'Test dissent details',
        description: 'Testing dissent report structure',
        threshold: 'MAJORITY',
        initiated_by: 'router',
      });

      // Create dissent — cast rejections FIRST to avoid auto-close
      const approvingAgents = VOTING_AGENTS.slice(0, 9);
      const rejectingAgents: AgentId[] = VOTING_AGENTS.slice(9, 15);

      castVotesFromPillars(council, vote.vote_id, {
        rejectors: { agents: rejectingAgents, option: 'REJECT' },
        approvers: { agents: approvingAgents, option: 'APPROVE' },
      });

      const report = council.getDissentReport(vote.vote_id);

      expect(report).toBeDefined();
      expect(report?.dissenters).toHaveLength(6);

      // Check that each dissenter has proper metadata
      for (const dissenter of report!.dissenters) {
        expect(dissenter.agentId).toBeDefined();
        expect(dissenter.memberName).toBeDefined();
        expect(dissenter.pillar).toBeDefined();
        expect(dissenter.vote).toBe('REJECT');
        expect(dissenter.reasoning).toBe('REJECT reasoning');

        // Verify it's a real council member
        const member = COUNCIL_MEMBERS[dissenter.agentId];
        expect(member).toBeDefined();
        expect(dissenter.memberName).toBe(member?.name);
        expect(dissenter.pillar).toBe(member?.pillar);
      }
    });

    it('should return dissent report via getDissentReport', () => {
      const vote = council.createVote({
        topic: 'Test report retrieval',
        description: 'Testing getDissentReport',
        threshold: 'MAJORITY',
        initiated_by: 'router',
      });

      const approvingAgents = VOTING_AGENTS.slice(0, 9);
      const rejectingAgents = VOTING_AGENTS.slice(9, 15);

      castVotesFromPillars(council, vote.vote_id, {
        rejectors: { agents: rejectingAgents, option: 'REJECT' },
        approvers: { agents: approvingAgents, option: 'APPROVE' },
      });

      const report = council.getDissentReport(vote.vote_id);

      expect(report).toBeDefined();
      expect(report?.voteId).toBe(vote.vote_id);
    });

    it('should return all reports via getAllDissentReports', () => {
      // Create two votes with dissent
      const vote1 = council.createVote({
        topic: 'First dissent',
        description: 'First',
        threshold: 'MAJORITY',
        initiated_by: 'router',
      });

      const vote2 = council.createVote({
        topic: 'Second dissent',
        description: 'Second',
        threshold: 'MAJORITY',
        initiated_by: 'router',
      });

      const approvingAgents = VOTING_AGENTS.slice(0, 9);
      const rejectingAgents = VOTING_AGENTS.slice(9, 15);

      // Create dissent in both votes — rejections first to avoid auto-close
      castVotesFromPillars(council, vote1.vote_id, {
        rejectors: { agents: rejectingAgents, option: 'REJECT' },
        approvers: { agents: approvingAgents, option: 'APPROVE' },
      });

      castVotesFromPillars(council, vote2.vote_id, {
        rejectors: { agents: rejectingAgents, option: 'REJECT' },
        approvers: { agents: approvingAgents, option: 'APPROVE' },
      });

      const allReports = council.getAllDissentReports();

      expect(allReports).toHaveLength(2);
      expect(allReports.map(r => r.voteId)).toContain(vote1.vote_id);
      expect(allReports.map(r => r.voteId)).toContain(vote2.vote_id);
    });

    it('should find precedents based on word overlap', () => {
      // Create first vote with dissent about "security"
      const vote1 = council.createVote({
        topic: 'Security policy changes',
        description: 'Updating security measures',
        threshold: 'MAJORITY',
        initiated_by: 'router',
        domains: ['security'],
      });

      const approvingAgents = VOTING_AGENTS.slice(0, 9);
      const rejectingAgents = VOTING_AGENTS.slice(9, 15);

      castVotesFromPillars(council, vote1.vote_id, {
        rejectors: { agents: rejectingAgents, option: 'REJECT' },
        approvers: { agents: approvingAgents, option: 'APPROVE' },
      });

      // Create second vote also about "security"
      const vote2 = council.createVote({
        topic: 'Security protocol updates',
        description: 'New security protocols',
        threshold: 'MAJORITY',
        initiated_by: 'router',
        domains: ['security'],
      });

      castVotesFromPillars(council, vote2.vote_id, {
        rejectors: { agents: rejectingAgents, option: 'REJECT' },
        approvers: { agents: approvingAgents, option: 'APPROVE' },
      });

      const report2 = council.getDissentReport(vote2.vote_id);

      // Report 2 should reference report 1 as a precedent
      expect(report2?.precedents).toBeDefined();
      expect(report2?.precedents.length).toBeGreaterThan(0);

      // Check if vote1 is in precedents
      const hasPrecedent = report2?.precedents.some(p => p.voteId === vote1.vote_id);
      expect(hasPrecedent).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. EMERGENCY FAST-TRACK VOTING
  // ════════════════════════════════════════════════════════════════════════════

  describe('Emergency Fast-Track', () => {
    it('should create emergency vote with 3-5 panel members', () => {
      const { vote, emergency } = council.createEmergencyVote({
        topic: 'Critical security issue',
        description: 'Immediate action required',
        urgency_reason: 'Active threat detected',
        initiated_by: 'guardian',
        domains: ['security'],
      });

      expect(vote).toBeDefined();
      expect(emergency.panelMembers.length).toBeGreaterThanOrEqual(3);
      expect(emergency.panelMembers.length).toBeLessThanOrEqual(5);
    });

    it('should always include VERA (ethics) in emergency panel', () => {
      const { emergency } = council.createEmergencyVote({
        topic: 'Emergency decision',
        description: 'Urgent',
        urgency_reason: 'Critical',
        initiated_by: 'guardian',
        domains: ['security'],
      });

      expect(emergency.panelMembers).toContain('ethics' as AgentId);
    });

    it('should allow panel members to cast emergency votes', () => {
      const { vote, emergency } = council.createEmergencyVote({
        topic: 'Emergency action',
        description: 'Urgent decision',
        urgency_reason: 'Critical situation',
        initiated_by: 'guardian',
        domains: ['security'],
      });

      const panelMember = emergency.panelMembers[0];
      const result = council.castEmergencyVote(
        vote.vote_id,
        panelMember,
        'APPROVE',
        'Emergency approval'
      );

      expect(result).toBe(true);
    });

    it('should reject non-panel members from casting emergency votes', () => {
      const { vote, emergency } = council.createEmergencyVote({
        topic: 'Emergency action',
        description: 'Urgent decision',
        urgency_reason: 'Critical situation',
        initiated_by: 'guardian',
        domains: ['security'],
      });

      // Find a voting agent not on the panel
      const nonPanelMember = VOTING_AGENTS.find(
        agent => !emergency.panelMembers.includes(agent)
      )!;

      const result = council.castEmergencyVote(
        vote.vote_id,
        nonPanelMember,
        'APPROVE',
        'Trying to approve'
      );

      expect(result).toBe(false);
    });

    it('should prefix emergency vote topic with [EMERGENCY]', () => {
      const { vote } = council.createEmergencyVote({
        topic: 'Critical issue',
        description: 'Urgent',
        urgency_reason: 'Critical',
        initiated_by: 'guardian',
        domains: ['security'],
      });

      expect(vote.topic).toContain('[EMERGENCY]');
      expect(vote.topic).toContain('Critical issue');
    });

    it('should create overturn vote with SUPERMAJORITY threshold', () => {
      const { vote: emergencyVote } = council.createEmergencyVote({
        topic: 'Emergency decision',
        description: 'Urgent',
        urgency_reason: 'Critical',
        initiated_by: 'guardian',
        domains: ['security'],
      });

      const overturnVote = council.requestEmergencyOverturn(
        emergencyVote.vote_id,
        'ethics',
        'I disagree with this emergency decision'
      );

      expect(overturnVote).toBeDefined();
      expect(overturnVote?.threshold).toBe('SUPERMAJORITY');
      expect(overturnVote?.topic).toContain('[OVERTURN]');
    });

    it('should fail overturn request after 24h window', () => {
      const { vote: emergencyVote, emergency } = council.createEmergencyVote({
        topic: 'Emergency decision',
        description: 'Urgent',
        urgency_reason: 'Critical',
        initiated_by: 'guardian',
        domains: ['security'],
      });

      // Manually set overturn deadline to the past
      emergency.overturnDeadline = new Date(Date.now() - 1000).toISOString();

      const overturnVote = council.requestEmergencyOverturn(
        emergencyVote.vote_id,
        'ethics',
        'Too late to overturn'
      );

      expect(overturnVote).toBeNull();
    });

    it('should mark original vote as OVERTURNED when overturn passes', () => {
      const { vote: emergencyVote } = council.createEmergencyVote({
        topic: 'Emergency decision',
        description: 'Urgent',
        urgency_reason: 'Critical',
        initiated_by: 'guardian',
        domains: ['security'],
      });

      // Create overturn vote
      const overturnVote = council.requestEmergencyOverturn(
        emergencyVote.vote_id,
        'ethics',
        'Disagreement'
      );

      expect(overturnVote).toBeDefined();

      // Pass the overturn vote with SUPERMAJORITY (10/15)
      const approvingAgents = VOTING_AGENTS.slice(0, 10);
      castVotesFromPillars(council, overturnVote!.vote_id, {
        approvers: { agents: approvingAgents, option: 'APPROVE' },
      });

      // Close overturn vote as PASSED
      council.closeVote(overturnVote!.vote_id, 'PASSED');

      // Complete the overturn
      const completed = council.completeOverturn(overturnVote!.vote_id);
      expect(completed).toBe(true);

      // Check that original vote is marked OVERTURNED
      const originalVote = council.getVote(emergencyVote.vote_id);
      expect(originalVote?.status).toBe('OVERTURNED');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. USER FEEDBACK LOOP
  // ════════════════════════════════════════════════════════════════════════════

  describe('User Feedback Loop', () => {
    describe('Significance Calculation', () => {
      it('should assign critical significance for UNANIMOUS threshold', () => {
        const vote = council.createVote({
          topic: 'Critical vote',
          description: 'Testing significance',
          threshold: 'UNANIMOUS',
          initiated_by: 'router',
        });

        // Get all agents to vote
        castVotesFromPillars(council, vote.vote_id, {
          all: { agents: VOTING_AGENTS as AgentId[], option: 'APPROVE' },
        });

        council.closeVote(vote.vote_id, 'PASSED');

        const finalVote = council.getVote(vote.vote_id);
        const memberVotes: Record<string, string> = {};
        for (const [agentId, voteData] of Object.entries(finalVote!.votes)) {
          memberVotes[agentId] = voteData.vote;
        }

        const request = feedbackManager.requestFeedback({
          voteId: vote.vote_id,
          topic: vote.topic,
          decision: 'PASSED',
          domains: [],
          threshold: 'UNANIMOUS',
          memberVotes,
          approveCount: 15,
          rejectCount: 0,
        });

        expect(request.significance).toBe('critical');
      });

      it('should assign critical significance for VETOED decision', () => {
        const request = feedbackManager.requestFeedback({
          voteId: 'test-vote',
          topic: 'Vetoed proposal',
          decision: 'VETOED',
          domains: [],
          memberVotes: {},
        });

        expect(request.significance).toBe('critical');
      });

      it('should assign high significance for SUPERMAJORITY threshold', () => {
        const request = feedbackManager.requestFeedback({
          voteId: 'test-vote',
          topic: 'Supermajority vote',
          decision: 'PASSED',
          domains: [],
          threshold: 'SUPERMAJORITY',
          memberVotes: {},
          approveCount: 10,
          rejectCount: 5,
        });

        expect(request.significance).toBe('high');
      });

      it('should assign high significance for close vote (margin < 3)', () => {
        const request = feedbackManager.requestFeedback({
          voteId: 'test-vote',
          topic: 'Close vote',
          decision: 'PASSED',
          domains: [],
          threshold: 'MAJORITY',
          memberVotes: {},
          approveCount: 8,
          rejectCount: 7, // Margin of 1
        });

        expect(request.significance).toBe('high');
      });

      it('should assign medium significance for MAJORITY with clear margin', () => {
        const request = feedbackManager.requestFeedback({
          voteId: 'test-vote',
          topic: 'Clear majority',
          decision: 'PASSED',
          domains: [],
          threshold: 'MAJORITY',
          memberVotes: {},
          approveCount: 12,
          rejectCount: 3, // Margin of 9
        });

        expect(request.significance).toBe('medium');
      });
    });

    describe('Feedback Submission', () => {
      it('should call OutcomeTracker.recordOutcome when feedback is submitted', () => {
        const vote = council.createVote({
          topic: 'Test feedback',
          description: 'Testing feedback loop',
          threshold: 'MAJORITY',
          initiated_by: 'router',
        });

        // Cast some votes
        castVotesFromPillars(council, vote.vote_id, {
          approvers: { agents: ['router', 'executor', 'guardian', 'planner', 'scheduler', 'wellness', 'ethics', 'integrator'], option: 'APPROVE' },
        });

        council.closeVote(vote.vote_id, 'PASSED');

        const finalVote = council.getVote(vote.vote_id);
        const memberVotes: Record<string, string> = {};
        for (const [agentId, voteData] of Object.entries(finalVote!.votes)) {
          memberVotes[agentId] = voteData.vote;
        }

        const request = feedbackManager.requestFeedback({
          voteId: vote.vote_id,
          topic: vote.topic,
          decision: 'PASSED',
          domains: [],
          memberVotes,
        });

        // Submit positive feedback
        const result = feedbackManager.submitFeedback(vote.vote_id, 0.8, 'Great decision');

        expect(result).toBe(true);

        // Check that outcome was recorded
        const outcome = outcomeTracker.getOutcome(vote.vote_id);
        expect(outcome).toBeDefined();
        expect(outcome?.outcomeQuality).toBe(0.8);
      });

      it('should move request from pending to resolved after submission', () => {
        const request = feedbackManager.requestFeedback({
          voteId: 'test-vote',
          topic: 'Test',
          decision: 'PASSED',
          domains: [],
          memberVotes: {},
        });

        const pendingBefore = feedbackManager.getPendingFeedback();
        expect(pendingBefore).toHaveLength(1);

        feedbackManager.submitFeedback('test-vote', 0.5, 'Neutral');

        const pendingAfter = feedbackManager.getPendingFeedback();
        expect(pendingAfter).toHaveLength(0);

        const resolved = feedbackManager.getResolvedFeedback();
        expect(resolved).toHaveLength(1);
        expect(resolved[0].voteId).toBe('test-vote');
      });

      it('should clamp rating to [-1, 1]', () => {
        feedbackManager.requestFeedback({
          voteId: 'test-vote',
          topic: 'Test',
          decision: 'PASSED',
          domains: [],
          memberVotes: { router: 'APPROVE' },
        });

        // Try to submit rating outside bounds
        feedbackManager.submitFeedback('test-vote', 5.0);

        const resolved = feedbackManager.getResolvedFeedback();
        expect(resolved[0].rating).toBe(1.0);

        // Try negative out of bounds
        feedbackManager.requestFeedback({
          voteId: 'test-vote-2',
          topic: 'Test 2',
          decision: 'PASSED',
          domains: [],
          memberVotes: {},
        });

        feedbackManager.submitFeedback('test-vote-2', -5.0);

        const resolved2 = feedbackManager.getResolvedFeedback();
        const vote2 = resolved2.find(r => r.voteId === 'test-vote-2');
        expect(vote2?.rating).toBe(-1.0);
      });
    });

    describe('Pending Feedback', () => {
      it('should sort pending feedback by significance (critical first)', () => {
        // Create requests with different significance levels
        feedbackManager.requestFeedback({
          voteId: 'low-vote',
          topic: 'Low',
          decision: 'PASSED',
          domains: [],
          threshold: 'MAJORITY',
          memberVotes: {},
          approveCount: 12,
          rejectCount: 3,
        });

        feedbackManager.requestFeedback({
          voteId: 'critical-vote',
          topic: 'Critical',
          decision: 'PASSED',
          domains: [],
          threshold: 'UNANIMOUS',
          memberVotes: {},
        });

        feedbackManager.requestFeedback({
          voteId: 'high-vote',
          topic: 'High',
          decision: 'PASSED',
          domains: [],
          threshold: 'SUPERMAJORITY',
          memberVotes: {},
        });

        const pending = feedbackManager.getPendingFeedback();

        expect(pending).toHaveLength(3);
        expect(pending[0].voteId).toBe('critical-vote');
        expect(pending[0].significance).toBe('critical');
        expect(pending[1].voteId).toBe('high-vote');
        expect(pending[1].significance).toBe('high');
      });
    });

    describe('Feedback Stats', () => {
      it('should calculate correct averages in getFeedbackStats', () => {
        // Create and resolve multiple feedback requests
        feedbackManager.requestFeedback({
          voteId: 'vote-1',
          topic: 'Test 1',
          decision: 'PASSED',
          domains: [],
          memberVotes: {},
        });

        feedbackManager.requestFeedback({
          voteId: 'vote-2',
          topic: 'Test 2',
          decision: 'PASSED',
          domains: [],
          memberVotes: {},
        });

        feedbackManager.requestFeedback({
          voteId: 'vote-3',
          topic: 'Test 3',
          decision: 'PASSED',
          domains: [],
          memberVotes: {},
        });

        // Submit varied ratings
        feedbackManager.submitFeedback('vote-1', 0.8); // positive
        feedbackManager.submitFeedback('vote-2', -0.5); // negative
        feedbackManager.submitFeedback('vote-3', 0.1); // neutral

        const stats = feedbackManager.getFeedbackStats();

        expect(stats.pending).toBe(0);
        expect(stats.resolved).toBe(3);
        expect(stats.averageRating).toBeCloseTo(0.13, 2); // (0.8 - 0.5 + 0.1) / 3
        expect(stats.ratingDistribution.positive).toBe(1);
        expect(stats.ratingDistribution.negative).toBe(1);
        expect(stats.ratingDistribution.neutral).toBe(1);
      });
    });

    describe('Credibility Report', () => {
      it('should include pillar and trend data in getCredibilityReport', () => {
        const report = feedbackManager.getCredibilityReport();

        expect(report).toBeDefined();
        expect(report.length).toBeGreaterThan(0);

        for (const member of report) {
          expect(member.agentId).toBeDefined();
          expect(member.memberName).toBeDefined();
          expect(member.pillar).toBeDefined();
          expect(member.avatar).toBeDefined();
          expect(member.trend).toMatch(/^(improving|stable|declining)$/);
          expect(member.credibility).toBeGreaterThanOrEqual(0);
          expect(member.credibility).toBeLessThanOrEqual(1);
        }
      });

      it('should calculate trend as improving when streak >= 3', () => {
        // Simulate correct predictions to build streak
        for (let i = 0; i < 4; i++) {
          outcomeTracker.recordOutcome({
            voteId: `vote-${i}`,
            topic: `Test ${i}`,
            decision: 'PASSED',
            outcomeQuality: 0.8, // positive outcome
            outcomeDescription: 'Good result',
            memberVotes: { router: 'APPROVE' }, // router approved, outcome was good
            recordedAt: new Date(),
          });
        }

        const report = feedbackManager.getCredibilityReport();
        const router = report.find(m => m.agentId === 'router');

        expect(router).toBeDefined();
        expect(router?.streak).toBeGreaterThanOrEqual(3);
        expect(router?.trend).toBe('improving');
      });

      it('should calculate trend as declining when streak <= -3', () => {
        // Simulate incorrect predictions to build negative streak
        for (let i = 0; i < 4; i++) {
          outcomeTracker.recordOutcome({
            voteId: `vote-${i}`,
            topic: `Test ${i}`,
            decision: 'PASSED',
            outcomeQuality: -0.8, // negative outcome
            outcomeDescription: 'Bad result',
            memberVotes: { executor: 'APPROVE' }, // executor approved, but outcome was bad
            recordedAt: new Date(),
          });
        }

        const report = feedbackManager.getCredibilityReport();
        const executor = report.find(m => m.agentId === 'executor');

        expect(executor).toBeDefined();
        expect(executor?.streak).toBeLessThanOrEqual(-3);
        expect(executor?.trend).toBe('declining');
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. COVERAGE EXPANSION
  // ════════════════════════════════════════════════════════════════════════════

  describe('Coverage Expansion', () => {
    it('PULSE should cover rest, recovery, leisure, downtime, vacation', () => {
      const pulse = COUNCIL_MEMBERS.wellness;

      expect(pulse).toBeDefined();
      expect(pulse.coverage).toContain('rest');
      expect(pulse.coverage).toContain('recovery');
      expect(pulse.coverage).toContain('leisure');
      expect(pulse.coverage).toContain('downtime');
      expect(pulse.coverage).toContain('vacation');
    });

    it('VERA should cover purpose, meaning, philosophy, reflection', () => {
      const vera = COUNCIL_MEMBERS.ethics;

      expect(vera).toBeDefined();
      expect(vera.coverage).toContain('purpose');
      expect(vera.coverage).toContain('meaning');
      expect(vera.coverage).toContain('philosophy');
      expect(vera.coverage).toContain('reflection');
    });
  });
});
