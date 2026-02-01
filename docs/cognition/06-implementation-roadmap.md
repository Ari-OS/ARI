# Cognitive Layer 0: Implementation Roadmap

**Version**: 1.0.0  
**Date**: 2026-02-01  
**Total Timeline**: 16 weeks (4 months)  
**Related**: ADR-009 through ADR-014

---

## Overview

This roadmap breaks Layer 0 implementation into **7 phases** that can be completed incrementally. Each phase delivers value independently (can stop at any point).

**Phase Strategy**:
- **Foundation first** (Week 1-2): Scaffolding, types, patterns
- **LOGOS prototype** (Week 3-4): Prove concept with Bayesian + EV
- **ETHOS** (Week 5-6): Add bias detection and emotional intelligence
- **PATHOS** (Week 7-8): Add reflection and wisdom
- **Knowledge integration** (Week 9-10): Expand from 10 → 87 sources
- **Specializations** (Week 11-12): Load Council member profiles
- **Learning loop** (Week 13-14): Enable continuous improvement
- **Dashboard** (Week 15-16): Visualize in UI

**Success Criteria**: After each phase, system is functional (no broken states).

---

## Phase 0: Foundation (Week 1-2)

### Goals
- Create directory structure
- Define all TypeScript types
- Extend EventBus with cognitive events
- Write test scaffolding
- Document Layer 0 guide

### Deliverables

**1. Directory Structure**
```bash
mkdir -p src/cognition/{logos,ethos,pathos,knowledge,learning}
mkdir -p tests/unit/cognition/{logos,ethos,pathos,knowledge,learning}
mkdir -p tests/integration/cognition
mkdir -p tests/security/cognition
```

**2. Type Definitions** (`src/cognition/types.ts`)
- All Zod schemas for cognitive types
- Belief, Evidence, Decision, Outcome interfaces
- BiasDetection, EmotionalState, Insight interfaces
- Export everything for use across pillars

**3. EventBus Extension** (`src/kernel/event-bus.ts`)
```typescript
// Add to EventMap
export interface EventMap {
  // ... existing events ...
  
  'cognition:query': CognitionQueryEvent;
  'cognition:result': CognitionResultEvent;
  'cognition:belief_updated': BeliefUpdateEvent;
  'cognition:bias_detected': BiasDetectionEvent;
  'cognition:emotional_risk': EmotionalRiskEvent;
  'cognition:reflection_complete': ReflectionEvent;
  'cognition:wisdom_consulted': WisdomEvent;
  'knowledge:source_fetched': SourceFetchEvent;
  'knowledge:validated': ValidationEvent;
  'learning:gap_identified': GapEvent;
  'learning:improvement_measured': ImprovementEvent;
}
```

**4. Test Scaffolding**
- Create test files for every cognitive module
- Write describe blocks (no implementations yet)
- Set up test utilities and mocks

**5. Documentation** (`src/cognition/CLAUDE.md`)
- Layer 0 overview
- How to use cognitive APIs
- Integration patterns
- Examples for each pillar

**Success Criteria**:
- ✅ Directory structure complete
- ✅ `src/cognition/types.ts` compiles with 0 errors
- ✅ EventBus extended, TypeScript passes
- ✅ Test files created (187 → 220+ tests expected)
- ✅ CLAUDE.md written and reviewed

**Timeline**: 1-2 weeks  
**Risk**: Low (just scaffolding)

---

## Phase 1: LOGOS Prototype (Week 3-4)

### Goals
- Implement Bayesian reasoning
- Implement expected value calculation
- Prove concept works
- SCOUT uses LOGOS in risk assessment

### Deliverables

**1. Bayesian Module** (`src/cognition/logos/bayesian.ts`)
```typescript
export async function updateBelief(prior: Belief, evidence: Evidence): Promise<BayesianUpdate>;
export async function calculatePosterior(p_h: number, p_e_given_h: number, p_e: number): Promise<number>;
export async function updateBeliefSequential(belief: Belief, evidenceList: Evidence[]): Promise<BayesianUpdate>;
```

**Tests**:
- Positive evidence increases posterior ✓
- Negative evidence decreases posterior ✓
- Sequential updating works ✓
- Edge cases: P(H) = 0, P(H) = 1 ✓

**2. Expected Value Module** (`src/cognition/logos/expected-value.ts`)
```typescript
export async function calculateExpectedValue(decision: Decision): Promise<ExpectedValueResult>;
export async function rankDecisions(decisions: Decision[]): Promise<RankedDecision[]>;
```

**Tests**:
- Calculates EV correctly ✓
- Handles negative EV ✓
- Probabilities must sum to 1.0 ✓
- Confidence calculation works ✓

**3. Integration** (`src/agents/risk-assessor.ts` - if it exists, or create example)
```typescript
// SCOUT using LOGOS
import { calculateExpectedValue, updateBelief } from '../cognition/logos/index.js';

export class RiskAssessor {
  async assessRisk(scenario: RiskScenario): Promise<RiskAssessment> {
    // Use expected value
    const ev = await calculateExpectedValue({
      description: scenario.description,
      outcomes: scenario.outcomes,
    });
    
    // Use Bayesian updating
    const threatBelief = await updateBelief(
      this.priorThreatProbability,
      scenario.evidence
    );
    
    return {
      expectedValue: ev.expectedValue,
      threatProbability: threatBelief.posteriorProbability,
      recommendation: synthesize(ev, threatBelief),
    };
  }
}
```

**Success Criteria**:
- ✅ Bayesian module: 15+ tests, 90%+ coverage
- ✅ Expected value module: 12+ tests, 90%+ coverage
- ✅ Integration test: SCOUT makes better decisions with LOGOS ✓
- ✅ Performance: API response time <50ms ✓
- ✅ Documentation: JSDoc for all functions ✓

**Timeline**: 2 weeks  
**Risk**: Medium (proving concept - if this fails, reconsider Layer 0)

**Decision Point**: After Phase 1, evaluate:
- Does LOGOS improve decision quality? (measure)
- Is API design good? (developer experience)
- Is performance acceptable? (<50ms)

**If Yes**: Proceed to Phase 2 (ETHOS)  
**If No**: Iterate on LOGOS or abort Layer 0

---

## Phase 2: ETHOS Implementation (Week 5-6)

### Goals
- Implement all 10 cognitive biases
- Implement emotional state monitoring
- Implement fear/greed cycle detection
- Implement discipline systems

### Deliverables

**1. Bias Detector** (`src/cognition/ethos/bias-detector.ts`)
```typescript
export async function detectCognitiveBias(reasoning: string, context: Context): Promise<BiasAnalysis>;

// Individual bias detectors
function detectConfirmationBias(reasoning: string): BiasDetection | null;
function detectSunkCostFallacy(reasoning: string): BiasDetection | null;
function detectRecencyBias(reasoning: string, context: Context): BiasDetection | null;
function detectLossAversion(reasoning: string, decision: Decision): BiasDetection | null;
function detectOverconfidence(reasoning: string): BiasDetection | null;
function detectAnchoring(reasoning: string): BiasDetection | null;
function detectAvailabilityHeuristic(reasoning: string): BiasDetection | null;
function detectHindsightBias(reasoning: string): BiasDetection | null;
function detectGamblersFallacy(reasoning: string): BiasDetection | null;
function detectDunningKruger(reasoning: string, context: Context): BiasDetection | null;
```

**Tests**: Each bias has 5+ test cases (total: 50+ tests)

**2. Emotional State** (`src/cognition/ethos/emotional-state.ts`)
```typescript
export async function checkEmotionalState(agent: string, context: Context): Promise<EmotionalState>;

// Internal functions
function estimateValence(outcomes: Outcome[]): number;
function estimateArousal(outcomes: Outcome[], timing: number): number;
function estimateDominance(outcomes: Outcome[]): number;
function calculateEmotionalRisk(state: EmotionalState): number;
function mapToEmotions(valence: number, arousal: number, dominance: number): EmotionLabel[];
```

**Tests**: 10+ test cases (various emotional states)

**3. Fear/Greed Detector** (`src/cognition/ethos/fear-greed.ts`)
```typescript
export async function detectFearGreedCycle(decisions: Decision[], outcomes: Outcome[]): Promise<FearGreedCycle>;

// Pattern detectors
function detectFearSpiral(decisions: Decision[], outcomes: Outcome[]): FearGreedCycle | null;
function detectGreedChase(decisions: Decision[], outcomes: Outcome[]): FearGreedCycle | null;
function detectRevengeTrading(decisions: Decision[], outcomes: Outcome[]): FearGreedCycle | null;
function detectEuphoria(decisions: Decision[], outcomes: Outcome[]): FearGreedCycle | null;
```

**Tests**: 12+ test cases (each pattern with variations)

**4. Discipline System** (`src/cognition/ethos/discipline.ts`)
```typescript
export async function checkDiscipline(decision: Decision, agent: string, context: DisciplineContext): Promise<DisciplineCheckResult>;

// Category checkers
function checkPhysicalState(context: DisciplineContext): PhysicalCheck;
function checkEmotionalState(agent: string, context: DisciplineContext): EmotionalCheck;
function checkTiming(context: DisciplineContext): TimingCheck;
function checkPreparation(decision: Decision, context: DisciplineContext): PreparationCheck;
function checkMeta(decision: Decision, context: DisciplineContext): MetaCheck;
```

**Tests**: 20+ test cases (various failure modes)

**Success Criteria**:
- ✅ All 10 biases detectable
- ✅ Emotional state assessment works
- ✅ Fear/greed patterns detected
- ✅ Discipline system blocks bad decisions
- ✅ 80%+ test coverage
- ✅ Performance: <100ms for ETHOS APIs

**Timeline**: 2 weeks  
**Risk**: Medium (complexity in pattern matching)

---

## Phase 3: PATHOS Implementation (Week 7-8)

### Deliverables

**1. CBT Reframing** (`src/cognition/pathos/cbt-reframing.ts`)
**2. Reflection Engine** (`src/cognition/pathos/reflection.ts`)
**3. Wisdom Index** (`src/cognition/pathos/wisdom.ts`)
**4. Meta-Learning** (`src/cognition/pathos/meta-learning.ts`)

**Success Criteria**:
- ✅ CBT detects 10 cognitive distortions
- ✅ Reflection extracts insights from outcomes
- ✅ Wisdom consultation works (query → relevant principles)
- ✅ Learning plans generated
- ✅ 80%+ test coverage

**Timeline**: 2 weeks

---

## Phase 4: Knowledge Integration (Week 9-10)

### Goals
- Expand knowledge sources from 10 → 87
- Implement 5-stage validation pipeline
- Integrate with existing knowledge-fetcher

### Deliverables

**1. Source Manager** (`src/cognition/knowledge/source-manager.ts`)
- Extend [`knowledge-sources.ts`](../../src/autonomous/knowledge-sources.ts) with 77 new sources
- Add pillar, councilMembers, frameworks fields

**2. Content Validator** (`src/cognition/knowledge/content-validator.ts`)
- Stage 1: Whitelist check
- Stage 2: Sanitization (injection + cognitive patterns)
- Stage 3: Bias detection
- Stage 4: Fact checking
- Stage 5: Human review queue (UNTRUSTED)

**Success Criteria**:
- ✅ 87 sources in KNOWLEDGE_SOURCES
- ✅ Daily knowledge fetch runs successfully
- ✅ Validation pipeline: >95% pass rate for VERIFIED sources
- ✅ Zero security incidents in testing

**Timeline**: 2 weeks

---

## Phase 5: Council Specializations (Week 11-12)

### Goals
- Load cognitive profiles for all 15 members
- Each member can query their specialized knowledge
- Consultation patterns work

### Deliverables

**1. Specializations** (`src/cognition/knowledge/specializations.ts`)
- Define all 15 cognitive profiles
- Map members to frameworks and sources
- Load on Council init

**2. Council Enhancement** (extend [`council-members.ts`](../../src/governance/council-members.ts))
```typescript
export interface CouncilMember {
  // ... existing fields ...
  
  cognitiveProfile?: {
    pillarWeights: { logos: number; ethos: number; pathos: number };
    frameworks: string[];
    expertise: string[];
    consultationRole: string;
  };
}
```

**Success Criteria**:
- ✅ All 15 members have loaded profiles
- ✅ Members can query specialized knowledge
- ✅ Consultation patterns work (member A asks member B for expertise)

**Timeline**: 2 weeks

---

## Phase 6: Learning Loop (Week 13-14)

### Goals
- Implement 5-stage learning loop
- Integrate with scheduler
- Enable continuous improvement

### Deliverables

**1. Performance Review** (`src/cognition/learning/performance-review.ts`)
**2. Gap Analysis** (`src/cognition/learning/gap-analysis.ts`)
**3. Self-Assessment** (`src/cognition/learning/self-assessment.ts`)

**Scheduler Integration**:
```typescript
// Add to scheduler.ts tasks
{
  id: 'performance_review',
  name: 'Daily Performance Review',
  cron: '0 21 * * *', // 9 PM daily
  handler: 'performance_review',
  enabled: true,
},
{
  id: 'gap_analysis',
  name: 'Weekly Gap Analysis',
  cron: '0 20 * * 0', // Sunday 8 PM
  handler: 'gap_analysis',
  enabled: true,
},
{
  id: 'self_assessment',
  name: 'Monthly Self-Assessment',
  cron: '0 9 1 * *', // 1st of month, 9 AM
  handler: 'self_assessment',
  enabled: true,
},
```

**Success Criteria**:
- ✅ Performance reviews run daily
- ✅ Gap analysis runs weekly
- ✅ Self-assessment runs monthly
- ✅ Reports generated and stored
- ✅ Operator notifications work

**Timeline**: 2 weeks

---

## Phase 7: Dashboard Integration (Week 15-16)

### Goals
- Add Cognition page to dashboard
- Visualize pillars, specializations, learning progress

### Deliverables

**1. API Endpoints** (`src/api/routes.ts`)
```typescript
GET /api/cognition/health
GET /api/cognition/pillars
GET /api/cognition/council-profiles
GET /api/cognition/learning/performance
GET /api/cognition/learning/gaps
GET /api/cognition/learning/assessment
```

**2. Dashboard Page** (`dashboard/src/pages/Cognition.tsx`)
- Health score for each pillar
- Council specialization visualization
- Learning progress charts
- Knowledge source status

**Success Criteria**:
- ✅ Cognition page renders
- ✅ Real-time data via WebSocket
- ✅ Charts show learning progress
- ✅ Accessible and responsive

**Timeline**: 2 weeks

---

## Timeline Summary

| Phase | Weeks | Deliverables | Risk | Can Stop Here? |
|-------|-------|--------------|------|----------------|
| 0. Foundation | 1-2 | Scaffolding, types, docs | Low | No (nothing functional) |
| 1. LOGOS Prototype | 3-4 | Bayesian + EV working | Medium | ✅ Yes (LOGOS functional) |
| 2. ETHOS | 5-6 | Bias detection, emotion | Medium | ✅ Yes (LOGOS + ETHOS functional) |
| 3. PATHOS | 7-8 | Reflection, wisdom | Low | ✅ Yes (All 3 pillars functional) |
| 4. Knowledge | 9-10 | 87 sources integrated | Medium | ✅ Yes (Fully functional) |
| 5. Specializations | 11-12 | Council profiles loaded | Low | ✅ Yes (Enhanced Council) |
| 6. Learning Loop | 13-14 | Continuous improvement | Low | ✅ Yes (Self-improving) |
| 7. Dashboard | 15-16 | Visualization | Low | ✅ Yes (Complete) |

**Total**: 16 weeks to full deployment  
**Minimum Viable**: 4 weeks (Phase 0 + Phase 1 LOGOS prototype)

---

**Last Updated**: 2026-02-01  
**Status**: Design Complete  
**Next**: Begin Phase 0 after Council vote approval
