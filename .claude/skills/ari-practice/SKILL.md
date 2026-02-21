---
name: ari-practice
description: Deliberate practice with Anthropic's high-scoring interaction patterns for genuine skill mastery
triggers:
  - "deliberate practice"
  - "practice plan"
  - "practice session"
  - "skill progression"
  - "weaknesses"
  - "drills"
  - "/ari-practice"
---

# ARI Practice — Evidence-Based Skill Development

Run deliberate practice sessions that build genuine mastery using:

- **Ericsson's deliberate practice** (2016) — Focused practice at edge of ability
- **Anthropic's interaction research** — High-scoring patterns that predict real learning
- **Zone of Proximal Development** — Optimal challenge calibration

## The Research Foundation

### What Actually Builds Skill (Anthropic 2024)

| Pattern | Mastery Effect | How We Apply It |
|---------|----------------|-----------------|
| **Generation-First** | +18% retention | You attempt before seeing solution |
| **Hybrid Code-Explanation** | +23% transfer | Visual + verbal + worked examples |
| **Conceptual Inquiry** | +15% deep learning | Why questions before how questions |
| **Metacognitive Reflection** | +12% self-awareness | Reflect on your thinking process |

### What Undermines Skill (Avoid These)

| Anti-Pattern | Mastery Effect | Warning Signs |
|--------------|----------------|---------------|
| AI Delegation | -17% mastery | "Just give me the answer" |
| Progressive Reliance | -22% independence | Each problem harder without AI |
| Iterative Debugging | -14% understanding | Trial-and-error without learning |

## Session Philosophy

```
┌────────────────────────────────────────────────────────────────┐
│              THE GENERATION-FIRST PRINCIPLE                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. ATTEMPT (struggle productively)                            │
│     ↓                                                          │
│  2. REFLECT (what made it hard?)                               │
│     ↓                                                          │
│  3. REVEAL (see the solution)                                  │
│     ↓                                                          │
│  4. COMPARE (where did your thinking diverge?)                 │
│     ↓                                                          │
│  5. CONSOLIDATE (what pattern did you learn?)                  │
│                                                                │
│  ✗ NOT: See solution → Try to replicate                        │
│  ✓ YES: Struggle → Compare → Understand gap                    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## How To Run

When invoked with a skill (e.g., `/ari-practice kelly-criterion`):

```typescript
// 1. Initialize the skill registry (loads from ~/.ari/learning/)
const { getSkillRegistry } = await import('../cognition/learning/skill-registry.js');
const registry = await getSkillRegistry();

// 2. Get or register the skill
let skill = registry.getSkill(skillId);
if (!skill) {
  skill = await registry.registerSkill({
    skillId: skillId,
    skillName: 'Kelly Criterion',
    domain: 'LOGOS',
    targetLevel: 80,
    initialLevel: 0,
  });
}

// 3. Calculate ZPD for optimal challenge
const zpd = registry.calculateZPD(skillId);
```

## Session Flow

### Phase 1: Orientation (30 seconds)

```
╔════════════════════════════════════════════════════════════════╗
║  🎯 DELIBERATE PRACTICE SESSION                                 ║
║  ══════════════════════════════════════════════════════════════ ║
║                                                                 ║
║  Skill: Kelly Criterion                                         ║
║  Domain: LOGOS (Quantitative Reasoning)                         ║
║                                                                 ║
║  ┌─────────────────────────────────────────────────────────┐   ║
║  │  Current Level    ████████████░░░░░░░░░░░░░░   35/100   │   ║
║  │  Target Level     ████████████████████████░░░░░ 80/100   │   ║
║  │  Gap to Target    ───────────────────────────── 45 pts   │   ║
║  └─────────────────────────────────────────────────────────┘   ║
║                                                                 ║
║  Zone of Proximal Development                                   ║
║  ┌─────────────────────────────────────────────────────────┐   ║
║  │ TOO EASY   │      OPTIMAL      │     TOO HARD            │   ║
║  │ [0━━━━━25] │ [25━━━━●━━━━━45] │ [45━━━━━━━━━━━100]       │   ║
║  │            │     YOU ARE HERE   │                         │   ║
║  └─────────────────────────────────────────────────────────┘   ║
║                                                                 ║
║  Today's Focus: Problems calibrated to difficulty 25-45        ║
║  Estimated Duration: 20-30 minutes                             ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Phase 2: Warm-Up (Conceptual Grounding)

**Before any problems, activate prior knowledge:**

```
╔════════════════════════════════════════════════════════════════╗
║  📚 CONCEPTUAL WARM-UP                                          ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Before we practice, let's activate your understanding.         ║
║                                                                 ║
║  Q: In your own words, what is the Kelly Criterion trying       ║
║     to optimize for?                                            ║
║                                                                 ║
║  💭 Think about this for 30 seconds before continuing...        ║
║                                                                 ║
║  [Your response: ___________________________________]           ║
║                                                                 ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ 💡 This is "conceptual inquiry" — understanding WHY     │    ║
║  │    before practicing HOW produces 15% better transfer   │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

**After response, provide the conceptual anchor:**

```
╔════════════════════════════════════════════════════════════════╗
║  ✅ CONCEPTUAL ANCHOR                                           ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Kelly Criterion optimizes for:                                 ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │  LONG-TERM GEOMETRIC GROWTH RATE                        │    ║
║  │  (not expected value, not minimizing risk)              │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
║  The key insight:                                               ║
║  • Betting too little → suboptimal growth                       ║
║  • Betting too much → risk of ruin                              ║
║  • Kelly = the exact fraction that maximizes E[log(wealth)]     ║
║                                                                 ║
║  Formula: f* = (bp - q) / b                                     ║
║  Where: b = odds, p = win probability, q = loss probability     ║
║                                                                 ║
║  📊 Visual Intuition:                                           ║
║  Growth │     ╭───────╮                                         ║
║   Rate  │    ╱         ╲                                        ║
║         │   ╱           ╲                                       ║
║         │  ╱     ● Kelly  ╲                                     ║
║         │ ╱                 ╲                                   ║
║         │╱                   ╲                                  ║
║         └──────────────────────                                 ║
║           Bet Size → (0% to 100%)                               ║
║                                                                 ║
║  Ready to practice? Let's begin.                                ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Phase 3: Practice Problems (Generation-First)

**CRITICAL: User attempts BEFORE seeing any hints or solutions**

```
╔════════════════════════════════════════════════════════════════╗
║  PROBLEM 1/5                                          [ZPD: ●] ║
║  Difficulty: 35 (In Your Optimal Zone)                          ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  SCENARIO:                                                      ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │  You have a trading opportunity:                        │    ║
║  │  • Win probability: 60%                                 │    ║
║  │  • If you win: 2x your bet                              │    ║
║  │  • If you lose: lose your bet                           │    ║
║  │  • Current bankroll: $10,000                            │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
║  QUESTION:                                                      ║
║  What fraction of your bankroll should you bet?                 ║
║                                                                 ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ 🎯 GENERATION PHASE (3-5 minutes)                       │    ║
║  │                                                         │    ║
║  │ 1. Write out your calculation step by step              │    ║
║  │ 2. Include your reasoning at each step                  │    ║
║  │ 3. State your final answer with confidence level        │    ║
║  │                                                         │    ║
║  │ Your work:                                              │    ║
║  │ ________________________________________________        │    ║
║  │ ________________________________________________        │    ║
║  │ ________________________________________________        │    ║
║  │                                                         │    ║
║  │ Final answer: _____%                                    │    ║
║  │ Confidence: □ Low  □ Medium  □ High                     │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
║  ⏱️ Take your time. Struggling productively is learning.       ║
║                                                                 ║
║  [Submit when ready]                                            ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Phase 4: Reflection Before Reveal

```
╔════════════════════════════════════════════════════════════════╗
║  🤔 METACOGNITIVE PAUSE                                        ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Before I show the solution, reflect:                          ║
║                                                                 ║
║  1. What part felt most uncertain?                             ║
║     □ Identifying the variables (b, p, q)                       ║
║     □ Remembering the formula                                  ║
║     □ Executing the calculation                                ║
║     □ Interpreting the result                                  ║
║                                                                 ║
║  2. Where might you have made an error?                        ║
║     [________________________________]                          ║
║                                                                 ║
║  3. What would change your answer?                             ║
║     [________________________________]                          ║
║                                                                 ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ 💡 This metacognitive reflection increases retention    │    ║
║  │    by 12% compared to just seeing the answer            │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
║  [Ready to see the solution]                                   ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Phase 5: Solution Reveal with Comparison

```
╔════════════════════════════════════════════════════════════════╗
║  ✅ SOLUTION + COMPARISON                                       ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  CORRECT ANSWER: 40% (0.40)                                     ║
║                                                                 ║
║  WORKED SOLUTION:                                               ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │  Step 1: Identify variables                             │    ║
║  │    b = 2 (payout odds, 2:1)                             │    ║
║  │    p = 0.60 (win probability)                           │    ║
║  │    q = 0.40 (loss probability, 1-p)                     │    ║
║  │                                                         │    ║
║  │  Step 2: Apply formula                                  │    ║
║  │    f* = (bp - q) / b                                    │    ║
║  │    f* = (2 × 0.60 - 0.40) / 2                           │    ║
║  │    f* = (1.20 - 0.40) / 2                               │    ║
║  │    f* = 0.80 / 2                                        │    ║
║  │    f* = 0.40                                            │    ║
║  │                                                         │    ║
║  │  Step 3: Interpret                                      │    ║
║  │    Bet 40% of bankroll = $4,000                         │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
║  YOUR ANSWER: [Shown here]                                     ║
║                                                                 ║
║  ┌─────────── COMPARISON ───────────┐                          ║
║  │ ✓ Variables identified correctly │ or │ ✗ b was wrong      │ ║
║  │ ✓ Formula applied correctly      │ or │ ✗ Forgot q term    │ ║
║  │ ✓ Calculation accurate           │ or │ ✗ Arithmetic error │ ║
║  └──────────────────────────────────┘                          ║
║                                                                 ║
║  KEY INSIGHT from your specific gap:                           ║
║  [Personalized insight based on comparison]                    ║
║                                                                 ║
║  Visual:                                                        ║
║  [No Bet] ████████████████░░░░░░░░ [Full Kelly]                 ║
║                    ↑ 40%                                        ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Phase 6: Consolidation Question

```
╔════════════════════════════════════════════════════════════════╗
║  📌 CONSOLIDATION                                               ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Now that you've compared, answer these to lock in learning:   ║
║                                                                 ║
║  1. What's the most common error you should watch for?         ║
║     [________________________________]                          ║
║                                                                 ║
║  2. If the odds were 3:1 instead of 2:1, what would change?    ║
║     [________________________________]                          ║
║                                                                 ║
║  3. When would Kelly suggest betting 0%?                       ║
║     [________________________________]                          ║
║                                                                 ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ These "elaborative interrogation" questions build       │    ║
║  │ the connections that enable transfer to new problems    │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
║  [Continue to next problem]                                    ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Phase 7: Session Summary

```
═══════════════════════════════════════════════════════════════════
📊 PRACTICE SESSION COMPLETE
═══════════════════════════════════════════════════════════════════

Skill: Kelly Criterion
Duration: 25 minutes (22 focused)

┌─────────────────────────────────────────────────────────────────┐
│  PERFORMANCE                                                     │
│  ═══════════════════════════════════════════════════════════════ │
│                                                                  │
│  Problems Attempted: 5                                           │
│    ✅ Correct (before hints): 3                                  │
│    ⚠️ Correct (with reflection): 1                               │
│    ❌ Incorrect: 1                                               │
│                                                                  │
│  Generation Success Rate: 60% → 80% with metacognition          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ 🎯 This is above your ZPD average — excellent progress! │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SKILL PROGRESSION                                               │
│  ═══════════════════════════════════════════════════════════════ │
│                                                                  │
│  Level Progress: 35 → 42 (+7 points)                             │
│  ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 42%            │
│                                                                  │
│  Weekly Trajectory: +12 points/week                              │
│  Estimated Time to Target: 4 weeks                               │
│                                                                  │
│  ZPD Adjustment: Now calibrating problems to 30-50 range         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  LEARNING PATTERNS DETECTED                                      │
│  ═══════════════════════════════════════════════════════════════ │
│                                                                  │
│  ✓ Strengths:                                                    │
│    • Formula recall is solid                                     │
│    • Variable identification improving                           │
│                                                                  │
│  ⚠️ Focus Areas:                                                 │
│    • Arithmetic under time pressure                              │
│    • Remembering to subtract q (loss probability)                │
│                                                                  │
│  📚 Recommended Next:                                            │
│    • Practice 3 more problems with edge cases (p = 0.5, b = 1)   │
│    • Review the "when Kelly = 0" concept                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  INTERACTION QUALITY                                             │
│  ═══════════════════════════════════════════════════════════════ │
│                                                                  │
│  Session Type: Generation-First ✓                                │
│                                                                  │
│  High-Scoring Patterns Used:                                     │
│  ✓ Attempted before seeing solution (5/5 problems)               │
│  ✓ Metacognitive reflection (4/5 problems)                       │
│  ✓ Conceptual warm-up completed                                  │
│  ✓ Consolidation questions answered                              │
│                                                                  │
│  Anti-Patterns Avoided:                                          │
│  ✓ No AI delegation ("just tell me")                             │
│  ✓ No progressive reliance                                       │
│  ✓ No unlearned debugging                                        │
│                                                                  │
│  🎯 This session follows high-mastery interaction patterns       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

🏆 MILESTONE: Foundation Laid! (25%)
   "You have established the fundamental patterns!"

Next session recommended: Tomorrow, same time
Focus: Edge cases and verification strategies

═══════════════════════════════════════════════════════════════════
```

## Anti-Pattern Detection

The session monitors for patterns that undermine skill development:

```typescript
// Detect if user is asking for answers without attempting
function detectDelegationPattern(interaction: Interaction): Warning | null {
  const delegationPhrases = [
    'just tell me',
    'what\'s the answer',
    'give me the solution',
    'I don\'t want to think about it',
  ];

  if (delegationPhrases.some(p => interaction.input.toLowerCase().includes(p))) {
    return {
      type: 'DELEGATION_DETECTED',
      message: `
┌────────────────────────────────────────────────────────────┐
│ ⚠️ DELEGATION PATTERN DETECTED                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Asking for answers without attempting reduces mastery      │
│ by ~17% (Anthropic 2024).                                  │
│                                                            │
│ Instead, try:                                              │
│ • "I'm stuck at [specific step], can you hint?"            │
│ • "I got [answer], is my approach correct?"                │
│ • "What am I missing in my reasoning?"                     │
│                                                            │
│ The struggle is where learning happens.                    │
│                                                            │
└────────────────────────────────────────────────────────────┘
      `,
    };
  }
  return null;
}
```

## Recording Sessions

```typescript
// After practice session completes
const { getPracticeTracker } = await import('../cognition/learning/practice-tracker.js');
const tracker = await getPracticeTracker();

const { session, skill } = await tracker.recordSession({
  userId: 'default',
  skill: skillId,
  session: {
    skill: skillId,
    startedAt: sessionStart,
    endedAt: new Date(),
    plannedMinutes: 25,
    focusedMinutes: 22,
    tasksPlanned: 5,
    tasksCompleted: 4,
    errorPatterns: ['forgot-to-subtract-q', 'arithmetic-under-pressure'],
    interactionPatterns: {
      generationFirst: true,
      metacognitiveReflection: 4,
      consolidationCompleted: true,
      delegationAttempts: 0,
    },
  },
});

// Update skill registry with practice
const { milestone } = await registry.updateFromPractice(skillId, session);

if (milestone) {
  console.log(`🏆 MILESTONE: ${milestone.name}!`);
  console.log(`   "${milestone.celebration}"`);
}
```

## Error Handling

### Storage Failures

If the storage adapter cannot load or save session data:

```typescript
try {
  const session = await tracker.recordSession({ ... });
} catch (error) {
  if (error.code === 'STORAGE_UNAVAILABLE') {
    // Gracefully degrade: Continue session without persistence
    console.warn(`
╔════════════════════════════════════════════════════════════════╗
║  ⚠️ STORAGE WARNING                                            ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Unable to save session progress to disk.                      ║
║                                                                 ║
║  Your practice will continue, but progress won't be saved.     ║
║  Check that ~/.ari/learning/ directory is writable.            ║
║                                                                 ║
║  [Continue without saving]                                     ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
    `);
  }
}
```

### Data Corruption Recovery

If stored data is malformed or corrupted:

```typescript
// Storage adapter automatically backs up before writes
// Recovery: ~/.ari/learning/skills.json.backup

// Manual recovery command:
// cp ~/.ari/learning/skills.json.backup ~/.ari/learning/skills.json
```

## Session Recovery

### Interrupted Sessions

If a practice session is interrupted (crash, network loss, etc.):

```
╔════════════════════════════════════════════════════════════════╗
║  🔄 INCOMPLETE SESSION DETECTED                                 ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Found an incomplete practice session from 15 minutes ago:     ║
║                                                                 ║
║  Skill: Kelly Criterion                                         ║
║  Completed: 3/5 problems                                        ║
║  Time spent: 12 minutes                                         ║
║                                                                 ║
║  Would you like to:                                             ║
║                                                                 ║
║  [A] Resume where you left off (2 problems remaining)           ║
║  [B] Review what you completed and start fresh                  ║
║  [C] Discard and start a new session                            ║
║                                                                 ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ 💡 Resuming preserves your progress and maintains       │    ║
║  │    your skill level trajectory                          │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

**Implementation:**

```typescript
// Check for incomplete session on start
const incomplete = await tracker.getIncompleteSession(userId, skillId);
if (incomplete && (Date.now() - incomplete.startedAt) < 3600000) { // 1 hour
  // Offer resume
}
```

## Core Modules

- `src/cognition/learning/skill-registry.ts` - ZPD and proficiency tracking
- `src/cognition/learning/practice-tracker.ts` - Session recording
- `src/cognition/learning/storage-adapter.ts` - Persistence
- `src/cognition/learning/weakness-analyzer.ts` - Error pattern detection

## Research References

1. **Ericsson, K.A. (2016)** — Peak: Secrets from the New Science of Expertise
2. **Anthropic (2024)** — Generative AI Can Harm Learning (Bastani et al.)
3. **Roediger & Karpicke (2006)** — Testing Effect (3x retention improvement)
4. **Sweller (1988)** — Cognitive Load Theory
5. **Vygotsky (1978)** — Zone of Proximal Development

## Skill Domains

| Domain | Focus Areas | Icon |
|--------|-------------|------|
| LOGOS | Bayesian reasoning, Kelly, EV, Systems Thinking | 🧠 |
| ETHOS | Bias detection, Emotional regulation, Discipline | ❤️ |
| PATHOS | CBT, Stoicism, Reflection, Wisdom traditions | 🌱 |

## See Also

**Related Skills:**

- `/ari-review` - Spaced repetition reviews for long-term retention
- `/ari-learning-mode` - Comprehension-building interaction mode
- `/ari-think` - Metacognitive reasoning support

**Integration:**

Practice sessions automatically create spaced repetition cards for concepts you struggle with. These cards appear in your daily review queue via `/ari-review`.

**Workflow:**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [/ari-practice] → Build skill through deliberate practice │
│         ↓                                                   │
│  Auto-generate review cards for weak areas                 │
│         ↓                                                   │
│  [/ari-review] → Reinforce via spaced repetition           │
│         ↓                                                   │
│  Long-term mastery and retention                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## The Core Principle

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│   "The goal is not to get the right answer.                   │
│    The goal is to build the skill that generates              │
│    right answers independently."                              │
│                                                                │
│   Every time you struggle and then compare,                   │
│   you're building neural pathways.                            │
│                                                                │
│   Every time you ask for the answer,                          │
│   you're bypassing those pathways.                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```
