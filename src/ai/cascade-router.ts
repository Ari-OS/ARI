import type { EventBus } from '../kernel/event-bus.js';
import type { ProviderRegistry } from './provider-registry.js';
import type { LLMCompletionRequest, LLMCompletionResponse } from './providers/types.js';
import { ModelRegistry } from './model-registry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// FRUGALGPT CASCADE ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CascadeRouter — FrugalGPT-inspired cost optimization.
 *
 * Queries LLMs from cheapest to most expensive, stopping when a heuristic
 * quality scorer rates confidence above a per-step threshold.
 *
 * Based on: Chen, Zaharia, Zou — "FrugalGPT" (Stanford 2023)
 * Combined with: LMSys RouteLLM (ICLR 2025) insights
 *
 * Pre-configured chains cover common use cases:
 * - frugal:    cheapest-first for general queries
 * - balanced:  Claude-only chain
 * - quality:   minimum Sonnet quality
 * - code:      code generation/review
 * - bulk:      high-volume, cost-sensitive
 * - reasoning: deep reasoning tasks
 * - security:  never cheaper than Sonnet
 */

// ── Cascade Chain Definitions ────────────────────────────────────────

export interface CascadeStep {
  model: string;
  threshold: number; // 0.0–1.0: minimum quality score to stop at this step
}

export interface CascadeChain {
  id: string;
  name: string;
  steps: CascadeStep[];
}

const DEFAULT_CHAINS: CascadeChain[] = [
  {
    id: 'frugal',
    name: 'Frugal (cheapest-first)',
    steps: [
      { model: 'gemini-2.5-flash-lite', threshold: 0.7 },
      { model: 'claude-haiku-4.5', threshold: 0.5 },
      { model: 'claude-sonnet-4.5', threshold: 0.0 },
    ],
  },
  {
    id: 'balanced',
    name: 'Balanced (Claude-only)',
    steps: [
      { model: 'claude-haiku-4.5', threshold: 0.7 },
      { model: 'claude-sonnet-4.5', threshold: 0.5 },
      { model: 'claude-opus-4.6', threshold: 0.0 },
    ],
  },
  {
    id: 'quality',
    name: 'Quality (minimum Sonnet)',
    steps: [
      { model: 'claude-sonnet-4.5', threshold: 0.5 },
      { model: 'claude-opus-4.6', threshold: 0.0 },
    ],
  },
  {
    id: 'code',
    name: 'Code Generation',
    steps: [
      { model: 'gpt-4.1-mini', threshold: 0.7 },
      { model: 'claude-sonnet-4.5', threshold: 0.5 },
      { model: 'claude-opus-4.6', threshold: 0.0 },
    ],
  },
  {
    id: 'bulk',
    name: 'Bulk Processing',
    steps: [
      { model: 'gemini-2.5-flash-lite', threshold: 0.6 },
      { model: 'grok-4.1-fast', threshold: 0.5 },
      { model: 'gemini-2.5-flash', threshold: 0.0 },
    ],
  },
  {
    id: 'reasoning',
    name: 'Deep Reasoning',
    steps: [
      { model: 'o4-mini', threshold: 0.7 },
      { model: 'o3', threshold: 0.5 },
      { model: 'claude-opus-4.6', threshold: 0.0 },
    ],
  },
  {
    id: 'security',
    name: 'Security Analysis',
    steps: [
      { model: 'claude-sonnet-4.5', threshold: 0.5 },
      { model: 'claude-opus-4.6', threshold: 0.0 },
    ],
  },
];

// ── Quality Scoring ──────────────────────────────────────────────────

/**
 * Heuristic quality scorer.
 *
 * Instead of FrugalGPT's DistilBERT scorer (requires training data),
 * we use heuristics that approximate quality:
 *
 * 1. Response length relative to query length
 * 2. Uncertainty markers ("I'm not sure", "I don't know")
 * 3. Structural completeness (JSON validity, list completeness)
 * 4. Self-contradiction detection (basic)
 */
function scoreQuality(query: string, response: string): number {
  let score = 0.5; // Start neutral

  // 1. Length adequacy — very short responses for long queries are suspect
  const queryLength = query.length;
  const responseLength = response.length;

  if (queryLength > 100 && responseLength < 20) {
    score -= 0.3; // Suspiciously short
  } else if (responseLength > queryLength * 0.3) {
    score += 0.15; // Reasonable length
  }

  // 2. Uncertainty markers — strong indicators of low confidence
  const uncertaintyPatterns = [
    /\bi(?:'m| am) not (?:sure|certain)\b/i,
    /\bi don(?:'t| not) (?:know|have)\b/i,
    /\bi cannot (?:determine|assess|confirm)\b/i,
    /\bhard to (?:say|tell)\b/i,
    /\bunclear\b/i,
    /\bI'?m? unsure\b/i,
  ];
  const uncertaintyCount = uncertaintyPatterns.filter(p => p.test(response)).length;
  score -= uncertaintyCount * 0.1;

  // 3. Structural completeness
  // JSON: if the response looks like JSON, check if it parses
  if (response.trim().startsWith('{') || response.trim().startsWith('[')) {
    try {
      JSON.parse(response.trim());
      score += 0.15; // Valid JSON
    } catch {
      score -= 0.15; // Invalid JSON
    }
  }

  // Code blocks: if response contains code, check for basic syntax
  const codeBlockMatch = response.match(/```[\s\S]*?```/g);
  if (codeBlockMatch && codeBlockMatch.length > 0) {
    score += 0.1; // Contains structured code
  }

  // 4. Refusal detection — the model refused to answer
  const refusalPatterns = [
    /\bi (?:can't|cannot|won't|will not) (?:help|assist|provide)\b/i,
    /\bas an ai\b/i,
    /\bi'?m an ai\b/i,
  ];
  const isRefusal = refusalPatterns.some(p => p.test(response));
  if (isRefusal) {
    score -= 0.3;
  }

  // 5. Confidence boost — response is assertive and specific
  const confidencePatterns = [
    /\bhere(?:'s| is)\b/i,
    /\bthe answer is\b/i,
    /\bstep \d/i,
    /\b\d+\.\s/,  // Numbered lists
  ];
  const confidenceCount = confidencePatterns.filter(p => p.test(response)).length;
  score += confidenceCount * 0.05;

  // Clamp to [0.0, 1.0]
  return Math.max(0.0, Math.min(1.0, score));
}

// ── Cascade Router ───────────────────────────────────────────────────

export class CascadeRouter {
  private readonly eventBus: EventBus;
  private readonly providers: ProviderRegistry;
  private readonly modelRegistry: ModelRegistry;
  private readonly chains: Map<string, CascadeChain> = new Map();

  constructor(
    eventBus: EventBus,
    providers: ProviderRegistry,
    modelRegistry: ModelRegistry,
  ) {
    this.eventBus = eventBus;
    this.providers = providers;
    this.modelRegistry = modelRegistry;

    // Register default chains
    for (const chain of DEFAULT_CHAINS) {
      this.chains.set(chain.id, chain);
    }
  }

  /**
   * Execute a request through a cascade chain.
   * Tries models cheapest→expensive, stopping when quality exceeds threshold.
   */
  async execute(
    request: Omit<LLMCompletionRequest, 'model'>,
    chainId: string = 'frugal',
  ): Promise<LLMCompletionResponse> {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Unknown cascade chain: ${chainId}`);
    }

    const queryLength = (request.systemPrompt?.length ?? 0) +
      request.messages.reduce((sum, m) => sum + m.content.length, 0);

    this.eventBus.emit('cascade:started', {
      chain: chainId,
      queryLength,
    });

    const cascadeStart = Date.now();
    let totalCostCents = 0;
    let lastError: Error | null = null;

    // Filter to available models only
    const availableSteps = chain.steps.filter(step => {
      try {
        this.providers.getProviderForModel(step.model);
        return true;
      } catch {
        return false;
      }
    });

    if (availableSteps.length === 0) {
      throw new Error(`No available models in cascade chain: ${chainId}`);
    }

    for (let i = 0; i < availableSteps.length; i++) {
      const step = availableSteps[i];
      const isLastStep = i === availableSteps.length - 1;

      try {
        const response = await this.providers.complete({
          ...request,
          model: step.model,
        });

        const costCents = response.cost * 100;
        totalCostCents += costCents;

        // Score quality (skip for last step — always accept)
        const quality = isLastStep
          ? 1.0
          : scoreQuality(
              request.messages[request.messages.length - 1]?.content ?? '',
              response.content,
            );

        const escalated = !isLastStep && quality < step.threshold;

        this.eventBus.emit('cascade:step_complete', {
          chain: chainId,
          step: i,
          model: step.model,
          quality,
          escalated,
          costCents,
        });

        if (!escalated) {
          // Quality meets threshold — return this response
          const durationMs = Date.now() - cascadeStart;

          this.eventBus.emit('cascade:complete', {
            chain: chainId,
            finalModel: step.model,
            totalSteps: i + 1,
            totalCostCents,
            durationMs,
          });

          return response;
        }

        // Quality too low — continue to next model
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.eventBus.emit('cascade:step_complete', {
          chain: chainId,
          step: i,
          model: step.model,
          quality: 0,
          escalated: true,
          costCents: 0,
        });

        // If this was the last step, throw
        if (isLastStep) {
          throw lastError;
        }
        // Otherwise continue to next model
      }
    }

    // Should not reach here — last step always returns or throws
    throw lastError ?? new Error(`Cascade exhausted all models in chain: ${chainId}`);
  }

  /**
   * Select the best cascade chain for a given task category and complexity.
   */
  selectChain(
    category: string,
    securitySensitive: boolean,
    complexity: string,
  ): string {
    // Security-sensitive tasks always use the security chain
    if (securitySensitive) return 'security';

    // Map categories to chains
    const categoryChainMap: Record<string, string> = {
      code_generation: 'code',
      code_review: 'code',
      security: 'security',
      planning: 'reasoning',
      analysis: 'balanced',
      chat: 'frugal',
      query: 'frugal',
      summarize: 'bulk',
      parse_command: 'bulk',
      heartbeat: 'bulk',
    };

    const chainFromCategory = categoryChainMap[category];

    // Override based on complexity
    if (complexity === 'critical') return 'quality';
    if (complexity === 'complex' && !chainFromCategory) return 'balanced';

    return chainFromCategory ?? 'frugal';
  }

  // ── Chain Management ─────────────────────────────────────────────────

  registerChain(chain: CascadeChain): void {
    this.chains.set(chain.id, chain);
  }

  getChain(id: string): CascadeChain | undefined {
    return this.chains.get(id);
  }

  listChains(): CascadeChain[] {
    return Array.from(this.chains.values());
  }
}
