# ADR-013: Cognitive API Design Pattern

**Status**: PROPOSED (Pending Council Vote)

**Date**: 2026-02-01

**Related**: ADR-009 (Cognitive Layer), ADR-010 (Three Pillars), ADR-012 (Specializations)

---

## Context

Layer 0 (Cognitive Foundation) must expose cognitive frameworks to higher layers. Need to design the **interface** through which Council members, agents, and other layers access LOGOS/ETHOS/PATHOS capabilities.

### Design Constraints

1. **Type Safe**: Must use TypeScript with Zod validation (ADR-006)
2. **Async**: Cognitive queries may hit disk (knowledge base), must be async
3. **Event-Driven**: Must emit audit events for all queries (ADR-003: EventBus)
4. **Layer-Boundary Compliant**: Higher layers import from Layer 0, never reverse
5. **Performance**: Response time <100ms for most APIs (real-time decision support)
6. **Provenance**: All responses must include source attribution and confidence
7. **Cacheable**: Frequent queries should be cached (avoid redundant computation)

### API Design Philosophy

**Key Questions**:

1. **Imperative vs Query-Based?**
   - Imperative: `cognition.execute('assess risk')`
   - Query-Based: `cognition.assessRisk(params)`

2. **Synchronous vs Async?**
   - Sync: `const result = assessRisk()`
   - Async: `const result = await assessRisk()`

3. **Class-Based vs Functional?**
   - Class: `const cognition = new CognitiveLayer(); cognition.assessRisk()`
   - Functional: `import { assessRisk } from 'cognition'; assessRisk()`

4. **Monolithic vs Modular?**
   - Monolithic: `import cognition from 'cognition'; cognition.logos.bayesian.updateBelief()`
   - Modular: `import { updateBelief } from 'cognition/logos/bayesian'`

**Design Decisions** (see below).

---

## Decision

Implement **functional, async, modular, query-based** API pattern.

### API Design Principles

#### Principle 1: Functional Exports (Not Classes)

**Pattern**:

```typescript
// ✅ CORRECT: Functional
export async function calculateExpectedValue(
  decision: Decision
): Promise<ExpectedValueResult> {
  // Implementation
}

// ❌ WRONG: Class-based
export class ExpectedValueCalculator {
  async calculate(decision: Decision): Promise<ExpectedValueResult> {
    // Implementation
  }
}
```

**Rationale**:

- **Simpler**: Functions are simpler than classes for stateless operations
- **Composable**: Functions can be easily composed
- **Testable**: Pure functions easier to test than stateful classes
- **Familiar**: Matches Node.js ecosystem patterns

**Exception**: Internal implementations MAY use classes (e.g., `BiasDetector` class), but exported API is functional.

---

#### Principle 2: Always Async (Even if Currently Sync)

**Pattern**:

```typescript
// ✅ CORRECT: Async (even if currently synchronous)
export async function detectBias(text: string): Promise<Bias[]> {
  // Currently synchronous pattern matching
  // But async allows future enhancement (query knowledge base)
  return detectBiasPatterns(text);
}

// ❌ WRONG: Sync (locks into synchronous forever)
export function detectBias(text: string): Bias[] {
  // If we later need to query knowledge base, this becomes breaking change
  return detectBiasPatterns(text);
}
```

**Rationale**:

- **Future-proof**: May need to query knowledge base later (async operation)
- **Consistent**: All cognitive APIs have same async pattern
- **Composable**: Async functions can await each other
- **Non-blocking**: Won't block event loop even if operation becomes expensive

---

#### Principle 3: Modular Imports (Not Monolithic)

**Pattern**:

```typescript
// ✅ CORRECT: Import specific functions
import { calculateExpectedValue } from '../cognition/logos/expected-value.js';
import { detectCognitiveBias } from '../cognition/ethos/bias-detector.js';

const ev = await calculateExpectedValue(decision);
const biases = await detectCognitiveBias(reasoning);

// ❌ WRONG: Import entire namespace
import * as cognition from '../cognition/index.js';

const ev = await cognition.logos.expectedValue.calculate(decision);
const biases = await cognition.ethos.biasDetector.detect(reasoning);
```

**Rationale**:

- **Tree-shaking**: Bundlers can eliminate unused code
- **Explicit dependencies**: Clear what each file uses
- **Faster imports**: Don't load entire cognition layer if only using one function
- **Familiar**: Matches TypeScript ecosystem conventions

**Convenience Export**: `src/cognition/index.ts` re-exports all for convenience:

```typescript
// src/cognition/index.ts
export * from './logos/index.js';
export * from './ethos/index.js';
export * from './pathos/index.js';
```

---

#### Principle 4: Rich Response Objects (Not Primitives)

**Pattern**:

```typescript
// ✅ CORRECT: Rich object with metadata
export async function calculateExpectedValue(
  decision: Decision
): Promise<{
  expectedValue: number;
  confidence: number;           // How confident are we? 0-1
  variance: number;             // How much uncertainty?
  recommendation: string;       // Human-readable advice
  alternatives: string[];       // Other options considered
  reasoning: string[];          // Step-by-step explanation
  provenance: {
    frameworks: string[];       // Which frameworks used
    sources: string[];          // Which knowledge sources consulted
    computedAt: Date;
  };
}> {
  // Implementation
}

// ❌ WRONG: Primitive return (loses context)
export async function calculateExpectedValue(
  decision: Decision
): Promise<number> {
  // Just returns number - no confidence, no explanation
}
```

**Rationale**:

- **Explainability**: Consumers know WHY this is the result
- **Confidence**: Quantify uncertainty (0.95 confidence vs 0.40 confidence)
- **Provenance**: Traceable to sources (audit requirement)
- **Actionable**: Recommendation tells user what to do
- **Educational**: Reasoning explains step-by-step logic

---

#### Principle 5: Query-Based (Not Imperative)

**Pattern**:

```typescript
// ✅ CORRECT: Query-based (asking for information)
const result = await assessEmotionalState(member, context);
// Returns: { valence, arousal, dominance, recommendation }

// ❌ WRONG: Imperative (commanding action)
await regulateEmotion(member, targetState);
// Commands emotion regulation - Layer 0 shouldn't command
```

**Rationale**:

- **Layer 0 provides analysis, not execution**
- **Decision authority stays with Council members** (they decide whether to act on cognitive insights)
- **Separation of concerns**: Cognition = information, Execution = action
- **Respects autonomy**: Members can ignore cognitive advice if they choose

---

## Complete API Specification

### LOGOS APIs (Reason)

#### 1. Bayesian Reasoning

```typescript
// ── Belief Updating ────────────────────────────────────────

export interface Belief {
  hypothesis: string;
  priorProbability: number;      // 0.0 - 1.0
  evidence: Evidence[];
  posteriorProbability: number;   // Updated after each evidence
  confidence: number;             // How sure are we? 0.0 - 1.0
  updatedAt: Date;
  provenance: {
    sources: string[];           // Which sources informed this belief
    reasoning: string[];         // Step-by-step updates
  };
}

export interface Evidence {
  observation: string;
  likelihood: number;             // P(E|H): prob of evidence if hypothesis true
  strength: number;               // 0.0 - 1.0, how strong is this evidence?
  source: string;
  trust: TrustLevel;
  observedAt: Date;
}

export interface BayesianUpdate {
  belief: Belief;
  priorProbability: number;       // Before update
  posteriorProbability: number;   // After update
  shift: number;                  // Posterior - prior (how much changed)
  confidence: number;
  reasoning: string[];            // Explain the update
}

/**
 * Update belief based on new evidence (Bayes' Theorem)
 * 
 * Formula: P(H|E) = P(E|H) × P(H) / P(E)
 * 
 * @param prior - Current belief
 * @param evidence - New observation
 * @returns Updated belief with explanation
 * 
 * @example
 * const updated = await updateBelief(
 *   { hypothesis: 'Investment will succeed', priorProbability: 0.30 },
 *   { observation: 'Founder has 3 exits', likelihood: 0.80, strength: 0.70 }
 * );
 * // Returns: { posteriorProbability: 0.60, shift: +0.30, ... }
 */
export async function updateBelief(
  prior: Belief,
  evidence: Evidence
): Promise<BayesianUpdate>;

/**
 * Calculate posterior probability (raw Bayes calculation)
 * 
 * @param priorProbability - P(H)
 * @param likelihood - P(E|H)
 * @param marginalProbability - P(E)
 * @returns Posterior probability P(H|E)
 */
export async function calculatePosterior(
  priorProbability: number,
  likelihood: number,
  marginalProbability: number
): Promise<{
  posterior: number;
  confidence: number;
  reasoning: string[];
}>;
```

---

#### 2. Expected Value

```typescript
// ── Expected Value Calculation ────────────────────────────

export interface Outcome {
  description: string;
  probability: number;            // 0.0 - 1.0, must sum to 1.0 across outcomes
  value: number;                  // Utility (can be negative for losses)
  confidence: number;             // How sure are we of this probability?
}

export interface Decision {
  description: string;
  outcomes: Outcome[];            // Minimum 2, all probabilities sum to 1.0
  constraints?: string[];         // Limitations or requirements
  context?: Record<string, unknown>;
}

export interface ExpectedValueResult {
  expectedValue: number;
  confidence: number;             // Weighted by outcome confidences
  variance: number;               // How much spread in outcomes?
  recommendation: string;         // "Proceed" | "Avoid" | "Neutral" | "Needs more info"
  alternatives: string[];         // If avoiding, what else could you do?
  reasoning: string[];            // Step-by-step calculation
  sensitivity: {                  // How sensitive is EV to probability changes?
    mostCriticalOutcome: Outcome; // Which outcome's probability matters most?
    breakEvenProbability: number; // At what probability does EV = 0?
  };
  provenance: {
    framework: 'Expected Value Theory';
    computedAt: Date;
    sources: string[];            // Papers/books referenced
  };
}

/**
 * Calculate expected value of a decision
 * 
 * Formula: EV = Σ (Probability_i × Value_i)
 * 
 * @param decision - Decision with multiple possible outcomes
 * @returns Expected value analysis with recommendation
 * 
 * @example
 * const result = await calculateExpectedValue({
 *   description: 'Should I take this job?',
 *   outcomes: [
 *     { description: 'Get offer, accept', probability: 0.20, value: 100 },
 *     { description: 'Get offer, decline', probability: 0.10, value: -5 },
 *     { description: 'Rejected', probability: 0.70, value: -10 },
 *   ],
 * });
 * // Returns: { expectedValue: 12.5, recommendation: 'Proceed (positive EV)', ... }
 */
export async function calculateExpectedValue(
  decision: Decision
): Promise<ExpectedValueResult>;

/**
 * Rank multiple decisions by expected value
 * 
 * @param decisions - Array of decisions to compare
 * @returns Ranked list (highest EV first)
 */
export async function rankDecisions(
  decisions: Decision[]
): Promise<Array<{
  decision: Decision;
  expectedValue: number;
  rank: number;
  confidence: number;
}>>;
```

---

#### 3. Kelly Criterion

```typescript
// ── Kelly Criterion (Position Sizing) ─────────────────────

export interface KellyInput {
  winProbability: number;         // 0.0 - 1.0
  winPayoff: number;              // Ratio (e.g., 2.0 = can double money)
  lossProbability: number;        // 0.0 - 1.0, should equal (1 - winProb)
  lossPayoff: number;             // Ratio (e.g., 1.0 = can lose all allocated)
  currentCapital: number;         // Total capital available
}

export interface KellyResult {
  fullKelly: number;              // Optimal fraction (0.0 - 1.0)
  halfKelly: number;              // Conservative (recommended)
  quarterKelly: number;           // Very conservative
  recommendedDollar: number;      // Dollar amount for half-Kelly
  expectedGrowth: number;         // Expected capital growth rate
  riskOfRuin: number;             // Probability of losing everything
  recommendation: string;
  reasoning: string[];
  warnings: string[];             // E.g., "Full Kelly is aggressive, use half-Kelly"
  provenance: {
    framework: 'Kelly Criterion (1956)';
    formula: string;              // Actual formula used
    computedAt: Date;
    sources: string[];
  };
}

/**
 * Calculate optimal position size (Kelly Criterion)
 * 
 * Formula: f* = (p × b - q) / b
 * Where:
 *   f* = fraction of capital to bet
 *   p = probability of winning
 *   q = probability of losing (1 - p)
 *   b = odds received (payoff ratio)
 * 
 * @param input - Win/loss probabilities and payoffs
 * @returns Kelly fractions (full, half, quarter) with recommendations
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
): Promise<KellyResult>;

/**
 * Assess risk of ruin (probability of losing all capital)
 * 
 * @param strategy - Betting strategy with Kelly fraction
 * @param iterations - Number of simulations (Monte Carlo)
 * @returns Probability of complete capital loss
 */
export async function assessRiskOfRuin(
  strategy: {
    kellyFraction: number;
    winProb: number;
    lossProb: number;
    payoffRatio: number;
  },
  iterations: number
): Promise<{
  riskOfRuin: number;
  medianOutcome: number;
  percentile95: number;
  reasoning: string[];
}>;
```

---

#### 4. Decision Trees

```typescript
// ── Decision Tree Analysis ────────────────────────────────

export interface DecisionNode {
  id: string;
  question: string;               // Decision to make at this node
  options: DecisionOption[];      // Available choices
  depth: number;                  // Distance from root
}

export interface DecisionOption {
  choice: string;
  probability: number;            // Probability this path is taken
  expectedValue: number;          // Value of this terminal outcome
  nextNode?: DecisionNode;        // Subsequent decision (if not terminal)
}

export interface DecisionTreeResult {
  optimalPath: string[];          // Best sequence of choices
  expectedValue: number;          // EV of optimal path
  confidence: number;
  alternatives: Array<{           // Next-best paths
    path: string[];
    expectedValue: number;
    differenceFromOptimal: number;
  }>;
  reasoning: string[];
  visualization: string;          // ASCII tree diagram
  provenance: {
    framework: 'Decision Tree Analysis';
    algorithm: 'Backward Induction';
    computedAt: Date;
  };
}

/**
 * Analyze decision tree and find optimal path
 * 
 * Uses backward induction: start at terminal nodes, work back to root,
 * selecting highest-EV option at each node.
 * 
 * @param root - Root node of decision tree
 * @returns Optimal path with expected value
 * 
 * @example
 * const tree = await analyzeDecisionTree({
 *   question: 'Career path?',
 *   options: [
 *     { choice: 'Job A', probability: 1.0, nextNode: { ... } },
 *     { choice: 'Job B', probability: 1.0, nextNode: { ... } },
 *   ],
 * });
 * // Returns: { optimalPath: ['Job A', 'Specialize', 'Lead'], ev: 85, ... }
 */
export async function analyzeDecisionTree(
  root: DecisionNode
): Promise<DecisionTreeResult>;
```

---

#### 5. Systems Thinking

```typescript
// ── Systems Thinking ───────────────────────────────────────

export interface SystemComponent {
  name: string;
  type: 'stock' | 'flow' | 'feedback';
  connections: string[];          // Names of connected components
}

export interface FeedbackLoop {
  type: 'reinforcing' | 'balancing';
  components: string[];           // Components in loop
  strength: number;               // 0-1, how strong is the loop?
  polarity: 'positive' | 'negative';
  description: string;
}

export interface LeveragePoint {
  description: string;
  meadowsLevel: number;           // 1-12 (Meadows' 12 leverage points)
  effectiveness: number;          // 0-1, how impactful?
  difficulty: number;             // 0-1, how hard to change?
  recommendations: string[];
}

/**
 * Identify leverage points in a system (Donella Meadows)
 * 
 * Meadows' 12 leverage points (ascending effectiveness):
 * 12. Constants/parameters (numbers)
 * 11. Buffers (stocks relative to flows)
 * 10. Stock-and-flow structures
 * 9. Delays
 * 8. Balancing feedback loops
 * 7. Reinforcing feedback loops
 * 6. Information flows
 * 5. Rules of the system
 * 4. Self-organization
 * 3. Goals of the system
 * 2. Paradigms (mindset)
 * 1. Power to transcend paradigms (highest leverage)
 * 
 * @param system - System components and connections
 * @returns Identified leverage points ranked by effectiveness
 */
export async function identifyLeveragePoints(
  system: {
    components: SystemComponent[];
    feedbackLoops: FeedbackLoop[];
    currentState: Record<string, number>;
  }
): Promise<{
  leveragePoints: LeveragePoint[];
  highestLeverage: LeveragePoint;
  easiestToChange: LeveragePoint;
  recommendation: string;
  reasoning: string[];
}>;

/**
 * Analyze feedback loops and predict system behavior
 * 
 * @param system - System definition
 * @returns Behavior predictions (equilibrium, tipping points, interventions)
 */
export async function analyzeFeedbackLoops(
  system: {
    components: SystemComponent[];
    feedbackLoops: FeedbackLoop[];
  }
): Promise<{
  equilibrium: string;            // Where system will settle
  tippingPoints: string[];        // Points of no return
  interventions: string[];        // How to shift equilibrium
  timeToEquilibrium: string;      // How long until system settles
  stability: number;              // 0-1, how stable is equilibrium?
}>;
```

---

### ETHOS APIs (Character)

#### 1. Bias Detection

```typescript
// ── Cognitive Bias Detection ──────────────────────────────

export enum CognitiveBias {
  CONFIRMATION_BIAS = 'confirmation_bias',
  SUNK_COST_FALLACY = 'sunk_cost_fallacy',
  RECENCY_BIAS = 'recency_bias',
  LOSS_AVERSION = 'loss_aversion',
  OVERCONFIDENCE = 'overconfidence',
  ANCHORING = 'anchoring',
  AVAILABILITY_HEURISTIC = 'availability_heuristic',
  HINDSIGHT_BIAS = 'hindsight_bias',
  GAMBLERS_FALLACY = 'gamblers_fallacy',
  DUNNING_KRUGER = 'dunning_kruger',
}

export interface BiasDetection {
  bias: CognitiveBias;
  severity: number;               // 0.0 - 1.0 (0.8+ is major concern)
  confidence: number;             // How sure are we this bias is present?
  evidence: string[];             // Phrases/patterns that triggered detection
  mitigation: string;             // How to counteract this bias
  examples: string[];             // Clear examples of the bias in reasoning
  framework: string;              // Kahneman, Tversky, etc.
}

export interface BiasAnalysis {
  biases: BiasDetection[];
  overallBiasScore: number;       // 0.0 - 1.0 (aggregate severity)
  majorConcerns: BiasDetection[]; // Severity >= 0.6
  recommendation: string;         // "Proceed" | "Reconsider" | "Major revision needed"
  debiasedReasoning?: string;     // Suggested rewrite without bias
}

/**
 * Detect cognitive biases in reasoning
 * 
 * Analyzes text for patterns indicating cognitive biases (confirmation,
 * sunk cost, recency, loss aversion, overconfidence, etc.)
 * 
 * @param reasoning - Text to analyze (decision explanation, argument, plan)
 * @param context - Decision context for relevance
 * @returns Detected biases with severity and mitigation
 * 
 * @example
 * const biases = await detectCognitiveBias(
 *   "I've already invested $10K, so I should invest another $5K to average down",
 *   { agent: 'MINT', decision: 'investment' }
 * );
 * // Returns: [{ bias: SUNK_COST_FALLACY, severity: 0.85, mitigation: "Ignore sunk costs..." }]
 */
export async function detectCognitiveBias(
  reasoning: string,
  context: {
    agent?: string;
    decision?: string;
    recentOutcomes?: Outcome[];   // Recent history (helps detect patterns)
  }
): Promise<BiasAnalysis>;
```

---

#### 2. Emotional State

```typescript
// ── Emotional State Assessment ────────────────────────────

export interface EmotionalState {
  agent: string;                  // Which Council member
  valence: number;                // -1.0 (negative) to +1.0 (positive)
  arousal: number;                // 0.0 (calm) to 1.0 (excited)
  dominance: number;              // 0.0 (powerless) to 1.0 (in control)
  detectedEmotions: Array<'fear' | 'greed' | 'anger' | 'euphoria' | 'calm' | 'anxiety' | 'frustration'>;
  riskToDecisionQuality: number;  // 0.0 - 1.0 (how much emotion impairs judgment)
  recommendation: 'proceed' | 'caution' | 'wait' | 'seek_second_opinion';
  cooldownPeriod?: number;        // Minutes to wait if "wait" recommended
  reasoning: string[];
  provenance: {
    framework: 'Dimensional Emotion Model (Russell)';
    assessedAt: Date;
  };
}

/**
 * Assess emotional state of Council member based on recent decisions
 * 
 * Uses Russell's circumplex model (valence × arousal) to map emotional state.
 * High arousal (positive or negative) impairs decision quality.
 * 
 * @param agent - Council member to assess
 * @param context - Recent outcomes, current decision
 * @returns Emotional state with risk assessment
 * 
 * @example
 * const state = await checkEmotionalState('MINT', {
 *   recentOutcomes: [
 *     { action: 'invest', result: 'success', value: 1000 },
 *     { action: 'invest', result: 'success', value: 1500 },
 *   ],
 * });
 * // Returns: { valence: +0.8, arousal: 0.7, emotions: ['euphoria', 'greed'],
 * //           riskToDecisionQuality: 0.6, recommendation: 'caution' }
 */
export async function checkEmotionalState(
  agent: string,
  context: {
    recentOutcomes?: Outcome[];
    currentDecision?: Decision;
    timeSinceLastDecision?: number; // minutes
  }
): Promise<EmotionalState>;
```

---

#### 3. Fear/Greed Cycles

```typescript
// ── Fear/Greed Cycle Detection ────────────────────────────

export type FearGreedPattern = 
  | 'fear_spiral'        // Loss → fear → avoid → miss opportunities → regret → more fear
  | 'greed_chase'        // Win → euphoria → excessive risk → big loss
  | 'revenge_trading'    // Loss → anger → larger bet to "make it back" → bigger loss
  | 'euphoria'           // Win streak → overconfidence → ignoring risks
  | 'paralysis'          // Fear → inaction → missed opportunities
  | 'fomo'               // Fear of missing out → impulsive decisions
  | 'none';

export interface FearGreedCycle {
  detected: boolean;
  pattern: FearGreedPattern;
  severity: number;               // 0.0 - 1.0
  evidence: string[];             // Decision patterns showing cycle
  duration: string;               // How long has cycle persisted?
  suggestion: string;             // How to break the cycle
  coolingOffPeriod: number;       // Mandatory wait (minutes)
  examples: string[];             // Specific instances
  historicalPattern: {            // Has this happened before?
    previousOccurrences: number;
    lastOccurrence: Date | null;
    averageDuration: number;      // days
  };
}

/**
 * Detect fear/greed cycles in decision patterns
 * 
 * Analyzes sequence of decisions and outcomes to identify emotional patterns.
 * Fear spiral: Losses → risk avoidance → missed gains
 * Greed chase: Wins → excessive risk → big loss
 * 
 * @param recentDecisions - Last 10-20 decisions
 * @param outcomes - Results of those decisions
 * @returns Detected cycle with breaking suggestions
 * 
 * @example
 * const cycle = await detectFearGreedCycle(
 *   [/* last 10 decisions */],
 *   [/* outcomes: 3 losses in a row */]
 * );
 * // Returns: { pattern: 'fear_spiral', severity: 0.75,
 * //           suggestion: 'Start small to rebuild confidence',
 * //           coolingOffPeriod: 60 (1 hour) }
 */
export async function detectFearGreedCycle(
  recentDecisions: Decision[],
  outcomes: Outcome[]
): Promise<FearGreedCycle>;
```

---

#### 4. Discipline Systems

```typescript
// ── Discipline Check (Pre-Decision) ───────────────────────

export interface DisciplineCheckResult {
  passed: boolean;                // Can proceed with decision?
  score: number;                  // 0.0 - 1.0 (overall discipline score)
  warnings: string[];             // Issues detected
  requiredActions: string[];      // Must do these before proceeding
  optionalActions: string[];      // Should consider these
  coolingOffPeriod?: number;      // Minutes to wait if failed
  checklist: {
    physicalState: boolean;       // Slept well, not hungry, not ill
    emotionalState: boolean;      // Emotional risk < 0.3
    cognitiveState: boolean;      // No major biases detected
    timing: boolean;              // Not late night, not rushed
    preparation: boolean;         // Research done, alternatives considered
  };
  reasoning: string[];
}

/**
 * Pre-decision discipline check
 * 
 * Enforces healthy decision-making conditions. Checks physical state,
 * emotional state, cognitive biases, timing, and preparation level.
 * 
 * Based on trading psychology (Mark Douglas) and decision science.
 * 
 * @param decision - Decision being considered
 * @param agent - Council member making decision
 * @param context - Current state (time, recent outcomes, etc.)
 * @returns Pass/fail with required actions
 * 
 * @example
 * const check = await checkDiscipline(
 *   { description: 'Invest $50K', ... },
 *   'MINT',
 *   { timeOfDay: '2:00 AM', hoursSlept: 4, recentLoss: true }
 * );
 * // Returns: { passed: false, warnings: ['Late night', 'Sleep deprived', 'Recent loss'],
 * //           requiredActions: ['Sleep 7+ hours', 'Wait until morning'],
 * //           coolingOffPeriod: 360 (6 hours) }
 */
export async function checkDiscipline(
  decision: Decision,
  agent: string,
  context: {
    timeOfDay?: string;           // ISO time or "2:00 AM"
    hoursSlept?: number;
    emotional?: EmotionalState;
    recentOutcomes?: Outcome[];
    timeAvailable?: number;       // Minutes to decide (detect rush)
  }
): Promise<DisciplineCheckResult>;
```

---

### PATHOS APIs (Growth)

#### 1. Reflection Engine

```typescript
// ── Reflection (After Outcomes) ───────────────────────────

export type InsightType = 'pattern' | 'mistake' | 'success' | 'principle' | 'anomaly';

export interface Insight {
  type: InsightType;
  description: string;
  evidence: string[];             // What led to this insight
  actionable: string;             // What to do with this insight
  confidence: number;             // 0-1
  generalizes: boolean;           // Applies elsewhere?
  relatedInsights: string[];      // IDs of related insights
  priority: 'low' | 'medium' | 'high' | 'critical';
  framework: string;              // Which framework produced this
}

export interface ReflectionResult {
  insights: Insight[];
  summary: string;                // Overall takeaway
  principles: string[];           // General rules extracted
  antipatterns: string[];         // What NOT to do
  nextActions: string[];          // Concrete next steps
  confidence: number;
  provenance: {
    framework: 'Reflection Engine (Kolb Learning Cycle)';
    reflectedAt: Date;
  };
}

/**
 * Reflect on outcome and extract learnings
 * 
 * Analyzes what happened vs what was expected, identifies patterns,
 * extracts actionable insights and general principles.
 * 
 * Based on Kolb's Learning Cycle: Experience → Reflect → Conceptualize → Experiment
 * 
 * @param outcome - Result of action/decision
 * @returns Insights, principles, actionable next steps
 * 
 * @example
 * const reflection = await reflectOnOutcome({
 *   action: 'Launch product without beta testing',
 *   result: 'failure',
 *   expectedValue: 80,  // Expected smooth launch
 *   actualValue: 20,    // 10 bugs found in production
 *   context: { rushed: true, skippedSteps: ['beta testing'] },
 * });
 * // Returns: { insights: [
 * //   { type: 'mistake', description: 'Skipped validation step' },
 * //   { type: 'pattern', description: '3rd time rushing caused bugs' },
 * //   { type: 'principle', description: 'Validation time < fixing time', generalizes: true }
 * // ]}
 */
export async function reflectOnOutcome(
  outcome: {
    action: string;
    result: 'success' | 'failure' | 'partial';
    expectedValue: number;
    actualValue: number;
    timestamp: string;
    context?: Record<string, unknown>;
  }
): Promise<ReflectionResult>;
```

---

#### 2. Learning Synthesis

```typescript
// ── Learning Synthesis ─────────────────────────────────────

export interface LearningPattern {
  pattern: string;                // Description of pattern
  occurrences: number;            // How many times observed
  confidence: number;             // 0-1
  examples: string[];             // Specific instances
  applicability: string[];        // Where this applies
}

export interface SynthesisResult {
  patterns: LearningPattern[];    // Patterns found across experiences
  principles: string[];           // General rules extracted
  antipatterns: string[];         // What consistently fails
  transferable: string[];         // Learnings that apply across domains
  contextSpecific: string[];      // Learnings that only apply in specific contexts
  confidence: number;
  recommendation: string;         // What to do with this synthesis
  provenance: {
    framework: 'Knowledge Synthesis';
    experienceCount: number;
    synthesizedAt: Date;
  };
}

/**
 * Synthesize multiple experiences into general knowledge
 * 
 * Finds patterns across outcomes, extracts general principles,
 * identifies what works vs what doesn't.
 * 
 * @param experiences - Array of past outcomes
 * @returns Synthesized patterns, principles, antipatterns
 * 
 * @example
 * const synthesis = await synthesizeLearning([
 *   { action: 'Feature A without tests', result: 'failure', value: -50 },
 *   { action: 'Feature B with tests', result: 'success', value: +80 },
 *   { action: 'Feature C without tests', result: 'failure', value: -60 },
 * ]);
 * // Returns: {
 * //   patterns: [{ pattern: 'No tests → failure', occurrences: 2, confidence: 0.90 }],
 * //   principles: ['Always write tests before deployment'],
 * //   antipatterns: ['Skipping validation to save time'],
 * //   transferable: ['Validation < fixing' (applies to all projects)]
 * // }
 */
export async function synthesizeLearning(
  experiences: Array<{
    action: string;
    result: 'success' | 'failure' | 'partial';
    expectedValue: number;
    actualValue: number;
    context?: Record<string, unknown>;
  }>
): Promise<SynthesisResult>;
```

---

#### 3. Wisdom Consultation

```typescript
// ── Wisdom Traditions ──────────────────────────────────────

export type WisdomTradition = 
  | 'stoic'              // Marcus Aurelius, Seneca, Epictetus
  | 'dalio'              // Ray Dalio's Principles
  | 'munger'             // Charlie Munger mental models
  | 'musashi'            // Book of Five Rings
  | 'naval'              // Naval Ravikant almanack
  | 'taleb'              // Nassim Taleb's philosophy
  | 'meadows';           // Donella Meadows systems thinking

export interface WisdomQuery {
  question: string;               // What guidance are you seeking?
  context?: string;               // Situation details
  traditions?: WisdomTradition[]; // Which traditions to consult (default: all)
  preferredLength?: 'concise' | 'detailed';
}

export interface WisdomResponse {
  principle: string;              // The wisdom principle
  source: string;                 // Specific citation (e.g., "Meditations 4.3")
  quote?: string;                 // Original quote if applicable
  application: string;            // How to apply to current situation
  alternatives: string[];         // Other perspectives from other traditions
  confidence: number;             // How relevant is this wisdom?
  tradition: WisdomTradition;
  provenance: {
    text: string;                 // Which book/source
    fetchedFrom: string;          // URL
    indexedAt: Date;
  };
}

/**
 * Consult wisdom traditions for guidance
 * 
 * Searches wisdom index for relevant principles from Stoics, Dalio,
 * Munger, Naval, Taleb, etc. Returns applicable wisdom with source.
 * 
 * @param query - Question and context
 * @returns Wisdom principles with application guidance
 * 
 * @example
 * const wisdom = await consultWisdom({
 *   question: 'How should I handle this setback?',
 *   context: 'Project failed after 6 months of work',
 *   traditions: ['stoic', 'taleb'],
 * });
 * // Returns: [
 * //   { principle: 'Dichotomy of Control', source: 'Epictetus, Enchiridion 1',
 * //     application: 'You controlled the effort (6 months work). Outcome is not in your control...' },
 * //   { principle: 'Antifragility via negativa', source: 'Taleb, Antifragile Ch.3',
 * //     application: 'What did you learn? Failure is information...' }
 * // ]
 */
export async function consultWisdom(
  query: WisdomQuery
): Promise<WisdomResponse[]>;
```

---

#### 4. Meta-Learning

```typescript
// ── Meta-Learning (Learning How to Learn) ─────────────────

export interface LearningPlan {
  skill: string;
  currentLevel: number;           // 0-100 (self-assessed or tested)
  targetLevel: number;            // 0-100
  estimatedHours: number;         // Total time needed
  timeframe: string;              // "6 weeks", "3 months"
  techniques: Array<{
    name: string;                 // "Deliberate Practice", "Spaced Repetition"
    description: string;
    expectedImpact: number;       // 0-1
  }>;
  milestones: Array<{
    level: number;                // 0-100
    description: string;
    estimatedWeeks: number;
  }>;
  resources: string[];            // Books, courses, etc.
  practiceSchedule: {
    frequency: string;            // "Daily", "3x per week"
    duration: number;             // Minutes per session
    focusArea: string;            // What to practice
  };
  reviewSchedule: string[];       // When to review (spaced repetition)
  provenance: {
    framework: 'Deliberate Practice (Ericsson) + Spaced Repetition';
    createdAt: Date;
  };
}

/**
 * Create learning plan for skill acquisition
 * 
 * Uses deliberate practice principles (focused practice on weaknesses,
 * immediate feedback) and spaced repetition (optimal review intervals).
 * 
 * @param skill - What to learn
 * @param currentLevel - Current proficiency (0-100)
 * @param targetLevel - Desired proficiency (0-100)
 * @param timeframe - How long to spend (weeks/months)
 * @returns Detailed learning plan with milestones
 * 
 * @example
 * const plan = await createLearningPlan({
 *   skill: 'TypeScript Advanced Types',
 *   currentLevel: 40,
 *   targetLevel: 80,
 *   timeframe: '6 weeks',
 * });
 * // Returns: { estimatedHours: 30,
 * //           techniques: [{ name: 'Deliberate Practice', ... }],
 * //           milestones: [{ level: 50, weeks: 2 }, { level: 65, weeks: 4 }, ...],
 * //           practiceSchedule: { frequency: 'Daily', duration: 45, focusArea: 'Generics' }
 * // }
 */
export async function createLearningPlan(params: {
  skill: string;
  currentLevel: number;
  targetLevel: number;
  timeframe?: string;
}): Promise<LearningPlan>;
```

---

### Cross-Cutting APIs

#### General Knowledge Query

```typescript
// ── Knowledge Base Query ───────────────────────────────────

export interface KnowledgeQuery {
  query: string;                  // Natural language question
  pillar?: 'LOGOS' | 'ETHOS' | 'PATHOS'; // Scope to pillar
  domain?: string;                // E.g., 'risk', 'health', 'ethics'
  councilMember?: string;         // Scope to member's specialization
  limit?: number;                 // Max results (default: 10)
  minRelevance?: number;          // 0-1 (default: 0.1)
}

export interface KnowledgeResult {
  content: string;                // Relevant content snippet
  title: string;
  source: string;                 // Source name (e.g., "Thinking in Systems")
  sourceUrl: string;              // Original URL
  pillar: 'LOGOS' | 'ETHOS' | 'PATHOS';
  framework: string;              // E.g., "Bayesian Reasoning"
  relevance: number;              // 0-1 (TF-IDF score)
  fetchedAt: Date;
  trust: TrustLevel;
  provenance: {
    sourceId: string;
    contentHash: string;
    validationStages: string[];
  };
}

/**
 * Query the knowledge base (semantic search)
 * 
 * Uses TF-IDF (existing knowledge-index.ts) to find relevant content.
 * Results weighted by source trust and relevance.
 * 
 * @param query - Natural language query
 * @returns Ranked results with provenance
 * 
 * @example
 * const results = await queryKnowledge({
 *   query: 'How to handle uncertainty in decisions?',
 *   pillar: 'LOGOS',
 *   limit: 5,
 * });
 * // Returns: [
 * //   { content: "Bayesian reasoning allows updating beliefs...",
 * //     source: "Stanford Statistics Course", relevance: 0.85, ... },
 * //   ...
 * // ]
 */
export async function queryKnowledge(
  query: KnowledgeQuery
): Promise<KnowledgeResult[]>;
```

#### Health & Status

```typescript
// ── Layer 0 Health ─────────────────────────────────────────

export interface CognitiveHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  pillars: {
    logos: { 
      status: 'healthy' | 'degraded';
      frameworksLoaded: number;   // How many frameworks initialized
      totalFrameworks: number;    // Should be ~20
      coverage: number;           // Percentage 0-1
    };
    ethos: {
      status: 'healthy' | 'degraded';
      frameworksLoaded: number;
      totalFrameworks: number;    // Should be ~15
      coverage: number;
    };
    pathos: {
      status: 'healthy' | 'degraded';
      frameworksLoaded: number;
      totalFrameworks: number;    // Should be ~20
      coverage: number;
    };
  };
  knowledgeBase: {
    documentCount: number;
    sourceCount: number;
    verifiedSources: number;
    lastFetchedAt: Date;
    fetchSuccessRate: number;     // Last 7 days
    validationPassRate: number;   // Last 7 days
  };
  councilSpecializations: {
    loaded: number;               // Should be 15
    total: number;                // 15
    averageCoverage: number;      // Average % of specialization knowledge loaded
  };
  performance: {
    avgResponseTime: number;      // milliseconds
    cacheHitRate: number;         // 0-1
    queriesPerDay: number;
  };
}

/**
 * Get Layer 0 health status
 * 
 * @returns Comprehensive health check of cognitive layer
 */
export async function getCognitiveHealth(): Promise<CognitiveHealth>;
```

---

## EventBus Integration

### Emitted Events

All cognitive API calls emit audit events:

```typescript
// Event type extensions for src/kernel/event-bus.ts

export interface EventMap {
  // ... existing events ...
  
  // Cognitive queries
  'cognition:query': {
    api: string;                  // Function name
    pillar: 'LOGOS' | 'ETHOS' | 'PATHOS';
    agent: string;                // Which Council member
    query: Record<string, unknown>; // Sanitized input
    timestamp: string;
  };
  
  'cognition:result': {
    api: string;
    pillar: 'LOGOS' | 'ETHOS' | 'PATHOS';
    agent: string;
    result: 'success' | 'error';
    responseTime: number;         // milliseconds
    cached: boolean;              // Was result from cache?
    timestamp: string;
  };
  
  // LOGOS events
  'cognition:belief_updated': {
    hypothesis: string;
    priorProbability: number;
    posteriorProbability: number;
    shift: number;
    agent: string;
  };
  
  // ETHOS events
  'cognition:bias_detected': {
    bias: CognitiveBias;
    severity: number;
    agent: string;
    decision: string;
  };
  
  'cognition:emotional_risk': {
    agent: string;
    riskLevel: number;
    recommendation: string;
  };
  
  // PATHOS events
  'cognition:reflection_complete': {
    outcome: string;
    insightCount: number;
    principlesExtracted: number;
    agent: string;
  };
  
  'cognition:wisdom_consulted': {
    question: string;
    tradition: WisdomTradition;
    agent: string;
  };
  
  // Knowledge events
  'knowledge:query': {
    query: string;
    resultCount: number;
    avgRelevance: number;
  };
  
  'knowledge:source_fetched': {
    sourceId: string;
    success: boolean;
    documentCount: number;
  };
  
  // Learning events
  'learning:gap_identified': {
    gap: string;
    context: string;
    suggestedSources: string[];
  };
  
  'learning:improvement_measured': {
    metric: string;
    before: number;
    after: number;
    improvement: number;
  };
}
```

### Event Emission Pattern

```typescript
// Inside cognitive API function
export async function calculateExpectedValue(
  decision: Decision
): Promise<ExpectedValueResult> {
  const startTime = Date.now();
  
  // Emit query event
  eventBus.emit('cognition:query', {
    api: 'calculateExpectedValue',
    pillar: 'LOGOS',
    agent: decision.context?.agent || 'unknown',
    query: { description: decision.description }, // Sanitized
    timestamp: new Date().toISOString(),
  });
  
  try {
    // Perform calculation
    const result = performCalculation(decision);
    
    // Emit result event
    eventBus.emit('cognition:result', {
      api: 'calculateExpectedValue',
      pillar: 'LOGOS',
      agent: decision.context?.agent || 'unknown',
      result: 'success',
      responseTime: Date.now() - startTime,
      cached: false,
      timestamp: new Date().toISOString(),
    });
    
    return result;
  } catch (error) {
    // Emit error event
    eventBus.emit('cognition:result', {
      api: 'calculateExpectedValue',
      pillar: 'LOGOS',
      agent: decision.context?.agent || 'unknown',
      result: 'error',
      responseTime: Date.now() - startTime,
      cached: false,
      timestamp: new Date().toISOString(),
    });
    
    throw error;
  }
}
```

**Benefit**: Full audit trail of all cognitive operations (what was queried, by whom, when, result).

---

## Performance & Caching

### Response Time Budgets

| API Category | Target | Justification |
|--------------|--------|---------------|
| LOGOS calculations | <50ms | Math operations (fast) |
| ETHOS pattern matching | <100ms | Text analysis (moderate) |
| PATHOS reflection | <200ms | Complex analysis (acceptable) |
| Knowledge queries | <500ms | Disk I/O + search (reasonable) |
| Wisdom consultation | <300ms | Index lookup + formatting |

### Caching Strategy

**What to Cache**:

- Expected value for common decision patterns (e.g., standard investment scenarios)
- Kelly Criterion for typical probabilities
- Wisdom principles (rarely change)
- Bias detection patterns (static)

**What NOT to Cache**:

- Emotional state (changes frequently)
- Bayesian beliefs (updated with new evidence)
- Reflection (unique per outcome)
- Performance reviews (time-sensitive)

**Implementation**:

```typescript
// src/cognition/knowledge/cache.ts

interface CacheEntry {
  key: string;                    // Hash of query
  value: unknown;                 // Result
  computedAt: Date;
  expiresAt: Date;                // TTL: 30 minutes default
  hitCount: number;
}

class CognitiveCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttl = 30 * 60 * 1000;   // 30 minutes
  
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }
    entry.hitCount++;
    return entry.value as T;
  }
  
  async set(key: string, value: unknown): Promise<void> {
    this.cache.set(key, {
      key,
      value,
      computedAt: new Date(),
      expiresAt: new Date(Date.now() + this.ttl),
      hitCount: 0,
    });
  }
}
```

**Cache Metrics**:

- Hit rate (should be >60% for frequently-used APIs)
- Miss rate
- Average response time (cached vs uncached)
- Cache size (number of entries)

---

## Error Handling

### Error Types

```typescript
export class CognitiveError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CognitiveError';
  }
}

export enum CognitiveErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',           // Input validation failed
  KNOWLEDGE_NOT_FOUND = 'KNOWLEDGE_NOT_FOUND', // No relevant knowledge
  FRAMEWORK_NOT_LOADED = 'FRAMEWORK_NOT_LOADED', // Framework not initialized
  COMPUTATION_ERROR = 'COMPUTATION_ERROR',   // Math error (div by zero, etc.)
  CACHE_ERROR = 'CACHE_ERROR',               // Cache read/write failed
}
```

### Error Handling Pattern

```typescript
// API functions throw specific errors
export async function calculateExpectedValue(
  decision: Decision
): Promise<ExpectedValueResult> {
  // Validate input
  const validation = DecisionSchema.safeParse(decision);
  if (!validation.success) {
    throw new CognitiveError(
      'INVALID_INPUT',
      'Decision validation failed',
      { errors: validation.error.errors }
    );
  }
  
  // Check probabilities sum to 1.0
  const probSum = decision.outcomes.reduce((sum, o) => sum + o.probability, 0);
  if (Math.abs(probSum - 1.0) > 0.01) {
    throw new CognitiveError(
      'INVALID_INPUT',
      'Outcome probabilities must sum to 1.0',
      { actualSum: probSum }
    );
  }
  
  // Perform calculation
  try {
    return performCalculation(decision);
  } catch (error) {
    throw new CognitiveError(
      'COMPUTATION_ERROR',
      'Expected value calculation failed',
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}
```

**Caller Error Handling**:

```typescript
// In Council member code
try {
  const ev = await calculateExpectedValue(decision);
  // Use result
} catch (error) {
  if (error instanceof CognitiveError) {
    if (error.code === 'INVALID_INPUT') {
      // Fix input and retry
    } else if (error.code === 'KNOWLEDGE_NOT_FOUND') {
      // Proceed without cognitive insight
    }
  }
  // Log error, continue with fallback logic
}
```

---

## Versioning Strategy

### API Stability

**Commitment**: Layer 0 APIs are **stable** after v1.0 (no breaking changes).

**Semantic Versioning**:

- **Major** (v1.0 → v2.0): Breaking changes (function signature changes, removed functions)
- **Minor** (v1.0 → v1.1): New functions added, backward compatible
- **Patch** (v1.0.0 → v1.0.1): Bug fixes, no API changes

**Deprecation Process**:

1. Mark function as `@deprecated` in JSDoc (6 months warning)
2. Emit deprecation warning when called
3. After 6 months: Remove in next major version

**Example**:

```typescript
/**
 * @deprecated Use calculateExpectedValue() instead. Will be removed in v2.0.
 */
export async function computeExpectedValue(decision: Decision): Promise<number> {
  console.warn('computeExpectedValue() is deprecated. Use calculateExpectedValue() instead.');
  const result = await calculateExpectedValue(decision);
  return result.expectedValue;
}
```

---

## Alternatives Considered

### 1. Class-Based API

**Pattern**:

```typescript
const cognitive = new CognitiveLayer(eventBus);
const ev = await cognitive.logos.calculateExpectedValue(decision);
```

**Pros**: Object-oriented, encapsulates state, familiar to Java/C# developers

**Cons**:

- Overkill for stateless operations
- Harder to tree-shake
- Requires instantiation (extra step)
- Not idiomatic TypeScript

**Rejected**: Functional is simpler and more idiomatic.

---

### 2. Builder Pattern

**Pattern**:

```typescript
const decision = new DecisionBuilder()
  .addOutcome({ prob: 0.6, value: 100 })
  .addOutcome({ prob: 0.4, value: -50 })
  .build();

const ev = await decision.calculateExpectedValue();
```

**Pros**: Fluent API, validation during build

**Cons**:

- Verbose (more code to write)
- Unnecessary abstraction (plain objects work fine with Zod)
- Locks into builder pattern (hard to change later)

**Rejected**: Plain objects with Zod validation is simpler.

---

### 3. GraphQL-Style Query Language

**Pattern**:

```typescript
const result = await cognition.query(`
  {
    expectedValue(decision: $decision) {
      value
      confidence
      recommendation
    }
    biases(reasoning: $reasoning) {
      type
      severity
    }
  }
`, { decision, reasoning });
```

**Pros**: Flexible, can request exactly what you need, familiar to web developers

**Cons**:

- Massive complexity (GraphQL runtime, schema, resolvers)
- Type safety harder (string queries)
- Overkill for internal API
- Performance overhead (parsing queries)

**Rejected**: Too complex for internal API.

---

### 4. RPC/gRPC Pattern

**Pattern**:

```typescript
const client = createCognitiveClient();
const ev = await client.CalculateExpectedValue({ decision });
```

**Pros**: Standardized, could support remote calls, protocol buffers

**Cons**:

- Requires RPC framework (complexity)
- Network overhead (even for in-process)
- Violates ADR-001 (in-process agents)
- Not idiomatic TypeScript

**Rejected**: In-process direct function calls are simpler and faster.

---

## Documentation Standards

### JSDoc Requirements

Every exported function must have:

```typescript
/**
 * [One-line summary]
 * 
 * [Detailed description - what does this do, when to use it]
 * 
 * [Mathematical formula or algorithm if applicable]
 * 
 * @param [name] - [Description with constraints]
 * @returns [Description of return value and its properties]
 * 
 * @throws {CognitiveError} [When thrown and why]
 * 
 * @example
 * [Realistic example with actual values and expected output]
 * 
 * @see [Related functions or documentation]
 */
```

**Example**:

```typescript
/**
 * Calculate expected value of a decision
 * 
 * Expected value (EV) is the probability-weighted sum of all possible outcomes.
 * Positive EV suggests the decision should be taken; negative EV suggests avoidance.
 * 
 * Formula: EV = Σ (P_i × V_i) for all outcomes i
 * 
 * @param decision - Decision with 2+ outcomes (probabilities must sum to 1.0)
 * @returns Expected value analysis with confidence and recommendation
 * 
 * @throws {CognitiveError} If probabilities don't sum to 1.0 or any value is invalid
 * 
 * @example
 * const result = await calculateExpectedValue({
 *   description: 'Take this job?',
 *   outcomes: [
 *     { description: 'Success', probability: 0.70, value: 100 },
 *     { description: 'Failure', probability: 0.30, value: -20 },
 *   ],
 * });
 * // Returns: { expectedValue: 64, confidence: 0.85, recommendation: 'Proceed (positive EV)' }
 * 
 * @see calculateKellyFraction - For position sizing based on EV
 * @see analyzeDecisionTree - For sequential decision analysis
 */
export async function calculateExpectedValue(
  decision: Decision
): Promise<ExpectedValueResult>;
```

---

## Testing Strategy for APIs

### Test Structure

```typescript
// tests/unit/cognition/logos/expected-value.test.ts

describe('calculateExpectedValue', () => {
  describe('valid inputs', () => {
    it('should calculate EV for simple two-outcome decision', async () => {
      const result = await calculateExpectedValue({
        description: 'Test decision',
        outcomes: [
          { description: 'Win', probability: 0.60, value: 100, confidence: 0.90 },
          { description: 'Lose', probability: 0.40, value: -50, confidence: 0.90 },
        ],
      });
      
      expect(result.expectedValue).toBeCloseTo(40, 2); // 0.60*100 + 0.40*(-50) = 40
      expect(result.confidence).toBeGreaterThan(0.80);
      expect(result.recommendation).toContain('Proceed');
    });
    
    it('should handle negative EV', async () => {
      const result = await calculateExpectedValue({
        description: 'Bad bet',
        outcomes: [
          { description: 'Win', probability: 0.40, value: 50, confidence: 0.90 },
          { description: 'Lose', probability: 0.60, value: -60, confidence: 0.90 },
        ],
      });
      
      expect(result.expectedValue).toBeLessThan(0); // Negative EV
      expect(result.recommendation).toContain('Avoid');
    });
  });
  
  describe('edge cases', () => {
    it('should throw on probabilities not summing to 1.0', async () => {
      await expect(calculateExpectedValue({
        description: 'Invalid',
        outcomes: [
          { description: 'A', probability: 0.50, value: 100, confidence: 0.90 },
          { description: 'B', probability: 0.40, value: -50, confidence: 0.90 },
        ], // Sum = 0.90, not 1.0
      })).rejects.toThrow(CognitiveError);
    });
    
    it('should handle zero probability edge case', async () => {
      const result = await calculateExpectedValue({
        description: 'Certain outcome',
        outcomes: [
          { description: 'Certain', probability: 1.0, value: 100, confidence: 1.0 },
          { description: 'Impossible', probability: 0.0, value: -1000, confidence: 1.0 },
        ],
      });
      
      expect(result.expectedValue).toBe(100);
      expect(result.variance).toBe(0); // No uncertainty
    });
  });
  
  describe('confidence calculation', () => {
    it('should reduce confidence when outcome confidences are low', async () => {
      const result = await calculateExpectedValue({
        description: 'Uncertain',
        outcomes: [
          { description: 'A', probability: 0.50, value: 100, confidence: 0.30 }, // Low confidence
          { description: 'B', probability: 0.50, value: -50, confidence: 0.40 },
        ],
      });
      
      expect(result.confidence).toBeLessThan(0.50); // Should reflect input uncertainty
    });
  });
});
```

---

## Success Criteria

### API Completeness

- ✅ All LOGOS frameworks have exported functions (6 frameworks = 15+ functions)
- ✅ All ETHOS frameworks have exported functions (6 frameworks = 10+ functions)
- ✅ All PATHOS frameworks have exported functions (8 frameworks = 12+ functions)
- ✅ Cross-cutting APIs (knowledge query, health check) implemented

### Documentation Quality

- ✅ Every function has comprehensive JSDoc
- ✅ Every function has realistic example
- ✅ All parameters documented with constraints
- ✅ All error cases documented
- ✅ All mathematical formulas included

### Type Safety

- ✅ All inputs validated with Zod schemas
- ✅ All outputs have explicit types (no `any`)
- ✅ TypeScript strict mode passes
- ✅ No type assertions (except for validated Zod output)

### Performance

- ✅ 95% of LOGOS APIs respond <50ms
- ✅ 95% of ETHOS APIs respond <100ms
- ✅ 95% of PATHOS APIs respond <200ms
- ✅ Cache hit rate >60% after 24h operation

### Testing

- ✅ 90%+ test coverage for all cognitive APIs
- ✅ Every function has unit tests (happy path + edge cases + errors)
- ✅ Integration tests show Council members using APIs
- ✅ Performance tests validate response time budgets

---

## References

- **EventBus**: [`src/kernel/event-bus.ts`](../../src/kernel/event-bus.ts)
- **Type System**: [`src/kernel/types.ts`](../../src/kernel/types.ts)
- **Knowledge Index**: [`src/autonomous/knowledge-index.ts`](../../src/autonomous/knowledge-index.ts)

---

**Last Updated**: 2026-02-01  
**Status**: PROPOSED  
**Dependencies**: ADR-009, ADR-010, ADR-012  
**Next**: ADR-014 (Learning Loop Mechanism)
