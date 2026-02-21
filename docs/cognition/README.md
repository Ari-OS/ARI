# ARI Cognitive Layer 0: LOGOS / ETHOS / PATHOS

**Version**: 1.0.0  
**Status**: Design Phase Complete (Awaiting Council Vote)  
**Date**: 2026-02-01

> **The mind behind the machine** - Foundational consciousness layer providing algorithmic reasoning, emotional intelligence, and continuous learning to all of ARI.

---

## What is Layer 0?

Layer 0 (Cognitive Foundation) is a **new architectural layer** beneath the Kernel that provides universal cognitive frameworks:

- **LOGOS (Reason)**: Bayesian reasoning, expected value, Kelly Criterion, decision trees, systems thinking
- **ETHOS (Character)**: Bias detection, emotional regulation, discipline, trading psychology
- **PATHOS (Growth)**: CBT/DBT/ACT, Stoicism, deliberate practice, meta-learning, wisdom traditions

**Result**: Every Council member becomes **cognitively enhanced** - making decisions backed by probability theory, aware of biases, and continuously learning.

---

## Quick Navigation

### Architectural Decisions (ADRs)

1. **[ADR-009: Cognitive Layer Architecture](../architecture/adr/ADR-009-cognitive-layer-architecture.md)** - Why Layer 0, positioning, integration
2. **[ADR-010: Three-Pillar Framework](../architecture/adr/ADR-010-three-pillar-framework.md)** - LOGOS/ETHOS/PATHOS structure
3. **[ADR-011: Knowledge Source Trust](../architecture/adr/ADR-011-knowledge-source-trust.md)** - 4-tier trust model, 5-stage validation
4. **[ADR-012: Council Specializations](../architecture/adr/ADR-012-council-cognitive-specializations.md)** - Mapping members to frameworks
5. **[ADR-013: Cognitive API Design](../architecture/adr/ADR-013-cognitive-api-design.md)** - API patterns, response formats
6. **[ADR-014: Learning Loop](../architecture/adr/ADR-014-learning-loop-mechanism.md)** - 5-stage continuous improvement

### Pillar Designs

1. **[LOGOS Pillar](01-LOGOS-reason-pillar.md)** (35+ pages) - Bayesian, EV, Kelly, systems thinking, Taleb
2. **[ETHOS Pillar](02-ETHOS-character-pillar.md)** (30+ pages) - Trading psych, biases, emotion, discipline
3. **[PATHOS Pillar](03-PATHOS-growth-pillar.md)** (35+ pages) - CBT/DBT/ACT, Stoicism, meta-learning, wisdom

### Supporting Documentation

1. **[Council Cognitive Profiles](04-council-cognitive-profiles.md)** - All 15 members' specializations
2. **[Implementation Roadmap](06-implementation-roadmap.md)** - 7 phases, 16 weeks
3. **[Testing Strategy](07-testing-strategy.md)** - 265+ tests, coverage targets
4. **[Knowledge Sources Catalog](08-knowledge-sources-catalog.md)** - 87 curated sources

---

## Key Concepts

### Three Pillars

**LOGOS** (λόγος) - Reason:

- Algorithmic decision-making under uncertainty
- Frameworks: Bayesian, Expected Value, Kelly Criterion
- Primary users: SCOUT, MINT, ATLAS, TRUE

**ETHOS** (ἦθος) - Character:

- Emotional intelligence and bias mitigation
- Frameworks: Trading psychology, bias detection, discipline
- Primary users: AEGIS, MINT, EMBER, SCOUT

**PATHOS** (πάθος) - Growth:

- Self-reflection, learning, and wisdom
- Frameworks: CBT/DBT/ACT, Stoicism, deliberate practice
- Primary users: BLOOM, PULSE, VERA, PRISM

### Integration with Existing Architecture

```
Layer 6: INTERFACES     (CLI, Dashboard)
Layer 5: EXECUTION      (Daemon)
Layer 4: STRATEGIC      (Council, Arbiter, Overseer)
Layer 3: CORE AGENTS    (Core, Guardian, Planner, Executor)
Layer 2: SYSTEM         (Router, Storage)
Layer 1: KERNEL         (Gateway, Sanitizer, Audit, EventBus)
Layer 0: COGNITIVE      ← NEW (LOGOS + ETHOS + PATHOS)
         ↑
    Knowledge Streams (87 curated sources)
```

**Key**: Higher layers can import from Layer 0, Layer 0 is self-contained.

---

## Quick Start (After Implementation)

### Using Cognitive APIs

```typescript
// Import specific functions
import { calculateExpectedValue } from './cognition/logos/expected-value.js';
import { detectCognitiveBias } from './cognition/ethos/bias-detector.js';
import { reflectOnOutcome } from './cognition/pathos/reflection.js';

// Calculate EV
const ev = await calculateExpectedValue({
  description: 'Should I invest?',
  outcomes: [
    { description: 'Success', probability: 0.60, value: 1000, confidence: 0.80 },
    { description: 'Failure', probability: 0.40, value: -500, confidence: 0.80 },
  ],
});
// Returns: { expectedValue: 400, recommendation: 'proceed', ... }

// Check for biases
const biases = await detectCognitiveBias(
  'I should invest because I read one positive article',
  { agent: 'MINT' }
);
// Returns: [{ bias: 'CONFIRMATION_BIAS', severity: 0.70, ... }]

// Reflect on outcome
const reflection = await reflectOnOutcome({
  action: 'Invested $1000',
  result: 'success',
  expectedValue: 400,
  actualValue: 600,
  timestamp: new Date().toISOString(),
});
// Returns: { insights: [...], principles: [...], nextActions: [...] }
```

---

## Status

**Design Phase**: ✅ Complete (6 ADRs + 3 pillar designs + 6 supporting docs = ~350 pages)  
**Implementation Phase**: ⏳ Pending (awaits Council vote)  
**Estimated Timeline**: 16 weeks (4 months) for full deployment  
**Minimum Viable**: 4 weeks (LOGOS prototype only)

---

## Next Steps

1. **Council Vote**: Requires SUPERMAJORITY (9 of 15 members)
2. **If Approved**: Begin Phase 0 (Foundation, 2 weeks)
3. **Prototype**: Phase 1 (LOGOS, 2 weeks)
4. **Evaluate**: Does LOGOS improve decisions? Measure and decide whether to continue.
5. **Full Build**: Phases 2-7 (12 weeks)

---

## Questions?

- **Architecture**: See [ADR-009](../architecture/adr/ADR-009-cognitive-layer-architecture.md)
- **Security**: See [ADR-011](../architecture/adr/ADR-011-knowledge-source-trust.md)
- **Implementation**: See [Roadmap](06-implementation-roadmap.md)
- **Testing**: See [Testing Strategy](07-testing-strategy.md)

---

**Last Updated**: 2026-02-01  
**Documentation Complete**: ✅ All 21 deliverables finished  
**Ready for**: Council vote → Implementation
