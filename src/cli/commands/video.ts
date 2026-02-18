/**
 * Video Pipeline CLI Commands
 *
 * video create <topic>  — Run the full pipeline: topic → YouTube
 * video list            — List all video projects
 * video status <id>     — Show project status
 * video approve <id>    — Approve a pending approval request (CLI fallback)
 * video reject <id>     — Reject a pending approval request (CLI fallback)
 *
 * Layer: L6 Interfaces (CLI)
 */

import { Command } from 'commander';
import { EventBus } from '../../kernel/event-bus.js';
import { ScriptGenerator } from '../../plugins/video-pipeline/script-generator.js';
import { AvatarRenderer } from '../../plugins/video-pipeline/avatar-renderer.js';
import { CaptionsGenerator } from '../../plugins/video-pipeline/captions-generator.js';
import { VideoAssembler } from '../../plugins/video-pipeline/video-assembler.js';
import { ThumbnailGenerator } from '../../plugins/video-pipeline/thumbnail-generator.js';
import { ApprovalGate } from '../../plugins/video-pipeline/approval-gate.js';
import { YouTubePublisher } from '../../plugins/video-pipeline/youtube-publisher.js';
import { PipelineOrchestrator } from '../../plugins/video-pipeline/pipeline-orchestrator.js';
import { VideoPipelineConfigSchema } from '../../plugins/video-pipeline/types.js';
import type { VideoFormat } from '../../plugins/video-pipeline/types.js';
import { AIOrchestrator } from '../../ai/orchestrator.js';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ─── Status display helpers ───────────────────────────────────────────────────

const STATUS_ICONS: Record<string, string> = {
  scripting:    '📝',
  approved:     '✅',
  rendering:    '🎬',
  transcribing: '🎙',
  assembling:   '⚙️',
  ready:        '📦',
  publishing:   '📤',
  published:    '🟢',
  failed:       '❌',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Build orchestrator ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/require-await
async function buildOrchestrator(requireApproval: boolean): Promise<PipelineOrchestrator> {
  const eventBus = new EventBus();

  const config = VideoPipelineConfigSchema.parse({
    heygenApiKey:         process.env.HEYGEN_API_KEY,
    avatarId:             process.env.HEYGEN_AVATAR_ID,
    voiceId:              process.env.HEYGEN_VOICE_ID,
    assemblyAiApiKey:     process.env.ASSEMBLY_AI_API_KEY,
    youtubeClientId:      process.env.YOUTUBE_CLIENT_ID,
    youtubeClientSecret:  process.env.YOUTUBE_CLIENT_SECRET,
    youtubeRefreshToken:  process.env.YOUTUBE_REFRESH_TOKEN,
    openaiApiKey:         process.env.OPENAI_API_KEY,
    outputDir:            join(homedir(), '.ari', 'video-output'),
    requireApproval,
    autoGenerateThumbnail: Boolean(process.env.OPENAI_API_KEY),
  });

  const aiOrchestrator = new AIOrchestrator(new EventBus(), {});

  const orchAdapter = {
    chat: (messages: Array<{ role: string; content: string }>, systemPrompt?: string) =>
      aiOrchestrator.chat(
        messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: m.content,
        })),
        systemPrompt,
      ),
  };

  const scriptGenerator = new ScriptGenerator(orchAdapter);
  const avatarRenderer = new AvatarRenderer(config.heygenApiKey);
  const captionsGenerator = new CaptionsGenerator(config.assemblyAiApiKey);
  const videoAssembler = new VideoAssembler(config.outputDir ?? join(homedir(), '.ari', 'video-output'));
  const thumbnailGenerator = new ThumbnailGenerator(config.openaiApiKey);
  const approvalGate = new ApprovalGate(eventBus);
  const youtubePublisher = new YouTubePublisher({
    clientId: config.youtubeClientId,
    clientSecret: config.youtubeClientSecret,
    refreshToken: config.youtubeRefreshToken,
  });

  return new PipelineOrchestrator(
    eventBus,
    config,
    scriptGenerator,
    avatarRenderer,
    captionsGenerator,
    videoAssembler,
    thumbnailGenerator,
    approvalGate,
    youtubePublisher,
    orchAdapter,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

export function registerVideoCommand(program: Command): void {
  const video = program
    .command('video')
    .description('Automated video pipeline: topic → script → HeyGen → captions → YouTube');

  // ── video create ─────────────────────────────────────────────────────────────

  video
    .command('create <topic>')
    .description('Run the full video pipeline for a topic')
    .option('-f, --format <format>', 'Video format: long_form, short, tutorial (default: long_form)')
    .option('-k, --keywords <keywords>', 'Comma-separated SEO keywords')
    .option('--no-approval', 'Skip Telegram approval gates')
    .option('--json', 'Output final project as JSON')
    .action(async (topic: string, options: {
      format?: string;
      keywords?: string;
      approval: boolean;
      json?: boolean;
    }) => {
      const format = (options.format ?? 'long_form') as VideoFormat;
      const keywords = options.keywords ? options.keywords.split(',').map((k) => k.trim()) : [];
      const requireApproval = options.approval !== false;

      console.log(`\n  ARI Video Pipeline`);
      console.log(`  Topic: "${topic}"`);
      console.log(`  Format: ${format}`);
      if (keywords.length > 0) console.log(`  Keywords: ${keywords.join(', ')}`);
      console.log(`  Approval gates: ${requireApproval ? 'enabled (Telegram)' : 'disabled'}`);
      console.log();

      try {
        const orchestrator = await buildOrchestrator(requireApproval);

        const project = await orchestrator.run({
          topic,
          format,
          keywords,
          onProgress: (stage, message) => {
            const icon = STATUS_ICONS[stage] ?? '⏳';
            console.log(`  ${icon} [${stage}] ${message}`);
          },
        });

        if (options.json) {
          console.log(JSON.stringify(project, null, 2));
          return;
        }

        console.log('\n  ════════════════════════════════');
        console.log('  ✅ Pipeline complete!');
        console.log(`  Project ID: ${project.id}`);
        console.log(`  Title:      ${project.title}`);
        console.log(`  Status:     ${project.status}`);
        if (project.outputPath) {
          console.log(`  Output:     ${project.outputPath}`);
        }
        console.log();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\n  ❌ Pipeline failed: ${msg}\n`);
        process.exit(1);
      }
    });

  // ── video list ────────────────────────────────────────────────────────────────

  video
    .command('list')
    .description('List all video projects')
    .option('--json', 'Output as JSON')
    .option('--status <status>', 'Filter by status')
    .action((options: { json?: boolean; status?: string }) => {
      const projects = PipelineOrchestrator.listProjects();

      const filtered = options.status
        ? projects.filter((p) => p.status === options.status)
        : projects;

      if (options.json) {
        console.log(JSON.stringify(filtered, null, 2));
        return;
      }

      if (filtered.length === 0) {
        console.log('\n  No video projects found.\n');
        return;
      }

      console.log('\n  Video Projects');
      console.log('  ───────────────────────────────────────────────────────');

      for (const p of filtered) {
        const icon = STATUS_ICONS[p.status] ?? '⏳';
        const date = formatDate(p.createdAt);
        const title = p.title.length > 40 ? p.title.slice(0, 37) + '...' : p.title;
        console.log(`  ${icon} ${p.id.slice(0, 8)}  ${title.padEnd(42)} ${p.status.padEnd(14)} ${date}`);
      }

      console.log();
    });

  // ── video status ──────────────────────────────────────────────────────────────

  video
    .command('status <projectId>')
    .description('Show detailed status of a video project')
    .option('--json', 'Output as JSON')
    .action((projectId: string, options: { json?: boolean }) => {
      const project = PipelineOrchestrator.loadProject(projectId);

      if (!project) {
        // Try prefix match
        const all = PipelineOrchestrator.listProjects();
        const match = all.find((p) => p.id.startsWith(projectId));
        if (!match) {
          console.error(`\n  Error: Project not found: ${projectId}\n`);
          process.exit(1);
        }
        Object.assign(project ?? {}, match);
        if (!project) return;
      }

      if (options.json) {
        console.log(JSON.stringify(project, null, 2));
        return;
      }

      const icon = STATUS_ICONS[project.status] ?? '⏳';

      console.log('\n  Video Project Status');
      console.log('  ────────────────────');
      console.log(`  ID:        ${project.id}`);
      console.log(`  Title:     ${project.title}`);
      console.log(`  Format:    ${project.format}`);
      console.log(`  Status:    ${icon} ${project.status}`);
      console.log(`  Created:   ${formatDate(project.createdAt)}`);
      if (project.publishedAt) {
        console.log(`  Published: ${formatDate(project.publishedAt)}`);
      }

      console.log('\n  Assets:');
      if (project.avatarVideoId) console.log(`    HeyGen ID:  ${project.avatarVideoId}`);
      if (project.rawVideoPath) console.log(`    Raw video:  ${project.rawVideoPath}`);
      if (project.captionedVideoPath) console.log(`    Captioned:  ${project.captionedVideoPath}`);
      if (project.thumbnailPath) console.log(`    Thumbnail:  ${project.thumbnailPath}`);
      if (project.outputPath) console.log(`    Output:     ${project.outputPath}`);

      const pendingRequests = ApprovalGate.getPendingRequests();
      const projectRequests = pendingRequests.filter((r) => r.videoProjectId === project.id);
      if (projectRequests.length > 0) {
        console.log('\n  Pending Approvals:');
        for (const r of projectRequests) {
          console.log(`    ${r.id.slice(0, 8)}  type=${r.type}  since=${formatDate(r.requestedAt)}`);
        }
      }

      console.log();
    });

  // ── video approve ─────────────────────────────────────────────────────────────

  video
    .command('approve <requestId>')
    .description('Approve a pending video approval request (CLI fallback when no Telegram)')
    .option('-m, --message <message>', 'Optional approval note')
    .action((requestId: string, options: { message?: string }) => {
      const eventBus = new EventBus();

      if (!ApprovalGate.hasPendingRequest(requestId)) {
        console.error(`\n  Error: No pending approval request with ID: ${requestId}`);
        console.error('  Run `ari video list` to see active projects.\n');
        process.exit(1);
      }

      ApprovalGate.handleApprovalResponse(eventBus, requestId, 'approve', options.message);
      console.log(`\n  ✅ Approved: ${requestId}\n`);
    });

  // ── video reject ──────────────────────────────────────────────────────────────

  video
    .command('reject <requestId>')
    .description('Reject a pending video approval request')
    .option('-m, --message <message>', 'Rejection reason')
    .action((requestId: string, options: { message?: string }) => {
      const eventBus = new EventBus();

      if (!ApprovalGate.hasPendingRequest(requestId)) {
        console.error(`\n  Error: No pending approval request with ID: ${requestId}`);
        process.exit(1);
      }

      ApprovalGate.handleApprovalResponse(eventBus, requestId, 'reject', options.message ?? 'Rejected via CLI');
      console.log(`\n  ❌ Rejected: ${requestId}\n`);
    });
}
