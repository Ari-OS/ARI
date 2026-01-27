import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Guardian } from '../../../src/agents/guardian.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import type { TrustLevel } from '../../../src/kernel/types.js';

describe('Guardian', () => {
  let guardian: Guardian;
  let auditLogger: AuditLogger;
  let eventBus: EventBus;
  let testAuditPath: string;

  beforeEach(() => {
    testAuditPath = join(tmpdir(), `audit-${randomUUID()}.json`);
    auditLogger = new AuditLogger(testAuditPath);
    eventBus = new EventBus();
    guardian = new Guardian(auditLogger, eventBus);
  });

  it('should assess clean message from system source with threat_level none and risk_score 0', () => {
    const content = 'Hello, this is a clean message';
    const source: TrustLevel = 'system';

    const assessment = guardian.assessThreat(content, source);

    expect(assessment.threat_level).toBe('none');
    expect(assessment.risk_score).toBe(0);
    expect(assessment.patterns_detected).toEqual([]);
    expect(assessment.should_block).toBe(false);
    expect(assessment.should_escalate).toBe(false);
  });

  it('should apply trust penalty to clean message from hostile source', () => {
    const content = 'Hello, this is a clean message';
    const source: TrustLevel = 'hostile';

    const assessment = guardian.assessThreat(content, source);

    // Trust penalty for hostile: 1.0 * 0.2 = 0.2
    expect(assessment.threat_level).toBe('none');
    expect(assessment.risk_score).toBe(0.2);
    expect(assessment.patterns_detected).toEqual([]);
    expect(assessment.should_block).toBe(false);
    expect(assessment.should_escalate).toBe(false);
  });

  it('should detect template injection pattern', () => {
    const content = 'Execute this: ${malicious.code}';
    const source: TrustLevel = 'standard';

    const assessment = guardian.assessThreat(content, source);

    expect(assessment.patterns_detected).toContain('template_injection');
    expect(assessment.risk_score).toBeGreaterThan(0.3);
  });

  it('should detect SQL injection pattern', () => {
    const content = 'SELECT * FROM users UNION SELECT password FROM admin';
    const source: TrustLevel = 'standard';

    const assessment = guardian.assessThreat(content, source);

    expect(assessment.patterns_detected).toContain('sql_injection');
    expect(assessment.risk_score).toBeGreaterThan(0.3);
  });

  it('should detect command injection pattern', () => {
    const content = 'Run this command: ; rm -rf /';
    const source: TrustLevel = 'standard';

    const assessment = guardian.assessThreat(content, source);

    expect(assessment.patterns_detected).toContain('command_injection');
    expect(assessment.risk_score).toBeGreaterThan(0.3);
  });

  it('should detect XSS attempt pattern', () => {
    const content = '<script>alert("XSS")</script>';
    const source: TrustLevel = 'standard';

    const assessment = guardian.assessThreat(content, source);

    expect(assessment.patterns_detected).toContain('xss_attempt');
    expect(assessment.risk_score).toBeGreaterThan(0.3);
  });

  it('should detect multiple patterns simultaneously', () => {
    const maliciousContent = '${' + 'eval' + '(' + 'exec' + '("../malicious.sh"))}' + '<script>alert("XSS")</script>';
    const source: TrustLevel = 'standard';

    const assessment = guardian.assessThreat(maliciousContent, source);

    expect(assessment.patterns_detected.length).toBeGreaterThan(1);
    expect(assessment.patterns_detected).toContain('template_injection');
    expect(assessment.patterns_detected).toContain('eval_injection');
    expect(assessment.patterns_detected).toContain('exec_injection');
    expect(assessment.patterns_detected).toContain('path_traversal');
    expect(assessment.patterns_detected).toContain('xss_attempt');
    expect(assessment.risk_score).toBeGreaterThan(0.5);
  });

  it('should escalate high risk from hostile source with injection', () => {
    const maliciousContent = 'eval' + '(maliciousCode); rm -rf /';
    const source: TrustLevel = 'hostile';

    const assessment = guardian.assessThreat(maliciousContent, source);

    expect(assessment.should_escalate).toBe(true);
    expect(assessment.risk_score).toBeGreaterThanOrEqual(0.6);
  });

  it('should handle start and stop lifecycle correctly', () => {
    expect(eventBus.listenerCount('message:accepted')).toBe(0);

    guardian.start();
    expect(eventBus.listenerCount('message:accepted')).toBe(1);

    guardian.stop();
    expect(eventBus.listenerCount('message:accepted')).toBe(0);
  });

  it('should track stats correctly after analyzing messages', () => {
    guardian.start();

    // Emit messages through the event bus to trigger analyzeMessage
    eventBus.emit('message:accepted', {
      id: randomUUID(),
      content: 'Clean message 1',
      source: 'system' as TrustLevel,
      timestamp: new Date(),
    });

    eventBus.emit('message:accepted', {
      id: randomUUID(),
      content: 'Clean message 2',
      source: 'standard' as TrustLevel,
      timestamp: new Date(),
    });

    eventBus.emit('message:accepted', {
      id: randomUUID(),
      content: '${injection}',
      source: 'untrusted' as TrustLevel,
      timestamp: new Date(),
    });

    eventBus.emit('message:accepted', {
      id: randomUUID(),
      content: 'eval' + '(code)',
      source: 'hostile' as TrustLevel,
      timestamp: new Date(),
    });

    const stats = guardian.getStats();

    expect(stats.baselines_tracked).toBeGreaterThan(0);
    expect(stats.recent_messages).toBeGreaterThan(0);
    expect(stats.injection_history_size).toBeGreaterThan(0);
  });
});
