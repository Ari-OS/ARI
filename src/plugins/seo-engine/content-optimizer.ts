import { createLogger } from '../../kernel/logger.js';
import type { SEOScore } from './types.js';

const log = createLogger('seo-content-optimizer');

interface OrchestratorAdapter {
  chat: (messages: Array<{ role: string; content: string }>, systemPrompt?: string) => Promise<string>;
}

export class ContentOptimizer {
  constructor(
    private orchestrator: OrchestratorAdapter | null,
  ) {}

  async optimize(content: string, keyword: string): Promise<SEOScore> {
    if (this.orchestrator) {
      try {
        return await this.aiScore(content, keyword);
      } catch (error) {
        log.warn({ error: error instanceof Error ? error.message : String(error) }, 'AI SEO scoring failed, using heuristic');
      }
    }
    return this.heuristicScore(content, keyword);
  }

  private async aiScore(content: string, keyword: string): Promise<SEOScore> {
    const prompt = `Score this content for SEO optimization targeting keyword "${keyword}".

Rate each dimension (use the exact max values shown):
- searchIntent (0-15): Does content match the search intent for this keyword?
- keywordPlacement (0-15): Is keyword in title, H2, first 100 words, URL?
- readability (0-10): Flesch-Kincaid ≤ 8th grade, short sentences
- structure (0-10): H2/H3 hierarchy, short paragraphs, bullet points
- eatSignals (0-10): First-hand experience, citations, author expertise
- mediaRichness (0-10): Images/videos every 200-300 words
- internalLinks (0-10): 2-3 internal links minimum
- externalLinks (0-5): 2-3 authoritative external links
- faqSection (0-5): Covers People Also Ask questions
- metaOptimization (0-5): Title tag and meta description optimized
- aiDetection (0-5): Content feels human-written

Content:
${content.slice(0, 3000)}

Return JSON: { "breakdown": { ... }, "suggestions": ["..."] }
Return ONLY JSON, no markdown.`;

    const response = await this.orchestrator!.chat([{ role: 'user', content: prompt }]);
    const parsed = JSON.parse(response) as { breakdown: SEOScore['breakdown']; suggestions: string[] };
    const total = Object.values(parsed.breakdown).reduce((sum, v) => sum + (v), 0);
    return { total, breakdown: parsed.breakdown, suggestions: parsed.suggestions };
  }

  heuristicScore(content: string, keyword: string): SEOScore {
    const lower = content.toLowerCase();
    const kw = keyword.toLowerCase();
    const words = content.split(/\s+/);
    const sentences = content.split(/[.!?]+/).filter(Boolean);

    // keywordPlacement: check first 200 chars and frequency
    const first200 = lower.slice(0, 200);
    const kwInFirst200 = first200.includes(kw) ? 8 : 0;
    const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const kwFreq = (lower.match(new RegExp(escapedKw, 'g')) ?? []).length;
    const kwDensity = kwFreq / Math.max(words.length, 1);
    const keywordPlacement = Math.min(15, kwInFirst200 + Math.min(7, Math.round(kwDensity * 100)));

    // readability: based on average sentence length
    const avgSentenceLen = words.length / Math.max(sentences.length, 1);
    const readability = avgSentenceLen < 15 ? 10 : avgSentenceLen < 20 ? 7 : avgSentenceLen < 25 ? 4 : 2;

    // structure: headings and bullets
    const hasHeadings = /#{2,3}\s/.test(content) || /<h[23]/i.test(content);
    const hasBullets = /^[-*]\s/m.test(content) || /<li/i.test(content);
    const structure = (hasHeadings ? 5 : 0) + (hasBullets ? 5 : 0);

    // internalLinks: count markdown and HTML links
    const linkCount =
      (content.match(/\[.*?\]\(.*?\)/g) ?? []).length +
      (content.match(/<a\s/gi) ?? []).length;
    const internalLinks = Math.min(10, linkCount * 3);

    // faqSection: FAQ markers or questions
    const hasFaq = /faq|frequently asked|people also ask/i.test(content);
    const questionCount = (content.match(/\?/g) ?? []).length;
    const faqSection = hasFaq ? 5 : questionCount >= 3 ? 3 : questionCount >= 1 ? 1 : 0;

    const breakdown: SEOScore['breakdown'] = {
      searchIntent: kwFreq > 0 ? 10 : 3,
      keywordPlacement,
      readability,
      structure,
      eatSignals: 5,
      mediaRichness: 3,
      internalLinks,
      externalLinks: Math.min(5, linkCount),
      faqSection,
      metaOptimization: 3,
      aiDetection: 4,
    };

    const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
    const suggestions: string[] = [];
    if (!first200.includes(kw)) suggestions.push(`Add keyword "${keyword}" to the first paragraph`);
    if (!hasHeadings) suggestions.push('Add H2/H3 heading structure');
    if (!hasBullets) suggestions.push('Add bullet points for scannability');
    if (linkCount < 2) suggestions.push('Add 2-3 internal links');
    if (!hasFaq) suggestions.push('Add an FAQ section targeting People Also Ask');

    return { total, breakdown, suggestions };
  }
}
