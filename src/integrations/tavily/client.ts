/**
 * Tavily Search Integration
 *
 * Real-time web research with AI-summarized answers.
 * Replaces Brave Search (dropped free tier Dec 2025).
 *
 * Free tier: 1,000 searches/month. No credit card required.
 * Best for: market catalysts, news research, anomaly "why?" queries.
 *
 * Usage:
 *   const tavily = new TavilyClient(process.env.TAVILY_API_KEY);
 *   const result = await tavily.search('Why is BTC up 8% today?');
 *   const news = await tavily.searchNews('Fed rate decision impact');
 */

import { createLogger } from '../../kernel/logger.js';

const log = createLogger('tavily-client');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TavilyResult {
  answer: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    publishedDate?: string;
  }>;
  query: string;
  responseTime: number;
}

export interface TavilySearchOptions {
  /** 'basic' for quick lookups, 'advanced' for deep research */
  searchDepth?: 'basic' | 'advanced';
  /** 'news' for time-sensitive queries, 'general' for broader research */
  topic?: 'general' | 'news';
  /** Number of results (1-20, default 5) */
  maxResults?: number;
  /** Include full article text (increases latency) */
  includeRawContent?: boolean;
  /** Days back to search (news topic only) */
  days?: number;
}

interface ApiResponse {
  answer: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    published_date?: string;
  }>;
  query: string;
  response_time: number;
}

interface CacheEntry {
  data: TavilyResult;
  expiresAt: number;
}

// ─── Tavily Client ───────────────────────────────────────────────────────────

export class TavilyClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.tavily.com/search';
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 30 * 60 * 1000; // 30 minutes
  private lastRequestAt = 0;
  private readonly minIntervalMs = 1000; // 1 req/sec max

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('Tavily API key is required');
    this.apiKey = apiKey;
  }

  /**
   * Search the web with AI-generated answer + cited sources.
   * Caches results for 30 minutes to conserve free tier budget.
   */
  async search(query: string, options: TavilySearchOptions = {}): Promise<TavilyResult> {
    const cacheKey = this.buildCacheKey(query, options);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      log.debug(`Tavily cache hit: "${query.slice(0, 50)}"`);
      return cached.data;
    }

    await this.rateLimit();

    const body = {
      api_key: this.apiKey,
      query,
      search_depth: options.searchDepth ?? 'basic',
      topic: options.topic ?? 'general',
      max_results: options.maxResults ?? 5,
      include_answer: true,
      include_raw_content: options.includeRawContent ?? false,
      include_images: false,
      ...(options.days !== undefined ? { days: options.days } : {}),
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Tavily API error: ${response.status} — ${errorText}`);
      }

      const data = await response.json() as ApiResponse;

      const result: TavilyResult = {
        answer: data.answer ?? '',
        results: data.results.map(r => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
          publishedDate: r.published_date,
        })),
        query: data.query,
        responseTime: data.response_time,
      };

      this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + this.cacheTtlMs });
      log.info(`Tavily search complete: "${query.slice(0, 60)}" (${result.results.length} results, ${result.responseTime.toFixed(1)}s)`);
      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`Tavily search failed: ${msg}`);
      throw error;
    }
  }

  /**
   * Search recent news (last 3 days) for time-sensitive queries.
   * Uses 'news' topic and 'advanced' depth for better coverage.
   */
  async searchNews(query: string, maxResults = 8): Promise<TavilyResult> {
    return this.search(query, {
      topic: 'news',
      searchDepth: 'advanced',
      maxResults,
      days: 3,
    });
  }

  /**
   * Deep research on a topic — more results, full content, advanced crawl.
   * Costs more API credits; use for critical or weekly research only.
   */
  async deepResearch(query: string, maxResults = 15): Promise<TavilyResult> {
    return this.search(query, {
      topic: 'general',
      searchDepth: 'advanced',
      maxResults,
      includeRawContent: true,
    });
  }

  /**
   * Format result for Telegram HTML display.
   */
  formatForBriefing(result: TavilyResult, maxCitations = 3): string {
    const lines: string[] = [];

    if (result.answer) {
      lines.push(result.answer.slice(0, 500));
    }

    const topResults = result.results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCitations);

    if (topResults.length > 0) {
      lines.push('');
      lines.push('Sources:');
      for (const r of topResults) {
        lines.push(`  - <a href="${r.url}">${r.title.slice(0, 80)}</a>`);
      }
    }

    return lines.join('\n');
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private buildCacheKey(query: string, options: TavilySearchOptions): string {
    return `${query.toLowerCase().trim()}|${options.searchDepth ?? 'basic'}|${options.topic ?? 'general'}`;
  }

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minIntervalMs) {
      await new Promise(resolve => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestAt = Date.now();
  }
}
