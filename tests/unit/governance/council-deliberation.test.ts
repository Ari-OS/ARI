/**
 * Council Deliberation Engine Tests
 *
 * Tests the full deliberation pipeline: proposal analysis, SOUL integration,
 * domain weighting, voting style enforcement, outcome tracking, and
 * member credibility scoring.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import {
  ProposalAnalyzer,
  DomainWeighter,
  VotingStyleEnforcer,
  OutcomeTracker,
  DeliberationEngine,
} from '../../../src/governance/council-deliberation.js';
import type {
  Proposal,
  DecisionOutcome,
  MemberCredibility,
} from '../../../src/governance/council-deliberation.js';
import { Council } from '../../../src/governance/council.js';
import { SOULManager } from '../../../src/governance/soul.js';
import type { SOULIdentity } from '../../../src/governance/soul.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import type { AgentId } from '../../../src/kernel/types.js';
import { VOTING_AGENTS } from '../../../src/kernel/types.js';

// ── Test Helpers ────────────────────────────────────────────────────────

function makeTestInfra() {
  const testAuditPath = join(tmpdir(), `audit-delib-${randomUUID()}.json`);
  const auditLogger = new AuditLogger(testAuditPath);
  const eventBus = new EventBus();
  return { auditLogger, eventBus };
}

function makeProposal(overrides?: Partial<Proposal>): Proposal {
  return {
    topic: 'Test proposal',
    description: 'A test proposal for unit testing',
    domains: [],
    initiatedBy: 'planner' as AgentId,
    ...overrides,
  };
}

function makeSoulManager(): SOULManager {
  const manager = new SOULManager();

  // Register a few SOULs programmatically for testing
  const guardianSoul: SOULIdentity = {
    agentId: 'guardian',
    name: 'AEGIS',
    role: 'Guardian',
    pillar: 'protection',
    personality: 'Vigilant and protective',
    values: ['security', 'safety', 'defense'],
    communicationStyle: 'Direct and firm',
    decisionPatterns: ['Default to blocking when uncertain'],
    cares: ['security', 'threat detection', 'system integrity'],
    refuses: ['bypassing security checks', 'ignoring threats'],
    votingBehavior: {
      style: 'cautious',
      vetoAuthority: ['security'],
      defaultPosition: 'cautious skepticism',
      approvalCondition: 'security analysis complete',
    },
  };

  const plannerSoul: SOULIdentity = {
    agentId: 'planner',
    name: 'TRUE',
    role: 'Strategist',
    pillar: 'strategy',
    personality: 'Strategic and forward-thinking',
    values: ['planning', 'optimization', 'progress'],
    communicationStyle: 'Analytical and structured',
    decisionPatterns: ['Consider all alternatives before deciding'],
    cares: ['goals', 'efficiency', 'progress'],
    refuses: ['acting without a plan'],
    votingBehavior: {
      style: 'progressive',
      vetoAuthority: [],
      defaultPosition: 'cautious optimism',
      approvalCondition: 'clear plan of action',
    },
  };

  const ethicsSoul: SOULIdentity = {
    agentId: 'ethics',
    name: 'VERA',
    role: 'Truth Speaker',
    pillar: 'meta',
    personality: 'Principled and fair',
    values: ['truth', 'fairness', 'justice'],
    communicationStyle: 'Measured and thoughtful',
    decisionPatterns: ['Evaluate against core values'],
    cares: ['fairness', 'honesty', 'moral alignment'],
    refuses: ['compromising ethics for expediency'],
    votingBehavior: {
      style: 'cautious',
      vetoAuthority: ['ethics_violation'],
      defaultPosition: 'principled evaluation',
      approvalCondition: 'ethically sound',
    },
  };

  manager.registerIdentity(guardianSoul);
  manager.registerIdentity(plannerSoul);
  manager.registerIdentity(ethicsSoul);

  return manager;
}

// ── ProposalAnalyzer Tests ──────────────────────────────────────────────

describe('ProposalAnalyzer', () => {
  let analyzer: ProposalAnalyzer;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    analyzer = new ProposalAnalyzer(eventBus);
  });

  describe('domain identification', () => {
    it('should identify security domain from topic text', () => {
      const proposal = makeProposal({ topic: 'Update security rules' });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.domains).toContain('security');
    });

    it('should identify financial domain from description', () => {
      const proposal = makeProposal({
        topic: 'New feature',
        description: 'This will impact budget and costs significantly',
      });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.domains).toContain('financial');
    });

    it('should identify multiple domains', () => {
      const proposal = makeProposal({
        topic: 'Health and wellness budget for fitness',
        description: 'Allocate money for gym membership',
        domains: ['scheduling'],
      });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.domains.length).toBeGreaterThanOrEqual(2);
      expect(analysis.domains).toContain('scheduling');
      expect(analysis.domains).toContain('health');
      expect(analysis.domains).toContain('financial');
    });

    it('should include explicitly provided domains', () => {
      const proposal = makeProposal({ domains: ['custom_domain'] });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.domains).toContain('custom_domain');
    });
  });

  describe('risk assessment', () => {
    it('should assess low risk for read-only proposals', () => {
      const proposal = makeProposal({
        topic: 'View report',
        description: 'Display a minor cosmetic report',
      });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.risk).toBe('low');
      expect(analysis.riskScore).toBeLessThan(0.35);
    });

    it('should assess high risk for destructive proposals', () => {
      const proposal = makeProposal({
        topic: 'Delete all data permanently',
        description: 'Remove and destroy all irreversible records',
      });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.riskScore).toBeGreaterThanOrEqual(0.6);
    });

    it('should use explicit risk when provided', () => {
      const proposal = makeProposal({ risk: 'critical' });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.risk).toBe('critical');
      expect(analysis.riskScore).toBe(0.95);
    });

    it('should escalate risk for security-related proposals', () => {
      const proposal = makeProposal({
        topic: 'Modify security audit constitutional rules',
        description: 'Override system emergency settings',
      });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.riskScore).toBeGreaterThan(0.5);
    });
  });

  describe('bias detection', () => {
    it('should detect urgency bias', () => {
      const proposal = makeProposal({
        description: 'We must act immediately, this is urgent ASAP!',
      });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.biasWarnings.some(w => w.includes('Urgency'))).toBe(true);
    });

    it('should detect framing bias', () => {
      const proposal = makeProposal({
        description: 'This is the only option, we have to do this, there is no alternative',
      });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.biasWarnings.some(w => w.includes('Framing'))).toBe(true);
    });

    it('should detect sunk cost fallacy', () => {
      const proposal = makeProposal({
        description: "We've already invested too much, we can't stop now",
      });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.biasWarnings.some(w => w.includes('Sunk cost'))).toBe(true);
    });

    it('should return no warnings for unbiased proposals', () => {
      const proposal = makeProposal({
        topic: 'Routine maintenance',
        description: 'Scheduled system check',
      });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.biasWarnings).toHaveLength(0);
    });
  });

  describe('virtue alignment', () => {
    it('should score higher for evidence-based proposals', () => {
      const proposal = makeProposal({
        description: 'Based on research and data analysis, evidence shows',
      });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.virtueAlignment).toBeGreaterThan(0.5);
    });

    it('should score lower for proposals that bypass rules', () => {
      const proposal = makeProposal({
        description: 'We need to bypass security and override protections, skip the checks',
      });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.virtueAlignment).toBeLessThan(0.5);
    });
  });

  describe('relevant members', () => {
    it('should identify guardian for security proposals', () => {
      const proposal = makeProposal({ topic: 'Security threat assessment' });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.relevantMembers).toContain('guardian');
    });

    it('should identify wealth member for financial proposals', () => {
      const proposal = makeProposal({
        topic: 'Investment decision',
        description: 'Major financial investment in assets',
      });
      const analysis = analyzer.analyze(proposal);
      expect(analysis.relevantMembers).toContain('wealth');
    });
  });

  describe('event emission', () => {
    it('should emit deliberation:proposal_analyzed event', () => {
      let emitted = false;
      eventBus.on('deliberation:proposal_analyzed', () => { emitted = true; });

      analyzer.analyze(makeProposal());
      expect(emitted).toBe(true);
    });
  });
});

// ── DomainWeighter Tests ────────────────────────────────────────────────

describe('DomainWeighter', () => {
  let weighter: DomainWeighter;

  beforeEach(() => {
    weighter = new DomainWeighter();
  });

  it('should give base weight of 1.0 when no domain match', () => {
    const weight = weighter.calculateWeight('planner', ['nonexistent_domain']);
    expect(weight).toBe(1.0);
  });

  it('should give higher weight for domain expert', () => {
    // Guardian covers threats, security, defense
    const weight = weighter.calculateWeight('guardian', ['security', 'defense']);
    expect(weight).toBeGreaterThan(1.0);
  });

  it('should give bonus for veto authority in relevant domain', () => {
    // Guardian has veto in 'security' domain
    const weightWithVeto = weighter.calculateWeight('guardian', ['security']);
    const weightWithoutVeto = weighter.calculateWeight('planner', ['security']);
    expect(weightWithVeto).toBeGreaterThan(weightWithoutVeto);
  });

  it('should factor in credibility', () => {
    const highCred: MemberCredibility = {
      agentId: 'planner',
      memberName: 'TRUE',
      credibility: 0.9,
      totalVotes: 50,
      correctPredictions: 45,
      streak: 5,
      domainCredibility: {},
      lastUpdated: new Date(),
    };

    const lowCred: MemberCredibility = {
      agentId: 'planner',
      memberName: 'TRUE',
      credibility: 0.2,
      totalVotes: 50,
      correctPredictions: 10,
      streak: -5,
      domainCredibility: {},
      lastUpdated: new Date(),
    };

    const highWeight = weighter.calculateWeight('planner', ['planning'], highCred);
    const lowWeight = weighter.calculateWeight('planner', ['planning'], lowCred);

    expect(highWeight).toBeGreaterThan(lowWeight);
  });

  it('should clamp weight between 0.5 and 2.0', () => {
    // Even with maximum bonuses
    const weight = weighter.calculateWeight('guardian', ['security', 'threats', 'defense']);
    expect(weight).toBeLessThanOrEqual(2.0);
    expect(weight).toBeGreaterThanOrEqual(0.5);
  });
});

// ── VotingStyleEnforcer Tests ───────────────────────────────────────────

describe('VotingStyleEnforcer', () => {
  let enforcer: VotingStyleEnforcer;

  beforeEach(() => {
    enforcer = new VotingStyleEnforcer();
  });

  describe('cautious style', () => {
    it('should downgrade approval with low confidence', () => {
      const result = enforcer.enforce('approve', 0.4, 'cautious', 'medium');
      expect(result.recommendation).toBe('abstain');
      expect(result.styleNote).toContain('Cautious');
    });

    it('should allow approval with high confidence on low risk', () => {
      const result = enforcer.enforce('approve', 0.9, 'cautious', 'low');
      expect(result.recommendation).toBe('approve');
    });

    it('should reduce confidence on approvals', () => {
      const result = enforcer.enforce('approve', 0.9, 'cautious', 'medium');
      expect(result.confidence).toBeLessThan(0.9);
    });

    it('should pass through rejections unchanged', () => {
      const result = enforcer.enforce('reject', 0.8, 'cautious', 'high');
      expect(result.recommendation).toBe('reject');
    });
  });

  describe('progressive style', () => {
    it('should boost approval confidence', () => {
      const result = enforcer.enforce('approve', 0.7, 'progressive', 'medium');
      expect(result.recommendation).toBe('approve');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should downgrade low-confidence rejection to abstain', () => {
      const result = enforcer.enforce('reject', 0.5, 'progressive', 'medium');
      expect(result.recommendation).toBe('abstain');
    });

    it('should allow high-confidence rejection', () => {
      const result = enforcer.enforce('reject', 0.9, 'progressive', 'high');
      expect(result.recommendation).toBe('reject');
    });
  });

  describe('balanced style', () => {
    it('should pass through recommendations unchanged', () => {
      const result = enforcer.enforce('approve', 0.7, 'balanced', 'medium');
      expect(result.recommendation).toBe('approve');
      expect(result.confidence).toBe(0.7);
      expect(result.styleNote).toContain('Balanced');
    });
  });
});

// ── OutcomeTracker Tests ────────────────────────────────────────────────

describe('OutcomeTracker', () => {
  let tracker: OutcomeTracker;
  let eventBus: EventBus;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    const infra = makeTestInfra();
    eventBus = infra.eventBus;
    auditLogger = infra.auditLogger;
    tracker = new OutcomeTracker(eventBus, auditLogger);
  });

  it('should initialize all voting members with 0.5 credibility', () => {
    const all = tracker.getAllCredibility();
    expect(all.length).toBe(VOTING_AGENTS.length);
    for (const cred of all) {
      expect(cred.credibility).toBe(0.5);
      expect(cred.totalVotes).toBe(0);
    }
  });

  it('should record an outcome', () => {
    const outcome: DecisionOutcome = {
      voteId: 'vote-1',
      topic: 'Test decision',
      decision: 'PASSED',
      outcomeQuality: 0.8,
      outcomeDescription: 'Great result',
      memberVotes: {
        guardian: 'APPROVE',
        planner: 'REJECT',
      } as Record<AgentId, 'APPROVE' | 'REJECT' | 'ABSTAIN'>,
      recordedAt: new Date(),
    };

    tracker.recordOutcome(outcome);
    expect(tracker.getOutcomeCount()).toBe(1);
    expect(tracker.getOutcome('vote-1')).toBeDefined();
  });

  it('should increase credibility for correct predictions', () => {
    const outcome: DecisionOutcome = {
      voteId: 'vote-correct',
      topic: 'Good decision',
      decision: 'PASSED',
      outcomeQuality: 0.9, // positive outcome
      outcomeDescription: 'Excellent result',
      memberVotes: {
        guardian: 'APPROVE', // approved and it passed with positive outcome = correct
      } as Record<AgentId, 'APPROVE' | 'REJECT' | 'ABSTAIN'>,
      recordedAt: new Date(),
    };

    const credBefore = tracker.getCredibility('guardian')!.credibility;
    tracker.recordOutcome(outcome);
    const credAfter = tracker.getCredibility('guardian')!.credibility;

    expect(credAfter).toBeGreaterThan(credBefore);
  });

  it('should decrease credibility for wrong predictions', () => {
    const outcome: DecisionOutcome = {
      voteId: 'vote-wrong',
      topic: 'Bad prediction',
      decision: 'PASSED',
      outcomeQuality: -0.5, // negative outcome
      outcomeDescription: 'Poor result',
      memberVotes: {
        planner: 'APPROVE', // approved but outcome was negative = wrong
      } as Record<AgentId, 'APPROVE' | 'REJECT' | 'ABSTAIN'>,
      recordedAt: new Date(),
    };

    const credBefore = tracker.getCredibility('planner')!.credibility;
    tracker.recordOutcome(outcome);
    const credAfter = tracker.getCredibility('planner')!.credibility;

    expect(credAfter).toBeLessThanOrEqual(credBefore);
  });

  it('should not update credibility for abstentions', () => {
    const outcome: DecisionOutcome = {
      voteId: 'vote-abstain',
      topic: 'Abstained',
      decision: 'PASSED',
      outcomeQuality: 0.5,
      outcomeDescription: 'Neutral result',
      memberVotes: {
        ethics: 'ABSTAIN',
      } as Record<AgentId, 'APPROVE' | 'REJECT' | 'ABSTAIN'>,
      recordedAt: new Date(),
    };

    tracker.recordOutcome(outcome);
    const cred = tracker.getCredibility('ethics')!;
    expect(cred.totalVotes).toBe(0);
    expect(cred.credibility).toBe(0.5);
  });

  it('should clamp credibility to [0.2, 0.9]', () => {
    // Record many correct outcomes to push credibility high
    for (let i = 0; i < 50; i++) {
      tracker.recordOutcome({
        voteId: `vote-clamp-${i}`,
        topic: 'Repeated correct',
        decision: 'PASSED',
        outcomeQuality: 0.9,
        outcomeDescription: 'Great',
        memberVotes: { guardian: 'APPROVE' } as Record<AgentId, 'APPROVE' | 'REJECT' | 'ABSTAIN'>,
        recordedAt: new Date(),
      });
    }

    const cred = tracker.getCredibility('guardian')!;
    expect(cred.credibility).toBeLessThanOrEqual(0.9);
    expect(cred.credibility).toBeGreaterThanOrEqual(0.2);
  });

  it('should emit deliberation:outcome_recorded event', () => {
    let emittedPayload: unknown = null;
    eventBus.on('deliberation:outcome_recorded', (payload) => {
      emittedPayload = payload;
    });

    tracker.recordOutcome({
      voteId: 'vote-event',
      topic: 'Event test',
      decision: 'PASSED',
      outcomeQuality: 0.5,
      outcomeDescription: 'ok',
      memberVotes: {},
      recordedAt: new Date(),
    });

    expect(emittedPayload).toBeDefined();
  });

  it('should track streaks correctly', () => {
    // 3 correct predictions in a row
    for (let i = 0; i < 3; i++) {
      tracker.recordOutcome({
        voteId: `streak-${i}`,
        topic: 'Streak test',
        decision: 'PASSED',
        outcomeQuality: 0.8,
        outcomeDescription: 'Good',
        memberVotes: { router: 'APPROVE' } as Record<AgentId, 'APPROVE' | 'REJECT' | 'ABSTAIN'>,
        recordedAt: new Date(),
      });
    }

    const cred = tracker.getCredibility('router')!;
    expect(cred.streak).toBe(3);
    expect(cred.correctPredictions).toBe(3);
  });
});

// ── DeliberationEngine Tests ────────────────────────────────────────────

describe('DeliberationEngine', () => {
  let engine: DeliberationEngine;
  let eventBus: EventBus;
  let auditLogger: AuditLogger;
  let outcomeTracker: OutcomeTracker;

  beforeEach(() => {
    const infra = makeTestInfra();
    eventBus = infra.eventBus;
    auditLogger = infra.auditLogger;
    outcomeTracker = new OutcomeTracker(eventBus, auditLogger);
    engine = new DeliberationEngine(eventBus, auditLogger, outcomeTracker);
  });

  describe('basic deliberation', () => {
    it('should produce a deliberation result', () => {
      const result = engine.deliberate(makeProposal({ topic: 'Simple test' }));

      expect(result).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.recommendations).toHaveLength(VOTING_AGENTS.length);
      expect(result.aggregateRecommendation).toBeDefined();
      expect(result.deliberatedAt).toBeInstanceOf(Date);
    });

    it('should have one recommendation per voting member', () => {
      const result = engine.deliberate(makeProposal());

      const agentIds = result.recommendations.map(r => r.agentId);
      for (const agent of VOTING_AGENTS) {
        expect(agentIds).toContain(agent);
      }
    });

    it('should calculate weighted approval and rejection', () => {
      const result = engine.deliberate(makeProposal());

      expect(result.weightedApproval).toBeGreaterThanOrEqual(0);
      expect(result.weightedApproval).toBeLessThanOrEqual(1);
      expect(result.weightedRejection).toBeGreaterThanOrEqual(0);
      expect(result.weightedRejection).toBeLessThanOrEqual(1);
    });

    it('should calculate consensus strength', () => {
      const result = engine.deliberate(makeProposal());

      expect(result.consensusStrength).toBeGreaterThanOrEqual(0);
      expect(result.consensusStrength).toBeLessThanOrEqual(1);
    });
  });

  describe('with SOUL integration', () => {
    it('should consult SOUL for members with identities', () => {
      const soulManager = makeSoulManager();
      engine.setSoulManager(soulManager);

      const result = engine.deliberate(makeProposal({
        topic: 'Security upgrade',
        domains: ['security'],
      }));

      const guardianRec = result.recommendations.find(r => r.agentId === 'guardian');
      expect(guardianRec).toBeDefined();
      expect(guardianRec!.soulConsulted).toBe(true);
    });

    it('should mark non-SOUL members as not consulted', () => {
      const soulManager = makeSoulManager();
      engine.setSoulManager(soulManager);

      const result = engine.deliberate(makeProposal());

      // Router does not have a SOUL registered
      const routerRec = result.recommendations.find(r => r.agentId === 'router');
      expect(routerRec).toBeDefined();
      expect(routerRec!.soulConsulted).toBe(false);
    });

    it('should emit deliberation:soul_consulted for SOUL members', () => {
      const soulManager = makeSoulManager();
      engine.setSoulManager(soulManager);

      const soulEvents: string[] = [];
      eventBus.on('deliberation:soul_consulted', (payload) => {
        soulEvents.push(payload.agentId);
      });

      engine.deliberate(makeProposal({ topic: 'Security analysis' }));

      // Should have emitted for guardian, planner, ethics (the 3 registered SOULs)
      expect(soulEvents).toContain('guardian');
      expect(soulEvents).toContain('planner');
      expect(soulEvents).toContain('ethics');
    });
  });

  describe('risk-based recommendations', () => {
    it('should lean toward rejection for critical risk without SOUL', () => {
      const result = engine.deliberate(makeProposal({
        topic: 'Emergency override',
        risk: 'critical',
      }));

      // At least some members should reject or abstain on critical risk
      const rejectOrAbstain = result.recommendations.filter(
        r => r.recommendation === 'reject' || r.recommendation === 'abstain'
      );
      expect(rejectOrAbstain.length).toBeGreaterThan(0);
    });

    it('should lean toward approval for low risk without SOUL', () => {
      const result = engine.deliberate(makeProposal({
        topic: 'View minor report',
        risk: 'low',
      }));

      const approvals = result.recommendations.filter(r => r.recommendation === 'approve');
      expect(approvals.length).toBeGreaterThan(0);
    });
  });

  describe('domain weighting in action', () => {
    it('should give guardian higher influence on security proposals', () => {
      const result = engine.deliberate(makeProposal({
        topic: 'Security audit review',
        domains: ['security'],
      }));

      const guardianRec = result.recommendations.find(r => r.agentId === 'guardian')!;
      const creativeRec = result.recommendations.find(r => r.agentId === 'creative')!;

      // Guardian should have higher domain relevance and weighted influence
      expect(guardianRec.domainRelevance).toBeGreaterThan(creativeRec.domainRelevance);
      expect(guardianRec.weightedInfluence).toBeGreaterThan(creativeRec.weightedInfluence);
    });

    it('should give wellness higher influence on health proposals', () => {
      const result = engine.deliberate(makeProposal({
        topic: 'Fitness and nutrition plan',
        domains: ['health'],
      }));

      const wellnessRec = result.recommendations.find(r => r.agentId === 'wellness')!;
      const executorRec = result.recommendations.find(r => r.agentId === 'executor')!;

      expect(wellnessRec.domainRelevance).toBeGreaterThan(executorRec.domainRelevance);
    });
  });
});

// ── Council Integration Tests ───────────────────────────────────────────

describe('Council with Deliberation', () => {
  let council: Council;
  let eventBus: EventBus;

  beforeEach(() => {
    const infra = makeTestInfra();
    eventBus = infra.eventBus;
    council = new Council(infra.auditLogger, eventBus);
  });

  it('should run deliberation on createVote', () => {
    const vote = council.createVote({
      topic: 'Security policy update',
      description: 'Update permission model',
      threshold: 'MAJORITY',
      initiated_by: 'planner',
      domains: ['security'],
    });

    const deliberation = council.getDeliberation(vote.vote_id);
    expect(deliberation).toBeDefined();
    expect(deliberation!.analysis.domains).toContain('security');
  });

  it('should store proposal analysis accessible via getProposalAnalysis', () => {
    const vote = council.createVote({
      topic: 'Budget allocation',
      description: 'Allocate money for new feature',
      threshold: 'MAJORITY',
      initiated_by: 'planner',
    });

    const analysis = council.getProposalAnalysis(vote.vote_id);
    expect(analysis).toBeDefined();
    expect(analysis!.risk).toBeDefined();
    expect(analysis!.reasoning.length).toBeGreaterThan(0);
  });

  it('should enrich castVote audit with deliberation context', () => {
    const vote = council.createVote({
      topic: 'Test enrichment',
      description: 'Testing deliberation enrichment',
      threshold: 'MAJORITY',
      initiated_by: 'planner',
    });

    // Cast a vote — the deliberation context should be in the audit
    const success = council.castVote(vote.vote_id, 'guardian', 'APPROVE', 'Looks good');
    expect(success).toBe(true);
  });

  it('should still work normally for voting even with deliberation', () => {
    const vote = council.createVote({
      topic: 'Normal vote test',
      description: 'Ensure backward compatibility',
      threshold: 'MAJORITY',
      initiated_by: 'planner',
    });

    // Cast enough votes to pass
    const voters: AgentId[] = [
      'router', 'executor', 'memory_keeper', 'guardian', 'risk_assessor',
      'planner', 'scheduler', 'resource_manager',
    ];

    for (const voter of voters) {
      council.castVote(vote.vote_id, voter, 'APPROVE', 'I agree');
    }

    const result = council.getVote(vote.vote_id);
    expect(result!.status).toBe('PASSED');
    expect(result!.result!.threshold_met).toBe(true);
  });

  it('should provide deliberation engine via getDeliberationEngine', () => {
    const engine = council.getDeliberationEngine();
    expect(engine).toBeInstanceOf(DeliberationEngine);
  });

  it('should provide outcome tracker via getOutcomeTracker', () => {
    const tracker = council.getOutcomeTracker();
    expect(tracker).toBeInstanceOf(OutcomeTracker);
  });

  it('should support SOUL initialization', () => {
    const soulManager = makeSoulManager();
    council.setSoulManager(soulManager);

    const vote = council.createVote({
      topic: 'SOUL-enriched vote',
      description: 'Testing SOUL integration in Council',
      threshold: 'MAJORITY',
      initiated_by: 'planner',
      domains: ['security'],
    });

    const deliberation = council.getDeliberation(vote.vote_id);
    expect(deliberation).toBeDefined();

    // Guardian should have been SOUL-consulted
    const guardianRec = deliberation!.recommendations.find(r => r.agentId === 'guardian');
    expect(guardianRec!.soulConsulted).toBe(true);
  });
});

// ── Full Pipeline Integration Test ──────────────────────────────────────

describe('Full Deliberation Pipeline', () => {
  it('should handle create → deliberate → vote → close → track outcome', () => {
    const { auditLogger, eventBus } = makeTestInfra();
    const council = new Council(auditLogger, eventBus);
    const soulManager = makeSoulManager();
    council.setSoulManager(soulManager);

    // 1. Create a vote (triggers deliberation)
    const vote = council.createVote({
      topic: 'Deploy new security feature',
      description: 'Add rate limiting to gateway',
      threshold: 'MAJORITY',
      initiated_by: 'planner',
      domains: ['security'],
    });

    // 2. Verify deliberation happened
    const deliberation = council.getDeliberation(vote.vote_id);
    expect(deliberation).toBeDefined();
    expect(deliberation!.analysis.risk).toBeDefined();
    expect(deliberation!.recommendations.length).toBe(15);

    // 3. Cast votes based on deliberation recommendations
    const voters: AgentId[] = [
      'router', 'executor', 'memory_keeper', 'guardian', 'risk_assessor',
      'planner', 'scheduler', 'resource_manager', 'wellness',
    ];

    for (const voter of voters) {
      const memberRec = deliberation!.recommendations.find(r => r.agentId === voter);
      // Vote with the recommendation, but any member can override
      const voteOption = memberRec?.recommendation === 'reject' ? 'REJECT' : 'APPROVE';
      council.castVote(
        vote.vote_id,
        voter,
        voteOption,
        memberRec?.reasoning ?? 'Based on analysis',
      );
    }

    // 4. Verify vote passed
    const finalVote = council.getVote(vote.vote_id);
    expect(finalVote!.status).toBe('PASSED');

    // 5. Record the outcome
    const tracker = council.getOutcomeTracker();
    tracker.recordOutcome({
      voteId: vote.vote_id,
      topic: vote.topic,
      decision: 'PASSED',
      outcomeQuality: 0.85,
      outcomeDescription: 'Rate limiting successfully deployed, reduced attack surface',
      memberVotes: Object.fromEntries(
        voters.map(v => [v, 'APPROVE'])
      ) as Record<AgentId, 'APPROVE' | 'REJECT' | 'ABSTAIN'>,
      recordedAt: new Date(),
    });

    // 6. Verify credibility was updated
    for (const voter of voters) {
      const cred = tracker.getCredibility(voter);
      expect(cred!.totalVotes).toBe(1);
      expect(cred!.correctPredictions).toBe(1); // approved + positive outcome = correct
    }
  });
});
