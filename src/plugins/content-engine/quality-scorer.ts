import type { AIOrchestrator } from '../../ai/orchestrator.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('content-quality-scorer');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface QualityBreakdown {
  searchIntent: number;        // 0-15
  keywordOptimization: number; // 0-15
  readability: number;         // 0-15
  structure: number;           // 0-15
  engagement: number;          // 0-10
  originality: number;         // 0-10
  platformFit: number;         // 0-10
  voiceMatch: number;          // 0-10
}

export interface QualityScore {
  total: number;        // 0-100
  passed: boolean;      // total >= 70
  breakdown: QualityBreakdown;
  suggestions: string[];
}

export interface ScoredDraft {
  content: string;
  platform: string;
  topicBrief: {
    headline: string;
    keywords?: string[];
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM LIMITS
// ═══════════════════════════════════════════════════════════════════════════════

const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  x_single: 280,
  x_thread: 280,
  quick_take: 280,
  linkedin: 1300,
  blog_outline: 3000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCORER
// ═══════════════════════════════════════════════════════════════════════════════

export class ContentQualityScorer {
  private readonly PASS_THRESHOLD = 70;

  constructor(private readonly orchestrator: AIOrchestrator) {}

  async score(draft: ScoredDraft): Promise<QualityScore> {
    try {
      const prompt = this.buildScoringPrompt(draft);
      const response = await this.orchestrator.chat(
        [{ role: 'user', content: prompt }],
        'You are a content quality evaluator. Respond only with valid JSON.',
        'core',
      );
      return this.parseScoreResponse(response, draft);
    } catch (error) {
      log.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'AI scoring failed, using heuristic fallback',
      );
      return this.heuristicScore(draft);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: PROMPT BUILDER
  // ─────────────────────────────────────────────────────────────────────────

  private buildScoringPrompt(draft: ScoredDraft): string {
    const keywordList = draft.topicBrief.keywords?.join(', ') ?? 'none provided';
    const charLimit = PLATFORM_CHAR_LIMITS[draft.platform] ?? 1000;

    return [
      `Score the following ${draft.platform} content for quality.`,
      '',
      `Headline: ${draft.topicBrief.headline}`,
      `Target keywords: ${keywordList}`,
      `Platform char limit: ${charLimit}`,
      `Content length: ${draft.content.length} characters`,
      '',
      '---CONTENT START---',
      draft.content,
      '---CONTENT END---',
      '',
      'Rate each dimension and provide suggestions. Respond with ONLY valid JSON:',
      '{',
      '  "searchIntent": <0-15>,',
      '  "keywordOptimization": <0-15>,',
      '  "readability": <0-15>,',
      '  "structure": <0-15>,',
      '  "engagement": <0-10>,',
      '  "originality": <0-10>,',
      '  "platformFit": <0-10>,',
      '  "voiceMatch": <0-10>,',
      '  "suggestions": ["<actionable suggestion>", ...]',
      '}',
      '',
      'Criteria:',
      '- searchIntent (0-15): Does content address likely user intent behind the headline?',
      '- keywordOptimization (0-15): Are target keywords naturally present?',
      '- readability (0-15): Clear sentences, appropriate length, easy to follow?',
      '- structure (0-15): Has hook, body, conclusion? Uses formatting if appropriate?',
      '- engagement (0-10): Asks questions, uses hooks, has CTAs?',
      '- originality (0-10): Fresh perspective, avoids clichés?',
      `- platformFit (0-10): Fits ${draft.platform} conventions and stays within ${charLimit} chars?`,
      '- voiceMatch (0-10): Matches @PayThePryce voice (pragmatic, direct, no fluff)?',
    ].join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: RESPONSE PARSER
  // ─────────────────────────────────────────────────────────────────────────

  private parseScoreResponse(response: string, draft: ScoredDraft): QualityScore {
    try {
      // Extract JSON from response (handles markdown code fences)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      const breakdown: QualityBreakdown = {
        searchIntent: this.clamp(Number(parsed['searchIntent'] ?? 0), 0, 15),
        keywordOptimization: this.clamp(Number(parsed['keywordOptimization'] ?? 0), 0, 15),
        readability: this.clamp(Number(parsed['readability'] ?? 0), 0, 15),
        structure: this.clamp(Number(parsed['structure'] ?? 0), 0, 15),
        engagement: this.clamp(Number(parsed['engagement'] ?? 0), 0, 10),
        originality: this.clamp(Number(parsed['originality'] ?? 0), 0, 10),
        platformFit: this.clamp(Number(parsed['platformFit'] ?? 0), 0, 10),
        voiceMatch: this.clamp(Number(parsed['voiceMatch'] ?? 0), 0, 10),
      };

      const rawSuggestions = parsed['suggestions'];
      const suggestions = Array.isArray(rawSuggestions)
        ? rawSuggestions.filter((s): s is string => typeof s === 'string')
        : [];

      const total = this.sumBreakdown(breakdown);

      return {
        total,
        passed: total >= this.PASS_THRESHOLD,
        breakdown,
        suggestions,
      };
    } catch (parseError) {
      log.warn(
        { error: parseError instanceof Error ? parseError.message : String(parseError) },
        'Failed to parse AI score response, falling back to heuristic',
      );
      return this.heuristicScore(draft);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: HEURISTIC FALLBACK
  // ─────────────────────────────────────────────────────────────────────────

  heuristicScore(draft: ScoredDraft): QualityScore {
    const { content, platform, topicBrief } = draft;
    const suggestions: string[] = [];

    // readability (0-15): penalise very long sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.length > 0
      ? content.length / sentences.length
      : content.length;
    let readability = 15;
    if (avgSentenceLength > 200) {
      readability = 8;
      suggestions.push('Break long sentences into shorter ones for better readability.');
    } else if (avgSentenceLength > 120) {
      readability = 11;
      suggestions.push('Consider shortening some sentences for clarity.');
    }

    // structure (0-15): headings and bullet points indicate structure
    const hasHeadings = /^#{1,3}\s/m.test(content);
    const hasBullets = /^[-*•]\s/m.test(content) || /^\d+\.\s/m.test(content);
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
    let structure = 0;
    if (hasHeadings) structure += 6;
    if (hasBullets) structure += 5;
    if (paragraphs.length >= 2) structure += 4;
    structure = Math.min(structure, 15);
    if (!hasHeadings && !hasBullets) {
      suggestions.push('Add headings or bullet points to improve content structure.');
    }

    // platformFit (0-10): check character count vs platform limit
    const charLimit = PLATFORM_CHAR_LIMITS[platform] ?? 1000;
    let platformFit = 10;
    if (content.length > charLimit) {
      platformFit = 0;
      suggestions.push(`Content exceeds ${platform} limit of ${charLimit} characters (currently ${content.length}).`);
    } else if (content.length < charLimit * 0.1) {
      platformFit = 5;
      suggestions.push(`Content seems very short for ${platform}. Consider expanding.`);
    }

    // engagement (0-10): questions, hooks, CTAs
    const hasQuestion = /\?/.test(content);
    const hasCta = /follow|subscribe|share|like|click|visit|learn more|get started|try/i.test(content);
    const hasHook = sentences.length > 0 && (sentences[0]?.length ?? 0) < 100;
    let engagement = 0;
    if (hasQuestion) engagement += 3;
    if (hasCta) engagement += 4;
    if (hasHook) engagement += 3;
    engagement = Math.min(engagement, 10);
    if (!hasCta) {
      suggestions.push('Add a call-to-action to boost engagement.');
    }
    if (!hasQuestion) {
      suggestions.push('Consider adding a question to invite audience interaction.');
    }

    // keywordOptimization (0-15): keyword presence
    const keywords = topicBrief.keywords ?? [];
    let keywordOptimization = 0;
    if (keywords.length === 0) {
      keywordOptimization = 8; // neutral — no keywords to check
    } else {
      const lowerContent = content.toLowerCase();
      const foundCount = keywords.filter(kw => lowerContent.includes(kw.toLowerCase())).length;
      keywordOptimization = Math.round((foundCount / keywords.length) * 15);
      if (foundCount < keywords.length) {
        const missing = keywords.filter(kw => !lowerContent.includes(kw.toLowerCase()));
        suggestions.push(`Incorporate missing keywords: ${missing.join(', ')}.`);
      }
    }

    // searchIntent (0-15): headline topic appears in content
    const headlineWords = topicBrief.headline.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const lowerContent = content.toLowerCase();
    const headlineWordMatches = headlineWords.filter(w => lowerContent.includes(w)).length;
    const searchIntent = headlineWords.length > 0
      ? Math.round((headlineWordMatches / headlineWords.length) * 15)
      : 10;
    if (searchIntent < 8) {
      suggestions.push('Content does not clearly address the headline topic — align more closely.');
    }

    // originality (0-10): heuristic defaults to mid-range (cannot evaluate originality without AI)
    const originality = 7;

    // voiceMatch (0-10): check for jargon / fluff indicators
    const hasFluff = /\b(leverage|synergy|paradigm|holistic|robust|utilize|facilitate)\b/i.test(content);
    const voiceMatch = hasFluff ? 5 : 8;
    if (hasFluff) {
      suggestions.push('Remove corporate jargon (e.g. leverage, synergy, paradigm) to match the direct voice.');
    }

    const breakdown: QualityBreakdown = {
      searchIntent,
      keywordOptimization,
      readability,
      structure,
      engagement,
      originality,
      platformFit,
      voiceMatch,
    };

    const total = this.sumBreakdown(breakdown);

    return {
      total,
      passed: total >= this.PASS_THRESHOLD,
      breakdown,
      suggestions,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: UTILITIES
  // ─────────────────────────────────────────────────────────────────────────

  private sumBreakdown(breakdown: QualityBreakdown): number {
    return (
      breakdown.searchIntent +
      breakdown.keywordOptimization +
      breakdown.readability +
      breakdown.structure +
      breakdown.engagement +
      breakdown.originality +
      breakdown.platformFit +
      breakdown.voiceMatch
    );
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
