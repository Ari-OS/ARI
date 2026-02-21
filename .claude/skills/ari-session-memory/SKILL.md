---
name: ari-session-memory
description: Persist and retrieve context across Claude Code sessions
---

# ARI Session Memory

## Purpose

Preserve important context, decisions, and state across Claude Code sessions so ARI maintains continuity of knowledge and doesn't forget important learnings.

## Memory Types

### 1. Session Context

Current working state:

- Active tasks
- Recent decisions
- Current focus area
- Pending items

### 2. Project Memory

Long-term project knowledge:

- Architecture decisions (ADRs)
- Coding conventions
- Known issues
- Team preferences

### 3. Pattern Library

Reusable solutions:

- Code patterns
- Testing patterns
- Debugging approaches
- Optimization techniques

### 4. Interaction History

User-specific context:

- Preferred workflows
- Communication style
- Common requests
- Past interactions

## Memory Persistence

### Automatic Persistence

Via hooks and MCP:

```
Session end → Extract key learnings → Store via ari_memory_store
Session start → Retrieve relevant context → Load into working memory
```

### Manual Persistence

Via commands:

- `/ari-learn` - Capture session learnings
- `/ari-remember [key] [value]` - Store specific item
- `/ari-recall [key]` - Retrieve specific item

## Memory Schema

```typescript
interface SessionMemory {
  key: string;
  category: 'context' | 'project' | 'pattern' | 'interaction';
  domain: string;
  content: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    accessCount: number;
    confidence: number;
    source: string;
  };
  tags: string[];
  relatedKeys: string[];
}
```

## Retrieval Strategies

### 1. Explicit Retrieval

User requests specific memory:

```
User: "What was the decision about caching?"
→ Search: domain=decisions, query=caching
```

### 2. Contextual Retrieval

Automatic based on current work:

```
Working on: src/kernel/audit.ts
→ Auto-load: patterns related to audit, recent audit decisions
```

### 3. Similarity Search

Find related memories:

```
Current task: "Implement rate limiting"
→ Find: patterns for throttling, previous rate limit implementations
```

## Memory Lifecycle

### Creation

1. Extract from session
2. Validate relevance
3. Assign category and tags
4. Store with provenance

### Access

1. Retrieve on demand
2. Update access count
3. Refresh confidence based on usage

### Decay

1. Rarely accessed items lose confidence
2. Contradicted items are flagged
3. Outdated items are archived

### Consolidation

1. Related items are linked
2. Duplicates are merged
3. Patterns are extracted from instances

## Integration with ARI Memory Manager

The session memory skill integrates with ARI's MemoryManager:

```typescript
// Store session learning
await memoryManager.store({
  key: 'session_learning_20240127',
  content: 'Circuit breaker pattern works well for external API calls',
  domain: 'patterns',
  tags: ['resilience', 'api', 'circuit-breaker'],
  source: 'CLAUDE_CODE_SESSION'
});

// Retrieve relevant context
const context = await memoryManager.search({
  domain: 'patterns',
  tags: ['api'],
  limit: 5
});
```

## Best Practices

1. **Be Specific**: Store specific, actionable knowledge, not vague observations
2. **Use Tags**: Good tags make retrieval effective
3. **Include Context**: Why is this knowledge important?
4. **Link Related Items**: Connect related memories
5. **Review Periodically**: Clean up outdated or incorrect memories
