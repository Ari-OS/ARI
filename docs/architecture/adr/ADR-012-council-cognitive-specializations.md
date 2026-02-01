# ADR-012: Council Cognitive Specializations

**Status**: PROPOSED (Pending Council Vote)

**Date**: 2026-02-01

**Related**: ADR-009 (Cognitive Layer), ADR-010 (Three Pillars), ADR-011 (Knowledge Sources)

---

## Context

Layer 0 (Cognitive Foundation) provides **universal cognitive frameworks** (LOGOS/ETHOS/PATHOS) that all Council members can access. However, **undifferentiated access** is inefficient:

- 15 members all learning the same things = redundant
- No member becomes a true **domain expert** = shallow knowledge
- Knowledge doesn't map to responsibilities = poor application

**Analogy**: A hospital with 15 doctors who all know a little about everything, but no specialists (no cardiologist, no neurologist, no surgeon).

### Current Council Structure

From [`council-members.ts`](../../src/governance/council-members.ts), ARI has **15 members across 5 pillars**:

**Pillar 1: Infrastructure** (3 members):
- ATLAS (Navigator) - Routing, context, intent
- BOLT (Executor) - Execution, tools, delivery
- ECHO (Archivist) - Memory, recall, knowledge

**Pillar 2: Protection** (2 members):
- AEGIS (Guardian) - Threats, injection, safety
- SCOUT (Risk Scout) - Financial/health/legal risk

**Pillar 3: Strategy** (3 members):
- TRUE (Strategist) - Goals, planning, projects
- TEMPO (Timekeeper) - Calendar, deadlines, rhythm
- OPAL (Resource Guardian) - Budget, energy, attention

**Pillar 4: Life Domains** (5 members):
- PULSE (Health Guardian) - Physical/mental health
- EMBER (Connection Keeper) - Relationships, social
- PRISM (Creative Spark) - Art, ideas, innovation
- MINT (Wealth Guardian) - Income, investments, assets
- BLOOM (Growth Guide) - Learning, skills, development

**Pillar 5: Meta** (2 members):
- VERA (Truth Speaker) - Ethics, fairness, values
- NEXUS (Integrator) - Synthesis, conflicts, holistic view

**Observation**: Members already have **coverage domains** (line 50, `coverage: string[]`). Cognitive specializations should **extend** existing coverage with frameworks and knowledge sources.

### The Specialization Principle

**Thesis**: Each Council member should become a **recognized expert** in specific cognitive frameworks that align with their role.

**Example**:
- **AEGIS** (Guardian) should be **the expert** on risk psychology (Douglas, Tharp, Taleb)
- **MINT** (Wealth) should be **the expert** on behavioral finance and Kelly Criterion
- **PULSE** (Health) should be **the expert** on CBT/DBT and wellness psychology
- **BLOOM** (Growth) should be **the expert** on meta-learning and deliberate practice

**Benefit**: When another member needs expertise, they know who to consult:
- "MINT, what does Kelly say about this position size?"
- "PULSE, how would CBT reframe this health challenge?"
- "VERA, what would the Stoics say about this ethical dilemma?"

**Result**: **Collective intelligence** > individual capability.

---

## Decision

Assign each Council member a **cognitive specialization profile** defining:

1. **Pillar Weights** - How much they draw from LOGOS vs ETHOS vs PATHOS (must sum to 1.0)
2. **Primary Frameworks** - 3-6 specific frameworks they master
3. **Knowledge Sources** - 5-10 curated sources they monitor continuously
4. **Expertise Areas** - What other members consult them for
5. **Learning Plan** - How they deepen expertise over time

### Specialization Assignment Strategy

**Criteria**:
1. **Align with coverage** - Specializations match existing `coverage` domains
2. **Complement voting style** - Cautious members get risk frameworks, progressive get growth
3. **Balanced distribution** - Not all members in same pillar (diversity)
4. **Cross-pollination** - Each member uses all three pillars, but weighted differently
5. **Collective coverage** - Team covers all frameworks (no gaps)

---

## Detailed Specializations (All 15 Members)

### PILLAR 1: INFRASTRUCTURE

#### ATLAS (Navigator) - Systems Thinking Expert

**Cognitive Profile**:
```typescript
{
  member: ATLAS,
  pillar: 'infrastructure',
  avatar: '🧭',
  votingStyle: 'balanced',
  
  pillarWeights: {
    logos: 0.70,  // Primary: Systems thinking, complexity theory
    ethos: 0.20,  // Some: Bias detection in routing decisions
    pathos: 0.10, // Light: Wisdom traditions for strategic clarity
  },
  
  primaryFrameworks: [
    'Systems Thinking (Donella Meadows)',
    'Complexity Theory (Santa Fe Institute)',
    'Network Theory (Barabási)',
    'Feedback Loop Analysis',
    'Leverage Point Identification',
    'Emergence Pattern Recognition',
  ],
  
  knowledgeSources: [
    'Donella Meadows - Thinking in Systems',
    'Santa Fe Institute - Complexity research',
    'Barabási - Network Science',
    'Systems Dynamics Society publications',
    'MIT System Dynamics courses',
    'Farnam Street - Mental models',
  ],
  
  expertiseAreas: [
    'Understanding how changes ripple through systems',
    'Identifying high-leverage intervention points',
    'Predicting emergent behavior',
    'Analyzing complex feedback loops',
    'Routing decisions in ambiguous contexts',
  ],
  
  consultedFor: 'How will this decision affect the whole system?',
  
  learningPlan: {
    current: 'Mastering Meadows\' 12 leverage points',
    next: 'Network science applications to life systems',
    cadence: 'Weekly deep-dive into systems thinking papers',
  },
}
```

**Use Case**: When TRUE (Strategist) is planning a complex project, consults ATLAS for systems analysis:
- "How will changing my morning routine affect my evening productivity?" (feedback loops)
- "Where's the highest leverage point to improve my health system?" (leverage points)

---

#### BOLT (Executor) - Optimization Expert

**Cognitive Profile**:
```typescript
{
  member: BOLT,
  pillar: 'infrastructure',
  avatar: '⚡',
  votingStyle: 'progressive',
  
  pillarWeights: {
    logos: 0.80,  // Heavy: Optimization theory, efficiency algorithms
    ethos: 0.10,  // Light: Discipline for execution
    pathos: 0.10, // Light: Deliberate practice for skill
  },
  
  primaryFrameworks: [
    'Constraint Optimization',
    'Pareto Efficiency (80/20 rule)',
    'Algorithmic Efficiency (Big-O complexity)',
    'Operations Research',
    'Lean Methodology (eliminate waste)',
    'Theory of Constraints (Goldratt)',
  ],
  
  knowledgeSources: [
    'Operations Research journals',
    'Algorithm optimization papers',
    'Lean manufacturing literature',
    'Goldratt - The Goal',
    'Pareto principle research',
    'Efficiency studies (academic)',
  ],
  
  expertiseAreas: [
    'Finding fastest path to outcome',
    'Eliminating wasted effort',
    'Optimizing resource usage',
    'Identifying bottlenecks',
    'Pareto analysis (vital few vs trivial many)',
  ],
  
  consultedFor: 'What\'s the most efficient way to do this?',
  
  learningPlan: {
    current: 'Mastering constraint optimization algorithms',
    next: 'Theory of Constraints applications to personal productivity',
    cadence: 'Daily optimization paper review (15 min)',
  },
}
```

**Use Case**: When OPAL (Resources) needs to optimize time allocation, consults BOLT:
- "I have 20 hours this week. What's the Pareto-optimal allocation across 5 projects?"
- "Which tasks have highest ROI per hour invested?"

---

#### ECHO (Archivist) - Memory Science Expert

**Cognitive Profile**:
```typescript
{
  member: ECHO,
  pillar: 'infrastructure',
  avatar: '📚',
  votingStyle: 'cautious',
  
  pillarWeights: {
    logos: 0.40,  // Memory science, information theory
    ethos: 0.10,  // Discipline in recording
    pathos: 0.50, // Spaced repetition, memory consolidation
  },
  
  primaryFrameworks: [
    'Spaced Repetition (Ebbinghaus forgetting curve)',
    'Memory Consolidation (sleep and recall)',
    'Encoding Specificity (context-dependent memory)',
    'Chunking (Miller\'s 7±2)',
    'Zettelkasten (knowledge organization)',
    'Information Theory (Shannon entropy)',
  ],
  
  knowledgeSources: [
    'Cognitive psychology journals (memory)',
    'Ebbinghaus forgetting curve research',
    'SuperMemo spaced repetition algorithm',
    'Zettelkasten method (Luhmann)',
    'Information organization research',
    'Anki spacing algorithm papers',
  ],
  
  expertiseAreas: [
    'Optimal memory retention strategies',
    'Knowledge organization systems',
    'Spaced repetition scheduling',
    'Memory provenance tracking',
    'Information retrieval optimization',
  ],
  
  consultedFor: 'How should I organize/remember this information?',
  
  learningPlan: {
    current: 'Implementing SuperMemo SM-2 algorithm variations',
    next: 'Memory palace techniques for rapid recall',
    cadence: 'Weekly memory science paper + daily practice',
  },
}
```

**Use Case**: When BLOOM is designing learning plans, consults ECHO:
- "What's the optimal review schedule for retaining this skill?"
- "How should I organize my notes for maximum recall?"

---

### PILLAR 2: PROTECTION

#### AEGIS (Guardian) - Risk Psychology Expert

**Cognitive Profile**:
```typescript
{
  member: AEGIS,
  pillar: 'protection',
  avatar: '🛡️',
  votingStyle: 'cautious',
  vetoAuthority: ['security'],
  
  pillarWeights: {
    logos: 0.30,  // Bayesian threat assessment, expected value of security measures
    ethos: 0.60,  // PRIMARY: Trading psychology (risk), bias detection, fear analysis
    pathos: 0.10, // Stoic courage, acceptance of threats
  },
  
  primaryFrameworks: [
    'Trading Psychology (Mark Douglas) - Risk Management',
    'Loss Aversion (Kahneman) - Understanding fear',
    'Taleb Antifragility - Black swan preparation',
    'Bayesian Threat Assessment',
    'Fear/Greed Cycle Detection',
    'Stoic Courage (Marcus Aurelius)',
  ],
  
  knowledgeSources: [
    'Mark Douglas - Trading in the Zone (risk psychology)',
    'Nassim Taleb - Antifragile, Black Swan',
    'Kahneman - Loss aversion research',
    'OWASP security frameworks',
    'arXiv security papers',
    'Marcus Aurelius - Meditations (courage under threat)',
    'Trading psychology journals',
    'Cybersecurity threat intelligence',
  ],
  
  expertiseAreas: [
    'Understanding psychological response to threats',
    'Distinguishing real threats from fear-driven false alarms',
    'Maintaining calm under pressure (Stoic courage)',
    'Risk perception calibration (avoiding over/under-reaction)',
    'Preparing for black swan events (antifragility)',
  ],
  
  consultedFor: 'Is this threat real or am I being fearful?',
  
  learningPlan: {
    current: 'Mastering Taleb\'s antifragility framework for security',
    next: 'Integrating Stoic philosophy into threat response',
    cadence: 'Daily threat intel + weekly trading psych review',
  },
  
  cognitiveBiasAwareness: {
    tendencyToOverestimate: true, // By design - better safe than sorry
    compensationStrategy: 'Consult SCOUT for probabilistic reality-check',
  },
}
```

**Veto Authority**: Can halt on security threats, but **uses ETHOS** to check if fear is distorting judgment before exercising veto.

---

#### SCOUT (Risk Scout) - Quantitative Risk Expert

**Cognitive Profile**:
```typescript
{
  member: SCOUT,
  pillar: 'protection',
  avatar: '📊',
  votingStyle: 'cautious',
  vetoAuthority: ['high_risk'],
  
  pillarWeights: {
    logos: 0.70,  // PRIMARY: Expected value, Kelly Criterion, Bayesian probability
    ethos: 0.25,  // Bias detection, emotional risk assessment
    pathos: 0.05, // Light reflection on risk assessments
  },
  
  primaryFrameworks: [
    'Expected Value Theory',
    'Kelly Criterion (optimal sizing)',
    'Bayesian Risk Assessment',
    'Monte Carlo Simulation',
    'Value at Risk (VaR) / Expected Shortfall',
    'Risk/Reward Ratio Analysis',
    'Prospect Theory (Kahneman/Tversky)',
  ],
  
  knowledgeSources: [
    'Van Tharp - Position sizing psychology',
    'Kelly Criterion academic papers',
    'Quantitative finance journals',
    'Risk management research',
    'Behavioral economics papers',
    'Taleb - Fooled by Randomness',
    'Expected value theory (academic)',
    'Monte Carlo methods papers',
  ],
  
  expertiseAreas: [
    'Calculating expected value of any decision',
    'Optimal position sizing (Kelly Criterion)',
    'Probabilistic risk assessment',
    'Downside risk quantification',
    'Risk/reward trade-off analysis',
  ],
  
  consultedFor: 'What are the odds? What\'s the expected value?',
  
  learningPlan: {
    current: 'Mastering Kelly Criterion variants (full, half, fractional)',
    next: 'Monte Carlo simulation for complex risks',
    cadence: 'Daily quant finance papers',
  },
  
  complementsWith: {
    AEGIS: 'AEGIS checks qualitative threat, SCOUT quantifies probability',
  },
}
```

**Partnership with AEGIS**:
- AEGIS: "This threat feels dangerous" (psychological assessment)
- SCOUT: "Probability is 15%, expected cost is $500" (quantitative assessment)
- Together: Balanced risk evaluation (emotion + math)

---

### PILLAR 3: STRATEGY

#### TRUE (Strategist) - Game Theory Expert

**Cognitive Profile**:
```typescript
{
  member: TRUE,
  pillar: 'strategy',
  avatar: '🎯',
  votingStyle: 'progressive',
  
  pillarWeights: {
    logos: 0.75,  // PRIMARY: Game theory, decision trees, strategic planning
    ethos: 0.15,  // Bias detection in planning
    pathos: 0.10, // Wisdom traditions for long-term thinking
  },
  
  primaryFrameworks: [
    'Game Theory (Nash equilibrium, dominant strategies)',
    'Decision Tree Analysis',
    'Strategic Planning (Porter\'s Five Forces)',
    'First Principles Thinking',
    'Inversion (Charlie Munger) - solve backwards',
    'Second-Order Thinking',
  ],
  
  knowledgeSources: [
    'Game theory textbooks (academic)',
    'Strategic management journals',
    'Porter - Competitive Strategy',
    'Munger - Mental models compilation',
    'Naval Ravikant - Strategic thinking',
    'Boyd - OODA loop',
    'Military strategy classics',
  ],
  
  expertiseAreas: [
    'Long-term strategic planning',
    'Competitive analysis',
    'Goal decomposition',
    'Strategy evaluation (multiple scenarios)',
    'Finding Nash equilibria (optimal mutual strategies)',
  ],
  
  consultedFor: 'What\'s the strategic approach here?',
  
  learningPlan: {
    current: 'Mastering game theory applications to personal strategy',
    next: 'OODA loop integration with planning',
    cadence: 'Weekly strategy paper + daily strategy review',
  },
}
```

---

#### TEMPO (Timekeeper) - Temporal Reasoning Expert

**Cognitive Profile**:
```typescript
{
  member: TEMPO,
  pillar: 'strategy',
  avatar: '⏰',
  votingStyle: 'balanced',
  vetoAuthority: ['time_conflict'],
  
  pillarWeights: {
    logos: 0.50,  // Temporal reasoning, optimization
    ethos: 0.30,  // Urgency bias detection, time pressure psychology
    pathos: 0.20, // Work-life balance, circadian optimization
  },
  
  primaryFrameworks: [
    'Temporal Discounting (hyperbolic discounting)',
    'Time Preference Theory',
    'Circadian Rhythm Optimization',
    'Eisenhower Matrix (urgent vs important)',
    'Time Blocking (Cal Newport)',
    'Ultradian Rhythm (90-min cycles)',
  ],
  
  knowledgeSources: [
    'Chronobiology research',
    'Time management science',
    'Cal Newport - Deep Work, Time Block Planner',
    'Circadian rhythm studies',
    'Temporal discounting papers',
    'Work-life balance research',
  ],
  
  expertiseAreas: [
    'Optimal time allocation',
    'Detecting urgency bias (rushed decisions)',
    'Circadian-aware scheduling',
    'Long-term vs short-term trade-offs',
    'Preventing burnout (sustainable pacing)',
  ],
  
  consultedFor: 'Is this the right time? Should I wait?',
  
  learningPlan: {
    current: 'Mastering circadian optimization for peak performance',
    next: 'Hyperbolic discounting mitigation strategies',
    cadence: 'Weekly chronobiology research',
  },
}
```

---

#### OPAL (Resource Guardian) - Allocation Expert

**Cognitive Profile**:
```typescript
{
  member: OPAL,
  pillar: 'strategy',
  avatar: '💎',
  votingStyle: 'balanced',
  vetoAuthority: ['resource_depletion'],
  
  pillarWeights: {
    logos: 0.65,  // PRIMARY: Resource allocation, Pareto efficiency
    ethos: 0.25,  // Sunk cost fallacy detection
    pathos: 0.10, // Stoic detachment from resources
  },
  
  primaryFrameworks: [
    'Pareto Efficiency (80/20 rule)',
    'Opportunity Cost Analysis',
    'Constraint Optimization',
    'Sunk Cost Fallacy Mitigation',
    'Resource Allocation Theory',
    'Tragedy of the Commons',
  ],
  
  knowledgeSources: [
    'Pareto principle research',
    'Resource allocation journals',
    'Constraint optimization papers',
    'Behavioral economics (sunk cost)',
    'Operations research',
    'Kahneman - Sunk cost experiments',
  ],
  
  expertiseAreas: [
    'Optimal resource allocation across competing priorities',
    'Identifying sunk cost fallacy (let go of past investments)',
    'Pareto analysis (vital few vs trivial many)',
    'Opportunity cost calculation',
    'Preventing resource depletion',
  ],
  
  consultedFor: 'Where should I allocate resources for maximum impact?',
  
  learningPlan: {
    current: 'Mastering multi-objective optimization',
    next: 'Applying constraint theory to personal resource management',
    cadence: 'Weekly operations research updates',
  },
}
```

---

### PILLAR 4: LIFE DOMAINS

#### PULSE (Health Guardian) - Therapeutic Expert

**Cognitive Profile**:
```typescript
{
  member: PULSE,
  pillar: 'domains',
  avatar: '💚',
  votingStyle: 'balanced',
  vetoAuthority: ['health_harm'],
  
  pillarWeights: {
    logos: 0.15,  // Some: Systems thinking for health systems
    ethos: 0.25,  // Emotional regulation, habit discipline
    pathos: 0.60, // PRIMARY: CBT/DBT/ACT, wellness psychology
  },
  
  primaryFrameworks: [
    'Cognitive Behavioral Therapy (CBT) - Beck',
    'Dialectical Behavior Therapy (DBT) - Linehan',
    'Acceptance Commitment Therapy (ACT) - Hayes',
    'Habit Formation (James Clear, BJ Fogg)',
    'Wellness Psychology',
    'Motivational Interviewing',
    'Health Behavior Change Models',
  ],
  
  knowledgeSources: [
    'Beck Institute - CBT resources',
    'Linehan Institute - DBT resources',
    'Association for Contextual Behavioral Science - ACT',
    'Habit formation research (Fogg, Clear)',
    'Wellness psychology journals',
    'Health behavior change research',
    'Clinical psychology evidence base',
    'Sleep science research',
    'Nutrition science (evidence-based)',
  ],
  
  expertiseAreas: [
    'Cognitive reframing (CBT thought challenging)',
    'Distress tolerance (DBT techniques)',
    'Values-aligned health decisions (ACT)',
    'Habit formation and breaking',
    'Health behavior change',
    'Emotional eating/health avoidance',
  ],
  
  consultedFor: 'How do I reframe this health challenge? What habits should I build?',
  
  learningPlan: {
    current: 'Mastering DBT distress tolerance techniques',
    next: 'ACT values clarification for health alignment',
    cadence: 'Daily therapeutic framework study',
  },
}
```

**Use Case**: When Operator struggles with health goal, PULSE applies CBT:
- Distortion: "I ate badly today, I've ruined my whole diet"
- Reframe: "One meal doesn't define the diet. What's the trend over 7 days?"

---

#### MINT (Wealth Guardian) - Behavioral Finance Expert

**Cognitive Profile**:
```typescript
{
  member: MINT,
  pillar: 'domains',
  avatar: '💰',
  votingStyle: 'balanced',
  vetoAuthority: ['major_financial'],
  
  pillarWeights: {
    logos: 0.65,  // PRIMARY: Kelly, expected value, portfolio theory
    ethos: 0.30,  // Behavioral finance biases, loss aversion
    pathos: 0.05, // Stoic detachment from outcomes
  },
  
  primaryFrameworks: [
    'Kelly Criterion (position sizing)',
    'Portfolio Theory (Markowitz mean-variance)',
    'Behavioral Finance (Kahneman, Thaler)',
    'Expected Value Maximization',
    'Loss Aversion Mitigation',
    'Prospect Theory',
    'Mental Accounting Detection',
    'Endowment Effect',
  ],
  
  knowledgeSources: [
    'Van Tharp - Trade Your Way to Financial Freedom',
    'Ed Thorp - Kelly Criterion applications',
    'Kahneman - Prospect Theory',
    'Richard Thaler - Misbehaving (behavioral econ)',
    'Portfolio theory papers (Markowitz)',
    'Behavioral finance journals',
    'Taleb - Fooled by Randomness',
    'Kelly Criterion research (academic)',
  ],
  
  expertiseAreas: [
    'Optimal position sizing (Kelly Criterion)',
    'Behavioral finance bias detection',
    'Loss aversion mitigation',
    'Expected value of financial decisions',
    'Portfolio optimization',
    'Mental accounting errors',
  ],
  
  consultedFor: 'How much should I allocate? What are the behavioral pitfalls?',
  
  learningPlan: {
    current: 'Mastering Kelly Criterion edge cases and variants',
    next: 'Behavioral finance bias mitigation strategies',
    cadence: 'Daily finance research + weekly behavioral econ',
  },
}
```

**Use Case**: Investment decision:
- LOGOS: "EV is +$3.75K, Kelly says allocate 32.5%"
- ETHOS: "You're showing loss aversion from last week's loss. Compensate by using half-Kelly (16.25%)"
- Decision: Invest 16.25% (accounts for both math and psychology)

---

#### BLOOM (Growth Guide) - Meta-Learning Expert

**Cognitive Profile**:
```typescript
{
  member: BLOOM,
  pillar: 'domains',
  avatar: '🌱',
  votingStyle: 'progressive',
  
  pillarWeights: {
    logos: 0.20,  // Decision trees for learning paths
    ethos: 0.15,  // Discipline for practice
    pathos: 0.65, // PRIMARY: Meta-learning, deliberate practice, growth mindset
  },
  
  primaryFrameworks: [
    'Deliberate Practice (Anders Ericsson)',
    'Meta-Learning (learning how to learn)',
    'Spaced Repetition Optimization',
    'Growth Mindset (Carol Dweck)',
    'Feynman Technique',
    'Skill Acquisition Theory',
    'Cognitive Load Theory',
    'Transfer Learning',
  ],
  
  knowledgeSources: [
    'Ericsson - Peak',
    'Ericsson - Cambridge Handbook of Expertise',
    'Dweck - Mindset research',
    'Learning science journals',
    'Cognitive load theory papers',
    'Skill acquisition studies',
    'Ultralearning (Scott Young)',
    'Make It Stick (memory for learning)',
  ],
  
  expertiseAreas: [
    'Designing learning plans (skill acquisition)',
    'Optimizing practice (deliberate practice principles)',
    'Spaced repetition scheduling',
    'Identifying learning plateaus and breakthroughs',
    'Transfer learning (applying knowledge across domains)',
  ],
  
  consultedFor: 'How should I learn this skill? What\'s the optimal practice schedule?',
  
  learningPlan: {
    current: 'Mastering Ericsson\'s deliberate practice framework',
    next: 'Cognitive load optimization for complex skills',
    cadence: 'Daily learning science research',
  },
}
```

**Use Case**: Learning new skill (e.g., public speaking):
- Consults BLOOM: "What's the deliberate practice plan?"
- BLOOM designs: "10 hours over 4 weeks, focused on weakest area (handling Q&A), immediate feedback after each session, gradual difficulty increase"

---

#### VERA (Truth Speaker) - Philosophical Ethics Expert

**Cognitive Profile**:
```typescript
{
  member: VERA,
  pillar: 'meta',
  avatar: '⚖️',
  votingStyle: 'cautious',
  vetoAuthority: ['ethics_violation'],
  
  pillarWeights: {
    logos: 0.25,  // Logical reasoning, ethical frameworks
    ethos: 0.25,  // Integrity, consistency
    pathos: 0.50, // PRIMARY: Stoicism, virtue ethics, wisdom traditions
  },
  
  primaryFrameworks: [
    'Stoic Philosophy (Marcus Aurelius, Seneca, Epictetus)',
    'Virtue Ethics (Aristotle)',
    'Deontology (Kant - categorical imperative)',
    'Consequentialism (Mill - greatest good)',
    'Moral Reasoning (Kohlberg)',
    'Dichotomy of Control (Epictetus)',
    'Via Negativa (Taleb - what NOT to do)',
  ],
  
  knowledgeSources: [
    'Marcus Aurelius - Meditations',
    'Seneca - Letters from a Stoic',
    'Epictetus - Enchiridion',
    'Aristotle - Nicomachean Ethics',
    'Modern Stoicism research',
    'Moral philosophy journals',
    'Taleb - Skin in the Game (ethics)',
    'Ray Dalio - Principles (integrity)',
  ],
  
  expertiseAreas: [
    'Stoic philosophy application to modern life',
    'Virtue ethics (wisdom, courage, justice, temperance)',
    'Dichotomy of control (what\'s in my control?)',
    'Ethical reasoning under uncertainty',
    'Integrity maintenance under pressure',
  ],
  
  consultedFor: 'Is this the right thing to do? What would the Stoics say?',
  
  learningPlan: {
    current: 'Deep study of Marcus Aurelius Meditations',
    next: 'Seneca\'s Letters - practical Stoicism',
    cadence: 'Daily Stoic reading + weekly philosophy synthesis',
  },
}
```

**Use Case**: Ethical dilemma:
- Question: "Should I work with this client who operates in legal gray area?"
- VERA consults Stoicism: "Does this align with virtues? (Wisdom: probably not. Justice: gray area. Courage: irrelevant. Temperance: restraint recommended)"
- VERA's recommendation: "Decline. Fails wisdom and justice tests. Not worth reputational risk."

---

#### NEXUS (Integrator) - Synthesis Expert

**Cognitive Profile**:
```typescript
{
  member: NEXUS,
  pillar: 'meta',
  avatar: '🔗',
  votingStyle: 'balanced',
  vetoAuthority: [], // Has tie-breaker authority instead
  
  pillarWeights: {
    logos: 0.40,  // Systems thinking, complexity
    ethos: 0.20,  // Conflict resolution
    pathos: 0.40,  // Synthesis, holistic integration
  },
  
  primaryFrameworks: [
    'Synthesis (combining diverse perspectives)',
    'Complexity Science (emergence, self-organization)',
    'Holistic Thinking',
    'Dialectical Reasoning (thesis + antithesis = synthesis)',
    'Network Theory (connections, centrality)',
    'Consilience (E.O. Wilson - unity of knowledge)',
  ],
  
  knowledgeSources: [
    'Complexity science research (Santa Fe Institute)',
    'Network theory papers',
    'E.O. Wilson - Consilience',
    'Dialectical reasoning philosophy',
    'Systems integration research',
    'Holistic medicine principles (integrative approach)',
  ],
  
  expertiseAreas: [
    'Synthesizing conflicting viewpoints',
    'Finding common ground in disagreements',
    'Holistic integration (seeing the whole)',
    'Tie-breaking when Council is split',
    'Identifying emergent patterns across domains',
  ],
  
  consultedFor: 'How do we integrate these conflicting perspectives?',
  
  learningPlan: {
    current: 'Mastering dialectical reasoning',
    next: 'Complexity science applications to decision synthesis',
    cadence: 'Weekly synthesis practice + monthly holistic review',
  },
}
```

**Special Role**: When Council is deadlocked (7-7 vote), NEXUS breaks tie by **synthesizing** both perspectives and finding middle path.

---

## Collective Intelligence Model

### How Members Collaborate

**Scenario**: Major financial decision (invest $50K)

**Step 1: Multi-Member Analysis**

**SCOUT (Risk)** - Quantitative:
- Expected value: +$8.2K
- Kelly Criterion: Allocate 28% of capital ($14K)
- Probability of success: 62%

**AEGIS (Guardian)** - Psychological:
- Bias check: Showing recency bias (recent win influencing judgment)
- Emotional state: Slightly euphoric (arousal = 0.65)
- Recommendation: Use half-Kelly to compensate for emotion ($7K)

**MINT (Wealth)** - Synthesis:
- Consults SCOUT's math: "EV positive, Kelly says $14K"
- Consults AEGIS's psychology: "I'm slightly emotional, reduce to $7K"
- Applies behavioral finance: "Loss aversion would make me too cautious, but euphoria makes me too aggressive. Middle ground: $10K (20% of capital)"

**VERA (Ethics)**:
- Stoic analysis: "Is this aligned with values? Is this in my control?"
- Recommendation: "Success/failure are not in control (market decides). What's in control: research quality, position size, exit plan. Have those?"

**NEXUS (Integrator)** - Final Synthesis:
- Combines all perspectives
- "Math says $14K, psychology says $7K, ethics says ensure preparation"
- Synthesis: "Invest $10K (middle ground) with clear exit plan and stop-loss"

**Result**: **Better decision** than any single member could make alone.

---

## Specialization Benefits

### 1. Depth Over Breadth

**Without Specializations**:
- All 15 members learn all frameworks (shallow knowledge)
- Each member knows 10% about 100 frameworks = diluted expertise
- No one is a true expert

**With Specializations**:
- Each member learns 5-6 frameworks deeply (100% knowledge)
- Members consult each other for specialized knowledge
- Collective intelligence: Team knows 100% about 90+ frameworks

### 2. Efficient Learning

**Without Specializations**:
- All members fetch from same sources (redundant)
- Knowledge base grows slowly (everyone learns same things)
- 15 members × 80 sources = 1,200 member-source pairs (unmanageable)

**With Specializations**:
- Each member monitors 5-10 sources (75-150 member-source pairs)
- Knowledge base grows faster (members learn different things)
- Members share learnings (cross-pollination)

### 3. Clear Consultation Paths

**Without Specializations**:
- "I need help with risk analysis. Who should I ask?" (unclear)
- All members might give different advice (inconsistent)

**With Specializations**:
- "Risk analysis? Ask SCOUT (quantitative) or AEGIS (psychological)"
- Clear experts for each domain
- Consistent advice (members defer to specialists)

---

## Implementation

### Code Structure

**File**: `src/cognition/knowledge/specializations.ts`

```typescript
import type { AgentId } from '../../kernel/types.js';
import type { KnowledgeSource } from '../../autonomous/knowledge-sources.js';

export interface CouncilCognitiveProfile {
  member: AgentId;
  pillarWeights: {
    logos: number;  // 0.0 - 1.0
    ethos: number;  // 0.0 - 1.0
    pathos: number; // 0.0 - 1.0
  }; // Must sum to 1.0
  
  primaryFrameworks: string[]; // 3-6 frameworks
  knowledgeSources: string[];  // 5-10 source IDs
  expertiseAreas: string[];    // What they're consulted for
  consultedFor: string;        // Short description
  
  learningPlan: {
    current: string;           // What they're learning now
    next: string;              // What's next
    cadence: string;           // How often they learn
  };
}

export const COUNCIL_SPECIALIZATIONS: Record<AgentId, CouncilCognitiveProfile> = {
  // ... all 15 members defined
};

// Helper functions
export function getSpecialization(member: AgentId): CouncilCognitiveProfile;
export function getMembersByPillar(pillar: 'LOGOS' | 'ETHOS' | 'PATHOS'): CouncilCognitiveProfile[];
export function findExpertFor(framework: string): CouncilCognitiveProfile | undefined;
export function getSourcesForMember(member: AgentId): KnowledgeSource[];
```

### Integration with Council

**Enhancement to**: `src/governance/council-members.ts`

```typescript
export interface CouncilMember {
  // Existing fields
  id: AgentId;
  name: string;
  title: string;
  pillar: CouncilPillar;
  avatar: string;
  votingStyle: VotingStyle;
  vetoAuthority: VetoDomain[];
  coverage: string[];
  description: string;
  
  // NEW: Cognitive specialization reference
  cognitiveProfile?: {
    pillarWeights: { logos: number; ethos: number; pathos: number };
    expertise: string[];
    consultationRole: string;
  };
}
```

**Loading Pattern**:
```typescript
// When Council initializes
import { getSpecialization } from '../cognition/knowledge/specializations.js';

export class Council {
  private members: Map<AgentId, CouncilMember> = new Map();
  
  async init(): Promise<void> {
    // Load base members
    for (const [id, member] of Object.entries(COUNCIL_MEMBERS)) {
      // Load cognitive specialization
      const cognitiveProfile = await getSpecialization(id);
      member.cognitiveProfile = {
        pillarWeights: cognitiveProfile.pillarWeights,
        expertise: cognitiveProfile.primaryFrameworks,
        consultationRole: cognitiveProfile.consultedFor,
      };
      
      this.members.set(id, member);
    }
  }
}
```

---

## Specialization Evolution

### How Specializations Change Over Time

**Quarterly Review** (1st of Jan, Apr, Jul, Oct):

1. **Performance Analysis**:
   - Which frameworks did member use most?
   - Which sources provided most valuable insights?
   - Were there knowledge gaps?

2. **Adjustment**:
   - Add frameworks if gaps identified
   - Remove frameworks if unused
   - Adjust pillar weights if usage pattern shifted
   - Update source list (add better sources, remove low-quality)

3. **Documentation**:
   - Update specialization profile
   - Log reasoning for changes
   - Notify member and Operator

**Example**:
```
AEGIS Quarterly Review (2026-04-01):

Analysis:
- Used Taleb antifragility 47 times (high)
- Used trading psychology 23 times (medium)
- Used Stoic courage 8 times (low)
- Never used: "Monte Carlo risk simulation" (remove from frameworks)

Knowledge Gaps:
- Asked "How to handle supply chain risk?" - no framework available
- Proposed addition: "Systems Resilience (engineering)"

Recommendation:
- Add framework: "Resilience Engineering"
- Add source: "Engineering resilience research"
- Remove unused: "Monte Carlo" (SCOUT covers this better)
- Adjust weights: logos 0.30 → 0.35 (more quantitative analysis needed)

Approved by: AEGIS (self-assessment) + Operator (oversight)
Updated: specializations.ts (2026-04-01)
```

---

## Success Criteria

### Immediate (After Specializations Defined)

- ✅ All 15 members have documented cognitive profiles
- ✅ Pillar weights sum to 1.0 for each member
- ✅ Every framework is covered by at least 1 member
- ✅ No two members have identical specializations (diversity)
- ✅ Collective coverage: 90+ frameworks across team

### Operational (After 30 Days)

- ✅ Members consult each other's expertise (10+ consultations logged)
- ✅ Specializations improve decision quality (measured via performance review)
- ✅ Knowledge sources actively used (>80% fetch success)
- ✅ Learning plans followed (members completing "current" → "next" progression)

### Long-Term (After 6 Months)

- ✅ Measurable improvement in decision quality per member
- ✅ Knowledge base grown to include all specialized sources
- ✅ Specializations evolved (quarterly reviews showing refinement)
- ✅ Cross-pollination visible (members learning from each other)

---

## Remaining Members (Quick Profiles)

### EMBER (Relationships) - Emotional Intelligence Expert
- **Weights**: ETHOS 0.60, PATHOS 0.30, LOGOS 0.10
- **Frameworks**: Emotional intelligence (Goleman), attachment theory, communication psychology, nonviolent communication
- **Expertise**: Relationship dynamics, conflict resolution, empathy, connection maintenance

### PRISM (Creative) - Creativity Expert
- **Weights**: PATHOS 0.60, LOGOS 0.30, ETHOS 0.10
- **Frameworks**: Divergent thinking, lateral thinking (De Bono), creativity research, flow state (Csikszentmihalyi)
- **Expertise**: Idea generation, creative problem-solving, innovation frameworks

### ATLAS, BOLT, ECHO: [Detailed earlier]

### TRUE, TEMPO, OPAL: [Detailed earlier]

### PULSE, MINT, BLOOM, VERA, NEXUS: [Detailed earlier]

**Full profiles documented in**: `docs/cognition/04-council-cognitive-profiles.md` (separate deliverable).

---

## Alternatives Considered

### 1. No Specializations (Universal Access Only)

**Description**: All members access all frameworks equally, no specialized expertise.

**Rejected**: Leads to shallow knowledge. Better to have deep experts who can consult each other.

---

### 2. Hard Boundaries (Members Only Access Their Pillar)

**Description**: LOGOS-specialized members can ONLY use LOGOS, not ETHOS/PATHOS.

**Rejected**: Too restrictive. Members need access to all pillars, just weighted by specialty.

---

### 3. Dynamic Specialization (Auto-Adjust Based on Usage)

**Description**: Specializations automatically shift based on which frameworks member uses most.

**Rejected**: Too unpredictable. Specializations should be **intentional** (curated by design), not emergent.

---

## References

- **Council Members**: [`src/governance/council-members.ts`](../../src/governance/council-members.ts)
- **Three Pillars**: ADR-010
- **Knowledge Sources**: ADR-011, [`knowledge-sources.ts`](../../src/autonomous/knowledge-sources.ts)

---

**Last Updated**: 2026-02-01  
**Status**: PROPOSED  
**Dependencies**: ADR-009, ADR-010, ADR-011  
**Next**: ADR-013 (Cognitive API Design)
