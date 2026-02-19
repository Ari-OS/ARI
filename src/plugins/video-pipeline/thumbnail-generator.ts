import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createLogger } from '../../kernel/logger.js';
import type { VideoScript } from './types.js';
import { detectContentType } from './script-generator.js';

const log = createLogger('video-thumbnail-generator');

// ─── OpenAI image generation shapes ──────────────────────────────────────────

interface OpenAIImageResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

// ─── Thumbnail concept prompt builder ────────────────────────────────────────

function buildThumbnailConceptPrompt(script: VideoScript): string {
  const hook = script.outline.hook;
  const topic = script.topic;
  const contentType = detectContentType(topic);
  const firstKeyPoints = script.outline.sections
    .slice(0, 2)
    .flatMap((s) => s.keyPoints.slice(0, 2))
    .join(', ');

  const niche = contentType === 'pokemon'
    ? `Pokémon TCG content — the card(s) must be clearly visible and recognizable.
Pokémon thumbnail rules:
- Dominant element: the card or pack — full art visible, angled slightly for depth
- Price/value overlay: show "$XXX" or "UP 500%" if relevant — makes people stop scrolling
- Creator reaction face in corner: surprised, hands on head, open mouth, maximum emotion
- High-saturation colors matching the card art (charizard = red/orange, shiny = blue/silver)
- Bold all-caps text: "PULLED THIS!", "WORTH IT?", "HOW?!", "SOLD FOR $XXX"
- Background: dark studio or color-matched to card art — never plain white
- Do NOT use generic stock images — the card IS the product`
    : contentType === 'ai_build'
    ? `AI/coding content — show the real output, not stock photos.
AI thumbnail rules:
- Show the actual interface, dashboard, or code on screen (mockup or screenshot style)
- Creator face in corner: curious, or "mind blown" expression
- Bold text teasing the result: "Built This in 2 Hours", "AI Did This", "It Actually Works"
- Colors: dark background + bright accent (cyan, neon green, or purple for tech feel)
- No generic robot/AI imagery — show the REAL thing`
    : contentType === 'live_clip'
    ? `Live stream clip — capture the authentic reaction moment.
Live clip thumbnail rules:
- Creator reaction face fills 60% of frame: genuine shock, excitement, or celebration
- Small inset of the card/moment in corner
- Text overlay: "LIVE REACTION", "YOU WON'T BELIEVE THIS", "IT HAPPENED"
- Raw, unpolished feel — authenticity is the brand`
    : `Finance/entrepreneur content: avoid stock photos — be raw and real.
Rules: creator face (confident, direct), bold metric or result in text overlay, dark or gradient background.`;

  return `Design a YouTube thumbnail concept for a video titled: "${topic}"

Hook: ${hook}
Key value delivered: ${firstKeyPoints}
Channel: PayThePryce (Pokémon TCG, AI building, entrepreneurship)

Universal thumbnail rules:
1. High contrast — must be readable at 120x90px (thumbnail grid size)
2. Bold text overlay — 3-6 words max, all-caps if possible
3. Single focal point — one dominant visual element
4. Emotional face if using creator — surprised, excited, pointing
5. The text should tease, not spoil

Niche-specific rules:
${niche}

Return a thumbnail concept description with:
- Main visual element (what's in the center)
- Text overlay (the bold words on the thumbnail)
- Color palette (2-3 hex codes)
- DALL-E image generation prompt (ready to use, under 300 chars)`;
}

function buildDallEPrompt(script: VideoScript, concept: string): string {
  // Extract the DALL-E prompt section from the concept
  const match = concept.match(/DALL-E image generation prompt[:\s]+(.+)/is);
  if (match?.[1]) {
    return match[1].trim().slice(0, 300);
  }

  // Fallback: construct from topic
  return `Professional YouTube thumbnail, bold typography, high contrast colors, dramatic lighting, ${script.topic}, photorealistic, 16:9 ratio`;
}

function extractTextOverlay(concept: string): string {
  const match = concept.match(/Text overlay[:\s]+["']?([^"'\n]+)["']?/i);
  if (match?.[1]) {
    return match[1].trim().slice(0, 50);
  }
  return '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// THUMBNAIL GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class ThumbnailGenerator {
  private readonly apiKey: string | null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? null;
  }

  private requireApiKey(): string {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
    }
    return this.apiKey;
  }

  // ── Generate concept (AI-described thumbnail design) ─────────────────────────

  async generateConcept(
    script: VideoScript,
    orchestratorChat: (messages: Array<{ role: string; content: string }>) => Promise<string>,
  ): Promise<string> {
    log.info({ scriptId: script.id, topic: script.topic }, 'Generating thumbnail concept');

    const conceptPrompt = buildThumbnailConceptPrompt(script);

    const concept = await orchestratorChat([
      { role: 'user', content: conceptPrompt },
    ]);

    log.info({ scriptId: script.id }, 'Thumbnail concept generated');
    return concept;
  }

  // ── Generate image via DALL-E 3 ──────────────────────────────────────────────

  async generateImage(
    script: VideoScript,
    concept: string,
    outputDir: string,
    variantIndex: number = 0,
  ): Promise<string> {
    log.info({ scriptId: script.id, variantIndex }, 'Generating thumbnail image via DALL-E');

    this.requireApiKey();

    const imagePrompt = buildDallEPrompt(script, concept);

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: '1792x1024',   // Closest to 16:9 for YouTube thumbnails
        quality: 'hd',
        response_format: 'b64_json',
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI image generation error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as OpenAIImageResponse;
    const imageData = data.data[0];

    if (!imageData?.b64_json) {
      throw new Error('OpenAI returned no image data');
    }

    // Write to disk
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `thumbnail_v${variantIndex + 1}.png`);
    writeFileSync(outputPath, Buffer.from(imageData.b64_json, 'base64'));

    log.info({ outputPath, variantIndex }, 'Thumbnail image written to disk');
    return outputPath;
  }

  // ── Generate 2 thumbnail variants for A/B testing ────────────────────────────

  async generateVariants(
    script: VideoScript,
    outputDir: string,
    orchestratorChat: (messages: Array<{ role: string; content: string }>) => Promise<string>,
  ): Promise<{
    concept: string;
    textOverlay: string;
    variants: string[];
  }> {
    log.info({ scriptId: script.id }, 'Generating thumbnail variants for A/B testing');

    const concept = await this.generateConcept(script, orchestratorChat);
    const textOverlay = extractTextOverlay(concept);

    // Generate variant A
    const variantA = await this.generateImage(script, concept, outputDir, 0);

    // For variant B, slightly modified prompt (different angle)
    const variantBConcept = concept + '\n\nVariant B: Use a different visual angle or background color while keeping the same text overlay.';
    const variantB = await this.generateImage(script, variantBConcept, outputDir, 1);

    const variants = [variantA, variantB];

    log.info({ scriptId: script.id, variants }, 'Thumbnail A/B variants generated');

    return { concept, textOverlay, variants };
  }

  // ── Generate approval preview message ────────────────────────────────────────

  buildApprovalPreview(params: {
    topic: string;
    title: string;
    textOverlay: string;
    concept: string;
    variantPaths: string[];
  }): string {
    return [
      `Thumbnail ready for: "${params.topic}"`,
      ``,
      `Proposed YouTube title: ${params.title}`,
      `Thumbnail text overlay: "${params.textOverlay}"`,
      ``,
      `Concept: ${params.concept.slice(0, 300)}...`,
      ``,
      `${params.variantPaths.length} variants generated. Reply with:`,
      `  A — use variant A`,
      `  B — use variant B`,
      `  edit [feedback] — regenerate with feedback`,
      `  reject — cancel this video`,
    ].join('\n');
  }
}
