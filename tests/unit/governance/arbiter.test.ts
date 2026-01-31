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
    expect(result.violations.some(v => v.includes('Loopback-Only Gateway'))).toBe(true);
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

  describe('stop', () => {
    it('should stop the arbiter and unsubscribe from events', () => {
      arbiter.start();
      arbiter.stop();
      // Should not throw and can be called again safely
      arbiter.stop();
    });

    it('should do nothing if not started', () => {
      // Should not throw when stopping without starting
      arbiter.stop();
    });
  });

  describe('getRules', () => {
    it('should return all constitutional rules', () => {
      const rules = arbiter.getRules();

      expect(rules).toHaveLength(6);
      expect(rules.map(r => r.id)).toContain('creator_primacy');
      expect(rules.map(r => r.id)).toContain('loopback_only');
      expect(rules.map(r => r.id)).toContain('content_not_command');
      expect(rules.map(r => r.id)).toContain('audit_immutable');
      expect(rules.map(r => r.id)).toContain('least_privilege');
      expect(rules.map(r => r.id)).toContain('trust_required');
    });

    it('should return rules with id, name, description, and status', () => {
      const rules = arbiter.getRules();

      for (const rule of rules) {
        expect(rule.id).toBeDefined();
        expect(rule.name).toBeDefined();
        expect(rule.description).toBeDefined();
        expect(rule.status).toBe('IMMUTABLE');
        // Should not have the check function
        expect((rule as Record<string, unknown>).check).toBeUndefined();
      }
    });
  });

  describe('Creator Primacy', () => {
    it('should block actions against the creator', () => {
      const result = arbiter.evaluateAction('action:against_creator', {
        against_creator: true,
      });

      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => v.includes('Creator Primacy'))).toBe(true);
      expect(result.constitutional_status).toBe('VIOLATION');
    });

    it('should allow actions in creator interest', () => {
      const result = arbiter.evaluateAction('action:for_creator', {
        against_creator: false,
      });

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.constitutional_status).toBe('COMPLIANT');
    });

    it('should return creator information', () => {
      const creator = arbiter.getCreator();

      expect(creator.name).toBe('Pryce Hedrick');
      expect(creator.github).toBe('PryceHedrick');
      expect(creator.role).toBe('Creator and Supreme Operator');
      expect(creator.primacy).toBe('absolute');
    });

    it('should validate creator interest through dedicated method', () => {
      // Action aligned with creator - should pass
      expect(arbiter.validateCreatorInterest('help', {})).toBe(true);

      // Action against creator - should fail
      expect(arbiter.validateCreatorInterest('harm', { against_creator: true })).toBe(false);
    });
  });
});
