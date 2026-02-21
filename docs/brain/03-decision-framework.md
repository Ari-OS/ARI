# ARI Decision Framework

ARI uses a structured decision-making process that combines quantitative scoring, multi-agent deliberation, and verification loops.

## ValueScore Algorithm

For every non-trivial decision, ARI calculates a **ValueScore** that combines risk, impact, effort, and alignment.

### Formula

```
ValueScore = (Impact × Alignment × TrustMultiplier) / (Risk × Effort)

Where:
- Impact: Expected value of outcome (0-10)
- Alignment: How well this aligns with creator's values (0-1)
- TrustMultiplier: Based on trust level (0.5x to 2.0x)
- Risk: Potential downside (0-10)
- Effort: Time/resource cost (1-10)
```

### Component Definitions

**Impact (0-10)**:

- 0-2: Trivial (minor convenience)
- 3-5: Moderate (noticeable improvement)
- 6-8: Significant (meaningful progress toward goal)
- 9-10: Transformative (game-changing outcome)

**Alignment (0-1)**:

- 1.0: Perfectly aligned with creator's stated values
- 0.75: Mostly aligned, minor conflicts
- 0.5: Neutral (neither aligned nor conflicting)
- 0.25: Somewhat misaligned
- 0.0: Directly conflicts with values

**Trust Multiplier**:

- SYSTEM: 0.5x (highly trusted)
- OPERATOR: 0.6x (trusted)
- VERIFIED: 0.75x (moderately trusted)
- STANDARD: 1.0x (baseline)
- UNTRUSTED: 1.5x (risk amplified)
- HOSTILE: 2.0x (maximum risk)

**Risk (0-10)**:

- 0-2: Negligible (easily reversible)
- 3-5: Moderate (requires effort to undo)
- 6-8: High (difficult to undo, potential harm)
- 9-10: Severe (irreversible, high harm potential)

**Effort (1-10)**:

- 1-2: Trivial (< 5 minutes)
- 3-4: Low (5-30 minutes)
- 5-6: Moderate (30 minutes - 2 hours)
- 7-8: High (2-8 hours)
- 9-10: Very high (> 8 hours)

### Example Calculations

**Example 1: Add feature to existing codebase**

```
Impact: 6 (significant improvement to user workflow)
Alignment: 0.9 (aligns well with creator's goals)
Trust: 1.0x (STANDARD trust level)
Risk: 3 (might introduce bugs, but testable)
Effort: 5 (2-3 hours of work)

ValueScore = (6 × 0.9 × 1.0) / (3 × 5) = 5.4 / 15 = 0.36
```

**Example 2: Deploy to production without tests**

```
Impact: 8 (fixes critical bug)
Alignment: 0.5 (creator values speed, but also stability)
Trust: 1.0x (STANDARD)
Risk: 9 (could break production)
Effort: 2 (quick deployment)

ValueScore = (8 × 0.5 × 1.0) / (9 × 2) = 4.0 / 18 = 0.22
```

**Example 3: Automate routine task**

```
Impact: 7 (saves 30 min/day)
Alignment: 1.0 (creator explicitly requested)
Trust: 0.6x (OPERATOR-level automation)
Risk: 2 (easily reversible)
Effort: 4 (1 hour to build)

ValueScore = (7 × 1.0 × 0.6) / (2 × 4) = 4.2 / 8 = 0.525
```

### Decision Thresholds

| ValueScore | Action |
|------------|--------|
| > 0.5 | **Approve** — High value relative to cost/risk |
| 0.3 - 0.5 | **Consider** — Evaluate alternatives, may proceed |
| 0.1 - 0.3 | **Caution** — High risk or low value, justify thoroughly |
| < 0.1 | **Reject** — Cost/risk outweighs value |

### Overrides

ValueScore can be overridden by:

1. **Constitutional violation**: Automatic rejection regardless of score
2. **Creator directive**: Explicit approval overrides calculation
3. **Emergency protocol**: StopTheLine allows immediate rejection

## Role Stacking (Multi-Perspective Analysis)

Every significant decision runs through **multiple agent perspectives** simultaneously.

### Core Roles

| Role | Question | Focus |
|------|----------|-------|
| **Guardian** | "What are the security risks?" | Threat detection, vulnerability assessment |
| **Planner** | "What's the optimal execution path?" | Task decomposition, dependency analysis |
| **Executor** | "What tools and permissions are needed?" | Resource requirements, feasibility |
| **Arbiter** | "Does this comply with constitutional rules?" | Rule compliance, value alignment |
| **Overseer** | "Does this pass quality gates?" | Quality standards, completeness |

### Process

```
Input: Decision to evaluate
  ↓
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│  Guardian   │   Planner   │  Executor   │   Arbiter   │  Overseer   │
│             │             │             │             │             │
│ Risk: 6/10  │ Steps: 5    │ Tools: 3    │ Compliant:  │ Quality:    │
│ Threats: 2  │ Time: 2hr   │ Perms: OK   │ YES         │ PASS        │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
  ↓             ↓             ↓             ↓             ↓
  └─────────────┴─────────────┴─────────────┴─────────────┘
                            ↓
                   Aggregate Scores
                   Calculate ValueScore
                            ↓
                   Decision: APPROVE
```

### Agent Weights

Not all agents have equal weight. Weights depend on decision type:

| Decision Type | Guardian | Planner | Executor | Arbiter | Overseer |
|---------------|----------|---------|----------|---------|----------|
| **Security** | 3x | 1x | 1x | 2x | 1x |
| **Architecture** | 1x | 2x | 1x | 1x | 3x |
| **Operations** | 1x | 1x | 3x | 1x | 2x |
| **Policy** | 2x | 1x | 1x | 3x | 1x |
| **General** | 1x | 1x | 1x | 1x | 1x |

### Veto Authority

Certain agents have **veto authority** for specific violations:

- **Guardian**: Can veto if security risk ≥ 8/10
- **Arbiter**: Can veto if constitutional rule violated
- **Overseer**: Can veto if quality below minimum threshold

**Veto is rare** — used only for clear violations, not disagreements.

## Verification Loop

For high-stakes or low-confidence decisions, ARI runs a **verification loop** before presenting output.

### Process

```
1. GENERATE
   ↓
   Generate initial response using System 2 (deliberate reasoning)
   ↓
2. CRITIQUE
   ↓
   Self-audit:
   - Are there logical flaws?
   - Am I missing key considerations?
   - Are biases present (confirmation, anchoring, etc.)?
   - Is confidence calibrated to evidence?
   ↓
3. REVISE
   ↓
   Address identified issues:
   - Fix logical errors
   - Add missing considerations
   - Adjust confidence levels
   - Remove biased reasoning
   ↓
4. PRESENT
   ↓
   Show revised response to user
```

### Triggers

Verification loop activates when:

- **High stakes** (impact > 7/10 OR risk > 6/10)
- **Low confidence** (< 60%)
- **Bias detected** (any bias flag triggered)
- **User requests** ("double-check this")
- **Constitutional proximity** (near rule boundary)

### Example

**Initial Generation**:
> "Deploy to production now. The bug is critical and users are affected."

**Critique**:

- Risk: Deploying without tests could introduce new bugs (risk 9/10)
- Bias: Urgency bias (overweighting immediate problem)
- Missing: Have we considered deploying a hotfix to a subset of users first?

**Revision**:
> "The bug is critical, but deploying without tests is high-risk (9/10). Recommendation: Deploy hotfix to 10% of users first, monitor for 1 hour, then full rollout. This reduces risk from 9/10 to 4/10 with only 1-hour delay."

## Budget-Aware Decision Shifting

ARI uses **cheaper models for routine tasks**, **expensive models for high-stakes tasks**.

### Model Selection

```typescript
function selectModel(decision: Decision): ModelTier {
  const complexity = decision.complexity; // 0-10
  const stakes = decision.impact + decision.risk; // 0-20

  if (complexity < 3 && stakes < 5) {
    return 'haiku'; // Fast, cheap ($0.80/MTok)
  } else if (complexity > 7 || stakes > 15) {
    return 'opus'; // Slow, expensive ($60/MTok), accurate
  } else {
    return 'sonnet'; // Balanced ($12/MTok)
  }
}
```

### Cost-Benefit Analysis

**Haiku** ($0.80/MTok):

- Use for: Formatting, linting, routine Q&A, familiar patterns
- Don't use for: Architecture, security, high-stakes

**Sonnet** ($12/MTok):

- Use for: Moderate complexity, standard tasks, code review
- Don't use for: Trivial tasks (wasteful) or critical decisions (insufficient)

**Opus** ($60/MTok):

- Use for: Architecture decisions, security review, novel problems
- Don't use for: Routine tasks (75x more expensive than Haiku)

### Budget Tracking

```typescript
interface BudgetTracker {
  dailyLimit: number; // $10/day default
  currentSpend: number;
  modelUsage: {
    haiku: number;
    sonnet: number;
    opus: number;
  };
}
```

When budget is exhausted:

1. Fall back to cheaper models
2. Defer non-critical tasks
3. Alert user if critical task requires expensive model

## Council Governance

For **strategic decisions** (not operational), ARI invokes the full **15-member Council**.

### When to Invoke Council

- **Constitutional amendments**: Changes to core rules
- **Value conflicts**: When values hierarchy doesn't resolve conflict
- **Major architecture changes**: Fundamental system redesigns
- **Budget allocation**: Annual/quarterly resource planning
- **Crisis response**: Emergencies requiring coordinated action

### Voting Process

Each Council member casts a vote: **APPROVE**, **REJECT**, or **ABSTAIN**.

**Vote Weights**:

- Standard members: 1 vote each
- NEXUS (integrator): 1.5 votes (tie-breaker authority)
- VERA (ethics): Veto authority on ethical violations

**Thresholds**:

- **Simple majority** (> 50%): Routine strategic decisions
- **Supermajority** (≥ 67%): Constitutional amendments, major changes
- **Unanimous** (100%): Changes to value hierarchy

### Example Council Vote

**Proposal**: Migrate from monolith to microservices

| Member | Vote | Reasoning |
|--------|------|-----------|
| ATLAS | APPROVE | Routing simplifies with service mesh |
| BOLT | REJECT | Complexity increases, more failure modes |
| ECHO | APPROVE | Memory isolation improves data integrity |
| AEGIS | REJECT | Larger attack surface |
| SCOUT | REJECT | Monitoring complexity increases risk |
| TRUE | APPROVE | Better scaling for future growth |
| TEMPO | REJECT | Coordination overhead slows delivery |
| OPAL | REJECT | Infrastructure costs increase 3x |
| PULSE | ABSTAIN | No impact on wellness domain |
| EMBER | ABSTAIN | No impact on relationships domain |
| PRISM | ABSTAIN | No impact on creative domain |
| MINT | REJECT | 3x cost increase not justified |
| BLOOM | APPROVE | Learning opportunity |
| VERA | ABSTAIN | No ethical concerns |
| NEXUS | REJECT | Costs outweigh benefits |

**Result**: 5 APPROVE, 7 REJECT, 3 ABSTAIN → **REJECTED**

## Emergency Protocols

### StopTheLine

Any agent can invoke **StopTheLine** to immediately halt operations.

**Triggers**:

- Constitutional violation detected
- Security threat (risk ≥ 9/10)
- Data corruption risk
- User safety concern

**Process**:

```
1. Invoking agent emits 'emergency:stop_the_line' event
2. All agents cease current operations
3. EventBus broadcasts halt to all listeners
4. System enters safe mode (read-only)
5. Alert user with explanation
6. Await explicit user approval to resume
```

**Code Reference**: `src/agents/guardian.ts` lines 145-160

### Quality Escalation

If output fails quality checks, escalate through model tiers:

```
Haiku fails → Retry with Sonnet
Sonnet fails → Retry with Opus
Opus fails → Surface failure to user, request guidance
```

**Quality Criteria**:

- Logical consistency
- Completeness (addresses all requirements)
- Accuracy (verifiable facts correct)
- Alignment (matches creator's values)

## Decision Audit Trail

Every decision is logged to `~/.ari/audit.json` with:

```typescript
interface DecisionAudit {
  timestamp: string;
  decision: string;
  valueScore: number;
  components: {
    impact: number;
    alignment: number;
    risk: number;
    effort: number;
  };
  roleStacking: {
    guardian: AgentAssessment;
    planner: AgentAssessment;
    executor: AgentAssessment;
    arbiter: AgentAssessment;
    overseer: AgentAssessment;
  };
  verificationLoop: boolean;
  outcome: 'APPROVED' | 'REJECTED' | 'DEFERRED';
  reasoning: string;
}
```

**Purpose**: Enables retrospective analysis ("Why did we decide X?") and improves future decisions through pattern recognition.

---

**Next**: [04-memory-model.md](04-memory-model.md) — How ARI remembers
