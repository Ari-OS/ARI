/**
 * Langfuse Observability Wrapper
 *
 * Instruments ALL LLM calls with traces, generations, and scores.
 * Gracefully disabled when LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are not set.
 *
 * Usage:
 *   const lf = new LangfuseWrapper();
 *   const trace = lf.trace({ name: 'chat', userId: 'pryce' });
 *   const gen = trace.generation({ name: 'claude', model: 'claude-sonnet-4-6', input: [...] });
 *   gen.end({ output: 'response', inputTokens: 100, outputTokens: 200, latencyMs: 850 });
 *   trace.score('quality', 0.9);
 *
 * Layer: L2 System (observability)
 */

import { Langfuse } from 'langfuse';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('langfuse');

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GenerationStartParams {
  name: string;
  model: string;
  input: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
  promptName?: string;
  promptVersion?: number;
}

export interface GenerationEndParams {
  output: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd?: number;
  metadata?: Record<string, unknown>;
}

export interface LangfuseGenerationHandle {
  end: (params: GenerationEndParams) => void;
}

export interface LangfuseTraceHandle {
  readonly id: string;
  generation: (params: GenerationStartParams) => LangfuseGenerationHandle;
  span: (name: string, metadata?: Record<string, unknown>) => { end: () => void };
  score: (name: string, value: number, comment?: string) => void;
  end: (metadata?: Record<string, unknown>) => void;
}

// ─── Null trace (when Langfuse disabled) ──────────────────────────────────────

function createNullTrace(id: string): LangfuseTraceHandle {
  return {
    id,
    generation: () => ({ end: () => undefined }),
    span: () => ({ end: () => undefined }),
    score: () => undefined,
    end: () => undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANGFUSE WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

export class LangfuseWrapper {
  private readonly client: Langfuse | null;
  private readonly enabled: boolean;

  constructor(params?: {
    publicKey?: string;
    secretKey?: string;
    baseUrl?: string;
  }) {
    const publicKey = params?.publicKey ?? process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = params?.secretKey ?? process.env.LANGFUSE_SECRET_KEY;
    const baseUrl = params?.baseUrl ?? process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com';

    if (publicKey && secretKey) {
      this.client = new Langfuse({
        publicKey,
        secretKey,
        baseUrl,
        flushAt: 10,           // Flush every 10 events
        flushInterval: 30_000, // Or every 30 seconds
        requestTimeout: 10_000,
      });
      this.enabled = true;
      log.info({ baseUrl }, 'Langfuse tracing enabled');
    } else {
      this.client = null;
      this.enabled = false;
      log.info('Langfuse tracing disabled (no API keys configured)');
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Create a trace for a user conversation or pipeline run.
   * All LLM calls within a conversation should use the same trace.
   */
  trace(params: {
    name: string;
    userId?: string;
    sessionId?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): LangfuseTraceHandle {
    if (!this.client) {
      return createNullTrace(`local-${Date.now()}`);
    }

    const trace = this.client.trace({
      name: params.name,
      userId: params.userId,
      sessionId: params.sessionId,
      tags: params.tags ?? [],
      metadata: params.metadata,
    });

    return {
      id: trace.id,

      generation: (genParams: GenerationStartParams): LangfuseGenerationHandle => {
        const startTime = Date.now();

        const gen = trace.generation({
          name: genParams.name,
          model: genParams.model,
          input: genParams.input as unknown as object,
          metadata: genParams.metadata,
          ...(genParams.promptName ? {
            promptName: genParams.promptName,
            promptVersion: genParams.promptVersion,
          } : {}),
        });

        return {
          end: (endParams: GenerationEndParams) => {
            gen.end({
              output: endParams.output,
              usage: {
                input: endParams.inputTokens,
                output: endParams.outputTokens,
                total: endParams.inputTokens + endParams.outputTokens,
                unit: 'TOKENS',
              },
              metadata: {
                ...endParams.metadata,
                latencyMs: endParams.latencyMs || (Date.now() - startTime),
                costUsd: endParams.costUsd,
              },
            });
          },
        };
      },

      span: (name: string, metadata?: Record<string, unknown>) => {
        const span = trace.span({ name, metadata });
        return { end: () => span.end() };
      },

      score: (name: string, value: number, comment?: string) => {
        this.client?.score({
          traceId: trace.id,
          name,
          value,
          comment,
        });
      },

      end: (metadata?: Record<string, unknown>) => {
        trace.update({ metadata });
      },
    };
  }

  /**
   * Flush all pending events to Langfuse.
   * Call on process shutdown or after critical operations.
   */
  async flush(): Promise<void> {
    if (this.client) {
      await this.client.flushAsync();
      log.info('Langfuse events flushed');
    }
  }

  /**
   * Shutdown the client gracefully.
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.shutdownAsync();
    }
  }

  /**
   * Get a summary of active traces for dashboard use.
   */
  getStatus(): { enabled: boolean; baseUrl: string } {
    return {
      enabled: this.enabled,
      baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
    };
  }
}

// ── Singleton for app-wide use ─────────────────────────────────────────────────

let _instance: LangfuseWrapper | null = null;

export function getLangfuse(): LangfuseWrapper {
  if (!_instance) {
    _instance = new LangfuseWrapper();
  }
  return _instance;
}
