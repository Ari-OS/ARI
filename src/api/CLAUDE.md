# API Layer

REST API and WebSocket endpoints for ARI operations.

## Components

| Component | Purpose |
|-----------|---------|
| routes/ | Modular Fastify route plugins (15 route files) |
| ws.ts | WebSocket event broadcaster |
| index.ts | API initialization and exports |

Routes are split into modular files under `routes/`:

- `health.ts` — `/health`, `/version`, `/status`
- `messages.ts` — `/message`
- `cognitive.ts` — `/api/cognition/*`
- `governance.ts` — `/api/governance/*`
- `agents.ts` — `/api/agents/*`
- `memory.ts` — `/api/memory/*`
- `audit.ts` — `/api/audit/*`
- `budget.ts` — `/api/budget/*`
- `autonomous.ts` — `/api/autonomous/*`
- `alerts.ts` — `/api/alerts/*`
- `analytics.ts` — `/api/analytics/*`
- `approval-queue.ts` — `/api/approval-queue/*`
- `dashboard.ts` — `/api/dashboard/*`
- `metrics.ts` — `/api/metrics/*`
- `scheduler.ts` — `/api/scheduler/*`
- `subagents.ts` — `/api/subagents/*`
- `shared.ts` — Shared `ApiDependencies` type

## Endpoints

### System

- `GET /health` — Health check
- `GET /version` — Version info
- `POST /message` — Send message to ARI

### Cognitive (Layer 0)

- `GET /api/cognition/health` — Cognitive health status
- `GET /api/cognition/pillars` — Pillar health details
- `POST /api/cognition/logos/bayesian` — Bayesian belief update
- `POST /api/cognition/logos/expected-value` — Expected value calculation
- `POST /api/cognition/logos/kelly` — Kelly criterion sizing
- `POST /api/cognition/ethos/bias-detection` — Detect cognitive biases
- `POST /api/cognition/ethos/discipline-check` — Pre-decision discipline
- `POST /api/cognition/pathos/reframe` — CBT thought reframing
- `POST /api/cognition/pathos/wisdom` — Query wisdom traditions

### Governance

- `GET /api/governance/council` — Council status
- `POST /api/governance/proposal` — Submit proposal

### Autonomous

- `GET /api/autonomous/status` — Agent status
- `GET /api/autonomous/tasks` — Task queue

## WebSocket Events

```typescript
// Subscribe to events
ws.send(JSON.stringify({ type: 'subscribe', events: ['audit:*'] }));

// Receive events
ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
};
```

## Security

- Loopback-only binding (127.0.0.1)
- All requests pass through sanitizer
- Trust level propagated from gateway

Skills: `/ari-fastify-gateway`, `/ari-websocket-patterns`
