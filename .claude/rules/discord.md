# Discord Architecture Rules

## Channel Routing

| Channel | Agent | Content |
|---------|-------|---------|
| #ari-main | ARI 🧠 | Briefings, ops, general |
| #ari-deep | ARI 🧠 | Deep mode (opus) — complex reasoning, thread-per-question |
| #market-alerts | PULSE 📡 | Crypto/stock signals + anomaly alerts |
| #pokemon-market | PULSE 📡 | Pokemon TCG price moves + set releases |
| #research-digest | DEX 🗂️ | Weekly AI paper summaries |
| #paytheprice-main | NOVA 🎬 | Content strategy, P1 general |
| #video-queue | ARI (on behalf of NOVA) | Approval queue — 48h TTL |
| #thumbnail-lab | NOVA 🎬 | 4 thumbnail variants for Pryce selection |
| #published | NOVA 🎬 | Record of uploads + performance |
| #leads | CHASE 🎯 | P2 leads + scoring summaries |
| #demo-factory | CHASE 🎯 | Demo artifacts + previews |
| #outreach-queue | ARI (on behalf of CHASE) | OPERATOR-ONLY outreach approval — 72h TTL |
| #wins | CHASE 🎯 | Closed deals + outcome feedback |
| #system-status | System | Heartbeat + P0 alerts only (bot-only) |
| #ops-dashboard | ARI 🧠 | Autopublished every 3h |
| #api-logs | System | Error logs, deployments (role-locked) |

## Approval Button Flow

1. ARI posts embed with: title, summary, confidence, evidence, ✅/❌ buttons
2. Pryce clicks ✅ → `POST /api/{pipeline}/jobs/{id}/approve`
3. Job state: `pending → approved → processing → completed`
4. Button TTL: 48h (video) | 72h (outreach)
5. Expired: buttons disabled, ⏱️ react, state = 'expired'

**CRITICAL**: Approval embeds are posted by ARI on behalf of NOVA/CHASE.
Never post directly from agent to #video-queue or #outreach-queue.

## Slash Commands

```
/ari-status          /ari-ops-queues    /ari-ops-dashboard
/ari-p1-run          /ari-p1-video      /ari-p1-queue  /ari-p1-approve
/ari-p2-scan         /ari-p2-top        /ari-p2-queue  /ari-p2-demo
/ari-p2-approve      /ari-p2-reject     /ari-p2-feedback <id> <outcome>
/ari-tasks           /ari-deep <question>
/ari-vault-ideas     /ari-vault-trace   /ari-vault-connect  /ari-vault-gaps
```

Discord global 200-command limit — deduplicate before registration.

## Message Format

- Max 2000 chars (hard limit)
- Miller's Law: ≤5 items per section
- Discord markdown: **bold**, _italic_, `code`, > blockquote
- Never embed raw pokemontcg.io card scan images (copyright)
- P0 alerts: always send regardless of quiet hours (22:00–06:00 ET)

## Bot Permissions Required

- Send Messages, Embed Links, Attach Files (for OGG voice briefings)
- Use Application Commands (slash commands)
- Read Message History (for approval button updates)
- Add Reactions (for expired TTL markers)
