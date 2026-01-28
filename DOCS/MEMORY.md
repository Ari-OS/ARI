# 🖤 ARI MEMORY SYSTEM

> **Memory Types, Provenance, Poisoning Defenses & Rollback**

**Version:** 11.0  
**Status:** Production Ready  
**Classification:** TECHNICAL DOCUMENTATION  

---

## Memory Philosophy

ARI's memory system follows **Intelligence Hygiene** principles:

1. **Provenance is Sacred** — Every memory knows its origin
2. **Confidence is Earned** — Trust builds over time
3. **Corruption is Recoverable** — Rollback is always possible
4. **Isolation Prevents Spread** — Untrusted memories are quarantined

---

## Memory Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MEMORY MANAGER                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Write     │  │    Read     │  │   Search    │        │
│  │   Handler   │  │   Handler   │  │   Handler   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │
│         └────────────────┼────────────────┘                │
│                          │                                 │
│  ┌───────────────────────┼───────────────────────────┐    │
│  │              Validation Layer                      │    │
│  │  • Provenance check  • Confidence scoring          │    │
│  │  • Hash verification • Permission check            │    │
│  └───────────────────────┼───────────────────────────┘    │
│                          │                                 │
│  ┌───────────────────────┼───────────────────────────┐    │
│  │              Storage Layer                         │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐           │    │
│  │  │  Core   │  │ Session │  │ Archive │           │    │
│  │  │ Memory  │  │ Memory  │  │         │           │    │
│  │  └─────────┘  └─────────┘  └─────────┘           │    │
│  └───────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Memory Types

### Type Classification

| Type | Purpose | Retention | Trust Requirement |
|------|---------|-----------|-------------------|
| **FACT** | Verified information | Long-term | HIGH |
| **PREFERENCE** | Operator preferences | Long-term | TRUSTED source |
| **PATTERN** | Learned behaviors | Medium-term | Validated outcomes |
| **CONTEXT** | Session state | Session | Any source |
| **DECISION** | Past decisions | Long-term | TRUSTED source |
| **QUARANTINE** | Untrusted data | Until reviewed | None (isolated) |

### Memory Entry Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "type", "content", "provenance", "created_at", "hash"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique identifier"
    },
    "type": {
      "type": "string",
      "enum": ["FACT", "PREFERENCE", "PATTERN", "CONTEXT", "DECISION", "QUARANTINE"],
      "description": "Memory classification"
    },
    "content": {
      "type": "string",
      "maxLength": 10000,
      "description": "The actual memory content"
    },
    "provenance": {
      "type": "object",
      "required": ["source", "trust_level", "agent"],
      "properties": {
        "source": {
          "type": "string",
          "description": "Where this memory came from"
        },
        "trust_level": {
          "type": "string",
          "enum": ["TRUSTED", "SEMI_TRUSTED", "UNTRUSTED"]
        },
        "agent": {
          "type": "string",
          "description": "Agent that created this memory"
        },
        "request_id": {
          "type": "string",
          "description": "Original request that triggered creation"
        },
        "chain": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Full provenance chain if derived"
        }
      }
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Confidence score (0.0 - 1.0)"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time"
    },
    "expires_at": {
      "type": "string",
      "format": "date-time",
      "description": "When this memory expires (null = never)"
    },
    "approved_by": {
      "type": "string",
      "description": "Who approved this memory (if approval required)"
    },
    "hash": {
      "type": "string",
      "description": "SHA-256 hash of content for integrity"
    },
    "supersedes": {
      "type": "string",
      "description": "ID of memory this replaces"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Categorization tags"
    },
    "access_count": {
      "type": "integer",
      "description": "How many times this memory has been read"
    },
    "last_accessed": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

### Example Memory Entry

```json
{
  "id": "mem_abc123",
  "type": "PREFERENCE",
  "content": "Operator prefers direct communication style without excessive pleasantries",
  "provenance": {
    "source": "operator_direct",
    "trust_level": "TRUSTED",
    "agent": "learning",
    "request_id": "req_xyz789",
    "chain": ["operator_direct"]
  },
  "confidence": 1.0,
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z",
  "expires_at": null,
  "approved_by": "operator",
  "hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "supersedes": null,
  "tags": ["communication", "style", "operator"],
  "access_count": 47,
  "last_accessed": "2026-01-26T09:15:00Z"
}
```

---

## Provenance System

### Source Tracking

Every memory entry tracks:

```yaml
provenance_fields:
  source:
    description: "Original source of information"
    examples:
      - "operator_direct"       # Direct operator input
      - "web_content:url"       # From specific URL
      - "email:sender@domain"   # From email
      - "file:filename.ext"     # From file
      - "api:service_name"      # From API
      - "agent:agent_id"        # Derived by agent
      
  trust_level:
    TRUSTED: "From operator or system"
    SEMI_TRUSTED: "From validated external source"
    UNTRUSTED: "From unknown or unverified source"
    
  chain:
    description: "Full derivation history"
    example:
      - "web_content:example.com"  # Original source
      - "agent:research"            # Extracted by research
      - "agent:learning"            # Processed by learning
```

### Provenance Verification

```python
def verify_provenance(memory: MemoryEntry) -> ProvenanceResult:
    """
    Verify that a memory entry has valid provenance.
    """
    # Check required fields
    if not memory.provenance:
        return ProvenanceResult(valid=False, reason="Missing provenance")
    
    if not memory.provenance.source:
        return ProvenanceResult(valid=False, reason="Missing source")
    
    # Verify trust level is appropriate for memory type
    if memory.type in ["FACT", "PREFERENCE", "DECISION"]:
        if memory.provenance.trust_level == "UNTRUSTED":
            return ProvenanceResult(
                valid=False,
                reason=f"{memory.type} cannot have UNTRUSTED provenance"
            )
    
    # Verify chain integrity
    if memory.provenance.chain:
        for i, link in enumerate(memory.provenance.chain):
            if not is_valid_source(link):
                return ProvenanceResult(
                    valid=False,
                    reason=f"Invalid chain link at position {i}: {link}"
                )
    
    return ProvenanceResult(valid=True)
```

---

## Confidence Scoring

### Confidence Calculation

```yaml
confidence_rules:
  base_scores:
    TRUSTED: 1.0
    SEMI_TRUSTED: 0.7
    UNTRUSTED: 0.3
    
  modifiers:
    corroboration: "+0.1 per independent confirmation"
    contradiction: "-0.2 per contradicting source"
    age: "-0.05 per month for volatile facts"
    access_frequency: "+0.02 per 10 accesses (max +0.1)"
    operator_validation: "+0.3"
    
  thresholds:
    high_confidence: ">= 0.8"
    medium_confidence: "0.5 - 0.79"
    low_confidence: "< 0.5"
    
  actions:
    high_confidence: "Use freely"
    medium_confidence: "Use with caveat"
    low_confidence: "Verify before use or quarantine"
```

### Confidence Decay

```python
def calculate_confidence_decay(memory: MemoryEntry) -> float:
    """
    Calculate confidence decay based on age and type.
    """
    age_days = (now() - memory.created_at).days
    
    # Different decay rates by type
    decay_rates = {
        "FACT": 0.001,      # Very slow decay
        "PREFERENCE": 0.002, # Slow decay
        "PATTERN": 0.005,    # Moderate decay
        "CONTEXT": 0.1,      # Fast decay
        "DECISION": 0.001,   # Very slow decay
    }
    
    rate = decay_rates.get(memory.type, 0.01)
    decay = age_days * rate
    
    return max(0.1, memory.confidence - decay)
```

---

## Write Policies

### Write Authorization

| Memory Type | Source Required | Approval Required | Quarantine Period |
|-------------|-----------------|-------------------|-------------------|
| FACT | TRUSTED or validated | Yes for SEMI_TRUSTED | 24h if SEMI_TRUSTED |
| PREFERENCE | TRUSTED only | No | N/A |
| PATTERN | Any (confidence varies) | Yes if low confidence | Until validated |
| CONTEXT | Any | No | N/A |
| DECISION | TRUSTED only | No | N/A |
| QUARANTINE | Any | N/A | Until reviewed |

### Write Flow

```
[Write Request]
       │
       ▼
┌──────────────┐
│ Validate     │
│ Schema       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Check        │
│ Provenance   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Calculate    │
│ Confidence   │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Approval     │────▶│ Queue for    │
│ Required?    │ Yes │ Approval     │
└──────┬───────┘     └──────────────┘
       │ No
       ▼
┌──────────────┐     ┌──────────────┐
│ Quarantine   │────▶│ Add to       │
│ Required?    │ Yes │ Quarantine   │
└──────┬───────┘     └──────────────┘
       │ No
       ▼
┌──────────────┐
│ Compute Hash │
│ Store Memory │
│ Log Write    │
└──────────────┘
```

### Write Handler

```python
async def write_memory(entry: MemoryEntry, context: WriteContext) -> WriteResult:
    """
    Handle memory write with full validation and policy enforcement.
    """
    # Step 1: Validate schema
    validation = validate_schema(entry)
    if not validation.valid:
        return WriteResult(success=False, error=validation.error)
    
    # Step 2: Verify provenance
    provenance = verify_provenance(entry)
    if not provenance.valid:
        return WriteResult(success=False, error=provenance.reason)
    
    # Step 3: Calculate confidence
    entry.confidence = calculate_confidence(entry)
    
    # Step 4: Check if approval required
    if requires_approval(entry):
        approval_request = create_approval_request(entry)
        return WriteResult(
            success=False,
            pending_approval=True,
            approval_request=approval_request
        )
    
    # Step 5: Check if quarantine required
    if requires_quarantine(entry):
        entry.type = "QUARANTINE"
        entry.expires_at = now() + QUARANTINE_PERIOD
    
    # Step 6: Compute integrity hash
    entry.hash = compute_hash(entry.content)
    
    # Step 7: Store
    stored = await storage.write(entry)
    
    # Step 8: Audit log
    audit_log(
        event="MEMORY_WRITE",
        memory_id=entry.id,
        type=entry.type,
        source=entry.provenance.source,
        confidence=entry.confidence
    )
    
    return WriteResult(success=True, memory_id=entry.id)
```

---

## Memory Poisoning Defenses

### Attack Vectors

| Vector | Description | Defense |
|--------|-------------|---------|
| Direct injection | Malicious content written directly | Provenance + approval |
| Gradual corruption | Repeated false information | Confidence decay + validation |
| Pattern manipulation | Fake outcomes to skew learning | Outcome verification |
| Contradiction flood | Many conflicting facts | Contradiction detection |
| Trust escalation | Claim higher trust than warranted | Strict source verification |

### Defense Mechanisms

#### 1. Provenance Verification

```yaml
provenance_defense:
  rule: "No memory can upgrade its trust level post-creation"
  enforcement:
    - Source locked at write time
    - Chain verified for each link
    - Derived memories inherit lowest trust
```

#### 2. Confidence Bounds

```yaml
confidence_defense:
  rule: "UNTRUSTED sources cannot exceed 0.5 confidence"
  rule: "Only operator can set confidence > 0.9"
  rule: "Confidence cannot increase without corroboration"
```

#### 3. Contradiction Detection

```python
def check_contradiction(new_entry: MemoryEntry) -> ContradictionResult:
    """
    Check if new memory contradicts existing memories.
    """
    related = search_related_memories(new_entry)
    
    contradictions = []
    for existing in related:
        similarity = semantic_similarity(new_entry.content, existing.content)
        
        if similarity > 0.8:  # Very similar
            if is_contradictory(new_entry.content, existing.content):
                contradictions.append({
                    "existing_id": existing.id,
                    "existing_confidence": existing.confidence,
                    "conflict_type": "direct_contradiction"
                })
    
    if contradictions:
        # If new entry has lower confidence, flag it
        if new_entry.confidence < max(c["existing_confidence"] for c in contradictions):
            return ContradictionResult(
                has_contradiction=True,
                action="REJECT_NEW",
                details=contradictions
            )
        else:
            return ContradictionResult(
                has_contradiction=True,
                action="ESCALATE",
                details=contradictions
            )
    
    return ContradictionResult(has_contradiction=False)
```

#### 4. Quarantine System

```yaml
quarantine_policy:
  triggers:
    - UNTRUSTED source
    - Low confidence (< 0.4)
    - Contradiction detected
    - Pattern anomaly
    
  quarantine_rules:
    - Cannot be used in decisions
    - Cannot influence other memories
    - Reviewed within 24 hours
    - Auto-expire if not reviewed
    
  release_criteria:
    - Operator approval
    - Corroboration from TRUSTED source
    - Passed contradiction check
```

#### 5. Integrity Verification

```python
def verify_integrity(memory: MemoryEntry) -> bool:
    """
    Verify memory has not been tampered with.
    """
    computed_hash = compute_hash(memory.content)
    return computed_hash == memory.hash
```

---

## Rollback System

### Rollback Capabilities

| Level | Scope | Method | Time Range |
|-------|-------|--------|------------|
| Entry | Single memory | Restore from version history | Any time |
| Batch | Multiple memories | Restore from checkpoint | Up to 90 days |
| Full | Entire memory store | Restore from backup | Up to 30 days |

### Version History

Every memory maintains version history:

```json
{
  "memory_id": "mem_abc123",
  "current_version": 3,
  "versions": [
    {
      "version": 1,
      "content": "Original content",
      "hash": "sha256:...",
      "created_at": "2026-01-15T10:30:00Z",
      "superseded_at": "2026-01-18T14:00:00Z",
      "superseded_by": 2
    },
    {
      "version": 2,
      "content": "Updated content",
      "hash": "sha256:...",
      "created_at": "2026-01-18T14:00:00Z",
      "superseded_at": "2026-01-22T09:00:00Z",
      "superseded_by": 3
    },
    {
      "version": 3,
      "content": "Current content",
      "hash": "sha256:...",
      "created_at": "2026-01-22T09:00:00Z",
      "superseded_at": null,
      "superseded_by": null
    }
  ]
}
```

### Rollback Procedure

```python
async def rollback_memory(
    memory_id: str,
    target_version: int = None,
    target_time: datetime = None
) -> RollbackResult:
    """
    Rollback a memory to a previous state.
    """
    # Get memory and history
    memory = await storage.get(memory_id)
    history = await storage.get_history(memory_id)
    
    # Determine target version
    if target_version:
        target = find_version(history, target_version)
    elif target_time:
        target = find_version_at_time(history, target_time)
    else:
        target = history.versions[-2]  # Previous version
    
    if not target:
        return RollbackResult(success=False, error="Target version not found")
    
    # Create new version with rolled-back content
    new_version = MemoryVersion(
        version=memory.current_version + 1,
        content=target.content,
        hash=target.hash,
        created_at=now(),
        rollback_from=memory.current_version,
        rollback_to=target.version,
        rollback_reason="Manual rollback"
    )
    
    # Store new version
    await storage.update(memory_id, new_version)
    
    # Audit log
    audit_log(
        event="MEMORY_ROLLBACK",
        memory_id=memory_id,
        from_version=memory.current_version,
        to_version=target.version
    )
    
    return RollbackResult(success=True, new_version=new_version.version)
```

### Checkpoint System

```yaml
checkpoints:
  automatic:
    frequency: "daily"
    time: "02:00"
    retention: "90 days"
    
  manual:
    trigger: "operator command"
    retention: "indefinite"
    
  format:
    type: "sqlite_backup"
    compression: "gzip"
    encryption: "AES-256"
    
  recovery:
    procedure:
      - Stop ARI
      - Verify backup integrity
      - Restore database
      - Verify memory hashes
      - Restart ARI
      - Validate functionality
```

---

## Memory Maintenance

### Expiration

```python
async def expire_memories():
    """
    Remove expired memories.
    """
    expired = await storage.query(
        filter={"expires_at": {"$lt": now()}}
    )
    
    for memory in expired:
        # Archive before deletion
        await archive.store(memory)
        
        # Delete from active storage
        await storage.delete(memory.id)
        
        # Audit log
        audit_log(
            event="MEMORY_EXPIRED",
            memory_id=memory.id,
            type=memory.type,
            age_days=(now() - memory.created_at).days
        )
```

### Consolidation

```python
async def consolidate_patterns():
    """
    Consolidate similar patterns into stronger memories.
    """
    patterns = await storage.query(
        filter={"type": "PATTERN"}
    )
    
    clusters = cluster_similar(patterns)
    
    for cluster in clusters:
        if len(cluster) >= 3:  # Minimum for consolidation
            # Create consolidated pattern
            consolidated = create_consolidated_pattern(cluster)
            consolidated.confidence = min(
                sum(p.confidence for p in cluster) / len(cluster) + 0.1,
                0.95
            )
            
            # Store new pattern
            await storage.write(consolidated)
            
            # Mark originals as superseded
            for pattern in cluster:
                await storage.supersede(pattern.id, consolidated.id)
```

---

## Memory Access API

### Read Operations

```python
# Get single memory
memory = await memory_manager.get(id="mem_abc123")

# Search memories
results = await memory_manager.search(
    query="communication style",
    types=["PREFERENCE", "PATTERN"],
    min_confidence=0.5,
    limit=10
)

# Get related memories
related = await memory_manager.get_related(
    memory_id="mem_abc123",
    similarity_threshold=0.7
)
```

### Write Operations

```python
# Write new memory
result = await memory_manager.write(
    type="PATTERN",
    content="Follow-up emails within 48 hours have higher response rate",
    provenance={
        "source": "agent:learning",
        "trust_level": "SEMI_TRUSTED",
        "chain": ["outcome_data", "agent:learning"]
    },
    tags=["email", "follow-up", "timing"]
)

# Update existing memory
result = await memory_manager.update(
    id="mem_abc123",
    content="Updated content",
    reason="Corroborating evidence received"
)
```

### Administrative Operations

```python
# Rollback
result = await memory_manager.rollback(
    id="mem_abc123",
    target_version=2
)

# Quarantine
result = await memory_manager.quarantine(
    id="mem_abc123",
    reason="Suspected poisoning attempt"
)

# Release from quarantine
result = await memory_manager.release(
    id="mem_abc123",
    approved_by="operator"
)

# Create checkpoint
checkpoint = await memory_manager.checkpoint(
    label="pre_major_change"
)

# Restore from checkpoint
result = await memory_manager.restore(
    checkpoint_id="chk_20260126_001"
)
```

---

*Memory System Version: 11.0 | Last Updated: January 26, 2026*
