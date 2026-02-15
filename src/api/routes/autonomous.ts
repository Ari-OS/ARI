/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Autonomous system endpoints — E2E runner and autonomous agent status
 */
export const autonomousRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  // ── E2E Runner ───────────────────────────────────────────────────────────

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

  fastify.get('/api/e2e/runs', async () => {
    if (!deps.e2eRunner) {
      return { runs: [] };
    }
    return { runs: deps.e2eRunner.getRunHistory() };
  });

  // ── Autonomous Agent ─────────────────────────────────────────────────────

  fastify.get('/api/autonomous/status', async () => {
    if (!deps.autonomousAgent) {
      return { status: 'not initialized' };
    }
    return deps.autonomousAgent.getStatus();
  });
};
