import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('overseer');

interface QualityGate {
  id: string;
  name: string;
  description: string;
  check: (context: Record<string, unknown>) => { passed: boolean; reason: string; details?: Record<string, unknown> };
}

interface GateResult {
  passed: boolean;
  reason: string;
  details?: Record<string, unknown>;
  gate_id: string;
}

interface ReleaseApproval {
  approved: boolean;
  blockers: string[];
}

/**
 * Quality gate enforcement agent.
 * Enforces quality standards before releases and deployments.
 */
export class Overseer {
  private gates: QualityGate[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(
    private auditLogger: AuditLogger,
    private eventBus: EventBus
  ) {
    this.initializeGates();
  }

  /**
   * Initializes built-in quality gates.
   */
  private initializeGates(): void {
    this.gates = [
      {
        id: 'test_coverage',
        name: 'Test Coverage',
        description: 'All tests must pass',
        check: (context) => {
          const testResults = context.test_results as { passed: boolean; total?: number; failed?: number } | undefined;
          if (!testResults) {
            return {
              passed: false,
              reason: 'No test results provided',
            };
          }
          return {
            passed: testResults.passed === true,
            reason: testResults.passed
              ? 'All tests passed'
              : `Tests failed (${testResults.failed || 0}/${testResults.total || 0})`,
            details: testResults,
          };
        },
      },
      {
        id: 'audit_integrity',
        name: 'Audit Integrity',
        description: 'Audit chain must be valid',
        check: (context) => {
          const auditValid = context.audit_valid as boolean | undefined;
          const details = context.audit_details as Record<string, unknown> | undefined;
          if (auditValid === undefined) {
            return {
              passed: false,
              reason: 'Audit integrity not verified',
            };
          }
          return {
            passed: auditValid,
            reason: auditValid ? 'Audit chain is valid' : 'Audit chain is corrupted',
            details,
          };
        },
      },
      {
        id: 'security_scan',
        name: 'Security Scan',
        description: 'No critical security events in recent history',
        check: (context) => {
          const criticalEvents = context.critical_security_events as number | undefined;
          const timeWindow = context.time_window_hours as number | undefined || 24;
          if (criticalEvents === undefined) {
            return {
              passed: false,
              reason: 'Security scan not performed',
            };
          }
          return {
            passed: criticalEvents === 0,
            reason: criticalEvents === 0
              ? `No critical security events in last ${timeWindow} hours`
              : `${criticalEvents} critical security events in last ${timeWindow} hours`,
            details: { critical_events: criticalEvents, time_window_hours: timeWindow },
          };
        },
      },
      {
        id: 'build_clean',
        name: 'Build Clean',
        description: 'TypeScript compilation must succeed',
        check: (context) => {
          const buildSuccess = context.build_success as boolean | undefined;
          const errors = context.build_errors as string[] | undefined;
          if (buildSuccess === undefined) {
            return {
              passed: false,
              reason: 'Build status not provided',
            };
          }
          return {
            passed: buildSuccess,
            reason: buildSuccess
              ? 'Build completed successfully'
              : `Build failed with ${errors?.length || 0} errors`,
            details: { errors },
          };
        },
      },
      {
        id: 'documentation',
        name: 'Documentation',
        description: 'Key documentation files must exist',
        check: (context) => {
          const requiredDocs = context.required_docs as string[] | undefined || ['README.md', 'CLAUDE.md'];
          const existingDocs = context.existing_docs as string[] | undefined || [];
          const missing = requiredDocs.filter(doc => !existingDocs.includes(doc));
          return {
            passed: missing.length === 0,
            reason: missing.length === 0
              ? 'All required documentation exists'
              : `Missing documentation: ${missing.join(', ')}`,
            details: { required: requiredDocs, existing: existingDocs, missing },
          };
        },
      },
    ];
  }

  /**
   * Evaluates a specific quality gate.
   * @param gateId The gate ID
   * @param context Contextual data for evaluation
   * @returns Gate evaluation result
   */
  evaluateGate(gateId: string, context: Record<string, unknown>): GateResult {
    const gate = this.gates.find(g => g.id === gateId);
    if (!gate) {
      log.error({ gateId }, 'Gate not found');
      return {
        passed: false,
        reason: `Gate ${gateId} not found`,
        gate_id: gateId,
      };
    }

    const result = gate.check(context);
    const gateResult: GateResult = {
      ...result,
      gate_id: gateId,
    };

    // Audit the gate evaluation
    void this.auditLogger.log(
      'overseer:gate_evaluation',
      'overseer',
      'system',
      {
        gate_id: gateId,
        gate_name: gate.name,
        passed: result.passed,
        reason: result.reason,
        context,
      }
    );

    // Emit gate event
    void this.eventBus.emit('overseer:gate', {
      gateId,
      passed: result.passed,
      reason: result.reason,
    });

    return gateResult;
  }

  /**
   * Evaluates all quality gates.
   * @param context Contextual data for evaluation
   * @returns Array of gate evaluation results
   */
  evaluateAllGates(context: Record<string, unknown>): GateResult[] {
    return this.gates.map(gate => this.evaluateGate(gate.id, context));
  }

  /**
   * Determines if a release can proceed based on all quality gates.
   * @param context Contextual data for evaluation
   * @returns Release approval decision
   */
  canRelease(context: Record<string, unknown>): ReleaseApproval {
    const results = this.evaluateAllGates(context);
    const failures = results.filter(r => !r.passed);

    const approved = failures.length === 0;
    const blockers = failures.map(f => `${f.gate_id}: ${f.reason}`);

    // Audit the release decision
    void this.auditLogger.log(
      'overseer:release_decision',
      'overseer',
      'system',
      {
        approved,
        blockers,
        total_gates: results.length,
        passed_gates: results.filter(r => r.passed).length,
      }
    );

    return {
      approved,
      blockers,
    };
  }

  /**
   * Starts the overseer by subscribing to security alerts.
   */
  start(): void {
    if (this.unsubscribe) {
      log.warn('Overseer is already running');
      return;
    }

    this.unsubscribe = this.eventBus.on('security:alert', (payload) => {
      // Evaluate security alerts against security scan gate
      const context = {
        critical_security_events: payload.data.severity === 'critical' ? 1 : 0,
        time_window_hours: 1, // Immediate alert
        alert_type: payload.type,
        alert_source: payload.source,
      };

      const result = this.evaluateGate('security_scan', context);

      if (!result.passed) {
        // Log the security gate failure
        void this.auditLogger.logSecurity({
          eventType: 'unauthorized_access',
          severity: 'high',
          source: 'overseer',
          details: {
            gate_id: 'security_scan',
            alert: payload,
            reason: result.reason,
          },
          mitigated: false,
        });
      }
    });
  }

  /**
   * Stops the overseer by unsubscribing from events.
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Gets all quality gates.
   * @returns Array of gates
   */
  getGates(): Omit<QualityGate, 'check'>[] {
    return this.gates.map(({ id, name, description }) => ({
      id,
      name,
      description,
    }));
  }
}
