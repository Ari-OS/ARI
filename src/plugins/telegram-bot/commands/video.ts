import type { Context } from 'grammy';
import type { EventBus } from '../../../kernel/event-bus.js';
import type { PluginRegistry } from '../../../plugins/registry.js';
import type { VideoPipelinePlugin } from '../../video-pipeline/index.js';
import type { VideoFormat } from '../../video-pipeline/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /video — Autonomous video pipeline
// ═══════════════════════════════════════════════════════════════════════════════

const STAGE_ICONS: Record<string, string> = {
  init: '🎬',
  scripting: '📝',
  script_review: '👀',
  rendering: '🎥',
  transcribing: '🎙️',
  assembling: '⚙️',
  thumbnail: '🖼️',
  final_review: '✅',
  publishing: '📤',
  complete: '✅',
  error: '❌',
};

function stageIcon(stage: string): string {
  return STAGE_ICONS[stage] ?? '🔄';
}

export async function handleVideo(
  ctx: Context,
  registry: PluginRegistry | null,
  eventBus: EventBus,
): Promise<void> {
  if (!registry) {
    await ctx.reply('Plugin registry not available.');
    return;
  }

  const plugin = registry.getPlugin<VideoPipelinePlugin>('video-pipeline');
  if (!plugin || plugin.getStatus() !== 'active') {
    await ctx.reply(
      '⚠️ <b>Video pipeline not available.</b>\n\n' +
      'Set <code>HEYGEN_API_KEY</code> and <code>ASSEMBLY_AI_API_KEY</code> to enable.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const orchestrator = plugin.getOrchestrator();
  if (!orchestrator) {
    await ctx.reply(
      '⚠️ <b>Video pipeline not ready.</b>\n\nAI orchestrator not connected.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const rawText = ctx.message?.text ?? '';
  const input = rawText.replace(/^\/video\s*/i, '').trim();

  if (!input) {
    await ctx.reply(
      '<b>🎬 Video Pipeline</b>\n\n' +
      'Usage: <code>/video &lt;topic&gt;</code>\n\n' +
      '<b>Examples:</b>\n' +
      '• <code>/video Bitcoin investing for beginners</code>\n' +
      '• <code>/video short Why Pryceless Solutions?</code>\n' +
      '• <code>/video tutorial How to set up a home lab</code>\n\n' +
      '<b>Format prefixes (optional):</b>\n' +
      '• <code>short</code> — 30-60s vertical Shorts video\n' +
      '• <code>tutorial</code> — screenshare + avatar overlay\n' +
      '• (none) — 8-15 min YouTube video\n\n' +
      '<i>ARI handles everything: script → HeyGen render → captions → thumbnail → YouTube. ' +
      'You approve before anything is published.</i>',
      { parse_mode: 'HTML' },
    );
    return;
  }

  // Parse optional format prefix
  let format: VideoFormat = 'long_form';
  let topic = input;

  const shortMatch = input.match(/^shorts?\s+(.+)/i);
  const tutorialMatch = input.match(/^tutorial\s+(.+)/i);

  if (shortMatch?.[1]) {
    format = 'short';
    topic = shortMatch[1];
  } else if (tutorialMatch?.[1]) {
    format = 'tutorial';
    topic = tutorialMatch[1];
  }

  const chatId = ctx.chat?.id;
  const formatLabel = format === 'long_form' ? 'long form' : format;

  await ctx.reply(
    `🎬 <b>Video pipeline started!</b>\n\n` +
    `📝 Topic: <b>${topic}</b>\n` +
    `📐 Format: <b>${formatLabel}</b>\n\n` +
    `I'll send you updates at each stage.\n` +
    `<i>Script: ~2 min | Render: ~15-20 min | Total: ~30 min</i>\n\n` +
    `<i>You'll receive approval requests before anything publishes.</i>`,
    { parse_mode: 'HTML' },
  );

  // Fire-and-forget — progress updates delivered via EventBus → bot.ts listener
  orchestrator.run({
    topic,
    format,
    onProgress: (stage, message) => {
      if (chatId) {
        eventBus.emit('video:user_progress', {
          chatId,
          stage,
          message: `${stageIcon(stage)} <b>[${stage}]</b> ${message}`,
        });
      }
    },
  }).then((project) => {
    if (chatId) {
      eventBus.emit('video:user_progress', {
        chatId,
        stage: 'complete',
        message:
          `✅ <b>Pipeline complete!</b>\n\n` +
          `Project: <code>${project.id}</code>\n` +
          `Status: <b>${project.status}</b>` +
          (project.outputPath ? `\nOutput: <code>${project.outputPath}</code>` : ''),
      });
    }
  }).catch((error: unknown) => {
    if (chatId) {
      const msg = error instanceof Error ? error.message : String(error);
      eventBus.emit('video:user_progress', {
        chatId,
        stage: 'error',
        message: `❌ <b>Pipeline failed:</b> ${msg}`,
      });
    }
  });
}
