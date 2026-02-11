import { Command } from 'commander';
import { Gateway } from '../../kernel/gateway.js';
import { AuditLogger } from '../../kernel/audit.js';
import { EventBus } from '../../kernel/event-bus.js';
import { Guardian } from '../../agents/guardian.js';
import { MemoryManager } from '../../agents/memory-manager.js';
import { Executor } from '../../agents/executor.js';
import { Planner } from '../../agents/planner.js';
import { Core } from '../../agents/core.js';
import { Council } from '../../governance/council.js';
import { Arbiter } from '../../governance/arbiter.js';
import { Overseer } from '../../governance/overseer.js';
import { SystemRouter } from '../../system/router.js';
import { HeartbeatMonitor } from '../../kernel/heartbeat.js';
import { apiRoutes } from '../../api/routes.js';
import { WebSocketBroadcaster } from '../../api/ws.js';
import * as Storage from '../../system/storage.js';
import { AutonomousAgent } from '../../autonomous/agent.js';
import { dailyAudit } from '../../autonomous/daily-audit.js';

// AI Orchestrator — the unified LLM pipeline
import { AIOrchestrator } from '../../ai/orchestrator.js';
import { ProviderRegistry } from '../../ai/provider-registry.js';
import { ModelRegistry } from '../../ai/model-registry.js';

// Budget and analytics components
import { CostTracker } from '../../observability/cost-tracker.js';
import { ApprovalQueue } from '../../autonomous/approval-queue.js';
import { BillingCycleManager } from '../../autonomous/billing-cycle.js';
import { ValueAnalytics } from '../../observability/value-analytics.js';
import { AdaptiveLearner } from '../../autonomous/adaptive-learner.js';

// Cognitive Layer 0
import { initializeCognition } from '../../cognition/index.js';

// Plugin system
import { PluginRegistry } from '../../plugins/registry.js';
import { TelegramBotPlugin } from '../../plugins/telegram-bot/index.js';
import { TtsPlugin } from '../../plugins/tts/index.js';
import { CryptoPlugin } from '../../plugins/crypto/index.js';
import { PokemonTcgPlugin } from '../../plugins/pokemon-tcg/index.js';

interface GatewayStartOptions {
  port: string;
}

interface GatewayStatusOptions {
  port: string;
}

export function registerGatewayCommand(program: Command): void {
  const gateway = program
    .command('gateway')
    .description('Manage ARI Gateway server');

  gateway
    .command('start')
    .description('Start the ARI Gateway server with full system')
    .option('-p, --port <number>', 'Port to bind the gateway to', '3141')
    .action(async (options: GatewayStartOptions) => {
      const port = parseInt(options.port, 10);

      if (isNaN(port) || port < 1 || port > 65535) {
        console.error('Error: Invalid port number. Must be between 1 and 65535.');
        process.exit(1);
      }

      // Initialize kernel components
      const audit = new AuditLogger();
      const eventBus = new EventBus();

      // Load audit log
      try {
        await audit.load();
        console.log('Audit log loaded successfully');
      } catch (error) {
        console.warn('Could not load audit log:', error);
      }

      // Initialize agents
      const guardian = new Guardian(audit, eventBus);
      const memoryManager = new MemoryManager(audit, eventBus);
      await memoryManager.initialize();
      console.log('Memory persistence loaded');
      const executor = new Executor(audit, eventBus);
      const planner = new Planner(audit, eventBus);

      // Initialize core orchestrator
      const core = new Core(audit, eventBus, {
        guardian,
        memoryManager,
        executor,
        planner,
      });

      // Initialize governance components
      const council = new Council(audit, eventBus);
      const arbiter = new Arbiter(audit, eventBus);
      const overseer = new Overseer(audit, eventBus);

      // Set governance on core
      core.setGovernance({ council, arbiter, overseer });

      // Initialize system router
      const router = new SystemRouter(eventBus, audit);

      // Initialize budget and analytics components
      const costTracker = new CostTracker(eventBus, audit);
      const approvalQueue = new ApprovalQueue(eventBus);
      const billingCycleManager = new BillingCycleManager(eventBus);
      const valueAnalytics = new ValueAnalytics(eventBus);
      const adaptiveLearner = new AdaptiveLearner(eventBus);
      console.log('Budget and analytics components initialized');

      // Initialize Cognitive Layer 0
      const cognitionLayer = await initializeCognition(eventBus);
      console.log('Cognitive Layer 0 initialized');

      // Initialize AI Orchestrator with multi-provider support
      let aiOrchestrator: AIOrchestrator | null = null;
      try {
        const modelRegistry = new ModelRegistry();
        const providerRegistry = new ProviderRegistry(eventBus, modelRegistry);
        await providerRegistry.registerFromEnv();

        const activeProviders = providerRegistry.getActiveProviders();
        if (activeProviders.length > 0) {
          aiOrchestrator = new AIOrchestrator(eventBus, {
            providerRegistry,
            defaultModel: 'claude-sonnet-4',
            costTracker,
          });
          core.setAIProvider(aiOrchestrator);
          console.log(`AI Orchestrator initialized — ${activeProviders.length} provider(s): ${activeProviders.join(', ')}`);
        } else {
          console.log('No LLM API keys found — AI responses disabled');
          console.log('Add keys to .env: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_AI_API_KEY, XAI_API_KEY');
        }
      } catch (error) {
        console.warn('AI Orchestrator failed to initialize:', error);
        console.warn('ARI will continue without AI-powered responses');
      }

      // Initialize Plugin System (requires AI Orchestrator for chat-capable plugins)
      const pluginRegistry = new PluginRegistry(eventBus);
      if (aiOrchestrator) {
        try {
          await pluginRegistry.register(new TelegramBotPlugin());
          await pluginRegistry.register(new TtsPlugin());
          await pluginRegistry.register(new CryptoPlugin());
          await pluginRegistry.register(new PokemonTcgPlugin());

          await pluginRegistry.initializeAll({
            eventBus,
            orchestrator: aiOrchestrator,
            costTracker,
          });

          const activePlugins = pluginRegistry.listPlugins().filter(p => p.status === 'active');
          console.log(`Plugin system initialized — ${activePlugins.length} active plugin(s): ${activePlugins.map(p => p.name).join(', ')}`);
        } catch (error) {
          console.warn('Plugin system failed to initialize:', error);
        }
      } else {
        console.log('Plugins skipped — no AI Orchestrator available');
      }

      // Initialize heartbeat monitor
      const heartbeat = new HeartbeatMonitor(eventBus);
      // eslint-disable-next-line @typescript-eslint/require-await
      heartbeat.register('gateway', 'kernel', async () => ({ status: 'up' }));
      // eslint-disable-next-line @typescript-eslint/require-await
      heartbeat.register('audit', 'kernel', async () => ({
        entries: audit.getEvents().length,
      }));
      // eslint-disable-next-line @typescript-eslint/require-await
      heartbeat.register('memory', 'agent', async () => ({
        entries: memoryManager.getStats().total_entries,
      }));

      // Create gateway
      const gatewayInstance = new Gateway(port, audit, eventBus);

      // Register API routes plugin BEFORE starting the server
      try {
        await gatewayInstance.registerPlugin(apiRoutes, {
          deps: {
            audit,
            eventBus,
            core,
            council,
            arbiter,
            overseer,
            memoryManager,
            executor,
            storage: Storage,
            // AI Orchestrator
            aiOrchestrator,
            // Budget and analytics
            costTracker,
            approvalQueue,
            billingCycleManager,
            valueAnalytics,
            adaptiveLearner,
            // Cognitive Layer 0
            cognitionLayer,
          },
        });
        console.log('API routes registered');
      } catch (error) {
        console.error('Failed to register API routes:', error);
        process.exit(1);
      }

      // WebSocket broadcaster (will be initialized after server starts)
      let wsBroadcaster: WebSocketBroadcaster | null = null;

      // Vote expiration interval (ADR-006: 1-hour proposal expiration)
      let voteExpirationInterval: ReturnType<typeof setInterval> | null = null;

      // Autonomous agent (for 24/7 operation)
      const autonomousAgent = new AutonomousAgent(eventBus);

      // Graceful shutdown handlers
      const shutdown = async (signal: string) => {
        console.log(`\nReceived ${signal}, shutting down gracefully...`);
        try {
          // Stop autonomous agent first
          await autonomousAgent.stop();

          // Shutdown plugins
          await pluginRegistry.shutdownAll();

          // Shutdown AI Orchestrator
          if (aiOrchestrator) {
            await aiOrchestrator.shutdown();
          }

          // Shutdown persistence layers
          await memoryManager.shutdown();
          await costTracker.shutdown();
          heartbeat.stop();

          // Stop agents and core
          await core.stop('shutdown');
          router.stop();
          arbiter.stop();
          overseer.stop();

          // Stop vote expiration checks
          if (voteExpirationInterval) {
            clearInterval(voteExpirationInterval);
          }

          // Close WebSocket broadcaster
          if (wsBroadcaster) {
            wsBroadcaster.close();
          }

          // Stop gateway
          await gatewayInstance.stop();

          console.log('Gateway stopped successfully');
          process.exit(0);
        } catch (error) {
          console.error('Error during shutdown:', error);
          process.exit(1);
        }
      };

      process.on('SIGINT', () => {
        void shutdown('SIGINT');
      });
      process.on('SIGTERM', () => {
        void shutdown('SIGTERM');
      });

      try {
        // Start the gateway
        await gatewayInstance.start();
        console.log(`ARI Gateway running at ${gatewayInstance.getAddress()}`);

        // Attach WebSocket broadcaster to HTTP server
        const httpServer = gatewayInstance.getHttpServer();
        wsBroadcaster = new WebSocketBroadcaster(httpServer, eventBus);
        console.log('WebSocket broadcaster attached at ws://127.0.0.1:' + port + '/ws');

        // Start system components
        router.start();
        arbiter.start();
        overseer.start();
        await core.start();

        // Start periodic vote expiration check (ADR-006: 1-hour expiration)
        // Runs every 60 seconds to expire overdue votes
        voteExpirationInterval = setInterval(() => {
          const expired = council.expireOverdueVotes();
          if (expired > 0) {
            console.log(`Expired ${expired} overdue vote(s)`);
          }
        }, 60_000);

        // Initialize daily audit system
        await dailyAudit.init();
        console.log('Daily audit system initialized');

        // Start autonomous agent for 24/7 operation
        try {
          // Initialize alert system with the autonomous agent's pushover
          await autonomousAgent.start();
          console.log('Autonomous agent started');
        } catch (error) {
          console.warn('Autonomous agent failed to start:', error);
          console.warn('ARI will continue without autonomous capabilities');
        }

        // Start heartbeat monitoring
        heartbeat.start();
        console.log('Heartbeat monitor started');

        console.log('ARI system fully initialized');
        console.log('API endpoints available at http://127.0.0.1:' + port + '/api/*');
      } catch (error) {
        console.error('Failed to start gateway:', error);
        process.exit(1);
      }
    });

  gateway
    .command('status')
    .description('Check if the ARI Gateway is running')
    .option('-p, --port <number>', 'Port the gateway is running on', '3141')
    .action(async (options: GatewayStatusOptions) => {
      const port = parseInt(options.port, 10);
      const url = `http://127.0.0.1:${port}/health`;

      try {
        const response = await fetch(url);
        const data: unknown = await response.json();
        console.log('Gateway Status:');
        console.log(JSON.stringify(data, null, 2));
      } catch {
        console.log('Gateway is not running');
        process.exit(1);
      }
    });
}
