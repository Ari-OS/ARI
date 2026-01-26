/**
 * ARI vNext — Audit Log Tests
 *
 * Tests the hash-chained audit log including:
 * - Entry creation with hash chaining
 * - Chain verification
 * - Tamper detection
 * - Querying and filtering
 *
 * @module audit/audit-log.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { AuditLog, systemActor, operatorActor, senderActor, serviceActor } from './audit-log.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function createTempAuditLog(): { auditLog: AuditLog; filePath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-test-'));
  const filePath = path.join(dir, 'test-audit.jsonl');
  const auditLog = new AuditLog(filePath);
  return { auditLog, filePath };
}

function cleanupTempDir(filePath: string): void {
  const dir = path.dirname(filePath);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('AuditLog', () => {
  let auditLog: AuditLog;
  let filePath: string;

  beforeEach(() => {
    const temp = createTempAuditLog();
    auditLog = temp.auditLog;
    filePath = temp.filePath;
  });

  afterEach(() => {
    cleanupTempDir(filePath);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const result = await auditLog.initialize();
      expect(result.success).toBe(true);
    });

    it('should create the audit file if it does not exist', async () => {
      await auditLog.initialize();
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should be idempotent on repeated initialization', async () => {
      const r1 = await auditLog.initialize();
      const r2 = await auditLog.initialize();
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
    });

    it('should load existing state on initialization', async () => {
      await auditLog.initialize();
      await auditLog.append('gateway_start', systemActor('test'), { port: 18789 });
      await auditLog.append('config_loaded', systemActor('test'), {});

      // Create new instance pointing at the same file
      const newLog = new AuditLog(filePath);
      await newLog.initialize();
      expect(newLog.getSequence()).toBe(1);
    });
  });

  describe('append', () => {
    it('should append an entry with sequence 0 for the first entry', async () => {
      const result = await auditLog.append('gateway_start', systemActor('test'), {
        port: 18789,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sequence).toBe(0);
        expect(result.data.action).toBe('gateway_start');
        expect(result.data.hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should increment sequence numbers', async () => {
      const r1 = await auditLog.append('gateway_start', systemActor('test'), {});
      const r2 = await auditLog.append('config_loaded', systemActor('test'), {});
      const r3 = await auditLog.append('session_connect', systemActor('test'), {});

      expect(r1.success && r1.data.sequence).toBe(0);
      expect(r2.success && r2.data.sequence).toBe(1);
      expect(r3.success && r3.data.sequence).toBe(2);
    });

    it('should chain hashes correctly', async () => {
      const r1 = await auditLog.append('gateway_start', systemActor('test'), {});
      const r2 = await auditLog.append('config_loaded', systemActor('test'), {});

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);

      if (r1.success && r2.success) {
        // First entry's prev_hash is the genesis hash
        expect(r1.data.prev_hash).toBe('0'.repeat(64));
        // Second entry's prev_hash is the first entry's hash
        expect(r2.data.prev_hash).toBe(r1.data.hash);
      }
    });

    it('should compute correct SHA-256 hashes', async () => {
      const result = await auditLog.append('gateway_start', systemActor('test'), {
        port: 18789,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const entry = result.data;
        const data = JSON.stringify([
          entry.sequence,
          entry.timestamp,
          entry.action,
          entry.actor,
          entry.details,
          entry.prev_hash,
        ]);
        const expectedHash = crypto.createHash('sha256').update(data).digest('hex');
        expect(entry.hash).toBe(expectedHash);
      }
    });

    it('should persist entries to disk', async () => {
      await auditLog.append('gateway_start', systemActor('test'), { port: 18789 });

      const content = fs.readFileSync(filePath, 'utf-8').trim();
      const lines = content.split('\n');
      expect(lines).toHaveLength(1);

      const parsed = JSON.parse(lines[0]!);
      expect(parsed.sequence).toBe(0);
      expect(parsed.action).toBe('gateway_start');
    });

    it('should handle concurrent appends correctly', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        auditLog.append('health_check', systemActor('test'), { index: i }),
      );

      const results = await Promise.all(promises);

      // All should succeed
      expect(results.every((r) => r.success)).toBe(true);

      // Sequences should be contiguous
      const sequences = results
        .filter((r): r is { success: true; data: { sequence: number } } => r.success)
        .map((r) => r.data.sequence)
        .sort((a, b) => a - b);

      for (let i = 0; i < sequences.length; i++) {
        expect(sequences[i]).toBe(i);
      }
    });
  });

  describe('verification', () => {
    it('should verify an empty log', async () => {
      const result = await auditLog.verify();
      expect(result.valid).toBe(true);
      expect(result.entriesChecked).toBe(0);
    });

    it('should verify a valid log', async () => {
      await auditLog.append('gateway_start', systemActor('test'), {});
      await auditLog.append('session_connect', systemActor('test'), {});
      await auditLog.append('message_received', senderActor('user1', 'cli'), {});

      const result = await auditLog.verify();
      expect(result.valid).toBe(true);
      expect(result.entriesChecked).toBe(3);
    });

    it('should detect tampered data', async () => {
      await auditLog.append('gateway_start', systemActor('test'), {});
      await auditLog.append('session_connect', systemActor('test'), {});

      // Tamper with the file
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      const entry = JSON.parse(lines[0]!);
      entry.details = { tampered: true };
      lines[0] = JSON.stringify(entry);
      fs.writeFileSync(filePath, lines.join('\n') + '\n');

      const result = await auditLog.verify();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Hash verification failed');
    });

    it('should detect broken hash chain', async () => {
      await auditLog.append('gateway_start', systemActor('test'), {});
      await auditLog.append('session_connect', systemActor('test'), {});

      // Break the chain by modifying prev_hash of second entry
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      const entry = JSON.parse(lines[1]!);
      entry.prev_hash = 'f'.repeat(64);
      lines[1] = JSON.stringify(entry);
      fs.writeFileSync(filePath, lines.join('\n') + '\n');

      const result = await auditLog.verify();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Hash chain broken');
    });
  });

  describe('querying', () => {
    it('should list all entries', async () => {
      await auditLog.append('gateway_start', systemActor('test'), {});
      await auditLog.append('session_connect', systemActor('test'), {});
      await auditLog.append('gateway_stop', systemActor('test'), {});

      const entries = await auditLog.list();
      expect(entries).toHaveLength(3);
    });

    it('should filter by action', async () => {
      await auditLog.append('gateway_start', systemActor('test'), {});
      await auditLog.append('session_connect', systemActor('test'), {});
      await auditLog.append('gateway_stop', systemActor('test'), {});

      const entries = await auditLog.list({ action: 'session_connect' });
      expect(entries).toHaveLength(1);
      expect(entries[0]!.action).toBe('session_connect');
    });

    it('should apply limit', async () => {
      for (let i = 0; i < 10; i++) {
        await auditLog.append('health_check', systemActor('test'), { i });
      }

      const entries = await auditLog.list({ limit: 3 });
      expect(entries).toHaveLength(3);
    });

    it('should get entry by sequence', async () => {
      await auditLog.append('gateway_start', systemActor('test'), {});
      await auditLog.append('session_connect', systemActor('test'), { id: 'abc' });

      const entry = await auditLog.getEntry(1);
      expect(entry).not.toBeNull();
      expect(entry!.action).toBe('session_connect');
    });

    it('should return null for non-existent sequence', async () => {
      const entry = await auditLog.getEntry(999);
      expect(entry).toBeNull();
    });

    it('should get the last entry', async () => {
      await auditLog.initialize();
      await auditLog.append('gateway_start', systemActor('test'), {});
      await auditLog.append('gateway_stop', systemActor('test'), {});

      const lastEntry = await auditLog.getLastEntry();
      expect(lastEntry).not.toBeNull();
      expect(lastEntry!.action).toBe('gateway_stop');
      expect(lastEntry!.sequence).toBe(1);
    });
  });

  describe('actor helpers', () => {
    it('should create system actor', () => {
      const actor = systemActor('gateway');
      expect(actor.type).toBe('system');
      expect(actor.id).toBe('gateway');
    });

    it('should create operator actor', () => {
      const actor = operatorActor();
      expect(actor.type).toBe('operator');
      expect(actor.id).toBe('operator');
    });

    it('should create sender actor with context', () => {
      const actor = senderActor('user@example.com', 'email');
      expect(actor.type).toBe('sender');
      expect(actor.id).toBe('user@example.com');
      expect(actor.context).toEqual({ channel: 'email' });
    });

    it('should create service actor', () => {
      const actor = serviceActor('sanitizer');
      expect(actor.type).toBe('service');
      expect(actor.id).toBe('sanitizer');
    });
  });
});
