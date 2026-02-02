# Cognitive Layer 0 — LOGOS / ETHOS / PATHOS

This is Layer 0: the cognitive foundation that provides reasoning frameworks, bias detection, emotional intelligence, and continuous learning to all higher layers.

## Architecture

```
Layer 0: Cognitive
├── logos/      — REASON: Bayesian, Expected Value, Kelly, Systems, Antifragility
├── ethos/      — CHARACTER: Bias detection, Emotional state, Discipline
├── pathos/     — GROWTH: CBT, Stoicism, Wisdom, Deliberate Practice
├── knowledge/  — 92 curated sources, 16 Council cognitive profiles
├── learning/   — 5-stage learning loop: review → gaps → discovery → integration → assessment
└── visualization/ — Insight formatters for Claude Code and Dashboard
```

## Three Pillars

| Pillar | Purpose | Key Frameworks |
|--------|---------|----------------|
| **LOGOS** 🧠 | Reason & Calculation | Bayesian, Kelly Criterion, Expected Value, Systems Thinking, Antifragility |
| **ETHOS** ❤️ | Character & Discipline | Cognitive Bias Detection, Emotional State (VAD), Fear/Greed Cycle, Pre-Decision Discipline |
| **PATHOS** 🌱 | Growth & Wisdom | CBT Reframing, Dichotomy of Control, Virtue Ethics, Deliberate Practice, Wisdom Traditions |

## API Reference

### LOGOS APIs

| Function | Purpose |
|----------|---------|
| `updateBelief(prior, evidence)` | Bayesian probability update |
| `updateBeliefSequential(belief, evidenceList)` | Sequential Bayesian updates |
| `calculateExpectedValue(decision)` | EV calculation with recommendation |
| `rankDecisions(decisions)` | Rank multiple decisions by EV |
| `calculateKellyFraction(input)` | Optimal position sizing |
| `assessRiskOfRuin(strategy, iterations)` | Monte Carlo ruin analysis |
| `evaluateDecisionTree(root)` | Recursive tree evaluation |
| `identifyLeveragePoints(components)` | Meadows 12 leverage points |
| `analyzeSystem(components, situation)` | Systems thinking analysis |
| `assessAntifragility(item, stressors)` | Taleb antifragility assessment |

### ETHOS APIs

| Function | Purpose |
|----------|---------|
| `detectCognitiveBias(reasoning, context)` | Detect 10 cognitive biases |
| `getBiasInfo(biasType)` | Get bias description and mitigation |
| `assessEmotionalState(input)` | VAD emotional state analysis |
| `detectFearGreedCycle(indicators, emotionalState)` | Trading psychology patterns |
| `runDisciplineCheck(decision, tier, context)` | Pre-decision discipline check |

### PATHOS APIs

| Function | Purpose |
|----------|---------|
| `reframeThought(thought, context)` | CBT cognitive reframing |
| `analyzeDichotomy(situation, items)` | Dichotomy of control analysis |
| `checkVirtueAlignment(decision, virtues, context)` | Stoic virtue check |
| `reflect(outcome, context)` | Kolb learning cycle reflection |
| `queryWisdom(query, traditions)` | Query 7 wisdom traditions |
| `generatePracticePlan(skill, current, target, constraints)` | Ericsson deliberate practice |

### Learning APIs

| Function | Purpose |
|----------|---------|
| `getLearningStatus()` | Current learning loop status |
| `runPerformanceReview(decisions)` | Daily 9PM performance review |
| `runGapAnalysis(queries, failures)` | Weekly gap identification |
| `runSelfAssessment(current, previous)` | Monthly self-evaluation |
| `addInsight(insight)` | Store a new insight |
| `getRecentInsights(limit)` | Retrieve recent insights |

### Knowledge APIs

| Function | Purpose |
|----------|---------|
| `getEnabledSources()` | Get 92 enabled knowledge sources |
| `getSourcesByPillar(pillar)` | Filter sources by pillar |
| `getSourcesByTrustLevel(level)` | Filter by trust (VERIFIED, STANDARD) |
| `validateContent(content, sourceId)` | 5-stage content validation |
| `getAllCouncilProfiles()` | Get 16 Council cognitive profiles |
| `getCouncilProfile(memberId)` | Get specific member profile |

## EventBus Events

All cognitive operations emit typed events for real-time tracking:

```typescript
// LOGOS
'cognition:belief_updated'           // Bayesian update completed
'cognition:expected_value_calculated' // EV calculation done
'cognition:kelly_calculated'         // Position sizing calculated

// ETHOS
'cognition:bias_detected'            // Cognitive bias found
'cognition:emotional_risk'           // High emotional risk detected
'cognition:discipline_check'         // Pre-decision check completed

// PATHOS
'cognition:thought_reframed'         // CBT reframe applied
'cognition:reflection_complete'      // Reflection session done
'cognition:wisdom_consulted'         // Wisdom tradition queried
'cognition:practice_plan_created'    // New practice plan generated

// Learning Loop
'learning:performance_review'        // Daily review completed
'learning:gap_analysis'              // Weekly gap analysis done
'learning:self_assessment'           // Monthly assessment done
'learning:insight_generated'         // New insight stored
```

## Learning Loop Schedule

| Task | Schedule | Purpose |
|------|----------|---------|
| Performance Review | Daily 9PM | Analyze day's decisions |
| Gap Analysis | Sunday 8PM | Identify knowledge gaps |
| Self-Assessment | 1st of month 9AM | Comprehensive evaluation |

## Visualization

The visualization module formats cognitive results for display:

```typescript
import { formatInsightBlock, formatComprehensiveAnalysis } from './visualization/index.js';

// Format single result
const output = formatExpectedValueInsight(evResult);

// Format cross-pillar analysis
const analysis = formatComprehensiveAnalysis({ ev, kelly, biases, emotional });
```

## Usage Examples

### Bayesian Update

```typescript
import { updateBelief } from './logos/index.js';

const result = await updateBelief(
  { hypothesis: 'Investment will succeed', priorProbability: 0.5 },
  { description: 'Strong market indicators', likelihoodRatio: 3.0, strength: 'strong' }
);
// result.posteriorProbability > 0.5
```

### Bias Detection

```typescript
import { detectCognitiveBias } from './ethos/index.js';

const result = await detectCognitiveBias(
  'I knew this would happen all along. Everyone agrees with me.',
  { expertise: 'intermediate' }
);
// result.biasesDetected: ['HINDSIGHT_BIAS', 'CONFIRMATION_BIAS']
```

### CBT Reframing

```typescript
import { reframeThought } from './pathos/index.js';

const result = await reframeThought(
  'I always fail at everything. This will be a disaster.',
  { situation: 'Starting new project' }
);
// result.distortionsDetected: ['ALL_OR_NOTHING', 'CATASTROPHIZING']
// result.reframedThought: balanced perspective
```

## Integration Points

- **API Routes**: `/api/cognition/*` endpoints in `src/api/routes.ts`
- **WebSocket**: Real-time events broadcast via `src/api/ws.ts`
- **Dashboard**: Cognition page at `dashboard/src/pages/Cognition.tsx`
- **Scheduler**: Learning loop tasks in `src/autonomous/scheduler.ts`

## Constitutional Rules

1. **Provenance Required**: All cognitive outputs include framework attribution
2. **Trust Validation**: Knowledge sources filtered by trust level
3. **Bias Transparency**: All detected biases logged with evidence
4. **Learning Persistence**: Insights stored for pattern extraction

Skills: `/ari-cognitive-layer`, `/ari-learning-loop`
