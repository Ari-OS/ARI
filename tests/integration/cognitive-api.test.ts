/**
 * Integration tests for Cognitive API endpoints.
 *
 * Uses real CognitionLayer (not mocked) with Fastify inject
 * to verify end-to-end response shapes match dashboard expectations.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { cognitiveRoutes } from '../../src/api/routes/cognitive.js';
import { initializeCognition, type CognitionLayer } from '../../src/cognition/index.js';
import { EventBus } from '../../src/kernel/event-bus.js';
import type { ApiDependencies } from '../../src/api/routes/shared.js';

describe('Cognitive API Integration', () => {
  let fastify: FastifyInstance;
  let cognitionLayer: CognitionLayer;
  let eventBus: EventBus;

  beforeAll(async () => {
    eventBus = new EventBus();
    cognitionLayer = await initializeCognition(eventBus);

    fastify = Fastify();
    const deps = {
      audit: {} as ApiDependencies['audit'],
      eventBus,
      cognitionLayer,
    } as ApiDependencies;
    await fastify.register(cognitiveRoutes, { deps });
  });

  afterAll(async () => {
    await cognitionLayer.shutdown();
    await fastify.close();
  });

  // 1. Health endpoint returns real pillar data with sourcesCount
  it('should return real health data with sourcesCount per pillar', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/cognition/health' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.overall).toBeGreaterThan(0);
    expect(body.pillars).toHaveLength(3);

    for (const pillar of body.pillars) {
      expect(['LOGOS', 'ETHOS', 'PATHOS']).toContain(pillar.pillar);
      expect(pillar.health).toBeGreaterThanOrEqual(0);
      expect(pillar.health).toBeLessThanOrEqual(1);
      expect(typeof pillar.sourcesCount).toBe('number');
      expect(typeof pillar.lastActivity).toBe('string');
    }
    expect(body.learningLoopActive).toBe(true);
  });

  // 2. Pillars returns 3 entries with correct names
  it('should return 3 pillar entries with correct names', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/cognition/pillars' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(3);

    const names = body.map((p: { name: string }) => p.name);
    expect(names).toContain('Reason');
    expect(names).toContain('Character');
    expect(names).toContain('Growth');

    for (const pillar of body) {
      expect(pillar.description).toBeTruthy();
      expect(pillar.apis).toBeInstanceOf(Array);
      expect(typeof pillar.sourcesCount).toBe('number');
    }
  });

  // 3. Sources returns real sources with trust level breakdown
  it('should return real knowledge sources', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/cognition/sources' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.total).toBeGreaterThanOrEqual(30);
    expect(typeof body.byTrustLevel.verified).toBe('number');
    expect(typeof body.byTrustLevel.standard).toBe('number');
    expect(body.sources).toBeInstanceOf(Array);
    expect(body.sources.length).toBeGreaterThan(0);

    const source = body.sources[0];
    expect(source).toHaveProperty('id');
    expect(source).toHaveProperty('name');
    expect(source).toHaveProperty('pillar');
    expect(source).toHaveProperty('frameworks');
  });

  // 4. Council profiles returns 15 profiles with required fields
  it('should return 15 council profiles', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/cognition/council-profiles' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(15);

    for (const profile of body) {
      expect(profile).toHaveProperty('memberId');
      expect(profile).toHaveProperty('memberName');
      expect(profile).toHaveProperty('memberAvatar');
      expect(profile).toHaveProperty('primaryPillar');
      expect(profile).toHaveProperty('pillarWeights');
      expect(profile).toHaveProperty('primaryFrameworks');
      expect(profile).toHaveProperty('expertiseAreas');
    }
  });

  // 5. Single council profile returns correct data for known ID
  it('should return correct profile for known memberId', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/cognition/council-profiles/router' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.memberId).toBe('router');
    expect(body.memberName).toBe('ATLAS');
    expect(body.primaryPillar).toBe('LOGOS');
  });

  // 6. Single council profile returns 404 for unknown ID
  it('should return 404 for unknown council profile', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/cognition/council-profiles/does-not-exist' });

    expect(res.statusCode).toBe(404);
  });

  // 7. Learning status returns ISO date strings
  it('should return learning status with ISO dates', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/cognition/learning/status' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.currentStage).toBeTruthy();

    // All date fields should be ISO strings
    const dateFields = ['lastReview', 'lastGapAnalysis', 'lastAssessment', 'nextReview', 'nextGapAnalysis', 'nextAssessment'];
    for (const field of dateFields) {
      expect(body[field]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }

    expect(['improving', 'stable', 'declining']).toContain(body.improvementTrend);
  });

  // 8. Framework usage returns entries for known frameworks
  it('should return framework usage entries', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/cognition/frameworks/usage' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThan(10); // We have 15+ frameworks

    for (const entry of body) {
      expect(entry).toHaveProperty('framework');
      expect(entry).toHaveProperty('pillar');
      expect(entry).toHaveProperty('usageCount');
      expect(entry).toHaveProperty('successRate');
      expect(['LOGOS', 'ETHOS', 'PATHOS']).toContain(entry.pillar);
    }
  });

  // 9. Insights returns array (may be empty initially)
  it('should return insights array', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/cognition/insights' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toBeInstanceOf(Array);
  });

  // 10. Calibration: full lifecycle (POST → GET → POST outcome → GET updated)
  it('should handle full calibration prediction lifecycle', async () => {
    // Step 1: Add a prediction
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/api/cognition/learning/calibration/predictions',
      payload: { statement: 'Integration test prediction', confidence: 0.75 },
    });
    expect(createRes.statusCode).toBe(200);
    const { id } = JSON.parse(createRes.body);
    expect(id).toBeTruthy();

    // Step 2: Get calibration report — should have the prediction
    const reportRes1 = await fastify.inject({ method: 'GET', url: '/api/cognition/learning/calibration' });
    expect(reportRes1.statusCode).toBe(200);
    const report1 = JSON.parse(reportRes1.body);
    expect(report1.predictions.length).toBeGreaterThanOrEqual(1);

    // Step 3: Resolve the prediction
    const resolveRes = await fastify.inject({
      method: 'POST',
      url: `/api/cognition/learning/calibration/predictions/${id}/outcome`,
      payload: { outcome: true },
    });
    expect(resolveRes.statusCode).toBe(200);
    expect(JSON.parse(resolveRes.body).success).toBe(true);

    // Step 4: Get updated report — prediction should be resolved
    const reportRes2 = await fastify.inject({ method: 'GET', url: '/api/cognition/learning/calibration' });
    expect(reportRes2.statusCode).toBe(200);
    const report2 = JSON.parse(reportRes2.body);
    const resolved = report2.predictions.find((p: { id: string }) => p.id === id);
    expect(resolved).toBeDefined();
    expect(resolved.outcome).toBe(true);
    expect(resolved.resolvedAt).toBeTruthy();
  });

  // 11. Error handling: 503 when cognitionLayer not provided
  it('should return 503 when cognition layer not available', async () => {
    const noCognitionFastify = Fastify();
    const deps = {
      audit: {} as ApiDependencies['audit'],
      eventBus: new EventBus(),
    } as ApiDependencies;
    await noCognitionFastify.register(cognitiveRoutes, { deps });

    const res = await noCognitionFastify.inject({ method: 'GET', url: '/api/cognition/health' });
    expect(res.statusCode).toBe(503);

    await noCognitionFastify.close();
  });
});
