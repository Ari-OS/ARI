import OpenAI from 'openai';
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
// OPENAI PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * OpenAI GPT API provider.
 *
 * Features:
 * - Automatic prompt caching: 1,024 token minimum, 128-token granularity
 * - Cache discount: 50% on cached reads, no write surcharge
 * - Cache TTL: Automatic (managed by OpenAI)
 * - Streaming via client.chat.completions.create({ stream: true })
 * - Support for GPT-5.2, GPT-4.1 family, O3, O4-mini, Codex
 */
export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai' as const;
  readonly name = 'OpenAI GPT';

  private client: OpenAI | null = null;
  private config: LLMProviderConfig | null = null;
  private lastSuccessAt: string | null = null;
  private consecutiveFailures = 0;
  private lastCheckAt: string = new Date().toISOString();
  private lastLatencyMs = 0;

  private static readonly SUPPORTED_MODELS = [
    'gpt-5.2',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'o3',
    'o4-mini',
    'codex-mini-latest',
  ];

  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize(config: LLMProviderConfig): Promise<void> {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      timeout: config.timeoutMs,
      maxRetries: config.maxRetries,
    });
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    if (!this.client) {
      throw new Error('OpenAIProvider not initialized — call initialize() first');
    }

    const startTime = Date.now();

    try {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt,
        });
      }

      messages.push(...request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })));

      const apiResponse = await this.client.chat.completions.create({
        model: request.model,
        messages,
        max_tokens: request.maxTokens,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...(request.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
      });

      const durationMs = Date.now() - startTime;
      const content = apiResponse.choices[0]?.message?.content ?? '';
      const finishReason = this.mapFinishReason(apiResponse.choices[0]?.finish_reason ?? 'stop');

      const inputTokens = apiResponse.usage?.prompt_tokens ?? 0;
      const outputTokens = apiResponse.usage?.completion_tokens ?? 0;
      const cachedInputTokens = apiResponse.usage?.prompt_tokens_details?.cached_tokens ?? 0;

      this.recordSuccess(durationMs);

      return {
        content,
        model: apiResponse.model,
        provider: 'openai',
        inputTokens,
        outputTokens,
        cachedInputTokens,
        cacheWriteTokens: 0, // OpenAI doesn't charge for cache writes
        durationMs,
        cost: 0, // Calculated by ProviderRegistry using ModelRegistry pricing
        finishReason,
      };
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  async *stream(request: LLMCompletionRequest): AsyncIterable<StreamChunk> {
    if (!this.client) {
      throw new Error('OpenAIProvider not initialized');
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt,
      });
    }

    messages.push(...request.messages.map(m => ({
      role: m.role,
      content: m.content,
    })));

    const stream = await this.client.chat.completions.create({
      model: request.model,
      messages,
      max_tokens: request.maxTokens,
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield { type: 'text_delta', text: delta.content };
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
      await this.client.chat.completions.create({
        model: 'gpt-4.1-nano',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 10,
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
    return [...OpenAIProvider.SUPPORTED_MODELS];
  }

  supportsModel(model: string): boolean {
    return OpenAIProvider.SUPPORTED_MODELS.includes(model);
  }

  supportsCaching(): boolean {
    return true;
  }

  getHealthStatus(): ProviderHealthStatus {
    return {
      providerId: 'openai',
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

  private mapFinishReason(
    reason: string,
  ): 'stop' | 'max_tokens' | 'tool_use' | 'error' {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'max_tokens';
      case 'tool_calls': return 'tool_use';
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
