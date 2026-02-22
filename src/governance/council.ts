import { randomUUID } from 'crypto';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type {
  AgentId,
  CouncilPillar,
  VetoDomain,
  Vote,
  VoteOption,
  VoteThreshold,
} from '../kernel/types.js';
import { VETO_AUTHORITY } from '../kernel/types.js';

type VotingStyle = 'cautious' | 'balanced' | 'progressive';

export type VetoTier = 'VETO' | 'STRONG_OBJECTION' | 'CONCERN';

interface CouncilMember {
  id: AgentId;
  name: string;
  avatar: string;
  pillar: CouncilPillar;
  votingStyle: VotingStyle;
  isCore: boolean;
}

const COUNCIL_MEMBERS: Partial<Record<AgentId, CouncilMember>> = {
  router: {
    id: 'router',
    name: 'ATLAS',
    avatar: '🧭',
    pillar: 'infrastructure',
    votingStyle: 'balanced',
    isCore: true,
  },
  executor: {
    id: 'executor',
    name: 'BOLT',
    avatar: '⚡',
    pillar: 'infrastructure',
    votingStyle: 'progressive',
    isCore: false,
  },
  memory_keeper: {
    id: 'memory_keeper',
    name: 'ECHO',
    avatar: '📚',
    pillar: 'infrastructure',
    votingStyle: 'cautious',
    isCore: true,
  },
  guardian: {
    id: 'guardian',
    name: 'AEGIS',
    avatar: '🛡️',
    pillar: 'protection',
    votingStyle: 'cautious',
    isCore: true,
  },
  risk_assessor: {
    id: 'risk_assessor',
    name: 'SCOUT',
    avatar: '📊',
    pillar: 'protection',
    votingStyle: 'cautious',
    isCore: false,
  },
  planner: {
    id: 'planner',
    name: 'TRUE',
    avatar: '🎯',
    pillar: 'strategy',
    votingStyle: 'balanced',
    isCore: true,
  },
  scheduler: {
    id: 'scheduler',
    name: 'TEMPO',
    avatar: '⏰',
    pillar: 'strategy',
    votingStyle: 'balanced',
    isCore: false,
  },
  resource_manager: {
    id: 'resource_manager',
    name: 'OPAL',
    avatar: '💎',
    pillar: 'strategy',
    votingStyle: 'cautious',
    isCore: false,
  },
  wellness: {
    id: 'wellness',
    name: 'PULSE',
    avatar: '💚',
    pillar: 'domains',
    votingStyle: 'cautious',
    isCore: false,
  },
  relationships: {
    id: 'relationships',
    name: 'EMBER',
    avatar: '🤝',
    pillar: 'domains',
    votingStyle: 'balanced',
    isCore: false,
  },
  creative: {
    id: 'creative',
    name: 'PRISM',
    avatar: '✨',
    pillar: 'domains',
    votingStyle: 'progressive',
    isCore: false,
  },
  wealth: {
    id: 'wealth',
    name: 'MINT',
    avatar: '💰',
    pillar: 'domains',
    votingStyle: 'cautious',
    isCore: true,
  },
  growth: {
    id: 'growth',
    name: 'BLOOM',
    avatar: '🌱',
    pillar: 'domains',
    votingStyle: 'progressive',
    isCore: false,
  },
  ethics: {
    id: 'ethics',
    name: 'VERA',
    avatar: '⚖️',
    pillar: 'meta',
    votingStyle: 'cautious',
    isCore: true,
  },
  integrator: {
    id: 'integrator',
    name: 'NEXUS',
    avatar: '🔗',
    pillar: 'meta',
    votingStyle: 'balanced',
    isCore: true,
  },
};

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
  domains?: VetoDomain[];
  isFastTrack?: boolean;
}

interface VetoRecord {
  voteId: string;
  vetoer: AgentId;
  vetoerName: string;
  domain: VetoDomain;
  tier: VetoTier;
  reason: string;
  constitutionalRef?: string;
  timestamp: string;
}

interface DelegationRecord {
  delegator: AgentId;
  delegatee: AgentId;
  expiresAt: string;
}

export class Council {
  private votes: Map<string, Vote> = new Map();
  private vetoes: Map<string, VetoRecord> = new Map();
  private delegations: Map<AgentId, DelegationRecord> = new Map();

  private readonly COUNCIL_SIZE = 15;
  private readonly QUORUM_THRESHOLD = 8;

  constructor(
    private auditLogger: AuditLogger,
    private eventBus: EventBus,
  ) {}

  /**
   * Delegate voting power to another agent for 24 hours.
   */
  delegateVote(delegator: AgentId, delegatee: AgentId): void {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    this.delegations.set(delegator, { delegator, delegatee, expiresAt });
    void this.auditLogger.log('council:delegation', delegator, 'verified', {
      delegatee,
      expiresAt,
    });
  }

  /**
   * Resolve true voter (handling active delegations).
   */
  private resolveDelegatee(agent: AgentId): AgentId {
    const delegation = this.delegations.get(agent);
    if (delegation && new Date(delegation.expiresAt) > new Date()) {
      return this.resolveDelegatee(delegation.delegatee); // follow chain
    }
    return agent;
  }

  createVote(request: CreateVoteRequest): Vote {
    const voteId = randomUUID();
    const deadlineMinutes = request.isFastTrack ? 15 : (request.deadline_minutes ?? 60);
    const deadline = new Date(Date.now() + deadlineMinutes * 60 * 1000);

    const eligible_voters = Object.values(COUNCIL_MEMBERS)
      .filter((m): m is CouncilMember => m !== undefined)
      .filter(m => m.isCore || (request.domains && request.domains.some(d => canVeto(m.id, d))))
      .map(m => m.id);

    const vote: Vote = {
      vote_id: voteId,
      topic: request.topic,
      description: request.description,
      threshold: request.threshold,
      deadline: deadline.toISOString(),
      created_at: new Date().toISOString(),
      eligible_voters,
      votes: {},
      status: 'OPEN',
    };

    if (request.domains && request.domains.length > 0) {
      vote.description = `${vote.description}\n[DOMAINS: ${request.domains.join(', ')}]`;
    }

    this.votes.set(voteId, vote);

    void this.auditLogger.log('vote:created', request.initiated_by, 'verified', {
      vote_id: voteId,
      topic: request.topic,
      threshold: request.threshold,
      deadline: deadline.toISOString(),
    });

    void this.eventBus.emit('vote:started', {
      voteId,
      topic: request.topic,
      threshold: request.threshold,
      deadline: deadline.toISOString(),
    });

    return vote;
  }

  castVote(voteId: string, originalAgent: AgentId, option: VoteOption, reasoning: string): boolean {
    const vote = this.votes.get(voteId);
    if (!vote || vote.status !== 'OPEN') return false;

    const agent = this.resolveDelegatee(originalAgent);
    if (!COUNCIL_MEMBERS[agent]) return false;
    if (vote.eligible_voters && !vote.eligible_voters.includes(agent)) return false;

    if (new Date() > new Date(vote.deadline)) {
      this.closeVote(voteId, 'EXPIRED');
      return false;
    }

    const timeRemainingMs = new Date(vote.deadline).getTime() - Date.now();
    const minutesRemaining = timeRemainingMs / (60 * 1000);

    // Calculate total minutes based on created_at, fallback to 60 if not available
    let totalMinutes = 60;
    if ('created_at' in vote && typeof vote.created_at === 'string') {
      const totalTimeMs = new Date(vote.deadline).getTime() - new Date(vote.created_at).getTime();
      totalMinutes = Math.max(1, totalTimeMs / (60 * 1000));
    }

    // Decay factor decays from 1.0 down to 0.95 over total duration
    const decayFactor = Math.max(
      0.95,
      Math.min(1.0, 0.95 + 0.05 * (minutesRemaining / totalMinutes)),
    );

    vote.votes[agent] = {
      agent,
      vote: option,
      reasoning: `${reasoning} [Weight: ${decayFactor.toFixed(3)}]`,
      timestamp: new Date().toISOString(),
    };

    void this.auditLogger.log('vote:cast', agent, 'verified', {
      vote_id: voteId,
      option,
      reasoning,
    });
    void this.eventBus.emit('vote:cast', { voteId, agent, option });

    this.checkEarlyConclusion(voteId);
    return true;
  }

  castVeto(
    voteId: string,
    agent: AgentId,
    domain: VetoDomain,
    tier: VetoTier,
    reason: string,
  ): boolean {
    const vote = this.votes.get(voteId);
    if (!vote || vote.status !== 'OPEN') return false;

    if (!canVeto(agent, domain)) return false;

    const vetoRecord: VetoRecord = {
      voteId,
      vetoer: agent,
      vetoerName: COUNCIL_MEMBERS[agent]?.name ?? agent,
      domain,
      tier,
      reason,
      timestamp: new Date().toISOString(),
    };
    this.vetoes.set(`${voteId}:${agent}`, vetoRecord);

    void this.auditLogger.log('vote:vetoed', agent, 'verified', {
      vote_id: voteId,
      domain,
      tier,
      reason,
    });
    void this.eventBus.emit('vote:vetoed', { voteId, vetoer: agent, domain, tier, reason });

    if (tier === 'VETO') {
      this.closeVoteWithVeto(voteId, agent, domain, reason);
    } else {
      this.checkEarlyConclusion(voteId);
    }

    return true;
  }

  private closeVoteWithVeto(
    voteId: string,
    vetoer: AgentId,
    _domain: VetoDomain,
    _reason: string,
  ): void {
    const vote = this.votes.get(voteId);
    if (!vote) return;

    vote.status = 'VETOED';
    vote.result = {
      approve: 0,
      reject: 0,
      abstain: 0,
      threshold_met: false,
    };

    void this.auditLogger.log('vote:closed', 'system', 'system', {
      vote_id: voteId,
      status: 'VETOED',
      vetoed_by: vetoer,
    });
    void this.eventBus.emit('vote:completed', { voteId, status: 'VETOED', result: vote.result });
  }

  private checkEarlyConclusion(voteId: string): void {
    const vote = this.votes.get(voteId);
    if (!vote || vote.status !== 'OPEN') return;

    const currentVotes = Object.values(vote.votes);
    const approveCount = currentVotes.filter((v) => v.vote === 'APPROVE').length;
    const rejectCount = currentVotes.filter((v) => v.vote === 'REJECT').length;

    const voteVetoes = Array.from(this.vetoes.values()).filter((v) => v.voteId === voteId);
    const hasStrongObjection = voteVetoes.some((v) => v.tier === 'STRONG_OBJECTION');
    const hasConcern = voteVetoes.some((v) => v.tier === 'CONCERN');

    const councilSize = vote.eligible_voters ? vote.eligible_voters.length : this.COUNCIL_SIZE;

    let dynamicMajority = Math.floor(councilSize / 2) + 1;
    let dynamicSuper = Math.floor(councilSize * (2 / 3)) + 1;

    if (hasStrongObjection) {
      dynamicMajority = Math.min(councilSize, dynamicMajority + 2);
      dynamicSuper = Math.min(councilSize, dynamicSuper + 2);
    } else if (hasConcern) {
      dynamicMajority = Math.min(councilSize, dynamicMajority + 1);
    }

    if (vote.threshold === 'UNANIMOUS') {
      if (rejectCount > 0) this.closeVote(voteId, 'FAILED');
      else if (approveCount === councilSize) this.closeVote(voteId, 'PASSED');
    } else if (vote.threshold === 'SUPERMAJORITY') {
      if (approveCount >= dynamicSuper) this.closeVote(voteId, 'PASSED');
      else if (rejectCount > councilSize - dynamicSuper) this.closeVote(voteId, 'FAILED');
    } else if (vote.threshold === 'MAJORITY') {
      if (approveCount >= dynamicMajority) this.closeVote(voteId, 'PASSED');
      else if (rejectCount >= dynamicMajority) this.closeVote(voteId, 'FAILED');
    }
  }

  closeVote(voteId: string, status: 'PASSED' | 'FAILED' | 'EXPIRED'): void {
    const vote = this.votes.get(voteId);
    if (!vote || vote.status !== 'OPEN') return;

    const currentVotes = Object.values(vote.votes);
    const approveCount = currentVotes.filter((v) => v.vote === 'APPROVE').length;
    const rejectCount = currentVotes.filter((v) => v.vote === 'REJECT').length;
    const abstainCount = currentVotes.filter((v) => v.vote === 'ABSTAIN').length;

    vote.status = status;
    vote.result = {
      approve: approveCount,
      reject: rejectCount,
      abstain: abstainCount,
      threshold_met: status === 'PASSED',
    };

    void this.auditLogger.log('vote:closed', 'system', 'system', {
      vote_id: voteId,
      status,
      result: vote.result,
    });
    void this.eventBus.emit('vote:completed', { voteId, status, result: vote.result });
  }

  /**
   * Allows the Operator (human) to manually override and close a vote.
   */
  operatorOverride(voteId: string, action: 'APPROVE' | 'REJECT', reasoning: string): boolean {
    const vote = this.votes.get(voteId);
    if (!vote || vote.status !== 'OPEN') return false;

    void this.auditLogger.log('vote:operator_override', 'operator', 'operator', {
      vote_id: voteId,
      action,
      reasoning,
    });

    this.closeVote(voteId, action === 'APPROVE' ? 'PASSED' : 'FAILED');
    return true;
  }

  getVote(voteId: string): Vote | undefined {
    return this.votes.get(voteId);
  }
  getOpenVotes(): Vote[] {
    return Array.from(this.votes.values()).filter((v) => v.status === 'OPEN');
  }
  getAllVotes(): Vote[] {
    return Array.from(this.votes.values());
  }
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
