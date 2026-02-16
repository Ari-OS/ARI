// src/plugins/content-engine/intent-monitor.ts
import type { XClient } from '../../integrations/twitter/client.js';
import type { AIOrchestrator } from '../../ai/orchestrator.js';
import { BuyingIntentMatchSchema, type BuyingIntentMatch } from './types.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('intent-monitor');

/**
 * IntentMonitor — Scan X for buying intent signals
 *
 * Uses XClient to search for people who might need Pryceless Solutions' services.
 *
 * Pipeline:
 * 1. Search X for buying intent keywords
 * 2. Score each match: keyword relevance × account authority × recency
 * 3. Store matches for Telegram review
 * 4. All auto-drafted replies must go through Telegram approval — NO automated replies
 */
export class IntentMonitor {
  private readonly BUYING_INTENT_KEYWORDS = [
    'looking for IT help',
    'need developer',
    'recommend AI consultant',
    'need automation',
    'looking for freelancer',
    'need tech help',
    'anyone know a developer',
    'hiring freelance',
    'need a website',
    'looking for web developer',
    'need app developer',
    'looking for AI expert',
  ];

  private matches: Map<string, BuyingIntentMatch> = new Map();

  constructor(
    private readonly xClient: XClient | null,
    private readonly orchestrator: AIOrchestrator | null
  ) {}

  /**
   * Scan X for buying intent signals
   */
  async scan(): Promise<BuyingIntentMatch[]> {
    if (!this.xClient || !this.orchestrator) {
      log.warn('XClient or AIOrchestrator not available, skipping intent scan');
      return [];
    }

    const newMatches: BuyingIntentMatch[] = [];

    for (const keyword of this.BUYING_INTENT_KEYWORDS) {
      try {
        const result = await this.xClient.searchRecent(keyword, 10);

        for (const tweet of result.tweets) {
          const matchId = `intent-${tweet.id}`;

          // Skip if already processed
          if (this.matches.has(matchId)) {
            continue;
          }

          const matchedKeywords = this.findMatchedKeywords(tweet.text);
          if (matchedKeywords.length === 0) {
            continue;
          }

          const score = this.scoreMatch(tweet, matchedKeywords);

          // Only save matches with score >= 40 (moderate relevance)
          if (score < 40) {
            continue;
          }

          const match = BuyingIntentMatchSchema.parse({
            id: matchId,
            tweetId: tweet.id,
            authorUsername: tweet.authorUsername ?? 'unknown',
            authorFollowers: 0, // X API v2 free tier doesn't provide follower count
            tweetText: tweet.text,
            matchedKeywords,
            score,
            detectedAt: new Date().toISOString(),
            status: 'pending',
          });

          this.matches.set(matchId, match);
          newMatches.push(match);

          log.info({ matchId, score, authorUsername: match.authorUsername }, 'Buying intent detected');
        }
      } catch (error) {
        log.error({ keyword, error }, 'Failed to search for keyword');
      }
    }

    return newMatches;
  }

  /**
   * Find which keywords matched in the tweet text
   */
  private findMatchedKeywords(text: string): string[] {
    const lowerText = text.toLowerCase();
    return this.BUYING_INTENT_KEYWORDS.filter((kw) => lowerText.includes(kw.toLowerCase()));
  }

  /**
   * Score a match based on:
   * - Keyword relevance (how many keywords matched)
   * - Account authority (follower count — not available in free tier)
   * - Recency (how recent is the tweet)
   */
  private scoreMatch(
    tweet: { text: string; createdAt: string; metrics: { likes: number; retweets: number } },
    matchedKeywords: string[]
  ): number {
    // Keyword relevance: 0-40 points (10 points per keyword, max 4)
    const keywordScore = Math.min(matchedKeywords.length * 10, 40);

    // Engagement score: 0-30 points (based on likes + retweets)
    const engagementTotal = tweet.metrics.likes + tweet.metrics.retweets;
    const engagementScore = Math.min(engagementTotal * 2, 30);

    // Recency score: 0-30 points (decay over 7 days)
    const ageHours = (Date.now() - new Date(tweet.createdAt).getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.max(30 - (ageHours / 24) * 5, 0);

    return keywordScore + engagementScore + recencyScore;
  }

  /**
   * Get all pending matches (for Telegram review)
   */
  getPendingMatches(): BuyingIntentMatch[] {
    return [...this.matches.values()].filter((m) => m.status === 'pending');
  }

  /**
   * Update match status
   */
  updateMatchStatus(matchId: string, status: BuyingIntentMatch['status']): void {
    const match = this.matches.get(matchId);
    if (match) {
      match.status = status;
      this.matches.set(matchId, match);
    }
  }
}
