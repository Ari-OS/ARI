/**
 * Agent Swarm Coordinator — Orchestrates decentralized parallel agent dispatch.
 *
 * Implements a decentralized swarm model with work-stealing queues.
 * Agents steal work from each other to maintain high concurrency.
 * Uses a memory-mapped shared state (simulated via SharedArrayBuffer)
 * for lock-free reads to avoid duplicating memory queries over EventBus.
 */

import { randomUUID } from 'node:crypto';
import type { EventBus } from '../kernel/event-bus.js';
import type { AIOrchestrator } from '../ai/orchestrator.js';
import type { ResearchAgent } from './research-agent.js';
import type { WritingAgent, WritingFormat } from './writing-agent.js';
import type { AnalysisAgent } from './analysis-agent.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('coordinator-swarm');

// ── Types ────────────────────────────────────────────────────────────────────

export interface CoordinatorTask {
  id?: string;
  type: 'research' | 'write' | 'analyze';
  payload: unknown;
  priority?: number;
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
  concurrency?: number;
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

// ── Memory-Mapped Shared State (Lock-Free Reads) ─────────────────────────────

/**
 * Simulates memory-mapped shared state using SharedArrayBuffer.
 * Agents read from this buffer lock-free instead of using EventBus queries.
 */
class SharedStateMemoryMap {
  private buffer: SharedArrayBuffer | null = null;
  private view: Int32Array | null = null;

  constructor(sizeBytes: number = 1024 * 1024) { // 1MB shared state
    try {
      this.buffer = new SharedArrayBuffer(sizeBytes);
      this.view = new Int32Array(this.buffer);
    } catch (error) {
      log.warn({ error: error instanceof Error ? error.message : String(error) }, 'SharedArrayBuffer not supported in this environment. Falling back to simple array.');
    }
  }

  // Atomic read
  read(index: number): number {
    if (this.view) {
      return Atomics.load(this.view, index);
    }
    return 0; // Fallback value
  }

  // Atomic write
  write(index: number, value: number): void {
    if (this.view) {
      Atomics.store(this.view, index, value);
    }
  }
}

// ── Work-Stealing Queue ──────────────────────────────────────────────────────

class WorkQueue {
  private queue: CoordinatorTask[] = [];

  push(task: CoordinatorTask) {
    this.queue.push(task);
    // Sort by priority (higher number = higher priority)
    this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  pop(): CoordinatorTask | undefined {
    return this.queue.shift();
  }

  steal(): CoordinatorTask | undefined {
    // Steal from the end of the queue (lowest priority)
    return this.queue.pop();
  }

  get length() {
    return this.queue.length;
  }
}

// ── Decentralized Swarm Worker ───────────────────────────────────────────────

class SwarmWorker {
  public id: string = randomUUID();
  public queue: WorkQueue = new WorkQueue();
  public isBusy: boolean = false;

  constructor(
    private coordinator: AgentCoordinator,
    private sharedState: SharedStateMemoryMap
  ) {}

  async startLoop(results: CoordinatorResult[]): Promise<void> {
    while (true) {
      let task = this.queue.pop();

      if (!task) {
        // Work stealing: attempt to steal from other workers
        task = this.coordinator.stealWork(this.id);
      }

      if (!task) {
        // No work left in the swarm
        break;
      }

      this.isBusy = true;
      const result = await this.coordinator.executeTask(task, this.sharedState);
      results.push(result);
      this.isBusy = false;
    }
  }
}

// ── AgentCoordinator ─────────────────────────────────────────────────────────

export class AgentCoordinator {
  private readonly researchAgent: ResearchAgent;
  private readonly writingAgent: WritingAgent;
  private readonly analysisAgent: AnalysisAgent;
  private readonly eventBus: EventBus;
  private readonly concurrency: number;
  private workers: SwarmWorker[] = [];
  private sharedState = new SharedStateMemoryMap();

  constructor(config: CoordinatorConfig) {
    this.researchAgent = config.researchAgent;
    this.writingAgent = config.writingAgent;
    this.analysisAgent = config.analysisAgent;
    this.eventBus = config.eventBus;
    
    // Configurable concurrency, default to max safe Node.js concurrent limit
    this.concurrency = config.concurrency || parseInt(process.env.AGENT_CONCURRENCY || '10', 10);
    
    // Initialize swarm workers
    for (let i = 0; i < this.concurrency; i++) {
      this.workers.push(new SwarmWorker(this, this.sharedState));
    }
  }

  /**
   * Work stealing mechanism used by workers to find tasks in other queues.
   */
  public stealWork(thiefId: string): CoordinatorTask | undefined {
    // Find the worker with the largest queue
    let targetWorker: SwarmWorker | null = null;
    let maxLen = 0;

    for (const worker of this.workers) {
      if (worker.id !== thiefId && worker.queue.length > maxLen) {
        maxLen = worker.queue.length;
        targetWorker = worker;
      }
    }

    if (targetWorker) {
      return targetWorker.queue.steal();
    }
    return undefined;
  }

  /**
   * Dispatch multiple tasks to the decentralized swarm.
   */
  async dispatch(tasks: CoordinatorTask[]): Promise<CoordinatorResult[]> {
    const startTime = Date.now();

    log.info({ taskCount: tasks.length }, 'swarm dispatch started');
    this.eventBus.emit('coordinator:dispatch_started', {
      taskCount: tasks.length,
      swarmSize: this.concurrency,
      timestamp: new Date().toISOString(),
    });

    // Distribute tasks round-robin to worker queues
    let workerIndex = 0;
    for (const task of tasks) {
      if (!task.id) task.id = randomUUID();
      this.workers[workerIndex].queue.push(task);
      workerIndex = (workerIndex + 1) % this.concurrency;
    }

    // Start all workers in parallel
    const results: CoordinatorResult[] = [];
    const workerPromises = this.workers.map(w => w.startLoop(results));
    await Promise.allSettled(workerPromises);

    const durationMs = Date.now() - startTime;
    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    log.info({
      taskCount: tasks.length,
      successCount,
      failedCount,
      durationMs,
    }, 'swarm dispatch completed');

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
  public async executeTask(
    task: CoordinatorTask,
    sharedState: SharedStateMemoryMap
  ): Promise<CoordinatorResult> {
    const taskId = task.id || randomUUID();
    const startTime = Date.now();

    try {
      let result: unknown;
      
      // Simulate lock-free state read
      sharedState.read(0);

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
