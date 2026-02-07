import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('stop-the-line');

/**
 * Authority type for stop-the-line operations.
 * Only operator and guardian can halt; only operator can resume.
 */
export type StopAuthority = 'operator' | 'guardian';

/**
 * Status information for the stop-the-line system.
 */
export interface StopStatus {
  halted: boolean;
  haltedBy: string | null;
  haltedAt: Date | null;
  reason: string | null;
}

/**
 * Stop-the-line service that can halt all proposal execution.
 *
 * Dual authority model:
 * - Halt: Can be initiated by either Operator or Guardian
 * - Resume: Can only be initiated by Operator
 *
 * When halted, no proposals should be executed. This is a critical
 * safety mechanism for emergency situations.
 */
export class StopTheLine {
  private halted = false;
  private haltedBy: string | null = null;
  private haltedAt: Date | null = null;
  private haltReason: string | null = null;

  constructor(
    private auditLogger: AuditLogger,
    private eventBus: EventBus
  ) {}

  /**
   * Halts all proposal execution.
   * Can be called by either operator or guardian.
   *
   * @param authority The authority initiating the halt (operator or guardian)
   * @param reason The reason for halting
   */
  halt(authority: StopAuthority, reason: string): void {
    if (this.halted) {
      // Already halted - log but don't error (idempotent)
      log.warn({ haltedBy: this.haltedBy }, 'System is already halted');
      return;
    }

    const timestamp = new Date();
    this.halted = true;
    this.haltedBy = authority;
    this.haltedAt = timestamp;
    this.haltReason = reason;

    // Audit the halt
    void this.auditLogger.log(
      'system:halt',
      authority,
      authority === 'operator' ? 'operator' : 'verified',
      {
        reason,
        timestamp: timestamp.toISOString(),
      }
    );

    // Emit system:halted event
    this.eventBus.emit('system:halted', {
      authority,
      reason,
      timestamp,
    });
  }

  /**
   * Resumes proposal execution.
   * Can only be called by operator.
   *
   * @param authority The authority attempting to resume (must be 'operator')
   * @throws Error if authority is not 'operator'
   */
  resume(authority: 'operator'): void {
    if (authority !== 'operator') {
      const error = 'Only operator can resume the system';
      log.error('Unauthorized resume attempt');
      throw new Error(error);
    }

    if (!this.halted) {
      log.warn('System is not halted, nothing to resume');
      return;
    }

    const timestamp = new Date();
    const previousHaltedBy = this.haltedBy;
    const previousReason = this.haltReason;

    // Clear halt state
    this.halted = false;
    this.haltedBy = null;
    this.haltedAt = null;
    this.haltReason = null;

    // Audit the resume
    void this.auditLogger.log(
      'system:resume',
      authority,
      'operator',
      {
        timestamp: timestamp.toISOString(),
        previous_halted_by: previousHaltedBy,
        previous_reason: previousReason,
      }
    );

    // Emit system:resumed event
    this.eventBus.emit('system:resumed', {
      authority,
      timestamp,
    });
  }

  /**
   * Checks if the system is currently halted.
   *
   * @returns true if halted, false otherwise
   */
  isHalted(): boolean {
    return this.halted;
  }

  /**
   * Gets the current status of the stop-the-line system.
   *
   * @returns Status information
   */
  getStatus(): StopStatus {
    return {
      halted: this.halted,
      haltedBy: this.haltedBy,
      haltedAt: this.haltedAt,
      reason: this.haltReason,
    };
  }
}
