import type { Bot } from 'grammy';
import type { EventBus } from '../../kernel/event-bus.js';
import type {
  DomainPlugin,
  PluginManifest,
  PluginStatus,
  PluginDependencies,
} from '../types.js';
import { TelegramBotConfigSchema } from './types.js';
import type { TelegramBotConfig } from './types.js';
import { createBot } from './bot.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM BOT PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════

export class TelegramBotPlugin implements DomainPlugin {
  readonly manifest: PluginManifest = {
    id: 'telegram-bot',
    name: 'Telegram Bot',
    version: '1.0.0',
    description: 'ARI\'s primary mobile interface via Telegram long polling',
    author: 'ARI',
    capabilities: ['cli', 'api'],
    dependencies: [],
  };

  private status: PluginStatus = 'registered';
  private eventBus!: EventBus;
  private bot: Bot | null = null;
  private config!: TelegramBotConfig;
  private polling: boolean = false;

  // ── Lifecycle ──────────────────────────────────────────────────────

  async initialize(deps: PluginDependencies): Promise<void> {
    this.eventBus = deps.eventBus;

    // Parse config with env var fallbacks
    const rawConfig = {
      ...deps.config,
      botToken: (deps.config.botToken as string | undefined) ?? process.env.TELEGRAM_BOT_TOKEN,
      allowedUserIds: (deps.config.allowedUserIds as number[] | undefined) ??
        (process.env.TELEGRAM_ALLOWED_USER_IDS
          ? process.env.TELEGRAM_ALLOWED_USER_IDS.split(',').map(Number)
          : []),
      ownerUserId: (deps.config.ownerUserId as number | undefined) ??
        (process.env.TELEGRAM_OWNER_USER_ID ? Number(process.env.TELEGRAM_OWNER_USER_ID) : undefined),
    };

    this.config = TelegramBotConfigSchema.parse(rawConfig);

    if (!this.config.botToken) {
      this.status = 'error';
      return;
    }

    try {
      this.bot = createBot({
        eventBus: deps.eventBus,
        orchestrator: deps.orchestrator,
        costTracker: deps.costTracker,
        registry: deps.registry ?? null,
        config: this.config,
      });

      // Start long polling (non-blocking)
      await this.startPolling();
      this.status = 'active';
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.bot && this.polling) {
      await this.bot.stop();
      this.polling = false;

      this.eventBus.emit('telegram:bot_stopped', {
        reason: 'shutdown',
        timestamp: new Date().toISOString(),
      });
    }
    this.status = 'shutdown';
  }

  getStatus(): PluginStatus {
    return this.status;
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
    if (!this.bot) {
      return { healthy: false, details: 'Bot not initialized' };
    }

    try {
      const me = await this.bot.api.getMe();
      return { healthy: true, details: `Bot: @${me.username}` };
    } catch (error) {
      return {
        healthy: false,
        details: `Bot API error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ── Private ────────────────────────────────────────────────────────

  private async startPolling(): Promise<void> {
    if (!this.bot) return;

    try {
      const me = await this.bot.api.getMe();
      this.eventBus.emit('telegram:bot_started', {
        botUsername: me.username ?? 'unknown',
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-fatal — bot may still work
    }

    // Start long polling in background (non-blocking)
    this.polling = true;
    this.bot.start({
      onStart: () => {
        // Polling started
      },
    }).catch((error: unknown) => {
      if (this.polling) {
        this.status = 'error';
        this.eventBus.emit('telegram:bot_stopped', {
          reason: error instanceof Error ? error.message : 'polling error',
          timestamp: new Date().toISOString(),
        });
      }
    });
  }
}
