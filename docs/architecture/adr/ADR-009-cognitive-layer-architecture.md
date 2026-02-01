# ADR-009: Cognitive Layer 0 Architecture

**Status**: PROPOSED (Pending Council Vote)

**Date**: 2026-02-01

**Supersedes**: None (New architectural layer)

**Related ADRs**: ADR-004 (Six-Layer Architecture)

---

## Context

ARI Life OS currently operates as a sophisticated six-layer multi-agent system with 15 Council members, constitutional governance, and provenance-tracked memory. While architecturally sound, the system lacks **foundational cognitive frameworks** that enable:

1. **Algorithmic reasoning** - Probabilistic thinking, Bayesian updating, expected value calculations
2. **Emotional intelligence** - Bias detection, emotional regulation, discipline systems
3. **Continuous learning** - Reflection on outcomes, knowledge synthesis, self-improvement
4. **Wisdom integration** - Timeless principles from trading psychology, therapeutic frameworks, philosophical traditions

### Current State

**What ARI Has**:
- Strict security boundaries (loopback-only, Content ≠ Command, audit chain)
- 15 specialized Council members with voting authority
- Knowledge infrastructure: [`knowledge-sources.ts`](../../src/autonomous/knowledge-sources.ts) (10 technical sources), [`knowledge-fetcher.ts`](../../src/autonomous/knowledge-fetcher.ts) (safe fetching), [`knowledge-index.ts`](../../src/autonomous/knowledge-index.ts) (TF-IDF search)
- Autonomous scheduling, briefings, health monitoring
- Constitutional enforcement (Arbiter, Overseer)

**What ARI Lacks**:
- **Cognitive frameworks** for decision-making (no Bayesian reasoning, no expected value, no bias detection)
- **Psychological depth** (decisions are logical but not emotionally intelligent)
- **Learning mechanisms** (can fetch knowledge but not synthesize it into wisdom)
- **Principled reasoning** (no integration of Stoicism, trading psychology, systems thinking)
- **Specialized expertise** per Council member (all members have same cognitive tools)

### The Vision

Transform ARI from a **multi-agent system** into a **cognitively-enhanced Life Operating System** by adding a foundational consciousness layer (Layer 0) that provides:

- **LOGOS (Reason)**: Algorithmic decision-making, probabilistic reasoning, systems thinking
- **ETHOS (Character)**: Emotional regulation, bias mitigation, discipline, trading psychology
- **PATHOS (Growth)**: Self-reflection, therapeutic frameworks, meta-learning, wisdom traditions

This layer sits **beneath the Kernel** and is accessible to **all higher layers**, enabling every Council member to draw from deep cognitive frameworks when making decisions.

### Why Layer 0 (Not Another Location)?

**Option A: New Layer 0 (Below Kernel)** ✅ CHOSEN
- **Deepest integration**: All layers can access
- **Foundational**: Informs everything above
- **Self-contained**: No dependencies on higher layers
- **Always available**: Cannot be bypassed

**Option B: Extend Kernel** ❌ REJECTED
- Bloats security layer with non-security concerns
- Mixes cognitive frameworks with sanitization/audit
- Violates single responsibility principle

**Option C: Enhance Governance Only** ❌ REJECTED
- Only Council benefits, not Guardian/Planner/Executor
- Too narrow - cognitive frameworks should be universal
- Governance is about enforcement, not reasoning foundations

**Option D: Distributed Across Layers** ❌ REJECTED
- Inconsistent - each layer implements differently
- Hard to maintain - cognitive updates require touching all layers
- Duplicated logic - same frameworks reimplemented multiple times

**Layer 0 is the right choice**: Deepest possible integration while maintaining clean architecture.

---

## Decision

Add **Layer 0 (Cognitive Foundation)** beneath the existing Kernel layer, creating a new seven-layer architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 6: INTERFACES     CLI · Dashboard · Conversations           │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 5: EXECUTION      Daemon · Background Tasks                 │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 4: STRATEGIC      Council (15) · Arbiter · Overseer         │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 3: CORE AGENTS    Core · Guardian · Planner · Executor      │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 2: SYSTEM         Router · Storage · Context                │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 1: KERNEL         Gateway · Sanitizer · Audit · EventBus    │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 0: COGNITIVE      ◆ NEW — The Mind Behind the Machine       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LOGOS          │  ETHOS           │  PATHOS                │   │
│  │  (Reason)       │  (Character)     │  (Growth)              │   │
│  │  ─────────────  │  ──────────────  │  ────────────────      │   │
│  │  Bayesian Core  │  Bias Detector   │  Reflection Engine     │   │
│  │  Expected Value │  Emotion Monitor │  Learning Synthesizer  │   │
│  │  Kelly Criterion│  Fear/Greed Det  │  Wisdom Index          │   │
│  │  Decision Trees │  Discipline Sys  │  Meta-Learning         │   │
│  │  Systems Think  │  Trading Psych   │  CBT/DBT/ACT/Stoic     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↑                                      │
│                    Knowledge Streams (continuous learning)          │
│                    80+ curated sources across cognitive domains     │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer 0 Structure

**Location**: `src/cognition/`

**Directory Layout**:
```
src/cognition/
├── index.ts              # Main exports, public API
├── types.ts              # Zod schemas for all cognitive types
├── CLAUDE.md             # Layer 0 guide for AI assistants
│
├── logos/                # PILLAR 1: Reason
│   ├── index.ts
│   ├── bayesian.ts       # Belief updating, posterior calculation
│   ├── expected-value.ts # EV calculation, decision ranking
│   ├── kelly.ts          # Kelly Criterion position sizing
│   ├── decision-trees.ts # Decision tree analysis, optimal paths
│   └── systems-thinking.ts # Leverage points, feedback loops
│
├── ethos/                # PILLAR 2: Character
│   ├── index.ts
│   ├── bias-detector.ts  # 10 cognitive biases detection
│   ├── emotional-state.ts# Emotional state assessment
│   ├── fear-greed.ts     # Fear/greed cycle detection
│   └── discipline.ts     # Pre-decision checks, cooling-off
│
├── pathos/               # PILLAR 3: Growth
│   ├── index.ts
│   ├── reflection.ts     # Outcome analysis, insight extraction
│   ├── synthesis.ts      # Pattern recognition, principle extraction
│   ├── wisdom.ts         # Wisdom traditions consultation
│   └── meta-learning.ts  # Learning plans, skill acquisition
│
├── knowledge/            # Knowledge Management
│   ├── index.ts
│   ├── source-manager.ts    # Extends knowledge-sources.ts with cognitive sources
│   ├── content-validator.ts # Multi-stage validation pipeline
│   └── specializations.ts   # Council member cognitive profiles
│
└── learning/             # Continuous Learning Loop
    ├── index.ts
    ├── performance-review.ts # Daily outcome analysis
    ├── gap-analysis.ts       # Knowledge gap identification
    └── self-assessment.ts    # Learning velocity measurement
```

### Integration with Existing Architecture

**Kernel Layer Remains Unchanged**:
- Layer 0 does NOT modify security boundaries
- Gateway still binds to 127.0.0.1 only
- Sanitizer still scans all input
- Audit chain remains immutable
- EventBus remains the communication hub

**Layer 0 Sits Below Kernel**:
- Kernel can import from Layer 0 (cognitive frameworks enhance security decisions)
- Layer 0 CANNOT import from Kernel (self-contained, no dependencies)
- Layer 0 communicates via EventBus events (follows existing pattern)

**Dependency Flow**:
```
Layer 6 (Interfaces)
  ↓ imports
Layer 5 (Execution)
  ↓ imports
Layer 4 (Strategic/Governance)
  ↓ imports
Layer 3 (Core Agents)
  ↓ imports
Layer 2 (System)
  ↓ imports
Layer 1 (Kernel)
  ↓ imports
Layer 0 (Cognitive)  ← NEW
  ↓ imports (NONE - self-contained)
[No lower dependencies]
```

**EventBus Communication**:
Layer 0 emits new event types (extends [`event-bus.ts`](../../src/kernel/event-bus.ts) EventMap):
- `cognition:query` - When cognitive API called
- `cognition:belief_updated` - Bayesian belief updated
- `cognition:bias_detected` - Cognitive bias found
- `cognition:reflection_complete` - Outcome reflected upon
- `cognition:wisdom_consulted` - Wisdom tradition queried
- `knowledge:source_fetched` - New knowledge ingested
- `knowledge:validated` - Content passed validation
- `learning:gap_identified` - Knowledge gap detected
- `learning:improvement_measured` - Learning progress tracked

### Storage

**Extends Existing**: `~/.ari/`

**New Directories**:
```
~/.ari/cognition/
├── beliefs.json          # Bayesian beliefs database
├── wisdom-index.json     # Curated principles from traditions
├── council-profiles/     # Per-member specialization data
│   ├── aegis.json        # AEGIS (Guardian) cognitive profile
│   ├── mint.json         # MINT (Wealth) cognitive profile
│   └── ... (15 files)
├── learning-log.json     # Daily performance reviews
├── sources/              # Fetched knowledge content
│   ├── logos/            # Algorithmic reasoning sources
│   ├── ethos/            # Trading psychology sources
│   └── pathos/           # Therapeutic frameworks sources
└── cache/                # API response cache (30min TTL)
    └── queries.json
```

**Security**: All files `chmod 700` (owner-only), following existing [`knowledge-fetcher.ts`](../../src/autonomous/knowledge-fetcher.ts) pattern.

---

## Rationale

### 1. Universal Cognitive Foundation

Every decision ARI makes should be informed by deep frameworks:

**Without Layer 0** (Current):
```typescript
// SCOUT assessing financial risk (simplified)
async assessRisk(investment: Investment): Promise<Risk> {
  const riskScore = this.calculateBasicRisk(investment);
  return { score: riskScore, recommendation: riskScore > 0.7 ? 'avoid' : 'consider' };
}
```

**With Layer 0** (Enhanced):
```typescript
// SCOUT assessing financial risk with cognitive frameworks
async assessRisk(investment: Investment): Promise<Risk> {
  // LOGOS: Calculate expected value
  const ev = await cognition.calculateExpectedValue({
    outcomes: investment.scenarios.map(s => ({
      probability: s.probability,
      value: s.return,
    })),
  });
  
  // LOGOS: Kelly Criterion for position sizing
  const kelly = await cognition.calculateKellyFraction({
    winProbability: investment.winProb,
    winPayoff: investment.upside,
    lossProbability: investment.lossProb,
    lossPayoff: investment.downside,
  });
  
  // ETHOS: Check for cognitive biases
  const biases = await cognition.detectCognitiveBias(
    this.reasoning,
    { agent: 'SCOUT', context: investment }
  );
  
  // ETHOS: Assess emotional state
  const emotionalState = await cognition.checkEmotionalState(
    this.member,
    investment
  );
  
  // Synthesize: Combine algorithmic + psychological analysis
  const recommendation = this.synthesizeRecommendation({
    expectedValue: ev,
    kellyFraction: kelly.halfKelly, // Conservative
    biases,
    emotionalRisk: emotionalState.riskToDecisionQuality,
  });
  
  return {
    score: this.normalizeToRisk(recommendation),
    recommendation: recommendation.action,
    reasoning: recommendation.explanation,
    confidence: recommendation.confidence,
  };
}
```

**Improvement**:
- Decisions backed by probability theory (Bayesian, EV, Kelly)
- Bias-aware (detects confirmation bias, loss aversion)
- Emotionally intelligent (checks if fear/greed is distorting judgment)
- Traceable (every step has provenance)

### 2. Council Member Specialization

Each of 15 Council members gains **specialized cognitive expertise**:

| Member | Current Coverage | New Cognitive Specialization |
|--------|-----------------|------------------------------|
| **ATLAS** (Navigator) | Routing, context, intent | + Systems thinking (Meadows), complexity theory, emergence patterns |
| **BOLT** (Executor) | Execution, tools, delivery | + Optimization theory, efficiency algorithms, constraint solving |
| **ECHO** (Archivist) | Memory, recall, knowledge | + Knowledge organization, spaced repetition, memory consolidation |
| **AEGIS** (Guardian) | Threats, injection, anomalies | + Trading psychology (risk), Taleb (antifragility), threat modeling |
| **SCOUT** (Risk) | Financial/health/legal risk | + Kelly Criterion, expected value, Bayesian risk assessment |
| **TRUE** (Strategist) | Goals, decomposition, planning | + Game theory, strategic planning, decision trees |
| **TEMPO** (Timekeeper) | Calendar, deadlines, scheduling | + Temporal reasoning, circadian optimization, work-life balance |
| **OPAL** (Resources) | Budget, energy, attention | + Resource allocation, Pareto efficiency, opportunity cost |
| **PULSE** (Health) | Physical/mental health | + CBT/DBT, wellness psychology, habit formation, therapeutic frameworks |
| **EMBER** (Relationships) | Family, friends, social | + Emotional intelligence, communication psychology, attachment theory |
| **PRISM** (Creative) | Art, ideas, innovation | + Creativity research, lateral thinking, divergent thought |
| **MINT** (Wealth) | Income, investments, taxes | + Behavioral finance, Kelly Criterion, portfolio theory, loss aversion |
| **BLOOM** (Growth) | Learning, skills, career | + Meta-learning, deliberate practice, growth mindset, skill acquisition |
| **VERA** (Ethics) | Morals, fairness, values | + Stoic philosophy, virtue ethics, moral reasoning frameworks |
| **NEXUS** (Integrator) | Synthesis, conflicts, holistic | + Complexity science, emergence, holistic thinking, systems integration |

**Result**: Each member becomes a **domain expert** with access to curated knowledge sources, specialized frameworks, and continuous learning in their area.

### 3. Continuous Learning

ARI currently **fetches** knowledge but doesn't **learn** from it. Layer 0 adds a learning loop:

```
┌─────────────────────────────────────────────────────────────┐
│  1. PERFORMANCE REVIEW (Daily, 9 PM)                        │
│     - Analyze last 24h decisions                            │
│     - Measure outcomes (success/failure/partial)            │
│     - Identify patterns (what worked, what didn't)          │
├─────────────────────────────────────────────────────────────┤
│  2. GAP ANALYSIS (Weekly, Sunday 8 PM)                      │
│     - What questions couldn't be answered?                  │
│     - What frameworks were missing?                         │
│     - What sources would have helped?                       │
├─────────────────────────────────────────────────────────────┤
│  3. SOURCE DISCOVERY (As needed)                            │
│     - Search for papers/books addressing gaps               │
│     - Evaluate source quality and trust                     │
│     - Add to ingestion queue (human approval required)      │
├─────────────────────────────────────────────────────────────┤
│  4. KNOWLEDGE INTEGRATION (Daily, 8 AM)                     │
│     - Fetch new content from approved sources               │
│     - Validate (sanitize → bias-check → fact-check)         │
│     - Index for semantic search                             │
│     - Update Council member specializations                 │
├─────────────────────────────────────────────────────────────┤
│  5. SELF-ASSESSMENT (Monthly, 1st at 9 AM)                  │
│     - Did learning improve decision quality?                │
│     - Are biases being reduced?                             │
│     - Is knowledge retention high?                          │
│     - Calculate learning velocity                           │
└─────────────────────────────────────────────────────────────┘
```

**Integration**: Uses existing [`scheduler.ts`](../../src/autonomous/scheduler.ts) for automation.

**Constraint**: Respects ADR-008 (RL Deferred) - learning is supervised (human approval required for framework updates), not autonomous self-modification.

### 4. Three-Pillar Organization

Classical rhetoric's three pillars (Logos, Ethos, Pathos) map perfectly to cognitive domains:

**LOGOS (Reason)** - Appeal to logic:
- Bayesian reasoning (belief updating based on evidence)
- Expected value (probabilistic decision-making)
- Kelly Criterion (optimal resource allocation)
- Decision trees (structured analysis)
- Systems thinking (understanding complexity)
- **Sources**: arXiv (probability, decision theory), Taleb, Nate Silver, Meadows, LessWrong

**ETHOS (Character)** - Appeal to ethics/credibility:
- Trading psychology (discipline, emotional regulation)
- Bias detection (confirmation, sunk-cost, recency, loss aversion)
- Fear/greed cycles (preventing emotional decisions)
- Discipline systems (pre-decision checks, cooling-off periods)
- **Sources**: Mark Douglas, Van Tharp, Kahneman, behavioral economics

**PATHOS (Growth)** - Appeal to emotion/values:
- Therapeutic frameworks (CBT/DBT/ACT for reframing)
- Stoic philosophy (dichotomy of control, virtue ethics)
- Deliberate practice (skill acquisition, mastery)
- Meta-learning (learning how to learn)
- Wisdom traditions (Dalio, Munger, Musashi, Naval)
- **Sources**: Beck Institute, Linehan, Marcus Aurelius, Seneca, learning science

**Why These Three?**
- **Complete coverage**: Logic + character + growth = holistic intelligence
- **Balanced**: No single pillar dominates (all three inform decisions)
- **Timeless**: Based on 2000+ years of rhetoric and philosophy
- **Practical**: Each pillar has concrete, implementable frameworks

### 5. Maintains Existing Invariants

Layer 0 **respects all locked ADRs**:

**ADR-001 (In-Process Agents)** ✅
- Layer 0 runs in same Node.js process
- No microservices, no network overhead
- Direct function calls for cognitive APIs

**ADR-002 (3-Level Permissions)** ✅
- Cognitive APIs don't bypass permission checks
- Layer 0 is informational (provides analysis, not execution)
- Executor still gates all destructive operations

**ADR-003 (Context Isolation)** ✅
- Layer 0 respects partition boundaries
- Cognitive queries scoped to active context
- SENSITIVE knowledge stays isolated

**ADR-004 (Six-Layer Architecture)** ⚠️ EXTENDED (Now Seven Layers)
- Adds Layer 0 below Kernel
- Maintains unidirectional dependencies (no cycles)
- Preserves layer boundaries (no cross-layer calls except via EventBus)

**ADR-005 (Stop-the-Line Authority)** ✅
- Operator + Guardian retain halt authority
- Layer 0 cannot halt system (only provide recommendations)
- Guardian can use ETHOS frameworks to enhance threat detection

**ADR-006 (1-Hour Deadline)** ✅
- Council votes unchanged
- Layer 0 may inform votes but doesn't change voting mechanics

**ADR-007 (Append-Only Rollback)** ✅
- Cognitive beliefs follow append-only pattern
- Belief updates create new entries, never delete old
- Full history preserved

**ADR-008 (RL Deferred)** ✅ CRITICAL
- Layer 0 does NOT implement autonomous self-modification
- Learning loop requires human approval for framework changes
- Knowledge ingestion requires source approval
- Supervised learning only (no reinforcement learning)

**Security Invariants** ✅ ALL MAINTAINED:
1. **Loopback-Only**: Layer 0 doesn't bind to network (no gateway access)
2. **Content ≠ Command**: Knowledge sources are DATA, never executable instructions
3. **Audit Immutable**: All cognitive operations logged (append-only)
4. **Least Privilege**: Cognitive APIs are read-only (analysis, not execution)
5. **Trust Required**: External knowledge sources use trust model (VERIFIED, STANDARD, UNTRUSTED)

---

## Implementation Strategy

### Phase 0: Foundation (Week 1-2)

1. **Create directory structure** (`src/cognition/` and subdirectories)
2. **Define all types** (`src/cognition/types.ts` with Zod schemas)
3. **Extend EventBus** (add cognitive event types to EventMap)
4. **Write tests scaffolding** (`tests/unit/cognition/`)
5. **Document Layer 0** (`src/cognition/CLAUDE.md`)

**No functionality yet** - just architecture scaffolding.

### Phase 1: LOGOS Prototype (Week 3-4)

Prove the concept with two frameworks:

1. **Bayesian Belief Updating**:
   - Implement `updateBelief()` function
   - Store beliefs in `~/.ari/cognition/beliefs.json`
   - Test with real scenarios (updating probability based on evidence)

2. **Expected Value Calculator**:
   - Implement `calculateExpectedValue()` function
   - Test with financial decisions (compare alternatives)
   - Integrate with SCOUT for risk assessment

**Success Criteria**: SCOUT makes better risk decisions using LOGOS APIs.

### Phase 2-7: Full Implementation (Week 5-16)

See ADR-014 (Learning Loop) and separate implementation roadmap document for complete plan.

### Access Pattern

Higher layers import cognitive functions:

```typescript
// Example: Guardian using ETHOS to enhance threat detection
import { detectCognitiveBias } from '../../cognition/ethos/bias-detector.js';
import type { BiasDetection } from '../../cognition/types.js';

export class Guardian {
  async assessThreat(message: Message): Promise<ThreatAssessment> {
    // Existing threat detection logic
    const baselineRisk = this.detectInjectionPatterns(message);
    
    // NEW: Check if our own reasoning is biased
    const biases = await detectCognitiveBias(
      this.lastReasoningTrace,
      { agent: 'AEGIS', context: message }
    );
    
    // If we're showing confirmation bias (seeing threats everywhere),
    // adjust risk score downward
    if (biases.some(b => b.bias === 'CONFIRMATION_BIAS')) {
      baselineRisk *= 0.8; // Reduce by 20%
    }
    
    return { risk: baselineRisk, biases };
  }
}
```

**Key Principle**: Layer 0 **informs** decisions, doesn't **make** them. Council members retain autonomy.

---

## Consequences

### Positive

1. **Deeper Intelligence**
   - Decisions backed by probability theory, psychology, wisdom traditions
   - Every Council member becomes a domain expert
   - ARI evolves from "smart system" to "wise system"

2. **Continuous Improvement**
   - Learning loop measures and improves decision quality
   - Knowledge base grows from 10 → 80+ sources
   - Self-assessment provides objective improvement metrics

3. **Bias Mitigation**
   - Automatically detects cognitive biases (confirmation, sunk-cost, recency, etc.)
   - Prevents emotional decisions (fear/greed cycles)
   - Enforces discipline (cooling-off periods, pre-decision checks)

4. **Principled Reasoning**
   - Decisions traceable to cognitive frameworks (not black box)
   - Can explain "why" using Bayesian reasoning, Stoic principles, etc.
   - Wisdom traditions provide timeless guidance

5. **Specialized Expertise**
   - AEGIS becomes risk psychology expert (Douglas, Tharp, Taleb)
   - MINT becomes behavioral finance expert (Kahneman, Kelly)
   - PULSE becomes therapeutic expert (CBT/DBT, wellness)
   - VERA becomes philosophical expert (Stoics, virtue ethics)
   - BLOOM becomes learning expert (Ericsson, meta-learning)

6. **Architectural Elegance**
   - Clean separation: cognition below security boundary
   - Self-contained: Layer 0 has no dependencies
   - Universal access: All layers can use cognitive APIs
   - EventBus integration: Follows existing patterns

### Negative

1. **Complexity Increase**
   - New layer to maintain (7 instead of 6)
   - Larger codebase (`src/cognition/` is substantial)
   - More sophisticated reasoning (harder to debug)
   - Learning loop adds operational overhead

2. **Performance Overhead**
   - Cognitive API calls add latency (target: <100ms each)
   - Knowledge base queries hit disk (TF-IDF search)
   - Belief updates require recalculation
   - Cache required for frequently-used results

3. **External Dependencies (SECURITY RISK)**
   - Fetching from 80+ external sources
   - Risk of misinformation/propaganda
   - Risk of cognitive poisoning (bad advice)
   - Risk of prompt injection via knowledge content

4. **Maintenance Burden**
   - 80+ sources to monitor (availability, content changes)
   - Knowledge base can become outdated
   - Specializations need updating as fields evolve
   - Learning loop requires periodic review

5. **Implementation Effort**
   - 16-week implementation timeline (4 months)
   - Substantial testing burden (hundreds of test cases)
   - Documentation must be comprehensive
   - Integration touches many existing files

### Mitigations

**Complexity**:
- Excellent documentation (this ADR, pillar designs, API specs)
- Clear examples for every API
- Comprehensive tests (80%+ coverage)
- Phase-by-phase rollout (can stop at any phase)

**Performance**:
- Response time budgets (<100ms per API call)
- Caching strategy (30min TTL for frequent queries)
- Pre-computation for common scenarios
- Incremental knowledge indexing (not full reindex)

**Security (CRITICAL)**:
- **Whitelist-only**: Sources must be added to [`knowledge-sources.ts`](../../src/autonomous/knowledge-sources.ts) (cannot fetch arbitrary URLs)
- **Trust levels**: VERIFIED (official/academic) vs STANDARD (reputable) vs UNTRUSTED (requires human review)
- **Sanitization**: All content passes through Kernel [`sanitizer.ts`](../../src/kernel/sanitizer.ts) + additional cognitive sanitizer
- **Bias detection**: Check for propaganda, extreme views, misinformation
- **Fact-checking**: Cross-reference claims with multiple sources
- **Provenance**: Every piece of knowledge traces back to source URL + fetch timestamp
- **Human approval**: UNTRUSTED sources cannot auto-integrate (queued for review)
- **Audit trail**: All knowledge fetches logged in hash-chained audit

**Maintenance**:
- Automated source availability checks (daily)
- Source health metrics (fetch success rate, content quality)
- Deprecation process (remove low-quality sources)
- Quarterly knowledge review (prune outdated, add new)

**Implementation Effort**:
- Incremental rollout (LOGOS prototype first, prove value before full build)
- Can defer phases (e.g., skip PATHOS if LOGOS/ETHOS are sufficient)
- Reuse existing infrastructure (knowledge-fetcher, knowledge-index, scheduler)
- Leverage EventBus (no new communication patterns)

---

## Alternatives Considered

### 1. Extend Governance Layer Instead of Adding Layer 0

**Description**: Add cognitive frameworks directly to Council, Arbiter, Overseer instead of creating new layer.

**Pros**:
- No new layer (simpler architecture)
- Cognitive frameworks tightly coupled with decision-making
- Fewer files (everything in `src/governance/`)

**Cons**:
- Only Governance benefits (Kernel, Agents, System don't get cognitive frameworks)
- Bloats Governance with non-governance concerns (Layer 4 isn't about reasoning foundations)
- Guardian/Planner/Executor can't use cognitive APIs (layer boundary violation)
- Harder to maintain (cognition mixed with voting/rules/gates)

**Rejected Because**: Too narrow. Cognitive frameworks should be **universal**, not just for Council.

---

### 2. Create Peer Layer (Layer 1.5 Between Kernel and System)

**Description**: Add cognitive layer between Kernel and System, same level as existing layers.

**Pros**:
- Maintains "six-layer" mental model (just shifts numbering)
- Cognitive framework peers with other capabilities

**Cons**:
- **Not foundational** (sits above Kernel, so Kernel can't use it)
- Arbitrary positioning (why between Kernel and System specifically?)
- Doesn't emphasize **foundational** nature
- Violates "cognitive frameworks should inform everything" principle

**Rejected Because**: Cognitive frameworks should be **deeper** than security (Kernel should use cognitive APIs to enhance threat detection).

---

### 3. External Service (Separate Process/API)

**Description**: Run Layer 0 as external microservice, expose HTTP API, other layers call via network.

**Pros**:
- Process isolation (cognitive crash doesn't affect main system)
- Can scale independently
- Language-agnostic (could implement in Python for ML libraries)

**Cons**:
- **Violates loopback-only** (requires network binding, even if localhost)
- Network overhead (latency for every cognitive query)
- Complexity (service orchestration, health monitoring, restart logic)
- Contradicts ADR-001 (in-process agents)
- Harder to debug (cross-process calls)

**Rejected Because**: Violates security invariant (loopback-only is for external access, not internal microservices). Contradicts in-process philosophy.

---

### 4. Plugin Architecture (Load Cognitive Modules Dynamically)

**Description**: Layer 0 is optional, loaded as plugins if user wants cognitive features.

**Pros**:
- Optional (users can run ARI without cognitive layer)
- Modular (can load only LOGOS, not ETHOS/PATHOS)
- Smaller core (cognitive features not in base install)

**Cons**:
- **Cognitive frameworks should be foundational**, not optional
- Plugin loading adds complexity (dynamic imports, version management)
- Inconsistent behavior (some ARI instances have cognition, others don't)
- Harder to test (must test with/without plugins)

**Rejected Because**: Cognitive intelligence is **core to ARI's mission**, not a nice-to-have feature.

---

### 5. Integrate Gradually (No Layer 0, Add Frameworks One-by-One to Agents)

**Description**: Add Bayesian reasoning to Guardian, add Kelly to MINT, add CBT to PULSE, etc. No unified layer.

**Pros**:
- Incremental (can stop at any point)
- No major architecture change
- Agents own their cognitive enhancements

**Cons**:
- **Duplicated logic** (Bayesian code reimplemented in Guardian, SCOUT, MINT, etc.)
- **Inconsistent** (each agent implements differently)
- **Hard to maintain** (updating Bayesian logic requires touching multiple files)
- **No cross-pollination** (PULSE can't use Kelly, MINT can't use CBT)
- **No learning loop** (where does it live if no Layer 0?)

**Rejected Because**: Violates DRY (Don't Repeat Yourself). Cognitive frameworks should be **centralized** for consistency.

---

## Security Model

### Threat Model for Layer 0

**New Attack Vectors**:

1. **Knowledge Poisoning**: Malicious content in external sources
   - **Mitigation**: Whitelist-only, sanitization, bias detection, cross-reference validation

2. **Cognitive Manipulation**: Introducing biased frameworks that favor bad decisions
   - **Mitigation**: Multiple sources per framework, contradiction detection, human review for new frameworks

3. **Misinformation**: False "facts" that mislead decision-making
   - **Mitigation**: VERIFIED sources only (academic, official), fact-checking across sources

4. **Prompt Injection via Knowledge**: Embedding instructions in fetched content
   - **Mitigation**: Extend [`sanitizer.ts`](../../src/kernel/sanitizer.ts) patterns to detect "ignore previous", "you are now", etc. in knowledge content

5. **Dependency Poisoning**: Malicious npm packages in cognitive libs
   - **Mitigation**: Zero external dependencies for cognitive logic (pure TypeScript), only Node.js builtins

**Defense in Depth**:

```
External Source
      ↓
Whitelist Check (is source in KNOWLEDGE_SOURCES?)
      ↓
Fetch with Rate Limiting (2s between requests)
      ↓
Content Sanitization (remove scripts, injection patterns)
      ↓
Bias Detection (check for propaganda, extreme views)
      ↓
Fact Checking (cross-reference with other sources)
      ↓
Provenance Tagging (source URL, fetch timestamp, content hash)
      ↓
Human Review (if trust = UNTRUSTED)
      ↓
Index for Search (TF-IDF, existing knowledge-index.ts)
      ↓
Available to Council Members
```

**Trust Model Extension**:

| Source Type | Trust Level | Auto-Integrate? | Example |
|-------------|-------------|----------------|---------|
| Official (Anthropic, academic) | VERIFIED | ✅ Yes | Anthropic docs, Stanford courses |
| Established (reputable orgs) | STANDARD | ✅ Yes (after validation) | LessWrong VERIFIED authors, OWASP |
| User-generated | UNTRUSTED | ❌ No (human review) | Reddit, forums, blogs |

**Audit Trail**:
All cognitive operations emit audit events:
```typescript
eventBus.emit('cognition:query', {
  api: 'calculateExpectedValue',
  agent: 'SCOUT',
  input: { /* sanitized */ },
  timestamp: new Date().toISOString(),
});
```

**Content = Data Principle Still Holds**:
- Knowledge sources are **data** (facts, frameworks, principles)
- Knowledge is **never executed** as code
- Cognitive APIs **analyze**, they don't **command**

---

## Performance Considerations

### Response Time Budgets

| API Category | Target Latency | Justification |
|--------------|---------------|---------------|
| LOGOS (calculations) | <50ms | Math-heavy, should be fast |
| ETHOS (bias detection) | <100ms | Pattern matching, acceptable |
| PATHOS (reflection) | <200ms | Complex analysis, still responsive |
| Knowledge queries | <500ms | Disk I/O, semantic search |

**Optimization Strategies**:
- **Caching**: Frequent queries cached (30min TTL)
- **Pre-computation**: Common scenarios (e.g., Kelly Criterion for standard risk levels) pre-calculated
- **Lazy loading**: Wisdom index loaded on first use, not startup
- **Incremental indexing**: Add documents one-by-one, not full reindex

### Memory Footprint

**Estimates**:
- Cognitive code: ~500KB compiled TypeScript
- Belief database: ~1MB (1000 beliefs × 1KB each)
- Wisdom index: ~5MB (curated principles)
- Knowledge cache: ~10MB (frequently-accessed content)
- Council profiles: ~150KB (15 members × 10KB each)

**Total**: ~17MB additional memory (acceptable - Node.js apps typically use 50-200MB)

**Disk**:
- `~/.ari/cognition/`: ~100MB (sources + cache)
- Grows ~1MB/week with learning
- Rotation after 1 year (archive old content)

---

## Testing Strategy

### Coverage Requirements

- **Overall Layer 0**: 80%+ coverage (matches existing target)
- **Security paths**: 100% coverage (knowledge validation, sanitization, bias detection)
- **Cognitive APIs**: 90%+ coverage (LOGOS/ETHOS/PATHOS functions are critical)

### Test Categories

**Unit Tests** (`tests/unit/cognition/`):
- Test each cognitive function in isolation
- Test with edge cases (zero probability, conflicting evidence, extreme values)
- Test error handling (invalid inputs, missing data)

**Integration Tests** (`tests/integration/cognition/`):
- Test Council members using cognitive APIs
- Test learning loop end-to-end
- Test knowledge pipeline (fetch → validate → index → query)

**Security Tests** (`tests/security/cognition/`):
- Attempt knowledge poisoning (inject malicious content)
- Attempt prompt injection via sources
- Test sanitization effectiveness
- Verify trust boundaries

**Performance Tests** (`tests/performance/cognition/`):
- Measure API response times
- Test under load (1000 concurrent queries)
- Memory leak detection
- Cache effectiveness

---

## Documentation Requirements

### Before Implementation Begins

1. **This ADR** - Establishes architectural foundation
2. **ADR-010** - Three-pillar framework details
3. **ADR-011** - Knowledge source trust model
4. **ADR-012** - Council specializations
5. **ADR-013** - Cognitive API specification
6. **ADR-014** - Learning loop mechanism
7. **Pillar Design Docs** - LOGOS, ETHOS, PATHOS (detailed)
8. **Implementation Roadmap** - Phase-by-phase plan
9. **Testing Strategy** - Comprehensive test plan

**Total Documentation**: ~300-400 pages

**Timeline**: 6 weeks of design before coding begins.

**Rationale**: This is a **foundational architectural change**. Getting design right is 10x more important than coding fast.

---

## Rollback Plan

If Layer 0 proves problematic:

1. **Phase 1 Prototype Failure**: 
   - Abandon Layer 0, no code merged
   - Document learnings in ADR-009-REJECTED
   - Fallback: Enhance individual agents with simpler frameworks

2. **Performance Issues**:
   - Profile and optimize
   - If unsolvable: Make Layer 0 optional (can be disabled)
   - Agents fall back to basic reasoning

3. **Security Breach**:
   - Halt knowledge ingestion immediately
   - Audit all fetched content
   - Quarantine suspicious knowledge
   - Strengthen validation pipeline

4. **Complexity Overload**:
   - Defer ETHOS and PATHOS (keep LOGOS only)
   - Reduce source count (80 → 20 highest-quality)
   - Simplify learning loop (manual instead of automated)

**Key Principle**: Layer 0 is **additive**. If removed, ARI still functions (just without cognitive enhancements).

---

## Timeline

### Design Phase (6 weeks)
- Week 1-2: ADRs (6 documents)
- Week 2-3: Pillar designs (3 documents)
- Week 3-4: Knowledge source research (80+ sources)
- Week 4-5: Council specialization mapping (15 profiles)
- Week 5: Cognitive API specification
- Week 5-6: Implementation roadmap + testing strategy + QA

### Implementation Phase (16 weeks)
- Week 1-2: Foundation (scaffolding, types, tests)
- Week 3-4: LOGOS prototype (Bayesian + EV)
- Week 5-6: ETHOS implementation (bias, emotion, discipline)
- Week 7-8: PATHOS implementation (reflection, wisdom, meta-learning)
- Week 9-10: Knowledge source integration (80+ sources)
- Week 11-12: Council specialization loading
- Week 13-14: Learning loop
- Week 15-16: Dashboard integration + final testing

**Total**: 22 weeks (5.5 months) from start to full deployment.

**Incremental Value**: After Week 4 of implementation, LOGOS prototype is functional. Can stop there if needed.

---

## Approval Process

### Required Approvals

1. **Council Vote**: SUPERMAJORITY (9 of 15) - major architectural change
2. **Arbiter Review**: Verify no constitutional violations
3. **Overseer Gates**: 
   - Documentation complete ✓
   - Security review passed ✓
   - Performance analysis done ✓
   - Implementation plan clear ✓

### Voting Question

> "Shall ARI adopt a new Layer 0 (Cognitive Foundation) beneath the Kernel, implementing LOGOS/ETHOS/PATHOS pillars to provide algorithmic reasoning, emotional intelligence, and continuous learning frameworks to all Council members?"

**Threshold**: SUPERMAJORITY (>=66%, minimum 9 of 15)

**Expected Vote Breakdown**:
- **Strongly Support** (6): BLOOM, MINT, AEGIS, SCOUT, VERA, NEXUS (directly benefit)
- **Support** (5): ATLAS, TRUE, OPAL, PULSE, PRISM (general benefit)
- **Neutral/Cautious** (3): BOLT, ECHO, TEMPO (implementation overhead concerns)
- **Oppose** (1): Unlikely, but possible if security concerns

**Predicted Outcome**: PASS (11-12 approvals expected)

---

## Success Criteria

### After Design Phase (6 weeks)
- ✅ 6 ADRs published and reviewed
- ✅ 3 Pillar design docs complete (300+ pages total)
- ✅ 80+ knowledge sources researched and documented
- ✅ 15 Council member cognitive profiles defined
- ✅ Complete API specification with examples
- ✅ Implementation roadmap with clear phases
- ✅ Comprehensive testing strategy
- ✅ Council vote passes (SUPERMAJORITY)

### After Implementation Phase (22 weeks total)
- ✅ Layer 0 fully functional
- ✅ All 15 Council members using cognitive APIs
- ✅ Learning loop running automatically
- ✅ 80%+ test coverage achieved
- ✅ Security validation passed (no knowledge poisoning)
- ✅ Performance targets met (<100ms for cognitive APIs)
- ✅ Dashboard shows cognitive layer status
- ✅ Measurable improvement in decision quality

---

## References

- **Existing Architecture**: [`docs/architecture/ARCHITECTURE.md`](../ARCHITECTURE.md)
- **Council Members**: [`src/governance/council-members.ts`](../../src/governance/council-members.ts)
- **Knowledge Infrastructure**: [`src/autonomous/knowledge-sources.ts`](../../src/autonomous/knowledge-sources.ts)
- **EventBus**: [`src/kernel/event-bus.ts`](../../src/kernel/event-bus.ts)
- **Trust Levels**: [`CLAUDE.md`](../../CLAUDE.md) (lines 37-40)

---

## Appendix: Cognitive Framework Examples

### Bayesian Belief Updating (LOGOS)

**Scenario**: SCOUT assessing probability that a new investment will succeed.

**Prior Belief**:
- Hypothesis: "Investment will return >20%"
- Prior probability: 0.30 (30% based on historical data)

**New Evidence**:
- Observation: "Founder has 3 successful exits"
- Likelihood: P(3 exits | success) = 0.80
- Marginal: P(3 exits) = 0.40

**Bayesian Update**:
```
P(success | 3 exits) = P(3 exits | success) × P(success) / P(3 exits)
                     = 0.80 × 0.30 / 0.40
                     = 0.60 (60%)
```

**Result**: Probability updated from 30% → 60% based on evidence.

### Kelly Criterion (LOGOS)

**Scenario**: MINT deciding how much capital to allocate to opportunity.

**Inputs**:
- Win probability: 0.55 (55%)
- Win payoff: 2.0 (2:1, can double money)
- Loss probability: 0.45 (45%)
- Loss payoff: 1.0 (1:1, can lose all allocated)

**Kelly Calculation**:
```
f = (p × b - q) / b
  = (0.55 × 2.0 - 0.45) / 2.0
  = (1.10 - 0.45) / 2.0
  = 0.325 (32.5%)
```

**Recommendation**: Allocate 32.5% of capital (full Kelly) or 16.25% (half Kelly for safety).

### Cognitive Bias Detection (ETHOS)

**Scenario**: MINT considering doubling down on losing investment.

**Reasoning Trace**: "I've already invested $10K. If I invest another $5K, I can average down my cost basis and recover losses when it rebounds."

**Bias Detected**: SUNK_COST_FALLACY (severity: 0.85)
- **Evidence**: "I've already invested" (past investment influencing future decision)
- **Mitigation**: "Past costs are irrelevant. Evaluate the $5K decision independently. Would you make this investment if you had no prior exposure?"

**Outcome**: MINT recalculates expected value of **new** $5K investment (ignoring sunk $10K), makes better decision.

### Reflection and Learning (PATHOS)

**Scenario**: BLOOM analyzing why a learning goal failed.

**Outcome**:
- Goal: "Learn advanced TypeScript in 2 weeks"
- Result: FAILED (only completed 30% of material)

**Reflection API Call**:
```typescript
const insights = await cognition.reflectOnOutcome({
  action: 'Learn advanced TypeScript',
  result: 'failure',
  expectedValue: 100, // hours of learning
  actualValue: 30,
  context: { timeframe: '2 weeks', difficulty: 'advanced' },
});
```

**Insights Extracted**:
1. **Pattern**: "Overambitious timeline" (trying to learn too much too fast)
2. **Mistake**: "Didn't account for existing commitments" (calendar was already full)
3. **Success**: "30 hours is still valuable" (partial failure, not total)
4. **Principle**: "Break learning into smaller milestones" (deliberate practice insight)

**Actionable**:
- Next time: 6-week timeline instead of 2 weeks
- Technique: Spaced repetition (15min daily vs 2h binge)
- Checkpoint: Weekly review to adjust

**Generalizes?**: YES - applies to all skill acquisition, not just TypeScript.

**Stored in Memory**: Future learning goals use this pattern.

---

**Last Updated**: 2026-02-01  
**Status**: PROPOSED  
**Next Step**: Council vote (SUPERMAJORITY threshold)  
**Author**: Pryce Hedrick (Operator) with Claude (ARI Assistant)
