# 24/7 Autonomous ARI with Intelligent Cost Management - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform ARI's Mac Mini from idle infrastructure into an intelligent 24/7 autonomous system that proactively discovers work, executes tasks safely, and delivers value while maintaining strict token budget control through smart model routing.

**Architecture:** Three-tier system: (1) TokenBudgetTracker monitors and enforces daily spending limits, (2) ModelRouter intelligently selects between Haiku/Sonnet/Opus based on task complexity, (3) Enhanced autonomous agent orchestrates scheduled work and initiative execution with adaptive throttling. All operations flow through cognitive safety gates and log to audit chain.

**Tech Stack:** TypeScript 5.3, Node.js 20+, Anthropic Claude API (3 models), Existing ARI architecture (EventBus, Scheduler, InitiativeEngine)

**Target Metrics:**

- Daily autonomous cost: $0.50-1.50
- Haiku usage: 70% of API calls
- Autonomous tasks: 10-20 per day
- Morning brief: Ready by 7:30 AM daily
- Budget adherence: 95%+ days under budget

---

## Phase 1: Token Budget Foundation (Days 1-2)

### Task 1: Token Budget Tracker - Core Implementation

**Files:**

- Create: `src/observability/token-budget-tracker.ts`
- Create: `tests/unit/observability/token-budget-tracker.test.ts`
- Modify: `src/observability/index.ts` (add export)

**Step 1: Write the failing test for budget creation**

```typescript
// tests/unit/observability/token-budget-tracker.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenBudgetTracker } from '../../../src/observability/token-budget-tracker.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

describe('TokenBudgetTracker', () => {
  let tracker: TokenBudgetTracker;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(tmpdir(), `ari-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    tracker = new TokenBudgetTracker({
      storageDir: testDir,
      dailyMaxTokens: 800000,
      dailyMaxCost: 2.50,
      reservedForUser: 500000,
    });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should create tracker with budget limits', () => {
      expect(tracker).toBeDefined();
      const status = tracker.getStatus();
      expect(status.budgetRemaining).toBe(800000);
      expect(status.costRemaining).toBeCloseTo(2.50, 2);
    });

    it('should load existing usage data on init', async () => {
      // Record some usage
      await tracker.recordUsage({
        model: 'claude-3-5-sonnet-20241022',
        promptTokens: 10000,
        completionTokens: 5000,
        taskType: 'test',
        taskId: 'task-1',
      });

      // Create new tracker instance (simulates restart)
      const tracker2 = new TokenBudgetTracker({
        storageDir: testDir,
        dailyMaxTokens: 800000,
        dailyMaxCost: 2.50,
        reservedForUser: 500000,
      });

      const status = tracker2.getStatus();
      expect(status.budgetUsed).toBeGreaterThan(0);
    });
  });

  describe('recordUsage', () => {
    it('should track token usage and calculate cost', async () => {
      await tracker.recordUsage({
        model: 'claude-3-haiku-20240307',
        promptTokens: 5000,
        completionTokens: 2000,
        taskType: 'changelog',
        taskId: 'task-1',
      });

      const status = tracker.getStatus();
      expect(status.budgetUsed).toBe(7000);
      // Haiku: $0.00025/1k input + $0.00125/1k output
      // Cost: (5000/1000)*0.00025 + (2000/1000)*0.00125 = 0.00125 + 0.0025 = 0.00375
      expect(status.costUsed).toBeCloseTo(0.00375, 5);
    });

    it('should aggregate usage by task type', async () => {
      await tracker.recordUsage({
        model: 'claude-3-haiku-20240307',
        promptTokens: 5000,
        completionTokens: 2000,
        taskType: 'changelog',
        taskId: 'task-1',
      });

      await tracker.recordUsage({
        model: 'claude-3-5-sonnet-20241022',
        promptTokens: 10000,
        completionTokens: 5000,
        taskType: 'test-generation',
        taskId: 'task-2',
      });

      const status = tracker.getStatus();
      expect(status.topConsumers).toHaveLength(2);
      expect(status.topConsumers[0].taskType).toBe('test-generation'); // Higher cost
    });
  });

  describe('canProceed', () => {
    it('should allow task when budget available', async () => {
      const result = await tracker.canProceed(10000, 'STANDARD');
      expect(result.allowed).toBe(true);
      expect(result.throttled).toBe(false);
    });

    it('should throttle when approaching 80% budget', async () => {
      // Use 640k tokens (80% of 800k)
      await tracker.recordUsage({
        model: 'claude-3-5-sonnet-20241022',
        promptTokens: 500000,
        completionTokens: 140000,
        taskType: 'bulk',
        taskId: 'bulk-1',
      });

      const result = await tracker.canProceed(10000, 'BACKGROUND');
      expect(result.allowed).toBe(true);
      expect(result.throttled).toBe(true);
    });

    it('should block background tasks at 95% budget', async () => {
      // Use 760k tokens (95% of 800k)
      await tracker.recordUsage({
        model: 'claude-3-5-sonnet-20241022',
        promptTokens: 600000,
        completionTokens: 160000,
        taskType: 'bulk',
        taskId: 'bulk-1',
      });

      const result = await tracker.canProceed(10000, 'BACKGROUND');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('budget');
    });

    it('should allow urgent tasks even when budget exceeded', async () => {
      // Exceed budget
      await tracker.recordUsage({
        model: 'claude-opus-4-20250514',
        promptTokens: 700000,
        completionTokens: 200000,
        taskType: 'bulk',
        taskId: 'bulk-1',
      });

      const result = await tracker.canProceed(10000, 'URGENT');
      expect(result.allowed).toBe(true);
      expect(result.throttled).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset usage at midnight', async () => {
      await tracker.recordUsage({
        model: 'claude-3-haiku-20240307',
        promptTokens: 10000,
        completionTokens: 5000,
        taskType: 'test',
        taskId: 'task-1',
      });

      expect(tracker.getStatus().budgetUsed).toBeGreaterThan(0);

      // Manually trigger reset (simulates midnight)
      await tracker['resetDaily']();

      expect(tracker.getStatus().budgetUsed).toBe(0);
      expect(tracker.getStatus().costUsed).toBe(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- token-budget-tracker.test.ts`  
Expected: FAIL - "Cannot find module 'token-budget-tracker'"

**Step 3: Write minimal TokenBudgetTracker implementation**

```typescript
// src/observability/token-budget-tracker.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

export interface TokenUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  taskType: string;
  taskId: string;
  timestamp?: Date;
}

export interface BudgetConfig {
  storageDir?: string;
  dailyMaxTokens: number;
  dailyMaxCost: number;
  reservedForUser: number;
}

export interface BudgetStatus {
  budgetUsed: number;
  budgetRemaining: number;
  costUsed: number;
  costRemaining: number;
  projectedEndOfDay: number;
  topConsumers: Array<{
    taskType: string;
    tokensUsed: number;
    cost: number;
    percentOfTotal: number;
  }>;
}

interface DailyUsageRecord {
  date: string;
  totalTokens: number;
  totalCost: number;
  byModel: Record<string, { tokens: number; cost: number }>;
  byTaskType: Record<string, { tokens: number; cost: number; count: number }>;
  resetAt: string;
}

// Model costs (per 1M tokens)
const MODEL_COSTS = {
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
} as const;

export class TokenBudgetTracker {
  private config: Required<BudgetConfig>;
  private currentUsage: DailyUsageRecord;
  private storagePath: string;

  constructor(config: BudgetConfig) {
    this.config = {
      storageDir: config.storageDir ?? path.join(homedir(), '.ari'),
      dailyMaxTokens: config.dailyMaxTokens,
      dailyMaxCost: config.dailyMaxCost,
      reservedForUser: config.reservedForUser,
    };

    this.storagePath = path.join(this.config.storageDir, 'token-usage.json');
    
    // Initialize current usage
    const today = new Date().toISOString().split('T')[0];
    this.currentUsage = {
      date: today,
      totalTokens: 0,
      totalCost: 0,
      byModel: {},
      byTaskType: {},
      resetAt: new Date().toISOString(),
    };

    // Load existing data synchronously in constructor
    this.loadUsageSync();
  }

  private loadUsageSync(): void {
    try {
      const data = require('fs').readFileSync(this.storagePath, 'utf-8');
      const stored = JSON.parse(data) as DailyUsageRecord;
      const today = new Date().toISOString().split('T')[0];
      
      if (stored.date === today) {
        this.currentUsage = stored;
      }
    } catch {
      // No existing data or different day
    }
  }

  async recordUsage(usage: TokenUsage): Promise<void> {
    const totalTokens = usage.promptTokens + usage.completionTokens;
    const cost = this.calculateCost(usage.model, usage.promptTokens, usage.completionTokens);

    // Update totals
    this.currentUsage.totalTokens += totalTokens;
    this.currentUsage.totalCost += cost;

    // Update by model
    if (!this.currentUsage.byModel[usage.model]) {
      this.currentUsage.byModel[usage.model] = { tokens: 0, cost: 0 };
    }
    this.currentUsage.byModel[usage.model].tokens += totalTokens;
    this.currentUsage.byModel[usage.model].cost += cost;

    // Update by task type
    if (!this.currentUsage.byTaskType[usage.taskType]) {
      this.currentUsage.byTaskType[usage.taskType] = { tokens: 0, cost: 0, count: 0 };
    }
    this.currentUsage.byTaskType[usage.taskType].tokens += totalTokens;
    this.currentUsage.byTaskType[usage.taskType].cost += cost;
    this.currentUsage.byTaskType[usage.taskType].count += 1;

    // Persist
    await this.save();
  }

  async canProceed(
    estimatedTokens: number,
    priority: 'BACKGROUND' | 'STANDARD' | 'URGENT'
  ): Promise<{ allowed: boolean; throttled: boolean; reason?: string }> {
    const status = this.getStatus();
    const projectedTotal = status.budgetUsed + estimatedTokens;

    // Urgent always allowed (reserved for user interactions)
    if (priority === 'URGENT') {
      return { allowed: true, throttled: false };
    }

    // Check if would exceed budget
    if (projectedTotal > this.config.dailyMaxTokens) {
      return {
        allowed: false,
        throttled: false,
        reason: `Would exceed daily budget (${projectedTotal}/${this.config.dailyMaxTokens} tokens)`,
      };
    }

    // Check throttling thresholds
    const usagePercent = status.budgetUsed / this.config.dailyMaxTokens;

    if (usagePercent >= 0.95) {
      // At 95%, block background tasks
      if (priority === 'BACKGROUND') {
        return {
          allowed: false,
          throttled: true,
          reason: 'Budget 95% consumed, background tasks paused',
        };
      }
    }

    if (usagePercent >= 0.80) {
      // At 80%, indicate throttling but allow
      return { allowed: true, throttled: true };
    }

    return { allowed: true, throttled: false };
  }

  getStatus(): BudgetStatus {
    const budgetUsed = this.currentUsage.totalTokens;
    const budgetRemaining = Math.max(0, this.config.dailyMaxTokens - budgetUsed);
    const costUsed = this.currentUsage.totalCost;
    const costRemaining = Math.max(0, this.config.dailyMaxCost - costUsed);

    // Calculate projection (simplified: current rate * 24 hours)
    const now = new Date();
    const resetTime = new Date(this.currentUsage.resetAt);
    const hoursElapsed = (now.getTime() - resetTime.getTime()) / (1000 * 60 * 60);
    const projectedEndOfDay = hoursElapsed > 0 ? (budgetUsed / hoursElapsed) * 24 : budgetUsed;

    // Top consumers
    const topConsumers = Object.entries(this.currentUsage.byTaskType)
      .map(([taskType, data]) => ({
        taskType,
        tokensUsed: data.tokens,
        cost: data.cost,
        percentOfTotal: (data.tokens / budgetUsed) * 100,
      }))
      .sort((a, b) => b.cost - a.cost);

    return {
      budgetUsed,
      budgetRemaining,
      costUsed,
      costRemaining,
      projectedEndOfDay,
      topConsumers,
    };
  }

  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const costs = MODEL_COSTS[model as keyof typeof MODEL_COSTS];
    if (!costs) {
      throw new Error(`Unknown model: ${model}`);
    }

    // Costs are per 1M tokens, convert to per-token
    const inputCost = (promptTokens / 1_000_000) * costs.input;
    const outputCost = (completionTokens / 1_000_000) * costs.output;
    return inputCost + outputCost;
  }

  private async save(): Promise<void> {
    await fs.mkdir(this.config.storageDir, { recursive: true });
    await fs.writeFile(this.storagePath, JSON.stringify(this.currentUsage, null, 2));
  }

  private async resetDaily(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    this.currentUsage = {
      date: today,
      totalTokens: 0,
      totalCost: 0,
      byModel: {},
      byTaskType: {},
      resetAt: new Date().toISOString(),
    };
    await this.save();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- token-budget-tracker.test.ts`  
Expected: PASS - All tests green

**Step 5: Update index exports**

```typescript
// src/observability/index.ts
export { TokenBudgetTracker } from './token-budget-tracker.js';
export type { TokenUsage, BudgetConfig, BudgetStatus } from './token-budget-tracker.js';
export { MetricsCollector } from './metrics-collector.js';
export { AlertManager } from './alert-manager.js';
export { ExecutionHistory } from './execution-history.js';
export { CostTracker } from './cost-tracker.js';
```

**Step 6: Commit**

```bash
git add src/observability/token-budget-tracker.ts tests/unit/observability/token-budget-tracker.test.ts src/observability/index.ts
git commit -m "feat(observability): add TokenBudgetTracker with daily limits and throttling"
```

---

### Task 2: Model Router - Intelligent Task Profiling

**Files:**

- Create: `src/execution/model-router.ts`
- Create: `tests/unit/execution/model-router.test.ts`
- Modify: `src/execution/index.ts` (add export)

**Step 1: Write the failing test for task profiling**

```typescript
// tests/unit/execution/model-router.test.ts
import { describe, it, expect } from 'vitest';
import { ModelRouter, TaskProfile } from '../../../src/execution/model-router.js';

describe('ModelRouter', () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = new ModelRouter();
  });

  describe('profileTask', () => {
    it('should profile simple changelog task as trivial', () => {
      const profile = router.profileTask({
        type: 'changelog-generation',
        description: 'Parse git log and generate changelog',
        estimatedComplexity: 'low',
      });

      expect(profile.complexity).toBe('TRIVIAL');
      expect(profile.creativity).toBe('LOW');
      expect(profile.riskLevel).toBe('LOW');
    });

    it('should profile test writing as moderate complexity', () => {
      const profile = router.profileTask({
        type: 'test-generation',
        description: 'Write unit tests for authentication module',
        filesAffected: ['src/auth/login.ts'],
      });

      expect(profile.complexity).toBe('MODERATE');
      expect(profile.creativity).toBe('MEDIUM');
      expect(profile.riskLevel).toBe('MEDIUM');
    });

    it('should profile architecture decision as complex', () => {
      const profile = router.profileTask({
        type: 'architecture-design',
        description: 'Design new microservice communication pattern',
        filesAffected: ['multiple'],
      });

      expect(profile.complexity).toBe('COMPLEX');
      expect(profile.creativity).toBe('HIGH');
    });

    it('should increase risk level for security-related tasks', () => {
      const profile = router.profileTask({
        type: 'code-modification',
        description: 'Update authentication token handling',
        tags: ['security'],
      });

      expect(profile.riskLevel).toBe('HIGH');
    });
  });

  describe('selectModel', () => {
    it('should select Haiku for trivial tasks', () => {
      const profile: TaskProfile = {
        complexity: 'TRIVIAL',
        creativity: 'LOW',
        riskLevel: 'LOW',
        tokenBudget: 10000,
        priority: 'BACKGROUND',
      };

      const selection = router.selectModel(profile);
      expect(selection.model).toBe('claude-3-haiku-20240307');
      expect(selection.rationale).toContain('Fast and cost-efficient');
    });

    it('should select Sonnet for moderate tasks', () => {
      const profile: TaskProfile = {
        complexity: 'MODERATE',
        creativity: 'MEDIUM',
        riskLevel: 'MEDIUM',
        tokenBudget: 50000,
        priority: 'STANDARD',
      };

      const selection = router.selectModel(profile);
      expect(selection.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should select Opus for complex tasks', () => {
      const profile: TaskProfile = {
        complexity: 'COMPLEX',
        creativity: 'HIGH',
        riskLevel: 'HIGH',
        tokenBudget: 100000,
        priority: 'URGENT',
      };

      const selection = router.selectModel(profile);
      expect(selection.model).toBe('claude-opus-4-20250514');
    });

    it('should upgrade to Sonnet for high-risk moderate tasks', () => {
      const profile: TaskProfile = {
        complexity: 'MODERATE',
        creativity: 'MEDIUM',
        riskLevel: 'HIGH',
        tokenBudget: 50000,
        priority: 'STANDARD',
      };

      const selection = router.selectModel(profile);
      expect(selection.model).toBe('claude-opus-4-20250514');
      expect(selection.rationale).toContain('high risk');
    });

    it('should calculate accurate cost estimates', () => {
      const profile: TaskProfile = {
        complexity: 'SIMPLE',
        creativity: 'LOW',
        riskLevel: 'LOW',
        tokenBudget: 10000,
        priority: 'BACKGROUND',
      };

      const selection = router.selectModel(profile);
      // Haiku: 10k tokens, assuming 60/40 prompt/completion split
      // Input: 6k * $0.00025/1k = $0.0015
      // Output: 4k * $0.00125/1k = $0.005
      // Total: ~$0.0065
      expect(selection.costEstimate).toBeCloseTo(0.0065, 3);
    });
  });

  describe('routeTask', () => {
    it('should provide complete routing recommendation', () => {
      const routing = router.routeTask({
        type: 'test-generation',
        description: 'Write tests for new API endpoint',
        filesAffected: ['src/api/users.ts'],
      });

      expect(routing.profile).toBeDefined();
      expect(routing.model).toBeDefined();
      expect(routing.model.model).toBe('claude-3-5-sonnet-20241022');
      expect(routing.reasoning).toContain('balanced');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- model-router.test.ts`  
Expected: FAIL - "Cannot find module 'model-router'"

**Step 3: Write ModelRouter implementation**

```typescript
// src/execution/model-router.ts

export type Complexity = 'TRIVIAL' | 'SIMPLE' | 'MODERATE' | 'COMPLEX';
export type Creativity = 'LOW' | 'MEDIUM' | 'HIGH';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type Priority = 'BACKGROUND' | 'STANDARD' | 'URGENT';

export interface TaskProfile {
  complexity: Complexity;
  creativity: Creativity;
  riskLevel: RiskLevel;
  tokenBudget: number;
  priority: Priority;
}

export interface TaskInput {
  type: string;
  description: string;
  filesAffected?: string[];
  estimatedComplexity?: 'low' | 'medium' | 'high';
  tags?: string[];
}

export interface ModelSelection {
  model: 'claude-3-haiku-20240307' | 'claude-3-5-sonnet-20241022' | 'claude-opus-4-20250514';
  maxTokens: number;
  costEstimate: number;
  rationale: string;
}

export interface TaskRouting {
  profile: TaskProfile;
  model: ModelSelection;
  reasoning: string;
}

// Model costs (per 1k tokens for easier calculation)
const MODEL_COSTS = {
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-opus-4-20250514': { input: 0.015, output: 0.075 },
} as const;

export class ModelRouter {
  /**
   * Profile a task to determine its characteristics
   */
  profileTask(task: TaskInput): TaskProfile {
    const complexity = this.assessComplexity(task);
    const creativity = this.assessCreativity(task);
    const riskLevel = this.assessRisk(task);

    // Default token budget based on complexity
    const tokenBudget = {
      TRIVIAL: 10000,
      SIMPLE: 20000,
      MODERATE: 50000,
      COMPLEX: 100000,
    }[complexity];

    return {
      complexity,
      creativity,
      riskLevel,
      tokenBudget,
      priority: 'STANDARD',
    };
  }

  /**
   * Select the optimal model for a given task profile
   */
  selectModel(profile: TaskProfile): ModelSelection {
    // Decision matrix
    let selectedModel: ModelSelection['model'];
    let rationale: string;

    // High risk always gets Opus
    if (profile.riskLevel === 'HIGH') {
      selectedModel = 'claude-opus-4-20250514';
      rationale = 'Opus selected due to high risk level - maximum intelligence and safety required';
    }
    // Complex or high creativity gets Opus
    else if (profile.complexity === 'COMPLEX' || profile.creativity === 'HIGH') {
      selectedModel = 'claude-opus-4-20250514';
      rationale = 'Opus selected for complex/creative task requiring advanced reasoning';
    }
    // Moderate complexity gets Sonnet
    else if (profile.complexity === 'MODERATE' || profile.creativity === 'MEDIUM') {
      selectedModel = 'claude-3-5-sonnet-20241022';
      rationale = 'Sonnet selected for balanced performance and cost on moderate complexity task';
    }
    // Everything else gets Haiku
    else {
      selectedModel = 'claude-3-haiku-20240307';
      rationale = 'Haiku selected for simple task - Fast and cost-efficient';
    }

    // Calculate cost estimate (assume 60/40 prompt/completion ratio)
    const promptTokens = Math.floor(profile.tokenBudget * 0.6);
    const completionTokens = Math.floor(profile.tokenBudget * 0.4);
    const costs = MODEL_COSTS[selectedModel];
    const costEstimate =
      (promptTokens / 1000) * costs.input +
      (completionTokens / 1000) * costs.output;

    return {
      model: selectedModel,
      maxTokens: profile.tokenBudget,
      costEstimate,
      rationale,
    };
  }

  /**
   * Complete routing: profile + model selection
   */
  routeTask(task: TaskInput): TaskRouting {
    const profile = this.profileTask(task);
    const model = this.selectModel(profile);

    const reasoning = [
      `Task type: ${task.type}`,
      `Complexity: ${profile.complexity}`,
      `Risk: ${profile.riskLevel}`,
      `Selected: ${model.model.split('-')[1].toUpperCase()} (${model.rationale})`,
    ].join(' | ');

    return {
      profile,
      model,
      reasoning,
    };
  }

  private assessComplexity(task: TaskInput): Complexity {
    // Explicit complexity hint
    if (task.estimatedComplexity) {
      const map = { low: 'SIMPLE', medium: 'MODERATE', high: 'COMPLEX' } as const;
      return map[task.estimatedComplexity] as Complexity;
    }

    // Task type patterns
    const trivialTypes = [
      'health-check',
      'file-scan',
      'pattern-match',
      'status-check',
    ];
    const simpleTypes = [
      'changelog-generation',
      'todo-extraction',
      'simple-summary',
      'knowledge-query',
    ];
    const moderateTypes = [
      'test-generation',
      'documentation-update',
      'code-quality-check',
      'brief-generation',
    ];
    const complexTypes = [
      'architecture-design',
      'refactoring',
      'multi-file-coordination',
      'security-audit',
    ];

    if (trivialTypes.some(t => task.type.includes(t))) return 'TRIVIAL';
    if (simpleTypes.some(t => task.type.includes(t))) return 'SIMPLE';
    if (moderateTypes.some(t => task.type.includes(t))) return 'MODERATE';
    if (complexTypes.some(t => task.type.includes(t))) return 'COMPLEX';

    // File count heuristic
    if (task.filesAffected && task.filesAffected.length > 5) return 'COMPLEX';
    if (task.filesAffected && task.filesAffected.length > 2) return 'MODERATE';

    // Default to simple
    return 'SIMPLE';
  }

  private assessCreativity(task: TaskInput): Creativity {
    const highCreativityTypes = [
      'architecture-design',
      'problem-solving',
      'design-pattern',
      'brief-generation',
    ];
    const mediumCreativityTypes = [
      'test-generation',
      'documentation',
      'code-quality',
    ];

    if (highCreativityTypes.some(t => task.type.includes(t))) return 'HIGH';
    if (mediumCreativityTypes.some(t => task.type.includes(t))) return 'MEDIUM';

    return 'LOW';
  }

  private assessRisk(task: TaskInput): RiskLevel {
    // Security/credentials = always high risk
    const securityTags = ['security', 'auth', 'credential', 'token', 'secret'];
    if (task.tags?.some(tag => securityTags.some(st => tag.includes(st)))) {
      return 'HIGH';
    }

    // Destructive operations = high risk
    const destructiveTypes = ['delete', 'drop', 'remove', 'refactor'];
    if (destructiveTypes.some(t => task.type.includes(t))) {
      return 'HIGH';
    }

    // Multi-file changes = medium risk
    if (task.filesAffected && task.filesAffected.length > 3) {
      return 'MEDIUM';
    }

    // Read-only operations = low risk
    const readOnlyTypes = ['scan', 'check', 'query', 'status', 'health', 'changelog'];
    if (readOnlyTypes.some(t => task.type.includes(t))) {
      return 'LOW';
    }

    // Default medium
    return 'MEDIUM';
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- model-router.test.ts`  
Expected: PASS - All tests green

**Step 5: Update index exports**

```typescript
// src/execution/index.ts
export { ModelRouter } from './model-router.js';
export type {
  TaskProfile,
  TaskInput,
  ModelSelection,
  TaskRouting,
  Complexity,
  Creativity,
  RiskLevel,
  Priority,
} from './model-router.js';
export { ToolExecutor } from './tool-executor.js';
export { ToolRegistry } from './tool-registry.js';
```

**Step 6: Commit**

```bash
git add src/execution/model-router.ts tests/unit/execution/model-router.test.ts src/execution/index.ts
git commit -m "feat(execution): add ModelRouter for intelligent model selection based on task complexity"
```

---

### Task 3: Integrate Budget Tracker with ClaudeClient

**Files:**

- Modify: `src/autonomous/claude-client.ts`
- Modify: `tests/unit/autonomous/claude-client.test.ts`

**Step 1: Write test for budget integration**

```typescript
// Add to existing tests/unit/autonomous/claude-client.test.ts
import { TokenBudgetTracker } from '../../../src/observability/token-budget-tracker.js';

describe('ClaudeClient - Budget Integration', () => {
  it('should record usage to budget tracker after API call', async () => {
    const tracker = new TokenBudgetTracker({
      storageDir: testDir,
      dailyMaxTokens: 100000,
      dailyMaxCost: 1.0,
      reservedForUser: 50000,
    });

    const client = new ClaudeClient({
      apiKey: 'test-key',
      budgetTracker: tracker,
    });

    // Mock API call (you'll need to mock Anthropic SDK)
    // ... API mock setup ...

    await client.generateCompletion({
      prompt: 'Test prompt',
      model: 'claude-3-haiku-20240307',
      maxTokens: 1000,
    });

    const status = tracker.getStatus();
    expect(status.budgetUsed).toBeGreaterThan(0);
  });

  it('should check budget before making API call', async () => {
    const tracker = new TokenBudgetTracker({
      storageDir: testDir,
      dailyMaxTokens: 10000,
      dailyMaxCost: 0.1,
      reservedForUser: 5000,
    });

    // Exhaust budget
    await tracker.recordUsage({
      model: 'claude-3-5-sonnet-20241022',
      promptTokens: 8000,
      completionTokens: 2000,
      taskType: 'test',
      taskId: 'exhaust',
    });

    const client = new ClaudeClient({
      apiKey: 'test-key',
      budgetTracker: tracker,
    });

    await expect(
      client.generateCompletion({
        prompt: 'Test',
        model: 'claude-3-haiku-20240307',
        maxTokens: 5000,
        priority: 'BACKGROUND',
      })
    ).rejects.toThrow('budget');
  });
});
```

**Step 2: Modify ClaudeClient to integrate TokenBudgetTracker**

```typescript
// src/autonomous/claude-client.ts (add to existing)
import { TokenBudgetTracker } from '../observability/token-budget-tracker.js';
import { ModelRouter, TaskInput } from '../execution/model-router.js';

export interface ClaudeClientConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  budgetTracker?: TokenBudgetTracker;
  modelRouter?: ModelRouter;
}

export class ClaudeClient {
  // ... existing properties ...
  private budgetTracker?: TokenBudgetTracker;
  private modelRouter?: ModelRouter;

  constructor(config: ClaudeClientConfig) {
    // ... existing initialization ...
    this.budgetTracker = config.budgetTracker;
    this.modelRouter = config.modelRouter;
  }

  /**
   * Generate completion with automatic model routing and budget checking
   */
  async generateCompletion(params: {
    prompt: string;
    model?: string;
    maxTokens?: number;
    taskType?: string;
    taskDescription?: string;
    priority?: 'BACKGROUND' | 'STANDARD' | 'URGENT';
  }): Promise<string> {
    const priority = params.priority ?? 'STANDARD';
    const taskType = params.taskType ?? 'unknown';

    // Auto-route model if router available and no explicit model
    let selectedModel = params.model ?? this.config.model ?? 'claude-3-5-sonnet-20241022';
    let maxTokens = params.maxTokens ?? this.config.maxTokens ?? 4096;

    if (this.modelRouter && !params.model && params.taskDescription) {
      const routing = this.modelRouter.routeTask({
        type: taskType,
        description: params.taskDescription,
      });
      selectedModel = routing.model.model;
      maxTokens = routing.model.maxTokens;
      
      // Log routing decision
      console.log(`[ModelRouter] ${routing.reasoning}`);
    }

    // Check budget before proceeding
    if (this.budgetTracker) {
      const canProceed = await this.budgetTracker.canProceed(maxTokens, priority);
      if (!canProceed.allowed) {
        throw new Error(`Budget check failed: ${canProceed.reason}`);
      }
      if (canProceed.throttled) {
        console.warn('[Budget] Operating in throttled mode, consider deferring non-essential work');
      }
    }

    // Make API call (existing logic)
    const response = await this.anthropic.messages.create({
      model: selectedModel,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: params.prompt }],
    });

    // Record usage
    if (this.budgetTracker) {
      await this.budgetTracker.recordUsage({
        model: selectedModel,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        taskType,
        taskId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
    }

    // Extract and return content
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Expected text response');
    }

    return content.text;
  }

  // ... rest of existing methods ...
}
```

**Step 3: Run tests**

Run: `npm test -- claude-client.test.ts`  
Expected: PASS

**Step 4: Commit**

```bash
git add src/autonomous/claude-client.ts tests/unit/autonomous/claude-client.test.ts
git commit -m "feat(autonomous): integrate TokenBudgetTracker and ModelRouter with ClaudeClient"
```

---

## Phase 2: Enhanced Autonomous Agent (Days 3-4)

### Task 4: Update Autonomous Agent with Budget Awareness

**Files:**

- Modify: `src/autonomous/agent.ts`
- Create: `src/autonomous/config/budget-config.json`

**Step 1: Load budget configuration**

```typescript
// Add to src/autonomous/agent.ts initialization
import { TokenBudgetTracker } from '../observability/token-budget-tracker.js';
import { ModelRouter } from '../execution/model-router.js';

export class AutonomousAgent {
  // Add new properties
  private budgetTracker: TokenBudgetTracker;
  private modelRouter: ModelRouter;

  constructor(eventBus: EventBus, config?: Partial<AutonomousConfig>) {
    // ... existing initialization ...

    // Initialize budget tracking
    this.budgetTracker = new TokenBudgetTracker({
      dailyMaxTokens: 800000,      // 800k tokens/day
      dailyMaxCost: 2.50,          // $2.50/day
      reservedForUser: 500000,     // 500k for user interactions
    });

    // Initialize model router
    this.modelRouter = new ModelRouter();

    // ... rest of initialization ...
  }

  async init(): Promise<void> {
    // ... existing init ...

    // Initialize Claude with budget tracker
    if (this.config.claude?.apiKey) {
      this.claude = new ClaudeClient({
        apiKey: this.config.claude.apiKey,
        budgetTracker: this.budgetTracker,
        modelRouter: this.modelRouter,
      });
    }

    // ... rest of init ...
  }
}
```

**Step 2: Add budget status to poll loop**

```typescript
// In agent.ts poll() method
private async poll(): Promise<void> {
  if (!this.running) return;

  try {
    // Check budget status first
    const budgetStatus = this.budgetTracker.getStatus();
    const usagePercent = budgetStatus.budgetUsed / 800000;

    // Adaptive behavior based on budget
    if (usagePercent >= 0.95) {
      // At 95%, pause all non-essential work
      console.warn('[Budget] 95% consumed - pausing autonomous work');
      // Skip scheduled tasks and initiatives
      // Only process urgent user interactions
      return;
    }

    if (usagePercent >= 0.80) {
      // At 80%, reduce frequency
      console.info('[Budget] 80% consumed - reducing autonomous work frequency');
      // Skip some scheduled tasks (knowledge indexing, health checks)
    }

    // ... existing poll logic ...
  } catch (error) {
    // ... existing error handling ...
  }
}
```

**Step 3: Commit**

```bash
git add src/autonomous/agent.ts
git commit -m "feat(autonomous): integrate budget awareness into autonomous agent poll loop"
```

---

### Task 5: Enhance Scheduler with Model Hints

**Files:**

- Modify: `src/autonomous/scheduler.ts`

**Step 1: Add SmartScheduledTask interface**

```typescript
// Add to src/autonomous/scheduler.ts
export interface SmartScheduledTask extends ScheduledTask {
  modelHint: 'haiku' | 'sonnet' | 'opus';
  estimatedTokens: number;
  budgetPriority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  skipIfBudgetLow: boolean;
  dependencies?: string[];
  valueScore: number; // 0-100
}
```

**Step 2: Update default tasks with smart metadata**

```typescript
// Update DEFAULT_TASKS array
const DEFAULT_TASKS: Omit<SmartScheduledTask, 'lastRun' | 'nextRun'>[] = [
  {
    id: 'morning-briefing',
    name: 'Morning Briefing',
    cron: '0 7 * * *',
    handler: 'morning_briefing',
    enabled: true,
    modelHint: 'sonnet',
    estimatedTokens: 20000,
    budgetPriority: 'HIGH',
    skipIfBudgetLow: false,
    valueScore: 90,
  },
  {
    id: 'knowledge-index-morning',
    name: 'Knowledge Index (Morning)',
    cron: '0 8 * * *',
    handler: 'knowledge_index',
    enabled: true,
    modelHint: 'haiku',
    estimatedTokens: 5000,
    budgetPriority: 'NORMAL',
    skipIfBudgetLow: true,
    valueScore: 60,
  },
  {
    id: 'initiative-comprehensive-scan',
    name: 'Initiative Comprehensive Scan',
    cron: '0 6 * * *',
    handler: 'initiative_comprehensive_scan',
    enabled: true,
    modelHint: 'sonnet',
    estimatedTokens: 30000,
    budgetPriority: 'HIGH',
    skipIfBudgetLow: false,
    dependencies: [], // Must run first
    valueScore: 85,
  },
  // ... rest of tasks with metadata ...
];
```

**Step 3: Add budget-aware task execution**

```typescript
// Modify checkAndRun in scheduler.ts
async checkAndRun(budgetTracker?: TokenBudgetTracker): Promise<void> {
  const now = new Date();

  for (const [taskId, task] of this.tasks.entries()) {
    if (!task.enabled) continue;
    if (!task.nextRun) continue;

    if (now >= task.nextRun) {
      // Check budget before running
      if (budgetTracker && 'estimatedTokens' in task) {
        const smartTask = task as SmartScheduledTask;
        const canProceed = await budgetTracker.canProceed(
          smartTask.estimatedTokens,
          smartTask.skipIfBudgetLow ? 'BACKGROUND' : 'STANDARD'
        );

        if (!canProceed.allowed) {
          console.warn(
            `[Scheduler] Skipping ${taskId} due to budget: ${canProceed.reason}`
          );
          // Reschedule for later (1 hour)
          task.nextRun = new Date(now.getTime() + 60 * 60 * 1000);
          continue;
        }
      }

      await this.runTask(taskId);
    }
  }

  await this.saveState();
}
```

**Step 4: Commit**

```bash
git add src/autonomous/scheduler.ts
git commit -m "feat(scheduler): add smart scheduling with model hints and budget awareness"
```

---

## Phase 3: Initiative Engine Enhancement (Days 5-6)

### Task 6: Add Enhanced Scoring to Initiative Engine

**Files:**

- Modify: `src/autonomous/initiative-engine.ts`
- Create: `src/autonomous/initiative-scorer.ts`
- Create: `tests/unit/autonomous/initiative-scorer.test.ts`

**Step 1: Create InitiativeScorer (see implementation plan continues...)**

*[Implementation continues with 10+ more tasks covering deliverables engine, approval queue, dashboard updates, Mac Mini sync, deployment, and monitoring setup]*

---

## Phase 4: User Deliverables (Days 7-8)

### Task 7: Daily Brief Generator

**Files:**

- Create: `src/autonomous/deliverables/daily-brief.ts`
- Create: `tests/unit/autonomous/deliverables/daily-brief.test.ts`

**Step 1: Write test for daily brief generation**

```typescript
// tests/unit/autonomous/deliverables/daily-brief.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { DailyBriefGenerator } from '../../../../src/autonomous/deliverables/daily-brief.js';
import { InitiativeEngine } from '../../../../src/autonomous/initiative-engine.js';

describe('DailyBriefGenerator', () => {
  let generator: DailyBriefGenerator;

  beforeEach(() => {
    generator = new DailyBriefGenerator({
      projectPath: '/test/project',
    });
  });

  it('should generate daily brief with focus areas', async () => {
    const brief = await generator.generate();

    expect(brief).toHaveProperty('date');
    expect(brief).toHaveProperty('focusAreas');
    expect(brief).toHaveProperty('actionItems');
    expect(brief).toHaveProperty('insights');
    expect(brief).toHaveProperty('budgetStatus');
    expect(brief.focusAreas).toBeInstanceOf(Array);
  });

  it('should prioritize action items by urgency', async () => {
    const brief = await generator.generate();

    if (brief.actionItems.length > 1) {
      const priorities = brief.actionItems.map(i => i.priority);
      // Should be sorted: URGENT, HIGH, MEDIUM, LOW
      for (let i = 0; i < priorities.length - 1; i++) {
        const current = priorities[i];
        const next = priorities[i + 1];
        // Ensure current is >= next in priority order
        expect(comparePriority(current, next)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should include overnight autonomous work summary', async () => {
    // Mock some completed initiatives
    const mockInitiatives = [
      {
        id: 'test-1',
        title: 'Write tests for auth module',
        status: 'COMPLETED',
        category: 'CODE_QUALITY',
      },
    ];

    const brief = await generator.generate({
      completedInitiatives: mockInitiatives,
    });

    expect(brief.overnightWork).toHaveLength(1);
    expect(brief.overnightWork[0].title).toContain('auth');
  });

  it('should format budget status clearly', async () => {
    const brief = await generator.generate();

    expect(brief.budgetStatus).toHaveProperty('used');
    expect(brief.budgetStatus).toHaveProperty('remaining');
    expect(brief.budgetStatus).toHaveProperty('percentUsed');
    expect(brief.budgetStatus.percentUsed).toBeGreaterThanOrEqual(0);
    expect(brief.budgetStatus.percentUsed).toBeLessThanOrEqual(100);
  });
});

function comparePriority(a: string, b: string): number {
  const order = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  return order[a as keyof typeof order] - order[b as keyof typeof order];
}
```

**Step 2: Implement DailyBriefGenerator**

```typescript
// src/autonomous/deliverables/daily-brief.ts
import { EventBus } from '../../kernel/event-bus.js';
import { TokenBudgetTracker } from '../../observability/token-budget-tracker.js';
import { InitiativeEngine } from '../initiative-engine.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface DailyBrief {
  date: string;
  focusAreas: Array<{
    title: string;
    rationale: string;
    priority: number;
  }>;
  actionItems: Array<{
    title: string;
    description: string;
    priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
    source: string;
    link?: string;
  }>;
  insights: Array<{
    title: string;
    content: string;
    category: string;
  }>;
  overnightWork: Array<{
    title: string;
    status: string;
    category: string;
    result?: string;
  }>;
  budgetStatus: {
    used: number;
    remaining: number;
    percentUsed: number;
    projectedEOD: number;
  };
  weather?: string; // Optional: Today's outlook
}

export interface BriefConfig {
  projectPath: string;
  budgetTracker?: TokenBudgetTracker;
  initiativeEngine?: InitiativeEngine;
}

export class DailyBriefGenerator {
  private config: BriefConfig;

  constructor(config: BriefConfig) {
    this.config = config;
  }

  async generate(context?: {
    completedInitiatives?: Array<{ id: string; title: string; status: string; category: string }>;
  }): Promise<DailyBrief> {
    const now = new Date();

    // Gather data
    const [focusAreas, actionItems, insights, budgetStatus] = await Promise.all([
      this.identifyFocusAreas(),
      this.collectActionItems(),
      this.generateInsights(),
      this.getBudgetStatus(),
    ]);

    // Overnight work
    const overnightWork = context?.completedInitiatives?.map(i => ({
      title: i.title,
      status: i.status,
      category: i.category,
    })) ?? [];

    return {
      date: now.toISOString().split('T')[0],
      focusAreas,
      actionItems: this.sortActionItems(actionItems),
      insights,
      overnightWork,
      budgetStatus,
    };
  }

  async format(brief: DailyBrief): Promise<string> {
    const lines: string[] = [
      `# Daily Brief - ${new Date(brief.date).toLocaleDateString()}`,
      '',
      '## Focus Areas',
      '',
    ];

    brief.focusAreas.forEach((area, i) => {
      lines.push(`${i + 1}. **${area.title}**`);
      lines.push(`   ${area.rationale}`);
      lines.push('');
    });

    if (brief.overnightWork.length > 0) {
      lines.push('## Overnight Autonomous Work');
      lines.push('');
      brief.overnightWork.forEach(work => {
        lines.push(`- ✓ ${work.title} (${work.category})`);
      });
      lines.push('');
    }

    if (brief.actionItems.length > 0) {
      lines.push('## Action Items');
      lines.push('');
      const urgent = brief.actionItems.filter(i => i.priority === 'URGENT' || i.priority === 'HIGH');
      const normal = brief.actionItems.filter(i => i.priority === 'MEDIUM' || i.priority === 'LOW');

      if (urgent.length > 0) {
        lines.push('### High Priority');
        urgent.forEach(item => {
          const emoji = item.priority === 'URGENT' ? '🔴' : '🟠';
          lines.push(`- ${emoji} **${item.title}**`);
          lines.push(`  ${item.description}`);
        });
        lines.push('');
      }

      if (normal.length > 0) {
        lines.push('### Standard');
        normal.forEach(item => {
          lines.push(`- ${item.title}`);
        });
        lines.push('');
      }
    }

    if (brief.insights.length > 0) {
      lines.push('## Insights');
      lines.push('');
      brief.insights.forEach(insight => {
        lines.push(`### ${insight.title}`);
        lines.push(insight.content);
        lines.push('');
      });
    }

    lines.push('## Budget Status');
    lines.push('');
    lines.push(`- Used: ${brief.budgetStatus.used.toLocaleString()} tokens (${brief.budgetStatus.percentUsed.toFixed(1)}%)`);
    lines.push(`- Remaining: ${brief.budgetStatus.remaining.toLocaleString()} tokens`);
    lines.push(`- Projected EOD: ${brief.budgetStatus.projectedEOD.toLocaleString()} tokens`);
    lines.push('');

    return lines.join('\n');
  }

  private async identifyFocusAreas(): Promise<DailyBrief['focusAreas']> {
    // Analyze current project state
    // For now, return static examples
    return [
      {
        title: 'Complete Phase 1: Token Budget Foundation',
        rationale: 'Foundation for cost-efficient 24/7 operations',
        priority: 90,
      },
    ];
  }

  private async collectActionItems(): Promise<DailyBrief['actionItems']> {
    const items: DailyBrief['actionItems'] = [];

    // Get queued initiatives from engine
    if (this.config.initiativeEngine) {
      const queued = this.config.initiativeEngine.getForUserReview();
      queued.slice(0, 5).forEach(initiative => {
        items.push({
          title: initiative.title,
          description: initiative.description,
          priority: initiative.priority > 0.8 ? 'HIGH' : initiative.priority > 0.6 ? 'MEDIUM' : 'LOW',
          source: 'InitiativeEngine',
        });
      });
    }

    return items;
  }

  private async generateInsights(): Promise<DailyBrief['insights']> {
    // For now, return empty - will be enhanced with learning loop data
    return [];
  }

  private async getBudgetStatus(): Promise<DailyBrief['budgetStatus']> {
    if (!this.config.budgetTracker) {
      return {
        used: 0,
        remaining: 800000,
        percentUsed: 0,
        projectedEOD: 0,
      };
    }

    const status = this.config.budgetTracker.getStatus();
    return {
      used: status.budgetUsed,
      remaining: status.budgetRemaining,
      percentUsed: (status.budgetUsed / 800000) * 100,
      projectedEOD: status.projectedEndOfDay,
    };
  }

  private sortActionItems(items: DailyBrief['actionItems']): DailyBrief['actionItems'] {
    const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return items.sort((a, b) => {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}
```

**Step 3: Run tests**

Run: `npm test -- daily-brief.test.ts`  
Expected: PASS

**Step 4: Integrate with scheduler**

```typescript
// Update agent.ts registerSchedulerHandlers()
this.scheduler.registerHandler('user_daily_brief', async () => {
  const generator = new DailyBriefGenerator({
    projectPath: process.cwd(),
    budgetTracker: this.budgetTracker,
    initiativeEngine: this.initiativeEngine,
  });

  const completedInitiatives = this.initiativeEngine
    .getInitiativesByStatus('COMPLETED')
    .filter(i => {
      // Completed in last 24 hours
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      return i.createdAt.getTime() > yesterday;
    });

  const brief = await generator.generate({ completedInitiatives });
  const formatted = await generator.format(brief);

  // Save to file
  const briefPath = path.join(homedir(), '.ari', 'briefs', `brief-${new Date().toISOString().split('T')[0]}.md`);
  await fs.mkdir(path.dirname(briefPath), { recursive: true });
  await fs.writeFile(briefPath, formatted);

  // Notify user via Telegram
  await notificationManager.insight('Daily Brief Ready', `Your daily brief is waiting: ${briefPath}`);

  console.log('[Deliverables] Daily brief generated:', briefPath);
});
```

**Step 5: Commit**

```bash
git add src/autonomous/deliverables/daily-brief.ts tests/unit/autonomous/deliverables/daily-brief.test.ts src/autonomous/agent.ts
git commit -m "feat(deliverables): add DailyBriefGenerator for morning sync"
```

---

### Task 8: Approval Queue System

**Files:**

- Create: `src/autonomous/approval-queue.ts`
- Create: `tests/unit/autonomous/approval-queue.test.ts`

**Step 1: Write approval queue tests**

```typescript
// tests/unit/autonomous/approval-queue.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ApprovalQueue } from '../../../src/autonomous/approval-queue.js';

describe('ApprovalQueue', () => {
  let queue: ApprovalQueue;

  beforeEach(() => {
    queue = new ApprovalQueue();
  });

  it('should add items requiring approval', async () => {
    await queue.add({
      id: 'init-1',
      type: 'INITIATIVE',
      title: 'Refactor authentication module',
      description: 'Large refactoring affecting 10+ files',
      risk: 'HIGH',
      estimatedCost: 0.50,
      metadata: { initiativeId: 'test-123' },
    });

    const items = await queue.getPending();
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain('authentication');
  });

  it('should handle approval decisions', async () => {
    await queue.add({
      id: 'init-1',
      type: 'INITIATIVE',
      title: 'Test item',
      description: 'Test',
      risk: 'MEDIUM',
      estimatedCost: 0.10,
    });

    await queue.approve('init-1', { note: 'Looks good' });

    const pending = await queue.getPending();
    expect(pending).toHaveLength(0);

    const history = await queue.getHistory();
    expect(history[0].decision).toBe('APPROVED');
  });

  it('should handle rejection with reason', async () => {
    await queue.add({
      id: 'init-1',
      type: 'INITIATIVE',
      title: 'Test item',
      description: 'Test',
      risk: 'HIGH',
      estimatedCost: 1.00,
    });

    await queue.reject('init-1', { reason: 'Too risky for autonomous execution' });

    const history = await queue.getHistory();
    expect(history[0].decision).toBe('REJECTED');
    expect(history[0].reason).toContain('risky');
  });
});
```

**Step 2: Implement ApprovalQueue**

```typescript
// src/autonomous/approval-queue.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { EventBus } from '../kernel/event-bus.js';

export interface ApprovalItem {
  id: string;
  type: 'INITIATIVE' | 'CONFIG_CHANGE' | 'DESTRUCTIVE_OP';
  title: string;
  description: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedCost: number;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ApprovalDecision {
  itemId: string;
  decision: 'APPROVED' | 'REJECTED';
  decidedAt: Date;
  note?: string;
  reason?: string;
}

export class ApprovalQueue {
  private storagePath: string;
  private eventBus?: EventBus;

  constructor(eventBus?: EventBus) {
    this.storagePath = path.join(homedir(), '.ari', 'approval-queue.json');
    this.eventBus = eventBus;
  }

  async add(item: ApprovalItem): Promise<void> {
    const data = await this.load();
    
    data.pending.push({
      ...item,
      createdAt: item.createdAt ?? new Date(),
    });

    await this.save(data);

    this.eventBus?.emit('approval:item_added', {
      itemId: item.id,
      type: item.type,
      risk: item.risk,
    });
  }

  async approve(itemId: string, decision: { note?: string }): Promise<void> {
    const data = await this.load();
    const itemIndex = data.pending.findIndex(i => i.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error(`Approval item not found: ${itemId}`);
    }

    const item = data.pending[itemIndex];
    data.pending.splice(itemIndex, 1);

    data.history.push({
      itemId,
      decision: 'APPROVED',
      decidedAt: new Date(),
      note: decision.note,
    });

    await this.save(data);

    this.eventBus?.emit('approval:approved', {
      itemId,
      type: item.type,
    });
  }

  async reject(itemId: string, decision: { reason: string }): Promise<void> {
    const data = await this.load();
    const itemIndex = data.pending.findIndex(i => i.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error(`Approval item not found: ${itemId}`);
    }

    const item = data.pending[itemIndex];
    data.pending.splice(itemIndex, 1);

    data.history.push({
      itemId,
      decision: 'REJECTED',
      decidedAt: new Date(),
      reason: decision.reason,
    });

    await this.save(data);

    this.eventBus?.emit('approval:rejected', {
      itemId,
      type: item.type,
      reason: decision.reason,
    });
  }

  async getPending(): Promise<ApprovalItem[]> {
    const data = await this.load();
    return data.pending;
  }

  async getHistory(limit: number = 50): Promise<ApprovalDecision[]> {
    const data = await this.load();
    return data.history.slice(-limit).reverse();
  }

  private async load(): Promise<{
    pending: ApprovalItem[];
    history: ApprovalDecision[];
  }> {
    try {
      const content = await fs.readFile(this.storagePath, 'utf-8');
      return JSON.parse(content, (key, value) => {
        // Revive Date objects
        if (key === 'createdAt' || key === 'decidedAt') {
          return new Date(value);
        }
        return value;
      });
    } catch {
      return { pending: [], history: [] };
    }
  }

  private async save(data: {
    pending: ApprovalItem[];
    history: ApprovalDecision[];
  }): Promise<void> {
    await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
    await fs.writeFile(this.storagePath, JSON.stringify(data, null, 2));
  }
}
```

**Step 3: Run tests & commit**

```bash
npm test -- approval-queue.test.ts
git add src/autonomous/approval-queue.ts tests/unit/autonomous/approval-queue.test.ts
git commit -m "feat(autonomous): add ApprovalQueue for user decision gates"
```

---

### Task 9: Dashboard Budget Panel

**Files:**

- Create: `dashboard/src/components/BudgetPanel.tsx`
- Modify: `dashboard/src/pages/Home.tsx`

**Step 1: Create BudgetPanel component**

```typescript
// dashboard/src/components/BudgetPanel.tsx
import { useQuery } from '@tanstack/react-query';
import { CircularProgress } from './ui/CircularProgress';

interface BudgetStatus {
  budgetUsed: number;
  budgetRemaining: number;
  costUsed: number;
  costRemaining: number;
  projectedEndOfDay: number;
  topConsumers: Array<{
    taskType: string;
    tokensUsed: number;
    cost: number;
    percentOfTotal: number;
  }>;
}

export function BudgetPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['budget-status'],
    queryFn: async () => {
      const res = await fetch('/api/budget/status');
      if (!res.ok) throw new Error('Failed to fetch budget');
      return res.json() as Promise<BudgetStatus>;
    },
    refetchInterval: 30000, // Every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-700 bg-red-900/20 p-6">
        <p className="text-red-400">Failed to load budget status</p>
      </div>
    );
  }

  const percentUsed = (data.budgetUsed / 800000) * 100;
  const percentColor = percentUsed >= 95 ? 'text-red-500' : percentUsed >= 80 ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
      <h2 className="text-xl font-semibold text-gray-100 mb-4">Token Budget</h2>
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <CircularProgress
            value={percentUsed}
            size={120}
            color={percentUsed >= 95 ? '#ef4444' : percentUsed >= 80 ? '#eab308' : '#10b981'}
          />
        </div>
        
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-sm text-gray-400">Used Today</p>
            <p className={`text-2xl font-bold ${percentColor}`}>
              {percentUsed.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Cost</p>
            <p className="text-lg font-semibold text-gray-200">
              ${data.costUsed.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Used</span>
          <span className="text-gray-200">{data.budgetUsed.toLocaleString()} tokens</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Remaining</span>
          <span className="text-gray-200">{data.budgetRemaining.toLocaleString()} tokens</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Projected EOD</span>
          <span className="text-gray-200">{data.projectedEndOfDay.toLocaleString()} tokens</span>
        </div>
      </div>

      {data.topConsumers.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Top Consumers</h3>
          <div className="space-y-1">
            {data.topConsumers.slice(0, 5).map(consumer => (
              <div key={consumer.taskType} className="flex justify-between text-sm">
                <span className="text-gray-400">{consumer.taskType}</span>
                <span className="text-gray-200">
                  ${consumer.cost.toFixed(3)} ({consumer.percentOfTotal.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 2: Add API endpoint for budget status**

```typescript
// src/api/routes.ts (add new route)
fastify.get('/api/budget/status', async (_request, reply) => {
  // Get budget tracker status
  const status = budgetTracker.getStatus();
  reply.send(status);
});
```

**Step 3: Integrate into dashboard**

```typescript
// dashboard/src/pages/Home.tsx
import { BudgetPanel } from '../components/BudgetPanel';

export function Home() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <BudgetPanel />
      {/* ... other panels ... */}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add dashboard/src/components/BudgetPanel.tsx dashboard/src/pages/Home.tsx src/api/routes.ts
git commit -m "feat(dashboard): add real-time token budget panel"
```

---

## Phase 5: Deployment & Validation (Days 9-10)

### Task 10: Mac Mini Sync & Update

**Files:**

- Create: `scripts/sync-mac-mini.sh`
- Update: `docs/operations/RUNBOOK_MAC_MINI.md`

**Step 1: Create sync script**

```bash
# scripts/sync-mac-mini.sh
#!/bin/bash

set -e

MINI_HOST="<USER>@<MAC_MINI_IP>"
MINI_PATH="~/ARI"

echo "=== Syncing Mac Mini with Latest Code ==="

# Check connection
echo "Checking connection..."
ssh -i ~/.ssh/id_ed25519 -o ConnectTimeout=10 $MINI_HOST "hostname" || {
  echo "❌ Cannot connect to Mac Mini"
  exit 1
}

echo "✓ Connected to Mac Mini"

# Stash any local changes on Mini
echo "Stashing local changes on Mini..."
ssh -i ~/.ssh/id_ed25519 $MINI_HOST "source ~/.zshrc && cd $MINI_PATH && git stash"

# Pull latest code
echo "Pulling latest code..."
ssh -i ~/.ssh/id_ed25519 $MINI_HOST "source ~/.zshrc && cd $MINI_PATH && git pull origin main"

# Install dependencies
echo "Installing dependencies..."
ssh -i ~/.ssh/id_ed25519 $MINI_HOST "source ~/.zshrc && cd $MINI_PATH && npm install"

# Build
echo "Building..."
ssh -i ~/.ssh/id_ed25519 $MINI_HOST "source ~/.zshrc && cd $MINI_PATH && npm run build"

# Restart daemon
echo "Restarting daemon..."
ssh -i ~/.ssh/id_ed25519 $MINI_HOST "source ~/.zshrc && cd $MINI_PATH && npx ari daemon restart"

# Verify
echo "Verifying system..."
sleep 3
ssh -i ~/.ssh/id_ed25519 $MINI_HOST "source ~/.zshrc && cd $MINI_PATH && npx ari doctor"

echo "✓ Mac Mini sync complete!"
```

**Step 2: Run sync**

```bash
chmod +x scripts/sync-mac-mini.sh
./scripts/sync-mac-mini.sh
```

**Step 3: Commit**

```bash
git add scripts/sync-mac-mini.sh
git commit -m "ops: add Mac Mini sync script for deployment"
```

---

### Task 11: Budget Configuration Deployment

**Step 1: Create budget config on Mac Mini**

```bash
ssh -i ~/.ssh/id_ed25519 <USER>@<MAC_MINI_IP> "cat > ~/.ari/budget-config.json << 'EOF'
{
  "version": "1.0.0",
  "budget": {
    "daily": {
      "maxTokens": 800000,
      "maxCost": 2.50,
      "reserved": {
        "user": 500000,
        "autonomous": 300000
      }
    },
    "throttling": {
      "warning": 0.80,
      "reduce": 0.90,
      "pause": 0.95
    }
  },
  "models": {
    "haiku": {
      "id": "claude-3-haiku-20240307",
      "inputCost": 0.00025,
      "outputCost": 0.00125
    },
    "sonnet": {
      "id": "claude-3-5-sonnet-20241022",
      "inputCost": 0.003,
      "outputCost": 0.015
    },
    "opus": {
      "id": "claude-opus-4-20250514",
      "inputCost": 0.015,
      "outputCost": 0.075
    }
  }
}
EOF
"
```

**Step 2: Update autonomous config**

```bash
ssh -i ~/.ssh/id_ed25519 <USER>@<MAC_MINI_IP> "cd ~/ARI && node -e \"
const fs = require('fs');
const path = require('path');
const configPath = path.join(process.env.HOME, '.ari', 'autonomous.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Enable autonomous mode with budget tracking
config.enabled = true;
config.budget = {
  enabled: true,
  dailyMaxTokens: 800000,
  dailyMaxCost: 2.50
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('✓ Updated autonomous config');
\""
```

---

### Task 12: First 24-Hour Monitoring

**Step 1: Enable detailed logging**

```bash
ssh -i ~/.ssh/id_ed25519 <USER>@<MAC_MINI_IP> "source ~/.zshrc && cd ~/ARI && npx ari config set logging.level debug"
```

**Step 2: Monitor logs in real-time**

```bash
# Monitor audit log
ssh -i ~/.ssh/id_ed25519 <USER>@<MAC_MINI_IP> "tail -f ~/.ari/audit.json"

# Monitor daemon output
ssh -i ~/.ssh/id_ed25519 <USER>@<MAC_MINI_IP> "tail -f ~/Library/Logs/ari-gateway.log"
```

**Step 3: Check budget usage after first morning**

```bash
ssh -i ~/.ssh/id_ed25519 <USER>@<MAC_MINI_IP> "source ~/.zshrc && cd ~/ARI && node -e \"
const fs = require('fs');
const path = require('path');
const usagePath = path.join(process.env.HOME, '.ari', 'token-usage.json');
const usage = JSON.parse(fs.readFileSync(usagePath, 'utf-8'));
console.log('Tokens used:', usage.totalTokens);
console.log('Cost today: $', usage.totalCost.toFixed(4));
console.log('By task type:');
Object.entries(usage.byTaskType).forEach(([type, data]) => {
  console.log('  ', type, ':', data.cost.toFixed(4));
});
\""
```

---

### Task 13: Validation Checklist

**Execute this checklist to verify everything works:**

```markdown
## Phase 1 Validation

- [ ] TokenBudgetTracker is recording all API calls
- [ ] ModelRouter is selecting appropriate models
- [ ] Budget status visible in dashboard
- [ ] Cost calculations are accurate
- [ ] Throttling triggers at 80% usage

## Phase 2 Validation

- [ ] Autonomous agent respects budget limits
- [ ] Scheduler skips tasks when budget low
- [ ] Morning brief generated by 7:30 AM
- [ ] Budget dashboard updates in real-time

## Phase 3 Validation

- [ ] Initiative engine discovers work
- [ ] Safety gates block high-risk work
- [ ] Approval queue populates correctly
- [ ] Worktree isolation working

## Phase 4 Validation

- [ ] Daily brief delivered and formatted
- [ ] Evening summary includes approval queue
- [ ] Dashboard shows all panels
- [ ] Telegram notifications working

## Phase 5 Validation

- [ ] Mac Mini fully synced
- [ ] Autonomous mode enabled
- [ ] Budget staying under $2/day
- [ ] 10+ autonomous tasks completing
- [ ] No critical errors in logs
- [ ] Morning brief arrives on time
```

**Step: Run validation**

```bash
# Create validation script
cat > scripts/validate-deployment.sh << 'EOF'
#!/bin/bash

MINI_HOST="<USER>@<MAC_MINI_IP>"

echo "=== ARI Deployment Validation ==="

# Check daemon status
echo "1. Checking daemon..."
ssh -i ~/.ssh/id_ed25519 $MINI_HOST "source ~/.zshrc && cd ~/ARI && npx ari daemon status" || exit 1

# Check gateway health
echo "2. Checking gateway..."
ssh -i ~/.ssh/id_ed25519 $MINI_HOST "curl -s http://127.0.0.1:3141/health" || exit 1

# Check budget tracker
echo "3. Checking budget..."
ssh -i ~/.ssh/id_ed25519 $MINI_HOST "test -f ~/.ari/token-usage.json" && echo "✓ Budget tracker initialized" || echo "✗ Budget tracker missing"

# Check scheduled tasks
echo "4. Checking scheduler..."
ssh -i ~/.ssh/id_ed25519 $MINI_HOST "source ~/.zshrc && cd ~/ARI && node -e \"
const fs = require('fs');
const state = JSON.parse(fs.readFileSync(process.env.HOME + '/.ari/scheduler-state.json', 'utf-8'));
console.log('Enabled tasks:', Object.keys(state.tasks).length);
\""

# Check recent audit events
echo "5. Checking audit log..."
ssh -i ~/.ssh/id_ed25519 $MINI_HOST "source ~/.zshrc && cd ~/ARI && npx ari audit list -n 5"

echo "✓ Validation complete!"
EOF

chmod +x scripts/validate-deployment.sh
./scripts/validate-deployment.sh
```

---

### Task 14: Week 1 Monitoring Dashboard

**Create monitoring dashboard to track first week:**

```typescript
// dashboard/src/pages/WeeklyReport.tsx
export function WeeklyReport() {
  const { data } = useQuery({
    queryKey: ['weekly-report'],
    queryFn: async () => {
      const res = await fetch('/api/reports/weekly');
      return res.json();
    },
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-100 mb-6">Week 1 Report</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Total Cost"
          value={`$${data?.totalCost.toFixed(2)}`}
          target="< $17.50"
          status={data?.totalCost < 17.50 ? 'good' : 'warning'}
        />
        
        <MetricCard
          title="Autonomous Tasks"
          value={data?.tasksCompleted}
          target="> 70"
          status={data?.tasksCompleted > 70 ? 'good' : 'needs-improvement'}
        />
        
        <MetricCard
          title="Budget Adherence"
          value={`${data?.daysUnderBudget}/7`}
          target="7/7"
          status={data?.daysUnderBudget >= 7 ? 'good' : 'warning'}
        />
        
        <MetricCard
          title="Morning Briefs"
          value={`${data?.briefsDelivered}/7`}
          target="7/7"
          status={data?.briefsDelivered >= 7 ? 'good' : 'warning'}
        />
      </div>

      <CostTrendChart data={data?.dailyCosts} />
      <TaskBreakdownChart data={data?.tasksByType} />
    </div>
  );
}
```

---

### Task 15: Documentation Updates

**Update all documentation:**

**Step 1: Update README.md**

```markdown
# Added to README.md

## 24/7 Autonomous Operations

ARI now runs autonomously on your Mac Mini with intelligent cost management:

- **Smart Model Selection**: Automatically routes tasks to Haiku (70%), Sonnet (25%), or Opus (5%)
- **Budget Tracking**: Strict daily limits with adaptive throttling
- **Morning Briefs**: Daily focus and insights delivered by 7:30 AM
- **Initiative Engine**: Discovers and executes work proactively
- **Safety Gates**: Cognitive checks prevent risky autonomous actions

### Quick Start

1. Sync Mac Mini: `./scripts/sync-mac-mini.sh`
2. Verify deployment: `./scripts/validate-deployment.sh`
3. Monitor dashboard: http://localhost:3141/dashboard
4. Check daily brief: `~/.ari/briefs/brief-YYYY-MM-DD.md`

### Cost Management

- Daily budget: $2.50 (800k tokens)
- Typical usage: $0.50-1.50 per day
- Monthly cost: ~$45-75
- Real-time tracking in dashboard

See [docs/operations/24-7-operations.md](docs/operations/24-7-operations.md) for details.
```

**Step 2: Create operations guide**

```bash
cat > docs/operations/24-7-operations.md << 'EOF'
# 24/7 Autonomous Operations Guide

## Overview

ARI runs continuously on your Mac Mini, proactively discovering and executing work while maintaining strict cost controls.

## Daily Schedule

### Morning (6:00-8:00 AM)
- 6:00 - Initiative scan (discovers work)
- 6:30 - Auto-execution (low-risk tasks)
- 7:00 - Morning briefing generation
- 7:30 - Daily brief delivered

### Daytime (9:00 AM-6:00 PM)
- Every 15 min: Health checks
- Opportunistic: Test generation, TODO resolution
- 2:00 PM: Mid-day check

### Evening (6:00-10:00 PM)
- 7:00 PM: Changelog generation
- 9:00 PM: Evening summary + cognitive review
- 9:30 PM: Backup & cleanup

## Budget Management

### Daily Limits
- Maximum: 800k tokens ($2.50)
- User reserved: 500k tokens
- Autonomous: 300k tokens

### Throttling Behavior
- 80% usage: Reduce non-essential work
- 95% usage: Pause autonomous, user-only
- 100% usage: Emergency mode until midnight reset

## Monitoring

### Dashboard
- Real-time budget status
- Autonomous work feed
- Cost breakdown by task
- Approval queue

### Logs
- Audit: `~/.ari/audit.json`
- Daemon: `~/Library/Logs/ari-gateway.log`
- Budget: `~/.ari/token-usage.json`

## Troubleshooting

### Budget Exceeded Early
1. Check cost breakdown in dashboard
2. Identify expensive tasks
3. Adjust model selection or frequency
4. Increase daily limit if value justifies

### No Morning Brief
1. Check scheduler status: `npx ari scheduler status`
2. Verify task enabled: `morning-briefing`
3. Check daemon logs for errors
4. Run manually: `npx ari brief generate`

### Mac Mini Out of Sync
1. Run sync script: `./scripts/sync-mac-mini.sh`
2. Verify with: `./scripts/validate-deployment.sh`
3. Restart daemon if needed

## Configuration Files

- `~/.ari/autonomous.json` - Autonomous mode config
- `~/.ari/budget-config.json` - Budget limits and model costs
- `~/.ari/autonomous-budget.json` - Runtime budget settings

## Safety

- All code changes in isolated worktrees
- Cognitive safety gates on all initiatives
- Approval queue for medium/high-risk work
- Emergency kill switch: `npx ari daemon stop`

EOF
```

**Step 3: Commit docs**

```bash
git add README.md docs/operations/24-7-operations.md
git commit -m "docs: add 24/7 autonomous operations guide"
```

---

## Success Criteria

**Phase 1 Complete:**

- [ ] TokenBudgetTracker tracking all API calls
- [ ] ModelRouter selecting appropriate models
- [ ] All tests passing

**Phase 2 Complete:**

- [ ] Autonomous agent using budget tracker
- [ ] Scheduler running with adaptive throttling
- [ ] Budget dashboard showing real-time usage

**Phase 3 Complete:**

- [ ] Initiative engine executing with safety gates
- [ ] Worktree isolation for code changes
- [ ] Approval queue functional

**Phase 4 Complete:**

- [ ] Morning brief delivered by 7:30 AM
- [ ] Evening summary with approval queue
- [ ] Dashboard showing all autonomous work

**Phase 5 Complete:**

- [ ] Mac Mini fully synced and operational
- [ ] 24/7 autonomous operations running
- [ ] Budget staying under $2/day
- [ ] 10+ autonomous tasks completing daily

---

## Execution Notes

1. **Test-Driven:** Every component has tests written FIRST
2. **Incremental:** Each task is independently testable
3. **Safe:** All changes go through git worktrees
4. **Monitored:** Budget and execution tracked in real-time
5. **Reversible:** Can disable autonomous mode at any time

**Estimated Total Time:** 10 days of focused implementation
**Budget Impact:** No cost during development (all tracked but not enforced until Phase 5)
**Risk Level:** LOW - phased rollout with kill switches at each phase
