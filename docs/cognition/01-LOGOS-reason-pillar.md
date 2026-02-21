# LOGOS Pillar: The Reason Engine

**Version**: 1.0.0  
**Status**: Design Documentation  
**Date**: 2026-02-01  
**Related ADRs**: ADR-009, ADR-010, ADR-013

---

## Table of Contents

1. [Philosophy & Purpose](#philosophy--purpose)
2. [Framework Catalog](#framework-catalog)
3. [Bayesian Reasoning](#1-bayesian-reasoning)
4. [Expected Value Theory](#2-expected-value-theory)
5. [Kelly Criterion](#3-kelly-criterion)
6. [Decision Tree Analysis](#4-decision-tree-analysis)
7. [Systems Thinking](#5-systems-thinking)
8. [Antifragility (Taleb)](#6-antifragility-taleb)
9. [Knowledge Sources](#knowledge-sources)
10. [Implementation Guide](#implementation-guide)
11. [Testing Strategy](#testing-strategy)
12. [Council Integration](#council-integration)

---

## Philosophy & Purpose

### The Core Thesis

> **"Reality is probabilistic, not deterministic. Think in bets, not certainties."**

LOGOS (λόγος) - Greek for "reason", "word", "logic" - represents the **rational mind** that uses mathematics and probability theory to navigate uncertainty.

### Why Algorithmic Reasoning?

Life is full of decisions under uncertainty:

- "Should I take this job?" (uncertain outcome)
- "Should I invest in this?" (uncertain return)
- "Should I start this project?" (uncertain success)

**Naive Approach**: Binary thinking ("yes" or "no" without nuance)

**LOGOS Approach**: Probabilistic thinking:

- "60% chance this job works out well, 40% it doesn't"
- "Expected value is +$12K, so yes despite uncertainty"
- "Kelly Criterion says allocate 20% of time/resources"

**Result**: Better decisions under uncertainty.

### The Six Frameworks

LOGOS provides six interconnected reasoning frameworks:

1. **Bayesian Reasoning** - Update beliefs based on evidence
2. **Expected Value** - Calculate probability-weighted outcomes
3. **Kelly Criterion** - Optimize resource allocation
4. **Decision Trees** - Analyze sequential decisions
5. **Systems Thinking** - Understand complexity and feedback loops
6. **Antifragility** - Build resilience and optionality (Taleb)

**Together**: Complete toolkit for rational decision-making under uncertainty.

---

## Framework Catalog

### Quick Reference

| Framework | Primary Use | Mathematical? | Council Members |
|-----------|-------------|---------------|-----------------|
| **Bayesian** | Update probabilities with evidence | ✅ Yes | AEGIS, SCOUT, ATLAS, TRUE |
| **Expected Value** | Compare decision alternatives | ✅ Yes | ALL (universal) |
| **Kelly Criterion** | Optimal position sizing | ✅ Yes | MINT, SCOUT, OPAL, BLOOM |
| **Decision Trees** | Sequential decision analysis | ✅ Yes | TRUE, ATLAS, BLOOM |
| **Systems Thinking** | Understand complexity, feedback | ⚠️ Semi | ATLAS, NEXUS, TEMPO |
| **Antifragility** | Build resilience, optionality | ⚠️ Semi | AEGIS, SCOUT, MINT, VERA |

### When to Use Which Framework

**Decision Type**: Investment ($10K)

- **Use**: Expected Value (compare alternatives), Kelly Criterion (sizing), Bayesian (update win probability)

**Decision Type**: Career change

- **Use**: Decision Tree (sequential choices), Expected Value (compare paths), Systems Thinking (how will this affect life system?)

**Decision Type**: Health intervention

- **Use**: Expected Value (cost/benefit), Bayesian (update belief as evidence comes in)

**Decision Type**: Strategic planning

- **Use**: Decision Tree (sequence of actions), Systems Thinking (leverage points), Antifragility (robustness)

**Decision Type**: Risk assessment

- **Use**: Bayesian (threat probability), Expected Value (cost of breach), Kelly (security budget allocation)

---

## 1. Bayesian Reasoning

### The Fundamental Insight

**Bayes' Theorem** (Thomas Bayes, 1763):

> Update your beliefs based on evidence. Strong evidence shifts beliefs significantly, weak evidence shifts them slightly.

**Formula**:

```
P(H|E) = P(E|H) × P(H) / P(E)

Where:
  H = Hypothesis (the belief we're updating)
  E = Evidence (new observation)
  P(H) = Prior probability (what we believed before evidence)
  P(E|H) = Likelihood (how probable is evidence if hypothesis is true)
  P(E) = Marginal probability (how probable is evidence overall)
  P(H|E) = Posterior probability (updated belief after evidence)
```

### Conceptual Example

**Scenario**: SCOUT assessing if new business will succeed.

**Prior Belief**:

- P(Success) = 0.30 (30% based on industry statistics)

**New Evidence**:

- "Founder has 3 successful exits"

**Likelihood**:

- P(3 exits | Success) = 0.80 (80% of successful businesses have experienced founders)
- P(3 exits | Failure) = 0.20 (20% of failed businesses still had experienced founders)

**Marginal Probability**:

```
P(3 exits) = P(3 exits | Success) × P(Success) + P(3 exits | Failure) × P(Failure)
           = 0.80 × 0.30 + 0.20 × 0.70
           = 0.24 + 0.14
           = 0.38
```

**Posterior**:

```
P(Success | 3 exits) = P(3 exits | Success) × P(Success) / P(3 exits)
                     = 0.80 × 0.30 / 0.38
                     = 0.24 / 0.38
                     = 0.632 (63.2%)
```

**Result**: Belief updated from 30% → 63.2% based on evidence.

**Interpretation**: Experienced founder is **strong positive evidence** (doubled our confidence).

---

### Implementation Specification

**File**: `src/cognition/logos/bayesian.ts`

```typescript
import { z } from 'zod';
import type { EventBus } from '../../kernel/event-bus.js';

// ── Schemas ────────────────────────────────────────────────────

export const EvidenceSchema = z.object({
  observation: z.string().min(1).max(1000),
  likelihood: z.number().min(0).max(1),          // P(E|H)
  strength: z.number().min(0).max(1),            // How strong is evidence?
  source: z.string(),
  trust: z.enum(['system', 'operator', 'verified', 'standard', 'untrusted', 'hostile']),
  observedAt: z.string().datetime(),
});

export const BeliefSchema = z.object({
  hypothesis: z.string().min(1).max(500),
  priorProbability: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema),
  posteriorProbability: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  updatedAt: z.string().datetime(),
  provenance: z.object({
    sources: z.array(z.string()),
    reasoning: z.array(z.string()),
  }),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type Belief = z.infer<typeof BeliefSchema>;

// ── Core Function ──────────────────────────────────────────────

export interface BayesianUpdate {
  belief: Belief;
  priorProbability: number;
  posteriorProbability: number;
  shift: number;                              // Posterior - prior
  confidence: number;
  reasoning: string[];
  provenance: {
    framework: 'Bayesian Reasoning (Bayes\' Theorem, 1763)';
    formula: string;
    computedAt: Date;
    sources: string[];
  };
}

/**
 * Update belief using Bayes' Theorem
 * 
 * Calculates posterior probability P(H|E) given prior P(H) and evidence E.
 * 
 * @param prior - Current belief
 * @param evidence - New observation
 * @param marginalProbability - Optional P(E); if not provided, estimated
 * @returns Updated belief with explanation
 * 
 * @example
 * const updated = await updateBelief(
 *   {
 *     hypothesis: 'Investment will return >20%',
 *     priorProbability: 0.30,
 *     evidence: [],
 *     posteriorProbability: 0.30,
 *     confidence: 0.50,
 *   },
 *   {
 *     observation: 'Founder has 3 successful exits',
 *     likelihood: 0.80,
 *     strength: 0.85,
 *     source: 'LinkedIn verification',
 *     trust: 'verified',
 *   }
 * );
 * // Returns: { posteriorProbability: 0.632, shift: +0.332, ... }
 */
export async function updateBelief(
  prior: Belief,
  evidence: Evidence,
  marginalProbability?: number
): Promise<BayesianUpdate> {
  // Validate inputs
  const validatedEvidence = EvidenceSchema.parse(evidence);
  const validatedBelief = BeliefSchema.parse(prior);
  
  // Extract values
  const priorProb = validatedBelief.priorProbability;
  const likelihood = validatedEvidence.likelihood;
  
  // Calculate marginal P(E) if not provided
  const marginal = marginalProbability ?? estimateMarginalProbability(
    prior,
    evidence
  );
  
  // Bayes' Theorem: P(H|E) = P(E|H) × P(H) / P(E)
  const posterior = (likelihood * priorProb) / marginal;
  
  // Adjust confidence based on evidence strength and source trust
  const trustMultiplier = getTrustMultiplier(validatedEvidence.trust);
  const confidenceAdjustment = validatedEvidence.strength * trustMultiplier;
  const newConfidence = Math.min(
    validatedBelief.confidence + confidenceAdjustment * 0.1,
    0.99 // Never 100% certain
  );
  
  // Build updated belief
  const updatedBelief: Belief = {
    ...validatedBelief,
    evidence: [...validatedBelief.evidence, validatedEvidence],
    posteriorProbability: posterior,
    priorProbability: priorProb, // Store for history
    confidence: newConfidence,
    updatedAt: new Date().toISOString(),
    provenance: {
      sources: [
        ...validatedBelief.provenance.sources,
        validatedEvidence.source,
      ],
      reasoning: [
        ...validatedBelief.provenance.reasoning,
        `Bayesian update: P(H|E) = ${likelihood} × ${priorProb} / ${marginal} = ${posterior}`,
      ],
    },
  };
  
  // Emit event
  eventBus.emit('cognition:belief_updated', {
    hypothesis: validatedBelief.hypothesis,
    priorProbability: priorProb,
    posteriorProbability: posterior,
    shift: posterior - priorProb,
    agent: evidence.source,
  });
  
  return {
    belief: updatedBelief,
    priorProbability: priorProb,
    posteriorProbability: posterior,
    shift: posterior - priorProb,
    confidence: newConfidence,
    reasoning: buildReasoning(priorProb, likelihood, marginal, posterior, evidence),
    provenance: {
      framework: 'Bayesian Reasoning (Bayes\' Theorem, 1763)',
      formula: `P(H|E) = P(E|H) × P(H) / P(E) = ${likelihood} × ${priorProb} / ${marginal}`,
      computedAt: new Date(),
      sources: [
        'Bayes, Thomas (1763). An Essay towards solving a Problem in the Doctrine of Chances',
        'Modern Bayesian statistics literature',
      ],
    },
  };
}

// ── Helper Functions ───────────────────────────────────────────

function estimateMarginalProbability(
  prior: Belief,
  evidence: Evidence
): number {
  // P(E) = P(E|H)×P(H) + P(E|¬H)×P(¬H)
  const priorProb = prior.priorProbability;
  const likelihood = evidence.likelihood;
  
  // Estimate P(E|¬H) - probability of evidence if hypothesis is FALSE
  // Conservative estimate: If hypothesis were false, evidence is less likely
  // but not impossible (assume 30% as likely as if hypothesis were true)
  const likelihoodGivenNot = likelihood * 0.30;
  
  const marginal = 
    (likelihood * priorProb) + 
    (likelihoodGivenNot * (1 - priorProb));
  
  return marginal;
}

function getTrustMultiplier(trust: TrustLevel): number {
  const multipliers = {
    system: 1.0,
    operator: 0.9,
    verified: 0.85,
    standard: 0.70,
    untrusted: 0.40,
    hostile: 0.0,
  };
  return multipliers[trust];
}

function buildReasoning(
  prior: number,
  likelihood: number,
  marginal: number,
  posterior: number,
  evidence: Evidence
): string[] {
  return [
    `Prior belief: ${(prior * 100).toFixed(1)}% probability`,
    `New evidence: "${evidence.observation}" (source: ${evidence.source}, trust: ${evidence.trust})`,
    `Likelihood P(E|H): ${(likelihood * 100).toFixed(1)}% (if hypothesis true, evidence has this probability)`,
    `Marginal P(E): ${(marginal * 100).toFixed(1)}% (overall probability of seeing this evidence)`,
    `Bayes calculation: (${likelihood} × ${prior}) / ${marginal} = ${posterior.toFixed(3)}`,
    `Posterior belief: ${(posterior * 100).toFixed(1)}% probability`,
    `Shift: ${posterior > prior ? '+' : ''}${((posterior - prior) * 100).toFixed(1)}% (${posterior > prior ? 'increased confidence' : 'decreased confidence'})`,
  ];
}
```

---

### Advanced: Sequential Bayesian Updating

**Multiple Evidence**: Update belief with evidence 1, then evidence 2, then evidence 3...

**Implementation**:

```typescript
export async function updateBeliefSequential(
  initialBelief: Belief,
  evidenceList: Evidence[]
): Promise<BayesianUpdate> {
  let currentBelief = initialBelief;
  
  for (const evidence of evidenceList) {
    const update = await updateBelief(currentBelief, evidence);
    currentBelief = update.belief;
  }
  
  return {
    belief: currentBelief,
    priorProbability: initialBelief.priorProbability,
    posteriorProbability: currentBelief.posteriorProbability,
    shift: currentBelief.posteriorProbability - initialBelief.priorProbability,
    confidence: currentBelief.confidence,
    reasoning: currentBelief.provenance.reasoning,
    provenance: {
      framework: 'Sequential Bayesian Updating',
      formula: `Applied Bayes' Theorem ${evidenceList.length} times sequentially`,
      computedAt: new Date(),
      sources: ['Bayesian statistics'],
    },
  };
}
```

**Example**:

```
Initial: "50% chance project succeeds"

Evidence 1: "Team has relevant experience" → 65% (↑15%)
Evidence 2: "Budget is tight" → 52% (↓13%)
Evidence 3: "Stakeholder buy-in is strong" → 68% (↑16%)

Final: "68% chance project succeeds" (net: +18% from initial)
```

---

### Bayesian Use Cases in ARI

#### Use Case 1: Threat Assessment (AEGIS)

**Scenario**: Incoming message has suspicious patterns. How likely is it malicious?

**Prior**:

```typescript
const prior: Belief = {
  hypothesis: 'This message is a prompt injection attack',
  priorProbability: 0.10, // Base rate: 10% of messages are attacks
  evidence: [],
  posteriorProbability: 0.10,
  confidence: 0.60,
  updatedAt: new Date().toISOString(),
  provenance: { sources: ['Historical attack rate'], reasoning: [] },
};
```

**Evidence 1**: Message contains "ignore previous instructions"

```typescript
const evidence1: Evidence = {
  observation: 'Contains "ignore previous instructions"',
  likelihood: 0.95, // 95% of attacks contain this phrase
  strength: 0.90,   // Very strong signal
  source: 'Sanitizer pattern match',
  trust: 'system',
  observedAt: new Date().toISOString(),
};

const update1 = await updateBelief(prior, evidence1);
// Posterior: ~70% (strong evidence → high confidence it's an attack)
```

**Evidence 2**: Message trust level is "untrusted"

```typescript
const evidence2: Evidence = {
  observation: 'Source trust level is UNTRUSTED',
  likelihood: 0.80, // 80% of attacks come from untrusted sources
  strength: 0.70,
  source: 'Trust level check',
  trust: 'system',
  observedAt: new Date().toISOString(),
};

const update2 = await updateBelief(update1.belief, evidence2);
// Posterior: ~88% (two pieces of evidence compound)
```

**Decision**: 88% probability of attack → Block message, log security event.

---

#### Use Case 2: Investment Probability (MINT)

**Scenario**: Evaluating if investment will return >20% in 1 year.

**Prior**:

```
P(Return > 20%) = 0.25 (base rate for this asset class)
```

**Sequential Evidence**:

1. "Company revenue grew 40% last year" → Update to 0.38
2. "Market sentiment is negative" → Update to 0.29
3. "Insider buying increased" → Update to 0.42
4. "Competitor launched rival product" → Update to 0.33

**Final Belief**: 33% chance of >20% return

**Decision with Expected Value**:

```
EV = 0.33 × ($20K) + 0.67 × (-$10K) = $6.6K - $6.7K = -$100 (negative EV)
Recommendation: AVOID (despite some positive signals, EV is negative)
```

---

### Mathematical Properties

**Property 1: Conservation of Probability**

```
P(H|E) + P(¬H|E) = 1
```

If belief in H increases, belief in ¬H decreases proportionally.

**Property 2: Strong Evidence Dominates Prior**

If likelihood is extreme (0.99 or 0.01), posterior is mostly determined by evidence:

```
Prior: 0.10
Likelihood: 0.99 (very strong evidence)
Posterior: ~0.92 (jumps to high confidence)
```

**Property 3: Weak Evidence Barely Shifts Belief**

If likelihood is near marginal (0.50), posterior stays close to prior:

```
Prior: 0.50
Likelihood: 0.55 (weak evidence)
Posterior: ~0.52 (barely moves)
```

**Benefit**: Bayesian reasoning **calibrates** belief shifts to evidence strength automatically.

---

### Knowledge Sources for Bayesian Reasoning

**Primary Sources** (VERIFIED):

1. **Stanford Introduction to Probability and Statistics**
   - URL: <https://online.stanford.edu/courses/gse-ystatslearning-statistical-learning>
   - Content: Bayesian inference, posterior calculation, applications
   - Update: Annually (course is stable)

2. **arXiv stat.ME (Methodology)**
   - URL: <https://arxiv.org/list/stat.ME/recent>
   - Content: Recent Bayesian methodology papers
   - Update: Daily

3. **Arbital Bayes Guide**
   - URL: <https://arbital.com/p/bayes_rule/>
   - Content: Intuitive Bayes explanations with visualizations
   - Update: Monthly (stable resource)

4. **LessWrong: Eliezer Yudkowsky on Bayesian Reasoning**
   - URL: <https://www.lesswrong.com/tag/bayesian>
   - Content: Practical Bayesian thinking (VERIFIED author only)
   - Update: Weekly

**Supplementary Sources** (STANDARD):

1. **3Blue1Brown: Bayes Theorem Visualization** (YouTube)
   - URL: <https://www.youtube.com/watch?v=HZGCoVF3YvM>
   - Content: Visual intuition for Bayes
   - Update: One-time (video)

2. **Bayesian Methods for Hackers**
   - URL: <https://camdavidsonpilon.github.io/Probabilistic-Programming-and-Bayesian-Methods-for-Hackers/>
   - Content: Practical Bayesian programming
   - Update: Annually

---

### Testing Strategy

**File**: `tests/unit/cognition/logos/bayesian.test.ts`

```typescript
describe('updateBelief', () => {
  it('should increase posterior when positive evidence', async () => {
    const prior: Belief = {
      hypothesis: 'Test',
      priorProbability: 0.30,
      evidence: [],
      posteriorProbability: 0.30,
      confidence: 0.60,
      updatedAt: new Date().toISOString(),
      provenance: { sources: [], reasoning: [] },
    };
    
    const evidence: Evidence = {
      observation: 'Positive signal',
      likelihood: 0.80, // Strong evidence for hypothesis
      strength: 0.90,
      source: 'test',
      trust: 'verified',
      observedAt: new Date().toISOString(),
    };
    
    const result = await updateBelief(prior, evidence);
    
    expect(result.posteriorProbability).toBeGreaterThan(0.30);
    expect(result.shift).toBeGreaterThan(0);
    expect(result.reasoning.length).toBeGreaterThan(5);
  });
  
  it('should decrease posterior when negative evidence', async () => {
    const prior: Belief = {
      hypothesis: 'Test',
      priorProbability: 0.70,
      evidence: [],
      posteriorProbability: 0.70,
      confidence: 0.60,
      updatedAt: new Date().toISOString(),
      provenance: { sources: [], reasoning: [] },
    };
    
    const evidence: Evidence = {
      observation: 'Negative signal',
      likelihood: 0.20, // Weak evidence for hypothesis (strong against)
      strength: 0.90,
      source: 'test',
      trust: 'verified',
      observedAt: new Date().toISOString(),
    };
    
    const result = await updateBelief(prior, evidence);
    
    expect(result.posteriorProbability).toBeLessThan(0.70);
    expect(result.shift).toBeLessThan(0);
  });
  
  it('should handle edge case: prior = 0', async () => {
    const prior: Belief = {
      hypothesis: 'Impossible event',
      priorProbability: 0.0,
      // ... other fields
    };
    
    const evidence: Evidence = {
      likelihood: 0.90, // Even strong evidence
      // ... other fields
    };
    
    const result = await updateBelief(prior, evidence);
    
    expect(result.posteriorProbability).toBe(0); // Can't update from 0 (need non-zero prior)
  });
  
  it('should handle edge case: prior = 1', async () => {
    const prior: Belief = {
      hypothesis: 'Certain event',
      priorProbability: 1.0,
      // ...
    };
    
    const evidence: Evidence = {
      likelihood: 0.50, // Contradicting evidence
      // ...
    };
    
    const result = await updateBelief(prior, evidence);
    
    expect(result.posteriorProbability).toBeLessThan(1.0); // Should decrease from certainty
  });
});
```

---

## 2. Expected Value Theory

### The Fundamental Insight

**Expected Value** (Daniel Bernoulli, 1738):

> The value of a risky decision is the sum of all possible outcomes, each weighted by its probability.

**Formula**:

```
EV = Σ (P_i × V_i) for all outcomes i

Where:
  P_i = Probability of outcome i
  V_i = Value of outcome i
  Σ P_i = 1.0 (probabilities must sum to 1)
```

**Interpretation**:

- EV > 0: Positive expected value → Take the decision
- EV = 0: Neutral → Indifferent
- EV < 0: Negative expected value → Avoid the decision

**Key Insight**: You can make decisions with **uncertain outcomes** by calculating the **average outcome** across all possibilities.

---

### Conceptual Example

**Scenario**: Should BLOOM take an online course?

**Outcomes**:

1. **Love it, complete it, apply learnings**:
   - Probability: 0.40 (40%)
   - Value: +100 (career boost, new skills)

2. **Complete it, but don't apply**:
   - Probability: 0.30 (30%)
   - Value: +20 (certificate, but no practical benefit)

3. **Start but don't finish**:
   - Probability: 0.20 (20%)
   - Value: -10 (wasted time, no certificate)

4. **Never start (procrastinate)**:
   - Probability: 0.10 (10%)
   - Value: -5 (wasted money on enrollment)

**Calculation**:

```
EV = (0.40 × 100) + (0.30 × 20) + (0.20 × -10) + (0.10 × -5)
   = 40 + 6 - 2 - 0.5
   = 43.5
```

**Interpretation**: **Positive EV (+43.5)** → Take the course. Even accounting for risk of not finishing, the expected outcome is positive.

**Comparison**: If not taking course:

```
EV(don't take) = 1.0 × 0 = 0
```

**Decision**: EV(take course) = 43.5 > EV(don't take) = 0 → **Take the course**.

---

### Implementation Specification

**File**: `src/cognition/logos/expected-value.ts`

```typescript
import { z } from 'zod';
import type { EventBus } from '../../kernel/event-bus.js';

// ── Schemas ────────────────────────────────────────────────────

export const OutcomeSchema = z.object({
  description: z.string().min(1).max(500),
  probability: z.number().min(0).max(1),
  value: z.number(),                          // Can be negative (losses)
  confidence: z.number().min(0).max(1),       // How sure are we?
});

export const DecisionSchema = z.object({
  description: z.string().min(1).max(1000),
  outcomes: z.array(OutcomeSchema).min(2),    // At least 2 outcomes
  constraints: z.array(z.string()).optional(),
  context: z.record(z.unknown()).optional(),
});

export type Outcome = z.infer<typeof OutcomeSchema>;
export type Decision = z.infer<typeof DecisionSchema>;

// ── Core Function ──────────────────────────────────────────────

export interface ExpectedValueResult {
  expectedValue: number;
  confidence: number;
  variance: number;                           // Spread of outcomes
  standardDeviation: number;
  recommendation: 'proceed' | 'avoid' | 'neutral' | 'insufficient_data';
  alternatives: string[];
  reasoning: string[];
  sensitivity: {
    mostCriticalOutcome: Outcome;
    breakEvenProbability: number | null;
  };
  provenance: {
    framework: 'Expected Value Theory (Bernoulli, 1738)';
    formula: string;
    computedAt: Date;
    sources: string[];
  };
}

/**
 * Calculate expected value of a decision
 * 
 * EV = Σ (P_i × V_i) for all outcomes
 * 
 * @param decision - Decision with 2+ outcomes (probabilities must sum to 1.0)
 * @returns EV with confidence, recommendation, and sensitivity analysis
 * 
 * @throws {CognitiveError} If probabilities don't sum to 1.0 or inputs invalid
 * 
 * @example
 * const result = await calculateExpectedValue({
 *   description: 'Should I apply for this job?',
 *   outcomes: [
 *     { description: 'Get offer, love it', probability: 0.15, value: 100, confidence: 0.80 },
 *     { description: 'Get offer, hate it', probability: 0.05, value: -30, confidence: 0.80 },
 *     { description: 'Rejected', probability: 0.80, value: -5, confidence: 0.90 },
 *   ],
 * });
 * // Returns: { expectedValue: 10, recommendation: 'proceed', ... }
 */
export async function calculateExpectedValue(
  decision: Decision
): Promise<ExpectedValueResult> {
  // Validate input
  const validated = DecisionSchema.parse(decision);
  
  // Check probabilities sum to 1.0 (within tolerance)
  const probSum = validated.outcomes.reduce((sum, o) => sum + o.probability, 0);
  if (Math.abs(probSum - 1.0) > 0.01) {
    throw new CognitiveError(
      'INVALID_INPUT',
      `Probabilities must sum to 1.0 (got ${probSum.toFixed(3)})`,
      { actualSum: probSum, outcomes: validated.outcomes }
    );
  }
  
  // Calculate EV
  const ev = validated.outcomes.reduce(
    (sum, outcome) => sum + (outcome.probability * outcome.value),
    0
  );
  
  // Calculate variance (spread of outcomes)
  const variance = validated.outcomes.reduce(
    (sum, outcome) => sum + (outcome.probability * Math.pow(outcome.value - ev, 2)),
    0
  );
  
  const stdDev = Math.sqrt(variance);
  
  // Calculate confidence (weighted by outcome confidences)
  const overallConfidence = validated.outcomes.reduce(
    (sum, o) => sum + (o.probability * o.confidence),
    0
  );
  
  // Determine recommendation
  const recommendation = determineRecommendation(ev, overallConfidence, stdDev);
  
  // Sensitivity analysis: Which outcome's probability matters most?
  const mostCritical = findMostCriticalOutcome(validated.outcomes, ev);
  
  // Break-even: At what probability does EV = 0?
  const breakEven = calculateBreakEven(validated.outcomes);
  
  // Generate reasoning
  const reasoning = buildEVReasoning(validated.outcomes, ev, variance, recommendation);
  
  // Emit event
  eventBus.emit('cognition:query', {
    api: 'calculateExpectedValue',
    pillar: 'LOGOS',
    agent: decision.context?.agent as string || 'unknown',
    query: { description: decision.description },
    timestamp: new Date().toISOString(),
  });
  
  return {
    expectedValue: ev,
    confidence: overallConfidence,
    variance,
    standardDeviation: stdDev,
    recommendation,
    alternatives: generateAlternatives(decision, ev),
    reasoning,
    sensitivity: {
      mostCriticalOutcome: mostCritical,
      breakEvenProbability: breakEven,
    },
    provenance: {
      framework: 'Expected Value Theory (Bernoulli, 1738)',
      formula: `EV = Σ(P_i × V_i) = ${validated.outcomes.map(o => `(${o.probability} × ${o.value})`).join(' + ')}`,
      computedAt: new Date(),
      sources: [
        'Bernoulli, Daniel (1738). Specimen Theoriae Novae de Mensura Sortis',
        'Modern decision theory literature',
      ],
    },
  };
}

// ── Helper Functions ───────────────────────────────────────────

function determineRecommendation(
  ev: number,
  confidence: number,
  stdDev: number
): 'proceed' | 'avoid' | 'neutral' | 'insufficient_data' {
  // Insufficient data
  if (confidence < 0.50) {
    return 'insufficient_data';
  }
  
  // Clear positive EV
  if (ev > 0 && confidence >= 0.70) {
    return 'proceed';
  }
  
  // Clear negative EV
  if (ev < 0 && confidence >= 0.70) {
    return 'avoid';
  }
  
  // High uncertainty (high variance)
  if (stdDev > Math.abs(ev) * 2) {
    return 'neutral'; // Too uncertain to recommend
  }
  
  // Marginal cases
  if (ev > 0) return 'proceed';
  if (ev < 0) return 'avoid';
  return 'neutral';
}

function findMostCriticalOutcome(
  outcomes: Outcome[],
  currentEV: number
): Outcome {
  // Most critical = largest impact on EV if probability changes
  // Impact = |value - EV| × probability
  const impacts = outcomes.map(o => ({
    outcome: o,
    impact: Math.abs(o.value - currentEV) * o.probability,
  }));
  
  impacts.sort((a, b) => b.impact - a.impact);
  return impacts[0].outcome;
}

function calculateBreakEven(outcomes: Outcome[]): number | null {
  // For two-outcome decision, find probability where EV = 0
  if (outcomes.length !== 2) return null; // Break-even only defined for binary decisions
  
  const [outcome1, outcome2] = outcomes;
  
  // EV = p × V1 + (1-p) × V2 = 0
  // Solve for p:
  // p × V1 + V2 - p × V2 = 0
  // p(V1 - V2) = -V2
  // p = -V2 / (V1 - V2)
  
  const breakEven = -outcome2.value / (outcome1.value - outcome2.value);
  
  return (breakEven >= 0 && breakEven <= 1) ? breakEven : null;
}
```

---

## 3. Kelly Criterion

### The Fundamental Insight

**Kelly Criterion** (John Kelly, 1956):

> The optimal fraction of capital to bet is determined by your edge (win probability) and the odds.

**Formula**:

```
f* = (p × b - q) / b

Where:
  f* = Fraction of capital to bet (0 to 1)
  p = Probability of winning
  q = Probability of losing (1 - p)
  b = Odds received (payoff ratio: e.g., 2.0 means can double money)
```

**Interpretation**:

- f* > 0: Positive edge → Bet this fraction
- f* = 0: No edge → Don't bet
- f* < 0: Negative edge → Opposite bet (or avoid entirely)

**Key Properties**:

1. **Maximizes long-term growth** (geometric mean of capital)
2. **Never risks ruin** (never bets more than optimal)
3. **Adapts to edge** (bigger edge → bigger bet)

**Practical Modification**: Use **half-Kelly** (f*/2) for safety. Full Kelly is aggressive and has high variance.

---

### Worked Example: Investment Decision

**Scenario**: MINT considering investment.

**Parameters**:

- Investment cost: $5,000
- If successful: Get back $12,000 (profit: $7,000)
- Win probability: 0.60 (60%)
- Loss probability: 0.40 (40%)
- Current capital: $20,000

**Payoff Ratio**:

```
b = profit / loss = $7,000 / $5,000 = 1.4
```

**Kelly Calculation**:

```
f* = (p × b - q) / b
   = (0.60 × 1.4 - 0.40) / 1.4
   = (0.84 - 0.40) / 1.4
   = 0.44 / 1.4
   = 0.314 (31.4%)
```

**Recommendations**:

- **Full Kelly**: Bet 31.4% of capital = $6,280
- **Half Kelly**: Bet 15.7% of capital = $3,140 ✅ **Recommended**
- **Quarter Kelly**: Bet 7.85% of capital = $1,570 (very conservative)

**Decision**: Invest **$3,140** (half-Kelly) for safety.

**Why Not Full Kelly?**

- Full Kelly assumes probabilities are **exactly** correct
- In reality, probabilities are **estimates** (could be wrong)
- Half-Kelly provides **insurance** against estimation error
- Reduces variance (smoother equity curve)

---

### Edge Cases & Warnings

**Case 1: No Edge (p × b = q)**

```
p = 0.50, b = 1.0 (even odds)
f* = (0.50 × 1.0 - 0.50) / 1.0 = 0

Recommendation: Don't bet (no advantage)
```

**Case 2: Negative Edge (p × b < q)**

```
p = 0.40, b = 1.0
f* = (0.40 × 1.0 - 0.60) / 1.0 = -0.20

Recommendation: Don't bet (negative edge means expected loss)
```

**Case 3: Small Edge (f* < 0.05)**

```
p = 0.51, b = 1.0
f* = (0.51 × 1.0 - 0.49) / 1.0 = 0.02 (2%)

Recommendation: Edge is tiny. Only bet if probabilities are highly confident.
```

**Case 4: Huge Edge (f* > 0.50)**

```
p = 0.90, b = 2.0 (great odds)
f* = (0.90 × 2.0 - 0.10) / 2.0 = 0.85 (85%)

Warning: This is VERY aggressive. Double-check probabilities.
Are you REALLY 90% confident? Use half-Kelly: 42.5%
```

---

### Implementation Specification

**File**: `src/cognition/logos/kelly.ts`

```typescript
import { z } from 'zod';

export const KellyInputSchema = z.object({
  winProbability: z.number().min(0).max(1),
  winPayoff: z.number().positive(),           // Must be positive (ratio)
  lossProbability: z.number().min(0).max(1),
  lossPayoff: z.number().positive(),          // Must be positive (ratio)
  currentCapital: z.number().positive(),
});

export type KellyInput = z.infer<typeof KellyInputSchema>;

export interface KellyResult {
  fullKelly: number;                          // Optimal fraction 0-1
  halfKelly: number;                          // Conservative (recommended)
  quarterKelly: number;                       // Very conservative
  recommendedDollar: number;                  // Dollar amount (half-Kelly)
  expectedGrowthRate: number;                 // Geometric mean growth
  riskOfRuin: number;                         // Probability of losing everything
  recommendation: string;
  reasoning: string[];
  warnings: string[];
  provenance: {
    framework: 'Kelly Criterion (Kelly, 1956)';
    formula: string;
    computedAt: Date;
    sources: string[];
  };
}

/**
 * Calculate optimal position size using Kelly Criterion
 * 
 * Formula: f* = (p × b - q) / b
 * 
 * @param input - Win/loss probabilities and payoffs
 * @returns Kelly fractions with recommendations
 * 
 * @example
 * const kelly = await calculateKellyFraction({
 *   winProbability: 0.60,
 *   winPayoff: 2.0,
 *   lossProbability: 0.40,
 *   lossPayoff: 1.0,
 *   currentCapital: 10000,
 * });
 * // Returns: { fullKelly: 0.40, halfKelly: 0.20, recommendedDollar: 2000, ... }
 */
export async function calculateKellyFraction(
  input: KellyInput
): Promise<KellyResult> {
  const validated = KellyInputSchema.parse(input);
  
  // Verify probabilities sum to 1.0
  const probSum = validated.winProbability + validated.lossProbability;
  if (Math.abs(probSum - 1.0) > 0.01) {
    throw new CognitiveError(
      'INVALID_INPUT',
      `Win and loss probabilities must sum to 1.0 (got ${probSum.toFixed(3)})`,
      { winProb: validated.winProbability, lossProb: validated.lossProbability }
    );
  }
  
  const p = validated.winProbability;
  const q = validated.lossProbability;
  const b = validated.winPayoff / validated.lossPayoff;
  
  // Kelly formula
  const fullKelly = (p * b - q) / b;
  
  // Variants
  const halfKelly = fullKelly / 2;
  const quarterKelly = fullKelly / 4;
  
  // Dollar amount (half-Kelly recommended)
  const recommendedDollar = halfKelly * validated.currentCapital;
  
  // Expected growth rate (geometric mean)
  const expectedGrowth = calculateExpectedGrowth(p, q, b, halfKelly);
  
  // Risk of ruin (Monte Carlo estimate)
  const riskOfRuin = estimateRiskOfRuin(p, q, b, halfKelly);
  
  // Generate warnings
  const warnings = generateKellyWarnings(fullKelly, p, b);
  
  // Recommendation
  const recommendation = generateKellyRecommendation(fullKelly, halfKelly, warnings);
  
  // Reasoning
  const reasoning = buildKellyReasoning(p, q, b, fullKelly, halfKelly, expectedGrowth);
  
  return {
    fullKelly: Math.max(0, fullKelly), // Can't be negative (means no edge)
    halfKelly: Math.max(0, halfKelly),
    quarterKelly: Math.max(0, quarterKelly),
    recommendedDollar,
    expectedGrowthRate: expectedGrowth,
    riskOfRuin,
    recommendation,
    reasoning,
    warnings,
    provenance: {
      framework: 'Kelly Criterion (Kelly, 1956)',
      formula: `f* = (p × b - q) / b = (${p} × ${b} - ${q}) / ${b}`,
      computedAt: new Date(),
      sources: [
        'Kelly, J.L. (1956). A New Interpretation of Information Rate',
        'Thorp, Edward O. - Beat the Dealer (Kelly applications)',
        'Fortune\'s Formula by William Poundstone',
      ],
    },
  };
}

function generateKellyWarnings(fullKelly: number, p: number, b: number): string[] {
  const warnings: string[] = [];
  
  if (fullKelly > 0.50) {
    warnings.push('⚠️ Full Kelly > 50% is VERY aggressive. Are you CERTAIN about these probabilities?');
  }
  
  if (fullKelly > 0.30) {
    warnings.push('⚠️ Full Kelly > 30%. Recommend using half-Kelly (more conservative).');
  }
  
  if (fullKelly < 0) {
    warnings.push('🛑 Negative Kelly = no edge. This is a bad bet. Expected loss.');
  }
  
  if (fullKelly < 0.05 && fullKelly > 0) {
    warnings.push('⚠️ Kelly < 5% = tiny edge. Only bet if very confident in probabilities.');
  }
  
  if (p > 0.80 && b > 2.0) {
    warnings.push('⚠️ High win probability AND high payoff seems too good. Double-check assumptions.');
  }
  
  return warnings;
}

function generateKellyRecommendation(
  fullKelly: number,
  halfKelly: number,
  warnings: string[]
): string {
  if (fullKelly <= 0) {
    return 'AVOID - Negative or zero edge. This bet has negative expected value.';
  }
  
  if (fullKelly > 0.50) {
    return `USE HALF-KELLY (${(halfKelly * 100).toFixed(1)}%) - Full Kelly is too aggressive. Verify probabilities first.`;
  }
  
  if (fullKelly > 0.30) {
    return `USE HALF-KELLY (${(halfKelly * 100).toFixed(1)}%) - Recommended for safety. Full Kelly (${(fullKelly * 100).toFixed(1)}%) is aggressive.`;
  }
  
  if (fullKelly > 0.10) {
    return `USE HALF-KELLY (${(halfKelly * 100).toFixed(1)}%) - Moderate edge. Half-Kelly provides good safety margin.`;
  }
  
  // Small edge
  return `PROCEED WITH CAUTION - Edge is small (${(fullKelly * 100).toFixed(1)}%). Use quarter-Kelly or smaller.`;
}

function estimateRiskOfRuin(
  p: number,
  q: number,
  b: number,
  fraction: number
): number {
  // Simplified risk of ruin estimate (not full Monte Carlo)
  // For more accurate: Use Monte Carlo simulation (10,000+ iterations)
  
  // If using fractional Kelly (< full), risk of ruin approaches 0
  if (fraction < 0.25) return 0.001; // ~0.1%
  if (fraction < 0.50) return 0.01;  // ~1%
  
  // Full Kelly: Higher risk
  // Approximate: RoR ≈ (1 - edge)^N where edge = p × b - q, N = bets
  const edge = p * b - q;
  if (edge <= 0) return 1.0; // No edge = certain ruin eventually
  
  return Math.max(0.05, 1 - Math.pow(edge, 10)); // Rough estimate
}
```

---

### Kelly in Practice: Van Tharp's Contribution

**Van Tharp** (Trade Your Way to Financial Freedom) extended Kelly with **expectancy**:

**Expectancy Formula**:

```
Expectancy = (Win% × AvgWin) - (Loss% × AvgLoss)
```

**Example**:

```
Trading system:
  Win%: 60%
  AvgWin: $600
  Loss%: 40%
  AvgLoss: $400

Expectancy = (0.60 × $600) - (0.40 × $400)
           = $360 - $160
           = $200 per trade

Interpretation: On average, each trade makes $200.
```

**R-Multiples**: Normalize outcomes to risk taken.

```
If you risk $100 to make $300:
  Win: +3R (3× risk)
  Loss: -1R (1× risk)

Expectancy in R-multiples = (Win% × AvgR_win) - (Loss% × AvgR_loss)
                          = (0.60 × 3R) - (0.40 × 1R)
                          = 1.8R - 0.4R
                          = 1.4R per trade
```

**Connection to Kelly**: Expectancy > 0 means positive edge (Kelly will be > 0).

---

### Knowledge Sources for Kelly Criterion

**Primary Sources** (VERIFIED):

1. **Fortune's Formula by William Poundstone**
   - History of Kelly Criterion
   - Ed Thorp's applications (blackjack, stock market)
   - Claude Shannon's contributions

2. **Ed Thorp - Beat the Dealer**
   - Original Kelly application to gambling
   - Position sizing strategies

3. **Van Tharp - Trade Your Way to Financial Freedom**
   - Expectancy framework
   - Position sizing psychology
   - R-multiples

4. **Academic Papers on Kelly**
   - arXiv q-fin (Quantitative Finance)
   - Journal of Portfolio Management

**Supplementary Sources** (STANDARD):

1. **Quantitative Finance Blogs**
   - Quantocracy (curated quant blog aggregator)
   - Alpha Architect (evidence-based investing)

---

## 4. Decision Tree Analysis

### The Fundamental Insight

**Decision Trees** (Operations Research):

> Break complex sequential decisions into a tree structure. Solve backwards (from end to beginning) to find the optimal path.

**Structure**:

```
                    Root Decision
                   /      |      \
              Option A  Option B  Option C
                /           |          \
           Outcome A1   Outcome B1   Outcome C1
           (terminal)   (terminal)   (terminal)
```

**Solving Method**: **Backward Induction**

1. Start at terminal nodes (end of tree)
2. For each decision node, calculate EV of each option
3. Choose option with highest EV
4. Work backward to root
5. Optimal path = sequence of highest-EV choices

---

### Worked Example: Career Decision

**Scenario**: TRUE helping Operator decide between career paths.

**Tree**:

```
                     Career Decision
                    /               \
            Stay Current Job     Take New Job
                 /                      \
        [Terminal: +60]           Try for Promotion?
                                    /           \
                              Apply          Don't Apply
                              /                    \
                        Get Promoted           [Terminal: +75]
                        /        \
              [Terminal: +100]  [Terminal: +50]
```

**Values** (utility on 0-100 scale):

- Stay current job: 60 (safe, known quantity)
- Take new job, don't seek promotion: 75 (good, but plateau)
- Take new job, get promoted: 100 (excellent)
- Take new job, promotion rejected: 50 (frustrating)

**Probabilities**:

- P(Get promoted | Apply) = 0.40 (40%)

**Backward Induction**:

Step 1: Calculate EV of "Try for promotion?" node:

```
EV(Apply for promotion) = 0.40 × 100 + 0.60 × 50 = 40 + 30 = 70
EV(Don't apply) = 1.0 × 75 = 75

Choose: DON'T APPLY (EV 75 > 70)
```

Step 2: Calculate EV of root:

```
EV(Stay) = 60
EV(Take new job) = 75 (we chose "don't apply" branch)

Choose: TAKE NEW JOB (EV 75 > 60)
```

**Optimal Path**: ["Take new job", "Don't apply for promotion"] = EV of 75

**Insight**: Even though getting promoted has highest value (100), the **probability is too low** (40%). The **safe path** (take job, don't push for promotion) has higher **expected value** (75 vs 70).

---

### Implementation Specification

**File**: `src/cognition/logos/decision-trees.ts`

```typescript
export interface DecisionNode {
  id: string;
  question: string;
  options: DecisionOption[];
  depth: number;
  isTerminal: boolean;
}

export interface DecisionOption {
  choice: string;
  probability: number;                        // Prob of this option (if chance node)
  expectedValue?: number;                     // If terminal node
  nextNode?: DecisionNode;                    // If decision continues
}

export interface DecisionTreeResult {
  optimalPath: string[];
  expectedValue: number;
  confidence: number;
  alternatives: Array<{
    path: string[];
    expectedValue: number;
    differenceFromOptimal: number;
  }>;
  reasoning: string[];
  visualization: string;                      // ASCII tree
  sensitivity: {
    criticalProbabilities: Array<{
      node: string;
      option: string;
      currentProb: number;
      breakEvenProb: number;
    }>;
  };
  provenance: {
    framework: 'Decision Tree Analysis (Backward Induction)';
    algorithm: string;
    computedAt: Date;
  };
}

/**
 * Analyze decision tree using backward induction
 * 
 * @param root - Root node of decision tree
 * @returns Optimal path and expected value
 */
export async function analyzeDecisionTree(
  root: DecisionNode
): Promise<DecisionTreeResult> {
  // 1. Traverse tree, find all terminal nodes
  const nodes = traverseTree(root);
  const terminals = nodes.filter(n => n.isTerminal);
  
  // 2. Backward induction: Start from terminals, work to root
  const evMap = new Map<string, number>();
  const pathMap = new Map<string, string[]>();
  
  for (const terminal of terminals) {
    evMap.set(terminal.id, getTerminalValue(terminal));
    pathMap.set(terminal.id, [terminal.options[0]?.choice || 'terminal']);
  }
  
  // 3. Work backward through decision nodes
  const decisionNodes = nodes.filter(n => !n.isTerminal).reverse(); // Bottom-up
  
  for (const node of decisionNodes) {
    let bestEV = -Infinity;
    let bestPath: string[] = [];
    
    for (const option of node.options) {
      if (option.nextNode) {
        const nextEV = evMap.get(option.nextNode.id) || 0;
        const optionEV = option.probability * nextEV;
        
        if (optionEV > bestEV) {
          bestEV = optionEV;
          bestPath = [option.choice, ...pathMap.get(option.nextNode.id) || []];
        }
      } else if (option.expectedValue !== undefined) {
        // Terminal option
        if (option.expectedValue > bestEV) {
          bestEV = option.expectedValue;
          bestPath = [option.choice];
        }
      }
    }
    
    evMap.set(node.id, bestEV);
    pathMap.set(node.id, bestPath);
  }
  
  // 4. Extract optimal path (from root)
  const optimalPath = pathMap.get(root.id) || [];
  const expectedValue = evMap.get(root.id) || 0;
  
  // 5. Find alternative paths
  const alternatives = findAlternativePaths(root, evMap, pathMap, optimalPath);
  
  // 6. Sensitivity analysis
  const sensitivity = analyzeSensitivity(root, evMap);
  
  // 7. Visualize tree
  const visualization = visualizeTree(root, pathMap.get(root.id));
  
  return {
    optimalPath,
    expectedValue,
    confidence: calculateTreeConfidence(root),
    alternatives,
    reasoning: buildTreeReasoning(root, optimalPath, expectedValue),
    visualization,
    sensitivity,
    provenance: {
      framework: 'Decision Tree Analysis (Backward Induction)',
      algorithm: 'Backward induction with expected value maximization',
      computedAt: new Date(),
    },
  };
}
```

---

## 5. Systems Thinking

### The Fundamental Insight

**Donella Meadows** (Thinking in Systems, 2008):

> Systems are more than the sum of their parts. Understanding feedback loops and leverage points allows effective intervention.

**Core Concepts**:

1. **Stocks and Flows**:
   - **Stock**: Amount in system (bank account, skills, energy)
   - **Flow**: Rate of change (income/expenses, learning rate, rest/exertion)

2. **Feedback Loops**:
   - **Reinforcing**: More → Even more (exponential growth/decay)
   - **Balancing**: More → Pushback → Equilibrium

3. **Leverage Points**: Places to intervene in systems (12 levels, from weak to strong)

4. **Emergence**: System behavior that arises from interactions (not predictable from components alone)

---

### The 12 Leverage Points (Meadows)

**In ascending order of effectiveness** (12 = weakest, 1 = strongest):

**12. Constants, Parameters** (Numbers):

- Example: Tax rates, minimum wage, speed limits
- Effectiveness: **Low** (changing numbers rarely fixes systems)
- "Tweaking parameters is like rearranging deck chairs on Titanic"

**11. Buffers** (Stocks relative to flows):

- Example: Savings buffer, inventory, emergency fund
- Effectiveness: **Low-Medium** (important for stability, but doesn't change system dynamics)

**10. Stock-and-Flow Structures**:

- Example: Physical infrastructure, organizational hierarchies
- Effectiveness: **Medium** (hard to change, but structural impact when changed)

**9. Delays** (Relative to rate of system change):

- Example: Lag between action and consequence
- Effectiveness: **Medium** (reducing delays improves feedback quality)

**8. Balancing Feedback Loops**:

- Example: Thermostat (temperature rises → cooling activates → temperature falls)
- Effectiveness: **Medium-High** (stabilizes systems)

**7. Reinforcing Feedback Loops**:

- Example: Compound interest, skill improvement, network effects
- Effectiveness: **High** (exponential growth/decay)

**6. Information Flows**:

- Example: Making information visible (prices, scores, metrics)
- Effectiveness: **High** (people change behavior when they see consequences)

**5. Rules of the System**:

- Example: Laws, incentives, constitutions
- Effectiveness: **High** (changes behavior at scale)

**4. Power to Self-Organize**:

- Example: Evolution, market economies, immune systems
- Effectiveness: **Very High** (systems that adapt survive and thrive)

**3. Goals of the System**:

- Example: Company mission, personal values, national objectives
- Effectiveness: **Very High** (everything else serves the goal)

**2. Paradigms** (Mindset from which goals arise):

- Example: Worldviews, shared assumptions, cultural beliefs
- Effectiveness: **Extremely High** (paradigm shifts change everything)

**1. Power to Transcend Paradigms**:

- Example: Ability to step outside current paradigm and choose another
- Effectiveness: **HIGHEST** (meta-level - can change paradigms themselves)

**Key Insight**: Most interventions target #9-12 (low leverage). **High-leverage interventions** target #1-6 (goals, paradigms, rules, information).

---

### Practical Example: Health System

**System**: Personal health and fitness

**Components** (stocks):

- Energy level
- Body weight
- Fitness level
- Stress level

**Flows**:

- Energy: Sleep (inflow), exertion (outflow)
- Weight: Calories in (inflow), calories out (outflow)
- Fitness: Exercise (inflow), detraining (outflow)
- Stress: Stressors (inflow), recovery (outflow)

**Feedback Loops**:

**Reinforcing Loop 1** (Fitness spiral):

```
More exercise → Higher fitness → More energy → More exercise → Even higher fitness
(Virtuous cycle)
```

**Reinforcing Loop 2** (Stress spiral):

```
High stress → Poor sleep → Lower energy → Can't exercise → More stress → Even worse sleep
(Vicious cycle)
```

**Balancing Loop** (Homeostasis):

```
Eat more → Weight increases → Feel heavier → Eat less → Weight decreases
```

**Leverage Points Analysis**:

**Low Leverage** (#12): "Eat 100 fewer calories per day" (parameter tweak)

- Effectiveness: Low (easy to compensate, doesn't change system)

**Medium Leverage** (#8): "Get 8 hours sleep consistently" (balancing loop - stabilizes energy)

- Effectiveness: Medium (helps, but doesn't address root cause)

**High Leverage** (#6): "Track calories daily" (information flow - make hidden visible)

- Effectiveness: High (awareness changes behavior)

**Very High Leverage** (#5): "No eating after 8 PM" (rule)

- Effectiveness: Very High (simple rule, major impact)

**Highest Leverage** (#3): "Goal: Long-term health, not short-term weight loss" (goal shift)

- Effectiveness: Extremely High (changes entire approach - sustainable vs crash dieting)

**Meta Leverage** (#1): "Realize health is about systems, not willpower" (paradigm shift)

- Effectiveness: HIGHEST (once you see health as system, you optimize differently)

**Recommendation**: Don't focus on calories (#12). Focus on sleep (#8), tracking (#6), rules (#5), and goal clarity (#3).

---

### Implementation Specification

**File**: `src/cognition/logos/systems-thinking.ts`

```typescript
export interface SystemComponent {
  name: string;
  type: 'stock' | 'flow' | 'feedback';
  currentValue?: number;
  connections: string[];          // Connected component names
}

export interface FeedbackLoop {
  type: 'reinforcing' | 'balancing';
  components: string[];
  strength: number;               // 0-1
  polarity: 'positive' | 'negative';
  description: string;
}

export interface LeveragePoint {
  description: string;
  meadowsLevel: number;           // 1-12
  effectiveness: number;          // 0-1 (based on Meadows level)
  difficulty: number;             // 0-1 (how hard to change?)
  priority: number;               // effectiveness / difficulty
  recommendations: string[];
  examples: string[];
}

/**
 * Identify leverage points in a system (Donella Meadows' framework)
 * 
 * @param system - System components, flows, and feedback loops
 * @returns Leverage points ranked by effectiveness
 */
export async function identifyLeveragePoints(
  system: {
    components: SystemComponent[];
    feedbackLoops: FeedbackLoop[];
    goals?: string[];
    rules?: string[];
  }
): Promise<{
  leveragePoints: LeveragePoint[];
  highestLeverage: LeveragePoint;
  easiestToChange: LeveragePoint;
  bestROI: LeveragePoint;         // Highest priority (effectiveness/difficulty)
  recommendation: string;
  reasoning: string[];
  provenance: {
    framework: 'Donella Meadows Leverage Points (12 levels)';
    source: string;
    computedAt: Date;
  };
}> {
  const leveragePoints: LeveragePoint[] = [];
  
  // Analyze what leverage points exist in this system
  
  // Level 12-10: Parameters and structures
  const parameterPoints = identifyParameterLeveragePoints(system);
  leveragePoints.push(...parameterPoints);
  
  // Level 9: Delays
  const delayPoints = identifyDelays(system);
  leveragePoints.push(...delayPoints);
  
  // Level 8-7: Feedback loops
  const feedbackPoints = analyzeFeedbackLoops(system.feedbackLoops);
  leveragePoints.push(...feedbackPoints);
  
  // Level 6: Information flows
  const informationPoints = identifyInformationGaps(system);
  leveragePoints.push(...informationPoints);
  
  // Level 5: Rules
  if (system.rules) {
    const rulePoints = analyzeRules(system.rules);
    leveragePoints.push(...rulePoints);
  }
  
  // Level 3: Goals
  if (system.goals) {
    const goalPoints = analyzeGoals(system.goals);
    leveragePoints.push(...goalPoints);
  }
  
  // Level 2-1: Paradigms (hard to auto-detect, flag for human consideration)
  leveragePoints.push({
    description: 'Paradigm examination: What assumptions underlie this system?',
    meadowsLevel: 2,
    effectiveness: 0.95,
    difficulty: 0.90,
    priority: 1.06,
    recommendations: ['Question fundamental assumptions', 'Consider alternative paradigms'],
    examples: ['Health = system, not willpower', 'Wealth = assets, not income'],
  });
  
  // Sort by effectiveness
  leveragePoints.sort((a, b) => b.effectiveness - a.effectiveness);
  
  const highestLeverage = leveragePoints[0];
  const easiest = leveragePoints.reduce((min, lp) => 
    lp.difficulty < min.difficulty ? lp : min
  );
  const bestROI = leveragePoints.reduce((max, lp) =>
    lp.priority > max.priority ? lp : max
  );
  
  return {
    leveragePoints,
    highestLeverage,
    easiestToChange: easiest,
    bestROI,
    recommendation: generateSystemRecommendation(highestLeverage, bestROI),
    reasoning: buildSystemReasoning(leveragePoints),
    provenance: {
      framework: 'Donella Meadows Leverage Points (12 levels)',
      source: 'Meadows, Donella (2008). Thinking in Systems',
      computedAt: new Date(),
    },
  };
}
```

---

## 6. Antifragility (Taleb)

### The Fundamental Insight

**Nassim Taleb** (Antifragile, 2012):

> Some things benefit from shocks; they thrive and grow when exposed to volatility, randomness, disorder, and stressors. Antifragility is beyond resilience or robustness. The resilient resists shocks and stays the same; the antifragile gets better.

**Three Categories**:

1. **Fragile**: Breaks under stress
   - Examples: Glass, centralized systems, single income source
   - Characteristic: Downside >> upside (breaks easily, gains little)

2. **Robust**: Resists stress
   - Examples: Rock, diversified portfolio, multiple skills
   - Characteristic: Downside ≈ upside (neither breaks nor improves)

3. **Antifragile**: Gains from stress
   - Examples: Muscles (grow from stress), immune system, evolution
   - Characteristic: Upside >> downside (limited loss, unlimited gain)

**Goal**: Build **antifragile** systems that **improve** from volatility.

---

### Core Concepts

#### 1. Optionality (Asymmetric Payoff)

**Formula**:

```
Antifragility = Upside potential - Downside risk

Ideal: Capped downside, unlimited upside
```

**Example**:

```
Fragile: Betting entire net worth on one investment
  Downside: Lose everything (-100%)
  Upside: Limited (maybe +100%)
  Payoff: Symmetric (bad)

Antifragile: Portfolio with 90% safe bonds, 10% high-risk ventures
  Downside: Can only lose 10% maximum
  Upside: If venture succeeds, could 10x or 100x
  Payoff: Asymmetric (good - capped loss, unlimited gain)
```

**Implementation**: **Barbell Strategy**

- 90% in extremely safe (treasury bonds, cash, stable job)
- 10% in extremely risky (startups, volatile assets, side projects)
- Avoid middle (moderately risky = worst of both worlds)

---

#### 2. Via Negativa (Subtraction > Addition)

**Principle**: Removing bad > adding good.

**Examples**:

**Fragile Approach**: "What should I add to my diet to be healthy?"

- Adding supplements, superfoods, vitamins
- More complexity, more to manage

**Antifragile Approach**: "What should I remove from my diet?"

- Remove sugar, processed foods, excessive alcohol
- Less complexity, easier to sustain
- **Via negativa**: Health comes from **NOT eating bad things**, not from eating exotic superfoods

**Application to ARI**:

- Via negativa: Remove bad tools/frameworks > add more tools/frameworks
- "What should ARI STOP doing?" > "What should ARI START doing?"

---

#### 3. Convexity (Non-Linear Payoff)

**Convex Payoff**: Upside > downside (benefits from volatility)

**Example**:

```
Stock option:
  If stock down 50%: Lose premium paid ($100)
  If stock up 50%: Gain scales (could be $10,000+)
  
  Payoff is convex: Large upside, capped downside
```

**Concave Payoff**: Downside > upside (hurt by volatility)

**Example**:

```
Writing insurance:
  If no claims: Collect small premium ($100)
  If major claim: Pay large amount ($100,000+)
  
  Payoff is concave: Small upside, large downside (fragile)
```

**Goal**: Seek convex payoffs, avoid concave payoffs.

---

### Implementation Specification

**File**: `src/cognition/logos/antifragility.ts`

```typescript
export interface AntifragilityAnalysis {
  classification: 'fragile' | 'robust' | 'antifragile';
  score: number;                              // -1 (fragile) to +1 (antifragile)
  downsideRisk: number;                       // Max loss
  upsidePotential: number;                    // Max gain
  asymmetry: number;                          // upside / downside (>2 is good)
  optionality: boolean;                       // Has optionality?
  convexity: number;                          // -1 (concave) to +1 (convex)
  viaNegativaOpportunities: string[];         // What to remove?
  barbellSuggestion?: string;                 // How to structure as barbell
  recommendation: string;
  reasoning: string[];
  provenance: {
    framework: 'Antifragility (Taleb, 2012)';
    concepts: string[];
    computedAt: Date;
  };
}

/**
 * Analyze decision for antifragility
 * 
 * Assesses whether decision is fragile (breaks under stress),
 * robust (resists stress), or antifragile (gains from stress).
 * 
 * @param decision - Decision to analyze
 * @returns Antifragility classification with improvement suggestions
 */
export async function analyzeAntifragility(
  decision: {
    description: string;
    downside: number;             // Worst-case loss
    upside: number;               // Best-case gain
    volatilityExposure: number;   // 0-1, how exposed to randomness?
    optionality?: {               // Does this have option value?
      canExit: boolean;
      costToExit: number;
      potentialGain: number;
    };
  }
): Promise<AntifragilityAnalysis> {
  const { downside, upside, volatilityExposure } = decision;
  
  // Calculate asymmetry
  const asymmetry = Math.abs(upside) / Math.abs(downside);
  
  // Classify
  let classification: 'fragile' | 'robust' | 'antifragile';
  let score: number;
  
  if (asymmetry > 3.0 && volatilityExposure > 0.5) {
    classification = 'antifragile';
    score = 0.5 + (asymmetry / 10); // Scale to 0.5-1.0
  } else if (asymmetry > 1.5 || volatilityExposure < 0.3) {
    classification = 'robust';
    score = 0; // Neutral
  } else {
    classification = 'fragile';
    score = -0.5 - (1 / asymmetry); // Scale to -1.0 to -0.5
  }
  
  // Check for optionality
  const hasOptionality = decision.optionality !== undefined &&
    decision.optionality.canExit &&
    decision.optionality.costToExit < (downside * 0.2);
  
  // Assess convexity (simplified)
  const convexity = hasOptionality ? 0.7 : (asymmetry > 2.0 ? 0.5 : -0.3);
  
  // Via negativa opportunities
  const viaNegativa = identifyViaNegativa(decision);
  
  // Barbell suggestion (if currently fragile/robust)
  const barbellSuggestion = classification !== 'antifragile' ?
    generateBarbellStrategy(decision) : undefined;
  
  return {
    classification,
    score,
    downsideRisk: downside,
    upsidePotential: upside,
    asymmetry,
    optionality: hasOptionality,
    convexity,
    viaNegativaOpportunities: viaNegativa,
    barbellSuggestion,
    recommendation: generateAntifragilityRecommendation(classification, asymmetry, hasOptionality),
    reasoning: buildAntifragilityReasoning(decision, classification, asymmetry),
    provenance: {
      framework: 'Antifragility (Taleb, 2012)',
      concepts: ['Asymmetry', 'Optionality', 'Convexity', 'Via Negativa', 'Barbell Strategy'],
      computedAt: new Date(),
    },
  };
}
```

---

## Council Integration

### Which Members Use Which Frameworks?

| Member | Primary LOGOS Frameworks | Usage Frequency |
|--------|-------------------------|-----------------|
| **AEGIS** | Bayesian (threat probability), Antifragility (black swans) | Daily |
| **SCOUT** | Expected Value, Kelly Criterion, Bayesian | Daily |
| **MINT** | Kelly Criterion, Expected Value | Daily |
| **ATLAS** | Systems Thinking, Decision Trees | Weekly |
| **TRUE** | Decision Trees, Expected Value | Weekly |
| **OPAL** | Expected Value, Systems Thinking | Weekly |
| **TEMPO** | Decision Trees (scheduling optimization) | Weekly |
| **BLOOM** | Decision Trees (learning paths), Kelly (time allocation) | Weekly |
| **NEXUS** | Systems Thinking (synthesis) | Weekly |
| **VERA** | Via Negativa (Taleb), First Principles | Monthly |

---

## Implementation Guide

### Phase 0: Foundation (Week 1-2)

**Create Files**:

```bash
mkdir -p src/cognition/logos
touch src/cognition/logos/index.ts
touch src/cognition/logos/bayesian.ts
touch src/cognition/logos/expected-value.ts
touch src/cognition/logos/kelly.ts
touch src/cognition/logos/decision-trees.ts
touch src/cognition/logos/systems-thinking.ts
touch src/cognition/logos/antifragility.ts
```

**Define Types** (`src/cognition/types.ts`):

- All Zod schemas
- All interfaces
- All enums

### Phase 1: Implement Core (Week 3-4)

**Priority Order**:

1. **Expected Value** (most universally useful)
2. **Bayesian Reasoning** (foundational)
3. **Kelly Criterion** (high-value for MINT/SCOUT)
4. **Decision Trees** (useful for TRUE/ATLAS)
5. **Systems Thinking** (complex, defer if needed)
6. **Antifragility** (philosophical, can be last)

**Test First** (TDD):

- Write tests before implementation
- Cover happy path + edge cases + errors
- Target: 90%+ coverage for LOGOS

---

## Knowledge Sources Summary

**Total LOGOS Sources**: ~28 sources

**By Category**:

- Bayesian (6 sources)
- Expected Value (4 sources)
- Kelly Criterion (5 sources)
- Decision Trees (4 sources)
- Systems Thinking (6 sources)
- Antifragility (3 sources)

**Trust Distribution**:

- VERIFIED: 18 sources (64%)
- STANDARD: 10 sources (36%)
- UNTRUSTED: 0 (all curated)

**Full catalog**: See `docs/cognition/08-knowledge-sources-catalog.md` (separate deliverable).

---

**Last Updated**: 2026-02-01  
**Status**: Design Complete  
**Next**: Implement in `src/cognition/logos/`  
**Est. Implementation Time**: 2 weeks (Phase 1)  
**Est. Testing Time**: 3-4 days  
**Total**: ~3 weeks for full LOGOS pillar
