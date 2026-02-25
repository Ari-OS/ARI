# Pipeline Conventions

## P1 — PayThePryce (NOVA 🎬)

**Data sources (all free):**
- pokemontcg.io — official TCGPlayer pricing (no scraping needed)
- pokewallet.io — real-time deltas every 2h
- X API / Reddit snoowrap — community sentiment signals

**Pipeline phases:**
1. Ingest → `MarketSignalEnvelope` with `reliabilityWeight`
2. Script gen: Haiku draft → Sonnet polish → every claim has `evidenceId`
3. Confidence gate: ≥0.95 auto-advance | 0.80-0.95 human review | <0.80 reject
4. Rights gate (MANDATORY): every asset needs `usageClass: commercial_ok|licensed|generated`
5. Thumbnail: Ideogram V3 (Fal.ai) → DALL-E 3 fallback → 4 variants → #thumbnail-lab
6. Video assembly → #video-queue for Pryce approval

**ADR-014**: NEVER auto-publish to YouTube. Pryce must approve via Discord button.

## P2 — Pryceless Solutions (CHASE 🎯)

**Discovery stack:** SerpAPI + Apollo.io + Google Business Profile + Google Maps

**Pipeline phases:**
1. Discovery → score with `verticalSegment × localityTier × digitalPresence`
2. Audit Worker (5-criteria, totalScore ≥ 40 to proceed)
3. LLM qualification (Phases 1-3): Hot ≥75 | Warm 50-75 | Cold <50
4. Prompt Forge 4-pass lock (MANDATORY): Evidence → Offer → Critic → Lock
5. Demo Builder: static HTML, audit-aware, zero unverified claims
6. → #outreach-queue for Pryce approval; NEVER auto-send

## Audit Worker — 5 Criteria

| Criterion | Weight | Pass |
|-----------|--------|------|
| seoQuality | 20% | HTTPS + mobile friendly + meta tags |
| contactAccessibility | 25% | Phone + email + form visible |
| digitalPresence | 20% | GBP verified + social links |
| ctaClarity | 20% | CTA identifiable + value prop clear |
| businessSignals | 15% | Legit description + reviews |

Minimum total score: 40/100 to proceed. Below 40 → cold bucket silently.

## Prompt Forge 4-Pass Lock

```
PASS 1: Evidence Synthesis  — ≥3 pain points each with evidenceId
PASS 2: Offer-Fit Mapping   — primary offer cites ≥2 evidenceIds
PASS 3: Critic Pass         — verdict='approved' AND icpScore ≥70
PASS 4: Prompt Lock         — SHA-256 bundle, expiresAt +7days
```

Locked bundles: any modification → 'locked bundle violation' error. Expired = re-run from PASS 1.

## Idempotency Contract

Format: `{pipeline}-{type}-{SHA256(sortedInputs).slice(0,16)}-{YYYY-MM-DD}`
TTL: 24h | Within TTL → 409 Conflict | After TTL → allow re-run

## Governance Gates (IMMUTABLE)

- `auto`: low-risk ARI operations (with audit trace)
- `approval-required`: any publish, outreach, or external communication
- `operator-only`: irreversible actions (slash command from Pryce required)
