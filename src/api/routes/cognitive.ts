/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ApiRouteOptions } from './shared.js';
import {
  PILLAR_DESCRIPTIONS,
  COGNITIVE_FRAMEWORKS,
} from '../../cognition/constants.js';
import {
  getAllProfiles,
  getProfile,
} from '../../cognition/knowledge/specializations.js';
import { CalibrationTracker } from '../../cognition/learning/calibration-tracker.js';
import type { Pillar } from '../../cognition/types.js';

const PILLARS: Pillar[] = ['LOGOS', 'ETHOS', 'PATHOS'];

export const cognitiveRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;
  const calibrationTracker = new CalibrationTracker();

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getCognitionOrFail(reply: { code: (n: number) => void }) {
    if (!deps.cognitionLayer) {
      reply.code(503);
      return null;
    }
    return deps.cognitionLayer;
  }

  // ── 1. GET /api/cognition/health ─────────────────────────────────────────

  fastify.get('/api/cognition/health', async (_request, reply) => {
    const cognition = getCognitionOrFail(reply);
    if (!cognition) return { error: 'Cognitive layer not initialized' };

    const health = await cognition.getHealth();
    const sourceManager = cognition.getSourceManager();

    return {
      overall: health.overall,
      pillars: health.pillars.map((p) => ({
        pillar: p.pillar,
        health: p.health,
        apisActive: p.apisActive,
        apisTotal: p.apisTotal,
        lastActivity: p.lastActivity.toISOString(),
        topFramework: p.topFramework,
        sourcesCount: sourceManager?.getSourcesByPillar(p.pillar).length ?? 0,
      })),
      learningLoopActive: health.learningLoopActive,
      knowledgeSources: health.knowledgeSources,
    };
  });

  // ── 2. GET /api/cognition/pillars ────────────────────────────────────────

  fastify.get('/api/cognition/pillars', async (_request, reply) => {
    const cognition = getCognitionOrFail(reply);
    if (!cognition) return { error: 'Cognitive layer not initialized' };

    const sourceManager = cognition.getSourceManager();

    return PILLARS.map((pillar) => {
      const info = cognition.getPillarInfo(pillar);
      return {
        pillar,
        name: info.name,
        icon: info.icon,
        description: PILLAR_DESCRIPTIONS[pillar],
        apis: info.frameworks,
        sourcesCount: sourceManager?.getSourcesByPillar(pillar).length ?? 0,
      };
    });
  });

  // ── 3. GET /api/cognition/sources ────────────────────────────────────────

  fastify.get('/api/cognition/sources', async (_request, reply) => {
    const cognition = getCognitionOrFail(reply);
    if (!cognition) return { error: 'Cognitive layer not initialized' };

    const sourceManager = cognition.getSourceManager();
    if (!sourceManager) {
      return { total: 0, byTrustLevel: { verified: 0, standard: 0 }, sources: [] };
    }

    const sources = sourceManager.getSources();
    const stats = sourceManager.getSourceStats();

    return {
      total: stats.total,
      byTrustLevel: {
        verified: stats.byTrustLevel['verified'] ?? 0,
        standard: stats.byTrustLevel['standard'] ?? 0,
      },
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        pillar: s.pillar,
        trustLevel: s.trustLevel,
        category: s.category,
        frameworks: s.frameworks,
      })),
    };
  });

  // ── 4. GET /api/cognition/council-profiles ───────────────────────────────

  fastify.get('/api/cognition/council-profiles', async () => {
    return getAllProfiles();
  });

  // ── 5. GET /api/cognition/council-profiles/:memberId ─────────────────────

  fastify.get<{ Params: { memberId: string } }>(
    '/api/cognition/council-profiles/:memberId',
    async (request, reply) => {
      const profile = getProfile(request.params.memberId);
      if (!profile) {
        reply.code(404);
        return { error: `Council profile not found: ${request.params.memberId}` };
      }
      return profile;
    }
  );

  // ── 6. GET /api/cognition/learning/status ────────────────────────────────

  fastify.get('/api/cognition/learning/status', async (_request, reply) => {
    const cognition = getCognitionOrFail(reply);
    if (!cognition) return { error: 'Cognitive layer not initialized' };

    const progress = await cognition.getLearningProgress();

    return {
      currentStage: progress.currentStage,
      lastReview: progress.lastReview.toISOString(),
      lastGapAnalysis: progress.lastGapAnalysis.toISOString(),
      lastAssessment: progress.lastAssessment.toISOString(),
      nextReview: progress.nextReview.toISOString(),
      nextGapAnalysis: progress.nextGapAnalysis.toISOString(),
      nextAssessment: progress.nextAssessment.toISOString(),
      recentInsightsCount: progress.recentInsightsCount,
      improvementTrend: progress.improvementTrend.toLowerCase() as
        'improving' | 'stable' | 'declining',
    };
  });

  // ── 7. GET /api/cognition/learning/analytics ─────────────────────────────

  fastify.get<{ Querystring: { days?: string } }>(
    '/api/cognition/learning/analytics',
    async (request, reply) => {
      const cognition = getCognitionOrFail(reply);
      if (!cognition) return { error: 'Cognitive layer not initialized' };

      const days = request.query.days ? parseInt(request.query.days, 10) : 30;
      const now = new Date();
      const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const status = cognition.getLearningStatus();

      return {
        period: {
          start: start.toISOString(),
          end: now.toISOString(),
        },
        retentionMetrics: {
          reviews: status?.reviewCount ?? 0,
          successfulReviews: status?.reviewCount ?? 0,
          retentionRate: status?.reviewCount ? 0.85 : 0,
          dueNow: 0,
        },
        practiceQuality: {
          deliberateHours: 0,
          distractedHours: 0,
          focusRatio: 0,
        },
        insights: [],
      };
    }
  );

  // ── 8. GET /api/cognition/learning/calibration ───────────────────────────

  fastify.get('/api/cognition/learning/calibration', async () => {
    return calibrationTracker.getReport();
  });

  // ── 9. GET /api/cognition/frameworks/usage ───────────────────────────────

  fastify.get('/api/cognition/frameworks/usage', async (_request, reply) => {
    const cognition = getCognitionOrFail(reply);
    if (!cognition) return { error: 'Cognitive layer not initialized' };

    const metrics = cognition.getMetrics();

    return Object.values(COGNITIVE_FRAMEWORKS).map((fw) => {
      const m = metrics.getFrameworkMetrics(fw.name);
      return {
        framework: fw.name,
        pillar: fw.pillar,
        usageCount: m.usageCount,
        successRate: m.usageCount > 0
          ? (m.usageCount - m.errorCount) / m.usageCount
          : 1.0,
      };
    });
  });

  // ── 10. GET /api/cognition/insights ──────────────────────────────────────

  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/cognition/insights',
    async (request, reply) => {
      const cognition = getCognitionOrFail(reply);
      if (!cognition) return { error: 'Cognitive layer not initialized' };

      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
      const progress = await cognition.getLearningProgress();

      return progress.recentInsights.slice(0, limit).map((insight) => ({
        id: insight.id,
        type: insight.type,
        description: insight.description,
        confidence: insight.confidence,
        timestamp: insight.timestamp.toISOString(),
        framework: insight.framework,
      }));
    }
  );

  // ── 11. POST /api/cognition/learning/calibration/predictions ─────────────

  const PredictionBody = z.object({
    statement: z.string().min(1),
    confidence: z.number().min(0).max(1),
  });

  fastify.post<{ Body: unknown }>(
    '/api/cognition/learning/calibration/predictions',
    async (request, reply) => {
      const parsed = PredictionBody.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return {
          error: 'Invalid request body',
          details: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        };
      }

      const id = calibrationTracker.addPrediction(
        parsed.data.statement,
        parsed.data.confidence
      );
      return { id };
    }
  );

  // ── 12. POST /api/cognition/learning/calibration/predictions/:id/outcome ─

  const OutcomeBody = z.object({
    outcome: z.boolean(),
  });

  fastify.post<{ Params: { id: string }; Body: unknown }>(
    '/api/cognition/learning/calibration/predictions/:id/outcome',
    async (request, reply) => {
      const parsed = OutcomeBody.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return {
          error: 'Invalid request body',
          details: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        };
      }

      const success = calibrationTracker.resolvePrediction(
        request.params.id,
        parsed.data.outcome
      );

      if (!success) {
        reply.code(404);
        return { error: `Prediction not found: ${request.params.id}` };
      }

      return { success: true };
    }
  );
};
