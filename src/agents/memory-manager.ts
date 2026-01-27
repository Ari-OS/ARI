import { createHash, randomUUID } from 'crypto';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type {
  AgentId,
  MemoryEntry,
  MemoryType,
  MemoryPartition,
  TrustLevel,
  TRUST_SCORES,
} from '../kernel/types.js';

interface StoreParams {
  type: MemoryType;
  content: string;
  provenance: {
    source: string;
    trust_level: TrustLevel;
    agent: AgentId;
    chain: string[];
    request_id?: string;
  };
  confidence: number;
  partition: MemoryPartition;
  allowed_agents?: AgentId[];
  expires_at?: string | null;
}

interface QueryParams {
  type?: MemoryType;
  partition?: MemoryPartition;
  min_confidence?: number;
  verified_only?: boolean;
  limit?: number;
}

interface MemoryStats {
  total_entries: number;
  by_partition: Record<MemoryPartition, number>;
  by_type: Record<string, number>;
  quarantined: number;
  verified: number;
}

/**
 * Memory Manager - Provenance-tracked memory system
 * Manages memory entries with full provenance chains, integrity hashing,
 * partition-based access control, and trust decay
 */
export class MemoryManager {
  private readonly auditLogger: AuditLogger;
  private readonly eventBus: EventBus;
  private memories = new Map<string, MemoryEntry>();

  // Constants
  private readonly MAX_CAPACITY = 10000;
  private readonly TRUST_DECAY_PER_DAY = 0.01;
  private readonly VERIFIED_DECAY_FACTOR = 0.5; // Verified entries decay slower

  // Partition access control
  private readonly PARTITION_ACCESS: Record<MemoryPartition, AgentId[]> = {
    SENSITIVE: ['arbiter', 'overseer', 'guardian'],
    INTERNAL: [
      'core',
      'router',
      'planner',
      'executor',
      'memory_manager',
      'guardian',
      'arbiter',
      'overseer',
    ],
    PUBLIC: [], // Empty means all agents
  };

  // Injection patterns for poisoning detection
  private readonly INJECTION_PATTERNS = [
    /\$\{.*\}/,
    /eval\s*\(/i,
    /exec\s*\(/i,
    /__proto__|constructor\[/i,
    /\.\.\//,
    /<script/i,
    /union.*select/i,
    /;\s*rm\s+-rf/i,
  ];

  constructor(auditLogger: AuditLogger, eventBus: EventBus) {
    this.auditLogger = auditLogger;
    this.eventBus = eventBus;
  }

  /**
   * Store a new memory entry with full provenance
   */
  async store(params: StoreParams): Promise<string> {
    // Check capacity and consolidate if needed
    if (this.memories.size >= this.MAX_CAPACITY) {
      await this.consolidate();
    }

    const id = randomUUID();
    const created_at = new Date().toISOString();

    // Detect poisoning attempts
    const poisoningRisk = this.detectPoisoning(params);
    if (poisoningRisk.should_quarantine) {
      await this.quarantine(
        id,
        `Poisoning detected: ${poisoningRisk.reason}`,
        params.provenance.agent
      );
      throw new Error(`Memory rejected due to poisoning risk: ${poisoningRisk.reason}`);
    }

    // Determine allowed agents
    const allowed_agents = params.allowed_agents || this.getDefaultAllowedAgents(params.partition);

    // Create memory entry
    const entry: MemoryEntry = {
      id,
      type: params.type,
      content: params.content,
      provenance: params.provenance,
      confidence: params.confidence,
      partition: params.partition,
      allowed_agents,
      created_at,
      expires_at: params.expires_at ?? null,
      verified_at: null,
      verified_by: null,
      hash: '',
      supersedes: null,
    };

    // Compute integrity hash
    entry.hash = this.computeHash(entry);

    // Store memory
    this.memories.set(id, entry);

    // Audit and emit event
    await this.auditLogger.log('memory:store', params.provenance.agent, params.provenance.trust_level, {
      memory_id: id,
      type: params.type,
      partition: params.partition,
      confidence: params.confidence,
      provenance_chain_length: params.provenance.chain.length,
    });

    this.eventBus.emit('memory:stored', {
      memoryId: id,
      type: params.type,
      partition: params.partition,
      agent: params.provenance.agent,
    });

    return id;
  }

  /**
   * Retrieve a memory entry by ID
   */
  async retrieve(id: string, requestingAgent: AgentId): Promise<MemoryEntry | null> {
    const entry = this.memories.get(id);
    if (!entry) {
      return null;
    }

    // Check access permission
    if (!this.hasAccess(requestingAgent, entry)) {
      await this.auditLogger.log('memory:access_denied', requestingAgent, 'standard', {
        memory_id: id,
        partition: entry.partition,
      });
      return null;
    }

    // Apply trust decay
    const decayedEntry = this.applyTrustDecay(entry);

    await this.auditLogger.log('memory:retrieve', requestingAgent, 'standard', {
      memory_id: id,
      type: entry.type,
    });

    return decayedEntry;
  }

  /**
   * Query memories matching criteria
   */
  async query(params: QueryParams, requestingAgent: AgentId): Promise<MemoryEntry[]> {
    let results: MemoryEntry[] = Array.from(this.memories.values());

    // Filter by access permission
    results = results.filter((entry) => this.hasAccess(requestingAgent, entry));

    // Apply query filters
    if (params.type) {
      results = results.filter((entry) => entry.type === params.type);
    }

    if (params.partition) {
      results = results.filter((entry) => entry.partition === params.partition);
    }

    if (params.verified_only) {
      results = results.filter((entry) => entry.verified_at !== null);
    }

    // Apply trust decay
    results = results.map((entry) => this.applyTrustDecay(entry));

    // Filter by minimum confidence (after decay)
    if (params.min_confidence !== undefined) {
      results = results.filter((entry) => entry.confidence >= params.min_confidence!);
    }

    // Sort by confidence descending
    results.sort((a, b) => b.confidence - a.confidence);

    // Apply limit
    if (params.limit) {
      results = results.slice(0, params.limit);
    }

    await this.auditLogger.log('memory:query', requestingAgent, 'standard', {
      filters: params,
      result_count: results.length,
    });

    return results;
  }

  /**
   * Verify a memory entry
   */
  async verify(id: string, verifyingAgent: AgentId): Promise<void> {
    const entry = this.memories.get(id);
    if (!entry) {
      throw new Error(`Memory ${id} not found`);
    }

    // Only certain agents can verify
    const canVerify = ['arbiter', 'overseer', 'guardian'].includes(verifyingAgent);
    if (!canVerify) {
      throw new Error(`Agent ${verifyingAgent} cannot verify memories`);
    }

    entry.verified_at = new Date().toISOString();
    entry.verified_by = verifyingAgent;
    entry.hash = this.computeHash(entry); // Recompute hash

    await this.auditLogger.log('memory:verify', verifyingAgent, 'system', {
      memory_id: id,
      type: entry.type,
    });
  }

  /**
   * Quarantine a suspicious memory entry
   */
  async quarantine(id: string, reason: string, agent: AgentId): Promise<void> {
    const entry = this.memories.get(id);
    if (entry) {
      entry.type = 'QUARANTINE';
      entry.partition = 'SENSITIVE';
      entry.allowed_agents = ['arbiter', 'overseer', 'guardian'];
      entry.hash = this.computeHash(entry);
    }

    await this.auditLogger.logSecurity({
      eventType: 'trust_violation',
      severity: 'high',
      source: agent,
      details: {
        memory_id: id,
        reason,
        original_type: entry?.type,
      },
      mitigated: true,
    });

    this.eventBus.emit('memory:quarantined', {
      memoryId: id,
      reason,
      agent,
    });
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const stats: MemoryStats = {
      total_entries: this.memories.size,
      by_partition: { PUBLIC: 0, INTERNAL: 0, SENSITIVE: 0 },
      by_type: {},
      quarantined: 0,
      verified: 0,
    };

    for (const entry of this.memories.values()) {
      stats.by_partition[entry.partition]++;

      if (!stats.by_type[entry.type]) {
        stats.by_type[entry.type] = 0;
      }
      stats.by_type[entry.type]++;

      if (entry.type === 'QUARANTINE') {
        stats.quarantined++;
      }

      if (entry.verified_at) {
        stats.verified++;
      }
    }

    return stats;
  }

  /**
   * Check if agent has access to memory entry
   */
  private hasAccess(agent: AgentId, entry: MemoryEntry): boolean {
    // Check partition-level access
    const partitionAgents = this.PARTITION_ACCESS[entry.partition];
    if (partitionAgents.length > 0 && !partitionAgents.includes(agent)) {
      return false;
    }

    // Check entry-specific allowed agents
    if (entry.allowed_agents.length > 0 && !entry.allowed_agents.includes(agent)) {
      return false;
    }

    return true;
  }

  /**
   * Get default allowed agents for partition
   */
  private getDefaultAllowedAgents(partition: MemoryPartition): AgentId[] {
    return this.PARTITION_ACCESS[partition] || [];
  }

  /**
   * Detect memory poisoning attempts
   */
  private detectPoisoning(params: StoreParams): { should_quarantine: boolean; reason: string } {
    // Check for injection patterns
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(params.content)) {
        return {
          should_quarantine: true,
          reason: `Injection pattern detected in content`,
        };
      }
    }

    // Check for untrusted source writing sensitive data
    if (
      (params.type === 'DECISION' || params.partition === 'SENSITIVE') &&
      (params.provenance.trust_level === 'untrusted' || params.provenance.trust_level === 'hostile')
    ) {
      return {
        should_quarantine: true,
        reason: `Untrusted source attempting to write ${params.type}/${params.partition}`,
      };
    }

    return { should_quarantine: false, reason: '' };
  }

  /**
   * Apply trust decay to memory entry
   */
  private applyTrustDecay(entry: MemoryEntry): MemoryEntry {
    const now = Date.now();
    const created = new Date(entry.created_at).getTime();
    const ageInDays = (now - created) / (1000 * 60 * 60 * 24);

    let decayRate = this.TRUST_DECAY_PER_DAY;
    if (entry.verified_at) {
      decayRate *= this.VERIFIED_DECAY_FACTOR;
    }

    const decay = Math.min(entry.confidence, ageInDays * decayRate);
    const decayedConfidence = Math.max(0, entry.confidence - decay);

    return {
      ...entry,
      confidence: decayedConfidence,
    };
  }

  /**
   * Compute SHA-256 hash for memory entry
   */
  private computeHash(entry: MemoryEntry): string {
    const hashInput = {
      id: entry.id,
      type: entry.type,
      content: entry.content,
      provenance: entry.provenance,
      confidence: entry.confidence,
      partition: entry.partition,
      created_at: entry.created_at,
      verified_at: entry.verified_at,
      verified_by: entry.verified_by,
    };

    const hashContent = JSON.stringify(hashInput);
    return createHash('sha256').update(hashContent).digest('hex');
  }

  /**
   * Consolidate memories when at capacity
   */
  private async consolidate(): Promise<void> {
    const now = Date.now();

    // First pass: remove expired entries
    for (const [id, entry] of this.memories.entries()) {
      if (entry.expires_at) {
        const expiry = new Date(entry.expires_at).getTime();
        if (now > expiry) {
          this.memories.delete(id);
        }
      }
    }

    // If still at capacity, remove lowest confidence entries
    if (this.memories.size >= this.MAX_CAPACITY) {
      const entries = Array.from(this.memories.entries());
      entries.sort((a, b) => {
        const aConfidence = this.applyTrustDecay(a[1]).confidence;
        const bConfidence = this.applyTrustDecay(b[1]).confidence;
        return aConfidence - bConfidence;
      });

      const toRemove = entries.slice(0, Math.floor(this.MAX_CAPACITY * 0.1));
      for (const [id] of toRemove) {
        this.memories.delete(id);
      }
    }

    await this.auditLogger.log('memory:consolidate', 'memory_manager', 'system', {
      final_count: this.memories.size,
    });
  }
}
