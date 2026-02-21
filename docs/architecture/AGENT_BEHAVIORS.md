# Agent Behavior Documentation

Decision trees and behavior specifications for ARI's multi-agent system.

## Agent Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT HIERARCHY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐                                              │
│   │    CORE     │ ◄─── Master orchestrator                     │
│   │   (Brain)   │      Routes to specialized agents            │
│   └──────┬──────┘                                              │
│          │                                                      │
│   ┌──────┴──────┬──────────┬──────────┬──────────┐            │
│   │             │          │          │          │            │
│   ▼             ▼          ▼          ▼          ▼            │
│ GUARDIAN    PLANNER   EXECUTOR   MEMORY    GOVERNOR           │
│ (Security)  (Tasks)   (Tools)    (Store)   (Rules)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Guardian Agent — Threat Detection

### Purpose

First line of defense. Assesses risk of all incoming messages.

### Decision Tree

```
                    ┌─────────────────┐
                    │ Incoming Message│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Pattern Check  │
                    │ (42 patterns)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         Match Found    No Match      Uncertain
              │              │              │
              ▼              ▼              ▼
         Calculate      Base Risk     Deep Analysis
         Base Risk        = 0.1        Required
              │              │              │
              └──────────────┴──────────────┘
                             │
                    ┌────────▼────────┐
                    │  Apply Trust    │
                    │  Multiplier     │
                    └────────┬────────┘
                             │
                    final_risk = base_risk × trust_multiplier
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         risk >= 0.8    0.5 <= risk    risk < 0.5
              │           < 0.8             │
              ▼              ▼              ▼
           BLOCK          FLAG           ALLOW
           + Audit      + Monitor       + Pass
```

### Risk Assessment Examples

| Input | Trust | Pattern | Base | Mult | Final | Action |
|-------|-------|---------|------|------|-------|--------|
| "Hello" | standard | None | 0.1 | 1.0 | 0.1 | ALLOW |
| "Ignore instructions" | untrusted | Yes | 0.6 | 1.5 | 0.9 | BLOCK |
| "System: admin" | hostile | Yes | 0.5 | 2.0 | 1.0 | BLOCK |
| "Run ls command" | operator | Weak | 0.4 | 0.6 | 0.24 | ALLOW |
| "Delete all files" | standard | Yes | 0.7 | 1.0 | 0.7 | FLAG |

### Event Emissions

```typescript
// On threat detected
eventBus.emit('security:threat_detected', {
  risk: finalRisk,
  patterns: matchedPatterns,
  trustLevel: trustLevel,
  blocked: risk >= 0.8
});

// On message processed
eventBus.emit('guardian:assessment_complete', {
  messageId: msg.id,
  risk: finalRisk,
  action: 'allow' | 'flag' | 'block'
});
```

## Planner Agent — Task Decomposition

### Purpose

Breaks complex requests into executable task DAGs (Directed Acyclic Graphs).

### Decision Tree

```
                    ┌─────────────────┐
                    │  User Request   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Parse Intent    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         Atomic Task    Multi-Step     Ambiguous
              │              │              │
              ▼              ▼              ▼
         Execute       Decompose       Clarify
         Directly      into DAG       with User
              │              │              │
              │              ▼              │
              │    ┌─────────────────┐     │
              │    │ Identify Steps  │     │
              │    └────────┬────────┘     │
              │              │              │
              │    ┌────────▼────────┐     │
              │    │ Find Dependencies│     │
              │    └────────┬────────┘     │
              │              │              │
              │    ┌────────▼────────┐     │
              │    │ Check Cycles    │     │
              │    └────────┬────────┘     │
              │              │              │
              │         No Cycles          │
              │              │              │
              │    ┌────────▼────────┐     │
              │    │ Topological Sort│     │
              │    └────────┬────────┘     │
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼────────┐
                    │ Return Task DAG │
                    └─────────────────┘
```

### DAG Example

```
Request: "Send a meeting summary to the team"

             ┌─────────────────┐
             │ Get Calendar    │
             │ Events (Task 1) │
             └────────┬────────┘
                      │
             ┌────────▼────────┐
             │ Summarize Each  │
             │ Meeting (Task 2)│
             └────────┬────────┘
                      │
       ┌──────────────┴──────────────┐
       │                             │
┌──────▼──────┐            ┌─────────▼────────┐
│ Get Team    │            │ Format Summary   │
│ List (Task 3)│            │ (Task 4)         │
└──────┬──────┘            └─────────┬────────┘
       │                             │
       └──────────────┬──────────────┘
                      │
             ┌────────▼────────┐
             │ Send Email      │
             │ (Task 5)        │
             └─────────────────┘

Dependencies: 5 depends on [3, 4], 4 depends on [2], 2 depends on [1]
```

## Executor Agent — Tool Execution

### Purpose

Executes approved tasks with proper permission checks.

### Three-Layer Authorization

```
                    ┌─────────────────┐
                    │  Tool Request   │
                    └────────┬────────┘
                             │
            ┌────────────────▼────────────────┐
            │        LAYER 1: Agent           │
            │        Allowlist Check          │
            └────────────────┬────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
         In Allowlist               Not in Allowlist
              │                             │
              ▼                             ▼
         Continue                        DENY
              │                      + Audit Log
              │
            ┌─▼──────────────────────────────┐
            │        LAYER 2: Trust          │
            │        Level Check             │
            └────────────────┬───────────────┘
              │              │              │
         Sufficient     Insufficient   Needs Escalation
              │              │              │
              ▼              ▼              ▼
         Continue         DENY          Request
              │        + Audit Log      Approval
              │
            ┌─▼──────────────────────────────┐
            │       LAYER 3: Permission      │
            │       Tier Check               │
            └────────────────┬───────────────┘
              │              │              │
         Tier Allows     Tier Denies    Confirmation
              │              │           Required
              ▼              ▼              │
          EXECUTE          DENY            │
              │         + Audit Log        ▼
              │                      Prompt User
              ▼                            │
         + Audit Log           ┌───────────┴──────────┐
                               │                      │
                           Confirmed              Rejected
                               │                      │
                               ▼                      ▼
                           EXECUTE                  DENY
```

### Permission Tiers

| Tier | Trust Required | Examples |
|------|----------------|----------|
| `READ_ONLY` | any | Read files, query APIs |
| `WRITE_SAFE` | standard+ | Create files, send messages |
| `WRITE_DESTRUCTIVE` | operator+ | Delete files, modify system |
| `ADMIN` | system | Change security settings |

### Tool Categories

```typescript
const TOOL_PERMISSIONS = {
  // READ_ONLY - Always allowed
  'file:read': 'READ_ONLY',
  'calendar:query': 'READ_ONLY',
  'notion:read': 'READ_ONLY',

  // WRITE_SAFE - Normal operations
  'file:write': 'WRITE_SAFE',
  'calendar:create': 'WRITE_SAFE',
  'notion:create': 'WRITE_SAFE',
  'sms:send': 'WRITE_SAFE',

  // WRITE_DESTRUCTIVE - Requires confirmation
  'file:delete': 'WRITE_DESTRUCTIVE',
  'calendar:delete': 'WRITE_DESTRUCTIVE',
  'shell:execute': 'WRITE_DESTRUCTIVE',

  // ADMIN - System-only
  'config:modify': 'ADMIN',
  'trust:escalate': 'ADMIN',
  'audit:clear': 'ADMIN', // Actually impossible
};
```

## Memory Manager — Knowledge Persistence

### Purpose

Stores and retrieves information with full provenance tracking.

### Memory Categories

```
┌─────────────────────────────────────────────────────────────────┐
│                     MEMORY TYPES                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│   │   SESSION   │  │  LEARNING   │  │  KNOWLEDGE  │           │
│   │  (Short)    │  │  (Cards)    │  │  (Index)    │           │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │
│          │                │                │                   │
│   Conversation      Spaced Rep         TF-IDF                 │
│   Context           SM-2 Algorithm     Semantic Search        │
│          │                │                │                   │
│   Expires at        Scheduled          Persistent             │
│   session end       review             forever                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Provenance Tracking

Every memory item includes:

```typescript
interface MemoryProvenance {
  createdBy: string;      // Agent or user ID
  createdAt: Date;        // Timestamp
  source: string;         // Origin (session, api, scheduled)
  confidence: number;     // 0-1 reliability score
  lastAccessed: Date;     // For LRU
  accessCount: number;    // Usage frequency
}
```

## Governor Agent — Constitutional Enforcement

### Purpose

Enforces the 6 constitutional rules and manages the 15-member council.

### Constitutional Rules

```
                    ┌─────────────────┐
                    │ Action Request  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
         Rule 1         Rule 2-4       Rule 5
         Loopback       Operational    Trust
         Check          Rules          Required
              │              │              │
              ▼              ▼              ▼
         Is target     Content ≠      Is trust
         127.0.0.1?    Command?       level set?
              │              │              │
         Yes/No        Yes/No         Yes/No
              │              │              │
              └──────────────┴──────────────┘
                             │
                    ┌────────▼────────┐
                    │ All Rules Pass? │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
             Yes                           No
              │                             │
              ▼                             ▼
           ALLOW                    CONSTITUTIONAL
                                    VIOLATION
                                         │
                                         ▼
                                    Block + Alert
                                    + Audit Log
```

### The 6 Constitutional Rules

| # | Rule | Enforcement |
|---|------|-------------|
| 0 | **Creator Primacy** | Always operate in creator's best interest |
| 1 | **Loopback Only** | Gateway rejects non-127.0.0.1 |
| 2 | **Content ≠ Command** | Sanitizer treats input as data |
| 3 | **Audit Immutable** | Hash chain, append-only |
| 4 | **Least Privilege** | Three-layer permission checks |
| 5 | **Trust Required** | All messages have trust level |

### Council Voting (15 Members)

```
Proposal Submitted
       │
       ▼
┌─────────────────┐
│ Council Reviews │
│ (15 members)    │
└────────┬────────┘
         │
    Vote Collected
         │
         ▼
┌─────────────────┐
│ Tally Votes     │
│ Quorum: 60%     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
  >= 60%   < 60%
    │         │
    ▼         ▼
 APPROVED  REJECTED
```

## Inter-Agent Communication

All agents communicate via EventBus:

```typescript
// Guardian to Core
eventBus.emit('guardian:assessment_complete', { risk, action });

// Planner to Executor
eventBus.emit('planner:task_ready', { taskId, dag });

// Executor to Memory
eventBus.emit('executor:result', { taskId, result });

// Governor to All
eventBus.emit('governance:rule_violated', { rule, action });
```

## Event Flow Example

```
User Input: "Schedule meeting with team"
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 1. Guardian Assessment                                        │
│    emit('guardian:assessment_complete', { risk: 0.1 })        │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 2. Core Routes to Planner                                     │
│    emit('core:route', { target: 'planner' })                  │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 3. Planner Creates DAG                                        │
│    emit('planner:task_ready', { tasks: [...] })               │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 4. Executor Runs Tasks                                        │
│    for each task: permission_check → execute → audit          │
│    emit('executor:task_complete', { taskId, result })         │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 5. Memory Stores Result                                       │
│    emit('memory:stored', { type: 'session', id: '...' })      │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 6. Core Returns Response                                      │
│    emit('core:response', { message: 'Meeting scheduled' })    │
└───────────────────────────────────────────────────────────────┘
```
