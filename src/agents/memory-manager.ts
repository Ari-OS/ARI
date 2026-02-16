import { createHash, randomUUID } from 'crypto';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import { INJECTION_PATTERNS } from '../kernel/sanitizer.js';
import type {
  AgentId,
  MemoryEntry,
  MemoryType,
  MemoryPartition,
  TrustLevel,
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

  // Persistence — file-based, partition-organized, atomic writes
  private readonly MEMORY_DIR = path.join(homedir(), '.ari', 'memories');
  private persistTimer: NodeJS.Timeout | null = null;
  private dirty = false;
  private readonly PERSIST_DEBOUNCE_MS = 5000; // Batch writes every 5 seconds

  // Partition access control
  private readonly PARTITION_ACCESS: Record<MemoryPartition, AgentId[]> = {
    SENSITIVE: ['arbiter', 'overseer', 'guardian'],
    INTERNAL: [
      'core',
      'router',
      'planner',
      'executor',
      'memory_keeper', // ECHO - the Archivist
      'guardian',
      'arbiter',
      'overseer',
    ],
    PUBLIC: [], // Empty means all agents
  };

  // Injection patterns for poisoning detection
  // Base: all 27 kernel sanitizer patterns (shared single source of truth)
  // Plus: memory-specific patterns for standalone function call injection
  private readonly MEMORY_INJECTION_PATTERNS = [
    ...INJECTION_PATTERNS.map(p => p.pattern),
    // Memory-specific: standalone function calls without semicolon prefix
    /eval\s*\(/i,
    /exec\s*\(/i,
    /__proto__|constructor\[/i,
    /union.*select/i,
  ];

  constructor(auditLogger: AuditLogger, eventBus: EventBus) {
    this.auditLogger = auditLogger;
    this.eventBus = eventBus;
  }

  /**
   * Initialize persistence — load memories from disk and start background flush.
   * Must be called after construction and before first use.
   */
  async initialize(): Promise<void> {
    // Create directory structure
    mkdirSync(this.MEMORY_DIR, { recursive: true });

    // Load existing memories from disk
    this.loadFromDisk();

    // Start debounced persistence timer
    this.persistTimer = setInterval(() => {
      if (this.dirty) {
        this.persistToDisk().catch((err: unknown) => {
          this.eventBus.emit('audit:log', {
            action: 'memory:persist_failed',
            agent: 'memory_keeper',
            trustLevel: 'system',
            details: { error: err instanceof Error ? err.message : String(err) },
          });
        });
      }
    }, this.PERSIST_DEBOUNCE_MS);

    // Audit the load
    await this.auditLogger.log('memory:loaded_from_disk', 'memory_keeper', 'system', {
      entries_loaded: this.memories.size,
    });
  }

  /**
   * Graceful shutdown — flush pending writes and stop timer.
   */
  async shutdown(): Promise<void> {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }

    // Final flush
    if (this.dirty) {
      await this.persistToDisk();
    }

    await this.auditLogger.log('memory:shutdown', 'memory_keeper', 'system', {
      entries_saved: this.memories.size,
    });
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
    this.dirty = true;

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
    this.dirty = true;

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
      this.dirty = true;
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
   * Query memories within a time window
   * Useful for research skills like /last30days, /lastweek
   */
  async queryTimeWindow(
    params: {
      startDate: Date;
      endDate?: Date;
      domains?: string[];
      minConfidence?: number;
      limit?: number;
    },
    requestingAgent: AgentId
  ): Promise<MemoryEntry[]> {
    const {
      startDate,
      endDate = new Date(),
      domains,
      minConfidence = 0,
      limit = 50,
    } = params;

    let results: MemoryEntry[] = Array.from(this.memories.values());

    // Filter by access permission
    results = results.filter((entry) => this.hasAccess(requestingAgent, entry));

    // Filter by time window
    results = results.filter((entry) => {
      const createdAt = new Date(entry.created_at);
      return createdAt >= startDate && createdAt <= endDate;
    });

    // Filter by domains (if provided and entry has domain in content or provenance)
    if (domains && domains.length > 0) {
      results = results.filter((entry) => {
        // Check if content mentions any domain
        const contentLower = entry.content.toLowerCase();
        return domains.some((d) => contentLower.includes(d.toLowerCase()));
      });
    }

    // Apply trust decay
    results = results.map((entry) => this.applyTrustDecay(entry));

    // Filter by minimum confidence (after decay)
    if (minConfidence > 0) {
      results = results.filter((entry) => entry.confidence >= minConfidence);
    }

    // Sort by creation date descending (newest first)
    results.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return bTime - aTime;
    });

    // Apply limit
    results = results.slice(0, limit);

    await this.auditLogger.log('memory:query_time_window', requestingAgent, 'standard', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      domains,
      minConfidence,
      result_count: results.length,
    });

    return results;
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
    for (const pattern of this.MEMORY_INJECTION_PATTERNS) {
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
   * Load memories from disk — one JSON file per partition.
   */
  private loadFromDisk(): void {
    const partitions: MemoryPartition[] = ['PUBLIC', 'INTERNAL', 'SENSITIVE'];

    for (const partition of partitions) {
      const filePath = path.join(this.MEMORY_DIR, `${partition.toLowerCase()}.json`);

      try {
        if (existsSync(filePath)) {
          const data = readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(data) as unknown;
          const entries: MemoryEntry[] = parsed as MemoryEntry[];

          for (const entry of entries) {
            if (entry.id && entry.content && entry.provenance) {
              this.memories.set(entry.id, entry);
            }
          }
        }
      } catch (error) {
        this.eventBus.emit('audit:log', {
          action: 'memory:load_failed',
          agent: 'memory_keeper',
          trustLevel: 'system',
          details: {
            partition,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }

  /**
   * Persist memories to disk — atomic write per partition via tmp+rename.
   */
  private async persistToDisk(): Promise<void> {
    const partitions: MemoryPartition[] = ['PUBLIC', 'INTERNAL', 'SENSITIVE'];

    for (const partition of partitions) {
      const entries = Array.from(this.memories.values())
        .filter((e) => e.partition === partition);

      const filePath = path.join(this.MEMORY_DIR, `${partition.toLowerCase()}.json`);
      const tempPath = `${filePath}.tmp`;

      await fs.writeFile(tempPath, JSON.stringify(entries, null, 2));
      await fs.rename(tempPath, filePath);
    }

    this.dirty = false;
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

    this.dirty = true;

    await this.auditLogger.log('memory:consolidate', 'memory_keeper', 'system', {
      final_count: this.memories.size,
    });
  }
}
