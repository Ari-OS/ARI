/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './routes/shared.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import type { AlertStatus, AlertSeverity } from '../observability/types.js';
import { ProfileChangeSchema, ApproveItemSchema, RejectItemSchema } from './routes/shared.js';

// Import all completed route modules
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
  const { deps } = options;

  // Register all completed route modules
  // Each module is a Fastify plugin that registers its own routes

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

  // Budget endpoints (placeholder)
  fastify.get('/api/budget/status', async () => {
    if (!deps.costTracker) {
      return { error: 'Cost tracker not initialized' };
    }

    const status = deps.costTracker.getThrottleStatus();
    const usage = deps.costTracker.getTokenUsage();
    const profile = deps.costTracker.getProfile();

    return {
      profile: profile?.profile ?? 'unknown',
      budget: {
        maxTokens: profile?.budget?.daily?.maxTokens ?? 800000,
        maxCost: profile?.budget?.daily?.maxCost ?? 2.50,
      },
      usage: {
        tokensUsed: usage.totalTokens,
        tokensRemaining: status.tokensRemaining,
        costUsed: usage.totalCost,
        percentUsed: status.usagePercent,
      },
      throttle: {
        level: status.level,
        projectedEOD: status.projectedEOD,
      },
      breakdown: {
        byModel: usage.byModel,
        byTaskType: Object.entries(usage.byTaskType)
          .sort((a, b) => b[1].cost - a[1].cost)
          .slice(0, 10)
          .map(([taskType, data]) => ({
            taskType,
            tokens: data.tokens,
            cost: data.cost,
            count: data.count,
            percentOfTotal: usage.totalTokens > 0
              ? (data.tokens / usage.totalTokens) * 100
              : 0,
          })),
      },
      resetAt: usage.resetAt,
      date: usage.date,
    };
  });

  fastify.get<{ Querystring: { days?: string } }>(
    '/api/budget/history',
    async (request) => {
      const days = request.query.days ? parseInt(request.query.days, 10) : 30;

      try {
        const historyDir = path.join(process.env.HOME || homedir(), '.ari', 'budget-history');

        // Ensure directory exists
        try {
          await fs.mkdir(historyDir, { recursive: true });
        } catch {
          // Directory might already exist
        }

        // Read historical daily summaries
        const history: Array<{
          date: string;
          totalCost: number;
          totalTokens: number;
          requestCount: number;
          modelBreakdown: Record<string, { cost: number; tokens: number; requests: number }>;
        }> = [];

        const now = new Date();
        for (let i = 0; i < days; i++) {
          const checkDate = new Date(now);
          checkDate.setDate(checkDate.getDate() - i);
          const dateStr = checkDate.toISOString().split('T')[0];
          const filePath = path.join(historyDir, `${dateStr}.json`);

          try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const dayData = JSON.parse(fileContent);
            history.push(dayData);
          } catch {
            // File doesn't exist for this day, skip
          }
        }

        // Calculate trend analysis
        const totalCost = history.reduce((sum, day) => sum + day.totalCost, 0);
        const avgDailyCost = history.length > 0 ? totalCost / history.length : 0;

        // Compare recent half vs older half for trend
        const midpoint = Math.floor(history.length / 2);
        const recentAvg = history.slice(0, midpoint).reduce((sum, day) => sum + day.totalCost, 0) / Math.max(1, midpoint);
        const olderAvg = history.slice(midpoint).reduce((sum, day) => sum + day.totalCost, 0) / Math.max(1, history.length - midpoint);

        const trend = recentAvg > olderAvg * 1.1 ? 'increasing' : recentAvg < olderAvg * 0.9 ? 'decreasing' : 'stable';

        return {
          history: history.reverse(), // Chronological order
          days,
          summary: {
            totalCost,
            avgDailyCost,
            totalDays: history.length,
            trend,
          },
        };
      } catch (error) {
        // Fallback to current day only
        const usage = deps.costTracker?.getTokenUsage();
        return {
          history: usage ? [usage] : [],
          days,
          error: 'Failed to load historical data',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  fastify.post<{ Body: unknown }>(
    '/api/budget/profile',
    async (request, reply) => {
      // Validate request body with Zod (ADR-006 compliance)
      const parsed = ProfileChangeSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return {
          error: 'Invalid request body',
          details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
        };
      }

      const { profile } = parsed.data;

      if (!deps.costTracker) {
        reply.code(503);
        return { error: 'Cost tracker not initialized' };
      }

      const profilePath = path.join(process.cwd(), 'config', `budget.${profile}.json`);

      // Step 1: Read file
      let fileContent: string;
      try {
        fileContent = await fs.readFile(profilePath, 'utf-8');
      } catch (error) {
        reply.code(404);
        return {
          error: `Profile file not found: budget.${profile}.json`,
          details: error instanceof Error ? error.message : String(error),
        };
      }

      // Step 2: Parse JSON
      let profileData: unknown;
      try {
        profileData = JSON.parse(fileContent);
      } catch (error) {
        reply.code(400);
        return {
          error: `Invalid JSON in profile file: budget.${profile}.json`,
          details: error instanceof Error ? error.message : String(error),
        };
      }

      // Step 3: Apply profile (cost-tracker validates internally)
      try {
        const previousProfile = deps.costTracker.getProfile()?.profile;
        await deps.costTracker.setProfile(profileData as import('../observability/cost-tracker.js').BudgetProfile);

        await deps.audit.log(
          'budget:profile_changed',
          'API',
          'operator',
          { profile, previousProfile }
        );

        return { success: true, profile };
      } catch (error) {
        reply.code(500);
        return {
          error: 'Failed to apply profile',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // Additional placeholder routes for remaining endpoints
  // Full implementation requires migrating remaining code from routes.ts.backup

  // Approval queue endpoints (placeholder)
  fastify.get('/api/approval-queue', async () => {
    if (!deps.approvalQueue) {
      return { pending: [], history: [], stats: null };
    }

    return {
      pending: deps.approvalQueue.getPending(),
      history: deps.approvalQueue.getHistory(20),
      stats: deps.approvalQueue.getStats(),
    };
  });

  // Analytics endpoints (placeholder)
  fastify.get('/api/analytics/value', async () => {
    if (!deps.valueAnalytics) {
      return { error: 'Value analytics not initialized' };
    }

    return deps.valueAnalytics.getSummary();
  });

  // E2E endpoints (placeholder)
  fastify.get('/api/e2e/status', async () => {
    if (!deps.e2eRunner) {
      return {
        isRunning: false,
        lastRunId: null,
        consecutiveFailures: 0,
        initialized: false,
      };
    }

    const history = deps.e2eRunner.getRunHistory();

    return {
      isRunning: deps.e2eRunner.isCurrentlyRunning(),
      lastRunId: history[0]?.id ?? null,
      consecutiveFailures: deps.e2eRunner.getConsecutiveFailures(),
      initialized: true,
    };
  });

  // NOTE: The original routes.ts has ~1700 lines of endpoint definitions that still
  // need to be migrated to the module files. This refactored version demonstrates
  // the structure and includes critical endpoints. The full migration is in progress.
  //
  // To complete the migration:
  // 1. Copy endpoint code from routes.ts.backup to the appropriate module files
  // 2. Update imports in each module file
  // 3. Test each module independently
  // 4. Remove the inline implementations from this file
  // 5. Register the completed modules at the top of this function
};
