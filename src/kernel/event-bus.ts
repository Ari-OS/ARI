import type { Message, AuditEvent, SecurityEvent, AgentId, TrustLevel } from './types.js';
import { createLogger } from './logger.js';

const log = createLogger('event-bus');

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
  'message:response': { content: string; source: string; timestamp: Date };
  'audit:logged': AuditEvent;
  'security:detected': SecurityEvent;
  'gateway:started': { port: number; host: string };
  'gateway:stopped': { reason: string };
  'system:ready': { version: string };
  'system:error': { error: Error; context: string };
  'system:handler_error': { event: string; error: string; handler: string; timestamp: Date };
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

  // ── Cognition events (used by DecisionJournal for framework attribution) ──
  'cognition:belief_updated': {
    hypothesis: string;
    priorProbability: number;
    posteriorProbability: number;
    shift: number;
    timestamp: string;
  };
  'cognition:expected_value_calculated': {
    decision: string;
    expectedValue: number;
    recommendation: string;
    timestamp: string;
  };
  'cognition:kelly_calculated': {
    recommendedFraction: number;
    strategy: string;
    edge: number;
    timestamp: string;
  };
  'cognition:leverage_point_identified': {
    system: string;
    level: number;
    effectiveness: string;
    timestamp: string;
  };
  'cognition:antifragility_assessed': {
    item: string;
    category: string;
    score: number;
    timestamp: string;
  };
  'cognition:decision_tree_evaluated': {
    rootId: string;
    expectedValue: number;
    optimalPath: string[];
    timestamp: string;
  };
  'cognition:bias_detected': {
    agent: string;
    biases: Array<{ type: string; severity: number }>;
    reasoning: string;
    timestamp: string;
  };
  'cognition:emotional_risk': {
    riskScore: number;
    state: { valence: number; arousal: number; dominance: number };
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
    pattern: string;
    phase: string;
    severity: number;
    recommendation: string;
    timestamp: string;
  };
  'cognition:thought_reframed': {
    distortions: string[];
    originalThought: string;
    reframedThought: string;
    timestamp: string;
  };
  'cognition:reflection_complete': {
    outcomeId: string;
    insights: string[];
    principles: string[];
    timestamp: string;
  };
  'cognition:wisdom_consulted': {
    query: string;
    tradition: string;
    principle: string;
    timestamp: string;
  };
  'cognition:practice_plan_created': {
    skill: string;
    currentLevel: number;
    targetLevel: number;
    estimatedHours: number;
    timestamp: string;
  };
  'cognition:dichotomy_analyzed': {
    situation: string;
    controllableCount: number;
    uncontrollableCount: number;
    focusArea: string;
    timestamp: string;
  };
  'cognition:virtue_check': {
    decision: string;
    overallAlignment: number;
    conflicts: string[];
    timestamp: string;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // LEARNING LOOP events (Self-Improvement System)
  // ═══════════════════════════════════════════════════════════════════════
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

  // ── Cost & Budget events ───────────────────────────────────────────────
  'cost:tracked': { operation: string; cost: number; model: string };
  'cost:budget_warning': { type: string; current: number; budget: number; percentage: number };
  'cost:budget_exceeded': { type: string; current: number; budget: number };
  'budget:daily_reset': { previousUsage: number; profile: string };
  'billing:cycle_started': { cycleStart: string; cycleEnd: string; budget: number };

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

  // ── Model Routing events ───────────────────────────────────────────────
  'model:routed': { task: string; model: string; reason: string; estimatedCost?: number };

  // ═══════════════════════════════════════════════════════════════════════
  // E2E TESTING events (Playwright Integration)
  // ═══════════════════════════════════════════════════════════════════════
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
  // AI ORCHESTRATION events (Unified Pipeline)
  // ═══════════════════════════════════════════════════════════════════════
  'ai:request_received': {
    requestId: string;
    category: string;
    complexity: string;
    classificationScore: number;
    confidence: number;
    suggestedChain: string;
    reasoning: string;
    agent: string;
    timestamp: string;
  };
  'ai:model_selected': {
    requestId: string;
    model: string;
    valueScore: number;
    reasoning: string;
    estimatedCost: number;
    timestamp: string;
  };
  'ai:response_evaluated': {
    requestId: string;
    qualityScore: number;
    escalated: boolean;
    escalationReason?: string;
    timestamp: string;
  };
  'ai:circuit_breaker_state_changed': {
    previousState: string;
    newState: string;
    failures: number;
    timestamp: string;
  };
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

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 4F events (Adaptive Routing, Budget Projection, Confidence)
  // ═══════════════════════════════════════════════════════════════════════
  'ai:model_fallback': {
    originalModel: string;
    fallbackModel: string;
    reason: string;
    category: string;
    timestamp: string;
  };
  'budget:projection_exceeded': {
    projected: number;
    budget: number;
    burnRate: number;
    hoursRemaining: number;
    percentOver: number;
  };
  'self_improvement:low_confidence': {
    initiativeId: string;
    title: string;
    confidence: number;
    threshold: number;
    reason: string;
  };

  // ── Web Navigation events (simplified) ─────────────────────────────────
  'web:navigate': { callId: string; url: string; action: string; agent: AgentId; trustLevel: TrustLevel; timestamp: Date };
  'web:error': { callId: string; url: string; action: string; error: string; timestamp: Date };

  // ═══════════════════════════════════════════════════════════════════════
  // PROVIDER LIFECYCLE events (Multi-Model LLM Routing)
  // ═══════════════════════════════════════════════════════════════════════
  'provider:connected': { providerId: string; models: string[]; latencyMs: number };
  'provider:disconnected': { providerId: string; reason: string };
  'provider:error': { providerId: string; error: string; model: string; retryable: boolean };
  'provider:health_changed': { providerId: string; status: 'healthy' | 'degraded' | 'down' };

  // ═══════════════════════════════════════════════════════════════════════
  // CASCADE ROUTING events (FrugalGPT)
  // ═══════════════════════════════════════════════════════════════════════
  'cascade:started': { chain: string; queryLength: number };
  'cascade:step_complete': { chain: string; step: number; model: string; quality: number; escalated: boolean; costCents: number };
  'cascade:complete': { chain: string; finalModel: string; totalSteps: number; totalCostCents: number; durationMs: number };
  'ai:cascade_routing_used': {
    requestId: string;
    chainId: string;
    baseChainId: string;
    finalModel: string;
    timeBlock: string;
    timestamp: string;
  };
  'ai:cascade_routing_failed': {
    requestId: string;
    chainId: string;
    error: string;
    fallingBackToModel: string;
    timestamp: string;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PLUGIN SYSTEM events
  // ═══════════════════════════════════════════════════════════════════════
  'plugin:registered': { pluginId: string; name: string; capabilities: string[] };
  'plugin:initialized': { pluginId: string; durationMs: number };
  'plugin:error': { pluginId: string; error: string; fatal: boolean };
  'plugin:shutdown': { pluginId: string };
  'plugin:health_changed': { pluginId: string; healthy: boolean; details?: string };
  'plugin:briefing_contributed': { pluginId: string; section: string; type: 'morning' | 'evening' | 'weekly' };
  'plugin:alert_generated': { pluginId: string; severity: 'info' | 'warning' | 'critical'; title: string };

  // ═══════════════════════════════════════════════════════════════════════
  // CRYPTO PLUGIN events (CoinGecko)
  // ═══════════════════════════════════════════════════════════════════════
  'crypto:price_fetched': { coins: string[]; source: string; cached: boolean; timestamp: string };
  'crypto:portfolio_updated': { totalValue: number; change24h: number; holdings: number; timestamp: string };
  'crypto:alert_triggered': { coinId: string; type: 'above' | 'below'; price: number; threshold: number; timestamp: string };
  'crypto:snapshot_saved': { totalValue: number; holdings: number; timestamp: string };

  // ═══════════════════════════════════════════════════════════════════════
  // POKEMON TCG PLUGIN events
  // ═══════════════════════════════════════════════════════════════════════
  'pokemon:card_searched': { query: string; resultCount: number; cached: boolean; timestamp: string };
  'pokemon:collection_updated': { totalCards: number; totalValue: number; timestamp: string };
  'pokemon:alert_triggered': { cardId: string; cardName: string; type: 'above' | 'below'; price: number; threshold: number; timestamp: string };
  'pokemon:snapshot_saved': { totalValue: number; totalCards: number; timestamp: string };

  // ═══════════════════════════════════════════════════════════════════════
  // TTS PLUGIN events (ElevenLabs)
  // ═══════════════════════════════════════════════════════════════════════
  'tts:speech_generated': { textLength: number; cost: number; cached: boolean; voice: string; timestamp: string };
  'tts:budget_rejected': { textLength: number; estimatedCost: number; dailyCap: number; timestamp: string };

  // ═══════════════════════════════════════════════════════════════════════
  // TELEGRAM BOT PLUGIN events
  // ═══════════════════════════════════════════════════════════════════════
  'telegram:command_received': { command: string; userId: number; chatId: number; timestamp: string };
  'telegram:message_sent': { chatId: number; type: 'text' | 'voice' | 'photo'; timestamp: string };
  'telegram:auth_rejected': { userId: number; chatId: number; timestamp: string };
  'telegram:rate_limited': { userId: number; chatId: number; timestamp: string };
  'telegram:bot_started': { botUsername: string; timestamp: string };
  'telegram:bot_stopped': { reason: string; timestamp: string };

  // ═══════════════════════════════════════════════════════════════════════
  // KNOWLEDGE MANAGEMENT events (Cognitive Layer)
  // ═══════════════════════════════════════════════════════════════════════
  'knowledge:source_fetched': { sourceId: string; contentLength: number; timestamp: string };
  'knowledge:validated': { sourceId: string; contentId: string; passed: boolean; stage: string; stageNumber: number };

  // ═══════════════════════════════════════════════════════════════════════
  // LEARNING LOOP events (Cognitive Layer)
  // ═══════════════════════════════════════════════════════════════════════
  'learning:review_complete': { grade: string; successRate: number; decisionsCount: number; timestamp: string };
  'learning:gap_identified': { gapCount: number; topGapSeverity: string; timestamp: string };
  'learning:assessment_complete': { grade: string; overallImprovement: number; trend: string; timestamp: string };
  'learning:improvement_measured': { metric: string; previous: number; current: number; change: number };

  // ═══════════════════════════════════════════════════════════════════════
  // VECTOR STORE & KNOWLEDGE events (Master Plan Phase 2)
  // ═══════════════════════════════════════════════════════════════════════
  'vector:document_indexed': {
    documentId: string;
    contentHash: string;
    source: string;
    sourceType: string;
    domain?: string;
    chunkIndex: number;
    chunkTotal: number;
    timestamp: Date;
  };
  'vector:search_complete': {
    resultCount: number;
    totalSearched: number;
    topScore: number;
    duration: number;
    filters: {
      domain?: string;
      sourceType?: string;
      tags?: string[];
    };
    timestamp: Date;
  };
  'knowledge:ingested': { sourceType: string; sourceId: string; chunksCreated: number };
  'knowledge:queried': { query: string; resultCount: number; responseGenerated: boolean };

  // ═══════════════════════════════════════════════════════════════════════
  // INVESTMENT INTELLIGENCE events (Master Plan Phase 4)
  // ═══════════════════════════════════════════════════════════════════════
  'market:snapshot_complete': { timestamp: string; pricesChecked: number; alertsGenerated: number };
  'market:price_alert': { symbol: string; price: number; change: number; threshold: number };
  'investment:opportunity_detected': { category: string; title: string; score: number };
  'investment:portfolio_update': { totalValue: number; dailyChange: number };
  'career:new_matches': { count: number; topMatch: string };

  // ═══════════════════════════════════════════════════════════════════════
  // OPERATIONS events (Master Plan Phase 2/7)
  // ═══════════════════════════════════════════════════════════════════════
  'ops:backup_complete': { type: string; size: number; duration: number };
  'ops:backup_failed': { type: string; error: string };
  'ops:git_synced': { filesCommitted: number; pushed: boolean };
  'system:health_check': { status: 'healthy' | 'degraded' | 'unhealthy'; failures: string[] };

  // ═══════════════════════════════════════════════════════════════════════
  // MEMORY EVOLUTION events (Master Plan Phase 6)
  // ═══════════════════════════════════════════════════════════════════════
  'memory:daily_captured': { date: string; entryCount: number };
  'memory:weekly_synthesized': { weekId: string; patternCount: number };
  'memory:promoted_long_term': { entryId: string; confidence: number };

  // ═══════════════════════════════════════════════════════════════════════
  // TELEGRAM TOPICS events (Master Plan Phase 2)
  // ═══════════════════════════════════════════════════════════════════════
  'telegram:topic_message_sent': { topicName: string; messageId: number; success: boolean };

  // ═══════════════════════════════════════════════════════════════════════
  // CONTENT PIPELINE events (Master Plan Phase 5)
  // ═══════════════════════════════════════════════════════════════════════
  'content:draft_created': { topicId: string; title: string; platform: string };
  'content:approved': { topicId: string; scheduledFor?: string };

  // ═══════════════════════════════════════════════════════════════════════
  // INTELLIGENCE SCANNER events (Master Plan Phase 4)
  // ═══════════════════════════════════════════════════════════════════════
  'intelligence:scan_started': { scanId: string; startedAt: string };
  'intelligence:scan_complete': { scanId: string; itemsFound: number; topScore: number; duration: number };
  'intelligence:new_item': { id: string; title: string; score: number; domains: string[]; source: string };
  'intelligence:digest_generated': { date: string; sections: number; items: number };
}

/**
 * Typed pub/sub event system for ARI
 */
export class EventBus {
  private listeners: Map<string, Set<(payload: unknown) => void>> = new Map();
  private handlerErrors: number = 0;
  private handlerTimeoutMs: number = 30_000; // 30 second default timeout

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
        this.handlerErrors++;
        const errorMsg = error instanceof Error ? error.message : String(error);

        // Log error
        log.error({ event: String(event), err: error }, 'Error in event handler');

        // Emit error event (guard against recursion from handler_error handlers)
        if (event !== 'system:handler_error' && event !== 'audit:log') {
          this.emit('system:handler_error', {
            event: String(event),
            error: errorMsg,
            handler: handler.name || 'anonymous',
            timestamp: new Date(),
          });
        }
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
    this.handlerErrors = 0;
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

  /**
   * Get the number of handler errors that have occurred
   */
  getHandlerErrorCount(): number {
    return this.handlerErrors;
  }

  /**
   * Set handler timeout in milliseconds (0 to disable)
   */
  setHandlerTimeout(ms: number): void {
    this.handlerTimeoutMs = ms;
  }
}
