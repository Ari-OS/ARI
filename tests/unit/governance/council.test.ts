import { describe, it, expect, beforeEach } from 'vitest';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { Council } from '../../../src/governance/council.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import type { AgentId, VoteOption } from '../../../src/kernel/types.js';

describe('Council', () => {
  let council: Council;
  let auditLogger: AuditLogger;
  let eventBus: EventBus;

  beforeEach(() => {
    const logPath = join(tmpdir(), `audit-${randomUUID()}.jsonl`);
    auditLogger = new AuditLogger(logPath);
    eventBus = new EventBus();
    council = new Council(auditLogger, eventBus);
  });

  it('should create a vote successfully', () => {
    const vote = council.createVote({
      topic: 'Test Proposal',
      description: 'A test proposal for voting',
      threshold: 'MAJORITY',
      deadline_minutes: 60,
      initiated_by: 'router' as AgentId,
    });

    expect(vote).toBeDefined();
    expect(vote.topic).toBe('Test Proposal');
    expect(vote.description).toBe('A test proposal for voting');
    expect(vote.threshold).toBe('MAJORITY');
    expect(vote.status).toBe('OPEN');
    expect(vote.votes).toEqual({});
  });

  it('should return true when casting vote for eligible agent', () => {
    const vote = council.createVote({
      topic: 'Test Proposal',
      description: 'A test proposal',
      threshold: 'MAJORITY',
      initiated_by: 'router' as AgentId,
    });

    const result = council.castVote(
      vote.vote_id,
      'router' as AgentId,
      'APPROVE' as VoteOption,
      'I approve this proposal'
    );

    expect(result).toBe(true);
    const updatedVote = council.getVote(vote.vote_id);
    expect(updatedVote?.votes['router']).toBeDefined();
    expect(updatedVote?.votes['router'].vote).toBe('APPROVE');
  });

  it('should return false when casting vote for non-eligible agent', () => {
    const vote = council.createVote({
      topic: 'Test Proposal',
      description: 'A test proposal',
      threshold: 'MAJORITY',
      initiated_by: 'router' as AgentId,
    });

    const result = council.castVote(
      vote.vote_id,
      'core' as AgentId,
      'APPROVE' as VoteOption,
      'I approve this proposal'
    );

    expect(result).toBe(false);
    const updatedVote = council.getVote(vote.vote_id);
    expect(updatedVote?.votes['core']).toBeUndefined();
  });

  it('should return false when casting vote on closed vote', () => {
    const vote = council.createVote({
      topic: 'Test Proposal',
      description: 'A test proposal',
      threshold: 'MAJORITY',
      initiated_by: 'router' as AgentId,
    });

    council.closeVote(vote.vote_id, 'PASSED');

    const result = council.castVote(
      vote.vote_id,
      'router' as AgentId,
      'APPROVE' as VoteOption,
      'I approve this proposal'
    );

    expect(result).toBe(false);
  });

  it('should pass early with MAJORITY threshold when 4+ approvals out of 7', () => {
    const vote = council.createVote({
      topic: 'Test Proposal',
      description: 'A test proposal',
      threshold: 'MAJORITY',
      initiated_by: 'router' as AgentId,
    });

    const approvingAgents: AgentId[] = [
      'router', 'memory_keeper', 'guardian', 'planner'
    ];

    approvingAgents.forEach((agent) => {
      council.castVote(vote.vote_id, agent, 'APPROVE' as VoteOption, 'Approved');
    });

    const updatedVote = council.getVote(vote.vote_id);
    expect(updatedVote?.status).toBe('PASSED');
    expect(updatedVote?.result?.approve).toBe(4);
    expect(updatedVote?.result?.threshold_met).toBe(true);
  });

  it('should fail early with MAJORITY threshold when 4+ rejections', () => {
    const vote = council.createVote({
      topic: 'Test Proposal',
      description: 'A test proposal',
      threshold: 'MAJORITY',
      initiated_by: 'router' as AgentId,
    });

    const rejectingAgents: AgentId[] = [
      'router', 'memory_keeper', 'guardian', 'planner'
    ];

    rejectingAgents.forEach((agent) => {
      council.castVote(vote.vote_id, agent, 'REJECT' as VoteOption, 'Rejected');
    });

    const updatedVote = council.getVote(vote.vote_id);
    expect(updatedVote?.status).toBe('FAILED');
    expect(updatedVote?.result?.reject).toBe(4);
    expect(updatedVote?.result?.threshold_met).toBe(false);
  });

  it('should pass early with SUPERMAJORITY threshold when 5+ approvals out of 7', () => {
    const vote = council.createVote({
      topic: 'Test Proposal',
      description: 'A test proposal',
      threshold: 'SUPERMAJORITY',
      initiated_by: 'router' as AgentId,
    });

    const approvingAgents: AgentId[] = [
      'router', 'memory_keeper', 'guardian', 'planner', 'wealth'
    ];

    approvingAgents.forEach((agent) => {
      council.castVote(vote.vote_id, agent, 'APPROVE' as VoteOption, 'Approved');
    });

    const updatedVote = council.getVote(vote.vote_id);
    expect(updatedVote?.status).toBe('PASSED');
    expect(updatedVote?.result?.approve).toBe(5);
    expect(updatedVote?.result?.threshold_met).toBe(true);
  });

  it('should fail immediately with UNANIMOUS threshold when 1 rejection', () => {
    const vote = council.createVote({
      topic: 'Test Proposal',
      description: 'A test proposal',
      threshold: 'UNANIMOUS',
      initiated_by: 'router' as AgentId,
    });

    council.castVote(vote.vote_id, 'router' as AgentId, 'REJECT' as VoteOption, 'Rejected');

    const updatedVote = council.getVote(vote.vote_id);
    expect(updatedVote?.status).toBe('FAILED');
    expect(updatedVote?.result?.reject).toBe(1);
    expect(updatedVote?.result?.threshold_met).toBe(false);
  });

  it('should emit vote:started event on vote creation', () => {
    let emittedVoteId: string | undefined;

    eventBus.on('vote:started', (payload: any) => {
      emittedVoteId = payload.voteId;
    });

    const vote = council.createVote({
      topic: 'Test Proposal',
      description: 'A test proposal',
      threshold: 'MAJORITY',
      initiated_by: 'router' as AgentId,
    });

    expect(emittedVoteId).toBe(vote.vote_id);
  });

  it('should emit vote:completed event on vote close', () => {
    let emittedPayload: any;

    eventBus.on('vote:completed', (payload: any) => {
      emittedPayload = payload;
    });

    const vote = council.createVote({
      topic: 'Test Proposal',
      description: 'A test proposal',
      threshold: 'MAJORITY',
      initiated_by: 'router' as AgentId,
    });

    council.closeVote(vote.vote_id, 'PASSED');

    expect(emittedPayload).toBeDefined();
    expect(emittedPayload.voteId).toBe(vote.vote_id);
    expect(emittedPayload.status).toBe('PASSED');
  });

  describe('getAllVotes', () => {
    it('should return empty array when no votes exist', () => {
      const votes = council.getAllVotes();
      expect(votes).toEqual([]);
    });

    it('should return all created votes', () => {
      const vote1 = council.createVote({
        topic: 'Proposal 1',
        description: 'First proposal',
        threshold: 'MAJORITY',
        initiated_by: 'router' as AgentId,
      });

      const vote2 = council.createVote({
        topic: 'Proposal 2',
        description: 'Second proposal',
        threshold: 'SUPERMAJORITY',
        initiated_by: 'planner' as AgentId,
      });

      const votes = council.getAllVotes();
      expect(votes).toHaveLength(2);
      expect(votes.map(v => v.vote_id)).toContain(vote1.vote_id);
      expect(votes.map(v => v.vote_id)).toContain(vote2.vote_id);
    });
  });

  describe('expireOverdueVotes', () => {
    it('should return 0 when no votes are overdue', () => {
      council.createVote({
        topic: 'Test Proposal',
        description: 'A test proposal',
        threshold: 'MAJORITY',
        deadline_minutes: 60,
        initiated_by: 'router' as AgentId,
      });

      const expired = council.expireOverdueVotes();
      expect(expired).toBe(0);
    });

    it('should expire overdue open votes', () => {
      // Create a vote with a very short deadline (already expired)
      const vote = council.createVote({
        topic: 'Test Proposal',
        description: 'A test proposal',
        threshold: 'MAJORITY',
        deadline_minutes: -1, // Already in the past
        initiated_by: 'router' as AgentId,
      });

      const expired = council.expireOverdueVotes();
      expect(expired).toBe(1);

      const updatedVote = council.getVote(vote.vote_id);
      expect(updatedVote?.status).toBe('EXPIRED');
    });

    it('should not expire already closed votes', () => {
      const vote = council.createVote({
        topic: 'Test Proposal',
        description: 'A test proposal',
        threshold: 'MAJORITY',
        deadline_minutes: -1,
        initiated_by: 'router' as AgentId,
      });

      council.closeVote(vote.vote_id, 'PASSED');

      const expired = council.expireOverdueVotes();
      expect(expired).toBe(0);
    });
  });
});
