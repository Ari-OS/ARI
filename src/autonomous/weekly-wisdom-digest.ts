/**
 * Weekly Wisdom Digest — ARI's "show a friend" feature.
 *
 * Every Sunday at 6 PM, synthesizes the week's cognitive activity into a
 * 3-minute read covering:
 * - Decision patterns across LOGOS/ETHOS/PATHOS
 * - Framework usage (which reasoning tools were applied)
 * - Biases detected and mitigated
 * - Emotional trends (VAD patterns)
 * - Self-improvement outcomes
 * - Recommendations for the coming week
 *
 * Delivers via Notion page. Designed to be the "retention hook" — the single
 * artifact that makes ARI's value visible and compelling.
 *
 * @module autonomous/weekly-wisdom-digest
 */

import { EventBus } from '../kernel/event-bus.js';
import { DecisionJournal, type JournalEntry, type DecisionStats } from '../cognition/learning/decision-journal.js';
import { SelfImprovementLoop, type ImprovementCycleStats } from './self-improvement-loop.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

// =============================================================================
// TYPES
// =============================================================================

export interface WisdomDigest {
  weekStart: Date;
  weekEnd: Date;
  generatedAt: Date;

  // Core metrics
  totalDecisions: number;
  averageConfidence: number;
  pillarDistribution: Record<string, number>;

  // Framework analysis
  topFrameworks: Array<{ name: string; count: number }>;
  newFrameworksUsed: string[];

  // Bias tracking
  biasesDetected: Array<{ type: string; count: number }>;
  biasesMitigated: number;

  // Emotional patterns
  emotionalTrend: {
    avgValence: number;
    avgArousal: number;
    avgDominance: number;
    trend: 'improving' | 'stable' | 'declining';
  } | null;

  // Decision outcomes
  outcomeBreakdown: {
    pending: number;
    success: number;
    failure: number;
    partial: number;
  };

  // Self-improvement
  improvementStats: ImprovementCycleStats | null;

  // Recommendations
  recommendations: string[];

  // Key decisions
  keyDecisions: Array<{
    decision: string;
    pillar: string;
    confidence: number;
    outcome: string;
  }>;
}

export interface DigestDeliveryResult {
  success: boolean;
  digestPath?: string;
  notionPageId?: string;
  error?: string;
}

// =============================================================================
// WEEKLY WISDOM DIGEST
// =============================================================================

export class WeeklyWisdomDigest {
  private eventBus: EventBus;
  private decisionJournal: DecisionJournal;
  private selfImprovementLoop: SelfImprovementLoop | null;
  private digestDir: string;

  constructor(
    eventBus: EventBus,
    decisionJournal: DecisionJournal,
    options: {
      selfImprovementLoop?: SelfImprovementLoop;
      digestDir?: string;
    } = {}
  ) {
    this.eventBus = eventBus;
    this.decisionJournal = decisionJournal;
    this.selfImprovementLoop = options.selfImprovementLoop ?? null;
    this.digestDir = options.digestDir ??
      path.join(homedir(), '.ari', 'digests');
  }

  /**
   * Generate the weekly wisdom digest.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async generate(): Promise<WisdomDigest> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    // Gather decisions from the past week
    const decisions = this.decisionJournal.getDecisionsInRange(weekStart, now);
    const stats = this.decisionJournal.getDecisionStats();

    // Build digest
    const digest: WisdomDigest = {
      weekStart,
      weekEnd: now,
      generatedAt: now,
      totalDecisions: decisions.length,
      averageConfidence: this.calcAvgConfidence(decisions),
      pillarDistribution: this.calcPillarDistribution(decisions),
      topFrameworks: this.calcTopFrameworks(decisions),
      newFrameworksUsed: [], // Would compare to previous week
      biasesDetected: this.calcBiasBreakdown(decisions),
      biasesMitigated: this.calcBiasesMitigated(decisions),
      emotionalTrend: this.calcEmotionalTrend(decisions),
      outcomeBreakdown: this.calcOutcomes(decisions),
      improvementStats: this.selfImprovementLoop?.getStats() ?? null,
      recommendations: this.generateRecommendations(decisions, stats),
      keyDecisions: this.selectKeyDecisions(decisions),
    };

    return digest;
  }

  /**
   * Generate and deliver the digest — save to disk and optionally to Notion.
   */
  async generateAndDeliver(): Promise<DigestDeliveryResult> {
    try {
      const digest = await this.generate();
      const markdown = this.formatAsMarkdown(digest);

      // Save to disk
      await fs.mkdir(this.digestDir, { recursive: true });
      const filename = `wisdom-${digest.weekEnd.toISOString().split('T')[0]}.md`;
      const digestPath = path.join(this.digestDir, filename);
      await fs.writeFile(digestPath, markdown, 'utf-8');

      // Emit event
      this.eventBus.emit('audit:log', {
        action: 'wisdom_digest:generated',
        agent: 'WISDOM_DIGEST',
        trustLevel: 'system',
        details: {
          weekStart: digest.weekStart.toISOString(),
          weekEnd: digest.weekEnd.toISOString(),
          totalDecisions: digest.totalDecisions,
          recommendations: digest.recommendations.length,
          path: digestPath,
        },
      });

      return { success: true, digestPath };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.eventBus.emit('audit:log', {
        action: 'wisdom_digest:failed',
        agent: 'WISDOM_DIGEST',
        trustLevel: 'system',
        details: { error: errMsg },
      });
      return { success: false, error: errMsg };
    }
  }

  /**
   * Format the digest as a readable Markdown document.
   */
  formatAsMarkdown(digest: WisdomDigest): string {
    const lines: string[] = [];
    const weekLabel = `${digest.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${digest.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    lines.push(`# Weekly Wisdom Digest`);
    lines.push(`**${weekLabel}**`);
    lines.push('');

    // ── Executive Summary ──
    lines.push(`## Summary`);
    lines.push('');
    lines.push(this.buildExecutiveSummary(digest));
    lines.push('');

    // ── Pillar Distribution ──
    lines.push(`## Cognitive Pillar Activity`);
    lines.push('');
    const total = digest.totalDecisions || 1;
    for (const [pillar, count] of Object.entries(digest.pillarDistribution)) {
      const pct = Math.round((count / total) * 100);
      const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
      lines.push(`- **${pillar}**: ${count} decisions (${pct}%) ${bar}`);
    }
    lines.push('');

    // ── Framework Usage ──
    if (digest.topFrameworks.length > 0) {
      lines.push(`## Top Frameworks Used`);
      lines.push('');
      for (const fw of digest.topFrameworks.slice(0, 7)) {
        lines.push(`- **${fw.name}**: ${fw.count} times`);
      }
      lines.push('');
    }

    // ── Key Decisions ──
    if (digest.keyDecisions.length > 0) {
      lines.push(`## Key Decisions`);
      lines.push('');
      for (const kd of digest.keyDecisions) {
        const emoji = kd.outcome === 'success' ? '✅' : kd.outcome === 'failure' ? '❌' : '⏳';
        lines.push(`${emoji} **${kd.decision}** (${kd.pillar}, confidence: ${(kd.confidence * 100).toFixed(0)}%)`);
      }
      lines.push('');
    }

    // ── Biases ──
    if (digest.biasesDetected.length > 0) {
      lines.push(`## Biases Detected & Addressed`);
      lines.push('');
      for (const bias of digest.biasesDetected) {
        lines.push(`- **${bias.type}**: detected ${bias.count} time(s)`);
      }
      lines.push(`- Biases mitigated: **${digest.biasesMitigated}**`);
      lines.push('');
    }

    // ── Emotional Trend ──
    if (digest.emotionalTrend) {
      lines.push(`## Emotional Patterns (VAD Model)`);
      lines.push('');
      lines.push(`| Dimension | Average | Interpretation |`);
      lines.push(`|-----------|---------|----------------|`);
      lines.push(`| Valence | ${digest.emotionalTrend.avgValence.toFixed(2)} | ${digest.emotionalTrend.avgValence > 0 ? 'Positive' : 'Negative'} |`);
      lines.push(`| Arousal | ${digest.emotionalTrend.avgArousal.toFixed(2)} | ${digest.emotionalTrend.avgArousal > 0.5 ? 'High energy' : 'Calm'} |`);
      lines.push(`| Dominance | ${digest.emotionalTrend.avgDominance.toFixed(2)} | ${digest.emotionalTrend.avgDominance > 0.5 ? 'In control' : 'Overwhelmed'} |`);
      lines.push(`| Trend | — | **${digest.emotionalTrend.trend}** |`);
      lines.push('');
    }

    // ── Decision Outcomes ──
    lines.push(`## Decision Outcomes`);
    lines.push('');
    const { success, failure, partial, pending } = digest.outcomeBreakdown;
    const outcomeTotal = success + failure + partial + pending || 1;
    lines.push(`| Outcome | Count | Rate |`);
    lines.push(`|---------|-------|------|`);
    lines.push(`| Success | ${success} | ${Math.round((success / outcomeTotal) * 100)}% |`);
    lines.push(`| Failure | ${failure} | ${Math.round((failure / outcomeTotal) * 100)}% |`);
    lines.push(`| Partial | ${partial} | ${Math.round((partial / outcomeTotal) * 100)}% |`);
    lines.push(`| Pending | ${pending} | ${Math.round((pending / outcomeTotal) * 100)}% |`);
    lines.push('');

    // ── Self-Improvement ──
    if (digest.improvementStats && digest.improvementStats.totalCycles > 0) {
      lines.push(`## Self-Improvement Loop`);
      lines.push('');
      lines.push(`- Total cycles: **${digest.improvementStats.totalCycles}**`);
      lines.push(`- Success rate: **${(digest.improvementStats.averageSuccessRate * 100).toFixed(0)}%**`);
      lines.push(`- Patterns learned: **${digest.improvementStats.patternsLearned}**`);
      lines.push(`- Governance-blocked: **${digest.improvementStats.governanceBlocked}**`);
      lines.push('');
    }

    // ── Recommendations ──
    if (digest.recommendations.length > 0) {
      lines.push(`## Recommendations for Next Week`);
      lines.push('');
      for (const rec of digest.recommendations) {
        lines.push(`- ${rec}`);
      }
      lines.push('');
    }

    // ── Confidence ──
    lines.push(`---`);
    lines.push(`*Average decision confidence: ${(digest.averageConfidence * 100).toFixed(0)}% | Generated by ARI at ${digest.generatedAt.toISOString()}*`);
    lines.push('');

    return lines.join('\n');
  }

  // ─── Calculation Methods ──────────────────────────────────────────────

  private calcAvgConfidence(decisions: JournalEntry[]): number {
    if (decisions.length === 0) return 0;
    const sum = decisions.reduce((acc, d) => acc + d.confidence, 0);
    return sum / decisions.length;
  }

  private calcPillarDistribution(decisions: JournalEntry[]): Record<string, number> {
    const dist: Record<string, number> = {};
    for (const d of decisions) {
      dist[d.pillar] = (dist[d.pillar] || 0) + 1;
    }
    return dist;
  }

  private calcTopFrameworks(decisions: JournalEntry[]): Array<{ name: string; count: number }> {
    const counts: Record<string, number> = {};
    for (const d of decisions) {
      for (const fw of d.frameworks_used) {
        counts[fw] = (counts[fw] || 0) + 1;
      }
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  private calcBiasBreakdown(decisions: JournalEntry[]): Array<{ type: string; count: number }> {
    const counts: Record<string, number> = {};
    for (const d of decisions) {
      if (d.biases_detected) {
        for (const bias of d.biases_detected) {
          counts[bias] = (counts[bias] || 0) + 1;
        }
      }
    }

    return Object.entries(counts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }

  private calcBiasesMitigated(decisions: JournalEntry[]): number {
    // Biases are "mitigated" if the decision with the bias has a success outcome
    return decisions.filter(d =>
      d.biases_detected &&
      d.biases_detected.length > 0 &&
      d.outcome === 'success'
    ).length;
  }

  private calcEmotionalTrend(decisions: JournalEntry[]): WisdomDigest['emotionalTrend'] {
    const withEmotion = decisions.filter(d => d.emotional_context);
    if (withEmotion.length === 0) return null;

    const avgValence = withEmotion.reduce((s, d) => s + d.emotional_context!.valence, 0) / withEmotion.length;
    const avgArousal = withEmotion.reduce((s, d) => s + d.emotional_context!.arousal, 0) / withEmotion.length;
    const avgDominance = withEmotion.reduce((s, d) => s + d.emotional_context!.dominance, 0) / withEmotion.length;

    // Sort ascending (oldest first) so first half = past, second half = recent
    const sorted = [...withEmotion].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const half = Math.floor(sorted.length / 2);
    if (half < 2) {
      return { avgValence, avgArousal, avgDominance, trend: 'stable' };
    }

    const firstHalf = sorted.slice(0, half);
    const secondHalf = sorted.slice(half);
    const firstAvg = firstHalf.reduce((s, d) => s + d.emotional_context!.valence, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, d) => s + d.emotional_context!.valence, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;
    const trend = diff > 0.1 ? 'improving' : diff < -0.1 ? 'declining' : 'stable';

    return { avgValence, avgArousal, avgDominance, trend };
  }

  private calcOutcomes(decisions: JournalEntry[]): WisdomDigest['outcomeBreakdown'] {
    const breakdown = { pending: 0, success: 0, failure: 0, partial: 0 };
    for (const d of decisions) {
      const outcome = d.outcome ?? 'pending';
      if (outcome in breakdown) {
        breakdown[outcome]++;
      }
    }
    return breakdown;
  }

  private selectKeyDecisions(decisions: JournalEntry[]): WisdomDigest['keyDecisions'] {
    // Select top 5 decisions by confidence, preferring those with outcomes
    return decisions
      .sort((a, b) => {
        // Prefer decisions with outcomes over pending
        const aHasOutcome = a.outcome && a.outcome !== 'pending' ? 1 : 0;
        const bHasOutcome = b.outcome && b.outcome !== 'pending' ? 1 : 0;
        if (aHasOutcome !== bHasOutcome) return bHasOutcome - aHasOutcome;
        return b.confidence - a.confidence;
      })
      .slice(0, 5)
      .map(d => ({
        decision: d.decision,
        pillar: d.pillar,
        confidence: d.confidence,
        outcome: d.outcome ?? 'pending',
      }));
  }

  private generateRecommendations(
    decisions: JournalEntry[],
    stats: DecisionStats
  ): string[] {
    const recs: string[] = [];

    // 1. Pillar balance
    const pillarCounts = stats.by_pillar;
    const pillars = Object.entries(pillarCounts);
    if (pillars.length > 0) {
      const total = pillars.reduce((s, [, c]) => s + c, 0);
      for (const [pillar, count] of pillars) {
        const pct = count / total;
        if (pct < 0.15) {
          recs.push(`Explore more ${pillar} frameworks — only ${Math.round(pct * 100)}% of decisions used this pillar.`);
        }
      }
    }

    // 2. Underused frameworks
    const fwCounts = stats.by_framework;
    const topFw = Object.entries(fwCounts).sort(([, a], [, b]) => b - a);
    if (topFw.length > 3) {
      const bottom = topFw.slice(-2);
      for (const [fw, count] of bottom) {
        if (count <= 2) {
          recs.push(`Consider using "${fw}" more — only used ${count} time(s) this week.`);
        }
      }
    }

    // 3. Bias awareness
    const biases = this.calcBiasBreakdown(decisions);
    if (biases.length > 0) {
      const topBias = biases[0];
      recs.push(`Watch for ${topBias.type} — it was the most common bias this week (${topBias.count} occurrences).`);
    }

    // 4. Confidence calibration
    if (stats.average_confidence > 0.9) {
      recs.push(`Average confidence is very high (${(stats.average_confidence * 100).toFixed(0)}%) — consider whether some decisions warrant more deliberation.`);
    } else if (stats.average_confidence < 0.5) {
      recs.push(`Average confidence is low (${(stats.average_confidence * 100).toFixed(0)}%) — build confidence through more thorough analysis frameworks.`);
    }

    // 5. Outcome-based
    const outcomes = this.calcOutcomes(decisions);
    const totalOutcomes = outcomes.success + outcomes.failure + outcomes.partial;
    if (totalOutcomes > 0) {
      const failRate = outcomes.failure / totalOutcomes;
      if (failRate > 0.3) {
        recs.push(`Failure rate is ${Math.round(failRate * 100)}% — review failed decisions for common patterns.`);
      }
    }

    // 6. Pending decisions
    if (outcomes.pending > 5) {
      recs.push(`${outcomes.pending} decisions still pending outcome tracking — follow up on these.`);
    }

    // Default recommendation
    if (recs.length === 0) {
      recs.push('Great week! Continue applying diverse frameworks across all three pillars.');
    }

    return recs;
  }

  private buildExecutiveSummary(digest: WisdomDigest): string {
    if (digest.totalDecisions === 0) {
      return 'No cognitive decisions were recorded this week. ARI is waiting for activation.';
    }

    const lines: string[] = [];
    lines.push(`This week, ARI processed **${digest.totalDecisions} decisions** across ${Object.keys(digest.pillarDistribution).length} cognitive pillars with an average confidence of **${(digest.averageConfidence * 100).toFixed(0)}%**.`);

    if (digest.topFrameworks.length > 0) {
      const topFw = digest.topFrameworks.slice(0, 3).map(f => f.name).join(', ');
      lines.push(`Most-used frameworks: ${topFw}.`);
    }

    if (digest.biasesDetected.length > 0) {
      const totalBiases = digest.biasesDetected.reduce((s, b) => s + b.count, 0);
      lines.push(`${totalBiases} cognitive bias(es) were detected and ${digest.biasesMitigated} were successfully mitigated.`);
    }

    if (digest.emotionalTrend) {
      lines.push(`Emotional trend: **${digest.emotionalTrend.trend}**.`);
    }

    return lines.join(' ');
  }
}
