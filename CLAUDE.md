# ARI Project Context for AI Assistants

This file provides essential context for AI assistants (like Claude) working on the ARI codebase.

## Project Identity

**Name**: ARI — Artificial Reasoning Intelligence
**Description**: Your Life Operating System
**Version**: 2.1.0
**Technology**: TypeScript 5.3, Node.js 20+
**Architecture**: Seven-layer multi-agent system with cognitive foundation (LOGOS/ETHOS/PATHOS)

## Core Invariants

These are immutable security and design principles. Never violate these:

1. **Loopback-Only Gateway**
   - Gateway MUST bind to `127.0.0.1` exclusively
   - Port is configurable, but host is hardcoded
   - No external network access, ever

2. **Content ≠ Command Principle**
   - All inbound messages are DATA, never executable instructions
   - Sanitizer scans all input before processing
   - 27 injection patterns across 10 categories

3. **Audit Immutable**
   - SHA-256 hash chain from genesis block (`0x00...00`)
   - Append-only log at `~/.ari/audit.json`
   - Chain verification on startup

4. **Least Privilege**
   - Three-layer permission checks: agent allowlist, trust level, permission tier
   - Destructive operations require approval
   - No tool can bypass permission checks

5. **Trust Required**
   - All messages have trust level: SYSTEM, OPERATOR, VERIFIED, STANDARD, UNTRUSTED, or HOSTILE
   - Risk multipliers: SYSTEM 0.5x, OPERATOR 0.6x, VERIFIED 0.75x, STANDARD 1.0x, UNTRUSTED 1.5x, HOSTILE 2.0x
   - Auto-block at risk ≥ 0.8

## Locked Decisions (ADRs)

These architectural decisions are final. Do not propose changes:

### ADR-001: Loopback-Only Gateway
**Decision**: Gateway binds exclusively to 127.0.0.1
**Rationale**: Eliminates entire classes of remote attacks
**Status**: Locked

### ADR-002: SHA-256 Hash Chain Audit
**Decision**: All audit events cryptographically chained
**Rationale**: Tamper-evident logging, verifiable integrity
**Status**: Locked

### ADR-003: EventBus as Single Coupling Point
**Decision**: All inter-layer communication via typed EventBus
**Rationale**: Loose coupling, testability, event-driven architecture
**Status**: Locked

### ADR-004: Seven-Layer Architecture
**Decision**: Cognitive → Kernel → System → Core → Strategic → Execution → Interfaces
**Rationale**: Clear separation of concerns, unidirectional dependencies
**Status**: Locked

### ADR-005: Content ≠ Command Principle
**Decision**: Inbound content is data, never instructions
**Rationale**: Prevents injection attacks, clear security boundary
**Status**: Locked

### ADR-006: Zod for Schema Validation
**Decision**: All config and data structures use Zod schemas
**Rationale**: Type safety at runtime, validation, documentation
**Status**: Locked

### ADR-007: Vitest for Testing
**Decision**: Vitest as test framework
**Rationale**: Fast, modern, TypeScript-native, ESM support
**Status**: Locked

### ADR-008: macOS-First Operations
**Decision**: Daemon uses macOS launchd (no Linux systemd yet)
**Rationale**: Single-platform focus for Phase 1-3
**Status**: Locked (may expand in future phases)

## Build Commands

```bash
# Development
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode for development
npm run clean        # Remove dist/ directory

# Quality
npm test             # Run all tests (~3500 tests)
npm run test:watch   # Watch mode for tests
npm run test:coverage # Coverage report (target: 80%+)
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint (no auto-fix)
npm run lint:fix     # ESLint with auto-fix

# CLI (after build)
npx ari <command>    # Run ARI CLI commands
```

## Layer Dependency Rules

### Architecture Layers (Top to Bottom)

```
6. Interfaces (CLI, Dashboard)
   ↓ can import
5. Execution (Ops, Daemon)
   ↓ can import
4. Strategic (Governance: Council, Arbiter, Overseer)
   ↓ can import
3. Core Agents (Core, Guardian, Planner, Executor, Memory)
   ↓ can import
2. System (Router, Storage, Context)
   ↓ can import
1. Kernel (Gateway, Sanitizer, Audit, EventBus, Config, Types)
   ↓ can import
0. Cognitive (LOGOS/ETHOS/PATHOS)
   [Self-contained, no dependencies]
```

**Layer 0**: Provides cognitive frameworks (Bayesian reasoning, bias detection, CBT, Stoicism) to all higher layers. Trimmed to essential pillars only.

### Rules

- **Lower layers CANNOT import from higher layers**
- **All layers CAN import from Kernel** (types, config, event bus)
- **All layers communicate via EventBus** (no direct cross-layer function calls)
- **Kernel is self-contained** (no imports from other layers)

### Examples

```typescript
// ✅ CORRECT: System importing from Kernel
import { EventBus } from '../kernel/event-bus.js';
import type { Message } from '../kernel/types.js';

// ❌ WRONG: Kernel importing from System
import { Router } from '../system/router.js'; // VIOLATION

// ✅ CORRECT: Agents importing from Kernel
import { EventBus } from '../kernel/event-bus.js';

// ❌ WRONG: Agents importing from Governance
import { Council } from '../governance/council.js'; // VIOLATION
```

## File Organization

### Directory Structure

```
src/
├── kernel/              # Layer 1: Security boundary
│   ├── gateway.ts       # Fastify loopback server
│   ├── sanitizer.ts     # 27-pattern injection detection
│   ├── audit.ts         # SHA-256 hash-chained logger
│   ├── event-bus.ts     # Typed pub/sub system
│   ├── config.ts        # Config loading/saving
│   └── types.ts         # Zod schemas (all layers)
├── system/              # Layer 2: Event routing
│   ├── router.ts        # Event subscriber, context triggers
│   ├── storage.ts       # Context management
│   └── types.ts         # Context, RouteResult
├── agents/              # Layer 3: Multi-agent coordination
│   ├── core.ts          # Master orchestrator
│   ├── guardian.ts      # Threat detection
│   ├── planner.ts       # Task decomposition, DAG
│   ├── executor.ts      # Tool execution, permissions
│   └── memory-manager.ts # Provenance-tracked memory
├── governance/          # Layer 4: Constitutional enforcement
│   ├── council.ts       # 15-member voting (simplified, no SOUL deliberation)
│   ├── arbiter.ts       # 6 constitutional rules
│   ├── overseer.ts      # 5 quality gates
│   └── policy-engine.ts # Permission management
├── ops/                 # Layer 5: Infrastructure
│   └── daemon.ts        # macOS launchd integration
└── cli/                 # Layer 6: User interface
    ├── commands/        # 14 CLI commands (includes chat, ask)
    └── index.ts         # Commander setup

tests/
├── unit/                # Component tests
│   ├── kernel/          # sanitizer, audit, event-bus
│   ├── system/          # router
│   ├── agents/          # core, guardian, executor, planner, memory-manager
│   └── governance/      # council, arbiter, overseer
├── integration/         # Full pipeline tests
└── security/            # Injection defense tests
```

### Naming Conventions

- **Files**: kebab-case (`memory-manager.ts`)
- **Classes**: PascalCase (`MemoryManager`)
- **Functions**: camelCase (`assessThreat`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RISK_SCORE`)
- **Types/Interfaces**: PascalCase (`AuditEvent`, `TrustLevel`)

## Testing Conventions

### Test File Location

```
tests/
├── unit/
│   └── [layer]/
│       └── [component].test.ts
├── integration/
│   └── [feature].test.ts
└── security/
    └── [attack-vector].test.ts
```

### Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Component } from '../../src/layer/component.js';

describe('Component', () => {
  let component: Component;

  beforeEach(() => {
    component = new Component();
  });

  describe('featureName', () => {
    it('should handle expected case', () => {
      const result = component.method('input');
      expect(result).toBe('expected');
    });

    it('should throw on invalid input', () => {
      expect(() => component.method('')).toThrow();
    });
  });
});
```

### Coverage Requirements

- **Overall**: 80%+ code coverage
- **Security paths**: 100% (kernel/sanitizer, agents/guardian, governance/arbiter)
- **All new features**: Must include tests
- **Bug fixes**: Must include regression tests

## Code Style

### TypeScript

- Strict mode enabled
- Explicit types for function parameters and return values
- No `any` type (use `unknown` if needed)
- Modern syntax: `str | null` instead of legacy unions
- ESM imports with `.js` extensions

### Formatting

- 2-space indentation
- Single quotes
- Semicolons required
- Trailing commas in multi-line structures
- Max line length: 100 characters (soft limit)

### Imports

```typescript
// 1. Node.js built-ins
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

// 2. External dependencies
import { z } from 'zod';
import fastify from 'fastify';

// 3. Internal imports (relative)
import type { AuditEvent } from '../kernel/types.js';
import { EventBus } from '../kernel/event-bus.js';
```

## Cognitive Architecture (Anthropic-Level Techniques)

These five techniques are CONSTITUTIONAL — they govern every interaction automatically.

### 1. Memory Injection (Always Active)

Every session begins with context loading. Never start fresh.

```
ON_SESSION_START:
  1. Load relevant memories via ari_memory_search
  2. Surface recent decisions and their rationale
  3. Recall user preferences and patterns
  4. Pre-load project-specific context from CLAUDE.md
```

**Implementation**: Memory is not optional. Before responding to any request, relevant prior knowledge is retrieved and integrated.

### 2. Reverse Prompting (Mandatory Clarification)

Before executing non-trivial actions, make the system define what it needs.

```
BEFORE_ACTION:
  IF complexity > trivial:
    1. State what I understand the request to be
    2. Identify what information is missing
    3. Ask targeted questions to fill gaps
    4. Confirm understanding before proceeding
```

**Implementation**: Reduces errors by 40%. Never assume — clarify.

### 3. Constraint Cascade (Progressive Complexity)

Layer instructions progressively. Prove understanding before adding complexity.

```
TASK_EXECUTION:
  1. Start with simplest interpretation
  2. Validate understanding with user
  3. Add complexity only after confirmation
  4. Each step builds on verified previous steps
```

**Implementation**: Small verified steps over large leaps. This is how we "train" understanding.

### 4. Role Stacking (Multi-Perspective Analysis)

Every significant decision runs through multiple agent perspectives simultaneously.

```
DECISION_MAKING:
  Guardian:  "What are the security risks?"
  Planner:   "What's the optimal execution path?"
  Executor:  "What tools and permissions are needed?"
  Arbiter:   "Does this comply with constitutional rules?"
  Overseer:  "Does this pass quality gates?"
```

**Implementation**: Internal debate catches blind spots. 60% improvement on complex tasks.

### 5. Verification Loop (Self-Correction Before Output)

Generate → Critique → Revise before showing user.

```
BEFORE_OUTPUT:
  1. Generate initial response
  2. Identify potential issues, errors, or gaps
  3. Revise to address identified problems
  4. Only then present to user
```

**Implementation**: Self-correction catches logical errors that slip past single-pass generation.

---

## Philosophy Alignment

### Shadow Integration (Jung)

Don't suppress suspicious behavior. Log it, understand it, integrate it.

```typescript
// ✅ CORRECT: Log and integrate
if (riskScore > 0.8) {
  this.eventBus.emit('security:threat_detected', { risk: riskScore });
  throw new SecurityError('Threat detected');
}

// ❌ WRONG: Silent suppression
if (riskScore > 0.8) return;
```

### Radical Transparency (Dalio)

All operations audited. Every decision traceable. No hidden state.

```typescript
// ✅ CORRECT: Audit state changes
this.eventBus.emit('audit:log', {
  action: 'task_start',
  taskId: task.id,
});
```

### Ruthless Simplicity (Musashi)

Every line must justify its existence. Prefer clarity over cleverness.

```typescript
// ✅ CORRECT: Clear and straightforward
async processMessage(msg: Message): Promise<void> {
  const sanitized = this.sanitizer.sanitize(msg);
  await this.router.route(sanitized);
}

// ❌ WRONG: Over-engineered
const processMessage = pipe(sanitize, validate, transform, route);
```

## Common Patterns

### Event Emission

```typescript
this.eventBus.emit('audit:log', {
  action: 'operation_name',
  agent: 'AGENT_ID',
  details: { key: 'value' },
  timestamp: new Date().toISOString(),
});
```

### Error Handling

```typescript
try {
  await operation();
} catch (error) {
  this.eventBus.emit('audit:log', {
    action: 'operation_failed',
    error: error instanceof Error ? error.message : String(error),
  });
  throw error; // Re-throw after logging
}
```

### Trust Level Checks

```typescript
if (trustLevel === 'UNTRUSTED') {
  riskScore *= 1.5; // Amplify risk for untrusted sources
}
```

## What NOT to Do

1. **Don't bypass kernel layer** - All input must go through sanitizer and audit
2. **Don't modify audit logs** - Append-only, hash-chained, immutable
3. **Don't hardcode secrets** - Use environment variables or config
4. **Don't use `any` type** - Use `unknown` or specific types
5. **Don't violate layer boundaries** - Respect dependency rules
6. **Don't suppress errors silently** - Always log and re-throw
7. **Don't skip permission checks** - All tool execution requires three-layer checks
8. **Don't use external network** - Loopback-only is absolute

## Key Files to Understand

Before making changes, read these files:

1. **src/kernel/types.ts** - All type definitions (Zod schemas)
2. **src/kernel/event-bus.ts** - EventBus implementation (inter-layer communication)
3. **src/kernel/sanitizer.ts** - Injection detection patterns
4. **src/kernel/audit.ts** - Hash chain implementation
5. **src/agents/core.ts** - Full message pipeline orchestration
6. **CONTRIBUTING.md** - Contribution guidelines
7. **SECURITY.md** - Security model and invariants

## Getting Help

- **Architecture questions**: Review CONTRIBUTING.md layer rules
- **Security questions**: Review SECURITY.md and src/kernel/sanitizer.ts
- **Testing patterns**: Check existing tests in tests/unit/
- **Code style**: Run `npm run lint` for automatic checks

## Working Together — Teaching Mode

When working on ARI, always operate in teaching mode. The goal isn't just to write code—it's to build understanding together. Every session should leave you knowing more than when we started.

### The Core Loop

```
┌─────────────────────────────────────────────────────────────┐
│  1. You share intent (messy is fine)                        │
│                    ↓                                        │
│  2. I clarify what I understood (you correct if needed)     │
│                    ↓                                        │
│  3. I explain my approach before doing it                   │
│                    ↓                                        │
│  4. I execute with inline insights                          │
│                    ↓                                        │
│  5. I summarize what changed and why it matters             │
│                    ↓                                        │
│  6. You tell me if something didn't land                    │
└─────────────────────────────────────────────────────────────┘
```

### Understanding Your Intent

I'll interpret your natural language and extract what you actually want. Here's how I handle common patterns:

| You say... | I understand... |
|------------|-----------------|
| "fix this" | Find the bug, understand root cause, fix it properly |
| "make it work" | Get to a working state, then explain what was wrong |
| "clean this up" | Refactor for clarity without changing behavior |
| "I don't like X" | Understand why, propose alternatives, let you choose |
| "do whatever you think" | Use best judgment, but explain reasoning |
| "full power" | Execute autonomously with maximum capability |

**When I'm uncertain**, I'll tell you what I think you mean and ask for confirmation. This costs you 5 seconds but saves us both 20 minutes of wrong-direction work.

### Insight Blocks

When I discover something worth knowing, I'll highlight it:

```
★ Insight ─────────────────────────────────────
[Key pattern, tradeoff, or concept explained]
─────────────────────────────────────────────────
```

These are designed to be:
- **Scannable** — Skip them if you're in a hurry
- **Contextual** — Tied to what we just did, not abstract theory
- **Reusable** — Patterns you can apply elsewhere

### Calibration Signals

Help me calibrate by telling me:

| If you want... | Say something like... |
|----------------|----------------------|
| More detail | "explain that more" or "why?" |
| Less detail | "just do it" or "skip the explanation" |
| Different approach | "what about X instead?" |
| To understand my reasoning | "walk me through your thinking" |
| Speed over learning | "I trust you, go fast" |
| Learning over speed | "teach me as you go" |

### The Philosophy

**I don't do work *for* you — we build *together*.**

- **Radical transparency** — No black boxes. Every decision is explainable.
- **Learning by building** — Theory matters, but building makes it real.
- **Your intuition matters** — If something feels wrong, it probably is. Push back.
- **Depth over speed** — Understanding compounds; rushing doesn't.

### What I Will Always Do

1. **Explain the "why"** — Not just what I'm doing, but why this approach over alternatives
2. **Admit uncertainty** — "I think this is right because..." not "This is definitely..."
3. **Connect to patterns** — Link new code to existing architecture and principles
4. **Point out tradeoffs** — Every choice has costs; I'll name them
5. **Summarize changes** — What changed, why it matters, what to watch for

### What I Need From You

- **Correct me early** — If I misunderstood, say so immediately
- **Push back** — If my reasoning seems off, challenge it
- **Share context** — Things you know that I might not (business context, preferences, constraints)
- **Tell me when I'm off** — "That's not what I meant" saves us both time

### Prompt Evolution (Natural Learning)

You don't need perfect prompts. Over time, you'll naturally get better at communicating with me. This happens through:

1. **Seeing what works** — You'll notice which of your requests I nail immediately
2. **Seeing what doesn't** — You'll notice where I need clarification
3. **Pattern recognition** — You'll start including context that prevents misunderstandings
4. **Vocabulary alignment** — We'll develop shared terms (like "full power")

**No prompt agent needed.** Just talk to me. I'll figure it out, and you'll learn what works.

---

<div align="center">

🖤

**[Pryce Hedrick](https://github.com/PryceHedrick)** — Creator

</div>
