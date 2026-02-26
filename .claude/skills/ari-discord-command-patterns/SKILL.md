---
name: ari-discord-command-patterns
description: Discord slash commands, approval routing, channel policy, button interaction patterns for OpenClaw/ARI Discord integration
triggers: ["discord", "slash command", "approval button", "channel routing", "outreach-queue", "video-queue", "thumbnail-lab", "discord embed", "ari-status"]
---

# ARI Discord Command Patterns

## Channel Routing Policy

| Agent | Primary Channel | Secondary | Post Type |
|-------|----------------|-----------|-----------|
| ARI 🧠 | #ari-main | #ari-deep (opus mode) | Briefings, ops, general |
| NOVA 🎬 | #paytheprice-main | #video-queue, #thumbnail-lab | Content strategy, video packages |
| CHASE 🎯 | #leads | #demo-factory, #outreach-queue | Lead summaries, demos, outreach |
| PULSE 📡 | #market-alerts | #pokemon-market | Market snapshots, threshold alerts |
| DEX 🗂️ | #research-digest | (background) | Weekly AI digest |
| SYSTEM | #system-status | #ops-dashboard | Health, P0 alerts, 3h dashboard |

**15 channels in 6 categories:**
- 🧠 ARI CORE: #ari-main, #ari-deep
- 📊 MARKET INTELLIGENCE: #market-alerts, #pokemon-market, #research-digest
- 🎮 PAYTHEPRICE: #paytheprice-main, #video-queue, #thumbnail-lab, #published
- 💼 PRYCELESS SOLUTIONS: #leads, #demo-factory, #outreach-queue, #wins
- ⚙️ SYSTEM OPS: #system-status, #ops-dashboard
- 🔒 ADMIN: #api-logs

## Approval Button Flow (ADR-014)

### P1 Video Approval (#video-queue — 48h TTL)
```typescript
// Post embed when VideoOutputPackage is ready
interface VideoApprovalEmbed {
  title: 'Job {id} — Video Ready for Review';
  fields: [
    { name: 'Agent', value: 'NOVA 🎬' },
    { name: 'Card', value: cardName },
    { name: 'Confidence', value: `${confidence}%` },
    { name: 'Script Preview', value: hookLine },
    { name: 'Duration', value: `${duration}s` },
    { name: 'Expires', value: '<t:{unix}:R>' },  // Discord relative timestamp
  ];
  components: [
    {
      type: 'ACTION_ROW',
      components: [
        { type: 'BUTTON', custom_id: `approve_video_${jobId}`, label: '✅ Approve', style: 'SUCCESS' },
        { type: 'BUTTON', custom_id: `reject_video_${jobId}`,  label: '❌ Reject',  style: 'DANGER'  },
      ],
    },
  ];
}

// Handler (ari-autonomous plugin)
api.on('discord:interaction', (event) => {
  const { custom_id, user_id } = event;
  if (custom_id.startsWith('approve_video_')) {
    const jobId = custom_id.replace('approve_video_', '');
    await approveJob('pokemon-tcg', jobId, user_id);
  }
  if (custom_id.startsWith('reject_video_')) {
    const jobId = custom_id.replace('reject_video_', '');
    await rejectJob('pokemon-tcg', jobId, user_id);
  }
});
```

### P2 Outreach Approval (#outreach-queue — 72h TTL, OPERATOR-ONLY)
```typescript
// outreach-queue is operator-only — must be role-locked
interface OutreachApprovalEmbed {
  title: 'Outreach Ready — {businessName}';
  fields: [
    { name: 'Agent', value: 'CHASE 🎯' },
    { name: 'Vertical', value: vertical },
    { name: 'Score', value: `${score}/100 (${tier})` },
    { name: 'Bundle ID', value: bundleId },
    { name: 'Bundle Expires', value: '<t:{unix}:R>' },
    { name: 'First Line', value: firstLine },  // Opening of outreach draft
    { name: 'Approval TTL', value: '72h from now' },
  ];
  // Same button pattern, 72h TTL enforced
}
```

### Thumbnail Selection (#thumbnail-lab)
```typescript
// Post all 4 variants as attachments
interface ThumbnailLabEmbed {
  title: '4 Thumbnail Variants — {cardName}';
  description: 'Reply **A**, **B**, **C**, or **D** to select. Or react 🇦 🇧 🇨 🇩.';
  attachments: [variantA.jpg, variantB.jpg, variantC.jpg, variantD.jpg];
  fields: [
    { name: 'A', value: 'Ideogram Design (price-focused)' },
    { name: 'B', value: 'Ideogram Realistic (card aesthetic)' },
    { name: 'C', value: 'DALL-E 3 Standard (clean text)' },
    { name: 'D', value: 'DALL-E 3 HD Wide (1792×1024)' },
    { name: 'Job ID', value: jobId },
  ];
}

// Selection handler: listen for message reply OR reaction in #thumbnail-lab
// Record: jobs.selected_thumbnail_variant = 'A'|'B'|'C'|'D'
```

### TTL Expiry Handler
```typescript
// Background task in ari-scheduler: every 1h
async function expireStaleApprovals(): Promise<void> {
  const stale = await db.all(`
    SELECT id, pipeline, discord_message_id
    FROM jobs
    WHERE state = 'pending' AND expires_at < datetime('now')
  `);

  for (const job of stale) {
    await db.run(`UPDATE jobs SET state = 'expired' WHERE id = ?`, job.id);
    // Disable Discord buttons by editing the message
    await discordClient.editMessage(job.discord_message_id, {
      content: '⏱️ Approval window expired — no action taken.',
      components: [],  // Remove all buttons
    });
  }

  // Alert if 3+ expire in same hour
  if (stale.length >= 3) {
    await discordClient.post('#system-status', `⚠️ ${stale.length} jobs expired in last hour`);
  }
}
```

## Slash Commands (All 16)

```typescript
// Status commands
'/ari-status'           → ARI: All-green system health check → #ari-main
'/ari-ops-queues'       → ARI: Current pending/processing counts → #ari-main
'/ari-ops-sla'          → ARI: SLA compliance report → #ari-main
'/ari-ops-dashboard'    → ARI: Full 3h dashboard → #ops-dashboard

// P1 commands
'/ari-p1-run'           → NOVA: Trigger manual P1 pipeline run
'/ari-p1-video'         → NOVA: Show current video job status
'/ari-p1-queue'         → ARI: Show #video-queue contents + TTLs
'/ari-p1-approve {id}'  → ARI: Manual approval (if button missed)

// P2 commands
'/ari-p2-scan'           → CHASE: Trigger manual lead discovery scan
'/ari-p2-top'            → CHASE: Show top 5 qualified leads
'/ari-p2-queue'          → ARI: Show #outreach-queue contents
'/ari-p2-demo'           → CHASE: Show latest demo artifact
'/ari-p2-approve {id}'   → ARI: Manual outreach approval (operator-only)
'/ari-p2-reject {id}'    → ARI: Manual rejection
'/ari-p2-feedback {id} {outcome}' → CHASE: Log lead outcome for learning loop

// General commands
'/ari-tasks'             → ARI: Current task queue across all agents
'/ari-deep {question}'   → ARI (opus mode): Deep reasoning, posts to #ari-deep
```

**Discord global 200-command limit:** Deduplicate before registration. Register on startup via `api.once('ready')`.

## Channel Policy Enforcement

```typescript
// Route-by-channel enforcement in ari-autonomous plugin
const CHANNEL_PERMISSIONS: Record<string, 'public' | 'operator-only' | 'bot-only'> = {
  '#outreach-queue':  'operator-only',   // Only Pryce can see outreach
  '#system-status':   'bot-only',        // No conversation, alerts only
  '#api-logs':        'operator-only',   // Dev/admin only
};

// Post routing helpers
async function postToChannel(
  channel: string,
  content: DiscordEmbed,
): Promise<string> {
  // Returns discord_message_id for later reference
  const policy = CHANNEL_PERMISSIONS[channel];
  if (policy === 'operator-only') {
    // Verify caller has Operator role before posting
    await assertOperatorRole(content.requestedBy);
  }
  return discordClient.post(channel, content);
}
```

## Ops Dashboard (autopublished every 3h)

```
📊 ARI OPERATIONS DASHBOARD — {timestamp}

🎬 P1 PAYTHEPRICE
  Queue: {n} videos pending approval
  Last published: {timeAgo}
  NOVA confidence: {avg}%
  This week: {n} packages → {n} published

🎯 P2 PRYCELESS SOLUTIONS
  Queue: {n} outreach pending approval
  Leads this week: {discovered} discovered → {audited} audited → {qualified} qualified
  Hot leads: {n} ≥75
  Bundle expiry warnings: {n}

📡 PULSE STATUS
  Last snapshot: {timeAgo}
  Alerts today: {n}
  Thresholds hit: {list or 'none'}

🔧 SYSTEM HEALTH
  Uptime: {duration}
  API spend this week: ${amount}
  Last briefing: {timeAgo}
  Next briefing: {timestamp}
  Errors (24h): {n}
```

## EventBus Integration

```typescript
// Emit when approval received
api.emit('approval:decision', {
  jobId,
  approved: true,
  reviewer: 'pryce',
  pipeline: 'pokemon-tcg',
  timestamp: new Date().toISOString(),
});

// Emit when approval expires
api.emit('approval:expired', {
  jobId,
  pipeline: 'pryceless',
  expiredAt: new Date().toISOString(),
});
```

## Environment Variables

```
DISCORD_TOKEN         # Bot token (never expose in logs)
DISCORD_GUILD_ID      # Server ID for slash command registration
DISCORD_CHANNEL_IDS   # JSON map of channel names to IDs
ARI_API_KEY           # Internal auth for pipeline requests (x-ari-token)
```
