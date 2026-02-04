# ARI Memory Model

ARI's memory system is built on **provenance tracking**, **confidence decay**, and **partitioned storage** to ensure trustworthiness, relevance, and privacy.

## Memory Structure

Every memory has **seven core attributes**:

```typescript
interface Memory {
  id: string;                    // Unique identifier (UUID)
  content: string;               // The actual memory content
  source: MemorySource;          // Where this came from
  trustLevel: TrustLevel;        // SYSTEM, OPERATOR, VERIFIED, STANDARD, UNTRUSTED, HOSTILE
  confidence: number;            // 0.0 - 1.0 (decays over time)
  partition: MemoryPartition;    // PUBLIC, INTERNAL, SENSITIVE
  provenance: ProvenanceChain;   // Full audit trail
  created: string;               // ISO 8601 timestamp
  accessed: string;              // Last access timestamp
  tags: string[];                // Searchable tags
}
```

## Provenance Tracking

Every memory tracks **how it was created and who touched it**.

### Provenance Chain

```typescript
interface ProvenanceChain {
  genesis: {
    source: 'USER_INPUT' | 'AGENT_INFERENCE' | 'EXTERNAL_API' | 'SYSTEM';
    agent: string;              // Which agent created this
    context: string;            // What prompted creation
    timestamp: string;
  };
  modifications: Array<{
    agent: string;              // Which agent modified this
    operation: 'UPDATE' | 'MERGE' | 'SPLIT' | 'TAG' | 'RECLASSIFY';
    reason: string;             // Why this modification
    timestamp: string;
    previousState: string;      // Hash of prior state
  }>;
  verifications: Array<{
    agent: string;              // Which agent verified this
    outcome: 'CONFIRMED' | 'QUESTIONED' | 'REFUTED';
    evidence: string;           // Supporting evidence
    timestamp: string;
  }>;
}
```

### Why Provenance Matters

1. **Trustworthiness**: User input is more trustworthy than inferred data
2. **Auditability**: "Why does ARI believe X?" can be answered with full chain
3. **Correction**: If source is discovered to be unreliable, all derived memories can be re-evaluated
4. **Learning**: Provenance patterns reveal which sources produce reliable information

### Example Provenance Chain

```
Memory: "User prefers verbose explanations"

Genesis:
  Source: AGENT_INFERENCE
  Agent: NEXUS
  Context: "User said 'explain that more' 3 times in past week"
  Timestamp: 2026-01-15T10:30:00Z

Modifications:
  [1] Agent: NEXUS
      Operation: UPDATE
      Reason: "User said 'just do it, skip explanation'"
      Timestamp: 2026-01-20T14:22:00Z
      PreviousState: 0x7a3f...

  [2] Agent: NEXUS
      Operation: UPDATE
      Reason: "Pattern shift: 5 'just do it' in past 3 days"
      Timestamp: 2026-01-22T09:15:00Z
      PreviousState: 0x4b2e...

Verifications:
  [1] Agent: NEXUS
      Outcome: QUESTIONED
      Evidence: "Conflicting signals: verbose requests in planning phase, terse in execution phase"
      Timestamp: 2026-01-23T11:00:00Z

Final State: "User prefers verbose explanations during planning, terse during execution"
```

## Memory Partitions

Memories are segregated into **three partitions** for privacy and security.

### PUBLIC Partition

**Definition**: Information that can be freely shared or referenced.

**Examples**:
- General knowledge (programming languages, frameworks)
- Public facts (historical events, scientific principles)
- User's explicitly shared preferences

**Access**: All agents, all trust levels

**Storage**: `~/.ari/memory/public/`

### INTERNAL Partition

**Definition**: Operational data needed for ARI to function but not shareable externally.

**Examples**:
- User's task history
- Communication patterns
- Inferred preferences
- Project structures

**Access**: ARI agents only, STANDARD trust or higher

**Storage**: `~/.ari/memory/internal/`

### SENSITIVE Partition

**Definition**: Private information requiring maximum protection.

**Examples**:
- Passwords, API keys (encrypted)
- Financial data
- Personal health information
- Private communications

**Access**: Restricted agents (BOLT, AEGIS), OPERATOR trust or higher

**Storage**: `~/.ari/memory/sensitive/` (encrypted at rest)

**Encryption**: AES-256-GCM with key derived from creator's master password

### Partition Boundaries

Cross-partition references are **hashed**, not plaintext:

```typescript
// ✓ CORRECT: Reference without exposing
{
  partition: 'PUBLIC',
  content: 'User has API credentials stored',
  reference: 'sha256:7f3a2b...' // Hash of sensitive memory ID
}

// ✗ WRONG: Exposing sensitive data in public partition
{
  partition: 'PUBLIC',
  content: 'User API key: sk-abc123...' // VIOLATION
}
```

## Confidence Scores

Every memory has a **confidence score** (0.0 - 1.0) that represents **how certain ARI is that this memory is accurate**.

### Initial Confidence

```typescript
function initialConfidence(source: MemorySource): number {
  switch (source) {
    case 'USER_INPUT': return 0.95; // User explicitly stated
    case 'AGENT_INFERENCE': return 0.70; // Inferred from patterns
    case 'EXTERNAL_API': return 0.85; // Verified external data
    case 'SYSTEM': return 1.0; // System-level truth
    default: return 0.50; // Unknown source
  }
}
```

### Temporal Decay

Confidence decays over time based on **memory type**:

```typescript
interface DecayProfile {
  halfLife: number; // Days until confidence halves
  floor: number;    // Minimum confidence (never drops below)
}

const decayProfiles: Record<MemoryType, DecayProfile> = {
  FACT: { halfLife: 365, floor: 0.3 },        // Facts decay slowly
  PREFERENCE: { halfLife: 90, floor: 0.2 },   // Preferences change
  EVENT: { halfLife: 180, floor: 0.1 },       // Events remain but fade
  PATTERN: { halfLife: 60, floor: 0.3 },      // Patterns shift quickly
  KNOWLEDGE: { halfLife: 730, floor: 0.4 },   // Knowledge is durable
};
```

**Decay Formula**:
```typescript
function decayConfidence(
  initialConfidence: number,
  daysSinceCreation: number,
  halfLife: number,
  floor: number
): number {
  const decayed = initialConfidence * Math.pow(0.5, daysSinceCreation / halfLife);
  return Math.max(decayed, floor);
}
```

**Example**:
```
Memory: "User prefers dark mode"
Type: PREFERENCE
Initial Confidence: 0.95
Half-Life: 90 days
Floor: 0.2

After 90 days: 0.95 × 0.5 = 0.475
After 180 days: 0.95 × 0.25 = 0.2375
After 270 days: 0.95 × 0.125 = 0.119 → Floor = 0.2
```

### Confidence Boosting

Confidence can be **re-boosted** through:
1. **Re-confirmation**: User re-states preference → Reset to initial confidence
2. **Verification**: External evidence supports memory → Increase by 0.1 (max 1.0)
3. **Consistent Pattern**: Repeated observations align with memory → Increase by 0.05/occurrence

## Quarantine Mechanism

Memories from **UNTRUSTED** sources are quarantined until verified.

### Quarantine Process

```
1. Memory arrives with UNTRUSTED trust level
   ↓
2. Store in quarantine (flag: isQuarantined = true)
   ↓
3. Guardian evaluates:
   - Does this conflict with existing memories?
   - Are there injection patterns?
   - Is the source known to be unreliable?
   ↓
4. Outcome:
   - SAFE: Promote to STANDARD, remove quarantine flag
   - SUSPICIOUS: Keep quarantined, require manual approval
   - HOSTILE: Delete, log threat
```

### Quarantine Indicators

```typescript
interface QuarantinedMemory extends Memory {
  isQuarantined: true;
  quarantineReason: string;
  reviewRequired: boolean;
  threatScore: number; // 0-10
}
```

**Example**:
```json
{
  "id": "mem_7f3a2b",
  "content": "User password is 'admin123'",
  "source": "EXTERNAL_API",
  "trustLevel": "UNTRUSTED",
  "isQuarantined": true,
  "quarantineReason": "Suspicious: Password in plaintext from untrusted source",
  "reviewRequired": true,
  "threatScore": 8
}
```

## Knowledge Indexing

Memories are indexed for **fast semantic search** using vector embeddings.

### Indexing Process

```
1. Memory created
   ↓
2. Generate embedding vector (1536 dimensions)
   ↓
3. Store in vector database (FAISS or similar)
   ↓
4. Tag with metadata (partition, trust level, confidence, date)
```

### Search Modes

**Semantic Search** (default):
```typescript
const results = await memory.search({
  query: "What are user's preferences for code style?",
  mode: 'semantic',
  topK: 10,
  confidenceThreshold: 0.5,
  partitions: ['PUBLIC', 'INTERNAL'],
});
```

**Exact Match**:
```typescript
const results = await memory.search({
  query: "API key for OpenAI",
  mode: 'exact',
  partitions: ['SENSITIVE'],
});
```

**Temporal Search**:
```typescript
const results = await memory.search({
  query: "Recent decisions about architecture",
  mode: 'semantic',
  dateRange: { start: '2026-01-01', end: '2026-02-01' },
});
```

### Search Ranking

Results ranked by:
```
Score = (Semantic Similarity × Confidence × Trust Multiplier) / Age

Where:
- Semantic Similarity: Cosine similarity (0-1)
- Confidence: Memory confidence score (0-1)
- Trust Multiplier: Higher trust = higher rank
- Age: Days since creation (recency boost)
```

## Forgetting

ARI **forgets** memories under specific conditions.

### When to Forget

| Condition | Action |
|-----------|--------|
| Confidence < 0.1 | Archive (move to cold storage) |
| Unused for 365 days | Archive |
| User requests deletion | Delete immediately |
| Memory refuted by evidence | Archive with refutation note |
| Duplicate memories | Merge, delete redundant |
| Sensitive data expired | Purge (unrecoverable delete) |

### Forgetting Process

**Archive** (soft delete):
```
1. Move memory to `~/.ari/memory/archive/`
2. Remove from active index
3. Retain for audit/recovery (365 days)
4. After retention period, purge
```

**Purge** (hard delete):
```
1. Encrypt memory with random key
2. Delete encryption key
3. Overwrite disk sectors (3-pass Gutmann)
4. Log deletion to audit chain (hash only, not content)
```

### Right to Be Forgotten

If user requests deletion of specific data:
```
1. Identify all memories containing that data
2. Purge immediately (no archival)
3. Update provenance chains to note deletion
4. Emit 'memory:purged' event to audit log
```

## Memory Updates

### Update Types

**REPLACE** (full overwrite):
```typescript
await memory.update(memoryId, {
  operation: 'REPLACE',
  newContent: "User prefers light mode",
  reason: "User explicitly stated preference changed",
});
```

**MERGE** (combine multiple memories):
```typescript
await memory.merge([memoryId1, memoryId2], {
  strategy: 'union', // or 'intersection', 'prioritize'
  reason: "Consolidating duplicate information",
});
```

**TAG** (add metadata):
```typescript
await memory.tag(memoryId, {
  tags: ['preference', 'ui', 'dark-mode'],
  reason: "Improving searchability",
});
```

**RECLASSIFY** (change partition/trust level):
```typescript
await memory.reclassify(memoryId, {
  newPartition: 'SENSITIVE',
  reason: "Memory contains API credentials",
});
```

## Memory Conflicts

When new memory conflicts with existing memory, use **conflict resolution**:

### Resolution Strategies

**Trust-Based** (default):
```
Higher trust source wins.
OPERATOR > STANDARD > UNTRUSTED
```

**Recency-Based**:
```
More recent memory wins (assumes preferences change).
```

**Confidence-Based**:
```
Higher confidence wins (regardless of recency).
```

**Human-in-the-Loop**:
```
Surface conflict to user, ask for resolution.
```

### Example Conflict

```
Memory A: "User prefers verbose explanations" (confidence: 0.7, age: 30 days)
Memory B: "User prefers terse responses" (confidence: 0.9, age: 2 days)

Resolution: Memory B wins (higher confidence + more recent)

Action: Archive Memory A, promote Memory B
```

## Implementation Details

### Storage Layers

```
~/.ari/memory/
├── public/           # PUBLIC partition (unencrypted)
├── internal/         # INTERNAL partition (unencrypted)
├── sensitive/        # SENSITIVE partition (AES-256-GCM encrypted)
├── archive/          # Soft-deleted memories (365-day retention)
└── index/            # Vector embeddings (FAISS)
```

### Code References

- **Memory Manager**: `src/agents/memory-manager.ts`
- **Provenance Tracking**: Lines 85-120
- **Confidence Decay**: Lines 145-175
- **Quarantine**: Lines 200-240
- **Search**: Lines 270-310

---

**Next**: [05-personality-matrix.md](05-personality-matrix.md) — ARI's Council
