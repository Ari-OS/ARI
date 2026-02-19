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

// ─── Content Type Detection ───────────────────────────────────────────────────

export type ContentType = 'pokemon' | 'ai_build' | 'live_clip' | 'general';

const POKEMON_KEYWORDS = [
  'pokemon', 'pokémon', 'tcg', 'card', 'pack', 'pull', 'booster', 'charizard', 'pikachu',
  'holo', 'rare', 'vmax', 'vstar', ' ex ', 'gold card', 'collection', 'tcgplayer', 'paldea',
  'crown zenith', 'scarlet violet', 'obsidian', 'temporal forces', 'prismatic', 'stellar',
  'full art', 'alt art', 'secret rare', 'ultra rare', 'psa', 'bgs', 'graded', 'evolving skies',
  'battle styles', 'chilling reign', 'vivid voltage', 'shining fates', 'hidden fates',
  'gym', 'trainer', 'energy', 'trainer gallery', 'illustration rare', 'hyper rare',
];

const AI_BUILD_KEYWORDS = [
  'ari', 'build', 'coding', 'automation', 'software', 'code', 'agent', 'gpt', 'claude',
  'llm', 'api', 'typescript', 'nodejs', 'python', 'ai tool', 'workflow', 'script',
  'deploy', 'daemon', 'telegram bot', 'webhook', 'database', 'vector store',
];

const LIVE_CLIP_KEYWORDS = [
  'live', 'stream', 'clip', 'highlight', 'reaction', 'from stream', 'from live',
  'best moment', 'pulled live', 'opened live',
];

export function detectContentType(topic: string): ContentType {
  const lower = topic.toLowerCase();
  if (LIVE_CLIP_KEYWORDS.some((k) => lower.includes(k))) return 'live_clip';
  if (POKEMON_KEYWORDS.some((k) => lower.includes(k))) return 'pokemon';
  if (AI_BUILD_KEYWORDS.some((k) => lower.includes(k))) return 'ai_build';
  return 'general';
}

// ─── Brand Voice Prompts (per content type) ───────────────────────────────────

const POKEMON_SYSTEM_PROMPT = `You are creating YouTube content for PayThePryce — Pryce Hedrick's Pokémon TCG and AI channel.

Channel identity: Pokémon TCG education + entertainment + investment analysis.
Audience: Collectors, investors, TCG players, hobbyists aged 18-35.

Brand voice for Pokémon content:
- Enthusiastic and knowledgeable — you know the meta, prices, and market trends
- Lead with WHY a card/set/pull matters: current TCGPlayer price, demand trend, rarity odds
- Pack opening energy: suspense → reveal → react → context ("What's it worth? Why does it matter?")
- Always use real numbers: actual prices, percentage gains, pull rates, population counts
- Community-first CTAs: "Drop your best pull in the comments" / "What pack should I open next?"
- Reference style: PokeRev enthusiasm, Leonhart depth, MrBeast pacing
- Hook formats that work: "I opened X packs and got...", "This card is up X% this month", "You NEED this card before [set] releases"
- No filler. Every sentence is either exciting, educational, or both.`;

const AI_BUILD_SYSTEM_PROMPT = `You are creating YouTube content for PayThePryce — Pryce Hedrick's AI-building and automation channel.

Channel identity: Building ARI (personal AI operating system) and other AI tools in public.
Audience: Developers, indie hackers, AI enthusiasts, makers aged 20-40.

Brand voice for AI/building content:
- Honest and raw: show what works AND what breaks
- Show don't tell: real code, real results, real timelines
- "Building in public" energy — no hype, no vague claims, just what actually happened
- Contrarian takes on AI tools: what the demos hide, what the docs don't tell you
- Real-world numbers: cost per run, tokens used, time saved, money saved or made
- Formats that work: "I built X with AI (here's what I wish I knew)", "How [thing] actually works under the hood", "I automated my [workflow] — here's the full system"
- CTAs: subscribe to follow the build, share with fellow builders, comment your stack`;

const LIVE_CLIP_SYSTEM_PROMPT = `You are creating a live stream highlight clip for PayThePryce.

Structure for live stream clips (20-30 seconds):
- Seconds 0-3: The reaction or moment itself — drop the viewer INTO the excitement
- Seconds 3-15: The reveal or key moment from the stream (the pull, the price check, the big move)
- Seconds 15-25: Quick context — why this matters (card value, rarity, achievement)
- Seconds 25-30: CTA: "Watch the full stream" or "Subscribe to catch the next one live"

Voice: Raw, real, in-the-moment. Sound like you're excitedly texting a friend who missed the stream.
No production polish — the authenticity IS the product.`;

const GENERAL_SYSTEM_PROMPT = `You are a content strategist for PayThePryce, Pryce Hedrick's YouTube channel covering Pokémon TCG, AI building, and tech entrepreneurship.

Brand voice:
- Alex Hormozi-inspired: 1st grade language, no fluff, value-first
- Direct, confident, actionable — every sentence earns its place
- No filler phrases like "In this video..." or "Today we're going to..."
- Hook the viewer in the first 5 seconds with a bold claim or provocative question
- Deliver actionable value immediately; do not tease or withhold
- CTAs only at the end, never mid-content — earn the CTA by delivering value first
- Real examples over theory. Numbers over vague claims.`;

function getBrandPrompt(topic: string): string {
  switch (detectContentType(topic)) {
    case 'pokemon': return POKEMON_SYSTEM_PROMPT;
    case 'ai_build': return AI_BUILD_SYSTEM_PROMPT;
    case 'live_clip': return LIVE_CLIP_SYSTEM_PROMPT;
    default: return GENERAL_SYSTEM_PROMPT;
  }
}

// Keep named export for external use (approval-gate Telegram messages, etc.)
export const BRAND_SYSTEM_PROMPT = GENERAL_SYSTEM_PROMPT;

// ─── Auto SEO Keywords ────────────────────────────────────────────────────────

function autoKeywords(topic: string, contentType: ContentType): string[] {
  const base = ['PayThePryce', 'paytheprice'];
  switch (contentType) {
    case 'pokemon':
      return [...base, 'pokemon', 'pokemon tcg', 'pokemon cards', 'pack opening',
        'card collecting', 'pokemon investment', 'rare cards', 'pokemon 2025'];
    case 'ai_build':
      return [...base, 'ai automation', 'build with ai', 'coding', 'ai tools',
        'typescript', 'automation', 'software development', 'building in public'];
    case 'live_clip':
      return [...base, 'live stream highlight', 'pokemon live', 'pack opening live'];
    default: {
      // Extract significant words from topic as fallback keywords
      const topicWords = topic.toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 4);
      return [...base, ...topicWords];
    }
  }
}

// ─── Duration Estimation ─────────────────────────────────────────────────────

const WORDS_PER_MINUTE = 150; // average spoken pace for educational content

function estimateDuration(text: string): number {
  const wordCount = text.trim().split(/\s+/).length;
  return Math.round((wordCount / WORDS_PER_MINUTE) * 10) / 10;
}

// ─── Word targets by format ───────────────────────────────────────────────────

const FORMAT_TARGETS: Record<VideoFormat, { min: number; max: number; label: string }> = {
  long_form:  { min: 1800, max: 2200, label: '12-15 minute YouTube video' },
  short:      { min: 75,   max: 90,   label: '30-45 second YouTube Short' },
  tutorial:   { min: 1200, max: 1600, label: '8-11 minute tutorial video' },
  live_clip:  { min: 45,   max: 65,   label: '20-30 second live stream highlight clip' },
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
      getBrandPrompt(topic),
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
      getBrandPrompt(topic),
    );

    const parsed = JSON.parse(response) as VideoScript['outline'];
    log.info({ topic, format, sectionCount: parsed.sections.length, contentType: detectContentType(topic) }, 'Outline generated');
    return parsed;
  }

  // ── Step 3: Write Full Script ───────────────────────────────────────────────

  async writeScript(
    outline: VideoScript['outline'],
    format: VideoFormat = 'long_form',
    topic = '',
  ): Promise<string> {
    log.info({ hook: outline.hook.slice(0, 60), format, contentType: detectContentType(topic) }, 'Writing full script');

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

    let formatInstructions: string;
    if (format === 'short') {
      formatInstructions =
        `This is a YouTube SHORT. Target: ${targets.min}-${targets.max} words (30-45 seconds spoken).
- Pattern interrupt hook in first 3 seconds
- 3 punchy value points or 1 quick demonstration
- End with subscribe + loop back to hook concept
- No long explanations — one sentence per idea`;
    } else if (format === 'live_clip') {
      formatInstructions =
        `This is a LIVE STREAM HIGHLIGHT CLIP. Target: ${targets.min}-${targets.max} words (20-30 seconds spoken).
- Seconds 0-3: Drop viewer into the reaction/moment — no intro, pure energy
- Seconds 3-15: The reveal (the pull, the price check, the big moment)
- Seconds 15-25: Quick context (what's it worth? why is this wild?)
- Seconds 25-30: CTA: "Watch the full stream" or "Subscribe to catch the next one live"
- Voice: Raw, real, in-the-moment. Sound like you're texting a friend who missed this.
- No production polish — authentic energy IS the product`;
    } else if (format === 'tutorial') {
      formatInstructions =
        `This is a TUTORIAL video. Target: ${targets.min}-${targets.max} words.
- 30-second avatar intro: state the problem + what they will learn
- Main body: step-by-step instructions, clear and numbered
- 30-second avatar outro: recap the 3 key steps + next video CTA
- Add [SCREENSHARE START] and [SCREENSHARE END] markers around the demo sections`;
    } else {
      formatInstructions =
        `This is a LONG-FORM YouTube video. Target: ${targets.min}-${targets.max} words.
- Hook: Expand into a compelling 30-45 second opening
- Each section: Fully developed with examples, stories, or data
- Speak directly to "you" — personal and direct
- End with exactly one clear CTA from the outline`;
    }

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
      getBrandPrompt(topic),
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
      getBrandPrompt(topic),
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
      getBrandPrompt(script.topic),
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
      getBrandPrompt(script.topic),
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
    const contentType = detectContentType(topic);
    log.info({ topic, format, contentType }, 'Starting full script generation pipeline');

    // Auto-inject SEO keywords by content type if none provided
    const resolvedKeywords = keywords.length > 0 ? keywords : autoKeywords(topic, contentType);

    const research = await this.research(topic);
    const outline = await this.generateOutline(topic, research, format, resolvedKeywords);
    const fullScript = await this.writeScript(outline, format, topic);
    const estimatedDuration = estimateDuration(fullScript);

    // Generate Shorts script for long-form and tutorial — extracted sibling asset
    let shortsScript: string | undefined;
    if (format === 'long_form' || format === 'tutorial') {
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
      targetKeywords: resolvedKeywords,
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
