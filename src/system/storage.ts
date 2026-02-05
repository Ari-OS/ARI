import { promises as fs } from 'fs';
import path from 'path';
import { CONFIG_DIR } from '../kernel/config.js';
import { Context, ContextSchema, ActiveContext, ActiveContextSchema } from './types.js';

/**
 * Context storage at ~/.ari/contexts/
 * Grounded in v12 CONTEXTS/README.md: contexts are dynamically loaded,
 * venture/life isolated, stored as files.
 *
 * Phase 1: read/write context metadata. No memory mutation.
 */

const CONTEXTS_DIR = path.join(CONFIG_DIR, 'contexts');
const ACTIVE_PATH = path.join(CONTEXTS_DIR, 'active.json');

export async function ensureContextsDir(): Promise<void> {
  await fs.mkdir(CONTEXTS_DIR, { recursive: true });
}

export async function listContexts(): Promise<Context[]> {
  await ensureContextsDir();
  const files = await fs.readdir(CONTEXTS_DIR);
  const contexts: Context[] = [];

  for (const file of files) {
    if (!file.endsWith('.json') || file === 'active.json') continue;
    try {
      const content = await fs.readFile(path.join(CONTEXTS_DIR, file), 'utf-8');
      const parsed = ContextSchema.parse(JSON.parse(content));
      contexts.push(parsed);
    } catch {
      // Skip malformed context files
    }
  }

  return contexts;
}

export async function getContext(id: string): Promise<Context | null> {
  const filePath = path.join(CONTEXTS_DIR, `${id}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return ContextSchema.parse(JSON.parse(content));
  } catch {
    return null;
  }
}

export async function saveContext(context: Context): Promise<void> {
  await ensureContextsDir();
  const validated = ContextSchema.parse(context);
  const filePath = path.join(CONTEXTS_DIR, `${validated.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(validated, null, 2), 'utf-8');
}

export async function getActiveContext(): Promise<ActiveContext> {
  try {
    const content = await fs.readFile(ACTIVE_PATH, 'utf-8');
    return ActiveContextSchema.parse(JSON.parse(content));
  } catch {
    return { contextId: null, activatedAt: null };
  }
}

export async function setActiveContext(contextId: string | null): Promise<void> {
  await ensureContextsDir();
  const active: ActiveContext = {
    contextId,
    activatedAt: contextId ? new Date().toISOString() : null,
  };
  await fs.writeFile(ACTIVE_PATH, JSON.stringify(active, null, 2), 'utf-8');
}

/**
 * Tokenize a string into normalized terms for matching.
 * Strips punctuation, lowercases, and removes stopwords.
 */
function tokenize(text: string): string[] {
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'can', 'shall',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'into', 'about', 'between', 'through', 'after', 'before',
    'and', 'or', 'but', 'not', 'no', 'if', 'then', 'than',
    'that', 'this', 'it', 'its', 'my', 'your', 'his', 'her',
    'we', 'they', 'them', 'me', 'i', 'you', 'he', 'she',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !stopwords.has(t));
}

/**
 * Score how well a message matches a context's triggers.
 * Uses token overlap scoring: counts matching tokens weighted by specificity.
 * Returns a score between 0 and 1.
 */
function scoreContextMatch(contentTokens: string[], triggers: string[]): number {
  if (triggers.length === 0 || contentTokens.length === 0) return 0;

  let matchedWeight = 0;
  let totalWeight = 0;

  for (const trigger of triggers) {
    const triggerTokens = tokenize(trigger);
    if (triggerTokens.length === 0) continue;

    // Weight longer triggers higher (more specific)
    const weight = 1 + Math.log2(triggerTokens.length + 1);
    totalWeight += weight;

    // Check token overlap
    const matched = triggerTokens.filter(t =>
      contentTokens.some(ct => ct === t || ct.includes(t) || t.includes(ct))
    );

    if (matched.length > 0) {
      matchedWeight += weight * (matched.length / triggerTokens.length);
    }
  }

  return totalWeight > 0 ? matchedWeight / totalWeight : 0;
}

/**
 * Match a message against context triggers.
 * Uses token-based scoring for semantic matching instead of exact substring.
 * Falls back to exact match for short triggers.
 *
 * Grounded in v12 CONTEXTS/README.md:
 * - Ventures: explicit mention required
 * - Life domains: topic detection (semantic matching)
 */
export async function matchContext(content: string): Promise<Context | null> {
  const contexts = await listContexts();
  const contentTokens = tokenize(content);
  const lower = content.toLowerCase();

  let bestContext: Context | null = null;
  let bestScore = 0;
  const MATCH_THRESHOLD = 0.3;

  for (const ctx of contexts) {
    // Fast path: exact substring match (for short, specific triggers)
    for (const trigger of ctx.triggers) {
      if (lower.includes(trigger.toLowerCase())) {
        return ctx; // Exact match wins immediately
      }
    }

    // Semantic path: token-based scoring
    const score = scoreContextMatch(contentTokens, ctx.triggers);
    if (score > bestScore && score >= MATCH_THRESHOLD) {
      bestScore = score;
      bestContext = ctx;
    }
  }

  return bestContext;
}

export function getContextsDir(): string {
  return CONTEXTS_DIR;
}
