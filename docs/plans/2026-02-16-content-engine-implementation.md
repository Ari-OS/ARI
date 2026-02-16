# Content Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Phase 1 of the Content Engine plugin — ARI transforms intelligence into platform-specific content drafts, managed via Telegram, published to X/LinkedIn.

**Architecture:** New `DomainPlugin` at `src/plugins/content-engine/` following the crypto/pokemon plugin pattern. Uses `AIOrchestrator.chat()` for content generation, persists drafts as JSON files under `~/.ari/content/`, exposes Telegram commands via the existing bot.ts command router, extends the X client with write methods.

**Tech Stack:** TypeScript 5.3, Zod for validation, Vitest for tests, grammY for Telegram, X API v2 for publishing, `node:fs/promises` for persistence.

**Design doc:** `docs/plans/2026-02-16-content-engine-design.md`

---

## Task 1: Content Engine Types

Create Zod schemas and types for the entire content engine domain.

**Files:**
- Create: `src/plugins/content-engine/types.ts`
- Test: `tests/unit/plugins/content-engine/types.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/plugins/content-engine/types.test.ts
import { describe, it, expect } from 'vitest';
import {
  ContentDraftSchema,
  ContentTemplateSchema,
  DraftStatusSchema,
  ContentPlatformSchema,
  TopicBriefSchema,
  ContentEngineConfigSchema,
} from '../../../../src/plugins/content-engine/types.js';

describe('Content Engine Types', () => {
  describe('DraftStatusSchema', () => {
    it('should accept valid statuses', () => {
      expect(DraftStatusSchema.parse('pending')).toBe('pending');
      expect(DraftStatusSchema.parse('sent_for_review')).toBe('sent_for_review');
      expect(DraftStatusSchema.parse('approved')).toBe('approved');
      expect(DraftStatusSchema.parse('edited')).toBe('edited');
      expect(DraftStatusSchema.parse('rejected')).toBe('rejected');
      expect(DraftStatusSchema.parse('published')).toBe('published');
      expect(DraftStatusSchema.parse('archived')).toBe('archived');
    });

    it('should reject invalid status', () => {
      expect(() => DraftStatusSchema.parse('invalid')).toThrow();
    });
  });

  describe('ContentPlatformSchema', () => {
    it('should accept valid platforms', () => {
      expect(ContentPlatformSchema.parse('x_thread')).toBe('x_thread');
      expect(ContentPlatformSchema.parse('x_single')).toBe('x_single');
      expect(ContentPlatformSchema.parse('linkedin')).toBe('linkedin');
      expect(ContentPlatformSchema.parse('blog_outline')).toBe('blog_outline');
      expect(ContentPlatformSchema.parse('quick_take')).toBe('quick_take');
    });
  });

  describe('TopicBriefSchema', () => {
    it('should parse a valid topic brief', () => {
      const brief = TopicBriefSchema.parse({
        headline: 'Claude 4.6 drops with computer use',
        keyPoints: ['Faster than 4.5', 'Computer use built-in'],
        angle: 'How solo devs can leverage computer use for automation',
        targetPlatform: 'x_thread',
        sourceItemIds: ['intel-123'],
        threadabilityScore: 85,
      });
      expect(brief.headline).toBe('Claude 4.6 drops with computer use');
      expect(brief.targetPlatform).toBe('x_thread');
    });

    it('should require headline and keyPoints', () => {
      expect(() => TopicBriefSchema.parse({})).toThrow();
    });
  });

  describe('ContentDraftSchema', () => {
    it('should parse a valid draft', () => {
      const draft = ContentDraftSchema.parse({
        id: 'draft-2026-02-16-001',
        topicBrief: {
          headline: 'Test topic',
          keyPoints: ['Point 1'],
          angle: 'Technical angle',
          targetPlatform: 'x_thread',
          sourceItemIds: ['intel-1'],
          threadabilityScore: 70,
        },
        platform: 'x_thread',
        content: ['Hook tweet', 'Body tweet 1', 'CTA tweet'],
        status: 'pending',
        createdAt: '2026-02-16T07:00:00Z',
      });
      expect(draft.id).toBe('draft-2026-02-16-001');
      expect(draft.status).toBe('pending');
      expect(draft.content).toHaveLength(3);
    });

    it('should default metadata to empty object', () => {
      const draft = ContentDraftSchema.parse({
        id: 'draft-001',
        topicBrief: {
          headline: 'Test',
          keyPoints: ['P1'],
          angle: 'A',
          targetPlatform: 'linkedin',
          sourceItemIds: [],
          threadabilityScore: 50,
        },
        platform: 'linkedin',
        content: ['Post text'],
        status: 'pending',
        createdAt: '2026-02-16T07:00:00Z',
      });
      expect(draft.metadata).toEqual({});
    });
  });

  describe('ContentTemplateSchema', () => {
    it('should parse a valid template', () => {
      const template = ContentTemplateSchema.parse({
        id: 'x-thread',
        platform: 'x_thread',
        systemPrompt: 'You are @PayThePryce...',
        formatInstructions: 'Write a hook + 5-7 body tweets + CTA',
        maxLength: 2240,
        examples: ['Example thread...'],
      });
      expect(template.id).toBe('x-thread');
    });
  });

  describe('ContentEngineConfigSchema', () => {
    it('should provide sensible defaults', () => {
      const config = ContentEngineConfigSchema.parse({});
      expect(config.draftsPerDay).toBe(3);
      expect(config.autoSendForReview).toBe(true);
      expect(config.publishingEnabled).toBe(false);
      expect(config.platforms).toEqual(['x_thread', 'linkedin']);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/plugins/content-engine/types.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/plugins/content-engine/types.ts
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// Draft lifecycle
// ═══════════════════════════════════════════════════════════════════════════════

export const DraftStatusSchema = z.enum([
  'pending',         // Just generated
  'sent_for_review', // Sent to Telegram
  'approved',        // Pryce approved
  'edited',          // Pryce requested edits
  'rejected',        // Pryce rejected
  'published',       // Posted to platform
  'archived',        // Done
]);
export type DraftStatus = z.infer<typeof DraftStatusSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Content platforms
// ═══════════════════════════════════════════════════════════════════════════════

export const ContentPlatformSchema = z.enum([
  'x_thread',      // Twitter/X thread (hook + body + CTA)
  'x_single',      // Single tweet (quick take)
  'linkedin',      // LinkedIn post
  'blog_outline',  // Blog outline (title + H2s + key points)
  'quick_take',    // 1-2 sentence insight
]);
export type ContentPlatform = z.infer<typeof ContentPlatformSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Topic brief (output of trend analyzer)
// ═══════════════════════════════════════════════════════════════════════════════

export const TopicBriefSchema = z.object({
  headline: z.string().min(1),
  keyPoints: z.array(z.string()).min(1),
  angle: z.string().min(1),
  targetPlatform: ContentPlatformSchema,
  sourceItemIds: z.array(z.string()),
  threadabilityScore: z.number().min(0).max(100),
});
export type TopicBrief = z.infer<typeof TopicBriefSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Content draft
// ═══════════════════════════════════════════════════════════════════════════════

export const ContentDraftSchema = z.object({
  id: z.string().min(1),
  topicBrief: TopicBriefSchema,
  platform: ContentPlatformSchema,
  content: z.array(z.string()).min(1), // Array of tweets for threads, single-element for others
  status: DraftStatusSchema,
  createdAt: z.string(),
  reviewedAt: z.string().optional(),
  publishedAt: z.string().optional(),
  publishedIds: z.array(z.string()).optional(), // Tweet IDs, LinkedIn post ID, etc.
  rejectionReason: z.string().optional(),
  editRequests: z.array(z.string()).default([]),
  modelUsed: z.string().optional(),
  costUsd: z.number().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type ContentDraft = z.infer<typeof ContentDraftSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Content template (voice + format guidance per platform)
// ═══════════════════════════════════════════════════════════════════════════════

export const ContentTemplateSchema = z.object({
  id: z.string().min(1),
  platform: ContentPlatformSchema,
  systemPrompt: z.string().min(1),
  formatInstructions: z.string().min(1),
  maxLength: z.number().positive(),
  examples: z.array(z.string()).default([]),
});
export type ContentTemplate = z.infer<typeof ContentTemplateSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Plugin config
// ═══════════════════════════════════════════════════════════════════════════════

export const ContentEngineConfigSchema = z.object({
  draftsPerDay: z.number().min(1).max(10).default(3),
  autoSendForReview: z.boolean().default(true),
  publishingEnabled: z.boolean().default(false), // Must be explicitly enabled
  platforms: z.array(ContentPlatformSchema).default(['x_thread', 'linkedin']),
  minThreadabilityScore: z.number().min(0).max(100).default(60),
  voiceProfile: z.object({
    persona: z.string().default('@PayThePryce'),
    tone: z.string().default('pragmatic builder, technical but accessible'),
    audience: z.string().default('solo devs, indie hackers, small business owners interested in AI'),
    style: z.string().default('direct, no fluff, actionable takeaways'),
    avoids: z.string().default('corporate jargon, hype without substance'),
  }).default({}),
});
export type ContentEngineConfig = z.infer<typeof ContentEngineConfigSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Platform constraints
// ═══════════════════════════════════════════════════════════════════════════════

export const PLATFORM_CONSTRAINTS: Record<ContentPlatform, { maxChars: number; maxParts: number }> = {
  x_thread: { maxChars: 280, maxParts: 8 },
  x_single: { maxChars: 280, maxParts: 1 },
  linkedin: { maxChars: 1300, maxParts: 1 },
  blog_outline: { maxChars: 3000, maxParts: 1 },
  quick_take: { maxChars: 280, maxParts: 1 },
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/plugins/content-engine/types.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/plugins/content-engine/types.ts tests/unit/plugins/content-engine/types.test.ts
git commit -m "feat(content-engine): add Zod schemas for drafts, templates, and config"
```

---

## Task 2: Extend EventBus with Content Engine Events

Add typed events for the content pipeline to the EventMap.

**Files:**
- Modify: `src/kernel/event-bus.ts` (EventMap interface)
- Test: `tests/unit/plugins/content-engine/events.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/plugins/content-engine/events.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../../../src/kernel/event-bus.js';

describe('Content Engine Events', () => {
  it('should emit and receive content:draft_generated', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('content:draft_generated', handler);

    bus.emit('content:draft_generated', {
      draftId: 'draft-001',
      platform: 'x_thread',
      topicHeadline: 'AI agents are here',
      costUsd: 0.02,
    });

    expect(handler).toHaveBeenCalledWith({
      draftId: 'draft-001',
      platform: 'x_thread',
      topicHeadline: 'AI agents are here',
      costUsd: 0.02,
    });
  });

  it('should emit and receive content:draft_reviewed', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('content:draft_reviewed', handler);

    bus.emit('content:draft_reviewed', {
      draftId: 'draft-001',
      action: 'approved',
    });

    expect(handler).toHaveBeenCalledWith({
      draftId: 'draft-001',
      action: 'approved',
    });
  });

  it('should emit and receive content:published', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('content:published', handler);

    bus.emit('content:published', {
      draftId: 'draft-001',
      platform: 'x_thread',
      publishedIds: ['tweet-1', 'tweet-2'],
    });

    expect(handler).toHaveBeenCalledWith({
      draftId: 'draft-001',
      platform: 'x_thread',
      publishedIds: ['tweet-1', 'tweet-2'],
    });
  });

  it('should emit and receive content:trend_analyzed', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('content:trend_analyzed', handler);

    bus.emit('content:trend_analyzed', {
      topicCount: 3,
      topDomains: ['ai', 'programming'],
    });

    expect(handler).toHaveBeenCalledWith({
      topicCount: 3,
      topDomains: ['ai', 'programming'],
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/plugins/content-engine/events.test.ts`
Expected: FAIL — TypeScript errors on unrecognized event names

**Step 3: Add events to EventMap**

In `src/kernel/event-bus.ts`, find the existing content events (`content:draft_created`, `content:approved`) and extend the section. Add these entries to the `EventMap` interface:

```typescript
// Content Engine pipeline events
'content:trend_analyzed': { topicCount: number; topDomains: string[] };
'content:draft_generated': { draftId: string; platform: string; topicHeadline: string; costUsd: number };
'content:draft_reviewed': { draftId: string; action: 'approved' | 'edited' | 'rejected'; reason?: string };
'content:published': { draftId: string; platform: string; publishedIds: string[] };
'content:publish_failed': { draftId: string; platform: string; error: string };
```

Note: Keep the existing `content:draft_created` and `content:approved` events as-is for backward compatibility. The new events are more granular.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/plugins/content-engine/events.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/kernel/event-bus.ts tests/unit/plugins/content-engine/events.test.ts
git commit -m "feat(content-engine): add typed EventBus events for content pipeline"
```

---

## Task 3: Trend Analyzer

Scores intelligence items for "threadability" and produces topic briefs.

**Files:**
- Create: `src/plugins/content-engine/trend-analyzer.ts`
- Test: `tests/unit/plugins/content-engine/trend-analyzer.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/plugins/content-engine/trend-analyzer.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TrendAnalyzer } from '../../../../src/plugins/content-engine/trend-analyzer.js';
import type { IntelligenceItem } from '../../../../src/autonomous/intelligence-scanner.js';
import type { ContentEngineConfig } from '../../../../src/plugins/content-engine/types.js';

function makeItem(overrides: Partial<IntelligenceItem> = {}): IntelligenceItem {
  return {
    id: 'item-1',
    title: 'Claude 4.6 Released with Computer Use',
    summary: 'Anthropic releases Claude 4.6 with built-in computer use capabilities',
    url: 'https://example.com/article',
    source: 'techcrunch',
    sourceCategory: 'tech_news',
    domains: ['ai'],
    score: 85,
    scoreBreakdown: {
      relevance: 25,
      authority: 18,
      recency: 18,
      engagement: 12,
      novelty: 12,
    },
    fetchedAt: new Date().toISOString(),
    contentHash: 'abc123',
    ...overrides,
  };
}

describe('TrendAnalyzer', () => {
  let analyzer: TrendAnalyzer;
  const defaultConfig: ContentEngineConfig = {
    draftsPerDay: 3,
    autoSendForReview: true,
    publishingEnabled: false,
    platforms: ['x_thread', 'linkedin'],
    minThreadabilityScore: 60,
    voiceProfile: {
      persona: '@PayThePryce',
      tone: 'pragmatic builder',
      audience: 'solo devs',
      style: 'direct',
      avoids: 'corporate jargon',
    },
  };

  beforeEach(() => {
    analyzer = new TrendAnalyzer(defaultConfig);
  });

  describe('analyze', () => {
    it('should filter items below score threshold', () => {
      const items: IntelligenceItem[] = [
        makeItem({ id: 'high', score: 85, domains: ['ai'] }),
        makeItem({ id: 'low', score: 40, domains: ['ai'] }),
      ];

      const briefs = analyzer.analyze(items);
      const sourceIds = briefs.flatMap((b) => b.sourceItemIds);
      expect(sourceIds).toContain('high');
      expect(sourceIds).not.toContain('low');
    });

    it('should return at most draftsPerDay briefs', () => {
      const items: IntelligenceItem[] = Array.from({ length: 10 }, (_, i) =>
        makeItem({
          id: `item-${i}`,
          score: 90 - i,
          domains: ['ai'],
          title: `Article ${i}`,
        }),
      );

      const briefs = analyzer.analyze(items);
      expect(briefs.length).toBeLessThanOrEqual(defaultConfig.draftsPerDay);
    });

    it('should pick diverse domains when possible', () => {
      const items: IntelligenceItem[] = [
        makeItem({ id: 'ai-1', score: 90, domains: ['ai'], title: 'AI Topic 1' }),
        makeItem({ id: 'ai-2', score: 88, domains: ['ai'], title: 'AI Topic 2' }),
        makeItem({ id: 'biz-1', score: 85, domains: ['business'], title: 'Business Topic' }),
        makeItem({ id: 'prog-1', score: 80, domains: ['programming'], title: 'Programming Topic' }),
      ];

      const briefs = analyzer.analyze(items);
      const domains = briefs.map((b) => b.targetPlatform);
      // Should pick from different source domains, not just top AI items
      const sourceItems = briefs.flatMap((b) => b.sourceItemIds);
      expect(sourceItems).toContain('ai-1');
      expect(sourceItems).toContain('biz-1');
    });

    it('should assign appropriate platforms based on content type', () => {
      const items: IntelligenceItem[] = [
        makeItem({ id: 'ai-1', score: 90, domains: ['ai'], title: 'Breaking: Claude 4.6' }),
      ];

      const briefs = analyzer.analyze(items);
      expect(briefs.length).toBeGreaterThan(0);
      expect(briefs[0].threadabilityScore).toBeGreaterThanOrEqual(0);
      expect(briefs[0].threadabilityScore).toBeLessThanOrEqual(100);
    });

    it('should return empty array for no qualifying items', () => {
      const items: IntelligenceItem[] = [
        makeItem({ id: 'low', score: 20, domains: ['general'] }),
      ];

      const briefs = analyzer.analyze(items);
      expect(briefs).toEqual([]);
    });

    it('should only include items from relevant domains', () => {
      const items: IntelligenceItem[] = [
        makeItem({ id: 'ai-item', score: 85, domains: ['ai'] }),
        makeItem({ id: 'general-only', score: 85, domains: ['general'] }),
      ];

      const briefs = analyzer.analyze(items);
      const sourceIds = briefs.flatMap((b) => b.sourceItemIds);
      // 'general' alone should score lower for threadability
      // ai/programming/business/tools are the strong domains
      expect(sourceIds).toContain('ai-item');
    });
  });

  describe('scoreThreadability', () => {
    it('should score high for novel AI content', () => {
      const item = makeItem({ score: 90, domains: ['ai'], scoreBreakdown: {
        relevance: 28, authority: 18, recency: 19, engagement: 13, novelty: 14,
      }});
      const score = analyzer.scoreThreadability(item);
      expect(score).toBeGreaterThan(70);
    });

    it('should score low for old general content', () => {
      const item = makeItem({ score: 55, domains: ['general'], scoreBreakdown: {
        relevance: 10, authority: 10, recency: 5, engagement: 5, novelty: 5,
      }});
      const score = analyzer.scoreThreadability(item);
      expect(score).toBeLessThan(60);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/plugins/content-engine/trend-analyzer.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/plugins/content-engine/trend-analyzer.ts
import type { IntelligenceItem } from '../../autonomous/intelligence-scanner.js';
import type { ContentEngineConfig, ContentPlatform, TopicBrief } from './types.js';

const THREADABLE_DOMAINS = new Set(['ai', 'programming', 'business', 'tools']);

export class TrendAnalyzer {
  private config: ContentEngineConfig;

  constructor(config: ContentEngineConfig) {
    this.config = config;
  }

  analyze(items: IntelligenceItem[]): TopicBrief[] {
    // Filter by minimum score
    const qualifying = items.filter((item) => item.score >= this.config.minThreadabilityScore);

    // Score threadability
    const scored = qualifying
      .map((item) => ({ item, threadability: this.scoreThreadability(item) }))
      .filter(({ threadability }) => threadability >= this.config.minThreadabilityScore)
      .sort((a, b) => b.threadability - a.threadability);

    // Pick diverse domains (one per domain first, then fill)
    const selected: Array<{ item: IntelligenceItem; threadability: number }> = [];
    const usedDomains = new Set<string>();

    // First pass: one per domain
    for (const entry of scored) {
      if (selected.length >= this.config.draftsPerDay) break;
      const primaryDomain = entry.item.domains[0] ?? 'general';
      if (!usedDomains.has(primaryDomain)) {
        selected.push(entry);
        usedDomains.add(primaryDomain);
      }
    }

    // Second pass: fill remaining slots with top items
    for (const entry of scored) {
      if (selected.length >= this.config.draftsPerDay) break;
      if (!selected.includes(entry)) {
        selected.push(entry);
      }
    }

    return selected.map(({ item, threadability }) => this.toBrief(item, threadability));
  }

  scoreThreadability(item: IntelligenceItem): number {
    const { relevance, engagement, novelty, recency } = item.scoreBreakdown;

    // Domain boost: threadable domains get a bonus
    const domainBoost = item.domains.some((d) => THREADABLE_DOMAINS.has(d)) ? 10 : 0;

    // Weighted score emphasizing novelty and engagement (what makes good threads)
    const weighted =
      (novelty / 15) * 30 +      // Novelty is 30% of threadability
      (engagement / 15) * 25 +    // Engagement is 25%
      (relevance / 30) * 20 +     // Relevance is 20%
      (recency / 20) * 15 +       // Recency is 15%
      domainBoost;                 // Domain boost is up to 10

    return Math.min(100, Math.round(weighted));
  }

  private toBrief(item: IntelligenceItem, threadabilityScore: number): TopicBrief {
    const platform = this.selectPlatform(item, threadabilityScore);
    return {
      headline: item.title,
      keyPoints: [item.summary],
      angle: this.generateAngle(item),
      targetPlatform: platform,
      sourceItemIds: [item.id],
      threadabilityScore,
    };
  }

  private selectPlatform(item: IntelligenceItem, threadability: number): ContentPlatform {
    // High threadability + AI/programming → thread
    if (threadability >= 75 && item.domains.some((d) => THREADABLE_DOMAINS.has(d))) {
      return 'x_thread';
    }
    // Business/career → LinkedIn
    if (item.domains.includes('business') || item.domains.includes('career')) {
      return 'linkedin';
    }
    // Medium threadability → single tweet
    if (threadability >= 60) {
      return 'x_single';
    }
    return 'quick_take';
  }

  private generateAngle(item: IntelligenceItem): string {
    const domain = item.domains[0] ?? 'tech';
    const audienceMap: Record<string, string> = {
      ai: 'How solo devs and indie hackers can leverage this',
      programming: 'Practical implications for TypeScript/Node.js builders',
      business: 'What this means for freelancers and small agencies',
      tools: 'How this fits into a modern dev workflow',
      security: 'What builders need to know to stay secure',
      career: 'Career impact for independent developers',
      investment: 'Market signal for tech-adjacent investors',
      general: 'Why this matters for the builder community',
    };
    return audienceMap[domain] ?? audienceMap.general;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/plugins/content-engine/trend-analyzer.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/plugins/content-engine/trend-analyzer.ts tests/unit/plugins/content-engine/trend-analyzer.test.ts
git commit -m "feat(content-engine): add trend analyzer for scoring intelligence threadability"
```

---

## Task 4: Draft Queue (Persistence + Lifecycle)

Manages content draft files on disk with lifecycle state transitions.

**Files:**
- Create: `src/plugins/content-engine/draft-queue.ts`
- Test: `tests/unit/plugins/content-engine/draft-queue.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/plugins/content-engine/draft-queue.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DraftQueue } from '../../../../src/plugins/content-engine/draft-queue.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import type { ContentDraft, TopicBrief } from '../../../../src/plugins/content-engine/types.js';

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('not found')),
    readdir: vi.fn().mockResolvedValue([]),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('DraftQueue', () => {
  let queue: DraftQueue;
  let eventBus: EventBus;

  const sampleBrief: TopicBrief = {
    headline: 'AI agents are changing everything',
    keyPoints: ['Agents can now use tools', 'Cost is dropping'],
    angle: 'How solo devs can leverage this',
    targetPlatform: 'x_thread',
    sourceItemIds: ['intel-001'],
    threadabilityScore: 85,
  };

  beforeEach(() => {
    eventBus = new EventBus();
    queue = new DraftQueue(eventBus, '/tmp/test-content');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addDraft', () => {
    it('should create a draft with pending status', async () => {
      const draft = await queue.addDraft({
        topicBrief: sampleBrief,
        platform: 'x_thread',
        content: ['Hook tweet', 'Body tweet', 'CTA'],
        modelUsed: 'claude-sonnet-4',
        costUsd: 0.02,
      });

      expect(draft.id).toMatch(/^draft-\d{4}-\d{2}-\d{2}-/);
      expect(draft.status).toBe('pending');
      expect(draft.content).toHaveLength(3);
    });

    it('should emit content:draft_generated event', async () => {
      const spy = vi.fn();
      eventBus.on('content:draft_generated', spy);

      await queue.addDraft({
        topicBrief: sampleBrief,
        platform: 'x_thread',
        content: ['Hook'],
        modelUsed: 'claude-sonnet-4',
        costUsd: 0.01,
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        platform: 'x_thread',
        topicHeadline: 'AI agents are changing everything',
      }));
    });
  });

  describe('updateStatus', () => {
    it('should transition from pending to approved', async () => {
      const draft = await queue.addDraft({
        topicBrief: sampleBrief,
        platform: 'x_thread',
        content: ['Hook'],
      });

      const updated = await queue.updateStatus(draft.id, 'approved');
      expect(updated.status).toBe('approved');
      expect(updated.reviewedAt).toBeDefined();
    });

    it('should transition from pending to rejected with reason', async () => {
      const draft = await queue.addDraft({
        topicBrief: sampleBrief,
        platform: 'linkedin',
        content: ['Post text'],
      });

      const updated = await queue.updateStatus(draft.id, 'rejected', 'Too generic');
      expect(updated.status).toBe('rejected');
      expect(updated.rejectionReason).toBe('Too generic');
    });

    it('should emit content:draft_reviewed on status change', async () => {
      const spy = vi.fn();
      eventBus.on('content:draft_reviewed', spy);

      const draft = await queue.addDraft({
        topicBrief: sampleBrief,
        platform: 'x_thread',
        content: ['Hook'],
      });
      await queue.updateStatus(draft.id, 'approved');

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        draftId: draft.id,
        action: 'approved',
      }));
    });

    it('should throw on invalid draft ID', async () => {
      await expect(queue.updateStatus('nonexistent', 'approved')).rejects.toThrow();
    });
  });

  describe('getPending', () => {
    it('should return only pending drafts', async () => {
      await queue.addDraft({ topicBrief: sampleBrief, platform: 'x_thread', content: ['A'] });
      await queue.addDraft({ topicBrief: sampleBrief, platform: 'linkedin', content: ['B'] });
      const draft3 = await queue.addDraft({ topicBrief: sampleBrief, platform: 'x_single', content: ['C'] });
      await queue.updateStatus(draft3.id, 'approved');

      const pending = queue.getPending();
      expect(pending).toHaveLength(2);
    });
  });

  describe('getApproved', () => {
    it('should return only approved drafts', async () => {
      const draft = await queue.addDraft({
        topicBrief: sampleBrief,
        platform: 'x_thread',
        content: ['Hook'],
      });
      await queue.updateStatus(draft.id, 'approved');

      const approved = queue.getApproved();
      expect(approved).toHaveLength(1);
      expect(approved[0].id).toBe(draft.id);
    });
  });

  describe('getDraft', () => {
    it('should return a specific draft by ID', async () => {
      const draft = await queue.addDraft({
        topicBrief: sampleBrief,
        platform: 'linkedin',
        content: ['Post'],
      });

      const found = queue.getDraft(draft.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(draft.id);
    });

    it('should return undefined for unknown ID', () => {
      expect(queue.getDraft('unknown')).toBeUndefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/plugins/content-engine/draft-queue.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/plugins/content-engine/draft-queue.ts
import fs from 'node:fs/promises';
import { join } from 'node:path';
import type { EventBus } from '../../kernel/event-bus.js';
import { ContentDraftSchema, type ContentDraft, type ContentPlatform, type DraftStatus, type TopicBrief } from './types.js';

interface AddDraftParams {
  topicBrief: TopicBrief;
  platform: ContentPlatform;
  content: string[];
  modelUsed?: string;
  costUsd?: number;
}

export class DraftQueue {
  private drafts: Map<string, ContentDraft> = new Map();
  private eventBus: EventBus;
  private dataDir: string;
  private counter = 0;

  constructor(eventBus: EventBus, dataDir: string) {
    this.eventBus = eventBus;
    this.dataDir = dataDir;
  }

  async init(): Promise<void> {
    const draftsDir = join(this.dataDir, 'drafts');
    await fs.mkdir(draftsDir, { recursive: true });
    await this.loadFromDisk();
  }

  async addDraft(params: AddDraftParams): Promise<ContentDraft> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    this.counter++;
    const id = `draft-${dateStr}-${String(this.counter).padStart(3, '0')}`;

    const draft = ContentDraftSchema.parse({
      id,
      topicBrief: params.topicBrief,
      platform: params.platform,
      content: params.content,
      status: 'pending',
      createdAt: now.toISOString(),
      modelUsed: params.modelUsed,
      costUsd: params.costUsd,
    });

    this.drafts.set(id, draft);
    await this.persist(draft);

    this.eventBus.emit('content:draft_generated', {
      draftId: id,
      platform: params.platform,
      topicHeadline: params.topicBrief.headline,
      costUsd: params.costUsd ?? 0,
    });

    return draft;
  }

  async updateStatus(draftId: string, status: DraftStatus, reason?: string): Promise<ContentDraft> {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    const now = new Date().toISOString();
    const updated: ContentDraft = {
      ...draft,
      status,
      reviewedAt: ['approved', 'rejected', 'edited'].includes(status) ? now : draft.reviewedAt,
      publishedAt: status === 'published' ? now : draft.publishedAt,
      rejectionReason: status === 'rejected' ? reason : draft.rejectionReason,
    };

    if (status === 'edited' && reason) {
      updated.editRequests = [...draft.editRequests, reason];
    }

    this.drafts.set(draftId, updated);
    await this.persist(updated);

    if (['approved', 'rejected', 'edited'].includes(status)) {
      this.eventBus.emit('content:draft_reviewed', {
        draftId,
        action: status as 'approved' | 'edited' | 'rejected',
        reason,
      });
    }

    return updated;
  }

  getDraft(id: string): ContentDraft | undefined {
    return this.drafts.get(id);
  }

  getPending(): ContentDraft[] {
    return [...this.drafts.values()].filter((d) => d.status === 'pending');
  }

  getApproved(): ContentDraft[] {
    return [...this.drafts.values()].filter((d) => d.status === 'approved');
  }

  getAll(): ContentDraft[] {
    return [...this.drafts.values()];
  }

  private async persist(draft: ContentDraft): Promise<void> {
    const draftsDir = join(this.dataDir, 'drafts');
    await fs.mkdir(draftsDir, { recursive: true });
    const filePath = join(draftsDir, `${draft.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(draft, null, 2));
  }

  private async loadFromDisk(): Promise<void> {
    const draftsDir = join(this.dataDir, 'drafts');
    try {
      const files = await fs.readdir(draftsDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const data = await fs.readFile(join(draftsDir, file), 'utf-8');
          const parsed = JSON.parse(data) as unknown;
          const draft = ContentDraftSchema.parse(parsed);
          this.drafts.set(draft.id, draft);
          this.counter = Math.max(this.counter, parseInt(draft.id.split('-').pop() ?? '0', 10));
        } catch {
          // Skip corrupt files
        }
      }
    } catch {
      // Directory may not exist yet
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/plugins/content-engine/draft-queue.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/plugins/content-engine/draft-queue.ts tests/unit/plugins/content-engine/draft-queue.test.ts
git commit -m "feat(content-engine): add draft queue with persistence and lifecycle tracking"
```

---

## Task 5: Content Drafter

Uses AIOrchestrator to generate platform-specific content from topic briefs.

**Files:**
- Create: `src/plugins/content-engine/content-drafter.ts`
- Test: `tests/unit/plugins/content-engine/content-drafter.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/plugins/content-engine/content-drafter.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentDrafter } from '../../../../src/plugins/content-engine/content-drafter.js';
import type { TopicBrief, ContentEngineConfig } from '../../../../src/plugins/content-engine/types.js';

const mockOrchestrator = {
  chat: vi.fn(),
  execute: vi.fn(),
  query: vi.fn(),
};

describe('ContentDrafter', () => {
  let drafter: ContentDrafter;
  const config: ContentEngineConfig = {
    draftsPerDay: 3,
    autoSendForReview: true,
    publishingEnabled: false,
    platforms: ['x_thread', 'linkedin'],
    minThreadabilityScore: 60,
    voiceProfile: {
      persona: '@PayThePryce',
      tone: 'pragmatic builder, technical but accessible',
      audience: 'solo devs, indie hackers, small business owners',
      style: 'direct, no fluff, actionable takeaways',
      avoids: 'corporate jargon, hype without substance',
    },
  };

  const sampleBrief: TopicBrief = {
    headline: 'Claude 4.6 Released',
    keyPoints: ['Computer use built-in', 'Faster than 4.5', 'New agentic capabilities'],
    angle: 'How solo devs can leverage this',
    targetPlatform: 'x_thread',
    sourceItemIds: ['intel-001'],
    threadabilityScore: 85,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    drafter = new ContentDrafter(mockOrchestrator as never, config);
  });

  describe('generateDraft', () => {
    it('should generate an X thread from a topic brief', async () => {
      mockOrchestrator.chat.mockResolvedValue(
        'TWEET 1: Claude 4.6 just dropped and it changes everything.\n\n' +
        'TWEET 2: Here\'s what\'s new.\n\n' +
        'TWEET 3: Computer use is built in.\n\n' +
        'TWEET 4: Follow @PayThePryce for more.',
      );

      const result = await drafter.generateDraft(sampleBrief);

      expect(result.content.length).toBeGreaterThanOrEqual(1);
      expect(result.platform).toBe('x_thread');
      expect(mockOrchestrator.chat).toHaveBeenCalledTimes(1);
    });

    it('should generate a LinkedIn post', async () => {
      const linkedinBrief: TopicBrief = {
        ...sampleBrief,
        targetPlatform: 'linkedin',
      };

      mockOrchestrator.chat.mockResolvedValue(
        'I\'ve been building AI agents for 6 months now...',
      );

      const result = await drafter.generateDraft(linkedinBrief);

      expect(result.platform).toBe('linkedin');
      expect(result.content).toHaveLength(1);
    });

    it('should pass voice profile in system prompt', async () => {
      mockOrchestrator.chat.mockResolvedValue('TWEET 1: content here');

      await drafter.generateDraft(sampleBrief);

      const systemPrompt = mockOrchestrator.chat.mock.calls[0][1] as string;
      expect(systemPrompt).toContain('@PayThePryce');
      expect(systemPrompt).toContain('pragmatic builder');
      expect(systemPrompt).toContain('solo devs');
    });

    it('should include topic brief details in the user message', async () => {
      mockOrchestrator.chat.mockResolvedValue('TWEET 1: content');

      await drafter.generateDraft(sampleBrief);

      const messages = mockOrchestrator.chat.mock.calls[0][0] as Array<{ content: string }>;
      expect(messages[0].content).toContain('Claude 4.6 Released');
      expect(messages[0].content).toContain('Computer use built-in');
    });
  });

  describe('parseThreadResponse', () => {
    it('should split thread response into individual tweets', () => {
      const response =
        'TWEET 1: Hook tweet here\n\nTWEET 2: Body tweet\n\nTWEET 3: CTA tweet';
      const tweets = drafter.parseThreadResponse(response);
      expect(tweets).toHaveLength(3);
      expect(tweets[0]).toBe('Hook tweet here');
    });

    it('should handle numbered format', () => {
      const response = '1. First tweet\n\n2. Second tweet\n\n3. Third tweet';
      const tweets = drafter.parseThreadResponse(response);
      expect(tweets.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle single-paragraph response as single item', () => {
      const response = 'This is a single LinkedIn post about AI.';
      const tweets = drafter.parseThreadResponse(response);
      expect(tweets).toHaveLength(1);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/plugins/content-engine/content-drafter.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/plugins/content-engine/content-drafter.ts
import type { AIOrchestrator } from '../../ai/orchestrator.js';
import { PLATFORM_CONSTRAINTS, type ContentEngineConfig, type ContentPlatform, type TopicBrief } from './types.js';

interface DraftResult {
  platform: ContentPlatform;
  content: string[];
  modelUsed?: string;
  costUsd?: number;
}

export class ContentDrafter {
  private orchestrator: AIOrchestrator;
  private config: ContentEngineConfig;

  constructor(orchestrator: AIOrchestrator, config: ContentEngineConfig) {
    this.orchestrator = orchestrator;
    this.config = config;
  }

  async generateDraft(brief: TopicBrief): Promise<DraftResult> {
    const systemPrompt = this.buildSystemPrompt(brief.targetPlatform);
    const userMessage = this.buildUserMessage(brief);

    const content = await this.orchestrator.chat(
      [{ role: 'user', content: userMessage }],
      systemPrompt,
      'core',
    );

    const parsed = brief.targetPlatform === 'x_thread'
      ? this.parseThreadResponse(content)
      : [content.trim()];

    return {
      platform: brief.targetPlatform,
      content: parsed,
    };
  }

  parseThreadResponse(response: string): string[] {
    // Try TWEET N: format
    const tweetPattern = /TWEET\s*\d+:\s*/gi;
    if (tweetPattern.test(response)) {
      return response
        .split(/TWEET\s*\d+:\s*/gi)
        .map((t) => t.trim())
        .filter(Boolean);
    }

    // Try numbered format (1. / 2. / 3.)
    const numberedPattern = /^\d+\.\s/m;
    if (numberedPattern.test(response)) {
      return response
        .split(/\n\n+/)
        .map((t) => t.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);
    }

    // Try double-newline split
    const paragraphs = response.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length > 1) {
      return paragraphs;
    }

    // Single block
    return [response.trim()];
  }

  private buildSystemPrompt(platform: ContentPlatform): string {
    const { voiceProfile } = this.config;
    const constraints = PLATFORM_CONSTRAINTS[platform];

    const platformInstructions: Record<ContentPlatform, string> = {
      x_thread: `Write a Twitter/X thread. Format as "TWEET 1:", "TWEET 2:", etc. ` +
        `Include a strong hook tweet, 5-7 body tweets with insights, and a CTA tweet. ` +
        `Each tweet must be under ${constraints.maxChars} characters. Max ${constraints.maxParts} tweets.`,
      x_single: `Write a single tweet. Must be under ${constraints.maxChars} characters. ` +
        `Make it punchy and insightful.`,
      linkedin: `Write a LinkedIn post. Professional but authentic tone. ` +
        `Under ${constraints.maxChars} characters. Include a hook opening line.`,
      blog_outline: `Write a blog post outline. Include: title, 4-6 H2 section headers, ` +
        `3-4 key points per section. Under ${constraints.maxChars} characters total.`,
      quick_take: `Write a 1-2 sentence hot take. Under ${constraints.maxChars} characters. ` +
        `Sharp, memorable, and opinionated.`,
    };

    return [
      `You are ${voiceProfile.persona}, a content creator.`,
      `Tone: ${voiceProfile.tone}`,
      `Target audience: ${voiceProfile.audience}`,
      `Style: ${voiceProfile.style}`,
      `Avoid: ${voiceProfile.avoids}`,
      '',
      platformInstructions[platform],
      '',
      'Output ONLY the content. No meta-commentary, no "here\'s the thread", no explanations.',
    ].join('\n');
  }

  private buildUserMessage(brief: TopicBrief): string {
    return [
      `Topic: ${brief.headline}`,
      '',
      `Key Points:`,
      ...brief.keyPoints.map((p) => `- ${p}`),
      '',
      `Angle: ${brief.angle}`,
      '',
      `Write the ${brief.targetPlatform.replace('_', ' ')} now.`,
    ].join('\n');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/plugins/content-engine/content-drafter.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/plugins/content-engine/content-drafter.ts tests/unit/plugins/content-engine/content-drafter.test.ts
git commit -m "feat(content-engine): add AI-powered content drafter with platform-specific prompts"
```

---

## Task 6: X Client Write Methods

Extend the existing X client with `postTweet`, `postThread`, and `deleteTweet`.

**Files:**
- Modify: `src/integrations/twitter/client.ts`
- Test: `tests/unit/integrations/twitter/write.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/integrations/twitter/write.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { XClient } from '../../../../src/integrations/twitter/client.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('XClient Write Methods', () => {
  let client: XClient;

  beforeEach(() => {
    client = new XClient({
      enabled: true,
      bearerToken: 'test-bearer-token',
      userId: 'user-123',
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('postTweet', () => {
    it('should post a single tweet and return the tweet ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: 'tweet-789' } }),
      });

      const tweetId = await client.postTweet('Hello from ARI!');
      expect(tweetId).toBe('tweet-789');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/tweets');
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body as string) as { text: string };
      expect(body.text).toBe('Hello from ARI!');
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      });

      await expect(client.postTweet('Test')).rejects.toThrow();
    });

    it('should post a reply when replyToId is given', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: 'reply-001' } }),
      });

      const tweetId = await client.postTweet('Reply text', 'parent-123');
      expect(tweetId).toBe('reply-001');

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string) as {
        text: string;
        reply: { in_reply_to_tweet_id: string };
      };
      expect(body.reply.in_reply_to_tweet_id).toBe('parent-123');
    });
  });

  describe('postThread', () => {
    it('should post multiple tweets as a thread', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { id: `tweet-${callCount}` } }),
        });
      });

      const ids = await client.postThread([
        'Thread hook',
        'Body tweet 1',
        'CTA tweet',
      ]);

      expect(ids).toEqual(['tweet-1', 'tweet-2', 'tweet-3']);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Second tweet should be a reply to first
      const secondBody = JSON.parse(
        (mockFetch.mock.calls[1] as [string, RequestInit])[1].body as string,
      ) as { reply?: { in_reply_to_tweet_id: string } };
      expect(secondBody.reply?.in_reply_to_tweet_id).toBe('tweet-1');
    });

    it('should throw if thread is empty', async () => {
      await expect(client.postThread([])).rejects.toThrow();
    });
  });

  describe('deleteTweet', () => {
    it('should delete a tweet by ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { deleted: true } }),
      });

      await expect(client.deleteTweet('tweet-789')).resolves.not.toThrow();

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/tweets/tweet-789');
      expect(options.method).toBe('DELETE');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/integrations/twitter/write.test.ts`
Expected: FAIL — `postTweet` is not a function

**Step 3: Add write methods to XClient**

Add these methods to the `XClient` class in `src/integrations/twitter/client.ts`. Add them after the existing `searchRecent` method. The `X_API_BASE` constant should already be defined (check existing file).

```typescript
// Add to XClient class:

async postTweet(text: string, replyToId?: string): Promise<string> {
  const body: Record<string, unknown> = { text };
  if (replyToId) {
    body.reply = { in_reply_to_tweet_id: replyToId };
  }

  const response = await fetch(`${X_API_BASE}/tweets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${this.config.bearerToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ARI-Content-Engine/1.0',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`X API POST /tweets failed (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as { data: { id: string } };
  this.requestCount++;
  return result.data.id;
}

async postThread(tweets: string[]): Promise<string[]> {
  if (tweets.length === 0) {
    throw new Error('Thread must have at least one tweet');
  }

  const ids: string[] = [];
  let previousId: string | undefined;

  for (const text of tweets) {
    const id = await this.postTweet(text, previousId);
    ids.push(id);
    previousId = id;
  }

  return ids;
}

async deleteTweet(tweetId: string): Promise<void> {
  const response = await fetch(`${X_API_BASE}/tweets/${tweetId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${this.config.bearerToken}`,
      'User-Agent': 'ARI-Content-Engine/1.0',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`X API DELETE /tweets/${tweetId} failed (${response.status}): ${errorText}`);
  }

  this.requestCount++;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/integrations/twitter/write.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/integrations/twitter/client.ts tests/unit/integrations/twitter/write.test.ts
git commit -m "feat(twitter): add postTweet, postThread, and deleteTweet write methods"
```

---

## Task 7: Publisher

Publishes approved drafts to X and archives to disk.

**Files:**
- Create: `src/plugins/content-engine/publisher.ts`
- Test: `tests/unit/plugins/content-engine/publisher.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/plugins/content-engine/publisher.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Publisher } from '../../../../src/plugins/content-engine/publisher.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import type { ContentDraft } from '../../../../src/plugins/content-engine/types.js';

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockXClient = {
  postTweet: vi.fn(),
  postThread: vi.fn(),
  isReady: vi.fn().mockReturnValue(true),
};

function makeDraft(overrides: Partial<ContentDraft> = {}): ContentDraft {
  return {
    id: 'draft-2026-02-16-001',
    topicBrief: {
      headline: 'Test Topic',
      keyPoints: ['Point 1'],
      angle: 'Test angle',
      targetPlatform: 'x_thread',
      sourceItemIds: ['intel-1'],
      threadabilityScore: 85,
    },
    platform: 'x_thread',
    content: ['Hook tweet', 'Body tweet', 'CTA tweet'],
    status: 'approved',
    createdAt: '2026-02-16T07:00:00Z',
    reviewedAt: '2026-02-16T08:00:00Z',
    editRequests: [],
    metadata: {},
    ...overrides,
  };
}

describe('Publisher', () => {
  let publisher: Publisher;
  let eventBus: EventBus;

  beforeEach(() => {
    vi.resetAllMocks();
    eventBus = new EventBus();
    publisher = new Publisher(eventBus, mockXClient as never, '/tmp/test-content');
  });

  describe('publishToX', () => {
    it('should publish a thread draft', async () => {
      mockXClient.postThread.mockResolvedValue(['t-1', 't-2', 't-3']);

      const result = await publisher.publishToX(makeDraft());

      expect(result.publishedIds).toEqual(['t-1', 't-2', 't-3']);
      expect(mockXClient.postThread).toHaveBeenCalledWith([
        'Hook tweet', 'Body tweet', 'CTA tweet',
      ]);
    });

    it('should publish a single tweet for x_single platform', async () => {
      mockXClient.postTweet.mockResolvedValue('t-1');

      const draft = makeDraft({ platform: 'x_single', content: ['Quick take'] });
      const result = await publisher.publishToX(draft);

      expect(result.publishedIds).toEqual(['t-1']);
      expect(mockXClient.postTweet).toHaveBeenCalledWith('Quick take');
    });

    it('should emit content:published event', async () => {
      const spy = vi.fn();
      eventBus.on('content:published', spy);
      mockXClient.postThread.mockResolvedValue(['t-1']);

      await publisher.publishToX(makeDraft());

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        draftId: 'draft-2026-02-16-001',
        platform: 'x_thread',
      }));
    });

    it('should emit content:publish_failed on error', async () => {
      const spy = vi.fn();
      eventBus.on('content:publish_failed', spy);
      mockXClient.postThread.mockRejectedValue(new Error('Rate limited'));

      await expect(publisher.publishToX(makeDraft())).rejects.toThrow('Rate limited');

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        draftId: 'draft-2026-02-16-001',
        error: 'Rate limited',
      }));
    });

    it('should throw if X client is not ready', async () => {
      mockXClient.isReady.mockReturnValue(false);

      await expect(publisher.publishToX(makeDraft())).rejects.toThrow('not ready');
    });
  });

  describe('archiveDraft', () => {
    it('should write draft to published directory', async () => {
      const fs = await import('node:fs/promises');
      const draft = makeDraft({ status: 'published', publishedIds: ['t-1'] });

      await publisher.archiveDraft(draft);

      expect(fs.default.writeFile).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/plugins/content-engine/publisher.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/plugins/content-engine/publisher.ts
import fs from 'node:fs/promises';
import { join } from 'node:path';
import type { EventBus } from '../../kernel/event-bus.js';
import type { XClient } from '../../integrations/twitter/client.js';
import type { ContentDraft } from './types.js';

interface PublishResult {
  publishedIds: string[];
}

export class Publisher {
  private eventBus: EventBus;
  private xClient: XClient;
  private dataDir: string;

  constructor(eventBus: EventBus, xClient: XClient, dataDir: string) {
    this.eventBus = eventBus;
    this.xClient = xClient;
    this.dataDir = dataDir;
  }

  async publishToX(draft: ContentDraft): Promise<PublishResult> {
    if (!this.xClient.isReady()) {
      throw new Error('X client is not ready');
    }

    try {
      let publishedIds: string[];

      if (draft.platform === 'x_thread') {
        publishedIds = await this.xClient.postThread(draft.content);
      } else {
        const id = await this.xClient.postTweet(draft.content[0]);
        publishedIds = [id];
      }

      this.eventBus.emit('content:published', {
        draftId: draft.id,
        platform: draft.platform,
        publishedIds,
      });

      return { publishedIds };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.eventBus.emit('content:publish_failed', {
        draftId: draft.id,
        platform: draft.platform,
        error: message,
      });
      throw error;
    }
  }

  async archiveDraft(draft: ContentDraft): Promise<void> {
    const publishedDir = join(this.dataDir, 'published');
    await fs.mkdir(publishedDir, { recursive: true });
    const filePath = join(publishedDir, `${draft.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(draft, null, 2));
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/plugins/content-engine/publisher.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/plugins/content-engine/publisher.ts tests/unit/plugins/content-engine/publisher.test.ts
git commit -m "feat(content-engine): add publisher for X thread/tweet posting with event emission"
```

---

## Task 8: Content Engine Plugin (DomainPlugin)

Wire everything together as a `DomainPlugin` following the crypto/pokemon pattern.

**Files:**
- Create: `src/plugins/content-engine/index.ts`
- Test: `tests/unit/plugins/content-engine/index.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/plugins/content-engine/index.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentEnginePlugin } from '../../../../src/plugins/content-engine/index.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import type { PluginDependencies } from '../../../../src/plugins/types.js';

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('not found')),
    readdir: vi.fn().mockResolvedValue([]),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockOrchestrator = {
  chat: vi.fn().mockResolvedValue('TWEET 1: Test content'),
  execute: vi.fn(),
  query: vi.fn(),
};

describe('ContentEnginePlugin', () => {
  let plugin: ContentEnginePlugin;
  let eventBus: EventBus;

  beforeEach(() => {
    vi.resetAllMocks();
    eventBus = new EventBus();
    plugin = new ContentEnginePlugin();
  });

  describe('manifest', () => {
    it('should have correct plugin metadata', () => {
      expect(plugin.manifest.id).toBe('content-engine');
      expect(plugin.manifest.name).toBe('Content Engine');
      expect(plugin.manifest.capabilities).toContain('briefing');
      expect(plugin.manifest.capabilities).toContain('scheduling');
    });
  });

  describe('lifecycle', () => {
    it('should initialize successfully', async () => {
      const deps: PluginDependencies = {
        eventBus,
        orchestrator: mockOrchestrator as never,
        config: {},
        dataDir: '/tmp/test-content',
        costTracker: null,
      };

      await plugin.initialize(deps);
      expect(plugin.getStatus()).toBe('active');
    });

    it('should shutdown cleanly', async () => {
      const deps: PluginDependencies = {
        eventBus,
        orchestrator: mockOrchestrator as never,
        config: {},
        dataDir: '/tmp/test-content',
        costTracker: null,
      };

      await plugin.initialize(deps);
      await plugin.shutdown();
      expect(plugin.getStatus()).toBe('shutdown');
    });
  });

  describe('healthCheck', () => {
    it('should report healthy when active', async () => {
      const deps: PluginDependencies = {
        eventBus,
        orchestrator: mockOrchestrator as never,
        config: {},
        dataDir: '/tmp/test-content',
        costTracker: null,
      };

      await plugin.initialize(deps);
      const health = await plugin.healthCheck();
      expect(health.healthy).toBe(true);
    });

    it('should report unhealthy before initialization', async () => {
      const health = await plugin.healthCheck();
      expect(health.healthy).toBe(false);
    });
  });

  describe('getScheduledTasks', () => {
    it('should return content generation tasks', async () => {
      const deps: PluginDependencies = {
        eventBus,
        orchestrator: mockOrchestrator as never,
        config: {},
        dataDir: '/tmp/test-content',
        costTracker: null,
      };

      await plugin.initialize(deps);
      const tasks = plugin.getScheduledTasks?.() ?? [];
      expect(tasks.length).toBeGreaterThanOrEqual(1);

      const draftTask = tasks.find((t) => t.id === 'content-daily-drafts');
      expect(draftTask).toBeDefined();
      expect(draftTask?.cron).toBe('0 7 * * *');
    });
  });

  describe('contributeToBriefing', () => {
    it('should contribute content stats to morning briefing', async () => {
      const deps: PluginDependencies = {
        eventBus,
        orchestrator: mockOrchestrator as never,
        config: {},
        dataDir: '/tmp/test-content',
        costTracker: null,
      };

      await plugin.initialize(deps);
      const contribution = await plugin.contributeToBriefing?.('morning');
      expect(contribution).toBeDefined();
      expect(contribution?.pluginId).toBe('content-engine');
      expect(contribution?.section).toContain('Content');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/plugins/content-engine/index.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/plugins/content-engine/index.ts
import type { EventBus } from '../../kernel/event-bus.js';
import type { AIOrchestrator } from '../../ai/orchestrator.js';
import type {
  DomainPlugin,
  PluginManifest,
  PluginStatus,
  PluginDependencies,
  BriefingContribution,
  ScheduledTaskDefinition,
} from '../types.js';
import { ContentEngineConfigSchema, type ContentEngineConfig } from './types.js';
import { TrendAnalyzer } from './trend-analyzer.js';
import { ContentDrafter } from './content-drafter.js';
import { DraftQueue } from './draft-queue.js';

export class ContentEnginePlugin implements DomainPlugin {
  readonly manifest: PluginManifest = {
    id: 'content-engine',
    name: 'Content Engine',
    version: '1.0.0',
    description: 'Transforms intelligence into platform-specific content drafts for Pryceless Solutions',
    author: 'ARI',
    capabilities: ['briefing', 'scheduling', 'alerting'],
    dependencies: [],
  };

  private status: PluginStatus = 'registered';
  private eventBus!: EventBus;
  private orchestrator!: AIOrchestrator;
  private config!: ContentEngineConfig;
  private trendAnalyzer!: TrendAnalyzer;
  private contentDrafter!: ContentDrafter;
  private draftQueue!: DraftQueue;

  getStatus(): PluginStatus {
    return this.status;
  }

  // Expose internals for Telegram command handlers
  getDraftQueue(): DraftQueue { return this.draftQueue; }
  getContentDrafter(): ContentDrafter { return this.contentDrafter; }
  getTrendAnalyzer(): TrendAnalyzer { return this.trendAnalyzer; }
  getConfig(): ContentEngineConfig { return this.config; }

  async initialize(deps: PluginDependencies): Promise<void> {
    this.eventBus = deps.eventBus;
    this.orchestrator = deps.orchestrator;
    this.config = ContentEngineConfigSchema.parse(deps.config);

    this.trendAnalyzer = new TrendAnalyzer(this.config);
    this.contentDrafter = new ContentDrafter(this.orchestrator, this.config);
    this.draftQueue = new DraftQueue(this.eventBus, deps.dataDir);

    await this.draftQueue.init();
    this.status = 'active';
  }

  async shutdown(): Promise<void> {
    this.status = 'shutdown';
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
    if (this.status !== 'active') {
      return { healthy: false, details: `Status: ${this.status}` };
    }
    return {
      healthy: true,
      details: `Pending: ${this.draftQueue.getPending().length}, Approved: ${this.draftQueue.getApproved().length}`,
    };
  }

  async contributeToBriefing(type: 'morning' | 'evening' | 'weekly'): Promise<BriefingContribution | null> {
    if (type !== 'morning') return null;

    const pending = this.draftQueue.getPending();
    const approved = this.draftQueue.getApproved();
    const all = this.draftQueue.getAll();

    const lines = [
      `Pending drafts: ${pending.length}`,
      `Approved (ready to publish): ${approved.length}`,
      `Total drafts: ${all.length}`,
    ];

    if (pending.length > 0) {
      lines.push('', 'Top pending:');
      for (const draft of pending.slice(0, 3)) {
        lines.push(`  - [${draft.platform}] ${draft.topicBrief.headline}`);
      }
    }

    return {
      pluginId: 'content-engine',
      section: 'Content Pipeline',
      content: lines.join('\n'),
      priority: 5,
      category: 'info',
    };
  }

  getScheduledTasks(): ScheduledTaskDefinition[] {
    return [
      {
        id: 'content-daily-drafts',
        name: 'Generate Daily Content Drafts',
        cron: '0 7 * * *', // 7:00 AM daily
        essential: false,
        handler: async () => {
          await this.generateDailyDrafts();
        },
      },
      {
        id: 'content-draft-delivery',
        name: 'Deliver Top Draft for Review',
        cron: '30 7 * * *', // 7:30 AM daily
        essential: false,
        handler: async () => {
          await this.deliverDraftForReview();
        },
      },
    ];
  }

  private async generateDailyDrafts(): Promise<void> {
    // Listen for latest scan results from EventBus
    // For now, this is a placeholder — will be wired when intelligence scanner integration is complete
    this.eventBus.emit('content:trend_analyzed', {
      topicCount: 0,
      topDomains: [],
    });
  }

  private async deliverDraftForReview(): Promise<void> {
    const pending = this.draftQueue.getPending();
    if (pending.length === 0) return;

    // Pick the highest threadability score draft
    const top = [...pending].sort(
      (a, b) => b.topicBrief.threadabilityScore - a.topicBrief.threadabilityScore,
    )[0];

    await this.draftQueue.updateStatus(top.id, 'sent_for_review');
  }
}

export { ContentEnginePlugin as default };
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/plugins/content-engine/index.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/plugins/content-engine/index.ts tests/unit/plugins/content-engine/index.test.ts
git commit -m "feat(content-engine): add DomainPlugin with scheduling, briefing, and draft management"
```

---

## Task 9: Register Content Engine Plugin

Wire the plugin into the plugin registry.

**Files:**
- Modify: `src/plugins/register-plugins.ts`
- Test: `tests/unit/plugins/content-engine/registration.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/plugins/content-engine/registration.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('not found')),
    readdir: vi.fn().mockResolvedValue([]),
  },
}));

describe('Plugin Registration', () => {
  it('should include ContentEnginePlugin in registerAllPlugins', async () => {
    const { registerAllPlugins } = await import('../../../../src/plugins/register-plugins.js');
    const registered: string[] = [];

    const mockRegistry = {
      register: vi.fn().mockImplementation((plugin: { manifest: { id: string } }) => {
        registered.push(plugin.manifest.id);
        return Promise.resolve();
      }),
    };

    await registerAllPlugins(mockRegistry as never);
    expect(registered).toContain('content-engine');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/plugins/content-engine/registration.test.ts`
Expected: FAIL — 'content-engine' not in registered list

**Step 3: Add import and registration**

In `src/plugins/register-plugins.ts`, add:

```typescript
import { ContentEnginePlugin } from './content-engine/index.js';
```

And in the `registerAllPlugins` function body, add:

```typescript
await registry.register(new ContentEnginePlugin());
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/plugins/content-engine/registration.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/register-plugins.ts tests/unit/plugins/content-engine/registration.test.ts
git commit -m "feat(content-engine): register plugin in plugin registry"
```

---

## Task 10: Telegram Commands for Content Engine

Add `/drafts`, `/draft`, `/approve`, `/reject` commands to the Telegram bot.

**Files:**
- Create: `src/plugins/telegram-bot/commands/content.ts`
- Modify: `src/plugins/telegram-bot/bot.ts` (add command registration)
- Test: `tests/unit/plugins/telegram-bot/commands/content.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/plugins/telegram-bot/commands/content.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDrafts, handleApprove, handleReject } from '../../../../../src/plugins/telegram-bot/commands/content.js';

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('not found')),
    readdir: vi.fn().mockResolvedValue([]),
  },
}));

function makeCtx(text: string) {
  return {
    message: { text },
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

function makeRegistry(hasDrafts = true) {
  const mockDraftQueue = {
    getPending: vi.fn().mockReturnValue(hasDrafts ? [
      {
        id: 'draft-2026-02-16-001',
        platform: 'x_thread',
        topicBrief: { headline: 'AI agents topic' },
        status: 'pending',
        content: ['Hook', 'Body', 'CTA'],
      },
    ] : []),
    getDraft: vi.fn().mockImplementation((id: string) => {
      if (id === 'draft-2026-02-16-001') {
        return {
          id: 'draft-2026-02-16-001',
          platform: 'x_thread',
          topicBrief: { headline: 'AI agents topic' },
          status: 'pending',
          content: ['Hook', 'Body', 'CTA'],
        };
      }
      return undefined;
    }),
    updateStatus: vi.fn().mockImplementation((id: string, status: string) => {
      return Promise.resolve({ id, status });
    }),
  };

  const mockPlugin = {
    manifest: { id: 'content-engine' },
    getDraftQueue: vi.fn().mockReturnValue(mockDraftQueue),
  };

  return {
    getPlugin: vi.fn().mockImplementation((id: string) => {
      if (id === 'content-engine') return mockPlugin;
      return null;
    }),
  };
}

describe('Content Telegram Commands', () => {
  describe('handleDrafts', () => {
    it('should list pending drafts', async () => {
      const ctx = makeCtx('/drafts');
      const registry = makeRegistry();

      await handleDrafts(ctx as never, registry as never);

      expect(ctx.reply).toHaveBeenCalled();
      const replyText = ctx.reply.mock.calls[0][0] as string;
      expect(replyText).toContain('AI agents topic');
      expect(replyText).toContain('x_thread');
    });

    it('should show empty message when no drafts', async () => {
      const ctx = makeCtx('/drafts');
      const registry = makeRegistry(false);

      await handleDrafts(ctx as never, registry as never);

      const replyText = ctx.reply.mock.calls[0][0] as string;
      expect(replyText).toContain('No pending');
    });
  });

  describe('handleApprove', () => {
    it('should approve a draft by ID', async () => {
      const ctx = makeCtx('/approve draft-2026-02-16-001');
      const registry = makeRegistry();

      await handleApprove(ctx as never, registry as never);

      expect(ctx.reply).toHaveBeenCalled();
      const replyText = ctx.reply.mock.calls[0][0] as string;
      expect(replyText).toContain('Approved');
    });

    it('should show usage when no ID given', async () => {
      const ctx = makeCtx('/approve');
      const registry = makeRegistry();

      await handleApprove(ctx as never, registry as never);

      const replyText = ctx.reply.mock.calls[0][0] as string;
      expect(replyText).toContain('Usage');
    });
  });

  describe('handleReject', () => {
    it('should reject a draft with reason', async () => {
      const ctx = makeCtx('/reject draft-2026-02-16-001 Too generic');
      const registry = makeRegistry();

      await handleReject(ctx as never, registry as never);

      const plugin = registry.getPlugin('content-engine');
      const queue = plugin.getDraftQueue();
      expect(queue.updateStatus).toHaveBeenCalledWith(
        'draft-2026-02-16-001',
        'rejected',
        'Too generic',
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/plugins/telegram-bot/commands/content.test.ts`
Expected: FAIL — module not found

**Step 3: Write the command handler**

```typescript
// src/plugins/telegram-bot/commands/content.ts
import type { Context } from 'grammy';
import type { PluginRegistry } from '../../../plugins/registry.js';
import type { ContentEnginePlugin } from '../../../plugins/content-engine/index.js';

function getContentPlugin(registry: PluginRegistry | null): ContentEnginePlugin | null {
  if (!registry) return null;
  return registry.getPlugin<ContentEnginePlugin>('content-engine') ?? null;
}

export async function handleDrafts(
  ctx: Context,
  registry: PluginRegistry | null,
): Promise<void> {
  const plugin = getContentPlugin(registry);
  if (!plugin) {
    await ctx.reply('Content Engine not available.');
    return;
  }

  const queue = plugin.getDraftQueue();
  const pending = queue.getPending();

  if (pending.length === 0) {
    await ctx.reply('No pending drafts. ARI will generate new ones at 7:00 AM.');
    return;
  }

  const lines = ['<b>Pending Content Drafts</b>', ''];
  for (const draft of pending) {
    lines.push(
      `<b>${draft.id}</b>`,
      `  Platform: ${draft.platform}`,
      `  Topic: ${draft.topicBrief.headline}`,
      `  Parts: ${draft.content.length}`,
      '',
    );
  }
  lines.push('Use /approve &lt;id&gt; or /reject &lt;id&gt; &lt;reason&gt;');

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}

export async function handleApprove(
  ctx: Context,
  registry: PluginRegistry | null,
): Promise<void> {
  const plugin = getContentPlugin(registry);
  if (!plugin) {
    await ctx.reply('Content Engine not available.');
    return;
  }

  const text = ctx.message?.text ?? '';
  const draftId = text.replace(/^\/approve\s*/i, '').trim();

  if (!draftId) {
    await ctx.reply('Usage: /approve <draft-id>');
    return;
  }

  const queue = plugin.getDraftQueue();
  const draft = queue.getDraft(draftId);

  if (!draft) {
    await ctx.reply(`Draft not found: ${draftId}`);
    return;
  }

  try {
    await queue.updateStatus(draftId, 'approved');
    await ctx.reply(`Approved: <b>${draft.topicBrief.headline}</b>\nWill publish at next scheduled window.`, {
      parse_mode: 'HTML',
    });
  } catch (error) {
    await ctx.reply(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function handleReject(
  ctx: Context,
  registry: PluginRegistry | null,
): Promise<void> {
  const plugin = getContentPlugin(registry);
  if (!plugin) {
    await ctx.reply('Content Engine not available.');
    return;
  }

  const text = ctx.message?.text ?? '';
  const args = text.replace(/^\/reject\s*/i, '').trim();
  const spaceIndex = args.indexOf(' ');
  const draftId = spaceIndex > 0 ? args.slice(0, spaceIndex) : args;
  const reason = spaceIndex > 0 ? args.slice(spaceIndex + 1).trim() : undefined;

  if (!draftId) {
    await ctx.reply('Usage: /reject <draft-id> [reason]');
    return;
  }

  const queue = plugin.getDraftQueue();
  const draft = queue.getDraft(draftId);

  if (!draft) {
    await ctx.reply(`Draft not found: ${draftId}`);
    return;
  }

  try {
    await queue.updateStatus(draftId, 'rejected', reason);
    await ctx.reply(`Rejected: <b>${draft.topicBrief.headline}</b>${reason ? `\nReason: ${reason}` : ''}`, {
      parse_mode: 'HTML',
    });
  } catch (error) {
    await ctx.reply(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

**Step 4: Wire commands in bot.ts**

In `src/plugins/telegram-bot/bot.ts`:

Add import:
```typescript
import { handleDrafts, handleApprove, handleReject } from './commands/content.js';
```

Add command registrations (after the existing command block):
```typescript
bot.command('drafts', (ctx) => handleDrafts(ctx, registry));
bot.command('approve', (ctx) => handleApprove(ctx, registry));
bot.command('reject', (ctx) => handleReject(ctx, registry));
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/unit/plugins/telegram-bot/commands/content.test.ts`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/plugins/telegram-bot/commands/content.ts src/plugins/telegram-bot/bot.ts tests/unit/plugins/telegram-bot/commands/content.test.ts
git commit -m "feat(content-engine): add /drafts, /approve, /reject Telegram commands"
```

---

## Task 11: Integration Test — Full Pipeline

Test the end-to-end flow: intelligence items → trend analysis → drafting → queue → review.

**Files:**
- Create: `tests/integration/content-engine.test.ts`

**Step 1: Write the integration test**

```typescript
// tests/integration/content-engine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/kernel/event-bus.js';
import { TrendAnalyzer } from '../../src/plugins/content-engine/trend-analyzer.js';
import { ContentDrafter } from '../../src/plugins/content-engine/content-drafter.js';
import { DraftQueue } from '../../src/plugins/content-engine/draft-queue.js';
import { ContentEngineConfigSchema } from '../../src/plugins/content-engine/types.js';
import type { IntelligenceItem } from '../../src/autonomous/intelligence-scanner.js';

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('not found')),
    readdir: vi.fn().mockResolvedValue([]),
  },
}));

const mockOrchestrator = {
  chat: vi.fn().mockResolvedValue(
    'TWEET 1: AI agents just changed the game.\n\n' +
    'TWEET 2: Here is why this matters for solo devs.\n\n' +
    'TWEET 3: The cost of building with AI dropped 90% this year.\n\n' +
    'TWEET 4: Follow @PayThePryce for more builder insights.',
  ),
};

describe('Content Engine Integration', () => {
  let eventBus: EventBus;
  let config: ReturnType<typeof ContentEngineConfigSchema.parse>;

  beforeEach(() => {
    vi.resetAllMocks();
    eventBus = new EventBus();
    config = ContentEngineConfigSchema.parse({});
  });

  it('should flow from intelligence items to queued drafts', async () => {
    // 1. Simulate intelligence items
    const items: IntelligenceItem[] = [
      {
        id: 'intel-001',
        title: 'AI Agents Are Changing Software Development',
        summary: 'New autonomous coding agents can complete complex tasks',
        url: 'https://example.com/ai-agents',
        source: 'techcrunch',
        sourceCategory: 'tech_news',
        domains: ['ai', 'programming'],
        score: 88,
        scoreBreakdown: { relevance: 27, authority: 17, recency: 18, engagement: 14, novelty: 12 },
        fetchedAt: new Date().toISOString(),
        contentHash: 'hash1',
      },
    ];

    // 2. Trend analysis
    const analyzer = new TrendAnalyzer(config);
    const briefs = analyzer.analyze(items);
    expect(briefs.length).toBeGreaterThan(0);
    expect(briefs[0].headline).toBe('AI Agents Are Changing Software Development');

    // 3. Content drafting
    const drafter = new ContentDrafter(mockOrchestrator as never, config);
    const draftResult = await drafter.generateDraft(briefs[0]);
    expect(draftResult.content.length).toBeGreaterThan(1); // Thread = multiple tweets

    // 4. Queue management
    const queue = new DraftQueue(eventBus, '/tmp/test-content');
    const draft = await queue.addDraft({
      topicBrief: briefs[0],
      platform: draftResult.platform,
      content: draftResult.content,
    });
    expect(draft.status).toBe('pending');

    // 5. Review lifecycle
    const approved = await queue.updateStatus(draft.id, 'approved');
    expect(approved.status).toBe('approved');
    expect(approved.reviewedAt).toBeDefined();

    // 6. Verify events were emitted
    const events: string[] = [];
    eventBus.on('content:draft_generated', () => events.push('generated'));
    eventBus.on('content:draft_reviewed', () => events.push('reviewed'));

    // Create another draft to test events
    const draft2 = await queue.addDraft({
      topicBrief: briefs[0],
      platform: 'linkedin',
      content: ['LinkedIn post text'],
    });
    await queue.updateStatus(draft2.id, 'rejected', 'Not on-brand');

    expect(events).toContain('generated');
    expect(events).toContain('reviewed');
  });
});
```

**Step 2: Run the integration test**

Run: `npm test -- tests/integration/content-engine.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add tests/integration/content-engine.test.ts
git commit -m "test(content-engine): add integration test for full intelligence-to-draft pipeline"
```

---

## Task 12: Lint, Typecheck, and Full Test Suite

Verify everything works together.

**Step 1: Run linter**

Run: `npm run lint:fix`
Expected: No errors (fix any that appear)

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors (fix any that appear)

**Step 3: Run full test suite**

Run: `npm test`
Expected: ALL PASS (existing + new tests)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(content-engine): resolve lint and type errors"
```

---

## Summary

| Task | Component | Files Created/Modified |
|------|-----------|-----------------------|
| 1 | Types | `src/plugins/content-engine/types.ts` |
| 2 | EventBus | `src/kernel/event-bus.ts` (modify) |
| 3 | Trend Analyzer | `src/plugins/content-engine/trend-analyzer.ts` |
| 4 | Draft Queue | `src/plugins/content-engine/draft-queue.ts` |
| 5 | Content Drafter | `src/plugins/content-engine/content-drafter.ts` |
| 6 | X Write Methods | `src/integrations/twitter/client.ts` (modify) |
| 7 | Publisher | `src/plugins/content-engine/publisher.ts` |
| 8 | Plugin Index | `src/plugins/content-engine/index.ts` |
| 9 | Registration | `src/plugins/register-plugins.ts` (modify) |
| 10 | Telegram Commands | `src/plugins/telegram-bot/commands/content.ts`, `bot.ts` (modify) |
| 11 | Integration Test | `tests/integration/content-engine.test.ts` |
| 12 | Final Validation | lint + typecheck + full suite |

Total: 7 new files, 3 modified files, 8 test files, 12 commits.
