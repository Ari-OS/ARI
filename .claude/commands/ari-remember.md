---
name: ari-remember
description: Store information in ARI's memory for future sessions
---

# /ari-remember

Store important information in ARI's memory system for retrieval in future sessions.

## Usage

```
/ari-remember <key> <value>
```

## Examples

```
/ari-remember auth_pattern "Use JWT with 24h expiry for API auth"

/ari-remember deploy_checklist "1. Run tests 2. Check coverage 3. Verify audit chain 4. Build 5. Deploy"

/ari-remember gotcha_vitest "Vitest requires .js extensions in ESM imports"
```

## Memory Categories

When storing, the system automatically categorizes based on key patterns:

| Key Pattern | Category | Example |
|-------------|----------|---------|
| `*_pattern` | patterns | `caching_pattern` |
| `*_decision` | decisions | `auth_decision` |
| `*_gotcha` | gotchas | `vitest_gotcha` |
| `*_fix` | fixes | `memory_leak_fix` |
| `*_pref` | preferences | `style_pref` |

## Storage Details

When you use `/ari-remember`:

1. Content is stored via `ari_memory_store` (MCP)
2. Timestamp and source recorded
3. Tags auto-generated from content
4. Confidence set to 1.0 (explicit storage)

## Retrieval

Use `/ari-recall <key>` to retrieve stored memories.

## Best Practices

- **Descriptive keys**: Use `module_topic_type` format
- **Concise values**: Store actionable information
- **Use patterns**: Follow the key patterns for auto-categorization

## Memory Persistence

Memories are stored in:

1. ARI's MemoryManager (runtime)
2. `~/.ari/memory.json` (persistent)
3. Searchable via MCP tools
