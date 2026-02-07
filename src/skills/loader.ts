import { promises as fs } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import {
  type SkillDefinition,
  type SkillSource,
  type SkillLoaderConfig,
  type SkillDiscoveryPaths,
  DEFAULT_SKILL_LOADER_CONFIG,
  parseSkillFrontmatter,
  computeSkillHash,
} from './types.js';
import { SkillValidator } from './validator.js';
import { createLogger } from '../kernel/logger.js';

const logger = createLogger('skill-loader');

/**
 * SkillLoader
 *
 * Loads skills from the 3-tier discovery hierarchy:
 * 1. Workspace (./skills) - Highest priority
 * 2. User (~/.ari/skills) - Personal skills
 * 3. Bundled (built-in) - Default skills
 *
 * Higher tier skills override lower tier skills with the same name.
 */
export class SkillLoader {
  private config: SkillLoaderConfig;
  private validator: SkillValidator;
  private skills: Map<string, SkillDefinition> = new Map();
  private loadedPaths: Set<string> = new Set();

  constructor(config?: Partial<SkillLoaderConfig>) {
    this.config = { ...DEFAULT_SKILL_LOADER_CONFIG, ...config };
    this.validator = new SkillValidator(this.config.blockedPermissions);

    // Resolve paths
    this.config.paths = this.resolvePaths(this.config.paths);
  }

  /**
   * Resolve paths (expand ~ and make absolute)
   */
  private resolvePaths(paths: SkillDiscoveryPaths): SkillDiscoveryPaths {
    const home = homedir();

    return {
      workspace: resolve(process.cwd(), paths.workspace),
      user: paths.user.startsWith('~')
        ? join(home, paths.user.slice(1))
        : resolve(paths.user),
      bundled: paths.bundled
        ? resolve(paths.bundled)
        : join(dirname(new URL(import.meta.url).pathname), '..', '..', 'skills'),
    };
  }

  /**
   * Load all skills from the discovery hierarchy
   */
  async loadAll(): Promise<Map<string, SkillDefinition>> {
    this.skills.clear();
    this.loadedPaths.clear();

    // Load in order: bundled -> user -> workspace (later overrides earlier)
    await this.loadFromDirectory(this.config.paths.bundled, 'bundled');
    await this.loadFromDirectory(this.config.paths.user, 'user');
    await this.loadFromDirectory(this.config.paths.workspace, 'workspace');

    return this.skills;
  }

  /**
   * Load skills from a directory
   */
  async loadFromDirectory(dirPath: string, source: SkillSource): Promise<number> {
    let loaded = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Skill in subdirectory (look for SKILL.md)
          const skillPath = join(dirPath, entry.name, 'SKILL.md');
          const skill = await this.loadSkillFile(skillPath, source);
          if (skill) {
            this.skills.set(skill.metadata.name, skill);
            this.loadedPaths.add(skillPath);
            loaded++;
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          // Skill as single .md file
          const skillPath = join(dirPath, entry.name);
          const skill = await this.loadSkillFile(skillPath, source);
          if (skill) {
            this.skills.set(skill.metadata.name, skill);
            this.loadedPaths.add(skillPath);
            loaded++;
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist - not an error
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn({ err: error, dirPath }, 'Failed to load skills');
      }
    }

    return loaded;
  }

  /**
   * Load a single skill file
   */
  async loadSkillFile(filePath: string, source: SkillSource): Promise<SkillDefinition | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Validate the skill
      const validation = this.validator.validateContent(content);
      if (!validation.valid || !validation.metadata) {
        logger.warn({ filePath, errors: validation.errors }, 'Invalid skill');
        return null;
      }

      // Parse content
      const { body } = parseSkillFrontmatter(content);

      return {
        metadata: validation.metadata,
        content: body,
        source,
        filePath,
        status: this.config.requireApproval && source !== 'bundled' ? 'pending_approval' : 'active',
        loadedAt: new Date().toISOString(),
        contentHash: computeSkillHash(content),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn({ err: error, filePath }, 'Failed to load skill');
      }
      return null;
    }
  }

  /**
   * Load a skill by name (checks all tiers in order)
   */
  async loadByName(name: string): Promise<SkillDefinition | null> {
    // Check workspace first
    let skill = await this.findSkillInDir(name, this.config.paths.workspace, 'workspace');
    if (skill) return skill;

    // Then user
    skill = await this.findSkillInDir(name, this.config.paths.user, 'user');
    if (skill) return skill;

    // Finally bundled
    skill = await this.findSkillInDir(name, this.config.paths.bundled, 'bundled');
    return skill;
  }

  /**
   * Find a skill in a specific directory
   */
  private async findSkillInDir(
    name: string,
    dirPath: string,
    source: SkillSource
  ): Promise<SkillDefinition | null> {
    // Try subdirectory first
    const subDirPath = join(dirPath, name, 'SKILL.md');
    let skill = await this.loadSkillFile(subDirPath, source);
    if (skill?.metadata.name === name) return skill;

    // Try single file
    const filePath = join(dirPath, `${name}.md`);
    skill = await this.loadSkillFile(filePath, source);
    if (skill?.metadata.name === name) return skill;

    return null;
  }

  /**
   * Reload a specific skill
   */
  async reload(name: string): Promise<SkillDefinition | null> {
    const skill = await this.loadByName(name);
    if (skill) {
      this.skills.set(name, skill);
    } else {
      this.skills.delete(name);
    }
    return skill;
  }

  /**
   * Reload all skills
   */
  async reloadAll(): Promise<Map<string, SkillDefinition>> {
    return this.loadAll();
  }

  /**
   * Get a loaded skill
   */
  get(name: string): SkillDefinition | null {
    return this.skills.get(name) || null;
  }

  /**
   * Get all loaded skills
   */
  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills by source
   */
  getBySource(source: SkillSource): SkillDefinition[] {
    return this.getAll().filter(s => s.source === source);
  }

  /**
   * Get loaded skill count
   */
  get count(): number {
    return this.skills.size;
  }

  /**
   * Get count by source
   */
  countBySource(): Record<SkillSource, number> {
    const counts: Record<SkillSource, number> = {
      workspace: 0,
      user: 0,
      bundled: 0,
    };

    for (const skill of this.skills.values()) {
      counts[skill.source]++;
    }

    return counts;
  }

  /**
   * Check if a skill is loaded
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * Get the validator
   */
  getValidator(): SkillValidator {
    return this.validator;
  }

  /**
   * Get current configuration
   */
  getConfig(): SkillLoaderConfig {
    return { ...this.config };
  }

  /**
   * Get discovery paths
   */
  getPaths(): SkillDiscoveryPaths {
    return { ...this.config.paths };
  }
}
