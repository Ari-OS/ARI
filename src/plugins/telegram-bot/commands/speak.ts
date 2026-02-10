import { InputFile } from 'grammy';
import type { Context } from 'grammy';
import type { PluginRegistry } from '../../../plugins/registry.js';
import type { TtsPlugin } from '../../tts/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /speak — Text to speech via TtsPlugin, sends voice message
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleSpeak(
  ctx: Context,
  registry: PluginRegistry | null,
): Promise<void> {
  if (!registry) {
    await ctx.reply('Plugin registry not available.');
    return;
  }

  const plugin = registry.getPlugin<TtsPlugin>('tts');
  if (!plugin || plugin.getStatus() !== 'active') {
    await ctx.reply('TTS plugin not available.');
    return;
  }

  const text = ctx.message?.text ?? '';
  const speechText = text.replace(/^\/speak\s*/i, '').trim();

  if (!speechText) {
    const cost = plugin.estimateCost('Hello, this is a test.');
    await ctx.reply(
      `<b>Text-to-Speech</b>\n\n` +
      `Usage: /speak &lt;text&gt;\n\n` +
      `<i>Daily budget: $${plugin.getDailySpend().toFixed(3)} / $${plugin.getDailyCap().toFixed(2)}</i>\n` +
      `<i>~$${cost.toFixed(4)} per short message</i>`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  try {
    const estimate = plugin.estimateCost(speechText);
    if (estimate > 0.50) {
      await ctx.reply(`Text too long (est. $${estimate.toFixed(3)}). Max ~1600 chars per message.`);
      return;
    }

    await ctx.reply('Generating speech...');
    const result = await plugin.speak(speechText, `telegram:${ctx.from?.id ?? 'unknown'}`);

    const cached = result.cached ? ' (cached)' : '';
    await ctx.replyWithVoice(new InputFile(result.audioBuffer, 'speech.ogg'), {
      caption: `$${result.estimatedCost.toFixed(4)}${cached}`,
    });
  } catch (error) {
    await ctx.reply(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
