import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './routes/shared.js';

// Import all route modules
import { dashboardRoutes } from './routes/dashboard.js';
import { healthRoutes } from './routes/health.js';
import { agentRoutes } from './routes/agents.js';
import { governanceRoutes } from './routes/governance.js';
import { memoryRoutes } from './routes/memory.js';
import { auditRoutes } from './routes/audit.js';
import { schedulerRoutes } from './routes/scheduler.js';
import { subagentRoutes } from './routes/subagents.js';
import { metricsRoutes } from './routes/metrics.js';
import { alertRoutes } from './routes/alerts.js';
import { cognitiveRoutes } from './routes/cognitive.js';
import { budgetRoutes } from './routes/budget.js';
import { approvalQueueRoutes } from './routes/approval-queue.js';
import { analyticsRoutes } from './routes/analytics.js';
import { autonomousRoutes } from './routes/autonomous.js';

// Re-export types from shared
export type { ApiDependencies, ApiRouteOptions } from './routes/shared.js';

/**
 * REST API routes plugin for ARI
 * Registers all modular route handlers
 */
export const apiRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  // Dashboard (static files, fallback HTML) - must be first for / route
  await fastify.register(dashboardRoutes, options);

  // Health checks
  await fastify.register(healthRoutes, options);

  // Agent management
  await fastify.register(agentRoutes, options);

  // Governance (council, proposals, rules, gates)
  await fastify.register(governanceRoutes, options);

  // Memory system
  await fastify.register(memoryRoutes, options);

  // Audit trail
  await fastify.register(auditRoutes, options);

  // Scheduler
  await fastify.register(schedulerRoutes, options);

  // Subagents
  await fastify.register(subagentRoutes, options);

  // Observability: Metrics
  await fastify.register(metricsRoutes, options);

  // Observability: Alerts
  await fastify.register(alertRoutes, options);

  // Cognitive Layer 0
  await fastify.register(cognitiveRoutes, options);

  // Budget & Cost tracking
  await fastify.register(budgetRoutes, options);

  // Approval queue
  await fastify.register(approvalQueueRoutes, options);

  // Analytics, billing, adaptive learning
  await fastify.register(analyticsRoutes, options);

  // Autonomous agent & E2E runner
  await fastify.register(autonomousRoutes, options);
};
