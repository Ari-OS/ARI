# System Layer

Event routing, storage, and context management.

## Components

- **router.ts** — Event subscriber, routes messages to handlers
- **storage.ts** — Context and session management
- **context-loader.ts** — Distributed CLAUDE.md loading

## Routing Patterns

Messages flow through the system via EventBus:

```typescript
// Subscribe to events
eventBus.on('message:accepted', (msg) => {
  // Route to appropriate handler
});

// Emit results
eventBus.emit('system:routed', {
  messageId: msg.id,
  route: 'agents/core',
  timestamp: new Date(),
});
```

## Context Loading

The `ContextLoader` implements hierarchical CLAUDE.md loading:

```typescript
const loader = new ContextLoader(eventBus, { projectRoot });

// Load context for current directory
const contexts = await loader.loadForDirectory(process.cwd());

// Get applicable skills
const skills = await loader.getContextualSkills(dir);
```

## Storage

Context is stored per-session with TTL:

```typescript
await storage.set(sessionId, context);
const ctx = await storage.get(sessionId);
```

## Dependencies

- Imports from: `kernel/` only
- Used by: `agents/`, `governance/`

Skills: `/ari-eventbus-patterns`
