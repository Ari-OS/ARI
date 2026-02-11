import { describe, it, expect, beforeEach } from 'vitest';
import { SessionContextManager } from '../../../../src/system/sessions/session-context.js';
import type { Session } from '../../../../src/system/sessions/types.js';

describe('SessionContextManager', () => {
  // Helper to create a test session
  const createTestSession = (overrides?: Partial<Session>): Session => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    channel: 'telegram',
    senderId: 'user123',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastActivity: '2024-01-01T00:00:00.000Z',
    context: {
      contextId: undefined,
      summary: undefined,
      currentTask: undefined,
      activeTools: [],
      pendingResponses: [],
      lastMessageId: undefined,
    },
    memoryPartition: 'session:telegram:user123:abc123',
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

  describe('createInitialContext', () => {
    it('should create empty context without contextId', () => {
      const context = SessionContextManager.createInitialContext();

      expect(context.contextId).toBeUndefined();
      expect(context.summary).toBeUndefined();
      expect(context.currentTask).toBeUndefined();
      expect(context.activeTools).toEqual([]);
      expect(context.pendingResponses).toEqual([]);
      expect(context.lastMessageId).toBeUndefined();
    });

    it('should create context with contextId', () => {
      const context = SessionContextManager.createInitialContext('venture-001');

      expect(context.contextId).toBe('venture-001');
      expect(context.activeTools).toEqual([]);
      expect(context.pendingResponses).toEqual([]);
    });
  });

  describe('createInitialStats', () => {
    it('should create zeroed stats', () => {
      const stats = SessionContextManager.createInitialStats();

      expect(stats.messageCount).toBe(0);
      expect(stats.inboundCount).toBe(0);
      expect(stats.outboundCount).toBe(0);
      expect(stats.toolExecutions).toBe(0);
      expect(stats.duration).toBe(0);
    });
  });

  describe('createInitialMetadata', () => {
    it('should create empty metadata without input', () => {
      const metadata = SessionContextManager.createInitialMetadata();

      expect(metadata.name).toBeUndefined();
      expect(metadata.tags).toEqual([]);
      expect(metadata.custom).toEqual({});
    });

    it('should create metadata with provided values', () => {
      const metadata = SessionContextManager.createInitialMetadata({
        name: 'Test Session',
        tags: ['important', 'urgent'],
        custom: { priority: 1 },
      });

      expect(metadata.name).toBe('Test Session');
      expect(metadata.tags).toEqual(['important', 'urgent']);
      expect(metadata.custom).toEqual({ priority: 1 });
    });

    it('should apply defaults for missing fields', () => {
      const metadata = SessionContextManager.createInitialMetadata({
        name: 'Partial',
      });

      expect(metadata.name).toBe('Partial');
      expect(metadata.tags).toEqual([]);
      expect(metadata.custom).toEqual({});
    });
  });

  describe('recordInboundMessage', () => {
    it('should increment message and inbound counts', () => {
      const session = createTestSession();
      const updated = SessionContextManager.recordInboundMessage(session, 'msg-001');

      expect(updated.stats.messageCount).toBe(1);
      expect(updated.stats.inboundCount).toBe(1);
      expect(updated.stats.outboundCount).toBe(0);
      expect(updated.context.lastMessageId).toBe('msg-001');
    });

    it('should update lastActivity', () => {
      const session = createTestSession({
        lastActivity: '2024-01-01T00:00:00.000Z',
      });
      const updated = SessionContextManager.recordInboundMessage(session, 'msg-002');

      expect(new Date(updated.lastActivity).getTime())
        .toBeGreaterThan(new Date(session.lastActivity).getTime());
    });

    it('should not mutate original session', () => {
      const session = createTestSession();
      SessionContextManager.recordInboundMessage(session, 'msg-003');

      expect(session.stats.messageCount).toBe(0);
      expect(session.stats.inboundCount).toBe(0);
    });
  });

  describe('recordOutboundMessage', () => {
    it('should increment message and outbound counts', () => {
      const session = createTestSession();
      const updated = SessionContextManager.recordOutboundMessage(session, 'msg-001');

      expect(updated.stats.messageCount).toBe(1);
      expect(updated.stats.outboundCount).toBe(1);
      expect(updated.stats.inboundCount).toBe(0);
      expect(updated.context.lastMessageId).toBe('msg-001');
    });

    it('should update lastActivity', () => {
      const session = createTestSession({
        lastActivity: '2024-01-01T00:00:00.000Z',
      });
      const updated = SessionContextManager.recordOutboundMessage(session, 'msg-002');

      expect(new Date(updated.lastActivity).getTime())
        .toBeGreaterThan(new Date(session.lastActivity).getTime());
    });

    it('should not mutate original session', () => {
      const session = createTestSession();
      SessionContextManager.recordOutboundMessage(session, 'msg-003');

      expect(session.stats.messageCount).toBe(0);
      expect(session.stats.outboundCount).toBe(0);
    });
  });

  describe('recordToolStart', () => {
    it('should add tool to activeTools', () => {
      const session = createTestSession();
      const updated = SessionContextManager.recordToolStart(session, 'tool-call-001');

      expect(updated.context.activeTools).toContain('tool-call-001');
      expect(updated.context.activeTools).toHaveLength(1);
    });

    it('should allow multiple active tools', () => {
      let session = createTestSession();
      session = SessionContextManager.recordToolStart(session, 'tool-1');
      session = SessionContextManager.recordToolStart(session, 'tool-2');
      session = SessionContextManager.recordToolStart(session, 'tool-3');

      expect(session.context.activeTools).toEqual(['tool-1', 'tool-2', 'tool-3']);
    });

    it('should update lastActivity', () => {
      const session = createTestSession({
        lastActivity: '2024-01-01T00:00:00.000Z',
      });
      const updated = SessionContextManager.recordToolStart(session, 'tool-001');

      expect(new Date(updated.lastActivity).getTime())
        .toBeGreaterThan(new Date(session.lastActivity).getTime());
    });
  });

  describe('recordToolEnd', () => {
    it('should remove tool from activeTools', () => {
      const session = createTestSession({
        context: {
          contextId: undefined,
          summary: undefined,
          currentTask: undefined,
          activeTools: ['tool-1', 'tool-2', 'tool-3'],
          pendingResponses: [],
          lastMessageId: undefined,
        },
      });
      const updated = SessionContextManager.recordToolEnd(session, 'tool-2');

      expect(updated.context.activeTools).toEqual(['tool-1', 'tool-3']);
    });

    it('should increment toolExecutions', () => {
      const session = createTestSession({
        context: {
          contextId: undefined,
          summary: undefined,
          currentTask: undefined,
          activeTools: ['tool-1'],
          pendingResponses: [],
          lastMessageId: undefined,
        },
      });
      const updated = SessionContextManager.recordToolEnd(session, 'tool-1');

      expect(updated.stats.toolExecutions).toBe(1);
      expect(updated.context.activeTools).toEqual([]);
    });

    it('should handle non-existent tool gracefully', () => {
      const session = createTestSession();
      const updated = SessionContextManager.recordToolEnd(session, 'nonexistent');

      expect(updated.stats.toolExecutions).toBe(1);
      expect(updated.context.activeTools).toEqual([]);
    });
  });

  describe('addPendingResponse', () => {
    it('should add response to pendingResponses', () => {
      const session = createTestSession();
      const updated = SessionContextManager.addPendingResponse(session, 'resp-001');

      expect(updated.context.pendingResponses).toContain('resp-001');
      expect(updated.context.pendingResponses).toHaveLength(1);
    });

    it('should allow multiple pending responses', () => {
      let session = createTestSession();
      session = SessionContextManager.addPendingResponse(session, 'resp-1');
      session = SessionContextManager.addPendingResponse(session, 'resp-2');

      expect(session.context.pendingResponses).toEqual(['resp-1', 'resp-2']);
    });
  });

  describe('removePendingResponse', () => {
    it('should remove response from pendingResponses', () => {
      const session = createTestSession({
        context: {
          contextId: undefined,
          summary: undefined,
          currentTask: undefined,
          activeTools: [],
          pendingResponses: ['resp-1', 'resp-2', 'resp-3'],
          lastMessageId: undefined,
        },
      });
      const updated = SessionContextManager.removePendingResponse(session, 'resp-2');

      expect(updated.context.pendingResponses).toEqual(['resp-1', 'resp-3']);
    });

    it('should handle non-existent response gracefully', () => {
      const session = createTestSession();
      const updated = SessionContextManager.removePendingResponse(session, 'nonexistent');

      expect(updated.context.pendingResponses).toEqual([]);
    });
  });

  describe('updateSummary', () => {
    it('should set conversation summary', () => {
      const session = createTestSession();
      const updated = SessionContextManager.updateSummary(session, 'User requested help with code review');

      expect(updated.context.summary).toBe('User requested help with code review');
    });

    it('should update existing summary', () => {
      const session = createTestSession({
        context: {
          contextId: undefined,
          summary: 'Old summary',
          currentTask: undefined,
          activeTools: [],
          pendingResponses: [],
          lastMessageId: undefined,
        },
      });
      const updated = SessionContextManager.updateSummary(session, 'New summary');

      expect(updated.context.summary).toBe('New summary');
    });
  });

  describe('setCurrentTask', () => {
    it('should set current task', () => {
      const session = createTestSession();
      const updated = SessionContextManager.setCurrentTask(session, 'Code review');

      expect(updated.context.currentTask).toBe('Code review');
    });

    it('should clear current task with undefined', () => {
      const session = createTestSession({
        context: {
          contextId: undefined,
          summary: undefined,
          currentTask: 'Old task',
          activeTools: [],
          pendingResponses: [],
          lastMessageId: undefined,
        },
      });
      const updated = SessionContextManager.setCurrentTask(session, undefined);

      expect(updated.context.currentTask).toBeUndefined();
    });
  });

  describe('setContextId', () => {
    it('should set context ID', () => {
      const session = createTestSession();
      const updated = SessionContextManager.setContextId(session, 'venture-001');

      expect(updated.context.contextId).toBe('venture-001');
    });

    it('should clear context ID with undefined', () => {
      const session = createTestSession({
        context: {
          contextId: 'old-context',
          summary: undefined,
          currentTask: undefined,
          activeTools: [],
          pendingResponses: [],
          lastMessageId: undefined,
        },
      });
      const updated = SessionContextManager.setContextId(session, undefined);

      expect(updated.context.contextId).toBeUndefined();
    });
  });

  describe('addTag', () => {
    it('should add tag to metadata', () => {
      const session = createTestSession();
      const updated = SessionContextManager.addTag(session, 'important');

      expect(updated.metadata.tags).toContain('important');
    });

    it('should not add duplicate tags', () => {
      const session = createTestSession({
        metadata: {
          name: undefined,
          tags: ['existing'],
          custom: {},
        },
      });
      const updated = SessionContextManager.addTag(session, 'existing');

      expect(updated.metadata.tags).toEqual(['existing']);
      expect(updated).toBe(session); // Should return same object
    });

    it('should allow multiple tags', () => {
      let session = createTestSession();
      session = SessionContextManager.addTag(session, 'tag1');
      session = SessionContextManager.addTag(session, 'tag2');
      session = SessionContextManager.addTag(session, 'tag3');

      expect(session.metadata.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });
  });

  describe('removeTag', () => {
    it('should remove tag from metadata', () => {
      const session = createTestSession({
        metadata: {
          name: undefined,
          tags: ['tag1', 'tag2', 'tag3'],
          custom: {},
        },
      });
      const updated = SessionContextManager.removeTag(session, 'tag2');

      expect(updated.metadata.tags).toEqual(['tag1', 'tag3']);
    });

    it('should handle non-existent tag gracefully', () => {
      const session = createTestSession();
      const updated = SessionContextManager.removeTag(session, 'nonexistent');

      expect(updated.metadata.tags).toEqual([]);
    });
  });

  describe('setCustom', () => {
    it('should set custom metadata value', () => {
      const session = createTestSession();
      const updated = SessionContextManager.setCustom(session, 'priority', 'high');

      expect(updated.metadata.custom.priority).toBe('high');
    });

    it('should allow complex values', () => {
      const session = createTestSession();
      const updated = SessionContextManager.setCustom(session, 'config', { nested: { value: 42 } });

      expect(updated.metadata.custom.config).toEqual({ nested: { value: 42 } });
    });

    it('should overwrite existing values', () => {
      const session = createTestSession({
        metadata: {
          name: undefined,
          tags: [],
          custom: { key: 'old' },
        },
      });
      const updated = SessionContextManager.setCustom(session, 'key', 'new');

      expect(updated.metadata.custom.key).toBe('new');
    });
  });

  describe('getCustom', () => {
    it('should retrieve custom metadata value', () => {
      const session = createTestSession({
        metadata: {
          name: undefined,
          tags: [],
          custom: { key: 'value' },
        },
      });

      expect(SessionContextManager.getCustom(session, 'key')).toBe('value');
    });

    it('should return undefined for non-existent key', () => {
      const session = createTestSession();

      expect(SessionContextManager.getCustom(session, 'nonexistent')).toBeUndefined();
    });
  });

  describe('updateDuration', () => {
    it('should calculate duration from creation', () => {
      const createdAt = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      const session = createTestSession({ createdAt });
      const updated = SessionContextManager.updateDuration(session);

      expect(updated.stats.duration).toBeGreaterThanOrEqual(59000);
      expect(updated.stats.duration).toBeLessThan(62000);
    });
  });

  describe('getMemoryPartition', () => {
    it('should generate partition from session ID', () => {
      const partition = SessionContextManager.getMemoryPartition('session-123');
      expect(partition).toBe('session:session-123');
    });
  });

  describe('generateMemoryPartition', () => {
    it('should generate unique partition', () => {
      const partition1 = SessionContextManager.generateMemoryPartition('telegram', 'user1');
      const partition2 = SessionContextManager.generateMemoryPartition('telegram', 'user1');

      expect(partition1).toMatch(/^session:telegram:user1:[a-f0-9]+$/);
      expect(partition2).toMatch(/^session:telegram:user1:[a-f0-9]+$/);
      expect(partition1).not.toBe(partition2); // Different due to UUID
    });
  });

  describe('hasActiveTools', () => {
    it('should return true when session has active tools', () => {
      const session = createTestSession({
        context: {
          contextId: undefined,
          summary: undefined,
          currentTask: undefined,
          activeTools: ['tool-1'],
          pendingResponses: [],
          lastMessageId: undefined,
        },
      });

      expect(SessionContextManager.hasActiveTools(session)).toBe(true);
    });

    it('should return false when session has no active tools', () => {
      const session = createTestSession();

      expect(SessionContextManager.hasActiveTools(session)).toBe(false);
    });
  });

  describe('hasPendingResponses', () => {
    it('should return true when session has pending responses', () => {
      const session = createTestSession({
        context: {
          contextId: undefined,
          summary: undefined,
          currentTask: undefined,
          activeTools: [],
          pendingResponses: ['resp-1'],
          lastMessageId: undefined,
        },
      });

      expect(SessionContextManager.hasPendingResponses(session)).toBe(true);
    });

    it('should return false when session has no pending responses', () => {
      const session = createTestSession();

      expect(SessionContextManager.hasPendingResponses(session)).toBe(false);
    });
  });

  describe('isBusy', () => {
    it('should return true when session has active tools', () => {
      const session = createTestSession({
        context: {
          contextId: undefined,
          summary: undefined,
          currentTask: undefined,
          activeTools: ['tool-1'],
          pendingResponses: [],
          lastMessageId: undefined,
        },
      });

      expect(SessionContextManager.isBusy(session)).toBe(true);
    });

    it('should return true when session has pending responses', () => {
      const session = createTestSession({
        context: {
          contextId: undefined,
          summary: undefined,
          currentTask: undefined,
          activeTools: [],
          pendingResponses: ['resp-1'],
          lastMessageId: undefined,
        },
      });

      expect(SessionContextManager.isBusy(session)).toBe(true);
    });

    it('should return true when session has both', () => {
      const session = createTestSession({
        context: {
          contextId: undefined,
          summary: undefined,
          currentTask: undefined,
          activeTools: ['tool-1'],
          pendingResponses: ['resp-1'],
          lastMessageId: undefined,
        },
      });

      expect(SessionContextManager.isBusy(session)).toBe(true);
    });

    it('should return false when session has neither', () => {
      const session = createTestSession();

      expect(SessionContextManager.isBusy(session)).toBe(false);
    });
  });

  describe('clearActiveContext', () => {
    it('should clear all active context', () => {
      const session = createTestSession({
        context: {
          contextId: 'ctx-1',
          summary: 'Summary',
          currentTask: 'Task',
          activeTools: ['tool-1', 'tool-2'],
          pendingResponses: ['resp-1'],
          lastMessageId: 'msg-1',
        },
      });
      const updated = SessionContextManager.clearActiveContext(session);

      expect(updated.context.activeTools).toEqual([]);
      expect(updated.context.pendingResponses).toEqual([]);
      expect(updated.context.currentTask).toBeUndefined();
      // These should be preserved
      expect(updated.context.contextId).toBe('ctx-1');
      expect(updated.context.summary).toBe('Summary');
      expect(updated.context.lastMessageId).toBe('msg-1');
    });
  });
});
