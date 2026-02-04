import type { ModelTier, ModelDefinition } from './types.js';
import { ModelTierSchema } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT MODEL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Default model definitions with pricing and capabilities.
 * Pricing: dollars per 1M tokens (February 2026).
 * Quality/Speed: 0-10 scale.
 */
const DEFAULT_MODELS: ModelDefinition[] = [
  {
    id: 'claude-opus-4.5',
    quality: 10,
    speed: 4,
    costPer1MInput: 5.00,
    costPer1MOutput: 25.00,
    costPer1MCacheRead: 0.50,
    maxContextTokens: 200_000,
    supportsCaching: true,
    isAvailable: true,
  },
  {
    id: 'claude-sonnet-5',
    quality: 9,
    speed: 7,
    costPer1MInput: 3.00,
    costPer1MOutput: 15.00,
    costPer1MCacheRead: 0.30,
    maxContextTokens: 200_000,
    supportsCaching: true,
    isAvailable: false, // Flip when released
  },
  {
    id: 'claude-sonnet-4',
    quality: 8,
    speed: 7,
    costPer1MInput: 3.00,
    costPer1MOutput: 15.00,
    costPer1MCacheRead: 0.30,
    maxContextTokens: 200_000,
    supportsCaching: true,
    isAvailable: true,
  },
  {
    id: 'claude-haiku-4.5',
    quality: 6,
    speed: 10,
    costPer1MInput: 1.00,
    costPer1MOutput: 5.00,
    costPer1MCacheRead: 0.10,
    maxContextTokens: 200_000,
    supportsCaching: true,
    isAvailable: true,
  },
  {
    id: 'claude-haiku-3',
    quality: 5,
    speed: 10,
    costPer1MInput: 0.25,
    costPer1MOutput: 1.25,
    costPer1MCacheRead: 0.025,
    maxContextTokens: 200_000,
    supportsCaching: true,
    isAvailable: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ModelRegistry — Single source of truth for model definitions and pricing.
 *
 * Replaces 4 separate pricing tables scattered across:
 * - CostTracker.MODEL_PRICING
 * - BudgetTracker.MODEL_PRICING
 * - ModelSelector.MODEL_COSTS
 * - ModelRouter pricing
 *
 * Features:
 * - Centralized model definitions with quality/speed ratings
 * - Accurate pricing per Anthropic's published rates
 * - Availability toggling (Sonnet 5 ready from day 1)
 * - Cost calculation with cache read support
 * - Dynamic model registration for future models
 */
export class ModelRegistry {
  private models: Map<ModelTier, ModelDefinition> = new Map();

  constructor() {
    for (const model of DEFAULT_MODELS) {
      this.models.set(model.id, { ...model });
    }
  }

  /**
   * Get a model definition by tier.
   * @throws Error if model not found
   */
  getModel(tier: ModelTier): ModelDefinition {
    const model = this.models.get(tier);
    if (!model) {
      throw new Error(`Model not found: ${tier}`);
    }
    return { ...model };
  }

  /**
   * List all models, optionally filtering to available-only.
   */
  listModels(options?: { availableOnly?: boolean }): ModelDefinition[] {
    const all = Array.from(this.models.values()).map(m => ({ ...m }));
    if (options?.availableOnly) {
      return all.filter(m => m.isAvailable);
    }
    return all;
  }

  /**
   * Toggle model availability.
   * Use to enable Sonnet 5 when released, or disable models during incidents.
   */
  setAvailability(tier: ModelTier, available: boolean): void {
    const model = this.models.get(tier);
    if (!model) {
      throw new Error(`Model not found: ${tier}`);
    }
    model.isAvailable = available;
  }

  /**
   * Register a new model or update an existing one.
   */
  registerModel(definition: ModelDefinition): void {
    // Validate the tier is a known value
    ModelTierSchema.parse(definition.id);
    this.models.set(definition.id, { ...definition });
  }

  /**
   * Calculate cost for a request.
   *
   * @param tier - Model tier
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @param cachedInputTokens - Number of input tokens served from cache
   * @returns Cost in dollars
   */
  getCost(
    tier: ModelTier,
    inputTokens: number,
    outputTokens: number,
    cachedInputTokens: number = 0,
  ): number {
    const model = this.getModel(tier);

    // Non-cached input tokens cost full price
    const freshInputTokens = Math.max(0, inputTokens - cachedInputTokens);
    const inputCost = (freshInputTokens * model.costPer1MInput) / 1_000_000;

    // Cached input tokens cost cache read price
    const cacheCost = (cachedInputTokens * model.costPer1MCacheRead) / 1_000_000;

    // Output tokens
    const outputCost = (outputTokens * model.costPer1MOutput) / 1_000_000;

    return inputCost + cacheCost + outputCost;
  }

  /**
   * Estimate cost for a request (before execution).
   * Uses average output ratio for estimation.
   *
   * @param tier - Model tier
   * @param inputTokens - Estimated input tokens
   * @param outputRatio - Expected output/input ratio (default 0.3)
   * @param cacheHitRate - Expected cache hit rate (default 0.0)
   */
  estimateCost(
    tier: ModelTier,
    inputTokens: number,
    outputRatio: number = 0.3,
    cacheHitRate: number = 0.0,
  ): number {
    const estimatedOutputTokens = Math.ceil(inputTokens * outputRatio);
    const cachedTokens = Math.floor(inputTokens * cacheHitRate);
    return this.getCost(tier, inputTokens, estimatedOutputTokens, cachedTokens);
  }

  /**
   * Get the cheapest available model.
   */
  getCheapestAvailable(): ModelDefinition {
    const available = this.listModels({ availableOnly: true });
    if (available.length === 0) {
      throw new Error('No models available');
    }
    return available.sort((a, b) => a.costPer1MOutput - b.costPer1MOutput)[0];
  }

  /**
   * Get the highest quality available model.
   */
  getHighestQualityAvailable(): ModelDefinition {
    const available = this.listModels({ availableOnly: true });
    if (available.length === 0) {
      throw new Error('No models available');
    }
    return available.sort((a, b) => b.quality - a.quality)[0];
  }

  /**
   * Check if a model is available.
   */
  isAvailable(tier: ModelTier): boolean {
    const model = this.models.get(tier);
    return model?.isAvailable ?? false;
  }
}
