import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { writeFileSync, unlinkSync } from 'fs';
import { PolicyEngine } from '../../../src/governance/policy-engine.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import type { AgentId, TrustLevel, PermissionTier, ToolPolicy } from '../../../src/kernel/types.js';

describe('PolicyEngine', () => {
  let policyEngine: PolicyEngine;
  let auditLogger: AuditLogger;
  let eventBus: EventBus;
  let testAuditPath: string;

  const createPolicy = (overrides: Partial<ToolPolicy> = {}): ToolPolicy => ({
    tool_id: 'test_tool',
    permission_tier: 'READ_ONLY' as PermissionTier,
    required_trust_level: 'standard' as TrustLevel,
    allowed_agents: [],
    ...overrides,
  });

  beforeEach(() => {
    testAuditPath = join(tmpdir(), `audit-${randomUUID()}.json`);
    auditLogger = new AuditLogger(testAuditPath);
    eventBus = new EventBus();
    policyEngine = new PolicyEngine(auditLogger, eventBus);
  });

  describe('Policy Registration', () => {
    it('should register a policy', () => {
      const policy = createPolicy({ tool_id: 'file_read' });
      policyEngine.registerPolicy(policy);

      expect(policyEngine.getPolicy('file_read')).toEqual(policy);
    });

    it('should return undefined for unregistered policy', () => {
      expect(policyEngine.getPolicy('nonexistent')).toBeUndefined();
    });

    it('should list all registered policies', () => {
      policyEngine.registerPolicy(createPolicy({ tool_id: 'tool_1' }));
      policyEngine.registerPolicy(createPolicy({ tool_id: 'tool_2' }));

      const policies = policyEngine.getAllPolicies();
      expect(policies).toHaveLength(2);
      expect(policies.map((p) => p.tool_id)).toContain('tool_1');
      expect(policies.map((p) => p.tool_id)).toContain('tool_2');
    });
  });

  describe('Permission Check - Layer 1: Agent Allowlist', () => {
    it('should allow agent in allowlist', () => {
      const policy = createPolicy({
        allowed_agents: ['planner', 'executor'] as AgentId[],
      });

      const result = policyEngine.checkPermissions('planner' as AgentId, 'standard', policy);
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should deny agent not in allowlist', () => {
      const policy = createPolicy({
        allowed_agents: ['planner', 'executor'] as AgentId[],
      });

      const result = policyEngine.checkPermissions('guardian' as AgentId, 'standard', policy);
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes('allowlist'))).toBe(true);
    });

    it('should allow any agent when allowlist is empty', () => {
      const policy = createPolicy({ allowed_agents: [] });

      const result = policyEngine.checkPermissions('guardian' as AgentId, 'standard', policy);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Permission Check - Layer 2: Trust Level', () => {
    it('should allow when trust level meets requirement', () => {
      const policy = createPolicy({
        required_trust_level: 'verified' as TrustLevel,
      });

      const result = policyEngine.checkPermissions('planner' as AgentId, 'operator', policy);
      expect(result.allowed).toBe(true);
    });

    it('should deny when trust level is insufficient', () => {
      const policy = createPolicy({
        required_trust_level: 'verified' as TrustLevel,
      });

      const result = policyEngine.checkPermissions('planner' as AgentId, 'standard', policy);
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes('insufficient'))).toBe(true);
    });

    it('should allow system trust for any requirement', () => {
      const policy = createPolicy({
        required_trust_level: 'operator' as TrustLevel,
      });

      const result = policyEngine.checkPermissions('planner' as AgentId, 'system', policy);
      expect(result.allowed).toBe(true);
    });

    it('should deny hostile trust level', () => {
      const policy = createPolicy({
        required_trust_level: 'untrusted' as TrustLevel,
      });

      const result = policyEngine.checkPermissions('planner' as AgentId, 'hostile', policy);
      expect(result.allowed).toBe(false);
    });
  });

  describe('Permission Check - Layer 3: Permission Tier', () => {
    it('should not require approval for READ_ONLY', () => {
      const policy = createPolicy({ permission_tier: 'READ_ONLY' as PermissionTier });

      const result = policyEngine.checkPermissions('planner' as AgentId, 'standard', policy);
      expect(result.requires_approval).toBe(false);
    });

    it('should not require approval for WRITE_SAFE', () => {
      const policy = createPolicy({ permission_tier: 'WRITE_SAFE' as PermissionTier });

      const result = policyEngine.checkPermissions('planner' as AgentId, 'standard', policy);
      expect(result.requires_approval).toBe(false);
    });

    it('should require approval for WRITE_DESTRUCTIVE', () => {
      const policy = createPolicy({ permission_tier: 'WRITE_DESTRUCTIVE' as PermissionTier });

      const result = policyEngine.checkPermissions('planner' as AgentId, 'operator', policy);
      expect(result.allowed).toBe(true);
      expect(result.requires_approval).toBe(true);
    });

    it('should require approval for ADMIN', () => {
      const policy = createPolicy({ permission_tier: 'ADMIN' as PermissionTier });

      const result = policyEngine.checkPermissions('planner' as AgentId, 'system', policy);
      expect(result.allowed).toBe(true);
      expect(result.requires_approval).toBe(true);
    });
  });

  describe('Risk Score Calculation', () => {
    it('should calculate lower risk for READ_ONLY with system trust', () => {
      const policy = createPolicy({ permission_tier: 'READ_ONLY' as PermissionTier });

      const result = policyEngine.checkPermissions('planner' as AgentId, 'system', policy);
      expect(result.risk_score).toBeLessThan(0.1);
    });

    it('should calculate higher risk for ADMIN with untrusted', () => {
      const policy = createPolicy({
        permission_tier: 'ADMIN' as PermissionTier,
        required_trust_level: 'untrusted' as TrustLevel, // Allow untrusted for test
      });

      const result = policyEngine.checkPermissions('planner' as AgentId, 'untrusted', policy);
      // 0.9 * 1.5 = 1.35, capped at 1.0, but auto-blocked at 0.8
      expect(result.risk_score).toBeGreaterThanOrEqual(0.8);
      expect(result.allowed).toBe(false); // Auto-blocked
    });

    it('should auto-block when risk >= 0.8', () => {
      const policy = createPolicy({
        permission_tier: 'WRITE_DESTRUCTIVE' as PermissionTier,
        required_trust_level: 'hostile' as TrustLevel, // Allow hostile for test
      });

      const result = policyEngine.checkPermissions('planner' as AgentId, 'hostile', policy);
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes('auto-block'))).toBe(true);
    });
  });

  describe('Permission Request', () => {
    beforeEach(() => {
      policyEngine.registerPolicy(createPolicy({ tool_id: 'read_tool' }));
    });

    it('should auto-approve READ_ONLY requests', async () => {
      const token = await policyEngine.requestPermission(
        'read_tool',
        'planner' as AgentId,
        { path: '/test' },
        'standard' as TrustLevel
      );

      expect(token.tool_id).toBe('read_tool');
      expect(token.agent_id).toBe('planner');
      expect(token.approved_by).toBeNull(); // Auto-approved
      expect(token.signature).toBeDefined();
    });

    it('should throw for unregistered tool', async () => {
      await expect(
        policyEngine.requestPermission(
          'nonexistent',
          'planner' as AgentId,
          {},
          'standard' as TrustLevel
        )
      ).rejects.toThrow('No policy found');
    });

    it('should throw for insufficient trust', async () => {
      policyEngine.registerPolicy(
        createPolicy({
          tool_id: 'verified_tool',
          required_trust_level: 'verified' as TrustLevel,
        })
      );

      await expect(
        policyEngine.requestPermission(
          'verified_tool',
          'planner' as AgentId,
          {},
          'standard' as TrustLevel
        )
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('Token Generation and Verification', () => {
    beforeEach(() => {
      policyEngine.registerPolicy(createPolicy({ tool_id: 'test_tool' }));
    });

    it('should generate valid token', async () => {
      const params = { key: 'value' };
      const token = await policyEngine.requestPermission(
        'test_tool',
        'planner' as AgentId,
        params,
        'standard' as TrustLevel
      );

      expect(token.token_id).toBeDefined();
      expect(token.parameters_hash).toBeDefined();
      expect(token.issued_at).toBeDefined();
      expect(token.expires_at).toBeDefined();
      expect(token.signature).toBeDefined();
    });

    it('should verify valid token', async () => {
      const params = { key: 'value' };
      const token = await policyEngine.requestPermission(
        'test_tool',
        'planner' as AgentId,
        params,
        'standard' as TrustLevel
      );

      expect(policyEngine.verifyToken(token, params)).toBe(true);
    });

    it('should reject token with wrong parameters', async () => {
      const params = { key: 'value' };
      const token = await policyEngine.requestPermission(
        'test_tool',
        'planner' as AgentId,
        params,
        'standard' as TrustLevel
      );

      expect(policyEngine.verifyToken(token, { key: 'different' })).toBe(false);
    });

    it('should reject used token', async () => {
      const params = { key: 'value' };
      const token = await policyEngine.requestPermission(
        'test_tool',
        'planner' as AgentId,
        params,
        'standard' as TrustLevel
      );

      policyEngine.markTokenUsed(token.token_id);
      expect(policyEngine.verifyToken(token, params)).toBe(false);
    });

    it('should reject expired token', async () => {
      const params = { key: 'value' };
      const token = await policyEngine.requestPermission(
        'test_tool',
        'planner' as AgentId,
        params,
        'standard' as TrustLevel
      );

      // Manually expire the token
      const expiredToken = {
        ...token,
        expires_at: new Date(Date.now() - 1000).toISOString(),
      };

      expect(policyEngine.verifyToken(expiredToken, params)).toBe(false);
    });
  });

  describe('Approval Workflow', () => {
    // Helper to wait for pending approval to be registered
    const waitForPendingApproval = async (maxWait = 500): Promise<void> => {
      const start = Date.now();
      while (Date.now() - start < maxWait) {
        if (policyEngine.getPendingApprovals().length > 0) return;
        await new Promise((r) => setTimeout(r, 5));
      }
    };

    beforeEach(() => {
      policyEngine.registerPolicy(
        createPolicy({
          tool_id: 'destructive_tool',
          permission_tier: 'WRITE_DESTRUCTIVE' as PermissionTier,
          required_trust_level: 'operator' as TrustLevel,
        })
      );
    });

    it('should queue request for approval', async () => {
      const requestPromise = policyEngine.requestPermission(
        'destructive_tool',
        'planner' as AgentId,
        { target: '/important' },
        'operator' as TrustLevel
      );

      await waitForPendingApproval();

      const pending = policyEngine.getPendingApprovals();
      expect(pending.length).toBe(1);
      expect(pending[0].tool_id).toBe('destructive_tool');

      // Clean up by rejecting
      await policyEngine.reject(pending[0].request_id, 'arbiter' as AgentId, 'Test cleanup');
      await expect(requestPromise).rejects.toThrow('Test cleanup');
    });

    it('should issue token on approval', async () => {
      const requestPromise = policyEngine.requestPermission(
        'destructive_tool',
        'planner' as AgentId,
        { target: '/important' },
        'operator' as TrustLevel
      );

      await waitForPendingApproval();

      const pending = policyEngine.getPendingApprovals();
      expect(pending.length).toBeGreaterThan(0);
      await policyEngine.approve(pending[0].request_id, 'arbiter' as AgentId, 'Approved for test');

      const token = await requestPromise;
      expect(token.approved_by).toBe('arbiter');
      expect(token.approval_reasoning).toBe('Approved for test');
    });

    it('should reject request on rejection', async () => {
      const requestPromise = policyEngine.requestPermission(
        'destructive_tool',
        'planner' as AgentId,
        { target: '/important' },
        'operator' as TrustLevel
      );

      await waitForPendingApproval();

      const pending = policyEngine.getPendingApprovals();
      expect(pending.length).toBeGreaterThan(0);
      await policyEngine.reject(pending[0].request_id, 'overseer' as AgentId, 'Security concern');

      await expect(requestPromise).rejects.toThrow('Security concern');
    });

    it('should only allow authorized approvers', async () => {
      const requestPromise = policyEngine.requestPermission(
        'destructive_tool',
        'planner' as AgentId,
        { target: '/important' },
        'operator' as TrustLevel
      );

      await waitForPendingApproval();

      const pending = policyEngine.getPendingApprovals();
      expect(pending.length).toBeGreaterThan(0);

      await expect(
        policyEngine.approve(pending[0].request_id, 'planner' as AgentId, 'Self-approval attempt')
      ).rejects.toThrow('not authorized');

      // Clean up
      await policyEngine.reject(pending[0].request_id, 'arbiter' as AgentId, 'Cleanup');
      await expect(requestPromise).rejects.toThrow();
    });

    it('should throw when approving nonexistent request', async () => {
      await expect(
        policyEngine.approve('nonexistent-id', 'arbiter' as AgentId, 'No such request')
      ).rejects.toThrow('No pending approval');
    });

    it('should throw when rejecting nonexistent request', async () => {
      await expect(
        policyEngine.reject('nonexistent-id', 'arbiter' as AgentId, 'No such request')
      ).rejects.toThrow('No pending approval');
    });
  });

  describe('Event Emission', () => {
    it('should emit permission:granted for auto-approved', async () => {
      policyEngine.registerPolicy(createPolicy({ tool_id: 'simple_tool' }));

      const events: unknown[] = [];
      eventBus.on('permission:granted', (e) => events.push(e));

      await policyEngine.requestPermission(
        'simple_tool',
        'planner' as AgentId,
        {},
        'standard' as TrustLevel
      );

      expect(events.length).toBe(1);
      expect((events[0] as { autoApproved: boolean }).autoApproved).toBe(true);
    });

    it('should emit permission:denied for rejected', async () => {
      policyEngine.registerPolicy(
        createPolicy({
          tool_id: 'restricted_tool',
          allowed_agents: ['core'] as AgentId[],
        })
      );

      const events: unknown[] = [];
      eventBus.on('permission:denied', (e) => events.push(e));

      await expect(
        policyEngine.requestPermission(
          'restricted_tool',
          'planner' as AgentId,
          {},
          'standard' as TrustLevel
        )
      ).rejects.toThrow();

      expect(events.length).toBe(1);
    });

    it('should emit permission:approval_required', async () => {
      policyEngine.registerPolicy(
        createPolicy({
          tool_id: 'needs_approval',
          permission_tier: 'ADMIN' as PermissionTier,
          required_trust_level: 'system' as TrustLevel,
        })
      );

      // Use a promise to wait for the event
      const eventPromise = new Promise<void>((resolve) => {
        eventBus.on('permission:approval_required', () => resolve());
      });

      const requestPromise = policyEngine.requestPermission(
        'needs_approval',
        'core' as AgentId,
        {},
        'system' as TrustLevel
      );

      // Wait for the event with a timeout
      await Promise.race([
        eventPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Event timeout')), 1000)),
      ]);

      // Cleanup
      const pending = policyEngine.getPendingApprovals();
      expect(pending.length).toBeGreaterThan(0);
      await policyEngine.reject(pending[0].request_id, 'arbiter' as AgentId, 'Cleanup');
      await expect(requestPromise).rejects.toThrow();
    });
  });

  describe('Config Loading', () => {
    let configPath: string;

    beforeEach(() => {
      configPath = join(tmpdir(), `tool-policies-${randomUUID()}.json`);
    });

    afterEach(() => {
      try {
        unlinkSync(configPath);
      } catch {
        // File may not exist
      }
    });

    it('should load policies from config file', () => {
      const config = {
        version: '1.0.0',
        description: 'Test policies',
        policies: [
          {
            tool_id: 'policy_tool_1',
            permission_tier: 'READ_ONLY',
            required_trust_level: 'standard',
            allowed_agents: [],
          },
          {
            tool_id: 'policy_tool_2',
            permission_tier: 'WRITE_DESTRUCTIVE',
            required_trust_level: 'operator',
            allowed_agents: ['core', 'overseer'],
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));

      const loaded = policyEngine.loadPoliciesFromConfig(configPath);

      expect(loaded).toBe(2);
      expect(policyEngine.getPolicy('policy_tool_1')).toBeDefined();
      expect(policyEngine.getPolicy('policy_tool_2')).toBeDefined();
    });

    it('should correctly parse permission tiers', () => {
      const config = {
        version: '1.0.0',
        description: 'Test policies',
        policies: [
          {
            tool_id: 'admin_tool',
            permission_tier: 'ADMIN',
            required_trust_level: 'system',
            allowed_agents: [],
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));
      policyEngine.loadPoliciesFromConfig(configPath);

      const policy = policyEngine.getPolicy('admin_tool');
      expect(policy?.permission_tier).toBe('ADMIN');
      expect(policy?.required_trust_level).toBe('system');
    });

    it('should correctly parse allowed agents', () => {
      const config = {
        version: '1.0.0',
        description: 'Test policies',
        policies: [
          {
            tool_id: 'restricted_tool',
            permission_tier: 'READ_ONLY',
            required_trust_level: 'standard',
            allowed_agents: ['planner', 'executor', 'guardian'],
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));
      policyEngine.loadPoliciesFromConfig(configPath);

      const policy = policyEngine.getPolicy('restricted_tool');
      expect(policy?.allowed_agents).toEqual(['planner', 'executor', 'guardian']);
    });

    it('should handle rate limits from config', () => {
      const config = {
        version: '1.0.0',
        description: 'Test policies',
        policies: [
          {
            tool_id: 'rate_limited_tool',
            permission_tier: 'READ_ONLY',
            required_trust_level: 'standard',
            allowed_agents: [],
            rate_limit: 100,
          },
        ],
      };

      writeFileSync(configPath, JSON.stringify(config));
      policyEngine.loadPoliciesFromConfig(configPath);

      const policy = policyEngine.getPolicy('rate_limited_tool');
      expect(policy?.rate_limit).toBe(100);
    });
  });
});
