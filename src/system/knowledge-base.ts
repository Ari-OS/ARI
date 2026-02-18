/**
 * ARI Knowledge Base
 *
 * Persists ingested knowledge from multiple source types (URLs, YouTube, X threads,
 * PDFs, RSS, Readwise, manual entries) into a JSONL store. Provides simple text
 * search for retrieval — full vector search is handled by the existing
 * embedding-service.ts and vector-store.ts.
 *
 * Storage: ~/.ari/knowledge/entries.jsonl (append-only, line-delimited JSON)
 *
 * Layer: L2 (System) — imports from kernel only
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('knowledge-base');

// ─── Types ───────────────────────────────────────────────────────────────────

export type SourceType = 'url' | 'youtube' | 'x_thread' | 'pdf' | 'rss' | 'readwise' | 'manual';

export interface KnowledgeSource {
  type: SourceType;
  url?: string;
  content?: string;
  title?: string;
  author?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface KnowledgeEntry {
  id: string;
  sourceType: SourceType;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  entities: string[];
  url?: string;
  author?: string;
  ingestedAt: string;
  lastAccessed?: string;
  accessCount: number;
  metadata: Record<string, unknown>;
}

export interface KnowledgeStats {
  totalEntries: number;
  bySource: Record<SourceType, number>;
  totalTags: number;
  topTags: Array<{ tag: string; count: number }>;
  recentlyAdded: number;
  mostAccessed: KnowledgeEntry[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_STORAGE_PATH = path.join(homedir(), '.ari', 'knowledge');
const ENTRIES_FILE = 'entries.jsonl';
const MAX_CONTENT_LENGTH = 100_000;
const RECENT_DAYS = 7;

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════════════════════

export class KnowledgeBase {
  private readonly storagePath: string;
  private readonly entriesPath: string;
  private readonly eventBus: EventBus;
  private entries: Map<string, KnowledgeEntry> = new Map();

  constructor(params: { storagePath?: string; eventBus: EventBus }) {
    this.storagePath = params.storagePath ?? DEFAULT_STORAGE_PATH;
    this.entriesPath = path.join(this.storagePath, ENTRIES_FILE);
    this.eventBus = params.eventBus;

    this.ensureStorageDir();
    this.loadEntries();
  }

  // ── Ingest a knowledge source ──────────────────────────────────────────────

  ingest(source: KnowledgeSource): Promise<KnowledgeEntry> {
    const id = randomUUID();
    const content = (source.content ?? '').slice(0, MAX_CONTENT_LENGTH);
    const title = source.title ?? this.extractTitle(content);
    const summary = this.generateSummary(content);
    const tags = source.tags ?? [];
    const entities = this.extractSimpleEntities(content);

    const entry: KnowledgeEntry = {
      id,
      sourceType: source.type,
      title,
      content,
      summary,
      tags,
      entities,
      url: source.url,
      author: source.author,
      ingestedAt: new Date().toISOString(),
      accessCount: 0,
      metadata: source.metadata ?? {},
    };

    this.entries.set(id, entry);
    this.appendEntry(entry);

    this.eventBus.emit('knowledge:kb_ingested', {
      id: entry.id,
      sourceType: entry.sourceType,
      title: entry.title,
      tags: entry.tags,
      timestamp: entry.ingestedAt,
    });

    log.info({ id, sourceType: source.type, title }, 'Knowledge entry ingested');
    return Promise.resolve(entry);
  }

  // ── Search knowledge base ──────────────────────────────────────────────────

  search(query: string, limit = 10): KnowledgeEntry[] {
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/).filter(Boolean);

    const scored: Array<{ entry: KnowledgeEntry; score: number }> = [];

    for (const entry of this.entries.values()) {
      let score = 0;
      const titleLower = entry.title.toLowerCase();
      const contentLower = entry.content.toLowerCase();
      const tagsLower = entry.tags.map(t => t.toLowerCase());
      const entitiesLower = entry.entities.map(e => e.toLowerCase());

      for (const term of terms) {
        // Title match (highest weight)
        if (titleLower.includes(term)) score += 10;

        // Tag match
        if (tagsLower.some(t => t.includes(term))) score += 8;

        // Entity match
        if (entitiesLower.some(e => e.includes(term))) score += 6;

        // Content match
        if (contentLower.includes(term)) score += 3;

        // Author match
        if (entry.author?.toLowerCase().includes(term)) score += 5;
      }

      if (score > 0) {
        scored.push({ entry, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, limit).map(s => s.entry);

    this.eventBus.emit('knowledge:kb_searched', {
      query,
      resultCount: results.length,
      timestamp: new Date().toISOString(),
    });

    log.info({ query, resultCount: results.length }, 'Knowledge search executed');
    return results;
  }

  // ── Get by source type ─────────────────────────────────────────────────────

  getBySource(sourceType: SourceType): KnowledgeEntry[] {
    const results: KnowledgeEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.sourceType === sourceType) {
        results.push(entry);
      }
    }
    return results;
  }

  // ── Get entry by ID ────────────────────────────────────────────────────────

  get(id: string): KnowledgeEntry | null {
    const entry = this.entries.get(id) ?? null;
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = new Date().toISOString();

      this.eventBus.emit('knowledge:kb_accessed', {
        id: entry.id,
        accessCount: entry.accessCount,
        timestamp: entry.lastAccessed,
      });
    }
    return entry;
  }

  // ── Delete entry ───────────────────────────────────────────────────────────

  delete(id: string): boolean {
    const existed = this.entries.delete(id);
    if (existed) {
      this.rewriteEntries();
      log.info({ id }, 'Knowledge entry deleted');
    }
    return existed;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  getStats(): KnowledgeStats {
    const allSourceTypes: SourceType[] = ['url', 'youtube', 'x_thread', 'pdf', 'rss', 'readwise', 'manual'];
    const bySource: Record<SourceType, number> = {} as Record<SourceType, number>;
    for (const st of allSourceTypes) {
      bySource[st] = 0;
    }

    const tagCounts = new Map<string, number>();
    const now = Date.now();
    const recentCutoff = now - RECENT_DAYS * 24 * 60 * 60 * 1000;
    let recentlyAdded = 0;

    const allEntries: KnowledgeEntry[] = [];

    for (const entry of this.entries.values()) {
      allEntries.push(entry);
      bySource[entry.sourceType] = (bySource[entry.sourceType] ?? 0) + 1;

      for (const tag of entry.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }

      if (new Date(entry.ingestedAt).getTime() > recentCutoff) {
        recentlyAdded++;
      }
    }

    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const mostAccessed = allEntries
      .filter(e => e.accessCount > 0)
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 5);

    return {
      totalEntries: this.entries.size,
      bySource,
      totalTags: tagCounts.size,
      topTags,
      recentlyAdded,
      mostAccessed,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  private loadEntries(): void {
    if (!fs.existsSync(this.entriesPath)) {
      log.info('No existing entries file, starting fresh');
      return;
    }

    try {
      const data = fs.readFileSync(this.entriesPath, 'utf-8');
      const lines = data.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as KnowledgeEntry;
          this.entries.set(entry.id, entry);
        } catch {
          log.warn({ line: line.slice(0, 100) }, 'Skipping malformed JSONL line');
        }
      }

      log.info({ count: this.entries.size }, 'Knowledge entries loaded');
    } catch (err) {
      log.error({ error: String(err) }, 'Failed to load entries');
    }
  }

  private appendEntry(entry: KnowledgeEntry): void {
    try {
      fs.appendFileSync(this.entriesPath, JSON.stringify(entry) + '\n');
    } catch (err) {
      log.error({ id: entry.id, error: String(err) }, 'Failed to persist entry');
    }
  }

  private rewriteEntries(): void {
    try {
      const lines = Array.from(this.entries.values())
        .map(e => JSON.stringify(e))
        .join('\n');
      fs.writeFileSync(this.entriesPath, lines + (lines ? '\n' : ''));
    } catch (err) {
      log.error({ error: String(err) }, 'Failed to rewrite entries');
    }
  }

  private extractTitle(content: string): string {
    const firstLine = content.split('\n')[0]?.trim() ?? '';
    if (firstLine.length > 0 && firstLine.length <= 200) {
      return firstLine;
    }
    return content.slice(0, 80).trim() + '...';
  }

  private generateSummary(content: string): string {
    // Simple extractive summary — first 500 chars
    return content.slice(0, 500).trim();
  }

  private extractSimpleEntities(content: string): string[] {
    // Simple regex-based entity extraction
    // Finds capitalized multi-word phrases (likely proper nouns)
    const entityPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    const found = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = entityPattern.exec(content)) !== null) {
      if (match[1].length <= 50) {
        found.add(match[1]);
      }
    }

    return Array.from(found).slice(0, 20);
  }
}
