import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { Message, TrustLevel, CouncilInterface, ArbiterInterface, OverseerInterface } from '../kernel/types.js';
import type { Guardian } from './guardian.js';
import type { MemoryManager } from './memory-manager.js';
import type { Executor } from './executor.js';
import type { Planner } from './planner.js';
import type { Scratchpad } from './scratchpad.js';
import type { LearningMachine } from './learning-machine.js';
import type { ContextLayerManager } from '../system/context-layers.js';
import { AgentCoordinator, type CoordinatorTask } from './coordinator.js';

/**
 * AIProvider interface — allows Core to use AI capabilities
 * without directly importing from the AI layer (preserves layer boundaries).
 * Injected by the gateway at startup.
 */
export interface AIProvider {
  query(question: string, agent?: string): Promise<string>;
  chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string,
    agent?: string,
  ): Promise<string>;
}

/**
 * Message classification result from the AI provider or heuristics.
 */
type MessageIntent = 'conversation' | 'tool_use' | 'system_command';

interface CoreConfig {
  guardian: Guardian;
  memoryManager: MemoryManager;
  executor: Executor;
  planner: Planner;
  // Optional new components
  scratchpad?: Scratchpad;
  learningMachine?: LearningMachine;
  contextLayerManager?: ContextLayerManager;
}

interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  details?: Record<string, unknown>;
}

interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'down';
  components: ComponentHealth[];
  timestamp: Date;
}

interface ProcessResult {
  blocked: boolean;
  threat_level: string;
  plan_id?: string;
  tasks_executed: number;
  tasks_succeeded: number;
  tasks_failed: number;
}

/**
 * Core - Master orchestrator agent
 * Coordinates all agents and provides the main message processing pipeline
 */
export class Core {
  private readonly auditLogger: AuditLogger;
  private readonly eventBus: EventBus;
  private readonly guardian: Guardian;
  private readonly memoryManager: MemoryManager;
  private readonly executor: Executor;
  private readonly planner: Planner;
  private readonly coordinator: AgentCoordinator;

  // New cognitive components
  private readonly scratchpad: Scratchpad | null;
  private readonly learningMachine: LearningMachine | null;
  private readonly contextLayerManager: ContextLayerManager | null;

  // AI provider for intelligent message processing
  private aiProvider: AIProvider | null = null;

  // Governance components (typed interfaces from kernel/types.ts)
  private council: CouncilInterface | null = null;
  private arbiter: ArbiterInterface | null = null;
  private overseer: OverseerInterface | null = null;

  private started = false;

  constructor(
    auditLogger: AuditLogger,
    eventBus: EventBus,
    config: CoreConfig
  ) {
    this.auditLogger = auditLogger;
    this.eventBus = eventBus;
    this.guardian = config.guardian;
    this.memoryManager = config.memoryManager;
    this.executor = config.executor;
    this.planner = config.planner;

    // Initialize agent coordinator for decentralized swarm processing
    this.coordinator = new AgentCoordinator({
      executor: this.executor,
      memoryManager: this.memoryManager,
      eventBus: this.eventBus,
      concurrency: 5, // A reasonable default for core tasks
    });

    // Initialize new cognitive components
    this.scratchpad = config.scratchpad || null;
    this.learningMachine = config.learningMachine || null;
    this.contextLayerManager = config.contextLayerManager || null;
  }

  /**
   * Set governance components (optional)
   */
  setGovernance(components: { council?: CouncilInterface; arbiter?: ArbiterInterface; overseer?: OverseerInterface }): void {
    if (components.council) this.council = components.council;
    if (components.arbiter) this.arbiter = components.arbiter;
    if (components.overseer) this.overseer = components.overseer;
  }

  /**
   * Set AI provider for intelligent message processing.
   * The AIOrchestrator implements this interface.
   */
  setAIProvider(provider: AIProvider): void {
    this.aiProvider = provider;
    this.coordinator.setAIProvider(provider);
  }

  /**
   * Start the core orchestrator
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error('Core orchestrator already started');
    }

    // Start all agents
    this.guardian.start();

    // Initialize new cognitive components
    if (this.scratchpad) {
      this.scratchpad.startCleanup();
    }

    if (this.learningMachine) {
      this.learningMachine.start();
      await this.learningMachine.loadFromMemory();
    }

    // Emit startup event
    this.eventBus.emit('agent:started', {
      agent: 'core',
      timestamp: new Date(),
    });

    const components = ['guardian', 'memory_manager', 'executor', 'planner'];
    if (this.scratchpad) components.push('scratchpad');
    if (this.learningMachine) components.push('learning_machine');
    if (this.contextLayerManager) components.push('context_layer_manager');

    await this.auditLogger.log('core:start', 'core', 'system', {
      components,
    });

    this.started = true;
  }

  /**
   * Stop the core orchestrator
   */
  async stop(reason: string = 'shutdown'): Promise<void> {
    if (!this.started) {
      return;
    }

    // Stop all agents
    this.guardian.stop();

    // Stop new cognitive components
    if (this.scratchpad) {
      this.scratchpad.stopCleanup();
    }

    if (this.learningMachine) {
      this.learningMachine.stop();
    }

    // Emit shutdown event
    this.eventBus.emit('agent:stopped', {
      agent: 'core',
      reason,
    });

    await this.auditLogger.log('core:stop', 'core', 'system', {
      reason,
    });

    this.started = false;
  }

  /**
   * Get system status
   */
  getStatus(): SystemStatus {
    const components: ComponentHealth[] = [];

    // Guardian status
    try {
      const stats = this.guardian.getStats();
      components.push({
        name: 'guardian',
        status: 'healthy',
        details: { ...stats },
      });
    } catch (error) {
      components.push({
        name: 'guardian',
        status: 'down',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    // Memory manager status
    try {
      const stats = this.memoryManager.getStats();
      components.push({
        name: 'memory_manager',
        status: stats.total_entries > 0 ? 'healthy' : 'degraded',
        details: { ...stats },
      });
    } catch (error) {
      components.push({
        name: 'memory_manager',
        status: 'down',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    // Executor status
    try {
      const tools = this.executor.getTools();
      const pending = this.executor.getPendingApprovals();
      components.push({
        name: 'executor',
        status: 'healthy',
        details: {
          registered_tools: tools.length,
          pending_approvals: pending.length,
        },
      });
    } catch (error) {
      components.push({
        name: 'executor',
        status: 'down',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    // Planner status
    try {
      const plans = this.planner.getPlans();
      components.push({
        name: 'planner',
        status: 'healthy',
        details: {
          active_plans: plans.length,
        },
      });
    } catch (error) {
      components.push({
        name: 'planner',
        status: 'down',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    // Scratchpad status
    if (this.scratchpad) {
      try {
        const stats = this.scratchpad.getStats();
        components.push({
          name: 'scratchpad',
          status: 'healthy',
          details: { ...stats },
        });
      } catch (error) {
        components.push({
          name: 'scratchpad',
          status: 'down',
          details: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    // Learning machine status
    if (this.learningMachine) {
      try {
        const stats = this.learningMachine.getStats();
        components.push({
          name: 'learning_machine',
          status: stats.totalPatterns > 0 ? 'healthy' : 'degraded',
          details: { ...stats },
        });
      } catch (error) {
        components.push({
          name: 'learning_machine',
          status: 'down',
          details: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    // Determine overall status
    const allHealthy = components.every((c) => c.status === 'healthy');
    const anyDown = components.some((c) => c.status === 'down');
    let overall: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (anyDown) {
      overall = 'down';
    } else if (!allHealthy) {
      overall = 'degraded';
    }

    return {
      overall,
      components,
      timestamp: new Date(),
    };
  }

  /**
   * Process a message through the full pipeline
   *
   * Pipeline (grounded in v12 SYSTEM/CORE.md):
   *   0. Context — build layered context from memory, patterns, knowledge
   *   1. Guardian assess — threat detection and risk scoring
   *   2. SOUL influence — apply agent identity to decision
   *   3. Route — emit to EventBus for SystemRouter context classification
   *   4. Plan — decompose message into actionable tasks
   *   5. Execute — run plan tasks through Executor with permission gating
   *   6. Learn — extract patterns for future improvement
   *   7. Audit — log final processing result
   */
  async processMessage(message: Message): Promise<ProcessResult> {
    const messageId = message.id;

    await this.auditLogger.log('core:process_message', 'core', 'system', {
      message_id: messageId,
      source: message.source,
    });

    // Step 0: Write to scratchpad for working memory
    if (this.scratchpad) {
      try {
        this.scratchpad.write('core', `message:${messageId}`, message.content, {
          taskId: messageId,
          metadata: { source: message.source, timestamp: message.timestamp },
        });
      } catch {
        this.eventBus.emit('audit:log', {
          action: 'component:degraded',
          agent: 'core',
          trustLevel: 'system',
          details: { component: 'scratchpad', operation: 'write' },
        });
      }
    }

    // Step 1: Guardian threat assessment (with cognitive enhancement)
    const assessment = await this.guardian.assessThreatEnhanced(message.content, message.source);

    if (assessment.should_block) {
      await this.auditLogger.log('core:message_blocked', 'core', 'system', {
        message_id: messageId,
        threat_level: assessment.threat_level,
        risk_score: assessment.risk_score,
      });
      return {
        blocked: true,
        threat_level: assessment.threat_level,
        tasks_executed: 0,
        tasks_succeeded: 0,
        tasks_failed: 0,
      };
    }

    // Step 3: Route message — emit to EventBus for SystemRouter
    // SystemRouter subscribes to message:accepted and handles context routing.
    // Core does not import SystemRouter directly (layer boundary).
    this.eventBus.emit('message:accepted', message);

    // Step 3.5: Retrieve learned patterns for context
    let learnedInsights: string[] = [];
    if (this.learningMachine) {
      try {
        const patterns = this.learningMachine.getPatterns();
        learnedInsights = patterns
          .filter((p: { confidence: number }) => p.confidence >= 0.7)
          .slice(0, 3)
          .map((p: { response: string; confidence: number }) => `[Learned] ${p.response} (confidence: ${(p.confidence * 100).toFixed(0)}%)`);
      } catch {
        // Pattern retrieval is non-critical — continue without it
      }
    }

    try {
      const { getPlaybookManager } = await import('./playbook-manager.js');
      const playbookMgr = getPlaybookManager();
      const playbookContext = await playbookMgr.getContextString('general');
      if (playbookContext) {
        learnedInsights.push(`[Playbook] ${playbookContext}`);
      }
    } catch {
      // Playbook retrieval is non-critical
    }

    // Step 4: Create a plan for the message
    const planDescription = learnedInsights.length > 0
      ? `Handle message: ${message.content.substring(0, 100)}\n\nLearned insights:\n${learnedInsights.join('\n')}`
      : `Handle message: ${message.content.substring(0, 100)}`;

    const planId = await this.planner.createPlan(
      `Process message ${messageId}`,
      planDescription,
      'core'
    );

    // Add a task to the plan for processing this message
    await this.planner.addTask(planId, {
      name: `Handle: ${message.content.substring(0, 50)}`,
      description: message.content,
      status: 'pending',
      dependencies: [],
      priority: this.assessPriority(assessment.threat_level),
      assigned_to: 'executor',
    });

    // Step 5: Execute available plan tasks through the Executor
    const executionResult = await this.executePlanTasks(planId, message.source);

    // Step 6: Learn from this interaction
    if (this.learningMachine) {
      try {
        await this.learningMachine.observe({
          id: messageId,
          type: executionResult.succeeded > 0 ? 'task_completed' : 'task_failed',
          success: executionResult.failed === 0,
          agent: 'core',
          taskDescription: message.content.substring(0, 200),
          steps: [`executed: ${executionResult.executed}`, `succeeded: ${executionResult.succeeded}`],
        });
      } catch {
        this.eventBus.emit('audit:log', {
          action: 'component:degraded',
          agent: 'core',
          trustLevel: 'system',
          details: { component: 'learning_machine', operation: 'observe' },
        });
      }
    }

    // Clean up scratchpad for this message
    if (this.scratchpad) {
      try {
        this.scratchpad.delete('core', `message:${messageId}`);
      } catch {
        // Non-critical cleanup failure
      }
    }

    // Step 7: Audit final result
    await this.auditLogger.log('core:message_processed', 'core', 'system', {
      message_id: messageId,
      plan_id: planId,
      threat_level: assessment.threat_level,
      tasks_executed: executionResult.executed,
      tasks_succeeded: executionResult.succeeded,
      tasks_failed: executionResult.failed,
    });

    return {
      blocked: false,
      threat_level: assessment.threat_level,
      plan_id: planId,
      tasks_executed: executionResult.executed,
      tasks_succeeded: executionResult.succeeded,
      tasks_failed: executionResult.failed,
    };
  }

  /**
   * Classify the intent of a message using simple heuristics.
   * This avoids an LLM call for classification — fast and deterministic.
   */
  private classifyIntent(content: string): MessageIntent {
    const lower = content.toLowerCase().trim();

    // System commands start with known prefixes
    const systemPrefixes = [
      'status', 'health', 'stop', 'start', 'restart',
      'audit', 'config', 'help', '//',
    ];
    if (systemPrefixes.some(p => lower.startsWith(p))) {
      return 'system_command';
    }

    // Tool use patterns — explicit tool invocation or file operations
    const toolPatterns = [
      /^(read|write|delete|create|list|search|find|execute|run)\s/,
      /^file[_:\s]/,
      /^tool[_:\s]/,
      /^web[_:\s](search|screenshot|extract)/,
    ];
    if (toolPatterns.some(p => p.test(lower))) {
      return 'tool_use';
    }

    // Default: treat as conversation (route to AI)
    return 'conversation';
  }

  /**
   * Execute all available tasks in a plan.
   *
   * Routes intelligently based on message intent:
   * - conversation → AIProvider (Claude API via AIOrchestrator)
   * - tool_use → Executor with proper tool selection
   * - system_command → Executor with system handler
   *
   * Falls back to Executor for tool-based tasks when no AI provider is set.
   */
  private async executePlanTasks(
    planId: string,
    trustLevel: TrustLevel
  ): Promise<{ executed: number; succeeded: number; failed: number }> {
    const nextTasks = this.planner.getNextTasks(planId);
    
    // Mark tasks as in progress
    for (const task of nextTasks) {
      await this.planner.updateTaskStatus(planId, task.id, 'in_progress');
    }

    // Convert planner tasks to coordinator swarm tasks
    const swarmTasks: CoordinatorTask[] = nextTasks.map(task => {
      let intent = this.classifyIntent(task.description);
      
      // Fallback to system_command if conversation intent but no AI provider
      if (intent === 'conversation' && !this.aiProvider) {
        intent = 'system_command';
      }
      
      return {
        id: task.id,
        type: intent as CoordinatorTask['type'],
        payload: {
          description: task.description,
          assigned_to: task.assigned_to,
          trustLevel
        },
        priority: task.priority === 'critical' ? 4 :
                  task.priority === 'high' ? 3 :
                  task.priority === 'medium' ? 2 : 1
      };
    });

    // Dispatch to decentralized swarm
    const results = await this.coordinator.dispatch(swarmTasks);

    const executed = results.length;
    let succeeded = 0;
    let failed = 0;

    // Update planner with results
    for (const res of results) {
      if (res.status === 'success') {
        succeeded++;
        await this.planner.updateTaskStatus(planId, res.taskId, 'completed');
      } else {
        failed++;
        await this.planner.updateTaskStatus(planId, res.taskId, 'failed');
      }
    }

    return { executed, succeeded, failed };
  }

  /**
   * Map threat level to task priority.
   * Higher perceived threat → higher priority for processing.
   */
  private assessPriority(threatLevel: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (threatLevel) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'high';
      case 'low':
        return 'medium';
      default:
        return 'medium';
    }
  }
}
