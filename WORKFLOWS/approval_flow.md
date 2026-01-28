# WORKFLOW: APPROVAL FLOW
## Plan → Diff → Approve → Execute

---

# PURPOSE

This workflow ensures that destructive, sensitive, or high-impact actions are reviewed before execution. It provides transparency, prevents mistakes, and maintains operator control over the system.

---

# CORE PRINCIPLE

> "Show me what you're going to do before you do it. Let me approve, modify, or reject."

---

# WHEN APPROVAL IS REQUIRED

## Automatic Approval Required

| Category | Examples | Approval Level |
|----------|----------|----------------|
| **Financial** | Sending invoices, payment requests | Operator |
| **Client Communication** | Emails, proposals, contracts | Overseer → Operator |
| **External Communication** | DMs, social posts, public content | Overseer → Operator |
| **File Modifications** | Editing existing files | Operator |
| **File Deletions** | Removing any file | Operator |
| **Deployments** | Pushing to production | Operator |
| **Configuration Changes** | Modifying settings | Operator |
| **Memory Writes** | Adding/modifying memory entries | Automatic (logged) |
| **Tool Executions** | Running destructive tools | Operator |

## Approval Levels

| Level | Authority | Use Case |
|-------|-----------|----------|
| **AUTO** | System | READ_ONLY operations, internal reasoning |
| **OVERSEER** | Overseer 👁️ | Quality checks before client-facing |
| **OPERATOR** | Human (Pryce) | Destructive actions, external comms, money |
| **ARBITER** | Arbiter 👑 | Governance changes, conflicts, precedent |
| **COUNCIL** | Full council vote | Major system changes |

---

# APPROVAL FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                    REQUEST RECEIVED                         │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLASSIFY ACTION                          │
│  - What permission tier?                                    │
│  - What's the blast radius?                                 │
│  - Is it reversible?                                        │
└─────────────────────────────┬───────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
        ┌─────────┐     ┌─────────┐     ┌─────────┐
        │READ_ONLY│     │  WRITE  │     │  WRITE  │
        │  AUTO   │     │  SAFE   │     │  DEST.  │
        └────┬────┘     └────┬────┘     └────┬────┘
             │               │               │
             ▼               ▼               ▼
        ┌─────────┐     ┌─────────┐     ┌─────────┐
        │ EXECUTE │     │GENERATE │     │GENERATE │
        │ DIRECTLY│     │  PLAN   │     │  PLAN   │
        └────┬────┘     └────┬────┘     └────┬────┘
             │               │               │
             │               ▼               ▼
             │          ┌─────────┐     ┌─────────┐
             │          │  SHOW   │     │  SHOW   │
             │          │  DIFF   │     │  DIFF   │
             │          └────┬────┘     └────┬────┘
             │               │               │
             │               ▼               ▼
             │          ┌─────────┐     ┌─────────┐
             │          │  ASK    │     │  ASK    │
             │          │ OVERSEER│     │OPERATOR │
             │          └────┬────┘     └────┬────┘
             │               │               │
             │          ┌────┴────┐     ┌────┴────┐
             │          │         │     │         │
             │          ▼         ▼     ▼         ▼
             │      APPROVE    REJECT  APPROVE  REJECT
             │          │         │     │         │
             │          ▼         │     ▼         │
             │     ┌─────────┐    │┌─────────┐    │
             │     │ EXECUTE │    ││ EXECUTE │    │
             │     └────┬────┘    │└────┬────┘    │
             │          │         │     │         │
             └──────────┴─────────┴─────┴─────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    LOG OUTCOME                              │
│  - Action taken (or not)                                    │
│  - Approval chain                                           │
│  - Result                                                   │
└─────────────────────────────────────────────────────────────┘
```

---

# APPROVAL REQUEST FORMAT

## Standard Approval Request

```markdown
## ⏳ APPROVAL REQUESTED

**Action:** [What will be done]
**Type:** [WRITE_SAFE / WRITE_DESTRUCTIVE / ADMIN]
**Reversible:** [Yes / No / Partial]

---

### What I Want to Do

[Clear description of the action]

### Why

[Reasoning for this action]

### What Changes

**Before:**
```
[Current state or "N/A - new creation"]
```

**After:**
```
[Proposed state]
```

### Risk Assessment

| Factor | Assessment |
|--------|------------|
| Blast radius | [Low/Medium/High] |
| Reversibility | [Easy/Possible/Difficult/Impossible] |
| Urgency | [Low/Medium/High] |
| Confidence | [Low/Medium/High] |

### Rollback Plan

[How to undo if something goes wrong]

---

**Options:**
- ✅ **APPROVE** — Execute as planned
- ✏️ **MODIFY** — Make changes and resubmit
- ❌ **REJECT** — Do not execute

**Awaiting:** [Overseer 👁️ / Operator / Arbiter 👑]
```

---

# DIFF DISPLAY FORMAT

## For Text/Code Changes

```markdown
### Diff: [filename]

```diff
- [removed line]
+ [added line]
  [unchanged context]
- [removed line]
+ [added line]
```

**Summary:** [X] additions, [Y] deletions, [Z] files affected
```

## For Configuration Changes

```markdown
### Config Change: [config name]

| Setting | Current | Proposed |
|---------|---------|----------|
| setting_a | value1 | value2 |
| setting_b | value3 | value4 |
```

## For State Changes

```markdown
### State Change: [entity]

**Current State:**
- Status: [current]
- [Other relevant fields]

**Proposed State:**
- Status: [proposed]
- [Other relevant fields]

**Reason for Change:** [explanation]
```

---

# APPROVAL RESPONSES

## Approve

```markdown
## ✅ APPROVED

**Action:** [What was approved]
**Approved By:** [Who]
**Timestamp:** [When]

**Conditions:** [Any conditions on execution, or "None"]

→ Proceeding with execution.
```

## Modify

```markdown
## ✏️ MODIFICATION REQUESTED

**Action:** [What was proposed]
**Requested By:** [Who]

**Changes Required:**
1. [Change 1]
2. [Change 2]

**Resubmit:** After making changes, submit new approval request.
```

## Reject

```markdown
## ❌ REJECTED

**Action:** [What was proposed]
**Rejected By:** [Who]
**Timestamp:** [When]

**Reason:**
[Why rejected]

**Alternative:** [Suggested alternative approach, if any]

→ Action will NOT be executed.
```

---

# EXECUTION CONFIRMATION

After approved action completes:

```markdown
## ✅ EXECUTED

**Action:** [What was done]
**Approved By:** [Who]
**Executed At:** [Timestamp]

**Result:** [SUCCESS / PARTIAL / FAILED]

**Details:**
[What happened]

**Verification:**
[How we know it worked]

→ Logged to audit trail.
```

---

# BATCH APPROVAL

For multiple related actions:

```markdown
## ⏳ BATCH APPROVAL REQUESTED

**Batch ID:** [ID]
**Total Actions:** [X]
**Type:** [Category]

---

### Actions Included

| # | Action | Type | Risk |
|---|--------|------|------|
| 1 | [Action] | [Type] | [Low/Med/High] |
| 2 | [Action] | [Type] | [Low/Med/High] |
| 3 | [Action] | [Type] | [Low/Med/High] |

---

### Options

- ✅ **APPROVE ALL** — Execute all actions
- 🔢 **APPROVE SOME** — Specify which (e.g., "1, 3")
- ❌ **REJECT ALL** — Execute none
```

---

# EMERGENCY OVERRIDE

For urgent situations (use sparingly):

```markdown
## 🚨 EMERGENCY APPROVAL REQUEST

**Action:** [What needs to happen NOW]
**Urgency:** CRITICAL
**Deadline:** [Time constraint]

**Why Emergency:**
[Explanation of urgency]

**Risk of Delay:**
[What happens if we wait]

**Risk of Action:**
[What could go wrong]

---

**Standard approval would take too long because:** [Reason]

**Emergency Options:**
- 🚨 **APPROVE NOW** — Execute immediately
- ⏸️ **HOLD** — Wait for standard review
- ❌ **REJECT** — Do not execute
```

---

# AUDIT LOG ENTRY

Every approval creates an audit entry:

```json
{
  "event_type": "APPROVAL_REQUEST",
  "timestamp": "2026-01-26T10:30:00Z",
  "request_id": "APR-2026-001",
  "action": "send_client_email",
  "permission_level": "WRITE_DESTRUCTIVE",
  "requested_by": "CLIENT_COMMS",
  "approved_by": "OPERATOR",
  "decision": "APPROVED",
  "conditions": [],
  "execution_result": "SUCCESS",
  "execution_timestamp": "2026-01-26T10:31:00Z"
}
```

---

# TIMEOUT HANDLING

If approval not received within threshold:

| Urgency | Timeout | Action |
|---------|---------|--------|
| Low | 24 hours | Remind once, then hold |
| Medium | 4 hours | Remind, then escalate |
| High | 1 hour | Escalate immediately |
| Critical | N/A | Continuous until resolved |

```markdown
## ⏰ APPROVAL TIMEOUT

**Request:** [Original request]
**Submitted:** [Time]
**Waiting:** [Duration]

**Status:** Awaiting response

**Options:**
- Respond now
- I'll remind again in [X]
- Cancel request
```

---

# APPROVAL BEST PRACTICES

## For Requesters (Agents)

1. **Be Specific** — Clearly state what you want to do
2. **Show Your Work** — Include the diff/changes
3. **Assess Risk** — Be honest about what could go wrong
4. **Provide Rollback** — Always have a plan B
5. **Batch When Sensible** — Group related changes

## For Approvers (Operator)

1. **Read Carefully** — Understand what you're approving
2. **Check the Diff** — Verify the actual changes
3. **Consider Reversibility** — Know how to undo
4. **Trust But Verify** — Approve doesn't mean blind trust
5. **Reject Without Guilt** — "No" is a valid answer

---

**Workflow Version:** 1.0  
**Last Updated:** January 2026  
**Owner:** Arbiter 👑
