/* eslint-disable @typescript-eslint/require-await */
/**
 * Learning Loop Module — Continuous Improvement System
 *
 * Implements ARI's 5-stage learning loop:
 *
 * 1. **Performance Review**: Daily 9 PM analysis of decisions
 * 2. **Gap Analysis**: Weekly Sunday 8 PM knowledge gap identification
 * 3. **Source Discovery**: Triggered by gaps, finds new knowledge sources
 * 4. **Knowledge Integration**: Process and validate new sources
 * 5. **Self-Assessment**: Monthly 1st 9 AM comprehensive evaluation
 *
 * @module cognition/learning
 * @version 1.0.0
 */

import { EventBus } from '../../kernel/event-bus.js';
import type {
  PerformanceReview,
  GapAnalysisResult,
  KnowledgeGap,
  SelfAssessment,
  Insight,
  CognitiveBias,
  LearningProgress,
} from '../types.js';
// LearningLoopError will be used when we implement error handling for learning loop operations
// import { LearningLoopError } from '../errors.js';

let eventBus = new EventBus();

/**
 * Set the shared EventBus for the learning module.
 * Called by CognitionLayer during initialization to connect events to kernel bus.
 */
export function setLearningEventBus(bus: EventBus): void {
  eventBus = bus;
}

// =============================================================================
// TEACHING-ORIENTED LEARNING (Retrieval Practice, Knowledge Tracking)
// =============================================================================

export * from './user-knowledge.js';
export * from './retrieval-practice.js';
export * from './adaptive-explanation.js';
export * from './spaced-repetition.js';
export * from './review-session.js';
export * from './concept-cards.js';
export * from './practice-tracker.js';
export * from './weakness-analyzer.js';
export * from './session-feedback.js';
export * from './preferences-detector.js';
export * from './adaptive-teacher.js';
export * from './prerequisites.js';
export * from './scaffolding.js';
export * from './analytics.js';
export * from './calibration.js';
export * from './meta-feedback.js';
export * from './interleaving.js';
export * from './transfer.js';
export * from './analogies.js';
export * from './cognitive-load.js';
export * from './chunking.js';
export * from './worked-examples.js';

// New persistence and data pipeline modules
export * from './storage-adapter.js';
export * from './decision-collector.js';
export * from './skill-registry.js';

// =============================================================================
// LEARNING LOOP STATE
// =============================================================================

interface LearningLoopState {
  currentStage: 'PERFORMANCE_REVIEW' | 'GAP_ANALYSIS' | 'SOURCE_DISCOVERY' | 'KNOWLEDGE_INTEGRATION' | 'SELF_ASSESSMENT';
  lastReview: Date | null;
  lastGapAnalysis: Date | null;
  lastAssessment: Date | null;
  insights: Insight[];
  gaps: KnowledgeGap[];
  isRunning: boolean;
}

const learningState: LearningLoopState = {
  currentStage: 'PERFORMANCE_REVIEW',
  lastReview: null,
  lastGapAnalysis: null,
  lastAssessment: null,
  insights: [],
  gaps: [],
  isRunning: false,
};

/**
 * Get current learning loop status
 */
export function getLearningStatus(): LearningProgress {
  const now = new Date();

  // Calculate next scheduled times
  const nextReview = getNextScheduledTime('21:00', 'daily');
  const nextGapAnalysis = getNextScheduledTime('20:00', 'weekly', 0); // Sunday
  const nextAssessment = getNextScheduledTime('09:00', 'monthly', 1); // 1st of month

  return {
    currentStage: learningState.currentStage,
    stageProgress: 0.5, // TODO: Implement actual progress tracking
    lastReview: learningState.lastReview || now,
    lastGapAnalysis: learningState.lastGapAnalysis || now,
    lastAssessment: learningState.lastAssessment || now,
    nextReview,
    nextGapAnalysis,
    nextAssessment,
    recentInsights: learningState.insights.slice(-10),
    recentInsightsCount: learningState.insights.length,
    improvementTrend: 'IMPROVING', // TODO: Calculate from metrics
    currentGrade: 'B', // TODO: Calculate from assessments
    streakDays: 0, // TODO: Track streak
  };
}

function getNextScheduledTime(
  time: string,
  frequency: 'daily' | 'weekly' | 'monthly',
  dayOfWeekOrMonth?: number
): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date(now);

  next.setHours(hours, minutes, 0, 0);

  if (frequency === 'daily') {
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
  } else if (frequency === 'weekly' && dayOfWeekOrMonth !== undefined) {
    // dayOfWeekOrMonth = 0 for Sunday, 6 for Saturday
    const currentDay = next.getDay();
    const daysUntil = (dayOfWeekOrMonth - currentDay + 7) % 7;
    next.setDate(next.getDate() + (daysUntil === 0 && next <= now ? 7 : daysUntil));
  } else if (frequency === 'monthly' && dayOfWeekOrMonth !== undefined) {
    // dayOfWeekOrMonth = day of month (1-31)
    next.setDate(dayOfWeekOrMonth);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
  }

  return next;
}

// =============================================================================
// PERFORMANCE REVIEW (Daily)
// =============================================================================

/**
 * Run daily performance review
 *
 * Analyzes decisions made in the past 24 hours.
 * Scheduled: Daily at 9 PM
 */
export async function runPerformanceReview(
  decisions: Array<{
    id: string;
    description: string;
    outcome: 'success' | 'failure' | 'partial';
    expectedValue?: number;
    actualValue?: number;
    biasesDetected?: CognitiveBias[];
    emotionalRisk?: number;
  }>,
  period?: { start: Date; end: Date }
): Promise<PerformanceReview> {
  const now = new Date();
  const reviewPeriod = period || {
    start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    end: now,
  };

  // Analyze decisions
  const successful = decisions.filter(d => d.outcome === 'success');
  const failed = decisions.filter(d => d.outcome === 'failure');
  const partial = decisions.filter(d => d.outcome === 'partial');

  const successRate = decisions.length > 0
    ? successful.length / decisions.length
    : 1;

  // Calculate EV accuracy
  const evDecisions = decisions.filter(d =>
    d.expectedValue !== undefined && d.actualValue !== undefined
  );
  let meanError = 0;
  let rmse = 0;

  if (evDecisions.length > 0) {
    const errors = evDecisions.map(d => (d.actualValue! - d.expectedValue!) / Math.max(1, Math.abs(d.expectedValue!)));
    meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
    rmse = Math.sqrt(errors.map(e => e * e).reduce((a, b) => a + b, 0) / errors.length);
  }

  // Aggregate biases
  const allBiases = decisions.flatMap(d => d.biasesDetected || []);
  const biasCounts: Partial<Record<CognitiveBias, number>> = {};
  for (const bias of allBiases) {
    biasCounts[bias] = (biasCounts[bias] || 0) + 1;
  }

  // Calculate emotional risk
  const emotionalRisks = decisions.filter(d => d.emotionalRisk !== undefined);
  const avgEmotionalRisk = emotionalRisks.length > 0
    ? emotionalRisks.reduce((sum, d) => sum + d.emotionalRisk!, 0) / emotionalRisks.length
    : 0;

  const highRiskDecisions = emotionalRisks.filter(d => d.emotionalRisk! > 0.6).length;

  // Identify patterns
  const patterns: string[] = [];
  if (successRate < 0.5) {
    patterns.push('Success rate below 50% - review decision process');
  }
  if (Object.keys(biasCounts).length > 3) {
    patterns.push(`Multiple biases detected (${Object.keys(biasCounts).length} types)`);
  }
  if (highRiskDecisions > 2) {
    patterns.push(`${highRiskDecisions} decisions made under high emotional risk`);
  }

  // Generate insights
  const insights: Insight[] = [];

  if (failed.length > 0) {
    insights.push({
      id: `insight-review-${Date.now()}`,
      type: 'PATTERN',
      description: `${failed.length} failed decision(s) - analyze root causes`,
      evidence: failed.map(d => d.description),
      actionable: 'Review each failure for lessons learned',
      confidence: 0.8,
      generalizes: failed.length > 1,
      priority: 'HIGH',
      framework: 'Performance Review',
      timestamp: now,
    });
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (successRate < 0.7) {
    recommendations.push('Focus on improving decision quality before speed');
  }
  if (rmse > 0.3) {
    recommendations.push('Calibrate predictions - actual outcomes differ significantly from expected');
  }
  if (Object.keys(biasCounts).length > 0) {
    const topBias = Object.entries(biasCounts).sort((a, b) => b[1] - a[1])[0];
    recommendations.push(`Most common bias: ${topBias[0]} (${topBias[1]} occurrences) - apply specific mitigation`);
  }

  const result: PerformanceReview = {
    period: {
      start: reviewPeriod.start,
      end: reviewPeriod.end,
      durationHours: (reviewPeriod.end.getTime() - reviewPeriod.start.getTime()) / (1000 * 60 * 60),
    },
    decisions: {
      total: decisions.length,
      successful: successful.length,
      failed: failed.length,
      partial: partial.length,
      successRate,
    },
    expectedValueAccuracy: {
      meanError,
      rmse,
      calibration: 1 - Math.min(1, rmse),
      overconfidenceRate: 0, // TODO: Calculate from predictions
      underconfidenceRate: 0, // TODO: Calculate from predictions
    },
    biasesDetected: {
      total: allBiases.length,
      byType: biasCounts as Record<CognitiveBias, number>,
      trend: allBiases.length > 5 ? 'increasing' : 'stable',
    },
    emotionalRisk: {
      avgRisk: avgEmotionalRisk,
      highRiskDecisions,
      highRiskRate: decisions.length > 0 ? highRiskDecisions / decisions.length : 0,
    },
    frameworkUsage: [], // TODO: Track framework usage per decision
    patterns,
    insights,
    recommendations,
    overallGrade: successRate >= 0.9 ? 'A' : successRate >= 0.75 ? 'B' : successRate >= 0.6 ? 'C' : successRate >= 0.4 ? 'D' : 'F',
    timestamp: now,
  };

  // Update state
  learningState.lastReview = now;
  learningState.insights.push(...insights);
  learningState.currentStage = 'PERFORMANCE_REVIEW';

  // Emit event
  eventBus.emit('audit:log', {
    action: 'learning:performance_review',
    agent: 'Learning',
    trustLevel: 'system',
    details: {
      decisions: decisions.length,
      successRate,
      biasCount: allBiases.length,
      insightCount: insights.length,
    },
  });

  return result;
}

// =============================================================================
// GAP ANALYSIS (Weekly)
// =============================================================================

/**
 * Run weekly gap analysis
 *
 * Identifies knowledge gaps based on recent queries and failures.
 * Scheduled: Weekly on Sunday at 8 PM
 */
export async function runGapAnalysis(
  recentQueries: Array<{
    query: string;
    domain: string;
    answered: boolean;
    confidence?: number;
  }>,
  recentFailures: Array<{
    description: string;
    domain: string;
    reason?: string;
  }>,
  period?: { start: Date; end: Date }
): Promise<GapAnalysisResult> {
  const now = new Date();
  const analysisPeriod = period || {
    start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    end: now,
  };

  // Identify gaps from unanswered queries
  const unansweredQueries = recentQueries.filter(q => !q.answered);
  const lowConfidenceQueries = recentQueries.filter(q => q.answered && (q.confidence || 1) < 0.6);

  const gaps: KnowledgeGap[] = [];

  // Group by domain
  const domainGaps = new Map<string, { count: number; examples: string[] }>();

  for (const query of [...unansweredQueries, ...lowConfidenceQueries]) {
    const existing = domainGaps.get(query.domain) || { count: 0, examples: [] };
    existing.count++;
    if (existing.examples.length < 3) {
      existing.examples.push(query.query);
    }
    domainGaps.set(query.domain, existing);
  }

  // Add failure-based gaps
  for (const failure of recentFailures) {
    const existing = domainGaps.get(failure.domain) || { count: 0, examples: [] };
    existing.count++;
    if (existing.examples.length < 3) {
      existing.examples.push(failure.description);
    }
    domainGaps.set(failure.domain, existing);
  }

  // Convert to KnowledgeGap objects
  let gapId = 1;
  for (const [domain, data] of domainGaps) {
    const severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = data.count >= 5 ? 'CRITICAL' :
                     data.count >= 3 ? 'HIGH' :
                     data.count >= 2 ? 'MEDIUM' : 'LOW';

    gaps.push({
      id: `gap-${Date.now()}-${gapId++}`,
      description: `Knowledge gap in ${domain}`,
      context: data.examples.join('; '),
      frequency: data.count,
      severity,
      suggestedFrameworks: suggestFrameworks(domain),
      suggestedSources: suggestSources(domain),
      affectedMembers: suggestCouncilMembers(domain),
      priority: data.count,
      status: 'NEW',
      createdAt: now,
    });
  }

  // Sort by priority
  gaps.sort((a, b) => b.priority - a.priority);

  const topGaps = gaps.slice(0, 5);

  // Generate recommendations
  const recommendations: string[] = [];
  for (const gap of topGaps) {
    recommendations.push(`Address ${gap.severity} gap in ${gap.description.replace('Knowledge gap in ', '')}`);
  }

  // Suggest new sources
  const newSourceSuggestions = topGaps.flatMap(gap =>
    gap.suggestedSources.map(source => ({
      name: source,
      url: `https://example.com/${source.toLowerCase().replace(/\s+/g, '-')}`,
      pillar: determinePillarForDomain(gap.description.replace('Knowledge gap in ', '')),
      rationale: `Addresses gap in ${gap.description.replace('Knowledge gap in ', '')}`,
      estimatedTrust: 'STANDARD' as const,
    }))
  ).slice(0, 5);

  const result: GapAnalysisResult = {
    period: {
      start: analysisPeriod.start,
      end: analysisPeriod.end,
    },
    gaps,
    topGaps,
    gapsResolved: [], // TODO: Track resolved gaps from previous analysis
    recommendations,
    newSourceSuggestions,
    timestamp: now,
  };

  // Update state
  learningState.lastGapAnalysis = now;
  learningState.gaps = gaps;
  learningState.currentStage = 'GAP_ANALYSIS';

  // Emit event
  eventBus.emit('audit:log', {
    action: 'learning:gap_analysis',
    agent: 'Learning',
    trustLevel: 'system',
    details: {
      gapsFound: gaps.length,
      topGapDomains: topGaps.map(g => g.description),
      sourceSuggestions: newSourceSuggestions.length,
    },
  });

  return result;
}

function suggestFrameworks(domain: string): string[] {
  const frameworkMap: Record<string, string[]> = {
    risk: ['Antifragility', 'Kelly Criterion', 'Expected Value'],
    finance: ['Kelly Criterion', 'Expected Value', 'Systems Thinking'],
    psychology: ['Cognitive Bias Detection', 'CBT', 'Emotional State'],
    strategy: ['Systems Thinking', 'Decision Trees', 'Antifragility'],
    ethics: ['Virtue Ethics', 'Dichotomy of Control', 'Wisdom'],
    learning: ['Deliberate Practice', 'Reflection Engine', 'Meta-Learning'],
    default: ['Bayesian Reasoning', 'Systems Thinking'],
  };

  const lowerDomain = domain.toLowerCase();
  for (const [key, frameworks] of Object.entries(frameworkMap)) {
    if (lowerDomain.includes(key)) {
      return frameworks;
    }
  }
  return frameworkMap.default;
}

function suggestSources(domain: string): string[] {
  const sourceMap: Record<string, string[]> = {
    risk: ['Taleb - Incerto', 'Ed Thorp - Kelly'],
    finance: ['Dalio - Principles', 'Ed Thorp - Kelly'],
    psychology: ['Kahneman - Thinking Fast and Slow', 'David Burns - Feeling Good'],
    strategy: ['Meadows - Thinking in Systems', 'Munger - Mental Models'],
    ethics: ['Marcus Aurelius - Meditations', 'Aristotle - Ethics'],
    learning: ['Ericsson - Deliberate Practice', 'Kolb - Experiential Learning'],
    default: ['Farnam Street Blog', 'LessWrong'],
  };

  const lowerDomain = domain.toLowerCase();
  for (const [key, sources] of Object.entries(sourceMap)) {
    if (lowerDomain.includes(key)) {
      return sources;
    }
  }
  return sourceMap.default;
}

function suggestCouncilMembers(domain: string): string[] {
  const memberMap: Record<string, string[]> = {
    risk: ['risk', 'financial', 'guardian'],
    finance: ['financial', 'risk', 'strategic'],
    psychology: ['guardian', 'ethics'],
    strategy: ['strategic', 'risk'],
    ethics: ['ethics', 'guardian'],
    learning: ['strategic', 'ethics'],
    default: ['strategic', 'guardian'],
  };

  const lowerDomain = domain.toLowerCase();
  for (const [key, members] of Object.entries(memberMap)) {
    if (lowerDomain.includes(key)) {
      return members;
    }
  }
  return memberMap.default;
}

function determinePillarForDomain(domain: string): 'LOGOS' | 'ETHOS' | 'PATHOS' {
  const lowerDomain = domain.toLowerCase();

  // LOGOS: reasoning, decision-making, analysis
  if (lowerDomain.includes('risk') || lowerDomain.includes('finance') ||
      lowerDomain.includes('strategy') || lowerDomain.includes('decision') ||
      lowerDomain.includes('analysis') || lowerDomain.includes('math')) {
    return 'LOGOS';
  }

  // ETHOS: character, discipline, psychology
  if (lowerDomain.includes('psychology') || lowerDomain.includes('bias') ||
      lowerDomain.includes('emotion') || lowerDomain.includes('discipline') ||
      lowerDomain.includes('character') || lowerDomain.includes('ethics')) {
    return 'ETHOS';
  }

  // PATHOS: growth, learning, wisdom
  if (lowerDomain.includes('learning') || lowerDomain.includes('growth') ||
      lowerDomain.includes('wisdom') || lowerDomain.includes('reflection') ||
      lowerDomain.includes('philosophy') || lowerDomain.includes('improvement')) {
    return 'PATHOS';
  }

  // Default to LOGOS
  return 'LOGOS';
}

// =============================================================================
// SELF-ASSESSMENT (Monthly)
// =============================================================================

/**
 * Run monthly self-assessment
 *
 * Comprehensive evaluation of cognitive performance.
 * Scheduled: Monthly on the 1st at 9 AM
 */
export async function runSelfAssessment(
  currentPeriodData: {
    reviews: PerformanceReview[];
    gapAnalyses: GapAnalysisResult[];
    decisionsCount: number;
    successRate: number;
    biasCount: number;
    insightsGenerated: number;
  },
  previousPeriodData: {
    decisionsCount: number;
    successRate: number;
    biasCount: number;
    insightsGenerated: number;
  }
): Promise<SelfAssessment> {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Decision quality analysis
  const decisionQualityChange = currentPeriodData.successRate - previousPeriodData.successRate;
  const decisionTrend: 'IMPROVING' | 'DECLINING' | 'STABLE' = decisionQualityChange > 0.05 ? 'IMPROVING' :
                        decisionQualityChange < -0.05 ? 'DECLINING' : 'STABLE';

  // Bias reduction analysis
  const biasReduction = previousPeriodData.biasCount - currentPeriodData.biasCount;

  // Knowledge growth
  const documentsAdded = currentPeriodData.gapAnalyses.reduce(
    (sum, ga) => sum + ga.newSourceSuggestions.length,
    0
  );

  // Learning velocity
  const insightsPerWeek = currentPeriodData.insightsGenerated / 4; // Approximate weeks

  // Framework effectiveness
  // TODO: Track actual framework usage
  const frameworkEffectiveness: Array<{
    framework: string;
    pillar: 'LOGOS' | 'ETHOS' | 'PATHOS';
    usageCount: number;
    successRate: number;
    impact: number;
    trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
  }> = [
    { framework: 'Bayesian Reasoning', pillar: 'LOGOS', usageCount: 10, successRate: 0.85, impact: 0.8, trend: 'STABLE' },
    { framework: 'Expected Value', pillar: 'LOGOS', usageCount: 15, successRate: 0.75, impact: 0.7, trend: 'IMPROVING' },
    { framework: 'Cognitive Bias Detection', pillar: 'ETHOS', usageCount: 20, successRate: 0.90, impact: 0.9, trend: 'STABLE' },
  ];

  // Calculate overall improvement
  const improvements = [
    decisionQualityChange,
    biasReduction / Math.max(1, previousPeriodData.biasCount),
    (currentPeriodData.insightsGenerated - previousPeriodData.insightsGenerated) / Math.max(1, previousPeriodData.insightsGenerated),
  ];
  const overallImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;

  // Calculate grade
  const grade = overallImprovement > 0.2 ? 'A' :
                overallImprovement > 0.1 ? 'B' :
                overallImprovement > 0 ? 'C' :
                overallImprovement > -0.1 ? 'D' : 'F';

  // Generate recommendations
  const recommendations: string[] = [];

  if (decisionTrend === 'DECLINING') {
    recommendations.push('Decision quality declining - review decision-making process');
  }
  if (currentPeriodData.biasCount > previousPeriodData.biasCount) {
    recommendations.push('Bias occurrences increasing - increase bias check frequency');
  }
  if (insightsPerWeek < 2) {
    recommendations.push('Low insight generation - increase reflection practice');
  }

  // Determine most common bias
  const allReviews = currentPeriodData.reviews;
  const allBiases = allReviews.flatMap(r => Object.entries(r.biasesDetected.byType));
  const biasTotals: Record<string, number> = {};
  for (const [bias, count] of allBiases) {
    biasTotals[bias] = (biasTotals[bias] || 0) + count;
  }
  const mostCommonBias = Object.entries(biasTotals).sort((a, b) => b[1] - a[1])[0]?.[0] as CognitiveBias || 'CONFIRMATION_BIAS';

  const result: SelfAssessment = {
    period: {
      start: thisMonthStart,
      end: now,
      previousStart: lastMonthStart,
      previousEnd: lastMonthEnd,
    },
    decisionQuality: {
      thisPeriod: currentPeriodData.successRate,
      lastPeriod: previousPeriodData.successRate,
      change: decisionQualityChange,
      trend: decisionTrend,
    },
    biasReduction: {
      biasesThisPeriod: currentPeriodData.biasCount,
      biasesLastPeriod: previousPeriodData.biasCount,
      reduction: biasReduction,
      reductionPercentage: previousPeriodData.biasCount > 0 ? (biasReduction / previousPeriodData.biasCount) * 100 : 0,
      mostCommonBias,
    },
    knowledgeGrowth: {
      gapsResolved: 0, // TODO: Track from gap analysis
      documentsAdded,
      sourcesAdded: documentsAdded,
      queriesAnswered: currentPeriodData.decisionsCount * 2, // Estimate
      querySuccessRate: currentPeriodData.successRate,
    },
    learningVelocity: {
      insightsPerWeek,
      principlesExtracted: Math.floor(currentPeriodData.insightsGenerated * 0.3),
      transferLearnings: Math.floor(currentPeriodData.insightsGenerated * 0.2),
      retentionRate: 0.85, // TODO: Track actual retention
    },
    frameworkEffectiveness,
    overallImprovement,
    grade,
    gradeExplanation: generateGradeExplanation(grade, overallImprovement, decisionTrend),
    strengths: generateStrengths(currentPeriodData, previousPeriodData),
    weaknesses: generateWeaknesses(currentPeriodData, previousPeriodData),
    recommendations,
    nextMonthFocus: generateNextMonthFocus(recommendations),
    timestamp: now,
  };

  function generateGradeExplanation(g: string, improvement: number, _trend: string): string {
    if (g === 'A') return `Excellent performance with ${(improvement * 100).toFixed(1)}% improvement`;
    if (g === 'B') return `Good progress with ${(improvement * 100).toFixed(1)}% improvement`;
    if (g === 'C') return `Moderate performance with stable metrics`;
    if (g === 'D') return `Below expectations with some declining metrics`;
    return `Significant decline requires immediate attention`;
  }

  function generateStrengths(current: typeof currentPeriodData, previous: typeof previousPeriodData): string[] {
    const strengths: string[] = [];
    if (current.successRate > 0.8) strengths.push('High decision success rate');
    if (current.biasCount < previous.biasCount) strengths.push('Reduced cognitive bias occurrences');
    if (current.insightsGenerated > previous.insightsGenerated) strengths.push('Increased insight generation');
    if (strengths.length === 0) strengths.push('Consistent performance');
    return strengths;
  }

  function generateWeaknesses(current: typeof currentPeriodData, previous: typeof previousPeriodData): string[] {
    const weaknesses: string[] = [];
    if (current.successRate < 0.6) weaknesses.push('Decision success rate below target');
    if (current.biasCount > previous.biasCount) weaknesses.push('Increased bias occurrences');
    if (current.insightsGenerated < previous.insightsGenerated * 0.8) weaknesses.push('Reduced insight generation');
    if (weaknesses.length === 0) weaknesses.push('No major weaknesses identified');
    return weaknesses;
  }

  function generateNextMonthFocus(recs: string[]): string[] {
    return recs.slice(0, 3).map(r => r.replace('- ', ''));
  }

  // Update state
  learningState.lastAssessment = now;
  learningState.currentStage = 'SELF_ASSESSMENT';

  // Emit event
  eventBus.emit('audit:log', {
    action: 'learning:self_assessment',
    agent: 'Learning',
    trustLevel: 'system',
    details: {
      grade,
      overallImprovement,
      trend: decisionTrend,
      recommendationCount: recommendations.length,
    },
  });

  return result;
}

// =============================================================================
// INSIGHT MANAGEMENT
// =============================================================================

/**
 * Add an insight to the learning system
 */
export function addInsight(insight: Insight): void {
  learningState.insights.push(insight);

  eventBus.emit('audit:log', {
    action: 'learning:insight_generated',
    agent: 'Learning',
    trustLevel: 'system',
    details: {
      insightId: insight.id,
      type: insight.type,
      framework: insight.framework,
      generalizes: insight.generalizes,
    },
  });
}

/**
 * Get recent insights
 */
export function getRecentInsights(limit: number = 10): Insight[] {
  return learningState.insights
    .slice(-limit)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Get insights by type
 */
export function getInsightsByType(type: Insight['type']): Insight[] {
  return learningState.insights.filter(i => i.type === type);
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  PerformanceReview,
  GapAnalysisResult,
  KnowledgeGap,
  SelfAssessment,
  Insight,
  LearningProgress,
};
