import { Command } from 'commander';
import { EventBus } from '../../kernel/event-bus.js';
import { PluginRegistry } from '../../plugins/registry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// PLUGIN CLI COMMAND
// ═══════════════════════════════════════════════════════════════════════════════

export function registerPluginCommand(program: Command): void {
  const plugin = program
    .command('plugin')
    .description('Manage ARI domain plugins');

  // ── plugin list ──────────────────────────────────────────────────────

  plugin
    .command('list')
    .description('List all registered plugins with status')
    .action(() => {
      const eventBus = new EventBus();
      const registry = new PluginRegistry(eventBus);

      const plugins = registry.listPlugins();

      if (plugins.length === 0) {
        console.log('No plugins registered.\n');
        console.log('Plugins will be available after Phase 5 implementation.');
        return;
      }

      console.log('Registered Plugins:\n');
      console.log('  ID                  Status      Capabilities');
      console.log('  ──────────────────  ──────────  ────────────────────');

      for (const p of plugins) {
        const statusIcon =
          p.status === 'active' ? '[✓]' :
          p.status === 'error' ? '[✗]' :
          p.status === 'disabled' ? '[-]' :
          '[ ]';

        console.log(
          `  ${statusIcon} ${p.id.padEnd(16)} ${p.status.padEnd(12)} ${p.capabilities.join(', ')}`,
        );
      }

      console.log(`\nTotal: ${plugins.length} plugin(s)`);
    });

  // ── plugin status <id> ───────────────────────────────────────────────

  plugin
    .command('status <id>')
    .description('Show detailed status for a specific plugin')
    .action((id: string) => {
      const eventBus = new EventBus();
      const registry = new PluginRegistry(eventBus);

      const status = registry.getPluginStatus(id);
      if (!status) {
        console.error(`Plugin not found: ${id}`);
        process.exit(1);
      }

      const pluginInfo = registry.getPlugin(id);
      if (!pluginInfo) {
        console.error(`Plugin not found: ${id}`);
        process.exit(1);
      }

      console.log(`Plugin: ${pluginInfo.manifest.name}`);
      console.log(`  ID:           ${pluginInfo.manifest.id}`);
      console.log(`  Version:      ${pluginInfo.manifest.version}`);
      console.log(`  Status:       ${status}`);
      console.log(`  Capabilities: ${pluginInfo.manifest.capabilities.join(', ')}`);
      console.log(`  Description:  ${pluginInfo.manifest.description}`);

      if (pluginInfo.manifest.dependencies.length > 0) {
        console.log(`  Dependencies: ${pluginInfo.manifest.dependencies.join(', ')}`);
      }
    });
}
