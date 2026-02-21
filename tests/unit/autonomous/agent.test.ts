import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted for mocks that need to be referenced in vi.mock
const {
  mockQueueInit,
  mockQueueAdd,
  mockQueueGetNext,
  mockQueueUpdateStatus,
  mockQueueCleanup,
  mockAIQuery,
  mockAISummarize,
  mockAIChat,
  mockNotifyTaskComplete,
  mockNotifyError,
  mockNotifyQuestion,
  mockNotifyGetBatchCount,
  mockNotifySendBatchSummary,
  mockNotifyInit,
  mockAuditCheckThresholds,
  mockAuditMaybeSendDailyReport,
  mockDailyAuditLogActivity,
  mockDailyAuditRecordSessionTask,
  mockReadFile,
  mockWriteFile,
  mockMkdir,
  mockEventBusEmit,
} = vi.hoisted(() => ({
  mockQueueInit: vi.fn(),
  mockQueueAdd: vi.fn(),
  mockQueueGetNext: vi.fn(),
  mockQueueUpdateStatus: vi.fn(),
  mockQueueCleanup: vi.fn(),
  mockAIQuery: vi.fn(),
  mockAISummarize: vi.fn(),
  mockAIChat: vi.fn(),
  mockNotifyTaskComplete: vi.fn(),
  mockNotifyError: vi.fn(),
  mockNotifyQuestion: vi.fn(),
  mockNotifyGetBatchCount: vi.fn(),
  mockNotifySendBatchSummary: vi.fn(),
  mockNotifyInit: vi.fn(),
  mockAuditCheckThresholds: vi.fn(),
  mockAuditMaybeSendDailyReport: vi.fn(),
  mockDailyAuditLogActivity: vi.fn(),
  mockDailyAuditRecordSessionTask: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockMkdir: vi.fn(),
  mockEventBusEmit: vi.fn(),
}));

// Mock TaskQueue
vi.mock('../../../src/autonomous/task-queue.js', () => ({
  TaskQueue: vi.fn(),
  taskQueue: {
    init: mockQueueInit,
    add: mockQueueAdd,
    getNext: mockQueueGetNext,
    updateStatus: mockQueueUpdateStatus,
    cleanup: mockQueueCleanup,
  },
}));

// Mock NotificationManager
vi.mock('../../../src/autonomous/notification-manager.js', () => ({
  notificationManager: {
    init: mockNotifyInit,
    taskComplete: mockNotifyTaskComplete,
    error: mockNotifyError,
    question: mockNotifyQuestion,
    insight: vi.fn().mockResolvedValue({ sent: true }),
    getBatchCount: mockNotifyGetBatchCount,
    sendBatchSummary: mockNotifySendBatchSummary,
  },
}));

// Mock AuditReporter
vi.mock('../../../src/autonomous/audit-reporter.js', () => ({
  auditReporter: {
    checkThresholds: mockAuditCheckThresholds,
    maybeSendDailyReport: mockAuditMaybeSendDailyReport,
  },
}));

// Mock DailyAudit
vi.mock('../../../src/autonomous/daily-audit.js', () => ({
  dailyAudit: {
    logActivity: mockDailyAuditLogActivity,
    recordSessionTask: mockDailyAuditRecordSessionTask,
  },
}));

// Mock fs
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
  },
}));

// Mock EventBus
vi.mock('../../../src/kernel/event-bus.js', () => ({
  EventBus: vi.fn().mockImplementation(() => ({
    emit: mockEventBusEmit,
    on: vi.fn().mockReturnValue(() => {}),
    off: vi.fn(),
  })),
}));

// Mock Scheduler — prevents real cron tasks from running during tests
vi.mock('../../../src/autonomous/scheduler.js', () => ({
  Scheduler: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    stop: vi.fn(),
    checkAndRun: vi.fn().mockResolvedValue(undefined),
    registerHandler: vi.fn(),
    registerTask: vi.fn(),
    getState: vi.fn().mockReturnValue([]),
  })),
}));

import { AutonomousAgent } from '../../../src/autonomous/agent.js';
import { EventBus } from '../../../src/kernel/event-bus.js';

describe('AutonomousAgent', () => {
  let agent: AutonomousAgent;
  let eventBus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));

    // Set default mock return values
    mockQueueInit.mockResolvedValue(undefined);
    mockQueueAdd.mockResolvedValue({ id: 'task-123', content: 'test', status: 'pending' });
    mockQueueGetNext.mockResolvedValue(null);
    mockQueueUpdateStatus.mockResolvedValue(undefined);
    mockQueueCleanup.mockResolvedValue(0);
    mockAIQuery.mockResolvedValue('Done!');
    mockAISummarize.mockResolvedValue('Task completed');
    mockAIChat.mockResolvedValue('Chat response');
    mockNotifyTaskComplete.mockResolvedValue({ sent: true });
    mockNotifyError.mockResolvedValue({ sent: true });
    mockNotifyQuestion.mockResolvedValue({ sent: true });
    mockNotifyGetBatchCount.mockReturnValue(0);
    mockNotifySendBatchSummary.mockResolvedValue(undefined);
    mockNotifyInit.mockResolvedValue({ sms: false, telegram: false, notion: false });
    mockAuditCheckThresholds.mockResolvedValue(undefined);
    mockAuditMaybeSendDailyReport.mockResolvedValue(undefined);
    mockDailyAuditLogActivity.mockResolvedValue(undefined);
    mockDailyAuditRecordSessionTask.mockReturnValue(undefined);
    mockReadFile.mockRejectedValue(new Error('ENOENT')); // Default: no config
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);

    const mockAIProvider = {
      query: mockAIQuery,
      summarize: mockAISummarize,
      chat: mockAIChat,
    };

    eventBus = new EventBus();
    agent = new AutonomousAgent(eventBus, undefined, mockAIProvider);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const a = new AutonomousAgent(eventBus);
      expect(a).toBeDefined();
    });

    it('should merge custom config', () => {
      const a = new AutonomousAgent(eventBus, { pollIntervalMs: 10000 });
      expect(a).toBeDefined();
    });
  });

  describe('init()', () => {
    it('should initialize queue', async () => {
      await agent.init();

      expect(mockQueueInit).toHaveBeenCalled();
    }, 30000);

    it('should load config from file if exists', async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ enabled: true, pollIntervalMs: 3000 }));

      await agent.init();

      expect(mockReadFile).toHaveBeenCalled();
    });

    it('should load previous state if exists', async () => {
      mockReadFile
        .mockRejectedValueOnce(new Error('ENOENT')) // Config file
        .mockResolvedValueOnce(JSON.stringify({ tasksProcessed: 50 })); // State file

      await agent.init();

      const status = agent.getStatus();
      expect(status.tasksProcessed).toBe(50);
    });

    it('should initialize notification manager', async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({
        enabled: true,
      }));

      await agent.init();

      expect(mockNotifyInit).toHaveBeenCalled();
    });

    it('should emit agent:started event', async () => {
      await agent.init();

      expect(mockEventBusEmit).toHaveBeenCalledWith('agent:started', expect.any(Object));
    });
  });

  describe('start()', () => {
    it('should return early if disabled', async () => {
      await agent.start();

      // Agent remains disabled, no polling starts
      const status = agent.getStatus();
      expect(status.running).toBe(false);
    });

    it('should start polling when enabled', async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ enabled: true }));

      await agent.start();

      // Agent should be running after start
      const status = agent.getStatus();
      expect(status.running).toBe(true);
    });

    it('should not start twice', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ enabled: true }));

      await agent.start();
      const callsAfterFirstStart = mockWriteFile.mock.calls.length;

      await agent.start(); // Second call

      // Second start should not write additional state
      expect(mockWriteFile.mock.calls.length).toBe(callsAfterFirstStart);
    });

    it('should save state on start', async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ enabled: true }));

      await agent.start();

      expect(mockWriteFile).toHaveBeenCalled();
    });
  });

  describe('stop()', () => {
    it('should stop the agent', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ enabled: true }));

      await agent.start();
      await agent.stop();

      expect(mockEventBusEmit).toHaveBeenCalledWith('agent:stopped', expect.any(Object));
    });

    it('should do nothing if not running', async () => {
      await agent.stop();

      // Should not emit stop event
      expect(mockEventBusEmit).not.toHaveBeenCalledWith('agent:stopped', expect.any(Object));
    });

    it('should clear poll timer', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ enabled: true }));

      await agent.start();

      // Advance timer to trigger first poll
      vi.advanceTimersByTime(5000);

      await agent.stop();

      // Advance more time - no additional polls should happen
      vi.advanceTimersByTime(10000);

      // Only the initial calls
    });
  });

  describe('addTask()', () => {
    it('should add task to queue', async () => {
      await agent.init();

      const task = await agent.addTask('Do something', 'high');

      expect(mockQueueAdd).toHaveBeenCalledWith('Do something', 'api', 'high');
      expect(task.id).toBe('task-123');
    });

    it('should use normal priority by default', async () => {
      await agent.init();

      await agent.addTask('Do something');

      expect(mockQueueAdd).toHaveBeenCalledWith('Do something', 'api', 'normal');
    });
  });

  describe('getStatus()', () => {
    it('should return current status', () => {
      const status = agent.getStatus();

      expect(status).toEqual(expect.objectContaining({
        running: false,
        startedAt: null,
        tasksProcessed: 0,
        lastActivity: null,
        errors: 0,
      }));
    });
  });

  describe('updateConfig()', () => {
    it('should update config and save to file', async () => {
      await agent.updateConfig({ pollIntervalMs: 10000 });

      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should restart agent if running', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ enabled: true }));

      await agent.start();

      await agent.updateConfig({ pollIntervalMs: 10000 });

      // Agent should still be running after config update
      const status = agent.getStatus();
      expect(status.running).toBe(true);
    });
  });

  describe('polling', () => {
    beforeEach(async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        enabled: true,
        pollIntervalMs: 1000,
      }));
    });

    it('should process pending tasks', async () => {
      mockQueueGetNext.mockResolvedValueOnce({
        id: 'task-1',
        content: 'Test task',
        status: 'pending',
        source: 'api',
        priority: 'normal',
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Temporarily use real timers so async chains complete naturally
      vi.useRealTimers();
      await agent.start();
      // Wait for the poll() async chain to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
      vi.useFakeTimers();

      expect(mockAIQuery).toHaveBeenCalledWith(expect.stringContaining('Test task'), 'autonomous');
      expect(mockAISummarize).toHaveBeenCalled();

      consoleSpy.mockRestore();
      await agent.stop();
    });

    it('should handle task processing errors', async () => {
      mockQueueGetNext.mockResolvedValueOnce({
        id: 'task-1',
        content: 'Test task',
        status: 'pending',
        source: 'api',
        priority: 'normal',
      });
      mockAIQuery.mockRejectedValueOnce(new Error('API Error'));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await agent.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(mockQueueUpdateStatus).toHaveBeenCalledWith('task-1', 'failed', undefined, 'API Error');
      expect(mockNotifyError).toHaveBeenCalled();

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      await agent.stop();
    });

    it('should check thresholds', async () => {
      await agent.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(mockAuditCheckThresholds).toHaveBeenCalled();

      await agent.stop();
    });

    it('should check for daily reports', async () => {
      await agent.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(mockAuditMaybeSendDailyReport).toHaveBeenCalled();

      await agent.stop();
    });

    it('should trigger daily report at appropriate hours via audit reporter', async () => {
      // Batch notifications are now handled by auditReporter.maybeSendDailyReport()
      // which is called in the poll loop - testing that the audit reporter is called
      const date = new Date();
      date.setHours(8, 0, 0, 0);
      vi.setSystemTime(date);

      await agent.start();
      await vi.advanceTimersByTimeAsync(100);

      // Verify audit reporter's maybeSendDailyReport is called
      expect(mockAuditMaybeSendDailyReport).toHaveBeenCalled();

      await agent.stop();
    });

    it('should handle poll errors', async () => {
      mockQueueGetNext.mockRejectedValueOnce(new Error('Queue error'));

      await agent.start();

      const errorsBefore = agent.getStatus().errors;

      // Allow event loop to process async rejection
      await new Promise(resolve => process.nextTick(resolve));
      await vi.advanceTimersByTimeAsync(1000);
      await new Promise(resolve => process.nextTick(resolve));

      // Error count should increment when poll fails
      const errorsAfter = agent.getStatus().errors;
      expect(errorsAfter).toBeGreaterThan(errorsBefore);

      await agent.stop();
    });

    it('should notify after 10 accumulated errors', async () => {
      mockQueueGetNext.mockRejectedValue(new Error('Queue error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await agent.start();

      // Run 10 polls to accumulate errors
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      expect(mockNotifyError).toHaveBeenCalledWith('Agent Errors', expect.stringContaining('10 errors'));

      consoleErrorSpy.mockRestore();
      await agent.stop();
    });

    it('should require confirmation for dangerous commands', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        enabled: true,
        pollIntervalMs: 1000,
        security: { requireConfirmation: true },
      }));

      mockQueueGetNext.mockResolvedValueOnce({
        id: 'task-1',
        content: 'delete all temporary files',
        status: 'pending',
        source: 'api',
        priority: 'normal',
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await agent.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(mockNotifyQuestion).toHaveBeenCalled();
      expect(mockQueueUpdateStatus).toHaveBeenCalledWith('task-1', 'pending', 'Awaiting confirmation');

      consoleSpy.mockRestore();
      await agent.stop();
    });
  });

  describe('task completion', () => {
    beforeEach(async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        enabled: true,
        pollIntervalMs: 1000,
      }));
    });

    it('should update task status on success', async () => {
      mockQueueGetNext.mockResolvedValueOnce({
        id: 'task-1',
        content: 'Test task',
        status: 'pending',
        source: 'api',
        priority: 'normal',
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await agent.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(mockQueueUpdateStatus).toHaveBeenCalledWith('task-1', 'completed', 'Done!');

      consoleSpy.mockRestore();
      await agent.stop();
    });

    it('should log activity to daily audit', async () => {
      mockQueueGetNext.mockResolvedValueOnce({
        id: 'task-1',
        content: 'Test task',
        status: 'pending',
        source: 'api',
        priority: 'normal',
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await agent.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(mockDailyAuditLogActivity).toHaveBeenCalledWith(
        'task_completed',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ outcome: 'success' })
      );
      expect(mockDailyAuditRecordSessionTask).toHaveBeenCalled();

      consoleSpy.mockRestore();
      await agent.stop();
    });

    it('should notify on completion', async () => {
      mockQueueGetNext.mockResolvedValueOnce({
        id: 'task-1',
        content: 'Test task',
        status: 'pending',
        source: 'api',
        priority: 'normal',
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await agent.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(mockNotifyTaskComplete).toHaveBeenCalled();

      consoleSpy.mockRestore();
      await agent.stop();
    });
  });
});
