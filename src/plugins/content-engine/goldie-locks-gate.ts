/**
 * GOLDIE LOCKS GATE — Content quality gate with 0-50 scoring
 *
 * Evaluates content across 5 dimensions (each 0-10):
 * 1. Readability — Clear, flows well, appropriate reading level
 * 2. Original Insight — Unique perspective, not rehashed ideas
 * 3. Personal Story — Authentic experience, vulnerability, specifics
 * 4. Directness — Gets to the point, no filler, no AI-speak
 * 5. Action Oriented — Reader knows what to do next
 *
 * Gate decisions:
 * - Score < 35: REJECT
 * - Score 35-45: APPROVE WITH EDITS
 * - Score > 45: PUBLISH
 *
 * Phase 26: Content Quality Gate
 */

import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';
import { humanizeQuick } from './humanizer.js';

const log = createLogger('goldie-locks-gate');

// ─── Types ──────────────────────────────────────────────────────────────────

export type ContentFormat = 'blog' | 'tweet' | 'script' | 'email' | 'newsletter';

export interface ContentScore {
  total: number;
  readability: number;
  originalInsight: number;
  personalStory: number;
  directness: number;
  actionOriented: number;
  feedback: string[];
}

export type GateDecision = {
  action: 'reject' | 'approve_with_edits' | 'publish';
  reason: string;
  score: number;
  requiredEdits?: string[];
};

interface OrchestratorLike {
  query(prompt: string, agent?: string): Promise<string>;
}

interface RawScoreResponse {
  readability?: number;
  originalInsight?: number;
  personalStory?: number;
  directness?: number;
  actionOriented?: number;
  feedback?: string[];
}

// ─── Thresholds ─────────────────────────────────────────────────────────────

const REJECT_THRESHOLD = 35;
const PUBLISH_THRESHOLD = 45;

// ─── Gate ───────────────────────────────────────────────────────────────────

export class GoldiLocksGate {
  private readonly orchestrator: OrchestratorLike;
  private readonly eventBus: EventBus;

  constructor(params: {
    orchestrator: OrchestratorLike;
    eventBus: EventBus;
  }) {
    this.orchestrator = params.orchestrator;
    this.eventBus = params.eventBus;
  }

  /**
   * Score content quality on a 0-50 scale.
   * Humanizes the content before scoring to strip AI-speak.
   */
  async score(content: string, format: ContentFormat): Promise<ContentScore> {
    if (!content || content.trim().length === 0) {
      return this.emptyScore();
    }

    // Strip AI-speak before scoring
    const humanized = humanizeQuick(content);

    try {
      const prompt = this.buildScoringPrompt(humanized, format);
      const response = await this.orchestrator.query(prompt, 'core');
      const score = this.parseScoreResponse(response);

      this.eventBus.emit('audit:log', {
        action: 'content:scored',
        agent: 'system',
        trustLevel: 'operator',
        details: {
          format,
          total: score.total,
          readability: score.readability,
          originalInsight: score.originalInsight,
          personalStory: score.personalStory,
          directness: score.directness,
          actionOriented: score.actionOriented,
        },
      });

      return score;
    } catch (error) {
      log.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'LLM scoring failed, using heuristic fallback',
      );
      return this.heuristicScore(humanized);
    }
  }

  /**
   * Make gate decision based on score.
   */
  decide(score: ContentScore): GateDecision {
    let decision: GateDecision;

    if (score.total < REJECT_THRESHOLD) {
      const issues = this.identifyKeyIssues(score);
      decision = {
        action: 'reject',
        reason: `Not ready. Key issues: ${issues.join(', ')}`,
        score: score.total,
      };
    } else if (score.total <= PUBLISH_THRESHOLD) {
      const edits = this.identifyRequiredEdits(score);
      decision = {
        action: 'approve_with_edits',
        reason: `Close but needs: ${edits.join(', ')}`,
        score: score.total,
        requiredEdits: edits,
      };
    } else {
      decision = {
        action: 'publish',
        reason: 'Ready to go',
        score: score.total,
      };
    }

    this.eventBus.emit('audit:log', {
      action: 'content:gate_decision',
      agent: 'system',
      trustLevel: 'operator',
      details: {
        action: decision.action,
        score: decision.score,
        reason: decision.reason,
      },
    });

    log.info({ action: decision.action, score: score.total }, 'Gate decision made');

    return decision;
  }

  // ─── Private: Prompt ──────────────────────────────────────────────────

  private buildScoringPrompt(content: string, format: ContentFormat): string {
    return [
      `Score the following ${format} content for quality on 5 dimensions.`,
      '',
      `Each dimension is scored 0-10:`,
      '1. readability — Clear, flows well, appropriate for the format',
      '2. originalInsight — Unique perspective, not generic advice',
      '3. personalStory — Authentic experience, specific details, vulnerability',
      '4. directness — Gets to the point, no filler, no corporate speak',
      '5. actionOriented — Reader knows exactly what to do next',
      '',
      '---CONTENT START---',
      content.slice(0, 5000),
      '---CONTENT END---',
      '',
      'Respond with ONLY valid JSON:',
      '{',
      '  "readability": <0-10>,',
      '  "originalInsight": <0-10>,',
      '  "personalStory": <0-10>,',
      '  "directness": <0-10>,',
      '  "actionOriented": <0-10>,',
      '  "feedback": ["specific suggestion 1", "specific suggestion 2"]',
      '}',
    ].join('\n');
  }

  // ─── Private: Parsing ─────────────────────────────────────────────────

  private parseScoreResponse(response: string): ContentScore {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        log.warn('No JSON found in scoring response');
        return this.emptyScore();
      }

      const parsed = JSON.parse(jsonMatch[0]) as RawScoreResponse;

      const readability = this.clampScore(parsed.readability);
      const originalInsight = this.clampScore(parsed.originalInsight);
      const personalStory = this.clampScore(parsed.personalStory);
      const directness = this.clampScore(parsed.directness);
      const actionOriented = this.clampScore(parsed.actionOriented);
      const total = readability + originalInsight + personalStory + directness + actionOriented;

      const feedback = Array.isArray(parsed.feedback)
        ? parsed.feedback.filter((f): f is string => typeof f === 'string').slice(0, 5)
        : [];

      return { total, readability, originalInsight, personalStory, directness, actionOriented, feedback };
    } catch (error) {
      log.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to parse score response',
      );
      return this.emptyScore();
    }
  }

  // ─── Private: Heuristic Fallback ──────────────────────────────────────

  private heuristicScore(content: string): ContentScore {
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLen = sentences.length > 0 ? wordCount / sentences.length : 0;

    // Readability: penalize very long or very short sentences
    const readability = avgSentenceLen > 5 && avgSentenceLen < 25 ? 7 : 4;

    // Directness: penalize filler words
    const fillerWords = ['just', 'very', 'really', 'basically', 'actually', 'literally'];
    const fillerCount = words.filter(w => fillerWords.includes(w.toLowerCase())).length;
    const directness = Math.max(2, 8 - fillerCount);

    // Length-based heuristics
    const originalInsight = wordCount > 50 ? 5 : 3;
    const personalStory = content.includes('I ') || content.includes('my ') ? 5 : 3;
    const actionOriented = content.includes('?') || /\b(try|start|build|create|use)\b/i.test(content) ? 6 : 3;

    const total = readability + originalInsight + personalStory + directness + actionOriented;

    return {
      total,
      readability,
      originalInsight,
      personalStory,
      directness,
      actionOriented,
      feedback: ['Scored via heuristic fallback — LLM unavailable.'],
    };
  }

  // ─── Private: Helpers ─────────────────────────────────────────────────

  private clampScore(value: unknown): number {
    const num = Number(value);
    if (isNaN(num)) return 0;
    return Math.max(0, Math.min(10, Math.round(num)));
  }

  private emptyScore(): ContentScore {
    return {
      total: 0,
      readability: 0,
      originalInsight: 0,
      personalStory: 0,
      directness: 0,
      actionOriented: 0,
      feedback: ['Content is empty or could not be scored.'],
    };
  }

  private identifyKeyIssues(score: ContentScore): string[] {
    const issues: string[] = [];
    if (score.readability < 5) issues.push('poor readability');
    if (score.originalInsight < 5) issues.push('lacks original insight');
    if (score.personalStory < 5) issues.push('missing personal story');
    if (score.directness < 5) issues.push('not direct enough');
    if (score.actionOriented < 5) issues.push('no clear action for reader');
    if (issues.length === 0) issues.push('overall quality below threshold');
    return issues;
  }

  private identifyRequiredEdits(score: ContentScore): string[] {
    const edits: string[] = [];
    if (score.readability < 7) edits.push('improve flow and clarity');
    if (score.originalInsight < 7) edits.push('add unique perspective or data');
    if (score.personalStory < 7) edits.push('include specific personal experience');
    if (score.directness < 7) edits.push('cut filler, get to the point faster');
    if (score.actionOriented < 7) edits.push('add clear call to action');
    if (edits.length === 0) edits.push('minor polish needed');
    return edits;
  }
}
