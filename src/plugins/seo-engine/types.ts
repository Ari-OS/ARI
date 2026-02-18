import { z } from 'zod';

export const KeywordDataSchema = z.object({
  keyword: z.string(),
  volume: z.number().optional(),
  difficulty: z.number().min(0).max(100).optional(),
  intent: z.enum(['informational', 'commercial', 'transactional', 'navigational']).optional(),
  position: z.number().optional(),
  lastChecked: z.string().optional(),
  url: z.string().optional(),
});
export type KeywordData = z.infer<typeof KeywordDataSchema>;

export const SEOScoreSchema = z.object({
  total: z.number().min(0).max(100),
  breakdown: z.object({
    searchIntent: z.number().min(0).max(15),
    keywordPlacement: z.number().min(0).max(15),
    readability: z.number().min(0).max(10),
    structure: z.number().min(0).max(10),
    eatSignals: z.number().min(0).max(10),
    mediaRichness: z.number().min(0).max(10),
    internalLinks: z.number().min(0).max(10),
    externalLinks: z.number().min(0).max(5),
    faqSection: z.number().min(0).max(5),
    metaOptimization: z.number().min(0).max(5),
    aiDetection: z.number().min(0).max(5),
  }),
  suggestions: z.array(z.string()),
});
export type SEOScore = z.infer<typeof SEOScoreSchema>;

export const SEOContentBriefSchema = z.object({
  keyword: z.string(),
  intent: z.string(),
  targetWordCount: z.number(),
  suggestedTitle: z.string(),
  suggestedHeadings: z.array(z.string()),
  lsiKeywords: z.array(z.string()),
  faqs: z.array(z.string()),
  competitorInsights: z.array(z.string()),
});
export type SEOContentBrief = z.infer<typeof SEOContentBriefSchema>;

export const SEOEngineConfigSchema = z.object({
  targetDomains: z.array(z.string()).default(['prycehedrick.com']),
  maxKeywords: z.number().default(50),
}).default({});
export type SEOEngineConfig = z.infer<typeof SEOEngineConfigSchema>;
