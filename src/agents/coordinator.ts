/**
 * AgentCoordinator — Orchestrates parallel agent dispatch.
 *
 * Dispatches research, writing, and analysis tasks in parallel
 * with a configurable concurrency limit. Uses Promise.allSettled
 * for fault-tolerant execution.
 */

import { randomUUID } from 'node:crypto';
import type { EventBus } from '../kernel/event-bus.js';
import type { AIOrchestrator } from '../ai/orchestrator.js';
import type { ResearchAgent } from './research-agent.js';
import type { WritingAgent, WritingFormat } from './writing-agent.js';
import type { AnalysisAgent } from './analysis-agent.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('coordinator');

// ── Types ────────────────────────────────────────────────────────────────────

export interface CoordinatorTask {
  type: 'research' | 'write' | 'analyze';
  payload: unknown;
}

export interface CoordinatorResult {
  taskId: string;
  type: string;
  status: 'success' | 'failed';
  result?: unknown;
  error?: string;
  durationMs: number;
}

interface CoordinatorConfig {
  researchAgent: ResearchAgent;
  writingAgent: WritingAgent;
  analysisAgent: AnalysisAgent;
  eventBus: EventBus;
  orchestrator: AIOrchestrator;
}

// ── Payload types for type-safe dispatch ─────────────────────────────────────

interface ResearchPayload {
  query: string;
  sources?: string[];
}

interface WritePayload {
  topic: string;
  format: WritingFormat;
  context?: string;
}

interface AnalyzePayload {
  data: string;
  question: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_CONCURRENCY = 5;

// ── AgentCoordinator ─────────────────────────────────────────────────────────

export class AgentCoordinator {
  private readonly researchAgent: ResearchAgent;
  private readonly writingAgent: WritingAgent;
  private readonly analysisAgent: AnalysisAgent;
  private readonly eventBus: EventBus;

  constructor(config: CoordinatorConfig) {
    this.researchAgent = config.researchAgent;
    this.writingAgent = config.writingAgent;
    this.analysisAgent = config.analysisAgent;
    this.eventBus = config.eventBus;
  }

  /**
   * Dispatch multiple tasks in parallel with concurrency limiting.
   * Uses Promise.allSettled so one failure doesn't abort others.
   */
  async dispatch(tasks: CoordinatorTask[]): Promise<CoordinatorResult[]> {
    const startTime = Date.now();

    log.info({ taskCount: tasks.length }, 'dispatch started');
    this.eventBus.emit('coordinator:dispatch_started', {
      taskCount: tasks.length,
      timestamp: new Date().toISOString(),
    });

    // Process in batches respecting concurrency limit
    const results: CoordinatorResult[] = [];
    for (let i = 0; i < tasks.length; i += MAX_CONCURRENCY) {
      const batch = tasks.slice(i, i + MAX_CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map((task) => this.executeTask(task)),
      );

      for (const settled of batchResults) {
        if (settled.status === 'fulfilled') {
          results.push(settled.value);
        } else {
          results.push({
            taskId: randomUUID(),
            type: 'unknown',
            status: 'failed',
            error: settled.reason instanceof Error
              ? settled.reason.message
              : String(settled.reason),
            durationMs: 0,
          });
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    log.info({
      taskCount: tasks.length,
      successCount,
      failedCount,
      durationMs,
    }, 'dispatch completed');

    this.eventBus.emit('coordinator:dispatch_completed', {
      taskCount: tasks.length,
      successCount,
      failedCount,
      durationMs,
      timestamp: new Date().toISOString(),
    });

    return results;
  }

  /**
   * Execute a single task, routing to the appropriate agent.
   */
  private async executeTask(task: CoordinatorTask): Promise<CoordinatorResult> {
    const taskId = randomUUID();
    const startTime = Date.now();

    try {
      let result: unknown;

      switch (task.type) {
        case 'research': {
          const p = task.payload as ResearchPayload;
          result = await this.researchAgent.research(p.query, p.sources);
          break;
        }
        case 'write': {
          const p = task.payload as WritePayload;
          result = await this.writingAgent.draft(p.topic, p.format, p.context);
          break;
        }
        case 'analyze': {
          const p = task.payload as AnalyzePayload;
          result = await this.analysisAgent.analyze(p.data, p.question);
          break;
        }
        default:
          throw new Error(`unknown task type: ${String(task.type)}`);
      }

      return {
        taskId,
        type: task.type,
        status: 'success',
        result,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        taskId,
        type: task.type,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      };
    }
  }
}
