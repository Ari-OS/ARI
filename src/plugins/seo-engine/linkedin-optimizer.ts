import { createLogger } from '../../kernel/logger.js';

const log = createLogger('seo-linkedin-optimizer');

interface OrchestratorAdapter {
  chat: (messages: Array<{ role: string; content: string }>, systemPrompt?: string) => Promise<string>;
}

export interface LinkedInOptimization {
  optimizedContent: string;
  suggestedTitle: string;
  suggestedHashtags: string[];
  estimatedReadTime: number;
}

export class LinkedInOptimizer {
  constructor(
    private orchestrator: OrchestratorAdapter,
  ) {}

  async optimizeArticle(content: string, keyword: string): Promise<LinkedInOptimization> {
    const systemPrompt = `You are an SEO expert specializing in LinkedIn article optimization.
LinkedIn articles rank faster than traditional sites due to high domain authority.
Optimize for both LinkedIn's internal search and Google indexing.`;

    const prompt = `Optimize this content for LinkedIn, targeting keyword "${keyword}".

Requirements:
- Title: Include keyword, under 100 chars, compelling for LinkedIn audience
- Content: Add keyword naturally 3-5 times, professional tone
- Hashtags: 3-5 relevant LinkedIn hashtags
- Structure: Short paragraphs (2-3 sentences), use bold for key points

Content:
${content.slice(0, 4000)}

Return JSON:
{
  "optimizedContent": "...",
  "suggestedTitle": "...",
  "suggestedHashtags": ["#...", ...]
}
Return ONLY JSON.`;

    try {
      const response = await this.orchestrator.chat([{ role: 'user', content: prompt }], systemPrompt);
      const parsed = JSON.parse(response) as {
        optimizedContent: string;
        suggestedTitle: string;
        suggestedHashtags: string[];
      };
      const wordCount = parsed.optimizedContent.split(/\s+/).length;
      return {
        ...parsed,
        estimatedReadTime: Math.ceil(wordCount / 200),
      };
    } catch (error) {
      log.error({ error: error instanceof Error ? error.message : String(error) }, 'LinkedIn optimization failed');
      throw error;
    }
  }
}
