/**
 * Decision Thresholds — Configurable approval requirements for governance categories.
 *
 * Each category of autonomous action requires a different level of council approval.
 * Some categories require specific members to approve (e.g., Guardian for security).
 * Some categories require Pryce's explicit approval before execution.
 *
 * @see src/governance/council.ts — Council voting mechanics
 * @see src/governance/council-members.ts — Council member definitions
 */

export interface DecisionThreshold {
  /** Category identifier for this decision type */
  category: string;
  /** Human-readable description of what this threshold governs */
  description: string;
  /** Required approval rate from 0 to 1 (e.g., 0.6 = 60% of voting members) */
  requiredApproval: number;
  /** Member IDs that MUST approve for the decision to pass (in addition to rate) */
  requiredMembers?: string[];
  /** Whether Pryce must explicitly approve this action */
  requiresPryceApproval: boolean;
  /** How long to wait for votes before escalation (milliseconds) */
  timeoutMs: number;
  /** What to do if the vote times out without resolution */
  escalationPath?: string;
}

export interface ThresholdResult {
  /** Whether the threshold is met */
  met: boolean;
  /** The category that was evaluated */
  category: string;
  /** Approval rate achieved */
  approvalRate: number;
  /** Required approval rate */
  requiredApproval: number;
  /** Whether all required members approved */
  requiredMembersMet: boolean;
  /** Which required members are missing (if any) */
  missingMembers: string[];
  /** Whether Pryce's approval is needed and whether it was given */
  pryceApprovalNeeded: boolean;
}

/**
 * All decision threshold categories known to ARI's governance system.
 */
export const DECISION_THRESHOLDS: DecisionThreshold[] = [
  {
    category: 'publish_content',
    description: 'Publish content without manual approval',
    requiredApproval: 0.6,
    requiredMembers: ['guardian'],
    requiresPryceApproval: false,
    timeoutMs: 300_000,
    escalationPath: 'defer_to_pryce',
  },
  {
    category: 'budget_increase',
    description: 'Budget exceeding $10/month',
    requiredApproval: 0.5,
    requiresPryceApproval: false,
    timeoutMs: 600_000,
    escalationPath: 'defer_to_pryce',
  },
  {
    category: 'third_party_message',
    description: 'Send message to third party',
    requiredApproval: 0.7,
    requiresPryceApproval: false,
    timeoutMs: 300_000,
    escalationPath: 'queue_for_review',
  },
  {
    category: 'quiet_hours_wake',
    description: 'Wake user during quiet hours',
    requiredApproval: 0.8,
    requiredMembers: ['empath'],
    requiresPryceApproval: false,
    timeoutMs: 60_000,
    escalationPath: 'suppress_until_morning',
  },
  {
    category: 'modify_identity',
    description: 'Modify SOUL.md or IDENTITY.md',
    requiredApproval: 0.9,
    requiredMembers: ['guardian', 'ethicist'],
    requiresPryceApproval: true,
    timeoutMs: 86_400_000,
    escalationPath: 'block_permanently',
  },
  {
    category: 'security_override',
    description: 'Override security policy',
    requiredApproval: 0.9,
    requiredMembers: ['guardian', 'logician'],
    requiresPryceApproval: true,
    timeoutMs: 300_000,
    escalationPath: 'block_permanently',
  },
  {
    category: 'new_integration',
    description: 'Add new external integration',
    requiredApproval: 0.6,
    requiredMembers: ['guardian', 'custodian'],
    requiresPryceApproval: false,
    timeoutMs: 600_000,
    escalationPath: 'defer_to_pryce',
  },
  {
    category: 'autonomous_action',
    description: 'Take autonomous action',
    requiredApproval: 0.5,
    requiresPryceApproval: false,
    timeoutMs: 120_000,
    escalationPath: 'queue_for_review',
  },
];

/**
 * Look up the decision threshold for a given category.
 *
 * @param category - The decision category to look up
 * @returns The threshold configuration or null if not found
 */
export function getThreshold(category: string): DecisionThreshold | null {
  return DECISION_THRESHOLDS.find(t => t.category === category) ?? null;
}

/**
 * Evaluate whether a decision meets its threshold requirements.
 *
 * Checks both the overall approval rate AND whether all required members
 * have approved. Both conditions must be satisfied for the threshold to be met.
 *
 * @param category - The decision category to evaluate
 * @param approvalRate - The approval rate achieved (0-1)
 * @param approvedBy - Array of member IDs who approved
 * @returns ThresholdResult with detailed evaluation
 */
export function meetsThreshold(
  category: string,
  approvalRate: number,
  approvedBy: string[],
): ThresholdResult {
  const threshold = getThreshold(category);

  if (!threshold) {
    return {
      met: false,
      category,
      approvalRate,
      requiredApproval: 1.0,
      requiredMembersMet: false,
      missingMembers: [],
      pryceApprovalNeeded: true,
    };
  }

  const requiredMembers = threshold.requiredMembers ?? [];
  const missingMembers = requiredMembers.filter(m => !approvedBy.includes(m));
  const requiredMembersMet = missingMembers.length === 0;
  const approvalRateMet = approvalRate >= threshold.requiredApproval;

  return {
    met: approvalRateMet && requiredMembersMet,
    category,
    approvalRate,
    requiredApproval: threshold.requiredApproval,
    requiredMembersMet,
    missingMembers,
    pryceApprovalNeeded: threshold.requiresPryceApproval,
  };
}

/**
 * Get all categories that require Pryce's explicit approval.
 */
export function getPryceRequiredCategories(): DecisionThreshold[] {
  return DECISION_THRESHOLDS.filter(t => t.requiresPryceApproval);
}

/**
 * Get all known category names.
 */
export function getAllCategories(): string[] {
  return DECISION_THRESHOLDS.map(t => t.category);
}
