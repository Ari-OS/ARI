/**
 * ARI Context Loader
 *
 * Implements distributed context loading (router pattern) for
 * hierarchical CLAUDE.md files throughout the codebase.
 *
 * Instead of loading one massive context file, this walks up
 * the directory tree and collects relevant context from each
 * layer. This reduces token usage and improves response quality
 * by only loading context relevant to the current working directory.
 *
 * Example: Working in src/agents/
 * Loads: src/agents/CLAUDE.md → src/CLAUDE.md → CLAUDE.md
 */

import { EventBus } from '../kernel/event-bus.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface LoadedContext {
  path: string;
  content: string;
  depth: number; // 0 = closest to working dir, higher = further up
  skills?: string[];
}

interface ContextLoaderConfig {
  projectRoot: string;
  maxDepth?: number; // Max directory levels to traverse
  contextFiles?: string[]; // Files to look for (default: ['CLAUDE.md'])
}

/**
 * Extract skill names mentioned in a CLAUDE.md file
 */
function extractSkillReferences(content: string): string[] {
  const skills: string[] = [];

  // Match patterns like "use skill: skillname" or "/skillname"
  const skillPatterns = [
    /use\s+skill:\s*(\S+)/gi,
    /skill:\s*(\S+)/gi,
    /\/([a-z][\w-]+)/gi, // Slash commands
  ];

  for (const pattern of skillPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const skillName = match[1].toLowerCase().replace(/['"`,;.]/g, '');
      if (skillName.length > 2 && !skills.includes(skillName)) {
        skills.push(skillName);
      }
    }
  }

  return skills;
}

export class ContextLoader {
  private eventBus: EventBus;
  private projectRoot: string;
  private maxDepth: number;
  private contextFiles: string[];
  private cache: Map<string, LoadedContext[]> = new Map();

  constructor(eventBus: EventBus, config: ContextLoaderConfig) {
    this.eventBus = eventBus;
    this.projectRoot = config.projectRoot;
    this.maxDepth = config.maxDepth ?? 10;
    this.contextFiles = config.contextFiles ?? ['CLAUDE.md'];
  }

  /**
   * Load all context files for a directory path
   * Walks up the directory tree collecting CLAUDE.md files
   */
  async loadForDirectory(dir: string): Promise<LoadedContext[]> {
    // Normalize path
    const normalizedDir = path.resolve(dir);

    // Check cache
    if (this.cache.has(normalizedDir)) {
      return this.cache.get(normalizedDir)!;
    }

    const contexts: LoadedContext[] = [];
    let currentDir = normalizedDir;
    let depth = 0;

    // Walk up directory tree
    while (depth < this.maxDepth) {
      // Check each context file type
      for (const filename of this.contextFiles) {
        const contextPath = path.join(currentDir, filename);

        try {
          const content = await fs.readFile(contextPath, 'utf-8');
          const skills = extractSkillReferences(content);

          contexts.push({
            path: contextPath,
            content,
            depth,
            skills,
          });
        } catch {
          // File doesn't exist, continue
        }
      }

      // Stop if we've reached project root
      if (currentDir === this.projectRoot) {
        break;
      }

      // Move up one directory
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break; // Reached filesystem root
      }

      currentDir = parentDir;
      depth++;
    }

    // Sort by depth (closest first)
    contexts.sort((a, b) => a.depth - b.depth);

    // Cache result
    this.cache.set(normalizedDir, contexts);

    // Emit event
    const allSkills = contexts.flatMap((c) => c.skills || []);
    this.eventBus.emit('context:loaded', {
      path: normalizedDir,
      depth: contexts.length,
      skills: [...new Set(allSkills)],
    });

    return contexts;
  }

  /**
   * Get contextual skills for a directory
   * Aggregates all skill references from loaded context files
   */
  async getContextualSkills(dir: string): Promise<string[]> {
    const contexts = await this.loadForDirectory(dir);
    const skills = contexts.flatMap((c) => c.skills || []);
    return [...new Set(skills)];
  }

  /**
   * Get combined context content for a directory
   * Useful for creating a single context string
   */
  async getCombinedContext(
    dir: string,
    options: { separator?: string; includeHeaders?: boolean } = {}
  ): Promise<string> {
    const { separator = '\n\n---\n\n', includeHeaders = true } = options;
    const contexts = await this.loadForDirectory(dir);

    if (contexts.length === 0) {
      return '';
    }

    const parts = contexts.map((ctx) => {
      if (includeHeaders) {
        const relativePath = path.relative(this.projectRoot, ctx.path);
        return `<!-- From: ${relativePath} -->\n\n${ctx.content}`;
      }
      return ctx.content;
    });

    return parts.join(separator);
  }

  /**
   * Find the most specific CLAUDE.md for a file path
   */
  async findClosestContext(filePath: string): Promise<LoadedContext | null> {
    const dir = path.dirname(filePath);
    const contexts = await this.loadForDirectory(dir);
    return contexts[0] || null;
  }

  /**
   * Clear the cache (useful after editing CLAUDE.md files)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if a directory has any context files
   */
  async hasContext(dir: string): Promise<boolean> {
    const contexts = await this.loadForDirectory(dir);
    return contexts.length > 0;
  }

  /**
   * List all CLAUDE.md files in the project
   */
  async listAllContextFiles(): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // Skip node_modules and hidden directories
            if (
              entry.name === 'node_modules' ||
              entry.name === 'dist' ||
              entry.name.startsWith('.')
            ) {
              continue;
            }
            await walk(fullPath);
          } else if (this.contextFiles.includes(entry.name)) {
            files.push(fullPath);
          }
        }
      } catch {
        // Permission denied or other error
      }
    };

    await walk(this.projectRoot);
    return files;
  }

  /**
   * Get summary of context coverage in the project
   */
  async getContextCoverage(): Promise<{
    totalFiles: number;
    directories: string[];
    skills: string[];
  }> {
    const files = await this.listAllContextFiles();
    const allSkills: Set<string> = new Set();

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const skills = extractSkillReferences(content);
        skills.forEach((s) => allSkills.add(s));
      } catch {
        // Skip unreadable files
      }
    }

    return {
      totalFiles: files.length,
      directories: files.map((f) => path.dirname(f)),
      skills: [...allSkills],
    };
  }
}

/**
 * Create a context loader for a project
 */
export function createContextLoader(
  eventBus: EventBus,
  projectRoot: string
): ContextLoader {
  return new ContextLoader(eventBus, { projectRoot });
}
