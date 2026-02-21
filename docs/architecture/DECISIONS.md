# Architecture Decision Records (ADRs)

Version 2.0.0 - Phase 2 Lock

All ADRs in this document are **LOCKED** as of Phase 2 completion. These decisions form the constitutional foundation of ARI Life OS and cannot be modified without explicit governance approval through the council voting process.

---

## ADR-001: In-Process Agent Execution

**Status**: LOCKED

**Date**: 2026-01-27

**Context**

Multi-agent systems can be architected in two primary ways:

1. Microservices: Each agent runs as a separate process/container
2. In-process: All agents run within a single Node.js process

ARI must balance operational simplicity, latency, and isolation requirements. The system is designed for personal use on a single machine, not distributed deployment.

**Decision**

All agents run within the same Node.js process. There are no microservices, no inter-process communication, and no container orchestration.

Communication between agents occurs through:

- EventBus (publish-subscribe pattern)
- Direct function calls within layer boundaries
- Shared memory state (memory-manager)

**Consequences**

Positive:

- Zero network overhead between agents
- Simplified deployment (single process, no orchestration)
- Easier debugging (single call stack, unified logs)
- Faster message processing (in-memory, no serialization)
- Lower resource usage (one Node.js runtime, not 10+)

Negative:

- No process-level isolation (one agent crash can affect others)
- Cannot scale agents independently (all scale together)
- Harder to enforce resource limits per agent
- Shared memory state requires careful synchronization

Mitigations:

- EventBus provides error isolation (one handler failure doesn't break others)
- Memory capacity limits prevent runaway memory growth
- Executor concurrency limit prevents thread exhaustion
- Guardian rate limiting prevents resource exhaustion

**Alternatives Considered**

1. **Microservices architecture** (rejected):
   - Pros: Process isolation, independent scaling, resource limits
   - Cons: Network overhead, orchestration complexity, debugging difficulty
   - Reason: Overkill for personal operating system, network latency unacceptable for sub-second response times

2. **Worker threads** (rejected):
   - Pros: Thread-level isolation, parallel execution
   - Cons: Message passing overhead, complex shared state, debugging challenges
   - Reason: Adds complexity without sufficient isolation benefits, Node.js worker threads have significant overhead

3. **Hybrid approach** (deferred to Phase 4):
   - Pros: Critical agents isolated, performance agents in-process
   - Cons: Inconsistent architecture, complex configuration
   - Reason: Premature optimization, evaluate after real-world usage data

---

## ADR-002: Coarse 3-Level Permissions

**Status**: LOCKED

**Date**: 2026-01-27

**Context**

Permission systems range from very coarse (read/write) to very fine-grained (per-file, per-operation). ARI must balance security with usability and avoid permission fatigue.

Traditional UNIX permissions use 3 levels (read, write, execute). Cloud IAM systems use hundreds of permissions. ARI needs a model appropriate for personal AI agents.

**Decision**

Implement 4 permission tiers (effectively 3 operational + 1 admin):

1. **READ_ONLY**: Read files, inspect configuration, query memory
2. **WRITE_SAFE**: Write files (non-destructive), update memory, create contexts
3. **WRITE_DESTRUCTIVE**: Delete files, drop memory partitions, modify audit (append)
4. **ADMIN**: Modify configuration, change trust levels, override governance

Permission checks occur in executor.ts with 3-layer validation:

1. Agent allowlist (is agent authorized for this tool?)
2. Trust level (does source meet minimum trust threshold?)
3. Permission tier (does operation match context permission level?)

Destructive operations (tiers 3-4) ALWAYS require explicit approval, regardless of trust level.

**Consequences**

Positive:

- Simple mental model (safe vs. destructive vs. admin)
- Easy to reason about (clear escalation path)
- Prevents permission fatigue (not 100+ permissions to configure)
- Fast permission checks (4 tiers, O(1) comparison)
- Aligns with user intent (most operations are safe writes)

Negative:

- Cannot differentiate within tiers (all deletes treated equally)
- No path-based permissions (cannot restrict to specific directories)
- No operation-specific controls (cannot allow delete but not modify)
- Coarse approval workflow (all destructive ops require approval)

Mitigations:

- Arbiter enforces constitutional rules (finer-grained constraints)
- Approval workflow allows human review of destructive ops
- Audit log provides full provenance trail
- Tool registry can define custom permission requirements

**Alternatives Considered**

1. **UNIX-style (read/write/execute)** (rejected):
   - Pros: Universal understanding, OS alignment
   - Cons: Execute doesn't map well to AI operations, no destructive distinction
   - Reason: Missing critical security distinction between safe and destructive writes

2. **Fine-grained IAM-style** (rejected):
   - Pros: Precise control, least privilege per operation
   - Cons: Configuration complexity, permission fatigue, slow permission checks
   - Reason: Overkill for personal OS, users would default to "allow all"

3. **Role-based (RBAC)** (rejected):
   - Pros: Group permissions by role, easy to assign
   - Cons: Role explosion (need role per agent per context), role hierarchy complexity
   - Reason: Doesn't map to personal AI use case, no organizational structure

4. **Capability-based** (deferred to Phase 4):
   - Pros: Fine-grained delegation, no ambient authority
   - Cons: Complex token management, revocation challenges
   - Reason: Interesting for future multi-user, premature for personal OS

---

## ADR-003: Strict Context Isolation

**Status**: LOCKED

**Date**: 2026-01-27

**Context**

ARI manages multiple contexts: life domains (health, finance, family) and business ventures (user ventures, future ventures). Each context has distinct privacy, security, and operational requirements.

Context isolation prevents:

- Venture data leaking into personal life contexts
- Cross-venture data contamination
- Unauthorized context switching
- Memory poisoning across partitions

**Decision**

Implement strict namespace-based context isolation with 3 partitions:

1. **PUBLIC**: Shared across all contexts (general knowledge, public facts)
2. **INTERNAL**: Venture-specific or life-domain-specific (projects, tasks)
3. **SENSITIVE**: Highly restricted (credentials, financial data, personal health)

Isolation mechanisms:

- Storage isolation: ~/.ari/contexts/{context_id}.json (separate files)
- Memory isolation: Partition field on MemoryEntry, agent-based access control
- Active context: Only one context active at a time (~/.ari/contexts/active.json)
- Router enforcement: Context triggers prevent accidental switching

Context switching requires:

- Explicit user command (`ari context select {context_id}`)
- Or explicit mention trigger (for ventures)
- Audit log entry (system:context_switch)

**Consequences**

Positive:

- Strong privacy boundaries (venture A cannot read venture B data)
- Prevents accidental data leakage (no ambient context access)
- Clear audit trail (all context switches logged)
- Supports multi-venture operations (strict isolation)
- Partition-based memory access (granular control)

Negative:

- Cannot share data across contexts without explicit transfer
- Single active context (cannot work on multiple ventures simultaneously)
- Context switching overhead (explicit command required)
- Manual transfer needed for cross-context operations

Mitigations:

- PUBLIC partition allows controlled sharing
- Explicit transfer commands for cross-context data movement (Phase 3)
- Context routing intelligence reduces manual switching
- Future: Agent-initiated context switching with approval

**Alternatives Considered**

1. **No isolation (single namespace)** (rejected):
   - Pros: Simple, no switching overhead, easy data access
   - Cons: Data leakage risk, no privacy boundaries, venture cross-contamination
   - Reason: Unacceptable privacy risk, violates multi-venture requirements

2. **Soft isolation (tagging only)** (rejected):
   - Pros: Flexible data sharing, no hard boundaries
   - Cons: Easy to bypass, no enforcement, relies on agent discipline
   - Reason: Insufficient security, tags can be ignored or misapplied

3. **User-based isolation** (rejected):
   - Pros: Multi-user support, OS-level analogy
   - Cons: Complex authentication, not applicable to personal OS
   - Reason: Premature, no multi-user requirement in Phase 2

4. **Workspace model (VS Code style)** (considered for Phase 3):
   - Pros: Multiple active contexts, flexible switching
   - Cons: Complex state management, memory isolation challenges
   - Reason: Good future direction, but adds complexity for Phase 2

---

## ADR-004: 50%+1 Council Quorum

**Status**: LOCKED

**Date**: 2026-01-27

**Context**

The council has 13 voting agents. Votes can have different thresholds (MAJORITY, SUPERMAJORITY, UNANIMOUS). Quorum determines the minimum participation required for a valid vote.

Quorum prevents:

- Small minorities making unilateral decisions
- Decisions made without sufficient agent input
- Gaming the system by timing votes when agents are unavailable

Common quorum models:

- Simple majority (>50% of voters)
- 2/3 supermajority (66%+ of voters)
- All members (100% participation)

**Decision**

Require 50% quorum for all votes: At least 8 of 15 agents must participate for a vote to be valid.

Quorum applies before threshold calculation:

1. Check quorum: votedCount >= 7
2. If quorum met, check threshold: approve count vs. threshold requirement
3. If quorum not met, vote expires as FAILED

Quorum applies to all vote types (MAJORITY, SUPERMAJORITY, UNANIMOUS).

**Consequences**

Positive:

- Ensures meaningful participation (simple majority)
- Prevents minority rule (7 agents is majority of 13)
- Consistent rule across all vote types (no special cases)
- Allows votes to proceed even with some absent agents
- Easy to understand (50% rounds to 8 of 15)

Negative:

- Votes can fail due to apathy (agents don't participate)
- 7-agent participation might not be enough for critical decisions
- No distinction between vote types (UNANIMOUS has same quorum as MAJORITY)
- Abstentions count toward quorum but not toward threshold

Mitigations:

- 1-hour deadline encourages timely participation
- EventBus notifications alert all agents to votes
- Early conclusion logic speeds up decisive votes
- Audit trail shows which agents didn't participate

**Alternatives Considered**

1. **No quorum requirement** (rejected):
   - Pros: All votes succeed eventually, no participation requirement
   - Cons: 1-agent vote could pass MAJORITY, undemocratic
   - Reason: Minority rule unacceptable, defeats purpose of council

2. **2/3 quorum (9 of 13)** (rejected):
   - Pros: Higher participation bar, more legitimate decisions
   - Cons: Hard to reach, many votes would fail on quorum
   - Reason: Too strict, would block routine decisions unnecessarily

3. **100% quorum (13 of 13)** (rejected):
   - Pros: Full participation, maximum legitimacy
   - Cons: Impossible to achieve reliably, every vote would fail
   - Reason: Impractical, one unavailable agent blocks all decisions

4. **Threshold-dependent quorum** (rejected):
   - Pros: UNANIMOUS requires higher quorum, MAJORITY requires lower
   - Cons: Complex rules, inconsistent expectations
   - Reason: Adds unnecessary complexity, quorum and threshold serve different purposes

5. **Dynamic quorum (based on online agents)** (rejected):
   - Pros: Adapts to agent availability
   - Cons: Creates gaming opportunity (offline agents to lower quorum)
   - Reason: Security risk, could be exploited

---

## ADR-005: Operator + Guardian Stop-the-Line Authority

**Status**: LOCKED

**Date**: 2026-01-27

**Context**

Complex systems need emergency stop mechanisms. ARI agents can make autonomous decisions, but there must be a way to halt operations immediately if something goes wrong.

Inspired by:

- Manufacturing: Andon cord (any worker can stop the line)
- Aviation: Dual control (pilot + copilot both have override)
- Nuclear: Two-key launch control (dual authorization)

ARI needs a balance between autonomy and safety.

**Decision**

Grant dual stop-the-line authority to:

1. **Operator** (human user): Can halt all operations via CLI command
2. **Guardian** (threat detection agent): Can halt operations on risk >= 0.8

Both have independent authority (either can stop, no coordination required).

Stop-the-line mechanism:

- EventBus.emit('system:halt', { reason, initiator })
- All agents subscribe to 'system:halt' and cease operations
- Executor stops processing tool executions
- Planner stops creating new tasks
- Gateway continues accepting messages (but they queue)

Resumption requires:

- Operator command: `ari resume` (CLI)
- Or Guardian clearance: risk score drops below threshold

**Consequences**

Positive:

- Immediate threat response (Guardian auto-halt on high risk)
- Human override (Operator can stop anytime, no questions)
- No coordination required (either can act independently)
- EventBus-based (clean implementation, no tight coupling)
- Audit trail (all halts logged with reason)

Negative:

- Can be overly cautious (false positives halt operations)
- No graduated response (only binary stop/go)
- Guardian could halt too frequently (alert fatigue)
- Operations in-progress are interrupted (not graceful)

Mitigations:

- Guardian threshold tuned to minimize false positives (0.8 is high)
- Operator can override Guardian halt (human final authority)
- Audit log shows halt frequency (tune thresholds if needed)
- Future: Graceful shutdown option (finish in-progress, don't start new)

**Alternatives Considered**

1. **Operator-only authority** (rejected):
   - Pros: No false positives, human always in control
   - Cons: Requires constant human monitoring, slow response to threats
   - Reason: Defeats purpose of autonomous Guardian, can't respond to threats fast enough

2. **Guardian-only authority** (rejected):
   - Pros: Fully autonomous safety, no human needed
   - Cons: No human override, system could lock itself up
   - Reason: Human must always have final authority

3. **Arbiter authority (constitutional check)** (rejected):
   - Pros: Aligned with governance layer, principled decision
   - Cons: Too slow (must evaluate rules), not emergency response
   - Reason: Arbiter is for policy enforcement, not emergency stops

4. **Council vote required** (rejected):
   - Pros: Democratic, multiple agents weigh in
   - Cons: Too slow (quorum + voting time), emergency requires immediate action
   - Reason: Voting takes time, emergencies require instant response

5. **Graduated response (warning → slow → halt)** (deferred to Phase 3):
   - Pros: Less disruptive, allows recovery before full stop
   - Cons: Complex state machine, timing challenges
   - Reason: Good future enhancement, but adds complexity for Phase 2

---

## ADR-006: 1-Hour Proposal Expiration

**Status**: LOCKED

**Date**: 2026-01-27

**Context**

Votes need deadlines to ensure decisions are made in a timely manner. Deadlines prevent:

- Votes hanging indefinitely
- Decision paralysis
- Stale proposals being voted on after context changes

Common deadline approaches:

- Fixed time (1 hour, 24 hours, 1 week)
- Adaptive time (based on vote complexity or priority)
- No deadline (wait for quorum)

**Decision**

Set default vote deadline to 1 hour (60 minutes) from vote creation.

Deadline behavior:

- Timer starts on vote creation (council.createVote())
- Agents can cast votes anytime before deadline
- On deadline expiration: vote closes with status EXPIRED
- Expired votes are treated as FAILED (threshold not met)
- Early conclusion logic can close votes before deadline if outcome is determined

Deadline is configurable per-vote:

- createVote({ deadline_minutes: 60 }): Default 1 hour
- Can be overridden: createVote({ deadline_minutes: 1440 }): 24 hours
- Cannot be infinite (must provide a value)

**Consequences**

Positive:

- Ensures timely decisions (no indefinite waiting)
- Encourages participation (agents know deadline)
- Prevents stale votes (1 hour is short enough)
- Allows urgent decisions (can set shorter deadline)
- Early conclusion speeds up clear-cut votes

Negative:

- 1 hour might be too short for complex decisions
- Agents might miss votes if unavailable during window
- Expired votes always fail (even if trending toward approval)
- Time zone challenges (less relevant for personal OS)

Mitigations:

- Configurable deadline per-vote (flexibility for complex decisions)
- EventBus notifications alert agents when votes start
- Audit log shows who participated (accountability)
- Can recreate vote if expired due to timing issues

**Alternatives Considered**

1. **No deadline (wait forever)** (rejected):
   - Pros: Ensures all agents can participate, no time pressure
   - Cons: Votes could hang indefinitely, decision paralysis
   - Reason: Unacceptable for operational decisions, system could deadlock

2. **24-hour deadline** (rejected):
   - Pros: Plenty of time for all agents, thoughtful decisions
   - Cons: Too slow for routine decisions, operational bottleneck
   - Reason: Personal OS needs faster decisions, 24 hours is too long for "should I send this email?"

3. **Adaptive deadline (based on priority)** (rejected):
   - Pros: Complex decisions get more time, urgent decisions are fast
   - Cons: Complex rules, agents don't know expected timeline
   - Reason: Adds complexity, better to let vote creator choose

4. **Rolling deadline (extend on new votes)** (rejected):
   - Pros: Prevents expiration if discussion is active
   - Cons: Could extend indefinitely, gaming opportunity
   - Reason: Defeats purpose of deadline, could be exploited

5. **Quorum-triggered deadline** (rejected):
   - Pros: Deadline only starts when enough agents online
   - Cons: Complex logic, could still hang if quorum never reached
   - Reason: Adds complexity, doesn't solve core problem

---

## ADR-007: Append-Only Decision Rollback

**Status**: LOCKED

**Date**: 2026-01-27

**Context**

Decisions are not always correct. Requirements change. New information emerges. ARI needs a way to reverse or modify past decisions.

Common approaches:

- Delete and forget (remove from history)
- Edit in place (modify the record)
- Append-only (new entry supersedes old)
- Versioned (track all changes)

ARI's audit system is append-only (cannot delete or modify). Governance decisions should follow the same principle.

**Decision**

Implement append-only decision rollback:

- Past decisions are NEVER deleted from audit log
- Past decisions are NEVER modified in place
- New decisions can supersede old decisions by referencing them
- Audit trail shows full history: original decision → rollback decision → current state

Rollback mechanism:

1. Create new vote to reverse previous decision
2. Vote passes (meets threshold + quorum)
3. New decision is logged with "supersedes: {previous_vote_id}"
4. System behavior changes based on latest decision
5. Both votes remain in audit log forever

Example:

```
Vote A: "Allow agent X to execute tool Y" → PASSED
(later...)
Vote B: "Revoke agent X authorization for tool Y" → PASSED
         supersedes: vote_id_A
(audit log contains both, current policy is Vote B)
```

**Consequences**

Positive:

- Full audit trail (all decisions preserved)
- Aligns with audit-immutable principle (consistency)
- Transparent history (can see why decisions changed)
- Supports accountability (who voted for what, when)
- No data loss (all context preserved)

Negative:

- History can be long (many superseded decisions)
- Current policy requires traversing history (find latest)
- No "hard delete" for mistakes (everything is permanent)
- Storage grows forever (audit log never shrinks)

Mitigations:

- Efficient indexing (latest decision per topic)
- UI tools show current policy + history (Phase 3)
- Audit log rotation (archive old entries) (Phase 4)
- Can mark decisions as "superseded" for clarity

**Alternatives Considered**

1. **Delete and forget** (rejected):
   - Pros: Clean slate, no history clutter
   - Cons: Violates audit-immutable, no accountability, loss of context
   - Reason: Contradicts core security principle, unacceptable

2. **Edit in place** (rejected):
   - Pros: Current policy is always accurate, no traversal
   - Cons: Violates audit-immutable, can't see history, enables cover-ups
   - Reason: Same as delete and forget, breaks audit chain

3. **Versioned (Git-like)** (rejected):
   - Pros: Full history, branching, merging
   - Cons: Complexity, branches don't map to governance, merge conflicts
   - Reason: Overkill, governance is linear (one active policy at a time)

4. **Soft delete (marked as deleted)** (rejected):
   - Pros: Appears deleted to system, but preserved in audit
   - Cons: Confusing (is it deleted or not?), doesn't capture why
   - Reason: Better to explicitly supersede with reasoning

5. **Time-based rollback (undo within window)** (rejected):
   - Pros: Can fix immediate mistakes, no permanent record of error
   - Cons: Violates audit-immutable, creates time-based inconsistency
   - Reason: Audit must be permanent, even for mistakes

---

## ADR-008: Feedback Loops and RL Deferred

**Status**: LOCKED

**Date**: 2026-01-27

**Context**

Modern AI systems often incorporate:

- Feedback loops (learn from outcomes)
- Reinforcement learning (optimize via reward signals)
- Self-modification (update own code/prompts)

These techniques improve performance but add complexity and risk:

- Feedback loops can reinforce bad behavior
- RL requires careful reward engineering (misaligned incentives)
- Self-modification can violate security boundaries

ARI is in Phase 2. Core architecture is still stabilizing.

**Decision**

Defer all feedback loops and reinforcement learning to post-Phase 2:

- Phase 2: No feedback loops, no RL, no self-modification
- Phase 2b: Basic outcome tracking (success/failure metrics)
- Phase 3: Supervised feedback (human labels outcomes)
- Phase 4: Limited RL (scoped to specific agents, not system-wide)

What IS allowed in Phase 2:

- Static configuration updates (human-edited config files)
- Manual prompt tuning (human writes better prompts)
- Audit log analysis (retrospective review, no automatic changes)
- Memory storage (facts/preferences, not behavioral updates)

What is NOT allowed in Phase 2:

- Automatic prompt updates based on outcomes
- Weight updates to decision models
- Self-modification of agent code
- Reward-based optimization loops

**Consequences**

Positive:

- Reduced complexity (focus on core architecture)
- Predictable behavior (no drift, no emergent behavior)
- Security stability (agents can't modify themselves)
- Easier debugging (static behavior, no learning effects)
- Clear Phase 2 completion criteria (no moving target)

Negative:

- No performance improvement over time (agents don't learn)
- Repeated mistakes (no automatic correction)
- Manual tuning required (human must adjust prompts/config)
- Competitive disadvantage (other AI systems learn from use)

Mitigations:

- Memory system captures outcomes (manual analysis possible)
- Audit log provides feedback data (for future RL implementation)
- Explicit deferral to Phase 2b/3/4 (not abandoning, just sequencing)
- Can implement feedback in specific, scoped areas (not system-wide)

**Alternatives Considered**

1. **Implement basic feedback loops in Phase 2** (rejected):
   - Pros: Start learning early, competitive advantage
   - Cons: Complexity spike, security risks, behavior drift
   - Reason: Phase 2 is for stability, not optimization

2. **Implement RL in scoped areas (e.g., memory prioritization)** (rejected):
   - Pros: Limited scope, low risk, useful learning
   - Cons: Still adds complexity, requires reward engineering, testing burden
   - Reason: Better to defer entirely, implement holistically in Phase 3

3. **Allow self-modification with approval** (rejected):
   - Pros: Agent autonomy, faster iteration
   - Cons: Huge security risk, governance overhead, approval fatigue
   - Reason: Self-modification violates security boundaries, too dangerous

4. **Never implement feedback/RL** (rejected):
   - Pros: Maximum stability, predictable behavior
   - Cons: Competitive disadvantage, no improvement over time
   - Reason: Too conservative, feedback is valuable if done carefully

5. **Implement supervised learning only** (deferred to Phase 3):
   - Pros: Human-in-the-loop, safer than RL, clear feedback signal
   - Cons: Requires labeling infrastructure, human effort
   - Reason: Good middle ground, but still deferred to focus on core architecture

---

## Summary of Locked Decisions

| ADR | Decision | Impact |
|-----|----------|--------|
| ADR-001 | In-process agents | All agents run in one Node.js process |
| ADR-002 | 3-level permissions | READ_ONLY, WRITE_SAFE, WRITE_DESTRUCTIVE, ADMIN |
| ADR-003 | Context isolation | Strict namespace partitions (PUBLIC, INTERNAL, SENSITIVE) |
| ADR-004 | 50% quorum | 8 of 15 agents must participate in votes |
| ADR-005 | Dual stop authority | Operator + Guardian can halt operations |
| ADR-006 | 1-hour deadline | Votes expire after 60 minutes |
| ADR-007 | Append-only rollback | Decisions supersede, never delete |
| ADR-008 | RL deferred | No feedback loops or reinforcement learning in Phase 2 |

## Change Process

These ADRs are LOCKED as of Phase 2 completion. To modify any locked ADR:

1. Create council vote: "Modify ADR-XXX"
2. Threshold: SUPERMAJORITY (9 of 13 agents)
3. Arbiter review: Check for constitutional violations
4. If passed: Document change in new ADR (e.g., ADR-001-A)
5. Original ADR remains in log, new ADR supersedes

---

**Last Updated**: 2026-01-27
**Phase**: 2 (LOCKED)
**Authority**: Council + Arbiter
