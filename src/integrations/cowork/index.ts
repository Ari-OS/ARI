/**
 * Cowork Integration Module
 *
 * Bidirectional Claude Cowork plugin integration for ARI.
 * - Import external Cowork plugins
 * - Export ARI capabilities as Cowork plugins
 * - Generate domain-specific plugins
 * - Composio Tool Router integration (500+ apps)
 *
 * Reference: https://github.com/ComposioHQ/open-claude-cowork
 */

export * from './types.js';
export * from './bridge.js';
export * from './generator.js';
export * from './composio-connector.js';

// Re-export singleton instances
export { getCoworkBridge } from './bridge.js';
export { pluginGenerator } from './generator.js';
export { getComposioConnector, COMPOSIO_APPS } from './composio-connector.js';
