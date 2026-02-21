# Cognitive API Reference

**Version**: 1.0.0  
**Date**: 2026-02-01  
**Total APIs**: 25+ functions across three pillars

---

## LOGOS APIs

### Bayesian Reasoning

- `updateBelief(prior, evidence)` - Update belief with new evidence
- `calculatePosterior(p_h, p_e_h, p_e)` - Raw Bayes calculation
- `updateBeliefSequential(belief, evidenceList)` - Multiple evidence

### Expected Value

- `calculateExpectedValue(decision)` - Compute EV
- `rankDecisions(decisions)` - Compare alternatives

### Kelly Criterion

- `calculateKellyFraction(input)` - Optimal position sizing
- `assessRiskOfRuin(strategy, iterations)` - Monte Carlo risk

### Decision Trees

- `analyzeDecisionTree(root)` - Backward induction, optimal path

### Systems Thinking

- `identifyLeveragePoints(system)` - Meadows' 12 leverage points
- `analyzeFeedbackLoops(system)` - Predict system behavior

### Antifragility

- `analyzeAntifragility(decision)` - Fragile vs robust vs antifragile

---

## ETHOS APIs

### Bias Detection

- `detectCognitiveBias(reasoning, context)` - All 10 biases
- (Individual detectors for each bias type)

### Emotional State

- `checkEmotionalState(agent, context)` - Valence/arousal/dominance
- `calculateEmotionalRisk(state)` - Risk to decision quality

### Fear/Greed

- `detectFearGreedCycle(decisions, outcomes)` - Pattern detection

### Discipline

- `checkDiscipline(decision, agent, context)` - Pre-decision checklist

---

## PATHOS APIs

### CBT

- `reframeThought(thought, context)` - Detect distortions, reframe

### Reflection

- `reflectOnOutcome(outcome)` - Extract insights
- `synthesizeLearning(experiences)` - Find patterns

### Wisdom

- `consultWisdom(query)` - Query wisdom traditions

### Meta-Learning

- `createLearningPlan(skill, current, target)` - Practice plan

---

## Cross-Cutting

- `queryKnowledge(query)` - Semantic search
- `getCognitiveHealth()` - Layer 0 status

---

**Full API specification**: See [ADR-013](../architecture/adr/ADR-013-cognitive-api-design.md) for complete details with parameters, return types, examples.
