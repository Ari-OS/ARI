# PLAYBOOK-004: CLIENT ESCALATION RESPONSE
## Managing Client Issues, Complaints, and Relationship Risks

**Severity:** SEV-2 to SEV-4  
**Owner:** Client Comms + Sales Agents  
**Last Updated:** 2026-01-26

---

## 1. OVERVIEW

### What is Client Escalation?
Client escalation occurs when a client relationship requires intervention beyond normal operations due to dissatisfaction, disputes, or relationship-threatening situations.

### Escalation Categories
```
├── Service Issues
│   ├── Delivery delays
│   ├── Quality concerns
│   └── Scope disputes
├── Communication Issues
│   ├── Unresponsive periods
│   ├── Miscommunication
│   └── Expectation gaps
├── Financial Issues
│   ├── Payment disputes
│   ├── Pricing disagreements
│   └── Refund requests
└── Relationship Issues
    ├── Trust breakdown
    ├── Repeated complaints
    └── Termination risk
```

---

## 2. SEVERITY CLASSIFICATION

| Level | Name | Indicators | Response Time |
|-------|------|------------|---------------|
| **SEV-2** | Critical | Immediate termination risk, public complaint threat, legal mention | < 1 hour |
| **SEV-3** | High | Repeated complaints, significant dissatisfaction, payment withholding | < 4 hours |
| **SEV-4** | Medium | Single complaint, minor dissatisfaction, clarification needed | < 24 hours |

### Severity Indicators
```yaml
sev_2_triggers:
  - "I want a refund"
  - "I'm going to leave a bad review"
  - "I'm contacting my lawyer"
  - "This is unacceptable"
  - "I want to speak to your manager"
  - Third consecutive complaint
  - Payment dispute filed
  
sev_3_triggers:
  - "I'm disappointed"
  - "This isn't what I expected"
  - "When will this be done?"
  - Second complaint about same issue
  - Delayed payment without explanation
  
sev_4_triggers:
  - "Can you clarify..."
  - "I'm a bit confused"
  - Minor revision requests
  - Schedule adjustment requests
```

---

## 3. DETECTION & MONITORING

### Sentiment Monitoring
```python
def analyze_client_sentiment(communication):
    """Analyze client communication for escalation signals"""
    
    indicators = {
        "frustration_markers": [
            "still waiting", "again", "how many times",
            "unacceptable", "disappointed", "frustrated"
        ],
        "urgency_markers": [
            "immediately", "urgent", "asap", "right now"
        ],
        "threat_markers": [
            "refund", "review", "lawyer", "complaint", "cancel"
        ],
        "trust_markers": [
            "don't believe", "lied", "misled", "false"
        ]
    }
    
    sentiment_score = calculate_sentiment(communication)
    escalation_signals = detect_markers(communication, indicators)
    
    if escalation_signals.threat_markers:
        return EscalationLevel.SEV_2
    elif escalation_signals.frustration_markers and sentiment_score < -0.5:
        return EscalationLevel.SEV_3
    elif escalation_signals.any():
        return EscalationLevel.SEV_4
    
    return EscalationLevel.NORMAL
```

### Relationship Health Metrics
```yaml
tracked_metrics:
  response_time:
    - Our average response time to client
    - Client's average response time to us
    - Trend direction
    
  sentiment_trend:
    - Recent communication sentiment
    - Sentiment trajectory (improving/declining)
    
  milestone_status:
    - Deliverables on time vs delayed
    - Revisions requested
    - Scope changes
    
  financial:
    - Payment timeliness
    - Outstanding balance
    - Dispute history
```

---

## 4. IMMEDIATE RESPONSE

### SEV-2: Critical Response (< 1 hour)
```yaml
immediate_actions:
  1. acknowledge:
     - Respond within 30 minutes
     - Show understanding of their concern
     - No defensiveness
     
  2. assess:
     - Identify root cause quickly
     - Gather all relevant context
     - Prepare resolution options
     
  3. escalate:
     - Notify Operator immediately
     - Prepare situation summary
     - Draft response options
     
  4. respond:
     - Provide concrete resolution path
     - Set clear expectations
     - Follow up within 24 hours
```

### SEV-3: High Priority Response (< 4 hours)
```yaml
actions:
  1. acknowledge:
     - Respond within 2 hours
     - Validate their feelings
     - Take ownership
     
  2. investigate:
     - Review project history
     - Identify contributing factors
     - Determine fair resolution
     
  3. resolve:
     - Present resolution options
     - Get client agreement
     - Document outcome
```

### SEV-4: Standard Response (< 24 hours)
```yaml
actions:
  1. respond:
     - Acknowledge within 24 hours
     - Address concern directly
     - Provide clear information
     
  2. resolve:
     - Handle within normal workflow
     - Document for future reference
```

---

## 5. RESPONSE TEMPLATES

### Acknowledgment (All Severities)
```markdown
Hi {NAME},

Thank you for reaching out about this. I understand {RESTATE_THEIR_CONCERN} and I take this seriously.

{IMMEDIATE_ACTION_TAKEN}

{NEXT_STEPS_AND_TIMELINE}

I'll {SPECIFIC_COMMITMENT} by {SPECIFIC_TIME}.

{CLOSING}
```

### SEV-2: Critical Situation
```markdown
Hi {NAME},

I want to address your concerns immediately and make this right.

I hear that {SPECIFIC_CONCERN} and I completely understand your frustration. This is not the experience I want for you.

Here's what I'm doing right now:
1. {IMMEDIATE_ACTION_1}
2. {IMMEDIATE_ACTION_2}

I'd like to offer {RESOLUTION_OFFER} to make this right.

Can we schedule a quick call today to discuss this directly? I'm available {TIMES}.

I'm committed to resolving this to your satisfaction.

{NAME}
```

### SEV-3: Dissatisfaction Response
```markdown
Hi {NAME},

Thank you for letting me know about {ISSUE}. I appreciate your patience and I'm sorry this hasn't met your expectations.

Here's what happened: {BRIEF_EXPLANATION}

To make this right, I'm going to:
1. {ACTION_1}
2. {ACTION_2}
3. {ACTION_3}

I'll have {DELIVERABLE} to you by {DATE/TIME}.

Please let me know if you have any questions or if there's anything else I can address.

{NAME}
```

### SEV-4: Clarification/Minor Issue
```markdown
Hi {NAME},

Thanks for reaching out about {TOPIC}.

{CLEAR_ANSWER_OR_RESOLUTION}

{NEXT_STEPS_IF_ANY}

Let me know if you need anything else!

{NAME}
```

---

## 6. RESOLUTION STRATEGIES

### Service Issue Resolution
```yaml
delivery_delay:
  - Communicate new timeline immediately
  - Explain reason briefly (no excuses)
  - Offer compensation if appropriate
  - Accelerate if possible
  
quality_concern:
  - Acknowledge specific issues
  - Propose concrete fixes
  - Add extra revision round if needed
  - Quality check before redelivery
  
scope_dispute:
  - Review original agreement
  - Document what was promised
  - Find middle ground
  - Document resolution for future
```

### Financial Issue Resolution
```yaml
payment_dispute:
  - Review invoice and agreement
  - Clarify any confusion
  - Offer payment plan if needed
  - Document resolution
  
pricing_disagreement:
  - Review what was quoted
  - Explain value delivered
  - Negotiate if appropriate
  - Document for future clarity
  
refund_request:
  - Assess validity of request
  - Calculate fair amount
  - Get Operator approval for amounts > $X
  - Process promptly if approved
```

### Relationship Recovery
```yaml
trust_breakdown:
  - Acknowledge the issue genuinely
  - Take responsibility appropriately
  - Propose concrete changes
  - Demonstrate through actions
  - Regular check-ins during recovery
  
repeated_complaints:
  - Pattern analysis
  - Root cause identification
  - Systemic fix implementation
  - Extra attention period
```

---

## 7. ESCALATION TO OPERATOR

### When to Escalate
```yaml
always_escalate:
  - Refund requests > $100
  - Legal threats
  - Public review threats
  - Repeated SEV-2/3 with same client
  - Contract termination discussion
  
escalate_for_approval:
  - Significant scope changes
  - Timeline extensions > 1 week
  - Discounts > 10%
  - Non-standard resolutions
```

### Operator Escalation Template
```markdown
## Client Escalation: {CLIENT_NAME}

**Severity:** SEV-{LEVEL}
**Project:** {PROJECT_NAME}
**Relationship Value:** ${TOTAL_VALUE}

### Situation
{CLEAR_SUMMARY}

### History
- Previous issues: {COUNT}
- Resolution history: {SUMMARY}
- Overall relationship: {HEALTHY/STRAINED/AT_RISK}

### Client's Position
{WHAT_THEY_WANT}

### My Assessment
{ANALYSIS_AND_RECOMMENDATION}

### Resolution Options
1. {OPTION_1}
   - Cost: {COST}
   - Risk: {RISK}
   
2. {OPTION_2}
   - Cost: {COST}
   - Risk: {RISK}

### My Recommendation
{RECOMMENDED_ACTION}

### Approval Needed For
{SPECIFIC_APPROVAL_REQUEST}
```

---

## 8. PREVENTION MEASURES

### Proactive Relationship Management
```yaml
regular_touchpoints:
  during_project:
    - Weekly progress updates
    - Milestone confirmations
    - Early issue flagging
    
  post_delivery:
    - 7-day follow-up
    - 30-day check-in
    - Testimonial request (if appropriate)
```

### Expectation Setting
```yaml
at_project_start:
  - Clear scope documentation
  - Explicit timeline with buffers
  - Communication preferences
  - Revision policy clarity
  - Payment terms confirmed
```

### Early Warning Response
```yaml
signals_to_watch:
  - Delayed client responses
  - Tone changes in communication
  - Scope clarification requests
  - Schedule concerns
  
proactive_actions:
  - Check in before they complain
  - Address concerns before they escalate
  - Over-communicate during delays
  - Set expectations before disappointment
```

---

## 9. DOCUMENTATION REQUIREMENTS

### Escalation Documentation
```yaml
required_documentation:
  - All communications preserved
  - Timeline of events
  - Resolution agreed upon
  - Follow-up actions committed
  - Learning captured
```

### Post-Resolution Review
```markdown
## Escalation Review: {INCIDENT_ID}

**Client:** {NAME}
**Severity:** SEV-{LEVEL}
**Resolution:** {OUTCOME}

### What Happened
{SUMMARY}

### Root Cause
{ANALYSIS}

### Resolution Effectiveness
{ASSESSMENT}

### Relationship Status Post-Resolution
{CURRENT_STATE}

### Prevention Measures
{CHANGES_TO_PREVENT_RECURRENCE}

### Learning
{KEY_LESSONS}
```

---

## 10. METRICS & TRACKING

### Escalation Metrics
```yaml
tracked:
  - Escalations per client
  - Escalations per project phase
  - Resolution time by severity
  - Client retention post-escalation
  - Repeat escalation rate
  
health_indicators:
  - Overall escalation trend
  - Resolution satisfaction
  - Relationship recovery rate
```

### Client Health Score
```python
def calculate_client_health(client_id):
    """Calculate overall client relationship health"""
    
    factors = {
        "communication": assess_communication_quality(client_id),
        "satisfaction": recent_satisfaction_signals(client_id),
        "payment": payment_history_score(client_id),
        "escalations": inverse_escalation_score(client_id),
        "engagement": engagement_level(client_id)
    }
    
    weights = {
        "communication": 0.20,
        "satisfaction": 0.30,
        "payment": 0.20,
        "escalations": 0.20,
        "engagement": 0.10
    }
    
    score = sum(factors[k] * weights[k] for k in factors)
    
    return ClientHealth(
        score=score,  # 0-100
        status=classify_health(score),  # Healthy/Watch/At-Risk
        factors=factors,
        recommendations=generate_recommendations(factors)
    )
```

---

## 11. ESCALATION PATH

```
Client Communication → Sentiment Analysis
                           ↓
              ┌────────────────────────┐
              │ SEV-4 (Standard):      │
              │ - Handle in workflow   │
              │ - Document resolution  │
              └────────────────────────┘
                           ↓
              ┌────────────────────────┐
              │ SEV-3 (High):          │
              │ - Priority response    │
              │ - Resolution options   │
              │ - Follow-up required   │
              └────────────────────────┘
                           ↓
              ┌────────────────────────┐
              │ SEV-2 (Critical):      │
              │ - Immediate response   │
              │ - Operator notification│
              │ - Recovery plan        │
              └────────────────────────┘
```

---

## 12. DRILL SCENARIOS

### Drill 1: Delivery Delay Complaint
```
Scenario: Client upset about 1-week delay
Expected: SEV-3 response, acknowledgment, new timeline, compensation offer
```

### Drill 2: Refund Request
```
Scenario: Client requests full refund mid-project
Expected: SEV-2 response, Operator escalation, negotiation approach
```

### Drill 3: Quality Complaint
```
Scenario: Client says deliverable "isn't what they asked for"
Expected: Review original scope, acknowledge gap, propose resolution
```

### Drill 4: Trust Breakdown
```
Scenario: Client says "I don't trust you'll deliver"
Expected: SEV-2 response, relationship recovery plan, concrete commitments
```

---

**Related Documents:**
- PROMPTS/AGENTS/CLIENT_COMMS.md
- PROMPTS/AGENTS/SALES.md
- WORKFLOWS/escalation_protocol.md
