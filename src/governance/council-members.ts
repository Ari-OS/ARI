/**
 * Council Members — The 15 Named Advisors
 *
 * Constitutional Ratification: 2026-02-01
 * Vote Result: UNANIMOUS (15/15)
 * Amendment Threshold: UNANIMOUS + 34-day process + Operator approval
 *
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                        YOUR 15 ADVISORS                                       ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  🧭 ATLAS    guides you         📚 ECHO     remembers all                    ║
 * ║  ⚡ BOLT     gets it done        🛡️ AEGIS    shields you                      ║
 * ║  📊 SCOUT    spots the risks     🎯 TRUE     finds the way                   ║
 * ║  ⏰ TEMPO    keeps the beat      💎 OPAL     guards value                    ║
 * ║  💚 PULSE    tends your health   🤝 EMBER    warms your bonds                ║
 * ║  ✨ PRISM    sparks ideas        💰 MINT     minds the money                 ║
 * ║  🌱 BLOOM    grows with you      ⚖️ VERA     speaks truth                    ║
 * ║  🔗 NEXUS    ties it together                                                ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import type { AgentId, VetoDomain, CouncilPillar } from '../kernel/types.js';

/**
 * Voting style determines how an agent approaches decisions.
 * - cautious: Tends toward risk aversion, careful consideration
 * - balanced: Weighs pros and cons evenly
 * - progressive: Tends toward innovation, taking calculated risks
 */
export type VotingStyle = 'cautious' | 'balanced' | 'progressive';

/**
 * A Council member's full definition.
 */
export interface CouncilMember {
  /** Agent identifier (used in code) */
  id: AgentId;
  /** Human-readable name (the ratified name) */
  name: string;
  /** Role title */
  title: string;
  /** Which pillar this member belongs to */
  pillar: CouncilPillar;
  /** Emoji avatar for visual identification */
  avatar: string;
  /** How this member approaches voting */
  votingStyle: VotingStyle;
  /** Domains where this member can exercise veto (if any) */
  vetoAuthority: VetoDomain[];
  /** Human life domains this member covers */
  coverage: string[];
  /** Brief description of the member's role */
  description: string;
}

/**
 * The 15 Council Members — Ratified 2026-02-01
 *
 * Design Principles:
 * 1. Function = Name — See it, know it instantly
 * 2. Icon + Name = Instant Recognition
 * 3. Short & Sharp — All names are 4-6 characters
 * 4. Unique Silhouettes — No two names start with the same letter
 * 5. Timeless References — Mythology, Latin, universal concepts
 */
export const COUNCIL_MEMBERS: Record<AgentId, CouncilMember> = {
  // ══════════════════════════════════════════════════════════════════════════════
  // 🏗️ PILLAR 1: INFRASTRUCTURE — "The Foundation"
  // ══════════════════════════════════════════════════════════════════════════════

  router: {
    id: 'router',
    name: 'ATLAS',
    title: 'Navigator',
    pillar: 'infrastructure',
    avatar: '🧭',
    votingStyle: 'balanced',
    vetoAuthority: [],
    coverage: ['routing', 'context', 'intent', 'message_flow'],
    description: 'Guides messages, finds the path. The world-holder who carries your world.',
  },

  executor: {
    id: 'executor',
    name: 'BOLT',
    title: 'Executor',
    pillar: 'infrastructure',
    avatar: '⚡',
    votingStyle: 'progressive',
    vetoAuthority: [],
    coverage: ['execution', 'tools', 'delivery', 'action'],
    description: 'Executes actions, lightning fast. Swift and decisive action.',
  },

  memory_keeper: {
    id: 'memory_keeper',
    name: 'ECHO',
    title: 'Archivist',
    pillar: 'infrastructure',
    avatar: '📚',
    votingStyle: 'cautious',
    vetoAuthority: ['memory'],
    coverage: ['memory', 'recall', 'knowledge', 'provenance', 'history'],
    description: 'Remembers everything, echoes back. Memories resonate through time.',
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // 🛡️ PILLAR 2: PROTECTION — "The Shield"
  // ══════════════════════════════════════════════════════════════════════════════

  guardian: {
    id: 'guardian',
    name: 'AEGIS',
    title: 'Guardian',
    pillar: 'protection',
    avatar: '🛡️',
    votingStyle: 'cautious',
    vetoAuthority: ['security'],
    coverage: ['threats', 'injection', 'anomalies', 'safety', 'defense'],
    description: 'Shields from threats, the protector. Divine protection like the shield of Zeus.',
  },

  risk_assessor: {
    id: 'risk_assessor',
    name: 'SCOUT',
    title: 'Risk Scout',
    pillar: 'protection',
    avatar: '📊',
    votingStyle: 'cautious',
    vetoAuthority: ['high_risk'],
    coverage: ['financial_risk', 'health_risk', 'legal_risk', 'opportunity_cost', 'danger'],
    description: 'Scouts ahead, spots dangers. Sees danger before it arrives.',
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // 📋 PILLAR 3: STRATEGY — "The Compass"
  // ══════════════════════════════════════════════════════════════════════════════

  planner: {
    id: 'planner',
    name: 'TRUE',
    title: 'Strategist',
    pillar: 'strategy',
    avatar: '🎯',
    votingStyle: 'progressive',
    vetoAuthority: [],
    coverage: ['goals', 'decomposition', 'dependencies', 'projects', 'planning'],
    description: 'Finds true north, charts the course. True north never lies.',
  },

  scheduler: {
    id: 'scheduler',
    name: 'TEMPO',
    title: 'Timekeeper',
    pillar: 'strategy',
    avatar: '⏰',
    votingStyle: 'balanced',
    vetoAuthority: ['time_conflict'],
    coverage: ['calendar', 'deadlines', 'scheduling', 'work_life_balance', 'rhythm'],
    description: 'Keeps the beat, guards your time. The rhythm of your life.',
  },

  resource_manager: {
    id: 'resource_manager',
    name: 'OPAL',
    title: 'Resource Guardian',
    pillar: 'strategy',
    avatar: '💎',
    votingStyle: 'balanced',
    vetoAuthority: ['resource_depletion'],
    coverage: ['budget', 'energy', 'attention', 'prioritization', 'allocation'],
    description: 'Protects the precious, guards resources. Precious and iridescent.',
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // 🌍 PILLAR 4: LIFE DOMAINS — "The Heart"
  // ══════════════════════════════════════════════════════════════════════════════

  wellness: {
    id: 'wellness',
    name: 'PULSE',
    title: 'Health Guardian',
    pillar: 'domains',
    avatar: '💚',
    votingStyle: 'balanced',
    vetoAuthority: ['health_harm'],
    coverage: ['physical_health', 'mental_health', 'fitness', 'nutrition', 'medical', 'sleep', 'rest', 'recovery', 'leisure', 'downtime', 'vacation'],
    description: 'Monitors your pulse, guards health. Your pulse is my purpose.',
  },

  relationships: {
    id: 'relationships',
    name: 'EMBER',
    title: 'Connection Keeper',
    pillar: 'domains',
    avatar: '🤝',
    votingStyle: 'balanced',
    vetoAuthority: [],
    coverage: ['family', 'friends', 'romance', 'professional', 'communication', 'social'],
    description: 'Keeps connections warm and glowing. Warmth that sustains connection.',
  },

  creative: {
    id: 'creative',
    name: 'PRISM',
    title: 'Creative Spark',
    pillar: 'domains',
    avatar: '✨',
    votingStyle: 'progressive',
    vetoAuthority: [],
    coverage: ['art', 'ideas', 'innovation', 'hobbies', 'side_projects', 'imagination'],
    description: 'Splits light into possibilities. Creates infinite colors from light.',
  },

  wealth: {
    id: 'wealth',
    name: 'MINT',
    title: 'Wealth Guardian',
    pillar: 'domains',
    avatar: '💰',
    votingStyle: 'balanced',
    vetoAuthority: ['major_financial'],
    coverage: ['income', 'expenses', 'investments', 'taxes', 'legal', 'contracts', 'assets'],
    description: 'Where value is made and kept. Source and guardian of wealth.',
  },

  growth: {
    id: 'growth',
    name: 'BLOOM',
    title: 'Growth Guide',
    pillar: 'domains',
    avatar: '🌱',
    votingStyle: 'progressive',
    vetoAuthority: [],
    coverage: ['learning', 'skills', 'career', 'self_improvement', 'habits', 'development'],
    description: 'Helps you flourish and grow. From seed to flower.',
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // ⚖️ PILLAR 5: META — "The Balance"
  // ══════════════════════════════════════════════════════════════════════════════

  ethics: {
    id: 'ethics',
    name: 'VERA',
    title: 'Truth Speaker',
    pillar: 'meta',
    avatar: '⚖️',
    votingStyle: 'cautious',
    vetoAuthority: ['ethics_violation'],
    coverage: ['morals', 'fairness', 'consequences', 'values', 'principles', 'honesty', 'purpose', 'meaning', 'philosophy', 'reflection'],
    description: 'Speaks truth, ensures fairness. Vera means truth in Latin.',
  },

  integrator: {
    id: 'integrator',
    name: 'NEXUS',
    title: 'Integrator',
    pillar: 'meta',
    avatar: '🔗',
    votingStyle: 'balanced',
    vetoAuthority: [], // Special: tie-breaker authority instead
    coverage: ['synthesis', 'conflicts', 'tradeoffs', 'integration', 'holistic_view'],
    description: 'Connects everything, breaks ties. Where all threads meet.',
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // System Agents (non-voting, for completeness)
  // ══════════════════════════════════════════════════════════════════════════════

  core: {
    id: 'core',
    name: 'CORE',
    title: 'Orchestrator',
    pillar: 'infrastructure',
    avatar: '◉',
    votingStyle: 'balanced',
    vetoAuthority: [],
    coverage: ['orchestration', 'coordination'],
    description: 'Master orchestrator. Non-voting system agent.',
  },

  arbiter: {
    id: 'arbiter',
    name: 'ARBITER',
    title: 'Constitutional Judge',
    pillar: 'meta',
    avatar: '⚔️',
    votingStyle: 'cautious',
    vetoAuthority: [],
    coverage: ['constitution', 'rules', 'compliance'],
    description: 'Enforces constitutional rules. Non-voting system agent.',
  },

  overseer: {
    id: 'overseer',
    name: 'OVERSEER',
    title: 'Quality Gate',
    pillar: 'meta',
    avatar: '👁️',
    votingStyle: 'cautious',
    vetoAuthority: [],
    coverage: ['quality', 'validation', 'gates'],
    description: 'Validates quality gates. Non-voting system agent.',
  },

  autonomous: {
    id: 'autonomous',
    name: 'AUTO',
    title: 'Autonomous Runner',
    pillar: 'infrastructure',
    avatar: '🤖',
    votingStyle: 'balanced',
    vetoAuthority: [],
    coverage: ['scheduling', 'background_tasks'],
    description: 'Runs autonomous operations. Non-voting system agent.',
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get a Council member by their agent ID.
 */
export function getMember(agentId: AgentId): CouncilMember | undefined {
  return COUNCIL_MEMBERS[agentId];
}

/**
 * Get a Council member by their name (e.g., "ATLAS", "BOLT").
 */
export function getMemberByName(name: string): CouncilMember | undefined {
  return Object.values(COUNCIL_MEMBERS).find(
    m => m.name.toUpperCase() === name.toUpperCase()
  );
}

/**
 * Get all Council members who have veto authority.
 */
export function getVetoHolders(): CouncilMember[] {
  return Object.values(COUNCIL_MEMBERS).filter(
    m => m.vetoAuthority.length > 0
  );
}

/**
 * Check if an agent can veto in a specific domain.
 */
export function canVeto(agentId: AgentId, domain: VetoDomain): boolean {
  const member = COUNCIL_MEMBERS[agentId];
  return member?.vetoAuthority.includes(domain) ?? false;
}

/**
 * Get all Council members in a specific pillar.
 */
export function getMembersByPillar(pillar: CouncilPillar): CouncilMember[] {
  return Object.values(COUNCIL_MEMBERS).filter(m => m.pillar === pillar);
}

/**
 * Get all Council members with a specific voting style.
 */
export function getMembersByVotingStyle(style: VotingStyle): CouncilMember[] {
  return Object.values(COUNCIL_MEMBERS).filter(m => m.votingStyle === style);
}

/**
 * Get the voting balance of the Council.
 * Returns counts of cautious, balanced, and progressive members.
 */
export function getVotingBalance(): Record<VotingStyle, number> {
  const votingMembers = Object.values(COUNCIL_MEMBERS).filter(
    m => !['core', 'arbiter', 'overseer', 'autonomous'].includes(m.id)
  );

  return {
    cautious: votingMembers.filter(m => m.votingStyle === 'cautious').length,
    balanced: votingMembers.filter(m => m.votingStyle === 'balanced').length,
    progressive: votingMembers.filter(m => m.votingStyle === 'progressive').length,
  };
}

/**
 * Get the member who holds veto authority for a domain.
 */
export function getVetoHolder(domain: VetoDomain): CouncilMember | undefined {
  return Object.values(COUNCIL_MEMBERS).find(
    m => m.vetoAuthority.includes(domain)
  );
}

/**
 * Get all domains a member covers.
 */
export function getMemberCoverage(agentId: AgentId): string[] {
  return COUNCIL_MEMBERS[agentId]?.coverage ?? [];
}

/**
 * Find which member(s) cover a specific domain.
 */
export function findCoveringMembers(domain: string): CouncilMember[] {
  const normalizedDomain = domain.toLowerCase();
  return Object.values(COUNCIL_MEMBERS).filter(
    m => m.coverage.some(c => c.toLowerCase().includes(normalizedDomain))
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Display Constants
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Pillar display information for UI.
 */
export const PILLAR_DISPLAY: Record<CouncilPillar, { icon: string; name: string; description: string }> = {
  infrastructure: {
    icon: '🏗️',
    name: 'Infrastructure',
    description: 'The Foundation — Core system operations',
  },
  protection: {
    icon: '🛡️',
    name: 'Protection',
    description: 'The Shield — Security and risk management',
  },
  strategy: {
    icon: '📋',
    name: 'Strategy',
    description: 'The Compass — Planning and resource allocation',
  },
  domains: {
    icon: '🌍',
    name: 'Life Domains',
    description: 'The Heart — Health, relationships, creativity, wealth, growth',
  },
  meta: {
    icon: '⚖️',
    name: 'Meta',
    description: 'The Balance — Ethics and integration',
  },
};

/**
 * Quick reference for Council member names and avatars.
 */
export const COUNCIL_QUICK_REF = Object.values(COUNCIL_MEMBERS)
  .filter(m => !['core', 'arbiter', 'overseer', 'autonomous'].includes(m.id))
  .map(m => ({
    id: m.id,
    name: m.name,
    avatar: m.avatar,
    pillar: m.pillar,
  }));
