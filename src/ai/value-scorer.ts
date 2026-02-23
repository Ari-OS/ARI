import fs from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import type { EventBus } from '../kernel/event-bus.js';
import type { ThrottleLevel } from '../observability/cost-tracker.js';
import type { CircuitBreaker } from './circuit-breaker.js';
import { ModelRegistry } from './model-registry.js';
import type { PerformanceTracker } from './performance-tracker.js';
import type {
  ModelTier,
  TaskCategory,
  TaskComplexity,
  ValueScoreInput,
  ValueScoreResult,
} from './types.js';

interface WeightSet {
  quality: number;
  cost: number;
  speed: number;
}

const COMPLEXITY_TO_NUMERIC: Record<TaskComplexity, number> = {
  trivial: 0,
  simple: 2,
  standard: 4,
  complex: 6,
  critical: 8,
};

const BUDGET_STATE_WEIGHTS: Record<ThrottleLevel, WeightSet> = {
  normal: { quality: 0.4, cost: 0.2, speed: 0.15 },
  warning: { quality: 0.35, cost: 0.3, speed: 0.1 },
  reduce: { quality: 0.25, cost: 0.4, speed: 0.1 },
  pause: { quality: 0.15, cost: 0.5, speed: 0.1 },
};

/**
 * Reinforcement Learning State for Q-Learning model selection.
 */
interface RLState {
  qTable: Record<string, Record<ModelTier, number>>; // Category -> Model -> Q-Value
  visits: Record<string, Record<ModelTier, number>>;
}

export class ValueScorer {
  private readonly eventBus: EventBus;
  private readonly registry: ModelRegistry;
  private readonly performanceTracker: PerformanceTracker | null;
  private readonly circuitBreaker: CircuitBreaker | null;

  // RL state
  private rlState: RLState = { qTable: {}, visits: {} };
  private readonly RL_STATE_PATH =
    process.env.NODE_ENV === 'test'
      ? path.join(tmpdir(), `rl_router_state_${Date.now()}.json`)
      : path.join(homedir(), '.ari', 'rl_router_state.json');
  private readonly ALPHA = 0.1; // Learning rate
  private readonly GAMMA = 0.9; // Discount factor
  private readonly EPSILON = 0.1; // Exploration rate

  constructor(
    eventBus: EventBus,
    registry: ModelRegistry,
    options?: {
      performanceTracker?: PerformanceTracker;
      circuitBreaker?: CircuitBreaker;
    },
  ) {
    this.eventBus = eventBus;
    this.registry = registry;
    this.performanceTracker = options?.performanceTracker ?? null;
    this.circuitBreaker = options?.circuitBreaker ?? null;

    this.loadRLState();
    this.setupRLListeners();
  }

  private loadRLState() {
    try {
      if (fs.existsSync(this.RL_STATE_PATH)) {
        const data = fs.readFileSync(this.RL_STATE_PATH, 'utf-8');
        this.rlState = JSON.parse(data) as RLState;
      }
    } catch {
      // Start fresh if no state exists
    }
  }

  private saveRLState() {
    try {
      const dir = path.dirname(this.RL_STATE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.RL_STATE_PATH, JSON.stringify(this.rlState, null, 2));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[ValueScorer] Failed to save RL state:', e);
    }
  }

  private setupRLListeners() {
    // Listen for model task completions to update Q-values (Reward function)
    this.eventBus.on('llm:request_complete', (payload: unknown) => {
      const p = payload as {
        model: string;
        taskCategory: string;
        success: boolean;
        duration: number;
        cost: number;
        qualityScore?: number;
      };
      const { model, taskCategory, success, duration, cost, qualityScore = 1.0 } = p;
      if (!taskCategory) return;

      // Calculate reward: success gives positive, failure gives negative.
      // Speed and cost efficiency boost the reward slightly.
      let reward = success ? qualityScore * 10 : -10;
      if (success) {
        const costEfficiency = Math.max(0, 1 - cost / 0.05); // Reward low cost
        const speedEfficiency = Math.max(0, 1 - duration / 10000); // Reward fast duration
        reward += costEfficiency * 2 + speedEfficiency * 2;
      }

      this.updateQValue(taskCategory, model, reward);
    });
  }

  private updateQValue(category: string, model: ModelTier, reward: number) {
    if (!this.rlState.qTable[category]) {
      this.rlState.qTable[category] = {} as Record<ModelTier, number>;
      this.rlState.visits[category] = {} as Record<ModelTier, number>;
    }

    const currentQ = this.rlState.qTable[category][model] || 0;
    const visits = this.rlState.visits[category][model] || 0;

    // Q-learning update rule (simplified single-step bandit)
    this.rlState.qTable[category][model] = currentQ + this.ALPHA * (reward - currentQ);
    this.rlState.visits[category][model] = visits + 1;

    this.saveRLState();
  }

  score(input: ValueScoreInput, budgetState: ThrottleLevel): ValueScoreResult {
    const complexityScore = COMPLEXITY_TO_NUMERIC[input.complexity];
    const budgetAdjustment = 10 - input.budgetPressure;

    const rawScore =
      complexityScore * 0.35 +
      input.stakes * 0.25 +
      input.qualityPriority * 0.2 +
      budgetAdjustment * 0.1 +
      input.historicalPerformance * 0.1;

    const normalizedScore = Math.min(100, Math.max(0, (rawScore / 10) * 100));

    const recommendedTier = this.selectModelForScore(
      normalizedScore,
      budgetState,
      input.category,
      input.securitySensitive,
      input.agent,
      input.contentLength,
    );

    const weights = this.getWeightsForBudgetState(budgetState);
    const reasoning = this.buildReasoning(input, budgetState, normalizedScore, recommendedTier);

    return {
      score: normalizedScore,
      recommendedTier,
      weights,
      reasoning,
    };
  }

  classifyComplexity(content: string, category: TaskCategory): TaskComplexity {
    if (category === 'heartbeat' || category === 'parse_command') {
      return 'trivial';
    }

    const lowerContent = content.toLowerCase();
    let score = 0;

    const securityPatterns = [
      'auth',
      'credential',
      'secret',
      'encryption',
      'vulnerability',
      'injection',
      'xss',
      'csrf',
    ];
    if (securityPatterns.some((p) => lowerContent.includes(p))) score += 3;

    const reasoningPatterns = ['why', 'explain', 'analyze', 'compare', 'evaluate', 'tradeoff'];
    if (reasoningPatterns.some((p) => lowerContent.includes(p))) score += 2;

    const codeGenPatterns = ['implement', 'refactor', 'class', 'method', 'function'];
    if (codeGenPatterns.some((p) => lowerContent.includes(p))) score += 2;

    const creativityPatterns = ['design', 'architect', 'brainstorm', 'novel', 'innovative'];
    if (creativityPatterns.some((p) => lowerContent.includes(p))) score += 1.5;

    const hasMultiStep = ['first', 'then', 'next', 'finally'].some((p) => lowerContent.includes(p));
    const hasNumberedSteps = /\d+\.\s/.test(content);
    if (hasMultiStep || hasNumberedSteps) score += 1;

    const estimatedTokens = content.length / 4;
    if (estimatedTokens > 2000) score += 1;
    if (estimatedTokens > 5000) score += 1;

    if (category === 'security') score += 2;

    if (score < 1) return 'trivial';
    if (score < 2) return 'simple';
    if (score < 4) return 'standard';
    if (score < 6) return 'complex';
    return 'critical';
  }

  getWeightsForBudgetState(budgetState: ThrottleLevel): WeightSet {
    return BUDGET_STATE_WEIGHTS[budgetState];
  }

  getModelPerformanceWeight(modelId: ModelTier, category: TaskCategory): number {
    if (!this.performanceTracker) return 1.0;
    const stats = this.performanceTracker.getPerformanceStats(modelId);
    const categoryPerf = stats.categories.find((c) => c.category === category);
    if (!categoryPerf || categoryPerf.totalCalls < 5) return 1.0;

    const qualityNorm = categoryPerf.avgQuality;
    const errorNorm = Math.max(0, 1 - categoryPerf.errorRate);
    const latencyNorm = Math.max(0, 1 - categoryPerf.avgLatencyMs / 10000);

    const performanceScore = qualityNorm * 0.4 + errorNorm * 0.3 + latencyNorm * 0.3;
    return 0.5 + performanceScore;
  }

  private selectModelForScore(
    score: number,
    budgetState: ThrottleLevel,
    category: TaskCategory,
    securitySensitive: boolean,
    agent?: string,
    contentLength?: number,
  ): ModelTier {
    // 1. Context Window Hard Requirement
    // Leverage Claude 4.6 Opus/Sonnet 1M context if input is extremely large (> 150K tokens ~= 600K chars)
    if (contentLength && contentLength > 600_000) {
      const opus46 = this.registry
        .listModels({ availableOnly: true })
        .find((m) => m.id === 'claude-opus-4.6');
      if (opus46) return this.selectWithFallback(opus46.id, category);

      const sonnet46 = this.registry
        .listModels({ availableOnly: true })
        .find((m) => m.id === 'claude-sonnet-4.6');
      if (sonnet46) return this.selectWithFallback(sonnet46.id, category);
    }

    // 2. Heartbeat Routing
    if (category === 'heartbeat') {
      return this.selectWithFallback('claude-haiku-3', category);
    }

    // 3. Budget Constraints
    if (budgetState === 'pause') {
      if (score >= 80) {
        return this.selectWithFallback(this.findMinimumSonnet(), category);
      }
      return this.selectWithFallback('claude-haiku-3', category);
    }

    // 3. Security Constraint
    if (securitySensitive) {
      return this.selectWithFallback(this.findMinimumSonnet(), category);
    }

    // 4. Epsilon-Greedy Reinforcement Learning Selection
    const available = this.registry.listModels({ availableOnly: true }).map((m) => m.id);
    if (available.length === 0) return 'claude-haiku-3';

    // Exploration: Choose random model
    if (Math.random() < this.EPSILON) {
      const randomModel = available[Math.floor(Math.random() * available.length)];
      return this.selectWithFallback(randomModel, category);
    }

    // Exploitation: Choose best model based on Q-table and performance weights
    let bestModel = available[0];
    let bestQ = -Infinity;

    const categoryQ = this.rlState.qTable[category];

    for (const model of available) {
      // Base Q-value from RL
      const qValue = (categoryQ && categoryQ[model]) !== undefined ? categoryQ[model] : 0;

      // Incorporate performance weight
      const perfWeight = this.getModelPerformanceWeight(model, category);

      // Incorporate score vs capability heuristic
      let heuristicBonus = 0;
      if (score >= 85 && (model === 'claude-opus-4.6' || model === 'claude-opus-4.5'))
        heuristicBonus = 5;
      if (
        score >= 60 &&
        score < 85 &&
        (model === 'claude-sonnet-4.6' || model === 'claude-sonnet-4.5')
      )
        heuristicBonus = 5;
      if (score < 50 && (model === 'claude-haiku-4.5' || model === 'claude-haiku-3'))
        heuristicBonus = 5;

      const totalValue = qValue * 0.6 + perfWeight * 5 * 0.2 + heuristicBonus * 0.2;

      if (totalValue > bestQ) {
        bestQ = totalValue;
        bestModel = model;
      }
    }

    return this.selectWithFallback(bestModel, category);
  }

  private selectWithFallback(model: ModelTier, category: TaskCategory): ModelTier {
    if (!this.circuitBreaker) return model;
    if (this.circuitBreaker.canExecute()) return model;

    const fallbackHierarchy: ModelTier[] = [
      'claude-haiku-3',
      'claude-haiku-4.5',
      'claude-sonnet-4',
      'claude-sonnet-4.5',
      'claude-sonnet-4.6',
      'claude-opus-4.5',
      'claude-opus-4.6',
    ];

    const modelIndex = fallbackHierarchy.indexOf(model);
    if (modelIndex <= 0) return model;

    const fallback = fallbackHierarchy[modelIndex - 1];

    this.eventBus.emit('ai:model_fallback', {
      originalModel: model,
      fallbackModel: fallback,
      reason: 'Circuit breaker OPEN',
      category,
      timestamp: new Date().toISOString(),
    });

    return fallback;
  }

  private findBestSonnet(): ModelTier {
    const available = this.registry.listModels({ availableOnly: true });
    if (available.find((m) => m.id === 'claude-sonnet-4.6')) return 'claude-sonnet-4.6';
    if (available.find((m) => m.id === 'claude-sonnet-4.5')) return 'claude-sonnet-4.5';
    if (available.find((m) => m.id === 'claude-sonnet-4')) return 'claude-sonnet-4';
    return 'claude-haiku-4.5';
  }

  private findMinimumSonnet(): ModelTier {
    const available = this.registry.listModels({ availableOnly: true });
    if (available.find((m) => m.id === 'claude-sonnet-4')) return 'claude-sonnet-4';
    if (available.find((m) => m.id === 'claude-sonnet-4.5')) return 'claude-sonnet-4.5';
    return 'claude-haiku-4.5';
  }

  private buildReasoning(
    input: ValueScoreInput,
    budgetState: ThrottleLevel,
    score: number,
    tier: ModelTier,
  ): string {
    const parts: string[] = [];
    parts.push(`Complexity: ${input.complexity} (${COMPLEXITY_TO_NUMERIC[input.complexity]}/10)`);
    parts.push(`Stakes: ${input.stakes}/10`);
    parts.push(`Quality priority: ${input.qualityPriority}/10`);
    parts.push(`Budget state: ${budgetState}`);

    if (input.securitySensitive) parts.push('Security-sensitive: minimum Sonnet required');
    if (input.category === 'heartbeat') parts.push('Heartbeat task: routed to Haiku 3');
    if (budgetState === 'pause' && score < 80)
      parts.push('Budget paused: using minimum cost model');
    if (budgetState === 'reduce') parts.push('Budget reduced: downgrading to cost-efficient tier');

    if (input.contentLength && input.contentLength > 600_000) {
      parts.push('1M Context Window requirement matched');
    } else {
      parts.push('RL Q-Table epsilon-greedy selection applied');
    }

    parts.push(`Final score: ${score.toFixed(1)}/100`);
    parts.push(`Selected: ${tier}`);

    return parts.join('. ');
  }
}
