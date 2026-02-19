import type { Context } from 'grammy';
import type { EventBus } from '../../../kernel/event-bus.js';
import type { PluginRegistry } from '../../../plugins/registry.js';
import type { VideoPipelinePlugin } from '../../video-pipeline/index.js';
import type { VideoFormat } from '../../video-pipeline/types.js';
import { detectContentType } from '../../video-pipeline/script-generator.js';

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
      '<b>🎬 PayThePryce Video Pipeline</b>\n\n' +
      'ARI handles everything autonomously — script, avatar render, captions, thumbnail, and YouTube upload. You approve before anything publishes.\n\n' +
      '<b>Usage:</b> <code>/video &lt;topic&gt;</code>\n\n' +
      '<b>Pokémon TCG examples:</b>\n' +
      '• <code>/video I opened a full booster box of Prismatic Evolutions</code>\n' +
      '• <code>/video Why Charizard ex is going up this month</code>\n' +
      '• <code>/video short This card is worth $400 — here\'s why</code>\n' +
      '• <code>/video live reaction to my best Scarlet Violet pull</code>\n\n' +
      '<b>AI/building examples:</b>\n' +
      '• <code>/video I built an AI that monitors my Pokémon collection</code>\n' +
      '• <code>/video tutorial How I automated my morning with ARI</code>\n\n' +
      '<b>Format prefixes:</b>\n' +
      '• (none) — 12-15 min YouTube video\n' +
      '• <code>short</code> — 30-45s vertical Short\n' +
      '• <code>tutorial</code> — screenshare + avatar\n' +
      '• <code>live</code> — 20-30s live stream highlight clip\n\n' +
      '<i>ARI auto-detects Pokémon vs AI content and applies the right brand voice.</i>',
      { parse_mode: 'HTML' },
    );
    return;
  }

  // Parse optional format prefix
  let format: VideoFormat = 'long_form';
  let topic = input;

  const shortMatch = input.match(/^shorts?\s+(.+)/i);
  const tutorialMatch = input.match(/^tutorial\s+(.+)/i);
  const liveMatch = input.match(/^live\s+(.+)/i);

  if (shortMatch?.[1]) {
    format = 'short';
    topic = shortMatch[1];
  } else if (liveMatch?.[1]) {
    format = 'live_clip';
    topic = liveMatch[1];
  } else if (tutorialMatch?.[1]) {
    format = 'tutorial';
    topic = tutorialMatch[1];
  }

  const chatId = ctx.chat?.id;
  const contentType = detectContentType(topic);
  const formatLabel = format === 'long_form' ? 'long form' : format.replace('_', ' ');

  const contentLabel =
    contentType === 'pokemon' ? '🃏 Pokémon TCG' :
    contentType === 'ai_build' ? '🤖 AI/Building' :
    contentType === 'live_clip' ? '🔴 Live Clip' : '📹 General';

  await ctx.reply(
    `🎬 <b>Video pipeline started!</b>\n\n` +
    `📝 Topic: <b>${topic}</b>\n` +
    `📐 Format: <b>${formatLabel}</b>\n` +
    `🎯 Content type: <b>${contentLabel}</b>\n\n` +
    `I'll send you updates at each stage.\n` +
    `<i>Script: ~2 min | Render: ~15-20 min | Total: ~30 min</i>\n\n` +
    `<i>You'll be asked to approve the script before rendering begins.</i>`,
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
