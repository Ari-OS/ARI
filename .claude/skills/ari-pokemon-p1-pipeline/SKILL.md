---
name: ari-pokemon-p1-pipeline
description: NOVA's P1 PayThePryce pipeline — market signal ingest, card detection, price monitoring, script generation, thumbnail generation, video assembly, approval gate
triggers: ["nova", "paytheprice", "pokemon tcg", "p1 pipeline", "video queue", "thumbnail", "content pipeline", "card prices"]
---

# ARI P1: PayThePryce Pokemon TCG Content Pipeline

**Agent:** NOVA 🎬 | **Plane:** APEX | **Model:** claude-sonnet-4-6

## Data Sources

| Source | What | Frequency | Priority |
|--------|------|-----------|---------|
| pokemontcg.io | Card prices (TCGPlayer), set data | 6h | Primary authority |
| pokewallet.io | Real-time price deltas | 2h | Price verification |
| X API (tracked accounts) | Community hype signals | 2h | Sentiment layer |
| Reddit snoowrap | r/PokemonTCG, r/pokemontrades | 3h | Community sentiment |
| Perplexity Sonar Pro | Web synthesis + news | 6h | Broader context |
| Apify Tweet Scraper V2 | Bulk tweet analysis | Event-triggered | Set reveals, tournaments |

## MarketSignalEnvelope

Every signal enters the pipeline wrapped in:
```typescript
interface MarketSignalEnvelope {
  source: 'pokemontcg.io' | 'pokewallet.io' | 'x_tracked_account' | 'reddit_post' | 'perplexity_synthesis' | 'apify_scrape';
  reliabilityWeight: number;   // See reliability weights below
  sentiment: 'bullish' | 'bearish' | 'neutral';
  scoringMethod: string;
  payload: unknown;
  timestamp: string;
  evidenceId: string;          // Required — every claim needs this
}

// Reliability weights:
const SOURCE_RELIABILITY = {
  'pokemontcg.io': 1.0,
  'pokewallet.io': 0.90,
  'perplexity_synthesis': 0.80,
  'x_tracked_account': 0.70,
  'reddit_post': 0.65,
  'apify_scrape': 0.65,
};
```

## Script Quality Loop (Ralph-Style Agentic Iteration)

NOVA uses an iterative quality gate — the same prompt fed repeatedly until the confidence
threshold is met. Inspired by the Ralph Wiggum technique but implemented as an agentic
loop inside the pipeline (not a Claude Code stop hook — OpenClaw context doesn't use one).

```typescript
// Ralph-style script quality loop:
const MAX_SCRIPT_RETRIES = 3;
const CONFIDENCE_THRESHOLD = 0.95; // auto-advance
const REVIEW_THRESHOLD     = 0.80; // submit with flag

async function generateScriptWithQualityLoop(
  signals: MarketSignalEnvelope[],
): Promise<ScriptOutput> {
  let attempt = 0;
  let best: ScriptOutput | null = null;
  let feedback = '';

  while (attempt < MAX_SCRIPT_RETRIES) {
    attempt++;

    // Generate (or re-generate with feedback from last attempt)
    const script = await nova.generateScript(signals, feedback);

    if (!best || script.confidence > best.confidence) {
      best = script;
    }

    if (script.confidence >= CONFIDENCE_THRESHOLD) break; // auto-advance

    // Build feedback for next iteration (Ralph sees its own previous work)
    feedback = `Previous attempt scored ${script.confidence.toFixed(2)}. Issues: ` +
      `hook unclear? evidence gaps? ${script.evidenceIds.length} evidenceIds present.`;
  }

  return best!;
}

// After the loop:
// ≥ 0.95 → auto-advance to video packaging (still pending Pryce ✅)
// 0.80-0.95 → submit with "recommend review" flag
// < 0.80 → escalate to ARI, do NOT auto-queue

// Script format:
interface ScriptOutput {
  hook: string;           // The exact opening line (0-5s)
  setup: string;          // Context (5-30s)
  body: ScriptSection[];  // Each section with evidenceId
  cta: string;            // Subscribe/comment prompt
  seo: {
    title: string;
    description: string;
    tags: string[];
    thumbnailBrief: string;
  };
  confidence: number;
  evidenceIds: string[];  // ALL claims must have evidenceId
}
```

## Rights Gate (MANDATORY — cannot be bypassed)

```typescript
interface AssetRights {
  origin: 'owned' | 'licensed' | 'generated' | 'third_party';
  usageClass: 'commercial_ok' | 'restricted' | 'unknown';
}
// BLOCK if usageClass='unknown'
// Pokemon TCG card scans → usageClass='restricted' (NOT commercial_ok)
// Ideogram AI art (card-inspired) → usageClass='commercial_ok'
```

## Thumbnail Generation (4 Variants)

```typescript
// Variants A+B: Ideogram V3 via Fal.ai ($0.03/image, 95%+ text accuracy)
const ideogramPrompt = `Professional Pokemon TCG YouTube thumbnail.
Feature ${cardName} card with holographic foil effect and metallic sheen.
Large bold text: '${cardName}' in gold metallic lettering.
Red price banner: 'PRICE DROP $${oldPrice}→$${newPrice}' in white bold sans-serif.
Background: dark gradient, TCG rarity sparkle effects. 1280×720. High contrast.`;

// Variants C+D: DALL-E 3 via OpenAI ($0.04/image)
// Standard 1024×1024 + HD 1792×1024

// Post all 4 to #thumbnail-lab, Pryce selects
```

**Pokemon TCG Copyright Rule:** NEVER use pokemontcg.io card image scans as thumbnails.
Use Ideogram V3 to generate ORIGINAL card-inspired artwork + text overlays.

## Video Assembly Decision Tree

```
IF clips < 20 AND duration < 600s AND memory > 4GB:
  → Remotion + FFmpeg (primary — deterministic, testable, diffable)
ELSE IF duration < 1800s:
  → FFmpeg only (lighter footprint)
ELSE:
  → Shotstack API (cloud, 20 min/mo free, $49/mo paid)
```

## Video Idempotency

```
Format: pokemon-tcg-video-{SHA256(signalId+scriptVersion).slice(0,16)}-{YYYY-MM-DD}
TTL: 24h | Within TTL: 409 Conflict (skip re-run) | After TTL: allow re-run
```

## Approval Gate (ADR-014 — IMMUTABLE)

```
VideoOutputPackage → #video-queue (embed + ✅/❌ button, 48h TTL)
Pryce clicks ✅ → YouTube upload via YouTube Data API v3
Pryce clicks ❌ → script goes to revision
TTL expires → job = 'expired', no action
```

**NOVA NEVER auto-publishes to YouTube. Ever.**

## Daily Output Contract

- 1 long-form video package → #video-queue (pending ✅)
- 3-8 clip derivatives
- 4 thumbnail variants → #thumbnail-lab
- 1 midday market script + report → #pokemon-market
- Captions (.vtt) + SEO metadata

## Rate Limiting (pokemontcg.io)

```
Max: 1000 req/day with POKEMON_TCG_API_KEY
Strategy: Token bucket at 800 req/day (20% safety margin)
Backoff: min(2^n × 1000 + rand(0,500), 30000)ms
Alert: emit budget:95pct-warning at 950/1000 daily quota
```

## Environment Variables

```
POKEMON_TCG_API_KEY     # Higher rate limits
FAL_API_KEY             # Ideogram V3 thumbnails
OPENAI_API_KEY          # DALL-E 3 fallback + Whisper ASR
ELEVENLABS_API_KEY      # Voice narration (if enabled)
SERPAPI_KEY             # eBay sold listings research
X_BEARER_TOKEN          # Community signal tracking
REDDIT_CLIENT_ID/SECRET # r/PokemonTCG, r/pokemontrades
```
