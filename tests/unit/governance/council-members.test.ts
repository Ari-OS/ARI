import { describe, it, expect } from 'vitest';
import {
  COUNCIL_MEMBERS,
  VALID_VETO_CATEGORIES,
  getMember,
  getVetoHolders,
  getMemberIds,
  getVetoHoldersForCategory,
  isValidMember,
} from '../../../src/governance/council-members.js';
import type { CouncilMember } from '../../../src/governance/council-members.js';
import {
  DECISION_THRESHOLDS,
  getThreshold,
  meetsThreshold,
  getPryceRequiredCategories,
  getAllCategories,
} from '../../../src/governance/decision-thresholds.js';
import type { ThresholdResult } from '../../../src/governance/decision-thresholds.js';

describe('CouncilMembers', () => {
  // ── Member count ───────────────────────────────────────────────────────

  it('should define exactly 15 council members', () => {
    expect(COUNCIL_MEMBERS).toHaveLength(15);
  });

  // ── Required fields ────────────────────────────────────────────────────

  it('should have all required fields on every member', () => {
    const requiredFields: (keyof CouncilMember)[] = [
      'id', 'name', 'role', 'description', 'priorities',
      'vetoCategories', 'systemPrompt', 'trustBias',
    ];

    for (const member of COUNCIL_MEMBERS) {
      for (const field of requiredFields) {
        expect(member[field], `${member.id} missing field "${field}"`).toBeDefined();
      }
    }
  });

  // ── Unique IDs ─────────────────────────────────────────────────────────

  it('should have unique IDs across all members', () => {
    const ids = COUNCIL_MEMBERS.map(m => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  // ── Unique names ───────────────────────────────────────────────────────

  it('should have unique names across all members', () => {
    const names = COUNCIL_MEMBERS.map(m => m.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  // ── ID format ──────────────────────────────────────────────────────────

  it('should have lowercase alphabetic IDs (no spaces or special chars)', () => {
    for (const member of COUNCIL_MEMBERS) {
      expect(member.id).toMatch(/^[a-z_]+$/);
    }
  });

  // ── Non-empty strings ──────────────────────────────────────────────────

  it('should have non-empty name, role, description, and systemPrompt', () => {
    for (const member of COUNCIL_MEMBERS) {
      expect(member.name.length, `${member.id} name is empty`).toBeGreaterThan(0);
      expect(member.role.length, `${member.id} role is empty`).toBeGreaterThan(0);
      expect(member.description.length, `${member.id} description is empty`).toBeGreaterThan(0);
      expect(member.systemPrompt.length, `${member.id} systemPrompt is empty`).toBeGreaterThan(20);
    }
  });

  // ── Priorities ─────────────────────────────────────────────────────────

  it('should have at least 2 priorities per member', () => {
    for (const member of COUNCIL_MEMBERS) {
      expect(
        member.priorities.length,
        `${member.id} should have at least 2 priorities`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  // ── Trust bias range ───────────────────────────────────────────────────

  it('should have trustBias between -1 and 1 for all members', () => {
    for (const member of COUNCIL_MEMBERS) {
      expect(member.trustBias, `${member.id} trustBias out of range`).toBeGreaterThanOrEqual(-1);
      expect(member.trustBias, `${member.id} trustBias out of range`).toBeLessThanOrEqual(1);
    }
  });

  // ── Valid veto categories ──────────────────────────────────────────────

  it('should only use valid veto categories', () => {
    for (const member of COUNCIL_MEMBERS) {
      for (const category of member.vetoCategories) {
        expect(
          VALID_VETO_CATEGORIES,
          `${member.id} has invalid veto category "${category}"`,
        ).toContain(category);
      }
    }
  });

  // ── At least some veto holders ─────────────────────────────────────────

  it('should have at least 4 members with veto authority', () => {
    const vetoHolders = COUNCIL_MEMBERS.filter(m => m.vetoCategories.length > 0);
    expect(vetoHolders.length).toBeGreaterThanOrEqual(4);
  });

  // ── System prompt mentions role ────────────────────────────────────────

  it('should reference the member name in each systemPrompt', () => {
    for (const member of COUNCIL_MEMBERS) {
      expect(
        member.systemPrompt,
        `${member.id} systemPrompt does not mention name "${member.name}"`,
      ).toContain(member.name);
    }
  });

  // ── System prompt contains APPROVE/REJECT/ABSTAIN ──────────────────────

  it('should instruct voting options in each systemPrompt', () => {
    for (const member of COUNCIL_MEMBERS) {
      expect(
        member.systemPrompt,
        `${member.id} systemPrompt missing vote instructions`,
      ).toMatch(/APPROVE.*REJECT.*ABSTAIN/);
    }
  });

  // ── Expected members present ───────────────────────────────────────────

  it('should include all 15 expected roles', () => {
    const expectedRoles = [
      'Logician', 'Guardian', 'Ethicist', 'Pragmatist', 'Innovator',
      'Skeptic', 'Empath', 'Strategist', 'Economist', 'Poet',
      'Scientist', 'Custodian', 'Connector', 'Healer', 'Futurist',
    ];
    const actualRoles = COUNCIL_MEMBERS.map(m => m.role);
    for (const role of expectedRoles) {
      expect(actualRoles, `missing role: ${role}`).toContain(role);
    }
  });

  // ── Guardian has security veto ─────────────────────────────────────────

  it('should give Guardian veto authority over security', () => {
    const guardian = COUNCIL_MEMBERS.find(m => m.role === 'Guardian');
    expect(guardian).toBeDefined();
    expect(guardian!.vetoCategories).toContain('security');
  });

  // ── Ethicist has ethics veto ───────────────────────────────────────────

  it('should give Ethicist veto authority over ethics', () => {
    const ethicist = COUNCIL_MEMBERS.find(m => m.role === 'Ethicist');
    expect(ethicist).toBeDefined();
    expect(ethicist!.vetoCategories).toContain('ethics');
  });

  // ── Helper: getMember ──────────────────────────────────────────────────

  it('getMember should return the correct member by ID', () => {
    const guardian = getMember('guardian');
    expect(guardian).toBeDefined();
    expect(guardian!.name).toBe('AEGIS');
    expect(guardian!.role).toBe('Guardian');
  });

  it('getMember should return undefined for unknown ID', () => {
    expect(getMember('nonexistent')).toBeUndefined();
  });

  // ── Helper: getVetoHolders ─────────────────────────────────────────────

  it('getVetoHolders should return only members with veto authority', () => {
    const holders = getVetoHolders();
    expect(holders.length).toBeGreaterThan(0);
    for (const holder of holders) {
      expect(holder.vetoCategories.length).toBeGreaterThan(0);
    }
  });

  // ── Helper: getMemberIds ───────────────────────────────────────────────

  it('getMemberIds should return 15 IDs', () => {
    const ids = getMemberIds();
    expect(ids).toHaveLength(15);
  });

  // ── Helper: getVetoHoldersForCategory ──────────────────────────────────

  it('getVetoHoldersForCategory should find Guardian for security', () => {
    const holders = getVetoHoldersForCategory('security');
    expect(holders.some(h => h.id === 'guardian')).toBe(true);
  });

  it('getVetoHoldersForCategory should return empty for unknown category', () => {
    const holders = getVetoHoldersForCategory('nonexistent_category');
    expect(holders).toHaveLength(0);
  });

  // ── Helper: isValidMember ──────────────────────────────────────────────

  it('isValidMember should return true for known members', () => {
    expect(isValidMember('guardian')).toBe(true);
    expect(isValidMember('logician')).toBe(true);
  });

  it('isValidMember should return false for unknown members', () => {
    expect(isValidMember('phantom')).toBe(false);
  });
});

describe('DecisionThresholds', () => {
  // ── Expected categories ────────────────────────────────────────────────

  it('should define all expected decision categories', () => {
    const expectedCategories = [
      'publish_content',
      'budget_increase',
      'third_party_message',
      'quiet_hours_wake',
      'modify_identity',
      'security_override',
      'new_integration',
      'autonomous_action',
    ];
    const actualCategories = DECISION_THRESHOLDS.map(t => t.category);
    for (const cat of expectedCategories) {
      expect(actualCategories, `missing category: ${cat}`).toContain(cat);
    }
  });

  // ── At least 8 thresholds ──────────────────────────────────────────────

  it('should define at least 8 decision thresholds', () => {
    expect(DECISION_THRESHOLDS.length).toBeGreaterThanOrEqual(8);
  });

  // ── Approval rate range ────────────────────────────────────────────────

  it('should have requiredApproval between 0 and 1 for all thresholds', () => {
    for (const threshold of DECISION_THRESHOLDS) {
      expect(threshold.requiredApproval).toBeGreaterThan(0);
      expect(threshold.requiredApproval).toBeLessThanOrEqual(1);
    }
  });

  // ── Timeout positive ───────────────────────────────────────────────────

  it('should have positive timeoutMs for all thresholds', () => {
    for (const threshold of DECISION_THRESHOLDS) {
      expect(threshold.timeoutMs).toBeGreaterThan(0);
    }
  });

  // ── Unique categories ──────────────────────────────────────────────────

  it('should have unique category names', () => {
    const categories = DECISION_THRESHOLDS.map(t => t.category);
    const unique = new Set(categories);
    expect(unique.size).toBe(categories.length);
  });

  // ── Critical categories require Pryce ──────────────────────────────────

  it('should require Pryce approval for modify_identity', () => {
    const threshold = getThreshold('modify_identity');
    expect(threshold).not.toBeNull();
    expect(threshold!.requiresPryceApproval).toBe(true);
  });

  it('should require Pryce approval for security_override', () => {
    const threshold = getThreshold('security_override');
    expect(threshold).not.toBeNull();
    expect(threshold!.requiresPryceApproval).toBe(true);
  });

  // ── getThreshold ───────────────────────────────────────────────────────

  it('getThreshold should return null for unknown category', () => {
    expect(getThreshold('nonexistent_category')).toBeNull();
  });

  it('getThreshold should return correct threshold for known category', () => {
    const threshold = getThreshold('publish_content');
    expect(threshold).not.toBeNull();
    expect(threshold!.requiredApproval).toBe(0.6);
    expect(threshold!.requiredMembers).toContain('guardian');
  });

  // ── meetsThreshold: approval rate sufficient ───────────────────────────

  it('meetsThreshold should pass when rate and required members are met', () => {
    const result: ThresholdResult = meetsThreshold(
      'publish_content',
      0.8,
      ['guardian', 'logician', 'ethicist'],
    );
    expect(result.met).toBe(true);
    expect(result.requiredMembersMet).toBe(true);
    expect(result.missingMembers).toHaveLength(0);
  });

  // ── meetsThreshold: approval rate insufficient ─────────────────────────

  it('meetsThreshold should fail when approval rate is too low', () => {
    const result = meetsThreshold(
      'publish_content',
      0.4,
      ['guardian'],
    );
    expect(result.met).toBe(false);
    expect(result.approvalRate).toBe(0.4);
    expect(result.requiredApproval).toBe(0.6);
  });

  // ── meetsThreshold: missing required member ────────────────────────────

  it('meetsThreshold should fail when required member is missing', () => {
    const result = meetsThreshold(
      'publish_content',
      0.9,
      ['logician', 'ethicist'],
    );
    expect(result.met).toBe(false);
    expect(result.requiredMembersMet).toBe(false);
    expect(result.missingMembers).toContain('guardian');
  });

  // ── meetsThreshold: multiple required members ──────────────────────────

  it('meetsThreshold should check all required members for modify_identity', () => {
    // Missing ethicist
    const result1 = meetsThreshold(
      'modify_identity',
      0.95,
      ['guardian'],
    );
    expect(result1.met).toBe(false);
    expect(result1.missingMembers).toContain('ethicist');

    // Missing guardian
    const result2 = meetsThreshold(
      'modify_identity',
      0.95,
      ['ethicist'],
    );
    expect(result2.met).toBe(false);
    expect(result2.missingMembers).toContain('guardian');

    // Both present and rate sufficient
    const result3 = meetsThreshold(
      'modify_identity',
      0.95,
      ['guardian', 'ethicist'],
    );
    expect(result3.met).toBe(true);
    expect(result3.pryceApprovalNeeded).toBe(true);
  });

  // ── meetsThreshold: unknown category ───────────────────────────────────

  it('meetsThreshold should return strict failure for unknown category', () => {
    const result = meetsThreshold('nonexistent', 1.0, ['everyone']);
    expect(result.met).toBe(false);
    expect(result.requiredApproval).toBe(1.0);
    expect(result.pryceApprovalNeeded).toBe(true);
  });

  // ── meetsThreshold: no required members ────────────────────────────────

  it('meetsThreshold should pass with just rate when no required members', () => {
    const result = meetsThreshold(
      'autonomous_action',
      0.6,
      [],
    );
    expect(result.met).toBe(true);
    expect(result.requiredMembersMet).toBe(true);
    expect(result.pryceApprovalNeeded).toBe(false);
  });

  // ── meetsThreshold: exact boundary ─────────────────────────────────────

  it('meetsThreshold should pass at exact boundary approval rate', () => {
    const result = meetsThreshold(
      'autonomous_action',
      0.5,
      [],
    );
    expect(result.met).toBe(true);
  });

  it('meetsThreshold should fail just below boundary approval rate', () => {
    const result = meetsThreshold(
      'autonomous_action',
      0.49,
      [],
    );
    expect(result.met).toBe(false);
  });

  // ── getPryceRequiredCategories ─────────────────────────────────────────

  it('getPryceRequiredCategories should return at least 2 categories', () => {
    const categories = getPryceRequiredCategories();
    expect(categories.length).toBeGreaterThanOrEqual(2);
    const names = categories.map(c => c.category);
    expect(names).toContain('modify_identity');
    expect(names).toContain('security_override');
  });

  // ── getAllCategories ───────────────────────────────────────────────────

  it('getAllCategories should return all category names', () => {
    const categories = getAllCategories();
    expect(categories).toHaveLength(DECISION_THRESHOLDS.length);
    expect(categories).toContain('publish_content');
    expect(categories).toContain('autonomous_action');
  });

  // ── High-security thresholds should be higher than routine ──────────────

  it('should require higher approval for security-critical decisions', () => {
    const securityOverride = getThreshold('security_override');
    const autonomousAction = getThreshold('autonomous_action');
    expect(securityOverride).not.toBeNull();
    expect(autonomousAction).not.toBeNull();
    expect(securityOverride!.requiredApproval).toBeGreaterThan(
      autonomousAction!.requiredApproval,
    );
  });

  // ── Description non-empty ──────────────────────────────────────────────

  it('should have non-empty descriptions for all thresholds', () => {
    for (const threshold of DECISION_THRESHOLDS) {
      expect(threshold.description.length).toBeGreaterThan(0);
    }
  });
});
