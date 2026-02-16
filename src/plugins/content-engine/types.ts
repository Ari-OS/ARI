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
  'scheduled',       // Approved and scheduled for publishing
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

// ═══════════════════════════════════════════════════════════════════════════════
// Buying intent monitoring
// ═══════════════════════════════════════════════════════════════════════════════

export const BuyingIntentMatchSchema = z.object({
  id: z.string(),
  tweetId: z.string(),
  authorUsername: z.string(),
  authorFollowers: z.number(),
  tweetText: z.string(),
  matchedKeywords: z.array(z.string()),
  score: z.number().min(0).max(100),
  detectedAt: z.string(),
  status: z.enum(['pending', 'drafted', 'approved', 'replied', 'skipped']),
  draftReplyId: z.string().optional(),
});
export type BuyingIntentMatch = z.infer<typeof BuyingIntentMatchSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Content analytics
// ═══════════════════════════════════════════════════════════════════════════════

export const ContentMetricSchema = z.object({
  id: z.string(),
  draftId: z.string(),
  platform: ContentPlatformSchema,
  publishedIds: z.array(z.string()),
  publishedAt: z.string(),
  collectedAt: z.string(),
  metrics: z.object({
    impressions: z.number(),
    likes: z.number(),
    retweets: z.number(),
    replies: z.number(),
    engagementRate: z.number(),
  }),
  performanceScore: z.number().min(0).max(100),
});
export type ContentMetric = z.infer<typeof ContentMetricSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Feedback insights
// ═══════════════════════════════════════════════════════════════════════════════

export const FeedbackInsightSchema = z.object({
  id: z.string(),
  category: z.enum(['topic', 'hook', 'format', 'timing', 'cta']),
  insight: z.string(),
  evidence: z.array(z.string()),
  recommendation: z.string(),
  confidence: z.number().min(0).max(100),
  generatedAt: z.string(),
});
export type FeedbackInsight = z.infer<typeof FeedbackInsightSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Engagement opportunities
// ═══════════════════════════════════════════════════════════════════════════════

export const EngagementOpportunitySchema = z.object({
  id: z.string(),
  type: z.enum(['like', 'retweet', 'quote_tweet', 'reply']),
  tweetId: z.string(),
  authorUsername: z.string(),
  tweetText: z.string(),
  relevanceScore: z.number().min(0).max(100),
  draftedAction: z.string().optional(),
  status: z.enum(['pending', 'approved', 'executed', 'skipped']),
  detectedAt: z.string(),
});
export type EngagementOpportunity = z.infer<typeof EngagementOpportunitySchema>;
