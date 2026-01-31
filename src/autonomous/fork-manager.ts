/**
 * ARI Fork Manager
 *
 * Manages conversation context serialization and restoration
 * for spawned agents. Enables agents to:
 * - Serialize their current context to a file
 * - Restore context when resuming work
 * - Merge results from parallel agents
 *
 * Works alongside AgentSpawner for complete agent lifecycle.
 */

import { EventBus } from '../kernel/event-bus.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const CONTEXTS_PATH = path.join(
  process.env.HOME || '~',
  '.ari',
  'contexts'
);

export interface SerializedContext {
  id: string;
  createdAt: Date;
  task: string;
  taskType: 'feature' | 'bugfix' | 'research' | 'refactor' | 'other';
  summary: string;
  keyFiles: string[];
  decisions: Array<{
    decision: string;
    reasoning: string;
    timestamp: Date;
  }>;
  progress: {
    completed: string[];
    inProgress: string[];
    pending: string[];
  };
  notes: string;
  metadata?: Record<string, unknown>;
}

export type MergeStrategy = 'replace' | 'append' | 'selective';

interface MergeResult {
  success: boolean;
  conflicts?: string[];
  merged?: SerializedContext;
}

export class ForkManager {
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Initialize the fork manager
   */
  async init(): Promise<void> {
    await fs.mkdir(CONTEXTS_PATH, { recursive: true });
  }

  /**
   * Serialize current context to a file
   */
  async serialize(context: SerializedContext): Promise<string> {
    const contextPath = path.join(CONTEXTS_PATH, `${context.id}.json`);

    await fs.writeFile(
      contextPath,
      JSON.stringify(context, null, 2)
    );

    return contextPath;
  }

  /**
   * Restore context from a file
   */
  async restore(contextId: string): Promise<SerializedContext | null> {
    const contextPath = path.join(CONTEXTS_PATH, `${contextId}.json`);

    try {
      const data = await fs.readFile(contextPath, 'utf-8');
      const context = JSON.parse(data) as SerializedContext;

      // Convert date strings back to Date objects
      context.createdAt = new Date(context.createdAt);
      for (const decision of context.decisions) {
        decision.timestamp = new Date(decision.timestamp);
      }

      return context;
    } catch {
      return null;
    }
  }

  /**
   * List all saved contexts
   */
  async listContexts(): Promise<Array<{ id: string; task: string; createdAt: Date }>> {
    try {
      const files = await fs.readdir(CONTEXTS_PATH);
      const contexts: Array<{ id: string; task: string; createdAt: Date }> = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const data = await fs.readFile(
            path.join(CONTEXTS_PATH, file),
            'utf-8'
          );
          const context = JSON.parse(data) as SerializedContext;
          contexts.push({
            id: context.id,
            task: context.task,
            createdAt: new Date(context.createdAt),
          });
        } catch {
          // Skip corrupted files
        }
      }

      // Sort by creation date descending
      contexts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return contexts;
    } catch {
      return [];
    }
  }

  /**
   * Merge two contexts using the specified strategy
   */
  async merge(
    primaryId: string,
    secondaryId: string,
    strategy: MergeStrategy
  ): Promise<MergeResult> {
    const primary = await this.restore(primaryId);
    const secondary = await this.restore(secondaryId);

    if (!primary || !secondary) {
      return {
        success: false,
        conflicts: ['One or both contexts not found'],
      };
    }

    switch (strategy) {
      case 'replace':
        return this.mergeReplace(primary, secondary);
      case 'append':
        return this.mergeAppend(primary, secondary);
      case 'selective':
        return this.mergeSelective(primary, secondary);
      default: {
        const exhaustiveCheck: never = strategy;
        return {
          success: false,
          conflicts: [`Unknown merge strategy: ${String(exhaustiveCheck)}`],
        };
      }
    }
  }

  /**
   * Replace strategy: secondary completely replaces primary
   */
  private async mergeReplace(
    _primary: SerializedContext,
    secondary: SerializedContext
  ): Promise<MergeResult> {
    const merged = { ...secondary };
    merged.id = `merged_${Date.now()}`;
    await this.serialize(merged);

    return { success: true, merged };
  }

  /**
   * Append strategy: combine lists, keep primary metadata
   */
  private async mergeAppend(
    primary: SerializedContext,
    secondary: SerializedContext
  ): Promise<MergeResult> {
    const merged: SerializedContext = {
      ...primary,
      id: `merged_${Date.now()}`,
      createdAt: new Date(),
      keyFiles: [...new Set([...primary.keyFiles, ...secondary.keyFiles])],
      decisions: [...primary.decisions, ...secondary.decisions],
      progress: {
        completed: [
          ...new Set([
            ...primary.progress.completed,
            ...secondary.progress.completed,
          ]),
        ],
        inProgress: [
          ...new Set([
            ...primary.progress.inProgress,
            ...secondary.progress.inProgress,
          ]),
        ],
        pending: [
          ...new Set([
            ...primary.progress.pending,
            ...secondary.progress.pending,
          ]),
        ],
      },
      notes: `${primary.notes}\n\n--- Merged from ${secondary.id} ---\n\n${secondary.notes}`,
    };

    await this.serialize(merged);
    return { success: true, merged };
  }

  /**
   * Selective strategy: merge specific fields based on recency/importance
   */
  private async mergeSelective(
    primary: SerializedContext,
    secondary: SerializedContext
  ): Promise<MergeResult> {
    const conflicts: string[] = [];

    // Use newer summary
    const primaryAge = primary.createdAt.getTime();
    const secondaryAge = secondary.createdAt.getTime();
    const useSecondary = secondaryAge > primaryAge;

    const merged: SerializedContext = {
      id: `merged_${Date.now()}`,
      createdAt: new Date(),
      task: useSecondary ? secondary.task : primary.task,
      taskType: useSecondary ? secondary.taskType : primary.taskType,
      summary: useSecondary ? secondary.summary : primary.summary,
      keyFiles: [...new Set([...primary.keyFiles, ...secondary.keyFiles])],
      decisions: this.mergeDecisions(primary.decisions, secondary.decisions),
      progress: this.mergeProgress(primary.progress, secondary.progress),
      notes: `Primary: ${primary.notes}\n\nSecondary: ${secondary.notes}`,
      metadata: { ...primary.metadata, ...secondary.metadata },
    };

    // Check for decision conflicts
    const decisionTexts = new Set(primary.decisions.map((d) => d.decision));
    for (const decision of secondary.decisions) {
      if (decisionTexts.has(decision.decision)) {
        conflicts.push(`Duplicate decision: "${decision.decision.slice(0, 50)}..."`);
      }
    }

    await this.serialize(merged);

    return {
      success: true,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      merged,
    };
  }

  /**
   * Merge decisions, removing exact duplicates
   */
  private mergeDecisions(
    primary: SerializedContext['decisions'],
    secondary: SerializedContext['decisions']
  ): SerializedContext['decisions'] {
    const seen = new Set<string>();
    const merged: SerializedContext['decisions'] = [];

    for (const decision of [...primary, ...secondary]) {
      const key = `${decision.decision}::${decision.reasoning}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(decision);
      }
    }

    // Sort by timestamp
    merged.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return merged;
  }

  /**
   * Merge progress, handling conflicts
   */
  private mergeProgress(
    primary: SerializedContext['progress'],
    secondary: SerializedContext['progress']
  ): SerializedContext['progress'] {
    // If something is completed in either, it's completed
    const completed = new Set([
      ...primary.completed,
      ...secondary.completed,
    ]);

    // If something is in progress in either (but not completed), it's in progress
    const inProgress = new Set([
      ...primary.inProgress.filter((i) => !completed.has(i)),
      ...secondary.inProgress.filter((i) => !completed.has(i)),
    ]);

    // Pending is everything else
    const pending = new Set([
      ...primary.pending.filter(
        (p) => !completed.has(p) && !inProgress.has(p)
      ),
      ...secondary.pending.filter(
        (p) => !completed.has(p) && !inProgress.has(p)
      ),
    ]);

    return {
      completed: [...completed],
      inProgress: [...inProgress],
      pending: [...pending],
    };
  }

  /**
   * Delete a saved context
   */
  async delete(contextId: string): Promise<boolean> {
    try {
      await fs.unlink(path.join(CONTEXTS_PATH, `${contextId}.json`));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up old contexts
   */
  async cleanupOld(maxAgeHours: number = 168): Promise<number> {
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();
    let cleaned = 0;

    const contexts = await this.listContexts();
    for (const context of contexts) {
      const age = now - context.createdAt.getTime();
      if (age > maxAge) {
        await this.delete(context.id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Create a context from task description
   */
  createContext(
    task: string,
    taskType: SerializedContext['taskType'] = 'other'
  ): SerializedContext {
    return {
      id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date(),
      task,
      taskType,
      summary: '',
      keyFiles: [],
      decisions: [],
      progress: {
        completed: [],
        inProgress: [],
        pending: [],
      },
      notes: '',
    };
  }
}

/**
 * Create a fork manager
 */
export function createForkManager(eventBus: EventBus): ForkManager {
  return new ForkManager(eventBus);
}
