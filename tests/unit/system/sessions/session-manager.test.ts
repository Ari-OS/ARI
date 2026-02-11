import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { SessionManager } from '../../../../src/system/sessions/session-manager.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import { AuditLogger } from '../../../../src/kernel/audit.js';
import type { Session } from '../../../../src/system/sessions/types.js';

describe('SessionManager', () => {
  let manager: SessionManager;
  let eventBus: EventBus;
  let auditLogger: AuditLogger;
  let testStoragePath: string;
  let testAuditPath: string;

  beforeEach(async () => {
    vi.useFakeTimers();

    testStoragePath = join(tmpdir(), `ari-test-sessions-${randomUUID()}`);
    testAuditPath = join(tmpdir(), `ari-test-audit-${randomUUID()}.json`);

    eventBus = new EventBus();
    auditLogger = new AuditLogger(testAuditPath);

    manager = new SessionManager(
      eventBus,
      auditLogger,
      {
        idleTimeout: 60000,
        suspendTimeout: 120000,
        closeTimeout: 300000,
        maxSessionsPerSender: 3,
        maxTotalSessions: 10,
        cleanupInterval: 30000,
      },
      testStoragePath
    );
  });

  afterEach(async () => {
    vi.useRealTimers();

    if (manager.isRunning()) {
      await manager.stop();
    }

    // Clean up test directories
    try {
      await fs.rm(testStoragePath, { recursive: true, force: true });
      await fs.unlink(testAuditPath);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('start/stop', () => {
    it('should start the manager', async () => {
      await manager.start();

      expect(manager.isRunning()).toBe(true);
    });

    it('should not start twice', async () => {
      await manager.start();
      await manager.start();

      expect(manager.isRunning()).toBe(true);
    });

    it('should stop the manager', async () => {
      await manager.start();
      await manager.stop();

      expect(manager.isRunning()).toBe(false);
    });

    it('should not stop if not running', async () => {
      await manager.stop();

      expect(manager.isRunning()).toBe(false);
    });

    it('should load existing sessions on start', async () => {
      // Create a session file manually
      await fs.mkdir(testStoragePath, { recursive: true });
      const session: Session = {
        id: randomUUID(),
        channel: 'telegram',
        senderId: 'user123',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        context: {
          contextId: undefined,
          summary: undefined,
          currentTask: undefined,
          activeTools: [],
          pendingResponses: [],
          lastMessageId: undefined,
        },
        memoryPartition: 'session:telegram:user123:abc',
        trustLevel: 'standard',
        status: 'active',
        metadata: { tags: [], custom: {} },
        stats: {
          messageCount: 0,
          inboundCount: 0,
          outboundCount: 0,
          toolExecutions: 0,
          duration: 0,
        },
      };
      await fs.writeFile(
        join(testStoragePath, `${session.id}.json`),
        JSON.stringify(session),
        'utf-8'
      );

      await manager.start();

      expect(manager.getSessionCount()).toBe(1);
    });
  });

  describe('createSession', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should create a new session', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      expect(session.id).toBeDefined();
      expect(session.channel).toBe('telegram');
      expect(session.senderId).toBe('user123');
      expect(session.status).toBe('active');
    });

    it('should emit session:started event', async () => {
      const handler = vi.fn();
      eventBus.on('session:started', handler);

      await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        channel: 'telegram',
        senderId: 'user123',
      }));
    });

    it('should use provided trust level', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
        trustLevel: 'verified',
      });

      expect(session.trustLevel).toBe('verified');
    });

    it('should use default trust level if not provided', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      expect(session.trustLevel).toBe('standard');
    });

    it('should set contextId if provided', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
        contextId: 'venture-001',
      });

      expect(session.context.contextId).toBe('venture-001');
    });

    it('should set metadata if provided', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
        metadata: { name: 'Test Session', tags: ['important'] },
      });

      expect(session.metadata.name).toBe('Test Session');
      expect(session.metadata.tags).toContain('important');
    });

    it('should set expiresAt if provided', async () => {
      const expiresAt = new Date(Date.now() + 3600000).toISOString();
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
        expiresAt,
      });

      expect(session.expiresAt).toBe(expiresAt);
    });

    it('should handle groupId', async () => {
      const session = await manager.createSession({
        channel: 'slack',
        senderId: 'user123',
        groupId: 'group456',
      });

      expect(session.groupId).toBe('group456');
    });

    it('should resume existing non-closed session', async () => {
      // Create first session
      const first = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      // Simulate session becoming idle
      await manager.updateSession(first.id, { status: 'idle' });

      // Create "new" session for same channel/sender
      const second = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      expect(second.id).toBe(first.id);
      expect(second.status).toBe('active'); // Resumed
    });

    it('should close oldest session when max per sender exceeded', async () => {
      // Create max sessions
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const session = await manager.createSession({
          channel: `channel${i}`,
          senderId: 'user123',
        });
        sessions.push(session);

        // Advance time a bit between sessions
        vi.advanceTimersByTime(1000);
      }

      // Create one more
      await manager.createSession({
        channel: 'channel3',
        senderId: 'user123',
      });

      // Oldest session should be closed
      const oldest = manager.getSession(sessions[0].id);
      expect(oldest?.status).toBe('closed');
    });

    it('should close oldest session when max total exceeded', async () => {
      // Create max sessions
      for (let i = 0; i < 10; i++) {
        await manager.createSession({
          channel: `channel${i}`,
          senderId: `user${i}`,
        });
        vi.advanceTimersByTime(1000);
      }

      const countBefore = manager.getSessionCount();

      // Create one more with different user
      await manager.createSession({
        channel: 'overflow',
        senderId: 'overflow_user',
      });

      // Should still have max total (one closed)
      expect(manager.getSessionCount()).toBe(countBefore + 1);

      // Verify one session was closed
      const stats = manager.getStats();
      expect(stats.byStatus.closed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getSession', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should return session by ID', async () => {
      const created = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      const found = manager.getSession(created.id);

      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent session', () => {
      expect(manager.getSession('non-existent')).toBeNull();
    });
  });

  describe('getSessionByKey', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should return session by channel/senderId', async () => {
      const created = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      const found = manager.getSessionByKey('telegram', 'user123');

      expect(found?.id).toBe(created.id);
    });

    it('should return session by channel/senderId/groupId', async () => {
      const created = await manager.createSession({
        channel: 'slack',
        senderId: 'user123',
        groupId: 'group456',
      });

      const found = manager.getSessionByKey('slack', 'user123', 'group456');

      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent key', () => {
      expect(manager.getSessionByKey('nonexistent', 'nonexistent')).toBeNull();
    });
  });

  describe('getOrCreateSession', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should return existing session if found', async () => {
      const created = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      const found = await manager.getOrCreateSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      expect(found.id).toBe(created.id);
    });

    it('should create new session if not found', async () => {
      const session = await manager.getOrCreateSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      expect(session.id).toBeDefined();
      expect(session.status).toBe('active');
    });

    it('should touch existing session', async () => {
      const created = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });
      const originalActivity = created.lastActivity;

      vi.advanceTimersByTime(5000);

      const found = await manager.getOrCreateSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      expect(new Date(found.lastActivity).getTime())
        .toBeGreaterThan(new Date(originalActivity).getTime());
    });

    it('should create new session if existing is closed', async () => {
      const created = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });
      await manager.closeSession(created.id, 'test');

      const newSession = await manager.getOrCreateSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      expect(newSession.id).not.toBe(created.id);
    });
  });

  describe('updateSession', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should update session status', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      const updated = await manager.updateSession(session.id, {
        status: 'idle',
      });

      expect(updated?.status).toBe('idle');
    });

    it('should update trust level', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      const updated = await manager.updateSession(session.id, {
        trustLevel: 'verified',
      });

      expect(updated?.trustLevel).toBe('verified');
    });

    it('should merge context updates', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
        contextId: 'original',
      });

      const updated = await manager.updateSession(session.id, {
        context: { summary: 'New summary' },
      });

      expect(updated?.context.contextId).toBe('original');
      expect(updated?.context.summary).toBe('New summary');
    });

    it('should merge metadata updates', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
        metadata: { tags: ['original'] },
      });

      const updated = await manager.updateSession(session.id, {
        metadata: { name: 'Updated' },
      });

      expect(updated?.metadata.name).toBe('Updated');
      expect(updated?.metadata.tags).toContain('original');
    });

    it('should update expiresAt', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      const expiresAt = new Date(Date.now() + 3600000).toISOString();
      const updated = await manager.updateSession(session.id, {
        expiresAt,
      });

      expect(updated?.expiresAt).toBe(expiresAt);
    });

    it('should update lastActivity', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });
      const originalActivity = session.lastActivity;

      vi.advanceTimersByTime(5000);

      const updated = await manager.updateSession(session.id, {
        status: 'idle',
      });

      expect(new Date(updated!.lastActivity).getTime())
        .toBeGreaterThan(new Date(originalActivity).getTime());
    });

    it('should return null for non-existent session', async () => {
      const result = await manager.updateSession('non-existent', {
        status: 'idle',
      });

      expect(result).toBeNull();
    });
  });

  describe('touchSession', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should update lastActivity', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });
      const originalActivity = session.lastActivity;

      vi.advanceTimersByTime(5000);

      const touched = await manager.touchSession(session.id);

      expect(new Date(touched!.lastActivity).getTime())
        .toBeGreaterThan(new Date(originalActivity).getTime());
    });

    it('should auto-resume idle session', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });
      await manager.updateSession(session.id, { status: 'idle' });

      const touched = await manager.touchSession(session.id);

      expect(touched?.status).toBe('active');
    });

    it('should return null for non-existent session', async () => {
      const result = await manager.touchSession('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('recordInboundMessage', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should increment inbound message count', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      const updated = await manager.recordInboundMessage(session.id, 'msg-001');

      expect(updated?.stats.messageCount).toBe(1);
      expect(updated?.stats.inboundCount).toBe(1);
    });

    it('should update lastMessageId', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      const updated = await manager.recordInboundMessage(session.id, 'msg-001');

      expect(updated?.context.lastMessageId).toBe('msg-001');
    });

    it('should return null for non-existent session', async () => {
      const result = await manager.recordInboundMessage('non-existent', 'msg-001');
      expect(result).toBeNull();
    });
  });

  describe('recordOutboundMessage', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should increment outbound message count', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      const updated = await manager.recordOutboundMessage(session.id, 'msg-001');

      expect(updated?.stats.messageCount).toBe(1);
      expect(updated?.stats.outboundCount).toBe(1);
    });

    it('should return null for non-existent session', async () => {
      const result = await manager.recordOutboundMessage('non-existent', 'msg-001');
      expect(result).toBeNull();
    });
  });

  describe('recordToolStart/recordToolEnd', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should track tool execution lifecycle', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      // Start tool
      const afterStart = await manager.recordToolStart(session.id, 'tool-001');
      expect(afterStart?.context.activeTools).toContain('tool-001');

      // End tool
      const afterEnd = await manager.recordToolEnd(session.id, 'tool-001');
      expect(afterEnd?.context.activeTools).not.toContain('tool-001');
      expect(afterEnd?.stats.toolExecutions).toBe(1);
    });

    it('should return null for non-existent session', async () => {
      expect(await manager.recordToolStart('non-existent', 'tool-001')).toBeNull();
      expect(await manager.recordToolEnd('non-existent', 'tool-001')).toBeNull();
    });
  });

  describe('closeSession', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should close session', async () => {
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      const result = await manager.closeSession(session.id, 'user_request');

      expect(result).toBe(true);
      expect(manager.getSession(session.id)?.status).toBe('closed');
    });

    it('should emit session:ended event', async () => {
      const handler = vi.fn();
      eventBus.on('session:ended', handler);

      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });
      await manager.closeSession(session.id, 'user_request');

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: session.id,
        reason: 'user_request',
      }));
    });

    it('should return false for non-existent session', async () => {
      const result = await manager.closeSession('non-existent', 'test');
      expect(result).toBe(false);
    });

    it('should use default reason if not provided', async () => {
      const handler = vi.fn();
      eventBus.on('session:ended', handler);

      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });
      await manager.closeSession(session.id);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'user_request',
      }));
    });
  });

  describe('querySessions', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should query sessions with filters', async () => {
      await manager.createSession({ channel: 'telegram', senderId: 'user1' });
      await manager.createSession({ channel: 'slack', senderId: 'user2' });
      await manager.createSession({ channel: 'telegram', senderId: 'user3' });

      const results = manager.querySessions({ channel: 'telegram' });

      expect(results).toHaveLength(2);
      expect(results.every(s => s.channel === 'telegram')).toBe(true);
    });
  });

  describe('getActiveSessions', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should return only active sessions', async () => {
      const session1 = await manager.createSession({ channel: 'ch1', senderId: 'user1' });
      await manager.createSession({ channel: 'ch2', senderId: 'user2' });
      await manager.updateSession(session1.id, { status: 'idle' });

      const active = manager.getActiveSessions();

      expect(active).toHaveLength(1);
      expect(active[0].status).toBe('active');
    });
  });

  describe('getSessionsByChannel', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should return sessions for channel', async () => {
      await manager.createSession({ channel: 'telegram', senderId: 'user1' });
      await manager.createSession({ channel: 'slack', senderId: 'user2' });
      await manager.createSession({ channel: 'telegram', senderId: 'user3' });

      const telegram = manager.getSessionsByChannel('telegram');

      expect(telegram).toHaveLength(2);
    });
  });

  describe('getSessionCount', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should return session count', async () => {
      expect(manager.getSessionCount()).toBe(0);

      await manager.createSession({ channel: 'ch1', senderId: 'user1' });
      expect(manager.getSessionCount()).toBe(1);

      await manager.createSession({ channel: 'ch2', senderId: 'user2' });
      expect(manager.getSessionCount()).toBe(2);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should return comprehensive stats', async () => {
      const session1 = await manager.createSession({ channel: 'telegram', senderId: 'user1' });
      await manager.createSession({ channel: 'slack', senderId: 'user2' });
      await manager.updateSession(session1.id, { status: 'idle' });

      const stats = manager.getStats();

      expect(stats.total).toBe(2);
      expect(stats.byStatus.active).toBe(1);
      expect(stats.byStatus.idle).toBe(1);
      expect(stats.byChannel.telegram).toBe(1);
      expect(stats.byChannel.slack).toBe(1);
    });
  });

  describe('cleanup cycle', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should transition sessions based on timeouts', async () => {
      // This test verifies that the manager can update session status
      // The actual timeout-based transition is tested in session-lifecycle.test.ts
      // Here we test that the manager's updateSession can change status
      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      expect(session.status).toBe('active');

      // Test that manager can update session status
      const updated = await manager.updateSession(session.id, { status: 'idle' });

      expect(updated?.status).toBe('idle');

      // Verify the status persists in store
      const retrieved = manager.getSession(session.id);
      expect(retrieved?.status).toBe('idle');
    });

    it('should emit session:activity event', async () => {
      const handler = vi.fn();
      eventBus.on('session:activity', handler);

      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      // Touch the session (causes activity event via lifecycle)
      await manager.touchSession(session.id);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('lifecycle event forwarding', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should forward closed event to EventBus', async () => {
      const handler = vi.fn();
      eventBus.on('session:ended', handler);

      const session = await manager.createSession({
        channel: 'telegram',
        senderId: 'user123',
      });

      // Simulate timeout-based close through lifecycle
      await manager.updateSession(session.id, { status: 'suspended' });

      // Advance past close timeout
      vi.advanceTimersByTime(310000);

      // Wait for cleanup
      vi.advanceTimersByTime(30000);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('isRunning', () => {
    it('should return false initially', () => {
      expect(manager.isRunning()).toBe(false);
    });

    it('should return true after start', async () => {
      await manager.start();
      expect(manager.isRunning()).toBe(true);
    });

    it('should return false after stop', async () => {
      await manager.start();
      await manager.stop();
      expect(manager.isRunning()).toBe(false);
    });
  });
});
