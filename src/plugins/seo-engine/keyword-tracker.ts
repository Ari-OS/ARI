import { createLogger } from '../../kernel/logger.js';
import type { KeywordData, SEOContentBrief } from './types.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const log = createLogger('seo-keyword-tracker');

interface OrchestratorAdapter {
  chat: (messages: Array<{ role: string; content: string }>, systemPrompt?: string) => Promise<string>;
}

export class KeywordTracker {
  private keywords: Map<string, KeywordData> = new Map();
  private persistPath: string;

  constructor(
    private orchestrator: OrchestratorAdapter,
    private dataDir: string,
  ) {
    this.persistPath = path.join(dataDir, 'keywords.json');
  }

  async init(): Promise<void> {
    try {
      const data = await fs.readFile(this.persistPath, 'utf-8');
      const parsed = JSON.parse(data) as Record<string, KeywordData>;
      for (const [key, value] of Object.entries(parsed)) {
        this.keywords.set(key, value);
      }
      log.info({ count: this.keywords.size }, 'Keywords loaded from disk');
    } catch {
      log.info('No persisted keywords, starting fresh');
    }
  }

  async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.persistPath), { recursive: true });
    const obj: Record<string, KeywordData> = {};
    for (const [key, value] of this.keywords) {
      obj[key] = value;
    }
    await fs.writeFile(this.persistPath, JSON.stringify(obj, null, 2));
  }

  async discoverKeywords(niche: string, count: number = 10): Promise<KeywordData[]> {
    const prompt = `Suggest ${count} low-competition long-tail keywords for the niche: "${niche}".
Focus on keywords with:
- Monthly search volume > 100
- Keyword difficulty < 30
- Commercial or informational intent

Return as JSON array of objects with: keyword, volume (estimated), difficulty (0-100), intent.
Return ONLY the JSON array, no markdown.`;

    try {
      const response = await this.orchestrator.chat([{ role: 'user', content: prompt }]);
      const keywords = JSON.parse(response) as KeywordData[];
      for (const kw of keywords) {
        this.keywords.set(kw.keyword, kw);
      }
      await this.save();
      return keywords;
    } catch (error) {
      log.error({ error: error instanceof Error ? error.message : String(error) }, 'Keyword discovery failed');
      return [];
    }
  }

  async generateContentBrief(keyword: string): Promise<SEOContentBrief> {
    const prompt = `Generate a comprehensive SEO content brief for the keyword: "${keyword}".

Include:
- Search intent (informational/commercial/transactional)
- Target word count
- Suggested title (SEO-optimized)
- 5-8 suggested H2/H3 headings
- 10 LSI/related keywords
- 5 FAQs (from "People Also Ask")
- 3 competitor insights

Return as JSON matching this structure:
{
  "keyword": "${keyword}",
  "intent": "...",
  "targetWordCount": ...,
  "suggestedTitle": "...",
  "suggestedHeadings": [...],
  "lsiKeywords": [...],
  "faqs": [...],
  "competitorInsights": [...]
}
Return ONLY the JSON, no markdown.`;

    const response = await this.orchestrator.chat([{ role: 'user', content: prompt }]);
    return JSON.parse(response) as SEOContentBrief;
  }

  addKeyword(keyword: KeywordData): void {
    this.keywords.set(keyword.keyword, keyword);
  }

  getKeywords(): KeywordData[] {
    return Array.from(this.keywords.values());
  }

  getKeyword(keyword: string): KeywordData | undefined {
    return this.keywords.get(keyword);
  }

  getTrackedCount(): number {
    return this.keywords.size;
  }
}
