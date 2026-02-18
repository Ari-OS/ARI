import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  LLMProviderConfig,
  LLMCompletionRequest,
  LLMCompletionResponse,
  ConnectionTestResult,
  ProviderHealthStatus,
  StreamChunk,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ANTHROPIC PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Anthropic Claude API provider.
 *
 * Features:
 * - Prompt caching via cache_control: { type: 'ephemeral' } — 90% input discount
 * - Cache TTL: 5 min default, up to 1 hour with explicit TTL
 * - Minimum cached block: 1,024 tokens (Sonnet/Opus), 4,096 (Haiku)
 * - Up to 4 cache breakpoints per request
 * - Streaming via client.messages.stream()
 */
export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const;
  readonly name = 'Anthropic Claude';

  private client: Anthropic | null = null;
  private config: LLMProviderConfig | null = null;
  private lastSuccessAt: string | null = null;
  private consecutiveFailures = 0;
  private lastCheckAt: string = new Date().toISOString();
  private lastLatencyMs = 0;

  private static readonly SUPPORTED_MODELS = [
    'claude-opus-4-6-20260205',
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-6',
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-4-20250514',
    'claude-haiku-4-5-20251001',
    'claude-3-haiku-20240307',
  ];

  private static readonly MODEL_ALIASES: Record<string, string> = {
    'claude-opus-4.6': 'claude-opus-4-6-20260205',
    'claude-opus-4.5': 'claude-opus-4-5-20251101',
    'claude-sonnet-4.6': 'claude-sonnet-4-6',
    'claude-sonnet-4.5': 'claude-sonnet-4-5-20250929',
    'claude-sonnet-4': 'claude-sonnet-4-20250514',
    'claude-haiku-4.5': 'claude-haiku-4-5-20251001',
    'claude-haiku-3': 'claude-3-haiku-20240307',
  };

  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize(config: LLMProviderConfig): Promise<void> {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      timeout: config.timeoutMs,
      maxRetries: config.maxRetries,
    });
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    if (!this.client) {
      throw new Error('AnthropicProvider not initialized — call initialize() first');
    }

    const resolvedModel = this.resolveModel(request.model);
    const startTime = Date.now();

    try {
      const systemBlocks = this.buildSystemBlocks(request);
      const apiResponse = await this.client.messages.create({
        model: resolvedModel,
        system: systemBlocks.length > 0 ? systemBlocks : undefined,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: request.maxTokens,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      });

      const durationMs = Date.now() - startTime;
      const content = apiResponse.content[0]?.type === 'text'
        ? apiResponse.content[0].text
        : '';

      const usage = apiResponse.usage as unknown as Record<string, unknown>;
      const inputTokens = apiResponse.usage.input_tokens;
      const outputTokens = apiResponse.usage.output_tokens;
      const cachedInputTokens = (usage.cache_read_input_tokens as number) ?? 0;
      const cacheWriteTokens = (usage.cache_creation_input_tokens as number) ?? 0;

      this.recordSuccess(durationMs);

      return {
        content,
        model: resolvedModel,
        provider: 'anthropic',
        inputTokens,
        outputTokens,
        cachedInputTokens,
        cacheWriteTokens,
        durationMs,
        cost: 0, // Calculated by ProviderRegistry using ModelRegistry pricing
        finishReason: this.mapStopReason(apiResponse.stop_reason),
      };
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  async *stream(request: LLMCompletionRequest): AsyncIterable<StreamChunk> {
    if (!this.client) {
      throw new Error('AnthropicProvider not initialized');
    }

    const resolvedModel = this.resolveModel(request.model);
    const systemBlocks = this.buildSystemBlocks(request);

    const stream = this.client.messages.stream({
      model: resolvedModel,
      system: systemBlocks.length > 0 ? systemBlocks : undefined,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: request.maxTokens,
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && 'delta' in event) {
        const delta = event.delta as unknown as Record<string, unknown>;
        if (delta.type === 'text_delta' && typeof delta.text === 'string') {
          yield { type: 'text_delta', text: delta.text };
        }
      }
    }

    yield { type: 'done' };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.client) {
      return { connected: false, latencyMs: 0, error: 'Provider not initialized' };
    }

    const startTime = Date.now();
    try {
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      });
      const latencyMs = Date.now() - startTime;
      this.recordSuccess(latencyMs);
      return { connected: true, latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.recordFailure();
      return {
        connected: false,
        latencyMs,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  listModels(): string[] {
    return [...AnthropicProvider.SUPPORTED_MODELS];
  }

  supportsModel(model: string): boolean {
    return (
      AnthropicProvider.SUPPORTED_MODELS.includes(model) ||
      model in AnthropicProvider.MODEL_ALIASES
    );
  }

  supportsCaching(): boolean {
    return true;
  }

  getHealthStatus(): ProviderHealthStatus {
    return {
      providerId: 'anthropic',
      status: this.getStatus(),
      lastCheckAt: this.lastCheckAt,
      lastSuccessAt: this.lastSuccessAt,
      latencyMs: this.lastLatencyMs,
      consecutiveFailures: this.consecutiveFailures,
      circuitBreakerState: this.getCircuitState(),
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async shutdown(): Promise<void> {
    this.client = null;
    this.config = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════════

  private resolveModel(model: string): string {
    return AnthropicProvider.MODEL_ALIASES[model] ?? model;
  }

  private buildSystemBlocks(
    request: LLMCompletionRequest,
  ): Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> {
    if (!request.systemPrompt) return [];

    const blocks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> = [];

    if (request.cachingEnabled) {
      blocks.push({
        type: 'text',
        text: request.systemPrompt,
        cache_control: { type: 'ephemeral' },
      });
    } else {
      blocks.push({
        type: 'text',
        text: request.systemPrompt,
      });
    }

    return blocks;
  }

  private mapStopReason(
    reason: string | null,
  ): 'stop' | 'max_tokens' | 'tool_use' | 'error' {
    switch (reason) {
      case 'end_turn': return 'stop';
      case 'max_tokens': return 'max_tokens';
      case 'tool_use': return 'tool_use';
      default: return 'stop';
    }
  }

  private recordSuccess(latencyMs: number): void {
    this.consecutiveFailures = 0;
    this.lastSuccessAt = new Date().toISOString();
    this.lastCheckAt = new Date().toISOString();
    this.lastLatencyMs = latencyMs;
  }

  private recordFailure(): void {
    this.consecutiveFailures++;
    this.lastCheckAt = new Date().toISOString();
  }

  private getStatus(): 'healthy' | 'degraded' | 'down' {
    if (this.consecutiveFailures >= 5) return 'down';
    if (this.consecutiveFailures >= 2) return 'degraded';
    return 'healthy';
  }

  private getCircuitState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    if (this.consecutiveFailures >= 5) return 'OPEN';
    if (this.consecutiveFailures >= 3) return 'HALF_OPEN';
    return 'CLOSED';
  }
}
