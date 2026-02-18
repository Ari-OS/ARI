/**
 * Perplexity SEO — AI Search Engine Citation Tracking
 *
 * Tracks whether Pryce's content (prycehedrick.com) is being cited by
 * AI answer engines: Perplexity, ChatGPT Search, and Claude.ai.
 *
 * This module does not make external API calls. It receives citation
 * check results from external callers (e.g., the autonomous scheduler)
 * and aggregates them into a citation report.
 *
 * Layer: Plugins (SEO Engine)
 */

import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('perplexity-seo');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CitationCheckResult {
  query: string;
  engine: 'perplexity' | 'chatgpt-search' | 'claude';
  cited: boolean;
  sourceUrl?: string;
  confidence: number;
  checkedAt: string;
}

export interface CitationReport {
  period: string;
  totalChecks: number;
  citationRate: number;
  byEngine: Record<string, { checks: number; citations: number; rate: number }>;
  topCitedUrls: string[];
  checkedAt: string;
}

// ─── Perplexity SEO ──────────────────────────────────────────────────────────

export class PerplexitySeo {
  private readonly eventBus: EventBus;
  private readonly perplexityApiKey: string | undefined;

  /** In-memory store of citation check results. Key: query:engine:timestamp */
  private readonly results = new Map<string, CitationCheckResult>();

  constructor(params: { eventBus: EventBus; perplexityApiKey?: string }) {
    this.eventBus = params.eventBus;
    this.perplexityApiKey = params.perplexityApiKey;
    log.info(
      { hasApiKey: Boolean(this.perplexityApiKey) },
      'PerplexitySeo initialized',
    );
  }

  /**
   * Record a citation check result.
   * Stored under the composite key: query:engine:checkedAt
   */
  recordCheck(result: CitationCheckResult): void {
    const key = `${result.query}:${result.engine}:${result.checkedAt}`;
    this.results.set(key, result);
    log.debug(
      { query: result.query, engine: result.engine, cited: result.cited },
      'Citation check recorded',
    );
  }

  /**
   * Aggregate citation checks from the last N days into a report.
   * Defaults to 30 days.
   */
  getCitationReport(days = 30): CitationReport {
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const period = `last ${days} days`;

    const relevant = Array.from(this.results.values()).filter(
      (r) => new Date(r.checkedAt) >= cutoff,
    );

    const totalChecks = relevant.length;
    const totalCited = relevant.filter((r) => r.cited).length;
    const citationRate = totalChecks > 0 ? (totalCited / totalChecks) * 100 : 0;

    // Aggregate by engine
    const byEngine: Record<string, { checks: number; citations: number; rate: number }> = {};
    for (const result of relevant) {
      const entry = byEngine[result.engine] ?? { checks: 0, citations: 0, rate: 0 };
      entry.checks += 1;
      if (result.cited) entry.citations += 1;
      entry.rate = entry.checks > 0 ? (entry.citations / entry.checks) * 100 : 0;
      byEngine[result.engine] = entry;
    }

    // Top cited URLs (deduplicated, sorted by frequency)
    const urlCounts = new Map<string, number>();
    for (const result of relevant) {
      if (result.cited && result.sourceUrl) {
        urlCounts.set(result.sourceUrl, (urlCounts.get(result.sourceUrl) ?? 0) + 1);
      }
    }
    const topCitedUrls = Array.from(urlCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([url]) => url)
      .slice(0, 10);

    const checkedAt = now.toISOString();
    const report: CitationReport = {
      period,
      totalChecks,
      citationRate,
      byEngine,
      topCitedUrls,
      checkedAt,
    };

    this.eventBus.emit('audit:log', {
      action: 'seo:citation_report_generated',
      agent: 'perplexity-seo',
      trustLevel: 'system',
      details: {
        period,
        totalChecks,
        citationRate,
        checkedAt,
      },
    });

    log.info({ period, totalChecks, citationRate }, 'Citation report generated');

    return report;
  }

  /**
   * Returns the most frequently checked queries, up to the given limit.
   * Defaults to top 10.
   */
  getTopQueries(limit = 10): string[] {
    const queryCounts = new Map<string, number>();
    for (const result of this.results.values()) {
      queryCounts.set(result.query, (queryCounts.get(result.query) ?? 0) + 1);
    }
    return Array.from(queryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([query]) => query)
      .slice(0, limit);
  }
}
