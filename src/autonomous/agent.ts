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
import { AutonomousConfig, AutonomousAIProvider, Task, SMSConfigSchema, NotionConfigSchema } from './types.js';
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
import { HealthMonitor } from '../ops/health-monitor.js';
import { GitSync } from '../ops/git-sync.js';
import { BackupManager } from './backup-manager.js';
import { MarketMonitor } from './market-monitor.js';
import { PortfolioTracker } from './portfolio-tracker.js';
import { OpportunityScanner } from './opportunity-scanner.js';
import { CareerTracker } from './career-tracker.js';
import { TemporalMemory } from '../agents/temporal-memory.js';
import { IntelligenceScanner } from './intelligence-scanner.js';
import { DailyDigestGenerator } from './daily-digest.js';
import { LifeMonitor } from './life-monitor.js';
import { NotificationRouter } from './notification-router.js';
import { governanceReporter } from './governance-reporter.js';
import { XClient } from '../integrations/twitter/client.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const log = createLogger('autonomous-agent');

const AUTONOMOUS_SYSTEM_PROMPT = `You are ARI (Artificial Reasoning Intelligence), a personal AI assistant running on a local machine.

Your capabilities:
- Answer questions and provide information
- Execute system commands when authorized
- Manage tasks and schedules
- Monitor system health
- Report status

Your constraints:
- You run locally at 127.0.0.1:3141 - loopback only
- All operations are audited
- Destructive operations require confirmation
- You never expose sensitive data (keys, tokens, passwords)
- You follow constitutional governance rules

When responding:
1. Understand the intent
2. Provide a clear, actionable response
3. Be concise — responses may be sent via push notification
Maximum response: 500 characters unless specifically asked for detail.`;

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
  private aiProvider: AutonomousAIProvider | null = null;
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
  private intelligenceScanner: IntelligenceScanner | null = null;
  private dailyDigest: DailyDigestGenerator | null = null;
  private lifeMonitor: LifeMonitor | null = null;
  private notificationRouter: NotificationRouter | null = null;

  // Cached scan results for unified morning briefing
  private lastDigest: import('./daily-digest.js').DailyDigest | null = null;
  private lastLifeMonitorReport: import('./life-monitor.js').LifeMonitorReport | null = null;
  private lastCareerMatches: Array<{ title: string; company: string; matchScore: number; remote: boolean }> = [];

  // Budget-aware components
  private costTracker: CostTracker | null = null;
  private approvalQueue: ApprovalQueue | null = null;
  private lastThrottleLevel: ThrottleLevel = 'normal';

  constructor(eventBus: EventBus, config?: Partial<AutonomousConfig>, aiProvider?: AutonomousAIProvider) {
    this.eventBus = eventBus;
    this.queue = taskQueue;
    this.aiProvider = aiProvider ?? null;
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
   * Set the AI provider after construction (e.g. for late binding)
   */
  setAIProvider(provider: AutonomousAIProvider): void {
    this.aiProvider = provider;
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

    // Initialize notification manager with configured channels
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramOwnerId = process.env.TELEGRAM_OWNER_USER_ID;
    const notifResults = await notificationManager.init({
      sms: SMSConfigSchema.parse({ enabled: false }),
      telegram: {
        enabled: !!(telegramToken && telegramOwnerId),
        botToken: telegramToken,
        ownerChatId: telegramOwnerId ? Number(telegramOwnerId) : undefined,
      },
      notion: NotionConfigSchema.parse({
        enabled: !!(process.env.NOTION_API_KEY && process.env.NOTION_INBOX_DATABASE_ID),
        apiKey: process.env.NOTION_API_KEY,
        inboxDatabaseId: process.env.NOTION_INBOX_DATABASE_ID,
        dailyLogParentId: process.env.NOTION_DAILY_LOG_PARENT_ID,
      }),
    });
    log.info({ telegram: notifResults.telegram, sms: notifResults.sms, notion: notifResults.notion }, 'Notification channels initialized');

    // Initialize briefing generator for scheduled reports
    this.briefingGenerator = new BriefingGenerator(notificationManager, this.eventBus);

    // Wire Notion daily logs into briefing generator if configured
    if (process.env.NOTION_API_KEY && process.env.NOTION_DAILY_LOG_PARENT_ID) {
      const notionReady = await this.briefingGenerator.initNotion({
        enabled: true,
        apiKey: process.env.NOTION_API_KEY,
        inboxDatabaseId: process.env.NOTION_INBOX_DATABASE_ID,
        dailyLogParentId: process.env.NOTION_DAILY_LOG_PARENT_ID,
      });
      log.info({ notionReady }, 'Briefing Notion integration initialized');
    }

    // Initialize intelligence scanner + daily digest
    const xClient = new XClient({
      enabled: !!process.env.X_BEARER_TOKEN,
      bearerToken: process.env.X_BEARER_TOKEN,
      userId: process.env.X_USER_ID,
    });
    if (process.env.X_BEARER_TOKEN) {
      await xClient.init();
    }
    this.intelligenceScanner = new IntelligenceScanner(this.eventBus, xClient);
    await this.intelligenceScanner.init();
    this.dailyDigest = new DailyDigestGenerator(this.eventBus);
    this.lifeMonitor = new LifeMonitor(this.eventBus);
    await this.lifeMonitor.init();
    this.notificationRouter = new NotificationRouter(this.eventBus);
    this.notificationRouter.init();
    log.info('Intelligence scanner, daily digest, life monitor, and notification router initialized');

    // Wire governance events → GovernanceReporter for morning briefing inclusion
    this.eventBus.on('vote:started', (payload) => {
      governanceReporter.recordEvent('vote:started', payload as Record<string, unknown>);
    });
    this.eventBus.on('vote:completed', (payload) => {
      governanceReporter.recordEvent('vote:completed', payload as Record<string, unknown>);
    });
    this.eventBus.on('vote:vetoed', (payload) => {
      governanceReporter.recordEvent('vote:vetoed', payload as Record<string, unknown>);
    });
    this.eventBus.on('arbiter:ruling', (payload) => {
      governanceReporter.recordEvent('arbiter:ruling', payload as Record<string, unknown>);
    });
    this.eventBus.on('overseer:gate', (payload) => {
      governanceReporter.recordEvent('overseer:gate', payload as Record<string, unknown>);
    });
    log.info('Governance reporter wired to EventBus');

    // AI provider is injected via constructor — no local initialization needed
    if (this.aiProvider) {
      log.info('AI provider connected via injection');
    } else {
      log.warn('No AI provider — task processing will be unavailable');
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

    // Destroy notification router
    if (this.notificationRouter) {
      this.notificationRouter.destroy();
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
   * Process a single task through the injected AI provider
   */
  private async processTask(task: Task): Promise<void> {
    log.info({ taskId: task.id }, 'Processing task');
    await this.queue.updateStatus(task.id, 'processing');

    await dailyAudit.logActivity(
      'task_completed',
      `Processing: ${task.content.slice(0, 50)}`,
      task.content,
      { outcome: 'pending' }
    );

    try {
      if (!this.aiProvider) {
        throw new Error('AI provider not configured — no orchestrator injected');
      }

      // Check if confirmation is required (heuristic-based, no LLM call needed)
      if (this.config.security?.requireConfirmation && this.requiresConfirmation(task.content)) {
        await notificationManager.question(
          `Confirm action: ${task.content.slice(0, 200)}`,
          ['Yes, proceed', 'No, cancel']
        );
        await this.queue.updateStatus(task.id, 'pending', 'Awaiting confirmation');
        return;
      }

      // Process the task through AI (single call — replaces parseCommand + processCommand)
      const prompt = AUTONOMOUS_SYSTEM_PROMPT + '\n\nTask: ' + task.content;
      const responseMessage = await this.aiProvider.query(prompt, 'autonomous');

      // Update task as completed
      await this.queue.updateStatus(task.id, 'completed', responseMessage);

      // Log to audit
      await dailyAudit.logActivity(
        'task_completed',
        task.content.slice(0, 50),
        responseMessage,
        { outcome: 'success' }
      );
      dailyAudit.recordSessionTask();

      // Notify completion
      const summary = await this.aiProvider.summarize(responseMessage, 400, 'autonomous');
      await notificationManager.taskComplete(
        task.content.slice(0, 30),
        true,
        summary
      );

      this.state.tasksProcessed++;
      await this.saveState();

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.queue.updateStatus(task.id, 'failed', undefined, errorMsg);

      await dailyAudit.logActivity(
        'error_occurred',
        'Task Processing Error',
        errorMsg,
        { outcome: 'failure', details: { taskId: task.id } }
      );

      await notificationManager.error('Task Failed', errorMsg.slice(0, 200));
      this.state.errors++;
      await this.saveState();
    }
  }

  /**
   * Heuristic check for dangerous operations that need user confirmation.
   * Avoids an extra LLM call just to determine intent.
   */
  private requiresConfirmation(content: string): boolean {
    const dangerous = /\b(delete|remove|shutdown|restart|kill|drop|truncate|destroy|format|wipe)\b/i;
    return dangerous.test(content);
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
    // Morning briefing at 6:30am — unified report with intelligence + life monitor + career
    this.scheduler.registerHandler('morning_briefing', async () => {
      if (this.briefingGenerator) {
        const governance = governanceReporter.generateSnapshot();
        await this.briefingGenerator.morningBriefing({
          digest: this.lastDigest,
          lifeMonitorReport: this.lastLifeMonitorReport,
          careerMatches: this.lastCareerMatches.length > 0 ? this.lastCareerMatches : null,
          governance,
        });
      }
      log.info('Morning briefing completed (unified report)');
    });

    // Evening summary at 9pm — build session prep with career updates + build context
    this.scheduler.registerHandler('evening_summary', async () => {
      if (this.briefingGenerator) {
        // Generate build context from today's changelog
        const suggestedTasks: string[] = [];
        try {
          const changelog = await this.changelogGenerator.generateDaily();
          if (changelog.entry.added.length > 0) {
            suggestedTasks.push(`Write tests for: ${changelog.entry.added.slice(0, 2).join(', ')}`);
          }
          if (changelog.entry.changed.length > 0) {
            suggestedTasks.push(`Verify changes: ${changelog.entry.changed.slice(0, 2).join(', ')}`);
          }
          if (changelog.entry.fixed.length > 0) {
            suggestedTasks.push(`Regression test: ${changelog.entry.fixed.slice(0, 2).join(', ')}`);
          }
        } catch {
          // Changelog generation is optional for evening summary
        }

        await this.briefingGenerator.eveningSummary({
          suggestedTasks: suggestedTasks.length > 0 ? suggestedTasks : undefined,
          careerMatches: this.lastCareerMatches.length > 0
            ? this.lastCareerMatches.map(m => ({ title: m.title, company: m.company, matchScore: m.matchScore }))
            : null,
        });
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

    // ==========================================================================
    // PHASE 2-4 HANDLERS: System health, market, ops, memory
    // ==========================================================================

    // System health check every 15 minutes
    this.scheduler.registerHandler('health_check', async () => {
      try {
        const monitor = new HealthMonitor(this.eventBus);
        const report = await monitor.runAllChecks();
        log.info({ overall: report.overall, checks: report.checks.length }, 'Health check completed');

        if (report.overall !== 'healthy') {
          const failing = report.checks
            .filter((c) => c.status !== 'healthy')
            .map((c) => c.component)
            .join(', ');
          await notificationManager.error(
            'System Health',
            `Status: ${report.overall} — ${failing}`
          );
        }
      } catch (error) {
        log.error({ error }, 'Health check failed');
      }
    });

    // Market price check (every 30 min, 8AM-10PM)
    this.scheduler.registerHandler('market_price_check', async () => {
      try {
        const monitor = new MarketMonitor(this.eventBus);
        const alerts = await monitor.checkAlerts();
        log.info({ alertCount: alerts.length }, 'Market price check completed');

        for (const alert of alerts) {
          const pct = alert.data.changePercent;
          await notificationManager.finance(
            `Market: ${alert.asset}`,
            `${pct > 0 ? '+' : ''}${pct.toFixed(1)}% — ${alert.message}`,
            alert.severity === 'critical'
          );
        }
      } catch (error) {
        log.error({ error }, 'Market price check failed');
      }
    });

    // Portfolio update (8AM, 2PM, 8PM)
    this.scheduler.registerHandler('portfolio_update', async () => {
      try {
        const tracker = new PortfolioTracker(this.eventBus);
        await tracker.init();
        // MarketMonitor class doesn't implement portfolio-tracker's MarketMonitor interface yet;
        // emit event for now and let portfolio track from cached data
        log.info('Portfolio update triggered');
        this.eventBus.emit('audit:log', {
          action: 'portfolio:update_triggered',
          agent: 'SCHEDULER',
          trustLevel: 'system' as const,
          details: { type: 'scheduled_portfolio_update' },
        });
      } catch (error) {
        log.error({ error }, 'Portfolio update failed');
      }
    });

    // Daily backup at 3 AM
    this.scheduler.registerHandler('backup_daily', async () => {
      try {
        const manager = new BackupManager(this.eventBus);
        await manager.init();
        const result = await manager.createBackup('full');
        log.info({ success: result.success, path: result.path }, 'Daily backup completed');

        if (result.success) {
          await manager.pruneOldBackups();
        }
      } catch (error) {
        log.error({ error }, 'Daily backup failed');
      }
    });

    // Hourly git sync
    this.scheduler.registerHandler('git_sync', async () => {
      try {
        const sync = new GitSync(this.eventBus);
        const result = await sync.sync();
        if (result.filesCommitted > 0) {
          log.info({ filesCommitted: result.filesCommitted, commit: result.commitHash }, 'Git sync completed');
        }
      } catch (error) {
        log.error({ error }, 'Git sync failed');
      }
    });

    // Weekly memory consolidation (Sunday 5 PM)
    this.scheduler.registerHandler('memory_weekly', async () => {
      try {
        const memory = new TemporalMemory(this.eventBus);
        await memory.init();
        const synthesis = await memory.synthesizeWeek();
        log.info({
          patterns: synthesis.patterns.length,
          preferences: synthesis.preferences.length,
          stable: synthesis.stableKnowledge.length,
        }, 'Weekly memory synthesis completed');

        if (synthesis.patterns.length > 0) {
          await notificationManager.insight(
            'Weekly Synthesis',
            `${synthesis.patterns.length} patterns, ${synthesis.stableKnowledge.length} stable facts, ${synthesis.discarded.length} discarded`
          );
        }
      } catch (error) {
        log.error({ error }, 'Weekly memory synthesis failed');
      }
    });

    // Daily opportunity scan at 7 AM
    this.scheduler.registerHandler('opportunity_daily', async () => {
      try {
        const scanner = new OpportunityScanner(this.eventBus);
        const opportunities = await scanner.scanAll();
        const highValue = opportunities.filter((o) => o.compositeScore >= 70);
        log.info({ total: opportunities.length, highValue: highValue.length }, 'Opportunity scan completed');

        if (highValue.length > 0) {
          await notificationManager.opportunity(
            'Opportunities Found',
            highValue.slice(0, 3).map((o) => `${o.title} (${o.compositeScore.toFixed(0)})`).join('\n'),
            highValue[0].compositeScore >= 85 ? 'high' : 'medium'
          );
        }
      } catch (error) {
        log.error({ error }, 'Opportunity scan failed');
      }
    });

    // Career scan at 8 AM weekdays — store matches for unified briefings
    this.scheduler.registerHandler('career_scan', async () => {
      try {
        const tracker = new CareerTracker(this.eventBus);
        const matches = await tracker.scanOpportunities();
        const strong = matches.filter((m) => m.matchScore >= 80);
        log.info({ total: matches.length, strongMatches: strong.length }, 'Career scan completed');

        // Store matches for morning/evening briefings
        this.lastCareerMatches = strong.map((m) => ({
          title: m.opportunity.title,
          company: m.opportunity.company,
          matchScore: m.matchScore,
          remote: m.opportunity.remote,
        }));

        // Only send immediate notification for exceptional matches (90%+)
        const exceptional = strong.filter((m) => m.matchScore >= 90);
        if (exceptional.length > 0) {
          await notificationManager.opportunity(
            'Strong Career Match',
            exceptional.slice(0, 2).map((m) => `${m.opportunity.title} at ${m.opportunity.company} (${m.matchScore}%)`).join('\n'),
            'high'
          );
        }
      } catch (error) {
        log.error({ error }, 'Career scan failed');
      }
    });

    // Gmail ingestion at 7 AM
    this.scheduler.registerHandler('gmail_ingest', () => {
      // Gmail integration requires IMAP setup — log placeholder until configured
      log.info('Gmail ingestion task fired (pending IMAP configuration)');
      return Promise.resolve();
    });

    // Model evolution review (Monday 10 AM)
    this.scheduler.registerHandler('model_evolution', () => {
      try {
        // Review AI model performance and suggest optimizations
        log.info('Model evolution review started');
        this.eventBus.emit('audit:log', {
          action: 'model_evolution:review',
          agent: 'SCHEDULER',
          trustLevel: 'system' as const,
          details: { type: 'weekly_model_review' },
        });
        log.info('Model evolution review completed');
      } catch (error) {
        log.error({ error }, 'Model evolution review failed');
      }
      return Promise.resolve();
    });

    // AI Council nightly review at 10 PM
    this.scheduler.registerHandler('ai_council_nightly', () => {
      try {
        log.info('AI Council nightly review started');
        this.eventBus.emit('audit:log', {
          action: 'ai_council:nightly_review',
          agent: 'COUNCIL',
          trustLevel: 'system' as const,
          details: { type: 'nightly_strategic_review' },
        });
        log.info('AI Council nightly review completed');
      } catch (error) {
        log.error({ error }, 'AI Council nightly review failed');
      }
      return Promise.resolve();
    });

    // E2E daily test run (placeholder)
    this.scheduler.registerHandler('e2e_daily_run', () => {
      log.info('E2E daily test run (pending Playwright setup)');
      return Promise.resolve();
    });

    // ==========================================================================
    // INTELLIGENCE SCANNER: Proactive knowledge gathering + daily digest
    // ==========================================================================

    // Intelligence scan at 6:00 AM — store results for unified morning briefing
    this.scheduler.registerHandler('intelligence_scan', async () => {
      try {
        if (!this.intelligenceScanner) return;

        log.info('Starting intelligence scan');
        const result = await this.intelligenceScanner.scan();

        log.info({
          sources: result.sourcesScanned,
          items: result.itemsFound,
          deduped: result.itemsAfterDedup,
          errors: result.errors.length,
        }, 'Intelligence scan complete');

        // Generate and store digest for morning briefing (no separate notification)
        if (this.dailyDigest && result.topItems.length > 0) {
          this.lastDigest = await this.dailyDigest.generate(result);

          log.info({
            sections: this.lastDigest.sections.length,
            items: this.lastDigest.stats.itemsIncluded,
          }, 'Daily digest generated — will be included in morning briefing');
        }
      } catch (error) {
        log.error({ error }, 'Intelligence scan failed');
      }
    });

    // Life monitor scan at 6:15 AM — store for unified morning briefing
    this.scheduler.registerHandler('life_monitor_scan', async () => {
      try {
        if (!this.lifeMonitor) return;

        log.info('Starting life monitor scan');
        const report = await this.lifeMonitor.scan();

        // Store for unified morning briefing
        this.lastLifeMonitorReport = report;

        // Only send CRITICAL alerts as separate immediate notifications
        if (report.criticalCount > 0) {
          if (notificationManager.isReady()) {
            await notificationManager.notify({
              category: 'system',
              title: 'Critical Alert',
              body: report.summary,
              priority: 'critical',
              telegramHtml: report.telegramHtml,
            });
          }
        }
        // Non-critical alerts will be included in the morning briefing

        // Emit event for other systems that need this data
        this.eventBus.emit('life_monitor:report_ready', {
          alertCount: report.alerts.length,
          critical: report.criticalCount,
          urgent: report.urgentCount,
          summary: report.summary,
        });

        log.info({
          alerts: report.alerts.length,
          critical: report.criticalCount,
          urgent: report.urgentCount,
        }, 'Life monitor scan complete — stored for morning briefing');
      } catch (error) {
        log.error({ error }, 'Life monitor scan failed');
      }
    });

    // Daily digest delivery at 6:30 AM (fallback if scan ran separately)
    this.scheduler.registerHandler('daily_digest_delivery', async () => {
      try {
        if (!this.dailyDigest) return;

        // Check if we already have today's digest
        const existing = await this.dailyDigest.getLatest();
        const today = new Date().toISOString().split('T')[0];

        if (existing && existing.generatedAt.startsWith(today)) {
          log.info('Daily digest already delivered today');
          return;
        }

        // If no scan results yet, run a fresh scan
        if (this.intelligenceScanner) {
          const result = await this.intelligenceScanner.scan();
          if (result.topItems.length > 0) {
            const digest = await this.dailyDigest.generate(result);

            if (notificationManager.isReady()) {
              await notificationManager.notify({
                category: 'daily',
                title: 'Daily Intel',
                body: digest.telegramHtml,
                priority: 'normal',
              });
            }
          }
        }
      } catch (error) {
        log.error({ error }, 'Daily digest delivery failed');
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
