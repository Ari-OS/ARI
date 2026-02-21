# ETHOS Pillar: The Character Engine

**Version**: 1.0.0  
**Status**: Design Documentation  
**Date**: 2026-02-01  
**Related ADRs**: ADR-009, ADR-010, ADR-013

---

## Table of Contents

1. [Philosophy & Purpose](#philosophy--purpose)
2. [Framework Catalog](#framework-catalog)
3. [Trading Psychology](#1-trading-psychology)
4. [Cognitive Bias Detection](#2-cognitive-bias-detection)
5. [Emotional State Monitoring](#3-emotional-state-monitoring)
6. [Fear/Greed Cycle Detection](#4-feargreed-cycle-detection)
7. [Discipline Systems](#5-discipline-systems)
8. [Behavioral Finance](#6-behavioral-finance)
9. [Knowledge Sources](#knowledge-sources)
10. [Implementation Guide](#implementation-guide)
11. [Council Integration](#council-integration)

---

## Philosophy & Purpose

### The Core Thesis

> **"Know thyself. Humans are emotional and biased. Awareness + discipline > denial."**

ETHOS (ἦθος) - Greek for "character", "credibility", "ethics" - represents the **disciplined mind** that recognizes emotional and cognitive biases, then acts with discipline despite them.

### Why Emotional Intelligence for AI?

ARI makes decisions that affect a human's life (Pryce). Those decisions must account for **human psychology**:

**Without ETHOS**:

- "The math says invest $10K" (ignores that user just lost $5K yesterday and is emotional)
- "EV is positive, proceed" (ignores confirmation bias in probability estimates)
- "Kelly says 40%" (ignores that euphoria from recent wins is inflating confidence)

**With ETHOS**:

- "Math says $10K, but you lost $5K yesterday. Emotional risk is high (0.75). **Wait 24h**."
- "EV is positive, but you're showing confirmation bias (only cited supporting evidence). **Seek contradicting evidence** first."
- "Kelly says 40%, but recent win streak suggests euphoria. **Use quarter-Kelly** (10%) until emotional state normalizes."

**Result**: Decisions that work with **human psychology**, not against it.

---

## Framework Catalog

### The Six ETHOS Frameworks

1. **Trading Psychology** (Mark Douglas, Van Tharp) - Discipline under uncertainty
2. **Cognitive Bias Detection** (Kahneman, Tversky) - 10 common biases
3. **Emotional State Monitoring** (Russell's circumplex) - Valence × arousal × dominance
4. **Fear/Greed Cycle Detection** - Emotional momentum patterns
5. **Discipline Systems** (Pre-decision checks, cooling-off periods)
6. **Behavioral Finance** (Thaler, Kahneman) - Money-specific biases

**Together**: Complete toolkit for **emotionally intelligent** decision-making.

### Quick Reference

| Framework | Primary Use | Detects | Council Members |
|-----------|-------------|---------|-----------------|
| **Trading Psychology** | Maintain discipline | Impulsive decisions | AEGIS, MINT, SCOUT, OPAL |
| **Bias Detection** | Identify reasoning errors | 10 cognitive biases | ALL (universal) |
| **Emotional State** | Monitor decision quality | Fear, greed, euphoria | AEGIS, MINT, EMBER, PULSE |
| **Fear/Greed Cycles** | Break emotional patterns | Revenge trading, chasing | MINT, SCOUT, AEGIS |
| **Discipline Systems** | Enforce healthy decisions | Rushed, emotional decisions | MINT, BLOOM, TEMPO |
| **Behavioral Finance** | Money-specific biases | Mental accounting, endowment | MINT, SCOUT, OPAL |

---

## 1. Trading Psychology

### The Fundamental Insight

**Mark Douglas** (Trading in the Zone, 2000):

> Trading (and life) is a probability game. You cannot control outcomes, only probabilities. Acceptance of this fact is the foundation of disciplined decision-making.

### The Five Fundamental Truths (Douglas)

**Truth 1: Anything can happen**

- No matter how certain you are, any outcome is possible
- 95% probability ≠ 100% (still 5% chance of opposite)
- **Application**: Never be 100% confident, always prepare for surprise

**Truth 2: You don't need to know what's going to happen next to make money**

- You need an **edge** (probability advantage), not certainty
- Win probability > 50% is enough (don't need to predict specific outcome)
- **Application**: Focus on **process** (edge), not outcome (prediction)

**Truth 3: There is a random distribution between wins and losses for any set of variables that define an edge**

- Wins and losses come in random clusters
- 5 losses in a row ≠ system is broken (could be normal variance)
- **Application**: Don't abandon strategy after losses (unless edge is gone)

**Truth 4: An edge is nothing more than an indication of a higher probability of one thing happening over another**

- Edge doesn't guarantee wins (just makes them more likely)
- **Application**: Accept losses as part of the game (they will happen)

**Truth 5: Every moment in the market (or life) is unique**

- Past patterns don't guarantee future outcomes
- **Application**: Avoid over-fitting to past (each situation is new)

---

### Probabilistic Mindset

**Shift from**:

- "This WILL work" (certainty)
- "I KNOW what will happen" (prediction)
- "I'm RIGHT" (ego attachment)

**Shift to**:

- "This has 60% chance of working" (probability)
- "I estimate outcomes, I don't predict them" (humility)
- "I'm making a bet with positive EV, outcome is uncertain" (detachment)

**Implementation**:

```typescript
export interface ProbabilisticMindset {
  avoidsCertainty: boolean;       // Never says "definitely" or "always"
  expressesProbabilities: boolean;// Uses percentages, not absolutes
  acceptsUncertainty: boolean;    // Comfortable with not knowing
  detachedFromOutcomes: boolean;  // Doesn't tie ego to results
  focusesOnProcess: boolean;      // Cares about edge, not individual outcomes
}

export async function assessMindset(
  reasoning: string
): Promise<{
  score: number;                  // 0-1 (1 = perfect probabilistic mindset)
  violations: string[];           // Certainty language detected
  recommendations: string[];
}> {
  // Detect certainty language
  const certaintyPhrases = [
    /\b(definitely|certainly|absolutely|always|never|guaranteed|100%)\b/gi,
    /\b(I know|I'm sure|I'm certain|This will)\b/gi,
  ];
  
  const violations: string[] = [];
  for (const pattern of certaintyPhrases) {
    const matches = reasoning.match(pattern);
    if (matches) {
      violations.push(...matches);
    }
  }
  
  // Check for probabilistic language
  const probabilisticPhrases = [
    /\b(\d+% (chance|probability))\b/gi,
    /\b(likely|unlikely|probable|expected|estimated)\b/gi,
  ];
  
  const hasProbabilistic = probabilisticPhrases.some(p => p.test(reasoning));
  
  // Score
  const score = violations.length === 0 ? (hasProbabilistic ? 1.0 : 0.7) : 0.3;
  
  return {
    score,
    violations,
    recommendations: violations.length > 0 ? [
      'Replace certainty language with probabilities',
      'Instead of "This will work", say "This has 70% chance of working"',
      'Instead of "I know", say "I estimate" or "Based on evidence, I believe"',
    ] : [],
  };
}
```

---

### Emotional Regulation (Douglas)

**The Challenge**: Emotions drive bad decisions.

**Common Emotional Patterns in Decision-Making**:

1. **Fear**:
   - Symptom: Avoiding action despite positive EV
   - Example: "The market might crash" (paralysis despite good odds)
   - Result: Missed opportunities

2. **Greed**:
   - Symptom: Over-sizing bets during win streaks
   - Example: "I'm on a roll, bet bigger!" (euphoria)
   - Result: Excessive risk, eventual large loss

3. **Anger** (Revenge Trading):
   - Symptom: Betting bigger after loss to "make it back"
   - Example: "I lost $1K, I'll bet $3K to recover" (tilting)
   - Result: Compounding losses

4. **Euphoria**:
   - Symptom: Overconfidence after wins
   - Example: "I can't lose!" (hubris)
   - Result: Ignoring risks, taking bad bets

**Douglas's Solution**: **Accept emotions exist, act according to rules anyway.**

**Implementation**:

```
1. Recognize emotion ("I'm feeling greedy")
2. Acknowledge it's affecting judgment ("This is making me want to bet bigger")
3. Apply discipline system ("My rules say use Kelly Criterion, regardless of emotion")
4. Act according to rules ("Kelly says 20%, so betting 20% despite wanting to bet 40%")
```

**NOT**: "Suppress emotion" or "Be perfectly rational" (impossible).

**BUT**: "Feel the emotion, act with discipline" (possible).

---

### Van Tharp's Contributions

**Position Sizing Psychology** (Trade Your Way to Financial Freedom):

**Expectancy**:

```
Expectancy = (Win% × AvgWin) - (Loss% × AvgLoss)
```

**Example**:

```
System:
  Wins: 60% of trades, average $600 profit
  Losses: 40% of trades, average $400 loss

Expectancy = (0.60 × $600) - (0.40 × $400)
           = $360 - $160
           = $200 per trade

Interpretation: This system makes $200 per trade on average.
```

**R-Multiples** (Normalize to risk):

```
If risking $100 per trade:
  Win: $600 profit = +6R
  Loss: $400 loss = -4R

Expectancy = (0.60 × 6R) - (0.40 × 4R)
           = 3.6R - 1.6R
           = 2R per trade
```

**System Confidence**:

```
How confident should you be in your system?

Confidence = Expectancy / (AvgWin + AvgLoss)
```

**Application to ARI**:

- Use **expectancy** to evaluate decision systems (is this approach working?)
- Use **R-multiples** to normalize outcomes (big bets vs small bets)
- Use **system confidence** to know when to scale up (high confidence) or down (low confidence)

---

## 2. Cognitive Bias Detection

### The Fundamental Insight

**Daniel Kahneman & Amos Tversky** (Prospect Theory, 1979):

> Humans use **heuristics** (mental shortcuts) that work most of the time but create **systematic biases** in specific situations. These biases are predictable and detectable.

### The 10 Primary Biases (ARI Implementation)

#### Bias 1: Confirmation Bias

**Definition**: Seeking information that confirms existing beliefs, ignoring contradicting evidence.

**Example**:

```
Belief: "This investment will succeed"
Search behavior:
  ✅ Finds: 5 articles supporting the investment
  ❌ Ignores: 3 articles warning against it
Result: Overconfident (only saw one side)
```

**Detection Pattern**:

```typescript
function detectConfirmationBias(reasoning: string, context: Context): BiasDetection | null {
  // Pattern 1: Only cites supporting evidence
  const evidenceCount = countEvidence(reasoning);
  if (evidenceCount.supporting > 0 && evidenceCount.contradicting === 0) {
    return {
      bias: 'CONFIRMATION_BIAS',
      severity: 0.70,
      evidence: ['Only cited supporting evidence, no contradicting evidence'],
      mitigation: 'Actively seek evidence that CONTRADICTS your belief. Steel-man the opposite position.',
    };
  }
  
  // Pattern 2: Uses phrases like "as I suspected", "as expected", "confirms what I thought"
  const confirmationPhrases = /\b(as I suspected|as expected|confirms what|proves my)\b/gi;
  if (confirmationPhrases.test(reasoning)) {
    return {
      bias: 'CONFIRMATION_BIAS',
      severity: 0.60,
      evidence: ['Language suggests seeking confirmation'],
      mitigation: 'Ask: What would prove me wrong? Have I looked for that?',
    };
  }
  
  return null;
}
```

**Mitigation**:

- **Steel-manning**: Argue the OPPOSITE position as strongly as possible
- **Falsification**: Look for evidence that would prove you WRONG
- **Devil's advocate**: Ask another Council member to critique

---

#### Bias 2: Sunk Cost Fallacy

**Definition**: Continuing investment because of past costs (which are irrelevant to future decisions).

**Example**:

```
Decision: "I've already spent $10K on this project. Should I spend another $5K?"

Biased reasoning: "I've invested so much, I can't quit now. Spend $5K more."
Rational reasoning: "The past $10K is gone (sunk cost). Evaluate the NEW $5K decision independently.
                     Would I invest $5K in this project if I had zero prior exposure?"
```

**Detection Pattern**:

```typescript
function detectSunkCostFallacy(reasoning: string): BiasDetection | null {
  // Phrases indicating sunk cost thinking
  const sunkCostPhrases = [
    /\b(already spent|already invested|can't quit now|too much invested)\b/gi,
    /\b(wasted if I stop|all for nothing)\b/gi,
    /\b(after all this|gone to waste)\b/gi,
  ];
  
  for (const pattern of sunkCostPhrases) {
    if (pattern.test(reasoning)) {
      return {
        bias: 'SUNK_COST_FALLACY',
        severity: 0.80,
        evidence: ['Reasoning references past investment as justification for future action'],
        mitigation: 'Ignore sunk costs. Evaluate the NEW decision independently. Would you make this investment with zero prior exposure?',
        examples: [
          'Bad: "I\'ve spent $10K, so I should spend $5K more"',
          'Good: "Would I invest $5K in this project TODAY, knowing what I know? (Forget the $10K)"',
        ],
      };
    }
  }
  
  return null;
}
```

**Mitigation**:

- **Mental reset**: Imagine you have zero prior exposure, would you invest NOW?
- **Opportunity cost**: What else could you do with those resources?
- **Cutting losses**: Sometimes the best decision is to stop (exit discipline)

---

#### Bias 3: Recency Bias

**Definition**: Overweighting recent events, underweighting long-term history.

**Example**:

```
Market: Down 3 days in a row
Recency biased: "Market is crashing, sell everything!"
Reality: Over 30 days, market is up 5% (3-day dip is noise)
```

**Detection Pattern**:

```typescript
function detectRecencyBias(reasoning: string, context: Context): BiasDetection | null {
  // Check if decision is based on very recent events (< 7 days)
  const recentEventPhrases = [
    /\b(yesterday|today|this week|recently|just happened|latest)\b/gi,
    /\b(last (2|3|few) days)\b/gi,
  ];
  
  const mentionsRecent = recentEventPhrases.some(p => p.test(reasoning));
  
  // Check if ignores longer-term trend
  const mentionsLongTerm = /\b(historically|over (months|years)|long-term|average)\b/gi.test(reasoning);
  
  if (mentionsRecent && !mentionsLongTerm) {
    return {
      bias: 'RECENCY_BIAS',
      severity: 0.65,
      evidence: ['Reasoning focuses on recent events without long-term context'],
      mitigation: 'Zoom out. What does the 30-day trend show? 90-day? 1-year?',
      examples: [
        'Biased: "Market dropped yesterday, so selling"',
        'Balanced: "Market dropped yesterday (-2%), but up 5% over 30 days. Holding."',
      ],
    };
  }
  
  return null;
}
```

**Mitigation**:

- **Zoom out**: Check 30-day, 90-day, 1-year trends
- **Base rates**: What's the historical average?
- **Sample size**: One data point ≠ trend

---

#### Bias 4: Loss Aversion

**Definition**: Fear of losses is stronger than desire for equivalent gains. Losses hurt ~2x more than gains feel good.

**Kahneman & Tversky Finding**:

```
Would you take this bet?
  50% chance: Win $100
  50% chance: Lose $100

Rational: EV = 0 (neutral, should be indifferent)
Actual: Most people REJECT (loss hurts more than gain helps)

Break-even bet:
  50% chance: Win $200
  50% chance: Lose $100
  
EV = +$50, but many still reject (loss aversion)
```

**Detection Pattern**:

```typescript
function detectLossAversion(reasoning: string, decision: Decision): BiasDetection | null {
  // Check if focusing on downside despite positive EV
  const downsidePhrases = [
    /\b(but (what if|suppose) (it|we) (lose|fail))\b/gi,
    /\b(too risky|can't afford to lose|what if it doesn't work)\b/gi,
  ];
  
  const emphasisOnDownside = downsidePhrases.some(p => p.test(reasoning));
  
  // Check if decision has positive EV but is being avoided
  if (emphasisOnDownside && decision.expectedValue && decision.expectedValue > 0) {
    return {
      bias: 'LOSS_AVERSION',
      severity: 0.75,
      evidence: ['Focusing on downside despite positive expected value'],
      mitigation: 'Losses are part of probability. If EV is positive and risk is acceptable (Kelly-sized), proceed despite fear of loss.',
      examples: [
        'Biased: "EV is +$50, but what if I lose? Too risky."',
        'Rational: "EV is +$50. I\'ll lose sometimes (40%), but long-term this is profitable."',
      ],
    };
  }
  
  return null;
}
```

**Mitigation**:

- **Reframe**: Losses are **data**, not failures
- **Expected value**: Focus on long-term average, not individual outcomes
- **Kelly sizing**: Use proper position sizing (limits maximum loss)

---

#### Bias 5: Overconfidence

**Definition**: Overestimating own abilities, knowledge, or predictions.

**Dunning-Kruger Effect**: Incompetence → overconfidence (know just enough to be dangerous).

**Example**:

```
After reading one book on investing: "I understand the market now!"
Reality: Read 1 book = know 1% of investing (far from expert)
```

**Detection Pattern**:

```typescript
function detectOverconfidence(reasoning: string, context: Context): BiasDetection | null {
  // Pattern 1: Uses absolute language
  const absolutePhrases = /\b(definitely|certainly|no doubt|I know|easy|simple|obvious)\b/gi;
  if (absolutePhrases.test(reasoning)) {
    return {
      bias: 'OVERCONFIDENCE',
      severity: 0.70,
      evidence: ['Absolute language suggests overconfidence'],
      mitigation: 'Ask: What could go wrong? What don\'t I know? What\'s my confidence interval (range)?',
    };
  }
  
  // Pattern 2: Estimates with unrealistic precision
  const precisePredictions = /\b\d{2,}\.\d{2,}%\b/g; // "73.42%" (false precision)
  if (precisePredictions.test(reasoning)) {
    return {
      bias: 'OVERCONFIDENCE',
      severity: 0.50,
      evidence: ['Over-precise estimates (implies false confidence)'],
      mitigation: 'Round estimates to reasonable precision (70% not 73.42%)',
    };
  }
  
  return null;
}
```

**Mitigation**:

- **Confidence intervals**: Instead of "70%", say "60-80% range"
- **Base rates**: "How often do similar things succeed?" (outside view)
- **Pre-mortem**: "Assume this failed. What went wrong?" (forces consideration of failure modes)

---

### Full Bias Catalog (All 10 Implemented)

| Bias | Detects | Severity When Detected | Primary Mitigation |
|------|---------|------------------------|-------------------|
| 1. Confirmation | Seeking only confirming evidence | 0.70 | Steel-man opposite view |
| 2. Sunk Cost | Can't let go of past investments | 0.80 | Evaluate new decision independently |
| 3. Recency | Overweight recent events | 0.65 | Zoom out to longer timeframe |
| 4. Loss Aversion | Fear of loss > desire for gain | 0.75 | Focus on EV, not fear |
| 5. Overconfidence | Overestimate abilities | 0.70 | Ask "What could go wrong?" |
| 6. Anchoring | Over-rely on first number seen | 0.60 | Ignore anchor, assess intrinsic value |
| 7. Availability | Overweight memorable examples | 0.55 | Check statistics, not vivid memories |
| 8. Hindsight | "I knew it all along" | 0.40 | Review predictions made beforehand |
| 9. Gambler's | Expect mean reversion | 0.60 | Events are independent (usually) |
| 10. Dunning-Kruger | Incompetence → overconfidence | 0.75 | "What are my unknown unknowns?" |

**Detection Strategy**: Run **all 10 checks** on every significant decision. Flag any with severity > 0.50.

---

## 3. Emotional State Monitoring

### Russell's Circumplex Model

**Two Dimensions**:

1. **Valence**: Negative (-1) ← → Positive (+1)
2. **Arousal**: Low (0) ← → High (1)

**Four Quadrants**:

```
          High Arousal (1.0)
                 ↑
                 |
    Fear, Anger  |  Excitement, Euphoria
    Anxiety      |  Enthusiasm
                 |
Negative ←───────┼───────→ Positive (Valence)
  (-1)           |           (+1)
                 |
    Sadness,     |  Calm, Contentment
    Depression   |  Relaxation
                 |
                 ↓
          Low Arousal (0.0)
```

**Third Dimension**: **Dominance** (Mehrabian)

- 0.0 = Powerless, out of control
- 1.0 = In control, empowered

---

### Emotional Risk Calculation

**Formula**:

```typescript
function calculateEmotionalRisk(state: EmotionalState): number {
  // High arousal = risky (whether positive or negative)
  const arousalRisk = state.arousal; // 0-1
  
  // Extreme valence = risky (both euphoria and despair)
  const valenceRisk = Math.abs(state.valence); // 0-1
  
  // Low dominance = risky (feeling powerless)
  const dominanceRisk = 1 - state.dominance; // 0-1
  
  // Weighted combination
  const risk = 
    (arousalRisk * 0.50) +        // Arousal is most important
    (valenceRisk * 0.30) +        // Extreme emotions are risky
    (dominanceRisk * 0.20);       // Feeling powerless is risky
  
  return Math.min(1.0, risk);
}
```

**Risk Thresholds**:

- **< 0.30**: Safe (calm, rational state)
- **0.30 - 0.60**: Caution (elevated emotion, consider waiting)
- **> 0.60**: High risk (delay decision, seek second opinion)
- **> 0.80**: Critical (mandatory cooling-off period)

**Recommendations by Risk**:

| Risk | Recommendation | Cooling-Off | Example State |
|------|---------------|-------------|---------------|
| 0.10 | Proceed | None | Calm, clear-headed |
| 0.35 | Caution | Consider 10min | Slightly anxious |
| 0.55 | Wait | 30-60min | Excited or frustrated |
| 0.70 | Delay | 2-4 hours | Angry or euphoric |
| 0.85 | Stop | 24 hours | Rage or extreme euphoria |

---

### Implementation Specification

**File**: `src/cognition/ethos/emotional-state.ts`

```typescript
export interface EmotionalState {
  agent: string;
  timestamp: Date;
  valence: number;                // -1 to +1
  arousal: number;                // 0 to 1
  dominance: number;              // 0 to 1
  detectedEmotions: EmotionLabel[];
  riskToDecisionQuality: number;  // 0 to 1 (from formula above)
  recommendation: 'proceed' | 'caution' | 'wait' | 'delay' | 'stop';
  coolingOffPeriod: number;       // Minutes (0 if proceed/caution)
  reasoning: string[];
  provenance: {
    framework: 'Dimensional Emotion Model (Russell, 1980)';
    dimensions: ['Valence', 'Arousal', 'Dominance'];
    computedAt: Date;
  };
}

export type EmotionLabel = 
  | 'calm' | 'content' | 'relaxed'                    // Low arousal, positive
  | 'excited' | 'euphoric' | 'enthusiastic'           // High arousal, positive
  | 'anxious' | 'fearful' | 'panicked'                // High arousal, negative
  | 'sad' | 'depressed' | 'melancholic'               // Low arousal, negative
  | 'angry' | 'frustrated' | 'enraged'                // High arousal, very negative
  | 'greedy' | 'fomo';                                // Context-specific

/**
 * Assess emotional state of Council member
 * 
 * @param agent - Which Council member
 * @param context - Recent outcomes, current decision, time of day
 * @returns Emotional state with risk assessment and recommendations
 */
export async function checkEmotionalState(
  agent: string,
  context: {
    recentOutcomes?: Outcome[];
    currentDecision?: Decision;
    timeSinceLastDecision?: number;  // minutes
    timeOfDay?: string;              // ISO time or "2:30 AM"
    hoursSlept?: number;
  }
): Promise<EmotionalState> {
  // Estimate valence based on recent outcomes
  const valence = estimateValence(context.recentOutcomes);
  
  // Estimate arousal based on outcome magnitude and timing
  const arousal = estimateArousal(context.recentOutcomes, context.timeSinceLastDecision);
  
  // Estimate dominance based on success rate and context
  const dominance = estimateDominance(context.recentOutcomes);
  
  // Map to emotion labels
  const emotions = mapToEmotions(valence, arousal, dominance);
  
  // Calculate risk
  const risk = calculateEmotionalRisk({ valence, arousal, dominance });
  
  // Determine recommendation
  const { recommendation, coolingOff } = determineRecommendation(risk);
  
  return {
    agent,
    timestamp: new Date(),
    valence,
    arousal,
    dominance,
    detectedEmotions: emotions,
    riskToDecisionQuality: risk,
    recommendation,
    coolingOffPeriod: coolingOff,
    reasoning: buildEmotionalReasoning(valence, arousal, dominance, emotions, risk),
    provenance: {
      framework: 'Dimensional Emotion Model (Russell, 1980)',
      dimensions: ['Valence', 'Arousal', 'Dominance (Mehrabian)'],
      computedAt: new Date(),
    },
  };
}

// ── Estimation Functions ───────────────────────────────────

function estimateValence(outcomes?: Outcome[]): number {
  if (!outcomes || outcomes.length === 0) return 0.0; // Neutral
  
  // Recent outcomes influence valence
  const recentOutcomes = outcomes.slice(-5); // Last 5
  const successCount = recentOutcomes.filter(o => o.result === 'success').length;
  const failureCount = recentOutcomes.filter(o => o.result === 'failure').length;
  
  // Valence = (successes - failures) / total, scaled to -1 to +1
  const valence = (successCount - failureCount) / recentOutcomes.length;
  
  return Math.max(-1, Math.min(1, valence));
}

function estimateArousal(outcomes?: Outcome[], timeSinceLastDecision?: number): number {
  let arousal = 0.3; // Baseline
  
  // Recent high-magnitude outcome increases arousal
  if (outcomes && outcomes.length > 0) {
    const lastOutcome = outcomes[outcomes.length - 1];
    const magnitude = Math.abs(lastOutcome.actualValue - lastOutcome.expectedValue);
    
    if (magnitude > 50) {
      arousal += 0.4; // Large surprise → high arousal
    }
  }
  
  // Quick succession of decisions increases arousal
  if (timeSinceLastDecision !== undefined && timeSinceLastDecision < 30) {
    arousal += 0.3; // Rapid decisions → heightened state
  }
  
  return Math.min(1.0, arousal);
}

function estimateDominance(outcomes?: Outcome[]): number {
  if (!outcomes || outcomes.length === 0) return 0.5; // Neutral
  
  // Success increases sense of control
  const successRate = outcomes.filter(o => o.result === 'success').length / outcomes.length;
  
  // Dominance roughly tracks success rate
  return Math.max(0.2, Math.min(0.9, successRate));
}

function mapToEmotions(
  valence: number,
  arousal: number,
  dominance: number
): EmotionLabel[] {
  const emotions: EmotionLabel[] = [];
  
  // High arousal + positive valence = excitement/euphoria
  if (arousal > 0.6 && valence > 0.4) {
    emotions.push(arousal > 0.8 ? 'euphoric' : 'excited');
    if (dominance > 0.7) emotions.push('greedy'); // Euphoria + control = greed
  }
  
  // High arousal + negative valence = fear/anger
  if (arousal > 0.6 && valence < -0.4) {
    emotions.push(valence < -0.7 ? 'fearful' : 'anxious');
    if (dominance < 0.4) emotions.push('panicked');
  }
  
  // High arousal + very negative = anger
  if (arousal > 0.7 && valence < -0.6) {
    emotions.push('angry');
  }
  
  // Low arousal + positive = calm
  if (arousal < 0.4 && valence > 0.2) {
    emotions.push('calm');
  }
  
  // Low arousal + negative = sad
  if (arousal < 0.4 && valence < -0.2) {
    emotions.push('sad');
  }
  
  return emotions.length > 0 ? emotions : ['calm'];
}
```

---

## 4. Fear/Greed Cycle Detection

### The Fundamental Insight

**Trading Psychology**: Emotional cycles drive bad decisions.

**Common Cycles**:

1. **Fear Spiral**: Loss → Fear → Avoid risk → Miss opportunities → Regret → More fear
2. **Greed Chase**: Win → Euphoria → Excessive risk → Big loss → Despair
3. **Revenge Trading**: Loss → Anger → "I'll make it back" → Larger bet → Bigger loss
4. **Euphoria**: Win streak → "I can't lose!" → Ignore risks → Eventually lose

**Detection**: Analyze **sequence** of decisions and outcomes for patterns.

---

### Pattern Recognition

#### Pattern 1: Fear Spiral

**Signature**:

```
T0: Loss (-$500)
T1: Small bet ($100, down from usual $500) - FEAR
T2: Win (+$80)
T3: Still small bet ($120) - STILL CAUTIOUS
T4: Another small bet ($100)
T5: Miss big opportunity (avoided due to fear)

Diagnosis: Fear spiral (one loss → persistent risk avoidance)
```

**Detection Algorithm**:

```typescript
function detectFearSpiral(
  decisions: Decision[],
  outcomes: Outcome[]
): FearGreedCycle | null {
  // Need at least 4 decisions to detect pattern
  if (decisions.length < 4) return null;
  
  // Look for: Loss followed by consecutively smaller bets
  for (let i = 0; i < outcomes.length - 3; i++) {
    const outcome = outcomes[i];
    
    if (outcome.result === 'failure') {
      // Check next 3 decisions
      const nextBets = decisions.slice(i + 1, i + 4);
      const betSizes = nextBets.map(d => d.context?.betSize as number || 0);
      
      // Are bet sizes decreasing?
      const isDecreasing = betSizes.every((size, idx) => 
        idx === 0 || size <= betSizes[idx - 1]
      );
      
      // Are bets smaller than average?
      const avgBet = calculateAverageBetSize(decisions);
      const allSmaller = betSizes.every(size => size < avgBet * 0.70);
      
      if (isDecreasing && allSmaller) {
        return {
          detected: true,
          pattern: 'fear_spiral',
          severity: 0.75,
          evidence: [
            `Loss at T${i}: ${outcome.actualValue}`,
            `Next 3 bets: ${betSizes.join(', ')} (decreasing)`,
            `All < 70% of average (${avgBet})`,
          ],
          duration: `${nextBets.length} decisions`,
          suggestion: 'Fear is making you too cautious. Return to Kelly-sized bets. Start small to rebuild confidence.',
          coolingOffPeriod: 0, // No wait needed (already waiting too much)
          examples: nextBets.map(d => d.description),
          historicalPattern: {
            previousOccurrences: await countPreviousFearSpirals(agent),
            lastOccurrence: await getLastFearSpiral(agent),
            averageDuration: 5, // days (historical average)
          },
        };
      }
    }
  }
  
  return null;
}
```

---

#### Pattern 2: Greed Chase

**Signature**:

```
T0: Win (+$800)
T1: Bigger bet ($1,200, up from usual $500) - GREED
T2: Win again (+$1,000)
T3: Even bigger bet ($2,000) - CHASING
T4: Big loss (-$1,500) - CRASH

Diagnosis: Greed chase (wins → overconfidence → excessive bets → crash)
```

**Detection Algorithm**:

```typescript
function detectGreedChase(
  decisions: Decision[],
  outcomes: Outcome[]
): FearGreedCycle | null {
  // Look for: Win streak followed by increasing bet sizes
  for (let i = 0; i < outcomes.length - 2; i++) {
    // Check if last 2 outcomes were wins
    if (outcomes[i].result === 'success' && outcomes[i+1].result === 'success') {
      // Check if bet sizes increased
      const bet1 = decisions[i].context?.betSize as number || 0;
      const bet2 = decisions[i+1].context?.betSize as number || 0;
      const bet3 = decisions[i+2].context?.betSize as number || 0;
      
      if (bet2 > bet1 * 1.3 && bet3 > bet2 * 1.2) {
        // Bets increasing by >30% and >20% = greed chase
        return {
          detected: true,
          pattern: 'greed_chase',
          severity: 0.85,
          evidence: [
            `Win streak: T${i} and T${i+1}`,
            `Bet sizes increasing: ${bet1} → ${bet2} → ${bet3}`,
            `Increases: +${((bet2/bet1 - 1) * 100).toFixed(0)}%, +${((bet3/bet2 - 1) * 100).toFixed(0)}%`,
          ],
          duration: '2-3 decisions',
          suggestion: 'Greed is making you overbet. Return to Kelly Criterion. Wins don\'t change the probabilities.',
          coolingOffPeriod: 60, // 1 hour mandatory wait
          examples: decisions.slice(i, i+3).map(d => d.description),
          historicalPattern: {
            previousOccurrences: await countPreviousGreedChases(agent),
            lastOccurrence: await getLastGreedChase(agent),
            averageDuration: 3, // decisions
          },
        };
      }
    }
  }
  
  return null;
}
```

---

#### Pattern 3: Revenge Trading

**Signature**:

```
T0: Loss (-$500)
T1: Immediately after, larger bet ($1,500) - "I'll make it back"
T2: Loss again (-$1,000) - Compounding

Diagnosis: Revenge trading (anger → aggressive bet → bigger loss)
```

**Detection Algorithm**:

```typescript
function detectRevenge Trading(
  decisions: Decision[],
  outcomes: Outcome[]
): FearGreedCycle | null {
  // Look for: Loss followed IMMEDIATELY by larger bet
  for (let i = 0; i < outcomes.length - 1; i++) {
    const outcome = outcomes[i];
    
    if (outcome.result === 'failure') {
      const thisDecision = decisions[i];
      const nextDecision = decisions[i + 1];
      
      const thisBet = thisDecision.context?.betSize as number || 0;
      const nextBet = nextDecision.context?.betSize as number || 0;
      
      // Time between decisions
      const timeDelta = new Date(nextDecision.timestamp).getTime() - 
                        new Date(outcome.timestamp).getTime();
      const minutesBetween = timeDelta / 60000;
      
      // Revenge trading: Bet size INCREASES after loss, AND decision is quick (<1 hour)
      if (nextBet > thisBet * 1.5 && minutesBetween < 60) {
        return {
          detected: true,
          pattern: 'revenge_trading',
          severity: 0.90,
          evidence: [
            `Loss at T${i}: ${outcome.actualValue}`,
            `Next bet ${minutesBetween.toFixed(0)} minutes later: ${nextBet} (${((nextBet/thisBet - 1) * 100).toFixed(0)}% larger)`,
            'Quick decision after loss indicates emotional reaction',
          ],
          duration: '1-2 decisions',
          suggestion: 'STOP. This is revenge trading. Mandatory 24-hour cooling-off period. Loss is gone, don\'t compound it.',
          coolingOffPeriod: 1440, // 24 hours (strict)
          examples: [nextDecision.description],
          historicalPattern: {
            previousOccurrences: await countRevengeTrading(agent),
            lastOccurrence: await getLastRevengeTrading(agent),
            averageDuration: 1, // decisions (usually caught quickly)
          },
        };
      }
    }
  }
  
  return null;
}
```

---

## 5. Discipline Systems

### The Fundamental Insight

**Self-Control Research**: "Willpower is finite. Systems > willpower."

**Problem**: Relying on willpower fails:

- Willpower depletes throughout day (ego depletion)
- Emotions override willpower (fear/greed > discipline)
- Cognitive biases distort willpower ("I'm special, rules don't apply to me")

**Solution**: **Pre-commitment** to rules, enforced automatically.

---

### The Pre-Decision Checklist

**Douglas's Checklist** (adapted for ARI):

```typescript
export interface DisciplineChecklist {
  // PHYSICAL STATE (Maslow hierarchy - basic needs first)
  physicalState: {
    sleptWell: boolean;           // 7+ hours
    notHungry: boolean;           // Not making decisions on empty stomach
    notIll: boolean;              // Not sick (illness impairs cognition)
    score: number;                // 0-1
  };
  
  // EMOTIONAL STATE
  emotionalState: {
    emotionalRisk: number;        // From checkEmotionalState()
    noBiasesDetected: boolean;    // Or biases are minor (<0.50)
    notRevengeTrade: boolean;     // Not reacting to previous loss
    score: number;                // 0-1
  };
  
  // TIMING
  timing: {
    notLateNight: boolean;        // Not 11 PM - 6 AM (impaired decisions)
    notRushed: boolean;           // Have adequate time to decide
    appropriatePace: boolean;     // Not too fast, not too slow
    score: number;                // 0-1
  };
  
  // DUE DILIGENCE
  preparation: {
    researchDone: boolean;        // Gathered relevant information
    alternativesConsidered: boolean; // Explored other options
    consequencesConsidered: boolean; // Thought through outcomes
    rulesFollowed: boolean;       // Following own rules (e.g., Kelly)
    score: number;                // 0-1
  };
  
  // META
  meta: {
    confidence: number;           // 0-1 (not overconfident, not underconfident)
    calibrated: boolean;          // Confidence matches historical accuracy
    secondOpinionSought: boolean; // For major decisions, consulted another member
    score: number;                // 0-1
  };
  
  // OVERALL
  overallScore: number;           // Average of all subscores
  passed: boolean;                // overallScore >= 0.70
  warnings: string[];
  requiredActions: string[];
  optionalActions: string[];
  coolingOffPeriod: number;       // Minutes to wait if failed
}

export async function checkDiscipline(
  decision: Decision,
  agent: string,
  context: DisciplineContext
): Promise<DisciplineChecklist> {
  // Check each category
  const physical = await checkPhysicalState(context);
  const emotional = await checkEmotionalState(agent, context);
  const timing = await checkTiming(context);
  const preparation = await checkPreparation(decision, context);
  const meta = await checkMeta(decision, context);
  
  // Calculate overall score
  const overallScore = (
    physical.score * 0.15 +
    emotional.score * 0.35 +       // Most important
    timing.score * 0.15 +
    preparation.score * 0.25 +
    meta.score * 0.10
  );
  
  const passed = overallScore >= 0.70;
  
  // Generate warnings
  const warnings = generateWarnings({
    physical, emotional, timing, preparation, meta
  });
  
  // Required actions if failed
  const requiredActions = generateRequiredActions({
    physical, emotional, timing, preparation, meta
  });
  
  // Cooling-off period
  const coolingOff = determineCoolingOffPeriod(emotional.emotionalRisk, warnings);
  
  return {
    physicalState: physical,
    emotionalState: emotional,
    timing,
    preparation,
    meta,
    overallScore,
    passed,
    warnings,
    requiredActions,
    optionalActions: generateOptionalActions({physical, emotional, timing, preparation, meta}),
    coolingOffPeriod: coolingOff,
  };
}
```

---

### Example: Major Financial Decision

**Decision**: Invest $50,000 (major allocation)

**Context**:

- Time: 2:30 AM
- Recent: Lost $5,000 yesterday
- Sleep: 4 hours last night
- Research: Read 1 article

**Discipline Check**:

```json
{
  "physicalState": {
    "sleptWell": false,          // Only 4 hours
    "notHungry": true,
    "notIll": true,
    "score": 0.33
  },
  "emotionalState": {
    "emotionalRisk": 0.78,       // High (recent loss + sleep deprivation)
    "noBiasesDetected": false,   // Loss aversion detected
    "notRevengeTrade": false,    // Could be trying to recover loss
    "score": 0.22
  },
  "timing": {
    "notLateNight": false,       // 2:30 AM is late night
    "notRushed": true,
    "appropriatePace": false,    // Too fast (less than 24h after loss)
    "score": 0.33
  },
  "preparation": {
    "researchDone": false,       // Only 1 article (insufficient)
    "alternativesConsidered": false,
    "consequencesConsidered": true,
    "rulesFollowed": false,      // Should follow Kelly, not emotional sizing
    "score": 0.25
  },
  "meta": {
    "confidence": 0.80,          // High confidence despite low prep (overconfidence?)
    "calibrated": false,
    "secondOpinionSought": false,
    "score": 0.20
  },
  "overallScore": 0.28,
  "passed": false,
  "warnings": [
    "Sleep deprived (4 hours)",
    "Late night decision (2:30 AM)",
    "High emotional risk (0.78)",
    "Recent loss may be driving decision (revenge trading?)",
    "Insufficient research (1 article)",
    "No second opinion sought (major decision)"
  ],
  "requiredActions": [
    "Sleep 7+ hours",
    "Wait until morning (after 8 AM)",
    "Wait 24h after loss (cooling-off)",
    "Research thoroughly (read 5+ sources)",
    "Consult SCOUT for second opinion"
  ],
  "coolingOffPeriod": 1440
}
```

**Result**: **FAILED** discipline check → Decision is **blocked** for 24 hours.

**Benefit**: Prevents emotional decision that would likely be regretted.

---

## 6. Behavioral Finance

### Key Concepts (Thaler, Kahneman)

#### Mental Accounting

**Definition**: Treating money differently based on arbitrary categories.

**Example**:

```
Scenario: Win $1,000 at casino

Mental Accounting (Irrational):
  "This is 'house money' (not really mine), so I can risk it all on next bet"
  Result: Likely to lose it (treating wins differently than salary)

Rational Accounting:
  "$1,000 in pocket is same as $1,000 from salary. Same risk management applies."
  Result: Take winnings home (or bet Kelly-sized)
```

**Detection**:

```typescript
function detectMentalAccounting(reasoning: string): BiasDetection | null {
  const mentalAccountingPhrases = [
    /\b(house money|play money|bonus|extra|free money)\b/gi,
    /\b(not my (real )?money|already won)\b/gi,
  ];
  
  for (const pattern of mentalAccountingPhrases) {
    if (pattern.test(reasoning)) {
      return {
        bias: 'MENTAL_ACCOUNTING',
        severity: 0.65,
        evidence: ['Treating money differently based on source'],
        mitigation: 'Money is money. $1,000 won = $1,000 earned. Apply same risk management.',
      };
    }
  }
  
  return null;
}
```

---

#### Endowment Effect

**Definition**: Valuing something more once you own it.

**Example**:

```
Scenario: You buy stock at $100. It drops to $80.

Endowment Effect (Irrational):
  "I can't sell at a loss. I'll wait until it gets back to $100."
  Implicit: "My $100 entry price is the 'correct' price"

Rational:
  "Current price is $80. The question is: Would I BUY this stock at $80 today?
   If no → sell. If yes → hold.
   My entry price ($100) is irrelevant (sunk cost)."
```

**Detection**:

```typescript
function detectEndowmentEffect(reasoning: string): BiasDetection | null {
  const endowmentPhrases = [
    /\b(my (entry )?price|what I paid|get back to)\b/gi,
    /\b(can't sell at a loss|wait (for|until) (it )?break-?even)\b/gi,
  ];
  
  for (const pattern of endowmentPhrases) {
    if (pattern.test(reasoning)) {
      return {
        bias: 'ENDOWMENT_EFFECT',
        severity: 0.70,
        evidence: ['Anchoring to entry price'],
        mitigation: 'Ignore your entry price. Ask: Would I BUY this at current price? If no, sell.',
      };
    }
  }
  
  return null;
}
```

---

## Knowledge Sources

### Primary Sources (VERIFIED)

**Trading Psychology**:

1. **Mark Douglas - Trading in the Zone** (2000)
   - Probabilistic mindset, discipline, emotional regulation
   - 5 fundamental truths

2. **Mark Douglas - The Disciplined Trader** (1990)
   - Self-discipline, consistency, rules-based trading

3. **Van Tharp - Trade Your Way to Financial Freedom** (1999)
   - Position sizing psychology, expectancy, R-multiples

**Cognitive Biases**:
4. **Daniel Kahneman - Thinking, Fast and Slow** (2011)

- Comprehensive catalog of biases
- System 1 (fast, emotional) vs System 2 (slow, rational)

1. **Amos Tversky & Daniel Kahneman - Prospect Theory** (1979 paper)
   - Loss aversion, framing effects
   - Original research

**Behavioral Finance**:
6. **Richard Thaler - Misbehaving** (2015)

- Behavioral economics applied to finance
- Mental accounting, endowment effect

1. **Richard Thaler - Nudge** (2008)
   - Choice architecture, decision environments

**Emotional Intelligence**:
8. **Daniel Goleman - Emotional Intelligence** (1995)

- Self-awareness, self-regulation, empathy

1. **James Gross - Emotion Regulation Research**
   - Academic papers on emotion regulation strategies

**Loss Aversion**:
10. **Academic papers on loss aversion** (arXiv, SSRN)
    - Experimental studies
    - Applications to decision-making

### Supplementary Sources (STANDARD)

1. **Trading psychology blogs** (curated, VERIFIED authors only)
2. **Behavioral economics journals**
3. **Psychology Today** (professional psychologists)

**Total ETHOS Sources**: ~22 sources

---

## Implementation Priority

### Phase 1: Core Bias Detection (Week 1-2)

**Implement**:

1. 10 cognitive biases detection functions
2. Bias severity scoring
3. Mitigation recommendations

**Test**: Each bias with 5+ test cases

---

### Phase 2: Emotional State (Week 2-3)

**Implement**:

1. Valence/arousal/dominance estimation
2. Emotional risk calculation
3. Recommendation engine

**Test**: Various emotional states, risk thresholds

---

### Phase 3: Fear/Greed Cycles (Week 3-4)

**Implement**:

1. Pattern detection (fear spiral, greed chase, revenge trading)
2. Historical pattern tracking
3. Breaking mechanisms

**Test**: Sequence of decisions showing each pattern

---

### Phase 4: Discipline Systems (Week 4-5)

**Implement**:

1. Pre-decision checklist
2. Cooling-off period enforcement
3. Rule compliance checking

**Test**: Various failure modes, edge cases

---

## Council Integration

### Primary ETHOS Users

**AEGIS** (Guardian):

- Uses: Trading psychology (risk perception), bias detection (threat assessment)
- Frequency: Daily (every threat analysis)
- Benefit: Distinguishes real threats from fear-driven false alarms

**MINT** (Wealth):

- Uses: All frameworks (trading psych, biases, emotional state, fear/greed, discipline)
- Frequency: Daily (every financial decision)
- Benefit: Prevents emotional financial mistakes

**SCOUT** (Risk):

- Uses: Bias detection, emotional state (adjusts risk estimates for emotion)
- Frequency: Daily
- Benefit: More accurate risk assessment (accounts for psychological factors)

**EMBER** (Relationships):

- Uses: Emotional intelligence, empathy, communication psychology
- Frequency: Weekly
- Benefit: Better relationship decisions

---

**Last Updated**: 2026-02-01  
**Status**: Design Complete (Abbreviated - Full version would be 30+ pages with all 10 biases detailed)  
**Est. Implementation Time**: 2 weeks  
**Est. Testing Time**: 3-4 days
