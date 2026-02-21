// API Response Types for ARI Dashboard
// These types mirror the backend API responses but are defined locally

export type TrustLevel = 'SYSTEM' | 'OPERATOR' | 'VERIFIED' | 'STANDARD' | 'TRUSTED' | 'UNTRUSTED' | 'HOSTILE';
export type MemoryType = 'FACT' | 'TASK' | 'GOAL' | 'INTERACTION';
export type MemoryPartition = 'PUBLIC' | 'PRIVATE' | 'QUARANTINE';
export type AgentType = 'GUARDIAN' | 'PLANNER' | 'EXECUTOR' | 'MEMORY_MANAGER' | 'CORE';
export type ProposalStatus = 'OPEN' | 'PASSED' | 'FAILED' | 'EXPIRED' | 'VETOED';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
}

export interface DetailedHealth {
  gateway: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    port: number;
    host: string;
    connections: number;
  };
  eventBus: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    eventCount: number;
    subscribers: number;
  };
  audit: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    entryCount: number;
    chainValid: boolean;
    lastEntry: string;
  };
  sanitizer: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    patternsLoaded: number;
  };
  agents: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeCount: number;
    agents: Record<string, { status: string; lastActive: string }>;
  };
  governance: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeVotes: number;
    councilMembers: number;
  };
}

export interface Agent {
  id: string;
  type: AgentType;
  status: 'active' | 'idle' | 'stopped';
  lastActive: string;
  tasksCompleted: number;
  errorCount: number;
}

export interface AgentStats {
  agentId: string;
  type: AgentType;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksFailed: number;
  averageTaskDuration: number;
  lastActive: string;
  uptime: number;
}

export interface Proposal {
  id: string;
  type: 'COUNCIL_VOTE' | 'CONSTITUTIONAL_RULING' | 'QUALITY_GATE';
  title: string;
  description: string;
  status: ProposalStatus;
  votes: {
    approve: number;
    reject: number;
    total: number;
  };
  threshold: number;
  createdAt: string;
  expiresAt: string;
  result?: 'APPROVED' | 'REJECTED';
}

export interface ConstitutionalRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  violations: number;
}

export interface QualityGate {
  id: string;
  name: string;
  description: string;
  threshold: number;
  enabled: boolean;
  passCount: number;
  failCount: number;
}

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  partition: MemoryPartition;
  content: string;
  tags: string[];
  timestamp: string;
  trustLevel: TrustLevel;
  source: string;
  confidence?: number;
  provenance: {
    chain: string[];
    verifiedAt: string;
  };
}

export interface AuditEntry {
  id: string;
  action: string;
  agent: string;
  timestamp: string;
  details: Record<string, unknown>;
  previousHash: string;
  hash: string;
}

export interface AuditLogResponse {
  events: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditVerification {
  valid: boolean;
  entryCount: number;
  genesisHash: string;
  lastHash: string;
  brokenAt?: number;
  message: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  trustLevel: TrustLevel;
  permissionTier: 'READ' | 'WRITE' | 'ADMIN';
  enabled: boolean;
  executionCount: number;
  errorCount: number;
  lastUsed?: string;
}

export interface Context {
  id: string;
  name: string;
  type: 'LIFE' | 'VENTURE' | 'SYSTEM';
  active: boolean;
  lastAccessed: string;
  memoryCount: number;
  taskCount: number;
}

export interface WebSocketEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// Scheduler Types
export interface SchedulerStatus {
  running: boolean;
  taskCount: number;
  enabledCount: number;
  nextTask: {
    id: string;
    name: string;
    nextRun: string;
  } | null;
}

export interface ScheduledTask {
  id: string;
  name: string;
  cron: string;
  handler: string;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  metadata?: Record<string, unknown>;
}

// Subagent Types
export type SubagentStatus = 'spawning' | 'running' | 'completed' | 'failed';

export interface Subagent {
  id: string;
  task: string;
  branch: string;
  worktreePath: string;
  status: SubagentStatus;
  createdAt: string;
  completedAt: string | null;
  progress: number | null;
  lastMessage: string | null;
  error: string | null;
  tmuxSession: string | null;
}

export interface SubagentStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
  spawning: number;
}

// System Metrics
export interface SystemMetrics {
  uptime: number;
  uptimeFormatted: string;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
  nodeVersion: string;
  platform: string;
  arch: string;
  pid: number;
}

// Budget Types
export type ThrottleLevel = 'normal' | 'warning' | 'reduce' | 'pause';
export type BudgetProfileName = 'conservative' | 'balanced' | 'aggressive';

export interface BudgetStatus {
  profile: BudgetProfileName;
  budget: {
    maxTokens: number;
    maxCost: number;
  };
  usage: {
    tokensUsed: number;
    tokensRemaining: number;
    costUsed: number;
    percentUsed: number;
  };
  throttle: {
    level: ThrottleLevel;
    projectedEOD: number;
  };
  breakdown: {
    byModel: Record<string, { tokens: number; cost: number }>;
    byTaskType: Array<{
      taskType: string;
      tokens: number;
      cost: number;
      count: number;
      percentOfTotal: number;
    }>;
  };
  resetAt: string;
  date: string;
}

export interface BudgetProfileChangeResult {
  success: boolean;
  profile: BudgetProfileName;
}

export interface ApprovalItem {
  id: string;
  type: 'INITIATIVE' | 'CONFIG_CHANGE' | 'DESTRUCTIVE_OP';
  title: string;
  description: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedCost: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalDecision {
  itemId: string;
  decision: 'APPROVED' | 'REJECTED';
  decidedAt: string;
  note?: string;
  reason?: string;
}

export interface ApprovalQueueResponse {
  pending: ApprovalItem[];
  history: ApprovalDecision[];
}

// E2E Testing Types
export type E2EStatus = 'passed' | 'failed' | 'running';

export interface E2EScenario {
  id: string;
  name: string;
  status: E2EStatus;
  duration: number;
  error?: string;
}

export interface E2ERun {
  id: string;
  status: E2EStatus;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  scenarios: E2EScenario[];
  passed: number;
  failed: number;
  total: number;
}

export interface E2ERunsResponse {
  runs: E2ERun[];
  stats: {
    totalRuns: number;
    passRate: number;
    lastRun: string | null;
    consecutiveFailures: number;
  };
}

export interface E2ELiveRun {
  id: string;
  status: E2EStatus;
  startedAt: string;
  completed: number;
  total: number;
  passed: number;
  failed: number;
  currentScenario: string | null;
}
