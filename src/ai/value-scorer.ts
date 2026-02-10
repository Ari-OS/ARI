import type { EventBus } from '../kernel/event-bus.js';
import type { ThrottleLevel } from '../observability/cost-tracker.js';
import type {
  ModelTier,
  TaskComplexity,
  TaskCategory,
  ValueScoreInput,
  ValueScoreResult,
} from './types.js';
import { ModelRegistry } from './model-registry.js';
import type { PerformanceTracker } from './performance-tracker.js';
import type { CircuitBreaker } from './circuit-breaker.js';

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
  normal: { quality: 0.40, cost: 0.20, speed: 0.15 },
  warning: { quality: 0.35, cost: 0.30, speed: 0.10 },
  reduce: { quality: 0.25, cost: 0.40, speed: 0.10 },
  pause: { quality: 0.15, cost: 0.50, speed: 0.10 },
};

export class ValueScorer {
  private readonly eventBus: EventBus;
  private readonly registry: ModelRegistry;
  private readonly performanceTracker: PerformanceTracker | null;
  private readonly circuitBreaker: CircuitBreaker | null;

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
  }

  score(input: ValueScoreInput, budgetState: ThrottleLevel): ValueScoreResult {
    const complexityScore = COMPLEXITY_TO_NUMERIC[input.complexity];
    const budgetAdjustment = 10 - input.budgetPressure;

    const rawScore =
      complexityScore * 0.35 +
      input.stakes * 0.25 +
      input.qualityPriority * 0.20 +
      budgetAdjustment * 0.10 +
      input.historicalPerformance * 0.10;

    const normalizedScore = Math.min(100, Math.max(0, (rawScore / 10) * 100));

    const recommendedTier = this.selectModelForScore(
      normalizedScore,
      budgetState,
      input.category,
      input.securitySensitive,
    );

    const weights = this.getWeightsForBudgetState(budgetState);
    const reasoning = this.buildReasoning(
      input,
      budgetState,
      normalizedScore,
      recommendedTier,
    );

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
    if (securityPatterns.some((p) => lowerContent.includes(p))) {
      score += 3;
    }

    const reasoningPatterns = [
      'why',
      'explain',
      'analyze',
      'compare',
      'evaluate',
      'tradeoff',
    ];
    if (reasoningPatterns.some((p) => lowerContent.includes(p))) {
      score += 2;
    }

    const codeGenPatterns = [
      'implement',
      'refactor',
      'class',
      'method',
      'function',
    ];
    if (codeGenPatterns.some((p) => lowerContent.includes(p))) {
      score += 2;
    }

    const creativityPatterns = [
      'design',
      'architect',
      'brainstorm',
      'novel',
      'innovative',
    ];
    if (creativityPatterns.some((p) => lowerContent.includes(p))) {
      score += 1.5;
    }

    const multiStepPatterns = ['first', 'then', 'next', 'finally'];
    const hasMultiStep = multiStepPatterns.some((p) => lowerContent.includes(p));
    const hasNumberedSteps = /\d+\.\s/.test(content);
    if (hasMultiStep || hasNumberedSteps) {
      score += 1;
    }

    const estimatedTokens = content.length / 4;
    if (estimatedTokens > 2000) {
      score += 1;
    }
    if (estimatedTokens > 5000) {
      score += 1;
    }

    if (category === 'security') {
      score += 2;
    }

    if (score < 1) return 'trivial';
    if (score < 2) return 'simple';
    if (score < 4) return 'standard';
    if (score < 6) return 'complex';
    return 'critical';
  }

  getWeightsForBudgetState(budgetState: ThrottleLevel): WeightSet {
    return BUDGET_STATE_WEIGHTS[budgetState];
  }

  /**
   * Get performance weight multiplier for a model based on historical data.
   *
   * Returns a multiplier (0.5-1.5) that adjusts model selection based on:
   * - Quality score (40% weight)
   * - Error rate (30% weight)
   * - Average latency (30% weight)
   *
   * Returns 1.0 if no performance data is available.
   */
  getModelPerformanceWeight(modelId: ModelTier, category: TaskCategory): number {
    if (!this.performanceTracker) {
      return 1.0;
    }

    const stats = this.performanceTracker.getPerformanceStats(modelId);
    const categoryPerf = stats.categories.find((c) => c.category === category);

    // Need at least 5 calls for meaningful data
    if (!categoryPerf || categoryPerf.totalCalls < 5) {
      return 1.0;
    }

    // Normalize metrics to 0-1 range
    const qualityNorm = categoryPerf.avgQuality;
    const errorNorm = Math.max(0, 1 - categoryPerf.errorRate);
    const latencyNorm = Math.max(0, 1 - categoryPerf.avgLatencyMs / 10000);

    // Weighted score
    const performanceScore =
      qualityNorm * 0.4 +
      errorNorm * 0.3 +
      latencyNorm * 0.3;

    // Map score to multiplier range (0.5-1.5)
    // Score 0.0 → 0.5x, Score 0.5 → 1.0x, Score 1.0 → 1.5x
    return 0.5 + performanceScore;
  }

  private selectModelForScore(
    score: number,
    budgetState: ThrottleLevel,
    category: TaskCategory,
    securitySensitive: boolean,
  ): ModelTier {
    if (category === 'heartbeat') {
      return this.selectWithFallback('claude-haiku-3', category);
    }

    if (securitySensitive) {
      return this.selectWithFallback(this.findMinimumSonnet(), category);
    }

    // Cost-aware routing: when budget < 20% (pause state), aggressively prefer cheaper models
    if (budgetState === 'pause') {
      if (score >= 80) {
        return this.selectWithFallback(this.findMinimumSonnet(), category);
      }
      return this.selectWithFallback('claude-haiku-3', category);
    }

    if (budgetState === 'reduce') {
      if (score >= 70) {
        return this.selectWithFallback(this.findBestSonnet(), category);
      }
      return this.selectWithFallback('claude-haiku-4.5', category);
    }

    // Data-driven routing: weight static rules with historical performance
    const candidates: ModelTier[] = [];

    if (score >= 85 && (category === 'planning' || category === 'analysis')) {
      candidates.push('claude-opus-4.6', 'claude-opus-4.5');
    }

    if (score >= 70) {
      candidates.push('claude-sonnet-4.5', 'claude-sonnet-4');
    }

    if (
      score >= 50 &&
      (category === 'code_generation' ||
        category === 'code_review' ||
        category === 'analysis' ||
        category === 'planning')
    ) {
      candidates.push('claude-sonnet-4.5', 'claude-sonnet-4');
    }

    candidates.push('claude-haiku-4.5', 'claude-haiku-3');

    // Select best candidate with performance weighting
    return this.selectBestCandidate(candidates, category);
  }

  /**
   * Select best model from candidates using performance data.
   * Falls back to next-best if circuit breaker is OPEN.
   */
  private selectBestCandidate(candidates: ModelTier[], category: TaskCategory): ModelTier {
    const available = candidates.filter((m) => this.registry.isAvailable(m));
    if (available.length === 0) {
      return 'claude-haiku-3';
    }

    // Apply performance weights if available
    const scored = available.map((model) => {
      const performanceWeight = this.getModelPerformanceWeight(model, category);
      return { model, score: performanceWeight };
    });

    // Sort by weighted score (descending)
    scored.sort((a, b) => b.score - a.score);

    // Check circuit breaker and fallback if needed
    for (const candidate of scored) {
      const selected = this.selectWithFallback(candidate.model, category);
      if (selected !== candidate.model) {
        // Emit fallback event
        this.eventBus.emit('ai:model_fallback', {
          originalModel: candidate.model,
          fallbackModel: selected,
          reason: 'Circuit breaker OPEN',
          category,
          timestamp: new Date().toISOString(),
        });
      }
      return selected;
    }

    return available[0];
  }

  /**
   * Automatic downgrade: if circuit breaker is OPEN for selected model,
   * fall back to next-best available model.
   */
  private selectWithFallback(model: ModelTier, category: TaskCategory): ModelTier {
    // If no circuit breaker, return model as-is
    if (!this.circuitBreaker) {
      return model;
    }

    // Check if circuit breaker allows execution
    if (this.circuitBreaker.canExecute()) {
      return model;
    }

    // Circuit breaker is OPEN — find fallback
    const fallbackHierarchy: ModelTier[] = [
      'claude-haiku-3',
      'claude-haiku-4.5',
      'claude-sonnet-4',
      'claude-sonnet-4.5',
      'claude-opus-4.5',
      'claude-opus-4.6',
    ];

    const modelIndex = fallbackHierarchy.indexOf(model);
    if (modelIndex === -1 || modelIndex === 0) {
      // Already at cheapest model or not found
      return model;
    }

    // Return next cheaper model
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
    const sonnet5 = available.find((m) => m.id === 'claude-sonnet-4.5');
    if (sonnet5) return 'claude-sonnet-4.5';

    const sonnet4 = available.find((m) => m.id === 'claude-sonnet-4');
    if (sonnet4) return 'claude-sonnet-4';

    return 'claude-haiku-4.5';
  }

  private findMinimumSonnet(): ModelTier {
    const available = this.registry.listModels({ availableOnly: true });
    const sonnet4 = available.find((m) => m.id === 'claude-sonnet-4');
    if (sonnet4) return 'claude-sonnet-4';

    const sonnet5 = available.find((m) => m.id === 'claude-sonnet-4.5');
    if (sonnet5) return 'claude-sonnet-4.5';

    return 'claude-haiku-4.5';
  }

  private buildReasoning(
    input: ValueScoreInput,
    budgetState: ThrottleLevel,
    score: number,
    tier: ModelTier,
  ): string {
    const parts: string[] = [];

    parts.push(
      `Complexity: ${input.complexity} (${COMPLEXITY_TO_NUMERIC[input.complexity]}/10)`,
    );
    parts.push(`Stakes: ${input.stakes}/10`);
    parts.push(`Quality priority: ${input.qualityPriority}/10`);
    parts.push(`Budget state: ${budgetState}`);

    if (input.securitySensitive) {
      parts.push('Security-sensitive: minimum Sonnet required');
    }

    if (input.category === 'heartbeat') {
      parts.push('Heartbeat task: routed to Haiku 3');
    }

    if (budgetState === 'pause' && score < 80) {
      parts.push('Budget paused: using minimum cost model');
    }

    if (budgetState === 'reduce') {
      parts.push('Budget reduced: downgrading to cost-efficient tier');
    }

    parts.push(`Final score: ${score.toFixed(1)}/100`);
    parts.push(`Selected: ${tier}`);

    return parts.join('. ');
  }
}
