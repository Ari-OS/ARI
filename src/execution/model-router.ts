import type { EventBus } from '../kernel/event-bus.js';
import type { CostTracker, BudgetProfile } from '../observability/cost-tracker.js';
import type { AgentId } from '../kernel/types.js';

/**
 * Task complexity levels matching budget profile routing rules
 */
export type ComplexityLevel = 'TRIVIAL' | 'SIMPLE' | 'MODERATE' | 'COMPLEX';

/**
 * Override categories for special routing rules
 */
export type OverrideCategory =
  | 'userFacing'
  | 'security'
  | 'credentials'
  | 'destructive'
  | 'highRisk'
  | 'architecture'
  | 'refactoring';

/**
 * Available AI model providers
 */
export type ModelProvider = 'anthropic' | 'openai' | 'cerebras' | 'local';

/**
 * Model capability categories
 */
export type ModelCapability = 
  | 'reasoning'
  | 'coding'
  | 'analysis'
  | 'fast_iteration'
  | 'tool_use'
  | 'long_context'
  | 'vision'
  | 'embedding';

/**
 * Model configuration
 */
export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  capabilities: ModelCapability[];
  maxContextTokens: number;
  costPer1MInput: number;
  costPer1MOutput: number;
  latencyClass: 'ultra-fast' | 'fast' | 'medium' | 'slow';
  qualityScore: number; // 1-10
  isAvailable: boolean;
}

/**
 * Task classification for routing
 */
export interface TaskClassification {
  taskType: string;
  requiredCapabilities: ModelCapability[];
  complexityScore: number; // 1-10
  urgency: 'low' | 'normal' | 'high' | 'critical';
  expectedTokens: {
    input: number;
    output: number;
  };
  qualityRequirement: 'good' | 'better' | 'best';
}

/**
 * Routing decision result
 */
export interface RoutingDecision {
  primaryModel: ModelConfig;
  fallbackModels: ModelConfig[];
  reasoning: string;
  estimatedCost: number;
  estimatedLatency: 'ultra-fast' | 'fast' | 'medium' | 'slow';
}

/**
 * Available models registry
 */
const DEFAULT_MODELS: ModelConfig[] = [
  // Anthropic models
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    capabilities: ['reasoning', 'coding', 'analysis', 'tool_use', 'long_context', 'vision'],
    maxContextTokens: 200000,
    costPer1MInput: 15,
    costPer1MOutput: 75,
    latencyClass: 'medium',
    qualityScore: 10,
    isAvailable: true,
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    capabilities: ['reasoning', 'coding', 'analysis', 'tool_use', 'long_context', 'vision'],
    maxContextTokens: 200000,
    costPer1MInput: 3,
    costPer1MOutput: 15,
    latencyClass: 'fast',
    qualityScore: 8,
    isAvailable: true,
  },
  {
    id: 'claude-haiku',
    name: 'Claude Haiku',
    provider: 'anthropic',
    capabilities: ['reasoning', 'coding', 'fast_iteration', 'tool_use'],
    maxContextTokens: 200000,
    costPer1MInput: 0.25,
    costPer1MOutput: 1.25,
    latencyClass: 'ultra-fast',
    qualityScore: 6,
    isAvailable: true,
  },
  // OpenAI models
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    capabilities: ['reasoning', 'coding', 'analysis', 'tool_use', 'vision'],
    maxContextTokens: 128000,
    costPer1MInput: 5,
    costPer1MOutput: 15,
    latencyClass: 'fast',
    qualityScore: 8,
    isAvailable: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    capabilities: ['reasoning', 'coding', 'fast_iteration', 'tool_use'],
    maxContextTokens: 128000,
    costPer1MInput: 0.15,
    costPer1MOutput: 0.6,
    latencyClass: 'ultra-fast',
    qualityScore: 6,
    isAvailable: true,
  },
  // Cerebras (Ultra-fast inference)
  {
    id: 'cerebras-llama-70b',
    name: 'Cerebras Llama 70B',
    provider: 'cerebras',
    capabilities: ['reasoning', 'coding', 'fast_iteration'],
    maxContextTokens: 8192,
    costPer1MInput: 1,
    costPer1MOutput: 1,
    latencyClass: 'ultra-fast',
    qualityScore: 7,
    isAvailable: false, // Requires setup
  },
];

/**
 * Task patterns for classification
 */
const TASK_PATTERNS: Record<string, Partial<TaskClassification>> = {
  'code_review': {
    taskType: 'code_review',
    requiredCapabilities: ['coding', 'analysis'],
    complexityScore: 7,
    qualityRequirement: 'best',
  },
  'quick_question': {
    taskType: 'quick_question',
    requiredCapabilities: ['reasoning'],
    complexityScore: 3,
    qualityRequirement: 'good',
  },
  'tool_execution': {
    taskType: 'tool_execution',
    requiredCapabilities: ['tool_use'],
    complexityScore: 4,
    qualityRequirement: 'good',
  },
  'security_analysis': {
    taskType: 'security_analysis',
    requiredCapabilities: ['reasoning', 'analysis'],
    complexityScore: 9,
    qualityRequirement: 'best',
  },
  'code_generation': {
    taskType: 'code_generation',
    requiredCapabilities: ['coding'],
    complexityScore: 6,
    qualityRequirement: 'better',
  },
  'summarization': {
    taskType: 'summarization',
    requiredCapabilities: ['reasoning', 'long_context'],
    complexityScore: 4,
    qualityRequirement: 'good',
  },
  'planning': {
    taskType: 'planning',
    requiredCapabilities: ['reasoning', 'analysis'],
    complexityScore: 8,
    qualityRequirement: 'best',
  },
};

/**
 * ModelRouter - Intelligent routing of tasks to appropriate AI models
 * 
 * Based on Cerebras integration patterns:
 * - Route simple tasks to fast models
 * - Route complex tasks to capable models
 * - Consider cost/latency/quality tradeoffs
 * - Provide fallback chains
 */
export class ModelRouter {
  private models: Map<string, ModelConfig> = new Map();
  private readonly eventBus: EventBus;
  private readonly costTracker: CostTracker | null;
  private routingHistory: Array<{
    timestamp: Date;
    task: string;
    selectedModel: string;
    reason: string;
  }> = [];

  // Profile-aware routing state
  private profile: BudgetProfile | null = null;
  private opusUsedToday: number = 0;
  private lastOpusResetDate: string = '';

  constructor(eventBus: EventBus, costTracker?: CostTracker, customModels?: ModelConfig[]) {
    this.eventBus = eventBus;
    this.costTracker = costTracker || null;

    // Initialize default models
    for (const model of customModels || DEFAULT_MODELS) {
      this.models.set(model.id, model);
    }

    // Try to load profile from cost tracker if available
    if (this.costTracker) {
      const profile = this.costTracker.getProfile();
      if (profile) {
        this.setProfile(profile);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE-AWARE ROUTING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set the active budget profile for routing decisions
   */
  setProfile(profile: BudgetProfile): void {
    this.profile = profile;

    // Check if we need to reset Opus counter for a new day
    const today = new Date().toISOString().split('T')[0];
    if (this.lastOpusResetDate !== today) {
      this.opusUsedToday = 0;
      this.lastOpusResetDate = today;
    }

    // Apply model availability from profile
    if (profile.models) {
      for (const [tier, config] of Object.entries(profile.models)) {
        // Find model by tier (haiku, sonnet, opus)
        const model = Array.from(this.models.values()).find(m =>
          m.id.toLowerCase().includes(tier.toLowerCase())
        );
        if (model) {
          model.isAvailable = !config.disabled && config.enabled !== false;
        }
      }
    }
  }

  /**
   * Get the current profile
   */
  getProfile(): BudgetProfile | null {
    return this.profile;
  }

  /**
   * Route a task using budget profile rules
   *
   * Priority order:
   * 1. Override categories (security, userFacing, etc.)
   * 2. Complexity-based routing rules
   * 3. Default model from profile
   */
  routeWithProfile(
    content: string,
    hints: {
      complexity?: ComplexityLevel;
      overrideCategories?: OverrideCategory[];
      urgency?: 'low' | 'normal' | 'high' | 'critical';
      agent?: AgentId;
      tokenEstimate?: { input: number; output: number };
    } = {}
  ): RoutingDecision {
    // If no profile, fall back to default routing
    if (!this.profile) {
      const classification = this.classifyTask(content, hints);
      return this.route(classification);
    }

    const routing = this.profile.routing;
    let selectedModelId: string;
    const reasonParts: string[] = [`Profile: ${this.profile.profile}`];

    // 1. Check override categories first (highest priority)
    if (hints.overrideCategories && hints.overrideCategories.length > 0) {
      for (const category of hints.overrideCategories) {
        const override = routing.overrides?.[category];
        if (override) {
          selectedModelId = this.resolveModelId(override);

          // Check Opus daily limit
          if (this.isOpus(selectedModelId) && !this.canUseOpus()) {
            selectedModelId = this.resolveModelId('sonnet'); // Fallback
            reasonParts.push(`Override ${category} -> Opus but daily limit reached, using Sonnet`);
          } else {
            reasonParts.push(`Override: ${category} -> ${override}`);
          }

          return this.buildDecision(selectedModelId, reasonParts.join('. '));
        }
      }
    }

    // 2. Use complexity-based routing from profile
    const complexity = hints.complexity ?? this.inferComplexity(content);
    const ruleModel = routing.rules?.[complexity] ?? routing.defaultModel;
    selectedModelId = this.resolveModelId(ruleModel);
    reasonParts.push(`Complexity: ${complexity} -> ${ruleModel}`);

    // 3. Check Opus daily limit
    if (this.isOpus(selectedModelId) && !this.canUseOpus()) {
      selectedModelId = this.resolveModelId('sonnet');
      reasonParts.push('Opus daily limit reached, using Sonnet');
    }

    // 4. Check if model is disabled in profile
    const modelTier = this.getModelTier(selectedModelId);
    const modelConfig = this.profile.models?.[modelTier];
    if (modelConfig?.disabled) {
      selectedModelId = this.resolveModelId(routing.defaultModel);
      reasonParts.push(`${modelTier} disabled, using default`);
    }

    // 5. Apply preferCheaper / preferQuality settings
    if (routing.preferCheaper && !this.isHaiku(selectedModelId)) {
      // Check if haiku can handle this complexity
      if (complexity === 'TRIVIAL' || complexity === 'SIMPLE') {
        selectedModelId = this.resolveModelId('haiku');
        reasonParts.push('preferCheaper: downgraded to Haiku');
      }
    }

    if (routing.preferQuality && this.canUseOpus() && complexity === 'COMPLEX') {
      selectedModelId = this.resolveModelId('opus');
      reasonParts.push('preferQuality: upgraded to Opus');
    }

    return this.buildDecision(selectedModelId, reasonParts.join('. '));
  }

  /**
   * Record Opus usage (call after successful Opus use)
   */
  recordOpusUsage(): void {
    this.opusUsedToday++;

    this.eventBus.emit('model:selected', {
      taskType: 'opus_usage',
      model: 'claude-opus-4',
      success: true,
    });
  }

  /**
   * Check if Opus can be used today
   */
  canUseOpus(): boolean {
    const maxPerDay = this.profile?.models?.opus?.maxPerDay ?? Infinity;
    return this.opusUsedToday < maxPerDay;
  }

  /**
   * Get Opus usage status
   */
  getOpusStatus(): { used: number; limit: number; remaining: number } {
    const limit = this.profile?.models?.opus?.maxPerDay ?? Infinity;
    return {
      used: this.opusUsedToday,
      limit,
      remaining: Math.max(0, limit - this.opusUsedToday),
    };
  }

  /**
   * Infer complexity from content
   */
  private inferComplexity(content: string): ComplexityLevel {
    const lower = content.toLowerCase();
    const length = content.length;

    // Trivial: Very short, simple queries
    if (length < 100 && !lower.includes('implement') && !lower.includes('refactor')) {
      return 'TRIVIAL';
    }

    // Complex: Architecture, refactoring, security, multi-step
    if (lower.includes('architect') || lower.includes('refactor') ||
        lower.includes('security') || lower.includes('design pattern') ||
        lower.includes('implement feature') || lower.includes('comprehensive')) {
      return 'COMPLEX';
    }

    // Moderate: Tests, docs, analysis, review
    if (lower.includes('test') || lower.includes('document') ||
        lower.includes('analyze') || lower.includes('review') ||
        lower.includes('explain')) {
      return 'MODERATE';
    }

    // Simple: Everything else
    return 'SIMPLE';
  }

  /**
   * Resolve model tier name to actual model ID
   */
  private resolveModelId(tier: string): string {
    // If already a full model ID, return it
    if (tier.includes('-')) {
      return tier;
    }

    // Try to get from profile's model config
    if (this.profile?.models?.[tier]?.id) {
      return this.profile.models[tier].id;
    }

    // Default mappings
    const defaults: Record<string, string> = {
      haiku: 'claude-haiku',
      sonnet: 'claude-sonnet-4',
      opus: 'claude-opus-4',
    };
    return defaults[tier.toLowerCase()] ?? tier;
  }

  /**
   * Check if model ID is Opus
   */
  private isOpus(modelId: string): boolean {
    return modelId.toLowerCase().includes('opus');
  }

  /**
   * Check if model ID is Haiku
   */
  private isHaiku(modelId: string): boolean {
    return modelId.toLowerCase().includes('haiku');
  }

  /**
   * Get model tier from ID
   */
  private getModelTier(modelId: string): string {
    const lower = modelId.toLowerCase();
    if (lower.includes('haiku')) return 'haiku';
    if (lower.includes('sonnet')) return 'sonnet';
    if (lower.includes('opus')) return 'opus';
    return 'unknown';
  }

  /**
   * Build routing decision object
   */
  private buildDecision(modelId: string, reasoning: string): RoutingDecision {
    const model = this.getModel(modelId) ?? this.models.values().next().value;

    if (!model) {
      throw new Error('No suitable models available');
    }

    // Track routing decision
    this.routingHistory.push({
      timestamp: new Date(),
      task: 'profile_routed',
      selectedModel: model.id,
      reason: reasoning,
    });

    // Keep history bounded
    if (this.routingHistory.length > 100) {
      this.routingHistory = this.routingHistory.slice(-100);
    }

    return {
      primaryModel: model,
      fallbackModels: this.getFallbacks(modelId),
      reasoning: `${reasoning}. Selected: ${model.name}`,
      estimatedCost: 0, // Would need token estimate
      estimatedLatency: model.latencyClass,
    };
  }

  /**
   * Get fallback models based on current selection
   */
  private getFallbacks(selectedId: string): ModelConfig[] {
    const tier = this.getModelTier(selectedId);
    const fallbackOrder: Record<string, string[]> = {
      opus: ['sonnet', 'haiku'],
      sonnet: ['haiku', 'opus'],
      haiku: ['sonnet'],
      unknown: ['sonnet', 'haiku'],
    };

    return (fallbackOrder[tier] ?? [])
      .map(t => this.getModel(this.resolveModelId(t)))
      .filter((m): m is ModelConfig => m !== undefined && m.isAvailable);
  }

  /**
   * Classify a task for routing
   */
  classifyTask(
    content: string,
    hints: {
      taskType?: string;
      urgency?: 'low' | 'normal' | 'high' | 'critical';
      agent?: AgentId;
      tokenEstimate?: { input: number; output: number };
    } = {}
  ): TaskClassification {
    // Try to match to known patterns
    const contentLower = content.toLowerCase();
    let matchedPattern: Partial<TaskClassification> | undefined;

    if (hints.taskType && TASK_PATTERNS[hints.taskType]) {
      matchedPattern = TASK_PATTERNS[hints.taskType];
    } else {
      // Heuristic pattern matching
      if (contentLower.includes('review') && contentLower.includes('code')) {
        matchedPattern = TASK_PATTERNS['code_review'];
      } else if (contentLower.includes('security') || contentLower.includes('vulnerability')) {
        matchedPattern = TASK_PATTERNS['security_analysis'];
      } else if (contentLower.includes('generate') || contentLower.includes('write code')) {
        matchedPattern = TASK_PATTERNS['code_generation'];
      } else if (contentLower.includes('plan') || contentLower.includes('design')) {
        matchedPattern = TASK_PATTERNS['planning'];
      } else if (contentLower.includes('summarize') || contentLower.includes('summary')) {
        matchedPattern = TASK_PATTERNS['summarization'];
      } else if (content.length < 100) {
        matchedPattern = TASK_PATTERNS['quick_question'];
      }
    }

    // Build classification
    const classification: TaskClassification = {
      taskType: matchedPattern?.taskType || 'general',
      requiredCapabilities: matchedPattern?.requiredCapabilities || ['reasoning'],
      complexityScore: matchedPattern?.complexityScore || 5,
      urgency: hints.urgency || 'normal',
      expectedTokens: hints.tokenEstimate || {
        input: Math.ceil(content.length / 4), // Rough estimate
        output: 1000, // Default estimate
      },
      qualityRequirement: matchedPattern?.qualityRequirement || 'good',
    };

    // Adjust based on agent
    if (hints.agent) {
      switch (hints.agent) {
        case 'guardian':
          classification.qualityRequirement = 'best';
          if (!classification.requiredCapabilities.includes('analysis')) {
            classification.requiredCapabilities.push('analysis');
          }
          break;
        case 'executor':
          if (!classification.requiredCapabilities.includes('tool_use')) {
            classification.requiredCapabilities.push('tool_use');
          }
          break;
      }
    }

    return classification;
  }

  /**
   * Route a task to the best model
   */
  route(classification: TaskClassification): RoutingDecision {
    const candidates = this.findCandidates(classification);

    if (candidates.length === 0) {
      throw new Error('No suitable models available for this task');
    }

    // Score and sort candidates
    const scored = candidates.map(model => ({
      model,
      score: this.scoreModel(model, classification),
    }));

    scored.sort((a, b) => b.score - a.score);

    const primary = scored[0].model;
    const fallbacks = scored.slice(1, 4).map(s => s.model);

    // Calculate estimates
    const estimatedCost = this.estimateCost(primary, classification.expectedTokens);

    const reasoning = this.buildReasoning(primary, classification, scored[0].score);

    // Track routing decision
    this.routingHistory.push({
      timestamp: new Date(),
      task: classification.taskType,
      selectedModel: primary.id,
      reason: reasoning,
    });

    // Keep history bounded
    if (this.routingHistory.length > 100) {
      this.routingHistory = this.routingHistory.slice(-100);
    }

    return {
      primaryModel: primary,
      fallbackModels: fallbacks,
      reasoning,
      estimatedCost,
      estimatedLatency: primary.latencyClass,
    };
  }

  /**
   * Find candidate models that meet requirements
   */
  private findCandidates(classification: TaskClassification): ModelConfig[] {
    return Array.from(this.models.values()).filter(model => {
      // Must be available
      if (!model.isAvailable) return false;

      // Must have all required capabilities
      const hasCapabilities = classification.requiredCapabilities.every(
        cap => model.capabilities.includes(cap)
      );
      if (!hasCapabilities) return false;

      // Must support expected context length
      if (model.maxContextTokens < classification.expectedTokens.input) return false;

      return true;
    });
  }

  /**
   * Score a model for a task
   */
  private scoreModel(model: ModelConfig, classification: TaskClassification): number {
    let score = 0;

    // Quality score (0-40 points)
    const qualityWeight = classification.qualityRequirement === 'best' ? 4 :
                          classification.qualityRequirement === 'better' ? 3 : 2;
    score += model.qualityScore * qualityWeight;

    // Latency score (0-20 points) - higher for urgent tasks
    const urgencyWeight = classification.urgency === 'critical' ? 2 :
                         classification.urgency === 'high' ? 1.5 :
                         classification.urgency === 'normal' ? 1 : 0.5;
    const latencyScore = model.latencyClass === 'ultra-fast' ? 20 :
                        model.latencyClass === 'fast' ? 15 :
                        model.latencyClass === 'medium' ? 10 : 5;
    score += latencyScore * urgencyWeight;

    // Cost efficiency (0-20 points) - inverse of cost
    const estimatedCost = this.estimateCost(model, classification.expectedTokens);
    const costScore = Math.max(0, 20 - estimatedCost * 10);
    score += costScore;

    // Capability bonus (0-10 points) - extra capabilities beyond required
    const extraCapabilities = model.capabilities.filter(
      cap => !classification.requiredCapabilities.includes(cap)
    ).length;
    score += Math.min(10, extraCapabilities * 2);

    // Complexity match (0-10 points)
    const complexityMatch = Math.abs(model.qualityScore - classification.complexityScore);
    score += Math.max(0, 10 - complexityMatch * 2);

    return score;
  }

  /**
   * Estimate cost for a model
   */
  private estimateCost(model: ModelConfig, tokens: { input: number; output: number }): number {
    return (tokens.input * model.costPer1MInput + tokens.output * model.costPer1MOutput) / 1_000_000;
  }

  /**
   * Build reasoning string for routing decision
   */
  private buildReasoning(model: ModelConfig, classification: TaskClassification, score: number): string {
    const reasons: string[] = [];

    reasons.push(`Task type: ${classification.taskType}`);
    reasons.push(`Quality requirement: ${classification.qualityRequirement}`);
    reasons.push(`Urgency: ${classification.urgency}`);
    reasons.push(`Selected: ${model.name} (score: ${score.toFixed(1)})`);

    if (classification.qualityRequirement === 'best') {
      reasons.push(`High-quality model selected for ${classification.qualityRequirement} quality requirement`);
    }

    if (classification.urgency === 'critical' && model.latencyClass === 'ultra-fast') {
      reasons.push('Ultra-fast model selected for critical urgency');
    }

    return reasons.join('. ');
  }

  /**
   * Get a specific model by ID
   */
  getModel(modelId: string): ModelConfig | undefined {
    return this.models.get(modelId);
  }

  /**
   * List all available models
   */
  listModels(onlyAvailable: boolean = true): ModelConfig[] {
    const models = Array.from(this.models.values());
    return onlyAvailable ? models.filter(m => m.isAvailable) : models;
  }

  /**
   * Register a new model
   */
  registerModel(model: ModelConfig): void {
    this.models.set(model.id, model);
  }

  /**
   * Update model availability
   */
  setModelAvailability(modelId: string, available: boolean): void {
    const model = this.models.get(modelId);
    if (model) {
      model.isAvailable = available;
    }
  }

  /**
   * Get routing history
   */
  getRoutingHistory(limit: number = 20): Array<{
    timestamp: Date;
    task: string;
    selectedModel: string;
    reason: string;
  }> {
    return this.routingHistory.slice(-limit);
  }

  /**
   * Get routing statistics
   */
  getStats(): {
    totalRoutings: number;
    byModel: Record<string, number>;
    byTaskType: Record<string, number>;
    availableModels: number;
  } {
    const byModel: Record<string, number> = {};
    const byTaskType: Record<string, number> = {};

    for (const entry of this.routingHistory) {
      byModel[entry.selectedModel] = (byModel[entry.selectedModel] || 0) + 1;
      byTaskType[entry.task] = (byTaskType[entry.task] || 0) + 1;
    }

    return {
      totalRoutings: this.routingHistory.length,
      byModel,
      byTaskType,
      availableModels: this.listModels(true).length,
    };
  }

  /**
   * Quick route for common patterns
   */
  quickRoute(pattern: 'fast' | 'best' | 'cheap'): ModelConfig | null {
    const models = this.listModels(true);
    if (models.length === 0) return null;

    switch (pattern) {
      case 'fast':
        return models.sort((a, b) => {
          const latencyOrder = { 'ultra-fast': 0, 'fast': 1, 'medium': 2, 'slow': 3 };
          return latencyOrder[a.latencyClass] - latencyOrder[b.latencyClass];
        })[0];

      case 'best':
        return models.sort((a, b) => b.qualityScore - a.qualityScore)[0];

      case 'cheap':
        return models.sort((a, b) => {
          const costA = a.costPer1MInput + a.costPer1MOutput;
          const costB = b.costPer1MInput + b.costPer1MOutput;
          return costA - costB;
        })[0];

      default:
        return models[0];
    }
  }
}
