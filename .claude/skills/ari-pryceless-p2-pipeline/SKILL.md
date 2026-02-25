---
name: ari-pryceless-p2-pipeline
description: CHASE's P2 Pryceless Solutions pipeline — lead discovery, 5-criteria audit, LLM qualification, Prompt Forge 4-pass lock, demo generation, outreach approval gate
triggers: ["chase", "pryceless", "p2 pipeline", "lead discovery", "prompt forge", "outreach queue", "indiana leads", "website audit"]
---

# ARI P2: Pryceless Solutions Lead Engine

**Agent:** CHASE 🎯 | **Plane:** APEX | **Model:** claude-sonnet-4-6

## Weekly Trigger

Runs Monday 14:00 ET. Manual trigger: `/ari-p2-scan`

## Lead Discovery Quality Loop (Ralph-Style Agentic Iteration)

CHASE uses an iterative lead quality gate — keeps expanding search until a minimum
viable batch of hot leads is assembled. Same principle as Ralph Wiggum: the same task
is fed again with feedback from the previous attempt until success criteria are met.

```typescript
const MIN_HOT_LEADS   = 3;   // Minimum hot (≥75) leads per weekly batch
const MIN_WARM_LEADS  = 5;   // Minimum warm (50-75) leads
const MAX_LEAD_RETRIES = 3;  // Max expansion rounds before escalating to ARI

async function discoverLeadsWithQualityLoop(): Promise<Lead[]> {
  let attempt = 0;
  let allLeads: Lead[] = [];
  let searchRadius = 25; // miles — expands on retry

  while (attempt < MAX_LEAD_RETRIES) {
    attempt++;

    const batch = await chase.discoverLeads({ radius: searchRadius, ...params });
    allLeads = [...allLeads, ...batch];

    const hot  = allLeads.filter((l) => l.score >= 75).length;
    const warm = allLeads.filter((l) => l.score >= 50 && l.score < 75).length;

    if (hot >= MIN_HOT_LEADS && warm >= MIN_WARM_LEADS) break; // quality threshold met

    // Expand search radius and add adjacent verticals on retry
    searchRadius += 15;
  }

  if (allLeads.filter((l) => l.score >= 75).length < MIN_HOT_LEADS) {
    // Escalate to ARI — couldn't meet minimum quality
    emit('pryceless:lead-quality-warning', { week: currentWeek, hotCount: allLeads.filter(l => l.score >= 75).length });
  }

  return allLeads;
}
```

## Step 1: Lead Discovery

```typescript
// Discovery stack:
// SerpAPI Google Local ($0.005/search) — Indiana/Southern Indiana
// Apollo.io (free tier: 100-200 credits/mo) — enrichment
// Google Business Profile API (free, OAuth) — verification
// Google Maps API (~$8/mo) — geographic radius filtering

const discoveryParams = {
  verticals: process.env.ARI_P2_TARGET_VERTICALS?.split(',') ?? ['restaurant', 'hvac', 'retail', 'dental', 'plumbing'],
  locations: process.env.ARI_P2_PRIORITY_LOCATIONS?.split(',') ?? ['Evansville', 'Newburgh', 'Henderson'],
  serpSourceWeight: parseFloat(process.env.ARI_P2_SOURCE_WEIGHT_SERPAPI ?? '0.6'),
  apolloSourceWeight: parseFloat(process.env.ARI_P2_SOURCE_WEIGHT_APOLLO ?? '0.3'),
};
```

## Step 2: 5-Criteria Audit (minimum 40/100 to proceed)

```typescript
interface AuditResult {
  totalScore: number;        // 0-100 weighted average
  passAudit: boolean;        // totalScore >= 40
  criteria: {
    seoQuality: {            // Weight: 20%
      score: 0 | 25 | 50 | 75 | 100;
      hasMetaTags: boolean;
      isHttps: boolean;
      isMobileFriendly: boolean;
    };
    contactAccessibility: { // Weight: 25%
      score: 0 | 25 | 50 | 75 | 100;
      hasContactForm: boolean;
      hasPhone: boolean;
      contactAboveFold: boolean;
    };
    digitalPresence: {       // Weight: 20%
      score: 0 | 25 | 50 | 75 | 100;
      gbpVerified: boolean;
      hasSocialLinks: boolean;
      lastActivityDays: number;
    };
    ctaClarity: {            // Weight: 20%
      score: 0 | 25 | 50 | 75 | 100;
      primaryCtaIdentifiable: boolean;
      ctaButtonPresent: boolean;
      valuePropositionClear: boolean;
    };
    businessSignals: {       // Weight: 15%
      score: 0 | 25 | 50 | 75 | 100;
      hasLegitimateDescription: boolean;
      industryKeywordsMatch: boolean;
      reviewCountGbp: number;
    };
  };
}
// totalScore < 40 → dropped to cold bucket, no further processing
```

## Step 3: LLM Qualification (CHASE — Sonnet 4.6)

```
Phase 1: Firmographics, tech stack, digital presence assessment
Phase 2: ICP fit assessment (Pryceless target profile)
Phase 3: Score 0-100
  Hot ≥75 → auto-advance to Prompt Forge
  Warm 50-75 → flag to #leads for Pryce review
  Cold <50 → drop silently
```

## Step 4: Prompt Forge 4-Pass Lock (MANDATORY)

```typescript
// PASS 1: Evidence Synthesis
interface EvidenceSynthesis {
  firmographics: Record<string, unknown>;
  digitalPresence: Record<string, unknown>;
  painPoints: Array<{ description: string; evidenceId: string }>; // ≥3 required
  strengths: string[];
}
// Gate: painPoints.length >= 3 with evidenceIds

// PASS 2: Offer-Fit Mapping
interface OfferMapping {
  primaryOffer: { description: string; evidenceIds: string[] };  // ≥2 evidenceIds
  secondaryOffer: { description: string; evidenceIds: string[] };
  conversionObjective: string;
}
// Gate: primaryOffer.evidenceIds.length >= 2

// PASS 3: Critic Pass
interface CriticResult {
  verdict: 'approved' | 'needs_revision' | 'rejected';
  rejectedClaims: string[];
  icpScore: number;  // Must be ≥70
}
// Gate: verdict='approved' AND icpScore >= 70

// PASS 4: Lock
interface PromptForgeBundle {
  bundleId: string;
  contentHash: string;  // SHA256 of all evidence + offer text
  locked: true;
  expiresAt: string;    // created_at + 7 days
}

// REJECTION RECOVERY:
// IF PASS 3 rejects:
// 1. Emit: pryceless:forge-rejected { leadId, failedCriteria, suggestedRevision }
// 2. CHASE retries PASS 2+3 within 1h with refined evidence
// 3. IF 2 retries fail: escalate to ARI with specific gap identified
```

## Step 5: Demo Builder

Static HTML scaffold — audit-aware, zero unverified claims.
Every element in the demo references an auditResult finding.
CHASE builds the content; RUNE handles any technical assembly.

## Step 6: Outreach Draft

```
Opening: ONE specific verified fact about the business (not a compliment — a finding)
Offer: What Pryceless Solutions fixes (1-2 sentences max)
Proof: Reference to demo or audit finding with specific number
CTA: 10-minute call or demo link — single clear ask
```

Every claim → evidenceId. No generic openers.

## Step 7: Approval Gate (MANDATORY)

```
#outreach-queue → embed with ✅/❌ buttons (72h TTL)
Pryce clicks ✅ → outreach sent
Pryce clicks ❌ → lead dropped to cold bucket
TTL expires → job = 'expired', outreach is NEVER auto-sent
```

**CHASE NEVER sends outreach without explicit approval. Ever.**

## Learning Loop

```bash
# After lead closes:
/ari-p2-feedback {lead_id} {outcome}

# Outcomes: meeting | demo | closed_won | closed_lost | no_response | unqualified
# CHASE uses this to improve vertical scoring and offer-fit mapping
```

## Job Idempotency

```
Format: pryceless-outreach-{SHA256(leadId+bundleId).slice(0,16)}-{YYYY-MM-DD}
TTL: 24h | Within TTL: 409 Conflict | After TTL: allow re-run
```

## Environment Variables

```
SERPAPI_KEY                      # Lead discovery ($0.005/search)
APOLLO_API_KEY                   # Lead enrichment (free 100-200/mo)
GOOGLE_MAPS_API_KEY              # Geographic filtering (~$8/mo)
ARI_P2_TARGET_VERTICALS          # Comma-separated: 'restaurant,hvac,retail'
ARI_P2_PRIORITY_LOCATIONS        # Comma-separated: 'Evansville,Newburgh'
ARI_P2_SOURCE_WEIGHT_SERPAPI     # 0.0-1.0 (default: 0.6)
ARI_P2_SOURCE_WEIGHT_APOLLO      # 0.0-1.0 (default: 0.3)
PERPLEXITY_API_KEY               # Sonar Deep Research for vertical qualify
```
