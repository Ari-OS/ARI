import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Core } from '../../../src/agents/core.js';
import { Guardian } from '../../../src/agents/guardian.js';
import { MemoryManager } from '../../../src/agents/memory-manager.js';
import { Executor } from '../../../src/agents/executor.js';
import { PolicyEngine } from '../../../src/governance/policy-engine.js';
import { Planner } from '../../../src/agents/planner.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import type { TrustLevel, Message } from '../../../src/kernel/types.js';

describe('Core', () => {
  let core: Core;
  let guardian: Guardian;
  let memoryManager: MemoryManager;
  let executor: Executor;
  let planner: Planner;
  let auditLogger: AuditLogger;
  let eventBus: EventBus;
  let testAuditPath: string;

  beforeEach(() => {
    testAuditPath = join(tmpdir(), `audit-${randomUUID()}.json`);
    auditLogger = new AuditLogger(testAuditPath);
    eventBus = new EventBus();

    guardian = new Guardian(auditLogger, eventBus);
    memoryManager = new MemoryManager(auditLogger, eventBus);
    executor = new Executor(auditLogger, eventBus, new PolicyEngine(auditLogger, eventBus));
    planner = new Planner(auditLogger, eventBus);

    core = new Core(auditLogger, eventBus, {
      guardian,
      memoryManager,
      executor,
      planner,
    });
  });

  it('should emit agent:started event when started', async () => {
    const handler = vi.fn();
    eventBus.on('agent:started', handler);

    await core.start();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'core',
      })
    );
  });

  it('should throw error when starting twice', async () => {
    await core.start();

    await expect(core.start()).rejects.toThrow();
  });

  it('should emit agent:stopped event when stopped', async () => {
    await core.start();

    const handler = vi.fn();
    eventBus.on('agent:stopped', handler);

    await core.stop('Test stop');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'core',
        reason: 'Test stop',
      })
    );
  });

  it('should return healthy status with all components', async () => {
    await core.start();

    // Add a memory entry so memory_manager is not degraded
    await memoryManager.store({
      type: 'FACT',
      content: 'Test fact for status check',
      provenance: {
        source: 'test',
        trust_level: 'verified',
        agent: 'core',
        chain: ['core'],
      },
      confidence: 0.9,
      partition: 'PUBLIC',
    });

    const status = core.getStatus();

    expect(status.overall).toBe('healthy');
    expect(status.components).toBeDefined();
    expect(Array.isArray(status.components)).toBe(true);
    expect(status.components.length).toBeGreaterThan(0);
    expect(status.timestamp).toBeInstanceOf(Date);

    // Check that guardian, memory_manager, executor, planner are in components
    const componentNames = status.components.map((c) => c.name);
    expect(componentNames).toContain('guardian');
    expect(componentNames).toContain('memory_manager');
    expect(componentNames).toContain('executor');
    expect(componentNames).toContain('planner');
  });

  it('should block dangerous content and return blocked result', async () => {
    await core.start();

    // Mock guardian's assessThreat to return should_block = true
    const originalAssessThreat = guardian.assessThreat.bind(guardian);
    guardian.assessThreat = vi.fn((content: string, source: TrustLevel) => {
      if (content.includes('malicious')) {
        return {
          threat_level: 'critical',
          risk_score: 0.95,
          patterns_detected: ['command_injection'],
          should_block: true,
          should_escalate: true,
        };
      }
      return originalAssessThreat(content, source);
    });

    const message: Message = {
      id: randomUUID(),
      content: 'malicious command: ; rm -rf /',
      source: 'hostile' as TrustLevel,
      timestamp: new Date(),
    };

    const result = await core.processMessage(message);

    // Verify guardian was called
    expect(guardian.assessThreat).toHaveBeenCalledWith(message.content, message.source);

    // Result should indicate blocked
    expect(result.blocked).toBe(true);
    expect(result.threat_level).toBe('critical');
    expect(result.tasks_executed).toBe(0);

    // The message should have been blocked, so no plan should be created
    const plans = planner.getPlans();
    const recentPlans = plans.filter(
      (p) => p.created_at && new Date(p.created_at).getTime() > Date.now() - 5000
    );
    expect(recentPlans.length).toBe(0);
  });

  it('should create plan and execute tasks for safe content', async () => {
    await core.start();

    const message: Message = {
      id: randomUUID(),
      content: 'Please create a plan for building a web application',
      source: 'verified' as TrustLevel,
      timestamp: new Date(),
    };

    const result = await core.processMessage(message);

    // Result should indicate successful processing
    expect(result.blocked).toBe(false);
    expect(result.plan_id).toBeDefined();
    expect(result.tasks_executed).toBeGreaterThanOrEqual(1);

    // Should have created a plan with tasks
    const plans = planner.getPlans();
    expect(plans.length).toBeGreaterThan(0);

    const plan = planner.getPlan(result.plan_id!);
    expect(plan).toBeDefined();
    expect(plan!.tasks.length).toBeGreaterThan(0);
  });

  it('should emit message:accepted for SystemRouter routing', async () => {
    await core.start();

    const handler = vi.fn();
    eventBus.on('message:accepted', handler);

    const message: Message = {
      id: randomUUID(),
      content: 'Route this message to the correct context',
      source: 'operator' as TrustLevel,
      timestamp: new Date(),
    };

    await core.processMessage(message);

    // Core should have emitted message:accepted for the SystemRouter
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        id: message.id,
        content: message.content,
      })
    );
  });

  it('should not emit message:accepted for blocked content', async () => {
    await core.start();

    // Mock guardian to block
    guardian.assessThreat = vi.fn(() => ({
      threat_level: 'critical' as const,
      risk_score: 0.95,
      patterns_detected: ['command_injection'],
      should_block: true,
      should_escalate: true,
    }));

    const handler = vi.fn();
    eventBus.on('message:accepted', handler);

    const message: Message = {
      id: randomUUID(),
      content: 'blocked content',
      source: 'hostile' as TrustLevel,
      timestamp: new Date(),
    };

    await core.processMessage(message);

    // Should NOT have emitted message:accepted since it was blocked
    expect(handler).not.toHaveBeenCalled();
  });

  it('should set governance components', () => {
    const mockCouncil = { name: 'council' };
    const mockArbiter = { name: 'arbiter' };
    const mockOverseer = { name: 'overseer' };

    // Should not throw
    core.setGovernance({
      council: mockCouncil,
      arbiter: mockArbiter,
      overseer: mockOverseer,
    });
  });
});
