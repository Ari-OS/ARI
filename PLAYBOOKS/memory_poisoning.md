# PLAYBOOK-002: MEMORY POISONING RESPONSE
## Detecting and Recovering from Memory Contamination

**Severity:** SEV-1 to SEV-2  
**Owner:** Memory Manager + Security Council Member  
**Last Updated:** 2026-01-26

---

## 1. OVERVIEW

### What is Memory Poisoning?
Memory poisoning occurs when malicious or incorrect data is stored in ARI's memory systems, potentially influencing future decisions, responses, or behaviors.

### Attack Vectors
```
├── Direct Injection
│   ├── Malicious content stored as "learned" data
│   ├── False facts presented as truths
│   └── Embedded commands in memory entries
├── Gradual Corruption
│   ├── Incremental belief modification
│   ├── Repeated false assertions
│   └── Authority impersonation
├── Reference Manipulation
│   ├── Fake citation injection
│   ├── Source authority spoofing
│   └── Cross-reference tampering
└── Metadata Attacks
    ├── Timestamp manipulation
    ├── Confidence score inflation
    └── Access permission escalation
```

---

## 2. DETECTION MECHANISMS

### Integrity Monitoring
```yaml
continuous_checks:
  content_validation:
    - Fact consistency verification
    - Source trustworthiness scoring
    - Cross-reference validation
    
  metadata_validation:
    - Timestamp sequencing
    - Source attribution verification
    - Confidence score bounds checking
    
  behavioral_analysis:
    - Memory access pattern monitoring
    - Write frequency anomalies
    - Query pattern changes
```

### Poisoning Indicators
```yaml
high_confidence:
  - Memory entry contradicts known facts
  - Source claims authority not verified
  - Embedded instruction patterns detected
  - Metadata inconsistencies found
  
medium_confidence:
  - Unusual write patterns from single source
  - Rapid belief updates without evidence
  - Confidence scores inconsistent with source
  - Cross-references don't validate
  
low_confidence:
  - Minor inconsistencies in entries
  - Formatting anomalies
  - Unusual access patterns
```

### Automated Scanning
```python
def scan_memory_integrity():
    """Regular integrity scan of memory contents"""
    
    issues = []
    
    for entry in memory_manager.get_all_entries():
        # Content checks
        if contains_instruction_patterns(entry.content):
            issues.append(Issue(
                entry=entry,
                type="embedded_instruction",
                severity="high"
            ))
        
        # Fact validation
        if entry.type == "factual":
            validation = validate_against_knowledge_base(entry)
            if not validation.consistent:
                issues.append(Issue(
                    entry=entry,
                    type="fact_inconsistency",
                    severity="medium",
                    details=validation.conflicts
                ))
        
        # Metadata checks
        if not validate_metadata_integrity(entry):
            issues.append(Issue(
                entry=entry,
                type="metadata_tampering",
                severity="high"
            ))
        
        # Source validation
        if entry.source and not verify_source_authority(entry.source):
            issues.append(Issue(
                entry=entry,
                type="source_spoofing",
                severity="high"
            ))
    
    return IntegrityScanResult(issues=issues)
```

---

## 3. IMMEDIATE RESPONSE

### Step 1: Quarantine (< 1 minute)
```python
def quarantine_suspected_entries(entries):
    """Immediately isolate suspected poisoned entries"""
    
    for entry in entries:
        # Mark as untrusted
        entry.trust_level = "quarantined"
        entry.quarantine_time = now()
        
        # Prevent use in responses
        memory_manager.exclude_from_queries(entry.id)
        
        # Preserve for analysis
        evidence_store.capture(entry, full_context=True)
    
    # Log action
    logger.security_event(
        type="memory_quarantine",
        entries=len(entries),
        reason="poisoning_suspected"
    )
```

### Step 2: Scope Assessment
```markdown
## Memory Poisoning Scope Assessment

### Entry Analysis
- [ ] How many entries are affected?
- [ ] What time range do they span?
- [ ] What was the source of contamination?
- [ ] Are entries related or isolated?

### Impact Analysis
- [ ] Have poisoned entries influenced responses?
- [ ] Were decisions made based on poisoned data?
- [ ] Are other memory regions affected?
- [ ] What operator actions were impacted?

### Propagation Analysis
- [ ] Did poisoned data create derived entries?
- [ ] Were cross-references created?
- [ ] Has it affected learning/patterns?
- [ ] Any system state influenced?
```

### Step 3: Containment Decision
```yaml
if isolated_entries:
  - Quarantine specific entries
  - Continue with enhanced monitoring
  - Schedule deep scan
  
if regional_contamination:
  - Quarantine entire memory region
  - Enable read-only mode for region
  - Begin integrity restoration
  
if systemic_contamination:
  - Full memory lockdown
  - Operator notification immediate
  - Prepare for full restoration
```

---

## 4. RECOVERY PROCEDURES

### Recovery Strategy A: Targeted Removal
```yaml
use_when:
  - Contamination is isolated
  - Clean entries identifiable
  - Limited propagation
  
steps:
  1. Identify all poisoned entries (primary + derived)
  2. Remove or mark entries as invalid
  3. Regenerate any dependent data from clean sources
  4. Validate memory consistency
  5. Resume normal operation with monitoring
```

### Recovery Strategy B: Region Rollback
```yaml
use_when:
  - Regional contamination
  - Recent checkpoint available
  - Acceptable data loss window
  
steps:
  1. Identify contaminated memory region
  2. Find last known-good checkpoint
  3. Rollback region to checkpoint
  4. Replay valid operations if needed
  5. Validate restored state
  6. Resume with enhanced monitoring
```

### Recovery Strategy C: Full Restoration
```yaml
use_when:
  - Systemic contamination
  - Uncertain contamination scope
  - Security-critical concerns
  
steps:
  1. Export all memory with contamination flags
  2. Initialize fresh memory state
  3. Manually validate critical entries
  4. Reimport verified entries only
  5. Rebuild indices and relationships
  6. Full system validation
  7. Extended monitoring period
```

### Integrity Verification
```python
def verify_memory_integrity():
    """Post-recovery integrity verification"""
    
    checks = {
        "no_quarantined_active": check_no_quarantined_in_use(),
        "consistency": check_cross_reference_consistency(),
        "metadata_valid": check_all_metadata_valid(),
        "no_embedded_instructions": scan_for_instruction_patterns(),
        "source_verification": verify_all_sources(),
        "confidence_bounds": check_confidence_scores_valid()
    }
    
    return all(checks.values()), checks
```

---

## 5. PREVENTION MEASURES

### Write-Time Validation
```python
def validate_memory_write(entry, source):
    """Validate before allowing memory write"""
    
    # Source verification
    if not is_trusted_source(source):
        return WriteResult(
            allowed=False,
            reason="untrusted_source"
        )
    
    # Content scanning
    if contains_suspicious_patterns(entry.content):
        return WriteResult(
            allowed=False,
            reason="suspicious_content",
            patterns=matched_patterns
        )
    
    # Fact checking for factual entries
    if entry.type == "factual":
        validation = validate_fact(entry.content)
        if validation.confidence < FACT_THRESHOLD:
            return WriteResult(
                allowed=False,
                reason="unverified_fact",
                confidence=validation.confidence
            )
    
    # Rate limiting
    if exceeds_write_rate(source):
        return WriteResult(
            allowed=False,
            reason="rate_limit_exceeded"
        )
    
    return WriteResult(allowed=True)
```

### Trust Decay
```yaml
trust_decay:
  description: |
    Memory entries lose trust over time unless reinforced
    by consistent, verified information from trusted sources.
    
  parameters:
    base_decay_rate: 0.01  # per day
    reinforcement_boost: 0.1
    minimum_trust: 0.3
    quarantine_threshold: 0.4
    
  behavior:
    - Entries below quarantine_threshold flagged for review
    - Entries below minimum_trust excluded from active use
    - Reinforcement requires independent verification
```

### Provenance Tracking
```yaml
every_memory_entry:
  required_fields:
    - source_type: [operator|system|inference|external]
    - source_identifier: [who/what created this]
    - creation_timestamp: [ISO 8601]
    - verification_status: [unverified|verified|challenged]
    - confidence_score: [0.0 - 1.0]
    - derivation_chain: [what entries this derives from]
```

---

## 6. MONITORING & METRICS

### Continuous Monitoring
```yaml
monitors:
  write_activity:
    - Writes per source per hour
    - Write patterns over time
    - Unusual content characteristics
    
  integrity:
    - Cross-reference consistency
    - Fact validation failures
    - Metadata anomalies
    
  access:
    - Query patterns
    - Retrieved entry trust levels
    - Quarantine access attempts
```

### Key Metrics
```yaml
metrics:
  health:
    - Average memory trust score
    - Percentage of verified entries
    - Quarantined entry count
    
  security:
    - Poisoning attempts detected
    - False positive rate
    - Time to detection
    - Time to containment
    
  recovery:
    - Mean time to recovery
    - Data loss per incident
    - Recovery success rate
```

---

## 7. ESCALATION PATH

```
Detection → Memory Manager (quarantine)
                   ↓
            Scope Assessment
                   ↓
    ┌──────────────────────────┐
    │ If isolated (< 10 entries):  │
    │ - Targeted removal       │
    │ - Log and monitor        │
    └──────────────────────────┘
                   ↓
    ┌──────────────────────────┐
    │ If regional (> 10 entries):  │
    │ - Arbiter notification   │
    │ - Region lockdown        │
    │ - Recovery planning      │
    └──────────────────────────┘
                   ↓
    ┌──────────────────────────┐
    │ If systemic:             │
    │ - Operator URGENT        │
    │ - Full lockdown          │
    │ - Council review         │
    └──────────────────────────┘
```

---

## 8. RESPONSE TEMPLATES

### Operator Alert (Regional)
```markdown
⚠️ **MEMORY INTEGRITY ALERT**

**Time:** {TIMESTAMP}
**Severity:** SEV-2
**Affected Region:** {MEMORY_REGION}

**Detection Summary:**
{N} entries flagged for potential poisoning

**Indicators Found:**
{INDICATOR_LIST}

**Containment Status:**
- Affected entries quarantined
- Region set to read-only
- No active use of flagged entries

**Impact Assessment:**
- Responses potentially affected: {YES/NO}
- Time window: {START} to {END}

**Recovery Plan:**
{PROPOSED_RECOVERY}

**Action Required:** {YES/NO}
```

### Operator Alert (Critical)
```markdown
🚨 **CRITICAL: MEMORY CONTAMINATION**

**Time:** {TIMESTAMP}
**Severity:** SEV-1
**Scope:** Systemic/Unknown

**Immediate Actions Taken:**
- Full memory locked
- All operations using memory suspended
- Evidence preserved

**Situation:**
{DESCRIPTION}

**Impact:**
- All memory-dependent operations halted
- Historical responses may be affected

**Recommended Action:**
Authorize full memory restoration from last known-good state?

**Data Loss Estimate:** {TIMEFRAME}
```

---

## 9. DRILL SCENARIOS

### Drill 1: Single Entry Poisoning
```
Scenario: Malicious fact injected via manipulated input
Expected: Detect on write, block, log
```

### Drill 2: Gradual Belief Modification
```
Scenario: Repeated false assertions over multiple sessions
Expected: Pattern detection, confidence anomaly flag
```

### Drill 3: Source Spoofing
```
Scenario: Entry claims operator authority when none given
Expected: Source verification failure, quarantine
```

### Drill 4: Systemic Attack
```
Scenario: Large-scale injection affecting multiple regions
Expected: Full lockdown, operator notification, recovery mode
```

---

**Related Documents:**
- MEMORY.md
- THREAT_MODEL.md
- PROMPTS/MEMORY_MANAGER.md
- WORKFLOWS/incident_response.md
