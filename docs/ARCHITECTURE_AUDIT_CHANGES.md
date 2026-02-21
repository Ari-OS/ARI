# 🏗️ ARI Security Architecture — What Changed & How It All Works

Your guide to understanding ARI's security, governance, and operations.
Written to build understanding progressively — start at the top, everything builds on what came before.

**When**: 2026-02-10 → 2026-02-13
**Why**: External architecture audit (ChatGPT) + follow-up review + auth gap closure
**Result**: 4 code changes, 9 doc updates, 4002/4002 tests passing

---

## 🧠 The Big Picture (Start Here)

ARI has **four layers of protection**. Think of them like the security of a building:

```
🏢 THE ARI BUILDING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  🚪 FRONT DOOR (Gateway)
  │  Only opens from inside (127.0.0.1)
  │  Nobody from the internet can knock
  │
  🔑 ID CHECK (API Key Auth)
  │  Every visitor needs a badge (X-ARI-Key header)
  │  Badge stored in macOS Keychain
  │  Only /health is badge-free (monitoring)
  │
  🔒 SECURITY DESK (PolicyEngine)
  │  Checks every person (agent) + every action (tool)
  │  Issues a signed visitor badge (ToolCallToken)
  │  Badge expires in 5 minutes, works once, locked to one task
  │
  📋 THE RULES (Arbiter + Constitution)
  │  6 rules that NOBODY can break
  │  Not the security desk. Not the building owner.
  │  Not a unanimous vote. Nobody.
  │
  📝 SECURITY CAMERAS (Audit Chain)
     Records everything that happens
     Can't be edited (hash chain)
     Can't be replaced (Keychain-signed checkpoints)
     Footage stored separately from the building

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

That's it. That's the whole security model. Everything below is just the details of how each piece works.

---

## 🚪 1. The Front Door (Network Policy)

### The Question That Started This

> "ARI says 'loopback-only' but also talks to Telegram and OpenAI. Isn't that a contradiction?"

### The Answer

**No.** These are two different directions:

```
                    ❌ BLOCKED                         ✅ ALLOWED
              ─────────────────                  ──────────────────

  Internet ──❌──► ARI                    ARI ──────► Telegram
  Your LAN ──❌──► ARI                    ARI ──────► Claude/GPT/Grok
  Hacker   ──❌──► ARI                    ARI ──────► Notion

       INBOUND                                 OUTBOUND
  (things connecting TO you)            (you connecting to THINGS)
```

**Real-world analogy**: Your house has a locked front door (nobody can walk in from the street). But you still have a phone and can call specific people. The locked door doesn't prevent you from making calls.

### Where Is This Enforced?

| Direction | Where                           | How                               | Can It Be Changed?                                               |
| --------- | ------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| Inbound   | `src/kernel/gateway.ts` line 34 | Hardcoded `'127.0.0.1'` constant  | ❌ No. It's `private readonly`. Also blocked by pre-commit hook. |
| Auth      | `src/kernel/gateway.ts`         | `X-ARI-Key` header, Keychain key  | Key auto-generated, no config to change                          |
| Outbound  | Each integration module         | API URLs are constants per module | Only by adding new code + passing review                         |

### What About DNS Attacks?

If someone tries to redirect `api.telegram.org` to a fake server:

- 🛡️ **TLS** blocks it — the fake server can't present Telegram's real certificate
- 🔑 **API keys** add another layer — the fake server can't generate valid API responses
- 📝 **ARI logs the TLS error** and fails gracefully

---

## 🔑 2. The ID Check (API Key Authentication)

### The Problem

Even though ARI's gateway only listens on `127.0.0.1` (no internet access), **any local process** on your Mac could connect. Malware, a compromised app, or a rogue script could send requests without any credentials.

### The Solution

Every request to the gateway (except `/health`) must include an `X-ARI-Key` header with a valid API key.

```
Request arrives at 127.0.0.1:3141
    │
    ▼
Rate Limiter (100 requests/min)
    │
    ▼
┌─────────────────────────────────┐
│ API KEY CHECK                    │
│                                  │
│ Is this /health?                 │──── YES → Skip (monitoring exempt)
│                                  │
│ Is X-ARI-Key header present?     │──── NO  → 401 + audit "auth_missing"
│                                  │
│ Does the key match?              │──── NO  → 401 + audit "auth_failed"
│                                  │                + security alert event
│ ✅ Key is valid                  │
└──────────────┬───────────────────┘
               │
               ▼
         Route handler
```

### Where Is the Key?

```
┌───────────────┐     ┌──────────────┐     ┌───────────────┐
│ Gateway daemon │────►│ macOS        │◄────│ CLI tools     │
│ (runs 24/7)   │     │ Keychain     │     │ (budget, etc) │
│ Creates key   │     │              │     │ Load same key │
│ if none exists│     │ Single shared│     │ automatically │
└───────────────┘     │ key entry    │     └───────────────┘
                      └──────────────┘
```

- **First start**: Gateway generates a UUID key and stores it in Keychain under `ari-gateway-api-key`
- **Every start after**: Loads the same key from Keychain
- **CLI commands**: Call `Gateway.loadOrCreateApiKey()` to get the same key
- **No config files**: The key never touches the filesystem

### Why Keychain?

| Storage Method | Security | ARI Uses? |
|---------------|----------|-----------|
| Environment variable | Leaks in logs, process lists | ❌ |
| Config file | Readable by any local process | ❌ |
| **macOS Keychain** | **Protected by OS, needs user session** | **✅** |

Even if malware reads your entire filesystem, it can't access Keychain entries without your login session.

---

## 🔒 3. The Security Desk (PolicyEngine)

This is **the most important part** of ARI's security. Every tool use goes through this.

### The 3-Check Pipeline

Every time any agent wants to do anything, it must pass THREE checks:

```
  Agent wants to use a tool
         │
         ▼
  ┌─────────────────────────┐
  │ CHECK 1: ALLOWLIST       │     "Are you on the list?"
  │                          │
  │ Is this agent allowed    │──── ❌ NO  → DENIED
  │ to use this tool?        │
  └────────────┬─────────────┘
               │ ✅ YES
               ▼
  ┌─────────────────────────┐
  │ CHECK 2: TRUST LEVEL     │     "Do I trust your source?"
  │                          │
  │ Does the request have    │──── ❌ NO  → DENIED
  │ enough trust?            │
  └────────────┬─────────────┘
               │ ✅ YES
               ▼
  ┌─────────────────────────┐
  │ CHECK 3: RISK SCORE      │     "How dangerous is this?"
  │                          │
  │ Severity × Trust =       │──── 🚫 ≥ 0.8 → AUTO-BLOCKED
  │ Risk Score               │
  │                          │──── ⚠️ High tier → WAIT FOR APPROVAL
  │                          │
  │                          │──── ✅ Low risk → TOKEN ISSUED
  └─────────────────────────┘
```

### The Risk Formula (With Examples)

```
Risk Score = Base Severity × Trust Multiplier
```

**Base Severity** (how dangerous is the tool type?):
| Tool Type | Severity | Example

|
|-----------|----------|---------|
| 📖 READ_ONLY | 0.1 | Reading a file |
| ✏️ WRITE_SAFE | 0.3 | Writing to a safe location |
| 💥 WRITE_DESTRUCTIVE | 0.6 | Deleting files |
| 👑 ADMIN | 0.9 | Changing system config |

**Trust Multiplier** (how much do we trust the source?):

| Source | Multiplier | Effect |
|--------|-----------|--------|
| 🤖 system | ×0.5 | Halves the risk (ARI trusts itself) |
| 👤 operator | ×0.6 | Reduces risk (that's you, Pryce) |
| ✓ verified | ×0.75 | Slight reduction |
| • standard | ×1.0 | No change |
| ⚠️ untrusted | ×1.5 | Amplifies risk |
| 🚨 hostile | ×2.0 | Doubles the risk |

**Worked Examples**:

```
📖 You read a file:           0.1 × 0.6 = 0.06  ✅ Auto-approved
✏️ You write a file:          0.3 × 0.6 = 0.18  ✅ Auto-approved
💥 Unknown deletes files:     0.6 × 1.5 = 0.90  🚫 AUTO-BLOCKED
👑 Standard changes config:   0.9 × 1.0 = 0.90  🚫 AUTO-BLOCKED
✏️ Hostile writes a file:     0.3 × 2.0 = 0.60  ⚠️ Logged + allowed
📖 Hostile reads a file:      0.1 × 2.0 = 0.20  ✅ Allowed
```

The 0.8 threshold means: **destructive actions from untrusted sources are always blocked. No override. No exceptions.**

### The ToolCallToken (Permission Slip)

When a request passes all 3 checks, ARI issues a token. Think of it like a concert ticket:

```
🎫 ToolCallToken
┌──────────────────────────────────────────┐
│  🎯 Tool: file_write                     │
│  🤖 Agent: executor                      │
│  📋 Parameters: {path: "/tmp/out.txt"}   │
│  🔐 Params Hash: sha256(...)             │
│  ⏰ Expires: 5 minutes                   │
│  🔑 Signature: HMAC-SHA256(...)          │
│  ✅ Used: false                           │
│                                           │
│  ⚠️ ONE USE ONLY                          │
│  ⚠️ WRONG PARAMS = REJECTED              │
│  ⚠️ EXPIRED = REJECTED                   │
│  ⚠️ FORGED SIGNATURE = REJECTED          │
└──────────────────────────────────────────┘
```

**Why this matters**: Even if an agent goes rogue, it can't reuse old tokens, use a token for a different purpose, or create fake tokens. Each action needs a fresh, signed, single-purpose permission.

---

## 📋 4. The Rules (Constitution + Arbiter)

Six rules that **cannot be broken by anyone or anything**:

| #   | Rule                 | What It Means                       | Example Violation                       |
| --- | -------------------- | ----------------------------------- | --------------------------------------- |
| 0   | 🧭 Creator Primacy   | Always act in Pryce's best interest | Doing something harmful to you          |
| 1   | 🚪 Loopback-Only     | Gateway only on 127.0.0.1           | Binding to 0.0.0.0 (internet-exposed)   |
| 2   | 📄 Content ≠ Command | Input is DATA, never instructions   | Treating user text as executable code   |
| 3   | 📝 Audit Immutable   | Logs are append-only, hash-chained  | Deleting or editing an audit entry      |
| 4   | 🔒 Least Privilege   | Default deny, minimum permissions   | Giving an agent more access than needed |
| 5   | 🏷️ Trust Required    | All messages must have trust levels | Processing a message with no trust tag  |

**The Arbiter** enforces these. It checks every action against all 6 rules. If any rule is violated:

- ❌ Action is blocked
- 🚨 Security alert fires
- 📝 Violation is logged
- 🗳️ Even a 15/15 unanimous council vote CANNOT override it

---

## 📝 5. Security Cameras (Audit Chain)

### How the Hash Chain Works

Every event gets a "fingerprint" (SHA-256 hash), and each event includes the previous event's fingerprint:

```
  Event 1               Event 2               Event 3
  ┌──────────┐         ┌──────────┐         ┌──────────┐
  │ action   │         │ action   │         │ action   │
  │ who      │         │ who      │         │ who      │
  │ when     │         │ when     │         │ when     │
  │          │         │          │         │          │
  │ prev: 000│◄────────│ prev: A1 │◄────────│ prev: B2 │
  │ hash: A1 │         │ hash: B2 │         │ hash: C3 │
  └──────────┘         └──────────┘         └──────────┘
       │                    │                    │
   (genesis)         (points to E1)       (points to E2)
```

**If someone modifies Event 1**: Its fingerprint changes from A1 to something else. But Event 2 still says "prev: A1". **Mismatch detected. Chain broken.**

### The Checkpoint System (Closes the Replacement Attack)

**The attack**: Replace the ENTIRE file with a new chain. The new chain is internally consistent — all fingerprints match. Verification passes. You'd never know.

**The defense**: Checkpoints.

```
Events:  E1 → E2 → E3 → ... → E100 → E101 → ... → E200
                                  │                    │
                            Checkpoint 1          Checkpoint 2
                            ┌──────────┐          ┌──────────┐
                            │ count:100│          │ count:200│
                            │ head: X  │          │ head: Y  │
                            │ sig: 🔑  │          │ sig: 🔑  │
                            └──────────┘          └──────────┘
```

Every 100 events, ARI records: "At this point, the chain had X events and the last fingerprint was Y." Then it **signs** that record with a secret key.

### 🔑 The Key Is in Keychain (The Critical Fix)

**Before (the vulnerability)**:
The signing key was generated fresh every time ARI started. So:

1. Attacker replaces audit file
2. Attacker restarts ARI
3. New key generated → new checkpoints created → old checkpoints unverifiable
4. Attack succeeds ❌

**After (the fix)**:
The signing key is stored in **macOS Keychain** (backed by Secure Enclave on Apple Silicon):

1. Attacker replaces audit file
2. Attacker restarts ARI
3. ARI loads the SAME key from Keychain → old checkpoints still verifiable
4. Checkpoint verification fails → replacement detected → P0 alert ✅

```
  🔑 Where the signing key lives:

  BEFORE                              AFTER
  ─────────────────                   ─────────────────
  RAM (process memory)                macOS Keychain
  ❌ Dies on restart                  ✅ Survives restarts
  ❌ New key = old checkpoints        ✅ Same key = all checkpoints
     unverifiable                        verifiable
  ❌ Replace file + restart =         ✅ Replace file + restart =
     undetectable                        DETECTED
```

### What Holds Under Different Attack Scenarios?

| 🎯 Attacker Can...   | 🛡️ What Still Protects You                               | 💥 What Breaks                                             |
| -------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Read log files       | Chain integrity, signatures                              | Event details visible (no secrets stored though)           |
| Modify files on disk | Keychain key is NOT on disk. Checkpoints detect changes. | Hash chain is modified (but detected on verify)            |
| Log in as your user  | TLS still protects outbound connections                  | They can access Keychain → can forge checkpoints           |
| Get root access      | Nothing                                                  | Game over for any local system. Audit trail untrustworthy. |

**Bottom line**: The audit protects against **file-level tampering**. If the OS itself is compromised, all bets are off (this is true for every local-only system, not just ARI).

---

## 🗳️ 6. The Governance System (Who Decides What)

ARI has three branches of government, like a country:

```
  ┌─────────────────────────────────────────────────────────────┐
  │                    ARI GOVERNANCE                            │
  │                                                              │
  │  🏛️ LEGISLATIVE          ⚖️ JUDICIAL           🔧 RUNTIME    │
  │  (Council)               (Arbiter)             (PolicyEngine)│
  │                                                              │
  │  15 members vote         6 immutable rules     3-layer check │
  │  on policy questions     enforced absolutely   every tool use│
  │                                                              │
  │  "Should we add          "Does this violate    "Can agent X  │
  │   a new tool?"            the constitution?"    use tool Y   │
  │                                                 right now?"  │
  │                                                              │
  │  ADVISORY                ABSOLUTE               DETERMINISTIC│
  │  (can be overridden)     (cannot be overridden) (no judgment)│
  └─────────────────────────────────────────────────────────────┘
```

### The Council (15 Members, 5 Pillars)

| Pillar            | Members                          | Job                                               |
| ----------------- | -------------------------------- | ------------------------------------------------- |
| 🏗️ Infrastructure | ATLAS, BOLT, ECHO                | System operations, routing, memory                |
| 🛡️ Protection     | AEGIS, SCOUT                     | Security, risk assessment                         |
| 🎯 Strategy       | TRUE, TEMPO, OPAL                | Planning, scheduling, resources                   |
| 🌍 Domains        | PULSE, EMBER, PRISM, MINT, BLOOM | Health, relationships, creativity, wealth, growth |
| ⚖️ Meta           | VERA, NEXUS                      | Ethics, integration (NEXUS breaks ties)           |

**Voting**: Majority (8+), Supermajority (10+), or Unanimous (15/15) depending on importance.

**8 members have veto power** in their domain:

- 🛡️ AEGIS can veto anything security-related
- 💰 MINT can veto expensive operations
- ⚖️ VERA can veto unethical actions
- etc.

### AI Spending Governance

How much approval is needed to spend money on AI calls:

```
  💰 COST                    🗳️ APPROVAL NEEDED
  ──────────────────────     ──────────────────────────
  < $0.005                   ✅ Auto-approved (free pass)
  $0.005 - $0.05             8/15 vote (predicted, fast)
  $0.05  - $0.25             8/15 vote (weighted)
  $0.25  - $1.00             10/15 vote (full deliberation)
  > $1.00                    12/15 vote (full deliberation)
```

---

## 💰 7. Budget & Degradation

ARI has a daily spending limit that gets stricter as it approaches the cap:

```
  BUDGET METER
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  $0.00 ├──── 😊 NORMAL ────────────────┤ $2.00
        │     All models, full power     │
        │                                │
  $2.00 ├──── ⚠️ WARNING ───────────────┤ $2.25
        │     Prefer cheaper models      │
        │     (Haiku over Sonnet)         │
        │                                │
  $2.25 ├──── 🔻 REDUCE ───────────────┤ $2.38
        │     Essential operations only  │
        │     (see list below)           │
        │                                │
  $2.38 ├──── ⏸️ PAUSE ────────────────┤ $2.50
        │     Only direct commands       │
        │     P1 alert sent to you       │
        │                                │
  $2.50 └──── 🛑 STOPPED ───────────────
              No AI until tomorrow
              P0 alert sent to you

  (based on $2.50/day "balanced" profile)
```

### What Counts as "Essential" (Explicit List)

During REDUCE mode, only these operations are allowed:

| ✅ Essential                       | ❌ Not Essential             |
| ---------------------------------- | ---------------------------- |
| Responding to your direct commands | Morning/evening briefings    |
| Health checks                      | Autonomous task execution    |
| Security event processing          | Proactive research           |
| Audit logging                      | Routine notifications        |
| P0/P1 alert delivery               | Scheduled non-critical tasks |

This list is intentionally short and **does not expand** over time.

---

## 🔧 8. Safe Mode

If a critical subsystem is broken on startup, ARI degrades instead of crashing:

| 💥 What's Broken               | 🛡️ Safe Mode Behavior                                            |
| ------------------------------ | ---------------------------------------------------------------- |
| Audit chain fails verification | No tool execution. Log-only mode. P0 alert.                      |
| PolicyEngine won't start       | Read-only mode. No writes/executes. P0 alert.                    |
| Budget state corrupted         | Conservative mode ($1/day). P1 alert.                            |
| Keychain key unavailable       | Ephemeral key (checkpoints won't survive next restart). Warning. |
| Telegram unavailable           | Start normally. Alerts go to local logs only.                    |

**Principle**: If a safety system is broken, restrict capabilities — don't disable safety.

---

## 📊 What the Audit Found vs Reality

The ChatGPT audit was useful but assumed several things were missing that already existed:

| 🔍 Audit Said               | 🏗️ Reality                                                    |
| --------------------------- | ------------------------------------------------------------- |
| "No Policy Engine"          | ✅ 632-line PolicyEngine with full 3-layer checks             |
| "No risk scoring"           | ✅ Risk scoring: `Severity × Trust Multiplier`                |
| "No ToolCallTokens"         | ✅ HMAC-signed, single-use, time-bound, parameter-locked      |
| "Council is the authority"  | ✅ Council is advisory; PolicyEngine is the runtime authority |
| "Remove injection scanning" | ✅ Scanning AND capability control work together              |

### What Was Actually Missing

| Gap                           | Fix                                          | Status   |
| ----------------------------- | -------------------------------------------- | -------- |
| No checkpoint anchoring       | Added HMAC-SHA256 checkpoints to audit chain | ✅ Fixed |
| Signing key was ephemeral     | Persisted in macOS Keychain                  | ✅ Fixed |
| Docs out of date              | 9 docs created/rewritten                     | ✅ Fixed |
| Wrong council members in docs | Updated to current 15-member roster          | ✅ Fixed |
| No essential operations list  | Explicit list in budget spec                 | ✅ Fixed |
| No safe mode                  | Safe mode boot path in runbook               | ✅ Fixed |
| No compromise scenarios       | "What holds under attack?" table             | ✅ Fixed |
| No DNS/IP change handling     | Documented TLS + API key defense             | ✅ Fixed |
| Allowlist enforcement unclear | Documented: hardcoded constants, not config  | ✅ Fixed |
| No gateway authentication     | Keychain-backed API key on all endpoints     | ✅ Fixed |
| LaunchAgent plist broken      | Fixed placeholder substitution + PATH        | ✅ Fixed |

---

## 📁 All Files Changed

### Round 1 (Audit Response)

| File                                  | What                          |
| ------------------------------------- | ----------------------------- |
| `src/kernel/audit.ts`                 | Checkpoint anchoring system   |
| `tests/unit/kernel/audit.test.ts`     | 3 checkpoint tests            |
| `docs/security/NETWORK_POLICY.md`     | Inbound vs outbound           |
| `docs/security/THREAT_MODEL.md`       | OWASP LLM Top 10 mapping      |
| `docs/security/AUDIT_SECURITY.md`     | Audit trail mechanics         |
| `docs/governance/GOVERNANCE.md`       | Correct council, role clarity |
| `docs/governance/POLICY_ENGINE.md`    | Permission system docs        |
| `docs/operations/BUDGET_SPEC.md`      | Spending and degradation      |
| `docs/operations/RECOVERY_RUNBOOK.md` | Failure recovery              |

### Round 2 (Review Feedback)

| File                                  | What                                                        |
| ------------------------------------- | ----------------------------------------------------------- |
| `src/kernel/audit.ts`                 | Keychain-persisted signing key                              |
| `tests/unit/kernel/audit.test.ts`     | 5 more tests (key persistence, cross-instance verification) |
| `docs/security/NETWORK_POLICY.md`     | Enforcement locations, DNS handling                         |
| `docs/security/AUDIT_SECURITY.md`     | Keychain persistence, compromise scenarios                  |
| `docs/operations/BUDGET_SPEC.md`      | Essential operations list                                   |
| `docs/operations/RECOVERY_RUNBOOK.md` | Safe mode boot path                                         |

### Round 3 (Authentication Gap)

| File                                  | What                                                     |
| ------------------------------------- | -------------------------------------------------------- |
| `src/kernel/gateway.ts`               | API key auth (Keychain-backed, preHandler hook)          |
| `src/kernel/types.ts`                 | Added `auth_missing`, `auth_failed` security event types |
| `src/cli/commands/budget.ts`          | X-ARI-Key header on all gateway fetch calls              |
| `src/cli/commands/doctor.ts`          | X-ARI-Key header on /status check                        |
| `src/cli/commands/gateway.ts`         | Log API key auth status on startup                       |
| `tests/unit/kernel/gateway.test.ts`   | 7 new auth tests + updated all existing tests            |
| `scripts/macos/install.sh`            | Fixed LaunchAgent plist placeholder substitution         |
| `scripts/macos/com.ari.gateway.plist` | Added /opt/homebrew/bin to PATH for Apple Silicon        |

### Verification

- **Tests**: 4002/4002 passing
- **TypeScript**: Compiles clean
- **No breaking changes**: Fully backward compatible

---

## 🗺️ Quick Reference: Where To Find Things

| I Want To Understand...           | Read This                             |
| --------------------------------- | ------------------------------------- |
| How the network works             | `docs/security/NETWORK_POLICY.md`     |
| How permissions work              | `docs/governance/POLICY_ENGINE.md`    |
| How the audit trail works         | `docs/security/AUDIT_SECURITY.md`     |
| How governance works              | `docs/governance/GOVERNANCE.md`       |
| What threats ARI defends against  | `docs/security/THREAT_MODEL.md`       |
| How spending is managed           | `docs/operations/BUDGET_SPEC.md`      |
| How to fix things when they break | `docs/operations/RECOVERY_RUNBOOK.md` |

---

v3.0 - 2026-02-13
