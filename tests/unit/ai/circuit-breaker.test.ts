import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker } from '../../../src/ai/circuit-breaker.js';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker();
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(cb.getState()).toBe('CLOSED');
    });

    it('should allow execution when CLOSED', () => {
      expect(cb.canExecute()).toBe(true);
    });

    it('should have zero failures', () => {
      const stats = cb.getStats();
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.lastFailure).toBeNull();
    });
  });

  describe('CLOSED → OPEN transition', () => {
    it('should open after 5 failures (default threshold)', () => {
      for (let i = 0; i < 5; i++) {
        cb.recordFailure();
      }
      expect(cb.getState()).toBe('OPEN');
    });

    it('should not open before reaching threshold', () => {
      for (let i = 0; i < 4; i++) {
        cb.recordFailure();
      }
      expect(cb.getState()).toBe('CLOSED');
      expect(cb.canExecute()).toBe(true);
    });

    it('should block execution when OPEN', () => {
      for (let i = 0; i < 5; i++) {
        cb.recordFailure();
      }
      expect(cb.canExecute()).toBe(false);
    });
  });

  describe('OPEN → HALF_OPEN transition', () => {
    it('should transition to HALF_OPEN after recovery timeout', () => {
      // Use custom short timeout for testing
      cb = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeoutMs: 100,
      });

      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe('OPEN');

      // Use fake timers
      vi.useFakeTimers();
      vi.advanceTimersByTime(150);

      expect(cb.canExecute()).toBe(true);
      expect(cb.getState()).toBe('HALF_OPEN');

      vi.useRealTimers();
    });
  });

  describe('HALF_OPEN → CLOSED transition', () => {
    it('should close after sufficient successes in HALF_OPEN', () => {
      cb = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeoutMs: 100,
        halfOpenSuccessThreshold: 2,
      });

      // Trip to OPEN
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe('OPEN');

      // Wait for recovery
      vi.useFakeTimers();
      vi.advanceTimersByTime(150);
      cb.canExecute(); // Triggers HALF_OPEN transition

      // Record successes
      cb.recordSuccess();
      cb.recordSuccess();
      expect(cb.getState()).toBe('CLOSED');

      vi.useRealTimers();
    });
  });

  describe('HALF_OPEN → OPEN on failure', () => {
    it('should reopen on failure in HALF_OPEN', () => {
      cb = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeoutMs: 100,
      });

      // Trip to OPEN
      cb.recordFailure();
      cb.recordFailure();

      // Wait for recovery
      vi.useFakeTimers();
      vi.advanceTimersByTime(150);
      cb.canExecute(); // HALF_OPEN

      // Fail again
      cb.recordFailure();
      expect(cb.getState()).toBe('OPEN');

      vi.useRealTimers();
    });
  });

  describe('reset', () => {
    it('should reset to CLOSED with zero counters', () => {
      cb.recordFailure();
      cb.recordFailure();
      cb.recordFailure();
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe('OPEN');

      cb.reset();
      expect(cb.getState()).toBe('CLOSED');
      expect(cb.canExecute()).toBe(true);
      expect(cb.getStats().failures).toBe(0);
    });
  });

  describe('custom configuration', () => {
    it('should respect custom failure threshold', () => {
      cb = new CircuitBreaker({ failureThreshold: 3 });

      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe('CLOSED');

      cb.recordFailure();
      expect(cb.getState()).toBe('OPEN');
    });
  });

  describe('failure window', () => {
    it('should only count failures within window', () => {
      cb = new CircuitBreaker({
        failureThreshold: 3,
        failureWindowMs: 200,
      });

      vi.useFakeTimers();

      cb.recordFailure();
      cb.recordFailure();
      // Advance past window
      vi.advanceTimersByTime(250);
      cb.recordFailure();

      // Only 1 failure in current window
      expect(cb.getState()).toBe('CLOSED');

      vi.useRealTimers();
    });
  });

  describe('getStats', () => {
    it('should track failure count and last failure time', () => {
      cb.recordFailure();
      const stats = cb.getStats();
      expect(stats.failures).toBeGreaterThan(0);
      expect(stats.lastFailure).not.toBeNull();
      expect(stats.state).toBe('CLOSED');
    });

    it('should show zero successes in CLOSED state', () => {
      // Successes are only tracked during HALF_OPEN state
      cb.recordSuccess();
      cb.recordSuccess();
      const stats = cb.getStats();
      expect(stats.successes).toBe(0); // Not tracked in CLOSED
    });
  });
});
