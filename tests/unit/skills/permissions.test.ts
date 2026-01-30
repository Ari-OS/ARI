import { describe, it, expect } from 'vitest';
import {
  TRUST_HIERARCHY,
  getTrustScore,
  meetsOrExceeds,
  PERMISSION_REQUIREMENTS,
  getRequiredTrust,
  canUsePermission,
  PERMISSION_CATEGORIES,
  getPermissionCategory,
  PERMISSION_DESCRIPTIONS,
  getPermissionDescription,
  TRUST_REQUIREMENT_MAP,
  getTrustForRequirement,
  checkPermission,
  checkPermissions,
  canEscalate,
  getPermissionSummary,
} from '../../../src/skills/permissions.js';

describe('Skills Permissions', () => {
  describe('TRUST_HIERARCHY', () => {
    it('should have correct trust levels in order', () => {
      expect(TRUST_HIERARCHY).toEqual([
        'hostile',
        'untrusted',
        'standard',
        'verified',
        'operator',
        'system',
      ]);
    });
  });

  describe('getTrustScore', () => {
    it('should return correct scores for each trust level', () => {
      expect(getTrustScore('hostile')).toBe(0);
      expect(getTrustScore('untrusted')).toBe(1);
      expect(getTrustScore('standard')).toBe(2);
      expect(getTrustScore('verified')).toBe(3);
      expect(getTrustScore('operator')).toBe(4);
      expect(getTrustScore('system')).toBe(5);
    });

    it('should return -1 for invalid trust level', () => {
      expect(getTrustScore('invalid' as any)).toBe(-1);
    });
  });

  describe('meetsOrExceeds', () => {
    it('should return true when actual meets required', () => {
      expect(meetsOrExceeds('standard', 'standard')).toBe(true);
      expect(meetsOrExceeds('operator', 'operator')).toBe(true);
    });

    it('should return true when actual exceeds required', () => {
      expect(meetsOrExceeds('operator', 'standard')).toBe(true);
      expect(meetsOrExceeds('system', 'hostile')).toBe(true);
      expect(meetsOrExceeds('verified', 'untrusted')).toBe(true);
    });

    it('should return false when actual is below required', () => {
      expect(meetsOrExceeds('standard', 'operator')).toBe(false);
      expect(meetsOrExceeds('hostile', 'standard')).toBe(false);
      expect(meetsOrExceeds('untrusted', 'verified')).toBe(false);
    });
  });

  describe('PERMISSION_REQUIREMENTS', () => {
    it('should define requirements for all permissions', () => {
      const expectedPermissions = [
        'network_access',
        'execute_bash',
        'governance_vote',
        'write_files',
        'memory_write',
        'read_files',
        'memory_read',
        'session_access',
        'channel_send',
        'tool_execute',
      ];

      for (const permission of expectedPermissions) {
        expect(PERMISSION_REQUIREMENTS).toHaveProperty(permission);
        expect(TRUST_HIERARCHY).toContain(PERMISSION_REQUIREMENTS[permission as keyof typeof PERMISSION_REQUIREMENTS]);
      }
    });

    it('should require system trust for network_access', () => {
      expect(PERMISSION_REQUIREMENTS.network_access).toBe('system');
    });

    it('should require operator trust for execute_bash', () => {
      expect(PERMISSION_REQUIREMENTS.execute_bash).toBe('operator');
    });

    it('should require verified trust for write_files', () => {
      expect(PERMISSION_REQUIREMENTS.write_files).toBe('verified');
    });

    it('should require standard trust for read_files', () => {
      expect(PERMISSION_REQUIREMENTS.read_files).toBe('standard');
    });
  });

  describe('getRequiredTrust', () => {
    it('should return the required trust level for each permission', () => {
      expect(getRequiredTrust('network_access')).toBe('system');
      expect(getRequiredTrust('execute_bash')).toBe('operator');
      expect(getRequiredTrust('write_files')).toBe('verified');
      expect(getRequiredTrust('read_files')).toBe('standard');
    });
  });

  describe('canUsePermission', () => {
    it('should allow standard permissions for standard trust', () => {
      expect(canUsePermission('standard', 'read_files')).toBe(true);
      expect(canUsePermission('standard', 'memory_read')).toBe(true);
      expect(canUsePermission('standard', 'session_access')).toBe(true);
      expect(canUsePermission('standard', 'channel_send')).toBe(true);
      expect(canUsePermission('standard', 'tool_execute')).toBe(true);
    });

    it('should deny write permissions for standard trust', () => {
      expect(canUsePermission('standard', 'write_files')).toBe(false);
      expect(canUsePermission('standard', 'memory_write')).toBe(false);
    });

    it('should deny execute_bash for standard trust', () => {
      expect(canUsePermission('standard', 'execute_bash')).toBe(false);
    });

    it('should allow write permissions for verified trust', () => {
      expect(canUsePermission('verified', 'write_files')).toBe(true);
      expect(canUsePermission('verified', 'memory_write')).toBe(true);
    });

    it('should allow execute_bash for operator trust', () => {
      expect(canUsePermission('operator', 'execute_bash')).toBe(true);
    });

    it('should deny network_access for all except system', () => {
      expect(canUsePermission('hostile', 'network_access')).toBe(false);
      expect(canUsePermission('untrusted', 'network_access')).toBe(false);
      expect(canUsePermission('standard', 'network_access')).toBe(false);
      expect(canUsePermission('verified', 'network_access')).toBe(false);
      expect(canUsePermission('operator', 'network_access')).toBe(false);
      expect(canUsePermission('system', 'network_access')).toBe(true);
    });

    it('should deny all permissions for hostile trust', () => {
      const permissions = [
        'read_files',
        'write_files',
        'execute_bash',
        'memory_read',
        'memory_write',
        'session_access',
        'channel_send',
        'tool_execute',
        'governance_vote',
        'network_access',
      ] as const;

      for (const permission of permissions) {
        expect(canUsePermission('hostile', permission)).toBe(false);
      }
    });

    it('should allow all permissions for system trust', () => {
      const permissions = [
        'read_files',
        'write_files',
        'execute_bash',
        'memory_read',
        'memory_write',
        'session_access',
        'channel_send',
        'tool_execute',
        'governance_vote',
        'network_access',
      ] as const;

      for (const permission of permissions) {
        expect(canUsePermission('system', permission)).toBe(true);
      }
    });
  });

  describe('PERMISSION_CATEGORIES', () => {
    it('should categorize filesystem permissions', () => {
      expect(PERMISSION_CATEGORIES.filesystem).toContain('read_files');
      expect(PERMISSION_CATEGORIES.filesystem).toContain('write_files');
    });

    it('should categorize memory permissions', () => {
      expect(PERMISSION_CATEGORIES.memory).toContain('memory_read');
      expect(PERMISSION_CATEGORIES.memory).toContain('memory_write');
    });

    it('should categorize execution permissions', () => {
      expect(PERMISSION_CATEGORIES.execution).toContain('execute_bash');
      expect(PERMISSION_CATEGORIES.execution).toContain('tool_execute');
    });

    it('should categorize communication permissions', () => {
      expect(PERMISSION_CATEGORIES.communication).toContain('channel_send');
      expect(PERMISSION_CATEGORIES.communication).toContain('session_access');
    });

    it('should categorize dangerous permissions', () => {
      expect(PERMISSION_CATEGORIES.dangerous).toContain('network_access');
    });
  });

  describe('getPermissionCategory', () => {
    it('should return correct category for each permission', () => {
      expect(getPermissionCategory('read_files')).toBe('filesystem');
      expect(getPermissionCategory('write_files')).toBe('filesystem');
      expect(getPermissionCategory('memory_read')).toBe('memory');
      expect(getPermissionCategory('memory_write')).toBe('memory');
      expect(getPermissionCategory('execute_bash')).toBe('execution');
      expect(getPermissionCategory('tool_execute')).toBe('execution');
      expect(getPermissionCategory('channel_send')).toBe('communication');
      expect(getPermissionCategory('session_access')).toBe('communication');
      expect(getPermissionCategory('governance_vote')).toBe('governance');
      expect(getPermissionCategory('network_access')).toBe('dangerous');
    });

    it('should return unknown for unrecognized permission', () => {
      expect(getPermissionCategory('unknown_permission' as any)).toBe('unknown');
    });
  });

  describe('PERMISSION_DESCRIPTIONS', () => {
    it('should have descriptions for all permissions', () => {
      const permissions = [
        'read_files',
        'write_files',
        'execute_bash',
        'network_access',
        'memory_read',
        'memory_write',
        'session_access',
        'channel_send',
        'tool_execute',
        'governance_vote',
      ];

      for (const permission of permissions) {
        expect(PERMISSION_DESCRIPTIONS).toHaveProperty(permission);
        expect(typeof PERMISSION_DESCRIPTIONS[permission as keyof typeof PERMISSION_DESCRIPTIONS]).toBe('string');
        expect(PERMISSION_DESCRIPTIONS[permission as keyof typeof PERMISSION_DESCRIPTIONS].length).toBeGreaterThan(0);
      }
    });
  });

  describe('getPermissionDescription', () => {
    it('should return correct description', () => {
      expect(getPermissionDescription('read_files')).toBe('Read files from the filesystem');
      expect(getPermissionDescription('network_access')).toBe('Access external networks (BLOCKED)');
    });
  });

  describe('TRUST_REQUIREMENT_MAP', () => {
    it('should map skill trust requirements to trust levels', () => {
      expect(TRUST_REQUIREMENT_MAP.standard).toBe('standard');
      expect(TRUST_REQUIREMENT_MAP.verified).toBe('verified');
      expect(TRUST_REQUIREMENT_MAP.operator).toBe('operator');
      expect(TRUST_REQUIREMENT_MAP.system).toBe('system');
    });
  });

  describe('getTrustForRequirement', () => {
    it('should return correct trust level for requirement', () => {
      expect(getTrustForRequirement('standard')).toBe('standard');
      expect(getTrustForRequirement('verified')).toBe('verified');
      expect(getTrustForRequirement('operator')).toBe('operator');
      expect(getTrustForRequirement('system')).toBe('system');
    });
  });

  describe('checkPermission', () => {
    it('should return allowed result when permission is granted', () => {
      const result = checkPermission('read_files', 'standard');

      expect(result.allowed).toBe(true);
      expect(result.permission).toBe('read_files');
      expect(result.requiredTrust).toBe('standard');
      expect(result.actualTrust).toBe('standard');
      expect(result.reason).toBeUndefined();
    });

    it('should return denied result when permission is not granted', () => {
      const result = checkPermission('execute_bash', 'standard');

      expect(result.allowed).toBe(false);
      expect(result.permission).toBe('execute_bash');
      expect(result.requiredTrust).toBe('operator');
      expect(result.actualTrust).toBe('standard');
      expect(result.reason).toContain('requires operator trust');
      expect(result.reason).toContain('has standard');
    });
  });

  describe('checkPermissions', () => {
    it('should return all allowed for sufficient trust', () => {
      const result = checkPermissions(['read_files', 'memory_read'], 'standard');

      expect(result.allAllowed).toBe(true);
      expect(result.denied).toHaveLength(0);
      expect(result.results).toHaveLength(2);
    });

    it('should return denied permissions for insufficient trust', () => {
      const result = checkPermissions(['read_files', 'execute_bash'], 'standard');

      expect(result.allAllowed).toBe(false);
      expect(result.denied).toContain('execute_bash');
      expect(result.denied).not.toContain('read_files');
    });

    it('should handle empty permissions array', () => {
      const result = checkPermissions([], 'standard');

      expect(result.allAllowed).toBe(true);
      expect(result.denied).toHaveLength(0);
      expect(result.results).toHaveLength(0);
    });

    it('should check all permissions', () => {
      const result = checkPermissions(
        ['read_files', 'write_files', 'execute_bash', 'network_access'],
        'operator'
      );

      expect(result.results).toHaveLength(4);
      expect(result.denied).toContain('network_access');
      expect(result.denied).not.toContain('read_files');
      expect(result.denied).not.toContain('write_files');
      expect(result.denied).not.toContain('execute_bash');
    });
  });

  describe('canEscalate', () => {
    it('should allow system to escalate anyone to any level', () => {
      expect(canEscalate('system', 'hostile', 'system')).toBe(true);
      expect(canEscalate('system', 'standard', 'operator')).toBe(true);
      expect(canEscalate('system', 'verified', 'verified')).toBe(true);
    });

    it('should allow operator to escalate to verified and below', () => {
      expect(canEscalate('operator', 'standard', 'verified')).toBe(true);
      expect(canEscalate('operator', 'untrusted', 'standard')).toBe(true);
    });

    it('should not allow operator to escalate to operator', () => {
      expect(canEscalate('operator', 'standard', 'operator')).toBe(false);
    });

    it('should not allow verified to escalate others', () => {
      expect(canEscalate('verified', 'standard', 'verified')).toBe(false);
      expect(canEscalate('verified', 'untrusted', 'standard')).toBe(false);
    });

    it('should not allow escalation above own level', () => {
      expect(canEscalate('standard', 'untrusted', 'verified')).toBe(false);
      expect(canEscalate('verified', 'standard', 'operator')).toBe(false);
    });

    it('should not allow escalation of higher-level targets', () => {
      expect(canEscalate('operator', 'system', 'verified')).toBe(false);
      expect(canEscalate('verified', 'operator', 'standard')).toBe(false);
    });
  });

  describe('getPermissionSummary', () => {
    it('should return summary for no permissions', () => {
      const summary = getPermissionSummary([]);

      expect(summary.categories).toHaveLength(0);
      expect(summary.hasDangerous).toBe(false);
      expect(summary.description).toContain('No special permissions');
    });

    it('should return summary for single permission', () => {
      const summary = getPermissionSummary(['read_files']);

      expect(summary.categories).toContain('filesystem');
      expect(summary.highestRequired).toBe('standard');
      expect(summary.hasDangerous).toBe(false);
      expect(summary.description).toContain('1 permission');
    });

    it('should return summary for multiple permissions', () => {
      const summary = getPermissionSummary(['read_files', 'write_files', 'memory_read']);

      expect(summary.categories).toContain('filesystem');
      expect(summary.categories).toContain('memory');
      expect(summary.highestRequired).toBe('verified');
      expect(summary.hasDangerous).toBe(false);
      expect(summary.description).toContain('3 permission');
    });

    it('should detect dangerous permissions', () => {
      const summary = getPermissionSummary(['network_access']);

      expect(summary.hasDangerous).toBe(true);
    });

    it('should detect execute_bash as dangerous', () => {
      const summary = getPermissionSummary(['execute_bash']);

      expect(summary.hasDangerous).toBe(true);
    });

    it('should calculate highest required trust correctly', () => {
      const summary = getPermissionSummary([
        'read_files',    // standard
        'write_files',   // verified
        'execute_bash',  // operator
      ]);

      expect(summary.highestRequired).toBe('operator');
    });

    it('should include unique categories only', () => {
      const summary = getPermissionSummary(['read_files', 'write_files']);

      // Both are filesystem
      expect(summary.categories.filter(c => c === 'filesystem')).toHaveLength(1);
    });
  });
});
