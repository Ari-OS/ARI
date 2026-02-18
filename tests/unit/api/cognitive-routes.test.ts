import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { cognitiveRoutes } from '../../../src/api/routes/cognitive.js';
import type { ApiDependencies } from '../../../src/api/routes/shared.js';

// Mock CognitionLayer with realistic return values
function createMockCognitionLayer() {
  const now = new Date('2025-01-15T12:00:00Z');

  return {
    getHealth: vi.fn().mockResolvedValue({
      overall: 0.87,
      overallLevel: 'GOOD',
      pillars: [
        {
          pillar: 'LOGOS',
          health: 0.92,
          healthLevel: 'EXCELLENT',
          apisActive: 3,
          apisTotal: 6,
          lastActivity: now,
          topFramework: 'Bayesian Reasoning',
          frameworkUsage: [],
          recentErrors: 0,
          avgResponseTime: 12,
        },
        {
          pillar: 'ETHOS',
          health: 0.85,
          healthLevel: 'GOOD',
          apisActive: 2,
          apisTotal: 4,
          lastActivity: now,
          topFramework: 'Bias Detection',
          frameworkUsage: [],
          recentErrors: 0,
          avgResponseTime: 8,
        },
        {
          pillar: 'PATHOS',
          health: 0.84,
          healthLevel: 'GOOD',
          apisActive: 2,
          apisTotal: 5,
          lastActivity: now,
          topFramework: 'CBT Reframing',
          frameworkUsage: [],
          recentErrors: 0,
          avgResponseTime: 15,
        },
      ],
      learningLoopActive: true,
      learningLoopStage: 'PERFORMANCE_REVIEW',
      knowledgeSources: 35,
      knowledgeSourcesActive: 35,
      councilProfilesLoaded: 15,
      lastUpdated: now,
    }),
    getPillarInfo: vi.fn().mockImplementation((pillar: string) => {
      const info: Record<string, { name: string; icon: string; frameworks: string[] }> = {
        LOGOS: { name: 'Reason', icon: '🧠', frameworks: ['Bayesian Reasoning', 'Expected Value'] },
        ETHOS: { name: 'Character', icon: '❤️', frameworks: ['Bias Detection'] },
        PATHOS: { name: 'Growth', icon: '🌱', frameworks: ['CBT Reframing'] },
      };
      return info[pillar] ?? info.LOGOS;
    }),
    getSourceManager: vi.fn().mockReturnValue({
      getSources: vi.fn().mockReturnValue([
        { id: 'src-1', name: 'Source 1', pillar: 'LOGOS', trustLevel: 'verified', category: 'book', frameworks: ['Bayesian'] },
        { id: 'src-2', name: 'Source 2', pillar: 'ETHOS', trustLevel: 'standard', category: 'paper', frameworks: ['Bias Detection'] },
      ]),
      getSourcesByPillar: vi.fn().mockImplementation((pillar: string) => {
        const counts: Record<string, number> = { LOGOS: 12, ETHOS: 10, PATHOS: 8 };
        return Array(counts[pillar] ?? 0).fill({});
      }),
      getSourceStats: vi.fn().mockReturnValue({
        total: 35,
        enabled: 35,
        disabled: 0,
        byPillar: { LOGOS: 12, ETHOS: 10, PATHOS: 8, CROSS_CUTTING: 5 },
        byCategory: { book: 15, paper: 10, website: 10 },
        byPriority: { HIGH: 10, MEDIUM: 15, LOW: 10 },
        byTrustLevel: { verified: 20, standard: 15 },
      }),
    }),
    getLearningProgress: vi.fn().mockResolvedValue({
      currentStage: 'PERFORMANCE_REVIEW',
      stageProgress: 0,
      lastReview: now,
      lastGapAnalysis: now,
      lastAssessment: now,
      nextReview: new Date(now.getTime() + 86400000),
      nextGapAnalysis: new Date(now.getTime() + 7 * 86400000),
      nextAssessment: new Date(now.getTime() + 30 * 86400000),
      recentInsights: [
        {
          id: 'insight-1',
          type: 'PATTERN',
          description: 'Bayesian reasoning improves decision quality',
          evidence: ['data point 1'],
          actionable: 'Use more Bayesian reasoning',
          confidence: 0.85,
          generalizes: true,
          priority: 'HIGH',
          framework: 'Bayesian Reasoning',
          timestamp: now,
        },
      ],
      recentInsightsCount: 1,
      improvementTrend: 'IMPROVING',
      currentGrade: 'B',
      streakDays: 5,
    }),
    getLearningStatus: vi.fn().mockReturnValue({
      lastDailyReview: null,
      lastWeeklyAnalysis: null,
      lastMonthlyAssessment: null,
      reviewCount: 3,
      gapAnalysisCount: 1,
      assessmentCount: 0,
    }),
    getMetrics: vi.fn().mockReturnValue({
      getFrameworkMetrics: vi.fn().mockReturnValue({
        usageCount: 5,
        errorCount: 1,
        totalResponseTime: 100,
        lastUsed: now,
      }),
    }),
  };
}

describe('Cognitive Routes', () => {
  let fastify: FastifyInstance;
  let mockCognition: ReturnType<typeof createMockCognitionLayer>;

  beforeEach(async () => {
    fastify = Fastify();
    mockCognition = createMockCognitionLayer();
  });

  async function registerWithCognition() {
    const deps = {
      audit: { log: vi.fn().mockResolvedValue(undefined) } as unknown as ApiDependencies['audit'],
      eventBus: {} as ApiDependencies['eventBus'],
      cognitionLayer: mockCognition as unknown as ApiDependencies['cognitionLayer'],
    } satisfies Partial<ApiDependencies> as ApiDependencies;
    await fastify.register(cognitiveRoutes, { deps });
  }

  async function registerWithoutCognition() {
    const deps = {
      audit: { log: vi.fn().mockResolvedValue(undefined) } as unknown as ApiDependencies['audit'],
      eventBus: {} as ApiDependencies['eventBus'],
    } as ApiDependencies;
    await fastify.register(cognitiveRoutes, { deps });
  }

  // ── Health Endpoint ────────────────────────────────────────────────────

  describe('GET /api/cognition/health', () => {
    it('should return cognitive health with pillar data', async () => {
      await registerWithCognition();
      const res = await fastify.inject({ method: 'GET', url: '/api/cognition/health' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.overall).toBe(0.87);
      expect(body.pillars).toHaveLength(3);
      expect(body.pillars[0].pillar).toBe('LOGOS');
      expect(body.pillars[0].lastActivity).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(body.pillars[0].sourcesCount).toBe(12);
      expect(body.learningLoopActive).toBe(true);
      expect(body.knowledgeSources).toBe(35);
    });

    it('should return 503 when cognition layer not initialized', async () => {
      await registerWithoutCognition();
      const res = await fastify.inject({ method: 'GET', url: '/api/cognition/health' });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.error).toBeDefined();
    });
  });

  // ── Pillars Endpoint ───────────────────────────────────────────────────

  describe('GET /api/cognition/pillars', () => {
    it('should return 3 pillar entries with descriptions', async () => {
      await registerWithCognition();
      const res = await fastify.inject({ method: 'GET', url: '/api/cognition/pillars' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(3);
      expect(body[0].pillar).toBe('LOGOS');
      expect(body[0].name).toBe('Reason');
      expect(body[0].icon).toBe('🧠');
      expect(body[0].description).toContain('decision-making');
      expect(body[0].apis).toBeInstanceOf(Array);
      expect(body[0].sourcesCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Sources Endpoint ───────────────────────────────────────────────────

  describe('GET /api/cognition/sources', () => {
    it('should return sources with trust level breakdown', async () => {
      await registerWithCognition();
      const res = await fastify.inject({ method: 'GET', url: '/api/cognition/sources' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.total).toBe(35);
      expect(body.byTrustLevel.verified).toBe(20);
      expect(body.byTrustLevel.standard).toBe(15);
      expect(body.sources).toHaveLength(2);
      expect(body.sources[0]).toHaveProperty('id');
      expect(body.sources[0]).toHaveProperty('name');
      expect(body.sources[0]).toHaveProperty('pillar');
      expect(body.sources[0]).toHaveProperty('frameworks');
    });
  });

  // ── Council Profiles Endpoints ─────────────────────────────────────────

  describe('GET /api/cognition/council-profiles', () => {
    it('should return all 15 council profiles', async () => {
      await registerWithCognition();
      const res = await fastify.inject({ method: 'GET', url: '/api/cognition/council-profiles' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(15);
      expect(body[0]).toHaveProperty('memberId');
      expect(body[0]).toHaveProperty('memberName');
      expect(body[0]).toHaveProperty('primaryPillar');
      expect(body[0]).toHaveProperty('pillarWeights');
    });
  });

  describe('GET /api/cognition/council-profiles/:memberId', () => {
    it('should return a specific profile by memberId', async () => {
      await registerWithCognition();
      const res = await fastify.inject({ method: 'GET', url: '/api/cognition/council-profiles/router' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.memberId).toBe('router');
      expect(body.memberName).toBe('ATLAS');
    });

    it('should return 404 for unknown memberId', async () => {
      await registerWithCognition();
      const res = await fastify.inject({ method: 'GET', url: '/api/cognition/council-profiles/nonexistent' });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('nonexistent');
    });
  });

  // ── Learning Status ────────────────────────────────────────────────────

  describe('GET /api/cognition/learning/status', () => {
    it('should return learning status with ISO date strings', async () => {
      await registerWithCognition();
      const res = await fastify.inject({ method: 'GET', url: '/api/cognition/learning/status' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.currentStage).toBe('PERFORMANCE_REVIEW');
      expect(body.lastReview).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(body.nextReview).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(body.recentInsightsCount).toBe(1);
      expect(body.improvementTrend).toBe('improving');
    });
  });

  // ── Learning Analytics ─────────────────────────────────────────────────

  describe('GET /api/cognition/learning/analytics', () => {
    it('should return analytics with period and metrics', async () => {
      await registerWithCognition();
      const res = await fastify.inject({ method: 'GET', url: '/api/cognition/learning/analytics' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.period).toHaveProperty('start');
      expect(body.period).toHaveProperty('end');
      expect(body.retentionMetrics).toHaveProperty('reviews');
      expect(body.retentionMetrics.reviews).toBe(3);
      expect(body.practiceQuality).toHaveProperty('deliberateHours');
      expect(body.insights).toBeInstanceOf(Array);
    });

    it('should accept days query parameter', async () => {
      await registerWithCognition();
      const res = await fastify.inject({ method: 'GET', url: '/api/cognition/learning/analytics?days=7' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const start = new Date(body.period.start);
      const end = new Date(body.period.end);
      const diffDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeCloseTo(7, 0);
    });
  });

  // ── Calibration ────────────────────────────────────────────────────────

  describe('GET /api/cognition/learning/calibration', () => {
    it('should return empty calibration report', async () => {
      await registerWithCognition();
      const res = await fastify.inject({ method: 'GET', url: '/api/cognition/learning/calibration' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.overconfidenceBias).toBe(0);
      expect(body.underconfidenceBias).toBe(0);
      expect(body.calibrationCurve).toHaveLength(5);
      expect(body.predictions).toHaveLength(0);
    });
  });

  // ── Frameworks Usage ───────────────────────────────────────────────────

  describe('GET /api/cognition/frameworks/usage', () => {
    it('should return usage for each framework', async () => {
      await registerWithCognition();
      const res = await fastify.inject({ method: 'GET', url: '/api/cognition/frameworks/usage' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toBeInstanceOf(Array);
      expect(body.length).toBeGreaterThan(0);
      expect(body[0]).toHaveProperty('framework');
      expect(body[0]).toHaveProperty('pillar');
      expect(body[0]).toHaveProperty('usageCount');
      expect(body[0]).toHaveProperty('successRate');
    });
  });

  // ── Insights ───────────────────────────────────────────────────────────

  describe('GET /api/cognition/insights', () => {
    it('should return insights with ISO timestamps', async () => {
      await registerWithCognition();
      const res = await fastify.inject({ method: 'GET', url: '/api/cognition/insights' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('insight-1');
      expect(body[0].type).toBe('PATTERN');
      expect(body[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(body[0].framework).toBe('Bayesian Reasoning');
    });

    it('should respect limit parameter', async () => {
      await registerWithCognition();
      const res = await fastify.inject({ method: 'GET', url: '/api/cognition/insights?limit=0' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(0);
    });
  });

  // ── Calibration POST Endpoints ─────────────────────────────────────────

  describe('POST /api/cognition/learning/calibration/predictions', () => {
    it('should create a prediction and return an id', async () => {
      await registerWithCognition();
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/cognition/learning/calibration/predictions',
        payload: { statement: 'It will rain tomorrow', confidence: 0.7 },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(typeof body.id).toBe('string');
    });

    it('should reject invalid body', async () => {
      await registerWithCognition();
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/cognition/learning/calibration/predictions',
        payload: { statement: '', confidence: 2 },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Invalid request body');
    });
  });

  describe('POST /api/cognition/learning/calibration/predictions/:id/outcome', () => {
    it('should resolve a prediction', async () => {
      await registerWithCognition();

      // First create a prediction
      const createRes = await fastify.inject({
        method: 'POST',
        url: '/api/cognition/learning/calibration/predictions',
        payload: { statement: 'Test prediction', confidence: 0.8 },
      });
      const { id } = JSON.parse(createRes.body);

      // Now resolve it
      const res = await fastify.inject({
        method: 'POST',
        url: `/api/cognition/learning/calibration/predictions/${id}/outcome`,
        payload: { outcome: true },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
    });

    it('should return 404 for unknown prediction', async () => {
      await registerWithCognition();
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/cognition/learning/calibration/predictions/nonexistent-id/outcome',
        payload: { outcome: false },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should reject invalid body', async () => {
      await registerWithCognition();
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/cognition/learning/calibration/predictions/some-id/outcome',
        payload: { outcome: 'not-boolean' },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
