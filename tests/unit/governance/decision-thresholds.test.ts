import { describe, it, expect } from 'vitest';
import {
  getThreshold,
  meetsThreshold,
  getPryceRequiredCategories,
  getAllCategories,
  DECISION_THRESHOLDS,
} from '../../../src/governance/decision-thresholds.js';
import type { DecisionThreshold, ThresholdResult } from '../../../src/governance/decision-thresholds.js';

describe('DecisionThresholds', () => {
  describe('DECISION_THRESHOLDS constant', () => {
    it('should define 8 threshold categories', () => {
      expect(DECISION_THRESHOLDS).toHaveLength(8);
    });

    it('should have unique category names', () => {
      const categories = DECISION_THRESHOLDS.map(t => t.category);
      const unique = new Set(categories);

      expect(unique.size).toBe(categories.length);
    });

    it('should have all required approval rates between 0 and 1', () => {
      for (const t of DECISION_THRESHOLDS) {
        expect(t.requiredApproval).toBeGreaterThanOrEqual(0);
        expect(t.requiredApproval).toBeLessThanOrEqual(1);
      }
    });

    it('should have positive timeout values', () => {
      for (const t of DECISION_THRESHOLDS) {
        expect(t.timeoutMs).toBeGreaterThan(0);
      }
    });
  });

  describe('getThreshold()', () => {
    it('should return threshold for publish_content', () => {
      const t = getThreshold('publish_content');

      expect(t).not.toBeNull();
      expect(t!.requiredApproval).toBe(0.6);
      expect(t!.requiredMembers).toContain('guardian');
    });

    it('should return threshold for budget_increase', () => {
      const t = getThreshold('budget_increase');

      expect(t).not.toBeNull();
      expect(t!.requiredApproval).toBe(0.5);
    });

    it('should return threshold for security_override', () => {
      const t = getThreshold('security_override');

      expect(t).not.toBeNull();
      expect(t!.requiredApproval).toBe(0.9);
      expect(t!.requiresPryceApproval).toBe(true);
    });

    it('should return threshold for modify_identity', () => {
      const t = getThreshold('modify_identity');

      expect(t).not.toBeNull();
      expect(t!.requiredApproval).toBe(0.9);
      expect(t!.requiredMembers).toContain('guardian');
      expect(t!.requiredMembers).toContain('ethicist');
      expect(t!.requiresPryceApproval).toBe(true);
    });

    it('should return null for unknown category', () => {
      const t = getThreshold('nonexistent');

      expect(t).toBeNull();
    });

    it('should return threshold for autonomous_action', () => {
      const t = getThreshold('autonomous_action');

      expect(t).not.toBeNull();
      expect(t!.requiredApproval).toBe(0.5);
      expect(t!.requiresPryceApproval).toBe(false);
    });

    it('should return threshold for quiet_hours_wake', () => {
      const t = getThreshold('quiet_hours_wake');

      expect(t).not.toBeNull();
      expect(t!.requiredApproval).toBe(0.8);
      expect(t!.requiredMembers).toContain('empath');
    });
  });

  describe('meetsThreshold() — approval rate checks', () => {
    it('should pass when approval rate meets the threshold', () => {
      const result = meetsThreshold('autonomous_action', 0.5, []);

      expect(result.met).toBe(true);
      expect(result.approvalRate).toBe(0.5);
      expect(result.requiredApproval).toBe(0.5);
    });

    it('should pass when approval rate exceeds the threshold', () => {
      const result = meetsThreshold('autonomous_action', 0.9, []);

      expect(result.met).toBe(true);
    });

    it('should fail when approval rate is below the threshold', () => {
      const result = meetsThreshold('autonomous_action', 0.4, []);

      expect(result.met).toBe(false);
    });

    it('should fail for unknown category', () => {
      const result = meetsThreshold('unknown_category', 1.0, ['everyone']);

      expect(result.met).toBe(false);
      expect(result.requiredApproval).toBe(1.0);
      expect(result.pryceApprovalNeeded).toBe(true);
    });
  });

  describe('meetsThreshold() — required members', () => {
    it('should pass when all required members approved', () => {
      const result = meetsThreshold('publish_content', 0.7, ['guardian', 'other']);

      expect(result.met).toBe(true);
      expect(result.requiredMembersMet).toBe(true);
      expect(result.missingMembers).toEqual([]);
    });

    it('should fail when required member is missing', () => {
      const result = meetsThreshold('publish_content', 0.7, ['other']);

      expect(result.met).toBe(false);
      expect(result.requiredMembersMet).toBe(false);
      expect(result.missingMembers).toContain('guardian');
    });

    it('should fail when rate is met but required members are missing', () => {
      const result = meetsThreshold('security_override', 0.95, ['guardian']);

      // Missing logician
      expect(result.met).toBe(false);
      expect(result.missingMembers).toContain('logician');
    });

    it('should fail when required members are met but rate is too low', () => {
      const result = meetsThreshold('publish_content', 0.3, ['guardian']);

      expect(result.met).toBe(false);
    });

    it('should pass for category with no required members when rate is met', () => {
      const result = meetsThreshold('budget_increase', 0.6, []);

      expect(result.met).toBe(true);
      expect(result.requiredMembersMet).toBe(true);
    });

    it('should require both guardian and ethicist for modify_identity', () => {
      const withBoth = meetsThreshold('modify_identity', 0.95, ['guardian', 'ethicist']);
      const withOne = meetsThreshold('modify_identity', 0.95, ['guardian']);

      expect(withBoth.met).toBe(true);
      expect(withOne.met).toBe(false);
      expect(withOne.missingMembers).toContain('ethicist');
    });

    it('should require guardian and custodian for new_integration', () => {
      const result = meetsThreshold('new_integration', 0.7, ['guardian', 'custodian']);

      expect(result.met).toBe(true);
    });
  });

  describe('meetsThreshold() — Pryce approval flag', () => {
    it('should flag pryceApprovalNeeded for modify_identity', () => {
      const result = meetsThreshold('modify_identity', 0.95, ['guardian', 'ethicist']);

      expect(result.pryceApprovalNeeded).toBe(true);
    });

    it('should flag pryceApprovalNeeded for security_override', () => {
      const result = meetsThreshold('security_override', 0.95, ['guardian', 'logician']);

      expect(result.pryceApprovalNeeded).toBe(true);
    });

    it('should not flag pryceApprovalNeeded for publish_content', () => {
      const result = meetsThreshold('publish_content', 0.7, ['guardian']);

      expect(result.pryceApprovalNeeded).toBe(false);
    });

    it('should not flag pryceApprovalNeeded for autonomous_action', () => {
      const result = meetsThreshold('autonomous_action', 0.6, []);

      expect(result.pryceApprovalNeeded).toBe(false);
    });
  });

  describe('getPryceRequiredCategories()', () => {
    it('should return categories requiring Pryce approval', () => {
      const categories = getPryceRequiredCategories();

      expect(categories.length).toBeGreaterThanOrEqual(2);
      expect(categories.map(c => c.category)).toContain('modify_identity');
      expect(categories.map(c => c.category)).toContain('security_override');
    });

    it('should not include categories that do not require Pryce', () => {
      const categories = getPryceRequiredCategories();
      const ids = categories.map(c => c.category);

      expect(ids).not.toContain('publish_content');
      expect(ids).not.toContain('autonomous_action');
    });

    it('should return DecisionThreshold objects', () => {
      const categories = getPryceRequiredCategories();

      for (const cat of categories) {
        expect(cat.requiresPryceApproval).toBe(true);
        expect(typeof cat.timeoutMs).toBe('number');
      }
    });
  });

  describe('getAllCategories()', () => {
    it('should return all 8 category names', () => {
      const categories = getAllCategories();

      expect(categories).toHaveLength(8);
    });

    it('should return strings', () => {
      const categories = getAllCategories();

      for (const cat of categories) {
        expect(typeof cat).toBe('string');
      }
    });

    it('should include known categories', () => {
      const categories = getAllCategories();

      expect(categories).toContain('publish_content');
      expect(categories).toContain('budget_increase');
      expect(categories).toContain('security_override');
      expect(categories).toContain('autonomous_action');
    });
  });
});
