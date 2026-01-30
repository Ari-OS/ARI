import type { EventBus } from '../kernel/event-bus.js';
import type { AuditLogger } from '../kernel/audit.js';
import {
  type SkillDefinition,
  type SkillQuery,
  type SkillStatus,
  type SkillSource,
  type SkillTrigger,
} from './types.js';
import { SkillLoader } from './loader.js';

/**
 * Skill Match Result
 */
export interface SkillMatch {
  skill: SkillDefinition;
  trigger: SkillTrigger;
  confidence: number;
}

/**
 * SkillRegistry
 *
 * Central registry for skill discovery, matching, and lifecycle management.
 * Integrates with the loader and provides query capabilities.
 */
export class SkillRegistry {
  private loader: SkillLoader;
  private eventBus: EventBus;
  private audit: AuditLogger;
  private initialized: boolean = false;

  constructor(loader: SkillLoader, eventBus: EventBus, audit: AuditLogger) {
    this.loader = loader;
    this.eventBus = eventBus;
    this.audit = audit;
  }

  /**
   * Initialize the registry (load all skills)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.loader.loadAll();

    await this.audit.log('skill_registry_initialized', 'system', 'system', {
      skillCount: this.loader.count,
      bySource: this.loader.countBySource(),
    });

    this.initialized = true;
  }

  /**
   * Get a skill by name
   */
  get(name: string): SkillDefinition | null {
    return this.loader.get(name);
  }

  /**
   * Check if a skill exists
   */
  has(name: string): boolean {
    return this.loader.has(name);
  }

  /**
   * Get all skills
   */
  getAll(): SkillDefinition[] {
    return this.loader.getAll();
  }

  /**
   * Query skills with filters
   */
  query(query: SkillQuery): SkillDefinition[] {
    let results = this.getAll();

    // Filter by name pattern
    if (query.name) {
      const pattern = query.name.toLowerCase();
      results = results.filter(s =>
        s.metadata.name.toLowerCase().includes(pattern) ||
        s.metadata.displayName?.toLowerCase().includes(pattern)
      );
    }

    // Filter by source
    if (query.source) {
      results = results.filter(s => s.source === query.source);
    }

    // Filter by status
    if (query.status) {
      results = results.filter(s => s.status === query.status);
    }

    // Filter by tag
    if (query.tag) {
      results = results.filter(s => s.metadata.tags.includes(query.tag!));
    }

    // Filter by permission
    if (query.permission) {
      results = results.filter(s => s.metadata.permissions.includes(query.permission!));
    }

    // Filter by trust requirement
    if (query.trustRequired) {
      results = results.filter(s => s.metadata.trustRequired === query.trustRequired);
    }

    // Filter enabled only
    if (query.enabledOnly) {
      results = results.filter(s => s.metadata.enabled && s.status === 'active');
    }

    return results;
  }

  /**
   * Find skills matching an input
   */
  findMatches(input: string): SkillMatch[] {
    const matches: SkillMatch[] = [];
    const inputLower = input.toLowerCase();

    for (const skill of this.getAll()) {
      // Skip disabled or non-active skills
      if (!skill.metadata.enabled || skill.status !== 'active') continue;

      for (const trigger of skill.metadata.triggers) {
        const match = this.matchTrigger(inputLower, trigger);
        if (match !== null) {
          matches.push({
            skill,
            trigger,
            confidence: match,
          });
        }
      }
    }

    // Sort by confidence (highest first), then by priority
    matches.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return b.trigger.priority - a.trigger.priority;
    });

    return matches;
  }

  /**
   * Match a trigger against input
   */
  private matchTrigger(input: string, trigger: SkillTrigger): number | null {
    if (trigger.isRegex) {
      try {
        const regex = new RegExp(trigger.pattern, 'i');
        const match = input.match(regex);
        if (match) {
          // Confidence based on match coverage
          const coverage = match[0].length / input.length;
          const confidence = Math.min(coverage * 1.2, 1.0); // Boost for regex matches
          return confidence >= trigger.confidence ? confidence : null;
        }
      } catch {
        // Invalid regex
        return null;
      }
    } else {
      // Keyword matching
      const patternLower = trigger.pattern.toLowerCase();

      // Exact match
      if (input === patternLower) {
        return 1.0;
      }

      // Contains match
      if (input.includes(patternLower)) {
        const coverage = patternLower.length / input.length;
        return coverage >= trigger.confidence ? coverage : null;
      }

      // Word boundary match
      const words = input.split(/\s+/);
      const patternWords = patternLower.split(/\s+/);
      const matchedWords = patternWords.filter(pw => words.includes(pw));
      if (matchedWords.length === patternWords.length) {
        const confidence = patternWords.length / words.length;
        return confidence >= trigger.confidence ? confidence : null;
      }
    }

    return null;
  }

  /**
   * Find the best matching skill for an input
   */
  findBestMatch(input: string): SkillMatch | null {
    const matches = this.findMatches(input);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Update skill status
   */
  async updateStatus(name: string, status: SkillStatus): Promise<boolean> {
    const skill = this.get(name);
    if (!skill) return false;

    skill.status = status;

    await this.audit.log('skill_status_updated', 'system', 'system', {
      skillName: name,
      status,
    });

    return true;
  }

  /**
   * Enable a skill
   */
  async enable(name: string): Promise<boolean> {
    const skill = this.get(name);
    if (!skill) return false;

    skill.metadata.enabled = true;
    skill.status = 'active';

    await this.audit.log('skill_enabled', 'system', 'system', {
      skillName: name,
    });

    return true;
  }

  /**
   * Disable a skill
   */
  async disable(name: string): Promise<boolean> {
    const skill = this.get(name);
    if (!skill) return false;

    skill.metadata.enabled = false;
    skill.status = 'inactive';

    await this.audit.log('skill_disabled', 'system', 'system', {
      skillName: name,
    });

    return true;
  }

  /**
   * Reload skills
   */
  async reload(): Promise<void> {
    await this.loader.reloadAll();

    await this.audit.log('skill_registry_reloaded', 'system', 'system', {
      skillCount: this.loader.count,
      bySource: this.loader.countBySource(),
    });
  }

  /**
   * Reload a specific skill
   */
  async reloadSkill(name: string): Promise<SkillDefinition | null> {
    const skill = await this.loader.reload(name);

    await this.audit.log('skill_reloaded', 'system', 'system', {
      skillName: name,
      found: skill !== null,
    });

    return skill;
  }

  /**
   * Get skill statistics
   */
  getStats(): {
    total: number;
    bySource: Record<SkillSource, number>;
    byStatus: Record<SkillStatus, number>;
    enabled: number;
    disabled: number;
  } {
    const skills = this.getAll();
    const byStatus: Record<SkillStatus, number> = {
      active: 0,
      inactive: 0,
      pending_approval: 0,
      rejected: 0,
    };

    let enabled = 0;
    let disabled = 0;

    for (const skill of skills) {
      byStatus[skill.status]++;
      if (skill.metadata.enabled) enabled++;
      else disabled++;
    }

    return {
      total: skills.length,
      bySource: this.loader.countBySource(),
      byStatus,
      enabled,
      disabled,
    };
  }

  /**
   * Get skill names by tag
   */
  getByTag(tag: string): string[] {
    return this.query({ tag, enabledOnly: false })
      .map(s => s.metadata.name);
  }

  /**
   * List all tags
   */
  getAllTags(): string[] {
    const tags = new Set<string>();
    for (const skill of this.getAll()) {
      for (const tag of skill.metadata.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  }

  /**
   * Check if registry is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the loader
   */
  getLoader(): SkillLoader {
    return this.loader;
  }
}
