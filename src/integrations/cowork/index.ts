/**
 * Cowork Integration Module
 *
 * Bidirectional Claude Cowork plugin integration for ARI.
 * - Import external Cowork plugins
 * - Export ARI capabilities as Cowork plugins
 * - Generate domain-specific plugins
 */

export * from './types.js';
export * from './bridge.js';
export * from './generator.js';

// Re-export singleton instances
export { getCoworkBridge } from './bridge.js';
export { pluginGenerator } from './generator.js';
