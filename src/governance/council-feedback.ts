/**
 * Council Feedback Loop — User Feedback Integration
 *
 * Bridges user feedback about decision outcomes to the Council's OutcomeTracker.
 * When a vote closes, the system can request user feedback on the decision quality.
 * This feedback directly updates member credibility scores.
 *
 * Flow:
 * 1. Vote closes → FeedbackManager.requestFeedback() determines significance
 * 2. User provides rating (-1 to +1) and optional comment
 * 3. FeedbackManager submits to OutcomeTracker
 * 4. OutcomeTracker updates member credibility based on how they voted
 *
 * Significance Levels (auto-assigned):
 * - **critical**: UNANIMOUS threshold OR veto exercised OR critical risk
 * - **high**: SUPERMAJORITY threshold OR high risk OR close vote (margin < 3)
 * - **medium**: MAJORITY with clear result
 * - **low**: Low risk, wide margin
 *
 * @module governance/council-feedback
 * @since 2.2.0
 */

import type { AgentId, CouncilPillar } from '../kernel/types.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { AuditLogger } from '../kernel/audit.js';
import { VOTING_AGENTS } from '../kernel/types.js';
import type { DecisionOutcome, MemberCredibility } from './council-deliberation.js';
import { OutcomeTracker } from './council-deliberation.js';
import { COUNCIL_MEMBERS } from './council-members.js';

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Significance level for feedback requests.
 * Determines how urgently we need user input.
 */
export type FeedbackSignificance = 'critical' | 'high' | 'medium' | 'low';

/**
 * A request for user feedback on a decision outcome.
 */
export interface FeedbackRequest {
  voteId: string;
  topic: string;
  decision: 'PASSED' | 'FAILED' | 'VETOED' | 'EXPIRED' | 'OVERTURNED';
  domains: string[];
  significance: FeedbackSignificance;
  requestedAt: string;
  resolvedAt?: string;
  rating?: number;       // -1 (terrible) to +1 (excellent)
  comment?: string;
  memberVotes: Record<string, string>; // agentId -> vote option
}

/**
 * Summary statistics for feedback.
 */
export interface FeedbackStats {
  pending: number;
  resolved: number;
  averageRating: number;
  ratingDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  avgResponseTime: number; // ms between request and resolution
}

/**
 * Enriched credibility report with member metadata.
 */
export interface CredibilityReport extends MemberCredibility {
  pillar: CouncilPillar;
  avatar: string;
  trend: 'improving' | 'stable' | 'declining';
}

// ── Feedback Manager ───────────────────────────────────────────────────────

/**
 * Manages the user feedback loop for Council decisions.
 *
 * This bridges user-provided outcome quality ratings to the OutcomeTracker,
 * enabling the Council to learn from real-world results over time.
 */
export class FeedbackManager {
  private pendingFeedback: Map<string, FeedbackRequest> = new Map();
  private resolvedFeedback: FeedbackRequest[] = [];

  constructor(
    private eventBus: EventBus,
    private auditLogger: AuditLogger,
    private outcomeTracker: OutcomeTracker,
  ) {}

  /**
   * Request user feedback for a closed vote.
   *
   * Automatically determines significance based on:
   * - Vote threshold (SUPERMAJORITY/UNANIMOUS → high/critical)
   * - Risk level (from proposal analysis)
   * - Vote margin (close votes → higher significance)
   * - Veto exercise (always high)
   *
   * @param params Configuration for feedback request
   * @returns The created FeedbackRequest
   */
  requestFeedback(params: {
    voteId: string;
    topic: string;
    decision: 'PASSED' | 'FAILED' | 'VETOED' | 'EXPIRED' | 'OVERTURNED';
    domains: string[];
    threshold?: 'MAJORITY' | 'SUPERMAJORITY' | 'UNANIMOUS';
    risk?: 'low' | 'medium' | 'high' | 'critical';
    memberVotes: Record<string, string>;
    approveCount?: number;
    rejectCount?: number;
  }): FeedbackRequest {
    // Calculate significance
    const significance = this.calculateSignificance({
      threshold: params.threshold ?? 'MAJORITY',
      risk: params.risk ?? 'medium',
      decision: params.decision,
      approveCount: params.approveCount ?? 0,
      rejectCount: params.rejectCount ?? 0,
    });

    const request: FeedbackRequest = {
      voteId: params.voteId,
      topic: params.topic,
      decision: params.decision,
      domains: params.domains,
      significance,
      requestedAt: new Date().toISOString(),
      memberVotes: params.memberVotes,
    };

    this.pendingFeedback.set(params.voteId, request);

    this.eventBus.emit('council:feedback_requested', {
      voteId: params.voteId,
      topic: params.topic,
      decision: params.decision,
      significance,
      timestamp: new Date(),
    });

    void this.auditLogger.log(
      'council:feedback_requested',
      'system',
      'system',
      {
        vote_id: params.voteId,
        topic: params.topic,
        decision: params.decision,
        significance,
        domain_count: params.domains.length,
      },
    );

    return request;
  }

  /**
   * Submit user feedback for a vote.
   *
   * Records the feedback and updates OutcomeTracker with the outcome quality.
   * This triggers credibility updates for all members who voted.
   *
   * @param voteId The vote to provide feedback for
   * @param rating Outcome quality from -1 (terrible) to +1 (excellent)
   * @param comment Optional user comment
   * @returns true if feedback was successfully recorded
   */
  submitFeedback(voteId: string, rating: number, comment?: string): boolean {
    const request = this.pendingFeedback.get(voteId);
    if (!request) {
      return false;
    }

    // Clamp rating to [-1, 1]
    const clampedRating = Math.max(-1, Math.min(1, rating));

    // Update the request
    request.rating = clampedRating;
    request.comment = comment;
    request.resolvedAt = new Date().toISOString();

    // Move to resolved
    this.pendingFeedback.delete(voteId);
    this.resolvedFeedback.push(request);

    // Create DecisionOutcome for OutcomeTracker
    const outcome: DecisionOutcome = {
      voteId: request.voteId,
      topic: request.topic,
      decision: request.decision as 'PASSED' | 'FAILED' | 'VETOED' | 'EXPIRED',
      outcomeQuality: clampedRating,
      outcomeDescription: comment ?? 'User feedback',
      memberVotes: this.convertMemberVotes(request.memberVotes),
      recordedAt: new Date(),
    };

    // Record in OutcomeTracker (this updates credibility)
    this.outcomeTracker.recordOutcome(outcome);

    this.eventBus.emit('council:feedback_submitted', {
      voteId,
      rating: clampedRating,
      comment,
      decision: request.decision,
      significance: request.significance,
      timestamp: new Date(),
    });

    void this.auditLogger.log(
      'council:feedback_submitted',
      'operator',
      'operator',
      {
        vote_id: voteId,
        rating: clampedRating,
        comment: comment ?? null,
        decision: request.decision,
        significance: request.significance,
      },
    );

    return true;
  }

  /**
   * Get all pending feedback requests, sorted by significance.
   */
  getPendingFeedback(): FeedbackRequest[] {
    const significanceOrder: Record<FeedbackSignificance, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return Array.from(this.pendingFeedback.values()).sort(
      (a, b) => significanceOrder[a.significance] - significanceOrder[b.significance]
    );
  }

  /**
   * Get resolved feedback, most recent first.
   *
   * @param limit Optional limit on number of results
   */
  getResolvedFeedback(limit?: number): FeedbackRequest[] {
    const sorted = [...this.resolvedFeedback].sort((a, b) => {
      const timeA = a.resolvedAt ? new Date(a.resolvedAt).getTime() : 0;
      const timeB = b.resolvedAt ? new Date(b.resolvedAt).getTime() : 0;
      return timeB - timeA; // most recent first
    });

    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get summary statistics for feedback.
   */
  getFeedbackStats(): FeedbackStats {
    const resolved = this.resolvedFeedback.filter(r => r.rating !== undefined);

    let totalRating = 0;
    let positive = 0;
    let neutral = 0;
    let negative = 0;
    let totalResponseTime = 0;

    for (const r of resolved) {
      if (r.rating !== undefined) {
        totalRating += r.rating;

        if (r.rating > 0.2) positive++;
        else if (r.rating < -0.2) negative++;
        else neutral++;
      }

      if (r.requestedAt && r.resolvedAt) {
        const requestTime = new Date(r.requestedAt).getTime();
        const resolveTime = new Date(r.resolvedAt).getTime();
        totalResponseTime += resolveTime - requestTime;
      }
    }

    return {
      pending: this.pendingFeedback.size,
      resolved: resolved.length,
      averageRating: resolved.length > 0 ? totalRating / resolved.length : 0,
      ratingDistribution: { positive, neutral, negative },
      avgResponseTime: resolved.length > 0 ? totalResponseTime / resolved.length : 0,
    };
  }

  /**
   * Get credibility report with enriched member data.
   *
   * Wraps OutcomeTracker.getAllCredibility() with additional metadata:
   * - Member pillar
   * - Member avatar
   * - Trend (improving/stable/declining based on streak)
   */
  getCredibilityReport(): CredibilityReport[] {
    const allCredibility = this.outcomeTracker.getAllCredibility();

    return allCredibility.map(cred => {
      const member = COUNCIL_MEMBERS[cred.agentId];

      // Determine trend from streak
      let trend: 'improving' | 'stable' | 'declining';
      if (cred.streak >= 3) trend = 'improving';
      else if (cred.streak <= -3) trend = 'declining';
      else trend = 'stable';

      return {
        ...cred,
        pillar: member?.pillar ?? 'infrastructure',
        avatar: member?.avatar ?? '?',
        trend,
      };
    });
  }

  /**
   * Calculate feedback significance based on vote characteristics.
   */
  private calculateSignificance(params: {
    threshold: 'MAJORITY' | 'SUPERMAJORITY' | 'UNANIMOUS';
    risk: 'low' | 'medium' | 'high' | 'critical';
    decision: string;
    approveCount: number;
    rejectCount: number;
  }): FeedbackSignificance {
    const { threshold, risk, decision, approveCount, rejectCount } = params;

    // Critical: UNANIMOUS threshold OR veto OR critical risk
    if (
      threshold === 'UNANIMOUS' ||
      decision === 'VETOED' ||
      risk === 'critical'
    ) {
      return 'critical';
    }

    // High: SUPERMAJORITY OR high risk OR close vote (margin < 3)
    const margin = Math.abs(approveCount - rejectCount);
    if (
      threshold === 'SUPERMAJORITY' ||
      risk === 'high' ||
      margin < 3
    ) {
      return 'high';
    }

    // Medium: MAJORITY with clear result
    if (threshold === 'MAJORITY' && margin >= 3) {
      return 'medium';
    }

    // Low: Everything else (low risk, wide margin)
    return 'low';
  }

  /**
   * Convert string votes to typed vote options for OutcomeTracker.
   */
  private convertMemberVotes(
    memberVotes: Record<string, string>
  ): Partial<Record<AgentId, 'APPROVE' | 'REJECT' | 'ABSTAIN'>> {
    const result: Partial<Record<AgentId, 'APPROVE' | 'REJECT' | 'ABSTAIN'>> = {};

    for (const [agentId, voteStr] of Object.entries(memberVotes)) {
      if (!VOTING_AGENTS.includes(agentId as AgentId)) continue;

      const upperVote = voteStr.toUpperCase();
      if (
        upperVote === 'APPROVE' ||
        upperVote === 'REJECT' ||
        upperVote === 'ABSTAIN'
      ) {
        result[agentId as AgentId] = upperVote as 'APPROVE' | 'REJECT' | 'ABSTAIN';
      }
    }

    return result;
  }
}
