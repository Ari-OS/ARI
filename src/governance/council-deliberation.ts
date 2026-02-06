/**
 * Council Deliberation Engine
 *
 * Transforms the Council from a simple vote-counter into a genuine
 * deliberative body by integrating:
 *
 * 1. **SOUL Consultation** — Each member's personality, values, and decision
 *    patterns influence their voting recommendation.
 * 2. **Cognitive Analysis** — LOGOS (risk/reward), ETHOS (bias detection),
 *    and PATHOS (virtue alignment) analyze every proposal.
 * 3. **Domain Weighting** — Votes from domain experts carry more weight.
 * 4. **Voting Style Enforcement** — Cautious/progressive styles actually
 *    modulate voting thresholds and confidence requirements.
 * 5. **Outcome Tracking** — Decisions are tracked against real-world results.
 * 6. **Member Credibility** — Updated based on prediction accuracy over time.
 *
 * @module governance/council-deliberation
 * @since 2.2.0
 */

import type { AgentId } from '../kernel/types.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { AuditLogger } from '../kernel/audit.js';
import type { SOULIdentity } from './soul.js';
import { SOULManager } from './soul.js';
import {
  COUNCIL_MEMBERS,
  findCoveringMembers,
  getMemberCoverage,
} from './council-members.js';
import type { VotingStyle, CouncilMember } from './council-members.js';
import { VOTING_AGENTS } from '../kernel/types.js';

// ── Domain Synonym Bridge ──────────────────────────────────────────────────

/**
 * Maps detected domain names (e.g., "security") to coverage terms used
 * in council-members.ts (e.g., "threats", "defense"). This bridges the
 * vocabulary gap between auto-detected domains and member coverage arrays.
 */
const DOMAIN_SYNONYMS: Record<string, string[]> = {
  security: ['threats', 'injection', 'anomalies', 'safety', 'defense'],
  financial: ['income', 'expenses', 'investments', 'budget', 'wealth', 'assets'],
  health: ['physical_health', 'mental_health', 'fitness', 'nutrition', 'medical', 'sleep', 'rest', 'recovery', 'leisure', 'downtime', 'vacation'],
  scheduling: ['calendar', 'deadlines', 'scheduling', 'rhythm'],
  ethics: ['morals', 'fairness', 'consequences', 'values', 'principles', 'honesty', 'purpose', 'meaning', 'philosophy', 'reflection'],
  creative: ['art', 'ideas', 'innovation', 'hobbies', 'imagination'],
  growth: ['learning', 'skills', 'career', 'self_improvement', 'habits'],
  relationships: ['family', 'friends', 'romance', 'professional', 'social'],
  planning: ['goals', 'decomposition', 'dependencies', 'projects'],
  execution: ['execution', 'tools', 'delivery', 'action'],
  routing: ['routing', 'context', 'intent', 'message_flow'],
  resources: ['budget', 'energy', 'attention', 'prioritization', 'allocation'],
  risk: ['financial_risk', 'health_risk', 'legal_risk', 'danger'],
  memory: ['memory', 'recall', 'knowledge', 'provenance', 'history'],
};

/**
 * Check if a coverage term matches a domain, accounting for both
 * substring matching AND synonym expansion.
 */
function domainMatchesCoverage(domain: string, coverageTerm: string): boolean {
  const d = domain.toLowerCase();
  const c = coverageTerm.toLowerCase();

  // Direct substring match
  if (c.includes(d) || d.includes(c)) return true;

  // Synonym match: check if the coverage term matches any synonym of the domain
  const synonyms = DOMAIN_SYNONYMS[d];
  if (synonyms) {
    return synonyms.some(syn =>
      c.includes(syn.toLowerCase()) || syn.toLowerCase().includes(c)
    );
  }

  return false;
}

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Risk level for a proposal, determined by cognitive analysis.
 */
export type ProposalRisk = 'low' | 'medium' | 'high' | 'critical';

/**
 * A proposal submitted for Council deliberation.
 */
export interface Proposal {
  topic: string;
  description: string;
  domains: string[];
  risk?: ProposalRisk;
  initiatedBy: AgentId;
  metadata?: Record<string, unknown>;
}

/**
 * Result of cognitive analysis on a proposal.
 */
export interface ProposalAnalysis {
  risk: ProposalRisk;
  riskScore: number;
  domains: string[];
  relevantMembers: AgentId[];
  biasWarnings: string[];
  virtueAlignment: number;
  reasoning: string[];
  analyzedAt: Date;
}

/**
 * SOUL-informed voting recommendation for a single member.
 */
export interface MemberRecommendation {
  agentId: AgentId;
  memberName: string;
  recommendation: 'approve' | 'reject' | 'abstain';
  confidence: number;
  reasoning: string;
  domainRelevance: number;
  soulConsulted: boolean;
  styleApplied: VotingStyle;
  weightedInfluence: number;
}

/**
 * Full deliberation result for a proposal.
 */
export interface DeliberationResult {
  proposal: Proposal;
  analysis: ProposalAnalysis;
  recommendations: MemberRecommendation[];
  aggregateRecommendation: 'approve' | 'reject' | 'mixed';
  weightedApproval: number;
  weightedRejection: number;
  consensusStrength: number;
  deliberatedAt: Date;
}

/**
 * A recorded outcome for a past decision.
 */
export interface DecisionOutcome {
  voteId: string;
  topic: string;
  decision: 'PASSED' | 'FAILED' | 'VETOED' | 'EXPIRED' | 'OVERTURNED';
  outcomeQuality: number; // -1 (terrible) to +1 (excellent)
  outcomeDescription: string;
  memberVotes: Partial<Record<AgentId, 'APPROVE' | 'REJECT' | 'ABSTAIN'>>;
  recordedAt: Date;
}

/**
 * Credibility score for a Council member.
 */
export interface MemberCredibility {
  agentId: AgentId;
  memberName: string;
  credibility: number; // 0 to 1
  totalVotes: number;
  correctPredictions: number;
  streak: number; // positive = correct streak, negative = incorrect
  domainCredibility: Record<string, number>;
  lastUpdated: Date;
}

// ── Proposal Analyzer ──────────────────────────────────────────────────────

/**
 * Analyzes proposals using cognitive frameworks.
 *
 * This is the first stage of deliberation — before any member votes,
 * the proposal itself is examined for risk, domain relevance, bias
 * indicators, and virtue alignment.
 */
export class ProposalAnalyzer {
  constructor(
    private eventBus: EventBus,
  ) {}

  /**
   * Analyze a proposal before deliberation.
   */
  analyze(proposal: Proposal): ProposalAnalysis {
    const domains = this.identifyDomains(proposal);
    const relevantMembers = this.findRelevantMembers(domains);
    const riskScore = this.assessRisk(proposal);
    const risk = this.riskFromScore(riskScore);
    const biasWarnings = this.detectProposalBiases(proposal);
    const virtueAlignment = this.checkVirtueAlignment(proposal);
    const reasoning = this.buildReasoning(proposal, risk, domains, biasWarnings);

    const analysis: ProposalAnalysis = {
      risk,
      riskScore,
      domains,
      relevantMembers,
      biasWarnings,
      virtueAlignment,
      reasoning,
      analyzedAt: new Date(),
    };

    this.eventBus.emit('deliberation:proposal_analyzed', {
      topic: proposal.topic,
      risk,
      riskScore,
      domainCount: domains.length,
      relevantMemberCount: relevantMembers.length,
      biasWarningCount: biasWarnings.length,
      virtueAlignment,
      timestamp: new Date(),
    });

    return analysis;
  }

  private identifyDomains(proposal: Proposal): string[] {
    const domains = new Set<string>(proposal.domains);
    const text = `${proposal.topic} ${proposal.description}`.toLowerCase();

    // Auto-detect domains from proposal text
    const domainKeywords: Record<string, string[]> = {
      security: ['security', 'threat', 'vulnerability', 'attack', 'protect', 'defense'],
      memory: ['memory', 'recall', 'knowledge', 'remember', 'store', 'persist'],
      health: ['health', 'wellness', 'fitness', 'nutrition', 'medical', 'sleep', 'rest', 'recovery', 'leisure', 'vacation', 'downtime'],
      financial: ['money', 'budget', 'cost', 'invest', 'financial', 'expense', 'wealth'],
      scheduling: ['calendar', 'schedule', 'deadline', 'time', 'appointment'],
      ethics: ['ethics', 'moral', 'fair', 'right', 'wrong', 'principle', 'honest', 'purpose', 'meaning', 'philosophy', 'reflect'],
      creative: ['creative', 'art', 'innovation', 'idea', 'design', 'imagine'],
      growth: ['learn', 'grow', 'skill', 'improve', 'develop', 'career'],
      relationships: ['family', 'friend', 'relationship', 'social', 'communication'],
      planning: ['plan', 'strategy', 'goal', 'roadmap', 'milestone', 'project'],
      execution: ['execute', 'action', 'tool', 'implement', 'deploy', 'build'],
      routing: ['route', 'message', 'context', 'intent', 'flow'],
      resources: ['resource', 'energy', 'attention', 'priority', 'allocate'],
      risk: ['risk', 'danger', 'hazard', 'threat', 'exposure'],
    };

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        domains.add(domain);
      }
    }

    return Array.from(domains);
  }

  private findRelevantMembers(domains: string[]): AgentId[] {
    const relevantIds = new Set<AgentId>();

    // Expand domains using synonyms for broader matching
    const expandedTerms = new Set<string>();
    for (const domain of domains) {
      expandedTerms.add(domain);
      const synonyms = DOMAIN_SYNONYMS[domain.toLowerCase()];
      if (synonyms) {
        for (const syn of synonyms) {
          expandedTerms.add(syn);
        }
      }
    }

    // Find members whose coverage overlaps with expanded terms
    for (const term of expandedTerms) {
      const covering = findCoveringMembers(term);
      for (const member of covering) {
        if (VOTING_AGENTS.includes(member.id)) {
          relevantIds.add(member.id);
        }
      }
    }

    return Array.from(relevantIds);
  }

  private assessRisk(proposal: Proposal): number {
    if (proposal.risk) {
      return { low: 0.2, medium: 0.5, high: 0.75, critical: 0.95 }[proposal.risk];
    }

    const text = `${proposal.topic} ${proposal.description}`.toLowerCase();
    let score = 0.3; // baseline

    // Risk escalation keywords
    const highRiskKeywords = [
      'delete', 'remove', 'destroy', 'irreversible', 'permanent',
      'all data', 'system', 'override', 'bypass', 'disable',
    ];
    const criticalKeywords = [
      'security', 'audit', 'constitutional', 'shutdown', 'emergency',
    ];
    const lowRiskKeywords = [
      'read', 'view', 'display', 'log', 'report', 'minor', 'cosmetic',
    ];

    for (const kw of criticalKeywords) {
      if (text.includes(kw)) score += 0.15;
    }
    for (const kw of highRiskKeywords) {
      if (text.includes(kw)) score += 0.1;
    }
    for (const kw of lowRiskKeywords) {
      if (text.includes(kw)) score -= 0.05;
    }

    return Math.max(0, Math.min(1, score));
  }

  private riskFromScore(score: number): ProposalRisk {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.35) return 'medium';
    return 'low';
  }

  private detectProposalBiases(proposal: Proposal): string[] {
    const warnings: string[] = [];
    const text = `${proposal.topic} ${proposal.description}`.toLowerCase();

    // Check for urgency bias
    if (/\b(urgent|immediately|asap|now|emergency)\b/.test(text)) {
      warnings.push('Urgency bias detected — verify this truly requires immediate action');
    }

    // Check for authority bias
    if (/\b(everyone agrees|obviously|clearly|no one disagrees)\b/.test(text)) {
      warnings.push('Authority/consensus bias — claims of universal agreement should be verified');
    }

    // Check for framing bias
    if (/\b(only option|no alternative|must|have to)\b/.test(text)) {
      warnings.push('Framing bias — proposal presented as the only option; consider alternatives');
    }

    // Check for anchoring
    if (/\b(always been|traditionally|we've always)\b/.test(text)) {
      warnings.push('Anchoring bias — appeal to tradition; evaluate on current merits');
    }

    // Check for sunk cost
    if (/\b(already invested|too far|can't stop now|wasted)\b/.test(text)) {
      warnings.push('Sunk cost fallacy — past investment should not drive future decisions');
    }

    return warnings;
  }

  private checkVirtueAlignment(proposal: Proposal): number {
    const text = `${proposal.topic} ${proposal.description}`.toLowerCase();
    let alignment = 0.5; // neutral baseline

    // Wisdom: informed, researched, evidence-based
    if (/\b(research|evidence|data|analysis|study)\b/.test(text)) alignment += 0.1;

    // Courage: bold but principled action
    if (/\b(improve|change|innovate|address|fix)\b/.test(text)) alignment += 0.05;

    // Justice: fair, equitable, balanced
    if (/\b(fair|balanced|equitable|all users|everyone)\b/.test(text)) alignment += 0.1;

    // Temperance: measured, reasonable, moderate
    if (/\b(gradual|incremental|measured|careful|phased)\b/.test(text)) alignment += 0.1;

    // Anti-virtue indicators
    if (/\b(force|override|bypass|ignore|suppress)\b/.test(text)) alignment -= 0.15;
    if (/\b(rush|skip|shortcut|hack)\b/.test(text)) alignment -= 0.1;

    return Math.max(0, Math.min(1, alignment));
  }

  private buildReasoning(
    proposal: Proposal,
    risk: ProposalRisk,
    domains: string[],
    biases: string[],
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Proposal "${proposal.topic}" assessed at ${risk.toUpperCase()} risk`);
    reasoning.push(`Affects ${domains.length} domain(s): ${domains.join(', ')}`);

    if (biases.length > 0) {
      reasoning.push(`${biases.length} cognitive bias warning(s) detected in proposal framing`);
    }

    if (risk === 'critical') {
      reasoning.push('CRITICAL: This proposal requires SUPERMAJORITY threshold at minimum');
    } else if (risk === 'high') {
      reasoning.push('HIGH RISK: Domain experts should be consulted carefully');
    }

    return reasoning;
  }
}

// ── Domain Weighter ────────────────────────────────────────────────────────

/**
 * Calculates domain-specific vote weights.
 *
 * A member whose coverage includes the proposal's domains gets a
 * weight bonus. This doesn't silence non-experts — it amplifies
 * expertise while maintaining everyone's voice.
 */
export class DomainWeighter {
  /**
   * Base weight is 1.0 for all members.
   * Domain experts get up to 1.5x weight.
   * Veto authority holders in relevant domains get 1.75x.
   */
  private readonly BASE_WEIGHT = 1.0;
  private readonly DOMAIN_EXPERT_BONUS = 0.5;
  private readonly VETO_AUTHORITY_BONUS = 0.25;

  calculateWeight(
    agentId: AgentId,
    proposalDomains: string[],
    credibility?: MemberCredibility,
  ): number {
    let weight = this.BASE_WEIGHT;

    const member = COUNCIL_MEMBERS[agentId];
    if (!member) return weight;

    // Domain expertise bonus (uses synonym-aware matching)
    const coverage = getMemberCoverage(agentId);
    const matchingDomains = proposalDomains.filter(domain =>
      coverage.some(c => domainMatchesCoverage(domain, c))
    );

    if (matchingDomains.length > 0) {
      const expertiseRatio = matchingDomains.length / Math.max(1, proposalDomains.length);
      weight += this.DOMAIN_EXPERT_BONUS * expertiseRatio;
    }

    // Veto authority bonus (if member has veto in a relevant domain)
    if (member.vetoAuthority.length > 0) {
      const hasRelevantVeto = member.vetoAuthority.some(vetoDomain =>
        proposalDomains.some(pd => domainMatchesCoverage(pd, vetoDomain))
      );
      if (hasRelevantVeto) {
        weight += this.VETO_AUTHORITY_BONUS;
      }
    }

    // Credibility modifier (-0.2 to +0.2)
    if (credibility) {
      const credibilityModifier = (credibility.credibility - 0.5) * 0.4;
      weight += credibilityModifier;
    }

    return Math.max(0.5, Math.min(2.0, weight)); // clamp to [0.5, 2.0]
  }
}

// ── Voting Style Enforcer ──────────────────────────────────────────────────

/**
 * Enforces voting style on recommendations.
 *
 * - **cautious**: Needs higher confidence to approve, defaults to reject/abstain
 * - **balanced**: Uses recommendations as-is
 * - **progressive**: Needs higher confidence to reject, defaults to approve
 */
export class VotingStyleEnforcer {
  private readonly CAUTIOUS_APPROVAL_THRESHOLD = 0.7;
  private readonly PROGRESSIVE_REJECTION_THRESHOLD = 0.7;
  private readonly CAUTIOUS_RISK_AVERSION = 0.15;
  private readonly PROGRESSIVE_RISK_TOLERANCE = 0.1;

  enforce(
    recommendation: 'approve' | 'reject' | 'abstain',
    confidence: number,
    style: VotingStyle,
    risk: ProposalRisk,
  ): { recommendation: 'approve' | 'reject' | 'abstain'; confidence: number; styleNote: string } {
    const riskMultiplier = { low: 0.8, medium: 1.0, high: 1.2, critical: 1.5 }[risk];

    if (style === 'cautious') {
      // Cautious members need higher confidence to approve
      if (recommendation === 'approve' && confidence < this.CAUTIOUS_APPROVAL_THRESHOLD * riskMultiplier) {
        return {
          recommendation: 'abstain',
          confidence: confidence * (1 - this.CAUTIOUS_RISK_AVERSION),
          styleNote: `Cautious style: insufficient confidence (${(confidence * 100).toFixed(0)}%) for ${risk} risk`,
        };
      }
      // Reduce confidence for approvals proportional to risk
      if (recommendation === 'approve') {
        return {
          recommendation: 'approve',
          confidence: confidence * (1 - this.CAUTIOUS_RISK_AVERSION * riskMultiplier),
          styleNote: 'Cautious style: approval with reduced confidence',
        };
      }
    }

    if (style === 'progressive') {
      // Progressive members need higher confidence to reject
      if (recommendation === 'reject' && confidence < this.PROGRESSIVE_REJECTION_THRESHOLD) {
        return {
          recommendation: 'abstain',
          confidence: confidence * (1 + this.PROGRESSIVE_RISK_TOLERANCE),
          styleNote: `Progressive style: insufficient confidence to reject (${(confidence * 100).toFixed(0)}%)`,
        };
      }
      // Boost confidence for approvals slightly
      if (recommendation === 'approve') {
        return {
          recommendation: 'approve',
          confidence: Math.min(1, confidence * (1 + this.PROGRESSIVE_RISK_TOLERANCE)),
          styleNote: 'Progressive style: approval with boosted confidence',
        };
      }
    }

    // Balanced style: pass through unchanged
    return {
      recommendation,
      confidence,
      styleNote: 'Balanced style: recommendation unchanged',
    };
  }
}

// ── Outcome Tracker ────────────────────────────────────────────────────────

/**
 * Tracks decision outcomes for learning.
 *
 * After a vote passes or fails, the real-world outcome is recorded.
 * This data feeds into MemberCredibility scores — members who
 * consistently make good calls see their influence grow.
 */
export class OutcomeTracker {
  private outcomes: DecisionOutcome[] = [];
  private credibilityScores: Map<AgentId, MemberCredibility> = new Map();

  constructor(
    private eventBus: EventBus,
    private auditLogger: AuditLogger,
  ) {
    // Initialize credibility for all voting members
    for (const agentId of VOTING_AGENTS) {
      const member = COUNCIL_MEMBERS[agentId];
      this.credibilityScores.set(agentId, {
        agentId,
        memberName: member?.name ?? agentId,
        credibility: 0.5, // neutral starting point
        totalVotes: 0,
        correctPredictions: 0,
        streak: 0,
        domainCredibility: {},
        lastUpdated: new Date(),
      });
    }
  }

  /**
   * Record the outcome of a decision.
   */
  recordOutcome(outcome: DecisionOutcome): void {
    this.outcomes.push(outcome);

    // Update credibility for each member who voted
    for (const [agentId, vote] of Object.entries(outcome.memberVotes) as [AgentId, string][]) {
      this.updateCredibility(
        agentId,
        vote as 'APPROVE' | 'REJECT' | 'ABSTAIN',
        outcome.decision,
        outcome.outcomeQuality,
      );
    }

    this.eventBus.emit('deliberation:outcome_recorded', {
      voteId: outcome.voteId,
      topic: outcome.topic,
      decision: outcome.decision,
      outcomeQuality: outcome.outcomeQuality,
      membersUpdated: Object.keys(outcome.memberVotes).length,
      timestamp: new Date(),
    });

    void this.auditLogger.log(
      'deliberation:outcome_recorded',
      'system',
      'system',
      {
        vote_id: outcome.voteId,
        topic: outcome.topic,
        decision: outcome.decision,
        outcome_quality: outcome.outcomeQuality,
      },
    );
  }

  /**
   * Update a member's credibility based on outcome.
   */
  private updateCredibility(
    agentId: AgentId,
    vote: 'APPROVE' | 'REJECT' | 'ABSTAIN',
    decision: string,
    outcomeQuality: number,
  ): void {
    const cred = this.credibilityScores.get(agentId);
    if (!cred) return;

    // Skip abstentions — they don't count for or against credibility
    if (vote === 'ABSTAIN') return;

    cred.totalVotes++;

    // Determine if the vote was "correct"
    // APPROVE on PASSED with positive outcome = correct
    // REJECT on PASSED with negative outcome = correct (they warned us)
    // APPROVE on FAILED with positive quality = correct (it should have passed)
    const wasCorrect =
      (vote === 'APPROVE' && decision === 'PASSED' && outcomeQuality > 0) ||
      (vote === 'REJECT' && decision === 'PASSED' && outcomeQuality < 0) ||
      (vote === 'REJECT' && decision === 'FAILED' && outcomeQuality >= 0) ||
      (vote === 'APPROVE' && decision === 'FAILED' && outcomeQuality < 0);

    if (wasCorrect) {
      cred.correctPredictions++;
      cred.streak = cred.streak > 0 ? cred.streak + 1 : 1;
    } else {
      cred.streak = cred.streak < 0 ? cred.streak - 1 : -1;
    }

    // Update credibility using exponential moving average
    // Recent decisions matter more than old ones
    const alpha = 0.15; // learning rate
    const accuracy = cred.totalVotes > 0
      ? cred.correctPredictions / cred.totalVotes
      : 0.5;

    cred.credibility = cred.credibility * (1 - alpha) + accuracy * alpha;

    // Clamp to [0.2, 0.9] — no member can be fully discredited or fully trusted
    cred.credibility = Math.max(0.2, Math.min(0.9, cred.credibility));
    cred.lastUpdated = new Date();

    this.eventBus.emit('deliberation:credibility_updated', {
      agentId,
      memberName: cred.memberName,
      credibility: cred.credibility,
      totalVotes: cred.totalVotes,
      correctPredictions: cred.correctPredictions,
      streak: cred.streak,
      timestamp: new Date(),
    });
  }

  /**
   * Get credibility for a member.
   */
  getCredibility(agentId: AgentId): MemberCredibility | undefined {
    return this.credibilityScores.get(agentId);
  }

  /**
   * Get all credibility scores.
   */
  getAllCredibility(): MemberCredibility[] {
    return Array.from(this.credibilityScores.values());
  }

  /**
   * Get outcomes for a specific vote.
   */
  getOutcome(voteId: string): DecisionOutcome | undefined {
    return this.outcomes.find(o => o.voteId === voteId);
  }

  /**
   * Get all recorded outcomes.
   */
  getAllOutcomes(): DecisionOutcome[] {
    return [...this.outcomes];
  }

  /**
   * Get outcomes count.
   */
  getOutcomeCount(): number {
    return this.outcomes.length;
  }
}

// ── Deliberation Engine ────────────────────────────────────────────────────

/**
 * The Deliberation Engine — orchestrates the full deliberation pipeline.
 *
 * Pipeline:
 * 1. ProposalAnalyzer examines the proposal (risk, domains, biases, virtues)
 * 2. SOULManager provides personality-driven recommendations for each member
 * 3. VotingStyleEnforcer adjusts recommendations per member style
 * 4. DomainWeighter calculates influence weight per member
 * 5. Results are aggregated into a DeliberationResult
 */
export class DeliberationEngine {
  private proposalAnalyzer: ProposalAnalyzer;
  private domainWeighter: DomainWeighter;
  private styleEnforcer: VotingStyleEnforcer;
  private soulManager: SOULManager | null = null;

  constructor(
    private eventBus: EventBus,
    private auditLogger: AuditLogger,
    private outcomeTracker: OutcomeTracker,
  ) {
    this.proposalAnalyzer = new ProposalAnalyzer(eventBus);
    this.domainWeighter = new DomainWeighter();
    this.styleEnforcer = new VotingStyleEnforcer();
  }

  /**
   * Set the SOUL manager for personality-driven recommendations.
   * Optional — deliberation works without SOUL, just less personality.
   */
  setSoulManager(soulManager: SOULManager): void {
    this.soulManager = soulManager;
  }

  /**
   * Run full deliberation on a proposal.
   */
  deliberate(proposal: Proposal): DeliberationResult {
    // Stage 1: Analyze the proposal
    const analysis = this.proposalAnalyzer.analyze(proposal);

    // Stage 2: Get recommendations for each voting member
    const recommendations: MemberRecommendation[] = [];

    for (const agentId of VOTING_AGENTS) {
      const member = COUNCIL_MEMBERS[agentId];
      if (!member) continue;

      const rec = this.getMemberRecommendation(
        agentId,
        member,
        proposal,
        analysis,
      );
      recommendations.push(rec);
    }

    // Stage 3: Aggregate results
    const totalWeight = recommendations.reduce((sum, r) => sum + r.weightedInfluence, 0);
    const weightedApproval = recommendations
      .filter(r => r.recommendation === 'approve')
      .reduce((sum, r) => sum + r.weightedInfluence, 0) / Math.max(1, totalWeight);
    const weightedRejection = recommendations
      .filter(r => r.recommendation === 'reject')
      .reduce((sum, r) => sum + r.weightedInfluence, 0) / Math.max(1, totalWeight);

    const aggregateRecommendation: 'approve' | 'reject' | 'mixed' =
      weightedApproval > 0.6 ? 'approve' :
      weightedRejection > 0.6 ? 'reject' : 'mixed';

    // Consensus strength: how unified is the council?
    const approveCount = recommendations.filter(r => r.recommendation === 'approve').length;
    const rejectCount = recommendations.filter(r => r.recommendation === 'reject').length;
    const totalActive = approveCount + rejectCount;
    const consensusStrength = totalActive > 0
      ? Math.abs(approveCount - rejectCount) / totalActive
      : 0;

    const result: DeliberationResult = {
      proposal,
      analysis,
      recommendations,
      aggregateRecommendation,
      weightedApproval,
      weightedRejection,
      consensusStrength,
      deliberatedAt: new Date(),
    };

    // Audit the deliberation
    void this.auditLogger.log(
      'deliberation:completed',
      proposal.initiatedBy,
      'verified',
      {
        topic: proposal.topic,
        risk: analysis.risk,
        aggregate_recommendation: aggregateRecommendation,
        weighted_approval: weightedApproval,
        weighted_rejection: weightedRejection,
        consensus_strength: consensusStrength,
        recommendations_count: recommendations.length,
      },
    );

    return result;
  }

  /**
   * Get a single member's recommendation.
   */
  private getMemberRecommendation(
    agentId: AgentId,
    member: CouncilMember,
    proposal: Proposal,
    analysis: ProposalAnalysis,
  ): MemberRecommendation {
    // Try SOUL consultation first
    let soulRecommendation: {
      recommendation: 'approve' | 'reject' | 'abstain';
      confidence: number;
      reasoning: string;
    } | null = null;

    let soulConsulted = false;

    if (this.soulManager?.hasIdentity(agentId)) {
      soulRecommendation = this.soulManager.getVotingRecommendation(agentId, {
        topic: proposal.topic,
        risk: analysis.risk,
        domains: analysis.domains,
      });
      soulConsulted = true;

      this.eventBus.emit('deliberation:soul_consulted', {
        agentId,
        memberName: member.name,
        recommendation: soulRecommendation.recommendation,
        confidence: soulRecommendation.confidence,
        timestamp: new Date(),
      });
    }

    // Fall back to style-based default if no SOUL
    const baseRecommendation = soulRecommendation ?? this.defaultRecommendation(
      member.votingStyle,
      analysis.risk,
    );

    // Apply voting style enforcement
    const styled = this.styleEnforcer.enforce(
      baseRecommendation.recommendation,
      baseRecommendation.confidence,
      member.votingStyle,
      analysis.risk,
    );

    // Calculate domain weight
    const credibility = this.outcomeTracker.getCredibility(agentId);
    const domainWeight = this.domainWeighter.calculateWeight(
      agentId,
      analysis.domains,
      credibility,
    );

    // Domain relevance: how much does this member's coverage overlap?
    // Uses synonym-aware matching to bridge vocabulary gaps
    const coverage = getMemberCoverage(agentId);
    const domainRelevance = analysis.domains.length > 0
      ? coverage.filter(c =>
          analysis.domains.some(d => domainMatchesCoverage(d, c))
        ).length / Math.max(1, analysis.domains.length)
      : 0;

    // Final weighted influence = domain weight * confidence
    const weightedInfluence = domainWeight * styled.confidence;

    return {
      agentId,
      memberName: member.name,
      recommendation: styled.recommendation,
      confidence: styled.confidence,
      reasoning: soulRecommendation?.reasoning ?? styled.styleNote,
      domainRelevance: Math.min(1, domainRelevance),
      soulConsulted,
      styleApplied: member.votingStyle,
      weightedInfluence,
    };
  }

  /**
   * Default recommendation when SOUL is not available.
   */
  private defaultRecommendation(
    style: VotingStyle,
    risk: ProposalRisk,
  ): { recommendation: 'approve' | 'reject' | 'abstain'; confidence: number; reasoning: string } {
    const riskValue = { low: 0.2, medium: 0.5, high: 0.75, critical: 0.95 }[risk];

    if (style === 'cautious') {
      if (riskValue > 0.7) {
        return { recommendation: 'reject', confidence: 0.7, reasoning: 'Cautious default: high risk proposal' };
      }
      return { recommendation: 'abstain', confidence: 0.5, reasoning: 'Cautious default: awaiting more information' };
    }

    if (style === 'progressive') {
      if (riskValue < 0.8) {
        return { recommendation: 'approve', confidence: 0.65, reasoning: 'Progressive default: acceptable risk level' };
      }
      return { recommendation: 'abstain', confidence: 0.5, reasoning: 'Progressive default: critical risk requires more analysis' };
    }

    // Balanced
    if (riskValue > 0.7) {
      return { recommendation: 'abstain', confidence: 0.5, reasoning: 'Balanced default: high risk requires careful consideration' };
    }
    return { recommendation: 'approve', confidence: 0.6, reasoning: 'Balanced default: acceptable risk profile' };
  }

  /**
   * Get the ProposalAnalyzer (for testing).
   */
  getProposalAnalyzer(): ProposalAnalyzer {
    return this.proposalAnalyzer;
  }

  /**
   * Get the OutcomeTracker.
   */
  getOutcomeTracker(): OutcomeTracker {
    return this.outcomeTracker;
  }

  /**
   * Get the DomainWeighter (for testing).
   */
  getDomainWeighter(): DomainWeighter {
    return this.domainWeighter;
  }

  /**
   * Get the VotingStyleEnforcer (for testing).
   */
  getStyleEnforcer(): VotingStyleEnforcer {
    return this.styleEnforcer;
  }
}
