# Telegram Integration

ARI's Telegram integration for outbound notifications and forum-based messaging.

## Components

### TelegramSender
Direct message sender for sending notifications to the bot owner.

```typescript
import { TelegramSender } from './integrations/telegram';

const sender = new TelegramSender({
  enabled: true,
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  ownerChatId: Number(process.env.TELEGRAM_OWNER_USER_ID),
});

await sender.init();
await sender.send('Hello from ARI!');
```

### TelegramTopicManager
Forum topic manager for organizing messages in a Telegram group by category.

```typescript
import { TelegramTopicManager } from './integrations/telegram';

const topicManager = new TelegramTopicManager({
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  groupChatId: process.env.TELEGRAM_GROUP_CHAT_ID,
});

// Ensure all topics exist (creates missing ones)
await topicManager.ensureTopics();

// Send to specific topic
await topicManager.sendToTopic('morning_briefing', '🌅 Good morning! Here\'s your briefing...');
await topicManager.sendToTopic('market_intel', '📊 BTC: $45,234 (+2.3%)');
await topicManager.sendToTopic('system_health', '✅ All systems operational');
```

## Topic Categories

| Topic Key | Name | Icon | Purpose |
|-----------|------|------|---------|
| `morning_briefing` | 🌅 Morning Briefing | Yellow | Daily morning briefings |
| `market_intel` | 📊 Market Intel | Blue | Market monitoring updates |
| `content_pipeline` | ✍️ Content Pipeline | Purple | Content creation updates |
| `system_health` | ⚕️ System Health | Green | Health checks and alerts |
| `council_digest` | 🏛️ Council Digest | Red | Governance decisions |
| `project_proposals` | 💡 Project Proposals | Pink | New project ideas |
| `general` | 💬 General | Blue | Miscellaneous updates |

## Environment Variables

```bash
# Required for both components
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# For TelegramSender (DM to owner)
TELEGRAM_OWNER_USER_ID=123456789

# For TelegramTopicManager (group messaging)
TELEGRAM_GROUP_CHAT_ID=-1001234567890  # Negative for groups
```

## Setup

1. Create bot via [@BotFather](https://t.me/BotFather)
2. Get bot token
3. Get your user ID (use [@userinfobot](https://t.me/userinfobot))
4. Create a group, enable Topics in group settings
5. Add bot to group
6. Get group chat ID (forward message from group to [@userinfobot](https://t.me/userinfobot))

## Features

- Rate limiting (30 messages/hour by default)
- Message truncation (4096 char Telegram limit)
- Persistent topic IDs (survives restarts)
- Graceful error handling
- HTML/Markdown/MarkdownV2 formatting support
- Silent notifications option

## Integration Example

```typescript
// Example: Morning briefing service
import { TelegramTopicManager } from './integrations/telegram';

class MorningBriefingService {
  private topics: TelegramTopicManager;

  constructor() {
    this.topics = new TelegramTopicManager({
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      groupChatId: process.env.TELEGRAM_GROUP_CHAT_ID!,
    });
  }

  async init(): Promise<void> {
    await this.topics.ensureTopics();
  }

  async sendBriefing(content: string): Promise<void> {
    await this.topics.sendToTopic('morning_briefing', content, {
      parseMode: 'HTML',
      silent: false,
    });
  }
}
```

## Rate Limits

- Default: 30 messages per hour
- Rate limit window: 1 hour rolling
- Exceeded sends return `{ sent: false, reason: 'Rate limit exceeded' }`

## Persistence

Topic thread IDs are persisted to `~/.ari/telegram-topics.json`:

```json
{
  "version": 1,
  "groupChatId": "-1001234567890",
  "topics": {
    "morning_briefing": {
      "threadId": 123,
      "name": "🌅 Morning Briefing"
    }
  }
}
```

This ensures topics don't need to be recreated on daemon restarts.
