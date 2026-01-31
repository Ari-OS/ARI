import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Scheduler, parseCronExpression } from '../../../src/autonomous/scheduler.js';
import { EventBus } from '../../../src/kernel/event-bus.js';

describe('Scheduler', () => {
  let scheduler: Scheduler;
  let eventBus: EventBus;

  beforeEach(async () => {
    eventBus = new EventBus();
    scheduler = new Scheduler(eventBus);
    await scheduler.init();
  });

  afterEach(() => {
    scheduler.stop();
  });

  describe('parseCronExpression', () => {
    it('should parse simple cron expressions', () => {
      // 7:00 AM daily
      const next = parseCronExpression('0 7 * * *');
      expect(next).toBeDefined();
      expect(next?.getHours()).toBe(7);
      expect(next?.getMinutes()).toBe(0);
    });

    it('should parse interval expressions', () => {
      // Every 15 minutes
      const now = new Date();
      const next = parseCronExpression('*/15 * * * *', now);
      expect(next).toBeDefined();
      expect(next!.getMinutes() % 15).toBe(0);
    });

    it('should return null for invalid expressions', () => {
      expect(parseCronExpression('invalid')).toBeNull();
      expect(parseCronExpression('0 7 *')).toBeNull();
    });

    it('should handle specific weekdays', () => {
      // Sunday at 6pm
      const next = parseCronExpression('0 18 * * 0');
      expect(next).toBeDefined();
      expect(next?.getDay()).toBe(0);
      expect(next?.getHours()).toBe(18);
    });
  });

  describe('task management', () => {
    it('should have default tasks after init', () => {
      const tasks = scheduler.getTasks();
      expect(tasks.length).toBeGreaterThan(0);

      const taskIds = tasks.map((t) => t.id);
      expect(taskIds).toContain('morning-briefing');
      expect(taskIds).toContain('evening-summary');
      expect(taskIds).toContain('agent-health-check');
    });

    it('should add custom tasks', () => {
      scheduler.addTask({
        id: 'test-task',
        name: 'Test Task',
        cron: '0 12 * * *',
        handler: 'test_handler',
        enabled: true,
      });

      const task = scheduler.getTask('test-task');
      expect(task).toBeDefined();
      expect(task?.name).toBe('Test Task');
    });

    it('should remove tasks', () => {
      scheduler.addTask({
        id: 'to-remove',
        name: 'To Remove',
        cron: '0 12 * * *',
        handler: 'test_handler',
        enabled: true,
      });

      expect(scheduler.removeTask('to-remove')).toBe(true);
      expect(scheduler.getTask('to-remove')).toBeUndefined();
    });

    it('should enable and disable tasks', () => {
      scheduler.setTaskEnabled('morning-briefing', false);
      const task = scheduler.getTask('morning-briefing');
      expect(task?.enabled).toBe(false);

      scheduler.setTaskEnabled('morning-briefing', true);
      const taskEnabled = scheduler.getTask('morning-briefing');
      expect(taskEnabled?.enabled).toBe(true);
    });
  });

  describe('handler registration', () => {
    it('should register and call handlers', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      scheduler.registerHandler('test_handler', handler);

      scheduler.addTask({
        id: 'immediate-task',
        name: 'Immediate',
        cron: '* * * * *', // Every minute
        handler: 'test_handler',
        enabled: true,
        lastRun: new Date(Date.now() - 120000), // 2 minutes ago
      });

      // Force the task to run
      await scheduler.triggerTask('immediate-task');
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('status', () => {
    it('should return scheduler status', () => {
      scheduler.start();
      const status = scheduler.getStatus();

      expect(status.running).toBe(true);
      expect(status.taskCount).toBeGreaterThan(0);
      expect(status.enabledCount).toBeGreaterThan(0);
    });

    it('should find next task', () => {
      const status = scheduler.getStatus();
      expect(status.nextTask).toBeDefined();
      expect(status.nextTask?.nextRun).toBeDefined();
    });
  });

  describe('events', () => {
    it('should emit task_run event', async () => {
      const runHandler = vi.fn();
      eventBus.on('scheduler:task_run', runHandler);

      scheduler.registerHandler('test_handler', vi.fn());
      scheduler.addTask({
        id: 'event-test',
        name: 'Event Test',
        cron: '* * * * *',
        handler: 'test_handler',
        enabled: true,
      });

      await scheduler.triggerTask('event-test');
      expect(runHandler).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'event-test' })
      );
    });

    it('should emit task_complete event', async () => {
      const completeHandler = vi.fn();
      eventBus.on('scheduler:task_complete', completeHandler);

      scheduler.registerHandler('test_handler', vi.fn());
      scheduler.addTask({
        id: 'complete-test',
        name: 'Complete Test',
        cron: '* * * * *',
        handler: 'test_handler',
        enabled: true,
      });

      await scheduler.triggerTask('complete-test');
      expect(completeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'complete-test',
          success: true,
        })
      );
    });
  });
});
