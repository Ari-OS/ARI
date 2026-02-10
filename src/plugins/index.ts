// Plugin types
export type {
  PluginStatus,
  PluginCapability,
  PluginManifest,
  PluginDependencies,
  BriefingContribution,
  ScheduledTaskDefinition,
  AlertContribution,
  PluginInitiative,
  DomainPlugin,
} from './types.js';

export {
  PluginStatusSchema,
  PluginCapabilitySchema,
  PluginManifestSchema,
} from './types.js';

// Plugin registry
export { PluginRegistry } from './registry.js';

// Bridge files
export { BriefingAggregator } from './briefing-aggregator.js';
export { SchedulerBridge } from './scheduler-bridge.js';
export { AlertBridge } from './alert-bridge.js';
export { InitiativeBridge } from './initiative-bridge.js';
