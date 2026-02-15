/**
 * ARI Telegram Forum Topic Manager
 *
 * Manages Telegram forum topics for routing different message types
 * to organized threads within a Telegram group.
 *
 * Uses the Telegram Bot API directly via fetch for group messaging.
 * Persists topic thread IDs to survive daemon restarts.
 *
 * Requires:
 * - TELEGRAM_BOT_TOKEN: Bot token from @BotFather
 * - TELEGRAM_GROUP_CHAT_ID: Numeric chat ID for the forum-enabled group
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TELEGRAM_API = 'https://api.telegram.org';
const PERSISTENCE_PATH = join(homedir(), '.ari', 'telegram-topics.json');

export type TopicKey =
  | 'morning_briefing'
  | 'market_intel'
  | 'content_pipeline'
  | 'system_health'
  | 'council_digest'
  | 'project_proposals'
  | 'general';

export interface TopicConfig {
  name: string;
  iconColor: number;
}

export interface TopicSendOptions {
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  silent?: boolean;
}

export interface TopicSendResult {
  sent: boolean;
  messageId?: number;
  reason: string;
}

interface TopicData {
  threadId: number;
  name: string;
}

interface PersistedTopics {
  version: number;
  groupChatId: string;
  topics: Record<string, TopicData>;
}

const TOPIC_CONFIGS: Record<TopicKey, TopicConfig> = {
  morning_briefing: { name: '🌅 Morning Briefing', iconColor: 0xFFD67E }, // Yellow
  market_intel: { name: '📊 Market Intel', iconColor: 0x6FB9F0 }, // Blue
  content_pipeline: { name: '✍️ Content Pipeline', iconColor: 0xCB86DB }, // Purple
  system_health: { name: '⚕️ System Health', iconColor: 0x8EEE98 }, // Green
  council_digest: { name: '🏛️ Council Digest', iconColor: 0xFB6F5F }, // Red
  project_proposals: { name: '💡 Project Proposals', iconColor: 0xFF93B2 }, // Pink
  general: { name: '💬 General', iconColor: 0x6FB9F0 }, // Blue
};

export class TelegramTopicManager {
  private botToken: string;
  private groupChatId: string;
  private topicThreadIds = new Map<TopicKey, number>();
  private sendHistory: { sentAt: number }[] = [];
  private rateLimitWindow = 60 * 60 * 1000; // 1 hour
  private maxPerHour = 30;

  constructor(config: { botToken: string; groupChatId: string }) {
    this.botToken = config.botToken;
    this.groupChatId = config.groupChatId;
  }

  /**
   * Check if properly configured
   */
  isConfigured(): boolean {
    return !!this.botToken && !!this.groupChatId;
  }

  /**
   * Ensure all required topics exist, creating missing ones
   */
  async ensureTopics(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('TopicManager not configured: missing botToken or groupChatId');
    }

    // Try loading persisted topic IDs first
    await this.loadPersistedTopics();

    // Create any missing topics
    const topicKeys = Object.keys(TOPIC_CONFIGS) as TopicKey[];
    for (const key of topicKeys) {
      if (!this.topicThreadIds.has(key)) {
        await this.createTopic(key);
      }
    }

    // Persist updated topic map
    await this.persistTopics();
  }

  /**
   * Send message to a specific topic thread
   */
  async sendToTopic(
    topicKey: TopicKey,
    message: string,
    options?: TopicSendOptions
  ): Promise<TopicSendResult> {
    if (!this.isConfigured()) {
      return { sent: false, reason: 'TopicManager not configured' };
    }

    const threadId = this.topicThreadIds.get(topicKey);
    if (!threadId) {
      return { sent: false, reason: `Topic ${topicKey} not found. Call ensureTopics() first.` };
    }

    // Check rate limit
    if (this.isRateLimited()) {
      return { sent: false, reason: 'Rate limit exceeded' };
    }

    // Truncate to Telegram's 4096 char limit
    const finalText = message.length > 4096 ? message.slice(0, 4093) + '...' : message;

    try {
      const url = `${TELEGRAM_API}/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.groupChatId,
          text: finalText,
          message_thread_id: threadId,
          parse_mode: options?.parseMode ?? 'HTML',
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
   * Get thread ID for a topic
   */
  getTopicThreadId(topicKey: TopicKey): number | undefined {
    return this.topicThreadIds.get(topicKey);
  }

  /**
   * Create a forum topic
   */
  private async createTopic(topicKey: TopicKey): Promise<void> {
    const config = TOPIC_CONFIGS[topicKey];

    try {
      const url = `${TELEGRAM_API}/bot${this.botToken}/createForumTopic`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.groupChatId,
          name: config.name,
          icon_color: config.iconColor,
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        result?: { message_thread_id: number };
        description?: string;
      };

      if (!data.ok) {
        // Gracefully handle case where forum topics aren't enabled
        if (data.description?.includes('forum')) {
          throw new Error('Group does not have forum topics enabled');
        }
        throw new Error(`Failed to create topic: ${data.description ?? 'Unknown error'}`);
      }

      if (data.result?.message_thread_id) {
        this.topicThreadIds.set(topicKey, data.result.message_thread_id);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create topic ${topicKey}: ${msg}`);
    }
  }

  /**
   * Load persisted topic IDs from disk
   */
  private async loadPersistedTopics(): Promise<void> {
    if (!existsSync(PERSISTENCE_PATH)) {
      return;
    }

    try {
      const content = await readFile(PERSISTENCE_PATH, 'utf-8');
      const data = JSON.parse(content) as PersistedTopics;

      // Only load if for same group
      if (data.groupChatId === this.groupChatId) {
        for (const [key, topicData] of Object.entries(data.topics)) {
          this.topicThreadIds.set(key as TopicKey, topicData.threadId);
        }
      }
    } catch {
      // Ignore errors, will create topics fresh
    }
  }

  /**
   * Persist topic IDs to disk
   */
  private async persistTopics(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = join(homedir(), '.ari');
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      const topics: Record<string, TopicData> = {};
      for (const [key, threadId] of this.topicThreadIds.entries()) {
        topics[key] = {
          threadId,
          name: TOPIC_CONFIGS[key].name,
        };
      }

      const data: PersistedTopics = {
        version: 1,
        groupChatId: this.groupChatId,
        topics,
      };

      await writeFile(PERSISTENCE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Non-critical failure, topics will be recreated on next run
    }
  }

  /**
   * Check if rate limited
   */
  private isRateLimited(): boolean {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    this.sendHistory = this.sendHistory.filter((h) => h.sentAt > windowStart);
    return this.sendHistory.length >= this.maxPerHour;
  }
}
