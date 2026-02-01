# PATHOS Pillar: The Growth Engine

**Version**: 1.0.0  
**Status**: Design Documentation  
**Date**: 2026-02-01  
**Related ADRs**: ADR-009, ADR-010, ADR-013

---

## Table of Contents

1. [Philosophy & Purpose](#philosophy--purpose)
2. [Framework Catalog](#framework-catalog)
3. [Cognitive Behavioral Therapy (CBT)](#1-cognitive-behavioral-therapy-cbt)
4. [Dialectical Behavior Therapy (DBT)](#2-dialectical-behavior-therapy-dbt)
5. [Acceptance & Commitment Therapy (ACT)](#3-acceptance--commitment-therapy-act)
6. [Stoic Philosophy](#4-stoic-philosophy)
7. [Deliberate Practice](#5-deliberate-practice)
8. [Meta-Learning](#6-meta-learning)
9. [Wisdom Traditions](#7-wisdom-traditions)
10. [Reflection Engine](#8-reflection-engine)
11. [Knowledge Sources](#knowledge-sources)
12. [Council Integration](#council-integration)

---

## Philosophy & Purpose

### The Core Thesis

> **"Every outcome is a teacher. Wisdom compounds through reflection, reframing, and relentless growth."**

PATHOS (πάθος) - Greek for "experience", "suffering", "emotion" - represents the **evolving mind** that learns from experience, reframes challenges, and integrates timeless wisdom.

### Why Growth Frameworks for AI?

ARI exists to **enhance human life** (Pryce's). Life involves:
- Setbacks (failures, losses, rejections)
- Challenges (health, relationships, growth)
- Uncertainty (what to do, how to improve)

**Without PATHOS**:
- Failures are just logged (no learning)
- Challenges are just problems (no reframing)
- No integration of wisdom (Stoics, Dalio, Munger ignored)

**With PATHOS**:
- "Project failed → Reflect → Extract 3 insights → Store as principles → Don't repeat mistake"
- "Health challenge → CBT reframe → 'This is hard, AND I can do it' → Action plan"
- "Ethical dilemma → Consult Stoics → 'What would Marcus Aurelius do?' → Principled decision"

**Result**: ARI **learns, adapts, and grows wiser** over time.

---

## Framework Catalog

### The Eight PATHOS Frameworks

1. **CBT** (Cognitive Behavioral Therapy) - Beck - Reframe distorted thinking
2. **DBT** (Dialectical Behavior Therapy) - Linehan - Distress tolerance, regulation
3. **ACT** (Acceptance & Commitment Therapy) - Hayes - Values, psychological flexibility
4. **Stoic Philosophy** - Marcus Aurelius, Seneca, Epictetus - Dichotomy of control, virtue
5. **Deliberate Practice** - Ericsson - Focused practice for mastery
6. **Meta-Learning** - Learning how to learn - Spaced repetition, Feynman technique
7. **Wisdom Traditions** - Dalio, Munger, Musashi, Naval - Timeless principles
8. **Reflection Engine** - Kolb learning cycle - Extract insights from experience

**Together**: Complete toolkit for **continuous growth** and **wise decision-making**.

---

## 1. Cognitive Behavioral Therapy (CBT)

### The Fundamental Insight

**Aaron Beck** (1960s):

> Our thoughts create our emotions. Distorted thinking → negative emotions → poor actions. By challenging and reframing thoughts, we change emotions and actions.

**The CBT Model**:
```
Situation → Thought → Emotion → Behavior

Example (Distorted):
Situation: Project deadline approaching
Thought: "I'll never finish this, I always fail"
Emotion: Anxiety, hopelessness
Behavior: Procrastination (avoidance)

Example (Reframed):
Situation: Project deadline approaching
Thought: "This is challenging AND I've handled challenges before. Break it into steps."
Emotion: Determination, slight anxiety (motivating)
Behavior: Start working on first step
```

**Key Principle**: Change the **thought** (middle of chain) to change **emotion** and **behavior**.

---

### Cognitive Distortions (David Burns)

**The 10 Common Distortions**:

#### 1. All-or-Nothing Thinking

**Definition**: Seeing things in black-and-white categories (perfect or failure, no middle).

**Example**:
```
Distorted: "I ate one cookie. My diet is ruined. Might as well eat the whole box."
Reality: "I ate one cookie (100 calories). That's 5% of my daily budget. The diet is 95% intact."
```

**Reframe**:
```typescript
function reframeAllOrNothing(thought: string): string {
  // Detect absolute thinking
  if (/\b(ruined|destroyed|completely|totally|always|never)\b/i.test(thought)) {
    return thought
      .replace(/\bruined\b/gi, 'slightly affected')
      .replace(/\bdestroyed\b/gi, 'damaged but recoverable')
      .replace(/\bcompletely\b/gi, 'partially')
      .replace(/\balways\b/gi, 'sometimes')
      .replace(/\bnever\b/gi, 'rarely');
  }
  return thought;
}
```

---

#### 2. Overgeneralization

**Definition**: Seeing single negative event as pattern ("This always happens").

**Example**:
```
Distorted: "I failed this interview. I always mess up interviews."
Reality: "I failed this interview. I've succeeded in 3 of 5 interviews (60% success rate)."
```

**Reframe**:
```typescript
function reframeOvergeneralization(thought: string, historicalData: any[]): string {
  // Detect overgeneralization phrases
  if (/\b(always|never|every time|constantly)\b/i.test(thought)) {
    // Inject actual data
    const successRate = historicalData.filter(d => d.result === 'success').length / historicalData.length;
    
    return `While this instance failed, historically ${(successRate * 100).toFixed(0)}% of similar situations succeeded. This is one data point, not a pattern.`;
  }
  return thought;
}
```

---

#### 3. Mental Filter

**Definition**: Focusing only on negative details, filtering out positive.

**Example**:
```
Situation: Presentation went well (90% positive feedback, 1 critical comment)
Distorted: "Someone said my slides were unclear. The presentation was a failure."
Reality: "9 of 10 people praised it. One person had a valid critique about slide 5."
```

**Reframe**: "Also notice the positive. What went RIGHT?"

---

#### 4. Catastrophizing

**Definition**: Expecting the worst-case scenario without evidence.

**Example**:
```
Distorted: "If I don't get this job, my career is over. I'll be unemployed forever."
Reality: "If I don't get this job, I'll apply to others. Worst case: Takes 3-6 months to find something."
```

**Reframe**:
```typescript
function reframeCatastrophizing(thought: string): {
  reframed: string;
  worstCase: string;
  likelyCase: string;
  bestCase: string;
} {
  return {
    reframed: 'Let\'s look at realistic scenarios, not catastrophes',
    worstCase: 'Job search takes 6 months, live on savings',
    likelyCase: 'Find new job in 2-3 months',
    bestCase: 'Multiple offers, choose best fit',
  };
}
```

---

### CBT Implementation

**File**: `src/cognition/pathos/cbt-reframing.ts`

```typescript
export type CognitiveDistortion =
  | 'ALL_OR_NOTHING'
  | 'OVERGENERALIZATION'
  | 'MENTAL_FILTER'
  | 'CATASTROPHIZING'
  | 'EMOTIONAL_REASONING'
  | 'SHOULD_STATEMENTS'
  | 'LABELING'
  | 'PERSONALIZATION'
  | 'MAGNIFICATION'
  | 'DISCOUNTING_POSITIVES';

export interface CBTReframe {
  originalThought: string;
  distortionDetected: CognitiveDistortion | null;
  severity: number;               // 0-1
  reframedThought: string;
  evidence: string[];             // Why is original distorted?
  balancedPerspective: string;    // More realistic view
  actionable: string;             // What to do with this reframe
  framework: 'Cognitive Behavioral Therapy (Beck, 1960s)';
}

/**
 * Detect cognitive distortions and suggest reframes (CBT)
 * 
 * @param thought - Thought to analyze (usually negative or problematic)
 * @param context - Situation, historical data for reality-checking
 * @returns Reframed thought with balanced perspective
 */
export async function reframeThought(
  thought: string,
  context?: {
    situation?: string;
    historicalData?: any[];
    evidence?: string[];
  }
): Promise<CBTReframe> {
  // Detect which distortion (if any)
  const distortion = detectDistortion(thought);
  
  // Generate reframe based on distortion type
  const reframed = generateReframe(thought, distortion, context);
  
  return {
    originalThought: thought,
    distortionDetected: distortion,
    severity: distortion ? 0.60 : 0.0,
    reframedThought: reframed.thought,
    evidence: reframed.evidence,
    balancedPerspective: reframed.balanced,
    actionable: reframed.action,
    framework: 'Cognitive Behavioral Therapy (Beck, 1960s)',
  };
}
```

---

## 4. Stoic Philosophy

### The Fundamental Insights

**Core Stoic Principles**:

1. **Dichotomy of Control** (Epictetus)
2. **Amor Fati** (Love of fate - Nietzsche interpretation of Stoicism)
3. **Negative Visualization** (Premeditatio malorum)
4. **Virtue Ethics** (Four cardinal virtues)
5. **Memento Mori** (Remember you will die - urgency and perspective)

---

### Dichotomy of Control (Epictetus)

**Epictetus** (Enchiridion, ~125 AD):

> "Some things are in our control and others not. Things in our control are opinion, pursuit, desire, aversion, and, in a word, whatever are our own actions. Things not in our control are body, property, reputation, command, and, in one word, whatever are not our own actions."

**Modern Translation**:

**In Your Control**:
- Your decisions
- Your effort and preparation
- Your reactions to events
- Your character and values
- How you interpret situations

**NOT in Your Control**:
- Other people's actions
- Outcomes (market returns, job offers, health outcomes)
- Past events (already happened)
- Natural events (weather, accidents)
- What others think of you

**The Practice**: Focus energy on **controllables**, accept **uncontrollables**.

---

### Implementation

**File**: `src/cognition/pathos/stoic-dichotomy.ts`

```typescript
export interface DichotomyAnalysis {
  situation: string;
  controllable: Array<{
    item: string;
    actionable: string;           // What you can DO about this
    effort: number;               // 0-1, how much effort to change
  }>;
  uncontrollable: Array<{
    item: string;
    acceptance: string;           // How to accept this
    wastedEnergy: number;         // 0-1, how much energy currently wasted here
  }>;
  recommendation: string;
  focusArea: string;              // Where to direct energy (controllables)
  releaseArea: string;            // What to let go (uncontrollables)
  stoicQuote?: {
    text: string;
    source: string;               // "Marcus Aurelius, Meditations 8.32"
    relevance: string;
  };
  provenance: {
    framework: 'Dichotomy of Control (Epictetus, ~125 AD)';
    source: 'Enchiridion';
    computedAt: Date;
  };
}

/**
 * Analyze situation using Stoic dichotomy of control
 * 
 * @param situation - Description of situation or challenge
 * @returns Categorization of controllable vs uncontrollable factors
 * 
 * @example
 * const analysis = await analyzeDichotomy({
 *   situation: 'I\'m anxious about upcoming presentation',
 * });
 * // Returns: {
 * //   controllable: [
 * //     { item: 'Preparation quality', actionable: 'Practice 2 more hours' },
 * //     { item: 'Slide design', actionable: 'Simplify complex slides' },
 * //     { item: 'Breathing/calm', actionable: 'Practice deep breathing' }
 * //   ],
 * //   uncontrollable: [
 * //     { item: 'Audience reaction', acceptance: 'They\'ll think what they think' },
 * //     { item: 'Technical issues', acceptance: 'Prepare backup, but can\'t prevent all' }
 * //   ],
 * //   focusArea: 'Spend next 2 hours practicing (controllable)',
 * //   releaseArea: 'Stop worrying about audience reaction (uncontrollable)'
 * // }
 */
export async function analyzeDichotomy(params: {
  situation: string;
  context?: Record<string, unknown>;
}): Promise<DichotomyAnalysis> {
  const { situation } = params;
  
  // Parse situation into factors
  const factors = extractFactors(situation);
  
  // Categorize each factor
  const controllable: Array<{item: string; actionable: string; effort: number}> = [];
  const uncontrollable: Array<{item: string; acceptance: string; wastedEnergy: number}> = [];
  
  for (const factor of factors) {
    if (isControllable(factor)) {
      controllable.push({
        item: factor,
        actionable: suggestAction(factor),
        effort: estimateEffort(factor),
      });
    } else {
      uncontrollable.push({
        item: factor,
        acceptance: suggestAcceptance(factor),
        wastedEnergy: estimateWastedEnergy(factor, situation),
      });
    }
  }
  
  // Find relevant Stoic quote
  const stoicQuote = await queryWisdom({
    query: `Stoic wisdom on ${situation}`,
    traditions: ['stoic'],
    limit: 1,
  });
  
  return {
    situation,
    controllable,
    uncontrollable,
    recommendation: generateStoicRecommendation(controllable, uncontrollable),
    focusArea: controllable[0]?.actionable || 'Identify what you can control',
    releaseArea: uncontrollable[0]?.acceptance || 'Accept what you cannot change',
    stoicQuote: stoicQuote[0] ? {
      text: stoicQuote[0].quote,
      source: stoicQuote[0].source,
      relevance: stoicQuote[0].application,
    } : undefined,
    provenance: {
      framework: 'Dichotomy of Control (Epictetus, ~125 AD)',
      source: 'Enchiridion (Handbook)',
      computedAt: new Date(),
    },
  };
}

function isControllable(factor: string): boolean {
  // Pattern matching for controllable factors
  const controllablePatterns = [
    /\b(my (decision|action|effort|preparation|practice|plan|strategy))\b/i,
    /\b(I can (do|change|improve|learn|practice))\b/i,
    /\b(how I (respond|react|interpret|frame))\b/i,
  ];
  
  const uncontrollablePatterns = [
    /\b(others (think|do|say|decide))\b/i,
    /\b(market|weather|outcome|result)\b/i,
    /\b(past|already happened|yesterday)\b/i,
  ];
  
  const hasControllable = controllablePatterns.some(p => p.test(factor));
  const hasUncontrollable = uncontrollablePatterns.some(p => p.test(factor));
  
  return hasControllable || !hasUncontrollable;
}
```

---

### Four Cardinal Virtues (Stoicism)

**The Virtues**:

1. **Wisdom (Sophia)** - Practical wisdom, good judgment
   - Knowing what's in your control
   - Making sound decisions
   - Learning from experience

2. **Courage (Andreia)** - Moral courage, fortitude
   - Acting despite fear
   - Facing challenges
   - Standing for principles

3. **Justice (Dikaiosyne)** - Fairness, integrity
   - Treating others fairly
   - Contributing to community
   - Doing what's right

4. **Temperance (Sophrosyne)** - Self-control, moderation
   - Restraint in pleasures
   - Balance in all things
   - Discipline

**Application in Decisions**:
```typescript
export interface VirtueCheck {
  decision: string;
  virtueAlignment: {
    wisdom: { aligned: boolean; score: number; reasoning: string };
    courage: { aligned: boolean; score: number; reasoning: string };
    justice: { aligned: boolean; score: number; reasoning: string };
    temperance: { aligned: boolean; score: number; reasoning: string };
  };
  overallAlignment: number;       // 0-1 (average of virtues)
  recommendation: string;
  conflicts: string[];            // Virtues in tension
}

export async function checkVirtueAlignment(
  decision: Decision
): Promise<VirtueCheck> {
  const wisdom = assessWisdom(decision);    // Is this wise/prudent?
  const courage = assessCourage(decision);  // Does this require courage? Am I avoiding out of fear?
  const justice = assessJustice(decision);  // Is this fair/right?
  const temperance = assessTemperance(decision); // Is this balanced/moderate?
  
  const overallAlignment = (wisdom.score + courage.score + justice.score + temperance.score) / 4;
  
  const conflicts: string[] = [];
  
  // Detect virtue conflicts
  if (courage.score > 0.7 && temperance.score < 0.3) {
    conflicts.push('Courage (bold action) vs Temperance (restraint) - balance needed');
  }
  
  if (justice.score < 0.5) {
    conflicts.push('Justice concern - is this fair/right?');
  }
  
  return {
    decision: decision.description,
    virtueAlignment: { wisdom, courage, justice, temperance },
    overallAlignment,
    recommendation: generateVirtueRecommendation(overallAlignment, conflicts),
    conflicts,
  };
}
```

**Example**:
```
Decision: "Layoff 10 employees to cut costs"

Virtue Check:
  Wisdom: 0.50 (Prudent from business perspective, but impacts lives)
  Courage: 0.80 (Requires courage to make hard decision)
  Justice: 0.30 (Is this fair? Are there alternatives? Severance adequate?)
  Temperance: 0.60 (Balanced - not over-hiring, not under-investing)

Overall: 0.55 (mixed)
Conflicts: "Justice concern - explore alternatives first"
Recommendation: "Before layoffs, explore: reduce expenses, defer bonuses, voluntary reduced hours. If no alternatives, proceed with generous severance (justice)."
```

---

## 5. Deliberate Practice

### The Fundamental Insight

**Anders Ericsson** (Peak, 2016):

> Expert performance is not innate talent. It's the result of years of **deliberate practice** - focused, systematic practice on weaknesses with immediate feedback.

**The Four Principles**:

1. **Well-Defined Goals** - Specific performance improvement (not vague "get better")
2. **Focused Practice** - Work on weaknesses (not comfortable areas)
3. **Immediate Feedback** - Know if you're improving in real-time
4. **Gradual Difficulty** - Push just beyond current ability (~10% harder)

---

### Deliberate Practice vs Naive Practice

**Naive Practice** (doesn't improve):
```
Goal: "Get better at public speaking" (vague)
Method: Give presentations occasionally
Feedback: Audience applauds (social, not specific)
Difficulty: Same complexity every time
Result: Plateau after initial improvement
```

**Deliberate Practice** (expert level):
```
Goal: "Eliminate filler words (um, uh) - currently 15/min, target 3/min"
Method: Practice 30-min daily, record and review
Feedback: Count filler words per minute (objective)
Difficulty: Start with 5-min talks, increase to 10-min, then 20-min
Result: Continuous improvement (tracked over weeks)
```

---

### Implementation

**File**: `src/cognition/pathos/deliberate-practice.ts`

```typescript
export interface PracticePlan {
  skill: string;
  currentLevel: number;           // 0-100
  targetLevel: number;            // 0-100
  gap: number;                    // target - current
  estimatedHours: number;         // Based on skill type and gap
  timeframe: string;              // "6 weeks", "3 months"
  
  specificGoals: Array<{
    goal: string;                 // Measurable, specific
    metric: string;               // How to measure
    baseline: number;             // Current performance
    target: number;               // Desired performance
  }>;
  
  weaknessesToAddress: string[];  // Areas most needing improvement
  
  practiceSchedule: {
    frequency: string;            // "Daily", "3× per week"
    duration: number;             // Minutes per session
    timing: string;               // "Morning" (if circadian-sensitive)
  };
  
  feedbackMechanism: string[];    // How to get immediate feedback
  
  difficultyProgression: Array<{
    week: number;
    difficulty: string;
    challenge: string;
  }>;
  
  milestones: Array<{
    level: number;
    description: string;
    estimatedWeek: number;
  }>;
  
  resources: string[];            // Books, courses, mentors
  
  provenance: {
    framework: 'Deliberate Practice (Ericsson, 2016)';
    principles: string[];
    computedAt: Date;
  };
}

/**
 * Generate deliberate practice plan for skill acquisition
 * 
 * Uses Ericsson's principles: specific goals, focused practice on weaknesses,
 * immediate feedback, gradual difficulty increase.
 * 
 * @param skill - What to learn
 * @param currentLevel - Current proficiency (0-100)
 * @param targetLevel - Desired proficiency (0-100)
 * @returns Detailed practice plan with schedule and milestones
 */
export async function createPracticePlan(params: {
  skill: string;
  currentLevel: number;
  targetLevel: number;
  timeframe?: string;
}): Promise<PracticePlan> {
  const { skill, currentLevel, targetLevel } = params;
  const gap = targetLevel - currentLevel;
  
  // Estimate hours (rough: 1 level = 1-2 hours for cognitive skills)
  const estimatedHours = gap * 1.5;
  
  // Identify specific weaknesses in this skill
  const weaknesses = await identifyWeaknesses(skill, currentLevel);
  
  // Generate specific, measurable goals
  const goals = weaknesses.map(w => ({
    goal: `Improve ${w.area}`,
    metric: w.metric,
    baseline: w.currentScore,
    target: w.targetScore,
  }));
  
  // Practice schedule (based on timeframe)
  const schedule = calculateOptimalSchedule(estimatedHours, params.timeframe);
  
  // Feedback mechanisms
  const feedback = suggestFeedbackMechanisms(skill);
  
  // Difficulty progression (10% rule)
  const progression = generateDifficultyProgression(currentLevel, targetLevel, schedule.totalWeeks);
  
  // Milestones (checkpoints every 15-20% of gap)
  const milestones = generateMilestones(currentLevel, targetLevel, schedule.totalWeeks);
  
  // Resources
  const resources = await findLearningResources(skill);
  
  return {
    skill,
    currentLevel,
    targetLevel,
    gap,
    estimatedHours,
    timeframe: `${schedule.totalWeeks} weeks`,
    specificGoals: goals,
    weaknessesToAddress: weaknesses.map(w => w.area),
    practiceSchedule: {
      frequency: schedule.frequency,
      duration: schedule.sessionDuration,
      timing: schedule.optimalTiming,
    },
    feedbackMechanism: feedback,
    difficultyProgression: progression,
    milestones,
    resources,
    provenance: {
      framework: 'Deliberate Practice (Ericsson, 2016)',
      principles: [
        'Well-defined goals',
        'Focused practice on weaknesses',
        'Immediate feedback',
        'Gradual difficulty increase (~10% per step)',
      ],
      computedAt: new Date(),
    },
  };
}
```

---

## 7. Wisdom Traditions

### The Wisdom Index

**Curated Principles** from timeless sources:

**Ray Dalio** (Principles):
- "Pain + Reflection = Progress"
- "Radical truth and radical transparency"
- "Believability-weighted decision making"
- "Life is a series of choices between alternatives that have pros and cons"

**Charlie Munger** (Mental Models):
- "Inversion - always invert" (solve from end backwards)
- "Second-order thinking" (and then what?)
- "Circle of competence" (know what you know and don't know)
- "Lollapalooza effect" (multiple biases compound)

**Miyamoto Musashi** (Book of Five Rings):
- "Think lightly of yourself and deeply of the world"
- "Do nothing which is of no use"
- "Perceive those things which cannot be seen"
- "The Way is in training"

**Naval Ravikant** (Almanack):
- "Specific knowledge cannot be taught (but can be learned)"
- "Leverage: Code, media, labor, capital"
- "Play long-term games with long-term people"
- "Read what you love until you love to read"

**Donella Meadows** (Thinking in Systems):
- "Leverage points - places to intervene in a system"
- "Today, an intervention to slow population growth will take years to manifest"
- "We can't impose our will on a system. We can listen to what the system tells us"

---

### Implementation

**File**: `src/cognition/pathos/wisdom.ts`

```typescript
export interface WisdomEntry {
  principle: string;              // The wisdom statement
  source: string;                 // Who said it / which book
  citation: string;               // Specific page/chapter if applicable
  tradition: WisdomTradition;
  context: string;                // When/why was this said
  application: string[];          // How to apply this principle
  keywords: string[];             // For search
  examples: string[];             // Concrete examples
  relatedPrinciples: string[];    // Cross-references
  tier: 'core' | 'advanced';      // Core = most important
}

export type WisdomTradition =
  | 'stoic'                       // Marcus Aurelius, Seneca, Epictetus
  | 'dalio'                       // Ray Dalio Principles
  | 'munger'                      // Charlie Munger mental models
  | 'musashi'                     // Book of Five Rings
  | 'naval'                       // Naval Ravikant
  | 'taleb'                       // Nassim Taleb
  | 'meadows'                     // Donella Meadows systems thinking
  | 'universal';                  // Multiple traditions

/**
 * Query wisdom index for relevant principles
 * 
 * @param query - Question or situation
 * @returns Relevant wisdom with application guidance
 */
export async function consultWisdom(params: {
  question: string;
  context?: string;
  traditions?: WisdomTradition[];
  limit?: number;
}): Promise<WisdomResponse[]> {
  const { question, traditions, limit = 5 } = params;
  
  // Search wisdom index (TF-IDF)
  const searchQuery = traditions
    ? `${question} ${traditions.join(' ')}`
    : question;
  
  const results = await queryKnowledgeBase({
    query: searchQuery,
    pillar: 'PATHOS',
    domain: 'wisdom',
    limit: limit * 2, // Get more, filter later
  });
  
  // Filter by tradition if specified
  const filtered = traditions
    ? results.filter(r => traditions.includes(r.tradition))
    : results;
  
  // Convert to wisdom responses
  const responses: WisdomResponse[] = filtered.slice(0, limit).map(r => ({
    principle: r.principle,
    source: r.citation,
    quote: r.quote,
    application: r.application,
    alternatives: findAlternativePerspectives(r.principle, traditions),
    confidence: r.relevance,
    tradition: r.tradition,
    provenance: {
      text: r.source,
      fetchedFrom: r.sourceUrl,
      indexedAt: r.indexedAt,
    },
  }));
  
  return responses;
}
```

---

## 8. Reflection Engine

### The Kolb Learning Cycle

**David Kolb** (1984):

**Four Stages of Learning**:
```
1. Concrete Experience
   (Do something)
         ↓
2. Reflective Observation
   (Reflect on what happened)
         ↓
3. Abstract Conceptualization
   (Extract general principles)
         ↓
4. Active Experimentation
   (Try new approach based on learning)
         ↓
   (back to 1)
```

**ARI Application**:
```
1. Execute decision (Experience)
2. Reflect on outcome (Observation)
3. Extract insights (Conceptualization)
4. Apply to next decision (Experimentation)
```

---

### Reflection Implementation

**File**: `src/cognition/pathos/reflection.ts`

```typescript
export async function reflectOnOutcome(params: {
  action: string;
  result: 'success' | 'failure' | 'partial';
  expectedValue: number;
  actualValue: number;
  timestamp: string;
  context?: Record<string, unknown>;
}): Promise<ReflectionResult> {
  const { action, result, expectedValue, actualValue } = params;
  const delta = actualValue - expectedValue;
  
  const insights: Insight[] = [];
  
  // 1. What happened? (Factual)
  if (result === 'success') {
    insights.push({
      type: 'success',
      description: `Action succeeded: ${action}`,
      evidence: [`Expected ${expectedValue}, got ${actualValue} (${delta > 0 ? 'exceeded' : 'met'} expectations)`],
      actionable: 'Repeat this approach in similar situations',
      confidence: 0.80,
      generalizes: await checkIfGeneralizes(action, result, params.context),
      priority: 'medium',
      framework: 'Reflection Engine',
    });
  } else if (result === 'failure') {
    insights.push({
      type: 'mistake',
      description: `Action failed: ${action}`,
      evidence: [`Expected ${expectedValue}, got ${actualValue} (missed by ${Math.abs(delta)})`],
      actionable: 'Analyze: What assumptions were wrong? What would I do differently?',
      confidence: 0.85,
      generalizes: await checkIfGeneralizes(action, result, params.context),
      priority: 'high',
      framework: 'Reflection Engine',
    });
  }
  
  // 2. Pattern recognition
  const similarPast = await findSimilarOutcomes(params);
  if (similarPast.length >= 3) {
    const pattern = analyzePastPattern(similarPast);
    if (pattern) {
      insights.push({
        type: 'pattern',
        description: pattern.description,
        evidence: pattern.evidence,
        actionable: pattern.recommendation,
        confidence: pattern.confidence,
        generalizes: true,
        priority: 'critical',
        framework: 'Pattern Recognition',
      });
    }
  }
  
  // 3. Extract principles
  const principles = await extractPrinciples(insights, params);
  
  // 4. Identify antipatterns (what NOT to do)
  const antipatterns = await identifyAntipatterns(params, similarPast);
  
  return {
    insights,
    summary: generateReflectionSummary(insights),
    principles,
    antipatterns,
    nextActions: insights.map(i => i.actionable),
    confidence: averageConfidence(insights),
    provenance: {
      framework: 'Reflection Engine (Kolb Learning Cycle, 1984)',
      reflectedAt: new Date(),
    },
  };
}
```

---

## Knowledge Sources (PATHOS)

### Therapeutic Frameworks (VERIFIED)

1. **Beck Institute - CBT Resources**
   - Official CBT materials from Aaron Beck's institute
   - https://beckinstitute.org

2. **Linehan Institute - DBT Resources**
   - Official DBT materials from Marsha Linehan
   - https://behavioraltech.org

3. **Association for Contextual Behavioral Science - ACT**
   - Official ACT resources
   - https://contextualscience.org

### Stoic Texts (Public Domain)

4. **Marcus Aurelius - Meditations**
5. **Seneca - Letters from a Stoic**
6. **Epictetus - Enchiridion**
7. **Modern Stoicism** - https://modernstoicism.com

### Meta-Learning (VERIFIED)

8. **Ericsson - Peak**
9. **Learning science journals**
10. **Spaced repetition research**
11. **Cognitive load theory papers**

### Wisdom Traditions (STANDARD)

12. **Ray Dalio - Principles** (official excerpts)
13. **Charlie Munger - Mental models** (Berkshire letters)
14. **Naval Ravikant - Almanack** (official)
15. **Farnam Street** (Shane Parrish curates)

**Total PATHOS Sources**: ~27 sources

---

**Last Updated**: 2026-02-01  
**Status**: Design Complete  
**Est. Implementation Time**: 2 weeks  
**Est. Testing Time**: 3-4 days
