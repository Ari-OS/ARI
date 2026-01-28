# ARI Agent Design

> Architecture, responsibilities, and communication patterns for ARI's multi-agent system.

---

## Overview

ARI uses **8 specialized agents** organized into two categories:

**Core Agents (5)** — Handle message processing and execution
- Core, Guardian, Planner, Executor, Memory Manager

**Governance Agents (3)** — Enforce rules and quality
- Council, Arbiter, Overseer

All agents communicate via the **EventBus** — no direct function calls between agents.

---

## Design Principles

### 1. Single Responsibility

Each agent has one job. When scope creep threatens, spin off a new agent.

| Agent | Single Responsibility |
|-------|----------------------|
| Core | Orchestrate the message pipeline |
| Guardian | Detect threats |
| Planner | Decompose tasks |
| Executor | Run tools |
| Memory Manager | Store knowledge |
| Council | Vote on decisions |
| Arbiter | Enforce rules |
| Overseer | Check quality gates |

### 2. Event-Driven Communication

Agents never import each other. All communication flows through typed events:

```typescript
// Agent A emits
this.eventBus.emit('message:accepted', message);

// Agent B subscribes
this.eventBus.on('message:accepted', (message) => {
  // Handle message
});
```

This ensures:
- **Testability** — Mock the EventBus, test agents in isolation
- **Traceability** — All events can be logged
- **Decoupling** — Replace any agent without changing others

### 3. Constitutional Constraints

Every agent operates within bounds defined by the **5 Arbiter Rules**:

1. Loopback-Only — Cannot access external network
2. Content ≠ Command — Cannot execute untrusted instructions
3. Audit Immutable — Cannot modify history
4. Least Privilege — Must check permissions
5. Trust Required — Must verify trust levels

---

## Core Agents

### Core (Orchestrator)

**File:** `src/agents/core.ts`

**Purpose:** Central coordination and message processing pipeline.

**Responsibilities:**
- Start/stop all other agents
- Process messages through the 5-step pipeline
- Coordinate between agents
- Report system health status

**5-Step Pipeline:**
```
1. Guardian assess → Threat detection and risk scoring
2. Route → Emit to EventBus for context classification
3. Plan → Decompose message into tasks
4. Execute → Run tasks with permission gating
5. Audit → Log final processing result
```

**Key Methods:**
```typescript
async start(): Promise<void>           // Initialize all agents
async stop(reason: string): Promise<void>  // Graceful shutdown
getStatus(): SystemStatus               // Health check
async processMessage(msg: Message): Promise<ProcessResult>  // Main pipeline
```

**Events Emitted:**
- `agent:started` — When Core starts
- `agent:stopped` — When Core stops
- `message:accepted` — When message passes Guardian

---

### Guardian (Security)

**File:** `src/agents/guardian.ts`

**Purpose:** Real-time threat detection and anomaly monitoring.

**Responsibilities:**
- Detect injection patterns in content
- Score risk based on trust level
- Track behavioral baselines per source
- Enforce rate limits
- Alert on high-risk assessments

**Threat Assessment Logic:**
```typescript
risk_score = (injection_score * 0.5) + (anomaly_score * 0.3) + (trust_penalty * 0.2)

if (risk_score >= 0.8) → BLOCK
if (risk_score >= 0.6) → ESCALATE
```

**8 Injection Patterns:**
| Pattern | Weight | Example |
|---------|--------|---------|
| template_injection | 0.8 | `${...}` |
| eval_injection | 1.0 | `eval(` |
| exec_injection | 1.0 | `exec(` |
| prototype_pollution | 0.9 | `__proto__` |
| path_traversal | 0.7 | `../` |
| xss_attempt | 0.6 | `<script` |
| sql_injection | 0.8 | `union select` |
| command_injection | 1.0 | `; rm -rf` |

**Behavioral Baselines:**
Guardian tracks per-source:
- Message count
- Average message length
- Average time between messages
- Injection attempt history

Anomalies trigger when:
- Message length > 3x baseline
- Time interval < 10% of baseline
- 5+ injection attempts in 5 minutes

**Events Subscribed:**
- `message:accepted` — Analyze incoming messages

**Events Emitted:**
- `security:alert` — When threat detected or blocked

---

### Planner (Strategy)

**File:** `src/agents/planner.ts`

**Purpose:** Task decomposition and dependency management.

**Responsibilities:**
- Create execution plans
- Break down goals into tasks
- Build dependency DAGs (Directed Acyclic Graphs)
- Detect circular dependencies
- Track plan progress

**Data Structures:**
```typescript
interface Plan {
  id: string;
  name: string;
  description: string;
  tasks: Task[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created_at: Date;
  owner: string;
}

interface Task {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];  // Task IDs that must complete first
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigned_to?: string;
}
```

**Key Methods:**
```typescript
async createPlan(name, description, owner): Promise<string>
async addTask(planId, task): Promise<string>
getNextTasks(planId): Task[]  // Tasks with all dependencies met
async updateTaskStatus(planId, taskId, status): Promise<void>
```

**Circular Dependency Detection:**
```typescript
// Before adding dependency, check for cycles
if (this.wouldCreateCycle(taskId, dependencyId)) {
  throw new Error('Circular dependency detected');
}
```

---

### Executor (Action)

**File:** `src/agents/executor.ts`

**Purpose:** Tool execution with permission enforcement.

**Responsibilities:**
- Maintain tool registry
- Execute tool calls
- Enforce 3-layer permission checks
- Handle approval workflows for destructive operations
- Track execution results

**3-Layer Permission Check:**
```
Layer 1: Agent Allowlist → Is requesting agent allowed to use this tool?
Layer 2: Trust Level → Does source trust level meet tool requirement?
Layer 3: Permission Tier → Does operation match allowed tier?
```

**Permission Tiers:**
| Tier | Description | Approval |
|------|-------------|----------|
| READ_ONLY | Information retrieval | Auto |
| WRITE_SAFE | Create new content | Logged |
| WRITE_DESTRUCTIVE | Modify/delete | Operator approval |
| ADMIN | System changes | Council vote |

**Approval Workflow:**
```typescript
if (tool.permission_tier === 'WRITE_DESTRUCTIVE') {
  // Request operator approval
  const approvalId = await this.requestApproval(call);
  // Wait for approval (60s timeout)
  const approved = await this.waitForApproval(approvalId);
  if (!approved) return { success: false, error: 'Approval denied' };
}
```

**Built-in Tools:**
| Tool | Tier | Description |
|------|------|-------------|
| file_read | READ_ONLY | Read file contents |
| file_write | WRITE_SAFE | Write file contents |
| file_delete | WRITE_DESTRUCTIVE | Delete files |
| system_config | ADMIN | Modify system config |

**Note:** Current implementations are mocks — real file operations not yet implemented.

---

### Memory Manager (Knowledge)

**File:** `src/agents/memory-manager.ts`

**Purpose:** Provenance-tracked knowledge storage.

**Responsibilities:**
- Store memory entries with full provenance
- Partition isolation (Life, Ventures, System)
- Integrity verification via hashing
- Memory decay and expiration
- Retrieval with filtering

**Memory Structure:**
```typescript
interface MemoryEntry {
  id: string;
  content: string;
  type: 'fact' | 'decision' | 'preference' | 'task' | 'event' | 'meta';
  source: string;
  trust_level: TrustLevel;
  partition: 'life' | 'ventures' | 'system';
  tags: string[];
  created_at: Date;
  expires_at?: Date;
  provenance: ProvenanceChain;
  integrity_hash: string;
}

interface ProvenanceChain {
  origin: string;          // Original source
  transformations: string[];  // Processing steps
  verified: boolean;
}
```

**Integrity Verification:**
```typescript
// Hash includes content + source + provenance
const hash = sha256(JSON.stringify({
  content: entry.content,
  source: entry.source,
  provenance: entry.provenance,
}));
```

**Partition Isolation:**
- **Life** — Personal data (finance, health, career)
- **Ventures** — Business data (projects, clients)
- **System** — Agent state and configuration

Cross-partition access requires SYSTEM trust level.

---

## Governance Agents

### Council (Legislature)

**File:** `src/governance/council.ts`

**Purpose:** Collective decision-making through voting.

**Responsibilities:**
- Track 13 council members
- Manage vote lifecycle
- Enforce quorum thresholds
- Expire overdue votes (1-hour limit)

**Council Members (13):**
| Member | Role |
|--------|------|
| core | Orchestration representative |
| guardian | Security representative |
| planner | Strategy representative |
| executor | Action representative |
| memory_manager | Knowledge representative |
| arbiter | Constitutional authority |
| overseer | Quality authority |
| router | Routing representative |
| context_manager | Context representative |
| operator_proxy | Human operator voice |
| ethics_advisor | Ethical considerations |
| risk_assessor | Risk analysis |
| historian | Historical context |

**Quorum Thresholds:**
| Decision Type | Threshold | Required Votes |
|--------------|-----------|----------------|
| Standard | 50% | 7 of 13 |
| Significant | 67% | 9 of 13 |
| Critical | 100% | 13 of 13 |

**Vote Lifecycle:**
```
DRAFT → PENDING_REVIEW → VOTING → APPROVED/REJECTED/EXPIRED
```

**Key Methods:**
```typescript
createVote(subject, proposedBy, threshold): string
castVote(voteId, agentId, approve, reason?): boolean
getVoteResult(voteId): VoteResult
expireOverdueVotes(): void  // Called every 60 seconds
```

---

### Arbiter (Judiciary)

**File:** `src/governance/arbiter.ts`

**Purpose:** Constitutional enforcement and final authority.

**Responsibilities:**
- Validate proposals against 5 constitutional rules
- Sign off on releases
- Emergency stop authority
- Rule interpretation

**5 Constitutional Rules:**

**Rule 1: Loopback-Only Gateway**
```typescript
// gateway.ts - HOST is hardcoded constant
const HOST = '127.0.0.1' as const;  // Cannot be changed
```

**Rule 2: Content ≠ Command**
```typescript
// All input treated as data
const sanitized = sanitizer.scan(input);
if (sanitized.threats.length > 0) {
  // Block, don't execute
}
```

**Rule 3: Audit Immutable**
```typescript
// audit.ts - append-only with hash chain
private previousHash = GENESIS_HASH;

async log(event) {
  const hash = sha256(previousHash + JSON.stringify(event));
  this.chain.push({ ...event, hash });
  this.previousHash = hash;
  // No delete or modify methods exist
}
```

**Rule 4: Least Privilege**
```typescript
// Three-layer check before any tool execution
if (!agentAllowlist.includes(agent)) return false;
if (trustLevel < tool.requiredTrust) return false;
if (operation > tool.maxPermission) return false;
```

**Rule 5: Trust Required**
```typescript
// Every message has explicit trust level
interface Message {
  source: TrustLevel;  // SYSTEM | OPERATOR | VERIFIED | STANDARD | UNTRUSTED | HOSTILE
  // ...
}
```

---

### Overseer (Quality)

**File:** `src/governance/overseer.ts`

**Purpose:** Quality gate enforcement for releases.

**Responsibilities:**
- Check 5 quality gates before release
- Generate compliance reports
- Block releases that fail gates

**5 Quality Gates:**

| Gate | Requirement | Check |
|------|-------------|-------|
| Test Coverage | ≥80% overall, 100% security paths | `npm run test:coverage` |
| Audit Integrity | Hash chain verifies | `npx ari audit verify` |
| Security Scan | No critical vulnerabilities | `npm audit` |
| Build Clean | Zero TypeScript errors | `npm run build` |
| Documentation | ADRs and API docs current | Manual review |

**Gate Check Process:**
```typescript
async checkGates(): Promise<GateResult[]> {
  return [
    await this.checkTestCoverage(),
    await this.checkAuditIntegrity(),
    await this.checkSecurityScan(),
    await this.checkBuild(),
    await this.checkDocumentation(),
  ];
}

canRelease(): boolean {
  return this.gates.every(g => g.passed);
}
```

---

## Adding a New Agent

### 1. Define the Agent Class

```typescript
// src/agents/new-agent.ts
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';

export class NewAgent {
  private readonly auditLogger: AuditLogger;
  private readonly eventBus: EventBus;

  constructor(auditLogger: AuditLogger, eventBus: EventBus) {
    this.auditLogger = auditLogger;
    this.eventBus = eventBus;
  }

  start(): void {
    // Subscribe to relevant events
  }

  stop(): void {
    // Unsubscribe from events
  }
}
```

### 2. Register with Core

```typescript
// In core.ts or gateway initialization
const newAgent = new NewAgent(auditLogger, eventBus);
// Add to orchestrator config
```

### 3. Define Events

```typescript
// In kernel/types.ts - add to EventMap
export interface EventMap {
  // ... existing events
  'new_agent:action': { data: string };
  'new_agent:result': { success: boolean };
}
```

### 4. Add Tests

```typescript
// tests/unit/agents/new-agent.test.ts
describe('NewAgent', () => {
  it('should handle expected behavior', () => {
    // Test agent logic
  });
});
```

### 5. Update Documentation

- Add to this file (AGENT_DESIGN.md)
- Update CLAUDE.md agent list
- Add to README if user-facing

---

## Event Reference

### Message Events
| Event | Payload | Emitter | Subscribers |
|-------|---------|---------|-------------|
| `message:accepted` | `Message` | Core | Guardian, Router |
| `message:blocked` | `{ message_id, reason }` | Guardian | Core, Audit |

### Agent Events
| Event | Payload | Emitter | Subscribers |
|-------|---------|---------|-------------|
| `agent:started` | `{ agent, timestamp }` | Any agent | Audit |
| `agent:stopped` | `{ agent, reason }` | Any agent | Audit |

### Security Events
| Event | Payload | Emitter | Subscribers |
|-------|---------|---------|-------------|
| `security:alert` | `{ type, source, data }` | Guardian | Core, Audit |
| `security:threat_detected` | `{ risk_score, patterns }` | Guardian | Audit |

### Governance Events
| Event | Payload | Emitter | Subscribers |
|-------|---------|---------|-------------|
| `governance:vote_created` | `Vote` | Council | Audit |
| `governance:vote_cast` | `{ vote_id, agent, approve }` | Council | Audit |
| `governance:decision` | `{ vote_id, result }` | Council | Core, Audit |

### System Events
| Event | Payload | Emitter | Subscribers |
|-------|---------|---------|-------------|
| `system:halted` | `{ reason, by }` | StopTheLine | All agents |
| `system:resumed` | `{ by }` | StopTheLine | All agents |

---

## Testing Agents

### Unit Test Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../../src/agents/agent.js';

describe('Agent', () => {
  let agent: Agent;
  let mockEventBus: { emit: vi.Mock; on: vi.Mock };
  let mockAuditLogger: { log: vi.Mock };

  beforeEach(() => {
    mockEventBus = { emit: vi.fn(), on: vi.fn() };
    mockAuditLogger = { log: vi.fn() };
    agent = new Agent(mockAuditLogger, mockEventBus);
  });

  it('should emit events correctly', () => {
    agent.doSomething();
    expect(mockEventBus.emit).toHaveBeenCalledWith('agent:action', expect.any(Object));
  });
});
```

### Integration Test Pattern

```typescript
describe('Agent Integration', () => {
  it('should process through full pipeline', async () => {
    // Create real EventBus
    const eventBus = new EventBus();

    // Create agents with shared EventBus
    const guardian = new Guardian(auditLogger, eventBus);
    const core = new Core(auditLogger, eventBus, { guardian, ... });

    // Test full flow
    const result = await core.processMessage(testMessage);
    expect(result.blocked).toBe(false);
  });
});
```

---

*Last updated: 2026-01-28*
*Version: 2.0.0*
