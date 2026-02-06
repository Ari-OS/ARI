/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Cognitive Layer 0 endpoints
 * LOGOS/ETHOS/PATHOS cognitive frameworks
 *
 * TODO: Move these endpoints from routes.ts:
 * - GET /api/cognition/health
 * - GET /api/cognition/pillars
 * - GET /api/cognition/metrics
 * - GET /api/cognition/sources
 * - GET /api/cognition/council-profiles
 * - GET /api/cognition/council-profiles/:memberId
 * - GET /api/cognition/learning/status
 * - GET /api/cognition/learning/analytics
 * - GET /api/cognition/learning/calibration
 * - POST /api/cognition/learning/calibration/predictions
 * - POST /api/cognition/learning/calibration/predictions/:id/outcome
 * - GET /api/cognition/frameworks/usage
 * - GET /api/cognition/insights
 * - POST /api/cognition/logos/bayesian
 * - POST /api/cognition/logos/expected-value
 * - POST /api/cognition/logos/kelly
 * - POST /api/cognition/ethos/bias-detection
 * - POST /api/cognition/ethos/emotional-state
 * - POST /api/cognition/ethos/discipline-check
 * - POST /api/cognition/pathos/reframe
 * - POST /api/cognition/pathos/dichotomy
 * - GET /api/cognition/pathos/wisdom
 * - POST /api/cognition/pathos/practice-plan
 * - POST /api/cognition/insights
 * - POST /api/cognition/analyze
 */
export const cognitiveRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  // Placeholder - endpoints to be migrated from routes.ts (lines 1137-1891)
  // For now, routes.ts still handles these endpoints
};
