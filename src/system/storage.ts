import { promises as fs } from 'fs';
import path from 'path';
import { CONFIG_DIR } from '../kernel/config.js';
import { Context, ContextSchema, ActiveContext, ActiveContextSchema } from './types.js';
import { z } from 'zod';

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
 * Match a message against context triggers.
 * Grounded in v12 CONTEXTS/README.md:
 * - Ventures: explicit mention required
 * - Life domains: topic detection (keyword matching)
 */
export async function matchContext(content: string): Promise<Context | null> {
  const contexts = await listContexts();
  const lower = content.toLowerCase();

  for (const ctx of contexts) {
    for (const trigger of ctx.triggers) {
      if (lower.includes(trigger.toLowerCase())) {
        return ctx;
      }
    }
  }

  return null;
}

export function getContextsDir(): string {
  return CONTEXTS_DIR;
}
