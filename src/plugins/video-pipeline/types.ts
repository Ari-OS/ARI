import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// VIDEO PIPELINE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Video format ─────────────────────────────────────────────────────────────

export const VideoFormatSchema = z.enum([
  'long_form',    // 8-15 min YouTube video, 1920x1080
  'short',        // 30-60s vertical, 1080x1920
  'tutorial',     // Screenshare + avatar overlay, 1920x1080
  'live_clip',    // 20-30s live stream highlight extract, vertical 1080x1920
]);
export type VideoFormat = z.infer<typeof VideoFormatSchema>;

// ── Script types ─────────────────────────────────────────────────────────────

export const VideoScriptSchema = z.object({
  id: z.string(),
  topic: z.string(),
  format: VideoFormatSchema.default('long_form'),
  outline: z.object({
    hook: z.string(),
    hookVariants: z.array(z.string()).default([]),  // A/B test variants
    sections: z.array(z.object({
      heading: z.string(),
      keyPoints: z.array(z.string()),
      graphicCue: z.string().optional(),            // [GRAPHIC: show chart]
    })),
    shortsClipHint: z.string().optional(),          // Which moment to extract for Shorts
    cta: z.string(),
  }),
  fullScript: z.string(),
  shortsScript: z.string().optional(),              // Standalone 30-60s version
  estimatedDuration: z.number(),                    // minutes
  targetKeywords: z.array(z.string()).default([]),  // SEO keywords to inject
  status: z.enum(['draft', 'approved', 'rendering', 'completed', 'failed']),
  version: z.number().default(1),
  createdAt: z.string(),
});
export type VideoScript = z.infer<typeof VideoScriptSchema>;

// ── Caption job ───────────────────────────────────────────────────────────────

export const CaptionJobSchema = z.object({
  id: z.string(),
  videoProjectId: z.string(),
  transcriptId: z.string().optional(),  // AssemblyAI transcript ID
  srtContent: z.string().optional(),    // Raw SRT text
  srtPath: z.string().optional(),       // Path to .srt file on disk
  status: z.enum(['pending', 'transcribing', 'ready', 'burned_in', 'failed']),
  createdAt: z.string(),
});
export type CaptionJob = z.infer<typeof CaptionJobSchema>;

// ── Thumbnail ─────────────────────────────────────────────────────────────────

export const ThumbnailSchema = z.object({
  id: z.string(),
  videoProjectId: z.string(),
  concept: z.string(),        // AI-generated concept description
  imagePath: z.string().optional(),
  variants: z.array(z.string()).default([]),  // A/B variant paths
  selectedVariant: z.number().default(0),
  status: z.enum(['pending', 'generating', 'ready', 'failed']),
  createdAt: z.string(),
});
export type Thumbnail = z.infer<typeof ThumbnailSchema>;

// ── Shorts extraction ─────────────────────────────────────────────────────────

export const ShortsClipSchema = z.object({
  id: z.string(),
  parentProjectId: z.string(),
  startSeconds: z.number(),
  endSeconds: z.number(),
  outputPath: z.string().optional(),
  hook: z.string(),           // Hook text overlay (top of frame)
  cta: z.string(),            // CTA overlay (bottom of frame)
  status: z.enum(['pending', 'extracting', 'ready', 'published', 'failed']),
  publishedAt: z.string().optional(),
  createdAt: z.string(),
});
export type ShortsClip = z.infer<typeof ShortsClipSchema>;

// ── Publish job ───────────────────────────────────────────────────────────────

export const PublishJobSchema = z.object({
  id: z.string(),
  videoProjectId: z.string(),
  platform: z.enum(['youtube', 'youtube_shorts']),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()).default([]),
  scheduledFor: z.string().optional(),  // ISO timestamp
  publishedId: z.string().optional(),   // YouTube video ID
  status: z.enum(['pending', 'approved', 'uploading', 'scheduled', 'published', 'failed']),
  createdAt: z.string(),
});
export type PublishJob = z.infer<typeof PublishJobSchema>;

// ── Approval request (sent to Telegram) ──────────────────────────────────────

export const ApprovalRequestSchema = z.object({
  id: z.string(),
  videoProjectId: z.string(),
  type: z.enum(['script', 'video', 'thumbnail', 'publish']),
  previewUrl: z.string().optional(),
  previewText: z.string(),    // Shown in Telegram message
  status: z.enum(['pending', 'approved', 'rejected', 'edited']),
  feedback: z.string().optional(),
  requestedAt: z.string(),
  resolvedAt: z.string().optional(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

// ── Video project (full lifecycle) ───────────────────────────────────────────

export const VideoProjectSchema = z.object({
  id: z.string(),
  scriptId: z.string(),
  format: VideoFormatSchema,
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),

  // Asset paths
  avatarVideoId: z.string().optional(),     // HeyGen video_id
  avatarVideoUrl: z.string().optional(),    // HeyGen CDN URL
  rawVideoPath: z.string().optional(),      // Downloaded .mp4
  captionedVideoPath: z.string().optional(), // FFmpeg burned-in captions
  thumbnailPath: z.string().optional(),
  outputPath: z.string().optional(),        // Final deliverable

  // Shorts
  shortsProjectId: z.string().optional(),   // Child project for extracted short

  // Cost tracking
  estimatedCostUsd: z.number().default(0),
  actualCostUsd: z.number().default(0),

  status: z.enum([
    'scripting',    // Script being written
    'approved',     // Script approved by Pryce
    'rendering',    // HeyGen rendering
    'transcribing', // AssemblyAI transcribing
    'assembling',   // FFmpeg captions burn-in
    'ready',        // All assets ready, pending final approval
    'publishing',   // Uploading to YouTube
    'published',    // Live on YouTube
    'failed',
  ]),
  createdAt: z.string(),
  publishedAt: z.string().optional(),
});
export type VideoProject = z.infer<typeof VideoProjectSchema>;

// ── Plugin config ─────────────────────────────────────────────────────────────

export const VideoPipelineConfigSchema = z.object({
  heygenApiKey: z.string().optional(),
  avatarId: z.string().optional(),
  voiceId: z.string().optional(),
  assemblyAiApiKey: z.string().optional(),
  youtubeClientId: z.string().optional(),
  youtubeClientSecret: z.string().optional(),
  youtubeRefreshToken: z.string().optional(),
  openaiApiKey: z.string().optional(),     // Thumbnail generation
  outputDir: z.string().optional(),
  autoExtractShorts: z.boolean().default(true),
  autoGenerateThumbnail: z.boolean().default(true),
  requireApproval: z.boolean().default(true),   // Require Pryce approval before publishing
  scheduleDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))
    .default(['tue', 'wed', 'thu']),
  scheduleHourET: z.number().min(0).max(23).default(12),  // Optimal: 12pm ET
}).default({});
export type VideoPipelineConfig = z.infer<typeof VideoPipelineConfigSchema>;

// ── HeyGen API shapes ─────────────────────────────────────────────────────────

export interface HeyGenCreateResponse {
  data: { video_id: string };
  error: string | null;
}

export interface HeyGenStatusResponse {
  data: {
    status: string;
    video_url?: string;
    duration?: number;
    error?: string;
  };
  error: string | null;
}

export interface HeyGenAvatarsResponse {
  data: {
    avatars: Array<{
      avatar_id: string;
      avatar_name: string;
      gender: string;
      preview_image_url?: string;
    }>;
  };
  error: string | null;
}

export interface HeyGenVoicesResponse {
  data: {
    voices: Array<{
      voice_id: string;
      language: string;
      gender: string;
      name: string;
      preview_audio?: string;
      support_pause: boolean;
    }>;
  };
  error: string | null;
}

// ── Public types for avatar renderer ─────────────────────────────────────────

export interface CreateVideoParams {
  scriptText: string;
  avatarId: string;
  voiceId: string;
  format: VideoFormat;
}

export interface VideoStatusResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl: string | null;
  duration: number | null;
  error: string | null;
}

export interface Avatar {
  avatarId: string;
  avatarName: string;
  gender: string;
  previewImageUrl: string | null;
}

export interface HeyGenVoice {
  voiceId: string;
  language: string;
  gender: string;
  name: string;
  previewAudioUrl: string | null;
  supportsPause: boolean;
}
