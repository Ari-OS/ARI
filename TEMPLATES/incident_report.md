# INCIDENT REPORT TEMPLATE
## Documentation for System Incidents and Post-Incident Reviews

---

# VARIABLES
```
{{INCIDENT_ID}}       - Unique incident identifier (INC-YYYY-MM-###)
{{SEVERITY}}          - SEV-1 through SEV-4
{{TITLE}}             - Brief incident description
{{REPORTED_BY}}       - Who reported the incident
{{REPORTED_AT}}       - Detection timestamp
{{RESOLVED_AT}}       - Resolution timestamp
{{DURATION}}          - Total incident duration
{{IMPACT}}            - Description of impact
{{ROOT_CAUSE}}        - Identified root cause
{{RESOLUTION}}        - How it was resolved
```

---

# INCIDENT REPORT

## Template: Full Incident Report

```markdown
# INCIDENT REPORT

**Incident ID:** {{INCIDENT_ID}}
**Severity:** {{SEVERITY}}
**Status:** 🔴 Active / 🟡 Investigating / 🟢 Resolved / ⚪ Closed

---

## INCIDENT SUMMARY

**Title:** {{TITLE}}

**Reported:** {{REPORTED_AT}}
**Resolved:** {{RESOLVED_AT}}
**Duration:** {{DURATION}}
**Reported By:** {{REPORTED_BY}}

---

## TIMELINE

| Time | Event | Actor |
|------|-------|-------|
| {{REPORTED_AT}} | Incident detected | [Agent/System] |
| [HH:MM] | [Action taken] | [Agent] |
| [HH:MM] | [Action taken] | [Agent] |
| {{RESOLVED_AT}} | Incident resolved | [Agent] |

---

## IMPACT ASSESSMENT

### Systems Affected
- [ ] Core System
- [ ] Memory Manager
- [ ] Guardian
- [ ] Router
- [ ] [Specific Agents]

### Impact Description
{{IMPACT}}

### Scope
- **Users Affected:** [None / Operator / Clients]
- **Data Affected:** [None / Read / Write / Corrupted]
- **Duration:** {{DURATION}}
- **Financial Impact:** $[X] (if applicable)

---

## TECHNICAL DETAILS

### Symptoms Observed
1. [Symptom 1]
2. [Symptom 2]
3. [Symptom 3]

### Detection Method
- [ ] Automated monitoring
- [ ] Manual observation
- [ ] User report
- [ ] External alert

### Root Cause Analysis
{{ROOT_CAUSE}}

### Contributing Factors
1. [Factor 1]
2. [Factor 2]

---

## RESPONSE

### Immediate Actions
1. [Action 1] — [Result]
2. [Action 2] — [Result]
3. [Action 3] — [Result]

### Resolution
{{RESOLUTION}}

### Playbook Used
- [ ] PLAYBOOK-001: Prompt Injection
- [ ] PLAYBOOK-002: Memory Poisoning
- [ ] PLAYBOOK-003: Capacity Overload
- [ ] PLAYBOOK-004: Client Escalation
- [ ] Other: [Specify]

---

## POST-INCIDENT REVIEW

### What Went Well
- [Positive 1]
- [Positive 2]

### What Could Be Improved
- [Improvement 1]
- [Improvement 2]

### Action Items

| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action 1] | [Agent] | [Date] | ☐ Pending |
| [Action 2] | [Agent] | [Date] | ☐ Pending |
| [Action 3] | [Agent] | [Date] | ☐ Pending |

---

## PREVENTION

### Short-term Fixes
- [Fix 1]
- [Fix 2]

### Long-term Improvements
- [Improvement 1]
- [Improvement 2]

### Monitoring Enhancements
- [New alert/check 1]
- [New alert/check 2]

---

## SIGN-OFF

| Role | Agent | Date | Approved |
|------|-------|------|----------|
| Report Author | [Agent] | [Date] | ☑ |
| Technical Review | Guardian 🛡️ | [Date] | ☐ |
| Governance Review | Overseer 👁️ | [Date] | ☐ |
| Final Approval | Arbiter 👑 | [Date] | ☐ |

---

**Report Version:** 1.0
**Last Updated:** [Date]
**Classification:** [Internal / Operator-Visible]
```

---

# QUICK INCIDENT TEMPLATE

## Template: Rapid Incident Capture

```markdown
## 🚨 INCIDENT: {{TITLE}}

**ID:** {{INCIDENT_ID}}
**Severity:** {{SEVERITY}}
**Time:** {{REPORTED_AT}}

### What Happened
[Brief description]

### Impact
[Who/what is affected]

### Current Status
[What's being done]

### Next Steps
1. [Step 1]
2. [Step 2]

**Lead:** [Agent]
**ETA to Resolution:** [Time estimate]
```

---

# SEVERITY GUIDELINES

## SEV-1: Critical
- System completely non-functional
- Security breach in progress
- Data loss or corruption
- Client-facing failure

**Response Time:** < 5 minutes
**Escalation:** Immediate to Arbiter

## SEV-2: High
- Major feature unavailable
- Significant performance degradation
- Security vulnerability discovered
- Client communication failure

**Response Time:** < 30 minutes
**Escalation:** Overseer + Guardian

## SEV-3: Medium
- Non-critical feature impacted
- Workaround available
- Quality degradation
- Minor client issue

**Response Time:** < 4 hours
**Escalation:** Relevant domain agent

## SEV-4: Low
- Minor issue
- Cosmetic problem
- Process inefficiency
- Documentation gap

**Response Time:** < 24 hours
**Escalation:** Log for batch processing

---

# POST-INCIDENT REVIEW TEMPLATE

## Template: PIR (Post-Incident Review)

```markdown
# POST-INCIDENT REVIEW

**Incident:** {{INCIDENT_ID}} — {{TITLE}}
**Review Date:** [Date]
**Facilitator:** [Agent]
**Participants:** [List of agents involved]

---

## INCIDENT RECAP

**Duration:** {{DURATION}}
**Severity:** {{SEVERITY}}
**Impact:** {{IMPACT}}

---

## TIMELINE REVIEW

[Detailed timeline with key decision points highlighted]

---

## FIVE WHYS ANALYSIS

1. **Why did the incident occur?**
   → [Answer 1]

2. **Why did [Answer 1] happen?**
   → [Answer 2]

3. **Why did [Answer 2] happen?**
   → [Answer 3]

4. **Why did [Answer 3] happen?**
   → [Answer 4]

5. **Why did [Answer 4] happen?**
   → [Root Cause]

---

## WHAT WORKED WELL

| Category | Observation |
|----------|-------------|
| Detection | [What helped detect the issue] |
| Response | [What response actions were effective] |
| Communication | [What communication worked well] |
| Recovery | [What helped recover quickly] |

---

## WHAT COULD BE IMPROVED

| Category | Gap | Improvement |
|----------|-----|-------------|
| Detection | [Gap] | [Improvement] |
| Response | [Gap] | [Improvement] |
| Communication | [Gap] | [Improvement] |
| Prevention | [Gap] | [Improvement] |

---

## ACTION ITEMS

| # | Action | Owner | Priority | Due | Status |
|---|--------|-------|----------|-----|--------|
| 1 | [Action] | [Agent] | H/M/L | [Date] | ☐ |
| 2 | [Action] | [Agent] | H/M/L | [Date] | ☐ |
| 3 | [Action] | [Agent] | H/M/L | [Date] | ☐ |

---

## PLAYBOOK UPDATES

**Updates Required:**
- [ ] [Playbook] — [Change needed]

**New Playbook Needed:**
- [ ] [Description of new playbook]

---

## METRICS

| Metric | Value | Target | Gap |
|--------|-------|--------|-----|
| Time to Detect | [X] min | [Y] min | +/-[Z] |
| Time to Respond | [X] min | [Y] min | +/-[Z] |
| Time to Resolve | [X] min | [Y] min | +/-[Z] |
| Customer Impact | [Scope] | Minimal | [Gap] |

---

## LESSONS LEARNED

### Key Takeaway
[The most important lesson from this incident]

### Pattern Match
[Does this match any known patterns? Link to similar incidents]

### Systemic Issues
[Any broader system issues this exposed]

---

## SIGN-OFF

This review is complete and all action items are assigned.

| Role | Agent | Date |
|------|-------|------|
| Review Lead | [Agent] | [Date] |
| Technical Approval | Guardian 🛡️ | [Date] |
| Process Approval | Overseer 👁️ | [Date] |

→ Learning 📚: Archive this PIR for future reference
```

---

# USAGE GUIDELINES

## When to Create
- **Full Report:** SEV-1 and SEV-2 incidents
- **Quick Capture:** SEV-3 and SEV-4 incidents
- **PIR:** All SEV-1, SEV-2, and recurring SEV-3 incidents

## Timing
- Quick capture: During incident
- Full report: Within 24 hours of resolution
- PIR: Within 72 hours of resolution

## Storage
All incident reports stored in `/data/incidents/` with naming convention:
`INC-YYYY-MM-###_title_slug.md`

## Quality Gate
All SEV-1 and SEV-2 reports require Arbiter sign-off before closing.

---

**Template Version:** 1.0  
**Last Updated:** 2026-01-25  
**Owner:** Guardian 🛡️ / Overseer 👁️
