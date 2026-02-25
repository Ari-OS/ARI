---
name: ari-obsidian-patterns
description: Obsidian vault integration patterns — vault-analyzer.ts, /ari-vault-* commands, morning briefing snippet, PARA structure, read-only enforcement
triggers: ["obsidian", "vault", "vault-ideas", "vault-trace", "vault-connect", "vault-gaps", "daily notes", "obsidian mcp", "local rest api", "ari-vault"]
---

# ARI Obsidian Integration Patterns

## Core Principle

**ARI reads, Pryce writes.** The vault is Pryce's second brain, not ARI's workspace. Agent-generated content NEVER enters the vault — preserving integrity so pattern analysis reflects Pryce's actual thinking, not ARI's output.

## Architecture

```
Pryce writes → Obsidian Vault (markdown + backlinks)
                       ↓
     Obsidian Local REST API Plugin (127.0.0.1:27123)
                       ↓
     Obsidian MCP Server (iansinnott or cyanheads daemon)
                       ↓
          ARI / DEX reads vault (read-only)
                       ↓
  Patterns → Morning briefing, DEX digest, /vault-* commands
```

## MCP Configuration

### Interactive (Claude Code sessions)
```
iansinnott/obsidian-claude-code-mcp — 70+ tools, auto-discovers vault
Install: Obsidian → Community Plugins → "Claude Code MCP" → install
No .mcp.json entry needed — registers automatically
```

### Daemon (scheduled ARI tasks)
```json
{
  "obsidian-vault": {
    "command": "npx",
    "args": ["-y", "cyanheads/obsidian-mcp-server"],
    "env": {
      "OBSIDIAN_API_KEY": "<key-from-local-rest-api-plugin>",
      "OBSIDIAN_BASE_URL": "http://127.0.0.1:27123"
    }
  }
}
```

### Prerequisite: Local REST API Plugin
1. Obsidian → Community Plugins → search "Local REST API" (by coddingtonbear)
2. Install → enable
3. Settings → copy API key
4. Plugin runs at `http://127.0.0.1:27123`

## Key REST API Endpoints

```
GET  /vault/{file-path}              # Read any vault file
GET  /daily-notes/{YYYY-MM-DD}/      # Read specific daily note
GET  /search/simple/?query=term      # Full-text search
GET  /open/{file-path}               # Get currently open note
POST /vault/{file-path}              # Write (NOT USED by ARI — read-only)
```

## vault-analyzer.ts — 5 Implementation Patterns

File location: `src/ai/obsidian/vault-analyzer.ts`

```typescript
import { ObsidianClient } from './obsidian-client.js';

const obsidian = new ObsidianClient({
  baseUrl: process.env.OBSIDIAN_BASE_URL ?? 'http://127.0.0.1:27123',
  apiKey: process.env.OBSIDIAN_API_KEY ?? '',
});

// Pattern 1: Morning vault digest (runs daily at 06:30 ET via ari-briefings)
export async function morningVaultDigest(): Promise<VaultDigest> {
  const yesterday = await obsidian.getDaily(dateMinusDays(1));
  if (!yesterday) return { themes: [], questions: [], relatedNotes: [] };

  const themes = extractTopics(yesterday.content);     // hashtags + wikilinks
  const questions = extractQuestions(yesterday.content); // lines ending in ?
  const relatedNotes = await findBacklinks(themes);

  return { themes, questions, relatedNotes };
}

// Pattern 2: 30-day idea scan (/ari-vault-ideas)
export async function scan30DayIdeas(): Promise<IdeaCluster[]> {
  const dailies = await loadDailyNotes(30);
  const mentions = buildMentionFrequencyMap(dailies);
  const clusters = detectCoOccurrence(mentions, dailies, { threshold: 3 });
  return clusters
    .filter(c => c.dayCount >= 3)  // only emerging patterns
    .sort((a, b) => b.strength - a.strength);
}

// Pattern 3: Idea trace (/ari-vault-trace [topic])
export async function traceIdeaEvolution(
  topic: string,
): Promise<EvolutionTimeline> {
  const mentions = await searchDailies(topic, 30);
  return mentions
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(d => ({
      date: d.date,
      context: extractContext(d.content, topic),
      linkedNotes: extractWikilinks(d.content),
      sentiment: inferSentiment(d.content, topic),
    }));
}

// Pattern 4: Domain bridge (/ari-vault-connect [d1] [d2])
export async function connectDomains(
  domain1: string,
  domain2: string,
): Promise<BridgeReport> {
  const [d1Notes, d2Notes] = await Promise.all([
    searchByTag(domain1),
    searchByTag(domain2),
  ]);
  return {
    domain1,
    domain2,
    sharedReferences: findSharedRefs(d1Notes, d2Notes),
    bridgeCandidates: identifyBridges(d1Notes, d2Notes),
  };
}

// Pattern 5: Gap detection (/ari-vault-gaps)
export async function findGaps(): Promise<VaultGaps> {
  const allNotes = await listAllFiles();
  const orphans = allNotes.filter(n => getBacklinks(n).total === 0);
  const staleHubs = allNotes.filter(
    n => getBacklinks(n).incoming > 5 && n.mtime < daysAgo(30),
  );
  const underTagged = allNotes.filter(n => !n.tags || n.tags.length === 0);
  return { orphans, staleHubs, underTagged };
}
```

## Slash Commands

| Command | Agent | What It Does |
|---------|-------|-------------|
| `/ari-vault-ideas` | DEX | 30-day scan → cross-domain patterns, orphan notes, emerging themes |
| `/ari-vault-trace [topic]` | DEX | Trace how an idea evolved across all vault notes over time |
| `/ari-vault-connect [d1] [d2]` | DEX | Bridge two knowledge neighborhoods |
| `/ari-vault-gaps` | DEX | Orphan notes, dead-end links, underexplored areas |

### Example Output: /ari-vault-ideas

```
📔 30-DAY VAULT INTELLIGENCE — 2026-02-25

🔁 EMERGING PATTERNS (appeared 3+ days)
  • "PayThePryce merch" — mentioned 7 days across 3 threads
    Connected: [[Kai's college fund]], [[PayThePryce monetization]]
  • "morning routine" — appeared in 5 daily notes
    First seen: Feb 12 | Latest: Feb 23

🕳️ ORPHAN NODES (no backlinks)
  • [[2025-12-15]] (daily note, never linked)
  • [[Indiana wholesalers]] (created Feb 3, no connections)

💡 IDEA CANDIDATES
  Based on co-occurrence patterns:
  → "Indiana B2B + Pokemon TCG" appear together 4 times
    Possible idea: local card shop partnership for Pryceless?
```

### Example Output: /ari-vault-trace "Pryceless pricing"

```
📈 IDEA EVOLUTION — "Pryceless pricing" (30 days)

Feb 2: [[2026-02-02]] — "maybe charge $500/mo flat for small biz sites?"
  Links: [[revenue goals]], [[Pryceless]]

Feb 8: [[2026-02-08]] — "talked to Eric about retainer model vs project"
  Sentiment: questioning
  Links: [[Eric Rodriguez]], [[Pryceless Solutions]]

Feb 14: [[2026-02-14]] — "leaning toward $299 setup + $149/mo retainer"
  Sentiment: decided
  Links: [[Pryceless pricing model]]

→ Direction: flat rate → retainer (12 days to decision)
→ Key influence: [[Eric Rodriguez]] conversation
```

## Vault Structure (Recommended)

```
Pryce's vault (iCloud or local):
├── 000-PRYCE/
│   ├── user-context.md    # Mirror of USER.md (Pryce maintains)
│   ├── goals.md           # 30/90/365 goals in his own words
│   └── preferences.md     # Communication preferences
├── 001-DAILY/             # YYYY-MM-DD.md files
├── 002-PROJECTS/
│   ├── PayThePryce.md
│   ├── Pryceless.md
│   └── ARI.md
├── 003-KNOWLEDGE/         # Research, learning, insights
├── 004-IDEAS/             # Raw ideas (not yet committed)
├── 005-PEOPLE/            # Notes on contacts
└── 006-REFERENCES/        # Saved articles, bookmarks
```

**Backlinks are the superpower.** `[[PayThePryce merch idea]]` in a daily note creates a traversable link ARI can follow across time.

## Frontmatter Standard

```yaml
---
title: Note Title
created: 2026-02-25T06:30:00Z
modified: 2026-02-25T10:15:00Z
tags: [paytheprice, strategy, pokemon-tcg]
type: daily|project|area|resource|archive
status: active|draft|archived
related: [[note1]], [[note2]]
---
```

**Type categories (PARA):**
- `project` — time-bound (PayThePryce video series, P2 Q1 targets)
- `area` — ongoing (Content, Business Dev, ARI)
- `resource` — reference (market data, tools, people notes)
- `archive` — completed/inactive

## Morning Briefing Vault Section

When `ARI_OBSIDIAN_ENABLED=true`, `ari-briefings` includes:

```
📔 VAULT SNAPSHOT
Yesterday's themes: [[PayThePryce]], [[Kai's birthday]], [[Pryceless Q1]]
Open questions: "Should we do merch before 10K subs?"
Linked notes: [[monetization strategy]] (last edited Feb 18)
```

**Data flow:**
1. `ari-briefings` reads `~/.ari/workspace/OBSIDIAN-DAILY-DIGEST.md` (DEX writes this)
2. DEX runs `morningVaultDigest()` daily at 05:00 ET via ari-scheduler
3. DEX writes output to `~/.ari/workspace/OBSIDIAN-DAILY-DIGEST.md`
4. ARI includes it in 06:30 ET briefing

## Auto-Generated Workspace Files (ARI writes, NOT vault)

```
~/.ari/workspace/OBSIDIAN-DAILY-DIGEST.md    # Morning briefing vault section
~/.ari/workspace/OBSIDIAN-IDEAS-30DAY.md     # Pattern detection results
~/.ari/workspace/OBSIDIAN-GAPS.md            # Gap detection results
~/.ari/workspace/OBSIDIAN-TRACES/            # Per-topic evolution traces
  └── {topic}-trace-{YYYY-MM-DD}.md
```

These files are in `~/.ari/workspace/` NOT in the Obsidian vault. ARI never writes to the vault.

## Scheduler Integration

```typescript
// Register in ari-scheduler (18 tasks includes these):
// 05:00 daily: morning-vault-digest (DEX → OBSIDIAN-DAILY-DIGEST.md)
// Mon 09:00: weekly-vault-scan (DEX → OBSIDIAN-IDEAS-30DAY.md + OBSIDIAN-GAPS.md)
```

## Environment Variables

```
ARI_OBSIDIAN_ENABLED       # 'true' to enable vault integration
OBSIDIAN_API_KEY           # From Local REST API plugin settings
OBSIDIAN_BASE_URL          # Default: http://127.0.0.1:27123
ARI_OBSIDIAN_VAULT_PATH    # Path to vault (for MCP filesystem access)
```
