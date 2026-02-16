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
import { createLogger } from '../kernel/logger.js';

const log = createLogger('scheduler');
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
  essential?: boolean; // If true, runs even when budget is in 'reduce' mode
}

export interface CheckAndRunOptions {
  essentialOnly?: boolean; // If true, only run tasks marked as essential
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
  // ============================================================================
  // ESSENTIAL TASKS - Run even when budget is in 'reduce' mode
  // These are user-facing deliverables that provide core value
  // ============================================================================
  {
    id: 'morning-briefing',
    name: 'Morning Briefing',
    cron: '0 7 * * *', // 7:00 AM daily
    handler: 'morning_briefing',
    enabled: true,
    essential: true, // User-facing deliverable
  },
  {
    id: 'evening-summary',
    name: 'Evening Summary',
    cron: '0 21 * * *', // 9:00 PM daily
    handler: 'evening_summary',
    enabled: true,
    essential: true, // User-facing deliverable
  },
  {
    id: 'agent-health-check',
    name: 'Agent Health Check',
    cron: '*/15 * * * *', // Every 15 minutes
    handler: 'agent_health_check',
    enabled: true,
    essential: true, // System health monitoring
  },
  {
    id: 'changelog-generate',
    name: 'Changelog Generation',
    cron: '0 19 * * *', // 7:00 PM daily
    handler: 'changelog_generate',
    enabled: true,
    essential: true, // User-facing deliverable
  },

  // ============================================================================
  // NON-ESSENTIAL TASKS - Skipped when budget is constrained
  // ============================================================================
  {
    id: 'knowledge-index-morning',
    name: 'Knowledge Index (Morning)',
    cron: '0 8 * * *', // 8:00 AM daily
    handler: 'knowledge_index',
    enabled: true,
    essential: false,
  },
  {
    id: 'knowledge-index-afternoon',
    name: 'Knowledge Index (Afternoon)',
    cron: '0 14 * * *', // 2:00 PM daily
    handler: 'knowledge_index',
    enabled: true,
    essential: false,
  },
  {
    id: 'knowledge-index-evening',
    name: 'Knowledge Index (Evening)',
    cron: '0 20 * * *', // 8:00 PM daily
    handler: 'knowledge_index',
    enabled: true,
    essential: false,
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    cron: '0 18 * * 0', // Sunday 6:00 PM
    handler: 'weekly_review',
    enabled: true,
    essential: false,
  },
  {
    id: 'e2e-daily-run',
    name: 'Daily E2E Test Suite',
    cron: '0 9 * * *', // 9:00 AM daily
    handler: 'e2e_daily_run',
    enabled: true,
    essential: false, // Skip when budget is constrained
    metadata: {
      description: 'Run automated E2E tests and file issues for failures',
    },
  },
  {
    id: 'self-improvement-daily',
    name: 'Daily Self-Improvement Analysis',
    cron: '0 21 * * *', // 9:00 PM daily
    handler: 'self_improvement_daily',
    enabled: true,
    essential: false,
    metadata: {
      description: 'Analyze E2E results, learning patterns, and system performance',
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
    essential: false, // Background proactive task
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
    essential: true, // USER-FACING deliverable - always run
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
    essential: false, // Background proactive task
    metadata: {
      category: 'PROACTIVE',
      description: 'Mid-day progress check and urgent initiative execution',
    },
  },

  // ============================================================================
  // MASTER PLAN PHASE 2-4: New scheduled tasks (2026-02-16)
  // All times in Eastern Time (ET)
  // ============================================================================

  // ── Health & Operations ─────────────────────────────────────────────────────
  {
    id: 'health-check',
    name: 'System Health Check',
    cron: '*/15 * * * *', // Every 15 minutes
    handler: 'health_check',
    enabled: true,
    essential: true, // Critical system monitoring
    metadata: {
      category: 'OPERATIONS',
      description: 'Check disk, memory, API connectivity, daemon status, audit integrity',
    },
  },
  {
    id: 'backup-daily',
    name: 'Daily Backup',
    cron: '0 3 * * *', // 3:00 AM daily
    handler: 'backup_daily',
    enabled: true,
    essential: false,
    metadata: {
      category: 'OPERATIONS',
      description: 'Backup ~/.ari/data/, contexts/, knowledge/ with pruning',
    },
  },
  {
    id: 'git-sync',
    name: 'Git Sync',
    cron: '0 * * * *', // Every hour on the hour
    handler: 'git_sync',
    enabled: true,
    essential: false,
    metadata: {
      category: 'OPERATIONS',
      description: 'Auto-commit and push changes to remote',
    },
  },

  // ── Knowledge & Memory ──────────────────────────────────────────────────────
  {
    id: 'gmail-ingest',
    name: 'Gmail Ingestion',
    cron: '0 7 * * *', // 7:00 AM daily
    handler: 'gmail_ingest',
    enabled: true,
    essential: true, // User-facing knowledge capture
    metadata: {
      category: 'KNOWLEDGE',
      description: 'Scan and ingest important emails into knowledge base',
    },
  },
  {
    id: 'memory-weekly',
    name: 'Weekly Memory Consolidation',
    cron: '0 17 * * 0', // Sunday 5:00 PM
    handler: 'memory_weekly',
    enabled: true,
    essential: false,
    metadata: {
      category: 'KNOWLEDGE',
      description: 'Synthesize weekly patterns, promote stable knowledge to long-term',
    },
  },

  // ── Market & Investment Intelligence ────────────────────────────────────────
  {
    id: 'market-price-check',
    name: 'Market Price Check',
    cron: '*/30 8-22 * * *', // Every 30 min, 8AM-10PM
    handler: 'market_price_check',
    enabled: true,
    essential: false,
    metadata: {
      category: 'INVESTMENT',
      description: 'Check crypto, stocks, Pokemon card prices and generate alerts',
    },
  },
  {
    id: 'portfolio-update',
    name: 'Portfolio Update',
    cron: '0 8,14,20 * * *', // 8AM, 2PM, 8PM
    handler: 'portfolio_update',
    enabled: true,
    essential: false,
    metadata: {
      category: 'INVESTMENT',
      description: 'Update portfolio values and track daily changes',
    },
  },
  {
    id: 'opportunity-daily',
    name: 'Daily Opportunity Scan',
    cron: '0 7 * * *', // 7:00 AM daily
    handler: 'opportunity_daily',
    enabled: true,
    essential: false,
    metadata: {
      category: 'INVESTMENT',
      description: 'Scan for investment, career, content, and side project opportunities',
    },
  },

  // ── Career Tracking ─────────────────────────────────────────────────────────
  {
    id: 'career-scan',
    name: 'Career Opportunity Scan',
    cron: '0 8 * * 1-5', // 8:00 AM weekdays only
    handler: 'career_scan',
    enabled: true,
    essential: false,
    metadata: {
      category: 'CAREER',
      description: 'Scan job boards for CS/SWE opportunities matching profile',
    },
  },

  // ── AI Evolution ────────────────────────────────────────────────────────────
  {
    id: 'model-evolution',
    name: 'Model Evolution Review',
    cron: '0 10 * * 1', // Monday 10:00 AM
    handler: 'model_evolution',
    enabled: true,
    essential: false,
    metadata: {
      category: 'AI',
      description: 'Review model performance, cost efficiency, and routing optimizations',
    },
  },

  // ── AI Council (Nightly Strategic Review) ───────────────────────────────────
  {
    id: 'ai-council-nightly',
    name: 'AI Council Nightly Review',
    cron: '0 22 * * *', // 10:00 PM daily
    handler: 'ai_council_nightly',
    enabled: true,
    essential: false,
    metadata: {
      category: 'STRATEGIC',
      description: 'Multi-model council review: LeadAnalyst + 4 Specialists + Moderator',
    },
  },
];

export class Scheduler {
  private eventBus: EventBus;
  private tasks: Map<string, ScheduledTask> = new Map();
  private handlers: Map<string, TaskHandler> = new Map();
  private running = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastDate: string = new Date().toISOString().split('T')[0];

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
   *
   * @param options - Optional settings
   * @param options.essentialOnly - If true, only runs tasks marked as essential (for budget reduce mode)
   */
  async checkAndRun(options: CheckAndRunOptions = {}): Promise<void> {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];

    // Check for date change (midnight rollover)
    if (currentDate !== this.lastDate) {
      this.eventBus.emit('scheduler:daily_reset', {
        date: currentDate,
        previousDate: this.lastDate,
      });

      // Emit budget:daily_reset for budget tracking components
      this.eventBus.emit('budget:daily_reset', {
        previousUsage: 0, // Budget tracker will update this internally
        profile: 'balanced',
      });

      this.lastDate = currentDate;
    }

    for (const [taskId, task] of this.tasks.entries()) {
      if (!task.enabled) continue;
      if (!task.nextRun) continue;

      // Skip non-essential tasks when in essentialOnly mode
      if (options.essentialOnly && !task.essential) {
        continue;
      }

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
        log.warn({ handler: task.handler }, 'No handler registered for task');
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

      log.error({ taskId, err: error }, 'Scheduler task failed');

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
