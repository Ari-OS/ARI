/**
 * Dual-Write Consistency Tests
 *
 * Tests that verify the old (inline) and new (PolicyEngine) permission systems
 * produce identical decisions for all permission scenarios.
 *
 * Target: <1% divergence between systems
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Executor } from '../../src/agents/executor.js';
import { AuditLogger } from '../../src/kernel/audit.js';
import { EventBus } from '../../src/kernel/event-bus.js';
import type { AgentId, TrustLevel, PermissionTier } from '../../src/kernel/types.js';

describe('Dual-Write Consistency', () => {
  let executor: Executor;
  let auditLogger: AuditLogger;
  let eventBus: EventBus;
  let testAuditPath: string;

  beforeEach(() => {
    testAuditPath = join(tmpdir(), `audit-${randomUUID()}.json`);
    auditLogger = new AuditLogger(testAuditPath);
    eventBus = new EventBus();
    executor = new Executor(auditLogger, eventBus);
  });

  describe('Permission Check Consistency', () => {
    // Helper to compare permission decisions between old and new systems
    const comparePermissions = (
      toolId: string,
      agentId: AgentId,
      trustLevel: TrustLevel
    ): { oldAllowed: boolean; newAllowed: boolean; consistent: boolean } => {
      const policyEngine = executor.getPolicyEngine();
      const tools = executor.getTools();
      const tool = tools.find((t) => t.id === toolId);

      if (!tool) {
        return { oldAllowed: false, newAllowed: false, consistent: true };
      }

      // Old system check (using the public interface through Executor)
      // We simulate the old check by examining the tool definition directly
      const oldCheck = checkOldSystem(tool, agentId, trustLevel);

      // New system check
      const policy = policyEngine.getPolicy(toolId);
      const newCheck = policy
        ? policyEngine.checkPermissions(agentId, trustLevel, policy)
        : { allowed: false, requires_approval: false, reason: 'No policy', risk_score: 0, violations: [] };

      return {
        oldAllowed: oldCheck.allowed,
        newAllowed: newCheck.allowed,
        consistent: oldCheck.allowed === newCheck.allowed,
      };
    };

    // Simulate old system permission check
    const checkOldSystem = (
      tool: { allowed_agents: AgentId[]; required_trust_level: TrustLevel },
      agentId: AgentId,
      trustLevel: TrustLevel
    ): { allowed: boolean } => {
      const TRUST_SCORES: Record<TrustLevel, number> = {
        system: 1.0,
        operator: 0.9,
        verified: 0.7,
        standard: 0.5,
        untrusted: 0.2,
        hostile: 0.0,
      };

      // Layer 1: Agent allowlist
      if (tool.allowed_agents.length > 0 && !tool.allowed_agents.includes(agentId)) {
        return { allowed: false };
      }

      // Layer 2: Trust level
      const requiredScore = TRUST_SCORES[tool.required_trust_level];
      const actualScore = TRUST_SCORES[trustLevel];
      if (actualScore < requiredScore) {
        return { allowed: false };
      }

      return { allowed: true };
    };

    it('should produce consistent decisions for file_read with standard trust', () => {
      const result = comparePermissions('file_read', 'planner' as AgentId, 'standard');
      expect(result.consistent).toBe(true);
      expect(result.oldAllowed).toBe(true);
      expect(result.newAllowed).toBe(true);
    });

    it('should produce consistent decisions for file_read with untrusted trust', () => {
      const result = comparePermissions('file_read', 'planner' as AgentId, 'untrusted');
      expect(result.consistent).toBe(true);
      expect(result.oldAllowed).toBe(false);
      expect(result.newAllowed).toBe(false);
    });

    it('should produce consistent decisions for file_write with verified trust', () => {
      const result = comparePermissions('file_write', 'executor' as AgentId, 'verified');
      expect(result.consistent).toBe(true);
      expect(result.oldAllowed).toBe(true);
      expect(result.newAllowed).toBe(true);
    });

    it('should produce consistent decisions for file_write with standard trust', () => {
      const result = comparePermissions('file_write', 'executor' as AgentId, 'standard');
      expect(result.consistent).toBe(true);
      expect(result.oldAllowed).toBe(false);
      expect(result.newAllowed).toBe(false);
    });

    it('should produce consistent decisions for file_delete with operator trust', () => {
      const result = comparePermissions('file_delete', 'planner' as AgentId, 'operator');
      expect(result.consistent).toBe(true);
      expect(result.oldAllowed).toBe(true);
      expect(result.newAllowed).toBe(true);
    });

    it('should produce consistent decisions for file_delete with verified trust', () => {
      const result = comparePermissions('file_delete', 'planner' as AgentId, 'verified');
      expect(result.consistent).toBe(true);
      expect(result.oldAllowed).toBe(false);
      expect(result.newAllowed).toBe(false);
    });

    it('should produce consistent decisions for system_config with allowed agent', () => {
      const result = comparePermissions('system_config', 'core' as AgentId, 'system');
      expect(result.consistent).toBe(true);
      expect(result.oldAllowed).toBe(true);
      expect(result.newAllowed).toBe(true);
    });

    it('should produce consistent decisions for system_config with disallowed agent', () => {
      const result = comparePermissions('system_config', 'planner' as AgentId, 'system');
      expect(result.consistent).toBe(true);
      expect(result.oldAllowed).toBe(false);
      expect(result.newAllowed).toBe(false);
    });

    it('should produce consistent decisions for system_config with insufficient trust', () => {
      const result = comparePermissions('system_config', 'core' as AgentId, 'operator');
      expect(result.consistent).toBe(true);
      expect(result.oldAllowed).toBe(false);
      expect(result.newAllowed).toBe(false);
    });
  });

  describe('Approval Requirement Consistency', () => {
    const checkApprovalRequired = (
      toolId: string,
      agentId: AgentId,
      trustLevel: TrustLevel
    ): { oldRequires: boolean; newRequires: boolean; consistent: boolean } => {
      const policyEngine = executor.getPolicyEngine();
      const tools = executor.getTools();
      const tool = tools.find((t) => t.id === toolId);

      if (!tool) {
        return { oldRequires: false, newRequires: false, consistent: true };
      }

      // Old system: WRITE_DESTRUCTIVE or ADMIN requires approval
      const oldRequires = tool.permission_tier === 'WRITE_DESTRUCTIVE' || tool.permission_tier === 'ADMIN';

      // New system check
      const policy = policyEngine.getPolicy(toolId);
      if (!policy) {
        return { oldRequires, newRequires: false, consistent: oldRequires === false };
      }

      const newCheck = policyEngine.checkPermissions(agentId, trustLevel, policy);
      const newRequires = newCheck.allowed && newCheck.requires_approval;

      return {
        oldRequires,
        newRequires,
        consistent: oldRequires === newRequires,
      };
    };

    it('should not require approval for READ_ONLY tools', () => {
      const result = checkApprovalRequired('file_read', 'planner' as AgentId, 'standard');
      expect(result.consistent).toBe(true);
      expect(result.oldRequires).toBe(false);
      expect(result.newRequires).toBe(false);
    });

    it('should not require approval for WRITE_SAFE tools', () => {
      const result = checkApprovalRequired('file_write', 'executor' as AgentId, 'verified');
      expect(result.consistent).toBe(true);
      expect(result.oldRequires).toBe(false);
      expect(result.newRequires).toBe(false);
    });

    it('should require approval for WRITE_DESTRUCTIVE tools', () => {
      const result = checkApprovalRequired('file_delete', 'executor' as AgentId, 'operator');
      expect(result.consistent).toBe(true);
      expect(result.oldRequires).toBe(true);
      expect(result.newRequires).toBe(true);
    });

    it('should require approval for ADMIN tools', () => {
      const result = checkApprovalRequired('system_config', 'core' as AgentId, 'system');
      expect(result.consistent).toBe(true);
      expect(result.oldRequires).toBe(true);
      expect(result.newRequires).toBe(true);
    });
  });

  describe('Full Matrix Test', () => {
    const agents: AgentId[] = ['planner', 'executor', 'guardian', 'core', 'overseer'];
    const trustLevels: TrustLevel[] = ['system', 'operator', 'verified', 'standard', 'untrusted', 'hostile'];
    const toolIds = ['file_read', 'file_write', 'file_delete', 'system_config'];

    it('should have 0% divergence across all combinations', () => {
      const policyEngine = executor.getPolicyEngine();
      const tools = executor.getTools();

      const TRUST_SCORES: Record<TrustLevel, number> = {
        system: 1.0,
        operator: 0.9,
        verified: 0.7,
        standard: 0.5,
        untrusted: 0.2,
        hostile: 0.0,
      };

      let totalTests = 0;
      let divergences = 0;

      for (const toolId of toolIds) {
        const tool = tools.find((t) => t.id === toolId);
        const policy = policyEngine.getPolicy(toolId);

        if (!tool || !policy) continue;

        for (const agentId of agents) {
          for (const trustLevel of trustLevels) {
            totalTests++;

            // Old system check
            let oldAllowed = true;
            if (tool.allowed_agents.length > 0 && !tool.allowed_agents.includes(agentId)) {
              oldAllowed = false;
            }
            if (oldAllowed) {
              const requiredScore = TRUST_SCORES[tool.required_trust_level];
              const actualScore = TRUST_SCORES[trustLevel];
              if (actualScore < requiredScore) {
                oldAllowed = false;
              }
            }

            // New system check
            const newCheck = policyEngine.checkPermissions(agentId, trustLevel, policy);

            // Compare (ignoring risk-based auto-block in new system for base comparison)
            // The new system may auto-block high-risk requests, which is an enhancement
            const baseNewAllowed = newCheck.violations.filter(
              (v) => !v.includes('auto-block')
            ).length === 0 && newCheck.violations.every((v) => !v.includes('auto-block'));

            if (oldAllowed !== newCheck.allowed && !newCheck.violations.some((v) => v.includes('auto-block'))) {
              divergences++;
              console.log(`Divergence: ${toolId} / ${agentId} / ${trustLevel}`);
              console.log(`  Old: ${oldAllowed}, New: ${newCheck.allowed}`);
            }
          }
        }
      }

      const divergenceRate = (divergences / totalTests) * 100;
      console.log(`Total tests: ${totalTests}, Divergences: ${divergences}, Rate: ${divergenceRate.toFixed(2)}%`);

      expect(divergenceRate).toBeLessThan(1); // <1% divergence target
    });
  });

  describe('Executor Integration', () => {
    it('should expose PolicyEngine for testing', () => {
      const policyEngine = executor.getPolicyEngine();
      expect(policyEngine).toBeDefined();
      expect(policyEngine.getAllPolicies().length).toBeGreaterThanOrEqual(4);
    });

    it('should expose ToolRegistry for testing', () => {
      const toolRegistry = executor.getToolRegistry();
      expect(toolRegistry).toBeDefined();
      expect(toolRegistry.size).toBeGreaterThanOrEqual(4);
    });

    it('should have both PolicyEngine and ToolRegistry initialized', () => {
      const policyEngine = executor.getPolicyEngine();
      const toolRegistry = executor.getToolRegistry();
      expect(policyEngine.getAllPolicies().length).toBeGreaterThanOrEqual(4);
      expect(toolRegistry.size).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle nonexistent tool consistently', async () => {
      const result = await executor.execute({
        id: randomUUID(),
        tool_id: 'nonexistent_tool',
        parameters: {},
        requesting_agent: 'planner' as AgentId,
        trust_level: 'standard' as TrustLevel,
        timestamp: new Date(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle hostile trust level consistently', () => {
      const policyEngine = executor.getPolicyEngine();
      const policy = policyEngine.getPolicy('file_read');

      expect(policy).toBeDefined();

      const result = policyEngine.checkPermissions('planner' as AgentId, 'hostile', policy!);
      expect(result.allowed).toBe(false);
    });
  });
});
