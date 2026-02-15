import { randomUUID } from 'node:crypto';
import type { EventBus } from '../kernel/event-bus.js';
import type { CostTracker, ThrottleLevel } from '../observability/cost-tracker.js';
import type {
  ModelTier,
  AIRequest,
  AIResponse,
  AIFeatureFlags,
  OrchestratorStatus,
  GovernanceDecision,
  TaskComplexity,
} from './types.js';
import { AIRequestSchema, AIFeatureFlagsSchema } from './types.js';
import { ModelRegistry } from './model-registry.js';
import { ProviderRegistry } from './provider-registry.js';
import { CascadeRouter } from './cascade-router.js';
import { ValueScorer } from './value-scorer.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { ResponseEvaluator } from './response-evaluator.js';
import { PromptAssembler } from './prompt-assembler.js';
import type { PerformanceTracker } from './performance-tracker.js';
import { RequestClassifier } from './request-classifier.js';
import {
  getCurrentTimeBlock,
  getBlockAdjustedChain,
  shouldAvoidModel,
} from '../autonomous/time-blocks.js';

/**
 * AIPolicyGovernor interface for dependency injection.
 * The concrete implementation is created in Phase 4.
 */
export interface AIPolicyGovernorLike {
  requestApproval(
    request: AIRequest,
    estimatedCost: number,
    selectedModel: ModelTier,
  ): Promise<GovernanceDecision>;
  requiresGovernance(request: AIRequest, estimatedCost: number): boolean;
  emergencyBudgetVote(
    currentSpend: number,
    monthlyBudget: number,
  ): Promise<GovernanceDecision>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSED COMMAND TYPE (legacy convenience method — canonical type in autonomous/types.ts)
// ═══════════════════════════════════════════════════════════════════════════════

interface OrchestratorParsedCommand {
  intent: string;
  entities: Record<string, string>;
  confidence: number;
  raw: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrchestratorConfig {
  apiKey?: string; // Deprecated — use providerRegistry instead
  providerRegistry?: ProviderRegistry;
  defaultModel?: ModelTier;
  featureFlags?: Partial<AIFeatureFlags>;
  costTracker?: CostTracker;
  policyGovernor?: AIPolicyGovernorLike;
  performanceTracker?: PerformanceTracker;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AIOrchestrator — THE single entry point for all LLM API calls.
 *
 * Replaces the fragmented system of ClaudeClient + ModelSelector + ModelRouter
 * with a unified 15-step pipeline that:
 * - Routes to optimal model via ValueScore algorithm
 * - Enforces budget via CostTracker integration
 * - Protects against cascading failures via CircuitBreaker
 * - Applies governance via Council voting
 * - Caches prompts for 90% input savings
 * - Evaluates quality and escalates to stronger models
 * - Emits llm:request_complete (THE CRITICAL FIX for BudgetTracker)
 */
export class AIOrchestrator {
  private readonly providers: ProviderRegistry;
  private readonly cascadeRouter: CascadeRouter;
  private readonly eventBus: EventBus;
  private readonly registry: ModelRegistry;
  private readonly scorer: ValueScorer;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly evaluator: ResponseEvaluator;
  private readonly assembler: PromptAssembler;
  private readonly classifier: RequestClassifier;
  private readonly featureFlags: AIFeatureFlags;
  private readonly costTracker: CostTracker | null;
  private readonly policyGovernor: AIPolicyGovernorLike | null;

  // Metrics
  private totalRequests: number = 0;
  private totalErrors: number = 0;
  private totalCost: number = 0;
  private totalLatencyMs: number = 0;
  private modelUsage: Record<string, number> = {};
  private readonly startedAt: number = Date.now();

  constructor(eventBus: EventBus, config: OrchestratorConfig) {
    this.eventBus = eventBus;
    this.registry = new ModelRegistry();

    // Initialize ProviderRegistry (use provided or create empty)
    this.providers = config.providerRegistry ?? new ProviderRegistry(eventBus, this.registry);
    this.cascadeRouter = new CascadeRouter(eventBus, this.providers, this.registry);

    this.circuitBreaker = new CircuitBreaker();
    this.scorer = new ValueScorer(eventBus, this.registry, {
      performanceTracker: config.performanceTracker,
      circuitBreaker: this.circuitBreaker,
    });
    this.evaluator = new ResponseEvaluator();
    this.assembler = new PromptAssembler(
      config.featureFlags?.AI_PROMPT_CACHING_ENABLED ?? true,
    );
    this.classifier = new RequestClassifier({
      performanceTracker: config.performanceTracker,
    });
    this.featureFlags = AIFeatureFlagsSchema.parse(config.featureFlags ?? {});
    this.costTracker = config.costTracker ?? null;
    this.policyGovernor = config.policyGovernor ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIMARY API — THE 15-STEP PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════

  async execute(request: AIRequest): Promise<AIResponse> {
    const requestId = request.requestId ?? randomUUID();

    // Step 1: VALIDATE
    const validated = AIRequestSchema.parse({ ...request, requestId });

    // Step 2: CLASSIFY (Multi-signal — replaces keyword-only classifier)
    const classification = this.classifier.classify(validated);
    const complexity = classification.complexity;

    // Emit request received with full classification data
    this.eventBus.emit('ai:request_received', {
      requestId,
      category: validated.category,
      complexity,
      classificationScore: classification.score,
      confidence: classification.confidence,
      suggestedChain: classification.suggestedChain,
      reasoning: classification.reasoning,
      agent: validated.agent,
      timestamp: new Date().toISOString(),
    });

    // Step 3: BUDGET CHECK
    const budgetState = this.getBudgetState();
    if (this.costTracker) {
      const estimatedTokens = Math.ceil(validated.content.length / 4) + 500;
      const proceed = this.costTracker.canProceed(
        estimatedTokens,
        validated.priority === 'URGENT' ? 'URGENT' : validated.priority === 'BACKGROUND' ? 'BACKGROUND' : 'STANDARD',
      );
      if (!proceed.allowed) {
        throw new Error(`Budget check failed: ${proceed.reason}`);
      }
    }

    // Step 4: CIRCUIT BREAKER
    if (!this.circuitBreaker.canExecute()) {
      this.totalErrors++;
      throw new Error('Circuit breaker is OPEN — API calls temporarily blocked');
    }

    // Step 5: MODEL SELECTION
    const scoreResult = this.scorer.score(
      {
        complexity,
        stakes: this.getStakesForCategory(validated.category),
        qualityPriority: this.getQualityPriority(complexity),
        budgetPressure: this.getBudgetPressure(budgetState),
        historicalPerformance: 5,
        securitySensitive: validated.securitySensitive,
        category: validated.category,
      },
      budgetState,
    );

    const selectedModel = scoreResult.recommendedTier;
    const estimatedCost = this.registry.estimateCost(
      selectedModel,
      Math.ceil(validated.content.length / 4),
    );

    // Emit model selected
    this.eventBus.emit('ai:model_selected', {
      requestId,
      model: selectedModel,
      valueScore: scoreResult.score,
      reasoning: scoreResult.reasoning,
      estimatedCost,
      timestamp: new Date().toISOString(),
    });

    // Step 6: GOVERNANCE
    let governanceApproved: boolean | undefined;
    if (this.featureFlags.AI_GOVERNANCE_ENABLED && this.policyGovernor) {
      const decision = await this.policyGovernor.requestApproval(
        validated,
        estimatedCost,
        selectedModel,
      );
      governanceApproved = decision.approved;
      if (!decision.approved) {
        throw new Error(`Governance rejected: ${decision.reason}`);
      }
    }

    // Step 7: PROMPT ASSEMBLY
    const assembled = this.assembler.assemble(validated);

    // Step 8: EMIT request start
    this.eventBus.emit('llm:request_start', {
      model: selectedModel,
      estimatedTokens: Math.ceil(validated.content.length / 4),
    });

    // Step 9: API CALL (via CascadeRouter or ProviderRegistry fallback)
    const startTime = Date.now();
    let response: AIResponse;

    try {
      let providerResponse;

      // Use CascadeRouter if enabled (Gap 1 fix)
      if (this.featureFlags.AI_CASCADE_ROUTING_ENABLED) {
        // Get time-block adjusted chain
        const currentBlock = getCurrentTimeBlock();
        const baseChainId = classification.suggestedChain ?? 'frugal';
        const adjustedChainId = getBlockAdjustedChain(baseChainId, currentBlock);

        // Build the cascade request (omit model field)
        const cascadeRequest = {
          systemPrompt: assembled.system?.[0]?.type === 'text'
            ? assembled.system[0].text
            : typeof assembled.system === 'string' ? assembled.system : undefined,
          messages: assembled.messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          })),
          maxTokens: assembled.maxTokens,
          cachingEnabled: this.featureFlags.AI_PROMPT_CACHING_ENABLED,
          responseFormat: 'text' as const,
        };

        // Execute cascade routing
        try {
          providerResponse = await this.cascadeRouter.execute(cascadeRequest, adjustedChainId);

          // Emit cascade routing success
          this.eventBus.emit('ai:cascade_routing_used', {
            requestId,
            chainId: adjustedChainId,
            baseChainId,
            finalModel: providerResponse.model,
            timeBlock: currentBlock.id,
            timestamp: new Date().toISOString(),
          });
        } catch (cascadeError) {
          // Cascade routing failed — fall back to single-model selection
          this.eventBus.emit('ai:cascade_routing_failed', {
            requestId,
            chainId: adjustedChainId,
            error: cascadeError instanceof Error ? cascadeError.message : String(cascadeError),
            fallingBackToModel: selectedModel,
            timestamp: new Date().toISOString(),
          });

          // Check if selected model should be avoided in current time block
          let finalModel = selectedModel;
          if (shouldAvoidModel(selectedModel)) {
            const prefs = currentBlock;
            finalModel = prefs.preferredChains[0] ?
              this.registry.listModels()[0]?.id ?? selectedModel :
              selectedModel;
          }

          // Fall back to single-model call
          providerResponse = await this.providers.completeWithFallback({
            model: finalModel,
            systemPrompt: cascadeRequest.systemPrompt,
            messages: cascadeRequest.messages,
            maxTokens: cascadeRequest.maxTokens,
            cachingEnabled: cascadeRequest.cachingEnabled,
            responseFormat: cascadeRequest.responseFormat,
          });
        }
      } else {
        // Cascade routing disabled — use original single-model logic
        providerResponse = await this.providers.completeWithFallback({
          model: selectedModel,
          systemPrompt: assembled.system?.[0]?.type === 'text'
            ? assembled.system[0].text
            : typeof assembled.system === 'string' ? assembled.system : undefined,
          messages: assembled.messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          })),
          maxTokens: assembled.maxTokens,
          cachingEnabled: this.featureFlags.AI_PROMPT_CACHING_ENABLED,
          responseFormat: 'text',
        });
      }

      const duration = Date.now() - startTime;
      const content = providerResponse.content;
      const inputTokens = providerResponse.inputTokens;
      const outputTokens = providerResponse.outputTokens;
      const cachedTokens = providerResponse.cachedInputTokens;
      const cost = providerResponse.cost;

      response = {
        requestId,
        content,
        model: providerResponse.model,
        inputTokens,
        outputTokens,
        cost,
        duration,
        cached: cachedTokens > 0,
        qualityScore: 1.0,
        escalated: false,
        governanceApproved,
      };

      // Step 10: EMIT llm:request_complete — THE CRITICAL FIX
      this.eventBus.emit('llm:request_complete', {
        timestamp: new Date().toISOString(),
        model: selectedModel,
        inputTokens,
        outputTokens,
        cost,
        taskType: complexity,
        taskCategory: validated.category,
        duration,
        success: true,
      });

      // Step 11: COST TRACKING
      if (this.costTracker) {
        this.costTracker.track({
          operation: validated.category,
          agent: validated.agent,
          provider: providerResponse.provider,
          model: providerResponse.model,
          inputTokens,
          outputTokens,
        });
      }

      // Update metrics
      this.totalRequests++;
      this.totalCost += cost;
      this.totalLatencyMs += duration;
      this.modelUsage[selectedModel] = (this.modelUsage[selectedModel] ?? 0) + 1;

      // Step 12: QUALITY EVALUATION
      const evaluation = this.evaluator.evaluate(validated, response, complexity);
      response.qualityScore = evaluation.qualityScore;

      // Emit evaluation
      this.eventBus.emit('ai:response_evaluated', {
        requestId,
        qualityScore: evaluation.qualityScore,
        escalated: false,
        timestamp: new Date().toISOString(),
      });

      // Step 13: ESCALATION (conditional)
      if (
        this.featureFlags.AI_QUALITY_ESCALATION_ENABLED &&
        evaluation.shouldEscalate
      ) {
        const escalatedResponse = await this.escalate(
          validated,
          selectedModel,
          complexity,
          requestId,
          governanceApproved,
        );
        if (escalatedResponse) {
          return escalatedResponse;
        }
      }

      // Step 14: CIRCUIT BREAKER UPDATE
      this.circuitBreaker.recordSuccess();

      // Step 15: RETURN
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Emit failed request
      this.eventBus.emit('llm:request_complete', {
        timestamp: new Date().toISOString(),
        model: selectedModel,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        taskType: complexity,
        taskCategory: validated.category,
        duration,
        success: false,
      });

      this.totalErrors++;
      this.circuitBreaker.recordFailure();

      // Emit circuit breaker state if changed
      const cbState = this.circuitBreaker.getState();
      if (cbState === 'OPEN') {
        this.eventBus.emit('ai:circuit_breaker_state_changed', {
          previousState: 'CLOSED',
          newState: 'OPEN',
          failures: this.circuitBreaker.getStats().failures,
          timestamp: new Date().toISOString(),
        });
      }

      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVENIENCE METHODS (backward-compatible with ClaudeClient)
  // ═══════════════════════════════════════════════════════════════════════════

  async query(question: string, agent: string = 'core'): Promise<string> {
    const response = await this.execute({
      content: question,
      category: 'query',
      agent: agent as AIRequest['agent'],
      trustLevel: 'system',
      priority: 'STANDARD',
      enableCaching: true,
      securitySensitive: false,
    });
    return response.content;
  }

  async chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string,
    agent: string = 'core',
  ): Promise<string> {
    const lastMessage = messages[messages.length - 1];
    const response = await this.execute({
      content: lastMessage?.content ?? '',
      category: 'chat',
      agent: agent as AIRequest['agent'],
      trustLevel: 'system',
      priority: 'STANDARD',
      enableCaching: true,
      securitySensitive: false,
      systemPrompt,
      messages,
    });
    return response.content;
  }

  async summarize(
    text: string,
    maxLength: number = 200,
    agent: string = 'core',
  ): Promise<string> {
    if (text.length <= maxLength) return text;
    const response = await this.execute({
      content: `Summarize in under ${maxLength} characters:\n\n${text}`,
      category: 'summarize',
      agent: agent as AIRequest['agent'],
      trustLevel: 'system',
      priority: 'STANDARD',
      enableCaching: true,
      securitySensitive: false,
      maxTokens: 100,
    });
    return response.content.slice(0, maxLength);
  }

  async parseCommand(
    input: string,
    agent: string = 'core',
  ): Promise<OrchestratorParsedCommand> {
    const response = await this.execute({
      content: `Parse this command and return JSON with intent, entities, and confidence:\n\n${input}`,
      category: 'parse_command',
      agent: agent as AIRequest['agent'],
      trustLevel: 'system',
      priority: 'STANDARD',
      enableCaching: true,
      securitySensitive: false,
    });

    try {
      return JSON.parse(response.content) as OrchestratorParsedCommand;
    } catch {
      return {
        intent: 'unknown',
        entities: {},
        confidence: 0,
        raw: input,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS & LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  getStatus(): OrchestratorStatus {
    return {
      enabled: this.featureFlags.AI_ORCHESTRATOR_ENABLED,
      featureFlags: this.featureFlags,
      circuitBreakerState: this.circuitBreaker.getState(),
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      totalCost: this.totalCost,
      averageLatencyMs: this.totalRequests > 0
        ? this.totalLatencyMs / this.totalRequests
        : 0,
      modelUsage: { ...this.modelUsage },
      uptime: Date.now() - this.startedAt,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const results = await this.providers.testAllProviders();
      return Array.from(results.values()).some(r => r.connected);
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    await this.providers.shutdownAll();
    if (this.costTracker) {
      await this.costTracker.shutdown();
    }
  }

  getRegistry(): ModelRegistry {
    return this.registry;
  }

  getProviderRegistry(): ProviderRegistry {
    return this.providers;
  }

  getCascadeRouter(): CascadeRouter {
    return this.cascadeRouter;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async escalate(
    request: AIRequest,
    currentModel: ModelTier,
    complexity: TaskComplexity,
    requestId: string,
    governanceApproved: boolean | undefined,
  ): Promise<AIResponse | null> {
    const higherTier = this.getNextHigherTier(currentModel);
    if (!higherTier || !this.registry.isAvailable(higherTier)) {
      return null;
    }

    const assembled = this.assembler.assemble(request);
    const startTime = Date.now();

    try {
      const providerResponse = await this.providers.completeWithFallback({
        model: higherTier,
        systemPrompt: assembled.system?.[0]?.type === 'text'
          ? assembled.system[0].text
          : typeof assembled.system === 'string' ? assembled.system : undefined,
        messages: assembled.messages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
        maxTokens: assembled.maxTokens,
        cachingEnabled: this.featureFlags.AI_PROMPT_CACHING_ENABLED,
        responseFormat: 'text',
      });

      const duration = Date.now() - startTime;
      const content = providerResponse.content;
      const inputTokens = providerResponse.inputTokens;
      const outputTokens = providerResponse.outputTokens;
      const cachedTokens = providerResponse.cachedInputTokens;
      const cost = providerResponse.cost;

      // Emit for escalated call
      this.eventBus.emit('llm:request_complete', {
        timestamp: new Date().toISOString(),
        model: higherTier,
        inputTokens,
        outputTokens,
        cost,
        taskType: complexity,
        taskCategory: request.category,
        duration,
        success: true,
      });

      if (this.costTracker) {
        this.costTracker.track({
          operation: `${request.category}_escalated`,
          agent: request.agent,
          provider: providerResponse.provider,
          model: providerResponse.model,
          inputTokens,
          outputTokens,
        });
      }

      this.totalCost += cost;
      this.modelUsage[higherTier] = (this.modelUsage[higherTier] ?? 0) + 1;

      // Re-evaluate quality
      const escalatedResponse: AIResponse = {
        requestId,
        content,
        model: higherTier,
        inputTokens,
        outputTokens,
        cost,
        duration,
        cached: cachedTokens > 0,
        qualityScore: 1.0,
        escalated: true,
        escalationReason: `Escalated from ${currentModel} due to low quality score`,
        governanceApproved,
      };

      const evaluation = this.evaluator.evaluate(
        request,
        escalatedResponse,
        complexity,
      );
      escalatedResponse.qualityScore = evaluation.qualityScore;

      this.eventBus.emit('ai:response_evaluated', {
        requestId,
        qualityScore: evaluation.qualityScore,
        escalated: true,
        escalationReason: `Escalated from ${currentModel}`,
        timestamp: new Date().toISOString(),
      });

      this.circuitBreaker.recordSuccess();
      return escalatedResponse;
    } catch {
      this.circuitBreaker.recordFailure();
      return null;
    }
  }

  private getNextHigherTier(current: ModelTier): ModelTier | null {
    const hierarchy: ModelTier[] = [
      'claude-haiku-3',
      'claude-haiku-4.5',
      'claude-sonnet-4',
      'claude-sonnet-4.5',
      'claude-opus-4.5',
      'claude-opus-4.6',
    ];

    const currentIndex = hierarchy.indexOf(current);
    if (currentIndex === -1 || currentIndex >= hierarchy.length - 1) {
      return null;
    }

    return hierarchy[currentIndex + 1];
  }

  private getBudgetState(): ThrottleLevel {
    if (!this.costTracker) return 'normal';
    return this.costTracker.getThrottleLevel();
  }

  private getStakesForCategory(category: AIRequest['category']): number {
    const stakesMap: Record<string, number> = {
      security: 9,
      planning: 7,
      code_generation: 6,
      code_review: 6,
      analysis: 5,
      chat: 4,
      query: 3,
      summarize: 2,
      parse_command: 2,
      heartbeat: 1,
    };
    return stakesMap[category] ?? 5;
  }

  private getQualityPriority(complexity: TaskComplexity): number {
    const priorityMap: Record<TaskComplexity, number> = {
      critical: 10,
      complex: 8,
      standard: 6,
      simple: 4,
      trivial: 2,
    };
    return priorityMap[complexity] ?? 5;
  }

  private getBudgetPressure(budgetState: ThrottleLevel): number {
    const pressureMap: Record<ThrottleLevel, number> = {
      normal: 2,
      warning: 5,
      reduce: 7,
      pause: 10,
    };
    return pressureMap[budgetState];
  }
}
