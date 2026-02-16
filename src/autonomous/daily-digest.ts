/**
 * ARI Daily Knowledge Digest
 *
 * Transforms raw intelligence scanner output into a beautifully curated
 * daily knowledge report personalized for Pryce. Designed so he doesn't
 * have to read every article — ARI reads everything and surfaces the
 * signal from the noise.
 *
 * Report Structure:
 * ┌──────────────────────────────────────┐
 * │  ARI DAILY INTEL — Feb 16, 2026     │
 * ├──────────────────────────────────────┤
 * │  TOP SIGNAL (most important item)    │
 * ├──────────────────────────────────────┤
 * │  AI & TECH (3-5 items)              │
 * │  MARKET & MONEY (2-3 items)         │
 * │  CAREER & BUSINESS (1-3 items)      │
 * │  DEV TOOLS & REPOS (2-3 items)      │
 * │  FROM YOUR LIKES (2-3 items from X) │
 * ├──────────────────────────────────────┤
 * │  ARI'S TAKE (actionable insights)   │
 * └──────────────────────────────────────┘
 *
 * Delivery: Telegram (HTML) at 6:30 AM ET
 * Archive: ~/.ari/knowledge/digests/YYYY-MM-DD.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';
import type { IntelligenceItem, ScanResult } from './intelligence-scanner.js';

const log = createLogger('daily-digest');

const DIGEST_DIR = path.join(process.env.HOME || '~', '.ari', 'knowledge', 'digests');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DigestSection {
  title: string;
  icon: string;
  items: DigestItem[];
}

export interface DigestItem {
  headline: string;
  summary: string;
  url?: string;
  source: string;
  score: number;
  tag?: string;
}

export interface DailyDigest {
  date: string;
  generatedAt: string;
  topSignal: DigestItem | null;
  sections: DigestSection[];
  ariTake: string[];
  stats: {
    sourcesScanned: number;
    itemsProcessed: number;
    itemsIncluded: number;
  };
  telegramHtml: string;
  plainText: string;
}

// ─── Digest Generator ────────────────────────────────────────────────────────

export class DailyDigestGenerator {
  private eventBus: EventBus;
  private timezone = 'America/Indiana/Indianapolis';

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Generate a complete daily digest from scan results
   */
  async generate(scanResult: ScanResult): Promise<DailyDigest> {
    await fs.mkdir(DIGEST_DIR, { recursive: true });

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: this.timezone,
    });

    const items = scanResult.topItems;

    // Categorize items into sections
    const aiItems = this.filterByDomains(items, ['ai', 'security']);
    const marketItems = this.filterByDomains(items, ['investment']);
    const careerItems = this.filterByDomains(items, ['career', 'business']);
    const toolItems = this.filterByDomains(items, ['tools', 'programming']);
    const xItems = items.filter((i) => i.sourceCategory === 'SOCIAL');

    // Pick top signal (highest scored item overall)
    const topSignal = items[0]
      ? this.toDigestItem(items[0], 'TOP')
      : null;

    // Build sections (skip the top signal from sections to avoid duplication)
    const usedIds = new Set<string>(topSignal ? [items[0].id] : []);

    const sections: DigestSection[] = [];

    const aiSection = this.buildSection(
      'AI & TECH',
      '◆',
      aiItems.filter((i) => !usedIds.has(i.id)),
      5
    );
    if (aiSection.items.length > 0) {
      sections.push(aiSection);
      aiSection.items.forEach((i) => usedIds.add(i.headline));
    }

    const marketSection = this.buildSection(
      'MARKET & MONEY',
      '$',
      marketItems.filter((i) => !usedIds.has(i.id)),
      3
    );
    if (marketSection.items.length > 0) sections.push(marketSection);

    const careerSection = this.buildSection(
      'CAREER & BUSINESS',
      '◇',
      careerItems.filter((i) => !usedIds.has(i.id)),
      3
    );
    if (careerSection.items.length > 0) sections.push(careerSection);

    const toolSection = this.buildSection(
      'DEV TOOLS & REPOS',
      '▸',
      toolItems.filter((i) => !usedIds.has(i.id)),
      3
    );
    if (toolSection.items.length > 0) sections.push(toolSection);

    const xSection = this.buildSection(
      'FROM YOUR LIKES',
      '♡',
      xItems.filter((i) => !usedIds.has(i.id)),
      3
    );
    if (xSection.items.length > 0) sections.push(xSection);

    // Generate ARI's actionable insights
    const ariTake = this.generateAriTake(items);

    // Build formatted outputs
    const digest: DailyDigest = {
      date: today,
      generatedAt: new Date().toISOString(),
      topSignal,
      sections,
      ariTake,
      stats: {
        sourcesScanned: scanResult.sourcesScanned,
        itemsProcessed: scanResult.itemsFound,
        itemsIncluded: sections.reduce((sum, s) => sum + s.items.length, 0) + (topSignal ? 1 : 0),
      },
      telegramHtml: '', // filled below
      plainText: '', // filled below
    };

    digest.telegramHtml = this.formatTelegramHtml(digest, today);
    digest.plainText = this.formatPlainText(digest, today);

    // Save to disk
    await this.saveDigest(digest);

    // Emit event
    this.eventBus.emit('intelligence:digest_generated', {
      date: today,
      sections: sections.length,
      items: digest.stats.itemsIncluded,
    });

    log.info({
      sections: sections.length,
      items: digest.stats.itemsIncluded,
    }, 'Daily digest generated');

    return digest;
  }

  /**
   * Get the latest saved digest
   */
  async getLatest(): Promise<DailyDigest | null> {
    try {
      const files = await fs.readdir(DIGEST_DIR);
      const jsonFiles = files.filter((f) => f.endsWith('.json')).sort().reverse();
      if (jsonFiles.length === 0) return null;

      const data = await fs.readFile(path.join(DIGEST_DIR, jsonFiles[0]), 'utf-8');
      return JSON.parse(data) as DailyDigest;
    } catch {
      return null;
    }
  }

  // ─── Section Building ────────────────────────────────────────────────────

  private buildSection(
    title: string,
    icon: string,
    items: IntelligenceItem[],
    maxItems: number
  ): DigestSection {
    return {
      title,
      icon,
      items: items
        .slice(0, maxItems)
        .map((item) => this.toDigestItem(item)),
    };
  }

  private toDigestItem(item: IntelligenceItem, tag?: string): DigestItem {
    return {
      headline: item.title,
      summary: this.condenseSummary(item.summary),
      url: item.url,
      source: item.source,
      score: item.score,
      tag,
    };
  }

  private condenseSummary(text: string): string {
    // Strip to first 2 meaningful sentences
    const sentences = text
      .replace(/\s+/g, ' ')
      .split(/[.!?]\s/)
      .filter((s) => s.trim().length > 20)
      .slice(0, 2);

    return sentences.join('. ').slice(0, 300);
  }

  private filterByDomains(
    items: IntelligenceItem[],
    domains: string[]
  ): IntelligenceItem[] {
    return items.filter((item) =>
      item.domains.some((d) => domains.includes(d))
    );
  }

  // ─── ARI's Take ─────────────────────────────────────────────────────────

  private generateAriTake(items: IntelligenceItem[]): string[] {
    const insights: string[] = [];

    // Check for Anthropic news (directly affects ARI)
    const anthropicItems = items.filter(
      (i) => i.source.toLowerCase().includes('anthropic')
    );
    if (anthropicItems.length > 0) {
      insights.push(
        `Anthropic update detected. ${anthropicItems[0].title.slice(0, 100)}. ` +
        'I should review this for potential ARI improvements.'
      );
    }

    // Check for competitor moves
    const competitorItems = items.filter(
      (i) =>
        i.source.toLowerCase().includes('openai') ||
        i.source.toLowerCase().includes('xai') ||
        i.source.toLowerCase().includes('deepmind')
    );
    if (competitorItems.length > 0) {
      insights.push(
        `${competitorItems.length} competitor update(s): ` +
        competitorItems
          .slice(0, 2)
          .map((i) => `${i.source} — ${i.title.slice(0, 60)}`)
          .join('; ')
      );
    }

    // Check for trending tools/repos
    const toolItems = items.filter(
      (i) => i.domains.includes('tools') || i.domains.includes('programming')
    );
    if (toolItems.length > 0) {
      const topTool = toolItems[0];
      insights.push(
        `Trending in dev: "${topTool.title.slice(0, 80)}" — worth evaluating for our stack.`
      );
    }

    // Investment signals
    const investmentItems = items.filter((i) => i.domains.includes('investment'));
    if (investmentItems.length > 0) {
      insights.push(
        `${investmentItems.length} market signal(s) detected. ` +
        `Top: ${investmentItems[0].title.slice(0, 80)}.`
      );
    }

    // Career signals
    const careerItems = items.filter(
      (i) => i.domains.includes('career') || i.domains.includes('business')
    );
    if (careerItems.length > 0) {
      insights.push(
        `Career/business intel: ${careerItems[0].title.slice(0, 100)}.`
      );
    }

    // If no specific insights, provide general summary
    if (insights.length === 0) {
      insights.push(
        `Scanned ${items.length} items across all sources. No high-priority signals today — steady state.`
      );
    }

    return insights;
  }

  // ─── Formatting ──────────────────────────────────────────────────────────

  private formatTelegramHtml(digest: DailyDigest, dateStr: string): string {
    const lines: string[] = [];

    // Header
    lines.push(`<b>◆ ARI DAILY INTEL</b>`);
    lines.push(`<i>${this.escapeHtml(dateStr)}</i>`);
    lines.push('');

    // Top Signal
    if (digest.topSignal) {
      lines.push('━━━ <b>TOP SIGNAL</b> ━━━');
      lines.push(`<b>${this.escapeHtml(digest.topSignal.headline.slice(0, 200))}</b>`);
      if (digest.topSignal.summary) {
        lines.push(this.escapeHtml(digest.topSignal.summary.slice(0, 200)));
      }
      if (digest.topSignal.url) {
        lines.push(`<a href="${digest.topSignal.url}">Read more</a> · ${this.escapeHtml(digest.topSignal.source)}`);
      }
      lines.push('');
    }

    // Sections
    for (const section of digest.sections) {
      lines.push(`${section.icon} <b>${this.escapeHtml(section.title)}</b>`);

      for (const item of section.items) {
        const scoreBar = this.miniScoreBar(item.score);
        if (item.url) {
          lines.push(`${scoreBar} <a href="${item.url}">${this.escapeHtml(item.headline.slice(0, 120))}</a>`);
        } else {
          lines.push(`${scoreBar} ${this.escapeHtml(item.headline.slice(0, 120))}`);
        }
        lines.push(`   <i>${this.escapeHtml(item.source)}</i>`);
      }
      lines.push('');
    }

    // ARI's Take
    if (digest.ariTake.length > 0) {
      lines.push('━━━ <b>ARI\'S TAKE</b> ━━━');
      for (const insight of digest.ariTake) {
        lines.push(`▸ ${this.escapeHtml(insight)}`);
      }
      lines.push('');
    }

    // Footer
    lines.push(
      `<i>${digest.stats.sourcesScanned} sources · ${digest.stats.itemsProcessed} scanned · ${digest.stats.itemsIncluded} surfaced</i>`
    );

    return lines.join('\n');
  }

  private formatPlainText(digest: DailyDigest, dateStr: string): string {
    const lines: string[] = [];

    lines.push(`ARI DAILY INTEL — ${dateStr}`);
    lines.push('═'.repeat(40));
    lines.push('');

    if (digest.topSignal) {
      lines.push('TOP SIGNAL');
      lines.push(`  ${digest.topSignal.headline}`);
      if (digest.topSignal.url) {
        lines.push(`  ${digest.topSignal.url}`);
      }
      lines.push('');
    }

    for (const section of digest.sections) {
      lines.push(`${section.icon} ${section.title}`);
      for (const item of section.items) {
        lines.push(`  [${item.score}] ${item.headline}`);
        if (item.url) lines.push(`       ${item.url}`);
      }
      lines.push('');
    }

    if (digest.ariTake.length > 0) {
      lines.push("ARI'S TAKE");
      for (const insight of digest.ariTake) {
        lines.push(`  > ${insight}`);
      }
    }

    return lines.join('\n');
  }

  private miniScoreBar(score: number): string {
    if (score >= 80) return '▓▓▓';
    if (score >= 60) return '▓▓░';
    if (score >= 40) return '▓░░';
    return '░░░';
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  private async saveDigest(digest: DailyDigest): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0];
    const filepath = path.join(DIGEST_DIR, `${dateStr}.json`);
    await fs.writeFile(filepath, JSON.stringify(digest, null, 2));
  }
}
