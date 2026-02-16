import type { AIOrchestrator } from '../../ai/orchestrator.js';
import { PLATFORM_CONSTRAINTS, type ContentEngineConfig, type ContentPlatform, type TopicBrief } from './types.js';

interface DraftResult {
  platform: ContentPlatform;
  content: string[];
  modelUsed?: string;
  costUsd?: number;
}

export class ContentDrafter {
  private orchestrator: AIOrchestrator;
  private config: ContentEngineConfig;

  constructor(orchestrator: AIOrchestrator, config: ContentEngineConfig) {
    this.orchestrator = orchestrator;
    this.config = config;
  }

  async generateDraft(brief: TopicBrief): Promise<DraftResult> {
    const systemPrompt = this.buildSystemPrompt(brief.targetPlatform);
    const userMessage = this.buildUserMessage(brief);

    const content = await this.orchestrator.chat(
      [{ role: 'user', content: userMessage }],
      systemPrompt,
      'core',
    );

    const parsed = brief.targetPlatform === 'x_thread'
      ? this.parseThreadResponse(content)
      : [content.trim()];

    return {
      platform: brief.targetPlatform,
      content: parsed,
    };
  }

  parseThreadResponse(response: string): string[] {
    // Try TWEET N: format
    const tweetPattern = /TWEET\s*\d+:\s*/gi;
    if (tweetPattern.test(response)) {
      return response
        .split(/TWEET\s*\d+:\s*/gi)
        .map((t) => t.trim())
        .filter(Boolean);
    }

    // Try numbered format (1. / 2. / 3.)
    const numberedPattern = /^\d+\.\s/m;
    if (numberedPattern.test(response)) {
      return response
        .split(/\n\n+/)
        .map((t) => t.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);
    }

    // Try double-newline split
    const paragraphs = response.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length > 1) {
      return paragraphs;
    }

    // Single block
    return [response.trim()];
  }

  private buildSystemPrompt(platform: ContentPlatform): string {
    const { voiceProfile } = this.config;
    const constraints = PLATFORM_CONSTRAINTS[platform];

    const platformInstructions: Record<ContentPlatform, string> = {
      x_thread: `Write a Twitter/X thread. Format as "TWEET 1:", "TWEET 2:", etc. ` +
        `Include a strong hook tweet, 5-7 body tweets with insights, and a CTA tweet. ` +
        `Each tweet must be under ${constraints.maxChars} characters. Max ${constraints.maxParts} tweets.`,
      x_single: `Write a single tweet. Must be under ${constraints.maxChars} characters. ` +
        `Make it punchy and insightful.`,
      linkedin: `Write a LinkedIn post. Professional but authentic tone. ` +
        `Under ${constraints.maxChars} characters. Include a hook opening line.`,
      blog_outline: `Write a blog post outline. Include: title, 4-6 H2 section headers, ` +
        `3-4 key points per section. Under ${constraints.maxChars} characters total.`,
      quick_take: `Write a 1-2 sentence hot take. Under ${constraints.maxChars} characters. ` +
        `Sharp, memorable, and opinionated.`,
    };

    return [
      `You are ${voiceProfile.persona}, a content creator.`,
      `Tone: ${voiceProfile.tone}`,
      `Target audience: ${voiceProfile.audience}`,
      `Style: ${voiceProfile.style}`,
      `Avoid: ${voiceProfile.avoids}`,
      '',
      platformInstructions[platform],
      '',
      'Output ONLY the content. No meta-commentary, no "here\'s the thread", no explanations.',
    ].join('\n');
  }

  private buildUserMessage(brief: TopicBrief): string {
    return [
      `Topic: ${brief.headline}`,
      '',
      `Key Points:`,
      ...brief.keyPoints.map((p) => `- ${p}`),
      '',
      `Angle: ${brief.angle}`,
      '',
      `Write the ${brief.targetPlatform.replace('_', ' ')} now.`,
    ].join('\n');
  }
}
