import { randomUUID } from 'crypto';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { AgentId, Vote, VoteOption, VoteThreshold, VetoDomain, CouncilPillar } from '../kernel/types.js';
import { VOTING_AGENTS, VETO_AUTHORITY } from '../kernel/types.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('council');

/**
 * Voting behavior style
 */
type VotingStyle = 'cautious' | 'balanced' | 'progressive';

/**
 * A Council member's simple definition.
 */
interface CouncilMember {
  id: AgentId;
  name: string;
  avatar: string;
  pillar: CouncilPillar;
  votingStyle: VotingStyle;
}

/**
 * The 15 Council Members — Simplified inline definition
 * Only voting agents are included (non-voting agents like 'core', 'arbiter', etc. are excluded)
 */
const COUNCIL_MEMBERS: Partial<Record<AgentId, CouncilMember>> = {
  router: { id: 'router', name: 'ATLAS', avatar: '🧭', pillar: 'infrastructure', votingStyle: 'balanced' },
  executor: { id: 'executor', name: 'BOLT', avatar: '⚡', pillar: 'infrastructure', votingStyle: 'progressive' },
  memory_keeper: { id: 'memory_keeper', name: 'ECHO', avatar: '📚', pillar: 'infrastructure', votingStyle: 'cautious' },
  guardian: { id: 'guardian', name: 'AEGIS', avatar: '🛡️', pillar: 'protection', votingStyle: 'cautious' },
  risk_assessor: { id: 'risk_assessor', name: 'SCOUT', avatar: '📊', pillar: 'protection', votingStyle: 'cautious' },
  planner: { id: 'planner', name: 'TRUE', avatar: '🎯', pillar: 'strategy', votingStyle: 'balanced' },
  scheduler: { id: 'scheduler', name: 'TEMPO', avatar: '⏰', pillar: 'strategy', votingStyle: 'balanced' },
  resource_manager: { id: 'resource_manager', name: 'OPAL', avatar: '💎', pillar: 'strategy', votingStyle: 'cautious' },
  wellness: { id: 'wellness', name: 'PULSE', avatar: '💚', pillar: 'domains', votingStyle: 'cautious' },
  relationships: { id: 'relationships', name: 'EMBER', avatar: '🤝', pillar: 'domains', votingStyle: 'balanced' },
  creative: { id: 'creative', name: 'PRISM', avatar: '✨', pillar: 'domains', votingStyle: 'progressive' },
  wealth: { id: 'wealth', name: 'MINT', avatar: '💰', pillar: 'domains', votingStyle: 'cautious' },
  growth: { id: 'growth', name: 'BLOOM', avatar: '🌱', pillar: 'domains', votingStyle: 'progressive' },
  ethics: { id: 'ethics', name: 'VERA', avatar: '⚖️', pillar: 'meta', votingStyle: 'cautious' },
  integrator: { id: 'integrator', name: 'NEXUS', avatar: '🔗', pillar: 'meta', votingStyle: 'balanced' },
};

/**
 * Check if an agent has veto authority for a domain.
 */
function canVeto(agentId: AgentId, domain: VetoDomain): boolean {
  const domains = VETO_AUTHORITY[agentId];
  return domains ? domains.includes(domain) : false;
}

interface CreateVoteRequest {
  topic: string;
  description: string;
  threshold: VoteThreshold;
  deadline_minutes?: number;
  initiated_by: AgentId;
  /** Optional: domains this vote affects (for veto checking) */
  domains?: VetoDomain[];
}

/**
 * Veto record for tracking exercised vetoes.
 */
interface VetoRecord {
  voteId: string;
  vetoer: AgentId;
  vetoerName: string;
  domain: VetoDomain;
  reason: string;
  constitutionalRef?: string;
  timestamp: string;
}


/**
 * The Council - ARI's Governance Body
 *
 * A 15-member deliberative body implementing constitutional governance.
 * Ratified 2026-02-01 by UNANIMOUS vote.
 *
 * === THE COUNCIL OF FIFTEEN ===
 *
 * | # | Icon | Name     | AgentId          | Pillar         | Veto Domain        |
 * |---|------|----------|------------------|----------------|--------------------|
 * | 1 | 🧭   | ATLAS    | router           | Infrastructure | —                  |
 * | 2 | ⚡   | BOLT     | executor         | Infrastructure | —                  |
 * | 3 | 📚   | ECHO     | memory_keeper    | Infrastructure | memory             |
 * | 4 | 🛡️   | AEGIS    | guardian         | Protection     | security           |
 * | 5 | 📊   | SCOUT    | risk_assessor    | Protection     | high_risk          |
 * | 6 | 🎯   | TRUE     | planner          | Strategy       | —                  |
 * | 7 | ⏰   | TEMPO    | scheduler        | Strategy       | time_conflict      |
 * | 8 | 💎   | OPAL     | resource_manager | Strategy       | resource_depletion |
 * | 9 | 💚   | PULSE    | wellness         | Domains        | health_harm        |
 * |10 | 🤝   | EMBER    | relationships    | Domains        | —                  |
 * |11 | ✨   | PRISM    | creative         | Domains        | —                  |
 * |12 | 💰   | MINT     | wealth           | Domains        | major_financial    |
 * |13 | 🌱   | BLOOM    | growth           | Domains        | —                  |
 * |14 | ⚖️   | VERA     | ethics           | Meta           | ethics_violation   |
 * |15 | 🔗   | NEXUS    | integrator       | Meta           | — (tie-breaker)    |
 *
 * Voting Thresholds (15 members):
 * - MAJORITY (>50%): 8+ votes
 * - SUPERMAJORITY (≥66%): 10+ votes
 * - UNANIMOUS (100%): 15/15 votes
 * - QUORUM (50%): 8+ participation
 *
 * @see docs/constitution/ARI-CONSTITUTION-v1.0.md - Section 2: Legislative Branch
 */
export class Council {
  private votes: Map<string, Vote> = new Map();
  private vetoes: Map<string, VetoRecord> = new Map();

  // 15-member thresholds
  private readonly COUNCIL_SIZE = 15;
  private readonly QUORUM_PERCENTAGE = 0.5; // 50% = 8 members
  private readonly THRESHOLD_VALUES: Record<VoteThreshold, number> = {
    MAJORITY: 0.5,         // >50% = 8+
    SUPERMAJORITY: 0.66,   // ≥66% = 10+
    UNANIMOUS: 1.0,        // 100% = 15/15
  };

  // Pre-calculated thresholds for 15 members
  private readonly MAJORITY_THRESHOLD = 8;      // Math.ceil(15 * 0.5) + 1 for >50%
  private readonly SUPERMAJORITY_THRESHOLD = 10; // Math.ceil(15 * 0.66)
  private readonly QUORUM_THRESHOLD = 8;         // Math.ceil(15 * 0.5)

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

    // Store domains for veto checking (in description as metadata)
    if (request.domains && request.domains.length > 0) {
      vote.description = `${vote.description}\n[DOMAINS: ${request.domains.join(', ')}]`;
    }

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
        council_size: this.COUNCIL_SIZE,
        domains: request.domains,
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
      log.error({ voteId }, 'Vote not found');
      return false;
    }

    // Check if vote is still open
    if (vote.status !== 'OPEN') {
      log.error({ voteId, status: vote.status }, 'Vote is not open');
      return false;
    }

    // Check if agent is eligible to vote
    if (!VOTING_AGENTS.includes(agent)) {
      log.error({ agent }, 'Agent is not eligible to vote');
      return false;
    }

    // Check if deadline has passed
    if (new Date() > new Date(vote.deadline)) {
      this.closeVote(voteId, 'EXPIRED');
      return false;
    }

    // Get Council member info for richer audit
    const member = COUNCIL_MEMBERS[agent];
    const memberName = member?.name ?? agent;

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
        member_name: memberName,
        pillar: member?.pillar,
        voting_style: member?.votingStyle,
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
   * Exercise veto authority on a vote.
   *
   * Only agents with veto authority for the relevant domain can veto.
   * A veto immediately fails the vote regardless of current tally.
   *
   * @param voteId The vote ID
   * @param agent The agent exercising veto
   * @param domain The domain for which veto is being exercised
   * @param reason The reason for the veto
   * @param constitutionalRef Optional reference to constitutional rule
   * @returns true if veto was exercised successfully
   */
  castVeto(
    voteId: string,
    agent: AgentId,
    domain: VetoDomain,
    reason: string,
    constitutionalRef?: string
  ): boolean {
    const vote = this.votes.get(voteId);
    if (!vote) {
      log.error({ voteId }, 'Vote not found for veto');
      return false;
    }

    // Check if vote is still open
    if (vote.status !== 'OPEN') {
      log.error({ voteId, status: vote.status }, 'Vote is not open for veto');
      return false;
    }

    // Check if agent has veto authority for this domain
    if (!canVeto(agent, domain)) {
      log.error({ agent, domain }, 'Agent does not have veto authority for domain');
      return false;
    }

    // Get member info
    const member = COUNCIL_MEMBERS[agent];
    const memberName = member?.name ?? agent;

    // Record the veto
    const vetoRecord: VetoRecord = {
      voteId,
      vetoer: agent,
      vetoerName: memberName,
      domain,
      reason,
      constitutionalRef,
      timestamp: new Date().toISOString(),
    };
    this.vetoes.set(`${voteId}:${agent}`, vetoRecord);

    // Audit the veto
    void this.auditLogger.log(
      'vote:vetoed',
      agent,
      'verified',
      {
        vote_id: voteId,
        domain,
        reason,
        constitutional_ref: constitutionalRef,
        member_name: memberName,
      }
    );

    // Emit veto event
    void this.eventBus.emit('vote:vetoed', {
      voteId,
      vetoer: agent,
      domain,
      reason,
    });

    // Close the vote as VETOED
    this.closeVoteWithVeto(voteId, agent, domain, reason);

    return true;
  }

  /**
   * Close a vote due to veto.
   */
  private closeVoteWithVeto(
    voteId: string,
    vetoer: AgentId,
    domain: VetoDomain,
    reason: string
  ): void {
    const vote = this.votes.get(voteId);
    if (!vote) return;

    const currentVotes = Object.values(vote.votes);
    const approveCount = currentVotes.filter(v => v.vote === 'APPROVE').length;
    const rejectCount = currentVotes.filter(v => v.vote === 'REJECT').length;
    const abstainCount = currentVotes.filter(v => v.vote === 'ABSTAIN').length;

    // Set status to VETOED
    vote.status = 'VETOED';
    vote.result = {
      approve: approveCount,
      reject: rejectCount,
      abstain: abstainCount,
      threshold_met: false,
    };

    const member = COUNCIL_MEMBERS[vetoer];

    // Audit the vetoed closure
    void this.auditLogger.log(
      'vote:closed',
      'system',
      'system',
      {
        vote_id: voteId,
        status: 'VETOED',
        result: vote.result,
        vetoed_by: vetoer,
        vetoed_by_name: member?.name,
        veto_domain: domain,
        veto_reason: reason,
      }
    );

    // Emit vote:completed event
    void this.eventBus.emit('vote:completed', {
      voteId,
      status: 'VETOED',
      result: {
        ...vote.result,
        vetoed_by: vetoer,
        veto_domain: domain,
      },
    });
  }

  /**
   * Get all vetoes for a vote.
   */
  getVetoes(voteId?: string): VetoRecord[] {
    const allVetoes = Array.from(this.vetoes.values());
    if (voteId) {
      return allVetoes.filter(v => v.voteId === voteId);
    }
    return allVetoes;
  }

  /**
   * Get veto authority information.
   * Returns which agents can veto which domains.
   */
  getVetoAuthority(): Record<AgentId, { name: string; domains: VetoDomain[] }> {
    const authority: Record<AgentId, { name: string; domains: VetoDomain[] }> = {} as Record<AgentId, { name: string; domains: VetoDomain[] }>;

    for (const [agentId, domains] of Object.entries(VETO_AUTHORITY)) {
      const member = COUNCIL_MEMBERS[agentId as AgentId];
      if (member && domains) {
        authority[agentId as AgentId] = {
          name: member.name,
          domains,
        };
      }
    }

    return authority;
  }

  /**
   * Checks if a vote can be concluded early based on current tallies.
   * @param voteId The vote ID
   */
  private checkEarlyConclusion(voteId: string): void {
    const vote = this.votes.get(voteId);
    if (!vote || vote.status !== 'OPEN') return;

    const totalVoters = this.COUNCIL_SIZE;
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
      if (remainingCount === 0 && rejectCount === 0 && approveCount > 0) {
        this.closeVote(voteId, 'PASSED');
        return;
      }
    } else if (vote.threshold === 'SUPERMAJORITY') {
      // Enough approvals to pass (10+)
      if (approveCount >= this.SUPERMAJORITY_THRESHOLD) {
        this.closeVote(voteId, 'PASSED');
        return;
      }
      // Not enough possible approvals remaining
      if (approveCount + remainingCount < this.SUPERMAJORITY_THRESHOLD) {
        this.closeVote(voteId, 'FAILED');
        return;
      }
    } else if (vote.threshold === 'MAJORITY') {
      // Enough approvals to pass (8+)
      if (approveCount >= this.MAJORITY_THRESHOLD) {
        this.closeVote(voteId, 'PASSED');
        return;
      }
      // Enough rejections to fail (8+)
      if (rejectCount >= this.MAJORITY_THRESHOLD) {
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
      log.error({ voteId }, 'Vote not found for closing');
      return;
    }

    if (vote.status !== 'OPEN') {
      log.error({ voteId, status: vote.status }, 'Vote is already closed');
      return;
    }

    const currentVotes = Object.values(vote.votes);
    const approveCount = currentVotes.filter(v => v.vote === 'APPROVE').length;
    const rejectCount = currentVotes.filter(v => v.vote === 'REJECT').length;
    const abstainCount = currentVotes.filter(v => v.vote === 'ABSTAIN').length;
    const votedCount = currentVotes.length;

    // Check quorum (50% of 15 = 8 members must participate)
    const quorumMet = votedCount >= this.QUORUM_THRESHOLD;

    // Determine if threshold was met
    let thresholdMet = false;
    if (quorumMet && status === 'PASSED') {
      if (vote.threshold === 'UNANIMOUS') {
        thresholdMet = rejectCount === 0 && approveCount === this.COUNCIL_SIZE;
      } else if (vote.threshold === 'SUPERMAJORITY') {
        thresholdMet = approveCount >= this.SUPERMAJORITY_THRESHOLD;
      } else if (vote.threshold === 'MAJORITY') {
        thresholdMet = approveCount >= this.MAJORITY_THRESHOLD;
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
        council_size: this.COUNCIL_SIZE,
        thresholds: {
          majority: this.MAJORITY_THRESHOLD,
          supermajority: this.SUPERMAJORITY_THRESHOLD,
          quorum: this.QUORUM_THRESHOLD,
        },
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

  /**
   * Get the current vote matrix showing all member votes for a vote.
   */
  getVoteMatrix(voteId: string): {
    members: Array<{
      id: AgentId;
      name: string;
      avatar: string;
      pillar: string;
      vote: VoteOption | null;
      reasoning: string | null;
    }>;
    totals: { approve: number; reject: number; abstain: number; pending: number };
  } | null {
    const vote = this.votes.get(voteId);
    if (!vote) return null;

    const members = VOTING_AGENTS.map(agentId => {
      const member = COUNCIL_MEMBERS[agentId];
      const castVote = vote.votes[agentId];

      return {
        id: agentId,
        name: member?.name ?? agentId,
        avatar: member?.avatar ?? '?',
        pillar: member?.pillar ?? 'unknown',
        vote: castVote?.vote ?? null,
        reasoning: castVote?.reasoning ?? null,
      };
    });

    const totals = {
      approve: members.filter(m => m.vote === 'APPROVE').length,
      reject: members.filter(m => m.vote === 'REJECT').length,
      abstain: members.filter(m => m.vote === 'ABSTAIN').length,
      pending: members.filter(m => m.vote === null).length,
    };

    return { members, totals };
  }


  /**
   * Get Council statistics.
   */
  getCouncilStats(): {
    size: number;
    thresholds: { majority: number; supermajority: number; unanimous: number; quorum: number };
    vetoHolders: number;
    votingBalance: { cautious: number; balanced: number; progressive: number };
  } {
    const vetoHolders = Object.keys(VETO_AUTHORITY).length;

    // Count voting styles from COUNCIL_MEMBERS
    const votingBalance = { cautious: 0, balanced: 0, progressive: 0 };
    for (const agentId of VOTING_AGENTS) {
      const member = COUNCIL_MEMBERS[agentId];
      if (member) {
        votingBalance[member.votingStyle]++;
      }
    }

    return {
      size: this.COUNCIL_SIZE,
      thresholds: {
        majority: this.MAJORITY_THRESHOLD,
        supermajority: this.SUPERMAJORITY_THRESHOLD,
        unanimous: this.COUNCIL_SIZE,
        quorum: this.QUORUM_THRESHOLD,
      },
      vetoHolders,
      votingBalance,
    };
  }
}
