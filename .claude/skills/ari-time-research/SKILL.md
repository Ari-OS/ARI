---
name: ari-time-research
description: Research ARI's memory and knowledge over time windows
triggers:
  - /last30days
  - /lastweek
  - /lastmonth
  - last N days
  - what did we learn
  - recent decisions
  - what happened since
---

# Time-Windowed Research Skill

Query ARI's memory and knowledge base over specific time periods. Useful for:

- Reviewing recent decisions and their rationale
- Finding patterns in learned behaviors
- Preparing briefings and reports
- Understanding project evolution

## Triggers

| Command | Time Window |
|---------|-------------|
| `/lastweek` | Past 7 days |
| `/last30days` | Past 30 days |
| `/lastmonth` | Past 30 days |
| "last N days" | Past N days |
| "since [date]" | Since specific date |

## Usage

### Basic Queries

```
/lastweek patterns
```

Returns patterns learned in the last 7 days.

```
/last30days decisions
```

Returns decisions made in the last 30 days with reasoning.

```
what did we learn since Monday?
```

Natural language time query.

### Domain Filters

You can filter by domain:

- `patterns` - Learned patterns and conventions
- `decisions` - Decisions and their rationale
- `fixes` - Bug fixes and solutions
- `docs` - Documentation changes

Example:

```
/lastweek decisions domain:architecture
```

### Confidence Threshold

Filter by confidence level (0-1):

```
/last30days patterns minConfidence:0.7
```

## Implementation

This skill uses the `ari_memory_time_search` MCP tool:

```typescript
const results = await ari_memory_time_search({
  startDate: '2024-01-01',
  endDate: '2024-01-08',  // Optional, defaults to now
  domain: 'patterns',
  minConfidence: 0.5,
  limit: 50,
});
```

## Workflow

1. **Parse time window** from command/query
2. **Call MCP tool** with appropriate parameters
3. **Group results** by domain or type
4. **Synthesize findings** into actionable insights
5. **Optionally enrich** with WebSearch for current best practices

## Example Output

```markdown
## Research: Last 7 Days

### Decisions (3)
1. **ADR-009: Use Zod for all schemas** (Jan 5)
   - Reasoning: Runtime validation, TypeScript integration
   - Confidence: 0.95

2. **Chose Vitest over Jest** (Jan 3)
   - Reasoning: ESM support, faster, TypeScript-native
   - Confidence: 0.90

### Patterns Learned (5)
- EventBus for all cross-layer communication
- Audit all state changes
- Trust levels on every message
...

### Fixes Applied (2)
- Fixed hash chain verification on startup
- Resolved memory leak in websocket handler
```

## Integration with Briefings

Results from time research can feed into:

- Morning briefings (week context)
- Evening summaries (day context)
- Weekly reviews (full week context)

## Notes

- High-confidence results (>0.8) are highlighted
- Results are sorted by date (newest first)
- Maximum 50 results per query (paginate for more)
