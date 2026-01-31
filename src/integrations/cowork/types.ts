/**
 * Cowork Plugin Types
 *
 * Type definitions for Claude Cowork plugin format.
 * Enables bidirectional compatibility between ARI and Cowork ecosystem.
 *
 * Reference: https://claude.com/plugins-for/cowork
 */

import { z } from 'zod';
import { SkillPermissionSchema, SkillTrustRequirementSchema } from '../../skills/types.js';

// ── Cowork Plugin Components ─────────────────────────────────────────────────

/**
 * Cowork Skill Definition
 * Maps to ARI's skill system
 */
export const CoworkSkillSchema = z.object({
  /** Unique skill identifier */
  id: z.string(),
  /** Display name */
  name: z.string(),
  /** Skill description */
  description: z.string(),
  /** Skill instructions (markdown) */
  instructions: z.string(),
  /** Triggers/patterns that activate this skill */
  triggers: z.array(z.object({
    pattern: z.string(),
    type: z.enum(['keyword', 'regex', 'intent']).default('keyword'),
    priority: z.number().default(0),
  })).default([]),
  /** Required capabilities */
  capabilities: z.array(z.string()).default([]),
});
export type CoworkSkill = z.infer<typeof CoworkSkillSchema>;

/**
 * Cowork Connector Definition
 * Maps to ARI's channel/integration system
 */
export const CoworkConnectorSchema = z.object({
  /** Connector identifier */
  id: z.string(),
  /** Connector name */
  name: z.string(),
  /** Service type */
  type: z.enum(['api', 'oauth', 'webhook', 'database', 'file']),
  /** Connection configuration */
  config: z.object({
    /** Base URL for API connectors */
    baseUrl: z.string().optional(),
    /** Authentication method */
    auth: z.enum(['none', 'api_key', 'oauth2', 'bearer']).optional(),
    /** Webhook URL for webhook connectors */
    webhookUrl: z.string().optional(),
    /** Additional settings */
    settings: z.record(z.unknown()).default({}),
  }),
  /** Available operations */
  operations: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional(),
    endpoint: z.string().optional(),
    parameters: z.record(z.object({
      type: z.string(),
      required: z.boolean(),
      description: z.string(),
    })).default({}),
  })).default([]),
});
export type CoworkConnector = z.infer<typeof CoworkConnectorSchema>;

/**
 * Cowork Slash Command Definition
 * Maps to ARI's skill triggers
 */
export const CoworkSlashCommandSchema = z.object({
  /** Command name (without /) */
  command: z.string().regex(/^[a-z0-9-]+$/),
  /** Command description */
  description: z.string(),
  /** Arguments specification */
  arguments: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'choice']),
    required: z.boolean().default(false),
    description: z.string(),
    choices: z.array(z.string()).optional(),
  })).default([]),
  /** Linked skill ID */
  skillId: z.string().optional(),
  /** Direct handler instructions */
  handler: z.string().optional(),
});
export type CoworkSlashCommand = z.infer<typeof CoworkSlashCommandSchema>;

/**
 * Cowork Sub-Agent Definition
 * Maps to ARI's agent system
 */
export const CoworkSubAgentSchema = z.object({
  /** Agent identifier */
  id: z.string(),
  /** Agent name */
  name: z.string(),
  /** Agent role/purpose */
  role: z.string(),
  /** System prompt */
  systemPrompt: z.string(),
  /** Personality traits */
  personality: z.object({
    tone: z.enum(['professional', 'casual', 'technical', 'friendly']).default('professional'),
    verbosity: z.enum(['concise', 'balanced', 'detailed']).default('balanced'),
    style: z.string().optional(),
  }).default({}),
  /** Skills this agent can use */
  skills: z.array(z.string()).default([]),
  /** Connectors this agent can access */
  connectors: z.array(z.string()).default([]),
  /** Delegation rules */
  delegation: z.object({
    canDelegate: z.boolean().default(false),
    delegateTo: z.array(z.string()).default([]),
  }).default({}),
});
export type CoworkSubAgent = z.infer<typeof CoworkSubAgentSchema>;

// ── Cowork Plugin Manifest ───────────────────────────────────────────────────

/**
 * Complete Cowork Plugin Definition
 */
export const CoworkPluginSchema = z.object({
  /** Plugin manifest version */
  manifestVersion: z.literal('1.0'),
  /** Plugin metadata */
  metadata: z.object({
    /** Unique plugin identifier */
    id: z.string().regex(/^[a-z0-9-]+$/),
    /** Display name */
    name: z.string(),
    /** Plugin description */
    description: z.string(),
    /** Semantic version */
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    /** Author information */
    author: z.object({
      name: z.string(),
      email: z.string().email().optional(),
      url: z.string().url().optional(),
    }),
    /** Plugin homepage */
    homepage: z.string().url().optional(),
    /** Plugin repository */
    repository: z.string().url().optional(),
    /** License */
    license: z.string().default('MIT'),
    /** Tags for discovery */
    tags: z.array(z.string()).default([]),
    /** Target domains */
    domains: z.array(z.string()).default([]),
  }),
  /** Plugin components */
  components: z.object({
    /** Skills bundled in this plugin */
    skills: z.array(CoworkSkillSchema).default([]),
    /** Connectors bundled in this plugin */
    connectors: z.array(CoworkConnectorSchema).default([]),
    /** Slash commands bundled in this plugin */
    commands: z.array(CoworkSlashCommandSchema).default([]),
    /** Sub-agents bundled in this plugin */
    agents: z.array(CoworkSubAgentSchema).default([]),
  }),
  /** Plugin configuration */
  config: z.object({
    /** Required environment variables */
    requiredEnv: z.array(z.string()).default([]),
    /** Optional settings */
    settings: z.record(z.object({
      type: z.enum(['string', 'number', 'boolean', 'secret']),
      description: z.string(),
      default: z.unknown().optional(),
      required: z.boolean().default(false),
    })).default({}),
  }).default({}),
  /** Security requirements */
  security: z.object({
    /** Minimum trust level required */
    minTrustLevel: SkillTrustRequirementSchema.default('standard'),
    /** Required permissions */
    permissions: z.array(SkillPermissionSchema).default([]),
    /** Network access required */
    requiresNetwork: z.boolean().default(false),
    /** Sandbox requirements */
    sandboxed: z.boolean().default(true),
  }).default({}),
});
export type CoworkPlugin = z.infer<typeof CoworkPluginSchema>;

// ── ARI ↔ Cowork Mapping ─────────────────────────────────────────────────────

/**
 * Mapping between ARI permissions and Cowork capabilities
 */
export const ARI_TO_COWORK_PERMISSION_MAP: Record<string, string> = {
  read_files: 'file:read',
  write_files: 'file:write',
  execute_bash: 'system:execute',
  memory_read: 'memory:read',
  memory_write: 'memory:write',
  session_access: 'session:access',
  channel_send: 'messaging:send',
  tool_execute: 'tools:execute',
  governance_vote: 'governance:participate',
};

export const COWORK_TO_ARI_PERMISSION_MAP: Record<string, string> = {
  'file:read': 'read_files',
  'file:write': 'write_files',
  'system:execute': 'execute_bash',
  'memory:read': 'memory_read',
  'memory:write': 'memory_write',
  'session:access': 'session_access',
  'messaging:send': 'channel_send',
  'tools:execute': 'tool_execute',
  'governance:participate': 'governance_vote',
};

/**
 * Import result from loading a Cowork plugin
 */
export const PluginImportResultSchema = z.object({
  success: z.boolean(),
  pluginId: z.string(),
  imported: z.object({
    skills: z.number(),
    connectors: z.number(),
    commands: z.number(),
    agents: z.number(),
  }),
  warnings: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
  timestamp: z.string().datetime(),
});
export type PluginImportResult = z.infer<typeof PluginImportResultSchema>;

/**
 * Export result from generating a Cowork plugin
 */
export const PluginExportResultSchema = z.object({
  success: z.boolean(),
  plugin: CoworkPluginSchema.optional(),
  outputPath: z.string().optional(),
  errors: z.array(z.string()).default([]),
  timestamp: z.string().datetime(),
});
export type PluginExportResult = z.infer<typeof PluginExportResultSchema>;
