# Notification Configuration Guide

How to configure ARI's multi-channel notification system.

## Overview

ARI routes notifications through three channels based on priority, time of day, and urgency:

- **Telegram** — Primary real-time notifications (rich formatting, 4096 char limit)
- **SMS** — Emergency backup for P0 critical alerts only
- **Notion** — Persistent record-keeping for all priorities

```
┌─────────────────────────────────────────────────────────────────┐
│                  NOTIFICATION FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Event Occurs                                                  │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────────┐                                          │
│   │ Priority Rating │                                          │
│   │   P0 → P4       │                                          │
│   └────────┬────────┘                                          │
│            │                                                    │
│   ┌────────┴────────────────────────────────┐                  │
│   │        │        │        │              │                  │
│   P0       P1       P2       P3             P4                 │
│   │        │        │        │              │                  │
│   ▼        ▼        ▼        ▼              ▼                  │
│  SMS +   Telegram  Telegram  Batched     Suppressed            │
│ Telegram + Notion  + Notion  to Notion                         │
│ + Notion   │      (silent)   at 7 AM                           │
│   │     Work hrs  Work hrs    │                                │
│   │      only     only        │                                │
│   │                                                             │
│   └─────► Bypasses quiet hours                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Setup

### 1. Telegram Bot (Primary)

Telegram is ARI's primary notification channel. Set up a bot via @BotFather.

```bash
# Set environment variables
export TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."       # From @BotFather
export TELEGRAM_OWNER_USER_ID="123456789"            # Your numeric user ID
```

**Get your user ID:**

1. Message @userinfobot on Telegram
2. It replies with your numeric ID
3. Set as `TELEGRAM_OWNER_USER_ID`

**Create a bot:**

1. Message @BotFather on Telegram
2. Send `/newbot` and follow prompts
3. Copy the bot token
4. Message your new bot (required to start receiving messages)

### 2. SMS via Gmail (Emergency Backup)

SMS is only used for P0 critical alerts as a backup to Telegram. Uses Gmail SMTP to carrier gateways.

```bash
export GMAIL_USER="your.email@gmail.com"
export GMAIL_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # 16-character app password
export PHONE_NUMBER="1234567890"                  # Your phone number
export CARRIER_GATEWAY="vtext.com"                # See carrier list below
```

**Create Gmail App Password:**

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Factor Authentication
3. Go to App Passwords
4. Generate password for "Mail" on "Other"
5. Copy the 16-character password

**Carrier Gateways:**

| Carrier | Gateway |
|---------|---------|
| Verizon | vtext.com |
| AT&T | txt.att.net |
| T-Mobile | tmomail.net |
| Sprint | messaging.sprintpcs.com |
| US Cellular | email.uscc.net |
| Cricket | sms.cricketwireless.net |
| Boost | sms.myboostmobile.com |

### 3. Notion Integration (Record-Keeping)

Creates pages in your Notion inbox for all notification records.

```bash
# Get your API key from https://www.notion.so/my-integrations
export NOTION_API_KEY="secret_xxxxxxxxxxxxxxxxxxxxx"

# Get database ID from your Notion inbox database URL
# https://notion.so/yourworkspace/{database_id}?v=...
export NOTION_INBOX_DB_ID="your-database-id"
```

**Notion Setup:**

1. Create a database called "ARI Inbox"
2. Add properties: Title (title), Priority (select), Category (select), Status (select)
3. Share with your integration

### 4. Dashboard Notifications

Built-in, no configuration required. Shows alerts in the web dashboard.

```
http://127.0.0.1:3141
```

## Priority System

| Priority | Name | Channels | Behavior |
|----------|------|----------|----------|
| **P0** | Critical | SMS + Telegram + Notion | Immediate, bypasses quiet hours |
| **P1** | High | Telegram + Notion | Work hours only, queued otherwise |
| **P2** | Normal | Telegram (silent) + Notion | Work hours only |
| **P3** | Low | Notion (batched) | Delivered at 7 AM |
| **P4** | Silent | None | Logged only, no notification |

### When Each Priority Is Used

**P0 - Critical:**

- Security violations detected
- Audit chain tampering
- System health failures

**P1 - High:**

- E2E test failures (2+ consecutive)
- Budget critical (90%+ used)
- Important reminders

**P2 - Normal:**

- Morning briefing ready
- Evening summary ready
- Task completions

**P3 - Low:**

- Knowledge index updates
- Learning insights
- Non-urgent system info

**P4 - Silent:**

- Debug information
- Telemetry events
- Internal logging

## Quiet Hours

Notifications (except P0) are held during quiet hours:

- **Default quiet hours:** 10 PM - 7 AM (Indiana time)
- **P0 alerts:** Always delivered immediately via SMS + Telegram + Notion
- **P1-P3 alerts:** Queued and delivered at 7 AM via Telegram

### Configure Quiet Hours

```typescript
// In your ARI config (~/.ari/config.json)
{
  "notifications": {
    "quietHoursStart": 22,  // 10 PM (24-hour format)
    "quietHoursEnd": 7,     // 7 AM
    "timezone": "America/Indiana/Indianapolis"
  }
}
```

## Throttling

Prevents notification spam:

| Priority | Max per hour | Max per day |
|----------|--------------|-------------|
| P0 | Unlimited | Unlimited |
| P1 | 10 | 50 |
| P2 | 20 | 100 |
| P3 | 5 (batched) | 20 |

Telegram sender has its own rate limit of 30 messages/hour (configurable).

## Testing Notifications

### Via CLI

```bash
# Test Telegram
npx ari notify test --channel telegram

# Test SMS
npx ari notify test --channel sms

# Test Notion
npx ari notify test --channel notion

# Test specific priority
npx ari notify test --priority P1 --message "Test notification"
```

### Via Dashboard

1. Open dashboard at <http://127.0.0.1:3141>
2. Click the notification bell icon
3. Click "Test Notification"

### Via API (Dev Only)

```bash
curl -X POST http://127.0.0.1:3141/api/alerts/test
```

## Troubleshooting

### Telegram Not Delivering

1. **Verify bot token** - Must be from @BotFather
2. **Check owner user ID** - Must be numeric, from @userinfobot
3. **Message the bot first** - You must /start the bot before it can message you
4. **Test connection:**

   ```bash
   npx ari doctor --check telegram
   ```

### SMS Not Arriving

1. **Check carrier gateway spelling** - Must match exactly
2. **Verify Gmail app password** - Not your regular password
3. **Check spam folder** - SMS from email may be filtered
4. **Test SMTP connection:**

   ```bash
   npx ari doctor --check smtp
   ```

### Notion Pages Not Created

1. **Verify API key** - Must start with `secret_`
2. **Check database sharing** - Integration must have access
3. **Verify database ID** - From URL, not page title
4. **Test connection:**

   ```bash
   npx ari doctor --check notion
   ```

### Too Many Notifications

1. **Increase throttle limits** in config
2. **Batch more with P3** priority
3. **Use quiet hours** for non-urgent items
4. **Review alert rules** - Some may be too sensitive

### Missing Notifications

1. **Check priority** - P4 is suppressed
2. **Check quiet hours** - May be held until morning
3. **Check throttle** - May have hit hourly limit
4. **Check logs:**

   ```bash
   tail -f ~/.ari/logs/notifications.log
   ```

## Advanced Configuration

### Custom Channel Routing

Override default routing for specific categories:

```json
{
  "notifications": {
    "categoryOverrides": {
      "security": {
        "channels": ["sms", "telegram", "notion", "dashboard"],
        "minPriority": "P0"
      },
      "learning": {
        "channels": ["notion"],
        "maxPriority": "P3"
      }
    }
  }
}
```

### Webhook Integration

Send notifications to a custom webhook:

```json
{
  "notifications": {
    "webhooks": [
      {
        "url": "https://your-service.com/webhook",
        "events": ["alert:created", "e2e:run_complete"],
        "headers": {
          "Authorization": "Bearer your-token"
        }
      }
    ]
  }
}
```

### Notification Templates

Customize message format:

```json
{
  "notifications": {
    "templates": {
      "telegram": {
        "maxLength": 4096,
        "parseMode": "HTML",
        "format": "<b>{title}</b>\n{message}"
      },
      "sms": {
        "maxLength": 160,
        "format": "[ARI {priority}] {title}: {message}"
      },
      "notion": {
        "includeDetails": true,
        "includeTimestamp": true
      }
    }
  }
}
```

## Dashboard Alert Management

### Alert Banner

- Shows P0/P1 alerts at top of dashboard
- Click "Acknowledge" to dismiss
- Multiple alerts rotate automatically

### Notification Bell

- Shows unread count as badge
- Click to see recent alerts
- Filter by priority or category
- "Mark all read" for bulk acknowledge

### Alert Center

- Full history of all alerts
- Search and filter
- Export to CSV
- Bulk actions

## Categories

Alerts are categorized for better organization:

| Category | Icon | Description |
|----------|------|-------------|
| `security` | `shield` | Security violations, threats |
| `system` | `server` | System health, gateway status |
| `budget` | `wallet` | Cost alerts, spending thresholds |
| `performance` | `activity` | Response times, memory usage |
| `learning` | `brain` | Spaced repetition, insights |
| `e2e` | `check-circle` | Test failures, regressions |
| `self-improvement` | `trending-up` | Improvement suggestions |

## Best Practices

1. **Use P0 sparingly** - Only for true emergencies (triggers SMS + Telegram)
2. **Batch low-priority** - Use P3 for non-urgent items
3. **Test before production** - Verify Telegram bot connection works
4. **Review weekly** - Check alert patterns
5. **Acknowledge promptly** - Keep alert count low
6. **Use categories** - Helps filtering and routing

## Related Commands

```bash
# Check notification status
npx ari status --notifications

# View pending notifications
npx ari notify pending

# Clear notification queue
npx ari notify clear --priority P3

# Show notification history
npx ari notify history --limit 50
```
