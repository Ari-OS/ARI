# Cognitive Layer 0 — LOGOS / ETHOS / PATHOS

This is Layer 0: the cognitive foundation that provides reasoning frameworks, bias detection, emotional intelligence, and wisdom to all higher layers.

## Architecture

```
Layer 0: Cognitive (trimmed to essentials)
├── logos/      — REASON: Bayesian, Expected Value, Kelly, Systems, Antifragility
├── ethos/      — CHARACTER: Bias detection, Emotional state, Discipline
├── pathos/     — GROWTH: CBT, Stoicism, Wisdom, Deliberate Practice
├── learning/
│   └── decision-journal.ts — Real-time decision recording with framework attribution
├── types.ts    — Shared type definitions
├── constants.ts — Shared constants
├── errors.ts   — Error types
├── synthesis.ts — Cross-pillar analysis
└── index.ts    — Barrel exports
```

**Additional modules** (active):
- `knowledge/` — Cognitive source management (5 files: cognitive-sources, content-validator, source-manager, specializations, index)
- `learning/` — Self-improvement subsystem (7 files: decision-journal, calibration-tracker, gap-analysis, learning-loop, performance-review, self-assessment, index)

## Three Pillars

| Pillar | Purpose | Key Frameworks |
|--------|---------|----------------|
| **LOGOS** | Reason & Calculation | Bayesian, Kelly Criterion, Expected Value, Systems Thinking, Antifragility |
| **ETHOS** | Character & Discipline | Cognitive Bias Detection, Emotional State (VAD), Fear/Greed Cycle, Pre-Decision Discipline |
| **PATHOS** | Growth & Wisdom | CBT Reframing, Dichotomy of Control, Virtue Ethics, Deliberate Practice, Wisdom Traditions |

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

### Decision Journal

| Function | Purpose |
|----------|---------|
| `DecisionJournal.initialize(eventBus)` | Subscribe to cognitive events |
| `DecisionJournal.recordDecision(params)` | Record a decision entry |
| `DecisionJournal.getRecentDecisions(hours)` | Get recent decisions |
| `DecisionJournal.getDecisionStats()` | Aggregate statistics |
| `DecisionJournal.updateOutcome(id, outcome)` | Update decision outcome |

## EventBus Events

Cognitive events are defined in EventMap for DecisionJournal subscription:

```typescript
// LOGOS
'cognition:belief_updated'           // Bayesian update completed
'cognition:expected_value_calculated' // EV calculation done
'cognition:kelly_calculated'         // Position sizing calculated
'cognition:leverage_point_identified' // Systems leverage point found
'cognition:antifragility_assessed'   // Antifragility score calculated
'cognition:decision_tree_evaluated'  // Decision tree evaluation done

// ETHOS
'cognition:bias_detected'            // Cognitive bias found
'cognition:emotional_risk'           // High emotional risk detected
'cognition:discipline_check'         // Pre-decision check completed
'cognition:fear_greed_detected'      // Fear/greed cycle pattern

// PATHOS
'cognition:thought_reframed'         // CBT reframe applied
'cognition:reflection_complete'      // Reflection session done
'cognition:wisdom_consulted'         // Wisdom tradition queried
'cognition:practice_plan_created'    // New practice plan generated
'cognition:dichotomy_analyzed'       // Dichotomy of control analysis
'cognition:virtue_check'             // Virtue alignment check
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

- **API Routes**: `/api/cognition/*` endpoints in `src/api/routes/cognitive.ts`
- **WebSocket**: Real-time events broadcast via `src/api/ws.ts`
- **Dashboard**: Cognition page at `dashboard/src/pages/Cognition.tsx`
- **Decision Journal**: Used by self-improvement-loop and weekly-wisdom-digest

## Constitutional Rules

1. **Provenance Required**: All cognitive outputs include framework attribution
2. **Bias Transparency**: All detected biases logged with evidence
3. **Decision Persistence**: All decisions recorded via DecisionJournal

Skills: `/ari-cognitive-layer`
