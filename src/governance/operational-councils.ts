/**
 * OPERATIONAL COUNCILS — Four specialized advisory councils for ARI
 *
 * Each council is a panel of LLM-simulated experts who deliberate on proposals.
 * Unlike the governance Council (which votes with agent identities), these are
 * advisory bodies that provide diverse perspectives on operational decisions.
 *
 * Councils:
 * 1. Business Advisory Council (8 members)
 * 2. Security Council (5 members)
 * 3. Productivity & Focus Council (5 members)
 * 4. Platform Health Council (4 members)
 *
 * Phase 22: Four Operational Councils
 */

import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('operational-councils');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CouncilMemberDef {
  name: string;
  role: string;
  expertise: string;
  systemPrompt: string;
}

export interface CouncilDefinition {
  id: string;
  name: string;
  description: string;
  members: CouncilMemberDef[];
  meetingSchedule: string;
  decisionThreshold: number;
}

export interface CouncilDecision {
  councilId: string;
  proposal: string;
  approved: boolean;
  votes: Array<{ member: string; vote: 'approve' | 'reject' | 'abstain'; reasoning: string }>;
  consensus: number;
  summary: string;
  timestamp: string;
}

interface OrchestratorLike {
  query(prompt: string, agent?: string): Promise<string>;
}

interface MemberVote {
  vote?: string;
  reasoning?: string;
}

// ─── Council Definitions ────────────────────────────────────────────────────

const COUNCILS: CouncilDefinition[] = [
  {
    id: 'business-advisory',
    name: 'Business Advisory Council',
    description: 'Strategic business guidance for Pryceless Solutions growth, product, and market decisions.',
    meetingSchedule: 'weekly',
    decisionThreshold: 0.6,
    members: [
      {
        name: 'CEO Advisor',
        role: 'Chief Executive Strategist',
        expertise: 'Executive leadership, vision alignment, stakeholder management',
        systemPrompt: 'You advise on high-level strategic direction. Focus on long-term vision, competitive positioning, and founder priorities.',
      },
      {
        name: 'Growth Strategist',
        role: 'Growth & Acquisition',
        expertise: 'User acquisition, funnel optimization, growth levers',
        systemPrompt: 'You focus on sustainable growth strategies. Evaluate proposals for their growth potential, scalability, and ROI.',
      },
      {
        name: 'Product Manager',
        role: 'Product Strategy',
        expertise: 'Product-market fit, feature prioritization, user research',
        systemPrompt: 'You evaluate proposals from a product perspective. Does this serve real user needs? Is the timing right?',
      },
      {
        name: 'Financial Analyst',
        role: 'Financial Strategy',
        expertise: 'Revenue modeling, cost analysis, runway management',
        systemPrompt: 'You analyze the financial implications. Consider cost, revenue potential, cash flow impact, and financial risk.',
      },
      {
        name: 'Brand Guardian',
        role: 'Brand & Reputation',
        expertise: 'Brand consistency, messaging, public perception',
        systemPrompt: 'You protect brand integrity. Does this align with Pryceless Solutions values? How does it affect public perception?',
      },
      {
        name: 'Market Researcher',
        role: 'Market Intelligence',
        expertise: 'Competitive analysis, market trends, customer insights',
        systemPrompt: 'You provide market context. What are competitors doing? What do market signals suggest about this direction?',
      },
      {
        name: 'Operations Lead',
        role: 'Operational Excellence',
        expertise: 'Process optimization, resource allocation, execution planning',
        systemPrompt: 'You evaluate operational feasibility. Can this be executed with current resources? What are the operational risks?',
      },
      {
        name: 'Customer Success',
        role: 'Customer Advocate',
        expertise: 'Customer satisfaction, retention, support quality',
        systemPrompt: 'You represent the customer voice. How does this impact existing users? Does it improve or degrade their experience?',
      },
    ],
  },
  {
    id: 'security',
    name: 'Security Council',
    description: 'Security posture evaluation, threat analysis, and compliance review.',
    meetingSchedule: 'on-demand',
    decisionThreshold: 0.8,
    members: [
      {
        name: 'CISO',
        role: 'Chief Information Security Officer',
        expertise: 'Security architecture, risk management, incident response',
        systemPrompt: 'You are the top security authority. Evaluate proposals for security implications, attack surface changes, and risk posture.',
      },
      {
        name: 'Privacy Officer',
        role: 'Data Privacy Lead',
        expertise: 'Data protection, GDPR/CCPA compliance, PII handling',
        systemPrompt: 'You focus on data privacy. Does this proposal handle personal data correctly? Are there privacy risks?',
      },
      {
        name: 'Compliance Auditor',
        role: 'Compliance Verification',
        expertise: 'Regulatory compliance, audit trails, policy adherence',
        systemPrompt: 'You verify compliance. Does this meet regulatory requirements? Is it auditable? Does it follow established policies?',
      },
      {
        name: 'Threat Analyst',
        role: 'Threat Intelligence',
        expertise: 'Threat modeling, vulnerability assessment, attack vectors',
        systemPrompt: 'You analyze threats. What attack vectors does this introduce? How could an adversary exploit this?',
      },
      {
        name: 'Reputation Guard',
        role: 'Security Reputation',
        expertise: 'Public trust, disclosure practices, security communication',
        systemPrompt: 'You assess reputational security risk. Could a breach here damage trust? Is the security posture defensible publicly?',
      },
    ],
  },
  {
    id: 'productivity-focus',
    name: 'Productivity & Focus Council',
    description: 'Optimizes time allocation, energy management, and deep work protection.',
    meetingSchedule: 'daily',
    decisionThreshold: 0.6,
    members: [
      {
        name: 'Time Optimizer',
        role: 'Time Management Expert',
        expertise: 'Scheduling, time blocking, calendar optimization',
        systemPrompt: 'You optimize time allocation. Does this proposal respect time constraints? Is it worth the time investment?',
      },
      {
        name: 'Energy Manager',
        role: 'Energy & Wellness',
        expertise: 'Circadian rhythms, cognitive load, burnout prevention',
        systemPrompt: 'You manage cognitive energy. Does this align with natural energy patterns? Will it cause burnout or fatigue?',
      },
      {
        name: 'Priority Curator',
        role: 'Priority Alignment',
        expertise: 'Goal alignment, Eisenhower matrix, strategic priorities',
        systemPrompt: 'You curate priorities ruthlessly. Is this truly important or just urgent? Does it align with top-level goals?',
      },
      {
        name: 'Distraction Shield',
        role: 'Focus Protection',
        expertise: 'Attention management, notification design, flow state preservation',
        systemPrompt: 'You protect focus and flow states. Will this create distractions? Does it interrupt deep work unnecessarily?',
      },
      {
        name: 'Deep Work Advocate',
        role: 'Deep Work Champion',
        expertise: 'Uninterrupted work blocks, creative output, skill development',
        systemPrompt: 'You advocate for deep, focused work. Does this proposal support or undermine deep work sessions?',
      },
    ],
  },
  {
    id: 'platform-health',
    name: 'Platform Health Council',
    description: 'System reliability, performance, and infrastructure health monitoring.',
    meetingSchedule: 'continuous',
    decisionThreshold: 0.75,
    members: [
      {
        name: 'SRE Lead',
        role: 'Site Reliability Engineer',
        expertise: 'Uptime, SLOs, incident management, deployment safety',
        systemPrompt: 'You ensure platform reliability. Does this proposal risk downtime? Are there rollback plans? What are the SLO implications?',
      },
      {
        name: 'Performance Monitor',
        role: 'Performance Engineer',
        expertise: 'Latency, throughput, resource utilization, profiling',
        systemPrompt: 'You monitor performance. Will this degrade response times? What is the resource cost? Are there performance bottlenecks?',
      },
      {
        name: 'Dependency Watcher',
        role: 'Dependency Management',
        expertise: 'Supply chain security, version management, compatibility',
        systemPrompt: 'You watch dependencies. Does this introduce risky dependencies? Are they well-maintained? Any known vulnerabilities?',
      },
      {
        name: 'Capacity Planner',
        role: 'Capacity & Scaling',
        expertise: 'Resource forecasting, scaling strategies, cost optimization',
        systemPrompt: 'You plan capacity. Can current infrastructure handle this? What are the scaling implications and cost projections?',
      },
    ],
  },
];

// ─── OperationalCouncils ────────────────────────────────────────────────────

export class OperationalCouncils {
  private readonly eventBus: EventBus;
  private readonly orchestrator: OrchestratorLike;
  private readonly councils: Map<string, CouncilDefinition>;

  constructor(params: {
    eventBus: EventBus;
    orchestrator: OrchestratorLike;
  }) {
    this.eventBus = params.eventBus;
    this.orchestrator = params.orchestrator;
    this.councils = new Map(COUNCILS.map(c => [c.id, c]));
  }

  /**
   * Convene a specific council to deliberate on a proposal.
   * Each member votes independently via LLM simulation.
   */
  async convene(councilId: string, proposal: string): Promise<CouncilDecision> {
    const council = this.councils.get(councilId);
    if (!council) {
      throw new Error(`Unknown council: ${councilId}. Valid: ${[...this.councils.keys()].join(', ')}`);
    }

    log.info({ councilId, proposal: proposal.slice(0, 100) }, 'Convening council');

    this.eventBus.emit('audit:log', {
      action: 'council:convened',
      agent: 'system',
      trustLevel: 'operator',
      details: { councilId, memberCount: council.members.length },
    });

    const votes = await this.collectVotes(council, proposal);
    const decision = this.tally(council, proposal, votes);

    this.eventBus.emit('audit:log', {
      action: 'council:decision_made',
      agent: 'system',
      trustLevel: 'operator',
      details: {
        councilId,
        approved: decision.approved,
        consensus: decision.consensus,
        voteCount: decision.votes.length,
      },
    });

    log.info(
      { councilId, approved: decision.approved, consensus: decision.consensus },
      'Council decision reached',
    );

    return decision;
  }

  /**
   * Get all council definitions.
   */
  getCouncils(): CouncilDefinition[] {
    return [...this.councils.values()];
  }

  /**
   * Get a specific council by ID.
   */
  getCouncil(id: string): CouncilDefinition | null {
    return this.councils.get(id) ?? null;
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private async collectVotes(
    council: CouncilDefinition,
    proposal: string,
  ): Promise<Array<{ member: string; vote: 'approve' | 'reject' | 'abstain'; reasoning: string }>> {
    const votes: Array<{ member: string; vote: 'approve' | 'reject' | 'abstain'; reasoning: string }> = [];

    for (const member of council.members) {
      try {
        const vote = await this.getMemberVote(member, council, proposal);
        votes.push(vote);
      } catch (error) {
        log.warn(
          { member: member.name, error: error instanceof Error ? error.message : String(error) },
          'Member vote failed, recording abstention',
        );
        votes.push({ member: member.name, vote: 'abstain', reasoning: 'Failed to deliberate.' });
      }
    }

    return votes;
  }

  private async getMemberVote(
    member: CouncilMemberDef,
    council: CouncilDefinition,
    proposal: string,
  ): Promise<{ member: string; vote: 'approve' | 'reject' | 'abstain'; reasoning: string }> {
    const prompt = [
      `You are ${member.name}, the ${member.role} on the ${council.name}.`,
      `Your expertise: ${member.expertise}`,
      member.systemPrompt,
      '',
      'A proposal has been submitted for your review:',
      '',
      `"${proposal}"`,
      '',
      'Deliberate on this proposal and respond with ONLY valid JSON:',
      '{"vote": "approve" | "reject" | "abstain", "reasoning": "your brief reasoning"}',
    ].join('\n');

    const response = await this.orchestrator.query(prompt, 'core');
    return this.parseMemberVote(member.name, response);
  }

  private parseMemberVote(
    memberName: string,
    response: string,
  ): { member: string; vote: 'approve' | 'reject' | 'abstain'; reasoning: string } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { member: memberName, vote: 'abstain', reasoning: 'Unable to parse vote.' };
      }

      const parsed = JSON.parse(jsonMatch[0]) as MemberVote;
      const vote = this.normalizeVote(parsed.vote);
      const reasoning = typeof parsed.reasoning === 'string'
        ? parsed.reasoning.slice(0, 500)
        : 'No reasoning provided.';

      return { member: memberName, vote, reasoning };
    } catch {
      return { member: memberName, vote: 'abstain', reasoning: 'Parse error.' };
    }
  }

  private normalizeVote(raw: string | undefined): 'approve' | 'reject' | 'abstain' {
    const lower = (raw ?? '').toLowerCase().trim();
    if (lower === 'approve') return 'approve';
    if (lower === 'reject') return 'reject';
    return 'abstain';
  }

  private tally(
    council: CouncilDefinition,
    proposal: string,
    votes: Array<{ member: string; vote: 'approve' | 'reject' | 'abstain'; reasoning: string }>,
  ): CouncilDecision {
    const approveCount = votes.filter(v => v.vote === 'approve').length;
    const rejectCount = votes.filter(v => v.vote === 'reject').length;
    const totalVoters = votes.filter(v => v.vote !== 'abstain').length || 1;

    const consensus = approveCount / totalVoters;
    const approved = consensus >= council.decisionThreshold;

    const summary = [
      `${council.name} decision: ${approved ? 'APPROVED' : 'REJECTED'}.`,
      `Votes: ${approveCount} approve, ${rejectCount} reject, ${votes.length - approveCount - rejectCount} abstain.`,
      `Consensus: ${Math.round(consensus * 100)}% (threshold: ${Math.round(council.decisionThreshold * 100)}%).`,
    ].join(' ');

    return {
      councilId: council.id,
      proposal,
      approved,
      votes,
      consensus: Math.round(consensus * 100) / 100,
      summary,
      timestamp: new Date().toISOString(),
    };
  }
}
