import type { PluginRegistry } from './registry.js';
import type { PluginInitiative } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// INITIATIVE BRIDGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * InitiativeBridge — Connects plugin initiative discoverers to the initiative engine.
 *
 * Connects to: autonomous/initiative-engine.ts → discoverInitiatives()
 * Each plugin with 'initiative' capability can suggest autonomous work.
 */
export class InitiativeBridge {
  private readonly pluginRegistry: PluginRegistry;

  constructor(pluginRegistry: PluginRegistry) {
    this.pluginRegistry = pluginRegistry;
  }

  /**
   * Collect all initiatives from active plugins, sorted by priority.
   */
  async collectInitiatives(): Promise<PluginInitiative[]> {
    return this.pluginRegistry.collectInitiatives();
  }
}
