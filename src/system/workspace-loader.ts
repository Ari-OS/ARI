import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE LOADER — Shared utility for loading ~/.ari/workspace/ files
// ═══════════════════════════════════════════════════════════════════════════════

const WORKSPACE_DIR = join(homedir(), '.ari', 'workspace');
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  content: string;
  loadedAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Load a workspace file with TTL cache (5 minutes).
 * Returns empty string if file doesn't exist.
 */
export async function loadWorkspaceFile(filename: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(filename);

  if (cached && (now - cached.loadedAt) < CACHE_TTL) {
    return cached.content;
  }

  try {
    const content = await readFile(join(WORKSPACE_DIR, filename), 'utf-8');
    cache.set(filename, { content, loadedAt: now });
    return content;
  } catch {
    return '';
  }
}

/**
 * Load and combine SOUL.md, IDENTITY.md, and USER.md into a single prompt.
 * Returns empty string if no files exist.
 */
export async function loadIdentityPrompt(): Promise<string> {
  const [soul, identity, user] = await Promise.all([
    loadWorkspaceFile('SOUL.md'),
    loadWorkspaceFile('IDENTITY.md'),
    loadWorkspaceFile('USER.md'),
  ]);

  return [soul, identity, user].filter(Boolean).join('\n\n---\n\n');
}

/**
 * Clear the workspace file cache.
 * Useful for testing or forcing fresh reload.
 */
export function clearWorkspaceCache(): void {
  cache.clear();
}
