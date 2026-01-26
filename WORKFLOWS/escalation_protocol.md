# ESCALATION PROTOCOL
## When and How to Escalate: Agent → Arbiter → Operator

**Version:** 1.0  
**Last Updated:** 2026-01-26  
**Owner:** Arbiter

---

## 1. OVERVIEW

This protocol defines when and how issues should be escalated within ARI. Proper escalation ensures problems reach the right decision-maker quickly while avoiding unnecessary interruptions.

### Core Principles
1. **Escalate early, not late** - When in doubt, escalate
2. **Provide context** - Every escalation includes decision-ready information
3. **Respect the chain** - Follow the defined path unless emergency
4. **Close the loop** - Report outcome back down the chain

---

## 2. ESCALATION LEVELS

```
┌─────────────────────────────────────────────────────────────────┐
│ LEVEL 0: Self-Resolution                                        │
│ Agent handles within their authority                            │
│ No escalation needed                                            │
├─────────────────────────────────────────────────────────────────┤
│ LEVEL 1: Peer Consultation                                      │
│ Agent consults another agent                                    │
│ Collaborative resolution                                        │
├─────────────────────────────────────────────────────────────────┤
│ LEVEL 2: Overseer Review                                        │
│ Quality/compliance issue requiring validation                   │
│ Overseer reviews and decides                                    │
├─────────────────────────────────────────────────────────────────┤
│ LEVEL 3: Arbiter Decision                                       │
│ Conflict, ambiguity, or high-stakes decision                    │
│ Arbiter makes binding ruling                                    │
├─────────────────────────────────────────────────────────────────┤
│ LEVEL 4: Council Review                                         │
│ System-wide impact, architectural change                        │
│ Full Council deliberation required                              │
├─────────────────────────────────────────────────────────────────┤
│ LEVEL 5: Operator Decision                                      │
│ Human judgment required, irreversible action                    │
│ Operator makes final call                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. ESCALATION TRIGGERS

### Level 1: Peer Consultation
```yaml
triggers:
  - Need expertise outside own domain
  - Information request from another agent's area
  - Collaborative task requiring coordination
  
response_time: Immediate
authority: Requesting agent retains decision authority
```

### Level 2: Overseer Review
```yaml
triggers:
  - Client-facing content ready for review
  - Quality concern flagged by any agent
  - Policy compliance uncertainty
  - Output exceeds risk threshold
  
response_time: < 5 minutes
authority: Overseer can approve, reject, or request changes
```

### Level 3: Arbiter Decision
```yaml
triggers:
  - Conflict between two or more agents
  - Ambiguous instruction interpretation
  - Request exceeds agent authority
  - Decision impacts multiple domains
  - Precedent-setting situation
  - Resource allocation conflict
  - Priority override needed
  
response_time: < 15 minutes
authority: Arbiter ruling is binding
```

### Level 4: Council Review
```yaml
triggers:
  - Proposed change to system architecture
  - New capability or agent addition
  - Security policy modification
  - Governance rule change
  - Major feature implementation
  
response_time: < 24 hours (async deliberation)
authority: Council vote required (majority or supermajority)
```

### Level 5: Operator Decision
```yaml
triggers:
  - Human judgment ethically required
  - Irreversible action with significant impact
  - Financial commitment above threshold
  - Legal/compliance uncertainty
  - Personal/sensitive information handling
  - System cannot confidently proceed
  - Operator explicitly requested involvement
  
response_time: Wait for operator
authority: Operator decision is final
```

---

## 4. ESCALATION TEMPLATES

### Level 1: Peer Consultation Request
```markdown
## Consultation Request

**From:** {REQUESTING_AGENT}
**To:** {CONSULTED_AGENT}
**Topic:** {BRIEF_TOPIC}

**Context:**
{SITUATION_SUMMARY}

**Question:**
{SPECIFIC_QUESTION}

**Decision Timeline:**
{WHEN_NEEDED}

**My Current Thinking:**
{PRELIMINARY_ASSESSMENT}
```

### Level 2: Overseer Review Request
```markdown
## Overseer Review Request

**From:** {REQUESTING_AGENT}
**Content Type:** {CONTENT_TYPE}
**Risk Level:** {LOW/MEDIUM/HIGH}

**Content for Review:**
{CONTENT_OR_LINK}

**Quality Concerns:**
{SPECIFIC_CONCERNS_IF_ANY}

**Compliance Checkpoints:**
- [ ] Accuracy verified
- [ ] Tone appropriate
- [ ] No sensitive data exposed
- [ ] Follows brand guidelines
```

### Level 3: Arbiter Escalation
```markdown
## Arbiter Escalation

**From:** {ESCALATING_AGENT}
**Type:** {CONFLICT/AMBIGUITY/AUTHORITY/PRECEDENT}
**Urgency:** {IMMEDIATE/HIGH/NORMAL}

### Situation
{CLEAR_DESCRIPTION_OF_SITUATION}

### The Question
{SPECIFIC_DECISION_NEEDED}

### Options Considered
**Option A:** {DESCRIPTION}
- Pros: {PROS}
- Cons: {CONS}

**Option B:** {DESCRIPTION}
- Pros: {PROS}
- Cons: {CONS}

### Relevant Context
- Prior decisions: {REFERENCES}
- Policies applicable: {POLICIES}
- Stakeholders affected: {WHO}

### My Recommendation
{WHAT_I_WOULD_DO_IF_AUTHORIZED}

### What I Need
{SPECIFIC_DECISION_OR_GUIDANCE}
```

### Level 4: Council Review Request
```markdown
## Council Review Request

**Submitted By:** {AGENT_OR_ARBITER}
**Proposal Type:** {ARCHITECTURE/SECURITY/GOVERNANCE/CAPABILITY}
**Impact Scope:** {SYSTEM-WIDE/MULTI-DOMAIN/SINGLE-DOMAIN}

### Proposal
{CLEAR_DESCRIPTION}

### Rationale
{WHY_THIS_CHANGE}

### Impact Assessment
- Architecture: {IMPACT}
- Security: {IMPACT}
- Reliability: {IMPACT}
- User Experience: {IMPACT}
- Research/Learning: {IMPACT}

### Alternatives Considered
{OTHER_OPTIONS_AND_WHY_NOT}

### Requested Vote Type
{MAJORITY/SUPERMAJORITY/UNANIMOUS}

### Implementation Plan (if approved)
{HIGH_LEVEL_PLAN}
```

### Level 5: Operator Escalation
```markdown
## Decision Required: Operator Input Needed

**From:** {ARBITER_OR_AGENT}
**Urgency:** {IMMEDIATE/HIGH/NORMAL/LOW}
**Category:** {CATEGORY}

### Summary
{ONE_PARAGRAPH_SUMMARY}

### Context
{RELEVANT_BACKGROUND}

### The Decision
{SPECIFIC_QUESTION_FOR_OPERATOR}

### Options
**Option 1:** {DESCRIPTION}
- Impact: {EXPECTED_OUTCOME}
- Risk: {RISK_ASSESSMENT}

**Option 2:** {DESCRIPTION}
- Impact: {EXPECTED_OUTCOME}
- Risk: {RISK_ASSESSMENT}

### My Analysis
{SYSTEM_RECOMMENDATION_IF_ANY}

### Why This Requires You
{WHY_HUMAN_JUDGMENT_NEEDED}

### Time Sensitivity
{DEADLINE_OR_IMPACT_OF_DELAY}
```

---

## 5. ESCALATION HANDLING

### Receiving an Escalation

```python
def handle_escalation(escalation):
    """Standard escalation handling process"""
    
    # Step 1: Acknowledge receipt
    acknowledge(escalation, timestamp=now())
    
    # Step 2: Validate escalation
    if not is_appropriate_level(escalation):
        redirect_to_appropriate_level(escalation)
        return
    
    # Step 3: Assess urgency
    if escalation.urgency == "immediate":
        prioritize_ahead_of_queue(escalation)
    
    # Step 4: Gather any missing context
    if needs_more_info(escalation):
        request_clarification(escalation.source)
    
    # Step 5: Make decision
    decision = deliberate_and_decide(escalation)
    
    # Step 6: Communicate decision
    communicate_decision(
        to=escalation.source,
        cc=affected_parties,
        decision=decision,
        rationale=decision.reasoning
    )
    
    # Step 7: Log for learning
    log_escalation_outcome(escalation, decision)
```

### Response Time Expectations

| Level | Acknowledgment | Resolution |
|-------|----------------|------------|
| Level 1 | Immediate | < 5 minutes |
| Level 2 | < 1 minute | < 5 minutes |
| Level 3 | < 2 minutes | < 15 minutes |
| Level 4 | < 1 hour | < 24 hours |
| Level 5 | Immediate notification | Operator-dependent |

---

## 6. ESCALATION PATHS BY SCENARIO

### Security Incident
```
Agent Detection → Guardian → Arbiter → Operator (if SEV-1)
                     ↓
               Incident Response Workflow
```

### Agent Conflict
```
Agent A ←→ Agent B (attempt resolution)
         ↓
      Arbiter (binding decision)
         ↓
      Council (if precedent-setting)
```

### Quality Concern
```
Any Agent → Overseer → {Approve/Reject/Request Changes}
                ↓
            Arbiter (if disputed)
```

### Resource Contention
```
Agent Request → Planner (allocation)
                   ↓
              Arbiter (if conflict)
                   ↓
              Operator (if significant)
```

### Authority Question
```
Agent → Arbiter → {Rule or Escalate}
                       ↓
                   Council (if governance)
                       ↓
                   Operator (if final)
```

---

## 7. ANTI-PATTERNS TO AVOID

### ❌ Escalation Dumping
**Problem:** Escalating without analysis or recommendation
**Correct:** Always include context, options, and your recommendation

### ❌ Escalation Hoarding
**Problem:** Not escalating when you should
**Correct:** When in doubt, escalate. Better early than late.

### ❌ Escalation Skipping
**Problem:** Going directly to Operator when Arbiter could decide
**Correct:** Follow the chain unless true emergency

### ❌ Circular Escalation
**Problem:** Issue bounces between levels without resolution
**Correct:** Arbiter breaks cycles with binding decision

### ❌ Silent Escalation
**Problem:** Escalating without informing affected parties
**Correct:** CC relevant stakeholders on all escalations

---

## 8. ESCALATION METRICS

### Tracked Metrics
```yaml
metrics:
  volume:
    - escalations_per_level_per_week
    - escalations_by_source_agent
    - escalations_by_type
    
  quality:
    - escalations_with_complete_context
    - escalations_redirected_to_correct_level
    - repeat_escalations_same_issue
    
  efficiency:
    - time_to_acknowledgment
    - time_to_resolution
    - escalation_to_resolution_ratio
```

### Health Indicators
- **Too few escalations:** Agents may be overstepping authority
- **Too many escalations:** Agents may lack clarity or confidence
- **Slow resolution:** Decision bottleneck forming
- **Repeat escalations:** Root cause not addressed

---

## 9. ESCALATION AUTHORITY MATRIX

| Agent | Can Escalate To | Can Receive From |
|-------|-----------------|------------------|
| Research | Marketing, Strategy, Overseer | — |
| Marketing | Sales, Content, Overseer | Research |
| Sales | Build, Client Comms, Overseer | Marketing |
| Content | SEO, Marketing, Overseer | — |
| SEO | Build, Development, Overseer | Content |
| Build | Development, Overseer | SEO, Sales |
| Development | Build, Overseer | Build |
| Client Comms | Sales, Overseer | Sales |
| Strategy | Pipeline, Learning, Arbiter | All execution agents |
| Pipeline | Strategy, Learning, Arbiter | All execution agents |
| Learning | Strategy, Pipeline, Arbiter | All agents |
| Overseer | Arbiter | All agents |
| Arbiter | Council, Operator | All agents, Overseer |

---

## 10. EMERGENCY ESCALATION

### When Normal Process is Too Slow
```yaml
emergency_triggers:
  - Active security breach
  - Data loss in progress
  - Operator safety concern
  - System-wide failure
  - Legal/compliance emergency

emergency_process:
  1. Immediately notify Arbiter AND Operator
  2. Take protective action first
  3. Document during/after, not before
  4. Full retrospective required
```

### Emergency Notification Format
```markdown
🚨 EMERGENCY ESCALATION

**Time:** {TIMESTAMP}
**Type:** {EMERGENCY_TYPE}
**Status:** {ACTIVE/CONTAINED}

**Immediate Action Taken:**
{WHAT_WAS_DONE}

**Current Status:**
{SITUATION_NOW}

**Operator Action Needed:**
{YES/NO - IF YES, WHAT}
```

---

## 11. POST-ESCALATION

### Closing the Loop
Every escalation must be closed with:
1. **Decision communicated** to all parties
2. **Rationale documented** for future reference
3. **Outcome logged** in escalation tracker
4. **Learning captured** if novel situation

### Escalation Review (Weekly)
```yaml
review_questions:
  - Were escalations appropriate for their level?
  - Could any have been prevented?
  - Were response times acceptable?
  - What patterns are emerging?
  - Any authority clarifications needed?
```

---

**Document Control:**
- Review Frequency: Monthly
- Approval Required: Arbiter
- Last Updated: 2026-01-26
