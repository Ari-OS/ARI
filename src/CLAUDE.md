# Source Directory Router

This is the main source directory for ARI. Quick navigation:

| Layer | Directory | Purpose |
|-------|-----------|---------|
| 0. Cognitive | `cognition/` | LOGOS/ETHOS/PATHOS reasoning frameworks |
| 1. Kernel | `kernel/` | Security boundary, types, event bus |
| 2. System | `system/` | Routing, storage, context loading |
| 3. Agents | `agents/` | Multi-agent coordination |
| 4. Governance | `governance/` | Council, arbiter, overseer, policy engine |
| 5. Ops | `ops/` | Daemon, health monitor, git sync |
| 6. CLI | `cli/` | User interface commands (24 commands) |

Additional directories:
- `ai/` — AIOrchestrator, model registry (20 models), value scorer, batch processor
- `autonomous/` — Proactive agent, scheduler (35 tasks), briefings, market monitor
- `execution/` — Tool registry, tool executor, model router
- `integrations/` — 21 external services (Notion, Telegram, Apple, GitHub, RSS, Weather, etc.)
- `plugins/` — Content engine, crypto, Pokemon TCG, Telegram bot, TTS
- `mcp/` — Model Context Protocol server
- `prompts/` — Prompt building utilities
- `observability/` — Metrics, alerts, cost tracking, execution history
- `api/` — REST routes (16 route files) and WebSocket server
- `channels/` — Communication channel abstraction (registry, router, bridge)
- `skills/` — Skill definitions (diagram generator)
- `e2e/` — End-to-end test runner and setup

## Quick Rules

1. **Layer imports**: Lower layers cannot import from higher
2. **EventBus**: All cross-layer communication via events
3. **Types**: Import from `kernel/types.js`
4. **Audit**: All state changes emit audit events

## Key Files

- `kernel/types.ts` — All Zod schemas
- `kernel/event-bus.ts` — Typed pub/sub
- `kernel/sanitizer.ts` — 41-pattern injection detection
- `agents/core.ts` — Message pipeline
- `ai/orchestrator.ts` — AI model routing and orchestration

See subdirectory CLAUDE.md files for layer-specific guidance.
