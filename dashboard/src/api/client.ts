// ARI API Client
// Connects to the Fastify gateway at 127.0.0.1:3141 (proxied by Vite)

import type {
  HealthStatus,
  DetailedHealth,
  Agent,
  AgentStats,
  Proposal,
  ConstitutionalRule,
  QualityGate,
  MemoryEntry,
  AuditLogResponse,
  AuditVerification,
  Tool,
  Context,
  SchedulerStatus,
  ScheduledTask,
  Subagent,
  SubagentStats,
  SystemMetrics,
  BudgetStatus,
  BudgetProfileName,
  BudgetProfileChangeResult,
  ApprovalQueueResponse,
} from '../types/api';

const API_BASE = '/api';

class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);

  if (!response.ok) {
    throw new APIError(
      response.status,
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

async function postAPI<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new APIError(
      response.status,
      (errorData as { error?: string }).error || `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

// Health Endpoints
export const getHealth = (): Promise<HealthStatus> => fetchAPI('/health');

export const getDetailedHealth = (): Promise<DetailedHealth> =>
  fetchAPI('/health/detailed');

// Agent Endpoints
export const getAgents = (): Promise<Agent[]> => fetchAPI('/agents');

export const getAgentStats = (agentId: string): Promise<AgentStats> =>
  fetchAPI(`/agents/${agentId}/stats`);

// Governance Endpoints
export const getProposals = (): Promise<Proposal[]> => fetchAPI('/proposals');

export const getProposal = (id: string): Promise<Proposal> =>
  fetchAPI(`/proposals/${id}`);

export const getGovernanceRules = (): Promise<ConstitutionalRule[]> =>
  fetchAPI('/governance/rules');

export const approveProposal = (id: string, reasoning?: string): Promise<{ success: boolean; id: string }> =>
  postAPI(`/proposals/${id}/approve`, { reasoning });

export const rejectProposal = (id: string, reasoning?: string): Promise<{ success: boolean; id: string }> =>
  postAPI(`/proposals/${id}/reject`, { reasoning });

export const getQualityGates = (): Promise<QualityGate[]> =>
  fetchAPI('/governance/gates');

// Memory Endpoints
export const getMemories = (params?: {
  type?: string;
  partition?: string;
  limit?: number;
}): Promise<MemoryEntry[]> => {
  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.partition) query.set('partition', params.partition);
  if (params?.limit) query.set('limit', params.limit.toString());

  const queryString = query.toString();
  return fetchAPI(`/memory${queryString ? `?${queryString}` : ''}`);
};

export const getMemory = (id: string): Promise<MemoryEntry> =>
  fetchAPI(`/memory/${id}`);

// Audit Endpoints
export const getAuditLog = (params?: {
  limit?: number;
  offset?: number;
}): Promise<AuditLogResponse> => {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());

  const queryString = query.toString();
  return fetchAPI(`/audit${queryString ? `?${queryString}` : ''}`);
};

export const verifyAuditChain = (): Promise<AuditVerification> =>
  fetchAPI('/audit/verify');

// Tool Endpoints
export const getTools = (): Promise<Tool[]> => fetchAPI('/tools');

// Context Endpoints
export const getContexts = (): Promise<Context[]> => fetchAPI('/contexts');

export const getActiveContext = (): Promise<Context> =>
  fetchAPI('/contexts/active');

// Scheduler Endpoints
export const getSchedulerStatus = (): Promise<SchedulerStatus> =>
  fetchAPI('/scheduler/status');

export const getSchedulerTasks = (): Promise<ScheduledTask[]> =>
  fetchAPI('/scheduler/tasks');

export const triggerSchedulerTask = async (taskId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
  const response = await fetch(`${API_BASE}/scheduler/tasks/${taskId}/trigger`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new APIError(response.status, errorData.error || 'Failed to trigger task');
  }
  return response.json();
};

export const toggleSchedulerTask = async (taskId: string): Promise<{ success: boolean; taskId: string; enabled: boolean }> => {
  const response = await fetch(`${API_BASE}/scheduler/tasks/${taskId}/toggle`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new APIError(response.status, errorData.error || 'Failed to toggle task');
  }
  return response.json();
};

// Subagent Endpoints
export const getSubagents = (): Promise<Subagent[]> => fetchAPI('/subagents');

export const getSubagentStats = (): Promise<SubagentStats> =>
  fetchAPI('/subagents/stats');

export const getSubagent = (agentId: string): Promise<Subagent> =>
  fetchAPI(`/subagents/${agentId}`);

export const deleteSubagent = async (agentId: string): Promise<{ success: boolean; message?: string }> => {
  const response = await fetch(`${API_BASE}/subagents/${agentId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new APIError(response.status, errorData.error || 'Failed to delete subagent');
  }
  return response.json();
};

// System Metrics
export const getSystemMetrics = (): Promise<SystemMetrics> =>
  fetchAPI('/system/metrics');

// Cognitive Layer 0 Endpoints
export interface CognitiveHealth {
  overall: number;
  pillars: Array<{
    pillar: 'LOGOS' | 'ETHOS' | 'PATHOS';
    health: number;
    apisActive: number;
    apisTotal: number;
    lastActivity: string;
    topFramework: string;
    sourcesCount: number;
  }>;
  learningLoopActive: boolean;
  knowledgeSources: number;
}

export interface LearningStatus {
  currentStage: string;
  lastReview: string;
  lastGapAnalysis: string;
  lastAssessment: string;
  nextReview: string;
  nextGapAnalysis: string;
  nextAssessment: string;
  recentInsightsCount: number;
  improvementTrend: 'improving' | 'stable' | 'declining';
}

export interface LearningAnalytics {
  period: { start: string; end: string };
  retentionMetrics: {
    reviews: number;
    successfulReviews: number;
    retentionRate: number;
    dueNow: number;
  };
  practiceQuality: {
    deliberateHours: number;
    distractedHours: number;
    focusRatio: number;
  };
  insights: Array<{ pattern: string; recommendation: string; impact: 'HIGH' | 'MEDIUM' | 'LOW' }>;
}

export interface CalibrationReport {
  overconfidenceBias: number;
  underconfidenceBias: number;
  calibrationCurve: Array<{
    confidenceBucket: string;
    statedConfidence: number;
    actualAccuracy: number;
    delta: number;
    count: number;
  }>;
  predictions: Array<{
    id: string;
    statement: string;
    confidence: number;
    outcome: boolean | null;
    createdAt: string;
    resolvedAt: string | null;
  }>;
}

export interface CognitiveInsight {
  id: string;
  type: 'SUCCESS' | 'MISTAKE' | 'PATTERN' | 'PRINCIPLE' | 'ANTIPATTERN';
  description: string;
  confidence: number;
  timestamp: string;
  framework: string;
}

export interface FrameworkUsage {
  framework: string;
  pillar: 'LOGOS' | 'ETHOS' | 'PATHOS';
  usageCount: number;
  successRate: number;
}

export interface CouncilProfile {
  memberId: string;
  memberName: string;
  memberAvatar: string;
  primaryPillar: 'LOGOS' | 'ETHOS' | 'PATHOS';
  pillarWeights: {
    logos: number;
    ethos: number;
    pathos: number;
  };
  primaryFrameworks: Array<{
    name: string;
    domain: string;
    application: string;
    why: string;
  }>;
  knowledgeSources: string[];
  expertiseAreas: string[];
  consultedFor: string;
  typicalAPIUsage: string[];
  learningPlan: {
    current: string;
    next: string;
    cadence: string;
    quarterlyGoals: string[];
  };
  cognitiveBiasAwareness: {
    naturalTendency: string;
    compensationStrategy: string;
    historicalPattern: string;
    improvementGoal: string;
  };
  performanceMetrics: {
    keyMetric: string;
    baseline: number;
    target: number;
    secondaryMetric?: string;
  };
}

export const getCognitiveHealth = (): Promise<CognitiveHealth> =>
  fetchAPI('/cognition/health');

export const getCognitivePillars = (): Promise<Array<{
  pillar: string;
  name: string;
  icon: string;
  description: string;
  apis: string[];
  sourcesCount: number;
}>> => fetchAPI('/cognition/pillars');

export const getCognitiveSources = (): Promise<{
  total: number;
  byTrustLevel: { verified: number; standard: number };
  sources: Array<{
    id: string;
    name: string;
    pillar: string;
    trustLevel: string;
    category: string;
    frameworks: string[];
  }>;
}> => fetchAPI('/cognition/sources');

export const getCouncilProfiles = (): Promise<CouncilProfile[]> =>
  fetchAPI('/cognition/council-profiles');

export const getCouncilProfile = (memberId: string): Promise<CouncilProfile> =>
  fetchAPI(`/cognition/council-profiles/${memberId}`);

export const getLearningStatus = (): Promise<LearningStatus> =>
  fetchAPI('/cognition/learning/status');

export const getLearningAnalytics = (params?: { days?: number; userId?: string }): Promise<LearningAnalytics> => {
  const query = new URLSearchParams();
  if (params?.days) query.set('days', params.days.toString());
  if (params?.userId) query.set('userId', params.userId);
  const qs = query.toString();
  return fetchAPI(`/cognition/learning/analytics${qs ? `?${qs}` : ''}`);
};

export const getCalibrationReport = (): Promise<CalibrationReport> =>
  fetchAPI('/cognition/learning/calibration');

export const addCalibrationPrediction = (statement: string, confidence: number): Promise<{ id: string }> =>
  postAPI('/cognition/learning/calibration/predictions', { statement, confidence });

export const resolveCalibrationPrediction = (id: string, outcome: boolean): Promise<{ success: boolean }> =>
  postAPI(`/cognition/learning/calibration/predictions/${id}/outcome`, { outcome });

export const getFrameworkUsage = (): Promise<FrameworkUsage[]> =>
  fetchAPI('/cognition/frameworks/usage');

export const getCognitiveInsights = (limit?: number): Promise<CognitiveInsight[]> =>
  fetchAPI(`/cognition/insights${limit ? `?limit=${limit}` : ''}`);

// Budget Endpoints
export const getBudgetStatus = (): Promise<BudgetStatus> =>
  fetchAPI('/budget/status');

export const setBudgetProfile = (profile: BudgetProfileName): Promise<BudgetProfileChangeResult> =>
  postAPI('/budget/profile', { profile });

export const getApprovalQueue = (): Promise<ApprovalQueueResponse> =>
  fetchAPI('/approval-queue');

export const approveItem = (id: string, note?: string): Promise<{ success: boolean; id: string }> =>
  postAPI(`/approval-queue/${id}/approve`, { note });

export const rejectItem = (id: string, reason: string): Promise<{ success: boolean; id: string }> =>
  postAPI(`/approval-queue/${id}/reject`, { reason });

// Billing Cycle Endpoints
export interface BillingCycleStatus {
  daysElapsed: number;
  daysRemaining: number;
  percentComplete: number;
  totalSpent: number;
  remaining: number;
  dailyAverage: number;
  projectedTotal: number;
  onTrack: boolean;
  status: 'under_budget' | 'on_track' | 'at_risk' | 'over_budget';
  recommendation: string;
  recommended?: {
    dailyBudget: number;
    confidence: number;
    reason: string;
  };
  cycle?: {
    totalBudget: number;
  };
}

export const getBillingCycle = (): Promise<BillingCycleStatus> =>
  fetchAPI('/billing/cycle');

export const startNewBillingCycle = (): Promise<{ success: boolean }> =>
  postAPI('/billing/new-cycle', {});

// Value Analytics Endpoints
export interface ValueMetrics {
  morningBriefDelivered?: boolean;
  eveningSummaryDelivered?: boolean;
  testsGenerated?: number;
  docsWritten?: number;
  bugsFixed?: number;
  codeImprovements?: number;
  initiativesExecuted?: number;
  highValueInsights?: number;
  patternsLearned?: number;
  tasksAttempted?: number;
  tasksSucceeded?: number;
  errorsEncountered?: number;
}

export interface DayValueAnalysis {
  date: string;
  cost: number;
  tokens: number;
  metrics: ValueMetrics;
  deliverablesScore: number;
  improvementsScore: number;
  insightsScore: number;
  efficiencyScore: number;
  totalValueScore: number;
  costPerPoint: number;
  roi: number;
  efficiency: 'excellent' | 'good' | 'moderate' | 'poor' | 'wasteful';
  breakdown: string[];
}

export interface ValueAnalyticsSummary {
  days: DayValueAnalysis[];
  totalCost: number;
  totalValuePoints: number;
  averageValueScore: number;
  averageCostPerPoint: number;
  bestDay: { date: string; score: number } | null;
  worstDay: { date: string; score: number } | null;
  weeklyTrend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
}

export interface TodayValueProgress {
  metrics: ValueMetrics;
  currentScore: number;
  breakdown: string[];
}

export interface WeeklyValueReport {
  weekStart: string;
  weekEnd: string;
  totalCost: number;
  totalValuePoints: number;
  averageScore: number;
  bestDay: DayValueAnalysis | null;
  worstDay: DayValueAnalysis | null;
  trend: string;
  recommendations: string[];
  costBreakdown: Array<{ category: string; cost: number; percentage: number }>;
}

export const getValueAnalytics = (): Promise<ValueAnalyticsSummary> =>
  fetchAPI('/analytics/value');

export const getValueDaily = (days?: number): Promise<DayValueAnalysis[]> =>
  fetchAPI(`/analytics/value/daily${days ? `?days=${days}` : ''}`);

export const getValueToday = (): Promise<TodayValueProgress> =>
  fetchAPI('/analytics/value/today');

export const getValueWeekly = (): Promise<WeeklyValueReport> =>
  fetchAPI('/analytics/value/weekly');

// Adaptive Learning Endpoints
export interface UsagePattern {
  id: string;
  patternType: string;
  observations: number;
  confidence: number;
  lastObserved: string;
  data: Record<string, unknown>;
  appliedCount: number;
  successCount: number;
  failureCount: number;
}

export interface AdaptiveRecommendation {
  id: string;
  type: string;
  recommendation: string;
  confidence: number;
  appliedAt?: string;
  result?: 'success' | 'failure' | 'pending';
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  peakHours: number[];
  avgDailySpend: number;
  avgDailyValue: number;
  preferredModels: Record<string, string>;
  approvedInitiativeTypes: string[];
  rejectedInitiativeTypes: string[];
  adjustmentsMade: string[];
}

export const getAdaptivePatterns = (): Promise<UsagePattern[]> =>
  fetchAPI('/adaptive/patterns');

export const getAdaptiveRecommendations = (): Promise<AdaptiveRecommendation[]> =>
  fetchAPI('/adaptive/recommendations');

export const getAdaptiveSummaries = (): Promise<WeeklySummary[]> =>
  fetchAPI('/adaptive/summaries');

export const getAdaptivePeakHours = (): Promise<{ hours: number[] }> =>
  fetchAPI('/adaptive/peak-hours');

// E2E Testing Endpoints
export interface E2ERunsResponse {
  runs: Array<{
    id: string;
    status: 'passed' | 'failed' | 'running';
    startedAt: string;
    completedAt: string | null;
    duration: number | null;
    scenarios: Array<{
      id: string;
      name: string;
      status: 'passed' | 'failed' | 'running';
      duration: number;
      error?: string;
    }>;
    passed: number;
    failed: number;
    total: number;
  }>;
  stats: {
    totalRuns: number;
    passRate: number;
    lastRun: string | null;
    consecutiveFailures: number;
  };
}

export const getE2ERuns = (): Promise<E2ERunsResponse> =>
  fetchAPI('/e2e/runs');

// Export fetchAPI for direct use if needed
export { fetchAPI };

// WebSocket Connection
export function connectWebSocket(
  onMessage: (event: MessageEvent) => void,
  onError?: (event: Event) => void,
): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

  ws.onmessage = onMessage;
  if (onError) {
    ws.onerror = onError;
  }

  return ws;
}
