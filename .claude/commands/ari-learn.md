---
name: ari-learn
description: ARI learns from the current session and updates its knowledge
---

# /ari-learn

Capture learnings from the current session and integrate them into ARI's knowledge base.

## What This Command Does

### 1. Session Analysis

- Extract key decisions made
- Identify patterns used
- Note problems solved
- Capture architectural choices

### 2. Knowledge Integration

- Update relevant skills with new patterns
- Add new examples to documentation
- Create new skills if needed
- Update CLAUDE.md with learnings

### 3. Memory Storage

- Store in ARI's memory system
- Tag with relevant domains
- Set appropriate trust level
- Track provenance

## Learning Categories

| Category | Example |
|----------|---------|
| **Patterns** | "This caching pattern improved performance by 40%" |
| **Gotchas** | "Vitest requires .js extensions in imports" |
| **Decisions** | "Chose EventBus over direct calls for testability" |
| **Fixes** | "Memory leak was caused by missing cleanup" |

## Output Format

```markdown
## Session Learning Report

### Key Decisions
1. Used property-based testing for sanitizer
2. Implemented circuit breaker for external calls

### Patterns Discovered
- Retry with exponential backoff pattern
- Event sourcing for audit trail

### Problems Solved
- Fixed race condition in multi-agent coordination
- Resolved memory leak in long-running daemon

### Skills Updated
- ari-error-recovery: Added circuit breaker pattern
- ari-testing-strategies: Added property-based testing

### Memory Entries Created
- Pattern: circuit_breaker (domain: systems)
- Fix: agent_race_condition (domain: development)
```

## Usage

Type `/ari-learn` at the end of a productive session.
