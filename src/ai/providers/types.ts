import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER IDENTITY
// ═══════════════════════════════════════════════════════════════════════════════

export const LLMProviderIdSchema = z.enum(['anthropic', 'openai', 'google', 'xai']);
export type LLMProviderId = z.infer<typeof LLMProviderIdSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const LLMProviderConfigSchema = z.object({
  id: LLMProviderIdSchema,
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
  enabled: z.boolean().default(true),
  maxRetries: z.number().int().min(0).max(5).default(3),
  timeoutMs: z.number().int().min(5000).max(300000).default(60000),
  priority: z.number().int().min(0).max(100).default(50),
});
export type LLMProviderConfig = z.infer<typeof LLMProviderConfigSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETION REQUEST / RESPONSE
// ═══════════════════════════════════════════════════════════════════════════════

export const LLMCompletionRequestSchema = z.object({
  model: z.string().min(1),
  systemPrompt: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
  maxTokens: z.number().int().positive(),
  temperature: z.number().min(0).max(2).optional(),
  tools: z.array(z.unknown()).optional(),
  cachingEnabled: z.boolean().default(true),
  responseFormat: z.enum(['text', 'json']).default('text'),
});
export type LLMCompletionRequest = z.infer<typeof LLMCompletionRequestSchema>;

export interface ToolCallResult {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface StreamChunk {
  type: 'text_delta' | 'tool_call' | 'done';
  text?: string;
  toolCall?: ToolCallResult;
}

export interface LLMCompletionResponse {
  content: string;
  model: string;
  provider: LLMProviderId;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  durationMs: number;
  cost: number;
  finishReason: 'stop' | 'max_tokens' | 'tool_use' | 'error';
  toolCalls?: ToolCallResult[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER HEALTH
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProviderHealthStatus {
  providerId: LLMProviderId;
  status: 'healthy' | 'degraded' | 'down';
  lastCheckAt: string;
  lastSuccessAt: string | null;
  latencyMs: number;
  consecutiveFailures: number;
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

export interface ConnectionTestResult {
  connected: boolean;
  latencyMs: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LLMProvider — Strategy pattern interface for LLM API providers.
 *
 * Each provider (Anthropic, OpenAI, Google, xAI) implements this interface.
 * The ProviderRegistry selects the right provider at runtime based on
 * model→provider mapping.
 */
export interface LLMProvider {
  readonly id: LLMProviderId;
  readonly name: string;

  initialize(config: LLMProviderConfig): Promise<void>;
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
  stream?(request: LLMCompletionRequest): AsyncIterable<StreamChunk>;
  testConnection(): Promise<ConnectionTestResult>;
  listModels(): string[];
  supportsModel(model: string): boolean;
  supportsCaching(): boolean;
  getHealthStatus(): ProviderHealthStatus;
  shutdown(): Promise<void>;
}
