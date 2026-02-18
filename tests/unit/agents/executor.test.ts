import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Executor } from '../../../src/agents/executor.js';
import { PolicyEngine } from '../../../src/governance/policy-engine.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import type { AgentId, TrustLevel, ToolDefinition, PermissionTier } from '../../../src/kernel/types.js';

describe('Executor', () => {
  let executor: Executor;
  let auditLogger: AuditLogger;
  let eventBus: EventBus;
  let testAuditPath: string;

  beforeEach(() => {
    testAuditPath = join(tmpdir(), `audit-${randomUUID()}.json`);
    auditLogger = new AuditLogger(testAuditPath);
    eventBus = new EventBus();
    executor = new Executor(auditLogger, eventBus, new PolicyEngine(auditLogger, eventBus));
  });

  it('should have 8 built-in tools registered after construction', () => {
    const tools = executor.getTools();

    expect(tools).toHaveLength(8);

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('Read File');
    expect(toolNames).toContain('Write File');
    expect(toolNames).toContain('Delete File');
    expect(toolNames).toContain('System Configuration');
    expect(toolNames).toContain('Web Navigate');
    expect(toolNames).toContain('Web Search');
    expect(toolNames).toContain('Web Screenshot');
    expect(toolNames).toContain('Web Extract');
  });

  it('should execute file_read with standard trust successfully', async () => {
    const callId = randomUUID();
    const result = await executor.execute({
      id: callId,
      tool_id: 'file_read',
      parameters: { path: '/tmp/test.txt' },
      requesting_agent: 'planner' as AgentId,
      trust_level: 'standard' as TrustLevel,
      timestamp: new Date(),
    });

    expect(result.success).toBeDefined();
    expect(result.tool_call_id).toBe(callId);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('should fail to execute file_read with untrusted trust level', async () => {
    const callId = randomUUID();
    const result = await executor.execute({
      id: callId,
      tool_id: 'file_read',
      parameters: { path: '/tmp/test.txt' },
      requesting_agent: 'planner' as AgentId,
      trust_level: 'untrusted' as TrustLevel,
      timestamp: new Date(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('trust');
  });

  it('should return error when executing non-existent tool', async () => {
    const callId = randomUUID();
    const result = await executor.execute({
      id: callId,
      tool_id: 'non_existent_tool',
      parameters: {},
      requesting_agent: 'planner' as AgentId,
      trust_level: 'verified' as TrustLevel,
      timestamp: new Date(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
  });

  it('should deny agent not in allowlist for system_config', async () => {
    const callId = randomUUID();
    const result = await executor.execute({
      id: callId,
      tool_id: 'system_config',
      parameters: { key: 'test' },
      requesting_agent: 'guardian' as AgentId,
      trust_level: 'system' as TrustLevel,
      timestamp: new Date(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('allowlist');
  });

  it('should fail when trust level is insufficient for file_write', async () => {
    const callId = randomUUID();
    const result = await executor.execute({
      id: callId,
      tool_id: 'file_write',
      parameters: { path: '/tmp/test.txt', content: 'test' },
      requesting_agent: 'planner' as AgentId,
      trust_level: 'standard' as TrustLevel, // file_write requires 'verified'
      timestamp: new Date(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('insufficient');
  });

  it('should require approval for file_delete (WRITE_DESTRUCTIVE tier)', async () => {
    const callId = randomUUID();

    // Start execution but don't await - it will wait for approval
    const executePromise = executor.execute({
      id: callId,
      tool_id: 'file_delete',
      parameters: { path: '/tmp/test.txt' },
      requesting_agent: 'executor' as AgentId,
      trust_level: 'operator' as TrustLevel,
      timestamp: new Date(),
    });

    // Give it a moment to register the pending approval
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should now be in pending approvals
    const pending = executor.getPendingApprovals();
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.some((p) => p.callId === callId)).toBe(true);

    // Clean up by rejecting to prevent timeout
    await executor.reject(callId, 'Test cleanup');

    // The promise should now reject
    await expect(executePromise).rejects.toThrow();
  });

  it('should execute pending call successfully after approval', async () => {
    const callId = randomUUID();
    const testFilePath = join(tmpdir(), `delete-test-${randomUUID()}.txt`);
    // Create the file so file_delete can succeed
    const { writeFileSync } = await import('node:fs');
    writeFileSync(testFilePath, 'test content');

    // Start execution but don't await
    const executePromise = executor.execute({
      id: callId,
      tool_id: 'file_delete',
      parameters: { path: testFilePath },
      requesting_agent: 'executor' as AgentId,
      trust_level: 'operator' as TrustLevel,
      timestamp: new Date(),
    });

    // Give it a moment to register
    await new Promise(resolve => setTimeout(resolve, 10));

    // Approve it
    await executor.approve(callId, 'overseer' as AgentId);

    // Now the promise should resolve
    const result = await executePromise;
    expect(result.success).toBe(true);
    expect(result.approved_by).toBe('overseer');

    // Check it's no longer pending
    const pending = executor.getPendingApprovals();
    expect(pending.some((p) => p.callId === callId)).toBe(false);
  });

  it('should remove pending call when rejected', async () => {
    const callId = randomUUID();

    // Start execution but don't await
    const executePromise = executor.execute({
      id: callId,
      tool_id: 'file_delete',
      parameters: { path: '/tmp/test.txt' },
      requesting_agent: 'executor' as AgentId,
      trust_level: 'operator' as TrustLevel,
      timestamp: new Date(),
    });

    // Give it a moment to register
    await new Promise(resolve => setTimeout(resolve, 10));

    const pendingBefore = executor.getPendingApprovals();
    expect(pendingBefore.some((p) => p.callId === callId)).toBe(true);

    // Reject it
    await executor.reject(callId, 'Security concern');

    // Check it's no longer pending
    const pendingAfter = executor.getPendingApprovals();
    expect(pendingAfter.some((p) => p.callId === callId)).toBe(false);

    // The promise should reject
    await expect(executePromise).rejects.toThrow('Security concern');
  });

  it('should enforce maximum concurrent executions', async () => {
    // Register a slow tool in both old and new systems
    const slowTool: ToolDefinition = {
      id: 'slow_tool',
      name: 'slow_tool',
      description: 'A slow tool for testing',
      permission_tier: 'READ_ONLY' as PermissionTier,
      required_trust_level: 'standard' as TrustLevel,
      allowed_agents: ['planner', 'executor'] as AgentId[],
      timeout_ms: 5000,
      sandboxed: false,
      parameters: {},
    };

    executor.registerTool(slowTool);

    // Also register in PolicyEngine (required since new system is default)
    const policyEngine = executor.getPolicyEngine();
    policyEngine.registerPolicy({
      tool_id: 'slow_tool',
      permission_tier: 'READ_ONLY',
      required_trust_level: 'standard',
      allowed_agents: ['planner', 'executor'],
    });

    // Try to execute many calls at once
    const promises = Array.from({ length: 20 }, (_, i) =>
      executor.execute({
        id: randomUUID(),
        tool_id: 'slow_tool',
        parameters: {},
        requesting_agent: 'planner' as AgentId,
        trust_level: 'standard' as TrustLevel,
        timestamp: new Date(),
      })
    );

    const results = await Promise.all(promises);

    // Some should fail due to concurrency limits
    const failed = results.filter((r) => !r.success && r.error?.includes('concurrent'));
    expect(failed.length).toBeGreaterThan(0);
  });
});
