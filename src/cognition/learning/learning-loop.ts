/**
 * Learning Loop Orchestrator
 *
 * Ties together the three learning components (Performance Review, Gap Analysis,
 * Self-Assessment) into a scheduler-friendly interface.
 *
 * - Daily: Performance Review from Decision Journal entries
 * - Weekly: Gap Analysis from daily reviews
 * - Monthly: Self-Assessment comparing current vs previous month
 *
 * @module cognition/learning/learning-loop
 */

import fs from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import type { PerformanceReview, GapAnalysisResult, SelfAssessment } from '../types.js';
import { PerformanceReviewer } from './performance-review.js';
import { GapAnalyzer } from './gap-analysis.js';
import { SelfAssessor, type AssessmentInput } from './self-assessment.js';
import { DecisionJournal } from './decision-journal.js';

export interface LearningLoopStatus {
  lastDailyReview: Date | null;
  lastWeeklyAnalysis: Date | null;
  lastMonthlyAssessment: Date | null;
  reviewCount: number;
  gapAnalysisCount: number;
  assessmentCount: number;
}

export class LearningLoop {
  private reviewer: PerformanceReviewer;
  private gapAnalyzer: GapAnalyzer;
  private selfAssessor: SelfAssessor;
  private journal: DecisionJournal | null;
  private dataDir: string;

  // Tracking
  private lastDailyReview: Date | null = null;
  private lastWeeklyAnalysis: Date | null = null;
  private lastMonthlyAssessment: Date | null = null;
  private reviewCount = 0;
  private gapAnalysisCount = 0;
  private assessmentCount = 0;

  // Storage
  private recentReviews: PerformanceReview[] = [];
  private recentGapAnalysis: GapAnalysisResult | null = null;
  private previousReviews: PerformanceReview[] = [];
  private previousGapAnalysis: GapAnalysisResult | null = null;

  constructor(journal?: DecisionJournal) {
    this.reviewer = new PerformanceReviewer();
    this.gapAnalyzer = new GapAnalyzer();
    this.selfAssessor = new SelfAssessor();
    this.journal = journal ?? null;
    this.dataDir = path.join(homedir(), '.ari', 'learning');

    // Ensure data directory exists
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Run daily performance review.
   * Gets last 24 hours of decisions from journal, generates review.
   */
  async runDailyReview(): Promise<PerformanceReview> {
    const entries = this.journal?.getRecentDecisions(24) ?? [];
    const review = this.reviewer.generateReview(entries, { hours: 24 });

    this.recentReviews.push(review);
    // Keep last 30 reviews
    if (this.recentReviews.length > 30) {
      this.recentReviews = this.recentReviews.slice(-30);
    }

    this.lastDailyReview = new Date();
    this.reviewCount++;

    // Persist
    await this.persistReview(review);

    return review;
  }

  /**
   * Run weekly gap analysis.
   * Analyzes the last 7 daily reviews to find knowledge gaps.
   */
  async runWeeklyGapAnalysis(): Promise<GapAnalysisResult> {
    const lastWeekReviews = this.recentReviews.slice(-7);
    const result = this.gapAnalyzer.analyzeGaps(lastWeekReviews);

    // Save previous before overwriting
    this.previousGapAnalysis = this.recentGapAnalysis;
    this.recentGapAnalysis = result;

    this.lastWeeklyAnalysis = new Date();
    this.gapAnalysisCount++;

    // Persist
    await this.persistGapAnalysis(result);

    return result;
  }

  /**
   * Run monthly self-assessment.
   * Compares current month vs previous month performance.
   */
  async runMonthlyAssessment(): Promise<SelfAssessment> {
    // Split reviews into current and previous
    const midpoint = Math.floor(this.recentReviews.length / 2);
    const currentReviews = this.recentReviews.slice(midpoint);
    const previousReviews = this.previousReviews.length > 0
      ? this.previousReviews
      : this.recentReviews.slice(0, midpoint);

    const input: AssessmentInput = {
      currentReviews,
      previousReviews,
      currentGaps: this.recentGapAnalysis,
      previousGaps: this.previousGapAnalysis,
    };

    const assessment = this.selfAssessor.assess(input);

    // Rotate: current becomes previous
    this.previousReviews = [...this.recentReviews];
    this.recentReviews = [];

    this.lastMonthlyAssessment = new Date();
    this.assessmentCount++;

    // Persist
    await this.persistAssessment(assessment);

    return assessment;
  }

  /**
   * Get the current status of the learning loop.
   */
  getStatus(): LearningLoopStatus {
    return {
      lastDailyReview: this.lastDailyReview,
      lastWeeklyAnalysis: this.lastWeeklyAnalysis,
      lastMonthlyAssessment: this.lastMonthlyAssessment,
      reviewCount: this.reviewCount,
      gapAnalysisCount: this.gapAnalysisCount,
      assessmentCount: this.assessmentCount,
    };
  }

  // --- Persistence ---

  private async persistReview(review: PerformanceReview): Promise<void> {
    try {
      const dir = path.join(this.dataDir, 'reviews');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const filename = `review-${review.timestamp.toISOString().split('T')[0]}-${Date.now()}.json`;
      await fs.writeFile(path.join(dir, filename), JSON.stringify(review, null, 2));
    } catch {
      // Persistence failure is non-fatal
    }
  }

  private async persistGapAnalysis(result: GapAnalysisResult): Promise<void> {
    try {
      const dir = path.join(this.dataDir, 'gap-analysis');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const filename = `gaps-${result.timestamp.toISOString().split('T')[0]}-${Date.now()}.json`;
      await fs.writeFile(path.join(dir, filename), JSON.stringify(result, null, 2));
    } catch {
      // Persistence failure is non-fatal
    }
  }

  private async persistAssessment(assessment: SelfAssessment): Promise<void> {
    try {
      const dir = path.join(this.dataDir, 'assessments');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const filename = `assessment-${assessment.timestamp.toISOString().split('T')[0]}-${Date.now()}.json`;
      await fs.writeFile(path.join(dir, filename), JSON.stringify(assessment, null, 2));
    } catch {
      // Persistence failure is non-fatal
    }
  }
}
