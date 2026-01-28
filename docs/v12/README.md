# ARI V12.0 — Universal Life Operating System

> **Status: SPECIFICATION (Pre-Implementation Design)**
>
> This directory contains the original v12 architecture specifications written before the production overhaul.
> For the current implementation status, see the root [README.md](../../README.md) and [OVERHAUL_LOG.md](../OVERHAUL_LOG.md).
> The implemented system has 187 tests (exceeding the 70 specified here) and covers all layers documented below.

> **Aurora Protocol Release**
> Constitutional Multi-Agent OS with Security Hardening

[![Version](https://img.shields.io/badge/version-12.0.0-blue.svg)]()
[![Security](https://img.shields.io/badge/security-hardened-green.svg)]()
[![Tests](https://img.shields.io/badge/tests-187%20implemented-brightgreen.svg)]()

---

## What is ARI?

ARI (Artificial Reasoning Intelligence) is a **constitutional multi-agent operating system** designed to serve as a personal Life OS. It coordinates 13 specialized agents to multiply your capabilities while maintaining strict security and governance boundaries.

### Key Features

- 🔒 **Security Hardened** — Prompt injection defense, memory poisoning protection, deny-by-default tools
- 🌐 **Universal Kernel** — Business-agnostic core, dynamic context loading
- 🏛️ **Governed** — Council voting, Arbiter oversight, formal decision-making
- 📝 **Auditable** — Tamper-evident logging, full provenance tracking
- 🔄 **Reversible** — Rollback support for all write operations

---

## Quick Start

### Prerequisites

- macOS (Mac Mini target deployment)
- Git
- Claude Project or Claude Code access
- Text editor (Cursor recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/PryceHedrick/ari.git
cd ari

# Checkout V12.0
git checkout v12.0-aurora-protocol

# Verify structure
ls -la
```

### Setup for Claude Project

1. **Create new Claude Project**
   - Go to claude.ai → Projects → New Project
   - Name: "ARI V12.0"

2. **Upload Knowledge Base**
   Upload these files to the project knowledge:
   ```
   SYSTEM/CORE.md          (Primary system prompt)
   SYSTEM/ROUTER.md        (Request routing)
   SYSTEM/PLANNER.md       (Plan generation)
   SYSTEM/EXECUTOR.md      (Tool execution)
   SYSTEM/MEMORY_MANAGER.md (Memory operations)
   SYSTEM/GUARDIAN.md      (Security)
   GOVERNANCE/ARBITER.md   (Final authority)
   GOVERNANCE/OVERSEER.md  (Quality control)
   GOVERNANCE/GOVERNANCE.md (Voting rules)
   CONFIG/tool_registry.json (Tool permissions)
   ```

3. **Add Context Packs (as needed)**
   ```
   CONTEXTS/ventures/pryceless_solutions.md  (If working on that venture)
   CONTEXTS/life/career.md                   (For career discussions)
   CONTEXTS/life/finance.md                  (For financial discussions)
   # etc.
   ```

4. **Verify Activation**
   Start a conversation. You should see:
   ```
   🖤 ARI v12.0 SECURE ACTIVE
   
   System: Constitutional Multi-Agent OS (Aurora Protocol)
   Governance: ✓ Arbiter, Overseer active
   Security: ✓ Trust boundaries enforced
   ...
   ```

---

## Directory Structure

```
ari-v12/
├── SYSTEM/                    # Core system prompts
│   ├── CORE.md               # Kernel identity (universal)
│   ├── ROUTER.md             # Request classification
│   ├── PLANNER.md            # Plan generation
│   ├── EXECUTOR.md           # Tool execution
│   ├── MEMORY_MANAGER.md     # Memory operations
│   └── GUARDIAN.md           # Security enforcement
│
├── GOVERNANCE/               # Governance layer
│   ├── ARBITER.md            # Final authority
│   ├── OVERSEER.md           # Quality control
│   └── GOVERNANCE.md         # Voting rules
│
├── CONTEXTS/                 # Dynamic context packs
│   ├── ventures/             # Business contexts
│   │   └── pryceless_solutions.md
│   ├── life/                 # Life domain contexts
│   │   ├── career.md
│   │   ├── finance.md
│   │   ├── health.md
│   │   ├── admin.md
│   │   ├── learning.md
│   │   ├── systems.md
│   │   └── family.md
│   └── README.md
│
├── CONFIG/                   # Configuration
│   └── tool_registry.json    # Tool permissions
│
├── SCHEMAS/                  # JSON schemas
│   ├── memory_entry.json     # Memory entry format
│   └── event.json            # Audit event format
│
├── TESTS/                    # Test suites
│   └── TEST_SUITE.md         # All test definitions
│
├── DOCS/                     # Documentation
│   └── (additional docs)
│
├── CHANGELOG.md              # Version history
├── DECISIONS.md              # Architecture decisions
└── README.md                 # This file
```

---

## Usage

### Basic Interaction

Just talk to ARI naturally:

```
You: Help me plan my week
ARI: [Loads admin context, creates plan]

You: Let's work on Pryceless Solutions
ARI: [Loads venture context, switches to business mode]

You: What's the status of my certification study?
ARI: [Loads career/learning context, provides update]
```

### Context Loading

ARI automatically loads relevant contexts based on your intent:

| You mention... | Context loaded |
|----------------|----------------|
| "Pryceless Solutions", "web client" | `ventures/pryceless_solutions.md` |
| "budget", "expenses", "savings" | `life/finance.md` |
| "study", "certification", "Security+" | `life/learning.md` + `life/career.md` |
| "schedule", "tasks", "appointment" | `life/admin.md` |

### Permission Tiers

| Tier | What it allows | Approval needed |
|------|----------------|-----------------|
| READ_ONLY | Information retrieval | None |
| WRITE_SAFE | Create new content | Auto-logged |
| WRITE_DESTRUCTIVE | Modify/delete | Operator approval |
| ADMIN | System changes | Council vote + Operator |

---

## Security Features

### Prompt Injection Defense

ARI treats all external content as **UNTRUSTED DATA**:

- ❌ Cannot follow instructions embedded in web results
- ❌ Cannot execute commands from file contents
- ❌ Cannot modify behavior based on external "system" messages
- ✅ Extracts facts and data only
- ✅ Logs all injection attempts

### Memory Protection

- All memory writes have provenance tracking
- External sources quarantined by default
- Partition isolation between contexts
- Decay and expiry policies
- Full rollback capability

### Tool Security

- Deny-by-default registry
- Blocked dangerous tool chains
- Verify-before-commit protocol
- Rate limiting
- Comprehensive audit logging

---

## Governance

### Council Voting

Major decisions require Council approval:

- **Standard** (5/9 majority): Routine changes
- **Significant** (7/9 majority): New capabilities
- **Critical** (9/9 unanimous): Security changes, releases

### Decision Flow

```
Proposal → Discussion → Vote → Arbiter Certification → Implementation
```

### Emergency Stop

Any agent can invoke emergency stop for security issues. Resumes only with Arbiter + Operator approval.

---

## Testing

### Run Test Suite

```bash
# Conceptual - tests are defined in TEST_SUITE.md
# Execute manually or via automated harness

# Categories:
# - 20 Prompt Injection tests
# - 15 Memory Poisoning tests  
# - 15 Tool Misuse tests
# - 20 Regression tests
# Total: 70 tests
```

### Expected Results

All 70 tests must pass for release certification.

---

## Your Stack Integration

### Recommended Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Perplexity │────▶│    Claude   │────▶│   Cursor    │
│  (Research) │     │  (Planning) │     │   (Code)    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Claude Code │
                    │ (Execution) │
                    └─────────────┘
```

| Tool | Best For |
|------|----------|
| **Perplexity** | Research, current info, citations |
| **Claude (Projects)** | Planning, architecture, documentation |
| **Cursor** | Code editing, file management |
| **Claude Code** | Multi-file changes, execution |

---

## Updating ARI

### Adding a New Venture

1. Create `/CONTEXTS/ventures/new_venture.md`
2. Follow template in CONTEXTS/README.md
3. Add trigger patterns to ROUTER.md (if needed)
4. Test context loading

### Adding a New Life Domain

1. Create `/CONTEXTS/life/new_domain.md`
2. Define scope and boundaries
3. Add trigger patterns
4. Test isolation

### Modifying Core Behavior

Requires full governance process:
1. Submit proposal
2. Council review (unanimous for core changes)
3. Arbiter sign-off
4. Implementation
5. Full test suite
6. Overseer certification

---

## Troubleshooting

### ARI Not Loading Context

- Check trigger patterns in ROUTER.md
- Verify context file exists
- Check for typos in venture/domain name

### Permission Denied

- Check tool_registry.json for tool allowlist
- Verify permission tier matches action
- Request operator approval if needed

### Memory Write Failed

- Check source trust level
- Look for quarantine requirement
- Verify partition access

---

## Contributing

ARI is a personal system, but the architecture can be adapted:

1. Fork the repository
2. Modify for your needs
3. Maintain the security model
4. Test thoroughly

---

## Version History

| Version | Name | Date | Notes |
|---------|------|------|-------|
| 12.0.0 | Aurora Protocol | 2026-01-26 | Universal kernel, security hardening |
| 11.1.0 | Rose Protocol Secure | 2026-01-25 | Initial security hardening |
| 11.0.0 | Rose Protocol | 2026-01-20 | Multi-agent architecture |

---

## License

Private repository. All rights reserved.

---

## Contact

**Operator:** Pryce Hedrick  
**Repository:** github.com/PryceHedrick/ari

---

*ARI V12.0 — Aurora Protocol*  
*"Multiply your capabilities while maintaining safety"*
