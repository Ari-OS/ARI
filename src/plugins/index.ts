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

// Bridge files removed — deprecated plugin bridges deleted in phase 3.5.1
