# Telegram Topic Manager Integration Guide

## Overview

The TelegramTopicManager enables ARI to send organized messages to a Telegram group using forum topics. This allows different types of updates (briefings, market intel, system health, etc.) to be routed to dedicated topic threads.

## Architecture

```
┌─────────────────────────────────────────────────┐
│ ARI Services                                     │
│ - MorningBriefingService                        │
│ - MarketMonitorService                          │
│ - SystemHealthMonitor                           │
│ - CouncilDigestService                          │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│ TelegramTopicManager                            │
│ - ensureTopics()                                │
│ - sendToTopic(key, message)                     │
│ - Rate limiting (30/hour)                       │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│ Telegram Bot API                                │
│ - createForumTopic                              │
│ - sendMessage (with message_thread_id)          │
└─────────────────────────────────────────────────┘
```

## Setup

### 1. Create Telegram Group with Topics

1. Create a new Telegram group
2. Go to Group Settings → Topics
3. Enable Topics
4. Add your bot to the group (via @BotFather)

### 2. Get Group Chat ID

```bash
# Forward a message from the group to @userinfobot
# It will show the group chat ID (negative number like -1001234567890)
```

### 3. Configure Environment

```bash
# Add to ~/.ari/.env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_GROUP_CHAT_ID=-1001234567890
```

## Integration Example: Morning Briefing Service

```typescript
// src/autonomous/briefing-generator.ts
import { TelegramTopicManager } from '../integrations/telegram/index.js';

export class BriefingGenerator {
  private topics: TelegramTopicManager;

  constructor() {
    this.topics = new TelegramTopicManager({
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      groupChatId: process.env.TELEGRAM_GROUP_CHAT_ID!,
    });
  }

  async init(): Promise<void> {
    // Ensure all forum topics exist
    if (this.topics.isConfigured()) {
      await this.topics.ensureTopics();
    }
  }

  async sendMorningBriefing(): Promise<void> {
    const briefing = await this.generateBriefing();

    await this.topics.sendToTopic('morning_briefing', briefing, {
      parseMode: 'HTML',
      silent: false,
    });
  }

  private async generateBriefing(): Promise<string> {
    // Generate briefing content
    return `
🌅 <b>Morning Briefing</b> - ${new Date().toLocaleDateString()}

<b>Today's Focus:</b>
• Review pending PRs
• Update project documentation
• Test new features

<b>System Status:</b>
✅ All systems operational
📊 Metrics within normal range

Have a productive day!
    `.trim();
  }
}
```

## Topic Categories Reference

| Topic Key | Best For |
|-----------|----------|
| `morning_briefing` | Daily morning briefings, day planning |
| `market_intel` | Market updates, price alerts, trading signals |
| `content_pipeline` | Blog posts, tweets, content creation updates |
| `system_health` | Health checks, alerts, performance metrics |
| `council_digest` | Governance decisions, policy updates |
| `project_proposals` | New feature ideas, enhancement requests |
| `general` | Miscellaneous updates, general notifications |

## Integration Points in ARI

### 1. Morning Briefing Service

```typescript
// In src/autonomous/proactive-agent.ts
import { TelegramTopicManager } from '../integrations/telegram/index.js';

class ProactiveAgent {
  private topics: TelegramTopicManager;

  async sendMorningBriefing() {
    const content = await this.generateBriefing();
    await this.topics.sendToTopic('morning_briefing', content);
  }
}
```

### 2. Market Monitoring

```typescript
// In a new market monitor service
class MarketMonitor {
  async sendPriceAlert(asset: string, price: number, change: number) {
    const message = `📊 ${asset}: $${price.toLocaleString()} (${change > 0 ? '+' : ''}${change.toFixed(2)}%)`;
    await this.topics.sendToTopic('market_intel', message);
  }
}
```

### 3. System Health Monitoring

```typescript
// In src/observability/metrics.ts
class SystemHealthMonitor {
  async sendHealthCheck() {
    const status = await this.checkHealth();
    const icon = status.healthy ? '✅' : '⚠️';
    const message = `${icon} System Health: ${status.message}`;
    await this.topics.sendToTopic('system_health', message);
  }
}
```

### 4. Council Governance

```typescript
// In src/governance/council.ts
class Council {
  async announceDecision(decision: string) {
    await this.topics.sendToTopic('council_digest', `🏛️ New Decision: ${decision}`);
  }
}
```

## Rate Limiting

The TopicManager enforces rate limits to prevent API abuse:

- **Limit**: 30 messages per hour
- **Window**: Rolling 1-hour window
- **Behavior**: Returns `{ sent: false, reason: 'Rate limit exceeded' }`

```typescript
const result = await topics.sendToTopic('general', 'Test');
if (!result.sent) {
  console.log('Failed to send:', result.reason);
}
```

## Persistence

Topic thread IDs are automatically persisted to `~/.ari/telegram-topics.json`:

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

This ensures:
- Topics don't need to be recreated on daemon restarts
- Consistent thread IDs across sessions
- Fast initialization (no API calls if topics already exist)

## Error Handling

The TopicManager handles errors gracefully:

```typescript
// Group doesn't have topics enabled
await topics.ensureTopics();
// Throws: "Group does not have forum topics enabled"

// Topic not found (forgot to call ensureTopics)
const result = await topics.sendToTopic('morning_briefing', 'Test');
// Returns: { sent: false, reason: "Topic morning_briefing not found. Call ensureTopics() first." }

// Network error
// Returns: { sent: false, reason: "Telegram send error: Network error" }
```

## Testing

Run the comprehensive test suite:

```bash
npm test -- tests/unit/integrations/telegram/topic-manager.test.ts
```

Tests cover:
- Topic creation via API
- Message sending with thread IDs
- Persistence (load/save)
- Configuration validation
- API error handling
- Rate limiting
- Network error handling
- Corrupted persistence file handling

## Next Steps

1. **Add to ProactiveAgent**: Integrate with existing autonomous agent
2. **Morning Briefing**: Connect BriefingGenerator to TopicManager
3. **Market Monitor**: Create market monitoring service
4. **System Health**: Add periodic health checks
5. **Council Integration**: Wire up governance decisions

## Security Notes

- Bot token is sensitive — store in environment variables only
- Group chat ID is less sensitive but should not be hardcoded
- Rate limiting prevents API abuse
- No user input is executed (all content is data, not commands)

## Files Created

| File | Purpose |
|------|---------|
| `src/integrations/telegram/topic-manager.ts` | Main implementation |
| `src/integrations/telegram/index.ts` | Updated exports |
| `src/integrations/telegram/README.md` | Integration documentation |
| `tests/unit/integrations/telegram/topic-manager.test.ts` | Comprehensive tests |
| `docs/telegram-topic-integration.md` | Integration guide (this file) |
