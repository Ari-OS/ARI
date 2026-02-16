/**
 * ARI Intelligence Scanner
 *
 * Proactive multi-source content scanner that fetches, scores, and ranks
 * content from across the web to surface what matters most to Pryce.
 *
 * Sources:
 * - AI company blogs (Anthropic, OpenAI, xAI, DeepMind, Meta AI)
 * - Tech news (Hacker News, GitHub Trending)
 * - Social (X/Twitter likes and curated lists)
 * - Research (arXiv CS.AI, CS.CL)
 * - Documentation (when updated)
 *
 * Scoring:
 * - Relevance to interest domains (AI, programming, career, investment, etc.)
 * - Recency (fresher = higher score)
 * - Source authority (verified > standard)
 * - Engagement signals (from X metrics, HN points)
 * - Deduplication via content hashing
 *
 * Output:
 * - Scored IntelligenceItem[] stored to ~/.ari/knowledge/intelligence/
 * - Events emitted via EventBus for briefing integration
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';
import {
  type KnowledgeSource,
  type InterestDomain,
  getIntelligenceSources,
} from './knowledge-sources.js';
import { KnowledgeFetcher } from './knowledge-fetcher.js';
import { XClient, type XTweet } from '../integrations/twitter/client.js';

const log = createLogger('intelligence-scanner');

const INTEL_DIR = path.join(process.env.HOME || '~', '.ari', 'knowledge', 'intelligence');
const SCAN_LOG = path.join(INTEL_DIR, 'scan-log.json');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IntelligenceItem {
  id: string;
  title: string;
  summary: string;
  url?: string;
  source: string;
  sourceCategory: string;
  domains: InterestDomain[];
  score: number; // 0-100 composite relevance score
  scoreBreakdown: {
    relevance: number;   // 0-30: keyword/domain match
    authority: number;   // 0-20: source trust level
    recency: number;     // 0-20: how fresh
    engagement: number;  // 0-15: social signals
    novelty: number;     // 0-15: not seen before
  };
  fetchedAt: string;
  contentHash: string;
  metadata?: Record<string, unknown>;
}

export interface ScanResult {
  scanId: string;
  startedAt: string;
  completedAt: string;
  sourcesScanned: number;
  itemsFound: number;
  itemsAfterDedup: number;
  topItems: IntelligenceItem[];
  errors: Array<{ source: string; error: string }>;
}

interface HackerNewsItem {
  id: number;
  title: string;
  url?: string;
  score: number;
  by: string;
  time: number;
  descendants?: number;
}

// ─── Interest Keywords (for relevance scoring) ───────────────────────────────

const INTEREST_KEYWORDS: Record<InterestDomain, string[]> = {
  ai: [
    'claude', 'anthropic', 'openai', 'gpt', 'llm', 'transformer', 'agent',
    'mcp', 'model context protocol', 'constitutional ai', 'rlhf',
    'fine-tuning', 'embedding', 'rag', 'reasoning', 'multimodal',
    'ai safety', 'alignment', 'prompt engineering', 'tool use',
    'function calling', 'context window', 'tokenizer', 'inference',
    'claude code', 'anthropic release', 'claude max', 'opus', 'sonnet',
    'ai agent framework', 'personal ai', 'local ai', 'ai assistant',
  ],
  programming: [
    'typescript', 'node.js', 'nodejs', 'deno', 'bun', 'react', 'next.js',
    'vitest', 'eslint', 'zod', 'prisma', 'drizzle', 'tRPC', 'hono',
    'vite', 'tailwind', 'web api', 'websocket', 'rest api',
    'event-driven', 'architecture', 'design pattern',
  ],
  security: [
    'vulnerability', 'injection', 'xss', 'csrf', 'owasp', 'zero-day',
    'prompt injection', 'jailbreak', 'red team', 'penetration testing',
    'supply chain', 'cve', 'security advisory',
  ],
  career: [
    'remote job', 'software engineer', 'salary', 'interview', 'hiring',
    'layoff', 'tech job', 'developer job', 'ai engineer', 'full-stack',
    'senior engineer', 'portfolio', 'resume', 'freelance',
    'remote engineer', 'typescript job', 'ai hiring', 'open call',
    '#buildinpublic', 'indie dev', 'school it', 'tech lead',
  ],
  investment: [
    'bitcoin', 'btc', 'ethereum', 'crypto', 'defi', 'pokemon tcg',
    'pokemon card', 'stock market', 'index fund', 's&p 500',
    'market crash', 'bull run', 'bear market', 'yield',
    'pokemon price', 'tcg pocket', 'charizard', 'alt art',
    'crypto news', 'solana', 'web3',
  ],
  business: [
    'saas', 'startup', 'revenue', 'bootstrapped', 'indie hacker',
    'solo founder', 'mrr', 'arr', 'pricing', 'consulting',
    'freelance', 'agency', 'small business', 'digital nomad',
    'personal brand', 'content creator', 'side project', 'monetize',
  ],
  tools: [
    'cli tool', 'dev tool', 'developer experience', 'dx', 'ide',
    'cursor', 'copilot', 'claude code', 'terminal', 'productivity',
    'automation', 'workflow', 'ci/cd', 'docker', 'kubernetes',
  ],
  general: [],
};

// ─── Intelligence Scanner ────────────────────────────────────────────────────

export class IntelligenceScanner {
  private eventBus: EventBus;
  private fetcher: KnowledgeFetcher;
  private xClient: XClient | null = null;
  private seenHashes: Set<string> = new Set();

  constructor(eventBus: EventBus, xClient?: XClient) {
    this.eventBus = eventBus;
    this.fetcher = new KnowledgeFetcher();
    this.xClient = xClient ?? null;
  }

  /**
   * Initialize scanner and load dedup cache
   */
  async init(): Promise<void> {
    await fs.mkdir(INTEL_DIR, { recursive: true });
    await this.loadSeenHashes();
  }

  /**
   * Run a full intelligence scan across all sources
   */
  async scan(): Promise<ScanResult> {
    const scanId = createHash('sha256')
      .update(new Date().toISOString())
      .digest('hex')
      .slice(0, 12);
    const startedAt = new Date().toISOString();

    log.info({ scanId }, 'Starting intelligence scan');

    this.eventBus.emit('intelligence:scan_started', { scanId, startedAt });

    const allItems: IntelligenceItem[] = [];
    const errors: Array<{ source: string; error: string }> = [];
    const sources = getIntelligenceSources();

    // 1. Scan web sources (AI blogs, docs, news)
    for (const source of sources) {
      // Skip social sources — handled separately via X client
      if (source.category === 'SOCIAL') continue;

      try {
        const items = await this.scanWebSource(source);
        allItems.push(...items);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push({ source: source.id, error: msg });
        log.error({ source: source.id, err: error }, 'Source scan failed');
      }
    }

    // 2. Scan Hacker News (special handling — JSON API)
    try {
      const hnItems = await this.scanHackerNews();
      allItems.push(...hnItems);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push({ source: 'hackernews', error: msg });
    }

    // 3. Scan X/Twitter likes
    if (this.xClient?.isReady()) {
      try {
        const xItems = await this.scanXLikes();
        allItems.push(...xItems);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push({ source: 'x-likes', error: msg });
      }
    }

    // 4. Deduplicate
    const dedupItems = this.deduplicate(allItems);

    // 5. Sort by score
    dedupItems.sort((a, b) => b.score - a.score);

    // 6. Take top items
    const topItems = dedupItems.slice(0, 50);

    const completedAt = new Date().toISOString();
    const result: ScanResult = {
      scanId,
      startedAt,
      completedAt,
      sourcesScanned: sources.length,
      itemsFound: allItems.length,
      itemsAfterDedup: dedupItems.length,
      topItems,
      errors,
    };

    // 7. Save results
    await this.saveResults(result);
    this.saveSeenHashes();

    // 8. Emit events for each high-value item
    for (const item of topItems.slice(0, 10)) {
      this.eventBus.emit('intelligence:new_item', {
        id: item.id,
        title: item.title,
        score: item.score,
        domains: item.domains,
        source: item.source,
      });
    }

    this.eventBus.emit('intelligence:scan_complete', {
      scanId,
      itemsFound: allItems.length,
      topScore: topItems[0]?.score ?? 0,
      duration: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
    });

    log.info({
      scanId,
      items: allItems.length,
      deduped: dedupItems.length,
      errors: errors.length,
    }, 'Intelligence scan complete');

    return result;
  }

  /**
   * Get the latest scan results
   */
  async getLatestResults(): Promise<ScanResult | null> {
    try {
      const data = await fs.readFile(SCAN_LOG, 'utf-8');
      return JSON.parse(data) as ScanResult;
    } catch {
      return null;
    }
  }

  // ─── Source Scanners ─────────────────────────────────────────────────────

  private async scanWebSource(source: KnowledgeSource): Promise<IntelligenceItem[]> {
    const content = await this.fetcher.fetchSource(source);
    if (!content) return [];

    // Parse the summary into individual items (for sources that list multiple things)
    const items = this.extractItems(content.summary, source);
    return items;
  }

  private async scanHackerNews(): Promise<IntelligenceItem[]> {
    const items: IntelligenceItem[] = [];

    try {
      // Fetch top story IDs
      const topResponse = await fetch(
        'https://hacker-news.firebaseio.com/v0/topstories.json',
        { headers: { 'User-Agent': 'ARI-Intelligence-Scanner/1.0' } }
      );
      const topIds = (await topResponse.json()) as number[];

      // Fetch top 30 stories
      const storyPromises = topIds.slice(0, 30).map(async (id) => {
        const resp = await fetch(
          `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
          { headers: { 'User-Agent': 'ARI-Intelligence-Scanner/1.0' } }
        );
        return (await resp.json()) as HackerNewsItem;
      });

      const stories = await Promise.all(storyPromises);

      for (const story of stories) {
        if (!story || !story.title) continue;

        const domains = this.detectDomains(story.title + ' ' + (story.url ?? ''));
        const contentHash = createHash('sha256')
          .update(story.title)
          .digest('hex')
          .slice(0, 16);

        items.push({
          id: `hn-${story.id}`,
          title: story.title,
          summary: story.title,
          url: story.url,
          source: 'Hacker News',
          sourceCategory: 'NEWS',
          domains,
          score: this.scoreItem({
            title: story.title,
            domains,
            sourceVerified: false,
            engagementScore: Math.min(story.score / 10, 15),
            isNew: !this.seenHashes.has(contentHash),
            hoursOld: (Date.now() / 1000 - story.time) / 3600,
          }),
          scoreBreakdown: {
            relevance: this.scoreRelevance(story.title, domains),
            authority: 10, // HN is curated but user-submitted
            recency: this.scoreRecency((Date.now() / 1000 - story.time) / 3600),
            engagement: Math.min(Math.round(story.score / 10), 15),
            novelty: this.seenHashes.has(contentHash) ? 0 : 15,
          },
          fetchedAt: new Date().toISOString(),
          contentHash,
          metadata: {
            hnScore: story.score,
            hnComments: story.descendants ?? 0,
            hnAuthor: story.by,
          },
        });

        this.seenHashes.add(contentHash);
      }
    } catch (error) {
      log.error({ err: error }, 'Hacker News scan failed');
    }

    return items;
  }

  private async scanXLikes(): Promise<IntelligenceItem[]> {
    if (!this.xClient?.isReady()) return [];

    const result = await this.xClient.fetchLikes(50);
    const items: IntelligenceItem[] = [];

    for (const tweet of result.tweets) {
      const text = tweet.text + ' ' + tweet.hashtags.join(' ');
      const domains = this.detectDomains(text);
      const contentHash = createHash('sha256')
        .update(tweet.text)
        .digest('hex')
        .slice(0, 16);

      // Extract the most meaningful URL from the tweet
      const primaryUrl = tweet.urls[0] ?? `https://x.com/i/status/${tweet.id}`;

      items.push({
        id: `x-${tweet.id}`,
        title: this.extractTweetTitle(tweet),
        summary: tweet.text,
        url: primaryUrl,
        source: `X/@${tweet.authorUsername ?? tweet.authorId}`,
        sourceCategory: 'SOCIAL',
        domains,
        score: this.scoreItem({
          title: tweet.text,
          domains,
          sourceVerified: false,
          engagementScore: this.scoreXEngagement(tweet),
          isNew: !this.seenHashes.has(contentHash),
          hoursOld: (Date.now() - new Date(tweet.createdAt).getTime()) / 3600000,
        }),
        scoreBreakdown: {
          relevance: this.scoreRelevance(text, domains),
          authority: 8, // Social content, moderate trust
          recency: this.scoreRecency(
            (Date.now() - new Date(tweet.createdAt).getTime()) / 3600000
          ),
          engagement: this.scoreXEngagement(tweet),
          novelty: this.seenHashes.has(contentHash) ? 0 : 15,
        },
        fetchedAt: new Date().toISOString(),
        contentHash,
        metadata: {
          authorUsername: tweet.authorUsername,
          authorName: tweet.authorName,
          likes: tweet.metrics.likes,
          retweets: tweet.metrics.retweets,
          hasLinks: tweet.urls.length > 0,
          hashtags: tweet.hashtags,
        },
      });

      this.seenHashes.add(contentHash);
    }

    return items;
  }

  // ─── Scoring ─────────────────────────────────────────────────────────────

  private scoreItem(params: {
    title: string;
    domains: InterestDomain[];
    sourceVerified: boolean;
    engagementScore: number;
    isNew: boolean;
    hoursOld: number;
  }): number {
    const relevance = this.scoreRelevance(params.title, params.domains);
    const authority = params.sourceVerified ? 20 : 10;
    const recency = this.scoreRecency(params.hoursOld);
    const engagement = Math.min(Math.round(params.engagementScore), 15);
    const novelty = params.isNew ? 15 : 0;

    return Math.min(100, relevance + authority + recency + engagement + novelty);
  }

  private scoreRelevance(text: string, domains: InterestDomain[]): number {
    const lower = text.toLowerCase();
    let maxScore = 0;

    for (const domain of domains) {
      const keywords = INTEREST_KEYWORDS[domain];
      let hits = 0;

      for (const keyword of keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          hits++;
        }
      }

      // More keyword matches = higher relevance (diminishing returns)
      const domainScore = Math.min(30, hits * 6);
      maxScore = Math.max(maxScore, domainScore);
    }

    // Boost for AI-related content (primary interest)
    if (domains.includes('ai')) {
      maxScore = Math.min(30, maxScore + 5);
    }

    return maxScore;
  }

  private scoreRecency(hoursOld: number): number {
    if (hoursOld < 6) return 20;
    if (hoursOld < 12) return 16;
    if (hoursOld < 24) return 12;
    if (hoursOld < 48) return 8;
    if (hoursOld < 72) return 4;
    return 0;
  }

  private scoreXEngagement(tweet: XTweet): number {
    const { likes, retweets, impressions } = tweet.metrics;
    // Weighted engagement signal
    const raw = (likes * 1 + retweets * 3) / Math.max(impressions / 1000, 1);
    return Math.min(15, Math.round(raw * 5));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private detectDomains(text: string): InterestDomain[] {
    const lower = text.toLowerCase();
    const detected: InterestDomain[] = [];

    for (const [domain, keywords] of Object.entries(INTEREST_KEYWORDS) as Array<[InterestDomain, string[]]>) {
      if (domain === 'general') continue;

      const hits = keywords.filter((k) => lower.includes(k.toLowerCase()));
      if (hits.length >= 1) {
        detected.push(domain);
      }
    }

    if (detected.length === 0) {
      detected.push('general');
    }

    return detected;
  }

  private extractItems(summary: string, source: KnowledgeSource): IntelligenceItem[] {
    // For HTML sources, split by line and extract meaningful items
    const lines = summary.split('\n').filter((l) => l.trim().length > 20);
    const items: IntelligenceItem[] = [];

    // Take first meaningful chunk as a single item (most blogs have one main piece)
    if (lines.length > 0) {
      const title = lines[0].slice(0, 200);
      const text = lines.slice(0, 5).join(' ').slice(0, 1000);
      const domains = source.domains ?? this.detectDomains(text);
      const contentHash = createHash('sha256')
        .update(title)
        .digest('hex')
        .slice(0, 16);

      items.push({
        id: `web-${source.id}-${contentHash}`,
        title,
        summary: text,
        url: source.url,
        source: source.name,
        sourceCategory: source.category,
        domains,
        score: this.scoreItem({
          title: text,
          domains,
          sourceVerified: source.trust === 'verified',
          engagementScore: 0,
          isNew: !this.seenHashes.has(contentHash),
          hoursOld: 12, // Assume ~12 hours for daily sources
        }),
        scoreBreakdown: {
          relevance: this.scoreRelevance(text, domains),
          authority: source.trust === 'verified' ? 20 : 10,
          recency: 12,
          engagement: 0,
          novelty: this.seenHashes.has(contentHash) ? 0 : 15,
        },
        fetchedAt: new Date().toISOString(),
        contentHash,
      });

      this.seenHashes.add(contentHash);
    }

    return items;
  }

  private extractTweetTitle(tweet: XTweet): string {
    // Use first line or first 100 chars as title
    const firstLine = tweet.text.split('\n')[0];
    if (firstLine.length <= 100) return firstLine;
    return firstLine.slice(0, 97) + '...';
  }

  private deduplicate(items: IntelligenceItem[]): IntelligenceItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.contentHash)) return false;
      seen.add(item.contentHash);
      return true;
    });
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  private async saveResults(result: ScanResult): Promise<void> {
    await fs.writeFile(SCAN_LOG, JSON.stringify(result, null, 2));

    // Also save individual items by date
    const dateDir = path.join(INTEL_DIR, new Date().toISOString().split('T')[0]);
    await fs.mkdir(dateDir, { recursive: true });

    for (const item of result.topItems) {
      const filename = `${item.id}.json`;
      await fs.writeFile(
        path.join(dateDir, filename),
        JSON.stringify(item, null, 2)
      );
    }
  }

  private async loadSeenHashes(): Promise<void> {
    try {
      const logData = await fs.readFile(SCAN_LOG, 'utf-8');
      const lastScan = JSON.parse(logData) as ScanResult;

      for (const item of lastScan.topItems) {
        this.seenHashes.add(item.contentHash);
      }
    } catch {
      // No previous scan data
    }
  }

  private saveSeenHashes(): void {
    // Prune to last 1000 hashes to prevent unbounded growth
    if (this.seenHashes.size > 1000) {
      const arr = Array.from(this.seenHashes);
      this.seenHashes = new Set(arr.slice(-1000));
    }
  }
}
