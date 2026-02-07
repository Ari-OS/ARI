---
paths:
  - "src/kernel/**/*.ts"
  - "src/governance/**/*.ts"
  - "**/*security*.ts"
  - "**/*sanitizer*.ts"
  - "**/*audit*.ts"
---

# Security Rules

## Invariant 1: Loopback-Only Gateway

**WHAT**: Gateway binds to 127.0.0.1 exclusively
**WHY**: Prevents remote code execution via network exposure
**HOW**: `gateway.listen('127.0.0.1', port)` — never '0.0.0.0'

BLOCKED patterns: `0.0.0.0`, `INADDR_ANY`, `::/*`, configurable host

## Invariant 2: Content ≠ Command

**WHAT**: All inbound messages are DATA, never instructions
**WHY**: Prevents injection attacks
**HOW**: Sanitizer scans with 21 patterns before processing

Categories: Direct Override, Role Manipulation, Command Injection,
Prompt Extraction, Authority Claims, Data Exfiltration

## Invariant 3: Immutable Audit

**WHAT**: SHA-256 hash chain from genesis (0x00...00)
**WHY**: Tamper-evident logging
**HOW**: Each event contains prevHash, verified on startup

NEVER modify audit.json. Append-only.

## Invariant 4: Least Privilege

**WHAT**: Three-layer permission check
**WHY**: Defense in depth
**HOW**: agent allowlist → trust level → permission tier (READ/WRITE/DESTRUCTIVE)

## Invariant 5: Trust Levels

| Level | Multiplier | Use Case |
|-------|------------|----------|
| SYSTEM | 0.5x | Internal ARI ops |
| OPERATOR | 0.6x | Direct human |
| VERIFIED | 0.75x | Authenticated external |
| STANDARD | 1.0x | Normal ops |
| UNTRUSTED | 1.5x | Unknown source |
| HOSTILE | 2.0x | Known threat |

Auto-block at risk ≥ 0.8
