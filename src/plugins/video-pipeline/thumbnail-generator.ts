import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createLogger } from '../../kernel/logger.js';
import type { VideoScript } from './types.js';

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
  const firstKeyPoints = script.outline.sections
    .slice(0, 2)
    .flatMap((s) => s.keyPoints.slice(0, 2))
    .join(', ');

  return `Design a YouTube thumbnail concept for a video titled: "${topic}"

Hook: ${hook}
Key value delivered: ${firstKeyPoints}

YouTube thumbnail rules:
1. High contrast — works at small size (120x90px thumbnail grid)
2. Bold text overlay — 3-6 words max, must be readable at thumbnail size
3. Emotional/facial expression if using a person — surprised, pointing, excited
4. Single focal point — one image element dominates
5. Color contrast — use complementary colors (red+blue, yellow+black, etc.)
6. The text should tease the value without giving it away
7. For finance/entrepreneur content: avoid stock photo generic look — be raw and real

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
