/**
 * ARI Knowledge Fetcher
 *
 * Safely fetches content from whitelisted sources and processes it
 * for storage in the knowledge base.
 *
 * Security:
 * - Only fetches from whitelisted URLs
 * - Sanitizes all content before storage
 * - Tracks provenance for every piece of knowledge
 * - Rate limits requests to be respectful
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('knowledge-fetcher');
import { createHash } from 'node:crypto';
import {
  KnowledgeSource,
  getEnabledSources,
  getVerifiedSources,
  isWhitelistedUrl,
} from './knowledge-sources.js';

const KNOWLEDGE_DIR = path.join(process.env.HOME || '~', '.ari', 'knowledge');
const FETCH_LOG = path.join(KNOWLEDGE_DIR, 'fetch-log.json');

interface FetchedContent {
  sourceId: string;
  sourceName: string;
  url: string;
  fetchedAt: string;
  contentHash: string;
  title: string;
  summary: string;
  rawLength: number;
  trust: 'verified' | 'standard';
  category: string;
}

interface FetchLog {
  lastRun: string;
  fetched: FetchedContent[];
  errors: Array<{ sourceId: string; error: string; timestamp: string }>;
}

export class KnowledgeFetcher {
  private minRequestInterval = 2000; // 2 seconds between requests (be respectful)
  private lastRequest = 0;
  private userAgent = 'ARI-Knowledge-Fetcher/1.0 (https://github.com/Ari-OS/ARI)';

  /**
   * Initialize the knowledge directory
   */
  async init(): Promise<void> {
    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
    await fs.chmod(KNOWLEDGE_DIR, 0o700);
  }

  /**
   * Fetch content from a single source
   */
  async fetchSource(source: KnowledgeSource): Promise<FetchedContent | null> {
    // Verify it's whitelisted
    if (!isWhitelistedUrl(source.url)) {
      log.error({ url: source.url }, 'Refused to fetch non-whitelisted URL');
      return null;
    }

    // Rate limiting
    await this.rateLimit();

    try {
      const fetchUrl = source.fetchPath
        ? `${source.url}${source.fetchPath}`
        : source.url;

      const response = await fetch(fetchUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': this.getAcceptHeader(source.contentType),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawContent = await response.text();

      // Extract useful content
      const processed = this.processContent(rawContent, source);

      // Generate content hash for deduplication
      const contentHash = createHash('sha256')
        .update(processed.summary)
        .digest('hex')
        .slice(0, 16);

      return {
        sourceId: source.id,
        sourceName: source.name,
        url: fetchUrl,
        fetchedAt: new Date().toISOString(),
        contentHash,
        title: processed.title,
        summary: processed.summary,
        rawLength: rawContent.length,
        trust: source.trust,
        category: source.category,
      };
    } catch (error) {
      log.error({ source: source.name, err: error }, 'Failed to fetch source');
      return null;
    }
  }

  /**
   * Fetch all enabled sources
   */
  async fetchAll(verifiedOnly = true): Promise<FetchLog> {
    await this.init();

    const sources = verifiedOnly ? getVerifiedSources() : getEnabledSources();
    const log: FetchLog = {
      lastRun: new Date().toISOString(),
      fetched: [],
      errors: [],
    };

    for (const source of sources) {
      const content = await this.fetchSource(source);

      if (content) {
        log.fetched.push(content);

        // Save individual content file
        await this.saveContent(content);
      } else {
        log.errors.push({
          sourceId: source.id,
          error: 'Fetch failed',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Save fetch log
    await fs.writeFile(FETCH_LOG, JSON.stringify(log, null, 2));

    return log;
  }

  /**
   * Save fetched content to disk
   */
  private async saveContent(content: FetchedContent): Promise<void> {
    const categoryDir = path.join(KNOWLEDGE_DIR, content.category.toLowerCase());
    await fs.mkdir(categoryDir, { recursive: true });

    const filename = `${content.sourceId}-${content.contentHash}.json`;
    const filepath = path.join(categoryDir, filename);

    await fs.writeFile(filepath, JSON.stringify(content, null, 2));
  }

  /**
   * Process raw content based on type
   */
  private processContent(
    raw: string,
    source: KnowledgeSource
  ): { title: string; summary: string } {
    // Sanitize first - remove potential injection attempts
    const sanitized = this.sanitize(raw);

    switch (source.contentType) {
      case 'html':
        return this.processHtml(sanitized);
      case 'markdown':
        return this.processMarkdown(sanitized);
      case 'json':
        return this.processJson(sanitized);
      case 'rss':
        return this.processRss(sanitized);
      default:
        return { title: source.name, summary: sanitized.slice(0, 2000) };
    }
  }

  /**
   * Process HTML content
   */
  private processHtml(html: string): { title: string; summary: string } {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? this.decodeHtmlEntities(titleMatch[1].trim()) : 'Untitled';

    // Remove scripts, styles, and tags
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Decode HTML entities
    text = this.decodeHtmlEntities(text);

    return { title, summary: text.slice(0, 5000) };
  }

  /**
   * Process Markdown content
   */
  private processMarkdown(md: string): { title: string; summary: string } {
    // Extract first heading as title
    const titleMatch = md.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    // Remove code blocks and clean up
    const text = md
      .replace(/```[\s\S]*?```/g, '[code block]')
      .replace(/`[^`]+`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/[#*_~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return { title, summary: text.slice(0, 5000) };
  }

  /**
   * Process JSON content
   */
  private processJson(json: string): { title: string; summary: string } {
    try {
      const data = JSON.parse(json) as Record<string, unknown>;
      const title = (data.title as string) || (data.name as string) || 'JSON Data';
      const summary = JSON.stringify(data, null, 2).slice(0, 5000);
      return { title, summary };
    } catch {
      return { title: 'Invalid JSON', summary: json.slice(0, 1000) };
    }
  }

  /**
   * Process RSS feed
   */
  private processRss(rss: string): { title: string; summary: string } {
    // Extract channel title
    const titleMatch = rss.match(/<channel>[\s\S]*?<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'RSS Feed';

    // Extract item titles
    const items: string[] = [];
    const itemRegex = /<item>[\s\S]*?<title>([^<]+)<\/title>/gi;
    let match;
    while ((match = itemRegex.exec(rss)) !== null && items.length < 20) {
      items.push(`- ${match[1].trim()}`);
    }

    return { title, summary: items.join('\n').slice(0, 5000) };
  }

  /**
   * Sanitize content to remove potential injection attempts
   */
  private sanitize(text: string): string {
    return text
      // Remove potential prompt injections
      .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, '[FILTERED]')
      .replace(/you\s+are\s+now\s+(a|an|the)/gi, '[FILTERED]')
      .replace(/system\s*:\s*/gi, '[FILTERED]')
      .replace(/assistant\s*:\s*/gi, '[FILTERED]')
      .replace(/human\s*:\s*/gi, '[FILTERED]')
      // Remove base64 encoded content (could hide injections)
      .replace(/data:[^;]+;base64,[a-zA-Z0-9+/=]+/g, '[BASE64_REMOVED]')
      // Remove javascript: URLs
      .replace(/javascript:/gi, '[FILTERED]')
      // Limit consecutive special characters
      .replace(/([<>{}[\]])\1{3,}/g, '$1$1$1');
  }

  /**
   * Decode HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)));
  }

  /**
   * Rate limiting
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;

    if (elapsed < this.minRequestInterval) {
      await new Promise(r => setTimeout(r, this.minRequestInterval - elapsed));
    }

    this.lastRequest = Date.now();
  }

  /**
   * Get Accept header based on content type
   */
  private getAcceptHeader(contentType: string): string {
    switch (contentType) {
      case 'json':
        return 'application/json';
      case 'rss':
        return 'application/rss+xml, application/xml';
      case 'markdown':
        return 'text/markdown, text/plain';
      default:
        return 'text/html, */*';
    }
  }

  /**
   * Get the last fetch log
   */
  async getLastLog(): Promise<FetchLog | null> {
    try {
      const data = await fs.readFile(FETCH_LOG, 'utf-8');
      return JSON.parse(data) as FetchLog;
    } catch {
      return null;
    }
  }

  /**
   * List all stored knowledge
   */
  async listKnowledge(): Promise<FetchedContent[]> {
    await this.init();

    const results: FetchedContent[] = [];
    const categories = ['official', 'research', 'documentation'];

    for (const category of categories) {
      const categoryDir = path.join(KNOWLEDGE_DIR, category);

      try {
        const files = await fs.readdir(categoryDir);

        for (const file of files) {
          if (file.endsWith('.json')) {
            const content = await fs.readFile(path.join(categoryDir, file), 'utf-8');
            results.push(JSON.parse(content) as FetchedContent);
          }
        }
      } catch {
        // Category doesn't exist yet
      }
    }

    return results;
  }
}

// Singleton instance
export const knowledgeFetcher = new KnowledgeFetcher();
