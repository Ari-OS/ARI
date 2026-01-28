import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { MemoryManager } from '../../../src/agents/memory-manager.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import type { AgentId, MemoryType, MemoryPartition, TrustLevel } from '../../../src/kernel/types.js';

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  let auditLogger: AuditLogger;
  let eventBus: EventBus;
  let testAuditPath: string;

  beforeEach(() => {
    testAuditPath = join(tmpdir(), `audit-${randomUUID()}.json`);
    auditLogger = new AuditLogger(testAuditPath);
    eventBus = new EventBus();
    memoryManager = new MemoryManager(auditLogger, eventBus);
  });

  it('should store and retrieve a PUBLIC memory entry', async () => {
    const memoryId = await memoryManager.store({
      type: 'FACT' as MemoryType,
      content: 'The sky is blue',
      provenance: {
        source: 'test',
        trust_level: 'verified' as TrustLevel,
        agent: 'core' as AgentId,
        chain: ['core'],
      },
      confidence: 0.9,
      partition: 'PUBLIC' as MemoryPartition,
    });

    expect(memoryId).toBeDefined();
    expect(typeof memoryId).toBe('string');

    const retrieved = await memoryManager.retrieve(memoryId, 'planner' as AgentId);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.content).toBe('The sky is blue');
    expect(retrieved?.type).toBe('FACT');
    expect(retrieved?.partition).toBe('PUBLIC');
  });

  it('should enforce access control for INTERNAL memory', async () => {
    const memoryId = await memoryManager.store({
      type: 'CONTEXT' as MemoryType,
      content: 'Internal context data',
      provenance: {
        source: 'test',
        trust_level: 'verified' as TrustLevel,
        agent: 'core' as AgentId,
        chain: ['core'],
      },
      confidence: 0.8,
      partition: 'INTERNAL' as MemoryPartition,
      allowed_agents: ['core', 'planner', 'executor'] as AgentId[],
    });

    // Allowed agent should be able to access
    const retrieved = await memoryManager.retrieve(memoryId, 'planner' as AgentId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.content).toBe('Internal context data');
  });

  it('should restrict SENSITIVE memory to arbiter, overseer, and guardian only', async () => {
    const memoryId = await memoryManager.store({
      type: 'DECISION' as MemoryType,
      content: 'Sensitive decision data',
      provenance: {
        source: 'test',
        trust_level: 'operator' as TrustLevel,
        agent: 'overseer' as AgentId,
        chain: ['overseer'],
      },
      confidence: 1.0,
      partition: 'SENSITIVE' as MemoryPartition,
    });

    // Overseer (allowed) should be able to access
    const retrieved = await memoryManager.retrieve(memoryId, 'overseer' as AgentId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.content).toBe('Sensitive decision data');

    // Arbiter (allowed) should be able to access
    const retrieved2 = await memoryManager.retrieve(memoryId, 'arbiter' as AgentId);
    expect(retrieved2).not.toBeNull();

    // Guardian (allowed) should be able to access
    const retrieved3 = await memoryManager.retrieve(memoryId, 'guardian' as AgentId);
    expect(retrieved3).not.toBeNull();
  });

  it('should return null when access is denied', async () => {
    const memoryId = await memoryManager.store({
      type: 'DECISION' as MemoryType,
      content: 'Sensitive decision data',
      provenance: {
        source: 'test',
        trust_level: 'operator' as TrustLevel,
        agent: 'overseer' as AgentId,
        chain: ['overseer'],
      },
      confidence: 1.0,
      partition: 'SENSITIVE' as MemoryPartition,
    });

    // Planner (not allowed) should not be able to access SENSITIVE
    const retrieved = await memoryManager.retrieve(memoryId, 'planner' as AgentId);
    expect(retrieved).toBeNull();
  });

  it('should reject content with poisoning patterns', async () => {
    await expect(
      memoryManager.store({
        type: 'FACT' as MemoryType,
        content: 'eval' + '(malicious.code)',
        provenance: {
          source: 'test',
          trust_level: 'standard' as TrustLevel,
          agent: 'planner' as AgentId,
          chain: ['planner'],
        },
        confidence: 0.5,
        partition: 'PUBLIC' as MemoryPartition,
      })
    ).rejects.toThrow();
  });

  it('should reject untrusted source writing DECISION or SENSITIVE memory', async () => {
    await expect(
      memoryManager.store({
        type: 'DECISION' as MemoryType,
        content: 'Important decision',
        provenance: {
          source: 'test',
          trust_level: 'untrusted' as TrustLevel,
          agent: 'planner' as AgentId,
          chain: ['planner'],
        },
        confidence: 0.5,
        partition: 'SENSITIVE' as MemoryPartition,
      })
    ).rejects.toThrow();
  });

  it('should allow verification of memory entry by authorized agents', async () => {
    const memoryId = await memoryManager.store({
      type: 'FACT' as MemoryType,
      content: 'Fact to verify',
      provenance: {
        source: 'test',
        trust_level: 'standard' as TrustLevel,
        agent: 'planner' as AgentId,
        chain: ['planner'],
      },
      confidence: 0.7,
      partition: 'PUBLIC' as MemoryPartition,
    });

    // Arbiter can verify
    await expect(
      memoryManager.verify(memoryId, 'arbiter' as AgentId)
    ).resolves.toBeUndefined();

    const verified = await memoryManager.retrieve(memoryId, 'planner' as AgentId);
    expect(verified?.verified_by).toBe('arbiter');
    expect(verified?.verified_at).not.toBeNull();
  });

  it('should reject verification from unauthorized agents', async () => {
    const memoryId = await memoryManager.store({
      type: 'FACT' as MemoryType,
      content: 'Fact to verify',
      provenance: {
        source: 'test',
        trust_level: 'standard' as TrustLevel,
        agent: 'planner' as AgentId,
        chain: ['planner'],
      },
      confidence: 0.7,
      partition: 'PUBLIC' as MemoryPartition,
    });

    // Planner cannot verify
    await expect(
      memoryManager.verify(memoryId, 'planner' as AgentId)
    ).rejects.toThrow();
  });

  it('should query memories with type filter', async () => {
    await memoryManager.store({
      type: 'FACT' as MemoryType,
      content: 'Fact 1',
      provenance: {
        source: 'test',
        trust_level: 'verified' as TrustLevel,
        agent: 'core' as AgentId,
        chain: ['core'],
      },
      confidence: 0.9,
      partition: 'PUBLIC' as MemoryPartition,
    });

    await memoryManager.store({
      type: 'CONTEXT' as MemoryType,
      content: 'Context 1',
      provenance: {
        source: 'test',
        trust_level: 'verified' as TrustLevel,
        agent: 'core' as AgentId,
        chain: ['core'],
      },
      confidence: 0.8,
      partition: 'PUBLIC' as MemoryPartition,
    });

    const facts = await memoryManager.query(
      { type: 'FACT' as MemoryType },
      'planner' as AgentId
    );

    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every((m) => m.type === 'FACT')).toBe(true);
  });

  it('should query with min_confidence filter', async () => {
    await memoryManager.store({
      type: 'FACT' as MemoryType,
      content: 'High confidence fact',
      provenance: {
        source: 'test',
        trust_level: 'verified' as TrustLevel,
        agent: 'core' as AgentId,
        chain: ['core'],
      },
      confidence: 0.95,
      partition: 'PUBLIC' as MemoryPartition,
    });

    await memoryManager.store({
      type: 'FACT' as MemoryType,
      content: 'Low confidence fact',
      provenance: {
        source: 'test',
        trust_level: 'standard' as TrustLevel,
        agent: 'planner' as AgentId,
        chain: ['planner'],
      },
      confidence: 0.4,
      partition: 'PUBLIC' as MemoryPartition,
    });

    const highConfidenceMemories = await memoryManager.query(
      { min_confidence: 0.8 },
      'planner' as AgentId
    );

    expect(highConfidenceMemories.length).toBeGreaterThan(0);
    expect(highConfidenceMemories.every((m) => m.confidence >= 0.8)).toBe(true);
  });

  it('should reflect stored entries in stats correctly', async () => {
    await memoryManager.store({
      type: 'FACT' as MemoryType,
      content: 'Fact 1',
      provenance: {
        source: 'test',
        trust_level: 'verified' as TrustLevel,
        agent: 'core' as AgentId,
        chain: ['core'],
      },
      confidence: 0.9,
      partition: 'PUBLIC' as MemoryPartition,
    });

    await memoryManager.store({
      type: 'CONTEXT' as MemoryType,
      content: 'Context 1',
      provenance: {
        source: 'test',
        trust_level: 'verified' as TrustLevel,
        agent: 'core' as AgentId,
        chain: ['core'],
      },
      confidence: 0.8,
      partition: 'INTERNAL' as MemoryPartition,
    });

    const stats = memoryManager.getStats();

    expect(stats.total_entries).toBeGreaterThanOrEqual(2);
    expect(stats.by_type).toBeDefined();
    expect(stats.by_partition).toBeDefined();
  });

  it('should emit memory:stored event when storing memory', async () => {
    const handler = vi.fn();
    eventBus.on('memory:stored', handler);

    await memoryManager.store({
      type: 'FACT' as MemoryType,
      content: 'Test fact',
      provenance: {
        source: 'test',
        trust_level: 'verified' as TrustLevel,
        agent: 'core' as AgentId,
        chain: ['core'],
      },
      confidence: 0.9,
      partition: 'PUBLIC' as MemoryPartition,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        memoryId: expect.any(String),
        type: 'FACT',
        partition: 'PUBLIC',
        agent: 'core',
      })
    );
  });
});
