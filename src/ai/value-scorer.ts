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

  constructor(eventBus: EventBus, registry: ModelRegistry) {
    this.eventBus = eventBus;
    this.registry = registry;
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

  private selectModelForScore(
    score: number,
    budgetState: ThrottleLevel,
    category: TaskCategory,
    securitySensitive: boolean,
  ): ModelTier {
    if (category === 'heartbeat') {
      return 'claude-haiku-3';
    }

    if (securitySensitive) {
      return this.findMinimumSonnet();
    }

    if (budgetState === 'pause') {
      if (score >= 80) {
        return this.findMinimumSonnet();
      }
      return 'claude-haiku-3';
    }

    if (budgetState === 'reduce') {
      if (score >= 70) {
        return this.findBestSonnet();
      }
      return 'claude-haiku-4.5';
    }

    if (score >= 85 && (category === 'planning' || category === 'analysis')) {
      if (this.registry.isAvailable('claude-opus-4.5')) {
        return 'claude-opus-4.5';
      }
    }

    if (score >= 70) {
      return this.findBestSonnet();
    }

    if (
      score >= 50 &&
      (category === 'code_generation' ||
        category === 'code_review' ||
        category === 'analysis' ||
        category === 'planning')
    ) {
      return this.findBestSonnet();
    }

    if (this.registry.isAvailable('claude-haiku-4.5')) {
      return 'claude-haiku-4.5';
    }

    return 'claude-haiku-3';
  }

  private findBestSonnet(): ModelTier {
    const available = this.registry.listModels({ availableOnly: true });
    const sonnet5 = available.find((m) => m.id === 'claude-sonnet-5');
    if (sonnet5) return 'claude-sonnet-5';

    const sonnet4 = available.find((m) => m.id === 'claude-sonnet-4');
    if (sonnet4) return 'claude-sonnet-4';

    return 'claude-haiku-4.5';
  }

  private findMinimumSonnet(): ModelTier {
    const available = this.registry.listModels({ availableOnly: true });
    const sonnet4 = available.find((m) => m.id === 'claude-sonnet-4');
    if (sonnet4) return 'claude-sonnet-4';

    const sonnet5 = available.find((m) => m.id === 'claude-sonnet-5');
    if (sonnet5) return 'claude-sonnet-5';

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
