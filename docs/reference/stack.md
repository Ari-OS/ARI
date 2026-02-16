# ARI Technology Stack

**Version**: 2.0.0
**Last Updated**: 2026-01-28

---

## Core Runtime

| Component | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | 20.0.0+ | JavaScript runtime |
| **TypeScript** | 5.3 | Type-safe development |
| **ESM** | Native | Module system |

---

## Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| **fastify** | 4.25+ | HTTP server (loopback-only gateway) |
| **zod** | 3.22+ | Schema validation and type inference |
| **commander** | 12.0+ | CLI framework |
| **chalk** | 5.3+ | Terminal styling |
| **ora** | 8.0+ | Terminal spinners |
| **pino** | 8.17+ | JSON logging |
| **pino-pretty** | 10.3+ | Log formatting |
| **uuid** | 9.0+ | Unique ID generation |
| **ws** | 8.16+ | WebSocket server |
| **@modelcontextprotocol/sdk** | 1.25+ | MCP server integration |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| **vitest** | 1.1+ | Test framework |
| **eslint** | 8.57+ | Code linting |
| **@typescript-eslint/\*** | 8.54+ | TypeScript ESLint support |
| **tsx** | 4.7+ | TypeScript execution |
| **husky** | 9.1+ | Git hooks |
| **@commitlint/\*** | 20.3+ | Commit message validation |

---

## Dashboard Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| **Vite** | 6.0 | Build tool |
| **React** | 19.0 | UI framework |
| **TypeScript** | 5.3 | Type safety |
| **TanStack Query** | 5.x | Data fetching |
| **Tailwind CSS** | 4.0 | Styling |

---

## Architecture Layers

```
Layer 6: INTERFACES
├── CLI (Commander)
└── Dashboard (React 19)

Layer 5: EXECUTION
└── Daemon (macOS launchd)

Layer 4: STRATEGIC
├── Council (voting)
├── Arbiter (rules)
└── Overseer (gates)

Layer 3: CORE
├── Core Agent
├── Guardian Agent
├── Planner Agent
├── Executor Agent
└── Memory Manager

Layer 2: SYSTEM
├── Router (event routing)
└── Storage (context)

Layer 1: KERNEL
├── Gateway (Fastify)
├── Sanitizer (injection)
├── Audit (SHA-256)
├── EventBus (pub/sub)
├── Config (Zod)
└── Types (Zod schemas)
```

---

## Build System

### Scripts

```json
{
  "build": "tsc",
  "dev": "tsx watch src/index.ts",
  "start": "node dist/index.js",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest --coverage",
  "lint": "npx eslint src --ext .ts",
  "lint:fix": "eslint src --ext .ts --fix",
  "typecheck": "tsc --noEmit",
  "clean": "rm -rf dist"
}
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

---

## API Architecture

### Gateway (Fastify)

- Binds to `127.0.0.1:3141` (loopback only)
- CORS disabled (not needed for loopback)
- JSON parsing with size limits
- Request logging via Pino

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/status` | System status |
| POST | `/message` | Submit message |
| GET | `/api/agents` | List agents |
| GET | `/api/agents/:id/stats` | Agent stats |
| GET | `/api/proposals` | List proposals |
| GET | `/api/proposals/:id` | Get proposal |
| GET | `/api/governance/rules` | Constitutional rules |
| GET | `/api/governance/gates` | Quality gates |
| GET | `/api/memory` | Search memories |
| GET | `/api/memory/:id` | Get memory |
| GET | `/api/audit` | Audit entries |
| GET | `/api/audit/verify` | Verify chain |
| GET | `/api/tools` | Tool registry |
| GET | `/api/contexts` | List contexts |
| GET | `/api/contexts/active` | Active context |
| WS | `/ws` | Real-time events |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `agent:status` | Server→Client | Agent status change |
| `agent:thought` | Server→Client | Agent reasoning |
| `audit:log` | Server→Client | Audit event |
| `governance:vote` | Server→Client | Vote recorded |
| `governance:decision` | Server→Client | Decision made |
| `memory:store` | Server→Client | Memory stored |
| `security:threat` | Server→Client | Threat detected |
| `task:created` | Server→Client | Task created |
| `task:completed` | Server→Client | Task completed |

---

## Security Architecture

### Kernel Layer Security

| Component | Security Function |
|-----------|-------------------|
| **Gateway** | Loopback-only binding, request validation |
| **Sanitizer** | 39 injection patterns, 14 categories |
| **Audit** | SHA-256 hash chain, tamper detection |

### Trust Levels

| Level | Risk Multiplier | Source |
|-------|-----------------|--------|
| `system` | 0.5x | Internal components |
| `operator` | 0.6x | Authenticated operator |
| `verified` | 0.75x | Verified external |
| `standard` | 1.0x | Default |
| `untrusted` | 1.5x | Unknown source |
| `hostile` | 2.0x | Known malicious |

### Injection Categories

1. **Prompt Injection** — AI instruction manipulation
2. **System Prompt Attacks** — Prompt extraction attempts
3. **Jailbreak Patterns** — Restriction bypass
4. **Delimiter Injection** — Context boundary attacks
5. **Encoding Attacks** — Obfuscated payloads
6. **Social Engineering** — Authority/urgency claims

---

## Testing Architecture

### Test Structure

```
tests/
├── unit/
│   ├── kernel/          # Gateway, Sanitizer, Audit, EventBus
│   ├── system/          # Router
│   ├── agents/          # Core, Guardian, Executor, Planner, Memory
│   └── governance/      # Council, Arbiter, Overseer, Stop-the-Line
├── integration/         # Full pipeline tests
└── security/            # Injection defense tests
```

### Coverage Targets

| Category | Target |
|----------|--------|
| Overall | ≥80% |
| Security paths | 100% |
| Kernel layer | ≥90% |
| Governance | ≥85% |

### Test Commands

```bash
npm test                   # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

---

## Development Environment

### Prerequisites

```bash
# macOS
brew install node@20

# Verify
node --version  # 20.0.0+
npm --version   # 10.0.0+
```

### Setup

```bash
git clone https://github.com/ARI-OS/ARI.git
cd ARI
npm install
npm run build
npx ari onboard init
npx ari doctor
```

### Development Workflow

```bash
# Terminal 1: Watch build
npm run dev

# Terminal 2: Run tests
npm run test:watch

# Terminal 3: Start gateway
npx ari gateway start
```

---

## CI/CD

### GitHub Actions

```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

### Quality Gates

| Gate | Criteria |
|------|----------|
| Build | TypeScript compiles with zero errors |
| Lint | ESLint passes |
| Typecheck | `tsc --noEmit` passes |
| Tests | All 187 tests pass |
| Coverage | ≥80% overall |

---

## File Size Budget

| Component | Target | Actual |
|-----------|--------|--------|
| Dashboard JS | <300KB | 258KB |
| Dashboard CSS | <20KB | 16KB |
| dist/ total | <2MB | 4.5MB |

---

## Monitoring & Logging

### Pino Logger

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});
```

### Log Levels

| Level | Usage |
|-------|-------|
| `fatal` | System crash |
| `error` | Operation failed |
| `warn` | Degraded operation |
| `info` | Normal operation |
| `debug` | Development detail |
| `trace` | Fine-grained trace |

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Gateway startup | <2s |
| Message processing | <100ms |
| Audit verification | <500ms |
| Test suite | <30s |
| Build | <10s |

---

**Stack documentation for ARI v2.0.0**
