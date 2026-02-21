# Policy Engine

The deterministic authority for runtime permission decisions.

## What the Policy Engine Does

When any agent wants to use a tool, the PolicyEngine decides:

1. **Is this agent allowed?** (agent allowlist check)
2. **Does the source have sufficient trust?** (trust level check)
3. **How risky is this operation?** (risk score calculation)
4. **Does it need human approval?** (permission tier gating)

If all checks pass, it issues a **ToolCallToken** — a cryptographically signed, single-use, time-bound authorization.

## How It Fits with Council and Arbiter

```
Question                              Who decides         How
──────────────────────────────────    ───────────────     ──────────────
"Can agent X use tool Y right now?"   PolicyEngine        Deterministic rules
"Should we add a new tool policy?"    Council             Democratic vote
"Does this violate the constitution?" Arbiter             Hardcoded checks
"Should we spend $0.50 on an AI call" AIPolicyGovernor    Cost-based voting
```

The PolicyEngine never deliberates. It applies rules mechanically.

## The 3-Layer Permission Check

Every tool request goes through three checks in order. If any fails, the request is denied.

```
Request: "Agent 'executor' wants to use 'file_write' with trust level 'operator'"

Layer 1: Agent Allowlist
  └── Is 'executor' in file_write's allowed_agents list?
      ├── YES → proceed to Layer 2
      └── NO  → DENIED ("Agent executor not in tool allowlist")

Layer 2: Trust Level
  └── Is 'operator' trust >= required trust for file_write?
      ├── operator (0.9) >= standard (0.5) → YES → proceed to Layer 3
      └── NO → DENIED ("Trust level insufficient")

Layer 3: Permission Tier + Risk Score
  └── Calculate risk: base_severity(WRITE_SAFE=0.3) × multiplier(operator=0.6) = 0.18
      ├── Risk < 0.8 → check if approval needed
      │   ├── Tier is READ_ONLY or WRITE_SAFE → AUTO-APPROVED → issue token
      │   └── Tier is WRITE_DESTRUCTIVE or ADMIN → NEEDS APPROVAL → wait
      └── Risk >= 0.8 → BLOCKED (auto-block threshold)
```

## Risk Scoring Formula

```
Risk Score = Base Severity × Trust Multiplier
```

### Base Severity (by permission tier)

| Tier | Severity | Meaning |
|------|----------|---------|
| READ_ONLY | 0.1 | Information retrieval (low risk) |
| WRITE_SAFE | 0.3 | Non-destructive writes (moderate risk) |
| WRITE_DESTRUCTIVE | 0.6 | Destructive operations (high risk) |
| ADMIN | 0.9 | System configuration (very high risk) |

### Trust Multiplier (by trust level)

| Level | Multiplier | Effect |
|-------|-----------|--------|
| system | 0.5x | Halves the risk (internal operations) |
| operator | 0.6x | Reduces risk (trusted human) |
| verified | 0.75x | Slight reduction (authenticated source) |
| standard | 1.0x | No modification (baseline) |
| untrusted | 1.5x | Amplifies risk (unknown source) |
| hostile | 2.0x | Doubles the risk (known threat) |

### Auto-Block Threshold

Any request with risk score >= **0.8** is automatically blocked. No approval workflow, no council vote. Blocked.

Examples:

- `WRITE_DESTRUCTIVE (0.6) × untrusted (1.5) = 0.9` → **BLOCKED**
- `ADMIN (0.9) × standard (1.0) = 0.9` → **BLOCKED**
- `WRITE_SAFE (0.3) × hostile (2.0) = 0.6` → Allowed but logged
- `READ_ONLY (0.1) × hostile (2.0) = 0.2` → Allowed

## ToolCallToken

When a request is approved, the PolicyEngine issues a token. This token is:

- **Cryptographically signed** (HMAC-SHA256) — can't be forged
- **Single-use** — marked as used after execution, can't be replayed
- **Time-bound** — 5-minute TTL, expires after that
- **Parameter-bound** — SHA-256 hash of parameters, can't be used with different params

```
ToolCallToken {
  token_id:           "uuid"
  tool_id:            "file_write"
  agent_id:           "executor"
  parameters:         { path: "/tmp/output.txt", content: "..." }
  parameters_hash:    "sha256(parameters)"
  permission_tier:    "WRITE_SAFE"
  trust_level:        "operator"
  approved_by:        null (auto-approved) | "arbiter" (manual)
  approval_reasoning: "Auto-approved: meets trust and tier requirements"
  issued_at:          "2026-02-10T19:00:00.000Z"
  expires_at:         "2026-02-10T19:05:00.000Z"
  signature:          "hmac-sha256(...)"
  used:               false
}
```

## Approval Workflow

For `WRITE_DESTRUCTIVE` and `ADMIN` tiers:

```
1. PolicyEngine creates PermissionRequest (status: PENDING)
2. Emits 'permission:approval_required' event
3. Arbiter or Overseer receives the event
4. Approver calls policyEngine.approve(requestId, approver, reasoning)
   OR policyEngine.reject(requestId, rejector, reason)
5. If approved → token issued
6. If rejected → error thrown
7. If 30 seconds pass → request expires automatically
```

## Tool Policies

Each tool has a policy that defines its permission requirements:

```typescript
{
  tool_id:              "file_write",
  permission_tier:      "WRITE_SAFE",
  required_trust_level: "standard",
  allowed_agents:       ["executor", "planner"],
  rate_limit:           100  // max calls per hour
}
```

Policies can be loaded from a JSON config file (`tool-policies.json`) or registered programmatically.

## Governance Triggers (Deterministic)

| Condition | Action | No Exceptions |
|-----------|--------|---------------|
| Risk score >= 0.8 | Block request | Even system-level can't override |
| Agent not in allowlist | Deny | Must update policy to change |
| Trust below minimum | Deny | Must authenticate to higher trust |
| WRITE_DESTRUCTIVE tier | Wait for approval | 30-second timeout |
| ADMIN tier | Wait for approval | Requires arbiter or overseer |
| Token already used | Reject execution | Single-use is absolute |
| Token expired | Reject execution | 5-minute TTL is absolute |
| Parameter hash mismatch | Reject execution | Parameters can't be modified |

## Implementation

| File | Purpose |
|------|---------|
| `src/governance/policy-engine.ts` | PolicyEngine class (632 lines) |
| `src/kernel/types.ts` | ToolPolicy, ToolCallToken, PermissionCheckResult schemas |
| `src/kernel/constitutional-invariants.ts` | PERMISSION_MODEL definition |
| `tests/unit/governance/policy-engine.test.ts` | PolicyEngine tests |

## Relationship to AIPolicyGovernor

The **AIPolicyGovernor** (`src/ai/ai-policy-governor.ts`) handles a different concern: **AI spending governance**. It uses the Council voting system to approve or reject AI API calls based on their estimated cost.

| Concern | Handler | Decision Method |
|---------|---------|-----------------|
| Tool permissions | PolicyEngine | Deterministic 3-layer check |
| AI spending | AIPolicyGovernor | Cost-based council voting |
| Constitutional compliance | Arbiter | Hardcoded rule checks |
| Quality gates | Overseer | Quality gate evaluation |

---

v1.0 - 2026-02-10
