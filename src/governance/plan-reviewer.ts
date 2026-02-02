import type { Arbiter } from './arbiter.js';
import type { Overseer } from './overseer.js';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { AgentId, ReasoningTrace, ReasoningStep } from '../kernel/types.js';

/**
 * A task within a plan
 */
export interface PlanTask {
  id: string;
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  assigned_to?: AgentId;
}

/**
 * A plan to be reviewed
 */
export interface Plan {
  id: string;
  name: string;
  description: string;
  tasks: PlanTask[];
  created_by: AgentId;
  created_at: Date;
}

/**
 * Review types that can be performed
 */
export type ReviewType = 'constitutional' | 'quality' | 'feasibility' | 'expert';

/**
 * A single review result
 */
export interface PlanReview {
  planId: string;
  reviewer: AgentId;
  reviewType: ReviewType;
  passed: boolean;
  score: number;           // 0-100
  tips: string[];          // Boris-style tips
  concerns: string[];
  recommendations: string[];
  blockers: string[];      // Must fix before approval
  reasoning: ReasoningTrace;
}

/**
 * Review pipeline status
 */
export type ReviewPipelineStatus = 'pending_review' | 'in_review' | 'approved' | 'rejected' | 'needs_revision';

/**
 * Review pipeline for a plan
 */
export interface ReviewPipeline {
  planId: string;
  status: ReviewPipelineStatus;
  reviews: PlanReview[];
  requiredReviews: ReviewType[];
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
}

/**
 * Options for reviewing a plan
 */
export interface ReviewOptions {
  requireExpertReview?: boolean;
  expertReviewer?: AgentId;
  skipQuality?: boolean;
}

// Boris-style tips for common plan issues
const BORIS_TIPS = {
  complexity: [
    'Start with the simplest interpretation, validate understanding before proceeding.',
    'If this goes sideways, stop and re-plan immediately.',
    'Consider breaking this into smaller, independently verifiable steps.',
  ],
  dependencies: [
    'Validate dependencies exist before starting dependent tasks.',
    'Add fallback steps for critical dependencies.',
    'Consider parallel execution where dependencies allow.',
  ],
  testing: [
    'Prove to me this works before marking done.',
    'Add regression tests for critical paths.',
    'Diff behavior between main and your changes.',
  ],
  quality: [
    'Knowing everything you know now, is there a more elegant solution?',
    'Grill yourself on these changes before presenting.',
    'What could go wrong? Add defensive checks.',
  ],
};

/**
 * PlanReviewer - Review pipeline for plans before execution
 * 
 * Based on Boris Cherny's (Claude Code creator) patterns:
 * - Constitutional Review: Check against hard invariants (Arbiter)
 * - Quality Review: Check against quality gates (Overseer)
 * - Expert Review: Optional senior engineer perspective
 * 
 * Plans must pass all required reviews before execution.
 */
export class PlanReviewer {
  private readonly arbiter: Arbiter;
  private readonly overseer: Overseer;
  private readonly eventBus: EventBus;
  private readonly auditLogger: AuditLogger;
  private pipelines = new Map<string, ReviewPipeline>();

  constructor(
    arbiter: Arbiter,
    overseer: Overseer,
    eventBus: EventBus,
    auditLogger: AuditLogger
  ) {
    this.arbiter = arbiter;
    this.overseer = overseer;
    this.eventBus = eventBus;
    this.auditLogger = auditLogger;
  }

  /**
   * Review a plan through the full pipeline
   */
  async reviewPlan(plan: Plan, options: ReviewOptions = {}): Promise<ReviewPipeline> {
    const pipeline: ReviewPipeline = {
      planId: plan.id,
      status: 'in_review',
      reviews: [],
      requiredReviews: ['constitutional'],
    };

    if (!options.skipQuality) {
      pipeline.requiredReviews.push('quality');
    }

    if (options.requireExpertReview) {
      pipeline.requiredReviews.push('expert');
    }

    this.pipelines.set(plan.id, pipeline);

    this.eventBus.emit('plan:review_started', {
      planId: plan.id,
      requiredReviews: pipeline.requiredReviews,
    });

    // 1. Constitutional Review (Arbiter) - REQUIRED
    const constitutionalReview = await this.constitutionalReview(plan);
    pipeline.reviews.push(constitutionalReview);

    if (constitutionalReview.blockers.length > 0) {
      pipeline.status = 'rejected';
      pipeline.rejectedAt = new Date();
      pipeline.rejectionReason = `Constitutional violation: ${constitutionalReview.blockers.join(', ')}`;

      await this.auditLogger.log('plan:review_rejected', 'arbiter', 'system', {
        planId: plan.id,
        reason: pipeline.rejectionReason,
        review: {
          type: constitutionalReview.reviewType,
          score: constitutionalReview.score,
          blockers: constitutionalReview.blockers,
        },
      }, constitutionalReview.reasoning);

      this.eventBus.emit('plan:review_rejected', {
        planId: plan.id,
        reason: pipeline.rejectionReason,
      });

      return pipeline;
    }

    // 2. Quality Review (Overseer) - Usually required
    if (pipeline.requiredReviews.includes('quality')) {
      const qualityReview = await this.qualityReview(plan);
      pipeline.reviews.push(qualityReview);

      if (qualityReview.score < 70) {
        pipeline.status = 'needs_revision';

        await this.auditLogger.log('plan:review_needs_revision', 'overseer', 'system', {
          planId: plan.id,
          score: qualityReview.score,
          concerns: qualityReview.concerns,
        }, qualityReview.reasoning);

        this.eventBus.emit('plan:review_needs_revision', {
          planId: plan.id,
          concerns: qualityReview.concerns,
          tips: qualityReview.tips,
        });

        return pipeline;
      }
    }

    // 3. Expert Review (optional)
    if (pipeline.requiredReviews.includes('expert')) {
      const expertReview = await this.expertReview(plan, options.expertReviewer);
      pipeline.reviews.push(expertReview);

      if (!expertReview.passed) {
        pipeline.status = 'needs_revision';

        await this.auditLogger.log('plan:expert_review_failed', expertReview.reviewer, 'system', {
          planId: plan.id,
          concerns: expertReview.concerns,
        }, expertReview.reasoning);

        return pipeline;
      }
    }

    // All reviews passed
    pipeline.status = 'approved';
    pipeline.approvedAt = new Date();

    await this.auditLogger.log('plan:review_approved', 'overseer', 'system', {
      planId: plan.id,
      reviews: pipeline.reviews.map(r => ({
        type: r.reviewType,
        score: r.score,
        passed: r.passed,
      })),
    });

    this.eventBus.emit('plan:review_approved', {
      planId: plan.id,
      approvedAt: pipeline.approvedAt,
    });

    return pipeline;
  }

  /**
   * Constitutional review using the Arbiter
   */
  private constitutionalReview(plan: Plan): Promise<PlanReview> {
    const blockers: string[] = [];
    const concerns: string[] = [];
    const tips: string[] = [];
    const steps: ReasoningStep[] = [];

    // Check each task against constitutional rules
    for (const task of plan.tasks) {
      steps.push({
        step: `Evaluate task: ${task.name}`,
        observation: `Task description: ${task.description.slice(0, 100)}...`,
        interpretation: 'Checking against constitutional rules',
        action: 'Run Arbiter evaluation',
      });

      const evaluation = this.arbiter.evaluateAction(task.name, {
        taskDescription: task.description,
        priority: task.priority,
        dependencies: task.dependencies,
      });

      if (!evaluation.allowed) {
        blockers.push(`Task "${task.name}": ${evaluation.violations.join(', ')}`);
        steps.push({
          step: `Constitutional violation in task: ${task.name}`,
          observation: `Violations: ${evaluation.violations.join(', ')}`,
          interpretation: 'Task cannot proceed - constitutional rules violated',
          action: 'Block plan execution',
        });
      } else {
        steps.push({
          step: `Task "${task.name}" passes constitutional check`,
          observation: 'No violations detected',
          interpretation: 'Task complies with all constitutional rules',
          action: 'Proceed to next task',
        });
      }
    }

    // Generate tips based on plan characteristics
    if (plan.tasks.some(t => t.priority === 'critical')) {
      tips.push(...BORIS_TIPS.dependencies);
    }

    if (plan.tasks.length > 5) {
      tips.push(...BORIS_TIPS.complexity);
    }

    const passed = blockers.length === 0;

    return Promise.resolve({
      planId: plan.id,
      reviewer: 'arbiter',
      reviewType: 'constitutional',
      passed,
      score: passed ? 100 : 0,
      tips,
      concerns,
      recommendations: [],
      blockers,
      reasoning: {
        decision: passed ? 'APPROVE' : 'REJECT',
        alternatives: ['APPROVE', 'REJECT'],
        chosen: passed ? 'APPROVE' : 'REJECT',
        rationale: passed
          ? `All ${plan.tasks.length} tasks comply with constitutional rules.`
          : `Found ${blockers.length} constitutional violations that must be fixed.`,
        confidence: 1,
        steps,
      },
    });
  }

  /**
   * Quality review using the Overseer's perspective
   */
  private qualityReview(plan: Plan): Promise<PlanReview> {
    const concerns: string[] = [];
    const tips: string[] = [];
    const recommendations: string[] = [];
    const steps: ReasoningStep[] = [];
    let score = 100;

    // Check 1: Plan has tasks
    steps.push({
      step: 'Check plan has tasks',
      observation: `Plan has ${plan.tasks.length} tasks`,
      interpretation: plan.tasks.length > 0 ? 'Plan has content' : 'Plan is empty',
      action: plan.tasks.length > 0 ? 'Continue' : 'Penalize score',
    });

    if (plan.tasks.length === 0) {
      concerns.push('Plan has no tasks');
      score -= 50;
    }

    // Check 2: Dependencies exist
    const taskIds = new Set(plan.tasks.map(t => t.id));
    for (const task of plan.tasks) {
      for (const depId of task.dependencies) {
        if (!taskIds.has(depId)) {
          concerns.push(`Task "${task.name}" has missing dependency: ${depId}`);
          score -= 10;
        }
      }
    }

    steps.push({
      step: 'Check dependency integrity',
      observation: `Checked ${plan.tasks.reduce((sum, t) => sum + t.dependencies.length, 0)} dependencies`,
      interpretation: concerns.length === 0 ? 'All dependencies valid' : `Found ${concerns.length} issues`,
      action: 'Continue',
    });

    // Check 3: Critical tasks have fallbacks
    const criticalTasks = plan.tasks.filter(t => t.priority === 'critical');
    if (criticalTasks.length > 0) {
      const hasFallbacks = plan.tasks.some(t =>
        t.name.toLowerCase().includes('fallback') ||
        t.description.toLowerCase().includes('fallback')
      );

      if (!hasFallbacks) {
        recommendations.push('Consider adding fallback tasks for critical operations');
        tips.push(...BORIS_TIPS.dependencies);
      }
    }

    // Check 4: Reasonable task count
    if (plan.tasks.length > 10) {
      recommendations.push('Large plan detected. Consider breaking into phases.');
      tips.push(...BORIS_TIPS.complexity);
      score -= 5;
    }

    // Check 5: All tasks have descriptions
    const missingDescriptions = plan.tasks.filter(t => !t.description || t.description.length < 10);
    if (missingDescriptions.length > 0) {
      concerns.push(`${missingDescriptions.length} tasks lack adequate descriptions`);
      score -= missingDescriptions.length * 5;
    }

    // Generate final tips
    tips.push(...BORIS_TIPS.quality);

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    return Promise.resolve({
      planId: plan.id,
      reviewer: 'overseer',
      reviewType: 'quality',
      passed: score >= 70,
      score,
      tips: [...new Set(tips)], // Dedupe
      concerns,
      recommendations,
      blockers: [],
      reasoning: {
        decision: score >= 70 ? 'APPROVE' : 'NEEDS_REVISION',
        alternatives: ['APPROVE', 'NEEDS_REVISION'],
        chosen: score >= 70 ? 'APPROVE' : 'NEEDS_REVISION',
        rationale: `Quality score: ${score}/100. ${concerns.length} concerns, ${recommendations.length} recommendations.`,
        confidence: 0.9,
        steps,
      },
    });
  }

  /**
   * Expert review - simulated senior engineer perspective
   */
  private expertReview(plan: Plan, reviewer?: AgentId): Promise<PlanReview> {
    const tips: string[] = [];
    const recommendations: string[] = [];
    const steps: ReasoningStep[] = [];

    // Simulate expert (staff engineer) review
    steps.push({
      step: 'Expert review initialization',
      observation: `Reviewer: ${reviewer || 'integrator'}`,
      interpretation: 'Applying senior engineering perspective',
      action: 'Analyze plan holistically',
    });

    // Check for common issues experts would catch

    // 1. Adequate testing consideration
    const hasTestingTask = plan.tasks.some(t =>
      t.name.toLowerCase().includes('test') ||
      t.description.toLowerCase().includes('test')
    );

    if (!hasTestingTask) {
      recommendations.push('Add explicit testing tasks or criteria');
      tips.push(...BORIS_TIPS.testing);
    }

    // 2. Rollback consideration
    const hasRollback = plan.tasks.some(t =>
      t.name.toLowerCase().includes('rollback') ||
      t.description.toLowerCase().includes('revert')
    );

    if (!hasRollback && plan.tasks.some(t => t.priority === 'critical')) {
      recommendations.push('Consider adding rollback plan for critical changes');
    }

    // 3. Documentation
    const hasDocTask = plan.tasks.some(t =>
      t.name.toLowerCase().includes('document') ||
      t.description.toLowerCase().includes('document')
    );

    if (!hasDocTask && plan.tasks.length > 3) {
      recommendations.push('Consider adding documentation task');
    }

    // 4. Security review for sensitive operations
    const hasSensitiveOps = plan.tasks.some(t =>
      t.description.toLowerCase().includes('secret') ||
      t.description.toLowerCase().includes('credential') ||
      t.description.toLowerCase().includes('password') ||
      t.description.toLowerCase().includes('api key')
    );

    if (hasSensitiveOps) {
      recommendations.push('Sensitive operations detected - ensure security review');
    }

    steps.push({
      step: 'Expert assessment complete',
      observation: `${recommendations.length} recommendations`,
      interpretation: recommendations.length < 3 ? 'Plan is well-structured' : 'Plan needs some improvements',
      action: recommendations.length < 5 ? 'Approve with recommendations' : 'Request revision',
    });

    const passed = recommendations.length < 5;
    const score = Math.max(0, 100 - (recommendations.length * 10));

    return Promise.resolve({
      planId: plan.id,
      reviewer: reviewer || 'integrator',
      reviewType: 'expert',
      passed,
      score,
      tips,
      concerns: [],
      recommendations,
      blockers: [],
      reasoning: {
        decision: passed ? 'APPROVE_WITH_RECOMMENDATIONS' : 'NEEDS_REVISION',
        alternatives: ['APPROVE', 'APPROVE_WITH_RECOMMENDATIONS', 'NEEDS_REVISION'],
        chosen: passed ? 'APPROVE_WITH_RECOMMENDATIONS' : 'NEEDS_REVISION',
        rationale: `Expert review found ${recommendations.length} areas for improvement. Plan is ${passed ? 'acceptable' : 'needs work'}.`,
        confidence: 0.85,
        steps,
      },
    });
  }

  /**
   * Get review pipeline for a plan
   */
  getPipeline(planId: string): ReviewPipeline | undefined {
    return this.pipelines.get(planId);
  }

  /**
   * Get all pipelines
   */
  getAllPipelines(): ReviewPipeline[] {
    return Array.from(this.pipelines.values());
  }

  /**
   * Clear completed pipelines older than a threshold
   */
  clearOldPipelines(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleared = 0;

    for (const [planId, pipeline] of this.pipelines.entries()) {
      if (pipeline.status === 'approved' || pipeline.status === 'rejected') {
        const timestamp = pipeline.approvedAt || pipeline.rejectedAt;
        if (timestamp && (now - timestamp.getTime()) > maxAgeMs) {
          this.pipelines.delete(planId);
          cleared++;
        }
      }
    }

    return cleared;
  }

  /**
   * Get statistics about reviews
   */
  getStats(): {
    totalPipelines: number;
    byStatus: Record<ReviewPipelineStatus, number>;
    avgScore: number;
    approvalRate: number;
  } {
    const pipelines = Array.from(this.pipelines.values());
    const byStatus: Record<ReviewPipelineStatus, number> = {
      pending_review: 0,
      in_review: 0,
      approved: 0,
      rejected: 0,
      needs_revision: 0,
    };

    let totalScore = 0;
    let scoreCount = 0;

    for (const pipeline of pipelines) {
      byStatus[pipeline.status]++;
      for (const review of pipeline.reviews) {
        totalScore += review.score;
        scoreCount++;
      }
    }

    const completed = byStatus.approved + byStatus.rejected;

    return {
      totalPipelines: pipelines.length,
      byStatus,
      avgScore: scoreCount > 0 ? totalScore / scoreCount : 0,
      approvalRate: completed > 0 ? byStatus.approved / completed : 0,
    };
  }
}
