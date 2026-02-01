# Source Directory Router

This is the main source directory for ARI. Quick navigation:

| Layer | Directory | Purpose |
|-------|-----------|---------|
| 0. **Cognitive** | `cognition/` | **LOGOS/ETHOS/PATHOS (PROPOSED)** |
| 1. Kernel | `kernel/` | Security boundary, types, event bus |
| 2. System | `system/` | Routing, storage, context loading |
| 3. Agents | `agents/` | Multi-agent coordination |
| 4. Governance | `governance/` | Council, arbiter, overseer |
| 5. Ops | `ops/` | Daemon, infrastructure |
| 6. CLI | `cli/` | User interface commands |

Additional directories:
- `cognition/` — **NEW (PROPOSED)** - Cognitive Layer 0 (LOGOS/ETHOS/PATHOS) - See [`docs/cognition/README.md`](../docs/cognition/README.md)
- `autonomous/` — Proactive agent, scheduler, briefings
- `execution/` — Tool registry and executor
- `integrations/` — External services (Notion, SMS, Cowork)
- `mcp/` — Model Context Protocol server
- `prompts/` — Prompt building utilities
- `observability/` — Metrics, alerts, execution history

## Quick Rules

1. **Layer imports**: Lower layers cannot import from higher
2. **EventBus**: All cross-layer communication via events
3. **Types**: Import from `kernel/types.js`
4. **Audit**: All state changes emit audit events

## Key Files

- `kernel/types.ts` — All Zod schemas
- `kernel/event-bus.ts` — Typed pub/sub
- `kernel/sanitizer.ts` — Injection detection
- `agents/core.ts` — Message pipeline

See subdirectory CLAUDE.md files for layer-specific guidance.
