/**
 * Example: Integrating TelegramTopicManager with NotificationManager
 *
 * This example shows how to route different notification categories
 * to appropriate Telegram forum topics for organized delivery.
 */

import { TelegramTopicManager } from '../../src/integrations/telegram/index.js';
import type { NotificationCategory } from '../../src/autonomous/notification-manager.js';
import type { TopicKey } from '../../src/integrations/telegram/index.js';

/**
 * Map notification categories to forum topics
 */
const CATEGORY_TO_TOPIC: Partial<Record<NotificationCategory, TopicKey>> = {
  // System and operational
  error: 'system_health',
  security: 'system_health',
  system: 'system_health',

  // Market and finance
  finance: 'market_intel',

  // Governance
  milestone: 'council_digest',

  // Content creation
  insight: 'content_pipeline',

  // Daily summaries
  daily: 'morning_briefing',

  // Opportunities and decisions
  opportunity: 'project_proposals',
  question: 'project_proposals',

  // Everything else
  reminder: 'general',
  task: 'general',
  budget: 'general',
  billing: 'general',
  value: 'general',
  adaptive: 'general',
};

/**
 * Enhanced NotificationManager with forum topic support
 */
export class TopicAwareNotificationManager {
  private topics: TelegramTopicManager;

  constructor() {
    this.topics = new TelegramTopicManager({
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      groupChatId: process.env.TELEGRAM_GROUP_CHAT_ID!,
    });
  }

  async init(): Promise<void> {
    if (this.topics.isConfigured()) {
      await this.topics.ensureTopics();
      console.log('✅ Telegram forum topics initialized');
    }
  }

  /**
   * Send notification to appropriate topic based on category
   */
  async notify(
    category: NotificationCategory,
    title: string,
    body: string
  ): Promise<void> {
    const topicKey = CATEGORY_TO_TOPIC[category] || 'general';

    const message = this.formatMessage(category, title, body);

    const result = await this.topics.sendToTopic(topicKey, message, {
      parseMode: 'HTML',
    });

    if (!result.sent) {
      console.error(`Failed to send to ${topicKey}:`, result.reason);
    }
  }

  /**
   * Format notification message with emoji and structure
   */
  private formatMessage(
    category: NotificationCategory,
    title: string,
    body: string
  ): string {
    const emoji = this.getCategoryEmoji(category);
    return `${emoji} <b>${title}</b>\n\n${body}`;
  }

  /**
   * Get emoji for notification category
   */
  private getCategoryEmoji(category: NotificationCategory): string {
    const emojis: Record<NotificationCategory, string> = {
      error: '🔴',
      security: '🛡️',
      opportunity: '💎',
      milestone: '🎯',
      insight: '💡',
      question: '❓',
      reminder: '⏰',
      finance: '💰',
      task: '✅',
      system: '⚙️',
      daily: '📊',
      budget: '💵',
      billing: '🧾',
      value: '📈',
      adaptive: '🧠',
    };
    return emojis[category] || '📌';
  }
}

/**
 * Example usage scenarios
 */
export async function exampleUsage(): Promise<void> {
  const manager = new TopicAwareNotificationManager();
  await manager.init();

  // 1. Morning briefing
  await manager.notify(
    'daily',
    'Morning Briefing',
    `
<b>Today's Focus:</b>
• Review pending PRs
• Complete feature X implementation
• Update documentation

<b>System Status:</b>
✅ All systems operational
📊 API usage: 23% of daily budget

<b>Market Summary:</b>
BTC: $45,234 (+2.3%)
ETH: $2,456 (+1.8%)
    `.trim()
  );

  // 2. Market intel
  await manager.notify(
    'finance',
    'Price Alert',
    'BTC crossed $45,000 resistance. Consider taking profit on position #123.'
  );

  // 3. System health
  await manager.notify(
    'error',
    'Database Connection Lost',
    'Lost connection to Notion API. Retrying with exponential backoff...'
  );

  // 4. Opportunity alert
  await manager.notify(
    'opportunity',
    'High-Value Task Available',
    'Estimated value: $250/hr. Task: "Implement OAuth integration". Act within 24h.'
  );

  // 5. Council decision
  await manager.notify(
    'milestone',
    'Governance Decision',
    'Council voted to approve autonomous trading up to $100/trade. Trust level: VERIFIED.'
  );

  // 6. Content pipeline
  await manager.notify(
    'insight',
    'Learning Captured',
    'Pattern identified: ESLint async rules require explicit Promise handling. Added to knowledge base.'
  );

  // 7. General notification
  await manager.notify(
    'task',
    'Task Completed',
    'Successfully deployed v2.1.0 to production. All health checks passing.'
  );
}

/**
 * Example: Time-based routing (send to different topics based on time)
 */
export class TimeAwareTopicRouter {
  private topics: TelegramTopicManager;

  constructor(topics: TelegramTopicManager) {
    this.topics = topics;
  }

  async routeByTime(message: string): Promise<void> {
    const hour = new Date().getHours();

    // Morning briefing time (6-8 AM)
    if (hour >= 6 && hour < 8) {
      await this.topics.sendToTopic('morning_briefing', message);
    }
    // Market hours (9 AM - 4 PM)
    else if (hour >= 9 && hour < 16) {
      await this.topics.sendToTopic('market_intel', message);
    }
    // Evening hours (6-10 PM)
    else if (hour >= 18 && hour < 22) {
      await this.topics.sendToTopic('content_pipeline', message);
    }
    // All other times
    else {
      await this.topics.sendToTopic('general', message);
    }
  }
}

/**
 * Example: Batch notifications to reduce noise
 */
export class BatchedTopicNotifier {
  private topics: TelegramTopicManager;
  private batches = new Map<TopicKey, string[]>();
  private flushInterval = 15 * 60 * 1000; // 15 minutes

  constructor(topics: TelegramTopicManager) {
    this.topics = topics;
    this.startFlushTimer();
  }

  /**
   * Add message to batch
   */
  add(topicKey: TopicKey, message: string): void {
    if (!this.batches.has(topicKey)) {
      this.batches.set(topicKey, []);
    }
    this.batches.get(topicKey)!.push(message);
  }

  /**
   * Flush all batched messages
   */
  async flush(): Promise<void> {
    for (const [topicKey, messages] of this.batches.entries()) {
      if (messages.length === 0) continue;

      const batchMessage = `
<b>Batch Update (${messages.length} items)</b>

${messages.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}
      `.trim();

      await this.topics.sendToTopic(topicKey, batchMessage);
    }

    this.batches.clear();
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    setInterval(() => {
      void this.flush();
    }, this.flushInterval);
  }
}

/**
 * Example: Priority-based topic routing
 */
export class PriorityTopicRouter {
  private topics: TelegramTopicManager;

  constructor(topics: TelegramTopicManager) {
    this.topics = topics;
  }

  async route(
    message: string,
    priority: 'critical' | 'high' | 'normal' | 'low'
  ): Promise<void> {
    switch (priority) {
      case 'critical':
        // Critical goes to system health for immediate visibility
        await this.topics.sendToTopic('system_health', `🚨 CRITICAL: ${message}`);
        break;
      case 'high':
        // High priority to council digest
        await this.topics.sendToTopic('council_digest', `⚠️ ${message}`);
        break;
      case 'normal':
        // Normal to general
        await this.topics.sendToTopic('general', message);
        break;
      case 'low':
        // Low priority batched (would use BatchedTopicNotifier)
        await this.topics.sendToTopic('general', `ℹ️ ${message}`);
        break;
    }
  }
}
