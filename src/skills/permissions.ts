import type { TrustLevel } from '../kernel/types.js';
import type { SkillPermission, SkillTrustRequirement } from './types.js';

/**
 * Permission Matrix
 *
 * Defines the relationship between trust levels and permissions.
 * Used for determining what actions a skill can perform.
 */

// ── Trust Level Hierarchy ───────────────────────────────────────────────────

export const TRUST_HIERARCHY: TrustLevel[] = [
  'hostile',
  'untrusted',
  'standard',
  'verified',
  'operator',
  'system',
];

/**
 * Get numeric trust level for comparison
 */
export function getTrustScore(level: TrustLevel): number {
  return TRUST_HIERARCHY.indexOf(level);
}

/**
 * Check if one trust level is at least as high as another
 */
export function meetsOrExceeds(actual: TrustLevel, required: TrustLevel): boolean {
  return getTrustScore(actual) >= getTrustScore(required);
}

// ── Permission Requirements ─────────────────────────────────────────────────

/**
 * Minimum trust level required for each permission
 */
export const PERMISSION_REQUIREMENTS: Record<SkillPermission, TrustLevel> = {
  // Always blocked
  network_access: 'system', // Effectively blocked (requires system trust)

  // High trust required
  execute_bash: 'operator',
  governance_vote: 'operator',

  // Medium trust required
  write_files: 'verified',
  memory_write: 'verified',

  // Standard trust required
  read_files: 'standard',
  memory_read: 'standard',
  session_access: 'standard',
  channel_send: 'standard',
  tool_execute: 'standard',
};

/**
 * Get the minimum trust level required for a permission
 */
export function getRequiredTrust(permission: SkillPermission): TrustLevel {
  return PERMISSION_REQUIREMENTS[permission];
}

/**
 * Check if a trust level can use a permission
 */
export function canUsePermission(trustLevel: TrustLevel, permission: SkillPermission): boolean {
  const required = getRequiredTrust(permission);
  return meetsOrExceeds(trustLevel, required);
}

// ── Permission Categories ───────────────────────────────────────────────────

/**
 * Permission categories for grouping
 */
export const PERMISSION_CATEGORIES: Record<string, SkillPermission[]> = {
  filesystem: ['read_files', 'write_files'],
  memory: ['memory_read', 'memory_write'],
  execution: ['execute_bash', 'tool_execute'],
  communication: ['channel_send', 'session_access'],
  governance: ['governance_vote'],
  dangerous: ['network_access'],
};

/**
 * Get the category for a permission
 */
export function getPermissionCategory(permission: SkillPermission): string {
  for (const [category, permissions] of Object.entries(PERMISSION_CATEGORIES)) {
    if (permissions.includes(permission)) {
      return category;
    }
  }
  return 'unknown';
}

// ── Permission Descriptions ─────────────────────────────────────────────────

/**
 * Human-readable descriptions for permissions
 */
export const PERMISSION_DESCRIPTIONS: Record<SkillPermission, string> = {
  read_files: 'Read files from the filesystem',
  write_files: 'Write or modify files on the filesystem',
  execute_bash: 'Execute shell commands',
  network_access: 'Access external networks (BLOCKED)',
  memory_read: 'Read from ARI memory system',
  memory_write: 'Write to ARI memory system',
  session_access: 'Access session context and history',
  channel_send: 'Send messages through channels',
  tool_execute: 'Execute ARI tools',
  governance_vote: 'Participate in governance votes',
};

/**
 * Get description for a permission
 */
export function getPermissionDescription(permission: SkillPermission): string {
  return PERMISSION_DESCRIPTIONS[permission];
}

// ── Trust Requirement Mapping ───────────────────────────────────────────────

/**
 * Map skill trust requirements to actual trust levels
 */
export const TRUST_REQUIREMENT_MAP: Record<SkillTrustRequirement, TrustLevel> = {
  standard: 'standard',
  verified: 'verified',
  operator: 'operator',
  system: 'system',
};

/**
 * Get the trust level for a skill trust requirement
 */
export function getTrustForRequirement(requirement: SkillTrustRequirement): TrustLevel {
  return TRUST_REQUIREMENT_MAP[requirement];
}

// ── Permission Checking ─────────────────────────────────────────────────────

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  permission: SkillPermission;
  requiredTrust: TrustLevel;
  actualTrust: TrustLevel;
  reason?: string;
}

/**
 * Check a single permission
 */
export function checkPermission(
  permission: SkillPermission,
  trustLevel: TrustLevel
): PermissionCheckResult {
  const required = getRequiredTrust(permission);
  const allowed = meetsOrExceeds(trustLevel, required);

  return {
    allowed,
    permission,
    requiredTrust: required,
    actualTrust: trustLevel,
    reason: allowed
      ? undefined
      : `Permission '${permission}' requires ${required} trust, but user has ${trustLevel}`,
  };
}

/**
 * Check multiple permissions
 */
export function checkPermissions(
  permissions: SkillPermission[],
  trustLevel: TrustLevel
): {
  allAllowed: boolean;
  results: PermissionCheckResult[];
  denied: SkillPermission[];
} {
  const results = permissions.map(p => checkPermission(p, trustLevel));
  const denied = results.filter(r => !r.allowed).map(r => r.permission);

  return {
    allAllowed: denied.length === 0,
    results,
    denied,
  };
}

// ── Permission Escalation ───────────────────────────────────────────────────

/**
 * Check if a trust level can escalate another
 */
export function canEscalate(escalator: TrustLevel, target: TrustLevel, toLevel: TrustLevel): boolean {
  // Can only escalate to levels at or below your own
  if (!meetsOrExceeds(escalator, toLevel)) return false;

  // Can only escalate if you're above the target
  if (!meetsOrExceeds(escalator, target)) return false;

  // System can escalate anyone
  if (escalator === 'system') return true;

  // Operators can escalate to verified and below
  if (escalator === 'operator') {
    return getTrustScore(toLevel) <= getTrustScore('verified');
  }

  // Verified users cannot escalate others
  return false;
}

// ── Permission Audit ────────────────────────────────────────────────────────

/**
 * Get a summary of permissions for auditing
 */
export function getPermissionSummary(permissions: SkillPermission[]): {
  categories: string[];
  highestRequired: TrustLevel;
  hasDangerous: boolean;
  description: string;
} {
  const categories = [...new Set(permissions.map(getPermissionCategory))];
  const trustLevels = permissions.map(getRequiredTrust);
  const highestIndex = Math.max(...trustLevels.map(getTrustScore));
  const highestRequired = TRUST_HIERARCHY[highestIndex];
  const hasDangerous = permissions.some(p => p === 'network_access' || p === 'execute_bash');

  const description = permissions.length === 0
    ? 'No special permissions required'
    : `Requires ${permissions.length} permission(s): ${permissions.join(', ')}`;

  return {
    categories,
    highestRequired,
    hasDangerous,
    description,
  };
}
