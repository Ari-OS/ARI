# Governance Framework

## Overview

This document outlines the governance framework for ARI vNext, designed
to support future multi-agent council-based decision making.

## Phase 1: Single Operator

In Phase 1, ARI operates under a single-operator model:

- The operator has full control over configuration
- All messages are processed through the same pipeline
- Trust levels are recorded but do not affect processing
- The audit log provides accountability

## Future: Council Framework

The governance model is designed to evolve toward a council-based
structure where multiple agents contribute to decisions.

### Principles

1. **Transparency**: All decisions and their reasoning are recorded
2. **Accountability**: Every action is attributed to a specific actor
3. **Verifiability**: The audit trail enables independent verification
4. **Least Authority**: Each agent operates with minimum necessary permissions

### Actor Types

| Actor Type | Description | Phase |
|------------|-------------|-------|
| system | Internal system processes | 1 |
| operator | Human operator | 1 |
| sender | External message source | 1 |
| service | Internal service component | 1 |
| agent | Autonomous AI agent | Future |
| council | Multi-agent consensus | Future |

### Decision Levels

Future governance will support tiered decision making:

- **Autonomous**: Agent can decide independently (low risk)
- **Advisory**: Agent suggests, operator decides (medium risk)
- **Council**: Multiple agents deliberate, operator ratifies (high risk)
- **Operator-only**: Only the human operator can decide (critical)

### Audit Requirements

All governance decisions must be:
- Recorded in the hash-chained audit log
- Attributed to the deciding actor(s)
- Accompanied by reasoning (in the details field)
- Verifiable after the fact

## Context System

The `CONTEXTS/` directory provides namespace isolation for different
domains:

```
CONTEXTS/
  ventures/    # Business and professional contexts
  life/        # Personal and life management contexts
```

Each context namespace will support:
- Independent agent configurations
- Scoped memory and knowledge bases
- Separate audit trails (future)
- Context-specific governance rules

## Contributing to Governance

Governance decisions about the framework itself should be:
- Discussed in GitHub Issues
- Documented in pull requests
- Recorded in this document

The governance framework will evolve as the system matures through
subsequent phases.
