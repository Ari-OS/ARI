# ADR-010: Three-Pillar Cognitive Framework

**Status**: PROPOSED (Pending Council Vote)

**Date**: 2026-02-01

**Related**: ADR-009 (Cognitive Layer Architecture)

---

## Context

Layer 0 (Cognitive Foundation) requires **organizational structure** for diverse cognitive frameworks. The layer must encompass:

- Algorithmic reasoning (Bayesian, expected value, Kelly Criterion)
- Trading psychology (Douglas, Tharp, bias detection)
- Therapeutic frameworks (CBT/DBT/ACT)
- Systems thinking (Meadows, complexity theory)
- Wisdom traditions (Stoicism, Dalio, Munger)
- Meta-learning (deliberate practice, spaced repetition)

These frameworks span different domains but all serve ARI's mission as a **Life Operating System**. Need clear organization that:

1. Makes frameworks discoverable (Council members know where to look)
2. Prevents overlap (no duplicate implementations)
3. Enables cross-pollination (members can draw from all domains)
4. Scales gracefully (can add new frameworks without restructuring)

### Classical Rhetoric Foundation

The three modes of persuasion from Aristotle's *Rhetoric* (~350 BCE):

1. **Logos (λόγος)** - Appeal to logic and reason
   - Rational arguments, facts, statistics, logic chains
   - Convinces through objective analysis

2. **Ethos (ἦθος)** - Appeal to character and credibility
   - Ethical standing, trustworthiness, authority
   - Convinces through integrity and discipline

3. **Pathos (πάθος)** - Appeal to emotion and values
   - Feelings, values, aspirations, empathy
   - Convinces through shared humanity

**Why This Model?**

- **2000+ years of proven structure** - survived because it works
- **Comprehensive coverage** - logic + character + emotion = complete intelligence
- **Balanced integration** - no single mode dominates healthy reasoning
- **Universally understood** - clear mental model for developers

**Modern Application**:

- **Logos** → Algorithmic reasoning, probability theory, systems thinking
- **Ethos** → Emotional intelligence, bias detection, discipline
- **Pathos** → Self-reflection, growth, wisdom integration

---

## Decision

Organize Layer 0 cognitive frameworks into **three pillars**:

### PILLAR 1: LOGOS (Reason)

**Purpose**: Algorithmic reasoning and probabilistic decision-making

**Core Frameworks**:

1. **Bayesian Reasoning**
   - Belief updating based on evidence
   - Posterior probability calculation
   - Confidence tracking over time
   - **Source**: Bayes' Theorem (1763), modern Bayesian statistics

2. **Expected Value Theory**
   - Utility-weighted decision analysis
   - Multi-outcome scenario evaluation
   - Risk-adjusted comparison
   - **Source**: Daniel Bernoulli (1738), modern decision theory

3. **Kelly Criterion**
   - Optimal position sizing
   - Bankroll management
   - Risk of ruin calculation
   - **Source**: John Kelly (1956), Ed Thorp applications

4. **Decision Tree Analysis**
   - Structured decision decomposition
   - Sequential decision modeling
   - Path optimization
   - **Source**: Operations research, game theory

5. **Systems Thinking**
   - Feedback loop identification
   - Leverage point analysis (Donella Meadows' 12 points)
   - Emergence pattern recognition
   - Unintended consequence forecasting
   - **Source**: Donella Meadows (Thinking in Systems), complexity science

6. **Antifragility (Taleb)**
   - Optionality analysis
   - Convexity detection
   - Via negativa (subtraction > addition)
   - Barbell strategy
   - **Source**: Nassim Taleb (Antifragile, Black Swan, Fooled by Randomness)

**Implementation Location**: `src/cognition/logos/`

**Primary Council Users**: SCOUT (risk), MINT (wealth), ATLAS (strategy), TRUE (planning), NEXUS (integration)

---

### PILLAR 2: ETHOS (Character)

**Purpose**: Emotional regulation, bias mitigation, and disciplined decision-making

**Core Frameworks**:

1. **Trading Psychology (Mark Douglas)**
   - Probabilistic mindset (accept uncertainty)
   - Discipline systems (follow the plan)
   - Emotional regulation (act despite fear/greed)
   - Loss acceptance (losses are data, not failures)
   - **Source**: Trading in the Zone, The Disciplined Trader

2. **Position Sizing Psychology (Van Tharp)**
   - Expectancy formula: (Win% × AvgWin) - (Loss% × AvgLoss)
   - R-multiples (outcome normalization)
   - System confidence calibration
   - Edge identification
   - **Source**: Trade Your Way to Financial Freedom

3. **Cognitive Bias Detection (Kahneman/Tversky)**
   - 10 primary biases:
     - Confirmation bias (seeking confirming evidence)
     - Sunk cost fallacy (can't let go of past investments)
     - Recency bias (overweighting recent events)
     - Loss aversion (fear of loss > desire for gain)
     - Overconfidence (overestimating abilities)
     - Anchoring (over-relying on first info)
     - Availability heuristic (overweighting memorable examples)
     - Hindsight bias (knew it all along)
     - Gambler's fallacy (expecting regression)
     - Dunning-Kruger (incompetence → overconfidence)
   - **Source**: Thinking Fast and Slow, Prospect Theory

4. **Emotional State Monitoring**
   - Valence (positive/negative)
   - Arousal (calm/excited)
   - Dominance (in control / powerless)
   - Risk to decision quality calculation
   - **Source**: Dimensional emotion models, affective science

5. **Fear/Greed Cycle Detection**
   - Revenge trading (loss → aggressive bets)
   - Euphoria (win streak → overconfidence)
   - Paralysis (fear → inaction)
   - FOMO (fear of missing out)
   - **Source**: Trading psychology, behavioral finance

6. **Discipline Systems**
   - Pre-decision checklist (Am I emotional? Is this revenge? Did I sleep?)
   - Cooling-off periods (wait 10min after strong emotion)
   - Pattern interrupts (if repeating mistake, force reflection)
   - Commitment devices (pre-commit to rules)
   - **Source**: Behavioral economics, self-control research

**Implementation Location**: `src/cognition/ethos/`

**Primary Council Users**: AEGIS (guardian), SCOUT (risk), OPAL (resources), EMBER (relationships), MINT (wealth)

---

### PILLAR 3: PATHOS (Growth)

**Purpose**: Self-reflection, continuous learning, wisdom integration, therapeutic reframing

**Core Frameworks**:

1. **Cognitive Behavioral Therapy (CBT)**
   - Thought reframing (identify cognitive distortions)
   - Behavioral experiments (test beliefs empirically)
   - Evidence-based change (what actually works?)
   - Automatic thought challenging
   - **Source**: Aaron Beck (1960s), Beck Institute

2. **Dialectical Behavior Therapy (DBT)**
   - Distress tolerance (accept discomfort without reactive action)
   - Emotional regulation (name, validate, modulate)
   - Interpersonal effectiveness (navigate conflicts)
   - Mindfulness practices
   - **Source**: Marsha Linehan (1993), Linehan Institute

3. **Acceptance and Commitment Therapy (ACT)**
   - Psychological flexibility (adapt to what is)
   - Values clarification (what matters most?)
   - Defusion (thoughts ≠ reality)
   - Committed action (align behavior with values)
   - **Source**: Steven Hayes (1980s), Association for Contextual Behavioral Science

4. **Stoic Philosophy**
   - Dichotomy of control (focus on controllables)
   - Negative visualization (premeditatio malorum)
   - Virtue ethics (wisdom, courage, justice, temperance)
   - Amor fati (love of fate, accept what is)
   - **Source**: Marcus Aurelius (Meditations), Seneca (Letters), Epictetus (Enchiridion)

5. **Deliberate Practice (Ericsson)**
   - Focused practice on weaknesses
   - Immediate feedback loops
   - Gradual difficulty increase (10% rule)
   - Performance measurement and tracking
   - **Source**: Peak, Cambridge Handbook of Expertise

6. **Meta-Learning (Learning How to Learn)**
   - Spaced repetition (Ebbinghaus forgetting curve)
   - Feynman Technique (teach to understand)
   - Knowledge synthesis (connect disparate concepts)
   - Transfer learning (apply across domains)
   - Chunking (group information for retention)
   - **Source**: Learning science research, cognitive psychology

7. **Wisdom Traditions Integration**
   - **Ray Dalio**: Principles-based decision-making, radical truth
   - **Charlie Munger**: Mental models, inversion, second-order thinking
   - **Miyamoto Musashi**: Book of Five Rings (strategy, timing, adaptation)
   - **Naval Ravikant**: Specific knowledge, leverage, long-term thinking
   - **Donella Meadows**: Leverage points (places to intervene in systems)
   - **Source**: Books, letters, speeches (public domain or official excerpts)

8. **Reflection Engine**
   - Outcome analysis (what happened vs what was expected)
   - Causal attribution (why did it happen?)
   - Insight extraction (what can we learn?)
   - Generalization detection (does this apply elsewhere?)
   - **Source**: Reflective practice research, adult learning theory

**Implementation Location**: `src/cognition/pathos/`

**Primary Council Users**: BLOOM (growth), PULSE (health), VERA (ethics), PRISM (creative), NEXUS (integrator)

---

## Pillar Interaction Model

### Not Silos - Integrated Intelligence

**All Council members access all three pillars**, but with different weights:

```typescript
interface CouncilCognitiveProfile {
  member: CouncilMember;
  pillarWeights: {
    logos: number;  // 0.0 - 1.0
    ethos: number;  // 0.0 - 1.0
    pathos: number; // 0.0 - 1.0
  }; // Weights sum to 1.0
  specializations: string[]; // Specific frameworks within pillars
  primarySources: KnowledgeSource[]; // Curated sources for this member
}
```

**Examples**:

**AEGIS (Guardian)** - Balanced ETHOS/LOGOS, some PATHOS:

```typescript
{
  member: AEGIS,
  pillarWeights: {
    logos: 0.30,  // Uses Bayesian threat assessment, expected value
    ethos: 0.60,  // Heavy trading psychology (risk), bias detection
    pathos: 0.10, // Some Stoic philosophy (courage under threat)
  },
  specializations: [
    'Trading Psychology (risk management)',
    'Bayesian Threat Assessment',
    'Cognitive Bias Detection',
    'Taleb Antifragility',
    'Fear/Greed Detection',
    'Stoic Courage',
  ],
  primarySources: [
    'Mark Douglas - Trading in the Zone',
    'Nassim Taleb - Antifragile',
    'OWASP Security',
    'arXiv security papers',
    'Marcus Aurelius - Meditations (courage)',
  ],
}
```

**MINT (Wealth)** - Heavy LOGOS, strong ETHOS, some PATHOS:

```typescript
{
  member: MINT,
  pillarWeights: {
    logos: 0.60,  // Kelly Criterion, expected value, portfolio theory
    ethos: 0.30,  // Behavioral finance biases, loss aversion
    pathos: 0.10, // Stoic detachment, long-term thinking
  },
  specializations: [
    'Kelly Criterion',
    'Portfolio Theory (Markowitz)',
    'Behavioral Finance',
    'Expected Value Maximization',
    'Loss Aversion Mitigation',
    'Stoic Detachment from Outcomes',
  ],
  primarySources: [
    'Van Tharp - Position sizing',
    'Kelly Criterion papers',
    'Kahneman - Behavioral economics',
    'Taleb - Antifragility',
    'Dalio - Economic principles',
  ],
}
```

**BLOOM (Growth)** - Heavy PATHOS, some LOGOS, light ETHOS:

```typescript
{
  member: BLOOM,
  pillarWeights: {
    logos: 0.20,  // Decision trees for learning paths
    ethos: 0.10,  // Discipline for practice
    pathos: 0.70, // Primary: Meta-learning, deliberate practice, growth
  },
  specializations: [
    'Deliberate Practice (Ericsson)',
    'Meta-Learning',
    'Spaced Repetition',
    'Growth Mindset (Dweck)',
    'Skill Acquisition',
    'Feynman Technique',
  ],
  primarySources: [
    'Peak - Ericsson',
    'Learning science journals',
    'Cognitive load theory',
    'Spaced repetition research',
    'Skill acquisition studies',
  ],
}
```

### Cross-Pillar Synergy

**Example: Financial Decision**

MINT deciding whether to invest $10K:

1. **LOGOS Contribution**:
   - Calculate expected value: EV = (0.55 × $15K) - (0.45 × $10K) = $3.75K
   - Kelly Criterion: Allocate 32.5% of capital (or 16.25% half-Kelly)
   - Decision tree: Map out possible paths and terminal values

2. **ETHOS Contribution**:
   - Detect biases: "Am I showing overconfidence? Anchoring to first price I saw?"
   - Check emotional state: "Am I greedy from recent wins? Fearful from recent losses?"
   - Discipline check: "Did I sleep 7+ hours? Am I making this decision at 2 AM?"

3. **PATHOS Contribution**:
   - Stoic perspective: "What's in my control? (Research, position size) vs not in my control? (Market outcome)"
   - Past reflection: "Last time I invested without research, I lost money. Did I do research this time?"
   - Growth opportunity: "What will I learn from this decision regardless of outcome?"

**Synthesized Decision**:

- **LOGOS**: EV is positive, Kelly says allocate 16.25% (half Kelly = $1,625)
- **ETHOS**: No major biases detected, emotional state is neutral
- **PATHOS**: Aligned with values (long-term growth), learning opportunity clear
- **Final**: **Invest $1,625** (conservative Kelly) with clear stop-loss and learning plan

**Without Three Pillars**: Would likely just calculate basic risk score, miss emotional factors, no learning reflection.

---

## Pillar Details

### LOGOS (Reason) - Algorithmic Mind

**Philosophy**: "Reality is probabilistic. Think in bets."

**Key Principle**: Every decision is a bet with uncertain outcomes. Use mathematics to navigate uncertainty.

**Frameworks**:

#### 1. Bayesian Reasoning

```typescript
// Prior: What we believed before
// Evidence: New observation
// Posterior: Updated belief

P(H|E) = P(E|H) × P(H) / P(E)

Example:
Prior: "60% chance this task will succeed"
Evidence: "Similar task just failed"
Likelihood: P(failure of similar | this fails) = 0.70
Updated: 60% × 0.70 / 0.50 = 84% → Wait, recalculate...
Actually: Update downward based on evidence
Posterior: ~40% chance of success (reduced confidence)
```

**Use Cases**:

- Updating threat probability (AEGIS)
- Adjusting task success estimates (TRUE)
- Recalculating investment odds (MINT)

#### 2. Expected Value

```typescript
EV = Σ (Probability × Value)

Example:
Decision: Should I apply for this job?
Outcomes:
  - Get offer, accept: p=0.20, value=+100 (career growth)
  - Get offer, decline: p=0.10, value=-5 (wasted interview time)
  - Rejected: p=0.70, value=-10 (ego hit, time wasted)
  
EV = (0.20 × 100) + (0.10 × -5) + (0.70 × -10)
   = 20 - 0.5 - 7
   = 12.5 (positive EV → apply)
```

**Use Cases**:

- Comparing multiple options (TRUE)
- Resource allocation (OPAL)
- Risk assessment (SCOUT)

#### 3. Kelly Criterion

```typescript
f* = (p × b - q) / b

Where:
  f* = fraction of capital to bet
  p = probability of winning
  q = probability of losing (1 - p)
  b = odds received (payoff ratio)

Example:
Investment has:
  - 60% win probability
  - 2:1 payoff (can double money)
  - 40% loss probability
  
f* = (0.60 × 2 - 0.40) / 2
   = (1.20 - 0.40) / 2
   = 0.40 (40%)

Full Kelly: Bet 40% of capital
Half Kelly: Bet 20% (more conservative, recommended)
Quarter Kelly: Bet 10% (very conservative)
```

**Use Cases**:

- Position sizing (MINT)
- Resource allocation (OPAL)
- Effort allocation (BLOOM - how much time to invest in learning?)

#### 4. Systems Thinking (Donella Meadows)

**12 Leverage Points** (ordered by effectiveness, least to most):

1. Constants, parameters (numbers)
2. Buffers (stocks relative to flows)
3. Stock-and-flow structures
4. Delays (relative to system dynamics)
5. Balancing feedback loops
6. Reinforcing feedback loops
7. Information flows
8. Rules of the system
9. Self-organization
10. Goals of the system
11. Paradigms (mindset out of which goals arise)
12. **Power to transcend paradigms** (highest leverage)

**Application**:

- Understanding how changes ripple through life systems
- Identifying where small changes have large effects
- Predicting emergent behavior

**Use Cases**:

- Strategic planning (ATLAS)
- Understanding life balance (TEMPO)
- Holistic integration (NEXUS)

#### 5. Antifragility (Taleb)

**Core Ideas**:

- **Fragile**: Breaks under stress (avoid)
- **Robust**: Resists stress (okay)
- **Antifragile**: Gains from stress (ideal)

**Via Negativa**: Addition by subtraction (remove bad > add good)

**Barbell Strategy**: Extreme conservatism + extreme aggression, avoid middle

**Application**:

```
Fragile: One income source, specialized skills
Robust: Multiple income sources, some diversification
Antifragile: Income sources that GROW during chaos + safe cash position
```

**Use Cases**:

- Career strategy (BLOOM)
- Financial strategy (MINT)
- System resilience (AEGIS)

---

### ETHOS (Character) - Disciplined Mind

**Philosophy**: "Know thyself. Regulate emotion. Act with discipline."

**Key Principle**: Humans are emotional and biased. Awareness + discipline > denial.

**Frameworks**:

#### 1. Bias Catalog

**10 Primary Biases** (with detection patterns):

| Bias | Pattern | Example | Mitigation |
|------|---------|---------|------------|
| **Confirmation** | Seeking only confirming evidence | "Here are 5 reasons I'm right (ignores contradicting evidence)" | "What evidence would prove me wrong?" |
| **Sunk Cost** | Can't let go of past investment | "I've already spent $10K, might as well spend $5K more" | "Ignore past costs. Evaluate new $5K independently." |
| **Recency** | Overweighting recent events | "Market dropped yesterday, so it will drop today" | "Look at longer timeframe (30-day, not 1-day)" |
| **Loss Aversion** | Fear of loss > desire for gain | "I'd rather not lose $100 than gain $150" | "Calculate expected value, not fear" |
| **Overconfidence** | Overestimating abilities | "I'll definitely finish this in 2 weeks" | "What's the base rate? How long did similar tasks take?" |
| **Anchoring** | Over-rely on first number | "First price I saw was $100, so $80 feels cheap" | "Ignore anchor, assess intrinsic value" |
| **Availability** | Overweight memorable examples | "Plane crashes are scary (but rare)" | "Check statistics, not vividness" |
| **Hindsight** | "I knew it all along" | "Obviously that was going to fail" | "Review predictions made beforehand" |
| **Gambler's Fallacy** | Expecting mean reversion | "I lost 5 times, so next one should win" | "Events are independent (usually)" |
| **Dunning-Kruger** | Incompetence → overconfidence | "I read one article, I'm an expert" | "Acknowledge unknown unknowns" |

#### 2. Emotional State Assessment

**Dimensional Model** (Russell's circumplex):

```
     High Arousal
          ↑
Negative ← → Positive (Valence)
          ↓
      Low Arousal

Quadrants:
  High Arousal + Negative: Fear, Anger, Anxiety
  High Arousal + Positive: Excitement, Euphoria
  Low Arousal + Positive: Calm, Contentment
  Low Arousal + Negative: Sadness, Depression
```

**Risk to Decision Quality**:

```typescript
function calculateEmotionalRisk(state: EmotionalState): number {
  // High arousal = high risk (whether positive or negative)
  const arousalRisk = state.arousal; // 0-1
  
  // Extreme valence = risk (both euphoria and despair are dangerous)
  const valenceRisk = Math.abs(state.valence); // 0-1
  
  // Low dominance = risk (feeling powerless leads to poor decisions)
  const dominanceRisk = 1 - state.dominance; // 0-1
  
  // Combined risk (weighted)
  return (arousalRisk * 0.5) + (valenceRisk * 0.3) + (dominanceRisk * 0.2);
}
```

**Recommendations**:

- Risk < 0.3: Proceed (calm, rational state)
- Risk 0.3-0.6: Caution (consider waiting, seek second opinion)
- Risk > 0.6: Delay (wait until emotional state normalizes)

#### 3. Fear/Greed Cycles

**Detection Patterns**:

**Fear Spiral**:

```
Loss → Fear → Avoid risk → Miss opportunities → Regret → More fear
```

- **Indicators**: Multiple consecutive "avoid" decisions after loss
- **Intervention**: "This is fear talking. What does the EV say?"

**Greed Chase**:

```
Win → Euphoria → Take excessive risk → Big loss → Despair
```

- **Indicators**: Position sizing increasing after wins
- **Intervention**: "Reduce to Kelly Criterion. Wins don't change probabilities."

**Revenge Trading**:

```
Loss → Anger → "I'll make it back" → Larger bet → Bigger loss
```

- **Indicators**: Bet size increases immediately after loss
- **Intervention**: "Stop. Mandatory 24h cooling-off period."

#### 4. Discipline Checklist

Before any high-stakes decision:

```typescript
interface DisciplineCheck {
  // Physical State
  sleptWell: boolean;      // 7+ hours?
  notHungry: boolean;      // Hunger impairs decisions
  notIll: boolean;         // Illness reduces cognitive function
  
  // Emotional State
  emotionalRisk: number;   // <0.3?
  noBiasDetected: boolean; // Checked by bias detector
  notRevengeTrade: boolean;// Not reacting to previous loss
  
  // Timing
  notLateNight: boolean;   // Not 11 PM - 6 AM
  notRushed: boolean;      // Not under time pressure
  
  // Due Diligence
  researchDone: boolean;   // Gathered information?
  alternativesConsidered: boolean; // Explored other options?
  consequencesConsidered: boolean; // Thought through outcomes?
  
  // Meta
  confidence: number;      // How sure am I? (Calibrated)
  secondOpinion: boolean;  // For major decisions, consulted another member?
}

function shouldProceed(check: DisciplineCheck): {
  proceed: boolean;
  warnings: string[];
  requiredActions: string[];
} {
  // Enforce discipline - if checks fail, decision is delayed
}
```

---

### PATHOS (Growth) - Evolving Mind

**Philosophy**: "Every outcome is a teacher. Wisdom compounds."

**Key Principle**: ARI **learns from experience** and integrates timeless wisdom.

**Frameworks**:

#### 1. Reflection Engine (After Every Significant Outcome)

```typescript
async function reflectOnOutcome(outcome: Outcome): Promise<Insight[]> {
  const insights: Insight[] = [];
  
  // 1. What happened? (Facts)
  const actual = outcome.actualValue;
  const expected = outcome.expectedValue;
  const delta = actual - expected;
  
  // 2. Why? (Causal analysis)
  if (delta < 0) {
    // Underperformed expectations
    insights.push({
      type: 'mistake',
      description: 'Actual < Expected',
      evidence: [
        `Expected ${expected}, got ${actual}`,
        `Gap: ${Math.abs(delta)}`,
      ],
      actionable: 'Analyze: What assumptions were wrong?',
    });
  }
  
  // 3. Pattern? (Does this happen repeatedly?)
  const similar = await findSimilarOutcomes(outcome);
  if (similar.length >= 3 && similar.every(s => s.result === 'failure')) {
    insights.push({
      type: 'pattern',
      description: 'Repeated failure in similar situations',
      evidence: similar.map(s => s.action),
      actionable: 'This is a pattern. Need different approach.',
      generalizes: true,
    });
  }
  
  // 4. What to do differently? (Actionable learning)
  insights.push({
    type: 'principle',
    description: await extractPrinciple(outcome, insights),
    actionable: 'Store in memory as decision rule',
  });
  
  return insights;
}
```

**Output Example**:

```
Outcome: "Launch product without beta testing → 10 bugs found in production"

Insights:
1. MISTAKE: "Skipped validation step (beta testing) to save time"
2. PATTERN: "This is the 3rd time I've rushed and found bugs in production"
3. PRINCIPLE: "Time spent on validation < time spent fixing production bugs"
4. ACTIONABLE: "Add 'beta testing' as mandatory gate in future launches"
5. GENERALIZES: Yes - applies to all product launches, not just this one
```

#### 2. CBT Reframing

**Cognitive Distortions** (David Burns):

| Distortion | Example | Reframe |
|------------|---------|---------|
| All-or-nothing | "This failed, I'm a total failure" | "This specific attempt failed. I can try differently." |
| Overgeneralization | "I always mess this up" | "I've struggled with this before, but not always." |
| Mental filter | "Only noticed the one mistake" | "Also made 10 things go right. Perspective?" |
| Catastrophizing | "This will ruin everything" | "Worst case: X. Likely case: Y. Best case: Z." |
| Emotional reasoning | "I feel anxious, so it's dangerous" | "Anxiety is data, not truth. What do facts say?" |

**Implementation**:

```typescript
async function reframeThought(
  thought: string,
  context: Context
): Promise<{
  distortion: CognitiveDistortion | null;
  reframed: string;
  evidence: string[];
}>;
```

#### 3. Stoic Dichotomy of Control

**Epictetus**: "Some things are in our control, others are not."

**In Control**:

- Opinions, impulses, desires, aversions
- Decisions, effort, preparation
- Reactions to events

**Not in Control**:

- Other people's actions
- Market outcomes
- Natural events (weather, illness)
- Past events (already happened)

**Application**:

```typescript
async function analyzeDichotomy(
  situation: string
): Promise<{
  controllable: string[];
  uncontrollable: string[];
  recommendation: string; // Focus energy on controllables
}>;
```

**Example**:

```
Situation: "I'm anxious about upcoming presentation"

Controllable:
- Preparation quality (can practice more)
- Slide design (can improve)
- Breathing/calm techniques (can learn)

Uncontrollable:
- Audience reaction (they'll think what they think)
- Technical issues (projector might fail)
- Competing priorities (other things happening that day)

Recommendation: "Spend next 2 hours practicing (controllable).
Stop worrying about audience reaction (uncontrollable)."
```

#### 4. Meta-Learning (Learning How to Learn)

**Spaced Repetition**:

```
Review intervals for optimal retention (Ebbinghaus curve):
- 1 day after learning
- 3 days
- 7 days
- 14 days
- 30 days
- 60 days
```

**Feynman Technique**:

```
1. Study concept
2. Teach it to a 12-year-old (forces simple explanation)
3. Identify gaps (where you couldn't explain simply)
4. Review and simplify
```

**Transfer Learning**:

```
Learn concept in Domain A
↓
Identify core principle
↓
Apply to Domain B (different context, same principle)
```

**Example**:

- Learn: "Test-driven development" in coding
- Principle: "Define success criteria before execution"
- Transfer: "Define health metrics before starting diet"

---

## Pillar API Structure

### Interface Design

Each pillar exports a focused API:

```typescript
// src/cognition/logos/index.ts
export {
  updateBelief,
  calculateExpectedValue,
  calculateKellyFraction,
  analyzeDecisionTree,
  identifyLeveragePoints,
  analyzeFeedbackLoops,
} from './logos/index.js';

// src/cognition/ethos/index.ts
export {
  detectCognitiveBias,
  checkEmotionalState,
  detectFearGreedCycle,
  checkDiscipline,
} from './ethos/index.js';

// src/cognition/pathos/index.ts
export {
  reflectOnOutcome,
  synthesizeLearning,
  consultWisdom,
  reframeThought,
  analyzeDichotomy,
  createLearningPlan,
} from './pathos/index.js';

// src/cognition/index.ts (unified export)
export * from './logos/index.js';
export * from './ethos/index.js';
export * from './pathos/index.js';
export * from './knowledge/index.js';
```

### Usage Pattern

**Single-Pillar Query**:

```typescript
import { calculateExpectedValue } from '../cognition/logos/expected-value.js';

const ev = await calculateExpectedValue({
  outcomes: [
    { probability: 0.60, value: 1000 },
    { probability: 0.40, value: -500 },
  ],
});
// Returns: 400 (positive EV)
```

**Multi-Pillar Synthesis**:

```typescript
import { calculateExpectedValue } from '../cognition/logos/expected-value.js';
import { detectCognitiveBias } from '../cognition/ethos/bias-detector.js';
import { consultWisdom } from '../cognition/pathos/wisdom.js';

async function makeInformedDecision(decision: Decision): Promise<Recommendation> {
  // LOGOS: Math
  const ev = await calculateExpectedValue(decision);
  
  // ETHOS: Psychology
  const biases = await detectCognitiveBias(reasoning, context);
  
  // PATHOS: Wisdom
  const wisdom = await consultWisdom({
    question: 'How should I approach this decision?',
    traditions: ['stoic', 'dalio'],
  });
  
  // Synthesize
  return {
    recommendation: synthesize(ev, biases, wisdom),
    confidence: calculateConfidence(ev, biases),
    reasoning: explainReasoning(ev, biases, wisdom),
  };
}
```

---

## Consequences (Detailed)

### For Council Members

**Before Layer 0**:

- Members rely on basic heuristics and rules
- Decisions are logical but not probabilistic
- No awareness of own biases
- No learning from outcomes
- No access to wisdom traditions

**After Layer 0**:

- **AEGIS** detects threats using Bayesian probability + trading psychology (risk perception)
- **SCOUT** calculates expected value + Kelly Criterion for every risk assessment
- **MINT** uses behavioral finance to avoid loss aversion and sunk cost fallacy
- **PULSE** applies CBT reframing to health challenges
- **BLOOM** designs learning plans using deliberate practice + spaced repetition
- **VERA** consults Stoic philosophy for ethical dilemmas
- **NEXUS** uses systems thinking to understand complexity

**Result**: Every member becomes **dramatically more capable** in their domain.

### For ARI as a System

**Decision Quality**: Measurably better decisions

- **Before**: ~70% success rate on complex decisions (estimated)
- **After**: 85-90% success rate (target, measured via performance review)
- **Metric**: (Successful outcomes / Total decisions) over 30-day windows

**Bias Reduction**: Fewer emotional/irrational decisions

- **Before**: ~30% of decisions show detectable bias (estimated)
- **After**: <10% of decisions show bias (target)
- **Metric**: Bias detector flags per 100 decisions

**Learning Velocity**: Continuous improvement

- **Before**: ARI doesn't learn from outcomes (static behavior)
- **After**: Measurable improvement in decision quality month-over-month
- **Metric**: Decision quality trend line (should slope upward)

**Wisdom Integration**: Principled reasoning

- **Before**: Decisions are reactive (respond to immediate context)
- **After**: Decisions informed by timeless principles (Stoics, Taleb, Dalio)
- **Metric**: % of decisions that cite wisdom traditions in reasoning

---

## Alternatives Considered

### 1. Two Pillars Only (Reason + Character, No Growth)

**Description**: Implement LOGOS + ETHOS, defer PATHOS to future.

**Pros**:

- 67% reduction in scope (only 2 pillars)
- LOGOS + ETHOS cover most decision-making
- PATHOS is "nice to have", not essential

**Cons**:

- **No learning loop** (PATHOS provides reflection and synthesis)
- **No wisdom traditions** (Stoicism, Dalio, Munger missing)
- **No meta-learning** (can't improve at improving)
- Incomplete (missing emotional/growth dimension)

**Rejected Because**: PATHOS is **critical for continuous improvement**. Without reflection, ARI can't learn from outcomes.

---

### 2. Four Pillars (Split LOGOS into Quantitative + Qualitative)

**Description**: LOGOS-Quant (math), LOGOS-Qual (systems thinking), ETHOS, PATHOS.

**Pros**:

- Clearer separation (math vs systems thinking are different)
- More granular (can specialize further)

**Cons**:

- Over-engineering (math and systems thinking both fall under "reason")
- Four pillars less elegant than three (classical rhetoric is three)
- Harder to remember (three is cognitively manageable)

**Rejected Because**: Three pillars is cleaner. Math + systems thinking are both **rational/logical**, so they belong together.

---

### 3. Five Pillars (Add Technical + Operational)

**Description**: LOGOS, ETHOS, PATHOS, TECHNE (technical skill), PRAXIS (operational excellence).

**Pros**:

- Even more comprehensive
- Technical skills get dedicated pillar
- Operational excellence emphasized

**Cons**:

- Too many pillars (harder to navigate)
- Technical/operational are **applications** of LOGOS (not separate domains)
- Violates parsimony (don't multiply entities unnecessarily)

**Rejected Because**: Technical skill and operational excellence are **outputs** of applying LOGOS/ETHOS/PATHOS, not separate cognitive domains.

---

### 4. Domain-Based Organization (Finance, Health, Relationships, etc.)

**Description**: Organize by life domain instead of cognitive pillar.

**Pros**:

- Maps directly to Council members' coverage areas
- Easy to find domain-specific knowledge
- Aligns with user's mental model (life domains)

**Cons**:

- **Cross-cutting frameworks get duplicated** (Bayesian reasoning needed in ALL domains)
- Hard to share (finance frameworks can't easily apply to health)
- Silos (finance experts can't learn from health experts)

**Rejected Because**: Cognitive frameworks are **universal** (Bayesian reasoning applies everywhere). Domain-based organization would duplicate logic.

---

## Integration Examples

### Example 1: SCOUT Risk Assessment (Uses LOGOS + ETHOS)

```typescript
// src/agents/risk-assessor.ts (hypothetical enhancement)
import { calculateExpectedValue, calculateKellyFraction } from '../cognition/logos/index.js';
import { detectCognitiveBias, checkEmotionalState } from '../cognition/ethos/index.js';

export class RiskAssessor {
  async assessInvestment(investment: Investment): Promise<RiskAssessment> {
    // LOGOS: Calculate expected value
    const ev = await calculateExpectedValue({
      outcomes: [
        { probability: investment.winProb, value: investment.upside },
        { probability: investment.lossProb, value: -investment.downside },
      ],
    });
    
    // LOGOS: Kelly Criterion for position sizing
    const kelly = await calculateKellyFraction({
      winProbability: investment.winProb,
      winPayoff: investment.upside / investment.downside,
      lossProbability: investment.lossProb,
      lossPayoff: 1.0,
    });
    
    // ETHOS: Check for biases in our reasoning
    const biases = await detectCognitiveBias(
      this.currentReasoning,
      { agent: 'SCOUT', decision: investment }
    );
    
    // ETHOS: Check emotional state
    const emotionalState = await checkEmotionalState(
      this.councilMember,
      { recentOutcomes: this.last10Decisions }
    );
    
    // Synthesize
    const recommendation = this.synthesize({
      expectedValue: ev.expectedValue,
      kellyFraction: kelly.halfKelly, // Conservative
      biases,
      emotionalRisk: emotionalState.riskToDecisionQuality,
    });
    
    return {
      expectedValue: ev.expectedValue,
      recommendedAllocation: kelly.halfKelly,
      biasesDetected: biases,
      emotionalRisk: emotionalState.riskToDecisionQuality,
      finalRecommendation: recommendation,
      confidence: this.calculateConfidence(biases, emotionalState),
      reasoning: this.explainReasoning(ev, kelly, biases, emotionalState),
    };
  }
  
  private synthesize(inputs: SynthesisInputs): string {
    // If EV positive AND Kelly > 0 AND no major biases AND low emotional risk
    if (inputs.expectedValue > 0 && 
        inputs.kellyFraction > 0 && 
        inputs.biases.every(b => b.severity < 0.5) &&
        inputs.emotionalRisk < 0.3) {
      return `Invest ${inputs.kellyFraction * 100}% of capital`;
    }
    
    // If biases detected
    if (inputs.biases.some(b => b.severity >= 0.5)) {
      return `Wait - ${inputs.biases[0].mitigation}`;
    }
    
    // If emotionally risky
    if (inputs.emotionalRisk > 0.6) {
      return 'Wait 24h - emotional state too unstable for decision';
    }
    
    // If EV negative
    if (inputs.expectedValue < 0) {
      return 'Avoid - negative expected value';
    }
    
    return 'Neutral - need more information';
  }
}
```

### Example 2: BLOOM Learning Plan (Uses PATHOS + LOGOS)

```typescript
// src/agents/growth.ts (hypothetical)
import { createLearningPlan } from '../cognition/pathos/meta-learning.js';
import { analyzeDecisionTree } from '../cognition/logos/decision-trees.js';

export class GrowthAgent {
  async planSkillAcquisition(skill: string): Promise<LearningPlan> {
    // PATHOS: Generate learning plan using deliberate practice + spaced repetition
    const plan = await createLearningPlan({
      skill,
      currentLevel: await this.assessCurrentLevel(skill),
      targetLevel: 80, // 0-100 scale
      timeframe: '6 months',
    });
    
    // LOGOS: Decision tree - multiple learning paths
    const paths = await analyzeDecisionTree({
      question: 'How to learn this skill?',
      options: [
        { choice: 'Self-study', probability: 0.50, ev: 60 },
        { choice: 'Course', probability: 0.70, ev: 75 },
        { choice: 'Mentor', probability: 0.85, ev: 85 },
        { choice: 'Immersion', probability: 0.90, ev: 90 },
      ],
    });
    
    // Combine: Meta-learning plan + optimal path
    return {
      skill,
      optimalPath: paths.optimalPath, // ['Mentor', 'Immersion']
      techniques: plan.techniques,    // ['Deliberate practice', 'Spaced repetition']
      schedule: plan.milestones,
      estimatedHours: plan.estimatedHours,
      checkpoints: plan.milestones,
    };
  }
}
```

---

## Success Metrics

### Quantitative (Measurable)

1. **API Usage**: 100+ cognitive API calls per day (shows adoption)
2. **Decision Quality**: 85%+ success rate on tracked decisions (vs 70% baseline)
3. **Bias Detection**: Flags biases in 10-15% of decisions (vs 0% currently)
4. **Learning Velocity**: 5+ new insights per week stored in memory
5. **Knowledge Growth**: Knowledge base grows 50+ documents per month
6. **Specialization Coverage**: All 15 members have 80%+ of their specialization knowledge loaded

### Qualitative (Observed)

1. **Richer Reasoning**: Decisions cite frameworks (Bayesian, Stoic, Kelly) in explanations
2. **Bias Awareness**: Members acknowledge when emotions affecting judgment
3. **Wisdom Integration**: Frequent consultation of wisdom traditions (daily+)
4. **Cross-Pollination**: Members learn from each other's specializations
5. **Continuous Improvement**: Observable learning from past mistakes (don't repeat errors)

---

## Timeline

**Design**: 2-3 weeks (ADRs + pillar design docs)

**Implementation**:

- LOGOS: 2 weeks
- ETHOS: 2 weeks  
- PATHOS: 2 weeks
- Integration: 2 weeks
- **Total**: 8 weeks for three-pillar implementation

---

## Conclusion

The three-pillar framework (LOGOS/ETHOS/PATHOS) provides:

✅ **Complete cognitive coverage** (reason + character + growth)  
✅ **Clear organization** (Council members know where to find frameworks)  
✅ **Balanced integration** (no single pillar dominates)  
✅ **Timeless structure** (2000+ years of rhetorical tradition)  
✅ **Practical implementation** (concrete APIs, real frameworks)  
✅ **Scalable** (can add frameworks within pillars without restructuring)

This is the **cognitive foundation** that transforms ARI from a smart system into a wise system.

---

**Last Updated**: 2026-02-01  
**Status**: PROPOSED  
**Dependencies**: ADR-009 (must pass first)  
**Next**: ADR-011 (Knowledge Source Trust Model)
