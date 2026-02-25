---
name: ari-thumbnail-generation
description: NOVA's thumbnail generation pipeline — Ideogram V3 via Fal.ai (primary) + DALL-E 3 fallback, 4-variant strategy, Pokemon TCG copyright rules, #thumbnail-lab routing
triggers: ["thumbnail", "nova thumbnail", "ideogram", "dall-e", "fal.ai", "youtube thumbnail", "thumbnail lab", "card image copyright"]
---

# ARI Thumbnail Generation (P1 — NOVA)

## Overview

NOVA generates 4 thumbnail variants per video using a two-provider strategy.

**Primary:** Ideogram V3 via Fal.ai — 95%+ text rendering accuracy, $0.03/image, best for Pokemon TCG content
**Fallback:** DALL-E 3 via OpenAI — $0.04/image, excellent text rendering, wide format available

**Monthly cost:** 30 videos × 4 variants = 120 images × avg $0.035 = ~$4.20/month (negligible)

## 4-Variant Strategy Per Video

| Variant | Provider | Style | Dimensions | Focus |
|---------|---------|-------|-----------|-------|
| A | Ideogram V3 | "Design" | 16:9 | Price-focused overlay |
| B | Ideogram V3 | "Realistic" | 16:9 | Card aesthetic, dramatic lighting |
| C | DALL-E 3 | Standard | 1024×1024 | Clean text, price comparison |
| D | DALL-E 3 | HD | 1792×1024 | Wide format, premium content |

After generation: all 4 posted to #thumbnail-lab in Discord. Pryce selects favorite.
NOVA sets selected variant as the video thumbnail before YouTube upload.

## Ideogram V3 Production Prompt Template

```
Style: Design | Aspect: 16:9 | Quality: Balanced

"Professional Pokemon TCG YouTube thumbnail. Feature [CARD_NAME]
card with holographic foil effect and metallic sheen.
Large bold text: '[CARD_NAME]' in gold metallic lettering.
Red price banner at bottom: 'PRICE DROP $[OLD]→$[NEW]'
in white bold sans-serif, highly legible.
Background: dark gradient with collectible card atmosphere,
dramatic spotlight lighting, TCG rarity sparkle effects.
1280×720 YouTube thumbnail, high contrast, eye-catching colors."
```

For Variant B (Realistic):
- Same prompt, change `Style: Design` to `Style: Realistic`
- Emphasize "dramatic lighting" and "holographic card texture"

## DALL-E 3 Prompt Template

```
"YouTube thumbnail for Pokemon Trading Card listing.
Center: [CARD_NAME] holographic card with dramatic lighting.
Top: '[CARD_NAME]' in large bright gold text.
Bottom red banner: 'PRICE DROP $[OLD]→$[NEW]' in bold white,
highly readable, sans-serif font.
Dark background with TCG marketplace aesthetic.
Professional card collector community style."

Standard: size='1024x1024', quality='standard'
HD (Variant D): size='1792x1024', quality='hd'
```

## TypeScript Implementation

```typescript
import { FalClient } from '@fal-ai/client';
import OpenAI from 'openai';

const fal = new FalClient({ credentials: process.env.FAL_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateThumbnailVariants(spec: ThumbnailSpec): Promise<ThumbnailVariants> {
  // A+B: Ideogram V3 in parallel
  const [variantA, variantB] = await Promise.all([
    fal.run('fal-ai/ideogram/v3', {
      prompt: buildIdeogramPrompt(spec, 'Design'),
      aspect_ratio: '16:9',
      style: 'DESIGN',
    }),
    fal.run('fal-ai/ideogram/v3', {
      prompt: buildIdeogramPrompt(spec, 'Realistic'),
      aspect_ratio: '16:9',
      style: 'REALISTIC',
    }),
  ]);

  // C+D: DALL-E 3 in parallel
  const [variantC, variantD] = await Promise.all([
    openai.images.generate({
      model: 'dall-e-3',
      prompt: buildDallEPrompt(spec),
      size: '1024x1024',
      quality: 'standard',
    }),
    openai.images.generate({
      model: 'dall-e-3',
      prompt: buildDallEPrompt(spec),
      size: '1792x1024',
      quality: 'hd',
    }),
  ]);

  return { variantA, variantB, variantC, variantD };
}

interface ThumbnailSpec {
  cardName: string;
  oldPrice: number;
  newPrice: number;
  rarity: string;
  setName: string;
}
```

## Pokemon TCG Copyright Rules

**CRITICAL:** Pokemon Company prohibits commercial republication of card images.

| Approach | Risk | Rule |
|----------|------|------|
| Ideogram V3 card-inspired AI art | LOW | ✅ SAFE — original AI generation |
| Card name + price as text overlay | NONE | ✅ SAFE — text not copyrightable |
| pokemontcg.io card image scans as thumbnail | HIGH | ❌ PROHIBITED — DMCA risk |
| Ideogram using card color palette reference | LOW-MEDIUM | ✅ SAFE — transformative |

**NOVA's rule:** Generate ORIGINAL AI artwork inspired by card aesthetics. Never embed raw card image scans.

**If YouTube Content ID flags a video:** Remove all card image references immediately. Use pure AI-generated card-inspired backgrounds.

## Rights Gate (runs before thumbnail upload)

```typescript
interface AssetRights {
  origin: 'generated';          // Thumbnails are always 'generated'
  usageClass: 'commercial_ok';  // AI-generated = commercial_ok
}
// Thumbnails using Ideogram/DALL-E always pass this gate
// Raw pokemontcg.io scans would fail (usageClass = 'restricted')
```

## Discord #thumbnail-lab Routing

After generation:
1. NOVA downloads all 4 images (or gets URLs)
2. Posts embed to #thumbnail-lab with all 4 variants as attachments
3. Embed includes: video job ID, card name, price movement, "Reply with A/B/C/D to select"
4. Pryce replies or reacts to select
5. NOVA records selection: `jobs.selected_thumbnail_variant = 'A'`
6. Selected variant used as YouTube thumbnail on approval

## Environment Variables

```
FAL_API_KEY          # Ideogram V3 via Fal.ai
OPENAI_API_KEY       # DALL-E 3 via OpenAI API (same key as Whisper + Codex)
```
