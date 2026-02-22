import { execFileSync } from 'child_process';
import { createHash, createHmac, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { homedir, tmpdir } from 'os';
import { dirname, join } from 'path';
import { AuditEvent, SecurityEvent, TrustLevel } from './types.js';

/**
 * A checkpoint is a signed snapshot of the audit chain at a point in time.
 * Used to detect wholesale chain replacement (where internal hash verification
 * would still pass because the replacement chain is internally consistent).
 */
export interface AuditCheckpoint {
  /** Unique checkpoint ID */
  id: string;
  /** ISO timestamp when checkpoint was created */
  timestamp: string;
  /** Number of events in the chain at checkpoint time */
  eventCount: number;
  /** Hash of the last event in the chain */
  headHash: string;
  /** Hash of the first event (should always chain from genesis) */
  genesisEventHash: string;
  /** HMAC-SHA256 signature of the checkpoint data */
  signature: string;
}

/**
 * SHA-256 hash-chained audit logger for ARI.
 * Each event contains a hash of itself and the previous event's hash,
 * creating an immutable audit trail that can be verified.
 *
 * Supports checkpointing: periodic signed snapshots of chain state
 * that can detect wholesale chain replacement attacks.
 */
export class AuditLogger {
  private events: AuditEvent[] = [];
  private checkpoints: AuditCheckpoint[] = [];
  private auditPath: string;
  private checkpointPath: string;
  private readonly GENESIS_HASH = '0'.repeat(64);
  /** Events between automatic checkpoints (0 = disabled) */
  private readonly CHECKPOINT_INTERVAL: number;
  /** Signing key for checkpoint HMAC signatures */
  private readonly signingKey: string;
  /** Whether the signing key is persisted (Keychain) or ephemeral (memory-only) */
  private readonly keyPersisted: boolean;
  /** Events logged since last checkpoint */
  private eventsSinceCheckpoint = 0;

  // WAL properties
  private walPath: string;
  private walBuffer: AuditEvent[] = [];
  private isFlushing = false;
  private flushTimer: NodeJS.Timeout | null = null;

  /** Keychain identifiers for the signing key */
  private static readonly KEYCHAIN_SERVICE = 'ari-audit-signing-key';
  private static readonly KEYCHAIN_ACCOUNT = 'ari';

  constructor(auditPath?: string, options?: { checkpointInterval?: number; signingKey?: string }) {
    // Resolve ~ to home directory
    let path = auditPath || '~/.ari/audit.json';
    if (!auditPath && process.env.NODE_ENV === 'test') {
      path = join(tmpdir(), `test-audit-${randomUUID()}.json`);
    }
    this.auditPath = path.startsWith('~')
      ? join(homedir(), path.slice(1))
      : path;
    this.checkpointPath = this.auditPath.replace(/\.json$/, '-checkpoints.json');
    this.walPath = this.auditPath.replace(/\.json$/, '.jsonl');
    this.CHECKPOINT_INTERVAL = options?.checkpointInterval ?? 100;

    if (options?.signingKey) {
      // Explicit key provided (e.g., testing) — use it directly
      this.signingKey = options.signingKey;
      this.keyPersisted = false;
    } else {
      // Production: load from macOS Keychain or generate + store
      const result = AuditLogger.loadOrCreateSigningKey();
      this.signingKey = result.key;
      this.keyPersisted = result.persisted;
    }
  }

  /**
   * Loads the checkpoint signing key from macOS Keychain.
   * If no key exists, generates a new one and stores it in Keychain.
   * If Keychain is unavailable (non-macOS, permissions), falls back to ephemeral key.
   *
   * The Keychain is backed by the Secure Enclave on Apple Silicon and requires
   * the user's login session to access — an attacker with only filesystem access
   * cannot read or forge Keychain entries.
   */
  static loadOrCreateSigningKey(): { key: string; persisted: boolean } {
    // Only macOS has the Keychain
    if (process.platform !== 'darwin') {
      return { key: randomUUID() + randomUUID(), persisted: false };
    }

    // Try to load existing key from Keychain
    try {
      const key = execFileSync(
        'security',
        ['find-generic-password', '-a', AuditLogger.KEYCHAIN_ACCOUNT, '-s', AuditLogger.KEYCHAIN_SERVICE, '-w'],
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
      if (key) {
        return { key, persisted: true };
      }
    } catch {
      // Key not found in Keychain — will generate new one
    }

    // Generate new key
    const newKey = randomUUID() + randomUUID();

    // Store in Keychain (add or update)
    try {
      execFileSync(
        'security',
        ['add-generic-password', '-a', AuditLogger.KEYCHAIN_ACCOUNT, '-s', AuditLogger.KEYCHAIN_SERVICE, '-w', newKey, '-U'],
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      return { key: newKey, persisted: true };
    } catch {
      // Keychain unavailable — fall back to ephemeral key
      return { key: newKey, persisted: false };
    }
  }

  /**
   * Returns whether the signing key is persisted in Keychain.
   * If false, checkpoint signatures cannot be verified after restart.
   */
  isKeyPersisted(): boolean {
    return this.keyPersisted;
  }

  /**
   * Computes SHA-256 hash of an audit event.
   * The hash is calculated from the event's core fields in a deterministic order.
   */
  private computeHash(event: Omit<AuditEvent, 'hash'>): string {
    const hashInput = {
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      action: event.action,
      actor: event.actor,
      trustLevel: event.trustLevel,
      details: event.details,
      previousHash: event.previousHash,
    };

    const hashContent = JSON.stringify(hashInput);
    return createHash('sha256').update(hashContent).digest('hex');
  }

  /**
   * Logs a new audit event to the chain.
   * Each event is linked to the previous event via cryptographic hash.
   */
  async log(
    action: string,
    actor: string,
    trustLevel: TrustLevel,
    details?: Record<string, unknown>
  ): Promise<AuditEvent> {
    const id = randomUUID();
    const timestamp = new Date();
    const previousHash =
      this.events.length > 0
        ? this.events[this.events.length - 1].hash
        : this.GENESIS_HASH;

    // Create event without hash first
    const eventWithoutHash: Omit<AuditEvent, 'hash'> = {
      id,
      timestamp,
      action,
      actor,
      trustLevel,
      details,
      previousHash,
    };

    // Compute hash and create final event
    const hash = this.computeHash(eventWithoutHash);
    const event: AuditEvent = {
      ...eventWithoutHash,
      hash,
    };

    this.events.push(event);
    this.walBuffer.push(event);
    // Persist to WAL asynchronously (fire and forget)
    this.persist();

    // Auto-checkpoint if interval is set and reached
    this.eventsSinceCheckpoint++;
    if (this.CHECKPOINT_INTERVAL > 0 && this.eventsSinceCheckpoint >= this.CHECKPOINT_INTERVAL) {
      await this.createCheckpoint();
    }

    return event;
  }

  /**
   * Logs a security event as an audit event.
   * Security events are stored with action='security_event' and actor='system'.
   */
  async logSecurity(
    event: Omit<SecurityEvent, 'id' | 'timestamp'>
  ): Promise<void> {
    await this.log('security_event', 'system', 'system', {
      eventType: event.eventType,
      severity: event.severity,
      source: event.source,
      details: event.details,
      mitigated: event.mitigated,
    });
  }

  /**
   * Verifies the integrity of the audit chain.
   * Checks that:
   * 1. Each event's hash is correctly computed
   * 2. Each event's previousHash matches the actual previous event's hash
   */
  verify(): {
    valid: boolean;
    brokenAt?: number;
    details: string;
  } {
    if (this.events.length === 0) {
      return {
        valid: true,
        details: 'Chain integrity verified: 0 events',
      };
    }

    for (let i = 0; i < this.events.length; i++) {
      const event = this.events[i];

      // Check previousHash linkage
      const expectedPreviousHash =
        i === 0 ? this.GENESIS_HASH : this.events[i - 1].hash;

      if (event.previousHash !== expectedPreviousHash) {
        return {
          valid: false,
          brokenAt: i,
          details: `Chain broken at event ${i}: previousHash mismatch (expected ${expectedPreviousHash}, got ${event.previousHash})`,
        };
      }

      // Recompute and verify hash
      const eventWithoutHash: Omit<AuditEvent, 'hash'> = {
        id: event.id,
        timestamp: event.timestamp,
        action: event.action,
        actor: event.actor,
        trustLevel: event.trustLevel,
        details: event.details,
        previousHash: event.previousHash,
      };

      const recomputedHash = this.computeHash(eventWithoutHash);
      if (event.hash !== recomputedHash) {
        return {
          valid: false,
          brokenAt: i,
          details: `Chain broken at event ${i}: hash mismatch (expected ${recomputedHash}, got ${event.hash})`,
        };
      }
    }

    return {
      valid: true,
      details: `Chain integrity verified: ${this.events.length} events`,
    };
  }

  /**
   * Creates a signed checkpoint of the current chain state.
   * Checkpoints enable detection of wholesale chain replacement —
   * even if a replacement chain is internally consistent, it won't
   * match previously recorded checkpoints.
   */
  async createCheckpoint(): Promise<AuditCheckpoint | null> {
    if (this.events.length === 0) {
      return null;
    }

    const lastEvent = this.events[this.events.length - 1];
    const firstEvent = this.events[0];

    const checkpointData = {
      eventCount: this.events.length,
      headHash: lastEvent.hash,
      genesisEventHash: firstEvent.hash,
    };

    const signature = createHmac('sha256', this.signingKey)
      .update(JSON.stringify(checkpointData))
      .digest('hex');

    const checkpoint: AuditCheckpoint = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventCount: checkpointData.eventCount,
      headHash: checkpointData.headHash,
      genesisEventHash: checkpointData.genesisEventHash,
      signature,
    };

    this.checkpoints.push(checkpoint);
    this.eventsSinceCheckpoint = 0;
    await this.persistCheckpoints();

    return checkpoint;
  }

  /**
   * Verifies that the current chain matches all recorded checkpoints.
   * Returns details about any mismatches found.
   *
   * A checkpoint mismatch means the chain was replaced after the checkpoint
   * was taken — even if the chain itself is internally valid.
   */
  verifyCheckpoints(): {
    valid: boolean;
    checked: number;
    mismatches: Array<{ checkpointId: string; field: string; expected: string; actual: string }>;
  } {
    const mismatches: Array<{ checkpointId: string; field: string; expected: string; actual: string }> = [];

    for (const cp of this.checkpoints) {
      // Check event count: chain must have at least as many events as checkpoint recorded
      if (this.events.length < cp.eventCount) {
        mismatches.push({
          checkpointId: cp.id,
          field: 'eventCount',
          expected: String(cp.eventCount),
          actual: String(this.events.length),
        });
        continue;
      }

      // Check that the event at the checkpoint's position has the expected hash
      const eventAtCheckpoint = this.events[cp.eventCount - 1];
      if (eventAtCheckpoint.hash !== cp.headHash) {
        mismatches.push({
          checkpointId: cp.id,
          field: 'headHash',
          expected: cp.headHash,
          actual: eventAtCheckpoint.hash,
        });
      }

      // Check genesis event hash hasn't changed
      if (this.events[0].hash !== cp.genesisEventHash) {
        mismatches.push({
          checkpointId: cp.id,
          field: 'genesisEventHash',
          expected: cp.genesisEventHash,
          actual: this.events[0].hash,
        });
      }

      // Verify checkpoint signature
      const checkpointData = {
        eventCount: cp.eventCount,
        headHash: cp.headHash,
        genesisEventHash: cp.genesisEventHash,
      };
      const expectedSig = createHmac('sha256', this.signingKey)
        .update(JSON.stringify(checkpointData))
        .digest('hex');

      if (cp.signature !== expectedSig) {
        mismatches.push({
          checkpointId: cp.id,
          field: 'signature',
          expected: expectedSig,
          actual: cp.signature,
        });
      }
    }

    return {
      valid: mismatches.length === 0,
      checked: this.checkpoints.length,
      mismatches,
    };
  }

  /**
   * Returns all checkpoints.
   */
  getCheckpoints(): AuditCheckpoint[] {
    return [...this.checkpoints];
  }

  /**
   * Loads audit events from disk.
   * Skips silently if the file doesn't exist.
   */
  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.auditPath, 'utf-8');
      const parsed = JSON.parse(data) as unknown[];

      // Convert ISO timestamp strings back to Date objects
      this.events = (parsed as Array<Record<string, unknown>>).map((event) => ({
        ...event,
        timestamp: new Date(event.timestamp as string),
      })) as AuditEvent[];
    } catch (error) {
      // Silently skip if file doesn't exist
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Still try to load checkpoints
      } else {
        throw error;
      }
    }

    // Load any un-consolidated WAL events
    try {
      const walData = await fs.readFile(this.walPath, 'utf-8');
      const lines = walData.split('\n').filter(line => line.trim().length > 0);
      if (lines.length > 0) {
        const walEvents = lines.map(line => {
          const event = JSON.parse(line) as Record<string, unknown>;
          return {
            ...event,
            timestamp: new Date(event.timestamp as string),
          } as AuditEvent;
        });
        
        // Find events that aren't already in this.events (in case of partial consolidate crash)
        const existingIds = new Set(this.events.map(e => e.id));
        const newWalEvents = walEvents.filter(e => !existingIds.has(e.id));
        
        if (newWalEvents.length > 0) {
          this.events.push(...newWalEvents);
          // Trigger consolidation asynchronously
          // eslint-disable-next-line no-console
          this.consolidateWal().catch((err) => console.error('[AuditLogger] Failed to consolidate WAL on load:', err));
        }
      }
    } catch {
      // Silently skip if WAL doesn't exist
    }

    // Load checkpoints
    try {
      const cpData = await fs.readFile(this.checkpointPath, 'utf-8');
      this.checkpoints = JSON.parse(cpData) as AuditCheckpoint[];
    } catch {
      // No checkpoints file yet — that's fine
    }
  }

  /**
   * Appends audit events to the WAL buffer.
   * Flushes asynchronously to avoid blocking the event loop.
   */
  private persist(): void {
    if (this.walBuffer.length === 0) return;
    
    if (!this.flushTimer && !this.isFlushing) {
      // Schedule a flush if not already flushing
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flushWal().catch((err) => {
          // eslint-disable-next-line no-console
          console.error('[AuditLogger] Failed to flush WAL:', err);
        });
      }, 50); // Small batch window (50ms)
    }
  }

  /**
   * Flushes the WAL buffer to the .jsonl file on disk.
   */
  private async flushWal(): Promise<void> {
    if (this.isFlushing || this.walBuffer.length === 0) return;
    this.isFlushing = true;

    try {
      const dir = dirname(this.walPath);
      await fs.mkdir(dir, { recursive: true });

      // Take a snapshot of the buffer to flush
      const batch = this.walBuffer.splice(0, this.walBuffer.length);
      const batchData = batch.map(e => JSON.stringify(e)).join('\n') + '\n';
      
      await fs.appendFile(this.walPath, batchData, { encoding: 'utf-8', mode: 0o600 });
      
      // Periodically consolidate WAL into main audit.json
      if (this.events.length % 1000 === 0) {
        await this.consolidateWal();
      }
    } finally {
      this.isFlushing = false;
      
      // If new events arrived during flush, trigger another flush
      if (this.walBuffer.length > 0) {
        this.persist();
      }
    }
  }

  /**
   * Consolidates the WAL into the main audit.json and clears the WAL.
   */
  private async consolidateWal(): Promise<void> {
    const dir = dirname(this.auditPath);
    await fs.mkdir(dir, { recursive: true });

    // Write all events to file
    const tempPath = `${this.auditPath}.tmp`;
    await fs.writeFile(
      tempPath,
      JSON.stringify(this.events, null, 2),
      { encoding: 'utf-8', mode: 0o600 }
    );
    await fs.rename(tempPath, this.auditPath);
    
    // Clear the WAL now that it's consolidated
    await fs.writeFile(this.walPath, '', { encoding: 'utf-8', mode: 0o600 });
  }

  /**
   * Persists checkpoints to a separate file.
   * Stored separately from the main audit log for integrity.
   */
  private async persistCheckpoints(): Promise<void> {
    const dir = dirname(this.checkpointPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.checkpointPath,
      JSON.stringify(this.checkpoints, null, 2),
      { encoding: 'utf-8', mode: 0o600 }
    );
  }

  /**
   * Returns a copy of all audit events.
   */
  getEvents(): AuditEvent[] {
    return [...this.events];
  }

  /**
   * Returns all security events from the audit log.
   */
  getSecurityEvents(): AuditEvent[] {
    return this.events.filter((event) => event.action === 'security_event');
  }
}
