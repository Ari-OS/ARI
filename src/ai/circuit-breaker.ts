import type { CircuitState, CircuitBreakerConfig } from './types.js';
import { CircuitBreakerConfigSchema } from './types.js';

/**
 * Circuit Breaker implementation for AI provider failure protection.
 *
 * Three-state pattern:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Too many failures, reject all requests
 * - HALF_OPEN: Testing recovery, allow limited requests
 *
 * State transitions:
 * - CLOSED → OPEN: failureThreshold failures within failureWindowMs
 * - OPEN → HALF_OPEN: After recoveryTimeoutMs
 * - HALF_OPEN → CLOSED: halfOpenSuccessThreshold consecutive successes
 * - HALF_OPEN → OPEN: Any failure
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: { timestamp: number }[] = [];
  private halfOpenSuccesses: number = 0;
  private lastFailureTime: number | null = null;
  private openedAt: number | null = null;
  private readonly config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = CircuitBreakerConfigSchema.parse(config ?? {});
  }

  /**
   * Check if circuit allows execution.
   *
   * - CLOSED: Always allow
   * - OPEN: Allow only if recovery timeout has elapsed (transitions to HALF_OPEN)
   * - HALF_OPEN: Allow test request
   */
  canExecute(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      if (this.shouldAttemptRecovery()) {
        this.transitionToHalfOpen();
        return true;
      }
      return false;
    }

    // HALF_OPEN: allow test request
    return true;
  }

  /**
   * Record successful execution.
   *
   * - CLOSED: Clear old failures from window
   * - HALF_OPEN: Increment success counter, transition to CLOSED if threshold met
   * - OPEN: Should not occur (canExecute prevents execution)
   */
  recordSuccess(): void {
    if (this.state === 'CLOSED') {
      this.pruneOldFailures();
      return;
    }

    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.config.halfOpenSuccessThreshold) {
        this.transitionToClosed();
      }
    }
  }

  /**
   * Record failed execution.
   *
   * - CLOSED: Add failure, check if threshold exceeded
   * - HALF_OPEN: Immediately transition to OPEN
   * - OPEN: Update last failure time
   */
  recordFailure(): void {
    const now = Date.now();
    this.lastFailureTime = now;

    if (this.state === 'CLOSED') {
      this.failures.push({ timestamp: now });
      this.pruneOldFailures();

      if (this.failures.length >= this.config.failureThreshold) {
        this.transitionToOpen();
      }
      return;
    }

    if (this.state === 'HALF_OPEN') {
      this.transitionToOpen();
      return;
    }

    // OPEN: just update lastFailureTime
  }

  /**
   * Get current circuit state.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics.
   */
  getStats(): {
    failures: number;
    successes: number;
    state: CircuitState;
    lastFailure: Date | null;
  } {
    return {
      failures: this.failures.length,
      successes: this.state === 'HALF_OPEN' ? this.halfOpenSuccesses : 0,
      state: this.state,
      lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime) : null,
    };
  }

  /**
   * Reset circuit to CLOSED state, clear all failures.
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = [];
    this.halfOpenSuccesses = 0;
    this.lastFailureTime = null;
    this.openedAt = null;
  }

  /**
   * Check if recovery timeout has elapsed since circuit opened.
   */
  private shouldAttemptRecovery(): boolean {
    if (!this.openedAt) {
      return false;
    }

    const elapsed = Date.now() - this.openedAt;
    return elapsed >= this.config.recoveryTimeoutMs;
  }

  /**
   * Remove failures outside the failure window.
   */
  private pruneOldFailures(): void {
    const cutoff = Date.now() - this.config.failureWindowMs;
    this.failures = this.failures.filter(f => f.timestamp >= cutoff);
  }

  /**
   * Transition to CLOSED state.
   * Clear failures and reset counters.
   */
  private transitionToClosed(): void {
    this.state = 'CLOSED';
    this.failures = [];
    this.halfOpenSuccesses = 0;
    this.openedAt = null;
  }

  /**
   * Transition to OPEN state.
   * Record when circuit opened and reset half-open counters.
   */
  private transitionToOpen(): void {
    this.state = 'OPEN';
    this.openedAt = Date.now();
    this.halfOpenSuccesses = 0;
  }

  /**
   * Transition to HALF_OPEN state.
   * Reset success counter for testing recovery.
   */
  private transitionToHalfOpen(): void {
    this.state = 'HALF_OPEN';
    this.halfOpenSuccesses = 0;
  }
}
