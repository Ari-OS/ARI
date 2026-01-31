/**
 * Cowork Plugin Bridge
 *
 * Bidirectional adapter between ARI and Claude Cowork plugin ecosystem.
 * - Import: Load Cowork plugins into ARI's skill/tool system
 * - Export: Package ARI capabilities as distributable Cowork plugins
 *
 * Reference: https://claude.com/blog/cowork-plugins
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import {
  CoworkPlugin,
  CoworkPluginSchema,
  CoworkSkill,
  CoworkSlashCommand,
  CoworkSubAgent,
  PluginImportResult,
  PluginExportResult,
  ARI_TO_COWORK_PERMISSION_MAP,
  COWORK_TO_ARI_PERMISSION_MAP,
} from './types.js';
import {
  SkillDefinition,
  SkillMetadata,
  SkillPermission,
  SkillTrustRequirement,
  computeSkillHash,
} from '../../skills/types.js';
import { AgentId } from '../../kernel/types.js';

// ── Bridge Configuration ─────────────────────────────────────────────────────

export interface CoworkBridgeConfig {
  /** Directory for imported plugins */
  importDir: string;
  /** Directory for exported plugins */
  exportDir: string;
  /** Auto-load imported plugins */
  autoLoad: boolean;
  /** Require governance approval for imports */
  requireApproval: boolean;
  /** Default trust level for imported plugins */
  defaultTrustLevel: SkillTrustRequirement;
}

const DEFAULT_CONFIG: CoworkBridgeConfig = {
  importDir: '~/.ari/plugins/imported',
  exportDir: '~/.ari/plugins/exported',
  autoLoad: false,
  requireApproval: true,
  defaultTrustLevel: 'standard',
};

// ── Cowork Bridge ────────────────────────────────────────────────────────────

export class CoworkBridge extends EventEmitter {
  private config: CoworkBridgeConfig;
  private loadedPlugins: Map<string, CoworkPlugin> = new Map();

  constructor(config: Partial<CoworkBridgeConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Import Operations ────────────────────────────────────────────────────

  /**
   * Import a Cowork plugin from file or URL
   */
  async importPlugin(source: string): Promise<PluginImportResult> {
    const timestamp = new Date().toISOString();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Load plugin manifest
      const manifest = await this.loadPluginManifest(source);

      // Validate against schema
      const parsed = CoworkPluginSchema.safeParse(manifest);
      if (!parsed.success) {
        return {
          success: false,
          pluginId: (manifest as { metadata?: { id?: string } })?.metadata?.id || 'unknown',
          imported: { skills: 0, connectors: 0, commands: 0, agents: 0 },
          errors: [`Invalid plugin manifest: ${parsed.error.message}`],
          warnings: [],
          timestamp,
        };
      }

      const plugin = parsed.data;

      // Security validation
      const securityIssues = this.validatePluginSecurity(plugin);
      if (securityIssues.length > 0) {
        warnings.push(...securityIssues);
      }

      // Check for network access (blocked by default)
      if (plugin.security.requiresNetwork) {
        errors.push('Plugin requires network access which is blocked by ARI security policy');
        return {
          success: false,
          pluginId: plugin.metadata.id,
          imported: { skills: 0, connectors: 0, commands: 0, agents: 0 },
          errors: [...errors],
          warnings: [...warnings],
          timestamp,
        };
      }

      // Convert components to ARI format
      const skills = this.convertSkillsToARI(plugin.components.skills, plugin);
      const commands = this.convertCommandsToTriggers(plugin.components.commands);

      // Store plugin
      this.loadedPlugins.set(plugin.metadata.id, plugin);

      // Emit import event
      this.emit('plugin:imported', {
        pluginId: plugin.metadata.id,
        skills: skills.length,
        commands: commands.length,
      });

      return {
        success: true,
        pluginId: plugin.metadata.id,
        imported: {
          skills: plugin.components.skills.length,
          connectors: plugin.components.connectors.length,
          commands: plugin.components.commands.length,
          agents: plugin.components.agents.length,
        },
        warnings,
        errors,
        timestamp,
      };
    } catch (error) {
      return {
        success: false,
        pluginId: 'unknown',
        imported: { skills: 0, connectors: 0, commands: 0, agents: 0 },
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        timestamp,
      };
    }
  }

  /**
   * Load plugin manifest from file path
   */
  private async loadPluginManifest(source: string): Promise<unknown> {
    const resolvedPath = source.startsWith('~')
      ? source.replace('~', process.env.HOME || '')
      : source;

    const content = await fs.readFile(resolvedPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Validate plugin security requirements
   */
  private validatePluginSecurity(plugin: CoworkPlugin): string[] {
    const warnings: string[] = [];

    // Check for dangerous permissions
    const dangerousPerms = plugin.security.permissions.filter(
      p => ['execute_bash', 'governance_vote'].includes(p)
    );
    if (dangerousPerms.length > 0) {
      warnings.push(`Plugin requests sensitive permissions: ${dangerousPerms.join(', ')}`);
    }

    // Check trust level
    if (plugin.security.minTrustLevel === 'system' || plugin.security.minTrustLevel === 'operator') {
      warnings.push(`Plugin requests elevated trust level: ${plugin.security.minTrustLevel}`);
    }

    // Check for unsandboxed execution
    if (!plugin.security.sandboxed) {
      warnings.push('Plugin requests unsandboxed execution');
    }

    return warnings;
  }

  /**
   * Convert Cowork skills to ARI skill definitions
   */
  private convertSkillsToARI(
    skills: CoworkSkill[],
    plugin: CoworkPlugin
  ): SkillDefinition[] {
    return skills.map(skill => {
      const metadata: SkillMetadata = {
        name: `cowork-${plugin.metadata.id}-${skill.id}`,
        displayName: skill.name,
        description: skill.description,
        version: plugin.metadata.version,
        author: plugin.metadata.author.name,
        permissions: this.convertCoworkPermissions(skill.capabilities),
        trustRequired: plugin.security.minTrustLevel,
        tools: [],
        triggers: skill.triggers.map(t => ({
          pattern: t.pattern,
          confidence: 0.8,
          isRegex: t.type === 'regex',
          priority: t.priority,
        })),
        dependencies: [],
        tags: [...plugin.metadata.tags, 'cowork-import'],
        enabled: true,
      };

      const content = skill.instructions;
      const now = new Date().toISOString();

      return {
        metadata,
        content,
        source: 'user' as const,
        filePath: `~/.ari/plugins/imported/${plugin.metadata.id}/${skill.id}.md`,
        status: this.config.requireApproval ? 'pending_approval' as const : 'active' as const,
        loadedAt: now,
        contentHash: computeSkillHash(content),
      };
    });
  }

  /**
   * Convert Cowork capabilities to ARI permissions
   */
  private convertCoworkPermissions(capabilities: string[]): SkillPermission[] {
    const permissions: SkillPermission[] = [];
    for (const cap of capabilities) {
      const ariPerm = COWORK_TO_ARI_PERMISSION_MAP[cap];
      if (ariPerm) {
        permissions.push(ariPerm as SkillPermission);
      }
    }
    return permissions;
  }

  /**
   * Convert slash commands to skill triggers
   */
  private convertCommandsToTriggers(commands: CoworkSlashCommand[]) {
    return commands.map(cmd => ({
      pattern: `/${cmd.command}`,
      confidence: 1.0,
      isRegex: false,
      priority: 100, // Slash commands have high priority
    }));
  }

  // ── Export Operations ────────────────────────────────────────────────────

  /**
   * Export ARI capabilities as a Cowork plugin
   */
  async exportPlugin(options: {
    id: string;
    name: string;
    description: string;
    skills?: SkillDefinition[];
    agents?: AgentId[];
    includeTools?: boolean;
    outputPath?: string;
  }): Promise<PluginExportResult> {
    const timestamp = new Date().toISOString();
    const errors: string[] = [];

    try {
      // Build plugin manifest
      const plugin: CoworkPlugin = {
        manifestVersion: '1.0',
        metadata: {
          id: options.id,
          name: options.name,
          description: options.description,
          version: '1.0.0',
          author: {
            name: 'ARI',
            url: 'https://github.com/PryceHedrick/ARI',
          },
          license: 'MIT',
          tags: ['ari', 'ai-agent', 'automation'],
          domains: ['productivity', 'development'],
        },
        components: {
          skills: this.convertARISkillsToCowork(options.skills || []),
          connectors: [],
          commands: this.generateSlashCommands(options.skills || []),
          agents: this.convertARIAgentsToCowork(options.agents || []),
        },
        config: {
          requiredEnv: [],
          settings: {},
        },
        security: {
          minTrustLevel: 'standard',
          permissions: [],
          requiresNetwork: false,
          sandboxed: true,
        },
      };

      // Write to file if path provided
      if (options.outputPath) {
        const resolvedPath = options.outputPath.startsWith('~')
          ? options.outputPath.replace('~', process.env.HOME || '')
          : options.outputPath;

        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, JSON.stringify(plugin, null, 2));
      }

      this.emit('plugin:exported', {
        pluginId: plugin.metadata.id,
        outputPath: options.outputPath,
      });

      return {
        success: true,
        plugin,
        outputPath: options.outputPath,
        errors,
        timestamp,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
        timestamp,
      };
    }
  }

  /**
   * Convert ARI skills to Cowork format
   */
  private convertARISkillsToCowork(skills: SkillDefinition[]): CoworkSkill[] {
    return skills.map(skill => ({
      id: skill.metadata.name,
      name: skill.metadata.displayName || skill.metadata.name,
      description: skill.metadata.description,
      instructions: skill.content,
      triggers: skill.metadata.triggers.map(t => ({
        pattern: t.pattern,
        type: t.isRegex ? 'regex' as const : 'keyword' as const,
        priority: t.priority,
      })),
      capabilities: this.convertARIPermissions(skill.metadata.permissions),
    }));
  }

  /**
   * Convert ARI permissions to Cowork capabilities
   */
  private convertARIPermissions(permissions: SkillPermission[]): string[] {
    return permissions
      .map(p => ARI_TO_COWORK_PERMISSION_MAP[p])
      .filter(Boolean);
  }

  /**
   * Generate slash commands from skills
   */
  private generateSlashCommands(skills: SkillDefinition[]): CoworkSlashCommand[] {
    return skills
      .filter(s => s.metadata.triggers.some(t => t.pattern.startsWith('/')))
      .map(skill => {
        const trigger = skill.metadata.triggers.find(t => t.pattern.startsWith('/'));
        const command = trigger?.pattern.slice(1) || skill.metadata.name;
        return {
          command,
          description: skill.metadata.description,
          arguments: [],
          skillId: skill.metadata.name,
        };
      });
  }

  /**
   * Convert ARI agents to Cowork sub-agents
   */
  private convertARIAgentsToCowork(agentIds: AgentId[]): CoworkSubAgent[] {
    const agentConfigs: Record<AgentId, Partial<CoworkSubAgent>> = {
      core: {
        role: 'Master orchestrator coordinating all operations',
        personality: { tone: 'professional', verbosity: 'balanced' },
      },
      guardian: {
        role: 'Security specialist detecting threats and risks',
        personality: { tone: 'technical', verbosity: 'concise' },
      },
      planner: {
        role: 'Strategic planner decomposing tasks into execution plans',
        personality: { tone: 'professional', verbosity: 'detailed' },
      },
      executor: {
        role: 'Task executor running tools with permission gating',
        personality: { tone: 'technical', verbosity: 'concise' },
      },
      memory_manager: {
        role: 'Knowledge curator managing provenance-tracked memory',
        personality: { tone: 'professional', verbosity: 'balanced' },
      },
      router: {
        role: 'Message router directing events to appropriate handlers',
        personality: { tone: 'technical', verbosity: 'concise' },
      },
      arbiter: {
        role: 'Constitutional enforcer validating against core rules',
        personality: { tone: 'professional', verbosity: 'detailed' },
      },
      overseer: {
        role: 'Quality gatekeeper ensuring standards compliance',
        personality: { tone: 'professional', verbosity: 'balanced' },
      },
      autonomous: {
        role: 'Autonomous agent for scheduled background tasks',
        personality: { tone: 'professional', verbosity: 'concise' },
      },
      research: {
        role: 'Research specialist for deep investigation',
        personality: { tone: 'technical', verbosity: 'detailed' },
      },
      marketing: {
        role: 'Marketing strategist for campaigns and content',
        personality: { tone: 'casual', verbosity: 'balanced' },
      },
      sales: {
        role: 'Sales specialist for pipeline and outreach',
        personality: { tone: 'friendly', verbosity: 'balanced' },
      },
      content: {
        role: 'Content creator for blogs and documentation',
        personality: { tone: 'casual', verbosity: 'detailed' },
      },
      seo: {
        role: 'SEO specialist for search optimization',
        personality: { tone: 'technical', verbosity: 'balanced' },
      },
      build: {
        role: 'Build engineer for CI/CD and deployment',
        personality: { tone: 'technical', verbosity: 'concise' },
      },
      development: {
        role: 'Software developer for code implementation',
        personality: { tone: 'technical', verbosity: 'balanced' },
      },
      client_comms: {
        role: 'Client communications manager',
        personality: { tone: 'professional', verbosity: 'balanced' },
      },
    };

    return agentIds.map(id => ({
      id: `ari-${id}`,
      name: id.charAt(0).toUpperCase() + id.slice(1).replace('_', ' '),
      role: agentConfigs[id]?.role || `ARI ${id} agent`,
      systemPrompt: `You are the ${id} agent from ARI (Artificial Reasoning Intelligence). ${agentConfigs[id]?.role || ''}`,
      personality: agentConfigs[id]?.personality || { tone: 'professional', verbosity: 'balanced' },
      skills: [],
      connectors: [],
      delegation: { canDelegate: false, delegateTo: [] },
    }));
  }

  // ── Plugin Management ────────────────────────────────────────────────────

  /**
   * List all loaded plugins
   */
  listPlugins(): CoworkPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Get a specific plugin by ID
   */
  getPlugin(id: string): CoworkPlugin | undefined {
    return this.loadedPlugins.get(id);
  }

  /**
   * Unload a plugin
   */
  unloadPlugin(id: string): boolean {
    const removed = this.loadedPlugins.delete(id);
    if (removed) {
      this.emit('plugin:unloaded', { pluginId: id });
    }
    return removed;
  }

  /**
   * Get plugin statistics
   */
  getStats() {
    const plugins = this.listPlugins();
    return {
      totalPlugins: plugins.length,
      totalSkills: plugins.reduce((sum, p) => sum + p.components.skills.length, 0),
      totalConnectors: plugins.reduce((sum, p) => sum + p.components.connectors.length, 0),
      totalCommands: plugins.reduce((sum, p) => sum + p.components.commands.length, 0),
      totalAgents: plugins.reduce((sum, p) => sum + p.components.agents.length, 0),
    };
  }
}

// ── Singleton Instance ───────────────────────────────────────────────────────

let bridgeInstance: CoworkBridge | null = null;

export function getCoworkBridge(config?: Partial<CoworkBridgeConfig>): CoworkBridge {
  if (!bridgeInstance) {
    bridgeInstance = new CoworkBridge(config);
  }
  return bridgeInstance;
}
