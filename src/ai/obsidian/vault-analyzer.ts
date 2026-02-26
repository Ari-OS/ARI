/**
 * vault-analyzer.ts — 5 intelligence patterns for Obsidian vault analysis.
 *
 * ARI reads, Pryce writes. Read-only. Never writes to vault.
 * Output goes to ~/.ari/workspace/OBSIDIAN-*.md for briefings + Discord commands.
 *
 * Patterns:
 *   1. morningVaultDigest()   — yesterday's themes + questions (daily 05:00 ET via DEX)
 *   2. scan30DayIdeas()       — co-occurrence patterns, ≥3 mentions (/ari-vault-ideas)
 *   3. traceIdeaEvolution()   — timeline of how a topic evolved (/ari-vault-trace)
 *   4. connectDomains()       — bridge two knowledge neighborhoods (/ari-vault-connect)
 *   5. findGaps()             — orphans, stale hubs, untagged notes (/ari-vault-gaps)
 *
 * Environment:
 *   ARI_OBSIDIAN_ENABLED      — 'true' to enable
 *   OBSIDIAN_BASE_URL         — default http://127.0.0.1:27123
 *   OBSIDIAN_API_KEY          — from Local REST API plugin settings
 *   ARI_OBSIDIAN_VAULT_PATH   — vault path for file-system access
 */

import {
  ObsidianClient,
  dateMinusDays,
  daysAgo,
  extractQuestions,
  extractWikilinks,
  extractContext,
  extractTags,
} from './obsidian-client.js';

// ─── Public result types ─────────────────────────────────────────────────────

export type VaultDigest = {
  themes: string[];
  questions: string[];
  relatedNotes: string[];
  date: string;
};

export type IdeaCluster = {
  term: string;
  dayCount: number;
  strength: number;        // 0-1 co-occurrence score
  relatedTerms: string[];
  firstSeen: string;
  lastSeen: string;
};

export type EvolutionEntry = {
  date: string;
  context: string;
  linkedNotes: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
};

export type BridgeReport = {
  domain1: string;
  domain2: string;
  sharedReferences: string[];
  bridgeCandidates: string[];
};

export type VaultGaps = {
  orphanNotes: string[];
  staleHubs: string[];
  untaggedNotes: string[];
};

// ─── Client factory ──────────────────────────────────────────────────────────

function createClient(): ObsidianClient {
  return new ObsidianClient({
    baseUrl: process.env.OBSIDIAN_BASE_URL ?? 'http://127.0.0.1:27123',
    apiKey: process.env.OBSIDIAN_API_KEY ?? '',
  });
}

// ─── Pattern 1: Morning vault digest ─────────────────────────────────────────

/**
 * Extract yesterday's themes and questions for the morning briefing.
 * Runs at 05:00 ET daily via ari-scheduler (DEX agent).
 * Output: ~/.ari/workspace/OBSIDIAN-DAILY-DIGEST.md
 */
export async function morningVaultDigest(): Promise<VaultDigest> {
  const obsidian = createClient();
  const yesterdayDate = dateMinusDays(1);
  const yesterday = await obsidian.getDaily(yesterdayDate);

  if (!yesterday) {
    return { themes: [], questions: [], relatedNotes: [], date: yesterdayDate };
  }

  const themes = [
    ...extractTags(yesterday.content),
    ...extractWikilinks(yesterday.content),
  ].slice(0, 5);

  const questions = extractQuestions(yesterday.content).slice(0, 3);

  // Find related notes by searching for the most prominent theme
  const relatedNotes: string[] = [];
  if (themes[0]) {
    const results = await obsidian.search(themes[0]);
    const relevant = results
      .filter(r => !r.filename.includes(yesterdayDate))
      .slice(0, 3)
      .map(r => r.filename.replace(/\.md$/, ''));
    relatedNotes.push(...relevant);
  }

  return { themes, questions, relatedNotes, date: yesterdayDate };
}

// ─── Pattern 2: 30-day idea scan ─────────────────────────────────────────────

/**
 * Scan last 30 daily notes for co-occurring ideas and emerging patterns.
 * Triggered by /ari-vault-ideas Discord command (DEX agent).
 */
export async function scan30DayIdeas(): Promise<IdeaCluster[]> {
  const obsidian = createClient();
  const mentionMap = new Map<string, { dates: string[]; coTerms: string[] }>();

  // Load the last 30 daily notes
  for (let i = 1; i <= 30; i++) {
    const date = dateMinusDays(i);
    const note = await obsidian.getDaily(date);
    if (!note) continue;

    const terms = [
      ...extractTags(note.content),
      ...extractWikilinks(note.content),
    ];

    for (const term of terms) {
      const existing = mentionMap.get(term) ?? { dates: [], coTerms: [] };
      existing.dates.push(date);
      // Track co-occurring terms (simple bigram)
      for (const other of terms) {
        if (other !== term && !existing.coTerms.includes(other)) {
          existing.coTerms.push(other);
        }
      }
      mentionMap.set(term, existing);
    }
  }

  // Build clusters for terms mentioned 3+ days
  const clusters: IdeaCluster[] = [];
  for (const [term, data] of mentionMap.entries()) {
    if (data.dates.length < 3) continue;
    const sorted = data.dates.sort();
    clusters.push({
      term,
      dayCount: data.dates.length,
      strength: Math.min(1, data.dates.length / 30),
      relatedTerms: data.coTerms.slice(0, 5),
      firstSeen: sorted[0],
      lastSeen: sorted[sorted.length - 1],
    });
  }

  return clusters.sort((a, b) => b.dayCount - a.dayCount);
}

// ─── Pattern 3: Idea evolution trace ─────────────────────────────────────────

/**
 * Trace how a topic evolved across 30 daily notes over time.
 * Triggered by /ari-vault-trace [topic] Discord command (DEX agent).
 */
export async function traceIdeaEvolution(topic: string): Promise<EvolutionEntry[]> {
  const obsidian = createClient();
  const timeline: EvolutionEntry[] = [];

  for (let i = 30; i >= 1; i--) {
    const date = dateMinusDays(i);
    const note = await obsidian.getDaily(date);
    if (!note) continue;

    const lower = note.content.toLowerCase();
    if (!lower.includes(topic.toLowerCase())) continue;

    const context = extractContext(note.content, topic, 200);
    const linkedNotes = extractWikilinks(note.content).slice(0, 5);
    const sentiment = inferSentiment(context);

    timeline.push({ date, context, linkedNotes, sentiment });
  }

  return timeline;
}

// ─── Pattern 4: Domain bridge ────────────────────────────────────────────────

/**
 * Find connections between two knowledge neighborhoods.
 * Triggered by /ari-vault-connect [d1] [d2] Discord command (DEX agent).
 */
export async function connectDomains(domain1: string, domain2: string): Promise<BridgeReport> {
  const obsidian = createClient();

  const [results1, results2] = await Promise.all([
    obsidian.search(domain1),
    obsidian.search(domain2),
  ]);

  const files1 = new Set(results1.map(r => r.filename));
  const files2 = new Set(results2.map(r => r.filename));

  // Notes that appear in both searches = shared references
  const sharedReferences = [...files1].filter(f => files2.has(f)).slice(0, 5);

  // Bridge candidates: notes from d1 that link to d2 terms or vice versa
  const bridgeCandidates: string[] = [];
  for (const result of results1.slice(0, 10)) {
    const content = await obsidian.readFile(result.filename);
    if (content && content.toLowerCase().includes(domain2.toLowerCase())) {
      bridgeCandidates.push(result.filename.replace(/\.md$/, ''));
    }
  }

  return {
    domain1,
    domain2,
    sharedReferences: sharedReferences.map(f => f.replace(/\.md$/, '')),
    bridgeCandidates: bridgeCandidates.slice(0, 5),
  };
}

// ─── Pattern 5: Gap detection ────────────────────────────────────────────────

/**
 * Find orphan notes, stale hubs, and untagged notes.
 * Triggered by /ari-vault-gaps Discord command (DEX agent).
 */
export async function findGaps(): Promise<VaultGaps> {
  const obsidian = createClient();
  const allFiles = await obsidian.listFiles();

  const orphanNotes: string[] = [];
  const staleHubs: string[] = [];
  const untaggedNotes: string[] = [];
  const staleCutoff = daysAgo(30);

  // Build backlink map
  const backlinkCount = new Map<string, number>();
  for (const file of allFiles) {
    if (file.extension !== 'md') continue;
    const content = await obsidian.readFile(file.path);
    if (!content) continue;
    const links = extractWikilinks(content);
    for (const link of links) {
      backlinkCount.set(link, (backlinkCount.get(link) ?? 0) + 1);
    }

    const tags = extractTags(content);
    if (tags.length === 0) {
      untaggedNotes.push(file.path);
    }
  }

  for (const file of allFiles) {
    if (file.extension !== 'md') continue;
    const basename = file.basename;
    const incoming = backlinkCount.get(basename) ?? 0;
    const isStale = file.stat.mtime < staleCutoff;

    if (incoming === 0 && !file.path.includes('001-DAILY')) {
      orphanNotes.push(file.path);
    }
    if (incoming > 5 && isStale) {
      staleHubs.push(file.path);
    }
  }

  return {
    orphanNotes: orphanNotes.slice(0, 10),
    staleHubs: staleHubs.slice(0, 5),
    untaggedNotes: untaggedNotes.slice(0, 10),
  };
}

// ─── Private helpers ─────────────────────────────────────────────────────────

function inferSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase();
  const positiveWords = ['good', 'great', 'decided', 'progress', 'yes', 'win', 'love', 'perfect', 'done'];
  const negativeWords = ['maybe', 'unsure', 'not', 'bad', 'struggle', 'problem', 'doubt', 'stuck'];
  const pos = positiveWords.filter(w => lower.includes(w)).length;
  const neg = negativeWords.filter(w => lower.includes(w)).length;
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}
