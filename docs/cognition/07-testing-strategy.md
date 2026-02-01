# Testing Strategy for Cognitive Layer 0

**Version**: 1.0.0  
**Date**: 2026-02-01  
**Target Coverage**: 80%+ overall, 100% for security paths  
**Framework**: Vitest (following ADR-007)

---

## Coverage Requirements

**By Pillar**:
- **LOGOS**: 90%+ (mathematical correctness is critical)
- **ETHOS**: 85%+ (bias detection must be reliable)
- **PATHOS**: 80%+ (reflective, less deterministic)
- **Knowledge**: 100% (security-critical)
- **Learning**: 80%+ (measurement and analysis)

---

## Test Categories

### Unit Tests (220+ tests)

**LOGOS** (`tests/unit/cognition/logos/`):
- `bayesian.test.ts` - 20 tests (belief updating, edge cases)
- `expected-value.test.ts` - 15 tests (EV calculation, ranking)
- `kelly.test.ts` - 18 tests (position sizing, edge cases, warnings)
- `decision-trees.test.ts` - 12 tests (tree traversal, backward induction)
- `systems-thinking.test.ts` - 10 tests (leverage points, feedback loops)
- `antifragility.test.ts` - 8 tests (fragility classification)

**ETHOS** (`tests/unit/cognition/ethos/`):
- `bias-detector.test.ts` - 50 tests (5 per bias × 10 biases)
- `emotional-state.test.ts` - 12 tests (valence/arousal/dominance)
- `fear-greed.test.ts` - 16 tests (4 patterns × 4 tests each)
- `discipline.test.ts` - 25 tests (5 categories × 5 tests each)

**PATHOS** (`tests/unit/cognition/pathos/`):
- `cbt-reframing.test.ts` - 20 tests (10 distortions × 2 each)
- `reflection.test.ts` - 15 tests (insight extraction)
- `wisdom.test.ts` - 10 tests (query, relevance)
- `meta-learning.test.ts` - 12 tests (learning plans)

**Total Unit Tests**: ~220 tests

---

### Integration Tests (30+ tests)

**Council-Cognitive Integration** (`tests/integration/cognition/`):
- `scout-uses-logos.test.ts` - SCOUT calculates EV and Kelly
- `aegis-uses-ethos.test.ts` - AEGIS detects biases in threat assessment
- `mint-uses-all-three.test.ts` - MINT combines LOGOS + ETHOS + PATHOS
- `pulse-uses-pathos.test.ts` - PULSE applies CBT reframing
- `bloom-uses-meta-learning.test.ts` - BLOOM creates practice plans

**Knowledge Pipeline** (`tests/integration/cognition/`):
- `fetch-validate-index.test.ts` - Full pipeline (source → validation → index)
- `specialization-loading.test.ts` - Council members load their knowledge

**Learning Loop** (`tests/integration/cognition/`):
- `performance-review-e2e.test.ts` - Daily review end-to-end
- `gap-analysis-e2e.test.ts` - Weekly gap analysis
- `self-assessment-e2e.test.ts` - Monthly assessment

---

### Security Tests (15+ tests) - 100% Coverage Required

**Knowledge Injection** (`tests/security/cognition/`):
- `inject-via-source.test.ts` - Attempt prompt injection via knowledge content
- `cognitive-poisoning.test.ts` - Introduce biased frameworks
- `misinformation.test.ts` - False facts detection

**Validation Pipeline** (`tests/security/cognition/`):
- `sanitization-bypass.test.ts` - Try to bypass sanitizer
- `trust-escalation.test.ts` - UNTRUSTED trying to become VERIFIED
- `source-substitution.test.ts` - Malicious source pretending to be legitimate

---

**Last Updated**: 2026-02-01  
**Total Tests**: 265+ (current: 2651 → projected: 2900+)  
**Estimated Testing Time**: 3-4 days per phase
