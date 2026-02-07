---
paths:
  - "src/**/*.ts"
---

# Architecture Rules

## Layer Dependencies

```
L0 Cognitive:  No imports (self-contained, pure logic)
L1 Kernel:     L0 only
L2 System:     L0, L1
L3 Agents:     L0, L1, L2
L4 Strategic:  L0, L1, L2, L3
L5 Execution:  L0, L1, L2, L3, L4
L6 Interfaces: L0, L1, L2, L3, L4, L5
```

**RULE**: Lower layers CANNOT import higher. Violations are blocked by hooks.

## Valid Imports

```typescript
// ✅ L2 System → L1 Kernel
import { EventBus } from '../kernel/event-bus.js';

// ✅ L3 Agents → L1 Kernel
import type { Message } from '../kernel/types.js';

// ✅ Any layer → L0 Cognitive
import { BiasDetector } from '../cognitive/bias-detector.js';
```

## Invalid Imports (BLOCKED)

```typescript
// ❌ L1 Kernel → L2 System
import { Router } from '../system/router.js';  // VIOLATION

// ❌ L3 Agents → L4 Governance
import { Council } from '../governance/council.js';  // VIOLATION

// ❌ L0 Cognitive → anything
import { EventBus } from '../kernel/event-bus.js';  // VIOLATION
```

## Cross-Layer Communication

Use EventBus, never direct imports across layer boundaries:

```typescript
// Instead of importing Council directly:
this.eventBus.emit('governance:vote_required', { proposal });
this.eventBus.on('governance:vote_result', handler);
```

## Import Order

```typescript
// 1. Node.js built-ins
import { createHash } from 'node:crypto';

// 2. External dependencies
import { z } from 'zod';

// 3. Internal (relative)
import { EventBus } from '../kernel/event-bus.js';
```
