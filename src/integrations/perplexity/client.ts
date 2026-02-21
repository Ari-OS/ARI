/**
 * Perplexity AI Integration
 *
 * Provides real-time web research with citations via Perplexity AI API
 * Cost: ~$5/month (usage-based)
 *
 * Usage:
 *   const perplexity = new PerplexityClient(process.env.PERPLEXITY_API_KEY);
 *   const result = await perplexity.search('What is TypeScript?');
 *   const report = await perplexity.deepResearch('Market trends 2026');
 */

import { createLogger } from '../../kernel/logger.js';

const log = createLogger('perplexity-client');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PerplexityResult {
  answer: string;
  citations: string[];
  model: string;
  usage: { promptTokens: number; completionTokens: number };
}

export interface ResearchReport {
  topic: string;
  summary: string;
  keyFindings: string[];
  citations: string[];
  generatedAt: Date;
}

interface ApiResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations?: string[];
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

type FocusType = 'web' | 'academic' | 'news';

// ─── Perplexity Client ──────────────────────────────────────────────────────

export class PerplexityClient {
  private apiKey: string;
  private baseUrl = 'https://api.perplexity.ai/chat/completions';
  private model = 'sonar';                    // General search
  private deepModel = 'sonar-pro';            // Deep research reports
  private reasoningModel = 'sonar-reasoning'; // Financial/market analysis
  private cacheTtlMs = 10 * 60 * 1000; // 10 minutes
  private searchCache: Map<string, CacheEntry<PerplexityResult>> = new Map();
  private lastRequestTime = 0;
  private minRequestIntervalMs = 1200; // 50 req/min = 1200ms between requests
  private maxRetries = 3;
  private baseRetryDelayMs = 1000;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Perplexity API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Search the web with Perplexity AI
   */
  async search(query: string, focus: FocusType = 'web'): Promise<PerplexityResult> {
    const cacheKey = `${query.toLowerCase()}-${focus}`;
    const cached = this.searchCache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      log.debug(`Using cached search result for: ${query}`);
      return cached.data;
    }

    await this.rateLimit();

    const systemPrompt = this.buildSystemPrompt(focus);
    const result = await this.makeRequest(query, systemPrompt);

    this.searchCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
    log.info(`Completed search: "${query}" (focus: ${focus})`);
    return result;
  }

  /**
   * Conduct deep research on a topic with structured output
   */
  async deepResearch(topic: string, context?: string): Promise<ResearchReport> {
    await this.rateLimit();

    const systemPrompt = `You are a research assistant providing comprehensive analysis.
Structure your response as follows:

SUMMARY:
[1-2 paragraph overview]

KEY FINDINGS:
- [Finding 1]
- [Finding 2]
- [Finding 3]

Always cite sources and provide factual information.`;

    const userQuery = context
      ? `Research topic: ${topic}\n\nAdditional context: ${context}`
      : `Research topic: ${topic}`;

    const result = await this.makeRequest(userQuery, systemPrompt, this.deepModel);

    const report = this.parseResearchReport(topic, result);
    log.info(`Completed deep research: "${topic}"`);
    return report;
  }

  /**
   * Explain a market event with context
   */
  async explainMarketEvent(event: string): Promise<PerplexityResult> {
    await this.rateLimit();

    const systemPrompt = `You are a financial analyst explaining market events.
Provide clear, factual explanations with relevant context and citations.
Focus on: what happened, why it matters, and potential implications.`;

    const result = await this.makeRequest(`${event} market analysis today`, systemPrompt, this.reasoningModel);
    log.info(`Explained market event: "${event}"`);
    return result;
  }

  /**
   * Format result for briefing display
   */
  formatForBriefing(result: PerplexityResult): string {
    const lines: string[] = [];

    lines.push(result.answer);

    if (result.citations.length > 0) {
      lines.push('');
      lines.push('Sources:');
      for (const citation of result.citations.slice(0, 5)) {
        lines.push(`  - ${citation}`);
      }
    }

    return lines.join('\n');
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private buildSystemPrompt(focus: FocusType): string {
    const prompts = {
      web: 'You are a helpful AI assistant. Provide accurate, well-sourced answers based on current web information.',
      academic: 'You are an academic research assistant. Focus on scholarly sources, research papers, and peer-reviewed content.',
      news: 'You are a news analyst. Focus on recent news articles, press releases, and current events from reliable sources.',
    };

    return prompts[focus];
  }

  private async makeRequest(query: string, systemPrompt: string, model?: string): Promise<PerplexityResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model ?? this.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: query },
            ],
            return_citations: true,
            return_images: false,
          }),
        });

        if (response.status === 429) {
          const retryDelay = this.baseRetryDelayMs * Math.pow(2, attempt);
          log.warn(`Rate limited, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${this.maxRetries})`);
          await this.sleep(retryDelay);
          continue;
        }

        if (!response.ok) {
          throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as ApiResponse;

        return {
          answer: data.choices[0].message.content,
          citations: data.citations ?? [],
          model: data.model,
          usage: {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          },
        };
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const message = lastError.message;
        log.error(`Request failed (attempt ${attempt + 1}/${this.maxRetries}): ${message}`);

        if (attempt < this.maxRetries - 1) {
          const retryDelay = this.baseRetryDelayMs * Math.pow(2, attempt);
          await this.sleep(retryDelay);
        }
      }
    }

    throw new Error(`Failed to fetch from Perplexity after ${this.maxRetries} attempts: ${lastError?.message ?? 'Unknown error'}`);
  }

  private parseResearchReport(topic: string, result: PerplexityResult): ResearchReport {
    const content = result.answer;
    const summaryMatch = content.match(/SUMMARY:\s*([^]*?)(?=KEY FINDINGS:|$)/i);
    const findingsMatch = content.match(/KEY FINDINGS:\s*([^]*?)$/i);

    const summary = summaryMatch
      ? summaryMatch[1].trim()
      : content.split('\n')[0] ?? 'No summary available';

    const keyFindings: string[] = [];
    if (findingsMatch) {
      const findingsText = findingsMatch[1].trim();
      const bullets = findingsText.split('\n').filter(line => line.trim().startsWith('-'));
      keyFindings.push(...bullets.map(line => line.replace(/^-\s*/, '').trim()));
    }

    return {
      topic,
      summary,
      keyFindings: keyFindings.length > 0 ? keyFindings : [content],
      citations: result.citations,
      generatedAt: new Date(),
    };
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestIntervalMs) {
      const waitTime = this.minRequestIntervalMs - timeSinceLastRequest;
      log.debug(`Rate limiting: waiting ${waitTime}ms`);
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
