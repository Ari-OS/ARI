import type { Message, AuditEvent, SecurityEvent, AgentId, TrustLevel } from './types.js';
import { createLogger } from './logger.js';

const log = createLogger('event-bus');

// EventMap remains the same...
export interface EventMap {
  'message:received': Message;
  'message:accepted': Message;
  'message:processed': Message;
  'message:rejected': { messageId: string; reason: string; riskScore: number };
  'message:response': { content: string; source: string; timestamp: Date };
  'audit:logged': AuditEvent;
  'security:detected': SecurityEvent;
  'security:degraded': { reason: string; timestamp: Date };
  'gateway:started': { port: number; host: string };
  'gateway:stopped': { reason: string };
  'system:ready': { version: string };
  'system:error': { error: Error; context: string };
  'system:handler_error': { event: string; error: string; handler: string; timestamp: Date };
  'system:halted': { authority: string; reason: string; timestamp: Date };
  'system:resumed': { authority: string; timestamp: Date };

  'system:routed': { messageId: string; contextId?: string; route: string; timestamp: Date };

  'security:alert': { type: string; source: string; data: Record<string, unknown> };
  'agent:started': { agent: AgentId; timestamp: Date };
  'agent:stopped': { agent: AgentId; reason: string };
  'tool:executed': { toolId: string; callId: string; success: boolean; agent: AgentId };
  'tool:approval_required': { toolId: string; callId: string; agent: AgentId; parameters: Record<string, unknown> };
  'memory:stored': { memoryId: string; type: string; partition: string; agent: AgentId };
  'memory:quarantined': { memoryId: string; reason: string; agent: AgentId };

  'vote:started': { voteId: string; topic: string; threshold: string; deadline: string };
  'vote:cast': { voteId: string; agent: AgentId; option: string };
  'vote:completed': { voteId: string; status: string; result?: Record<string, unknown> };
  'vote:vetoed': { voteId: string; vetoer: AgentId; domain: string; tier?: string; reason: string };
  'vote:matrix_update': { voteId: string; matrix: Record<string, unknown> };
  'arbiter:ruling': { ruleId: string; type: string; decision: string };
  'overseer:gate': { gateId: string; passed: boolean; reason: string };

  'permission:granted': { requestId: string; toolId: string; agentId: AgentId; tokenId: string; autoApproved: boolean };
  'permission:denied': { requestId: string; toolId: string; agentId: AgentId; reason: string; violations: string[] };
  'permission:approval_required': { requestId: string; toolId: string; agentId: AgentId; parameters: Record<string, unknown>; permissionTier: string };
  'permission:approved': { requestId: string; toolId: string; agentId: AgentId; tokenId: string; approver: AgentId };
  'permission:rejected': { requestId: string; toolId: string; agentId: AgentId; rejector: AgentId; reason: string };
  'permission:expired': { requestId: string; toolId: string; agentId: AgentId };

  'tool:registered': { toolId: string; toolName: string };
  'tool:unregistered': { toolId: string };

  'session:started': { sessionId: string; channel: string; senderId: string; groupId?: string; trustLevel: TrustLevel; startedAt: Date };
  'session:ended': { sessionId: string; reason: string; endedAt: Date };
  'session:activity': { sessionId: string; timestamp: Date };

  'tool:start': { callId: string; toolId: string; toolName: string; agent: AgentId; sessionId?: string; parameters: Record<string, unknown>; timestamp: Date };
  'tool:update': { callId: string; toolId: string; progress?: number; status: string; message?: string; timestamp: Date };
  'tool:end': { callId: string; toolId: string; success: boolean; result?: unknown; error?: string; duration: number; timestamp: Date };

  'channel:connected': { channelId: string; channelName: string; connectedAt: Date };
  'channel:disconnected': { channelId: string; channelName: string; reason: string; disconnectedAt: Date };
  'channel:message:inbound': { channelId: string; messageId: string; senderId: string; content: string; timestamp: Date };
  'channel:message:outbound': { channelId: string; messageId: string; recipientId: string; content: string; timestamp: Date };

  'scheduler:task_run': { taskId: string; taskName: string; startedAt: Date; runId?: string };
  'scheduler:task_complete': { taskId: string; taskName: string; duration: number; success: boolean; error?: string; runId?: string; triggeredBy?: 'scheduler' | 'manual' | 'api' | 'subagent' };
  'scheduler:daily_reset': { date: string; previousDate: string };

  'knowledge:indexed': { documentCount: number; duration: number };
  'knowledge:searched': { query: string; resultCount: number };

  'subagent:spawned': { taskId: string; agentId: AgentId; worktree: string };
  'subagent:progress': { taskId: string; progress: number; message: string };
  'subagent:completed': { taskId: string; success: boolean; result?: unknown };

  'context:loaded': { path: string; depth: number; skills: string[] };

  'alert:created': { id: string; severity: string; title: string; message: string; source: string };
  'alert:acknowledged': { id: string; acknowledgedBy: string; acknowledgedAt: string };
  'alert:resolved': { id: string; resolvedBy: string; resolvedAt: string };

  'audit:log': { action: string; agent: string; trustLevel: TrustLevel; details: Record<string, unknown> };

  'cognition:belief_updated': { hypothesis: string; priorProbability: number; posteriorProbability: number; shift: number; timestamp: string; };
  'cognition:expected_value_calculated': { decision: string; expectedValue: number; recommendation: string; timestamp: string; };
  'cognition:kelly_calculated': { recommendedFraction: number; strategy: string; edge: number; timestamp: string; };
  'cognition:leverage_point_identified': { system: string; level: number; effectiveness: string; timestamp: string; };
  'cognition:antifragility_assessed': { item: string; category: string; score: number; timestamp: string; };
  'cognition:decision_tree_evaluated': { rootId: string; expectedValue: number; optimalPath: string[]; timestamp: string; };
  'cognition:bias_detected': { agent: string; biases: Array<{ type: string; severity: number }>; reasoning: string; timestamp: string; };
  'cognition:emotional_risk': { riskScore: number; state: { valence: number; arousal: number; dominance: number }; emotions: string[]; timestamp: string; };
  'cognition:discipline_check': { agent: string; decision: string; passed: boolean; overallScore: number; violations: string[]; timestamp: string; };
  'cognition:fear_greed_detected': { pattern: string; phase: string; severity: number; recommendation: string; timestamp: string; };
  'cognition:thought_reframed': { distortions: string[]; originalThought: string; reframedThought: string; timestamp: string; };
  'cognition:reflection_complete': { outcomeId: string; insights: string[]; principles: string[]; timestamp: string; };
  'cognition:wisdom_consulted': { query: string; tradition: string; principle: string; timestamp: string; };
  'cognition:practice_plan_created': { skill: string; currentLevel: number; targetLevel: number; estimatedHours: number; timestamp: string; };
  'cognition:dichotomy_analyzed': { situation: string; controllableCount: number; uncontrollableCount: number; focusArea: string; timestamp: string; };
  'cognition:virtue_check': { decision: string; overallAlignment: number; conflicts: string[]; timestamp: string; };

  'learning:performance_review': { period: string; successRate: number; biasCount: number; insightCount: number; recommendations: string[]; timestamp: string; };
  'learning:gap_analysis': { period: string; gapsFound: number; topGaps: Array<{ domain: string; severity: string }>; sourceSuggestions: number; timestamp: string; };
  'learning:self_assessment': { period: string; grade: string; improvement: number; trend: string; recommendations: string[]; timestamp: string; };
  'learning:insight_generated': { insightId: string; type: string; description: string; confidence: number; source: string; generalizes: boolean; timestamp: string; };

  'system:heartbeat': { componentId: string; status: string; timestamp: Date; metrics: Record<string, unknown>; latencyMs: number };
  'system:heartbeat_started': { timestamp: Date; componentCount: number };
  'system:heartbeat_stopped': { timestamp: Date };
  'system:heartbeat_failure': { componentId: string; consecutiveFailures: number; timestamp: Date; error: string };

  'cost:tracked': { operation: string; cost: number; model: string };
  'cost:budget_warning': { type: string; current: number; budget: number; percentage: number };
  'cost:budget_exceeded': { type: string; current: number; budget: number };
  'budget:daily_reset': { previousUsage: number; profile: string };
  'billing:cycle_started': { cycleStart: string; cycleEnd: string; budget: number };

  'value:day_analyzed': { date: string; score: number; cost: number; efficiency: string; breakdown: string[]; };
  'value:weekly_report': { averageScore: number; totalCost: number; trend: string; recommendations: string[]; };

  'briefing:morning_delivered': { date: string };
  'briefing:evening_delivered': { date: string };
  'briefing:weekly_delivered': { date: string; weekNumber: number };
  'test:generated': { file: string; testCount: number };
  'doc:written': { file: string; wordCount: number };
  'bug:fixed': { description: string; file: string };
  'code:improved': { description: string; file: string };
  'insight:high_value': { insight: string; category: string };
  'pattern:learned': { pattern: string; confidence: number };
  'initiative:executed': { initiativeId: string; title: string; category: string; success: boolean };

  'adaptive:weekly_summary': { summary: Record<string, unknown>; recommendations: unknown[] };
  'adaptive:recommendation': { type: string; recommendation: string; confidence: number };
  'adaptive:pattern_applied': { patternId: string; result: 'success' | 'failure' };
  'user:active': { hour: number; date: string };
  'model:selected': { taskType: string; model: string; success: boolean };
  'notification:response': { category: string; priority: string; response: 'opened' | 'dismissed' | 'ignored'; };

  'approval:item_added': { itemId: string; type: string; risk: string; estimatedCost: number; metadata?: Record<string, unknown> };
  'approval:approved': { itemId: string; type: string; approvedBy?: string };
  'approval:rejected': { itemId: string; type: string; reason: string; rejectedBy?: string };
  'approval:expired': { itemId: string; type: string };

  'plan:review_started': { planId: string; requiredReviews: string[] };
  'plan:review_approved': { planId: string; approvedAt: Date };
  'plan:review_rejected': { planId: string; reason: string };
  'plan:review_needs_revision': { planId: string; concerns: string[]; tips: string[] };

  'scratchpad:written': { agent: string; key: string; size: number };
  'scratchpad:deleted': { agent: string; key: string };
  'scratchpad:cleared': { agent: string; count: number };
  'scratchpad:cleanup': { cleaned: number; remaining: number };

  'model:routed': { task: string; model: string; reason: string; estimatedCost?: number };

  'e2e:scenario_started': { runId: string; scenario: string };
  'e2e:scenario_complete': { runId: string; scenario: string; passed: boolean; duration: number; error?: string; screenshot?: string; };
  'e2e:run_complete': { runId: string; passed: number; failed: number; skipped: number; duration: number; consecutiveFailures: number; };
  'e2e:bug_filed': { runId: string; issueUrl: string; issueNumber: number };
  'e2e:skipped': { reason: 'budget_pause' | 'already_running' | 'gateway_down' };

  'budget:warning': { spent: number; remaining: number };
  'budget:critical': { spent: number; remaining: number };
  'budget:pause': { spent: number; budget: number; percentUsed: number };
  'budget:cycle_reset': { previousSpent: number; newBudget: number };
  'budget:update': { status: string; spent: number; remaining: number; percentUsed: number; mode: string };

  'ai:request_received': { requestId: string; category: string; complexity: string; classificationScore: number; confidence: number; suggestedChain: string; reasoning: string; agent: string; timestamp: string; };
  'ai:model_selected': { requestId: string; model: string; valueScore: number; reasoning: string; estimatedCost: number; timestamp: string; };
  'ai:response_evaluated': { requestId: string; qualityScore: number; escalated: boolean; escalationReason?: string; timestamp: string; };
  'ai:circuit_breaker_state_changed': { previousState: string; newState: string; failures: number; timestamp: string; };

  'llm:request_start': { model: string; estimatedTokens: number };
  'llm:request_complete': { timestamp: string; model: string; inputTokens: number; outputTokens: number; cost: number; taskType: string; taskCategory?: string; duration: number; success: boolean; };

  'ai:model_fallback': { originalModel: string; fallbackModel: string; reason: string; category: string; timestamp: string; };
  'budget:projection_exceeded': { projected: number; budget: number; burnRate: number; hoursRemaining: number; percentOver: number; };
  'self_improvement:low_confidence': { initiativeId: string; title: string; confidence: number; threshold: number; reason: string; };

  'web:navigate': { callId: string; url: string; action: string; agent: AgentId; trustLevel: TrustLevel; timestamp: Date };
  'web:error': { callId: string; url: string; action: string; error: string; timestamp: Date };

  'provider:connected': { providerId: string; models: string[]; latencyMs: number };
  'provider:disconnected': { providerId: string; reason: string };
  'provider:error': { providerId: string; error: string; model: string; retryable: boolean };
  'provider:health_changed': { providerId: string; status: 'healthy' | 'degraded' | 'down' };

  'cascade:started': { chain: string; queryLength: number };
  'cascade:step_complete': { chain: string; step: number; model: string; quality: number; escalated: boolean; costCents: number };
  'cascade:complete': { chain: string; finalModel: string; totalSteps: number; totalCostCents: number; durationMs: number };
  'ai:cascade_routing_used': { requestId: string; chainId: string; baseChainId: string; finalModel: string; timeBlock: string; timestamp: string; };
  'ai:cascade_routing_failed': { requestId: string; chainId: string; error: string; fallingBackToModel: string; timestamp: string; };

  'plugin:registered': { pluginId: string; name: string; capabilities: string[] };
  'plugin:initialized': { pluginId: string; durationMs: number };
  'plugin:error': { pluginId: string; error: string; fatal: boolean };
  'plugin:shutdown': { pluginId: string };
  'plugin:health_changed': { pluginId: string; healthy: boolean; details?: string };
  'plugin:briefing_contributed': { pluginId: string; section: string; type: 'morning' | 'evening' | 'weekly' };
  'plugin:alert_generated': { pluginId: string; severity: 'info' | 'warning' | 'critical'; title: string };

  'crypto:price_fetched': { coins: string[]; source: string; cached: boolean; timestamp: string };
  'crypto:portfolio_updated': { totalValue: number; change24h: number; holdings: number; timestamp: string };
  'crypto:alert_triggered': { coinId: string; type: 'above' | 'below'; price: number; threshold: number; timestamp: string };
  'crypto:snapshot_saved': { totalValue: number; holdings: number; timestamp: string };

  'pokemon:card_searched': { query: string; resultCount: number; cached: boolean; timestamp: string };
  'pokemon:collection_updated': { totalCards: number; totalValue: number; timestamp: string };
  'pokemon:alert_triggered': { cardId: string; cardName: string; type: 'above' | 'below'; price: number; threshold: number; timestamp: string };
  'pokemon:snapshot_saved': { totalValue: number; totalCards: number; timestamp: string };

  'tts:speech_generated': { textLength: number; cost: number; cached: boolean; voice: string; timestamp: string };
  'tts:budget_rejected': { textLength: number; estimatedCost: number; dailyCap: number; timestamp: string };

  'telegram:command_received': { command: string; userId: number; chatId: number; timestamp: string };
  'telegram:message_sent': { chatId: number; type: 'text' | 'voice' | 'photo'; timestamp: string };
  'telegram:auth_rejected': { userId: number; chatId: number; timestamp: string };
  'telegram:rate_limited': { userId: number; chatId: number; timestamp: string };
  'telegram:bot_started': { botUsername: string; timestamp: string };
  'telegram:bot_stopped': { reason: string; timestamp: string };
  'telegram:intent_routed': { intent: string; via: 'fast_path' | 'ai_classification'; confidence?: number; timestamp: string };
  'telegram:voice_transcribed': { duration: number; textLength: number; timestamp: string };
  'telegram:skill_invoked': { skill: string; confidence: number; timestamp: string };
  'telegram:calendar_viewed': { userId?: number; subcommand: string; eventCount: number };
  'telegram:reminders_viewed': { userId?: number; reminderCount: number };
  'telegram:market_viewed': { userId?: number };
  'telegram:knowledge_searched': { userId?: number; query: string; resultCount: number };
  'telegram:memory_stored': { userId: number | string; docId: string; contentLength: number };
  'telegram:memory_recalled': { userId?: number; query: string; resultCount: number };
  'telegram:settings_changed': { userId?: number; setting: string; value: string };
  'telegram:skills_listed': { userId?: number };
  'telegram:video_approved': { projectId: string; timestamp: string };
  'telegram:request_approval': { projectId: string; category: string; timestamp: string };
  'telegram:council_vote': { voteId: string; agent: string; option: string };

  'knowledge:source_fetched': { sourceId: string; contentLength: number; timestamp: string };
  'knowledge:validated': { sourceId: string; contentId: string; passed: boolean; stage: string; stageNumber: number };

  'learning:review_complete': { grade: string; successRate: number; decisionsCount: number; timestamp: string };
  'learning:gap_identified': { gapCount: number; topGapSeverity: string; timestamp: string };
  'learning:assessment_complete': { grade: string; overallImprovement: number; trend: string; timestamp: string };
  'learning:improvement_measured': { metric: string; previous: number; current: number; change: number };

  'vector:document_indexed': { documentId: string; contentHash: string; source: string; sourceType: string; domain?: string; chunkIndex: number; chunkTotal: number; timestamp: Date; };
  'vector:search_complete': { resultCount: number; totalSearched: number; topScore: number; duration: number; filters: { domain?: string; sourceType?: string; tags?: string[]; }; timestamp: Date; };
  'knowledge:ingested': { sourceType: string; sourceId: string; chunksCreated: number };
  'knowledge:queried': { query: string; resultCount: number; responseGenerated: boolean };

  'market:snapshot_complete': { timestamp: string; pricesChecked: number; alertsGenerated: number };
  'market:price_alert': { symbol: string; price: number; change: number; threshold: number; context?: string };
  'market:flash_crash': { asset: string; dropPercent: number; previousPrice: number; currentPrice: number };
  'market:anomaly_detected': { asset: string; zScore: number; price: number; baselineMean: number };
  'market:premarket_briefing': { alertCount: number; timestamp: string };
  'market:postmarket_briefing': { portfolioValue: number; dailyChangePercent: number; timestamp: string };
  'market:weekly_analysis': { watchlistSize: number; timestamp: string };
  'investment:opportunity_detected': { category: string; title: string; score: number };
  'investment:portfolio_update': { totalValue: number; dailyChange: number };
  'career:new_matches': { count: number; topMatch: string };

  'ops:backup_complete': { type: string; size: number; duration: number };
  'ops:backup_failed': { type: string; error: string };
  'ops:git_synced': { filesCommitted: number; pushed: boolean };
  'system:health_check': { status: 'healthy' | 'degraded' | 'unhealthy'; failures: string[] };

  'memory:daily_captured': { date: string; entryCount: number };
  'memory:weekly_synthesized': { weekId: string; patternCount: number };
  'memory:promoted_long_term': { entryId: string; confidence: number };

  'telegram:topic_message_sent': { topicName: string; messageId: number; success: boolean };

  'content:draft_created': { topicId: string; title: string; platform: string };
  'content:approved': { topicId: string; scheduledFor?: string };
  'content:trend_analyzed': { topicCount: number; topDomains: string[] };
  'content:draft_generated': { draftId: string; platform: string; topicHeadline: string; costUsd: number };
  'content:draft_reviewed': { draftId: string; action: 'approved' | 'edited' | 'rejected'; reason?: string };
  'content:published': { draftId: string; platform: string; publishedIds: string[] };
  'content:publish_failed': { draftId: string; platform: string; error: string };
  'content:repurposed': { originalId: string; newPlatform: string; timestamp: string };
  'content:intent_scan_complete': { matchCount: number; timestamp: string };
  'content:metrics_collected': { postCount: number; timestamp: string };
  'content:feedback_generated': { insightCount: number; timestamp: string };
  'content:engagement_found': { opportunityCount: number; timestamp: string };

  'intelligence:scan_started': { scanId: string; startedAt: string };
  'intelligence:scan_complete': { scanId: string; itemsFound: number; topScore: number; duration: number };
  'intelligence:new_item': { id: string; title: string; score: number; domains: string[]; source: string };
  'intelligence:digest_generated': { date: string; sections: number; items: number };

  'life_monitor:scan_complete': { alerts: number; critical: number; urgent: number };
  'life_monitor:report_ready': { alertCount: number; critical: number; urgent: number; summary: string };

  'notification:snoozed': { notificationId: string; snoozeUntil: number };
  'notification:detail_requested': { notificationId: string; action: string; chatId?: number; messageId?: number };
  'notification:saved': { notificationId: string; category?: string; title?: string };

  'apple:calendar_polled': { eventCount: number; nextEvent?: string; timestamp: string };
  'apple:reminder_synced': { synced: number; skipped: number; errors: number; timestamp: string };
  'apple:focus_changed': { active: boolean; mode: string | null; timestamp: string };

  'integration:weather_fetched': { location: string; tempF: number; condition: string; timestamp: string };
  'integration:news_fetched': { source: string; itemCount: number; timestamp: string };
  'integration:github_polled': { repo: string; stars: number; openPRs: number; timestamp: string };

  'integration:gmail_fetched': { emailCount: number; newCount: number; timestamp: string };
  'integration:gmail_classified': { messageId: string; classification: string; timestamp: string };

  'integration:perplexity_ready': { timestamp: string };

  'video:approval_requested': { requestId: string; type: string; videoProjectId: string; timestamp: string };
  'video:approval_response': { requestId: string; action: string; feedback?: string };
  'video:stage_started': { projectId: string; stage: string; timestamp: string };
  'video:stage_completed': { projectId: string; stage: string; data: Record<string, unknown>; timestamp: string };
  'video:stage_update': { stage: string; message: string; topic: string };
  'video:user_progress': { chatId: number; stage: string; message: string };
  'video:published': { projectId: string; youtubeVideoId: string; title: string; platform: string };
  'video:pipeline_status_check': { checkedAt: string };
  'content:video_script_ready': { script: string | string[]; topic: string };
  'market:earnings_analysis_requested': { requestedAt: string };

  'alert:system_unhealthy': { timestamp: string; components: string[]; severity: string };

  'backup:completed': { type: string; path: string; size: number; duration: number };
  'backup:failed': { type: string; error: string; retryable: boolean };
  'backup:pruned': { deletedCount: number; remainingCount: number; freedBytes: number };

  'investment:analysis_complete': { symbol: string; recommendation: string; confidence: number; timestamp: string };

  'career:weekly_report': { matchCount: number; topMatches: string[]; timestamp: string };

  'pokemon:price_spike': { cardId: string; cardName: string; priceUsd: number; changePercent: number; timestamp: string };
  'pokemon:investment_signal': { cardId: string; cardName: string; signal: 'buy' | 'sell' | 'hold'; confidence: number; timestamp: string };

  'calendar:events_fetched': { timestamp: string; eventCount: number; nextEvent: string | null };
  'calendar:reminder': { title: string; startsAt: string; minutesBefore: number };

  'health:check_complete': { timestamp: string; healthy: boolean; components: Record<string, boolean> };

  'content:rejected': { timestamp: string; draftId: string; reason: string };

  'project:proposed': { timestamp: string; name: string; description: string };
  'project:approved': { timestamp: string; name: string; scaffoldedAt: string };

  'preference:updated': { timestamp: string; key: string; value: unknown };
  'preference:learned': { timestamp: string; pattern: string; confidence: number };

  'feedback:signal': { messageId: string; chatId: number; signal: 'positive' | 'negative'; context?: string; timestamp: string };

  'feedback:recorded': { messageId: string; userId: string; positive: boolean; category: string; timestamp: string };
  'feedback:analysis_generated': { period: { start: string; end: string }; totalFeedback: number; positiveRate: number; timestamp: string };

  'x:cost_tracked': { operation: string; endpoint: string; cost: number; itemCount: number; deduplicated: number; timestamp: string };
  'x:limit_approaching': { percentUsed: number; spent: number; limit: number; level: 'warning' | 'critical'; timestamp: string };
  'x:daily_reset': { previousDate: string; previousSpent: number; newDate: string; timestamp: string };
  'x:request_deduplicated': { operation: string; originalCount: number; deduplicatedCount: number; savedCost: number; timestamp: string };
  'x:operation_skipped': { operation: string; reason: string; priority: number; timestamp: string };

  'queue:enqueued': { id: string; lane: string; priority: number; timestamp: string };
  'queue:completed': { id: string; lane: string; durationMs: number; timestamp: string };
  'queue:failed': { id: string; lane: string; error: string; retries: number; timestamp: string };

  'agent:research_started': { query: string; sources: string[]; timestamp: string };
  'agent:research_completed': { query: string; findingsCount: number; confidence: number; timestamp: string };
  'agent:writing_started': { topic: string; format: string; timestamp: string };
  'agent:writing_completed': { topic: string; format: string; wordCount: number; timestamp: string };
  'agent:analysis_started': { question: string; timestamp: string };
  'agent:analysis_completed': { question: string; dataPoints: number; confidence: number; timestamp: string };

  'coordinator:dispatch_started': { taskCount: number; timestamp: string; swarmSize?: number };
  'coordinator:dispatch_completed': { taskCount: number; successCount: number; failedCount: number; durationMs: number; timestamp: string };

  'voice:transcribed': { userId: string; transcript: string; durationMs: number; timestamp: string };
  'voice:response_sent': { userId: string; transcript: string; responseLength: number; hadAudio: boolean; durationMs: number; timestamp: string };
  'voice:error': { userId: string; stage: 'transcription' | 'processing' | 'tts'; error: string; timestamp: string };

  'soul:proposal_created': { proposalId: string; dimension: string; currentValue: string; proposedValue: string; reasoning: string; timestamp: string };
  'soul:proposal_approved': { proposalId: string; dimension: string; approvedBy: string; timestamp: string };
  'soul:proposal_rejected': { proposalId: string; dimension: string; reason: string; timestamp: string };
  'soul:weekly_reflection': { period: { start: string; end: string }; proposalsCreated: number; proposalsApproved: number; timestamp: string };
  'soul:change_proposed': { proposalId: string; file: string; rationale: string; diff: string; expiresAt: string };
  'soul:change_applied': { proposalId: string; file: string; appliedAt: string; approvedBy: string };
  'soul:change_rejected': { proposalId: string; file: string; reason: string; rejectedBy: string };
  'soul:approve_request': { proposalId: string };
  'soul:reject_request': { proposalId: string; reason?: string };

  'content:quality_scored': { contentId: string; score: number; dimensions: Record<string, number>; timestamp: string };
  'content:humanized': { contentId: string; originalLength: number; humanizedLength: number; patternsRemoved: number; timestamp: string };

  'security:anomaly_detected': { detectorId: string; anomalyType: string; severity: number; details: Record<string, unknown>; timestamp: string };
  'security:api_key_warning': { keyId: string; issue: string; severity: 'info' | 'warning' | 'critical'; timestamp: string };
  'security:sanitizer_blocked': { pattern: string; category: string; input: string; timestamp: string };

  'ops:dependency_check': { packageCount: number; outdatedCount: number; vulnerableCount: number; timestamp: string };
  'ops:vulnerability_found': { packageName: string; severity: string; advisoryUrl: string; timestamp: string };

  'social:growth_report': { platform: string; followers: number; growth: number; engagement: number; timestamp: string };
  'social:milestone_reached': { platform: string; metric: string; value: number; timestamp: string };

  'fathom:meeting_processed': { meetingId: string; actionItemCount: number; duration: number; timestamp: string };
  'fathom:action_item_created': { id: string; title: string; assignee: string; dueDate: string; timestamp: string };

  'health:meal_logged': { mealId: string; description: string; calories: number; timestamp: string };
  'health:nutrition_summary': { date: string; totalCalories: number; macros: Record<string, number>; timestamp: string };

  'entity:extracted': { sourceId: string; entityCount: number; types: string[]; timestamp: string };
  'entity:linked': { entityId: string; linkedTo: string; relationship: string; timestamp: string };

  'governance:council_convened': { councilId: string; memberCount: number; topic: string; timestamp: string };
  'governance:threshold_met': { voteId: string; threshold: string; result: string; timestamp: string };

  'session:state_saved': { timestamp: string };
  'session:state_restored': { lastActive: string; pendingItems: number };
  'autonomy:level_changed': { category: string; previous: string; current: string; timestamp: string };

  'email:triaged': { emailId: string; category: string; priority: string; timestamp: string };
  'email:action_required': { emailId: string; subject: string; suggestedAction: string; timestamp: string };
  'stripe:payment_received': { amount: number; currency: string; customer: string; timestamp: string };
  'stripe:milestone_reached': { milestone: string; currentValue: number; timestamp: string };
  'stripe:churn_detected': { customerId: string; mrr: number; timestamp: string };
  'crm:contact_created': { contactId: string; name: string; category: string; timestamp: string };
  'crm:interaction_logged': { contactId: string; type: string; summary: string; timestamp: string };
  'crm:follow_up_needed': { contactId: string; name: string; daysSinceContact: number; urgency: string; timestamp: string };

  'video:broll_generated': { id: string; prompt: string; duration: number; style: string; provider: string; timestamp: string };
  'video:thumbnail_fallback_used': { url: string; provider: string; prompt: string; timestamp: string };

  'knowledge:kb_ingested': { id: string; sourceType: string; title: string; tags: string[]; timestamp: string };
  'knowledge:kb_searched': { query: string; resultCount: number; timestamp: string };
  'knowledge:kb_accessed': { id: string; accessCount: number; timestamp: string };

  'human:entry_logged': { id: string; quadrant: string; activity: string; quality: number; timestamp: string };
  'human:weekly_review': { period: { start: string; end: string }; overallScore: number; timestamp: string };
  'human:balance_alert': { leastAttended: string; score: number; recommendation: string; timestamp: string };
  'life_review:generated': { period: { start: string; end: string }; overallScore: number; timestamp: string };
  'life_review:delivered': { channel: string; timestamp: string };
}

interface QueuedEvent {
  event: keyof EventMap;
  payload: unknown;
  priority: number;
}

/**
 * Typed pub/sub event system for ARI
 * Asynchronous execution with priority queues (Security=Immediate, Logging=Batched).
 */
export class EventBus {
  private listeners: Map<string, Set<(payload: unknown) => void>> = new Map();
  private handlerErrors: number = 0;
  private handlerTimeoutMs: number = 30_000;
  
  private queue: QueuedEvent[] = [];
  private processing: boolean = false;

  on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as (payload: unknown) => void);
    return () => this.off(event, handler);
  }

  off<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler as (payload: unknown) => void);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers asynchronously based on priority
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const isSecurity = String(event).startsWith('security:');
    const isAudit = String(event).startsWith('audit:');
    
    // Priority: Security = 0 (Immediate), Audit = 2 (Batched/Low), Normal = 1
    const priority = isSecurity ? 0 : (isAudit ? 2 : 1);
    
    this.queue.push({ event, payload, priority });
    this.queue.sort((a, b) => a.priority - b.priority); // Lower number = higher priority
    
    if (!this.processing) {
      void this.processQueue();
    }
  }

  private async processQueue() {
    this.processing = true;
    while (this.queue.length > 0) {
      const { event, payload } = this.queue.shift()!;
      const handlers = this.listeners.get(event as string);
      
      if (!handlers) continue;

      // Execute handlers asynchronously to prevent blocking the thread
      for (const handler of handlers) {
        try {
          await Promise.resolve(handler(payload));
        } catch (error) {
          this.handlerErrors++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          log.error({ event: String(event), err: error }, 'Error in event handler');
          
          if (event !== 'system:handler_error' && event !== 'audit:log') {
            // Queue error event recursively
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
    this.processing = false;
  }

  once<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): () => void {
    const wrappedHandler = (payload: EventMap[K]) => {
      handler(payload);
      this.off(event, wrappedHandler);
    };
    return this.on(event, wrappedHandler);
  }

  clear(): void {
    this.listeners.clear();
    this.handlerErrors = 0;
    this.queue = [];
  }

  listenerCount(event: keyof EventMap): number {
    const handlers = this.listeners.get(event);
    return handlers ? handlers.size : 0;
  }

  getHandlerErrorCount(): number {
    return this.handlerErrors;
  }

  setHandlerTimeout(ms: number): void {
    this.handlerTimeoutMs = ms;
  }
}