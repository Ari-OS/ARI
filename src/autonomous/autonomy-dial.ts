/**
 * Autonomy Dial — Per-Category Autonomy Levels
 *
 * Controls how much autonomy ARI has for each category of action.
 * Persisted to ~/.ari/autonomy.json so Pryce can tune her freedom.
 *
 * Events: autonomy:level_changed
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { EventBus } from '../kernel/event-bus.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AutonomyLevel = 'monitor' | 'suggest' | 'draft' | 'execute' | 'full';

export interface AutonomyConfig {
  category: string;
  level: AutonomyLevel;
  description: string;
  requiresApproval: boolean;
}

// ─── Ordered levels (for comparison) ────────────────────────────────────────

const LEVEL_ORDER: readonly AutonomyLevel[] = [
  'monitor',
  'suggest',
  'draft',
  'execute',
  'full',
] as const;

// ─── Levels that can proceed without approval ───────────────────────────────

const AUTO_PROCEED_LEVELS: ReadonlySet<AutonomyLevel> = new Set(['execute', 'full']);

// ─── Default Configurations ─────────────────────────────────────────────────

const DEFAULT_CONFIGS: readonly AutonomyConfig[] = [
  {
    category: 'publishing',
    level: 'draft',
    description: 'Prepare content but do not publish without approval',
    requiresApproval: true,
  },
  {
    category: 'financial',
    level: 'suggest',
    description: 'Recommend financial actions but never act on them',
    requiresApproval: true,
  },
  {
    category: 'notifications',
    level: 'execute',
    description: 'Send notifications automatically',
    requiresApproval: false,
  },
  {
    category: 'tasks',
    level: 'execute',
    description: 'Manage tasks automatically',
    requiresApproval: false,
  },
  {
    category: 'research',
    level: 'full',
    description: 'Full autonomy for research operations',
    requiresApproval: false,
  },
  {
    category: 'security',
    level: 'execute',
    description: 'Automatically block threats',
    requiresApproval: false,
  },
  {
    category: 'briefings',
    level: 'full',
    description: 'Generate and send briefings automatically',
    requiresApproval: false,
  },
  {
    category: 'content',
    level: 'draft',
    description: 'Draft content but require approval to publish',
    requiresApproval: true,
  },
] as const;

// ─── Persistence Format ─────────────────────────────────────────────────────

interface PersistedConfig {
  configs: AutonomyConfig[];
  updatedAt: string;
}

const DEFAULT_PATH = join(homedir(), '.ari', 'autonomy.json');

// ─── AutonomyDial Class ─────────────────────────────────────────────────────

export class AutonomyDial {
  private readonly configPath: string;
  private configs: Map<string, AutonomyConfig>;
  private eventBus?: EventBus;

  constructor(configPath?: string, eventBus?: EventBus) {
    this.configPath = configPath ?? DEFAULT_PATH;
    this.configs = new Map();
    this.eventBus = eventBus;
    this.loadFromDisk();
  }

  /**
   * Get autonomy level for a category.
   * Returns 'monitor' for unknown categories (safest default).
   */
  getLevel(category: string): AutonomyLevel {
    return this.configs.get(category)?.level ?? 'monitor';
  }

  /**
   * Set autonomy level for a category.
   * Creates the category config if it does not exist.
   */
  setLevel(category: string, level: AutonomyLevel): void {
    const previous = this.getLevel(category);
    const requiresApproval = !AUTO_PROCEED_LEVELS.has(level);

    const existing = this.configs.get(category);
    const config: AutonomyConfig = {
      category,
      level,
      description: existing?.description ?? `${category} autonomy`,
      requiresApproval,
    };

    this.configs.set(category, config);
    this.saveToDisk();

    this.eventBus?.emit('autonomy:level_changed', {
      category,
      previous,
      current: level,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Check if an action in the given category can proceed without approval.
   * Only 'execute' and 'full' levels can proceed automatically.
   */
  canProceed(category: string): boolean {
    const level = this.getLevel(category);
    return AUTO_PROCEED_LEVELS.has(level);
  }

  /**
   * Get all configured categories and their autonomy settings.
   */
  getAll(): AutonomyConfig[] {
    return [...this.configs.values()];
  }

  /**
   * Reset all categories to default autonomy levels.
   */
  resetDefaults(): void {
    this.configs.clear();
    for (const config of DEFAULT_CONFIGS) {
      this.configs.set(config.category, { ...config });
    }
    this.saveToDisk();
  }

  /**
   * Compare two autonomy levels.
   * Returns negative if a < b, 0 if equal, positive if a > b.
   */
  static compareLevel(a: AutonomyLevel, b: AutonomyLevel): number {
    return LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b);
  }

  // ─── Private Methods ────────────────────────────────────────────────────

  private loadFromDisk(): void {
    if (!existsSync(this.configPath)) {
      this.resetDefaults();
      return;
    }

    try {
      const raw = readFileSync(this.configPath, 'utf-8');
      const data = JSON.parse(raw) as PersistedConfig;

      this.configs.clear();
      for (const config of data.configs) {
        this.configs.set(config.category, config);
      }
    } catch {
      // Corrupted file — reset to defaults
      this.resetDefaults();
    }
  }

  private saveToDisk(): void {
    const dir = dirname(this.configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const data: PersistedConfig = {
      configs: this.getAll(),
      updatedAt: new Date().toISOString(),
    };

    writeFileSync(this.configPath, JSON.stringify(data, null, 2), 'utf-8');
  }
}
