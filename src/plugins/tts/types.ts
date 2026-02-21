import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// TTS PLUGIN TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const TtsConfigSchema = z.object({
  apiKey: z.string().optional(),
  defaultVoice: z.string().default('Xb7hH8MSUJpSbSDYk0k2'), // Alice
  defaultModel: z.string().default('eleven_turbo_v2_5'),
  dailyCap: z.number().default(2.00), // $2/day
  costPer1000Chars: z.number().default(0.30),
});
export type TtsConfig = z.infer<typeof TtsConfigSchema>;

export interface SpeechRequest {
  text: string;
  voice?: string;
  model?: string;
  requestedBy: string;
}

export interface SpeechResult {
  audioBuffer: Buffer;
  textLength: number;
  estimatedCost: number;
  cached: boolean;
  voice: string;
}
