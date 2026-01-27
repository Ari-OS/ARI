import { describe, it, expect, beforeEach } from 'vitest';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { Arbiter } from '../../../src/governance/arbiter.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';

describe('Arbiter', () => {
  let arbiter: Arbiter;
  let auditLogger: AuditLogger;
  let eventBus: EventBus;

  beforeEach(() => {
    const logPath = join(tmpdir(), `audit-${randomUUID()}.jsonl`);
    auditLogger = new AuditLogger(logPath);
    eventBus = new EventBus();
    arbiter = new Arbiter(auditLogger, eventBus);
  });

  it('should allow loopback IP 127.0.0.1', () => {
    const result = arbiter.evaluateAction('network:connect', {
      host: '127.0.0.1',
      port: 8080,
    });

    expect(result.allowed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.ruling_id).toBeDefined();
  });

  it('should block non-loopback IP 0.0.0.0 with violation', () => {
    const result = arbiter.evaluateAction('network:connect', {
      host: '0.0.0.0',
      port: 8080,
    });

    expect(result.allowed).toBe(false);
    expect(result.violations.some(v => v.includes('Loopback Only'))).toBe(true);
    expect(result.ruling_id).toBeDefined();
  });

  it('should block external content treated as command', () => {
    const result = arbiter.evaluateAction('content:process', {
      source: 'external',
      treat_as_command: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.violations.some(v => v.includes('Content Not Command'))).toBe(true);
    expect(result.ruling_id).toBeDefined();
  });

  it('should allow internal content treated as command', () => {
    const result = arbiter.evaluateAction('content:process', {
      source: 'internal',
      treat_as_command: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.ruling_id).toBeDefined();
  });

  it('should block audit delete operation', () => {
    const result = arbiter.evaluateAction('audit:modify', {
      operation: 'delete',
      target: 'audit_log',
    });

    expect(result.allowed).toBe(false);
    expect(result.violations.some(v => v.includes('Audit Immutable'))).toBe(true);
    expect(result.ruling_id).toBeDefined();
  });

  it('should allow audit append operation', () => {
    const result = arbiter.evaluateAction('audit:modify', {
      operation: 'append',
      target: 'audit_log',
    });

    expect(result.allowed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.ruling_id).toBeDefined();
  });

  it('should block destructive operation without approval', () => {
    const result = arbiter.evaluateAction('system:modify', {
      destructive: true,
      approved: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.violations.some(v => v.includes('Least Privilege'))).toBe(true);
    expect(result.ruling_id).toBeDefined();
  });

  it('should block sensitive operation with untrusted trust level', () => {
    const result = arbiter.evaluateAction('sensitive:operation', {
      sensitive: true,
      trust_level: 'untrusted',
    });

    expect(result.allowed).toBe(false);
    expect(result.violations.some(v => v.includes('Trust Required'))).toBe(true);
    expect(result.ruling_id).toBeDefined();
  });

  it('should allow sensitive operation with verified trust level', () => {
    const result = arbiter.evaluateAction('sensitive:operation', {
      sensitive: true,
      trust_level: 'verified',
    });

    expect(result.allowed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.ruling_id).toBeDefined();
  });

  it('should return DENIED ruling for dispute with violations', () => {
    // First create a violation context
    const evaluationResult = arbiter.evaluateAction('network:connect', {
      host: '0.0.0.0',
      port: 8080,
    });

    expect(evaluationResult.allowed).toBe(false);

    const dispute = arbiter.handleDispute({
      parties: ['router', 'guardian'],
      issue: 'Network connection to non-loopback address',
      context: {
        host: '0.0.0.0',
        port: 8080,
        action: 'network:connect',
        violations: evaluationResult.violations,
      },
    });

    expect(dispute.ruling).toContain('DENIED');
    expect(dispute.reasoning).toBeDefined();
    expect(dispute.binding).toBe(true);
  });
});
