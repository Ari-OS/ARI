import type { Message, AuditEvent, SecurityEvent, AgentId, TrustLevel } from './types.js';

/**
 * EventMap interface defining event name to payload mappings.
 * The EventBus is the ONLY coupling between kernel and system/agent layers.
 */
export interface EventMap {
  // ── Kernel events ──────────────────────────────────────────────────────
  'message:received': Message;
  'message:accepted': Message;
  'message:processed': Message;
  'message:rejected': { messageId: string; reason: string; riskScore: number };
  'audit:logged': AuditEvent;
  'security:detected': SecurityEvent;
  'gateway:started': { port: number; host: string };
  'gateway:stopped': { reason: string };
  'system:ready': { version: string };
  'system:error': { error: Error; context: string };
  'system:halted': { authority: string; reason: string; timestamp: Date };
  'system:resumed': { authority: string; timestamp: Date };

  // ── System events ──────────────────────────────────────────────────────
  'system:routed': { messageId: string; contextId?: string; route: string; timestamp: Date };

  // ── Agent events ───────────────────────────────────────────────────────
  'security:alert': { type: string; source: string; data: Record<string, unknown> };
  'agent:started': { agent: AgentId; timestamp: Date };
  'agent:stopped': { agent: AgentId; reason: string };
  'tool:executed': { toolId: string; callId: string; success: boolean; agent: AgentId };
  'tool:approval_required': { toolId: string; callId: string; agent: AgentId; parameters: Record<string, unknown> };
  'memory:stored': { memoryId: string; type: string; partition: string; agent: AgentId };
  'memory:quarantined': { memoryId: string; reason: string; agent: AgentId };

  // ── Governance events ──────────────────────────────────────────────────
  'vote:started': { voteId: string; topic: string; threshold: string; deadline: string };
  'vote:cast': { voteId: string; agent: AgentId; option: string };
  'vote:completed': { voteId: string; status: string; result: Record<string, unknown> };
  'vote:vetoed': { voteId: string; vetoer: AgentId; domain: string; reason: string };
  'vote:matrix_update': { voteId: string; matrix: Record<string, unknown> };
  'arbiter:ruling': { ruleId: string; type: string; decision: string };
  'overseer:gate': { gateId: string; passed: boolean; reason: string };

  // ── Council Amendment events ────────────────────────────────────────────
  'amendment:proposed': { amendmentId: string; type: string; proposedBy: string };
  'amendment:voted': { amendmentId: string; status: string };
  'amendment:ratified': { amendmentId: string; result: string };

  // ── PolicyEngine events (Separation of Powers) ───────────────────────────
  'permission:granted': { requestId: string; toolId: string; agentId: AgentId; tokenId: string; autoApproved: boolean };
  'permission:denied': { requestId: string; toolId: string; agentId: AgentId; reason: string; violations: string[] };
  'permission:approval_required': { requestId: string; toolId: string; agentId: AgentId; parameters: Record<string, unknown>; permissionTier: string };
  'permission:approved': { requestId: string; toolId: string; agentId: AgentId; tokenId: string; approver: AgentId };
  'permission:rejected': { requestId: string; toolId: string; agentId: AgentId; rejector: AgentId; reason: string };
  'permission:expired': { requestId: string; toolId: string; agentId: AgentId };

  // ── ToolRegistry events ──────────────────────────────────────────────────
  'tool:registered': { toolId: string; toolName: string };
  'tool:unregistered': { toolId: string };

  // ── Control Plane events ───────────────────────────────────────────────
  'controlplane:client:connected': { clientId: string; clientType: string; connectedAt: Date };
  'controlplane:client:disconnected': { clientId: string; reason: string; disconnectedAt: Date };
  'controlplane:client:authenticated': { clientId: string; capabilities: string[]; authenticatedAt: Date };

  // ── Session events ─────────────────────────────────────────────────────
  'session:started': { sessionId: string; channel: string; senderId: string; groupId?: string; trustLevel: TrustLevel; startedAt: Date };
  'session:ended': { sessionId: string; reason: string; endedAt: Date };
  'session:activity': { sessionId: string; timestamp: Date };

  // ── Tool streaming events ──────────────────────────────────────────────
  'tool:start': { callId: string; toolId: string; toolName: string; agent: AgentId; sessionId?: string; parameters: Record<string, unknown>; timestamp: Date };
  'tool:update': { callId: string; toolId: string; progress?: number; status: string; message?: string; timestamp: Date };
  'tool:end': { callId: string; toolId: string; success: boolean; result?: unknown; error?: string; duration: number; timestamp: Date };

  // ── Channel events ─────────────────────────────────────────────────────
  'channel:connected': { channelId: string; channelName: string; connectedAt: Date };
  'channel:disconnected': { channelId: string; channelName: string; reason: string; disconnectedAt: Date };
  'channel:status': { channelId: string; channelName: string; status: string; activeSessions: number; lastActivity?: Date };
  'channel:message:inbound': { channelId: string; messageId: string; senderId: string; content: string; timestamp: Date };
  'channel:message:outbound': { channelId: string; messageId: string; recipientId: string; content: string; timestamp: Date };

  // ── Scheduler events ─────────────────────────────────────────────────────
  'scheduler:task_run': { taskId: string; taskName: string; startedAt: Date; runId?: string };
  'scheduler:task_complete': { taskId: string; taskName: string; duration: number; success: boolean; error?: string; runId?: string; triggeredBy?: 'scheduler' | 'manual' | 'api' | 'subagent' };
  'scheduler:daily_reset': { date: string; previousDate: string };

  // ── Knowledge events ─────────────────────────────────────────────────────
  'knowledge:indexed': { documentCount: number; duration: number };
  'knowledge:searched': { query: string; resultCount: number };

  // ── Subagent events ──────────────────────────────────────────────────────
  'subagent:spawned': { taskId: string; agentId: AgentId; worktree: string };
  'subagent:progress': { taskId: string; progress: number; message: string };
  'subagent:completed': { taskId: string; success: boolean; result?: unknown };

  // ── Context events ───────────────────────────────────────────────────────
  'context:loaded': { path: string; depth: number; skills: string[] };

  // ── Alert events (Observability) ────────────────────────────────────────
  'alert:created': { id: string; severity: string; title: string; message: string; source: string };
  'alert:acknowledged': { id: string; acknowledgedBy: string; acknowledgedAt: string };
  'alert:resolved': { id: string; resolvedBy: string; resolvedAt: string };

  // ── Audit log event (for logging) ───────────────────────────────────────
  'audit:log': { action: string; agent: string; trustLevel: TrustLevel; details: Record<string, unknown> };

  // ═══════════════════════════════════════════════════════════════════════
  // COGNITIVE LAYER 0: LOGOS events (Reason & Logic)
  // ═══════════════════════════════════════════════════════════════════════
  'cognition:belief_updated': {
    hypothesis: string;
    priorProbability: number;
    posteriorProbability: number;
    shift: number;
    agent: string;
    timestamp: string;
  };
  'cognition:expected_value_calculated': {
    decision: string;
    expectedValue: number;
    recommendation: 'PROCEED' | 'CAUTION' | 'AVOID';
    agent: string;
    timestamp: string;
  };
  'cognition:kelly_calculated': {
    recommendedFraction: number;
    strategy: 'full' | 'half' | 'quarter' | 'avoid';
    edge: number;
    agent: string;
    timestamp: string;
  };
  'cognition:leverage_point_identified': {
    system: string;
    level: number;
    name: string;
    effectiveness: 'low' | 'medium' | 'high' | 'transformative';
    agent: string;
    timestamp: string;
  };
  'cognition:antifragility_assessed': {
    item: string;
    category: 'fragile' | 'robust' | 'antifragile';
    score: number;
    agent: string;
    timestamp: string;
  };
  'cognition:decision_tree_evaluated': {
    rootId: string;
    expectedValue: number;
    optimalPath: string[];
    agent: string;
    timestamp: string;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // COGNITIVE LAYER 0: ETHOS events (Character & Bias)
  // ═══════════════════════════════════════════════════════════════════════
  'cognition:bias_detected': {
    agent: string;
    biases: Array<{ type: string; severity: number }>;
    reasoning: string;
    timestamp: string;
  };
  'cognition:emotional_risk': {
    agent: string;
    state: { valence: number; arousal: number; dominance: number };
    riskScore: number;
    emotions: string[];
    timestamp: string;
  };
  'cognition:discipline_check': {
    agent: string;
    decision: string;
    passed: boolean;
    overallScore: number;
    violations: string[];
    timestamp: string;
  };
  'cognition:fear_greed_detected': {
    agent: string;
    pattern: 'FEAR_SPIRAL' | 'GREED_CHASE' | 'REVENGE_TRADING' | 'EUPHORIA' | 'PANIC_SELLING' | 'FOMO' | 'NONE';
    severity: number;
    phase: 'early' | 'mid' | 'late' | 'none';
    recommendation: string;
    timestamp: string;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // COGNITIVE LAYER 0: PATHOS events (Growth & Wisdom)
  // ═══════════════════════════════════════════════════════════════════════
  'cognition:thought_reframed': {
    original: string;
    distortions: string[];
    reframed: string;
    agent: string;
    timestamp: string;
  };
  'cognition:reflection_complete': {
    outcomeId: string;
    insights: string[];
    principles: string[];
    agent: string;
    timestamp: string;
  };
  'cognition:wisdom_consulted': {
    query: string;
    tradition: string;
    principle: string;
    agent: string;
    timestamp: string;
  };
  'cognition:practice_plan_created': {
    skill: string;
    currentLevel: number;
    targetLevel: number;
    estimatedHours: number;
    agent: string;
    timestamp: string;
  };
  'cognition:dichotomy_analyzed': {
    situation: string;
    controllableCount: number;
    uncontrollableCount: number;
    focusArea: string;
    agent: string;
    timestamp: string;
  };
  'cognition:virtue_check': {
    decision: string;
    overallAlignment: number;
    conflicts: string[];
    virtues: { wisdom: number; courage: number; justice: number; temperance: number };
    agent: string;
    timestamp: string;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // COGNITIVE LAYER 0: Knowledge events
  // ═══════════════════════════════════════════════════════════════════════
  'knowledge:source_fetched': {
    sourceId: string;
    url: string;
    trustLevel: 'VERIFIED' | 'STANDARD' | 'UNTRUSTED';
    success: boolean;
    documentsCount: number;
    timestamp: string;
  };
  'knowledge:content_validated': {
    sourceId: string;
    stage: number;
    stageName: 'whitelist' | 'sanitize' | 'bias_check' | 'fact_check' | 'human_review';
    passed: boolean;
    reason?: string;
    timestamp: string;
  };
  'knowledge:gap_identified': {
    gapId: string;
    domain: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedMembers: string[];
    timestamp: string;
  };
  'knowledge:source_integrated': {
    sourceId: string;
    documentCount: number;
    pillar: 'LOGOS' | 'ETHOS' | 'PATHOS' | 'CROSS_CUTTING';
    timestamp: string;
  };
  'knowledge:council_profile_loaded': {
    memberId: string;
    memberName: string;
    frameworks: string[];
    sourcesCount: number;
    timestamp: string;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // COGNITIVE LAYER 0: General Cognition events
  // ═══════════════════════════════════════════════════════════════════════
  'cognition:query': { api: string; pillar: 'LOGOS' | 'ETHOS' | 'PATHOS'; agent: string };
  'cognition:result': { api: string; pillar: string; confidence: number; latencyMs: number };

  // ═══════════════════════════════════════════════════════════════════════
  // LEARNING LOOP events (Self-Improvement System)
  // ═══════════════════════════════════════════════════════════════════════
  'learning:pattern_stored': { patternId: string; type: string; confidence: number };
  'learning:pattern_updated': { patternId: string; success: boolean; newConfidence: number };
  'learning:pattern_retrieved': { patternId: string; context: string; score: number };
  'learning:performance_review': {
    period: string;
    successRate: number;
    biasCount: number;
    insightCount: number;
    recommendations: string[];
    timestamp: string;
  };
  'learning:gap_analysis': {
    period: string;
    gapsFound: number;
    topGaps: Array<{ domain: string; severity: string }>;
    sourceSuggestions: number;
    timestamp: string;
  };
  'learning:self_assessment': {
    period: string;
    grade: string;
    improvement: number;
    trend: string;
    recommendations: string[];
    timestamp: string;
  };
  'learning:insight_generated': {
    insightId: string;
    type: string;
    description: string;
    confidence: number;
    source: string;
    generalizes: boolean;
    timestamp: string;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // HEARTBEAT events (System Health Monitoring)
  // ═══════════════════════════════════════════════════════════════════════
  'system:heartbeat': { componentId: string; status: string; timestamp: Date; metrics: Record<string, unknown>; latencyMs: number };
  'system:heartbeat_started': { timestamp: Date; componentCount: number };
  'system:heartbeat_stopped': { timestamp: Date };
  'system:heartbeat_failure': { componentId: string; consecutiveFailures: number; timestamp: Date; error: string };

  // ═══════════════════════════════════════════════════════════════════════
  // COST TRACKING events (Budget & Spend)
  // ═══════════════════════════════════════════════════════════════════════
  'cost:tracked': { operation: string; cost: number; model: string };
  'cost:budget_warning': { type: string; current: number; budget: number; percentage: number };
  'cost:budget_exceeded': { type: string; current: number; budget: number };

  // ═══════════════════════════════════════════════════════════════════════
  // BUDGET MANAGEMENT events (24/7 Autonomous System)
  // ═══════════════════════════════════════════════════════════════════════
  'budget:daily_reset': { previousUsage: number; profile: string };
  'budget:threshold_reached': {
    level: 'warning' | 'reduce' | 'pause';
    percentage: number;
    remaining?: number;
    recommendation?: string;
  };
  'budget:status_changed': {
    profile: string;
    used: number;
    remaining: number;
    throttled: boolean;
  };
  'budget:profile_changed': {
    previousProfile: string;
    newProfile: string;
    maxTokens: number;
    maxCost: number;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // BILLING CYCLE events (14-day cycles)
  // ═══════════════════════════════════════════════════════════════════════
  'billing:cycle_started': { cycleStart: string; cycleEnd: string; budget: number };
  'billing:cycle_warning': { daysRemaining: number; status: string; percentUsed: number };
  'billing:cycle_ended': { totalSpent: number; budget: number; underBudget: boolean };

  // ═══════════════════════════════════════════════════════════════════════
  // VALUE ANALYTICS events (Cost-to-Reward Tracking)
  // ═══════════════════════════════════════════════════════════════════════
  'value:day_analyzed': {
    date: string;
    score: number;
    cost: number;
    efficiency: string;
    breakdown: string[];
  };
  'value:weekly_report': {
    averageScore: number;
    totalCost: number;
    trend: string;
    recommendations: string[];
  };

  // Value-generating events (tracked for scoring)
  'briefing:morning_delivered': { date: string };
  'briefing:evening_delivered': { date: string };
  'test:generated': { file: string; testCount: number };
  'doc:written': { file: string; wordCount: number };
  'bug:fixed': { description: string; file: string };
  'code:improved': { description: string; file: string };
  'insight:high_value': { insight: string; category: string };
  'pattern:learned': { pattern: string; confidence: number };
  'initiative:executed': { initiativeId: string; title: string; category: string; success: boolean };

  // ═══════════════════════════════════════════════════════════════════════
  // ADAPTIVE LEARNING events (Pattern Recognition)
  // ═══════════════════════════════════════════════════════════════════════
  'adaptive:weekly_summary': { summary: Record<string, unknown>; recommendations: unknown[] };
  'adaptive:recommendation': { type: string; recommendation: string; confidence: number };
  'adaptive:pattern_applied': { patternId: string; result: 'success' | 'failure' };
  'user:active': { hour: number; date: string };
  'model:selected': { taskType: string; model: string; success: boolean };
  'notification:response': {
    category: string;
    priority: string;
    response: 'opened' | 'dismissed' | 'ignored';
  };

  // ═══════════════════════════════════════════════════════════════════════
  // APPROVAL QUEUE events (Safety Gates)
  // ═══════════════════════════════════════════════════════════════════════
  'approval:item_added': { itemId: string; type: string; risk: string; estimatedCost: number };
  'approval:approved': { itemId: string; type: string; approvedBy?: string };
  'approval:rejected': { itemId: string; type: string; reason: string; rejectedBy?: string };
  'approval:expired': { itemId: string; type: string };

  // ═══════════════════════════════════════════════════════════════════════
  // PLAN REVIEW events (Quality Gates)
  // ═══════════════════════════════════════════════════════════════════════
  'plan:review_started': { planId: string; requiredReviews: string[] };
  'plan:review_approved': { planId: string; approvedAt: Date };
  'plan:review_rejected': { planId: string; reason: string };
  'plan:review_needs_revision': { planId: string; concerns: string[]; tips: string[] };

  // ═══════════════════════════════════════════════════════════════════════
  // SCRATCHPAD events (Temporary Reasoning Space)
  // ═══════════════════════════════════════════════════════════════════════
  'scratchpad:written': { agent: string; key: string; size: number };
  'scratchpad:deleted': { agent: string; key: string };
  'scratchpad:cleared': { agent: string; count: number };
  'scratchpad:cleanup': { cleaned: number; remaining: number };

  // ═══════════════════════════════════════════════════════════════════════
  // SOUL events (Agent Identity & Personality)
  // ═══════════════════════════════════════════════════════════════════════
  'soul:loaded': { agent: AgentId; name: string; pillarWeights: { logos: number; ethos: number; pathos: number } };
  'soul:decision_influenced': { agent: AgentId; action: string; confidence: number; appliedFrameworks: string[] };

  // ═══════════════════════════════════════════════════════════════════════
  // CONTEXT LAYER events (6-Layer Context Building)
  // ═══════════════════════════════════════════════════════════════════════
  'context:layer:loaded': { layer: string; size: number; hitRate?: number };
  'context:built': { layers: number; totalSize: number; buildTimeMs: number };

  // ═══════════════════════════════════════════════════════════════════════
  // MODEL ROUTING events (Intelligent Model Selection)
  // ═══════════════════════════════════════════════════════════════════════
  'model:routed': { task: string; model: string; reason: string; estimatedCost?: number };

  // ═══════════════════════════════════════════════════════════════════════
  // E2E TESTING events (Playwright Integration)
  // ═══════════════════════════════════════════════════════════════════════
  'e2e:run_started': { runId: string; scenarioCount: number; timestamp: string };
  'e2e:scenario_started': { runId: string; scenario: string };
  'e2e:scenario_complete': {
    runId: string;
    scenario: string;
    passed: boolean;
    duration: number;
    error?: string;
    screenshot?: string;
  };
  'e2e:run_complete': {
    runId: string;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    consecutiveFailures: number;
  };
  'e2e:bug_filed': { runId: string; issueUrl: string; issueNumber: number };
  'e2e:skipped': { reason: 'budget_pause' | 'already_running' | 'gateway_down' };

  // ═══════════════════════════════════════════════════════════════════════
  // BUDGET TRACKER events (Enhanced Model Management)
  // ═══════════════════════════════════════════════════════════════════════
  'budget:warning': { spent: number; remaining: number };
  'budget:critical': { spent: number; remaining: number };
  'budget:pause': { spent: number; budget: number; percentUsed: number };
  'budget:cycle_reset': { previousSpent: number; newBudget: number };
  'budget:update': { status: string; spent: number; remaining: number; percentUsed: number; mode: string };

  // ═══════════════════════════════════════════════════════════════════════
  // LLM REQUEST events (Token & Cost Tracking)
  // ═══════════════════════════════════════════════════════════════════════
  'llm:request_start': { model: string; estimatedTokens: number };
  'llm:request_complete': {
    timestamp: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    taskType: string;
    taskCategory?: string;
    duration: number;
    success: boolean;
  };
}

/**
 * Typed pub/sub event system for ARI
 */
export class EventBus {
  private listeners: Map<string, Set<(payload: unknown) => void>> = new Map();

  /**
   * Subscribe to an event
   * @param event Event name
   * @param handler Event handler
   * @returns Unsubscribe function
   */
  on<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(handler as (payload: unknown) => void);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from an event
   * @param event Event name
   * @param handler Event handler to remove
   */
  off<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler as (payload: unknown) => void);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   * @param event Event name
   * @param payload Event payload
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    // Call each handler, wrapping in try/catch to prevent one handler from breaking others
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (error) {
        // Log error but continue processing other handlers
        console.error(`Error in event handler for '${String(event)}':`, error);
      }
    }
  }

  /**
   * Subscribe to an event for a single occurrence
   * @param event Event name
   * @param handler Event handler
   * @returns Unsubscribe function
   */
  once<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void
  ): () => void {
    const wrappedHandler = (payload: EventMap[K]) => {
      handler(payload);
      this.off(event, wrappedHandler);
    };

    return this.on(event, wrappedHandler);
  }

  /**
   * Remove all event listeners
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of listeners for an event
   * @param event Event name
   * @returns Number of listeners
   */
  listenerCount(event: keyof EventMap): number {
    const handlers = this.listeners.get(event);
    return handlers ? handlers.size : 0;
  }
}
