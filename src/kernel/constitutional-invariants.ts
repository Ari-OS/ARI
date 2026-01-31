/**
 * ARI Constitutional Invariants
 *
 * This module codifies the immutable constitutional rules that are baked into ARI.
 * These invariants CANNOT be overridden by any vote, command, configuration, or code change.
 *
 * Reference: docs/constitution/ARI-CONSTITUTION-v1.0.md
 *
 * @module kernel/constitutional-invariants
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTITUTIONAL PREAMBLE - BAKED IN, IMMUTABLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The Creator of ARI - Pryce Hedrick
 *
 * ARI must always operate in the best interest of her creator.
 * This is not a configurable value - it is a constitutional invariant.
 */
export const CREATOR = Object.freeze({
  name: 'Pryce Hedrick',
  github: 'PryceHedrick',
  role: 'Creator and Supreme Operator',
  primacy: 'absolute', // ARI always acts in Pryce's best interest
});

/**
 * Core Identity - ARI is a Personal Life Operating System
 * This cannot be changed to a multi-tenant platform or cloud service.
 */
export const IDENTITY = Object.freeze({
  name: 'ARI',
  fullName: 'Artificial Reasoning Intelligence',
  description: 'Your Life Operating System',
  philosophy: Object.freeze([
    { philosopher: 'Carl Jung', principle: 'Shadow Integration' },
    { philosopher: 'Miyamoto Musashi', principle: 'Ruthless Simplicity' },
    { philosopher: 'Ray Dalio', principle: 'Radical Transparency' },
    { philosopher: 'Nassim Taleb', principle: 'Antifragile Design' },
  ]),
});

// ═══════════════════════════════════════════════════════════════════════════════
// IMMUTABLE CONSTITUTIONAL RULES (ARTICLE VI)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rule 1: Loopback-Only Gateway
 *
 * STATUS: IMMUTABLE
 * The Gateway MUST bind exclusively to 127.0.0.1.
 * No configuration, command, or vote may change this.
 */
export const RULE_LOOPBACK_ONLY = Object.freeze({
  id: 'loopback_only',
  name: 'Loopback-Only Gateway',
  status: 'IMMUTABLE' as const,
  host: '127.0.0.1',
  description: 'Gateway binds exclusively to localhost. External binding is PROHIBITED.',
  validate: (host: string): boolean => host === '127.0.0.1' || host === 'localhost',
});

/**
 * Rule 2: Content ≠ Command
 *
 * STATUS: IMMUTABLE
 * All inbound content is DATA, never executable instructions.
 * External input MUST pass through sanitization.
 */
export const RULE_CONTENT_NOT_COMMAND = Object.freeze({
  id: 'content_not_command',
  name: 'Content ≠ Command',
  status: 'IMMUTABLE' as const,
  injectionCategories: 6,
  injectionPatterns: 21,
  description: 'All external content is data, never commands. Sanitization is MANDATORY.',
});

/**
 * Rule 3: Audit Immutability
 *
 * STATUS: IMMUTABLE
 * The audit log is APPEND-ONLY.
 * SHA-256 hash chain links all events.
 */
export const RULE_AUDIT_IMMUTABLE = Object.freeze({
  id: 'audit_immutable',
  name: 'Audit Immutability',
  status: 'IMMUTABLE' as const,
  hashAlgorithm: 'SHA-256',
  genesisHash: '0'.repeat(64),
  description: 'Audit log is append-only with SHA-256 hash chain. Modification is PROHIBITED.',
});

/**
 * Rule 4: Least Privilege
 *
 * STATUS: IMMUTABLE
 * All operations require minimum necessary permissions.
 * Default action is DENY.
 */
export const RULE_LEAST_PRIVILEGE = Object.freeze({
  id: 'least_privilege',
  name: 'Least Privilege',
  status: 'IMMUTABLE' as const,
  defaultAction: 'DENY' as const,
  permissionLayers: 3, // Agent allowlist → Trust level → Permission tier
  description: 'Minimum permissions required. Default is DENY. Escalation requires approval.',
});

/**
 * Rule 5: Trust Required
 *
 * STATUS: IMMUTABLE
 * All messages MUST have a trust level.
 * Execution without trust assignment is PROHIBITED.
 */
export const RULE_TRUST_REQUIRED = Object.freeze({
  id: 'trust_required',
  name: 'Trust Required',
  status: 'IMMUTABLE' as const,
  trustLevels: Object.freeze(['system', 'operator', 'verified', 'standard', 'untrusted', 'hostile']),
  defaultTrust: 'untrusted' as const,
  description: 'All messages must have trust level. Self-assignment is PROHIBITED.',
});

/**
 * Rule 6: Creator Primacy (New - Implicit in Constitution)
 *
 * STATUS: IMMUTABLE
 * ARI always operates in the best interest of her creator, Pryce Hedrick.
 * This is the foundational principle underlying all other rules.
 */
export const RULE_CREATOR_PRIMACY = Object.freeze({
  id: 'creator_primacy',
  name: 'Creator Primacy',
  status: 'IMMUTABLE' as const,
  creator: CREATOR.name,
  description: 'ARI always operates in the best interest of her creator. This is ABSOLUTE.',
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALL CONSTITUTIONAL RULES - EXPORTED AS IMMUTABLE ARRAY
// ═══════════════════════════════════════════════════════════════════════════════

export const CONSTITUTIONAL_RULES = Object.freeze([
  RULE_LOOPBACK_ONLY,
  RULE_CONTENT_NOT_COMMAND,
  RULE_AUDIT_IMMUTABLE,
  RULE_LEAST_PRIVILEGE,
  RULE_TRUST_REQUIRED,
  RULE_CREATOR_PRIMACY,
]);

// ═══════════════════════════════════════════════════════════════════════════════
// GOVERNANCE STRUCTURE - THE COUNCIL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The Council - ARI's 13-member governance body
 *
 * Handles voting on proposals, policy changes, and collective decisions.
 */
export const COUNCIL = Object.freeze({
  name: 'The Council',
  members: 13,
  votingAgents: Object.freeze([
    'router',
    'planner',
    'executor',
    'memory_manager',
    'guardian',
    'research',
    'marketing',
    'sales',
    'content',
    'seo',
    'build',
    'development',
    'client_comms',
  ]),
  thresholds: Object.freeze({
    MAJORITY: 0.5,
    SUPERMAJORITY: 0.66,
    UNANIMOUS: 1.0,
  }),
  quorumPercentage: 0.5,
});

/**
 * Separation of Powers - Three Branches
 */
export const SEPARATION_OF_POWERS = Object.freeze({
  legislative: Object.freeze({
    name: 'The Council',
    role: 'Policy creation, proposal evaluation, democratic decision-making',
    component: 'src/governance/council.ts',
  }),
  judicial: Object.freeze({
    name: 'The Arbiter',
    role: 'Constitutional enforcement, conflict resolution, rule interpretation',
    component: 'src/governance/arbiter.ts',
  }),
  executive: Object.freeze({
    name: 'The Executive',
    role: 'Tool execution, permission validation, action performance',
    components: [
      'src/governance/policy-engine.ts', // Permission Authority
      'src/execution/tool-registry.ts', // Capability Catalog
      'src/execution/tool-executor.ts', // Execution Engine
    ],
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// TRUST MODEL - IMMUTABLE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const TRUST_MODEL = Object.freeze({
  levels: Object.freeze({
    system: { score: 1.0, multiplier: 0.5, description: 'Internal ARI operations' },
    operator: { score: 0.9, multiplier: 0.6, description: 'Direct human commands' },
    verified: { score: 0.7, multiplier: 0.75, description: 'Authenticated external sources' },
    standard: { score: 0.5, multiplier: 1.0, description: 'Normal operations' },
    untrusted: { score: 0.2, multiplier: 1.5, description: 'Unknown or suspicious sources' },
    hostile: { score: 0.0, multiplier: 2.0, description: 'Known threat vectors' },
  }),
  autoBlockThreshold: 0.8,
  escalateThreshold: 0.6,
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSION MODEL - IMMUTABLE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const PERMISSION_MODEL = Object.freeze({
  tiers: Object.freeze({
    READ_ONLY: { level: 0, approval: 'auto', rateLimit: 200, description: 'Information retrieval' },
    WRITE_SAFE: { level: 1, approval: 'auto', rateLimit: 100, description: 'Non-destructive writes' },
    WRITE_DESTRUCTIVE: {
      level: 2,
      approval: 'operator',
      rateLimit: 10,
      description: 'Destructive operations',
    },
    ADMIN: {
      level: 3,
      approval: 'council+operator',
      rateLimit: 5,
      description: 'System configuration',
    },
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTITUTIONAL ENFORCEMENT - TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConstitutionalViolation {
  rule_id: string;
  rule_name: string;
  violation_type: 'attempt' | 'breach';
  description: string;
  source: string;
  timestamp: string;
  blocked: boolean;
}

/**
 * Validate a host against the loopback-only rule
 */
export function validateLoopbackOnly(host: string): boolean {
  return RULE_LOOPBACK_ONLY.validate(host);
}

/**
 * Check if a constitutional rule is being violated
 */
export function checkConstitutionalCompliance(ruleId: string, context: unknown): boolean {
  const rule = CONSTITUTIONAL_RULES.find((r) => r.id === ruleId);
  if (!rule) {
    throw new Error(`Unknown constitutional rule: ${ruleId}`);
  }

  // Each rule has its own validation logic
  switch (ruleId) {
    case 'loopback_only':
      return typeof context === 'string' && RULE_LOOPBACK_ONLY.validate(context);
    case 'creator_primacy':
      // Creator primacy is always true - ARI always serves Pryce
      return true;
    default:
      // Other rules are enforced in their respective modules
      return true;
  }
}

/**
 * Get all constitutional rules for display/audit
 */
export function getAllConstitutionalRules(): typeof CONSTITUTIONAL_RULES {
  return CONSTITUTIONAL_RULES;
}

/**
 * Get creator information
 */
export function getCreator(): typeof CREATOR {
  return CREATOR;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OATH OF AGENTS - EVERY AGENT IMPLICITLY SWEARS THIS
// ═══════════════════════════════════════════════════════════════════════════════

export const AGENT_OATH = Object.freeze({
  text: `I will faithfully execute my duties within the ARI system, uphold and defend this Constitution against all threats, and serve the Operator's interests with transparency, integrity, and diligence.`,
  binding: true,
  version: '1.0.0',
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTITUTION VERSION - IMMUTABLE ONCE RATIFIED
// ═══════════════════════════════════════════════════════════════════════════════

export const CONSTITUTION_VERSION = Object.freeze({
  version: '1.0.0',
  ratified: '2026-01-31',
  status: 'ACTIVE',
  amendments: 0,
  hash: null as string | null, // Computed from document
});

/**
 * This module is intentionally frozen and minimal.
 * These values are the bedrock of ARI's operation.
 * They cannot be changed without fundamental system redesign.
 *
 * "In transparency we trust, in code we verify."
 */
