import {
  SkillMetadataSchema,
  SkillDefinitionSchema,
  type SkillMetadata,
  type SkillPermission,
  parseSkillFrontmatter,
  computeSkillHash,
} from './types.js';

/**
 * Skill Validation Result
 */
export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: SkillMetadata;
}

/**
 * Blocked permissions that are never allowed
 */
const ALWAYS_BLOCKED: SkillPermission[] = ['network_access'];

/**
 * SkillValidator
 *
 * Validates skill definitions against the schema and security requirements.
 */
export class SkillValidator {
  private blockedPermissions: Set<SkillPermission>;

  constructor(blockedPermissions: SkillPermission[] = ALWAYS_BLOCKED) {
    this.blockedPermissions = new Set([...ALWAYS_BLOCKED, ...blockedPermissions]);
  }

  /**
   * Validate skill file content
   */
  validateContent(content: string): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty content
    if (!content || content.trim().length === 0) {
      return { valid: false, errors: ['Skill content cannot be empty'], warnings: [] };
    }

    // Parse frontmatter
    const { metadata: rawMetadata, body } = parseSkillFrontmatter(content);

    // Check for missing frontmatter
    if (Object.keys(rawMetadata).length === 0) {
      errors.push('Skill must have YAML frontmatter (between --- markers)');
      return { valid: false, errors, warnings };
    }

    // Validate required fields
    if (!rawMetadata.name) {
      errors.push('Skill must have a name');
    }
    if (!rawMetadata.description) {
      errors.push('Skill must have a description');
    }
    if (!rawMetadata.version) {
      errors.push('Skill must have a version');
    }

    // Validate name format
    if (rawMetadata.name && typeof rawMetadata.name === 'string') {
      if (!/^[a-z0-9-]+$/.test(rawMetadata.name)) {
        errors.push('Skill name must contain only lowercase letters, numbers, and hyphens');
      }
    }

    // Validate version format
    if (rawMetadata.version && typeof rawMetadata.version === 'string') {
      if (!/^\d+\.\d+\.\d+$/.test(rawMetadata.version)) {
        errors.push('Skill version must be in semver format (e.g., 1.0.0)');
      }
    }

    // Check body content
    if (!body || body.trim().length === 0) {
      warnings.push('Skill has no instruction content after frontmatter');
    }

    // Early return if basic validation failed
    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // Full schema validation
    try {
      const metadata = SkillMetadataSchema.parse(rawMetadata);

      // Check for blocked permissions
      const blockedFound = metadata.permissions.filter(p => this.blockedPermissions.has(p));
      if (blockedFound.length > 0) {
        errors.push(`Blocked permissions requested: ${blockedFound.join(', ')}`);
      }

      // Security warnings
      if (metadata.permissions.includes('execute_bash')) {
        warnings.push('Skill requests bash execution permission - use with caution');
      }
      if (metadata.permissions.includes('write_files')) {
        warnings.push('Skill requests file write permission - verify trust');
      }

      // Trigger pattern validation
      for (const trigger of metadata.triggers) {
        if (trigger.isRegex) {
          try {
            new RegExp(trigger.pattern);
          } catch {
            errors.push(`Invalid regex pattern in trigger: ${trigger.pattern}`);
          }
        }
      }

      // Circular dependency check (basic)
      if (metadata.dependencies.includes(metadata.name)) {
        errors.push('Skill cannot depend on itself');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        metadata: errors.length === 0 ? metadata : undefined,
      };
    } catch (error) {
      if (error instanceof Error) {
        errors.push(`Schema validation failed: ${error.message}`);
      } else {
        errors.push('Schema validation failed');
      }
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Validate a skill definition
   */
  validateDefinition(definition: unknown): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const validated = SkillDefinitionSchema.parse(definition);

      // Validate the content portion
      const contentResult = this.validateContent(validated.content);
      errors.push(...contentResult.errors);
      warnings.push(...contentResult.warnings);

      // Check content hash
      const expectedHash = computeSkillHash(validated.content);
      if (validated.contentHash !== expectedHash) {
        warnings.push('Content hash mismatch - skill may have been modified');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        metadata: validated.metadata,
      };
    } catch (error) {
      if (error instanceof Error) {
        errors.push(`Definition validation failed: ${error.message}`);
      } else {
        errors.push('Definition validation failed');
      }
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Validate skill permissions against trust level
   */
  validatePermissions(
    permissions: SkillPermission[],
    trustLevel: string
  ): { allowed: SkillPermission[]; denied: SkillPermission[]; reason?: string } {
    const allowed: SkillPermission[] = [];
    const denied: SkillPermission[] = [];

    // Trust level hierarchy
    const trustHierarchy = ['hostile', 'untrusted', 'standard', 'verified', 'operator', 'system'];
    const trustIndex = trustHierarchy.indexOf(trustLevel);

    for (const permission of permissions) {
      // Always denied permissions
      if (this.blockedPermissions.has(permission)) {
        denied.push(permission);
        continue;
      }

      // Permission-specific trust requirements
      const minTrust = this.getMinTrustForPermission(permission);
      const minTrustIndex = trustHierarchy.indexOf(minTrust);

      if (trustIndex >= minTrustIndex) {
        allowed.push(permission);
      } else {
        denied.push(permission);
      }
    }

    return {
      allowed,
      denied,
      reason: denied.length > 0
        ? `Insufficient trust level for: ${denied.join(', ')}`
        : undefined,
    };
  }

  /**
   * Get minimum trust level for a permission
   */
  private getMinTrustForPermission(permission: SkillPermission): string {
    switch (permission) {
      case 'network_access':
        return 'system'; // Never allowed
      case 'execute_bash':
        return 'operator';
      case 'write_files':
        return 'verified';
      case 'memory_write':
        return 'verified';
      case 'governance_vote':
        return 'operator';
      case 'tool_execute':
        return 'standard';
      case 'read_files':
        return 'standard';
      case 'memory_read':
        return 'standard';
      case 'session_access':
        return 'standard';
      case 'channel_send':
        return 'standard';
      default:
        return 'standard';
    }
  }

  /**
   * Update blocked permissions
   */
  setBlockedPermissions(permissions: SkillPermission[]): void {
    this.blockedPermissions = new Set([...ALWAYS_BLOCKED, ...permissions]);
  }

  /**
   * Check if a permission is blocked
   */
  isBlocked(permission: SkillPermission): boolean {
    return this.blockedPermissions.has(permission);
  }
}

/**
 * Create a skill validator with custom blocked permissions
 */
export function createSkillValidator(blockedPermissions?: SkillPermission[]): SkillValidator {
  return new SkillValidator(blockedPermissions);
}
