import { Command } from 'commander';
import { AIOrchestrator } from '../../ai/orchestrator.js';
import { ModelRegistry } from '../../ai/model-registry.js';
import { EventBus } from '../../kernel/event-bus.js';

// ── ANSI Colors ─────────────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

// ── Command Registration ────────────────────────────────────────────────────

export function registerAskCommand(program: Command): void {
  program
    .command('ask <question>')
    .description('One-shot AI query (fast startup, no full pipeline)')
    .option('--model <model>', 'Override model selection (e.g., claude-sonnet-4, claude-opus-4.5)')
    .option('--json', 'Output as JSON with metadata (model, tokens, cost, duration)')
    .action(async (question: string, options: { model?: string; json?: boolean }) => {
      try {
        // 1. Check for API key
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          console.error(colorize('Error: ANTHROPIC_API_KEY environment variable not set', 'red'));
          console.error('');
          console.error('Set it with:');
          console.error(colorize('  export ANTHROPIC_API_KEY=your_key_here', 'dim'));
          process.exit(1);
        }

        // 2. Validate model if provided
        const registry = new ModelRegistry();
        const validModels = registry.listModels().map(m => m.id);

        let selectedModel: string | undefined;
        if (options.model) {
          if (!validModels.includes(options.model)) {
            console.error(colorize(`Error: Invalid model '${options.model}'`, 'red'));
            console.error('');
            console.error('Valid models:');
            for (const model of validModels) {
              console.error(colorize(`  - ${model}`, 'dim'));
            }
            process.exit(1);
          }
          selectedModel = options.model;
        }

        // 3. Create minimal pipeline (EventBus + AIOrchestrator)
        const eventBus = new EventBus();
        const orchestrator = new AIOrchestrator(eventBus, {
          apiKey,
          defaultModel: selectedModel,
        });

        // 4. Execute query
        const startTime = Date.now();
        const response = await orchestrator.execute({
          content: question,
          category: 'query',
          agent: 'core',
          trustLevel: 'system',
          priority: 'STANDARD',
          enableCaching: true,
          securitySensitive: false,
        });
        const totalDuration = Date.now() - startTime;

        // 5. Output response
        if (options.json) {
          console.log(JSON.stringify({
            answer: response.content,
            model: response.model,
            tokens: {
              input: response.inputTokens,
              output: response.outputTokens,
            },
            cost: response.cost,
            duration: response.duration,
            totalDuration,
            cached: response.cached,
            qualityScore: response.qualityScore,
            escalated: response.escalated,
          }, null, 2));
        } else {
          // Pretty output
          console.log('');
          console.log(response.content);
          console.log('');
          console.log(colorize('─'.repeat(60), 'dim'));
          console.log(colorize(`Model: ${response.model} | Tokens: ${response.inputTokens + response.outputTokens} | Cost: $${response.cost.toFixed(4)} | ${response.duration}ms`, 'dim'));
          if (response.cached) {
            console.log(colorize('(Prompt cache hit — input tokens saved)', 'dim'));
          }
          if (response.escalated) {
            console.log(colorize(`Escalated: ${response.escalationReason ?? 'quality improvement'}`, 'yellow'));
          }
          console.log('');
        }

        // Clean shutdown
        await orchestrator.shutdown();
        process.exit(0);

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!options.json) {
          console.error('');
          console.error(colorize('Error:', 'red'), message);
          console.error('');
        } else {
          console.error(JSON.stringify({ error: message }, null, 2));
        }
        process.exit(1);
      }
    });
}
