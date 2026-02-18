/**
 * Notion Task Monitor — Bidirectional sync
 *
 * Polls Notion tasks database every 5 minutes and emits EventBus events
 * when tasks are created, updated, or completed.
 *
 * This closes the loop: Pryce adds tasks in Notion → ARI reacts.
 * ARI creates tasks via NotionClient.createTask() → Pryce sees them in Notion.
 */

import { createLogger } from '../../kernel/logger.js';
import type { EventBus } from '../../kernel/event-bus.js';
import { NotionClient } from './client.js';

const log = createLogger('notion-task-monitor');

export interface MonitoredTask {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  category?: string;
  url: string;
  detectedAt: string;
}

export interface NotionTaskMonitorConfig {
  apiKey: string;
  tasksDatabaseId: string;
  pollIntervalMs?: number;
}

// Status values that indicate a task was just completed
const COMPLETION_STATUSES = new Set(['Done', 'Complete', 'Completed', 'Closed', 'Resolved']);

// Status values that indicate a task needs attention
const ACTION_REQUIRED_STATUSES = new Set(['Blocked', 'Needs Review', 'In Progress', 'Waiting']);

export class NotionTaskMonitor {
  private readonly eventBus: EventBus;
  private readonly config: Required<NotionTaskMonitorConfig>;
  private readonly client: NotionClient;
  private knownTasks = new Map<string, MonitoredTask>();
  private pollTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(eventBus: EventBus, config: NotionTaskMonitorConfig) {
    this.eventBus = eventBus;
    this.config = {
      ...config,
      pollIntervalMs: config.pollIntervalMs ?? 5 * 60 * 1000, // 5 min default
    };
    this.client = new NotionClient({ enabled: true, apiKey: config.apiKey });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;

    // Initial poll to seed known task state (no events on first load)
    await this.seedInitialState();

    // Start polling loop
    this.schedulePoll();
    log.info({ pollIntervalMs: this.config.pollIntervalMs }, 'Notion task monitor started');
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    log.info('Notion task monitor stopped');
  }

  // ── Polling ───────────────────────────────────────────────────────────────

  private schedulePoll(): void {
    if (!this.running) return;
    this.pollTimer = setTimeout(() => {
      void this.poll().finally(() => this.schedulePoll());
    }, this.config.pollIntervalMs);
  }

  private async seedInitialState(): Promise<void> {
    try {
      const entries = await this.client.queryDatabase(this.config.tasksDatabaseId, {});
      for (const entry of entries) {
        this.knownTasks.set(entry.id, this.toMonitoredTask(entry));
      }
      log.info({ count: entries.length }, 'Seeded initial Notion task state');
    } catch (error) {
      log.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to seed Notion task state');
    }
  }

  async poll(): Promise<void> {
    try {
      const entries = await this.client.queryDatabase(this.config.tasksDatabaseId, {});
      const now = new Date().toISOString();

      const currentIds = new Set(entries.map(e => e.id));

      for (const entry of entries) {
        const task = this.toMonitoredTask(entry);
        const previous = this.knownTasks.get(entry.id);

        if (!previous) {
          // New task appeared in Notion
          this.knownTasks.set(entry.id, task);
          this.eventBus.emit('project:proposed', {
            timestamp: now,
            name: task.title,
            description: `New Notion task: ${task.title}${task.priority ? ` [${task.priority}]` : ''}`,
          });
          log.info({ taskId: entry.id, title: task.title }, 'New Notion task detected');
        } else if (previous.status !== task.status) {
          // Status changed
          this.knownTasks.set(entry.id, task);

          if (task.status && COMPLETION_STATUSES.has(task.status)) {
            // Task completed
            this.eventBus.emit('project:approved', {
              timestamp: now,
              name: task.title,
              scaffoldedAt: now,
            });
            log.info({ taskId: entry.id, title: task.title, status: task.status }, 'Notion task completed');
          } else if (task.status && ACTION_REQUIRED_STATUSES.has(task.status)) {
            // Task needs attention
            this.eventBus.emit('preference:updated', {
              timestamp: now,
              key: `notion_task_status_${entry.id}`,
              value: { taskId: entry.id, title: task.title, status: task.status },
            });
            log.info({ taskId: entry.id, status: task.status }, 'Notion task needs attention');
          }
        }
      }

      // Remove tasks that no longer exist in Notion
      for (const [id] of this.knownTasks) {
        if (!currentIds.has(id)) {
          this.knownTasks.delete(id);
        }
      }

      this.eventBus.emit('knowledge:ingested', {
        sourceType: 'notion',
        sourceId: this.config.tasksDatabaseId,
        chunksCreated: entries.length,
      });
    } catch (error) {
      log.warn({ error: error instanceof Error ? error.message : String(error) }, 'Notion task poll failed');
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private toMonitoredTask(entry: { id: string; title: string; status?: string; priority?: string; category?: string; url: string }): MonitoredTask {
    return {
      id: entry.id,
      title: entry.title,
      status: entry.status,
      priority: entry.priority,
      category: entry.category,
      url: entry.url,
      detectedAt: new Date().toISOString(),
    };
  }

  getKnownTaskCount(): number {
    return this.knownTasks.size;
  }

  getTasksByStatus(status: string): MonitoredTask[] {
    return Array.from(this.knownTasks.values()).filter(t => t.status === status);
  }
}
