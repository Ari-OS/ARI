import type { Context } from 'grammy';
import type { PluginRegistry } from '../../../plugins/registry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /status — System health overview
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleStatus(
  ctx: Context,
  registry: PluginRegistry | null,
): Promise<void> {
  const lines: string[] = ['<b>ARI System Status</b>', ''];

  if (!registry) {
    lines.push('Plugin registry not available.');
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
    return;
  }

  const plugins = registry.listPlugins();
  if (plugins.length === 0) {
    lines.push('No plugins registered.');
  } else {
    for (const p of plugins) {
      const icon = p.status === 'active' ? '🟢' : p.status === 'error' ? '🔴' : '⚪';
      lines.push(`${icon} <b>${p.name}</b> — ${p.status}`);
    }
  }

  lines.push('');
  lines.push(`<i>Plugins: ${plugins.length} | Active: ${plugins.filter(p => p.status === 'active').length}</i>`);

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}
