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
// XAI PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * xAI Grok API provider.
 *
 * Features:
 * - OpenAI-compatible REST API
 * - Automatic prefix caching — 75% off input pricing
 * - Models: grok-4-0709, grok-4-1-fast-reasoning, grok-4-fast-non-reasoning, grok-3-mini
 * - Streaming via client.chat.completions.create({ stream: true })
 */
export class XAIProvider implements LLMProvider {
  readonly id = 'xai' as const;
  readonly name = 'xAI Grok';

  private client: OpenAI | null = null;
  private config: LLMProviderConfig | null = null;
  private lastSuccessAt: string | null = null;
  private consecutiveFailures = 0;
  private lastCheckAt: string = new Date().toISOString();
  private lastLatencyMs = 0;

  private static readonly SUPPORTED_MODELS = [
    'grok-4-0709',
    'grok-4-1-fast-reasoning',
    'grok-4-fast-non-reasoning',
    'grok-3-mini',
  ];

  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize(config: LLMProviderConfig): Promise<void> {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.x.ai/v1',
      timeout: config.timeoutMs,
      maxRetries: config.maxRetries,
    });
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    if (!this.client) {
      throw new Error('XAIProvider not initialized — call initialize() first');
    }

    const startTime = Date.now();

    try {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }

      messages.push(...request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })));

      const completion = await this.client.chat.completions.create({
        model: request.model,
        messages,
        max_tokens: request.maxTokens,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      });

      const durationMs = Date.now() - startTime;
      const content = completion.choices[0]?.message?.content ?? '';
      const finishReason = this.mapFinishReason(completion.choices[0]?.finish_reason);

      // Extract token usage
      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;

      // xAI has automatic prefix caching — cached tokens are in prompt_tokens_details if available
      const promptTokensDetails = (completion.usage as unknown as Record<string, unknown>)
        ?.prompt_tokens_details as Record<string, unknown> | undefined;
      const cachedInputTokens = (promptTokensDetails?.cached_tokens as number) ?? 0;

      this.recordSuccess(durationMs);

      return {
        content,
        model: request.model,
        provider: 'xai',
        inputTokens,
        outputTokens,
        cachedInputTokens,
        cacheWriteTokens: 0, // xAI handles caching automatically, no explicit write tokens
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
      throw new Error('XAIProvider not initialized');
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
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
        model: 'grok-4-fast-non-reasoning',
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
    return [...XAIProvider.SUPPORTED_MODELS];
  }

  supportsModel(model: string): boolean {
    return XAIProvider.SUPPORTED_MODELS.includes(model);
  }

  supportsCaching(): boolean {
    return true; // Automatic prefix caching with 75% discount
  }

  getHealthStatus(): ProviderHealthStatus {
    return {
      providerId: 'xai',
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
    reason: string | null | undefined,
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
