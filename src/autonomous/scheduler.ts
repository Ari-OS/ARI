/**
 * ARI Scheduler
 *
 * Cron-like task scheduling system for proactive operations.
 * Enables ARI to run scheduled tasks autonomously:
 * - Morning briefings (7am)
 * - Knowledge indexing (3x daily)
 * - Changelog generation (7pm)
 * - Evening summaries (9pm)
 * - Agent health checks (every 15min)
 *
 * Uses simple cron expression parsing without external dependencies.
 */

import { EventBus } from '../kernel/event-bus.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const SCHEDULER_STATE_PATH = path.join(
  process.env.HOME || '~',
  '.ari',
  'scheduler-state.json'
);

export interface ScheduledTask {
  id: string;
  name: string;
  cron: string; // "0 7 * * *" = 7am daily, "*/15 * * * *" = every 15 min
  handler: string; // Method name to call
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  metadata?: Record<string, unknown>;
}

interface SchedulerState {
  tasks: Record<string, { lastRun?: string; enabled: boolean }>;
  lastChecked: string;
}

interface TaskHandler {
  (): Promise<void>;
}

/**
 * Parse a cron expression and determine next run time
 * Supports: minute hour day month weekday
 * Special: asterisk for any, asterisk-slash-N for every N
 */
function parseCronExpression(cron: string, from: Date = new Date()): Date | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minutePart, hourPart, dayPart, monthPart, weekdayPart] = parts;

  // Parse each field
  const parseField = (
    field: string,
    min: number,
    max: number
  ): number[] => {
    if (field === '*') {
      return Array.from({ length: max - min + 1 }, (_, i) => min + i);
    }
    if (field.startsWith('*/')) {
      const interval = parseInt(field.slice(2), 10);
      const result: number[] = [];
      for (let i = min; i <= max; i += interval) {
        result.push(i);
      }
      return result;
    }
    if (field.includes(',')) {
      return field.split(',').map((v) => parseInt(v, 10));
    }
    if (field.includes('-')) {
      const [start, end] = field.split('-').map((v) => parseInt(v, 10));
      const result: number[] = [];
      for (let i = start; i <= end; i++) {
        result.push(i);
      }
      return result;
    }
    return [parseInt(field, 10)];
  };

  const minutes = parseField(minutePart, 0, 59);
  const hours = parseField(hourPart, 0, 23);
  const days = parseField(dayPart, 1, 31);
  const months = parseField(monthPart, 1, 12);
  const weekdays = parseField(weekdayPart, 0, 6);

  // Find next matching time (check up to 366 days ahead)
  const next = new Date(from);
  next.setSeconds(0, 0);

  for (let attempts = 0; attempts < 366 * 24 * 60; attempts++) {
    next.setMinutes(next.getMinutes() + 1);

    const minute = next.getMinutes();
    const hour = next.getHours();
    const day = next.getDate();
    const month = next.getMonth() + 1; // 0-indexed
    const weekday = next.getDay();

    if (
      minutes.includes(minute) &&
      hours.includes(hour) &&
      days.includes(day) &&
      months.includes(month) &&
      (weekdayPart === '*' || weekdays.includes(weekday))
    ) {
      return next;
    }
  }

  return null;
}

/**
 * Default scheduled tasks for ARI
 */
const DEFAULT_TASKS: Omit<ScheduledTask, 'lastRun' | 'nextRun'>[] = [
  {
    id: 'morning-briefing',
    name: 'Morning Briefing',
    cron: '0 7 * * *', // 7:00 AM daily
    handler: 'morning_briefing',
    enabled: true,
  },
  {
    id: 'knowledge-index-morning',
    name: 'Knowledge Index (Morning)',
    cron: '0 8 * * *', // 8:00 AM daily
    handler: 'knowledge_index',
    enabled: true,
  },
  {
    id: 'knowledge-index-afternoon',
    name: 'Knowledge Index (Afternoon)',
    cron: '0 14 * * *', // 2:00 PM daily
    handler: 'knowledge_index',
    enabled: true,
  },
  {
    id: 'knowledge-index-evening',
    name: 'Knowledge Index (Evening)',
    cron: '0 20 * * *', // 8:00 PM daily
    handler: 'knowledge_index',
    enabled: true,
  },
  {
    id: 'changelog-generate',
    name: 'Changelog Generation',
    cron: '0 19 * * *', // 7:00 PM daily
    handler: 'changelog_generate',
    enabled: true,
  },
  {
    id: 'evening-summary',
    name: 'Evening Summary',
    cron: '0 21 * * *', // 9:00 PM daily
    handler: 'evening_summary',
    enabled: true,
  },
  {
    id: 'agent-health-check',
    name: 'Agent Health Check',
    cron: '*/15 * * * *', // Every 15 minutes
    handler: 'agent_health_check',
    enabled: true,
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    cron: '0 18 * * 0', // Sunday 6:00 PM
    handler: 'weekly_review',
    enabled: true,
  },

  // ==========================================================================
  // COGNITIVE LAYER 0: LEARNING LOOP TASKS
  // ==========================================================================

  {
    id: 'cognitive-performance-review',
    name: 'Cognitive Performance Review',
    cron: '0 21 * * *', // 9:00 PM daily
    handler: 'cognitive_performance_review',
    enabled: true,
    metadata: {
      pillar: 'LEARNING',
      description: 'Analyze decisions made in the past 24 hours',
    },
  },
  {
    id: 'cognitive-gap-analysis',
    name: 'Cognitive Gap Analysis',
    cron: '0 20 * * 0', // Sunday 8:00 PM
    handler: 'cognitive_gap_analysis',
    enabled: true,
    metadata: {
      pillar: 'LEARNING',
      description: 'Identify knowledge gaps from the past week',
    },
  },
  {
    id: 'cognitive-self-assessment',
    name: 'Cognitive Self-Assessment',
    cron: '0 9 1 * *', // 1st of month, 9:00 AM
    handler: 'cognitive_self_assessment',
    enabled: true,
    metadata: {
      pillar: 'LEARNING',
      description: 'Monthly comprehensive self-evaluation',
    },
  },

  // ==========================================================================
  // INITIATIVE ENGINE: Proactive autonomy and user deliverables
  // ==========================================================================

  {
    id: 'initiative-comprehensive-scan',
    name: 'Initiative Comprehensive Scan',
    cron: '0 6 * * *', // 6:00 AM daily (before morning briefing)
    handler: 'initiative_comprehensive_scan',
    enabled: true,
    metadata: {
      category: 'PROACTIVE',
      description: 'Comprehensive scan for new work to do autonomously',
    },
  },
  {
    id: 'user-daily-brief',
    name: 'User Daily Brief',
    cron: '30 7 * * *', // 7:30 AM daily (after initiative scan, before work starts)
    handler: 'user_daily_brief',
    enabled: true,
    metadata: {
      category: 'DELIVERABLES',
      description: 'Generate daily focus, action items, and insights for user',
    },
  },
  {
    id: 'initiative-midday-check',
    name: 'Initiative Midday Check',
    cron: '0 14 * * *', // 2:00 PM daily
    handler: 'initiative_midday_check',
    enabled: true,
    metadata: {
      category: 'PROACTIVE',
      description: 'Mid-day progress check and urgent initiative execution',
    },
  },
];

export class Scheduler {
  private eventBus: EventBus;
  private tasks: Map<string, ScheduledTask> = new Map();
  private handlers: Map<string, TaskHandler> = new Map();
  private running = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Initialize scheduler with default tasks
   */
  async init(): Promise<void> {
    // Load saved state
    await this.loadState();

    // Initialize default tasks
    for (const taskDef of DEFAULT_TASKS) {
      if (!this.tasks.has(taskDef.id)) {
        const nextRun = parseCronExpression(taskDef.cron) ?? undefined;
        this.tasks.set(taskDef.id, {
          ...taskDef,
          nextRun,
        });
      }
    }

    // Calculate next run times for all tasks
    this.recalculateNextRuns();
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Check every minute for due tasks
    this.checkInterval = setInterval(
      () => void this.checkAndRun(),
      60 * 1000
    );
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Register a handler for a task
   */
  registerHandler(handlerName: string, handler: TaskHandler): void {
    this.handlers.set(handlerName, handler);
  }

  /**
   * Check for due tasks and run them
   */
  async checkAndRun(): Promise<void> {
    const now = new Date();

    for (const [taskId, task] of this.tasks.entries()) {
      if (!task.enabled) continue;
      if (!task.nextRun) continue;

      if (now >= task.nextRun) {
        await this.runTask(taskId);
      }
    }

    await this.saveState();
  }

  /**
   * Run a specific task
   */
  private async runTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const startTime = new Date();

    this.eventBus.emit('scheduler:task_run', {
      taskId,
      taskName: task.name,
      startedAt: startTime,
    });

    try {
      // Get handler
      const handler = this.handlers.get(task.handler);

      if (handler) {
        await handler();
      } else {
        // eslint-disable-next-line no-console
        console.warn(`No handler registered for task: ${task.handler}`);
      }

      // Update task
      task.lastRun = startTime;
      task.nextRun = parseCronExpression(task.cron) ?? undefined;

      const duration = Date.now() - startTime.getTime();

      this.eventBus.emit('scheduler:task_complete', {
        taskId,
        taskName: task.name,
        duration,
        success: true,
        triggeredBy: 'scheduler',
      });
    } catch (error) {
      const duration = Date.now() - startTime.getTime();

      // eslint-disable-next-line no-console
      console.error(`Scheduler task ${taskId} failed:`, error);

      this.eventBus.emit('scheduler:task_complete', {
        taskId,
        taskName: task.name,
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        triggeredBy: 'scheduler',
      });

      // Still update nextRun to prevent infinite retry
      task.lastRun = startTime;
      task.nextRun = parseCronExpression(task.cron) ?? undefined;
    }
  }

  /**
   * Add a new scheduled task
   */
  addTask(task: Omit<ScheduledTask, 'nextRun'>): void {
    const nextRun = parseCronExpression(task.cron) ?? undefined;
    this.tasks.set(task.id, { ...task, nextRun });
  }

  /**
   * Remove a scheduled task
   */
  removeTask(taskId: string): boolean {
    return this.tasks.delete(taskId);
  }

  /**
   * Enable or disable a task
   */
  setTaskEnabled(taskId: string, enabled: boolean): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.enabled = enabled;
    if (enabled) {
      task.nextRun = parseCronExpression(task.cron) ?? undefined;
    }

    return true;
  }

  /**
   * Get all scheduled tasks
   */
  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get a specific task
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Manually trigger a task (bypass schedule)
   */
  async triggerTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    await this.runTask(taskId);
    return true;
  }

  /**
   * Recalculate next run times for all tasks
   */
  private recalculateNextRuns(): void {
    const now = new Date();

    for (const task of this.tasks.values()) {
      if (!task.enabled) continue;

      // Calculate from last run if available, otherwise from now
      const from = task.lastRun ? new Date(task.lastRun) : now;
      task.nextRun = parseCronExpression(task.cron, from) ?? undefined;
    }
  }

  /**
   * Load scheduler state from disk
   */
  private async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(SCHEDULER_STATE_PATH, 'utf-8');
      const state = JSON.parse(data) as SchedulerState;

      // Restore task states
      for (const [taskId, taskState] of Object.entries(state.tasks)) {
        const existingTask = this.tasks.get(taskId);
        if (existingTask) {
          existingTask.lastRun = taskState.lastRun
            ? new Date(taskState.lastRun)
            : undefined;
          existingTask.enabled = taskState.enabled;
        }
      }
    } catch {
      // No state file, start fresh
    }
  }

  /**
   * Save scheduler state to disk
   */
  private async saveState(): Promise<void> {
    const state: SchedulerState = {
      tasks: {},
      lastChecked: new Date().toISOString(),
    };

    for (const [taskId, task] of this.tasks.entries()) {
      state.tasks[taskId] = {
        lastRun: task.lastRun?.toISOString(),
        enabled: task.enabled,
      };
    }

    const dir = path.dirname(SCHEDULER_STATE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(SCHEDULER_STATE_PATH, JSON.stringify(state, null, 2));
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    running: boolean;
    taskCount: number;
    enabledCount: number;
    nextTask?: { id: string; name: string; nextRun: Date };
  } {
    let nextTask: { id: string; name: string; nextRun: Date } | undefined;
    let enabledCount = 0;

    for (const task of this.tasks.values()) {
      if (task.enabled) {
        enabledCount++;
        if (task.nextRun) {
          if (!nextTask || task.nextRun < nextTask.nextRun) {
            nextTask = {
              id: task.id,
              name: task.name,
              nextRun: task.nextRun,
            };
          }
        }
      }
    }

    return {
      running: this.running,
      taskCount: this.tasks.size,
      enabledCount,
      nextTask,
    };
  }
}

// Export cron parser for testing
export { parseCronExpression };
