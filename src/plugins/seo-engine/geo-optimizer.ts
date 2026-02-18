/**
 * GEO Optimizer — Generative Engine Optimization for AI Search
 *
 * Optimizes content for AI search engines (ChatGPT Search, Perplexity,
 * Claude.ai) using Generative Engine Optimization (GEO) principles.
 *
 * Unlike traditional SEO which targets crawl-based search, GEO targets
 * how LLMs retrieve and cite content in their responses.
 *
 * Key GEO signals:
 *   - Citation-ready formatting (clear claims with evidence)
 *   - Structured data (schema.org, FAQ markup)
 *   - Entity density and disambiguation
 *   - Authoritative sourcing and attribution
 *   - Concise, factual statements over filler
 *
 * Layer: Plugins (SEO Engine)
 */

import { createLogger } from '../../kernel/logger.js';

const log = createLogger('geo-optimizer');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GEOScore {
  total: number; // 0-100
  breakdown: {
    citationReadiness: number;      // 0-20
    structuredData: number;         // 0-15
    entityDensity: number;          // 0-15
    factualClaims: number;          // 0-15
    authoritySignals: number;       // 0-10
    conciseness: number;            // 0-10
    questionAnswering: number;      // 0-10
    freshness: number;              // 0-5
  };
  aiTargets: {
    chatgptSearch: number;
    perplexity: number;
    claudeAI: number;
  };
}

export interface GEOImprovement {
  category: string;
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
  currentScore: number;
  potentialScore: number;
}

export interface GEOResult {
  originalContent: string;
  optimizedContent: string;
  score: GEOScore;
  improvements: GEOImprovement[];
  optimizedAt: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Patterns that indicate citation-ready formatting */
const CITATION_PATTERNS = [
  /according to/i,
  /research (shows|indicates|suggests)/i,
  /data (from|shows)/i,
  /\d+%/,                           // Statistics
  /\d{4}/,                          // Year references
  /studies? (show|find|indicate)/i,
  /\[source\]|\[citation\]/i,
  /published (in|by|on)/i,
];

/** Structured data indicators */
const STRUCTURE_PATTERNS = [
  /^#{1,3}\s/m,                     // Headings
  /^\d+\.\s/m,                      // Numbered lists
  /^[-*]\s/m,                       // Bullet lists
  /\|.*\|.*\|/,                     // Tables
  /^>\s/m,                          // Blockquotes
  /```/,                            // Code blocks
];

/** Question patterns that LLMs look for in Q&A */
const QA_PATTERNS = [
  /^(what|how|why|when|where|who|which|can|does|is|are|should)\s/im,
  /\?$/m,
  /FAQ/i,
  /frequently asked/i,
];

/** Authority signal patterns */
const AUTHORITY_PATTERNS = [
  /expert/i,
  /years? of experience/i,
  /certified/i,
  /founder|CEO|CTO/i,
  /proven/i,
  /case study/i,
  /testimonial/i,
  /award/i,
];

/** Filler patterns that reduce GEO score */
const FILLER_PATTERNS = [
  /in today's (fast-paced|digital|modern)/i,
  /it('s| is) no secret that/i,
  /at the end of the day/i,
  /when it comes to/i,
  /in (this|the) article/i,
  /without further ado/i,
  /let('s| us) (dive|get started)/i,
  /you('re| are) not alone/i,
];

// ─── GeoOptimizer ───────────────────────────────────────────────────────────

export class GeoOptimizer {
  /**
   * Optimize content for AI search engines
   */
  optimizeForAI(content: string): GEOResult {
    const score = this.scoreGEO(content);
    const improvements = this.suggestImprovements(content);
    const optimizedContent = this.applyOptimizations(content, improvements);

    const result: GEOResult = {
      originalContent: content,
      optimizedContent,
      score,
      improvements,
      optimizedAt: new Date().toISOString(),
    };

    log.info({ score: score.total, improvementCount: improvements.length }, 'Content GEO-optimized');

    return result;
  }

  /**
   * Score content for GEO readiness
   */
  scoreGEO(content: string): GEOScore {
    const citationReadiness = this.scoreCitationReadiness(content);
    const structuredData = this.scoreStructuredData(content);
    const entityDensity = this.scoreEntityDensity(content);
    const factualClaims = this.scoreFactualClaims(content);
    const authoritySignals = this.scoreAuthoritySignals(content);
    const conciseness = this.scoreConciseness(content);
    const questionAnswering = this.scoreQuestionAnswering(content);
    const freshness = this.scoreFreshness(content);

    const total = citationReadiness + structuredData + entityDensity +
      factualClaims + authoritySignals + conciseness + questionAnswering + freshness;

    // Per-engine scores (different engines weight signals differently)
    const chatgptSearch = Math.round(
      citationReadiness * 1.2 + structuredData + entityDensity +
      factualClaims * 1.1 + authoritySignals + conciseness +
      questionAnswering * 0.8 + freshness,
    );
    const perplexity = Math.round(
      citationReadiness * 1.3 + structuredData * 0.8 + entityDensity * 1.1 +
      factualClaims * 1.2 + authoritySignals * 1.1 + conciseness * 0.9 +
      questionAnswering * 1.1 + freshness * 1.2,
    );
    const claudeAI = Math.round(
      citationReadiness + structuredData * 1.1 + entityDensity +
      factualClaims + authoritySignals * 0.9 + conciseness * 1.2 +
      questionAnswering + freshness,
    );

    return {
      total: Math.round(total),
      breakdown: {
        citationReadiness,
        structuredData,
        entityDensity,
        factualClaims,
        authoritySignals,
        conciseness,
        questionAnswering,
        freshness,
      },
      aiTargets: {
        chatgptSearch: Math.min(100, chatgptSearch),
        perplexity: Math.min(100, perplexity),
        claudeAI: Math.min(100, claudeAI),
      },
    };
  }

  /**
   * Suggest specific improvements for the content
   */
  suggestImprovements(content: string): GEOImprovement[] {
    const improvements: GEOImprovement[] = [];
    const score = this.scoreGEO(content);

    // Citation readiness
    if (score.breakdown.citationReadiness < 12) {
      improvements.push({
        category: 'Citation Readiness',
        priority: 'high',
        suggestion: 'Add specific statistics, research references, and attributable claims. LLMs prefer content they can cite directly.',
        currentScore: score.breakdown.citationReadiness,
        potentialScore: 18,
      });
    }

    // Structured data
    if (score.breakdown.structuredData < 8) {
      improvements.push({
        category: 'Structured Data',
        priority: 'high',
        suggestion: 'Add clear headings (H2/H3), bullet/numbered lists, and tables. Structured content is easier for LLMs to parse and quote.',
        currentScore: score.breakdown.structuredData,
        potentialScore: 13,
      });
    }

    // Entity density
    if (score.breakdown.entityDensity < 8) {
      improvements.push({
        category: 'Entity Density',
        priority: 'medium',
        suggestion: 'Include specific named entities (people, companies, products, locations). Entity-rich content ranks higher in AI retrieval.',
        currentScore: score.breakdown.entityDensity,
        potentialScore: 13,
      });
    }

    // Factual claims
    if (score.breakdown.factualClaims < 8) {
      improvements.push({
        category: 'Factual Claims',
        priority: 'high',
        suggestion: 'Replace vague statements with specific, verifiable claims. Include numbers, dates, and measurable outcomes.',
        currentScore: score.breakdown.factualClaims,
        potentialScore: 13,
      });
    }

    // Conciseness
    if (score.breakdown.conciseness < 5) {
      improvements.push({
        category: 'Conciseness',
        priority: 'medium',
        suggestion: 'Remove filler phrases ("in today\'s fast-paced world", "it\'s no secret"). LLMs prefer direct, information-dense text.',
        currentScore: score.breakdown.conciseness,
        potentialScore: 9,
      });
    }

    // Q&A format
    if (score.breakdown.questionAnswering < 5) {
      improvements.push({
        category: 'Question Answering',
        priority: 'medium',
        suggestion: 'Add FAQ sections or structure content as questions and answers. AI search engines prioritize direct answer content.',
        currentScore: score.breakdown.questionAnswering,
        potentialScore: 9,
      });
    }

    // Authority signals
    if (score.breakdown.authoritySignals < 5) {
      improvements.push({
        category: 'Authority Signals',
        priority: 'low',
        suggestion: 'Include author credentials, case studies, or testimonials. Authority indicators improve citation likelihood.',
        currentScore: score.breakdown.authoritySignals,
        potentialScore: 9,
      });
    }

    // Sort by priority
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    improvements.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return improvements;
  }

  // ─── Scoring Functions ──────────────────────────────────────────────────────

  private scoreCitationReadiness(content: string): number {
    let score = 0;
    for (const pattern of CITATION_PATTERNS) {
      if (pattern.test(content)) score += 2.5;
    }
    return Math.min(20, Math.round(score));
  }

  private scoreStructuredData(content: string): number {
    let score = 0;
    for (const pattern of STRUCTURE_PATTERNS) {
      if (pattern.test(content)) score += 2.5;
    }
    return Math.min(15, Math.round(score));
  }

  private scoreEntityDensity(content: string): number {
    // Count capitalized multi-word phrases (proxy for named entities)
    const entityPattern = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/g;
    const matches = content.match(entityPattern) ?? [];
    const words = content.split(/\s+/).length;
    const density = words > 0 ? matches.length / words : 0;

    // Also count @mentions, #hashtags, $tickers
    const specialEntities = (content.match(/[@#$]\w+/g) ?? []).length;

    const raw = density * 300 + specialEntities * 2;
    return Math.min(15, Math.round(raw));
  }

  private scoreFactualClaims(content: string): number {
    let score = 0;

    // Numbers and statistics
    const numbers = (content.match(/\d+\.?\d*/g) ?? []).length;
    score += Math.min(6, numbers * 1.5);

    // Comparative/superlative claims
    const comparatives = (content.match(/\b(more|less|better|worse|faster|higher|lower|largest|smallest)\b/gi) ?? []).length;
    score += Math.min(4, comparatives);

    // Specific time references
    const timeRefs = (content.match(/\b(20\d{2}|Q[1-4]|January|February|March|April|May|June|July|August|September|October|November|December)\b/gi) ?? []).length;
    score += Math.min(5, timeRefs * 1.5);

    return Math.min(15, Math.round(score));
  }

  private scoreAuthoritySignals(content: string): number {
    let score = 0;
    for (const pattern of AUTHORITY_PATTERNS) {
      if (pattern.test(content)) score += 1.5;
    }
    return Math.min(10, Math.round(score));
  }

  private scoreConciseness(content: string): number {
    const words = content.split(/\s+/).length;
    const sentences = content.split(/[.!?]+/).filter(Boolean).length;
    const avgWordsPerSentence = sentences > 0 ? words / sentences : 0;

    let score = 10;

    // Penalize filler
    for (const pattern of FILLER_PATTERNS) {
      if (pattern.test(content)) score -= 1.5;
    }

    // Penalize overly long sentences (avg > 25 words)
    if (avgWordsPerSentence > 25) score -= 2;

    // Penalize excessive length without structure
    if (words > 2000 && !STRUCTURE_PATTERNS[0].test(content)) score -= 2;

    return Math.max(0, Math.min(10, Math.round(score)));
  }

  private scoreQuestionAnswering(content: string): number {
    let score = 0;
    for (const pattern of QA_PATTERNS) {
      if (pattern.test(content)) score += 2.5;
    }
    return Math.min(10, Math.round(score));
  }

  private scoreFreshness(content: string): number {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    let score = 0;
    if (content.includes(String(currentYear))) score += 3;
    if (content.includes(String(lastYear))) score += 2;

    return Math.min(5, score);
  }

  // ─── Optimization ─────────────────────────────────────────────────────────

  private applyOptimizations(content: string, _improvements: GEOImprovement[]): string {
    let optimized = content;

    // Remove common filler phrases
    for (const pattern of FILLER_PATTERNS) {
      optimized = optimized.replace(pattern, '');
    }

    // Clean up double spaces from removals
    optimized = optimized.replace(/\s{2,}/g, ' ').trim();

    return optimized;
  }
}
