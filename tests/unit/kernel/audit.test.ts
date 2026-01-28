import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

describe('AuditLogger', () => {
  let logger: AuditLogger;
  let testPath: string;

  beforeEach(() => {
    // Use a unique temp path for each test to avoid collisions
    testPath = join(tmpdir(), `ari-test-${randomUUID()}.json`);
    logger = new AuditLogger(testPath);
  });

  it('should create hash-chained audit events', async () => {
    const event1 = await logger.log('test_action_1', 'tester', 'system');
    const event2 = await logger.log('test_action_2', 'tester', 'system');

    // First event should chain from genesis hash
    expect(event1.previousHash).toBe('0'.repeat(64));
    // Second event should chain from first event's hash
    expect(event2.previousHash).toBe(event1.hash);
    // Hashes should be 64-char hex strings (SHA-256)
    expect(event1.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(event2.hash).toMatch(/^[a-f0-9]{64}$/);
    // Hashes should be different
    expect(event1.hash).not.toBe(event2.hash);
  });

  it('should verify chain integrity', async () => {
    await logger.log('action_1', 'tester', 'system');
    await logger.log('action_2', 'tester', 'verified');
    await logger.log('action_3', 'tester', 'standard');

    const result = await logger.verify();
    expect(result.valid).toBe(true);
    expect(result.details).toContain('3 events');
  });

  it('should log and retrieve security events', async () => {
    await logger.log('normal_action', 'user', 'standard');
    await logger.logSecurity({
      eventType: 'injection_detected',
      severity: 'high',
      source: 'test',
      details: { pattern: 'test_pattern' },
      mitigated: true,
    });

    const allEvents = logger.getEvents();
    const securityEvents = logger.getSecurityEvents();

    expect(allEvents).toHaveLength(2);
    expect(securityEvents).toHaveLength(1);
    expect(securityEvents[0].action).toBe('security_event');
  });
});
