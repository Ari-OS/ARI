import type { FastifyPluginOptions } from 'fastify';
import type { AuditLogger } from '../../kernel/audit.js';
import type { EventBus } from '../../kernel/event-bus.js';
import type { Core } from '../../agents/core.js';
import type { Council } from '../../governance/council.js';
import type { Arbiter } from '../../governance/arbiter.js';
import type { Overseer } from '../../governance/overseer.js';
import type { MemoryManager } from '../../agents/memory-manager.js';
import type { Executor } from '../../agents/executor.js';
import type * as Storage from '../../system/storage.js';
import type { Scheduler } from '../../autonomous/scheduler.js';
import type { AgentSpawner } from '../../autonomous/agent-spawner.js';
import type { MetricsCollector } from '../../observability/metrics-collector.js';
import type { AlertManager } from '../../observability/alert-manager.js';
import type { ExecutionHistoryTracker } from '../../observability/execution-history.js';
import type { CostTracker } from '../../observability/cost-tracker.js';
import type { ApprovalQueue } from '../../autonomous/approval-queue.js';
import type { BillingCycleManager } from '../../autonomous/billing-cycle.js';
import type { ValueAnalytics } from '../../observability/value-analytics.js';
import type { AdaptiveLearner } from '../../autonomous/adaptive-learner.js';
import type { BudgetTracker } from '../../autonomous/budget-tracker.js';
import type { E2ERunner } from '../../e2e/runner.js';
import type { AutonomousAgent } from '../../autonomous/agent.js';
import type { CognitionLayer } from '../../cognition/index.js';
import { z } from 'zod';

// ── Type Exports ────────────────────────────────────────────────────────────

export interface ApiDependencies {
  audit: AuditLogger;
  eventBus: EventBus;
  core?: Core;
  council?: Council;
  arbiter?: Arbiter;
  overseer?: Overseer;
  memoryManager?: MemoryManager;
  executor?: Executor;
  storage?: typeof Storage;
  scheduler?: Scheduler;
  agentSpawner?: AgentSpawner;
  metricsCollector?: MetricsCollector;
  alertManager?: AlertManager;
  executionHistory?: ExecutionHistoryTracker;
  costTracker?: CostTracker;
  approvalQueue?: ApprovalQueue;
  billingCycleManager?: BillingCycleManager;
  valueAnalytics?: ValueAnalytics;
  adaptiveLearner?: AdaptiveLearner;
  budgetTracker?: BudgetTracker;
  e2eRunner?: E2ERunner;
  autonomousAgent?: AutonomousAgent;
  cognitionLayer?: CognitionLayer;
}

export interface ApiRouteOptions extends FastifyPluginOptions {
  deps: ApiDependencies;
}

// ── Request Validation Schemas (ADR-006 compliance) ─────────────────────────

export const ProfileChangeSchema = z.object({
  profile: z.enum(['conservative', 'balanced', 'aggressive']),
});

export const ApproveItemSchema = z.object({
  note: z.string().optional(),
  approvedBy: z.string().min(1).optional(),
});

export const RejectItemSchema = z.object({
  reason: z.string().min(1, 'Reason is required for rejection'),
  rejectedBy: z.string().min(1).optional(),
});

// ── Utility Functions ────────────────────────────────────────────────────────

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
