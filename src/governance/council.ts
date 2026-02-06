import { randomUUID } from 'crypto';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type {
  AgentId, Vote, VoteOption, VoteThreshold, VetoDomain, CouncilPillar,
} from '../kernel/types.js';
import {
  VOTING_AGENTS, VETO_AUTHORITY, PILLAR_QUORUM_MINIMUM, ALL_PILLARS,
} from '../kernel/types.js';
import { COUNCIL_MEMBERS, canVeto } from './council-members.js';
import type {
  DeliberationResult,
  ProposalAnalysis,
} from './council-deliberation.js';
import {
  DeliberationEngine,
  OutcomeTracker,
} from './council-deliberation.js';
import { SOULManager } from './soul.js';

// ── Request Types ────────────────────────────────────────────────────────────

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
 * Emergency fast-track vote request.
 * Only domain-relevant members participate, tight deadline, UNANIMOUS required.
 */
export interface EmergencyVoteRequest {
  topic: string;
  description: string;
  urgency_reason: string;
  initiated_by: AgentId;
  domains: string[];
  /** Deadline in minutes (default: 5, max: 15) */
  deadline_minutes?: number;
}

// ── Record Types ─────────────────────────────────────────────────────────────

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
 * Dissent report — preserved minority reasoning for institutional memory.
 * Generated automatically when a vote closes with < 80% consensus.
 */
export interface DissentReport {
  voteId: string;
  topic: string;
  decision: 'PASSED' | 'FAILED' | 'VETOED' | 'EXPIRED';
  dissenters: Array<{
    agentId: AgentId;
    memberName: string;
    pillar: CouncilPillar;
    vote: VoteOption;
    reasoning: string;
  }>;
  consensusStrength: number;
  domains: string[];
  generatedAt: string;
  precedents: Array<{
    voteId: string;
    topic: string;
    similarity: number;
    outcome?: string;
  }>;
}

/**
 * Emergency vote metadata — tracks fast-track votes and overturn windows.
 */
export interface EmergencyVoteMeta {
  voteId: string;
  panelMembers: AgentId[];
  urgencyReason: string;
  fullCouncilNotifiedAt: string;
  overturnDeadline: string;
  overturnVoteId?: string;
  overturned: boolean;
}

/**
 * Pillar quorum check result.
 */
export interface PillarQuorumResult {
  met: boolean;
  pillarsRepresented: CouncilPillar[];
  missingPillars: CouncilPillar[];
  countQuorumMet: boolean;
  totalVoted: number;
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

  // Deliberation engine — enriches votes with SOUL + cognitive analysis
  private deliberationEngine: DeliberationEngine;
  private deliberationResults: Map<string, DeliberationResult> = new Map();

  // Dissent reports — institutional memory of minority reasoning
  private dissentReports: Map<string, DissentReport> = new Map();

  // Emergency votes — fast-track metadata and overturn tracking
  private emergencyVotes: Map<string, EmergencyVoteMeta> = new Map();

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

  // Dissent threshold — generate report if consensus < 80%
  private readonly DISSENT_THRESHOLD = 0.8;

  // Emergency vote constraints
  private readonly EMERGENCY_MIN_PANEL = 3;
  private readonly EMERGENCY_MAX_PANEL = 5;
  private readonly EMERGENCY_MAX_DEADLINE_MINUTES = 15;
  private readonly EMERGENCY_DEFAULT_DEADLINE_MINUTES = 5;
  private readonly OVERTURN_WINDOW_HOURS = 24;

  constructor(
    private auditLogger: AuditLogger,
    private eventBus: EventBus
  ) {
    const outcomeTracker = new OutcomeTracker(eventBus, auditLogger);
    this.deliberationEngine = new DeliberationEngine(eventBus, auditLogger, outcomeTracker);
  }

  /**
   * Initialize SOUL-driven deliberation.
   * Call this after construction to load SOUL personalities.
   */
  async initializeDeliberation(soulsPath?: string): Promise<void> {
    const soulManager = new SOULManager(soulsPath);
    await soulManager.loadSouls();
    this.deliberationEngine.setSoulManager(soulManager);
  }

  /**
   * Set a custom SOULManager (useful for testing).
   */
  setSoulManager(soulManager: SOULManager): void {
    this.deliberationEngine.setSoulManager(soulManager);
  }

  /**
   * Get the deliberation engine (for external access).
   */
  getDeliberationEngine(): DeliberationEngine {
    return this.deliberationEngine;
  }

  /**
   * Get the outcome tracker (for recording results).
   */
  getOutcomeTracker(): OutcomeTracker {
    return this.deliberationEngine.getOutcomeTracker();
  }

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

    // Run deliberation analysis on the proposal
    const deliberationResult = this.deliberationEngine.deliberate({
      topic: request.topic,
      description: request.description,
      domains: (request.domains as string[]) ?? [],
      initiatedBy: request.initiated_by,
    });
    this.deliberationResults.set(voteId, deliberationResult);

    // Audit the vote creation (enriched with deliberation)
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
        deliberation: {
          risk: deliberationResult.analysis.risk,
          aggregate_recommendation: deliberationResult.aggregateRecommendation,
          consensus_strength: deliberationResult.consensusStrength,
          bias_warnings: deliberationResult.analysis.biasWarnings.length,
        },
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

    // Get Council member info for richer audit
    const member = COUNCIL_MEMBERS[agent];
    const memberName = member?.name ?? agent;

    // Get deliberation recommendation for this member (if available)
    const deliberation = this.deliberationResults.get(voteId);
    const memberDeliberation = deliberation?.recommendations.find(r => r.agentId === agent);

    // Record the vote
    vote.votes[agent] = {
      agent,
      vote: option,
      reasoning,
      timestamp: new Date().toISOString(),
    };

    // Determine if vote aligns with deliberation recommendation
    const alignsWithDeliberation = memberDeliberation
      ? option.toLowerCase() === memberDeliberation.recommendation
      : undefined;

    // Audit the vote cast (enriched with deliberation context)
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
        deliberation: memberDeliberation ? {
          soul_recommendation: memberDeliberation.recommendation,
          soul_confidence: memberDeliberation.confidence,
          soul_consulted: memberDeliberation.soulConsulted,
          domain_relevance: memberDeliberation.domainRelevance,
          weighted_influence: memberDeliberation.weightedInfluence,
          aligns_with_deliberation: alignsWithDeliberation,
        } : undefined,
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
      console.error(`Vote ${voteId} not found`);
      return false;
    }

    // Check if vote is still open
    if (vote.status !== 'OPEN') {
      console.error(`Vote ${voteId} is not open (status: ${vote.status})`);
      return false;
    }

    // Check if agent has veto authority for this domain
    if (!canVeto(agent, domain)) {
      console.error(`Agent ${agent} does not have veto authority for domain ${domain}`);
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
   *
   * Enhanced with:
   * - Pillar quorum: requires 3+ of 5 pillars represented
   * - Dissent reports: auto-generated when consensus < 80%
   *
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
    const votedCount = currentVotes.length;

    // Check count quorum (50% of 15 = 8 members must participate)
    const countQuorumMet = votedCount >= this.QUORUM_THRESHOLD;

    // Check pillar quorum (3+ of 5 pillars must be represented)
    const pillarQuorum = this.checkPillarQuorum(vote);

    // Both quorum types must be met for a valid vote
    const quorumMet = countQuorumMet && pillarQuorum.met;

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

    // If pillar quorum failed but count quorum passed, downgrade PASSED to FAILED
    if (status === 'PASSED' && countQuorumMet && !pillarQuorum.met) {
      status = 'FAILED';
      thresholdMet = false;

      void this.auditLogger.log(
        'vote:pillar_quorum_failed',
        'system',
        'system',
        {
          vote_id: voteId,
          pillars_represented: pillarQuorum.pillarsRepresented,
          missing_pillars: pillarQuorum.missingPillars,
          required: PILLAR_QUORUM_MINIMUM,
        }
      );

      void this.eventBus.emit('council:pillar_quorum_failed', {
        voteId,
        topic: vote.topic,
        pillarsRepresented: pillarQuorum.pillarsRepresented,
        missingPillars: pillarQuorum.missingPillars,
      });
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

    // Audit the vote closure (enriched with pillar quorum)
    void this.auditLogger.log(
      'vote:closed',
      'system',
      'system',
      {
        vote_id: voteId,
        status,
        result: vote.result,
        count_quorum_met: countQuorumMet,
        pillar_quorum_met: pillarQuorum.met,
        pillars_represented: pillarQuorum.pillarsRepresented,
        council_size: this.COUNCIL_SIZE,
        thresholds: {
          majority: this.MAJORITY_THRESHOLD,
          supermajority: this.SUPERMAJORITY_THRESHOLD,
          quorum: this.QUORUM_THRESHOLD,
          pillar_quorum: PILLAR_QUORUM_MINIMUM,
        },
      }
    );

    // Emit vote:completed event
    void this.eventBus.emit('vote:completed', {
      voteId,
      status,
      result: vote.result,
    });

    // Auto-generate dissent report if consensus was weak
    this.maybeGenerateDissentReport(voteId, vote, status);
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
   * Get the deliberation result for a vote.
   */
  getDeliberation(voteId: string): DeliberationResult | undefined {
    return this.deliberationResults.get(voteId);
  }

  /**
   * Get the proposal analysis for a vote (shortcut).
   */
  getProposalAnalysis(voteId: string): ProposalAnalysis | undefined {
    return this.deliberationResults.get(voteId)?.analysis;
  }

  /**
   * Get Council statistics.
   */
  getCouncilStats(): {
    size: number;
    thresholds: {
      majority: number;
      supermajority: number;
      unanimous: number;
      quorum: number;
      pillar_quorum: number;
    };
    vetoHolders: number;
    votingBalance: { cautious: number; balanced: number; progressive: number };
    dissentReports: number;
    emergencyVotes: number;
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
        pillar_quorum: PILLAR_QUORUM_MINIMUM,
      },
      vetoHolders,
      votingBalance,
      dissentReports: this.dissentReports.size,
      emergencyVotes: this.emergencyVotes.size,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PILLAR QUORUM
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Check pillar quorum for a vote.
   *
   * Requires at least PILLAR_QUORUM_MINIMUM (3) of 5 pillars to have
   * at least one member who voted. Prevents governance blind spots where
   * one category of members dominates decisions.
   */
  checkPillarQuorum(vote: Vote): PillarQuorumResult {
    const votedAgents = Object.keys(vote.votes) as AgentId[];
    const pillarsRepresented = new Set<CouncilPillar>();

    for (const agentId of votedAgents) {
      const member = COUNCIL_MEMBERS[agentId];
      if (member) {
        pillarsRepresented.add(member.pillar);
      }
    }

    const missingPillars = ALL_PILLARS.filter(
      p => !pillarsRepresented.has(p)
    );

    return {
      met: pillarsRepresented.size >= PILLAR_QUORUM_MINIMUM,
      pillarsRepresented: Array.from(pillarsRepresented),
      missingPillars,
      countQuorumMet: votedAgents.length >= this.QUORUM_THRESHOLD,
      totalVoted: votedAgents.length,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DISSENT REPORTS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Auto-generate a dissent report if consensus was weak (< 80%).
   * Called internally after closeVote.
   */
  private maybeGenerateDissentReport(
    voteId: string,
    vote: Vote,
    decision: 'PASSED' | 'FAILED' | 'EXPIRED',
  ): void {
    const currentVotes = Object.values(vote.votes);
    if (currentVotes.length === 0) return;

    const approveCount = currentVotes.filter(v => v.vote === 'APPROVE').length;
    const rejectCount = currentVotes.filter(v => v.vote === 'REJECT').length;
    const totalActive = approveCount + rejectCount;
    if (totalActive === 0) return;

    // Consensus strength: how unified was the vote?
    const majorityCount = Math.max(approveCount, rejectCount);
    const consensus = majorityCount / totalActive;

    // Only generate report if consensus < 80%
    if (consensus >= this.DISSENT_THRESHOLD) return;

    // Determine the majority position
    const majorityOption = approveCount >= rejectCount ? 'APPROVE' : 'REJECT';

    // Collect dissenters (those who voted against the majority)
    const dissenters = currentVotes
      .filter(v => v.vote !== 'ABSTAIN' && v.vote !== majorityOption)
      .map(v => {
        const member = COUNCIL_MEMBERS[v.agent];
        return {
          agentId: v.agent,
          memberName: member?.name ?? v.agent,
          pillar: member?.pillar ?? 'meta' as CouncilPillar,
          vote: v.vote,
          reasoning: v.reasoning,
        };
      });

    if (dissenters.length === 0) return;

    // Extract domains from deliberation result
    const deliberation = this.deliberationResults.get(voteId);
    const domains = deliberation?.analysis.domains ?? [];

    // Find precedents — past dissent reports on similar topics
    const precedents = this.findPrecedents(vote.topic, domains);

    const report: DissentReport = {
      voteId,
      topic: vote.topic,
      decision,
      dissenters,
      consensusStrength: consensus,
      domains,
      generatedAt: new Date().toISOString(),
      precedents,
    };

    this.dissentReports.set(voteId, report);

    // Audit the dissent report
    void this.auditLogger.log(
      'council:dissent_report',
      'system',
      'system',
      {
        vote_id: voteId,
        topic: vote.topic,
        decision,
        dissenter_count: dissenters.length,
        consensus_strength: consensus,
        domains,
        precedent_count: precedents.length,
        dissenters: dissenters.map(d => ({
          name: d.memberName,
          pillar: d.pillar,
          vote: d.vote,
        })),
      }
    );

    // Emit event for dashboard / monitoring
    void this.eventBus.emit('council:dissent_report_generated', {
      voteId,
      topic: vote.topic,
      dissenterCount: dissenters.length,
      consensusStrength: consensus,
      precedentCount: precedents.length,
    });
  }

  /**
   * Find precedents — past dissent reports on similar topics.
   * Uses simple keyword overlap for similarity scoring.
   */
  private findPrecedents(
    topic: string,
    domains: string[],
    maxResults: number = 5,
  ): DissentReport['precedents'] {
    const topicWords = new Set(
      topic.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );

    const scored: Array<{ report: DissentReport; similarity: number }> = [];

    for (const [, report] of this.dissentReports) {
      const pastWords = new Set(
        report.topic.toLowerCase().split(/\s+/).filter(w => w.length > 3)
      );

      // Word overlap
      const overlap = [...topicWords].filter(w => pastWords.has(w)).length;
      const wordSimilarity = topicWords.size > 0
        ? overlap / topicWords.size
        : 0;

      // Domain overlap
      const domainOverlap = domains.filter(
        d => report.domains.includes(d)
      ).length;
      const domainSimilarity = domains.length > 0
        ? domainOverlap / domains.length
        : 0;

      // Combined similarity (60% topic, 40% domain)
      const similarity = wordSimilarity * 0.6 + domainSimilarity * 0.4;

      if (similarity > 0.1) {
        scored.push({ report, similarity });
      }
    }

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults)
      .map(({ report, similarity }) => ({
        voteId: report.voteId,
        topic: report.topic,
        similarity,
        outcome: report.decision,
      }));
  }

  /**
   * Get a dissent report for a specific vote.
   */
  getDissentReport(voteId: string): DissentReport | undefined {
    return this.dissentReports.get(voteId);
  }

  /**
   * Get all dissent reports.
   */
  getAllDissentReports(): DissentReport[] {
    return Array.from(this.dissentReports.values());
  }

  /**
   * Search dissent reports by domain.
   */
  getDissentReportsByDomain(domain: string): DissentReport[] {
    return Array.from(this.dissentReports.values()).filter(
      r => r.domains.some(d => d.toLowerCase().includes(domain.toLowerCase()))
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EMERGENCY FAST-TRACK VOTING
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Create an emergency fast-track vote.
   *
   * Emergency votes differ from normal votes:
   * 1. Only domain-relevant members participate (3-5 members)
   * 2. Short deadline (default 5 min, max 15 min)
   * 3. Requires UNANIMOUS approval among the panel
   * 4. Full council is notified and can overturn within 24h
   *
   * @param request Emergency vote request
   * @returns The created vote and emergency metadata
   */
  createEmergencyVote(request: EmergencyVoteRequest): {
    vote: Vote;
    emergency: EmergencyVoteMeta;
  } {
    // Determine panel members using the deliberation engine's domain analysis
    const panelMembers = this.selectEmergencyPanel(request.domains);

    // Constrain deadline
    const deadlineMinutes = Math.min(
      request.deadline_minutes ?? this.EMERGENCY_DEFAULT_DEADLINE_MINUTES,
      this.EMERGENCY_MAX_DEADLINE_MINUTES,
    );

    // Create the vote with UNANIMOUS threshold
    const vote = this.createVote({
      topic: `[EMERGENCY] ${request.topic}`,
      description: `${request.description}\n\n[EMERGENCY FAST-TRACK]\nUrgency: ${request.urgency_reason}\nPanel: ${panelMembers.map(id => COUNCIL_MEMBERS[id]?.name ?? id).join(', ')}`,
      threshold: 'UNANIMOUS',
      deadline_minutes: deadlineMinutes,
      initiated_by: request.initiated_by,
      domains: request.domains as VetoDomain[],
    });

    // Calculate overturn deadline (24h from now)
    const overturnDeadline = new Date(
      Date.now() + this.OVERTURN_WINDOW_HOURS * 60 * 60 * 1000
    );

    const emergencyMeta: EmergencyVoteMeta = {
      voteId: vote.vote_id,
      panelMembers,
      urgencyReason: request.urgency_reason,
      fullCouncilNotifiedAt: new Date().toISOString(),
      overturnDeadline: overturnDeadline.toISOString(),
      overturned: false,
    };

    this.emergencyVotes.set(vote.vote_id, emergencyMeta);

    // Audit the emergency vote
    void this.auditLogger.log(
      'council:emergency_vote_created',
      request.initiated_by,
      'verified',
      {
        vote_id: vote.vote_id,
        topic: request.topic,
        urgency_reason: request.urgency_reason,
        panel_members: panelMembers,
        panel_names: panelMembers.map(id => COUNCIL_MEMBERS[id]?.name ?? id),
        deadline_minutes: deadlineMinutes,
        overturn_deadline: overturnDeadline.toISOString(),
      }
    );

    // Notify full council
    void this.eventBus.emit('council:emergency_vote_started', {
      voteId: vote.vote_id,
      topic: request.topic,
      urgencyReason: request.urgency_reason,
      panelMembers,
      overturnDeadline: overturnDeadline.toISOString(),
    });

    return { vote, emergency: emergencyMeta };
  }

  /**
   * Select the emergency panel — 3-5 domain-relevant members.
   */
  private selectEmergencyPanel(domains: string[]): AgentId[] {
    // Use the deliberation engine to find relevant members
    const deliberation = this.deliberationEngine;
    const analyzer = deliberation.getProposalAnalyzer();

    // Analyze a minimal proposal to identify relevant members
    const analysis = analyzer.analyze({
      topic: domains.join(' '),
      description: `Emergency assessment for domains: ${domains.join(', ')}`,
      domains,
      initiatedBy: 'system' as AgentId,
    });

    let panelMembers = analysis.relevantMembers;

    // Always include VERA (ethics) for constitutional oversight
    if (!panelMembers.includes('ethics' as AgentId)) {
      panelMembers.push('ethics' as AgentId);
    }

    // Clamp to 3-5 members
    if (panelMembers.length < this.EMERGENCY_MIN_PANEL) {
      // Add NEXUS (integrator) and/or AEGIS (guardian) as fallbacks
      const fallbacks: AgentId[] = ['integrator', 'guardian'] as AgentId[];
      for (const fb of fallbacks) {
        if (!panelMembers.includes(fb) && panelMembers.length < this.EMERGENCY_MIN_PANEL) {
          panelMembers.push(fb);
        }
      }
    }

    if (panelMembers.length > this.EMERGENCY_MAX_PANEL) {
      panelMembers = panelMembers.slice(0, this.EMERGENCY_MAX_PANEL);
    }

    return panelMembers;
  }

  /**
   * Cast a vote on an emergency fast-track (panel members only).
   * Same as castVote but validates panel membership.
   */
  castEmergencyVote(
    voteId: string,
    agent: AgentId,
    option: VoteOption,
    reasoning: string,
  ): boolean {
    const emergency = this.emergencyVotes.get(voteId);
    if (!emergency) {
      console.error(`Vote ${voteId} is not an emergency vote`);
      return false;
    }

    // Only panel members can vote on emergency votes
    if (!emergency.panelMembers.includes(agent)) {
      console.error(
        `Agent ${agent} is not on the emergency panel for vote ${voteId}`
      );
      return false;
    }

    return this.castVote(voteId, agent, option, reasoning);
  }

  /**
   * Request an overturn of an emergency vote by the full council.
   *
   * Creates a new SUPERMAJORITY vote for the full council to decide
   * whether to overturn the emergency decision.
   *
   * @param emergencyVoteId The emergency vote to potentially overturn
   * @param requestedBy Agent requesting the overturn
   * @param reason Reason for the overturn request
   * @returns The overturn vote, or null if the overturn window has passed
   */
  requestEmergencyOverturn(
    emergencyVoteId: string,
    requestedBy: AgentId,
    reason: string,
  ): Vote | null {
    const emergency = this.emergencyVotes.get(emergencyVoteId);
    if (!emergency) {
      console.error(`Emergency vote ${emergencyVoteId} not found`);
      return null;
    }

    // Check overturn window
    if (new Date() > new Date(emergency.overturnDeadline)) {
      console.error(
        `Overturn window for emergency vote ${emergencyVoteId} has passed`
      );
      return null;
    }

    // Already has an overturn vote
    if (emergency.overturnVoteId) {
      console.error(
        `Emergency vote ${emergencyVoteId} already has an overturn vote: ${emergency.overturnVoteId}`
      );
      return null;
    }

    const originalVote = this.votes.get(emergencyVoteId);
    const originalTopic = originalVote?.topic ?? 'Unknown';

    // Create full-council overturn vote
    const overturnVote = this.createVote({
      topic: `[OVERTURN] ${originalTopic}`,
      description: `Request to overturn emergency decision.\n\nOriginal: ${originalTopic}\nReason: ${reason}\n\nRequires SUPERMAJORITY (10/15) to overturn.`,
      threshold: 'SUPERMAJORITY',
      deadline_minutes: 60, // 1 hour for full deliberation
      initiated_by: requestedBy,
    });

    emergency.overturnVoteId = overturnVote.vote_id;

    // Audit the overturn request
    void this.auditLogger.log(
      'council:emergency_overturn_requested',
      requestedBy,
      'verified',
      {
        emergency_vote_id: emergencyVoteId,
        overturn_vote_id: overturnVote.vote_id,
        reason,
        original_topic: originalTopic,
      }
    );

    void this.eventBus.emit('council:emergency_overturn_requested', {
      emergencyVoteId,
      overturnVoteId: overturnVote.vote_id,
      requestedBy,
      reason,
    });

    return overturnVote;
  }

  /**
   * Complete an overturn — called when the overturn vote closes.
   * If SUPERMAJORITY approved, marks the original emergency vote as OVERTURNED.
   */
  completeOverturn(overturnVoteId: string): boolean {
    const overturnVote = this.votes.get(overturnVoteId);
    if (!overturnVote) return false;

    // Find the emergency vote this overturn relates to
    let emergencyMeta: EmergencyVoteMeta | undefined;
    for (const [, meta] of this.emergencyVotes) {
      if (meta.overturnVoteId === overturnVoteId) {
        emergencyMeta = meta;
        break;
      }
    }

    if (!emergencyMeta) return false;

    // Check if overturn vote passed
    if (overturnVote.result?.threshold_met) {
      const originalVote = this.votes.get(emergencyMeta.voteId);
      if (originalVote) {
        originalVote.status = 'OVERTURNED';
        emergencyMeta.overturned = true;

        void this.auditLogger.log(
          'council:emergency_overturned',
          'system',
          'system',
          {
            emergency_vote_id: emergencyMeta.voteId,
            overturn_vote_id: overturnVoteId,
          }
        );

        void this.eventBus.emit('council:emergency_overturned', {
          emergencyVoteId: emergencyMeta.voteId,
          overturnVoteId,
        });
      }
      return true;
    }

    return false;
  }

  /**
   * Get emergency vote metadata.
   */
  getEmergencyVote(voteId: string): EmergencyVoteMeta | undefined {
    return this.emergencyVotes.get(voteId);
  }

  /**
   * Get all emergency votes.
   */
  getAllEmergencyVotes(): EmergencyVoteMeta[] {
    return Array.from(this.emergencyVotes.values());
  }

  /**
   * Check if a vote is an emergency vote.
   */
  isEmergencyVote(voteId: string): boolean {
    return this.emergencyVotes.has(voteId);
  }

  /**
   * Get emergency votes still within their overturn window.
   */
  getOverturnableEmergencyVotes(): EmergencyVoteMeta[] {
    const now = new Date();
    return Array.from(this.emergencyVotes.values()).filter(
      meta => !meta.overturned
        && !meta.overturnVoteId
        && new Date(meta.overturnDeadline) > now
    );
  }
}
