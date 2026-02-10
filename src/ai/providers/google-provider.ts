import { GoogleGenAI } from '@google/genai';
import type {
  LLMProvider,
  LLMProviderConfig,
  LLMCompletionRequest,
  LLMCompletionResponse,
  ConnectionTestResult,
  ProviderHealthStatus,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE GEMINI PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Google Gemini API provider.
 *
 * Features:
 * - Uses @google/genai package (NOT @google/generative-ai — EOL)
 * - Manual context caching: 32,768 token minimum, 75% discount
 * - Caching: Supported but not yet implemented (returns supportsCaching: true)
 * - Models: gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite
 */
export class GoogleProvider implements LLMProvider {
  readonly id = 'google' as const;
  readonly name = 'Google Gemini';

  private client: GoogleGenAI | null = null;
  private config: LLMProviderConfig | null = null;
  private lastSuccessAt: string | null = null;
  private consecutiveFailures = 0;
  private lastCheckAt: string = new Date().toISOString();
  private lastLatencyMs = 0;

  private static readonly SUPPORTED_MODELS = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ];

  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize(config: LLMProviderConfig): Promise<void> {
    this.config = config;
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    if (!this.client) {
      throw new Error('GoogleProvider not initialized — call initialize() first');
    }

    const startTime = Date.now();

    try {
      // Map messages: 'assistant' -> 'model', 'user' -> 'user'
      const contents = request.messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      // Build generation config
      const generationConfig: Record<string, unknown> = {
        maxOutputTokens: request.maxTokens,
      };

      if (request.temperature !== undefined) {
        generationConfig.temperature = request.temperature;
      }

      // System prompt goes in config.systemInstruction
      if (request.systemPrompt) {
        generationConfig.systemInstruction = request.systemPrompt;
      }

      const apiResponse = await this.client.models.generateContent({
        model: request.model,
        contents,
        config: generationConfig,
      });

      const durationMs = Date.now() - startTime;

      // Extract text content
      const content = apiResponse.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      // Extract usage metadata
      const usageMetadata = apiResponse.usageMetadata ?? {};
      const inputTokens = (usageMetadata.promptTokenCount as number) ?? 0;
      const outputTokens = (usageMetadata.candidatesTokenCount as number) ?? 0;
      const cachedInputTokens = (usageMetadata.cachedContentTokenCount as number) ?? 0;

      this.recordSuccess(durationMs);

      return {
        content,
        model: request.model,
        provider: 'google',
        inputTokens,
        outputTokens,
        cachedInputTokens,
        cacheWriteTokens: 0, // Manual caching not yet implemented
        durationMs,
        cost: 0, // Calculated by ProviderRegistry using ModelRegistry pricing
        finishReason: this.mapFinishReason(apiResponse.candidates?.[0]?.finishReason),
      };
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.client) {
      return { connected: false, latencyMs: 0, error: 'Provider not initialized' };
    }

    const startTime = Date.now();
    try {
      await this.client.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        config: { maxOutputTokens: 10 },
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
    return [...GoogleProvider.SUPPORTED_MODELS];
  }

  supportsModel(model: string): boolean {
    return GoogleProvider.SUPPORTED_MODELS.includes(model);
  }

  supportsCaching(): boolean {
    // Manual caching supported but not yet implemented
    // Minimum: 32,768 tokens, 75% discount
    return true;
  }

  getHealthStatus(): ProviderHealthStatus {
    return {
      providerId: 'google',
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
      case 'STOP': return 'stop';
      case 'MAX_TOKENS': return 'max_tokens';
      case 'SAFETY': return 'error';
      case 'RECITATION': return 'error';
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
