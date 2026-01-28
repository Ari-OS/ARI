# STATUS UPDATE TEMPLATES
## Pipeline and Project Status Reporting

---

# VARIABLES
```
{{DATE}}              - Report date
{{PERIOD}}            - Reporting period (week/month)
{{REVENUE_ACTUAL}}    - Actual revenue
{{REVENUE_TARGET}}    - Target revenue
{{DEALS_CLOSED}}      - Number of closed deals
{{PROPOSALS_OUT}}     - Active proposals
{{PIPELINE_VALUE}}    - Total pipeline value
{{PROJECTS_ACTIVE}}   - Active project count
{{PROJECTS_COMPLETE}} - Completed projects
```

---

# DAILY STATUS

## Template: Daily Status Check

```markdown
## 📋 DAILY STATUS — {{DATE}}

### TODAY'S PRIORITIES
1. [ ] [Priority 1]
2. [ ] [Priority 2]
3. [ ] [Priority 3]

### PIPELINE SNAPSHOT
| Metric | Today | Change |
|--------|-------|--------|
| Active Leads | [X] | +/- |
| Proposals Out | [X] | +/- |
| Projects In Progress | [X] | +/- |

### COMPLETED YESTERDAY
- [Task 1]
- [Task 2]

### BLOCKERS
- [Any blockers or waiting items]

### NOTES
[Any relevant context]
```

---

# WEEKLY STATUS

## Template: Weekly Pipeline Review

```markdown
## 📋 WEEKLY STATUS — Week of {{DATE}}

---

### EXECUTIVE SUMMARY

**Revenue This Week:** ${{REVENUE_ACTUAL}}
**Pipeline Value:** ${{PIPELINE_VALUE}}
**Win Rate:** [X]%

[1-2 sentence summary of the week]

---

### PIPELINE STATUS

#### Active Prospects

| Prospect | Stage | Days | Next Action | Priority |
|----------|-------|------|-------------|----------|
| [Name] | [Stage] | [#] | [Action] | H/M/L |
| [Name] | [Stage] | [#] | [Action] | H/M/L |

#### Stage Summary

| Stage | Count | Value |
|-------|-------|-------|
| Lead | [X] | $[X] |
| Contacted | [X] | $[X] |
| Qualifying | [X] | $[X] |
| Proposal | [X] | $[X] |
| **Total Pipeline** | [X] | $[X] |

---

### PROJECT STATUS

| Project | Client | Stage | Progress | Deadline |
|---------|--------|-------|----------|----------|
| [Name] | [Client] | [Stage] | [%] | [Date] |

---

### THIS WEEK'S WINS 🎉
- [Win 1]
- [Win 2]

### THIS WEEK'S CHALLENGES
- [Challenge 1]
- [Challenge 2]

### PATTERNS OBSERVED
[What worked/didn't work this week]

---

### NEXT WEEK PRIORITIES

1. **[Priority 1]** — [Why it matters]
2. **[Priority 2]** — [Why it matters]
3. **[Priority 3]** — [Why it matters]

---

### METRICS

| Metric | This Week | Last Week | Target |
|--------|-----------|-----------|--------|
| Outreach sent | [X] | [X] | [X] |
| Response rate | [X]% | [X]% | [X]% |
| Proposals sent | [X] | [X] | [X] |
| Deals closed | [X] | [X] | [X] |

→ Learning 📚: [Key insight to capture]
```

---

# MONTHLY STATUS

## Template: Monthly Business Review

```markdown
## 📊 MONTHLY REVIEW — {{PERIOD}}

---

### FINANCIAL SUMMARY

| Metric | Actual | Target | Variance |
|--------|--------|--------|----------|
| Revenue | ${{REVENUE_ACTUAL}} | ${{REVENUE_TARGET}} | +/-$[X] |
| Deals Closed | {{DEALS_CLOSED}} | [X] | +/-[X] |
| Avg Deal Size | $[X] | $[X] | +/-$[X] |

---

### PIPELINE HEALTH

**Beginning of Month:** $[X] pipeline value
**End of Month:** ${{PIPELINE_VALUE}}
**Net Change:** +/-$[X]

#### Conversion Funnel

| Stage | Started | Converted | Rate |
|-------|---------|-----------|------|
| Lead → Contacted | [X] | [X] | [X]% |
| Contacted → Qualifying | [X] | [X] | [X]% |
| Qualifying → Proposal | [X] | [X] | [X]% |
| Proposal → Closed | [X] | [X] | [X]% |

**Overall Conversion:** [X]%

---

### WINS THIS MONTH

1. **[Major Win]** — [Impact]
2. **[Win 2]** — [Impact]
3. **[Win 3]** — [Impact]

---

### LOSSES THIS MONTH

| Lost Deal | Reason | Lesson |
|-----------|--------|--------|
| [Name] | [Why] | [Learning] |

---

### PATTERNS & INSIGHTS

#### What's Working
- [Pattern 1]
- [Pattern 2]

#### What's Not Working
- [Issue 1]
- [Issue 2]

#### Emerging Patterns
- [Observation 1]
- [Observation 2]

---

### OPERATIONAL METRICS

| Metric | This Month | Last Month | Trend |
|--------|------------|------------|-------|
| Projects delivered | [X] | [X] | ↑/↓/→ |
| Avg delivery time | [X] days | [X] days | ↑/↓/→ |
| Client satisfaction | [X/5] | [X/5] | ↑/↓/→ |
| Testimonials received | [X] | [X] | ↑/↓/→ |

---

### NEXT MONTH PRIORITIES

1. **[Goal 1]**
   - Target: [Specific metric]
   - Actions: [Key steps]

2. **[Goal 2]**
   - Target: [Specific metric]
   - Actions: [Key steps]

3. **[Goal 3]**
   - Target: [Specific metric]
   - Actions: [Key steps]

---

### RESOURCE NEEDS

- [Any tools, time, or support needed]

---

### STRATEGIC NOTES

[Big picture observations, strategic adjustments, market changes]

→ Learning 📚: Update playbooks with month's patterns
```

---

# PROJECT STATUS

## Template: Project Status Report

```markdown
## 🏗️ PROJECT STATUS: {{PROJECT_NAME}}

**Client:** {{CLIENT_NAME}}
**Package:** [Package Type]
**Start Date:** {{DATE}}
**Target Launch:** {{DEADLINE}}

---

### OVERALL STATUS: 🟢 On Track / 🟡 At Risk / 🔴 Blocked

**Progress:** [X]% complete

---

### PHASE STATUS

| Phase | Status | Notes |
|-------|--------|-------|
| ☐/☑ Kickoff | Complete/In Progress/Pending | [Notes] |
| ☐/☑ Design | Complete/In Progress/Pending | [Notes] |
| ☐/☑ Development | Complete/In Progress/Pending | [Notes] |
| ☐/☑ Review | Complete/In Progress/Pending | [Notes] |
| ☐/☑ Launch | Complete/In Progress/Pending | [Notes] |

---

### COMPLETED THIS PERIOD
- [Item 1]
- [Item 2]

### IN PROGRESS
- [Item 1] — [% complete]

### NEXT STEPS
1. [Next action]
2. [Following action]

---

### BLOCKERS / RISKS

| Issue | Impact | Mitigation |
|-------|--------|------------|
| [Issue] | [H/M/L] | [Action] |

---

### CLIENT COMMUNICATION

**Last Contact:** {{DATE}}
**Next Touchpoint:** {{DATE}}
**Client Sentiment:** 😊 Happy / 😐 Neutral / 😟 Concerned

---

### BUDGET

| Item | Budgeted | Actual | Variance |
|------|----------|--------|----------|
| Hours | [X] | [X] | +/-[X] |
| Cost | $[X] | $[X] | +/-$[X] |

---

### NOTES
[Any additional context]
```

---

# USAGE GUIDELINES

## Frequency
- **Daily Status:** Every work day, morning
- **Weekly Review:** End of week (Friday)
- **Monthly Review:** First week of new month
- **Project Status:** As needed, client-facing updates

## Automation
Pipeline 📋 generates status reports automatically based on tracked data.

## Quality Gate
Weekly and Monthly reviews should be reviewed by Strategy 📊 before sharing.

---

**Template Version:** 1.0  
**Last Updated:** 2026-01-25  
**Owner:** Pipeline 📋
