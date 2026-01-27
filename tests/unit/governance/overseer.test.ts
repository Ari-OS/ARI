import { describe, it, expect, beforeEach } from 'vitest';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { Overseer } from '../../../src/governance/overseer.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';

describe('Overseer', () => {
  let overseer: Overseer;
  let auditLogger: AuditLogger;
  let eventBus: EventBus;

  beforeEach(() => {
    const logPath = join(tmpdir(), `audit-${randomUUID()}.jsonl`);
    auditLogger = new AuditLogger(logPath);
    eventBus = new EventBus();
    overseer = new Overseer(auditLogger, eventBus);
  });

  it('should pass test coverage gate when test_results.passed is true', () => {
    const result = overseer.evaluateGate('test_coverage', {
      test_results: {
        passed: true,
        total: 100,
        failed: 0,
      },
    });

    expect(result.passed).toBe(true);
    expect(result.gate_id).toBe('test_coverage');
    expect(result.reason).toBeDefined();
  });

  it('should fail test coverage gate when test_results.passed is false', () => {
    const result = overseer.evaluateGate('test_coverage', {
      test_results: {
        passed: false,
        total: 100,
        failed: 5,
      },
    });

    expect(result.passed).toBe(false);
    expect(result.gate_id).toBe('test_coverage');
    expect(result.reason).toBeDefined();
  });

  it('should fail audit integrity gate when audit_valid is false', () => {
    const result = overseer.evaluateGate('audit_integrity', {
      audit_valid: false,
    });

    expect(result.passed).toBe(false);
    expect(result.gate_id).toBe('audit_integrity');
    expect(result.reason).toBeDefined();
  });

  it('should pass security scan gate when critical_security_events is 0', () => {
    const result = overseer.evaluateGate('security_scan', {
      critical_security_events: 0,
      total_security_events: 5,
    });

    expect(result.passed).toBe(true);
    expect(result.gate_id).toBe('security_scan');
    expect(result.reason).toBeDefined();
  });

  it('should fail security scan gate when critical_security_events is greater than 0', () => {
    const result = overseer.evaluateGate('security_scan', {
      critical_security_events: 2,
      total_security_events: 10,
    });

    expect(result.passed).toBe(false);
    expect(result.gate_id).toBe('security_scan');
    expect(result.reason).toBeDefined();
  });

  it('should return approved true when all gates pass', () => {
    const context = {
      test_results: {
        passed: true,
      },
      audit_valid: true,
      critical_security_events: 0,
      build_success: true,
      existing_docs: ['README.md', 'API.md', 'ARCHITECTURE.md'],
      required_docs: ['README.md', 'API.md'],
    };

    const approval = overseer.canRelease(context);

    expect(approval.approved).toBe(true);
    expect(approval.blockers).toHaveLength(0);
  });

  it('should return approved false with blockers when any gate fails', () => {
    const context = {
      test_results: {
        passed: false,
      },
      audit_valid: true,
      critical_security_events: 1,
      build_success: true,
      existing_docs: ['README.md'],
      required_docs: ['README.md', 'API.md'],
    };

    const approval = overseer.canRelease(context);

    expect(approval.approved).toBe(false);
    expect(approval.blockers.length).toBeGreaterThan(0);
    expect(approval.blockers.some(b => b.includes('test_coverage'))).toBe(true);
    expect(approval.blockers.some(b => b.includes('security_scan'))).toBe(true);
  });

  it('should return 5 quality gates', () => {
    const gates = overseer.getGates();

    expect(gates).toHaveLength(5);
    expect(gates.map(g => g.id)).toContain('test_coverage');
    expect(gates.map(g => g.id)).toContain('audit_integrity');
    expect(gates.map(g => g.id)).toContain('security_scan');
    expect(gates.map(g => g.id)).toContain('build_clean');
    expect(gates.map(g => g.id)).toContain('documentation');

    gates.forEach(gate => {
      expect(gate.id).toBeDefined();
      expect(gate.name).toBeDefined();
      expect(gate.description).toBeDefined();
    });
  });
});
