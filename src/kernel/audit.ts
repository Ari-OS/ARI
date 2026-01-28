import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { AuditEvent, SecurityEvent, TrustLevel } from './types.js';

/**
 * SHA-256 hash-chained audit logger for ARI.
 * Each event contains a hash of itself and the previous event's hash,
 * creating an immutable audit trail that can be verified.
 */
export class AuditLogger {
  private events: AuditEvent[] = [];
  private auditPath: string;
  private readonly GENESIS_HASH = '0'.repeat(64);

  constructor(auditPath?: string) {
    // Resolve ~ to home directory
    const path = auditPath || '~/.ari/audit.json';
    this.auditPath = path.startsWith('~')
      ? join(homedir(), path.slice(1))
      : path;
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
    await this.persist();

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
  async verify(): Promise<{
    valid: boolean;
    brokenAt?: number;
    details: string;
  }> {
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
   * Loads audit events from disk.
   * Skips silently if the file doesn't exist.
   */
  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.auditPath, 'utf-8');
      const parsed = JSON.parse(data);

      // Convert ISO timestamp strings back to Date objects
      this.events = parsed.map((event: AuditEvent) => ({
        ...event,
        timestamp: new Date(event.timestamp),
      }));
    } catch (error) {
      // Silently skip if file doesn't exist
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }

  /**
   * Persists audit events to disk.
   * Creates the directory structure if it doesn't exist.
   */
  private async persist(): Promise<void> {
    const dir = dirname(this.auditPath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write events to file
    await fs.writeFile(
      this.auditPath,
      JSON.stringify(this.events, null, 2),
      'utf-8'
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
