import { describe, it, expect } from 'vitest';
import {
  SessionSchema,
  SessionStatusSchema,
  SessionMetadataSchema,
  SessionContextSchema,
  SessionStatsSchema,
  CreateSessionInputSchema,
  UpdateSessionInputSchema,
  SessionQuerySchema,
  createSessionKey,
  parseSessionKey,
  DEFAULT_SESSION_LIFECYCLE_CONFIG,
} from '../../../../src/system/sessions/types.js';

describe('Session Types', () => {
  describe('SessionStatusSchema', () => {
    it('should accept valid status values', () => {
      expect(SessionStatusSchema.parse('active')).toBe('active');
      expect(SessionStatusSchema.parse('idle')).toBe('idle');
      expect(SessionStatusSchema.parse('suspended')).toBe('suspended');
      expect(SessionStatusSchema.parse('closed')).toBe('closed');
    });

    it('should reject invalid status values', () => {
      expect(() => SessionStatusSchema.parse('invalid')).toThrow();
      expect(() => SessionStatusSchema.parse('')).toThrow();
      expect(() => SessionStatusSchema.parse(null)).toThrow();
    });
  });

  describe('SessionMetadataSchema', () => {
    it('should parse valid metadata', () => {
      const result = SessionMetadataSchema.parse({
        name: 'Test Session',
        tags: ['tag1', 'tag2'],
        custom: { key: 'value' },
      });

      expect(result.name).toBe('Test Session');
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.custom).toEqual({ key: 'value' });
    });

    it('should apply defaults for optional fields', () => {
      const result = SessionMetadataSchema.parse({});

      expect(result.name).toBeUndefined();
      expect(result.tags).toEqual([]);
      expect(result.custom).toEqual({});
    });

    it('should allow partial metadata', () => {
      const result = SessionMetadataSchema.parse({
        name: 'Test',
      });

      expect(result.name).toBe('Test');
      expect(result.tags).toEqual([]);
      expect(result.custom).toEqual({});
    });
  });

  describe('SessionContextSchema', () => {
    it('should parse valid context', () => {
      const result = SessionContextSchema.parse({
        contextId: 'test-context',
        summary: 'Test summary',
        currentTask: 'Test task',
        activeTools: ['tool1', 'tool2'],
        pendingResponses: ['resp1'],
        lastMessageId: 'msg-123',
      });

      expect(result.contextId).toBe('test-context');
      expect(result.summary).toBe('Test summary');
      expect(result.currentTask).toBe('Test task');
      expect(result.activeTools).toEqual(['tool1', 'tool2']);
      expect(result.pendingResponses).toEqual(['resp1']);
      expect(result.lastMessageId).toBe('msg-123');
    });

    it('should apply defaults for optional fields', () => {
      const result = SessionContextSchema.parse({});

      expect(result.contextId).toBeUndefined();
      expect(result.summary).toBeUndefined();
      expect(result.currentTask).toBeUndefined();
      expect(result.activeTools).toEqual([]);
      expect(result.pendingResponses).toEqual([]);
      expect(result.lastMessageId).toBeUndefined();
    });
  });

  describe('SessionStatsSchema', () => {
    it('should parse valid stats', () => {
      const result = SessionStatsSchema.parse({
        messageCount: 10,
        inboundCount: 5,
        outboundCount: 5,
        toolExecutions: 3,
        duration: 60000,
      });

      expect(result.messageCount).toBe(10);
      expect(result.inboundCount).toBe(5);
      expect(result.outboundCount).toBe(5);
      expect(result.toolExecutions).toBe(3);
      expect(result.duration).toBe(60000);
    });

    it('should apply defaults', () => {
      const result = SessionStatsSchema.parse({});

      expect(result.messageCount).toBe(0);
      expect(result.inboundCount).toBe(0);
      expect(result.outboundCount).toBe(0);
      expect(result.toolExecutions).toBe(0);
      expect(result.duration).toBe(0);
    });
  });

  describe('SessionSchema', () => {
    const validSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      channel: 'telegram',
      senderId: 'user123',
      createdAt: '2024-01-01T00:00:00.000Z',
      lastActivity: '2024-01-01T00:00:00.000Z',
      context: {
        activeTools: [],
        pendingResponses: [],
      },
      memoryPartition: 'session:telegram:user123:abc123',
      trustLevel: 'standard',
      status: 'active',
      metadata: {
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
    };

    it('should parse a valid session', () => {
      const result = SessionSchema.parse(validSession);

      expect(result.id).toBe(validSession.id);
      expect(result.channel).toBe('telegram');
      expect(result.senderId).toBe('user123');
      expect(result.status).toBe('active');
    });

    it('should parse session with optional groupId', () => {
      const result = SessionSchema.parse({
        ...validSession,
        groupId: 'group123',
      });

      expect(result.groupId).toBe('group123');
    });

    it('should parse session with optional expiresAt', () => {
      const result = SessionSchema.parse({
        ...validSession,
        expiresAt: '2024-12-31T23:59:59.000Z',
      });

      expect(result.expiresAt).toBe('2024-12-31T23:59:59.000Z');
    });

    it('should parse session with optional parentSessionId', () => {
      const parentId = '550e8400-e29b-41d4-a716-446655440001';
      const result = SessionSchema.parse({
        ...validSession,
        parentSessionId: parentId,
      });

      expect(result.parentSessionId).toBe(parentId);
    });

    it('should reject invalid UUID', () => {
      expect(() => SessionSchema.parse({
        ...validSession,
        id: 'not-a-uuid',
      })).toThrow();
    });

    it('should reject invalid trustLevel', () => {
      expect(() => SessionSchema.parse({
        ...validSession,
        trustLevel: 'invalid',
      })).toThrow();
    });

    it('should reject invalid status', () => {
      expect(() => SessionSchema.parse({
        ...validSession,
        status: 'invalid',
      })).toThrow();
    });
  });

  describe('CreateSessionInputSchema', () => {
    it('should parse valid input', () => {
      const result = CreateSessionInputSchema.parse({
        channel: 'telegram',
        senderId: 'user123',
      });

      expect(result.channel).toBe('telegram');
      expect(result.senderId).toBe('user123');
    });

    it('should parse input with optional fields', () => {
      const result = CreateSessionInputSchema.parse({
        channel: 'slack',
        senderId: 'user456',
        groupId: 'group789',
        trustLevel: 'verified',
        contextId: 'ctx-001',
        metadata: { name: 'Test' },
        expiresAt: '2024-12-31T23:59:59.000Z',
      });

      expect(result.channel).toBe('slack');
      expect(result.groupId).toBe('group789');
      expect(result.trustLevel).toBe('verified');
      expect(result.contextId).toBe('ctx-001');
      expect(result.metadata?.name).toBe('Test');
      expect(result.expiresAt).toBe('2024-12-31T23:59:59.000Z');
    });

    it('should reject missing required fields', () => {
      expect(() => CreateSessionInputSchema.parse({})).toThrow();
      expect(() => CreateSessionInputSchema.parse({ channel: 'test' })).toThrow();
      expect(() => CreateSessionInputSchema.parse({ senderId: 'test' })).toThrow();
    });
  });

  describe('UpdateSessionInputSchema', () => {
    it('should parse empty update', () => {
      const result = UpdateSessionInputSchema.parse({});
      expect(result).toEqual({});
    });

    it('should parse status update', () => {
      const result = UpdateSessionInputSchema.parse({
        status: 'idle',
      });

      expect(result.status).toBe('idle');
    });

    it('should parse trust level update', () => {
      const result = UpdateSessionInputSchema.parse({
        trustLevel: 'verified',
      });

      expect(result.trustLevel).toBe('verified');
    });

    it('should parse context update', () => {
      const result = UpdateSessionInputSchema.parse({
        context: {
          summary: 'New summary',
        },
      });

      expect(result.context?.summary).toBe('New summary');
    });

    it('should parse multiple fields', () => {
      const result = UpdateSessionInputSchema.parse({
        status: 'suspended',
        trustLevel: 'operator',
        metadata: { name: 'Updated' },
        expiresAt: '2025-01-01T00:00:00.000Z',
      });

      expect(result.status).toBe('suspended');
      expect(result.trustLevel).toBe('operator');
      expect(result.metadata?.name).toBe('Updated');
      expect(result.expiresAt).toBe('2025-01-01T00:00:00.000Z');
    });
  });

  describe('SessionQuerySchema', () => {
    it('should parse empty query', () => {
      const result = SessionQuerySchema.parse({});
      expect(result).toEqual({});
    });

    it('should parse query with filters', () => {
      const result = SessionQuerySchema.parse({
        channel: 'telegram',
        senderId: 'user123',
        status: 'active',
        trustLevel: 'standard',
        limit: 10,
        offset: 5,
      });

      expect(result.channel).toBe('telegram');
      expect(result.senderId).toBe('user123');
      expect(result.status).toBe('active');
      expect(result.trustLevel).toBe('standard');
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(5);
    });

    it('should parse query with date filters', () => {
      const result = SessionQuerySchema.parse({
        createdAfter: '2024-01-01T00:00:00.000Z',
        createdBefore: '2024-12-31T23:59:59.000Z',
        activeAfter: '2024-06-01T00:00:00.000Z',
      });

      expect(result.createdAfter).toBe('2024-01-01T00:00:00.000Z');
      expect(result.createdBefore).toBe('2024-12-31T23:59:59.000Z');
      expect(result.activeAfter).toBe('2024-06-01T00:00:00.000Z');
    });

    it('should reject negative offset', () => {
      expect(() => SessionQuerySchema.parse({ offset: -1 })).toThrow();
    });

    it('should reject non-positive limit', () => {
      expect(() => SessionQuerySchema.parse({ limit: 0 })).toThrow();
      expect(() => SessionQuerySchema.parse({ limit: -1 })).toThrow();
    });
  });

  describe('createSessionKey', () => {
    it('should create key without groupId', () => {
      const key = createSessionKey('telegram', 'user123');
      expect(key).toBe('telegram:user123');
    });

    it('should create key with groupId', () => {
      const key = createSessionKey('slack', 'user456', 'group789');
      expect(key).toBe('slack:user456:group789');
    });

    it('should handle undefined groupId', () => {
      const key = createSessionKey('telegram', 'user999', undefined);
      expect(key).toBe('telegram:user999');
    });
  });

  describe('parseSessionKey', () => {
    it('should parse key without groupId', () => {
      const result = parseSessionKey('telegram:user123');

      expect(result.channel).toBe('telegram');
      expect(result.senderId).toBe('user123');
      expect(result.groupId).toBeUndefined();
    });

    it('should parse key with groupId', () => {
      const result = parseSessionKey('slack:user456:group789');

      expect(result.channel).toBe('slack');
      expect(result.senderId).toBe('user456');
      expect(result.groupId).toBe('group789');
    });
  });

  describe('DEFAULT_SESSION_LIFECYCLE_CONFIG', () => {
    it('should have valid default values', () => {
      expect(DEFAULT_SESSION_LIFECYCLE_CONFIG.idleTimeout).toBe(5 * 60 * 1000);
      expect(DEFAULT_SESSION_LIFECYCLE_CONFIG.suspendTimeout).toBe(30 * 60 * 1000);
      expect(DEFAULT_SESSION_LIFECYCLE_CONFIG.closeTimeout).toBe(24 * 60 * 60 * 1000);
      expect(DEFAULT_SESSION_LIFECYCLE_CONFIG.maxSessionsPerSender).toBe(10);
      expect(DEFAULT_SESSION_LIFECYCLE_CONFIG.maxTotalSessions).toBe(1000);
      expect(DEFAULT_SESSION_LIFECYCLE_CONFIG.cleanupInterval).toBe(60 * 1000);
    });

    it('should have positive timeout values', () => {
      expect(DEFAULT_SESSION_LIFECYCLE_CONFIG.idleTimeout).toBeGreaterThan(0);
      expect(DEFAULT_SESSION_LIFECYCLE_CONFIG.suspendTimeout).toBeGreaterThan(0);
      expect(DEFAULT_SESSION_LIFECYCLE_CONFIG.closeTimeout).toBeGreaterThan(0);
      expect(DEFAULT_SESSION_LIFECYCLE_CONFIG.cleanupInterval).toBeGreaterThan(0);
    });

    it('should have proper timeout ordering', () => {
      expect(DEFAULT_SESSION_LIFECYCLE_CONFIG.idleTimeout)
        .toBeLessThan(DEFAULT_SESSION_LIFECYCLE_CONFIG.suspendTimeout);
      expect(DEFAULT_SESSION_LIFECYCLE_CONFIG.suspendTimeout)
        .toBeLessThan(DEFAULT_SESSION_LIFECYCLE_CONFIG.closeTimeout);
    });
  });
});
