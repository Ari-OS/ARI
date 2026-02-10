/**
 * Cognitive Learning Loop — Integration Tests
 *
 * Tests the full pipeline: Decision Journal → Performance Review → Gap Analysis → Self-Assessment
 * Also validates that knowledge sources are correctly tagged to council specializations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { EventBus } from '../../src/kernel/event-bus.js';
import { DecisionJournal } from '../../src/cognition/learning/decision-journal.js';
import { PerformanceReviewer } from '../../src/cognition/learning/performance-review.js';
import { GapAnalyzer } from '../../src/cognition/learning/gap-analysis.js';
import { SelfAssessor } from '../../src/cognition/learning/self-assessment.js';
import { LearningLoop } from '../../src/cognition/learning/learning-loop.js';
import { SourceManager } from '../../src/cognition/knowledge/source-manager.js';
import { ContentValidator } from '../../src/cognition/knowledge/content-validator.js';
import { getAllProfiles } from '../../src/cognition/knowledge/specializations.js';

describe('Cognitive Learning Loop Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `ari-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should flow: Decision Journal → Performance Review → Gap Analysis → Self-Assessment', async () => {
    const eventBus = new EventBus();
    const journal = new DecisionJournal(tempDir);
    await journal.initialize(eventBus);

    // Record decisions via event emissions
    eventBus.emit('cognition:belief_updated', {
      hypothesis: 'Test hypothesis',
      priorProbability: 0.5,
      posteriorProbability: 0.75,
      shift: 0.25,
    });

    eventBus.emit('cognition:expected_value_calculated', {
      decision: 'Test EV decision',
      expectedValue: 150.0,
      recommendation: 'proceed',
    });

    // Wait for journal to record
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(journal.size).toBeGreaterThanOrEqual(2);

    // Performance Review
    const reviewer = new PerformanceReviewer();
    const entries = journal.getRecentDecisions(1);
    const review = reviewer.generateReview(entries, { hours: 1 });
    expect(review.decisions.total).toBeGreaterThanOrEqual(2);
    expect(review.overallGrade).toBeDefined();
    expect(review.timestamp).toBeInstanceOf(Date);

    // Gap Analysis
    const analyzer = new GapAnalyzer();
    const gapResult = analyzer.analyzeGaps([review]);
    expect(gapResult.recommendations).toBeDefined();
    expect(gapResult.recommendations.length).toBeGreaterThan(0);
    expect(gapResult.timestamp).toBeInstanceOf(Date);

    // Self-Assessment
    const assessor = new SelfAssessor();
    const assessment = assessor.assess({
      currentReviews: [review],
      previousReviews: [],
      currentGaps: gapResult,
      previousGaps: null,
    });
    expect(assessment.grade).toBeDefined();
    expect(['A', 'B', 'C', 'D', 'F']).toContain(assessment.grade);
    expect(assessment.timestamp).toBeInstanceOf(Date);

    await journal.shutdown();
  });

  it('should have knowledge sources tagged to council specializations', () => {
    const sourceManager = new SourceManager();
    const profiles = getAllProfiles();

    expect(profiles.length).toBe(15);

    for (const profile of profiles) {
      // Every profile should reference at least one source
      expect(
        profile.knowledgeSources.length,
        `${profile.memberName} should have knowledge sources`
      ).toBeGreaterThan(0);

      // Every referenced source should exist in the source manager
      for (const sourceId of profile.knowledgeSources) {
        const source = sourceManager.getSource(sourceId);
        expect(
          source,
          `Source '${sourceId}' referenced by ${profile.memberName} should exist`
        ).toBeDefined();
      }
    }
  });

  it('should validate content through the 5-stage pipeline', async () => {
    const sourceManager = new SourceManager();
    const sourceIds = sourceManager.getSources().map(s => s.id);
    const validator = new ContentValidator(sourceIds);

    // Get a known source ID
    const sources = sourceManager.getSources();
    expect(sources.length).toBeGreaterThan(0);
    const knownSource = sources[0];

    // Valid content should pass
    const validResult = await validator.validate({
      sourceId: knownSource.id,
      contentId: 'test-valid-1',
      content: 'Bayesian reasoning is a systematic approach to updating beliefs based on new evidence. It provides a mathematical framework for combining prior knowledge with observed data.',
      trustLevel: 'VERIFIED',
    });
    expect(validResult.passed).toBe(true);

    // Unknown source should fail at whitelist
    const unknownResult = await validator.validate({
      sourceId: 'totally-unknown-source',
      contentId: 'test-unknown-1',
      content: 'Some content from unknown source',
      trustLevel: 'STANDARD',
    });
    expect(unknownResult.passed).toBe(false);
    expect(unknownResult.stage).toBe('WHITELIST');
  });

  it('should run the full learning loop orchestrator', async () => {
    const loop = new LearningLoop();

    // Daily review (no journal, so empty entries)
    const review = await loop.runDailyReview();
    expect(review).toBeDefined();
    expect(review.decisions.total).toBe(0);
    expect(review.overallGrade).toBe('F'); // No data = F grade

    // Weekly gap analysis
    const gaps = await loop.runWeeklyGapAnalysis();
    expect(gaps).toBeDefined();
    expect(gaps.recommendations.length).toBeGreaterThan(0);

    // Monthly assessment
    const assessment = await loop.runMonthlyAssessment();
    expect(assessment).toBeDefined();
    expect(assessment.grade).toBeDefined();

    // Status tracking
    const status = loop.getStatus();
    expect(status.reviewCount).toBe(1);
    expect(status.gapAnalysisCount).toBe(1);
    expect(status.assessmentCount).toBe(1);
    expect(status.lastDailyReview).toBeInstanceOf(Date);
    expect(status.lastWeeklyAnalysis).toBeInstanceOf(Date);
    expect(status.lastMonthlyAssessment).toBeInstanceOf(Date);
  });

  it('should cover all three pillars across knowledge sources', () => {
    const sourceManager = new SourceManager();

    const logosSources = sourceManager.getSourcesByPillar('LOGOS');
    const ethosSources = sourceManager.getSourcesByPillar('ETHOS');
    const pathosSources = sourceManager.getSourcesByPillar('PATHOS');

    expect(logosSources.length).toBeGreaterThan(0);
    expect(ethosSources.length).toBeGreaterThan(0);
    expect(pathosSources.length).toBeGreaterThan(0);

    // Stats should reflect pillar distribution
    const stats = sourceManager.getSourceStats();
    expect(stats.total).toBeGreaterThanOrEqual(30);
    expect(stats.byPillar['LOGOS']).toBeGreaterThan(0);
    expect(stats.byPillar['ETHOS']).toBeGreaterThan(0);
    expect(stats.byPillar['PATHOS']).toBeGreaterThan(0);
  });
});
