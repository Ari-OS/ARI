import { randomUUID } from 'node:crypto';
import { createLogger } from '../../kernel/logger.js';
import type { VideoScript, VideoFormat } from './types.js';

const log = createLogger('video-script-generator');

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR ADAPTER (duck-typed — no direct import of AIOrchestrator)
// ═══════════════════════════════════════════════════════════════════════════════

interface OrchestratorAdapter {
  chat: (messages: Array<{ role: string; content: string }>, systemPrompt?: string) => Promise<string>;
}

// ─── Brand Voice ─────────────────────────────────────────────────────────────

const BRAND_SYSTEM_PROMPT = `You are a content strategist for PayThePryce, a personal finance and entrepreneurship brand.

Brand voice:
- Alex Hormozi-inspired: 1st grade language, no fluff, value-first
- Direct, confident, actionable — every sentence earns its place
- No filler phrases like "In this video..." or "Today we're going to..."
- Hook the viewer in the first 5 seconds with a bold claim or provocative question
- Deliver actionable value immediately; do not tease or withhold
- CTAs only at the end, never mid-content — earn the CTA by delivering value first
- Use short sentences. Use white space. Make it scannable.
- Speak to the reader directly ("you", "your") not abstractly
- Real examples over theory. Numbers over vague claims.`;

// ─── Duration Estimation ─────────────────────────────────────────────────────

const WORDS_PER_MINUTE = 150; // average spoken pace for educational content

function estimateDuration(text: string): number {
  const wordCount = text.trim().split(/\s+/).length;
  return Math.round((wordCount / WORDS_PER_MINUTE) * 10) / 10;
}

// ─── Word targets by format ───────────────────────────────────────────────────

const FORMAT_TARGETS: Record<VideoFormat, { min: number; max: number; label: string }> = {
  long_form: { min: 1800, max: 2200, label: '12-15 minute YouTube video' },
  short:     { min: 75,   max: 90,   label: '30-45 second YouTube Short' },
  tutorial:  { min: 1200, max: 1600, label: '8-11 minute tutorial video' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class ScriptGenerator {
  constructor(private readonly orchestrator: OrchestratorAdapter) {}

  // ── Step 1: Research ────────────────────────────────────────────────────────

  async research(topic: string): Promise<string> {
    log.info({ topic }, 'Generating research context');

    const response = await this.orchestrator.chat(
      [
        {
          role: 'user',
          content: `Research the topic: "${topic}"

Provide a concise research brief covering:
1. Core problem this topic solves
2. 5-7 key facts, stats, or insights (with specifics — numbers, percentages, timeframes)
3. Common mistakes people make related to this topic
4. What the best practitioners do differently
5. Counterintuitive angles or contrarian takes
6. The single most shareable moment — a stat, story, or insight that works as a 60-second standalone

Keep it tight. Bullet points preferred. No fluff.`,
        },
      ],
      BRAND_SYSTEM_PROMPT,
    );

    log.info({ topic }, 'Research context generated');
    return response;
  }

  // ── Step 2: Generate Outline ────────────────────────────────────────────────

  async generateOutline(
    topic: string,
    research: string,
    format: VideoFormat = 'long_form',
    keywords: string[] = [],
  ): Promise<VideoScript['outline']> {
    log.info({ topic, format }, 'Generating script outline');

    const keywordNote = keywords.length > 0
      ? `\nSEO keywords to naturally weave in: ${keywords.join(', ')}`
      : '';

    const response = await this.orchestrator.chat(
      [
        {
          role: 'user',
          content: `Create a YouTube video outline for: "${topic}"
Format: ${FORMAT_TARGETS[format].label}

Research context:
${research}
${keywordNote}

Return ONLY valid JSON matching this exact structure:
{
  "hook": "Opening 1-2 sentences that grab attention immediately — bold claim, surprising stat, or provocative question",
  "hookVariants": [
    "Variant B hook — different angle, same punch",
    "Variant C hook — question format"
  ],
  "sections": [
    {
      "heading": "Section title",
      "keyPoints": ["Point 1", "Point 2", "Point 3"],
      "graphicCue": "Optional: [GRAPHIC: show X on screen]"
    }
  ],
  "shortsClipHint": "Describe which section/moment is the most shareable 45-60 second standalone clip",
  "cta": "Single clear call-to-action for the end of the video"
}

Requirements:
- ${format === 'long_form' ? '3-5 sections, 2-4 key points each' : '1-2 sections, 2-3 key points each'}
- Hook must work in the first 5 seconds
- hookVariants: exactly 2 alternative hooks for A/B testing
- shortsClipHint: identify the single best 45-60s extractable moment
- CTA is ONE specific action (subscribe, comment, download, follow)
- No mid-content CTAs
Return ONLY JSON, no markdown, no explanation.`,
        },
      ],
      BRAND_SYSTEM_PROMPT,
    );

    const parsed = JSON.parse(response) as VideoScript['outline'];
    log.info({ topic, format, sectionCount: parsed.sections.length }, 'Outline generated');
    return parsed;
  }

  // ── Step 3: Write Full Script ───────────────────────────────────────────────

  async writeScript(
    outline: VideoScript['outline'],
    format: VideoFormat = 'long_form',
  ): Promise<string> {
    log.info({ hook: outline.hook.slice(0, 60), format }, 'Writing full script');

    const targets = FORMAT_TARGETS[format];

    const outlineText = [
      `Hook: ${outline.hook}`,
      '',
      ...outline.sections.map((s, i) =>
        [
          `Section ${i + 1}: ${s.heading}`,
          ...s.keyPoints.map((p) => `  - ${p}`),
          s.graphicCue ? `  ${s.graphicCue}` : '',
        ].filter(Boolean).join('\n'),
      ),
      '',
      `CTA: ${outline.cta}`,
    ].join('\n');

    const formatInstructions = format === 'short'
      ? `This is a YouTube SHORT. Target: ${targets.min}-${targets.max} words (30-45 seconds spoken).
- Pattern interrupt hook in first 3 seconds
- 3 punchy value points or 1 quick demonstration
- End with subscribe + loop back to hook concept
- No long explanations — one sentence per idea`
      : format === 'tutorial'
      ? `This is a TUTORIAL video. Target: ${targets.min}-${targets.max} words.
- 30-second avatar intro: state the problem + what they will learn
- Main body: step-by-step instructions, clear and numbered
- 30-second avatar outro: recap the 3 key steps + next video CTA
- Add [SCREENSHARE START] and [SCREENSHARE END] markers around the demo sections`
      : `This is a LONG-FORM YouTube video. Target: ${targets.min}-${targets.max} words.
- Hook: Expand into a compelling 30-45 second opening
- Each section: Fully developed with examples, stories, or data
- Speak directly to "you" — personal and direct
- End with exactly one clear CTA from the outline`;

    const response = await this.orchestrator.chat(
      [
        {
          role: 'user',
          content: `Write a full YouTube video script from this outline.

OUTLINE:
${outlineText}

FORMAT REQUIREMENTS:
${formatInstructions}

Universal requirements:
- 1st grade vocabulary — simple, direct language
- Every sentence must add value or it gets cut
- No filler, no throat-clearing, no "let me explain..."
- Format: Plain prose, ready to read aloud. No stage directions except [SCREENSHARE] markers for tutorials.`,
        },
      ],
      BRAND_SYSTEM_PROMPT,
    );

    log.info({ wordCount: response.trim().split(/\s+/).length, format }, 'Full script written');
    return response;
  }

  // ── Step 4: Write Standalone Shorts Script ──────────────────────────────────

  async writeShortsScript(topic: string, research: string): Promise<string> {
    log.info({ topic }, 'Writing standalone Shorts script');

    const response = await this.orchestrator.chat(
      [
        {
          role: 'user',
          content: `Write a YouTube SHORT script for: "${topic}"

Research:
${research}

Structure (75-90 words total, ~45 seconds spoken):
- Seconds 0-3: Pattern interrupt hook. Bold statement or surprising fact.
- Seconds 3-15: Setup — what problem this solves or what they will learn
- Seconds 15-50: 3 punchy points OR 1 quick demonstration. One sentence each.
- Seconds 50-60: Subscribe CTA + loop ("Watch this if you want [result]")

Rules:
- Under 90 words total — every word earns its place
- No "Hey guys" — straight into the hook
- Each point: one sentence, max 10 words
- Sound like a text message from a smart friend, not a lecture

Return ONLY the script text, no labels, no timestamps.`,
        },
      ],
      BRAND_SYSTEM_PROMPT,
    );

    log.info({ wordCount: response.trim().split(/\s+/).length }, 'Shorts script written');
    return response;
  }

  // ── Step 5: Generate Video Title + Description (SEO) ───────────────────────

  async generateMetadata(
    script: VideoScript,
    keywords: string[] = [],
  ): Promise<{ title: string; description: string; tags: string[] }> {
    log.info({ scriptId: script.id }, 'Generating video metadata');

    const keywordNote = keywords.length > 0
      ? `\nTarget SEO keywords (use in title and first 100 chars of description): ${keywords.join(', ')}`
      : '';

    const response = await this.orchestrator.chat(
      [
        {
          role: 'user',
          content: `Generate YouTube metadata for this video.

TOPIC: ${script.topic}
FORMAT: ${script.format}
HOOK: ${script.outline.hook}
KEY POINTS:
${script.outline.sections.flatMap((s) => s.keyPoints).map((p) => `- ${p}`).join('\n')}
${keywordNote}

Return ONLY valid JSON:
{
  "title": "YouTube title under 60 chars — curiosity + value + keyword",
  "description": "YouTube description 150-200 words. First line restates the title benefit. Then 3-5 bullet points of what they'll learn. Then timestamps if long-form. Then subscribe CTA. Then relevant hashtags on last line.",
  "tags": ["tag1", "tag2", "tag3"]
}

Title rules:
- Under 60 characters
- Front-load the keyword
- No clickbait — deliver exactly what the title promises
- Formats that work: "How I [result] in [timeframe]", "[Number] [thing]s that [outcome]", "The [thing] nobody tells you about [topic]"

Tags: 8-12 tags, mix of broad and specific. No spaces in tags, use underscores.

Return ONLY JSON.`,
        },
      ],
      BRAND_SYSTEM_PROMPT,
    );

    const parsed = JSON.parse(response) as { title: string; description: string; tags: string[] };
    log.info({ scriptId: script.id, title: parsed.title }, 'Video metadata generated');
    return parsed;
  }

  // ── Step 6: Revise Script ───────────────────────────────────────────────────

  async revise(script: VideoScript, feedback: string): Promise<VideoScript> {
    log.info({ scriptId: script.id, version: script.version }, 'Revising script');

    const response = await this.orchestrator.chat(
      [
        {
          role: 'user',
          content: `Revise this video script based on the feedback provided.

CURRENT SCRIPT:
${script.fullScript}

FEEDBACK:
${feedback}

Requirements:
- Incorporate all feedback points
- Maintain PayThePryce brand voice: direct, value-first, no fluff
- Keep CTAs only at the end
- Return the complete revised script, ready to read aloud
- Do not add any commentary or explanation — just the revised script`,
        },
      ],
      BRAND_SYSTEM_PROMPT,
    );

    const revisedScript: VideoScript = {
      ...script,
      fullScript: response,
      estimatedDuration: estimateDuration(response),
      version: script.version + 1,
    };

    log.info({ scriptId: script.id, newVersion: revisedScript.version }, 'Script revision complete');
    return revisedScript;
  }

  // ── Full Pipeline ───────────────────────────────────────────────────────────

  async generate(
    topic: string,
    format: VideoFormat = 'long_form',
    keywords: string[] = [],
  ): Promise<VideoScript> {
    log.info({ topic, format }, 'Starting full script generation pipeline');

    const research = await this.research(topic);
    const outline = await this.generateOutline(topic, research, format, keywords);
    const fullScript = await this.writeScript(outline, format);
    const estimatedDuration = estimateDuration(fullScript);

    // Generate Shorts script only for long-form — extracted as a sibling asset
    let shortsScript: string | undefined;
    if (format === 'long_form') {
      shortsScript = await this.writeShortsScript(topic, research);
    }

    const script: VideoScript = {
      id: randomUUID(),
      topic,
      format,
      outline,
      fullScript,
      shortsScript,
      estimatedDuration,
      targetKeywords: keywords,
      status: 'draft',
      version: 1,
      createdAt: new Date().toISOString(),
    };

    log.info(
      { scriptId: script.id, topic, format, estimatedDuration, version: script.version },
      'Script generation pipeline complete',
    );

    return script;
  }
}
