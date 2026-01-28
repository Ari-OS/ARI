# ARI Dashboard Quick Start

## Prerequisites

1. Ensure the ARI gateway is running:
   ```bash
   # From the ARI root directory
   npm run gateway:start
   ```

2. The gateway should be accessible at `http://127.0.0.1:3141`

## Running the Dashboard

### Development Mode

```bash
# From the ARI root directory
npm run dashboard:dev

# OR from the dashboard directory
cd dashboard
npm run dev
```

The dashboard will be available at `http://localhost:5173`

### Production Build

```bash
# From the ARI root directory
npm run dashboard:build

# OR from the dashboard directory
cd dashboard
npm run build
```

Build output will be in `dashboard/dist/`

### Preview Production Build

```bash
cd dashboard
npm run preview
```

## Features

### Home Page
- System health overview
- Component status (Gateway, Event Bus, Audit, Sanitizer, Agents, Governance)
- Active agents summary

### Governance Page
- Active proposals with voting status
- Constitutional rules
- Quality gates with pass/fail counts

### Memory Page
- Search and filter memories
- Filter by type (FACT, TASK, GOAL, INTERACTION)
- Filter by partition (PUBLIC, PRIVATE, QUARANTINE)
- View provenance chains

### Tools Page
- Tool registry grouped by category
- Permission levels and trust tiers
- Execution and error counts

### Agents Page
- Real-time agent status
- Task completion statistics
- Success rates and performance metrics

### Audit Log Page
- Browse cryptographic audit chain
- Verify hash chain integrity
- Pagination support
- View entry details

## Troubleshooting

### Dashboard won't load
- Ensure the ARI gateway is running at `127.0.0.1:3141`
- Check browser console for errors
- Verify Vite dev server is running

### API requests fail
- The gateway must be running before starting the dashboard
- Check that the gateway is bound to `127.0.0.1:3141`
- Ensure no firewall is blocking localhost connections

### Build fails
- Run `npm install` in the dashboard directory
- Ensure Node.js version is 20.0.0 or higher
- Check that all dependencies are installed

## Architecture Notes

- The dashboard is **view-only** - no mutations are possible
- All API calls are proxied through Vite dev server to avoid CORS issues
- WebSocket connection at `/ws` for real-time events (not yet implemented in UI)
- Types are defined locally and do not import from parent project
- Independent build pipeline - dashboard can be deployed separately
