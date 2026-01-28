# ARI Dashboard

View-only dashboard for the ARI Life Operating System.

## Features

- **System Health**: Real-time monitoring of gateway, event bus, audit log, sanitizer, agents, and governance
- **Governance**: View proposals, constitutional rules, and quality gates
- **Memory**: Search and browse memory entries with filtering by type and partition
- **Tools**: Registry of all registered tools with permissions and execution stats
- **Agents**: Monitor agent status, task completion, and performance metrics
- **Audit Log**: Browse cryptographically-chained audit entries with hash verification

## Tech Stack

- Vite 6
- React 19
- TypeScript
- TanStack Query (React Query)
- Tailwind CSS v4

## Development

```bash
# Install dependencies
npm install

# Start dev server (requires ARI gateway running at 127.0.0.1:3141)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run typecheck
```

## Requirements

The ARI gateway must be running at `http://127.0.0.1:3141` for the dashboard to work.

Start the gateway with:

```bash
# From the ARI root directory
npm run gateway:start
```

## Architecture

- **View-Only**: No mutations, no POST/PUT/DELETE operations
- **API Proxy**: Vite dev server proxies `/api` and `/ws` to `127.0.0.1:3141`
- **Independent Build**: Separate package.json and build pipeline from parent project
- **Local Types**: All API types defined locally in `src/types/api.ts`

## Project Structure

```
dashboard/
├── src/
│   ├── main.tsx          # Entry point
│   ├── App.tsx           # Root component with routing
│   ├── index.css         # Global styles (Tailwind)
│   ├── pages/            # Page components
│   │   ├── Home.tsx
│   │   ├── Governance.tsx
│   │   ├── Memory.tsx
│   │   ├── Tools.tsx
│   │   ├── Agents.tsx
│   │   └── Audit.tsx
│   ├── components/       # Shared components
│   │   ├── Layout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── StatusBadge.tsx
│   │   └── AuditEntry.tsx
│   ├── hooks/            # React Query hooks
│   │   └── useHealth.ts
│   ├── api/              # API client
│   │   └── client.ts
│   └── types/            # TypeScript types
│       └── api.ts
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Available Endpoints

The dashboard consumes these ARI API endpoints:

- `GET /api/health` - System health
- `GET /api/health/detailed` - Component-level health
- `GET /api/agents` - List all agents
- `GET /api/agents/:id/stats` - Agent statistics
- `GET /api/proposals` - List proposals
- `GET /api/governance/rules` - Constitutional rules
- `GET /api/governance/gates` - Quality gates
- `GET /api/memory` - Search memories
- `GET /api/audit` - Audit entries
- `GET /api/audit/verify` - Verify hash chain
- `GET /api/tools` - Tool registry
- `GET /api/contexts` - List contexts
- `WS /ws` - Real-time event stream

## License

Same as parent ARI project.
