// src/plugins/content-engine/engagement-bot.ts
import type { XClient } from '../../integrations/twitter/client.js';
import type { AIOrchestrator } from '../../ai/orchestrator.js';
import { EngagementOpportunitySchema, type EngagementOpportunity } from './types.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('engagement-bot');

/**
 * EngagementBot — Automated X engagement (with approval gates)
 *
 * ALL actions require approval via Telegram:
 * - Draft likes/retweets for relevant posts
 * - Draft quote-tweets with value-added commentary
 * - Nothing is automated — everything goes through DraftQueue for approval
 *
 * Target engagement topics:
 * - AI development, automation, indie hacking
 * - Small business tech, solopreneur tools
 * - Web development, TypeScript, React
 */
export class EngagementBot {
  private readonly ENGAGEMENT_TOPICS = [
    'AI automation',
    'indie hacker',
    'solopreneur',
    'small business tech',
    'TypeScript',
    'React',
    'web development',
    'freelance developer',
    'build in public',
    'AI agent',
    'claude ai',
    'anthropic',
  ];

  private opportunities: Map<string, EngagementOpportunity> = new Map();

  constructor(
    private readonly xClient: XClient | null,
    private readonly orchestrator: AIOrchestrator | null
  ) {}

  /**
   * Find engagement opportunities (likes, retweets, quote-tweets)
   */
  async findEngagementOpportunities(): Promise<EngagementOpportunity[]> {
    if (!this.xClient || !this.orchestrator) {
      log.warn('XClient or AIOrchestrator not available, skipping engagement scan');
      return [];
    }

    const newOpportunities: EngagementOpportunity[] = [];

    for (const topic of this.ENGAGEMENT_TOPICS) {
      try {
        const result = await this.xClient.searchRecent(topic, 10);

        for (const tweet of result.tweets) {
          const oppId = `engagement-${tweet.id}`;

          // Skip if already processed
          if (this.opportunities.has(oppId)) {
            continue;
          }

          const relevanceScore = this.scoreRelevance(tweet.text, tweet.metrics);

          // Only save opportunities with score >= 50 (moderate relevance)
          if (relevanceScore < 50) {
            continue;
          }

          const type = this.determineEngagementType(tweet.text, relevanceScore);

          const opportunity = EngagementOpportunitySchema.parse({
            id: oppId,
            type,
            tweetId: tweet.id,
            authorUsername: tweet.authorUsername ?? 'unknown',
            tweetText: tweet.text,
            relevanceScore,
            status: 'pending',
            detectedAt: new Date().toISOString(),
          });

          this.opportunities.set(oppId, opportunity);
          newOpportunities.push(opportunity);

          log.info({ oppId, type, score: relevanceScore }, 'Engagement opportunity found');
        }
      } catch (error) {
        log.error({ topic, error }, 'Failed to search for engagement topic');
      }
    }

    return newOpportunities;
  }

  /**
   * Score tweet relevance based on:
   * - Topic match strength
   * - Engagement metrics (likes, retweets)
   * - Content quality signals
   */
  private scoreRelevance(
    text: string,
    metrics: { likes: number; retweets: number; replies: number }
  ): number {
    const lowerText = text.toLowerCase();

    // Topic match: 0-40 points
    const matchedTopics = this.ENGAGEMENT_TOPICS.filter((topic) =>
      lowerText.includes(topic.toLowerCase())
    );
    const topicScore = Math.min(matchedTopics.length * 10, 40);

    // Engagement score: 0-30 points
    const engagementTotal = metrics.likes + metrics.retweets + metrics.replies;
    const engagementScore = Math.min(Math.log(engagementTotal + 1) * 10, 30);

    // Quality signals: 0-30 points
    let qualityScore = 0;
    if (text.includes('?')) qualityScore += 10; // Questions invite engagement
    if (text.length > 100) qualityScore += 10; // Substantive content
    if (/https?:\/\//.test(text)) qualityScore += 10; // Has links (evidence/resources)

    return topicScore + engagementScore + qualityScore;
  }

  /**
   * Determine best engagement type based on content and score
   */
  private determineEngagementType(
    text: string,
    score: number
  ): EngagementOpportunity['type'] {
    // High-quality, substantive content deserves a quote-tweet
    if (score >= 80 && text.length > 150) {
      return 'quote_tweet';
    }

    // Questions or discussions → reply
    if (text.includes('?') || text.toLowerCase().includes('what do you think')) {
      return 'reply';
    }

    // Good content → retweet
    if (score >= 70) {
      return 'retweet';
    }

    // Default → like
    return 'like';
  }

  /**
   * Get pending opportunities (for Telegram approval)
   */
  getPendingOpportunities(): EngagementOpportunity[] {
    return [...this.opportunities.values()].filter((o) => o.status === 'pending');
  }

  /**
   * Update opportunity status
   */
  updateOpportunityStatus(oppId: string, status: EngagementOpportunity['status']): void {
    const opportunity = this.opportunities.get(oppId);
    if (opportunity) {
      opportunity.status = status;
      this.opportunities.set(oppId, opportunity);
    }
  }

  /**
   * Draft a quote-tweet comment using AI
   */
  async draftQuoteTweetComment(tweet: { text: string; authorUsername: string }): Promise<string> {
    if (!this.orchestrator) {
      throw new Error('AIOrchestrator not available');
    }

    const systemPrompt = `You are @PayThePryce, a pragmatic AI/automation consultant who helps solopreneurs and small businesses.
Your voice: Direct, no fluff, actionable insights.
You add value through: concrete examples, clarifying questions, or complementary perspectives.
Avoid: generic praise, obvious observations, corporate jargon.`;

    const userPrompt = `Draft a quote-tweet comment for this tweet by @${tweet.authorUsername}:

"${tweet.text}"

Your comment should:
1. Add genuine value (insight, example, or perspective)
2. Be 1-2 sentences max (under 200 chars)
3. Sound natural and conversational
4. Relate to ARI, automation, or small business tech if relevant

Return ONLY the comment text, no quotes or metadata.`;

    const response = await this.orchestrator.execute({
      content: userPrompt,
      category: 'chat',
      agent: 'autonomous',
      trustLevel: 'system',
      priority: 'STANDARD',
      enableCaching: true,
      securitySensitive: false,
      systemPrompt,
      maxTokens: 150,
    });

    return response.content.trim();
  }
}
