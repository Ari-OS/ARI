import { Command } from 'commander';
import { EventBus } from '../../kernel/event-bus.js';
import { ModelRegistry } from '../../ai/model-registry.js';
import { ProviderRegistry } from '../../ai/provider-registry.js';
import type { LLMProviderId } from '../../ai/providers/types.js';
import { LLMProviderIdSchema } from '../../ai/providers/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER CLI COMMAND
// ═══════════════════════════════════════════════════════════════════════════════

export function registerProviderCommand(program: Command): void {
  const provider = program
    .command('provider')
    .description('Manage LLM providers and multi-model routing');

  // ── provider list ────────────────────────────────────────────────────

  provider
    .command('list')
    .description('List all LLM providers with connection status')
    .action(async () => {
      const eventBus = new EventBus();
      const modelRegistry = new ModelRegistry();
      const providerRegistry = new ProviderRegistry(eventBus, modelRegistry);

      // Register from environment
      await providerRegistry.registerFromEnv();

      const activeProviders = providerRegistry.getActiveProviders();

      console.log('LLM Providers:\n');

      const allProviders: LLMProviderId[] = ['anthropic', 'openai', 'google', 'xai'];

      for (const id of allProviders) {
        const isActive = activeProviders.includes(id);
        const icon = isActive ? '[✓]' : '[ ]';
        const models = modelRegistry.getModelsByProvider(id);
        const availableModels = models.filter(m => m.isAvailable);

        console.log(`  ${icon} ${id.padEnd(12)} ${isActive ? 'Connected' : 'Not configured'}`);
        if (isActive) {
          console.log(`      Models: ${availableModels.map(m => m.id).join(', ')}`);
        }
      }

      console.log(`\nActive: ${activeProviders.length}/${allProviders.length} providers`);
      console.log(`Models: ${modelRegistry.listModels().filter(m => m.isAvailable).length} available`);
    });

  // ── provider test <id> ───────────────────────────────────────────────

  provider
    .command('test <id>')
    .description('Test provider connection and latency')
    .action(async (id: string) => {
      const parsed = LLMProviderIdSchema.safeParse(id);
      if (!parsed.success) {
        console.error(`Invalid provider ID: ${id}`);
        console.error('Valid providers: anthropic, openai, google, xai');
        process.exit(1);
      }

      const eventBus = new EventBus();
      const modelRegistry = new ModelRegistry();
      const providerRegistry = new ProviderRegistry(eventBus, modelRegistry);

      await providerRegistry.registerFromEnv();

      if (!providerRegistry.isProviderRegistered(parsed.data)) {
        console.error(`Provider not configured: ${id}`);
        console.error(`Set the API key environment variable to enable this provider.`);
        process.exit(1);
      }

      console.log(`Testing ${id} connection...`);
      const results = await providerRegistry.testAllProviders();
      const result = results.get(parsed.data);

      if (!result) {
        console.error(`No test result for: ${id}`);
        process.exit(1);
      }

      if (result.connected) {
        console.log(`  [✓] Connected (${result.latencyMs}ms latency)`);
      } else {
        console.log(`  [✗] Failed: ${result.error}`);
        process.exit(1);
      }
    });

  // ── provider models ──────────────────────────────────────────────────

  provider
    .command('models')
    .description('List all models across all providers')
    .action(() => {
      const modelRegistry = new ModelRegistry();
      const models = modelRegistry.listModels();

      console.log('All Models:\n');
      console.log('  Model                    Provider    Quality  Speed  Input/1M  Output/1M  Available');
      console.log('  ───────────────────────  ──────────  ───────  ─────  ────────  ─────────  ─────────');

      for (const m of models) {
        const avail = m.isAvailable ? '  Yes' : '  No';
        console.log(
          `  ${m.id.padEnd(25)} ${m.provider.padEnd(12)} ${String(m.quality).padEnd(8)} ${String(m.speed).padEnd(6)} $${m.costPer1MInput.toFixed(2).padStart(6)}  $${m.costPer1MOutput.toFixed(2).padStart(8)} ${avail}`,
        );
      }

      console.log(`\nTotal: ${models.length} models (${models.filter(m => m.isAvailable).length} available)`);
    });
}
