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
import type { ContentEnginePlugin } from '../plugins/content-engine/index.js';
import { DocumentIngestor } from '../system/document-ingestor.js';
import { VectorStore } from '../system/vector-store.js';
import { EmbeddingService } from '../ai/embedding-service.js';
import { IngestionPipeline } from './ingestion-pipeline.js';
import { RAGQueryEngine } from './rag-query.js';
import { NotionTaskMonitor } from '../integrations/notion/task-monitor.js';
import { LaneQueue } from './lane-queue.js';
import { AutonomyDial } from './autonomy-dial.js';
import { NotificationPipeline } from './notification-pipeline.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const log = createLogger('autonomous-agent');

const FALLBACK_SYSTEM_PROMPT = `You are ARI (Artificial Reasoning Intelligence), a personal AI assistant running on a local machine.

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
  private marketMonitor: MarketMonitor | null = null;
  private portfolioTracker: PortfolioTracker | null = null;
  private contentEngine: ContentEnginePlugin | null = null;
  private documentIngestor: DocumentIngestor | null = null;

  // RAG pipeline components (Phase 4)
  private vectorStore: VectorStore | null = null;
  private embeddingService: EmbeddingService | null = null;
  private ingestionPipeline: IngestionPipeline | null = null;
  private ragQueryEngine: RAGQueryEngine | null = null;

  // Notion task monitor (Phase 5)
  private notionTaskMonitor: NotionTaskMonitor | null = null;

  // Phase 9: Durable lane queue + autonomy dial
  private laneQueue: LaneQueue | null = null;
  private autonomyDial: AutonomyDial | null = null;

  // Phase 11: Soul evolution + notification lifecycle
  private notificationPipeline: NotificationPipeline | null = null;

  // Cached scan results for unified morning briefing
  private lastDigest: import('./daily-digest.js').DailyDigest | null = null;
  private lastLifeMonitorReport: import('./life-monitor.js').LifeMonitorReport | null = null;
  private lastCareerMatches: Array<{ title: string; company: string; matchScore: number; remote: boolean }> = [];
  private lastPortfolio: import('./briefings.js').BriefingPortfolio | null = null;
  private lastMarketAlerts: Array<{ asset: string; change: string; severity: string }> = [];

  // Cached data from orphan handlers (for morning briefing)
  private lastCalendarEvents: Array<{ title: string; startDate: Date; endDate: Date; location?: string; isAllDay: boolean }> = [];
  private lastPendingReminders: Array<{ name: string; dueDate?: Date; priority: number; list: string }> = [];
  private lastWeather: { location: string; tempF: number; condition: string; feelsLikeF: number; humidity: number; forecast?: Array<{ date: string; maxTempF: number; minTempF: number; condition: string; chanceOfRain: number }> } | null = null;
  private lastTechNews: Array<{ title: string; url?: string; score?: number; source: string }> = [];

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

    // Phase 9: Durable lane queue (rehydrates from ~/.ari/queue/pending.jsonl)
    this.laneQueue = new LaneQueue(eventBus);
    // Phase 9: Autonomy dial (persists per-category levels to ~/.ari/autonomy.json)
    this.autonomyDial = new AutonomyDial(undefined, eventBus);
    // Phase 11: Unified notification pipeline
    this.notificationPipeline = new NotificationPipeline(eventBus);

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

    // Initialize document ingestor for RAG pipeline
    const ingestorDataDir = path.join(process.env.HOME || '~', '.ari', 'knowledge', 'ingested');
    this.documentIngestor = new DocumentIngestor(ingestorDataDir);
    await this.documentIngestor.init();
    log.info({ dataDir: ingestorDataDir }, 'Document ingestor initialized');

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

    // ═══════════════════════════════════════════════════════════════════════
    // Phase 4: Three-Tier Memory + RAG Pipeline
    // Hot  → ConversationContext (in-process, 10 turns — handled by Telegram ConversationStore)
    // Warm → ConversationStore (SQLite, 7-day TTL — Phase 0)
    // Cold → VectorStore (SQLite, semantic search via cosine similarity)
    // ═══════════════════════════════════════════════════════════════════════
    try {
      const vectorDbPath = path.join(process.env.HOME || '~', '.ari', 'data', 'vectors.db');
      this.vectorStore = new VectorStore(vectorDbPath, this.eventBus);
      await this.vectorStore.init();

      this.embeddingService = new EmbeddingService(this.eventBus);

      // Adapter: system VectorStore → IngestionPipeline VectorStore interface
      const vs = this.vectorStore;
      const ingestionVectorAdapter = {
        add: async (chunks: Array<{ id: string; content: string; embedding?: Float32Array; hash: string; chunkIndex?: number; totalChunks?: number; metadata: Record<string, unknown> }>) => {
          for (const chunk of chunks) {
            if (chunk.embedding) {
              await vs.upsert({
                content: chunk.content,
                embedding: chunk.embedding,
                source: typeof chunk.metadata.source === 'string' ? chunk.metadata.source : 'ingestion',
                sourceType: (chunk.metadata.sourceType as 'article' | 'tweet' | 'bookmark' | 'conversation' | 'email' | 'file') ?? 'file',
                title: chunk.metadata.title as string | undefined,
                domain: chunk.metadata.domain as string | undefined,
                tags: (chunk.metadata.tags as string[]) ?? [],
                metadata: chunk.metadata,
                chunkIndex: chunk.chunkIndex ?? 0,
                chunkTotal: chunk.totalChunks ?? 1,
              });
            }
          }
        },
        search: async (embedding: Float32Array, limit = 10) => {
          const results = await vs.search(embedding, { limit });
          return results.map(r => ({
            id: r.document.id,
            documentId: r.document.parentDocId ?? r.document.id,
            content: r.document.content,
            chunkIndex: r.document.chunkIndex,
            totalChunks: r.document.chunkTotal,
            embedding: r.document.embedding,
            hash: r.document.contentHash,
            metadata: r.document.metadata,
          }));
        },
        delete: async (documentId: string) => { await vs.delete(documentId); },
        exists: async (hash: string) => !!(await vs.getByHash(hash)),
      };

      this.ingestionPipeline = new IngestionPipeline(
        this.eventBus,
        ingestionVectorAdapter as unknown as import('./ingestion-pipeline.js').VectorStore,
        this.embeddingService,
      );

      // RAGQueryEngine needs AIOrchestrator for answer generation
      const { AIOrchestrator } = await import('../ai/orchestrator.js');
      const ragOrchestrator = new AIOrchestrator(this.eventBus, {
        costTracker: this.costTracker ?? undefined,
      });

      // Adapter: system VectorStore → RAGVectorStore interface
      const ragVectorAdapter = {
        search: async (embedding: Float32Array, options?: { limit?: number; minScore?: number; domain?: string }) => {
          const results = await vs.search(embedding, options);
          return results.map(r => ({
            document: {
              id: r.document.id,
              content: r.document.content,
              title: r.document.title,
              metadata: r.document.metadata,
            },
            score: r.score,
          }));
        },
        getById: async (id: string) => {
          const doc = await vs.getById(id);
          if (!doc) return null;
          return {
            id: doc.id,
            content: doc.content,
            title: doc.title,
            metadata: doc.metadata,
          };
        },
      };

      this.ragQueryEngine = new RAGQueryEngine(
        this.eventBus,
        ragVectorAdapter,
        this.embeddingService,
        ragOrchestrator,
      );

      // Index workspace files on init (identity context for RAG)
      await this.indexWorkspaceFiles();

      const stats = this.vectorStore.getStats();
      log.info({
        totalDocuments: stats.totalDocuments,
        totalChunks: stats.totalChunks,
      }, 'RAG pipeline initialized (VectorStore + EmbeddingService + IngestionPipeline + RAGQueryEngine)');
    } catch (error) {
      log.warn({ error: error instanceof Error ? error.message : String(error) }, 'RAG pipeline init failed (non-critical — needs OPENAI_API_KEY for embeddings)');
    }

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
        tasksDbId: process.env.NOTION_TASKS_DATABASE_ID,
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

    // Phase 5: Notion Task Monitor (bidirectional sync — polls every 5 min)
    if (process.env.NOTION_API_KEY && process.env.NOTION_TASKS_DATABASE_ID) {
      try {
        this.notionTaskMonitor = new NotionTaskMonitor(this.eventBus, {
          apiKey: process.env.NOTION_API_KEY,
          tasksDatabaseId: process.env.NOTION_TASKS_DATABASE_ID,
        });
        await this.notionTaskMonitor.start();
        log.info('Notion task monitor started (5-min bidirectional sync)');
      } catch (error) {
        log.warn({ error: error instanceof Error ? error.message : String(error) }, 'Notion task monitor failed to start (non-critical)');
      }
    }

    // Initialize intelligence scanner + daily digest
    const xClient = new XClient({
      enabled: !!process.env.X_BEARER_TOKEN,
      bearerToken: process.env.X_BEARER_TOKEN,
      userId: process.env.X_USER_ID,
      apiKey: process.env.X_API_KEY,
      apiSecret: process.env.X_API_SECRET,
      accessToken: process.env.X_ACCESS_TOKEN,
      accessSecret: process.env.X_ACCESS_SECRET,
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

    // Initialize market monitor with Pryce's watchlist
    this.marketMonitor = new MarketMonitor(this.eventBus, {
      alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY,
      cryptoApiKey: process.env.COINGECKO_API_KEY,
    });
    // Bootstrap watchlist with tracked assets
    const watchlistAssets: Array<{ asset: string; assetClass: string }> = [
      // Crypto
      { asset: 'bitcoin', assetClass: 'crypto' },
      { asset: 'ethereum', assetClass: 'crypto' },
      { asset: 'solana', assetClass: 'crypto' },
      // Stocks
      { asset: 'AAPL', assetClass: 'stock' },
      { asset: 'NVDA', assetClass: 'stock' },
      { asset: 'TSLA', assetClass: 'stock' },
      // ETFs
      { asset: 'VOO', assetClass: 'etf' },
      { asset: 'QQQ', assetClass: 'etf' },
    ];
    for (const { asset, assetClass } of watchlistAssets) {
      this.marketMonitor.addToWatchlist(asset, assetClass);
    }
    log.info({ watchlistSize: watchlistAssets.length }, 'Market monitor initialized with watchlist');

    // Phase 6: Wire Perplexity "why?" queries into market monitor
    if (process.env.PERPLEXITY_API_KEY) {
      try {
        const { PerplexityClient } = await import('../integrations/perplexity/client.js');
        const perplexityClient = new PerplexityClient(process.env.PERPLEXITY_API_KEY);
        this.marketMonitor.setPerplexityClient(perplexityClient);
        log.info('Perplexity wired into market monitor for anomaly why-queries');
      } catch (error) {
        log.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to wire Perplexity to market monitor');
      }
    }

    // Phase 6: Wire EarningsCalendar for pre-earnings volatility warnings
    if (process.env.ALPHA_VANTAGE_API_KEY) {
      try {
        const { EarningsCalendar } = await import('../integrations/alpha-vantage/earnings-calendar.js');
        const earningsCalendar = new EarningsCalendar(process.env.ALPHA_VANTAGE_API_KEY);
        this.marketMonitor.setEarningsCalendar(earningsCalendar);
        log.info('Earnings calendar wired into market monitor (3-day look-ahead)');
      } catch (error) {
        log.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to wire earnings calendar');
      }
    }

    // Initialize portfolio tracker
    this.portfolioTracker = new PortfolioTracker(this.eventBus);
    await this.portfolioTracker.init();
    log.info('Portfolio tracker initialized');

    // Initialize content engine plugin with real orchestrator
    try {
      const { ContentEnginePlugin } = await import('../plugins/content-engine/index.js');
      const { AIOrchestrator } = await import('../ai/orchestrator.js');
      this.contentEngine = new ContentEnginePlugin();
      const ceDataDir = path.join(process.env.HOME || '~', '.ari', 'plugins', 'content-engine', 'data');
      const contentOrchestrator = new AIOrchestrator(this.eventBus, {
        costTracker: this.costTracker ?? undefined,
      });
      await this.contentEngine.initialize({
        eventBus: this.eventBus,
        orchestrator: contentOrchestrator,
        config: {},
        dataDir: ceDataDir,
        costTracker: this.costTracker,
      });
      // Wire publisher if X client is available
      if (xClient.isReady()) {
        this.contentEngine.initPublisher(xClient);
      }
      log.info('Content engine plugin initialized');
    } catch (error) {
      log.warn({ error: error instanceof Error ? error.message : String(error) }, 'Content engine init failed (non-critical)');
    }

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
   * Get the underlying scheduler (for API route deps wiring)
   */
  getScheduler(): import('../autonomous/scheduler.js').Scheduler {
    return this.scheduler;
  }

  getLaneQueue(): LaneQueue | null {
    return this.laneQueue;
  }

  getAutonomyDial(): AutonomyDial | null {
    return this.autonomyDial;
  }

  getNotificationPipeline(): NotificationPipeline | null {
    return this.notificationPipeline;
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

    // Rehydrate lane queue from disk (Phase 9)
    if (this.laneQueue) {
      this.laneQueue.rehydrate();
    }

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

    // Stop Notion task monitor
    if (this.notionTaskMonitor) {
      this.notionTaskMonitor.stop();
    }

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
      const prompt = await this.getAutonomousPrompt('Task: ' + task.content);
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
   * Build the system prompt, loading identity from workspace files when available.
   * Falls back to FALLBACK_SYSTEM_PROMPT if workspace files are absent or unreadable.
   */
  private async getAutonomousPrompt(taskSuffix?: string): Promise<string> {
    try {
      const { loadIdentityPrompt } = await import('../system/workspace-loader.js');
      const identity = await loadIdentityPrompt();
      if (identity && identity.length > 100) {
        const base = identity;
        return taskSuffix ? `${base}\n\n## Current Task\n${taskSuffix}` : base;
      }
    } catch (error) {
      log.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to load workspace identity, using fallback');
    }
    const base = FALLBACK_SYSTEM_PROMPT;
    return taskSuffix ? `${base}\n\n## Current Task\n${taskSuffix}` : base;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RAG PIPELINE HELPERS (Phase 4)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Index all workspace files (SOUL, IDENTITY, USER, etc.) into VectorStore
   * so RAG can retrieve ARI's identity context when answering questions.
   */
  private async indexWorkspaceFiles(): Promise<void> {
    if (!this.ingestionPipeline) return;

    const workspaceDir = path.join(process.env.HOME || '~', '.ari', 'workspace');
    const files = [
      'SOUL.md', 'IDENTITY.md', 'USER.md', 'GOALS.md',
      'PREFERENCES.md', 'AGENTS.md', 'HEARTBEAT.md', 'MEMORY.md', 'TOOLS.md',
    ];

    let indexed = 0;
    for (const file of files) {
      try {
        const filePath = path.join(workspaceDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        if (content.length > 50) {
          await this.ingestionPipeline.ingest(content, {
            source: `workspace/${file}`,
            sourceType: 'file',
            title: file.replace('.md', ''),
            domain: 'identity',
            tags: ['workspace', 'identity', file.toLowerCase().replace('.md', '')],
          });
          indexed++;
        }
      } catch {
        // File doesn't exist — skip
      }
    }
    if (indexed > 0) {
      log.info({ indexed, total: files.length }, 'Workspace files indexed into VectorStore');
    }
  }

  /**
   * Periodic RAG index refresh: re-index workspace files + ingest recent briefings.
   * Called by scheduler 4x daily (2, 8, 14, 20 hours).
   */
  private async refreshRAGIndex(): Promise<void> {
    if (!this.ingestionPipeline) return;

    await this.indexWorkspaceFiles();
    log.info('RAG index refreshed');
  }

  /**
   * Query the RAG knowledge base. Returns answer + sources or null if RAG is unavailable.
   * Used by Telegram handlers to augment AI responses with retrieved context.
   */
  async queryRAG(question: string, options?: {
    maxDocuments?: number;
    minScore?: number;
    domain?: string;
  }): Promise<{ answer: string; sources: Array<{ title?: string; snippet: string; score: number }> } | null> {
    if (!this.ragQueryEngine) return null;

    try {
      const result = await this.ragQueryEngine.query(question, options);
      return {
        answer: result.answer,
        sources: result.sources.map(s => ({
          title: s.title,
          snippet: s.snippet,
          score: s.score,
        })),
      };
    } catch (error) {
      log.warn({ error: error instanceof Error ? error.message : String(error) }, 'RAG query failed');
      return null;
    }
  }

  /**
   * Ingest content into the RAG pipeline (for briefings, conversations, etc.)
   */
  async ingestToRAG(content: string, options: {
    source: string;
    sourceType?: string;
    title?: string;
    domain?: string;
    tags?: string[];
  }): Promise<void> {
    if (!this.ingestionPipeline) return;

    try {
      await this.ingestionPipeline.ingest(content, {
        source: options.source,
        sourceType: (options.sourceType ?? 'conversation') as 'article' | 'tweet' | 'bookmark' | 'conversation' | 'email' | 'file',
        title: options.title,
        domain: options.domain,
        tags: options.tags,
      });
    } catch (error) {
      log.warn({ error: error instanceof Error ? error.message : String(error) }, 'RAG ingestion failed');
    }
  }

  /**
   * Build a plain-text summary of the morning briefing context for knowledge ingestion.
   * Converts structured briefing data into a searchable text representation.
   */
  private buildBriefingText(context: {
    digest?: import('./daily-digest.js').DailyDigest | null;
    lifeMonitorReport?: import('./life-monitor.js').LifeMonitorReport | null;
    careerMatches?: Array<{ title: string; company: string; matchScore: number; remote: boolean }> | null;
    portfolio?: import('./briefings.js').BriefingPortfolio | null;
    marketAlerts?: Array<{ asset: string; change: string; severity: string }> | null;
    weather?: { location: string; tempF: number; condition: string } | null;
    techNews?: Array<{ title: string; source: string }> | null;
  }): string {
    const date = new Date().toISOString().slice(0, 10);
    const parts: string[] = [`Morning Briefing ${date}`];

    if (context.digest) {
      parts.push(`Intelligence: ${context.digest.stats.itemsIncluded} items from ${context.digest.stats.sourcesScanned} sources`);
    }

    if (context.lifeMonitorReport) {
      parts.push(`Life Monitor: ${context.lifeMonitorReport.summary}`);
    }

    if (context.careerMatches && context.careerMatches.length > 0) {
      const topMatch = context.careerMatches[0];
      parts.push(`Career: ${topMatch.title} at ${topMatch.company} (${topMatch.matchScore}% match)`);
    }

    if (context.portfolio) {
      const sign = context.portfolio.dailyChangePercent >= 0 ? '+' : '';
      parts.push(`Portfolio: $${context.portfolio.totalValue.toLocaleString()} (${sign}${context.portfolio.dailyChangePercent.toFixed(1)}%)`);
    }

    if (context.marketAlerts && context.marketAlerts.length > 0) {
      const alerts = context.marketAlerts.map(a => `${a.asset.toUpperCase()} ${a.change}`).join(', ');
      parts.push(`Market Alerts: ${alerts}`);
    }

    if (context.weather) {
      parts.push(`Weather: ${context.weather.location} ${context.weather.tempF}F ${context.weather.condition}`);
    }

    if (context.techNews && context.techNews.length > 0) {
      const headlines = context.techNews.slice(0, 5).map(n => n.title).join('; ');
      parts.push(`Tech News: ${headlines}`);
    }

    return parts.join('\n');
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
        const briefingContext = {
          digest: this.lastDigest,
          lifeMonitorReport: this.lastLifeMonitorReport,
          careerMatches: this.lastCareerMatches.length > 0 ? this.lastCareerMatches : null,
          governance,
          portfolio: this.lastPortfolio,
          marketAlerts: this.lastMarketAlerts.length > 0 ? this.lastMarketAlerts : null,
          // Wire in cached data from orphan handlers
          calendarEvents: this.lastCalendarEvents.length > 0 ? this.lastCalendarEvents : null,
          pendingReminders: this.lastPendingReminders.length > 0 ? this.lastPendingReminders : null,
          weather: this.lastWeather,
          techNews: this.lastTechNews.length > 0 ? this.lastTechNews : null,
        };
        const briefingResult = await this.briefingGenerator.morningBriefing(briefingContext);

        // Auto-ingest briefing into knowledge for RAG retrieval
        if (this.documentIngestor && briefingResult.success) {
          const telegramHtml = this.buildBriefingText(briefingContext);
          const htmlStr = Array.isArray(telegramHtml) ? telegramHtml.join('\n') : telegramHtml;
          await this.documentIngestor.ingestBriefing(htmlStr, new Date().toISOString().slice(0, 10));

          // Also ingest into RAG vector pipeline for semantic search
          const today = new Date().toISOString().slice(0, 10);
          await this.ingestToRAG(htmlStr, {
            source: `briefing/${today}`,
            sourceType: 'file',
            title: `Morning Briefing ${today}`,
            domain: 'briefings',
            tags: ['briefing', 'morning', today],
          });
        }
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
          portfolio: this.lastPortfolio,
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

    // Weekly Wisdom Digest — Sunday 6:10 PM (after weekly_review)
    this.scheduler.registerHandler('weekly_wisdom', async () => {
      try {
        const { WeeklyWisdomDigest } = await import('./weekly-wisdom-digest.js');
        const { DecisionJournal } = await import('../cognition/learning/decision-journal.js');
        const journal = new DecisionJournal();
        const digest = new WeeklyWisdomDigest(this.eventBus, journal, {
          selfImprovementLoop: this.selfImprovementLoop ?? undefined,
        });
        const result = await digest.generate();
        log.info({ totalDecisions: result.totalDecisions, recommendations: result.recommendations.length }, 'Weekly wisdom digest generated');
      } catch (error) {
        log.warn({ error: error instanceof Error ? error.message : String(error) }, 'Weekly wisdom digest failed (non-critical)');
      }
    });

    // Knowledge indexing 3x daily
    this.scheduler.registerHandler('knowledge_index', async () => {
      await this.knowledgeIndex.reindexAll();
      // Also refresh RAG vector index
      await this.refreshRAGIndex();
      log.info('Knowledge index + RAG vector index updated');
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

    // Market background collection (every 4 hours — silent, builds baseline)
    this.scheduler.registerHandler('market_background_collect', async () => {
      try {
        if (!this.marketMonitor) {
          log.warn('Market monitor not initialized, skipping collection');
          return;
        }
        // Silent collection — only forward critical alerts (flash crashes)
        const criticalAlerts = await this.marketMonitor.collectSilent();
        log.info({ criticalAlerts: criticalAlerts.length }, 'Market background collection completed');

        // Only notify on critical alerts (flash crashes, extreme anomalies)
        for (const alert of criticalAlerts) {
          const pct = alert.data.changePercent;
          await notificationManager.finance(
            `ALERT: ${alert.asset.toUpperCase()}`,
            `${pct > 0 ? '+' : ''}${pct.toFixed(1)}% — ${alert.message}`,
            true // always urgent for critical
          );
        }

        // Cache critical alerts for briefing
        if (criticalAlerts.length > 0) {
          this.lastMarketAlerts = criticalAlerts.map(a => ({
            asset: a.asset,
            change: `${a.data.changePercent > 0 ? '+' : ''}${a.data.changePercent.toFixed(1)}%`,
            severity: a.severity,
          }));
        }
      } catch (error) {
        log.error({ error }, 'Market background collection failed');
      }
    });

    // Pre-market briefing (9:15 AM weekdays — overnight crypto + stock pre-market)
    this.scheduler.registerHandler('market_premarket_briefing', async () => {
      try {
        if (!this.marketMonitor) return;

        const alerts = await this.marketMonitor.checkAlerts();
        const significant = alerts.filter(a => a.severity !== 'info');

        // Build pre-market message
        const lines: string[] = ['<b>📊 Pre-Market Briefing</b>', ''];

        // Crypto overnight moves (only if > threshold)
        const cryptoAlerts = significant.filter(a => a.asset === 'bitcoin' || a.asset === 'ethereum' || a.asset === 'solana');
        if (cryptoAlerts.length > 0) {
          lines.push('<b>Crypto Overnight</b>');
          for (const a of cryptoAlerts) {
            const pct = a.data.changePercent;
            lines.push(`▸ ${a.asset.toUpperCase()}: ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% ($${a.data.currentPrice.toLocaleString()})`);
          }
          lines.push('');
        }

        // Stock pre-market summary
        const stockAlerts = significant.filter(a => !['bitcoin', 'ethereum', 'solana'].includes(a.asset));
        if (stockAlerts.length > 0) {
          lines.push('<b>Stocks &amp; ETFs</b>');
          for (const a of stockAlerts.slice(0, 5)) {
            const pct = a.data.changePercent;
            lines.push(`▸ ${a.asset.toUpperCase()}: ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`);
          }
          lines.push('');
        }

        if (significant.length === 0) {
          lines.push('Markets quiet overnight. No significant moves.');
        }

        // Cache for morning briefing
        this.lastMarketAlerts = significant.map(a => ({
          asset: a.asset,
          change: `${a.data.changePercent > 0 ? '+' : ''}${a.data.changePercent.toFixed(1)}%`,
          severity: a.severity,
        }));

        if (notificationManager.isReady()) {
          await notificationManager.notify({
            category: 'finance',
            title: 'Pre-Market Briefing',
            body: lines.join('\n'),
            priority: significant.some(a => a.severity === 'critical') ? 'high' : 'normal',
            telegramHtml: lines.join('\n'),
          });
        }
        log.info({ significantAlerts: significant.length }, 'Pre-market briefing sent');
      } catch (error) {
        log.error({ error }, 'Pre-market briefing failed');
      }
    });

    // Post-market briefing (4:15 PM weekdays — day P&L, only significant movers)
    this.scheduler.registerHandler('market_postmarket_briefing', async () => {
      try {
        if (!this.marketMonitor || !this.portfolioTracker) return;

        const alerts = await this.marketMonitor.checkAlerts();
        const summary = await this.portfolioTracker.getPortfolioSummary(this.marketMonitor);

        const lines: string[] = ['<b>📊 Post-Market Summary</b>', ''];

        // Portfolio P&L
        const dir = summary.dailyChangePercent >= 0 ? '📈' : '📉';
        const sign = summary.dailyChangePercent >= 0 ? '+' : '';
        lines.push(`<b>${dir} Portfolio: ${sign}$${Math.abs(summary.dailyChange).toLocaleString()} (${sign}${summary.dailyChangePercent.toFixed(1)}%)</b>`);
        lines.push(`Total: $${summary.totalValue.toLocaleString()}`);
        lines.push('');

        // Top movers (only those exceeding threshold)
        const significant = alerts.filter(a => a.severity !== 'info');
        if (significant.length > 0) {
          lines.push('<b>Movers</b>');
          for (const a of significant.slice(0, 5)) {
            const pct = a.data.changePercent;
            lines.push(`▸ ${a.asset.toUpperCase()}: ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`);
          }
        } else {
          lines.push('<i>No significant moves today.</i>');
        }

        // Cache portfolio for evening briefing
        this.lastPortfolio = {
          totalValue: summary.totalValue,
          dailyChange: summary.dailyChange,
          dailyChangePercent: summary.dailyChangePercent,
          topGainers: summary.holdings
            .filter(h => h.pnlPercent > 0)
            .sort((a, b) => b.pnlPercent - a.pnlPercent)
            .slice(0, 3)
            .map(h => ({ asset: h.asset, changePercent: h.pnlPercent })),
          topLosers: summary.holdings
            .filter(h => h.pnlPercent < 0)
            .sort((a, b) => a.pnlPercent - b.pnlPercent)
            .slice(0, 3)
            .map(h => ({ asset: h.asset, changePercent: h.pnlPercent })),
        };

        if (notificationManager.isReady()) {
          await notificationManager.notify({
            category: 'finance',
            title: 'Post-Market Summary',
            body: lines.join('\n'),
            priority: 'normal',
            telegramHtml: lines.join('\n'),
          });
        }
        log.info('Post-market briefing sent');
      } catch (error) {
        log.error({ error }, 'Post-market briefing failed');
      }
    });

    // Market weekly analysis (Sunday 6PM — full weekly digest)
    this.scheduler.registerHandler('market_weekly_analysis', async () => {
      try {
        if (!this.marketMonitor || !this.portfolioTracker) return;

        const summary = await this.portfolioTracker.getPortfolioSummary(this.marketMonitor);
        const watchlist = this.marketMonitor.getWatchlist();

        const lines: string[] = ['<b>📊 Weekly Market Analysis</b>', ''];

        // Portfolio summary
        const sign = summary.dailyChangePercent >= 0 ? '+' : '';
        lines.push(`<b>Portfolio: $${summary.totalValue.toLocaleString()} (${sign}${summary.dailyChangePercent.toFixed(1)}% this week)</b>`);
        lines.push('');

        // Z-score report for tracked assets
        lines.push('<b>Trend Analysis (7-day z-scores)</b>');
        for (const asset of watchlist.slice(0, 8)) {
          const snapshot = this.marketMonitor.getLastSnapshot(asset);
          if (!snapshot) continue;
          const zScore = this.marketMonitor.getBaseline().getZScore(asset, snapshot.price);
          if (zScore !== null) {
            const zStr = zScore >= 0 ? `+${zScore.toFixed(1)}σ` : `${zScore.toFixed(1)}σ`;
            const indicator = Math.abs(zScore) >= 2 ? ' ⚠' : '';
            lines.push(`▸ ${asset.toUpperCase()}: $${snapshot.price.toLocaleString()} (${zStr})${indicator}`);
          }
        }
        lines.push('');

        // Top movers this week
        const holdingsByChange = summary.holdings
          .filter(h => Math.abs(h.pnlPercent) > 0)
          .sort((a, b) => Math.abs(b.pnlPercent) - Math.abs(a.pnlPercent));

        if (holdingsByChange.length > 0) {
          lines.push('<b>Biggest Movers</b>');
          for (const h of holdingsByChange.slice(0, 5)) {
            const s = h.pnlPercent >= 0 ? '+' : '';
            lines.push(`▸ ${h.asset.toUpperCase()}: ${s}${h.pnlPercent.toFixed(1)}%`);
          }
        }

        if (notificationManager.isReady()) {
          await notificationManager.notify({
            category: 'finance',
            title: 'Weekly Market Analysis',
            body: lines.join('\n'),
            priority: 'normal',
            telegramHtml: lines.join('\n'),
          });
        }
        log.info('Weekly market analysis sent');
      } catch (error) {
        log.error({ error }, 'Weekly market analysis failed');
      }
    });

    // Portfolio update (8AM, 2PM, 8PM)
    this.scheduler.registerHandler('portfolio_update', async () => {
      try {
        if (!this.portfolioTracker || !this.marketMonitor) {
          log.warn('Portfolio tracker or market monitor not initialized');
          return;
        }
        const summary = await this.portfolioTracker.getPortfolioSummary(this.marketMonitor);
        this.lastPortfolio = {
          totalValue: summary.totalValue,
          dailyChange: summary.dailyChange,
          dailyChangePercent: summary.dailyChangePercent,
          topGainers: summary.holdings
            .filter(h => h.pnlPercent > 0)
            .sort((a, b) => b.pnlPercent - a.pnlPercent)
            .slice(0, 3)
            .map(h => ({ asset: h.asset, changePercent: h.pnlPercent })),
          topLosers: summary.holdings
            .filter(h => h.pnlPercent < 0)
            .sort((a, b) => a.pnlPercent - b.pnlPercent)
            .slice(0, 3)
            .map(h => ({ asset: h.asset, changePercent: h.pnlPercent })),
        };
        log.info({ totalValue: summary.totalValue, holdings: summary.holdings.length }, 'Portfolio updated');
        this.eventBus.emit('audit:log', {
          action: 'portfolio:update_complete',
          agent: 'SCHEDULER',
          trustLevel: 'system' as const,
          details: { totalValue: summary.totalValue, holdingCount: summary.holdings.length },
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
    this.scheduler.registerHandler('gmail_ingest', async () => {
      const email = process.env.GMAIL_EMAIL;
      const appPassword = process.env.GMAIL_APP_PASSWORD;

      if (!email || !appPassword) {
        log.info('Gmail ingestion skipped (credentials not configured)');
        return;
      }

      try {
        const { GmailClient } = await import('../integrations/gmail/client.js');
        const gmail = new GmailClient({ email, appPassword });

        await gmail.connect();
        const messages = await gmail.fetchNew();

        // Emit event with counts
        this.eventBus.emit('integration:gmail_fetched', {
          emailCount: messages.length,
          newCount: messages.filter(m => !m.isRead).length,
          timestamp: new Date().toISOString(),
        });

        // Emit classification events for tracking
        for (const msg of messages) {
          if (msg.classification) {
            this.eventBus.emit('integration:gmail_classified', {
              messageId: msg.id,
              classification: msg.classification,
              timestamp: new Date().toISOString(),
            });
          }
        }

        gmail.disconnect();

        log.info({ total: messages.length, important: messages.filter(m => m.classification === 'important').length }, 'Gmail ingestion complete');
      } catch (error: unknown) {
        log.error({ error: error instanceof Error ? error.message : String(error) }, 'Gmail ingestion failed');
        this.eventBus.emit('system:error', {
          error: error instanceof Error ? error : new Error(String(error)),
          context: 'gmail_ingest',
        });
      }
    });

    // Model evolution review (Monday 10 AM)
    this.scheduler.registerHandler('model_evolution', async () => {
      try {
        log.info('Model evolution review started');

        // Analyze cost efficiency and model routing
        const costLines: string[] = [];
        if (this.costTracker) {
          const status = this.costTracker.getThrottleStatus();
          const summary = this.costTracker.getSummary();
          costLines.push(`Budget: ${status.usagePercent.toFixed(0)}% used (${status.level})`);
          costLines.push(`Daily: $${summary.daily.toFixed(2)} | Weekly: $${summary.weekly.toFixed(2)} | Monthly: $${summary.monthly.toFixed(2)}`);
          costLines.push(`Trend: ${summary.trend}`);
        }

        this.eventBus.emit('audit:log', {
          action: 'model_evolution:review',
          agent: 'SCHEDULER',
          trustLevel: 'system' as const,
          details: {
            type: 'weekly_model_review',
            costAnalysis: costLines.join('; '),
          },
        });

        // Send summary to Telegram
        const reviewLines = ['<b>🧬 Weekly Model Review</b>', ''];
        if (costLines.length > 0) {
          reviewLines.push(...costLines.map(l => `▸ ${l}`));
        } else {
          reviewLines.push('▸ No cost data available yet');
        }
        reviewLines.push('');
        reviewLines.push('<i>Cascade routing active. Frugal-first model selection enabled.</i>');

        await notificationManager.notify({
          category: 'system',
          title: 'Weekly Model Review',
          body: reviewLines.join('\n'),
          priority: 'low',
          telegramHtml: reviewLines.join('\n'),
        });

        log.info('Model evolution review completed');
      } catch (error) {
        log.error({ error }, 'Model evolution review failed');
      }
    });

    // AI Council nightly review at 10 PM — governance summary to Telegram
    this.scheduler.registerHandler('ai_council_nightly', async () => {
      try {
        log.info('AI Council nightly review started');

        // Generate governance snapshot for the last 24 hours
        const snapshot = governanceReporter.generateSnapshot();
        const formatted = governanceReporter.formatForBriefing(snapshot);

        // Build council summary with system metrics
        const lines: string[] = ['<b>🏛️ Council Nightly Review</b>', ''];

        // Governance activity
        lines.push(formatted);
        lines.push('');

        // System health summary
        lines.push('<b>📊 System Status</b>');
        lines.push(`▸ Tasks processed: ${this.state.tasksProcessed}`);
        lines.push(`▸ Errors today: ${this.state.errors}`);
        if (this.costTracker) {
          const status = this.costTracker.getThrottleStatus();
          lines.push(`▸ Budget: ${status.usagePercent.toFixed(0)}% used (${status.level})`);
        }
        lines.push('');

        lines.push('Council session complete. ⚖️');

        // Send to Telegram
        if (notificationManager.isReady()) {
          await notificationManager.notify({
            category: 'governance',
            title: 'Council Nightly Review',
            body: lines.join('\n'),
            priority: 'normal',
            telegramHtml: lines.join('\n'),
          });
        }

        this.eventBus.emit('audit:log', {
          action: 'ai_council:nightly_review',
          agent: 'COUNCIL',
          trustLevel: 'system' as const,
          details: {
            type: 'nightly_strategic_review',
            totalEvents: snapshot.pipeline.totalEvents,
            votesCompleted: snapshot.council.votesCompleted,
            complianceRate: snapshot.arbiter.complianceRate,
          },
        });
        log.info({ events: snapshot.pipeline.totalEvents }, 'AI Council nightly review completed');
      } catch (error) {
        log.error({ error }, 'AI Council nightly review failed');
      }
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

    // ==========================================================================
    // CONTENT ENGINE: Draft generation + delivery to Telegram
    // ==========================================================================

    // Generate content drafts at 7:00 AM (after intelligence scan at 6:00 AM)
    this.scheduler.registerHandler('content_daily_drafts', async () => {
      try {
        if (!this.contentEngine || !this.intelligenceScanner) {
          log.info('Content engine or intelligence scanner not available, skipping draft generation');
          return;
        }

        const drafter = this.contentEngine.getDrafter();
        if (!drafter) {
          log.info('Content drafter not available (no AI provider), skipping');
          return;
        }

        // Use latest intelligence scan results to generate topic briefs
        const trendAnalyzer = this.contentEngine.getTrendAnalyzer();
        const scanResult = await this.intelligenceScanner.scan();
        const briefs = trendAnalyzer.analyze(scanResult.topItems);

        if (briefs.length === 0) {
          log.info('No qualifying topics for content generation');
          return;
        }

        // Generate drafts from briefs and add to queue
        let generated = 0;
        const queue = this.contentEngine.getDraftQueue();
        for (const brief of briefs) {
          try {
            const result = await drafter.generateDraft(brief);
            await queue.addDraft({
              topicBrief: brief,
              platform: result.platform,
              content: result.content,
              modelUsed: result.modelUsed,
              costUsd: result.costUsd,
            });
            generated++;
          } catch (err) {
            log.warn({ headline: brief.headline, error: err instanceof Error ? err.message : String(err) }, 'Draft generation failed for topic');
          }
        }

        log.info({ topics: briefs.length, generated }, 'Content draft generation complete');

        this.eventBus.emit('audit:log', {
          action: 'content:daily_drafts_complete',
          agent: 'CONTENT_ENGINE',
          trustLevel: 'system' as const,
          details: { topicsAnalyzed: briefs.length, draftsGenerated: generated },
        });
      } catch (error) {
        log.error({ error }, 'Content daily draft generation failed');
      }
    });

    // Deliver pending drafts to Telegram at 7:30 AM
    this.scheduler.registerHandler('content_draft_delivery', async () => {
      try {
        if (!this.contentEngine) return;

        const pending = this.contentEngine.getDraftQueue().getPending();
        if (pending.length === 0) {
          log.info('No pending content drafts to deliver');
          return;
        }

        // Build Telegram message with draft summaries
        const lines: string[] = [
          `<b>Content Drafts for Review (${pending.length})</b>`,
          '',
        ];

        for (const draft of pending.slice(0, 5)) {
          const headline = draft.topicBrief.headline.slice(0, 60);
          const preview = draft.content[0].slice(0, 100);
          lines.push(`<b>[${draft.platform}]</b> ${headline}`);
          lines.push(`<code>${draft.id}</code>`);
          lines.push(`<i>${preview}...</i>`);
          lines.push('');

          // Mark as sent for review
          await this.contentEngine.getDraftQueue().updateStatus(draft.id, 'sent_for_review');
        }

        lines.push('Reply: /content approve &lt;id&gt; or /content reject &lt;id&gt;');

        if (notificationManager.isReady()) {
          await notificationManager.notify({
            category: 'daily',
            title: 'Content Drafts',
            body: lines.join('\n'),
            priority: 'normal',
            telegramHtml: lines.join('\n'),
          });
        }

        log.info({ count: pending.length }, 'Content drafts delivered for review');
      } catch (error) {
        log.error({ error }, 'Content draft delivery failed');
      }
    });

    // ==========================================================================
    // ORPHAN HANDLERS: Calendar, Reminders, Weather, Tech News, GitHub
    // ==========================================================================

    this.scheduler.registerHandler('calendar_poll', async () => {
      try {
        const { AppleCalendar } = await import('../integrations/apple/calendar.js');
        const calendar = new AppleCalendar();
        const events = await calendar.getTodayEvents();
        const nextEvent = events.length > 0 ? events[0].title : undefined;
        this.eventBus.emit('apple:calendar_polled', {
          eventCount: events.length,
          nextEvent,
          timestamp: new Date().toISOString(),
        });
        this.lastCalendarEvents = events.map(e => ({
          title: e.title,
          startDate: e.startDate,
          endDate: e.endDate,
          location: e.location,
          isAllDay: e.isAllDay,
        }));
      } catch (error: unknown) {
        this.eventBus.emit('system:error', {
          error: error instanceof Error ? error : new Error(String(error)),
          context: 'calendar_poll',
        });
      }
    });

    this.scheduler.registerHandler('reminder_sync', async () => {
      try {
        const { AppleReminders } = await import('../integrations/apple/reminders.js');
        const reminders = new AppleReminders();
        const pending = await reminders.getIncomplete();
        this.eventBus.emit('apple:reminder_synced', {
          synced: pending.length,
          skipped: 0,
          errors: 0,
          timestamp: new Date().toISOString(),
        });
        this.lastPendingReminders = pending.map(r => ({
          name: r.name,
          dueDate: r.dueDate,
          priority: r.priority,
          list: r.list,
        }));
      } catch (error: unknown) {
        this.eventBus.emit('system:error', {
          error: error instanceof Error ? error : new Error(String(error)),
          context: 'reminder_sync',
        });
      }
    });

    this.scheduler.registerHandler('weather_fetch', async () => {
      const apiKey = process.env.WEATHER_API_KEY;
      const location = process.env.WEATHER_LOCATION || 'Indianapolis, IN';
      if (!apiKey) return;
      try {
        const { WeatherClient } = await import('../integrations/weather/client.js');
        const weather = new WeatherClient(apiKey);
        const current = await weather.getCurrent(location);
        const forecast = await weather.getForecast(location, 3);
        this.eventBus.emit('integration:weather_fetched', {
          location: current.location,
          tempF: current.tempF,
          condition: current.condition,
          timestamp: new Date().toISOString(),
        });
        this.lastWeather = {
          location: current.location,
          tempF: current.tempF,
          condition: current.condition,
          feelsLikeF: current.feelsLikeF,
          humidity: current.humidity,
          forecast: forecast.map(f => ({
            date: f.date,
            maxTempF: f.maxTempF,
            minTempF: f.minTempF,
            condition: f.condition,
            chanceOfRain: f.chanceOfRain,
          })),
        };
      } catch (error: unknown) {
        this.eventBus.emit('system:error', {
          error: error instanceof Error ? error : new Error(String(error)),
          context: 'weather_fetch',
        });
      }
    });

    this.scheduler.registerHandler('tech_news_fetch', async () => {
      try {
        const { HackerNewsClient } = await import('../integrations/hackernews/client.js');
        const hn = new HackerNewsClient();
        const topStories = await hn.getTopStories(20);
        this.eventBus.emit('integration:news_fetched', {
          source: 'hackernews',
          itemCount: topStories.length,
          timestamp: new Date().toISOString(),
        });
        this.lastTechNews = topStories.map(s => ({
          title: s.title,
          url: s.url,
          score: s.score,
          source: 'hackernews',
        }));
      } catch (error: unknown) {
        this.eventBus.emit('system:error', {
          error: error instanceof Error ? error : new Error(String(error)),
          context: 'tech_news_fetch',
        });
      }
    });

    this.scheduler.registerHandler('github_poll', async () => {
      const token = process.env.GITHUB_TOKEN;
      if (!token) return;
      try {
        const { GitHubClient } = await import('../integrations/github/client.js');
        const github = new GitHubClient(token);
        // Fetch repo activity instead of notifications to match event type
        const activity = await github.getRepoActivity('Ari-OS', 'ARI');
        this.eventBus.emit('integration:github_polled', {
          repo: 'Ari-OS/ARI',
          stars: activity.stars,
          openPRs: activity.openPRs,
          timestamp: new Date().toISOString(),
        });
      } catch (error: unknown) {
        this.eventBus.emit('system:error', {
          error: error instanceof Error ? error : new Error(String(error)),
          context: 'github_poll',
        });
      }
    });

    // ==========================================================================
    // PHASE 9-29 HANDLERS: CRM, Soul Evolution, Human Tracker, Platform Health
    // ==========================================================================

    // CRM daily stale contact scan at 2 AM
    this.scheduler.registerHandler('crm_daily_scan', async () => {
      try {
        const { CRMStore } = await import('../integrations/crm/crm-store.js');
        const crmStore = new CRMStore();
        crmStore.init();
        const stale = crmStore.getStaleContacts(30);
        if (stale.length > 0) {
          this.eventBus.emit('crm:contact_created', {
            contactId: 'scan',
            name: `${stale.length} stale contacts found`,
            category: 'client',
            timestamp: new Date().toISOString(),
          });
          log.info({ staleCount: stale.length }, 'CRM stale contact scan complete');
        }
        crmStore.close();
      } catch (error) {
        log.error({ error }, 'CRM daily scan failed');
      }
    });

    // CRM weekly report on Sunday 8 PM
    this.scheduler.registerHandler('crm_weekly_report', async () => {
      try {
        const { CRMStore } = await import('../integrations/crm/crm-store.js');
        const crmStore = new CRMStore();
        crmStore.init();
        const stats = crmStore.getStats();
        const stale = crmStore.getStaleContacts(30);

        const lines: string[] = ['<b>CRM Weekly Report</b>', ''];
        lines.push(`Total contacts: ${stats.totalContacts}`);
        lines.push(`Stale (30+ days): ${stale.length}`);
        lines.push(`Avg relationship: ${stats.avgRelationshipScore.toFixed(0)}/100`);
        if (Object.keys(stats.byCategory).length > 0) {
          lines.push('');
          lines.push('<b>By Category</b>');
          for (const [cat, count] of Object.entries(stats.byCategory)) {
            lines.push(`${cat}: ${count}`);
          }
        }

        if (notificationManager.isReady()) {
          await notificationManager.notify({
            category: 'system',
            title: 'CRM Weekly Report',
            body: lines.join('\n'),
            priority: 'low',
            telegramHtml: lines.join('\n'),
          });
        }
        crmStore.close();
        log.info({ totalContacts: stats.totalContacts, stale: stale.length }, 'CRM weekly report sent');
      } catch (error) {
        log.error({ error }, 'CRM weekly report failed');
      }
    });

    // Soul weekly reflection on Sunday 10 PM
    this.scheduler.registerHandler('soul_weekly_reflection', async () => {
      try {
        const { SoulEvolution } = await import('./soul-evolution.js');
        const { AIOrchestrator } = await import('../ai/orchestrator.js');
        const orchestrator = new AIOrchestrator(this.eventBus, {
          costTracker: this.costTracker ?? undefined,
        });
        const workspaceDir = path.join(process.env.HOME || '~', '.ari', 'workspace');
        const soul = new SoulEvolution({
          eventBus: this.eventBus,
          orchestrator,
          workspaceDir,
        });
        await soul.initialize();
        const reflection = await soul.weeklyReflection({
          interactionCount: this.state.tasksProcessed,
          feedbackPositive: 0,
          feedbackNegative: 0,
          topTopics: [],
        });
        log.info({
          proposalCount: reflection.proposedChanges.length,
          overallSentiment: reflection.overallSentiment,
        }, 'Soul weekly reflection complete');

        if (reflection.proposedChanges.length > 0 && notificationManager.isReady()) {
          await notificationManager.notify({
            category: 'system',
            title: 'Soul Evolution',
            body: `${reflection.proposedChanges.length} evolution proposal(s). Sentiment: ${reflection.overallSentiment}`,
            priority: 'low',
          });
        }
      } catch (error) {
        log.error({ error }, 'Soul weekly reflection failed');
      }
    });

    // Life review weekly on Sunday 8 PM
    this.scheduler.registerHandler('life_review_weekly', async () => {
      try {
        const { HumanTracker } = await import('./human-tracker.js');
        const tracker = new HumanTracker({ eventBus: this.eventBus });
        const review = tracker.generateWeeklyReview();

        const lines: string[] = ['<b>Human 3.0 Weekly Review</b>', ''];
        for (const [quadrant, data] of Object.entries(review.quadrants)) {
          const score = (data as { score: number }).score;
          const bar = '#'.repeat(Math.round(score / 10)) + '-'.repeat(10 - Math.round(score / 10));
          lines.push(`${quadrant}: [${bar}] ${score}/100`);
        }
        lines.push('');
        lines.push(`<b>Overall: ${review.overallScore}/100</b>`);
        if (review.weeklyGoals.length > 0) {
          lines.push('');
          lines.push('<b>Focus Areas</b>');
          for (const goal of review.weeklyGoals.slice(0, 3)) {
            lines.push(`- ${goal}`);
          }
        }

        if (notificationManager.isReady()) {
          await notificationManager.notify({
            category: 'system',
            title: 'Human 3.0 Review',
            body: lines.join('\n'),
            priority: 'normal',
            telegramHtml: lines.join('\n'),
          });
        }
        log.info({ overallScore: review.overallScore }, 'Life review weekly complete');
      } catch (error) {
        log.error({ error }, 'Life review weekly failed');
      }
    });

    // Email triage scan every 30 min during work hours
    this.scheduler.registerHandler('email_triage', () => {
      // Gmail triage requires OAuth setup — for now, use the existing
      // gmail_ingest handler which handles IMAP-based ingestion.
      // When Gmail OAuth is configured, this will use EmailTriage.triageBatch()
      // to classify emails by priority and category.
      log.info('Email triage handler ready (pending Gmail OAuth configuration)');
      return Promise.resolve();
    });

    // Platform health audit at 2 AM — convene platform health council
    this.scheduler.registerHandler('platform_health_audit', async () => {
      try {
        const { OperationalCouncils } = await import('../governance/operational-councils.js');
        const { AIOrchestrator } = await import('../ai/orchestrator.js');
        const orchestrator = new AIOrchestrator(this.eventBus, {
          costTracker: this.costTracker ?? undefined,
        });
        const councils = new OperationalCouncils({
          eventBus: this.eventBus,
          orchestrator,
        });
        const result = await councils.convene(
          'platform-health',
          'Nightly platform health audit: check system uptime, error rates, and resource usage',
        );
        log.info({ approved: result.approved, votes: result.votes.length }, 'Platform health audit complete');

        if (!result.approved && notificationManager.isReady()) {
          await notificationManager.notify({
            category: 'system',
            title: 'Platform Health Issues',
            body: `Council flagged issues: ${result.summary}`,
            priority: 'high',
          });
        }
      } catch (error) {
        log.error({ error }, 'Platform health audit failed');
      }
    });

    // Video script generation (Monday 10 AM) — Phase 7
    this.scheduler.registerHandler("video_script_generation", async () => {
      try {
        if (!this.contentEngine) {
          log.info("Content engine not available, skipping video script generation");
          return;
        }
        log.info("Generating weekly video script via content pipeline");
        this.eventBus.emit("audit:log", {
          action: "content:video_script_generation_started",
          agent: "VIDEO_PIPELINE",
          trustLevel: "system" as const,
          details: { scheduledAt: new Date().toISOString() },
        });
        // Content engine generates scripts via its drafter
        const drafter = this.contentEngine.getDrafter();
        if (drafter) {
          const trendAnalyzer = this.contentEngine.getTrendAnalyzer();
          if (this.intelligenceScanner) {
            const scan = await this.intelligenceScanner.scan();
            const briefs = trendAnalyzer.analyze(scan.topItems);
            const videoBrief = briefs[0]; // Best topic for video
            if (videoBrief) {
              const script = await drafter.generateDraft(videoBrief);
              const wordCount = Array.isArray(script.content) ? script.content.join(" ").split(" ").length : String(script.content).split(" ").length;
              log.info({ topic: videoBrief.headline, words: wordCount }, "Video script generated");
            }
          }
        }
      } catch (error) {
        log.error({ error }, "Video script generation failed");
      }
    });

    // Video pipeline status check (every 4 min) — Phase 7
    this.scheduler.registerHandler("video_pipeline_status", (): Promise<void> => {
      try {
        this.eventBus.emit("video:pipeline_status_check", {
          checkedAt: new Date().toISOString(),
        });
        log.debug("Video pipeline status check emitted");
      } catch (error) {
        log.error({ error }, "Video pipeline status check failed");
      }
      return Promise.resolve();
    });

    // Earnings analyzer (daily 7 AM) — Phase 6
    this.scheduler.registerHandler("earnings_analyzer", (): Promise<void> => {
      try {
        if (!this.marketMonitor) {
          log.info("Market monitor not available, skipping earnings analysis");
          return Promise.resolve();
        }
        log.info("Running earnings analysis for portfolio holdings");
        this.eventBus.emit("market:earnings_analysis_requested", {
          requestedAt: new Date().toISOString(),
        });
        this.eventBus.emit("audit:log", {
          action: "market:earnings_analyzer_run",
          agent: "MARKET_MONITOR",
          trustLevel: "system" as const,
          details: { scheduledAt: new Date().toISOString() },
        });
      } catch (error) {
        log.error({ error }, "Earnings analysis failed");
      }
      return Promise.resolve();
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
