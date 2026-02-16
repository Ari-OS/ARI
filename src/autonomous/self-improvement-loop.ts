/**
 * Self-Improvement Loop — Closes the feedback loop between initiative execution,
 * learning, decision journaling, and governance.
 *
 * The loop:
 * 1. InitiativeEngine discovers improvements
 * 2. Council votes on high-impact changes (governance gate)
 * 3. AgentSpawner executes in isolated worktrees
 * 4. Outcomes flow to LearningMachine (pattern extraction)
 * 5. DecisionJournal records initiative decisions
 * 6. AdaptiveLearner adjusts future initiative priorities
 *
 * This module wires existing components via EventBus — it doesn't duplicate logic,
 * it orchestrates it.
 *
 * @module autonomous/self-improvement-loop
 */

import { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';
import { DecisionJournal } from '../cognition/learning/decision-journal.js';

const log = createLogger('self-improvement-loop');
import type { Initiative, InitiativeCategory } from './initiative-engine.js';
import type { CouncilInterface } from '../kernel/types.js';
import type { BudgetTracker } from './budget-tracker.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

// =============================================================================
// TYPES
// =============================================================================

export interface ImprovementOutcome {
  initiativeId: string;
  category: InitiativeCategory;
  title: string;
  success: boolean;
  summary: string;
  filesChanged: string[];
  patternsExtracted: number;
  governanceApproved: boolean;
  timestamp: Date;
}

export interface ImprovementCycleStats {
  totalCycles: number;
  successfulImprovements: number;
  failedImprovements: number;
  governanceBlocked: number;
  patternsLearned: number;
  decisionsRecorded: number;
  byCategory: Record<string, { success: number; failure: number }>;
  averageSuccessRate: number;
  lastCycleAt: string | null;
}

interface LoopConfig {
  governanceEnabled: boolean;
  governanceThreshold: 'MAJORITY' | 'SUPERMAJORITY';
  highImpactCategories: InitiativeCategory[];
  maxOutcomeHistory: number;
}

interface StoredState {
  outcomes: ImprovementOutcome[];
  stats: {
    totalCycles: number;
    patternsLearned: number;
    decisionsRecorded: number;
    governanceBlocked: number;
  };
}

// =============================================================================
// SELF-IMPROVEMENT LOOP
// =============================================================================

export class SelfImprovementLoop {
  private eventBus: EventBus;
  private decisionJournal: DecisionJournal | null = null;
  private council: CouncilInterface | null = null;
  private budgetTracker: BudgetTracker | null = null;
  private outcomes: ImprovementOutcome[] = [];
  private unsubscribers: Array<() => void> = [];
  private initialized = false;
  private config: LoopConfig;
  private persistPath: string;

  private stats = {
    totalCycles: 0,
    patternsLearned: 0,
    decisionsRecorded: 0,
    governanceBlocked: 0,
  };

  constructor(
    eventBus: EventBus,
    options: {
      decisionJournal?: DecisionJournal;
      council?: CouncilInterface;
      budgetTracker?: BudgetTracker;
      config?: Partial<LoopConfig>;
      persistPath?: string;
    } = {}
  ) {
    this.eventBus = eventBus;
    this.decisionJournal = options.decisionJournal ?? null;
    this.council = options.council ?? null;
    this.budgetTracker = options.budgetTracker ?? null;
    this.persistPath = options.persistPath ??
      path.join(homedir(), '.ari', 'self-improvement-state.json');

    this.config = {
      governanceEnabled: true,
      governanceThreshold: 'MAJORITY',
      highImpactCategories: ['CODE_QUALITY', 'IMPROVEMENTS'],
      maxOutcomeHistory: 500,
      ...options.config,
    };
  }

  /**
   * Initialize the loop — subscribe to events, load state.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.loadState();
    this.subscribeToEvents();
    this.initialized = true;

    this.eventBus.emit('audit:log', {
      action: 'self_improvement:initialized',
      agent: 'SELF_IMPROVEMENT',
      trustLevel: 'system',
      details: {
        outcomesLoaded: this.outcomes.length,
        governanceEnabled: this.config.governanceEnabled,
      },
    });
  }

  /**
   * Process an initiative execution — the core feedback loop.
   *
   * Called when an initiative completes (success or failure).
   * 1. Records the decision in DecisionJournal
   * 2. Extracts patterns for LearningMachine via events
   * 3. Updates improvement statistics
   * 4. Persists state
   */
  async processOutcome(
    initiative: Initiative,
    success: boolean,
    details: {
      summary: string;
      filesChanged?: string[];
      governanceApproved?: boolean;
    }
  ): Promise<ImprovementOutcome> {
    this.stats.totalCycles++;

    const outcome: ImprovementOutcome = {
      initiativeId: initiative.id,
      category: initiative.category,
      title: initiative.title,
      success,
      summary: details.summary,
      filesChanged: details.filesChanged ?? [],
      patternsExtracted: 0,
      governanceApproved: details.governanceApproved ?? true,
      timestamp: new Date(),
    };

    // 1. Record decision in journal
    if (this.decisionJournal) {
      this.decisionJournal.recordDecision({
        decision: `Initiative: ${initiative.title}`,
        frameworks_used: this.frameworksForCategory(initiative.category),
        pillar: this.pillarForCategory(initiative.category),
        confidence: initiative.priority,
        reasoning: `${initiative.rationale}\n\nOutcome: ${details.summary}`,
        outcome: success ? 'success' : 'failure',
      });
      this.stats.decisionsRecorded++;
    }

    // 2. Emit learning event for LearningMachine to observe
    this.eventBus.emit('scheduler:task_complete', {
      taskId: initiative.id,
      taskName: `initiative:${initiative.title}`,
      duration: 0,
      success,
      error: success ? undefined : details.summary,
      triggeredBy: 'subagent',
    });

    // 3. If successful, extract and emit patterns
    if (success) {
      outcome.patternsExtracted = this.extractPatterns(initiative, details);
      this.stats.patternsLearned += outcome.patternsExtracted;
    }

    // 4. Track outcome
    this.outcomes.push(outcome);

    // Trim history
    if (this.outcomes.length > this.config.maxOutcomeHistory) {
      this.outcomes = this.outcomes.slice(-this.config.maxOutcomeHistory);
    }

    // 5. Persist
    await this.persistState();

    this.eventBus.emit('audit:log', {
      action: 'self_improvement:outcome_processed',
      agent: 'SELF_IMPROVEMENT',
      trustLevel: 'system',
      details: {
        initiativeId: initiative.id,
        success,
        patternsExtracted: outcome.patternsExtracted,
        totalCycles: this.stats.totalCycles,
      },
    });

    return outcome;
  }

  /**
   * Check if an initiative requires governance approval.
   */
  requiresGovernance(initiative: Initiative): boolean {
    if (!this.config.governanceEnabled) return false;

    // High-impact categories require a Council vote
    if (this.config.highImpactCategories.includes(initiative.category)) {
      return true;
    }

    // Anything affecting code that isn't low-effort
    if (initiative.effort !== 'LOW' && initiative.category === 'CODE_QUALITY') {
      return true;
    }

    return false;
  }

  /**
   * Request Council governance for an initiative.
   * Returns approval result and vote_id if governance was executed.
   */
  async requestGovernanceApproval(
    initiative: Initiative
  ): Promise<{ approved: boolean; voteId: string | null }> {
    if (!this.requiresGovernance(initiative)) {
      return { approved: true, voteId: null };
    }

    // If no council instance, fall back to approval (for backward compatibility)
    if (!this.council) {
      this.eventBus.emit('audit:log', {
        action: 'self_improvement:governance_requested',
        agent: 'SELF_IMPROVEMENT',
        trustLevel: 'system',
        details: {
          initiativeId: initiative.id,
          threshold: this.config.governanceThreshold,
          fallback: true,
        },
      });
      return { approved: true, voteId: `vote-${initiative.id}` };
    }

    // Create a vote in the Council
    const vote = this.council.createVote({
      topic: `Initiative: ${initiative.title}`,
      description: `${initiative.description}\n\nRationale: ${initiative.rationale}\nCategory: ${initiative.category}\nEffort: ${initiative.effort}\nImpact: ${initiative.impact}`,
      threshold: this.config.governanceThreshold,
      deadline_minutes: 60,
      initiated_by: 'autonomous',
    });

    this.eventBus.emit('audit:log', {
      action: 'self_improvement:governance_requested',
      agent: 'SELF_IMPROVEMENT',
      trustLevel: 'system',
      details: {
        initiativeId: initiative.id,
        voteId: vote.vote_id,
        threshold: this.config.governanceThreshold,
      },
    });

    // Wait for vote completion (with timeout)
    const result = await this.waitForVoteCompletion(vote.vote_id);

    if (result.approved) {
      this.eventBus.emit('audit:log', {
        action: 'self_improvement:governance_approved',
        agent: 'SELF_IMPROVEMENT',
        trustLevel: 'system',
        details: {
          initiativeId: initiative.id,
          voteId: vote.vote_id,
        },
      });
    } else {
      this.stats.governanceBlocked++;
      this.eventBus.emit('audit:log', {
        action: 'self_improvement:governance_rejected',
        agent: 'SELF_IMPROVEMENT',
        trustLevel: 'system',
        details: {
          initiativeId: initiative.id,
          voteId: vote.vote_id,
        },
      });
    }

    return { approved: result.approved, voteId: vote.vote_id };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INITIATIVE CONFIDENCE SCORING (Phase 4F)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Score an initiative's confidence (0.0-1.0).
   * Factors:
   * - Historical success rate for this category
   * - Current system load (circuit breakers)
   * - Budget availability
   *
   * Returns a confidence score where:
   * - 1.0 = very confident, execute
   * - 0.7 = threshold for auto-execution
   * - 0.0 = no confidence, skip
   */
  scoreInitiativeConfidence(initiative: Initiative): number {
    let confidence = 0.0;

    // Factor 1: Historical success rate for this category (0-0.4 points)
    const categoryOutcomes = this.outcomes.filter(o => o.category === initiative.category);
    if (categoryOutcomes.length > 0) {
      const successes = categoryOutcomes.filter(o => o.success).length;
      const successRate = successes / categoryOutcomes.length;
      confidence += successRate * 0.4;
    } else {
      // No history: use baseline confidence based on category
      const baselineConfidence: Record<InitiativeCategory, number> = {
        CODE_QUALITY: 0.3,      // Medium risk
        KNOWLEDGE: 0.35,        // Low risk
        OPPORTUNITIES: 0.35,    // Low risk
        DELIVERABLES: 0.3,      // Medium risk
        IMPROVEMENTS: 0.25,     // Higher risk (self-modification)
      };
      confidence += baselineConfidence[initiative.category] ?? 0.3;
    }

    // Factor 2: Current system load - check if circuit breakers are open (0-0.3 points)
    // For now, assume healthy unless we have signals otherwise
    // In production: check circuit breaker state from eventBus or system health
    const systemHealthy = this.checkSystemHealth();
    confidence += systemHealthy ? 0.3 : 0.0;

    // Factor 3: Budget availability (0-0.3 points)
    if (this.budgetTracker) {
      const budgetPressure = this.budgetTracker.getBudgetPressure();
      // Invert pressure: low pressure = high confidence
      const budgetConfidence = (1 - budgetPressure) * 0.3;
      confidence += budgetConfidence;
    } else {
      // No budget tracker: assume medium confidence
      confidence += 0.15;
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Check if an initiative should proceed based on confidence score.
   * Threshold: 0.7 (70% confidence required).
   *
   * Returns { allowed: boolean, confidence: number, reason?: string }
   */
  checkInitiativeConfidence(initiative: Initiative): {
    allowed: boolean;
    confidence: number;
    reason?: string;
  } {
    const confidence = this.scoreInitiativeConfidence(initiative);
    const threshold = 0.7;

    if (confidence < threshold) {
      const reasons: string[] = [];

      // Identify why confidence is low
      const categoryOutcomes = this.outcomes.filter(o => o.category === initiative.category);
      if (categoryOutcomes.length > 0) {
        const successRate = categoryOutcomes.filter(o => o.success).length / categoryOutcomes.length;
        if (successRate < 0.5) {
          reasons.push(`Low historical success rate for ${initiative.category} (${(successRate * 100).toFixed(0)}%)`);
        }
      }

      if (this.budgetTracker) {
        const budgetPressure = this.budgetTracker.getBudgetPressure();
        if (budgetPressure > 0.7) {
          reasons.push(`High budget pressure (${(budgetPressure * 100).toFixed(0)}%)`);
        }
      }

      if (!this.checkSystemHealth()) {
        reasons.push('System health checks failing');
      }

      const reason = reasons.length > 0
        ? reasons.join('; ')
        : `Confidence score ${(confidence * 100).toFixed(0)}% below threshold ${(threshold * 100).toFixed(0)}%`;

      this.eventBus.emit('self_improvement:low_confidence', {
        initiativeId: initiative.id,
        title: initiative.title,
        confidence,
        threshold,
        reason,
      });

      return { allowed: false, confidence, reason };
    }

    return { allowed: true, confidence };
  }

  /**
   * Check system health.
   * Returns true if system is healthy, false if circuit breakers are open.
   *
   * For now: simple heuristic based on recent failures.
   * In production: integrate with circuit breaker state.
   */
  private checkSystemHealth(): boolean {
    // Check recent outcomes for high failure rate
    const recentOutcomes = this.outcomes.slice(-20); // Last 20 outcomes
    if (recentOutcomes.length < 5) return true; // Not enough data

    const recentFailures = recentOutcomes.filter(o => !o.success).length;
    const failureRate = recentFailures / recentOutcomes.length;

    // If >50% recent failure rate, system is unhealthy
    return failureRate < 0.5;
  }

  /**
   * Wait for a vote to complete, with 1-hour timeout.
   * Returns whether the vote was approved.
   */
  private async waitForVoteCompletion(voteId: string): Promise<{ approved: boolean }> {
    return new Promise((resolve) => {
      let resolved = false;

      const unsub = this.eventBus.on('vote:completed', (payload) => {
        if (payload.voteId === voteId && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          unsub();
          resolve({ approved: payload.status === 'APPROVED' });
        }
      });

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsub();
          resolve({ approved: false });
        }
      }, 60 * 60 * 1000); // 1 hour
    });
  }

  /**
   * Get improvement cycle statistics.
   */
  getStats(): ImprovementCycleStats {
    const byCategory: Record<string, { success: number; failure: number }> = {};

    for (const outcome of this.outcomes) {
      if (!byCategory[outcome.category]) {
        byCategory[outcome.category] = { success: 0, failure: 0 };
      }
      if (outcome.success) {
        byCategory[outcome.category].success++;
      } else {
        byCategory[outcome.category].failure++;
      }
    }

    const successes = this.outcomes.filter(o => o.success).length;
    const total = this.outcomes.length;

    return {
      totalCycles: this.stats.totalCycles,
      successfulImprovements: successes,
      failedImprovements: total - successes,
      governanceBlocked: this.stats.governanceBlocked,
      patternsLearned: this.stats.patternsLearned,
      decisionsRecorded: this.stats.decisionsRecorded,
      byCategory,
      averageSuccessRate: total > 0 ? successes / total : 0,
      lastCycleAt: this.outcomes.length > 0
        ? this.outcomes[this.outcomes.length - 1].timestamp.toISOString()
        : null,
    };
  }

  /**
   * Get recent improvement outcomes.
   */
  getRecentOutcomes(limit: number = 10): ImprovementOutcome[] {
    return this.outcomes.slice(-limit).reverse();
  }

  /**
   * Get outcomes by category.
   */
  getOutcomesByCategory(category: InitiativeCategory): ImprovementOutcome[] {
    return this.outcomes.filter(o => o.category === category);
  }

  /**
   * Shutdown — persist final state and unsubscribe.
   */
  async shutdown(): Promise<void> {
    for (const unsub of this.unsubscribers) {
      if (typeof unsub === 'function') unsub();
    }
    this.unsubscribers = [];

    await this.persistState();
    this.initialized = false;
  }

  // ─── Private Methods ──────────────────────────────────────────────────

  private subscribeToEvents(): void {
    // Listen for initiative completion events
    const unsub1 = this.eventBus.on('audit:log', (payload) => {
      if (payload.action === 'initiative:completed' || payload.action === 'initiative:failed') {
        const details = payload.details;
        const initiativeId = details?.initiativeId as string;
        const status = details?.status as string;

        if (initiativeId) {
          // Record a lightweight outcome from the audit event
          const outcome: ImprovementOutcome = {
            initiativeId,
            category: (details?.category as InitiativeCategory) ?? 'IMPROVEMENTS',
            title: (details?.title as string) ?? initiativeId,
            success: status === 'COMPLETED',
            summary: (details?.result as string) ?? payload.action,
            filesChanged: [],
            patternsExtracted: 0,
            governanceApproved: true,
            timestamp: new Date(),
          };

          this.outcomes.push(outcome);
          this.stats.totalCycles++;

          if (this.outcomes.length > this.config.maxOutcomeHistory) {
            this.outcomes = this.outcomes.slice(-this.config.maxOutcomeHistory);
          }

          this.persistState().catch((err: unknown) => {
            log.error({ err }, 'Persist failed');
          });
        }
      }
    });
    this.unsubscribers.push(unsub1);

    // Listen for subagent completion
    const unsub2 = this.eventBus.on('subagent:completed', (payload) => {
      this.eventBus.emit('audit:log', {
        action: 'self_improvement:subagent_outcome',
        agent: 'SELF_IMPROVEMENT',
        trustLevel: 'system',
        details: {
          taskId: payload.taskId,
          success: payload.success,
        },
      });
    });
    this.unsubscribers.push(unsub2);
  }

  /**
   * Extract patterns from a successful initiative for future learning.
   */
  private extractPatterns(
    initiative: Initiative,
    details: { summary: string; filesChanged?: string[] }
  ): number {
    let count = 0;

    // Pattern: category + effort + impact → success correlation
    // Emitted as a lightweight event for AdaptiveLearner
    this.eventBus.emit('audit:log', {
      action: 'self_improvement:pattern_extracted',
      agent: 'SELF_IMPROVEMENT',
      trustLevel: 'system',
      details: {
        type: 'initiative_success',
        category: initiative.category,
        effort: initiative.effort,
        impact: initiative.impact,
        priority: initiative.priority,
        filesChanged: details.filesChanged?.length ?? 0,
      },
    });
    count++;

    // If code quality initiative, extract the fix pattern
    if (initiative.category === 'CODE_QUALITY' && initiative.kind) {
      this.eventBus.emit('audit:log', {
        action: 'self_improvement:pattern_extracted',
        agent: 'SELF_IMPROVEMENT',
        trustLevel: 'system',
        details: {
          type: 'code_quality_fix',
          kind: initiative.kind,
          target: initiative.target?.filePath,
          summary: details.summary,
        },
      });
      count++;
    }

    return count;
  }

  /**
   * Map initiative category to cognitive frameworks.
   */
  private frameworksForCategory(category: InitiativeCategory): string[] {
    const mapping: Record<InitiativeCategory, string[]> = {
      CODE_QUALITY: ['Systems Thinking (Meadows)', 'Antifragility (Taleb)'],
      KNOWLEDGE: ['Bayesian Reasoning', 'Reflection Engine (Kolb)'],
      OPPORTUNITIES: ['Expected Value Theory', 'Decision Trees'],
      DELIVERABLES: ['Systems Thinking (Meadows)'],
      IMPROVEMENTS: ['Antifragility (Taleb)', 'Deliberate Practice (Ericsson)'],
    };
    return mapping[category] ?? ['Systems Thinking (Meadows)'];
  }

  /**
   * Map initiative category to cognitive pillar.
   */
  private pillarForCategory(
    category: InitiativeCategory
  ): 'LOGOS' | 'ETHOS' | 'PATHOS' | 'CROSS' {
    const mapping: Record<InitiativeCategory, 'LOGOS' | 'ETHOS' | 'PATHOS' | 'CROSS'> = {
      CODE_QUALITY: 'LOGOS',
      KNOWLEDGE: 'LOGOS',
      OPPORTUNITIES: 'LOGOS',
      DELIVERABLES: 'CROSS',
      IMPROVEMENTS: 'PATHOS',
    };
    return mapping[category] ?? 'CROSS';
  }

  /**
   * Persist state to disk.
   */
  private async persistState(): Promise<void> {
    try {
      const dir = path.dirname(this.persistPath);
      await fs.mkdir(dir, { recursive: true });

      const state: StoredState = {
        outcomes: this.outcomes,
        stats: this.stats,
      };

      const tmpPath = `${this.persistPath}.tmp`;
      await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
      try {
        await fs.rename(tmpPath, this.persistPath);
      } catch {
        await fs.writeFile(this.persistPath, JSON.stringify(state, null, 2), 'utf-8');
      }
    } catch (err) {
      // Best-effort persistence — log but don't throw
      log.error({ err }, 'State persistence failed');
    }
  }

  /**
   * Load state from disk.
   */
  private async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(this.persistPath, 'utf-8');
      const state = JSON.parse(data) as StoredState;

      this.outcomes = state.outcomes.map(o => ({
        ...o,
        timestamp: new Date(o.timestamp),
      }));

      this.stats = {
        ...this.stats,
        ...state.stats,
      };
    } catch {
      // No state file or corrupted — start fresh (expected on first run)
    }
  }
}
