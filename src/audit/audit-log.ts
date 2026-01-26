/**
 * ARI vNext — Hash-Chained Audit Log
 *
 * Tamper-evident, append-only log using SHA-256 hash chaining.
 *
 * Hash Formula:
 * hash = SHA256(JSON.stringify([sequence, timestamp, action, actor, details, prev_hash]))
 *
 * @module audit/audit-log
 * @version 1.0.0
 */

import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import * as readline from 'node:readline';
import {
  type AuditEntry,
  type AuditAction,
  type AuditActor,
  type Result,
  ok,
  err,
} from '../types/index.js';
import { getAuditPath } from '../config/config.js';
import { auditLogger } from '../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const GENESIS_HASH = '0'.repeat(64);

// ═══════════════════════════════════════════════════════════════════════════
// HASH COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════

function computeHash(entry: Omit<AuditEntry, 'hash'>): string {
  const data = JSON.stringify([
    entry.sequence,
    entry.timestamp,
    entry.action,
    entry.actor,
    entry.details,
    entry.prev_hash,
  ]);
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface AuditQueryOptions {
  action?: AuditAction;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

export interface VerificationResult {
  valid: boolean;
  entriesChecked: number;
  firstInvalidSequence?: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT LOG CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class AuditLog {
  private readonly filePath: string;
  private sequence: number = -1;
  private lastHash: string = GENESIS_HASH;
  private initialized: boolean = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(filePath?: string) {
    this.filePath = filePath ?? getAuditPath();
  }

  async initialize(): Promise<Result<void, Error>> {
    if (this.initialized) {
      return ok(undefined);
    }

    try {
      const dir = this.filePath.substring(0, this.filePath.lastIndexOf('/'));
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }

      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, '', { mode: 0o600 });
      }

      const lastEntry = await this.getLastEntry();
      if (lastEntry !== null) {
        this.sequence = lastEntry.sequence;
        this.lastHash = lastEntry.hash;
      }

      this.initialized = true;
      return ok(undefined);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async append(
    action: AuditAction,
    actor: AuditActor,
    details: Record<string, unknown>,
  ): Promise<Result<AuditEntry, Error>> {
    if (!this.initialized) {
      const initResult = await this.initialize();
      if (!initResult.success) {
        return err(initResult.error);
      }
    }

    return new Promise((resolve) => {
      this.writeQueue = this.writeQueue.then(async () => {
        try {
          const newSequence = this.sequence + 1;
          const timestamp = new Date().toISOString();

          const entryWithoutHash: Omit<AuditEntry, 'hash'> = {
            sequence: newSequence,
            timestamp,
            action,
            actor,
            details,
            prev_hash: this.lastHash,
          };

          const hash = computeHash(entryWithoutHash);
          const entry: AuditEntry = { ...entryWithoutHash, hash };

          fs.appendFileSync(this.filePath, JSON.stringify(entry) + '\n', {
            encoding: 'utf-8',
          });

          this.sequence = newSequence;
          this.lastHash = hash;

          auditLogger.debug({ sequence: newSequence, action }, 'Audit entry appended');
          resolve(ok(entry));
        } catch (error) {
          resolve(err(error instanceof Error ? error : new Error(String(error))));
        }
      });
    });
  }

  async getLastEntry(): Promise<AuditEntry | null> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return null;
      }

      const content = fs.readFileSync(this.filePath, 'utf-8').trim();
      if (content === '') {
        return null;
      }

      const lines = content.split('\n');
      const lastLine = lines[lines.length - 1];
      if (!lastLine) {
        return null;
      }

      return JSON.parse(lastLine) as AuditEntry;
    } catch {
      return null;
    }
  }

  async getEntry(sequence: number): Promise<AuditEntry | null> {
    try {
      const fileStream = fs.createReadStream(this.filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (line.trim() === '') continue;
        const entry = JSON.parse(line) as AuditEntry;
        if (entry.sequence === sequence) {
          rl.close();
          return entry;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async list(options: AuditQueryOptions = {}): Promise<AuditEntry[]> {
    const entries: AuditEntry[] = [];

    try {
      if (!fs.existsSync(this.filePath)) {
        return entries;
      }

      const fileStream = fs.createReadStream(this.filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      let skipped = 0;
      const offset = options.offset ?? 0;
      const limit = options.limit ?? Infinity;

      for await (const line of rl) {
        if (line.trim() === '') continue;
        const entry = JSON.parse(line) as AuditEntry;

        if (options.action !== undefined && entry.action !== options.action) continue;
        if (options.since !== undefined && entry.timestamp < options.since) continue;
        if (options.until !== undefined && entry.timestamp > options.until) continue;

        if (skipped < offset) {
          skipped++;
          continue;
        }

        entries.push(entry);

        if (entries.length >= limit) {
          break;
        }
      }

      return entries;
    } catch {
      return entries;
    }
  }

  async verify(): Promise<VerificationResult> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { valid: true, entriesChecked: 0 };
      }

      const fileStream = fs.createReadStream(this.filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      let expectedSequence = 0;
      let expectedPrevHash = GENESIS_HASH;
      let entriesChecked = 0;

      for await (const line of rl) {
        if (line.trim() === '') continue;

        let entry: AuditEntry;
        try {
          entry = JSON.parse(line) as AuditEntry;
        } catch {
          return {
            valid: false,
            entriesChecked,
            firstInvalidSequence: expectedSequence,
            error: `Parse error at sequence ${expectedSequence}`,
          };
        }

        if (entry.sequence !== expectedSequence) {
          return {
            valid: false,
            entriesChecked,
            firstInvalidSequence: entry.sequence,
            error: `Sequence mismatch: expected ${expectedSequence}, got ${entry.sequence}`,
          };
        }

        if (entry.prev_hash !== expectedPrevHash) {
          return {
            valid: false,
            entriesChecked,
            firstInvalidSequence: entry.sequence,
            error: `Hash chain broken at sequence ${entry.sequence}`,
          };
        }

        const { hash: _hash, ...entryWithoutHash } = entry;
        const computedHash = computeHash(entryWithoutHash);
        if (entry.hash !== computedHash) {
          return {
            valid: false,
            entriesChecked,
            firstInvalidSequence: entry.sequence,
            error: `Hash verification failed at sequence ${entry.sequence}`,
          };
        }

        expectedSequence++;
        expectedPrevHash = entry.hash;
        entriesChecked++;
      }

      return { valid: true, entriesChecked };
    } catch (error) {
      return {
        valid: false,
        entriesChecked: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getSequence(): number {
    return this.sequence;
  }

  getFilePath(): string {
    return this.filePath;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTOR HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function systemActor(id: string): AuditActor {
  return { type: 'system', id };
}

export function operatorActor(): AuditActor {
  return { type: 'operator', id: 'operator' };
}

export function senderActor(id: string, channel: string): AuditActor {
  return { type: 'sender', id, context: { channel } };
}

export function serviceActor(id: string): AuditActor {
  return { type: 'service', id };
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON & FACTORY
// ═══════════════════════════════════════════════════════════════════════════

let auditLogInstance: AuditLog | null = null;

export function getAuditLog(): AuditLog {
  if (auditLogInstance === null) {
    auditLogInstance = new AuditLog();
  }
  return auditLogInstance;
}

export function createAuditLog(filePath?: string): AuditLog {
  return new AuditLog(filePath);
}

export function resetAuditLog(): void {
  auditLogInstance = null;
}

export async function audit(
  action: AuditAction,
  actor: AuditActor,
  details: Record<string, unknown>,
): Promise<Result<AuditEntry, Error>> {
  return getAuditLog().append(action, actor, details);
}
