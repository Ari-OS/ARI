import type { ModelDefinition } from './types.js';
import type { LLMProviderId } from './providers/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT MODEL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Default model definitions with pricing and capabilities.
 * Pricing: dollars per 1M tokens (February 2026).
 * Quality/Speed: 0-10 scale.
 */
const DEFAULT_MODELS: ModelDefinition[] = [
  // ── Anthropic ──────────────────────────────────────────────────────────
  {
    id: 'claude-opus-4.6',
    provider: 'anthropic',
    apiModelId: 'claude-opus-4-6-20260205',
    quality: 10,
    speed: 5,
    costPer1MInput: 5.00,
    costPer1MOutput: 25.00,
    costPer1MCacheRead: 0.50,
    costPer1MCacheWrite: 6.25,
    maxContextTokens: 1_000_000,
    maxOutputTokens: 32_000,
    supportsCaching: true,
    isAvailable: true,
    capabilities: ['text', 'code', 'reasoning', 'vision', 'tools'],
  },
  {
    id: 'claude-opus-4.5',
    provider: 'anthropic',
    apiModelId: 'claude-opus-4-5-20251101',
    quality: 9,
    speed: 4,
    costPer1MInput: 5.00,
    costPer1MOutput: 25.00,
    costPer1MCacheRead: 0.50,
    costPer1MCacheWrite: 6.25,
    maxContextTokens: 200_000,
    maxOutputTokens: 32_000,
    supportsCaching: true,
    isAvailable: true,
    capabilities: ['text', 'code', 'reasoning', 'vision', 'tools'],
  },
  {
    id: 'claude-sonnet-4.6',
    provider: 'anthropic',
    apiModelId: 'claude-sonnet-4-6',
    quality: 9,
    speed: 7,
    costPer1MInput: 3.00,
    costPer1MOutput: 15.00,
    costPer1MCacheRead: 0.30,
    costPer1MCacheWrite: 3.75,
    maxContextTokens: 1_000_000,
    maxOutputTokens: 32_000,
    supportsCaching: true,
    isAvailable: true,
    capabilities: ['text', 'code', 'reasoning', 'vision', 'tools'],
  },
  {
    id: 'claude-sonnet-4.5',
    provider: 'anthropic',
    apiModelId: 'claude-sonnet-4-5-20250929',
    quality: 8,
    speed: 7,
    costPer1MInput: 3.00,
    costPer1MOutput: 15.00,
    costPer1MCacheRead: 0.30,
    costPer1MCacheWrite: 3.75,
    maxContextTokens: 200_000,
    maxOutputTokens: 16_000,
    supportsCaching: true,
    isAvailable: true,
    capabilities: ['text', 'code', 'reasoning', 'vision', 'tools'],
  },
  {
    id: 'claude-sonnet-4',
    provider: 'anthropic',
    apiModelId: 'claude-sonnet-4-20250514',
    quality: 7,
    speed: 7,
    costPer1MInput: 3.00,
    costPer1MOutput: 15.00,
    costPer1MCacheRead: 0.30,
    costPer1MCacheWrite: 3.75,
    maxContextTokens: 200_000,
    maxOutputTokens: 16_000,
    supportsCaching: true,
    isAvailable: true,
    capabilities: ['text', 'code', 'reasoning', 'vision', 'tools'],
  },
  {
    id: 'claude-haiku-4.5',
    provider: 'anthropic',
    apiModelId: 'claude-haiku-4-5-20251001',
    quality: 6,
    speed: 10,
    costPer1MInput: 1.00,
    costPer1MOutput: 5.00,
    costPer1MCacheRead: 0.10,
    costPer1MCacheWrite: 1.25,
    maxContextTokens: 200_000,
    maxOutputTokens: 8_192,
    supportsCaching: true,
    isAvailable: true,
    capabilities: ['text', 'code', 'reasoning', 'tools'],
  },
  {
    id: 'claude-haiku-3',
    provider: 'anthropic',
    apiModelId: 'claude-3-haiku-20240307',
    quality: 5,
    speed: 10,
    costPer1MInput: 0.25,
    costPer1MOutput: 1.25,
    costPer1MCacheRead: 0.025,
    costPer1MCacheWrite: 0.30,
    maxContextTokens: 200_000,
    maxOutputTokens: 4_096,
    supportsCaching: true,
    isAvailable: true,
    capabilities: ['text', 'code', 'tools'],
  },
  // ── OpenAI ──────────────────────────────────────────────────────────────
  {
    id: 'gpt-5.2',
    provider: 'openai',
    apiModelId: 'gpt-5.2',
    quality: 9,
    speed: 7,
    costPer1MInput: 1.75,
    costPer1MOutput: 14.00,
    costPer1MCacheRead: 0.875,
    costPer1MCacheWrite: 0,
    maxContextTokens: 128_000,
    maxOutputTokens: 16_384,
    supportsCaching: true,
    isAvailable: false, // Enable when API key configured
    capabilities: ['text', 'code', 'reasoning', 'vision', 'tools'],
  },
  {
    id: 'gpt-4.1',
    provider: 'openai',
    apiModelId: 'gpt-4.1',
    quality: 8,
    speed: 7,
    costPer1MInput: 2.00,
    costPer1MOutput: 8.00,
    costPer1MCacheRead: 1.00,
    costPer1MCacheWrite: 0,
    maxContextTokens: 1_000_000,
    maxOutputTokens: 32_768,
    supportsCaching: true,
    isAvailable: false,
    capabilities: ['text', 'code', 'reasoning', 'vision', 'tools'],
  },
  {
    id: 'gpt-4.1-mini',
    provider: 'openai',
    apiModelId: 'gpt-4.1-mini',
    quality: 6,
    speed: 9,
    costPer1MInput: 0.40,
    costPer1MOutput: 1.60,
    costPer1MCacheRead: 0.20,
    costPer1MCacheWrite: 0,
    maxContextTokens: 1_000_000,
    maxOutputTokens: 16_384,
    supportsCaching: true,
    isAvailable: false,
    capabilities: ['text', 'code', 'reasoning', 'tools'],
  },
  {
    id: 'gpt-4.1-nano',
    provider: 'openai',
    apiModelId: 'gpt-4.1-nano',
    quality: 4,
    speed: 10,
    costPer1MInput: 0.10,
    costPer1MOutput: 0.40,
    costPer1MCacheRead: 0.05,
    costPer1MCacheWrite: 0,
    maxContextTokens: 1_000_000,
    maxOutputTokens: 16_384,
    supportsCaching: true,
    isAvailable: false,
    capabilities: ['text', 'code'],
  },
  {
    id: 'o3',
    provider: 'openai',
    apiModelId: 'o3',
    quality: 9,
    speed: 3,
    costPer1MInput: 2.00,
    costPer1MOutput: 8.00,
    costPer1MCacheRead: 0,
    costPer1MCacheWrite: 0,
    maxContextTokens: 200_000,
    maxOutputTokens: 100_000,
    supportsCaching: false,
    isAvailable: false,
    capabilities: ['text', 'code', 'reasoning'],
  },
  {
    id: 'o4-mini',
    provider: 'openai',
    apiModelId: 'o4-mini',
    quality: 7,
    speed: 6,
    costPer1MInput: 1.10,
    costPer1MOutput: 4.40,
    costPer1MCacheRead: 0,
    costPer1MCacheWrite: 0,
    maxContextTokens: 200_000,
    maxOutputTokens: 100_000,
    supportsCaching: false,
    isAvailable: false,
    capabilities: ['text', 'code', 'reasoning'],
  },
  {
    id: 'codex-mini',
    provider: 'openai',
    apiModelId: 'codex-mini-latest',
    quality: 7,
    speed: 8,
    costPer1MInput: 1.50,
    costPer1MOutput: 6.00,
    costPer1MCacheRead: 0,
    costPer1MCacheWrite: 0,
    maxContextTokens: 192_000,
    maxOutputTokens: 16_384,
    supportsCaching: false,
    isAvailable: false,
    capabilities: ['code', 'reasoning'],
  },
  // ── Google ──────────────────────────────────────────────────────────────
  {
    id: 'gemini-2.5-pro',
    provider: 'google',
    apiModelId: 'gemini-2.5-pro',
    quality: 9,
    speed: 7,
    costPer1MInput: 1.25,
    costPer1MOutput: 10.00,
    costPer1MCacheRead: 0.315,
    costPer1MCacheWrite: 0,
    maxContextTokens: 1_000_000,
    maxOutputTokens: 65_536,
    supportsCaching: true,
    isAvailable: false,
    capabilities: ['text', 'code', 'reasoning', 'vision', 'tools'],
  },
  {
    id: 'gemini-3.1-pro',
    provider: 'google',
    apiModelId: 'gemini-3.1-pro-preview',
    quality: 10,
    speed: 5,
    costPer1MInput: 2.00,
    costPer1MOutput: 12.00,
    costPer1MCacheRead: 0.50,
    costPer1MCacheWrite: 0,
    maxContextTokens: 1_000_000,
    maxOutputTokens: 64_000,
    supportsCaching: true,
    isAvailable: false,
    capabilities: ['text', 'code', 'reasoning', 'vision', 'tools'],
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    apiModelId: 'gemini-2.5-flash',
    quality: 7,
    speed: 10,
    costPer1MInput: 0.30,
    costPer1MOutput: 2.50,
    costPer1MCacheRead: 0.075,
    costPer1MCacheWrite: 0,
    maxContextTokens: 1_000_000,
    maxOutputTokens: 65_536,
    supportsCaching: true,
    isAvailable: false,
    capabilities: ['text', 'code', 'reasoning', 'vision', 'tools'],
  },
  {
    id: 'gemini-2.5-flash-lite',
    provider: 'google',
    apiModelId: 'gemini-2.5-flash-lite',
    quality: 5,
    speed: 10,
    costPer1MInput: 0.10,
    costPer1MOutput: 0.40,
    costPer1MCacheRead: 0.025,
    costPer1MCacheWrite: 0,
    maxContextTokens: 1_000_000,
    maxOutputTokens: 65_536,
    supportsCaching: true,
    isAvailable: false,
    capabilities: ['text', 'code'],
  },
  // ── xAI ──────────────────────────────────────────────────────────────
  {
    id: 'grok-4',
    provider: 'xai',
    apiModelId: 'grok-4-0709',
    quality: 8,
    speed: 6,
    costPer1MInput: 3.00,
    costPer1MOutput: 15.00,
    costPer1MCacheRead: 0.75,
    costPer1MCacheWrite: 0,
    maxContextTokens: 256_000,
    maxOutputTokens: 16_384,
    supportsCaching: true,
    isAvailable: false,
    capabilities: ['text', 'code', 'reasoning', 'tools'],
  },
  {
    id: 'grok-4.1-fast',
    provider: 'xai',
    apiModelId: 'grok-4-1-fast-reasoning',
    quality: 6,
    speed: 10,
    costPer1MInput: 0.20,
    costPer1MOutput: 0.50,
    costPer1MCacheRead: 0.05,
    costPer1MCacheWrite: 0,
    maxContextTokens: 2_000_000,
    maxOutputTokens: 16_384,
    supportsCaching: true,
    isAvailable: false,
    capabilities: ['text', 'code', 'reasoning'],
  },
  {
    id: 'grok-4-fast',
    provider: 'xai',
    apiModelId: 'grok-4-fast-non-reasoning',
    quality: 5,
    speed: 10,
    costPer1MInput: 0.20,
    costPer1MOutput: 0.50,
    costPer1MCacheRead: 0.05,
    costPer1MCacheWrite: 0,
    maxContextTokens: 2_000_000,
    maxOutputTokens: 16_384,
    supportsCaching: true,
    isAvailable: false,
    capabilities: ['text', 'code'],
  },
  {
    id: 'grok-3-mini',
    provider: 'xai',
    apiModelId: 'grok-3-mini',
    quality: 5,
    speed: 9,
    costPer1MInput: 0.30,
    costPer1MOutput: 0.50,
    costPer1MCacheRead: 0.07,
    costPer1MCacheWrite: 0,
    maxContextTokens: 131_072,
    maxOutputTokens: 16_384,
    supportsCaching: true,
    isAvailable: false,
    capabilities: ['text', 'code', 'reasoning'],
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
  private models: Map<string, ModelDefinition> = new Map();

  constructor() {
    for (const model of DEFAULT_MODELS) {
      this.models.set(model.id, { ...model });
    }
  }

  /**
   * Get a model definition by tier.
   * @throws Error if model not found
   */
  getModel(tier: string): ModelDefinition {
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
  setAvailability(tier: string, available: boolean): void {
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
    tier: string,
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
    tier: string,
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
  isAvailable(tier: string): boolean {
    const model = this.models.get(tier);
    return model?.isAvailable ?? false;
  }

  /**
   * Get all models for a specific provider.
   */
  getModelsByProvider(provider: LLMProviderId): ModelDefinition[] {
    return Array.from(this.models.values())
      .filter(m => m.provider === provider)
      .map(m => ({ ...m }));
  }

  /**
   * Get pricing for a model (returns per-1M-token rates).
   */
  getPricing(tier: string): {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  } {
    const model = this.getModel(tier);
    return {
      input: model.costPer1MInput,
      output: model.costPer1MOutput,
      cacheRead: model.costPer1MCacheRead,
      cacheWrite: model.costPer1MCacheWrite ?? 0,
    };
  }
}
