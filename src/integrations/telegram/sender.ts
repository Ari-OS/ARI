/**
 * ARI Telegram Notification Sender
 *
 * Lightweight sender for ARI's notification system.
 * Uses the Telegram Bot API directly via fetch — no Grammy dependency.
 * The TelegramBotPlugin handles bidirectional chat; this is strictly
 * for outbound notification delivery to the owner.
 *
 * Requires:
 * - TELEGRAM_BOT_TOKEN: Bot token from @BotFather
 * - TELEGRAM_OWNER_USER_ID: Numeric chat ID for the owner
 */

const TELEGRAM_API = 'https://api.telegram.org';

export interface TelegramSendResult {
  sent: boolean;
  reason: string;
  messageId?: number;
}

export interface TelegramSenderConfig {
  enabled: boolean;
  botToken?: string;
  ownerChatId?: number;
  maxPerHour?: number;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

export class TelegramSender {
  private config: Required<
    Pick<TelegramSenderConfig, 'enabled' | 'maxPerHour' | 'parseMode'>
  > & Pick<TelegramSenderConfig, 'botToken' | 'ownerChatId'>;
  private initialized = false;
  private sendHistory: { sentAt: number }[] = [];
  private rateLimitWindow = 60 * 60 * 1000; // 1 hour

  constructor(config: TelegramSenderConfig) {
    this.config = {
      enabled: config.enabled,
      botToken: config.botToken,
      ownerChatId: config.ownerChatId,
      maxPerHour: config.maxPerHour ?? 30,
      parseMode: config.parseMode ?? 'HTML',
    };
  }

  /**
   * Initialize and validate the bot token
   */
  async init(): Promise<boolean> {
    if (!this.config.enabled || !this.config.botToken || !this.config.ownerChatId) {
      return false;
    }

    try {
      const ok = await this.testConnection();
      this.initialized = ok;
      return ok;
    } catch {
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if sender is ready
   */
  isReady(): boolean {
    return this.initialized && !!this.config.botToken && !!this.config.ownerChatId;
  }

  /**
   * Send a message to the owner
   */
  async send(
    text: string,
    options?: { forceDelivery?: boolean; silent?: boolean }
  ): Promise<TelegramSendResult> {
    if (!this.isReady()) {
      return { sent: false, reason: 'Telegram not configured' };
    }

    const forceDelivery = options?.forceDelivery ?? false;

    // Check rate limit (unless forced)
    if (!forceDelivery && this.isRateLimited()) {
      return { sent: false, reason: 'Rate limit exceeded' };
    }

    // Truncate to Telegram's 4096 char limit
    const finalText = text.length > 4096 ? text.slice(0, 4093) + '...' : text;

    try {
      const url = `${TELEGRAM_API}/bot${this.config.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.ownerChatId,
          text: finalText,
          parse_mode: this.config.parseMode,
          disable_notification: options?.silent ?? false,
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        result?: { message_id: number };
        description?: string;
      };

      if (!data.ok) {
        return { sent: false, reason: `Telegram API error: ${data.description ?? 'Unknown'}` };
      }

      // Record in history
      this.sendHistory.push({ sentAt: Date.now() });

      return {
        sent: true,
        reason: 'Sent',
        messageId: data.result?.message_id,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { sent: false, reason: `Telegram send error: ${msg}` };
    }
  }

  /**
   * Check if rate limited
   */
  private isRateLimited(): boolean {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    this.sendHistory = this.sendHistory.filter((h) => h.sentAt > windowStart);
    return this.sendHistory.length >= this.config.maxPerHour;
  }

  /**
   * Test bot token validity via getMe
   */
  async testConnection(): Promise<boolean> {
    if (!this.config.botToken) return false;

    try {
      const url = `${TELEGRAM_API}/bot${this.config.botToken}/getMe`;
      const response = await fetch(url);
      const data = (await response.json()) as { ok: boolean };
      return data.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get current stats
   */
  getStats(): {
    sentThisHour: number;
    rateLimitRemaining: number;
  } {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    const recentSends = this.sendHistory.filter((h) => h.sentAt > windowStart);

    return {
      sentThisHour: recentSends.length,
      rateLimitRemaining: Math.max(0, this.config.maxPerHour - recentSends.length),
    };
  }
}
