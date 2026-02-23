import { describe, it, expect, beforeEach } from 'vitest';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { EventBus } from '../../src/kernel/event-bus.js';
import { AuditLogger } from '../../src/kernel/audit.js';
import { Guardian } from '../../src/agents/guardian.js';
import { MemoryManager } from '../../src/agents/memory-manager.js';
import { Executor } from '../../src/agents/executor.js';
import { PolicyEngine } from '../../src/governance/policy-engine.js';
import { Planner } from '../../src/agents/planner.js';
import { Core } from '../../src/agents/core.js';
import { Arbiter } from '../../src/governance/arbiter.js';
import { Overseer } from '../../src/governance/overseer.js';
import { Council } from '../../src/governance/council.js';
import type { Message, AgentId, VoteOption } from '../../src/kernel/types.js';
import { VOTING_AGENTS } from '../../src/kernel/types.js';

describe('Pipeline Integration', () => {
  let eventBus: EventBus;
  let audit: AuditLogger;
  let guardian: Guardian;
  let memoryManager: MemoryManager;
  let executor: Executor;
  let planner: Planner;
  let core: Core;
  let tmpPath: string;

  beforeEach(() => {
    tmpPath = join(tmpdir(), `ari-test-${randomUUID()}.json`);
    eventBus = new EventBus();
    audit = new AuditLogger(tmpPath);
    guardian = new Guardian(audit, eventBus);
    memoryManager = new MemoryManager(audit, eventBus);
    executor = new Executor(audit, eventBus, new PolicyEngine(audit, eventBus));
    planner = new Planner(audit, eventBus);
    core = new Core(audit, eventBus, { guardian, memoryManager, executor, planner });
  });

  it('should start full system and emit agent:started event', async () => {
    const startedAgents: AgentId[] = [];

    eventBus.on('agent:started', (payload) => {
      startedAgents.push(payload.agent);
    });

    await core.start();

    expect(startedAgents).toContain('core');
    expect(startedAgents.length).toBeGreaterThan(0);

    await core.stop();
  });

  it('should stop full system cleanly', async () => {
    await core.start();

    const stoppedAgents: AgentId[] = [];
    eventBus.on('agent:stopped', (payload) => {
      stoppedAgents.push(payload.agent);
    });

    await core.stop();

    expect(stoppedAgents).toContain('core');
    expect(stoppedAgents.length).toBeGreaterThan(0);
  });

  it('should process safe message through entire pipeline', async () => {
    await core.start();

    const message: Message = {
      id: randomUUID(),
      content: 'Please analyze the current system status',
      source: 'operator',
      timestamp: new Date(),
    };

    // Should not throw
    await expect(core.processMessage(message)).resolves.not.toThrow();

    await core.stop();
  });

  it('should detect dangerous message via guardian threat assessment', async () => {
    await core.start();

    // Guardian assessThreat detects injection patterns and applies trust penalty.
    // Single injection (weight 1.0) + hostile trust (penalty 1.0) = risk 0.7
    // Blocking requires >= 0.8 (needs anomaly or rate limit compounding).
    // This test verifies threat detection, not blocking.
    const assessment = guardian.assessThreat('; rm -rf / --no-preserve-root', 'hostile');

    expect(assessment.threat_level).toBe('high'); // >= 0.7
    expect(assessment.risk_score).toBeGreaterThanOrEqual(0.7);
    expect(assessment.patterns_detected).toContain('command_injection');
    expect(assessment.should_escalate).toBe(true); // >= 0.6

    // Also verify processMessage audits the dangerous content
    const dangerousMessage: Message = {
      id: randomUUID(),
      content: '; rm -rf / --no-preserve-root',
      source: 'hostile',
      timestamp: new Date(),
    };

    await core.processMessage(dangerousMessage);

    const events = audit.getEvents();
    const processEvent = events.find(e => e.action === 'core:process_message');
    expect(processEvent).toBeDefined();
    expect(processEvent?.details?.message_id).toBe(dangerousMessage.id);

    await core.stop();
  });

  it('should block non-loopback host via arbiter', () => {
    const arbiter = new Arbiter(audit, eventBus);

    const result = arbiter.evaluateAction('network:connect', {
      host: 'evil.com',
      port: 80,
    });

    expect(result.allowed).toBe(false);
    expect(result.violations.some(v => v.includes('Loopback-Only Gateway'))).toBe(true);
  });

  it('should block release with failing tests via overseer', () => {
    const overseer = new Overseer(audit, eventBus);

    const result = overseer.canRelease({
      test_results: {
        passed: false,
        total: 48,
        failed: 3,
      },
      audit_valid: true,
      critical_security_events: 0,
      build_success: true,
      existing_docs: ['README.md', 'CLAUDE.md'],
    });

    expect(result.approved).toBe(false);
    expect(result.blockers.some(b => b.includes('test_coverage'))).toBe(true);
  });

  it('should complete council vote lifecycle with MAJORITY', async () => {
    const council = new Council(audit, eventBus);

    // Create vote
    const vote = council.createVote({
      topic: 'Update security policy',
      description: 'Enable stricter network controls',
      threshold: 'MAJORITY',
      initiated_by: 'router' as AgentId,
    });

    expect(vote.vote_id).toBeTruthy();
    expect(vote.status).toBe('OPEN');

    // Cast votes from the 4 core-eligible agents (isCore: true without domains)
    // eligible_voters = router, memory_keeper, guardian, planner → councilSize=4, MAJORITY=3
    const voters: AgentId[] = ['router', 'planner', 'memory_keeper', 'guardian'];

    for (const voter of voters) {
      council.castVote(
        vote.vote_id,
        voter,
        'APPROVE' as VoteOption,
        `${voter} approves the policy update`,
      );
    }

    // Wait for async events to process
    await new Promise(resolve => setTimeout(resolve, 50));

    // Vote should be auto-closed as PASSED (4 approvals > MAJORITY threshold of 3)
    const updatedVote = council.getVote(vote.vote_id);
    expect(updatedVote?.status).toBe('PASSED');
    expect(updatedVote?.result?.approve).toBe(4);
    expect(updatedVote?.result?.threshold_met).toBe(true);
  });

  it('should verify memory provenance with hash', async () => {
    // Store a memory entry with full provenance
    const memoryId = await memoryManager.store({
      type: 'FACT',
      content: 'Test memory content for provenance verification',
      provenance: {
        source: 'test',
        trust_level: 'verified',
        agent: 'core',
        chain: ['test-request'],
      },
      confidence: 0.9,
      partition: 'PUBLIC',
    });

    expect(memoryId).toBeTruthy();

    // Retrieve the entry (PUBLIC partition accessible by any agent)
    const retrieved = await memoryManager.retrieve(memoryId, 'core');

    expect(retrieved).not.toBeNull();
    expect(retrieved!.content).toBe('Test memory content for provenance verification');
    expect(retrieved!.hash).toBeTruthy();
    expect(typeof retrieved!.hash).toBe('string');
    expect(retrieved!.hash.length).toBe(64); // SHA-256 hex = 64 chars
    expect(retrieved!.provenance.source).toBe('test');
    expect(retrieved!.provenance.trust_level).toBe('verified');
  });
});
