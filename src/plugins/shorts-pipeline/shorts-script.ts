/**
 * Shorts Script Generator — Sub-60s Video Script Generation
 *
 * Generates short-form video scripts from trending topics using
 * AIOrchestrator. Supports multiple styles (educational, commentary,
 * tutorial, reaction) and includes teleprompter formatting and
 * duration estimation.
 *
 * Designed for YouTube Shorts, TikTok, and Instagram Reels.
 *
 * Layer: Plugins (Shorts Pipeline)
 */

import { randomUUID } from 'node:crypto';
import type { AIOrchestrator } from '../../ai/orchestrator.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('shorts-script');

// ─── Types ──────────────────────────────────────────────────────────────────

export type ScriptStyle = 'educational' | 'commentary' | 'tutorial' | 'reaction';

export interface ShortScript {
  id: string;
  topic: string;
  style: ScriptStyle;
  hook: string;
  body: string[];
  callToAction: string;
  fullScript: string;
  estimatedDurationSec: number;
  wordCount: number;
  hashtags: string[];
  createdAt: string;
}

export interface TeleprompterBlock {
  lineNumber: number;
  text: string;
  pauseAfter: boolean;
  emphasisWords: string[];
}

export interface TeleprompterScript {
  scriptId: string;
  blocks: TeleprompterBlock[];
  totalLines: number;
  estimatedDurationSec: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Average speaking rate in words per minute */
const WORDS_PER_MINUTE = 160;

/** Maximum duration for a Short in seconds */
const MAX_DURATION_SEC = 60;

/** Target duration range */
const TARGET_DURATION_MIN_SEC = 30;
const TARGET_DURATION_MAX_SEC = 55;

/** Words per teleprompter line */
const WORDS_PER_LINE = 8;

const STYLE_PROMPTS: Record<ScriptStyle, string> = {
  educational: `Write an educational YouTube Short script. Start with a surprising fact or question as a hook.
Deliver 3-4 quick knowledge points. End with a memorable takeaway.
Tone: confident, clear, slightly excited. No filler words.`,

  commentary: `Write a hot-take commentary YouTube Short script. Start with a bold, opinionated hook.
Support with 2-3 quick arguments or examples. End with a thought-provoking question.
Tone: direct, passionate, conversational. Speak as if to a friend.`,

  tutorial: `Write a quick tutorial YouTube Short script. Start with "Here's how to..." or "Want to...?".
Give 3-5 clear, numbered steps. End with encouraging the viewer to try it.
Tone: friendly, practical, step-by-step. Use simple language.`,

  reaction: `Write a reaction-style YouTube Short script. Start with an attention-grabbing reaction to the topic.
Share your genuine perspective with 2-3 quick points. End with asking viewers their opinion.
Tone: energetic, authentic, relatable. React naturally.`,
};

const GENERATION_PROMPT = `You are a viral short-form video scriptwriter for Pryceless Solutions.

$STYLE_PROMPT

Rules:
- Script MUST be under 150 words (targeting 30-55 seconds when spoken)
- First sentence is the HOOK — must stop scrollers in 3 seconds
- NO introductions, greetings, or "hey guys"
- End with a clear call-to-action (follow, like, comment)
- Include 3-5 relevant hashtags

Return JSON:
{
  "hook": "Opening hook line",
  "body": ["Point 1", "Point 2", "Point 3"],
  "callToAction": "Follow for more...",
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}

Topic: $TOPIC`;

// ─── ShortsScript ───────────────────────────────────────────────────────────

export class ShortsScript {
  private readonly orchestrator: AIOrchestrator;
  private scripts: Map<string, ShortScript> = new Map();

  constructor(orchestrator: AIOrchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Generate a short-form video script from a topic
   */
  async generateScript(topic: string, style: ScriptStyle = 'educational'): Promise<ShortScript> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const prompt = GENERATION_PROMPT
      .replace('$STYLE_PROMPT', STYLE_PROMPTS[style])
      .replace('$TOPIC', topic);

    let hook = `Did you know about ${topic}?`;
    let body: string[] = [`Here's what you need to know about ${topic}.`];
    let callToAction = 'Follow for more.';
    let hashtags: string[] = [`#${topic.replace(/\s+/g, '').toLowerCase()}`];

    try {
      const response = await this.orchestrator.query(prompt, 'core');
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

        if (typeof parsed.hook === 'string') hook = parsed.hook;
        if (Array.isArray(parsed.body)) body = parsed.body.map(String);
        if (typeof parsed.callToAction === 'string') callToAction = parsed.callToAction;
        if (Array.isArray(parsed.hashtags)) hashtags = parsed.hashtags.map(String);
      }
    } catch (error) {
      log.warn({ error, topic, style }, 'LLM script generation failed, using defaults');
    }

    const fullScript = this.assembleScript(hook, body, callToAction);
    const wordCount = fullScript.split(/\s+/).length;
    const estimatedDurationSec = Math.round((wordCount / WORDS_PER_MINUTE) * 60);

    // Warn if over duration limit
    if (estimatedDurationSec > MAX_DURATION_SEC) {
      log.warn(
        { topic, estimatedDurationSec, wordCount },
        'Generated script exceeds 60-second limit',
      );
    }

    const script: ShortScript = {
      id,
      topic,
      style,
      hook,
      body,
      callToAction,
      fullScript,
      estimatedDurationSec,
      wordCount,
      hashtags,
      createdAt: now,
    };

    this.scripts.set(id, script);

    log.info(
      { id, topic, style, wordCount, estimatedDurationSec },
      'Short script generated',
    );

    return script;
  }

  /**
   * Format a script for teleprompter display
   */
  formatForTeleprompter(script: ShortScript): TeleprompterScript {
    const words = script.fullScript.split(/\s+/);
    const blocks: TeleprompterBlock[] = [];
    let lineNumber = 1;

    for (let i = 0; i < words.length; i += WORDS_PER_LINE) {
      const lineWords = words.slice(i, i + WORDS_PER_LINE);
      const text = lineWords.join(' ');

      // Detect emphasis words (ALL CAPS or words after "...")
      const emphasisWords = lineWords.filter(w =>
        w === w.toUpperCase() && w.length > 2 && /[A-Z]/.test(w),
      );

      // Pause after sentences
      const pauseAfter = /[.!?]$/.test(text);

      blocks.push({
        lineNumber,
        text,
        pauseAfter,
        emphasisWords,
      });

      lineNumber++;
    }

    return {
      scriptId: script.id,
      blocks,
      totalLines: blocks.length,
      estimatedDurationSec: script.estimatedDurationSec,
    };
  }

  /**
   * Estimate the spoken duration of a script in seconds
   */
  estimateDuration(script: ShortScript): number {
    return script.estimatedDurationSec;
  }

  /**
   * Check if a script fits within the short-form duration limit
   */
  isWithinLimit(script: ShortScript): boolean {
    return script.estimatedDurationSec <= MAX_DURATION_SEC;
  }

  /**
   * Check if a script hits the target duration sweet spot
   */
  isInSweetSpot(script: ShortScript): boolean {
    return script.estimatedDurationSec >= TARGET_DURATION_MIN_SEC &&
      script.estimatedDurationSec <= TARGET_DURATION_MAX_SEC;
  }

  /**
   * Get a previously generated script by ID
   */
  getScript(scriptId: string): ShortScript | null {
    return this.scripts.get(scriptId) ?? null;
  }

  /**
   * List all generated scripts
   */
  listScripts(): ShortScript[] {
    return Array.from(this.scripts.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private assembleScript(hook: string, body: string[], callToAction: string): string {
    const parts: string[] = [hook];

    for (const point of body) {
      parts.push(point);
    }

    parts.push(callToAction);

    return parts.join('\n\n');
  }
}
