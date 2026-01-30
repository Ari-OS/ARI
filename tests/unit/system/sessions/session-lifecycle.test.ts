import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SessionLifecycleManager } from '../../../../src/system/sessions/session-lifecycle.js';
import type { Session, SessionLifecycleConfig, SessionEvent } from '../../../../src/system/sessions/types.js';

describe('SessionLifecycleManager', () => {
  let lifecycle: SessionLifecycleManager;

  // Helper to create a test session
  const createTestSession = (overrides?: Partial<Session>): Session => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    channel: 'pushover',
    senderId: 'user123',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastActivity: new Date().toISOString(),
    context: {
      contextId: undefined,
      summary: undefined,
      currentTask: undefined,
      activeTools: [],
      pendingResponses: [],
      lastMessageId: undefined,
    },
    memoryPartition: 'session:pushover:user123:abc123',
    trustLevel: 'standard',
    status: 'active',
    metadata: {
      name: undefined,
      tags: [],
      custom: {},
    },
    stats: {
      messageCount: 0,
      inboundCount: 0,
      outboundCount: 0,
      toolExecutions: 0,
      duration: 0,
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    lifecycle = new SessionLifecycleManager({
      idleTimeout: 60000, // 1 minute
      suspendTimeout: 120000, // 2 minutes
      closeTimeout: 300000, // 5 minutes
      maxSessionsPerSender: 5,
      maxTotalSessions: 100,
      cleanupInterval: 30000, // 30 seconds
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should use provided config', () => {
      const config = lifecycle.getConfig();

      expect(config.idleTimeout).toBe(60000);
      expect(config.suspendTimeout).toBe(120000);
      expect(config.closeTimeout).toBe(300000);
    });

    it('should merge with defaults for partial config', () => {
      const partial = new SessionLifecycleManager({
        idleTimeout: 30000,
      });
      const config = partial.getConfig();

      expect(config.idleTimeout).toBe(30000);
      expect(config.maxSessionsPerSender).toBe(10); // Default
    });

    it('should use defaults when no config provided', () => {
      const defaultLifecycle = new SessionLifecycleManager();
      const config = defaultLifecycle.getConfig();

      expect(config.idleTimeout).toBe(5 * 60 * 1000);
      expect(config.suspendTimeout).toBe(30 * 60 * 1000);
      expect(config.closeTimeout).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('onEvent', () => {
    it('should register event callback', () => {
      const callback = vi.fn();
      lifecycle.onEvent(callback);

      const session = createTestSession();
      lifecycle.transitionToIdle(session);

      expect(callback).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = lifecycle.onEvent(callback);

      unsubscribe();

      const session = createTestSession();
      lifecycle.transitionToIdle(session);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      lifecycle.onEvent(callback1);
      lifecycle.onEvent(callback2);

      const session = createTestSession();
      lifecycle.transitionToIdle(session);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should continue if one callback throws', () => {
      const callback1 = vi.fn(() => { throw new Error('Test error'); });
      const callback2 = vi.fn();
      lifecycle.onEvent(callback1);
      lifecycle.onEvent(callback2);

      const session = createTestSession();

      // Should not throw
      expect(() => lifecycle.transitionToIdle(session)).not.toThrow();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('shouldBecomeIdle', () => {
    it('should return true for active session past idle timeout', () => {
      const session = createTestSession({
        status: 'active',
        lastActivity: new Date(Date.now() - 70000).toISOString(), // 70 seconds ago
      });

      expect(lifecycle.shouldBecomeIdle(session)).toBe(true);
    });

    it('should return false for active session within idle timeout', () => {
      const session = createTestSession({
        status: 'active',
        lastActivity: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
      });

      expect(lifecycle.shouldBecomeIdle(session)).toBe(false);
    });

    it('should return false for non-active session', () => {
      const session = createTestSession({
        status: 'idle',
        lastActivity: new Date(Date.now() - 70000).toISOString(),
      });

      expect(lifecycle.shouldBecomeIdle(session)).toBe(false);
    });
  });

  describe('shouldSuspend', () => {
    it('should return true for idle session past suspend timeout', () => {
      const session = createTestSession({
        status: 'idle',
        lastActivity: new Date(Date.now() - 130000).toISOString(), // 130 seconds ago
      });

      expect(lifecycle.shouldSuspend(session)).toBe(true);
    });

    it('should return false for idle session within suspend timeout', () => {
      const session = createTestSession({
        status: 'idle',
        lastActivity: new Date(Date.now() - 60000).toISOString(), // 60 seconds ago
      });

      expect(lifecycle.shouldSuspend(session)).toBe(false);
    });

    it('should return false for non-idle session', () => {
      const session = createTestSession({
        status: 'active',
        lastActivity: new Date(Date.now() - 130000).toISOString(),
      });

      expect(lifecycle.shouldSuspend(session)).toBe(false);
    });
  });

  describe('shouldClose', () => {
    it('should return true for suspended session past close timeout', () => {
      const session = createTestSession({
        status: 'suspended',
        lastActivity: new Date(Date.now() - 310000).toISOString(), // 310 seconds ago
      });

      expect(lifecycle.shouldClose(session)).toBe(true);
    });

    it('should return false for suspended session within close timeout', () => {
      const session = createTestSession({
        status: 'suspended',
        lastActivity: new Date(Date.now() - 200000).toISOString(), // 200 seconds ago
      });

      expect(lifecycle.shouldClose(session)).toBe(false);
    });

    it('should return false for non-suspended session', () => {
      const session = createTestSession({
        status: 'idle',
        lastActivity: new Date(Date.now() - 310000).toISOString(),
      });

      expect(lifecycle.shouldClose(session)).toBe(false);
    });
  });

  describe('isExpired', () => {
    it('should return true for session past expiresAt', () => {
      const session = createTestSession({
        expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
      });

      expect(lifecycle.isExpired(session)).toBe(true);
    });

    it('should return false for session before expiresAt', () => {
      const session = createTestSession({
        expiresAt: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
      });

      expect(lifecycle.isExpired(session)).toBe(false);
    });

    it('should return false for session without expiresAt', () => {
      const session = createTestSession();

      expect(lifecycle.isExpired(session)).toBe(false);
    });
  });

  describe('transitionToIdle', () => {
    it('should transition active session to idle', () => {
      const session = createTestSession({ status: 'active' });
      const updated = lifecycle.transitionToIdle(session);

      expect(updated.status).toBe('idle');
    });

    it('should emit updated event', () => {
      const callback = vi.fn();
      lifecycle.onEvent(callback);

      const session = createTestSession({ status: 'active' });
      lifecycle.transitionToIdle(session);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'updated',
        sessionId: session.id,
        details: expect.objectContaining({
          previousStatus: 'active',
          newStatus: 'idle',
        }),
      }));
    });

    it('should return unchanged session if not active', () => {
      const session = createTestSession({ status: 'idle' });
      const updated = lifecycle.transitionToIdle(session);

      expect(updated).toBe(session);
    });
  });

  describe('transitionToSuspended', () => {
    it('should transition idle session to suspended', () => {
      const session = createTestSession({ status: 'idle' });
      const updated = lifecycle.transitionToSuspended(session);

      expect(updated.status).toBe('suspended');
    });

    it('should emit suspended event', () => {
      const callback = vi.fn();
      lifecycle.onEvent(callback);

      const session = createTestSession({ status: 'idle' });
      lifecycle.transitionToSuspended(session);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'suspended',
        sessionId: session.id,
      }));
    });

    it('should return unchanged session if not idle', () => {
      const session = createTestSession({ status: 'active' });
      const updated = lifecycle.transitionToSuspended(session);

      expect(updated).toBe(session);
    });
  });

  describe('transitionToClosed', () => {
    it('should transition any session to closed', () => {
      const activeSession = createTestSession({ status: 'active' });
      const idleSession = createTestSession({ status: 'idle' });
      const suspendedSession = createTestSession({ status: 'suspended' });

      expect(lifecycle.transitionToClosed(activeSession).status).toBe('closed');
      expect(lifecycle.transitionToClosed(idleSession).status).toBe('closed');
      expect(lifecycle.transitionToClosed(suspendedSession).status).toBe('closed');
    });

    it('should emit closed event with reason', () => {
      const callback = vi.fn();
      lifecycle.onEvent(callback);

      const session = createTestSession({ status: 'active' });
      lifecycle.transitionToClosed(session, 'user_request');

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'closed',
        sessionId: session.id,
        details: expect.objectContaining({
          previousStatus: 'active',
          reason: 'user_request',
        }),
      }));
    });

    it('should use default reason if not provided', () => {
      const callback = vi.fn();
      lifecycle.onEvent(callback);

      const session = createTestSession({ status: 'active' });
      lifecycle.transitionToClosed(session);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        details: expect.objectContaining({
          reason: 'timeout',
        }),
      }));
    });
  });

  describe('resume', () => {
    it('should resume idle session to active', () => {
      const session = createTestSession({ status: 'idle' });
      const updated = lifecycle.resume(session);

      expect(updated.status).toBe('active');
    });

    it('should resume suspended session to active', () => {
      const session = createTestSession({ status: 'suspended' });
      const updated = lifecycle.resume(session);

      expect(updated.status).toBe('active');
    });

    it('should update lastActivity', () => {
      const oldTime = new Date(Date.now() - 60000).toISOString();
      const session = createTestSession({
        status: 'idle',
        lastActivity: oldTime,
      });
      const updated = lifecycle.resume(session);

      expect(new Date(updated.lastActivity).getTime())
        .toBeGreaterThan(new Date(oldTime).getTime());
    });

    it('should emit resumed event', () => {
      const callback = vi.fn();
      lifecycle.onEvent(callback);

      const session = createTestSession({ status: 'idle' });
      lifecycle.resume(session);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'resumed',
        sessionId: session.id,
        details: expect.objectContaining({
          previousStatus: 'idle',
        }),
      }));
    });

    it('should return unchanged if already active', () => {
      const session = createTestSession({ status: 'active' });
      const updated = lifecycle.resume(session);

      expect(updated).toBe(session);
    });

    it('should return unchanged if closed', () => {
      const session = createTestSession({ status: 'closed' });
      const updated = lifecycle.resume(session);

      expect(updated).toBe(session);
    });
  });

  describe('touch', () => {
    it('should update lastActivity for active session', () => {
      const oldTime = new Date(Date.now() - 60000).toISOString();
      const session = createTestSession({
        status: 'active',
        lastActivity: oldTime,
      });
      const updated = lifecycle.touch(session);

      expect(new Date(updated.lastActivity).getTime())
        .toBeGreaterThan(new Date(oldTime).getTime());
    });

    it('should auto-resume idle session', () => {
      const session = createTestSession({ status: 'idle' });
      const updated = lifecycle.touch(session);

      expect(updated.status).toBe('active');
    });

    it('should auto-resume suspended session', () => {
      const session = createTestSession({ status: 'suspended' });
      const updated = lifecycle.touch(session);

      expect(updated.status).toBe('active');
    });

    it('should emit activity event', () => {
      const callback = vi.fn();
      lifecycle.onEvent(callback);

      const session = createTestSession({ status: 'active' });
      lifecycle.touch(session);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'activity',
        sessionId: session.id,
      }));
    });

    it('should emit activity event with autoResumed for idle/suspended', () => {
      const callback = vi.fn();
      lifecycle.onEvent(callback);

      const session = createTestSession({ status: 'idle' });
      lifecycle.touch(session);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'activity',
        details: expect.objectContaining({
          autoResumed: true,
          previousStatus: 'idle',
        }),
      }));
    });
  });

  describe('processLifecycle', () => {
    it('should transition active session to idle', () => {
      const session = createTestSession({
        status: 'active',
        lastActivity: new Date(Date.now() - 70000).toISOString(),
      });
      const result = lifecycle.processLifecycle(session);

      expect(result?.status).toBe('idle');
    });

    it('should transition idle session to suspended', () => {
      const session = createTestSession({
        status: 'idle',
        lastActivity: new Date(Date.now() - 130000).toISOString(),
      });
      const result = lifecycle.processLifecycle(session);

      expect(result?.status).toBe('suspended');
    });

    it('should transition suspended session to closed', () => {
      const session = createTestSession({
        status: 'suspended',
        lastActivity: new Date(Date.now() - 310000).toISOString(),
      });
      const result = lifecycle.processLifecycle(session);

      expect(result?.status).toBe('closed');
    });

    it('should handle expired session', () => {
      const callback = vi.fn();
      lifecycle.onEvent(callback);

      const session = createTestSession({
        status: 'active',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      const result = lifecycle.processLifecycle(session);

      expect(result?.status).toBe('closed');
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'expired',
      }));
    });

    it('should return unchanged session if no transition needed', () => {
      const session = createTestSession({
        status: 'active',
        lastActivity: new Date().toISOString(),
      });
      const result = lifecycle.processLifecycle(session);

      expect(result).toBe(session);
    });
  });

  describe('processBatch', () => {
    it('should process multiple sessions', () => {
      const sessions = [
        createTestSession({
          id: '1',
          status: 'active',
          lastActivity: new Date(Date.now() - 70000).toISOString(),
        }),
        createTestSession({
          id: '2',
          status: 'idle',
          lastActivity: new Date(Date.now() - 130000).toISOString(),
        }),
        createTestSession({
          id: '3',
          status: 'active',
          lastActivity: new Date().toISOString(),
        }),
      ];

      const { updated, toDelete } = lifecycle.processBatch(sessions);

      // Session 1 should transition to idle
      // Session 2 should transition to suspended
      // Session 3 should remain unchanged (not in updated)
      expect(updated).toHaveLength(2);
      expect(updated.find(s => s.id === '1')?.status).toBe('idle');
      expect(updated.find(s => s.id === '2')?.status).toBe('suspended');
      expect(toDelete).toHaveLength(0);
    });

    it('should mark closed sessions for update', () => {
      const sessions = [
        createTestSession({
          id: '1',
          status: 'suspended',
          lastActivity: new Date(Date.now() - 310000).toISOString(),
        }),
      ];

      const { updated, toDelete } = lifecycle.processBatch(sessions);

      expect(updated).toHaveLength(1);
      expect(updated[0].status).toBe('closed');
      expect(toDelete).toHaveLength(0);
    });
  });

  describe('getTimeUntilTransition', () => {
    it('should return time until idle for active session', () => {
      const session = createTestSession({
        status: 'active',
        lastActivity: new Date(Date.now() - 30000).toISOString(), // 30s ago
      });

      const time = lifecycle.getTimeUntilTransition(session);
      expect(time).toBeGreaterThanOrEqual(29000);
      expect(time).toBeLessThanOrEqual(31000);
    });

    it('should return time until suspend for idle session', () => {
      const session = createTestSession({
        status: 'idle',
        lastActivity: new Date(Date.now() - 60000).toISOString(), // 60s ago
      });

      const time = lifecycle.getTimeUntilTransition(session);
      expect(time).toBeGreaterThanOrEqual(59000);
      expect(time).toBeLessThanOrEqual(61000);
    });

    it('should return time until close for suspended session', () => {
      const session = createTestSession({
        status: 'suspended',
        lastActivity: new Date(Date.now() - 200000).toISOString(), // 200s ago
      });

      const time = lifecycle.getTimeUntilTransition(session);
      expect(time).toBeGreaterThanOrEqual(99000);
      expect(time).toBeLessThanOrEqual(101000);
    });

    it('should return null for closed session', () => {
      const session = createTestSession({ status: 'closed' });
      expect(lifecycle.getTimeUntilTransition(session)).toBeNull();
    });

    it('should return 0 if already past threshold', () => {
      const session = createTestSession({
        status: 'active',
        lastActivity: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
      });

      expect(lifecycle.getTimeUntilTransition(session)).toBe(0);
    });
  });

  describe('config getters', () => {
    it('should return cleanup interval', () => {
      expect(lifecycle.getCleanupInterval()).toBe(30000);
    });

    it('should return max sessions per sender', () => {
      expect(lifecycle.getMaxSessionsPerSender()).toBe(5);
    });

    it('should return max total sessions', () => {
      expect(lifecycle.getMaxTotalSessions()).toBe(100);
    });
  });

  describe('updateConfig', () => {
    it('should update config partially', () => {
      lifecycle.updateConfig({ idleTimeout: 30000 });

      const config = lifecycle.getConfig();
      expect(config.idleTimeout).toBe(30000);
      expect(config.suspendTimeout).toBe(120000); // Unchanged
    });

    it('should update multiple config values', () => {
      lifecycle.updateConfig({
        idleTimeout: 30000,
        suspendTimeout: 60000,
        maxSessionsPerSender: 3,
      });

      const config = lifecycle.getConfig();
      expect(config.idleTimeout).toBe(30000);
      expect(config.suspendTimeout).toBe(60000);
      expect(config.maxSessionsPerSender).toBe(3);
    });
  });

  describe('getConfig', () => {
    it('should return copy of config', () => {
      const config1 = lifecycle.getConfig();
      const config2 = lifecycle.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });
});
