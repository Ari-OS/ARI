# Wiring Reference — Key Integration Points

## How the Briefing Pipeline Works

```
Scheduler (cron: 0 7 * * *)
  → calls handler 'morning_briefing'
  → agent.ts registers handler at line 751
  → calls BriefingGenerator.morningBriefing()
  → gets audit data, processes queue
  → builds BriefingContent
  → sends via NotificationManager.notify()
  → NotificationManager routes to configured channels
  → Telegram sender delivers message
```

## How to Add a New Scheduled Task

```typescript
// In scheduler.ts DEFAULT_TASKS array:
{
  id: 'my-new-task',
  name: 'My New Task',
  cron: '0 8 * * *',  // 8:00 AM daily
  handler: 'my_handler',
  enabled: true,
  essential: false,  // true = runs even in budget-reduce mode
},

// In agent.ts registerSchedulerHandlers():
this.scheduler.registerHandler('my_handler', async () => {
  // your logic here
});
```

## How to Route Output Through Telegram

```typescript
// Via NotificationManager:
await notificationManager.notify({
  category: 'daily',
  title: 'My Title',
  body: 'My message content',
  priority: 'normal',
});

// Via Telegram Sender directly:
import { TelegramSender } from '../integrations/telegram/sender.js';
const sender = new TelegramSender();
await sender.sendMessage('Message text');

// Via NotificationRouter (event-based):
eventBus.emit('notification:send', {
  title: 'Alert',
  body: 'Something happened',
  priority: 'high',
});
```

## Daemon Startup Sequence

```
1. Load .env from ~/.ari/.env
2. Initialize EventBus
3. Initialize Kernel (Sanitizer, Audit, Gateway)
4. Initialize AI (Orchestrator, ModelRegistry, CascadeRouter)
5. Initialize Agents (Core, Guardian, Planner, Executor, Memory)
6. Initialize Governance (Council, Arbiter, Overseer)
7. Initialize Scheduler
8. Start Telegram Bot
9. Initialize Autonomous Agent (which creates BriefingGenerator, NotificationManager)
10. Emit 'system:ready'
11. Begin scheduler poll loop
```

## EventBus Event Categories

| Namespace | Example | Purpose |
|-----------|---------|---------|
| system: | system:ready, system:health_check | System lifecycle |
| message: | message:received, message:processed | Chat messages |
| audit: | audit:entry_created | Audit trail |
| market: | market:snapshot_complete, market:price_alert | Market data |
| notification: | notification:send, notification:sent | Notifications |
| scheduler: | scheduler:task_run | Scheduled tasks |
| intelligence: | intelligence:scan_complete | Intelligence scanning |
