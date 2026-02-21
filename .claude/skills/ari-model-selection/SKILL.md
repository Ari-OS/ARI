---
name: ari-model-selection
description: Intelligent model selection for autonomous operations — balance capability, cost, and task requirements
triggers:
  - "model selection"
  - "which model"
  - "use sonnet"
  - "use opus"
  - "token cost"
  - "cost optimization"
  - "/ari-model"
---

# ARI Model Selection — Adaptive Intelligence

ARI autonomously selects the optimal model for each task based on:

- **Task complexity** — Does this require deep reasoning or pattern matching?
- **Token cost** — What's the budget impact?
- **Quality requirements** — Is this production-critical or exploratory?
- **Speed needs** — Is latency a factor?

## Available Models

| Model | Strengths | Token Cost | Use When |
|-------|-----------|------------|----------|
| **Claude Opus 4.5** | Deep reasoning, complex analysis, nuanced judgment | Highest | Complex decisions, architecture, security |
| **Claude Sonnet 4** | Balanced capability, good at coding | Medium | Most development tasks, code generation |
| **Claude Haiku 4** | Fast, efficient, pattern matching | Lowest | Simple queries, formatting, quick checks |

## Decision Framework

```
┌────────────────────────────────────────────────────────────────┐
│              MODEL SELECTION DECISION TREE                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Is this task...                                               │
│  │                                                             │
│  ├─► COMPLEX REASONING                                         │
│  │   • Architecture decisions                                  │
│  │   • Security analysis                                       │
│  │   • Novel problem solving                                   │
│  │   • Multi-step planning                                     │
│  │   • Ambiguous requirements                                  │
│  │   • Cross-domain synthesis                                  │
│  │   └─► Use: OPUS                                             │
│  │                                                             │
│  ├─► STANDARD DEVELOPMENT                                      │
│  │   • Code generation                                         │
│  │   • Bug fixing                                              │
│  │   • Test writing                                            │
│  │   • Documentation                                           │
│  │   • Code review                                             │
│  │   • Refactoring                                             │
│  │   └─► Use: SONNET (default)                                 │
│  │                                                             │
│  └─► SIMPLE/ROUTINE                                            │
│      • File operations                                         │
│      • Formatting                                              │
│      • Simple lookups                                          │
│      • Status checks                                           │
│      • Quick answers                                           │
│      └─► Use: HAIKU                                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Implementation

### When Spawning Agents (Task Tool)

```typescript
// The Task tool accepts a model parameter
// Use this to specify the appropriate model

// Complex architecture task → Opus
{
  description: "Design authentication system",
  prompt: "...",
  subagent_type: "feature-dev:code-architect",
  model: "opus"  // High complexity requires Opus
}

// Standard coding task → Sonnet (default)
{
  description: "Implement login endpoint",
  prompt: "...",
  subagent_type: "Bash",
  model: "sonnet"  // Standard development
}

// Quick exploration → Haiku
{
  description: "Find all config files",
  prompt: "...",
  subagent_type: "Explore",
  model: "haiku"  // Simple search
}
```

### Decision Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│ TASK TYPE → MODEL MAPPING                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ALWAYS OPUS                                                      │
│ ─────────────────────────────────────────────────────────────── │
│ • Security audits and vulnerability analysis                    │
│ • Architectural decisions with long-term impact                 │
│ • Novel problem solving (no clear pattern to follow)            │
│ • Constitutional/governance decisions                            │
│ • Complex multi-system integration design                        │
│ • Ambiguous requirements that need interpretation               │
│ • High-stakes decisions (irreversible actions)                   │
│ • Cross-domain reasoning (e.g., code + security + UX)           │
│                                                                  │
│ PREFER SONNET (default for most tasks)                          │
│ ─────────────────────────────────────────────────────────────── │
│ • Code generation from clear specifications                     │
│ • Test writing                                                   │
│ • Bug fixing (standard bugs)                                     │
│ • Documentation                                                  │
│ • Code review (standard review)                                  │
│ • Refactoring with clear patterns                                │
│ • Feature implementation with defined scope                      │
│ • API development                                                │
│                                                                  │
│ USE HAIKU (cost optimization)                                    │
│ ─────────────────────────────────────────────────────────────── │
│ • File exploration and search                                    │
│ • Simple grep/glob operations                                    │
│ • Formatting tasks                                               │
│ • Status checks                                                  │
│ • Simple data transformations                                    │
│ • Quick lookups in documentation                                 │
│ • Syntax validation                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Cost-Benefit Analysis

### Token Cost Ratios (Approximate)

```
Opus    : ████████████████████ 100%  (Baseline)
Sonnet  : ████████            40%   (2.5x cheaper)
Haiku   : ██                  10%   (10x cheaper)
```

### ROI Calculation

```typescript
function calculateModelValue(task: Task): ModelRecommendation {
  // Estimate task complexity
  const complexity = assessComplexity(task);

  // Estimate quality impact
  const qualityImpact = estimateQualityDelta(task, 'opus', 'sonnet');

  // Calculate cost difference
  const costDelta = estimateTokenCost(task, 'opus') - estimateTokenCost(task, 'sonnet');

  // Decision: Is the quality gain worth the cost?
  if (qualityImpact > costDelta * costSensitivity) {
    return { model: 'opus', reason: 'Quality gain justifies cost' };
  } else if (complexity === 'low') {
    return { model: 'haiku', reason: 'Simple task, maximize savings' };
  } else {
    return { model: 'sonnet', reason: 'Balanced capability/cost' };
  }
}
```

## Complexity Indicators

### Signs Task Needs Opus

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔴 OPUS INDICATORS                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ LANGUAGE SIGNALS:                                                │
│ • "Design the architecture for..."                               │
│ • "What's the best approach to..."                               │
│ • "Consider all the tradeoffs..."                                │
│ • "This is security-critical..."                                 │
│ • "We need to think through..."                                  │
│ • "The requirements are unclear..."                              │
│                                                                  │
│ TASK CHARACTERISTICS:                                            │
│ • Multiple valid solutions exist                                 │
│ • Requires weighing tradeoffs                                    │
│ • Has long-term consequences                                     │
│ • Involves multiple systems/domains                              │
│ • No clear pattern to follow                                     │
│ • Stakeholder judgment required                                  │
│                                                                  │
│ DOMAIN SIGNALS:                                                  │
│ • Security, authentication, authorization                        │
│ • Data migration with integrity requirements                     │
│ • Performance optimization (non-trivial)                         │
│ • Distributed systems coordination                               │
│ • Constitutional/governance decisions                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Signs Task Needs Sonnet

```
┌─────────────────────────────────────────────────────────────────┐
│ 🟡 SONNET INDICATORS (Default)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ LANGUAGE SIGNALS:                                                │
│ • "Implement this feature..."                                    │
│ • "Write a function that..."                                     │
│ • "Fix this bug..."                                              │
│ • "Add tests for..."                                             │
│ • "Create a component that..."                                   │
│                                                                  │
│ TASK CHARACTERISTICS:                                            │
│ • Clear specification provided                                   │
│ • Similar patterns exist in codebase                             │
│ • Standard coding task                                           │
│ • Known solution approach                                        │
│ • Contained scope (single file/module)                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Signs Task Needs Haiku

```
┌─────────────────────────────────────────────────────────────────┐
│ 🟢 HAIKU INDICATORS (Cost-Optimized)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ LANGUAGE SIGNALS:                                                │
│ • "Find all files that..."                                       │
│ • "List the..."                                                  │
│ • "Check if..."                                                  │
│ • "Format this..."                                               │
│ • "Search for..."                                                │
│                                                                  │
│ TASK CHARACTERISTICS:                                            │
│ • Single operation                                               │
│ • Pattern matching / lookup                                      │
│ • No judgment required                                           │
│ • Deterministic output expected                                  │
│ • Speed is more important than depth                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Autonomous Operation

When ARI operates autonomously (via scheduler, daemon, or spawned agents), it should:

### 1. Assess Each Task Before Execution

```typescript
async function executeAutonomousTask(task: ScheduledTask) {
  // Step 1: Analyze task complexity
  const analysis = analyzeTaskComplexity(task);

  // Step 2: Select appropriate model
  const model = selectModel(analysis);

  // Step 3: Log decision for transparency
  this.eventBus.emit('audit:log', {
    action: 'model_selected',
    details: {
      task: task.name,
      model,
      reason: analysis.reason,
      estimatedTokens: analysis.estimatedTokens,
      estimatedCost: analysis.estimatedCost,
    }
  });

  // Step 4: Execute with selected model
  return await executeWithModel(task, model);
}
```

### 2. Track Cost Over Time

```typescript
interface CostTracking {
  daily: {
    opus: number;
    sonnet: number;
    haiku: number;
  };
  weekly: {
    totalCost: number;
    savingsFromDowngrade: number;
    qualityImpactFromDowngrade: number;
  };
}
```

### 3. Learn from Outcomes

```typescript
// After task completion, evaluate if model choice was appropriate
function evaluateModelChoice(task: Task, result: Result, modelUsed: Model) {
  const qualityMet = result.quality >= task.qualityThreshold;
  const withinBudget = result.cost <= task.costBudget;

  // Record for future optimization
  recordModelOutcome({
    taskType: task.type,
    model: modelUsed,
    success: qualityMet && withinBudget,
    actualCost: result.cost,
    qualityScore: result.quality,
  });
}
```

## Practical Examples

### Example 1: Security Audit (Opus Required)

```typescript
// Task: Review authentication system for vulnerabilities
// Analysis: Security-critical, requires nuanced judgment
// Decision: OPUS

{
  description: "Security audit of auth system",
  prompt: "Review the authentication implementation in src/kernel/... for security vulnerabilities",
  subagent_type: "ari-security-auditor",
  model: "opus"  // Security = always Opus
}
```

### Example 2: Code Generation (Sonnet Default)

```typescript
// Task: Implement a new API endpoint
// Analysis: Standard coding, clear specification
// Decision: SONNET

{
  description: "Implement /api/users endpoint",
  prompt: "Create a CRUD endpoint for users following existing patterns in src/api/routes.ts",
  subagent_type: "general-purpose",
  model: "sonnet"  // Standard development
}
```

### Example 3: File Search (Haiku for Speed)

```typescript
// Task: Find all TypeScript files with certain pattern
// Analysis: Simple search, no reasoning required
// Decision: HAIKU

{
  description: "Find config files",
  prompt: "Find all files matching *.config.ts",
  subagent_type: "Explore",
  model: "haiku"  // Fast, simple, cheap
}
```

## Override Conditions

### Always Upgrade to Opus

- Security-related tasks
- Irreversible operations (data deletion, migrations)
- Constitutional/governance decisions
- User-facing critical paths
- When previous attempt with Sonnet failed

### Never Downgrade Below Sonnet

- Production deployments
- Database operations
- API design
- Error handling logic

## Integration with ARI's Architecture

```typescript
// In agent spawning logic
async function spawnAgent(config: AgentConfig): Promise<Agent> {
  // Determine optimal model
  const model = determineOptimalModel({
    taskType: config.subagent_type,
    taskDescription: config.description,
    taskPrompt: config.prompt,
    previousAttempts: config.retryCount || 0,
  });

  // Spawn with selected model
  return await Task({
    ...config,
    model,
  });
}

function determineOptimalModel(context: ModelSelectionContext): 'opus' | 'sonnet' | 'haiku' {
  // Security/governance → Opus
  if (isSecuritySensitive(context)) return 'opus';

  // Previous failure → upgrade
  if (context.previousAttempts > 0) return upgradeModel(context.currentModel);

  // Simple exploration → Haiku
  if (context.taskType === 'Explore' && isSimpleSearch(context.taskPrompt)) {
    return 'haiku';
  }

  // Default → Sonnet
  return 'sonnet';
}
```

## Monitoring & Reporting

### Cost Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ MODEL USAGE (Last 7 Days)                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Opus    ██████░░░░░░░░░░░░░░ 30%  │  $12.50  │  High-value tasks │
│ Sonnet  ████████████░░░░░░░░ 55%  │  $8.25   │  Standard work    │
│ Haiku   ███░░░░░░░░░░░░░░░░░ 15%  │  $0.50   │  Quick operations │
│                                                                  │
│ Total: $21.25 (vs. $45.00 if all Opus = 53% savings)            │
│                                                                  │
│ Quality Impact: None detected (all quality gates passed)         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Principles

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  1. DEFAULT TO SONNET                                          │
│     Most tasks don't need Opus. Start at Sonnet.               │
│                                                                │
│  2. UPGRADE FOR COMPLEXITY                                     │
│     When judgment, tradeoffs, or security matter → Opus.       │
│                                                                │
│  3. DOWNGRADE FOR SPEED                                        │
│     Simple searches, lookups, formatting → Haiku.              │
│                                                                │
│  4. TRACK AND LEARN                                            │
│     Monitor outcomes. Adjust thresholds based on results.      │
│                                                                │
│  5. WHEN IN DOUBT, UPGRADE                                     │
│     Quality failures are more expensive than token costs.      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```
