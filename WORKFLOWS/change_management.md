# WORKFLOW: CHANGE MANAGEMENT
## Proposal → Review → Vote → Merge

---

# PURPOSE

This workflow governs how changes are made to the ARI system itself — prompts, configurations, policies, and governance rules. It ensures changes are deliberate, reviewed, and approved through appropriate governance.

---

# CHANGE CATEGORIES

| Category | Examples | Approval Required |
|----------|----------|-------------------|
| **MINOR** | Typo fixes, formatting, clarification | Operator |
| **STANDARD** | New patterns, updated templates, prompt tweaks | Operator + Overseer |
| **SIGNIFICANT** | New agent, major prompt rewrite, process change | Operator + Council majority |
| **CRITICAL** | Governance rules, security policies, trust boundaries | Council supermajority + Arbiter |

---

# CHANGE PROPOSAL FORMAT

```markdown
# CHANGE PROPOSAL: [Title]

**ID:** CP-[YYYY]-[###]
**Category:** [MINOR / STANDARD / SIGNIFICANT / CRITICAL]
**Submitted By:** [Agent or Operator]
**Date:** [Date]

---

## Summary

[One paragraph describing the change]

---

## Motivation

**Problem:** [What issue this solves]

**Evidence:** [Data supporting the need for change]

**Alternatives Considered:**
1. [Alternative 1] — Why not: [Reason]
2. [Alternative 2] — Why not: [Reason]

---

## Proposed Change

### Current State
```
[What exists now]
```

### Proposed State
```
[What it will look like after]
```

### Diff
```diff
- [removed]
+ [added]
```

---

## Impact Assessment

| Area | Impact | Details |
|------|--------|---------|
| Security | [None/Low/Medium/High] | [Explanation] |
| Performance | [None/Low/Medium/High] | [Explanation] |
| User Experience | [None/Low/Medium/High] | [Explanation] |
| Backwards Compatibility | [None/Low/Medium/High] | [Explanation] |
| Other Systems | [None/Low/Medium/High] | [Explanation] |

---

## Rollback Plan

[How to revert if the change causes problems]

---

## Testing Plan

- [ ] [Test 1]
- [ ] [Test 2]
- [ ] [Test 3]

---

## Approval Required

- [ ] Operator approval
- [ ] Overseer review
- [ ] Council vote (if SIGNIFICANT+)
- [ ] Arbiter sign-off (if CRITICAL)

---

## Timeline

- Proposed: [Date]
- Review complete by: [Date]
- Implementation: [Date]
- Verification: [Date]
```

---

# REVIEW PROCESS

## Stage 1: Initial Review

**Reviewer:** Overseer 👁️

**Checklist:**
- [ ] Proposal is complete (all sections filled)
- [ ] Change is clearly described
- [ ] Impact assessment is realistic
- [ ] Rollback plan is viable
- [ ] Testing plan is adequate
- [ ] Appropriate category assigned

**Outcomes:**
- **PROCEED** — Move to next stage
- **REVISE** — Return with feedback
- **REJECT** — Decline with reason

## Stage 2: Domain Review

**Reviewers:** Affected domain agents

For each affected domain:
- [ ] Agent reviewed impact on their area
- [ ] No conflicts identified (or conflicts documented)
- [ ] Agent provides recommendation

## Stage 3: Governance Review (if SIGNIFICANT+)

**Reviewer:** Council

**Process:**
1. Proposal shared with all council members
2. Discussion period (24-48 hours for non-urgent)
3. Vote called by Arbiter
4. Results tallied

**Vote Thresholds:**
- SIGNIFICANT: Majority (>50%)
- CRITICAL: Supermajority (≥66%)

## Stage 4: Final Approval

**Approver:** Based on category

| Category | Final Approver |
|----------|----------------|
| MINOR | Operator |
| STANDARD | Operator |
| SIGNIFICANT | Operator (after council majority) |
| CRITICAL | Arbiter (after council supermajority) |

---

# IMPLEMENTATION PROCESS

## Pre-Implementation

1. **Backup Current State**
   ```bash
   # Create backup of affected files
   cp [file] [file].backup-[date]
   ```

2. **Announce Change**
   ```markdown
   ## 📢 CHANGE IMPLEMENTATION STARTING
   
   **Change:** [CP-ID]: [Title]
   **Affects:** [List of affected components]
   **Expected Duration:** [Time]
   **Rollback Ready:** Yes
   ```

## Implementation

3. **Make Changes**
   - Apply changes as specified in proposal
   - Follow diff exactly
   - Document any deviations

4. **Verify Changes**
   - Run testing plan
   - Confirm expected behavior
   - Check for unintended side effects

## Post-Implementation

5. **Confirm Success**
   ```markdown
   ## ✅ CHANGE IMPLEMENTED
   
   **Change:** [CP-ID]: [Title]
   **Status:** SUCCESS
   **Verification:** All tests passing
   
   **Changes Made:**
   - [File 1]: [Change description]
   - [File 2]: [Change description]
   ```

6. **Update Documentation**
   - Update DECISIONS.md if precedent-setting
   - Update relevant docs to reflect change
   - Archive proposal

---

# ROLLBACK PROCESS

If change causes issues:

```markdown
## 🔙 ROLLBACK INITIATED

**Change:** [CP-ID]: [Title]
**Reason for Rollback:** [What went wrong]
**Initiated By:** [Who]
**Timestamp:** [When]

---

### Rollback Steps

1. [ ] Stop affected processes
2. [ ] Restore from backup
3. [ ] Verify restoration
4. [ ] Confirm system stable

### Post-Rollback

- [ ] Document what went wrong
- [ ] Update proposal with learnings
- [ ] Decide: abandon, revise, or retry
```

---

# EMERGENCY CHANGES

For urgent security or stability issues:

```markdown
## 🚨 EMERGENCY CHANGE REQUEST

**ID:** EC-[YYYY]-[###]
**Urgency:** CRITICAL
**Submitted By:** [Who]
**Timestamp:** [When]

---

### Issue

[What's broken/vulnerable]

### Risk of Delay

[What happens if we don't act now]

### Proposed Fix

[Minimal change to address issue]

### Rollback

[How to undo if fix causes problems]

---

**Emergency Process:**
1. Operator verbal/written approval
2. Implement immediately
3. Document within 24 hours
4. Formal review within 1 week
```

---

# CHANGE LOG

All changes are logged in DECISIONS.md:

```markdown
## CHANGE LOG ENTRY

**ID:** [CP-ID]
**Date:** [Date]
**Category:** [Category]
**Title:** [Title]

**Summary:** [One sentence]

**Approval Chain:**
- Proposed by: [Who]
- Reviewed by: [Who]
- Approved by: [Who]
- Implemented by: [Who]

**Outcome:** [SUCCESS / ROLLED BACK / MODIFIED]

**Learnings:** [If any]
```

---

# CHANGE FREEZE

During critical periods:

```markdown
## 🔒 CHANGE FREEZE IN EFFECT

**Period:** [Start] to [End]
**Reason:** [Why freeze is needed]

**Allowed During Freeze:**
- Emergency security fixes
- Critical bug fixes
- Documentation corrections

**Not Allowed:**
- New features
- Refactoring
- Non-critical changes

**Freeze Lifted:** [Conditions for lifting]
```

---

# GOVERNANCE INTEGRATION

## Changes to Governance Rules

Changes to governance itself require:

1. CRITICAL category classification
2. Council supermajority (≥66%)
3. Arbiter explicit sign-off
4. 48-hour minimum review period
5. Documentation of precedent

## Changes to Security Policies

Changes to security require:

1. Security council member review
2. Threat model update (if applicable)
3. No regression in security posture
4. Testing of affected trust boundaries

---

# METRICS

Track change management health:

| Metric | Target | Measure |
|--------|--------|---------|
| Change success rate | >95% | Changes not rolled back |
| Review cycle time | <48h for STANDARD | Time from proposal to approval |
| Rollback frequency | <5% | Percentage of changes rolled back |
| Emergency changes | <10%/month | Percentage bypassing standard process |
| Documentation completeness | 100% | All changes logged |

---

**Workflow Version:** 1.0  
**Last Updated:** January 2026  
**Owner:** Arbiter 👑
