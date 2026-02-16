/**
 * ARI Telegram Forum Topic Manager
 *
 * Manages forum topics in Telegram supergroups for organized message routing.
 * Supports topic creation, caching, and message delivery to specific topics.
 *
 * L6 Layer (Interfaces) - can import from all lower layers.
 *
 * Requires:
 * - TELEGRAM_BOT_TOKEN: Bot token from @BotFather
 * - TELEGRAM_GROUP_CHAT_ID: Forum-enabled supergroup ID (negative number)
 */

import { Bot, GrammyError, HttpError } from 'grammy';
import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('topic-manager');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Predefined topic names for ARI's notification categories
 */
export type TopicName = 'updates' | 'market' | 'briefings' | 'opportunities' | 'system';

/**
 * Telegram-allowed forum topic icon colors (RGB format)
 * Must be one of: 0x6FB9F0, 0xFFD67E, 0xCB86DB, 0x8EEE98, 0xFF93B2, 0xFB6F5F
 */
type TelegramIconColor = 7322096 | 16766590 | 13338331 | 9367192 | 16749490 | 16478047;

/**
 * Information about a forum topic
 */
export interface TopicInfo {
  id: number;
  name: string;
  iconColor: TelegramIconColor;
  createdAt: Date;
}

/**
 * Configuration for TopicManager
 */
export interface TopicManagerOptions {
  botToken: string;
  groupChatId: string;
}

/**
 * Result of a send operation
 */
export interface TopicSendResult {
  sent: boolean;
  reason: string;
  messageId?: number;
  topicId?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Topic display names and colors for each category
 */
const TOPIC_CONFIG: Record<TopicName, { displayName: string; iconColor: TelegramIconColor }> = {
  updates: { displayName: 'ARI Updates', iconColor: 7322096 },         // 0x6FB9F0 Blue
  market: { displayName: 'Market Alerts', iconColor: 16766590 },       // 0xFFD67E Yellow
  briefings: { displayName: 'Daily Briefings', iconColor: 13338331 },  // 0xCB86DB Purple
  opportunities: { displayName: 'Opportunities', iconColor: 9367192 }, // 0x8EEE98 Green
  system: { displayName: 'System', iconColor: 16749490 },              // 0xFF93B2 Pink
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOPIC MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Manages Telegram forum topics for organized message delivery.
 *
 * Uses grammY for Telegram API communication and caches topic IDs
 * to minimize API calls.
 */
export class TopicManager {
  private readonly eventBus: EventBus;
  private readonly bot: Bot;
  private readonly groupChatId: number;
  private readonly topicCache: Map<TopicName, TopicInfo> = new Map();
  private initialized = false;

  constructor(eventBus: EventBus, options: TopicManagerOptions) {
    if (!options.botToken) {
      throw new Error('Bot token is required');
    }
    if (!options.groupChatId) {
      throw new Error('Group chat ID is required');
    }

    this.eventBus = eventBus;
    this.bot = new Bot(options.botToken);

    // Parse group chat ID (should be negative for supergroups)
    const chatId = parseInt(options.groupChatId, 10);
    if (isNaN(chatId)) {
      throw new Error('Invalid group chat ID: must be a number');
    }
    this.groupChatId = chatId;
  }

  /**
   * Initialize the topic manager and verify bot permissions
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Verify bot can access the chat
      const chat = await this.bot.api.getChat(this.groupChatId);

      // Verify it's a forum-enabled supergroup
      if (chat.type !== 'supergroup') {
        throw new Error('Chat must be a supergroup');
      }
      if (!('is_forum' in chat) || !chat.is_forum) {
        throw new Error('Chat must be a forum (topics enabled)');
      }

      // Load existing topics into cache
      await this.loadExistingTopics();

      this.initialized = true;
    } catch (error) {
      this.handleApiError(error, 'init');
      throw error;
    }
  }

  /**
   * Ensure a topic exists, creating it if necessary
   * @returns Topic thread ID
   */
  async ensureTopic(name: TopicName): Promise<number> {
    // Check cache first
    const cached = this.topicCache.get(name);
    if (cached) {
      return cached.id;
    }

    // Topic not in cache, create it
    const config = TOPIC_CONFIG[name];
    if (!config) {
      throw new Error(`Unknown topic name: ${name}`);
    }

    try {
      const result = await this.bot.api.createForumTopic(
        this.groupChatId,
        config.displayName,
        { icon_color: config.iconColor }
      );

      const topicInfo: TopicInfo = {
        id: result.message_thread_id,
        name: config.displayName,
        iconColor: config.iconColor,
        createdAt: new Date(),
      };

      this.topicCache.set(name, topicInfo);
      return topicInfo.id;
    } catch (error) {
      // Check if topic already exists (race condition)
      if (this.isTopicExistsError(error)) {
        // Reload topics and retry
        await this.loadExistingTopics();
        const reloadedTopic = this.topicCache.get(name);
        if (reloadedTopic) {
          return reloadedTopic.id;
        }
      }

      this.handleApiError(error, 'ensureTopic');
      throw error;
    }
  }

  /**
   * Send a message to a specific topic
   */
  async sendToTopic(name: TopicName, message: string): Promise<boolean> {
    if (!message || message.trim().length === 0) {
      return false;
    }

    try {
      const topicId = await this.ensureTopic(name);

      // Truncate to Telegram's 4096 char limit
      const finalMessage = message.length > 4096
        ? message.slice(0, 4093) + '...'
        : message;

      const result = await this.bot.api.sendMessage(
        this.groupChatId,
        finalMessage,
        {
          message_thread_id: topicId,
          parse_mode: 'HTML',
        }
      );

      // Emit event for audit trail
      this.emitTopicMessageSent(name, topicId, result.message_id);

      return true;
    } catch (error) {
      this.handleApiError(error, 'sendToTopic');
      return false;
    }
  }

  /**
   * List all cached topics
   */
  async listTopics(): Promise<TopicInfo[]> {
    // Reload from API to ensure freshness
    await this.loadExistingTopics();
    return Array.from(this.topicCache.values());
  }

  /**
   * Get topic ID from cache (does not create)
   */
  getTopicId(name: TopicName): number | undefined {
    return this.topicCache.get(name)?.id;
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clear the topic cache (for testing or reload)
   */
  clearCache(): void {
    this.topicCache.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Load existing topics from the forum into cache
   */
  private async loadExistingTopics(): Promise<void> {
    // Telegram doesn't have a direct API to list forum topics
    // We can only detect them when messages are sent or via getForumTopicIconStickers
    // For now, we rely on topic creation and caching

    // Note: In production, you might want to store topic IDs in persistent storage
    // and load them here. For this implementation, we rely on ensureTopic()
    // to create and cache topics as needed.
  }

  /**
   * Check if an error indicates the topic already exists
   */
  private isTopicExistsError(error: unknown): boolean {
    if (error instanceof GrammyError) {
      // Telegram returns specific error codes for duplicate topics
      return (
        error.description.includes('TOPIC_NOT_MODIFIED') ||
        error.description.includes('TOPIC_ID_INVALID')
      );
    }
    return false;
  }

  /**
   * Handle API errors with proper logging
   */
  private handleApiError(error: unknown, operation: string): void {
    let errorMessage: string;
    let errorCode: number | undefined;

    if (error instanceof GrammyError) {
      // Ensure we don't expose the bot token in error messages
      errorMessage = this.sanitizeErrorMessage(error.description);
      errorCode = error.error_code;
    } else if (error instanceof HttpError) {
      errorMessage = 'Network error communicating with Telegram';
    } else if (error instanceof Error) {
      errorMessage = this.sanitizeErrorMessage(error.message);
    } else {
      errorMessage = 'Unknown error';
    }

    // Emit system error event
    this.eventBus.emit('system:error', {
      error: new Error(`TopicManager.${operation}: ${errorMessage}`),
      context: `telegram:topic_manager:${operation}`,
    });

    // Log for debugging (without sensitive info)
    log.error({ operation, error: errorMessage, code: errorCode }, `${operation} failed`);
  }

  /**
   * Sanitize error messages to prevent token exposure
   */
  private sanitizeErrorMessage(message: string): string {
    // Remove any potential token patterns (bot tokens are ~46 chars)
    // Format: 123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
    return message.replace(/\d+:[A-Za-z0-9_-]{35,}/g, '[REDACTED_TOKEN]');
  }

  /**
   * Emit topic message sent event
   */
  private emitTopicMessageSent(
    topicName: TopicName,
    topicId: number,
    messageId: number
  ): void {
    // Use telegram:message_sent event type (existing in EventBus)
    this.eventBus.emit('telegram:message_sent', {
      chatId: this.groupChatId,
      type: 'text',
      timestamp: new Date().toISOString(),
    });

    // Also emit audit log
    this.eventBus.emit('audit:log', {
      action: 'telegram:topic_message_sent',
      agent: 'topic-manager',
      trustLevel: 'system',
      details: {
        topicName,
        topicId,
        messageId,
        groupChatId: this.groupChatId,
      },
    });
  }
}
