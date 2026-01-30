import { describe, it, expect } from 'vitest';
import {
  parseMessage,
  safeParseMessage,
  createMessage,
  createErrorMessage,
  ControlPlaneMessageSchema,
  SessionStartPayloadSchema,
  SessionEndPayloadSchema,
  MessagePayloadSchema,
  ToolStartPayloadSchema,
  ToolUpdatePayloadSchema,
  ToolEndPayloadSchema,
  ChannelStatusPayloadSchema,
  HealthPayloadSchema,
  ErrorPayloadSchema,
  AuthPayloadSchema,
  AuthResponsePayloadSchema,
  MESSAGE_TYPES,
} from '../../../../src/kernel/control-plane/protocol.js';

describe('Protocol', () => {
  describe('parseMessage', () => {
    it('should parse valid session:start message', () => {
      const message = {
        type: 'session:start',
        payload: {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          channel: 'cli',
          senderId: 'user-123',
          trustLevel: 'standard',
        },
      };

      const parsed = parseMessage(message);
      expect(parsed.type).toBe('session:start');
      expect(parsed.payload.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should parse valid session:end message', () => {
      const message = {
        type: 'session:end',
        payload: {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          reason: 'user_disconnect',
        },
      };

      const parsed = parseMessage(message);
      expect(parsed.type).toBe('session:end');
      expect(parsed.payload.reason).toBe('user_disconnect');
    });

    it('should parse valid message:send message', () => {
      const message = {
        type: 'message:send',
        payload: {
          messageId: '550e8400-e29b-41d4-a716-446655440000',
          sessionId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Hello world',
          direction: 'inbound',
          channel: 'cli',
          senderId: 'user-123',
          timestamp: '2024-01-15T10:30:00.000Z',
        },
      };

      const parsed = parseMessage(message);
      expect(parsed.type).toBe('message:send');
      expect(parsed.payload.content).toBe('Hello world');
    });

    it('should parse valid tool:start message', () => {
      const message = {
        type: 'tool:start',
        payload: {
          callId: '550e8400-e29b-41d4-a716-446655440000',
          toolId: 'file-read',
          toolName: 'File Read',
          agent: 'executor',
          parameters: { path: '/tmp/test.txt' },
          timestamp: '2024-01-15T10:30:00.000Z',
        },
      };

      const parsed = parseMessage(message);
      expect(parsed.type).toBe('tool:start');
      expect(parsed.payload.toolId).toBe('file-read');
    });

    it('should parse valid tool:update message', () => {
      const message = {
        type: 'tool:update',
        payload: {
          callId: '550e8400-e29b-41d4-a716-446655440000',
          toolId: 'file-read',
          status: 'running',
          progress: 50,
          timestamp: '2024-01-15T10:30:00.000Z',
        },
      };

      const parsed = parseMessage(message);
      expect(parsed.type).toBe('tool:update');
      expect(parsed.payload.progress).toBe(50);
    });

    it('should parse valid tool:end message', () => {
      const message = {
        type: 'tool:end',
        payload: {
          callId: '550e8400-e29b-41d4-a716-446655440000',
          toolId: 'file-read',
          success: true,
          duration: 150,
          timestamp: '2024-01-15T10:30:00.000Z',
        },
      };

      const parsed = parseMessage(message);
      expect(parsed.type).toBe('tool:end');
      expect(parsed.payload.success).toBe(true);
    });

    it('should parse valid channel:status message', () => {
      const message = {
        type: 'channel:status',
        payload: {
          channelId: 'ch-001',
          channelName: 'CLI',
          status: 'connected',
          activeSessions: 5,
        },
      };

      const parsed = parseMessage(message);
      expect(parsed.type).toBe('channel:status');
      expect(parsed.payload.status).toBe('connected');
    });

    it('should parse valid health:ping message', () => {
      const message = {
        type: 'health:ping',
        payload: null,
      };

      const parsed = parseMessage(message);
      expect(parsed.type).toBe('health:ping');
    });

    it('should parse valid health:pong message', () => {
      const message = {
        type: 'health:pong',
        payload: {
          uptime: 3600,
          memoryUsage: 50000000,
          activeClients: 3,
          activeSessions: 10,
          timestamp: '2024-01-15T10:30:00.000Z',
        },
      };

      const parsed = parseMessage(message);
      expect(parsed.type).toBe('health:pong');
      expect(parsed.payload.uptime).toBe(3600);
    });

    it('should parse valid auth:request message', () => {
      const message = {
        type: 'auth:request',
        payload: {
          clientId: 'client-123',
          clientType: 'dashboard',
          token: 'secret-token',
        },
      };

      const parsed = parseMessage(message);
      expect(parsed.type).toBe('auth:request');
      expect(parsed.payload.clientType).toBe('dashboard');
    });

    it('should parse valid auth:response message', () => {
      const message = {
        type: 'auth:response',
        payload: {
          success: true,
          clientId: 'client-123',
          assignedCapabilities: ['read:messages', 'write:messages'],
        },
      };

      const parsed = parseMessage(message);
      expect(parsed.type).toBe('auth:response');
      expect(parsed.payload.success).toBe(true);
    });

    it('should parse valid error message', () => {
      const message = {
        type: 'error',
        payload: {
          code: 'INVALID_MESSAGE',
          message: 'Invalid message format',
          timestamp: '2024-01-15T10:30:00.000Z',
        },
      };

      const parsed = parseMessage(message);
      expect(parsed.type).toBe('error');
      expect(parsed.payload.code).toBe('INVALID_MESSAGE');
    });

    it('should parse valid subscribe message', () => {
      const message = {
        type: 'subscribe',
        payload: {
          events: ['message:*', 'tool:*'],
        },
      };

      const parsed = parseMessage(message);
      expect(parsed.type).toBe('subscribe');
      expect(parsed.payload.events).toContain('message:*');
    });

    it('should parse valid unsubscribe message', () => {
      const message = {
        type: 'unsubscribe',
        payload: {
          events: ['message:*'],
        },
      };

      const parsed = parseMessage(message);
      expect(parsed.type).toBe('unsubscribe');
    });

    it('should throw on invalid message type', () => {
      const message = {
        type: 'invalid:type',
        payload: {},
      };

      expect(() => parseMessage(message)).toThrow();
    });

    it('should throw on missing required payload fields', () => {
      const message = {
        type: 'session:start',
        payload: {
          // Missing required fields
        },
      };

      expect(() => parseMessage(message)).toThrow();
    });

    it('should throw on invalid UUID format', () => {
      const message = {
        type: 'session:start',
        payload: {
          sessionId: 'not-a-uuid',
          channel: 'cli',
          senderId: 'user-123',
          trustLevel: 'standard',
        },
      };

      expect(() => parseMessage(message)).toThrow();
    });

    it('should throw on invalid trust level', () => {
      const message = {
        type: 'session:start',
        payload: {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          channel: 'cli',
          senderId: 'user-123',
          trustLevel: 'invalid-trust',
        },
      };

      expect(() => parseMessage(message)).toThrow();
    });
  });

  describe('safeParseMessage', () => {
    it('should return parsed message for valid input', () => {
      const message = {
        type: 'health:ping',
        payload: null,
      };

      const result = safeParseMessage(message);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('health:ping');
    });

    it('should return null for invalid message', () => {
      const message = {
        type: 'invalid',
        payload: {},
      };

      const result = safeParseMessage(message);
      expect(result).toBeNull();
    });

    it('should return null for malformed input', () => {
      const result = safeParseMessage('not an object');
      expect(result).toBeNull();
    });

    it('should return null for null input', () => {
      const result = safeParseMessage(null);
      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = safeParseMessage(undefined);
      expect(result).toBeNull();
    });
  });

  describe('createMessage', () => {
    it('should create a health:ping message', () => {
      const message = createMessage('health:ping', null);
      expect(message.type).toBe('health:ping');
      expect(message.payload).toBeNull();
    });

    it('should create a subscribe message', () => {
      const message = createMessage('subscribe', {
        events: ['message:*', 'tool:*'],
      });
      expect(message.type).toBe('subscribe');
      expect(message.payload.events).toEqual(['message:*', 'tool:*']);
    });

    it('should create an error message', () => {
      const message = createMessage('error', {
        code: 'TEST_ERROR',
        message: 'Test error',
        timestamp: '2024-01-15T10:30:00.000Z',
      });
      expect(message.type).toBe('error');
      expect(message.payload.code).toBe('TEST_ERROR');
    });

    it('should create a session:start message with all fields', () => {
      const message = createMessage('session:start', {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        channel: 'cli',
        senderId: 'user-123',
        trustLevel: 'standard',
        groupId: 'group-456',
        metadata: { foo: 'bar' },
      });
      expect(message.type).toBe('session:start');
      expect(message.payload.groupId).toBe('group-456');
    });
  });

  describe('createErrorMessage', () => {
    it('should create error message with code and message', () => {
      const error = createErrorMessage('TEST_ERROR', 'Test error occurred');
      expect(error.type).toBe('error');
      expect(error.payload.code).toBe('TEST_ERROR');
      expect(error.payload.message).toBe('Test error occurred');
      expect(error.payload.timestamp).toBeDefined();
    });

    it('should create error message with details', () => {
      const error = createErrorMessage('TEST_ERROR', 'Test error', { extra: 'info' });
      expect(error.payload.details).toEqual({ extra: 'info' });
    });

    it('should include ISO timestamp', () => {
      const error = createErrorMessage('TEST', 'test');
      const timestamp = error.payload.timestamp;
      expect(() => new Date(timestamp)).not.toThrow();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });

  describe('MESSAGE_TYPES', () => {
    it('should include all expected message types', () => {
      expect(MESSAGE_TYPES).toContain('session:start');
      expect(MESSAGE_TYPES).toContain('session:end');
      expect(MESSAGE_TYPES).toContain('message:send');
      expect(MESSAGE_TYPES).toContain('message:received');
      expect(MESSAGE_TYPES).toContain('message:processed');
      expect(MESSAGE_TYPES).toContain('tool:start');
      expect(MESSAGE_TYPES).toContain('tool:update');
      expect(MESSAGE_TYPES).toContain('tool:end');
      expect(MESSAGE_TYPES).toContain('channel:status');
      expect(MESSAGE_TYPES).toContain('channel:list');
      expect(MESSAGE_TYPES).toContain('channel:list:response');
      expect(MESSAGE_TYPES).toContain('health:ping');
      expect(MESSAGE_TYPES).toContain('health:pong');
      expect(MESSAGE_TYPES).toContain('auth:request');
      expect(MESSAGE_TYPES).toContain('auth:response');
      expect(MESSAGE_TYPES).toContain('error');
      expect(MESSAGE_TYPES).toContain('subscribe');
      expect(MESSAGE_TYPES).toContain('unsubscribe');
    });

    it('should have correct number of message types', () => {
      expect(MESSAGE_TYPES.length).toBe(18);
    });
  });

  describe('Payload Schemas', () => {
    describe('SessionStartPayloadSchema', () => {
      it('should validate valid payload', () => {
        const payload = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          channel: 'cli',
          senderId: 'user-123',
          trustLevel: 'standard',
        };
        const result = SessionStartPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('should allow optional groupId', () => {
        const payload = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          channel: 'cli',
          senderId: 'user-123',
          trustLevel: 'standard',
          groupId: 'group-456',
        };
        const result = SessionStartPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('should reject invalid trust level', () => {
        const payload = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          channel: 'cli',
          senderId: 'user-123',
          trustLevel: 'invalid',
        };
        const result = SessionStartPayloadSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });

    describe('SessionEndPayloadSchema', () => {
      it('should validate valid payload', () => {
        const payload = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          reason: 'user_disconnect',
        };
        const result = SessionEndPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('should reject invalid reason', () => {
        const payload = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          reason: 'invalid_reason',
        };
        const result = SessionEndPayloadSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('should accept all valid reasons', () => {
        const reasons = ['user_disconnect', 'timeout', 'error', 'channel_close'];
        for (const reason of reasons) {
          const payload = {
            sessionId: '550e8400-e29b-41d4-a716-446655440000',
            reason,
          };
          const result = SessionEndPayloadSchema.safeParse(payload);
          expect(result.success).toBe(true);
        }
      });
    });

    describe('MessagePayloadSchema', () => {
      it('should validate valid payload', () => {
        const payload = {
          messageId: '550e8400-e29b-41d4-a716-446655440000',
          sessionId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Hello',
          direction: 'inbound',
          channel: 'cli',
          senderId: 'user-123',
          timestamp: '2024-01-15T10:30:00.000Z',
        };
        const result = MessagePayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('should reject invalid direction', () => {
        const payload = {
          messageId: '550e8400-e29b-41d4-a716-446655440000',
          sessionId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Hello',
          direction: 'sideways',
          channel: 'cli',
          senderId: 'user-123',
          timestamp: '2024-01-15T10:30:00.000Z',
        };
        const result = MessagePayloadSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });

    describe('ToolStartPayloadSchema', () => {
      it('should validate valid payload', () => {
        const payload = {
          callId: '550e8400-e29b-41d4-a716-446655440000',
          toolId: 'file-read',
          toolName: 'File Read',
          agent: 'executor',
          parameters: {},
          timestamp: '2024-01-15T10:30:00.000Z',
        };
        const result = ToolStartPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('should allow optional sessionId', () => {
        const payload = {
          callId: '550e8400-e29b-41d4-a716-446655440000',
          toolId: 'file-read',
          toolName: 'File Read',
          agent: 'executor',
          sessionId: '550e8400-e29b-41d4-a716-446655440001',
          parameters: { path: '/tmp/test' },
          timestamp: '2024-01-15T10:30:00.000Z',
        };
        const result = ToolStartPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });

    describe('ToolUpdatePayloadSchema', () => {
      it('should validate valid payload', () => {
        const payload = {
          callId: '550e8400-e29b-41d4-a716-446655440000',
          toolId: 'file-read',
          status: 'running',
          timestamp: '2024-01-15T10:30:00.000Z',
        };
        const result = ToolUpdatePayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('should validate progress in range 0-100', () => {
        const validPayload = {
          callId: '550e8400-e29b-41d4-a716-446655440000',
          toolId: 'file-read',
          status: 'running',
          progress: 50,
          timestamp: '2024-01-15T10:30:00.000Z',
        };
        expect(ToolUpdatePayloadSchema.safeParse(validPayload).success).toBe(true);

        const invalidPayload = {
          ...validPayload,
          progress: 150,
        };
        expect(ToolUpdatePayloadSchema.safeParse(invalidPayload).success).toBe(false);
      });

      it('should accept all valid statuses', () => {
        const statuses = ['running', 'waiting_approval', 'processing'];
        for (const status of statuses) {
          const payload = {
            callId: '550e8400-e29b-41d4-a716-446655440000',
            toolId: 'file-read',
            status,
            timestamp: '2024-01-15T10:30:00.000Z',
          };
          expect(ToolUpdatePayloadSchema.safeParse(payload).success).toBe(true);
        }
      });
    });

    describe('ToolEndPayloadSchema', () => {
      it('should validate valid payload', () => {
        const payload = {
          callId: '550e8400-e29b-41d4-a716-446655440000',
          toolId: 'file-read',
          success: true,
          duration: 150,
          timestamp: '2024-01-15T10:30:00.000Z',
        };
        const result = ToolEndPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('should allow optional result and error', () => {
        const payload = {
          callId: '550e8400-e29b-41d4-a716-446655440000',
          toolId: 'file-read',
          success: false,
          error: 'File not found',
          duration: 50,
          timestamp: '2024-01-15T10:30:00.000Z',
        };
        const result = ToolEndPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });

    describe('ChannelStatusPayloadSchema', () => {
      it('should validate valid payload', () => {
        const payload = {
          channelId: 'ch-001',
          channelName: 'CLI',
          status: 'connected',
          activeSessions: 5,
        };
        const result = ChannelStatusPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('should accept all valid statuses', () => {
        const statuses = ['connected', 'disconnected', 'connecting', 'error'];
        for (const status of statuses) {
          const payload = {
            channelId: 'ch-001',
            channelName: 'CLI',
            status,
            activeSessions: 0,
          };
          expect(ChannelStatusPayloadSchema.safeParse(payload).success).toBe(true);
        }
      });
    });

    describe('HealthPayloadSchema', () => {
      it('should validate valid payload', () => {
        const payload = {
          uptime: 3600,
          memoryUsage: 50000000,
          activeClients: 3,
          activeSessions: 10,
          timestamp: '2024-01-15T10:30:00.000Z',
        };
        const result = HealthPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });

    describe('ErrorPayloadSchema', () => {
      it('should validate valid payload', () => {
        const payload = {
          code: 'ERROR_CODE',
          message: 'Error message',
          timestamp: '2024-01-15T10:30:00.000Z',
        };
        const result = ErrorPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('should allow optional details', () => {
        const payload = {
          code: 'ERROR_CODE',
          message: 'Error message',
          details: { extra: 'info' },
          timestamp: '2024-01-15T10:30:00.000Z',
        };
        const result = ErrorPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });

    describe('AuthPayloadSchema', () => {
      it('should validate valid payload', () => {
        const payload = {
          clientId: 'client-123',
          clientType: 'dashboard',
        };
        const result = AuthPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('should accept all valid client types', () => {
        const types = ['dashboard', 'channel', 'monitor', 'admin'];
        for (const clientType of types) {
          const payload = { clientId: 'client-123', clientType };
          expect(AuthPayloadSchema.safeParse(payload).success).toBe(true);
        }
      });

      it('should reject invalid client type', () => {
        const payload = {
          clientId: 'client-123',
          clientType: 'hacker',
        };
        const result = AuthPayloadSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });

    describe('AuthResponsePayloadSchema', () => {
      it('should validate valid payload', () => {
        const payload = {
          success: true,
          clientId: 'client-123',
          assignedCapabilities: ['read:messages'],
        };
        const result = AuthResponsePayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('should allow optional error', () => {
        const payload = {
          success: false,
          clientId: 'client-123',
          assignedCapabilities: [],
          error: 'Authentication failed',
        };
        const result = AuthResponsePayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });
  });
});
