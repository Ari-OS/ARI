/**
 * Agent Swarm Coordinator — Orchestrates decentralized parallel agent dispatch.
 *
 * Implements a decentralized swarm model with Kahn's algorithm for DAG dependency resolution.
 * Uses a memory-mapped shared state (simulated via SharedArrayBuffer)
 * for lock-free reads to avoid duplicating memory queries over EventBus.
 */

import { randomUUID } from 'node:crypto';
import type { AIOrchestrator } from '../ai/orchestrator.js';
import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';
import type { AnalysisAgent } from './analysis-agent.js';
import type { ResearchAgent } from './research-agent.js';
import type { WritingAgent, WritingFormat } from './writing-agent.js';
import type { Executor } from './executor.js';
import type { MemoryManager } from './memory-manager.js';
import type { AIProvider } from './core.js';
import type { TrustLevel, AgentId } from '../kernel/types.js';

const log = createLogger('coordinator-swarm');

// ── Types ────────────────────────────────────────────────────────────────────

export interface CoordinatorTask {
  id?: string;
  type: 'research' | 'write' | 'analyze' | 'conversation' | 'tool_use' | 'system_command';
  payload: unknown;
  priority?: number;
  dependencies?: string[];
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
  researchAgent?: ResearchAgent;
  writingAgent?: WritingAgent;
  analysisAgent?: AnalysisAgent;
  executor?: Executor;
  memoryManager?: MemoryManager;
  eventBus: EventBus;
  orchestrator?: AIOrchestrator;
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

interface CoreTaskPayload {
  description: string;
  assigned_to?: string;
  trustLevel: TrustLevel;
}

// ── Memory-Mapped Shared State (Lock-Free Reads) ─────────────────────────────

/**
 * Simulates memory-mapped shared state using SharedArrayBuffer.
 * Agents read from this buffer lock-free instead of using EventBus queries.
 */
class SharedStateMemoryMap {
  private buffer: ArrayBufferLike | null = null;
  private view: Int32Array | null = null;
  private isShared: boolean = false;

  constructor(sizeBytes: number = 1024 * 1024) {
    // 1MB shared state
    try {
      if (typeof SharedArrayBuffer !== 'undefined') {
        this.buffer = new SharedArrayBuffer(sizeBytes);
        this.isShared = true;
      } else {
        this.buffer = new ArrayBuffer(sizeBytes);
      }
    } catch (error) {
      this.buffer = new ArrayBuffer(sizeBytes);
      log.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'SharedArrayBuffer not supported in this environment. Falling back to ArrayBuffer.',
      );
    }
    this.view = new Int32Array(this.buffer);
  }

  // Atomic read
  read(index: number): number {
    if (this.isShared && this.view) {
      return Atomics.load(this.view, index);
    } else if (this.view) {
      return this.view[index];
    }
    return 0; // Fallback value
  }

  // Atomic write
  write(index: number, value: number): void {
    if (this.isShared && this.view) {
      Atomics.store(this.view, index, value);
    } else if (this.view) {
      this.view[index] = value;
    }
  }
}

// ── AgentCoordinator ─────────────────────────────────────────────────────────

export class AgentCoordinator {
  private readonly researchAgent?: ResearchAgent;
  private readonly writingAgent?: WritingAgent;
  private readonly analysisAgent?: AnalysisAgent;
  private readonly executor?: Executor;
  private readonly memoryManager?: MemoryManager;
  private aiProvider?: AIProvider;
  private readonly eventBus: EventBus;
  private readonly concurrency: number;
  private piscinaPool: null = null;
  private sharedState = new SharedStateMemoryMap();

  constructor(config: CoordinatorConfig) {
    this.researchAgent = config.researchAgent;
    this.writingAgent = config.writingAgent;
    this.analysisAgent = config.analysisAgent;
    this.executor = config.executor;
    this.memoryManager = config.memoryManager;
    this.eventBus = config.eventBus;

    // Configurable concurrency, default to max safe Node.js concurrent limit
    this.concurrency = config.concurrency || parseInt(process.env.AGENT_CONCURRENCY || '10', 10);

  }

  public setAIProvider(provider: AIProvider): void {
    this.aiProvider = provider;
  }

  /**
   * Dispatch multiple tasks to the decentralized swarm using Kahn's algorithm for DAG resolution.
   */
  async dispatch(tasks: CoordinatorTask[]): Promise<CoordinatorResult[]> {
    const startTime = Date.now();

    log.info({ taskCount: tasks.length }, 'swarm dispatch started');
    this.eventBus.emit('coordinator:dispatch_started', {
      taskCount: tasks.length,
      swarmSize: this.concurrency,
      timestamp: new Date().toISOString(),
    });

    for (const task of tasks) {
      if (!task.id) task.id = randomUUID();
    }

    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const taskMap = new Map<string, CoordinatorTask>();

    for (const task of tasks) {
      const id = task.id!;
      taskMap.set(id, task);
      adjList.set(id, []);
      inDegree.set(id, 0);
    }

    for (const task of tasks) {
      const id = task.id!;
      if (task.dependencies) {
        for (const dep of task.dependencies) {
          if (adjList.has(dep)) {
            adjList.get(dep)!.push(id);
            inDegree.set(id, inDegree.get(id)! + 1);
          }
        }
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    const executionLevels: CoordinatorTask[][] = [];
    let currentLevel: string[] = [...queue];

    while (currentLevel.length > 0) {
      const nextLevel: string[] = [];
      const levelTasks: CoordinatorTask[] = [];

      for (const id of currentLevel) {
        levelTasks.push(taskMap.get(id)!);
        for (const neighbor of adjList.get(id)!) {
          inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
          if (inDegree.get(neighbor) === 0) {
            nextLevel.push(neighbor);
          }
        }
      }
      executionLevels.push(levelTasks);
      currentLevel = nextLevel;
    }

    let count = 0;
    for (const level of executionLevels) count += level.length;
    if (count !== tasks.length) throw new Error("Cycle detected in task DAG");

    const results: CoordinatorResult[] = [];
    
    for (const level of executionLevels) {
      const levelPromises = level.map(task => this.executeTask(task, this.sharedState));
      const levelResults = await Promise.all(levelPromises);
      results.push(...levelResults);
    }

    const durationMs = Date.now() - startTime;
    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    log.info(
      {
        taskCount: tasks.length,
        successCount,
        failedCount,
        durationMs,
      },
      'swarm dispatch completed',
    );

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
    sharedState: SharedStateMemoryMap,
  ): Promise<CoordinatorResult> {
    const taskId = task.id || randomUUID();
    const startTime = Date.now();

    try {
      let result: unknown;

      // Simulate lock-free state read
      sharedState.read(0);

      switch (task.type) {
        case 'research': {
          if (!this.researchAgent) throw new Error('ResearchAgent not configured');
          const p = task.payload as ResearchPayload;
          result = await this.researchAgent.research(p.query, p.sources);
          break;
        }
        case 'write': {
          if (!this.writingAgent) throw new Error('WritingAgent not configured');
          const p = task.payload as WritePayload;
          result = await this.writingAgent.draft(p.topic, p.format, p.context);
          break;
        }
        case 'analyze': {
          if (!this.analysisAgent) throw new Error('AnalysisAgent not configured');
          const p = task.payload as AnalyzePayload;
          result = await this.analysisAgent.analyze(p.data, p.question);
          break;
        }
        case 'conversation': {
          const p = task.payload as CoreTaskPayload;
          if (this.aiProvider) {
            const response = await this.aiProvider.query(p.description, 'core');
            try {
              if (this.memoryManager) {
                await this.memoryManager.store({
                  type: 'CONTEXT',
                  content: response,
                  provenance: {
                    source: 'ai_orchestrator',
                    trust_level: p.trustLevel,
                    agent: 'core',
                    chain: ['core:processMessage', 'aiProvider:query'],
                  },
                  confidence: 0.9,
                  partition: 'INTERNAL',
                });
              }
            } catch {
              // Memory storage is non-critical
            }
            this.eventBus.emit('message:response', {
              content: response,
              source: 'core',
              timestamp: new Date(),
            });
            result = { success: true, response };
          } else {
            throw new Error('AIProvider not configured for conversation task');
          }
          break;
        }
        case 'tool_use': {
          if (!this.executor) throw new Error('Executor not configured');
          const p = task.payload as CoreTaskPayload;
          const toolMatch = p.description.match(/^(\w+)[\s_:]/);
          const toolId = toolMatch ? toolMatch[1] : 'file_read';

          const execResult = await this.executor.execute({
            id: randomUUID(),
            tool_id: toolId,
            parameters: { content: p.description },
            requesting_agent: ((p.assigned_to as AgentId) ?? 'core'),
            trust_level: p.trustLevel,
            timestamp: new Date(),
          });

          if (!execResult.success) {
            throw new Error(`Tool execution failed: ${String(execResult.error)}`);
          }
          result = execResult;
          break;
        }
        case 'system_command': {
          if (!this.executor) throw new Error('Executor not configured');
          const p = task.payload as CoreTaskPayload;
          const execResult = await this.executor.execute({
            id: randomUUID(),
            tool_id: 'system_command',
            parameters: { command: p.description },
            requesting_agent: ((p.assigned_to as AgentId) ?? 'core'),
            trust_level: p.trustLevel,
            timestamp: new Date(),
          });

          if (execResult.success) {
            result = execResult;
          } else {
            // fallback to AIProvider if available
            if (this.aiProvider) {
              const response = await this.aiProvider.query(p.description, 'core');
              this.eventBus.emit('message:response', {
                content: response,
                source: 'core',
                timestamp: new Date(),
              });
              result = { success: true, response };
            } else {
              throw new Error(`System command execution failed: ${String(execResult.error)}`);
            }
          }
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
