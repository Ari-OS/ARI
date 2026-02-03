import type { EventBus } from '../kernel/event-bus.js';
import type { CostTracker } from '../observability/cost-tracker.js';

/**
 * Task classification levels for model selection.
 */
export type TaskClassificationType = 'trivial' | 'standard' | 'complex' | 'critical';

/**
 * Available AI models for routing.
 */
export type AIModel =
  | 'claude-opus-4'
  | 'claude-sonnet-4'
  | 'claude-haiku'
  | 'gpt-4o'
  | 'gpt-4o-mini';

/**
 * Task classification result with detailed feature analysis.
 */
export interface TaskClassification {
  type: TaskClassificationType;
  confidence: number; // 0-1 confidence in classification
  features: {
    estimatedTokens: number;
    requiresReasoning: boolean;
    securitySensitive: boolean;
    creativityRequired: boolean;
    codeGeneration: boolean;
    multiStep: boolean;
  };
}

/**
 * Model selection result with reasoning.
 */
export interface ModelSelectionResult {
  model: AIModel;
  reason: string;
  estimatedCost: number;
  classification: TaskClassification;
}

/**
 * Token estimation: ~4 characters per token.
 */
const CHARS_PER_TOKEN = 4;

/**
 * Model pricing (per 1M tokens) - synced with CostTracker.
 */
const MODEL_COSTS: Record<AIModel, { input: number; output: number }> = {
  'claude-opus-4': { input: 15, output: 75 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-haiku': { input: 0.25, output: 1.25 },
  'gpt-4o': { input: 5, output: 15 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

/**
 * ModelSelector - Intelligent model selection based on task analysis and budget constraints.
 *
 * Features:
 * - Pattern-based task classification (trivial/standard/complex/critical)
 * - Budget-aware model selection via BudgetTracker
 * - Security override (minimum Sonnet for security-sensitive tasks)
 * - Cost estimation before execution
 * - Classification confidence scoring
 *
 * Classification System:
 * - Trivial (0-1 points): Simple queries, quick answers
 * - Standard (2-3 points): Normal operations, moderate complexity
 * - Complex (4-5 points): Architecture, refactoring, multi-step
 * - Critical (6+ points): Security, high-risk, comprehensive analysis
 *
 * Scoring Factors:
 * - Security-sensitive: +3
 * - Requires reasoning: +2
 * - Code generation: +2
 * - Creativity required: +1.5
 * - Multi-step: +1
 * - Large task (>2000 chars): +1
 * - Very large task (>5000 chars): +1
 */
export class ModelSelector {
  private readonly budgetTracker: CostTracker;
  private readonly eventBus: EventBus;

  constructor(budgetTracker: CostTracker, eventBus: EventBus) {
    this.budgetTracker = budgetTracker;
    this.eventBus = eventBus;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Select the best model for a task.
   *
   * @param task - Task content to analyze
   * @param options - Optional override and hints
   * @returns Model selection with reasoning and cost estimate
   */
  selectModel(
    task: string,
    options?: {
      explicitModel?: AIModel;
      allowBudgetOverride?: boolean;
    }
  ): ModelSelectionResult {
    // 1. Check for explicit model override
    if (options?.explicitModel) {
      const classification = this.classifyTask(task);
      const estimatedCost = this.estimateCost(options.explicitModel, task);

      this.emitSelection(options.explicitModel, 'explicit_override', classification);

      return {
        model: options.explicitModel,
        reason: 'Explicit model override specified',
        estimatedCost,
        classification,
      };
    }

    // 2. Classify task based on content analysis
    const classification = this.classifyTask(task);

    // 3. Get budget-aware recommendation from BudgetTracker
    const budgetRecommendation = this.getBudgetRecommendation(classification);

    // 4. Apply security override (minimum Sonnet for security-sensitive)
    let selectedModel = budgetRecommendation.model;
    const reasons: string[] = [budgetRecommendation.reason];

    if (classification.features.securitySensitive) {
      if (selectedModel === 'claude-haiku') {
        selectedModel = 'claude-sonnet-4';
        reasons.push('Security override: upgraded from Haiku to Sonnet for security-sensitive task');
      }
    }

    // 5. Estimate cost
    const estimatedCost = this.estimateCost(selectedModel, task);

    // 6. Emit model selection event
    this.emitSelection(selectedModel, reasons.join('. '), classification);

    return {
      model: selectedModel,
      reason: reasons.join('. '),
      estimatedCost,
      classification,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TASK CLASSIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Classify a task based on content analysis.
   */
  private classifyTask(task: string): TaskClassification {
    const features = {
      estimatedTokens: this.estimateTokens(task),
      requiresReasoning: this.detectReasoning(task),
      securitySensitive: this.detectSecurity(task),
      creativityRequired: this.detectCreativity(task),
      codeGeneration: this.detectCodeGen(task),
      multiStep: this.detectMultiStep(task),
    };

    // Calculate complexity score
    let score = 0;

    if (features.securitySensitive) score += 3;
    if (features.requiresReasoning) score += 2;
    if (features.codeGeneration) score += 2;
    if (features.creativityRequired) score += 1.5;
    if (features.multiStep) score += 1;
    if (features.estimatedTokens > 2000) score += 1;
    if (features.estimatedTokens > 5000) score += 1;

    // Determine classification type
    let type: TaskClassificationType;
    let confidence: number;

    if (score >= 6) {
      type = 'critical';
      confidence = 0.85;
    } else if (score >= 4) {
      type = 'complex';
      confidence = 0.80;
    } else if (score >= 2) {
      type = 'standard';
      confidence = 0.75;
    } else {
      type = 'trivial';
      confidence = 0.70;
    }

    // Increase confidence if multiple strong signals
    const strongSignals = [
      features.securitySensitive,
      features.requiresReasoning,
      features.codeGeneration,
      features.creativityRequired,
    ].filter(Boolean).length;

    if (strongSignals >= 3) confidence = Math.min(0.95, confidence + 0.1);
    if (strongSignals >= 2) confidence = Math.min(0.90, confidence + 0.05);

    return {
      type,
      confidence,
      features,
    };
  }

  /**
   * Detect if task requires reasoning (e.g., analysis, explanation).
   */
  private detectReasoning(task: string): boolean {
    const lower = task.toLowerCase();
    const reasoningPatterns = [
      'why',
      'how does',
      'explain',
      'analyze',
      'what is the difference',
      'compare',
      'evaluate',
      'assess',
      'determine',
      'justify',
      'reasoning',
      'rationale',
      'tradeoff',
      'pros and cons',
    ];

    return reasoningPatterns.some(pattern => lower.includes(pattern));
  }

  /**
   * Detect if task is security-sensitive.
   */
  private detectSecurity(task: string): boolean {
    const lower = task.toLowerCase();
    const securityPatterns = [
      'security',
      'permission',
      'trust',
      'auth',
      'credential',
      'secret',
      'encryption',
      'vulnerability',
      'attack',
      'exploit',
      'sanitize',
      'injection',
      'xss',
      'csrf',
      'audit',
      'access control',
    ];

    return securityPatterns.some(pattern => lower.includes(pattern));
  }

  /**
   * Detect if task requires creativity (e.g., design, architecture).
   */
  private detectCreativity(task: string): boolean {
    const lower = task.toLowerCase();
    const creativityPatterns = [
      'creative',
      'design',
      'architect',
      'brainstorm',
      'innovative',
      'novel',
      'unique',
      'alternative',
      'proposal',
      'concept',
      'vision',
    ];

    return creativityPatterns.some(pattern => lower.includes(pattern));
  }

  /**
   * Detect if task involves code generation.
   */
  private detectCodeGen(task: string): boolean {
    const lower = task.toLowerCase();
    const codePatterns = [
      'implement',
      'code',
      'function',
      'class',
      'method',
      'write a',
      'create a script',
      'generate',
      'build',
      'develop',
      'program',
      'refactor',
    ];

    return codePatterns.some(pattern => lower.includes(pattern));
  }

  /**
   * Detect if task is multi-step.
   */
  private detectMultiStep(task: string): boolean {
    const lower = task.toLowerCase();
    const multiStepPatterns = [
      'first',
      'then',
      'next',
      'finally',
      'step',
      'phase',
      'stage',
      'after that',
      'following',
      'sequence',
      'pipeline',
    ];

    const patternCount = multiStepPatterns.filter(pattern => lower.includes(pattern)).length;

    // Multi-step if multiple sequential indicators OR contains numbered steps
    return patternCount >= 2 || /\d+\.\s/.test(task) || /step \d+/i.test(task);
  }

  /**
   * Estimate tokens for a task (input only, ~4 chars per token).
   */
  private estimateTokens(task: string): number {
    return Math.ceil(task.length / CHARS_PER_TOKEN);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUDGET-AWARE MODEL SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get budget-aware model recommendation.
   */
  private getBudgetRecommendation(
    classification: TaskClassification
  ): { model: AIModel; reason: string } {
    const profile = this.budgetTracker.getProfile();
    const throttleStatus = this.budgetTracker.getThrottleStatus();

    // Default mapping based on classification
    const defaultMapping: Record<TaskClassificationType, AIModel> = {
      trivial: 'claude-haiku',
      standard: 'claude-sonnet-4',
      complex: 'claude-sonnet-4',
      critical: 'claude-opus-4',
    };

    let selectedModel = defaultMapping[classification.type];
    const reasons: string[] = [];

    // Check if we should downgrade due to budget pressure
    if (throttleStatus.level === 'pause') {
      // At pause level, use cheapest model unless critical
      if (classification.type !== 'critical') {
        selectedModel = 'claude-haiku';
        reasons.push('Budget pause mode: using Haiku to conserve budget');
      } else {
        reasons.push('Critical task: using recommended model despite budget pause');
      }
    } else if (throttleStatus.level === 'reduce') {
      // At reduce level, prefer cheaper models
      if (classification.type === 'complex' || classification.type === 'standard') {
        selectedModel = 'claude-haiku';
        reasons.push('Budget reduce mode: downgraded to Haiku');
      }
    } else if (throttleStatus.level === 'warning') {
      // At warning level, hint at conservation
      reasons.push('Budget warning: consider using cheaper models for non-critical tasks');
    }

    // Apply profile-based routing if available
    if (profile?.routing?.preferCheaper && classification.type !== 'critical') {
      if (selectedModel === 'claude-sonnet-4') {
        selectedModel = 'claude-haiku';
        reasons.push('Profile prefers cheaper models: downgraded to Haiku');
      }
    }

    if (profile?.routing?.preferQuality && classification.type === 'complex') {
      if (selectedModel === 'claude-sonnet-4') {
        selectedModel = 'claude-opus-4';
        reasons.push('Profile prefers quality: upgraded to Opus');
      }
    }

    // Build reason string
    if (reasons.length === 0) {
      reasons.push(`Classification: ${classification.type} (confidence: ${(classification.confidence * 100).toFixed(0)}%)`);
    }

    return {
      model: selectedModel,
      reason: reasons.join('. '),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COST ESTIMATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Estimate cost for a task with a given model.
   */
  private estimateCost(model: AIModel, task: string): number {
    const inputTokens = this.estimateTokens(task);

    // Estimate output tokens based on task type
    // Rough heuristic: output is typically 20-50% of input for code generation,
    // 10-30% for analysis/reasoning
    const outputTokens = Math.ceil(inputTokens * 0.3);

    const costs = MODEL_COSTS[model];
    return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT EMISSION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Emit model selection event for tracking and analytics.
   */
  private emitSelection(
    model: AIModel,
    reason: string,
    classification: TaskClassification
  ): void {
    this.eventBus.emit('model:routed', {
      task: classification.type,
      model,
      reason,
      estimatedCost: 0, // Not included in event, use model:selected for tracking
    });

    this.eventBus.emit('audit:log', {
      action: 'model_selected',
      agent: 'core',
      trustLevel: 'system',
      details: {
        model,
        classificationType: classification.type,
        confidence: classification.confidence,
        reason,
        features: classification.features,
      },
    });
  }
}
