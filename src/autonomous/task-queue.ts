/**
 * ARI Task Queue
 *
 * File-based persistent task queue for autonomous operation.
 * Tasks survive restarts and are processed in priority order.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { Task, TaskSchema, TaskPriority, TaskStatus, TaskSource } from './types.js';

const QUEUE_DIR = process.env.NODE_ENV === 'test'
  ? path.join(tmpdir(), `ari-queue-${Date.now()}-${randomUUID()}`)
  : path.join(process.env.HOME || '~', '.ari', 'queue');
const QUEUE_FILE = path.join(QUEUE_DIR, 'tasks.json');

export class TaskQueue {
  private tasks: Map<string, Task> = new Map();
  private initialized = false;

  /**
   * Reset queue state for testing purposes only.
   * WARNING: This clears all tasks in memory and on disk. Use only in test environments.
   * @internal
   */
  async _resetForTesting(): Promise<void> {
    this.tasks.clear();
    this.initialized = false;
    // Also clear the file to prevent loading stale data
    try {
      await fs.writeFile(QUEUE_FILE, '[]', 'utf-8');
    } catch {
      // File may not exist yet
    }
  }

  /**
   * Initialize the queue, loading from disk
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await fs.mkdir(QUEUE_DIR, { recursive: true });

    try {
      const data = await fs.readFile(QUEUE_FILE, 'utf-8');
      const parsed = JSON.parse(data) as unknown;

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const validated = TaskSchema.safeParse(item);
          if (validated.success) {
            this.tasks.set(validated.data.id, validated.data);
          }
        }
      }
    } catch {
      // File doesn't exist or is invalid, start fresh
    }

    this.initialized = true;
  }

  /**
   * Save queue to disk
   */
  private async save(): Promise<void> {
    const data = JSON.stringify(Array.from(this.tasks.values()), null, 2);
    await fs.writeFile(QUEUE_FILE, data, 'utf-8');
  }

  /**
   * Add a new task to the queue
   */
  async add(
    content: string,
    source: TaskSource,
    priority: TaskPriority = 'normal',
    metadata?: Record<string, unknown>
  ): Promise<Task> {
    await this.init();

    const task: Task = {
      id: randomUUID(),
      content,
      source,
      priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
      metadata,
    };

    this.tasks.set(task.id, task);
    await this.save();

    return task;
  }

  /**
   * Get the next pending task (highest priority, oldest first)
   */
  async getNext(): Promise<Task | null> {
    await this.init();

    const priorityOrder: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];
    const pending = Array.from(this.tasks.values())
      .filter(t => t.status === 'pending')
      .sort((a, b) => {
        const aPrio = priorityOrder.indexOf(a.priority);
        const bPrio = priorityOrder.indexOf(b.priority);
        if (aPrio !== bPrio) return aPrio - bPrio;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    return pending[0] || null;
  }

  /**
   * Update task status
   */
  async updateStatus(
    taskId: string,
    status: TaskStatus,
    result?: string,
    error?: string
  ): Promise<Task | null> {
    await this.init();

    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.status = status;

    if (status === 'processing' && !task.startedAt) {
      task.startedAt = new Date().toISOString();
    }

    if (status === 'completed' || status === 'failed') {
      task.completedAt = new Date().toISOString();
    }

    if (result) task.result = result;
    if (error) task.error = error;

    this.tasks.set(taskId, task);
    await this.save();

    return task;
  }

  /**
   * Get a task by ID
   */
  async get(taskId: string): Promise<Task | null> {
    await this.init();
    return this.tasks.get(taskId) || null;
  }

  /**
   * List all tasks with optional status filter
   */
  async list(status?: TaskStatus): Promise<Task[]> {
    await this.init();
    const all = Array.from(this.tasks.values());
    if (status) {
      return all.filter(t => t.status === status);
    }
    return all;
  }

  /**
   * Remove completed tasks older than specified hours
   */
  async cleanup(hoursOld: number = 24): Promise<number> {
    await this.init();

    const cutoff = Date.now() - hoursOld * 60 * 60 * 1000;
    let removed = 0;

    for (const [id, task] of this.tasks) {
      if (
        (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') &&
        task.completedAt &&
        new Date(task.completedAt).getTime() < cutoff
      ) {
        this.tasks.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      await this.save();
    }

    return removed;
  }

  /**
   * Get queue statistics
   */
  async stats(): Promise<Record<TaskStatus, number>> {
    await this.init();

    const stats: Record<TaskStatus, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const task of this.tasks.values()) {
      stats[task.status]++;
    }

    return stats;
  }
}

// Singleton instance
export const taskQueue = new TaskQueue();
