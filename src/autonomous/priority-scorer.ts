/**
 * ARI Priority Scoring Engine
 *
 * Multi-factor priority scoring that replaces static category→priority mapping.
 * Evaluates notifications using 5 weighted factors:
 *   Score = (Urgency × 0.30) + (Impact × 0.25) + (TimeSensitivity × 0.20)
 *         + (UserRelevance × 0.15) + (ContextModifier × 0.10)
 *
 * Score ranges map to priority levels:
 *   >= 0.80 → P0 (immediate, all channels, bypasses quiet hours)
 *   >= 0.60 → P1 (push notification with sound during active hours)
 *   >= 0.40 → P2 (silent push during active hours)
 *   >= 0.20 → P3 (batch into next digest)
 *   <  0.20 → P4 (log only, never push)
 *
 * Replaces the static CATEGORY_PRIORITIES mapping in NotificationManager.
 * Incorporates the council voting pattern from AlertSystem into weighted factors.
 */

import type { NotificationCategory } from './notification-manager.js';
import type { NotificationPriority } from './types.js';

// ─── Factor Definitions ───────────────────────────────────────────────────────

export interface CategoryDefaults {
  urgency: number;       // [0, 1] — How time-critical is this?
  impact: number;        // [0, 1] — How much does this affect Pryce's life?
  timeSensitivity: number; // [0, 1] — Does value decay rapidly?
  decayProfile: DecayProfile;
}

export type DecayProfile = 'perishable' | 'short' | 'day' | 'persistent';

/** Half-life in milliseconds for each decay profile */
const DECAY_HALF_LIFE_MS: Record<DecayProfile, number> = {
  perishable: 30 * 60 * 1000,       // 30 minutes
  short: 4 * 60 * 60 * 1000,        // 4 hours
  day: 24 * 60 * 60 * 1000,         // 24 hours
  persistent: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ─── Category Default Scores ──────────────────────────────────────────────────

const CATEGORY_DEFAULTS: Record<NotificationCategory, CategoryDefaults> = {
  security:    { urgency: 1.0, impact: 1.0, timeSensitivity: 1.0, decayProfile: 'perishable' },
  error:       { urgency: 0.7, impact: 0.7, timeSensitivity: 0.7, decayProfile: 'short' },
  budget:      { urgency: 0.8, impact: 0.7, timeSensitivity: 0.6, decayProfile: 'day' },
  opportunity: { urgency: 0.8, impact: 0.6, timeSensitivity: 0.9, decayProfile: 'perishable' },
  question:    { urgency: 0.8, impact: 0.7, timeSensitivity: 0.6, decayProfile: 'short' },
  milestone:   { urgency: 0.2, impact: 0.3, timeSensitivity: 0.1, decayProfile: 'persistent' },
  insight:     { urgency: 0.2, impact: 0.4, timeSensitivity: 0.1, decayProfile: 'persistent' },
  reminder:    { urgency: 0.5, impact: 0.4, timeSensitivity: 0.7, decayProfile: 'short' },
  finance:     { urgency: 0.5, impact: 0.7, timeSensitivity: 0.4, decayProfile: 'day' },
  task:        { urgency: 0.3, impact: 0.3, timeSensitivity: 0.3, decayProfile: 'day' },
  daily:       { urgency: 0.3, impact: 0.3, timeSensitivity: 0.3, decayProfile: 'day' },
  system:      { urgency: 0.3, impact: 0.3, timeSensitivity: 0.2, decayProfile: 'day' },
  billing:     { urgency: 0.4, impact: 0.5, timeSensitivity: 0.4, decayProfile: 'day' },
  value:       { urgency: 0.1, impact: 0.2, timeSensitivity: 0.1, decayProfile: 'persistent' },
  adaptive:    { urgency: 0.1, impact: 0.2, timeSensitivity: 0.1, decayProfile: 'persistent' },
  governance:  { urgency: 0.6, impact: 0.7, timeSensitivity: 0.5, decayProfile: 'short' },
};

// ─── Scoring Weights ──────────────────────────────────────────────────────────

const WEIGHTS = {
  urgency: 0.30,
  impact: 0.25,
  timeSensitivity: 0.20,
  userRelevance: 0.15,
  contextModifier: 0.10,
} as const;

// ─── Score → Priority Mapping ─────────────────────────────────────────────────

const PRIORITY_THRESHOLDS: { min: number; level: NotificationPriority }[] = [
  { min: 0.80, level: 'P0' },
  { min: 0.60, level: 'P1' },
  { min: 0.40, level: 'P2' },
  { min: 0.20, level: 'P3' },
  { min: 0.00, level: 'P4' },
];

// ─── Context Types ────────────────────────────────────────────────────────────

export interface ScoringContext {
  /** Current hour in user's timezone (0-23) */
  currentHour: number;
  /** Day of week (0=Sunday, 6=Saturday) */
  dayOfWeek: number;
  /** Number of prior escalation attempts for this notification (0 = first) */
  escalationLevel: number;
  /** Whether a similar notification was sent recently */
  recentSimilar: boolean;
  /** User's engagement rate with this category (0-1, default 0.5) */
  categoryEngagement: number;
  /** Age of notification in ms (for decay calculation, 0 = fresh) */
  ageMs: number;
}

export interface ScoringInput {
  category: NotificationCategory;
  context?: Partial<ScoringContext>;
  /** Override specific factor values (for testing or special cases) */
  overrides?: {
    urgency?: number;
    impact?: number;
    timeSensitivity?: number;
    userRelevance?: number;
  };
}

export interface ScoringResult {
  score: number;
  priority: NotificationPriority;
  factors: {
    urgency: number;
    impact: number;
    timeSensitivity: number;
    userRelevance: number;
    contextModifier: number;
  };
  decayedScore: number;
  decayProfile: DecayProfile;
}

// ─── Priority Scorer ──────────────────────────────────────────────────────────

export interface EngagementStats {
  /** Engagement scores by category (0-1, higher = more engaged) */
  scores: Record<string, number>;
  /** Total interactions tracked per category */
  interactions: Record<string, { positive: number; negative: number }>;
}

export class PriorityScorer {
  private categoryEngagement: Map<NotificationCategory, number> = new Map();
  private interactionCounts: Map<NotificationCategory, { positive: number; negative: number }> = new Map();

  /**
   * Score a notification and determine its priority level.
   */
  score(input: ScoringInput): ScoringResult {
    const defaults = CATEGORY_DEFAULTS[input.category];
    const ctx = this.resolveContext(input.context);

    // Factor 1: Urgency [0, 1]
    const urgency = input.overrides?.urgency ?? defaults.urgency;

    // Factor 2: Impact [0, 1]
    const impact = input.overrides?.impact ?? defaults.impact;

    // Factor 3: Time Sensitivity [0, 1]
    const timeSensitivity = input.overrides?.timeSensitivity ?? defaults.timeSensitivity;

    // Factor 4: User Relevance [0, 1]
    const userRelevance = input.overrides?.userRelevance
      ?? this.calculateUserRelevance(input.category, ctx);

    // Factor 5: Context Modifier [-0.5, 0.5]
    const contextModifier = this.calculateContextModifier(input.category, ctx);

    // Calculate raw score
    const rawScore =
      (urgency * WEIGHTS.urgency) +
      (impact * WEIGHTS.impact) +
      (timeSensitivity * WEIGHTS.timeSensitivity) +
      (userRelevance * WEIGHTS.userRelevance) +
      (contextModifier * WEIGHTS.contextModifier);

    // Clamp to [0, 1]
    const score = Math.max(0, Math.min(1, rawScore));

    // Apply priority decay if notification has age
    const decayedScore = this.applyDecay(score, defaults.decayProfile, ctx.ageMs);

    // Map score to priority level
    const priority = this.scoreToPriority(decayedScore);

    return {
      score,
      priority,
      factors: {
        urgency,
        impact,
        timeSensitivity,
        userRelevance,
        contextModifier,
      },
      decayedScore,
      decayProfile: defaults.decayProfile,
    };
  }

  /**
   * Get the category defaults for a given category.
   */
  getCategoryDefaults(category: NotificationCategory): CategoryDefaults {
    return { ...CATEGORY_DEFAULTS[category] };
  }

  /**
   * Update engagement tracking for a category.
   * Called when user interacts (reads, acknowledges) or ignores a notification.
   */
  updateEngagement(category: NotificationCategory, engaged: boolean): void {
    const current = this.categoryEngagement.get(category) ?? 0.5;
    // Exponential moving average: new = old * 0.9 + signal * 0.1
    const signal = engaged ? 1.0 : 0.0;
    const updated = current * 0.9 + signal * 0.1;
    this.categoryEngagement.set(category, updated);

    // Track interaction counts
    const counts = this.interactionCounts.get(category) ?? { positive: 0, negative: 0 };
    if (engaged) {
      counts.positive++;
    } else {
      counts.negative++;
    }
    this.interactionCounts.set(category, counts);
  }

  /**
   * Get current engagement score for a category.
   */
  getEngagement(category: NotificationCategory): number {
    return this.categoryEngagement.get(category) ?? 0.5;
  }

  /**
   * Get engagement statistics for all tracked categories.
   * Useful for dashboards, briefings, and persistence.
   */
  getEngagementStats(): EngagementStats {
    const scores: Record<string, number> = {};
    const interactions: Record<string, { positive: number; negative: number }> = {};

    for (const [cat, score] of this.categoryEngagement.entries()) {
      scores[cat] = Math.round(score * 1000) / 1000;
    }
    for (const [cat, counts] of this.interactionCounts.entries()) {
      interactions[cat] = { ...counts };
    }

    return { scores, interactions };
  }

  /**
   * Export engagement data for persistence (save to ~/.ari/).
   */
  exportEngagement(): Record<string, { score: number; positive: number; negative: number }> {
    const data: Record<string, { score: number; positive: number; negative: number }> = {};
    for (const [cat, score] of this.categoryEngagement.entries()) {
      const counts = this.interactionCounts.get(cat) ?? { positive: 0, negative: 0 };
      data[cat] = { score, ...counts };
    }
    return data;
  }

  /**
   * Import engagement data from persistence.
   */
  importEngagement(data: Record<string, { score: number; positive: number; negative: number }>): void {
    for (const [cat, entry] of Object.entries(data)) {
      this.categoryEngagement.set(cat as NotificationCategory, entry.score);
      this.interactionCounts.set(cat as NotificationCategory, {
        positive: entry.positive,
        negative: entry.negative,
      });
    }
  }

  /**
   * Map a raw score to a priority level.
   */
  scoreToPriority(score: number): NotificationPriority {
    for (const threshold of PRIORITY_THRESHOLDS) {
      if (score >= threshold.min) {
        return threshold.level;
      }
    }
    return 'P4';
  }

  /**
   * Apply exponential decay to a score based on notification age.
   * Formula: currentScore = originalScore * e^(-0.693 * age / halfLife)
   * where 0.693 = ln(2)
   */
  applyDecay(score: number, profile: DecayProfile, ageMs: number): number {
    if (ageMs <= 0) return score;
    const halfLife = DECAY_HALF_LIFE_MS[profile];
    const decayFactor = Math.exp(-0.693 * ageMs / halfLife);
    return score * decayFactor;
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  /**
   * Fill in default context values for any missing fields.
   */
  private resolveContext(partial?: Partial<ScoringContext>): ScoringContext {
    const now = new Date();
    return {
      currentHour: partial?.currentHour ?? now.getHours(),
      dayOfWeek: partial?.dayOfWeek ?? now.getDay(),
      escalationLevel: partial?.escalationLevel ?? 0,
      recentSimilar: partial?.recentSimilar ?? false,
      categoryEngagement: partial?.categoryEngagement ?? 0.5,
      ageMs: partial?.ageMs ?? 0,
    };
  }

  /**
   * Calculate user relevance based on engagement history and context.
   * Returns [0, 1].
   */
  private calculateUserRelevance(
    category: NotificationCategory,
    ctx: ScoringContext,
  ): number {
    // Start with stored engagement or context-provided engagement
    const engagement = this.categoryEngagement.get(category) ?? ctx.categoryEngagement;
    return Math.max(0, Math.min(1, engagement));
  }

  /**
   * Calculate context modifier based on time, escalation, and patterns.
   * Returns [-0.5, 0.5].
   */
  private calculateContextModifier(
    category: NotificationCategory,
    ctx: ScoringContext,
  ): number {
    let modifier = 0;

    // Escalation boost: +0.1 per level, max +0.3
    if (ctx.escalationLevel > 0) {
      modifier += Math.min(ctx.escalationLevel * 0.1, 0.3);
    }

    // Recent similar penalty: -0.2
    if (ctx.recentSimilar) {
      modifier -= 0.2;
    }

    // Quiet hours protection (Wellbeing Guardian — merged from AlertSystem council)
    // 10 PM - 7 AM: suppress non-critical notifications
    const isQuietHours = ctx.currentHour >= 22 || ctx.currentHour < 7;
    const isUrgentCategory = category === 'security' || category === 'error' || category === 'question';
    if (isQuietHours && !isUrgentCategory) {
      modifier -= 0.3; // Strong suppression during quiet hours
    }

    // Deep work hours penalty (9 PM - 10 PM): -0.15 for non-urgent categories
    const isDeepWork = ctx.currentHour >= 21 && ctx.currentHour < 22;
    if (isDeepWork && !isUrgentCategory) {
      modifier -= 0.15;
    }

    // Weekend penalty for non-critical: -0.1
    const isWeekend = ctx.dayOfWeek === 0 || ctx.dayOfWeek === 6;
    const isCriticalCategory = category === 'security' || category === 'error';
    if (isWeekend && !isCriticalCategory) {
      modifier -= 0.1;
    }

    // Engagement boost/penalty
    const engagement = this.categoryEngagement.get(category) ?? ctx.categoryEngagement;
    if (engagement > 0.7) {
      modifier += 0.1; // High engagement — user cares
    } else if (engagement < 0.3) {
      modifier -= 0.1; // Low engagement — user doesn't care
    }

    // Clamp to [-0.5, 0.5]
    return Math.max(-0.5, Math.min(0.5, modifier));
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const priorityScorer = new PriorityScorer();

// ─── Convenience: map old internal priority to approximate factor overrides ──

/**
 * Bridge function: convert legacy InternalPriority strings to scoring overrides.
 * Used during migration to preserve backward compatibility with code that
 * calls notify() with an explicit priority string.
 */
export function legacyPriorityToOverrides(
  priority: 'critical' | 'high' | 'normal' | 'low' | 'silent',
): { urgency: number; impact: number; timeSensitivity: number } {
  switch (priority) {
    case 'critical': return { urgency: 1.0, impact: 1.0, timeSensitivity: 1.0 };
    case 'high':     return { urgency: 0.8, impact: 0.7, timeSensitivity: 0.7 };
    case 'normal':   return { urgency: 0.5, impact: 0.5, timeSensitivity: 0.5 };
    case 'low':      return { urgency: 0.2, impact: 0.3, timeSensitivity: 0.2 };
    case 'silent':   return { urgency: 0.0, impact: 0.1, timeSensitivity: 0.0 };
  }
}
