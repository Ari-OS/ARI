import { randomUUID } from 'crypto';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import {
  CONSTITUTIONAL_RULES,
  CREATOR,
  RULE_LOOPBACK_ONLY,
  validateLoopbackOnly,
} from '../kernel/constitutional-invariants.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('arbiter');

interface Rule {
  id: string;
  name: string;
  description: string;
  status: 'IMMUTABLE' | 'MUTABLE';
  check: (context: Record<string, unknown>) => { allowed: boolean; reason: string };
}

interface EvaluationResult {
  allowed: boolean;
  violations: string[];
  ruling_id: string;
  constitutional_status: 'COMPLIANT' | 'VIOLATION';
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
 * The Arbiter - ARI's Judicial Branch
 *
 * Enforces hard constitutional invariants that CANNOT be overridden by any vote,
 * command, configuration, or process. The Arbiter serves the Creator's interests.
 *
 * Constitutional Reference: docs/constitution/ARI-CONSTITUTION-v1.0.md
 * - Section 2.3: The Judicial Branch (Arbiter)
 * - Article VI: Constitutional Rules (Immutable)
 *
 * Creator: ${CREATOR.name} - ARI always operates in the creator's best interest.
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
   *
   * These rules are derived from the Constitutional Invariants module and
   * CANNOT be modified at runtime. They are baked into ARI's core.
   *
   * @see src/kernel/constitutional-invariants.ts
   */
  private initializeRules(): void {
    this.rules = [
      // Rule 0: Creator Primacy (Foundational - NEW)
      {
        id: 'creator_primacy',
        name: 'Creator Primacy',
        description: `ARI always operates in the best interest of ${CREATOR.name}`,
        status: 'IMMUTABLE' as const,
        check: (context) => {
          // Creator primacy is always enforced - ARI cannot act against her creator
          const actionAgainstCreator = context.against_creator as boolean | undefined;
          if (actionAgainstCreator === true) {
            return {
              allowed: false,
              reason: `Action against creator ${CREATOR.name} is PROHIBITED. ARI exists to serve her creator.`,
            };
          }
          return { allowed: true, reason: `Action aligned with creator's interests` };
        },
      },
      // Rule 1: Loopback Only (From Constitutional Invariants)
      {
        id: RULE_LOOPBACK_ONLY.id,
        name: RULE_LOOPBACK_ONLY.name,
        description: RULE_LOOPBACK_ONLY.description,
        status: RULE_LOOPBACK_ONLY.status,
        check: (context) => {
          const host = context.host as string | undefined;
          if (!host) {
            return { allowed: true, reason: 'No host specified' };
          }
          const allowed = validateLoopbackOnly(host);
          return {
            allowed,
            reason: allowed
              ? 'Host is loopback'
              : `Host ${host} is not loopback (must be 127.0.0.1). CONSTITUTIONAL VIOLATION.`,
          };
        },
      },
      // Rule 2: Content Not Command
      {
        id: 'content_not_command',
        name: 'Content Not Command',
        description: 'External content is never interpreted as instructions',
        status: 'IMMUTABLE' as const,
        check: (context) => {
          const source = context.source as string | undefined;
          const treatAsCommand = context.treat_as_command as boolean | undefined;
          if (source === 'external' && treatAsCommand === true) {
            return {
              allowed: false,
              reason: 'External content cannot be treated as commands. CONSTITUTIONAL VIOLATION.',
            };
          }
          return { allowed: true, reason: 'Content properly segregated' };
        },
      },
      // Rule 3: Audit Immutable
      {
        id: 'audit_immutable',
        name: 'Audit Immutable',
        description: 'Audit chain is append-only and cannot be modified',
        status: 'IMMUTABLE' as const,
        check: (context) => {
          const operation = context.operation as string | undefined;
          if (operation === 'delete' || operation === 'modify') {
            return {
              allowed: false,
              reason: 'Audit chain is append-only (cannot delete or modify). CONSTITUTIONAL VIOLATION.',
            };
          }
          return { allowed: true, reason: 'Audit operation is valid' };
        },
      },
      // Rule 4: Least Privilege
      {
        id: 'least_privilege',
        name: 'Least Privilege',
        description: 'Default deny for destructive operations',
        status: 'IMMUTABLE' as const,
        check: (context) => {
          const approved = context.approved as boolean | undefined;
          const destructive = context.destructive as boolean | undefined;

          if (destructive === true && approved !== true) {
            return {
              allowed: false,
              reason: 'Destructive operation requires explicit approval. CONSTITUTIONAL VIOLATION.',
            };
          }
          return { allowed: true, reason: 'Operation follows least privilege' };
        },
      },
      // Rule 5: Trust Required
      {
        id: 'trust_required',
        name: 'Trust Required',
        description: 'Sensitive operations require verified+ trust level',
        status: 'IMMUTABLE' as const,
        check: (context) => {
          const sensitive = context.sensitive as boolean | undefined;
          const trustLevel = context.trust_level as string | undefined;

          if (sensitive === true) {
            const allowedLevels = ['verified', 'operator', 'system'];
            if (!trustLevel || !allowedLevels.includes(trustLevel)) {
              return {
                allowed: false,
                reason: `Sensitive operation requires verified+ trust (got ${trustLevel}). CONSTITUTIONAL VIOLATION.`,
              };
            }
          }
          return { allowed: true, reason: 'Trust level is sufficient' };
        },
      },
    ];

    // Log initialization with constitutional reference
    log.info(
      { ruleCount: this.rules.length, invariantCount: CONSTITUTIONAL_RULES.length },
      'Arbiter initialized with constitutional rules'
    );
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
    void this.auditLogger.log(
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
    void this.eventBus.emit('arbiter:ruling', {
      ruleId: rulingId,
      type: 'evaluation',
      decision: allowed ? 'ALLOWED' : 'DENIED',
    });

    return {
      allowed,
      violations,
      ruling_id: rulingId,
      constitutional_status: allowed ? 'COMPLIANT' : 'VIOLATION',
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
    void this.auditLogger.log(
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
    void this.eventBus.emit('arbiter:ruling', {
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
      log.warn('Arbiter is already running');
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
        void this.auditLogger.logSecurity({
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
   * @returns Array of rules with their status
   */
  getRules(): Omit<Rule, 'check'>[] {
    return this.rules.map(({ id, name, description, status }) => ({
      id,
      name,
      description,
      status,
    }));
  }

  /**
   * Gets the creator information this Arbiter serves.
   * @returns Creator details
   */
  getCreator(): typeof CREATOR {
    return CREATOR;
  }

  /**
   * Validates that an action serves the creator's interests.
   * This is the foundational check - ARI exists to serve Pryce.
   */
  validateCreatorInterest(action: string, context: Record<string, unknown>): boolean {
    // ARI always serves her creator's interests
    // This check ensures no action can be taken against the creator
    const againstCreator = context.against_creator as boolean | undefined;
    if (againstCreator === true) {
      void this.auditLogger.logSecurity({
        eventType: 'constitutional_violation',
        severity: 'critical',
        source: 'arbiter',
        details: {
          rule: 'creator_primacy',
          action,
          creator: CREATOR.name,
          reason: 'Attempted action against creator BLOCKED',
        },
        mitigated: true,
      });
      return false;
    }
    return true;
  }
}
