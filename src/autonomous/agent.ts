/**
 * ARI Autonomous Agent
 *
 * The main agent loop that:
 * 1. Polls for new tasks (from queue, schedule, Telegram)
 * 2. Processes them through Claude API
 * 3. Executes approved actions
 * 4. Reports results via NotificationManager (Telegram + Notion + SMS emergency)
 *
 * This is what makes ARI truly autonomous.
 */

import { createLogger } from '../kernel/logger.js';
import { EventBus } from '../kernel/event-bus.js';
import { TaskQueue, taskQueue } from './task-queue.js';
import { ClaudeClient } from './claude-client.js';
import { AutonomousConfig, Task } from './types.js';
import { notificationManager } from './notification-manager.js';
import { auditReporter } from './audit-reporter.js';
import { dailyAudit } from './daily-audit.js';
import { Scheduler } from './scheduler.js';
import { KnowledgeIndex } from './knowledge-index.js';
import { ChangelogGenerator } from './changelog-generator.js';
import { AgentSpawner } from './agent-spawner.js';
import { BriefingGenerator } from './briefings.js';
import { InitiativeEngine } from './initiative-engine.js';
import { SelfImprovementLoop } from './self-improvement-loop.js';
import { generateDailyBrief, formatDailyBrief } from './user-deliverables.js';
import { CostTracker, ThrottleLevel } from '../observability/cost-tracker.js';
import { ApprovalQueue } from './approval-queue.js';
import { AuditLogger } from '../kernel/audit.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const log = createLogger('autonomous-agent');

const CONFIG_PATH = path.join(process.env.HOME || '~', '.ari', 'autonomous.json');
const STATE_PATH = path.join(process.env.HOME || '~', '.ari', 'agent-state.json');

interface AgentState {
  running: boolean;
  startedAt: string | null;
  tasksProcessed: number;
  lastActivity: string | null;
  errors: number;
}

export class AutonomousAgent {
  private eventBus: EventBus;
  private queue: TaskQueue;
  private claude: ClaudeClient | null = null;
  private config: AutonomousConfig;
  private state: AgentState;
  private running = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private scheduler: Scheduler;
  private knowledgeIndex: KnowledgeIndex;
  private changelogGenerator: ChangelogGenerator;
  private agentSpawner: AgentSpawner;
  private briefingGenerator: BriefingGenerator | null = null;
  private initiativeEngine: InitiativeEngine;
  private selfImprovementLoop: SelfImprovementLoop | null = null;

  // Budget-aware components
  private costTracker: CostTracker | null = null;
  private approvalQueue: ApprovalQueue | null = null;
  private lastThrottleLevel: ThrottleLevel = 'normal';

  constructor(eventBus: EventBus, config?: Partial<AutonomousConfig>) {
    this.eventBus = eventBus;
    this.queue = taskQueue;
    this.config = {
      enabled: false,
      pollIntervalMs: 5000,
      maxConcurrentTasks: 1,
      ...config,
    };
    this.state = {
      running: false,
      startedAt: null,
      tasksProcessed: 0,
      lastActivity: null,
      errors: 0,
    };

    // Initialize scheduler and autonomous components
    this.scheduler = new Scheduler(eventBus);
    this.knowledgeIndex = new KnowledgeIndex(eventBus);
    this.changelogGenerator = new ChangelogGenerator(eventBus, process.cwd());
    this.agentSpawner = new AgentSpawner(eventBus, process.cwd());

    // Initialize initiative engine for proactive autonomy
    this.initiativeEngine = new InitiativeEngine({
      projectPath: process.cwd(),
      scanIntervalMs: 30 * 60 * 1000, // 30 minutes between automatic scans
      maxInitiativesPerScan: 10,
      autoExecute: true, // Execute autonomous initiatives automatically
    });

    // Initialize budget-aware components
    // Note: CostTracker and ApprovalQueue will be fully initialized in init()
    // once we have access to the AuditLogger
    this.approvalQueue = new ApprovalQueue(eventBus);
  }

  /**
   * Initialize the autonomous agent
   */
  async init(): Promise<void> {
    // Load config from file if exists
    try {
      const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
      const fileConfig = JSON.parse(configData) as Partial<AutonomousConfig>;
      this.config = { ...this.config, ...fileConfig };
    } catch (err) {
      log.warn({ error: err instanceof Error ? err.message : String(err) }, 'Config parse failed, using defaults');
    }

    // Load previous state
    try {
      const stateData = await fs.readFile(STATE_PATH, 'utf-8');
      const prevState = JSON.parse(stateData) as Partial<AgentState>;
      this.state.tasksProcessed = prevState.tasksProcessed ?? 0;
    } catch (err) {
      log.info({ error: err instanceof Error ? err.message : String(err) }, 'No previous state, starting fresh');
    }

    // Initialize queue
    await this.queue.init();

    // Initialize scheduler and register handlers
    await this.scheduler.init();
    this.registerSchedulerHandlers();

    // Initialize knowledge index
    await this.knowledgeIndex.init();

    // Initialize agent spawner
    await this.agentSpawner.init();

    // Initialize initiative engine (proactive autonomy)
    await this.initiativeEngine.init();

    // Initialize self-improvement loop
    this.selfImprovementLoop = new SelfImprovementLoop(this.eventBus, {
      config: { governanceEnabled: true },
    });
    await this.selfImprovementLoop.initialize();

    // Initialize CostTracker for budget-aware operations
    // Uses a lightweight audit logger that emits events (full AuditLogger requires more setup)
    const lightweightAuditLogger = {
      log: (action: string, agent: string, trustLevel: 'system' | 'operator' | 'verified' | 'standard' | 'untrusted' | 'hostile', details: Record<string, unknown>): Promise<void> => {
        this.eventBus.emit('audit:log', { action, agent, trustLevel, details });
        return Promise.resolve();
      },
    } as unknown as AuditLogger;
    this.costTracker = new CostTracker(this.eventBus, lightweightAuditLogger);

    // Log budget status on init
    const throttleStatus = this.costTracker.getThrottleStatus();
    log.info({ usagePercent: throttleStatus.usagePercent.toFixed(1), level: throttleStatus.level }, 'Budget initialized');

    // Initialize notification manager
    notificationManager.initLegacy();

    // Initialize Claude if configured
    if (this.config.claude?.apiKey) {
      this.claude = new ClaudeClient({
        apiKey: this.config.claude.apiKey,
        model: this.config.claude.model,
        maxTokens: this.config.claude.maxTokens,
      });
    }

    this.eventBus.emit('agent:started', {
      agent: 'autonomous',
      timestamp: new Date(),
    });
  }

  /**
   * Start the autonomous agent loop
   */
  async start(): Promise<void> {
    if (this.running) return;

    await this.init();

    if (!this.config.enabled) {
      log.info('Autonomous agent is disabled in config');
      return;
    }

    this.running = true;
    this.state.running = true;
    this.state.startedAt = new Date().toISOString();

    await this.saveState();

    // Start scheduler
    this.scheduler.start();

    // Start initiative engine (proactive autonomy)
    void this.initiativeEngine.start();

    // No notification on startup - saves tokens and reduces noise
    // Only notify on errors or important events

    // Start polling loop
    void this.poll();

    log.info('Autonomous agent started');
  }

  /**
   * Stop the autonomous agent
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    this.state.running = false;

    // Stop scheduler
    this.scheduler.stop();

    // Stop initiative engine
    this.initiativeEngine.stop();

    // Stop self-improvement loop
    if (this.selfImprovementLoop) {
      await this.selfImprovementLoop.shutdown();
    }

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    await this.saveState();

    // No notification on shutdown - saves tokens and reduces noise

    this.eventBus.emit('agent:stopped', {
      agent: 'autonomous',
      reason: 'manual stop',
    });

    log.info('Autonomous agent stopped');
  }

  /**
   * Main polling loop - Now budget-aware!
   *
   * Throttle Behavior by Level:
   * - normal: Full operation, all features enabled
   * - warning (80%+): Log warning, continue operation
   * - reduce (90%+): Skip non-essential tasks, essential only
   * - pause (95%+): User interactions only, all autonomous work paused
   */
  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      // ========================================================================
      // BUDGET CHECK: First thing in every poll cycle
      // ========================================================================
      const throttleStatus = this.costTracker?.getThrottleStatus();
      const currentThrottleLevel = throttleStatus?.level ?? 'normal';

      // Log throttle state changes
      if (currentThrottleLevel !== this.lastThrottleLevel) {
        log.info({ from: this.lastThrottleLevel, to: currentThrottleLevel }, 'Budget throttle level changed');
        this.lastThrottleLevel = currentThrottleLevel;

        // Emit event for other systems to react
        this.eventBus.emit('audit:log', {
          action: 'budget_throttle_changed',
          agent: 'autonomous',
          trustLevel: 'system',
          details: {
            previousLevel: this.lastThrottleLevel,
            newLevel: currentThrottleLevel,
            usagePercent: throttleStatus?.usagePercent,
            recommendation: throttleStatus?.recommendation,
          },
        });

        // Critical notification when hitting pause level
        if (currentThrottleLevel === 'pause') {
          await notificationManager.error(
            'Budget Critical',
            `Budget ${throttleStatus?.usagePercent.toFixed(1)}% used. Autonomous work paused until midnight reset.`
          );
        } else if (currentThrottleLevel === 'reduce') {
          await notificationManager.insight(
            'Budget Warning',
            `Budget ${throttleStatus?.usagePercent.toFixed(1)}% used. Running essential tasks only.`
          );
        }
      }

      // ========================================================================
      // THROTTLE BEHAVIOR BY LEVEL
      // ========================================================================

      if (currentThrottleLevel === 'pause') {
        // PAUSE: Only user interactions allowed (URGENT priority)
        log.warn('95%+ consumed - autonomous work paused until midnight reset');

        // Process pending tasks that came from user (URGENT)
        // These bypass budget checks
        await this.processNextTask();

        // Skip everything else - no scheduler, no initiatives, no cleanup
        this.state.lastActivity = new Date().toISOString();
        this.pollTimer = setTimeout(() => { void this.poll(); }, this.config.pollIntervalMs);
        return;
      }

      if (currentThrottleLevel === 'reduce') {
        // REDUCE: Essential tasks only (STANDARD priority allowed, BACKGROUND skipped)
        log.info('90%+ consumed - running essential tasks only');

        // Run scheduler with essential-only flag
        await this.scheduler.checkAndRun({ essentialOnly: true });

        // Process pending tasks (STANDARD priority)
        await this.processNextTask();

        // Check thresholds (essential)
        await auditReporter.checkThresholds();
        await auditReporter.maybeSendDailyReport();

        // Skip initiatives and periodic cleanup (BACKGROUND tasks)
        this.state.lastActivity = new Date().toISOString();
        this.pollTimer = setTimeout(() => { void this.poll(); }, this.config.pollIntervalMs);
        return;
      }

      if (currentThrottleLevel === 'warning') {
        // WARNING: Log but continue with reduced initiative execution
        log.info({ usagePercent: throttleStatus?.usagePercent.toFixed(1) }, 'Budget warning - monitoring usage');
      }

      // ========================================================================
      // NORMAL OPERATION (or warning level with full features)
      // ========================================================================

      // Check scheduled tasks first
      await this.scheduler.checkAndRun();

      // Process pending tasks
      await this.processNextTask();

      // Check thresholds (cost, errors, etc.) - runs every poll but has internal cooldowns
      await auditReporter.checkThresholds();

      // Check if daily report should be sent (8am or 9pm)
      await auditReporter.maybeSendDailyReport();

      // ==========================================================================
      // INITIATIVE ENGINE: Budget-aware proactive autonomy
      // ==========================================================================
      // Quick scan for initiatives (~5% chance each poll to avoid overhead)
      // At warning level, reduce to ~2% chance
      const scanChance = currentThrottleLevel === 'warning' ? 0.02 : 0.05;

      if (Math.random() < scanChance) {
        const initiatives = await this.initiativeEngine.scan();
        if (initiatives.length > 0) {
          log.info({ count: initiatives.length }, 'Initiatives discovered');

          // Get profile thresholds for auto-execute decisions
          const profile = this.costTracker?.getProfile();
          const autoThreshold = profile?.initiatives?.autoExecuteThreshold ?? {
            maxCostPerTask: 0.25,
            maxRisk: 40,
            maxFilesAffected: 5,
            minPriority: 65,
          };
          const approvalThreshold = profile?.initiatives?.approvalRequired ?? {
            minCost: 0.50,
            minRisk: 60,
            minFilesAffected: 10,
            touchesSecurity: true,
          };

          // Filter autonomous initiatives by profile thresholds
          const autonomous = initiatives.filter(i =>
            i.autonomous &&
            i.priority >= autoThreshold.minPriority
          );

          // Execute with budget check
          let executed = 0;
          const maxPerCycle = currentThrottleLevel === 'warning' ? 1 : 2;

          for (const initiative of autonomous.slice(0, maxPerCycle)) {
            // Estimate tokens for this initiative (rough estimate: 10K per initiative)
            const estimatedTokens = 10000;

            // Check if budget allows
            const canProceed = this.costTracker?.canProceed(estimatedTokens, 'BACKGROUND');

            if (canProceed?.allowed) {
              try {
                log.info({ title: initiative.title }, 'Executing initiative');
                await this.initiativeEngine.executeInitiative(initiative.id);
                executed++;
              } catch (err) {
                log.error({ initiativeId: initiative.id, error: err }, 'Failed to execute initiative');
              }
            } else {
              log.info({ title: initiative.title, reason: canProceed?.reason }, 'Initiative skipped due to budget');

              // Check if this requires approval (high-risk initiative)
              // Note: Initiative doesn't have affectedFiles, use target.filePath count as proxy
              const filesAffected = initiative.target?.filePath ? 1 : 0;
              // Note: Initiative categories don't include 'security' - use false for now
              const touchesSecurity = false;
              const requiresApproval = this.approvalQueue?.requiresApproval(
                0.10, // Estimated cost
                initiative.priority, // Use priority as risk proxy
                filesAffected,
                touchesSecurity,
                approvalThreshold
              );

              // Add to approval queue for later user review
              if (this.approvalQueue && (requiresApproval?.required || !canProceed?.allowed)) {
                await this.approvalQueue.add({
                  id: `init_${initiative.id}_${Date.now()}`,
                  type: 'INITIATIVE',
                  title: initiative.title,
                  description: initiative.description || `Initiative in ${initiative.category}`,
                  risk: initiative.priority >= 80 ? 'HIGH' : initiative.priority >= 60 ? 'MEDIUM' : 'LOW',
                  estimatedCost: 0.10,
                  estimatedTokens,
                  reversible: true,
                  metadata: {
                    initiativeId: initiative.id,
                    category: initiative.category,
                    priority: initiative.priority,
                    reason: canProceed?.reason || requiresApproval?.reason,
                  },
                });
                log.info({ title: initiative.title }, 'Initiative added to approval queue');
              }
            }
          }

          if (executed > 0) {
            this.eventBus.emit('audit:log', {
              action: 'initiatives_executed',
              agent: 'INITIATIVE_ENGINE',
              trustLevel: 'system',
              details: {
                discovered: initiatives.length,
                executed,
                throttleLevel: currentThrottleLevel,
              },
            });
          }

          // Queue user-facing initiatives as deliverables
          const forUser = initiatives.filter(i => i.forUser && !i.autonomous);
          if (forUser.length > 0) {
            this.eventBus.emit('audit:log', {
              action: 'initiatives_for_user',
              agent: 'INITIATIVE_ENGINE',
              trustLevel: 'system',
              details: {
                count: forUser.length,
                initiatives: forUser.map(i => ({ title: i.title, category: i.category })),
              },
            });
          }
        }
      }

      // Periodic cleanup (BACKGROUND task - check budget first)
      if (Math.random() < 0.01) { // ~1% chance each poll
        const canCleanup = this.costTracker?.canProceed(1000, 'BACKGROUND');
        if (canCleanup?.allowed) {
          await this.queue.cleanup(24);
          await this.agentSpawner.cleanupOld(24);
        }
      }

      this.state.lastActivity = new Date().toISOString();
    } catch (error) {
      this.state.errors++;
      log.error({ error }, 'Poll error');

      // Use notification manager for errors
      if (this.state.errors % 10 === 0) {
        await notificationManager.error('Agent Errors', `${this.state.errors} errors accumulated`);
      }
    }

    // Schedule next poll
    this.pollTimer = setTimeout(() => { void this.poll(); }, this.config.pollIntervalMs);
  }

  /**
   * Process the next task in queue
   */
  private async processNextTask(): Promise<void> {
    const task = await this.queue.getNext();
    if (!task) return;

    await this.processTask(task);
  }

  /**
   * Process a single task
   */
  private async processTask(task: Task): Promise<void> {
    log.info({ taskId: task.id }, 'Processing task');

    await this.queue.updateStatus(task.id, 'processing');

    // Log task start to daily audit
    await dailyAudit.logActivity(
      'task_completed',
      `Processing: ${task.content.slice(0, 50)}`,
      task.content,
      { outcome: 'pending' }
    );

    try {
      if (!this.claude) {
        throw new Error('Claude API not configured');
      }

      // Parse the command
      const command = await this.claude.parseCommand(task.content);

      // Check if confirmation is required
      if (command.requiresConfirmation && this.config.security?.requireConfirmation) {
        // For now, auto-confirm queries, require manual confirm for executes
        if (command.type !== 'query' && command.type !== 'status' && command.type !== 'help') {
          // Use notification manager for confirmation request
          await notificationManager.question(
            `Confirm action: ${command.content.slice(0, 200)}`,
            ['Yes, proceed', 'No, cancel']
          );
          // Mark as pending confirmation
          await this.queue.updateStatus(task.id, 'pending', 'Awaiting confirmation');
          return;
        }
      }

      // Process the command
      const response = await this.claude.processCommand(command);

      // Update task
      await this.queue.updateStatus(
        task.id,
        response.success ? 'completed' : 'failed',
        response.message,
        response.success ? undefined : response.message
      );

      // Log to audit
      await dailyAudit.logActivity(
        response.success ? 'task_completed' : 'task_failed',
        task.content.slice(0, 50),
        response.message,
        { outcome: response.success ? 'success' : 'failure' }
      );

      // Record task in session
      dailyAudit.recordSessionTask();

      // Notify completion using notification manager (it will decide if/when to send)
      const summary = await this.claude.summarize(response.message, 400);
      await notificationManager.taskComplete(
        task.content.slice(0, 30),
        response.success,
        summary
      );

      this.state.tasksProcessed++;
      await this.saveState();

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      await this.queue.updateStatus(task.id, 'failed', undefined, errorMsg);

      // Log error to audit
      await dailyAudit.logActivity(
        'error_occurred',
        'Task Processing Error',
        errorMsg,
        { outcome: 'failure', details: { taskId: task.id } }
      );

      // Use notification manager for errors
      await notificationManager.error('Task Failed', errorMsg.slice(0, 200));

      this.state.errors++;
      await this.saveState();
    }
  }

  /**
   * Add a task directly (from API or internal)
   */
  async addTask(
    content: string,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
  ): Promise<Task> {
    return this.queue.add(content, 'api', priority);
  }

  /**
   * Get agent status including budget information
   */
  getStatus(): AgentState & {
    queueStats?: Record<string, number>;
    budget?: {
      throttleLevel: ThrottleLevel;
      usagePercent: number;
      tokensUsed: number;
      tokensRemaining: number;
    };
  } {
    const status: ReturnType<typeof this.getStatus> = { ...this.state };

    // Include budget status if tracker is available
    if (this.costTracker) {
      const throttleStatus = this.costTracker.getThrottleStatus();
      status.budget = {
        throttleLevel: throttleStatus.level,
        usagePercent: throttleStatus.usagePercent,
        tokensUsed: throttleStatus.tokensUsed,
        tokensRemaining: throttleStatus.tokensRemaining,
      };
    }

    return status;
  }

  /**
   * Get the cost tracker instance (for external integrations)
   */
  getCostTracker(): CostTracker | null {
    return this.costTracker;
  }

  /**
   * Get the approval queue instance (for external integrations)
   */
  getApprovalQueue(): ApprovalQueue | null {
    return this.approvalQueue;
  }

  /**
   * Save agent state to disk
   */
  private async saveState(): Promise<void> {
    const dir = path.dirname(STATE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(STATE_PATH, JSON.stringify(this.state, null, 2));
  }

  /**
   * Register handlers for scheduled tasks
   */
  private registerSchedulerHandlers(): void {
    // Morning briefing at 7am
    this.scheduler.registerHandler('morning_briefing', async () => {
      if (this.briefingGenerator) {
        await this.briefingGenerator.morningBriefing();
      }
      log.info('Morning briefing completed');
    });

    // Evening summary at 9pm
    this.scheduler.registerHandler('evening_summary', async () => {
      if (this.briefingGenerator) {
        await this.briefingGenerator.eveningSummary();
      }
      log.info('Evening summary completed');
    });

    // Weekly review on Sunday 6pm
    this.scheduler.registerHandler('weekly_review', async () => {
      if (this.briefingGenerator) {
        await this.briefingGenerator.weeklyReview();
      }
      log.info('Weekly review completed');
    });

    // Knowledge indexing 3x daily
    this.scheduler.registerHandler('knowledge_index', async () => {
      await this.knowledgeIndex.reindexAll();
      log.info('Knowledge index updated');
    });

    // Changelog generation at 7pm
    this.scheduler.registerHandler('changelog_generate', async () => {
      const result = await this.changelogGenerator.generateDaily();
      if (result.savedPath) {
        log.info({ path: result.savedPath }, 'Changelog generated');
      }
    });

    // Agent health check every 15 minutes
    this.scheduler.registerHandler('agent_health_check', async () => {
      await this.agentSpawner.checkAgents();
      const running = this.agentSpawner.getAgentsByStatus('running');
      if (running.length > 0) {
        log.info({ count: running.length }, 'Agents still running');
      }
    });

    // ==========================================================================
    // COGNITIVE LAYER 0: LEARNING LOOP HANDLERS
    // ==========================================================================

    // Daily Performance Review at 9 PM
    // eslint-disable-next-line @typescript-eslint/require-await
    this.scheduler.registerHandler('cognitive_performance_review', async () => {
      try {
        // Stub - learning module removed
        this.eventBus.emit('audit:log', {
          action: 'cognitive:performance_review_skipped',
          agent: 'autonomous',
          trustLevel: 'system',
          details: { reason: 'Learning module removed' },
        });
        return;
      } catch (error) {
        log.error({ error }, 'Cognitive performance review failed');
      }
    });

    // Weekly Gap Analysis on Sunday 8 PM
    // eslint-disable-next-line @typescript-eslint/require-await
    this.scheduler.registerHandler('cognitive_gap_analysis', async () => {
      try {
        // Stub - learning module removed
        this.eventBus.emit('audit:log', {
          action: 'cognitive:gap_analysis_skipped',
          agent: 'autonomous',
          trustLevel: 'system',
          details: { reason: 'Learning module removed' },
        });
        return;
      } catch (error) {
        log.error({ error }, 'Cognitive gap analysis failed');
      }
    });

    // Monthly Self-Assessment on 1st at 9 AM
    // eslint-disable-next-line @typescript-eslint/require-await
    this.scheduler.registerHandler('cognitive_self_assessment', async () => {
      try {
        // Stub - learning module removed
        this.eventBus.emit('audit:log', {
          action: 'cognitive:self_assessment_skipped',
          agent: 'autonomous',
          trustLevel: 'system',
          details: { reason: 'Learning module removed' },
        });
        return;
      } catch (error) {
        log.error({ error }, 'Cognitive self-assessment failed');
      }
    });

    // Daily spaced repetition review at 8 AM
    // eslint-disable-next-line @typescript-eslint/require-await
    this.scheduler.registerHandler('spaced_repetition_review', async () => {
      try {
        // Stub - learning module removed
        return;
      } catch (error) {
        log.error({ error }, 'Spaced repetition review failed');
      }
    });

    // Daily self-improvement review at 9 PM (10 PM UTC)
    this.scheduler.registerHandler('self_improvement_daily', async () => {
      try {
        if (!this.selfImprovementLoop) return;

        const { DecisionJournal } = await import('../cognition/learning/decision-journal.js');

        // Get today's decision journal entries
        const journal = new DecisionJournal();
        await journal.initialize(this.eventBus);
        const recentDecisions = journal.getRecentDecisions(24);

        // Process each decision as an outcome
        let processed = 0;
        for (const decision of recentDecisions) {
          if (decision.outcome && decision.outcome !== 'pending') {
            await this.selfImprovementLoop.processOutcome(
              {
                id: decision.id,
                title: decision.decision,
                description: decision.reasoning || '',
                rationale: decision.reasoning || '',
                category: 'IMPROVEMENTS' as const,
                priority: decision.confidence,
                effort: 'LOW' as const,
                impact: 'MEDIUM' as const,
                autonomous: true,
                forUser: false,
                createdAt: new Date(decision.timestamp),
                status: 'COMPLETED' as const,
              },
              decision.outcome === 'success',
              {
                summary: `Decision: ${decision.decision} - ${decision.outcome}`,
                governanceApproved: true,
              }
            );
            processed++;
          }
        }

        // Emit completion event
        this.eventBus.emit('audit:log', {
          action: 'self_improvement:daily_complete',
          agent: 'SELF_IMPROVEMENT',
          trustLevel: 'system' as const,
          details: {
            decisionsProcessed: processed,
            totalDecisions: recentDecisions.length,
          },
        });

        log.info({ processed, total: recentDecisions.length }, 'Self-improvement daily review complete');
      } catch (error) {
        log.error({ error }, 'Self-improvement daily review failed');
      }
    });

    // ==========================================================================
    // INITIATIVE ENGINE: Proactive work discovery and execution
    // ==========================================================================

    // Comprehensive initiative scan at 6 AM (before morning briefing)
    this.scheduler.registerHandler('initiative_comprehensive_scan', async () => {
      try {
        log.info('Starting comprehensive daily scan');

        const initiatives = await this.initiativeEngine.scan();

        // Execute all autonomous high-priority initiatives
        const autonomous = initiatives.filter(i => i.autonomous && i.priority >= 60);
        let executed = 0;
        for (const initiative of autonomous.slice(0, 5)) { // Max 5 per day
          try {
            await this.initiativeEngine.executeInitiative(initiative.id);
            executed++;
          } catch {
            // Continue with others even if one fails
          }
        }

        // Log summary
        this.eventBus.emit('audit:log', {
          action: 'initiative_daily_scan',
          agent: 'INITIATIVE_ENGINE',
          trustLevel: 'system',
          details: {
            discovered: initiatives.length,
            autonomous: autonomous.length,
            executed,
            forUser: initiatives.filter(i => i.forUser).length,
          },
        });

        log.info({ discovered: initiatives.length, executed }, 'Initiative daily scan complete');
      } catch (error) {
        log.error({ error }, 'Initiative daily scan failed');
      }
    });

    // Generate user deliverables daily brief at 7:30 AM
    this.scheduler.registerHandler('user_daily_brief', async () => {
      try {
        const brief = await generateDailyBrief(process.cwd());
        const formatted = formatDailyBrief(brief);

        // Log the brief
        this.eventBus.emit('audit:log', {
          action: 'daily_brief_generated',
          agent: 'USER_DELIVERABLES',
          trustLevel: 'system',
          details: {
            focusAreas: brief.focusAreas.length,
            actionItems: brief.actionItems.length,
            insights: brief.insights.length,
            opportunities: brief.opportunities.length,
          },
        });

        log.info('Daily brief generated');
        log.info(formatted);

        // If notification is available, send a summary
        if (brief.actionItems.length > 0) {
          const urgent = brief.actionItems.filter(i => i.priority === 'URGENT' || i.priority === 'HIGH');
          if (urgent.length > 0) {
            await notificationManager.insight(
              'Daily Brief',
              `${urgent.length} high-priority item${urgent.length > 1 ? 's' : ''}: ${urgent.map(i => i.title).join(', ')}`
            );
          }
        }
      } catch (error) {
        log.error({ error }, 'Daily brief generation failed');
      }
    });

    // Initiative check-in at 2 PM (mid-day progress check)
    this.scheduler.registerHandler('initiative_midday_check', async () => {
      try {
        const queued = this.initiativeEngine.getInitiativesByStatus('QUEUED');
        const inProgress = this.initiativeEngine.getInitiativesByStatus('IN_PROGRESS');
        const completed = this.initiativeEngine.getInitiativesByStatus('COMPLETED');

        log.info({ queued: queued.length, inProgress: inProgress.length, completed: completed.length }, 'Initiative mid-day status');

        // Execute any high-priority queued items that haven't been started
        const urgent = queued.filter(i => i.autonomous && i.priority >= 80);
        for (const initiative of urgent.slice(0, 2)) {
          try {
            await this.initiativeEngine.executeInitiative(initiative.id);
          } catch {
            // Continue
          }
        }
      } catch (error) {
        log.error({ error }, 'Initiative mid-day check failed');
      }
    });
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<AutonomousConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };

    const dir = path.dirname(CONFIG_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(this.config, null, 2));

    // Reinitialize if running
    if (this.running) {
      await this.stop();
      await this.start();
    }
  }
}
