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

// All 9 workspace files — loaded in priority order (identity first)
const ALL_WORKSPACE_FILES = [
  'SOUL.md',
  'IDENTITY.md',
  'USER.md',
  'GOALS.md',
  'PREFERENCES.md',
  'AGENTS.md',
  'HEARTBEAT.md',
  'MEMORY.md',
  'TOOLS.md',
] as const;

const TOTAL_CHAR_BUDGET = 150_000;
const PER_FILE_CHAR_LIMIT = 20_000;

/**
 * Load and combine all 9 workspace files into a single prompt.
 * Enforces per-file (20K) and total (150K) character budgets.
 * Returns empty string if no files exist.
 */
export async function loadIdentityPrompt(): Promise<string> {
  const contents = await Promise.all(
    ALL_WORKSPACE_FILES.map((f) => loadWorkspaceFile(f)),
  );

  const sections: string[] = [];
  let totalChars = 0;

  for (let i = 0; i < ALL_WORKSPACE_FILES.length; i++) {
    let content = contents[i];
    if (!content) continue;

    // Per-file budget
    if (content.length > PER_FILE_CHAR_LIMIT) {
      content = content.slice(0, PER_FILE_CHAR_LIMIT);
    }

    // Total budget
    if (totalChars + content.length > TOTAL_CHAR_BUDGET) {
      const remaining = TOTAL_CHAR_BUDGET - totalChars;
      if (remaining <= 0) break;
      content = content.slice(0, remaining);
    }

    sections.push(content);
    totalChars += content.length;
  }

  return sections.join('\n\n---\n\n');
}

/**
 * Clear the workspace file cache.
 * Useful for testing or forcing fresh reload.
 */
export function clearWorkspaceCache(): void {
  cache.clear();
}
