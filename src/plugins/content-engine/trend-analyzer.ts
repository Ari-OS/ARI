// src/plugins/content-engine/trend-analyzer.ts
import type { IntelligenceItem } from '../../autonomous/intelligence-scanner.js';
import type { ContentEngineConfig, ContentPlatform, TopicBrief } from './types.js';

const THREADABLE_DOMAINS = new Set(['ai', 'programming', 'business', 'tools']);

export class TrendAnalyzer {
  private config: ContentEngineConfig;

  constructor(config: ContentEngineConfig) {
    this.config = config;
  }

  analyze(items: IntelligenceItem[]): TopicBrief[] {
    // Filter by minimum score
    const qualifying = items.filter((item) => item.score >= this.config.minThreadabilityScore);

    // Score threadability
    const scored = qualifying
      .map((item) => ({ item, threadability: this.scoreThreadability(item) }))
      .filter(({ threadability }) => threadability >= this.config.minThreadabilityScore)
      .sort((a, b) => b.threadability - a.threadability);

    // Pick diverse domains (one per domain first, then fill)
    const selected: Array<{ item: IntelligenceItem; threadability: number }> = [];
    const usedDomains = new Set<string>();

    // First pass: one per domain
    for (const entry of scored) {
      if (selected.length >= this.config.draftsPerDay) break;
      const primaryDomain = entry.item.domains[0] ?? 'general';
      if (!usedDomains.has(primaryDomain)) {
        selected.push(entry);
        usedDomains.add(primaryDomain);
      }
    }

    // Second pass: fill remaining slots with top items
    for (const entry of scored) {
      if (selected.length >= this.config.draftsPerDay) break;
      if (!selected.includes(entry)) {
        selected.push(entry);
      }
    }

    return selected.map(({ item, threadability }) => this.toBrief(item, threadability));
  }

  scoreThreadability(item: IntelligenceItem): number {
    const { relevance, engagement, novelty, recency } = item.scoreBreakdown;

    // Domain boost: threadable domains get a bonus
    const domainBoost = item.domains.some((d) => THREADABLE_DOMAINS.has(d)) ? 10 : 0;

    // Weighted score emphasizing novelty and engagement (what makes good threads)
    const weighted =
      (novelty / 15) * 30 +      // Novelty is 30% of threadability
      (engagement / 15) * 25 +    // Engagement is 25%
      (relevance / 30) * 20 +     // Relevance is 20%
      (recency / 20) * 15 +       // Recency is 15%
      domainBoost;                 // Domain boost is up to 10

    return Math.min(100, Math.round(weighted));
  }

  private toBrief(item: IntelligenceItem, threadabilityScore: number): TopicBrief {
    const platform = this.selectPlatform(item, threadabilityScore);
    return {
      headline: item.title,
      keyPoints: [item.summary],
      angle: this.generateAngle(item),
      targetPlatform: platform,
      sourceItemIds: [item.id],
      threadabilityScore,
    };
  }

  private selectPlatform(item: IntelligenceItem, threadability: number): ContentPlatform {
    // High threadability + AI/programming → thread
    if (threadability >= 75 && item.domains.some((d) => THREADABLE_DOMAINS.has(d))) {
      return 'x_thread';
    }
    // Business/career → LinkedIn
    if (item.domains.includes('business') || item.domains.includes('career')) {
      return 'linkedin';
    }
    // Medium threadability → single tweet
    if (threadability >= 60) {
      return 'x_single';
    }
    return 'quick_take';
  }

  private generateAngle(item: IntelligenceItem): string {
    const domain = item.domains[0] ?? 'tech';
    const audienceMap: Record<string, string> = {
      ai: 'How solo devs and indie hackers can leverage this',
      programming: 'Practical implications for TypeScript/Node.js builders',
      business: 'What this means for freelancers and small agencies',
      tools: 'How this fits into a modern dev workflow',
      security: 'What builders need to know to stay secure',
      career: 'Career impact for independent developers',
      investment: 'Market signal for tech-adjacent investors',
      general: 'Why this matters for the builder community',
    };
    return audienceMap[domain] ?? audienceMap.general;
  }
}
