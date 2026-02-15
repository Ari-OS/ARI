/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';
import { ProfileChangeSchema } from './shared.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import type { BudgetProfile } from '../../observability/cost-tracker.js';

/**
 * Budget endpoints — cost tracking, profiles, and history
 */
export const budgetRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

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

        try {
          await fs.mkdir(historyDir, { recursive: true });
        } catch {
          // Directory might already exist
        }

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
            const dayData = JSON.parse(fileContent) as {
              date: string;
              totalCost: number;
              totalTokens: number;
              requestCount: number;
              modelBreakdown: Record<string, { cost: number; tokens: number; requests: number }>;
            };
            history.push(dayData);
          } catch {
            // File doesn't exist for this day
          }
        }

        const totalCost = history.reduce((sum, day) => sum + day.totalCost, 0);
        const avgDailyCost = history.length > 0 ? totalCost / history.length : 0;

        const midpoint = Math.floor(history.length / 2);
        const recentAvg = history.slice(0, midpoint).reduce((sum, day) => sum + day.totalCost, 0) / Math.max(1, midpoint);
        const olderAvg = history.slice(midpoint).reduce((sum, day) => sum + day.totalCost, 0) / Math.max(1, history.length - midpoint);

        const trend = recentAvg > olderAvg * 1.1 ? 'increasing' : recentAvg < olderAvg * 0.9 ? 'decreasing' : 'stable';

        return {
          history: history.reverse(),
          days,
          summary: {
            totalCost,
            avgDailyCost,
            totalDays: history.length,
            trend,
          },
        };
      } catch (error) {
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

      try {
        const previousProfile = deps.costTracker.getProfile()?.profile;
        await deps.costTracker.setProfile(profileData as BudgetProfile);

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
};
