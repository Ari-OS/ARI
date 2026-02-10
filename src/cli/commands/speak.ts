import { Command } from 'commander';
import { EventBus } from '../../kernel/event-bus.js';
import { PluginRegistry } from '../../plugins/registry.js';
import { TtsPlugin } from '../../plugins/tts/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// SPEAK CLI COMMAND
// ═══════════════════════════════════════════════════════════════════════════════

async function getPlugin(): Promise<TtsPlugin> {
  const eventBus = new EventBus();
  const registry = new PluginRegistry(eventBus);
  const plugin = new TtsPlugin();
  await registry.register(plugin);

  await plugin.initialize({
    eventBus,
    orchestrator: null as never,
    config: {},
    dataDir: `${process.env.HOME}/.ari/plugins/tts/data`,
    costTracker: null,
    registry,
  });

  return plugin;
}

export function registerSpeakCommand(program: Command): void {
  program
    .command('speak <text...>')
    .description('Convert text to speech using ElevenLabs')
    .option('-o, --output <path>', 'Save audio to file')
    .option('-v, --voice <voiceId>', 'ElevenLabs voice ID')
    .option('--estimate', 'Only show cost estimate')
    .action(async (textParts: string[], options: { output?: string; voice?: string; estimate?: boolean }) => {
      try {
        const text = textParts.join(' ');
        const plugin = await getPlugin();

        if (options.estimate) {
          const cost = plugin.estimateCost(text);
          const spent = plugin.getDailySpend();
          const cap = plugin.getDailyCap();

          console.log(`\n  Text length: ${text.length} chars`);
          console.log(`  Estimated cost: $${cost.toFixed(4)}`);
          console.log(`  Daily spend: $${spent.toFixed(4)} / $${cap.toFixed(2)}`);
          console.log(`  Remaining: $${(cap - spent).toFixed(4)}\n`);
          return;
        }

        if (options.output) {
          const result = await plugin.speakToFile(text, options.output, 'cli');
          const cached = result.cached ? ' (cached)' : '';
          console.log(`\n  Audio saved to: ${options.output}${cached}`);
          console.log(`  Cost: $${result.estimatedCost.toFixed(4)}\n`);
        } else {
          const result = await plugin.speak(text, 'cli');
          const cached = result.cached ? ' (cached)' : '';
          console.log(`\n  Speech generated: ${result.textLength} chars, $${result.estimatedCost.toFixed(4)}${cached}`);
          console.log(`  Use --output <path> to save to file\n`);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
