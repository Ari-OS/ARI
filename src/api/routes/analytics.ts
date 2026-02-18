/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Analytics endpoints — value analytics, adaptive learning, billing
 */
export const analyticsRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  // ── Value Analytics ──────────────────────────────────────────────────────

  fastify.get('/api/analytics/value', async () => {
    if (!deps.valueAnalytics) {
      return { error: 'Value analytics not initialized' };
    }
    return deps.valueAnalytics.getSummary();
  });

  fastify.get('/api/analytics/value/weekly', async () => {
    if (!deps.valueAnalytics) {
      return { error: 'Value analytics not initialized' };
    }
    return deps.valueAnalytics.getWeeklyReport();
  });

  // ── Adaptive Learning ────────────────────────────────────────────────────

  fastify.get('/api/adaptive/patterns', async () => {
    if (!deps.adaptiveLearner) {
      return { error: 'Adaptive learner not initialized' };
    }
    return deps.adaptiveLearner.getPatterns();
  });

  fastify.get('/api/adaptive/recommendations', async () => {
    if (!deps.adaptiveLearner) {
      return { error: 'Adaptive learner not initialized' };
    }
    return deps.adaptiveLearner.getRecommendations();
  });

  fastify.get('/api/adaptive/summary', async () => {
    if (!deps.adaptiveLearner) {
      return { error: 'Adaptive learner not initialized' };
    }
    return deps.adaptiveLearner.getSummary();
  });

  // ── Billing Cycle ────────────────────────────────────────────────────────

  fastify.get('/api/billing/cycle', async () => {
    if (!deps.billingCycleManager) {
      return { error: 'Billing cycle manager not initialized' };
    }
    return deps.billingCycleManager.getCycleStatus();
  });

  fastify.post('/api/billing/new-cycle', async (_request, reply) => {
    if (!deps.billingCycleManager) {
      reply.code(503);
      return { error: 'Billing cycle manager not initialized' };
    }

    await deps.billingCycleManager.startNewCycle();
    await deps.audit.log('billing:new_cycle_started', 'API', 'operator', {
      startedAt: new Date().toISOString(),
    });
    return { success: true };
  });
};
