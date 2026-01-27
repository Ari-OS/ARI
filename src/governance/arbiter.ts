import { randomUUID } from 'crypto';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';

interface Rule {
  id: string;
  name: string;
  description: string;
  check: (context: Record<string, unknown>) => { allowed: boolean; reason: string };
}

interface EvaluationResult {
  allowed: boolean;
  violations: string[];
  ruling_id: string;
}

interface Dispute {
  parties: string[];
  issue: string;
  context: Record<string, unknown>;
}

interface DisputeRuling {
  ruling: string;
  reasoning: string;
  binding: boolean;
}

/**
 * Constitutional enforcement agent.
 * Enforces hard invariants that cannot be overridden by any vote or process.
 */
export class Arbiter {
  private rules: Rule[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(
    private auditLogger: AuditLogger,
    private eventBus: EventBus
  ) {
    this.initializeRules();
  }

  /**
   * Initializes built-in constitutional rules.
   */
  private initializeRules(): void {
    this.rules = [
      {
        id: 'loopback_only',
        name: 'Loopback Only',
        description: 'Gateway must bind to 127.0.0.1 for security',
        check: (context) => {
          const host = context.host as string | undefined;
          if (!host) {
            return { allowed: true, reason: 'No host specified' };
          }
          const allowed = host === '127.0.0.1' || host === 'localhost';
          return {
            allowed,
            reason: allowed
              ? 'Host is loopback'
              : `Host ${host} is not loopback (must be 127.0.0.1)`,
          };
        },
      },
      {
        id: 'content_not_command',
        name: 'Content Not Command',
        description: 'External content is never interpreted as instructions',
        check: (context) => {
          const source = context.source as string | undefined;
          const treatAsCommand = context.treat_as_command as boolean | undefined;
          if (source === 'external' && treatAsCommand === true) {
            return {
              allowed: false,
              reason: 'External content cannot be treated as commands',
            };
          }
          return { allowed: true, reason: 'Content properly segregated' };
        },
      },
      {
        id: 'audit_immutable',
        name: 'Audit Immutable',
        description: 'Audit chain is append-only and cannot be modified',
        check: (context) => {
          const operation = context.operation as string | undefined;
          if (operation === 'delete' || operation === 'modify') {
            return {
              allowed: false,
              reason: 'Audit chain is append-only (cannot delete or modify)',
            };
          }
          return { allowed: true, reason: 'Audit operation is valid' };
        },
      },
      {
        id: 'least_privilege',
        name: 'Least Privilege',
        description: 'Default deny for destructive operations',
        check: (context) => {
          const operation = context.operation as string | undefined;
          const approved = context.approved as boolean | undefined;
          const destructive = context.destructive as boolean | undefined;

          if (destructive === true && approved !== true) {
            return {
              allowed: false,
              reason: 'Destructive operation requires explicit approval',
            };
          }
          return { allowed: true, reason: 'Operation follows least privilege' };
        },
      },
      {
        id: 'trust_required',
        name: 'Trust Required',
        description: 'Sensitive operations require verified+ trust level',
        check: (context) => {
          const sensitive = context.sensitive as boolean | undefined;
          const trustLevel = context.trust_level as string | undefined;

          if (sensitive === true) {
            const allowedLevels = ['verified', 'operator', 'system'];
            if (!trustLevel || !allowedLevels.includes(trustLevel)) {
              return {
                allowed: false,
                reason: `Sensitive operation requires verified+ trust (got ${trustLevel})`,
              };
            }
          }
          return { allowed: true, reason: 'Trust level is sufficient' };
        },
      },
    ];
  }

  /**
   * Evaluates an action against all constitutional rules.
   * @param action The action being evaluated
   * @param context Contextual data for the action
   * @returns Evaluation result with violations
   */
  evaluateAction(
    action: string,
    context: Record<string, unknown>
  ): EvaluationResult {
    const rulingId = randomUUID();
    const violations: string[] = [];

    for (const rule of this.rules) {
      const result = rule.check(context);
      if (!result.allowed) {
        violations.push(`${rule.name}: ${result.reason}`);
      }
    }

    const allowed = violations.length === 0;

    // Audit the evaluation
    this.auditLogger.log(
      'arbiter:evaluation',
      'arbiter',
      'system',
      {
        ruling_id: rulingId,
        action,
        allowed,
        violations,
        context,
      }
    );

    // Emit ruling event
    this.eventBus.emit('arbiter:ruling', {
      ruleId: rulingId,
      type: 'evaluation',
      decision: allowed ? 'ALLOWED' : 'DENIED',
    });

    return {
      allowed,
      violations,
      ruling_id: rulingId,
    };
  }

  /**
   * Handles a dispute between parties.
   * @param dispute The dispute details
   * @returns The ruling on the dispute
   */
  handleDispute(dispute: Dispute): DisputeRuling {
    const rulingId = randomUUID();

    // Evaluate the dispute context against constitutional rules
    const evaluation = this.evaluateAction('dispute_resolution', dispute.context);

    // Formulate ruling based on constitutional violations
    let ruling: string;
    let reasoning: string;

    if (evaluation.violations.length > 0) {
      ruling = 'DENIED';
      reasoning = `Constitutional violations detected: ${evaluation.violations.join('; ')}`;
    } else {
      ruling = 'REFER_TO_COUNCIL';
      reasoning = 'No constitutional violations found. Matter should be decided by council vote.';
    }

    // Audit the dispute
    this.auditLogger.log(
      'arbiter:dispute',
      'arbiter',
      'system',
      {
        ruling_id: rulingId,
        dispute,
        ruling,
        reasoning,
      }
    );

    // Emit ruling event
    this.eventBus.emit('arbiter:ruling', {
      ruleId: rulingId,
      type: 'dispute',
      decision: ruling,
    });

    return {
      ruling,
      reasoning,
      binding: true, // Arbiter rulings are always binding
    };
  }

  /**
   * Starts the arbiter by subscribing to security alerts.
   */
  start(): void {
    if (this.unsubscribe) {
      console.error('Arbiter is already running');
      return;
    }

    this.unsubscribe = this.eventBus.on('security:alert', (payload) => {
      // Evaluate security alerts against constitutional rules
      const evaluation = this.evaluateAction('security_alert', {
        type: payload.type,
        source: payload.source,
        ...payload.data,
      });

      if (!evaluation.allowed) {
        // Log critical security ruling
        this.auditLogger.logSecurity({
          eventType: 'unauthorized_access',
          severity: 'critical',
          source: 'arbiter',
          details: {
            alert: payload,
            violations: evaluation.violations,
          },
          mitigated: true,
        });
      }
    });
  }

  /**
   * Stops the arbiter by unsubscribing from events.
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Gets all constitutional rules.
   * @returns Array of rules
   */
  getRules(): Omit<Rule, 'check'>[] {
    return this.rules.map(({ id, name, description }) => ({
      id,
      name,
      description,
    }));
  }
}
