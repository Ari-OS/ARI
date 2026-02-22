import type {
  ChannelConfig,
  OutboundMessage,
  SendResult,
} from '../types.js';
import { BaseChannel } from './base.js';
import { createLogger } from '../../kernel/logger.js';

const logger = createLogger('telegram-channel');

/**
 * Telegram-specific configuration
 */
export interface TelegramConfig {
  /** Bot token from @BotFather */
  botToken: string;
  /** Allowed user IDs (for security) */
  allowedUsers?: string[];
  /** Webhook URL (for webhook mode) */
  webhookUrl?: string;
  /** Polling interval in ms (for polling mode) */
  pollInterval?: number;
  /** Parse mode for messages */
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

/**
 * Telegram API response types
 */
interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
    };
    date: number;
    text?: string;
    reply_to_message?: {
      message_id: number;
    };
  };
}

interface TelegramMessage {
  message_id: number;
}

/**
 * TelegramChannel
 *
 * Telegram bot channel adapter.
 * Supports both polling and webhook modes.
 */
export class TelegramChannel extends BaseChannel {
  private telegramConfig: TelegramConfig;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastUpdateId: number = 0;
  private apiBaseUrl: string;

  constructor(config: ChannelConfig, telegramConfig: TelegramConfig) {
    super({
      ...config,
      type: 'bidirectional',
      capabilities: {
        typingIndicator: true,
        reactions: false,
        attachments: true,
        replies: true,
        editing: true,
        deletion: true,
        readReceipts: false,
        maxMessageLength: 4096,
        supportedAttachments: ['image', 'audio', 'video', 'file'],
        ...config.capabilities,
      },
    });

    this.telegramConfig = telegramConfig;
    this.apiBaseUrl = `https://api.telegram.org/bot${telegramConfig.botToken}`;
  }

  /**
   * Connect to Telegram
   */
  async connect(): Promise<void> {
    if (!this.telegramConfig.botToken) {
      throw new Error('Telegram bot token is required');
    }

    // Verify bot token
    const me = await this.callApi<{ id: number; first_name: string; username: string }>('getMe');
    if (!me) {
      throw new Error('Failed to verify Telegram bot token');
    }

    this.setStatus('connected');

    // Start polling (webhook mode would be handled by external HTTP server)
    if (!this.telegramConfig.webhookUrl) {
      this.startPolling();
    }
  }

  /**
   * Disconnect from Telegram
   */
  async disconnect(): Promise<void> {
    this.stopPolling();
    this.setStatus('disconnected');
    return Promise.resolve();
  }

  /**
   * Send a message via Telegram
   */
  protected async doSend(message: OutboundMessage): Promise<SendResult> {
    const params: Record<string, unknown> = {
      chat_id: message.recipientId,
      text: message.content,
    };

    // Add parse mode
    if (this.telegramConfig.parseMode) {
      params.parse_mode = this.telegramConfig.parseMode;
    }

    // Add reply
    if (message.replyTo) {
      params.reply_to_message_id = parseInt(message.replyTo, 10);
    }

    // Add disable notification for low priority
    if (message.priority === 'lowest' || message.priority === 'low') {
      params.disable_notification = true;
    }

    const result = await this.callApi<TelegramMessage>('sendMessage', params);

    if (result) {
      return this.createSendResult(true, String(result.message_id));
    } else {
      return this.createSendResult(false, undefined, 'Failed to send message');
    }
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(chatId: string): Promise<void> {
    await this.callApi('sendChatAction', {
      chat_id: chatId,
      action: 'typing',
    });
  }

  /**
   * Edit a message
   */
  edit(_messageId: string, _newContent: string): boolean {
    // Need chat_id which we don't have from just messageId
    // This would need to be tracked separately in a real implementation
    return false;
  }

  /**
   * Delete a message
   */
  delete(_messageId: string): boolean {
    // Need chat_id which we don't have from just messageId
    return false;
  }

  /**
   * Call Telegram API
   */
  private async callApi<T>(method: string, params?: Record<string, unknown>): Promise<T | null> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: params ? JSON.stringify(params) : undefined,
      });

      const json = await response.json() as unknown;
      // Handle the case where the Telegram API returns a valid but empty/unexpected response structure
      if (!json) {
         logger.error({ description: 'Empty response body' }, 'Telegram API error');
         return null;
      }
      const data = json as TelegramResponse<T>;

      if (data.ok && data.result !== undefined) {
        return data.result;
      }

      logger.error({ description: data.description }, 'Telegram API error');
      return null;
    } catch (error) {
      logger.error({ err: error }, 'Telegram API call failed');
      return null;
    }
  }

  /**
   * Start polling for updates
   */
  private startPolling(): void {
    if (this.pollTimer) return;

    const interval = this.telegramConfig.pollInterval || 1000;

    this.pollTimer = setInterval(() => {
      void this.pollUpdates().catch((error: unknown) => {
        logger.error({ err: error }, 'Telegram poll error');
      });
    }, interval);

    // Initial poll
    void this.pollUpdates();
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Poll for updates
   */
  private async pollUpdates(): Promise<void> {
    const updates = await this.callApi<TelegramUpdate[]>('getUpdates', {
      offset: this.lastUpdateId + 1,
      timeout: 30,
    });

    // Ensure updates is a valid array before iterating
    if (!updates || !Array.isArray(updates)) return;

    for (const update of updates) {
      this.lastUpdateId = update.update_id;

      const msg = update.message;
      if (msg && msg.text) {
        const messageText: string = msg.text;

        // Check allowed users
        if (
          this.telegramConfig.allowedUsers &&
          !this.telegramConfig.allowedUsers.includes(String(msg.from?.id))
        ) {
          continue;
        }

        const senderId = msg.from?.id ? String(msg.from.id) : 'unknown';
        const inbound = this.createInboundMessage(
          messageText,
          senderId,
          {
            id: String(msg.message_id),
            senderName: msg.from
              ? `${msg.from.first_name}${msg.from.last_name ? ' ' + msg.from.last_name : ''}`
              : undefined,
            groupId: msg.chat.type !== 'private' ? String(msg.chat.id) : undefined,
            replyTo: msg.reply_to_message ? String(msg.reply_to_message.message_id) : undefined,
            metadata: {
              chatId: msg.chat.id,
              chatType: msg.chat.type,
              chatTitle: msg.chat.title,
              username: msg.from?.username,
              date: msg.date,
            },
          }
        );

        this.queueMessage(inbound);
      }
    }
  }

  /**
   * Handle webhook update
   */
  handleWebhookUpdate(update: TelegramUpdate): void {
    const msg = update.message;
    if (msg && msg.text) {
      const messageText: string = msg.text;

      // Check allowed users
      if (
        this.telegramConfig.allowedUsers &&
        msg.from?.id &&
        !this.telegramConfig.allowedUsers.includes(String(msg.from.id))
      ) {
        return;
      }

      const senderId = msg.from?.id ? String(msg.from.id) : 'unknown';
      const inbound = this.createInboundMessage(
        messageText,
        senderId,
        {
          id: String(msg.message_id),
          senderName: msg.from
            ? `${msg.from.first_name}${msg.from.last_name ? ' ' + msg.from.last_name : ''}`
            : undefined,
          groupId: msg.chat.type !== 'private' ? String(msg.chat.id) : undefined,
          replyTo: msg.reply_to_message ? String(msg.reply_to_message.message_id) : undefined,
          metadata: {
            chatId: msg.chat.id,
            chatType: msg.chat.type,
            chatTitle: msg.chat.title,
            username: msg.from?.username,
            date: msg.date,
          },
        }
      );

      this.queueMessage(inbound);
    }
  }
}

/**
 * Create a Telegram channel from configuration
 */
export function createTelegramChannel(
  config: ChannelConfig,
  telegramConfig: TelegramConfig
): TelegramChannel {
  return new TelegramChannel(config, telegramConfig);
}
