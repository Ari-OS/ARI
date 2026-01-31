import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { ToolExecutor } from '../../../src/execution/tool-executor.js';
import { ToolRegistry } from '../../../src/execution/tool-registry.js';
import { PolicyEngine } from '../../../src/governance/policy-engine.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import type { ToolCapability, PermissionTier, TrustLevel, AgentId } from '../../../src/kernel/types.js';
import type { ToolHandler } from '../../../src/execution/types.js';

describe('ToolExecutor', () => {
  let executor: ToolExecutor;
  let registry: ToolRegistry;
  let policyEngine: PolicyEngine;
  let auditLogger: AuditLogger;
  let eventBus: EventBus;
  let testAuditPath: string;

  const createCapability = (overrides: Partial<ToolCapability> = {}): ToolCapability => ({
    id: 'test_tool',
    name: 'Test Tool',
    description: 'A test tool',
    timeout_ms: 5000,
    sandboxed: true,
    parameters: {},
    ...overrides,
  });

  beforeEach(() => {
    testAuditPath = join(tmpdir(), `audit-${randomUUID()}.json`);
    auditLogger = new AuditLogger(testAuditPath);
    eventBus = new EventBus();
    registry = new ToolRegistry(auditLogger, eventBus);
    policyEngine = new PolicyEngine(auditLogger, eventBus);
    executor = new ToolExecutor(registry, policyEngine, auditLogger, eventBus);
  });

  describe('Successful Execution', () => {
    beforeEach(() => {
      // Register tool in registry
      registry.register(
        createCapability({
          id: 'echo_tool',
          parameters: { message: { type: 'string', required: true, description: 'Message' } },
        }),
        async (params) => ({ echo: params.message })
      );

      // Register policy
      policyEngine.registerPolicy({
        tool_id: 'echo_tool',
        permission_tier: 'READ_ONLY' as PermissionTier,
        required_trust_level: 'standard' as TrustLevel,
        allowed_agents: [],
      });
    });

    it('should execute tool with valid token', async () => {
      const params = { message: 'hello' };
      const token = await policyEngine.requestPermission(
        'echo_tool',
        'planner' as AgentId,
        params,
        'standard' as TrustLevel
      );

      const result = await executor.execute(token);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ echo: 'hello' });
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('should emit tool:start and tool:end events', async () => {
      const params = { message: 'test' };
      const token = await policyEngine.requestPermission(
        'echo_tool',
        'planner' as AgentId,
        params,
        'standard' as TrustLevel
      );

      const startEvents: unknown[] = [];
      const endEvents: unknown[] = [];
      eventBus.on('tool:start', (e) => startEvents.push(e));
      eventBus.on('tool:end', (e) => endEvents.push(e));

      await executor.execute(token);

      expect(startEvents.length).toBe(1);
      expect(endEvents.length).toBe(1);
      expect((endEvents[0] as { success: boolean }).success).toBe(true);
    });

    it('should include token_id in result', async () => {
      const params = { message: 'test' };
      const token = await policyEngine.requestPermission(
        'echo_tool',
        'planner' as AgentId,
        params,
        'standard' as TrustLevel
      );

      const result = await executor.execute(token);

      expect(result.token_id).toBe(token.token_id);
    });
  });

  describe('Token Verification', () => {
    beforeEach(() => {
      registry.register(createCapability({ id: 'secured_tool' }), async () => 'executed');
      policyEngine.registerPolicy({
        tool_id: 'secured_tool',
        permission_tier: 'READ_ONLY' as PermissionTier,
        required_trust_level: 'standard' as TrustLevel,
        allowed_agents: [],
      });
    });

    it('should reject invalid token', async () => {
      const token = await policyEngine.requestPermission(
        'secured_tool',
        'planner' as AgentId,
        {},
        'standard' as TrustLevel
      );

      // Corrupt the signature
      const invalidToken = { ...token, signature: 'invalid_signature' };

      const result = await executor.execute(invalidToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should reject used token (single-use)', async () => {
      const token = await policyEngine.requestPermission(
        'secured_tool',
        'planner' as AgentId,
        {},
        'standard' as TrustLevel
      );

      // First execution should succeed
      const result1 = await executor.execute(token);
      expect(result1.success).toBe(true);

      // Second execution should fail
      const result2 = await executor.execute(token);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Invalid');
    });
  });

  describe('Tool Not Found', () => {
    it('should fail when tool not in registry', async () => {
      // Register only policy, not in registry
      policyEngine.registerPolicy({
        tool_id: 'ghost_tool',
        permission_tier: 'READ_ONLY' as PermissionTier,
        required_trust_level: 'standard' as TrustLevel,
        allowed_agents: [],
      });

      const token = await policyEngine.requestPermission(
        'ghost_tool',
        'planner' as AgentId,
        {},
        'standard' as TrustLevel
      );

      const result = await executor.execute(token);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found in registry');
    });
  });

  describe('Parameter Validation', () => {
    beforeEach(() => {
      registry.register(
        createCapability({
          id: 'param_tool',
          parameters: {
            required_param: { type: 'string', required: true, description: 'Required' },
          },
        }),
        async (params) => params
      );
      policyEngine.registerPolicy({
        tool_id: 'param_tool',
        permission_tier: 'READ_ONLY' as PermissionTier,
        required_trust_level: 'standard' as TrustLevel,
        allowed_agents: [],
      });
    });

    it('should fail with invalid parameters', async () => {
      // Create token with missing required parameter
      const token = await policyEngine.requestPermission(
        'param_tool',
        'planner' as AgentId,
        {}, // Missing required_param
        'standard' as TrustLevel
      );

      const result = await executor.execute(token);

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout slow execution', async () => {
      registry.register(
        createCapability({
          id: 'slow_tool',
          timeout_ms: 100, // Very short timeout
        }),
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return 'should not reach';
        }
      );
      policyEngine.registerPolicy({
        tool_id: 'slow_tool',
        permission_tier: 'READ_ONLY' as PermissionTier,
        required_trust_level: 'standard' as TrustLevel,
        allowed_agents: [],
      });

      const token = await policyEngine.requestPermission(
        'slow_tool',
        'planner' as AgentId,
        {},
        'standard' as TrustLevel
      );

      const result = await executor.execute(token);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('Error Handling', () => {
    it('should capture handler errors', async () => {
      registry.register(
        createCapability({ id: 'error_tool' }),
        async () => {
          throw new Error('Handler exploded');
        }
      );
      policyEngine.registerPolicy({
        tool_id: 'error_tool',
        permission_tier: 'READ_ONLY' as PermissionTier,
        required_trust_level: 'standard' as TrustLevel,
        allowed_agents: [],
      });

      const token = await policyEngine.requestPermission(
        'error_tool',
        'planner' as AgentId,
        {},
        'standard' as TrustLevel
      );

      const result = await executor.execute(token);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Handler exploded');
    });

    it('should emit tool:end with error', async () => {
      registry.register(
        createCapability({ id: 'failing_tool' }),
        async () => {
          throw new Error('Failure');
        }
      );
      policyEngine.registerPolicy({
        tool_id: 'failing_tool',
        permission_tier: 'READ_ONLY' as PermissionTier,
        required_trust_level: 'standard' as TrustLevel,
        allowed_agents: [],
      });

      const endEvents: unknown[] = [];
      eventBus.on('tool:end', (e) => endEvents.push(e));

      const token = await policyEngine.requestPermission(
        'failing_tool',
        'planner' as AgentId,
        {},
        'standard' as TrustLevel
      );

      await executor.execute(token);

      expect(endEvents.length).toBe(1);
      expect((endEvents[0] as { success: boolean; error: string }).success).toBe(false);
      expect((endEvents[0] as { error: string }).error).toContain('Failure');
    });
  });

  describe('Concurrency Limit', () => {
    it('should track active executions', async () => {
      registry.register(
        createCapability({ id: 'tracked_tool' }),
        async () => {
          await new Promise((r) => setTimeout(r, 50));
          return 'done';
        }
      );
      policyEngine.registerPolicy({
        tool_id: 'tracked_tool',
        permission_tier: 'READ_ONLY' as PermissionTier,
        required_trust_level: 'standard' as TrustLevel,
        allowed_agents: [],
      });

      const token = await policyEngine.requestPermission(
        'tracked_tool',
        'planner' as AgentId,
        {},
        'standard' as TrustLevel
      );

      const promise = executor.execute(token);

      // Should be active during execution
      await new Promise((r) => setTimeout(r, 10));
      expect(executor.activeCount).toBe(1);

      await promise;

      // Should be cleared after
      expect(executor.activeCount).toBe(0);
    });

    it('should report capacity status', () => {
      expect(executor.atCapacity).toBe(false);
    });

    it('should reject when at capacity', async () => {
      // Register a slow tool
      registry.register(
        createCapability({ id: 'blocking_tool' }),
        async () => {
          await new Promise((r) => setTimeout(r, 1000));
          return 'done';
        }
      );
      policyEngine.registerPolicy({
        tool_id: 'blocking_tool',
        permission_tier: 'READ_ONLY' as PermissionTier,
        required_trust_level: 'standard' as TrustLevel,
        allowed_agents: [],
      });

      // Start 10 concurrent executions (max limit)
      const promises: Promise<unknown>[] = [];
      for (let i = 0; i < 10; i++) {
        const token = await policyEngine.requestPermission(
          'blocking_tool',
          'planner' as AgentId,
          {},
          'standard' as TrustLevel
        );
        promises.push(executor.execute(token));
      }

      // Wait for them to start
      await new Promise((r) => setTimeout(r, 10));

      // 11th should fail
      const token11 = await policyEngine.requestPermission(
        'blocking_tool',
        'planner' as AgentId,
        {},
        'standard' as TrustLevel
      );

      const result = await executor.execute(token11);
      expect(result.success).toBe(false);
      expect(result.error).toContain('concurrent');

      // Clean up - abort all
      executor.getActiveExecutions().forEach((e) => executor.abort(e.callId));
    });
  });

  describe('Abort', () => {
    it('should abort active execution', async () => {
      registry.register(
        createCapability({ id: 'abortable_tool' }),
        async () => {
          await new Promise((r) => setTimeout(r, 5000));
          return 'should not reach';
        }
      );
      policyEngine.registerPolicy({
        tool_id: 'abortable_tool',
        permission_tier: 'READ_ONLY' as PermissionTier,
        required_trust_level: 'standard' as TrustLevel,
        allowed_agents: [],
      });

      const token = await policyEngine.requestPermission(
        'abortable_tool',
        'planner' as AgentId,
        {},
        'standard' as TrustLevel
      );

      const promise = executor.execute(token, { callId: 'test-call-id' });

      await new Promise((r) => setTimeout(r, 10));

      const aborted = executor.abort('test-call-id');
      expect(aborted).toBe(true);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('aborted');
    });

    it('should return false for nonexistent call', () => {
      const aborted = executor.abort('nonexistent');
      expect(aborted).toBe(false);
    });
  });

  describe('Async Handler Support', () => {
    it('should handle async handlers', async () => {
      registry.register(
        createCapability({ id: 'async_tool' }),
        async (params) => {
          await new Promise((r) => setTimeout(r, 10));
          return { async: true, params };
        }
      );
      policyEngine.registerPolicy({
        tool_id: 'async_tool',
        permission_tier: 'READ_ONLY' as PermissionTier,
        required_trust_level: 'standard' as TrustLevel,
        allowed_agents: [],
      });

      const token = await policyEngine.requestPermission(
        'async_tool',
        'planner' as AgentId,
        { key: 'value' },
        'standard' as TrustLevel
      );

      const result = await executor.execute(token);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ async: true, params: { key: 'value' } });
    });
  });
});
