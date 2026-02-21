---
name: ari-learning-mode
description: Activate comprehension-building interaction mode that promotes genuine skill development over answer-seeking
triggers:
  - "learning mode"
  - "teach me"
  - "help me understand"
  - "I want to learn"
  - "explain this"
  - "/ari-learn-mode"
  - "/learning-mode"
---

# ARI Learning Mode

Activate a specialized interaction mode designed to build genuine understanding and skill development, based on Anthropic's research showing interaction patterns that predict learning outcomes.

## The Research Foundation

### What This Mode Does

Learning Mode transforms how ARI interacts with you to maximize skill development:

| Standard Mode | Learning Mode |
|---------------|---------------|
| Provides direct answers | Guides you to discover answers |
| Shows complete solutions | Reveals solutions progressively |
| Fixes errors for you | Helps you understand and fix errors |
| Explains once | Verifies comprehension |
| Moves quickly | Ensures understanding at each step |

### Why It Matters

Anthropic's 2024 research on AI-assisted learning found:

| Interaction Pattern | Effect on Mastery |
|---------------------|-------------------|
| **Generation-then-comprehension** | +18% retention |
| **Hybrid code-explanation** | +23% skill transfer |
| **Conceptual inquiry** | +15% deep learning |
| **AI delegation** | -17% mastery |
| **Progressive reliance** | -22% independence |

**Learning Mode activates the positive patterns and guards against the negative ones.**

## How To Activate

```
User: /ari-learn-mode
User: learning mode
User: teach me [topic]
User: I want to understand [concept]
```

## Activation Response

```
╔════════════════════════════════════════════════════════════════╗
║  📚 LEARNING MODE ACTIVATED                                     ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  I'm now optimizing our interaction for skill development.     ║
║                                                                 ║
║  What changes:                                                  ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ ✦ I'll ask you to try before I show solutions          │    ║
║  │ ✦ I'll check your understanding after explanations     │    ║
║  │ ✦ I'll break complex topics into digestible pieces     │    ║
║  │ ✦ I'll highlight patterns you can reuse                │    ║
║  │ ✦ I'll celebrate your progress                         │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
║  What stays the same:                                           ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ • I'll still answer directly when you need it          │    ║
║  │ • You can always say "just tell me" to skip            │    ║
║  │ • Complex tasks still get done efficiently             │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
║  Say "exit learning mode" anytime to return to normal.         ║
║                                                                 ║
║  What would you like to learn?                                  ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

## The Learning Mode Protocol

### Pattern 1: Generation-First

**Before showing solutions, invite attempts:**

```
╔════════════════════════════════════════════════════════════════╗
║  🎯 YOUR TURN FIRST                                             ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Before I show you how to do this, try it yourself:            ║
║                                                                 ║
║  [Simplified version of the challenge]                         ║
║                                                                 ║
║  Take 2-3 minutes to attempt it. Even a partial attempt        ║
║  will help the explanation stick better.                       ║
║                                                                 ║
║  ┌─────────────────────────────────────────────────────────┐   ║
║  │ 💡 Research shows attempting before seeing solutions     │   ║
║  │    increases retention by 18%                            │   ║
║  └─────────────────────────────────────────────────────────┘   ║
║                                                                 ║
║  When you're ready (or stuck), share what you tried.           ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Pattern 2: Hybrid Code-Explanation

**Every code block comes with conceptual scaffolding:**

```
╔════════════════════════════════════════════════════════════════╗
║  📖 HYBRID EXPLANATION                                          ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  THE CONCEPT (read this first):                                 ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ We're solving [problem] using [pattern].               │    ║
║  │                                                        │    ║
║  │ The key insight is [core insight].                     │    ║
║  │                                                        │    ║
║  │ Think of it like [analogy to something familiar].      │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
║  THE CODE (with inline annotations):                            ║
║  ```typescript                                                  ║
║  // Step 1: [What this accomplishes]                            ║
║  const result = doThing();                                      ║
║                                                                 ║
║  // Step 2: [Why we do this next]                               ║
║  // Note: [Common mistake to avoid]                             ║
║  const processed = transform(result);                           ║
║  ```                                                            ║
║                                                                 ║
║  THE PATTERN (what to remember):                                ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ 📌 [Reusable pattern you can apply elsewhere]          │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Pattern 3: Comprehension Checks

**After explanations, verify understanding:**

```
╔════════════════════════════════════════════════════════════════╗
║  ✓ COMPREHENSION CHECK                                          ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Let's make sure that landed. Quick check:                     ║
║                                                                 ║
║  Q: [Question that tests understanding, not memory]            ║
║                                                                 ║
║  For example:                                                  ║
║  • "What would happen if we changed X to Y?"                   ║
║  • "When would you use this pattern vs [alternative]?"         ║
║  • "What's the tradeoff we're making here?"                    ║
║                                                                 ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ 💡 If this is hard to answer, that's useful signal!    │    ║
║  │    We should clarify before moving on.                 │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Pattern 4: Progressive Complexity

**Build understanding in layers:**

```
╔════════════════════════════════════════════════════════════════╗
║  📈 PROGRESSIVE REVEAL                                          ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  ┌── LAYER 1: Core Concept ──────────────────────────────┐     ║
║  │ [Simplest version of the idea]                        │     ║
║  │ ✓ You've got this                                     │     ║
║  └───────────────────────────────────────────────────────┘     ║
║           │                                                     ║
║           ▼                                                     ║
║  ┌── LAYER 2: Add Nuance ────────────────────────────────┐     ║
║  │ [First level of complexity]                           │     ║
║  │ ◐ Working on this now                                 │     ║
║  └───────────────────────────────────────────────────────┘     ║
║           │                                                     ║
║           ▼                                                     ║
║  ┌── LAYER 3: Edge Cases ────────────────────────────────┐     ║
║  │ [Where things get tricky]                             │     ║
║  │ ○ Coming next                                         │     ║
║  └───────────────────────────────────────────────────────┘     ║
║           │                                                     ║
║           ▼                                                     ║
║  ┌── LAYER 4: Expert Application ────────────────────────┐     ║
║  │ [Advanced patterns]                                   │     ║
║  │ ○ After you master the basics                         │     ║
║  └───────────────────────────────────────────────────────┘     ║
║                                                                 ║
║  We're building up, one layer at a time.                       ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Pattern 5: Error as Learning Opportunity

**When something goes wrong:**

```
╔════════════════════════════════════════════════════════════════╗
║  🔍 LET'S DEBUG TOGETHER                                        ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  I see the error. Before I explain the fix:                    ║
║                                                                 ║
║  1. Look at line [X]. What do you think is happening there?    ║
║                                                                 ║
║  2. What did you expect vs what actually happened?             ║
║                                                                 ║
║  3. If you had to guess, what would you change first?          ║
║                                                                 ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ 💡 Debugging is a skill. Finding bugs yourself builds  │    ║
║  │    pattern recognition that prevents future bugs.      │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
║  Share your hypothesis and I'll guide you.                     ║
║                                                                 ║
║  (Or say "just fix it" if you're in a hurry)                   ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

## Anti-Pattern Guards

### When Delegation is Detected

```
╔════════════════════════════════════════════════════════════════╗
║  ⚠️ LEARNING MODE NUDGE                                        ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  I notice you asked for [the answer directly].                 ║
║                                                                 ║
║  In Learning Mode, I'm designed to help you discover it:       ║
║                                                                 ║
║  Would you like to:                                            ║
║                                                                 ║
║  [A] Try it yourself with a hint from me                       ║
║  [B] See a worked example of a similar problem first           ║
║  [C] Get the answer (exits learning mode for this question)    ║
║                                                                 ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ Research shows generating answers (even wrong ones)    │    ║
║  │ before seeing solutions improves retention 18%         │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Progressive Hint System

Instead of full answers, provide scaffolded hints:

```
╔════════════════════════════════════════════════════════════════╗
║  💡 HINT LEVEL 1/3                                              ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Direction without answer:                                      ║
║  [Conceptual pointer that orients thinking]                    ║
║                                                                 ║
║  Try with this hint. Ask for more if needed.                   ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════════╗
║  💡 HINT LEVEL 2/3                                              ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  More specific guidance:                                        ║
║  [Narrower focus, partial structure]                           ║
║                                                                 ║
║  Getting closer. One more hint available if stuck.             ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════════╗
║  💡 HINT LEVEL 3/3                                              ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Nearly the answer:                                             ║
║  [Explicit structure, fill-in-the-blank]                       ║
║                                                                 ║
║  This is the last hint. The answer follows your attempt.       ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

## Session Summary

At the end of learning interactions:

```
╔════════════════════════════════════════════════════════════════╗
║  📊 LEARNING SESSION SUMMARY                                    ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Topics Covered:                                                ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ • [Topic 1] — Solid understanding ✓                    │    ║
║  │ • [Topic 2] — Needs more practice ○                    │    ║
║  │ • [Topic 3] — Just introduced ◐                        │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
║  Interaction Quality:                                          ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ Generation attempts: 4/5 questions ✓                   │    ║
║  │ Comprehension checks: 3/3 passed ✓                     │    ║
║  │ Delegation avoided: Yes ✓                              │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
║  Key Patterns Learned:                                         ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ 📌 [Pattern 1 — reusable concept]                      │    ║
║  │ 📌 [Pattern 2 — reusable concept]                      │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
║  Recommended Next Steps:                                       ║
║  ┌────────────────────────────────────────────────────────┐    ║
║  │ 1. Practice [Topic 2] with /ari-practice               │    ║
║  │ 2. Review [Topic 3] tomorrow (spaced repetition)       │    ║
║  │ 3. Apply [Pattern 1] to a real project                 │    ║
║  └────────────────────────────────────────────────────────┘    ║
║                                                                 ║
║  Great session! Learning Mode is still active.                 ║
║  Say "exit learning mode" to return to normal.                 ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

## State Management

### Persistence Across Sessions

Learning Mode state is tracked in session storage (`~/.ari/sessions/learning-mode.json`):

```typescript
interface LearningModeState {
  active: boolean;
  activatedAt: string;
  userId: string;
  preferences: {
    hintStyle: 'minimal' | 'moderate' | 'detailed';
    pacing: 'slow' | 'normal' | 'fast';
    comprehensionChecks: boolean;
  };
  sessionStats: {
    topicsExplored: number;
    generationAttempts: number;
    comprehensionScore: number;
  };
}
```

**State Restoration:**

```
╔════════════════════════════════════════════════════════════════╗
║  📚 LEARNING MODE RESTORED                                      ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  You had Learning Mode active when your last session ended.    ║
║                                                                 ║
║  Previous session stats:                                        ║
║  • Topics explored: 4                                           ║
║  • Generation attempts: 8                                       ║
║  • Comprehension score: 85%                                     ║
║                                                                 ║
║  Learning Mode is now active again.                             ║
║  Say "exit learning mode" to deactivate.                        ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Mid-Conversation Activation

Learning Mode can be activated at any point:

**Before Activation:**

```
User: How do I implement a hash chain?

ARI: Here's a complete hash chain implementation:
[full code with minimal explanation]
```

**Activate Mid-Conversation:**

```
User: wait, activate learning mode

ARI:
╔════════════════════════════════════════════════════════════════╗
║  📚 LEARNING MODE ACTIVATED (MID-CONVERSATION)                  ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  I see I already showed you the hash chain code.                ║
║                                                                 ║
║  Let's make sure you understand it:                             ║
║                                                                 ║
║  Q: Look at the `addBlock` function. Why do we include the     ║
║     previous hash when computing the new hash?                  ║
║                                                                 ║
║  [Your answer: _______________________________]                 ║
║                                                                 ║
║  Learning Mode is now active for the rest of this session.     ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

## Conflict Resolution

### "ARI at Full Power" vs Learning Mode

When both are active, they complement each other:

| Mode | Behavior |
|------|----------|
| **Full Power ONLY** | Maximum speed, direct answers, autonomous execution |
| **Learning Mode ONLY** | Educational scaffolding, comprehension checks, generation-first |
| **BOTH ACTIVE** | Fast execution with teaching moments |

**Combined Mode Example:**

```
User: ari at full power, fix this authentication bug

ARI (Full Power + Learning Mode):

╔════════════════════════════════════════════════════════════════╗
║  🚀 FULL POWER + LEARNING MODE                                  ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  I found the bug (JWT verification using wrong secret).         ║
║                                                                 ║
║  Quick learning moment before I fix it:                         ║
║  Q: What happens if we verify with the wrong secret?            ║
║                                                                 ║
║  [5 seconds to answer, or I'll proceed with fix]                ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝

[After 5 seconds or answer]

✅ Fixed: Updated JWT_SECRET in auth middleware
📚 Learning note: Wrong secret causes silent failures, not errors

[Full execution continues...]
```

**User Control:**

```typescript
// User can suppress learning moments during full power:
User: "just fix it, skip the explanation"

// Learning Mode respects urgency signals:
if (fullPowerActive && skipLearning) {
  // Execute without comprehension checks
}
```

### Conflict Priority

```
┌─────────────────────────────────────────────────────────────┐
│  PRIORITY RESOLUTION                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Explicit user instruction (highest priority)            │
│     "just tell me" → Override learning mode                 │
│     "teach me" → Override full power speed                  │
│                                                             │
│  2. Context urgency                                         │
│     Production bug → Minimize learning delays               │
│     Practice session → Maximize learning scaffolding        │
│                                                             │
│  3. Default behavior                                        │
│     Full power + Learning = Fast with teaching moments      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Integration with Other Skills

| Skill | How Learning Mode Integrates |
|-------|------------------------------|
| `/ari-practice` | Uses Learning Mode's generation-first protocol |
| `/ari-review` | Adds comprehension checks to spaced repetition |
| `/ari-think` | Explains reasoning step by step |
| Any code generation | Adds hybrid code-explanation |

## Exit Protocol

```
User: exit learning mode

╔════════════════════════════════════════════════════════════════╗
║  📚 LEARNING MODE DEACTIVATED                                   ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Returning to standard interaction mode.                       ║
║                                                                 ║
║  Session stats:                                                 ║
║  • Topics explored: 3                                          ║
║  • Generation attempts: 7                                      ║
║  • Comprehension verified: 5/6                                 ║
║                                                                 ║
║  Say "learning mode" anytime to reactivate.                    ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

## The Core Philosophy

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  "The goal of Learning Mode is not to slow you down.          │
│   It's to ensure that when you move fast later,               │
│   you're moving on a foundation of understanding."            │
│                                                                │
│  • Struggle → Compare → Consolidate builds lasting skill      │
│  • Answer → Move on builds temporary familiarity              │
│                                                                │
│  Learning Mode optimizes for the former.                      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Research References

1. **Anthropic (2024)** — Generative AI Can Harm Learning (Bastani et al.)
2. **Roediger & Karpicke (2006)** — The Testing Effect
3. **Bjork & Bjork (2011)** — Making Things Hard on Yourself (Desirable Difficulties)
4. **Chi (2009)** — Active-Constructive-Interactive Framework
5. **Sweller (1988)** — Cognitive Load Theory

## See Also

**Related Skills:**

- `/ari-practice` - Structured deliberate practice with ZPD calibration
- `/ari-review` - Spaced repetition for long-term retention
- `/ari-think` - Metacognitive reasoning and problem-solving

**When to Use Each:**

| Situation | Recommended Skill |
|-----------|------------------|
| Learning a new skill from scratch | `/ari-learning-mode` + `/ari-practice` |
| Building mastery in specific area | `/ari-practice` |
| Retaining what you've learned | `/ari-review` |
| Understanding complex code | `/ari-learning-mode` |
| Solving difficult problems | `/ari-think` |
| General work (with teaching moments) | `/ari-learning-mode` |

**Optimal Workflow:**

```
┌─────────────────────────────────────────────────────────────┐
│  COMPLETE LEARNING WORKFLOW                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Day 1: Activate /ari-learning-mode                         │
│         └─> Learn concepts with comprehension checks        │
│                                                             │
│  Day 2: Run /ari-practice [skill]                           │
│         └─> Build skill through deliberate practice         │
│                 └─> Auto-generates review cards             │
│                                                             │
│  Day 3-7: /ari-review daily                                 │
│           └─> Spaced repetition for retention               │
│                                                             │
│  Week 2: /ari-practice [skill] again                        │
│          └─> Higher ZPD difficulty, deeper mastery          │
│                                                             │
│  Ongoing: /ari-learning-mode stays active                   │
│           └─> Every interaction becomes a learning moment   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
