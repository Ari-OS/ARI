// src/plugins/content-engine/repurposer.ts
import type { AIOrchestrator } from '../../ai/orchestrator.js';
import type { ContentDraft, ContentPlatform } from './types.js';
import { ContentDraftSchema, PLATFORM_CONSTRAINTS } from './types.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('content-repurposer');

/**
 * ContentRepurposer — Cross-platform content transformation
 *
 * Transforms content between platform formats:
 * - X thread → LinkedIn post (combine tweets, professional framing)
 * - X thread → Blog outline (expand into sections)
 * - Blog → X thread (break into tweet-sized chunks)
 * - Any → Quick take (summarize to 280 chars)
 *
 * Uses AIOrchestrator with platform-specific system prompts.
 */
export class ContentRepurposer {
  constructor(private readonly orchestrator: AIOrchestrator) {}

  /**
   * Repurpose content draft to a different platform format
   */
  async repurpose(draft: ContentDraft, targetPlatform: ContentPlatform): Promise<ContentDraft> {
    log.info({ draftId: draft.id, from: draft.platform, to: targetPlatform }, 'Repurposing content');

    const systemPrompt = this.buildSystemPrompt(draft.platform, targetPlatform);
    const userPrompt = this.buildUserPrompt(draft, targetPlatform);

    const response = await this.orchestrator.execute({
      content: userPrompt,
      category: 'analysis',
      agent: 'autonomous',
      trustLevel: 'system',
      priority: 'STANDARD',
      enableCaching: true,
      securitySensitive: false,
      systemPrompt,
      maxTokens: 2000,
    });

    const repurposedContent = this.parseResponse(response.content, targetPlatform);

    const repurposedDraft = ContentDraftSchema.parse({
      id: `${draft.id}-repurposed-${targetPlatform}`,
      topicBrief: {
        ...draft.topicBrief,
        targetPlatform,
      },
      platform: targetPlatform,
      content: repurposedContent,
      status: 'pending',
      createdAt: new Date().toISOString(),
      modelUsed: response.model,
      costUsd: response.cost,
      metadata: {
        repurposedFrom: draft.id,
        originalPlatform: draft.platform,
      },
    });

    log.info({ draftId: repurposedDraft.id, platform: targetPlatform }, 'Content repurposed');

    return repurposedDraft;
  }

  private buildSystemPrompt(fromPlatform: ContentPlatform, toPlatform: ContentPlatform): string {
    const basePrompt = `You are a content transformation expert. Transform content from ${fromPlatform} format to ${toPlatform} format while preserving core message and value.`;

    const platformGuidance: Record<ContentPlatform, string> = {
      x_thread: 'Format as a Twitter/X thread. Each tweet max 280 chars. Start with a hook.',
      x_single: 'Format as a single tweet, max 280 characters. Make it punchy and engaging.',
      linkedin: 'Format as a LinkedIn post (max 1300 chars). Professional tone, more detailed than Twitter.',
      blog_outline: 'Format as a blog outline with H2 sections and key points. 2000-3000 chars.',
      quick_take: 'Distill to a single insight, max 280 characters. Crystal clear value prop.',
    };

    return `${basePrompt}\n\nTarget platform guidance: ${platformGuidance[toPlatform]}`;
  }

  private buildUserPrompt(draft: ContentDraft, targetPlatform: ContentPlatform): string {
    const originalContent = draft.content.join('\n\n');
    const constraints = PLATFORM_CONSTRAINTS[targetPlatform];

    return `Transform this ${draft.platform} content to ${targetPlatform}:

Original content:
${originalContent}

Target format: ${targetPlatform}
Max length per part: ${constraints.maxChars} chars
Max parts: ${constraints.maxParts}

Topic: ${draft.topicBrief.headline}
Key points: ${draft.topicBrief.keyPoints.join(', ')}
Angle: ${draft.topicBrief.angle}

Return ONLY the transformed content, formatted for ${targetPlatform}. If it's a thread, separate tweets with "---".`;
  }

  private parseResponse(content: string, platform: ContentPlatform): string[] {
    const constraints = PLATFORM_CONSTRAINTS[platform];

    if (constraints.maxParts === 1) {
      return [content.trim()];
    }

    // For threads, split on "---" separator
    const parts = content
      .split('---')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    // Enforce max parts constraint
    return parts.slice(0, constraints.maxParts);
  }
}
