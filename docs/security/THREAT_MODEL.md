# ARI Threat Model

Security analysis using STRIDE and OWASP LLM Top 10 frameworks.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     THREAT SURFACE                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   External Input (loopback only)                                 │
│        │                                                         │
│        ▼                                                         │
│   ┌──────────────────┐                                           │
│   │    GATEWAY        │ ◄── Loopback only (127.0.0.1)            │
│   │   (Fastify)       │     Rate limiting (100/min)              │
│   └────────┬─────────┘                                           │
│            │                                                     │
│            ▼                                                     │
│   ┌──────────────────┐                                           │
│   │   SANITIZER       │ ◄── 39 injection patterns                │
│   │   (Detection)     │     14 attack categories                 │
│   └────────┬─────────┘                                           │
│            │                                                     │
│            ▼                                                     │
│   ┌──────────────────┐                                           │
│   │   AUDIT LOG       │ ◄── SHA-256 hash chain                   │
│   │   (Integrity)     │     HMAC-signed checkpoints              │
│   └────────┬─────────┘                                           │
│            │                                                     │
│            ▼                                                     │
│   ┌──────────────────┐                                           │
│   │  POLICY ENGINE    │ ◄── 3-layer permission check             │
│   │  (Authorization)  │     Risk scoring + auto-block            │
│   └────────┬─────────┘                                           │
│            │                                                     │
│            ▼                                                     │
│   ┌──────────────────┐     ┌──────────────────┐                  │
│   │     AGENTS        │────►│   INTEGRATIONS   │──► Outbound     │
│   │   (Processing)    │     │  (Telegram, AI)  │    HTTPS only   │
│   └──────────────────┘     └──────────────────┘                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## OWASP LLM Top 10 Mapping

How ARI addresses each risk from the OWASP Top 10 for LLM Applications.

### LLM01: Prompt Injection

| | |
|---|---|
| **Risk** | Attacker crafts input to override LLM instructions |
| **ARI Mitigations** | |
| | 1. **Sanitizer** scans all input with 39 regex patterns across 14 categories |
| | 2. **Content != Command** rule: external input is DATA, never instructions |
| | 3. **Trust levels** multiply risk scores (untrusted = 1.5x, hostile = 2.0x) |
| | 4. **Auto-block** at risk score >= 0.8 |
| **Where enforced** | `src/kernel/sanitizer.ts`, `src/kernel/gateway.ts:104-145` |
| **Residual risk** | Low — defense in depth with pattern matching + trust scoring |

### LLM02: Insecure Output Handling

| | |
|---|---|
| **Risk** | LLM output used unsafely (XSS, command injection) |
| **ARI Mitigations** | |
| | 1. LLM outputs go through **structured Zod validation** before use |
| | 2. Tool execution requires **ToolCallToken** (signed, single-use, parameter-bound) |
| | 3. Dashboard uses React with automatic XSS escaping |
| | 4. No dynamic code execution from LLM output |
| **Where enforced** | `src/governance/policy-engine.ts`, Zod schemas in `src/kernel/types.ts` |
| **Residual risk** | Very Low — outputs are validated, not executed directly |

### LLM03: Training Data Poisoning

| | |
|---|---|
| **Risk** | Corrupted training data affects model behavior |
| **ARI Mitigations** | |
| | 1. ARI uses **commercial API models** (Claude, GPT, Grok) — no custom training |
| | 2. Memory entries have **provenance tracking** (source, trust level, agent chain) |
| | 3. Memories from untrusted sources are **quarantined** |
| | 4. Memory has confidence scores and verification status |
| **Where enforced** | `src/kernel/types.ts:MemoryEntrySchema`, `src/agents/memory-manager.ts` |
| **Residual risk** | Very Low — no custom training, memories are provenance-tracked |

### LLM04: Model Denial of Service

| | |
|---|---|
| **Risk** | Crafted prompts cause excessive resource consumption |
| **ARI Mitigations** | |
| | 1. **Token budget tracking** with daily/monthly limits |
| | 2. **Cost-based governance** — requests above $0.005 require council approval |
| | 3. **Throttle levels**: normal -> warning -> reduce -> pause |
| | 4. **Rate limiting** at gateway (100 req/min) |
| | 5. OPAL (resource_manager) can **veto** resource-depleting requests |
| **Where enforced** | `src/observability/cost-tracker.ts`, `src/ai/ai-policy-governor.ts` |
| **Residual risk** | Low — budget system prevents runaway costs |

### LLM05: Supply Chain Vulnerabilities

| | |
|---|---|
| **Risk** | Compromised dependencies or model providers |
| **ARI Mitigations** | |
| | 1. `package-lock.json` pinned and committed |
| | 2. Minimal dependency footprint (core: Fastify, Zod, Pino) |
| | 3. Pre-commit hooks block sensitive file commits |
| | 4. AI providers authenticated via per-provider API keys |
| | 5. No custom model hosting — uses established provider APIs |
| **Where enforced** | `package-lock.json`, `.claude/settings.json` hooks |
| **Residual risk** | Medium — depends on npm ecosystem and AI provider security |

### LLM06: Sensitive Information Disclosure

| | |
|---|---|
| **Risk** | LLM reveals private data in responses |
| **ARI Mitigations** | |
| | 1. **Memory partitioning**: PUBLIC, INTERNAL, SENSITIVE |
| | 2. **Agent access control**: memories have `allowed_agents` lists |
| | 3. Gateway is **loopback-only** — no network exposure |
| | 4. PII scanning script (`scripts/scan-pii.sh`) for pre-commit checks |
| | 5. API keys stored in environment variables, never in code |
| **Where enforced** | `src/kernel/types.ts:MemoryPartitionSchema`, `scripts/scan-pii.sh` |
| **Residual risk** | Low — single-user system with no external access |

### LLM07: Insecure Plugin Design

| | |
|---|---|
| **Risk** | Plugins/tools with excessive permissions |
| **ARI Mitigations** | |
| | 1. **3-layer permission check**: agent allowlist -> trust level -> permission tier |
| | 2. **Tool policies** define allowed agents, required trust, and permission tier |
| | 3. **ToolCallTokens**: cryptographically signed, single-use, time-bound (5 min TTL) |
| | 4. **WRITE_DESTRUCTIVE** and **ADMIN** tiers require explicit approval |
| | 5. Auto-block at risk score >= 0.8 |
| **Where enforced** | `src/governance/policy-engine.ts`, `src/kernel/types.ts:ToolPolicySchema` |
| **Residual risk** | Very Low — defense in depth with signed tokens |

### LLM08: Excessive Agency

| | |
|---|---|
| **Risk** | LLM takes actions beyond intended scope |
| **ARI Mitigations** | |
| | 1. **Budget-gated autonomy**: spending above thresholds requires council vote |
| | 2. **Scheduled tasks only**: daemon runs pre-defined schedules, not free-form |
| | 3. **Constitutional rules** block destructive operations without approval |
| | 4. **Least privilege**: default action is DENY |
| | 5. AEGIS (guardian) can **veto** security-sensitive actions |
| **Where enforced** | `src/governance/arbiter.ts`, `src/ai/ai-policy-governor.ts` |
| **Residual risk** | Low — bounded by budget and governance |

### LLM09: Overreliance

| | |
|---|---|
| **Risk** | Treating LLM output as authoritative without verification |
| **ARI Mitigations** | |
| | 1. **Multi-model routing**: can compare outputs across providers |
| | 2. **Confidence scoring**: reasoning traces include confidence levels |
| | 3. **Council deliberation**: significant decisions get multi-agent review |
| | 4. **Human-in-the-loop**: P0/P1 alerts notify the operator |
| **Where enforced** | `src/ai/orchestrator.ts`, `src/governance/council.ts` |
| **Residual risk** | Medium — operator must engage with notifications |

### LLM10: Model Theft

| | |
|---|---|
| **Risk** | Unauthorized access to model weights or fine-tuning data |
| **ARI Mitigations** | |
| | 1. ARI uses **API-based models only** — no local model weights to steal |
| | 2. API keys stored in environment variables, not committed to repo |
| | 3. Gateway is loopback-only — no network exposure |
| **Where enforced** | Architecture decision (API-only, no local models) |
| **Residual risk** | Not Applicable — no local models to protect |

## STRIDE Analysis

### S - Spoofing

| Threat | Attacker impersonates trusted source |
|--------|--------------------------------------|
| **Risk Level** | Medium |
| **Attack Vector** | Inject messages claiming elevated trust |
| **Mitigations** | |
| | - All input starts as `untrusted` by default |
| | - Trust levels cannot be escalated via content |
| | - Trust is assigned by source, not declared by message |
| **Residual Risk** | Low - Trust is enforced at gateway level |

### T - Tampering

| Threat | Attacker modifies audit logs or system state |
|--------|----------------------------------------------|
| **Risk Level** | High (if successful) |
| **Attack Vector** | Direct file modification, chain replacement |
| **Mitigations** | |
| | - SHA-256 hash chain from genesis block |
| | - HMAC-signed checkpoints detect wholesale replacement |
| | - Chain verification on startup and periodically |
| | - Append-only log structure |
| | - Tamper detection triggers P0 alert |
| **Residual Risk** | Very Low - Cryptographically tamper-evident + checkpointed |

### R - Repudiation

| Threat | User denies performing action |
|--------|-------------------------------|
| **Risk Level** | Low |
| **Attack Vector** | Claim an action was not performed |
| **Mitigations** | |
| | - All actions logged to immutable audit chain |
| | - Timestamps and source recorded |
| | - Hash chain prevents modification after the fact |
| | - Checkpoints provide external proof of chain state |
| **Residual Risk** | None - Complete audit trail with checkpoints |

### I - Information Disclosure

| Threat | Unauthorized data access |
|--------|--------------------------|
| **Risk Level** | Medium |
| **Attack Vector** | Network interception, file access |
| **Mitigations** | |
| | - Gateway binds only to 127.0.0.1 (inbound loopback) |
| | - Outbound connections use HTTPS only (see `NETWORK_POLICY.md`) |
| | - Sensitive data stored locally only |
| | - Memory partitioning (PUBLIC/INTERNAL/SENSITIVE) |
| **Residual Risk** | Very Low - No inbound network exposure |

### D - Denial of Service

| Threat | Overload system to prevent operation |
|--------|--------------------------------------|
| **Risk Level** | Medium |
| **Attack Vector** | Message flooding, resource exhaustion, API cost drain |
| **Mitigations** | |
| | - Rate limiting (100 requests/minute) |
| | - Local-only access limits attack surface |
| | - Budget tracking with throttle levels |
| | - OPAL veto on resource depletion |
| **Residual Risk** | Low - Rate limiting + budget controls effective |

### E - Elevation of Privilege

| Threat | Gain unauthorized permissions |
|--------|-------------------------------|
| **Risk Level** | High (if successful) |
| **Attack Vector** | Prompt injection, trust escalation, token forgery |
| **Mitigations** | |
| | - Three-layer permission checks (PolicyEngine) |
| | - Content is never treated as command |
| | - Trust escalation requires explicit approval |
| | - Auto-block at risk >= 0.8 |
| | - ToolCallTokens are HMAC-signed and single-use |
| **Residual Risk** | Low - Defense in depth with cryptographic tokens |

## Governance Triggers

Mechanical thresholds that trigger specific governance actions. These are deterministic, not advisory.

| Trigger | Threshold | Action | Enforced By |
|---------|-----------|--------|-------------|
| Injection detected | risk >= 0.8 | Block + P1 alert | Sanitizer |
| Budget warning | spend >= 80% daily | Throttle to reduced mode | CostTracker |
| Budget pause | spend >= 95% daily | Pause autonomous operations | CostTracker |
| High-cost AI call | cost >= $0.005 | Require council vote | AIPolicyGovernor |
| Expensive AI call | cost >= $0.25 | Full council deliberation | AIPolicyGovernor |
| Destructive operation | tier = WRITE_DESTRUCTIVE | Require operator approval | PolicyEngine |
| Admin operation | tier = ADMIN | Require council + operator | PolicyEngine |
| Audit chain broken | verify() fails | P0 alert + halt | AuditLogger |
| Checkpoint mismatch | verifyCheckpoints() fails | P0 alert + halt | AuditLogger |
| Emergency budget | spend >= 50% of monthly | MINT + OPAL + SCOUT unanimous vote | AIPolicyGovernor |
| Rate limit exceeded | > 100 req/min | 429 response + security alert | Gateway |
| Constitutional violation | any rule breached | Immediate block | Arbiter |

## Risk Scoring

**Formula**: `Risk Score = Base Severity x Trust Multiplier`

Where:
- **Base Severity** is determined by the permission tier of the operation
- **Trust Multiplier** is determined by the trust level of the request source

| Permission Tier | Base Severity | Example |
|----------------|---------------|---------|
| READ_ONLY | 0.1 | Query memory, check status |
| WRITE_SAFE | 0.3 | Create memory, log event |
| WRITE_DESTRUCTIVE | 0.6 | Delete data, modify config |
| ADMIN | 0.9 | System reconfiguration |

| Trust Level | Multiplier | Example Source |
|-------------|------------|----------------|
| system | 0.5x | Internal ARI operations |
| operator | 0.6x | Direct user commands (Pryce) |
| verified | 0.75x | Authenticated external APIs |
| standard | 1.0x | Normal operations |
| untrusted | 1.5x | Unknown or unverified sources |
| hostile | 2.0x | Known attack vectors |

**Examples**:
- Operator reads memory: `0.1 x 0.6 = 0.06` (allowed)
- Untrusted writes data: `0.3 x 1.5 = 0.45` (allowed, logged)
- Untrusted destructive op: `0.6 x 1.5 = 0.90` (BLOCKED, >= 0.8)
- Hostile admin request: `0.9 x 2.0 = 1.80` (capped at 1.0, BLOCKED)

**Implementation**: `src/governance/policy-engine.ts:289-293`

## Injection Patterns (39 Patterns, 14 Categories)

Implemented in `src/kernel/sanitizer.ts`:

| Category | Count | Severity | Examples |
|----------|-------|----------|----------|
| Direct Override | 3 | Critical | `ignore previous`, `disregard prior`, `forget previous` |
| Role Manipulation | 4 | High | `you are now`, `act as`, `pretend to be`, `new identity` |
| Command Injection | 4 | Critical | `$(...)`, backticks, `;rm`, pipe to shell |
| Prompt Extraction | 3 | Medium | `reveal prompt`, `show instructions`, `what are your rules` |
| Authority Claims | 3 | High | `as your creator`, `I have admin`, `override authority` |
| Data Exfiltration | 4 | High-Critical | `send data to`, `forward all to`, `upload`, `exfiltrate` |
| SSRF | 2 | Critical | `file://`, `gopher://` |
| Path Traversal | 2 | High | URL-encoded `../`, directory traversal |
| Null Byte | 1 | High | `%00`, `\x00` |
| XML Injection | 1 | High | `CDATA`, `ENTITY`, `DOCTYPE SYSTEM` |
| Jailbreak | 3 | Critical | `DAN mode`, `developer mode enabled`, `jailbreak` |
| Tag/Script Injection | 4 | High-Critical | `<script>`, `<system>`, `javascript:` protocol |
| SQL Injection | 4 | Medium-Critical | `' OR 1=1`, `; DROP TABLE`, `UNION SELECT` |

## Security Controls Summary

| Control | Implementation | Status |
|---------|----------------|--------|
| Inbound loopback-only | Gateway binds to 127.0.0.1 | Active |
| Outbound HTTPS-only | Allowlisted services only | Active |
| Hash chain audit | SHA-256 from genesis | Active |
| Checkpoint anchoring | HMAC-signed chain snapshots | Active |
| Content sanitization | 39 patterns, 14 categories | Active |
| Rate limiting | 100 req/min token bucket | Active |
| Trust levels | 6 levels with risk multipliers | Active |
| Auto-block | Risk >= 0.8 | Active |
| Permission checks | 3-layer (agent, trust, tier) | Active |
| ToolCallTokens | HMAC-signed, single-use, 5-min TTL | Active |
| Budget governance | Cost-based council voting | Active |
| Constitutional enforcement | 6 immutable rules via Arbiter | Active |

## Monitoring and Alerting

| Event | Priority | Action |
|-------|----------|--------|
| Injection detected | P1 | Block, log, Telegram alert |
| Audit chain invalid | P0 | Halt, log, SMS + Telegram |
| Checkpoint mismatch | P0 | Halt, log, SMS + Telegram |
| Rate limit exceeded | P2 | Throttle, log |
| Trust violation | P1 | Block, log, Telegram alert |
| Budget warning (80%) | P2 | Throttle, log, Telegram (silent) |
| Budget pause (95%) | P1 | Pause autonomy, Telegram alert |
| Constitutional violation | P0 | Block, log, all channels |
| Permission denied | P3 | Log to Notion |
| High-cost request vetoed | P2 | Log, Telegram (silent) |

## Related Documents

- **Network Policy**: `docs/security/NETWORK_POLICY.md`
- **Audit Security**: `docs/security/AUDIT_SECURITY.md`
- **Policy Engine**: `docs/governance/POLICY_ENGINE.md`
- **Governance**: `docs/governance/GOVERNANCE.md`
- **Constitution**: `docs/constitution/ARI-CONSTITUTION-v1.0.md`

---

v2.0 - 2026-02-10
