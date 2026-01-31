---
name: ari-parallel-workflows
description: Spawn parallel agents for independent tasks using git worktrees
triggers:
  - /parallel
  - /spawn-agent
  - spawn agents
  - work in parallel
  - parallel tasks
---

# Parallel Workflows Skill

Spawn multiple agents to work on independent tasks simultaneously.
Each agent runs in an isolated git worktree for safety and parallelism.

## When to Use

**Good candidates for parallelization:**
- Independent features that don't share code
- Multiple bug fixes in different areas
- Documentation updates across modules
- Test coverage improvements
- Refactoring that's isolated by layer

**Not suitable for parallelization:**
- Sequential dependencies (A must finish before B)
- Shared state or files
- Architectural changes
- Database migrations

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  Main Session                                                │
│  ↓                                                           │
│  /parallel "Task A" "Task B" "Task C"                        │
│  ↓                                                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                      │
│  │ Worker A│  │ Worker B│  │ Worker C│  ← Isolated worktrees│
│  │ branch-a│  │ branch-b│  │ branch-c│                      │
│  └────┬────┘  └────┬────┘  └────┬────┘                      │
│       │            │            │                            │
│       ▼            ▼            ▼                            │
│  ┌─────────────────────────────────────┐                    │
│  │    Results Collection & Merge       │                    │
│  └─────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Spawn Parallel Agents

```
/parallel "Add user authentication" "Add password reset" "Add email verification"
```

Creates 3 agents, each in their own worktree, working independently.

### Monitor Progress

```
/agents status
```

Shows all running agents and their progress.

### Collect Results

```
/agents collect <agent-id>
```

Gets results from a completed agent.

### Cleanup

```
/agents cleanup
```

Removes completed agent worktrees and branches.

## Integration with AgentSpawner

Under the hood, this skill uses `AgentSpawner`:

```typescript
const spawner = new AgentSpawner(eventBus, projectRoot);

// Spawn an agent
const agent = await spawner.spawnInWorktree(
  'Implement feature X',
  'feature-x'
);

// Check status (called every 15min by scheduler)
await spawner.checkAgents();

// Collect results
const result = await spawner.collectResults(agent.id);

// Cleanup
await spawner.cleanup(agent.id, { deleteBranch: true });
```

## Progress Tracking

Agents report progress through marker files:

| File | Purpose |
|------|---------|
| `.ari-task.md` | Original task description |
| `.ari-progress` | JSON with progress % and message |
| `.ari-completed` | JSON with results (success) |
| `.ari-failed` | Error message (failure) |

## Merge Strategies

When agents complete, their branches need merging:

| Strategy | Use Case |
|----------|----------|
| `replace` | Single authoritative result |
| `append` | Combine independent work |
| `selective` | Cherry-pick best parts |

## Best Practices

1. **Define clear boundaries** - Each task should be self-contained
2. **Set time limits** - Don't let agents run forever
3. **Review before merge** - Always review agent output
4. **Clean up promptly** - Don't accumulate worktrees

## Health Check

The scheduler runs `agent_health_check` every 15 minutes:
- Checks for completed/failed agents
- Updates progress tracking
- Emits events for monitoring

## Example Workflow

```
# 1. Plan the parallel work
"We need to add auth, password reset, and email verification"

# 2. Verify independence
"These features share UserService but otherwise independent"

# 3. Spawn agents
/parallel \
  "Add JWT authentication to Gateway" \
  "Add password reset flow with email tokens" \
  "Add email verification on signup"

# 4. Monitor
/agents status
→ agent_abc123: 45% - Implementing JWT validation
→ agent_def456: 20% - Setting up email templates
→ agent_ghi789: 80% - Finishing verification endpoint

# 5. Review & merge when complete
/agents collect agent_abc123
→ [Shows diff and summary]

# 6. Cleanup
/agents cleanup
```

## Safety

- Each agent runs in isolated worktree
- Main branch is never modified directly
- All changes go through review
- Failed agents don't affect others
