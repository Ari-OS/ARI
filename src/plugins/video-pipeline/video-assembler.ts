import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createLogger } from '../../kernel/logger.js';
import { execFileNoThrow } from '../../utils/execFileNoThrow.js';

const log = createLogger('video-assembler');

// ─── FFmpeg runner ────────────────────────────────────────────────────────────

async function runFfmpeg(args: string[]): Promise<void> {
  log.info({ args: args.join(' ') }, 'Running FFmpeg');

  const result = await execFileNoThrow('ffmpeg', args, { timeoutMs: 300_000 });

  if (result.status !== 0) {
    const errorOutput = result.stderr.slice(-2000);
    throw new Error(`FFmpeg exited with code ${result.status}: ${errorOutput}`);
  }
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIDEO ASSEMBLER
// ═══════════════════════════════════════════════════════════════════════════════

export class VideoAssembler {
  constructor(private readonly outputDir: string) {}

  // ── Burn captions into video ─────────────────────────────────────────────────

  async burnCaptions(
    inputPath: string,
    srtPath: string,
    outputPath: string,
  ): Promise<void> {
    log.info({ inputPath, srtPath, outputPath }, 'Burning captions into video');

    ensureDir(path.dirname(outputPath));

    // FFmpeg subtitle filter with bold white text + black stroke
    // Font size 22, white fill, black stroke for readability
    const subtitleFilter = `subtitles=${srtPath}:force_style='FontName=Arial,FontSize=22,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Bold=1,Alignment=2'`;

    await runFfmpeg([
      '-i', inputPath,
      '-vf', subtitleFilter,
      '-c:a', 'copy',
      '-y',
      outputPath,
    ]);

    log.info({ outputPath }, 'Captions burned into video');
  }

  // ── Extract Shorts clip (crop to vertical 9:16) ──────────────────────────────

  async extractShortsClip(
    inputPath: string,
    startSeconds: number,
    durationSeconds: number,
    outputPath: string,
  ): Promise<void> {
    log.info({ inputPath, startSeconds, durationSeconds, outputPath }, 'Extracting Shorts clip');

    ensureDir(path.dirname(outputPath));

    // Crop center of 16:9 frame to 9:16 portrait, then scale to 1080x1920
    // crop=w:h:x:y — takes center 9/16 crop from 1920x1080 source
    // 1080x1920 crop from 1920x1080: width=607 (1080 * (9/16)), x=offset from center
    const cropFilter = 'crop=607:1080:656:0,scale=1080:1920';

    await runFfmpeg([
      '-ss', String(startSeconds),
      '-i', inputPath,
      '-t', String(durationSeconds),
      '-vf', cropFilter,
      '-c:a', 'aac',
      '-y',
      outputPath,
    ]);

    log.info({ outputPath }, 'Shorts clip extracted');
  }

  // ── Add text overlay (hook at top, CTA at bottom) ────────────────────────────

  async addTextOverlays(
    inputPath: string,
    hookText: string,
    ctaText: string,
    outputPath: string,
  ): Promise<void> {
    log.info({ inputPath, hookText, ctaText, outputPath }, 'Adding text overlays');

    ensureDir(path.dirname(outputPath));

    // Escape single quotes in text for FFmpeg filter
    const escapeText = (t: string): string => t.replace(/'/g, "\\'");

    const escapedHook = escapeText(hookText);
    const escapedCta = escapeText(ctaText);

    // Hook text at top 15%, CTA at bottom 10%
    const drawTextFilter = [
      // Hook at top
      `drawtext=text='${escapedHook}':fontcolor=white:fontsize=36:fontfile=/System/Library/Fonts/Helvetica.ttc:x=(w-text_w)/2:y=h*0.12:box=1:boxcolor=black@0.6:boxborderw=10:bold=1`,
      // CTA at bottom
      `drawtext=text='${escapedCta}':fontcolor=yellow:fontsize=28:fontfile=/System/Library/Fonts/Helvetica.ttc:x=(w-text_w)/2:y=h*0.88:box=1:boxcolor=black@0.6:boxborderw=8:bold=1`,
    ].join(',');

    await runFfmpeg([
      '-i', inputPath,
      '-vf', drawTextFilter,
      '-c:a', 'copy',
      '-y',
      outputPath,
    ]);

    log.info({ outputPath }, 'Text overlays added');
  }

  // ── Add watermark (channel logo) ─────────────────────────────────────────────

  async addWatermark(
    inputPath: string,
    logoPath: string,
    outputPath: string,
    position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right',
  ): Promise<void> {
    log.info({ inputPath, logoPath, position, outputPath }, 'Adding watermark');

    ensureDir(path.dirname(outputPath));

    const overlayPositions = {
      'top-right':    'W-w-20:20',
      'top-left':     '20:20',
      'bottom-right': 'W-w-20:H-h-20',
      'bottom-left':  '20:H-h-20',
    };

    const overlayExpr = overlayPositions[position];

    await runFfmpeg([
      '-i', inputPath,
      '-i', logoPath,
      '-filter_complex', `[1:v]scale=80:80[logo];[0:v][logo]overlay=${overlayExpr}:format=auto`,
      '-c:a', 'copy',
      '-y',
      outputPath,
    ]);

    log.info({ outputPath }, 'Watermark added');
  }

  // ── Concatenate intro + main + outro ─────────────────────────────────────────

  async concatenate(inputPaths: string[], outputPath: string): Promise<void> {
    log.info({ count: inputPaths.length, outputPath }, 'Concatenating video segments');

    ensureDir(path.dirname(outputPath));

    // Write concat list to temp file
    const listPath = path.join(path.dirname(outputPath), '_concat_list.txt');
    const listContent = inputPaths.map((p) => `file '${p}'`).join('\n');

    const { writeFileSync } = await import('node:fs');
    writeFileSync(listPath, listContent, 'utf-8');

    await runFfmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      '-y',
      outputPath,
    ]);

    log.info({ outputPath }, 'Video segments concatenated');
  }

  // ── Full Shorts post-production pipeline ─────────────────────────────────────

  async produceShortsVideo(params: {
    inputPath: string;
    srtPath: string;
    hookText: string;
    ctaText: string;
    startSeconds: number;
    durationSeconds: number;
    projectId: string;
  }): Promise<string> {
    const { inputPath, srtPath, hookText, ctaText, startSeconds, durationSeconds, projectId } = params;

    const workDir = path.join(this.outputDir, projectId);
    ensureDir(workDir);

    const step1 = path.join(workDir, '01_clipped.mp4');
    const step2 = path.join(workDir, '02_captioned.mp4');
    const step3 = path.join(workDir, '03_overlays.mp4');

    // Step 1: Extract clip and convert to portrait
    await this.extractShortsClip(inputPath, startSeconds, durationSeconds, step1);

    // Step 2: Burn captions
    await this.burnCaptions(step1, srtPath, step2);

    // Step 3: Add hook + CTA text overlays
    await this.addTextOverlays(step2, hookText, ctaText, step3);

    log.info({ projectId, outputPath: step3 }, 'Shorts post-production complete');
    return step3;
  }

  // ── Full long-form post-production pipeline ───────────────────────────────────

  async produceLongFormVideo(params: {
    inputPath: string;
    srtPath: string;
    projectId: string;
    logoPath?: string;
  }): Promise<string> {
    const { inputPath, srtPath, projectId, logoPath } = params;

    const workDir = path.join(this.outputDir, projectId);
    ensureDir(workDir);

    const step1 = path.join(workDir, '01_captioned.mp4');
    const step2 = logoPath ? path.join(workDir, '02_watermarked.mp4') : step1;

    // Step 1: Burn captions
    await this.burnCaptions(inputPath, srtPath, step1);

    // Step 2 (optional): Watermark
    if (logoPath && existsSync(logoPath)) {
      await this.addWatermark(step1, logoPath, step2);
    }

    log.info({ projectId, outputPath: step2 }, 'Long-form post-production complete');
    return step2;
  }
}
