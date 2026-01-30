import { createHash } from 'crypto';
import { z } from 'zod';
import { TrustLevelSchema } from '../kernel/types.js';

/**
 * Skill Types
 *
 * Enhanced skills system with 3-tier discovery and permission gating.
 */

// ── Skill Permissions ───────────────────────────────────────────────────────

export const SkillPermissionSchema = z.enum([
  'read_files',
  'write_files',
  'execute_bash',
  'network_access', // Always denied for security
  'memory_read',
  'memory_write',
  'session_access',
  'channel_send',
  'tool_execute',
  'governance_vote',
]);
export type SkillPermission = z.infer<typeof SkillPermissionSchema>;

// ── Trust Requirements ──────────────────────────────────────────────────────

export const SkillTrustRequirementSchema = z.enum(['standard', 'verified', 'operator', 'system']);
export type SkillTrustRequirement = z.infer<typeof SkillTrustRequirementSchema>;

// ── Skill Source ────────────────────────────────────────────────────────────

export const SkillSourceSchema = z.enum(['workspace', 'user', 'bundled']);
export type SkillSource = z.infer<typeof SkillSourceSchema>;

// ── Skill Status ────────────────────────────────────────────────────────────

export const SkillStatusSchema = z.enum(['active', 'inactive', 'pending_approval', 'rejected']);
export type SkillStatus = z.infer<typeof SkillStatusSchema>;

// ── Skill Trigger ───────────────────────────────────────────────────────────

export const SkillTriggerSchema = z.object({
  /** Pattern to match (regex or keyword) */
  pattern: z.string(),
  /** Confidence threshold (0-1) */
  confidence: z.number().min(0).max(1).default(0.8),
  /** Whether pattern is regex */
  isRegex: z.boolean().default(false),
  /** Priority for conflict resolution */
  priority: z.number().default(0),
});
export type SkillTrigger = z.infer<typeof SkillTriggerSchema>;

// ── Skill Tool Reference ────────────────────────────────────────────────────

export const SkillToolSchema = z.object({
  /** Tool name */
  name: z.string(),
  /** Whether tool is required */
  required: z.boolean().default(false),
  /** Tool-specific configuration */
  config: z.record(z.unknown()).optional(),
});
export type SkillTool = z.infer<typeof SkillToolSchema>;

// ── Skill Metadata ──────────────────────────────────────────────────────────

export const SkillMetadataSchema = z.object({
  /** Skill name (unique identifier) */
  name: z.string().regex(/^[a-z0-9-]+$/),
  /** Display name */
  displayName: z.string().optional(),
  /** Skill description */
  description: z.string(),
  /** Skill version (semver) */
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  /** Author (user | system) */
  author: z.string().default('user'),
  /** Required permissions */
  permissions: z.array(SkillPermissionSchema).default([]),
  /** Minimum trust level required to execute */
  trustRequired: SkillTrustRequirementSchema.default('standard'),
  /** Tools used by this skill */
  tools: z.array(z.union([z.string(), SkillToolSchema])).default([]),
  /** Triggers for automatic activation */
  triggers: z.array(SkillTriggerSchema).default([]),
  /** Dependencies on other skills */
  dependencies: z.array(z.string()).default([]),
  /** Tags for categorization */
  tags: z.array(z.string()).default([]),
  /** Whether skill is enabled by default */
  enabled: z.boolean().default(true),
});
export type SkillMetadata = z.infer<typeof SkillMetadataSchema>;

// ── Skill Definition ────────────────────────────────────────────────────────

export const SkillDefinitionSchema = z.object({
  /** Skill metadata from SKILL.md frontmatter */
  metadata: SkillMetadataSchema,
  /** Skill content (markdown instructions) */
  content: z.string(),
  /** Source tier (workspace, user, bundled) */
  source: SkillSourceSchema,
  /** File path where skill was loaded from */
  filePath: z.string(),
  /** Current status */
  status: SkillStatusSchema.default('active'),
  /** Loaded timestamp */
  loadedAt: z.string().datetime(),
  /** Hash of skill content for change detection */
  contentHash: z.string(),
});
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

// ── Skill Execution Context ─────────────────────────────────────────────────

export const SkillExecutionContextSchema = z.object({
  /** Session ID (if applicable) */
  sessionId: z.string().uuid().optional(),
  /** Channel ID (if applicable) */
  channelId: z.string().optional(),
  /** User trust level */
  trustLevel: TrustLevelSchema,
  /** Input that triggered the skill */
  input: z.string(),
  /** Matched trigger (if any) */
  trigger: SkillTriggerSchema.optional(),
  /** Additional context */
  context: z.record(z.unknown()).default({}),
});
export type SkillExecutionContext = z.infer<typeof SkillExecutionContextSchema>;

// ── Skill Execution Result ──────────────────────────────────────────────────

export const SkillExecutionResultSchema = z.object({
  /** Skill name */
  skillName: z.string(),
  /** Whether execution was successful */
  success: z.boolean(),
  /** Output content */
  output: z.string().optional(),
  /** Error message (if failed) */
  error: z.string().optional(),
  /** Execution duration in ms */
  duration: z.number(),
  /** Tools executed */
  toolsExecuted: z.array(z.string()).default([]),
  /** Timestamp */
  timestamp: z.string().datetime(),
});
export type SkillExecutionResult = z.infer<typeof SkillExecutionResultSchema>;

// ── Skill Query ─────────────────────────────────────────────────────────────

export const SkillQuerySchema = z.object({
  /** Filter by name pattern */
  name: z.string().optional(),
  /** Filter by source */
  source: SkillSourceSchema.optional(),
  /** Filter by status */
  status: SkillStatusSchema.optional(),
  /** Filter by tag */
  tag: z.string().optional(),
  /** Filter by permission */
  permission: SkillPermissionSchema.optional(),
  /** Filter by trust requirement */
  trustRequired: SkillTrustRequirementSchema.optional(),
  /** Only enabled skills */
  enabledOnly: z.boolean().default(false),
});
export type SkillQuery = z.infer<typeof SkillQuerySchema>;

// ── Skill Discovery Paths ───────────────────────────────────────────────────

export interface SkillDiscoveryPaths {
  /** Workspace-level skills directory */
  workspace: string;
  /** User-level skills directory */
  user: string;
  /** Bundled skills directory */
  bundled: string;
}

// ── Skill Loader Config ─────────────────────────────────────────────────────

export interface SkillLoaderConfig {
  /** Discovery paths */
  paths: SkillDiscoveryPaths;
  /** Watch for changes */
  watchChanges: boolean;
  /** Reload interval (ms) */
  reloadInterval: number;
  /** Blocked permissions (always denied) */
  blockedPermissions: SkillPermission[];
  /** Require governance approval for new skills */
  requireApproval: boolean;
}

export const DEFAULT_SKILL_LOADER_CONFIG: SkillLoaderConfig = {
  paths: {
    workspace: './skills',
    user: '~/.ari/skills',
    bundled: '', // Will be set at runtime
  },
  watchChanges: true,
  reloadInterval: 60000, // 1 minute
  blockedPermissions: ['network_access'], // Always blocked
  requireApproval: false,
};

// ── SKILL.md Frontmatter Parser ─────────────────────────────────────────────

/**
 * Parse SKILL.md frontmatter (YAML between --- markers)
 */
export function parseSkillFrontmatter(content: string): {
  metadata: Record<string, unknown>;
  body: string;
} {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      metadata: {},
      body: content,
    };
  }

  const [, frontmatter, body] = match;

  // Simple YAML parser (handles common cases)
  const metadata: Record<string, unknown> = {};
  let currentArray: unknown[] | null = null;

  for (const line of frontmatter.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Array item
    if (trimmed.startsWith('- ')) {
      if (currentArray) {
        const value = trimmed.slice(2).trim();
        currentArray.push(value.replace(/^['"]|['"]$/g, ''));
      }
      continue;
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();

    // Start of array
    if (!value) {
      currentArray = [];
      metadata[key] = currentArray;
      continue;
    }

    // End previous array
    currentArray = null;

    // Parse value
    if (value === 'true') {
      metadata[key] = true;
    } else if (value === 'false') {
      metadata[key] = false;
    } else if (/^\d+$/.test(value)) {
      metadata[key] = parseInt(value, 10);
    } else if (/^\d+\.\d+$/.test(value)) {
      metadata[key] = parseFloat(value);
    } else {
      metadata[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }

  return { metadata, body };
}

/**
 * Compute content hash for change detection
 */
export function computeSkillHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
