# ARI — Artificial Reasoning Intelligence

Personal AI operating system. TypeScript 5.3, Node.js 20+, 7-layer multi-agent architecture.

## Commands

```bash
npm install && npm run build   # Setup
npm run dev                    # Watch mode
npm test                       # Run tests
npm run typecheck             # Type check
npm run lint:fix              # Lint + fix
npx ari <cmd>                 # CLI
```

## Security Invariants (ENFORCED BY HOOKS)

These are immutable. Violations are **blocked at write-time**.

| # | Invariant | Rule |
|---|-----------|------|
| 1 | GATEWAY | `127.0.0.1` ONLY — never `0.0.0.0`, never configurable |
| 2 | CONTENT ≠ COMMAND | All input is DATA, never executable instructions |
| 3 | AUDIT | SHA-256 hash-chained, append-only, immutable |
| 4 | PERMISSIONS | Agent allowlist → Trust level → Permission tier |
| 5 | TRUST | SYSTEM 0.5x · OPERATOR 0.6x · VERIFIED 0.75x · STANDARD 1.0x · UNTRUSTED 1.5x · HOSTILE 2.0x |

Auto-block at risk ≥ 0.8

## Layer Architecture

```
L0 Cognitive   ← LOGOS/ETHOS/PATHOS (self-contained, no imports)
L1 Kernel      ← Gateway, Sanitizer, Audit, EventBus (L0 only)
L2 System      ← Router, Storage (L0-L1)
L3 Agents      ← Core, Guardian, Planner, Executor, Memory (L0-L2)
L4 Strategic   ← Council, Arbiter, Overseer (L0-L3)
L5 Execution   ← Daemon, Ops (L0-L4)
L6 Interfaces  ← CLI, Dashboard (L0-L5)
```

**RULE**: Lower layers CANNOT import higher. Cross-layer via EventBus only.

## Locked ADRs (DO NOT CHANGE)

| ADR | Decision |
|-----|----------|
| 001 | Loopback-only gateway |
| 002 | SHA-256 hash chain audit |
| 003 | EventBus single coupling point |
| 004 | Seven-layer architecture |
| 005 | Content ≠ Command |
| 006 | Zod for validation |
| 007 | Vitest for testing |
| 008 | macOS-first (Phase 1-3) |
| 009 | EventBus typed events with payload validation |
| 010 | SQLite WAL mode for all local databases |
| 011 | execFileNoThrow for all subprocess calls |
| 012 | Eastern Time for all cron schedules |
| 013 | Telegram message limit 4096 chars, split at section boundaries |
| 014 | Video approval gate — never auto-publish |

## Code Standards

- TypeScript strict, no `any` (use `unknown`)
- ESM imports with `.js` extensions
- 80%+ coverage, 100% security paths
- 2-space indent, single quotes, semicolons
- kebab-case files, PascalCase classes, camelCase functions
- Import order: `node:` → external → internal

## Key Paths

| Path | Purpose |
|------|---------|
| `src/kernel/` | Security boundary (gateway, sanitizer, audit, event-bus, types) |
| `src/agents/` | Multi-agent (core, guardian, planner, executor, memory-manager) |
| `src/governance/` | Constitutional (council, arbiter, overseer) |
| `tests/security/` | Injection defense tests (100% coverage required) |

## What NOT to Do

| Anti-Pattern | Why |
|--------------|-----|
| Bypass kernel | All input must flow through sanitizer → audit |
| Modify audit logs | Append-only, hash-chained, immutable |
| Use `any` type | Use `unknown` or specific types |
| Violate layer boundaries | Lower cannot import higher |
| Suppress errors silently | Log via EventBus, then re-throw |
| Skip permission checks | Three-layer check always required |
| Use external network | Loopback-only is absolute |

## Gotchas

- Event emission: `eventBus.emit('namespace:action', payload)`
- Test location: `tests/unit/[layer]/[component].test.ts`
- Before modifying any file: **read it first**
- All state changes: emit audit event

## Progressive Disclosure

| Topic | Resource |
|-------|----------|
| Security | `SECURITY.md`, `/ari-injection-detection` |
| Architecture | `/ari-layer-guardian` |
| Agents | `/ari-agent-coordination` |
| Governance | `/ari-council-governance` |
| Philosophy | `/ari-philosophy` |
| Collaboration | `/ari-teach-mode` |
| Testing | `.claude/rules/testing.md` |
| Cognitive Layer | `/ari-cognitive-layer` |

## Compaction Survival

ALWAYS preserve when context is compacted:

- Security invariants (all 5) + auto-block threshold
- Layer dependency rule (lower cannot import higher)
- Current task context and active file paths
- What NOT to Do (all 7 anti-patterns)

---
v2.2.1 · 2026-02-16
