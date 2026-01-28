---
name: ari-memory-management
description: ARI's provenance-tracked memory system for knowledge persistence
triggers:
  - "memory storage"
  - "store knowledge"
  - "memory manager"
  - "provenance tracking"
---

# ARI Memory Management

## Purpose

Manage ARI's provenance-tracked memory system for persistent knowledge storage with full audit trails.

## Memory Architecture

```
~/.ari/
├── memory/
│   ├── facts/           # Verified facts
│   ├── contexts/        # Domain contexts
│   ├── preferences/     # User preferences
│   └── learned/         # Learned patterns
├── audit.json           # Hash-chained audit
└── config.json          # Configuration
```

## Provenance Tracking

Every piece of stored knowledge includes provenance:

```typescript
interface MemoryEntry {
  id: string;
  content: unknown;
  provenance: {
    source: string;           // Where it came from
    trustLevel: TrustLevel;   // Trust at storage time
    timestamp: string;        // When stored
    agent: string;            // Which agent stored it
    validation: {
      method: string;         // How it was validated
      confidence: number;     // Confidence score 0-1
    };
  };
  metadata: {
    domain: string;           // Life domain (health, career, etc.)
    tags: string[];           // Searchable tags
    expiresAt?: string;       // Optional expiration
  };
}
```

## Memory Operations

### Store
```typescript
async function store(
  key: string,
  content: unknown,
  options: StoreOptions
): Promise<MemoryEntry> {
  const entry: MemoryEntry = {
    id: uuid(),
    content,
    provenance: {
      source: options.source,
      trustLevel: options.trustLevel || 'STANDARD',
      timestamp: new Date().toISOString(),
      agent: options.agent,
      validation: options.validation || { method: 'none', confidence: 0.5 }
    },
    metadata: options.metadata || {}
  };

  // Audit the storage operation
  await eventBus.emit('audit:log', {
    action: 'memory_store',
    key,
    entryId: entry.id,
    provenance: entry.provenance
  });

  await persist(key, entry);
  return entry;
}
```

### Retrieve
```typescript
async function retrieve(
  key: string,
  options: RetrieveOptions = {}
): Promise<MemoryEntry | null> {
  const entry = await load(key);

  if (!entry) return null;

  // Check trust requirements
  if (options.minTrust && !meetsMinTrust(entry.provenance.trustLevel, options.minTrust)) {
    logger.warn({ key, entryTrust: entry.provenance.trustLevel },
      'Entry below minimum trust');
    return null;
  }

  // Check expiration
  if (entry.metadata.expiresAt && new Date(entry.metadata.expiresAt) < new Date()) {
    await remove(key);
    return null;
  }

  // Audit the retrieval
  await eventBus.emit('audit:log', {
    action: 'memory_retrieve',
    key,
    entryId: entry.id
  });

  return entry;
}
```

### Search
```typescript
async function search(query: SearchQuery): Promise<MemoryEntry[]> {
  const results = await searchIndex({
    domain: query.domain,
    tags: query.tags,
    minConfidence: query.minConfidence,
    minTrust: query.minTrust
  });

  // Filter and sort by relevance
  return results
    .filter(e => passesFilters(e, query))
    .sort((a, b) => b.provenance.validation.confidence - a.provenance.validation.confidence);
}
```

## Domain Contexts

ARI organizes memory by life domains:

| Domain | Purpose |
|--------|---------|
| `health` | Health and wellness data |
| `career` | Professional information |
| `finance` | Financial data |
| `family` | Family and relationships |
| `learning` | Educational content |
| `systems` | Technical systems |
| `ventures` | Business ventures |

```typescript
// Store in specific domain
await memoryManager.store('workout_routine', routineData, {
  metadata: { domain: 'health', tags: ['exercise', 'daily'] }
});

// Search within domain
const healthMemories = await memoryManager.search({
  domain: 'health',
  tags: ['exercise']
});
```

## Venture Isolation

Each venture has isolated memory partition:

```typescript
const ventureMemory = await memoryManager.getPartition('pryceless-solutions');

// Operations within partition
await ventureMemory.store('client_list', clients);
await ventureMemory.retrieve('client_list');

// Cannot access other partitions
await ventureMemory.retrieve('personal_health'); // Returns null
```

## Memory Lifecycle

```
CREATE → VALIDATE → STORE → INDEX → (RETRIEVE)* → EXPIRE/DELETE
           ↓
        AUDIT (every step)
```

## Garbage Collection

```typescript
// Periodic cleanup
async function gc() {
  const expired = await findExpired();
  const lowConfidence = await findLowConfidence(0.3);

  for (const entry of [...expired, ...lowConfidence]) {
    await archive(entry); // Move to archive before deletion
    await remove(entry.id);
  }

  await eventBus.emit('audit:log', {
    action: 'memory_gc',
    removed: expired.length + lowConfidence.length
  });
}
```

## Backup & Restore

```bash
# Backup memory
npx ari memory export --output backup.json

# Restore memory
npx ari memory import --input backup.json

# Verify integrity
npx ari memory verify
```
