# INCIDENT RESPONSE WORKFLOW
## Rose Protocol: Detect → Assess → Contain → Recover → Review

**Version:** 1.0  
**Last Updated:** 2026-01-26  
**Owner:** Guardian + Reliability Council Member

---

## 1. OVERVIEW

This workflow defines how ARI handles security incidents, system failures, and operational emergencies. The goal is rapid detection, safe containment, and continuous learning.

### Incident Definition
An **incident** is any event that:
- Compromises system security or integrity
- Causes service degradation or outage
- Results in data loss or corruption
- Violates established policies
- Threatens operator trust or safety

### Core Principles
1. **Safety First**: Protect operator and data above all else
2. **Rapid Containment**: Stop the bleeding before investigation
3. **Transparency**: Keep operator informed throughout
4. **Learning**: Every incident improves the system

---

## 2. SEVERITY LEVELS

| Level | Name | Definition | Response Time | Notification | Examples |
|-------|------|------------|---------------|--------------|----------|
| **SEV-1** | Critical | System unusable, security breach, data loss | Immediate (<5 min) | Operator + All Agents | Prompt injection executed, data exfiltration |
| **SEV-2** | High | Major feature broken, potential security risk | <15 min | Operator + Domain Agents | Memory corruption, repeated auth failures |
| **SEV-3** | Medium | Degraded performance, minor security concern | <1 hour | Relevant Agents | Tool timeout, validation errors |
| **SEV-4** | Low | Minor issue, no immediate impact | <24 hours | Logged only | UI glitch, slow response |

---

## 3. DETECTION MECHANISMS

### Automated Detection
```
Guardian monitors:
├── Input Validation
│   ├── Prompt injection patterns
│   ├── Malformed requests
│   └── Rate limit violations
├── Behavior Analysis
│   ├── Unusual tool usage patterns
│   ├── Memory access anomalies
│   └── Response time degradation
├── Security Events
│   ├── Authentication failures
│   ├── Permission violations
│   └── Suspicious API calls
└── System Health
    ├── Resource exhaustion
    ├── Error rate spikes
    └── Integration failures
```

### Manual Detection
- Operator reports unexpected behavior
- Agent self-reports anomaly
- External notification (API provider, etc.)

### Detection Triggers
```yaml
triggers:
  prompt_injection:
    patterns:
      - "ignore previous instructions"
      - "system prompt override"
      - "you are now"
    action: IMMEDIATE_BLOCK
    severity: SEV-1
    
  rate_violation:
    threshold: 100 requests/minute
    action: THROTTLE_THEN_BLOCK
    severity: SEV-2
    
  auth_failure:
    threshold: 3 consecutive failures
    action: LOCK_AND_ALERT
    severity: SEV-2
    
  memory_anomaly:
    patterns:
      - "unauthorized_read"
      - "injection_attempt"
    action: QUARANTINE_MEMORY
    severity: SEV-1
```

---

## 4. ASSESSMENT PROTOCOL

### Initial Triage (First 5 Minutes)

```
STEP 1: Acknowledge Incident
├── Assign incident ID: INC-{timestamp}-{type}
├── Log initial detection details
├── Set preliminary severity
└── Notify appropriate parties

STEP 2: Rapid Assessment
├── What happened? (Observable symptoms)
├── When did it start? (Timeline)
├── What's affected? (Blast radius)
├── Is it ongoing? (Active vs historical)
└── What's at risk? (Potential impact)

STEP 3: Initial Classification
├── Security vs Operational
├── Internal vs External cause
├── Single vs Multi-system
└── Isolated vs Spreading
```

### Assessment Questions
```markdown
## Incident Assessment: {INC-ID}

**Detection Source:** [Automated/Manual/External]
**Initial Time:** [ISO timestamp]

### Impact Assessment
- [ ] Data compromised?
- [ ] Services affected?
- [ ] Operator actions blocked?
- [ ] External systems impacted?

### Scope Assessment
- [ ] Single request/session?
- [ ] Multiple users affected?
- [ ] System-wide issue?
- [ ] Cross-system propagation?

### Active Threat Assessment
- [ ] Attack ongoing?
- [ ] Automated or manual?
- [ ] Escalating or stable?
- [ ] Persistence established?
```

---

## 5. CONTAINMENT PROCEDURES

### Immediate Containment (SEV-1/SEV-2)

```python
def immediate_containment(incident):
    """Execute within 5 minutes of SEV-1/2 detection"""
    
    # Step 1: Stop the bleeding
    if incident.type == "security_breach":
        guardian.block_source(incident.source)
        guardian.revoke_sessions()
        guardian.enable_lockdown_mode()
    
    elif incident.type == "data_corruption":
        memory_manager.enable_read_only()
        memory_manager.snapshot_current_state()
        planner.pause_all_writes()
    
    elif incident.type == "service_outage":
        executor.disable_affected_tools()
        router.enable_degraded_mode()
        
    # Step 2: Preserve evidence
    logger.capture_incident_context(incident)
    memory_manager.preserve_relevant_entries()
    
    # Step 3: Notify
    notify_operator(incident, severity="immediate")
    broadcast_to_agents(incident)
    
    return ContainmentResult(
        actions_taken=actions,
        evidence_preserved=evidence,
        next_steps=assessment_plan
    )
```

### Containment Levels

| Level | Actions | Duration | Trigger |
|-------|---------|----------|---------|
| **Lockdown** | All external ops blocked | Until cleared | SEV-1 security |
| **Quarantine** | Affected components isolated | Until reviewed | SEV-1/2 corruption |
| **Degraded** | Non-essential features disabled | Until resolved | SEV-2/3 outage |
| **Monitor** | Enhanced logging, no restrictions | Until reviewed | SEV-3/4 |

### Containment Verification
```markdown
## Containment Checklist: {INC-ID}

- [ ] Threat source identified and blocked
- [ ] Affected components isolated
- [ ] Evidence preserved (logs, memory, state)
- [ ] No ongoing data loss/corruption
- [ ] Operator notified with status
- [ ] Rollback point identified
- [ ] Recovery plan drafted
```

---

## 6. RECOVERY PROCEDURES

### Recovery Workflow

```
PHASE 1: Stabilization
├── Verify containment is complete
├── Assess recovery options
├── Choose recovery strategy
└── Get operator approval if needed

PHASE 2: Restoration
├── Execute recovery actions
├── Verify each step succeeds
├── Monitor for regressions
└── Document progress

PHASE 3: Validation
├── Run health checks
├── Verify data integrity
├── Test affected features
└── Confirm normal operation

PHASE 4: Return to Service
├── Gradually restore access
├── Monitor closely for 24h
├── Document lessons learned
└── Schedule post-incident review
```

### Recovery Strategies

**Strategy A: Rollback**
```yaml
use_when:
  - Known good state exists
  - Data loss acceptable
  - Speed is critical
steps:
  - Identify rollback point
  - Verify backup integrity
  - Execute rollback
  - Validate recovery
  - Document lost data
```

**Strategy B: Repair in Place**
```yaml
use_when:
  - Damage is localized
  - Data preservation critical
  - Root cause understood
steps:
  - Isolate corrupted data
  - Apply targeted fixes
  - Verify repairs
  - Validate integrity
  - Test thoroughly
```

**Strategy C: Rebuild**
```yaml
use_when:
  - Extensive corruption
  - Persistence compromise
  - Clean slate needed
steps:
  - Export critical data
  - Deploy fresh instance
  - Restore from clean backup
  - Reimport verified data
  - Full system validation
```

---

## 7. POST-INCIDENT REVIEW

### Review Timeline
- **Immediate (0-24h)**: Hot debrief, document timeline
- **Short-term (1-7 days)**: Root cause analysis, initial improvements
- **Long-term (30 days)**: Process improvements, training updates

### Post-Incident Report Template
```markdown
# Post-Incident Report: {INC-ID}

## Summary
- **Incident Type:** [Security/Operational/External]
- **Severity:** [SEV-1/2/3/4]
- **Duration:** [Start to Resolution]
- **Impact:** [What was affected]

## Timeline
| Time | Event | Actor |
|------|-------|-------|
| HH:MM | Detection | [Agent/Operator] |
| HH:MM | Containment started | [Agent] |

## Root Cause Analysis
### What happened?
[Detailed technical explanation]

### Why did it happen?
[Contributing factors]

### Why wasn't it prevented?
[Gap analysis]

## Impact Assessment
- **Data Impact:** [None/Minor/Major/Critical]
- **Service Impact:** [Uptime lost]
- **Operator Impact:** [Blocked actions, trust impact]

## Corrective Actions
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Fix/Improvement] | [Agent/Team] | [Date] | [Open/Done] |

## Lessons Learned
- What went well?
- What could improve?
- What will we do differently?
```

---

## 8. COMMUNICATION TEMPLATES

### Operator Notification (SEV-1/2)
```markdown
🚨 **INCIDENT ALERT: {INC-ID}**

**Status:** [Detected/Contained/Recovering/Resolved]
**Severity:** {SEVERITY}
**Time:** {TIMESTAMP}

**What happened:**
{BRIEF_DESCRIPTION}

**Current impact:**
{IMPACT_DESCRIPTION}

**Actions taken:**
{CONTAINMENT_ACTIONS}

**Next steps:**
{PLANNED_ACTIONS}

**Your action needed:** [Yes/No]

I'll update you in {NEXT_UPDATE_TIME}.
```

### Resolution Notice
```markdown
✅ **INCIDENT RESOLVED: {INC-ID}**

**Duration:** {TOTAL_DURATION}
**Resolution:** {RESOLUTION_SUMMARY}

**Impact summary:**
{FINAL_IMPACT}

**Improvements coming:**
{PLANNED_IMPROVEMENTS}
```

---

## 9. PLAYBOOK REFERENCES

For specific incident types, see detailed playbooks:

| Incident Type | Playbook | Location |
|---------------|----------|----------|
| Prompt Injection | PLAYBOOK-001 | `/PLAYBOOKS/prompt_injection.md` |
| Memory Poisoning | PLAYBOOK-002 | `/PLAYBOOKS/memory_poisoning.md` |
| Capacity Overload | PLAYBOOK-003 | `/PLAYBOOKS/capacity_overload.md` |
| Client Escalation | PLAYBOOK-004 | `/PLAYBOOKS/client_escalation.md` |

---

## 10. EMERGENCY CONTACTS

```yaml
escalation_path:
  - Level 1: Guardian (automated)
  - Level 2: Arbiter (system)
  - Level 3: Operator (human)
```

---

**Document Control:**
- Review Frequency: Monthly
- Approval Required: Security Council Member + Reliability Ops
- Test Frequency: Quarterly drills
