import { describe, it, expect } from 'vitest';
import {
  TaskPrioritySchema,
  TaskStatusSchema,
  TaskSourceSchema,
  TaskSchema,
  AutonomousConfigSchema,
  CommandTypeSchema,
  NotificationPrioritySchema,
  NotificationChannelSchema,
  SMSConfigSchema,
  NotionConfigSchema,
  NotificationEntrySchema,
  QueuedNotificationSchema,
} from '../../../src/autonomous/types.js';

describe('Autonomous Types', () => {
  describe('TaskPrioritySchema', () => {
    it('should accept valid priorities', () => {
      expect(TaskPrioritySchema.parse('low')).toBe('low');
      expect(TaskPrioritySchema.parse('normal')).toBe('normal');
      expect(TaskPrioritySchema.parse('high')).toBe('high');
      expect(TaskPrioritySchema.parse('urgent')).toBe('urgent');
    });

    it('should reject invalid priorities', () => {
      expect(() => TaskPrioritySchema.parse('critical')).toThrow();
      expect(() => TaskPrioritySchema.parse('')).toThrow();
    });
  });

  describe('TaskStatusSchema', () => {
    it('should accept valid statuses', () => {
      expect(TaskStatusSchema.parse('pending')).toBe('pending');
      expect(TaskStatusSchema.parse('processing')).toBe('processing');
      expect(TaskStatusSchema.parse('completed')).toBe('completed');
      expect(TaskStatusSchema.parse('failed')).toBe('failed');
      expect(TaskStatusSchema.parse('cancelled')).toBe('cancelled');
    });

    it('should reject invalid statuses', () => {
      expect(() => TaskStatusSchema.parse('running')).toThrow();
    });
  });

  describe('TaskSourceSchema', () => {
    it('should accept valid sources', () => {
      expect(TaskSourceSchema.parse('telegram')).toBe('telegram');
      expect(TaskSourceSchema.parse('queue')).toBe('queue');
      expect(TaskSourceSchema.parse('schedule')).toBe('schedule');
      expect(TaskSourceSchema.parse('internal')).toBe('internal');
      expect(TaskSourceSchema.parse('api')).toBe('api');
    });
  });

  describe('TaskSchema', () => {
    it('should validate complete task', () => {
      const task = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        content: 'Test task',
        source: 'internal',
        priority: 'normal',
        status: 'pending',
        createdAt: '2025-01-30T10:00:00.000Z',
      };

      const result = TaskSchema.parse(task);
      expect(result.id).toBe(task.id);
      expect(result.content).toBe(task.content);
      expect(result.source).toBe('internal');
    });

    it('should apply default values', () => {
      const task = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        content: 'Test task',
        source: 'internal',
        createdAt: '2025-01-30T10:00:00.000Z',
      };

      const result = TaskSchema.parse(task);
      expect(result.priority).toBe('normal');
      expect(result.status).toBe('pending');
    });

    it('should reject empty content', () => {
      const task = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        content: '',
        source: 'internal',
        createdAt: '2025-01-30T10:00:00.000Z',
      };

      expect(() => TaskSchema.parse(task)).toThrow();
    });

    it('should reject content exceeding max length', () => {
      const task = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        content: 'a'.repeat(10001),
        source: 'internal',
        createdAt: '2025-01-30T10:00:00.000Z',
      };

      expect(() => TaskSchema.parse(task)).toThrow();
    });

    it('should accept optional fields', () => {
      const task = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        content: 'Test task',
        source: 'api',
        priority: 'high',
        status: 'completed',
        createdAt: '2025-01-30T10:00:00.000Z',
        startedAt: '2025-01-30T10:01:00.000Z',
        completedAt: '2025-01-30T10:02:00.000Z',
        result: 'Success',
        metadata: { foo: 'bar' },
      };

      const result = TaskSchema.parse(task);
      expect(result.startedAt).toBe(task.startedAt);
      expect(result.completedAt).toBe(task.completedAt);
      expect(result.result).toBe('Success');
      expect(result.metadata).toEqual({ foo: 'bar' });
    });
  });

  describe('AutonomousConfigSchema', () => {
    it('should apply all defaults', () => {
      const config = {};
      const result = AutonomousConfigSchema.parse(config);

      expect(result.enabled).toBe(false);
      expect(result.pollIntervalMs).toBe(5000);
      expect(result.maxConcurrentTasks).toBe(1);
    });

    it('should validate complete config', () => {
      const config = {
        enabled: true,
        pollIntervalMs: 10000,
        maxConcurrentTasks: 3,
        claude: {
          apiKey: 'sk-ant-xxx',
          model: 'claude-sonnet-4-20250514',
          maxTokens: 8192,
        },
        security: {
          requireConfirmation: false,
          allowedCommands: ['status', 'help'],
          blockedPatterns: ['rm -rf'],
        },
      };

      const result = AutonomousConfigSchema.parse(config);
      expect(result.enabled).toBe(true);
      expect(result.claude?.maxTokens).toBe(8192);
      expect(result.security?.allowedCommands).toContain('status');
    });

    it('should reject poll interval below minimum', () => {
      const config = {
        pollIntervalMs: 500,
      };

      expect(() => AutonomousConfigSchema.parse(config)).toThrow();
    });

    it('should reject max concurrent tasks above limit', () => {
      const config = {
        maxConcurrentTasks: 10,
      };

      expect(() => AutonomousConfigSchema.parse(config)).toThrow();
    });
  });

  describe('CommandTypeSchema', () => {
    it('should accept all command types', () => {
      const types = ['query', 'execute', 'status', 'config', 'cancel', 'help'];

      types.forEach((type) => {
        expect(CommandTypeSchema.parse(type)).toBe(type);
      });
    });
  });

  describe('NotificationPrioritySchema', () => {
    it('should accept P0-P4 priorities', () => {
      expect(NotificationPrioritySchema.parse('P0')).toBe('P0');
      expect(NotificationPrioritySchema.parse('P1')).toBe('P1');
      expect(NotificationPrioritySchema.parse('P2')).toBe('P2');
      expect(NotificationPrioritySchema.parse('P3')).toBe('P3');
      expect(NotificationPrioritySchema.parse('P4')).toBe('P4');
    });
  });

  describe('NotificationChannelSchema', () => {
    it('should accept valid channels', () => {
      expect(NotificationChannelSchema.parse('sms')).toBe('sms');
      expect(NotificationChannelSchema.parse('notion')).toBe('notion');
      expect(NotificationChannelSchema.parse('both')).toBe('both');
    });
  });

  describe('SMSConfigSchema', () => {
    it('should apply defaults', () => {
      const config = {};
      const result = SMSConfigSchema.parse(config);

      expect(result.enabled).toBe(false);
      expect(result.carrierGateway).toBe('vtext.com');
      expect(result.quietHoursStart).toBe(22);
      expect(result.quietHoursEnd).toBe(7);
      expect(result.maxPerHour).toBe(5);
      expect(result.timezone).toBe('America/Indiana/Indianapolis');
    });

    it('should validate email format', () => {
      const config = {
        enabled: true,
        gmailUser: 'invalid-email',
      };

      expect(() => SMSConfigSchema.parse(config)).toThrow();
    });

    it('should validate quiet hours range', () => {
      const config = {
        quietHoursStart: 25,
      };

      expect(() => SMSConfigSchema.parse(config)).toThrow();
    });
  });

  describe('NotionConfigSchema', () => {
    it('should apply defaults', () => {
      const config = {};
      const result = NotionConfigSchema.parse(config);

      expect(result.enabled).toBe(false);
    });

    it('should accept complete config', () => {
      const config = {
        enabled: true,
        apiKey: 'secret_xxx',
        inboxDatabaseId: 'db123',
        dailyLogParentId: 'page456',
      };

      const result = NotionConfigSchema.parse(config);
      expect(result.enabled).toBe(true);
      expect(result.apiKey).toBe('secret_xxx');
    });
  });

  describe('NotificationEntrySchema', () => {
    it('should validate complete entry', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        priority: 'P1',
        title: 'Alert',
        body: 'Something happened',
        category: 'system',
        channel: 'both',
      };

      const result = NotificationEntrySchema.parse(entry);
      expect(result.id).toBe(entry.id);
      expect(result.smsSent).toBe(false);
      expect(result.notionSent).toBe(false);
      expect(result.escalationCount).toBe(0);
    });

    it('should enforce title max length', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        priority: 'P1',
        title: 'a'.repeat(101),
        body: 'Test',
        category: 'test',
        channel: 'sms',
      };

      expect(() => NotificationEntrySchema.parse(entry)).toThrow();
    });

    it('should enforce body max length', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        priority: 'P1',
        title: 'Test',
        body: 'a'.repeat(2001),
        category: 'test',
        channel: 'notion',
      };

      expect(() => NotificationEntrySchema.parse(entry)).toThrow();
    });
  });

  describe('QueuedNotificationSchema', () => {
    it('should validate queued notification', () => {
      const queued = {
        entry: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          priority: 'P2',
          title: 'Queued Alert',
          body: 'Will be sent later',
          category: 'reminder',
          channel: 'sms',
        },
        scheduledFor: '2025-01-31T08:00:00.000Z',
        reason: 'Quiet hours',
      };

      const result = QueuedNotificationSchema.parse(queued);
      expect(result.entry.title).toBe('Queued Alert');
      expect(result.reason).toBe('Quiet hours');
    });
  });
});
