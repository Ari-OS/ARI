import type { EventBus } from '../kernel/event-bus.js';
import type {
  LLMProvider,
  LLMProviderConfig,
  LLMProviderId,
  LLMCompletionRequest,
  LLMCompletionResponse,
  ProviderHealthStatus,
  ConnectionTestResult,
} from './providers/types.js';
// LLMProviderIdSchema used at runtime for validation in registerFromEnv
import { AnthropicProvider } from './providers/anthropic-provider.js';
import { OpenAIProvider } from './providers/openai-provider.js';
import { GoogleProvider } from './providers/google-provider.js';
import { XAIProvider } from './providers/xai-provider.js';
import { ModelRegistry } from './model-registry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ProviderRegistry — Central hub for LLM provider lifecycle management.
 *
 * Responsibilities:
 * - Provider registration, initialization, and shutdown
 * - Model→provider routing (which provider handles which model)
 * - Fallback chains (if primary provider fails, try alternatives)
 * - Health monitoring and circuit breaker integration
 * - Cost calculation using ModelRegistry pricing
 */
export class ProviderRegistry {
  private readonly providers: Map<LLMProviderId, LLMProvider> = new Map();
  private readonly configs: Map<LLMProviderId, LLMProviderConfig> = new Map();
  private readonly eventBus: EventBus;
  private readonly modelRegistry: ModelRegistry;

  constructor(eventBus: EventBus, modelRegistry: ModelRegistry) {
    this.eventBus = eventBus;
    this.modelRegistry = modelRegistry;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Register and initialize a provider.
   * Also enables all models for that provider in the ModelRegistry.
   */
  async registerProvider(config: LLMProviderConfig): Promise<void> {
    const provider = this.createProvider(config.id);
    await provider.initialize(config);

    this.providers.set(config.id, provider);
    this.configs.set(config.id, config);

    // Enable models for this provider in the registry
    const providerModels = this.modelRegistry.getModelsByProvider(config.id);
    for (const model of providerModels) {
      if (!model.isAvailable) {
        this.modelRegistry.setAvailability(model.id, true);
      }
    }

    this.eventBus.emit('provider:connected', {
      providerId: config.id,
      models: provider.listModels(),
      latencyMs: 0,
    });
  }

  /**
   * Register all providers from environment configuration.
   * Providers without API keys are skipped (not an error).
   */
  async registerFromEnv(): Promise<void> {
    const envConfigs: Array<{ id: LLMProviderId; envKey: string }> = [
      { id: 'anthropic', envKey: 'ANTHROPIC_API_KEY' },
      { id: 'openai', envKey: 'OPENAI_API_KEY' },
      { id: 'google', envKey: 'GOOGLE_AI_API_KEY' },
      { id: 'xai', envKey: 'XAI_API_KEY' },
    ];

    for (const { id, envKey } of envConfigs) {
      const apiKey = process.env[envKey];
      if (apiKey && apiKey.trim().length > 0) {
        try {
          await this.registerProvider({
            id,
            apiKey,
            enabled: true,
            maxRetries: 3,
            timeoutMs: 60000,
            priority: id === 'anthropic' ? 10 : 50,
          });
        } catch (error) {
          this.eventBus.emit('provider:error', {
            providerId: id,
            error: error instanceof Error ? error.message : String(error),
            model: '',
            retryable: false,
          });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLETION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Route a completion to the correct provider based on model.
   * Calculates cost using ModelRegistry pricing.
   */
  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const provider = this.getProviderForModel(request.model);
    const response = await provider.complete(request);

    // Calculate cost from ModelRegistry pricing
    response.cost = this.calculateCost(
      request.model,
      response.inputTokens,
      response.outputTokens,
      response.cachedInputTokens,
    );

    return response;
  }

  /**
   * Try the primary provider, fall back to equivalents if it fails.
   */
  async completeWithFallback(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const primaryProvider = this.findProviderForModel(request.model);

    if (primaryProvider) {
      try {
        const health = primaryProvider.getHealthStatus();
        if (health.status !== 'down') {
          return await this.complete(request);
        }
      } catch (error) {
        this.eventBus.emit('provider:error', {
          providerId: primaryProvider.id,
          error: error instanceof Error ? error.message : String(error),
          model: request.model,
          retryable: true,
        });
      }
    }

    // Primary failed — try fallback providers in priority order
    const fallbackProviders = this.getFallbackProviders(primaryProvider?.id);

    for (const fallback of fallbackProviders) {
      const fallbackModel = this.findEquivalentModel(request.model, fallback.id);
      if (!fallbackModel) continue;

      try {
        const response = await this.complete({
          ...request,
          model: fallbackModel,
        });
        return response;
      } catch (error) {
        this.eventBus.emit('provider:error', {
          providerId: fallback.id,
          error: error instanceof Error ? error.message : String(error),
          model: fallbackModel,
          retryable: true,
        });
      }
    }

    throw new Error(`All providers exhausted for model ${request.model}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUTING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Find the provider that handles a given model.
   * Uses ModelRegistry to determine provider from model definition.
   */
  getProviderForModel(model: string): LLMProvider {
    const provider = this.findProviderForModel(model);
    if (!provider) {
      throw new Error(`No provider available for model: ${model}`);
    }
    return provider;
  }

  private findProviderForModel(model: string): LLMProvider | null {
    // Check ModelRegistry for provider mapping
    try {
      const modelDef = this.modelRegistry.getModel(model);
      const provider = this.providers.get(modelDef.provider);
      if (provider) return provider;
    } catch {
      // Model not in registry — check providers directly
    }

    // Fallback: ask each provider if it supports this model
    for (const provider of this.providers.values()) {
      if (provider.supportsModel(model)) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Find an equivalent model from a different provider at a similar quality tier.
   */
  private findEquivalentModel(model: string, targetProvider: LLMProviderId): string | null {
    try {
      const originalModel = this.modelRegistry.getModel(model);
      const targetModels = this.modelRegistry.getModelsByProvider(targetProvider);

      // Find closest quality match that's available
      const candidates = targetModels
        .filter(m => m.isAvailable)
        .sort((a, b) =>
          Math.abs(a.quality - originalModel.quality) -
          Math.abs(b.quality - originalModel.quality),
        );

      return candidates[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get fallback providers sorted by priority (lower = preferred).
   */
  private getFallbackProviders(excludeId?: LLMProviderId): LLMProvider[] {
    return Array.from(this.configs.entries())
      .filter(([id, config]) => id !== excludeId && config.enabled)
      .sort(([, a], [, b]) => a.priority - b.priority)
      .map(([id]) => this.providers.get(id))
      .filter((p): p is LLMProvider => p !== undefined);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH & STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  getHealthStatus(providerId: LLMProviderId): ProviderHealthStatus | null {
    const provider = this.providers.get(providerId);
    return provider?.getHealthStatus() ?? null;
  }

  async testAllProviders(): Promise<Map<LLMProviderId, ConnectionTestResult>> {
    const results = new Map<LLMProviderId, ConnectionTestResult>();

    for (const [id, provider] of this.providers) {
      const result = await provider.testConnection();
      results.set(id, result);

      if (result.connected) {
        this.eventBus.emit('provider:health_changed', {
          providerId: id,
          status: 'healthy',
        });
      } else {
        this.eventBus.emit('provider:health_changed', {
          providerId: id,
          status: 'down',
        });
      }
    }

    return results;
  }

  getActiveProviders(): LLMProviderId[] {
    return Array.from(this.providers.keys());
  }

  getProvider(id: LLMProviderId): LLMProvider | undefined {
    return this.providers.get(id);
  }

  isProviderRegistered(id: LLMProviderId): boolean {
    return this.providers.has(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHUTDOWN
  // ═══════════════════════════════════════════════════════════════════════════

  async shutdownAll(): Promise<void> {
    for (const [id, provider] of this.providers) {
      try {
        await provider.shutdown();
        this.eventBus.emit('provider:disconnected', {
          providerId: id,
          reason: 'shutdown',
        });
      } catch {
        // Best-effort shutdown
      }
    }
    this.providers.clear();
    this.configs.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════════

  private createProvider(id: LLMProviderId): LLMProvider {
    switch (id) {
      case 'anthropic': return new AnthropicProvider();
      case 'openai': return new OpenAIProvider();
      case 'google': return new GoogleProvider();
      case 'xai': return new XAIProvider();
      default: throw new Error(`Unknown provider: ${String(id)}`);
    }
  }

  private calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cachedInputTokens: number,
  ): number {
    try {
      return this.modelRegistry.getCost(model, inputTokens, outputTokens, cachedInputTokens);
    } catch {
      // Model not in registry — use a default estimate
      return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
    }
  }
}
