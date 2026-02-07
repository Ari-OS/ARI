import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { EventBus } from '../kernel/event-bus.js';
import {
  ExecutionHistoryFileSchema,
  ExecutionRecordSchema,
  type ExecutionRecord,
  type ExecutionResult,
  type TaskExecutionStats,
} from './types.js';
import { createLogger } from '../kernel/logger.js';

const logger = createLogger('execution-history');

const ARI_DIR = path.join(os.homedir(), '.ari');
const HISTORY_FILE = path.join(ARI_DIR, 'execution-history.json');

const MAX_EXECUTIONS_PER_TASK = 100;
const MAX_TOTAL_EXECUTIONS = 5000;

export class ExecutionHistoryTracker {
  private executions: ExecutionRecord[] = [];
  private eventBus: EventBus;
  private pendingExecutions: Map<string, { taskId: string; taskName: string; startedAt: Date }> = new Map();
  private initialized = false;
  private unsubscribers: Array<() => void> = [];

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    await this.ensureDirectory();
    await this.load();
    this.setupEventSubscriptions();
    this.initialized = true;

    this.eventBus.emit('audit:log', {
      action: 'execution_history:started',
      agent: 'core',
      trustLevel: 'system' as const,
      details: { executionCount: this.executions.length },
    });
  }

  private async ensureDirectory(): Promise<void> {
    await fs.mkdir(ARI_DIR, { recursive: true });
  }

  private async load(): Promise<void> {
    try {
      const content = await fs.readFile(HISTORY_FILE, 'utf-8');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(content);
      const validated = ExecutionHistoryFileSchema.parse(parsed);
      this.executions = validated.executions;
    } catch {
      // File doesn't exist or is invalid, start fresh
      this.executions = [];
    }
  }

  private async save(): Promise<void> {
    const data = {
      version: 1 as const,
      executions: this.executions,
    };
    await fs.writeFile(HISTORY_FILE, JSON.stringify(data, null, 2));
  }

  private setupEventSubscriptions(): void {
    // Track task start
    const startUnsub = this.eventBus.on('scheduler:task_run', (payload) => {
      const { taskId, taskName, runId } = payload;
      const executionId = runId ?? randomUUID();
      this.pendingExecutions.set(executionId, {
        taskId,
        taskName,
        startedAt: new Date(),
      });
    });
    this.unsubscribers.push(startUnsub);

    // Track task completion
    const completeUnsub = this.eventBus.on('scheduler:task_complete', (payload) => {
      const { taskId, taskName, success, error, runId, triggeredBy } = payload as {
        taskId: string;
        taskName: string;
        success: boolean;
        error?: string;
        runId?: string;
        triggeredBy?: 'scheduler' | 'manual' | 'api' | 'subagent';
      };

      // Find pending execution
      let executionId = runId;
      let startedAt = new Date();

      if (executionId && this.pendingExecutions.has(executionId)) {
        const pending = this.pendingExecutions.get(executionId)!;
        startedAt = pending.startedAt;
        this.pendingExecutions.delete(executionId);
      } else {
        // Try to find by taskId
        for (const [id, pending] of this.pendingExecutions.entries()) {
          if (pending.taskId === taskId) {
            executionId = id;
            startedAt = pending.startedAt;
            this.pendingExecutions.delete(id);
            break;
          }
        }
      }

      const completedAt = new Date();
      const record = this.createRecord({
        taskId,
        taskName,
        startedAt,
        completedAt,
        result: success ? 'success' : 'failure',
        error,
        triggeredBy: triggeredBy ?? 'scheduler',
      });

      this.addRecord(record);
    });
    this.unsubscribers.push(completeUnsub);
  }

  private createRecord(params: {
    taskId: string;
    taskName: string;
    startedAt: Date;
    completedAt: Date;
    result: ExecutionResult;
    error?: string;
    triggeredBy: 'scheduler' | 'manual' | 'api' | 'subagent';
    metadata?: Record<string, unknown>;
  }): ExecutionRecord {
    const record: ExecutionRecord = {
      id: randomUUID(),
      taskId: params.taskId,
      taskName: params.taskName,
      startedAt: params.startedAt.toISOString(),
      completedAt: params.completedAt.toISOString(),
      duration: params.completedAt.getTime() - params.startedAt.getTime(),
      result: params.result,
      error: params.error,
      triggeredBy: params.triggeredBy,
      metadata: params.metadata,
    };

    const parsed = ExecutionRecordSchema.safeParse(record);
    if (!parsed.success) {
      logger.error({ error: parsed.error }, 'Invalid execution record');
      return record;
    }

    return parsed.data;
  }

  private addRecord(record: ExecutionRecord): void {
    this.executions.unshift(record);

    // Enforce per-task limit
    const taskExecutions = this.executions.filter((e) => e.taskId === record.taskId);
    if (taskExecutions.length > MAX_EXECUTIONS_PER_TASK) {
      const toRemove = taskExecutions.slice(MAX_EXECUTIONS_PER_TASK);
      this.executions = this.executions.filter((e) => !toRemove.includes(e));
    }

    // Enforce total limit
    if (this.executions.length > MAX_TOTAL_EXECUTIONS) {
      this.executions = this.executions.slice(0, MAX_TOTAL_EXECUTIONS);
    }

    this.save().catch(err => logger.error({ err }, 'Failed to save execution history'));
  }

  /**
   * Record a manual execution (for API-triggered tasks)
   */
  recordExecution(params: {
    taskId: string;
    taskName: string;
    duration: number;
    result: ExecutionResult;
    error?: string;
    triggeredBy: 'scheduler' | 'manual' | 'api' | 'subagent';
    metadata?: Record<string, unknown>;
  }): ExecutionRecord {
    const now = new Date();
    const startedAt = new Date(now.getTime() - params.duration);

    const record = this.createRecord({
      taskId: params.taskId,
      taskName: params.taskName,
      startedAt,
      completedAt: now,
      result: params.result,
      error: params.error,
      triggeredBy: params.triggeredBy,
      metadata: params.metadata,
    });

    this.addRecord(record);
    return record;
  }

  /**
   * Get execution history for a specific task
   */
  getTaskHistory(taskId: string, limit = 50): ExecutionRecord[] {
    return this.executions
      .filter((e) => e.taskId === taskId)
      .slice(0, limit);
  }

  /**
   * Get recent executions across all tasks
   */
  getRecentExecutions(limit = 50): ExecutionRecord[] {
    return this.executions.slice(0, limit);
  }

  /**
   * Get execution statistics for a task
   */
  getTaskStats(taskId: string): TaskExecutionStats | null {
    const taskExecutions = this.executions.filter((e) => e.taskId === taskId);

    if (taskExecutions.length === 0) {
      return null;
    }

    const successCount = taskExecutions.filter((e) => e.result === 'success').length;
    const failureCount = taskExecutions.filter((e) => e.result === 'failure').length;
    const durations = taskExecutions.map((e) => e.duration);

    return {
      taskId,
      taskName: taskExecutions[0].taskName,
      totalExecutions: taskExecutions.length,
      successCount,
      failureCount,
      successRate: Math.round((successCount / taskExecutions.length) * 100),
      avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      lastExecution: taskExecutions[0],
    };
  }

  /**
   * Get execution statistics for all tasks
   */
  getAllTaskStats(): TaskExecutionStats[] {
    const taskIds = [...new Set(this.executions.map((e) => e.taskId))];
    return taskIds
      .map((id) => this.getTaskStats(id))
      .filter((s): s is TaskExecutionStats => s !== null);
  }

  /**
   * Stop the tracker
   */
  stop(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
  }
}
