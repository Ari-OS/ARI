import { randomUUID } from 'crypto';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { AgentId, Vote, VoteOption, VoteThreshold } from '../kernel/types.js';
import { VOTING_AGENTS } from '../kernel/types.js';

interface CreateVoteRequest {
  topic: string;
  description: string;
  threshold: VoteThreshold;
  deadline_minutes?: number;
  initiated_by: AgentId;
}

/**
 * The Council - ARI's Governance Body
 *
 * A 13-member deliberative body implementing constitutional governance.
 * Handles voting on proposals, policy changes, and collective decisions.
 *
 * Implements quorum requirements, threshold calculations, and early vote conclusion.
 *
 * @see docs/constitution/ARI-CONSTITUTION-v1.0.md - Section 2: Legislative Branch
 */
export class Council {
  private votes: Map<string, Vote> = new Map();
  private readonly QUORUM_PERCENTAGE = 0.5; // 50% of voters must participate
  private readonly THRESHOLD_VALUES: Record<VoteThreshold, number> = {
    MAJORITY: 0.5,         // >50%
    SUPERMAJORITY: 0.66,   // >=66%
    UNANIMOUS: 1.0,        // 100%
  };

  constructor(
    private auditLogger: AuditLogger,
    private eventBus: EventBus
  ) {}

  /**
   * Creates a new vote.
   * @param request Vote creation parameters
   * @returns The created vote
   */
  createVote(request: CreateVoteRequest): Vote {
    const voteId = randomUUID();
    const deadlineMinutes = request.deadline_minutes ?? 60; // Default 1 hour
    const deadline = new Date(Date.now() + deadlineMinutes * 60 * 1000);

    const vote: Vote = {
      vote_id: voteId,
      topic: request.topic,
      description: request.description,
      threshold: request.threshold,
      deadline: deadline.toISOString(),
      votes: {},
      status: 'OPEN',
    };

    this.votes.set(voteId, vote);

    // Audit the vote creation
    void this.auditLogger.log(
      'vote:created',
      request.initiated_by,
      'verified',
      {
        vote_id: voteId,
        topic: request.topic,
        threshold: request.threshold,
        deadline: deadline.toISOString(),
      }
    );

    // Emit vote:started event
    void this.eventBus.emit('vote:started', {
      voteId,
      topic: request.topic,
      threshold: request.threshold,
      deadline: deadline.toISOString(),
    });

    return vote;
  }

  /**
   * Cast a vote for a specific vote.
   * @param voteId The vote ID
   * @param agent The agent casting the vote
   * @param option The vote option (APPROVE, REJECT, ABSTAIN)
   * @param reasoning The reasoning for the vote
   * @returns true if vote was cast successfully, false otherwise
   */
  castVote(
    voteId: string,
    agent: AgentId,
    option: VoteOption,
    reasoning: string
  ): boolean {
    const vote = this.votes.get(voteId);
    if (!vote) {
      console.error(`Vote ${voteId} not found`);
      return false;
    }

    // Check if vote is still open
    if (vote.status !== 'OPEN') {
      console.error(`Vote ${voteId} is not open (status: ${vote.status})`);
      return false;
    }

    // Check if agent is eligible to vote
    if (!VOTING_AGENTS.includes(agent)) {
      console.error(`Agent ${agent} is not eligible to vote`);
      return false;
    }

    // Check if deadline has passed
    if (new Date() > new Date(vote.deadline)) {
      this.closeVote(voteId, 'EXPIRED');
      return false;
    }

    // Record the vote
    vote.votes[agent] = {
      agent,
      vote: option,
      reasoning,
      timestamp: new Date().toISOString(),
    };

    // Audit the vote cast
    void this.auditLogger.log(
      'vote:cast',
      agent,
      'verified',
      {
        vote_id: voteId,
        option,
        reasoning,
      }
    );

    // Emit vote:cast event
    void this.eventBus.emit('vote:cast', {
      voteId,
      agent,
      option,
    });

    // Check for early conclusion
    this.checkEarlyConclusion(voteId);

    return true;
  }

  /**
   * Checks if a vote can be concluded early based on current tallies.
   * @param voteId The vote ID
   */
  private checkEarlyConclusion(voteId: string): void {
    const vote = this.votes.get(voteId);
    if (!vote || vote.status !== 'OPEN') return;

    const totalVoters = VOTING_AGENTS.length;
    const currentVotes = Object.values(vote.votes);
    const approveCount = currentVotes.filter(v => v.vote === 'APPROVE').length;
    const rejectCount = currentVotes.filter(v => v.vote === 'REJECT').length;
    const votedCount = currentVotes.length;
    const remainingCount = totalVoters - votedCount;

    // Early conclusion logic based on threshold
    if (vote.threshold === 'UNANIMOUS') {
      // Any REJECT means immediate failure
      if (rejectCount > 0) {
        this.closeVote(voteId, 'FAILED');
        return;
      }
      // All votes in and all APPROVE (abstentions allowed)
      if (remainingCount === 0 && rejectCount === 0) {
        this.closeVote(voteId, 'PASSED');
        return;
      }
    } else if (vote.threshold === 'SUPERMAJORITY') {
      const requiredApprove = Math.ceil(totalVoters * this.THRESHOLD_VALUES.SUPERMAJORITY);
      // Enough approvals to pass
      if (approveCount >= requiredApprove) {
        this.closeVote(voteId, 'PASSED');
        return;
      }
      // Not enough possible approvals remaining
      if (approveCount + remainingCount < requiredApprove) {
        this.closeVote(voteId, 'FAILED');
        return;
      }
    } else if (vote.threshold === 'MAJORITY') {
      const requiredApprove = Math.ceil(totalVoters * this.THRESHOLD_VALUES.MAJORITY);
      const requiredReject = Math.ceil(totalVoters * this.THRESHOLD_VALUES.MAJORITY);
      // Enough approvals to pass
      if (approveCount >= requiredApprove) {
        this.closeVote(voteId, 'PASSED');
        return;
      }
      // Enough rejections to fail
      if (rejectCount >= requiredReject) {
        this.closeVote(voteId, 'FAILED');
        return;
      }
    }
  }

  /**
   * Closes a vote and tallies the results.
   * @param voteId The vote ID
   * @param status The final status (PASSED, FAILED, EXPIRED)
   */
  closeVote(voteId: string, status: 'PASSED' | 'FAILED' | 'EXPIRED'): void {
    const vote = this.votes.get(voteId);
    if (!vote) {
      console.error(`Vote ${voteId} not found`);
      return;
    }

    if (vote.status !== 'OPEN') {
      console.error(`Vote ${voteId} is already closed (status: ${vote.status})`);
      return;
    }

    const currentVotes = Object.values(vote.votes);
    const approveCount = currentVotes.filter(v => v.vote === 'APPROVE').length;
    const rejectCount = currentVotes.filter(v => v.vote === 'REJECT').length;
    const abstainCount = currentVotes.filter(v => v.vote === 'ABSTAIN').length;
    const totalVoters = VOTING_AGENTS.length;
    const votedCount = currentVotes.length;

    // Check quorum (50% of voters must participate)
    const quorumMet = votedCount >= Math.ceil(totalVoters * this.QUORUM_PERCENTAGE);

    // Determine if threshold was met
    let thresholdMet = false;
    if (quorumMet && status === 'PASSED') {
      if (vote.threshold === 'UNANIMOUS') {
        thresholdMet = rejectCount === 0 && approveCount > 0;
      } else if (vote.threshold === 'SUPERMAJORITY') {
        thresholdMet = approveCount >= Math.ceil(totalVoters * this.THRESHOLD_VALUES.SUPERMAJORITY);
      } else if (vote.threshold === 'MAJORITY') {
        thresholdMet = approveCount > Math.floor(totalVoters * this.THRESHOLD_VALUES.MAJORITY);
      }
    }

    // If status is FAILED or EXPIRED, threshold is not met
    if (status === 'FAILED' || status === 'EXPIRED') {
      thresholdMet = false;
    }

    vote.status = status;
    vote.result = {
      approve: approveCount,
      reject: rejectCount,
      abstain: abstainCount,
      threshold_met: thresholdMet,
    };

    // Audit the vote closure
    void this.auditLogger.log(
      'vote:closed',
      'system',
      'system',
      {
        vote_id: voteId,
        status,
        result: vote.result,
        quorum_met: quorumMet,
      }
    );

    // Emit vote:completed event
    void this.eventBus.emit('vote:completed', {
      voteId,
      status,
      result: vote.result,
    });
  }

  /**
   * Gets a vote by ID.
   * @param voteId The vote ID
   * @returns The vote or undefined if not found
   */
  getVote(voteId: string): Vote | undefined {
    return this.votes.get(voteId);
  }

  /**
   * Gets all open votes.
   * @returns Array of open votes
   */
  getOpenVotes(): Vote[] {
    return Array.from(this.votes.values()).filter(v => v.status === 'OPEN');
  }

  /**
   * Gets all votes.
   * @returns Array of all votes
   */
  getAllVotes(): Vote[] {
    return Array.from(this.votes.values());
  }

  /**
   * Expires all votes that have passed their deadline.
   * @returns The number of votes expired
   */
  expireOverdueVotes(): number {
    let expired = 0;
    const now = new Date();

    for (const [id, vote] of this.votes) {
      if (vote.status === 'OPEN' && new Date(vote.deadline) < now) {
        this.closeVote(id, 'EXPIRED');
        expired++;
      }
    }

    return expired;
  }
}
