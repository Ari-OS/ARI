---
name: ari-recall
description: Retrieve information from ARI's memory
---

# /ari-recall

Retrieve stored memories from ARI's memory system.

## Usage

```
/ari-recall <key>           # Exact key lookup
/ari-recall search <query>  # Search by content
/ari-recall domain <name>   # List by domain
/ari-recall recent [n]      # Recent memories (default: 10)
```

## Examples

### Exact Retrieval

```
/ari-recall auth_pattern
→ "Use JWT with 24h expiry for API auth"
```

### Search

```
/ari-recall search caching
→ Found 3 memories:
  - caching_pattern: "Use LRU cache with 1000 item limit..."
  - redis_decision: "Chose Redis for distributed caching..."
  - cache_gotcha: "Remember to invalidate on writes..."
```

### Domain Listing

```
/ari-recall domain patterns
→ Patterns (12 items):
  - caching_pattern
  - circuit_breaker_pattern
  - retry_pattern
  ...
```

### Recent Memories

```
/ari-recall recent 5
→ Last 5 memories:
  1. [2024-01-27] auth_pattern
  2. [2024-01-27] vitest_gotcha
  ...
```

## Output Format

### Single Memory

```markdown
## Memory: [key]

**Category**: [category]
**Domain**: [domain]
**Tags**: [tags]
**Stored**: [timestamp]
**Confidence**: [0-1]

### Content
[The stored content]

### Related
- [related_key_1]
- [related_key_2]
```

### Search Results

```markdown
## Search Results: "[query]"

Found X memories:

### 1. [key] (confidence: X)
[Content preview...]

### 2. [key] (confidence: X)
[Content preview...]
```

## Tips

- Use specific keys for exact retrieval
- Use search for fuzzy matching
- Browse domains to discover related knowledge
- Check recent memories for context continuity
