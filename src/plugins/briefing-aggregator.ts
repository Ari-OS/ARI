import type { PluginRegistry } from './registry.js';
import type { BriefingContribution } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// BRIEFING AGGREGATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * BriefingAggregator — Collects and formats plugin contributions for briefings.
 *
 * Connects to: autonomous/briefings.ts → morningBriefing()
 * Each plugin with 'briefing' capability contributes a section.
 */
export class BriefingAggregator {
  private readonly pluginRegistry: PluginRegistry;

  constructor(pluginRegistry: PluginRegistry) {
    this.pluginRegistry = pluginRegistry;
  }

  /**
   * Collect all plugin briefing contributions, sorted by priority.
   */
  async collect(type: 'morning' | 'evening' | 'weekly'): Promise<BriefingContribution[]> {
    return this.pluginRegistry.collectBriefings(type);
  }

  /**
   * Format contributions into a single markdown string for briefings.
   */
  async formatForBriefing(type: 'morning' | 'evening' | 'weekly'): Promise<string> {
    const contributions = await this.collect(type);

    if (contributions.length === 0) {
      return '';
    }

    const sections = contributions.map(c => {
      const icon = c.category === 'alert' ? '!' :
                   c.category === 'action' ? '>' :
                   c.category === 'insight' ? '*' : '-';
      return `### ${c.section}\n${icon} ${c.content}`;
    });

    return `## Plugin Updates\n\n${sections.join('\n\n')}`;
  }
}
