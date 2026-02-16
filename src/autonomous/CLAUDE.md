# Autonomous Operations

Proactive agent capabilities: scheduling, briefings, knowledge management.

## Components

| Component | Purpose |
|-----------|---------|
| agent.ts | Main autonomous loop, polls for tasks |
| scheduler.ts | Cron-like task scheduling |
| briefings.ts | Morning/evening summaries |
| knowledge-index.ts | TF-IDF semantic search |
| knowledge-sources.ts | External source fetching |
| changelog-generator.ts | Daily git analysis |
| agent-spawner.ts | Worktree agent management |
| task-queue.ts | Prioritized task queue |

## Scheduled Tasks

| Time | Task | Handler |
|------|------|---------|
| 06:30 | Morning briefing | `morning_briefing` |
| 08:00, 14:00, 20:00 | Knowledge index | `knowledge_index` |
| 19:00 | Changelog generation | `changelog_generate` |
| 21:00 | Evening summary | `evening_summary` |
| */15 | Agent health check | `agent_health_check` |

## Knowledge Indexing

```typescript
const index = new KnowledgeIndex(eventBus);
await index.init();

// Index a document
await index.index({
  content: 'Pattern: always use Zod for validation',
  source: 'session',
  domain: 'patterns',
  provenance: { createdBy: 'operator', createdAt: new Date() },
});

// Search
const results = await index.search('validation patterns', { limit: 5 });
```

## Agent Spawning

```typescript
const spawner = new AgentSpawner(eventBus);

// Spawn in worktree for isolation
const agent = await spawner.spawnInWorktree(
  'Implement feature X',
  'feature/x'
);

// Check status (runs every 15min)
await spawner.checkAgents();
```

## Integration with Main Loop

```typescript
// In agent.ts poll():
await this.scheduler.checkAndRun();
await this.processNextTask();
```

Skills: `/ari-daemon-ops`, `/ari-continuous-improvement`
