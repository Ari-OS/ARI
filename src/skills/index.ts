/**
 * Skills Module
 *
 * Enhanced skills system with 3-tier discovery, permission gating,
 * and governance integration.
 */

// Types
export {
  // Types
  type SkillPermission,
  type SkillTrustRequirement,
  type SkillSource,
  type SkillStatus,
  type SkillTrigger,
  type SkillTool,
  type SkillMetadata,
  type SkillDefinition,
  type SkillExecutionContext,
  type SkillExecutionResult,
  type SkillQuery,
  type SkillDiscoveryPaths,
  type SkillLoaderConfig,

  // Schemas
  SkillPermissionSchema,
  SkillTrustRequirementSchema,
  SkillSourceSchema,
  SkillStatusSchema,
  SkillTriggerSchema,
  SkillToolSchema,
  SkillMetadataSchema,
  SkillDefinitionSchema,
  SkillExecutionContextSchema,
  SkillExecutionResultSchema,
  SkillQuerySchema,

  // Constants
  DEFAULT_SKILL_LOADER_CONFIG,

  // Utilities
  parseSkillFrontmatter,
  computeSkillHash,
} from './types.js';

// Loader
export { SkillLoader } from './loader.js';

// Validator
export {
  SkillValidator,
  createSkillValidator,
  type SkillValidationResult,
} from './validator.js';

// Registry
export {
  SkillRegistry,
  type SkillMatch,
} from './registry.js';

// Executor
export {
  SkillExecutor,
  type ExecutionOptions,
} from './executor.js';

// Permissions
export {
  TRUST_HIERARCHY,
  PERMISSION_REQUIREMENTS,
  PERMISSION_CATEGORIES,
  PERMISSION_DESCRIPTIONS,
  TRUST_REQUIREMENT_MAP,
  getTrustScore,
  meetsOrExceeds,
  getRequiredTrust,
  canUsePermission,
  getPermissionCategory,
  getPermissionDescription,
  getTrustForRequirement,
  checkPermission,
  checkPermissions,
  canEscalate,
  getPermissionSummary,
  type PermissionCheckResult,
} from './permissions.js';
