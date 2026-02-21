---
name: ari-layer-guardian
description: Enforce ARI's six-layer architecture and prevent dependency violations
triggers:
  - "check layer violations"
  - "validate architecture"
  - "import check"
  - "layer compliance"
---

# ARI Layer Guardian

## Purpose

Enforce ARI's strict six-layer architecture (ADR-004) and prevent dependency violations that could compromise security.

## Layer Hierarchy

```
6. Interfaces (CLI)        → Can import: 5, 1
   ↓
5. Execution (Ops)         → Can import: 4, 1
   ↓
4. Strategic (Governance)  → Can import: 3, 1
   ↓
3. Core (Agents)           → Can import: 2, 1
   ↓
2. System (Router)         → Can import: 1
   ↓
1. Kernel (Security)       → Can import: NOTHING (self-contained)
```

## Rules

1. **Lower layers CANNOT import from higher layers**
2. **All layers CAN import from Kernel** (types, config, event bus)
3. **All layers communicate via EventBus** (no direct cross-layer calls)
4. **Kernel is self-contained** (no imports from other layers)

## Directory Mapping

| Layer | Directory | Components |
|-------|-----------|------------|
| 6 | src/cli/ | Commands, CLI interface |
| 5 | src/ops/ | Daemon, launchd |
| 4 | src/governance/ | Council, Arbiter, Overseer |
| 3 | src/agents/ | Core, Guardian, Planner, Executor, Memory |
| 2 | src/system/ | Router, Storage |
| 1 | src/kernel/ | Gateway, Sanitizer, Audit, EventBus, Config, Types |

## Violation Detection

### Check Command

```bash
# Find potential violations
grep -r "from '\.\./governance" src/agents/
grep -r "from '\.\./agents" src/system/
grep -r "from '\.\./system" src/kernel/
```

### Valid Imports

```typescript
// ✅ CORRECT: System importing from Kernel
import { EventBus } from '../kernel/event-bus.js';

// ✅ CORRECT: Agents importing from Kernel
import type { Message } from '../kernel/types.js';

// ✅ CORRECT: Governance importing from Agents
import { Guardian } from '../agents/guardian.js';
```

### Invalid Imports (VIOLATIONS)

```typescript
// ❌ WRONG: Kernel importing from System
import { Router } from '../system/router.js';

// ❌ WRONG: Agents importing from Governance
import { Council } from '../governance/council.js';

// ❌ WRONG: System importing from Agents
import { Executor } from '../agents/executor.js';
```

## Why This Matters

Layer violations can:

1. Create circular dependencies
2. Bypass security boundaries
3. Break audit trail integrity
4. Allow privilege escalation
5. Make testing impossible

## Workflow

When reviewing or writing code:

1. **Identify the current layer** from file path
2. **Check all imports** against allowed dependencies
3. **Flag any violations** immediately
4. **Suggest EventBus** for cross-layer communication

## EventBus Pattern

Instead of direct imports, use EventBus:

```typescript
// Instead of importing from higher layer:
// ❌ import { Council } from '../governance/council.js';

// Use EventBus:
// ✅ this.eventBus.emit('governance:vote_required', { proposal });
// ✅ this.eventBus.on('governance:vote_result', (result) => { ... });
```

## Integration with CI

Add ESLint rule to enforce:

```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [
        // Kernel cannot import anything
        { "from": "../system/*", "importNames": ["*"], "message": "Kernel cannot import from System" }
      ]
    }]
  }
}
```
