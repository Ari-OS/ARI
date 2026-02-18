/**
 * ARI Life Review Generator
 *
 * Generates weekly life reviews from HumanTracker data using LLM insights.
 * Delivers Sunday 8pm reviews via Telegram with Notion archival.
 *
 * Uses the orchestrator to generate personalized insights from tracked
 * Mind/Body/Spirit/Vocation data.
 *
 * Layer: L5 (Autonomous Operations)
 */

import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';
import type {
  HumanTracker,
  LifeReview,
  Quadrant,
} from './human-tracker.js';

const log = createLogger('life-review');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FormattedLifeReview {
  review: LifeReview;
  telegramHtml: string;
  notionMarkdown: string;
}

interface Orchestrator {
  query(prompt: string, agent?: string): Promise<string>;
}

// ─── Quadrant emoji mapping ──────────────────────────────────────────────────

const QUADRANT_LABELS: Record<Quadrant, { label: string; icon: string }> = {
  mind: { label: 'Mind', icon: '🧠' },
  body: { label: 'Body', icon: '💪' },
  spirit: { label: 'Spirit', icon: '🙏' },
  vocation: { label: 'Vocation', icon: '💼' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// LIFE REVIEW GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class LifeReviewGenerator {
  private readonly tracker: HumanTracker;
  private readonly orchestrator: Orchestrator;
  private readonly eventBus: EventBus;

  constructor(params: {
    tracker: HumanTracker;
    orchestrator: Orchestrator;
    eventBus: EventBus;
  }) {
    this.tracker = params.tracker;
    this.orchestrator = params.orchestrator;
    this.eventBus = params.eventBus;
  }

  /**
   * Generate a formatted weekly life review with LLM-enhanced insights.
   */
  async generateWeeklyReview(): Promise<FormattedLifeReview> {
    log.info('Generating weekly life review');

    const review = this.tracker.generateWeeklyReview();

    // Enhance with LLM insights
    const enhancedInsight = await this.generateLLMInsight(review);
    if (enhancedInsight) {
      review.balanceInsight = enhancedInsight;
    }

    const telegramHtml = this.formatTelegramHtml(review);
    const notionMarkdown = this.formatNotionMarkdown(review);

    const result: FormattedLifeReview = {
      review,
      telegramHtml,
      notionMarkdown,
    };

    this.eventBus.emit('life_review:generated', {
      period: review.period,
      overallScore: review.overallScore,
      timestamp: new Date().toISOString(),
    });

    log.info({ overallScore: review.overallScore }, 'Life review generated');
    return result;
  }

  /**
   * Format review for Telegram delivery (split into message chunks).
   * Telegram has a 4096 character limit per message.
   */
  formatForTelegram(review: FormattedLifeReview): string[] {
    const html = review.telegramHtml;
    const MAX_MSG_LEN = 4000;

    if (html.length <= MAX_MSG_LEN) {
      return [html];
    }

    // Split at section boundaries
    const sections = html.split('\n\n');
    const messages: string[] = [];
    let current = '';

    for (const section of sections) {
      if (current.length + section.length + 2 > MAX_MSG_LEN) {
        if (current) messages.push(current.trim());
        current = section;
      } else {
        current += (current ? '\n\n' : '') + section;
      }
    }

    if (current.trim()) {
      messages.push(current.trim());
    }

    return messages;
  }

  // ── LLM insight generation ─────────────────────────────────────────────────

  private async generateLLMInsight(review: LifeReview): Promise<string | null> {
    const quadrants = (['mind', 'body', 'spirit', 'vocation'] as Quadrant[])
      .map(q => {
        const qr = review.quadrants[q];
        return `${q}: score ${qr.score}/100, highlights: ${qr.highlights.join(', ') || 'none'}, improvements: ${qr.improvements.join(', ') || 'none'}`;
      })
      .join('\n');

    const prompt = `You are ARI, Pryce's personal AI. Generate a brief, warm, direct life balance insight (2-3 sentences) based on this weekly data:

${quadrants}

Overall score: ${review.overallScore}/100
Balance insight: ${review.balanceInsight}

Be specific, actionable, and encouraging. Reference his family (Kai, 3, and Portland, 1) when spirit is discussed. Reference Pryceless Solutions for vocation. No filler.`;

    try {
      return await this.orchestrator.query(prompt, 'life-review');
    } catch (err) {
      log.warn({ error: String(err) }, 'LLM insight generation failed');
      return null;
    }
  }

  // ── Telegram HTML formatting ───────────────────────────────────────────────

  private formatTelegramHtml(review: LifeReview): string {
    const lines: string[] = [];

    lines.push('<b>📊 Weekly Life Review</b>');
    lines.push(`<i>${formatDateRange(review.period.start, review.period.end)}</i>`);
    lines.push('');

    for (const q of ['mind', 'body', 'spirit', 'vocation'] as Quadrant[]) {
      const qr = review.quadrants[q];
      const meta = QUADRANT_LABELS[q];
      const bar = scoreBar(qr.score);

      lines.push(`${meta.icon} <b>${meta.label}</b> ${bar} ${qr.score}/100`);

      if (qr.highlights.length > 0) {
        lines.push(`  ✅ ${qr.highlights.join(', ')}`);
      }
      if (qr.improvements.length > 0) {
        lines.push(`  ⚡ ${qr.improvements.join(', ')}`);
      }
      lines.push('');
    }

    lines.push(`<b>Overall: ${review.overallScore}/100</b>`);
    lines.push('');
    lines.push(`💡 <i>${review.balanceInsight}</i>`);

    if (review.weeklyGoals.length > 0) {
      lines.push('');
      lines.push('<b>Goals for next week:</b>');
      for (const goal of review.weeklyGoals) {
        lines.push(`• ${goal}`);
      }
    }

    return lines.join('\n');
  }

  // ── Notion markdown formatting ─────────────────────────────────────────────

  private formatNotionMarkdown(review: LifeReview): string {
    const lines: string[] = [];

    lines.push('# Weekly Life Review');
    lines.push(`*${formatDateRange(review.period.start, review.period.end)}*`);
    lines.push('');
    lines.push(`**Overall Score: ${review.overallScore}/100**`);
    lines.push('');

    for (const q of ['mind', 'body', 'spirit', 'vocation'] as Quadrant[]) {
      const qr = review.quadrants[q];
      const meta = QUADRANT_LABELS[q];

      lines.push(`## ${meta.icon} ${meta.label} (${qr.score}/100)`);
      lines.push('');

      if (qr.highlights.length > 0) {
        lines.push('**Highlights:**');
        for (const h of qr.highlights) {
          lines.push(`- ${h}`);
        }
        lines.push('');
      }

      if (qr.improvements.length > 0) {
        lines.push('**Areas for Improvement:**');
        for (const imp of qr.improvements) {
          lines.push(`- ${imp}`);
        }
        lines.push('');
      }
    }

    lines.push('## Insight');
    lines.push(review.balanceInsight);
    lines.push('');

    if (review.weeklyGoals.length > 0) {
      lines.push('## Goals');
      for (const goal of review.weeklyGoals) {
        lines.push(`- [ ] ${goal}`);
      }
    }

    return lines.join('\n');
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} — ${e.toLocaleDateString('en-US', opts)}, ${e.getFullYear()}`;
}

function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
