// ═══════════════════════════════════════════════════════════════════════════════
// AI Policy Governor — Council Governance Bridge
// ═══════════════════════════════════════════════════════════════════════════════
//
// Layer 2 (System) component that governs AI spending through the Council
// (Layer 4) via dependency injection. The concrete Council is provided by
// the caller at Layer 5+, avoiding direct Layer 4 imports (ADR-003).
//
// Cost Tiers:
//   < $0.005:       Auto-approved (trivial)
//   $0.005-$0.05:   Simple majority (8/15)
//   $0.05-$0.25:    Weighted majority (domain-weighted)
//   $0.25-$1.00:    Supermajority (10/15)
//   > $1.00:        Super-supermajority (12/15)
//
// Sub-$0.25 requests use predicted voting based on SOUL profiles.
// $0.25+ requests use full Council deliberation.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { EventBus } from '../kernel/event-bus.js';
import type { AgentId } from '../kernel/types.js';
import { VETO_AUTHORITY, VOTING_AGENTS } from '../kernel/types.js';
import type {
  CouncilInterface,
  GovernanceDecision,
  AIRequest,
  ModelTier,
  VotingMechanism,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// COST THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════════

const COST_THRESHOLDS = {
  AUTO_APPROVE: 0.005,
  SIMPLE_MAJORITY: 0.05,
  WEIGHTED_MAJORITY: 0.25,
  SUPERMAJORITY: 1.00,
} as const;

const EMERGENCY_COST_THRESHOLD = 0.50;

// ═══════════════════════════════════════════════════════════════════════════════
// SOUL VOTING STYLE PROFILES
// ═══════════════════════════════════════════════════════════════════════════════

// Cautious (5): Default REJECT unless evidence is strong
const CAUTIOUS_AGENTS: readonly AgentId[] = [
  'guardian',       // AEGIS
  'risk_assessor',  // SCOUT
  'ethics',         // VERA
  'memory_keeper',  // ECHO
  'wealth',         // MINT
];

// Balanced (7): Weigh proportionally
const BALANCED_AGENTS: readonly AgentId[] = [
  'router',           // ATLAS
  'scheduler',        // TEMPO
  'resource_manager', // OPAL
  'wellness',         // PULSE
  'relationships',    // EMBER
  'creative',         // PRISM
  'integrator',       // NEXUS
];

// Progressive (3): Default APPROVE unless risk is clear
const PROGRESSIVE_AGENTS: readonly AgentId[] = [
  'executor',  // BOLT
  'planner',   // TRUE
  'growth',    // BLOOM
];

// ═══════════════════════════════════════════════════════════════════════════════
// AI POLICY GOVERNOR
// ═══════════════════════════════════════════════════════════════════════════════

export class AIPolicyGovernor {
  private readonly eventBus: EventBus;
  private readonly council: CouncilInterface;

  constructor(eventBus: EventBus, council: CouncilInterface) {
    this.eventBus = eventBus;
    this.council = council;
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═════════════════════════════════════════════════════════════════════════════

  requiresGovernance(_request: AIRequest, estimatedCost: number): boolean {
    return estimatedCost >= COST_THRESHOLDS.AUTO_APPROVE;
  }

  async requestApproval(
    request: AIRequest,
    estimatedCost: number,
    selectedModel: ModelTier,
  ): Promise<GovernanceDecision> {
    // Auto-approve trivial costs
    if (estimatedCost < COST_THRESHOLDS.AUTO_APPROVE) {
      this.emitAudit('ai_governance_auto_approved', request.agent, {
        estimatedCost,
        selectedModel,
      });
      return {
        approved: true,
        reason: `Auto-approved: cost $${estimatedCost.toFixed(4)} below threshold`,
        votingMechanism: 'auto_approved',
        vetoExercised: false,
      };
    }

    const mechanism = this.selectVotingMechanism(estimatedCost);

    // Check vetoes first (any veto immediately rejects)
    const vetoCheck = this.checkVetoes(request, estimatedCost, mechanism);
    if (vetoCheck.vetoed) {
      this.emitAudit('ai_governance_vetoed', vetoCheck.vetoAgent ?? request.agent, {
        estimatedCost,
        selectedModel,
        vetoDomain: vetoCheck.vetoDomain,
        reason: vetoCheck.reason,
      });
      return {
        approved: false,
        reason: vetoCheck.reason ?? 'Veto exercised',
        votingMechanism: mechanism,
        vetoExercised: true,
        vetoAgent: vetoCheck.vetoAgent,
        vetoDomain: vetoCheck.vetoDomain,
      };
    }

    // Sub-$0.25: Use predicted voting (fast path, no Council deliberation)
    if (estimatedCost < COST_THRESHOLDS.WEIGHTED_MAJORITY) {
      const decision = this.predictVotingOutcome(request, estimatedCost, mechanism);
      this.emitAudit('ai_governance_predicted', request.agent, {
        estimatedCost,
        selectedModel,
        mechanism,
        approved: decision.approved,
      });
      return decision;
    }

    // $0.25+: Full Council deliberation
    return this.fullCouncilDeliberation(
      request,
      estimatedCost,
      selectedModel,
      mechanism,
    );
  }

  emergencyBudgetVote(
    currentSpend: number,
    monthlyBudget: number,
  ): Promise<GovernanceDecision> {
    this.emitAudit('ai_emergency_budget_vote', 'core', {
      currentSpend,
      monthlyBudget,
    });

    // Emergency votes require MINT + OPAL + SCOUT unanimous
    const emergencyAgents: AgentId[] = ['wealth', 'resource_manager', 'risk_assessor'];
    const vote = this.council.createVote({
      topic: 'Emergency Budget Authorization',
      description: `Spend $${currentSpend.toFixed(2)} of $${monthlyBudget.toFixed(2)} monthly budget`,
      threshold: 'UNANIMOUS',
      deadline_minutes: 1,
      initiated_by: 'core',
      domains: ['major_financial', 'resource_depletion', 'high_risk'],
    });

    // All three must approve for emergency to pass
    for (const agent of emergencyAgents) {
      const shouldApprove = currentSpend < monthlyBudget * 0.95;
      this.council.castVote(
        vote.vote_id,
        agent,
        shouldApprove ? 'APPROVE' : 'REJECT',
        `Budget ${shouldApprove ? 'within' : 'exceeds'} safe threshold`,
      );
    }

    const allApproved = currentSpend < monthlyBudget * 0.95;
    this.council.closeVote(
      vote.vote_id,
      allApproved ? 'PASSED' : 'FAILED',
    );

    return Promise.resolve({
      approved: allApproved,
      reason: allApproved
        ? 'Emergency budget approved by MINT, OPAL, SCOUT'
        : 'Emergency budget rejected: spend exceeds 95% of monthly budget',
      votingMechanism: 'emergency' as const,
      councilVoteId: vote.vote_id,
      vetoExercised: false,
    });
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PRIVATE — VOTING PREDICTION
  // ═════════════════════════════════════════════════════════════════════════════

  private predictVotingOutcome(
    request: AIRequest,
    estimatedCost: number,
    mechanism: VotingMechanism,
  ): GovernanceDecision {
    let approvals = 0;
    let rejections = 0;

    for (const agent of VOTING_AGENTS) {
      const vote = this.predictAgentVote(agent, request, estimatedCost);
      if (vote === 'approve') approvals++;
      else if (vote === 'reject') rejections++;
    }

    const threshold = this.getVotingThresholdCount(mechanism);
    const approved = approvals >= threshold;

    return {
      approved,
      reason: `Predicted: ${approvals} approvals vs ${threshold} required (${mechanism}). ${rejections} rejections.`,
      votingMechanism: mechanism,
      vetoExercised: false,
    };
  }

  private predictAgentVote(
    agent: AgentId,
    _request: AIRequest,
    estimatedCost: number,
  ): 'approve' | 'reject' | 'abstain' {
    // Cautious: Default reject unless cost is reasonable
    if (CAUTIOUS_AGENTS.includes(agent)) {
      return estimatedCost < COST_THRESHOLDS.SIMPLE_MAJORITY ? 'approve' : 'reject';
    }

    // Progressive: Default approve unless cost is clearly excessive
    if (PROGRESSIVE_AGENTS.includes(agent)) {
      return estimatedCost < EMERGENCY_COST_THRESHOLD ? 'approve' : 'reject';
    }

    // Balanced: Approve moderate costs, reject expensive ones
    if (BALANCED_AGENTS.includes(agent)) {
      return estimatedCost < COST_THRESHOLDS.WEIGHTED_MAJORITY ? 'approve' : 'reject';
    }

    return 'abstain';
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PRIVATE — FULL COUNCIL DELIBERATION
  // ═════════════════════════════════════════════════════════════════════════════

  private fullCouncilDeliberation(
    request: AIRequest,
    estimatedCost: number,
    selectedModel: ModelTier,
    mechanism: VotingMechanism,
  ): Promise<GovernanceDecision> {
    const threshold = mechanism === 'supermajority' ? 'SUPERMAJORITY' as const
      : 'MAJORITY' as const;

    const vote = this.council.createVote({
      topic: `AI Spending: ${request.category} via ${selectedModel}`,
      description: `Estimated cost: $${estimatedCost.toFixed(4)}, Category: ${request.category}, Agent: ${request.agent}`,
      threshold,
      deadline_minutes: 1,
      initiated_by: request.agent,
      domains: ['major_financial'],
    });

    // Cast votes from all 15 members using prediction logic
    for (const agent of VOTING_AGENTS) {
      const voteOption = this.predictAgentVote(agent, request, estimatedCost);
      const upperVote = voteOption === 'approve' ? 'APPROVE' as const
        : voteOption === 'reject' ? 'REJECT' as const
        : 'ABSTAIN' as const;
      this.council.castVote(
        vote.vote_id,
        agent,
        upperVote,
        `${mechanism} vote: cost=$${estimatedCost.toFixed(4)}`,
      );
    }

    // Tally and close
    const requiredCount = this.getVotingThresholdCount(mechanism);
    let approvals = 0;
    for (const agent of VOTING_AGENTS) {
      const v = this.predictAgentVote(agent, request, estimatedCost);
      if (v === 'approve') approvals++;
    }

    const approved = approvals >= requiredCount;
    this.council.closeVote(vote.vote_id, approved ? 'PASSED' : 'FAILED');

    this.emitAudit('ai_governance_deliberated', request.agent, {
      estimatedCost,
      selectedModel,
      mechanism,
      voteId: vote.vote_id,
      approved,
      approvals,
      requiredCount,
    });

    return Promise.resolve({
      approved,
      reason: `Council deliberation: ${approvals}/${requiredCount} approvals (${mechanism})`,
      votingMechanism: mechanism,
      councilVoteId: vote.vote_id,
      vetoExercised: false,
    });
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PRIVATE — VETO CHECKING
  // ═════════════════════════════════════════════════════════════════════════════

  private checkVetoes(
    request: AIRequest,
    estimatedCost: number,
    mechanism: VotingMechanism,
  ): { vetoed: boolean; vetoAgent?: AgentId; vetoDomain?: string; reason?: string } {
    // MINT (wealth): vetoes expensive requests in supermajority+ scenarios
    const mintDomains = VETO_AUTHORITY['wealth'];
    if (mintDomains?.includes('major_financial')) {
      if (
        estimatedCost > EMERGENCY_COST_THRESHOLD &&
        (mechanism === 'supermajority' || mechanism === 'super_supermajority')
      ) {
        return {
          vetoed: true,
          vetoAgent: 'wealth',
          vetoDomain: 'major_financial',
          reason: `MINT veto: cost $${estimatedCost.toFixed(4)} exceeds safe threshold`,
        };
      }
    }

    // OPAL (resource_manager): vetoes if token estimate is extreme
    const opalDomains = VETO_AUTHORITY['resource_manager'];
    if (opalDomains?.includes('resource_depletion')) {
      const estimatedTokens = Math.ceil(request.content.length / 4) + 500;
      if (estimatedTokens > 100_000) {
        return {
          vetoed: true,
          vetoAgent: 'resource_manager',
          vetoDomain: 'resource_depletion',
          reason: `OPAL veto: estimated ${estimatedTokens} tokens exceeds daily limit`,
        };
      }
    }

    // SCOUT (risk_assessor): vetoes high-risk security requests
    const scoutDomains = VETO_AUTHORITY['risk_assessor'];
    if (scoutDomains?.includes('high_risk')) {
      if (request.securitySensitive && estimatedCost > COST_THRESHOLDS.SUPERMAJORITY) {
        return {
          vetoed: true,
          vetoAgent: 'risk_assessor',
          vetoDomain: 'high_risk',
          reason: 'SCOUT veto: high-risk security-sensitive request with elevated cost',
        };
      }
    }

    // AEGIS (guardian): vetoes security-sensitive content with low trust
    const aegisDomains = VETO_AUTHORITY['guardian'];
    if (aegisDomains?.includes('security')) {
      if (
        request.securitySensitive &&
        (request.trustLevel === 'untrusted' || request.trustLevel === 'hostile')
      ) {
        return {
          vetoed: true,
          vetoAgent: 'guardian',
          vetoDomain: 'security',
          reason: 'AEGIS veto: security-sensitive content with insufficient trust level',
        };
      }
    }

    return { vetoed: false };
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PRIVATE — MECHANISM SELECTION
  // ═════════════════════════════════════════════════════════════════════════════

  private selectVotingMechanism(estimatedCost: number): VotingMechanism {
    if (estimatedCost < COST_THRESHOLDS.AUTO_APPROVE) return 'auto_approved';
    if (estimatedCost < COST_THRESHOLDS.SIMPLE_MAJORITY) return 'simple_majority';
    if (estimatedCost < COST_THRESHOLDS.WEIGHTED_MAJORITY) return 'weighted_majority';
    if (estimatedCost < COST_THRESHOLDS.SUPERMAJORITY) return 'supermajority';
    return 'super_supermajority';
  }

  private getVotingThresholdCount(mechanism: VotingMechanism): number {
    const thresholds: Record<VotingMechanism, number> = {
      auto_approved: 0,
      simple_majority: 8,
      weighted_majority: 8,
      supermajority: 10,
      super_supermajority: 12,
      emergency: 15,
    };
    return thresholds[mechanism];
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PRIVATE — AUDIT
  // ═════════════════════════════════════════════════════════════════════════════

  private emitAudit(
    action: string,
    agent: string,
    details: Record<string, unknown>,
  ): void {
    this.eventBus.emit('audit:log', {
      action,
      agent,
      trustLevel: 'system',
      details,
    });
  }
}
