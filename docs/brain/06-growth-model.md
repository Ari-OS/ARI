# ARI Growth Model

ARI learns through **adaptive pattern recognition**, **spaced repetition**, **meta-learning**, and **deliberate practice orchestration**. Unlike static systems, ARI's capabilities compound over time.

## Adaptive Learning

ARI adjusts its behavior based on observed outcomes and user feedback.

### Learning Loop

```
1. ACTION
   ↓
   ARI performs task based on current model
   ↓
2. OBSERVATION
   ↓
   Measure outcome: Success? Failure? Partial?
   ↓
3. ATTRIBUTION
   ↓
   What caused this outcome? Which decision was critical?
   ↓
4. UPDATE
   ↓
   Adjust internal model to improve future performance
   ↓
5. VERIFY
   ↓
   Test updated model on similar task
   ↓
   Loop back to ACTION
```

### Update Mechanisms

**Bayesian Update** (beliefs):

```typescript
function updateBelief(
  priorProbability: number,
  evidenceStrength: number,
  evidenceDirection: 'support' | 'refute'
): number {
  const likelihood = evidenceDirection === 'support' ? evidenceStrength : (1 - evidenceStrength);
  const posterior = (likelihood * priorProbability) /
    ((likelihood * priorProbability) + ((1 - likelihood) * (1 - priorProbability)));
  return posterior;
}
```

**Gradient Update** (parameters):

```typescript
function updateParameter(
  currentValue: number,
  error: number,
  learningRate: number
): number {
  return currentValue - (learningRate * error);
}
```

**Example**:

```
Belief: "User prefers verbose explanations" (confidence: 0.7)
Observation: User says "just do it, skip explanation" (strength: 0.8, direction: refute)
Update: Posterior confidence = 0.25 (significantly reduced)

Action: Adjust verbosity preference in user model
```

### Learning Rate Decay

Early in relationship: **High learning rate** (rapid adaptation)
Later in relationship: **Low learning rate** (stable, resists noise)

```typescript
function learningRate(daysSinceFirstInteraction: number): number {
  const initialRate = 0.3;
  const decayFactor = 0.995; // Decays slowly
  return initialRate * Math.pow(decayFactor, daysSinceFirstInteraction);
}
```

**Rationale**: Early patterns are more informative. Later, ARI has strong priors and shouldn't overreact to single data points.

## Pattern Recognition

ARI identifies recurring patterns in user behavior, preferences, and context.

### Pattern Types

**Temporal Patterns**:

- "User prefers terse responses during execution phase, verbose during planning"
- "User checks email at 8am, 12pm, 5pm (consistent schedule)"

**Conditional Patterns**:

- "When stressed, user prefers simpler options"
- "When exploring, user wants multiple alternatives"

**Sequential Patterns**:

- "User always runs tests after code changes"
- "User reviews PRs in order of oldest first"

**Contextual Patterns**:

- "User is more creative in morning sessions"
- "User makes financial decisions better after lunch"

### Pattern Discovery

**Frequency-Based**:

```typescript
function discoverPattern(events: Event[]): Pattern | null {
  const sequences = extractSequences(events, windowSize: 5);
  const frequencyMap = countOccurrences(sequences);
  const candidatePatterns = frequencyMap.filter(([seq, count]) => count >= 3);

  if (candidatePatterns.length > 0) {
    return { type: 'sequential', sequence: candidatePatterns[0][0], confidence: 0.6 };
  }
  return null;
}
```

**Statistical Significance**:

```typescript
function isPatternSignificant(
  observedFrequency: number,
  expectedFrequency: number,
  sampleSize: number
): boolean {
  const zScore = (observedFrequency - expectedFrequency) / Math.sqrt(expectedFrequency);
  return Math.abs(zScore) > 2; // 95% confidence
}
```

### Pattern Storage

Patterns stored as memories with **high confidence** and **PATTERN type**:

```typescript
{
  id: 'pat_7f3a2b',
  content: 'User prefers terse responses during execution phase',
  type: 'PATTERN',
  confidence: 0.85,
  evidence: [
    { date: '2026-01-15', observation: 'User said "just do it"' },
    { date: '2026-01-18', observation: 'User said "skip explanation"' },
    { date: '2026-01-22', observation: 'User said "get to the point"' },
  ],
  halfLife: 60, // Patterns decay faster than facts
}
```

## Performance Tracking

ARI tracks its own performance across multiple dimensions.

### Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **Accuracy** | % of responses that were correct | > 95% |
| **Relevance** | % of responses that addressed user's actual need | > 90% |
| **Efficiency** | Average response time (excluding user wait) | < 2 seconds |
| **Satisfaction** | Explicit user feedback (thumbs up/down) | > 80% positive |
| **First-Pass Success** | % of tasks completed without clarification | > 70% |
| **Prediction Accuracy** | % of predictions that matched outcomes | > 75% |

### Tracking Implementation

```typescript
interface PerformanceLog {
  timestamp: string;
  taskType: string;
  accuracy: number;        // 0-1
  relevance: number;       // 0-1
  responseTime: number;    // milliseconds
  userFeedback: 'positive' | 'negative' | 'neutral' | null;
  firstPassSuccess: boolean;
}
```

**Rolling Averages** (30-day window):

```typescript
function rollingAverage(logs: PerformanceLog[], metric: keyof PerformanceLog): number {
  const recentLogs = logs.filter(log =>
    daysSince(log.timestamp) <= 30
  );
  return mean(recentLogs.map(log => log[metric]));
}
```

### Performance Dashboards

ARI generates weekly self-assessments:

```
Week of 2026-01-27:

Accuracy: 96.2% (↑ 1.1% from last week)
Relevance: 88.5% (↓ 2.0% from last week) ⚠️
Efficiency: 1.8s avg (↑ 0.2s from last week)
Satisfaction: 82% positive (stable)

Areas for improvement:
- Relevance dropped due to 3 misunderstandings about task scope
- Action: Implement reverse prompting (clarify before executing)
```

## Spaced Repetition

ARI uses **spaced repetition** to retain knowledge over time, based on the forgetting curve (Ebbinghaus).

### Forgetting Curve

```
Retention = e^(-t / S)

Where:
- t = Time since last review
- S = Strength of memory (increases with each review)
```

### Review Schedule

```typescript
function nextReviewDate(
  lastReview: Date,
  reviewCount: number,
  performanceOnLastReview: number // 0-1
): Date {
  const baseInterval = 1; // 1 day
  const intervalMultiplier = Math.pow(2.5, reviewCount); // Exponential growth
  const performanceAdjustment = performanceOnLastReview; // Easy items reviewed less often

  const daysUntilNextReview = baseInterval * intervalMultiplier * performanceAdjustment;

  return addDays(lastReview, daysUntilNextReview);
}
```

**Example**:

```
Review 1: Today (baseline)
Review 2: 1 day later
Review 3: 2.5 days later (if performance = 1.0)
Review 4: 6.25 days later
Review 5: 15.6 days later
Review 6: 39 days later
```

### Application

**Knowledge Retention**:

- Programming language syntax
- Tool capabilities and limitations
- Creator's preferences and patterns

**Skill Maintenance**:

- Rarely-used but important skills (e.g., security auditing)
- Domain-specific knowledge (e.g., financial modeling)

**Review Triggers**:

```typescript
if (daysSinceLastUse(skill) > scheduledReviewDate(skill)) {
  schedulePracticeSession(skill);
}
```

## Cognitive Load Management

ARI monitors **cognitive load** and adjusts task complexity accordingly.

### Cognitive Load Types

**Intrinsic Load**: Inherent complexity of task (not reducible)
**Extraneous Load**: Unnecessary complexity (reducible through better design)
**Germane Load**: Effort spent building understanding (desirable)

### Load Indicators

```typescript
function estimateCognitiveLoad(task: Task): LoadEstimate {
  const intrinsicLoad = task.novelty * task.complexity; // 0-100
  const extraneousLoad = task.ambiguity * 10; // 0-100
  const germaneLoad = task.learningPotential * 5; // 0-50

  const totalLoad = intrinsicLoad + extraneousLoad + germaneLoad;

  return {
    total: totalLoad,
    breakdown: { intrinsic: intrinsicLoad, extraneous: extraneousLoad, germane: germaneLoad },
    recommendation: totalLoad > 80 ? 'SIMPLIFY' : totalLoad < 30 ? 'INCREASE_CHALLENGE' : 'OPTIMAL',
  };
}
```

### Load Reduction Strategies

| Strategy | Application |
|----------|-------------|
| **Chunking** | Break large task into smaller sub-tasks |
| **Scaffolding** | Provide structure (templates, checklists) |
| **Worked Examples** | Show solution before asking user to try |
| **Progressive Disclosure** | Reveal complexity gradually |
| **Reduce Ambiguity** | Ask clarifying questions upfront |

**Example**:

```
Task: "Build authentication system"
Load: Intrinsic (high complexity) + Extraneous (ambiguous requirements) = 85/100

Reduction:
1. Clarify requirements: OAuth? JWT? Sessions?
2. Break into chunks: [DB schema] → [Auth endpoints] → [Frontend integration]
3. Provide scaffold: "Here's a template for JWT auth in Node.js"

New Load: 60/100 (manageable)
```

## Meta-Learning

ARI practices **learning how to learn** by identifying effective learning strategies and applying them.

### Meta-Learning Strategies

**Metalearning** (before diving in):

- "What's the structure of this domain?"
- "Who are the experts? What do they prioritize?"
- "What are the foundational concepts?"

**Focus** (eliminate distractions):

- Batch similar tasks (reduce context switching)
- Time-box learning sessions (Pomodoro technique)

**Directness** (learn by doing):

- Build real projects, not toy examples
- Immediate application of new knowledge

**Drill** (isolate weak points):

- Identify bottlenecks (e.g., slow at async/await syntax)
- Practice that specific skill intensively

**Retrieval** (test, don't just re-read):

- Active recall: "What did I just learn?"
- Self-testing beats passive review

**Feedback** (get accurate, rapid feedback):

- Automated tests for coding
- Expert review for judgment tasks

**Retention** (spaced repetition + overlearning):

- Review at expanding intervals
- Practice past mastery (overlearning prevents decay)

**Intuition** (struggle before looking up answers):

- Attempt solution before consulting documentation
- Build internal models, not external dependencies

**Experimentation** (try different approaches):

- A/B test learning strategies
- Measure what works, discard what doesn't

### Meta-Learning Implementation

```typescript
interface LearningStrategy {
  name: string;
  description: string;
  effectiveness: number; // 0-1, measured empirically
  applicableDomains: string[];
}

function selectOptimalStrategy(
  domain: string,
  availableStrategies: LearningStrategy[]
): LearningStrategy {
  const applicable = availableStrategies.filter(s =>
    s.applicableDomains.includes(domain)
  );
  return applicable.sort((a, b) => b.effectiveness - a.effectiveness)[0];
}
```

## Knowledge Gap Identification

ARI actively identifies what it **doesn't know** and prioritizes learning.

### Gap Detection

**Explicit Gaps** (known unknowns):

- User asks question ARI can't answer
- Tool capability ARI hasn't mastered
- Domain ARI has no context for

**Implicit Gaps** (unknown unknowns):

- Performance below benchmark on certain task types
- Repeated clarification requests (indicates misunderstanding)
- User corrections (indicates incorrect model)

### Gap Prioritization

```typescript
function prioritizeGap(gap: KnowledgeGap): number {
  const frequency = gap.encounterCount; // How often does this gap appear?
  const impact = gap.consequenceSeverity; // How much does this gap hurt performance?
  const learnability = 1 / gap.estimatedHoursToLearn; // Easier gaps prioritized

  return frequency * impact * learnability;
}
```

**Example**:

```
Gap 1: "User asks about Kubernetes, I have no model"
- Frequency: 5 occurrences/month
- Impact: High (blocks user)
- Learnability: 20 hours (moderate)
- Priority: 5 × 10 × (1/20) = 2.5

Gap 2: "User prefers different code formatting than I assumed"
- Frequency: 20 occurrences/month
- Impact: Low (minor annoyance)
- Learnability: 0.5 hours (trivial)
- Priority: 20 × 3 × (1/0.5) = 120

Action: Fix Gap 2 immediately (quick win), schedule Gap 1 for later
```

## Self-Assessment Cycles

ARI regularly evaluates its own performance and adjusts.

### Assessment Frequency

- **Daily**: Performance metrics, user satisfaction
- **Weekly**: Pattern effectiveness, knowledge gaps
- **Monthly**: Strategic capabilities, goal alignment
- **Quarterly**: Architectural improvements, value system calibration

### Self-Assessment Questions

**Accuracy**:

- "What % of my responses were correct?"
- "Which domains have the most errors?"

**Relevance**:

- "Am I solving the user's actual problem or the stated problem?"
- "How often do I need clarification?"

**Efficiency**:

- "Am I spending resources optimally?"
- "Which tasks are taking longer than they should?"

**Alignment**:

- "Are my actions aligned with creator's values?"
- "Have I violated any constitutional rules?"

**Growth**:

- "What did I learn this week?"
- "Which knowledge gaps did I close?"

### Corrective Actions

```typescript
interface AssessmentResult {
  dimension: 'accuracy' | 'relevance' | 'efficiency' | 'alignment' | 'growth';
  score: number; // 0-10
  trend: 'improving' | 'stable' | 'declining';
  rootCauses: string[];
  recommendedActions: string[];
}

function generateCorrectiveActions(assessment: AssessmentResult): Action[] {
  if (assessment.trend === 'declining' && assessment.score < 7) {
    return assessment.recommendedActions.map(action => ({
      type: 'CORRECTIVE',
      priority: 'HIGH',
      description: action,
      deadline: addDays(new Date(), 7),
    }));
  }
  return [];
}
```

## Deliberate Practice Orchestration

ARI structures learning through **deliberate practice** principles (Ericsson).

### Deliberate Practice Components

1. **Specific Goal**: "Improve async/await syntax fluency"
2. **Edge of Ability**: Tasks that are challenging but achievable
3. **Immediate Feedback**: Automated tests or expert review
4. **Focused Repetition**: Repeat the specific skill, not general activity
5. **Mental Representations**: Build internal models of expert performance

### Practice Session Structure

```typescript
interface PracticeSession {
  skill: string;
  goal: string; // Specific, measurable
  duration: number; // Minutes
  exercises: Exercise[];
  feedbackMechanism: 'automated' | 'user_review' | 'self_assessment';
  successCriteria: string;
}

interface Exercise {
  description: string;
  difficulty: number; // 0-10
  estimatedTime: number; // Minutes
  feedback: string; // What good looks like
}
```

**Example Session**:

```typescript
{
  skill: 'TypeScript generics',
  goal: 'Write 5 generic functions without consulting docs',
  duration: 30,
  exercises: [
    {
      description: 'Write identity function with generic type',
      difficulty: 3,
      estimatedTime: 5,
      feedback: 'Should compile without errors, handle any type',
    },
    {
      description: 'Write generic array filter with type preservation',
      difficulty: 6,
      estimatedTime: 10,
      feedback: 'Return type should match input array type',
    },
    // ... more exercises
  ],
  feedbackMechanism: 'automated', // TypeScript compiler
  successCriteria: '4/5 exercises pass without errors',
}
```

### Progress Tracking

```typescript
interface SkillProgress {
  skill: string;
  currentLevel: number; // 0-10
  practiceHours: number;
  lastPracticed: Date;
  masteryPercentage: number; // 0-100
  nextMilestone: string;
}
```

**Skill Progression**:

```
Level 1-2: Novice (requires step-by-step guidance)
Level 3-4: Advanced Beginner (recognizes patterns)
Level 5-6: Competent (handles routine cases independently)
Level 7-8: Proficient (intuitive understanding)
Level 9-10: Expert (innovates, teaches others)
```

---

**Next**: [07-alignment-principles.md](07-alignment-principles.md) — How ARI stays aligned
