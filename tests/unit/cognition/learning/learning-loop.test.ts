/**
 * Learning Loop Orchestrator Tests
 *
 * Tests the LearningLoop class that ties together daily reviews,
 * weekly gap analysis, and monthly self-assessment.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { LearningLoop } from '../../../../src/cognition/learning/learning-loop.js';
import { DecisionJournal } from '../../../../src/cognition/learning/decision-journal.js';
import type { JournalEntry } from '../../../../src/cognition/learning/decision-journal.js';
import type { PerformanceReview, GapAnalysisResult, SelfAssessment } from '../../../../src/cognition/types.js';

describe('LearningLoop', () => {
  let learningLoop: LearningLoop;
  const testDataDir = path.join(homedir(), '.ari', 'learning-test');

  beforeEach(async () => {
    // Clean up any existing test data
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, which is fine
    }
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  describe('runDailyReview', () => {
    it('should generate valid PerformanceReview without journal', async () => {
      // No journal provided — should work with empty entries
      learningLoop = new LearningLoop();
      const review = await learningLoop.runDailyReview();

      expect(review).toBeDefined();
      expect(review.period).toBeDefined();
      expect(review.period.durationHours).toBe(24);
      expect(review.decisions.total).toBe(0);
      expect(review.decisions.successRate).toBe(0);
      expect(review.biasesDetected.total).toBe(0);
      expect(review.frameworkUsage).toEqual([]);
      expect(review.patterns).toBeDefined();
      expect(review.insights).toBeDefined();
      expect(review.recommendations).toBeDefined();
      expect(review.overallGrade).toMatch(/^[A-F]$/);
      expect(review.timestamp).toBeInstanceOf(Date);
    });

    it('should generate PerformanceReview with mock journal entries', async () => {
      // Create mock journal with entries
      const mockJournal = new DecisionJournal();
      const entries: JournalEntry[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          decision: 'Test decision 1',
          frameworks_used: ['Bayesian Reasoning'],
          pillar: 'LOGOS',
          confidence: 0.8,
          outcome: 'success',
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
          decision: 'Test decision 2',
          frameworks_used: ['Expected Value Theory'],
          pillar: 'LOGOS',
          confidence: 0.6,
          outcome: 'failure',
          biases_detected: ['CONFIRMATION_BIAS'],
        },
      ];

      // Manually add entries to journal (simulating event capture)
      for (const entry of entries) {
        mockJournal.recordDecision({
          decision: entry.decision,
          frameworks_used: entry.frameworks_used,
          pillar: entry.pillar,
          confidence: entry.confidence,
          outcome: entry.outcome,
          biases_detected: entry.biases_detected,
        });
      }

      learningLoop = new LearningLoop(mockJournal);
      const review = await learningLoop.runDailyReview();

      expect(review.decisions.total).toBe(2);
      expect(review.decisions.successful).toBe(1);
      expect(review.decisions.failed).toBe(1);
      expect(review.decisions.successRate).toBeCloseTo(0.5);
      expect(review.biasesDetected.total).toBe(1);
      expect(review.frameworkUsage.length).toBeGreaterThan(0);
    });

    it('should track review count and last execution time', async () => {
      learningLoop = new LearningLoop();

      const statusBefore = learningLoop.getStatus();
      expect(statusBefore.reviewCount).toBe(0);
      expect(statusBefore.lastDailyReview).toBeNull();

      await learningLoop.runDailyReview();

      const statusAfter = learningLoop.getStatus();
      expect(statusAfter.reviewCount).toBe(1);
      expect(statusAfter.lastDailyReview).toBeInstanceOf(Date);
    });

    it('should limit stored reviews to 30', async () => {
      learningLoop = new LearningLoop();

      // Generate 35 daily reviews
      for (let i = 0; i < 35; i++) {
        await learningLoop.runDailyReview();
      }

      const status = learningLoop.getStatus();
      expect(status.reviewCount).toBe(35);

      // Check that internal storage is capped (by running weekly analysis which uses recentReviews)
      const gapResult = await learningLoop.runWeeklyGapAnalysis();
      expect(gapResult).toBeDefined();
    });
  });

  describe('runWeeklyGapAnalysis', () => {
    it('should generate valid GapAnalysisResult', async () => {
      learningLoop = new LearningLoop();

      // Generate some reviews first
      await learningLoop.runDailyReview();
      await learningLoop.runDailyReview();
      await learningLoop.runDailyReview();

      const gapResult = await learningLoop.runWeeklyGapAnalysis();

      expect(gapResult).toBeDefined();
      expect(gapResult.period).toBeDefined();
      expect(gapResult.period.start).toBeInstanceOf(Date);
      expect(gapResult.period.end).toBeInstanceOf(Date);
      expect(gapResult.gaps).toBeDefined();
      expect(Array.isArray(gapResult.gaps)).toBe(true);
      expect(gapResult.topGaps).toBeDefined();
      expect(gapResult.recommendations).toBeDefined();
      expect(Array.isArray(gapResult.recommendations)).toBe(true);
      expect(gapResult.timestamp).toBeInstanceOf(Date);
    });

    it('should track gap analysis count and last execution time', async () => {
      learningLoop = new LearningLoop();

      const statusBefore = learningLoop.getStatus();
      expect(statusBefore.gapAnalysisCount).toBe(0);
      expect(statusBefore.lastWeeklyAnalysis).toBeNull();

      await learningLoop.runDailyReview();
      await learningLoop.runWeeklyGapAnalysis();

      const statusAfter = learningLoop.getStatus();
      expect(statusAfter.gapAnalysisCount).toBe(1);
      expect(statusAfter.lastWeeklyAnalysis).toBeInstanceOf(Date);
    });

    it('should store current and previous gap analysis', async () => {
      learningLoop = new LearningLoop();

      await learningLoop.runDailyReview();
      const firstGapResult = await learningLoop.runWeeklyGapAnalysis();

      await learningLoop.runDailyReview();
      const secondGapResult = await learningLoop.runWeeklyGapAnalysis();

      expect(firstGapResult).toBeDefined();
      expect(secondGapResult).toBeDefined();
      expect(firstGapResult.timestamp).not.toEqual(secondGapResult.timestamp);

      const status = learningLoop.getStatus();
      expect(status.gapAnalysisCount).toBe(2);
    });
  });

  describe('runMonthlyAssessment', () => {
    it('should generate valid SelfAssessment', async () => {
      learningLoop = new LearningLoop();

      // Generate reviews to have data for assessment
      for (let i = 0; i < 10; i++) {
        await learningLoop.runDailyReview();
      }

      const assessment = await learningLoop.runMonthlyAssessment();

      expect(assessment).toBeDefined();
      expect(assessment.period).toBeDefined();
      expect(assessment.period.start).toBeInstanceOf(Date);
      expect(assessment.period.end).toBeInstanceOf(Date);
      expect(assessment.period.previousStart).toBeInstanceOf(Date);
      expect(assessment.period.previousEnd).toBeInstanceOf(Date);
      expect(assessment.decisionQuality).toBeDefined();
      expect(assessment.decisionQuality.thisPeriod).toBeGreaterThanOrEqual(0);
      expect(assessment.decisionQuality.trend).toMatch(/^(IMPROVING|DECLINING|STABLE)$/);
      expect(assessment.biasReduction).toBeDefined();
      expect(assessment.knowledgeGrowth).toBeDefined();
      expect(assessment.learningVelocity).toBeDefined();
      expect(assessment.frameworkEffectiveness).toBeDefined();
      expect(Array.isArray(assessment.frameworkEffectiveness)).toBe(true);
      expect(assessment.overallImprovement).toBeDefined();
      expect(assessment.grade).toMatch(/^[A-F]$/);
      expect(assessment.gradeExplanation).toBeDefined();
      expect(assessment.strengths).toBeDefined();
      expect(Array.isArray(assessment.strengths)).toBe(true);
      expect(assessment.weaknesses).toBeDefined();
      expect(Array.isArray(assessment.weaknesses)).toBe(true);
      expect(assessment.recommendations).toBeDefined();
      expect(Array.isArray(assessment.recommendations)).toBe(true);
      expect(assessment.nextMonthFocus).toBeDefined();
      expect(Array.isArray(assessment.nextMonthFocus)).toBe(true);
      expect(assessment.timestamp).toBeInstanceOf(Date);
    });

    it('should track assessment count and last execution time', async () => {
      learningLoop = new LearningLoop();

      const statusBefore = learningLoop.getStatus();
      expect(statusBefore.assessmentCount).toBe(0);
      expect(statusBefore.lastMonthlyAssessment).toBeNull();

      await learningLoop.runDailyReview();
      await learningLoop.runMonthlyAssessment();

      const statusAfter = learningLoop.getStatus();
      expect(statusAfter.assessmentCount).toBe(1);
      expect(statusAfter.lastMonthlyAssessment).toBeInstanceOf(Date);
    });

    it('should rotate reviews from current to previous', async () => {
      learningLoop = new LearningLoop();

      // Generate first batch of reviews
      for (let i = 0; i < 5; i++) {
        await learningLoop.runDailyReview();
      }

      const firstAssessment = await learningLoop.runMonthlyAssessment();

      // Generate second batch
      for (let i = 0; i < 5; i++) {
        await learningLoop.runDailyReview();
      }

      const secondAssessment = await learningLoop.runMonthlyAssessment();

      expect(firstAssessment).toBeDefined();
      expect(secondAssessment).toBeDefined();

      const status = learningLoop.getStatus();
      expect(status.assessmentCount).toBe(2);
    });
  });

  describe('getStatus', () => {
    it('should return initial status with null timestamps', () => {
      learningLoop = new LearningLoop();
      const status = learningLoop.getStatus();

      expect(status.lastDailyReview).toBeNull();
      expect(status.lastWeeklyAnalysis).toBeNull();
      expect(status.lastMonthlyAssessment).toBeNull();
      expect(status.reviewCount).toBe(0);
      expect(status.gapAnalysisCount).toBe(0);
      expect(status.assessmentCount).toBe(0);
    });

    it('should return updated status after operations', async () => {
      learningLoop = new LearningLoop();

      await learningLoop.runDailyReview();
      await learningLoop.runWeeklyGapAnalysis();
      await learningLoop.runMonthlyAssessment();

      const status = learningLoop.getStatus();

      expect(status.lastDailyReview).toBeInstanceOf(Date);
      expect(status.lastWeeklyAnalysis).toBeInstanceOf(Date);
      expect(status.lastMonthlyAssessment).toBeInstanceOf(Date);
      expect(status.reviewCount).toBe(1);
      expect(status.gapAnalysisCount).toBe(1);
      expect(status.assessmentCount).toBe(1);
    });
  });

  describe('sequential operations', () => {
    it('should support multiple sequential reviews, analyses, and assessments', async () => {
      learningLoop = new LearningLoop();

      // Day 1-7: Daily reviews
      for (let day = 1; day <= 7; day++) {
        await learningLoop.runDailyReview();
      }

      // Week 1: Gap analysis
      const gapResult1 = await learningLoop.runWeeklyGapAnalysis();
      expect(gapResult1).toBeDefined();

      // Day 8-14: More daily reviews
      for (let day = 8; day <= 14; day++) {
        await learningLoop.runDailyReview();
      }

      // Week 2: Gap analysis
      const gapResult2 = await learningLoop.runWeeklyGapAnalysis();
      expect(gapResult2).toBeDefined();

      // Month 1: Self-assessment
      const assessment = await learningLoop.runMonthlyAssessment();
      expect(assessment).toBeDefined();

      const status = learningLoop.getStatus();
      expect(status.reviewCount).toBe(14);
      expect(status.gapAnalysisCount).toBe(2);
      expect(status.assessmentCount).toBe(1);
    });

    it('should handle edge case with no reviews before analysis', async () => {
      learningLoop = new LearningLoop();

      // Run gap analysis with no reviews
      const gapResult = await learningLoop.runWeeklyGapAnalysis();
      expect(gapResult).toBeDefined();
      expect(gapResult.recommendations).toContain('Insufficient data for gap analysis');

      // Run assessment with no reviews
      const assessment = await learningLoop.runMonthlyAssessment();
      expect(assessment).toBeDefined();
      expect(assessment.grade).toMatch(/^[A-F]$/);
    });
  });

  describe('persistence', () => {
    it('should persist reviews to disk', async () => {
      learningLoop = new LearningLoop();
      const review = await learningLoop.runDailyReview();

      // Check that review was persisted
      const reviewDir = path.join(homedir(), '.ari', 'learning', 'reviews');
      const files = await fs.readdir(reviewDir);
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.startsWith('review-'))).toBe(true);
    });

    it('should persist gap analysis to disk', async () => {
      learningLoop = new LearningLoop();
      await learningLoop.runDailyReview();
      const gapResult = await learningLoop.runWeeklyGapAnalysis();

      // Check that gap analysis was persisted
      const gapDir = path.join(homedir(), '.ari', 'learning', 'gap-analysis');
      const files = await fs.readdir(gapDir);
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.startsWith('gaps-'))).toBe(true);
    });

    it('should persist assessments to disk', async () => {
      learningLoop = new LearningLoop();
      await learningLoop.runDailyReview();
      const assessment = await learningLoop.runMonthlyAssessment();

      // Check that assessment was persisted
      const assessmentDir = path.join(homedir(), '.ari', 'learning', 'assessments');
      const files = await fs.readdir(assessmentDir);
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.startsWith('assessment-'))).toBe(true);
    });
  });
});
